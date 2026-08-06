"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";

const studentNavItems = [
  { href: "/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { href: "/profile",        label: "My Profile",     icon: User },
  { href: "/courses",        label: "Courses",        icon: BookOpen }, // تأكد من وجود هذا السطر
  { href: "/exams",          label: "Previous Exams", icon: FileText },
  { href: "/announcements",  label: "Announcements",  icon: Bell },
];

const adminNavItems = [
  { href: "/admin",               label: "Dashboard",           icon: LayoutDashboard },
  { href: "/admin/students",      label: "Students",            icon: Users },
  { href: "/admin/courses",       label: "Courses",             icon: BookOpen },
  { href: "/admin/announcements", label: "Announcements",       icon: Bell },
  { href: "/admin/exams",         label: "Documents",           icon: FileText },
];

// General admin-only items
const adminOnlyNavItems = [
  { href: "/admin/academic-structure", label: "Academic Structure", icon: Building2 },
  { href: "/admin/graduation-ai", label: "Graduation AI", icon: GraduationCap },
  { href: "/admin/settings",      label: "Settings",            icon: Settings },
];

export function Sidebar({ courseCount }: { courseCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, isGeneralAdmin, isLoading } = useUser();

  async function handleSignOut() {
    const supabase = createClient();
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
    <aside className="hidden md:flex flex-col w-64 shrink-0 sidebar-gradient border-r border-sidebar-border">
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
          // Admin account: show ONLY the admin section — no student menu,
          // no duplicate "Dashboard" entries.
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 mb-2">
              <Shield className="w-3 h-3 text-amber-400" />
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
                {isGeneralAdmin ? "Administration" : "Dept. Administration"}
              </p>
            </div>
            {adminNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                badge={item.href === "/admin/courses" && courseCount !== undefined ? courseCount : undefined}
              />
            ))}
            {/* General admin-only navigation items */}
            {isGeneralAdmin && adminOnlyNavItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
              />
            ))}
          </div>
        ) : (
          // Student account: show only the student menu.
          !isLoading && (
            <div className="space-y-1">
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                Menu
              </p>
              {studentNavItems.map((item) => (
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
