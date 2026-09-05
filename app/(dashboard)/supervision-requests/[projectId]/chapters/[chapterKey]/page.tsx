"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  History,
  Download,
  AlertCircle,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import { getProjectForSupervisorView } from "@/lib/graduation/actions";
import { getChapter, getChapterVersions, getChapterFormattingChecklist } from "@/lib/chapters/actions";
import { getChapterFileSignedUrl } from "@/lib/chapters/file-uploads-client";
import { CHAPTER_CATALOG } from "@/lib/chapters/catalog";
import type { ChapterVersion, DissertationChapter, GraduationProject } from "@/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const statusMeta = {
  compliant: {
    label: "Compliant",
    icon: CheckCircle2,
    className:
      "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30",
  },
  needs_review: {
    label: "Needs Review",
    icon: AlertTriangle,
    className:
      "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/30",
  },
  non_compliant: {
    label: "Non-Compliant",
    icon: XCircle,
    className:
      "text-rose-600 border-rose-300 bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:bg-rose-950/30",
  },
} as const;

/**
 * Read-only detail view for the SUPERVISOR — no write actions exist
 * anywhere on this page: no editor, no upload, no Save/Restore/Delete/
 * Re-check. Reuses the exact same student-facing actions
 * (getChapter, getChapterVersions, getChapterFormattingChecklist) —
 * all already scoped correctly by RLS for a supervisor's own
 * supervisees, with zero backend changes needed for this page.
 */
