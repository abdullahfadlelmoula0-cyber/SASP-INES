// Save as: components/academic-structure/PlanCourseModals.tsx
"use client";

import * as React from "react";
import { useTransition } from "react";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
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
import { Loader2, Plus, AlertTriangle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import type { Course } from "@/types";
import { cn } from "@/lib/utils";

// ✅ 1. استيراد الـ Schema والـ Type من ملف schemas الجديد
import {
  planCourseSchema,
  type PlanCourseFormData,
} from "@/lib/academic-structure/schemas";

// ✅ 2. استيراد الـ Server Actions فقط من ملف actions
import {
  createPlanCourse,
  updatePlanCourse,
} from "@/lib/academic-structure/actions";

interface PlanCourseContext {
  academicPlanId: string;
  specializationId: string | null;
  yearNumber: number;
  departmentId: string;
}

export function AddPlanCourseModal({
  context,
  open,
  setOpen,
  onSuccess,
}: {
  context: PlanCourseContext;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PlanCourseFormData>({
    resolver: zodResolver(planCourseSchema),
    defaultValues: {
      academic_plan_id: context.academicPlanId,
      specialization_id: context.specializationId,
      year_number: context.yearNumber,
      code: "",
      title: "",
      description: "",
      credits: 3,
      instructor: "",
      start_date: "",
      end_date: "",
      is_active: false,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        academic_plan_id: context.academicPlanId,
        specialization_id: context.specializationId,
        year_number: context.yearNumber,
        code: "",
        title: "",
        description: "",
        credits: 3,
        instructor: "",
        start_date: "",
        end_date: "",
        is_active: false,
      });
    }
  }, [open, context, form]);

  const onSubmit = (data: PlanCourseFormData) => {
    startTransition(async () => {
      const res = await createPlanCourse(data, context.departmentId);
      if (res.error) {
        toast({ title: "Failed to create course", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Course created", description: `${data.code} has been added.`, variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              Add Course — Year {context.yearNumber}
            </DialogTitle>
            <DialogDescription>
              This course is scoped to Year {context.yearNumber}
              {context.specializationId ? " for the selected track" : " (shared trunk)"}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
            <PlanCourseFormFields form={form} mode="create" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating…
                </>
              ) : (
                "Create Course"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPlanCourseModal({
  course,
  departmentId,
  open,
  setOpen,
  onSuccess,
}: {
  course: Course | null;
  departmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<PlanCourseFormData>({
    resolver: zodResolver(planCourseSchema),
    defaultValues: {
      academic_plan_id: "",
      specialization_id: null,
      year_number: 1,
      code: "",
      title: "",
      description: "",
      credits: 3,
      instructor: "",
      start_date: "",
      end_date: "",
      is_active: false,
    },
  });

  React.useEffect(() => {
    if (open && course) {
      form.reset({
        academic_plan_id: course.academic_plan_id ?? "",
        specialization_id: course.specialization_id ?? null,
        year_number: course.year_number ?? 1,
        code: course.code,
        title: course.title,
        description: course.description ?? "",
        credits: course.credits,
        instructor: course.instructor ?? "",
        start_date: course.start_date ?? "",
        end_date: course.end_date ?? "",
        is_active: course.is_active,
      });
    }
  }, [open, course, form]);

  const onSubmit = (data: PlanCourseFormData) => {
    if (!course) return;
    startTransition(async () => {
      const res = await updatePlanCourse(course.id, data, departmentId);
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
      <DialogContent className="sm:max-w-2xl" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[90vh]">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Edit Course</DialogTitle>
            <DialogDescription>
              Modify details for <strong className="font-mono">{course?.code}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
            <PlanCourseFormFields form={form} mode="edit" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanCourseFormFields({
  form,
  mode,
}: {
  form: UseFormReturn<PlanCourseFormData>;
  mode: "create" | "edit";
}) {
  const { register, watch, formState: { errors } } = form;
  const is_active = watch("is_active");

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

      {/* تم إزالة قسم Academic Year والابتعاد عن استيراد ACADEMIC_YEARS لعدم الحاجة إليهما */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date" error={errors.start_date?.message}>
            <Input type="date" {...register("start_date")} />
          </Field>
          <Field label="End Date" error={errors.end_date?.message}>
            <Input type="date" {...register("end_date")} />
          </Field>
        </div>
      </section>

      <div className="border-t border-border -mx-5 sm:-mx-6" />

      <section className="space-y-3">
        <div
          className={cn(
            "rounded-xl border p-4 sm:p-5 transition-colors",
            is_active ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"
          )}
        >
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <input type="checkbox" {...register("is_active")} className="w-5 h-5 mt-0.5 accent-emerald-500" />
              <div>
                <p className="font-semibold text-sm">{is_active ? "Course is Active" : "Course is Draft / Inactive"}</p>
                <p className="text-xs text-muted-foreground">
                  Students can only see active courses matching their year/track.
                </p>
              </div>
            </div>
            <Badge variant={is_active ? "success" : "warning"}>{is_active ? "Active" : "Draft"}</Badge>
          </label>
        </div>
        {!is_active && mode === "create" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm mt-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800">New courses default to Draft. Students won&apos;t see it until you activate it.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}