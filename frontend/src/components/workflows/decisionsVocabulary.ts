/**
 * Phase 197-03 (AUTH-02, D-09 / D-10) — EVERY WORD THE ARRIVAL CARD'S **DECISIONS** HALF SHOWS
 * AN AUTHOR, PLUS THE FIVE-ROW ORDER AS DATA.
 *
 * `SeedReceipt`'s own copy home states the reason verbatim (`definitionOps.ts:601-603`):
 * *a sentence that lives inside a component is a sentence nobody can test for drift.* Four
 * shipped precedents on this exact surface put every user-visible string in a module and assert
 * it by character-identity. This is the fifth, and it carries one thing a component cannot —
 * the DECLARED ROW ORDER, exported as data, so D-07's *"always five, always the same order"*
 * is checkable at the module level rather than by counting JSX.
 *
 * ── WHY A NEW MODULE RATHER THAN `doorVocabulary.ts` (D-10, ANSWERED MECHANICALLY) ────────
 * `templateFirstVocabulary.ts:5-21` records the measurement: the D-24(a) copy fence builds its
 * needles by coercing EVERY export of `doorVocabulary` through a string `.replace`, so a
 * FUNCTION export lands in that expression and throws inside the needle builder — the fence
 * does not merely fail, it errors before it can sweep anything. Three of the values below are
 * functions, because they interpolate a count or switch on a row key. So `doorVocabulary` is
 * not merely a poor home, it is a home this module's shape is forbidden to take. A `.ts`
 * vocabulary module beside its surface is the shipped answer (`libraryVocabulary.ts`,
 * `templateFirstVocabulary.ts`).
 *
 * ── A TRUE LEAF ───────────────────────────────────────────────────────────────────────────
 * This module imports NOTHING — asserted in `decisionsVocabulary.test.ts`, not documented here,
 * for the reason `doorVocabulary.test.ts:527-561` states: a zero-import leaf is what makes this
 * subtree's cycle risk one-directional.
 *
 * ⚠ A CONSEQUENCE OF THE LEAF PROPERTY, STATED RATHER THAN SMOOTHED. `GOVERNANCE_SEAL_LABEL`
 * lives in `definitionOps.ts` and is a LOCKED string with its own substitution audit; every
 * shipped sentence that reaches for it COMPOSES it (`seedReceiptGroundingLead`,
 * `seedReceiptStepReason`) rather than re-typing it. A leaf cannot compose what it cannot
 * import — so `groundingFoldSummary` below deliberately does NOT reach for that vocabulary at
 * all. It states a plain fact about the steps and leaves the governance sentence to the receipt
 * inside the fold, which owns it. *Two spellings of a locked string is how a locked string
 * stops being locked* (`builderStore.ts:147`), and a near-spelling is still a second spelling.
 *
 * ── THE FIVE RULES EVERY STRING BELOW FOLLOWS ─────────────────────────────────────────────
 *
 *  1. **D-20 — NO ROW MAY CLAIM WHAT THE GATE DOES NOT DO.** Research enumerated every gauntlet
 *     stage from source: `business_requirement_missing` (`grounding.py:1007`) is the ONLY
 *     definition-level predicate. Nothing anywhere refuses on a missing knowledge-base binding,
 *     a missing template, an AI-chosen name or the deliverable — so four of the five rows saying
 *     otherwise would be four false claims about the gate. **No exported value below contains
 *     the gate-claim word at all**, and that is a fence in the suite rather than a promise here.
 *     Row 3's verdict is not authored in this repository: per D-12 it is the server's
 *     `BUSINESS_REQUIREMENT_MISSING_MESSAGE`, travelling on the D-13 payload and rendered
 *     verbatim (`grounding.py:995-997` — *"this string IS the UI copy"*).
 *  2. **D-16 — THE CARD SAYS A MODEL MADE A CHOICE. IT NEVER SAYS THE CHOICE IS GOOD, DURABLE
 *     OR CORRECT.** Measured basis: `gpt-5.5` named one-run parameters in 5 of 5 requirements
 *     and all 20 were still correctly stamped, because the stamp's question is the anti-echo
 *     one. No value below is an endorsement, and none is a warning about quality either.
 *  3. **D-03's LIMIT IS STATED, NOT HIDDEN** — `DECISION_EDIT_LIMIT_NOTE`, one line, shown only
 *     inside the opened fold so it costs nothing at arrival (sketch 172 measured it at 30 px).
 *  4. **ABSENCE IS STATED AS ABSENCE.** The four `*_NONE` values each say plainly that there is
 *     none. None of them says the absence is fine — `templateAdmission`'s three-arm lesson
 *     (`soulData.ts:184-196`).
 *  5. **A CALLER MAY PASS A NUMBER OR A ROW KEY; A CALLER MAY NEVER ASSEMBLE A SENTENCE**
 *     (`templateFirstVocabulary.ts:25-26`). Every interpolated half below is DATA.
 *
 * ⚠ NAME IDENTIFIERS, NEVER WORDS, IN EVERY COMMENT IN THIS FILE. `builderStore.ts:186-194`
 * records a docblock that quoted the import form it was explaining and turned its own fence
 * red. The D-20 word rule 1 forbids is therefore not spelled anywhere in this file — not in a
 * value, and not in a comment explaining that it is banned.
 */

