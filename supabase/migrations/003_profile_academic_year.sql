-- ============================================================
-- SASP-INES Migration 003 — Add academic_year to Profiles
-- Run this AFTER 001_profiles.sql and BEFORE Courses migration
-- ============================================================

-- ── 1. Add academic_year ────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.profiles.academic_year IS
  'Current academic year label, e.g. "2026/2027". Admin-set — never '
  'auto-derived from the system date.';


-- ── 2. Drop student update policy ───────────────────────────────

DROP POLICY IF EXISTS "profiles_update_student"
  ON public.profiles;


-- ── 3. Remove old function versions ─────────────────────────────
-- Old correct version before academic_year:
--   6 arguments
--
-- Possible incorrect version from the manual edit:
--   8 arguments including semester
--
-- We remove both explicitly.

DROP FUNCTION IF EXISTS public.profile_protected_fields_unchanged(
  public.user_role,
  text,
  text,
  text,
  text,
  smallint
);

DROP FUNCTION IF EXISTS public.profile_protected_fields_unchanged(
  public.user_role,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  text
);


-- ── 4. Create the correct function ──────────────────────────────
-- Protected fields:
--   role
--   student_id
--   university_email
--   department
--   program
--   year_of_study
--   academic_year
--
-- NO semester.

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

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN (
       p_role             = v_stored.role
    AND p_student_id       IS NOT DISTINCT FROM v_stored.student_id
    AND p_university_email IS NOT DISTINCT FROM v_stored.university_email
    AND p_department       = v_stored.department
    AND p_program          = v_stored.program
    AND p_year_of_study    = v_stored.year_of_study
    AND p_academic_year    = v_stored.academic_year
  );

END;
$$;


-- ── 5. Permissions ──────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.profile_protected_fields_unchanged(
  public.user_role,
  text,
  text,
  text,
  text,
  smallint,
  text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.profile_protected_fields_unchanged(
  public.user_role,
  text,
  text,
  text,
  text,
  smallint,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.profile_protected_fields_unchanged(
  public.user_role,
  text,
  text,
  text,
  text,
  smallint,
  text
) TO authenticated;


-- ── 6. Recreate student UPDATE policy ───────────────────────────

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
      role,
      student_id,
      university_email,
      department,
      program,
      year_of_study,
      academic_year
    )
  );