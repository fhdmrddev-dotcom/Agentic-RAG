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
  // ⛔ "Accepted", not "Added". See ACCEPTED_NOT_DONE below — this word is reached the moment a
  //    file is queued, and the file is not readable yet.
  added: "Accepted",
  here: "Already here",
  refused: "Refused",
}

/**
 * ⛔ **THE WORD "ADDED" IS A LIE NOW, AND THE FIX THAT MADE IT ONE WAS CORRECT.**
 *
 * Sketch 230-A was drawn when confirm READ each file inline: `added` meant *in the Library and
 * searchable*, and saying it the moment the request returned was true. `BUG-260905-04` then routed
 * connector imports onto the durable queue — necessary, because the old path had no retries,
 * unbounded parallelism, and silently degraded metadata — and in doing so **changed what the same
 * word means**: `added` is now reached when a file is *accepted into a queue*, minutes before it
 * is readable, and possibly after the person has navigated away.
 *
 * ⚠ **The terminal outcomes are still exactly three.** SC#5's *"never silently in neither"*
 * depends on there being no fourth destination, and this module does not add one. What the queue
 * adds is a **journey**, and these are the words for the middle of it:
 *
 *   Waiting  → accepted, nothing read yet
 *   Reading  → being read now, five at a time, so the wait has a reason
 *   Readable → in the Library **and searchable** — the only word that means done
 *
 * ⭐ *Readable*, not *added*: **added is what the system did; readable is what the person gets**,
 * and only the second one is worth saying to them.
 */
export const LIVE_STAGE = {
  waiting: "Waiting",
  reading: "Reading",
  readable: "Readable",
} as const
export type LiveStageKey = keyof typeof LIVE_STAGE

/** What the confirm may claim at the moment it returns — and what it may not. */
export const ACCEPTED_NOT_DONE =
  "Accepted into the queue. They become searchable as they are read — you can leave this page."

/**
 * The SC#4 receipt. ⚠ It says **accepted**, because at the moment it renders that is the only
 * true word: the files are queued, not readable. The arithmetic is unchanged — what changed is
 * that the sentence no longer overstates what the arithmetic proves.
 */
export function reconciliationLine(
  accounted: number,
  unaccounted: number,
  said: number,
  actually: number,
): string {
  return `${accounted} accounted · ${unaccounted} unaccounted — preview said ${said} → ${actually} accepted`
}

/** The confirm button. It names BOTH numbers: what is certain, and what still has to be opened. */
export function confirmLabel(addCount: number, unknownCount: number): string {
  if (unknownCount > 0) return `Add ${addCount} · read ${unknownCount}`
  return `Add ${addCount}`
}

/** Header copy. */
export const PREVIEW_TITLE = "Before anything is added"
export const PREVIEW_EMPTY = "This folder has no files we can see."
/**
 * ⛔ THE SCREEN MUST NOT IMPLY A DEPTH THE WALK DID NOT GO TO.
 *
 * Phase 233 shipped listing ONE level deep while `SourceAdapter.list_files` carried a `recursive`
 * flag nothing read — so a person who pointed at a folder with sub-folders was shown less than
 * they had selected, **and the screen said nothing about it.** These sentences exist so the scope
 * of the scan is a stated fact rather than an assumption the reader has to make.
 */
export function scannedLine(foldersScanned: number, recursive: boolean): string {
  if (!recursive) return "This folder only — sub-folders were not read."
  if (foldersScanned <= 1) return "This folder — it has no sub-folders."
  return `This folder and ${foldersScanned - 1} sub-folder${foldersScanned - 1 === 1 ? "" : "s"}.`
}

/**
 * ⛔ A BUDGET-STOPPED LISTING MAY NEVER READ AS A COMPLETE ONE, and it must say WHICH budget
 * stopped it — "some files" is the sentence that lets a person assume the rest were fine.
 *
 * This is the same fence `SRC-06` puts on the watch loop one phase later, and the reason Onyx
 * once removed 976 documents it believed were deleted at the source.
 */
export const STOPPED_REASON: Record<string, string> = {
  depth: "We stopped going deeper — this folder nests further than a preview will follow.",
  folders: "We stopped after 200 folders — this branch is larger than a preview will read.",
  files: "We stopped after 2,000 files — this folder holds more than a preview will list.",
  pages: "One folder had more pages of files than a preview will page through.",
  unreadable: "A sub-folder could not be read, so part of this tree was not looked at.",
}

export const PREVIEW_TRUNCATED =
  "This listing did not finish, so this is part of the folder — not all of it."
export const SCANNING = "Reading the folder…"
export const CANCEL_LABEL = "Cancel"
export const READING_HEADER = "Reading the ones we couldn't tell about"
