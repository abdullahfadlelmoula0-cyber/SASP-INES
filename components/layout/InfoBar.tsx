"use client";

import { useUser } from "@/hooks/useUser";
import { GraduationCap, Shield } from "lucide-react";

/**
 * InfoBar — displays contextual information below the topbar
 * - For students: Shows their academic term info (Year, Program, Academic Year)
 * - For admins: Shows admin status and role
 * - Always visible on mobile, optionally visible on desktop
 */
export function InfoBar() {
  const { profile, isAdmin, isLoading } = useUser();

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-10 px-4 border-b border-border bg-muted/30 md:hidden">
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between h-10 px-4 border-b border-border bg-muted/40 backdrop-blur-sm md:hidden">
      {isAdmin ? (
        // Admin info bar
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">
            Administrator Panel
          </span>
        </div>
      ) : (
        // Student info bar - shows their academic context
        <div className="flex items-center gap-2 overflow-hidden">
          <GraduationCap className="w-4 h-4 text-primary shrink-0" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden">
            <span className="font-medium text-foreground">
              Year {profile.year_of_study}
            </span>
            <span className="text-muted-foreground/60">•</span>
            <span className="truncate">{profile.program}</span>
            {profile.academic_year && (
              <>
                <span className="text-muted-foreground/60">•</span>
                <span className="shrink-0">{profile.academic_year}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Optional: Add quick action on the right */}
      <div className="flex items-center gap-1">
        {profile.department && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {profile.department}
          </span>
        )}
      </div>
    </div>
  );
}
