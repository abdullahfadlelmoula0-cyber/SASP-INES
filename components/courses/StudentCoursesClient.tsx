"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, BookOpen, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CourseCard } from "@/components/courses/CourseCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { toast } from "@/hooks/use-toast";
import type { Course } from "@/types";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";

export function StudentCoursesClient() {
  const router = useRouter();
  const { profile, isLoading: profileLoading } = useUser();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Load courses — RLS handles all visibility filtering automatically.
  // No is_active filter needed: students see all courses whose department +
  // program + year_of_study match their profile (or academic_plan_id path).
  async function loadCourses() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data, error: supabaseError } = await supabase
        .from("courses")
        .select("*")
        .order("code", { ascending: true });

      if (supabaseError) throw supabaseError;
      setCourses((data as Course[]) ?? []);
    } catch (e) {
      const err = e instanceof Error ? e : new Error("Failed to load courses");
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profileLoading) {
      void loadCourses();
    }
  }, [reloadKey, profileLoading]);

  const filtered = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.trim().toLowerCase();
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.description?.toLowerCase() ?? "").includes(q) ||
        (c.instructor?.toLowerCase() ?? "").includes(q)
    );
  }, [courses, search]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Courses
        </h1>
        {profile && !profileLoading && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {profile.program || profile.department || "Student"}
            </span>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            <span>Year {profile.year_of_study || 1}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          label="Total Courses"
          value={courses.length.toString()}
          accent="primary"
        />
        <StatCard
          label="Showing"
          value={filtered.length.toString()}
          accent="info"
        />
      </div>

      <div className="flex items-center gap-3 flex-col sm:flex-row">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses by code, title, instructor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setReloadKey((k) => k + 1);
            toast({
              title: "Refreshing courses",
              description: "Checking for updates…",
            });
          }}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">
              Couldn&apos;t load your courses
            </p>
            <p className="text-muted-foreground mt-0.5">
              {error.message || "Please check your connection and try again."}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner size="lg" label="Loading your courses…" />
      ) : courses.length === 0 && !error ? (
        <EmptyState
          icon={BookOpen}
          title="No courses available yet"
          description="There are no courses assigned to your academic profile yet. Contact your administrator."
          action={
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          }
        />
      ) : filtered.length === 0 && courses.length > 0 ? (
        <EmptyState
          icon={Search}
          title="No courses match your search"
          description="Try adjusting your search terms or clearing the search field."
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch("")}>
              Clear search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onView={(c) => {
                router.push(`/courses/${c.id}`);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "info";
}) {
  const accents = {
    primary:
      "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900/40",
    info:
      "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900/40",
  } as const;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <Badge
        variant="muted"
        className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider"
      >
        {label}
      </Badge>
      <p
        className={`text-2xl sm:text-3xl font-bold inline-flex items-baseline gap-2 px-2 py-1 rounded-lg border ${accents[accent]}`}
      >
        {value}
      </p>
    </div>
  );
}