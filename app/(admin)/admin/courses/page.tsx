import type { Metadata } from "next";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { AdminCoursesClient } from "@/components/courses/AdminCoursesClient";

export const metadata: Metadata = {
  title: "Manage Courses",
  description: "Admin: manage academic courses and availability.",
};

export default async function AdminCoursesPage() {
  await requireAdminOrDepartmentAdmin();

  // Both general admins and department_admin can browse this page freely
  // (RLS already scopes what a department_admin actually sees/can edit
  // here). Only the "+ Add Course" button inside AdminCoursesClient
  // redirects into Academic Structure — not this page itself.
  return <AdminCoursesClient />;
}
