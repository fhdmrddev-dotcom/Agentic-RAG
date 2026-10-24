/**
 * Phase 292-02 (D-17 · UI-D-292-11 / -12 / -13) — the comparison's pure rules. No UI framework.
 *
 * · What a cell READS: a `q` cell always reads our `Not stated` (the model cannot dress up an
 *   absence); a y / n / m cell reads its text, or its verdict word when it has none — so no cell is
 *   ever blank.
 * · When a term is IDENTICAL across the options: every cell has the same verdict AND the same
 *   displayed text after trim and case-folding. That is what a reader sees, so it is what "Only
 *   terms that differ" removes.
 * · The glyph each verdict draws, from a closed table read through `own()`.
 */
import { own } from "@/components/workflows/ownProperty"
import { NOT_STATED, verdictWord } from "./artifactCopy"
import type { ComparisonCell, ComparisonTerm, Verdict } from "./artifactSpec"

export type VerdictGlyph = "check" | "cross" | "dash" | "question"

/** The closed glyph table. Shape carries the verdict; colour only supports it (WCAG 1.4.1). */
const GLYPH_TABLE: Record<string, VerdictGlyph> = { y: "check", n: "cross", m: "dash", q: "question" }

/** The glyph for a verdict; anything outside the closed four draws the not-stated mark. */
export function verdictGlyph(v: Verdict): VerdictGlyph {
  return own(GLYPH_TABLE, v) ?? "question"
}

/** The words a cell shows (and compares by). */
export function cellDisplayText(cell: ComparisonCell): string {
  if (cell.verdict === "q") return NOT_STATED
  return cell.text ?? verdictWord(cell.verdict)
}

function compareKey(cell: ComparisonCell): string {
  return `${cell.verdict}\u0001${cellDisplayText(cell).trim().toLowerCase()}`
}

/** True when every cell of the term reads the same, verdict and words. */
export function isIdenticalTerm(term: ComparisonTerm): boolean {
  if (term.cells.length === 0) return false
  const first = compareKey(term.cells[0])
  return term.cells.every((c) => compareKey(c) === first)
}

/** How many terms the "Only terms that differ" toggle would remove. */
export function hiddenTermCount(terms: ComparisonTerm[]): number {
  return terms.filter(isIdenticalTerm).length
}
