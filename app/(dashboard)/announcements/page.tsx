import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Announcements",
  description: "Stay up to date with the latest announcements.",
};

export default function AnnouncementsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements"
        description="Important updates and notices from the SASP-INES administration."
      />

      <EmptyState
        icon={Bell}
        title="No announcements"
        description="Announcements from administrators will appear here."
      />
    </div>
  );
}
