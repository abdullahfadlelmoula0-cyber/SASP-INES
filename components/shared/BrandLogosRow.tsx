"use client";

import Image from "next/image";
import { SaspInesLogo } from "@/components/shared/SaspInesLogo";

interface BrandLogosRowProps {
  className?: string;
  /** Show the SASP-INES logo with priority (use only once per page) */
  priority?: boolean;
}

/**
 * Renders the main SASP-INES logo centered, flanked by two smaller
 * partner/supporting-organization logos (left & right).
 *
 * Partner logo files expected at:
 *   public/partner-1.png  (SSAI)
 *   public/partner-2.png  (INES-Ruhengeri)
 *
 * Replace the src paths below if you name the files differently.
 */
export function BrandLogosRow({ className = "", priority = false }: BrandLogosRowProps) {
  return (
    <div className={`flex items-center gap-6 ${className}`}>
      {/* Partner logo — left */}
      <Image
        src="/logo2.png"
        alt="Partner logo"
        width={200}
        height={200}
        className="w-14 h-auto opacity-90"
      />

      {/* Main SASP-INES logo */}
      <SaspInesLogo className="w-64 h-auto drop-shadow-2xl" priority={priority} />

      {/* Partner logo — right */}
      <Image
        src="/logo1.png"
        alt="Partner logo"
        width={200}
        height={200}
        className="w-14 h-auto opacity-90"
      />
    </div>
  );
}
