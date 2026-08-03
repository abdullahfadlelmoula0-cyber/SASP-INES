"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  BookOpen,
  FileText,
  FolderOpen,
  Bell,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/useUser";

const studentNavItems = [
  { href: "/dashboard",     label: "Home",    icon: LayoutDashboard },
  { href: "/courses",       label: "Courses", icon: BookOpen },
  { href: "/exams",         label: "Exams",   icon: FileText },
  { href: "/documents",     label: "Docs",    icon: FolderOpen },
  { href: "/announcements", label: "News",    icon: Bell },
  { href: "/profile",       label: "Profile", icon: User },
];

const adminNavItems = [
  { href: "/admin",              label: "Home",     icon: LayoutDashboard },
  { href: "/admin/students",     label: "Students", icon: Users },
  { href: "/admin/courses",      label: "Courses",  icon: BookOpen },
  { href: "/admin/exams",        label: "Exams",    icon: FileText },
  { href: "/admin/documents",    label: "Docs",     icon: FolderOpen },
  { href: "/admin/settings",     label: "Settings", icon: Settings },
];

/**
 * Mobile bottom navigation bar — visible only on small screens (md:hidden).
 * Renders admin nav items for admin users, student items otherwise.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { isAdmin } = useUser();

  const navItems = isAdmin ? adminNavItems : studentNavItems;

  return (
    <nav
      className="md:hidden flex items-center justify-around border-t border-border bg-card px-2 py-2 safe-bottom"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors min-w-[3rem]",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
