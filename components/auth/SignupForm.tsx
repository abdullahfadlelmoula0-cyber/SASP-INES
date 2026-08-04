"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SaspInesLogo } from "@/components/shared/SaspInesLogo";
import {
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// ── Academic structure types (mirrors lib/students/actions.ts) ────
interface Specialization {
  id: string;
  name: string;
  total_duration_years: number;
}
interface Plan {
  id: string;
  name: string;
  shared_years: number;
  specializations: Specialization[];
}
interface Department {
  id: string;
  name: string;
  academic_plans: Plan[];
}

export function SignupForm() {
  const router = useRouter();

  // ── Academic structure ────────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([]);
  const [structureLoading, setStructureLoading] = useState(true);
  const [structureError, setStructureError] = useState<string | null>(null);

  // ── Form state ────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [academicPlanId, setAcademicPlanId] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState(1);
  const [specializationId, setSpecializationId] = useState<string>("");
  const [academicYear, setAcademicYear] = useState("2025-2026");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Load academic structure from DB (same tables admin manages) ─
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("departments")
      .select(
        "id, name, academic_plans(id, name, shared_years, specializations(id, name, total_duration_years))"
      )
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setStructureError(error.message);
        } else {
          setDepartments((data as any) ?? []);
        }
        setStructureLoading(false);
      });
  }, []);

  // ── Derived selections ────────────────────────────────────────
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

  // Specialization is required once year_of_study > shared_years
  // AND the plan actually has specializations — same rule as the DB trigger.
  const specializationRequired =
    !!selectedPlan &&
    specializations.length > 0 &&
    yearOfStudy > selectedPlan.shared_years;

  const availableSpecializations = specializations.filter(
    (s) => s.total_duration_years >= yearOfStudy
  );

  // Max year derivation (mirrors StudentFormModal)
  const maxYear = selectedPlan
    ? Math.max(
        selectedPlan.shared_years,
        ...specializations.map((s) => s.total_duration_years),
        selectedPlan.shared_years
      )
    : 6;

  // Reset downstream on upstream change
  useEffect(() => {
    setAcademicPlanId("");
    setSpecializationId("");
  }, [departmentId]);

  useEffect(() => {
    setSpecializationId("");
  }, [academicPlanId, yearOfStudy]);

  // ── Submit ────────────────────────────────────────────────────
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!academicPlanId) {
      setError("Please select an academic plan.");
      return;
    }
    if (specializationRequired && !specializationId) {
      setError("Please select a specialization for your year of study.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      // 1. إنشاء حساب المصادقة فقط - الـ Trigger في الخلفية سيقوم بالباقي تلقائياً
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });

      if (authError || !authData.user) {
        setError(authError?.message ?? "Failed to create account. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    });
  }

  if (success) {
    return (
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Account created!</h2>
          <p className="text-sm text-muted-foreground">
            Redirecting you to your dashboard…
          </p>
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex justify-center mb-6 md:hidden">
          <SaspInesLogo className="w-56 h-auto drop-shadow-xl" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign up to access your SASP-INES student portal.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Full name */}
        <Field label="Full Name" htmlFor="fullName">
          <input
            id="fullName"
            type="text"
            required
            autoComplete="name"
            placeholder="e.g. Abdullah Fadlel Moula"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Email */}
        <Field label="University Email" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ug0000000@ines.ac.rw"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Password */}
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </Field>

        {/* Confirm Password */}
        <Field label="Confirm Password" htmlFor="confirmPassword">
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* ── Academic Structure ──────────────────────────────────── */}
        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Academic Profile
          </p>

          {structureError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Could not load academic structure. Please refresh the page.
            </div>
          )}

          {/* Department */}
          <Field label="Department" htmlFor="department">
            <select
              id="department"
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={structureLoading || departments.length === 0}
              className={selectCls}
            >
              <option value="">
                {structureLoading ? "Loading…" : "Select Department"}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {!structureLoading && departments.length === 0 && !structureError && (
              <p className="text-xs text-muted-foreground mt-1">
                No departments configured yet. Contact your administrator.
              </p>
            )}
          </Field>

          {/* Academic Plan — filtered to chosen department */}
          <Field label="Academic Plan" htmlFor="plan">
            <select
              id="plan"
              required
              value={academicPlanId}
              onChange={(e) => setAcademicPlanId(e.target.value)}
              disabled={!departmentId || plans.length === 0}
              className={selectCls}
            >
              <option value="">
                {!departmentId
                  ? "Select a department first"
                  : plans.length === 0
                  ? "No plans available"
                  : "Select Academic Plan"}
              </option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {departmentId && plans.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                This department has no academic plan yet.
              </p>
            )}
          </Field>

          {/* Year of Study + Academic Year */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year of Study" htmlFor="year">
              <input
                id="year"
                type="number"
                required
                min={1}
                max={maxYear}
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(Number(e.target.value))}
                className={inputCls}
              />
              {selectedPlan && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Shared trunk: {selectedPlan.shared_years} yr
                  {selectedPlan.shared_years > 1 ? "s" : ""}
                </p>
              )}
            </Field>

            <Field label="Academic Year" htmlFor="academicYear">
              <input
                id="academicYear"
                type="text"
                required
                placeholder="2025-2026"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Specialization — only shown when the plan branches at this year */}
          {selectedPlan && specializations.length > 0 && (
            <Field
              label={
                specializationRequired
                  ? "Specialization (required)"
                  : "Specialization"
              }
              htmlFor="specialization"
            >
              <select
                id="specialization"
                required={specializationRequired}
                value={specializationId}
                onChange={(e) => setSpecializationId(e.target.value)}
                disabled={!specializationRequired}
                className={selectCls}
              >
                <option value="">
                  {yearOfStudy <= selectedPlan.shared_years
                    ? "Not needed yet (shared trunk)"
                    : availableSpecializations.length === 0
                    ? "No specializations available for this year"
                    : "Select Specialization"}
                </option>
                {availableSpecializations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.total_duration_years} yrs total)
                  </option>
                ))}
              </select>
              {specializationRequired && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Required — your year of study ({yearOfStudy}) exceeds the
                  shared trunk ({selectedPlan.shared_years} yr
                  {selectedPlan.shared_years > 1 ? "s" : ""}).
                </p>
              )}
            </Field>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          id="signup-submit-btn"
          type="submit"
          disabled={isPending || structureLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}


// ── Helpers ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-colors";

const selectCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}


