// Save as: lib/students/actions.ts (REPLACE existing file)
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { studentSchema, type StudentFormData } from "./schemas";

// Resolves academic_plan_id + specialization_id into human-readable
// department/program strings, purely so the existing students table
// UI (which displays profile.department / profile.program as text)
// keeps working without further changes. The REAL source of truth
// for course-matching is now academic_plan_id / specialization_id —
// these text columns are display-only from here on.
async function resolveDisplayNames(
  academicPlanId: string,
  specializationId: string | null
) {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("academic_plans")
    .select("name, department_id, departments(name)")
    .eq("id", academicPlanId)
    .single();

  let programName = plan?.name ?? "";
  if (specializationId) {
    const { data: spec } = await supabase
      .from("specializations")
      .select("name")
      .eq("id", specializationId)
      .single();
    if (spec?.name) programName = spec.name;
  }

  const departmentName = (plan as any)?.departments?.name ?? "";
  return { departmentName, programName };
}

/**
 * Returns the department ID the current actor is scoped to.
 * - General admin → null (no restriction, can manage all departments)
 * - department_admin → their managed_department_id (scoped to one department)
 * - Otherwise → throws (should never happen; guarded by requireAdminOrDepartmentAdmin)
 */
export async function getActorScope(): Promise<string | null> {
  const profile = await requireAdminOrDepartmentAdmin();
  if (profile.role === "admin") return null;
  return profile.managed_department_id ?? null;
}

export async function createStudent(data: StudentFormData) {
  try {
    const actor = await requireAdminOrDepartmentAdmin();
    const actorDepartmentId = actor.role === "admin" ? null : (actor.managed_department_id ?? null);

    const parsed = studentSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    // Department admin can only create students in their own department
    if (actorDepartmentId) {
      const sb = await createClient();
      const { data: plan } = await sb
        .from("academic_plans")
        .select("department_id")
        .eq("id", parsed.data.academic_plan_id)
        .single();
      if (plan?.department_id !== actorDepartmentId) {
        return { error: "You can only create students in your own department." };
      }
    }

    const { departmentName, programName } = await resolveDisplayNames(
      parsed.data.academic_plan_id,
      parsed.data.specialization_id
    );

    const supabaseAdmin = createAdminClient();

    // 1. إنشاء الحساب في Supabase Auth — يتطلب service_role تحديدًا
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password || "12345678",
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: "student",
      },
    });

    if (authError) return { error: authError.message };

    // 2. الحفظ في جدول profiles — academic_plan_id/specialization_id هما
    //    مصدر الحقيقة الفعلي؛ department/program نصيّان للعرض فقط.
    const supabase = await createClient();
    const { data: student, error: profileError } = await supabase
      .from("profiles")
      .upsert([
        {
          id: authData.user.id,
          full_name: parsed.data.full_name,
          university_email: parsed.data.email,
          department: departmentName,
          program: programName,
          academic_plan_id: parsed.data.academic_plan_id,
          specialization_id: parsed.data.specialization_id,
          year_of_study: parsed.data.year_of_study,
          academic_year: parsed.data.academic_year,
          role: "student",
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (profileError) return { error: profileError.message };

    revalidatePath("/admin/students");
    return { success: true, data: student };
  } catch (err: any) {
    return { error: err.message || "Failed to create student account." };
  }
}

export async function updateStudent(id: string, data: StudentFormData) {
  try {
    const actor = await requireAdminOrDepartmentAdmin();
    const actorDepartmentId = actor.role === "admin" ? null : (actor.managed_department_id ?? null);

    const parsed = studentSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.errors[0].message };
    }

    // Department admin can only update students in their own department
    if (actorDepartmentId) {
      const sb = await createClient();
      const { data: plan } = await sb
        .from("academic_plans")
        .select("department_id")
        .eq("id", parsed.data.academic_plan_id)
        .single();
      if (plan?.department_id !== actorDepartmentId) {
        return { error: "You can only edit students in your own department." };
      }
    }

    const { departmentName, programName } = await resolveDisplayNames(
      parsed.data.academic_plan_id,
      parsed.data.specialization_id
    );

    const supabase = await createClient();

    // Role changes (incl. promoting to DEPARTMENT_ADMIN) are allowed ONLY
    // by a general admin. A department_admin editing a student may never
    // change roles or assign managed departments.
    const canChangeRole = actor.role === "admin";
    const updateData: Record<string, any> = {
      full_name: parsed.data.full_name,
      university_email: parsed.data.email,
      department: departmentName,
      program: programName,
      academic_plan_id: parsed.data.academic_plan_id,
      specialization_id: parsed.data.specialization_id,
      year_of_study: parsed.data.year_of_study,
      academic_year: parsed.data.academic_year,
      updated_at: new Date().toISOString(),
    };

    if (canChangeRole) {
      updateData.role = parsed.data.role === "ADMIN"
        ? "admin"
        : parsed.data.role === "DEPARTMENT_ADMIN"
        ? "department_admin"
        : "student";
      updateData.managed_department_id =
        parsed.data.role === "DEPARTMENT_ADMIN"
          ? parsed.data.managed_department_id ?? null
          : null;
    }

    const { data: student, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/admin/students");
    return { success: true, data: student };
  } catch (err: any) {
    return { error: err.message || "Failed to update student profile." };
  }
}

