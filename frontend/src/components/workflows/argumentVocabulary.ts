/**
 * Phase 214-03 Task 1 (STEP-01 / STEP-02 · D-214-06) — THE ARGUMENT FORM'S WORDS.
 *
 * EVERY GOVERNED USER-FACING STRING ON THE ARGUMENT-AUTHORING SURFACE, IN ONE HOME:
 * the three source arms and the group that holds them, the reading each arm produces,
 * the required/optional marks, the pre-set note, the two shapes this form structurally
 * cannot fill, the unknown-schema pair, the leftover control, the section heading, the
 * upstream picker, and the ask-key pair. Twenty flat ids and five composed — which is the
 * WHOLE of sketch 214 §1 and not a subset of it.
 *
 * ── LOCK ELSEWHERE, MIRROR HERE ───────────────────────────────────────────────────────
 *
 * The words are LOCKED in
 * `.planning/sketches/214-argument-form-and-its-source/BUILD-CONTRACT.generated.md` §1 and
 * MIRRORED here: a change is a decision taken in that generated contract and reflected
 * here, never the other way round. That is the `doorVocabulary.ts` / `runVocabulary.ts` /
 * `libraryVocabulary.ts` habit, copied for a mechanical reason rather than a tidy one — the
 * contract's audit is defined over the WHOLE table, so a module holding a SUBSET means the
 * module and the contract describe different things and the next reader cannot tell which
 * strings are governed. A vocabulary module with two homes is not a single source of truth.
 *
 * `argumentVocabulary.test.ts` RE-PARSES that generated contract at test time and asserts
 * the parsed id→value map equals its own literal table. That case is the mechanism binding
 * the sketch to the build: a sentence edited in one place and not the other is a red test
 * rather than a silent disagreement.
 *
 * ── ⚠ THE ONE RULE SPECIFIC TO THIS TABLE ─────────────────────────────────────────────
 *
 * THERE IS NO ESCAPE-HATCH SENTENCE IN THIS TABLE AND THERE WILL NOT BE ONE.
 *
 * D-214-06. A free-text box "for the hard cases" is the surface SC#1 forbids, arriving
 * under a different name — and once it exists every hard case routes to it, because it
 * always accepts and the governed rows never do. The two shapes this form genuinely cannot
 * fill get their OWN honest sentences instead (`ARG_UNRENDERABLE_REQUIRED` /
 * `ARG_UNRENDERABLE_OPTIONAL` / `ARG_UNRENDERABLE`), which say what is true rather than
 * offering a door out of the model. **The absence is ASSERTED, not assumed:**
 * `argumentVocabulary.test.ts` carries a tree-wide `?raw` sweep with a non-vacuity control
 * first and every forbidden needle assembled at runtime.
 *
 * ⚠ THAT RUNTIME ASSEMBLY IS WHY THIS DOCBLOCK NAMES NONE OF THE FORBIDDEN SPELLINGS. A
 * docblock that spells an identifier a `?raw`-swept fence is looking for makes the fence
 * count its own prose — the 187-24 trap, which has fired on this exact surface twice. The
 * words are in the sketch contract and in the plan; they are deliberately not here.
 *
 * ── ⚠ NO WIRE ID IS EVER A VALUE HERE ─────────────────────────────────────────────────
 *
 * Sketch 214 #13 / #15: the step names its SERVICE and its ACTION, never a capability id
 * and never the phrase "external action". No value below carries an id-shaped token, and
 * the suite asserts it over the whole table rather than per row.
 *
 * ── ZERO IMPORTS ──────────────────────────────────────────────────────────────────────
 *
 * This module imports NOTHING AT ALL — no React, no hooks, no sibling, not even a type.
 * Two consequences, both mechanical:
 *
 *   1. An ESM cycle through this module is impossible by construction, so every consumer
 *      may import this leaf precisely because this leaf can never import back.
 *   2. `react-refresh/only-export-components` is an ACTIVE error in this repo
 *      (`ExternalActionSection.tsx:64-77` records the measurement), so a component module
 *      may not export a shared runtime value. The strings therefore live in a `.ts` LEAF
 *      and derived constants stay module-private in their components, read by suites from
 *      this ONE vocabulary home.
 *
 * `argumentVocabulary.test.ts` asserts the leaf claim by reading this file's own source,
 * rather than documenting it here and hoping.
 *
 * ── COMPOSED VALUES ARE FUNCTIONS TAKING NAMED ARGUMENTS ──────────────────────────────
 *
 * The shipped precedent is `branchConditionOf` / `EXTERNAL_CAPABILITY_SENTENCES`
 * (`phaseVocabulary.ts:156-231`). Every composed id below takes ONE OBJECT with named
 * fields, never positional parameters, so a mis-ordered call is a TYPE ERROR rather than a
 * swapped sentence that reads plausibly and says the wrong thing.
 *
 * ── ⚠ THE DASH IS AN EM DASH (U+2014) IN EVERY SENTENCE THAT CARRIES ONE ──────────────
 *
 * A hyphen-minus or an en dash looks nearly identical in a diff and in most editors. The
 * suite asserts the CODEPOINT over the whole table, exactly as `doorVocabulary.test.ts`
 * does, rather than trusting the character to survive an editor. The quotation marks around
 * an interpolated name are the CURLY pair (U+201C / U+201D) for the same reason.
 */

