/**
 * Phase 118 Plan 06 Task 1 — RuleBuilderPanel (CLASS-01 / UX-01, the rules-authoring
 * builder). Locked G-2 sketch = sketches/037-rule-builder-and-list (Winner A — the
 * rules list + a right-side push/split builder).
 *
 * The builder lives in the SAME right-side push/split panel shell the app already uses
 * for document detail (027/112) and workflow phase forms (103). It is a straight React
 * state-switch (NO router) — the ClassificationRulesPage (Task 2) mounts this panel
 * beside the rules list (`minmax(0,1fr) <panel>`).
 *
 * Builder flow (037-A):
 *   chip-strip condition (field op value + ＋condition, flat AND — the SAME
 *     ConditionPopover/ViewCondition grammar the 029/114 FilterBar uses)
 *   → action = 📁 folder ONLY (the 🏷 tag radio is DROPPED per D-118-1 — the app has
 *     no document-tags concept; folder is the only action target)
 *   → scope segmented (👤 Only me / 🌐 Global G; default Only me)
 *   → live "would match N of M" preview via the EXISTING resolveAdHoc({count_only:true})
 *     (a rule's match_expr is the SAME ViewFilter AST — NO new client fn, NO new endpoint)
 *     + the forward-only honesty line: "existing docs aren't moved — rules suggest on
 *     new uploads only." (D-118-2).
 *
 * Save → createRule(name, match_expr, suggest_folder_id) — the body OMITS is_global
 * (the server hard-sets it false; the scope toggle is an authoring affordance the
 * server honors only on an admin-gated global path, NEVER a create-body flag, T-118-06-01)
 * — or updateRule(id, {...}) when editing an existing rule.
 *
 * UX-01: Deep Midnight / Aether tokens, mobile-responsive, WCAG 2.1 AA (every control
 * is a labeled, keyboard-operable native input/button).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import { EMPTY_FILTER } from "@/types"
import type {
  ClassificationRule,
  Folder,
  MetadataFieldDef,
  ViewCondition,
  ViewConditionOp,
  ViewFilter,
} from "@/types"
import { ConditionPopover } from "../ingestion/ConditionPopover"
import { createRule, updateRule, resolveAdHoc } from "@/lib/api"
import { cn } from "@/lib/utils"

/** Plain-language operator labels for the chip summary (sans, never jargon).
 *  Mirrors the FilterBar CHIP_OP_LABEL so a rule condition reads the same as a
 *  saved-view condition (preview-count ≈ on-upload-match honesty). */
const CHIP_OP_LABEL: Record<ViewConditionOp, string> = {
  eq: "is",
  one_of: "is one of",
  contains: "contains",
  is_empty: "is empty",
  gte: "≥",
  lte: "≤",
  between: "between",
  within_next: "within next",
  older_than: "older than",
  before: "before",
  after: "after",
}

function chipSummary(c: ViewCondition): string {
  const op = CHIP_OP_LABEL[c.op]
  if (c.op === "is_empty") return `${c.field} ${op}`
  if (c.op === "one_of") return `${c.field} ${op} ${(c.values ?? []).join(", ")}`
  if (c.op === "between") return `${c.field} ${op} ${c.value} – ${c.value2}`
  if (c.op === "within_next" || c.op === "older_than") {
    return `${c.field} ${op} ${c.value} ${c.unit ?? "days"}`
  }
  return `${c.field} ${op} ${c.value}`
}

type Scope = "private" | "global"

export interface RuleBuilderPanelProps {
  /** The caller's own + global folders — the 📁 suggested-folder action options. */
  folders: Folder[]
  /** The enabled custom field defs (merged with built-ins in ConditionPopover). */
  customFields?: MetadataFieldDef[]
  /** When set the builder is in EDIT mode (pre-filled, Save → updateRule). When
   *  undefined it composes a brand-new rule (Save → createRule). */
  rule?: ClassificationRule | null
  /** Fired after a successful create/update so the page can refresh the rules list. */
  onSaved: (rule: ClassificationRule) => void
  /** Close the builder panel (back to the list, no save). */
  onCancel: () => void
  /** Debounce window for the live "would match N" count (ms). Default 300. */
  debounceMs?: number
}

