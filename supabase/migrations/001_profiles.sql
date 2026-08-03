-- ============================================================
-- SASP-INES Migration 001 (v3) — Profiles Table & Auth Foundation
-- Run this in the Supabase SQL Editor (project dashboard).
--
-- CHANGES FROM v2:
--   Removed `semester` column from profiles.
--   INES-Ruhengeri does not organize course delivery by semester.
--   Courses are delivered on their own schedule (start_date/end_date)
--   and may overlap. The semester concept does not apply to the
--   student's academic context at INES.
--
--   profile_protected_fields_unchanged() function updated accordingly:
--   semester parameter and comparison removed from signature and body.
-- ============================================================


-- ── 1. Role Enum ─────────────────────────────────────────────────
-- Idempotent: only creates if the type does not yet exist.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('student', 'admin');
  END IF;
END;
$$;


-- ── 2. Profiles Table ─────────────────────────────────────────────
-- One row per auth.users entry. Cascade delete keeps referential
-- integrity when a user is removed from Supabase Auth.
--
-- NOTE: No `semester` column.
--   INES does not organize student academic context by semester.
--   Course delivery is date-based (start_date / end_date on courses).
--
-- NOTE: year_of_study has no upper bound.
--   The valid maximum depends on the programme's duration, which is
--   programme-specific (e.g., 4 years for Software Engineering,
--   3 years for another programme). The application layer validates
--   the upper bound per programme.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID              PRIMARY KEY
                                     REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id       TEXT              UNIQUE,
  full_name        TEXT              NOT NULL DEFAULT '',
  university_email TEXT              UNIQUE,
  department       TEXT              NOT NULL DEFAULT '',
  program          TEXT              NOT NULL DEFAULT '',
  year_of_study    SMALLINT          NOT NULL DEFAULT 1
                                     CHECK (year_of_study >= 1),
  -- Admin-set academic year label, e.g. "2026/2027".
  -- Never auto-derived from the system date. Default '' means
  -- "not yet assigned by admin". Student sees zero courses until set.
  academic_year    TEXT              NOT NULL DEFAULT '',
  role             public.user_role  NOT NULL DEFAULT 'student',
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles IS
  'Extended user profiles linked to auth.users. One row per authenticated user.';
COMMENT ON COLUMN public.profiles.role IS
  'User role. Only admins can promote other users. Students cannot self-promote.';
COMMENT ON COLUMN public.profiles.student_id IS
  'University-issued student ID (e.g. UG2528267). Set manually by admin.';
COMMENT ON COLUMN public.profiles.full_name IS
  'Student-editable field. Updated via profiles_update_student policy.';
COMMENT ON COLUMN public.profiles.avatar_url IS
  'Student-editable field. URL of avatar image in Supabase Storage.';
COMMENT ON COLUMN public.profiles.year_of_study IS
  'The student''s current year within their programme (e.g., 3). '
  'Upper bound is programme-specific — not validated at DB level.';
COMMENT ON COLUMN public.profiles.academic_year IS
  'Current academic year label, e.g. "2026/2027". Admin-set — never '
  'auto-derived from date. Controls which courses a student sees. '
  'Must match the academic_year stored in public.courses.';


-- ── 3. SECURITY DEFINER Helper: is_admin() ───────────────────────
--
-- PURPOSE: Single authoritative check for whether the current
--   authenticated session belongs to an admin.
--
-- WHY SECURITY DEFINER: RLS policies on public.profiles cannot safely
--   query public.profiles themselves — doing so triggers those same
--   policies, causing infinite recursion. A SECURITY DEFINER function
--   runs as the function owner (the postgres / superuser role in
--   Supabase, which has BYPASSRLS), so it reads the table directly
--   without invoking any RLS policies.
--
-- PERMISSIONS:
--   REVOKE from PUBLIC and anon  → anonymous users cannot call it.
--   GRANT  to authenticated       → required so RLS policies can call
--                                   it during session evaluation.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
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
    WHERE  id   = auth.uid()
      AND  role = 'admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO   authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns TRUE if auth.uid() has role = ''admin''. '
  'SECURITY DEFINER — bypasses RLS to prevent infinite recursion. '
  'Callable only by authenticated users.';


