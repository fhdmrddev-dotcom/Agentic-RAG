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
 *  - PHASE_GLYPHS maps every phase type to the verified fluent-emoji slugs exactly
 *    (gear / memo / compass / handshake / raised-hand / package / outbox-tray — the
 *    flat unicode marks it once listed were retired by Phase 127-01, and the `robot` /
 *    `busts-in-silhouette` slugs it listed after that were retired by Phase 184-01
 *    Task 2 / D-184-07; both names are kept here as HISTORY, not as current truth).
 *    ⚠ The count is deliberately NOT stated in this sentence: it has now rotted twice
 *    (6 at 127-01, 7 at 189-13), and the rule is one-slug-per-type, not "six".
 *  - PHASE_GLYPHS and phaseGlyph.PHASE_GLYPH_MARKS have IDENTICAL KEY SETS — the
 *    same-commit rule `lib/phaseGlyph.tsx`'s header states in words, asserted here as
 *    a PROPERTY so a ninth phase type inherits it (Phase 189-13).
 *  - entryInputKeys prefers input_keys → inputs[].key → ["kickoff_prompt"].
 *  - soulDeliverable returns { kind: "file" } when a terminal llm_emit phase
 *    exists and the honest { kind: "chat" } when none does (D-03).
 *  - The module imports NOTHING from the API client (pure, client-side — D-02).
 *
 * Phase 193-02 (AUTH-03 / D-21 / D-25) adds the templateAdmission block below:
 *  - the predicate answers in THREE states, and every arm is entered by a real case
 *    — including `unknown` and the bound-asset `does-not-admit`, which are exactly the
 *    two a green-looking suite would otherwise never reach (the 192 CR-01 lesson:
 *    *both failure tests pinned the correct branch without ever entering the wrong one*).
 *  - the states are asserted EXHAUSTIVE as a property, so a predicate that collapsed two
 *    of them fails here even if every row's expectation had been edited to agree.
 *  - and templateAdmission is proved to answer a DIFFERENT question from soulDeliverable
 *    on a real shape — the mechanical statement of why P1′ was rejected (D-21).
 */