export function RuleBuilderPanel({
  folders,
  customFields = [],
  rule,
  onSaved,
  onCancel,
  debounceMs = 300,
}: RuleBuilderPanelProps) {
  const isEdit = !!rule

  // ── Rule name ───────────────────────────────────────────────────────────────
  const [name, setName] = useState<string>(rule?.name ?? "")

  // ── The chip-strip condition (flat AND, reused ViewCondition grammar) ────────
  const [filter, setFilter] = useState<ViewFilter>(rule?.match_expr ?? EMPTY_FILTER)
  const conditions = filter.conditions
  // Which chip is being edited (index), "new" while composing, or null (closed).
  const [editing, setEditing] = useState<number | "new" | null>(null)

  // ── 📁 folder action (the ONLY action — D-118-1, no tag radio) ───────────────
  const [folderId, setFolderId] = useState<string>(rule?.suggest_folder_id ?? "")

  // ── scope segmented (default Only me) ────────────────────────────────────────
  const [scope, setScope] = useState<Scope>(rule?.is_global ? "global" : "private")

  // ── live debounced "would match N" preview (reuses resolveAdHoc count_only) ──
  const [count, setCount] = useState<number | null>(null)
  const [counting, setCounting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // No conditions = "no narrowing" — nothing to count yet.
    if (conditions.length === 0) {
      setCount(null)
      setCounting(false)
      return
    }
    const myReq = ++reqIdRef.current
    setCounting(true)
    timerRef.current = setTimeout(() => {
      // REUSE the existing ad-hoc resolve (count_only) — a rule's match_expr is the
      // SAME ViewFilter AST. NO new count fn, NO new backend endpoint.
      resolveAdHoc({ op: "and", conditions }, { count_only: true })
        .then(({ total }) => {
          if (myReq === reqIdRef.current) setCount(total)
        })
        .catch(() => {
          if (myReq === reqIdRef.current) setCount(null)
        })
        .finally(() => {
          if (myReq === reqIdRef.current) setCounting(false)
        })
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(conditions), debounceMs])

  // ── condition mutations (clone of the FilterBar chip-strip handlers) ─────────
  const applyCondition = useCallback(
    (c: ViewCondition) => {
      setFilter((prev) => {
        if (editing === "new") return { op: "and", conditions: [...prev.conditions, c] }
        if (typeof editing === "number") {
          return {
            op: "and",
            conditions: prev.conditions.map((p, i) => (i === editing ? c : p)),
          }
        }
        return prev
      })
      setEditing(null)
    },
    [editing],
  )

  const removeCondition = useCallback((i: number) => {
    setFilter((prev) => ({
      op: "and",
      conditions: prev.conditions.filter((_, j) => j !== i),
    }))
  }, [])

  // ── Save → create or update ─────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const canSave = name.trim().length > 0 && conditions.length > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError(false)
    const matchExpr: ViewFilter = { op: "and", conditions }
    const suggestFolder = folderId || null
    try {
      let saved: ClassificationRule
      if (rule) {
        // EDIT mode: PATCH the same owned rule in place. The body carries the
        // editable fields; the enabled toggle rides this path too but is owned by
        // the row, not the builder, so we leave `enabled` untouched here.
        saved = await updateRule(rule.id, {
          name: name.trim(),
          match_expr: matchExpr,
          suggest_folder_id: suggestFolder,
        })
      } else {
        // CREATE mode: the body is (name, match_expr, suggest_folder_id) ONLY — it
        // NEVER carries is_global (the server hard-sets it false; the scope toggle
        // is an authoring affordance, not a create-body flag — T-118-06-01).
        saved = await createRule(name.trim(), matchExpr, suggestFolder)
      }
      onSaved(saved)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const editingCondition =
    typeof editing === "number" ? conditions[editing] : undefined

  const isZero = count === 0

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-xl bg-card/50 ghost-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {isEdit ? "Edit rule" : "New classification rule"}
        </h2>
        <button
          type="button"
          aria-label="Close rule builder"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Rule name */}
      <label className="block space-y-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Rule name
        </span>
        <input
          aria-label="Rule name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Acme invoices → Finance"
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      {/* Condition chip strip — field op value + ＋condition, flat AND (029/114). */}
      <div className="space-y-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          When a document matches
        </span>
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {conditions.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card pl-3 pr-1.5 py-1"
              >
                <button
                  type="button"
                  className="font-medium hover:text-primary"
                  onClick={() => setEditing(i)}
                >
                  {chipSummary(c)}
                </button>
                <button
                  type="button"
                  aria-label={`Remove condition ${i + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeCondition(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}

            {/* ＋ condition */}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/30"
              onClick={() => setEditing("new")}
            >
              <Plus className="h-3.5 w-3.5" /> condition
            </button>
          </div>

          {/* The type-aware field→op→value editor (reused verbatim from 114). */}
          {editing !== null && (
            <div className="absolute left-0 top-full z-20 mt-2">
              <ConditionPopover
                customFields={customFields}
                initial={editingCondition}
                onApply={applyCondition}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* 📁 folder action — the ONLY action (D-118-1, the 🏷 tag radio is dropped). */}
      <label className="block space-y-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          📁 Suggest moving it to
        </span>
        <select
          aria-label="Suggested folder"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Choose a folder…</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
              {f.is_global ? " (global)" : ""}
            </option>
          ))}
        </select>
      </label>

      {/* scope segmented — 👤 Only me / 🌐 Global (default Only me). Native radios
          so it is keyboard-operable + screen-reader legible (UX-01 / AA). */}
      <fieldset className="space-y-1.5">
        <legend className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Who can use this rule
        </legend>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              scope === "private"
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name="rule-scope"
              aria-label="Only me"
              className="sr-only"
              checked={scope === "private"}
              onChange={() => setScope("private")}
            />
            <span aria-hidden="true">👤</span> Only me
          </label>
          {/* AR-118-04: "Global" is disabled — there is no client path to create a
              global rule (the server hard-sets is_global=false on create; globals are
              admin/service-role-seeded). Showing it live but non-functional was a
              "never silent" honesty defect, so it's disabled with an explanation
              rather than silently ignored. */}
          <label
            title="Global rules are seeded by an administrator"
            className={cn(
              "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              scope === "global"
                ? "bg-primary/10 text-primary/70 font-medium"
                : "text-muted-foreground/50",
            )}
          >
            <input
              type="radio"
              name="rule-scope"
              aria-label="Global"
              className="sr-only"
              checked={scope === "global"}
              disabled
              onChange={() => setScope("global")}
            />
            <span aria-hidden="true">🌐</span> Global
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              G
            </span>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Global rules are seeded by an administrator.
        </p>
      </fieldset>

      {/* Live "would match N of M" preview + the forward-only honesty line. */}
      <div className="space-y-1.5 rounded-lg border border-dashed border-border bg-card/30 px-3 py-2.5">
        <p className="text-sm" aria-live="polite">
          {conditions.length === 0 ? (
            <span className="text-muted-foreground">
              Add a condition to preview how many documents would match.
            </span>
          ) : counting && count === null ? (
            <span className="text-muted-foreground">Counting…</span>
          ) : count === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={cn("tabular-nums", isZero ? "text-amber-500" : "text-foreground")}>
              Would match <strong>{count}</strong>{" "}
              {count === 1 ? "document" : "documents"} in your library
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          existing docs aren't moved — rules suggest on new uploads only
        </p>
      </div>

      {saveError && (
        <p role="alert" className="text-xs text-destructive">
          Couldn&rsquo;t save that rule &mdash; please try again.
        </p>
      )}

      {/* Actions */}
      <div className="mt-auto flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void handleSave()}
          aria-label="Save rule"
          className={cn(
            "rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground",
            "transition-[filter] hover:brightness-110",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {saving ? "Saving…" : isEdit ? "Save rule" : "Save rule"}
        </button>
      </div>
    </div>
  )
}

export default RuleBuilderPanel