// ── The three source arms, and the group that holds them ──────────────────────────────

/** `ARG_SOURCE_FIXED` — arm 1. The author supplies the value here, now. */
export const ARG_SOURCE_FIXED = "Set here"

/** `ARG_SOURCE_ASK` — arm 2. The value is collected at launch, from whoever starts the run. */
export const ARG_SOURCE_ASK = "Asked when this runs"

/** `ARG_SOURCE_UPSTREAM` — arm 3. The value is whatever an earlier step produced. */
export const ARG_SOURCE_UPSTREAM = "From an earlier step"

/**
 * `ARG_SOURCE_GROUP_LABEL` — the accessible name of every source group.
 *
 * ⚠ Sketch 214 #4: EVERY group carries this same name, so a person meets one question
 * repeated rather than a different question per row. #2 and #3 bind the shape around it —
 * exactly three arms, at most one pressed, in the same order in every group.
 */
export const ARG_SOURCE_GROUP_LABEL = "Where this comes from"

// ── What each arm READS BACK once it is chosen ────────────────────────────────────────

/** `ARG_READING_FIXED` — the reading for arm 1. The composed readings for arms 2 and 3
 *  are `ARG_READING_ASK` / `ARG_READING_UPSTREAM` below, because they name something. */
export const ARG_READING_FIXED = "You set this"

/**
 * `ARG_NO_SOURCE` — the reading when NO arm has been chosen yet.
 *
 * It states the world rather than scolding: the author has done nothing wrong, they have
 * simply not done this yet. Its publish-time counterpart is `REFUSE_NO_SOURCE` in
 * `publishRefusalVocabulary.ts`, which names the argument and the step because by then the
 * reader is not looking at the row.
 */
export const ARG_NO_SOURCE = "Nothing supplies this yet"

// ── The two marks every row declares (sketch 214 #10) ─────────────────────────────────

/** `ARG_REQUIRED_MARK` — the row is in the action's `required` list. */
export const ARG_REQUIRED_MARK = "Required"

/** `ARG_OPTIONAL_MARK` — the row is declared by the action but not required by it. */
export const ARG_OPTIONAL_MARK = "Optional"

/**
 * `ARG_PRESET_NOTE` — the note beside a row that arrived already sourced.
 *
 * ⚠ Sketch 214 #11: pre-set AND STILL CHANGEABLE. The note says so in the author's own
 * terms, and the control beside it stays enabled — a pre-set value the author cannot
 * change is a decision taken on their behalf and hidden.
 * ⚠ Em dash (U+2014).
 */
export const ARG_PRESET_NOTE = "Set for you — change it if that is not what you meant."

// ── The two shapes this form structurally cannot fill (D-214-06) ──────────────────────

/**
 * `ARG_UNRENDERABLE_REQUIRED` — a REQUIRED argument whose shape this form cannot fill.
 *
 * ⚠ It names the CONSEQUENCE, not a workaround. The fix is a different action; there is
 * deliberately no door out of the model here, for the reason stated in this module's
 * header.
 */
export const ARG_UNRENDERABLE_REQUIRED = "This action cannot be used here yet."

/** `ARG_UNRENDERABLE_OPTIONAL` — the same shape on an OPTIONAL argument, where the honest
 *  answer is different: the step still runs, and this is simply left out. ⚠ Em dash. */
export const ARG_UNRENDERABLE_OPTIONAL = "This step can still run — it will be left out."

// ── The action whose shape was never discovered ───────────────────────────────────────

/**
 * `ARG_SCHEMA_UNKNOWN` — we hold no declaration for this action.
 *
 * ⚠ It says what WE do not know. It does not say the action is broken, and it invents no
 * argument name — the same restraint `REFUSE_SHAPE_UNKNOWN` carries at publish time, and
 * for the same reason: naming an argument here would be printing a fact nothing computed.
 */
export const ARG_SCHEMA_UNKNOWN = "We do not know what this action needs."

