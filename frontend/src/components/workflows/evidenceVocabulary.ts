/**
 * Phase 289 (TRUST-01 / D-14a) — every word and glyph of the step evidence line, in ONE home.
 *
 * The acceptance bar is `.planning/sketches/289-confidence-on-a-step/` variant B:
 *
 *     Answered from Procurement KB · 6 passages · ● Medium · 0.47
 *     Searched Procurement KB · nothing matched · ○ No match found
 *
 * `StepEvidenceLine.tsx` only JOINS these; it authors no sentence of its own, so the live run
 * spine and the evidence report (which mount the same leaf) cannot word the line two ways.
 *
 * GLYPHS. ✓ ● ⚠ are the 028 ConfidenceChip anatomy's three tiers (glyph + word + raw score;
 * there they are lucide marks, here the sketch's characters). ○ is the sketch's own mark for
 * "searched, nothing matched" and is NET-NEW to the icon convention — recorded as a proposal in
 * `289-02-SUMMARY.md`, not passed off as shipped vocabulary. They live here rather than in
 * `receiptVocabulary.ts` because that file's rule 2 bans glyphs.
 *
 * ⚠ These are RETRIEVAL confidence words (chat's 0.54 / 0.38 buckets over cosine similarity),
 * never the metadata ConfidenceChip's 0.75 / 0.5 extraction tiers. Same anatomy, different
 * measurement; nothing here imports that chip.
 */

export const ANSWERED_FROM = "Answered from"
export const SEARCHED = "Searched"
export const NOTHING_MATCHED = "nothing matched"
export const SEPARATOR = "·"

/** "1 passage" / "6 passages". */
export function passages(n: number): string {
  return `${n} ${n === 1 ? "passage" : "passages"}`
}

export type EvidenceLevel = "high" | "medium" | "low" | "none"

export interface ConfidenceFace {
  glyph: string
  word: string
}

/** level -> { glyph, word }. Read through `own()`: a level arrives as wire data. */
export const CONFIDENCE_FACE: Record<EvidenceLevel, ConfidenceFace> = {
  high: { glyph: "✓", word: "High" },
  medium: { glyph: "●", word: "Medium" },
  low: { glyph: "⚠", word: "Low" },
  none: { glyph: "○", word: "No match found" },
}

// 296-04 (289-IN-06): the report is read by colleagues too, so the sentence names the knowledge
// base rather than "your documents", which was untrue for anyone but the owner.
export const NO_MATCH_EXPLANATION =
  "The knowledge base returned nothing for this step — its output is not drawn from the knowledge base."

// ── Phase 289-04 (VIS-03 / D-14a) — THE EVIDENCE REPORT'S WORDS, appended ──────────────────
//
// The acceptance bar is `.planning/sketches/289-run-evidence-page/` variant B (the printable
// report). `evidenceView.ts` composes these into the view-model and `RunEvidenceReport.tsx`
// renders that view-model; neither spells a sentence of its own. Glyphs: ◉ (read-only mark),
// ⤓ (download), ⎙ (print), ◆ (deliverable file), ✓ / ✕ (result), ⚠ (changed banner) — all
// from the sketch, and recorded against the icon convention in `289-04-SUMMARY.md`.

export const READ_ONLY_MARK = "Read-only record"
export const READ_ONLY_GLYPH = "◉"
export const DOWNLOAD_JSON = "Download JSON"
export const DOWNLOAD_GLYPH = "⤓"
export const PRINT_REPORT = "Print / save as PDF"
export const PRINT_GLYPH = "⎙"
export const OPEN_THREAD = "Open the chat thread"
export const DOWNLOAD_DELIVERABLE = "Download the deliverable"
export const DOWNLOAD_DELIVERABLE_FAILED = "Download failed — try again."
// 296-04 (289-F-C): an owner's file deliverable with no file link says why there is no button.
export const DOWNLOAD_UNAVAILABLE = "Download unavailable — this file has no link."
export const UNTITLED_WORKFLOW = "Untitled workflow"
export const YOU_MARK = "(you)"

