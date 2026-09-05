"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { analyzeChapterCompliance, type CheckableRule } from "@/lib/graduation/chapter-compliance-ai";
import type { ChapterComplianceReport, ChapterVersion, DissertationChapter } from "@/types";

// ────────────────────────────────────────────────────────────────
// Chapter catalog — the fixed, ordered set of chapter slots every
// graduation project has. Deliberately a plain constant (not a DB
// table) for now: it changes rarely and keeping it in code means no
// migration is needed to reorder/rename slots. If INES's structure
// ends up varying by department/program, this is the one place to
// make it data-driven later.
// ────────────────────────────────────────────────────────────────

/**
 * Confirms the project belongs to the current student AND is 'active'
 * (i.e. has a confirmed supervisor) — chapter writing only makes sense
 * once supervision is confirmed, per the app's existing workflow.
 */
async function requireActiveOwnProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  projectId: string
): Promise<{ error?: string }> {
  const { data: project, error } = await supabase
    .from("graduation_projects")
    .select("id, status")
    .eq("id", projectId)
    .eq("student_id", studentId)
    .single();

  if (error || !project) {
    return { error: "Project not found or access denied." };
  }
  if (project.status !== "active") {
    return { error: "Chapters can only be written once a supervisor has accepted your project." };
  }
  return {};
}

/**
 * Fetches the AI-checkable active rules that apply to one chapter
 * (this chapter's own rules PLUS the general/all-chapters ones,
 * applies_to_chapter IS NULL) — EXCLUDING category='formatting'
 * entirely. 'formatting' is one of exactly 5 values enforced by a DB
 * CHECK constraint on ines_guideline_rules.category, so this exclusion
 * is a robust category filter, never a hard-coded rule id/list, and it
 * automatically covers any new formatting rule added later under the
 * same category value — no code change needed for that part.
 *
 * Best-effort: returns an empty list (never throws) on any DB error,
 * so a rules-fetch failure degrades to "nothing to check" rather than
 * blocking the chapter version save that's already succeeded by the
 * time this runs.
 */
async function getCheckableRulesForChapter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  chapterKey: string
): Promise<CheckableRule[]> {
  const { data, error } = await supabase
    .from("ines_guideline_rules")
    .select("rule_text, category")
    .eq("is_active", true)
    .neq("category", "formatting")
    .or(`applies_to_chapter.eq.${chapterKey},applies_to_chapter.is.null`);

  if (error || !data) {
    console.error("Failed to load checkable compliance rules (non-blocking):", error?.message);
    return [];
  }

  return data.map((r) => ({
    rule_text: r.rule_text as string,
    category: r.category as CheckableRule["category"],
  }));
}

/**
 * Public, student-accessible fetch of the FORMATTING rules for one
 * chapter — shown in the UI as a static/manual checklist, clearly
 * separate from the AI-checked report, since these describe physical
 * document properties (margins, fonts, spacing, page numbers) that no
 * text-only model can verify. Uses the normal RLS-respecting client
 * (guideline_rules_select_all already permits any authenticated user
 * to SELECT this table) — deliberately NOT routed through
 * lib/guidelines/actions.ts, whose getGuidelineRules() is admin-gated
 * for the rule-MANAGEMENT UI, a different concern from a student
 * reading rule text for their own chapter.
 */
export async function getChapterFormattingChecklist(chapterKey: string): Promise<{
  data: string[];
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ines_guideline_rules")
      .select("rule_text")
      .eq("is_active", true)
      .eq("category", "formatting")
      .or(`applies_to_chapter.eq.${chapterKey},applies_to_chapter.is.null`)
      .order("created_at", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map((r) => r.rule_text as string), error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load formatting checklist." };
  }
}

/**
 * Runs the AI compliance check for a just-saved chapter version and
 * persists the report. Called ONLY from commitChapterVersion, ONLY
 * AFTER the version row already exists — see the call site for the
 * exact ordering guarantee. Wrapped so that ANY failure here (rules
 * fetch, Gemini call, or the report insert itself) is swallowed and
 * logged, never thrown — compliance checking is best-effort and must
 * never affect whether the version save itself succeeded.
 */
async function runComplianceCheck(
  supabase: Awaited<ReturnType<typeof createClient>>,
  chapterVersionId: string,
  chapterKey: string,
  content: string
): Promise<void> {
  try {
    const rules = await getCheckableRulesForChapter(supabase, chapterKey);
    const analysis = await analyzeChapterCompliance(content, rules);

    const { error } = await supabase.from("chapter_compliance_reports").insert({
      chapter_version_id: chapterVersionId,
      status: analysis.status,
      findings: analysis.findings,
      raw_ai_response: analysis,
    });

    if (error) {
      console.error("Failed to persist compliance report (non-blocking):", error.message);
    }
  } catch (err) {
    console.error("Chapter compliance check failed (non-blocking):", err);
  }
}

