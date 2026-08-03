"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, Calendar, BookOpen, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CourseDetailsModalProps {
  course: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function CourseDetailsModal({ course, isOpen, onClose, onUpdate }: CourseDetailsModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (course) {
      setTitle(course.title || "");
      setCode(course.code || "");
      setCredits(course.credits?.toString() || "");
      setYearOfStudy(course.year_of_study?.toString() || "");
      setDescription(course.description || "");
    }
  }, [course]);

  async function handleSave() {
    if (!course) return;
    setLoading(true);

    const { error } = await (supabase.from("courses") as any)
      .update({
        title: title,
        code: code,
        credits: parseInt(credits) || 0,
        year_of_study: parseInt(yearOfStudy) || 1,
        description: description,
      })
      .eq("id", course.id);

    setLoading(false);

    if (error) {
      console.error("Error updating course:", error.message);
    } else {
      onUpdate();
      onClose();
    }
  }

  if (!course) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Edit Course Details
          </DialogTitle>
          <DialogDescription>
            Update course specifications, credits, academic year, and lectures description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Course Title</label>
            <Input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="Course title..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Course Code</label>
              <Input 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                placeholder="e.g., CS101"
              />
            </div>

            {/* حقل الاعتمادات Credits */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Credits
              </label>
              <Input 
                type="number"
                value={credits} 
                onChange={(e) => setCredits(e.target.value)} 
                placeholder="e.g., 2"
              />
            </div>

            {/* حقل السنة الدراسية Academic Year / Year of Study */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Year of Study
              </label>
              <Input 
                type="number"
                value={yearOfStudy} 
                onChange={(e) => setYearOfStudy(e.target.value)} 
                placeholder="e.g., 1, 3"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lectures & Course Content</label>
            <textarea 
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Add lecture notes, syllabus, or links..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}