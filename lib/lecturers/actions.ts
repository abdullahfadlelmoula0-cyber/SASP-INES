"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logActivity } from "@/lib/activity-log/actions";
import {
  lecturerSchema,
  parseExpertiseAreas,
  type LecturerFormData,
} from "@/lib/lecturers/schema";

// Re-exported so existing imports of the type from actions.ts keep working.
// (Types are erased at compile time, so re-exporting a type from a
// "use server" file is fine — only non-function runtime values aren't allowed.)
export type { LecturerFormData };

// ── Public actions ────────────────────────────────────────────────

/**
 * Fetch all lecturer profiles joined with their department name.
 * Only callable by a general admin (requireAdmin guard).
 */
export async function getAllLecturers(): Promise<{
  data: Array<{
    id: string;
    full_name: string;
    university_email: string | null;
    lecturer_department_id: string | null;
    department_name: string | null;
    expertise_areas: string[] | null;
  }>;
  error: string | null;
}> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, university_email, lecturer_department_id, expertise_areas, departments:lecturer_department_id(name)"
      )
      .eq("role", "lecturer")
      .order("full_name", { ascending: true });

    if (error) return { data: [], error: error.message };

    const mapped = (data ?? []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      university_email: row.university_email,
      lecturer_department_id: row.lecturer_department_id,
      department_name: row.departments?.name ?? null,
      expertise_areas: row.expertise_areas ?? null,
    }));

    return { data: mapped, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load lecturers." };
  }
}

/**
 * Create a new lecturer Auth user + profile row.
 * Mirrors the exact pattern used by createStudent() in lib/students/actions.ts.
 */
export async function createLecturer(data: LecturerFormData): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const actor = await requireAdmin();

    const parsed = lecturerSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    const expertiseAreas = parseExpertiseAreas(parsed.data.expertise_areas_raw);
    const supabaseAdmin = createAdminClient();

    // 1. Create the Supabase Auth user (requires service_role key)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password || "12345678",
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: "lecturer",
      },
    });

    if (authError) return { error: authError.message };

    // 2. Insert the profiles row with role='lecturer' and lecturer-specific columns
    const supabase = await createClient();
    const { error: profileError } = await supabase.from("profiles").upsert([
      {
        id: authData.user.id,
        full_name: parsed.data.full_name,
        university_email: parsed.data.email,
        // Keep generic display fields consistent (not used for lecturer matching).
        // year_of_study must be >= 1 to satisfy the profiles_year_of_study_check
        // constraint — lecturers don't use this field, so 1 is just a harmless filler.
        department: "",
        program: "",
        year_of_study: 1,
        role: "lecturer",
        lecturer_department_id: parsed.data.lecturer_department_id,
        expertise_areas: expertiseAreas.length > 0 ? expertiseAreas : null,
        updated_at: new Date().toISOString(),
      },
    ]);

    if (profileError) return { error: profileError.message };

    await logActivity({
      userId: actor.id,
      role: actor.role,
      action: "CREATE_LECTURER",
      description: `Created lecturer account: ${parsed.data.full_name}`,
      metadata: { lecturerId: authData.user.id, email: parsed.data.email },
    });

    revalidatePath("/admin/lecturers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to create lecturer account." };
  }
}

/**
 * Update an existing lecturer's profile fields.
 * Does NOT change the Auth email or password — only the profile row.
 */
export async function updateLecturer(
  id: string,
  data: LecturerFormData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const actor = await requireAdmin();

    const parsed = lecturerSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    const expertiseAreas = parseExpertiseAreas(parsed.data.expertise_areas_raw);
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.full_name,
        university_email: parsed.data.email,
        lecturer_department_id: parsed.data.lecturer_department_id,
        expertise_areas: expertiseAreas.length > 0 ? expertiseAreas : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("role", "lecturer"); // Safety: never accidentally update non-lecturers

    if (error) return { error: error.message };

    await logActivity({
      userId: actor.id,
      role: actor.role,
      action: "UPDATE_LECTURER",
      description: `Updated lecturer profile: ${parsed.data.full_name}`,
      metadata: { lecturerId: id },
    });

    revalidatePath("/admin/lecturers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to update lecturer." };
  }
}

/**
 * Delete a lecturer's profile row.
 * Note: this removes the profile but not the Auth user. The Auth user
 * will be unable to log in usefully without a profile row.
 */
