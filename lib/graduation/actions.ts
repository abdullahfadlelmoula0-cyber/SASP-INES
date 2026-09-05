"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { createNotification } from "@/lib/notifications/actions";
import { logActivity } from "@/lib/activity-log/actions";
import { generateAiTopics } from "@/lib/graduation/topic-ai";
import { analyzeSimilarity } from "@/lib/graduation/similarity-ai";
import {
  getDepartmentCapacityMap,
  fullLecturerIds,
  getSupervisorCapacity,
  CAPACITY_TRIGGER_MESSAGE,
  CAPACITY_FRIENDLY_MESSAGE,
} from "@/lib/graduation/capacity";
import type {
  AiTopicCandidate,
  GraduationProject,
  GraduationProjectReview,
  SimilarProjectMatch,
  SupervisorCapacity,
  SupervisorMatch,
  UserProfile,
} from "@/types";

// ────────────────────────────────────────────────────────────────
// Shared helper: non-AI (pg_trgm) topic similarity check
// ────────────────────────────────────────────────────────────────

/**
 * Runs the DB-side find_similar_projects() function (trigram similarity
 * over topic_title/topic_description across ALL projects, via a
 * SECURITY DEFINER function that never exposes student identity), then
 * persists the result onto the project row so the UI can render it
 * without recomputing. Best-effort: a failure here should never block
 * the topic-saving action that called it.
 */
async function runSimilarityCheck(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  topicTitle: string,
  topicDescription: string | null
): Promise<SimilarProjectMatch[]> {
  const { data, error } = await supabase.rpc("find_similar_projects", {
    p_topic_title: topicTitle,
    p_topic_description: topicDescription,
    p_exclude_project_id: projectId,
  });

  if (error) {
    // Non-fatal — similarity checking is informational, never a gate.
    console.error("find_similar_projects failed:", error.message);
    return [];
  }

  let matches: SimilarProjectMatch[] = (data ?? []).map((row: any) => ({
    project_id: row.project_id,
    topic_title: row.topic_title,
    topic_description: row.topic_description,
    status: row.status,
    similarity_score: row.similarity_score,
  }));

  // Semantic layer (best-effort, Gemini): only runs when the trigram
  // shortlist isn't empty, so AI cost stays proportional to actual
  // candidates — a fully distinct topic never triggers a Gemini call.
  // IMPORTANT: similarity_score above is the pg_trgm score and is NEVER
  // touched here — analyzeSimilarity() only ever ADDS
  // is_meaningfully_similar + explanation on top of it, never replaces it.
  if (matches.length > 0) {
    try {
      const aiResults = await analyzeSimilarity(topicTitle, topicDescription, matches);
      matches = matches.map((m, idx) => {
        const aiResult = aiResults.find((r) => r.index === idx);
        return aiResult
          ? {
              ...m,
              is_meaningfully_similar: aiResult.is_meaningfully_similar,
              explanation: aiResult.explanation,
            }
          : m;
      });
    } catch (aiError: any) {
      // Non-fatal — the raw trigram matches computed above are still
      // fully valid on their own and get saved below regardless.
      console.error("analyzeSimilarity failed:", aiError?.message);
    }
  }

  await supabase
    .from("graduation_projects")
    .update({ similar_projects_found: matches })
    .eq("id", projectId);

  return matches;
}

/**
 * Resolves a student's department UUID via
 * profiles.academic_plan_id → academic_plans.department_id.
 * Returns null if the student has no academic_plan_id (legacy path).
 */
async function resolveStudentDepartmentId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: UserProfile
): Promise<string | null> {
  if (!profile.academic_plan_id) return null;
  const { data } = await supabase
    .from("academic_plans")
    .select("department_id")
    .eq("id", profile.academic_plan_id)
    .single();
  return data?.department_id ?? null;
}

/**
 * Resolves a student's specialization name (structured path only).
 * Returns null for shared-trunk years or legacy-path students who have
 * no specialization_id yet.
 */
async function resolveSpecializationName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: UserProfile
): Promise<string | null> {
  if (!profile.specialization_id) return null;
  const { data } = await supabase
    .from("specializations")
    .select("name")
    .eq("id", profile.specialization_id)
    .single();
  return data?.name ?? null;
}

/**
 * Runs the DB-side find_top_supervisors() function (literal keyword
 * overlap between the topic/interest text and each lecturer's
 * expertise_areas, with trigram similarity as a fallback/tiebreaker so
 * a Top-3 is always produced), then persists the result onto
 * ai_suggested_lecturers. Best-effort: never blocks the caller.
 *
 * Supervisor Capacity Management: before calling find_top_supervisors(),
 * we fetch live capacity for the whole department and pass the IDs of
 * any lecturer at/over capacity as p_exclude_ids. Because that exclusion
 * happens INSIDE find_top_supervisors() before its internal LIMIT 3,
 * a full supervisor is removed from the pool before ranking is
 * truncated — guaranteeing the Top-3 the student sees are all
 * available, sorted purely by the existing, UNCHANGED match score.
 * The matching function's scoring/ordering logic itself is never
 * touched. Each returned match is additionally enriched with the
 * capacity snapshot (max_capacity/current_students/available_slots)
 * so the UI can render "Students: X/Y" without a second round-trip.
 */
