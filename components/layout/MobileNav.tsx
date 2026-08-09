"use client";

import type { ElementType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  BookOpen,
  Building2,
  Bell,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";

// ── Student nav: 5 items (Exams/Documents removed — accessible inside course detail) ──
const studentNavItems = [
  { href: "/dashboard",     label: "Home",     icon: LayoutDashboard },
  { href: "/courses",       label: "Courses",  icon: BookOpen },
  { href: "/announcements", label: "News",     icon: Bell },
  { href: "/profile",       label: "Profile",  icon: User },
  { href: "/settings",      label: "Settings", icon: Settings },
];

// ── Admin nav: 5 items ──────────────────────────────────────────
const adminNavItems = [
  { href: "/admin",                    label: "Home",     icon: LayoutDashboard },
  { href: "/admin/students",           label: "Students", icon: Users },
  { href: "/admin/courses",            label: "Courses",  icon: BookOpen },
  { href: "/admin/academic-structure", label: "Structure", icon: Building2 },
  { href: "/admin/settings",           label: "Settings", icon: Settings },
];

/**
 * Mobile bottom navigation bar — visible only on small screens (md:hidden).
 * 5 items, pill-style active indicator, 48px min-height tap targets.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin, isDepartmentAdmin, profile } = useUser();

  // For department admins:
  //  - "Structure" points straight to their own academic-structure page
  //    instead of the cross-department index.
  //  - "Settings" points to the general /settings page (Appearance, FAQ,
  //    account) instead of /admin/settings — that page is guarded by
  //    requireAdmin() (general admin only, system-wide settings), so a
  //    department_admin landing there gets redirected away instantly.
  //    /settings has no role restriction, so it works for them too.
  const navItems = isAdmin
    ? isDepartmentAdmin && profile?.managed_department_id
      ? adminNavItems.map((item) => {
          if (item.href === "/admin/academic-structure") {
            return { ...item, href: `/admin/academic-structure/${profile.managed_department_id}`, label: "Dept" };
          }
          if (item.href === "/admin/settings") {
            return { ...item, href: "/settings" };
          }
          return item;
        })
      : adminNavItems
    : studentNavItems;

  return (
    <nav
      className="md:hidden flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-sm px-1 py-1 safe-bottom"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard" || item.href === "/admin"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              // Base: column flex, minimum 48px tap target
              "flex flex-col items-center justify-center gap-1 min-h-[48px] px-3 py-1.5 rounded-xl transition-all duration-200",
              // Active pill
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <item.icon
              className={cn(
                "transition-transform duration-200",
                isActive ? "w-[22px] h-[22px] scale-110" : "w-[20px] h-[20px]"
              )}
            />
            <span
              className={cn(
                "text-[11px] font-medium leading-none",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
