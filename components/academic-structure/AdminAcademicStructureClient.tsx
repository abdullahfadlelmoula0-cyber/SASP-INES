// Save as: components/academic-structure/AdminAcademicStructureClient.tsx
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Plus, RefreshCw, AlertCircle, ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import { fetchDepartmentsWithPlans } from "@/lib/academic-structure/queries";
import { deleteDepartment } from "@/lib/academic-structure/actions";
import { AddDepartmentModal, EditDepartmentModal } from "@/components/academic-structure/DepartmentModals";
import { ConfirmDeleteDialog } from "@/components/academic-structure/ConfirmDeleteDialog";
import type { Department, DepartmentWithPlans } from "@/types/academic-structure";

export function AdminAcademicStructureClient() {
  const [departments, setDepartments] = useState<DepartmentWithPlans[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchDepartmentsWithPlans();
      if (error) throw error;
      setDepartments(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load departments"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [reloadKey]);

  function onRefresh() {
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Academic Structure</h1>
          <p className="text-sm text-muted-foreground">
            Manage departments, plans, specializations, and their courses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onRefresh();
              toast({ title: "Refreshing", description: "Checking for updates…" });
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            Add Department
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Couldn&apos;t load departments</p>
            <p className="text-muted-foreground mt-0.5">{error.message}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh}>Retry</Button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner size="lg" label="Loading departments…" />
      ) : departments.length === 0 && !error ? (
        <EmptyState
          icon={Building2}
          title="No departments yet"
          description="Add your first department to start building its academic plan."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" />
              Add your first department
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              onEdit={() => setEditing(dept)}
              onDelete={() => setDeleting(dept)}
            />
          ))}
        </div>
      )}

      <AddDepartmentModal open={addOpen} setOpen={setAddOpen} onSuccess={onRefresh} />
      <EditDepartmentModal
        department={editing}
        open={!!editing}
        setOpen={(v) => !v && setEditing(null)}
        onSuccess={onRefresh}
      />
      <ConfirmDeleteDialog
        open={!!deleting}
        setOpen={(v) => !v && setDeleting(null)}
        title="Delete this department?"
        description={
          <>
            This removes <strong>{deleting?.name}</strong> permanently. You must
            delete or reassign its academic plan(s) first — this action will be
            rejected otherwise.
          </>
        }
        onConfirm={() => deleteDepartment(deleting!.id)}
        onSuccess={onRefresh}
        successMessage={`${deleting?.name} has been removed.`}
      />
    </div>
  );
}

function DepartmentCard({
  department,
  onEdit,
  onDelete,
}: {
  department: DepartmentWithPlans;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const plans = department.academic_plans ?? [];
  const primaryPlan = plans[0];

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </span>
            <CardTitle className="text-base leading-tight">{department.name}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Department actions">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem destructive onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {plans.length === 0 ? (
          <Badge variant="warning">No plan yet</Badge>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={primaryPlan.is_active ? "success" : "muted"}>
                {primaryPlan.is_active ? "Active" : "Hidden"}
              </Badge>
              <Badge variant="info">{primaryPlan.shared_years} shared yr{primaryPlan.shared_years > 1 ? "s" : ""}</Badge>
              {plans.length > 1 && <Badge variant="outline">+{plans.length - 1} more plan(s)</Badge>}
            </div>
            <p className="text-sm text-muted-foreground truncate">{primaryPlan.name}</p>
          </div>
        )}
        <Link
          href={`/admin/academic-structure/${department.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Manage structure
          <ChevronRight className="w-4 h-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
