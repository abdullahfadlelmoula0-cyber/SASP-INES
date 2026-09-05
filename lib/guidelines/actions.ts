"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { GuidelineRuleCategory, IneseGuidelineRule } from "@/types";

/**
 * INES Guideline Rules management (Step 3 of the dissertation-chapters
 * feature). This is the knowledge base the future AI compliance engine
 * (Phase 4) will read from — see chapter_compliance_reports /
 * ChapterComplianceReport.
 *
 * Versioning model: rows are never edited in place across guideline
 * revisions. When INES issues an updated guideline document, insert a
 * new batch of rows under a new guideline_version and deactivate the
 * old version's rows (see deactivateGuidelineVersion below) — nothing
 * else in the system needs to change.
 *
 * Admin-only: RLS already restricts INSERT/UPDATE/DELETE to is_admin(),
 * SELECT is open to all authenticated users (so a future AI-check
 * server action running as any role can read active rules) — this
 * file additionally gates every mutating action with requireAdmin()
 * so a bug here could never widen access beyond what RLS already
 * allows.
 */

export async function getGuidelineRules(filters?: {
  guidelineVersion?: string;
  category?: GuidelineRuleCategory;
  activeOnly?: boolean;
}): Promise<{ data: IneseGuidelineRule[]; error: string | null }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let query = supabase
      .from("ines_guideline_rules")
      .select("*")
      .order("guideline_version", { ascending: false })
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });

    if (filters?.guidelineVersion) query = query.eq("guideline_version", filters.guidelineVersion);
    if (filters?.category) query = query.eq("category", filters.category);
    if (filters?.activeOnly) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: (data as IneseGuidelineRule[]) ?? [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load guideline rules." };
  }
}

/**
 * Distinct guideline_version values currently in the table, newest
 * first (by max created_at within each version) — used to populate
 * the version filter/selector in the admin UI.
 */
export async function getGuidelineVersions(): Promise<{
  data: string[];
  error: string | null;
}> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ines_guideline_rules")
      .select("guideline_version, created_at")
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };

    const seen = new Set<string>();
    const versions: string[] = [];
    for (const row of data ?? []) {
      if (!seen.has(row.guideline_version)) {
        seen.add(row.guideline_version);
        versions.push(row.guideline_version);
      }
    }
    return { data: versions, error: null };
  } catch (err: any) {
    return { data: [], error: err.message || "Failed to load guideline versions." };
  }
}

export async function createGuidelineRule(input: {
  guidelineVersion: string;
  appliesToChapter: string | null;
  ruleText: string;
  category: GuidelineRuleCategory;
  isActive: boolean;
}): Promise<{ data?: IneseGuidelineRule; error?: string }> {
  try {
    await requireAdmin();

    if (!input.guidelineVersion.trim()) return { error: "Guideline version is required." };
    if (!input.ruleText.trim()) return { error: "Rule text is required." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ines_guideline_rules")
      .insert({
        guideline_version: input.guidelineVersion.trim(),
        applies_to_chapter: input.appliesToChapter,
        rule_text: input.ruleText.trim(),
        category: input.category,
        is_active: input.isActive,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/admin/guidelines");
    return { data: data as IneseGuidelineRule };
  } catch (err: any) {
    return { error: err.message || "Failed to create rule." };
  }
}

export async function updateGuidelineRule(
  id: string,
  input: {
    guidelineVersion: string;
    appliesToChapter: string | null;
    ruleText: string;
    category: GuidelineRuleCategory;
  }
): Promise<{ data?: IneseGuidelineRule; error?: string }> {
  try {
    await requireAdmin();

    if (!input.guidelineVersion.trim()) return { error: "Guideline version is required." };
    if (!input.ruleText.trim()) return { error: "Rule text is required." };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ines_guideline_rules")
      .update({
        guideline_version: input.guidelineVersion.trim(),
        applies_to_chapter: input.appliesToChapter,
        rule_text: input.ruleText.trim(),
        category: input.category,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/admin/guidelines");
    return { data: data as IneseGuidelineRule };
  } catch (err: any) {
    return { error: err.message || "Failed to update rule." };
  }
}

/**
 * Toggles a single rule active/inactive. Preferred over delete for
 * temporarily retiring a rule without losing it (matches the
 * versioning philosophy — old rules stay in the table, just inactive).
 */
export async function toggleGuidelineRuleActive(
  id: string,
  isActive: boolean
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("ines_guideline_rules")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/admin/guidelines");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to update rule status." };
  }
}

/**
 * Deactivates every rule under one guideline_version in a single call
 * — the intended way to "retire" an entire old guideline document once
 * its replacement's rules have been added, per the Step-3 plan.
 */
export async function deactivateGuidelineVersion(
  guidelineVersion: string
): Promise<{ error?: string; count?: number }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("ines_guideline_rules")
      .update({ is_active: false })
      .eq("guideline_version", guidelineVersion)
      .select("id");

    if (error) return { error: error.message };

    revalidatePath("/admin/guidelines");
    return { count: data?.length ?? 0 };
  } catch (err: any) {
    return { error: err.message || "Failed to deactivate guideline version." };
  }
}

/**
 * Permanently deletes a single rule. Use sparingly (e.g. fixing a typo
 * entered as a brand-new row by mistake) — toggling inactive is
 * preferred for anything that was ever real guidance, to preserve the
 * audit trail.
 */
export async function deleteGuidelineRule(id: string): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase.from("ines_guideline_rules").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/admin/guidelines");
    return {};
  } catch (err: any) {
    return { error: err.message || "Failed to delete rule." };
  }
}
