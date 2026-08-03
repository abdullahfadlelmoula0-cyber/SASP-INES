import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { GraduationCap, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Graduation AI | Admin",
  description: "AI-assisted graduation eligibility and project tools.",
};

export default async function AdminGraduationAIPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Graduation AI Assistant"
        description="AI-powered tools to assess graduation eligibility and review student academic progress."
        action={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Coming soon
            </span>
          </div>
        }
      />

      <EmptyState
        icon={GraduationCap}
        title="Graduation AI not yet available"
        description="The AI Graduation Assistant will be available in a future version. It will allow admins to assess student eligibility for graduation based on academic performance and course completion."
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
