import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Settings | Admin",
  description: "Manage global system settings for SASP-INES.",
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Settings"
        description="Configure global platform settings, academic year configuration, and system preferences."
      />

      <EmptyState
        icon={Settings}
        title="Settings not yet available"
        description="Global system configuration will be available in a future version of SASP-INES."
        action={
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-muted/70 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        }
      />
    </div>
  );
}
