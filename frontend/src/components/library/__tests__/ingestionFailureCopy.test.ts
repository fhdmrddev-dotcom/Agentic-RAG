/**
 * Phase 217.1 plan 02 (LIB-03 · D-217.1-20 · T-217.1-07a / T-217.1-07b) — the WHOLE-TABLE
 * property suite over `ingestionErrorVocabulary.ts`.
 *
 * ⭐ THIS IS THE FENCE THAT MAKES THE DEFAULT ARM HONEST. A classifier that guesses a cause
 * for an unrecognised message is the same failure as printing the dict — one step politer.
 * The whole-table property asserts every sentence the classifier can produce obeys the five
 * binding rules (Shared Pattern E), AND that the default arm is the shipped fallback word for
 * word, never an invention.
 *
 * ── THE FIVE BINDING RULES (asserted over EVERY entry in `SENTENCE_FOR_KIND`) ──────────
 *
 *   1. A sentence is PRESENTATION, never a rule — nothing branches on it here.
 *   2. NO SEVERITY WORD — "error", "failed", "failure", "broken", "fatal", "critical".
 *   3. NO EXCLAMATION (`!`).
 *   4. NO MECHANISM — no SQLSTATE, no exception class, no driver package, no traceback.
 *   5. The dash is an EM DASH (U+2014), never a hyphen-minus where a dash appears.
 *
 * ⚠ THE EM-DASH CHECK IS ASSEMBLED AT RUNTIME (Pitfall 8). A counted literal spelled inside a
 * docblock comment is itself a string the fence would match — so the codepoint is computed
 * and the docblock avoids the character itself.
 */
import { describe, it, expect } from "vitest"

import {
  classifyIngestionError,
  classifyIngestionFailure,
  looksHumanWritten,
  SENTENCE_FOR_KIND,
  UNKNOWN_FAILURE_SENTENCE,
  type IngestionFailureKind,
} from "../ingestionErrorVocabulary"

// The live source this suite is BOUND to — `documents.py` writes the human sentences the
// pass-through arm must recognise, so a sentence edited there cannot silently stop being
// shown here. Same `?raw` cross-language idiom as `IngestionStrip.test.tsx:39`.
import documentsPySource from "../../../../../backend/app/api/documents.py?raw"

// ── THE EM DASH, computed (Pitfall 8) ─────────────────────────────────────────────────

const EM_DASH = String.fromCharCode(0x2014)

// ── THE WHOLE-TABLE PROPERTY ──────────────────────────────────────────────────────────

describe("ingestionErrorVocabulary — whole-table property over SENTENCE_FOR_KIND", () => {
  const allKinds = Object.keys(SENTENCE_FOR_KIND) as IngestionFailureKind[]
  const allSentences = allKinds.map((k) => SENTENCE_FOR_KIND[k])

  it("non-vacuity — the table has at least the four named kinds", () => {
    // Asserted BEFORE the property: an empty table would satisfy every "for each" vacuously.
    expect(allKinds).toContain("nul_in_text")
    expect(allKinds).toContain("duplicate")
    expect(allKinds).toContain("not_a_zip")
    expect(allKinds).toContain("unknown")
  })

  it("every sentence is non-empty", () => {
    for (const s of allSentences) {
      expect(s.trim().length).toBeGreaterThan(0)
    }
  })

  it("rule 2 — NO severity word in any sentence", () => {
    const forbidden = /\b(error|failed|failure|broken|fatal|critical)\b/i
    for (const s of allSentences) {
      expect(s).not.toMatch(forbidden)
    }
  })

  it("rule 3 — NO exclamation in any sentence", () => {
    for (const s of allSentences) {
      expect(s).not.toMatch(/!/)
    }
  })

  it("rule 4 — NO mechanism in any sentence (no SQLSTATE, no exception class, no driver)", () => {
    const mechanism = /\b\d{2}[A-Z0-9]{3}\b|Error|Exception|Traceback|psycopg|postgrest|asyncpg|supabase|httpx|site-packages|SELECT |INSERT INTO|<class '|object at 0x/i
    for (const s of allSentences) {
      expect(s).not.toMatch(mechanism)
    }
  })

  it("rule 5 — where a dash appears it is an EM DASH (U+2014), never a hyphen-minus", () => {
    for (const s of allSentences) {
      // The em dash is the only dash character permitted. A hyphen-minus (`-`) inside one
      // of these sentences would be a different punctuation with a different width.
      if (/[-‐-―−]/.test(s)) {
        // Every dash-like character in the string must be the em dash.
        const dashes = s.match(/[-‐-―−]/g) ?? []
        for (const d of dashes) {
          expect(d).toBe(EM_DASH)
        }
      }
    }
  })
})

// ── THE THREE NAMED CASES — each maps to a DISTINCT human sentence ─────────────────────

