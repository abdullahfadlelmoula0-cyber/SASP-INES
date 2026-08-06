import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/requireAuth";
import { StudentAnnouncementsClient } from "@/components/announcements/StudentAnnouncementsClient";

export const metadata: Metadata = {
  title: "Announcements",
  description: "Stay up to date with the latest announcements.",
};

export default async function AnnouncementsPage() {
  await requireAuth();

  return <StudentAnnouncementsClient />;
}
