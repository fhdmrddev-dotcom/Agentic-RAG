/**
 * Phase 235 plan 04 (SURF-02 · D-235-07 / T-235-12) — THE HISTORY A PERSON READS.
 *
 * Stored ticks in, four contract blocks out: `history` wrapping `run` / `quiet-fold`, with a
 * `fail-reason` nested inside any run that did not succeed. Density is decided by
 * `runHistoryFold.ts`, words by `sourceHealthVocabulary.ts`; this file decides only pixels.
 *
 * ── ⛔ THE RAW `last_error` NEVER REACHES JSX (T-235-12) ──────────────────────────────
 *
 * `connector_watches.last_error` is written from `str(exc)` at `watch_service.py:196`, so a
 * revoked Google token puts a provider dict, a URL carrying a token fragment and an exception
 * class one render away from the screen. It is passed to `sourceFailureSentence` and NOWHERE
 * else — a pass-through requires POSITIVE PROOF OF PLAINNESS in that leaf, so the worst case
 * of an unrecognised message is the honest fallback rather than a leak. The suite proves this
 * by counting occurrences in this file's own source, not by trusting the sentence above.
 *
 * ── ⛔ WARNING, NEVER ALARM (BUILD-CONTRACT §4) ───────────────────────────────────────
 *
 * A source state gets the WARNING token and never the alarm one. A folder that stopped syncing
 * is not an emergency, and spending the alarm colour on it leaves nothing for one. The state
 * reads as glyph + label + colour, never colour alone — a person who cannot see the hue still
 * gets the whole message.
 *
 * ⚠ The forbidden token is deliberately NOT spelled anywhere in this file, comment included:
 * the fence that enforces it greps this source as TEXT, and a literal inside a docblock is
 * still a literal. Same trap the em dash falls into one file over (Pitfall 8).
 *
 * ── ⚠ THE ONE STRING THIS FILE OWNS, AND WHY IT IS NOT IN THE VOCABULARY ─────────────
 *
 * `LISTING_INCOMPLETE_NOTE` is the honest reading of a tick whose folder listing was
 * incomplete (RESEARCH P-2). It is NOT in `sourceHealthVocabulary` because that leaf's own
 * suite pins `Object.keys(COPY)` at exactly 26 — the sketch's key set — and the incomplete
 * listing is a fact this phase's RESEARCH found, which the sketch never drew. Adding a 27th
 * key would redden a green fence in a file this plan does not own. It is a lowercase FRAGMENT
 * in the register the sketch uses for its own row details, and it should be hoisted into the
 * vocabulary by whichever plan re-baselines that pin.
 */

import { Fragment } from "react"
import { AlertTriangle, EyeOff } from "lucide-react"

import type { SyncRun } from "@/lib/api/sources"
import { relativeBand } from "@/components/workflows/library/relativeChanged"

import { foldRuns, isQuiet } from "./runHistoryFold"
import type { CountKey } from "./sourceHealthVocabulary"
import {
  CHECKED_PREFIX,
  COPY,
  COUNT_ORDER,
  RUN_PARTIAL_LABEL,
  WORD_FOR_COUNT,
  sourceFailureSentence,
} from "./sourceHealthVocabulary"

/**
 * ⚠ The honest reading of `count_missing = 0` on an incomplete listing. `watch_service.py`
 * SUPPRESSES missing-transitions when the listing is incomplete, so that zero was written by
 * the H-5 structural guard rather than observed at the source. Rendering it as "nothing was
 * deleted" would turn a refusal into a reassurance.
 */
export const LISTING_INCOMPLETE_NOTE = "could not tell what was removed"

export interface RunHistoryListProps {
  runs: SyncRun[]
  connectionName: string
  expanded: boolean
  onToggleExpanded: () => void
  /**
   * ⚠ P-1, the shape `relativeChanged.ts` records: ONE hoisted instant per render, so every
   * row in a render agrees what time it is and two rows cannot straddle a band boundary. It
   * is also what lets the suite pin a fixed instant without mocking a clock.
   */
  now?: number
}

