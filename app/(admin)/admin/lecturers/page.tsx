"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  GraduationCap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils";

import {
  getAllLecturers,
  createLecturer,
  updateLecturer,
  deleteLecturer,
  getDepartmentsForLecturerForm,
  getLecturerDetail,
  deleteLecturerReview,
  type LecturerFormData,
} from "@/lib/lecturers/actions";

// ── Local types ───────────────────────────────────────────────────

interface LecturerRow {
  id: string;
  full_name: string;
  university_email: string | null;
  lecturer_department_id: string | null;
  department_name: string | null;
  expertise_areas: string[] | null;
}

interface Department {
  id: string;
  name: string;
}

interface LecturerDetail {
  id: string;
  full_name: string;
  university_email: string | null;
  lecturer_department_id: string | null;
  department_name: string | null;
  expertise_areas: string[] | null;
  updated_at: string | null;
  supervised_projects: Array<{
    id: string;
    topic_title: string | null;
    status: string;
    student_name: string | null;
    created_at: string;
  }>;
  reviews: Array<{
    id: string;
    decision: string;
    comments: string | null;
    topic_title_snapshot: string | null;
    created_at: string;
  }>;
}

// ── Form component (shared by Add + Edit) ──────────────────────────
// IMPORTANT: This must be defined OUTSIDE the page component. If it were
// declared inside AdminLecturersPage, a brand-new function (and therefore
// a brand-new component type) would be created on every render, causing
// React to unmount/remount the <Input> elements on every keystroke and
// lose focus after each character typed.

