// Save as: components/academic-structure/CourseMaterialsModal.tsx
"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Loader2, Upload, Trash2, FileText, ClipboardList, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";
import type { Course } from "@/types";
import {
  fetchCourseDocuments,
  fetchCourseExams,
  uploadCourseDocument,
  uploadCourseExam,
  deleteCourseDocument,
  deleteCourseExam,
  type CourseDocument,
  type CourseExam,
} from "@/lib/academic-structure/materials";

type Tab = "documents" | "exams";

const DOCUMENT_CATEGORIES = [
  { value: "lecture_notes", label: "Lecture Notes" },
  { value: "syllabus", label: "Syllabus" },
  { value: "handbook", label: "Handbook" },
  { value: "form", label: "Form" },
  { value: "other", label: "Other" },
];

const EXAM_TYPES = [
  { value: "midterm", label: "Midterm" },
  { value: "final", label: "Final Exam" },
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
];

export function CourseMaterialsModal({
  course,
  open,
  setOpen,
}: {
  course: Course | null;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("documents");
  const [documents, setDocuments] = useState<CourseDocument[]>([]);
  const [exams, setExams] = useState<CourseExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, startUpload] = useTransition();

  // Document upload form
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [docCategory, setDocCategory] = useState("lecture_notes");

  // Exam upload form
  const [examFile, setExamFile] = useState<File | null>(null);
  const [examTitle, setExamTitle] = useState("");
  const [examType, setExamType] = useState("midterm");
  const [examYear, setExamYear] = useState("2025-2026");

  async function loadAll() {
    if (!course) return;
    setLoading(true);
    const [docsRes, examsRes] = await Promise.all([
      fetchCourseDocuments(course.id),
      fetchCourseExams(course.id),
    ]);
    setDocuments(docsRes.data);
    setExams(examsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    if (open && course) {
      void loadAll();
      setDocFile(null);
      setDocTitle("");
      setDocDescription("");
      setExamFile(null);
      setExamTitle("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course?.id]);

  function handleUploadDocument() {
    if (!course || !docFile || !docTitle.trim()) {
      toast({ title: "Missing info", description: "Pick a file and enter a title.", variant: "destructive" });
      return;
    }
    startUpload(async () => {
      const { error } = await uploadCourseDocument(course.id, docFile, {
        title: docTitle.trim(),
        description: docDescription.trim(),
        category: docCategory,
      });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Document uploaded", variant: "success" });
        setDocFile(null);
        setDocTitle("");
        setDocDescription("");
        void loadAll();
      }
    });
  }

  function handleUploadExam() {
    if (!course || !examFile || !examTitle.trim()) {
      toast({ title: "Missing info", description: "Pick a file and enter a title.", variant: "destructive" });
      return;
    }
    startUpload(async () => {
      const { error } = await uploadCourseExam(course.id, examFile, {
        title: examTitle.trim(),
        exam_type: examType,
        academic_year: examYear.trim(),
      });
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "File uploaded", variant: "success" });
        setExamFile(null);
        setExamTitle("");
        void loadAll();
      }
    });
  }

  async function handleDeleteDocument(id: string) {
    const { error } = await deleteCourseDocument(id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", variant: "success" });
      void loadAll();
    }
  }

  async function handleDeleteExam(id: string) {
    const { error } = await deleteCourseExam(id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", variant: "success" });
      void loadAll();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl" hideClose={isUploading}>
        <div className="flex flex-col max-h-[85vh]">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Course Materials</DialogTitle>
            <DialogDescription>
              Manage documents and exams for <strong className="font-mono">{course?.code}</strong> — students who can
              see this course see these automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 border-b border-border px-5 sm:px-6 pt-4">
            {[
              { key: "documents" as const, label: "Documents", icon: FileText, count: documents.length },
              { key: "exams" as const, label: "Exams & Assignments", icon: ClipboardList, count: exams.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors",
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                <Badge variant={tab === t.key ? "default" : "muted"}>{t.count}</Badge>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            {loading ? (
              <LoadingSpinner size="md" label="Loading materials…" />
            ) : tab === "documents" ? (
              <>
                {/* Upload form */}
                <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Upload className="w-4 h-4" /> Upload a document
                  </p>
                  <Input
                    type="file"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  <Input placeholder="Title (e.g. Week 3 Lecture Notes)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                  <Input placeholder="Description (optional)" value={docDescription} onChange={(e) => setDocDescription(e.target.value)} />
                  <Select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={handleUploadDocument} disabled={isUploading} className="w-full">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload Document
                  </Button>
                </div>

                {/* List */}
                {documents.length === 0 ? (
                  <EmptyState icon={FileText} title="No documents yet" description="Upload the first document above." />
                ) : (
                  <div className="space-y-2">
                    {documents.map((d) => (
                      <MaterialRow
                        key={d.id}
                        title={d.title}
                        subtitle={d.file_name}
                        badge={d.category.replace("_", " ")}
                        fileUrl={d.file_url}
                        onDelete={() => handleDeleteDocument(d.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Upload form */}
                <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Upload className="w-4 h-4" /> Upload an exam or assignment
                  </p>
                  <Input
                    type="file"
                    onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  <Input placeholder="Title (e.g. Midterm 2025)" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={examType} onChange={(e) => setExamType(e.target.value)}>
                      {EXAM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                    <Input placeholder="Academic Year" value={examYear} onChange={(e) => setExamYear(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={handleUploadExam} disabled={isUploading} className="w-full">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Upload File
                  </Button>
                </div>

                {/* List */}
                {exams.length === 0 ? (
                  <EmptyState icon={ClipboardList} title="No exams or assignments yet" description="Upload the first file above." />
                ) : (
                  <div className="space-y-2">
                    {exams.map((e) => (
                      <MaterialRow
                        key={e.id}
                        title={e.title}
                        subtitle={e.academic_year}
                        badge={EXAM_TYPES.find((t) => t.value === e.exam_type)?.label ?? e.exam_type}
                        fileUrl={e.file_url}
                        onDelete={() => handleDeleteExam(e.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MaterialRow({
  title,
  subtitle,
  badge,
  fileUrl,
  onDelete,
}: {
  title: string;
  subtitle: string;
  badge: string;
  fileUrl: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-card border rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <FileText className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{title}</p>
            <Badge variant="outline" className="shrink-0 capitalize">{badge}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">View</a>
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={onDelete} aria-label="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
