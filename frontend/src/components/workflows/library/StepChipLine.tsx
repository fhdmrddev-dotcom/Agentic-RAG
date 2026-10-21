/**
 * Phase 290-02 (2026-10-21, VIS-04 / D-01 / D-03 / D-05) — the card's ONE chip line.
 *
 * RED stub: the contract only. The render lands in the GREEN commit.
 */
import type { StepLine } from "./stepLine"

export interface StepChipLineProps {
  line: StepLine
}

export function StepChipLine({ line }: StepChipLineProps) {
  void line
  return null
}
