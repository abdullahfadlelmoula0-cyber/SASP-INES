import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { InfoBar } from "@/components/layout/InfoBar";
import { MobileNav } from "@/components/layout/MobileNav";

/**
 * Admin route group layout.
 *
 * Protection layers:
 * 1. middleware.ts     — unauthenticated → /login (edge, fast)
 * 2. requireAdmin()   — authenticated but role ≠ admin → /dashboard
 *
 * Uses the same dashboard shell as (dashboard) group so admins have
 * consistent access to all navigation, including the Administration
 * section in the sidebar (conditionally rendered for admin users only).
 *
 * Fetches the total course count server-side and passes it to the
 * Sidebar so the "Courses" nav item shows a live count badge.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminOrDepartmentAdmin();

  // Fetch course count for sidebar badge — this runs once per layout
  // render, cached at the segment level by Next.js.
  const supabase = await createClient();
  const { count: courseCount } = await supabase
    .from("courses")
    .select("*", { count: "exact", head: true });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar courseCount={courseCount ?? undefined} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <InfoBar />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-page-in">
          {children}
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
