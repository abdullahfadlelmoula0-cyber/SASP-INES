import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  BookOpen,
  FileText,
  Bell,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your SASP-INES academic overview.",
};

const stats = [
  {
    label: "Enrolled Courses",
    value: "—",
    icon: BookOpen,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  {
    label: "Available Exams",
    value: "—",
    icon: FileText,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
  {
    label: "Announcements",
    value: "—",
    icon: Bell,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/40",
  },
  {
    label: "Documents",
    value: "—",
    icon: TrendingUp,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here is your academic overview."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`p-3 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">
              Recent Announcements
            </h2>
          </div>
          <EmptyState
            icon={Bell}
            title="No announcements yet"
            description="Check back later for updates from the administration."
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">
              Upcoming Events
            </h2>
          </div>
          <EmptyState
            icon={Users}
            title="No events scheduled"
            description="Academic events and deadlines will appear here."
          />
        </div>
      </div>
    </div>
  );
}
