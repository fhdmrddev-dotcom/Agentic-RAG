import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, X } from "lucide-react"
import type { MetadataFieldDef, SavedView, ViewCondition, ViewConditionOp, ViewFilter } from "@/types"
import { ConditionPopover } from "./ConditionPopover"
import { createView, resolveFilterCount } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * FilterBar — the no-DSL inline chip-strip filter/view builder (Phase 114, sketch
 * 029-A / D-114-1/2).
 *
 * `Where [chip] [chip] ＋condition … N documents match · Save as view`
 *
 * Ad-hoc filtering and saved views are the SAME surface (D-114-1): the bar
 * produces a flat AND-of-conditions `ViewFilter`, drives the document list (the
 * caller wires `onChange`/`onActiveFilter`), shows a live debounced "N documents
 * match" count (amber at zero — the no-DSL trust signal, D-114-2), and a "Save as
 * view" action that persists exactly what you're looking at (createView). Each
 * chip is one AND-ed condition edited via the type-aware ConditionPopover.
 *
 * CONTROLLED: pass `value` + `onChange` so Plan 06 can load a SAVED view's filter
 * back INTO the bar (selecting a view in the sidebar) and receive edits back. The
 * bar is the single filtering surface — there is no second mental model.
 *
 * Terminology is "saved filters," never "query" (sketch 029-A). All field-
 * whitelist validation + value binding stays server-side (T-114-05-01).
 */

const EMPTY_FILTER: ViewFilter = { op: "and", conditions: [] }

/** Plain-language operator labels for the chip summary (sans, never jargon). */
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

/** Render a single condition as a plain-language chip summary. */
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

export interface FilterBarProps {
  /** The enabled custom field defs (merged with built-ins in ConditionPopover). */
  customFields?: MetadataFieldDef[]
  /** Controlled filter (Plan 06 loads a saved view's filter back in here). */
  value?: ViewFilter
  /** Fires whenever the composed filter changes (add/edit/remove a condition). */
  onChange?: (filter: ViewFilter) => void
  /** Convenience callback giving the active filter for the document list. Same
   *  payload as `onChange` — the bar drives the list (ad-hoc == saved, D-114-1). */
  onActiveFilter?: (filter: ViewFilter) => void
  /** Fires after a successful Save-as-view so the page/Plan 06 can refresh the
   *  sidebar Views group with the new saved filter. */
  onViewSaved?: (view: SavedView) => void
  /** Debounce window for the live count (ms). Default 300 (RESEARCH). */
  debounceMs?: number
}

export function FilterBar({
  customFields = [],
  value,
  onChange,
  onActiveFilter,
  onViewSaved,
  debounceMs = 300,
}: FilterBarProps) {
  // Uncontrolled fallback so the bar works standalone (and in tests) without a
  // wiring page; when `value` is provided the bar is fully controlled.
  const [internal, setInternal] = useState<ViewFilter>(value ?? EMPTY_FILTER)
  const filter = value ?? internal
  const conditions = filter.conditions

  const setFilter = useCallback(
    (next: ViewFilter) => {
      if (value === undefined) setInternal(next)
      onChange?.(next)
      onActiveFilter?.(next)
    },
    [value, onChange, onActiveFilter],
  )

  // Which chip is being edited (index), or "new" while composing a fresh one, or
  // null when the popover is closed.
  const [editing, setEditing] = useState<number | "new" | null>(null)

  // ── live debounced "N match" count ──────────────────────────────────────────
  const [count, setCount] = useState<number | null>(null)
  const [counting, setCounting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // No conditions = "no narrowing" — nothing to count (and a transient empty
    // view would just count everything). Clear the count and skip the round-trip.
    if (conditions.length === 0) {
      setCount(null)
      setCounting(false)
      return
    }
    const myReq = ++reqIdRef.current
    setCounting(true)
    timerRef.current = setTimeout(() => {
      resolveFilterCount({ op: "and", conditions })
        .then((total) => {
          // Ignore a stale response if a newer keystroke already superseded it.
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
    // Re-run when the conditions list changes (deep — via JSON).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(conditions), debounceMs])

  // ── Save-as-view ──────────────────────────────────────────────────────────
  const [naming, setNaming] = useState(false)
  const [viewName, setViewName] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const name = viewName.trim()
    if (!name || conditions.length === 0) return
    setSaving(true)
    try {
      const saved = await createView(name, { op: "and", conditions })
      onViewSaved?.(saved)
      setNaming(false)
      setViewName("")
    } finally {
      setSaving(false)
    }
  }

  // ── condition mutations ─────────────────────────────────────────────────────
  function applyCondition(c: ViewCondition) {
    if (editing === "new") {
      setFilter({ op: "and", conditions: [...conditions, c] })
    } else if (typeof editing === "number") {
      setFilter({
        op: "and",
        conditions: conditions.map((p, i) => (i === editing ? c : p)),
      })
    }
    setEditing(null)
  }

  function removeCondition(i: number) {
    setFilter({ op: "and", conditions: conditions.filter((_, j) => j !== i) })
  }

  const isZero = count === 0
  const editingCondition = useMemo<ViewCondition | undefined>(
    () => (typeof editing === "number" ? conditions[editing] : undefined),
    [editing, conditions],
  )

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Where</span>

        {/* Condition chips */}
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

        {/* + condition */}
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/30"
          onClick={() => setEditing("new")}
        >
          <Plus className="h-3.5 w-3.5" /> condition
        </button>

        <div className="ml-auto flex items-center gap-3">
          {/* Live "N documents match" — amber at zero (D-114-2). */}
          {conditions.length > 0 && (
            <span
              className={cn(
                "text-xs tabular-nums",
                isZero ? "text-amber-500" : "text-muted-foreground",
              )}
              data-testid="match-count"
              data-zero={isZero ? "true" : "false"}
            >
              {counting && count === null
                ? "counting…"
                : count === null
                  ? ""
                  : `${count} ${count === 1 ? "document" : "documents"} match`}
            </span>
          )}

          {/* Save as view */}
          {conditions.length > 0 &&
            (naming ? (
              <span className="inline-flex items-center gap-1.5">
                <input
                  aria-label="View name"
                  autoFocus
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                    if (e.key === "Escape") {
                      setNaming(false)
                      setViewName("")
                    }
                  }}
                  placeholder="Name this filter…"
                  className="h-8 w-40 rounded-md border border-primary/30 bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  type="button"
                  disabled={!viewName.trim() || saving}
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  onClick={handleSave}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setNaming(true)}
              >
                Save as view
              </button>
            ))}
        </div>
      </div>

      {/* Condition editor popover (anchored below the bar). */}
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
  )
}
