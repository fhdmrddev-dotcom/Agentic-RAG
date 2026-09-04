/**
 * Phase 214-03 Task 1 (STEP-04 / STEP-05 · D-214-14 / D-214-17) — THE STEP'S IDENTITY, AND
 * THE TWO RUN MOMENTS THAT SAY IT.
 *
 * EVERY GOVERNED USER-FACING STRING FOR THE STEP-IDENTITY SURFACES, IN ONE HOME: the
 * failure block's label and its sentinel, the approval pause's six sentences, and the five
 * composed identities the run surfaces render. Eight flat ids and five composed — which is
 * the WHOLE of sketch 216 §1 and not a subset of it.
 *
 * ── ⚠ THE ONE RULE SPECIFIC TO THIS TABLE: MOST OF THIS SURFACE IS NOT COPY ───────────
 *
 * D-214-17: *the mark is a reuse, not a new decision.* What a person sees on a step is a
 * MARK plus TWO NAMES THE SYSTEM ALREADY HOLDS — the action's title and the connection's
 * display name. This table is small because almost nothing here needed inventing; the
 * sentences below are only the connective tissue around two facts the product already has
 * and was not reading.
 *
 * ⭐ THE MEASURED TAUTOLOGY THIS CLOSES (sketch 216 §3). `_external_action_clause`
 * (`grounding.py:1255-1294`) fills the SERVICE slot from `config.capability` — the same
 * value it puts in the TOOL slot one line above — so the shipped sentence reads
 * `It will run "post_message" through post_message.` And an MCP row carries
 * `capability = None`, so the clause is omitted entirely and the sentence names no service
 * at all. **The service a person needs sits on the connection row and was never read.**
 *
 * ⚠ AND AN ABSENT NAME STILL OMITS THE SERVICE CLAUSE — never draw a name the system cannot
 * know. That is why `STEP_IDENTITY_SERVICE_UNKNOWN` exists as its own composed id rather
 * than as a fallback string inside `STEP_IDENTITY`: the honest answer to an unresolvable
 * service is the action alone, NOT the words "Unknown service".
 *
 * ── LOCK ELSEWHERE, MIRROR HERE ───────────────────────────────────────────────────────
 *
 * The words are LOCKED in
 * `.planning/sketches/216-the-mark-and-the-action-everywhere/BUILD-CONTRACT.generated.md`
 * §1 and MIRRORED here. `stepIdentityVocabulary.test.ts` RE-PARSES that generated contract
 * at test time and asserts the parsed id→value map equals its own literal table, so the
 * acceptance bar and this module cannot drift.
 *
 * ── ⚠ `FAILED_REASON_UNKNOWN` IS A COPY OF A SHIPPED SENTENCE ─────────────────────────
 *
 * It is character-for-character the sentinel `PhaseCard.classifyFailure` already ships
 * (`PhaseCard.tsx:250-253`, the `reason_unknown` arm). It was COPIED from there, not
 * retyped, and `stepIdentityVocabulary.test.ts` reads `PhaseCard.tsx` through `?raw` and
 * asserts the two are identical — so the copy cannot drift from its source.
 *
 * ⚠ ITS CONDITION NARROWS IN PLAN `214-11`; ITS WORDS NEVER CHANGE. The sentinel is an
 * HONESTY MECHANISM (D-214-18): firing it when the reason IS known trains readers to
 * distrust it, so `214-11` measures where the reason is actually lost and narrows the
 * predicate. Rewording the sentence would break every reader who has learned what it means,
 * for no gain.
 *
 * ── ZERO IMPORTS ──────────────────────────────────────────────────────────────────────
 *
 * This module imports NOTHING AT ALL. An ESM cycle through it is impossible by
 * construction — which matters more here than on the other two tables, because these
 * strings are consumed by FIVE surfaces across the panel, the chat and the run page, and
 * any one of them could otherwise close a cycle back through this leaf. And
 * `react-refresh/only-export-components` is an ACTIVE error in this repo, so none of those
 * five component modules may export the shared runtime value itself. The suite ASSERTS the
 * leaf claim from this file's own source rather than documenting it here.
 *
 * ── COMPOSED VALUES ARE FUNCTIONS TAKING NAMED ARGUMENTS ──────────────────────────────
 *
 * Precedent: `branchConditionOf` (`phaseVocabulary.ts:156-231`). ⚠ Named, never positional:
 * four of the five composed ids take an ACTION and a SERVICE, both plain strings, and a
 * positional signature would let the two swap and still typecheck — producing exactly the
 * inverted sentence sketch 216 §3 was written to stop.
 *
 * ⚠ The separator is the house MIDDLE DOT (U+00B7), rendered as its own node (sketch 216
 * #5), and every dash is an EM DASH (U+2014). The suite asserts both by codepoint.
 */

// ── The failure block ─────────────────────────────────────────────────────────────────

/** `FAILED_REASON_LABEL` — the label over a failed step's own reason. It asks the reader's
 *  actual question rather than naming a field. */
export const FAILED_REASON_LABEL = "Why it stopped"

/**
 * `FAILED_REASON_UNKNOWN` — ⚠ THE SENTINEL, COPIED CHARACTER FOR CHARACTER FROM
 * `PhaseCard.tsx`'s `reason_unknown` arm. See this module's header: its CONDITION narrows
 * in plan `214-11`; its WORDS do not change, and the suite pins them against the shipped
 * source through `?raw`.
 *
 * It is deliberately not a soothing sentence. It says the product failed to capture
 * something, because the alternative — a run rendered as an empty success — is the one
 * outcome a reader cannot recover from.
 * ⚠ Em dash (U+2014).
 */
