import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/requireAuth";
import { StudentCoursesClient } from "@/components/courses/StudentCoursesClient";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse your enrolled and available courses.",
};

export default async function CoursesPage() {
  await requireAuth();

  return <StudentCoursesClient />;
}
