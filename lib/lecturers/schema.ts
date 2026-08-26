import { z } from "zod";

// ── Validation schema ─────────────────────────────────────────────
// NOTE: This file must NOT have "use server" — it exports a non-function
// value (lecturerSchema) and a type, which "use server" files cannot do.

export const lecturerSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(150, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
  lecturer_department_id: z.string().uuid("Select a department"),
  /** Comma-separated string from the UI — split into TEXT[] on save. */
  expertise_areas_raw: z.string().trim().default(""),
});

export type LecturerFormData = z.infer<typeof lecturerSchema>;

/** Split a comma-separated string into a cleaned TEXT[] value. */
export function parseExpertiseAreas(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
