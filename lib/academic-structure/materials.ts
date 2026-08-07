// Save as: lib/academic-structure/materials.ts
"use client";

import { createClient } from "@/lib/supabase/client";

export interface CourseDocument {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
}

export interface CourseExam {
  id: string;
  course_id: string;
  title: string;
  exam_type: string;
  academic_year: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
}

export async function fetchCourseDocuments(courseId: string): Promise<{ data: CourseDocument[]; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  return { data: (data as CourseDocument[]) ?? [], error };
}

export async function fetchCourseExams(courseId: string): Promise<{ data: CourseExam[]; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  return { data: (data as CourseExam[]) ?? [], error };
}

// Path convention: {course_id}/{timestamp}-{filename} — keeps files
// grouped by course and avoids name collisions between uploads.
function buildStoragePath(courseId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `${courseId}/${Date.now()}-${safeName}`;
}

export async function uploadCourseDocument(
  courseId: string,
  file: File,
  meta: { title: string; description?: string; category: string }
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const path = buildStoragePath(courseId, file);

  const { error: uploadError } = await supabase.storage
    .from("course-documents")
    .upload(path, file);
  if (uploadError) return { error: uploadError };

  const { data: urlData } = supabase.storage.from("course-documents").getPublicUrl(path);

  const { error: insertError } = await supabase.from("documents").insert([
    {
      course_id: courseId,
      title: meta.title,
      description: meta.description || null,
      category: meta.category,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
    },
  ]);

  return { error: insertError };
}

export async function uploadCourseExam(
  courseId: string,
  file: File,
  meta: { title: string; exam_type: string; academic_year: string }
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const path = buildStoragePath(courseId, file);

  const { error: uploadError } = await supabase.storage
    .from("course-exams")
    .upload(path, file);
  if (uploadError) return { error: uploadError };

  const { data: urlData } = supabase.storage.from("course-exams").getPublicUrl(path);

  const { error: insertError } = await supabase.from("exams").insert([
    {
      course_id: courseId,
      title: meta.title,
      exam_type: meta.exam_type,
      academic_year: meta.academic_year,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
    },
  ]);

  return { error: insertError };
}

export async function deleteCourseDocument(id: string): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  return { error };
}

export async function deleteCourseExam(id: string): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("exams").delete().eq("id", id);
  return { error };
}
