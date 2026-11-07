/**
 * Phase 308.1-04 (BUG-261107-01; D-22, D-23; UI-SPEC Copywriting Contract C-01..C-10, D-UI-01) —
 * the one home of every word the publish screen shows while it FOLLOWS a golden run the server
 * is running. Components write no copy; they compose these.
 *
 * Why NOT `publishRefusalVocabulary.ts`: that module is contract-locked to sketch 215 — its test
 * re-parses `BUILD-CONTRACT.generated.md` and asserts the flat exports equal that table exactly,
 * so a follow string added there is a red test by design (D-UI-01).
 *
 * ⛔ Zero imports: a pure leaf. The honesty paragraph (C-06) is held as structured parts so the
 *   component can bold its spans without this module importing React.
 * ⛔ Every dash used as a dash is an EM DASH (U+2014). No exclamation mark. No severity word.
 * ⛔ C-07 (a dropped poll) never says the publish failed, errored or timed out: the run keeps
 *   going on the server whatever the browser can see.
 * ⛔ A step is named in the AUTHOR's words, never by its slug (sketch 215 #1). Composed values are
 *   functions taking ONE named-argument object.
 */

export const PUBLISH_FOLLOW_COPY = {
  /** C-01 — the inner Publish label while the mount read is in flight. */
  checking: "Checking…",
  /** C-02 — the hero heading in submitting / running (the shipped words). */
  headingRunning: "Running the golden run on your KB…",
  /** C-03 — the hero heading in finishing. */
  headingFinishing: "Golden run finished — reviewing the result…",
  /** C-04c — the progress line before any step has started. */
  starting: "Starting the run…",
  /** C-05 — the progress line in finishing. */
  finishing: "The trial run finished. Checking its citations, then the independent review grades the result.",
  /** C-06 — the hero honesty paragraph; `bold` parts render in <b>. */
  honesty: [
    { text: "Publish runs your ", bold: false },
    { text: "whole workflow for real", bold: true },
    {
      text: " against your knowledge base, then an independent judge grades the result — so a multi-step workflow can take a ",
      bold: false,
    },
    { text: "few minutes", bold: true },
    { text: ". Same harness, same tools, same model, so the judge grades a ", bold: false },
    { text: "real", bold: true },
    { text: " deliverable, not a dry-run. You can close this window — the check ", bold: false },
    { text: "keeps running", bold: true },
    {
      text: ". Open Publish again to see where it is. Editing the workflow before it finishes makes this publish refuse, because the check is for the version you sent.",
      bold: false,
    },
  ],
  /** C-07 — a transient poll failure (two in a row). Muted, never destructive. */
  followError: "Can't reach the server right now — still trying. The publish keeps running on the server either way.",
  /** C-08 — the ✕ title while following. */
  closeWhileFollowing: "Close — the check keeps running",
  /** C-09 — the attempt can no longer be found (404 while following). */
  lost: "This publish can no longer be found. Publish again to start a new check.",
  /** C-10 — the live golden-run link. */
  watchLive: "▦ Watch the golden run live ›",
} as const

/** C-04 — the progress line when the step's name is known (index 1-based). */
export function PUBLISH_PROGRESS({ index, count, name }: { index: number; count: number; name: string }): string {
  return `Step ${index} of ${count}: ${name}`
}

/** C-04b — the progress line when no name resolves. */
export function PUBLISH_PROGRESS_UNNAMED({ index, count }: { index: number; count: number }): string {
  return `Step ${index} of ${count}`
}

/** C-06 as one plain string (what a reader of the paragraph sees). */
export function publishHonestyText(): string {
  return PUBLISH_FOLLOW_COPY.honesty.map((part) => part.text).join("")
}
