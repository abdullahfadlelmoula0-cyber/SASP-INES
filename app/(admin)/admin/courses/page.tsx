import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { AdminCoursesClient } from "@/components/courses/AdminCoursesClient";

export const metadata: Metadata = {
  title: "Manage Courses",
  description: "Admin: manage academic courses and availability.",
};

export default async function AdminCoursesPage() {
  await requireAdmin();

  return <AdminCoursesClient />;
}
