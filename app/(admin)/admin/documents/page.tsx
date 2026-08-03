import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FolderOpen, Upload } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documents | Admin",
  description: "Manage and upload academic documents for students.",
};

export default async function AdminDocumentsPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Upload lecture notes, syllabi, handbooks, and other academic resources."
        action={
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary/30 text-primary-foreground/60 cursor-not-allowed"
            title="Module not yet available"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        }
      />

      <EmptyState
        icon={FolderOpen}
        title="Documents module not yet configured"
        description="The database tables for the Documents module are not yet available. This section will become active in a future release."
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
