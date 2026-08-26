"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import {
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Sparkles,
  RefreshCw,
  Loader2,
  Trophy,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  getMyGraduationProject,
  getStudentDepartmentId,
  getLecturersForDepartment,
  startGraduationProject,
  updateInterestStatement,
  generateTopicSuggestions,
  selectTopic,
  restartTopicSelection,
  cancelTopicRestart,
  chooseSupervisor,
  chooseDifferentSupervisor,
  resendToSameSupervisor,
  getProjectReviews,
  updateTopic,
  previewTopicSimilarity,
  refreshSupervisorCapacitySnapshot,
} from "@/lib/graduation/actions";
import type {
  AiTopicCandidate,
  GraduationProject,
  GraduationProjectReview,
  SimilarProjectMatch,
  UserProfile,
} from "@/types";

// ── Local types ───────────────────────────────────────────────────

type LecturerProfile = Pick<
  UserProfile,
  "id" | "full_name" | "expertise_areas" | "university_email"
>;

// ── Similarity results (shared across all three entry points) ──────

function categorize(score: number): { label: string; className: string } {
  if (score >= 0.6) {
    return {
      label: "Very similar",
      className:
        "text-rose-600 border-rose-300 bg-rose-50 dark:text-rose-400 dark:border-rose-700 dark:bg-rose-950/40",
    };
  }
  if (score >= 0.35) {
    return {
      label: "Partially similar",
      className:
        "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/40",
    };
  }
  return {
    label: "Loosely related",
    className:
      "text-slate-600 border-slate-300 bg-slate-50 dark:text-slate-400 dark:border-slate-700 dark:bg-slate-900/40",
  };
}

