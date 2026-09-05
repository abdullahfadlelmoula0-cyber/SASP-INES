"use client";

import * as React from "react";
import { useState, useEffect, useTransition, useMemo } from "react";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  BookOpen,
  Layers,
  Quote,
  Languages,
  Sparkles,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  getGuidelineRules,
  getGuidelineVersions,
  createGuidelineRule,
  updateGuidelineRule,
  toggleGuidelineRuleActive,
  deactivateGuidelineVersion,
  deleteGuidelineRule,
} from "@/lib/guidelines/actions";
import { CHAPTER_CATALOG } from "@/lib/chapters/catalog";
import type { GuidelineRuleCategory, IneseGuidelineRule } from "@/types";

const CATEGORIES: GuidelineRuleCategory[] = [
  "formatting",
  "structure",
  "citation",
  "language",
  "content",
];

const CATEGORY_META: Record<
  GuidelineRuleCategory,
  { label: string; icon: React.ElementType; className: string }
> = {
  formatting: { label: "Formatting", icon: Layers, className: "text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700" },
  structure: { label: "Structure", icon: BookOpen, className: "text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700" },
  citation: { label: "Citation", icon: Quote, className: "text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700" },
  language: { label: "Language", icon: Languages, className: "text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700" },
  content: { label: "Content", icon: Sparkles, className: "text-rose-600 border-rose-300 dark:text-rose-400 dark:border-rose-700" },
};

function chapterLabel(key: string | null): string {
  if (!key) return "Whole document";
  const slot = CHAPTER_CATALOG.find((c) => c.key === key);
  return slot?.title ?? key;
}

interface RuleFormData {
  guidelineVersion: string;
  appliesToChapter: string; // "" = whole document
  ruleText: string;
  category: GuidelineRuleCategory;
  isActive: boolean;
}

const EMPTY_FORM: RuleFormData = {
  guidelineVersion: "",
  appliesToChapter: "",
  ruleText: "",
  category: "formatting",
  isActive: true,
};

