/**
 * Phase 153 Plan 04 (CITE-01) — the click-through hover-peek → click-to-pin
 * popover (075-A winner A). A pure presentational + interaction layer over the
 * provider-uniform `citations` set; the marker that drives it lands in 153-05.
 *
 * Given a citation + an anchor rect + the pinned state, `CitationPeek` renders a
 * positioned card (portaled to `document.body` for z-index safety):
 *
 *   - Chunk variant (SC#2): head `[n] {filename}` (+ `(v{n})` when version > 1),
 *     the `passage` as an italic muted snippet, and a footer `{loc}` (Chunk N ·
 *     similarity 2dp) left + `↗ Open document` right.
 *   - Full-doc variant (D-10, `is_full_doc`): head + a "Full document — no single
 *     passage" affordance line (NO snippet), footer `↗ Open document` only (no
 *     loc/score) — reuses the same is_full_doc branch shape as CitationCard.
 *   - Calm degrade (D-04): a null/short passage on a chunk citation renders head +
 *     Open document with the snippet omitted — NEVER an error banner or red text.
 *
 * A11y (UI-SPEC §Accessibility — feeds Phase 155): the peek is NON-BLOCKING —
 * when pinned it is `role="dialog" aria-modal="false"` labelled by its head (no
 * focus trap that dead-ends); Esc calls onClose (the parent marker restores focus
 * in 153-05); the pin toggle carries a state-toggled accessible name
 * (`Pin citation {n}` ↔ `Unpin citation {n}`). Meaningful muted text uses
 * `--muted-foreground` (never the `--muted-foreground-dim` ~3.6:1 trap).
 *
 * Surface tokens mirror `components/ui/tooltip.tsx` (`bg-popover`/`border`/
 * `shadow`); sizing/positioning follow UI-SPEC §"Click-through Contract". No new
 * package — `createPortal` is from react-dom, icons are the vendored lucide set.
 */
import { useEffect, useId } from "react"
import { createPortal } from "react-dom"
import { ArrowUpRight, Pin } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Citation } from "@/types"
import { useCitationNav } from "@/lib/citationNav"

/** Peek width (UI-SPEC: 320px). */
const PEEK_WIDTH = 320
/** Right-edge clamp margin (UI-SPEC: `left = min(markerRect.left, vw − 340)`). */
const VIEWPORT_MARGIN = 340
/** Vertical offset below the marker (UI-SPEC: `markerRect.bottom + scrollY + 8`). */
const VERTICAL_OFFSET = 8
/** Minimum left inset so the card never runs off the left edge on mobile. */
const MIN_LEFT = 8

/** The anchor rect the peek positions against — only `bottom`/`left` are read. */
export type CitationAnchorRect = Pick<DOMRect, "bottom" | "left">

export interface CitationPeekProps {
  /** The citation this peek surfaces (chunk or full-doc). */
  citation: Citation
  /** 1-based footer number, keyed 1:1 to the in-text marker (D-03). */
  n: number
  /** The marker's bounding rect — drives absolute positioning. */
  anchorRect: CitationAnchorRect
  /** Whether the peek is pinned (persists; role=dialog; primary ring). */
  pinned: boolean
  /** Toggle the pinned state (called by the pin control). */
  onPin: () => void
  /** Close/unpin the peek (Esc / the parent marker restores focus in 153-05). */
  onClose: () => void
}

export function CitationPeek({
  citation,
  n,
  anchorRect,
  pinned,
  onPin,
  onClose,
}: CitationPeekProps) {
  const nav = useCitationNav()
  const headId = useId()

  // Esc closes/unpins — the parent marker (153-05) restores focus. Non-blocking:
  // no focus trap (aria-modal="false"); we only listen for Escape while mounted.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  // Positioning (UI-SPEC §Click-through Contract). Absolute, document-relative
  // (top includes scrollY); left clamps to the viewport so the card stays on-screen.
  const viewportWidth =
    typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1024
  const scrollY = typeof window !== "undefined" ? window.scrollY : 0
  const top = anchorRect.bottom + scrollY + VERTICAL_OFFSET
  const left = Math.max(MIN_LEFT, Math.min(anchorRect.left, viewportWidth - VIEWPORT_MARGIN))

  const versionSuffix =
    citation.version_number != null && citation.version_number > 1
      ? ` (v${citation.version_number})`
      : ""

  // Passage present only when it is a non-empty, non-whitespace string — a null
  // OR short/blank passage degrades to the calm path (D-04), never an error.
  const hasSnippet = !!citation.passage && citation.passage.trim().length > 0

  // Chunk location (reuses the CitationCard is_full_doc branch shape, D-09/D-10):
  // "Chunk N" (1-based) + similarity (2dp) — only for a chunk citation.
  const loc =
    citation.chunk_index != null
      ? `Chunk ${citation.chunk_index + 1}${
          citation.similarity != null ? ` · ${citation.similarity.toFixed(2)}` : ""
        }`
      : ""

  const card = (
    <div
      // Pinned → a non-blocking labelled dialog (aria-modal="false" = no trap).
      role={pinned ? "dialog" : undefined}
      aria-modal={pinned ? "false" : undefined}
      aria-labelledby={pinned ? headId : undefined}
      style={{ position: "absolute", top, left, width: PEEK_WIDTH, zIndex: 60 }}
      className={cn(
        "citation-peek rounded-[10px] border bg-popover px-3.5 py-3 text-popover-foreground shadow-lg",
        // Enter motion mirrors ui/tooltip.tsx; dropped under reduced motion.
        "animate-in fade-in-0 slide-in-from-top-1 duration-100 motion-reduce:animate-none",
        // Pinned accent ring (--primary reserved) — structural, not colour-alone.
        pinned && "border-primary/35 ring-1 ring-primary/35",
      )}
    >
      {/* Head: [n] {filename} + pin toggle */}
      <div className="flex items-center gap-1.5">
        <span
          id={headId}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-semibold"
        >
          {/* [n] — mono, --primary (accent reserved), keyed 1:1 to the marker (D-03) */}
          <span className="shrink-0 font-mono text-primary" aria-hidden="true">
            [{n}]
          </span>
          <span className="truncate">
            {citation.filename}
            {versionSuffix}
          </span>
        </span>
        {/* Pin toggle — icon-only, so it MUST carry a state-toggled accessible
            name (UI-SPEC Dimension 2 fix). --primary only in the pinned state. */}
        <button
          type="button"
          onClick={onPin}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin citation ${n}` : `Pin citation ${n}`}
          className={cn(
            "shrink-0 rounded p-1 transition-colors",
            pinned ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Pin className={cn("h-3.5 w-3.5", pinned && "fill-current")} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      {citation.is_full_doc ? (
        // D-10: full-doc affordance — NO snippet, NO similarity score.
        <p className="mt-1.5 text-xs text-muted-foreground">Full document — no single passage</p>
      ) : hasSnippet ? (
        <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">
          {citation.passage}
        </p>
      ) : null}

      {/* Footer: divider + {loc} left + ↗ Open document right. A full-doc peek or
          a calm-degraded chunk peek shows Open document only (empty loc). */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">
          {!citation.is_full_doc ? loc : ""}
        </span>
        <button
          type="button"
          onClick={() => nav.openDocument(citation.document_id)}
          className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary hover:underline"
        >
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          Open document
        </button>
      </div>
    </div>
  )

  if (typeof document === "undefined") return card
  return createPortal(card, document.body)
}
