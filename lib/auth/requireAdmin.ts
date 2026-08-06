import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/requireAuth";
import type { UserProfile } from "@/types";

/**
 * Server-side guard — requires a full (general) admin. department_admin
 * accounts are intentionally NOT allowed through here — they only have
 * access to the announcements page/actions via
 * requireAdminOrDepartmentAdmin(). Every other admin surface (courses,
 * students, academic structure, settings) stays admin-only.
 *
 * - Unauthenticated users → redirected to /login.
 * - Students / department_admin → redirected to /dashboard (forbidden).
 * - Admin → profile is returned so the component can use it.
 */
export async function requireAdmin(): Promise<UserProfile> {
  // requireAuth handles the unauthenticated redirect
  const profile = await requireAuth();

  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return profile;
}