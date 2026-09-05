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

// The consumer, swept as source — see section 3's docblock for why this cannot be a grep.
import uploadSource from "../DocumentUpload.tsx?raw"

// ── EXTRACTION ────────────────────────────────────────────────────────────────────────

/** Every single- or double-quoted literal inside a blob. */
const quoted = (blob: string): string[] =>
  [...blob.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])

/**
 * The LINE-ANCHORED comment stripper (`FileRow.sweep.test.ts:100-105`).
 *
 * ⚠ The `^\s*` on the second replace is the load-bearing character sequence — the unanchored
 * variant eats live code from the first `//` of a URL onwards and turns every `not.toContain`
 * below into a free pass.
 */
const codeOf = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

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
// 3 · THE FIVE FORMATS THAT HAD A DOOR AND NO SIGN
// ══════════════════════════════════════════════════════════════════════════════════════
//
// ⚠ THIS SECTION USED TO ASSERT THE OPPOSITE, AND THE INVERSION IS THE POINT.
//
// It was a NEGATIVE arm — `.msg` and `.eml` must NOT be advertised — written when an older
// dropzone offered formats the input then refused. But its own second case recorded, in as many
// words, that **the server's silence was not the reason: it allows them.** The dropzone was
// deliberately narrower, and `acceptedFormats.ts`'s docblock said exactly what that meant:
// *"offering them is a product decision that belongs to a phase, not a constant."*
//
// ⭐ The operator made that decision on 2026-09-05 — *"the supported file format list is not
// updated"* — so the arm flips from absence to PRESENCE. The measurement underneath never
// changed; only the product call did. Kept as an inversion rather than a deletion so the history
// reads correctly: this was never a bug being fixed, it was a fence outliving its condition.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("⭐ the formats the server accepted while the dropzone stayed silent", () => {
  // Needles assembled at runtime so this file's prose cannot satisfy the checks.
  const OUTLOOK = "." + "msg"
  const EMAIL = "." + "eml"

  it("both are advertised now — extension, label and accept attribute", () => {
    expect(ACCEPTED_FORMATS.extensions).toContain(OUTLOOK)
    expect(ACCEPTED_FORMATS.extensions).toContain(EMAIL)
    expect(ACCEPTED_FORMATS.displayLabels).toContain(OUTLOOK.slice(1).toUpperCase())
    expect(ACCEPTED_FORMATS.displayLabels).toContain(EMAIL.slice(1).toUpperCase())

    const attr = acceptAttribute()
    expect(attr.length).toBeGreaterThan(50)
    expect(attr).toContain(OUTLOOK)
    expect(attr).toContain(EMAIL)
  })

  it("⚠ and the SERVER really does allow them — the claim above rests on this", () => {
    // Unchanged from the negative arm. It was the caveat; it is now the justification.
    const server = new Set(serverAllowedMimeTypes())
    expect(server.size).toBeGreaterThanOrEqual(8) // non-vacuity before the claim
    expect(server.has("message/rfc" + "822")).toBe(true)
  })

  it("⛔ the list is still a SUBSET — widening is not the same as equality", () => {
    // The direction is load-bearing twice over (see the module docblock): `accept` is not a
    // security control, and this constant may only ever make the client STRICTER than the gate.
    const server = new Set(serverAllowedMimeTypes())
    for (const m of ACCEPTED_FORMATS.mimeTypes) expect(server.has(m)).toBe(true)
    expect(ACCEPTED_FORMATS.mimeTypes.length).toBeLessThan(server.size + 1)
    // …and one server mime is deliberately still unlisted, so "subset" is not an accident.
    expect(server.has("application/csv")).toBe(true)
    expect(ACCEPTED_FORMATS.mimeTypes).not.toContain("application/csv")
  })
})

// 4 · THE KEY LINK — the consumer really reads the constant, and prints no percentage
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ WHY THIS SECTION SWEEPS `codeOf(uploadSource)` AND NEVER THE RAW BYTES — the 187-24 trap,
 * and it is NOT hypothetical here. `DocumentUpload.tsx`'s docblock deliberately SPELLS
 * `onUploadProgress` and `XMLHttpRequest` in order to record that they are ABSENT and that
 * D-217-19 therefore rests on measurement rather than on taste. A whole-file grep for either
 * symbol counts that WARNING as the VIOLATION. So the arms below scan code, and the warning's
 * continued presence is proved separately.
 */
const uploadCode = codeOf(uploadSource)

describe("the consumer reads the constant, and invents no progress", () => {
  it("the sweep source loaded, is the right file, and the stripper did not eat it", () => {
    expect(uploadSource.length).toBeGreaterThan(2000)
    expect(uploadSource).toContain("export function DocumentUpload") // identity
    // ⚠ STRIPPER NON-VACUITY: a token that exists ONLY in this file's prose. Present in the
    // raw source, absent from the code — a `codeOf` that returned "" would make every arm
    // below pass, and this pair is the one thing that reds when it does.
    expect(uploadSource).toContain("hero panel")
    expect(uploadCode).not.toContain("hero panel")
    expect(uploadCode.length).toBeGreaterThan(1500)
  })

  it("⭐ both the accept attribute and the printed formats read acceptedFormats", () => {
    expect(uploadCode).toContain('from "./acceptedFormats"')
    expect(uploadCode).toContain("accept={acceptAttribute()}")
    expect(uploadCode).toContain("formatsSentence()")
  })

  it("⛔ the inline accept literal is GONE — there is no second list to drift", () => {
    // The head of the literal this plan deleted. If it comes back, so does the drift.
    expect(uploadCode).not.toContain(".txt,.md,.pdf")
  })

  it("the band names its target folder and never leaves it blank", () => {
    expect(uploadCode).toContain("{targetName}")
    // The fallback is a NAMED root, matching the page header — never an empty string.
    expect(uploadCode).toContain('folderName ?? "Root"')
  })

  it("⛔ D-217-19 — no percentage and no ETA anywhere in the code", () => {
    expect(uploadCode).not.toContain("onUploadProgress")
    expect(uploadCode).not.toContain("XMLHttpRequest")
    expect(uploadCode).not.toContain("remaining")
    // A literal percent sign would be the tell for a width style or a printed figure.
    const percent = String.fromCharCode(37)
    expect(uploadCode).not.toContain(percent)
    // …and the warning that explains WHY is still in the prose, where the grep cannot see it.
    expect(uploadSource).toContain("onUploadProgress")
  })

  it("the shipped batch honesty is untouched", () => {
    expect(uploadCode).toContain("Promise.allSettled")
    expect(uploadCode).toContain("already up to date")
    expect(uploadCode).toContain("text-xs text-destructive")
  })
})
