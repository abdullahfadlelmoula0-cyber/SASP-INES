import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  // Suspense boundary kept for stability (previously needed for useSearchParams).
  return (
    <Suspense fallback={<LoginFormSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-64 bg-muted rounded" />
      </div>
      <div className="space-y-4">
        <div className="h-10 w-full bg-muted rounded-lg" />
        <div className="h-10 w-full bg-muted rounded-lg" />
        <div className="h-10 w-full bg-muted rounded-lg" />
      </div>
    </div>
  );
}
