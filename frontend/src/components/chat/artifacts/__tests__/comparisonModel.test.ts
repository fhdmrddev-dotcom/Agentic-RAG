/**
 * Phase 292-02 Task 3 (D-17 · UI-D-292-12 / -13) — the comparison's pure rules.
 *
 * A term is IDENTICAL when every cell has the same verdict AND the same displayed text after trim and
 * case-folding; a `q` cell always compares as `Not stated` (whatever text the model put on it).
 */
import { describe, expect, it } from "vitest"
import { hiddenTermCount, isIdenticalTerm, verdictGlyph, cellDisplayText } from "../comparisonModel"
import type { ComparisonCell, ComparisonTerm, Verdict } from "../artifactSpec"
import { parseArtifactRecord } from "../artifactSpec"
import { comparisonContracts } from "./fixtures"

function c(verdict: Verdict, text: string | null = null): ComparisonCell {
  return { verdict, text, source: null }
}

function term(...cells: ComparisonCell[]): ComparisonTerm {
  return { name: "Term", cells }
}

describe("isIdenticalTerm", () => {
  it("same verdict and same trimmed, case-folded text in every cell → identical", () => {
    expect(isIdenticalTerm(term(c("y", "12 months’ fees"), c("y", "  12 MONTHS’ FEES "), c("y", "12 months’ fees")))).toBe(true)
  })

  it("q cells compare as Not stated, so an all-q row is identical whatever the model wrote", () => {
    expect(isIdenticalTerm(term(c("q", "Not stated"), c("q", null), c("q", "nothing found")))).toBe(true)
  })

  it("a differing verdict or a differing text → not identical", () => {
    expect(isIdenticalTerm(term(c("m", "3 years"), c("m", "2 years")))).toBe(false)
    expect(isIdenticalTerm(term(c("y", "3 years"), c("m", "3 years")))).toBe(false)
  })

  it("a cell with no text compares as its verdict word, the words a reader sees", () => {
    expect(isIdenticalTerm(term(c("y"), c("y", "favourable")))).toBe(true)
    expect(isIdenticalTerm(term(c("y"), c("n")))).toBe(false)
  })

  it("the sketch data: no term is the same across all three vendors, so none would be hidden", () => {
    const r = parseArtifactRecord(comparisonContracts)
    if (!r.ok || !r.record.spec.comparison) throw new Error("fixture must parse")
    expect(hiddenTermCount(r.record.spec.comparison.terms)).toBe(0)
  })

  it("hiddenTermCount counts the identical terms", () => {
    expect(hiddenTermCount([term(c("y"), c("y")), term(c("y"), c("n")), term(c("q"), c("q"))])).toBe(2)
  })
})

describe("cellDisplayText and the glyph table", () => {
  it("q always reads Not stated; y / n / m read their text, or their verdict word when there is none", () => {
    expect(cellDisplayText(c("q", "Up to 10%"))).toBe("Not stated")
    expect(cellDisplayText(c("y", "30 days"))).toBe("30 days")
    expect(cellDisplayText(c("n"))).toBe("Unfavourable")
    expect(cellDisplayText(c("m"))).toBe("Neutral")
  })

  it("the glyph table is closed and read through own()", () => {
    expect(verdictGlyph("y")).toBe("check")
    expect(verdictGlyph("n")).toBe("cross")
    expect(verdictGlyph("m")).toBe("dash")
    expect(verdictGlyph("q")).toBe("question")
    for (const k of ["__proto__", "constructor", "toString"]) {
      expect(verdictGlyph(k as Verdict)).toBe("question")
    }
  })
})
