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
  terminalEmitSlug,
  type TemplateAdmission,
  type DefShape,
} from "./soulData"
// Plan 214.1-01 Task 3, as SEPARATE statements so this file's diff stays additive.
import { entryInputFields, launchInputFields } from "./soulData"
import { declaredInputFor } from "./declaredInputs"

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
  // ⚠ 193 REVIEW WR-05. `config` is OPTIONAL in `DefShape`, so this shape is reachable, and
  // before the (2b) arm it fell through to (3) and produced a POSITIVE `does-not-admit` — the
  // answer that HIDES the Run modal's control. A phase list that says nothing about any phase
  // type is a SILENCE, and D-20 hides only on a positive no. The count gate's own comment
  // claimed this case existed while it did not, so the arm was documented as guarded and was
  // not; that claim is now earned.
  [
    "{ phases: [{ … }] } with NO `config` key — says nothing about phase type (WR-05)",
    { phases: [{ slug: "a", phase_index: 0 }] },
    "unknown",
  ],
  [
    "one phase WITH `config` but no `phase_type` — the same silence, one level down",
    { phases: [{ slug: "a", phase_index: 0, config: {} }] },
    "unknown",
  ],
  // ⚠ 193 REVIEW WR-07 — THE DOMINANT LIVE SHAPE, and nothing pinned it until now.
  // `definition` is a jsonb STRING SCALAR on 194 of 223 rows (`CLAUDE.md` § jsonb string-scalar
  // trap) and `libraryFilter`'s `defOf` casts it through UNPARSED, so `def` is very often a
  // `string` here. It answers correctly today only by luck of ordering — a string is truthy,
  // `("…").phases` is `undefined`, `Array.isArray` is false — so step (1) catches it. A future
  // "tidy" of step (1) (`def?.phases ?? []`, or an added `JSON.parse`) could move the shape the
  // MAJORITY of the live library carries into a different arm with this suite green.
  [
    "a jsonb STRING SCALAR — the shape 194 of 223 live rows carry (WR-07)",
    '{"phases":[{"config":{"phase_type":"llm_emit"}}]}' as unknown as DefShape,
    "unknown",
  ],
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

// ── Phase 197-04 (AUTH-02 / D-18) — WHICH STEP PRODUCES THE DELIVERABLE ─────────
//
// `terminalEmitSlug` is NET-NEW LOGIC, not an extraction: no shipped derivation in this
// module orders phases by `phase_index` for a PICK. `tierForDefinition` FOLDS over every
// emit phase (strictest policy wins, deliberately order-independent) and `soulDeliverable`
// uses `.some()` (order-independent by construction). So the ordering behaviour below was
// driven RED-FIRST — the descending-order case was written and observed failing before the
// implementation existed, and then again against a deliberate array-order plant, which is
// the run that proves the case pins the ORDERING rather than merely the function's
// existence. Both verdicts are quoted in 197-04-SUMMARY.md.
//
// ⚠ THE TIE-BREAK IS A DECLARED CONTRACT, NOT AN ARTEFACT OF `sort` STABILITY: greatest
// `phase_index` wins; on a tie, or when ANY candidate lacks a usable numeric index, the
// LAST candidate in ARRAY ORDER wins. Both fallbacks point the same way on purpose. Every
// arm below is entered by a real case — the 192 CR-01 lesson (*both failure tests pinned
// the correct branch without ever entering the wrong one*) applied rather than quoted.

/** Two emit phases, ascending — the shape a well-formed multi-emit draft carries. */
const twoEmitsAscending: DefShape = {
  name: "Northwind QBR",
  phases: [
    { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "interim", phase_index: 1, config: { phase_type: "llm_emit" } },
    { slug: "final", phase_index: 2, config: { phase_type: "llm_emit" } },
  ],
}

