"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { ActivityAction, ActivityLog, UserRole } from "@/types";

// ─────────────────────────────────────────────────────────────────
// Centralized activity/audit logger for admin, department_admin, and
// lecturer actions. Students are never logged — enforced by callers
// (they only call this from actions already gated by requireAdmin() /
// requireAdminOrDepartmentAdmin(), or after confirming role !== 'student'
// for the LOGIN/LOGOUT case), not by this function itself.
//
// SECURITY CONTRACT: `userId` and `role` MUST come from a
// server-verified profile — i.e. the value returned by requireAuth() /
// requireAdmin() / requireAdminOrDepartmentAdmin() (or the just-
// authenticated Supabase session, for LOGIN) inside the CALLING server
// action. NEVER pass a userId/role sourced from raw client/form input.
// This function does not re-verify them itself; it trusts its caller
// the same way createNotification() (lib/notifications/actions.ts) and
// every other internal helper in this codebase already does — auth is
// checked once, at the top of the public-facing server action, not
// re-derived at every internal layer.
//
// Writes go through the service-role client (createAdminClient()),
// which bypasses RLS entirely. The activity_logs table itself grants
// NO insert/update/delete policy to the `authenticated` role at all
// (see supabase/migrations/019_activity_logs.sql) — this is the ONLY
// write path that exists for this table, by design.
// ─────────────────────────────────────────────────────────────────

/**
 * Metadata keys matching this pattern are redacted before insert, as
 * defense-in-depth against ever accidentally persisting a secret —
 * even if a caller mistakenly includes one in `metadata`.
 */
const SENSITIVE_KEY_PATTERN =
  /pass(word)?|secret|token|api[-_]?key|credential|authorization/i;

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    clean[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : value;
  }
  return clean;
}

export interface LogActivityInput {
  /** MUST be sourced from a server-verified profile — see contract above. */
  userId: string;
  /** MUST be sourced from a server-verified profile — see contract above. */
  role: UserRole;
  action: ActivityAction;
  /** Short, human-readable summary shown directly in the Activity Logs UI. */
  description?: string;
  /** Only meaningful for department-scoped actions; omit otherwise. */
  departmentId?: string | null;
  /** Arbitrary extra context. Never put secrets here — see sanitizeMetadata(). */
  metadata?: Record<string, unknown>;
}

/**
 * Records one audit-log entry. Best-effort by design: any failure is
 * caught and logged to the server console only, and NEVER propagates
 * to the caller. A logging failure must never break the real action
 * (accepting a supervision request, creating a lecturer, signing in,
 * etc.) that triggered it.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const supabaseAdmin = createAdminClient();

    const { error } = await supabaseAdmin.from("activity_logs").insert({
      user_id: input.userId,
      role: input.role,
      action: input.action,
      description: input.description ?? null,
      department_id: input.departmentId ?? null,
      metadata: input.metadata ? sanitizeMetadata(input.metadata) : {},
    });

    if (error) {
      console.error("logActivity insert failed:", error.message);
    }
  } catch (err) {
    // Never let a logging failure (network blip, misconfigured env
    // var, etc.) take down the real operation that triggered it.
    console.error("logActivity failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Records a LOGIN or LOGOUT event. Wraps logActivity() with one
 * centralized rule: students are NEVER logged, enforced here once so
 * LoginForm.tsx and Sidebar.tsx don't each need to duplicate the check.
 *
 * `userId`/`role` MUST come from a server-verified profile (same
 * contract as logActivity() above) — for LOGIN this is the profile
 * row read immediately after a successful signInWithPassword(); for
 * LOGOUT it's the already-loaded profile from useUser().
 *
 * No extra try/catch here: logActivity() itself never throws (see its
 * own contract above), so there's nothing additional to guard against.
 */
export async function logAuthEvent(input: {
  userId: string;
  role: UserRole;
  event: "LOGIN" | "LOGOUT";
}): Promise<void> {
  if (input.role === "student") return;

  await logActivity({
    userId: input.userId,
    role: input.role,
    action: input.event,
    description: input.event === "LOGIN" ? "Signed in" : "Signed out",
  });
}

/**
 * Fetches audit-log rows for the Activity Logs admin page.
 *
 * RESTRICTED TO GENERAL ADMIN ONLY (requireAdmin()) — department_admin
 * and lecturer accounts are refused here, even though the underlying
 * RLS policies (activity_logs_select_dept_admin / activity_logs_select_own)
 * would otherwise let them see a scoped subset. This function is the
 * only caller of this table today, so gating it here is sufficient to
 * make "general admin only" the actual, enforced behavior of the
 * Activity Logs feature — not just the UI's behavior.
 *
 * Uses the NORMAL (RLS-respecting) server client, not the service-role
 * client — activity_logs_select_admin still applies on top of this
 * app-layer check, so a bug here could never widen access beyond RLS.
 * Role/action/date filters are applied in SQL; free-text search (by
 * actor name/email or description) is applied after the join since it
 * spans a joined column and the filtered result set is always small
 * (capped at 200 rows) — not worth a second round trip.
 */
export async function getActivityLogs(filters?: {
  role?: UserRole;
  action?: ActivityAction;
  dateFrom?: string; // ISO date, inclusive
  dateTo?: string; // ISO date, inclusive
}): Promise<{ data: ActivityLog[]; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let query = supabase
      .from("activity_logs")
      .select(`*, user:user_id(full_name, university_email), department:department_id(name)`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (filters?.role) query = query.eq("role", filters.role);
    if (filters?.action) query = query.eq("action", filters.action);
    if (filters?.dateFrom) query = query.gte("created_at", filters.dateFrom);
    if (filters?.dateTo) query = query.lte("created_at", filters.dateTo);

    const { data, error } = await query;

    if (error) return { data: [], error: error.message };
    return { data: (data as ActivityLog[]) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load activity logs." };
  }
}
