/**
 * Phase 217 Plan 10 Task 2 — DocumentContentSection (LIB-04 / D-217-04 / D-217-08).
 *
 * The document's own parsed text, on the screen for the first time. `full_markdown` has
 * been written by the pipeline's terminal step since the beginning and NOTHING in the
 * browser could reach it until `217-02` put `GET /documents/{id}/content` on the wire.
 *
 * This is ONE section inside the EXISTING Phase 112 `DocumentDetailPanel` — not a new
 * surface — and it follows `RelationshipsSection`'s section-owns-its-fetch pattern
 * (`LoadState`, a keyed `useCallback` load, an `onTotalChange` lift for the count badge,
 * four honest arms). Two things about it are DELIBERATELY different from that model:
 *
 *  1. ⛔ IT DOES NOT FETCH ON MOUNT, AND THAT IS THE ENTIRE POINT. `PanelSection` renders
 *     its children only when open (`PanelSection.tsx:94`), so the mount in
 *     `DocumentDetailPanel` carries `defaultOpen={false}` and this component is not
 *     constructed at all until the accordion is clicked. The lazy mechanism is FREE —
 *     there is no `onOpenChange` prop to hang a fetch off, and adding one would be the
 *     wrong shape. A megabyte of parsed text must never ride a document being opened.
 *  2. ⛔ THE TEXT ARRIVES UNNUMBERED AND STAYS THAT WAY. `read_path` glues `42: ` onto
 *     every line for the AGENT, which needs addressable lines to cite; `217-02` gave it
 *     `numbered=False` for this route because a person reading their own document must
 *     not get that, and it breaks Markdown rendering outright (D-217-05). Adding
 *     numbering here would undo the decision at the other end of the wire.
 *
 * ⚠ UNTRUSTED CONTENT. Every character here came out of a file somebody uploaded. It is
 * rendered as a React text child, which escapes. No raw-HTML injection prop appears in
 * this file and none may be added (T-217-37).
 *
 * ⚠ This docblock deliberately does NOT spell that prop's name: a source fence greps the
 * whole file for the literal, so prose ABOUT the rule trips the rule. Measured here, not
 * feared — the fence caught this paragraph's first draft (the same 187-24 trap recorded
 * in `lib/api/documents.ts`).
 *
 * Paging is the SERVER's arithmetic, not ours: the envelope reports the `end_line` that
 * was actually served and a `has_more` flag, so *Load more* asks for `end_line + 1`
 * onward and never re-derives whether there is more to ask for.
 *
 * a11y: loading is `role="status" aria-live="polite"`; error is `role="alert"` and is
 * VISUALLY DISTINCT from the empty arm (D-117-10 — "we couldn't load it" and "it has no
 * text" are different claims and must not share a rendering). All meaningful copy uses
 * the panel-scoped AA token, never the global muted (3.59:1 — see the panel's docblock).
 */
import { useCallback, useEffect, useState } from "react"
import { getDocumentContent } from "@/lib/api"
import type { DocumentContentResponse } from "@/types"

export interface DocumentContentSectionProps {
  /** The open document — the subject of the read. */
  docId: string
  /** The ingestion engine that produced this text (D-217-08). It is already on the row
   *  the panel holds, so naming the provenance costs no extra request. */
  extractor?: string | null
  /** Lift the document's total line count so the parent `PanelSection` can badge it. */
  onTotalChange?: (total: number) => void
}

type LoadState = "loading" | "ready" | "error"

