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
 * Three placement wrappers over identical segment markup (the build-once rule):
 *   - `placement="header"`      — the inline header chip RunCard hosts. Per sketch
 *                                 014 (.status-strip) this is a rounded-full PILL —
 *                                 subtle bg + 1px border + vertical divider bars
 *                                 between segments (GAP-095-03 MED chip chrome,
 *                                 Plan 07). It used to render bare middot text.
 *   - `placement="header-bare"` — the SAME segment markup with NO pill chrome (plain
 *                                 muted text). Used when the strip is embedded INSIDE
 *                                 another pill (the floating "↓ Jump to live" chip in
 *                                 MessageList) — the host already supplies the pill, so
 *                                 a second `header` pill here would double-frame
 *                                 (WR-01, code-review 095). Pre-Plan-07 `header`
 *                                 behavior, preserved as its own name.
 *   - `placement="floating"`    — the bottom live-chip styling (Plan 04's
 *                                 scroll-away "↓ Jump to live" home).
 *
 * Both homes share ONE segment markup; only the wrapper className differs. The
 * segment separators are 1px vertical divider bars (the sketch `.divider`), NOT
 * `·` middots (replaced in Plan 07 — GAP-095-03 MED).
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
  placement: "header" | "header-bare" | "floating"
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
        // Plan 07 (GAP-095-03 MED chip chrome): the header placement is now a
        // rounded-full PILL — subtle bg + 1px border (the sketch `.status-strip`),
        // not bare middot text. `header-bare` is the plain-segment variant for
        // embedding inside another pill (the floating chip — WR-01). The floating
        // branch keeps its own pill chrome.
        placement === "header-bare"
          ? "text-muted-foreground"
          : placement === "header"
            ? "rounded-full border border-border bg-[hsl(220_30%_11%/0.8)] px-2.5 py-1 text-muted-foreground"
            : "rounded-full border border-primary/40 bg-popover/92 px-3 py-1.5 shadow-lg backdrop-blur-md",
        isDone && "text-success",
      )}
    >
      {/* ⏱ elapsed — always present whenever RunCard passes a label (start-ts parses) */}
      <span className="flex items-center gap-1" aria-live="polite">
        <span aria-hidden="true">⏱</span>
        <span>{elapsedLabel}</span>
      </span>

      {/* divider bar — replaces the old `·` middot (sketch `.divider`) */}
      <span aria-hidden="true" className="h-3 w-px bg-border/60" />

      {/* Step N — the D-04 unifiedStepCount, identical to the header/collapsed-row */}
      <span>Step {stepCount}</span>

      {/* activity verb — only while live; the bouncing dot signals motion */}
      {activityVerb && (
        <>
          <span aria-hidden="true" className="h-3 w-px bg-border/60" />
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
