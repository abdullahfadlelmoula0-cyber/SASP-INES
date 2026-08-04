import { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Create Account | SASP-INES",
  description:
    "Register your student account to access the SASP-INES academic portal.",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
