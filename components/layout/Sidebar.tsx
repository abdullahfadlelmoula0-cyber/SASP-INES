"use client";

import type { ElementType } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  BookOpen,
  FileText,
  Bell,
  LogOut,
  GraduationCap,
  Settings,
  Shield,
  Users,
  Building2,
  ClipboardList,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { logAuthEvent } from "@/lib/activity-log/actions";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { getMaxYearsForProgram } from "@/lib/academic-config";

// ── Nav item arrays ───────────────────────────────────────────────

const studentNavItems = [
  { href: "/dashboard",          label: "Dashboard",          icon: LayoutDashboard },
  { href: "/profile",            label: "My Profile",         icon: User },
  { href: "/courses",            label: "Courses",            icon: BookOpen },
  { href: "/graduation-project", label: "Graduation Project", icon: GraduationCap },
  { href: "/announcements",      label: "Announcements",      icon: Bell },
  { href: "/settings",           label: "Settings",           icon: Settings },
];

const lecturerNavItems = [
  { href: "/dashboard",             label: "Dashboard",            icon: LayoutDashboard },
  { href: "/supervision-requests",  label: "Supervision Requests", icon: ClipboardList },
  { href: "/profile",               label: "Profile",              icon: User },
  { href: "/settings",              label: "Settings",             icon: Settings },
];

const adminNavItems = [
  { href: "/admin",                    label: "Dashboard",          icon: LayoutDashboard },
  { href: "/admin/students",           label: "Students",           icon: Users },
  { href: "/admin/courses",            label: "Courses",            icon: BookOpen },
  { href: "/admin/academic-structure", label: "Academic Structure", icon: Building2 },
  { href: "/admin/announcements",      label: "Announcements",      icon: Bell },
];

// General admin-only items (not shown to department_admin)
const adminOnlyNavItems = [
  { href: "/admin/lecturers",   label: "Lecturers",    icon: Users },
  { href: "/admin/graduation-ai", label: "Graduation AI", icon: GraduationCap },
  { href: "/admin/guidelines", label: "Dissertation Guidelines", icon: FileText },
  { href: "/admin/activity-logs", label: "Activity Logs", icon: History },
  { href: "/admin/settings",    label: "Settings",     icon: Settings },
];

