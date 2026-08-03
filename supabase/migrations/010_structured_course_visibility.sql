-- ============================================================
-- SASP-INES Migration 010 — Structured Course Visibility for Students
-- Run this AFTER 009_drop_academic_year_matching.sql.
--
-- WHAT CHANGED:
--   courses_select_student previously matched ONLY via the legacy
--   text function matches_academic_profile(department, program,
--   year_of_study, academic_year). Courses created through
--   /admin/academic-structure use academic_plan_id / specialization_id
--   / year_number instead — those never matched anything, so
--   students never saw them.
--
--   This policy now matches EITHER path:
--     - Legacy courses (academic_plan_id IS NULL): unchanged behavior,
--       via matches_academic_profile().
--     - Structured courses (academic_plan_id IS NOT NULL): matched
--       against the student's OWN academic_plan_id / specialization_id
--       / year_of_study on their profile.
--
--   Nothing about admin policies changes. Nothing about existing
--   legacy courses changes.
-- ============================================================

DROP POLICY IF EXISTS "courses_select_student" ON public.courses;

CREATE POLICY "courses_select_student"
  ON public.courses
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND NOT public.is_admin()
    AND (
      -- Path 1: legacy free-text courses (unchanged behavior)
      (
        academic_plan_id IS NULL
        AND public.matches_academic_profile(department, program, year_of_study, academic_year)
      )
      OR
      -- Path 2: structured courses (academic_plan_id / specialization_id / year_number)
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
  'Students see active courses matching their profile via EITHER the '
  'legacy department/program/year_of_study/academic_year text match, '
  'OR the structured academic_plan_id/specialization_id/year_number '
  'match (courses created via /admin/academic-structure). See '
  'migration 010.';
