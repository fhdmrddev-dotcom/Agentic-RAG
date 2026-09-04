/**
 * Phase 214.1-01 (STEP-02 · D-214.1-03 · D-214.1-06) — THE DECLARED-INPUT DOOR'S WORDS.
 *
 * Every user-visible string the declared-input editor shows, in one home: the section title,
 * the three refusal reasons, the add / remove / declare next-actions, the required and
 * optional marks, and the two empty states.
 *
 * ── ⚠ WHY THIS IS A SEPARATE MODULE AND NOT AN EXPORT BESIDE THE COMPONENT ────────────
 *
 * `react-refresh/only-export-components` is an ACTIVE ERROR on this directory. A `.tsx`
 * carrying a component may not also export a runtime constant — `argumentVocabulary.ts`,
 * `publishRefusalEntry.ts` and `LaunchInputFields.tsx` all record the same measurement in
 * their own headers. The strings live in a `.ts` leaf; the component imports them.
 *
 * ── ⚠ G-2 IS OVERRIDDEN HERE, NOT SATISFIED (D-214.1-06) ──────────────────────────────
 *
 * No operator-approved sketch exists for this surface, so these sentences are NOT locked in a
 * generated BUILD-CONTRACT the way `argumentVocabulary.ts`'s are, and this module deliberately
 * does NOT claim to be. It is a single home so that a re-skin — which the operator explicitly
 * retained the right to demand — changes words in one file and touches no wiring.
 *
 * ── THE ONE RULE THESE WORDS OBEY ─────────────────────────────────────────────────────
 *
 * ⭐ THE TITLE IS `ARG_SOURCE_ASK` VERBATIM. An author meets *"Asked when this runs"* on the
 * argument row, chooses it, and is then refused at publish because nothing declares the key.
 * `BUG-260828-02` IS that gap. The door that closes it must be recognisable as the same
 * subject, so the section is called the same thing the arm is called. It is spelled here
 * rather than imported because `argumentVocabulary.ts` mirrors a generated contract whose
 * audit is defined over its WHOLE table — importing one id out of it would make this module a
 * partial second home for a governed table. The agreement is asserted in
 * `declaredInputs.test.ts` instead, so a divergence is a red test rather than a silent drift.
 */

/** The section title. ⚠ Byte-identical to `ARG_SOURCE_ASK` — see the header. */
export const DECLARED_INPUTS_TITLE = "Asked when this runs"

/** The affordance's accessible name in the builder header. */
export const DECLARED_INPUTS_AFFORDANCE_LABEL = "Inputs asked for when this workflow runs"

/** What the whole surface is FOR, said once at the top of the dialog. */
export const DECLARED_INPUTS_EXPLANATION =
  "Each of these becomes a field on every way of starting this workflow."

// ── The three refusals (D-214.1-03) ───────────────────────────────────────────────────

/**
 * ⚠ `REFUSE_RESERVED` names the consequence, not the rule. "Reserved" alone tells an author
 * nothing they can act on; the value VANISHING is the fact they need. The server strips these
 * keys at both kickoff merge sites, so a field declared under one would be a control a person
 * fills in whose value reaches nothing.
 */
export const DECLARED_INPUT_REFUSE_RESERVED =
  "Starting a run already collects this one — a field named this would be discarded."

/** `REFUSE_DUPLICATE` — the key is already on the list, so the second one could never be filled. */
export const DECLARED_INPUT_REFUSE_DUPLICATE = "This workflow already asks for that."

/** `REFUSE_EMPTY` — states the world rather than scolding; nothing has gone wrong yet. */
export const DECLARED_INPUT_REFUSE_EMPTY = "Give it a name first."

// ── The next-actions ──────────────────────────────────────────────────────────────────

/** The label on the key field of the add control. Mirrors `ARG_ASK_KEY_LABEL`'s subject. */
export const DECLARED_INPUT_KEY_LABEL = "Ask for it as"

/** The label on the per-row label field — the prose a launcher shows instead of the key. */
export const DECLARED_INPUT_LABEL_LABEL = "Show it as"

/** The add next-action. */
export const DECLARED_INPUT_ADD = "Add an input"

/** The remove next-action, per row. */
export const DECLARED_INPUT_REMOVE = "Remove"

/** The one-click declare on an offered key. */
export const DECLARED_INPUT_DECLARE = "Declare it"

/** The heading over the offers derived from the definition's own steps. */
export const DECLARED_INPUT_OFFERS_TITLE = "Your steps ask for these, and nothing declares them yet"

// ── The marks ─────────────────────────────────────────────────────────────────────────

/** Per-row control: whether a launcher marks the field required. */
export const DECLARED_INPUT_REQUIRED_TOGGLE = "Required"

// ── The empty states ──────────────────────────────────────────────────────────────────

/**
 * The honest empty state — nothing declared AND nothing offered.
 *
 * It says what is TRUE (the workflow asks for nothing) rather than implying something is
 * missing: a workflow that needs no launch input is a perfectly good workflow.
 */
export const DECLARED_INPUTS_EMPTY = "This workflow asks for nothing when it starts."
