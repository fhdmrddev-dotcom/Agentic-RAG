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
 *  - Every exported resolver is TOTAL — unknown phase types, unknown citation
 *    policies, unknown validator kinds, malformed `on_failure` and a missing
 *    `validators` array all resolve honestly and never throw (CANVAS-01).
 *  - The module is pure: no API-client import, no re-declared glyph map.
 *
 * Phase 185 (SPEC Req 6) DELETED the slot-1 grounding word-badge and with it the
 * ~9 cases that covered its three faces, including the cross-module glyph-band pin
 * against `deriveTier` (183-08 / WR-01). That pin had a subject only while the
 * canvas rendered a strictness WORD next to the workflow soul's; graded governance
 * renders a SHAPE instead (the corner seal, plan 185-09) and derives its state from
 * the tool intersection, not from `citation_policy`, so there is no longer a second
 * strictness reading for it to agree with. `deriveTier`'s own band mapping stays
 * pinned in `deriveTier.test.ts`. The count-gate pin for this file moved 42 → 33 in
 * the same commit as the deletion (L-9 / the Phase-177 lesson).
 */
import { describe, it, expect } from "vitest"
import phaseVocabularySource from "./phaseVocabulary?raw"
import skipParseCases from "./__fixtures__/skipParseCases.json"
import {
  parseSkipTarget,
  nodeTitle,
  technicalTitle,
  waitsForYou,
  derivedFace,
  derivedFaceOf,
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  PHASE_TYPE_LABELS,
  SKIP_PREFIX,
  type NameContext,
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

// ── Phase 187-04 (VOCAB-01 / D-187-04, D-187-05) — the config-derived tier ───────
//
// Measured on the live corpus: 0 of 57 phases across the 27 well-formed
// `workflow_definitions` rows carry a real `phase.name`, so `nodeTitle` falls
// through its first tier 100% of the time and every node face on every workflow is
// one of exactly six type sentences. These cases pin the tier that makes a step say
// what THAT step does — its precedence (most-specific-first), its totality over the
// LOOSE definition JSONB, and its never-fabricate floor.

/** The two id→name maps D-187-05 injects, plus the definition-level template. */
const SKILL_ID = "9f3c1e2a-7b64-4d0f-9a11-2c5e8d7b4a30"
const FOLDER_ID = "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9"
const OTHER_FOLDER_ID = "0badf00d-1111-4222-8333-444455556666"

const CTX: NameContext = Object.freeze({
  skillNames: { [SKILL_ID]: "pricing policy check" },
  folderNames: { [FOLDER_ID]: "Supplier Contracts", [OTHER_FOLDER_ID]: "Board Papers" },
  templateFilename: "Renewal Summary.pptx",
})

describe("phaseVocabulary.derivedFace — the flat core, most-specific-first (D-187-04)", () => {
  it("(1) a bound skill wins over a template AND a folder on the same step", () => {
    expect(
      derivedFace({
        phaseType: "llm_emit",
        skillName: "pricing policy check",
        templateFilename: "Renewal Summary.pptx",
        folderName: "Supplier Contracts",
      }),
    ).toBe("Run the pricing policy check")
  })

  it("(2) the template tier is GATED on llm_emit — the template is definition-level", () => {
    expect(derivedFace({ phaseType: "llm_emit", templateFilename: "Renewal Summary.pptx" })).toBe(
      "Fill Renewal Summary.pptx",
    )
    expect(derivedFace({ phaseType: "llm_agent", templateFilename: "Renewal Summary.pptx" })).toBeNull()
  })

  it("(2 → 3) an ungated template would collapse distinct steps; the folder tier still resolves", () => {
    expect(
      derivedFace({
        phaseType: "llm_agent",
        templateFilename: "Renewal Summary.pptx",
        folderName: "Supplier Contracts",
      }),
    ).toBe("Search Supplier Contracts")
  })

  it("(3) a folder resolves last of the three config tiers, and beats human input", () => {
    expect(derivedFace({ phaseType: "llm_human_input", folderName: "Board Papers" })).toBe(
      "Search Board Papers",
    )
  })

  it("(4) an llm_human_input step with nothing bound waits for you", () => {
    expect(derivedFace({ phaseType: "llm_human_input" })).toBe("Wait for your approval")
  })

  it("(5) nothing bound is null — the honest floor, never a fabricated face", () => {
    expect(derivedFace({ phaseType: "llm_agent" })).toBeNull()
    expect(derivedFace({ phaseType: "llm_single" })).toBeNull()
    expect(derivedFace({ phaseType: "programmatic" })).toBeNull()
    expect(derivedFace({ phaseType: "llm_batch_agents" })).toBeNull()
    expect(derivedFace({ phaseType: "llm_emit" })).toBeNull()
    expect(derivedFace({ phaseType: "totally_unknown" })).toBeNull()
  })

  it("an empty-string lookup result never wins a tier", () => {
    expect(derivedFace({ phaseType: "llm_emit", skillName: "", templateFilename: "" })).toBeNull()
  })
})

describe("phaseVocabulary.derivedFaceOf — the phase-shaped adapter (D-187-05)", () => {
  it("a resolvable skill_ref wins even with folder_scope and a template present", () => {
    const p = phase({
      config: { phase_type: "llm_emit", skill_ref: SKILL_ID, folder_scope: [FOLDER_ID] },
    })
    expect(derivedFaceOf(p, CTX)).toBe("Run the pricing policy check")
  })

  it("an llm_emit step with only the definition template renders Fill <filename>", () => {
    const p = phase({ config: { phase_type: "llm_emit" } })
    expect(derivedFaceOf(p, CTX)).toBe("Fill Renewal Summary.pptx")
  })

  it("a NON-llm_emit step with the same template does NOT render the template face", () => {
    const p = phase({ config: { phase_type: "llm_agent" } })
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("exactly ONE resolvable folder_scope id renders Search <folder>", () => {
    const p = phase({ config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID] } })
    expect(derivedFaceOf(p, CTX)).toBe("Search Supplier Contracts")
  })

  it("TWO OR MORE scoped folders fall through — a count is not a name", () => {
    const p = phase({
      config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID, OTHER_FOLDER_ID] },
    })
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("an llm_human_input step with nothing bound waits for your approval", () => {
    const p = phase({ config: { phase_type: "llm_human_input" } })
    expect(derivedFaceOf(p, { skillNames: {}, folderNames: {} })).toBe("Wait for your approval")
  })

  it("a step with nothing bound returns null", () => {
    expect(derivedFaceOf(phase({ config: { phase_type: "llm_single" } }), CTX)).toBeNull()
  })

  it("NEVER FABRICATE: an unresolved skill_ref falls through and never leaks the raw id", () => {
    const p = phase({ config: { phase_type: "llm_agent", skill_ref: SKILL_ID } })
    expect(derivedFaceOf(p, { skillNames: {} })).toBeNull()
    // …and when a lower tier does resolve, the id is still nowhere in the face.
    const withFolder = phase({
      config: { phase_type: "llm_agent", skill_ref: SKILL_ID, folder_scope: [FOLDER_ID] },
    })
    const face = derivedFaceOf(withFolder, { skillNames: {}, folderNames: CTX.folderNames })
    expect(face).toBe("Search Supplier Contracts")
    expect(face).not.toContain(SKILL_ID)
  })

  it("NEVER FABRICATE: an unresolved folder_scope id falls through and never leaks the raw id", () => {
    const p = phase({ config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID] } })
    expect(derivedFaceOf(p, { folderNames: {} })).toBeNull()
  })

  it("an EMPTY NameContext makes every tier miss (absent ⇒ fall through, D-187-05)", () => {
    const shapes = [
      phase({ config: { phase_type: "llm_emit", skill_ref: SKILL_ID, folder_scope: [FOLDER_ID] } }),
      phase({ config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID] } }),
      phase({ config: { phase_type: "llm_emit" } }),
    ]
    for (const p of shapes) expect(derivedFaceOf(p, {})).toBeNull()
  })

  it("the context parameter is OPTIONAL and defaults to the frozen empty context", () => {
    const p = phase({ config: { phase_type: "llm_emit", skill_ref: SKILL_ID } })
    expect(derivedFaceOf(p)).toBeNull()
    // human input still resolves with no context at all — it reads no lookup.
    expect(derivedFaceOf(phase({ config: { phase_type: "llm_human_input" } }))).toBe(
      "Wait for your approval",
    )
  })
})

