"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  User,
  Hash,
  Layers,
  Building,
  BookMarked,
  Clock,
  X,
} from "lucide-react";
import type { Course } from "@/types";
import {
  getCourseDeliveryStatus,
  getDeliveryStatusLabel,
  getDeliveryStatusVariant,
  formatDateRange,
} from "@/lib/courses/course-utils";
import { formatDate, cn } from "@/lib/utils";

interface CourseDetailsProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "student" | "admin";
  actions?: React.ReactNode;
}

export function CourseDetails({
  course,
  open,
  onOpenChange,
  variant = "student",
  actions,
}: CourseDetailsProps) {
  if (!course) return null;

  const status = getCourseDeliveryStatus(course);
  const statusLabel = getDeliveryStatusLabel(status);
  const statusVariant = getDeliveryStatusVariant(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="pr-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="info" className="font-mono text-[11px]">
                  <Hash className="w-3 h-3" />
                  {course.code}
                </Badge>
                <Badge
                  variant={course.is_active ? "success" : "muted"}
                  className="text-[11px]"
                >
                  {course.is_active ? "Active" : "Draft / Inactive"}
                </Badge>
                <Badge variant={statusVariant} className="text-[11px]">
                  <Clock className="w-3 h-3" />
                  {statusLabel}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold leading-tight">
                {course.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {course.description ||
                  "No description provided for this course."}
              </DialogDescription>
            </div>
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoTile
              icon={<GraduationCap className="w-4 h-4" />}
              label="Credits"
              value={`${course.credits} ${course.credits === 1 ? "credit" : "credits"}`}
            />
            <InfoTile
              icon={<User className="w-4 h-4" />}
              label="Instructor"
              value={course.instructor || "TBD"}
            />
            <InfoTile
              icon={<Building className="w-4 h-4" />}
              label="Department"
              value={course.department}
            />
            <InfoTile
              icon={<Layers className="w-4 h-4" />}
              label="Program"
              value={course.program}
            />
            <InfoTile
              icon={<BookMarked className="w-4 h-4" />}
              label="Year of Study"
              value={`Year ${course.year_of_study}`}
            />
            <InfoTile
              icon={<CalendarDays className="w-4 h-4" />}
              label="Academic Year"
              value={course.academic_year}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              Delivery Schedule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Start Date
                </p>
                <p className="text-sm font-medium">
                  {course.start_date ? formatDate(course.start_date) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  End Date11
                </p>
                <p className="text-sm font-medium">
                  {course.end_date ? formatDate(course.end_date) : "—"}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Period
              </p>
              <p className="text-sm font-medium text-foreground">
                {formatDateRange(course.start_date, course.end_date)}
              </p>
            </div>
          </div>

          {variant === "admin" && (
            <div className="text-xs text-muted-foreground border-t border-border pt-4 space-y-1">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{formatDate(course.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last updated</span>
                <span>{formatDate(course.updated_at)}</span>
              </div>
            </div>
          )}
        </div>

        {actions && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 p-5 sm:p-6 border-t border-border bg-muted/20">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              size="sm"
            >
              <X className="w-4 h-4" />
              Close
            </Button>
            {actions}
          </div>
        )}

        {!actions && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 p-5 sm:p-6 border-t border-border bg-muted/20">
            <Button onClick={() => onOpenChange(false)} size="sm">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border p-3.5",
        "bg-card hover:border-primary/30 transition-colors"
      )}
    >
      <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground leading-snug truncate">
          {value}
        </p>
      </div>
    </div>
  );
}
