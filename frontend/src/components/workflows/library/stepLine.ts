/**
 * Phase 290-02 (2026-10-21, VIS-04 / D-01 / D-03 / D-04) — THE CARD'S STEP LINE, DECIDED.
 *
 * A pure leaf: NO React import, NO `@/lib/api` import, no clock, no I/O. Its input is the row's
 * definition (an UNCHECKED cast of author-supplied JSON, `libraryFilter.ts` `defOf`) and nothing
 * else, so it cannot reach for data the feed does not carry. `StepChipLine.tsx` renders what
 * this returns; `WorkflowCard.tsx` calls it once with `row.def` and adds no prop and no state.
 *
 * ── THE WORDS ARE THE TYPE SENTENCE, ALWAYS (D-04, sketch 290-card-chip-line winner B) ──────
 * Each chip reads `PHASE_TYPE_SENTENCES` through `own()`, so a step type that is an inherited
 * object key (`constructor`) is an UNKNOWN type rather than the `Object` function (T-290-07).
 * Never the author's step name, never the slug, never `PHASE_TYPE_LABELS` (the ⌥ reveal
 * vocabulary). A type outside the closed set echoes its raw string, which is the shipped
 * `nodeTitle` floor and the honest answer for a type this client does not know. A step with
 * no type reads `STEP_LINE_UNTYPED`, so no chip is ever empty.
 *
 * ── RUN ORDER (D-03) ─────────────────────────────────────────────────────────────────────
 * A stable sort by `phase_index` (the `PhaseSpine.tsx` idiom): ties keep array order. A
 * non-number or non-finite index reads as 0. Ties only arise on unsaved or invalid drafts.
 *
 * ── ABSENCE IS `null` (D-01) ─────────────────────────────────────────────────────────────
 * No array, or no object entry in it, returns `null`, and the card renders no node at all, so a
 * card without steps composes byte-identically to the card before this phase.
 */
import { own } from "../ownProperty"
import { PHASE_TYPE_SENTENCES } from "../phaseVocabulary"
import type { DefShape } from "../soulData"
import { STEP_LINE_UNTYPED } from "./libraryVocabulary"

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

type Step = { phase_index?: unknown; config?: unknown }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const indexOf = (step: Step): number =>
  typeof step.phase_index === "number" && Number.isFinite(step.phase_index) ? step.phase_index : 0

const chipOf = (step: Step): StepChip => {
  const config = isObject(step.config) ? step.config : undefined
  const type = typeof config?.phase_type === "string" ? config.phase_type : ""
  const words = type === "" ? STEP_LINE_UNTYPED : (own(PHASE_TYPE_SENTENCES, type) ?? type)
  return { type, words }
}

/** `null` when the definition carries no step at all, so the card renders no node (D-01). */
export function resolveStepLine(def: DefShape | null | undefined): StepLine | null {
  const phases: unknown = def?.phases
  if (!Array.isArray(phases)) return null
  const steps = phases.filter(isObject) as Step[]
  if (steps.length === 0) return null
  // `Array.prototype.sort` is stable, so equal indices keep their array order.
  const chips = [...steps].sort((a, b) => indexOf(a) - indexOf(b)).map(chipOf)
  return {
    chips,
    shown: chips.slice(0, STEP_LINE_VISIBLE),
    more: Math.max(0, chips.length - STEP_LINE_VISIBLE),
  }
}
