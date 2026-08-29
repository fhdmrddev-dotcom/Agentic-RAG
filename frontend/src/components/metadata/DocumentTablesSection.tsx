/**
 * Phase 217 Plan 11 Task 2 — DocumentTablesSection (LIB-04 / D-217-01 / D-217-04 / D-217-06).
 *
 * The extracted tables, AS TABLES. `document_tables` has stored real `headers` and `rows`
 * jsonb since migration 108, and the only thing the product has ever shown of it is the
 * bare number in the document list's `table_count` column — which the ledger calls the
 * largest single instance of the buried-capability finding. This section is the answer.
 *
 * ⛔ SCROLL, NEVER SHED. Rendering goes through `DataTableView`, the one renderer this
 * panel has, which puts the table in a horizontal scroll container. The Library's
 * document list drops columns positionally at narrow widths and is RIGHT to — those
 * columns are redundant metadata. These columns are the user's own data.
 *
 * ⛔ Lazy by construction: the mount in `DocumentDetailPanel` is closed by default, and
 * `PanelSection.tsx:94` renders children only when open, so this component is not
 * constructed until the accordion is clicked. The bare `useEffect` fetch below is safe
 * ONLY because of that.
 *
 * ⚠ THE RLS ASYMMETRY, AND WHY AN EMPTY RESULT HERE IS CORRECT RATHER THAN A DEFECT.
 * Migration `110:215-223` widened `document_chunks` SELECT to owner-OR-globally-visible-
 * folder; `document_tables` and `document_images` were left owner-only by
 * `108:180-189`. So a document reached through SOMEONE ELSE'S shared folder returns text
 * and chunks and an EMPTY table list. The panel is not lying and must not imply a
 * permission problem: `list_documents` computes `table_count` through the SAME user-JWT
 * client, so the count badge on that row already reads `0`. The honest copy is
 * "No tables" — never "You cannot see these".
 *
 * ⭐ THREE EMPTY SITUATIONS, THREE DIFFERENT CLAIMS (manual row M-5). "the stage never
 * runs for this file type", "the stage ran and found none" and "nothing came back, and we
 * cannot tell which" are three different facts about a document, and printing one
 * sentence for all three is the spoofing risk T-217-45 names. The predicate mirrors
 * `ingestionStages.isStageSkipped` exactly, including its load-bearing rule that an
 * ABSENT flag means UNKNOWN and never `false`.
 *
 * ⚠ UNTRUSTED CONTENT. A cell is a slice of a file somebody uploaded; it renders as a
 * React text child, which escapes. The raw-HTML injection prop appears nowhere in this
 * file and none may be added (T-217-42). ⚠ Its name is deliberately not spelled here — a
 * source fence greps the whole file for the literal and cannot tell a use from a mention.
 */
import { useCallback, useEffect, useState } from "react"
import { listDocumentTables } from "@/lib/api"
import { DataTableView } from "@/components/panel/DataTableView"
import type { Document, DocumentTableRow } from "@/types"

export interface DocumentTablesSectionProps {
  /** The open document — the subject of the read. */
  docId: string
  /** The document row the panel already holds. Only the four applicability/count fields
   *  are read, and only to pick WHICH empty sentence is true. */
  doc?: Pick<Document, "tables_stage_applies" | "table_count">
  /** Lift the table count so the parent `PanelSection` can badge it. */
  onTotalChange?: (total: number) => void
}

type LoadState = "loading" | "ready" | "error"

/** The three empty claims, kept together so it is visible that they differ. */
export const TABLES_EMPTY_NOT_APPLICABLE = "This file type has no tables"
export const TABLES_EMPTY_NONE_FOUND = "No tables were extracted"
export const TABLES_EMPTY_UNKNOWN = "No tables"

/**
 * Which of the three is true for this document.
 *  - the flag is EXPLICITLY false and the count is 0 → the stage never ran for this type
 *  - the flag is explicitly true → the stage ran and produced nothing
 *  - the flag is absent → UNKNOWN (it is server-derived, so it does not ride Realtime),
 *    and the honest rendering of unknown is the plain sentence, never a claim about the
 *    pipeline we cannot support.
 */
export function tablesEmptyMessage(doc?: Pick<Document, "tables_stage_applies" | "table_count">): string {
  if (doc?.tables_stage_applies === false && (doc.table_count ?? 0) === 0) {
    return TABLES_EMPTY_NOT_APPLICABLE
  }
  if (doc?.tables_stage_applies === true) return TABLES_EMPTY_NONE_FOUND
  return TABLES_EMPTY_UNKNOWN
}

export function DocumentTablesSection({ docId, doc, onTotalChange }: DocumentTablesSectionProps) {
  const [rows, setRows] = useState<DocumentTableRow[]>([])
  const [state, setState] = useState<LoadState>("loading")

  /** Keyed on `docId` — switching documents re-reads rather than leaving the previous
   *  document's tables under a new filename. */
  const load = useCallback(async () => {
    setState("loading")
    setRows([])
    try {
      const res = await listDocumentTables(docId)
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
          <span className="sr-only">Loading tables</span>
          <div aria-hidden="true" className="h-12 w-full animate-pulse rounded-md bg-border/30" />
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-2 py-1">
          <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">
            Couldn&rsquo;t load this document&rsquo;s tables
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
        // Calm, and a DIFFERENT claim from the error above (D-117-10). Which of the three
        // sentences is printed is decided by the data, not by convenience.
        <p className="py-1 text-sm text-panel-muted-foreground">{tablesEmptyMessage(doc)}</p>
      )}

      {state === "ready" &&
        rows.length > 0 &&
        rows.map((row) => (
          <div key={row.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[0.7rem] text-panel-muted-foreground-dim">
              <span className="font-mono uppercase tracking-[0.07em]">
                Table {row.table_index + 1}
              </span>
              {row.page != null && <span>· page {row.page}</span>}
              {row.extractor && <span className="ml-auto font-mono">{row.extractor}</span>}
            </div>
            <div className="rounded-md border border-border/40 bg-background/40">
              <DataTableView
                headers={row.headers ?? []}
                rows={row.rows ?? []}
                emptyMessage="This table came back with no cells"
              />
            </div>
          </div>
        ))}
    </div>
  )
}

export default DocumentTablesSection
