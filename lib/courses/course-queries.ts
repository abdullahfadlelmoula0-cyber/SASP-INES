import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/types";

export async function fetchAllCoursesServer(): Promise<{
  data: Course[];
  error: Error | null;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("code", { ascending: true });

    return { data: (data as Course[]) ?? [], error };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err : new Error("Unknown error"),
    };
  }
}

export async function fetchStudentCoursesByDepartment(departmentName: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .eq("department", departmentName)
      .order("code", { ascending: true });

    return { data: (data as Course[]) ?? [], error };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error("Unknown error") };
  }
}


export async function getDistinctCourseFiltersServer(): Promise<{
  departments: string[];
  programs: string[];
  years: number[];
  academicYears: string[];
}> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("courses")
      .select("department, program, year_of_study");

    if (!data) {
      return {
        departments: [],
        programs: [],
        years: [],
        academicYears: [],
      };
    }

    const depts = new Set<string>();
    const progs = new Set<string>();
    const yrs = new Set<number>();
    const ays = new Set<string>();

    for (const row of data) {
      if (row.department) depts.add(row.department);
      if (row.program) progs.add(row.program);
      if (row.year_of_study) yrs.add(row.year_of_study);
    }

    return {
      departments: Array.from(depts).sort(),
      programs: Array.from(progs).sort(),
      years: Array.from(yrs).sort((a, b) => a - b),
      academicYears: Array.from(ays).sort().reverse(),
    };
  } catch {
    return {
      departments: [],
      programs: [],
      years: [],
      academicYears: [],
    };
  }
}
