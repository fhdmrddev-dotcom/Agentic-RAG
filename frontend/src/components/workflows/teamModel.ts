/**
 * Phase 290-01 (VIS-01, D-11) — CONTRACT STUB. The types are final; `deriveTeam` is not yet
 * implemented and returns the empty model for every input, so the RED suite fails on its
 * assertions rather than on an import.
 */
import type { NameContext, PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"

export type TeamLineKind = "handoff" | "judge" | "check" | "jump"

export interface TeamLine {
  kind: TeamLineKind
  from: string
  to: string
  source: string
}

export interface TeamStep {
  id: string
  number: number
  slug: string
  phaseType: string
  title: string
  role: string
  technical: string
  seats: number | null
  seatDots: number
  seatSource: string | null
}

export interface TeamGate {
  id: string
  stepId: string
  stepNumber: number
  judge: boolean
  derived: "citations" | "armed" | null
  kind: string
  words: string
  criteria: string | null
  failure: string | null
  jumpTo: number | null
  source: string
}

export type TeamAbsence = "empty" | "none" | "noJudge" | null

export interface TeamModel {
  steps: TeamStep[]
  gates: TeamGate[]
  lines: TeamLine[]
  absence: TeamAbsence
  oneStep: boolean
}

export const SEAT_DOT_CAP = 8

export function deriveTeam(
  phases: readonly PhaseSpecJSON[] | null | undefined,
  kbTools?: readonly string[],
  nameContext?: NameContext,
): TeamModel {
  void phases
  void kbTools
  void nameContext
  return { steps: [], gates: [], lines: [], absence: "empty", oneStep: false }
}
