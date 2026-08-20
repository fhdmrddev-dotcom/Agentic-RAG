/**
 * Phase 200-05 Task 1 (DES-02 / D-09 / D-06 / D-07) — THE RUN RECEIPT'S WORDS.
 *
 * EVERY GOVERNED USER-FACING STRING ON THE RUN RECEIPT AND ON THE SPINE'S RUN TENSE, IN
 * ONE HOME: the header's three atoms, the seven per-step outcome words, the eight timing
 * readings, the declared-count phrase and the two branch readings. That is the WHOLE copy
 * table for this surface and not a subset of it — the `doorVocabulary.ts:5-13` rule,
 * copied for its mechanical reason rather than a tidy one. A module holding a SUBSET means
 * the module and `200-CHECKLIST.md` describe different things, and the next reader cannot
 * tell which strings are governed.
 *
 * ── ⚠ WHY THIS MODULE EXISTS AT ALL, AND WHY IT IMPORTS NOTHING FROM THE LIBRARY SUBTREE ─
 *
 * ⚠ THE MODULE AND THE DIRECTORY IT MUST NOT REACH ARE DELIBERATELY NOT SPELLED ANYWHERE IN
 * THIS FILE — its suite counts both needles over this source, and prose that quoted either
 * would make its own guard read `3` instead of `0`. That is the 187-24 trap, and it fired
 * on the FIRST draft of this very docblock. The rule is stated; the strings are not.
 *
 * CONTEXT D-09 says the past-tense words come from the library's own vocabulary module's
 * REGISTER, and that sentence invites exactly one wrong reading: it means the REGISTER —
 * the tone — and NOT the module. That module is fenced to its own subtree by an EXPLICIT
 * 14-path list (`librarySubtree.fences.test.ts`, whose `:169` asserts the list has length
 * 14 and whose `:202` asserts a non-recursive glob equals it). Importing it from here would
 * (a) put library words on a non-library surface, and (b) make `LIBRARY_SUBTREE_PATHS` stop
 * describing that subtree's own blast radius — i.e. it would BREAK the fence's contract
 * rather than TRIP it, so nothing over there could catch it. **Copy the tone, import
 * nothing.** (RESEARCH X-11 measured this; PATTERNS § 6 restates it as a binding invariant.)
 *
 * ── ⚠ AND IT DUPLICATES NONE OF `runVocabulary.ts`'s LOCKED CANVAS WORDS ───────────────
 *
 * Different AUDIENCE, which the hot-file ledger already records as the distinction that
 * matters: `runVocabulary.ts` speaks to someone watching ONE step happen right now
 * (present-continuous, one step); this module speaks to someone reading a WHOLE PAST RUN
 * (settled, past tense). Copying one register into the other is the recorded defect, so
 * `receiptVocabulary.test.ts` asserts mechanically that no string exported here EQUALS any
 * value in `RUN_READING_WORD`. Those canvas words are deliberately NOT quoted anywhere in
 * this file: a docblock that spelled them would make that check vacuous, which is the
 * 187-24 lesson this repo has now met four times.
 *
 * ── THE RULES THIS FILE KEEPS ─────────────────────────────────────────────────────────
 *
 *  1. ⚠ EXACT-MATCH ASSERTIONS ONLY. Several readings share a lead word ("ran ", "not "),
 *     so a `toContain` on any fragment is ambiguous and would pass while proving nothing.
 *  2. ZERO GLYPH STRINGS. `runVocabulary.ts` exports none and the library's own vocabulary
 *     nets none; a mark on this surface is a decision for `icon-convention.md`, not for a
 *     vocabulary module.
 *  3. THE ANTI-DRIFT PROPERTY ONLY HOLDS IF EVERY CONSUMER IMPORTS FROM HERE. One literal
 *     left in JSX is a second home, and a second home cannot be re-worded by a one-line
 *     diff. `RunReceipt.test.tsx` sweeps the receipt's own source for a sentence literal.
 *  4. THE COMPOSED READINGS ARE FUNCTIONS, NOT TEMPLATE FRAGMENTS SCATTERED AT THE CALL
 *     SITE. `timeInterrupted("8s")` is one home for `ran 8s, interrupted`; a caller that
 *     concatenated a prefix constant with a suffix constant would be a second home for the
 *     SENTENCE while looking like a single home for its parts.
 *  5. NO DURATION IS FORMATTED HERE. `@/lib/fmtElapsed` is THE formatter (the tree carried
 *     three before 194.1-06 hoisted it) and the DECISION about which reading applies lives
 *     in `phaseDuration.ts`. This module receives an already-formatted string and words it.
 *
 * A true leaf: type-only surface, no React, and it imports nothing at all — the
 * `decisionsVocabulary.ts` shape, which makes an ESM cycle impossible by construction.
 */

