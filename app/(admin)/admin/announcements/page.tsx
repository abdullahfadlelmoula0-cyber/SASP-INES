import type { Metadata } from "next";
import { requireAdminOrDepartmentAdmin } from "@/lib/auth/requireAdminOrDepartmentAdmin";
import { AdminAnnouncementsClient } from "@/components/announcements/AdminAnnouncementsClient";

export const metadata: Metadata = {
  title: "Announcements | Admin",
  description: "Create and manage announcements for students.",
};

export default async function AdminAnnouncementsPage() {
  await requireAdminOrDepartmentAdmin();

  return <AdminAnnouncementsClient />;
}
