"use client";

/**
 * Client-side file upload utilities for dissertation chapters.
 * Mirrors lib/announcements/file-uploads-client.ts's pattern exactly,
 * except this bucket is PRIVATE (dissertation_chapters is a student's
 * own academic work, not public content) — so callers get a signed URL
 * back instead of a public one, and viewing later also goes through
 * getChapterFileSignedUrl() rather than the stored URL directly.
 *
 * Path scheme: {project_id}/{chapter_key}/{timestamp}_{filename}
 * The first path segment (project_id) is what the storage RLS policies
 * key off of — see the dissertation_chapter_project_accessible() DB
 * function.
 */

import { createClient } from "@/lib/supabase/client";

const BUCKET = "dissertation-chapters";

export async function uploadChapterFileClient(
  projectId: string,
  chapterKey: string,
  file: File
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const supabase = createClient();

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${projectId}/${chapterKey}/${timestamp}_${sanitizedName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    return { success: true, path: data.path };
  } catch (error) {
    console.error("Error uploading chapter file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload file",
    };
  }
}

/**
 * The bucket is private, so the stored `file_url` on a chapter/version
 * row is actually just the storage PATH (not a public URL) — this
 * exchanges it for a time-limited signed URL whenever the file needs
 * to be viewed/downloaded.
 */
export async function getChapterFileSignedUrl(
  path: string,
  expiresInSeconds = 3600
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error) throw error;
    return { url: data.signedUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to generate download link",
    };
  }
}
