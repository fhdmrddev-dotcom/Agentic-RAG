// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 03 (ADMIN-01 / D-166-05 / sketch 080-A) — the org-admin zone band.
//
// The user-side mirror of the operator `OperatorBand`, re-tinted to org-indigo: the
// operator zone's warning tint stays RESERVED for that zone (using it here would
// misread the user's OWN org home as a privileged danger zone). This band is the
// app's normal primary accent (hue-239 indigo), matching the 079-C rail shield.
//
// Carries (080-A): the org name + an `ORG ADMIN` chip + the shared RoleBadge
// (Org-admin / Member — D-04 / D-166-05) + the 062-A "every action recorded" marker (KEPT verbatim —
// 080-A rejects variant C precisely because it drops this honesty beat) + a
// plain-first ⌥ Technical-names toggle (146 LANG-01).
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. No fetch, no auth, no state — the
// shell (Plan 04) fetches identity + owns the technical-names value (via the shared
// `useTechnicalNames` context) and threads them here so the band toggle + the audit
// raw-code reveal move ONE value. The recording FLASH is prop-controlled
// (`recordingPulse`) so the shell can pulse the marker after a write without this
// leaf owning any state.
// ─────────────────────────────────────────────────────────────────────────────
import { ChevronLeft, Shield } from "lucide-react"

import { cn } from "@/lib/utils"
import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import { RoleBadge } from "@/components/org/OrgIdentity"

interface OrgBandProps {
  /** The active org's display name — headlines the band. */
  orgName: string
  /** The caller's org role (mig-104 4-tier). Passed straight to the shared RoleBadge,
   *  which maps it via roleBadgeMeta (org-admin/super-admin/dept-admin → indigo admin
   *  pill; anything else → the muted Member pill — D-04 / D-166-05). */
  role: string
  /** Return to the ordinary app surface. */
  onBack: () => void
  /**
   * When true, the "every action recorded" marker flashes (062-A marker beat).
   * Prop-controlled so the shell can pulse it once after a write lands, then flip
   * it back — this leaf never owns the flash state.
   */
  recordingPulse?: boolean
  /** The shared ⌥ two-audience reveal (LANG-01) — the shell wires this to the single
   *  `useTechnicalNames` value so the band + the audit raw-code reveal never disagree. */
  showTechnical: boolean
  onToggleTechnical: () => void
}

/** The 080-A org-indigo band — org identity + role badge + recording marker + ⌥. */
export function OrgBand({
  orgName,
  role,
  onBack,
  recordingPulse = false,
  showTechnical,
  onToggleTechnical,
}: OrgBandProps) {
  return (
    <header className="border-b border-primary/25 bg-gradient-to-b from-primary/[0.07] to-transparent px-6 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Zone identity: plain Shield (indigo — the org's own home, NOT the operator zone). */}
        <div className="flex items-center gap-2.5 font-headline text-lg font-extrabold text-foreground">
          <Shield className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
          <span className="truncate" title={orgName}>
            {orgName}
          </span>
        </div>

        <span className="rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-primary">
          ORG ADMIN
        </span>

        {/* Role badge (D-04 / D-166-05): the ONE shared RoleBadge — the indigo admin pill
            for managers; the muted Member pill otherwise. The inline copy is retired; the
            glyph + tokens now live solely inside RoleBadge (roleBadgeMeta also reconciles Dept-admin). */}
        <RoleBadge role={role} />

        <span className="flex-1" />

        <TechnicalNamesToggle enabled={showTechnical} onToggle={onToggleTechnical} />

        {/* The recording marker — the ledger-is-receipt promise, made visible (062-A). */}
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
