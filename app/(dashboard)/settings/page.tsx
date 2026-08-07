// Save as: app/(dashboard)/settings/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { User, Palette, HelpCircle, ChevronRight, Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { FAQAccordion } from "@/components/settings/FAQAccordion";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, appearance, and support preferences.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <PageHeader title="Settings" description="Manage your account, appearance, and support preferences." />

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Account
          </CardTitle>
          <CardDescription>Your profile and academic information.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/profile"
            className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium">View Profile</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>Choose how SASP-INES looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Help & Support
          </CardTitle>
          <CardDescription>Frequently asked questions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FAQAccordion />
          <a
            href="mailto:admin@ines.ac.rw"
            className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Contact Administrator
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
