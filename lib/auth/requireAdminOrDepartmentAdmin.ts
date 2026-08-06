import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/requireAuth";
import type { UserProfile } from "@/types";

/**
 * Server-side guard — requires either a full admin OR a department_admin.
 *
 * ONLY use this for the announcements page and its server actions.
 * Every other admin surface must keep using requireAdmin() (admin-only) —
 * department_admin accounts are scoped exclusively to managing
 * announcements for their own department, enforced end-to-end by the
 * can_manage_announcement() RLS helper in the database.
 *
 * - Unauthenticated users → redirected to /login.
 * - Students → redirected to /dashboard (forbidden).
 * - Admin / department_admin → profile is returned so the component can use it.
 */
export async function requireAdminOrDepartmentAdmin(): Promise<UserProfile> {
  const profile = await requireAuth();

  if (profile.role !== "admin" && profile.role !== "department_admin") {
    redirect("/dashboard");
  }

  return profile;
}