// ── The landmark ────────────────────────────────────────────────────────────────────────

/**
 * `receipt.landmark` — the receipt section's accessible name.
 *
 * ⚠ AN `aria-label` IS A USER-VISIBLE STRING. It is the text a screen-reader user receives,
 * so leaving it as a literal in JSX would be a second home for governed copy that simply
 * happens not to be legible to a sighted reviewer — which is the harder kind of drift to
 * notice, not the lesser one.
 */
export const RECEIPT_LANDMARK_LABEL = "Run receipt"

// ── The header: total runtime · step count · finish time ────────────────────────────────

/**
 * `header.span` — the run's total runtime, worded. The span is
 * `min(started_at) → max(completed_at)` across the phase rows (D-09), computed in
 * `phaseDuration.ts`; this function only words the formatted result.
 */
export function headerSpan(formattedDuration: string): string {
  return `Ran ${formattedDuration}`
}

/**
 * `header.span.absent` — ⚠ THE HONEST ARM, and it is a DIFFERENT STATEMENT from a zero.
 * A run whose phase rows carry no readable timestamps (every pre-migration-121 row, and a
 * run whose steps were all routed around) has a runtime we do not hold. It is never
 * rendered as `0s`, and never omitted silently — an omitted total reads as "instant".
 */
export const HEADER_SPAN_NOT_RECORDED = "Runtime not recorded"

/**
 * `header.steps` — the step count. Singular is spelled out rather than suffixed, because
 * `1 steps` is the tell of a count nobody read back.
 */
export function headerSteps(n: number): string {
  return n === 1 ? "1 step" : `${n} steps`
}

/**
 * `header.span.live` — the run's runtime SO FAR.
 *
 * ⚠ A SEPARATE SENTENCE FROM `headerSpan`, AND THE PAST TENSE IS THE WHOLE REASON. *"Ran 42s"*
 * on a run that is at that moment waiting for a person is a claim that it has stopped. The
 * figure is the same measurement; what changes is what the sentence asserts about it.
 */
export function headerSpanSoFar(formattedDuration: string): string {
  return `Running for ${formattedDuration}`
}

/** `header.finished` — the clock time the last step reached a terminal status. */
export function headerFinished(clockTime: string): string {
  return `finished ${clockTime}`
}

/**
 * `header.finished.live` — the run has not finished, and this says so instead of naming an
 * instant.
 *
 * ⚠ IT IS A THIRD SENTENCE, NOT A REUSE OF `HEADER_NOT_FINISHED`, and the three are pairwise
 * distinct on purpose:
 *   · `HEADER_NOT_FINISHED`  — it may well have finished; we hold no instant for it.
 *   · this                   — it has NOT finished; there is no instant to hold yet.
 *   · `headerFinished(t)`    — it finished, at t.
 * Folding the first two is the same defect this file already refuses twice over: an absence
 * of knowledge and an absence of the event are different facts, and only one of them tells a
 * person to keep waiting.
 */
export const HEADER_STILL_RUNNING = "not finished yet"

/**
 * `header.finished.absent` — the run has not reached a last completion yet, or none was
 * recorded. ⚠ Deliberately NOT the same sentence as `HEADER_SPAN_NOT_RECORDED`: one says
 * we do not know how long it took, the other says it has no finish instant to name.
 */
export const HEADER_NOT_FINISHED = "no finish time recorded"

