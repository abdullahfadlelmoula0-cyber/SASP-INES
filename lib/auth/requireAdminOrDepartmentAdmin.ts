import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/requireAuth";
import type { UserProfile } from "@/types";

/**
 * Server-side guard — requires a full admin (general admin) OR a
 * department_admin who manages a department.
 *
 * department_admin accounts are scoped to their assigned department
 * (managed_department_id). All student/course/document mutations must
 * enforce this scope at the application layer AND rely on the
 * can_manage_student() / can_manage_course() RLS helpers.
 *
 * - Unauthenticated users → redirected to /login.
 * - Students → redirected to /dashboard (forbidden).
 * - Admin / department_admin → profile is returned.
 */
export async function requireAdminOrDepartmentAdmin(): Promise<UserProfile> {
  const profile = await requireAuth();

  if (profile.role !== "admin" && profile.role !== "department_admin") {
    redirect("/dashboard");
  }

  return profile;
}
