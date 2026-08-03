-- ============================================================
-- SASP-INES Migration 002 (v2) — Courses Table
-- Run this AFTER 001_profiles.sql.
--
-- CHANGES FROM v1:
--
--   Security fix: student SELECT RLS
--     v1 used USING (true) — every authenticated user could read
--     all course rows. The application-layer filter was the only
--     protection, which is insufficient.
--     v2: two separate policies enforce academic targeting at the
--     database level. Students see ONLY courses matching their own
--     department + program + year_of_study + is_active = true.
--     Admins see all courses. Both use SECURITY DEFINER helpers
--     to avoid any RLS recursion risk.
--
--   Added SECURITY DEFINER helper: public.matches_academic_profile()
--     Reads the authenticated user's department, program, and
--     year_of_study from public.profiles without triggering RLS
--     (BYPASSRLS via function owner). Compares against the candidate
--     course row. Returns TRUE only when all three fields match.
--
--   is_active default changed from TRUE → FALSE
--     New courses are invisible to students until an admin explicitly
--     activates them. Prevents accidental early visibility.
--
--   Indexes updated to match the new RLS query pattern.
-- ============================================================


-- ── 1. SECURITY DEFINER Helper: matches_academic_profile() ───────
--
-- PURPOSE:
--   Used inside the student SELECT policy on public.courses to verify
--   that the current user's academic profile matches the course row
--   being evaluated.
--
-- WHY SECURITY DEFINER:
--   An RLS policy on courses cannot safely query public.profiles
--   using a plain subquery — that subquery triggers the profiles RLS
--   policies, and while this does not cause courses ↔ profiles
--   recursion today, it creates fragile coupling: any future change
--   to profiles policies could silently break course visibility.
--   A SECURITY DEFINER function runs as the function owner (postgres,
--   BYPASSRLS), reading profiles directly without invoking any RLS.
--   This matches the hardened pattern established for is_admin() in
--   001_profiles.sql.
--
-- ARGUMENTS:
--   p_department    — the course's department value
--   p_program       — the course's program value
--   p_year_of_study — the course's year_of_study value
--   These are passed from the USING clause of the SELECT policy.
--
-- RETURNS:
--   TRUE  when auth.uid()'s profile matches all three arguments.
--   FALSE when no match, or when auth.uid() has no profile row.
--
-- PERMISSIONS:
--   REVOKE from PUBLIC and anon → anonymous users cannot call it.
--   GRANT to authenticated      → required for RLS policy evaluation.
--   Not a security risk if called directly by an authenticated user:
--   it only returns whether the caller's own profile matches a given
--   academic context — no other user's data is exposed.
--
-- REUSE:
--   This function can be reused by future modules (Documents,
--   Announcements) that need the same non-nullable exact-match check
--   against the current user's academic profile.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.matches_academic_profile(
  p_department    text,
  p_program       text,
  p_year_of_study smallint,
  p_academic_year text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id            = auth.uid()
      AND  department    = p_department
      AND  program       = p_program
      AND  year_of_study = p_year_of_study
      AND  academic_year = p_academic_year
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.matches_academic_profile(text, text, smallint, text)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.matches_academic_profile(text, text, smallint, text)
  FROM anon;

GRANT EXECUTE ON FUNCTION public.matches_academic_profile(text, text, smallint, text)
  TO authenticated;

COMMENT ON FUNCTION public.matches_academic_profile IS
  'Returns TRUE if the current user''s profile matches the given '
  'department + program + year_of_study + academic_year. '
  'SECURITY DEFINER — bypasses RLS on profiles to prevent policy '
  'coupling. Used in RLS SELECT policies on academic content tables '
  '(courses, documents, announcements, and future modules).';


