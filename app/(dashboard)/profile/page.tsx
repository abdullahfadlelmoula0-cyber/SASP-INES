import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { User, Mail, Hash, Calendar, BookOpen, Shield, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "My Profile",
  description: "View and manage your student profile.",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  // 1. جلب المستخدم الحالي
  const { data: { user } } = await supabase.auth.getUser();

  // 2. جلب البيانات الإضافية للطالب من جدول profiles (مثل السنة الدراسية، التخصص، الاسم)
  let profileData: any = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profileData = data;
  }

  // استخراج تفاصيل الطالب والإيميل ورقم التسجيل
  const email = user?.email || "ug2528267@ines.ac.rw";
  let regNumber = profileData?.registration_number || "";
  if (!regNumber && email.startsWith("ug")) {
    const rawNums = email.replace("ug", "").split("@")[0];
    if (rawNums.length >= 7) {
      regNumber = `${rawNums.slice(0, 2)}/${rawNums.slice(2)}`;
    }
  } else if (!regNumber) {
    regNumber = "25/28267";
  }

  const fullName = profileData?.full_name || user?.user_metadata?.full_name || "Abdullah";
  const currentYear = profileData?.year_of_study || profileData?.current_year || "1";
  const programName = profileData?.program || "Computer Science";
  const academicYear = profileData?.academic_year || "2025-2026";

  // 3. إجمالي الكورسات المرئية فعليًا للطالب — نعتمد على نفس سياسة
  // courses_select_student التي تعرض الكورسات فعليًا للطالب (النظام
  // القديم النصي أو academic_plan_id/specialization_id/year_number) — بدل
  // تكرار المنطق يدويًا هنا باستخدام العمود النصي department القديم
  // الذي يعطي رقمًا أقل من الحقيقي للطلاب المنقولين للهيكل الجديد.
  let totalCourses = 0;
  try {
    const { count, error } = await supabase
      .from("courses")
      .select("*", { count: "exact", head: true });

    if (!error && count !== null) {
      totalCourses = count;
    }
  } catch (e) {
    console.error("Error fetching courses count:", e);
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader
        title="My Profile"
        description="View and update your student information."
      />

      {/* Quick link to Settings — kept here too so it's reachable on
          mobile, where the bottom nav intentionally stays at 5 items. */}
      <Link
        href="/settings"
        className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-primary" />
          Settings, Appearance & Help
        </span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* بطاقة معلومات الطالب المختصرة */}
        <Card className="md:col-span-1 border-border/60 shadow-sm flex flex-col items-center text-center p-6 bg-card">
          <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold mb-4 shadow-inner">
            {fullName.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold">{fullName}</h2>
          <p className="text-xs text-muted-foreground mt-1">{email}</p>
          <div className="mt-4 w-full pt-4 border-t flex justify-around">
            <div>
              <p className="text-xs text-muted-foreground">Total Courses</p>
              <p className="text-xl font-bold text-primary">{totalCourses}</p>
            </div>
            <div className="border-r" />
            <div>
              <p className="text-xs text-muted-foreground">Current Year</p>
              <p className="text-xl font-bold text-emerald-600">Year {currentYear}</p>
            </div>
          </div>
        </Card>

        {/* تفاصيل الملف الأكاديمي */}
        <Card className="md:col-span-2 border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Academic Information</CardTitle>
            <CardDescription>Official institutional registration details at INES</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                <Hash className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Registration Number</p>
                  <p className="font-mono font-semibold text-sm mt-0.5">{regNumber}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                <Mail className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Institutional Email</p>
                  <p className="font-medium text-sm mt-0.5">{email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                <BookOpen className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Program / Department</p>
                  <p className="font-medium text-sm mt-0.5">{programName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                <Calendar className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Academic Year</p>
                  <p className="font-medium text-sm mt-0.5">{academicYear}</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Student Status</span>
                </div>
                <Badge variant="success">Active Enrolled</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}