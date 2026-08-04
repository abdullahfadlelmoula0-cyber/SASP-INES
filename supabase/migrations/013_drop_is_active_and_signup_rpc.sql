-- ============================================================
-- Migration 013 — Drop courses.is_active + Student Self-Signup RPC
-- ============================================================
-- Live audit (run before applying):
--   SELECT policyname, tablename, qual FROM pg_policies
--   WHERE schemaname = 'public' AND qual ILIKE '%is_active%';
-- Confirmed: two policies + course_visible_to_student() function.
-- ============================================================

-- ── 1. Drop the legacy simple policy first ───────────────────
DROP POLICY IF EXISTS "Students can view active courses" ON public.courses;

-- ── 2. Drop the modern student-select policy ─────────────────
DROP POLICY IF EXISTS "courses_select_student" ON public.courses;

-- ── 3. Drop the is_active column ─────────────────────────────
ALTER TABLE public.courses DROP COLUMN IF EXISTS is_active;

-- ── 4. Recreate courses_select_student WITHOUT is_active ─────
--    Keeps the full two-path logic intact:
--      Path A: legacy (department + program + year_of_study)
--      Path B: structured (academic_plan_id + year_number + specialization_id)
CREATE POLICY "courses_select_student"
  ON public.courses
  FOR SELECT
  USING (
    (NOT is_admin())
    AND (
      -- Path A: legacy department/program matching
      (
        academic_plan_id IS NULL
        AND matches_academic_profile(
          department, program, year_of_study::smallint, ''::text
        )
      )
      OR
      -- Path B: structured plan/specialization matching
      (
        academic_plan_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.academic_plan_id = courses.academic_plan_id
            AND p.year_of_study = courses.year_number
            AND (
              courses.specialization_id IS NULL
              OR courses.specialization_id = p.specialization_id
            )
        )
      )
    )
  );

-- ── 5. Recreate course_visible_to_student() WITHOUT is_active ─
CREATE OR REPLACE FUNCTION public.course_visible_to_student(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND (
        (
          c.academic_plan_id IS NULL
          AND public.matches_academic_profile(
            c.department, c.program, c.year_of_study::smallint, ''::text
          )
        )
        OR
        (
          c.academic_plan_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.academic_plan_id = c.academic_plan_id
              AND p.year_of_study = c.year_number
              AND (c.specialization_id IS NULL OR c.specialization_id = p.specialization_id)
          )
        )
      )
  );
$$;

-- ── 6. documents / exams policies are unchanged ───────────────
-- They call course_visible_to_student(), which now has no is_active
-- check. No direct is_active reference in their own qual — confirmed.

-- ── 7. SECURITY DEFINER RPC for student self-signup ──────────
-- This function is called from the client AFTER supabase.auth.signUp()
-- succeeds. It inserts exactly one profile row for the caller's
-- auth.uid(), hardcoding role = 'student' so the client can never
-- escalate their role.
--
-- The existing INSERT RLS policy "Enable insert for users based on
-- user_id" (WITH CHECK: auth.uid() = id) would allow role spoofing
-- from the client. This SECURITY DEFINER function bypasses RLS and
-- enforces the correct role server-side instead.
CREATE OR REPLACE FUNCTION public.create_student_profile(
  p_full_name         text,
  p_university_email  text,
  p_academic_plan_id  uuid,
  p_specialization_id uuid,   -- nullable
  p_year_of_study     smallint,
  p_academic_year     text,
  p_department_name   text,   -- display-only, derived from plan
  p_program_name      text    -- display-only, derived from plan/spec
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Guard: must be called by an authenticated user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: one profile per user only
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Profile already exists for this account';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    university_email,
    role,
    academic_plan_id,
    specialization_id,
    year_of_study,
    academic_year,
    department,
    program,
    updated_at
  ) VALUES (
    v_user_id,
    p_full_name,
    p_university_email,
    'student',                  -- hardcoded; client cannot override
    p_academic_plan_id,
    p_specialization_id,
    p_year_of_study,
    p_academic_year,
    p_department_name,
    p_program_name,
    now()
  );
END;
$$;

-- Grant execute to the anon + authenticated roles so the client SDK
-- can call it. The SECURITY DEFINER body will still enforce all guards.
GRANT EXECUTE ON FUNCTION public.create_student_profile(
  text, text, uuid, uuid, smallint, text, text, text
) TO anon, authenticated;
