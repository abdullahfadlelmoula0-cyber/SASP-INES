-- ================================================================
-- Migration 018: Department Admin Access Control
-- ================================================================
-- Adds helper functions and RLS policies for hierarchical admin:
-- - admin (General Admin): Full access to everything
-- - department_admin: Limited to their assigned department
-- ================================================================

-- ── 1. Create helper functions ─────────────────────────────────

-- is_admin(): true only for general admins
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- is_department_admin(): true for department admins with a managed department
CREATE OR REPLACE FUNCTION public.is_department_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'department_admin'
    AND managed_department_id IS NOT NULL
  );
$$;

-- get_managed_department_id(): returns the department the current dept_admin manages
CREATE OR REPLACE FUNCTION public.get_managed_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT managed_department_id
  FROM public.profiles
  WHERE id = auth.uid()
  AND role = 'department_admin';
$$;

-- can_manage_student(): checks if actor can manage a specific student
CREATE OR REPLACE FUNCTION public.can_manage_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_admin()
    OR
    (
      public.is_department_admin()
      AND EXISTS (
        SELECT 1 FROM public.profiles student
        WHERE student.id = p_student_id
        AND EXISTS (
          SELECT 1 FROM public.academic_plans plan
          WHERE plan.id = student.academic_plan_id
          AND plan.department_id = public.get_managed_department_id()
        )
      )
    );
$$;

-- can_manage_course(): checks if actor can manage courses for a given plan
CREATE OR REPLACE FUNCTION public.can_manage_course(p_academic_plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_admin()
    OR
    (
      public.is_department_admin()
      AND EXISTS (
        SELECT 1 FROM public.academic_plans plan
        WHERE plan.id = p_academic_plan_id
        AND plan.department_id = public.get_managed_department_id()
      )
    );
$$;


-- ── 2. Update profiles RLS policies ────────────────────────────

-- Drop all existing profiles policies first (idempotent)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_department_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_student" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_department_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_department_admin" ON public.profiles;

-- Students can see their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- General admins can see all profiles
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Department admins can see students in their department
CREATE POLICY "profiles_select_department_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.is_department_admin()
    AND role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.academic_plans plan
      WHERE plan.id = profiles.academic_plan_id
      AND plan.department_id = public.get_managed_department_id()
    )
  );

-- Students can update their own name/avatar
CREATE POLICY "profiles_update_student"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND role = 'student')
  WITH CHECK (id = auth.uid() AND role = 'student');

-- General admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Department admins can update students in their department (no role changes)
CREATE POLICY "profiles_update_department_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    public.is_department_admin()
    AND role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.academic_plans plan
      WHERE plan.id = profiles.academic_plan_id
      AND plan.department_id = public.get_managed_department_id()
    )
  )
  WITH CHECK (
    public.is_department_admin()
    AND role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.academic_plans plan
      WHERE plan.id = profiles.academic_plan_id
      AND plan.department_id = public.get_managed_department_id()
    )
  );

-- General admins can insert profiles
CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Department admins can insert students in their department
CREATE POLICY "profiles_insert_department_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_department_admin()
    AND role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.academic_plans plan
      WHERE plan.id = profiles.academic_plan_id
      AND plan.department_id = public.get_managed_department_id()
    )
  );


-- ── 3. Grant permissions ───────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;


-- ================================================================
-- VERIFICATION
-- ================================================================
-- Test: SELECT public.is_admin();
-- Test: SELECT public.is_department_admin();
-- Test: SELECT public.get_managed_department_id();
--
-- Check policies: SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename='profiles';
-- ================================================================
