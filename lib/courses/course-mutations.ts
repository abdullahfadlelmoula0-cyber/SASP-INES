"use client";

import { createClient } from "@/lib/supabase/client";
import type { Course } from "@/types";
import type { CreateCourseInput, UpdateCourseInput } from "./course-utils";

export async function createCourse(
  input: CreateCourseInput
): Promise<{ data: Course | null; error: Error | null }> {
  const supabase = createClient();
  const cleanInput: CreateCourseInput = {
    ...input,
    code: input.code.trim(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    instructor: input.instructor?.trim() || null,
  };

  const { data, error } = await supabase
    .from("courses")
    .insert([cleanInput])
    .select("*")
    .single();

  return { data: data as Course | null, error };
}

export async function updateCourse(
  id: string,
  input: UpdateCourseInput
): Promise<{ data: Course | null; error: Error | null }> {
  const supabase = createClient();
  const patch: UpdateCourseInput = { ...input };

  if ("code" in patch && patch.code) patch.code = patch.code.trim();
  if ("title" in patch && patch.title) patch.title = patch.title.trim();
  if ("description" in patch)
    patch.description = patch.description?.trim() || null;
  if ("instructor" in patch)
    patch.instructor = patch.instructor?.trim() || null;

  const { data, error } = await supabase
    .from("courses")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  return { data: data as Course | null, error };
}

export async function setCourseActive(
  id: string,
  isActive: boolean
): Promise<{ data: Course | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .single();

  return { data: data as Course | null, error };
}

export async function deleteCourse(
  id: string
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  return { error };
}

export async function fetchAllAdminCourses(): Promise<{
  data: Course[];
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("code", { ascending: true });

  return { data: (data as Course[]) ?? [], error };
}

export async function fetchMyCourses(): Promise<{
  data: Course[];
  error: Error | null;
}> {
  const supabase = createClient();

  // 1. جلب المستخدم الحالي
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: [], error: new Error("User not authenticated") };
  }

  // 2. جلب بيانات البروفايل للطالب (القسم والسنة الدراسية)
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("department, year_of_study")
    .eq("id", user.id)
    .single();

  const studentDepartment = profile?.department || "Computer Science";
  const studentYear = profile?.year_of_study || 1;

  // 3. جلب الكورسات النشطة التي تطابق قسم الطالب وسنته الدراسية بدقة
  const { data, error } = await (supabase as any)
    .from("courses")
    .select("*")
    .eq("is_active", true)
    .eq("department", studentDepartment)
    .eq("year_of_study", studentYear)
    .order("code", { ascending: true });

  return { data: (data as Course[]) ?? [], error };
}