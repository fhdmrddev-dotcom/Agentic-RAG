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

/** The ⓘ hint — reveals the plain helper on hover or keyboard focus. Mirrors
 *  PhaseFormPanel's InfoHint shape (native `title` + tabbable, labelled span). */
function InfoHint({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      role="img"
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
