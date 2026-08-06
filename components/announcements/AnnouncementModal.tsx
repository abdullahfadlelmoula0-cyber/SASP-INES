"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X, FileIcon, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { createAnnouncementSchema, updateAnnouncementSchema, type CreateAnnouncementInput, type UpdateAnnouncementInput } from "@/lib/announcements/schemas";
import { createAnnouncement, updateAnnouncement } from "@/lib/announcements/actions";
import { uploadAnnouncementCoverClient, uploadAnnouncementAttachmentClient, deleteAnnouncementCoverClient, deleteAnnouncementAttachmentClient, updateAnnouncementCoverUrlClient } from "@/lib/announcements/file-uploads-client";
import { getAcademicStructureOptions, type AcademicStructureDepartment } from "@/lib/students/actions";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Announcement, AnnouncementAttachment } from "@/types";

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  announcement?: Announcement; // If provided, edit mode
}

export function AnnouncementModal({ isOpen, onClose, onSuccess, announcement }: AnnouncementModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<string>("forever");

  // File upload state
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(announcement?.cover_image_url || null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<AnnouncementAttachment[]>(announcement?.announcement_attachments || []);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // Academic structure (Department → Plan), read live from the same
  // tables the admin manages via /admin/academic-structure.
  const [departments, setDepartments] = useState<AcademicStructureDepartment[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  // Current actor's role + managed department — determines whether the
  // department/plan pickers are locked to a single department.
  const [actorRole, setActorRole] = useState<"admin" | "department_admin" | null>(null);
  const [managedDepartmentId, setManagedDepartmentId] = useState<string | null>(null);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");

  const isEditMode = !!announcement;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    setValue,
    watch,
  } = useForm<CreateAnnouncementInput | UpdateAnnouncementInput>({
    resolver: zodResolver(isEditMode ? updateAnnouncementSchema : createAnnouncementSchema),
    defaultValues: isEditMode
      ? {
          title: announcement.title,
          body: announcement.body,
          priority: announcement.priority,
          is_pinned: announcement.is_pinned,
          academic_plan_id: announcement.academic_plan_id,
          duration: "forever",
        }
      : {
          priority: "normal",
          is_pinned: false,
          duration: "forever",
          academic_plan_id: null,
        },
  });

  const academicPlanId = watch("academic_plan_id");

  // Load the actor's role + managed department once, when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role, managed_department_id")
        .eq("id", user.id)
        .single();
      if (data) {
        setActorRole(data.role as "admin" | "department_admin");
        setManagedDepartmentId(data.managed_department_id);
      }
    })();
  }, [isOpen]);

  // Load the Department → Plan structure once, when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setOptionsLoading(true);
    getAcademicStructureOptions().then((res) => {
      setDepartments(res.data);
      setOptionsLoading(false);
    });
  }, [isOpen]);

  // Once departments load, back-fill selectedDepartmentId for edit mode
  // (from the announcement's existing academic_plan_id) or lock it to the
  // department_admin's own department.
  useEffect(() => {
    if (departments.length === 0) return;

    if (actorRole === "department_admin" && managedDepartmentId) {
      setSelectedDepartmentId(managedDepartmentId);
      return;
    }

    if (isEditMode && announcement?.academic_plan_id) {
      const owningDept = departments.find((d) =>
        d.academic_plans.some((p) => p.id === announcement.academic_plan_id)
      );
      if (owningDept) setSelectedDepartmentId(owningDept.id);
    }
  }, [departments, actorRole, managedDepartmentId, isEditMode, announcement]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId),
    [departments, selectedDepartmentId]
  );
  const plans = selectedDepartment?.academic_plans ?? [];

  const isLockedToOwnDepartment = actorRole === "department_admin";

  // Handle cover image selection
  function handleCoverImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Cover image must be an image file.",
        variant: "destructive",
      });
      return;
    }

    setCoverImageFile(file);
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Remove cover image
  function handleRemoveCoverImage() {
    setCoverImageFile(null);
    setCoverImagePreview(null);
  }

  // Handle attachment selection
  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setAttachmentFiles((prev) => [...prev, ...files]);
  }

  // Remove new attachment
  function handleRemoveAttachment(index: number) {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Delete existing attachment
  async function handleDeleteExistingAttachment(attachmentId: string) {
    if (!confirm("Delete this attachment?")) return;

    const result = await deleteAnnouncementAttachmentClient(attachmentId);
    if (result.success) {
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast({ title: "Attachment deleted" });
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  async function onSubmit(data: CreateAnnouncementInput | UpdateAnnouncementInput) {
    setIsSubmitting(true);

    try {
      // Step 1: Create or update announcement first
      const result = isEditMode
        ? await updateAnnouncement({ ...data, id: announcement.id } as UpdateAnnouncementInput)
        : await createAnnouncement(data as CreateAnnouncementInput);

      if (!result.success) {
        throw new Error(result.error || "Failed to save announcement");
      }

      const announcementId = result.data!.id;

      // Step 2: Upload cover image if changed
      if (coverImageFile) {
        setIsUploadingFiles(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Delete old cover if exists
        if (isEditMode && announcement.cover_image_url) {
          await deleteAnnouncementCoverClient(announcement.cover_image_url);
        }

        const uploadResult = await uploadAnnouncementCoverClient(announcementId, coverImageFile);
        if (uploadResult.success && uploadResult.url) {
          await updateAnnouncementCoverUrlClient(announcementId, uploadResult.url);
        }
      }

      // Step 3: Upload new attachments
      if (attachmentFiles.length > 0) {
        setIsUploadingFiles(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        for (const file of attachmentFiles) {
          await uploadAnnouncementAttachmentClient(announcementId, file, user!.id);
        }
      }

      toast({
        title: isEditMode ? "Announcement updated" : "Announcement created",
        description: isEditMode
          ? "The announcement has been updated successfully."
          : "The announcement has been created successfully.",
      });
      
      reset();
      setCoverImageFile(null);
      setCoverImagePreview(null);
      setAttachmentFiles([]);
      setExistingAttachments([]);
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploadingFiles(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Announcement" : "Create New Announcement"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Important: Campus closure notice"
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              {...register("body")}
              placeholder="The campus will be closed on..."
              rows={6}
              className={errors.body ? "border-destructive" : ""}
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body.message}</p>}
          </div>

          {/* Priority & Pinned */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                {...register("priority")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_pinned" className="block">Pin to top</Label>
              <div className="flex items-center gap-2 h-10">
                <input
                  id="is_pinned"
                  type="checkbox"
                  {...register("is_pinned")}
                  className="w-4 h-4 rounded border-input"
                />
                <span className="text-sm text-muted-foreground">Show at the top of the feed</span>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Display Duration</Label>
            <select
              id="duration"
              {...register("duration")}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
            >
              <option value="forever">Forever (never expires)</option>
              <option value="1_week">1 Week</option>
              <option value="1_month">1 Month</option>
              <option value="3_months">3 Months</option>
              <option value="6_months">6 Months</option>
              <option value="custom">Custom Date</option>
            </select>
          </div>

          {/* Custom expiration date */}
          {selectedDuration === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="custom_expires_at">Custom Expiration Date</Label>
              <Input
                id="custom_expires_at"
                type="datetime-local"
                {...register("custom_expires_at")}
              />
            </div>
          )}

          {/* Cover Image Upload */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
            <h3 className="font-medium text-sm">Cover Image (Optional)</h3>
            <p className="text-xs text-muted-foreground">
              Add an eye-catching cover image to your announcement.
            </p>

            {coverImagePreview ? (
              <div className="relative">
                <img
                  src={coverImagePreview}
                  alt="Cover preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveCoverImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload cover image
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* File Attachments */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
            <h3 className="font-medium text-sm">File Attachments (Optional)</h3>
            <p className="text-xs text-muted-foreground">
              Attach documents, PDFs, images, or any file type. Students can download these files.
            </p>

            {/* Existing attachments (edit mode) */}
            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Current Attachments:</p>
                {existingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{attachment.file_name}</span>
                      {attachment.file_size_bytes && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({Math.round(attachment.file_size_bytes / 1024)} KB)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingAttachment(attachment.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New attachments to upload */}
            {attachmentFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">New Attachments:</p>
                {attachmentFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Add files (PDF, Word, images, etc.)
                </span>
              </div>
              <input
                type="file"
                multiple
                onChange={handleAttachmentChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Academic Targeting — Department → Academic Plan, read live
              from the same tables /admin/academic-structure manages. */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
            <h3 className="font-medium text-sm">Target Audience</h3>
            <p className="text-xs text-muted-foreground">
              {isLockedToOwnDepartment
                ? "As a department admin, this announcement is scoped to your department — pick which plan within it should see it."
                : "Leave the plan unset to show this to all students. Pick a department and plan to target a specific group."}
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="target_department">Department</Label>
                <select
                  id="target_department"
                  value={selectedDepartmentId}
                  disabled={optionsLoading || isLockedToOwnDepartment}
                  onChange={(e) => {
                    setSelectedDepartmentId(e.target.value);
                    setValue("academic_plan_id", null);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm disabled:opacity-60"
                >
                  <option value="">{isLockedToOwnDepartment ? "Loading your department…" : "All Departments"}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Plan */}
              <div className="space-y-2">
                <Label htmlFor="target_plan">
                  Academic Plan {isLockedToOwnDepartment && <span className="text-destructive">*</span>}
                </Label>
                <Controller
                  name="academic_plan_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      disabled={!selectedDepartmentId}
                    >
                      <option value="">
                        {isLockedToOwnDepartment ? "Select a plan…" : "All Plans in this Department"}
                      </option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
                {errors.academic_plan_id && (
                  <p className="text-xs text-destructive">{errors.academic_plan_id.message as string}</p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || isUploadingFiles}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploadingFiles}>
              {(isSubmitting || isUploadingFiles) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isUploadingFiles ? "Uploading files..." : isEditMode ? "Update Announcement" : "Create Announcement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
