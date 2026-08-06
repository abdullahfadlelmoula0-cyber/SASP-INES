"use client";

import { useState } from "react";
import { Pencil, Trash2, Pin, Calendar, Users, Download, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteAnnouncement } from "@/lib/announcements/actions";
import { useToast } from "@/hooks/use-toast";
import type { Announcement } from "@/types";
import { formatDistanceToNow } from "@/lib/utils";

interface AnnouncementCardProps {
  announcement: Announcement;
  onEdit: (announcement: Announcement) => void;
  onDeleted: () => void;
  isAdmin?: boolean;
}

export function AnnouncementCard({ announcement, onEdit, onDeleted, isAdmin = false }: AnnouncementCardProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const priorityColors = {
    low: "text-blue-600 bg-blue-50 border-blue-200",
    normal: "text-gray-600 bg-gray-50 border-gray-200",
    high: "text-orange-600 bg-orange-50 border-orange-200",
    urgent: "text-red-600 bg-red-50 border-red-200",
  };

  const priorityLabels = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);

    try {
      const result = await deleteAnnouncement({ id: announcement.id });

      if (result.success) {
        toast({
          title: "Announcement deleted",
          description: "The announcement has been removed successfully.",
        });
        onDeleted();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete announcement.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // Calculate if expired
  const isExpired = announcement.expires_at && new Date(announcement.expires_at) < new Date();

  // Build targeting info from the joined academic_plan (+ its department)
  const isGlobal = !announcement.academic_plan_id;
  const targetLabel = announcement.academic_plan
    ? `${announcement.academic_plan.department?.name ?? ""} — ${announcement.academic_plan.name}`
    : "";

  // Format file size
  function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  return (
    <div
      className={`relative rounded-lg border-2 bg-card transition-all hover:shadow-md overflow-hidden ${
        announcement.is_pinned ? "border-primary/30 bg-primary/5" : "border-border"
      } ${isExpired ? "opacity-60" : ""}`}
    >
      {/* Cover Image */}
      {announcement.cover_image_url && (
        <div className="relative w-full h-48 bg-muted">
          <img
            src={announcement.cover_image_url}
            alt={announcement.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on load error
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      <div className="p-5">
        {/* Pinned Badge */}
        {announcement.is_pinned && (
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium backdrop-blur-sm">
              <Pin className="w-3 h-3" />
              Pinned
            </div>
          </div>
        )}

      {/* Priority Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            priorityColors[announcement.priority]
          }`}
        >
          {priorityLabels[announcement.priority]}
        </span>
        
        {isExpired && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border border-gray-300 bg-gray-100 text-gray-600">
            Expired
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2 pr-16">{announcement.title}</h3>

      {/* Body */}
      <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{announcement.body}</p>

      {/* File Attachments */}
      {announcement.announcement_attachments && announcement.announcement_attachments.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Attachments ({announcement.announcement_attachments.length})
          </p>
          <div className="space-y-2">
            {announcement.announcement_attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size_bytes)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 ml-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Download className="w-4 h-4" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-4">
        {/* Author */}
        {announcement.author && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold">
              {announcement.author.full_name.charAt(0)}
            </div>
            <span>{announcement.author.full_name}</span>
          </div>
        )}

        {/* Created */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDistanceToNow(announcement.created_at)}</span>
        </div>

        {/* Expiration */}
        {announcement.expires_at && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Expires {isExpired ? formatDistanceToNow(announcement.expires_at) : `in ${formatDistanceToNow(announcement.expires_at)}`}
            </span>
          </div>
        )}

        {/* Target audience */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{isGlobal ? "All Students" : targetLabel}</span>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onEdit(announcement)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}
