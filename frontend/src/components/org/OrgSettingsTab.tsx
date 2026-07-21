// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 03 (ADMIN-05 / D-166-03) — the light org-config home.
//
// The THIN Settings-IA split: this tab stands up the org-config home behind
// `org:manage` and establishes the three-homes seam (settings-control-room-boundary
// note) — org-wide configuration lives HERE, personal preferences live in the
// profile menu, and platform-wide governance stays with the operator.
//
// D-166-03: this is a LIGHT split. The bulk relocation of the existing global
// config knobs (Settings → Control Room) is deferred to the v3.5 config pass
// (SEED-117 §1) — NOT built here. Per the boundary note's F1 reframe, today's
// operator-gated global knobs are already correctly placed; moving them now would
// add churn/risk on a phase whose center is tenancy identity. So this is a genuine
// (if small) org home, not a scope-reduced stub — the org identity is real, and the
// seam is honest about what lands here next.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 04) supplies the org
// identity from the `useOrg` context.
// ─────────────────────────────────────────────────────────────────────────────
import { Building2 } from "lucide-react"

interface OrgSettingsTabProps {
  /** The active org's display name (from the shell's org context). */
  orgName: string
}

/** The light org-config home — org identity + the three-homes seam (D-166-03). */
export function OrgSettingsTab({ orgName }: OrgSettingsTabProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <section
        aria-label="Organization settings"
        className="rounded-[10px] border border-border bg-card px-5 py-5"
      >
        <div className="mb-4 flex items-center gap-2.5">
          <Building2 className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
          <h2 className="font-headline text-base font-bold text-foreground">
            Organization settings
          </h2>
        </div>

        {/* Org identity — the one org-config fact that is real today (read-only here;
            renaming an org is a manage action a later phase wires). */}
        <div className="rounded-md border border-border bg-background px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Organization name
          </div>
          <div className="mt-1 truncate text-sm font-medium text-foreground" title={orgName}>
            {orgName}
          </div>
        </div>

        {/* The three-homes seam (D-166-03) — honest about what this home is and what
            arrives here next; no scope-reduction language, a genuine light home. */}
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This is your organization&rsquo;s home for org-wide configuration. Your personal
          preferences live in your profile menu, and platform-wide governance stays with the
          operator. More organization settings will appear here as they ship.
        </p>
      </section>
    </div>
  )
}
