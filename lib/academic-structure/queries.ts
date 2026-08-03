// Save as: lib/academic-structure/queries.ts
"use client";

import { createClient } from "@/lib/supabase/client";
import type { Course } from "@/types";
import type {
  DepartmentWithPlans,
  DepartmentDetail,
} from "@/types/academic-structure";

export async function fetchDepartmentsWithPlans(): Promise<{
  data: DepartmentWithPlans[];
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*, academic_plans(*)")
    .order("name", { ascending: true });

  return { data: (data as DepartmentWithPlans[]) ?? [], error };
}

export async function fetchDepartmentDetail(
  departmentId: string
): Promise<{ data: DepartmentDetail | null; error: Error | null }> {
  const supabase = createClient();

  const { data: department, error: deptError } = await supabase
    .from("departments")
    .select("*")
    .eq("id", departmentId)
    .single();

  if (deptError) return { data: null, error: deptError };

  const { data: plans, error: plansError } = await supabase
    .from("academic_plans")
    .select("*, specializations(*)")
    .eq("department_id", departmentId)
    .order("name", { ascending: true });

  if (plansError) return { data: null, error: plansError };

  return {
    data: { department, plans: plans ?? [] } as DepartmentDetail,
    error: null,
  };
}

// specializationId = null  -> shared-trunk courses for that year
// specializationId = <id>  -> track-specific courses for that year
export async function fetchPlanYearCourses(
  academicPlanId: string,
  yearNumber: number,
  specializationId: string | null
): Promise<{ data: Course[]; error: Error | null }> {
  const supabase = createClient();

  let query = supabase
    .from("courses")
    .select("*")
    .eq("academic_plan_id", academicPlanId)
    .eq("year_number", yearNumber);

  query = specializationId
    ? query.eq("specialization_id", specializationId)
    : query.is("specialization_id", null);

  const { data, error } = await query.order("code", { ascending: true });
  return { data: (data as Course[]) ?? [], error };
}
