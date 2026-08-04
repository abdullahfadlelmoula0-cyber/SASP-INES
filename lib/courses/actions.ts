"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";

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

export async function createCourse(data: CourseFormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = courseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { error } = await supabase.from("courses").insert([parsed.data]);

  if (error) {
    console.error("Supabase insert error:", error);
    if (error.code === "23505") { // unique constraint
      return { error: "A course with this code already exists for this program and academic year." };
    }
    return { error: "Failed to create course. Please try again." };
  }

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateCourse(id: string, data: CourseFormData) {
  await requireAdmin();
  const supabase = await createClient();

  const parsed = courseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { error } = await supabase.from("courses").update(parsed.data).eq("id", id);

  if (error) {
    console.error("Supabase update error:", error);
    if (error.code === "23505") {
      return { error: "A course with this code already exists for this program and academic year." };
    }
    return { error: "Failed to update course. Please try again." };
  }

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteCourse(id: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("courses").delete().eq("id", id);

  if (error) {
    console.error("Supabase delete error:", error);
    return { error: "Failed to delete course." };
  }

  revalidatePath("/admin/courses");
  revalidatePath("/admin");
  return { success: true };
}


