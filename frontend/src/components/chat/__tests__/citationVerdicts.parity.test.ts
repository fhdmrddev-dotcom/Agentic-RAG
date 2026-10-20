/**
 * Phase 294-05 Task 1 (DEC-03, D-16, D-17) — ONE verdict vocabulary across two stacks.
 *
 * The backend's `Verdict` and `UnavailableReason` Literals (`backend/app/models/citation_check.py`)
 * are read from SOURCE (`?raw`), never hand-typed, so a verdict added on one side alone fails
 * here instead of rendering as something the other side never said.
 */
import { describe, expect, it } from "vitest"
import modelSource from "../../../../../backend/app/models/citation_check.py?raw"
import { VERDICT_META, verdictMeta, availabilityReason, checkErrorLine } from "../citationVerdicts"

function literalValues(source: string, name: string): string[] {
  const m = new RegExp(`^${name}\\s*=\\s*Literal\\[([^\\]]*)\\]`, "m").exec(source)
  if (!m) return []
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])
}

describe("the backend Verdict Literal and VERDICT_META are one list", () => {
  it("NON-VACUITY — both Literals were found in the backend source", () => {
    expect(literalValues(modelSource, "Verdict").length).toBe(5)
    expect(literalValues(modelSource, "UnavailableReason").length).toBe(3)
  })

  it("Verdict == the VERDICT_META keys (as sets)", () => {
    expect(literalValues(modelSource, "Verdict").slice().sort()).toEqual(Object.keys(VERDICT_META).sort())
  })

  it("every UnavailableReason has an ⓘ sentence", () => {
    for (const reason of literalValues(modelSource, "UnavailableReason")) {
      const line = availabilityReason({ available: false, engine: "jev", reason: reason as never })
      expect(line, reason).toMatch(/^Citation check /)
    }
  })
})

describe("the fixed words, glyphs and reasons (D-20a)", () => {
  it("words and glyphs", () => {
    expect(VERDICT_META.supported).toMatchObject({ glyph: "✓", word: "Supported" })
    expect(VERDICT_META.partly_supported).toMatchObject({ glyph: "◐", word: "Partly supported" })
    expect(VERDICT_META.not_supported).toMatchObject({ glyph: "○", word: "Not supported" })
    expect(VERDICT_META.contradicted).toMatchObject({ glyph: "✕", word: "Contradicted" })
    expect(VERDICT_META.couldnt_check).toMatchObject({ glyph: "?", word: "Couldn't check" })
  })

  it("each verdict has its marker class and a distinct, non-empty fixed reason", () => {
    const reasons = new Set<string>()
    for (const [key, meta] of Object.entries(VERDICT_META)) {
      expect(meta.markerClass).toBe(`citation-marker--v-${key}`)
      expect(meta.reason.length).toBeGreaterThan(10)
      expect(meta.pillClass.length).toBeGreaterThan(0)
      reasons.add(meta.reason)
    }
    expect(reasons.size).toBe(5)
  })

  it("D-17 — an unknown or prototype-key verdict is couldn't check, never supported", () => {
    expect(verdictMeta("nope")).toBe(VERDICT_META.couldnt_check)
    expect(verdictMeta("constructor")).toBe(VERDICT_META.couldnt_check)
    expect(verdictMeta("__proto__")).toBe(VERDICT_META.couldnt_check)
    expect(verdictMeta("contradicted")).toBe(VERDICT_META.contradicted)
  })
})

describe("availabilityReason (D-16)", () => {
  it("available → null", () => {
    expect(availabilityReason({ available: true, engine: "jev", reason: null })).toBeNull()
  })

  it("the three sentences, the key one naming the engine's key", () => {
    expect(availabilityReason({ available: false, engine: null, reason: "off" })).toBe(
      "Citation check is off while reranking is off.",
    )
    expect(availabilityReason({ available: false, engine: null, reason: "engine_reorders_only" })).toBe(
      "Citation check needs Jev or OpenAI Decisions (Settings → Reranking).",
    )
    expect(availabilityReason({ available: false, engine: "jev", reason: "key_missing" })).toBe(
      "Citation check can't run: no saved OpenRouter key (Settings → Reranking).",
    )
    expect(availabilityReason({ available: false, engine: "openai_decisions", reason: "key_missing" })).toBe(
      "Citation check can't run: no saved OpenAI key (Settings → Reranking).",
    )
  })
})

describe("checkErrorLine — one fixed line per failure, never server text", () => {
  it("in flight, not found, rejected and a generic failure", () => {
    expect(checkErrorLine("in_flight", null)).toBe("A check is already running for this answer.")
    expect(checkErrorLine("not_found", null)).toBe("This answer isn't available to check.")
    expect(checkErrorLine("rejected", null)).toBe("This answer has no cited passages to check.")
    expect(checkErrorLine("failed", null)).toBe("The check didn't finish. Try again.")
    expect(checkErrorLine("anything-else", null)).toBe("The check didn't finish. Try again.")
  })

  it("an availability refusal reuses the ⓘ sentence", () => {
    expect(checkErrorLine("off", null)).toBe("Citation check is off while reranking is off.")
    expect(checkErrorLine("key_missing", { available: true, engine: "openai_decisions", reason: null })).toBe(
      "Citation check can't run: no saved OpenAI key (Settings → Reranking).",
    )
  })
})
