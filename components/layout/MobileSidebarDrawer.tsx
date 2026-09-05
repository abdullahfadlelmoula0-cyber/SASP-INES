"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";

/**
 * The hamburger menu — mobile-only (md:hidden). Opens a slide-in drawer
 * containing the FULL Sidebar navigation (every item, for the current
 * role), not the trimmed 5-item MobileNav bottom bar. This is what
 * surfaces items the bottom bar can't fit (e.g. admin's Lecturers,
 * Graduation AI, Dissertation Guidelines, Activity Logs).
 *
 * IMPORTANT: the overlay is rendered via a portal straight into
 * document.body. Topbar's <header> has backdrop-blur-sm
 * (backdrop-filter), and per the CSS spec any element with
 * filter/backdrop-filter/transform establishes a new containing block
 * for `position: fixed` descendants — so without the portal, this
 * drawer's "fixed inset-0" would be constrained to the header's own
 * 64px-tall box instead of covering the viewport (exactly what Radix's
 * Dialog/DropdownMenu already avoid by portaling to body).
 */
export function MobileSidebarDrawer({ courseCount }: { courseCount?: number }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll while the drawer is open, and close on Escape.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="md:hidden w-9 h-9 -ml-1.5 rounded-lg flex items-center justify-center text-foreground hover:bg-accent/30 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mounted && open &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            {/* Sliding panel */}
            <div className="relative w-72 max-w-[80vw] h-full shadow-2xl animate-slide-in-left">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute top-4 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <Sidebar courseCount={courseCount} variant="drawer" onNavigate={() => setOpen(false)} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
