/**
 * Phase 217 Plan 10 Task 2 — DocumentChunksSection (LIB-04 / D-217-04 / D-217-08).
 *
 * The chunks the agent ACTUALLY SEARCHES. `document_chunks.content` has been stored since
 * migration `002:24` and nothing in the browser could reach it until `217-02` shipped
 * `GET /documents/{id}/chunks`. The list is read-only on purpose: it exists so a person
 * can see what the retriever sees, not so they can edit it.
 *
 * ⭐ `embedding_model` IS PER CHUNK, AND THAT IS THE WHOLE REASON THIS SECTION EXISTS AT
 * ALL RATHER THAN A DOCUMENT-LEVEL LABEL (D-217-08). A re-embed walks the chunks; halfway
 * through, one document holds chunks written with the OLD model and chunks written with
 * the NEW one, and that fact is invisible everywhere else in the product. So the model
 * rides every row and a chunk written with a different model must be visibly
 * distinguishable from its neighbour — which is why the model chip is rendered
 * unconditionally per chunk rather than hoisted to a header when the values agree.
 *
 * ⛔ Lazy by construction: the mount in `DocumentDetailPanel` is `defaultOpen={false}` and
 * `PanelSection.tsx:94` renders children only when open, so this component is not
 * constructed until the accordion is clicked. It fetches in a plain `useEffect` — which
 * is safe ONLY because of that, and would be the eager-fetch trap without it.
 *
 * ⚠ UNTRUSTED CONTENT. A chunk is a slice of a file somebody uploaded. It renders as a
 * React text child, which escapes. No raw-HTML injection prop appears in this file and
 * none may be added (T-217-37). ⚠ Its name is deliberately NOT spelled here — a source
 * fence greps the whole file for the literal, so prose about the rule would trip it.
 *
 * a11y: loading `role="status" aria-live="polite"`, error `role="alert"` + *Try again*,
 * and an empty arm whose sentence is DIFFERENT from the error's (D-117-10). Panel-scoped
 * AA tokens throughout, never the global muted.
 *
 * Phase 283 (FIX-08, BUG-260908-01, D-16..D-20, 2026-10-15): the list is bounded at max-h-96
 * inside a labelled role=region with tabIndex 0, so a 1,000-chunk document no longer buries
 * the sections below; no overscroll containment, so wheel at the list end chains to the
 * panel; ~~one Tab stop (the bodies stay unfocusable)~~; the count stays in the section header.
 * ~~Above 1,000 chunks the header count is the PostgREST cap, which is Phase 284.~~
 *
 * ⭐ CORRECTED BY 284-03 (FIX-11 / D-17 / UI-SPEC S9; the 283 sentence is struck through above,
 * not deleted). `GET /documents/{id}/chunks` now answers ONE page with the server's EXACT total,
 * so the header count is the document's (a 2,500-chunk document reads 2,500). The list asks for
 * 200 at a time: a non-focusable sentinel after the last chunk is watched by an
 * IntersectionObserver whose root is the bounded region, and the next 200 are appended when it
 * scrolls into view — by wheel, trackpad, touch or the focused region's keys alike. ⛔ There is
 * NO "show all" and NO "load more" control (the Phase 283 rule); the only focusable element ever
 * added inside the region is the failed-page "Try again".
 *
 * ⚠ CORRECTED 2026-10-16 (283-REVIEW CR-01; the original claim is struck through above, not
 * deleted). "One Tab stop" was FALSE in the target browsers while each chunk body carried its
 * own `max-h-32 overflow-auto` cap: Chrome 130+ ("keyboard-focusable scrollers") and Firefox
 * put an overflowing scroll container with no focusable children into the Tab order, and the
 * live drive measured 736 of 764 bodies overflowing — up to 736 Tab stops inside the list.
 * The jsdom fence was green throughout because jsdom has no layout. The per-chunk cap is
 * REMOVED: each chunk shows its full text, and the region is the only scroll container, so
 * it is one Tab stop and its whole content stays keyboard-scrollable. (`tabIndex={-1}` on the
 * bodies was rejected: it would leave overflowing chunk text unreachable by keyboard.)
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { listDocumentChunksPage } from "@/lib/api"
import type { DocumentChunkRow } from "@/types"

/** One page of chunks (the route's default; its max is 500). */
const CHUNK_PAGE = 200

export interface DocumentChunksSectionProps {
  /** The open document — the subject of the read. */
  docId: string
  /** Lift the chunk count so the parent `PanelSection` can badge it. */
  onTotalChange?: (total: number) => void
}

type LoadState = "loading" | "ready" | "error"

