-- Activity Logs (audit log) for admin / department_admin / lecturer
-- actions. Students are deliberately excluded from this system.
--
-- Applied live via Supabase MCP on this date; this file mirrors that
-- migration exactly so the local repo stays in sync with the database.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  role public.user_role NOT NULL,
  action text NOT NULL,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_user_created_idx
  ON public.activity_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_logs_department_created_idx
  ON public.activity_logs (department_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: general admin sees every log.
CREATE POLICY activity_logs_select_admin ON public.activity_logs
  FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- SELECT: department_admin sees logs scoped to their managed department.
-- Reuses the existing can_manage_department() helper (already used by
-- can_manage_plan/can_manage_course) — no new SQL function needed.
CREATE POLICY activity_logs_select_dept_admin ON public.activity_logs
  FOR SELECT
  USING (department_id IS NOT NULL AND public.can_manage_department(department_id));

-- SELECT: any actor (lecturer, etc.) sees only their own logs.
CREATE POLICY activity_logs_select_own ON public.activity_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Deliberately NO INSERT/UPDATE/DELETE policy for the `authenticated`
-- role. All writes happen exclusively through the service-role client
-- (createAdminClient()) inside server actions, which bypasses RLS
-- entirely. Because no policy grants authenticated/anon write access
-- at all, a forged direct client call (even with a valid session)
-- cannot insert, edit, or delete a log row under any circumstance.
