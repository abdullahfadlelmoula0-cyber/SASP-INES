import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FolderOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Documents",
  description: "Access academic documents, syllabi, and forms.",
};

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Documents"
        description="Access lecture notes, syllabi, handbooks, and official forms."
      />

      <EmptyState
        icon={FolderOpen}
        title="No documents yet"
        description="Academic documents will appear here once uploaded by administrators."
      />
    </div>
  );
}
