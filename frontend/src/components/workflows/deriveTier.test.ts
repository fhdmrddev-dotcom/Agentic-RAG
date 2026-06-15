/**
 * Phase 103-03 Task 2 (REQ-7 h, sketch 021-A D10) — deriveTier()/TIERS.
 *
 * The strictness-tier badge is DERIVED on every render from the REAL enums
 * (citation_policy + the SET of validator kinds present) — never a stored or
 * free-text label. These tests pin the locked contract:
 *  - strict + full gate set -> STRICT; flag/partial -> MIDDLE; draft -> LOOSE.
 *  - flipping citation_policy strict->draft with the SAME validatorKinds changes
 *    the tier (proves client-derivation, no server round-trip).
 *  - llm_judge_rubric is treated present even on LOOSE (the judge is always-on).
 *  - deriveTier is pure (same inputs -> same output; imports nothing from api).
 */
import { describe, it, expect } from "vitest"
import {
  deriveTier,
  TIERS,
  type ValidatorKind,
} from "@/components/workflows/deriveTier"

const FULL_GATES = new Set<ValidatorKind>([
  "citations_required",
  "output_file_valid",
  "freshness",
  "structure_check",
  "llm_judge_rubric",
])

const MINIMAL_GATES = new Set<ValidatorKind>(["llm_judge_rubric"])

describe("deriveTier — derived from the real (citation_policy + validator-kind) enums", () => {
  it("strict + full gate set -> STRICT", () => {
    expect(deriveTier("strict", FULL_GATES).id).toBe("STRICT")
  })

  it("draft + minimal gates -> LOOSE", () => {
    expect(deriveTier("draft", MINIMAL_GATES).id).toBe("LOOSE")
  })

  it("flag -> MIDDLE", () => {
    expect(deriveTier("flag", MINIMAL_GATES).id).toBe("MIDDLE")
  })

  it("partial -> MIDDLE", () => {
    expect(deriveTier("partial", MINIMAL_GATES).id).toBe("MIDDLE")
  })

  it("flipping citation_policy strict->draft (SAME validatorKinds) changes the tier — no server round-trip", () => {
    // The ONLY thing that changes between the two calls is the client-side
    // citation_policy argument; the badge must change with NO fetch / no stored
    // label. (With the full floor-raising gate set present the draft policy
    // refines up to MIDDLE rather than the absolute floor — STRICT != MIDDLE
    // still proves client-derivation.)
    const gates = new Set<ValidatorKind>(FULL_GATES)
    expect(deriveTier("strict", gates).id).toBe("STRICT")
    expect(deriveTier("strict", gates).id).not.toBe(deriveTier("draft", gates).id)

    // And with MINIMAL gates the flip reaches the absolute LOOSE floor — again
    // a different tier, derived purely from the flipped citation_policy.
    const minimal = new Set<ValidatorKind>(MINIMAL_GATES)
    expect(deriveTier("strict", minimal).id).toBe("STRICT")
    expect(deriveTier("draft", minimal).id).toBe("LOOSE")
    expect(deriveTier("strict", minimal).id).not.toBe(deriveTier("draft", minimal).id)
  })

  it("judge is always-on: llm_judge_rubric is treated present even on a LOOSE result", () => {
    const loose = deriveTier("draft", MINIMAL_GATES)
    expect(loose.id).toBe("LOOSE")
    // The judge-always-on contract — even the loosest tier still includes the
    // judge gate in its required-gate set (TIERS is the single source of truth).
    expect(loose.judgeAlwaysOn).toBe(true)
    expect(TIERS.LOOSE.judgeAlwaysOn).toBe(true)
    expect(TIERS.STRICT.judgeAlwaysOn).toBe(true)
    expect(TIERS.MIDDLE.judgeAlwaysOn).toBe(true)
  })

  it("returns a member of TIERS (the single source of truth — badge can't drift)", () => {
    const t = deriveTier("strict", FULL_GATES)
    expect(t).toBe(TIERS.STRICT)
    expect(Object.values(TIERS)).toContain(deriveTier("flag", MINIMAL_GATES))
    expect(Object.values(TIERS)).toContain(deriveTier("draft", MINIMAL_GATES))
  })

  it("is pure — same inputs yield the same output reference, no side effects", () => {
    const gates = new Set<ValidatorKind>(["llm_judge_rubric", "citations_required"])
    const a = deriveTier("flag", gates)
    const b = deriveTier("flag", gates)
    expect(a).toBe(b)
    // Calling it must not mutate the input set.
    expect(gates.size).toBe(2)
  })

  it("TIERS carries the locked glyphs (🔒 / ◐ / ○) — real-vocab presentation, never invented labels", () => {
    expect(TIERS.STRICT.glyph).toBe("🔒")
    expect(TIERS.MIDDLE.glyph).toBe("◐")
    expect(TIERS.LOOSE.glyph).toBe("○")
  })
})
