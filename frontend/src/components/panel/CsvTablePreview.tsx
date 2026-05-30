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
 */
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface CsvTablePreviewProps {
  content: string
  onDownload?: () => void
}

// Size caps (T-087-07 DoS guard): short-circuit BEFORE building DOM.
const MAX_BYTES = 256_000
const MAX_ROWS = 2000

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

function Fallback({
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

export function CsvTablePreview({ content, onDownload }: CsvTablePreviewProps) {
  // T-087-07: size cap BEFORE parsing/building DOM.
  if (content.length > MAX_BYTES) {
    return <Fallback message="File too large to preview" onDownload={onDownload} />
  }

  const rows = parseCsv(content)

  if (!rows) {
    return (
      <Fallback message="No preview available · Download" onDownload={onDownload} />
    )
  }

  if (rows.length > MAX_ROWS) {
    return <Fallback message="File too large to preview" onDownload={onDownload} />
  }

  const [header, ...body] = rows

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[13px]">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                className={cn(
                  "border-b border-border px-2.5 py-1.5 text-left",
                  "font-medium text-foreground whitespace-nowrap",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="hover:bg-accent/40">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-b border-border/50 px-2.5 py-1.5 text-panel-muted-foreground whitespace-nowrap"
                >
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
