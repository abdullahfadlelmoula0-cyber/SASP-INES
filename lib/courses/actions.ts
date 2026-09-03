"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log/actions";

// Zod schema for course input
export const courseSchema = z.object({
  code: z.string().trim().min(1, "Course code is required").max(20, "Code is too long"),
  title: z.string().trim().min(1, "Course title is required").max(200, "Title is too long"),
  description: z.string().trim().nullable().optional(),
  credits: z.number().int().min(1, "Credits must be a positive number"),
  instructor: z.string().trim().nullable().optional(),
  department: z.string().trim().min(1, "Department is required"),
  program: z.string().trim().min(1, "Program is required"),
  year_of_study: z.number().int().min(1, "Year of study must be at least 1"),
  academic_year: z.string().trim().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return new Date(data.start_date) <= new Date(data.end_date);
    }
    return true;
  },
  {
    message: "End date cannot be before start date",
    path: ["end_date"],
  }
);

export type CourseFormData = z.infer<typeof courseSchema>;

/**
 * Returns the department ID the current actor is scoped to.
 * General admin → null (no restriction)
 * department_admin → their managed_department_id
 */
async function getCourseActorScope(): Promise<string | null> {
  const actor = await requireAdminOrDepartmentAdmin();
  if (actor.role === "admin") return null;
  return actor.managed_department_id ?? null;
}

/**
 * Checks if the current actor can manage courses for the given academic plan.
 * Returns true if the plan belongs to the actor's department.
 */
async function canManageCourseForPlan(academicPlanId: string): Promise<boolean> {
  const deptId = await getCourseActorScope();
  if (!deptId) return true; // general admin

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("academic_plans")
    .select("department_id")
    .eq("id", academicPlanId)
    .single();

  return plan?.department_id === deptId;
}

export async function createCourse(data: CourseFormData) {
  const actor = await requireAdminOrDepartmentAdmin();
  const supabase = await createClient();

  const parsed = courseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  // Department admin: check scope
  if (actor.role === "department_admin") {
    // Verify the department matches
    if (parsed.data.department) {
      const { data: dept } = await supabase
        .from("departments")
        .select("id")
        .eq("name", parsed.data.department)
        .single();
      if (dept?.id !== actor.managed_department_id) {
        return { error: "You can only create courses in your own department." };
      }
    }
  }

  const { error } = await supabase.from("courses").insert([parsed.data]);

  if (error) {
    console.error("Supabase insert error:", error);
    if (error.code === "23505") { // unique constraint
      return { error: "A course with this code already exists for this program and academic year." };
    }
    return { error: "Failed to create course. Please try again." };
  }

  await logActivity({
    userId: actor.id,
    role: actor.role,
    action: "CREATE_COURSE",
    description: `Created course: ${parsed.data.code} — ${parsed.data.title}`,
    departmentId: actor.role === "department_admin" ? (actor.managed_department_id ?? null) : null,
  });

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateCourse(id: string, data: CourseFormData) {
  const actor = await requireAdminOrDepartmentAdmin();
  const supabase = await createClient();

  const parsed = courseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  // Department admin: check scope
  if (actor.role === "department_admin") {
    if (parsed.data.department) {
      const { data: dept } = await supabase
        .from("departments")
        .select("id")
        .eq("name", parsed.data.department)
        .single();
      if (dept?.id !== actor.managed_department_id) {
        return { error: "You can only edit courses in your own department." };
      }
    }
  }

  const { error } = await supabase.from("courses").update(parsed.data).eq("id", id);

  if (error) {
    console.error("Supabase update error:", error);
    if (error.code === "23505") {
      return { error: "A course with this code already exists for this program and academic year." };
    }
    return { error: "Failed to update course. Please try again." };
  }

  await logActivity({
    userId: actor.id,
    role: actor.role,
    action: "UPDATE_COURSE",
    description: `Updated course: ${parsed.data.code} — ${parsed.data.title}`,
    departmentId: actor.role === "department_admin" ? (actor.managed_department_id ?? null) : null,
    metadata: { courseId: id },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteCourse(id: string) {
  const actor = await requireAdminOrDepartmentAdmin();
  const supabase = await createClient();

  // Fetch code/title before deleting so the audit log entry is readable.
  const { data: courseRow } = await supabase
    .from("courses")
    .select("code, title")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("courses").delete().eq("id", id);

  if (error) {
    console.error("Supabase delete error:", error);
    return { error: "Failed to delete course." };
  }

  await logActivity({
    userId: actor.id,
    role: actor.role,
    action: "DELETE_COURSE",
    description: courseRow
      ? `Deleted course: ${courseRow.code} — ${courseRow.title}`
      : `Deleted course: ${id}`,
    departmentId: actor.role === "department_admin" ? (actor.managed_department_id ?? null) : null,
    metadata: { courseId: id },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  return { success: true };
}


