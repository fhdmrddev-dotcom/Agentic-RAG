/**
 * Phase 087 Plan 04 Task 1 — pure unified-diff string parser (PANEL-07, D-04,
 * Pattern 2). NO diff library (SC#3): the backend (workspace_service.compute_diff,
 * Python difflib.unified_diff) already emits a ready unified-diff STRING; the
 * client only needs to split it on "\n" and classify each line by prefix to
 * drive the in-column +/− render.
 *
 * Pure + React-free + fetch-free → fast, deterministic unit testing. Used by
 * both VersionDiff and DiffExpandOverlay (same parsed payload, no second fetch).
 *
 * Line classification (087-RESEARCH Pattern 2 / 087-PATTERNS Wire Contracts §diff):
 *   "@@ …"            → hunk   (primary indigo bg)
 *   "--- " / "+++ "   → header (file meta — render dim, NOT add/del)
 *   "+" (not "+++")   → add    (strip leading "+", sign "+", green)
 *   "-" (not "---")   → del    (strip leading "-", sign "−" Unicode minus, red)
 *   else              → context (strip one leading space if present)
 */

export type DiffLineKind = "hunk" | "add" | "del" | "context" | "header"

export interface DiffLine {
  kind: DiffLineKind
  /** The line text with its diff-marker prefix stripped (raw — rendered as a
   *  React text child, never as HTML — T-087-08). */
  text: string
  /** The gutter sign for add/del lines: "+" or the Unicode minus "−". */
  sign?: "+" | "−"
}

/** Unicode minus sign (U+2212) — per UI-SPEC, NOT the ASCII hyphen "-". */
const MINUS = "−"

/**
 * Parse a raw unified-diff string into an ordered list of classified lines.
 * Returns [] for an empty string. A trailing newline does not emit a final
 * empty line (the common difflib output ends with "\n").
 */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  if (diff === "") return []

  // difflib output typically ends with a trailing "\n"; dropping a single
  // trailing empty segment avoids rendering a spurious blank context row.
  let raw = diff.split("\n")
  if (raw.length > 0 && raw[raw.length - 1] === "") {
    raw = raw.slice(0, -1)
  }

  return raw.map((line): DiffLine => {
    if (line.startsWith("@@")) {
      return { kind: "hunk", text: line }
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      return { kind: "header", text: line }
    }
    if (line.startsWith("+")) {
      return { kind: "add", text: line.slice(1), sign: "+" }
    }
    if (line.startsWith("-")) {
      return { kind: "del", text: line.slice(1), sign: MINUS }
    }
    // context: difflib prefixes unchanged lines with a single leading space.
    return { kind: "context", text: line.startsWith(" ") ? line.slice(1) : line }
  })
}
