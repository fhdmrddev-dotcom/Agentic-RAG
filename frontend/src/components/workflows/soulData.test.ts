/**
 * Phase 124-01 Task 1 (WUX-01, sketch 046-A / D-02 / D-03) — soulData tests.
 *
 * The shared soul-data module is the SINGLE source of truth for the tier
 * derivation + the phase-glyph map + the needs resolver + the deliverable
 * resolver. These tests pin the locked contract (extracted VERBATIM from the
 * page-private WorkflowsPage helpers — re-implementing per soul size is the exact
 * drift this phase forbids):
 *  - tierForDefinition resolves STRICT / MIDDLE / LOOSE from the REAL enums; a
 *    null def → LOOSE without throwing.
 *  - PHASE_GLYPHS maps the 6 phase types to ⚙✎🤖⛓☺◆ exactly.
 *  - entryInputKeys prefers input_keys → inputs[].key → ["kickoff_prompt"].
 *  - soulDeliverable returns { kind: "file" } when a terminal llm_emit phase
 *    exists and the honest { kind: "chat" } when none does (D-03).
 *  - The module imports NOTHING from the API client (pure, client-side — D-02).
 */
import { describe, it, expect } from "vitest"
import soulDataSource from "./soulData?raw"
import {
  tierForDefinition,
  PHASE_GLYPHS,
  entryInputKeys,
  soulDeliverable,
  type DefShape,
} from "./soulData"

/** A strict workflow: a terminal llm_emit with citation_policy "strict" → STRICT. */
const strictDef: DefShape = {
  phases: [
    { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
    {
      slug: "emit",
      phase_index: 1,
      config: { phase_type: "llm_emit", citation_policy: "strict" },
    },
  ],
}

/** A flag-policy emit WITH the full floor-gate set → refines up to STRICT. */
const flagFullGatesDef: DefShape = {
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      config: { phase_type: "llm_emit", citation_policy: "flag" },
      validators: [
        { kind: "output_file_valid" },
        { kind: "structure_check" },
        { kind: "freshness" },
      ],
    },
  ],
}

/** A flag-policy emit with NO floor gates → MIDDLE. */
const flagNoGatesDef: DefShape = {
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      config: { phase_type: "llm_emit", citation_policy: "flag" },
    },
  ],
}

/** A draft-policy emit with NO structural gates → LOOSE. */
const draftNoGatesDef: DefShape = {
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      config: { phase_type: "llm_emit", citation_policy: "draft" },
    },
  ],
}

/** A draft-policy emit with ONE floor gate → refines up to MIDDLE. */
const draftOneGateDef: DefShape = {
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      config: { phase_type: "llm_emit", citation_policy: "draft" },
      validators: [{ kind: "structure_check" }],
    },
  ],
}

/** A chat-only workflow: no terminal llm_emit phase → honest "answer in chat". */
const chatOnlyDef: DefShape = {
  name: "Research Helper",
  phases: [
    { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "review", phase_index: 1, config: { phase_type: "llm_single" } },
  ],
}

describe("soulData.tierForDefinition — one shared tier derivation (D-02)", () => {
  it("a strict llm_emit citation_policy → STRICT", () => {
    expect(tierForDefinition(strictDef).id).toBe("STRICT")
  })

  it("flag + the full floor-gate set → STRICT; flag + no floor gates → MIDDLE", () => {
    expect(tierForDefinition(flagFullGatesDef).id).toBe("STRICT")
    expect(tierForDefinition(flagNoGatesDef).id).toBe("MIDDLE")
  })

  it("draft + no structural gates → LOOSE; draft + one floor gate → MIDDLE", () => {
    expect(tierForDefinition(draftNoGatesDef).id).toBe("LOOSE")
    expect(tierForDefinition(draftOneGateDef).id).toBe("MIDDLE")
  })

  it("a null / undefined def → LOOSE (no-emit default 'draft' path), never throws", () => {
    expect(() => tierForDefinition(null)).not.toThrow()
    expect(() => tierForDefinition(undefined)).not.toThrow()
    expect(tierForDefinition(null).id).toBe("LOOSE")
    expect(tierForDefinition(undefined).id).toBe("LOOSE")
  })
})

describe("soulData.PHASE_GLYPHS — one shared glyph map", () => {
  it("maps the 6 phase types to ⚙✎🤖⛓☺◆ exactly", () => {
    expect(PHASE_GLYPHS).toMatchObject({
      programmatic: "⚙",
      llm_single: "✎",
      llm_agent: "🤖",
      llm_batch_agents: "⛓",
      llm_human_input: "☺",
      llm_emit: "◆",
    })
    // Exactly the 6 known phase types — no extras.
    expect(Object.keys(PHASE_GLYPHS).sort()).toEqual(
      [
        "llm_agent",
        "llm_batch_agents",
        "llm_emit",
        "llm_human_input",
        "llm_single",
        "programmatic",
      ].sort(),
    )
  })
})

describe("soulData.entryInputKeys — the needs resolver", () => {
  it("prefers def.input_keys when present", () => {
    expect(
      entryInputKeys({ input_keys: ["topic", "deadline"], inputs: [{ key: "ignored" }] }),
    ).toEqual(["topic", "deadline"])
  })

  it("falls back to inputs[].key when input_keys is absent/empty", () => {
    expect(entryInputKeys({ inputs: [{ key: "topic" }, { key: "scope" }] })).toEqual([
      "topic",
      "scope",
    ])
  })

  it("falls back to ['kickoff_prompt'] when neither is present", () => {
    expect(entryInputKeys({ phases: [] })).toEqual(["kickoff_prompt"])
  })

  it("returns [] for a null def", () => {
    expect(entryInputKeys(null)).toEqual([])
  })
})

describe("soulData.soulDeliverable — the honest deliverable resolver (D-03)", () => {
  it("returns a file-deliverable when a terminal llm_emit phase exists", () => {
    const out = soulDeliverable(strictDef)
    expect(out.kind).toBe("file")
    if (out.kind === "file") {
      // A1: the exact friendly label is confirmed at UAT (not a hard assertion);
      // here we only require an honest, non-empty, non-fabricated label.
      expect(typeof out.label).toBe("string")
      expect(out.label.length).toBeGreaterThan(0)
    }
  })

  it("returns { kind: 'chat' } when NO llm_emit phase exists (the honest signal)", () => {
    expect(soulDeliverable(chatOnlyDef)).toEqual({ kind: "chat" })
  })

  it("returns { kind: 'chat' } for a null / undefined def (never fabricates)", () => {
    expect(soulDeliverable(null)).toEqual({ kind: "chat" })
    expect(soulDeliverable(undefined)).toEqual({ kind: "chat" })
  })
})

describe("soulData — purity (D-02: surfaces existing fields only, no backend touch)", () => {
  it("imports nothing from the API client", () => {
    expect(soulDataSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
  })

  it("exports exactly one PHASE_GLYPHS and one tierForDefinition (no duplication)", () => {
    const glyphExports = soulDataSource.match(/export const PHASE_GLYPHS/g) ?? []
    const tierExports = soulDataSource.match(/export function tierForDefinition/g) ?? []
    expect(glyphExports).toHaveLength(1)
    expect(tierExports).toHaveLength(1)
  })
})