async function runSupervisorMatching(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  departmentId: string,
  topicTitle: string,
  topicDescription: string | null,
  interestStatement: string | null
): Promise<{ suggested: SupervisorMatch[]; fullCapacity: SupervisorMatch[] }> {
  const capacityMap = await getDepartmentCapacityMap(supabase, departmentId);
  const excludeIds = fullLecturerIds(capacityMap);

  const { data, error } = await supabase.rpc("find_top_supervisors", {
    p_department_id: departmentId,
    p_topic_title: topicTitle,
    p_topic_description: topicDescription,
    p_interest_statement: interestStatement,
    p_exclude_ids: excludeIds,
  });

  if (error) {
    console.error("find_top_supervisors failed:", error.message);
    return { suggested: [], fullCapacity: [] };
  }

  const matches: SupervisorMatch[] = (data ?? []).map((row: any) => {
    const capacity = capacityMap.get(row.supervisor_id);
    return {
      supervisor_id: row.supervisor_id,
      full_name: row.full_name,
      university_email: row.university_email,
      expertise_areas: row.expertise_areas,
      matched_keywords: row.matched_keywords ?? [],
      match_score: row.match_score,
      max_capacity: capacity?.max_capacity,
      current_students: capacity?.current_students,
      available_slots: capacity?.available_slots,
    };
  });

  // Info-only: lecturers who matched the topic but were excluded above
  // for being at/over capacity. Never selectable, never part of the
  // Top-3 — purely so the student can see "this is who you'd have
  // matched with, once a slot frees up." Best-effort: a failure here
  // never blocks the (already-succeeded) Top-3 matching above.
  let fullCapacityMatches: SupervisorMatch[] = [];
  if (excludeIds.length > 0) {
    const { data: fullData, error: fullError } = await supabase.rpc("find_supervisors_by_ids", {
      p_ids: excludeIds,
      p_topic_title: topicTitle,
      p_topic_description: topicDescription,
      p_interest_statement: interestStatement,
    });
    if (fullError) {
      console.error("find_supervisors_by_ids failed:", fullError.message);
    } else {
      fullCapacityMatches = (fullData ?? []).map((row: any) => {
        const capacity = capacityMap.get(row.supervisor_id);
        return {
          supervisor_id: row.supervisor_id,
          full_name: row.full_name,
          university_email: row.university_email,
          expertise_areas: row.expertise_areas,
          matched_keywords: row.matched_keywords ?? [],
          match_score: row.match_score,
          max_capacity: capacity?.max_capacity,
          current_students: capacity?.current_students,
          available_slots: capacity?.available_slots,
        };
      });
    }
  }

  await supabase
    .from("graduation_projects")
    .update({
      ai_suggested_lecturers: matches,
      ai_full_capacity_lecturers: fullCapacityMatches,
    })
    .eq("id", projectId);

  return { suggested: matches, fullCapacity: fullCapacityMatches };
}

/**
 * Re-runs supervisor matching to refresh BOTH the live capacity numbers
 * AND list membership on the cached ai_suggested_lecturers /
 * ai_full_capacity_lecturers arrays, using the SAME topic text already
 * saved on the project (never a draft/unsaved edit) — so nothing about
 * what's being matched changes, only who currently qualifies.
 *
 * This is what guarantees "always show 3 available" rather than just
 * "show 3 cached names, some possibly greyed out": if a previously-
 * suggested lecturer has since filled up, re-running find_top_supervisors()
 * with the current (larger) exclude list naturally promotes the next-
 * best-ranked available lecturer into the Top-3 in their place, and the
 * newly-full one moves into the info-only ai_full_capacity_lecturers
 * list instead of lingering in the Top-3 as a disabled card. Called
 * every time the student's supervisor-picker screen loads.
 *
 * Best-effort/no-op when there's nothing to re-match against (no topic
 * yet, or department couldn't be resolved) — simply leaves the cached
 * lists untouched rather than erroring.
 */
export async function refreshSupervisorCapacitySnapshot(projectId: string): Promise<{
  data?: GraduationProject;
  error?: string;
}> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, topic_title, topic_description, interest_statement")
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }

    if (!project.topic_title) {
      return {};
    }

    const departmentId = await resolveStudentDepartmentId(supabase, profile);
    if (!departmentId) {
      return {};
    }

    await runSupervisorMatching(
      supabase,
      projectId,
      departmentId,
      project.topic_title,
      project.topic_description,
      project.interest_statement
    );

    // Re-fetch the FULL row (runSupervisorMatching only returns the two
    // matching arrays, not the whole project) so the caller can drop it
    // straight into state.
    const { data: updated, error } = await supabase
      .from("graduation_projects")
      .select(`*, supervisor:supervisor_id(id, full_name, expertise_areas)`)
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (error) return { error: error.message };

    return { data: updated as GraduationProject };
  } catch (err: any) {
    return { error: err.message || "Failed to refresh supervisor availability." };
  }
}

// ─────────────────────────────────────────────────────────────────
// Student-facing actions
// ─────────────────────────────────────────────────────────────────

/**
 * Returns the current student's graduation project row (if any).
 * Joins supervisor profile so the student can display their name.
 */
export async function getMyGraduationProject(): Promise<{
  data: GraduationProject | null;
  error: string | null;
}> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("graduation_projects")
      .select(
        `*, supervisor:supervisor_id(id, full_name, expertise_areas)`
      )
      .eq("student_id", profile.id)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: (data as GraduationProject | null), error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to load graduation project." };
  }
}

/**
 * Returns the student's department ID by resolving:
 *   profiles.academic_plan_id → academic_plans.department_id
 *
 * Returns null if the student has no academic_plan_id (legacy path),
 * which should be surfaced to the UI as an error state.
 */
