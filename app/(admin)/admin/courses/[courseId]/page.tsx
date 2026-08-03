import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, FileText, Upload, Users, Calendar, Award } from "lucide-react";

interface AdminCoursePageProps {
  params: Promise<{ courseId: string }>;
}

export default async function AdminCourseDetailsPage({ params }: AdminCoursePageProps) {
  const { courseId } = await params;
  const supabase = await createClient();

  // جلب بيانات الكورس من قاعدة البيانات
  const { data: course, error } = await (supabase.from("courses") as any)
    .select("*")
    .eq("id", courseId)
    .single();

  if (error || !course) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* زر العودة لقائمة الكورسات في لوحة التحكم */}
      <div>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/admin/courses">
            <ArrowLeft className="w-4 h-4" />
            Back to Courses Management
          </Link>
        </Button>
      </div>

      {/* رأس الصفحة وبيانات الكورس */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="font-mono bg-primary/10 text-primary px-3 py-1 rounded-md text-sm font-bold">
                {course.code || "N/A"}
              </span>
              <h1 className="text-2xl font-bold">{course.title}</h1>
              {/* شارة حالة التفعيل */}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${course.is_active !== false ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {course.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-muted-foreground">{course.description || "No description provided."}</p>
          </div>
          
          {/* زر رفع ملفات أو تعديل الكورس للأدمن */}
          <Button className="gap-2">
            <Upload className="w-4 h-4" />
            Upload Material
          </Button>
        </div>

        {/* إحصائيات ومعلومات */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <Award className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Credits</p>
              <p className="font-semibold">{course.credits || 3}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Year of Study</p>
              <p className="font-semibold">Year {course.year_of_study || 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="font-semibold">{course.department || "General"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* قسم إدارة محتويات الكورس */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Course Materials & Lectures</h2>
        </div>
        
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-4 bg-card border rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Syllabus & Introduction</h3>
                <p className="text-xs text-muted-foreground">Uploaded material</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}