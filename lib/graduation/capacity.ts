// ────────────────────────────────────────────────────────────────
// Supervisor Capacity Management — shared helpers.
//
// NOT a "use server" file — these are plain functions that take an
// already-created Supabase client, used internally by
// lib/graduation/actions.ts. This keeps a single server-action
// surface (actions.ts) consistent with the rest of the codebase.
//
// Single source of truth for "current load": current_students always
// counts ONLY status='active' graduation_projects (a pending request
// never occupies a slot; a future 'completed' status will naturally
// free one, since it's excluded here too). Backed by the
// get_department_supervisor_capacity() DB function for the
// department-wide case, and a direct count for the single-supervisor
// case (used by the request-send soft check).
// ────────────────────────────────────────────────────────────────

import type { createClient } from "@/lib/supabase/server";
import type { SupervisorCapacity } from "@/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Capacity snapshot for every lecturer in a department, keyed by
 * supervisor_id. Best-effort: returns an empty map on failure so a
 * transient error here never blocks the (unrelated) matching call —
 * an empty map simply means "no one gets excluded for capacity",
 * which is the safe default, not a silent overbook.
 */
export async function getDepartmentCapacityMap(
  supabase: SupabaseServerClient,
  departmentId: string
): Promise<Map<string, SupervisorCapacity>> {
  const map = new Map<string, SupervisorCapacity>();

  const { data, error } = await supabase.rpc("get_department_supervisor_capacity", {
    p_department_id: departmentId,
  });

  if (error || !data) {
    if (error) console.error("get_department_supervisor_capacity failed:", error.message);
    return map;
  }

  for (const row of data as any[]) {
    map.set(row.supervisor_id, {
      max_capacity: row.max_capacity,
      current_students: row.current_students,
      available_slots: row.available_slots,
    });
  }

  return map;
}

/**
 * IDs of lecturers who are at/over capacity (available_slots <= 0).
 * Passed as find_top_supervisors()'s p_exclude_ids so full lecturers
 * are removed from the candidate pool BEFORE its internal LIMIT 3 —
 * guaranteeing the Top-3 the student sees are all available, without
 * touching the matching function's scoring/ordering at all.
 */
export function fullLecturerIds(capacityMap: Map<string, SupervisorCapacity>): string[] {
  const ids: string[] = [];
  capacityMap.forEach((capacity, id) => {
    if (capacity.available_slots <= 0) ids.push(id);
  });
  return ids;
}

/**
 * Live capacity for exactly one lecturer — used as the soft,
 * request-send-time check in chooseSupervisor()/chooseDifferentSupervisor(),
 * so a student never even sends a request to someone already known to
 * be full. This is a convenience/early-error layer only; the actual
 * hard guarantee against overbooking is the enforce_supervisor_capacity()
 * DB trigger, which re-checks atomically at accept time regardless of
 * what this function returns.
 *
 * Calls the get_supervisor_capacity() SECURITY DEFINER function rather
 * than counting graduation_projects directly: a direct count run under
 * a STUDENT's session is silently filtered by RLS (grad_projects_select_own_student
 * / grad_projects_select_supervisor) to only rows involving THAT
 * student, undercounting every other student's active supervision
 * with the target lecturer down to ~0. The DB function returns only
 * aggregate counts — never student identity — so bypassing RLS here
 * leaks nothing.
 */
export async function getSupervisorCapacity(
  supabase: SupabaseServerClient,
  supervisorId: string
): Promise<SupervisorCapacity | null> {
  const { data, error } = await supabase
    .rpc("get_supervisor_capacity", { p_supervisor_id: supervisorId })
    .maybeSingle();

  if (error || !data) return null;

  // Cast: the generated Supabase types don't yet know about this RPC
  // (added directly via migration), so .rpc() infers an empty object
  // type here even though the function's actual return shape — set by
  // its RETURNS TABLE(...) clause — is exactly this.
  const row = data as { max_capacity: number; current_students: number; available_slots: number };

  return {
    max_capacity: row.max_capacity,
    current_students: row.current_students,
    available_slots: row.available_slots,
  };
}

/** The exact message enforce_supervisor_capacity() raises. Matched
 *  against error.message in acceptRequest() to translate the DB
 *  trigger's rejection into a friendly, user-facing string. */
export const CAPACITY_TRIGGER_MESSAGE = "SUPERVISOR_AT_CAPACITY";

export const CAPACITY_FRIENDLY_MESSAGE =
  "This supervisor has reached their maximum student capacity. Please choose another supervisor.";