export async function getStudentDepartmentId(): Promise<{
  departmentId: string | null;
  error: string | null;
}> {
  try {
    const profile = await requireAuth();
    if (!profile.academic_plan_id) {
      return {
        departmentId: null,
        error:
          "Your profile is not linked to an academic plan. Please contact your administrator.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academic_plans")
      .select("department_id")
      .eq("id", profile.academic_plan_id)
      .single();

    if (error || !data) {
      return { departmentId: null, error: "Could not resolve your department." };
    }

    return { departmentId: data.department_id, error: null };
  } catch (err: any) {
    return { departmentId: null, error: err.message || "Failed to resolve department." };
  }
}

/**
 * Returns all lecturer profiles whose lecturer_department_id matches
 * the given department UUID. Used to populate the supervisor picker.
 */
export async function getLecturersForDepartment(departmentId: string): Promise<{
  data: Array<Pick<UserProfile, "id" | "full_name" | "expertise_areas" | "university_email">>;
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, expertise_areas, university_email")
      .eq("role", "lecturer")
      .eq("lecturer_department_id", departmentId)
      .order("full_name", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data as any[]) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load lecturers." };
  }
}

/**
 * STEP 4 — AI Topic Generation: starts a graduation project with ONLY
 * an interest statement. Status begins at 'choosing_topic' — no topic
 * exists yet. This is the new entry point for the AI-assisted flow;
 * createGraduationProject() below remains unchanged and still exists
 * for internal reuse pattern-matching, but the UI now always starts
 * here.
 */
export async function startGraduationProject(interestStatement: string): Promise<{
  data?: GraduationProject;
  error?: string;
}> {
  try {
    const profile = await requireAuth();

    if (!interestStatement.trim()) {
      return { error: "Please describe your area of interest." };
    }

    const supabase = await createClient();

    // Prevent duplicates — a student can only have one project
    const { data: existing } = await supabase
      .from("graduation_projects")
      .select("id")
      .eq("student_id", profile.id)
      .maybeSingle();

    if (existing) {
      return { error: "You already have a graduation project in progress." };
    }

    const { data, error } = await supabase
      .from("graduation_projects")
      .insert({
        student_id: profile.id,
        interest_statement: interestStatement.trim(),
        topic_title: null,
        topic_description: null,
        status: "choosing_topic",
      })
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/graduation-project");
    return { data: data as GraduationProject };
  } catch (err: any) {
    return { error: err.message || "Failed to start graduation project." };
  }
}

/**
 * Lets the student edit their area-of-interest text while still in
 * 'choosing_topic' (before any topic has been picked). Does NOT
 * regenerate suggestions itself — the caller follows up with
 * generateTopicSuggestions() so the UI can show one combined
 * "Save & Regenerate" action.
 */
export async function updateInterestStatement(
  projectId: string,
  interestStatement: string
): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();

    if (!interestStatement.trim()) {
      return { error: "Please describe your area of interest." };
    }

    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, status")
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    if (project.status !== "choosing_topic") {
      return { error: "Your area of interest can no longer be edited directly." };
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        interest_statement: interestStatement.trim(),
        // Clear stale suggestions generated from the OLD interest text so
        // the UI never shows topics that no longer match what's saved.
        ai_suggested_topics: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    revalidatePath("/graduation-project");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to update your area of interest." };
  }
}

/**
 * STEP 4 — AI Topic Generation: calls Gemini (via topic-ai.ts) to
 * generate exactly 3 topic candidates for this project's interest
 * statement + the student's department/program/specialization/year,
 * then caches them onto ai_suggested_topics. Only valid while
 * status='choosing_topic'. Best-effort by design: any failure returns
 * a clean error and never blocks the student from writing their own
 * topic instead (that path never touches this function at all).
 * Student-initiated only — never called automatically on page load —
 * to keep free-tier API usage bounded.
 */
export async function generateTopicSuggestions(projectId: string): Promise<{
  data?: AiTopicCandidate[];
  error?: string;
}> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, status, interest_statement")
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    if (project.status !== "choosing_topic") {
      return { error: "Topic suggestions are only available before you pick a topic." };
    }

    const specializationName = await resolveSpecializationName(supabase, profile);

    let candidates: AiTopicCandidate[];
    try {
      candidates = await generateAiTopics({
        interestStatement: project.interest_statement,
        department: profile.department,
        program: profile.program,
        specializationName,
        yearOfStudy: profile.year_of_study,
      });
    } catch (aiError: any) {
      // Never let an AI failure block the student — the UI keeps the
      // "write my own topic" path enabled regardless of this error.
      return {
        error:
          aiError?.message ||
          "AI topic generation is temporarily unavailable. You can still write your own topic.",
      };
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        ai_suggested_topics: candidates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    revalidatePath("/graduation-project");
    return { data: candidates };
  } catch (err: any) {
    return { error: err.message || "Failed to generate topic suggestions." };
  }
}

/**
 * STEP 4 — AI Topic Generation: the student's final topic choice,
 * whether it came from clicking one of the 3 AI cards or from the
 * "write my own topic" manual form (identical shape either way, so
 * this action doesn't care which). Sets the topic, moves status to
 * 'choosing_supervisor', then runs the EXISTING, UNMODIFIED
 * runSimilarityCheck() and runSupervisorMatching() helpers — the same
 * calls createGraduationProject() already makes below. Neither helper
 * is touched by this feature.
 */
