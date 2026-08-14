/**
 * Phase 193.1-06 (AUTH-03) — EVERY WORD ON THE TEMPLATE-FIRST SURFACE THAT IS NOT ALREADY A
 * SHIPPED IDENTIFIER AND NOT A GOVERNED DOOR WORD.
 *
 * ── WHY THIS MODULE EXISTS AT ALL, RATHER THAN `doorVocabulary.ts` ────────────────────────
 * Two mechanical reasons, both measured rather than preferred:
 *
 *   1. **`doorVocabulary.ts` STRUCTURALLY CANNOT HOLD A MESSAGE FUNCTION.** The D-24(a) copy
 *      fence builds its needles by coercing every export of that module through
 *      `(value as string).replace(/&/g, "&amp;")`. A FUNCTION export lands in that expression
 *      and throws inside the needle builder — the fence does not merely fail, it errors before
 *      it can sweep anything. Two of the strings this surface needs state a DERIVED COUNT and
 *      are therefore functions, so they cannot live there. This is not a style call; it is what
 *      the fence's own implementation permits.
 *   2. **A runtime FUNCTION exported beside a COMPONENT is a `react-refresh/only-export-components`
 *      lint ERROR** (measured on two shipped files). So the functions cannot live beside the
 *      component that renders them either. A `.ts` vocabulary module is the only home left, and
 *      it is the shipped shape — `libraryVocabulary.ts` sits beside its surface exactly so.
 *
 * Exactly ONE id from this surface is GOVERNED and lives in `doorVocabulary.ts` instead:
 * `DESCRIBE_ATTACH_PROMPT` (D-21 / D-28). Everything else on the surface is here.
 *
 * ── THE RULE EVERY FUNCTION IN THIS FILE FOLLOWS ──────────────────────────────────────────
 * `libraryVocabulary.ts:146-148`, verbatim in force: *the interpolated half is DATA, and a
 * template assembled at the call site is a string that leaks out of this module's fences.* A
 * caller may pass a number; a caller may never assemble a sentence.
 *
 * ⚠ AND THE COUNT IS THE WHOLE POINT. `footingFields` takes a count as a PARAMETER because the
 * caller derives it from the list it renders. A hardcoded number beside a list of a different
 * length is the exact class of silent lie this phase exists to remove — an `8` above a list of
 * 5. The suite asserts each function's output actually CHANGES with its argument, so a function
 * that ignored its count could not pass.
 *
 * ── A TRUE LEAF ───────────────────────────────────────────────────────────────────────────
 * This module imports NOTHING — asserted, not documented, for the reason `doorVocabulary.ts`'s
 * own suite states: a zero-import leaf is what makes the surface's cycle risk one-directional.
 *
 * ⚠ NAME IDENTIFIERS, NEVER WORDS, IN EVERY COMMENT BELOW. This file is swept by the D-24(a)
 * RAW copy fence, prose included. A docblock QUOTING a governed door word is a second home for
 * it and reds the fence — which is the fence working, not misfiring.
 */

// ── 165-C · the pre-draft attach control ─────────────────────────────────────────────────

/**
 * `ctrl.note` — the sub-note under the control's prompt.
 *
 * ⚠ SHIPS EXACTLY AS SKETCH 165'S CONTRACT STATES IT, and D-28 explicitly re-confirmed it is
 * NOT reworded. It states the CONSEQUENCE, which is the whole reason this phase exists: without
 * it the control reads as a file upload that merely happens early, and SEED-157's defect
 * survives with a control on screen.
 */
export const ATTACH_NOTE =
  "Attach the document this should fill in — the draft is built to its fields."

/**
 * `spec.filenameLead` — the lead-in before the filename in the spec block (variant C only).
 *
 * Names the RELATIONSHIP rather than restating the file: the rail's own filename line answers
 * *what is attached*, this answers *what is it FOR*.
 */
export const SPEC_FILENAME_LEAD = "Drafting to"

