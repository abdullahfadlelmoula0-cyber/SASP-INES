// -----------------------------------------------------------------
// Shared TypeScript types for SASP-INES
// All domain interfaces live here so they can be imported anywhere.
// -----------------------------------------------------------------

// ── Auth / User ──────────────────────────────────────────────────

/**
 * Role assigned to every authenticated user.
 * Only admins can change a user's role — students cannot self-promote
 * (enforced by RLS at the database level).
 */
export type UserRole = "student" | "admin" | "department_admin";

/**
 * Mirrors the `public.profiles` table in Supabase.
 *
 * NOTE: No `semester` field.
 * INES-Ruhengeri does not organise course delivery by semester.
 * Courses are delivered on their own schedule (start_date / end_date).
 */
export interface UserProfile {
  /** UUID — matches auth.users.id */
  id: string;
  /** University-issued student ID, e.g. "UG2528267". Set by admin. */
  student_id: string | null;
  /** Student's full legal name */
  full_name: string;
  /** University email address, e.g. ug2528267@ines.ac.rw */
  university_email: string | null;
  /** Academic department, e.g. "Computer Science" (display-only) */
  department: string;
  /** Degree programme, e.g. "Software Engineering" (display-only) */
  program: string;
  /**
   * Current year within the student's programme (e.g., 3).
   * The valid maximum is programme-specific — not a universal constant.
   */
  year_of_study: number;
  /**
   * Current academic year label, e.g. "2026/2027". Admin-set.
   * Never auto-derived from the system date.
   */
  academic_year: string | null;
  /** Role controls access to admin features */
  role: UserRole;
  /** URL of profile avatar stored in Supabase Storage */
  avatar_url: string | null;
  /**
   * FK → academic_plans.id. The REAL source of truth for course matching
   * (structured path). Null for students on the legacy dept/program path.
   */
  academic_plan_id: string | null;
  /**
   * FK → specializations.id. Required once year_of_study > shared_years.
   * Null for shared-trunk years or legacy-path students.
   */
  specialization_id: string | null;
  /**
   * Only meaningful when role = 'department_admin'. FK → departments.id.
   * The single department this admin may post announcements for.
   * Null for students/admins.
   */
  managed_department_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Academic Targeting ────────────────────────────────────────────

/**
 * Shared academic targeting dimensions used across all content tables.
 *
 * These fields form the consistent filtering backbone of the platform:
 *   - Courses:       all fields required (NOT NULL)
 *   - Documents:     Partial<AcademicTarget> — nullable fields (NULL = global)
 *   - Announcements: Partial<AcademicTarget> — nullable fields (NULL = global)
 *   - Exams:         no own targeting fields — inherited via Course FK join
 *
 * `academic_year` is a human-readable string set explicitly by the admin
 * (e.g. "2026/2027"). It is NEVER derived from the system date — INES
 * programmes start at different times of year.
 *
 * There is NO `semester` dimension. INES delivers courses on their own
 * schedules (see Course.start_date / Course.end_date) rather than in
 * fixed semester blocks.
 */
export interface AcademicTarget {
  /** e.g. "Computer Science" */
  department: string;
  /** e.g. "Software Engineering" */
  program: string;
  /**
   * Year within the programme (e.g., 3).
   * Upper bound is programme-specific, not a universal constant.
   */
  year_of_study: number;
  /**
   * Human-readable academic year label, e.g. "2026/2027".
   * Set explicitly by the admin — never auto-derived from the date.
   */
  academic_year?: string | null;
}

// ── Courses ──────────────────────────────────────────────────────

/**
 * Mirrors the `public.courses` table.
 *
 * A course belongs to an exact academic context (department + program
 * + year_of_study + academic_year). Students automatically see the
 * courses that match their profile — no manual filter needed.
 *
 * Visibility is determined purely by the academic context:
 * - Legacy courses: department + program + year_of_study match
 * - Structured courses: academic_plan_id + specialization_id + year_number match
 * The `is_active` column was removed in migration 012.
 * to true when the course is currently running. Multiple courses can
 * run simultaneously (overlapping start_date / end_date is allowed).
 *
 * NOTE: No `semester` field — INES does not use semester-based delivery.
 */
export interface Course extends AcademicTarget {
  id: string;
  /** e.g. "CS301" — unique within program + academic_year */
  code: string;
  title: string;
  description: string | null;
  credits: number;
  instructor: string | null;
  // my add here to extend the course.
  academic_plan_id: string | null;
specialization_id: string | null;
year_number: number | null;
  /**
   * Optional delivery start date (ISO date string, e.g. "2026-07-06").
   * May be null if the schedule is not yet confirmed.
   * Multiple courses may overlap — no constraint prevents this.
   */
  start_date: string | null;
  /**
   * Optional delivery end date (ISO date string, e.g. "2026-07-24").
   * May be null if the schedule is not yet confirmed.
   * Must be >= start_date if both are provided (enforced by DB CHECK).
   */
  end_date: string | null;
  /**
   * Informational label set by the admin (e.g. "2026/2027").
   * Displayed in the admin UI. NOT used for student visibility filtering —
   * that is controlled solely by department/program/year_of_study (legacy)
   * or academic_plan_id/specialization_id/year_number (structured).
   */
  /**
   * Informational academic-year label (e.g. "2026/2027").
   * Null if not set — this field was removed from the courses table
   * in an earlier migration and is kept as optional for compatibility.
   * NOT used for RLS matching or student visibility.
   */
  academic_year?: string | null;
}

/**
 * Computed delivery status based on start_date / end_date.
 * Derived in the application layer — not stored in the database.
 */
export type CourseDeliveryStatus =
  | "scheduled"    // start_date is in the future
  | "in_progress"  // now is between start_date and end_date
  | "completed"    // end_date is in the past
  | "unknown";     // start_date or end_date not set

// ── Previous Exams ───────────────────────────────────────────────

/**
 * Stub for the future exams table.
 * Exams inherit academic targeting via their parent course (FK join) —
 * no redundant targeting columns needed here.
 *
 * NOTE: No `semester` field.
 */
export type ExamType = "midterm" | "final" | "quiz" | "assignment";

export interface Exam {
  id: string;
  course_id: string;
  course?: Pick<Course, "code" | "title">;
  title: string;
  exam_type: ExamType;
  /** Which academic year this exam is from, e.g. "2025/2026" */
  academic_year: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

// ── Documents ────────────────────────────────────────────────────

/**
 * Stub for the future documents table.
 * Uses Partial<AcademicTarget> — any NULL dimension means "no restriction".
 * A document with all-NULL targeting is global (visible to all students).
 *
 * NOTE: No `semester` field.
 */
export type DocumentCategory =
  | "lecture_notes"
  | "syllabus"
  | "handbook"
  | "form"
  | "other";

export interface Document extends Partial<AcademicTarget> {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  /** Optional link to a specific course */
  course_id: string | null;
  course?: Pick<Course, "code" | "title"> | null;
  uploaded_by: string;
  created_at: string;
}

// ── Announcements ────────────────────────────────────────────────

/**
 * Platform-wide announcements with optional academic targeting.
 * Uses Partial<AcademicTarget> for the same nullable targeting model
 * as Documents. NULL = no restriction on that dimension.
 *
 * NOTE: No `semester` field.
 */
export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Announcement extends Partial<AcademicTarget> {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  author_id: string;
  author?: Pick<UserProfile, "full_name" | "avatar_url">;
  is_pinned: boolean;
  expires_at: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  // Joined attachments
  announcement_attachments?: AnnouncementAttachment[];
}

// ── Pagination ───────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}
