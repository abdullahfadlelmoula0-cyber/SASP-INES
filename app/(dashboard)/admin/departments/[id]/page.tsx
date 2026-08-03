"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Trash2, Power, GitBranch } from "lucide-react";
import { CourseDetailsModal } from "@/components/courses/CourseDetailsModal";

export default function DepartmentCoursesPage() {
  const params = useParams();
  const deptId = params.id;
  const [departmentData, setDepartmentData] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [existingTracks, setExistingTracks] = useState<string[]>([]);
  
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("1");
  
  const [selectedOption, setSelectedOption] = useState("");
  const [customOptionInput, setCustomOptionInput] = useState("");

  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (deptId) {
      fetchDeptAndCourses();
    }
  }, [deptId]);

  async function fetchDeptAndCourses() {
    const { data: dept } = await (supabase.from("departments") as any).select("*").eq("id", deptId).single();
    if (dept) setDepartmentData(dept);

    const { data: courseList } = await (supabase.from("courses") as any).select("*").eq("department_id", deptId);
    if (courseList) {
      setCourses(courseList);
      
      // استخراج التخصصات الفريدة بدون تكرار وتحويلها إلى Capital Letters بالكامل
// استخراج التخصصات وتصفيتها لمنع أي تكرار أو تشابه إملائي
      const tracksMap = new Map<string, string>();
      courseList.forEach((c: any) => {
        if (c.option_track && c.option_track.trim() !== "") {
          let track = c.option_track.trim().toUpperCase();
          // تصحيح الأخطاء الإملائية الشائعة مباشرة لتتطابق تلقائياً
          if (track === "NETWROK" || track === "NETOWRK") {
            track = "NETWORK";
          }
          tracksMap.set(track, track);
        }
      });
      if (dept?.options) {
        dept.options.forEach((opt: string) => {
          if (opt && opt.trim() !== "") {
            const upperOpt = opt.trim().toUpperCase();
            tracksMap.set(upperOpt, upperOpt);
          }
        });
      }
      setExistingTracks(Array.from(tracksMap.values()));
    }
  }

  const isFinalYear = departmentData && parseInt(yearOfStudy) === departmentData.year_number;

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;

    let finalOptionTrack = selectedOption;
    if (isFinalYear && selectedOption === "other" && customOptionInput.trim()) {
      finalOptionTrack = customOptionInput.trim().toUpperCase(); // حفظ النص الجديد بأحرف كبيرة أيضاً
    }

    const { error } = await (supabase.from("courses") as any).insert([{
      title: title,
      code: code,
      credits: parseInt(credits) || 3,
      year_of_study: parseInt(yearOfStudy) || 1,
      option_track: isFinalYear ? finalOptionTrack : null,
      is_active: true,
      department_id: deptId,
      department: departmentData?.name || ""
    }]);

    if (error) {
      console.error("Error inserting course:", error.message);
      return;
    }

    setTitle("");
    setCode("");
    setCredits("");
    setYearOfStudy("1");
    setSelectedOption("");
    setCustomOptionInput("");
    fetchDeptAndCourses();
  }

  async function handleToggleActive(courseId: string, currentStatus: boolean, e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await (supabase.from("courses") as any)
      .update({ is_active: !currentStatus })
      .eq("id", courseId);

    if (!error) fetchDeptAndCourses();
  }

  async function handleDeleteCourse(courseId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await (supabase.from("courses") as any).delete().eq("id", courseId);
    fetchDeptAndCourses();
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-6">
      <PageHeader
        title={departmentData ? `Department: ${departmentData.name}` : "Department Courses"}
        description={`Manage courses. Total years for this program: ${departmentData?.year_number || 4}.`}
      />

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Add Course to Department</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCourse} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Input
                placeholder="Course Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Input
                placeholder="Code (e.g., CS101)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Credits (e.g., 3)"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
              <Input
                type="number"
                placeholder={`Year (1 - ${departmentData?.year_number || 4})`}
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                required
              />
            </div>

            {isFinalYear && (
              <div className="p-4 bg-muted/40 rounded-lg border border-border/60 space-y-3 animate-in fade-in-50">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <GitBranch className="w-3.5 h-3.5 text-primary" /> Specialization / Track (Final Year Required):
                </label>
                
                <select 
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  required={isFinalYear}
                >
                  <option value="">-- Select Existing Option / Track --</option>
                  {existingTracks.map((track, idx) => (
                    <option key={idx} value={track}>{track}</option>
                  ))}
                  <option value="other">+ Add New Specialization...</option>
                </select>

                {selectedOption === "other" && (
                  <Input
                    placeholder="Type new specialization name (e.g., NETWORK)"
                    value={customOptionInput}
                    onChange={(e) => setCustomOptionInput(e.target.value)}
                    required
                  />
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" className="gap-2">
                <Plus className="w-4 h-4" /> Add Course
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Assigned Courses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <Card 
              key={course.id} 
              onClick={() => {
                setSelectedCourse(course);
                setIsModalOpen(true);
              }}
              className="border-border/60 shadow-sm flex items-center justify-between p-4 cursor-pointer hover:border-primary/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${course.is_active !== false ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{course.title}</p>
                    {course.option_track && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                        {course.option_track}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${course.is_active !== false ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      {course.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {course.code || "No Code"} • Year {course.year_of_study || 1} • {course.credits || 3} Credits
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={(e) => handleToggleActive(course.id, course.is_active !== false, e)}
                >
                  <Power className={`w-4 h-4 ${course.is_active !== false ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={(e) => handleDeleteCourse(course.id, e)}
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </Button>
              </div>
            </Card>
          ))}
          {courses.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">No courses added to this department yet.</p>
          )}
        </div>
      </div>

      <CourseDetailsModal 
        course={selectedCourse}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={() => fetchDeptAndCourses()}
      />
    </div>
  );
}