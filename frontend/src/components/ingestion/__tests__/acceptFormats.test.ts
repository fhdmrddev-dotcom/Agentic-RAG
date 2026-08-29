/**
 * Phase 217-07 Task 3 (LIB-02 / SC#2 / D-217-18 / T-217-23 / T-217-26) — the cross-language
 * fence: what the dropzone advertises is a subset of what the server allows.
 *
 * ── WHY A FENCE AND NOT A UNIT TEST ───────────────────────────────────────────────────
 * `acceptedFormats.ts` can be perfectly self-consistent and still be a lie. The failure it
 * exists to prevent is a person picking a file the picker allows and the server then
 * answering 422 — a dead end with no explanation on the screen. That failure lives ACROSS a
 * language boundary, so the assertion has to as well: the server's set is read from
 * `backend/app/api/documents.py` via `?raw` (the shipped idiom in this repo —
 * `src/__tests__/library/renameFence.test.ts:81`, `argumentModel.test.ts:30`).
 *
 * ── ⭐ THE DIRECTION IS THE POINT (T-217-23) ──────────────────────────────────────────
 * SUBSET, one way. `accept` is a convenience attribute, trivially bypassed by a drag-drop or
 * a devtools edit; the real gate is the server's `ALLOWED_MIME_TYPES`. A subset assertion
 * can only ever make the client stricter. An equality assertion would invite someone to
 * "fix" a red by widening the server, which is the one repair this fence must never suggest.
 *
 * ── ⚠ THREE GUARDS, BECAUSE A FENCE THAT MATCHES NOTHING PASSES EVERYTHING ────────────
 * A regex that matches nothing yields an EMPTY set, and every entry of any list is trivially
 * a member of… no — worse: an empty SERVER set makes the subset claim fail, but an empty
 * CLIENT set makes it pass vacuously, and the two negative arms below pass over empty
 * strings unconditionally. Phase 192.1 shipped three fences defending nothing exactly this
 * way. So, per the shipped precedent (`FileRow.sweep.test.ts:32-41`):
 *
 *   1. **length**   — the `?raw` import asserts a non-trivial character count;
 *   2. **identity** — a symbol only `documents.py` contains, because a non-empty sweep of
 *                     the WRONG file is the same bug;
 *   3. **non-vacuity** — the EXTRACTED server set is asserted to have many members, and the
 *                     client set to be non-empty, BEFORE any claim rests on either.
 *
 * ── ⚠ EVERY PATTERN TOLERATES CRLF ───────────────────────────────────────────────────
 * Source files check out with Windows line endings on this box. A terminator spelled `\n\n`
 * silently never matches, which yields an empty result that passes vacuously. `[\s\S]` and
 * `\r?\n` throughout.
 *
 * ⚠ IF THIS FENCE DISAGREES WITH THE SERVER, THE CONSTANT IS WRONG. Do not widen
 * `ALLOWED_MIME_TYPES` to satisfy the frontend.
 */
import { describe, it, expect } from "vitest"

import { ACCEPTED_FORMATS, acceptAttribute, formatsSentence } from "../acceptedFormats"

// The server's upload gate, read as source. Depth: __tests__ -> ingestion -> components ->
// src -> frontend -> repo root.
import documentsPySource from "../../../../../backend/app/api/documents.py?raw"

// ── EXTRACTION ────────────────────────────────────────────────────────────────────────

/** Every single- or double-quoted literal inside a blob. */
const quoted = (blob: string): string[] =>
  [...blob.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])

/**
 * `ALLOWED_MIME_TYPES = { ... }` — the server's set, from its own source.
 *
 * The terminator is a line-anchored closing brace so the match stops at the end of the set
 * literal rather than running on into the next dict in the file.
 */
function serverAllowedMimeTypes(): string[] {
  const m = /ALLOWED_MIME_TYPES\s*=\s*\{([\s\S]*?)\r?\n\}/.exec(documentsPySource)
  return m === null ? [] : quoted(m[1])
}

// ══════════════════════════════════════════════════════════════════════════════════════
// 0 · THE EXTRACTION ITSELF — asserted before anything rests on it
// ══════════════════════════════════════════════════════════════════════════════════════