export async function selectTopic(input: {
  projectId: string;
  topicTitle: string;
  topicDescription?: string;
}): Promise<{
  data?: GraduationProject;
  similarProjects?: SimilarProjectMatch[];
  suggestedSupervisors?: SupervisorMatch[];
  error?: string;
}> {
  try {
    const profile = await requireAuth();

    if (!input.topicTitle.trim()) {
      return { error: "Please provide a topic title." };
    }

    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, status, interest_statement")
      .eq("id", input.projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    if (project.status !== "choosing_topic") {
      return { error: "This project has already moved past topic selection." };
    }

    const topicTitle = input.topicTitle.trim();
    const topicDescription = input.topicDescription?.trim() || null;

    const { data: updated, error } = await supabase
      .from("graduation_projects")
      .update({
        topic_title: topicTitle,
        topic_description: topicDescription,
        status: "choosing_supervisor",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.projectId)
      .eq("student_id", profile.id)
      .select()
      .single();

    if (error) return { error: error.message };

    // Existing, unmodified pipeline — identical calls to what
    // createGraduationProject() makes below. Not rewritten.
    const similarProjects = await runSimilarityCheck(
      supabase,
      input.projectId,
      topicTitle,
      topicDescription
    );

    const departmentId = await resolveStudentDepartmentId(supabase, profile);
    let suggestedSupervisors: SupervisorMatch[] = [];
    let fullCapacitySupervisors: SupervisorMatch[] = [];
    if (departmentId) {
      const matching = await runSupervisorMatching(
        supabase,
        input.projectId,
        departmentId,
        topicTitle,
        topicDescription,
        project.interest_statement
      );
      suggestedSupervisors = matching.suggested;
      fullCapacitySupervisors = matching.fullCapacity;
    }

    revalidatePath("/graduation-project");
    return {
      data: {
        ...updated,
        similar_projects_found: similarProjects,
        ai_suggested_lecturers: suggestedSupervisors,
        ai_full_capacity_lecturers: fullCapacitySupervisors,
      } as GraduationProject,
      similarProjects,
      suggestedSupervisors,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to select topic." };
  }
}

/**
 * Creates a new graduation project for the current student.
 * Status starts at 'choosing_supervisor' — topic is collected
 * together with the interest statement in this manual phase.
 * Runs the non-AI similarity check immediately so the student sees
 * results before picking a supervisor.
 */
export async function createGraduationProject(input: {
  interest_statement: string;
  topic_title: string;
  topic_description: string;
}): Promise<{ data?: GraduationProject; similarProjects?: SimilarProjectMatch[]; error?: string }> {
  try {
    const profile = await requireAuth();

    if (!input.interest_statement.trim()) {
      return { error: "Please describe your area of interest." };
    }
    if (!input.topic_title.trim()) {
      return { error: "Please provide a topic title." };
    }

    const supabase = await createClient();

    // Prevent duplicates — a student can only have one project
    const { data: existing } = await supabase
      .from("graduation_projects")
      .select("id")
      .eq("student_id", profile.id)
      .maybeSingle();

    if (existing) {
      return { error: "You already have a graduation project in progress." };
    }

    const { data, error } = await supabase
      .from("graduation_projects")
      .insert({
        student_id: profile.id,
        interest_statement: input.interest_statement.trim(),
        topic_title: input.topic_title.trim(),
        topic_description: input.topic_description.trim() || null,
        status: "choosing_supervisor",
      })
      .select()
      .single();

    if (error) return { error: error.message };

    const similarProjects = await runSimilarityCheck(
      supabase,
      data.id,
      input.topic_title.trim(),
      input.topic_description.trim() || null
    );

    const departmentId = await resolveStudentDepartmentId(supabase, profile);
    let suggestedSupervisors: SupervisorMatch[] = [];
    let fullCapacitySupervisors: SupervisorMatch[] = [];
    if (departmentId) {
      const matching = await runSupervisorMatching(
        supabase,
        data.id,
        departmentId,
        input.topic_title.trim(),
        input.topic_description.trim() || null,
        input.interest_statement.trim()
      );
      suggestedSupervisors = matching.suggested;
      fullCapacitySupervisors = matching.fullCapacity;
    }

    revalidatePath("/graduation-project");
    return {
      data: {
        ...data,
        similar_projects_found: similarProjects,
        ai_suggested_lecturers: suggestedSupervisors,
        ai_full_capacity_lecturers: fullCapacitySupervisors,
      } as GraduationProject,
      similarProjects,
    };
  } catch (err: any) {
    return { error: err.message || "Failed to create graduation project." };
  }
}

/**
 * Student edits their topic while still in 'choosing_supervisor'
 * (i.e. before any request has been sent), and re-runs the similarity
 * check against the revised text. Does not touch status/supervisor.
 */
export async function updateTopic(input: {
  projectId: string;
  topicTitle: string;
  topicDescription?: string;
}): Promise<{
  similarProjects?: SimilarProjectMatch[];
  suggestedSupervisors?: SupervisorMatch[];
  fullCapacitySupervisors?: SupervisorMatch[];
  error?: string;
}> {
  try {
    const profile = await requireAuth();

    if (!input.topicTitle.trim()) {
      return { error: "Please provide a topic title." };
    }

    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, status, interest_statement")
      .eq("id", input.projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    if (project.status !== "choosing_supervisor") {
      return { error: "This topic can no longer be edited directly. Use the revise-and-resend flow instead." };
    }

    const topicTitle = input.topicTitle.trim();
    const topicDescription = input.topicDescription?.trim() || null;

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        topic_title: topicTitle,
        topic_description: topicDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    const similarProjects = await runSimilarityCheck(
      supabase,
      input.projectId,
      topicTitle,
      topicDescription
    );

    const departmentId = await resolveStudentDepartmentId(supabase, profile);
    let suggestedSupervisors: SupervisorMatch[] = [];
    let fullCapacitySupervisors: SupervisorMatch[] = [];
    if (departmentId) {
      const matching = await runSupervisorMatching(
        supabase,
        input.projectId,
        departmentId,
        topicTitle,
        topicDescription,
        project.interest_statement
      );
      suggestedSupervisors = matching.suggested;
      fullCapacitySupervisors = matching.fullCapacity;
    }

    revalidatePath("/graduation-project");
    return { similarProjects, suggestedSupervisors, fullCapacitySupervisors };
  } catch (err: any) {
    return { error: err.message || "Failed to update topic." };
  }
}

/**
 * Sends the student all the way back to the full topic-selection screen
 * (status → 'choosing_topic') from 'choosing_supervisor', so they can
 * either get fresh AI suggestions (after optionally editing their area
 * of interest) or write a brand new topic by hand — the same rich
 * experience as the very first time, instead of the bare inline
 * title/description box that updateTopic() offers.
 *
 * Nothing is deleted: interest_statement, topic_title/description, and
 * any cached ai_suggested_topics are left exactly as they are. They
 * simply get overwritten the moment the student picks a topic again via
 * selectTopic(), which already re-runs similarity + supervisor matching
 * from scratch — so there's no stale-data risk in leaving them in place.
 * Valid from three points: 'choosing_supervisor' (no request sent yet),
 * 'rejected_by_supervisor', and 'all_supervisors_rejected' (both are
 * dead ends otherwise — this is the escape hatch that lets a student
 * pick a genuinely different topic and get a FRESH Top-3 match instead
 * of being stuck). Never valid once a request is actively pending or
 * accepted ('pending_supervisor', 'active', 'completed') — those must
 * go through their own flows.
 *
 * NOTE: this does not touch rejected_supervisor_ids or clear
 * ai_suggested_lecturers/similar_projects_found — selectTopic()
 * recomputes both from scratch the moment a new topic is chosen, so
 * old cached data here is simply superseded, never stale-served.
 */
export async function restartTopicSelection(projectId: string): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, status")
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    const restartableStatuses = [
      "choosing_supervisor",
      "rejected_by_supervisor",
      "all_supervisors_rejected",
    ];
    if (!restartableStatuses.includes(project.status)) {
      return { error: "Topic selection can't be restarted at this stage." };
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        status: "choosing_topic",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    revalidatePath("/graduation-project");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to restart topic selection." };
  }
}

/**
 * Undoes restartTopicSelection() — takes the student back to whatever
 * screen they were actually on before they clicked "Redo Topic
 * Selection" / "Start Over With a New Topic", instead of forcing them
 * forward through topic selection if they change their mind.
 *
 * restartTopicSelection() never deletes topic_title/topic_description,
 * supervisor_id, rejected_supervisor_ids, or ai_suggested_lecturers —
 * it only flips status to 'choosing_topic'. So the previous screen is
 * fully reconstructable from what's still on the row, using the exact
 * same rules the rest of the workflow already uses to decide status:
 *
 *   - topic_title is null            → nothing to go back to (this is
 *                                       a brand-new project, not a
 *                                       restart) — refuse.
 *   - supervisor_id is null          → they were in 'choosing_supervisor'
 *                                       (topic chosen, no request sent yet).
 *   - pool exhausted (every ai_suggested_lecturers id has been tried,
 *     same check rejectRequest() uses)  → 'all_supervisors_rejected'.
 *   - otherwise                      → 'rejected_by_supervisor'
 *                                       (supervisor_id still points at
 *                                       whoever most recently rejected).
 *
 * Only valid while status = 'choosing_topic'. No fields are modified
 * besides status — nothing to restore, since nothing was ever cleared.
 */
export async function cancelTopicRestart(projectId: string): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, status, topic_title, supervisor_id, rejected_supervisor_ids, ai_suggested_lecturers")
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    if (project.status !== "choosing_topic") {
      return { error: "There's nothing to go back from at this stage." };
    }
    if (!project.topic_title) {
      return { error: "There's no previous screen to return to." };
    }

    let targetStatus: string;
    if (!project.supervisor_id) {
      targetStatus = "choosing_supervisor";
    } else {
      const suggestedIds: string[] = (
        (project.ai_suggested_lecturers as SupervisorMatch[] | null) ?? []
      ).map((s) => s.supervisor_id);
      const triedIds = new Set([
        ...(project.rejected_supervisor_ids ?? []),
        project.supervisor_id,
      ]);
      const poolExhausted =
        suggestedIds.length > 0 && suggestedIds.every((id) => triedIds.has(id));
      targetStatus = poolExhausted ? "all_supervisors_rejected" : "rejected_by_supervisor";
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    revalidatePath("/graduation-project");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to go back." };
  }
}

/**
 * Standalone re-check (e.g. a manual "Re-check similarity" button)
 * using whatever topic text is currently saved on the project.
 */
export async function checkTopicSimilarity(projectId: string): Promise<{
  similarProjects?: SimilarProjectMatch[];
  error?: string;
}> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, topic_title, topic_description")
      .eq("id", projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project || !project.topic_title) {
      return { error: "Project not found or has no topic yet." };
    }

    const similarProjects = await runSimilarityCheck(
      supabase,
      projectId,
      project.topic_title,
      project.topic_description
    );

    return { similarProjects };
  } catch (err: any) {
    return { error: err.message || "Failed to check similarity." };
  }
}

