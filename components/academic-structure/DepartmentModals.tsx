// Save as: components/academic-structure/DepartmentModals.tsx
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
import type { Department } from "@/types/academic-structure";

// ✅ 1. استيراد الـ Schema والـ Type من ملف schemas الجديد
import {
  departmentSchema,
  type DepartmentFormData,
} from "@/lib/academic-structure/schemas";

// ✅ 2. استيراد الـ Actions فقط من ملف actions
import {
  createDepartment,
  updateDepartment,
} from "@/lib/academic-structure/actions";

export function AddDepartmentModal({
  open,
  setOpen,
  onSuccess,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  const onSubmit = (data: DepartmentFormData) => {
    startTransition(async () => {
      const res = await createDepartment(data);
      if (res.error) {
        toast({ title: "Failed to create department", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Department created", description: `${data.name} has been added.`, variant: "success" });
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
              Add Department
            </DialogTitle>
            <DialogDescription>
              You'll define its academic plan and specializations next.
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-1.5">
            <Label required>Department Name</Label>
            <Input {...form.register("name")} placeholder="e.g. Computer Science" autoFocus />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {form.formState.errors.name.message}
              </p>
            )}
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
                "Create Department"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditDepartmentModal({
  department,
  open,
  setOpen,
  onSuccess,
}: {
  department: Department | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (open && department) form.reset({ name: department.name });
  }, [open, department, form]);

  const onSubmit = (data: DepartmentFormData) => {
    if (!department) return;
    startTransition(async () => {
      const res = await updateDepartment(department.id, data);
      if (res.error) {
        toast({ title: "Failed to update department", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Department updated", description: "Saved successfully.", variant: "success" });
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
            <DialogTitle className="text-xl">Edit Department</DialogTitle>
            <DialogDescription>Rename this department.</DialogDescription>
          </DialogHeader>

          <div className="px-5 sm:px-6 py-5 sm:py-6 space-y-1.5">
            <Label required>Department Name</Label>
            <Input {...form.register("name")} autoFocus />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {form.formState.errors.name.message}
              </p>
            )}
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