function SimilarityResults({ matches }: { matches: SimilarProjectMatch[] }) {
  if (matches.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        No similar graduation projects found. Your topic looks distinct.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {matches.length} similar project{matches.length > 1 ? "s" : ""} found. Consider refining
        your topic to make it more distinct.
      </div>
      <div className="space-y-2">
        {matches.map((m) => {
          const cat = categorize(m.similarity_score);
          return (
            <div
              key={m.project_id}
              className={cn("rounded-lg border p-3", cat.className)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm text-foreground">{m.topic_title}</p>
                <Badge variant="outline" className={cn("shrink-0 text-xs", cat.className)}>
                  {cat.label} · {Math.round(m.similarity_score * 100)}%
                </Badge>
              </div>
              {m.topic_description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {m.topic_description}
                </p>
              )}
              {/* AI explanation (best-effort — only shown when Gemini's
                  analysis succeeded; the trigram score/label above is
                  always shown regardless of whether this is present). */}
              {m.explanation && (
                <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-current/10">
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                  <p className="text-xs italic opacity-90">
                    {m.is_meaningfully_similar === false && (
                      <span className="font-medium not-italic">Likely not a concern — </span>
                    )}
                    {m.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Supervisor card (used for both AI-suggested and fallback roster) ──

function SupervisorCard({
  rank,
  fullName,
  email,
  expertiseAres,
  matchedKeywords,
  matchScore,
  currentStudents,
  maxCapacity,
  availableSlots,
  isPending,
  disabled,
  onSelect,
  ctaLabel = "Request Supervision",
  infoOnly = false,
}: {
  rank?: number;
  fullName: string;
  email: string | null;
  expertiseAres: string[] | null;
  matchedKeywords?: string[];
  matchScore?: number;
  /** Supervision Capacity Management — all optional: undefined means
   *  "capacity unknown" (e.g. legacy cached matches), never "full". */
  currentStudents?: number;
  maxCapacity?: number;
  availableSlots?: number;
  isPending: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  ctaLabel?: string;
  /** Info-only card: no CTA button at all — used for lecturers who
   *  matched the topic but are at capacity, shown purely so the
   *  student knows they exist without being able to request them. */
  infoOnly?: boolean;
}) {
  const matchedSet = new Set(matchedKeywords ?? []);
  const hasCapacityInfo = typeof currentStudents === "number" && typeof maxCapacity === "number";
  const isFull = hasCapacityInfo && (availableSlots ?? 0) <= 0;

  return (
    <div className={cn("group rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200", infoOnly && "opacity-75")}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-primary">
            {fullName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground truncate">{fullName}</p>
            {rank && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] px-1.5 py-0 leading-4 text-primary border-primary/30"
              >
                #{rank} match
              </Badge>
            )}
          </div>
          {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </div>
      </div>

      {typeof matchScore === "number" && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.min(100, Math.round(matchScore * 100))}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {Math.round(matchScore * 100)}% match
          </span>
        </div>
      )}

      {hasCapacityInfo && (
        <div className="flex items-center gap-1.5 mb-3 text-xs">
          <span className="text-muted-foreground">
            Students: {currentStudents}/{maxCapacity}
          </span>
          <span
            className={cn(
              "font-medium",
              isFull
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {isFull
              ? "\ud83d\udd34 FULL"
              : `\ud83d\udfe2 ${availableSlots} slot${availableSlots === 1 ? "" : "s"} available`}
          </span>
        </div>
      )}

      {(expertiseAres ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {(expertiseAres ?? []).map((area) => (
            <Badge
              key={area}
              variant={matchedSet.has(area) ? "default" : "secondary"}
              className="text-xs font-normal"
            >
              {area}
            </Badge>
          ))}
        </div>
      )}

      {infoOnly ? (
        <div className="w-full rounded-md border border-dashed border-border py-2 text-center text-xs font-medium text-muted-foreground">
          At maximum capacity — not requestable right now
        </div>
      ) : (
        <Button
          size="sm"
          className="w-full gap-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          variant="outline"
          disabled={isPending || disabled || isFull}
          onClick={onSelect}
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}

// ── Supervision history (shown on every status once ≥1 review exists) ──
// Reviews live in graduation_project_reviews, keyed only by project_id —
// they persist across topic restarts, so this stays the single source
// of truth for "who rejected/accepted, for which topic, and why" no
// matter how many times the student goes back to choose a new topic.

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SupervisionHistoryPanel({ reviews }: { reviews: GraduationProjectReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Supervision History
      </p>
      <div className="space-y-3">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-3 last:pb-0"
          >
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 text-xs mt-0.5",
                review.decision === "rejected"
                  ? "text-rose-600 border-rose-300 dark:text-rose-400 dark:border-rose-700"
                  : "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700"
              )}
            >
              {review.decision === "rejected" ? "Declined" : "Accepted"}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-foreground">
                <span className="font-medium">
                  {(review.supervisor as any)?.full_name ?? "Supervisor"}
                </span>
                {review.topic_title_snapshot && (
                  <span className="text-muted-foreground">
                    {" "}
                    — for “{review.topic_title_snapshot}”
                  </span>
                )}
              </p>
              {review.comments && (
                <p className="text-muted-foreground mt-0.5">“{review.comments}”</p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {formatReviewDate(review.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function GraduationProjectPage() {
  const [project, setProject] = useState<GraduationProject | null>(null);
  const [lecturers, setLecturers] = useState<LecturerProfile[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<GraduationProjectReview[]>([]);

  const [loading, setLoading] = useState(true);
  const [lecturersLoading, setLecturersLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [interestStatement, setInterestStatement] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // 'choosing_topic' (Step 4 — AI topic generation) state
  const [generatingTopics, setGeneratingTopics] = useState(false);
  const [topicGenError, setTopicGenError] = useState<string | null>(null);
  const [writingOwnTopic, setWritingOwnTopic] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [selectingTopic, setSelectingTopic] = useState(false);

  // 'choosing_topic' — editable area-of-interest state
  const [editingInterest, setEditingInterest] = useState(false);
  const [editInterestText, setEditInterestText] = useState("");
  const [savingInterest, setSavingInterest] = useState(false);

  // 'choosing_supervisor' inline topic-edit state
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicDescription, setEditTopicDescription] = useState("");
  const [restartingTopic, setRestartingTopic] = useState(false);
  const [cancelingRestart, setCancelingRestart] = useState(false);

  // Rejection-response state (editable proposal + "choose different" toggle)
  const [revisedTitle, setRevisedTitle] = useState("");
  const [revisedDescription, setRevisedDescription] = useState("");
  const [showSwitchPicker, setShowSwitchPicker] = useState(false);
  const [revisionInitializedFor, setRevisionInitializedFor] = useState<string | null>(null);
  const [reviseMatches, setReviseMatches] = useState<SimilarProjectMatch[] | null>(null);
  const [reviseChecking, setReviseChecking] = useState(false);

  // ── Initial load ──────────────────────────────────────────────

  async function loadProject() {
    setLoading(true);
    const [projectRes, deptRes] = await Promise.all([
      getMyGraduationProject(),
      getStudentDepartmentId(),
    ]);

    if (projectRes.data) {
      setProject(projectRes.data);
      const reviewsRes = await getProjectReviews(projectRes.data.id);
      setReviews(reviewsRes.data);
    }
    if (deptRes.departmentId) {
      setDepartmentId(deptRes.departmentId);
    } else {
      setDeptError(deptRes.error);
    }
    setLoading(false);
  }

  async function loadLecturers(deptId: string) {
    setLecturersLoading(true);
    const res = await getLecturersForDepartment(deptId);
    setLecturers(res.data);
    setLecturersLoading(false);
  }

  useEffect(() => {
    loadProject();
  }, []);

  // Load the FULL department roster only as a fallback — mirrors the
  // backend's own rule (chooseSupervisor / chooseDifferentSupervisor skip
  // the Top-3 restriction only when ai_suggested_lecturers is empty, i.e.
  // legacy projects created before matching existed). When AI suggestions
  // ARE present, the picker renders directly from project.ai_suggested_lecturers
  // and this fetch is skipped entirely.
  useEffect(() => {
    if (!departmentId) return;
    const suggestedCount = project?.ai_suggested_lecturers?.length ?? 0;
    const needsFallbackRoster =
      !project ||
      (project.status === "choosing_supervisor" && suggestedCount === 0) ||
      (project.status === "rejected_by_supervisor" && showSwitchPicker && suggestedCount === 0);
    if (needsFallbackRoster) {
      loadLecturers(departmentId);
    }
  }, [departmentId, project, showSwitchPicker]);

  // Refresh live capacity numbers on the cached suggested/full-capacity
  // lecturer lists every time a picker screen becomes visible — closes
  // the gap where a lecturer filled up AFTER matching last ran (e.g.
  // another student was accepted moments earlier) but the cached
  // snapshot still showed them as available, which would otherwise let
  // the button stay clickable and a request be attempted against them.
  useEffect(() => {
    if (!project) return;
    const onPickerScreen =
      project.status === "choosing_supervisor" ||
      (project.status === "rejected_by_supervisor" && showSwitchPicker);
    if (!onPickerScreen) return;

    let cancelled = false;
    refreshSupervisorCapacitySnapshot(project.id).then((res) => {
      if (cancelled || !res.data) return;
      setProject(res.data);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on project.id + status/showSwitchPicker only —
    // NOT on `project` itself, since this effect's own setProject() call
    // would otherwise retrigger it in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.status, showSwitchPicker]);

  // Pre-fill the revision form with the current topic each time a NEW
  // rejection comes in (keyed on updated_at so a second rejection on
  // the same project resets the draft to the latest topic again).
  useEffect(() => {
    if (project?.status === "rejected_by_supervisor") {
      const key = `${project.id}:${project.updated_at}`;
      if (revisionInitializedFor !== key) {
        setRevisedTitle(project.topic_title ?? "");
        setRevisedDescription(project.topic_description ?? "");
        setShowSwitchPicker(false);
        setReviseMatches(null);
        setRevisionInitializedFor(key);
      }
    }
  }, [project, revisionInitializedFor]);

  // ── Handlers ──────────────────────────────────────────────────

  function handleStartAndGenerate() {
    if (!interestStatement.trim()) {
      toast({ title: "Describe your area of interest first", variant: "destructive" });
      return;
    }
    setFormError(null);
    setGeneratingTopics(true);
    startTransition(async () => {
      const startRes = await startGraduationProject(interestStatement);
      if (startRes.error || !startRes.data) {
        setFormError(startRes.error ?? "Failed to start your graduation project.");
        setGeneratingTopics(false);
        return;
      }
      const genRes = await generateTopicSuggestions(startRes.data.id);
      if (genRes.error) {
        // Non-fatal: the project now exists in 'choosing_topic' with no
        // suggestions yet — the next screen still offers "write my own"
        // and a manual "Generate 3 Topics" retry button.
        setTopicGenError(genRes.error);
      }
      setGeneratingTopics(false);
      await loadProject();
    });
  }

  function handleRegenerateTopics() {
    if (!project) return;
    setTopicGenError(null);
    setGeneratingTopics(true);
    startTransition(async () => {
      const res = await generateTopicSuggestions(project.id);
      if (res.error) {
        setTopicGenError(res.error);
      }
      setGeneratingTopics(false);
      await loadProject();
    });
  }

  function handleSaveInterestAndRegenerate() {
    if (!project) return;
    if (!editInterestText.trim()) {
      toast({ title: "Describe your area of interest first", variant: "destructive" });
      return;
    }
    setSavingInterest(true);
    setTopicGenError(null);
    startTransition(async () => {
      const updateRes = await updateInterestStatement(project.id, editInterestText);
      if (updateRes.error) {
        toast({ title: "Error", description: updateRes.error, variant: "destructive" });
        setSavingInterest(false);
        return;
      }
      setEditingInterest(false);
      setSavingInterest(false);

      setGeneratingTopics(true);
      const genRes = await generateTopicSuggestions(project.id);
      if (genRes.error) {
        // Non-fatal — same pattern as the initial generation: "write my
        // own topic" stays available regardless.
        setTopicGenError(genRes.error);
      }
      setGeneratingTopics(false);
      await loadProject();
    });
  }

  function handleSelectAiTopic(candidate: AiTopicCandidate) {
    if (!project) return;
    setSelectingTopic(true);
    startTransition(async () => {
      const res = await selectTopic({
        projectId: project.id,
        topicTitle: candidate.title,
        topicDescription: candidate.description,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setSelectingTopic(false);
        return;
      }
      toast({ title: "Topic selected!", description: "Now choose your supervisor." });
      setSelectingTopic(false);
      await loadProject();
    });
  }

  function handleSubmitManualTopic() {
    if (!project) return;
    if (!manualTitle.trim()) {
      toast({ title: "Topic title required", variant: "destructive" });
      return;
    }
    setSelectingTopic(true);
    startTransition(async () => {
      const res = await selectTopic({
        projectId: project.id,
        topicTitle: manualTitle,
        topicDescription: manualDescription,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setSelectingTopic(false);
        return;
      }
      toast({ title: "Topic saved!", description: "Now choose your supervisor." });
      setSelectingTopic(false);
      await loadProject();
    });
  }

  function handleSaveTopicEdit() {
    if (!project) return;
    if (!editTopicTitle.trim()) {
      toast({ title: "Topic title required", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await updateTopic({
        projectId: project.id,
        topicTitle: editTopicTitle,
        topicDescription: editTopicDescription,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Topic updated", description: "Similarity check refreshed." });
      setEditingTopic(false);
      await loadProject();
    });
  }

  function handleRestartTopicSelection() {
    if (!project) return;
    setRestartingTopic(true);
    startTransition(async () => {
      const res = await restartTopicSelection(project.id);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setRestartingTopic(false);
        return;
      }
      setRestartingTopic(false);
      await loadProject();
    });
  }

  function handleCancelTopicRestart() {
    if (!project) return;
    setCancelingRestart(true);
    startTransition(async () => {
      const res = await cancelTopicRestart(project.id);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setCancelingRestart(false);
        return;
      }
      setCancelingRestart(false);
      await loadProject();
    });
  }

  function handleCheckReviseSimilarity() {
    if (!project || !revisedTitle.trim()) {
      toast({ title: "Enter a topic title first", variant: "destructive" });
      return;
    }
    setReviseChecking(true);
    startTransition(async () => {
      const res = await previewTopicSimilarity({
        topicTitle: revisedTitle,
        topicDescription: revisedDescription,
        excludeProjectId: project.id,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        setReviseMatches(res.similarProjects ?? []);
      }
      setReviseChecking(false);
    });
  }

  function handleChooseSupervisor(supervisorId: string) {
    if (!project) return;
    startTransition(async () => {
      const res = await chooseSupervisor({ projectId: project.id, supervisorId });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Request sent!",
        description: "Your supervisor request has been sent. You'll be notified of their response.",
      });
      await loadProject();
    });
  }

  function handleResendSame() {
    if (!project) return;
    if (!revisedTitle.trim()) {
      toast({ title: "Topic title required", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await resendToSameSupervisor({
        projectId: project.id,
        topicTitle: revisedTitle,
        topicDescription: revisedDescription,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Revised proposal sent!",
        description: "Your supervisor will review the updated proposal.",
      });
      await loadProject();
    });
  }

  function handleSwitchSupervisor(supervisorId: string) {
    if (!project) return;
    if (!revisedTitle.trim()) {
      toast({ title: "Topic title required", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const res = await chooseDifferentSupervisor({
        projectId: project.id,
        supervisorId,
        topicTitle: revisedTitle,
        topicDescription: revisedDescription,
      });
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Request sent!",
        description: "Your supervisor request has been sent. You'll be notified of their response.",
      });
      await loadProject();
    });
  }

  // ── Loading state ─────────────────────────────────────────────

  if (loading) return <LoadingSpinner />;

  // ── Render helpers ────────────────────────────────────────────

  const StatusBanner = ({
    icon: Icon,
    color,
    title,
    description,
  }: {
    icon: React.ElementType;
    color: string;
    title: string;
    description: string;
  }) => (
    <div className={cn("flex items-start gap-4 rounded-2xl p-5 border", color)}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-current/10">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-base">{title}</p>
        <p className="text-sm mt-0.5 opacity-80">{description}</p>
      </div>
    </div>
  );

  // ── Department error ──────────────────────────────────────────

  if (deptError && !project) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Graduation Project"
          description="Start your graduation project journey."
        />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Profile setup required</p>
            <p className="text-sm mt-1">{deptError}</p>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: No project yet → Step 4: Screen 1 — interest statement only
  // ────────────────────────────────────────────────────────────────

  if (!project) {
    return (
      <div className="space-y-8 max-w-2xl">
        <PageHeader
          title="Graduation Project"
          description="Tell us about your area of interest."
        />

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-base">Tell us about your area of interest</h2>
              <p className="text-xs text-muted-foreground">
                We'll use AI to suggest 3 graduation project topics for you.
              </p>
            </div>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="interest-statement">Are of Interest *</Label>
            <textarea
              id="interest-statement"
              rows={4}
              placeholder="e.g. I am interested in cybersecurity, network monitoring and intrusion detection."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              value={interestStatement}
              onChange={(e) => setInterestStatement(e.target.value)}
            />
          </div>

          <Button
            onClick={handleStartAndGenerate}
            disabled={isPending || generatingTopics || !interestStatement.trim()}
            className="w-full gap-2"
          >
            {generatingTopics ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating project ideas…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate 3 Topics
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'choosing_topic' → Step 4: Screen 2 — review AI suggestions,
  // regenerate, or write your own. AI is never a hard requirement.
  // ────────────────────────────────────────────────────────────────

  if (project.status === "choosing_topic") {
    const suggestions = project.ai_suggested_topics ?? [];
    const canGoBack = !!project.topic_title;

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            title="Choose Your Topic"
            description="Review the suggestions below, regenerate for new ideas, or write your own topic."
          />
          {canGoBack && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 shrink-0 mt-1"
              disabled={isPending || cancelingRestart}
              onClick={handleCancelTopicRestart}
            >
              {cancelingRestart ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
              Back
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Your Are of Interest
              </p>
              {!editingInterest && (
                <p className="text-sm text-foreground">{project.interest_statement}</p>
              )}
            </div>
            {!editingInterest && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setEditInterestText(project.interest_statement);
                  setEditingInterest(true);
                }}
              >
                Edit
              </Button>
            )}
          </div>

          {editingInterest && (
            <div className="space-y-3 pt-1">
              <textarea
                id="edit-interest-statement"
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                value={editInterestText}
                onChange={(e) => setEditInterestText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={isPending || savingInterest || generatingTopics || !editInterestText.trim()}
                  onClick={handleSaveInterestAndRegenerate}
                >
                  {savingInterest || generatingTopics ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Save & Regenerate Topics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || savingInterest || generatingTopics}
                  onClick={() => setEditingInterest(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {topicGenError && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">{topicGenError}</p>
              <p className="mt-0.5 opacity-80">You can still write your own topic below.</p>
            </div>
          </div>
        )}

        {generatingTopics ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating project ideas…</p>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">AI-Suggested Topics</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2"
                >
                  <p className="font-semibold text-foreground">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 mt-2"
                    disabled={isPending || selectingTopic}
                    onClick={() => handleSelectAiTopic(s)}
                  >
                    {selectingTopic ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Choose this topic
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              disabled={isPending || generatingTopics}
              onClick={handleRegenerateTopics}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Topics
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="gap-2"
            disabled={isPending || generatingTopics}
            onClick={handleRegenerateTopics}
          >
            <Sparkles className="w-4 h-4" />
            Generate 3 Topics
          </Button>
        )}

        <div className="pt-2 border-t border-border">
          {!writingOwnTopic ? (
            <Button
              variant="ghost"
              className="px-0 gap-1 underline-offset-4 hover:underline"
              onClick={() => setWritingOwnTopic(true)}
            >
              Write my own topic instead
            </Button>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 mt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Write Your Own Topic
                </p>
                <Button variant="ghost" size="sm" onClick={() => setWritingOwnTopic(false)}>
                  Cancel
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-title">Topic Title *</Label>
                <Input
                  id="manual-title"
                  placeholder="e.g. Deep Learning-Based Malaria Detection Using Microscopy Images"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-description">Topic Description</Label>
                <Textarea
                  id="manual-description"
                  rows={4}
                  placeholder="Provide a brief overview of your proposed approach, objectives, or expected outcomes…"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSubmitManualTopic}
                disabled={isPending || selectingTopic || !manualTitle.trim()}
                className="gap-2"
              >
                {selectingTopic ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Use This Topic
              </Button>
            </div>
          )}
        </div>

        <SupervisionHistoryPanel reviews={reviews} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'choosing_supervisor' → Show lecturer list (first pick)
  // ────────────────────────────────────────────────────────────────

  if (project.status === "choosing_supervisor") {
    // Prefer the cached Top-3 AI matches (what the backend actually
    // validates selections against). Only fall back to the full
    // department roster when no suggestions exist yet — the exact same
    // condition chooseSupervisor() uses server-side to skip its check.
    const suggested = project.ai_suggested_lecturers ?? [];
    const usingAiSuggestions = suggested.length > 0;
    const sortedSuggested = [...suggested].sort((a, b) => b.match_score - a.match_score);

    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Choose a Supervisor"
          description={
            usingAiSuggestions
              ? "Based on your topic, here are your best-matched supervisors."
              : "Select a lecturer from your department to supervise your graduation project."
          }
        />

        {/* Topic summary card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Your Topic
                </p>
                {!editingTopic && (
                  <>
                    <p className="font-semibold text-foreground">{project.topic_title}</p>
                    {project.topic_description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {project.topic_description}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            {!editingTopic && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending || restartingTopic}
                  onClick={() => {
                    setEditTopicTitle(project.topic_title ?? "");
                    setEditTopicDescription(project.topic_description ?? "");
                    setEditingTopic(true);
                  }}
                >
                  Edit Topic
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={isPending || restartingTopic}
                  onClick={handleRestartTopicSelection}
                >
                  {restartingTopic ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Redo Topic Selection
                </Button>
              </div>
            )}
          </div>

          {editingTopic && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-topic-title">Topic Title *</Label>
                <Input
                  id="edit-topic-title"
                  value={editTopicTitle}
                  onChange={(e) => setEditTopicTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-topic-description">Topic Description</Label>
                <Textarea
                  id="edit-topic-description"
                  rows={4}
                  value={editTopicDescription}
                  onChange={(e) => setEditTopicDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={isPending || !editTopicTitle.trim()}
                  onClick={handleSaveTopicEdit}
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Save & Re-check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setEditingTopic(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!editingTopic && (
            <div className="pt-3 border-t border-border">
              <SimilarityResults matches={project.similar_projects_found ?? []} />
            </div>
          )}
        </div>

        {/* Supervisor cards */}
        {usingAiSuggestions ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Your Top {sortedSuggested.length} Suggested Supervisor
                {sortedSuggested.length > 1 ? "s" : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedSuggested.map((s, idx) => (
                <SupervisorCard
                  key={s.supervisor_id}
                  rank={idx + 1}
                  fullName={s.full_name}
                  email={s.university_email}
                  expertiseAres={s.expertise_areas}
                  matchedKeywords={s.matched_keywords}
                  matchScore={s.match_score}
                  currentStudents={s.current_students}
                  maxCapacity={s.max_capacity}
                  availableSlots={s.available_slots}
                  isPending={isPending}
                  onSelect={() => handleChooseSupervisor(s.supervisor_id)}
                />
              ))}
            </div>

            {(project.ai_full_capacity_lecturers ?? []).length > 0 && (
              <div className="space-y-3 pt-4 mt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Also Matched — At Maximum Capacity
                </p>
                <p className="text-xs text-muted-foreground -mt-2">
                  These lecturers also matched your topic but can't take new students right now.
                  Shown for information only.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(project.ai_full_capacity_lecturers ?? []).map((s) => (
                    <SupervisorCard
                      key={s.supervisor_id}
                      fullName={s.full_name}
                      email={s.university_email}
                      expertiseAres={s.expertise_areas}
                      matchedKeywords={s.matched_keywords}
                      matchScore={s.match_score}
                      currentStudents={s.current_students}
                      maxCapacity={s.max_capacity}
                      availableSlots={s.available_slots}
                      isPending={false}
                      infoOnly
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : lecturersLoading ? (
          <LoadingSpinner />
        ) : lecturers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-dashed border-border bg-muted/30">
            <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="font-semibold text-sm">No lecturers available</p>
            <p className="text-sm text-muted-foreground mt-1">
              No lecturers are currently registered in your department.
              Please contact your administrator.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              No AI match is available yet for this project, so you can pick from your
              full department list below.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {lecturers.map((lecturer) => (
                <SupervisorCard
                  key={lecturer.id}
                  fullName={lecturer.full_name}
                  email={lecturer.university_email}
                  expertiseAres={lecturer.expertise_areas}
                  isPending={isPending}
                  onSelect={() => handleChooseSupervisor(lecturer.id)}
                />
              ))}
            </div>
          </div>
        )}

        <SupervisionHistoryPanel reviews={reviews} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'rejected_by_supervisor'
  // → Show feedback, let student revise + resend or switch supervisor
  // ────────────────────────────────────────────────────────────────

  if (project.status === "rejected_by_supervisor") {
    const rejectingSupervisorName =
      (project.supervisor as any)?.full_name ?? "Your supervisor";
    const latestRejection = reviews.find((r) => r.decision === "rejected");
    const excludedIds = new Set([
      ...(project.rejected_supervisor_ids ?? []),
      ...(project.supervisor_id ? [project.supervisor_id] : []),
    ]);
    // Same source-of-truth rule as the initial pick: prefer the cached
    // Top-3 (filtered to whoever hasn't been passed over yet), falling
    // back to the full roster only when no AI suggestions exist at all.
    const suggested = project.ai_suggested_lecturers ?? [];
    const usingAiSuggestions = suggested.length > 0;
    const switchableSuggested = suggested
      .filter((s) => !excludedIds.has(s.supervisor_id))
      .sort((a, b) => b.match_score - a.match_score);
    const switchableFullCapacity = (project.ai_full_capacity_lecturers ?? []).filter(
      (s) => !excludedIds.has(s.supervisor_id)
    );
    const switchableLecturers = lecturers.filter((l) => !excludedIds.has(l.id));

    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Revise Your Proposal"
          description="Respond to the feedback below, then resend to the same supervisor or choose someone new."
        />

        <div className="flex justify-end -mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={isPending || restartingTopic}
            onClick={handleRestartTopicSelection}
          >
            {restartingTopic ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Start Over With a New Topic
          </Button>
        </div>

        {/* Rejection feedback */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center shrink-0">
              <XCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-rose-900 dark:text-rose-100">
                {rejectingSupervisorName} declined your request
              </p>
              {latestRejection?.comments && (
                <p className="text-sm text-rose-800 dark:text-rose-200 mt-1.5 rounded-lg bg-white/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3">
                  “{latestRejection.comments}”
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Editable proposal */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Revise Your Topic
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="revised-title">Topic Title *</Label>
            <Input
              id="revised-title"
              value={revisedTitle}
              onChange={(e) => setRevisedTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="revised-description">Topic Description</Label>
            <Textarea
              id="revised-description"
              rows={4}
              value={revisedDescription}
              onChange={(e) => setRevisedDescription(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={reviseChecking || !revisedTitle.trim()}
              onClick={handleCheckReviseSimilarity}
            >
              {reviseChecking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              Check for Similar Projects
            </Button>
            {reviseMatches !== null && (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <SimilarityResults matches={reviseMatches} />
              </div>
            )}
          </div>

          {!showSwitchPicker && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                className="flex-1 gap-2"
                disabled={isPending || !revisedTitle.trim()}
                onClick={handleResendSame}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Resend to {rejectingSupervisorName}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={isPending}
                onClick={() => setShowSwitchPicker(true)}
              >
                <Users className="w-4 h-4" />
                Choose a Different Supervisor
              </Button>
            </div>
          )}
        </div>

        {/* Switch-supervisor picker */}
        {showSwitchPicker && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Select a new supervisor for your revised topic
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSwitchPicker(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>

            {usingAiSuggestions ? (
              switchableSuggested.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl border border-dashed border-border bg-muted/30">
                  <Users className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-sm">No other suggested supervisors left</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    You've heard back from all of your originally suggested supervisors.
                    Please contact your administrator for next steps.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {switchableSuggested.map((s, idx) => (
                    <SupervisorCard
                      key={s.supervisor_id}
                      rank={idx + 1}
                      fullName={s.full_name}
                      email={s.university_email}
                      expertiseAres={s.expertise_areas}
                      matchedKeywords={s.matched_keywords}
                      matchScore={s.match_score}
                      currentStudents={s.current_students}
                      maxCapacity={s.max_capacity}
                      availableSlots={s.available_slots}
                      isPending={isPending}
                      disabled={!revisedTitle.trim()}
                      ctaLabel="Send to This Supervisor"
                      onSelect={() => handleSwitchSupervisor(s.supervisor_id)}
                    />
                  ))}
                </div>
              )
            ) : lecturersLoading ? (
              <LoadingSpinner />
            ) : switchableLecturers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl border border-dashed border-border bg-muted/30">
                <Users className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-sm">No other lecturers available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You've already gone through everyone available in your department.
                  Please contact your administrator.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {switchableLecturers.map((lecturer) => (
                  <SupervisorCard
                    key={lecturer.id}
                    fullName={lecturer.full_name}
                    email={lecturer.university_email}
                    expertiseAres={lecturer.expertise_areas}
                    isPending={isPending}
                    disabled={!revisedTitle.trim()}
                    ctaLabel="Send to This Supervisor"
                    onSelect={() => handleSwitchSupervisor(lecturer.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {showSwitchPicker && switchableFullCapacity.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Also Matched — At Maximum Capacity
            </p>
            <p className="text-xs text-muted-foreground -mt-2">
              These lecturers also matched your topic but can't take new students right now.
              Shown for information only.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {switchableFullCapacity.map((s) => (
                <SupervisorCard
                  key={s.supervisor_id}
                  fullName={s.full_name}
                  email={s.university_email}
                  expertiseAres={s.expertise_areas}
                  matchedKeywords={s.matched_keywords}
                  matchScore={s.match_score}
                  currentStudents={s.current_students}
                  maxCapacity={s.max_capacity}
                  availableSlots={s.available_slots}
                  isPending={false}
                  infoOnly
                />
              ))}
            </div>
          </div>
        )}

        {/* Full supervision history for this project (persists across
            topic restarts — see SupervisionHistoryPanel above). */}
        <SupervisionHistoryPanel reviews={reviews} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'all_supervisors_rejected'
  // ────────────────────────────────────────────────────────────────

  if (project.status === "all_supervisors_rejected") {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Graduation Project"
          description="All available supervisors have been contacted."
        />
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-200">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">No more supervisors to choose from</p>
            <p className="text-sm mt-1">
              Every lecturer in your department has been contacted for this project.
              Please reach out to your administrator for next steps.
            </p>
          </div>
        </div>

        <Button
          className="gap-2"
          disabled={isPending || restartingTopic}
          onClick={handleRestartTopicSelection}
        >
          {restartingTopic ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Start Over With a New Topic
        </Button>

        <SupervisionHistoryPanel reviews={reviews} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'pending_supervisor' → Waiting for response
  // ────────────────────────────────────────────────────────────────

  if (project.status === "pending_supervisor") {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Graduation Project"
          description="Track the status of your supervision request."
        />

        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Awaiting supervisor response
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Your request has been sent. Please check back soon.
              </p>
            </div>
          </div>

          {project.supervisor && (
            <div className="rounded-xl bg-white dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Requested Supervisor
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {(project.supervisor as any).full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="font-medium text-sm">
                  {(project.supervisor as any).full_name}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Topic card */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Your Topic
          </p>
          <p className="font-semibold text-foreground">{project.topic_title}</p>
          {project.topic_description && (
            <p className="text-sm text-muted-foreground mt-2">{project.topic_description}</p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadProject}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh Status
        </Button>

        <SupervisionHistoryPanel reviews={reviews} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'active' → Supervision confirmed
  // ────────────────────────────────────────────────────────────────

  if (project.status === "active") {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader
          title="Graduation Project"
          description="Your supervision is confirmed. Good luck with your project!"
        />

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                Supervision confirmed!
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Your project is now active.
              </p>
            </div>
          </div>

          {project.supervisor && (
            <div className="rounded-xl bg-white dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Your Supervisor
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {(project.supervisor as any).full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {(project.supervisor as any).full_name}
                  </p>
                  {((project.supervisor as any).expertise_areas ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {((project.supervisor as any).expertise_areas ?? [])
                        .slice(0, 3)
                        .map((area: string) => (
                          <Badge key={area} variant="secondary" className="text-xs font-normal">
                            {area}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Your Topic
          </p>
          <p className="font-semibold text-foreground">{project.topic_title}</p>
          {project.topic_description && (
            <p className="text-sm text-muted-foreground mt-2">{project.topic_description}</p>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Are of interest:</span> {project.interest_statement}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // STATE: 'completed'
  // ────────────────────────────────────────────────────────────────

  if (project.status === "completed") {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="Graduation Project" description="Congratulations!" />
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Project Completed!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your graduation project has been marked as completed.
            </p>
          </div>
          <div className="w-full rounded-xl border border-border bg-card p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Topic
            </p>
            <p className="font-semibold">{project.topic_title}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Fallback ──────────────────────────────────────────────────
  return null;
}