/**
 * Returns every chapter row that exists so far for a project (a slot
 * with no row yet simply hasn't been started — the UI merges this
 * against CHAPTER_CATALOG to render "Not Started" placeholders).
 */
export async function getProjectChapters(projectId: string): Promise<{
  data: DissertationChapter[];
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("dissertation_chapters")
      .select("*")
      .eq("project_id", projectId)
      .order("chapter_key", { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data as DissertationChapter[]) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load chapters." };
  }
}

/**
 * Returns one chapter row (or null if that slot hasn't been started).
 */
export async function getChapter(
  projectId: string,
  chapterKey: string
): Promise<{ data: DissertationChapter | null; error: string | null }> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("dissertation_chapters")
      .select("*")
      .eq("project_id", projectId)
      .eq("chapter_key", chapterKey)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as DissertationChapter | null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to load chapter." };
  }
}

/**
 * Autosave: updates the chapter's live `content` WITHOUT creating a new
 * version. Creates the dissertation_chapters row on first save for this
 * slot. Never touches file_url — switching to "write in system" after
 * having uploaded a file is a deliberate action the UI handles by
 * calling this only from the writing tab.
 */
export async function saveChapterDraft(input: {
  projectId: string;
  chapterKey: string;
  title: string;
  content: string;
}): Promise<{ data?: DissertationChapter; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const guard = await requireActiveOwnProject(supabase, profile.id, input.projectId);
    if (guard.error) return { error: guard.error };

    const { data, error } = await supabase
      .from("dissertation_chapters")
      .upsert(
        {
          project_id: input.projectId,
          chapter_key: input.chapterKey,
          title: input.title.trim() || null,
          content: input.content,
          file_url: null,
        },
        { onConflict: "project_id,chapter_key" }
      )
      .select()
      .single();

    if (error) return { error: error.message };
    return { data: data as DissertationChapter };
  } catch (err: any) {
    return { error: err.message || "Failed to save draft." };
  }
}

/**
 * "Save as Version" — the formal checkpoint action. Upserts the live
 * chapter row, THEN inserts an immutable snapshot into chapter_versions
 * with the next version_number, and bumps current_version_number to
 * match. This is the point Phase 4's AI compliance check will hook
 * into (one report per chapter_version_id) — not wired yet.
 */
export async function commitChapterVersion(input: {
  projectId: string;
  chapterKey: string;
  title: string;
  content: string;
}): Promise<{ data?: { chapter: DissertationChapter; version: ChapterVersion }; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const guard = await requireActiveOwnProject(supabase, profile.id, input.projectId);
    if (guard.error) return { error: guard.error };

    if (!input.content.trim()) {
      return { error: "Chapter content can't be empty." };
    }

    // Read current version number first, so the new version number is
    // computed from what's actually there rather than assumed.
    const { data: existing } = await supabase
      .from("dissertation_chapters")
      .select("id, current_version_number")
      .eq("project_id", input.projectId)
      .eq("chapter_key", input.chapterKey)
      .maybeSingle();

    const nextVersionNumber = (existing?.current_version_number ?? 0) + 1;

    const { data: chapter, error: chapterError } = await supabase
      .from("dissertation_chapters")
      .upsert(
        {
          project_id: input.projectId,
          chapter_key: input.chapterKey,
          title: input.title.trim() || null,
          content: input.content,
          file_url: null,
          current_version_number: nextVersionNumber,
        },
        { onConflict: "project_id,chapter_key" }
      )
      .select()
      .single();

    if (chapterError || !chapter) {
      return { error: chapterError?.message || "Failed to save chapter." };
    }

    const { data: version, error: versionError } = await supabase
      .from("chapter_versions")
      .insert({
        chapter_id: chapter.id,
        version_number: nextVersionNumber,
        content_snapshot: input.content,
        file_url_snapshot: null,
        edited_by: profile.id,
      })
      .select()
      .single();

    if (versionError) return { error: versionError.message };

    // ── Compliance check runs ONLY here, AFTER the version already
    // exists and its own save has fully succeeded. Any failure inside
    // is caught internally by runComplianceCheck and never propagates
    // — the version the student just saved is never rolled back or
    // blocked by anything that happens from this line down.
    await runComplianceCheck(supabase, version.id, input.chapterKey, input.content);

    revalidatePath("/graduation-project/chapters");
    return {
      data: {
        chapter: chapter as DissertationChapter,
        version: version as ChapterVersion,
      },
    };
  } catch (err: any) {
    return { error: err.message || "Failed to save version." };
  }
}

