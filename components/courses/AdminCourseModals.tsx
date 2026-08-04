"use client";

import * as React from "react";
import { useTransition } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Course } from "@/types";

import {
  planCourseSchema as courseSchema,
  type PlanCourseFormData as CourseFormData,
} from "@/lib/academic-structure/schemas";

import { createCourse, updateCourse } from "@/lib/courses/actions";

interface AdminCourseModalsProps {
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  editing: Course | null;
  setEditing: (c: Course | null) => void;
  onRefresh: () => void;
}

export function AdminCourseModals({
  addOpen,
  setAddOpen,
  editing,
  setEditing,
  onRefresh,
}: AdminCourseModalsProps) {
  return (
    <>
      <AddCourseModal
        open={addOpen}
        setOpen={setAddOpen}
        onSuccess={onRefresh}
      />
      <EditCourseModal
        course={editing}
        open={!!editing}
        setOpen={(v) => !v && setEditing(null)}
        onSuccess={onRefresh}
      />
    </>
  );
}

function AddCourseModal({
  open,
  setOpen,
  onSuccess,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      specialization_id: null,
      year_number: 1,
      code: "",
      title: "",
      description: "",
      credits: 3,
      instructor: "",
    },
  });

  React.useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  const onSubmit = (data: CourseFormData) => {
    startTransition(async () => {
      const res = await createCourse(data as any);
      if (res.error) {
        toast({ title: "Failed to create course", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Course created", description: `${data.code} has been added successfully.`, variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              Add New Course
            </DialogTitle>
            <DialogDescription>
              Create a new course and define its academic target.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
            <CourseFormFields form={form} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</> : "Create Course"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCourseModal({
  course,
  open,
  setOpen,
  onSuccess,
}: {
  course: Course | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      specialization_id: null,
      year_number: 1,
      code: "",
      title: "",
      description: "",
      credits: 3,
      instructor: "",
    },
  });

  React.useEffect(() => {
    if (open && course) {
      form.reset({
        specialization_id: (course as any).specialization_id ?? null,
        year_number: (course as any).year_number ?? (course as any).year_of_study ?? 1,
        code: course.code,
        title: course.title,
        description: course.description ?? "",
        credits: course.credits,
        instructor: course.instructor ?? "",
      });
    }
  }, [open, course, form]);

  const onSubmit = (data: CourseFormData) => {
    if (!course) return;
    startTransition(async () => {
      const res = await updateCourse(course.id, data as any);
      if (res.error) {
        toast({ title: "Failed to update course", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Course updated", description: `${data.code} has been saved.`, variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Edit Course</DialogTitle>
            <DialogDescription>Modify details for <strong className="font-mono">{course?.code}</strong></DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
            <CourseFormFields form={form} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CourseFormFields({ form }: { form: UseFormReturn<CourseFormData> }) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Course Code" required error={errors.code?.message}>
            <Input {...register("code")} placeholder="e.g. CS301" />
          </Field>
          <Field label="Credits" required error={errors.credits?.message}>
            <Input type="number" {...register("credits", { valueAsNumber: true })} min={1} />
          </Field>
          <Field label="Instructor" error={errors.instructor?.message}>
            <Input {...register("instructor")} placeholder="e.g. Dr. Ahmed" />
          </Field>
        </div>
        <Field label="Course Title" required error={errors.title?.message}>
          <Input {...register("title")} placeholder="e.g. Data Structures" />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <Textarea {...register("description")} placeholder="Brief description..." />
        </Field>
      </section>

      <div className="border-t border-border -mx-5 sm:-mx-6" />

      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
          <Field label="Year Number" required error={errors.year_number?.message}>
            <Input type="number" {...register("year_number", { valueAsNumber: true })} min={1} />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}