describe("acceptedFormats — the server's set is READ, not typed", () => {
  it("the backend source loaded and is substantial", () => {
    expect(typeof documentsPySource).toBe("string")
    expect(documentsPySource.length).toBeGreaterThan(5000)
  })

  it("⚠ IDENTITY — it really is documents.py and not some other module", () => {
    // Two symbols only the upload route's module carries. A non-empty sweep of the wrong
    // file would satisfy the length guard above and prove nothing.
    expect(documentsPySource).toContain("ALLOWED_MIME_TYPES")
    expect(documentsPySource).toContain("_EXT_MIME_OVERRIDES")
    expect(documentsPySource).toContain("def extract_text")
  })

  it("⚠ NON-VACUITY — the extracted server set has many members", () => {
    const server = serverAllowedMimeTypes()
    // A regex that matched nothing yields [], and [] satisfies every subset claim below for
    // free. This is the assertion that reds when the fence stops being a fence.
    expect(server.length).toBeGreaterThan(1)
    expect(server.length).toBeGreaterThanOrEqual(8)
    // Assembled at runtime so this file's own prose cannot satisfy the check.
    expect(server).toContain("application/" + "pdf")
  })

  it("⚠ NON-VACUITY — the client lists are non-empty too", () => {
    expect(ACCEPTED_FORMATS.extensions.length).toBeGreaterThan(1)
    expect(ACCEPTED_FORMATS.mimeTypes.length).toBeGreaterThan(1)
    expect(ACCEPTED_FORMATS.displayLabels.length).toBeGreaterThan(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ THE CROSS-LANGUAGE SUBSET FENCE
// ══════════════════════════════════════════════════════════════════════════════════════

describe("⭐ the dropzone can never advertise a format the server refuses", () => {
  it("every advertised MIME type is in the server's ALLOWED_MIME_TYPES", () => {
    const server = new Set(serverAllowedMimeTypes())
    expect(server.size).toBeGreaterThanOrEqual(8) // non-vacuity, restated at the point of use

    const notAllowed = ACCEPTED_FORMATS.mimeTypes.filter((m) => !server.has(m))
    // Named, not counted — a red here must say WHICH format sends a person to a dead end.
    expect(notAllowed).toEqual([])
  })

  it("the fence is a SUBSET check, and the server is allowed to be wider", () => {
    // ⚠ NOT an equality assertion, on purpose (T-217-23). The server accepts and parses
    // formats this dropzone does not offer; offering them is a product decision, not a
    // typo fix. What must never happen is the reverse.
    const server = new Set(serverAllowedMimeTypes())
    for (const mime of ACCEPTED_FORMATS.mimeTypes) expect(server.has(mime)).toBe(true)
    expect(server.size).toBeGreaterThanOrEqual(ACCEPTED_FORMATS.mimeTypes.length)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 2 · ONE LIST, THREE CONSUMERS (D-217-18)
// ══════════════════════════════════════════════════════════════════════════════════════

describe("one list, three consumers", () => {
  it("no label exists without an extension behind it", () => {
    expect(ACCEPTED_FORMATS.displayLabels.length).toBe(ACCEPTED_FORMATS.extensions.length)
  })

  it("each label is its extension, so the printed word maps to a real door", () => {
    ACCEPTED_FORMATS.extensions.forEach((ext, i) => {
      expect(ACCEPTED_FORMATS.displayLabels[i]).toBe(ext.slice(1).toUpperCase())
    })
  })

  it("acceptAttribute() carries every extension and every MIME type", () => {
    const attr = acceptAttribute()
    const parts = attr.split(",")
    for (const ext of ACCEPTED_FORMATS.extensions) expect(parts).toContain(ext)
    for (const mime of ACCEPTED_FORMATS.mimeTypes) expect(parts).toContain(mime)
    expect(parts.length).toBe(
      ACCEPTED_FORMATS.extensions.length + ACCEPTED_FORMATS.mimeTypes.length,
    )
  })

  it("formatsSentence() prints every label and invents none", () => {
    const sentence = formatsSentence()
    for (const label of ACCEPTED_FORMATS.displayLabels) expect(sentence).toContain(label)
    expect(sentence.split(" · ").length).toBe(ACCEPTED_FORMATS.displayLabels.length)
  })

  it("the lists are frozen — a consumer cannot mutate the single source", () => {
    expect(Object.isFrozen(ACCEPTED_FORMATS)).toBe(true)
    expect(Object.isFrozen(ACCEPTED_FORMATS.extensions)).toBe(true)
    expect(Object.isFrozen(ACCEPTED_FORMATS.mimeTypes)).toBe(true)
    expect(Object.isFrozen(ACCEPTED_FORMATS.displayLabels)).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE NEGATIVE ARM — the two formats the sketch's own fence caught
// ══════════════════════════════════════════════════════════════════════════════════════

describe("⛔ the formats an older dropzone advertised and the input refuses", () => {
  // Needles assembled at runtime so this file's prose cannot satisfy the checks.
  const OUTLOOK = "." + "msg"
  const EMAIL = "." + "eml"

  it("neither appears in extensions, labels or the accept attribute", () => {
    // Non-vacuity for an ABSENCE arm: the lists really do have contents to be absent from.
    expect(ACCEPTED_FORMATS.extensions.length).toBeGreaterThan(1)

    expect(ACCEPTED_FORMATS.extensions).not.toContain(OUTLOOK)
    expect(ACCEPTED_FORMATS.extensions).not.toContain(EMAIL)
    expect(ACCEPTED_FORMATS.displayLabels).not.toContain(OUTLOOK.slice(1).toUpperCase())
    expect(ACCEPTED_FORMATS.displayLabels).not.toContain(EMAIL.slice(1).toUpperCase())

    const attr = acceptAttribute()
    expect(attr.length).toBeGreaterThan(50) // the string is real before we assert on absence
    expect(attr).not.toContain(OUTLOOK)
    expect(attr).not.toContain(EMAIL)
    expect(formatsSentence()).not.toContain(OUTLOOK.slice(1).toUpperCase())
  })

  it("⚠ and the SERVER's silence is not the reason — it allows them", () => {
    // Measured 2026-08-29 and recorded so a future editor does not "reconcile" the two in
    // the wrong direction. The server's set is WIDER; the dropzone is deliberately narrower,
    // which is exactly what the subset fence permits and equality would have forbidden.
    const server = new Set(serverAllowedMimeTypes())
    expect(server.size).toBeGreaterThanOrEqual(8) // non-vacuity before the claim
    expect(server.has("message/rfc" + "822")).toBe(true)
  })
})
