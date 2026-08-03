-- ============================================================
-- SASP-INES Migration 004 — Grant Table-Level Privileges
-- Run this in the Supabase SQL Editor.
--
-- ROOT CAUSE FIXED:
--   Migrations 001–003 created the tables and RLS policies correctly,
--   but never issued GRANT statements on the tables themselves.
--
--   PostgreSQL enforces two layers of access control:
--     Layer 1: Object-level GRANT/REVOKE   ← was missing → caused the error
--     Layer 2: Row Level Security (RLS)    ← already correct in 001/002
--
--   Without a GRANT on the table, PostgreSQL returns:
--     "permission denied for table profiles"
--   before RLS policies are even evaluated.
--
--   This migration adds the required GRANTs. It does NOT:
--     - Drop any table or data
--     - Change any RLS policy
--     - Change any function
--     - Alter any column or constraint
--
-- IDEMPOTENT: GRANT is idempotent in PostgreSQL — running it when the
-- privilege already exists is a silent no-op (no error, no data change).
-- ============================================================


-- ── public.profiles ──────────────────────────────────────────────
--
-- authenticated: full DML — required so that:
--   SELECT  → getProfile(), requireAuth(), requireAdmin(), LoginForm profile read
--   INSERT  → handle_new_user() trigger (runs as postgres/SECURITY DEFINER),
--             plus profiles_insert_admin policy for manual admin inserts
--   UPDATE  → profiles_update_student and profiles_update_admin RLS policies
--   DELETE  → covered by ON DELETE CASCADE from auth.users (postgres role);
--             no application-level delete needed, but grant is safe to include
--
-- anon: SELECT only — required for Supabase session bootstrap.
--   RLS ensures the anon role sees nothing (no SELECT policy exists for anon).
--   The grant alone does not expose data — RLS still filters all rows.
-- ─────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT                          ON public.profiles TO anon;


-- ── public.courses ────────────────────────────────────────────────
--
-- Same reasoning. The courses_select_student RLS policy restricts
-- which rows students see. The courses_select_admin policy opens all
-- rows to admins. Neither fires without this object-level GRANT.
-- ─────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT SELECT                          ON public.courses TO anon;


-- ── Verification queries (run manually after applying) ─────────────
--
-- 1. Confirm grants are in place:
--    SELECT grantee, table_name, privilege_type
--    FROM   information_schema.role_table_grants
--    WHERE  table_schema = 'public'
--      AND  table_name   IN ('profiles', 'courses')
--    ORDER BY table_name, grantee, privilege_type;
--
--    Expected output:
--      authenticated | profiles | DELETE
--      authenticated | profiles | INSERT
--      authenticated | profiles | SELECT
--      authenticated | profiles | UPDATE
--      anon          | profiles | SELECT
--      authenticated | courses  | DELETE
--      authenticated | courses  | INSERT
--      authenticated | courses  | SELECT
--      authenticated | courses  | UPDATE
--      anon          | courses  | SELECT
--
-- 2. Confirm RLS is still enabled:
--    SELECT tablename, rowsecurity
--    FROM   pg_tables
--    WHERE  schemaname = 'public'
--      AND  tablename  IN ('profiles', 'courses');
--
--    Expected: rowsecurity = true for both rows.
--
-- 3. Confirm all policies still exist:
--    SELECT policyname, tablename, cmd, roles
--    FROM   pg_policies
--    WHERE  schemaname = 'public'
--      AND  tablename  IN ('profiles', 'courses')
--    ORDER BY tablename, policyname;
-- ─────────────────────────────────────────────────────────────────