/** `ARG_SCHEMA_UNKNOWN_NEXT` — the one next action that resolves it. Re-discovery, not an
 *  edit: there is nothing here for the author to type. */
export const ARG_SCHEMA_UNKNOWN_NEXT = "Refresh actions"

// ── The leftover key ──────────────────────────────────────────────────────────────────

/**
 * `ARG_LEFTOVER_NEXT` — the control on a stored key the action does not declare.
 *
 * ⚠ Sketch 214 #9: a leftover renders as REMOVABLE, never silently dropped. The adapters
 * refuse an undeclared key outright (`jira_adapter.py:452-456`,
 * `smtp_adapter.INPUT_SCHEMA` under `additionalProperties: False`), so a key quietly
 * dropped by the client would hide a step that cannot run from the person who could fix it.
 */
export const ARG_LEFTOVER_NEXT = "Remove it"

// ── The section, and the upstream picker ──────────────────────────────────────────────

/** `ARG_SECTION_HEADING` — the heading over the whole argument form. */
export const ARG_SECTION_HEADING = "What this step sends"

/** `ARG_UPSTREAM_PICK_LABEL` — the label on the picker arm 3 opens. */
export const ARG_UPSTREAM_PICK_LABEL = "Which earlier step"

/**
 * `ARG_UPSTREAM_NONE_OPTION` — the picker's unchosen option.
 *
 * ⚠ BOTH flanking dashes are EM DASHES (U+2014), and they are at the string's edges rather
 * than between two spaces — the suite's dash walk covers edge positions for exactly this
 * value, because a space-flanked-only rule would skip it entirely.
 */
export const ARG_UPSTREAM_NONE_OPTION = "— choose an earlier step —"

/** `ARG_UPSTREAM_EMPTY` — what the picker says when there is genuinely nothing upstream.
 *  It states the graph, not a failure. ⚠ Em dash. */
export const ARG_UPSTREAM_EMPTY = "This is the first step — nothing runs before it."

// ── The ask key ───────────────────────────────────────────────────────────────────────

/** `ARG_ASK_KEY_LABEL` — the label on the name arm 2 collects the value under. */
export const ARG_ASK_KEY_LABEL = "Ask for it as"

/**
 * `ARG_ASK_KEY_HINT` — what choosing arm 2 actually COSTS, said before it is chosen.
 *
 * ⚠ This is the sentence `BUG-260826-01` existed for: an ask with no declared name is an
 * intention no launcher can honour, and the author had no way to know. Its publish-time
 * counterpart is `REFUSE_ASK_UNDECLARED`.
 */
export const ARG_ASK_KEY_HINT = "This becomes a field on every way of starting this workflow."

// ── COMPOSED — five values that name something the system holds ───────────────────────

/**
 * `ARG_READING_ASK` — arm 2's reading, naming the key it will be collected under.
 * ⚠ The quotation marks are the CURLY pair (U+201C / U+201D).
 */
export const ARG_READING_ASK = ({ key }: { key: string }): string => `Asked for as “${key}”`

/**
 * `ARG_READING_UPSTREAM` — arm 3's reading, naming the earlier step.
 *
 * ⚠ Sketch 214 #7: the AUTHOR'S OWN NAME for that step, never its slug. #6 binds the other
 * half — no template braces, no dotted path and no slug reaches the DOM beside the binding.
 */
export const ARG_READING_UPSTREAM = ({ step }: { step: string }): string =>
  `Whatever “${step}” produced`

/** `ARG_UNRENDERABLE` — the row-level sentence for a shape this form cannot fill, naming
 *  the argument. ⚠ Em dash (U+2014), curly quotes. */
export const ARG_UNRENDERABLE = ({ arg }: { arg: string }): string =>
  `“${arg}” is a list of items — this form cannot fill it in.`

/** `ARG_LEFTOVER` — the sentence on a stored key the action does not declare. It names the
 *  key and states the fact; `ARG_LEFTOVER_NEXT` is the control beside it. */
export const ARG_LEFTOVER = ({ arg }: { arg: string }): string =>
  `“${arg}” is not something this action accepts.`

/**
 * `ARG_STEP_IDENTITY` — the step's identity as this surface says it: ACTION then SERVICE.
 *
 * ⚠ The separator is the house MIDDLE DOT (U+00B7), not a bullet and not a full stop, and
 * the suite asserts the codepoint. This is the same composition `STEP_IDENTITY` carries in
 * `stepIdentityVocabulary.ts` — the argument form states it in its own table because the
 * form is where an author first meets it, and D-214-17's rule is that the MARK is a reuse.
 */
export const ARG_STEP_IDENTITY = ({
  action,
  service,
}: {
  action: string
  service: string
}): string => `${action} · ${service}`
