/**
 * Phase 273-02 (D-13 · UI-SPEC §TableArtifact) — the sortable table.
 *
 * Click-to-sort headers carry `aria-sort`: first click ascends, a second flips, another column starts
 * ascending. Numbers sort numerically, text with `localeCompare`, and empty cells sort LAST in both
 * directions. The header is sticky and the body scrolls past 512px (15 rows × 32px + the header).
 * Sort is local view state and resets on reload (UI-SPEC §Interaction).
 *
 * Every cell renders as React text (T-273-09): a cell that looks like markup stays text.
 */
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { EMPTY_CELL, SORT_GLYPH, columnHeading, formatNumber } from "./artifactCopy"
import type { ArtifactBodyProps, ArtifactColumn, Cell } from "./artifactSpec"

type Direction = "ascending" | "descending"

interface SortState {
  col: number
  dir: Direction
}

function isEmpty(v: Cell | undefined): boolean {
  return v === null || v === undefined || v === ""
}

/** Row indexes in display order. Stable: ties keep the spec's order. */
export function sortedRowIndexes(rows: Cell[][], columns: ArtifactColumn[], sort: SortState | null): number[] {
  const idx = rows.map((_, i) => i)
  if (!sort) return idx
  const numeric = columns[sort.col]?.type === "number"
  const sign = sort.dir === "ascending" ? 1 : -1
  return idx.sort((a, b) => {
    const va = rows[a][sort.col]
    const vb = rows[b][sort.col]
    const ea = isEmpty(va)
    const eb = isEmpty(vb)
    if (ea || eb) return ea === eb ? a - b : ea ? 1 : -1
    const cmp = numeric ? (va as number) - (vb as number) : String(va).localeCompare(String(vb))
    return cmp !== 0 ? sign * cmp : a - b
  })
}

export function TableArtifact({ record }: ArtifactBodyProps) {
  const { columns, rows } = record.spec
  const [sort, setSort] = useState<SortState | null>(null)
  const order = useMemo(() => sortedRowIndexes(rows, columns, sort), [rows, columns, sort])

  const onSort = (col: number) =>
    setSort((prev) =>
      prev && prev.col === col
        ? { col, dir: prev.dir === "ascending" ? "descending" : "ascending" }
        : { col, dir: "ascending" },
    )

  return (
    <div data-testid="artifact-table" className="max-h-[512px] overflow-auto">
      <table className="w-full border-collapse text-xs leading-[1.4]">
        <thead>
          <tr>
            {columns.map((c, i) => {
              const ariaSort = sort?.col === i ? sort.dir : "none"
              const numeric = c.type === "number"
              return (
                <th
                  key={c.name}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    "sticky top-0 z-[1] h-8 border-b border-border bg-popover px-3 text-xs font-normal text-muted-foreground",
                    numeric ? "text-right" : "text-left",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSort(i)}
                    className={cn(
                      "inline-flex w-full items-center gap-1 whitespace-nowrap",
                      numeric ? "justify-end" : "justify-start",
                    )}
                  >
                    {columnHeading(c.name, c.unit)}
                    <span
                      aria-hidden="true"
                      className={ariaSort === "none" ? "text-muted-foreground" : "text-primary"}
                    >
                      {SORT_GLYPH[ariaSort]}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {order.map((ri) => (
            <tr key={ri} className="h-8 border-b border-border/55 hover:bg-muted/50">
              {columns.map((c, ci) => {
                const v = rows[ri][ci]
                const numeric = c.type === "number"
                return (
                  <td
                    key={c.name}
                    className={cn(
                      "whitespace-nowrap px-3 text-xs text-foreground",
                      numeric ? "text-right tabular-nums" : "text-left",
                    )}
                  >
                    {isEmpty(v) ? (
                      <span className="text-muted-foreground">{EMPTY_CELL}</span>
                    ) : typeof v === "number" ? (
                      formatNumber(v)
                    ) : (
                      <span className="block max-w-[320px] truncate" title={String(v)}>
                        {String(v)}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
