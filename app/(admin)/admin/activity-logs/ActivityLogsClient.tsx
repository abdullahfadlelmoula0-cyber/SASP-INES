"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  History,
  Filter,
  RefreshCw,
  Loader2,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  UserCog,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { formatDistanceToNow, formatDate, cn } from "@/lib/utils";
import { getActivityLogs } from "@/lib/activity-log/actions";
import type { ActivityAction, ActivityLog, UserRole } from "@/types";

// ── Static option lists ──────────────────────────────────────────

const ROLE_OPTIONS: UserRole[] = ["admin", "department_admin", "lecturer"];

const ACTION_OPTIONS: ActivityAction[] = [
  "LOGIN",
  "LOGOUT",
  "ACCEPT_SUPERVISION_REQUEST",
  "REJECT_SUPERVISION_REQUEST",
  "CREATE_LECTURER",
  "UPDATE_LECTURER",
  "DELETE_LECTURER",
  "CREATE_STUDENT",
  "UPDATE_STUDENT",
  "DELETE_STUDENT",
  "CREATE_COURSE",
  "UPDATE_COURSE",
  "DELETE_COURSE",
  "CREATE_ANNOUNCEMENT",
  "UPDATE_ANNOUNCEMENT",
  "DELETE_ANNOUNCEMENT",
  "UPDATE_USER",
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  department_admin: "Department Admin",
  lecturer: "Lecturer",
  student: "Student",
};

function actionMeta(action: ActivityAction): {
  label: string;
  icon: React.ElementType;
  className: string;
} {
  if (action === "LOGIN") {
    return { label: "Login", icon: LogIn, className: "text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700" };
  }
  if (action === "LOGOUT") {
    return { label: "Logout", icon: LogOut, className: "text-muted-foreground border-border" };
  }
  if (action === "ACCEPT_SUPERVISION_REQUEST") {
    return { label: "Accepted Supervision", icon: CheckCircle2, className: "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700" };
  }
  if (action === "REJECT_SUPERVISION_REQUEST") {
    return { label: "Declined Supervision", icon: XCircle, className: "text-rose-600 border-rose-300 dark:text-rose-400 dark:border-rose-700" };
  }
  if (action.startsWith("CREATE_")) {
    return { label: action.replace("CREATE_", "Created ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), icon: Plus, className: "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700" };
  }
  if (action.startsWith("DELETE_")) {
    return { label: action.replace("DELETE_", "Deleted ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), icon: Trash2, className: "text-rose-600 border-rose-300 dark:text-rose-400 dark:border-rose-700" };
  }
  if (action === "UPDATE_USER") {
    return { label: "Updated User", icon: UserCog, className: "text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700" };
  }
  // UPDATE_LECTURER / UPDATE_STUDENT / UPDATE_COURSE / UPDATE_ANNOUNCEMENT
  return { label: action.replace("UPDATE_", "Updated ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), icon: Pencil, className: "text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700" };
}

function roleBadgeClassName(role: UserRole): string {
  switch (role) {
    case "admin":
      return "text-primary border-primary/30 bg-primary/5";
    case "department_admin":
      return "text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700";
    case "lecturer":
      return "text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700";
    default:
      return "text-muted-foreground border-border";
  }
}

// ── Page ──────────────────────────────────────────────────────────

export function ActivityLogsClient() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");
  const [actionFilter, setActionFilter] = useState<ActivityAction | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const res = await getActivityLogs({
      role: roleFilter || undefined,
      action: actionFilter || undefined,
      dateFrom: dateFrom || undefined,
      // Include the whole selected day for the "to" bound.
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined,
    });
    if (res.error) {
      setError(res.error);
    } else {
      setLogs(res.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, actionFilter, dateFrom, dateTo]);

  const hasFilters = !!(roleFilter || actionFilter || dateFrom || dateTo || search);

  function clearFilters() {
    setRoleFilter("");
    setActionFilter("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }

  const visibleLogs = search.trim()
    ? logs.filter((log) => {
        const q = search.trim().toLowerCase();
        return (
          log.user?.full_name?.toLowerCase().includes(q) ||
          log.user?.university_email?.toLowerCase().includes(q) ||
          log.description?.toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Audit trail of admin, department admin, and lecturer actions. Students are never logged."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Filters</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}>
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Action</label>
            <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as ActivityAction | "")}>
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {actionMeta(a).label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex h-10 w-full items-center rounded-lg border border-input bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex h-10 w-full items-center rounded-lg border border-input bg-background px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Search</label>
            <input
              type="text"
              placeholder="Name, email, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-10 w-full items-center rounded-lg border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear all filters
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      {loading ? (
        <LoadingSpinner />
      ) : visibleLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity found"
          description={
            hasFilters
              ? "No log entries match your current filters."
              : "Actions taken by admins, department admins, and lecturers will appear here."
          }
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Actor</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">
                    Department
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleLogs.map((log) => {
                  const meta = actionMeta(log.action);
                  const Icon = meta.icon;
                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground" title={formatDate(log.created_at)}>
                        {formatDistanceToNow(log.created_at)}
                      </td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <p className="font-medium text-foreground truncate">
                          {log.user?.full_name ?? "Unknown user"}
                        </p>
                        {log.user?.university_email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {log.user.university_email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-xs", roleBadgeClassName(log.role))}>
                          {ROLE_LABELS[log.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("gap-1 text-xs", meta.className)}>
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-[320px]">
                        <span className="line-clamp-2">{log.description ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {log.department?.name ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
            Showing {visibleLogs.length} of up to 200 most recent entries.
          </div>
        </div>
      )}
    </div>
  );
}
