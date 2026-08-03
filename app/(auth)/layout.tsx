import type { Metadata } from "next";
import { BrandLogosRow } from "@/components/shared/BrandLogosRow";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your SASP-INES account.",
};

/**
 * Auth layout — centred, full-screen, branded background.
 * No sidebar or topbar here.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 sidebar-gradient text-sidebar-foreground">
        <div className="flex flex-col items-start">
          <BrandLogosRow priority />
        </div>

        <div>
          <blockquote className="space-y-2">
            <p className="text-xl font-medium text-white leading-relaxed">
              &ldquo;Education is the most powerful weapon which you can use to
              change the world.&rdquo;
            </p>
            <footer className="text-sidebar-foreground/60 text-sm">
              — Nelson Mandela
            </footer>
          </blockquote>
        </div>

        <div className="space-y-1">
          <p className="text-sidebar-foreground/80 text-sm font-medium">
            INES-Ruhengeri
          </p>
          <p className="text-sidebar-foreground/50 text-xs">
            Institut d&apos;Enseignement Supérieur de Ruhengeri, Rwanda
          </p>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-background">
        {children}
      </div>
    </div>
  );
}