/**
 * Called AFTER the browser has already uploaded the file directly to
 * the `dissertation-chapters` storage bucket (see
 * lib/chapters/file-uploads-client.ts) — this just records the
 * resulting URL as the chapter's current state and creates a matching
 * version snapshot, mirroring commitChapterVersion()'s shape exactly
 * so the version-history UI treats uploaded and written chapters
 * identically.
 */
export async function attachChapterFile(input: {
  projectId: string;
  chapterKey: string;
  title: string;
  fileUrl: string;
}): Promise<{ data?: { chapter: DissertationChapter; version: ChapterVersion }; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const guard = await requireActiveOwnProject(supabase, profile.id, input.projectId);
    if (guard.error) return { error: guard.error };

    const { data: existing } = await supabase
      .from("dissertation_chapters")
      .select("id, current_version_number")
      .eq("project_id", input.projectId)
      .eq("chapter_key", input.chapterKey)
      .maybeSingle();

    const nextVersionNumber = (existing?.current_version_number ?? 0) + 1;

    const { data: chapter, error: chapterError } = await supabase
      .from("dissertation_chapters")
      .upsert(
        {
          project_id: input.projectId,
          chapter_key: input.chapterKey,
          title: input.title.trim() || null,
          content: null,
          file_url: input.fileUrl,
          current_version_number: nextVersionNumber,
        },
        { onConflict: "project_id,chapter_key" }
      )
      .select()
      .single();

    if (chapterError || !chapter) {
      return { error: chapterError?.message || "Failed to save chapter." };
    }

    const { data: version, error: versionError } = await supabase
      .from("chapter_versions")
      .insert({
        chapter_id: chapter.id,
        version_number: nextVersionNumber,
        content_snapshot: null,
        file_url_snapshot: input.fileUrl,
        edited_by: profile.id,
      })
      .select()
      .single();

    if (versionError) return { error: versionError.message };

    revalidatePath("/graduation-project/chapters");
    return {
      data: {
        chapter: chapter as DissertationChapter,
        version: version as ChapterVersion,
      },
    };
  } catch (err: any) {
    return { error: err.message || "Failed to attach file." };
  }
}

/**
 * "Re-check" — re-runs the AI compliance check for a chapter's CURRENT
 * latest version, WITHOUT creating a new version (the content hasn't
 * changed; the student just wants a fresh judgment, e.g. after reading
 * feedback more carefully). Only valid for text versions — a version
 * backed by an uploaded file has no content_snapshot to analyze, so
 * the UI never offers this button for those.
 *
 * Rate-limited to 3 re-checks per version per rolling 24h, per the
 * original plan's cost-protection requirement — independent of the
 * check that already runs on every "Save as Version".
 */
export async function recheckChapterCompliance(input: {
  projectId: string;
  chapterKey: string;
}): Promise<{ data?: ChapterComplianceReport; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const guard = await requireActiveOwnProject(supabase, profile.id, input.projectId);
    if (guard.error) return { error: guard.error };

    const { data: chapter, error: chapterError } = await supabase
      .from("dissertation_chapters")
      .select("id, current_version_number")
      .eq("project_id", input.projectId)
      .eq("chapter_key", input.chapterKey)
      .maybeSingle();

    if (chapterError || !chapter) {
      return { error: "This chapter hasn't been saved yet." };
    }

    const { data: version, error: versionError } = await supabase
      .from("chapter_versions")
      .select("id, content_snapshot")
      .eq("chapter_id", chapter.id)
      .eq("version_number", chapter.current_version_number)
      .single();

    if (versionError || !version) {
      return { error: "Current version not found." };
    }
    if (!version.content_snapshot) {
      return { error: "Re-checking only applies to chapters written in the system, not uploaded files." };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("chapter_compliance_reports")
      .select("id", { count: "exact", head: true })
      .eq("chapter_version_id", version.id)
      .gte("created_at", since);

    if ((recentCount ?? 0) >= 3) {
      return { error: "You've reached today's re-check limit for this version. Please try again tomorrow." };
    }

    const rules = await getCheckableRulesForChapter(supabase, input.chapterKey);
    const analysis = await analyzeChapterCompliance(version.content_snapshot, rules);

    const { data: report, error: reportError } = await supabase
      .from("chapter_compliance_reports")
      .insert({
        chapter_version_id: version.id,
        status: analysis.status,
        findings: analysis.findings,
        raw_ai_response: analysis,
      })
      .select()
      .single();

    if (reportError || !report) {
      return { error: reportError?.message || "Failed to save the re-check result." };
    }

    revalidatePath("/graduation-project/chapters");
    return { data: report as ChapterComplianceReport };
  } catch (err: any) {
    return { error: err.message || "Re-check failed." };
  }
}