export async function deleteStudent(id: string) {
  try {
    const actor = await requireAdminOrDepartmentAdmin();
    const actorDepartmentId = actor.role === "admin" ? null : (actor.managed_department_id ?? null);

    const supabase = await createClient();

    // Department admin can only delete students in their own department
    if (actorDepartmentId) {
      const { data: student } = await supabase
        .from("profiles")
        .select("academic_plan_id, academic_plans(department_id)")
        .eq("id", id)
        .single();
      const deptId = (student as any)?.academic_plans?.department_id;
      if (deptId !== actorDepartmentId) {
        return { error: "You can only delete students in your own department." };
      }
    }

    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/students");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete student." };
  }
}

export async function getAllStudents() {
  try {
    const actor = await requireAdminOrDepartmentAdmin();
    const actorDepartmentId = actor.role === "admin" ? null : (actor.managed_department_id ?? null);

    const supabase = await createClient();

    let query = supabase
      .from("profiles")
      .select("id, full_name, university_email, department, program, year_of_study, academic_year, role, academic_plan_id, specialization_id, managed_department_id")
      // General admins see students + department_admins (so they can
      // promote/demote them). Department admins only see students.
      .in("role", actorDepartmentId ? ["student"] : ["student", "department_admin"])
      .order("full_name", { ascending: true });

    // Department admin only sees students in their department
    if (actorDepartmentId) {
      query = query.eq("academic_plans.department_id", actorDepartmentId);
    }

    const { data, error } = await query;

    if (error) return { data: [], error: error.message };

    return { data: data ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load students." };
  }
}

/**
 * Returns the current actor's role + managed department for the client UI.
 * Used to decide whether to show role-management controls and to scope
 * department pickers.
 */
export async function getActorRoleInfo(): Promise<{
  role: "admin" | "department_admin";
  managed_department_id: string | null;
}> {
  const profile = await requireAdminOrDepartmentAdmin();
  return {
    role: profile.role === "admin" ? "admin" : "department_admin",
    managed_department_id: profile.managed_department_id ?? null,
  };
}

// Nested structure read directly from the SAME tables the admin
// manages via /admin/academic-structure. Any department/plan/
// specialization the admin adds there appears here automatically —
// no separate list to keep in sync.
export interface AcademicStructureSpecialization {
  id: string;
  name: string;
  total_duration_years: number;
}
export interface AcademicStructurePlan {
  id: string;
  name: string;
  shared_years: number;
  specializations: AcademicStructureSpecialization[];
}
export interface AcademicStructureDepartment {
  id: string;
  name: string;
  academic_plans: AcademicStructurePlan[];
}

export async function getAcademicStructureOptions(): Promise<{
  data: AcademicStructureDepartment[];
  error: string | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select(
        "id, name, academic_plans(id, name, shared_years, specializations(id, name, total_duration_years))"
      )
      .order("name", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data as any) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load academic structure." };
  }
}