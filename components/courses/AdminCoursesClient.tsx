"use client";

import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  MoreHorizontal,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  AlertCircle,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { fetchAllAdminCourses } from "@/lib/courses/course-mutations";
import {
  getCourseDeliveryStatus,
  getDeliveryStatusLabel,
  getDeliveryStatusVariant,
  formatDateRange,
  sortCoursesForDisplay,
} from "@/lib/courses/course-utils";
import {
  AdminCourseModals,
} from "@/components/courses/AdminCourseModals";
import {
  AdminCourseActions,
  activateCourse,
  deactivateCourse,
} from "@/components/courses/AdminCourseActions";
import { CourseDetails } from "@/components/courses/CourseDetails";
import { toast } from "@/hooks/use-toast";
import type { Course } from "@/types";
import { cn, formatDate } from "@/lib/utils";

const PAGE_SIZE = 8;

interface Filters {
  department: string;
  program: string;
  year: string;
  academicYear: string;
  status: string;
}

const DEFAULT_FILTERS: Filters = {
  department: "",
  program: "",
  year: "",
  academicYear: "",
  status: "",
};

export function AdminCoursesClient() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [detailsCourse, setDetailsCourse] = useState<Course | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await fetchAllAdminCourses();
      if (error) throw error;
      setCourses(data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Failed to load courses");
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [reloadKey]);

  const filterOptions = useMemo(() => {
    const departments = new Set<string>();
    const programs = new Set<string>();
    const years = new Set<number>();
    const academicYears = new Set<string>();
    for (const c of courses) {
      if (c.department) departments.add(c.department);
      if (c.program) programs.add(c.program);
      if (c.year_of_study) years.add(c.year_of_study);
      if (c.academic_year) academicYears.add(c.academic_year);
    }
    return {
      departments: Array.from(departments).sort(),
      programs: Array.from(programs).sort(),
      years: Array.from(years).sort((a, b) => a - b),
      academicYears: Array.from(academicYears).sort().reverse(),
    };
  }, [courses]);

  const filtered = useMemo(() => {
    let result = sortCoursesForDisplay(courses, { direction: "asc" });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.description?.toLowerCase() ?? "").includes(q) ||
          (c.instructor?.toLowerCase() ?? "").includes(q)
      );
    }

    if (filters.department)
      result = result.filter((c) => c.department === filters.department);
    if (filters.program)
      result = result.filter((c) => c.program === filters.program);
    if (filters.year)
      result = result.filter(
        (c) => c.year_of_study === parseInt(filters.year)
      );
    if (filters.academicYear)
      result = result.filter((c) => c.academic_year === filters.academicYear);
    if (filters.status === "active")
      result = result.filter((c) => c.is_active);
    if (filters.status === "inactive")
      result = result.filter((c) => !c.is_active);

    return result;
  }, [courses, search, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const counts = useMemo(() => {
    const total = courses.length;
    const active = courses.filter((c) => c.is_active).length;
    return { total, active, inactive: total - active };
  }, [courses]);

  const activeFilters = Object.entries(filters).filter(
    ([, v]) => v !== ""
  ).length;

  function onRefresh() {
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Courses
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage academic courses and their availability for students.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="sm:self-start"
        >
          <Plus className="w-4 h-4" />
          Add Course
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Courses"
          value={counts.total}
          tone="primary"
        />
        <StatCard
          label="Active"
          value={counts.active}
          tone="success"
        />
        <StatCard
          label="Draft / Inactive"
          value={counts.inactive}
          tone="warning"
        />
        <StatCard
          label="Showing"
          value={filtered.length}
          tone="info"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4 gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search courses (code, title, instructor…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilters > 0 && (
                  <Badge variant="default" className="ml-1 px-1.5 h-5 min-w-[1.25rem]">
                    {activeFilters}
                  </Badge>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onRefresh();
                  toast({
                    title: "Refreshing",
                    description: "Checking for updates…",
                    variant: "default",
                  });
                }}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-border",
              filtersOpen
                ? "block"
                : "hidden lg:grid"
            )}
          >
            <FilterSelect
              label="Department"
              value={filters.department}
              onChange={(v) =>
                setFilters({ ...filters, department: v, program: "" })
              }
              options={filterOptions.departments}
              placeholder="All departments"
            />
            <FilterSelect
              label="Program"
              value={filters.program}
              onChange={(v) => setFilters({ ...filters, program: v })}
              options={filterOptions.programs}
              placeholder="All programs"
              disabled={!!filters.department && filterOptions.programs.length === 0}
            />
            <FilterSelect
              label="Year"
              value={filters.year}
              onChange={(v) => setFilters({ ...filters, year: v })}
              options={filterOptions.years.map((y) => `Year ${y}`)}
              rawValues={filterOptions.years.map((y) => y.toString())}
              placeholder="All years"
            />
            <FilterSelect
              label="Academic Year"
              value={filters.academicYear}
              onChange={(v) => setFilters({ ...filters, academicYear: v })}
              options={filterOptions.academicYears}
              placeholder="All years"
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground uppercase tracking-wider">
                Status
              </label>
              <div className="flex">
                <Select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="rounded-r-none"
                >
                  <option value="">Any status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Draft / Inactive</option>
                </Select>
                {(activeFilters > 0 || search) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="rounded-l-none border-l-0 shrink-0"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSearch("");
                    }}
                    title="Clear all filters"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-destructive">
                  Couldn&apos;t load courses
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {error.message ||
                    "Please check your connection and try again."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <LoadingSpinner size="lg" label="Loading courses…" />
          ) : courses.length === 0 && !error ? (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Get started by adding your first course. Students will see it once activated."
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Add your first course
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No courses match your filters"
              description="Try adjusting the search or removing some filters to see more courses."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setSearch("");
                  }}
                >
                  <X className="w-4 h-4" />
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <div className="hidden md:block overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left font-semibold px-4 py-3 w-[110px]">
                        Code
                      </th>
                      <th className="text-left font-semibold px-4 py-3 min-w-[220px]">
                        Course
                      </th>
                      <th className="text-left font-semibold px-4 py-3 w-[130px]">
                        Program · Year
                      </th>
                      <th className="text-left font-semibold px-4 py-3 w-[110px]">
                        Academic Yr
                      </th>
                      <th className="text-left font-semibold px-4 py-3 w-[110px]">
                        Schedule
                      </th>
                      <th className="text-left font-semibold px-4 py-3 w-[110px]">
                        Status
                      </th>
                      <th className="px-4 py-3 w-[60px] text-right" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paged.map((course) => (
                      <AdminCourseRow
                        key={course.id}
                        course={course}
                        onView={() => {
                          setDetailsCourse(course);
                          setDetailsOpen(true);
                        }}
                        onEdit={() => setEditing(course)}
                        onActivate={() =>
                          activateCourse(course, { onSuccess: onRefresh })
                        }
                        onDeactivate={() =>
                          deactivateCourse(course, { onSuccess: onRefresh })
                        }
                        onDelete={() => setDeleting(course)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {paged.map((course) => (
                  <MobileCourseCard
                    key={course.id}
                    course={course}
                    onView={() => {
                      setDetailsCourse(course);
                      setDetailsOpen(true);
                    }}
                    onEdit={() => setEditing(course)}
                    onActivate={() =>
                      activateCourse(course, { onSuccess: onRefresh })
                    }
                    onDeactivate={() =>
                      deactivateCourse(course, { onSuccess: onRefresh })
                    }
                    onDelete={() => setDeleting(course)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-5 mt-5 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center sm:text-left">
                    Showing <strong className="text-foreground">{(page - 1) * PAGE_SIZE + 1}</strong>–
                    <strong className="text-foreground">{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of{" "}
                    <strong className="text-foreground">{filtered.length}</strong>{" "}
                    results
                  </p>
                  <div className="flex items-center justify-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const n = i + 1;
                      const isCurrent = n === page;
                      const isNear =
                        Math.abs(n - page) <= 1 || n === 1 || n === totalPages;
                      const isGap =
                        !isNear && Math.abs(n - page) === 2;
                      if (!isNear && !isGap) return null;
                      return isGap ? (
                        <span
                          key={`gap-${n}`}
                          className="w-9 flex items-center justify-center text-muted-foreground text-sm"
                        >
                          …
                        </span>
                      ) : (
                        <Button
                          key={n}
                          variant={isCurrent ? "default" : "outline"}
                          size="icon"
                          className="w-9 h-9 text-xs font-semibold"
                          onClick={() => setPage(n)}
                          aria-label={`Go to page ${n}`}
                          aria-current={isCurrent ? "page" : undefined}
                        >
                          {n}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AdminCourseModals
        addOpen={addOpen}
        setAddOpen={setAddOpen}
        editing={editing}
        setEditing={setEditing}
        onRefresh={onRefresh}
      />

      <AdminCourseActions
        deleting={deleting}
        setDeleting={setDeleting}
        onRefresh={onRefresh}
      />

      <CourseDetails
        course={detailsCourse}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        variant="admin"
        actions={
          detailsCourse && (
            <>
              <Button
                variant={detailsCourse.is_active ? "secondary" : "success"}
                size="sm"
                onClick={() => {
                  setDetailsOpen(false);
                  if (detailsCourse.is_active) {
                    deactivateCourse(detailsCourse, { onSuccess: onRefresh });
                  } else {
                    activateCourse(detailsCourse, { onSuccess: onRefresh });
                  }
                }}
              >
                {detailsCourse.is_active ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Activate
                  </>
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setDetailsOpen(false);
                  setEditing(detailsCourse);
                }}
              >
                Edit Course
              </Button>
            </>
          )
        }
      />
    </div>
  );
}

function AdminCourseRow({
  course,
  onView,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  course: Course;
  onView: () => void;
  onEdit: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const delivery = getCourseDeliveryStatus(course);
  const deliveryLabel = getDeliveryStatusLabel(delivery);
  const deliveryVariant = getDeliveryStatusVariant(delivery);

  return (
    <tr className="group hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3.5">
        <Badge variant="info" className="font-mono text-[11px]">
          {course.code}
        </Badge>
      </td>
      <td className="px-4 py-3.5 min-w-[220px]">
        <button
          onClick={onView}
          className="text-left block w-full -mx-1 -my-1 px-1 py-1 rounded-lg hover:bg-background/60 transition-colors"
        >
          <p className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
            {course.title}
          </p>
          {course.instructor && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {course.instructor} · {course.credits} credit
              {course.credits === 1 ? "" : "s"}
            </p>
          )}
          {!course.instructor && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {course.credits} credit{course.credits === 1 ? "" : "s"}
            </p>
          )}
        </button>
      </td>
      <td className="px-4 py-3.5">
        <p className="text-foreground font-medium text-sm leading-tight">
          {course.program}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Year {course.year_of_study}
        </p>
      </td>
      <td className="px-4 py-3.5">
        <Badge variant="secondary" className="text-[11px]">
          {course.academic_year}
        </Badge>
      </td>
      <td className="px-4 py-3.5">
        <Badge variant={deliveryVariant} className="text-[11px]">
          {deliveryLabel}
        </Badge>
        {course.start_date && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            {formatDate(course.start_date)}
          </p>
        )}
      </td>
      <td className="px-4 py-3.5">
        <Badge
          variant={course.is_active ? "success" : "warning"}
          className="text-[11px]"
        >
          {course.is_active ? "Active" : "Draft"}
        </Badge>
      </td>
      <td className="px-4 py-3.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-70 group-hover:opacity-100 transition-opacity"
              aria-label="Course actions"
            >
              <MoreHorizontal className="w-4.5 h-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[11.5rem]">
            <DropdownMenuItem onClick={onView}>
              <Eye className="w-4 h-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <RefreshCw className="w-4 h-4" />
              Edit Course
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {course.is_active ? (
              <DropdownMenuItem onClick={onDeactivate}>
                <EyeOff className="w-4 h-4" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onActivate}>
                <Eye className="w-4 h-4" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={onDelete}>
              <EyeOff className="w-4 h-4" />
              Delete Course
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function MobileCourseCard({
  course,
  onView,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  course: Course;
  onView: () => void;
  onEdit: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const delivery = getCourseDeliveryStatus(course);
  const deliveryLabel = getDeliveryStatusLabel(delivery);
  const deliveryVariant = getDeliveryStatusVariant(delivery);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="info" className="font-mono text-[10.5px]">
              {course.code}
            </Badge>
            <Badge
              variant={course.is_active ? "success" : "warning"}
              className="text-[10.5px]"
            >
              {course.is_active ? "Active" : "Draft"}
            </Badge>
            <Badge variant={deliveryVariant} className="text-[10.5px]">
              {deliveryLabel}
            </Badge>
          </div>
          <button
            onClick={onView}
            className="text-left font-semibold text-foreground leading-snug hover:text-primary transition-colors"
          >
            {course.title}
          </button>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {course.program} · Year {course.year_of_study} ·{" "}
            {course.academic_year}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Course actions">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[11.5rem]">
            <DropdownMenuItem onClick={onView}>
              <Eye className="w-4 h-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <RefreshCw className="w-4 h-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {course.is_active ? (
              <DropdownMenuItem onClick={onDeactivate}>
                <EyeOff className="w-4 h-4" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onActivate}>
                <Eye className="w-4 h-4" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={onDelete}>
              <EyeOff className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <MobileInfoRow label="Credits" value={`${course.credits}`} />
        <MobileInfoRow
          label="Instructor"
          value={course.instructor || "TBD"}
          muted={!course.instructor}
        />
        <MobileInfoRow
          label="Department"
          value={course.department}
          className="col-span-1 truncate"
        />
        <MobileInfoRow
          label="Schedule"
          value={
            course.start_date
              ? formatDate(course.start_date)
              : "Not set"
          }
          muted={!course.start_date}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onView}
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={onEdit}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Edit
        </Button>
      </div>
    </div>
  );
}

function MobileInfoRow({
  label,
  value,
  muted,
  className,
}: {
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-2.5", className)}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p
        className={cn(
          "text-xs font-medium leading-snug truncate",
          muted ? "text-muted-foreground italic" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  rawValues,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  rawValues?: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground uppercase tracking-wider">
        {label}
      </label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((opt, i) => (
          <option
            key={opt}
            value={rawValues ? rawValues[i] : opt}
          >
            {opt}
          </option>
        ))}
      </Select>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success" | "warning" | "info";
}) {
  const tones = {
    primary: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/40",
    success:
      "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40",
    warning:
      "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/40",
    info: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/40",
  } as const;

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
          {label}
        </p>
        <p
          className={`inline-flex items-baseline px-2.5 py-1 rounded-lg border text-2xl sm:text-3xl font-bold ${tones[tone]}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

// Silence unused import warnings from exports that might get tree-shaken away
void formatDateRange;