/**
 * Lightweight overview for the chapters index page: for every chapter
 * that has at least one version, the latest version's compliance
 * status (or omitted if that version hasn't been checked yet — e.g.
 * still mid-check, or the check failed silently). Batched into 3
 * queries total regardless of chapter count, never one query per
 * chapter.
 */
export async function getChaptersComplianceOverview(projectId: string): Promise<{
  data: Record<string, "compliant" | "needs_review" | "non_compliant">;
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data: chapters, error: chaptersError } = await supabase
      .from("dissertation_chapters")
      .select("id, chapter_key, current_version_number")
      .eq("project_id", projectId);

    if (chaptersError || !chapters || chapters.length === 0) {
      return { data: {}, error: chaptersError?.message ?? null };
    }

    const { data: versions, error: versionsError } = await supabase
      .from("chapter_versions")
      .select("id, chapter_id, version_number")
      .in(
        "chapter_id",
        chapters.map((c) => c.id)
      );

    if (versionsError || !versions) {
      return { data: {}, error: versionsError?.message ?? null };
    }

    // Map chapter_id -> its current version's id (only the LATEST
    // version's report counts toward the overview).
    const currentVersionIdByChapterId = new Map<string, string>();
    for (const chapter of chapters) {
      const currentVersion = versions.find(
        (v) => v.chapter_id === chapter.id && v.version_number === chapter.current_version_number
      );
      if (currentVersion) currentVersionIdByChapterId.set(chapter.id, currentVersion.id);
    }

    const versionIds = Array.from(currentVersionIdByChapterId.values());
    if (versionIds.length === 0) return { data: {}, error: null };

    const { data: reports, error: reportsError } = await supabase
      .from("chapter_compliance_reports")
      .select("chapter_version_id, status, created_at")
      .in("chapter_version_id", versionIds)
      .order("created_at", { ascending: false });

    if (reportsError || !reports) {
      return { data: {}, error: reportsError?.message ?? null };
    }

    const latestStatusByVersionId = new Map<string, "compliant" | "needs_review" | "non_compliant">();
    for (const report of reports) {
      if (!latestStatusByVersionId.has(report.chapter_version_id)) {
        latestStatusByVersionId.set(report.chapter_version_id, report.status);
      }
    }

    const result: Record<string, "compliant" | "needs_review" | "non_compliant"> = {};
    for (const chapter of chapters) {
      const versionId = currentVersionIdByChapterId.get(chapter.id);
      const status = versionId ? latestStatusByVersionId.get(versionId) : undefined;
      if (status) result[chapter.chapter_key] = status;
    }

    return { data: result, error: null };
  } catch (err: any) {
    return { data: {}, error: err.message || "Failed to load compliance overview." };
  }
}

/**
 * Full version history for one chapter, newest first. Joins the
 * editor's name for display, and merges in each version's compliance
 * report (if the AI check ran and succeeded for it) as
 * `compliance_report`. Done as a separate query + client-side merge
 * rather than a PostgREST embed, since chapter_compliance_reports has
 * no UNIQUE constraint on chapter_version_id — taking the newest row
 * per version_id here makes "latest report" explicit and correct
 * either way.
 */
