"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { fetchActiveAnnouncements } from "@/lib/announcements/actions";
import type { Announcement } from "@/types";

export function StudentAnnouncementsClient() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadAnnouncements() {
    setIsLoading(true);
    const result = await fetchActiveAnnouncements();
    if (result.success && result.data) {
      setAnnouncements(result.data);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  // Separate pinned and regular announcements
  const pinnedAnnouncements = announcements.filter((a) => a.is_pinned);
  const regularAnnouncements = announcements.filter((a) => !a.is_pinned);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements"
        description="Important updates and notices from SASP-INES administration."
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No announcements"
          description="Announcements from administrators will appear here. Check back later for updates."
        />
      ) : (
        <div className="space-y-6">
          {/* Pinned Announcements */}
          {pinnedAnnouncements.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pinned Announcements
              </h2>
              {pinnedAnnouncements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  onEdit={() => {}}
                  onDeleted={() => {}}
                  isAdmin={false}
                />
              ))}
            </div>
          )}

          {/* Regular Announcements */}
          {regularAnnouncements.length > 0 && (
            <div className="space-y-4">
              {pinnedAnnouncements.length > 0 && (
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Recent Announcements
                </h2>
              )}
              {regularAnnouncements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  onEdit={() => {}}
                  onDeleted={() => {}}
                  isAdmin={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
