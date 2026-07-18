/**
 * Phase 154 Plan 01 (LANG-01 / D-02, D-03) — the term-map render component.
 *
 * `<PlainLabel term="…" />` renders `usePlainLabel(term)` as an auto-escaped
 * React TEXT node — NEVER `dangerouslySetInnerHTML` (T-154-02; term-map values
 * are static literals, but the sink stays escaped by construction) — plus an
 * optional ⓘ helper affordance when `showHelper` is set and the term carries a
 * helper line.
 *
 * The ⓘ mirrors the shipped Phase-103 `InfoHint` primitive
 * (`frontend/src/components/workflows/PhaseFormPanel.tsx:88-103`): a zero-dep
 * native `title` + a tabbable, `aria-label`led span (keyboard-reachable, no
 * popover library). It is inlined here because that `InfoHint` is a file-local,
 * non-exported function and PhaseFormPanel is out of this plan's file scope —
 * this is the same visual/a11y contract, not a new mechanism (D-03: keep the ⓘ,
 * do not reinvent it).
 */
import type { TermKey } from "./termMap"
import { TERM_MAP, usePlainLabel } from "./termMap"

/** The ⓘ hint. WR-03: the plain helper is exposed two honest ways — the native
 *  `title` shows a tooltip on MOUSE hover only (evergreen browsers do NOT surface
 *  `title` on keyboard focus), and the `aria-label` supplies the accessible name a
 *  screen reader announces when the ⓘ receives focus. There is deliberately NO
 *  visual popover on keyboard focus: PlainLabel is app-wide, so a CSS popover here
 *  is layout-risky. Mirrors PhaseFormPanel's InfoHint shape (title + labelled span). */
function InfoHint({ text }: { text: string }) {
  return (
    <span
      // Phase 155 (A11Y-01): role="button" (not "img") so the focusable ⓘ hint is
      // a valid tabIndex host (jsx-a11y/no-noninteractive-tabindex). WR-03: the
      // native `title` reveals the helper visually on MOUSE hover only; the
      // aria-label carries the same text as the accessible name announced on focus
      // (no keyboard-focus visual tooltip is claimed).
      tabIndex={0}
      role="button"
      aria-label={text}
      title={text}
      className="ml-1 inline-grid h-3.5 w-3.5 cursor-help place-items-center rounded-full border border-border text-[8px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      ⓘ
    </span>
  )
}

export function PlainLabel({
  term,
  showHelper = false,
}: {
  term: TermKey
  /** When true, append the ⓘ helper affordance (if the term has a helper). */
  showHelper?: boolean
}) {
  const label = usePlainLabel(term)
  const helper = TERM_MAP[term]?.helper
  return (
    <>
      {label}
      {showHelper && helper ? <InfoHint text={helper} /> : null}
    </>
  )
}
