import { useMemo } from "react"
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
  const n = Math.max(1, value || 1)

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
            onClick={() => onChange({ value: Math.max(1, n - 1), unit })}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="number"
            min={1}
            aria-label="Amount"
            value={n}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10)
              onChange({ value: Number.isNaN(next) ? 1 : Math.max(1, next), unit })
            }}
            className="w-14 text-center text-sm bg-background border-x border-input py-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label="Increase"
            className="px-2 py-1 bg-muted hover:bg-accent"
            onClick={() => onChange({ value: n + 1, unit })}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* [unit ▾] */}
        <select
          aria-label="Unit"
          value={unit}
          onChange={(e) => onChange({ value: n, unit: e.target.value as RelativeUnit })}
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
