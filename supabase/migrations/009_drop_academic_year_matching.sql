-- ============================================================
-- SASP-INES Migration 009 — Drop academic_year from Course Matching
-- Run this AFTER 008_correct_specialization_durations.sql.
--
-- WHAT CHANGED (business decision):
--   A student now sees a course whenever department + program +
--   year_of_study match — academic_year is no longer part of the
--   matching criteria. Free-text academic_year values (e.g.
--   "2025-2026" vs "2025/26" vs "2026") were silently breaking
--   visibility because the old function required an EXACT string
--   match on all four fields.
--
-- WHY THE SIGNATURE IS UNCHANGED:
--   The function keeps all 4 parameters (p_department, p_program,
--   p_year_of_study, p_academic_year) so the existing RLS policy
--   on courses (which calls
--   matches_academic_profile(department, program, year_of_study,
--   academic_year)) does NOT need to be touched or recreated.
--   p_academic_year is simply accepted and ignored now.
--
-- NOTE: academic_year is still stored and still shown in the UI —
-- it just no longer gates course visibility.
-- ============================================================

CREATE OR REPLACE FUNCTION public.matches_academic_profile(
  p_department     text,
  p_program        text,
  p_year_of_study  smallint,
  p_academic_year  text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND department    = p_department
      AND program       = p_program
      AND year_of_study = p_year_of_study
      -- academic_year intentionally NOT compared anymore.
      -- p_academic_year is kept as a parameter only so the calling
      -- RLS policy's function signature doesn't need to change.
  );
END;
$function$;

COMMENT ON FUNCTION public.matches_academic_profile IS
  'Course visibility match for students: department + program + '
  'year_of_study only. academic_year is intentionally excluded '
  '(see migration 009) — free-text formatting inconsistencies were '
  'silently hiding otherwise-matching courses. The academic_year '
  'parameter is retained only for signature compatibility with the '
  'existing courses RLS policy.';


-- ── Quick verification ────────────────────────────────────────────
-- After running this, ahmed (Computer Science / Software Engineering
-- / Year 1) should see CS102 once it's also switched to is_active =
-- true, regardless of CS102's academic_year value.
--
-- To activate CS102 from the SQL Editor directly (or just use the
-- "Active" toggle in /admin/courses):
--
--   UPDATE public.courses SET is_active = true WHERE code = 'CS102';
-- ─────────────────────────────────────────────────────────────────
