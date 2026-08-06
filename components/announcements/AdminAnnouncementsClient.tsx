"use client";

import { useEffect, useState } from "react";
import { Plus, Bell, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { AnnouncementModal } from "@/components/announcements/AnnouncementModal";
import { fetchAllAnnouncements } from "@/lib/announcements/actions";
import type { Announcement } from "@/types";

export function AdminAnnouncementsClient() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | undefined>();

  async function loadAnnouncements() {
    setIsLoading(true);
    const result = await fetchAllAnnouncements();
    if (result.success && result.data) {
      setAnnouncements(result.data);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function handleCreate() {
    setEditingAnnouncement(undefined);
    setIsModalOpen(true);
  }

  function handleEdit(announcement: Announcement) {
    setEditingAnnouncement(announcement);
    setIsModalOpen(true);
  }

  function handleSuccess() {
    loadAnnouncements();
  }

  const activeCount = announcements.filter(
    (a) => !a.expires_at || new Date(a.expires_at) > new Date()
  ).length;

  const expiredCount = announcements.filter(
    (a) => a.expires_at && new Date(a.expires_at) <= new Date()
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements"
        description="Create and manage announcements for students. Control visibility, duration, and target specific groups."
        action={
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Announcement
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="text-2xl font-bold text-foreground">{announcements.length}</div>
          <div className="text-sm text-muted-foreground">Total Announcements</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card">
          <div className="text-2xl font-bold text-gray-500">{expiredCount}</div>
          <div className="text-sm text-muted-foreground">Expired</div>
        </div>
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No announcements yet"
          description="Create your first announcement to communicate with students."
          action={
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Announcement
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              onEdit={handleEdit}
              onDeleted={handleSuccess}
              isAdmin
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnnouncementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        announcement={editingAnnouncement}
      />
    </div>
  );
}
