"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  FileText,
  Download,
  ClipboardList,
  Info,
  BookOpen,
  CalendarDays,
  Users,
  Award,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Document, Exam, Course } from "@/types";

// ── Category badge colours ────────────────────────────────────────
const categoryLabel: Record<string, string> = {
  lecture_notes: "Lecture Notes",
  syllabus:      "Syllabus",
  handbook:      "Handbook",
  form:          "Form",
  other:         "Other",
};

const examTypeLabel: Record<string, string> = {
  midterm:    "Midterm",
  final:      "Final",
  quiz:       "Quiz",
  assignment: "Assignment",
};

// ── Helpers ───────────────────────────────────────────────────────
function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Signed-URL download button ────────────────────────────────
/**
 * Extracts the Supabase storage bucket + path from a stored file_url,
 * then calls createSignedUrl() to get a short-lived authenticated link.
 * Falls back to opening file_url directly if it can't be parsed.
 */
function DownloadButton({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setErr(null);
    setLoading(true);

    try {
      // Parse: https://{project}.supabase.co/storage/v1/object/public/{bucket}/{path...}
      // or:    https://{project}.supabase.co/storage/v1/object/sign/{bucket}/{path...}
      const match = fileUrl.match(
        /\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+)/
      );

      if (!match) {
        // Not a Supabase storage URL — open directly
        window.open(fileUrl, "_blank", "noopener");
        return;
      }

      const [, bucket, rawPath] = match;
      // Strip any existing query string from the path
      const filePath = rawPath.split("?")[0];

      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // valid for 1 hour

      if (error || !data?.signedUrl) {
        // Bucket may not exist yet — show a friendly message
        setErr("File not available. Please contact your administrator.");
        return;
      }

      window.open(data.signedUrl, "_blank", "noopener");
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fileUrl]);

  return (
    <div className="shrink-0 flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 whitespace-nowrap"
        onClick={handleClick}
        disabled={loading}
      >
        <Download className={cn("w-3.5 h-3.5", loading && "animate-bounce")} />
        {loading ? "Opening…" : "Download"}
      </Button>
      {err && (
        <p className="text-[10px] text-destructive max-w-[140px] text-right leading-tight">
          {err}
        </p>
      )}
    </div>
  );
}

// ── File card (shared by docs + exams) ───────────────────────────
function FileCard({
  icon,
  title,
  subtitle,
  badge,
  fileUrl,
  fileName,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  fileUrl: string;
  fileName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground leading-snug truncate pr-1">
            {title}
          </p>
          {(subtitle || badge) && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {badge && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {badge}
                </Badge>
              )}
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <DownloadButton fileUrl={fileUrl} fileName={fileName} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
    </div>
  );
}

// ── Tab definition ────────────────────────────────────────────────
type TabId = "documents" | "exams" | "info";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
  count?: number;
}

// ── Main component ────────────────────────────────────────────────
interface CourseDetailTabsProps {
  course: Course;
  documents: Document[];
  exams: Exam[];
}

export function CourseDetailTabs({ course, documents, exams }: CourseDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("documents");

  const tabs: Tab[] = [
    { id: "documents", label: "Documents", icon: FileText,       count: documents.length },
    { id: "exams",     label: "Exams",     icon: ClipboardList,  count: exams.length },
    { id: "info",      label: "Info",      icon: Info },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Documents tab */}
      {activeTab === "documents" && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <EmptySection message="No documents have been uploaded for this course yet. Check back later." />
          ) : (
            documents.map((doc) => (
              <FileCard
                key={doc.id}
                icon={<FileText className="w-5 h-5" />}
                title={doc.title}
                badge={categoryLabel[doc.category] ?? doc.category}
                subtitle={[
                  doc.description,
                  formatBytes(doc.file_size_bytes),
                  formatDate(doc.created_at),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                fileUrl={doc.file_url}
                fileName={doc.file_name}
              />
            ))
          )}
        </div>
      )}

      {/* Exams tab */}
      {activeTab === "exams" && (
        <div className="space-y-3">
          {exams.length === 0 ? (
            <EmptySection message="No past exam papers have been uploaded for this course yet." />
          ) : (
            exams.map((exam) => (
              <FileCard
                key={exam.id}
                icon={<ClipboardList className="w-5 h-5" />}
                title={exam.title}
                badge={examTypeLabel[exam.exam_type] ?? exam.exam_type}
                subtitle={[
                  exam.academic_year,
                  formatBytes(exam.file_size_bytes),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                fileUrl={exam.file_url}
                fileName={exam.file_name}
              />
            ))
          )}
        </div>
      )}

      {/* Info tab */}
      {activeTab === "info" && (
        <div className="grid gap-3">
          <InfoRow
            icon={<BookOpen className="w-4 h-4" />}
            label="Description"
            value={course.description || "No description provided for this course."}
          />
          <div className="grid grid-cols-2 gap-3">
            <InfoRow
              icon={<Award className="w-4 h-4" />}
              label="Credits"
              value={String(course.credits ?? "—")}
            />
            <InfoRow
              icon={<CalendarDays className="w-4 h-4" />}
              label="Year of Study"
              value={`Year ${course.year_of_study ?? course.year_number ?? "—"}`}
            />
            <InfoRow
              icon={<Users className="w-4 h-4" />}
              label="Instructor"
              value={course.instructor || "Not assigned"}
            />
            <InfoRow
              icon={<ExternalLink className="w-4 h-4" />}
              label="Department"
              value={course.department || "—"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tiny info row used in the Info tab ───────────────────────────
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl">
      <div className="mt-0.5 text-primary shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground leading-snug">{value}</p>
      </div>
    </div>
  );
}