-- ── 4. SECURITY DEFINER Helper: profile_protected_fields_unchanged()
--
-- PURPOSE: In the student UPDATE WITH CHECK, compare every
--   admin-controlled field in the proposed NEW row against the
--   currently stored values. Returns TRUE only if ALL protected
--   fields are identical, preventing students from modifying any
--   field other than full_name and avatar_url.
--
-- WHY SECURITY DEFINER: Same reason as is_admin(). The WITH CHECK
--   clause of an UPDATE policy cannot safely subquery the same table
--   without risking recursion. The function bypasses RLS to read the
--   stored row directly.
--
-- ARGUMENTS: The proposed NEW values for every admin-controlled
--   column, passed from the WITH CHECK clause. In a WITH CHECK
--   context, unqualified column names refer to the NEW (proposed)
--   row values — so `role` is what the client is trying to write.
--
-- NULLABLE FIELDS: student_id and university_email are nullable.
--   They use IS NOT DISTINCT FROM which treats NULL = NULL as TRUE,
--   unlike the = operator which returns NULL for NULL comparisons.
--
-- NOTE: semester is intentionally NOT a parameter.
--   INES-Ruhengeri does not use semester-based academic organisation.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.profile_protected_fields_unchanged(
  p_role             public.user_role,
  p_student_id       text,
  p_university_email text,
  p_department       text,
  p_program          text,
  p_year_of_study    smallint,
  p_academic_year    text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_stored RECORD;
BEGIN
  -- Read the currently persisted values, bypassing RLS.
  SELECT
    role,
    student_id,
    university_email,
    department,
    program,
    year_of_study,
    academic_year
  INTO v_stored
  FROM public.profiles
  WHERE id = auth.uid();

  -- If for any reason no row is found, block the update.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN (
    -- Enum: NOT NULL — use = operator
        p_role             =  v_stored.role

    -- Nullable TEXT — use IS NOT DISTINCT FROM
    AND p_student_id       IS NOT DISTINCT FROM v_stored.student_id
    AND p_university_email IS NOT DISTINCT FROM v_stored.university_email

    -- NOT NULL TEXT with default '' — use = operator
    AND p_department       =  v_stored.department
    AND p_program          =  v_stored.program
    AND p_academic_year    =  v_stored.academic_year

    -- NOT NULL SMALLINT — use = operator
    AND p_year_of_study    =  v_stored.year_of_study
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profile_protected_fields_unchanged(
  public.user_role, text, text, text, text, smallint, text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.profile_protected_fields_unchanged(
  public.user_role, text, text, text, text, smallint, text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.profile_protected_fields_unchanged(
  public.user_role, text, text, text, text, smallint, text
) TO authenticated;

COMMENT ON FUNCTION public.profile_protected_fields_unchanged IS
  'Returns TRUE if all admin-controlled fields (role, student_id, '
  'university_email, department, program, year_of_study, academic_year) '
  'are identical to their currently stored values. Used in the '
  'student UPDATE WITH CHECK to restrict editable fields. '
  'SECURITY DEFINER — bypasses RLS to prevent recursion.';


-- ── 5. Trigger: updated_at ────────────────────────────────────────
-- Runs BEFORE UPDATE to keep updated_at accurate automatically.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ── 6. Trigger: auto-create profile on auth.users INSERT ──────────
-- Creates a skeleton profile row for every new Supabase Auth user.
-- The role defaults to 'student' automatically.
-- ON CONFLICT DO NOTHING is a safety net in case this trigger fires
-- more than once for the same user (should not happen in practice).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, university_email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ── 7. Row Level Security ─────────────────────────────────────────
-- Enable RLS: deny-by-default. No policy = no access.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ── 8. Drop all old policies (idempotent) ────────────────────────
DROP POLICY IF EXISTS "profiles_select_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_student" ON public.profiles;


-- ── 9. RLS Policies ──────────────────────────────────────────────
--
-- RECURSION ANALYSIS:
--   "profiles_select_own"     USING: auth.uid() = id              ✅ no subquery
--   "profiles_select_admin"   USING: public.is_admin()            ✅ SECURITY DEFINER
--   "profiles_update_student" USING: uid = id AND NOT is_admin()  ✅ SECURITY DEFINER
--   "profiles_update_student" WITH CHECK: both SECURITY DEFINER   ✅
--   "profiles_update_admin"   USING + WITH CHECK: is_admin()      ✅ SECURITY DEFINER
--   "profiles_insert_admin"   WITH CHECK: is_admin()              ✅ SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────


-- Policy 1: Any authenticated user can SELECT their own profile row.
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);


-- Policy 2: Admins can SELECT ALL profile rows.
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());


-- Policy 3: Students (non-admins) can UPDATE only their own row,
-- and ONLY the fields full_name and avatar_url.
-- profile_protected_fields_unchanged() enforces that every other
-- admin-controlled field is unchanged in the proposed new row.
CREATE POLICY "profiles_update_student"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND NOT public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id
    AND NOT public.is_admin()
    AND public.profile_protected_fields_unchanged(
      role,             -- proposed new value for role
      student_id,       -- proposed new value for student_id
      university_email, -- proposed new value for university_email
      department,       -- proposed new value for department
      program,          -- proposed new value for program
      year_of_study,    -- proposed new value for year_of_study
      academic_year     -- proposed new value for academic_year
    )
  );


-- Policy 4: Admins can UPDATE any profile row, including all fields.
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());


