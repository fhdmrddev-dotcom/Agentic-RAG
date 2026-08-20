/**
 * Phase 200 · the run transcript's WORDS (sketch `run-surface.html`, WIRE rows 1 + 2).
 *
 * EVERY GOVERNED USER-FACING STRING THE TRANSCRIPT SPELLS OF ITS OWN, IN ONE HOME: the
 * landmark and the two honest-absence headlines. That is the WHOLE
 * table and not a subset of it — the `doorVocabulary.ts` rule, kept for its mechanical
 * reason rather than a tidy one: a module holding a SUBSET means the next reader cannot
 * tell which strings are governed.
 *
 * ── ⚠ WHY IT IS THREE STRINGS AND NOT FORTY ────────────────────────────────────────────
 *
 * The transcript renders three kinds of text and AUTHORS only one of them:
 *
 *   • the step's NAME — the page's, through `nodeTitle`'s ladder. Re-deriving it here
 *     would give the same step a different face in the log than on the spine beside it.
 *   • the step's PAST-TENSE outcome, its duration reading and its declared count — all
 *     three from `receiptVocabulary.ts` by way of `phaseDuration.ts`, so the log and the
 *     receipt below it provably cannot word the same fact two ways.
 *   • the step's LIVE reading (still running · waiting for you · failed) — the CANVAS
 *     register, handed down by the page as an already-worded label. ⚠ That is deliberate
 *     and it is the one place this module could have gone wrong: someone watching a step
 *     happen right now is the canvas vocabulary's audience, not the receipt's, and
 *     minting a third phrasing here would be the two-views-two-languages defect told in
 *     copy instead of in layout.
 *
 * So what is left to author is exactly what no other surface already says.
 *
 * ── THE RULES THIS FILE KEEPS (inherited verbatim from `receiptVocabulary.ts`) ────────
 *
 *  1. ⚠ EXACT-MATCH ASSERTIONS ONLY — a `toContain` on a fragment passes while proving
 *     nothing.
 *  2. ZERO GLYPH STRINGS. A mark on this surface is a decision for `icon-convention.md`,
 *     not for a vocabulary module.
 *  3. THE ANTI-DRIFT PROPERTY ONLY HOLDS IF EVERY CONSUMER IMPORTS FROM HERE. One literal
 *     left in JSX is a second home, and a second home cannot be re-worded by a one-line
 *     diff. `RunTranscript.test.tsx` sweeps that component's own `?raw` source for a
 *     sentence literal.
 *  4. ⚠ NO STRING HERE MAY EQUAL ONE EXPORTED BY `receiptVocabulary.ts` OR ANY VALUE IN
 *     `RUN_READING_WORD`. Equality would mean this module had quietly become a second home
 *     for a word that already has one; the suite asserts it mechanically, over the real
 *     exports rather than over a hand-listed copy.
 *
 * ⚠ THE FORBIDDEN NEIGHBOURS ARE NOT SPELLED IN THIS PROSE. Rule 4's check is a comparison
 * against imported values, but this tree's suites also sweep sources for needles, and the
 * 187-24 trap has now fired five times in it — a docblock that quoted a governed word would
 * make its own guard count that word as a live occurrence. The rule is stated; the strings
 * are not.
 *
 * A true leaf: no React, no JSX, and ZERO imports — the `decisionsVocabulary.ts` /
 * `receiptVocabulary.ts` shape, which makes an ESM cycle impossible by construction.
 */

// ── The landmark ────────────────────────────────────────────────────────────────────────

/**
 * `transcript.landmark` — the log region's accessible name.
 *
 * ⚠ AN `aria-label` IS A USER-VISIBLE STRING. It is the text a screen-reader user receives,
 * so leaving it as a literal in JSX would be a second home for governed copy that simply
 * happens not to be legible to a sighted reviewer — the harder kind of drift to notice.
 */
export const TRANSCRIPT_LANDMARK_LABEL = "Run log"

// ── The two absences, which are two DIFFERENT statements ────────────────────────────────

/**
 * `transcript.empty` — the run carries NO phase rows at all.
 *
 * ⚠ A DIFFERENT FACT FROM THE ONE BELOW, and keeping them apart is the D-06 rule this
 * repo has now learned four times (`runFacts.ts`'s fourth arm, `DecisionsList`'s third,
 * `phaseDuration.ts`'s nine). This one says the run has no steps recorded against it; the
 * next says it has steps whose CLOCK we do not hold. Folding them would print "nothing
 * happened" about a run that did plenty.
 */
export const TRANSCRIPT_NO_STEPS = "No steps have been recorded for this run."

/**
 * `transcript.anchor.absent` — there are steps, but not one carries a readable start.
 *
 * ⚠ THE LOG STILL RENDERS ITS ROWS UNDER THIS HEADLINE. The rows are true; only their
 * placement in time is unknown, so the honest render is every row with an EMPTY clock
 * gutter — never `00:00`, never a dash inside the gutter, and never a silently omitted
 * region. This is the no-backfill rule (D-05) applied to the run's own zero: a clock
 * derived from `updated_at` would be right for some rows and silently wrong for others,
 * with nothing on the row to say which.
 */
export const TRANSCRIPT_TIMES_NOT_RECORDED = "Step times weren't recorded for this run."

// ── ⚠ THE WORD THAT IS DELIBERATELY NOT HERE ───────────────────────────────────────────
//
// An earlier draft exported `TRANSCRIPT_EVENT_BEGAN = "started"`, for a log that emitted TWO
// lines per step — one when it opened, one when it closed, which is what the sheet draws.
// That design was WITHDRAWN ON MEASUREMENT, and the word went with it.
//
// The sheet's two lines carry two DIFFERENT sentences ("Connecting to Northwind CRM
// instance…" then "Extracted vendor list"). That narration is authored copy this product
// does not have, and inventing it is the same class of lie as a fabricated figure — which
// `199-05` called the highest-consequence one this work could ship. With only the step's
// NAME available, the second line said the same thing as the first, and the opening word
// was carrying the whole difference. A vocabulary entry whose only job is to make a
// duplicate line look intentional is an entry that should not exist.
//
// Recorded rather than silently dropped: the next reader who reaches for the sheet's
// two-line rhythm should find out here why it is not what shipped, and what would have to
// exist first (per-step narration on the wire) for it to be buildable honestly.
