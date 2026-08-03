-- ============================================================
-- SASP-INES Migration 007 — Student Self-Service Year Promotion
-- Run this AFTER 005_academic_structure.sql and 006_seed_academic_structure.sql.
--
-- PURPOSE:
--   Students cannot UPDATE year_of_study directly — it is a
--   protected field enforced by profiles_update_student's WITH CHECK
--   (via profile_protected_fields_unchanged(), 001/003). This
--   migration adds ONE narrow, safe door through that wall: a
--   SECURITY DEFINER RPC function that increments year_of_study by
--   EXACTLY 1, and only when the move is valid.
--
-- WHY THIS IS SAFE:
--   - Callable only by `authenticated` (not anon).
--   - Only ever touches auth.uid()'s OWN row — no student can
--     promote another student.
--   - Only ever increments by +1 — never decrements, never jumps.
--     This is what "cannot go back except by admin" means in
--     practice: no self-service path to decrease year_of_study
--     exists. Only profiles_update_admin (existing policy) can lower
--     it, exactly as requested.
--   - Re-validated by validate_student_specialization_trg (005) on
--     the UPDATE — this function does NOT bypass that trigger, it
--     relies on it as a second line of defense.
--
-- FLOW:
--   1. Student is within the shared trunk (year_of_study < shared_years,
--      or the plan has zero specializations)
--        → promote with p_specialization_id = NULL.
--   2. Student is exactly at shared_years AND the plan HAS
--      specializations (the branching point)
--        → must call with p_specialization_id set, or the function
--          raises 'SPECIALIZATION_REQUIRED: ...' so the frontend can
--          show a track picker and retry.
--   3. Student is already at their final year (year_of_study equals
--      their specialization's total_duration_years, or the plan's
--      shared_years when it has no specializations)
--        → raises 'FINAL_YEAR: ...' — promotion is not applicable;
--          graduation/rollover is an admin action, not self-service.
-- ============================================================


