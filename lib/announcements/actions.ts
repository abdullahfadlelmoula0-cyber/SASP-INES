"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  deleteAnnouncementSchema,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
  type DeleteAnnouncementInput,
} from "./schemas";
import type { Announcement } from "@/types";

/**
 * Calculate expiration date based on duration
 */
function calculateExpiresAt(duration: string, customDate?: string | null): string | null {
  if (duration === "forever") return null;
  
  if (duration === "custom" && customDate) {
    return new Date(customDate).toISOString();
  }
  
  const now = new Date();
  
  switch (duration) {
    case "1_week":
      now.setDate(now.getDate() + 7);
      break;
    case "1_month":
      now.setMonth(now.getMonth() + 1);
      break;
    case "3_months":
      now.setMonth(now.getMonth() + 3);
      break;
    case "6_months":
      now.setMonth(now.getMonth() + 6);
      break;
    default:
      return null;
  }
  
  return now.toISOString();
}

/**
 * Fetch all announcements (admin view - includes expired)
 */
export async function fetchAllAnnouncements(): Promise<{
  success: boolean;
  data?: Announcement[];
  error?: string;
}> {
  try {
    await requireAdminOrDepartmentAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("announcements")
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(full_name, avatar_url),
        academic_plan:academic_plans(name, department:departments(name)),
        announcement_attachments(id, file_name, file_url, file_type, file_size_bytes, created_at)
      `)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data: data as unknown as Announcement[] };
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch announcements",
    };
  }
}

/**
 * Fetch active announcements for students (excludes expired)
 */
export async function fetchActiveAnnouncements(): Promise<{
  success: boolean;
  data?: Announcement[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // RLS policies automatically filter by academic profile and expiration
    const { data, error } = await supabase
      .from("announcements")
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(full_name, avatar_url),
        academic_plan:academic_plans(name, department:departments(name)),
        announcement_attachments(id, file_name, file_url, file_type, file_size_bytes, created_at)
      `)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data: data as unknown as Announcement[] };
  } catch (error) {
    console.error("Error fetching active announcements:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch announcements",
    };
  }
}

/**
 * Create a new announcement
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput
): Promise<{
  success: boolean;
  data?: Announcement;
  error?: string;
}> {
  try {
    const actor = await requireAdminOrDepartmentAdmin();

    // Validate input
    const validated = createAnnouncementSchema.parse(input);

    // department_admin accounts may only post department-scoped
    // announcements for their OWN department — never global ones. This is
    // a friendlier duplicate of what can_manage_announcement() already
    // enforces at the RLS layer; keeping both means a bad request fails
    // fast with a clear message instead of a raw RLS error.
    if (actor.role === "department_admin") {
      if (!validated.academic_plan_id) {
        return { success: false, error: "Select an academic plan within your department — department admins cannot post global announcements." };
      }
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Calculate expiration date
    const expiresAt = calculateExpiresAt(validated.duration, validated.custom_expires_at);

    // Insert announcement
    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title: validated.title,
        body: validated.body,
        priority: validated.priority,
        is_pinned: validated.is_pinned,
        expires_at: expiresAt,
        academic_plan_id: validated.academic_plan_id || null,
        author_id: user.id,
      })
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(full_name, avatar_url),
        academic_plan:academic_plans(name, department:departments(name))
      `)
      .single();

    if (error) throw error;

    revalidatePath("/admin/announcements");
    revalidatePath("/announcements");

    return { success: true, data: data as unknown as Announcement };
  } catch (error) {
    console.error("Error creating announcement:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create announcement",
    };
  }
}

/**
 * Update an existing announcement
 */
export async function updateAnnouncement(
  input: UpdateAnnouncementInput
): Promise<{
  success: boolean;
  data?: Announcement;
  error?: string;
}> {
  try {
    const actor = await requireAdminOrDepartmentAdmin();

    // Validate input
    const validated = updateAnnouncementSchema.parse(input);

    if (actor.role === "department_admin" && validated.academic_plan_id === null) {
      return { success: false, error: "Department admins cannot make an announcement global — select a plan within your department." };
    }

    const supabase = await createClient();

    // Build update object
    const updateData: Record<string, any> = {};

    if (validated.title !== undefined) updateData.title = validated.title;
    if (validated.body !== undefined) updateData.body = validated.body;
    if (validated.priority !== undefined) updateData.priority = validated.priority;
    if (validated.is_pinned !== undefined) updateData.is_pinned = validated.is_pinned;

    // Handle duration update
    if (validated.duration !== undefined) {
      updateData.expires_at = calculateExpiresAt(validated.duration, validated.custom_expires_at);
    }

    // Handle academic targeting
    if (validated.academic_plan_id !== undefined) updateData.academic_plan_id = validated.academic_plan_id || null;

    // Update announcement
    const { data, error } = await supabase
      .from("announcements")
      .update(updateData)
      .eq("id", validated.id)
      .select(`
        *,
        author:profiles!announcements_author_id_fkey(full_name, avatar_url),
        academic_plan:academic_plans(name, department:departments(name))
      `)
      .single();

    if (error) throw error;

    revalidatePath("/admin/announcements");
    revalidatePath("/announcements");

    return { success: true, data: data as unknown as Announcement };
  } catch (error) {
    console.error("Error updating announcement:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update announcement",
    };
  }
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(
  input: DeleteAnnouncementInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireAdminOrDepartmentAdmin();

    // Validate input
    const validated = deleteAnnouncementSchema.parse(input);
    
    const supabase = await createClient();

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", validated.id);

    if (error) throw error;

    revalidatePath("/admin/announcements");
    revalidatePath("/announcements");

    return { success: true };
  } catch (error) {
    console.error("Error deleting announcement:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete announcement",
    };
  }
}