/**
 * Live, non-persisting similarity check for DRAFT text the student is
 * still typing — used before a project even exists (initial topic form)
 * and while revising after a rejection, so results reflect what's in
 * the input right now, not what's saved in the database yet.
 */
export async function previewTopicSimilarity(input: {
  topicTitle: string;
  topicDescription?: string;
  excludeProjectId?: string;
}): Promise<{ similarProjects?: SimilarProjectMatch[]; error?: string }> {
  try {
    await requireAuth();

    if (!input.topicTitle.trim()) {
      return { error: "Please provide a topic title first." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("find_similar_projects", {
      p_topic_title: input.topicTitle.trim(),
      p_topic_description: input.topicDescription?.trim() || null,
      p_exclude_project_id: input.excludeProjectId ?? null,
    });

    if (error) return { error: error.message };

    const similarProjects: SimilarProjectMatch[] = (data ?? []).map((row: any) => ({
      project_id: row.project_id,
      topic_title: row.topic_title,
      topic_description: row.topic_description,
      status: row.status,
      similarity_score: row.similarity_score,
    }));

    return { similarProjects };
  } catch (err: any) {
    return { error: err.message || "Failed to check similarity." };
  }
}

/**
 * Student picks a supervisor for the first time.
 * Validates that the chosen supervisor is one of the project's
 * cached Top-3 ai_suggested_lecturers (same rule chooseDifferentSupervisor
 * already enforces) — skipped only when the list is empty (legacy
 * project / department resolution failed at creation time), so a
 * missing AI match never hard-blocks the manual flow.
 * Sets status → 'pending_supervisor' and notifies the lecturer.
 */
export async function chooseSupervisor(input: {
  projectId: string;
  supervisorId: string;
}): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    // Fetch project + current topic for the notification body
    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, topic_title, student_id, status, ai_suggested_lecturers")
      .eq("id", input.projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }

    const suggestedIds: string[] = (
      (project.ai_suggested_lecturers as SupervisorMatch[] | null) ?? []
    ).map((s) => s.supervisor_id);
    if (suggestedIds.length > 0 && !suggestedIds.includes(input.supervisorId)) {
      return { error: "You can only select from your suggested supervisors." };
    }

    // Soft capacity check (Supervisor Capacity Management): re-reads
    // LIVE capacity rather than trusting the possibly-stale cached
    // ai_suggested_lecturers snapshot, so a student never sends a
    // request to someone who filled up since matching last ran. The
    // hard guarantee against overbooking is the enforce_supervisor_capacity()
    // DB trigger at accept time — this is just an earlier, clearer error.
    const capacity = await getSupervisorCapacity(supabase, input.supervisorId);
    if (capacity && capacity.available_slots <= 0) {
      return { error: CAPACITY_FRIENDLY_MESSAGE };
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        supervisor_id: input.supervisorId,
        status: "pending_supervisor",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    // Notify the lecturer
    await createNotification({
      recipientId: input.supervisorId,
      type: "graduation_request",
      title: "New supervision request",
      body: `${profile.full_name} is requesting supervision for: "${project.topic_title ?? "a graduation project"}"`,
      link: "/supervision-requests",
    });

    revalidatePath("/graduation-project");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to choose supervisor." };
  }
}

/**
 * Returns the full decision history (accept/reject + comments) for a
 * project, most recent first. Used by the student to read supervisor
 * feedback, and by the UI to show "who rejected and why".
 * RLS restricts this to the student who owns the project, the
 * supervisor(s) involved, or an admin.
 */
export async function getProjectReviews(projectId: string): Promise<{
  data: GraduationProjectReview[];
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("graduation_project_reviews")
      .select(`*, supervisor:supervisor_id(id, full_name)`)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data as GraduationProjectReview[]) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load review history." };
  }
}

