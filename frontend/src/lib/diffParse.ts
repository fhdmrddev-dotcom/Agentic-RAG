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
  /**
   * Phase 200 (sketch `run-panel-parts.html`) — THE LINE'S POSITION IN EACH SIDE
   * OF THE FILE, counted from the hunk header this line falls under.
   *
   * ⚠ **THE NUMBERS WERE ALWAYS ON THE WIRE AND THIS PARSER SIMPLY DROPPED THEM.**
   * A unified diff's `@@ -12,4 +12,5 @@` states exactly where each hunk starts;
   * before this the header was classified `kind: "hunk"` and its text kept verbatim,
   * so every number a reader needed was sitting in a string nobody read. No backend
   * change was owed and none was made.
   *
   * `oldLine` is the position in the BEFORE file, `newLine` in the AFTER file:
   *   · `context` carries BOTH — the line exists on both sides;
   *   · `del` carries ONLY `oldLine` — it is not in the after file;
   *   · `add` carries ONLY `newLine` — it was not in the before file;
   *   · `hunk` and `header` carry NEITHER — they are not lines of the file.
   *
   * ⚠ **BOTH ARE OPTIONAL AND AN ABSENCE MUST RENDER NOTHING.** A malformed or
   * missing hunk header leaves every following line unnumbered rather than
   * numbered from a guess: a plausible-looking wrong line number is worse than a
   * blank gutter, because a reader would use it to find the line in the real file.
   */
  oldLine?: number
  newLine?: number
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

  // ── Phase 200 — the two running counters, seeded by each hunk header ─────────
  //
  // ⚠ `undefined` UNTIL A HUNK HEADER IS SEEN, deliberately. A diff that begins
  // with body lines and no `@@` is malformed, and the honest render for it is a
  // blank gutter — not a count that starts at 1 and is wrong for every line.
  // `HUNK_RE` returning null leaves the counters exactly as they were, so a single
  // corrupt header does not silently re-base every line after it either.
  let oldLine: number | undefined
  let newLine: number | undefined

  return raw.map((line): DiffLine => {
    if (line.startsWith("@@")) {
      const m = HUNK_RE.exec(line)
      if (m) {
        oldLine = Number(m[1])
        newLine = Number(m[2])
      }
      return { kind: "hunk", text: line }
    }
    if (line.startsWith("--- ") || line.startsWith("+++ ")) {
      return { kind: "header", text: line }
    }
    if (line.startsWith("+")) {
      const at = newLine
      if (newLine !== undefined) newLine += 1
      return { kind: "add", text: line.slice(1), sign: "+", ...(at === undefined ? {} : { newLine: at }) }
    }
    if (line.startsWith("-")) {
      const at = oldLine
      if (oldLine !== undefined) oldLine += 1
      return { kind: "del", text: line.slice(1), sign: MINUS, ...(at === undefined ? {} : { oldLine: at }) }
    }
    // context: difflib prefixes unchanged lines with a single leading space.
    const atOld = oldLine
    const atNew = newLine
    if (oldLine !== undefined) oldLine += 1
    if (newLine !== undefined) newLine += 1
    return {
      kind: "context",
      text: line.startsWith(" ") ? line.slice(1) : line,
      ...(atOld === undefined ? {} : { oldLine: atOld }),
      ...(atNew === undefined ? {} : { newLine: atNew }),
    }
  })
}

/**
 * The hunk header's two start positions: `@@ -12,4 +12,5 @@` and the count-less
 * single-line form `@@ -12 +12 @@`, which difflib emits when a hunk is one line.
 *
 * ⚠ THE COUNTS ARE DELIBERATELY NOT CAPTURED. Nothing here trusts them: the lines
 * are counted as they are walked, so a header whose count disagrees with the body
 * it actually carries cannot make the gutter disagree with the text beside it.
 */
const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/
