// Save as: components/academic-structure/ConfirmDeleteDialog.tsx
"use client";

import * as React from "react";
import { useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ConfirmDeleteDialogProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => Promise<{ error?: string; success?: boolean }>;
  onSuccess: () => void;
  successMessage?: string;
}

/**
 * Generic "are you sure?" dialog for destructive actions across the
 * academic-structure admin pages (departments, plans, specializations,
 * plan-scoped courses).
 */
export function ConfirmDeleteDialog({
  open,
  setOpen,
  title,
  description,
  onConfirm,
  onSuccess,
  successMessage = "Deleted successfully.",
}: ConfirmDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await onConfirm();
      if (res.error) {
        toast({ title: "Delete failed", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Deleted", description: successMessage, variant: "success" });
        onSuccess();
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" hideClose={isPending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