function RuleForm({
  formData,
  setFormData,
  formError,
  isEditing,
}: {
  formData: RuleFormData;
  setFormData: React.Dispatch<React.SetStateAction<RuleFormData>>;
  formError: string | null;
  isEditing: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      {formError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="rule-version">Guideline Version *</Label>
          <Input
            id="rule-version"
            placeholder="e.g. 2021-02"
            value={formData.guidelineVersion}
            onChange={(e) => setFormData((p) => ({ ...p, guidelineVersion: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-category">Category *</Label>
          <select
            id="rule-category"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            value={formData.category}
            onChange={(e) =>
              setFormData((p) => ({ ...p, category: e.target.value as GuidelineRuleCategory }))
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rule-chapter">Applies To</Label>
        <select
          id="rule-chapter"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          value={formData.appliesToChapter}
          onChange={(e) => setFormData((p) => ({ ...p, appliesToChapter: e.target.value }))}
        >
          <option value="">Whole document (any/all chapters)</option>
          {CHAPTER_CATALOG.map((c) => (
            <option key={c.key} value={c.key}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rule-text">Rule Text *</Label>
        <Textarea
          id="rule-text"
          rows={4}
          placeholder="State the rule exactly as it should be checked against a student's chapter…"
          value={formData.ruleText}
          onChange={(e) => setFormData((p) => ({ ...p, ruleText: e.target.value }))}
        />
      </div>

      {!isEditing && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
            className="rounded border-input"
          />
          Active immediately
        </label>
      )}
    </div>
  );
}

export default function GuidelinesPage() {
  const [rules, setRules] = useState<IneseGuidelineRule[]>([]);
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [versionFilter, setVersionFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | GuidelineRuleCategory>("ALL");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IneseGuidelineRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<IneseGuidelineRule | null>(null);
  const [deactivatingVersion, setDeactivatingVersion] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<RuleFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    const [rulesRes, versionsRes] = await Promise.all([
      getGuidelineRules(),
      getGuidelineVersions(),
    ]);
    if (rulesRes.error) {
      setLoadError(rulesRes.error);
    } else {
      setRules(rulesRes.data);
    }
    if (!versionsRes.error) setVersions(versionsRes.data);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      const matchesVersion = versionFilter === "ALL" || r.guideline_version === versionFilter;
      const matchesCategory = categoryFilter === "ALL" || r.category === categoryFilter;
      return matchesVersion && matchesCategory;
    });
  }, [rules, versionFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<GuidelineRuleCategory, IneseGuidelineRule[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const rule of filtered) {
      map.get(rule.category)?.push(rule);
    }
    return map;
  }, [filtered]);

  function resetForm() {
    setFormData(EMPTY_FORM);
    setFormError(null);
  }

  function openAdd() {
    resetForm();
    // Pre-fill version with the most recent one for convenience.
    if (versions.length > 0) {
      setFormData((p) => ({ ...p, guidelineVersion: versions[0] }));
    }
    setIsAddOpen(true);
  }

  function openEdit(rule: IneseGuidelineRule) {
    setFormData({
      guidelineVersion: rule.guideline_version,
      appliesToChapter: rule.applies_to_chapter ?? "",
      ruleText: rule.rule_text,
      category: rule.category,
      isActive: rule.is_active,
    });
    setFormError(null);
    setEditingRule(rule);
  }

  function handleCreate() {
    setFormError(null);
    startTransition(async () => {
      const result = await createGuidelineRule({
        guidelineVersion: formData.guidelineVersion,
        appliesToChapter: formData.appliesToChapter || null,
        ruleText: formData.ruleText,
        category: formData.category,
        isActive: formData.isActive,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast({ title: "Rule added" });
      setIsAddOpen(false);
      resetForm();
      loadData();
    });
  }

  function handleUpdate() {
    if (!editingRule) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateGuidelineRule(editingRule.id, {
        guidelineVersion: formData.guidelineVersion,
        appliesToChapter: formData.appliesToChapter || null,
        ruleText: formData.ruleText,
        category: formData.category,
      });
      if (result.error) {
        setFormError(result.error);
        return;
      }
      toast({ title: "Rule updated" });
      setEditingRule(null);
      resetForm();
      loadData();
    });
  }

  function handleToggleActive(rule: IneseGuidelineRule) {
    startTransition(async () => {
      const result = await toggleGuidelineRuleActive(rule.id, !rule.is_active);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      loadData();
    });
  }

  function handleDelete() {
    if (!deletingRule) return;
    startTransition(async () => {
      const result = await deleteGuidelineRule(deletingRule.id);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Rule deleted" });
      setDeletingRule(null);
      loadData();
    });
  }

  function handleDeactivateVersion() {
    if (!deactivatingVersion) return;
    startTransition(async () => {
      const result = await deactivateGuidelineVersion(deactivatingVersion);
      if (result.error) {
        toast({ title: "Error", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Version deactivated",
        description: `${result.count ?? 0} rule(s) under "${deactivatingVersion}" are now inactive.`,
      });
      setDeactivatingVersion(null);
      loadData();
    });
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dissertation Guidelines"
        description="Knowledge base of INES dissertation-writing rules, used by the future AI compliance checker. Students are never shown this page."
        action={
          <Button onClick={openAdd} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        }
      />

      {loadError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {loadError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
          value={versionFilter}
          onChange={(e) => setVersionFilter(e.target.value)}
        >
          <option value="ALL">All Versions</option>
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring min-w-[180px]"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as "ALL" | GuidelineRuleCategory)}
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
        {versionFilter !== "ALL" && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setDeactivatingVersion(versionFilter)}
          >
            <PowerOff className="w-3.5 h-3.5" />
            Deactivate "{versionFilter}"
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No guideline rules found"
          description="Add your first rule using the button above."
        />
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const rulesInCat = grouped.get(cat) ?? [];
            if (rulesInCat.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", meta.className.split(" ")[0])} />
                  <p className="text-sm font-semibold text-foreground">
                    {meta.label} ({rulesInCat.length})
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border">
                  {rulesInCat.map((rule) => (
                    <div
                      key={rule.id}
                      className={cn(
                        "flex items-start gap-3 p-4",
                        !rule.is_active && "opacity-50"
                      )}
                    >
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm text-foreground">{rule.rule_text}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-xs font-normal">
                            {rule.guideline_version}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-normal">
                            {chapterLabel(rule.applies_to_chapter)}
                          </Badge>
                          {!rule.is_active && (
                            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleActive(rule)}
                          disabled={isPending}
                          aria-label={rule.is_active ? "Deactivate" : "Activate"}
                          title={rule.is_active ? "Deactivate" : "Activate"}
                        >
                          {rule.is_active ? (
                            <Power className="w-3.5 h-3.5" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(rule)}
                          aria-label="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingRule(rule)}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Modal ──────────────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Guideline Rule</DialogTitle>
            <DialogDescription>
              This will be used by the future AI compliance checker to review student chapters.
            </DialogDescription>
          </DialogHeader>
          <RuleForm formData={formData} setFormData={setFormData} formError={formError} isEditing={false} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Modal ─────────────────────────────────────────── */}
      <Dialog open={!!editingRule} onOpenChange={(o) => { if (!o) { setEditingRule(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Guideline Rule</DialogTitle>
            <DialogDescription>
              To activate/deactivate, use the power icon on the rule row instead.
            </DialogDescription>
          </DialogHeader>
          <RuleForm formData={formData} setFormData={setFormData} formError={formError} isEditing={true} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditingRule(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────── */}
      <Dialog open={!!deletingRule} onOpenChange={(o) => { if (!o) setDeletingRule(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              This permanently removes the rule. Prefer deactivating instead if this rule was
              ever real guidance — deletion is meant for fixing mistakes, not retiring outdated
              rules.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingRule(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Version Confirmation ────────────────────── */}
      <Dialog open={!!deactivatingVersion} onOpenChange={(o) => { if (!o) setDeactivatingVersion(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Guideline Version</DialogTitle>
            <DialogDescription>
              This deactivates every rule under version{" "}
              <span className="font-semibold">{deactivatingVersion}</span>. Use this when a
              newer guideline document has fully replaced this one. Rules stay in the table for
              audit purposes and can be reactivated individually later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeactivatingVersion(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateVersion}
              disabled={isPending}
              className="gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Deactivate Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
