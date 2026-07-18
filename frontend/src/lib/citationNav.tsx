/**
 * Phase 153 Plan 02 (CITE-01) — the shared citation-interaction contract.
 *
 * Interface-first foundation the Wave-2/3 citation plans consume BEFORE they are
 * built, so the marker↔row link and the cross-view "Open document" nav are a
 * single source of truth (no divergent attribute names across parallel plans):
 *
 *   1. `CitationNavProvider` + `useCitationNav()` — the cross-view nav hook.
 *      `openDocument(documentId)` records a one-shot pending-document intent AND
 *      fires the injected `navigate` callback with the documents view. A consumer
 *      (IngestionPage) reads the intent and routes it through the EXISTING
 *      owner/RLS-scoped `DocumentDetailPanel` fetch — SC#2 / T-153-02-01: the
 *      panel only ever opens a doc already in the user's own owner-scoped list,
 *      so there is NO new unscoped fetch by raw `document_id`.
 *   2. `flashCitationRow` / `flashCitationMarker` — the marker↔row bidirectional
 *      flash contract. A single shared `data-citation-*` attribute + flash/active
 *      class pair links markers and footer rows two-way without a shared prop.
 *   3. The exported attribute/class-name constants — imported by both the footer
 *      (153-03) and the cited markdown (153-05).
 *
 * The CSS that animates these classes lives in `index.css` (the additive citation
 * block); `prefers-reduced-motion` is owned there — these helpers only toggle the
 * class, never inline an animation.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"

// ── Shared DOM contract (the single source of truth) ─────────────────────────
/** Attribute a footer row carries: `[data-citation-row="{n}"]`. */
export const CITATION_ROW_ATTR = "data-citation-row"
/** Attribute an in-text marker carries: `[data-citation-marker="{n}"]`. */
export const CITATION_MARKER_ATTR = "data-citation-marker"
/** Class toggled on a footer row when its marker is activated (the bloom flash). */
export const CITATION_FLASH_CLASS = "citation-ref-flash"
/** Class toggled on an in-text marker when its row is activated (active-ref). */
export const CITATION_ACTIVE_CLASS = "citation-marker-active"

/** How long a flash/active class stays before auto-clearing (UI-SPEC ~1700ms). */
const FLASH_AUTOCLEAR_MS = 1700

/** The documents-view literal `openDocument` navigates to. Kept local so this
 *  module stays decoupled from App's `ActiveView` union (no import cycle). */
export type CitationTargetView = "documents"

// ── Cross-view navigation context ────────────────────────────────────────────
export interface CitationNavValue {
  /** Switch to the documents view and pre-select the cited doc (owner-scoped). */
  openDocument: (documentId: string) => void
  /** The one-shot pending document a consumer (IngestionPage) should open, or
   *  null when there is nothing pending / it has been consumed. */
  pendingDocumentId: string | null
  /** Clear the pending intent after a consumer has acted on it (so re-opening
   *  the same document, or closing the panel, is never fought). */
  consumePendingDocument: () => void
}

const CitationNavContext = createContext<CitationNavValue | null>(null)

export interface CitationNavProviderProps {
  children: ReactNode
  /** Injected by App — the real view navigator (`setActiveView`). Called with
   *  `"documents"` when a document is opened. */
  navigate?: (view: CitationTargetView) => void
  /** Optional direct doc-selector injection. The canonical wiring reads the
   *  pending intent via the hook, but a host that owns the selector may pass it
   *  here as well (belt-and-suspenders). */
  selectDocument?: (documentId: string) => void
}

/**
 * Provider mounted at the App level, wrapping BOTH the chat subtree (where the
 * citation markers live) and the documents view (which consumes the intent).
 */
export function CitationNavProvider({
  children,
  navigate,
  selectDocument,
}: CitationNavProviderProps) {
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  // Keep the injected callbacks in refs so `openDocument` stays referentially
  // stable across renders (the value is memoized on pendingDocumentId only).
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const selectDocumentRef = useRef(selectDocument)
  selectDocumentRef.current = selectDocument

  const openDocument = useCallback((documentId: string) => {
    // 1. Record the one-shot intent a consumer reads to pre-select the doc.
    setPendingDocumentId(documentId)
    // 2. Switch to the documents view.
    navigateRef.current?.("documents")
    // 3. Optional direct injection (no-op when the host reads the intent instead).
    selectDocumentRef.current?.(documentId)
  }, [])

  const consumePendingDocument = useCallback(() => {
    setPendingDocumentId(null)
  }, [])

  const value = useMemo<CitationNavValue>(
    () => ({ openDocument, pendingDocumentId, consumePendingDocument }),
    [openDocument, pendingDocumentId, consumePendingDocument],
  )

  return <CitationNavContext.Provider value={value}>{children}</CitationNavContext.Provider>
}

/**
 * The citation nav hook. Throws a clear error outside a `CitationNavProvider`
 * (leaf citation components require the provider by construction).
 */
export function useCitationNav(): CitationNavValue {
  const ctx = useContext(CitationNavContext)
  if (ctx === null) {
    throw new Error("useCitationNav must be used within a CitationNavProvider")
  }
  return ctx
}

/**
 * Non-throwing accessor — returns null outside a provider. Used by hosts (e.g.
 * IngestionPage) that must still render in isolation (unit tests / storybook)
 * where the provider is not mounted.
 */
export function useCitationNavOptional(): CitationNavValue | null {
  return useContext(CitationNavContext)
}

// ── Marker↔row flash helpers (pure DOM, scoped, integer-guarded) ─────────────
/**
 * Coerce a citation index to a positive integer, or null when invalid. Guards
 * the querySelector against non-integer / injectable input (T-153-02-02): the
 * template only ever interpolates a validated integer.
 */
function coerceIndex(n: unknown): number | null {
  const idx = typeof n === "number" ? n : Number(n)
  if (!Number.isInteger(idx) || idx < 1) return null
  return idx
}

/** Whether the user asked for reduced motion (best-effort; jsdom-safe). */
function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
  } catch {
    return false
  }
}

function flash(
  n: unknown,
  attr: string,
  cls: string,
  container: ParentNode | null | undefined,
  scroll: boolean,
): void {
  const idx = coerceIndex(n)
  if (idx === null) return
  const root: ParentNode = container ?? document
  const el = root.querySelector<HTMLElement>(`[${attr}="${idx}"]`)
  if (!el) return // missing target is a no-op, never a throw

  el.classList.add(cls)
  if (scroll && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }
  // Auto-clear so the state is transient (CSS owns the visual bloom/fade).
  window.setTimeout(() => el.classList.remove(cls), FLASH_AUTOCLEAR_MS)
}

/**
 * Flash the footer row for citation `n` (marker→row direction): scroll it into
 * view and bloom it. Scoped to `container`; a missing/invalid `n` is a no-op.
 */
export function flashCitationRow(n: number, container?: ParentNode | null): void {
  flash(n, CITATION_ROW_ATTR, CITATION_FLASH_CLASS, container, true)
}

/**
 * Flash the in-text marker for citation `n` (row→marker direction): add the
 * active-ref class. Scoped to `container`; a missing/invalid `n` is a no-op.
 */
export function flashCitationMarker(n: number, container?: ParentNode | null): void {
  flash(n, CITATION_MARKER_ATTR, CITATION_ACTIVE_CLASS, container, false)
}
