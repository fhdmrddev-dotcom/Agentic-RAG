import { useEffect, useMemo, useState } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * RelativeDateControl — the `[N] [unit ▾]` stepper for the direction-carrying
 * relative-date operators (Phase 114, sketch 030-A / D-114-4/5/16).
 *
 * The DATE operator already encodes the direction (`within next…` / `older
 * than…`) — this control only supplies the magnitude (N) + unit (days/weeks/
 * months) and shows a live, human-readable preview of the window those choices
 * resolve to.
 *
 * ⚠ PREVIEW-ONLY (D-114-16 / T-114-05-03): the resolved-window readout rendered
 * here is computed CLIENT-side purely so the user can SEE roughly which dates
 * will match. It is NOT authoritative — the server derives the real window from
 * its OWN clock at resolve time (so a saved "within next 90 days" view drifts
 * with the calendar). A manipulated client readout cannot change which rows the
 * server returns; the only contract is the operator + N + unit the AST carries.
 * Months count as ≈30 days here, matching the server's `_UNIT_DAYS` map — the
 * headline dates are an approximation, the operator/N/unit are the truth.
 */

export type RelativeUnit = "days" | "weeks" | "months"

/** ≈days per unit — mirrors the backend `_UNIT_DAYS` so the preview matches the
 *  server's window math (months ≈ 30 days). */
const UNIT_DAYS: Record<RelativeUnit, number> = { days: 1, weeks: 7, months: 30 }

/** WR-05: cap the span at ~100 years (matches the backend `_MAX_RELATIVE_DAYS`), so
 *  the committed N can never drive the server into a `date` OverflowError. The N cap
 *  depends on the unit (N × UNIT_DAYS[unit] ≤ MAX_SPAN_DAYS). */
const MAX_SPAN_DAYS = 36500

/** The largest valid N for a given unit (≥ 1, ≤ MAX_SPAN_DAYS / unit-days). */
function maxNForUnit(unit: RelativeUnit): number {
  return Math.max(1, Math.floor(MAX_SPAN_DAYS / UNIT_DAYS[unit]))
}

/** Clamp a (possibly non-integer / out-of-range) N to [1, maxNForUnit]. */
function clampN(n: number, unit: RelativeUnit): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(Math.max(1, Math.floor(n)), maxNForUnit(unit))
}

const UNIT_LABEL: Record<RelativeUnit, string> = {
  days: "days",
  weeks: "weeks",
  months: "months",
}

export interface RelativeDateControlProps {
  /** Which relative direction the operator carries. `within_next` shows the
   *  overdue-excluded note; `older_than` does not. */
  direction: "within_next" | "older_than"
  /** The magnitude N (clamped to >= 1). */
  value: number
  unit: RelativeUnit
  onChange: (next: { value: number; unit: RelativeUnit }) => void
}

/** Format a Date as a short, locale-stable "Mon D, YYYY" the readout uses. */
function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Compute the PREVIEW window client-side (D-114-16: preview only — the server
 *  is authoritative). within_next → today → today+span (overdue excluded);
 *  older_than → on/before today−span. */
function previewWindow(
  direction: "within_next" | "older_than",
  n: number,
  unit: RelativeUnit,
): string {
  const today = new Date()
  const spanDays = Math.max(1, n) * UNIT_DAYS[unit]
  if (direction === "within_next") {
    const end = new Date(today)
    end.setDate(end.getDate() + spanDays)
    return `${fmt(today)} – ${fmt(end)}`
  }
  // older_than — everything on or before today − span
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - spanDays)
  return `on or before ${fmt(cutoff)}`
}

export function RelativeDateControl({
  direction,
  value,
  unit,
  onChange,
}: RelativeDateControlProps) {
  const n = clampN(value, unit)

  // WR-05: the number input keeps its OWN draft string so the user can transiently
  // clear the field (or type a multi-digit number) without the value snapping to 1
  // mid-edit and fighting the cursor. The committed N is clamped on change-to-valid
  // and on blur; an empty/invalid blur reverts to the last valid N.
  const [draft, setDraft] = useState<string>(String(n))
  useEffect(() => {
    // Re-seed the draft when the committed value changes from outside (e.g. the
    // stepper buttons or a unit change re-clamps), but never while the user is
    // mid-edit on a value that already clamps to the same N.
    setDraft(String(n))
  }, [n])

  // Recompute the preview whenever N / unit / direction change. Note: this is a
  // client-side approximation for display; the server re-derives the real window
  // from its own clock at resolve time (D-114-16).
  const resolved = useMemo(
    () => previewWindow(direction, n, unit),
    [direction, n, unit],
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* [N] stepper */}
        <div className="inline-flex items-center rounded-md border border-input overflow-hidden">
          <button
            type="button"
            aria-label="Decrease"
            className="px-2 py-1 bg-muted hover:bg-accent disabled:opacity-40"
            disabled={n <= 1}
            onClick={() => onChange({ value: clampN(n - 1, unit), unit })}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={1}
            max={maxNForUnit(unit)}
            aria-label="Amount"
            value={draft}
            onChange={(e) => {
              // Keep the raw draft so the field can be transiently empty mid-edit.
              setDraft(e.target.value)
              // Commit a clamped value only when the draft parses to a real number;
              // an empty/invalid draft leaves the last committed N untouched (WR-05).
              const parsed = parseInt(e.target.value, 10)
              if (!Number.isNaN(parsed)) {
                onChange({ value: clampN(parsed, unit), unit })
              }
            }}
            onBlur={() => {
              // On blur, snap the draft back to the committed, clamped N — so an empty
              // or out-of-range field never lingers (WR-05).
              const parsed = parseInt(draft, 10)
              const committed = Number.isNaN(parsed) ? n : clampN(parsed, unit)
              setDraft(String(committed))
              onChange({ value: committed, unit })
            }}
            className="w-14 text-center text-sm bg-background border-x border-input py-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Increase"
            className="px-2 py-1 bg-muted hover:bg-accent disabled:opacity-40"
            disabled={n >= maxNForUnit(unit)}
            onClick={() => onChange({ value: clampN(n + 1, unit), unit })}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* [unit ▾] */}
        <select
          aria-label="Unit"
          value={unit}
          onChange={(e) => {
            // Switching units can push N over the new unit's cap (months has a smaller
            // max than days) — re-clamp against the chosen unit (WR-05).
            const nextUnit = e.target.value as RelativeUnit
            onChange({ value: clampN(n, nextUnit), unit: nextUnit })
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {(Object.keys(UNIT_LABEL) as RelativeUnit[]).map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
      </div>

      {/* Live resolved-window readout (PREVIEW-ONLY — see the file-level note). */}
      <div className="space-y-1 text-xs">
        <div className="text-muted-foreground">
          <span aria-hidden="true">→ </span>
          <span className="font-mono text-emerald-500" data-testid="resolved-window">
            {resolved}
          </span>
        </div>
        <p className="flex items-center gap-1.5 text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Updates automatically — the dates shift forward as time passes.
        </p>
        {direction === "within_next" && (
          <p className={cn("text-amber-500")}>
            Shows items coming due in this window. Already-overdue items are not included.
          </p>
        )}
      </div>
    </div>
  )
}
