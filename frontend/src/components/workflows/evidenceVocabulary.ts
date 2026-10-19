/**
 * Phase 289 (TRUST-01 / D-14a) — every word and glyph of the step evidence line, in ONE home.
 *
 * The acceptance bar is `.planning/sketches/289-confidence-on-a-step/` variant B:
 *
 *     Answered from Procurement KB · 6 passages · ● Medium · 0.47
 *     Searched Procurement KB · nothing matched · ○ No match found
 *
 * `StepEvidenceLine.tsx` only JOINS these; it authors no sentence of its own, so the live run
 * spine and the evidence report (which mount the same leaf) cannot word the line two ways.
 *
 * GLYPHS. ✓ ● ⚠ are the 028 ConfidenceChip anatomy's three tiers (glyph + word + raw score;
 * there they are lucide marks, here the sketch's characters). ○ is the sketch's own mark for
 * "searched, nothing matched" and is NET-NEW to the icon convention — recorded as a proposal in
 * `289-02-SUMMARY.md`, not passed off as shipped vocabulary. They live here rather than in
 * `receiptVocabulary.ts` because that file's rule 2 bans glyphs.
 *
 * ⚠ These are RETRIEVAL confidence words (chat's 0.54 / 0.38 buckets over cosine similarity),
 * never the metadata ConfidenceChip's 0.75 / 0.5 extraction tiers. Same anatomy, different
 * measurement; nothing here imports that chip.
 */

export const ANSWERED_FROM = "Answered from"
export const SEARCHED = "Searched"
export const NOTHING_MATCHED = "nothing matched"
export const SEPARATOR = "·"

/** "1 passage" / "6 passages". */
export function passages(n: number): string {
  return `${n} ${n === 1 ? "passage" : "passages"}`
}

export type EvidenceLevel = "high" | "medium" | "low" | "none"

export interface ConfidenceFace {
  glyph: string
  word: string
}

/** level -> { glyph, word }. Read through `own()`: a level arrives as wire data. */
export const CONFIDENCE_FACE: Record<EvidenceLevel, ConfidenceFace> = {
  high: { glyph: "✓", word: "High" },
  medium: { glyph: "●", word: "Medium" },
  low: { glyph: "⚠", word: "Low" },
  none: { glyph: "○", word: "No match found" },
}

export const NO_MATCH_EXPLANATION =
  "The knowledge base returned nothing for this step — its output is not drawn from your documents."
