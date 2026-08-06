import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { AdminCoursesClient } from "@/components/courses/AdminCoursesClient";

export const metadata: Metadata = {
  title: "Manage Courses",
  description: "Admin: manage academic courses and availability.",
};

export default async function AdminCoursesPage() {
  const profile = await requireAdminOrDepartmentAdmin();

  // This legacy page writes plain department/program text and never sets
  // academic_plan_id, so a department_admin's writes here would silently
  // fail RLS. Send them to their department's real course manager instead.
  if (profile.role === "department_admin" && profile.managed_department_id) {
    redirect(`/admin/academic-structure/${profile.managed_department_id}`);
  }

  return <AdminCoursesClient />;
}
