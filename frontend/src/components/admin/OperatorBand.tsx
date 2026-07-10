// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 Plan 05 (ADMIN-01) — the 061-B operator zone band.
//
// The full-width amber-warmed band that makes crossing the threshold into the
// Control Room *felt* (D-07 / sketch 061-B winner): a plain lucide `Shield` with
// an amber tint (DISTINCT from Governance's `ShieldCheck`), the "Control Room"
// label, an amber OPERATOR chip, the operator identity, the "every action
// recorded" marker, and a "‹ Back to app" affordance. Amber marks the zone
// sparingly — it is the app's needs-you color.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. No fetching, no state, no auth
// logic here — the shell (Plan 06) fetches the identity and passes it in, and the
// backend 404 gate is the sole authority (Pitfall 13 / T-146-06). The recording
// FLASH is prop-controlled (`recordingPulse`) so the shell can pulse the marker
// after a write without this leaf owning any state.
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronLeft, Shield } from "lucide-react"

import type { OperatorIdentity } from "@/lib/api"
import { cn } from "@/lib/utils"

interface OperatorBandProps {
  /** The signed-in operator (from `GET /admin/me`); null while the probe loads. */
  identity: OperatorIdentity | null
  /** Return to the ordinary app surface. */
  onBack: () => void
  /**
   * When true, the "every action recorded" marker flashes (062-A marker beat).
   * Prop-controlled so the shell (Plan 06) can pulse it once after a write lands
   * in the ledger, then flip it back — this leaf never owns the flash state.
   */
  recordingPulse?: boolean
}

/** The 061-B amber operator band. */
export function OperatorBand({ identity, onBack, recordingPulse = false }: OperatorBandProps) {
  return (
    <header className="border-b border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent px-6 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Zone identity: plain Shield (amber), NOT ShieldCheck (Governance's glyph). */}
        <div className="flex items-center gap-2.5 font-headline text-lg font-extrabold text-foreground">
          <Shield className="h-[18px] w-[18px] text-amber-400" aria-hidden="true" />
          Control Room
        </div>

        <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-amber-400">
          OPERATOR
        </span>

        {identity && (
          <span className="truncate text-xs text-muted-foreground" title={identity.email}>
            {identity.email}
          </span>
        )}

        <span className="flex-1" />

        {/* The recording marker — the ledger-is-receipt promise, made visible. */}
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors",
            recordingPulse && "bg-success/15 text-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block h-1.5 w-1.5 flex-none rounded-full bg-success shadow-[0_0_6px_hsl(142_71%_45%/0.6)]",
              recordingPulse && "animate-brandPulse",
            )}
          />
          every action recorded
        </span>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to app
        </button>
      </div>
    </header>
  )
}
