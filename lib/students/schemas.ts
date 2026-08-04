// Save as: lib/students/schemas.ts (REPLACE existing file)
import { z } from "zod";

export const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(150, "Name is too long"),
  email: z.string().trim().email("Enter a valid university email"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional()
    .or(z.literal("")),
  // department_id is UI-only (used to filter the plan dropdown) — not stored directly.
  department_id: z.string().uuid("Select a department"),
  academic_plan_id: z.string().uuid("Select an academic plan"),
  specialization_id: z.string().uuid().nullable(),
  year_of_study: z.number().int().min(1, "Year is required"),
  academic_year: z.string().trim().min(1, "Academic year is required"),
  role: z.enum(["STUDENT", "ADMIN"]),
});

export type StudentFormData = z.infer<typeof studentSchema>;