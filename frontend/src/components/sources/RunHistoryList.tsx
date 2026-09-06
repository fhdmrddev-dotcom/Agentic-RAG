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

import { AlertTriangle, EyeOff } from "lucide-react"

import type { SyncRun } from "@/lib/api/sources"
import { relativeBand } from "@/components/workflows/library/relativeChanged"

import { foldRuns, isQuiet } from "./runHistoryFold"
import { COPY, sourceFailureSentence } from "./sourceHealthVocabulary"

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
 * How many files this check acted on. All six counts, including the errored ones — a file the
 * reader tried and could not read is still a file this check dealt with, and pretending
 * otherwise would print a smaller number than the truth.
 */
function filesTouched(run: SyncRun): number {
  return (
    run.count_new +
    run.count_modified +
    run.count_renamed +
    run.count_missing +
    run.count_restored +
    run.count_errors
  )
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

        return (
          <div key={run.id} data-testid="sources-run" className="px-2 py-1">
            {/* ⚠ SILENCE IS A BAND TOO — an unparseable instant renders NO time rather than
                an invented one. `relativeBand` returns null and we print nothing. */}
            {ago !== null && (
              <span className="text-muted-foreground">
                {/* ⚠ THE FOLD'S OWN PREDICATE, re-asked per row — never a second rule. An
                    expanded history still has to say a tick changed nothing, and an
                    incomplete listing is not quiet HERE for the reason it is not quiet THERE. */}
                {isQuiet(run) ? COPY.checkedNoChange(ago) : COPY.checkedAgo(ago, filesTouched(run))}
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