// ── D-07 · the five rows, and their order, as DATA ────────────────────────────────────────

/** The five decisions the generation made on the author's behalf. */
export type DecisionRowKey =
  | "knowledge-base"
  | "template"
  | "requirement"
  | "name"
  | "deliverable"

/**
 * D-07's fixed order, as DATA rather than as JSX sequence.
 *
 * Rejected at discussion: *only rows needing attention*, and *all rows with the weak ones
 * flagged*. Both require a per-row *"did the AI get this right?"* predicate, and for the
 * requirement row NO SUCH PREDICATE EXISTS (`SEED-163`). A fixed row set is also testable by
 * COUNT, which is what makes this a `readonly` tuple and not an array the caller filters.
 */
export const DECISION_ROW_ORDER = [
  "knowledge-base",
  "template",
  "requirement",
  "name",
  "deliverable",
] as const satisfies readonly DecisionRowKey[]

/**
 * Each row's label — the SUBJECT of the decision, never a judgement about it (rule 2).
 *
 * THE `default:` ARM IS AN EXHAUSTIVENESS GUARD, the `seedReceiptStepReason` idiom
 * (`definitionOps.ts:803-808`). A sixth `DecisionRowKey` is a TYPECHECK error here rather than a
 * blank line on the card — it has to be, because the card renders the label as the row's only
 * heading, so an unhandled key would print a row with no subject.
 *
 * ⚠ The five are asserted PAIRWISE DISTINCT in the suite, the `FOOTING_UNAVAILABLE` MUST NOT
 * MERGE rule (`templateFirstVocabulary.ts:100-106`): two rows sharing a label is two rows nobody
 * can tell apart, on a card whose entire subject is that each decision has one answer.
 */
export function decisionRowLabel(key: DecisionRowKey): string {
  switch (key) {
    case "knowledge-base":
      return "The documents it can read"
    case "template":
      return "The document it fills in"
    case "requirement":
      return "The requirement it works to"
    case "name":
      return "What this workflow is called"
    case "deliverable":
      return "What it hands back"
    default: {
      // A 6th `DecisionRowKey` must be given its own label HERE. At runtime an unmodelled
      // member still yields the empty string rather than throwing.
      const _never: never = key
      void _never
      return ""
    }
  }
}

// ── the two fold summary lines (sketch 174) ───────────────────────────────────────────────

/** Total, non-negative whole count — `definitionOps.ts:618-622`, verbatim in force. A copy
 *  formatter is handed numbers derived from author-supplied JSONB, so NaN / negative /
 *  fractional all have to resolve rather than reach the card. */
function wholeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  const whole = Math.trunc(value)
  return whole > 0 ? whole : 0
}

/**
 * The first openable line — how many steps lean on the author's own documents.
 *
 * ZERO RETURNS THE EMPTY STRING, the shipped `seedReceiptGroundingLead` shape
 * (`definitionOps.ts:667-676`): the card then renders ONE conditional line rather than a
 * sentence claiming zero of something, and the arrival shape stays the same either way.
 *
 * ⚠ IT DOES NOT REACH FOR THE GOVERNANCE VOCABULARY — see the leaf note in the header. This
 * line states a plain fact and hands the author to the receipt inside the fold, which owns the
 * seal sentence and composes it from the locked identifier.
 */