-- ── 2. Courses Table ─────────────────────────────────────────────
--
-- DESIGN DECISIONS (unchanged from v1 unless noted):
--
--   No `semester` column.
--     INES-Ruhengeri does not organise delivery by semester.
--     Courses are scheduled individually (start_date / end_date).
--
--   academic_year is TEXT, e.g. "2026/2027".
--     Admin-set. Never derived from system date. Different programmes
--     start at different times (February, July, September, etc.).
--
--   year_of_study has no upper bound (>= 1 only).
--     Valid maximum is programme-specific. Application layer enforces
--     upper bound per programme.
--
--   start_date / end_date are optional (nullable).
--     Overlapping courses are explicitly supported — no constraint
--     prevents two courses running simultaneously.
--     If both dates are present: start_date <= end_date (DB CHECK).
--
--   is_active DEFAULT FALSE (changed from TRUE in v1).
--     New courses are invisible to students until explicitly activated.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identity ──────────────────────────────────────────────────
  code           TEXT              NOT NULL,
  title          TEXT              NOT NULL,
  description    TEXT,
  credits        SMALLINT          NOT NULL DEFAULT 3
                                   CHECK (credits > 0),
  instructor     TEXT,

  -- ── Academic Targeting ────────────────────────────────────────
  -- All four dimensions required. No semester.
  department     TEXT              NOT NULL,
  program        TEXT              NOT NULL,
  year_of_study  SMALLINT          NOT NULL
                                   CHECK (year_of_study >= 1),
  -- Admin-set string. Never auto-derived from the date.
  academic_year  TEXT              NOT NULL,

  -- ── Course Delivery Period ────────────────────────────────────
  -- Optional. Overlapping courses are explicitly allowed.
  -- These dates describe WHEN a course is taught — they do NOT
  -- control student visibility (is_active does that).
  start_date     DATE,
  end_date       DATE,

  -- ── Visibility ───────────────────────────────────────────────
  -- FALSE by default — admin must explicitly activate each course.
  -- true  → students matching the course's academic profile see it.
  -- false → hidden from students; admin can still manage it.
  is_active      BOOLEAN           NOT NULL DEFAULT false,

  -- ── Audit ────────────────────────────────────────────────────
  created_by     UUID              REFERENCES auth.users(id)
                                   ON DELETE SET NULL,
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  -- ── Constraints ──────────────────────────────────────────────
  CONSTRAINT courses_code_unique_per_context
    UNIQUE (code, program, academic_year),

  CONSTRAINT courses_dates_valid
    CHECK (
      start_date IS NULL
      OR end_date IS NULL
      OR start_date <= end_date
    )
);

COMMENT ON TABLE  public.courses IS
  'Academic courses. No semester — INES delivers courses on individual '
  'schedules that may overlap. Academic targeting: department + program '
  '+ year_of_study + academic_year. Visibility: is_active flag.';

COMMENT ON COLUMN public.courses.academic_year IS
  'Human-readable label, e.g. "2026/2027". Admin-set — never derived '
  'from date. INES programmes start at different times of year.';

COMMENT ON COLUMN public.courses.is_active IS
  'Defaults to FALSE. Admin must explicitly set to TRUE to make a '
  'course visible to students. This is the sole visibility gate — '
  'not derived from start_date/end_date.';

COMMENT ON COLUMN public.courses.start_date IS
  'Optional. When the course is taught. Overlapping with other courses '
  'is allowed. NULL if schedule is not yet confirmed.';

COMMENT ON COLUMN public.courses.end_date IS
  'Optional. Must be >= start_date if both provided (DB CHECK). '
  'NULL if schedule is not yet confirmed.';

COMMENT ON COLUMN public.courses.year_of_study IS
  'Target year within the programme. No upper-bound constraint — '
  'valid maximum is programme-specific (e.g., 4 for SE, 3 for others).';


-- ── 3. updated_at Trigger ────────────────────────────────────────
-- Reuses handle_updated_at() created in 001_profiles.sql.
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_course_updated ON public.courses;
CREATE TRIGGER on_course_updated
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ── 4. Row Level Security ─────────────────────────────────────────
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;


-- ── 5. Drop old policies (idempotent) ────────────────────────────
DROP POLICY IF EXISTS "courses_select_authenticated" ON public.courses;
DROP POLICY IF EXISTS "courses_select_student"       ON public.courses;
DROP POLICY IF EXISTS "courses_select_admin"         ON public.courses;
DROP POLICY IF EXISTS "courses_insert_admin"         ON public.courses;
DROP POLICY IF EXISTS "courses_update_admin"         ON public.courses;
DROP POLICY IF EXISTS "courses_delete_admin"         ON public.courses;


-- ── 6. RLS Policies ──────────────────────────────────────────────
--
-- POLICY DESIGN:
--
--   Two SELECT policies (permissive, ORed by PostgreSQL):
--     "courses_select_student" — matches rows a student may see
--     "courses_select_admin"   — matches all rows for admins
--
--   Because PostgreSQL ORs permissive policies, an admin always wins:
--     admin row check = (student policy) OR (admin policy)
--                     = (false because NOT is_admin() is false) OR (true)
--                     = true → admin sees all rows ✅
--
--     student row check = (student policy) OR (admin policy)
--                       = (true/false per match) OR (false)
--                       = student policy result only ✅
--
-- RECURSION ANALYSIS:
--   "courses_select_student" USING:
--     is_active = true                       → no subquery ✅
--     NOT public.is_admin()                  → SECURITY DEFINER ✅
--     public.matches_academic_profile(...)   → SECURITY DEFINER ✅
--   "courses_select_admin" USING:
--     public.is_admin()                      → SECURITY DEFINER ✅
--   All write policies USING/WITH CHECK:
--     public.is_admin()                      → SECURITY DEFINER ✅
-- ─────────────────────────────────────────────────────────────────


