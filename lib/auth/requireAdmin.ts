import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/requireAuth";
import type { UserProfile } from "@/types";

/**
 * Server-side guard — requires an authenticated admin user.
 *
 * Use at the top of any admin-only Server Component or layout.
 * - Unauthenticated users → redirected to /login.
 * - Authenticated non-admins → redirected to /dashboard (forbidden).
 * - Admins → profile is returned so the component can use it.
 *
 * IMPORTANT: This check is done server-side using the user's profile
 * role from the database. It does NOT rely on client-side state or
 * hidden UI elements. Hiding links is a UX improvement only.
 *
 * @returns The authenticated admin's profile (never null).
 */
export async function requireAdmin(): Promise<UserProfile> {
  // requireAuth handles the unauthenticated redirect
  const profile = await requireAuth();

  if (profile.role !== "admin") {
    // Authenticated but not an admin — send to dashboard (not login)
    redirect("/dashboard");
  }

  return profile;
}
