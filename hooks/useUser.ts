"use client";

import { useEffect, useState } from "react";
import { type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/types";

// ── Auth State Types ──────────────────────────────────────────────

/**
 * Discriminated union of all possible client-side auth states.
 * Use this to drive loading spinners, error messages, and redirects.
 */
export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: User; profile: UserProfile }
  | { status: "missing_profile"; user: User }
  | { status: "error"; message: string };

// ── Legacy compat return (for existing components) ────────────────

interface UseUserReturn {
  /** Raw Supabase auth user */
  user: User | null;
  /** Extended profile from public.profiles */
  profile: UserProfile | null;
  /** True while the initial auth check is running */
  isLoading: boolean;
  /** Convenience: true when authenticated AND profile exists */
  isAuthenticated: boolean;
  /** Convenience: true when the user's role is 'admin' */
  isAdmin: boolean;
  /** Full discriminated auth state — prefer this for new code */
  authState: AuthState;
}

/**
 * Client-side hook — returns the current user's auth state and profile.
 *
 * - Safe to call from any Client Component inside the dashboard layout.
 * - Subscribes to auth state changes (handles sign-out, token refresh).
 * - Server-side route protection is handled separately by requireAuth()
 *   and requireAdmin() helpers (never rely on this hook for security).
 */
export function useUser(): UseUserReturn {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      try {
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !authUser) {
          setAuthState({ status: "unauthenticated" });
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          setAuthState({ status: "missing_profile", user: authUser });
          return;
        }

        setAuthState({
          status: "authenticated",
          user: authUser,
          profile: profile as UserProfile,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setAuthState({ status: "error", message });
      }
    }

    loadUser();

    // Subscribe to auth events (sign in, sign out, token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setAuthState({ status: "unauthenticated" });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Re-load the full profile on auth events
        loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Derive convenience values from the discriminated union
  const user =
    authState.status === "authenticated" ||
    authState.status === "missing_profile"
      ? authState.user
      : null;

  const profile =
    authState.status === "authenticated" ? authState.profile : null;

  return {
    user,
    profile,
    isLoading: authState.status === "loading",
    isAuthenticated: authState.status === "authenticated",
    isAdmin:
      authState.status === "authenticated" &&
      authState.profile.role === "admin",
    authState,
  };
}
