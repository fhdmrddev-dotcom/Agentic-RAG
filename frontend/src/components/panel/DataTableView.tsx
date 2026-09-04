/**
 * Phase 217 Plan 11 Task 1 — DataTableView (LIB-04 / D-217-01 / D-217-04 / D-217-06).
 *
 * THE one table renderer in the panel. Extracted verbatim from `CsvTablePreview.tsx`
 * (Phase 087 Plan 03) so that the CSV preview and the Library's extracted-tables section
 * share a single scroll container, a single pair of size caps and a single empty arm —
 * rather than forking three decisions that were already made once and reviewed once.
 *
 * ⛔ SCROLL, NEVER SHED. The Library's document list drops columns 3-5 by a POSITIONAL
 * CSS selector at narrow widths, and that rule is correct THERE because the hidden
 * columns (Type / Size / Chunks) are redundant metadata reachable elsewhere. An extracted
 * table's columns are the USER'S OWN DATA: shedding one deletes exactly the thing they
 * opened the panel to see. So the cells stay on one line and the container scrolls
 * horizontally. There is no positional column rule in this file and none may be added.
 * ⚠ That selector's literal is deliberately NOT spelled here: a fence greps this file for
 * it and cannot tell a use from a mention (217-10 measured that trap twice).
 *
 * SIZE CAPS (T-087-07 / T-217-43 DoS guard): both are applied BEFORE any DOM is built,
 * never by rendering-then-truncating. `document_tables.rows` is unbounded jsonb written
 * from a document nobody on our side wrote, so the same guard the CSV path has always
 * had applies unchanged to it.
 *
 * SECURITY (T-087-04 / T-217-42): every cell renders as a React text child (`{cell}`) —
 * React escapes it, so a cell containing an image tag with an inline error handler
 * renders as literal characters and creates no element. There is ZERO raw-HTML injection
 * on file content here, and the prop that would introduce it must never appear in this
 * file. ⚠ Its name is deliberately NOT spelled out in this prose: a source fence greps
 * the whole file for the literal, so a sentence ABOUT the rule would trip the rule
 * (measured in 217-10, not feared).
 *
 * Presentational by construction — no fetch, no state, no effects. Its callers own the
 * data and the caps' consequences are worded, never silent.
 */
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"

/** Size caps (T-087-07 DoS guard): short-circuit BEFORE building DOM. */
export const MAX_BYTES = 256_000
export const MAX_ROWS = 2000

export interface DataTableViewProps {
  /** The header cells. May be empty — the table then renders body rows only. */
  headers: string[]
  /** The body rows. Ragged rows are rendered as given; the caller owns shape validation. */
  rows: string[][]
  /** Shown when there is nothing to draw. The caller picks the sentence, because
   *  "nothing came back" and "this file type has none" are different claims. */
  emptyMessage?: string
  /** Optional download affordance rendered inside the fallback (the CSV preview's shape). */
  onDownload?: () => void
}

/**
 * The empty / too-large arm. Extracted from `CsvTablePreview.tsx:99-121` unchanged: a
 * centred sentence in the panel-scoped AA token plus an optional Download button.
 */
export function DataTableFallback({
  message,
  onDownload,
}: {
  message: string
  onDownload?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <p className="text-[13px] text-panel-muted-foreground">{message}</p>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-primary hover:bg-accent transition-colors"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download
        </button>
      )}
    </div>
  )
}

export function DataTableView({
  headers,
  rows,
  emptyMessage = "No preview available",
  onDownload,
}: DataTableViewProps) {
  // ── Caps FIRST. Nothing below this point may run on an unbounded input. ───────────
  if (rows.length > MAX_ROWS) {
    return <DataTableFallback message="Too large to preview" onDownload={onDownload} />
  }

  // Cheap byte estimate over the cells actually about to be mounted. Computed on the
  // already-parsed values rather than on a re-serialization, so it costs one pass.
  let bytes = 0
  for (const h of headers) bytes += h.length
  for (const r of rows) for (const c of r) bytes += c.length
  if (bytes > MAX_BYTES) {
    return <DataTableFallback message="Too large to preview" onDownload={onDownload} />
  }

  if (headers.length === 0 && rows.length === 0) {
    return <DataTableFallback message={emptyMessage} onDownload={onDownload} />
  }

  return (
    // ⛔ The scroll container. A wide table overflows sideways inside the 430px panel
    // track and the reader drags it — it does not lose columns.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[13px]">
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((cell, i) => (
                <th
                  key={i}
                  className={cn(
                    "border-b border-border px-2.5 py-1.5 text-left",
                    "font-medium text-foreground whitespace-nowrap",
                  )}
                >
                  {/* A React text child — untrusted header text escapes here. */}
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-accent/40">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-b border-border/50 px-2.5 py-1.5 text-panel-muted-foreground whitespace-nowrap"
                >
                  {/* A React text child — untrusted cell text escapes here. */}
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTableView
