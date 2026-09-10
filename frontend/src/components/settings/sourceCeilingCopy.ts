/**
 * SEED-258 — the words for the source file-size ceiling.
 *
 * ⭐ THE COPY IS THE DELIVERABLE HERE, not decoration around a number.
 *
 * Phase 239 raised a constant and found the interesting part was not the bug:
 *
 *   > *"Both numbers were individually defensible. What was wrong was the RELATION between
 *   >  them, and a relation has no home in a file of constants. … The actual failure: not
 *   >  that the value was low, but that NOBODY COULD SEE WHAT IT WAS OR WHY."* — SEED-258
 *
 * The operator's ask, verbatim: *"this should be dynamic in the settings somewhere **with
 * information on it and recommendations**"*. So a bare number field would answer the
 * letter of the request and miss all of it — and SEED-258's own "answered badly" list says
 * exactly that: *"A knob is exposed with no statement of what raising it costs — the
 * original defect, now clickable."*
 *
 * ── What lives here, and what deliberately does not ──────────────────────────────────
 *
 * ⛔ **THE BOUNDS ARE NOT HERE.** `GET /settings` serves `source_max_file_size_mb_floor`
 *    and `_ceiling` specifically so this file never owns a copy. `api/settings.py:79` is
 *    blunt about why: *"a form carrying its own copy of `50` is a fourth private constant,
 *    which is the defect this replaced."* `sourceCeilingBounds()` therefore takes them as
 *    arguments, and a test proves it states whatever it is handed.
 *
 * ⚠ **ONE number does live here** — `SOURCE_CEILING_RECOMMENDED_MB`, because a
 *    recommendation is advice rather than an enforcement boundary and the server does not
 *    serve it. That makes it the same shape of cross-file relation this seed exists
 *    because of, so it gets the same treatment: **pinned by a test that reads
 *    `backend/app/models/user_settings.py` as text** (`sourceCeilingCopy.test.ts`), never
 *    restated in a comment. `google_drive.py` asserted a relation in a comment for its
 *    entire life and the sentence was never true.
 *
 * ⚠ **THE SOURCE NAMES ARE THE ONES A PERSON SEES.** Migration 174 says *"Google Drive,
 *    Microsoft Graph, any MCP file surface"* — those are the adapter module names. An
 *    operator never reads the words "Microsoft Graph" anywhere in this product; the
 *    catalog calls that connection **Microsoft 365** and its file surfaces OneDrive and
 *    SharePoint (`servicesCatalog.ts:100`). The reasoning is echoed; the vocabulary is the
 *    product's.
 *
 * The register is `connectionFormCopy.ts` and migration 174's own header — plain, and it
 * says what a thing costs rather than selling it.
 */

/**
 * The value the app ships with, and the one we advise.
 *
 * ⛔ PINNED to `SOURCE_MAX_FILE_SIZE_MB_DEFAULT` in `backend/app/models/user_settings.py`
 * by `__tests__/sourceCeilingCopy.test.ts`. A recommendation that has drifted from the
 * shipped default is worse than no recommendation: it advises the operator toward a value
 * the product itself no longer chooses.
 */
export const SOURCE_CEILING_RECOMMENDED_MB = 25

/** The number in a person's terms — *"how big a file can I import"*, never the column name. */
export const SOURCE_CEILING_TITLE = "Largest file a connected source may import"

/**
 * Scope first, because the knob reads as per-connection otherwise. It is ONE setting that
 * three adapters read; changing it here changes every source at once.
 */
export const SOURCE_CEILING_DESCRIPTION =
  "One limit, applied to every connected source — Google Drive, OneDrive and SharePoint, " +
  "and any MCP server that serves files. A file over the limit is refused whole; nothing " +
  "partial is ever imported."

/** The input's own label. Short, because the sentences around it carry the meaning. */
export const SOURCE_CEILING_FIELD_LABEL = "Maximum file size"

/** The unit, kept beside the field so the number is never ambiguous. */
export const SOURCE_CEILING_FIELD_SUFFIX = "MB"

/**
 * ⭐ THE SENTENCE THE WHOLE SEED EXISTS FOR.
 *
 * SEED-258: *"State … what raising it costs: more memory buffered per in-flight request
 * from a server we do not control."* The last clause is the honest half of the one-knob
 * rule — the operator learns that the transport cap moves with this number, without being
 * handed a second control that could disagree with it.
 */
export const SOURCE_CEILING_COST =
  "Raising this costs memory. A file is held whole in memory while it is fetched, once per " +
  "request in flight, from a server we do not control — and an MCP server returns file " +
  "content inside its reply, base64-encoded at 4/3 its size. The transport limit follows " +
  "this number on its own; it is never a second setting."

/**
 * The bounds, stated rather than discovered by being refused.
 *
 * ⛔ Both numbers are ARGUMENTS. They arrive from `GET /settings`; this function must never
 * learn them. See the module docblock.
 */
export function sourceCeilingBounds(floor: number, ceiling: number): string {
  return (
    `Anything from ${floor} to ${ceiling} MB. Below ${floor} MB essentially nothing would ` +
    `import, while every sync still reported success. ${ceiling} MB is this app's own limit ` +
    `for a file uploaded by hand, so a connected source can never admit a file you could not ` +
    `add yourself.`
  )
}

/** The advice, next to the tradeoff rather than instead of it. */
export function sourceCeilingRecommendation(recommendedMb: number): string {
  return (
    `Recommended: ${recommendedMb} MB. It suits most document workloads and is the value the ` +
    `app ships with. Raise it only for a source you know holds larger files, and expect the ` +
    `memory cost above to rise with it.`
  )
}
