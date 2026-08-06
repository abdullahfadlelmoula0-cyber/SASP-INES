import type { Metadata } from "next";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, Upload } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Previous Exams | Admin",
  description: "Manage and upload previous exam papers for students.",
};

export default async function AdminExamsPage() {
  await requireAdminOrDepartmentAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Previous Exams"
        description="Upload and manage past exam papers for all programmes."
        action={
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary/30 text-primary-foreground/60 cursor-not-allowed"
            title="Module not yet available"
          >
            <Upload className="w-4 h-4" />
            Upload Exam
          </button>
        }
      />

      <EmptyState
        icon={FileText}
        title="Exams module not yet configured"
        description="The database tables for the Exams module are not yet available. This section will become active in a future release."
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