export function DocumentChunksSection({ docId, onTotalChange }: DocumentChunksSectionProps) {
  const [rows, setRows] = useState<DocumentChunkRow[]>([])
  const [state, setState] = useState<LoadState>("loading")
  /** The server's exact chunk count (the header's number, D-17). */
  const [total, setTotal] = useState(0)
  /** The next page: idle, in flight, or failed (UI-SPEC S9). */
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle")
  // Bumped on every first-page read, so an answer for a previous document is dropped (T-284-21).
  const genRef = useRef(0)
  const pagingRef = useRef(false)
  const [region, setRegion] = useState<HTMLDivElement | null>(null)
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null)

  /** Keyed on `docId` — switching documents re-reads rather than leaving the previous
   *  document's chunks under a new filename. */
  const load = useCallback(async () => {
    const gen = ++genRef.current
    pagingRef.current = false
    setState("loading")
    setRows([])
    setMore("idle")
    try {
      const res = await listDocumentChunksPage(docId, { offset: 0, limit: CHUNK_PAGE })
      if (gen !== genRef.current) return
      setRows(res.chunks)
      setTotal(res.total)
      setState("ready")
      onTotalChange?.(res.total)
    } catch {
      if (gen === genRef.current) setState("error")
    }
  }, [docId, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  const loaded = rows.length
  /** The next 200 — only while fewer than the total are loaded, and one page at a time. */
  const loadMore = useCallback(async () => {
    if (pagingRef.current || loaded >= total) return
    pagingRef.current = true
    const gen = genRef.current
    setMore("loading")
    try {
      const res = await listDocumentChunksPage(docId, { offset: loaded, limit: CHUNK_PAGE })
      if (gen !== genRef.current) return
      setRows((prev) => [...prev, ...res.chunks])
      // An empty page while the total says more would loop forever: believe the page.
      setTotal(res.chunks.length === 0 ? loaded : res.total)
      setMore("idle")
    } catch {
      if (gen === genRef.current) setMore("error")
    } finally {
      if (gen === genRef.current) pagingRef.current = false
    }
  }, [docId, loaded, total])

  // The sentinel scrolling into view (root = the region) asks for the next page. Re-made after
  // every page, so a sentinel that is STILL in view after an append keeps loading. Guarded:
  // jsdom and old engines have no IntersectionObserver (TocPill's rule).
  useEffect(() => {
    if (!region || !sentinel || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { root: region },
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [region, sentinel, loadMore])

  const allLoaded = loaded >= total
  const regionName = `Chunk list, ${total.toLocaleString()} ${total === 1 ? "chunk" : "chunks"}${
    allLoaded ? "" : `, ${loaded.toLocaleString()} loaded`
  }`

  return (
    <div className="flex flex-col gap-3 px-4 pt-1">
      {state === "loading" && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
          <span className="sr-only">Loading chunks</span>
          <div aria-hidden="true" className="h-10 w-full animate-pulse rounded-md bg-border/30" />
          <div aria-hidden="true" className="h-10 w-full animate-pulse rounded-md bg-border/30" />
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2 py-1">
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            Couldn&rsquo;t load this document&rsquo;s chunks
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="self-start rounded-md text-xs text-panel-muted-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && rows.length === 0 && (
        // Calm, and a DIFFERENT claim from the error above — nothing failed, this
        // document has simply not been split into anything searchable (D-117-10).
        <p className="py-1 text-sm text-panel-muted-foreground">
          This document has no indexed chunks
        </p>
      )}

      {state === "ready" && rows.length > 0 && (
        <div
          ref={setRegion}
          role="region"
          aria-label={regionName}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1.1: a scrollable region must be keyboard-reachable (axe scrollable-region-focusable); labelled, and not a focus trap
          tabIndex={0}
          className="max-h-96 overflow-y-auto rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <ChunkRowView key={row.id} row={row} />
            ))}
          </ul>
          {/* 284-03 (S9): the end of the list. Non-focusable, unlabelled — it is a scroll
              position, not a control. Present only while there is more to load. */}
          {!allLoaded && more === "idle" && <div ref={setSentinel} aria-hidden="true" className="h-px" />}
          {more === "loading" && (
            <div role="status" aria-live="polite" className="flex flex-col gap-2 pt-2">
              <span className="sr-only">Loading more chunks</span>
              <div aria-hidden="true" className="h-10 w-full animate-pulse rounded-md bg-border/30" />
            </div>
          )}
          {more === "error" && (
            <div className="flex flex-col gap-2 pt-2">
              <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
                Couldn&rsquo;t load more chunks
              </p>
              <button
                type="button"
                onClick={() => void loadMore()}
                className="self-start rounded-md text-xs text-panel-muted-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** One chunk: its index, the model it was written with, and its text.
 *
 *  ⚠ The model chip renders on EVERY row, including when every row agrees. Collapsing it
 *  into a section header when the values match would make the mid-re-embed split — the
 *  only reason this data is per-chunk — visible exactly when it does not matter and
 *  invisible in the case it was put here for. */
function ChunkRowView({ row }: { row: DocumentChunkRow }) {
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/40 bg-background/40 p-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[0.7rem] font-semibold text-panel-muted-foreground">
          #{row.chunk_index}
        </span>
        {row.embedding_model ? (
          <span className="ml-auto truncate rounded-full border border-border/50 px-2 py-0.5 font-mono text-[0.65rem] text-panel-muted-foreground">
            {row.embedding_model}
            {row.embedding_dimensions != null && (
              <span className="text-panel-muted-foreground-dim"> · {row.embedding_dimensions}d</span>
            )}
          </span>
        ) : (
          // Honest absence — a chunk with no recorded model is NOT a chunk written with
          // the current one, and must not borrow its name.
          <span className="ml-auto rounded-full border border-border/50 px-2 py-0.5 text-[0.65rem] italic text-panel-muted-foreground-dim">
            model not recorded
          </span>
        )}
      </div>
      {/* ⛔ A React text child — untrusted chunk text escapes here. No innerHTML.
          ⛔ NO height cap and NO overflow utility on this body (283-REVIEW CR-01): the
          bounded region above is the ONE scroll container. A nested scroller here becomes
          its own Tab stop in Chrome 130+ and Firefox once its text overflows. */}
      <p className="whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-relaxed text-foreground">
        {row.content}
      </p>
    </li>
  )
}

export default DocumentChunksSection
