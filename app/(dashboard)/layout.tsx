import { requireAuth } from "@/lib/auth/requireAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { InfoBar } from "@/components/layout/InfoBar";
import { MobileNav } from "@/components/layout/MobileNav";

/**
 * Dashboard route group layout.
 *
 * Protection layers:
 * 1. middleware.ts — first layer: unauthenticated → /login (fast, edge)
 * 2. requireAuth() — second layer: server-side profile check
 *
 * The profile is fetched here once and passed down via the shared
 * shell components. Individual pages do NOT need to re-fetch it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Second-layer server-side guard.
  // Redirects to /login if unauthenticated or profile is missing.
  await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
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