export async function deleteLecturer(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const actor = await requireAdmin();
    const supabase = await createClient();

    // Guard: a lecturer who has submitted graduation project reviews can't
    // be removed — their reviews reference them and must keep a supervisor
    // on record. Check up front so we can show a clear message instead of
    // a raw database constraint error.
    const { count: reviewCount, error: reviewCheckError } = await supabase
      .from("graduation_project_reviews")
      .select("id", { count: "exact", head: true })
      .eq("supervisor_id", id);

    if (reviewCheckError) return { error: reviewCheckError.message };

    if (reviewCount && reviewCount > 0) {
      return {
        error: `This lecturer can't be removed because they have submitted ${reviewCount} graduation project review${reviewCount === 1 ? "" : "s"}. Reassign or resolve those reviews first.`,
      };
    }

    // Fetch the name before deleting so the audit log entry is readable
    // (the row won't exist anymore once we delete it below).
    const { data: lecturerRow } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", id)
      .single();
    const lecturerName = lecturerRow?.full_name ?? null;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id)
      .eq("role", "lecturer");

    if (error) return { error: error.message };

    await logActivity({
      userId: actor.id,
      role: actor.role,
      action: "DELETE_LECTURER",
      description: `Deleted lecturer account: ${lecturerName ?? id}`,
      metadata: { lecturerId: id },
    });

    revalidatePath("/admin/lecturers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete lecturer." };
  }
}

/**
 * Fetch a single lecturer's full profile plus everything they're involved
 * in: graduation projects they supervise and reviews they've submitted.
 * Used by the lecturer detail view (admin-only, opened by clicking a name).
 */
export async function getLecturerDetail(id: string): Promise<{
  data: {
    id: string;
    full_name: string;
    university_email: string | null;
    lecturer_department_id: string | null;
    department_name: string | null;
    expertise_areas: string[] | null;
    updated_at: string | null;
    supervised_projects: Array<{
      id: string;
      topic_title: string | null;
      status: string;
      student_name: string | null;
      created_at: string;
    }>;
    reviews: Array<{
      id: string;
      decision: string;
      comments: string | null;
      topic_title_snapshot: string | null;
      created_at: string;
    }>;
  } | null;
  error: string | null;
}> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, university_email, lecturer_department_id, expertise_areas, updated_at, departments:lecturer_department_id(name)"
      )
      .eq("id", id)
      .eq("role", "lecturer")
      .single();

    if (profileError || !profile) {
      return { data: null, error: profileError?.message ?? "Lecturer not found." };
    }

    const [{ data: projects, error: projectsError }, { data: reviews, error: reviewsError }] =
      await Promise.all([
        supabase
          .from("graduation_projects")
          .select("id, topic_title, status, created_at, profiles:student_id(full_name)")
          .eq("supervisor_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("graduation_project_reviews")
          .select("id, decision, comments, topic_title_snapshot, created_at")
          .eq("supervisor_id", id)
          .order("created_at", { ascending: false }),
      ]);

    if (projectsError) return { data: null, error: projectsError.message };
    if (reviewsError) return { data: null, error: reviewsError.message };

    const row = profile as any;

    return {
      data: {
        id: row.id,
        full_name: row.full_name,
        university_email: row.university_email,
        lecturer_department_id: row.lecturer_department_id,
        department_name: row.departments?.name ?? null,
        expertise_areas: row.expertise_areas ?? null,
        updated_at: row.updated_at ?? null,
        supervised_projects: (projects ?? []).map((p: any) => ({
          id: p.id,
          topic_title: p.topic_title,
          status: p.status,
          student_name: p.profiles?.full_name ?? null,
          created_at: p.created_at,
        })),
        reviews: (reviews ?? []).map((r: any) => ({
          id: r.id,
          decision: r.decision,
          comments: r.comments,
          topic_title_snapshot: r.topic_title_snapshot,
          created_at: r.created_at,
        })),
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to load lecturer details." };
  }
}

/**
 * Delete a single graduation project review, freeing up its lecturer to be
 * removed once they have none left. Admin-only — called from the lecturer
 * detail view after an explicit confirmation prompt.
 */
export async function deleteLecturerReview(
  reviewId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("graduation_project_reviews")
      .delete()
      .eq("id", reviewId);

    if (error) return { error: error.message };

    revalidatePath("/admin/lecturers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete review." };
  }
}

/**
 * Fetch all departments for the department dropdown in the lecturer form.
 */
export async function getDepartmentsForLecturerForm(): Promise<{
  data: Array<{ id: string; name: string }>;
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load departments." };
  }
}
