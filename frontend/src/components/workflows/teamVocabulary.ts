/**
 * Phase 290-01 (VIS-01, D-09 .. D-20) — EVERY WORD THE TEAM PICTURE SHOWS.
 *
 * The team picture (290-03) renders what `teamModel.deriveTeam` returns. Every string it can
 * put on screen lives here as an exported value, so a copy change is a one-line diff in one
 * file and a test can assert each word by character-identity.
 *
 * ── A TRUE LEAF ───────────────────────────────────────────────────────────────────────────
 * This module imports NOTHING. That is asserted in `teamVocabulary.test.ts` over this file's
 * raw source, not merely documented here. Two consequences, stated rather than smoothed:
 *
 *  1. **Step words are NOT here (D-15).** A step's role is the shipped type sentence from
 *     `phaseVocabulary.ts`; the derivation composes it there. Copying any of those sentences
 *     into this file would be a second spelling of a shipped string.
 *  2. **The governance seal label is NOT here either.** It lives in `definitionOps.ts` as a
 *     locked string, and the derived citations check composes it in `teamModel.ts`. A leaf
 *     cannot compose what it cannot import, so this file never re-types it.
 *
 * ── THE RULES EVERY STRING BELOW FOLLOWS ──────────────────────────────────────────────────
 *  - **Absence is said once, in words (D-12, D-13).** No empty slot ever stands in for a
 *    missing judge or a missing check; one of the `TEAM_*` lines says so instead.
 *  - **Failure words follow the engine (D-19).** A post gate redoes its step up to
 *    `max_retries` times before it routes; a pre gate does not redo. `failRedoThen` says the
 *    redo, then what happens when the redos run out.
 *  - **A caller passes numbers and finished words; it never assembles a sentence.** Every
 *    formatter is TOTAL: a non-finite or negative number floors to 0, a fraction truncates,
 *    and nothing throws.
 *
 * ⚠ Name identifiers, never retired words, in every comment in this file — the governance
 * sweep reads string literals only, but a reader copying a comment should not copy a
 * retired phrase back into a value.
 */

// ── number floor ──────────────────────────────────────────────────────────────────────────

