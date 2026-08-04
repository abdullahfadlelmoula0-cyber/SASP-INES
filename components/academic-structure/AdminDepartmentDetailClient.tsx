// Save as: components/academic-structure/AdminDepartmentDetailClient.tsx
"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  AlertCircle,
  Pencil,
  Trash2,
  MoreHorizontal,
  BookOpen,
  Layers,
  GraduationCap,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Course } from "@/types";
import type {
  AcademicPlanWithSpecializations,
  DepartmentDetail,
  Specialization,
} from "@/types/academic-structure";
import { fetchDepartmentDetail, fetchPlanYearCourses } from "@/lib/academic-structure/queries";
import { deleteAcademicPlan, deleteSpecialization, deletePlanCourse } from "@/lib/academic-structure/actions";
import { AddPlanModal, EditPlanModal } from "@/components/academic-structure/PlanModals";
import { AddSpecializationModal, EditSpecializationModal } from "@/components/academic-structure/SpecializationModals";
import { AddPlanCourseModal, EditPlanCourseModal } from "@/components/academic-structure/PlanCourseModals";
import { ConfirmDeleteDialog } from "@/components/academic-structure/ConfirmDeleteDialog";

export function AdminDepartmentDetailClient({ departmentId }: { departmentId: string }) {
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);

  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AcademicPlanWithSpecializations | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<AcademicPlanWithSpecializations | null>(null);

  const [addSpecOpen, setAddSpecOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Specialization | null>(null);
  const [deletingSpec, setDeletingSpec] = useState<Specialization | null>(null);

  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchDepartmentDetail(departmentId);
      if (error) throw error;
      setDetail(data);
      if (data && data.plans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(data.plans[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to load department"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, departmentId]);

  function onRefresh() {
    setReloadKey((k) => k + 1);
  }

  const plan = useMemo(
    () => detail?.plans.find((p) => p.id === selectedPlanId) ?? detail?.plans[0] ?? null,
    [detail, selectedPlanId]
  );

  const maxYear = useMemo(() => {
    if (!plan) return 1;
    const specMax = plan.specializations.reduce((m, s) => Math.max(m, s.total_duration_years), 0);
    return Math.max(plan.shared_years, specMax);
  }, [plan]);

  const isBranchingYear = plan ? selectedYear > plan.shared_years : false;
  const availableTracks = useMemo(() => {
    if (!plan || !isBranchingYear) return [];
    return plan.specializations.filter((s) => s.total_duration_years >= selectedYear);
  }, [plan, isBranchingYear, selectedYear]);

  // Keep the selected year within range whenever the plan changes.
  useEffect(() => {
    setSelectedYear(1);
    setSelectedSpecId(null);
  }, [plan?.id]);

  // Auto-pick the first available track when entering a branching year.
  useEffect(() => {
    if (isBranchingYear) {
      if (!selectedSpecId || !availableTracks.some((t) => t.id === selectedSpecId)) {
        setSelectedSpecId(availableTracks[0]?.id ?? null);
      }
    } else {
      setSelectedSpecId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, isBranchingYear, availableTracks.length]);

  async function loadCourses() {
    if (!plan) return;
    setCoursesLoading(true);
    try {
      const { data, error } = await fetchPlanYearCourses(plan.id, selectedYear, selectedSpecId);
      if (error) throw error;
      setCourses(data);
    } catch {
      toast({ title: "Failed to load courses", description: "Please try refreshing.", variant: "destructive" });
    } finally {
      setCoursesLoading(false);
    }
  }

  useEffect(() => {
    void loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, selectedYear, selectedSpecId, reloadKey]);

  if (loading) return <LoadingSpinner size="lg" label="Loading department…" />;

  if (error || !detail) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">Couldn&apos;t load this department</p>
          <p className="text-muted-foreground mt-0.5">{error?.message ?? "Unknown error"}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <Link
          href="/admin/academic-structure"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All departments
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{detail.department.name}</h1>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className={`w-4 h-4 ${coursesLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {detail.plans.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No academic plan yet"
          description="Create a plan to define the shared trunk length before adding specializations or courses."
          action={
            <Button size="sm" onClick={() => setAddPlanOpen(true)}>
              <Plus className="w-4 h-4" />
              Create the plan
            </Button>
          }
        />
      ) : (
        plan && (
          <>
            {/* ── Plan settings ─────────────────────────────────── */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-start justify-between gap-2 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4.5 h-4.5" />
                  </span>
                  <div>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {plan.shared_years} shared year{plan.shared_years > 1 ? "s" : ""} · {plan.specializations.length} track(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={plan.is_active ? "success" : "muted"}>{plan.is_active ? "Active" : "Hidden"}</Badge>
                  <Button variant="outline" size="sm" onClick={() => setEditingPlan(plan)}>
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Plan
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Specializations (Tracks)</p>
                  <Button variant="outline" size="sm" onClick={() => setAddSpecOpen(true)}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Track
                  </Button>
                </div>

                {plan.specializations.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No tracks — this plan is unbranched. Students graduate after year {plan.shared_years}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {plan.specializations.map((spec) => (
                      <div
                        key={spec.id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                      >
                        <span className="text-sm font-medium">{spec.name}</span>
                        <Badge variant="info">{spec.total_duration_years} yrs total</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Track actions">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingSpec(spec)}>
                              <Pencil className="w-4 h-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem destructive onClick={() => setDeletingSpec(spec)}>
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Year tabs ─────────────────────────────────────── */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {Array.from({ length: maxYear }, (_, i) => i + 1).map((y) => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-semibold border transition-colors",
                        selectedYear === y
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent/30"
                      )}
                    >
                      Year {y}
                      {y <= plan.shared_years && <span className="ml-1.5 opacity-70">· shared</span>}
                    </button>
                  ))}
                </div>

                {isBranchingYear && (
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border mt-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">
                      Track:
                    </span>
                    {availableTracks.length === 0 ? (
                      <span className="text-sm text-muted-foreground italic">
                        No tracks reach year {selectedYear}.
                      </span>
                    ) : (
                      availableTracks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedSpecId(t.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                            selectedSpecId === t.id
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "border-border text-muted-foreground hover:bg-accent/30"
                          )}
                        >
                          {t.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    Courses — Year {selectedYear}
                    {isBranchingYear && availableTracks.find((t) => t.id === selectedSpecId) && (
                      <span className="text-muted-foreground font-normal">
                        · {availableTracks.find((t) => t.id === selectedSpecId)?.name}
                      </span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setAddCourseOpen(true)}
                    disabled={isBranchingYear && !selectedSpecId}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Course
                  </Button>
                </div>

                {coursesLoading ? (
                  <LoadingSpinner size="md" label="Loading courses…" />
                ) : courses.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title={`No courses for Year ${selectedYear} yet`}
                    description={
                      isBranchingYear
                        ? "Add the first course for this track and year."
                        : "Add the first shared-trunk course for this year."
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="text-left font-semibold px-4 py-3 w-[110px]">Code</th>
                          <th className="text-left font-semibold px-4 py-3">Course</th>
                          <th className="text-left font-semibold px-4 py-3 w-[90px]">Credits</th>
                          <th className="text-left font-semibold px-4 py-3 w-[110px]">Status</th>
                          <th className="px-4 py-3 w-[60px] text-right" aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {courses.map((course) => (
                          <tr key={course.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs">{course.code}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{course.title}</p>
                              {course.instructor && (
                                <p className="text-xs text-muted-foreground">{course.instructor}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">{course.credits}</td>
                            <td className="px-4 py-3">
                              <Badge variant="info">
                                Year {course.year_number}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Course actions">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditingCourse(course)}>
                                    <Pencil className="w-4 h-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem destructive onClick={() => setDeletingCourse(course)}>
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}

      {/* ── Plan modals ──────────────────────────────────────────── */}
      <AddPlanModal departmentId={departmentId} open={addPlanOpen} setOpen={setAddPlanOpen} onSuccess={onRefresh} />
      <EditPlanModal plan={editingPlan} open={!!editingPlan} setOpen={(v) => !v && setEditingPlan(null)} onSuccess={onRefresh} />
      <ConfirmDeleteDialog
        open={!!deletingPlan}
        setOpen={(v) => !v && setDeletingPlan(null)}
        title="Delete this plan?"
        description={<>This removes <strong>{deletingPlan?.name}</strong> and requires its specializations/courses to be removed first.</>}
        onConfirm={() => deleteAcademicPlan(deletingPlan!.id, departmentId)}
        onSuccess={onRefresh}
      />

      {/* ── Specialization modals ────────────────────────────────── */}
      {plan && (
        <>
          <AddSpecializationModal
            plan={plan}
            departmentId={departmentId}
            open={addSpecOpen}
            setOpen={setAddSpecOpen}
            onSuccess={onRefresh}
          />
          <EditSpecializationModal
            specialization={editingSpec}
            plan={plan}
            departmentId={departmentId}
            open={!!editingSpec}
            setOpen={(v) => !v && setEditingSpec(null)}
            onSuccess={onRefresh}
          />
        </>
      )}
      <ConfirmDeleteDialog
        open={!!deletingSpec}
        setOpen={(v) => !v && setDeletingSpec(null)}
        title="Delete this track?"
        description={<>This removes <strong>{deletingSpec?.name}</strong>. Students or courses still referencing it will block the delete.</>}
        onConfirm={() => deleteSpecialization(deletingSpec!.id, departmentId)}
        onSuccess={onRefresh}
      />

      {/* ── Course modals ────────────────────────────────────────── */}
      {plan && (
        <AddPlanCourseModal
          context={{
            academicPlanId: plan.id,
            specializationId: selectedSpecId,
            yearNumber: selectedYear,
            departmentId,
          }}
          open={addCourseOpen}
          setOpen={setAddCourseOpen}
          onSuccess={onRefresh}
        />
      )}
      <EditPlanCourseModal
        course={editingCourse}
        departmentId={departmentId}
        open={!!editingCourse}
        setOpen={(v) => !v && setEditingCourse(null)}
        onSuccess={onRefresh}
      />
      <ConfirmDeleteDialog
        open={!!deletingCourse}
        setOpen={(v) => !v && setDeletingCourse(null)}
        title="Delete this course?"
        description={<>This removes <strong>{deletingCourse?.code}</strong> permanently.</>}
        onConfirm={() => deletePlanCourse(deletingCourse!.id, departmentId)}
        onSuccess={onRefresh}
      />
    </div>
  );
}
