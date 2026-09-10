/**
 * Phase 235 plan 04 (SURF-02 · D-235-07) — THE QUIET-RUN FOLD.
 *
 * ── ⭐ WHY THIS EXISTS: DENSITY IS RENDERING, STORAGE IS NOT ──────────────────────────
 *
 * D-235-07 stores EVERY tick, including the ones that changed nothing, because that is the
 * only way *"when did this source last successfully READ?"* is answerable — a history that
 * only records changes cannot distinguish "nothing changed" from "nothing was checked", and
 * those two mean opposite things to the person asking. Seventeen stored ticks and three
 * interesting ones is the normal shape, not a pathological one.
 *
 * The cost of that decision is a wall of identical rows, and the fix for it belongs HERE, at
 * the surface, not in the writer. N stored rows collapse to one line; expanding shows all N.
 * Nothing is discarded, nothing is aggregated, nothing is written.
 *
 * ── A STRICT LEAF ────────────────────────────────────────────────────────────────────
 *
 * No React. No vocabulary import. No formatting, no `Date`, no locale. This module decides
 * DENSITY; `sourceHealthVocabulary.ts` decides WORDS; `RunHistoryList.tsx` decides pixels.
 * `SyncRunLike` is expressed STRUCTURALLY so a suite can build fixtures without the API
 * module, and the type parameter carries the caller's concrete `SyncRun` through unchanged.
 *
 * ── ⚠ THE ONE RULE THAT LOOKS LIKE A DETAIL AND IS NOT ───────────────────────────────
 *
 * A `success` tick whose `listing_complete` is FALSE is **not quiet**. It looks quiet — every
 * count is zero — but those zeros mean *"we could not tell"*, not *"nothing happened"*:
 * `watch_service.py:415-420` suppresses missing-transitions on an incomplete listing (the H-5
 * / SRC-06 structural guard), so a zero there was written by the guard, not observed at the
 * source. Folding such a tick into "checked N times, no changes" would launder a refusal into
 * a reassurance. It stays a row of its own, and the surface says why.
 *
 * ── ⚠ ONLY CONSECUTIVE RUNS FOLD, AND A FOLD OF ONE IS NOT A FOLD ────────────────────
 *
 * Collapsing non-adjacent quiet ticks would reorder history, and "checked 1 time, no changes"
 * is longer than the row it replaces. Both are asserted rather than assumed.
 */

/** The minimum shape the fold needs. Structural, so fixtures need no API import. */
export interface SyncRunLike {
  started_at: string
  status: "success" | "failed" | "paused" | "running"
  listing_complete: boolean
  count_new: number
  count_modified: number
  count_renamed: number
  count_missing: number
  count_restored: number
  count_errors: number
}

/**
 * One RENDERED line. Either a stored tick, or a stand-in for several consecutive quiet ones.
 *
 * ⚠ `firstAt` / `lastAt` are the bounds of the group **in the order it was given** — the
 * caller delivers newest-first, so `firstAt` is the NEWEST tick in the fold and `lastAt` the
 * oldest. They are not sorted here: re-ordering someone else's history is not this module's
 * job, and a caller that hands them oldest-first gets an answer consistent with what it gave.
 */
export type RunRow<T extends SyncRunLike = SyncRunLike> =
  | { kind: "run"; run: T }
  | { kind: "quiet-fold"; count: number; firstAt: string; lastAt: string }

/** The six counts, named once so `isQuiet` cannot silently miss one a migration adds. */
const COUNT_KEYS = [
  "count_new",
  "count_modified",
  "count_renamed",
  "count_missing",
  "count_restored",
  "count_errors",
] as const satisfies readonly (keyof SyncRunLike)[]

/**
 * A tick is quiet when it SUCCEEDED, saw the WHOLE folder, and found nothing to do.
 * All three conditions, and the middle one is the load-bearing one — see the docblock.
 */
export function isQuiet(run: SyncRunLike): boolean {
  if (run.status !== "success") return false
  if (!run.listing_complete) return false
  return COUNT_KEYS.every((key) => run[key] === 0)
}

/**
 * Stored ticks in, rendered rows out. Pure, total, and it never mutates its input.
 *
 * @param runs   the stored history, in the order it should be shown (newest first).
 * @param opts   `expanded: true` returns every tick as its own row and folds nothing.
 */
export function foldRuns<T extends SyncRunLike>(
  runs: readonly T[],
  opts: { expanded?: boolean } = {},
): RunRow<T>[] {
  if (opts.expanded) return runs.map((run) => ({ kind: "run", run }))

  const rows: RunRow<T>[] = []
  let group: T[] = []

  const flush = () => {
    if (group.length === 0) return
    if (group.length === 1) {
      // A fold of one is longer than the thing it replaces.
      rows.push({ kind: "run", run: group[0] })
    } else {
      rows.push({
        kind: "quiet-fold",
        count: group.length,
        firstAt: group[0].started_at,
        lastAt: group[group.length - 1].started_at,
      })
    }
    group = []
  }

  for (const run of runs) {
    if (isQuiet(run)) {
      group.push(run)
      continue
    }
    flush()
    rows.push({ kind: "run", run })
  }
  flush()

  return rows
}
