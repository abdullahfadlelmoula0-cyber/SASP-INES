"use client";

import Image from "next/image";

interface SaspInesLogoProps {
  className?: string;
  /**
   * Set to `true` only for the single largest/first-visible instance of the
   * logo on a page (e.g. the auth screen hero). Do NOT set this on every
   * usage — `priority` tells Next.js to preload the image with high
   * priority, and using it everywhere defeats its purpose and can hurt
   * page performance.
   */
  priority?: boolean;
}

/**
 * SASP-INES Official Logo.
 *
 * Renders the official brand artwork (public/logo.png), which already
 * includes the arch, torch, globe, book, and the
 * "Sudanese Academic Support Platform / SASP-INES" wordmark baked into
 * the image itself.
 *
 * Pass `className` (e.g. "w-80 h-auto") to control rendered size.
 */
export function SaspInesLogo({
  className = "w-32 h-auto",
  priority = false,
}: SaspInesLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="SASP-INES Logo"
      width={640}
      height={640}
      className={className}
      priority={priority}
    />
  );
}