/** `header.separator` — the one separator, so three atoms cannot drift into three styles. */
export const HEADER_SEPARATOR = " · "

// ── The per-step OUTCOME words (past tense, one whole run being read back) ───────────────

/**
 * `outcome.finished` — the step reached a terminal success. Past tense on purpose: the
 * receipt is read AFTER the fact, where a present-continuous word would be a claim about
 * now.
 */
export const OUTCOME_FINISHED = "finished"

/**
 * `outcome.failed` — ⚠ OUTCOME FIRST, so it cannot be skimmed as success, and it names
 * WHAT happened rather than blaming the author's step.
 */
export const OUTCOME_FAILED = "stopped on an error"

/**
 * `outcome.skipped` — D-09's own worded example, verbatim. ⚠ THIS IS NOT AN ABSENCE. The
 * step was routed around, which is an affirmative fact about the run: it never ran, and
 * saying so is correct silence rather than a missing value (D-06 / IDIOM-2).
 */
export const OUTCOME_NEVER_RAN = "never ran (skipped)"

/** `outcome.cancelled` — a person, or a shutdown, stopped the run underneath this step. */
export const OUTCOME_INTERRUPTED = "interrupted"

/** `outcome.active` — the receipt can be read mid-run; this step has not landed yet. */
export const OUTCOME_STILL_RUNNING = "still running"

/**
 * `outcome.pending` — the run ended before reaching this step. ⚠ NOT the same statement as
 * `OUTCOME_NEVER_RAN`: skipped means the run decided to route around it, pending means the
 * run never got that far. Folding the two would be the exact defect D-06 exists to prevent.
 */
export const OUTCOME_NOT_REACHED = "not reached"

/**
 * `outcome.unknown` — a status this build does not recognise. ⚠ NEVER SUCCESS BY DEFAULT
 * (the `runFacts.ts` T-15 rule): an unreadable status resolves here, never to a finish.
 */
export const OUTCOME_UNKNOWN = "outcome not recorded"

/**
 * `outcome.didNotFinish` — the step was still marked active when the run ended.
 * ⚠ NOT `OUTCOME_FAILED`: nothing on this row says the STEP failed, only that the run
 * around it stopped. Claiming a failure we did not observe is the same class of overclaim
 * as claiming a success.
 */
export const OUTCOME_DID_NOT_FINISH = "did not finish"

/**
 * `outcome.paused` — ⚠ THE READING WAVE 3 CREATED. `200-03` made `pause_run` the first
 * writer of `workflow_runs.status = 'paused'` in this project's history, so a run can now
 * legitimately read `paused` with an `active` phase row under it. Its SUMMARY states the
 * constraint this string obeys: it must not be spelled as *stopped*, *failed* or *waiting
 * to start* — none of those is what happened. Nothing is wrong, nothing has ended, and the
 * step HAS started; a person simply has not answered yet.
 */
export const OUTCOME_PAUSED = "paused, waiting on a person"

// ── The per-step TIME readings ─────────────────────────────────────────────────────────
//
// ⚠ ONE READING PER ROW, WHICH IS D-09'S OWN SHAPE. Its worked example puts `1.8s` and
// `never ran (skipped)` in THE SAME SLOT — a duration and a worded state are alternatives,
// never two columns to be filled independently. That is why the four functions below WORD
// the duration rather than returning a bare number: the row has one place to say what
// happened, and the reading has to be true on its own.

/**
 * `time.ran` — the plain duration of a step that finished, verbatim from D-09's example.
 * Bare, because the row's outcome label beside it already carries the verb.
 */
export function timeRan(formattedDuration: string): string {
  return formattedDuration
}

/** `time.running` — a live tick anchored on `started_at`, disclosed as incomplete. */
export function timeRunning(formattedDuration: string): string {
  return `${formattedDuration} so far`
}

/**
 * `time.interrupted` — D-06's worded arm, verbatim: how long it got, AND that it was cut
 * short. ⚠ The two facts travel together because a bare `8s` under a cancelled step reads
 * as a completed one.
 */
export function timeInterrupted(formattedDuration: string): string {
  return `ran ${formattedDuration}, interrupted`
}

