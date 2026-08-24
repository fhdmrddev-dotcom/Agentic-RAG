/**
 * Phase 196 Plan 05 Task 1 — the FITNESS VOCABULARY's own suite (D-12 / D-13 / D-15).
 *
 * WHAT THIS FILE IS FOR. `modelFitness.ts` holds the canvas's WORDS for a model's emission
 * tier and holds no derivation at all — the ladder lives on the server. So every assertion
 * here is a property of the DATA and of the two lookups, asserted against them directly
 * rather than through a rendered control. The rendered half (grouping, the reveal, the
 * option set) is `ModelField.test.tsx`'s, and this file deliberately does not duplicate it.
 *
 * ── THE TWO PROPERTIES THAT ARE EASY TO GET WRONG, AND ARE THEREFORE ASSERTED TWICE ─────
 *
 * 1. THE READ-TIME DEFAULT. A registry row may carry no tier at all; migration 120 shipped
 *    the column nullable and every row is null today. The backend's substrate reads a
 *    missing tier as the WEAKEST guarantee, and this module must agree — a client that read
 *    a missing tier as the strongest one would advertise a promise the engine will not keep.
 *
 * 2. ⚠ THE BOUNDARY GUARD, WHICH IS NOT THE SAME THING AS THE DEFAULT. An operator can type
 *    a value into the override row by hand. An UNRECOGNISED string must land on the weakest
 *    sentence, never on blank: blank is the optimistic direction, and optimism is the whole
 *    failure mode this phase removes. The two are separate code paths on the server and are
 *    separate cases here, because a `?? "coerce"` written without the guard passes the null
 *    case and silently fails the typo case.
 *
 * ⚠ NON-VACUITY MATTERS MORE THAN USUAL HERE. Every fallback assertion in this file compares
 * against the SAME sentence, so a lookup that returned that sentence unconditionally would
 * pass most of them. The positive controls below exist to make each fallback a measurement:
 * they assert the two OTHER sentences are reachable and distinct, so "falls back to the
 * weakest" is a statement about a lookup that can also return something else.
 */
import { describe, expect, it } from "vitest"

import {
  EMIT_TIER_ORDER,
  MODEL_FITNESS_WORD,
  modelFitnessTechnical,
  modelFitnessWord,
  resolveEmitTier,
} from "./modelFitness"

/**
 * The three sentences, spelled LITERALLY and exactly once in this repository's tests.
 *
 * They must be literals here — that is what makes the assertions below a FALSIFICATION of
 * the table rather than a copy of it (the rule `runVocabulary.test.ts` follows for its own
 * locked wordings). The separator in two of them is an EM DASH (U+2014), asserted by
 * codepoint rather than trusted to survive an editor.
 */
const WORD_FORCE_STRICT = "Can fill a document — guaranteed format"
const WORD_FORCE = "Can fill a document"
const WORD_COERCE = "Best-effort only — may not fill a document"