/**
 * Student revises the topic and resends the SAME proposal to the SAME
 * supervisor who just rejected it (Option 1 from the rejection flow).
 * Only valid while status = 'rejected_by_supervisor' and a supervisor
 * is still attached to the project (we never null supervisor_id on
 * rejection — it always points at "who this request currently targets").
 */
export async function resendToSameSupervisor(input: {
  projectId: string;
  topicTitle: string;
  topicDescription?: string;
}): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();

    if (!input.topicTitle.trim()) {
      return { error: "Please provide a topic title." };
    }

    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, supervisor_id, status")
      .eq("id", input.projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }
    if (project.status !== "rejected_by_supervisor" || !project.supervisor_id) {
      return { error: "This project isn't awaiting a resend." };
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        topic_title: input.topicTitle.trim(),
        topic_description: input.topicDescription?.trim() || null,
        status: "pending_supervisor",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    await runSimilarityCheck(
      supabase,
      input.projectId,
      input.topicTitle.trim(),
      input.topicDescription?.trim() || null
    );

    await createNotification({
      recipientId: project.supervisor_id,
      type: "graduation_request_revised",
      title: "Revised supervision request",
      body: `${profile.full_name} has revised their proposal based on your feedback and resubmitted it for your review.`,
      link: "/supervision-requests",
    });

    revalidatePath("/graduation-project");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to resend request." };
  }
}

/**
 * Student moves on to a DIFFERENT supervisor after a rejection
 * (Option 2 from the rejection flow), optionally revising the topic
 * at the same time. The previously-targeted supervisor is recorded in
 * rejected_supervisor_ids so they aren't offered again and so the
 * pool-exhaustion check works.
 */
