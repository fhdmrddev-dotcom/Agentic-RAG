/**
 * Phase 087 Plan 03 Task 1 — CsvTablePreview (PANEL-03, D-01).
 *
 * The one preview type with NO existing renderer (087-PATTERNS §"No Analog
 * Found"). A minimal in-panel <table> rendered client-side from the CSV string
 * — NO new dependency (D-01 / SC#3). Parsing is a small quote-aware splitter
 * (handles `"a,b"` quoted commas + `""` escaped quotes; rows split on `\n`,
 * trailing `\r` trimmed).
 *
 * Graceful fallback (mandatory, must NOT break layout — 087-UI-SPEC §Files):
 *   - malformed / ragged / zero-row CSV  → "No preview available · Download"
 *   - too large (≥2000 rows OR >256KB)   → "File too large to preview"
 * Never throws.
 *
 * SECURITY (T-087-04): every cell renders via React text children ({cell}) —
 * React auto-escapes, so a cell containing `<img src=x onerror=…>` renders as
 * literal text. ZERO raw-HTML injection on file content.
 *
 * ⚠ Phase 217 Plan 11 — THE RENDERING MOVED, THE PARSING DID NOT. The <table>, its
 * horizontal scroll container, the size caps and the fallback arm now live in
 * `DataTableView.tsx` so the Library's extracted-tables section shares them rather than
 * forking them. This file keeps what is genuinely CSV-specific: the quote-aware parser,
 * its own caps decision (taken on the RAW STRING, before parsing — a delegate cap on the
 * parsed cells would be a weaker guard) and its own three fallback sentences.
 * ⛔ Its public props and every one of its behaviours are unchanged; the shipped suite
 * passing untouched is the proof of that.
 */
import {
  DataTableView,
  DataTableFallback,
  MAX_BYTES,
  MAX_ROWS,
} from "./DataTableView"

interface CsvTablePreviewProps {
  content: string
  onDownload?: () => void
}

// ⚠ The caps are IMPORTED, not re-declared — one number, one place. This file still
// DECIDES when to apply them (on the raw string, before parsing); `DataTableView` applies
// the same numbers to whatever it is finally handed.

/**
 * Quote-aware CSV row splitter. Returns a 2D array of string cells, or `null`
 * when the content is unparseable (ragged rows / unbalanced quotes / empty).
 * Never throws.
 */
function parseCsv(content: string): string[][] | null {
  const text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (text.trim() === "") return null

  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // escaped quote ("" → ")
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\n") {
      row.push(field)
      rows.push(row)
      field = ""
      row = []
    } else {
      field += ch
    }
  }

  // unterminated quote at EOF → malformed
  if (inQuotes) return null

  // flush the trailing field/row if the file did not end with a newline
  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return null

  // ragged-row guard: every row must have the same column count as the header
  const cols = rows[0].length
  if (cols === 0) return null
  for (const r of rows) {
    if (r.length !== cols) return null
  }

  return rows
}

export function CsvTablePreview({ content, onDownload }: CsvTablePreviewProps) {
  // T-087-07: size cap BEFORE parsing/building DOM.
  if (content.length > MAX_BYTES) {
    return <DataTableFallback message="File too large to preview" onDownload={onDownload} />
  }

  const rows = parseCsv(content)

  if (!rows) {
    return (
      <DataTableFallback message="No preview available · Download" onDownload={onDownload} />
    )
  }

  if (rows.length > MAX_ROWS) {
    return <DataTableFallback message="File too large to preview" onDownload={onDownload} />
  }

  const [header, ...body] = rows

  // One renderer, shared with the Library's extracted tables (Phase 217 Plan 11).
  return <DataTableView headers={header} rows={body} />
}
