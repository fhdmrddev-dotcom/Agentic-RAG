/**
 * BUG-260828-09 Task 2 — WHICH STEP STOPPED THE PUBLISH, IN THE AUTHOR'S OWN WORDS.
 *
 * ── THE DEFECT THIS CLOSES, STATED AS THE OPERATOR STATED IT ─────────────────────────
 * *"this golden gate is annoying sometimes and I don't know why it is failing. A lot of
 * information are displayed and none of them are useful for the user. For me I did not know
 * what is the real reason why this failed, in which step, and why."*
 *
 * Four publish attempts on one workflow, each answered with a ten-row stage spine and the
 * single sentence *"the golden run failed a structural gate"*. The engine had meanwhile
 * written a good sentence naming the step, the check, the attempts and the consequence —
 * into `workflow_phases.output`, into a `run_failed` audit row, and into an assistant
 * message inside a validation thread nothing links to. The information volume was never the
 * problem. The one useful sentence was being discarded before anything could render it.
 *
 * ── WHY THIS IS A MODULE AND NOT TWO EXPORTS ON THE CARD ─────────────────────────────
 * `react-refresh/only-export-components` is an ACTIVE ERROR in this repo, not a style note —
 * `publishRefusalEntry.ts`, `argumentVocabulary.ts`, `externalShapeVocabulary.ts` and
 * `phaseStatusMeta.ts` each record the same finding in their own headers, and the repo's
 * answer is uniformly a pure module rather than a disable comment. This is that module.
 *
 * ── IT CLASSIFIES NOTHING, AND THAT IS THE RED LINE `verdictModel.ts` DREW ───────────
 * There is no cause table here. No map from `citations_required` to advice, no severity
 * derivation, no allow-list of validator names. The publish vocabulary has exactly ONE owner
 * — the backend modules that mint it — and a second copy on the client is a copy that
 * drifts. A cause this client has never seen renders exactly as one it has, because the
 * server's own sentence is what gets rendered.
 *
 * ── AND IT DERIVES NO SECOND NAME LADDER ─────────────────────────────────────────────
 * ⭐ The visible step face is resolved by calling the SHIPPED `phaseVocabulary.nodeTitle` —
 * the four-tier ladder (authored name → config-derived face → type sentence → raw type)
 * whose own stated floor is *"the SLUG NEVER appears in this string."* That is how report
 * property (1) — *by the author's step name, never a slug or a stage index* — is honoured by
 * construction rather than by a rule somebody has to keep defending here. Writing a second
 * `name ?? slug` fallback in this file is precisely how the server's sibling refusal came to
 * emit `"step_name": "act"` — a slug, in the field that promises an authored name.
 *
 * PURITY: zero React, zero DOM, zero clock, zero randomness, no API-client runtime import.
 */
