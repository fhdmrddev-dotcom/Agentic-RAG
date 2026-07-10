// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 Plan 05 (ADMIN-01) — the "⌥ Technical names" two-audience toggle.
//
// The LANG-01 pattern, born plain at 146 (D-07 / sketch 061-B): the Control Room
// speaks plain language by default, and this toggle reveals the raw field /
// action / endpoint names alongside the plain labels for the technical audience.
//
// PURE PRESENTATIONAL LEAF: prop-controlled (`enabled` + `onToggle`). The parent
// (the shell in Plan 06) owns the toggle state and threads `showTechnical` down to
// HealthSignals and the ledger; this component only renders the control.
// ─────────────────────────────────────────────────────────────────────────────
import { cn } from "@/lib/utils"

interface TechnicalNamesToggleProps {
  /** Whether the raw technical names are currently revealed. */
  enabled: boolean
  /** Flip the reveal — the parent owns the state. */
  onToggle: () => void
}

/** The plain ⇄ technical two-audience reveal control. */
export function TechnicalNamesToggle({ enabled, onToggle }: TechnicalNamesToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-sans text-xs transition-colors",
        enabled
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-accent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
      )}
    >
      <span aria-hidden="true">⌥</span>
      Technical names
    </button>
  )
}
