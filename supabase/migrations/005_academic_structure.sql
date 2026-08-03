-- ============================================================
-- SASP-INES Migration 005 — Flexible Academic Structure
-- Run this AFTER 001_profiles.sql, 002_courses.sql,
-- 003_profile_academic_year.sql, 004_grant_table_privileges.sql.
--
-- PURPOSE:
--   Introduce a normalized, department-agnostic academic structure
--   that replaces the hardcoded assumptions in lib/academic-config.ts:
--
--     - Every department can define ONE OR MORE academic plans.
--     - Each plan has a "shared trunk" of `shared_years` — years
--       during which ALL students in that plan take the same courses,
--       regardless of eventual specialization.
--     - After the shared trunk, a plan may branch into zero or more
--       `specializations` (tracks), each with its OWN total duration.
--       Example: Computer Science shared_years=2, with tracks
--       Software Engineering (4yr total), Computer Networks (3yr
--       total), Information Systems (4yr total), Data Science (4yr).
--     - A plan with ZERO specializations behaves as a single
--       unbranched programme (e.g. Civil Engineering: shared_years
--       equals the full duration, no track ever required).
--
-- WHAT THIS MIGRATION DOES NOT DO:
--   It does NOT remove or rename the existing TEXT columns
--   (profiles.department, profiles.program, courses.department,
--   courses.program). The current application code
--   (lib/academic-config.ts, matches_academic_profile(),
--   profile_protected_fields_unchanged()) continues to work exactly
--   as before, unmodified.
--
--   Instead, this migration ADDS a parallel, optional, normalized
--   structure (academic_plan_id / specialization_id / year_number)
--   that new features can build against. A future migration (006)
--   should drop the legacy TEXT columns once the application layer
--   has been migrated to the new structure.
-- ============================================================


-- ── 1. Departments ────────────────────────────────────────────────
-- Canonical list of departments/faculties. Distinct from
-- profiles.department (TEXT) — the two are not FK-linked yet.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.departments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.departments IS
  'Canonical departments/faculties at INES-Ruhengeri. Source of truth '
  'for academic_plans.department_id. Not yet FK-linked to the legacy '
  'profiles.department / courses.department TEXT columns.';


-- ── 2. Academic Plans ─────────────────────────────────────────────
-- One plan per programme family within a department (e.g. "Computer
-- Science", "Civil Engineering"). shared_years defines how many years
-- are common to ALL students before any specialization choice.
--
-- IMPORTANT: shared_years is the FULL duration when the plan has no
-- specializations at all (see Civil Engineering example below) —
-- there is no separate "duration_years" column. A plan's total
-- length is either shared_years (no specializations) or, once a
-- student picks a track, specializations.total_duration_years.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academic_plans (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id  UUID        NOT NULL REFERENCES public.departments(id)
                              ON DELETE RESTRICT,
  name           TEXT        NOT NULL,
  shared_years   SMALLINT    NOT NULL CHECK (shared_years >= 1),
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT academic_plans_name_unique_per_department
    UNIQUE (department_id, name)
);

COMMENT ON COLUMN public.academic_plans.shared_years IS
  'Years common to every student in this plan before any '
  'specialization is required. If the plan has zero rows in '
  'public.specializations, shared_years IS the total programme '
  'length (e.g. Civil Engineering = 4, no branching ever).';

COMMENT ON COLUMN public.academic_plans.is_active IS
  'FALSE hides the plan from new-student registration dropdowns '
  'without deleting it or affecting students already assigned to it.';


-- ── 3. Specializations (Tracks) ───────────────────────────────────
-- Zero or more per plan. total_duration_years is measured from
-- Year 1 of the plan (NOT years-after-branching), so it must be
-- >= the parent plan's shared_years. Enforced by trigger below,
-- since CHECK constraints cannot reference another table.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.specializations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_plan_id      UUID        NOT NULL REFERENCES public.academic_plans(id)
                                     ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  total_duration_years  SMALLINT    NOT NULL CHECK (total_duration_years >= 1),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT specializations_name_unique_per_plan
    UNIQUE (academic_plan_id, name)
);

COMMENT ON COLUMN public.specializations.total_duration_years IS
  'Total programme length from Year 1 through graduation for a '
  'student who picks this track — NOT years-after-branching. '
  'Must be >= the parent plan''s shared_years (trigger-enforced). '
  'Example: Computer Networks = 3 while Software Engineering = 4, '
  'both under the same Computer Science plan (shared_years = 2).';


