import { requireAdmin } from "@/lib/auth/requireAdmin";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
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
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-page-in">
          {children}
        </main>

        <MobileNav />
      </div>
    </div>
  );
}
