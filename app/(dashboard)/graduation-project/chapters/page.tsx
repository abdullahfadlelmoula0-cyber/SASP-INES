"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  FileText,
  PenLine,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import { getMyGraduationProject } from "@/lib/graduation/actions";
import { getProjectChapters, getChaptersComplianceOverview } from "@/lib/chapters/actions";
import { CHAPTER_CATALOG } from "@/lib/chapters/catalog";
import type { DissertationChapter, GraduationProject } from "@/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChaptersOverviewPage() {
  const [project, setProject] = useState<GraduationProject | null>(null);
  const [chapters, setChapters] = useState<DissertationChapter[]>([]);
  const [complianceByKey, setComplianceByKey] = useState<
    Record<string, "compliant" | "needs_review" | "non_compliant">
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const projectRes = await getMyGraduationProject();
      if (!projectRes.data) {
        setError("You don't have a graduation project yet.");
        setLoading(false);
        return;
      }
      setProject(projectRes.data);

      if (projectRes.data.status === "active") {
        const [chaptersRes, complianceRes] = await Promise.all([
          getProjectChapters(projectRes.data.id),
          getChaptersComplianceOverview(projectRes.data.id),
        ]);
        setChapters(chaptersRes.data);
        setComplianceByKey(complianceRes.data);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingSpinner />;

  if (error || !project) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Your Chapters" description="Write and track your dissertation chapters." />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (project.status !== "active") {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Your Chapters" description="Write and track your dissertation chapters." />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Not available yet</p>
            <p className="text-sm mt-1">
              You can start writing your chapters once a supervisor has accepted your graduation project.
            </p>
          </div>
        </div>
        <Link href="/graduation-project">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Graduation Project
          </Button>
        </Link>
      </div>
    );
  }

  const chapterByKey = new Map(chapters.map((c) => [c.chapter_key, c]));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1 -mb-2">
        <Link href="/graduation-project">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Button>
        </Link>
      </div>
      <PageHeader
        title="Your Chapters"
        description="Write directly in the system or upload a file for each chapter — every save keeps a full version history."
      />

      <div className="space-y-3">
        {CHAPTER_CATALOG.map((slot) => {
          const chapter = chapterByKey.get(slot.key);
          const hasContent = !!(chapter?.content || chapter?.file_url);
          const statusLabel = !chapter
            ? "Not Started"
            : hasContent
              ? `Saved · v${chapter.current_version_number}`
              : "Draft";
          const statusColor = !chapter
            ? "text-muted-foreground border-border"
            : hasContent
              ? "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700"
              : "text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700";

          const complianceStatus = complianceByKey[slot.key];
          const complianceMeta = complianceStatus
            ? {
                compliant: {
                  icon: CheckCircle2,
                  className: "text-emerald-600 dark:text-emerald-400",
                  label: "Compliant",
                },
                needs_review: {
                  icon: AlertTriangle,
                  className: "text-amber-600 dark:text-amber-400",
                  label: "Needs Review",
                },
                non_compliant: {
                  icon: XCircle,
                  className: "text-rose-600 dark:text-rose-400",
                  label: "Non-Compliant",
                },
              }[complianceStatus]
            : null;

          return (
            <Link key={slot.key} href={`/graduation-project/chapters/${slot.key}`} className="block">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/30 hover:shadow-md transition-all flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {chapter?.file_url ? (
                      <FileText className="w-5 h-5 text-primary" />
                    ) : hasContent ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <PenLine className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{slot.title}</p>
                    {chapter?.updated_at && (
                      <p className="text-xs text-muted-foreground">
                        Last updated {formatDate(chapter.updated_at)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {complianceMeta && (
                    <span
                      className={cn("flex items-center gap-1 text-xs font-medium", complianceMeta.className)}
                      title={complianceMeta.label}
                    >
                      <complianceMeta.icon className="w-3.5 h-3.5" />
                      {complianceMeta.label}
                    </span>
                  )}
                  <Badge variant="outline" className={statusColor}>
                    {statusLabel}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