export async function getChapterVersions(chapterId: string): Promise<{
  data: ChapterVersion[];
  error: string | null;
}> {
  try {
    await requireAuth();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("chapter_versions")
      .select(`*, editor:edited_by(id, full_name)`)
      .eq("chapter_id", chapterId)
      .order("version_number", { ascending: false });

    if (error) return { data: [], error: error.message };
    const versions = (data as ChapterVersion[]) ?? [];
    if (versions.length === 0) return { data: versions, error: null };

    const { data: reports } = await supabase
      .from("chapter_compliance_reports")
      .select("*")
      .in(
        "chapter_version_id",
        versions.map((v) => v.id)
      )
      .order("created_at", { ascending: false });

    const latestReportByVersionId = new Map<string, ChapterComplianceReport>();
    for (const report of reports ?? []) {
      const r = report as ChapterComplianceReport;
      if (!latestReportByVersionId.has(r.chapter_version_id)) {
        latestReportByVersionId.set(r.chapter_version_id, r);
      }
    }

    const merged = versions.map((v) => ({
      ...v,
      compliance_report: latestReportByVersionId.get(v.id) ?? null,
    }));

    return { data: merged, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load version history." };
  }
}

/**
 * Deletes an old, non-current version permanently (its
 * chapter_compliance_reports row cascades automatically via the FK).
 * The CURRENT version (matching dissertation_chapters.current_version_number)
 * can NEVER be deleted through this function — it's the chapter's live
 * state, so removing it would leave current_version_number pointing at
 * a row that no longer exists. To get rid of the current version, the
 * student should restore an earlier one first (which copies it forward
 * as a new current version), then delete the one they no longer want.
 *
 * Deleting does NOT renumber remaining versions — gaps in
 * version_number are expected and harmless (e.g. v1, v2, v4 after v3
 * is deleted). Irreversible: no soft-delete/undo.
 */
export async function deleteChapterVersion(input: {
  projectId: string;
  chapterId: string;
  versionId: string;
}): Promise<{ error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const guard = await requireActiveOwnProject(supabase, profile.id, input.projectId);
    if (guard.error) return { error: guard.error };

    const { data: chapter, error: chapterError } = await supabase
      .from("dissertation_chapters")
      .select("id, project_id, current_version_number")
      .eq("id", input.chapterId)
      .eq("project_id", input.projectId)
      .single();

    if (chapterError || !chapter) {
      return { error: "Chapter not found." };
    }

    const { data: version, error: versionError } = await supabase
      .from("chapter_versions")
      .select("id, version_number")
      .eq("id", input.versionId)
      .eq("chapter_id", input.chapterId)
      .single();

    if (versionError || !version) {
      return { error: "That version could not be found." };
    }

    if (version.version_number === chapter.current_version_number) {
      return {
        error:
          "This is the current version and can't be deleted. Restore a different version first, then delete this one.",
      };
    }

    const { error: deleteError } = await supabase
      .from("chapter_versions")
      .delete()
      .eq("id", input.versionId)
      .eq("chapter_id", input.chapterId);

    if (deleteError) return { error: deleteError.message };

    revalidatePath("/graduation-project/chapters");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to delete version." };
  }
}

/**
 * Restores an old version by copying it FORWARD as a brand new version
 * — never overwrites or deletes history. After this call, the chapter's
 * live state matches the restored version's content/file exactly, and
 * a new row appears at the top of the version history noting it.
 */
export async function restoreChapterVersion(input: {
  projectId: string;
  chapterId: string;
  versionId: string;
}): Promise<{ data?: { chapter: DissertationChapter; version: ChapterVersion }; error?: string }> {
  try {
    const profile = await requireAuth();
    const supabase = await createClient();

    const guard = await requireActiveOwnProject(supabase, profile.id, input.projectId);
    if (guard.error) return { error: guard.error };

    const { data: oldVersion, error: fetchError } = await supabase
      .from("chapter_versions")
      .select("id, chapter_id, content_snapshot, file_url_snapshot")
      .eq("id", input.versionId)
      .eq("chapter_id", input.chapterId)
      .single();

    if (fetchError || !oldVersion) {
      return { error: "That version could not be found." };
    }

    const { data: existing, error: chapterFetchError } = await supabase
      .from("dissertation_chapters")
      .select("id, title, current_version_number")
      .eq("id", input.chapterId)
      .single();

    if (chapterFetchError || !existing) {
      return { error: "Chapter not found." };
    }

    const nextVersionNumber = existing.current_version_number + 1;

    const { data: chapter, error: chapterError } = await supabase
      .from("dissertation_chapters")
      .update({
        content: oldVersion.content_snapshot,
        file_url: oldVersion.file_url_snapshot,
        current_version_number: nextVersionNumber,
      })
      .eq("id", input.chapterId)
      .select()
      .single();

    if (chapterError || !chapter) {
      return { error: chapterError?.message || "Failed to restore version." };
    }

    const { data: version, error: versionError } = await supabase
      .from("chapter_versions")
      .insert({
        chapter_id: input.chapterId,
        version_number: nextVersionNumber,
        content_snapshot: oldVersion.content_snapshot,
        file_url_snapshot: oldVersion.file_url_snapshot,
        edited_by: profile.id,
      })
      .select()
      .single();

    if (versionError) return { error: versionError.message };

    revalidatePath("/graduation-project/chapters");
    return {
      data: {
        chapter: chapter as DissertationChapter,
        version: version as ChapterVersion,
      },
    };
  } catch (err: any) {
    return { error: err.message || "Failed to restore version." };
  }
}
