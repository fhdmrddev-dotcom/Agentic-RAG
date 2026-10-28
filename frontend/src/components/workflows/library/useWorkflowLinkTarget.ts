import { useEffect, useRef } from "react"
import type { LibraryRow } from "./libraryRow"

/** How long a linked card stays marked after it is focused (UI-SPEC: two seconds). */
export const LINK_TARGET_MARK_MS = 2000

/**
 * The mark a linked card wears while it is announced. Spelled in full HERE so Tailwind sees the
 * classes (it scans source, never runtime strings assembled elsewhere).
 */
const MARK_CLASSES = ["ring-2", "ring-primary/60", "ring-offset-2", "ring-offset-background"]

/** A drafts-feed row: only its id is read here; the page's `onOpenDraft` receives the row itself. */
interface DraftLike {
  id: string
}

export interface WorkflowLinkTargetArgs<D extends DraftLike> {
  /** The definition id the address names (`/app/workflows/<id>`), or `null`. */
  id: string | null
  /** The drafts feed's rows — each carries the opaque concurrency field the Builder needs (F6: never named here). */
  drafts: readonly D[]
  /** The merged library rows (published, starters, drafts). */
  rows: readonly LibraryRow[]
  /** 299-REVIEW WR-05: the rows the page actually RENDERS (after query, chips and project), so a
   *  card the cleared filters bring back is found without waiting for the rows to change. */
  shown: readonly LibraryRow[]
  /** True while nothing has answered yet. */
  loading: boolean
  /** The page's existing draft opener (a local state change: the Builder view, seeded). */
  onOpenDraft: (draft: D) => void
  /** The page's "clear all filters" (query, chips, project), so a linked card is not hidden. */
  clearFilters: () => void
}

/**
 * Phase 299-02 (LINK-02 / D-03; T-299-19) — OPEN A WORKFLOW FROM ITS ADDRESS.
 *
 * An OWNED DRAFT in the drafts feed opens in the Builder through the page's own `onOpenDraft`,
 * handed THE DRAFTS ROW so its opaque concurrency field travels by construction (the 186-07 rule: a
 * dropped one is a silent-clobber bug that typechecks). A VISIBLE published or starter row is
 * shown as its card: the project filter is cleared, then the card (`[data-row-id="<id>"]`) is
 * scrolled into view, focused and marked for two seconds. If the card is not rendered yet — the
 * cleared filter is still re-querying — the effect tries again when the rows change, still once.
 *
 * ⛔ IT NEVER WRITES. No client API module is imported here (the drafts row is typed
 * structurally); the only effects are a local state change, a filter reset and focus (pinned:
 * every client function stays uncalled).
 * ⛔ IT DECIDES NOTHING IT CANNOT SEE: while loading, and for an id in neither list, it does
 * nothing — "can't be opened" / "switch org" is plan 299-03's gate.
 * ⛔ IT FIRES ONCE PER ID (a ref keyed on the id), so a re-render or a refetch never re-opens the
 * Builder over the person's edits. ⛔ It never imports the page that hosts it (F4, LIBRARY_SUBTREE_PATHS).
 *
 * ⚠ CORRECTED BY 299-REVIEW WR-05 — three claims above are kept rather than deleted, because each
 * was a way the link silently did nothing:
 *   1. "the project filter is cleared, then the card is scrolled" cleared it only AFTER the row was
 *      found — but the project filter narrows the PUBLISHED feed server-side, so a workflow outside
 *      the selected project was never found. The filters are now cleared FIRST, once per id.
 *   2. Only the project filter was cleared; the search box and the chips can hide the card too.
 *      `clearFilters` is the page's clear-all, and `shown` (what is rendered) re-runs the search.
 *   3. "ONCE PER ID" held for the page's life, so Back / Forward onto the same address did nothing.
 *      The memory now resets when the address names no workflow, so re-entering it runs again.
 */
export function useWorkflowLinkTarget<D extends DraftLike>(args: WorkflowLinkTargetArgs<D>): void {
  const { loading, drafts, rows, shown } = args
  const id = args.id ? args.id.toLowerCase() : null
  const openRef = useRef(args.onOpenDraft)
  const clearRef = useRef(args.clearFilters)
  useEffect(() => {
    openRef.current = args.onOpenDraft
    clearRef.current = args.clearFilters
  })

  /** The id already handled, and the id whose filter was already cleared. */
  const handled = useRef<string | null>(null)
  const cleared = useRef<string | null>(null)

  useEffect(() => {
    if (id === null) {
      // The address left: re-entering it (Back / Forward) runs again (WR-05).
      handled.current = null
      cleared.current = null
      return
    }
    if (loading || handled.current === id) return
    const draft = drafts.find((d) => d.id.toLowerCase() === id)
    if (draft) {
      handled.current = id
      openRef.current(draft)
      return
    }
    // Cleared FIRST: a published row outside the selected project is not in `rows` until the
    // project filter is gone (WR-05).
    if (cleared.current !== id) {
      cleared.current = id
      clearRef.current()
    }
    const visible = rows.find((r) => r.id.toLowerCase() === id && r.provenance !== "draft")
    if (!visible) return
    // The id is quoted for the selector (a server id, but never trusted to be selector-safe).
    const selector = `[data-row-id="${visible.id.replace(/["\\]/g, "\\$&")}"]`
    const card = typeof document === "undefined" ? null : document.querySelector<HTMLElement>(selector)
    if (!card) return
    handled.current = id
    card.scrollIntoView({ block: "center", behavior: "smooth" })
    if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1")
    card.focus({ preventScroll: true })
    card.classList.add(...MARK_CLASSES)
    window.setTimeout(() => card.classList.remove(...MARK_CLASSES), LINK_TARGET_MARK_MS)
  }, [id, loading, drafts, rows, shown])
}
