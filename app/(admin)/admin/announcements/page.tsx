import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bell, Plus } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Announcements | Admin",
  description: "Create and manage announcements for students.",
};

export default async function AdminAnnouncementsPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements"
        description="Broadcast important messages, notices, and updates to all students or specific groups."
        action={
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary/30 text-primary-foreground/60 cursor-not-allowed"
            title="Module not yet available"
          >
            <Plus className="w-4 h-4" />
            Create Announcement
          </button>
        }
      />

      <EmptyState
        icon={Bell}
        title="Announcements module not yet configured"
        description="The database tables for the Announcements module are not yet available. This section will become active in a future release."
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
