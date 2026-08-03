import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root page — immediately redirects based on auth state.
 * Authenticated  → /dashboard
 * Unauthenticated → /login
 *
 * If Supabase is not configured yet, falls back to /login.
 */
export default async function RootPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not configured yet — send to login page
  if (!supabaseUrl || !supabaseAnonKey) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
