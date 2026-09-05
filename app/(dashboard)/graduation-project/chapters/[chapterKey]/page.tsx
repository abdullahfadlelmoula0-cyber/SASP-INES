"use client";

import { useEffect, useState, useTransition, type ElementType } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  PenLine,
  FileText,
  History,
  RotateCcw,
  Download,
  Trash2,
  X,
  AlertCircle,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMyGraduationProject } from "@/lib/graduation/actions";
import {
  getChapter,
  saveChapterDraft,
  commitChapterVersion,
  attachChapterFile,
  getChapterVersions,
  restoreChapterVersion,
  deleteChapterVersion,
  getChapterFormattingChecklist,
  recheckChapterCompliance,
} from "@/lib/chapters/actions";
import { CHAPTER_CATALOG } from "@/lib/chapters/catalog";
import { uploadChapterFileClient, getChapterFileSignedUrl } from "@/lib/chapters/file-uploads-client";
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

export default function ChapterEditorPage({
  params,
}: {
  params: { chapterKey: string };
}) {
  const { chapterKey } = params;
  const slot = CHAPTER_CATALOG.find((c) => c.key === chapterKey);

  const [project, setProject] = useState<GraduationProject | null>(null);
  const [chapter, setChapter] = useState<DissertationChapter | null>(null);
  const [versions, setVersions] = useState<ChapterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [mode, setMode] = useState<"write" | "upload">("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<"draft" | "version" | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [viewingVersion, setViewingVersion] = useState<ChapterVersion | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [formattingChecklist, setFormattingChecklist] = useState<string[]>([]);
  const [rechecking, setRechecking] = useState(false);
  const [openFindingIndex, setOpenFindingIndex] = useState<number | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<ChapterVersion | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);

  async function loadEverything() {
    setLoading(true);
    const projectRes = await getMyGraduationProject();
    if (!projectRes.data) {
      setPageError("You don't have a graduation project yet.");
      setLoading(false);
      return;
    }
    if (projectRes.data.status !== "active") {
      setPageError("Chapters can only be written once a supervisor has accepted your project.");
      setLoading(false);
      return;
    }
    setProject(projectRes.data);

    const chapterRes = await getChapter(projectRes.data.id, chapterKey);
    if (chapterRes.data) {
      setChapter(chapterRes.data);
      setTitle(chapterRes.data.title ?? slot?.title ?? "");
      setContent(chapterRes.data.content ?? "");
      setMode(chapterRes.data.file_url ? "upload" : "write");

      const versionsRes = await getChapterVersions(chapterRes.data.id);
      setVersions(versionsRes.data);
    } else {
      setTitle(slot?.title ?? "");
    }

    const checklistRes = await getChapterFormattingChecklist(chapterKey);
    setFormattingChecklist(checklistRes.data);

    setLoading(false);
  }

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey]);

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
        <Link href="/graduation-project/chapters">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Chapters
          </Button>
        </Link>
      </div>
    );
  }

  function handleSaveDraft() {
    if (!project) return;
    setSaving("draft");
    startTransition(async () => {
      const res = await saveChapterDraft({
        projectId: project.id,
        chapterKey,
        title,
        content,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setSaving(null);
        return;
      }
      toast({ title: "Draft saved" });
      setSaving(null);
      await loadEverything();
    });
  }

  function handleSaveVersion() {
    if (!project) return;
    if (!content.trim()) {
      toast({ title: "Write something before saving a version", variant: "destructive" });
      return;
    }
    setSaving("version");
    startTransition(async () => {
      const res = await commitChapterVersion({
        projectId: project.id,
        chapterKey,
        title,
        content,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setSaving(null);
        return;
      }
      toast({
        title: `Saved as version ${res.data?.version.version_number}`,
        description: "This checkpoint is now in your version history.",
      });
      setSaving(null);
      await loadEverything();
    });
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
  }

  function handleUploadAndSave() {
    if (!project || !pendingFile) return;
    setUploadingFile(true);
    startTransition(async () => {
      const uploadRes = await uploadChapterFileClient(project.id, chapterKey, pendingFile);
      if (!uploadRes.success || !uploadRes.path) {
        toast({ title: "Upload failed", description: uploadRes.error, variant: "destructive" });
        setUploadingFile(false);
        return;
      }

      const attachRes = await attachChapterFile({
        projectId: project.id,
        chapterKey,
        title,
        fileUrl: uploadRes.path,
      });
      if (attachRes.error) {
        toast({ title: "Error", description: attachRes.error, variant: "destructive" });
        setUploadingFile(false);
        return;
      }

      toast({
        title: `Saved as version ${attachRes.data?.version.version_number}`,
        description: "Your file has been uploaded and saved to version history.",
      });
      setPendingFile(null);
      setUploadingFile(false);
      await loadEverything();
    });
  }

  async function handleDownload(path: string) {
    setDownloadingPath(path);
    const res = await getChapterFileSignedUrl(path);
    setDownloadingPath(null);
    if (res.error || !res.url) {
      toast({ title: "Error", description: res.error ?? "Could not generate download link.", variant: "destructive" });
      return;
    }
    window.open(res.url, "_blank");
  }

  function handleRestore(versionId: string) {
    if (!project || !chapter) return;
    setRestoringVersionId(versionId);
    startTransition(async () => {
      const res = await restoreChapterVersion({
        projectId: project.id,
        chapterId: chapter.id,
        versionId,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setRestoringVersionId(null);
        return;
      }
      toast({
        title: "Version restored",
        description: `This is now version ${res.data?.version.version_number}.`,
      });
      setRestoringVersionId(null);
      await loadEverything();
    });
  }

  function handleRecheck() {
    if (!project) return;
    setRechecking(true);
    startTransition(async () => {
      const res = await recheckChapterCompliance({ projectId: project.id, chapterKey });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setRechecking(false);
        return;
      }
      toast({
        title: "Re-check complete",
        description: "Your compliance report has been updated.",
      });
      setRechecking(false);
      setOpenFindingIndex(null);
      await loadEverything();
    });
  }

  function handleDeleteVersion() {
    if (!project || !chapter || !versionToDelete) return;
    setDeletingVersionId(versionToDelete.id);
    startTransition(async () => {
      const res = await deleteChapterVersion({
        projectId: project.id,
        chapterId: chapter.id,
        versionId: versionToDelete.id,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setDeletingVersionId(null);
        return;
      }
      toast({
        title: "Version deleted",
        description: `Version ${versionToDelete.version_number} has been permanently removed.`,
      });
      setDeletingVersionId(null);
      setVersionToDelete(null);
      await loadEverything();
    });
  }

  const savedFileName = chapter?.file_url ? chapter.file_url.split("/").pop() : null;

  // Latest saved version is always versions[0] (query orders by
  // version_number desc). Its compliance_report (merged in by
  // getChapterVersions) is what "the latest compliance report" means.
  const latestVersion = versions[0] ?? null;
  const latestReport = latestVersion?.compliance_report ?? null;
  const latestVersionWasUploaded = !!latestVersion?.file_url_snapshot;

  const statusMeta: Record<
    "compliant" | "needs_review" | "non_compliant",
    { label: string; icon: ElementType; className: string }
  > = {
    compliant: {
      label: "Compliant",
      icon: CheckCircle2,
      className: "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/30",
    },
    needs_review: {
      label: "Needs Review",
      icon: AlertTriangle,
      className: "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/30",
    },
    non_compliant: {
      label: "Non-Compliant",
      icon: XCircle,
      className: "text-rose-600 border-rose-300 bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:bg-rose-950/30",
    },
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-1 -mb-2">
        <Link href="/graduation-project/chapters">
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
            ? `Currently at version ${chapter.current_version_number}.`
            : "Not started yet — write or upload to create the first version."
        }
      />

      {/* ── AI Compliance Report (latest version) ──────────────────── */}
      {latestVersion && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">AI Compliance Report</p>
              <span className="text-xs text-muted-foreground">
                (v{latestVersion.version_number})
              </span>
            </div>
            {!latestVersionWasUploaded && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isPending || rechecking}
                onClick={handleRecheck}
              >
                {rechecking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ClipboardList className="w-3.5 h-3.5" />
                )}
                Re-check
              </Button>
            )}
          </div>

          {latestVersionWasUploaded ? (
            <p className="text-sm text-muted-foreground">
              This version was uploaded as a file, so the AI compliance check — which reads
              plain text — doesn't apply to it. Write this chapter directly in the system to
              get a compliance report.
            </p>
          ) : !latestReport ? (
            <p className="text-sm text-muted-foreground">
              No report yet for this version — it may still be running, or the check didn't
              complete. Try Re-check above.
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
                      <div
                        key={idx}
                        className="rounded-lg border border-border overflow-hidden"
                      >
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Formatting Checklist (check manually)
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            <button
              type="button"
              onClick={() => setMode("write")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                mode === "write" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              <PenLine className="w-3.5 h-3.5" />
              Write in System
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                mode === "upload" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload File
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="chapter-title">Chapter Title</Label>
              <Input id="chapter-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {mode === "write" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="chapter-content">Content</Label>
                  <textarea
                    id="chapter-content"
                    rows={18}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
                    placeholder="Start writing this chapter…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={isPending || saving !== null}
                    onClick={handleSaveDraft}
                  >
                    {saving === "draft" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Draft
                  </Button>
                  <Button
                    className="gap-2"
                    disabled={isPending || saving !== null || !content.trim()}
                    onClick={handleSaveVersion}
                  >
                    {saving === "version" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Save as New Version
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  "Save Draft" keeps your progress without creating a new version. "Save as New
                  Version" creates a permanent checkpoint in your history.
                </p>
              </>
            ) : (
              <div className="space-y-4">
                {savedFileName && !pendingFile && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm truncate">{savedFileName}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      disabled={downloadingPath === chapter?.file_url}
                      onClick={() => chapter?.file_url && handleDownload(chapter.file_url)}
                    >
                      {downloadingPath === chapter?.file_url ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download current file
                    </Button>
                  </div>
                )}

                {pendingFile ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm truncate">{pendingFile.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({Math.round(pendingFile.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingFile(null)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to select a Word or PDF file
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".doc,.docx,.pdf"
                      onChange={handleFileSelected}
                      className="hidden"
                    />
                  </label>
                )}

                <Button
                  className="gap-2"
                  disabled={isPending || uploadingFile || !pendingFile}
                  onClick={handleUploadAndSave}
                >
                  {uploadingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload & Save as New Version
                </Button>
                <p className="text-xs text-muted-foreground">
                  Uploading a file replaces any content written in the system for this chapter,
                  and is saved directly as a new version.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Version history column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Version History</p>
          </div>
          {versions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">
                No versions saved yet. Your first "Save as New Version" will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      v{v.version_number}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(v.created_at)}
                    </span>
                  </div>
                  {v.editor?.full_name && (
                    <p className="text-xs text-muted-foreground">by {v.editor.full_name}</p>
                  )}
                  <div className="flex items-center gap-1.5">
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
                    {chapter && v.version_number !== chapter.current_version_number && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1"
                          disabled={isPending || restoringVersionId === v.id}
                          onClick={() => handleRestore(v.id)}
                        >
                          {restoringVersionId === v.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isPending || deletingVersionId === v.id}
                          onClick={() => setVersionToDelete(v)}
                        >
                          {deletingVersionId === v.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
      {/* Delete version confirmation */}
      <Dialog open={!!versionToDelete} onOpenChange={(o) => !o && !deletingVersionId && setVersionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete version {versionToDelete?.version_number}?</DialogTitle>
            <DialogDescription>
              This permanently deletes this version and its compliance report. This can't be
              undone. Your current version is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVersionToDelete(null)}
              disabled={!!deletingVersionId}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteVersion}
              disabled={!!deletingVersionId}
              className="gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deletingVersionId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