/**
 * `time.failed` — a step that ran and then errored. ⚠ OUTCOME FIRST so it cannot be skimmed
 * as a success, and the duration second so the figure is still available.
 */
export function timeFailed(formattedDuration: string): string {
  return `stopped after ${formattedDuration}`
}

/**
 * `time.notRecorded` — ⚠ THE ARM A BOOLEAN CANNOT EXPRESS, and the reason this whole module
 * has a resolver beside it. A row that reached a terminal status with BOTH timestamps null
 * is a HISTORIC row: it really ran, before migration 121 existed, and its time was never
 * written. There is no backfill (`updated_at` would be right for some rows and silently
 * wrong for others with nothing on the row to say which), so the only honest reading is
 * that we do not hold the fact. **This is a different render from `OUTCOME_NEVER_RAN`,
 * which is a claim that it did not run at all.**
 */
export const TIME_NOT_RECORDED = "time not recorded"

// ── The declared per-step COUNT (D-07) ──────────────────────────────────────────────────

/**
 * `count.declared` — the pair rendered VERBATIM as the wire delivered it.
 *
 * ⚠ THE NOUN IS THE WIRE'S, NEVER THIS MODULE'S. `step_noun` is AUTHORED COPY owned by the
 * one executor that declares it (`200-CHECKLIST.md` §5.1), and substituting a word of our
 * own here would be a second home for a string the backend owns — and, worse, a claim about
 * the customer's DOMAIN that nothing measured (`SEED-168`: `312 docs matched` is a domain
 * sentence; `312 sources` is not).
 *
 * ⚠ THERE IS NO ABSENT ARM HERE ON PURPOSE. A step that declared no count renders NOTHING
 * — no `0`, no dash, no prose (D-07 / `SEED-159` / N-8) — so the caller must not reach this
 * function at all. A fallback string would make "declared nothing" indistinguishable from
 * "declared zero", which is the whole distinction `phaseDuration.ts` keeps.
 */
export function countDeclared(count: number, noun: string): string {
  return `${count} ${noun}`
}

/**
 * The three nouns `200-CHECKLIST.md` §5.1 records as this phase's AUTHORED COPY —
 * `llm_agent` ⇒ sources, `llm_batch_agents` ⇒ agents, `llm_emit` ⇒ fields.
 *
 * ⚠ THIS IS A DOCUMENTED EXPECTATION, NEVER A RENDER SOURCE, and the distinction is
 * load-bearing rather than pedantic. The words are authored at exactly ONE executor site
 * each (backend), and `countDeclared` above renders whatever the wire sent — including a
 * noun that is not in this list. Using this array to validate, translate or default a
 * rendered noun would create the second home §5.1 exists to forbid.
 */
export const RECEIPT_KNOWN_COUNT_NOUNS: readonly string[] = ["sources", "agents", "fields"]

// ── The branch readings (BS-MR-03, run tense ONLY) ──────────────────────────────────────

/**
 * `branch.taken` — ⚠ RUN TENSE ONLY. On a DRAFT definition this sentence is a fabricated
 * claim, which is precisely what `199-02` refused; it is reachable only through the spine's
 * optional run prop, and the authoring mount does not pass one.
 *
 * ⚠ THE WORDING IS A DECISION, RECORDED RATHER THAN SLIPPED IN. `200-CHECKLIST.md`'s
 * `BS-MR-03` names the atom by the sketch's two uppercase machine tokens. Those tokens
 * survive as `data-branch-reading` (so a driven verifier can still cite the row id), while
 * the RENDERED words are product English — the adopted design language's third rule is
 * never to name the mechanism to the reader, and `199-02` spent this component's other
 * engineering note for exactly that reason.
 */
export const BRANCH_TAKEN = "branch taken"

/**
 * `branch.notTaken` — the fork existed and the run went the other way. ⚠ Stated as a fact
 * about the RUN, never as a judgement on the author's step (the `FlowEdge.tsx`
 * `DETOUR_OPEN_LABEL` precedent, where *"nobody asked"* was reworded for the same reason).
 */
export const BRANCH_NOT_TAKEN = "branch not taken"
