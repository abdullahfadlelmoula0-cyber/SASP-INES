import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/getProfile";
import type { UserProfile } from "@/types";

/**
 * Server-side guard — requires an authenticated user with a valid profile.
 *
 * Use at the top of any protected Server Component or layout.
 * Redirects to /login for any unauthenticated or error state.
 *
 * @returns The authenticated user's profile (never null).
 */
export async function requireAuth(): Promise<UserProfile> {
  const result = await getProfile();

  switch (result.status) {
    case "authenticated":
      return result.profile;

    case "unauthenticated":
      redirect("/login");

    case "missing_profile":
      // User exists in auth but has no profile row.
      // Redirect to login with an informative query param so the
      // login page can show a helpful message.
      redirect("/login?error=missing_profile");

    case "error":
      // Treat unexpected errors as unauthenticated for safety.
      redirect("/login?error=server_error");
  }
}