export default function SupervisorChapterDetailPage({
  params,
}: {
  params: { projectId: string; chapterKey: string };
}) {
  const { projectId, chapterKey } = params;
  const slot = CHAPTER_CATALOG.find((c) => c.key === chapterKey);

  const [project, setProject] = useState<GraduationProject | null>(null);
  const [chapter, setChapter] = useState<DissertationChapter | null>(null);
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [formattingChecklist, setFormattingChecklist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [viewingVersion, setViewingVersion] = useState<ChapterVersion | null>(null);
  const [openFindingIndex, setOpenFindingIndex] = useState<number | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const projectRes = await getProjectForSupervisorView(projectId);
      if (!projectRes.data) {
        setPageError(projectRes.error ?? "Project not found.");
        setLoading(false);
        return;
      }
      setProject(projectRes.data);

      const chapterRes = await getChapter(projectId, chapterKey);
      if (chapterRes.data) {
        setChapter(chapterRes.data);
        const versionsRes = await getChapterVersions(chapterRes.data.id);
        setVersions(versionsRes.data);
      }

      const checklistRes = await getChapterFormattingChecklist(chapterKey);
      setFormattingChecklist(checklistRes.data);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chapterKey]);

  async function handleDownload(path: string) {
    setDownloadingPath(path);
    const res = await getChapterFileSignedUrl(path);
    setDownloadingPath(null);
    if (res.url) window.open(res.url, "_blank");
  }

  if (!slot) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Chapter not found" />
      </div>
    );
  }

  if (loading) return <LoadingSpinner />;

  if (pageError || !project) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title={slot.title} />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm">{pageError}</p>
        </div>
        <Link href={`/supervision-requests/${projectId}/chapters`}>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Chapters
          </Button>
        </Link>
      </div>
    );
  }

  const student = project.student as any;
  const latestVersion = versions[0] ?? null;
  const latestReport = latestVersion?.compliance_report ?? null;
  const latestVersionWasUploaded = !!latestVersion?.file_url_snapshot;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-1 -mb-2">
        <Link href={`/supervision-requests/${projectId}/chapters`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Chapters
          </Button>
        </Link>
      </div>
      <PageHeader
        title={slot.title}
        description={
          chapter
            ? `${student?.full_name ?? "Student"} · currently at version ${chapter.current_version_number}.`
            : `${student?.full_name ?? "Student"} hasn't started this chapter yet.`
        }
      />

      {!chapter ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This chapter hasn't been started yet — nothing to review.
          </p>
        </div>
      ) : (
        <>
          {/* ── AI Compliance Report (latest version) ────────────── */}
          {latestVersion && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">AI Compliance Report</p>
                <span className="text-xs text-muted-foreground">(v{latestVersion.version_number})</span>
              </div>

              {latestVersionWasUploaded ? (
                <p className="text-sm text-muted-foreground">
                  This version was uploaded as a file, so the AI compliance check doesn't apply to it.
                </p>
              ) : !latestReport ? (
                <p className="text-sm text-muted-foreground">
                  No compliance report available for this version yet.
                </p>
              ) : (
                <>
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium w-fit",
                      statusMeta[latestReport.status].className
                    )}
                  >
                    {(() => {
                      const StatusIcon = statusMeta[latestReport.status].icon;
                      return <StatusIcon className="w-4 h-4" />;
                    })()}
                    {statusMeta[latestReport.status].label}
                  </div>

                  {latestReport.findings.length > 0 && (
                    <div className="space-y-1.5">
                      {latestReport.findings.map((finding, idx) => {
                        const isOpen = openFindingIndex === idx;
                        return (
                          <div key={idx} className="rounded-lg border border-border overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setOpenFindingIndex(isOpen ? null : idx)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                            >
                              {finding.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <XCircle
                                  className={cn(
                                    "w-4 h-4 shrink-0",
                                    finding.severity === "high"
                                      ? "text-rose-600 dark:text-rose-400"
                                      : finding.severity === "medium"
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-muted-foreground"
                                  )}
                                />
                              )}
                              <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                                {finding.rule_category}
                              </Badge>
                              {!finding.passed && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] capitalize shrink-0",
                                    finding.severity === "high"
                                      ? "text-rose-600 border-rose-300 dark:text-rose-400 dark:border-rose-700"
                                      : finding.severity === "medium"
                                        ? "text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                                        : "text-muted-foreground"
                                  )}
                                >
                                  {finding.severity}
                                </Badge>
                              )}
                              <span className="text-sm text-foreground truncate flex-1">
                                {finding.rule_text}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 pt-0.5 space-y-2 border-t border-border bg-muted/20">
                                <p className="text-xs text-muted-foreground pt-2">
                                  <span className="font-medium text-foreground">Rule: </span>
                                  {finding.rule_text}
                                </p>
                                <p className="text-xs text-foreground">{finding.explanation}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {formattingChecklist.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Formatting Checklist (not AI-verified)
                  </p>
                  <ul className="space-y-1.5">
                    {formattingChecklist.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/60 shrink-0" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ── Current content ───────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-foreground">{chapter.title ?? slot.title}</p>
            {chapter.file_url ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={downloadingPath === chapter.file_url}
                onClick={() => handleDownload(chapter.file_url!)}
              >
                {downloadingPath === chapter.file_url ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Download current file
              </Button>
            ) : (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                {chapter.content || <span className="text-muted-foreground">No content.</span>}
              </div>
            )}
          </div>

          {/* ── Version history (read-only) ──────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Version History</p>
            </div>
            {versions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center">
                <p className="text-xs text-muted-foreground">No versions saved yet.</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {versions.map((v) => (
                  <div key={v.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs">
                        v{v.version_number}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</span>
                    </div>
                    {v.editor?.full_name && (
                      <p className="text-xs text-muted-foreground">by {v.editor.full_name}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 gap-1"
                      onClick={() =>
                        v.file_url_snapshot ? handleDownload(v.file_url_snapshot) : setViewingVersion(v)
                      }
                    >
                      {v.file_url_snapshot ? (
                        <Download className="w-3 h-3" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      {v.file_url_snapshot ? "Download" : "View"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* View (read-only) version content dialog */}
      <Dialog open={!!viewingVersion} onOpenChange={(o) => !o && setViewingVersion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version {viewingVersion?.version_number}</DialogTitle>
            <DialogDescription>
              {viewingVersion && formatDateTime(viewingVersion.created_at)}
              {viewingVersion?.editor?.full_name && ` · by ${viewingVersion.editor.full_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap font-mono">
            {viewingVersion?.content_snapshot}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingVersion(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
