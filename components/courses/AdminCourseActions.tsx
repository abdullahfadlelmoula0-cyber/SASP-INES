"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArchiveRestore,
  Loader2,
  Play,
  Pause,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toggleCourseActive, deleteCourse } from "@/lib/courses/actions";
import { toast } from "@/hooks/use-toast";
import type { Course } from "@/types";

interface AdminCourseActionsProps {
  deleting: Course | null;
  setDeleting: (c: Course | null) => void;
  onRefresh: () => void;
}

export function AdminCourseActions({
  deleting,
  setDeleting,
  onRefresh,
}: AdminCourseActionsProps) {
  return (
    <DeleteCourseModal
      course={deleting}
      open={!!deleting}
      setOpen={(v) => !v && setDeleting(null)}
      onSuccess={onRefresh}
    />
  );
}

export async function activateCourse(
  course: Course,
  opts: { onSuccess: () => void }
) {
  try {
    const { error } = await toggleCourseActive(course.id, course.is_active);
    if (error) throw new Error(error);
    toast({
      title: "Course activated",
      description: `${course.code} ${course.title} is now visible to students.`,
      variant: "success",
    });
    opts.onSuccess();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    toast({
      title: "Activation failed",
      description: msg,
      variant: "destructive",
    });
  }
}

export async function deactivateCourse(
  course: Course,
  opts: { onSuccess: () => void }
) {
  try {
    const { error } = await toggleCourseActive(course.id, course.is_active);
    if (error) throw new Error(error);
    toast({
      title: "Course deactivated",
      description: `${course.code} ${course.title} is hidden from students.`,
      variant: "default",
    });
    opts.onSuccess();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    toast({
      title: "Deactivation failed",
      description: msg,
      variant: "destructive",
    });
  }
}

export function getRowActionItems(
  course: Course,
  opts: {
    onView: () => void;
    onEdit: () => void;
    onToggleActive: () => void;
    onDelete: () => void;
  }
) {
  return [
    {
      key: "view",
      label: "View Details",
      icon: Eye,
      onClick: opts.onView,
      destructive: false,
    },
    {
      key: "edit",
      label: "Edit Course",
      icon: ArchiveRestore,
      onClick: opts.onEdit,
      destructive: false,
    },
    {
      key: "toggle",
      label: course.is_active ? "Deactivate" : "Activate",
      icon: course.is_active ? Pause : Play,
      onClick: opts.onToggleActive,
      destructive: false,
    },
    {
      key: "delete",
      label: "Delete Course",
      icon: Trash2,
      onClick: opts.onDelete,
      destructive: true,
    },
  ] as const;
}

function DeleteCourseModal({
  course,
  open,
  setOpen,
  onSuccess,
}: {
  course: Course | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  React.useEffect(() => {
    if (open) {
      setConfirmText("");
      setSubmitting(false);
    }
  }, [open, course?.id]);

  if (!course) return null;

  const targetCourse = course;
  const matches = confirmText.trim() === targetCourse.code;

  async function handleDelete() {
    if (!matches) return;
    setSubmitting(true);
    try {
      const res = await deleteCourse(targetCourse.id);
      if (res.error) throw new Error(res.error);
      toast({
        title: "Course deleted",
        description: `${targetCourse.code} ${targetCourse.title} has been permanently removed.`,
        variant: "default",
      });
      onSuccess();
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      toast({
        title: "Deletion failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-2">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-5.5 h-5.5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-lg leading-tight">
                Delete this course?
              </DialogTitle>
              <DialogDescription className="leading-relaxed">
                This action is <strong className="text-destructive font-semibold">permanent and cannot be undone</strong>.
                Any links from exams, documents, or references to this course
                may break. Prefer <em>deactivating</em> the course if it should
                remain archived.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 sm:px-6 pb-4 space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="info" className="font-mono text-[11px]">
                {targetCourse.code}
              </Badge>
              <Badge variant={targetCourse.is_active ? "success" : "muted"} className="text-[11px]">
                {targetCourse.is_active ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {targetCourse.academic_year}
              </Badge>
            </div>
            <p className="font-semibold text-foreground leading-snug">
              {targetCourse.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {targetCourse.program} · Year {targetCourse.year_of_study} ·{" "}
              {targetCourse.credits} credit{targetCourse.credits === 1 ? "" : "s"}
              {targetCourse.instructor ? ` · ${targetCourse.instructor}` : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Type{" "}
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">
                {targetCourse.code}
              </span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={submitting}
              placeholder={targetCourse.code}
              className="w-full h-10 rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter className="sm:justify-between flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
            size="sm"
          >
            <EyeOff className="w-4 h-4" />
            Keep course
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!matches || submitting}
            size="sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Permanently Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