-- Policy 1: Students see only courses matching their own academic profile,
-- and only when is_active = true.
--
-- matches_academic_profile() reads the caller's profile via
-- SECURITY DEFINER (bypasses profiles RLS) and compares department,
-- program, and year_of_study against the course row.
--
-- NOT public.is_admin() ensures this policy does not fire for admins —
-- they are covered by the admin policy below. This also avoids an
-- unnecessary matches_academic_profile() call for admin sessions.
CREATE POLICY "courses_select_student"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND NOT public.is_admin()
    AND public.matches_academic_profile(
      department,       -- course's department
      program,          -- course's program
      year_of_study,    -- course's year_of_study
      academic_year     -- course's academic_year (must match profile)
    )
  );


-- Policy 2: Admins can SELECT all courses — active, inactive, and
-- from any academic year, programme, or department.
CREATE POLICY "courses_select_admin"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (public.is_admin());


-- Policy 3: Admins can INSERT new courses.
-- New courses default to is_active = false, so they are invisible
-- to students until the admin explicitly activates them.
CREATE POLICY "courses_insert_admin"
  ON public.courses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());


-- Policy 4: Admins can UPDATE any course (including toggling is_active).
CREATE POLICY "courses_update_admin"
  ON public.courses
  FOR UPDATE
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());


-- Policy 5: Admins can DELETE courses.
-- Prefer setting is_active = false over deleting when historical
-- references from future exams/documents must be preserved.
CREATE POLICY "courses_delete_admin"
  ON public.courses
  FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ── 7. Indexes ───────────────────────────────────────────────────
--
-- INDEX STRATEGY:
--
--   The student RLS policy evaluates three conditions per row:
--     is_active = true
--     department = <profile.department>
--     program    = <profile.program>
--     year_of_study = <profile.year_of_study>
--
--   matches_academic_profile() queries profiles by PRIMARY KEY (id),
--   so that lookup is always O(1) and needs no extra index.
--
--   For the courses table scan, the composite index below covers the
--   four equality conditions. Column order: department and program are
--   highest-cardinality (most selective), followed by year_of_study,
--   then is_active. This order gives the planner maximum benefit for
--   both the RLS evaluation and the application-layer query.
-- ─────────────────────────────────────────────────────────────────

-- Covers the student RLS conditions and the application SELECT query.
CREATE INDEX IF NOT EXISTS courses_student_filter_idx
  ON public.courses (department, program, year_of_study, is_active);

-- Admin: browse or filter by academic year.
CREATE INDEX IF NOT EXISTS courses_academic_year_idx
  ON public.courses (academic_year);

-- Admin: search or filter by course code.
CREATE INDEX IF NOT EXISTS courses_code_idx
  ON public.courses (code);


-- ── Done ─────────────────────────────────────────────────────────
--
-- WHAT STUDENTS SEE (enforced by RLS — no application-layer trust needed)
-- ──────────────────────────────────────────────────────────────────
--   A student with profile:
--     department    = 'Computer Science'
--     program       = 'Software Engineering'
--     year_of_study = 3
--   will only ever receive course rows where ALL of the following hold:
--     courses.department    = 'Computer Science'
--     courses.program       = 'Software Engineering'
--     courses.year_of_study = 3
--     courses.is_active     = true
--   regardless of how the client query is constructed.
--
-- APPLICATION QUERY (server-side, mirrors RLS for clarity)
-- ──────────────────────────────────────────────────────────────────
--   supabase.from('courses').select('*')
--     .eq('department',    profile.department)
--     .eq('program',       profile.program)
--     .eq('year_of_study', profile.year_of_study)
--     .eq('is_active',     true)
--     .order('code');
--
--   The RLS already filters to exactly this set. The application
--   filter is kept for clarity and query-planner performance — it is
--   no longer the security boundary.
--
-- HOW TO ADD AND ACTIVATE A COURSE
-- ──────────────────────────────────────────────────────────────────
--   Step 1 — Insert (is_active defaults to false, invisible to students):
--
--   INSERT INTO public.courses
--     (code, title, credits, department, program,
--      year_of_study, academic_year)
--   VALUES
--     ('CS301', 'Data Structures', 3, 'Computer Science',
--      'Software Engineering', 3, '2026/2027');
--
--   Step 2 — Activate when ready:
--
--   UPDATE public.courses
--   SET is_active = true
--   WHERE code = 'CS301' AND academic_year = '2026/2027';
--
-- DELIVERY STATUS (computed in application, not stored)
-- ──────────────────────────────────────────────────────────────────
--   | start_date  | end_date | now() position | Status        |
--   |-------------|----------|----------------|---------------|
--   | NULL        | NULL     | any            | 'unknown'     |
--   | future      | any      | before start   | 'scheduled'   |
--   | past/now    | future   | in range       | 'in_progress' |
--   | any         | past     | after end      | 'completed'   |
-- ─────────────────────────────────────────────────────────────────
