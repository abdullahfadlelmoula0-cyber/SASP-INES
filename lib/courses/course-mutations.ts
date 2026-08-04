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

  // RLS automatically filters courses to match the current student's
  // academic profile (department + program + year_of_study).
  // No is_active filter needed — all matching courses are visible.
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("code", { ascending: true });

  return { data: (data as Course[]) ?? [], error };
}