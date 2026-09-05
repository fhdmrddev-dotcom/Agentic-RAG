/**
 * Phase 233 (PREV-01 / PREV-02 / PREV-03 / LIB-09) — every word the preview says.
 *
 * ⭐ **THE FOUR LABELS ARE THE DELIVERABLE, NOT DECORATION.** The ROADMAP says so in as many
 * words, and the operator-locked sketch `229-the-four-buckets` (winner **C**, the proportional
 * spine) commits to them verbatim. They live here, in one strict leaf with **zero imports**, so
 * there is no second place for one of them to be softened.
 *
 * ── ⛔ THE ONE CLAIM THIS FILE MAY NOT MAKE ───────────────────────────────────────────────
 *
 * *"Already here"* is matched **by source file, not by content**, and the qualifier travels with
 * the label wherever the label goes. `PROJECT.md`'s *"a `content_hash` lookup, not a guess"* is
 * FALSE for a list-only pass and must not be reinstated in this copy:
 *
 *   • `documents.py:620` hashes raw **bytes** — the download this preview exists to avoid;
 *   • Google Drive publishes **no** content identity for native Docs / Sheets / Slides;
 *   • Microsoft Graph guarantees only `quickXorHash`, documents `sha256Hash` as unsupported, and
 *     populates hashes **after** the item is downloaded.
 *
 * `previewVocabulary.test.ts` asserts the forbidden words appear nowhere in this module. The same
 * guard in the sketch was **driven RED and found broken** — its first version searched the whole
 * document, so the overclaim survived elsewhere and the check silently matched nothing. This one
 * is scoped to the module and asserts the module was actually read.
 *
 * ── ⛔ THE SECOND THING THAT MUST NOT DRIFT ───────────────────────────────────────────────
 *
 * The zero-write sentence is FOUR NUMBERS, not a mood. *"Nothing was written"* is a promise;
 * `0 documents · 0 chunks · 0 jobs · 0 folders` is a receipt. Cancel prints the receipt too —
 * it deliberately does not say *"Cancelled"*.
 */

/** ⛔ Exactly four, in render order. There is no fifth and no control that removes one. */
export const BUCKET_ORDER = ["add", "here", "uns", "unk"] as const
export type PreviewBucketKey = (typeof BUCKET_ORDER)[number]

/** The four labels, verbatim from the locked sketch. */
export const BUCKET_LABEL: Record<PreviewBucketKey, string> = {
  add: "Will be added",
  here: "Already here",
  uns: "Type not supported",
  unk: "Can't tell without reading it",
}

/**
 * The qualifier that must travel with bucket 2. ⭐ It is a POSITIVE statement of what the match
 * is, not merely an omission of what it isn't — an absent overclaim and a present qualifier are
 * different guarantees, and only the second one survives a copy edit.
 */
export const HERE_QUALIFIER = "by source file, not content"

/** What each bucket promises, one line, shown under the accordion header. */
export const BUCKET_BLURB: Record<PreviewBucketKey, string> = {
  add: "Each one shows where it would land.",
  here: "Matched by source file, not content — the bytes have not been compared.",
  uns: "We can't read this kind of file. Nothing is imported.",
  unk: "The source doesn't tell us enough. Each row says why.",
}

/** ⭐ Four numbers, never a mood. */
export const ZERO_WRITE_LINE = "0 documents · 0 chunks · 0 jobs · 0 folders"

/** Cancel says what did not happen, in the same four numbers. */
export const CANCEL_TOAST = `Closed. ${ZERO_WRITE_LINE} written.`

/** The three outcomes a confirmed file can end at. ⛔ There is deliberately no fourth. */
export const OUTCOME_ORDER = ["added", "here", "refused"] as const
export type PreviewOutcomeKey = (typeof OUTCOME_ORDER)[number]

export const OUTCOME_LABEL: Record<PreviewOutcomeKey, string> = {
  added: "Added",
  here: "Already here",
  refused: "Refused",
}

/** The SC#4 receipt, rendered after a confirm. */
export function reconciliationLine(
  accounted: number,
  unaccounted: number,
  said: number,
  actually: number,
): string {
  return `${accounted} accounted · ${unaccounted} unaccounted — preview said ${said} → ${actually} added`
}

/** The confirm button. It names BOTH numbers: what is certain, and what still has to be opened. */
export function confirmLabel(addCount: number, unknownCount: number): string {
  if (unknownCount > 0) return `Add ${addCount} · read ${unknownCount}`
  return `Add ${addCount}`
}

/** Header copy. */
export const PREVIEW_TITLE = "Before anything is added"
export const PREVIEW_EMPTY = "This folder has no files we can see."
export const PREVIEW_TRUNCATED =
  "This listing did not finish, so this is part of the folder — not all of it."
export const SCANNING = "Reading the folder…"
export const CANCEL_LABEL = "Cancel"
export const READING_HEADER = "Reading the ones we couldn't tell about"
