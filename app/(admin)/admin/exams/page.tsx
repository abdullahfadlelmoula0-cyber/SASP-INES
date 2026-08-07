// Save as: app/(admin)/admin/exams/page.tsx
// This standalone page is retired — course materials (documents, exams,
// assignments) are now managed from each course inside Academic
// Structure (click a course name to open its Materials tabs).
import { redirect } from "next/navigation";

export default function AdminExamsPageRedirect() {
  redirect("/admin/academic-structure");
}