export function Sidebar({
  courseCount,
  variant = "desktop",
  onNavigate,
}: {
  courseCount?: number;
  /** "desktop": the permanent md+ sidebar (hidden below md).
   *  "drawer": rendered inside the mobile hamburger drawer — always
   *  visible (the drawer itself handles the md:hidden trigger), and
   *  calls onNavigate() after each link click so the drawer can close. */
  variant?: "desktop" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isAdmin,
    isGeneralAdmin,
    isDepartmentAdmin,
    isLecturer,
    profile,
    isLoading,
  } = useUser();

  // ── Final-year detection (Graduation Project visibility) ────────
  // A student only sees "Graduation Project" once they're in their
  // final year. Three cases, based on the academic structure schema:
  //
  //  1. specialization_id set → final year = that specialization's
  //     total_duration_years.
  //  2. academic_plan_id set but specialization_id NULL → the student
  //     is on the structured path but hasn't branched yet. This is
  //     final year ONLY if the plan has zero specializations at all
  //     (an unbranched programme, e.g. Civil Engineering — shared_years
  //     IS the total length). If the plan DOES have specializations,
  //     the student is still in the shared trunk and can never be in
  //     their final year without a specialization_id (enforced by a
  //     DB trigger), so we correctly report false.
  //  3. Neither set (pure legacy student) → fall back to
  //     getMaxYearsForProgram() from the static department/program
  //     config.
  const [isFinalYear, setIsFinalYear] = useState(false);

  useEffect(() => {
    if (!profile) {
      setIsFinalYear(false);
      return;
    }
    // Captured once, right after the null-check, into a fresh const.
    // Its inferred type is UserProfile (non-null) permanently — unlike
    // the outer `profile` binding, this narrowing survives being read
    // from inside the nested async function/closures below.
    const currentProfile = profile;

    let cancelled = false;
    const supabase = createClient();

    async function resolveFinalYear() {
      if (currentProfile.specialization_id) {
        const { data } = await supabase
          .from("specializations")
          .select("total_duration_years")
          .eq("id", currentProfile.specialization_id)
          .single();
        if (cancelled) return;
        const maxYears = data?.total_duration_years;
        setIsFinalYear(
          typeof maxYears === "number" && currentProfile.year_of_study >= maxYears
        );
        return;
      }

      if (currentProfile.academic_plan_id) {
        const [{ data: plan }, { count }] = await Promise.all([
          supabase
            .from("academic_plans")
            .select("shared_years")
            .eq("id", currentProfile.academic_plan_id)
            .single(),
          supabase
            .from("specializations")
            .select("id", { count: "exact", head: true })
            .eq("academic_plan_id", currentProfile.academic_plan_id),
        ]);
        if (cancelled) return;

        const hasSpecializations = (count ?? 0) > 0;
        if (hasSpecializations) {
          // Still in the shared trunk with no track chosen yet —
          // can never be final year in this state.
          setIsFinalYear(false);
        } else {
          const sharedYears = plan?.shared_years;
          setIsFinalYear(
            typeof sharedYears === "number" && currentProfile.year_of_study >= sharedYears
          );
        }
        return;
      }

      // Pure legacy student — no structured-path IDs at all.
      const maxYears = getMaxYearsForProgram(currentProfile.department, currentProfile.program);
      setIsFinalYear(currentProfile.year_of_study >= maxYears);
    }

    resolveFinalYear();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const visibleStudentNavItems = studentNavItems.filter(
    (item) => item.href !== "/graduation-project" || isFinalYear
  );

  // Build nav items for department admins: keep "Courses" pointing to
  // /admin/courses exactly like general admin; "Academic Structure" points
  // straight at their own department.
  const effectiveAdminNavItems = (() => {
    const managedDepartmentId = profile?.managed_department_id;
    if (!isDepartmentAdmin || !managedDepartmentId) return adminNavItems;
    // Narrowed to a plain `string` at declaration — safe to read from
    // inside the .map() callback below (see the same fix applied above
    // for `currentProfile`).
    const deptId = managedDepartmentId;
    return adminNavItems.map((item) =>
      item.href === "/admin/academic-structure"
        ? {
            href: `/admin/academic-structure/${deptId}`,
            label: "My Department",
            icon: Building2,
          }
        : item
    );
  })();

  // Department admins get the general /settings page (not /admin/settings
  // which is general-admin-only — system-wide settings).
  const settingsNavItem = isDepartmentAdmin
    ? { href: "/settings", label: "Settings", icon: Settings }
    : null;

  async function handleSignOut() {
    const supabase = createClient();
    // Log the sign-out event BEFORE the actual signOut() call, using
    // `profile` already loaded from useUser() — no extra fetch needed.
    // Non-student roles only, enforced inside logAuthEvent itself.
    if (profile) {
      await logAuthEvent({ userId: profile.id, role: profile.role, event: "LOGOUT" });
    }
    onNavigate?.();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavItem({
    href,
    label,
    icon: Icon,
    badge,
  }: {
    href: string;
    label: string;
    icon: React.ElementType;
    badge?: number;
  }) {
    const isActive = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-sidebar-accent text-white"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
      >
        <Icon
          className={cn(
            "w-4 h-4 shrink-0",
            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"
          )}
        />
        <span className="flex-1">{label}</span>
        {badge !== undefined && (
          <span className="ml-auto text-[10px] font-semibold bg-sidebar-accent/60 text-sidebar-foreground/80 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
            {badge}
          </span>
        )}
        {isActive && badge === undefined && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
        )}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 sidebar-gradient",
        variant === "desktop"
          ? "hidden md:flex w-64 border-r border-sidebar-border"
          : "w-full h-full"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-white truncate">SASP-INES</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">
            INES-Ruhengeri
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {!isLoading && isAdmin ? (
          // ── Admin / Department Admin ──────────────────────────
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 mb-2">
              <Shield className="w-3 h-3 text-amber-400" />
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
                {isGeneralAdmin ? "Administration" : "Dept. Administration"}
              </p>
            </div>
            {effectiveAdminNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                badge={
                  item.href === "/admin/courses" && courseCount !== undefined
                    ? courseCount
                    : undefined
                }
              />
            ))}
            {/* General admin-only items (Lecturers, Graduation AI, Settings) */}
            {isGeneralAdmin &&
              adminOnlyNavItems.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            {/* Department admin: general /settings (not /admin/settings) */}
            {settingsNavItem && <NavItem {...settingsNavItem} />}
          </div>
        ) : !isLoading && isLecturer ? (
          // ── Lecturer ──────────────────────────────────────────
          <div className="space-y-1">
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              Menu
            </p>
            {lecturerNavItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ) : (
          // ── Student ───────────────────────────────────────────
          !isLoading && (
            <div className="space-y-1">
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                Menu
              </p>
              {visibleStudentNavItems.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          )
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-rose-400 transition-all duration-150"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
