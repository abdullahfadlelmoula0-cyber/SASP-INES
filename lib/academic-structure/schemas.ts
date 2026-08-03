import { z } from "zod";

// ============================================================
// Departments
// ============================================================

export const departmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(150, "Name is too long"),
});
export type DepartmentFormData = z.infer<typeof departmentSchema>;

// ============================================================
// Academic Plans
// ============================================================

export const academicPlanSchema = z.object({
  department_id: z.string().uuid("Select a department"),
  name: z.string().trim().min(1, "Plan name is required").max(150, "Name is too long"),
  shared_years: z.number().int().min(1, "Must be at least 1 year"),
  is_active: z.boolean(),
});
export type AcademicPlanFormData = z.infer<typeof academicPlanSchema>;

// ============================================================
// Specializations
// ============================================================

export const specializationSchema = z.object({
  academic_plan_id: z.string().uuid(),
  name: z.string().trim().min(1, "Track name is required").max(150, "Name is too long"),
  total_duration_years: z.number().int().min(1, "Must be at least 1 year"),
});
export type SpecializationFormData = z.infer<typeof specializationSchema>;

// ============================================================
// Plan-scoped Courses
// ============================================================

export const planCourseSchema = z
  .object({
    academic_plan_id: z.string().uuid(),
    specialization_id: z.string().uuid().nullable(),
    year_number: z.number().int().min(1, "Year is required"),
    code: z.string().trim().min(1, "Course code is required").max(20, "Code is too long"),
    title: z.string().trim().min(1, "Course title is required").max(200, "Title is too long"),
    description: z.string().trim().nullable().optional(),
    credits: z.number().int().min(1, "Credits must be a positive number"),
    instructor: z.string().trim().nullable().optional(),
    // تم حذف academic_year من هنا نهائياً
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    is_active: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return new Date(data.start_date) <= new Date(data.end_date);
      }
      return true;
    },
    { message: "End date cannot be before start date", path: ["end_date"] }
  );
export type PlanCourseFormData = z.infer<typeof planCourseSchema>;