// ── 166-B · the footing line — ONE line, five arms, five DISTINCT values ──────────────────
//
// ⚠ THE INHERITED RULE THAT BINDS ALL OF THESE, RESTATED ONE LEVEL DOWN. The shipped reading
// sentences carry a constraint in their own docblock: the `none` reading and the `unavailable`
// reading MAY NEVER MERGE. `none` is a fact about the DOCUMENT (we opened it and found
// nothing); `unavailable` is a fact about US (we never opened it). The consequence for the
// draft happens to be identical, which is exactly why the wording must not be — an author told
// "no fields" about a document nobody opened ships a workflow that fills nothing.
//
// The footings below inherit that constraint one level down, and the suite asserts the three
// no-fields sentences pairwise distinct BY NAME rather than trusting this comment.
//
// D-09: every arm has a footing, INCLUDING `loading`, so a control that is waiting can always
// say why. A control that is disabled and does not say why reads as broken.

/**
 * `footing.none` — the server read the document and it carries no fill-in fields.
 *
 * ⚠ THE CONTRACT CALLS THIS THE MOST IMPORTANT STRING ON THE PAGE, and the reason is
 * structural: SEED-158 measures the plain-language document as the COMMON case. Without this
 * line the author attaches a real document, reads a sentence about it, and is never told the
 * draft ignored it — SEED-157 recurring with a control on screen. It states the CONSEQUENCE
 * ("written from your description alone"), never merely the fact.
 */
export const FOOTING_NONE =
  "This template has no fill-in fields, so your draft will be written from your description alone."

/**
 * `footing.notWord` — two of the three accepted upload types cannot be read for fields at all.
 *
 * Separate from `FOOTING_NONE` for the same reason the shipped sentences are separate: telling
 * a slide-deck author their deck has no fields would be a flat lie.
 */
export const FOOTING_NOT_WORD =
  "We can only read fields from Word documents, so your draft will be written from your description alone."

/**
 * `footing.unavailable` — the read failed.
 *
 * ⚠ MUST NOT MERGE WITH `FOOTING_NONE`. See the block comment above; this is the one-level-down
 * mirror of the shipped rule, and it is asserted in the suite rather than trusted here.
 */
export const FOOTING_UNAVAILABLE =
  "We could not read this template's fields, so your draft will be written from your description alone."

/**
 * `footing.loading` — the read is in flight.
 *
 * D-09 requires this to ship WITH the in-flight arm rather than after it. It promises the draft
 * will be aimed at whatever the document asks for, which is the fact the author needs while
 * they wait.
 */
export const FOOTING_LOADING =
  "Reading the template — the draft will be built to whatever it asks for."

/**
 * `footing.fields` — the arm that STATES A COUNT.
 *
 * ⚠ A FUNCTION, AND THAT IS THE WHOLE REASON THIS MODULE EXISTS. The contract's own rule:
 * *in build it must be derived from the list rendered directly above it and never hardcoded. A
 * hardcoded 8 beside a list of 5 is exactly the class of silent lie this phase exists to
 * remove.* The caller passes the length of the list it just rendered — never a literal, never a
 * prop a caller could pass wrong — and the component's suite asserts the rendered number equals
 * the number of list items actually present.
 *
 * The singular arm is a DERIVED VARIATION, stated rather than smuggled: the contract's sentence
 * is written in the plural because its fixture has eight fields, and a document with exactly
 * one would otherwise render "these 1 fields". The plural branch is the contract's string
 * verbatim; only the number is substituted.
 */
export function footingFields(count: number): string {
  return count === 1
    ? "Your draft will be built to fill this 1 field."
    : `Your draft will be built to fill these ${count} fields.`
}

// ── D-06 · the bind failed after the draft was written ───────────────────────────────────

/**
 * The draft was built to fill a document, and binding that document to the saved workflow then
 * failed — so the workflow now expects a file it does not have.
 *
 * ⚠ IT CARRIES THE CONSEQUENCE, NOT ONLY THE FACT, and that is load-bearing rather than
 * sympathetic. Measured (RESEARCH §B): a deliverable step that expects a document and has none
 * bound fails at RUN time with `no_template_bound`, and that failure is TERMINAL. An author who
 * is told only "attaching failed" keeps a workflow that cannot complete and finds out at the
 * worst possible moment. So the sentence says what is now true of the draft and names the one
 * place the fix lives.
 *
 * Shaped as a FUNCTION for the module rule above: the filename is DATA.
 */
