/**
 * Phase 183-02 Task 1 (CANVAS-01 / D-183-06, D-183-07, D-183-13, D-183-15) —
 * phaseVocabulary tests.
 *
 * `phaseVocabulary.ts` is the ONE shared phase-vocabulary module both graph views
 * (the shipped `PhaseSpineGraph` spine and the net-new canvas) read. These tests
 * pin its locked contract:
 *  - `parseSkipTarget` is byte-semantically the backend `parse_skip_target`
 *    (`backend/app/services/harness/reachability.py:89-98`) — a PREFIX-LENGTH
 *    slice, NEVER a `lastIndexOf(":")` split (correction C-1 under D-183-15).
 *  - `nodeTitle` resolves to a plain-language business sentence and NEVER leaks
 *    the slug into the default face (D-183-06).
 *  - `groundingFor` DERIVES grounding from `citation_policy` + a
 *    `citations_required` validator and always carries a glyph beside its words
 *    (D-183-07, WCAG 1.4.1 never-colour-alone), and its MIDDLE band AGREES with
 *    `deriveTier` — pinned cross-module rather than assumed (183-08, WR-01).
 *  - Every exported resolver is TOTAL — unknown phase types, unknown citation
 *    policies, unknown validator kinds, malformed `on_failure` and a missing
 *    `validators` array all resolve honestly and never throw (CANVAS-01).
 *  - The module is pure: no API-client import, no re-declared glyph map.
 */
import { describe, it, expect } from "vitest"
import phaseVocabularySource from "./phaseVocabulary?raw"
import skipParseCases from "./__fixtures__/skipParseCases.json"
import { deriveTier, TIERS } from "./deriveTier"
import {
  parseSkipTarget,
  nodeTitle,
  technicalTitle,
  groundingFor,
  waitsForYou,
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  PHASE_TYPE_LABELS,
  SKIP_PREFIX,
  type PhaseSpecJSON,
} from "./phaseVocabulary"

/** Build a minimal phase read-shape (the loose definition-JSONB shape). */
function phase(over: Partial<PhaseSpecJSON> & { config?: Record<string, unknown> } = {}): PhaseSpecJSON {
  return {
    slug: over.slug ?? "gather",
    phase_index: over.phase_index ?? 0,
    name: over.name,
    config: { phase_type: "llm_agent", ...(over.config ?? {}) } as PhaseSpecJSON["config"],
    validators: over.validators,
  }
}

describe("phaseVocabulary.parseSkipTarget — backend parity semantics (D-183-15 / C-1)", () => {
  it("resolves a simple skip target", () => {
    expect(parseSkipTarget("skip_to_phase:escalate")).toBe("escalate")
  })

  it("C-1: 'skip_to_phase:a:b' resolves to 'a:b' — a prefix slice, not a lastIndexOf split", () => {
    expect(parseSkipTarget("skip_to_phase:a:b")).toBe("a:b")
  })

  it("an empty or whitespace-only target is null", () => {
    expect(parseSkipTarget("skip_to_phase:")).toBeNull()
    expect(parseSkipTarget("skip_to_phase:   ")).toBeNull()
  })

  it("trims surrounding whitespace off a real target", () => {
    expect(parseSkipTarget("skip_to_phase:  gather  ")).toBe("gather")
  })

  it("returns null for every non-skip disposition and for missing input", () => {
    expect(parseSkipTarget("fail_run")).toBeNull()
    expect(parseSkipTarget("ask_user")).toBeNull()
    expect(parseSkipTarget("retry")).toBeNull()
    expect(parseSkipTarget("")).toBeNull()
    expect(parseSkipTarget(undefined)).toBeNull()
    expect(parseSkipTarget(null)).toBeNull()
  })

  it("requires the literal prefix — no colon, and the prefix is case-sensitive", () => {
    expect(parseSkipTarget("skip_to_phase")).toBeNull()
    expect(parseSkipTarget("SKIP_TO_PHASE:gather")).toBeNull()
  })

  it("SKIP_PREFIX is the literal the backend slices by", () => {
    expect(SKIP_PREFIX).toBe("skip_to_phase:")
  })
})

