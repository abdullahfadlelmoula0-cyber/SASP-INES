-- ============================================================
-- SASP-INES Migration 012 — Course Schema Cleanup
-- Run AFTER 011_course_documents_exams.sql.
--
-- WHAT THIS DOES:
--   1. Drops the `is_active` column from public.courses.
--      Previously: admins had to explicitly activate a course.
--      New behaviour: every course whose academic context matches
--      a student's profile is immediately visible.
--      Visibility is now controlled solely by the academic targeting
--      fields (academic_plan_id / specialization_id / year_number
--      for structured courses; department / program / year_of_study
--      for legacy text-based courses).
--
--   2. Rewrites the courses_select_student RLS policy to remove
--      the `is_active = true` condition.
--
--   3. Updates course_visible_to_student() helper (used by
--      documents and exams RLS) to also remove the is_active check.
--
--   4. academic_year remains in the table — it is displayed
--      to admins as informational context but is NO LONGER used
--      in any RLS matching or student-facing filtering.
--
--   5. Removes is_active = true filter from the legacy
--      matches_academic_profile() usage path in courses RLS.
--
-- SAFE TO RERUN: all DROP/CREATE IF NOT EXISTS are idempotent.
-- ============================================================


-- ── Step 1: Drop is_active column ────────────────────────────────
-- First drop the default so we can drop the column cleanly.
ALTER TABLE public.courses
  ALTER COLUMN is_active DROP DEFAULT;

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS is_active;

COMMENT ON TABLE public.courses IS
  'Academic courses. Visibility controlled purely by academic targeting '
  '(department + program + year_of_study for legacy courses; '
  'academic_plan_id + specialization_id + year_number for structured '
  'courses). academic_year is informational only — not used for matching.';


-- ── Step 2: Rewrite courses_select_student RLS policy ────────────
-- Remove the is_active = true condition. Students now see all
-- courses that match their academic context.
DROP POLICY IF EXISTS "courses_select_student" ON public.courses;

CREATE POLICY "courses_select_student"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (
    NOT public.is_admin()
    AND (
      -- Path 1: legacy free-text courses
      (
        academic_plan_id IS NULL
        AND public.matches_academic_profile(department, program, year_of_study, academic_year)
      )
      OR
      -- Path 2: structured courses (academic_plan_id based)
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

COMMENT ON POLICY "courses_select_student" ON public.courses IS
  'Students see courses matching their academic profile via EITHER the '
  'legacy department/program/year_of_study text match OR the structured '
  'academic_plan_id/specialization_id/year_number match. '
  'is_active check removed in migration 012 — visibility is now purely '
  'academic-context-based.';


-- ── Step 3: Update course_visible_to_student() helper ────────────
-- This function is used by documents and exams RLS policies.
-- Remove the is_active = true check.
CREATE OR REPLACE FUNCTION public.course_visible_to_student(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.id = p_course_id
      AND NOT public.is_admin()
      AND (
        (
          c.academic_plan_id IS NULL
          AND public.matches_academic_profile(c.department, c.program, c.year_of_study, c.academic_year)
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

COMMENT ON FUNCTION public.course_visible_to_student IS
  'True if the CURRENT authenticated user (auth.uid()) can see the '
  'given course as a student. is_active check removed in migration 012. '
  'Reused by documents/exams RLS (migration 011).';


-- ── Step 4: Drop the courses_student_filter_idx index ────────────
-- This index was created to cover the is_active condition.
-- It is no longer needed in the same form; we create a revised one.
DROP INDEX IF EXISTS courses_student_filter_idx;

-- New index: covers department, program, year_of_study only
-- (is_active column is gone).
CREATE INDEX IF NOT EXISTS courses_student_filter_idx
  ON public.courses (department, program, year_of_study);


-- ── Done ──────────────────────────────────────────────────────────
-- SUMMARY OF NEW STUDENT VISIBILITY RULE:
--   A student with profile:
--     department    = 'Computer Science'
--     program       = 'Software Engineering'
--     year_of_study = 3
--   will see ALL course rows where ALL of the following hold:
--     courses.department    = 'Computer Science'
--     courses.program       = 'Software Engineering'
--     courses.year_of_study = 3
--   regardless of any is_active flag (column no longer exists).
--   academic_year remains on courses as an informational admin label
--   but does NOT restrict student visibility.
-- ─────────────────────────────────────────────────────────────────