/**
 * The six stored counts, keyed by the vocabulary's own `CountKey`.
 *
 * ⚠ Spelled out rather than indexed by a template-literal type ON PURPOSE: a seventh count
 * added to `CountKey` makes this object fail to compile, where a computed index would quietly
 * read `undefined` and print nothing. The store growing a fact the surface silently drops is
 * the exact shape of the defect this file was edited to close.
 */
function countsOf(run: SyncRun): Record<CountKey, number> {
  return {
    new: run.count_new,
    modified: run.count_modified,
    renamed: run.count_renamed,
    restored: run.count_restored,
    missing: run.count_missing,
    errors: run.count_errors,
  }
}

/**
 * ⭐ WHAT THIS CHECK DID, CATEGORY BY CATEGORY — the reading the BUILD-CONTRACT's `renderRun`
 * specifies (sketch 233 `index.html:471-491`) and the one gap-closure round 1 exists to land.
 *
 * ── ⛔ WHY A SUM WAS THE DEFECT, NOT A SIMPLIFICATION ─────────────────────────────────
 *
 * This file previously added all six counts together and rendered the total. SC#1 asks how
 * many files were ADDED, how many were SKIPPED and how many FAILED, and one number answers
 * none of the three — it answers only *did anything happen*, which the fold already says. That
 * is ROADMAP failure mode #3 word for word, shipped inside the phase written to prevent it.
 *
 * ⚠ It also passed a green fence, which is the more useful half of the finding: the
 * composition fence asserts that the contract's BLOCKS are present by testid, and the run
 * block was present throughout, rendering the wrong thing. Presence cannot see content.
 *
 * ── ⚠ THE ONE-NUMBER READING SURVIVES ELSEWHERE, DELIBERATELY ─────────────────────────
 *
 * `WatchedFoldersSection` keeps its own summing helper for the source card's COLLAPSED line
 * (`COPY.checkedAgo`). That is not an oversight to be tidied away by the next reader: a card
 * summarises and a history itemises, so the two densities are the design. ⛔ Deleting the
 * card's copy would replace a summary with a list in the one place a list does not belong.
 *
 * ── ZERO IS NOT A CATEGORY ────────────────────────────────────────────────────────────
 *
 * Only non-zero counts become bits. A check that added three files says so in one bit rather
 * than printing five zeroes to deny the others, and a check with nothing to say produces an
 * EMPTY list — which the caller must render as no element at all, never as a bare separator.
 */
function countBits(run: SyncRun): { key: CountKey; n: number }[] {
  const counts = countsOf(run)
  return COUNT_ORDER.map((key) => ({ key, n: counts[key] })).filter((bit) => bit.n > 0)
}

