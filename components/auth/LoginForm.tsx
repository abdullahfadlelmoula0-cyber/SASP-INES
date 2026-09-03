"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SaspInesLogo } from "@/components/shared/SaspInesLogo";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/activity-log/actions";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

// Maps server-side error codes (passed as ?error=xxx) to user-friendly messages.
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  missing_profile:
    "Your account exists but your student profile is not set up yet. Please contact the administrator.",
  server_error:
    "A server error occurred. Please try again or contact the administrator.",
  session_expired:
    "Your session has expired. Please sign in again.",
};

/**
 * Login form component.
 *
 * Handles all authentication error states:
 * - Invalid credentials (Supabase error)
 * - Missing profile (redirected from requireAuth with ?error=missing_profile)
 * - Session expired (redirected from middleware with ?error=session_expired)
 * - Server errors (redirected with ?error=server_error)
 */
export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedServerError, setDisplayedServerError] = useState<string | null>(null);

  // On mount (client only, after hydration):
  // 1. Capture any ?error= param from URL so legitimate redirect errors are shown once.
  // 2. Immediately clear the ?error= param from the URL so re-navigations / refreshes
  //    always see a clean form with no stale red banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorKey = params.get("error");
    if (errorKey) {
      setDisplayedServerError(SERVER_ERROR_MESSAGES[errorKey] ?? null);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [router]);

  // The displayed alert is either the form submission error or the
  // server-side redirect message (captured once on mount above),
  // with form errors taking priority.
  // Server errors are cleared on any user interaction to keep the form clean.
  const displayedError = error ?? displayedServerError;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setDisplayedServerError(null);

    const trimmedEmail = email.trim().toLowerCase();

    // Guard: never submit the placeholder email to Supabase.
    const PLACEHOLDER_EMAIL = "ug0000000@ines.ac.rw";
    if (trimmedEmail === "" || trimmedEmail === PLACEHOLDER_EMAIL.toLowerCase()) {
      setError("Please enter your university email address.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (authError || !user) {
      if (
        authError?.message.toLowerCase().includes("invalid login credentials") ||
        authError?.message.toLowerCase().includes("invalid credentials")
      ) {
        setError(
          "Incorrect email or password. Please check your credentials and try again."
        );
      } else if (authError?.message.toLowerCase().includes("email not confirmed")) {
        setError(
          "Your email address has not been confirmed. Please contact the administrator."
        );
      } else {
        setError(authError?.message ?? "Sign-in failed. Please try again.");
      }
      setIsLoading(false);
      return;
    }

    // Read the profile to determine where to redirect.
    // The handle_new_user() DB trigger guarantees a profile row exists for
    // every auth user — we never insert from the client.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Log the real Supabase error for debugging, then surface it.
      console.error("[LoginForm] Profile read failed:", profileError);
      setError(
        profileError?.message
          ? `Could not load your profile: ${profileError.message}`
          : SERVER_ERROR_MESSAGES.missing_profile
      );
      setIsLoading(false);
      return;
    }

    // Log the sign-in event (non-student roles only, enforced inside
    // logAuthEvent itself) before redirecting, so the record is
    // guaranteed to be attempted even if the user navigates away
    // immediately after.
    await logAuthEvent({ userId: user.id, role: profile.role, event: "LOGIN" });

    // Role-based redirect: admins → /admin, students → /dashboard.
    if (profile.role === "admin") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-center mb-6 md:hidden">
          <SaspInesLogo className="w-56 h-auto drop-shadow-xl" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your student account to continue.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5" noValidate autoComplete="off">
        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            University email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="off"
            required
            placeholder="ug0000000@ines.ac.rw"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setDisplayedServerError(null);
            }}
            className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-colors"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="off"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setDisplayedServerError(null);
              }}
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-colors"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Error message */}
        {displayedError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{displayedError}</span>
          </div>
        )}

        {/* Submit */}
        <button
          id="login-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </a>
        </p>
        <p className="text-xs text-muted-foreground">
          Having trouble signing in? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
