"use client";

import { Bell, GraduationCap, LogOut, User, Settings } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar() {
  const { profile, isLoading } = useUser();
  const router = useRouter();

  const initials = profile ? getInitials(profile.full_name) : "?";
  const displayName = profile?.full_name ?? "Student";
  const roleDisplay = profile?.role === "admin" ? "Administrator" : profile?.role === "department_admin" ? "Department Admin" : profile?.department ?? "Student";
  const emailDisplay = profile?.university_email ?? "";
  const isAdminRole = profile?.role === "admin" || profile?.role === "department_admin";
  const announcementsHref = isAdminRole ? "/admin/announcements" : "/announcements";
  // /admin/settings is general-admin-only (system-wide settings). A
  // department_admin gets redirected away from it instantly, so they use
  // the general /settings page instead (same one students use —
  // Appearance, FAQ, account — no role restriction on it).
  const settingsHref = profile?.role === "admin" ? "/admin/settings" : "/settings";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-card/80 backdrop-blur-sm shrink-0 z-10">
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm text-foreground">SASP-INES</span>
      </div>

      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <Link
          href={announcementsHref}
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/30 transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-card" />
        </Link>

        {/* Direct, single-click settings shortcut — goes straight to the
            right settings page based on role, no dropdown needed. */}
        <Link
          href={settingsHref}
          aria-label="Settings"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/30 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 outline-none">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors">
                {isLoading ? (
                  <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : (
                  <span className="text-xs font-semibold text-primary">
                    {initials}
                  </span>
                )}
              </div>
              <div className="hidden lg:block text-left leading-tight">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {roleDisplay}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {emailDisplay}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={isAdminRole ? "/admin" : "/profile"} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={settingsHref} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-rose-500 focus:text-rose-500 cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
