import { cn } from "@/lib/utils"

/**
 * Phase 095 Plan 02 — the ONE `⏱ elapsed · Step N · activity` run-status strip.
 *
 * SKETCH-CONSISTENCY §B + "Status strip — one component, two homes": this is the
 * SINGLE strip composed from the three honesty inputs:
 *   - `elapsedLabel`  — the D-06 stable-start-ts elapsed (computed in RunCard from
 *                       `Date.parse(message.created_at)`, frozen only at a TRUE
 *                       terminal — never gated on `elapsedMs > 0`).
 *   - `stepCount`     — `unifiedStepCount(message)` (the D-04 deduped count; the
 *                       SAME integer the RunCard header + collapsed-row read, so
 *                       the strip and the cards can never disagree).
 *   - `activityVerb`  — `outerBannerLabel(...)` while streaming, `null` when terminal.
 *
 * Two placement wrappers over identical segment markup (the build-once rule):
 *   - `placement="header"`   — the inline header chip RunCard hosts (this plan).
 *   - `placement="floating"` — the bottom live-chip styling (Plan 04's
 *                              scroll-away "↓ Jump to live" home).
 *
 * Reuse-only CSS: `font-mono`, `tabular-nums`, the `animate-dotBounce` activity
 * dot (index.css:336), `animate-pulse`. No new keyframes (SPEC out-of-scope #6).
 *
 * XSS-safe (T-095-02-01): `activityVerb` is a controlled, enum-derived string
 * (`outerBannerLabel`) rendered as React text children — never raw-HTML innerHTML.
 */
export function RunStatusStrip({
  elapsedLabel,
  stepCount,
  activityVerb,
  placement,
}: {
  elapsedLabel: string
  stepCount: number
  activityVerb: string | null
  placement: "header" | "floating"
}) {
  // `.done` modifier (not a parent selector) per the sketch: a terminal strip
  // (no activity verb) recedes to the success tone; a live strip stays primary.
  const isDone = activityVerb == null
  return (
    <div
      data-testid="run-status-strip"
      data-placement={placement}
      className={cn(
        "inline-flex items-center gap-2 font-mono text-xs whitespace-nowrap tabular-nums",
        placement === "header"
          ? "text-muted-foreground"
          : "rounded-full border border-primary/40 bg-popover/92 px-3 py-1.5 shadow-lg backdrop-blur-md",
        isDone && "text-success",
      )}
    >
      {/* ⏱ elapsed — always present whenever RunCard passes a label (start-ts parses) */}
      <span className="flex items-center gap-1" aria-live="polite">
        <span aria-hidden="true">⏱</span>
        <span>{elapsedLabel}</span>
      </span>

      <span aria-hidden="true" className="opacity-40">
        ·
      </span>

      {/* Step N — the D-04 unifiedStepCount, identical to the header/collapsed-row */}
      <span>Step {stepCount}</span>

      {/* activity verb — only while live; the bouncing dot signals motion */}
      {activityVerb && (
        <>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span className="flex items-center gap-1.5 text-primary">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-dotBounce"
            />
            <span>{activityVerb}</span>
          </span>
        </>
      )}
    </div>
  )
}
