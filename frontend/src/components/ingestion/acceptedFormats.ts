/**
 * Phase 217-07 Task 1 (LIB-02 / SC#2 / D-217-18) — the ONE accepted-formats list.
 *
 * ── ONE LIST, THREE CONSUMERS ─────────────────────────────────────────────────────────
 * `DocumentUpload.tsx` used to carry a long inline `accept="..."` literal on its hidden
 * file input AND, in the sketch that preceded it, a separately hand-written list of format
 * names in its copy. Two lists mean one of them is eventually a lie, and the lie is
 * user-facing: a dropzone that advertises a format the input refuses opens a file picker
 * that greys the file out, with no explanation. The sketch's own fence caught exactly that
 * drift on an older dropzone.
 *
 * So: `extensions`, `mimeTypes` and `displayLabels` live here, and the `accept` attribute is
 * COMPUTED by `acceptAttribute()` rather than transcribed. There is no second place to edit.
 *
 * ── ⭐ FENCED AGAINST THE SERVER, NOT MERELY AGAINST ITSELF ───────────────────────────
 * A list that is internally consistent and disagrees with the server is still a dead end —
 * it produces a 422 the person cannot explain. `mimeTypes` is therefore asserted to be a
 * SUBSET of `ALLOWED_MIME_TYPES` in `backend/app/api/documents.py` (the real upload gate,
 * enforced at its `if mime_type not in ALLOWED_MIME_TYPES` arm) by
 * `__tests__/acceptFormats.test.ts`, which reads that Python file via `?raw`.
 *
 * A subset, never an equality and never a superset. The direction is load-bearing twice over:
 *
 *   1. ⚠ **`accept` is not a security control.** It is trivially bypassed — a drag-and-drop
 *      or a devtools edit sends whatever bytes it likes. The server's set is the gate. This
 *      module can only ever make the client STRICTER than the gate, never looser.
 *   2. The server deliberately allows more than this list advertises (measured 2026-08-29:
 *      fifteen server mimes against the eight below). Those extra formats parse today, and
 *      offering them is a product decision that belongs to a phase, not to a constant. See
 *      `217-07-SUMMARY.md` for the derivation and the full delta.
 *
 * ── A STRICT LEAF ─────────────────────────────────────────────────────────────────────
 * Zero imports of any kind. No component, no vocabulary, no type, no I/O. Everything here
 * is frozen data plus one pure function of it.
 *
 * ⛔ **NOTHING IS ADDED HERE THAT THE INPUT OR THE SERVER WOULD REFUSE**, and nothing from
 * the backend's TABLE-EXTRACTOR mime sets (`multimodal_service.py`) is added either — what
 * the extractor can pull tables out of is a different question from what the upload gate
 * accepts, and conflating the two is how a format gets advertised that never had a door.
 */

/** The shape of the single exported constant. */
export interface AcceptedFormats {
  /** Filename extensions, dot-prefixed, in the order the dropzone prints them. */
  readonly extensions: readonly string[]
  /** MIME types the browser may report for those extensions. A SUBSET of the server's set. */
  readonly mimeTypes: readonly string[]
  /**
   * What the dropzone prints, index-aligned with `extensions` — one label per extension, so
   * a label can never exist that has no door behind it.
   */
  readonly displayLabels: readonly string[]
}

/**
 * ⚠ THE ORDER OF `extensions` AND `displayLabels` IS PAIRED, INDEX FOR INDEX. The sketch
 * (`.planning/sketches/218-the-library-and-its-tabs/index.html:913`) prints them in this
 * order — `PDF · DOCX · PPTX · XLSX · CSV · TXT · MD · EPUB` — and its annotation records
 * that the set was MEASURED from the shipped file input rather than guessed. Adding an
 * entry to one array without the other reds `acceptFormats.test.ts`.
 */
export const ACCEPTED_FORMATS: AcceptedFormats = Object.freeze({
  extensions: Object.freeze([
    ".pdf",
    ".docx",
    ".pptx",
    ".xlsx",
    ".csv",
    ".txt",
    ".md",
    ".epub",
  ]),

  // The mime half of the literal this module replaced, verbatim. Browsers report several of
  // these unreliably (a `.docx` announced as `application/octet-stream` is measured and
  // handled SERVER-side, by extension, in `documents.py`'s override table) — which is one
  // more reason the extensions above are in the `accept` attribute too.
  mimeTypes: Object.freeze([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "text/markdown",
    "application/epub+zip",
  ]),

  displayLabels: Object.freeze([
    "PDF",
    "DOCX",
    "PPTX",
    "XLSX",
    "CSV",
    "TXT",
    "MD",
    "EPUB",
  ]),
})

/**
 * The value of the file input's `accept` attribute — COMPUTED, so it cannot drift from the
 * lists above.
 *
 * Both halves are included on purpose: extensions catch the browsers that report a useless
 * MIME type for OOXML files, and MIME types catch the pickers that match on type rather than
 * on suffix.
 */
export function acceptAttribute(): string {
  return [...ACCEPTED_FORMATS.extensions, ...ACCEPTED_FORMATS.mimeTypes].join(",")
}

/**
 * What the dropzone prints under its headline: `PDF · DOCX · … · EPUB`.
 *
 * Derived from `displayLabels` rather than written into the JSX, so the copy and the
 * `accept` attribute cannot say different things.
 */
export function formatsSentence(): string {
  return ACCEPTED_FORMATS.displayLabels.join(" · ")
}