describe("modelFitness 196-05 — the three sentences, byte-exactly", () => {
  it("maps each recognised tier to its locked sentence", () => {
    expect(MODEL_FITNESS_WORD.force_strict).toBe(WORD_FORCE_STRICT)
    expect(MODEL_FITNESS_WORD.force).toBe(WORD_FORCE)
    expect(MODEL_FITNESS_WORD.coerce).toBe(WORD_COERCE)
  })

  it("…and they are reachable through the TOTAL lookup, not merely present in the table", () => {
    // Without this the table could be right and the accessor wrong — which is precisely the
    // failure the fallback cases below would then hide.
    expect(modelFitnessWord("force_strict")).toBe(WORD_FORCE_STRICT)
    expect(modelFitnessWord("force")).toBe(WORD_FORCE)
    expect(modelFitnessWord("coerce")).toBe(WORD_COERCE)
  })

  it("⚠ the strongest sentence CONTAINS the middle one — so every compare is a whole string", () => {
    // THE MEASURED TRAP, PINNED. `Can fill a document — guaranteed format` contains
    // `Can fill a document`, so a `toContain` on the middle sentence is true of BOTH and
    // would pass while proving nothing. Demonstrated as a boolean rather than asserted with
    // the ambiguous matcher itself, so nobody copies the bad form out of a green suite.
    const oneIsAPrefixOfTheOther = WORD_FORCE_STRICT.includes(WORD_FORCE)
    expect(oneIsAPrefixOfTheOther, "the collision this test exists for is gone").toBe(true)
    // …and the exact compare is what carries the distinction.
    expect(MODEL_FITNESS_WORD.force_strict).not.toBe(MODEL_FITNESS_WORD.force)
  })

  it("uses an EM DASH, asserted by codepoint", () => {
    for (const sentence of [WORD_FORCE_STRICT, WORD_COERCE]) {
      const at = sentence.indexOf("—")
      expect(at).toBeGreaterThan(-1)
      expect(sentence.codePointAt(at)).toBe(0x2014)
      expect(sentence).not.toContain("--")
    }
  })

  it("the three sentences are pairwise DISTINCT and non-empty", () => {
    const words = Object.values(MODEL_FITNESS_WORD)
    expect(new Set(words).size).toBe(words.length)
    expect(words).toHaveLength(3)
    for (const word of words) {
      expect(typeof word).toBe("string")
      expect(word.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("modelFitness 196-05 — the read-time default: an ABSENT tier is the weakest word", () => {
  it("`null` reads as best-effort — mirroring the server's own read-time default", () => {
    // Migration 120 shipped the column nullable and every row is null today, so this is the
    // dominant path rather than an edge case.
    expect(modelFitnessWord(null)).toBe(WORD_COERCE)
    expect(resolveEmitTier(null)).toBe("coerce")
  })

  it("`undefined` reads the same — an absent key and a null value are one case", () => {
    expect(modelFitnessWord(undefined)).toBe(WORD_COERCE)
    expect(resolveEmitTier(undefined)).toBe("coerce")
  })

  it("POSITIVE CONTROL — the lookup can return something OTHER than the weakest sentence", () => {
    // Every fallback assertion in this file lands on the same string. Without this control a
    // lookup hardcoded to return it would pass all of them.
    expect(modelFitnessWord("force_strict")).not.toBe(WORD_COERCE)
    expect(modelFitnessWord("force")).not.toBe(WORD_COERCE)
    expect(new Set([
      modelFitnessWord("force_strict"),
      modelFitnessWord("force"),
      modelFitnessWord(null),
    ]).size).toBe(3)
  })
})

describe("modelFitness 196-05 — the boundary guard: an UNRECOGNISED tier is the weakest word", () => {
  it("an operator typo lands on best-effort, never on blank", () => {
    // ⚠ A SEPARATE CODE PATH FROM THE NULL DEFAULT, and therefore a separate case. A bare
    // `?? "coerce"` satisfies the null test and fails this one: a non-nullish garbage string
    // is not nullish, so the coalesce never fires and the word comes back undefined.
    expect(modelFitnessWord("forse_strict")).toBe(WORD_COERCE)
    expect(modelFitnessWord("FORCE_STRICT")).toBe(WORD_COERCE)
    expect(modelFitnessWord("")).toBe(WORD_COERCE)
    expect(resolveEmitTier("forse_strict")).toBe("coerce")
  })

  it("…and it is never blank — the pessimistic direction, stated as its own claim", () => {
    for (const junk of ["forse_strict", "", "  ", "strict", "true", "1"]) {
      const word = modelFitnessWord(junk)
      expect(word.trim().length, `\`${junk}\` produced an empty fitness word`).toBeGreaterThan(0)
      expect(word).toBe(WORD_COERCE)
    }
  })

  it("an INHERITED member is not a tier either — the plain-object-literal trap", () => {
    // `MODEL_FITNESS_WORD` is an object literal, so it inherits `constructor`, `toString` and
    // `__proto__`. None of them is nullish, so `TABLE[key] ?? fallback` does NOT fire its
    // fallback for them — it hands back a FUNCTION typed as the table's value type. That bug
    // shipped once in `phaseStatusFromDb` and is recorded in `runVocabulary.ts`.
    for (const key of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(modelFitnessWord(key)).toBe(WORD_COERCE)
      expect(typeof modelFitnessWord(key)).toBe("string")
      expect(resolveEmitTier(key)).toBe("coerce")
    }
    // POSITIVE CONTROL — the inherited member really IS reachable by index, so the guard is
    // doing work rather than the property simply being absent.
    expect(typeof (MODEL_FITNESS_WORD as Record<string, unknown>)["constructor"]).toBe("function")
  })
})

describe("modelFitness 196-05 — the technical form (D-15, the ⌥ reveal)", () => {
  it("is exactly `emit_tier: <value>` for each recognised tier", () => {
    expect(modelFitnessTechnical("force_strict")).toBe("emit_tier: force_strict")
    expect(modelFitnessTechnical("force")).toBe("emit_tier: force")
    expect(modelFitnessTechnical("coerce")).toBe("emit_tier: coerce")
  })

  it("reports the tier the ENGINE will use for an absent one — not the absence", () => {
    // The reveal exists to tell a technical reader what actually happens. `emit_tier: null`
    // would be a truthful statement about the database and a misleading one about the run.
    expect(modelFitnessTechnical(null)).toBe("emit_tier: coerce")
    expect(modelFitnessTechnical(undefined)).toBe("emit_tier: coerce")
  })

  it("⚠ NEVER echoes an unrecognised string back — it reports what the engine resolves to", () => {
    // Echoing would put an operator's typo on a user's screen as though it were a capability,
    // and would make the reveal disagree with the plain sentence beside it.
    expect(modelFitnessTechnical("forse_strict")).toBe("emit_tier: coerce")
    expect(modelFitnessTechnical("forse_strict")).not.toContain("forse")
    expect(modelFitnessTechnical("<script>")).not.toContain("script")
  })

  it("the plain sentence and the technical form agree about the SAME tier, always", () => {
    // The two audiences must never be told different things. Swept over recognised tiers,
    // absent tiers and garbage in one loop, so no arm can drift.
    for (const raw of [null, undefined, "", "force", "force_strict", "coerce", "nonsense"]) {
      const resolved = resolveEmitTier(raw)
      expect(modelFitnessWord(raw)).toBe(MODEL_FITNESS_WORD[resolved])
      expect(modelFitnessTechnical(raw)).toBe(`emit_tier: ${resolved}`)
    }
  })
})

describe("modelFitness 196-05 — the grouping order is deterministic, strongest first", () => {
  it("names all three tiers exactly once, in strongest-guarantee order", () => {
    expect(EMIT_TIER_ORDER).toEqual(["force_strict", "force", "coerce"])
    expect(new Set(EMIT_TIER_ORDER).size).toBe(EMIT_TIER_ORDER.length)
  })

  it("covers the whole table — a fourth tier cannot be added without appearing here", () => {
    // Stated as a set equality over the table's own keys rather than as a length check, so a
    // renamed tier is caught as well as an added one.
    expect([...EMIT_TIER_ORDER].sort()).toEqual(Object.keys(MODEL_FITNESS_WORD).sort())
  })

  it("every ordered tier resolves to a distinct sentence — the order is USABLE as groups", () => {
    // The grouping the picker draws is only meaningful if the labels differ; a table with two
    // equal sentences would render two indistinguishable groups.
    const labels = EMIT_TIER_ORDER.map((tier) => modelFitnessWord(tier))
    expect(new Set(labels).size).toBe(EMIT_TIER_ORDER.length)
  })
})
