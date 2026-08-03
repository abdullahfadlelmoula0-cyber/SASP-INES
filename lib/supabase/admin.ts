// Save as: lib/supabase/admin.ts
//
// SECURITY: this client uses the SERVICE ROLE key, which bypasses
// Row Level Security entirely. NEVER import this file into any
// Client Component or expose SUPABASE_SERVICE_ROLE_KEY to the
// browser. Only use it inside "use server" Server Actions / Route
// Handlers, and only after a requireAdmin() check has already run.
//
// Required env var (add to .env.local — get it from Supabase
// Dashboard → Project Settings → API → service_role secret):
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
//
// This is DIFFERENT from NEXT_PUBLIC_SUPABASE_ANON_KEY. Never prefix
// this one with NEXT_PUBLIC_ — that would ship it to the browser.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars — " +
        "required for admin-only operations like creating auth users."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}