export async function chooseDifferentSupervisor(input: {
  projectId: string;
  supervisorId: string;
  topicTitle?: string;
  topicDescription?: string;
}): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, topic_title, supervisor_id, status, rejected_supervisor_ids, ai_suggested_lecturers")
      .eq("id", input.projectId)
      .eq("student_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or access denied." };
    }

    const priorRejected: string[] = project.rejected_supervisor_ids ?? [];

    if (input.supervisorId === project.supervisor_id) {
      return { error: "Use the resend option to send a revised proposal to the same supervisor." };
    }
    if (priorRejected.includes(input.supervisorId)) {
      return { error: "You've already moved on from this supervisor and can't select them again." };
    }

    // Switching is restricted to the original Top-3 suggested supervisors
    // (per the approved workflow: student may only move to one of the 3
    // suggested, not browse the whole department). Skipped only for
    // legacy projects created before matching existed (empty list).
    const suggestedIds: string[] = (
      (project.ai_suggested_lecturers as SupervisorMatch[] | null) ?? []
    ).map((s) => s.supervisor_id);
    if (suggestedIds.length > 0 && !suggestedIds.includes(input.supervisorId)) {
      return { error: "You can only switch to one of your originally suggested supervisors." };
    }

    // Soft capacity check (Supervisor Capacity Management) — see the
    // identical check in chooseSupervisor() for the rationale. The hard
    // guarantee is still the DB trigger at accept time.
    const capacity = await getSupervisorCapacity(supabase, input.supervisorId);
    if (capacity && capacity.available_slots <= 0) {
      return { error: CAPACITY_FRIENDLY_MESSAGE };
    }

    // Lock in the previous supervisor as "passed over" once the student
    // formally moves away from them.
    const nextRejected = project.supervisor_id && !priorRejected.includes(project.supervisor_id)
      ? [...priorRejected, project.supervisor_id]
      : priorRejected;

    const updatePayload: Record<string, any> = {
      supervisor_id: input.supervisorId,
      status: "pending_supervisor",
      rejected_supervisor_ids: nextRejected,
      updated_at: new Date().toISOString(),
    };
    if (input.topicTitle?.trim()) {
      updatePayload.topic_title = input.topicTitle.trim();
    }
    if (input.topicDescription !== undefined) {
      updatePayload.topic_description = input.topicDescription.trim() || null;
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update(updatePayload)
      .eq("id", input.projectId)
      .eq("student_id", profile.id);

    if (error) return { error: error.message };

    if (updatePayload.topic_title || updatePayload.topic_description !== undefined) {
      await runSimilarityCheck(
        supabase,
        input.projectId,
        updatePayload.topic_title ?? project.topic_title ?? "",
        updatePayload.topic_description ?? null
      );
    }

    await createNotification({
      recipientId: input.supervisorId,
      type: "graduation_request",
      title: "New supervision request",
      body: `${profile.full_name} is requesting supervision for: "${updatePayload.topic_title ?? project.topic_title ?? "a graduation project"}"`,
      link: "/supervision-requests",
    });

    revalidatePath("/graduation-project");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to choose supervisor." };
  }
}

// ─────────────────────────────────────────────────────────────────
// Lecturer-facing actions
// ─────────────────────────────────────────────────────────────────

/**
 * Returns all graduation projects assigned to the current lecturer,
 * grouped implicitly by status. Joins the student profile for display.
 */
export async function getLecturerRequests(): Promise<{
  data: GraduationProject[];
  error: string | null;
}> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("graduation_projects")
      .select(`*, student:student_id(id, full_name, university_email)`)
      .eq("supervisor_id", profile.id)
      .order("updated_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data as GraduationProject[]) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load requests." };
  }
}

/**
 * Fetches one graduation project scoped strictly to the CURRENT
 * lecturer being its assigned supervisor (used by the read-only
 * chapter-review pages under /supervision-requests/[projectId]/chapters).
 * Returns an explicit error rather than relying solely on RLS silently
 * returning nothing, so the UI can show a clear "not your project"
 * message instead of a confusing empty state.
 */
export async function getProjectForSupervisorView(projectId: string): Promise<{
  data?: GraduationProject;
  error?: string;
}> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("graduation_projects")
      .select(`*, student:student_id(id, full_name, university_email)`)
      .eq("id", projectId)
      .eq("supervisor_id", profile.id)
      .single();

    if (error || !data) {
      return { error: "Project not found or you are not the assigned supervisor." };
    }

    return { data: data as GraduationProject };
  } catch (err: any) {
    return { error: err.message || "Failed to load project." };
  }
}

/**
 * Lecturer accepts a supervision request → status = 'active'.
 * Notifies the student.
 */
export async function acceptRequest(projectId: string): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    // Fetch project to get student_id + topic for notification
    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, topic_title")
      .eq("id", projectId)
      .eq("supervisor_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or you are not the assigned supervisor." };
    }

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) {
      // Supervisor Capacity Management: the enforce_supervisor_capacity()
      // DB trigger raises this exact message when accepting would push
      // the supervisor over max_supervision_capacity. This is the hard,
      // race-safe guarantee (row-locked at the DB level) — it can fire
      // even if the soft checks earlier in the flow passed, e.g. another
      // student was accepted moments before this request was approved.
      if (error.message?.includes(CAPACITY_TRIGGER_MESSAGE)) {
        return { error: CAPACITY_FRIENDLY_MESSAGE };
      }
      return { error: error.message };
    }

    // Record the decision in the review history (audit trail)
    await supabase.from("graduation_project_reviews").insert({
      project_id: projectId,
      supervisor_id: profile.id,
      decision: "accepted",
      topic_title_snapshot: project.topic_title ?? null,
    });

    await logActivity({
      userId: profile.id,
      role: profile.role,
      action: "ACCEPT_SUPERVISION_REQUEST",
      description: `Accepted supervision request: "${project.topic_title ?? "untitled project"}"`,
      metadata: { projectId, studentId: project.student_id },
    });

    // Notify the student
    await createNotification({
      recipientId: project.student_id,
      type: "supervision_accepted",
      title: "Supervision request accepted! 🎉",
      body: `${profile.full_name} has accepted to supervise your graduation project: "${project.topic_title ?? "your project"}"`,
      link: "/graduation-project",
    });

    revalidatePath("/supervision-requests");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to accept request." };
  }
}

