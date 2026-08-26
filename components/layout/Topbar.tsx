"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, GraduationCap, LogOut, User, Settings, CheckCheck, Circle } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { getInitials } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Notification } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Lightweight relative-time formatter — no external dep required. */
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return rtf.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 30) return rtf.format(-days, "day");
  const months = Math.floor(days / 30);
  if (months < 12) return rtf.format(-months, "month");
  return rtf.format(-Math.floor(months / 12), "year");
}

export function Topbar() {
  const { profile, isLoading, user } = useUser();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const initials = profile ? getInitials(profile.full_name) : "?";
  const displayName = profile?.full_name ?? "User";
  const roleDisplay =
    profile?.role === "admin"
      ? "Administrator"
      : profile?.role === "department_admin"
      ? "Department Admin"
      : profile?.role === "lecturer"
      ? "Lecturer"
      : profile?.department ?? "Student";
  const emailDisplay = profile?.university_email ?? "";
  const isAdminRole = profile?.role === "admin" || profile?.role === "department_admin";
  const settingsHref = profile?.role === "admin" ? "/admin/settings" : "/settings";

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ── Fetch notifications ───────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setNotifLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications((data as Notification[]) ?? []);
    setNotifLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Mark single notification as read and navigate ─────────────────
  async function handleNotifClick(notif: Notification) {
    if (!notif.is_read) {
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    if (notif.link) {
      router.push(notif.link);
    }
  }

  // ── Mark all as read ─────────────────────────────────────────────
  async function handleMarkAllRead() {
    if (!user || unreadCount === 0) return;
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

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
        {/* ── Notification Bell ─────────────────────────────────── */}
        <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifications(); }}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Notifications"
              className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/30 transition-colors outline-none"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 border-2 border-card flex items-center justify-center text-[9px] font-bold text-white leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <DropdownMenuLabel className="p-0 text-sm font-semibold">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-rose-500">
                    {unreadCount} new
                  </span>
                )}
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {notifLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotifClick(notif)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border/50 last:border-0 transition-colors hover:bg-muted/50 focus:outline-none focus:bg-muted/50",
                      !notif.is_read && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {!notif.is_read && (
                        <Circle className="w-2 h-2 mt-1.5 shrink-0 fill-primary text-primary" />
                      )}
                      <div className={cn("flex-1 min-w-0", notif.is_read && "pl-[18px]")}>
                        <p className={cn("text-sm leading-snug", !notif.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.body}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings shortcut */}
        <Link
          href={settingsHref}
          aria-label="Settings"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/30 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </Link>

        {/* User dropdown */}
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
                <p className="text-xs text-muted-foreground">{roleDisplay}</p>
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
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-rose-500 focus:text-rose-500 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