import { describe, it, expect } from "vitest"
import soulDataSource from "./soulData?raw"
import { PHASE_GLYPH_MARK_KEYS, phaseGlyph } from "@/lib/phaseGlyph"
import {
  tierForDefinition,
  PHASE_GLYPHS,
  entryInputKeys,
  soulDeliverable,
  templateAdmission,
  type TemplateAdmission,
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

describe("soulData.PHASE_GLYPHS — one shared icon map", () => {
  // Corrected in Phase 183-04: this case asserted the flat unicode glyphs until
  // Phase 127-01 (WUX-03) replaced them with verified fluent-emoji SLUG strings that
  // phaseGlyph() resolves to bundled 3D SVG components. The assertion had been RED
  // ever since — a red claim about the module 183 declares canonical.
  // Phase 184-01 Task 2 (D-184-07): `llm_agent` "robot" → "compass" and
  // `llm_batch_agents` "busts-in-silhouette" → "handshake". This is the ONE
  // assertion edit carved out of D-184-08's zero-assertion-edit gate — the swap is
  // a deliberate vocabulary decision, not a behaviour-preserving extraction, and it
  // is enumerated by file/line/old/new in 184-01-SUMMARY.md.
  // Phase 189-13 Task 1 (CONN-01 / UI-SPEC §5a): the 7th entry, `external_action` →
  // "outbox-tray". Same carve-out as 184-01's — a deliberate vocabulary decision, not a
  // behaviour-preserving move — and the slug was verified PRESENT in the INSTALLED
  // @iconify-json/fluent-emoji@1.2.7 set (3174 icons) before it was imported, with the
  // bare `outbox` measured ABSENT (it would fail the build).
  it("maps every known phase type to its verified fluent-emoji slug, exactly", () => {
    expect(PHASE_GLYPHS).toMatchObject({
      programmatic: "gear",
      llm_single: "memo",
      llm_agent: "compass",
      llm_batch_agents: "handshake",
      llm_human_input: "raised-hand",
      llm_emit: "package",
      external_action: "outbox-tray",
    })
    // Exactly the known phase types — no extras. Kept as an explicit list rather than
    // derived, deliberately: this case's subject is the SLUG VOCABULARY itself, and a
    // list derived from the same object it is checking would assert nothing.
    expect(Object.keys(PHASE_GLYPHS).sort()).toEqual(
      [
        "llm_agent",
        "llm_batch_agents",
        "llm_emit",
        "llm_human_input",
        "llm_single",
        "programmatic",
        "external_action",
      ].sort(),
    )
  })
})

// ── Phase 189-13 (CONN-01) — THE SPLIT-BRAIN GUARD, AS A PROPERTY ───────────────
//
// `lib/phaseGlyph.tsx`'s header states the rule in words: *"Both maps — this one and
// `soulData.PHASE_GLYPHS` — swapped in the SAME commit: swapping one alone leaves
// phaseGlyph() returning the old component while the string fallback changed, a silent
// split-brain."* Until this block that rule was enforced by SIX individual key
// assertions in the case above, which is not the same thing: six comparisons stop
// covering the moment a seventh type arrives, and the seventh type is exactly when the
// rule matters. Stated as ONE property over the key SETS, a NINTH type inherits the
// guard with nobody remembering to extend a list.
//
// ⚠ jsdom CANNOT PROVE THE MARK IS VISIBLE. It applies no CSS and paints nothing, so a
// green here means "the slug resolves and the two maps agree" and NOTHING about whether
// the 📤 reads on Deep Midnight. The luminance check against the other six on a real
// canvas is UAT row U1 (driven via Chrome MCP in plan 189-16) — that is the check that
// caught the 34.5-luminance mark 184 had to swap, and this green is not a substitute
// for it.

/** The comparison the property below makes, named so it can be driven against a
 *  KNOWN-BAD pair as a positive control rather than only against the shipped one. */
const sameKeySet = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

describe("soulData.PHASE_GLYPHS ↔ phaseGlyph.PHASE_GLYPH_MARKS — the split-brain guard", () => {
  it("the two maps have IDENTICAL KEY SETS (the same-commit rule, as a property)", () => {
    expect([...PHASE_GLYPH_MARK_KEYS].sort()).toEqual(Object.keys(PHASE_GLYPHS).sort())
    // Non-vacuity: two empty maps also have identical key sets. The vocabulary is real.
    expect(Object.keys(PHASE_GLYPHS).length).toBeGreaterThan(6)
  })

  it("the property is FALSIFIABLE — a one-sided key fails the same comparison", () => {
    // The positive control for the case above. Driven against literals so it proves the
    // COMPARISON catches a divergence without either shipped map being edited; the real
    // one-sided plant (removing `external_action` from one map only) was additionally
    // observed RED by hand and is recorded in 189-13-SUMMARY.md.
    expect(sameKeySet(Object.keys(PHASE_GLYPHS), PHASE_GLYPH_MARK_KEYS)).toBe(true)
    expect(sameKeySet(["a", "b"], ["a"])).toBe(false)
    expect(sameKeySet(["a"], ["a", "b"])).toBe(false)
  })

  it("every slug in the string map resolves to a bundled component, none to null", () => {
    // The key sets agreeing is necessary but not sufficient: a key present in both maps
    // could still resolve through `phaseGlyph`'s own-property guard to null if the map
    // held a nullish value. This drives the RESOLVER the canvas actually calls.
    for (const type of Object.keys(PHASE_GLYPHS)) {
      expect(phaseGlyph(type)).not.toBeNull()
    }
    // And the floor is intact: a type neither map owns, and an INHERITED key, both
    // resolve to null so the caller renders its "•" (the 188.1-04 WR-04 property).
    expect(phaseGlyph("llm_future_type")).toBeNull()
    expect(phaseGlyph("constructor")).toBeNull()
    expect(phaseGlyph(undefined)).toBeNull()
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

// ── Phase 193-02 (AUTH-03 / D-21 / D-25) — THE THREE-STATE ADMISSION PREDICATE ──
//
// The shapes below are the LIVE ones, not invented ones. `phases: []` is 110 of the 145
// published rows in the local library (76 %); the bound shape is the 16 rows carrying
// `assets: [{ kind: "template", asset_id: "…/_library/….docx" }]`; and the emit-with-no-
// `emitter` shape is what the shipped RunModal.test.tsx fixtures declare, which is why a
// predicate REQUIRING an explicit `emitter` would read them as non-admitting and blow up
// six whole-`innerHTML` baselines.
//
// Table-driven so a ninth shape inherits the coverage by being added to one array rather
// than by someone remembering to write a matching `it()`.

/** The emit phase the live definitions carry: no `emitter` key at all. */
const emitPhaseNoEmitter = {
  slug: "emit",
  phase_index: 0,
  config: { phase_type: "llm_emit", citation_policy: "draft" },
}

/** An emit phase that names the default emitter EXPLICITLY (all 79 live phases do). */
const emitPhaseExplicit = {
  slug: "emit",
  phase_index: 0,
  config: { phase_type: "llm_emit", citation_policy: "draft", emitter: "render_template" },
}

/** The bound shape — an emit phase whose definition ALREADY binds a library template, so
 *  `template_asset_service` Branch 1 returns unconditionally and the run-time upload is
 *  unreachable code. This is the fixture the non-duplication case below also uses. */
const boundTemplateDef: DefShape = {
  name: "Weekly status report",
  phases: [emitPhaseNoEmitter],
  assets: [{ kind: "template", asset_id: "workflows/_library/weekly-status.docx" }],
}

const ADMISSION_CASES: Array<[string, DefShape | null | undefined, TemplateAdmission]> = [
  ["undefined — the wire did not say", undefined, "unknown"],
  ["null — the wire did not say", null, "unknown"],
  ["{} — no `phases` key at all", {}, "unknown"],
  ["{ phases: null }", { phases: null }, "unknown"],
  ["{ phases: <non-array> } — a server that sent the wrong shape", { phases: "nope" as never }, "unknown"],
  ["{ phases: [] } — the unauthored stub, 110 of 145 published rows", { phases: [] }, "unknown"],
  [
    "one programmatic phase, no emit — a POSITIVE no",
    { phases: [{ slug: "calc", phase_index: 0, config: { phase_type: "programmatic" } }] },
    "does-not-admit",
  ],
  ["one llm_emit phase, NO `emitter` key, no assets", { phases: [emitPhaseNoEmitter] }, "admits"],
  [
    'one llm_emit phase with emitter: "render_template", no assets',
    { phases: [emitPhaseExplicit] },
    "admits",
  ],
  ["one llm_emit phase + a BOUND library template", boundTemplateDef, "does-not-admit"],
  [
    "one llm_emit phase + assets holding no template entry",
    { phases: [emitPhaseNoEmitter], assets: [{ kind: "attachment", asset_id: "a.pdf" }] },
    "admits",
  ],
  ["one llm_emit phase + assets: []", { phases: [emitPhaseNoEmitter], assets: [] }, "admits"],
  [
    "a mixed definition — programmatic + llm_emit, unbound",
    {
      phases: [
        { slug: "calc", phase_index: 0, config: { phase_type: "programmatic" } },
        { ...emitPhaseNoEmitter, phase_index: 1 },
      ],
    },
    "admits",
  ],
]

describe("soulData.templateAdmission — three states, never a boolean (D-21 / D-25)", () => {
  it.each(ADMISSION_CASES)("%s → %s", (_label, input, expected) => {
    expect(templateAdmission(input)).toBe(expected)
  })

  it("the table ENTERS all three states — a collapsed predicate cannot pass this", () => {
    // The 192 CR-01 lesson, applied as a property rather than as care: two failure cases
    // can both pin the correct branch without either ever entering the wrong one. Here the
    // subject is the RETURN SET itself, so a predicate that merged `unknown` into
    // `does-not-admit` fails even if every row's expectation above had been edited to agree.
    const observed = new Set(ADMISSION_CASES.map(([, input]) => templateAdmission(input)))
    expect([...observed].sort()).toEqual(["admits", "does-not-admit", "unknown"])
    expect(observed.size).toBe(3)
  })

  it("answers a DIFFERENT question from soulDeliverable — why P1′ was rejected (D-21)", () => {
    // On the bound fixture the two derivations DISAGREE, and that disagreement is the whole
    // argument: `soulDeliverable(def).kind === "file"` is byte-for-byte the P1′ predicate and
    // already drives the shipped *Makes a file* chip (library/libraryFilter.ts). If
    // templateAdmission agreed with it on every shape, the new mark would be a second word
    // for a fact this surface already states.
    expect(soulDeliverable(boundTemplateDef).kind).toBe("file")
    expect(templateAdmission(boundTemplateDef)).toBe("does-not-admit")
  })

  it("an empty `phases` is NOT the same answer as no emit phase (the D-20 arm)", () => {
    // Stated on its own because it is the one distinction `soulDeliverable` deliberately
    // does NOT make: it collapses both into { kind: "chat" }. Here they must differ, or the
    // Run modal would strip WFIN-01 from 110 of 145 published rows.
    expect(soulDeliverable({ phases: [] })).toEqual({ kind: "chat" })
    expect(soulDeliverable({ phases: [{ config: { phase_type: "programmatic" } }] })).toEqual({
      kind: "chat",
    })
    expect(templateAdmission({ phases: [] })).toBe("unknown")
    expect(templateAdmission({ phases: [{ config: { phase_type: "programmatic" } }] })).toBe(
      "does-not-admit",
    )
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