CREATE OR REPLACE FUNCTION public.validate_specialization_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shared_years SMALLINT;
BEGIN
  SELECT shared_years INTO v_shared_years
  FROM public.academic_plans
  WHERE id = NEW.academic_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'academic_plan_id % does not exist', NEW.academic_plan_id;
  END IF;

  IF NEW.total_duration_years < v_shared_years THEN
    RAISE EXCEPTION
      'total_duration_years (%) cannot be shorter than the plan''s shared_years (%)',
      NEW.total_duration_years, v_shared_years;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_specialization_duration_trg ON public.specializations;
CREATE TRIGGER validate_specialization_duration_trg
  BEFORE INSERT OR UPDATE ON public.specializations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_specialization_duration();


-- ── 4. updated_at triggers for the new tables ─────────────────────
-- Reuses public.handle_updated_at() defined in 001_profiles.sql.
-- ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_department_updated ON public.departments;
CREATE TRIGGER on_department_updated
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_academic_plan_updated ON public.academic_plans;
CREATE TRIGGER on_academic_plan_updated
  BEFORE UPDATE ON public.academic_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_specialization_updated ON public.specializations;
CREATE TRIGGER on_specialization_updated
  BEFORE UPDATE ON public.specializations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


-- ── 5. Extend profiles (additive — legacy columns untouched) ─────
-- academic_plan_id / specialization_id are nullable so existing
-- rows (and any code still writing only department/program TEXT)
-- keep working. specialization_id is NULL until the student reaches
-- the plan's shared_years and a track is chosen (or forever, for
-- plans like Civil Engineering that have zero specializations).
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academic_plan_id  UUID REFERENCES public.academic_plans(id)
                                              ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specialization_id UUID REFERENCES public.specializations(id)
                                              ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.academic_plan_id IS
  'Normalized replacement (in progress) for the legacy department/'
  'program TEXT columns. Nullable during the migration period.';
COMMENT ON COLUMN public.profiles.specialization_id IS
  'NULL until the student reaches academic_plans.shared_years AND '
  'the plan has at least one specialization row. Always NULL for '
  'plans with zero specializations (e.g. Civil Engineering).';


CREATE OR REPLACE FUNCTION public.validate_student_specialization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shared_years  SMALLINT;
  v_spec_plan_id  UUID;
  v_spec_duration SMALLINT;
  v_has_specializations BOOLEAN;
BEGIN
  -- Nothing to validate if the student isn't on the new structure yet.
  IF NEW.academic_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT shared_years INTO v_shared_years
  FROM public.academic_plans
  WHERE id = NEW.academic_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'academic_plan_id % does not exist', NEW.academic_plan_id;
  END IF;

  IF NEW.specialization_id IS NOT NULL THEN
    SELECT academic_plan_id, total_duration_years
    INTO   v_spec_plan_id, v_spec_duration
    FROM   public.specializations
    WHERE  id = NEW.specialization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'specialization_id % does not exist', NEW.specialization_id;
    END IF;

    IF v_spec_plan_id != NEW.academic_plan_id THEN
      RAISE EXCEPTION
        'specialization_id % does not belong to academic_plan_id %',
        NEW.specialization_id, NEW.academic_plan_id;
    END IF;

    IF NEW.year_of_study > v_spec_duration THEN
      RAISE EXCEPTION
        'year_of_study (%) exceeds the specialization''s total_duration_years (%)',
        NEW.year_of_study, v_spec_duration;
    END IF;

  ELSE
    -- No specialization chosen yet. That's only valid if the student
    -- is still within the shared trunk, OR the plan has no
    -- specializations at all (single unbranched programme).
    SELECT EXISTS (
      SELECT 1 FROM public.specializations
      WHERE academic_plan_id = NEW.academic_plan_id
    ) INTO v_has_specializations;

    IF v_has_specializations AND NEW.year_of_study > v_shared_years THEN
      RAISE EXCEPTION
        'year_of_study (%) is past the shared trunk (%) — a specialization_id is required',
        NEW.year_of_study, v_shared_years;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_student_specialization_trg ON public.profiles;
CREATE TRIGGER validate_student_specialization_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_student_specialization();