function LecturerForm({
  formData,
  setFormData,
  formError,
  departments,
  editingLecturer,
}: {
  formData: LecturerFormData;
  setFormData: React.Dispatch<React.SetStateAction<LecturerFormData>>;
  formError: string | null;
  departments: Department[];
  editingLecturer: LecturerRow | null;
}) {
  return (
    <div className="space-y-4 py-2">
      {formError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lec-name">Full Name *</Label>
          <Input
            id="lec-name"
            placeholder="Dr. Jane Smith"
            value={formData.full_name}
            onChange={(e) => setFormData((p) => ({ ...p, full_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lec-email">Email *</Label>
          <Input
            id="lec-email"
            type="email"
            placeholder="j.smith@ines.ac.rw"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            disabled={!!editingLecturer}
          />
        </div>
      </div>

      {!editingLecturer && (
        <div className="space-y-1.5">
          <Label htmlFor="lec-password">Password (leave blank for default: 12345678)</Label>
          <Input
            id="lec-password"
            type="password"
            placeholder="Min. 6 characters"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="lec-dept">Department *</Label>
        <select
          id="lec-dept"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          value={formData.lecturer_department_id}
          onChange={(e) =>
            setFormData((p) => ({ ...p, lecturer_department_id: e.target.value }))
          }
        >
          <option value="">Select a department…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lec-expertise">Expertise Areas</Label>
        <Input
          id="lec-expertise"
          placeholder="e.g. Machine Learning, Web Development, Algorithms"
          value={formData.expertise_areas_raw}
          onChange={(e) =>
            setFormData((p) => ({ ...p, expertise_areas_raw: e.target.value }))
          }
        />
        <p className="text-xs text-muted-foreground">
          Separate multiple areas with commas.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function AdminLecturersPage() {
  const [lecturers, setLecturers] = useState<LecturerRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState<LecturerRow | null>(null);
  const [deletingLecturer, setDeletingLecturer] = useState<LecturerRow | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Detail view state ────────────────────────────────────────
  const [viewingLecturer, setViewingLecturer] = useState<LecturerRow | null>(null);
  const [lecturerDetail, setLecturerDetail] = useState<LecturerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Review pending removal from the detail view (confirmation prompt).
  const [deletingReview, setDeletingReview] = useState<{ id: string; topic_title_snapshot: string | null } | null>(null);
  const [isReviewPending, startReviewTransition] = useTransition();

  // ── Form state ────────────────────────────────────────────────
  const [formData, setFormData] = useState<LecturerFormData>({
    full_name: "",
    email: "",
    password: "",
    lecturer_department_id: "",
    expertise_areas_raw: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ── Data loading ──────────────────────────────────────────────

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    const [lecRes, deptRes] = await Promise.all([
      getAllLecturers(),
      getDepartmentsForLecturerForm(),
    ]);
    if (lecRes.error) {
      setLoadError(lecRes.error);
    } else {
      setLecturers(lecRes.data);
    }
    if (!deptRes.error) {
      setDepartments(deptRes.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // ── Filtered lecturers ────────────────────────────────────────

  const filtered = lecturers.filter((l) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      l.full_name.toLowerCase().includes(q) ||
      (l.university_email ?? "").toLowerCase().includes(q) ||
      (l.department_name ?? "").toLowerCase().includes(q);
    const matchesDept =
      selectedDept === "ALL" || l.lecturer_department_id === selectedDept;
    return matchesSearch && matchesDept;
  });

  // ── Form helpers ──────────────────────────────────────────────

  function resetForm() {
    setFormData({
      full_name: "",
      email: "",
      password: "",
      lecturer_department_id: "",
      expertise_areas_raw: "",
    });
    setFormError(null);
  }

  function openAdd() {
    resetForm();
    setIsAddOpen(true);
  }

  function openEdit(l: LecturerRow) {
    setFormData({
      full_name: l.full_name,
      email: l.university_email ?? "",
      password: "",
      lecturer_department_id: l.lecturer_department_id ?? "",
      expertise_areas_raw: (l.expertise_areas ?? []).join(", "),
    });
    setFormError(null);
    setEditingLecturer(l);
  }

  async function openView(l: LecturerRow) {
    setViewingLecturer(l);
    setLecturerDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    const result = await getLecturerDetail(l.id);
    if (result.error) {
      setDetailError(result.error);
    } else {
      setLecturerDetail(result.data);
    }
    setDetailLoading(false);
  }

  async function refreshDetail() {
    if (!viewingLecturer) return;
    const result = await getLecturerDetail(viewingLecturer.id);
    if (result.error) {
      setDetailError(result.error);
    } else {
      setLecturerDetail(result.data);
    }
  }

  function handleDeleteReview() {
    if (!deletingReview) return;
    startReviewTransition(async () => {
      const result = await deleteLecturerReview(deletingReview.id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Review removed", description: "The review has been deleted." });
      setDeletingReview(null);
      await refreshDetail();
      loadData();
    });
  }

  // ── Submit handlers ───────────────────────────────────────────

  function handleCreate() {
    setFormError(null);
    startTransition(async () => {
      const result = await createLecturer(formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast({ title: "Lecturer created", description: `${formData.full_name} has been added.` });
      setIsAddOpen(false);
      resetForm();
      loadData();
    });
  }

  function handleUpdate() {
    if (!editingLecturer) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateLecturer(editingLecturer.id, formData);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast({ title: "Lecturer updated", description: `${formData.full_name}'s profile has been saved.` });
      setEditingLecturer(null);
      resetForm();
      loadData();
    });
  }

  function handleDelete() {
    if (!deletingLecturer) return;
    startTransition(async () => {
      const result = await deleteLecturer(deletingLecturer.id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Lecturer removed", description: `${deletingLecturer.full_name} has been removed.` });
      setDeletingLecturer(null);
      loadData();
    });
  }

  // ── Render ────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lecturers"
        description="Manage lecturer accounts and their department assignments."
        action={
          <Button onClick={openAdd} size="sm" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Add Lecturer
          </Button>
        }
      />

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search lecturers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option value="ALL">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No lecturers found"
          description={
            searchQuery || selectedDept !== "ALL"
              ? "Try adjusting your filters."
              : "Add your first lecturer using the button above."
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Expertise</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openView(l)}
                        className="flex items-center gap-3 text-left group"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">
                            {l.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground group-hover:underline group-hover:text-primary transition-colors">{l.full_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">
                            {l.university_email}
                          </p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {l.university_email ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {l.department_name ? (
                        <Badge variant="secondary" className="font-normal">
                          {l.department_name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(l.expertise_areas ?? []).length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          (l.expertise_areas ?? []).slice(0, 3).map((area) => (
                            <Badge key={area} variant="outline" className="text-xs font-normal">
                              {area}
                            </Badge>
                          ))
                        )}
                        {(l.expertise_areas ?? []).length > 3 && (
                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                            +{(l.expertise_areas ?? []).length - 3} more
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(l)}
                          aria-label={`Edit ${l.full_name}`}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingLecturer(l)}
                          aria-label={`Delete ${l.full_name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {filtered.length} of {lecturers.length} lecturer{lecturers.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* ── Add Modal ──────────────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lecturer</DialogTitle>
            <DialogDescription>
              Create a new lecturer account. They will receive an email to confirm their address.
            </DialogDescription>
          </DialogHeader>
          <LecturerForm
            formData={formData}
            setFormData={setFormData}
            formError={formError}
            departments={departments}
            editingLecturer={editingLecturer}
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Lecturer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ─────────────────────────────────────────── */}
      <Dialog
        open={!!editingLecturer}
        onOpenChange={(o) => { if (!o) { setEditingLecturer(null); resetForm(); } }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lecturer</DialogTitle>
            <DialogDescription>
              Update {editingLecturer?.full_name}'s profile. Email cannot be changed here.
            </DialogDescription>
          </DialogHeader>
          <LecturerForm
            formData={formData}
            setFormData={setFormData}
            formError={formError}
            departments={departments}
            editingLecturer={editingLecturer}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setEditingLecturer(null); resetForm(); }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Lecturer Modal (admin-only detail + edit entry point) ── */}
      <Dialog
        open={!!viewingLecturer}
        onOpenChange={(o) => { if (!o) { setViewingLecturer(null); setLecturerDetail(null); setDetailError(null); } }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingLecturer?.full_name}</DialogTitle>
            <DialogDescription>
              Lecturer profile, supervised projects, and submitted reviews.
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {detailError && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {detailError}
            </div>
          )}

          {!detailLoading && !detailError && lecturerDetail && (
            <div className="space-y-6 py-2">
              {/* Profile summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                  <p className="text-foreground">{lecturerDetail.university_email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Department</p>
                  <p className="text-foreground">{lecturerDetail.department_name ?? "—"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Expertise Areas</p>
                  {(lecturerDetail.expertise_areas ?? []).length === 0 ? (
                    <p className="text-muted-foreground">—</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(lecturerDetail.expertise_areas ?? []).map((area) => (
                        <Badge key={area} variant="outline" className="text-xs font-normal">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Supervised projects */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  Supervised Projects ({lecturerDetail.supervised_projects.length})
                </p>
                {lecturerDetail.supervised_projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supervised projects.</p>
                ) : (
                  <div className="space-y-2">
                    {lecturerDetail.supervised_projects.map((p) => (
                      <div key={p.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">{p.topic_title ?? "Untitled topic"}</p>
                          <Badge variant="secondary" className="text-xs font-normal shrink-0">{p.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Student: {p.student_name ?? "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviews */}
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  Submitted Reviews ({lecturerDetail.reviews.length})
                </p>
                {lecturerDetail.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews submitted.</p>
                ) : (
                  <div className="space-y-2">
                    {lecturerDetail.reviews.map((r) => (
                      <div key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-foreground">
                            {r.topic_title_snapshot ?? "Untitled topic"}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="secondary" className="text-xs font-normal">{r.decision}</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeletingReview({ id: r.id, topic_title_snapshot: r.topic_title_snapshot })}
                              aria-label="Delete review"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        {r.comments && (
                          <p className="text-xs text-muted-foreground mt-1">{r.comments}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {lecturerDetail.reviews.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Removing all reviews above will allow this lecturer to be deleted.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setViewingLecturer(null); setLecturerDetail(null); setDetailError(null); }}>
              Close
            </Button>
            {viewingLecturer && (
              <Button
                onClick={() => {
                  const l = viewingLecturer;
                  setViewingLecturer(null);
                  setLecturerDetail(null);
                  setDetailError(null);
                  openEdit(l);
                }}
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Review Confirmation Modal (تنبيه / warning) ────────────── */}
      <Dialog
        open={!!deletingReview}
        onOpenChange={(o) => { if (!o) setDeletingReview(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>⚠️ Remove Review — Warning</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete the review for{" "}
              <span className="font-semibold">
                {deletingReview?.topic_title_snapshot ?? "this project"}
              </span>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingReview(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteReview}
              disabled={isReviewPending}
              className="gap-2"
            >
              {isReviewPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ──────────────────────────── */}
      <Dialog
        open={!!deletingLecturer}
        onOpenChange={(o) => { if (!o) setDeletingLecturer(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Lecturer</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{deletingLecturer?.full_name}</span>? This will
              delete their profile. The action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingLecturer(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
