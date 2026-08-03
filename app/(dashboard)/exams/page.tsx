import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Previous Exams",
  description: "Browse and download previous exam papers.",
};

export default function ExamsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Previous Exams"
        description="Download past exam papers and practise for your upcoming assessments."
      />

      <EmptyState
        icon={FileText}
        title="No exam papers yet"
        description="Previous exam papers will be listed here once uploaded."
      />
    </div>
  );
}
