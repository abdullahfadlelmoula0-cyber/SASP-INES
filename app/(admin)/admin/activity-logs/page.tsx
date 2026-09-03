import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ActivityLogsClient } from "./ActivityLogsClient";

export const metadata: Metadata = {
  title: "Activity Logs | SASP-INES",
  description: "Audit log of admin, department admin, and lecturer actions.",
};

/**
 * General-admin-only page (Phase 4 of the Activity Log system).
 * requireAdmin() redirects department_admin/lecturer/student straight
 * to /dashboard — the SAME restriction is independently enforced again
 * inside getActivityLogs() itself, so this isn't the only thing standing
 * between a non-admin and this data.
 */
export default async function ActivityLogsPage() {
  await requireAdmin();
  return <ActivityLogsClient />;
}
