import type { Metadata } from "next";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { AdminCoursesClient } from "@/components/courses/AdminCoursesClient";

export const metadata: Metadata = {
  title: "Manage Courses",
  description: "Admin: manage academic courses and availability.",
};

export default async function AdminCoursesPage() {
  await requireAdminOrDepartmentAdmin();

  return <AdminCoursesClient />;
}
