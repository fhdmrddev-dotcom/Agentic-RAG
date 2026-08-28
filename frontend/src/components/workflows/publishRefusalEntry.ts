/**
 * Phase 214-10 Task 1 (STEP-03, sketch 215) — WHICH `named_failures` ENTRIES THE ARGUMENT-GAP
 * REFUSAL CLAIMS, and whether it can phrase them honestly.
 *
 * ── ⚠ WHY THIS IS ITS OWN FILE AND NOT TWO EXPORTS ON `PublishRefusalList.tsx` ────────
 *
 * `react-refresh/only-export-components` is an ACTIVE ERROR in this repo, not a style note
 * — measured here, not assumed: exporting this predicate beside the component produced
 * *"Fast refresh only works when a file only exports components. Use a new file to share
 * constants or functions between components"* at error severity. That is the same finding
 * `argumentVocabulary.ts`, `externalShapeVocabulary.ts`, `canvasGround.ts` and
 * `phaseStatusMeta.ts` each record in their own headers, and the repo's answer is uniformly
 * a pure module rather than a disable comment. This is that module.
 *
 * TWO CONSUMERS, WHICH IS THE OTHER HALF OF THE REASON. `PublishRefusalList.tsx` uses it to
 * pick its own items out of the polymorphic array; `PublishGauntlet.tsx` uses it to keep the
 * shipped generic renderer from printing the SAME failure a second time as a raw diagnostic.
 * A predicate with two callers that disagree is how a surface says one thing twice.
 *
 * ── KEY DETECTION PER ENTRY, NEVER A SWITCH ON THE STAGE ──────────────────────────────
 *
 * `named_failures` is POLYMORPHIC across the gauntlet's stages (lint / judge / summary /
 * interactive / bare string), and `PublishGauntlet.tsx`'s docblock rule 4 requires the shape
 * to be detected PER ENTRY. Everything this predicate declines falls through to the shipped
 * generic renderer, unchanged — including a bare string, a `null`, and a code from any other
 * stage. ⚠ A publish blocked with an unrenderable refusal is a workflow nobody can fix.
 */
import { REFUSAL_FOR_KIND, type ArgumentGapKind } from "@/components/workflows/publishRefusalVocabulary"

/**
 * One `named_failures` entry the refusal surface can phrase, narrowed to exactly the fields
 * it reads. ⚠ The wire entry carries two MORE keys — the phase SLUG and the server's own
 * diagnostic — and they are deliberately absent from this type: a field that is not in scope
 * cannot be rendered by accident, which is a stronger fence than remembering not to.
 */
export interface ArgumentRefusal {
  /** One of the five `ArgumentGapKind` strings. The union's declaring home is the vocabulary
   *  module and this is an IMPORT of it, never a second copy — plan `214-14`'s S-4 check
   *  compares the Python union against the TypeScript one, and a copy would have it
   *  comparing one side against itself. */
  readonly code: ArgumentGapKind
  /** The step's name AS THE AUTHOR WROTE IT. */
  readonly step_name: string
  /** The schema property name. `null` on `shape_unknown` only — we did not discover the
   *  action's declaration, so there is no argument to name. */
  readonly argument: string | null
  /** The earlier step a `From an earlier step` binding named. Required by
   *  `upstream_unreachable`, meaningless elsewhere. */
  readonly upstream: string | null
}

/**
 * The five codes, READ BACK OFF THE PAIRING MAP rather than written down again.
 *
 * ⚠ This is the difference between a detection set that FOLLOWS the vocabulary and one that
 * drifts from it. A sixth kind added to the union makes `REFUSAL_FOR_KIND` a type error
 * until it gains an entry, and the moment it does, this set contains it — with no edit here
 * and nobody having to remember.
 */
export const REFUSAL_CODES: ReadonlySet<string> = new Set(Object.keys(REFUSAL_FOR_KIND))

/** A non-empty string, which is the only thing worth putting inside curly quotes. */
function named(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Does this polymorphic entry belong to STEP-03's refusal, AND can we phrase it honestly?
 *
 * Two questions, deliberately answered by one predicate. The first is the shape check every
 * `named_failures` consumer owes. The second is the fence: `upstream_unreachable` with no
 * upstream, or any kind but `shape_unknown` with no argument, is an entry whose sentence
 * would contain an EMPTY pair of curly quotes — a fact nothing computed, printed as though
 * it had been. Those decline and render through the generic path instead, where the server's
 * own diagnostic is at least true.
 */
export function isArgumentRefusal(entry: unknown): entry is ArgumentRefusal {
  if (!entry || typeof entry !== "object") return false
  const e = entry as Record<string, unknown>
  if (typeof e.code !== "string" || !REFUSAL_CODES.has(e.code)) return false
  if (!named(e.step_name)) return false
  // `shape_unknown` is the ONE kind that names no argument (sketch 215 #2) — for it, an
  // absent argument is CORRECT rather than missing.
  if (e.code !== "shape_unknown" && !named(e.argument)) return false
  if (e.code === "upstream_unreachable" && !named(e.upstream)) return false
  return true
}
