import type { ChapterKey } from "@/types";

// ────────────────────────────────────────────────────────────────
// Chapter catalog — the fixed, ordered set of chapter slots every
// graduation project has. Deliberately a plain constant (not a DB
// table) for now: it changes rarely and keeping it in code means no
// migration is needed to reorder/rename slots. If INES's structure
// ends up varying by department/program, this is the one place to
// make it data-driven later.
//
// NOTE: This file must NOT have "use server" — it exports a
// non-function value (CHAPTER_CATALOG), which "use server" files
// cannot do. Kept separate from lib/chapters/actions.ts for exactly
// this reason (same fix applied earlier to lib/lecturers/schema.ts).
// ────────────────────────────────────────────────────────────────

export const CHAPTER_CATALOG: { key: ChapterKey; title: string }[] = [
  { key: "general_introduction", title: "Chapter 1: General Introduction" },
  { key: "literature_review", title: "Chapter 2: Literature Review" },
  { key: "methodology", title: "Chapter 3: Research Methodology" },
  { key: "results", title: "Chapter 4: Results" },
  { key: "discussion", title: "Chapter 5: Discussion" },
  { key: "conclusion", title: "Chapter 6: Conclusion and Recommendations" },
];
