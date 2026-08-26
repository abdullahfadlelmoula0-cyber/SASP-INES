"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  AlertCircle,
  Loader2,
  RefreshCw,
  GraduationCap,
  ChevronRight,
  Gauge,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import {
  getLecturerRequests,
  acceptRequest,
  rejectRequest,
  getMyCapacity,
  updateMyCapacity,
} from "@/lib/graduation/actions";
import type { GraduationProject, SupervisorCapacity } from "@/types";

// ── Page ──────────────────────────────────────────────────────────

export default function SupervisionRequestsPage() {
  const [projects, setProjects] = useState<GraduationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<GraduationProject | null>(null);
  const [rejectComments, setRejectComments] = useState("");

  // Supervision Capacity state
  const [capacity, setCapacity] = useState<SupervisorCapacity | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [capacityInput, setCapacityInput] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);

  // ── Load data ─────────────────────────────────────────────────

  async function loadRequests() {
    setLoading(true);
    setLoadError(null);
    const res = await getLecturerRequests();
    if (res.error) {
      setLoadError(res.error);
    } else {
      setProjects(res.data);
    }
    setLoading(false);
  }

  async function loadCapacity() {
    setCapacityLoading(true);
    const res = await getMyCapacity();
    if (res.data) {
      setCapacity(res.data);
    }
    setCapacityLoading(false);
  }

  useEffect(() => {
    loadRequests();
    loadCapacity();
  }, []);

  function handleSaveCapacity() {
    const parsed = parseInt(capacityInput, 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
      toast({ title: "Enter a valid capacity", description: "Must be a whole number of at least 1.", variant: "destructive" });
      return;
    }
    setSavingCapacity(true);
    startTransition(async () => {
      const res = await updateMyCapacity(parsed);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        setSavingCapacity(false);
        return;
      }
      toast({ title: "Capacity updated" });
      setEditingCapacity(false);
      setSavingCapacity(false);
      await loadCapacity();
    });
  }

  // ── Split by status ───────────────────────────────────────────

  const pending = projects.filter((p) => p.status === "pending_supervisor");
  const active = projects.filter((p) => p.status === "active");

  // ── Handlers ──────────────────────────────────────────────────

  function handleAccept(projectId: string) {
    setActioningId(projectId);
    startTransition(async () => {
      const res = await acceptRequest(projectId);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        toast({
          title: "Request accepted",
          description: "The student has been notified. They are now your active supervisee.",
        });
        await loadRequests();
      }
      setActioningId(null);
    });
  }

  function openRejectDialog(project: GraduationProject) {
    setRejectTarget(project);
    setRejectComments("");
  }

  function handleReject() {
    if (!rejectTarget) return;
    const projectId = rejectTarget.id;
    const comments = rejectComments;

    if (!comments.trim()) {
      toast({
        title: "Comments required",
        description: "Please explain why you're declining this request.",
        variant: "destructive",
      });
      return;
    }

    setActioningId(projectId);
    startTransition(async () => {
      const res = await rejectRequest(projectId, comments);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        toast({
          title: "Request declined",
          description: "The student has been notified with your comments.",
        });
        setRejectTarget(null);
        setRejectComments("");
        await loadRequests();
      }
      setActioningId(null);
    });
  }

  // ── Loading ───────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <PageHeader
        title="Supervision Requests"
        description="Manage student graduation project supervision requests assigned to you."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* ── Stats bar ──────────────────────────────────────────── */}
      {!capacityLoading && capacity && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Supervision Capacity</p>
            </div>
            {!editingCapacity && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setCapacityInput(String(capacity.max_capacity));
                  setEditingCapacity(true);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}
          </div>

          {editingCapacity ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-28"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
              />
              <Button
                size="sm"
                className="gap-2"
                disabled={savingCapacity || isPending}
                onClick={handleSaveCapacity}
              >
                {savingCapacity ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={savingCapacity || isPending}
                onClick={() => setEditingCapacity(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Maximum Students</p>
                <p className="text-lg font-bold text-foreground">{capacity.max_capacity}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Students</p>
                <p className="text-lg font-bold text-foreground">
                  {capacity.current_students} / {capacity.max_capacity}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available Slots</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    capacity.available_slots > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {capacity.available_slots}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Pending"
          value={pending.length}
          icon={Clock}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
        />
        <StatCard
          label="Active"
          value={active.length}
          icon={CheckCircle2}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
        />
        <StatCard
          label="Total"
          value={projects.length}
          icon={GraduationCap}
          color="text-primary"
          bg="bg-primary/5 border-primary/20"
        />
      </div>

      {/* ── Section: Pending requests ───────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-base text-foreground">
            Pending Requests
          </h2>
          {pending.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            >
              {pending.length}
            </Badge>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-border bg-muted/20 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No pending requests</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              New requests will appear here when students select you as a supervisor.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((project) => (
              <PendingCard
                key={project.id}
                project={project}
                isActioning={actioningId === project.id && isPending}
                atCapacity={!!capacity && capacity.available_slots <= 0}
                onAccept={() => handleAccept(project.id)}
                onReject={() => openRejectDialog(project)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Section: Active supervisions ─────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-base text-foreground">
            Active Supervisions
          </h2>
          {active.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            >
              {active.length}
            </Badge>
          )}
        </div>

        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-border bg-muted/20 text-center">
            <GraduationCap className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">No active supervisions</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Accept a pending request to start supervising a student.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((project) => (
              <ActiveCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      {/* ── Reject dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectComments("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline supervision request</DialogTitle>
            <DialogDescription>
              {rejectTarget && (
                <>
                  Let{" "}
                  <span className="font-medium text-foreground">
                    {(rejectTarget.student as any)?.full_name ?? "the student"}
                  </span>{" "}
                  know why, so they can revise their proposal or choose a different
                  supervisor.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-4 space-y-2">
            <Textarea
              autoFocus
              rows={5}
              placeholder="e.g. This topic overlaps with ongoing research I'm already supervising. Consider narrowing the scope to focus on…"
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              These comments are sent directly to the student and saved to the
              request history.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectComments("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isPending || !rejectComments.trim()}
              className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border-0"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              Decline with comments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-4 flex items-center gap-3", bg)}>
      <Icon className={cn("w-5 h-5 shrink-0", color)} />
      <div>
        <p className={cn("text-2xl font-bold leading-none", color)}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function PendingCard({
  project,
  isActioning,
  atCapacity,
  onAccept,
  onReject,
}: {
  project: GraduationProject;
  isActioning: boolean;
  atCapacity: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const student = project.student as any;

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Accent top bar */}
      <div className="h-1 bg-gradient-to-r from-amber-400 to-amber-500" />

      <div className="p-5 space-y-4">
        {/* Student info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
              {student?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              {student?.full_name ?? "Unknown Student"}
            </p>
            {student?.university_email && (
              <p className="text-xs text-muted-foreground truncate">
                {student.university_email}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className="ml-auto shrink-0 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs"
          >
            Pending
          </Badge>
        </div>

        {/* Topic */}
        <div className="rounded-xl bg-muted/40 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            Topic
          </div>
          <p className="font-semibold text-sm text-foreground">
            {project.topic_title ?? "No topic title"}
          </p>
          {project.topic_description && (
            <p className="text-xs text-muted-foreground line-clamp-3">
              {project.topic_description}
            </p>
          )}
        </div>

        {/* Interest statement */}
        {project.interest_statement && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            <span className="font-medium text-foreground">Interest: </span>
            {project.interest_statement}
          </p>
        )}

        {/* Action buttons */}
        {atCapacity && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            You're at your maximum supervision capacity. Decline this request or free up a
            slot before you can accept it.
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            onClick={onAccept}
            disabled={isActioning || atCapacity}
          >
            {isActioning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
            onClick={onReject}
            disabled={isActioning}
          >
            {isActioning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActiveCard({ project }: { project: GraduationProject }) {
  const student = project.student as any;

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-card shadow-sm overflow-hidden">
      {/* Accent top bar */}
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />

      <div className="p-5 space-y-4">
        {/* Student info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {student?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">
              {student?.full_name ?? "Unknown Student"}
            </p>
            {student?.university_email && (
              <p className="text-xs text-muted-foreground truncate">
                {student.university_email}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className="ml-auto shrink-0 text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-xs"
          >
            Active
          </Badge>
        </div>

        {/* Topic */}
        <div className="rounded-xl bg-muted/40 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            Topic
          </div>
          <p className="font-semibold text-sm text-foreground">
            {project.topic_title ?? "No topic title"}
          </p>
          {project.topic_description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {project.topic_description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
