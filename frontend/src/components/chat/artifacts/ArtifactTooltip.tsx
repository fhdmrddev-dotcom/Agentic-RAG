/**
 * Phase 292-02 (D-07 · UI-D-292-09 · I-3) — THE ONE SOURCE TOOLTIP, shared by the diagram node, the
 * comparison cell and the timeline source line.
 *
 * It shows a SERVER-resolved source `{document, page, excerpt}` — the model never wrote any of it.
 * Header: `{document truncated 40} · p.{page}` (the page segment omitted when there is none);
 * excerpt: in OUR curly quotes, truncated at 280. Both are React text, never markup.
 *
 * Placement is ANCHORED TO THE ELEMENT, never the cursor, so it is identical for mouse, keyboard and
 * touch: above the element and left-aligned with it, flipped below when fewer than 8px remain above,
 * clamped 8px inside the viewport horizontally. It renders through a portal into the page body so the
 * card's `overflow-hidden` never clips it, and it is `pointer-events-none` so it never steals the
 * hover that opened it. Escape anywhere dismisses it (WCAG 1.4.13); the owner also hides it on
 * pointerleave and blur, and links it with `aria-describedby` while it shows.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import * as ReactDOM from "react-dom"
import { FileText } from "lucide-react"
import { excerptText, sourceHeader } from "./artifactCopy"
import type { ArtifactSource } from "./artifactSpec"

/** The gap between the element and the tooltip, and the viewport margin it keeps. */
const GAP = 6
const MARGIN = 8

export interface AnchorRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Pure placement: above + left-aligned, flip below under 8px, clamp 8px inside horizontally. */
export function tooltipPosition(
  anchor: AnchorRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const above = anchor.top - tip.height - GAP
  const top = above < MARGIN ? anchor.bottom + GAP : above
  const maxLeft = viewport.width - tip.width - MARGIN
  const left = Math.max(MARGIN, Math.min(anchor.left, maxLeft))
  return { left, top }
}

export interface ArtifactTooltipProps {
  /** `{artifactId}-tip` — the anchored element points `aria-describedby` at it while it shows. */
  id: string
  anchor: HTMLElement
  source: ArtifactSource
  onDismiss: () => void
}

export function ArtifactTooltip({ id, anchor, source, onDismiss }: ArtifactTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const tip = ref.current
    if (!tip) return
    const a = anchor.getBoundingClientRect()
    const t = tip.getBoundingClientRect()
    const view = tip.ownerDocument.defaultView
    const viewport = { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 }
    const next = tooltipPosition(a, { width: t.width, height: t.height }, viewport)
    setPos((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next))
  }, [anchor, source])

  // Keep the latest callback without re-binding the listener on every render.
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    const doc = anchor.ownerDocument
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss.current()
    }
    doc.addEventListener("keydown", onKey)
    return () => doc.removeEventListener("keydown", onKey)
  }, [anchor])

  const body = anchor.ownerDocument.body
  return ReactDOM.createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      data-testid="artifact-tooltip"
      style={{ position: "fixed", left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden", zIndex: 50 }}
      className="pointer-events-none min-w-32 max-w-72 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-[1.4] shadow-lg"
    >
      <div data-testid="artifact-tooltip-header" className="flex items-center gap-1 text-muted-foreground">
        <FileText className="size-3 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{sourceHeader(source.document, source.page)}</span>
      </div>
      {source.excerpt && (
        <div data-testid="artifact-tooltip-excerpt" className="mt-1 italic text-foreground">
          {excerptText(source.excerpt)}
        </div>
      )}
    </div>,
    body,
  )
}