describe("soulData.terminalEmitSlug — WHICH step makes the file (D-18)", () => {
  it("two emit phases, phase_index ascending → the greater index's slug", () => {
    expect(terminalEmitSlug(twoEmitsAscending)).toBe("final")
  })

  it("two emit phases with DESCENDING phase_index in array order → still the greater phase_index's slug", () => {
    // ⚠ THE CASE THAT DISTINGUISHES THIS DERIVATION FROM `soulDeliverable`'s
    // order-independent `.some()`, and the one written RED-FIRST. A naive
    // "last element of the filtered array" would answer "draft" here; the array-order
    // plant recorded in the SUMMARY produced exactly that.
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "final", phase_index: 7, config: { phase_type: "llm_emit" } },
          { slug: "draft", phase_index: 2, config: { phase_type: "llm_emit" } },
        ],
      }),
    ).toBe("final")
  })

  it("two emit phases with EQUAL phase_index → the LAST in array order (the declared tie-break)", () => {
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "first", phase_index: 3, config: { phase_type: "llm_emit" } },
          { slug: "second", phase_index: 3, config: { phase_type: "llm_emit" } },
        ],
      }),
    ).toBe("second")
  })

  it("candidates with a MISSING or non-numeric phase_index → the LAST in array order", () => {
    // No index at all on either candidate.
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "first", config: { phase_type: "llm_emit" } },
          { slug: "second", config: { phase_type: "llm_emit" } },
        ],
      }),
    ).toBe("second")
    // A non-numeric index the wire could still send, and NaN — both fail the
    // `Number.isFinite` guard and must not silently win or lose a comparison.
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "first", phase_index: "2" as never, config: { phase_type: "llm_emit" } },
          { slug: "second", phase_index: Number.NaN, config: { phase_type: "llm_emit" } },
        ],
      }),
    ).toBe("second")
  })

  it("MIXED — one candidate indexed, one not → array order, never a half-comparison", () => {
    // The declared resolution of the mixed case: a numeric comparison in which one operand
    // does not exist is not a comparison. Stated as its own case because it is the arm a
    // reader is most likely to "simplify" into "greatest index wins, treat missing as 0" —
    // which would answer "indexed" here and silently change the jump target.
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "indexed", phase_index: 9, config: { phase_type: "llm_emit" } },
          { slug: "unindexed", config: { phase_type: "llm_emit" } },
        ],
      }),
    ).toBe("unindexed")
  })

  it("ONE llm_emit among several non-emit phases → the emit phase's slug", () => {
    // Proves the filter FILTERS, rather than blindly taking position 0 or the last element.
    // The emit sits in the MIDDLE, so both naive answers are wrong here.
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "calc", phase_index: 0, config: { phase_type: "programmatic" } },
          { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit" } },
          { slug: "review", phase_index: 2, config: { phase_type: "llm_single" } },
          { slug: "handoff", phase_index: 3, config: { phase_type: "external_action" } },
        ],
      }),
    ).toBe("emit")
  })

  it("NO emit phase → null", () => {
    expect(terminalEmitSlug(chatOnlyDef)).toBeNull()
  })

  it("a null / undefined definition → null, never throws", () => {
    expect(() => terminalEmitSlug(null)).not.toThrow()
    expect(() => terminalEmitSlug(undefined)).not.toThrow()
    expect(terminalEmitSlug(null)).toBeNull()
    expect(terminalEmitSlug(undefined)).toBeNull()
  })

  it("`phases` is not an array — the wire did not say → null", () => {
    expect(terminalEmitSlug({})).toBeNull()
    expect(terminalEmitSlug({ phases: null })).toBeNull()
    expect(terminalEmitSlug({ phases: "nope" as never })).toBeNull()
    expect(terminalEmitSlug({ phases: [] })).toBeNull()
    // ⚠ The DOMINANT live shape — `definition` is a jsonb STRING SCALAR on 194 of 223
    // rows and `libraryFilter`'s `defOf` casts it through UNPARSED (WR-07). It answers
    // correctly only because arm (1) catches it: a string is truthy, `("…").phases` is
    // `undefined`, `Array.isArray` is false. Pinned here so a future "tidy" of arm (1)
    // cannot move the majority live shape into a different arm with this suite green.
    expect(
      terminalEmitSlug(
        '{"phases":[{"slug":"emit","config":{"phase_type":"llm_emit"}}]}' as unknown as DefShape,
      ),
    ).toBeNull()
  })

  it("an emit phase whose slug is absent, non-string or empty is NOT a candidate → null", () => {
    // T-197-13. The value's only purpose is to be handed to `jumpToStep`; a slug that
    // selects nothing is strictly worse than an honest `null`, because a dead jump target
    // looks like a working control that silently does nothing.
    expect(terminalEmitSlug({ phases: [{ phase_index: 0, config: { phase_type: "llm_emit" } }] })).toBeNull()
    expect(
      terminalEmitSlug({
        phases: [{ slug: 42 as never, phase_index: 0, config: { phase_type: "llm_emit" } }],
      }),
    ).toBeNull()
    expect(
      terminalEmitSlug({ phases: [{ slug: "   ", phase_index: 0, config: { phase_type: "llm_emit" } }] }),
    ).toBeNull()
    // …and an unusable slug does not disqualify a USABLE sibling.
    expect(
      terminalEmitSlug({
        phases: [
          { slug: "real", phase_index: 0, config: { phase_type: "llm_emit" } },
          { slug: "", phase_index: 9, config: { phase_type: "llm_emit" } },
        ],
      }),
    ).toBe("real")
  })

  it("a phase list declaring no `config` at all → null (the same silence WR-05 names)", () => {
    expect(terminalEmitSlug({ phases: [{ slug: "a", phase_index: 0 }] })).toBeNull()
    expect(terminalEmitSlug({ phases: [{ slug: "a", phase_index: 0, config: {} }] })).toBeNull()
  })

  it("answers a DIFFERENT question from soulDeliverable — they disagree on a real shape", () => {
    // The non-duplication proof, mirroring the templateAdmission precedent above. This
    // definition DOES make a file, so `soulDeliverable` is correct to say `file`; there is
    // no step this card could point at, so `terminalEmitSlug` is correct to say `null`.
    // If the two agreed on every shape, the new export would be a second answer to one
    // question — the drift `soulData.ts:236-240` forbids by name.
    const unusableSlugDef: DefShape = {
      name: "Weekly status report",
      phases: [{ slug: "  ", phase_index: 0, config: { phase_type: "llm_emit" } }],
    }
    expect(soulDeliverable(unusableSlugDef).kind).toBe("file")
    expect(terminalEmitSlug(unusableSlugDef)).toBeNull()
  })

  it("is NAME-INDEPENDENT while soulDeliverable's label is not — the row-4/row-5 coupling, made checkable", () => {
    // ⚠ The coupling a plan treating rows 4 and 5 as independent would rediscover the hard
    // way: `soulDeliverable`'s label interpolates the workflow NAME, so editing the name row
    // changes the deliverable row's LABEL. The jump TARGET must not move with it — that is
    // why the card reads the two separately, and why this derivation never touches
    // `def.name`.
    const renamed: DefShape = { ...twoEmitsAscending, name: "Contoso QBR" }

    expect(terminalEmitSlug(renamed)).toBe(terminalEmitSlug(twoEmitsAscending))
    expect(terminalEmitSlug(renamed)).toBe("final")

    const before = soulDeliverable(twoEmitsAscending)
    const after = soulDeliverable(renamed)
    expect(before.kind).toBe("file")
    expect(after.kind).toBe("file")
    if (before.kind === "file" && after.kind === "file") {
      // Non-vacuity: the label genuinely MOVED, so the equality above is a real invariance
      // claim and not two reads of something that never changes.
      expect(after.label).not.toBe(before.label)
    }
  })
})

