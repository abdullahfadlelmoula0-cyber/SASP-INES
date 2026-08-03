// Save as: components/academic-structure/SpecializationModals.tsx
"use client";

import * as React from "react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { AcademicPlan, Specialization } from "@/types/academic-structure";

// ✅ 1. استيراد الـ Schema والـ Type من ملف schemas الجديد
import {
  specializationSchema,
  type SpecializationFormData,
} from "@/lib/academic-structure/schemas";

// ✅ 2. استيراد الـ Server Actions فقط من ملف actions
import {
  createSpecialization,
  updateSpecialization,
} from "@/lib/academic-structure/actions";

export function AddSpecializationModal({
  plan,
  departmentId,
  open,
  setOpen,
  onSuccess,
}: {
  plan: AcademicPlan;
  departmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<SpecializationFormData>({
    resolver: zodResolver(specializationSchema),
    defaultValues: { academic_plan_id: plan.id, name: "", total_duration_years: plan.shared_years },
  });

  React.useEffect(() => {
    if (open) form.reset({ academic_plan_id: plan.id, name: "", total_duration_years: plan.shared_years });
  }, [open, plan, form]);

  const onSubmit = (data: SpecializationFormData) => {
    startTransition(async () => {
      const res = await createSpecialization(data, departmentId);
      if (res.error) {
        toast({ title: "Failed to create specialization", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Specialization created", description: `${data.name} has been added.`, variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              Add Specialization
            </DialogTitle>
            <DialogDescription>
              Total duration is measured from Year 1, not years-after-branching.
              Must be at least {plan.shared_years} (the plan's shared trunk).
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            <SpecializationFormFields form={form} minYears={plan.shared_years} />
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
                "Create Specialization"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditSpecializationModal({
  specialization,
  plan,
  departmentId,
  open,
  setOpen,
  onSuccess,
}: {
  specialization: Specialization | null;
  plan: AcademicPlan | null;
  departmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<SpecializationFormData>({
    resolver: zodResolver(specializationSchema),
    defaultValues: { academic_plan_id: "", name: "", total_duration_years: 1 },
  });

  React.useEffect(() => {
    if (open && specialization) {
      form.reset({
        academic_plan_id: specialization.academic_plan_id,
        name: specialization.name,
        total_duration_years: specialization.total_duration_years,
      });
    }
  }, [open, specialization, form]);

  const onSubmit = (data: SpecializationFormData) => {
    if (!specialization) return;
    startTransition(async () => {
      const res = await updateSpecialization(specialization.id, data, departmentId);
      if (res.error) {
        toast({ title: "Failed to update specialization", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Specialization updated", description: "Saved successfully.", variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Edit Specialization</DialogTitle>
            <DialogDescription>
              Must remain at least {plan?.shared_years ?? 1} (the plan's shared trunk).
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            <SpecializationFormFields form={form} minYears={plan?.shared_years ?? 1} />
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

function SpecializationFormFields({
  form,
  minYears,
}: {
  form: ReturnType<typeof useForm<SpecializationFormData>>;
  minYears: number;
}) {
  const { register, formState: { errors } } = form;

  return (
    <>
      <div className="space-y-1.5">
        <Label required>Track Name</Label>
        <Input {...register("name")} placeholder="e.g. Software Engineering" autoFocus />
        {errors.name && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label required>Total Duration (years)</Label>
        <Input
          type="number"
          min={minYears}
          {...register("total_duration_years", { valueAsNumber: true })}
        />
        {errors.total_duration_years && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.total_duration_years.message}
          </p>
        )}
      </div>
    </>
  );
}