-- ============================================================
-- SASP-INES Migration 014 — Grant Privileges to service_role
-- Run AFTER 013_drop_is_active_and_signup_rpc.sql.
--
-- ROOT CAUSE:
--   Migrations 004–013 granted SELECT/INSERT/UPDATE/DELETE to
--   `authenticated` and `anon` but not to `service_role`.
--
--   In most Supabase projects service_role bypasses RLS by default
--   but still requires object-level GRANT if the table owner did
--   not do a blanket "GRANT ALL ON SCHEMA public TO service_role".
--
--   Symptoms: 403 "permission denied for table X" when using the
--   service-role key via the REST API or the Supabase JS client
--   initialized with SUPABASE_SERVICE_ROLE_KEY.
--
-- IDEMPOTENT: safe to re-run.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_plans  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.specializations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams           TO service_role;

-- Also grant sequence privileges so service_role can do INSERTs
-- on tables that use sequences (e.g., auto-increment ids).
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Future tables: ensure service_role inherits grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO service_role;
