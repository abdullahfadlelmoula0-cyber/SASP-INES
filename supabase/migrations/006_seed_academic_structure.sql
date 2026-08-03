-- ============================================================
-- SASP-INES Migration 006 — Legacy Defaults Fix + Real Seed Data
-- Run this AFTER 005_academic_structure.sql.
--
-- PART A: Fixes courses.department / courses.program being NOT NULL
--         with no DEFAULT, which blocked inserting courses that rely
--         purely on the new academic_plan_id structure.
--
-- PART B: Seeds departments / academic_plans / specializations for
--         all 6 departments currently hardcoded in
--         lib/academic-config.ts.
--
-- DESIGN RULE APPLIED (confirmed by product owner):
--   Every multi-programme department follows the Computer Science
--   pattern: a 3-year shared trunk, branching into specializations
--   ONLY in the final year. A department's shorter programme
--   (e.g. Computer Networks, Marketing, Development Economics,
--   Sociology) has total_duration_years == shared_years (3), so it
--   never gets a dedicated specialization-year course — those
--   students simply graduate at the end of the shared trunk.
--   Law has a single programme, so it is modeled as unbranched
--   (shared_years = 4, zero specialization rows) — same pattern as
--   Civil Engineering in our earlier design discussion.
-- ============================================================


-- ── PART A: Fix courses legacy TEXT columns ───────────────────────
ALTER TABLE public.courses
  ALTER COLUMN department SET DEFAULT '',
  ALTER COLUMN program    SET DEFAULT '';

COMMENT ON COLUMN public.courses.department IS
  'DEPRECATED — legacy free-text targeting, superseded by '
  'academic_plan_id. Kept NOT NULL with DEFAULT '''' so new courses '
  'built purely on the normalized structure can still be inserted. '
  'Will be dropped once the application fully migrates (see 005 '
  'migration notes).';

COMMENT ON COLUMN public.courses.program IS
  'DEPRECATED — legacy free-text targeting, superseded by '
  'specialization_id. Kept NOT NULL with DEFAULT '''' for the same '
  'reason as courses.department.';


-- ── PART B.1: Departments ──────────────────────────────────────────
INSERT INTO public.departments (name) VALUES
  ('Computer Science'),
  ('Business Administration'),
  ('Economics'),
  ('Education'),
  ('Law'),
  ('Social Sciences')
ON CONFLICT (name) DO NOTHING;


-- ── PART B.2: Academic Plans (one per department) ──────────────────
-- shared_years = 3 for every branching department (specialization
-- only in the final year of a 4-year track). Law = 4, unbranched.
INSERT INTO public.academic_plans (department_id, name, shared_years)
SELECT id, 'Computer Science', 3
FROM public.departments WHERE name = 'Computer Science'
ON CONFLICT (department_id, name) DO NOTHING;

INSERT INTO public.academic_plans (department_id, name, shared_years)
SELECT id, 'Business Administration', 3
FROM public.departments WHERE name = 'Business Administration'
ON CONFLICT (department_id, name) DO NOTHING;

INSERT INTO public.academic_plans (department_id, name, shared_years)
SELECT id, 'Economics', 3
FROM public.departments WHERE name = 'Economics'
ON CONFLICT (department_id, name) DO NOTHING;

INSERT INTO public.academic_plans (department_id, name, shared_years)
SELECT id, 'Education', 3
FROM public.departments WHERE name = 'Education'
ON CONFLICT (department_id, name) DO NOTHING;

INSERT INTO public.academic_plans (department_id, name, shared_years)
SELECT id, 'Law', 4
FROM public.departments WHERE name = 'Law'
ON CONFLICT (department_id, name) DO NOTHING;

INSERT INTO public.academic_plans (department_id, name, shared_years)
SELECT id, 'Social Sciences', 3
FROM public.departments WHERE name = 'Social Sciences'
ON CONFLICT (department_id, name) DO NOTHING;


-- ── PART B.3: Specializations ───────────────────────────────────────
-- Law has NO rows here — single unbranched programme (see design note).

-- Computer Science
INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Software Engineering', 4 FROM public.academic_plans
WHERE name = 'Computer Science'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Information Systems', 4 FROM public.academic_plans
WHERE name = 'Computer Science'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Computer Networks', 3 FROM public.academic_plans
WHERE name = 'Computer Science'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Data Science', 4 FROM public.academic_plans
WHERE name = 'Computer Science'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

-- Business Administration
INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Management', 4 FROM public.academic_plans
WHERE name = 'Business Administration'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Finance and Banking', 4 FROM public.academic_plans
WHERE name = 'Business Administration'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Marketing', 3 FROM public.academic_plans
WHERE name = 'Business Administration'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Accounting', 4 FROM public.academic_plans
WHERE name = 'Business Administration'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

-- Economics
INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Applied Economics', 4 FROM public.academic_plans
WHERE name = 'Economics'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Development Economics', 3 FROM public.academic_plans
WHERE name = 'Economics'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

-- Education
INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Education Sciences', 4 FROM public.academic_plans
WHERE name = 'Education'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Mathematics Education', 4 FROM public.academic_plans
WHERE name = 'Education'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

-- Social Sciences
INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Sociology', 3 FROM public.academic_plans
WHERE name = 'Social Sciences'
ON CONFLICT (academic_plan_id, name) DO NOTHING;

INSERT INTO public.specializations (academic_plan_id, name, total_duration_years)
SELECT id, 'Political Science', 4 FROM public.academic_plans
WHERE name = 'Social Sciences'
ON CONFLICT (academic_plan_id, name) DO NOTHING;


-- ── Done — Verification query ───────────────────────────────────────
--
-- SELECT
--   d.name  AS department,
--   ap.name AS plan,
--   ap.shared_years,
--   s.name  AS specialization,
--   s.total_duration_years
-- FROM public.departments d
-- JOIN public.academic_plans ap  ON ap.department_id = d.id
-- LEFT JOIN public.specializations s ON s.academic_plan_id = ap.id
-- ORDER BY d.name, s.name;
--
-- Expected: 6 departments, 6 plans, 14 specialization rows total
-- (4 CS + 4 Business + 2 Economics + 2 Education + 2 Social Sciences
-- + 0 Law).
-- ─────────────────────────────────────────────────────────────────