export function DocumentContentSection({
  docId,
  extractor,
  onTotalChange,
}: DocumentContentSectionProps) {
  const [text, setText] = useState("")
  const [envelope, setEnvelope] = useState<DocumentContentResponse | null>(null)
  const [state, setState] = useState<LoadState>("loading")
  // A *Load more* fetch in flight — distinct from the first load, so appending a page
  // does not blank the text already on screen.
  const [appending, setAppending] = useState(false)
  // ⚠ A failed CONTINUATION is its own state, NOT `state = "error"`. Flipping the load
  // state would unmount the pages already read (the `ready && text.length > 0` arm below
  // is what renders them) — so the reader would lose text they were already looking at
  // because page 4 of 13 timed out. This flag lets the text stay and the failure still
  // be said out loud.
  const [appendError, setAppendError] = useState(false)

  /** The first page. Keyed on `docId` so switching documents re-reads rather than
   *  showing the previous document's text under a new filename. */
  const load = useCallback(async () => {
    setState("loading")
    setText("")
    setEnvelope(null)
    try {
      const res = await getDocumentContent(docId)
      setText(res.content)
      setEnvelope(res)
      setState("ready")
      onTotalChange?.(res.total_lines)
    } catch {
      // Honest error — a DIFFERENT thing from a document with no text (D-117-10).
      setState("error")
    }
  }, [docId, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

  /** Ask for the next page. The server told us where its last one ended; we do not
   *  re-derive it, and we do not guess the page size. */
  const loadMore = useCallback(async () => {
    if (!envelope?.has_more || envelope.end_line == null) return
    setAppending(true)
    setAppendError(false)
    try {
      const next = await getDocumentContent(docId, { startLine: envelope.end_line + 1 })
      setText((prev) => (prev ? `${prev}\n${next.content}` : next.content))
      setEnvelope(next)
      onTotalChange?.(next.total_lines)
    } catch {
      // A failed CONTINUATION must not throw away the pages already read — the text
      // stays and `state` is untouched; the inline alert below explains why there is
      // no more of it.
      setAppendError(true)
    } finally {
      setAppending(false)
    }
  }, [docId, envelope, onTotalChange])

  const isEmpty = state === "ready" && text.length === 0

  return (
    <div className="flex flex-col gap-3 px-4 pt-1">
      {state === "loading" && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
          <span className="sr-only">Loading document text</span>
          <div aria-hidden="true" className="h-3 w-full animate-pulse rounded bg-border/30" />
          <div aria-hidden="true" className="h-3 w-11/12 animate-pulse rounded bg-border/30" />
          <div aria-hidden="true" className="h-3 w-4/5 animate-pulse rounded bg-border/30" />
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2 py-1">
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            Couldn&rsquo;t load this document&rsquo;s text
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

      {isEmpty && (
        // Calm, and a DIFFERENT sentence from the error above: nothing failed, this file
        // simply produced no text when it was read (D-117-10).
        <p className="py-1 text-sm text-panel-muted-foreground">
          No text was extracted from this file
        </p>
      )}

      {state === "ready" && text.length > 0 && (
        <>
          {/* ⛔ A React text child. Untrusted document content escapes here and nowhere
              else — no innerHTML, no markdown renderer, no line numbers glued on. */}
          <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/40 bg-background/40 p-3 font-mono text-[0.72rem] leading-relaxed text-foreground">
            {text}
          </pre>

          {/* A failed *Load more* — the text above survives; only the continuation
              failed, and saying so is the difference between an honest surface and one
              that silently stops paging. */}
          {appendError && (
            <p role="alert" className="text-xs text-[hsl(0_80%_80%)]">
              Couldn&rsquo;t load the next part &mdash; please try again.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {envelope != null && (
              <span className="text-[0.7rem] text-panel-muted-foreground-dim">
                {envelope.has_more
                  ? `Showing ${envelope.end_line ?? 0} of ${envelope.total_lines} lines`
                  : `${envelope.total_lines} lines`}
              </span>
            )}
            {/* D-217-08 — the provenance of this text. Which engine read the file changes
                what the text IS, so it belongs beside the text rather than only in the
                metadata section. */}
            {extractor && (
              <span className="text-[0.7rem] text-panel-muted-foreground-dim">
                Read by <span className="font-mono">{extractor}</span>
              </span>
            )}
            {envelope?.has_more && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={appending}
                className="ml-auto rounded-md text-xs text-panel-muted-foreground underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                {appending ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DocumentContentSection
