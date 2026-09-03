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
export type UserRole = "student" | "admin" | "department_admin" | "lecturer";

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
  /**
   * Only meaningful when role = 'lecturer'. TEXT[].
   * List of subject areas the lecturer specialises in.
   */
  expertise_areas: string[] | null;
  /**
   * Only meaningful when role = 'lecturer'. FK → departments.id.
   * The department this lecturer belongs to (used to match with students).
   */
  lecturer_department_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Notifications ─────────────────────────────────────────────────

/**
 * Mirrors the `public.notifications` table.
 * RLS: each user sees only their own rows (recipient_id = auth.uid()).
 */
export interface Notification {
  id: string;
  recipient_id: string;
  /** e.g. 'graduation_request' */
  type: string;
  title: string;
  body: string | null;
  /** Client-side route to push to when the notification is clicked. */
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Graduation Projects ───────────────────────────────────────────

export type GraduationProjectStatus =
  | "choosing_topic"
  | "choosing_supervisor"
  | "pending_supervisor"
  | "active"
  | "completed"
  | "rejected_by_supervisor"
  | "all_supervisors_rejected";

/**
 * Mirrors the `public.graduation_projects` table.
 * ai_suggested_topics is kept as unknown/null — real AI topic generation
 * is a future phase. ai_suggested_lecturers IS populated today, by the
 * non-AI keyword-overlap matching algorithm (find_top_supervisors()) —
 * the field name will carry over unchanged once real AI ranking replaces
 * the algorithm in a later phase.
 */
export interface GraduationProject {
  id: string;
  student_id: string;
  interest_statement: string;
  topic_title: string | null;
  topic_description: string | null;
  /**
   * Cached Top-3 AI-generated topic candidates (Gemini), populated by
   * generateTopicSuggestions() while status='choosing_topic'. Null until
   * the first generation runs, or if the student goes straight to
   * "write my own topic" without ever generating suggestions.
   */
  ai_suggested_topics: AiTopicCandidate[] | null;
  /**
   * Top-3 supervisor matches computed by find_top_supervisors() (keyword
   * overlap + trigram fallback), recomputed on topic create/edit while
   * still in 'choosing_supervisor'. Null until the first match run.
   */
  ai_suggested_lecturers: SupervisorMatch[] | null;
  /**
   * Lecturers who matched the topic (same scoring as ai_suggested_lecturers)
   * but were excluded from the Top-3 because they were at/over capacity
   * when matching last ran. Shown to the student as info-only — never
   * selectable, never counted toward the 3 suggested slots. Null until
   * the first match run, or empty when no matched lecturer was full.
   */
  ai_full_capacity_lecturers: SupervisorMatch[] | null;
  supervisor_id: string | null;
  status: GraduationProjectStatus;
  /**
   * Supervisors the student has formally moved on from (chose a
   * different supervisor after a rejection). Used to prevent
   * re-selecting someone already passed over, and to detect
   * exhaustion of the candidate pool.
   */
  rejected_supervisor_ids: string[];
  /**
   * Result of the most recent non-AI (pg_trgm) topic similarity check,
   * recomputed whenever the topic is created or edited. Null until the
   * first check runs. Never includes student identity — title/description/
   * status/score only, via the find_similar_projects() DB function.
   */
  similar_projects_found: SimilarProjectMatch[] | null;
  created_at: string;
  updated_at: string;
  /** Joined supervisor profile (optional, when selected in query). */
  supervisor?: Pick<UserProfile, "id" | "full_name" | "expertise_areas"> | null;
  /** Joined student profile (optional, when selected in query). */
  student?: Pick<UserProfile, "id" | "full_name" | "university_email"> | null;
}

/**
 * One topic candidate generated by Gemini (see lib/graduation/topic-ai.ts).
 * The student always makes the final choice — these are suggestions only,
 * never auto-applied.
 */
export interface AiTopicCandidate {
  title: string;
  description: string;
}

/**
 * One match returned by the find_similar_projects() DB function,
 * optionally enriched by Gemini semantic analysis (best-effort — see
 * lib/graduation/similarity-ai.ts). Deliberately excludes student
 * identity — only topic content, status, and scores/explanation.
 */
export interface SimilarProjectMatch {
  project_id: string;
  topic_title: string | null;
  topic_description: string | null;
  status: GraduationProjectStatus;
  /** 0–1 pg_trgm similarity score. Always present, always the
   *  authoritative score — NEVER overwritten by AI. */
  similarity_score: number;
  /**
   * Gemini's semantic judgment on this specific match: true only if
   * the two topics meaningfully overlap in substance, not just wording.
   * Undefined when AI analysis hasn't run or failed (best-effort) —
   * the UI falls back to showing the trigram score alone in that case.
   */
  is_meaningfully_similar?: boolean;
  /** One-sentence Gemini explanation of why the topics are similar. */
  explanation?: string;
}

/**
 * One match returned by the find_top_supervisors() DB function.
 * matched_keywords lists which of the lecturer's expertise_areas
 * literally appeared in the topic/interest text; match_score combines
 * that count with a trigram fallback so ranking never ties at zero.
 *
 * max_capacity/current_students/available_slots are a snapshot taken
 * at the moment matching ran (Supervisor Capacity Management). They're
 * optional because cached ai_suggested_lecturers rows written before
 * this feature existed won't have them — the UI treats their absence
 * as "capacity unknown", never as "full".
 */
export interface SupervisorMatch {
  supervisor_id: string;
  full_name: string;
  university_email: string | null;
  expertise_areas: string[] | null;
  matched_keywords: string[];
  match_score: number;
  max_capacity?: number;
  current_students?: number;
  available_slots?: number;
}

/**
 * Mirrors the get_department_supervisor_capacity() DB function's
 * per-lecturer row. current_students counts ONLY status='active'
 * graduation_projects — pending requests never occupy a slot.
 */
export interface SupervisorCapacity {
  max_capacity: number;
  current_students: number;
  available_slots: number;
}

/**
 * Mirrors the `public.graduation_project_reviews` table.
 * One row per supervisor decision (accept/reject) on a project.
 * Snapshots preserve exactly what the supervisor was looking at when
 * they decided, even if the student edits the topic afterward.
 */
export interface GraduationProjectReview {
  id: string;
  project_id: string;
  supervisor_id: string;
  decision: "accepted" | "rejected";
  comments: string | null;
  topic_title_snapshot: string | null;
  topic_description_snapshot: string | null;
  created_at: string;
  /** Joined supervisor profile (optional, when selected in query). */
  supervisor?: Pick<UserProfile, "id" | "full_name"> | null;
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

/** Subset of AcademicPlan fields used when joined on announcements. */
export interface AnnouncementAcademicPlanJoin {
  id: string;
  name: string;
  department?: { name: string } | null;
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
  /** Structured targeting FK → academic_plans.id (optional; NULL = global). */
  academic_plan_id: string | null;
  /** Optional joined AcademicPlan (with nested department.name) when read
   *  via `.select(..., academic_plan:academic_plans!inner(name, department:departments(name)))`. */
  academic_plan?: AnnouncementAcademicPlanJoin | null;
  // Joined attachments
  announcement_attachments?: AnnouncementAttachment[];
}

// ── Activity Log ─────────────────────────────────────────

/**
 * Every action the audit log can record. Deliberately a TypeScript
 * string union (NOT a Postgres enum) — the `action` column in
 * `public.activity_logs` is plain `text`, so adding a new action here
 * is a type-only change, never a migration.
 *
 * Only admin / department_admin / lecturer actions are logged.
 * Students are never included.
 */
export type ActivityAction =
  | "LOGIN"
  | "LOGOUT"
  | "ACCEPT_SUPERVISION_REQUEST"
  | "REJECT_SUPERVISION_REQUEST"
  | "CREATE_LECTURER"
  | "UPDATE_LECTURER"
  | "DELETE_LECTURER"
  | "CREATE_STUDENT"
  | "UPDATE_STUDENT"
  | "DELETE_STUDENT"
  | "CREATE_COURSE"
  | "UPDATE_COURSE"
  | "DELETE_COURSE"
  | "CREATE_ANNOUNCEMENT"
  | "UPDATE_ANNOUNCEMENT"
  | "DELETE_ANNOUNCEMENT"
  | "UPDATE_USER";

/**
 * Mirrors the `public.activity_logs` table (created in migration
 * 019_activity_logs.sql). `role` is a snapshot taken at the moment of
 * the event — if a user's role changes later, past log rows keep
 * reflecting what their role WAS when the action happened.
 *
 * Written exclusively by lib/activity-log/actions.ts -> logActivity()
 * via the service-role client. No client-side or RLS-based INSERT path
 * exists for this table, by design.
 */
export interface ActivityLog {
  id: string;
  user_id: string | null;
  role: UserRole;
  action: ActivityAction;
  description: string | null;
  department_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  /** Joined actor profile (optional, when selected in query). */
  user?: Pick<UserProfile, "full_name" | "university_email"> | null;
  /** Joined department name (optional, when selected in query). */
  department?: { name: string } | null;
}

// ── Pagination ───────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}
