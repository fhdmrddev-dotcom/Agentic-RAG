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
 */
import { useCallback, useEffect, useState } from "react"
import { listDocumentChunks } from "@/lib/api"
import type { DocumentChunkRow } from "@/types"

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

  /** Keyed on `docId` — switching documents re-reads rather than leaving the previous
   *  document's chunks under a new filename. */
  const load = useCallback(async () => {
    setState("loading")
    setRows([])
    try {
      const res = await listDocumentChunks(docId)
      setRows(res)
      setState("ready")
      onTotalChange?.(res.length)
    } catch {
      setState("error")
    }
  }, [docId, onTotalChange])

  useEffect(() => {
    void load()
  }, [load])

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
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <ChunkRowView key={row.id} row={row} />
          ))}
        </ul>
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
      {/* ⛔ A React text child — untrusted chunk text escapes here. No innerHTML. */}
      <p className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-relaxed text-foreground">
        {row.content}
      </p>
    </li>
  )
}

export default DocumentChunksSection