describe("phaseVocabulary.derivedFaceOf — TOTALITY over the LOOSE JSONB (CANVAS-01)", () => {
  it("an absent config does not throw", () => {
    const p = { slug: "x", phase_index: 0 } as unknown as PhaseSpecJSON
    expect(() => derivedFaceOf(p, CTX)).not.toThrow()
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("an unknown phase_type does not throw", () => {
    const p = phase({ config: { phase_type: "llm_future_type" } })
    expect(() => derivedFaceOf(p, CTX)).not.toThrow()
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("a folder_scope that is a STRING instead of an array does not throw", () => {
    const p = phase({ config: { phase_type: "llm_agent", folder_scope: FOLDER_ID } })
    expect(() => derivedFaceOf(p, CTX)).not.toThrow()
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("a folder_scope array carrying a non-string does not throw", () => {
    const p = phase({ config: { phase_type: "llm_agent", folder_scope: [42] } })
    expect(() => derivedFaceOf(p, CTX)).not.toThrow()
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("a skill_ref that is a NUMBER does not throw", () => {
    const p = phase({ config: { phase_type: "llm_agent", skill_ref: 7 } })
    expect(() => derivedFaceOf(p, CTX)).not.toThrow()
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("a malformed assets field on the phase is simply not read here", () => {
    const p = phase({ config: { phase_type: "llm_emit", assets: "nope" } })
    expect(() => derivedFaceOf(p, CTX)).not.toThrow()
    expect(derivedFaceOf(p, CTX)).toBe("Fill Renewal Summary.pptx")
  })
})

describe("phaseVocabulary — the derived tier is not a SECOND deriveTier (D-187-04)", () => {
  it("does not reuse the shipped Phase-103 strictness-tier name", () => {
    expect(phaseVocabularySource).not.toMatch(/deriveTier/)
  })

  it("hands the SAME frozen empty context on every omitted call", () => {
    expect(phaseVocabularySource).toMatch(/NO_NAME_CONTEXT[^\n]*=\s*Object\.freeze\(\{\}\)/)
  })

  it("carries the numbered branch-order comments that ARE the decision", () => {
    for (const n of ["(1)", "(2)", "(3)", "(4)", "(5)"]) {
      expect(phaseVocabularySource).toContain(n)
    }
    expect(phaseVocabularySource).toContain("D-187-04")
  })
})

describe("phaseVocabulary.nodeTitle — the FOUR-tier ladder (D-187-04 / D-187-05)", () => {
  it("tier 1 — a stored name still wins, even when the derived tier would resolve", () => {
    const p = phase({
      name: "  Board-ready renewal pack  ",
      config: { phase_type: "llm_emit", skill_ref: SKILL_ID },
    })
    expect(nodeTitle(p, CTX)).toBe("Board-ready renewal pack")
  })

  it("tier 2 — the derived face shows when the name is absent or blank", () => {
    expect(
      nodeTitle(phase({ config: { phase_type: "llm_agent", skill_ref: SKILL_ID } }), CTX),
    ).toBe("Run the pricing policy check")
    expect(
      nodeTitle(phase({ name: "   ", config: { phase_type: "llm_emit" } }), CTX),
    ).toBe("Fill Renewal Summary.pptx")
    expect(
      nodeTitle(phase({ name: null, config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID] } }), CTX),
    ).toBe("Search Supplier Contracts")
  })

  it("tier 3 — the type sentence shows when no derived tier resolves", () => {
    expect(nodeTitle(phase({ config: { phase_type: "llm_single" } }), CTX)).toBe(
      PHASE_TYPE_SENTENCES.llm_single,
    )
  })

  it("tier 4 — an unknown phase_type still echoes the raw type honestly", () => {
    expect(nodeTitle(phase({ config: { phase_type: "llm_future_type" } }), CTX)).toBe(
      "llm_future_type",
    )
  })

  it("the slug NEVER appears, on any tier", () => {
    const p = phase({ slug: "find-renewal-terms", config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID] } })
    expect(nodeTitle(p, CTX)).not.toContain("find-renewal-terms")
  })

  it("NEVER FABRICATE: an unresolved skill_ref falls to the type sentence, not an id", () => {
    const p = phase({ config: { phase_type: "llm_agent", skill_ref: SKILL_ID } })
    const title = nodeTitle(p, { skillNames: {} })
    expect(title).toBe(PHASE_TYPE_SENTENCES.llm_agent)
    expect(title).not.toContain(SKILL_ID)
  })

  it("OMITTING the context is BYTE-IDENTICAL to HEAD — the whole compatibility claim", () => {
    const shapes: PhaseSpecJSON[] = [
      phase({ config: { phase_type: "llm_agent", skill_ref: SKILL_ID, folder_scope: [FOLDER_ID] } }),
      phase({ config: { phase_type: "llm_emit" } }),
      phase({ config: { phase_type: "llm_single" } }),
      phase({ config: { phase_type: "programmatic" } }),
      phase({ config: { phase_type: "llm_batch_agents" } }),
      phase({ name: "Hand-typed", config: { phase_type: "llm_emit" } }),
      phase({ config: { phase_type: "llm_future_type" } }),
    ]
    for (const p of shapes) {
      const omitted = nodeTitle(p)
      expect(nodeTitle(p, {})).toBe(omitted)
      const type = p.config.phase_type
      expect(omitted).toBe(p.name?.trim() || (PHASE_TYPE_SENTENCES[type] ?? type))
    }
  })

  it("an llm_human_input step is the ONE type whose face changes with no context at all", () => {
    // Tier 4 of `derivedFace` reads no lookup, so it resolves even uncontextualised.
    // This is the deliberate exception to "omitting the context changes nothing" and
    // it is recorded rather than hidden.
    expect(nodeTitle(phase({ config: { phase_type: "llm_human_input" } }))).toBe(
      "Wait for your approval",
    )
  })

  it("still TOTAL — a malformed phase never throws on any tier", () => {
    const noConfig = { slug: "x", phase_index: 0 } as unknown as PhaseSpecJSON
    expect(() => nodeTitle(noConfig, CTX)).not.toThrow()
    const weirdScope = phase({ config: { phase_type: "llm_agent", folder_scope: "not-an-array" } })
    expect(() => nodeTitle(weirdScope, CTX)).not.toThrow()
    expect(nodeTitle(weirdScope, CTX)).toBe(PHASE_TYPE_SENTENCES.llm_agent)
  })
})

describe("phaseVocabulary — the docblock carries no refuted measurement (187-04)", () => {
  it("the refuted '10 of 119' figure is gone", () => {
    expect(phaseVocabularySource).not.toContain("10 of 119")
  })

  it("the measured '0 of 57' figure replaces it", () => {
    expect(phaseVocabularySource).toContain("0 of 57")
  })

  it("declares name_seeded_by_ai EXACTLY once, and no resolver in this file reads it", () => {
    const hits = phaseVocabularySource.match(/name_seeded_by_ai/g) ?? []
    expect(hits).toHaveLength(1)
    expect(phaseVocabularySource).toMatch(/name_seeded_by_ai\?:\s*boolean/)
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
