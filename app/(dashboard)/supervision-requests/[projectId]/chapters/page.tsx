"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
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
import { getProjectForSupervisorView } from "@/lib/graduation/actions";
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

/**
 * Read-only mirror of /graduation-project/chapters for the SUPERVISOR
 * side. Deliberately no write actions anywhere on this page or its
 * [chapterKey] detail route — a lecturer can view a student's chapters
 * and their AI compliance reports, never edit, upload, restore,
 * delete, or re-check. RLS (*_supervisor_select policies) already
 * scopes every read here to projects this lecturer actually supervises.
 */
export default function SupervisorChaptersOverviewPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId } = params;

  const [project, setProject] = useState<GraduationProject | null>(null);
  const [chapters, setChapters] = useState<DissertationChapter[]>([]);
  const [complianceByKey, setComplianceByKey] = useState<
    Record<string, "compliant" | "needs_review" | "non_compliant">
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const projectRes = await getProjectForSupervisorView(projectId);
      if (!projectRes.data) {
        setError(projectRes.error ?? "Project not found.");
        setLoading(false);
        return;
      }
      setProject(projectRes.data);

      const [chaptersRes, complianceRes] = await Promise.all([
        getProjectChapters(projectId),
        getChaptersComplianceOverview(projectId),
      ]);
      setChapters(chaptersRes.data);
      setComplianceByKey(complianceRes.data);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) return <LoadingSpinner />;

  if (error || !project) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Chapters" />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
        <Link href="/supervision-requests">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Supervision Requests
          </Button>
        </Link>
      </div>
    );
  }

  const student = project.student as any;
  const chapterByKey = new Map(chapters.map((c) => [c.chapter_key, c]));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1 -mb-2">
        <Link href="/supervision-requests">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </Button>
        </Link>
      </div>
      <PageHeader
        title={`${student?.full_name ?? "Student"}'s Chapters`}
        description={project.topic_title ?? "Graduation project chapters and AI compliance reports."}
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
            <Link
              key={slot.key}
              href={`/supervision-requests/${projectId}/chapters/${slot.key}`}
              className="block"
            >
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
