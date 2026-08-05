import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { CourseDetailTabs } from "@/components/courses/CourseDetailTabs";
import type { Document, Exam } from "@/types";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CoursePageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title, code")
    .eq("id", id)
    .single();

  return {
    title: course ? `${course.code} — ${course.title}` : "Course",
    description: `Course materials, documents, and past exams for ${course?.title ?? "this course"}.`,
  };
}

export default async function StudentCourseDetailsPage({ params }: CoursePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // ── 1. Course ─────────────────────────────────────────────────
  const { data: course, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !course) {
    notFound();
  }

  // ── 2. Documents for this course ───────────────────────────────
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, description, category, file_url, file_name, file_size_bytes, created_at")
    .eq("course_id", id)
    .order("created_at", { ascending: false });

  // ── 3. Exams for this course ───────────────────────────────────
  const { data: exams } = await supabase
    .from("exams")
    .select("id, title, exam_type, academic_year, file_url, file_name, file_size_bytes, created_at")
    .eq("course_id", id)
    .order("created_at", { ascending: false });

  // ── Initials for the avatar ────────────────────────────────────
  const initials = course.code
    ? course.code.replace(/[^A-Z0-9]/gi, "").slice(0, 3).toUpperCase()
    : course.title.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-3xl mx-auto pb-24 md:pb-8">
      {/* Back button */}
      <Button variant="ghost" asChild className="gap-2 -ml-2">
        <Link href="/courses">
          <ArrowLeft className="w-4 h-4" />
          Back to My Courses
        </Link>
      </Button>

      {/* Course header card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        {/* Title row */}
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm font-mono border border-primary/20">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono bg-primary/10 text-primary px-2.5 py-0.5 rounded-md text-xs font-bold">
                {course.code}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 leading-snug">
              {course.title}
            </h1>
            {course.description && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {course.description}
              </p>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{course.credits ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">Credits</p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-lg font-bold text-foreground">
              Yr {course.year_of_study ?? course.year_number ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">Year</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground truncate px-1">
              {course.instructor ? course.instructor.split(" ")[0] : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">Instructor</p>
          </div>
        </div>
      </div>

      {/* Tabs: Documents / Exams / Info */}
      <CourseDetailTabs
        course={course}
        documents={(documents ?? []) as Document[]}
        exams={(exams ?? []) as Exam[]}
      />
    </div>
  );
}