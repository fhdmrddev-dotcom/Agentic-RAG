/**
 * Phase 196 Plan 05 (AUTH-04 — D-12 / D-13 / D-15) — the PICKER's fitness vocabulary.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: one derivation, two vocabularies — the same fence
 * `runVocabulary.ts` keeps for the run readings, applied to a model's emission tier.
 * The DERIVATION of a tier lives on the SERVER: `forced_emit.py` owns the ordered
 * recovery ladder, decides which rungs a tier may run, and is the only place that
 * knows what forcing actually means. This module owns the canvas's WORDS for those
 * tiers and holds no ladder logic at all — no rung list, no strictness flags, no
 * provider names, no request shape. Nothing here can change what a run does.
 *
 * That split is what makes the tier SAYABLE on an authoring surface at all. A client
 * that re-derived the ladder would be a second implementation of a runtime decision,
 * and the two would disagree the first time the server's ladder changed.
 *
 * ── THE TWO SERVER BEHAVIOURS THIS MODULE MIRRORS EXACTLY ────────────────────────────
 *
 * The substrate reads its tier with a default AND a guard, in that order:
 *
 *   1. THE READ-TIME DEFAULT — a capability row with no tier at all resolves to the
 *      WEAKEST rung. Migration 120 shipped the column nullable and every row is null
 *      today, so this is the dominant path rather than an edge case. A client that read
 *      an absent tier as the strongest one would advertise a guarantee the engine will
 *      not keep, which is exactly the class of lie AUTH-04 exists to remove.
 *
 *   2. ⚠ THE BOUNDARY GUARD, WHICH IS A DIFFERENT THING FROM THE DEFAULT. An operator
 *      types override values by hand, so an UNRECOGNISED string is reachable. It
 *      resolves to the weakest rung too — never to blank. Blank is the optimistic
 *      direction and optimism is the failure mode. The two are separate code paths
 *      server-side and are separate branches here, because a bare `??` satisfies the
 *      absent case and silently fails the typo case: a garbage string is not nullish,
 *      so the coalesce never fires.
 *
 * ── D-12: WHERE THESE WORDS MAY BE SHOWN ────────────────────────────────────────────
 *
 * On the deliverable step ONLY. On the other three step types the tier predicts
 * nothing about the outcome, and a warning that predicts nothing trains people to
 * ignore the ones that do. This module cannot enforce that — siting is the picker's
 * decision — but the rule is recorded here because this is the file a later author
 * will open when they want to "just show the tier everywhere".
 *
 * ── D-15: WHO EACH FORM IS FOR ──────────────────────────────────────────────────────
 *
 * Two audiences, two forms, never mixed. `modelFitnessWord` is the plain sentence
 * everyone sees. `modelFitnessTechnical` is the engine token, and it appears ONLY
 * under the ⌥ Technical-names reveal — the app-wide boolean Phase 154 shipped, which
 * exists as ONE context precisely so two toggles can never disagree. Engine words
 * never become user words; the reveal ADDS a line, it does not translate one.
 *
 * ⚠ The technical form reports the tier the ENGINE WILL USE, never the raw stored
 * value. For an absent or unrecognised tier it says the resolved one. Echoing a
 * typo back would put an operator's mistake on a user's screen as though it were a
 * capability, and would make the reveal disagree with the plain sentence beside it.
 *
 * Pure data + pure functions. No component framework import, no hooks, no markup —
 * so this module contributes nothing to the runtime graph and an ESM cycle is
 * impossible by construction.
 */

/** The three tiers the server's ladder knows. Keyed exactly as the column stores them. */
export type EmitTier = "force_strict" | "force" | "coerce"

/**
 * The three sentences.
 *
 * ⚠ THE STRONGEST SENTENCE CONTAINS THE MIDDLE ONE as a prefix, and that is deliberate:
 * the pair reads as one claim plus a qualifier rather than as two unrelated phrases, so a
 * person scanning the group labels sees the same promise getting stronger. The cost is
 * that a SUBSTRING comparison cannot separate them — the suite asserts whole strings only,
 * and demonstrates the collision rather than merely describing it.
 *
 * They are worded as capabilities of the STEP, not properties of the model: "can fill a
 * document" is what an author is choosing between. The engine's own term for the same
 * distinction is the technical form below, and it stays behind the reveal.
 */
export const MODEL_FITNESS_WORD: Record<EmitTier, string> = {
  force_strict: "Can fill a document — guaranteed format",
  force: "Can fill a document",
  coerce: "Best-effort only — may not fill a document",
}

/**
 * The grouping order: STRONGEST GUARANTEE FIRST.
 *
 * Deterministic and exported rather than derived from `Object.keys`, because the picker
 * renders it as the order of its groups and key order is not a contract anyone should
 * lean on. Strongest first because the first group is the one an author reads before
 * deciding, and the weakest is the one they should have to scroll past deliberately.
 */
export const EMIT_TIER_ORDER: readonly EmitTier[] = ["force_strict", "force", "coerce"]

/** The tier an absent or unrecognised value resolves to — the weakest, always. */
const FLOOR: EmitTier = "coerce"

/**
 * Read a stored tier value SAFELY.
 *
 * ⚠ `hasOwnProperty`, not `in` and not `TABLE[key] ?? floor`. `MODEL_FITNESS_WORD` is a
 * plain object literal, so it INHERITS `constructor`, `toString`, `__proto__` and friends.
 * None of them is nullish, so a coalesce does NOT fire its fallback for those names — it
 * hands back a *function* typed as the table's value type. That exact bug shipped once in
 * this repository (`phaseStatusFromDb`, recorded in `runVocabulary.ts`) and the observed
 * return was a function object. The value reaching this module comes from a database
 * column an operator can type into, so totality is a property of the lookup rather than of
 * its current callers.
 */
export function resolveEmitTier(tier: string | null | undefined): EmitTier {
  if (tier == null) return FLOOR
  return Object.prototype.hasOwnProperty.call(MODEL_FITNESS_WORD, tier)
    ? (tier as EmitTier)
    : FLOOR
}

/**
 * The plain sentence for a stored tier. TOTAL: anything the table does not own reads as
 * the weakest sentence, which is the honest floor and is never a claim of capability.
 */
export function modelFitnessWord(tier: string | null | undefined): string {
  return MODEL_FITNESS_WORD[resolveEmitTier(tier)]
}

/**
 * The engine token, for the ⌥ Technical-names reveal only (D-15).
 *
 * Composed from the RESOLVED tier, never from the argument — see the docblock above for
 * why echoing a raw value back would be wrong in two directions at once.
 */
export function modelFitnessTechnical(tier: string | null | undefined): string {
  return `emit_tier: ${resolveEmitTier(tier)}`
}