export function RunHistoryList({
  runs,
  connectionName,
  expanded,
  onToggleExpanded,
  now = Date.now(),
}: RunHistoryListProps) {
  const rows = foldRuns(runs, { expanded })

  return (
    <div data-testid="sources-history" className="flex flex-col gap-1 text-sm">
      <div className="flex items-center justify-end">
        <button
          type="button"
          data-testid="sources-toggle-quiet"
          onClick={onToggleExpanded}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
        >
          {expanded ? COPY.hideQuiet : COPY.showEvery}
        </button>
      </div>

      {rows.map((row) => {
        if (row.kind === "quiet-fold") {
          return (
            <div
              key={`fold-${row.firstAt}`}
              data-testid="sources-quiet-fold"
              className="px-2 py-1 text-xs text-muted-foreground"
            >
              {COPY.quietFold(row.count)}
            </div>
          )
        }

        const run = row.run
        const ago = relativeBand(run.started_at, now)
        const failed = run.status !== "success"
        /* ⭐ A RUN THAT SUCCEEDED WITH FILES IT COULD NOT READ IS NOT A CLEAN RUN, and until
           2026-09-09 this history drew it as one. Measured on the operator's own Gmail watch:
           `status = 'success'`, `listing_complete = true`, `count_errors = 2` — the check DID
           complete, so `failed` is correctly false, and two files still did not arrive.
           ⛔ IT GETS THE REGISTER, NOT A SENTENCE. `run.last_error` is null on such a row, so
           calling `sourceFailureSentence` here would print the unknown-failure prose about a
           run that did not fail — inventing a reason is the defect, not the fix. The `errors`
           bit already says how many; this only makes the eye stop. */
        const partial = !failed && run.count_errors > 0
        /* ⚠ THE FOLD'S OWN PREDICATE, re-asked per row — never a second rule. An expanded
           history still has to say a tick changed nothing, and an incomplete listing is not
           quiet HERE for the reason it is not quiet THERE. */
        const quiet = isQuiet(run)
        const bits = quiet ? [] : countBits(run)

        return (
          <div key={run.id} data-testid="sources-run" className="px-2 py-1">
            {/* ⚠ SILENCE IS A BAND TOO — an unparseable instant renders NO time rather than
                an invented one. `relativeBand` returns null and we print nothing. ⚠ The bits
                are OUTSIDE this branch: a row with no readable instant still knows what it
                did, and dropping the breakdown with the clock would lose the larger fact. */}
            {ago !== null && (
              <span className="text-muted-foreground">
                {quiet ? COPY.checkedNoChange(ago) : CHECKED_PREFIX(ago)}
              </span>
            )}

            {bits.length > 0 && (
              <span data-testid="sources-run-counts" className="text-muted-foreground">
                {bits.map((bit, i) => (
                  <Fragment key={bit.key}>
                    {/* ⛔ THE SEPARATOR IS RENDERED BEFORE A BIT, NEVER AFTER ONE. Joining by
                        appending is how a row ends in a dangling mark when the list is short;
                        leading it makes a trailing one unreachable by construction. The first
                        bit takes one only because there is an instant to its left. */}
                    {(i > 0 || ago !== null) && (
                      <span className="text-muted-foreground/60" aria-hidden="true">
                        {" · "}
                      </span>
                    )}
                    {/* ⚠ The NUMERAL carries the emphasis (sketch `renderRun`, span.n): the
                        count is the thing being read, and the word is what makes it legible.
                        Emphasis is weight and the ordinary text tone — a category that failed
                        is at most the warning register, and a source state never escalates
                        beyond it (BUILD-CONTRACT §4). */}
                    <span
                      data-testid={`sources-run-count-${bit.key}`}
                      className={bit.key === "errors" ? "text-warning" : undefined}
                    >
                      <span
                        className={
                          bit.key === "errors" ? "font-medium" : "font-medium text-foreground"
                        }
                      >
                        {bit.n}
                      </span>{" "}
                      {WORD_FOR_COUNT[bit.key]}
                    </span>
                  </Fragment>
                ))}
              </span>
            )}

            {!run.listing_complete && (
              <span
                data-testid="sources-listing-incomplete"
                className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                {LISTING_INCOMPLETE_NOTE}
              </span>
            )}

            {partial && (
              <span
                data-testid="sources-run-partial"
                className="ml-2 inline-flex items-center gap-1 text-xs text-warning"
                title={RUN_PARTIAL_LABEL}
                role="img"
                aria-label={RUN_PARTIAL_LABEL}
              >
                {/* ⚠ AN UNLABELLED GLYPH SAYS NOTHING TO ASSISTIVE TECH (IN-04), so the mark
                    carries an accessible NAME — not a second announcement, since the `errors`
                    count bit beside it already states the fact in words.
                    ⛔ `aria-label`, NOT AN `sr-only` TEXT CHILD, and a test caught the
                    difference: visually-hidden text is still `textContent`, so the sr-only
                    version broke the whole-string row pin that reads a row as one sentence.
                    A name that is not text is what this needs. */}
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              </span>
            )}

            {failed && (
              <div
                data-testid="sources-fail-reason"
                className="mt-1 flex items-start gap-2 text-xs text-warning"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{sourceFailureSentence(run.last_error, connectionName)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
