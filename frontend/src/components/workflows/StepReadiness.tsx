/**
 * Phase 200 (the step-panel port, DES-02) — THE PANEL'S CLOSING CHECKLIST.
 *
 * The reference sheet pins this card to the BOTTOM of the step panel, above a top border and
 * below everything else (`mt-auto pt-4 border-t`), wearing the same amber left edge the
 * outside-changes card wears. Its rows are jumps: a label and a chevron.
 *
 * ── ⚠ WHAT IT MAY CLAIM IS ARGUED IN `stepReadinessContext.ts`, NOT HERE ────────────────
 *
 * This component renders whatever `stepGaps()` returns and computes nothing of its own. That
 * split is deliberate: the risky part of a checklist is not its markup, it is the CLAIM that
 * something is missing, and a claim wants a home that can be tested without a DOM. Two rows
 * the sketch itself draws are refused there, with reasons.
 *
 * ── ⚠ THE ROWS ARE REAL CONTROLS, AND THE CHEVRON IS NOT THE CONTROL ────────────────────
 *
 * `199-03` planted a live `<a href="/publish?force=1">` inside a guarded surface and watched a
 * `?raw` source regex AND a `queryAllByRole("button")` filter BOTH pass green — a button scan
 * cannot see a link. The lesson taken here is the constructive half: each row is a real
 * `<button type="button">` whose ACCESSIBLE NAME is the whole ask, and the chevron is
 * `aria-hidden` decoration on it. A row that were a bare `<div>` with a chevron would be a
 * control that looks pressable and is not — the dead control SPEC Req 5 forbids.
 *
 * ⚠ THE GLYPH IS `›`, NEVER `chevron_right`. The sheet draws its marks as Material Symbols
 * ligature names and every one of them is forbidden as visible text here — `PhaseFormPanel.test.tsx`
 * scans rendered TEXT NODES for exactly that class of literal, `chevron_right` included, with
 * a permanent planted control proving the scan can fire.
 *
 * ── ⚠ IT HOLDS NO STATE, AND THE JUMP IS NOT A ROUTE ────────────────────────────────────
 *
 * The app has no url router (`SEED-185`), so a jump is a scroll inside the panel's own
 * scroll container and nothing else. `scrollIntoView` is called defensively — the anchor is a
 * card that may legitimately not be rendered on this step type, and an optional chain is the
 * difference between "the jump did nothing" and "the panel threw".
 *
 * ⚠ AND THE `mousedown` SUPPRESSION IS LOAD-BEARING — the 184-11 trap, two controls over. The
 * panel's persist seam is a field's `onBlur`, so a press here would blur whatever field had
 * focus and silently PATCH a version. Being shown where to go is not an edit.
 */
import type { StepGap } from "./stepReadinessContext"
import { stillMissingHeading } from "./stepReadinessContext"

export interface StepReadinessProps {
  gaps: StepGap[]
}

export function StepReadiness({ gaps }: StepReadinessProps) {
  // ⚠ NOTHING AT ZERO. Never `0 things still missing`, never an "all set" — see the leaf.
  if (gaps.length === 0) return null

  return (
    <div data-testid="step-readiness" className="mt-4 border-t border-border pt-4">
      <div className="flex flex-col gap-2 rounded border border-l-2 border-border border-l-warning bg-background p-3">
        <h4 className="text-[12px] font-semibold text-foreground">
          {stillMissingHeading(gaps.length)}
        </h4>
        <div className="flex flex-col">
          {gaps.map((gap) => (
            <button
              key={gap.id}
              type="button"
              data-testid="step-readiness-row"
              data-gap={gap.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                document
                  .getElementById(gap.anchorId)
                  ?.scrollIntoView({ block: "start", behavior: "smooth" })
              }}
              className="flex items-center justify-between gap-2 rounded px-1 py-1 text-left text-[12px] text-foreground hover:bg-accent/40 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <span className="min-w-0 flex-1">{gap.label}</span>
              <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                ›
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default StepReadiness
