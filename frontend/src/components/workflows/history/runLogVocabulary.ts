/**
 * SEED-190 — the run log's ONE string home.
 *
 * A TRUE LEAF: it imports nothing and exports only strings and string-builders. Same shape as
 * `receiptVocabulary.ts`, `transcriptVocabulary.ts` and `libraryVocabulary.ts`, and it exists
 * for the same reason those do — a surface that spells its own copy inline is a surface whose
 * wording cannot be changed in one diff, and whose tone drifts from its neighbours one string
 * at a time.
 *
 * ⚠ IT IS DELIBERATELY SMALL, AND THE SMALLNESS IS THE FINDING. Almost everything the log
 * says is ALREADY WORDED somewhere else and is imported rather than re-authored:
 *
 *   · the OUTCOME of a run — *"Worked 2 min ago"* / *"Failed yesterday"* / *"Stopped"* —
 *     comes from `library/runFacts.ts` + `library/libraryVocabulary.ts`, which is the same
 *     sentence the workflow card prints. Two spellings of one fact is exactly the defect
 *     `cardFace.ts` was extracted to end.
 *   · the AGE band comes from `library/relativeChanged.ts`'s nine bands.
 *   · the DURATION comes from `lib/fmtElapsed.ts`, this tree's one duration formatter, via
 *     `phaseDuration.ts` — which is also where "we do not hold the time" is already worded.
 *
 * What is left is only what no other surface has ever had to say: that this is a log, what it
 * is a log OF, how much of it you are looking at, and the three things that can be empty.
 *
 * ⚠ THE THREE EMPTY STATES ARE THREE SENTENCES AND MUST STAY THAT WAY. *"You have not run
 * anything yet"*, *"this workflow has no runs of yours"* and *"nothing matched"* are three
 * different facts, and folding them prints "nothing happened" about a screen where plenty
 * did. This repository has now recorded that same fold four times — `runFacts.ts` CR-01,
 * `DecisionsList` D-20, `transcriptVocabulary.ts` — and this is the module refusing it a
 * fifth time.
 */

/** The surface's own name. It is a LOG, not a "history": a history implies completeness, and
 *  this shows the caller's own runs and says so. */
export const LOG_TITLE = "Run log"

/** The subtitle on the unfiltered log. ⚠ It says YOURS out loud. The query is owner-scoped and
 *  a surface that quietly showed only some rows while implying all of them would be lying by
 *  omission — the `runFacts` `not-by-you` lesson, one screen up. */
export const LOG_SUBTITLE = "Every workflow run you have started, newest first."

/** The subtitle when the log is filtered to one workflow. ⚠ It names VERSIONS explicitly,
 *  because that is the trap this filter exists to avoid: the rows below span every published
 *  version of the workflow, not just the one that is current. */
export function logSubtitleForWorkflow(name: string): string {
  return `Every run you have started of ${name}, across all its versions.`
}

/** The filtered log's title chip. Kept separate from the subtitle so the surface can show WHAT
 *  is filtered even when the name is long enough to truncate. */
export const FILTER_CLEAR = "Show all runs"

/** The count line. ⚠ `shown` and `total` are BOTH rendered, always — "50 runs" on a screen
 *  showing 50 of 230 is the paging bug that looks like a full answer. */
export function logCount(shown: number, total: number): string {
  if (total === 0) return NO_RUNS_AT_ALL
  if (shown >= total) return total === 1 ? "1 run" : `${total} runs`
  return `Showing ${shown} of ${total} runs`
}

/** Load the next page. */
export const LOAD_MORE = "Load more"

/** ⚠ THREE EMPTY STATES, THREE SENTENCES — see this file's header. */
export const NO_RUNS_AT_ALL = "You have not run a workflow yet."
export function noRunsForWorkflow(name: string): string {
  return `You have not run ${name} yet.`
}

/** The log could not be read at all. ⚠ NOT an empty state: "we could not look" and "we looked
 *  and there is nothing" are different facts, and rendering a failure as an emptiness is how a
 *  surface tells a person their work is gone. */
export const LOG_FAILED = "We couldn't load the run log."
/** The canvas-off / not-available case, which the wire reports as a 404. */
export const LOG_UNAVAILABLE = "The run log isn't available."
export const LOG_RETRY = "Try again"

/** While the first page is in flight. */
export const LOG_LOADING = "Loading the run log…"

/** The name shown for a run whose workflow row is gone. ⚠ Deleting a workflow does NOT delete
 *  its runs — `WorkflowDeleteSheet` says the threads become normal chats — so this is a real
 *  state and not a defensive default. It says the workflow is gone, never a blank cell, and
 *  never the slug (a slug is a machine name and this is the row's headline). */
export const WORKFLOW_DELETED = "Deleted workflow"

/** The version atom on a row. Rendered on EVERY row, not only where versions differ: a log
 *  spanning versions that marked only some of them would read as though the unmarked ones
 *  shared a version. */
export function versionAtom(version: number): string {
  return `v${version}`
}

/** The step-count atom. ⚠ It counts the phase rows THE RUN CREATED, so a run of an older
 *  version honestly reports that version's step count. */
export function stepsAtom(n: number): string {
  return n === 1 ? "1 step" : `${n} steps`
}

/** The separator between the atoms on a row's second line. Owned here so the row component
 *  spells no user-visible character of its own. */
export const ATOM_SEPARATOR = " · "

/** The accessible name of a row's control. ⚠ The visible row is a NAME and a set of atoms; a
 *  screen reader needs the verb, and the verb is not printed anywhere on the row. */
export function openRunLabel(name: string): string {
  return `Open the run of ${name}`
}

/** The log's landmark label. */
export const LOG_LANDMARK = "Run log"
