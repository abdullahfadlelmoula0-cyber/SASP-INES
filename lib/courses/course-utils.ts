import type { Course, CourseDeliveryStatus } from "@/types";
import { formatDate } from "@/lib/utils";

export function getCourseDeliveryStatus(
  course: Pick<Course, "start_date" | "end_date">
): CourseDeliveryStatus {
  if (!course.start_date || !course.end_date) return "unknown";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(course.start_date);
  const end = new Date(course.end_date);

  if (now < start) return "scheduled";
  if (now > end) return "completed";
  return "in_progress";
}

export function getDeliveryStatusLabel(
  status: CourseDeliveryStatus
): string {
  switch (status) {
    case "scheduled":
      return "Upcoming";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "unknown":
      return "Schedule TBD";
  }
}

export function getDeliveryStatusVariant(
  status: CourseDeliveryStatus
): "info" | "success" | "muted" | "warning" {
  switch (status) {
    case "scheduled":
      return "warning";
    case "in_progress":
      return "success";
    case "completed":
      return "muted";
    case "unknown":
      return "info";
  }
}

export function formatDateRange(
  start: string | null,
  end: string | null
): string {
  if (!start && !end) return "Schedule not set";
  if (start && !end) return `${formatDate(start)} — TBD`;
  if (!start && end) return `TBD — ${formatDate(end)}`;
  return `${formatDate(start!)} — ${formatDate(end!)}`;
}

export function sortCoursesForDisplay(
  courses: Course[],
  opts?: { direction?: "asc" | "desc" }
): Course[] {
  const direction = opts?.direction ?? "asc";
  const cmp = direction === "asc" ? 1 : -1;
  return [...courses].sort((a, b) => {
    const codeCmp = a.code.localeCompare(b.code);
    if (codeCmp !== 0) return codeCmp * cmp;
    const statusOrder = {
      in_progress: 0,
      scheduled: 1,
      unknown: 2,
      completed: 3,
    };
    const aStatus = getCourseDeliveryStatus(a);
    const bStatus = getCourseDeliveryStatus(b);
    return (statusOrder[aStatus] - statusOrder[bStatus]) * cmp;
  });
}

export interface CreateCourseInput {
  code: string;
  title: string;
  description: string | null;
  credits: number;
  instructor: string | null;
  department: string;
  program: string;
  year_of_study: number;
  academic_year?: string;
  start_date: string | null;
  end_date: string | null;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface CourseValidationErrors {
  code?: string;
  title?: string;
  description?: string;
  credits?: string;
  instructor?: string;
  department?: string;
  program?: string;
  year_of_study?: string;
  start_date?: string;
  end_date?: string;
  _global?: string;
}

export function validateCourseInput(
  input: CreateCourseInput,
  opts?: { editing?: boolean }
): CourseValidationErrors {
  void opts;
  const errors: CourseValidationErrors = {};

  if (!input.code?.trim()) {
    errors.code = "Course code is required";
  } else if (input.code.trim().length > 20) {
    errors.code = "Course code is too long";
  }

  if (!input.title?.trim()) {
    errors.title = "Course title is required";
  } else if (input.title.trim().length < 3) {
    errors.title = "Title is too short";
  } else if (input.title.trim().length > 200) {
    errors.title = "Title is too long";
  }

  if (input.credits === undefined || input.credits === null) {
    errors.credits = "Credits are required";
  } else if (input.credits < 1) {
    errors.credits = "Credits must be at least 1";
  } else if (input.credits > 30) {
    errors.credits = "Credits seem unreasonably high";
  }

  if (!input.department?.trim()) {
    errors.department = "Department is required";
  }

  if (!input.program?.trim()) {
    errors.program = "Program is required";
  }

  if (
    input.year_of_study === undefined ||
    input.year_of_study === null ||
    input.year_of_study === 0
  ) {
    errors.year_of_study = "Year of study is required";
  } else if (input.year_of_study < 1) {
    errors.year_of_study = "Year of study must be at least 1";
  }

  // academic_year is optional — informational only, not required for course creation

  if (input.start_date && input.end_date) {
    const s = new Date(input.start_date);
    const e = new Date(input.end_date);
    if (s > e) {
      errors.end_date = "End date must be on or after the start date";
    }
  }

  return errors;
}