/** The one coercion every formatter uses: finite and non-negative, else 0; truncated. */
function whole(n: number): number {
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

// ── the Steps | Team switch (D-06) ────────────────────────────────────────────────────────

/** The tablist's accessible name. */
export const TEAM_SWITCH_LABEL = "Show steps or team"

/** The Steps segment. */
export const TEAM_SWITCH_STEPS = "Steps"

/** The Team segment. */
export const TEAM_SWITCH_TEAM = "Team"

/** The muted hint beside the switch when Team is showing. */
export const TEAM_HEADER_HINT = "who does each step, and what checks it"

/** The figure's accessible name. */
export function teamFigureLabel(name: string): string {
  return `Team picture for ${name}`
}

/** 302-02 (FE-IN-06 / D-11, UI-D12): the scroll region's name — the figure inside already says the workflow's name. */
export const TEAM_SCROLL_REGION_LABEL = "Team view, scrollable"

// ── the orchestrator node (D-09) ──────────────────────────────────────────────────────────

/** The orchestrator's eyebrow. */
export const ORCHESTRATOR_EYEBROW = "Orchestrator"

/** The orchestrator's title, singular arm for one step. */
export function orchestratorTitle(n: number): string {
  const count = whole(n)
  if (count === 1) return "Syrel runs the one step"
  return `Syrel runs the ${count} steps in order`
}

/** The orchestrator's subtitle for two or more steps. */
export const ORCHESTRATOR_SUB =
  "Gives each step its turn and keeps one shared record. Every step reads what the earlier steps produced."

/** The orchestrator's subtitle for a single step. */
export const ORCHESTRATOR_SUB_ONE = "Gives the step its turn and keeps what it produces."

// ── gate cards (D-16) ─────────────────────────────────────────────────────────────────────

/** A gate whose kind is the LLM rubric judge. */
export const GATE_JUDGE = "Judge"

/** Every other gate. */
export const GATE_CHECK = "Check"

/** A gate card's eyebrow: `Judge · step 3`. */
export function gateEyebrow(word: string, n: number): string {
  return `${word} · step ${whole(n)}`
}

/** The words on a derived action-risk checkpoint (D-17). */
export const GATE_ARMED_WORDS = "Stops and asks you before it acts"

/** The floor for a validator with no kind set — never an empty card. */
export const GATE_KIND_MISSING = "A check with no kind set"

/**
 * The words line on a declared gate card, keyed by `ValidatorSpec.kind`. An unknown kind
 * renders its raw string (the honest floor), read through `own()` by the derivation.
 */
export const GATE_KIND_WORDS: Record<string, string> = {
  llm_judge_rubric: "Grades the work against a rubric",
  citations_required: "Must point at the documents it used",
  output_file_valid: "The file must open",
  regex_match: "Must match a set pattern",
  json_schema: "Must match a set shape",
  workspace_file_exists: "A named file must exist",
  freshness: "Its sources must be recent",
  structure_check: "Must have the right sections",
  programmatic: "A fixed check the server runs",
  action_risk_approval: "Asks you before it acts",
}

// ── failure words (D-10, D-19) ────────────────────────────────────────────────────────────

/** The lead before a gate's failure words. */
export const FAIL_LEAD = "If it fails:"

/** `fail_run`, `retry` on exhaustion, and the backend default when `on_failure` is absent. */
export const FAIL_STOP = "stop the run"

/** `ask_user`, and the engine citations gate's outcome since Phase 295. */
export const FAIL_ASK = "ask you"

/** A post gate redoes its step before it routes: `redo the step (up to 2 times), then …`. */
export function failRedoThen(n: number, then: string): string {
  const count = whole(n)
  const unit = count === 1 ? "time" : "times"
  return `redo the step (up to ${count} ${unit}), then ${then}`
}

/** A resolvable `skip_to_phase` target. */
export function failJump(n: number): string {
  return `⤳ jump to step ${whole(n)}`
}

/** An unresolvable `skip_to_phase` target: the engine fails the run, and no line is drawn. */
export const FAIL_JUMP_MISSING = "jump to a step this workflow doesn't have, so the run stops"

/** The label on the one kind of line that may join a check to another step. */
export const JUMP_LINE_LABEL = "⤳ only if the check fails"

// ── step and batch words (D-14) ───────────────────────────────────────────────────────────

// 296-07 (290-IN-02) — the floor for a step with no `phase_type` moved to ONE home,
// `phaseVocabulary.STEP_UNTYPED`. It is not re-exported here because this leaf imports
// nothing (its suite fences that); `teamModel.ts` reads the home directly.

/** A batch step's capacity, never a headcount. */
export function seatsLabel(n: number): string {
  return `up to ${whole(n)} at once`
}

// ── absence, said once (D-12, D-13) ───────────────────────────────────────────────────────

/** A single-step workflow. */
export const TEAM_ONE_STEP = "One step, so there is no team to coordinate."

/** No gate at all, declared or derived. */
export const TEAM_NO_GATES = "Nothing checks this work."

/** At least one gate, none of them a judge. */
export const TEAM_NO_JUDGE = "Checked by rule, not by a judge."

/** The zero-step heading. */
export const TEAM_EMPTY_HEADING = "No steps yet, so there is no team to show."

/** The zero-step body. */
export const TEAM_EMPTY_BODY = "Add a step in Steps to see who does the work."

/** The caption under every non-empty picture (D-09). */
export const TEAM_CAPTION =
  "Built from this workflow's definition. Steps never pass work to each other; each one reads what the earlier steps produced."

// ── the ⌥ ledger ──────────────────────────────────────────────────────────────────────────

/** The ledger heading. */
export const LEDGER_HEADING = "Every line on this picture"

/** The ledger's closing line. */
export const LEDGER_NO_LINKS =
  "0 step-to-step links. The definition has no field for one, so none is drawn."

/** A handoff row: `Orchestrator → step 1`. */
export function ledgerHandoff(n: number): string {
  return `Orchestrator → step ${whole(n)}`
}

/** A gate row: `Judge → step 3`. */
export function ledgerGate(word: string, n: number): string {
  return `${word} → step ${whole(n)}`
}

/** A jump row: `⤳ step 2 → step 5, only if the check fails`. */
export function ledgerJump(from: number, to: number): string {
  return `⤳ step ${whole(from)} → step ${whole(to)}, only if the check fails`
}

/** A seat row: `Step 3: up to 5 at once`. */
export function ledgerSeats(n: number, seats: number): string {
  return `Step ${whole(n)}: up to ${whole(seats)} at once`
}