-- ── 6. Extend courses (additive — legacy columns untouched) ──────
-- year_number replaces the ROLE that year_of_study plays for
-- courses.department/program-based targeting, but scoped to the new
-- academic_plan_id structure. specialization_id is NULL for shared-
-- trunk courses (year_number <= plan.shared_years) and required for
-- specialization-year courses.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS academic_plan_id  UUID REFERENCES public.academic_plans(id)
                                              ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specialization_id UUID REFERENCES public.specializations(id)
                                              ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS year_number       SMALLINT CHECK (year_number >= 1);

COMMENT ON COLUMN public.courses.academic_plan_id IS
  'Normalized replacement (in progress) for the legacy department/'
  'program TEXT columns. Nullable during the migration period.';
COMMENT ON COLUMN public.courses.year_number IS
  'Year within the plan (1-based). Required whenever academic_plan_id '
  'is set. If year_number <= plan.shared_years the course is shared '
  '(specialization_id must be NULL); otherwise it belongs to a '
  'specific track (specialization_id required).';


CREATE OR REPLACE FUNCTION public.validate_course_academic_targeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_shared_years  SMALLINT;
  v_spec_plan_id  UUID;
  v_spec_duration SMALLINT;
BEGIN
  -- Nothing to validate for courses still using the legacy TEXT targeting.
  IF NEW.academic_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.year_number IS NULL THEN
    RAISE EXCEPTION 'year_number is required when academic_plan_id is set';
  END IF;

  SELECT shared_years INTO v_shared_years
  FROM public.academic_plans
  WHERE id = NEW.academic_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'academic_plan_id % does not exist', NEW.academic_plan_id;
  END IF;

  IF NEW.year_number <= v_shared_years THEN
    IF NEW.specialization_id IS NOT NULL THEN
      RAISE EXCEPTION
        'year_number (%) is within the shared trunk (<=%) — specialization_id must be NULL',
        NEW.year_number, v_shared_years;
    END IF;
  ELSE
    IF NEW.specialization_id IS NULL THEN
      RAISE EXCEPTION
        'year_number (%) is past the shared trunk (%) — specialization_id is required',
        NEW.year_number, v_shared_years;
    END IF;

    SELECT academic_plan_id, total_duration_years
    INTO   v_spec_plan_id, v_spec_duration
    FROM   public.specializations
    WHERE  id = NEW.specialization_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'specialization_id % does not exist', NEW.specialization_id;
    END IF;

    IF v_spec_plan_id != NEW.academic_plan_id THEN
      RAISE EXCEPTION
        'specialization_id % does not belong to academic_plan_id %',
        NEW.specialization_id, NEW.academic_plan_id;
    END IF;

    IF NEW.year_number > v_spec_duration THEN
      RAISE EXCEPTION
        'year_number (%) exceeds the specialization''s total_duration_years (%)',
        NEW.year_number, v_spec_duration;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_course_academic_targeting_trg ON public.courses;
CREATE TRIGGER validate_course_academic_targeting_trg
  BEFORE INSERT OR UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_course_academic_targeting();


-- ── 7. Row Level Security ─────────────────────────────────────────
-- departments / academic_plans / specializations are reference/config
-- data, not student-private data. Every authenticated user (student
-- or admin) needs to READ them — e.g. to populate registration and
-- profile-editing dropdowns. Only admins may write.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.departments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specializations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_select_authenticated"     ON public.departments;
DROP POLICY IF EXISTS "departments_write_admin"               ON public.departments;
DROP POLICY IF EXISTS "academic_plans_select_authenticated"   ON public.academic_plans;
DROP POLICY IF EXISTS "academic_plans_write_admin"            ON public.academic_plans;
DROP POLICY IF EXISTS "specializations_select_authenticated"  ON public.specializations;
DROP POLICY IF EXISTS "specializations_write_admin"           ON public.specializations;

-- Departments
CREATE POLICY "departments_select_authenticated"
  ON public.departments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "departments_write_admin"
  ON public.departments
  FOR ALL
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Academic Plans
CREATE POLICY "academic_plans_select_authenticated"
  ON public.academic_plans
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "academic_plans_write_admin"
  ON public.academic_plans
  FOR ALL
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Specializations
CREATE POLICY "specializations_select_authenticated"
  ON public.specializations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "specializations_write_admin"
  ON public.specializations
  FOR ALL
  TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());


