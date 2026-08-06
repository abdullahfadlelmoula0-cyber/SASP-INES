import { z } from "zod";

/**
 * Zod validation schemas for announcement operations
 */

export const announcementPriorityEnum = z.enum(["low", "normal", "high", "urgent"]);

export const announcementDurationEnum = z.enum([
  "forever",
  "1_week",
  "1_month",
  "3_months",
  "6_months",
  "custom",
]);

/**
 * Schema for creating a new announcement
 */
export const createAnnouncementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be at most 200 characters"),
  body: z.string().min(10, "Body must be at least 10 characters"),
  priority: announcementPriorityEnum.default("normal"),
  is_pinned: z.boolean().default(false),
  
  // Duration control
  duration: announcementDurationEnum.default("forever"),
  custom_expires_at: z.string().nullable().optional(), // ISO date string for custom duration
  
  // Academic targeting: FK to academic_plans. NULL = global (all students).
  // department_admin accounts may only set this to a plan within their own
  // managed_department_id (enforced by the can_manage_announcement() RLS
  // helper in the database, not just here).
  academic_plan_id: z.string().uuid().nullable().optional(),
});

/**
 * Schema for updating an existing announcement
 */
export const updateAnnouncementSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(10).optional(),
  priority: announcementPriorityEnum.optional(),
  is_pinned: z.boolean().optional(),
  
  // Duration control
  duration: announcementDurationEnum.optional(),
  custom_expires_at: z.string().nullable().optional(),
  
  // Academic targeting: FK to academic_plans. NULL = global (all students).
  academic_plan_id: z.string().uuid().nullable().optional(),
});

/**
 * Schema for deleting an announcement
 */
export const deleteAnnouncementSchema = z.object({
  id: z.string().uuid(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type DeleteAnnouncementInput = z.infer<typeof deleteAnnouncementSchema>;