describe("phaseVocabulary parseSkipTarget — cross-language parity pin (D-183-15 / C-1)", () => {
  // The rows are READ from the ONE shared table; they are deliberately NOT
  // hand-copied here. backend/tests/unit/test_183_skip_parse_parity.py parametrizes
  // over the SAME file, so neither language can drift alone. Hand-copying would
  // recreate exactly the two-copy problem the table exists to kill.
  const rows = skipParseCases.cases as { on_failure: string | null; expected: string | null; why: string }[]

  it("the shared table is not truncated and still carries the C-1 row", () => {
    expect(rows.length).toBeGreaterThanOrEqual(12)
    const c1 = rows.find((r) => r.on_failure === "skip_to_phase:a:b")
    expect(c1).toBeDefined()
    expect(c1?.expected).toBe("a:b")
  })

  it.each(rows.map((r) => [r.on_failure, r.expected, r.why] as const))(
    "parity: %j → %j (%s)",
    (onFailure, expected) => {
      expect(parseSkipTarget(onFailure)).toBe(expected)
    },
  )
})

describe("phaseVocabulary.nodeTitle — the plain-language node face (D-183-06)", () => {
  it("a real phase.name wins", () => {
    expect(nodeTitle(phase({ name: "  Draft the summary  " }))).toBe("Draft the summary")
  })

  it("a blank / whitespace-only name does NOT win", () => {
    expect(nodeTitle(phase({ name: "   " }))).toBe(PHASE_TYPE_SENTENCES.llm_agent)
    expect(nodeTitle(phase({ name: null }))).toBe(PHASE_TYPE_SENTENCES.llm_agent)
  })

  it("falls back to the plain-language sentence, and the slug NEVER appears", () => {
    const p = phase({ slug: "m1", config: { phase_type: "llm_emit" } })
    const title = nodeTitle(p)
    expect(title).toBe(PHASE_TYPE_SENTENCES.llm_emit)
    expect(title).not.toContain("m1")
    expect(title).not.toContain("llm_emit")
  })

  it("every one of the 6 known phase types has a sentence and a subtitle", () => {
    const types = [
      "programmatic",
      "llm_single",
      "llm_agent",
      "llm_batch_agents",
      "llm_human_input",
      "llm_emit",
    ]
    for (const t of types) {
      expect(PHASE_TYPE_SENTENCES[t]?.length ?? 0).toBeGreaterThan(0)
      expect(PHASE_TYPE_SUBTITLES[t]?.length ?? 0).toBeGreaterThan(0)
      expect(PHASE_TYPE_LABELS[t]?.length ?? 0).toBeGreaterThan(0)
    }
    expect(Object.keys(PHASE_TYPE_SENTENCES).sort()).toEqual([...types].sort())
  })

  it("an unknown phase_type echoes the raw type honestly and does not throw", () => {
    const p = phase({ slug: "probe", config: { phase_type: "llm_future_type" } })
    expect(() => nodeTitle(p)).not.toThrow()
    expect(nodeTitle(p)).toBe("llm_future_type")
  })
})

describe("phaseVocabulary.technicalTitle — the ⌥ Technical-names reveal (D-183-08)", () => {
  it("is today's shipped fallback preserved: '<label> · <slug>'", () => {
    expect(technicalTitle(phase({ slug: "retrieve", config: { phase_type: "llm_agent" } }))).toBe(
      "AI agent step · retrieve",
    )
  })

  it("an unknown phase_type falls back to the raw type, still never throwing", () => {
    expect(technicalTitle(phase({ slug: "probe", config: { phase_type: "weird" } }))).toBe(
      "weird · probe",
    )
  })
})

