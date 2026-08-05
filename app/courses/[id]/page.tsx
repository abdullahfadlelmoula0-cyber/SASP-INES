import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, FileText, Download, Users, Calendar, Award, FolderOpen } from "lucide-react";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentCourseDetailsPage({ params }: CoursePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. جلب بيانات الكورس المحدد من قاعدة البيانات
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (courseError || !course) {
    notFound();
  }

  // 2. جلب المستندات والملفات الحقيقية المرتبطة بهذا الكورس من جدول documents
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("*")
    .eq("course_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* زر العودة */}
      <div>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/courses">
            <ArrowLeft className="w-4 h-4" />
            Back to My Courses
          </Link>
        </Button>
      </div>

      {/* رأس صفحة المادة */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono bg-primary/10 text-primary px-3 py-1 rounded-md text-sm font-bold">
                {course.code}
              </span>
              <h1 className="text-2xl font-bold">{course.title}</h1>
            </div>
            <p className="text-muted-foreground">{course.description || "No description provided."}</p>
          </div>
        </div>

        {/* إحصائيات ومعلومات الكورس الحقيقية */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <Award className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Credits</p>
              <p className="font-semibold">{course.credits ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Year of Study</p>
              <p className="font-semibold">Year {course.year_of_study ?? course.year_number ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Instructor</p>
              <p className="font-semibold">{course.instructor || "Not assigned"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* قسم مستندات ومفات الكورس الحقيقية */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Course Materials & Documents</h2>
        
        {documents && documents.length > 0 ? (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{doc.title}</h3>
                    <p className="text-xs text-muted-foreground">{doc.description || doc.file_name || "No additional description"}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FolderOpen className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No documents or materials uploaded for this course yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}