// ── Phase 214.1-01 Task 3 (STEP-02) — `required` reaches the launcher, and a label
//    equal to its key is an ABSENCE ────────────────────────────────────────────────────
//
// ⭐ WHY THE `label === key` ARM EXISTS. `declaredInputFor` writes `label: key`, because
// `InputFieldSpec.label` is a required `str` and inventing a friendly name would fabricate
// words no author wrote. Downstream, `LaunchInputFields`'s two-arm rule prints an AUTHORED
// label in the body face and a bare key in the MONO face — so without this arm every
// one-click declaration would render in the body face, telling the reader a human phrased
// that word. A label identical to the key carries nothing the key does not.

describe("soulData.entryInputFields — required, and the third absence arm (214.1)", () => {
  it("carries an authored label AND required:true by default", () => {
    expect(entryInputFields({ inputs: [{ key: "recipient", label: "Recipient" }] })).toEqual([
      { key: "recipient", label: "Recipient", required: true },
    ])
  })

  it("an ABSENT required reads true — InputFieldSpec.required defaults True", () => {
    expect(entryInputFields({ inputs: [{ key: "a", label: "A" }] })[0].required).toBe(true)
  })

  it("an explicit required:false reads false", () => {
    expect(
      entryInputFields({ inputs: [{ key: "a", label: "A", required: false }] })[0].required,
    ).toBe(false)
  })

  it("a label EQUAL to its key is an ABSENCE, not a value to print", () => {
    const out = entryInputFields({ inputs: [{ key: "recipient", label: "recipient" }] })
    expect(out).toEqual([{ key: "recipient", required: true }])
    expect(out[0].label).toBeUndefined()

    // POSITIVE CONTROL, same block: a genuinely different label SURVIVES. Without it this
    // would pass just as happily against a resolver that dropped every label.
    const authored = entryInputFields({ inputs: [{ key: "recipient", label: "Who to email" }] })
    expect(authored[0].label).toBe("Who to email")
  })

  it("a whitespace-only label is still an absence (unchanged)", () => {
    expect(entryInputFields({ inputs: [{ key: "a", label: "   " }] })[0].label).toBeUndefined()
  })

  it("a label equal to the key AFTER TRIMMING is also an absence", () => {
    expect(
      entryInputFields({ inputs: [{ key: "recipient", label: "  recipient  " }] })[0].label,
    ).toBeUndefined()
  })

  it("input_keys STILL WINS over inputs[] — that precedence is UNTOUCHED", () => {
    const out = entryInputFields({
      input_keys: ["topic"],
      inputs: [{ key: "ignored", label: "Ignored" }],
    })
    expect(out).toEqual([{ key: "topic", required: true }])
  })

  it("the editor's own output never mints an input_keys key — it would SHADOW every input", () => {
    // `WorkflowDefinition` does not declare `input_keys` at all, and a definition carrying
    // both would render the wrong form. The one minting site produces four keys and no more.
    expect(Object.keys(declaredInputFor("recipient")).sort()).toEqual([
      "key",
      "label",
      "required",
      "type",
    ])
    expect(declaredInputFor("recipient")).not.toHaveProperty("input_keys")
  })

  it("launchInputFields carries required through, minus the reserved keys", () => {
    const out = launchInputFields({
      inputs: [
        { key: "kickoff_prompt", label: "Nope" },
        { key: "recipient", label: "Recipient", required: false },
      ],
    })
    expect(out).toEqual([{ key: "recipient", label: "Recipient", required: false }])
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
