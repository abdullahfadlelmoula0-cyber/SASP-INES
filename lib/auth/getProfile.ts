import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types";

export type GetProfileResult =
  | { status: "authenticated"; profile: UserProfile }
  | { status: "unauthenticated" }
  | { status: "missing_profile" }
  | { status: "error"; message: string };

/**
 * Server-side helper — fetches the authenticated user's profile.
 *
 * Call this from Server Components or Server Actions.
 * Never exposes the service_role key — uses the anon key + cookies.
 *
 * @returns A discriminated union describing the auth state.
 */
export async function getProfile(): Promise<GetProfileResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { status: "unauthenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // The user exists in auth.users but has no profile row.
      // This can happen if the trigger failed or the user was created
      // before the migration was run.
      return { status: "missing_profile" };
    }

    return { status: "authenticated", profile: profile as UserProfile };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { status: "error", message };
  }
}
