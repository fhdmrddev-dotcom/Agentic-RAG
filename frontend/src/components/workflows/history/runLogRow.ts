/**
 * SEED-190 — the ONE wire-truth → row-facts resolver for the run log.
 *
 * The `runFacts.ts` / `cardFace.ts` shape, one surface over: the PAGE owns the fetch and the
 * layout, and this module owns every decision about what a row of the log SAYS. Pure, total,
 * and it renders nothing.
 *
 * ⚠ IT DERIVES ALMOST NOTHING ITSELF, AND THAT IS THE WHOLE DESIGN. Every fact a log row
 * carries already has a home, and this module's job is to route to those homes rather than to
 * become a fifth one:
 *
 *   | fact | home | why not here |
 *   |---|---|---|
 *   | outcome word + age | `library/runFacts.ts` | the workflow card prints the SAME sentence about the SAME run; two spellings of one fact is `cardFace.ts`'s founding defect |
 *   | the nine age bands | `library/relativeChanged.ts` | already the third spelling in the repo when it was written; a fourth is not on |
 *   | the run's span | `phaseDuration.runSpan` | the run SURFACE derives the total the same way from the same instants — a log that measured differently would contradict the page it opens |
 *   | the duration phrase | `lib/fmtElapsed.ts` | this tree's ONE duration formatter |
 *   | "we do not hold the time" | `receiptVocabulary.TIME_NOT_RECORDED` | already worded, on the receipt, for exactly this case |
 *
 * ⚠ `runSpan` IS CALLED ON A ONE-ELEMENT ARRAY AND THAT IS NOT A HACK — it is the identity the
 * backend's reduction was built to preserve. `runSpan` computes `min(started_at) →
 * max(completed_at)` across a run's phase rows; the list endpoint pre-computes exactly that
 * pair server-side so the log does not have to ship ~5 phase rows per run. Feeding the
 * pre-reduced pair back through the SAME function is what keeps one definition of a run's
 * span in the tree instead of two — if `runSpan` ever changes, the log changes with it. The
 * synthetic row's `slug` and `status` are never read by `runSpan` (it reads only the two
 * instants), and they carry the run's real status anyway so a future reader is not misled.
 *
 * ⚠ THE MISSING NAME IS A STATE, NOT A DEFAULT. `workflow_name` arrives as an EMPTY STRING
 * when the definition row is gone — deleting a workflow does not delete its runs
 * (`WorkflowDeleteSheet`: *"chat threads become normal chats"*), so an orphaned run is a real
 * row that must still be openable. It resolves to `WORKFLOW_DELETED`, never to the slug (a
 * slug is a machine name) and never to a blank cell.
 */
import type { WorkflowRunListItem } from "@/lib/api"
import { runFacts, type RunFact } from "@/components/workflows/library/runFacts"
import type { RunLogTone } from "./runLogTone"
import { runSpan } from "@/components/workflows/phaseDuration"
import { TIME_NOT_RECORDED } from "@/components/workflows/receiptVocabulary"
import { fmtElapsed } from "@/lib/fmtElapsed"
import {
  ATOM_SEPARATOR,
  WORKFLOW_DELETED,
  stepsAtom,
  versionAtom,
} from "./runLogVocabulary"

/** Everything one row of the log renders, already worded. The component adds no sentence. */
export interface RunLogRowFacts {
  /** The `workflow_runs.id` this row opens. */
  runId: string
  /** The headline. Never blank — see the ⚠ missing-name note in this file's header. */
  title: string
  /** `true` when the workflow row is gone and `title` is standing in for it. The surface uses
   *  this to tone the row down; it must NOT use it to hide the row. */
  orphaned: boolean
  /** The run's own truth, from the SAME resolver the workflow card uses. */
  fact: RunFact
  /**
   * The arm key the two colour tables are keyed by.
   *
   * ⚠ RESOLVED HERE SO THE SURFACE DERIVES NOTHING. It is the same one-line resolution
   * `WorkflowCard.tsx`'s `runGutterOf` performs, and it is TOTAL by construction: `ran`
   * contributes its outcome and every other arm contributes its own `kind`, so a fifth
   * `RunFact` arm becomes a typecheck error here rather than an unpainted row.
   */
  tone: RunLogTone
  /**
   * The run's measured span, already formatted — or `TIME_NOT_RECORDED`.
   *
   * ⚠ ONE SLOT, TWO KINDS OF TRUTH, exactly as `PhaseTiming.reading` is. `2m 58s` and
   * *"time not recorded"* occupy the same position, so a caller structurally cannot render a
   * duration beside a word that contradicts it — and cannot print `0s` for a run nothing
   * measured. Migration 121 is not backfilled: measured 2026-08-20, 10 of 580 phase rows
   * carry the pair, so MOST rows take the not-recorded arm today and that is correct.
   */
  duration: string
  /** `true` when `duration` is a real measurement rather than the not-recorded word. Lets the
   *  surface set `tabular-nums` on a figure and not on a sentence. */
  durationMeasured: boolean
  /** The second line: version, steps and (when measured) duration, already joined. */
  detail: string
}

/**
 * Resolve one wire row.
 *
 * @param row the list item, verbatim from the wire.
 * @param now the instant to measure recency against — hoist ONE per render (P-1), or 230 rows
 *   each taking the `Date.now()` default can straddle a band boundary mid-render. That is not
 *   hypothetical: `192.2-06` fixed exactly this on the library card.
 */
export function runLogRowFacts(row: WorkflowRunListItem, now: number = Date.now()): RunLogRowFacts {
  const orphaned = row.workflow_name.trim().length === 0
  const title = orphaned ? WORKFLOW_DELETED : row.workflow_name

  // The outcome word and the age band, from the card's own resolver.
  //
  // ⚠ `hasAnyRun: true` IS A FACT HERE, NOT AN ASSUMPTION, and it is the reason this call is
  // honest. `runFacts`' `never` / `not-by-you` arms exist for a LIBRARY row, where the caller
  // may be looking at a workflow nobody has run. Every row of this log IS a run, and it is the
  // caller's own — so the row-level bit is affirmatively true and the status is never null,
  // which means only arms (3) `unknown` and (4) `ran` are reachable from here. An in-flight
  // status takes `unknown`, which is the honest reading for a run that has not finished.
  const fact = runFacts(
    { lastRunAt: row.created_at, lastRunStatus: row.status, hasAnyRun: true },
    now,
  )

  // The span, through the SAME function the run surface uses — see this file's header.
  const span = runSpan([
    {
      slug: "",
      status: row.status,
      started_at: row.started_at,
      completed_at: row.completed_at,
    },
  ])
  const durationMeasured = span !== null
  const duration = span === null ? TIME_NOT_RECORDED : fmtElapsed(span.ms)

  // ⚠ THE DURATION JOINS THE DETAIL LINE ONLY WHEN IT IS MEASURED. The not-recorded word is
  // rendered by the surface in its own slot, where it can be toned as a sentence rather than
  // sitting in a row of figures pretending to be one.
  const atoms = [versionAtom(row.workflow_version), stepsAtom(row.step_total)]
  if (durationMeasured) atoms.push(duration)

  return {
    runId: row.id,
    title,
    tone: fact.kind === "ran" ? fact.outcome : fact.kind,
    orphaned,
    fact,
    duration,
    durationMeasured,
    detail: atoms.join(ATOM_SEPARATOR),
  }
}