export function groundingFoldSummary(count: number): string {
  const n = wholeCount(count)
  if (n === 0) return ""
  return n === 1 ? "1 step depends on your documents" : `${n} steps depend on your documents`
}

/**
 * The second openable line — sketch 174's own proposal, and the sentence that names what the
 * whole card is for: an AI just made choices on your behalf, and here is how many.
 */
export function decisionsFoldSummary(count: number): string {
  const n = wholeCount(count)
  if (n === 0) return ""
  return n === 1 ? "1 decision I made for you" : `${n} decisions I made for you`
}

/** The first fold's action word (sketch 174) — it opens the reasons, it does not act. */
export const GROUNDING_FOLD_ACTION = "why"

/** The second fold's action word (sketch 174). */
export const DECISIONS_FOLD_ACTION = "review"

// ── what a row shows when the answer is an ABSENCE (rule 4) ───────────────────────────────

/** Row 1 with no `project_folder_id`. States the consequence, never that it is acceptable. */
export const DECISION_KB_NONE = "No documents — this workflow reads nothing of yours."

/** Row 2 with no bound template. ⚠ Deliberately NOT the `FOOTING_*` tail: those sentences are
 *  `templateFirstVocabulary`'s and belong to the pre-draft screen, and a second home for one of
 *  them here is the drift this module exists to prevent. */
export const DECISION_TEMPLATE_NONE = "No template — nothing is filled in from a document."

/** Row 3 with no `business_requirement`. ⚠ It states the absence and stops: the verdict about
 *  what that absence COSTS is the server's sentence, travelling on the D-13 payload (D-12). */
export const DECISION_REQUIREMENT_NONE = "No requirement was written for this workflow."

/** Row 4 with no `meta.name`. D-19 makes the drafted header render the generated id in exactly
 *  this case, so the row names what the author is actually looking at. */
export const DECISION_NAME_NONE = "No name yet — the header is showing the generated id."

// ── row 5's two honest answers (D-18) ─────────────────────────────────────────────────────

/** Derived by the caller from `terminalEmitSlug`. Row 5 reads as a FACT about the last step. */
export const DECISION_DELIVERABLE_FILE = "It produces a file you can download."

/** The other honest answer. It names the absence of a file rather than leaving it implied. */
export const DECISION_DELIVERABLE_CHAT = "It answers in the chat — no file is produced."

// ── row actions ───────────────────────────────────────────────────────────────────────────

/**
 * Hands the author to the control ALREADY ON THE SCREEN — sketch 174's load-bearing property:
 * *each decision hands you to the control already on the screen; nothing is duplicated*. The
 * page's own rule, quoted in the `kbAffordance` docblock (`WorkflowBuilderPage.tsx:2085`): *a
 * second, different answer to one question is drift.*
 */
export const DECISION_CHANGE_ACTION = "Change"

/** Row 5's action. D-18: it jumps to the terminal `llm_emit` step rather than inline-editing
 *  its Instructions, which would put that field in two places at once. */
export const DECISION_OPEN_STEP_ACTION = "Open the step"

/** D-17 — the inline field's accessible label. `ForkNameDialog` is DECLINED for this row: it
 *  exists for naming a copy that does not yet exist, whereas here the name already exists and
 *  is being edited, and a modal for one of five rows breaks the surface's own grammar. */
export const DECISION_NAME_FIELD_LABEL = "Workflow name"

// ── D-03's stated limit ───────────────────────────────────────────────────────────────────

/**
 * ONE line, shown inside the OPENED decisions fold.
 *
 * D-03 locks that answering a row writes straight into the draft through the store path a
 * manual edit already takes — instant, free, deterministic, and the author's answer final by
 * construction. Its known limit is that the rest of the draft was built around the OLD answer.
 * CONTEXT.md leaves it to Claude's discretion whether the surface SAYS so; it is taken here,
 * because a limit an author discovers by being surprised is worse than one line of copy.
 */
export const DECISION_EDIT_LIMIT_NOTE =
  "Changing an answer updates the workflow — the steps already written around the old answer stay as they are."