-- Policy 5: Admins can INSERT profile rows manually (bulk import etc.)
CREATE POLICY "profiles_insert_admin"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());


-- ── 10. Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS profiles_university_email_idx
  ON public.profiles (university_email);

CREATE INDEX IF NOT EXISTS profiles_role_idx
  ON public.profiles (role);

CREATE INDEX IF NOT EXISTS profiles_student_id_idx
  ON public.profiles (student_id);


-- ── Done ─────────────────────────────────────────────────────────
--
-- HOW TO CREATE THE FIRST ADMIN
-- ─────────────────────────────
-- 1. Run this migration in the Supabase SQL Editor.
-- 2. Create the user in Supabase Auth (Dashboard → Auth → Users → Add).
-- 3. Trigger auto-creates their profile with role='student'.
-- 4. Promote to admin:
--
--    UPDATE public.profiles
--    SET    role = 'admin'
--    WHERE  university_email = 'your-admin@ines.ac.rw';
--
-- 5. Verify:
--    SELECT id, university_email, role FROM public.profiles
--    WHERE  university_email = 'your-admin@ines.ac.rw';
--
-- FIELD EDITABILITY SUMMARY
-- ─────────────────────────────────────────────────────────────────
-- | Field            | Student (own) | Admin (any row) |
-- |------------------|---------------|-----------------| 
-- | full_name        |  ✅ editable  |   ✅ editable   |
-- | avatar_url       |  ✅ editable  |   ✅ editable   |
-- | role             |  ❌ blocked   |   ✅ editable   |
-- | student_id       |  ❌ blocked   |   ✅ editable   |
-- | university_email |  ❌ blocked   |   ✅ editable   |
-- | department       |  ❌ blocked   |   ✅ editable   |
-- | program          |  ❌ blocked   |   ✅ editable   |
-- | year_of_study    |  ❌ blocked   |   ✅ editable   |
-- | academic_year    |  ❌ blocked   |   ✅ editable   |
-- ─────────────────────────────────────────────────────────────────