/**
 * Lecturer rejects a supervision request, with required comments
 * explaining why. Sets status = 'rejected_by_supervisor'.
 *
 * NOTE: supervisor_id is intentionally NOT nulled here — it keeps
 * pointing at the supervisor who just rejected, so the student can
 * either resend a revised proposal to them directly, or formally move
 * on to a different supervisor (chooseDifferentSupervisor, which is
 * what records this supervisor into rejected_supervisor_ids).
 */
export async function rejectRequest(
  projectId: string,
  comments: string
): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();

    if (!comments.trim()) {
      return { error: "Please explain why you're declining this request." };
    }

    const supabase = await createClient();

    // Fetch project for notification + review snapshot
    const { data: project, error: fetchError } = await supabase
      .from("graduation_projects")
      .select("id, student_id, topic_title, topic_description, rejected_supervisor_ids, ai_suggested_lecturers")
      .eq("id", projectId)
      .eq("supervisor_id", profile.id)
      .single();

    if (fetchError || !project) {
      return { error: "Project not found or you are not the assigned supervisor." };
    }

    // If this rejection covers the LAST un-tried supervisor among the
    // original Top-3 suggested, there's no one left to switch to —
    // route straight to 'all_supervisors_rejected' instead of leaving
    // the student on a switch-picker with zero options. Only applies
    // when suggestions actually exist (legacy projects keep old behavior).
    const suggestedIds: string[] = (
      (project.ai_suggested_lecturers as SupervisorMatch[] | null) ?? []
    ).map((s) => s.supervisor_id);
    const triedIds = new Set([...(project.rejected_supervisor_ids ?? []), profile.id]);
    const poolExhausted =
      suggestedIds.length > 0 && suggestedIds.every((id) => triedIds.has(id));

    const { error } = await supabase
      .from("graduation_projects")
      .update({
        status: poolExhausted ? "all_supervisors_rejected" : "rejected_by_supervisor",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    if (error) return { error: error.message };

    // Record the decision + comments in the review history
    await supabase.from("graduation_project_reviews").insert({
      project_id: projectId,
      supervisor_id: profile.id,
      decision: "rejected",
      comments: comments.trim(),
      topic_title_snapshot: project.topic_title ?? null,
      topic_description_snapshot: project.topic_description ?? null,
    });

    await logActivity({
      userId: profile.id,
      role: profile.role,
      action: "REJECT_SUPERVISION_REQUEST",
      description: `Declined supervision request: "${project.topic_title ?? "untitled project"}"`,
      metadata: { projectId, studentId: project.student_id, poolExhausted },
    });

    // Notify the student
    await createNotification({
      recipientId: project.student_id,
      type: "supervision_rejected",
      title: "Supervision request declined",
      body: poolExhausted
        ? `${profile.full_name} declined your request: "${comments.trim()}". You've now heard back from all your suggested supervisors — please contact your administrator for next steps.`
        : `${profile.full_name} declined your request: "${comments.trim()}"`,
      link: "/graduation-project",
    });

    revalidatePath("/supervision-requests");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to reject request." };
  }
}

// ─────────────────────────────────────────────────────────────────
// Supervisor Capacity Management (lecturer self-service)
// ─────────────────────────────────────────────────────────────────

/**
 * Returns the current lecturer's own supervision capacity
 * (max / current / available), for the "Supervision Capacity" section
 * of the lecturer dashboard. current_students counts ONLY
 * status='active' projects.
 */
export async function getMyCapacity(): Promise<{
  data?: SupervisorCapacity;
  error?: string;
}> {
  try {
    const profile = await requireAuth();
    if (profile.role !== "lecturer") {
      return { error: "Only lecturers have a supervision capacity." };
    }

    const supabase = await createClient();
    const capacity = await getSupervisorCapacity(supabase, profile.id);
    if (!capacity) {
      return { error: "Failed to load your supervision capacity." };
    }

    return { data: capacity };
  } catch (err: any) {
    return { error: err.message || "Failed to load your supervision capacity." };
  }
}

/**
 * Lets a lecturer set their own max_supervision_capacity. Relies on
 * the profiles_update_lecturer_capacity RLS policy, which allows a
 * lecturer to change ONLY this one field on their own row — every
 * other protected field (role, expertise_areas, department, etc.) is
 * enforced unchanged at the database level regardless of what this
 * action sends.
 */
export async function updateMyCapacity(newMax: number): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    if (profile.role !== "lecturer") {
      return { error: "Only lecturers can set a supervision capacity." };
    }
    if (!Number.isInteger(newMax) || newMax < 1) {
      return { error: "Capacity must be a positive whole number." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ max_supervision_capacity: newMax })
      .eq("id", profile.id);

    if (error) return { error: error.message };

    revalidatePath("/supervision-requests");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to update your supervision capacity." };
  }
}
