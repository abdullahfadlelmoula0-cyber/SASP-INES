"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";

// ✅ استيراد الـ Schemas العادية
import {
  departmentSchema,
  academicPlanSchema,
  specializationSchema,
  planCourseSchema,
} from "./schemas";

// ✅ استيراد الـ Types بصورة صريحة باستخدام 'type'
import type {
  DepartmentFormData,
  AcademicPlanFormData,
  SpecializationFormData,
  PlanCourseFormData,
} from "./schemas";

// ── Shared error helper ─────────────────────────────────────────────
function friendlyDbError(
  error: { code?: string; message: string },
  fallback: string
): string {
  if (error.code === "23505") return "That name already exists here.";
  if (error.code === "P0001") return error.message;
  return fallback;
}

// ============================================================
// Departments
// ============================================================

export async function createDepartment(data: DepartmentFormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = departmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await supabase.from("departments").insert([parsed.data]);
  if (error) {
    console.error("Supabase insert error (departments):", error);
    return { error: friendlyDbError(error, "Failed to create department. Please try again.") };
  }

  revalidatePath("/admin/academic-structure");
  return { success: true };
}

export async function updateDepartment(id: string, data: DepartmentFormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = departmentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await supabase.from("departments").update(parsed.data).eq("id", id);
  if (error) {
    console.error("Supabase update error (departments):", error);
    return { error: friendlyDbError(error, "Failed to update department. Please try again.") };
  }

  revalidatePath("/admin/academic-structure");
  revalidatePath(`/admin/academic-structure/${id}`);
  return { success: true };
}

export async function deleteDepartment(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) {
    console.error("Supabase delete error (departments):", error);
    if (error.code === "23503") {
      return { error: "Delete or reassign this department's academic plan(s) first." };
    }
    return { error: "Failed to delete department." };
  }

  revalidatePath("/admin/academic-structure");
  return { success: true };
}

// ============================================================
// Academic Plans
// ============================================================

export async function createAcademicPlan(data: AcademicPlanFormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = academicPlanSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await supabase.from("academic_plans").insert([parsed.data]);
  if (error) {
    console.error("Supabase insert error (academic_plans):", error);
    return { error: friendlyDbError(error, "Failed to create plan. Please try again.") };
  }

  revalidatePath("/admin/academic-structure");
  revalidatePath(`/admin/academic-structure/${parsed.data.department_id}`);
  return { success: true };
}

export async function updateAcademicPlan(id: string, data: AcademicPlanFormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = academicPlanSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await supabase.from("academic_plans").update(parsed.data).eq("id", id);
  if (error) {
    console.error("Supabase update error (academic_plans):", error);
    return { error: friendlyDbError(error, "Failed to update plan. Please try again.") };
  }

  revalidatePath("/admin/academic-structure");
  revalidatePath(`/admin/academic-structure/${parsed.data.department_id}`);
  return { success: true };
}

export async function deleteAcademicPlan(id: string, departmentId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("academic_plans").delete().eq("id", id);
  if (error) {
    console.error("Supabase delete error (academic_plans):", error);
    return { error: "Failed to delete plan. Remove its specializations and courses first." };
  }

  revalidatePath("/admin/academic-structure");
  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}

// ============================================================
// Specializations
// ============================================================

export async function createSpecialization(data: SpecializationFormData, departmentId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = specializationSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await supabase.from("specializations").insert([parsed.data]);
  if (error) {
    console.error("Supabase insert error (specializations):", error);
    return { error: friendlyDbError(error, "Failed to create specialization. Please try again.") };
  }

  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}

export async function updateSpecialization(
  id: string,
  data: SpecializationFormData,
  departmentId: string
) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = specializationSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const { error } = await supabase.from("specializations").update(parsed.data).eq("id", id);
  if (error) {
    console.error("Supabase update error (specializations):", error);
    return { error: friendlyDbError(error, "Failed to update specialization. Please try again.") };
  }

  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}

export async function deleteSpecialization(id: string, departmentId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("specializations").delete().eq("id", id);
  if (error) {
    console.error("Supabase delete error (specializations):", error);
    return {
      error:
        "Failed to delete specialization. Students or courses may still reference it.",
    };
  }

  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}

// ============================================================
// Plan-scoped Courses
// ============================================================

export async function createPlanCourse(data: PlanCourseFormData, departmentId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = planCourseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const courseData = {
    ...parsed.data,
    department: "",
    program: "",
    year_of_study: parsed.data.year_number,
    start_date: parsed.data.start_date || null,
    end_date: parsed.data.end_date || null,
  };

  const { error } = await supabase.from("courses").insert([courseData]);

  if (error) {
    console.error("Supabase insert error (plan courses):", error);
    if (error.code === "23505") {
      return { error: "A course with this code already exists for this academic year." };
    }
    return { error: friendlyDbError(error, "Failed to create course. Please try again.") };
  }

  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}

export async function updatePlanCourse(
  id: string,
  data: PlanCourseFormData,
  departmentId: string
) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = planCourseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const courseData = {
    ...parsed.data,
    year_of_study: parsed.data.year_number,
    start_date: parsed.data.start_date || null,
    end_date: parsed.data.end_date || null,
  };

  const { error } = await supabase
    .from("courses")
    .update(courseData)
    .eq("id", id);

  if (error) {
    console.error("Supabase update error (plan courses):", error);
    if (error.code === "23505") {
      return { error: "A course with this code already exists for this academic year." };
    }
    return { error: friendlyDbError(error, "Failed to update course. Please try again.") };
  }

  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}

// ✅ تمت إضافة دالة الحذف هنا لتجنب خطأ الاستيراد في الواجهة
export async function deletePlanCourse(id: string, departmentId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) {
    console.error("Supabase delete error (plan courses):", error);
    return { error: "Failed to delete course." };
  }

  revalidatePath(`/admin/academic-structure/${departmentId}`);
  return { success: true };
}