/** The JSON file name: `run-evidence-<first 8 chars of the run id>.json`. */
export function exportFileName(runId: string): string {
  return `run-evidence-${runId.slice(0, 8)}.json`
}

// The states that are not a report.
export const REPORT_LOADING = "Opening the run record…"
export const NOT_AVAILABLE_HEAD = "This run isn't available"
export const NOT_AVAILABLE_BODY =
  "It may not exist, or it belongs to an organisation you're not in. Nothing about it is shown here."
export const REPORT_BACK = "‹ Back to Workflows"
export const REPORT_BROKEN_HEAD = "We couldn't load this run's record."
export const REPORT_BROKEN_BODY = "Something went wrong on our side. Nothing about the run has changed."
export const REPORT_TRY_AGAIN = "Try again"

// The title block's sub line.
export function outcomeIn(status: string, span: string | null): string {
  const word = status === "failed" ? "Failed" : status === "cancelled" ? "Cancelled" : "Completed"
  if (span === null) return `${word}, runtime not recorded`
  return status === "completed" ? `${word} in ${span}` : `${word} after ${span}`
}

export function startedByLine(when: string | null, name: string, you: boolean): string {
  const who = you ? `${name} ${YOU_MARK}` : name
  return when === null ? `started by ${who}` : `started ${when} by ${who}`
}

// The facts strip.
export const FACT_RESULT = "Result"
export const FACT_VERSION = "Version run"
export const FACT_CHECKS = "Checks"
export const FACT_DELIVERABLE = "Deliverable"
export const RESULT_COMPLETED = "✓ Completed"
export const RESULT_FAILED = "✕ Failed"
export const RESULT_CANCELLED = "Cancelled"
export const VERSION_NOT_RECORDED = "Not recorded"
export const NO_CHECKS_RAN = "No checks ran"
export const DELIVERABLE_TEXT = "Written answer"
export const DELIVERABLE_NONE = "None"
export const DELIVERABLE_FILE_GLYPH = "◆"
export const DELIVERABLE_UNNAMED_FILE = "a file"

export function versionShort(v: number): string {
  return `v${v}`
}

export function checksPassed(passed: number, total: number): string {
  return `${passed} of ${total} passed`
}

// The two banners (D-04).
export const CHANGED_HEAD = "This workflow has changed since this run."
export const CHANGED_GLYPH = "⚠"

export function changedBody(ran: number | null, current: number | null): string {
  const shows =
    ran === null
      ? "The page shows the version this run used, exactly as it ran."
      : `The page shows version ${ran}, exactly as it ran.`
  return current === null ? shows : `${shows} The current version is ${current}.`
}

export const PREDATES_BANNER =
  "This run predates version recording, so the definition below is the workflow as it is stored now, not a copy taken when it ran."

// The four sections.
export const SECTION_RAN = "What it ran"
export const SECTION_RAN_LEDE = "The workflow definition as it was when this run started."
export const SECTION_HAPPENED = "What happened, step by step"
export const SECTION_HAPPENED_LEDE = "Confidence appears only on steps that answered from the knowledge base."
export const SECTION_CHECKS = "Checks and verdicts"
export const SECTION_SOURCES = "Sources it used"
export const SECTION_SOURCES_LEDE = "Every document a step cited, with where in it."

export function definitionHeading(version: number | null, steps: number): string {
  const v = version === null ? "Version not recorded" : `Version ${version}`
  return `${v} · ${steps} ${steps === 1 ? "step" : "steps"}`
}

export const SHOW_FULL_DEFINITION = "Show the full definition"
export const FULL_DEFINITION_NOT_RECORDED = "The full definition was not recorded for this run."

export const LOG_COL_N = "#"
export const LOG_COL_STEP = "Step"
export const LOG_COL_STATUS = "Status"
export const LOG_COL_TIME = "Time"

/** A step's status word on the report. Read through `own()`: the status is wire data. */
export const STEP_STATUS_WORD: Record<string, string> = {
  completed: "✓ Done",
  failed: "✕ Failed",
  cancelled: "Interrupted",
  skipped: "Skipped",
  pending: "Not reached",
  active: "Did not finish",
}
export const STEP_STATUS_UNKNOWN = "Status not recorded"