describe("phaseVocabulary.groundingFor — derived grounding, slot 1 (D-183-07)", () => {
  it("citation_policy 'strict' → strict", () => {
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "strict" } })).mode).toBe(
      "strict",
    )
  })

  it("a citations_required validator → strict even without a citation_policy", () => {
    const p = phase({ validators: [{ kind: "citations_required", on_failure: "fail_run" }] })
    expect(groundingFor(p).mode).toBe("strict")
  })

  it("citation_policy 'flag' → flag", () => {
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "flag" } })).mode).toBe(
      "flag",
    )
  })

  it("citation_policy 'partial' → the MIDDLE face, never 'no sources needed' (WR-01)", () => {
    const g = groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "partial" } }))
    expect(g.mode).toBe("flag")
    expect(g.glyph).toBe("◐")
    expect(g.words.length).toBeGreaterThan(0)
  })

  it("'draft', an absent policy and an unknown value all → open", () => {
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "draft" } })).mode).toBe("open")
    expect(groundingFor(phase()).mode).toBe("open")
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "tomorrow" } })).mode).toBe("open")
  })

  // THE CROSS-MODULE PIN (WR-01). The canvas grounding badge and the workflow-soul
  // strictness badge are one click apart and read the SAME stored `citation_policy`.
  // Asserting agreement here makes "they say the same thing" a machine-checked
  // property rather than a habit two authors have to remember.
  it("agrees with deriveTier for the whole MIDDLE band ('flag' and 'partial')", () => {
    for (const policy of ["flag", "partial"] as const) {
      expect(deriveTier(policy, new Set()).id).toBe("MIDDLE")
      expect(
        groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: policy } })).glyph,
      ).toBe(TIERS.MIDDLE.glyph)
    }
  })

  it("never throws on a missing validators array, an unknown validator kind, or a bare config", () => {
    expect(() => groundingFor(phase({ validators: undefined }))).not.toThrow()
    expect(() => groundingFor(phase({ validators: [{ kind: "regex_match" }] }))).not.toThrow()
    expect(groundingFor(phase({ validators: [{ kind: "regex_match" }] })).mode).toBe("open")
    expect(() => groundingFor(phase({ validators: [{}] }))).not.toThrow()
  })

  it("every grounding carries non-empty WORDS and a non-empty GLYPH (never colour alone)", () => {
    const samples = [
      phase({ config: { phase_type: "llm_emit", citation_policy: "strict" } }),
      phase({ config: { phase_type: "llm_emit", citation_policy: "flag" } }),
      phase(),
    ]
    for (const p of samples) {
      const g = groundingFor(p)
      expect(g.words.length).toBeGreaterThan(0)
      expect(g.glyph.length).toBeGreaterThan(0)
    }
  })

  it("reuses the shipped strictness glyph vocabulary (🔒 / ◐ / ○)", () => {
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "strict" } })).glyph).toBe("🔒")
    expect(groundingFor(phase({ config: { phase_type: "llm_emit", citation_policy: "flag" } })).glyph).toBe("◐")
    expect(groundingFor(phase()).glyph).toBe("○")
  })
})

describe("phaseVocabulary.waitsForYou — slot 2 (D-183-07)", () => {
  it("is true ONLY for llm_human_input", () => {
    expect(waitsForYou(phase({ config: { phase_type: "llm_human_input" } }))).toBe(true)
    for (const t of ["programmatic", "llm_single", "llm_agent", "llm_batch_agents", "llm_emit", "nope"]) {
      expect(waitsForYou(phase({ config: { phase_type: t } }))).toBe(false)
    }
  })
})

describe("phaseVocabulary — purity + anti-duplication (D-183-13)", () => {
  it("imports nothing from the API client", () => {
    expect(phaseVocabularySource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("does NOT re-declare the glyph map (soulData owns it)", () => {
    expect(phaseVocabularySource).not.toMatch(/const PHASE_GLYPHS/)
  })

  it("never uses lastIndexOf — the C-1 parse defect must not reappear", () => {
    expect(phaseVocabularySource).not.toMatch(/lastIndexOf/)
  })

  it("does NOT invent a grounding_mode field (that is Phase 185)", () => {
    expect(phaseVocabularySource).not.toMatch(/grounding_mode/)
  })

  it("declares exactly ONE parseSkipTarget", () => {
    const decls = phaseVocabularySource.match(/export function parseSkipTarget/g) ?? []
    expect(decls).toHaveLength(1)
  })
})