import { nodeTitle, type PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import type { DefShape } from "@/components/workflows/soulData"

/**
 * The optional `PublishVerdict.blocked_step` object, narrowed to exactly what this surface
 * reads. `step_slug` and `step_index` are carried for CORRELATION — matching the step in the
 * definition — and are never rendered; `reason` is the engine's verbatim sentence including
 * its machine prefix and belongs in the raw disclosure, not in the lead.
 */
export interface BlockedStepWire {
  readonly step_slug?: string | null
  readonly step_index?: number | null
  readonly step_name?: string | null
  readonly reason?: string | null
  readonly cause?: string | null
}

/** A non-empty string. The one thing worth putting on a surface that leads a refusal. */
function named(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Does this verdict carry a step-level cause we can lead with, and can we phrase it?
 *
 * TWO QUESTIONS, ONE PREDICATE — the same shape `isArgumentRefusal` takes. The first is the
 * ordinary wire check (the field is optional; a pre-fix server, a lint block and a judge
 * block all send nothing). The second is the fence: an object with no `cause` is an object
 * whose card would render a heading over an empty space, which is worse than the surface
 * that shipped. Those decline, and the gauntlet is byte-for-byte what it was.
 */
export function blockedStepOf(value: unknown): BlockedStepWire | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (!named(v.cause)) return null
  return v as BlockedStepWire
}

/**
 * The step's face — what the author sees where the machine would have written a slug.
 *
 * PRECEDENCE, AND EVERY TIER IS SOMEBODY ELSE'S:
 *  1. the phase found in the definition, resolved through `nodeTitle` — which itself starts
 *     with the authored name and falls through its own three tiers;
 *  2. the server's `step_name`, when the definition is not to hand (the caller may render
 *     this surface without one — `PublishGauntlet`'s `definition` prop is optional);
 *  3. the step's ORDINAL POSITION, worded. This is the author's own step number as the
 *     canvas counts it — not a gauntlet stage index, which is the thing property (1)
 *     forbids — and it is reached only when we hold neither a definition nor a name.
 *  4. a generic noun, so this function is TOTAL and a card can never render an empty face.
 *
 * ⚠ THE SLUG IS NOT A TIER. It is deliberately absent from every arm, including the last:
 * `step_slug` exists on the wire to FIND the phase, and a face composed from it would defeat
 * the entire point of the fix. `publishBlockedStep.test.ts` drives a definition whose slug is
 * a unique token and asserts that token appears nowhere in this function's output.
 */
export function blockedStepFace(
  step: BlockedStepWire,
  definition?: DefShape | null,
): string {
  const phase = matchPhase(step, definition)
  if (phase) {
    const face = nodeTitle(phase).trim()
    if (face) return face
  }
  if (named(step.step_name)) return step.step_name.trim()
  if (typeof step.step_index === "number" && Number.isFinite(step.step_index)) {
    return `${STEP_ORDINAL_PREFIX} ${step.step_index + 1}`
  }
  return STEP_UNNAMED
}

/**
 * The definition phase this refusal is about, projected into the shape `nodeTitle` reads.
 *
 * Matched on the SLUG first — stable across a re-order — and on `phase_index` only as a
 * fallback, because a run's phase rows and the definition's phase list are the same sequence
 * by construction. Returns `null` rather than a partial when the phase carries no readable
 * discriminator: `nodeTitle` tier 2 reads lookups it does not own, and handing it a shape
 * with no `config` would have it answer for a step that is not this one.
 */
function matchPhase(
  step: BlockedStepWire,
  definition?: DefShape | null,
): PhaseSpecJSON | null {
  const phases = definition?.phases
  if (!Array.isArray(phases)) return null
  const found = phases.find((p) => {
    if (!p) return false
    if (named(step.step_slug) && named(p.slug)) return p.slug === step.step_slug
    if (typeof step.step_index === "number") return p.phase_index === step.step_index
    return false
  })
  if (!found) return null
  return {
    slug: typeof found.slug === "string" ? found.slug : "",
    phase_index: typeof found.phase_index === "number" ? found.phase_index : 0,
    name: found.name ?? null,
    // `?? {}` rather than a bare read: an absent `config` is a malformed author-supplied row,
    // and `nodeTitle`'s own totality contract expects an object it can miss on, not a throw.
    config: (found.config ?? {}) as PhaseSpecJSON["config"],
  }
}

// ── the words ────────────────────────────────────────────────────────────────────────
//
// FOUR LINES, IN THE ORDER A PERSON ASKS THEM. *Which step? — why? — what do I do? — did it
// send anything?* The stage spine answers none of those and sits below; the raw verdict and
// the machine-prefixed `reason` sit behind the shipped disclosure. Nothing is deleted.
//
// ⚠ NOTHING HERE NAMES A CAUSE, A VALIDATOR OR A REMEDY. The cause sentence comes from the
// server verbatim and is the ONLY place a specific failure is described — which is what keeps
// this module free of the code table `verdictModel.ts`'s red line forbids, and what makes a
// validator nobody has written yet render correctly on the day it ships.

/** The section's own label. Says what the block is, in the register the sibling refusal
 *  surface already uses (`REFUSE_TITLE`), so two cause blocks never read as two features. */
export const BLOCKED_STEP_TITLE = "WHAT STOPPED IT"

/** The headline. It names the step and claims exactly one thing — that this step is where
 *  the run stopped. It does NOT say the step is broken, because a check refusing what a step
 *  produced is not the same as the step being wrong, and the cause line says which. */
export function blockedStepHeadline(face: string): string {
  return `“${face}” is where the trial run stopped`
}

/** What to do, and it is honest about what it can promise: the run is browsable, the fix is
 *  on the canvas, and publishing is re-runnable. It prescribes no specific repair — only the
 *  server knows what failed, and it has already said so one line above. */
export const BLOCKED_STEP_NEXT =
  "Open the trial run to see what this step actually produced, then fix that step on the canvas and publish again."

/** Tier 3 of the face ladder — the author's own step position, never a gauntlet stage. */
export const STEP_ORDINAL_PREFIX = "Step"

/** Tier 4. A generic noun, so the headline is never rendered around an empty pair of quotes. */
export const STEP_UNNAMED = "One step"