describe("classifyIngestionFailure — the three named shapes", () => {
  it("NUL-in-text (22P05) → nul_in_text", () => {
    expect(classifyIngestionFailure('{"code": "22P05", "message": "unsupported Unicode escape"}')).toBe(
      "nul_in_text",
    )
  })

  it("duplicate-key (23505) → duplicate", () => {
    expect(
      classifyIngestionFailure(
        'duplicate key value violates unique constraint "documents_completed_hash_unique_idx"',
      ),
    ).toBe("duplicate")
  })

  it("BadZipFile → not_a_zip", () => {
    expect(classifyIngestionFailure("BadZipFile: File is not a zip file")).toBe("not_a_zip")
  })

  it("the three named cases each produce a DIFFERENT sentence", () => {
    const nul = classifyIngestionError('{"code": "22P05"}')
    const dup = classifyIngestionError("23505 duplicate key")
    const zip = classifyIngestionError("BadZipFile: not a zip file")
    expect(new Set([nul, dup, zip]).size).toBe(3)
  })
})

// ── THE DEFAULT ARM — T-217.1-07b: never an invented cause ────────────────────────────

describe("classifyIngestionError — the honest default arm", () => {
  it("an unrecognised driver dict falls back to the shipped honest sentence", () => {
    const result = classifyIngestionError('{"message": "something weird", "code": "42501"}')
    expect(result).toBe(UNKNOWN_FAILURE_SENTENCE)
  })

  it("a null error_message falls back to the shipped honest sentence", () => {
    expect(classifyIngestionError(null)).toBe(UNKNOWN_FAILURE_SENTENCE)
    expect(classifyIngestionError(undefined)).toBe(UNKNOWN_FAILURE_SENTENCE)
    expect(classifyIngestionError("")).toBe(UNKNOWN_FAILURE_SENTENCE)
    expect(classifyIngestionError("   ")).toBe(UNKNOWN_FAILURE_SENTENCE)
  })

  it("the shipped fallback is WORD FOR WORD as IngestionTab shipped it", () => {
    expect(UNKNOWN_FAILURE_SENTENCE).toBe("It stopped, and no reason was recorded.")
  })

  it("an unrecognised message never invents a cause — the result is the fallback, not a guess", () => {
    // A message that is machine-shaped (braces, SQLSTATE) but matches no named kind.
    const result = classifyIngestionError('{"hint": "something", "code": "42P01"}')
    expect(result).toBe(UNKNOWN_FAILURE_SENTENCE)
    // The result must NOT contain the raw message's content.
    expect(result).not.toContain("42P01")
    expect(result).not.toContain("hint")
  })
})

// ── THE PASS-THROUGH ARM — the backend's own human sentences survive ───────────────────

describe("classifyIngestionError — the pass-through arm (looksHumanWritten)", () => {
  it("a provably human sentence is returned unchanged", () => {
    const sentence = "This spreadsheet is empty — none of its sheets contain any data. Add rows and upload it again."
    expect(classifyIngestionError(sentence)).toBe(sentence)
  })

  it("a machine-shaped string is NEVER passed through, even if it matches no named kind", () => {
    const machine = '{"message": "permission denied", "code": "42501"}'
    expect(classifyIngestionError(machine)).toBe(UNKNOWN_FAILURE_SENTENCE)
  })

  it("a traceback is never passed through", () => {
    const trace = 'Traceback (most recent call last): File "app.py", line 10, in <module>'
    expect(classifyIngestionError(trace)).toBe(UNKNOWN_FAILURE_SENTENCE)
  })

  it("looksHumanWritten rejects a string with braces", () => {
    expect(looksHumanWritten('{"message": "hi"}')).toBe(false)
  })

  it("looksHumanWritten rejects a string with a SQLSTATE", () => {
    expect(looksHumanWritten("Something went wrong. Code 22P05.")).toBe(false)
  })

  it("looksHumanWritten accepts a real human sentence", () => {
    expect(looksHumanWritten("No text could be read from this PDF. It is most likely a scan.")).toBe(true)
  })
})

// ── THE LIVE-SOURCE FENCE — documents.py's human sentences are recognised ──────────────

describe("the pass-through recognises documents.py's LIVE human sentences", () => {
  // Non-vacuity: the ?raw import carries the backend module.
  it("non-vacuity — the ?raw import carries documents.py", () => {
    expect(documentsPySource.length).toBeGreaterThan(20000)
    expect(documentsPySource).toContain("empty_text_message")
  })

  it("every sentence in _EMPTY_TEXT_MESSAGES is provably human and passed through unchanged", () => {
    // Extract the string literals from `_EMPTY_TEXT_MESSAGES`. Each value is a concatenated
    // pair of quoted strings; we extract the full value by reading between the outer quotes.
    // This is intentionally a light extraction — the point is that a sentence edited there
    // survives the classifier, not that we parse Python perfectly.
    const block = documentsPySource.match(/_EMPTY_TEXT_MESSAGES[^}]*\{([\s\S]*?)\}/)
    expect(block).not.toBeNull()
    const body = block![1]

    // Each value is a pair of adjacent string literals — collect them and concatenate.
    const literals = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(literals.length).toBeGreaterThan(4)

    // Reconstruct the sentences: each _EMPTY_TEXT_MESSAGES value is TWO adjacent literals.
    for (let i = 0; i + 1 < literals.length; i += 2) {
      const sentence = `${literals[i]}${literals[i + 1]}`
      // The sentence must be recognised as human-written and passed through unchanged.
      expect(looksHumanWritten(sentence)).toBe(true)
      expect(classifyIngestionError(sentence)).toBe(sentence)
    }
  })
})
