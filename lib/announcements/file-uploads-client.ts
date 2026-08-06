"use client";

/**
 * Client-side file upload utilities for announcements
 * These run in the browser and use the Supabase client directly
 */

import { createClient } from "@/lib/supabase/client";
import type { AnnouncementAttachment } from "@/types";

/**
 * Upload a cover image to the announcement-covers bucket (CLIENT-SIDE)
 */
export async function uploadAnnouncementCoverClient(
  announcementId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;
    const filePath = `${announcementId}/${fileName}`;

    // Upload to storage
    const { data, error } = await supabase.storage
      .from("announcement-covers")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("announcement-covers")
      .getPublicUrl(data.path);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error("Error uploading cover image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload cover image",
    };
  }
}

/**
 * Delete a cover image from the announcement-covers bucket (CLIENT-SIDE)
 */
export async function deleteAnnouncementCoverClient(
  coverUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Extract path from URL
    const urlParts = coverUrl.split("/announcement-covers/");
    if (urlParts.length < 2) {
      throw new Error("Invalid cover URL format");
    }
    const filePath = urlParts[1].split("?")[0]; // Remove query params

    const { error } = await supabase.storage
      .from("announcement-covers")
      .remove([filePath]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error deleting cover image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete cover image",
    };
  }
}

/**
 * Upload an attachment to the announcement-attachments bucket (CLIENT-SIDE)
 */
export async function uploadAnnouncementAttachmentClient(
  announcementId: string,
  file: File,
  uploadedBy: string
): Promise<{
  success: boolean;
  attachment?: AnnouncementAttachment;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;
    const filePath = `${announcementId}/${fileName}`;

    // Upload to storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from("announcement-attachments")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageError) throw storageError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("announcement-attachments")
      .getPublicUrl(storageData.path);

    // Insert attachment record
    const { data: attachmentData, error: dbError } = await supabase
      .from("announcement_attachments")
      .insert({
        announcement_id: announcementId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size_bytes: file.size,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return { success: true, attachment: attachmentData as AnnouncementAttachment };
  } catch (error) {
    console.error("Error uploading attachment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload attachment",
    };
  }
}

/**
 * Delete an attachment (CLIENT-SIDE)
 */
export async function deleteAnnouncementAttachmentClient(
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Get attachment record to find file URL
    const { data: attachment, error: fetchError } = await supabase
      .from("announcement_attachments")
      .select("file_url")
      .eq("id", attachmentId)
      .single();

    if (fetchError) throw fetchError;

    // Extract path from URL
    const urlParts = attachment.file_url.split("/announcement-attachments/");
    if (urlParts.length >= 2) {
      const filePath = urlParts[1].split("?")[0]; // Remove query params

      // Delete from storage (ignore errors if file doesn't exist)
      await supabase.storage.from("announcement-attachments").remove([filePath]);
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from("announcement_attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) throw deleteError;

    return { success: true };
  } catch (error) {
    console.error("Error deleting attachment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete attachment",
    };
  }
}

/**
 * Update announcement cover_image_url in database (CLIENT-SIDE)
 */
export async function updateAnnouncementCoverUrlClient(
  announcementId: string,
  coverUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from("announcements")
      .update({ cover_image_url: coverUrl })
      .eq("id", announcementId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("Error updating cover URL:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update cover URL",
    };
  }
}
