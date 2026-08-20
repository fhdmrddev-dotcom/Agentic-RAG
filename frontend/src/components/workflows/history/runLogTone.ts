/**
 * SEED-190 — the run log's outcome colours.
 *
 * ⚠ THIS IS A DELIBERATE MIRROR OF `WorkflowCard.tsx`'s `GUTTER_TONE` / `RUN_TONE`, AND THE
 * DUPLICATION IS MEASURED RATHER THAN CASUAL. The obvious move was to extract those two maps
 * into a leaf and import them from both surfaces — the `cardFace.ts` pattern this repo
 * already uses for exactly this reason. It cannot be done in this commit:
 * `library/gutterTokens.fences.test.ts` reads `WorkflowCard.tsx`'s OWN SOURCE, requires it to
 * contain `const GUTTER_TONE` and `const RUN_TONE`, walks from each opening brace to its
 * matching one and pins the exact shape of the object bodies it finds there
 * (`TONE_SHAPE = { entries: 12, unique: 10, perMap: 6 }`). Moving the tables out empties both
 * bodies and turns that fence red — and that fence exists because `bg-warning` once compiled
 * to NOTHING and shipped unguarded, so it is not a fence to weaken in passing.
 *
 * ⚠ SO THE DUPLICATION IS GUARDED INSTEAD OF ARGUED AWAY. `runLogTone.mirror.test.ts` reads
 * BOTH sources and asserts these tables are entry-for-entry IDENTICAL to the card's, with a
 * positive control. A drift is a failing test rather than two surfaces quietly disagreeing
 * about what "failed" looks like — the `_AUDIT_EVENT_TYPES` ↔ migration-CHECK lockstep, one
 * layer up.
 *
 * ⚠ RE-OPEN TRIGGER, NAMED SO THIS DOES NOT BECOME PERMANENT: the next phase that touches
 * `gutterTokens.fences.test.ts` or the card's tone maps owes the extraction — one leaf, both
 * consumers, this file deleted and its mirror test with it.
 *
 * ⚠ THE THREE QUIET ARMS ARE PAIRWISE DISTINGUISHABLE AND MUST STAY SO. The card's own
 * docblock carries the argument in full and it is not restated here; what matters at this
 * surface is that `unknown` gets NO MARK (no information is not a fact), and that
 * `not-by-you` may never take an outcome colour it has no outcome to report.
 *
 * ⚠ TWO OF THE SIX ARMS ARE UNREACHABLE FROM THE LOG AND ARE STILL DECLARED. Every row of the
 * log IS a run of the caller's, so `runFacts` can only return `ran` or `unknown` here —
 * `never` and `not-by-you` cannot occur. They are kept because the table must stay TOTAL over
 * `RunFact`'s arms: a fifth arm added to `RunFact` should be a typecheck error at this file,
 * exactly as it is at the card, rather than an unpainted row.
 */
import type { RunOutcome } from "@/components/workflows/library/runFacts"

/** The six arms, keyed as `WorkflowCard.tsx` keys them. */
export type RunLogTone = RunOutcome | "never" | "unknown" | "not-by-you"

/** The dot / gutter fill. Mirror of `WorkflowCard.tsx`'s `GUTTER_TONE`. */
export const LOG_GUTTER_TONE = {
  worked: "bg-success",
  failed: "bg-destructive",
  stopped: "bg-warning",
  never: "bg-border",
  "not-by-you": "bg-muted-foreground",
  unknown: "bg-transparent",
} as const satisfies Record<RunLogTone, string>

/** The outcome word's colour. Mirror of `WorkflowCard.tsx`'s `RUN_TONE`. */
export const LOG_RUN_TONE = {
  worked: "text-success",
  failed: "text-destructive",
  stopped: "text-warning",
  never: "text-muted-foreground",
  "not-by-you": "text-muted-foreground",
  unknown: "text-muted-foreground",
} as const satisfies Record<RunLogTone, string>
