/**
 * Phase 135 Plan 06 Task 1 — pure LCS unified line diff (SI-01, D-09).
 *
 * Given two multi-line strings (a skill's base instructions vs. the proposed
 * instructions), classify each line as removed / added / unchanged so the
 * proposal card (Plan 07) can render a reviewable red/green diff. A changed
 * line surfaces as a `remove` of the old text immediately followed by an `add`
 * of the new text.
 *
 * D-09 (recommended path): an in-repo Longest-Common-Subsequence util with NO
 * new npm dependency — sidesteps the `diff`/jsdiff supply-chain surface
 * entirely (T-135-SC accepted; package.json/lock unchanged). This is a distinct
 * concern from `diffParse.ts`, which parses a backend-emitted unified-diff
 * STRING; here the backend emits no diff, so the client computes one itself.
 *
 * Pure + React-free + fetch-free → fast, deterministic unit testing.
 */

export type DiffRowType = "add" | "remove" | "unchanged"

export interface DiffRow {
  type: DiffRowType
  /** The line text (marker-free — rendered as a React text child, never HTML). */
  text: string
}

/** Split into lines, treating the empty string as ZERO lines (not `[""]`), so
 *  an empty base vs. non-empty next is all `add` (and the inverse all `remove`)
 *  rather than a spurious remove/add of a phantom empty line. */
function toLines(s: string): string[] {
  return s === "" ? [] : s.split("\n")
}

/**
 * Compute a unified line diff between `base` and `next`.
 *
 * @returns rows in reading order: matched lines → `unchanged`; lines only in
 *   `base` → `remove`; lines only in `next` → `add`.
 */
export function lineDiff(base: string, next: string): DiffRow[] {
  const a = toLines(base)
  const b = toLines(next)
  const n = a.length
  const m = b.length

  // LCS length table: lcs[i][j] = length of the LCS of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  // Backtrack from (0,0), emitting rows in order.
  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "unchanged", text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      // Dropping a[i] preserves (or ties) the LCS → a[i] is a removal. The tie
      // going to `remove` first is what makes a REPLACE render as remove-then-add.
      rows.push({ type: "remove", text: a[i] })
      i++
    } else {
      rows.push({ type: "add", text: b[j] })
      j++
    }
  }
  // Tail: any remaining base lines were removed; any remaining next lines added.
  while (i < n) rows.push({ type: "remove", text: a[i++] })
  while (j < m) rows.push({ type: "add", text: b[j++] })

  return rows
}