export function whyItStopped(reason: string): string {
  return `Why it stopped: ${reason}`
}

// ── Phase 295-05 (RUN-04 / D-22 / UI-SPEC C.1) — a failed run with nothing recorded says so.
// One home: the run page's `RunEndReasonLine` and the evidence report's title block both read it.
export const NO_REASON_RECORDED = "No reason was recorded when this run failed."

// ── Phase 295-05 (RUN-01 / D-04 / UI-SPEC B.1) — the mark on a step kept without sources.
//
//     ◌ Unsourced · continued by Fahad Murad (you)
//     This output was kept without sources — it does not cite any document.
//
// 296-04 (289-IN-06): the note said "your documents", which a colleague reading the record took
// as theirs. It now names no owner.
//
// ◌ (U+25CC, dotted circle) is NET-NEW to the icon convention and is recorded as a PROPOSAL in
// `295-05-SUMMARY.md`, the way 289 recorded ○. It is deliberately not ○: ○ already means
// "searched, nothing matched" on the same line, and in the 0-sources case both marks stack.
// The name after "continued by" is server-built and viewer-aware; this file never composes one.
export const UNSOURCED_GLYPH = "◌"
export const UNSOURCED_WORD = "Unsourced"
export const UNSOURCED_CONTINUED_BY = "continued by"
export const UNSOURCED_NOTE =
  "This output was kept without sources — it does not cite any document."

// The human-input lines (R-04: a colleague sees only that the step waited).
export function quotedAnswer(answer: string): string {
  return `“${answer}”`
}

export function answeredBy(name: string): string {
  return `— ${name}`
}

export const NOT_ANSWERED = "Not answered"
export const WAITED_ANSWERED = "Waited for an answer · answered"
export const WAITED_NOT_ANSWERED = "Waited for an answer · not answered"

// Section 3 — one sentence per recorded verdict kind (the harness_audit event types 289-03
// ships). Read through `own()`: the kind is wire data, and an unknown kind gets the plain
// fallback rather than a guessed sentence.
export const VERDICT_SENTENCE: Record<string, string> = {
  gate_passed: "The step's checks passed",
  gate_failed: "The step's checks did not pass",
  // 289-REVIEW WR-03: composed server-side for a wall-clock timeout (no validator ran).
  gate_timed_out: "The step timed out before its checks ran",
  emit_validated: "The deliverable matched its required shape",
  emit_rejected: "The deliverable did not match its required shape",
  emit_integrity_failed: "The deliverable failed its integrity check",
  validator_ask_user_approved: "A person approved the step's output",
  policy_applied: "A governance policy was applied",
  action_risk_pending: "A risky action was held for approval",
  tool_refused: "A tool call was refused",
  external_action_sent: "An external action was sent",
  circuit_breaker_tripped: "The run was stopped by its safety limit",
}
export const VERDICT_UNKNOWN = "A check was recorded"
export const VERDICT_KIND_CHECK = "Check"
export const VERDICT_KIND_RECORDED = "Recorded decision"
export const VERDICT_RESULT_WORD: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  recorded: "Recorded",
}
export const VERDICT_GLYPH: Record<string, string> = { passed: "✓", failed: "✕" }
export const NO_VERDICTS = "No checks were recorded for this run."

export function stepRef(n: number): string {
  return `step ${n}`
}

export function checkedKinds(kinds: readonly string[]): string {
  return `checked: ${kinds.join(", ")}`
}

// Section 4 — sources (R-01: a masked source keeps only its cited-by).
export const MASKED_SOURCE = "A document you don't have access to"
export const UNNAMED_SOURCE = "A document with no recorded name"
export const NO_SOURCES = "No documents were cited in this run."

/** Chunk numbering is `chunk_index + 1`, the CitationCard convention. */
export function passageList(chunkIndexes: readonly number[]): string {
  return chunkIndexes.map((i) => `passage ${i + 1}`).join(", ")
}

export function citedBy(steps: readonly number[]): string {
  return `cited by ${steps.map(stepRef).join(", ")}`
}
