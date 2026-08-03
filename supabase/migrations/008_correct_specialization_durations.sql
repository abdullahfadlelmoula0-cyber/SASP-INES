-- ============================================================
-- SASP-INES Migration 008 — Correct Specialization Durations
-- Run this AFTER 007_student_year_promotion.sql.
--
-- WHAT CHANGED (business decision, not a schema change):
--   Every specialization within a given department now graduates
--   in the SAME number of years — no more mixed durations like
--   "Computer Networks = 3yr while Software Engineering = 4yr"
--   within the same department. Duration now varies BY DEPARTMENT,
--   not by track within a department.
--
--   Computer Science total duration corrected: 4 → 3 years for
--   EVERY track (Software Engineering, Information Systems,
--   Computer Networks, Data Science). Specialization still happens
--   only in the final year, so shared_years drops from 3 to 2.
--
--   Business Administration / Economics / Education / Social
--   Sciences: all specializations standardized to 4 years total.
--   shared_years stays at 3 (specialization still only in year 4).
--
--   Law: unchanged (single unbranched programme, 4 years, no
--   specializations).
--
-- ORDER OF OPERATIONS MATTERS:
--   1. Lower academic_plans.shared_years FIRST.
--   2. Then update specializations.total_duration_years.
--   This order guarantees the validate_specialization_duration_trg
--   (005) never sees a momentarily-invalid state, since every new
--   total_duration_years value is checked against the ALREADY-
--   updated (lower) shared_years — and every new value here is
--   still >= its plan's new shared_years.
-- ============================================================


-- ── 1. Update shared_years (Computer Science only changes) ───────
UPDATE public.academic_plans
SET    shared_years = 2
WHERE  name = 'Computer Science';

-- Business Administration / Economics / Education / Social Sciences
-- already have shared_years = 3 from 006 — no change needed, but
-- this UPDATE is harmless and idempotent if run again.
UPDATE public.academic_plans
SET    shared_years = 3
WHERE  name IN ('Business Administration', 'Economics', 'Education', 'Social Sciences');


-- ── 2. Standardize specialization durations per department ───────

-- Computer Science: ALL tracks now graduate in 3 years.
UPDATE public.specializations s
SET    total_duration_years = 3
FROM   public.academic_plans ap
WHERE  s.academic_plan_id = ap.id
  AND  ap.name = 'Computer Science';

-- Business Administration: ALL tracks now graduate in 4 years.
UPDATE public.specializations s
SET    total_duration_years = 4
FROM   public.academic_plans ap
WHERE  s.academic_plan_id = ap.id
  AND  ap.name = 'Business Administration';

-- Economics: ALL tracks now graduate in 4 years.
UPDATE public.specializations s
SET    total_duration_years = 4
FROM   public.academic_plans ap
WHERE  s.academic_plan_id = ap.id
  AND  ap.name = 'Economics';

-- Education: already 4/4 — included for completeness/idempotency.
UPDATE public.specializations s
SET    total_duration_years = 4
FROM   public.academic_plans ap
WHERE  s.academic_plan_id = ap.id
  AND  ap.name = 'Education';

-- Social Sciences: ALL tracks now graduate in 4 years.
UPDATE public.specializations s
SET    total_duration_years = 4
FROM   public.academic_plans ap
WHERE  s.academic_plan_id = ap.id
  AND  ap.name = 'Social Sciences';


-- ── Verification query — run after applying ───────────────────────
--
-- SELECT
--   d.name  AS department,
--   ap.shared_years,
--   s.name  AS specialization,
--   s.total_duration_years
-- FROM public.departments d
-- JOIN public.academic_plans ap  ON ap.department_id = d.id
-- LEFT JOIN public.specializations s ON s.academic_plan_id = ap.id
-- ORDER BY d.name, s.name;
--
-- Expected:
--   Computer Science         | shared_years=2 | all 4 tracks = 3
--   Business Administration  | shared_years=3 | all 4 tracks = 4
--   Economics                | shared_years=3 | both tracks  = 4
--   Education                | shared_years=3 | both tracks  = 4
--   Social Sciences          | shared_years=3 | both tracks  = 4
--   Law                      | shared_years=4 | no rows (NULL)
-- ─────────────────────────────────────────────────────────────────
