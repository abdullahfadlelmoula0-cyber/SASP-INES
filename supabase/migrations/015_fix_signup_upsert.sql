-- ============================================================
-- SASP-INES Migration 015 — Fix create_student_profile UPSERT
-- Run AFTER 013_drop_is_active_and_signup_rpc.sql.
--
-- ROOT CAUSE FIXED:
--   The handle_new_user() trigger fires synchronously when
--   supabase.auth.signUp() is called, inserting a bare profile
--   row (id, university_email, full_name only).
--
--   The previous create_student_profile() guarded with:
--     IF EXISTS (profile) THEN RAISE EXCEPTION 'already exists'
--   which meant the RPC ALWAYS failed — the trigger had already
--   created the row by the time the client called the RPC.
--
--   Result: every student landed with NULL academic fields,
--   and the profile page showed defaults ("Computer Science", Year 1).
--
--   FIX:
--   Replace the INSERT + guard with INSERT ... ON CONFLICT DO UPDATE
--   so the RPC merges the full academic profile (chosen in the
--   sign-up form) into the bare row the trigger created.
--
-- IDEMPOTENT: safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_student_profile(
  p_full_name         text,
  p_university_email  text,
  p_academic_plan_id  uuid,
  p_specialization_id uuid,   -- nullable
  p_year_of_study     smallint,
  p_academic_year     text,
  p_department_name   text,   -- display-only label, derived from plan
  p_program_name      text    -- display-only label, derived from plan/spec
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

  -- UPSERT: the handle_new_user trigger fires on auth.signUp() and inserts
  -- a bare profile row (id, email, full_name only).  By the time the client
  -- calls this RPC the row already exists, so we UPDATE it with the full
  -- academic profile the student chose in the sign-up form.
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
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name         = EXCLUDED.full_name,
    university_email  = EXCLUDED.university_email,
    role              = 'student',           -- always enforce student role
    academic_plan_id  = EXCLUDED.academic_plan_id,
    specialization_id = EXCLUDED.specialization_id,
    year_of_study     = EXCLUDED.year_of_study,
    academic_year     = EXCLUDED.academic_year,
    department        = EXCLUDED.department,
    program           = EXCLUDED.program,
    updated_at        = now();
END;
$$;

-- Re-grant execute (idempotent)
GRANT EXECUTE ON FUNCTION public.create_student_profile(
  text, text, uuid, uuid, smallint, text, text, text
) TO anon, authenticated;