export function templateBindFailedMessage(filename: string): string {
  return `Your draft was written to fill “${filename}”, but the document could not be attached to it. The steps are saved — attach the document on the deliverable step to finish, or this workflow will stop when it runs.`
}

// ── 167-C · the three-bucket NAME check ──────────────────────────────────────────────────
//
// ⚠ THREE BUCKETS, NEVER TWO — D-10's red line, not a preference. A field supplied when the
// workflow starts is not a gap: nothing produces it and nothing should. A two-bucket check
// lists those as problems, and an author told twice that a correct workflow is broken stops
// reading the panel entirely. Measured on the live corpus, the run-input bucket is not
// hypothetical.
//
// ⚠ AN EMPTY BUCKET RENDERS NO CLAIM (D-20, the 193 D-15 rule one surface later). An empty
// *produced* bucket must never read as "no step produces anything".

/**
 * `reconcile.heading` — the panel's heading.
 *
 * ⚠ REWORDED FROM THE APPROVED SKETCH UNDER D-27, and the original is left visible rather than
 * overwritten. Sketch 167-C read *"This draft was written before the template arrived"*, which
 * asserts an ORDER OF EVENTS THE DEFINITION CANNOT CARRY: measured across the live corpus there
 * is no field distinguishing a draft written before the document from one written to it. Under
 * D-19 this phase begins producing template-first drafts, on which that heading would be flatly
 * false. This heading states only what the panel actually puts side by side — a comparison —
 * and claims nothing about when either was authored.
 */
export const NAME_CHECK_HEADING = "What this template asks for, next to what these steps name"

/**
 * `reconcile.action` — the button.
 *
 * ⚠ ALSO REWORDED UNDER D-27. The sketch's *"Reconcile the steps with this template"* named an
 * act variant C DOES NOT PERFORM: the check is a pure client-side name comparison with no model
 * call and no write (D-12). This label names the operation the code truly performs.
 */
export const NAME_CHECK_ACTION = "Check the names against this template"

/**
 * `reconcile.disclaim` — SHIPS VERBATIM FROM THE SKETCH CONTRACT AND IS NOT OPEN.
 *
 * ⚠ THE SINGLE MOST IMPORTANT STRING ON THE SURFACE (D-10). Without it the panel asserts a
 * coverage verdict it CANNOT COMPUTE. Measured: at attach time the app has placeholder names,
 * phase slugs and declared run-input keys — a HEURISTIC. Only at run time does the coverage
 * check run over an actual emitted field map and produce a VERDICT. The copy may say that
 * nothing in the steps NAMES a field. It may NEVER say the document is uncovered.
 */
export const NAME_CHECK_DISCLAIM =
  "This is a name check, not a coverage check — a step may already gather a field under a different name. We cannot know until the workflow runs."

/** The bucket a field lands in when a step's own name matches it (D-20: phase slugs). */
export const BUCKET_PRODUCED = "produced by a step"

/** The bucket for fields supplied when the workflow starts (D-20: declared run-input keys). */
export const BUCKET_RUN_INPUT = "supplied as a run input"

/**
 * The remainder. ⚠ Worded as an observation about the STEPS, never as a verdict about the
 * document — "named nowhere" is a fact the app can check; "missing" or "uncovered" is not.
 */
export const BUCKET_NAMED_NOWHERE = "named nowhere"

/**
 * `reconcile.runInputNote` — THE FALSE-ALARM GUARD, beside the run-input bucket.
 *
 * ⚠ A FUNCTION because it states a COUNT, under the same rule as `footingFields`. The singular
 * arm is again a derived variation: the contract's sentence is plural because its fixture has
 * two, and one run input would otherwise render "1 more are supplied".
 */
export function nameCheckRunInputNote(count: number): string {
  return count === 1
    ? "1 more is supplied when the workflow runs, so it needs no step."
    : `${count} more are supplied when the workflow runs, so they need no step.`
}

/**
 * `reconcile.showAll` — D-11's cap: show the first few rows per bucket and expand IN PLACE.
 *
 * ⚠ A FUNCTION for the same reason. ⚠ And D-20 measured that this cap will fire on essentially
 * every real document, so it is a primary path rather than an edge: on the live corpus, zero
 * step names match any placeholder name, which puts every field in one bucket.
 */
export function showAllLabel(count: number): string {
  return `Show all ${count}`
}
