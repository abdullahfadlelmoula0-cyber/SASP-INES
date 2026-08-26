"use server";

import { createClient } from "@/lib/supabase/server";

export interface CreateNotificationInput {
  recipientId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}

/**
 * Inserts a notification row for the given recipient.
 *
 * RLS policy: any authenticated user can INSERT a notification for
 * someone else (e.g. student notifying a lecturer). The recipient
 * can only see/update their own rows.
 *
 * Used by the graduation-project feature and any future features
 * that need to send in-app notifications.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.from("notifications").insert({
      recipient_id: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      is_read: false,
    });

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message || "Failed to create notification." };
  }
}
