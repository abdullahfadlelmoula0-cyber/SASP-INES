import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { createClient } from "@/lib/supabase/server";
import {
  Users,
  BookOpen,
  FileText,
  FolderOpen,
  Bell,
  Plus,
  Upload,
  ArrowRight,
  GraduationCap,
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate } from "@/lib/utils";
import type { Course } from "@/types";

export const metadata: Metadata = {
  title: "Admin Dashboard | SASP-INES",
  description: "Administration overview, statistics, and quick actions for SASP-INES.",
};

// ── Delivery status helper (same logic as AdminCoursesClient) ─────
function getDeliveryStatus(course: Course): "scheduled" | "in_progress" | "completed" | "unknown" {
  if (!course.start_date && !course.end_date) return "unknown";
  const now = new Date();
  const start = course.start_date ? new Date(course.start_date) : null;
  const end = course.end_date ? new Date(course.end_date) : null;
  if (start && now < start) return "scheduled";
  if (end && now > end) return "completed";
  return "in_progress";
}

export default async function AdminDashboardPage() {
  const admin = await requireAdminOrDepartmentAdmin();
  const supabase = await createClient();

  const isDeptAdmin = admin.role === "department_admin";
  const deptId = isDeptAdmin ? admin.managed_department_id : null;

  // Build scoped queries — department admins only see their department's data
  let studentsQuery = supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "student");

  let coursesQuery = supabase
    .from("courses")
    .select("*", { count: "exact", head: true });

  let recentCoursesQuery = supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  // Scope queries for department admins
  if (isDeptAdmin && deptId) {
    studentsQuery = studentsQuery.eq("academic_plans.department_id", deptId);
    coursesQuery = coursesQuery.eq("academic_plans.department_id", deptId);
    recentCoursesQuery = recentCoursesQuery.eq("academic_plans.department_id", deptId);
  }

  const [
    { count: studentsCount },
    { count: totalCoursesCount },
    { data: recentCourses },
  ] = await Promise.all([
    studentsQuery,
    coursesQuery,
    recentCoursesQuery,
  ]);

  const firstName = admin.full_name.split(" ")[0] || "Admin";

  // ── Stats cards configuration ──────────────────────────────────
  const statCards = [
    {
      id: "students",
      label: "Total Students",
      value: studentsCount ?? 0,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      border: "border-blue-100 dark:border-blue-900/60",
      href: "/admin/students",
      badge: null,
    },
    {
      id: "total-courses",
      label: "Total Courses",
      value: totalCoursesCount ?? 0,
      icon: BookOpen,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-100 dark:border-emerald-900/60",
      href: "/admin/courses",
      badge: null,
    },
    {
      id: "exams",
      label: "Previous Exams",
      value: "—",
      icon: FileText,
      color: "text-purple-500 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      border: "border-purple-100 dark:border-purple-900/60",
      href: "/admin/exams",
      badge: "Not configured",
    },
    {
      id: "documents",
      label: "Documents",
      value: "—",
      icon: FolderOpen,
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      border: "border-rose-100 dark:border-rose-900/60",
      href: "/admin/documents",
      badge: "Not configured",
    },
  ];

  // ── Quick actions ───────────────────────────────────────────────
  const quickActions = [
    {
      id: "add-course",
      label: "Add Course",
      description: "Create a new academic course",
      icon: Plus,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      href: "/admin/courses?action=create",
    },
    {
      id: "upload-exam",
      label: "Upload Exam",
      description: "Add a previous exam paper",
      icon: Upload,
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600 dark:text-purple-400",
      href: "/admin/exams",
    },
    {
      id: "upload-document",
      label: "Upload Document",
      description: "Share lecture notes or resources",
      icon: FolderOpen,
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
      href: "/admin/documents",
    },
    {
      id: "create-announcement",
      label: "Announcement",
      description: "Broadcast a message to students",
      icon: Bell,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      href: "/admin/announcements",
    },
    {
      id: "manage-students",
      label: "Manage Students",
      description: "View and edit student profiles",
      icon: Users,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      href: "/admin/students",
    },
    {
      id: "graduation-ai",
      label: "Graduation AI",
      description: "AI-assisted graduation tools",
      icon: Sparkles,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      href: "/admin/graduation-ai",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <PageHeader
        title={`Welcome back, ${firstName} 👋`}
        description="Here is your administration overview for SASP-INES."
      />

      {/* ── Stats Grid ───────────────────────────────────────────── */}
      <section aria-label="Statistics overview">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Link
              key={stat.id}
              href={stat.href}
              className="group relative rounded-xl border border-border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden"
            >
              {/* Subtle gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

              <div className={`p-3 rounded-xl ${stat.bg} border ${stat.border} shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-bold text-foreground leading-none">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {stat.label}
                </p>
                {stat.badge && (
                  <Badge
                    variant={stat.badge === "Not configured" ? "muted" : "info"}
                    className="mt-1.5 text-[10px] font-normal"
                  >
                    {stat.badge}
                  </Badge>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <section className="space-y-4" aria-label="Quick actions">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm transition-all duration-200"
            >
              <div
                className={`w-11 h-11 rounded-xl ${action.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}
              >
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <div>
                <p className="font-semibold text-xs text-foreground leading-tight">
                  {action.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Bottom Grid: Recent Courses + System Status ───────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent Courses Table — takes 2/3 width */}
        <section className="lg:col-span-2 space-y-4" aria-label="Recently added courses">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm text-foreground">
                Latest Courses
              </h2>
            </div>
            <Link
              href="/admin/courses"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {!recentCourses || recentCourses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                description="Create the first course using the Quick Actions above."
                action={
                  <Link
                    href="/admin/courses?action=create"
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Course
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">
                        Program
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center hidden sm:table-cell">
                        Yr
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">
                        Acad. Year
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentCourses.map((course: Course) => {
                      const delivery = getDeliveryStatus(course);
                      return (
                        <tr
                          key={course.id}
                          className="hover:bg-muted/20 transition-colors group"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {course.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground max-w-[160px]">
                            <span className="truncate block">{course.title}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[140px]">
                            <span className="truncate block text-xs">{course.program}</span>
                          </td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell">
                            <span className="text-xs font-medium text-muted-foreground">
                              Y{course.year_of_study}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <Badge variant="secondary" className="font-normal text-[10px]">
                              Y{course.year_of_study ?? course.year_number ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {delivery !== "unknown" ? (
                                <Badge
                                  variant={
                                    delivery === "in_progress"
                                      ? "info"
                                      : delivery === "scheduled"
                                      ? "warning"
                                      : "muted"
                                  }
                                  className="text-[10px] font-normal w-fit"
                                >
                                  {delivery === "in_progress"
                                    ? "In progress"
                                    : delivery === "scheduled"
                                    ? "Scheduled"
                                    : "Completed"}
                                </Badge>
                              ) : (
                                <Badge variant="muted" className="text-[10px] w-fit">
                                  Schedule TBD
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Right column: Recent Activity + Module Status */}
        <section className="space-y-4" aria-label="System overview">
          {/* Recent Activity */}
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">
              Recent Activity
            </h2>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {!recentCourses || recentCourses.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No recent activity"
                description="Activity will appear once you start adding courses."
              />
            ) : (
              <div className="divide-y divide-border">
                {recentCourses.slice(0, 5).map((course: Course) => (
                  <div
                    key={course.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {course.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {course.code} · Year {course.year_of_study ?? course.year_number ?? "—"} · {course.program}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] shrink-0 mt-0.5"
                    >
                      {course.department}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Module Status Card */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-foreground">
                Module Status
              </h3>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Courses", ready: true, href: "/admin/courses" },
                { label: "Students", ready: true, href: "/admin/students" },
                { label: "Previous Exams", ready: false, href: "/admin/exams" },
                { label: "Documents", ready: false, href: "/admin/documents" },
                { label: "Announcements", ready: false, href: "/admin/announcements" },
                { label: "Graduation AI", ready: false, href: "/admin/graduation-ai" },
              ].map((mod) => (
                <Link
                  key={mod.label}
                  href={mod.href}
                  className="flex items-center justify-between group hover:opacity-80 transition-opacity"
                >
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {mod.label}
                  </span>
                  <Badge
                    variant={mod.ready ? "success" : "muted"}
                    className="text-[10px]"
                  >
                    {mod.ready ? "Ready" : "Coming soon"}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Announcements & Recent Exams placeholder row ──────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">
              Latest Announcements
            </h2>
          </div>
          <EmptyState
            icon={Bell}
            title="No announcements yet"
            description="Use Quick Actions above to create the first announcement for students."
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">
              Recently Uploaded Exams
            </h2>
          </div>
          <EmptyState
            icon={FileText}
            title="No exam papers yet"
            description="Upload past papers once the Exams module is configured."
          />
        </div>
      </div>
    </div>
  );
}
