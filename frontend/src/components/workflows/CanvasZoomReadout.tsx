/**
 * Phase 200 (the builder-canvas port, FE-WIRING) — THE ZOOM READOUT.
 *
 * `.planning/sketches/200-journey-interactive/screens/builder-canvas.html:379-393` draws the
 * plane's floating control cluster as `−  100%  +  │  fit  lock`. Five of those six atoms
 * ship: they are `<Controls>`'s own buttons. The `100%` did not — `grep -n
 * "100%\|getZoom\|zoomLevel" WorkflowCanvas.tsx` returned **0**, so a canvas that clamps zoom
 * between `0.3` and `2` (`WorkflowCanvas.tsx` `minZoom` / `maxZoom`) never said which of that
 * range it was currently in. A person who had zoomed out to find a step had no way to know how
 * far, and no number to zoom back TO.
 *
 * ── WHY A LEAF AND NOT A BLOCK INSIDE THE CANVAS ────────────────────────────────────────
 *
 * `WorkflowCanvas.tsx` is a G-5-firing hot file (`CLAUDE.md`'s ledger) and this is a genuinely
 * separate concern: it subscribes to the viewport, which the canvas body does not. Keeping it
 * out means the canvas gains one JSX child and no new hook — the `FieldGuidance.tsx` /
 * `ToolChoiceSet.tsx` precedent, applied to the plane.
 *
 * ── ⚠ IT READS THE VIEWPORT, IT NEVER WRITES IT ─────────────────────────────────────────
 *
 * A `<span>`: no control, no handler, no tab index. One tab stop per node is a canvas-level
 * invariant and the two zoom BUTTONS beside this readout are the library's own — this adds no
 * third. `useViewport` is the reactive read (`getZoom()` off `useReactFlow()` is a snapshot
 * taken at render and would go stale the moment anyone scrolled), which is what makes the
 * number track a pinch, a wheel and a `fit view` alike rather than only a button press.
 *
 * ── ⚠ THE NUMBER IS ROUNDED, AND ROUNDING IS NOT FABRICATING ────────────────────────────
 *
 * `fitView` lands on arbitrary reals (`0.8163…`), and a readout with four decimal places is
 * noise in the design language's own terms. It is rounded to a whole percent — a presentation
 * choice over a value that genuinely exists, which is a different act from printing a number
 * for a fact nobody supplied. Nothing reads it back: the viewport stays the single source of
 * truth and this element never writes to it.
 */
import { useViewport } from "@xyflow/react"

/** The one home for the readout's shape, so the format has a single spelling. */
export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`
}

export function CanvasZoomReadout() {
  const { zoom } = useViewport()
  return (
    <span
      data-testid="canvas-zoom-readout"
      // `aria-hidden` is DELIBERATELY NOT set, unlike the connection legend beside it. The
      // legend is a key to a visual encoding and is therefore genuinely decorative; a zoom
      // level is a fact about the current view that a low-vision reader has MORE use for than
      // a sighted one, not less.
      className="block px-1 py-0.5 text-center font-mono text-[10px] leading-none text-muted-foreground"
    >
      {zoomPercent(zoom)}
    </span>
  )
}

export default CanvasZoomReadout