-- ── 8. Table-level Grants ──────────────────────────────────────────
-- Same lesson learned in 004_grant_table_privileges.sql: RLS alone
-- is not enough, object-level GRANT is required first.
-- ─────────────────────────────────────────────────────────────────
GRANT SELECT                          ON public.departments     TO authenticated;
GRANT INSERT, UPDATE, DELETE          ON public.departments     TO authenticated;

GRANT SELECT                          ON public.academic_plans  TO authenticated;
GRANT INSERT, UPDATE, DELETE          ON public.academic_plans  TO authenticated;

GRANT SELECT                          ON public.specializations TO authenticated;
GRANT INSERT, UPDATE, DELETE          ON public.specializations TO authenticated;


-- ── 9. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS academic_plans_department_idx
  ON public.academic_plans (department_id);

CREATE INDEX IF NOT EXISTS specializations_plan_idx
  ON public.specializations (academic_plan_id);

CREATE INDEX IF NOT EXISTS profiles_academic_plan_idx
  ON public.profiles (academic_plan_id);

CREATE INDEX IF NOT EXISTS profiles_specialization_idx
  ON public.profiles (specialization_id);

CREATE INDEX IF NOT EXISTS courses_academic_plan_targeting_idx
  ON public.courses (academic_plan_id, specialization_id, year_number, is_active);


-- ── Done ─────────────────────────────────────────────────────────
--
-- EXAMPLE SEED DATA (Computer Science + Civil Engineering)
-- ─────────────────────────────────────────────────────────────────
--
-- INSERT INTO public.departments (name) VALUES
--   ('Computer Science'), ('Civil Engineering')
-- RETURNING id, name;
--
-- -- Computer Science: 2 shared years, then branches.
-- INSERT INTO public.academic_plans (department_id, name, shared_years)
-- SELECT id, 'Computer Science', 2 FROM public.departments
-- WHERE name = 'Computer Science'
-- RETURNING id;
--
-- INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
-- SELECT id, 'Software Engineering', 4 FROM public.academic_plans WHERE name = 'Computer Science';
-- INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
-- SELECT id, 'Information Systems', 4 FROM public.academic_plans WHERE name = 'Computer Science';
-- INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
-- SELECT id, 'Computer Networks', 3 FROM public.academic_plans WHERE name = 'Computer Science';
-- INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
-- SELECT id, 'Data Science', 4 FROM public.academic_plans WHERE name = 'Computer Science';
--
-- -- Civil Engineering: no branching at all. shared_years = full duration.
-- INSERT INTO public.academic_plans (department_id, name, shared_years)
-- SELECT id, 'Civil Engineering', 4 FROM public.departments
-- WHERE name = 'Civil Engineering';
-- -- (No rows inserted into specializations for this plan.)
--
-- WHAT THE TRIGGERS ENFORCE (summary)
-- ─────────────────────────────────────────────────────────────────
--   specializations.total_duration_years  >= parent plan.shared_years
--   courses:  year_number <= shared_years  -> specialization_id must be NULL
--             year_number >  shared_years  -> specialization_id required,
--                                              and must belong to the same plan,
--                                              and year_number <= its total_duration_years
--   profiles: specialization_id (if set) must belong to academic_plan_id,
--             and year_of_study <= specialization.total_duration_years
--             specialization_id may be NULL only while
--             year_of_study <= shared_years, OR the plan has zero
--             specializations (e.g. Civil Engineering, forever NULL)
--
-- NEXT STEPS (application layer, outside this SQL file)
-- ─────────────────────────────────────────────────────────────────
--   1. Seed departments / academic_plans / specializations for all
--      6 departments currently hardcoded in lib/academic-config.ts.
--   2. Update admin "Create Student" / "Create Course" forms to
--      populate academic_plan_id + specialization_id + year_number
--      (via dropdowns querying these new tables) alongside the
--      existing department/program TEXT fields.
--   3. Once every row has both legacy TEXT and new FK values filled
--      in, write migration 006 to drop courses.department,
--      courses.program, profiles.department, profiles.program, and
--      retire matches_academic_profile() /
--      profile_protected_fields_unchanged() in favor of ID-based
--      equivalents.
-- ─────────────────────────────────────────────────────────────────