export const FAILED_REASON_UNKNOWN =
  "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success."

// ── The approval pause ────────────────────────────────────────────────────────────────

/** `ASK_PAUSED` — the pause's own state, in the second person. ⚠ Em dash (U+2014).
 *  ⚠ Sketch 216 #11: NO COUNTDOWN, NO TIMER, NO PROGRESSBAR beside it — a person's decision
 *  time is unknowable, and drawing a clock claims otherwise. */
export const ASK_PAUSED = "Paused — waiting for you."

/**
 * `ASK_NOTHING_SENT` — the fact the reader is actually anxious about, stated first.
 *
 * The pause exists because something is about to leave the building. Saying that it has
 * NOT yet is what makes the two controls below a real choice rather than a formality.
 */
export const ASK_NOTHING_SENT = "Nothing has been sent yet."

/**
 * `ASK_WILL_SEND` — the heading over the arguments themselves.
 *
 * ⚠ Sketch 216 #8: the list beneath it draws arguments from ALL THREE SOURCES — fixed,
 * asked-at-launch, and upstream. Reading `tool_args` alone reproduces the defect, because
 * that field holds only the first of the three.
 * ⚠ #9: NO PER-ARGUMENT SOURCE ANNOTATION (rejected under D-214-15). At the moment of
 * approval the reader is deciding about the VALUE, and where it came from is a question
 * they already answered while authoring.
 */
export const ASK_WILL_SEND = "What it will send"

/** `ASK_APPROVE` — the affirmative control. It names the ACT, not the ceremony. */
export const ASK_APPROVE = "Send it"

/** `ASK_DECLINE` — the negative control. Also an act, and deliberately not "Cancel": what
 *  is being declined is this step running, not the reader's own dialog. */
export const ASK_DECLINE = "Do not run it"

/**
 * `ASK_NOT_RECORDED` — the honest asymmetry, said out loud.
 *
 * D-213-14 settled it: the arguments are SHOWN here and RECORDED nowhere. The receipt's key
 * set is fixed (`_write_send_receipt`, `phase_types.py:2151-2190`) and nothing joins it. A
 * reader who assumes this screen is the audit trail would be wrong in a way that only
 * surfaces months later, so the screen says what it is.
 */
export const ASK_NOT_RECORDED = "Shown here only. The record keeps what ran, not what it said."

// ── COMPOSED — the identity, and the three sentences that say it ──────────────────────

/**
 * `STEP_IDENTITY` — the step, as every one of the five surfaces says it: ACTION then
 * SERVICE, joined by the house middle dot.
 *
 * ⚠ Sketch 216 #1: ONE element, five surfaces, four sizes — SIZE IS A MODIFIER, NEVER A
 * FORK. The five surfaces are the panel's `PhaseCard`, chat's `RunCard`, `RunSpine`,
 * `RunStepList`, and the approval pause. `SEED-206`'s warning is that a PARTIAL answer
 * leaves the seed live, so the suite asserts per surface rather than once.
 *
 * ⚠ Both names are RESOLVED AND HANDED IN, never stored (D-213-02 / D-214-14). A stored
 * copy of a derived fact goes stale the moment the connection is renamed.
 * ⚠ The separator is U+00B7, not a bullet and not a full stop.
 */
export const STEP_IDENTITY = ({
  action,
  service,
}: {
  action: string
  service: string
}): string => `${action} · ${service}`

/**
 * `STEP_IDENTITY_SERVICE_UNKNOWN` — the identity when the service CANNOT be resolved.
 *
 * ⚠ It is the action ALONE. Not "Unknown service", not a slug, not the capability id
 * wearing a service's hat — sketch 216 §3's third row states it exactly: *never draw a name
 * the system cannot know.* This is a separate composed id rather than a branch inside
 * `STEP_IDENTITY` so that the honest shape has a name a caller can be seen choosing.
 */
export const STEP_IDENTITY_SERVICE_UNKNOWN = ({ action }: { action: string }): string => action

/**
 * `ASK_WILL_RUN` — the pause's own sentence, replacing the measured tautology.
 *
 * Before: `It will run "post_message" through post_message.`
 * After:  `It will run Post a message through Aether Slack.`
 */
export const ASK_WILL_RUN = ({
  action,
  service,
}: {
  action: string
  service: string
}): string => `It will run ${action} through ${service}.`

/** `RECEIPT_SENT` — the receipt after the act happened. Past tense, no adjective, no
 *  celebration: it records what ran. */
export const RECEIPT_SENT = ({
  action,
  service,
}: {
  action: string
  service: string
}): string => `Ran ${action} through ${service}.`

/**
 * `RECEIPT_REFUSED` — the receipt after the reader declined.
 *
 * ⚠ It records a DECISION, not a failure — no severity word, and deliberately not "Failed"
 * or "Cancelled". Declining is a correct outcome of an approval gate, and a receipt that
 * reads like an error teaches people not to use the gate.
 */
export const RECEIPT_REFUSED = ({
  action,
  service,
}: {
  action: string
  service: string
}): string => `Did not run ${action} through ${service}.`
