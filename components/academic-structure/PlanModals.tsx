// Save as: components/academic-structure/PlanModals.tsx
"use client";

import * as React from "react";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { AcademicPlan } from "@/types/academic-structure";

// Import Schema and Type from schemas.ts
import {
  academicPlanSchema,
  type AcademicPlanFormData,
} from "@/lib/academic-structure/schemas";

// Import Server Actions only from actions.ts
import {
  createAcademicPlan,
  updateAcademicPlan,
} from "@/lib/academic-structure/actions";

export function AddPlanModal({
  departmentId,
  open,
  setOpen,
  onSuccess,
}: {
  departmentId: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<AcademicPlanFormData>({
    resolver: zodResolver(academicPlanSchema),
    defaultValues: { department_id: departmentId, name: "", shared_years: 1, is_active: true },
  });

  React.useEffect(() => {
    if (open) form.reset({ department_id: departmentId, name: "", shared_years: 1, is_active: true });
  }, [open, departmentId, form]);

  const onSubmit = (data: AcademicPlanFormData) => {
    startTransition(async () => {
      const res = await createAcademicPlan(data);
      if (res.error) {
        toast({ title: "Failed to create plan", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Plan created", description: `${data.name} is ready.`, variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              Create Academic Plan
            </DialogTitle>
            <DialogDescription>
              Set the shared-trunk length. Specializations (if any) branch off after it.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            <PlanFormFields form={form} />
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
                "Create Plan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPlanModal({
  plan,
  open,
  setOpen,
  onSuccess,
}: {
  plan: AcademicPlan | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<AcademicPlanFormData>({
    resolver: zodResolver(academicPlanSchema),
    defaultValues: { department_id: "", name: "", shared_years: 1, is_active: true },
  });

  React.useEffect(() => {
    if (open && plan) {
      form.reset({
        department_id: plan.department_id,
        name: plan.name,
        shared_years: plan.shared_years,
        is_active: plan.is_active,
      });
    }
  }, [open, plan, form]);

  const onSubmit = (data: AcademicPlanFormData) => {
    if (!plan) return;
    startTransition(async () => {
      const res = await updateAcademicPlan(plan.id, data);
      if (res.error) {
        toast({ title: "Failed to update plan", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Plan updated", description: "Saved successfully.", variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg" hideClose={isPending}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl">Edit Academic Plan</DialogTitle>
            <DialogDescription>
              Changing shared_years does not retroactively fix existing courses or
              students — review them if you shrink it.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            <PlanFormFields form={form} />
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

function PlanFormFields({ form }: { form: ReturnType<typeof useForm<AcademicPlanFormData>> }) {
  const { register, control, watch, formState: { errors } } = form;
  const isActive = watch("is_active");

  return (
    <>
      <div className="space-y-1.5">
        <Label required>Plan Name</Label>
        <Input {...register("name")} placeholder="e.g. Computer Science" />
        {errors.name && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label required>Shared Trunk (years)</Label>
        <Input
          type="number"
          min={1}
          {...register("shared_years", { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">
          Years every student takes the same courses before any specialization.
          If this plan has no specializations, this is also the total programme
          length.
        </p>
        {errors.shared_years && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.shared_years.message}
          </p>
        )}
      </div>

      <Controller
        name="is_active"
        control={control}
        render={({ field }) => (
          <label className="flex items-center justify-between gap-4 cursor-pointer rounded-xl border border-border p-4">
            <div>
              <p className="font-semibold text-sm">{field.value ? "Plan is Active" : "Plan is Hidden"}</p>
              <p className="text-xs text-muted-foreground">
                Inactive plans are hidden from new-student registration.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={field.value ? "success" : "muted"}>{field.value ? "Active" : "Hidden"}</Badge>
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="w-5 h-5 accent-emerald-500"
              />
            </div>
          </label>
        )}
      />
    </>
  );
}