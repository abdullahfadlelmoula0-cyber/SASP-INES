"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  GraduationCap,
  User,
  Hash,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import type { Course } from "@/types";
import {
  getCourseDeliveryStatus,
  getDeliveryStatusLabel,
  getDeliveryStatusVariant,
  formatDateRange,
} from "@/lib/courses/course-utils";
import { cn } from "@/lib/utils";

interface CourseCardProps {
  course: Course;
  onView: (course: Course) => void;
  className?: string;
}

export function CourseCard({ course, onView, className }: CourseCardProps) {
  const status = getCourseDeliveryStatus(course);
  const statusLabel = getDeliveryStatusLabel(status);
  const statusVariant = getDeliveryStatusVariant(status);

  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30",
        "animate-fade-in",
        className
      )}
    >
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <Badge
              variant="info"
              className="self-start font-mono text-[10.5px] tracking-wide"
            >
              <Hash className="w-3 h-3" />
              {course.code}
            </Badge>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant={statusVariant}
                className="text-[10.5px] px-2 py-0"
              >
                <Clock className="w-3 h-3" />
                {statusLabel}
              </Badge>
              <Badge variant="success" className="text-[10.5px] px-2 py-0">
                {course.academic_year}
              </Badge>
            </div>
          </div>
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base leading-snug text-foreground line-clamp-2 min-h-[2.75rem]">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed min-h-[2rem]">
              {course.description}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-4 space-y-2.5">
        <InfoRow
          icon={<GraduationCap className="w-3.5 h-3.5" />}
          label={`${course.credits} credit${course.credits === 1 ? "" : "s"}`}
          secondaryLabel={`Year ${course.year_of_study}`}
        />
        <InfoRow
          icon={<User className="w-3.5 h-3.5" />}
          label={course.instructor || "Instructor TBD"}
          muted={!course.instructor}
        />
        <InfoRow
          icon={<CalendarDays className="w-3.5 h-3.5" />}
          label={formatDateRange(course.start_date, course.end_date)}
          muted={!course.start_date && !course.end_date}
        />
      </CardContent>

      <CardFooter className="pt-0 mt-auto">
        <Button
          variant="outline"
          size="sm"
          className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary/30 transition-all"
          onClick={() => onView(course)}
        >
          View Course
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  secondaryLabel,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  secondaryLabel?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className={cn(
            "text-muted-foreground shrink-0",
            muted && "text-muted-foreground/70"
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "truncate",
            muted ? "text-muted-foreground italic" : "text-foreground"
          )}
        >
          {label}
        </span>
      </div>
      {secondaryLabel && (
        <span className="text-xs text-muted-foreground shrink-0 font-medium">
          {secondaryLabel}
        </span>
      )}
    </div>
  );
}