CREATE OR REPLACE FUNCTION public.promote_student_academic_year(
  p_specialization_id uuid DEFAULT NULL
)
RETURNS TABLE (
  new_year_of_study smallint,
  specialization_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile           RECORD;
  v_shared_years       SMALLINT;
  v_has_specializations BOOLEAN;
  v_current_max        SMALLINT;
  v_spec_plan_id        UUID;
  v_spec_duration       SMALLINT;
BEGIN
  -- Lock the caller's own row to prevent concurrent double-promotion.
  SELECT id, academic_plan_id, specialization_id, year_of_study
  INTO   v_profile
  FROM   public.profiles
  WHERE  id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: no profile for the current session';
  END IF;

  IF v_profile.academic_plan_id IS NULL THEN
    RAISE EXCEPTION 'NO_PLAN_ASSIGNED: your academic plan has not been set by an admin yet';
  END IF;

  SELECT shared_years INTO v_shared_years
  FROM public.academic_plans
  WHERE id = v_profile.academic_plan_id;

  SELECT EXISTS (
    SELECT 1 FROM public.specializations
    WHERE academic_plan_id = v_profile.academic_plan_id
  ) INTO v_has_specializations;

  -- ── Case 1: student already has a specialization ──────────────
  IF v_profile.specialization_id IS NOT NULL THEN
    SELECT academic_plan_id, total_duration_years
    INTO   v_spec_plan_id, v_spec_duration
    FROM   public.specializations
    WHERE  id = v_profile.specialization_id;

    v_current_max := v_spec_duration;

    IF v_profile.year_of_study >= v_current_max THEN
      RAISE EXCEPTION
        'FINAL_YEAR: you are already in your final year (%). Graduation must be recorded by an admin.',
        v_current_max;
    END IF;

    UPDATE public.profiles
    SET    year_of_study = v_profile.year_of_study + 1
    WHERE  id = v_profile.id;

  -- ── Case 2: no specialization yet, plan has NONE at all ────────
  ELSIF NOT v_has_specializations THEN
    v_current_max := v_shared_years;

    IF v_profile.year_of_study >= v_current_max THEN
      RAISE EXCEPTION
        'FINAL_YEAR: you are already in your final year (%). Graduation must be recorded by an admin.',
        v_current_max;
    END IF;

    UPDATE public.profiles
    SET    year_of_study = v_profile.year_of_study + 1
    WHERE  id = v_profile.id;

  -- ── Case 3: no specialization yet, plan HAS specializations ────
  ELSE
    IF v_profile.year_of_study < v_shared_years THEN
      -- Still within the shared trunk — plain promotion, no track needed yet.
      UPDATE public.profiles
      SET    year_of_study = v_profile.year_of_study + 1
      WHERE  id = v_profile.id;

    ELSIF v_profile.year_of_study = v_shared_years THEN
      -- This IS the branching point — a track must be chosen now.
      IF p_specialization_id IS NULL THEN
        RAISE EXCEPTION
          'SPECIALIZATION_REQUIRED: choose a specialization to continue past year %',
          v_shared_years;
      END IF;

      SELECT academic_plan_id, total_duration_years
      INTO   v_spec_plan_id, v_spec_duration
      FROM   public.specializations
      WHERE  id = p_specialization_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_SPECIALIZATION: specialization does not exist';
      END IF;

      IF v_spec_plan_id != v_profile.academic_plan_id THEN
        RAISE EXCEPTION 'INVALID_SPECIALIZATION: does not belong to your academic plan';
      END IF;

      UPDATE public.profiles
      SET    year_of_study    = v_profile.year_of_study + 1,
             specialization_id = p_specialization_id
      WHERE  id = v_profile.id;

    ELSE
      -- Defensive only: validate_student_specialization_trg (005)
      -- should make this state unreachable (year_of_study > shared_years
      -- with no specialization, on a plan that has specializations).
      RAISE EXCEPTION
        'INCONSISTENT_STATE: year_of_study (%) is past the shared trunk (%) with no specialization on record — contact an admin.',
        v_profile.year_of_study, v_shared_years;
    END IF;
  END IF;

  RETURN QUERY
    SELECT p.year_of_study, p.specialization_id
    FROM   public.profiles p
    WHERE  p.id = v_profile.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_student_academic_year(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_student_academic_year(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.promote_student_academic_year(uuid) TO authenticated;

COMMENT ON FUNCTION public.promote_student_academic_year IS
  'Self-service promotion: increments the caller''s own year_of_study '
  'by exactly 1, enforcing the plan''s shared_years / specialization '
  'duration rules. Requires p_specialization_id when the caller is '
  'exactly at the branching year and the plan has specializations. '
  'Raises FINAL_YEAR when no further promotion is possible (admin-only '
  'from there). SECURITY DEFINER — bypasses the profiles UPDATE RLS '
  'restriction narrowly, only for this one safe operation.';


-- ============================================================
-- HOW TO CALL FROM THE FRONTEND (Supabase JS client)
-- ============================================================
--
-- Plain promotion (student not at a branching point):
--
--   const { data, error } = await supabase.rpc('promote_student_academic_year');
--
-- Promotion AT the branching point (student chose a track in the UI):
--
--   const { data, error } = await supabase.rpc('promote_student_academic_year', {
--     p_specialization_id: selectedTrackId
--   });
--
-- ERROR HANDLING PATTERN (error.message starts with a code prefix):
--
--   if (error) {
--     if (error.message.startsWith('SPECIALIZATION_REQUIRED')) {
--       // show the track picker, then retry the call with p_specialization_id
--     } else if (error.message.startsWith('FINAL_YEAR')) {
--       // show "you're in your final year — contact your admin to graduate"
--     } else {
--       // generic error toast
--     }
--   }
-- ============================================================


-- ============================================================
-- QUICK MANUAL TEST (run in SQL Editor, replace the email)
-- ============================================================
-- Because this function reads auth.uid(), it can only be tested
-- meaningfully through the actual app (logged-in student session) or
-- via `select set_config('request.jwt.claims', ...)` tricks in the
-- SQL editor. The simplest manual check from the SQL Editor is to
-- temporarily impersonate by running as a specific role — for a
-- pragmatic first test, just try it from your Next.js app once a
-- test student has academic_plan_id / specialization_id set via the
-- 006 seed data and the admin students page.
-- ============================================================
