/**
 * Phase 290-02 (2026-10-21, VIS-04 / D-01 / D-03 / D-04) — THE CARD'S STEP LINE, DECIDED.
 *
 * A pure leaf: NO React import, NO `@/lib/api` import, no clock, no I/O. Its input is the row's
 * definition (an UNCHECKED cast of author-supplied JSON, `libraryFilter.ts` `defOf`) and nothing
 * else, so it cannot reach for data the feed does not carry.
 *
 * RED stub: the contract only. The resolver lands in the GREEN commit.
 */
import type { DefShape } from "../soulData"

/** How many chips the collapsed line shows before `+N more` (D-03). */
export const STEP_LINE_VISIBLE = 3

/** One step, as the card says it. `type` is the raw `phase_type` (or `""`); `words` is shown. */
export interface StepChip {
  type: string
  words: string
}

/** Every step in run order, the collapsed subset, and how many the subset leaves out. */
export interface StepLine {
  chips: StepChip[]
  shown: StepChip[]
  more: number
}

/** `null` when the definition carries no step at all, so the card renders no node (D-01). */
export function resolveStepLine(def: DefShape | null | undefined): StepLine | null {
  void def
  return null
}
