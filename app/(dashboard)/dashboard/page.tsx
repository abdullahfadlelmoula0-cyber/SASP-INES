import type { Metadata } from "next";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/requireAuth";
import { createClient } from "@/lib/supabase/server";
import {
  BookOpen,
  FileText,
  Bell,
  FolderOpen,
  Calendar,
  GraduationCap,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your SASP-INES academic overview.",
};

export default async function DashboardPage() {
  const profile = await requireAuth();
  const supabase = await createClient();

  // ── Fetch real stats ───────────────────────────────────────────
  const [
    { count: courseCount },
    { count: docCount },
    { count: examCount },
    { count: announcementCount },
  ] = await Promise.all([
    // RLS automatically restricts to student's matching courses
    supabase
      .from("courses")
      .select("*", { count: "exact", head: true }),
    // Documents visible to this student via RLS
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true }),
    // Exams visible to this student via RLS
    supabase
      .from("exams")
      .select("*", { count: "exact", head: true }),
    // Announcements visible to this student via RLS (non-expired)
    supabase
      .from("announcements")
      .select("*", { count: "exact", head: true }),
  ]);

  // Fetch recent courses for the "My Courses" preview
  const { data: recentCourses } = await supabase
    .from("courses")
    .select("id, code, title, start_date, end_date, credits")
    .order("code", { ascending: true })
    .limit(4);

  // Fetch recent announcements (3 most recent, non-expired)
  const { data: recentAnnouncements } = await supabase
    .from("announcements")
    .select("id, title, body, priority, is_pinned, created_at, expires_at")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);

  const firstName = profile.full_name?.split(" ")[0] || "Student";

  const stats = [
    {
      label: "My Courses",
      value: courseCount ?? 0,
      icon: BookOpen,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-200 dark:border-blue-900/40",
      href: "/courses",
    },
    {
      label: "Documents",
      value: docCount ?? 0,
      icon: FolderOpen,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-900/40",
      href: "/courses",
    },
    {
      label: "Exams",
      value: examCount ?? 0,
      icon: FileText,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-900/40",
      href: "/courses",
    },
    {
      label: "Announcements",
      value: announcementCount ?? 0,
      icon: Bell,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-200 dark:border-rose-900/40",
      href: "/announcements",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-primary">Welcome back</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {firstName}!
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <GraduationCap className="w-4 h-4" />
                {profile.program || profile.department || "Student"}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>Year {profile.year_of_study}</span>
              {profile.academic_year && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {profile.academic_year}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/courses">
                <BookOpen className="w-4 h-4" />
                View Courses
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
          >
            <div className={`p-3 rounded-lg border ${stat.bg} ${stat.border}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {stat.label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Courses Preview + Announcements */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* My Courses Preview */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-foreground">My Courses</h2>
            </div>
            <Link
              href="/courses"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!recentCourses || recentCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Your courses will appear here once your admin has set them up."
            />
          ) : (
            <div className="divide-y divide-border">
              {recentCourses.map((c) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {c.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.code} · {c.credits} credit{c.credits === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Announcements Preview */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-foreground">
                Recent Announcements
              </h2>
            </div>
            <Link
              href="/announcements"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!recentAnnouncements || recentAnnouncements.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No announcements yet"
              description="Check back later for updates from the administration."
            />
          ) : (
            <div className="divide-y divide-border">
              {recentAnnouncements.map((announcement) => {
                const priorityColors = {
                  low: "text-blue-600 bg-blue-50 border-blue-200",
                  normal: "text-gray-600 bg-gray-50 border-gray-200",
                  high: "text-orange-600 bg-orange-50 border-orange-200",
                  urgent: "text-red-600 bg-red-50 border-red-200",
                };

                return (
                  <Link
                    key={announcement.id}
                    href="/announcements"
                    className="flex flex-col gap-2 px-5 py-4 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {announcement.is_pinned && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Pinned
                            </Badge>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              priorityColors[announcement.priority as keyof typeof priorityColors]
                            }`}
                          >
                            {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {announcement.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {announcement.body}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(announcement.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      {announcement.expires_at && new Date(announcement.expires_at) > new Date() && (
                        <>
                          <span>•</span>
                          <span>
                            Expires {new Date(announcement.expires_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Profile Info Card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm text-foreground">Academic Profile</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Student ID", value: profile.student_id || "—" },
            { label: "Department", value: profile.department || "—" },
            { label: "Year of Study", value: `Year ${profile.year_of_study}` },
            { label: "Academic Year", value: profile.academic_year || "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/30 border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
              <p className="text-sm font-medium text-foreground truncate">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
