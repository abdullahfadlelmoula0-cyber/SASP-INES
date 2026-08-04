"use client";

import * as React from "react";
import { useTransition, useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Users, UserPlus, Edit, Trash2, Loader2, AlertCircle, Search, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

import { studentSchema, type StudentFormData } from "@/lib/students/schemas";
import {
  createStudent,
  updateStudent,
  deleteStudent,
  getAllStudents,
  getAcademicStructureOptions,
  type AcademicStructureDepartment,
} from "@/lib/students/actions";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

export interface Student {
  id: string;
  full_name: string;
  email: string;
  department?: string;
  program?: string;
  year_of_study: number;
  academic_year?: string;
  role: "STUDENT" | "ADMIN";
  academic_plan_id?: string | null;
  specialization_id?: string | null;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isPending, startTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");

  async function loadStudents() {
    setLoading(true);
    setLoadError(null);
    const res = await getAllStudents();
    if (res.error) {
      setLoadError(res.error);
    } else {
      setStudents(
        res.data.map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          email: p.university_email,
          department: p.department || "",
          program: p.program || "",
          year_of_study: p.year_of_study,
          academic_year: p.academic_year,
          role: (p.role || "student").toUpperCase() as "STUDENT" | "ADMIN",
          academic_plan_id: p.academic_plan_id ?? null,
          specialization_id: p.specialization_id ?? null,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment =
        selectedDepartment === "ALL" || student.department === selectedDepartment;

      const matchesYear =
        selectedYear === "ALL" || student.year_of_study.toString() === selectedYear;

      return matchesSearch && matchesDepartment && matchesYear;
    });
  }, [students, searchQuery, selectedDepartment, selectedYear]);

  const availableDepartments = useMemo(() => {
    const deps = students.map((s) => s.department).filter(Boolean);
    return Array.from(new Set(deps));
  }, [students]);

  const handleDelete = () => {
    if (!deletingStudent) return;
    startTransition(async () => {
      const res = await deleteStudent(deletingStudent.id);
      if (res.error) {
        toast({ title: "Failed to delete student", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Student deleted successfully" });
        setStudents((prev) => prev.filter((s) => s.id !== deletingStudent.id));
        setDeletingStudent(null);
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Students Management"
        description="View, search, and manage all registered student profiles in SASP-INES."
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {students.length}
              </span>
              <span className="text-xs text-muted-foreground">Registered</span>
            </div>
            <Button onClick={() => setIsAddOpen(true)} className="gap-2">
              <UserPlus className="w-4 h-4" /> Add Student
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="h-9 px-3 py-1 border rounded-md text-xs bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ALL">All Departments</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-9 px-3 py-1 border rounded-md text-xs bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="ALL">All Years</option>
            <option value="1">Year 1</option>
            <option value="2">Year 2</option>
            <option value="3">Year 3</option>
            <option value="4">Year 4</option>
            <option value="5">Year 5</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-foreground">
              Students List
            </h2>
            <Badge variant="secondary" className="ml-1">
              {filteredStudents.length} of {students.length}
            </Badge>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner size="lg" label="Loading students…" />
        ) : loadError ? (
          <div role="alert" className="flex items-start gap-3 p-6 text-sm">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Couldn&apos;t load students</p>
              <p className="text-muted-foreground mt-0.5">{loadError}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void loadStudents()}>Retry</Button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description={
              students.length === 0
                ? "No students are registered in the database yet."
                : "No student records match your current search and filter criteria."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    University Email
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell">
                    Department
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell">
                    Program
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-center">
                    Year
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell">
                    Academic Year
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">
                            {student.full_name
                              ? student.full_name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)
                              : "?"}
                          </span>
                        </div>
                        <p className="font-medium text-foreground truncate">
                          {student.full_name || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {student.email || "—"}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {student.department || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {student.program || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-semibold text-foreground">
                        {student.year_of_study || 1}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      {student.academic_year ? (
                        <Badge variant="secondary" className="font-normal text-[10px]">
                          {student.academic_year}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Not set
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
                        {student.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingStudent(student)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeletingStudent(student)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentFormModal
        open={isAddOpen || !!editingStudent}
        onClose={() => {
          setIsAddOpen(false);
          setEditingStudent(null);
        }}
        student={editingStudent}
        onSuccess={() => {
          void loadStudents();
        }}
      />

      <Dialog open={!!deletingStudent} onOpenChange={(v) => !v && setDeletingStudent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Delete Student Profile
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingStudent?.full_name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setDeletingStudent(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentFormModal({
  open,
  onClose,
  student,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [departments, setDepartments] = useState<AcademicStructureDepartment[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      department_id: "",
      academic_plan_id: "",
      specialization_id: null,
      year_of_study: 1,
      academic_year: "2025-2026",
      role: "STUDENT",
    },
  });

  const departmentId = watch("department_id");
  const academicPlanId = watch("academic_plan_id");
  const yearOfStudy = watch("year_of_study");

  useEffect(() => {
    if (!open) return;
    setOptionsLoading(true);
    setOptionsError(null);
    getAcademicStructureOptions().then((res) => {
      if (res.error) setOptionsError(res.error);
      setDepartments(res.data);
      setOptionsLoading(false);
    });
  }, [open]);

  useEffect(() => {
    if (student) {
      reset({
        full_name: student.full_name,
        email: student.email,
        password: "",
        department_id: "", // resolved below once departments load, if editing
        academic_plan_id: student.academic_plan_id || "",
        specialization_id: student.specialization_id || null,
        year_of_study: student.year_of_study || 1,
        academic_year: student.academic_year || "2025-2026",
        role: student.role || "STUDENT",
      });
    } else {
      reset({
        full_name: "",
        email: "",
        password: "",
        department_id: "",
        academic_plan_id: "",
        specialization_id: null,
        year_of_study: 1,
        academic_year: "2025-2026",
        role: "STUDENT",
      });
    }
  }, [student, open, reset]);

  // Once departments finish loading, back-fill department_id for an
  // existing student from their already-known academic_plan_id.
  useEffect(() => {
    if (student?.academic_plan_id && departments.length > 0) {
      const owningDept = departments.find((d) =>
        d.academic_plans.some((p) => p.id === student.academic_plan_id)
      );
      if (owningDept) setValue("department_id", owningDept.id);
    }
  }, [departments, student, setValue]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === departmentId),
    [departments, departmentId]
  );
  const plans = selectedDepartment?.academic_plans ?? [];

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === academicPlanId),
    [plans, academicPlanId]
  );
  const specializations = selectedPlan?.specializations ?? [];

  // Specialization is required once the student's year goes past the
  // plan's shared trunk — same rule the 005 trigger enforces server-side.
  const specializationRequired =
    !!selectedPlan && specializations.length > 0 && yearOfStudy > selectedPlan.shared_years;
  const availableSpecializations = specializations.filter(
    (s) => s.total_duration_years >= yearOfStudy
  );

  // Reset downstream selections whenever an upstream one changes.
  useEffect(() => {
    setValue("academic_plan_id", "");
    setValue("specialization_id", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  useEffect(() => {
    setValue("specialization_id", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicPlanId, yearOfStudy]);

  const onSubmit = (data: StudentFormData) => {
    startTransition(async () => {
      const res = student
        ? await updateStudent(student.id, data)
        : await createStudent(data);

      if (res.error) {
        toast({ title: "Operation failed", description: res.error, variant: "destructive" });
      } else {
        toast({ title: student ? "Student updated successfully" : "Student created successfully" });
        onSuccess();
        onClose();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{student ? "Edit Student Profile" : "Add New Student"}</DialogTitle>
            <DialogDescription>
              {student
                ? "Update student academic and personal details."
                : "Register a new student profile in SASP-INES."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input {...register("full_name")} placeholder="e.g. Abdullah" />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>University Email</Label>
              <Input {...register("email")} placeholder="e.g. ug2528267@ines.ac.rw" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {!student && (
              <div className="space-y-1">
                <Label>Account Password</Label>
                <Input type="password" {...register("password")} placeholder="Minimum 6 characters" />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            )}

            {optionsError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {optionsError}
              </div>
            )}

            {/* Department — read live from the academic-structure tables */}
            <div className="space-y-1">
              <Label>Department</Label>
              <Controller
                name="department_id"
                control={control}
                render={({ field }) => (
                  <Select {...field} disabled={optionsLoading || departments.length === 0}>
                    <option value="">
                      {optionsLoading ? "Loading…" : "Select Department"}
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                )}
              />
              {!optionsLoading && departments.length === 0 && !optionsError && (
                <p className="text-xs text-muted-foreground">
                  No departments yet — add one in Academic Structure first.
                </p>
              )}
              {errors.department_id && <p className="text-xs text-destructive">{errors.department_id.message}</p>}
            </div>

            {/* Academic Plan — filtered to the selected department */}
            <div className="space-y-1">
              <Label>Academic Plan</Label>
              <Controller
                name="academic_plan_id"
                control={control}
                render={({ field }) => (
                  <Select {...field} disabled={!departmentId || plans.length === 0}>
                    <option value="">
                      {!departmentId ? "Select a department first" : "Select Plan"}
                    </option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              />
              {departmentId && plans.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  This department has no academic plan yet — add one in Academic Structure first.
                </p>
              )}
              {errors.academic_plan_id && <p className="text-xs text-destructive">{errors.academic_plan_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Year of Study</Label>
                <Input
                  type="number"
                  {...register("year_of_study", { valueAsNumber: true })}
                  min={1}
                  max={selectedPlan ? Math.max(selectedPlan.shared_years, ...specializations.map((s) => s.total_duration_years), selectedPlan.shared_years) : 6}
                />
                {selectedPlan && (
                  <p className="text-xs text-muted-foreground">
                    Shared trunk: {selectedPlan.shared_years} yr{selectedPlan.shared_years > 1 ? "s" : ""}
                  </p>
                )}
                {errors.year_of_study && <p className="text-xs text-destructive">{errors.year_of_study.message}</p>}
              </div>

              <div className="space-y-1">
                <Label>Academic Year</Label>
                <Input {...register("academic_year")} placeholder="e.g. 2025-2026" />
                {errors.academic_year && <p className="text-xs text-destructive">{errors.academic_year.message}</p>}
              </div>
            </div>

            {/* Specialization — only shown once the plan actually branches at this year */}
            {selectedPlan && specializations.length > 0 && (
              <div className="space-y-1">
                <Label required={specializationRequired}>Specialization</Label>
                <Controller
                  name="specialization_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      disabled={!specializationRequired && yearOfStudy <= selectedPlan.shared_years}
                    >
                      <option value="">
                        {yearOfStudy <= selectedPlan.shared_years
                          ? "Not needed yet (shared trunk)"
                          : "Select Specialization"}
                      </option>
                      {availableSpecializations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.total_duration_years} yrs total)
                        </option>
                      ))}
                    </Select>
                  )}
                />
                {errors.specialization_id && (
                  <p className="text-xs text-destructive">{errors.specialization_id.message}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || optionsLoading}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}