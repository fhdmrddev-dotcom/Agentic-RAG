/**
 * Phase 275 (D-07) — THE RETENTION COPY.
 *
 * Two kinds of string live here, and `__tests__/retentionCopy.test.ts` fences each against its
 * own source, so a re-typed value goes red rather than shipping:
 *   · `ported`   — words from sketch 275 (`.planning/sketches/275-retention-legal-hold/index.html`),
 *                  the operator-approved mockup (winners 1B · 2B · 3A · 4B). Sketch 275 has no
 *                  `COPY` object, so each value is asserted VERBATIM in the sketch source.
 *   · `contract` — words the UI-SPEC (`275-UI-SPEC.md` §S9 / §S10) adds where the sketch had none:
 *                  the Find chip's on-state, its ✕ label, the refusal's single Close, and the
 *                  generic delete failure a NON-hold error still shows.
 *
 * ⛔ The hold SENTENCES themselves are NOT here: the server builds them (`hold_guard.py`, D-17 —
 * the matter name reaches org admins only), and a door renders the server's sentence as-is.
 * `refusalTitle` is the client's copy of `hold_guard.REFUSAL_TITLE`, fenced against it too.
 *
 * 275-04 adds the Library and Org-admin retention strings to this file.
 */

/** Ported verbatim from sketch 275. */
const ported = {
  /** S9 — screen 4's toggle: `<label class="toggle">… Include archived</label>`. */
  includeArchived: "Include archived",
  /** S10 — screen 4's refusal box lead: `<b>Can't delete.</b>`. */
  refusalTitle: "Can't delete.",
} as const

/** UI-SPEC contract copy (no sketch source). */
const contract = {
  /** S9 — the Find chip when on (primary-tinted, with a ✕). */
  archivedIncluded: "Archived: included",
  /** S9 — the on-chip's ✕ accessible name. */
  stopIncludingArchived: "Stop including archived documents",
  /** S10 — the refusal notice's single dismiss. */
  close: "Close",
  /** S10 — what a NON-hold delete failure still says (the hold refusal replaces it). */
  deleteFailed: "Delete failed. Please try again.",
} as const

export const RETENTION_COPY = { ported, contract } as const
