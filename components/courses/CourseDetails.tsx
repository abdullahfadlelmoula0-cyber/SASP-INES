"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  User,
  Hash,
  Layers,
  Building,
  BookMarked,
  Clock,
  X,
  FileText,
  FolderOpen,
  Upload,
  Loader2,
  AlertCircle,
  Trash2,
  Download,
} from "lucide-react";
import type { Course } from "@/types";
import {
  getCourseDeliveryStatus,
  getDeliveryStatusLabel,
  getDeliveryStatusVariant,
  formatDateRange,
} from "@/lib/courses/course-utils";
import { formatDate, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CourseDetailsProps {
  course: Course | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "student" | "admin";
  actions?: React.ReactNode;
}

type Tab = "details" | "documents" | "exams";

export function CourseDetails({
  course,
  open,
  onOpenChange,
  variant = "student",
  actions,
}: CourseDetailsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Reset to details tab when a new course opens
  useEffect(() => {
    if (open) setActiveTab("details");
  }, [open, course?.id]);

  if (!course) return null;

  const status = getCourseDeliveryStatus(course);
  const statusLabel = getDeliveryStatusLabel(status);
  const statusVariant = getDeliveryStatusVariant(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <DialogHeader className="pr-8 shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="info" className="font-mono text-[11px]">
                  <Hash className="w-3 h-3" />
                  {course.code}
                </Badge>
                <Badge variant={statusVariant} className="text-[11px]">
                  <Clock className="w-3 h-3" />
                  {statusLabel}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-bold leading-tight">
                {course.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {course.description ||
                  "No description provided for this course."}
              </DialogDescription>
            </div>
            <div className="shrink-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-1">
          {(["details", "documents", "exams"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "documents" && <FolderOpen className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab === "exams" && <FileText className="w-3.5 h-3.5 inline mr-1.5" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" && (
            <div className="p-5 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoTile
                  icon={<GraduationCap className="w-4 h-4" />}
                  label="Credits"
                  value={`${course.credits} ${course.credits === 1 ? "credit" : "credits"}`}
                />
                <InfoTile
                  icon={<User className="w-4 h-4" />}
                  label="Instructor"
                  value={course.instructor || "TBD"}
                />
                <InfoTile
                  icon={<Building className="w-4 h-4" />}
                  label="Department"
                  value={course.department}
                />
                <InfoTile
                  icon={<Layers className="w-4 h-4" />}
                  label="Program"
                  value={course.program}
                />
                <InfoTile
                  icon={<BookMarked className="w-4 h-4" />}
                  label="Year of Study"
                  value={`Year ${course.year_of_study ?? course.year_number ?? "—"}`}
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  Delivery Schedule
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Start Date
                    </p>
                    <p className="text-sm font-medium">
                      {course.start_date ? formatDate(course.start_date) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      End Date
                    </p>
                    <p className="text-sm font-medium">
                      {course.end_date ? formatDate(course.end_date) : "—"}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Period
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {formatDateRange(course.start_date, course.end_date)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentsTab courseId={course.id} variant={variant} />
          )}

          {activeTab === "exams" && (
            <ExamsTab courseId={course.id} variant={variant} />
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 p-5 sm:p-6 border-t border-border bg-muted/20 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            size="sm"
          >
            <X className="w-4 h-4" />
            Close
          </Button>
          {actions}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Documents Tab ────────────────────────────────────────────────

interface DocumentRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
}

function DocumentsTab({ courseId, variant }: { courseId: string; variant: "student" | "admin" }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDocs((data as DocumentRow[]) ?? []);
    } catch {
      toast({ title: "Failed to load documents", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [courseId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${courseId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("course-documents")
        .upload(path, file);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("course-documents")
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from("documents").insert([{
        course_id: courseId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size_bytes: file.size,
        category: "other",
      }]);
      if (dbError) throw dbError;

      toast({ title: "Document uploaded", variant: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(doc: DocumentRow) {
    try {
      const supabase = createClient();
      // Extract path from URL — everything after "course-documents/"
      const urlParts = doc.file_url.split("/course-documents/");
      if (urlParts[1]) {
        await supabase.storage.from("course-documents").remove([urlParts[1]]);
      }
      await supabase.from("documents").delete().eq("id", doc.id);
      toast({ title: "Document deleted", variant: "default" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch {
      toast({ title: "Failed to delete document", variant: "destructive" });
    }
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      {variant === "admin" && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Course Documents</p>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload Document</>
              )}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <FolderOpen className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No documents yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {variant === "admin"
                ? "Upload lecture notes, syllabi, or other materials."
                : "No documents have been uploaded for this course."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <FileRow
              key={doc.id}
              name={doc.file_name}
              title={doc.title}
              category={doc.category}
              fileUrl={doc.file_url}
              sizeBytes={doc.file_size_bytes}
              onDelete={variant === "admin" ? () => handleDelete(doc) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Exams Tab ────────────────────────────────────────────────────

interface ExamRow {
  id: string;
  title: string;
  exam_type: string;
  academic_year: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  created_at: string;
}

function ExamsTab({ courseId, variant }: { courseId: string; variant: "student" | "admin" }) {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [examType, setExamType] = useState<string>("final");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setExams((data as ExamRow[]) ?? []);
    } catch {
      toast({ title: "Failed to load exams", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [courseId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `${courseId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("course-exams")
        .upload(path, file);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("course-exams")
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from("exams").insert([{
        course_id: courseId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        exam_type: examType,
        academic_year: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size_bytes: file.size,
      }]);
      if (dbError) throw dbError;

      toast({ title: "Exam uploaded", variant: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(exam: ExamRow) {
    try {
      const supabase = createClient();
      const urlParts = exam.file_url.split("/course-exams/");
      if (urlParts[1]) {
        await supabase.storage.from("course-exams").remove([urlParts[1]]);
      }
      await supabase.from("exams").delete().eq("id", exam.id);
      toast({ title: "Exam deleted", variant: "default" });
      setExams((prev) => prev.filter((ex) => ex.id !== exam.id));
    } catch {
      toast({ title: "Failed to delete exam", variant: "destructive" });
    }
  }

  return (
    <div className="p-5 sm:p-6 space-y-4">
      {variant === "admin" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-foreground">Previous Exams & Assignments</p>
          <div className="flex items-center gap-2">
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="midterm">Midterm</option>
              <option value="final">Final</option>
              <option value="quiz">Quiz</option>
              <option value="assignment">Assignment</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload</>
              )}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading exams…
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No exams yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {variant === "admin"
                ? "Upload past exam papers or assignments for this course."
                : "No exams have been uploaded for this course."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => (
            <FileRow
              key={exam.id}
              name={exam.file_name}
              title={exam.title}
              category={exam.exam_type}
              fileUrl={exam.file_url}
              sizeBytes={exam.file_size_bytes}
              onDelete={variant === "admin" ? () => handleDelete(exam) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared File Row ───────────────────────────────────────────────

function FileRow({
  name,
  title,
  category,
  fileUrl,
  sizeBytes,
  onDelete,
}: {
  name: string;
  title: string;
  category: string;
  fileUrl: string;
  sizeBytes: number | null;
  onDelete?: () => void;
}) {
  const sizeLabel = sizeBytes
    ? sizeBytes > 1_000_000
      ? `${(sizeBytes / 1_000_000).toFixed(1)} MB`
      : `${Math.round(sizeBytes / 1000)} KB`
    : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 group hover:border-primary/30 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title || name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="secondary" className="text-[10px] capitalize">{category.replace("_", " ")}</Badge>
          {sizeLabel && (
            <span className="text-[11px] text-muted-foreground">{sizeLabel}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Info Tile ─────────────────────────────────────────────────────

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border p-3.5",
        "bg-card hover:border-primary/30 transition-colors"
      )}
    >
      <div className="w-8 h-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground leading-snug truncate">
          {value}
        </p>
      </div>
    </div>
  );
}
