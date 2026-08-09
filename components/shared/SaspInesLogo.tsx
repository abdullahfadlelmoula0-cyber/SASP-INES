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
 * Renders two transparent-background versions of the brand artwork and
 * lets CSS pick the right one for the active theme (no JS/hook needed,
 * so there's no flash while the theme resolves on load):
 *   - public/logo-light.png — original colors, for light backgrounds
 *   - public/logo-dark.png  — navy elements recolored to white, for
 *     dark backgrounds (the teal/blue "S" swoosh is unchanged — it
 *     already reads fine on dark backgrounds)
 *
 * Pass `className` (e.g. "w-80 h-auto") to control rendered size.
 */
export function SaspInesLogo({
  className = "w-32 h-auto",
  priority = false,
}: SaspInesLogoProps) {
  return (
    <>
      <Image
        src="/logo-light.png"
        alt="SASP-INES Logo"
        width={640}
        height={640}
        className={`${className} dark:hidden`}
        priority={priority}
      />
      <Image
        src="/logo-dark.png"
        alt="SASP-INES Logo"
        width={640}
        height={640}
        className={`${className} hidden dark:block`}
        priority={priority}
      />
    </>
  );
}
