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
  groundingCauseOf,
  intersectingKbToolOf,
  PHASE_TYPE_SENTENCES,
  PHASE_TYPE_SUBTITLES,
  PHASE_TYPE_LABELS,
  SKIP_PREFIX,
  GROUNDING_DIAL_TYPES,
  EXTERNAL_CAPABILITY_SENTENCES,
  notConnectedOf,
  type NameContext,
  type PhaseSpecJSON,
} from "./phaseVocabulary"
// Phase 189-13: the placeable-type tuple, so the vocabulary's coverage is DERIVED from
// what the picker actually offers rather than from a hand-typed list that stops covering
// the union the moment a type is added. Its own import statement, the house convention.
import { PHASE_TYPE_ORDER } from "./definitionOps"

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

  it("every PLACEABLE phase type has a sentence, a subtitle and a technical label", () => {
    // Phase 189-13: DERIVED from `PHASE_TYPE_ORDER` — the tuple the step-type picker
    // actually offers — rather than the hand-typed six this case shipped with. The
    // property was never the number: it is that a type a person can PLACE always has
    // words, and a hand-typed list stops covering the union the moment a type is added
    // (which is exactly what happened to the six). 189-10 / 189-12's derive-don't-re-pin
    // lesson, applied to a shape assertion rather than to a count.
    for (const t of PHASE_TYPE_ORDER) {
      expect(PHASE_TYPE_SENTENCES[t]?.length ?? 0).toBeGreaterThan(0)
      expect(PHASE_TYPE_SUBTITLES[t]?.length ?? 0).toBeGreaterThan(0)
      expect(PHASE_TYPE_LABELS[t]?.length ?? 0).toBeGreaterThan(0)
    }
    // …and no EXTRA key either: the vocabulary covers exactly the placeable set.
    expect(Object.keys(PHASE_TYPE_SENTENCES).sort()).toEqual([...PHASE_TYPE_ORDER].sort())
    // Non-vacuity — a derived loop over an emptied tuple would assert nothing.
    expect(PHASE_TYPE_ORDER.length).toBeGreaterThan(6)
  })

  it("the three maps speak three DIFFERENT registers — no phrase is reused across them", () => {
    // The 7th type's words were authored one per map (business voice / mechanism voice /
    // terse technical noun) and this pins the rule for the whole vocabulary: one phrase
    // reused three times would mean two of the three maps had no register of their own.
    for (const t of PHASE_TYPE_ORDER) {
      expect(PHASE_TYPE_SENTENCES[t]).not.toBe(PHASE_TYPE_SUBTITLES[t])
      expect(PHASE_TYPE_SENTENCES[t]).not.toBe(PHASE_TYPE_LABELS[t])
      expect(PHASE_TYPE_SUBTITLES[t]).not.toBe(PHASE_TYPE_LABELS[t])
    }
    // The 7th type's three, quoted so a silent re-word is a red test (D-13 / UI-SPEC §6b).
    expect(PHASE_TYPE_SENTENCES.external_action).toBe("Reach outside")
    expect(PHASE_TYPE_SUBTITLES.external_action).toBe(
      "Stops for your approval before it acts outside",
    )
    expect(PHASE_TYPE_LABELS.external_action).toBe("External action")
    // ⚠ The subtitle is worded to SURVIVE Phase 190 — it must say nothing about not
    // sending, or it becomes a lie the day the node is wired up.
    expect(PHASE_TYPE_SUBTITLES.external_action).not.toMatch(/not sent|nothing is sent|never sends/i)
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

  it("(3) a folder resolves last of the three config tiers, ahead of the human-input tier", () => {
    // RE-DERIVED at 187-17 (WR-02), with the reason recorded rather than the
    // assertion quietly deleted. This case shipped asserting `llm_human_input` +
    // a bound folder ⇒ "Search Board Papers", which proved tier (3) sits ABOVE
    // tier (4). The ORDERING claim is still true and still worth pinning — but the
    // subject was wrong: an `llm_human_input` step performs no retrieval, so that
    // face was a fabricated capability claim (the second over-claim WR-02 removes;
    // its replacement is asserted in the WR-02 block below). The same ordering is
    // therefore proved on a type where the folder tier is honestly reachable.
    expect(derivedFace({ phaseType: "llm_agent", folderName: "Board Papers" })).toBe(
      "Search Board Papers",
    )
    // …and it really is tier (3) beating a LOWER tier, not merely tier (3) alone:
    // `llm_agent` reaches no tier (4), so the ordering is pinned by the human-input
    // case in the WR-02 block, which now falls to "Wait for your approval".
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

// ── Phase 187-17 (VOCAB-01 / WR-02) — the folder tier claims no capability ──────
//
// `derivedFace`'s own never-fabricate floor (D-187-05) is not only about NAMES. A
// face that says "Search Supplier Contracts" on a step whose executor performs no
// retrieval is a fabricated claim about what the step DOES — narrower than a
// fabricated name, the same floor.
//
// MEASURED, at live HEAD, and re-read for this plan rather than inherited:
//  - `LlmSinglePhaseConfig.folder_scope` (`backend/app/models/harness.py`) states it
//    itself: *"Load-bearing on llm_agent + llm_batch_agents; inert on llm_single (no
//    tools). Carried here for shape symmetry across the family."* The field rides
//    every LLM config member for SHAPE, not for behaviour.
//  - The only run-time consumer of a phase's `folder_scope` is the per-phase
//    narrowing inside `_build_phase_tool_context`
//    (`backend/app/services/harness/phase_types.py`) — the sub-agent tool-context
//    build, which serves the tool-carrying types only.
//  - `grounding.grounding_cause` declines to read `folder_scope` for the IDENTICAL
//    reason ("it exists on all five LLM config members … so reading it would
//    auto-lock steps that read nothing"). Same question, so the same predicate:
//    `GROUNDING_DIAL_TYPES`, imported here and never re-typed below.
//
// The sweep derives its expectation from that imported constant, so this suite
// cannot drift from the rule it guards — and it cannot be satisfied by widening the
// constant either, because widening it would change grounding semantics (D-185-15).

/** The six shipped phase types, DERIVED from the vocabulary so a seventh is covered
 *  the day it is added — the same idiom the corpus sweep uses for its token list. */
const ALL_PHASE_TYPES = Object.keys(PHASE_TYPE_SENTENCES)

describe("phaseVocabulary.derivedFace — the folder tier reaches only retrieval types (WR-02)", () => {
  it("llm_single with a bound folder states NO search — folder_scope is inert there", () => {
    expect(derivedFace({ phaseType: "llm_single", folderName: "Supplier Contracts" })).toBeNull()
  })

  it("programmatic with a bound folder states NO search — a server step runs no agent loop", () => {
    expect(derivedFace({ phaseType: "programmatic", folderName: "Supplier Contracts" })).toBeNull()
  })

  it("llm_emit with a bound folder and NO template states NO search", () => {
    // `llm_emit` is DELIBERATELY excluded, against the field's own docblock.
    // `LlmEmitPhaseConfig.folder_scope` claims to be "load-bearing in the executor
    // plan — bound-scope retrieval + skill composition feeding the emit". That is a
    // PLAN-ERA claim and the shipped executor refutes it: `_exec_llm_emit`
    // (`backend/app/services/harness/phase_types.py`) is a SEALED FORCED EMIT — it
    // never drives the agent loop, never calls `_build_phase_tool_context`, and never
    // reads `folder_scope` or `folder_subtree_ids`. Its evidence comes from
    // `_emit_evidence(accumulated_outputs)`, i.e. the retrieval PRIOR phases already
    // performed. Re-measured at live HEAD for 187-17: zero functional hits for either
    // symbol across the whole `_exec_llm_emit` body.
    expect(derivedFace({ phaseType: "llm_emit", folderName: "Supplier Contracts" })).toBeNull()
  })

  it("llm_emit with a bound folder AND a template still renders Fill — tier (2) is undisturbed", () => {
    expect(
      derivedFace({
        phaseType: "llm_emit",
        templateFilename: "Renewal Summary.pptx",
        folderName: "Supplier Contracts",
      }),
    ).toBe("Fill Renewal Summary.pptx")
  })

  it("llm_human_input with a bound folder waits for you — the second over-claim, removed", () => {
    // Shipped behaviour was "Search Board Papers", because tier (3) is reached before
    // tier (4). A step that pauses for a person searches nothing; the gate drops it
    // through to the tier that describes what it actually does.
    expect(derivedFace({ phaseType: "llm_human_input", folderName: "Board Papers" })).toBe(
      "Wait for your approval",
    )
  })

  it("POSITIVE CONTROL — llm_agent still searches (the gate must not over-tighten)", () => {
    expect(derivedFace({ phaseType: "llm_agent", folderName: "Supplier Contracts" })).toBe(
      "Search Supplier Contracts",
    )
  })

  it("POSITIVE CONTROL — llm_batch_agents still searches (half the gated set was unmeasured)", () => {
    expect(derivedFace({ phaseType: "llm_batch_agents", folderName: "Supplier Contracts" })).toBe(
      "Search Supplier Contracts",
    )
  })

  it("TYPE-SPACE SWEEP: a sole bound folder faces iff the type is in GROUNDING_DIAL_TYPES", () => {
    // The expectation is DERIVED from the imported constant, never from a re-typed
    // list — so the suite guards the rule rather than a snapshot of it.
    const observed = ALL_PHASE_TYPES.map((phaseType) => [
      phaseType,
      derivedFace({ phaseType, folderName: "Supplier Contracts" }) === "Search Supplier Contracts",
    ])
    const expected = ALL_PHASE_TYPES.map((phaseType) => [
      phaseType,
      GROUNDING_DIAL_TYPES.includes(phaseType),
    ])
    expect(observed).toEqual(expected)
    // Non-vacuity in both directions: the sweep would pass over an all-true or an
    // all-false rule too, so both halves are asserted to be non-empty.
    expect(expected.filter(([, hit]) => hit)).toHaveLength(GROUNDING_DIAL_TYPES.length)
    expect(GROUNDING_DIAL_TYPES.length).toBeGreaterThan(0)
    expect(GROUNDING_DIAL_TYPES.length).toBeLessThan(ALL_PHASE_TYPES.length)
  })

  it("an unknown phase_type never reaches the folder tier either", () => {
    expect(derivedFace({ phaseType: "llm_future_type", folderName: "Supplier Contracts" })).toBeNull()
  })
})

describe("phaseVocabulary — WR-02 on the PHASE-SHAPED path real callers use", () => {
  it("derivedFaceOf: a sole resolvable folder_scope on llm_single resolves to nothing", () => {
    const p = phase({ config: { phase_type: "llm_single", folder_scope: [FOLDER_ID] } })
    expect(derivedFaceOf(p, CTX)).toBeNull()
  })

  it("derivedFaceOf: the same binding on llm_batch_agents DOES resolve", () => {
    const p = phase({ config: { phase_type: "llm_batch_agents", folder_scope: [FOLDER_ID] } })
    expect(derivedFaceOf(p, CTX)).toBe("Search Supplier Contracts")
  })

  it("nodeTitle: an llm_single step with a bound folder renders the plain type sentence", () => {
    const p = phase({ config: { phase_type: "llm_single", folder_scope: [FOLDER_ID] } })
    const title = nodeTitle(p, CTX)
    expect(title).toBe(PHASE_TYPE_SENTENCES.llm_single)
    // Never a folder claim, and never an id — the never-fabricate floor is
    // STRENGTHENED by the gate, not relaxed (D-187-05).
    expect(title).not.toContain("Supplier Contracts")
    expect(title).not.toContain(FOLDER_ID)
  })

  it("nodeTitle: a programmatic step with a bound folder renders the plain type sentence", () => {
    const p = phase({ config: { phase_type: "programmatic", folder_scope: [FOLDER_ID] } })
    const title = nodeTitle(p, CTX)
    expect(title).toBe(PHASE_TYPE_SENTENCES.programmatic)
    expect(title).not.toContain("Supplier Contracts")
    expect(title).not.toContain(FOLDER_ID)
  })

  it("nodeTitle: an llm_human_input step with a bound folder waits for your approval", () => {
    const p = phase({ config: { phase_type: "llm_human_input", folder_scope: [FOLDER_ID] } })
    expect(nodeTitle(p, CTX)).toBe("Wait for your approval")
  })

  it("nodeTitle: a stored name still wins over the gated-out tier, on every type", () => {
    for (const phaseType of ALL_PHASE_TYPES) {
      const p = phase({ name: "Board-ready renewal pack", config: { phase_type: phaseType, folder_scope: [FOLDER_ID] } })
      expect(nodeTitle(p, CTX)).toBe("Board-ready renewal pack")
    }
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

describe("phaseVocabulary — WR-02 reuses the shipped constant, never a second list (T-187-17-02)", () => {
  it("the folder tier names GROUNDING_DIAL_TYPES by identifier", () => {
    // Three reads: the declaration, `groundingCause`'s dial check, and the folder
    // tier's gate. A gate written as an inline literal would leave this at two.
    const hits = phaseVocabularySource.match(/GROUNDING_DIAL_TYPES/g) ?? []
    expect(hits.length).toBeGreaterThanOrEqual(3)
  })

  it("the two dial type strings appear together in exactly ONE array literal", () => {
    // D-185-15 red line: the constant mirrors the backend grounding rule, so a
    // SECOND copy of its members would be a second answer to a safety question.
    const literals =
      phaseVocabularySource.match(/\[\s*"llm_agent"\s*,\s*"llm_batch_agents"\s*\]/g) ?? []
    expect(literals).toHaveLength(1)
  })

  it("the constant itself is NOT widened — still exactly the two backend dial types", () => {
    expect([...GROUNDING_DIAL_TYPES]).toEqual(["llm_agent", "llm_batch_agents"])
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
    // DERIVED from the placeable tuple (189-13) plus an unknown type, rather than the
    // hand-typed five this loop shipped with: the claim quantifies over every OTHER type,
    // so a hand-typed list had already stopped covering the union once.
    const others = [...PHASE_TYPE_ORDER.filter((t) => t !== "llm_human_input"), "nope"]
    expect(others.length).toBeGreaterThan(6)
    for (const t of others) {
      expect(waitsForYou(phase({ config: { phase_type: t } }))).toBe(false)
    }
  })
})

// ── Phase 189-13 (CONN-01 / D-13) — THE CAPABILITY-DERIVED LADDER TIER ───────────
//
// D-13 puts the middle tier of the vocabulary ladder on the CHOSEN CAPABILITY: the face
// is computed at render from `config.capability` and written NOWHERE, falling back to
// the generic type sentence when no capability is chosen. These cases pin the three
// things that make that safe rather than merely present — the GATE (no other type can
// claim it), the FLOOR (an unrecognised name never fabricates a face) and the ORDER
// (where the new tier sits among the five it joined).

/** An `external_action` phase carrying a raw stored capability value — `unknown` on
 *  purpose, because the whole point of the own-guard is values the type system forbids. */
const externalPhase = (capability?: unknown): PhaseSpecJSON =>
  phase({
    slug: "notify-owner",
    config:
      capability === undefined
        ? { phase_type: "external_action" }
        : { phase_type: "external_action", capability },
  })

describe("phaseVocabulary — the capability tier, tier (4) (D-13)", () => {
  it("ALL THREE capabilities produce their own distinct sentence", () => {
    expect(derivedFace({ phaseType: "external_action", capability: "send_email" })).toBe(
      "Sends an email",
    )
    expect(derivedFace({ phaseType: "external_action", capability: "create_ticket" })).toBe(
      "Creates a ticket",
    )
    expect(derivedFace({ phaseType: "external_action", capability: "post_message" })).toBe(
      "Posts a message",
    )
    // Distinct from each other — three capabilities that rendered the same face would
    // defeat the entire reason D-13 exists (two steps doing different work must not read
    // letter-for-letter identically).
    const faces = Object.values(EXTERNAL_CAPABILITY_SENTENCES)
    expect(new Set(faces).size).toBe(faces.length)
    expect(faces).toHaveLength(3)
  })

  it("NO capability chosen falls through to the type sentence, not to a guess", () => {
    expect(derivedFace({ phaseType: "external_action" })).toBeNull()
    expect(nodeTitle(externalPhase())).toBe(PHASE_TYPE_SENTENCES.external_action)
    expect(nodeTitle(externalPhase())).toBe("Reach outside")
  })

  it("an UNRECOGNISED stored capability falls through and NEVER fabricates a face", () => {
    // The T-189-39 spoofing mitigation, driven. A stored name the client does not know
    // must read as the generic nature of the step — rendering a claim about an act the
    // executor cannot perform states something false to the author.
    expect(derivedFace({ phaseType: "external_action", capability: "wire_transfer" })).toBeNull()
    expect(nodeTitle(externalPhase("wire_transfer"))).toBe("Reach outside")
    // And it is not any of the three real faces, checked by exact equality.
    for (const real of Object.values(EXTERNAL_CAPABILITY_SENTENCES)) {
      expect(nodeTitle(externalPhase("wire_transfer"))).not.toBe(real)
    }
  })

  it("WR-04: an INHERITED key falls through — `constructor` never reaches the face", () => {
    // The own-property probe. `EXTERNAL_CAPABILITY_SENTENCES` is a plain object literal,
    // so a BARE `SENTENCES[capability]` returns the `Object` FUNCTION for these names and
    // no `??` fallback fires — the measured hard render crash of 188.1-04, one map along.
    for (const inherited of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(derivedFace({ phaseType: "external_action", capability: inherited })).toBeNull()
      expect(() => nodeTitle(externalPhase(inherited))).not.toThrow()
      expect(nodeTitle(externalPhase(inherited))).toBe("Reach outside")
    }
    // Positive control: the guard is not simply refusing everything.
    expect(derivedFace({ phaseType: "external_action", capability: "send_email" })).toBe(
      "Sends an email",
    )
  })

  it("TOTALITY: a non-string capability in the loose JSONB resolves rather than throwing", () => {
    for (const junk of [42, null, true, { send_email: "x" }, ["send_email"]]) {
      expect(() => nodeTitle(externalPhase(junk))).not.toThrow()
      expect(nodeTitle(externalPhase(junk))).toBe("Reach outside")
    }
  })

  it("THE GATE: no OTHER phase type can claim a capability face", () => {
    // The mirror of WR-02's folder gate. `capability` is not carried by the six shipped
    // config members at all, but a hand-edited JSONB row can spell anything, and a face
    // saying "Sends an email" on an `llm_single` step would be a fabricated capability.
    //
    // ⚠ THE CLAIM IS "never a CAPABILITY face", NOT "always null" — and the difference was
    // MEASURED, not assumed. Written as `toBeNull()` this case failed on
    // `llm_human_input`, which takes tier (5) and correctly answers "Wait for your
    // approval". A gate test that demands null would have been asserting the absence of
    // the tier BELOW it as well, which is not this gate's subject.
    const capabilityFaces = Object.values(EXTERNAL_CAPABILITY_SENTENCES)
    const others = PHASE_TYPE_ORDER.filter((x) => x !== "external_action")
    for (const t of others) {
      expect(capabilityFaces).not.toContain(derivedFace({ phaseType: t, capability: "send_email" }))
      expect(capabilityFaces).not.toContain(
        derivedFaceOf(phase({ config: { phase_type: t, capability: "send_email" } })),
      )
      // And the five types with no tier of their own still reach the honest floor.
      if (t !== "llm_human_input") {
        expect(derivedFace({ phaseType: t, capability: "send_email" })).toBeNull()
      }
    }
    expect(others).toHaveLength(6)
    // Positive control: the gated type DOES produce one of those faces, so the
    // `not.toContain` above is a measurement rather than a vacuous truth.
    expect(capabilityFaces).toContain(
      derivedFace({ phaseType: "external_action", capability: "send_email" }),
    )
  })

  it("THE ORDER: a bound skill (tier 1) still beats the capability tier", () => {
    // The ladder is MOST-SPECIFIC-FIRST and the numbering IS the decision record. A phase
    // matching BOTH tiers must take the higher one; without this, inserting a tier is a
    // silent re-ordering of everything below it.
    expect(
      derivedFace({
        phaseType: "external_action",
        skillName: "pricing policy check",
        capability: "send_email",
      }),
    ).toBe("Run the pricing policy check")
    // …and through the phase-shaped adapter real callers use.
    const withSkill = phase({
      config: { phase_type: "external_action", capability: "send_email", skill_ref: SKILL_ID },
    })
    expect(derivedFaceOf(withSkill, CTX)).toBe("Run the pricing policy check")
    // The control: without the skill binding the SAME phase takes the capability tier, so
    // the assertion above measures precedence rather than an inert branch.
    expect(derivedFaceOf(externalPhase("send_email"), CTX)).toBe("Sends an email")
  })

  it("THE ORDER: the capability tier beats the type sentence, and sits ABOVE human input", () => {
    // Tier (4) fires where tier (6)'s floor would otherwise be reached…
    expect(nodeTitle(externalPhase("create_ticket"))).toBe("Creates a ticket")
    expect(nodeTitle(externalPhase("create_ticket"))).not.toBe(
      PHASE_TYPE_SENTENCES.external_action,
    )
    // …and tier (5) is untouched by its insertion — the one case a renumbering could break.
    expect(derivedFace({ phaseType: "llm_human_input" })).toBe("Wait for your approval")
  })

  it("the sentence map is EXPORTED as ONE constant (plan 189-14's picker reads it)", () => {
    // D-23: the picker's three option labels and the node face's three sentences are one
    // constant read twice, never two copies. Exported, closed at three, and declared
    // exactly once in this module.
    expect(Object.keys(EXTERNAL_CAPABILITY_SENTENCES).sort()).toEqual([
      "create_ticket",
      "post_message",
      "send_email",
    ])
    const decls = phaseVocabularySource.match(/export const EXTERNAL_CAPABILITY_SENTENCES/g) ?? []
    expect(decls).toHaveLength(1)
  })

  it("the ladder is numbered with INTEGERS and gated on NAMED constants, not literals", () => {
    // The numbering exists to force the most-specific-first ordering test; a decimal tier
    // defeats it and invites another. Asserted on the SOURCE because the numbering is a
    // comment convention, which is precisely the kind of claim nothing else checks.
    for (const tier of ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)"]) {
      expect(phaseVocabularySource).toContain(`// ${tier} `)
    }
    expect(phaseVocabularySource).not.toMatch(/\/\/\s*\(\d+\.\d+\)/)
    // Positive control: the decimal regex really does match a decimal tier.
    expect("  // (3.5) SOMETHING").toMatch(/\/\/\s*\(\d+\.\d+\)/)
    // The gate is a named module-scope constant, following HUMAN_INPUT_PHASE_TYPE's form.
    expect(phaseVocabularySource).toMatch(/const EXTERNAL_ACTION_PHASE_TYPE = "external_action"/)
    expect(phaseVocabularySource).toMatch(/inputs\.phaseType === EXTERNAL_ACTION_PHASE_TYPE/)
  })

  it("the WR-04 guard is the INLINE form — this module still has ZERO imports", () => {
    // `phaseVocabulary.ts` has never imported anything, and importing the shared
    // `ownProperty` helper would have made this change the file's first import ever. The
    // `runVocabulary.ts` inline precedent is copied instead.
    expect(phaseVocabularySource).not.toMatch(/^import\s/m)
    expect(phaseVocabularySource).toMatch(
      /Object\.prototype\.hasOwnProperty\.call\(EXTERNAL_CAPABILITY_SENTENCES,/,
    )
    // Positive control: the zero-import regex really does match an import line.
    expect('import { own } from "./ownProperty"\n').toMatch(/^import\s/m)
  })

  it("GROUNDING_DIAL_TYPES is UNCHANGED — external_action must never join it", () => {
    // A D-185-15 red line, pinned by membership rather than by a comment. The gate stays
    // correct for this type: its three capabilities are disjoint from the KB tools, so the
    // step reads no knowledge base, carries no ⛨ seal, and is free to think BY
    // CONSTRUCTION — correct, not a gap.
    expect([...GROUNDING_DIAL_TYPES]).toEqual(["llm_agent", "llm_batch_agents"])
    expect(GROUNDING_DIAL_TYPES).not.toContain("external_action")
    // …and the consequence, driven rather than asserted about: a folder bound on an
    // external-action step still faces nothing.
    expect(
      derivedFace({ phaseType: "external_action", folderName: "Supplier Contracts" }),
    ).toBeNull()
  })
})

// ── Phase 189-13 (CONN-01 / D-12 / D-18) — the badge slot-1 predicate ────────────

describe("phaseVocabulary.notConnectedOf — badge slot 1 (D-12 / D-18)", () => {
  it("is true for external_action and FALSE for all six shipped types, each asserted", () => {
    expect(notConnectedOf(externalPhase("send_email"))).toBe(true)
    expect(notConnectedOf(externalPhase())).toBe(true)
    // ⚠ THE FALSIFIABLE HALF AVAILABLE TODAY IS THE TYPE TEST, and that is stated rather
    // than left to be discovered: nothing in this app can be CONNECTED to anything until
    // Phase 190 (no connection mechanism exists), so the state test's false branch is
    // unreachable and the badge is *de facto* type-conditional. The six shipped types are
    // what makes "the badge is absent unless the step is an external action" a measurement.
    expect(notConnectedOf(phase({ config: { phase_type: "programmatic" } }))).toBe(false)
    expect(notConnectedOf(phase({ config: { phase_type: "llm_single" } }))).toBe(false)
    expect(notConnectedOf(phase({ config: { phase_type: "llm_agent" } }))).toBe(false)
    expect(notConnectedOf(phase({ config: { phase_type: "llm_batch_agents" } }))).toBe(false)
    expect(notConnectedOf(phase({ config: { phase_type: "llm_human_input" } }))).toBe(false)
    expect(notConnectedOf(phase({ config: { phase_type: "llm_emit" } }))).toBe(false)
    // And derived, so a shipped type renamed or an EIGHTH type added cannot slip past the
    // six literals above.
    for (const t of PHASE_TYPE_ORDER.filter((x) => x !== "external_action")) {
      expect(notConnectedOf(phase({ config: { phase_type: t } }))).toBe(false)
    }
  })

  it("is TOTAL — an unknown type and a malformed config resolve to false, never throw", () => {
    expect(notConnectedOf(phase({ config: { phase_type: "llm_future_type" } }))).toBe(false)
    const malformed = { slug: "x", phase_index: 0 } as unknown as PhaseSpecJSON
    expect(() => notConnectedOf(malformed)).not.toThrow()
    expect(notConnectedOf(malformed)).toBe(false)
  })

  // ── Phase 190-05 (CONN-02 / D-13 / D-24) — the STATE test becomes falsifiable ────
  //
  // 189-13 recorded, in this file and in the function's own docblock, that the false
  // branch of the state test was UNREACHABLE: no connection mechanism existed anywhere
  // in the app, so every `external_action` step genuinely WAS not-connected and the
  // badge was *de facto* type-conditional. 190 is the phase that makes it reachable —
  // `ExternalActionPhaseConfig` gains the additive-optional `connection_id` REFERENCE
  // (D-13: no secret, no host, no token ever enters the definition JSONB), so the
  // predicate can finally be driven on BOTH polarities.
  //
  // The four cases below are the pair, the boundary and the type half. Without all
  // four the one-line edit at `phaseVocabulary.ts` is unguarded: the pair alone would
  // not catch a truthiness bug that accepts `""` as a destination, and neither would
  // catch the badge silently widening to a second phase type (a `190-UI-SPEC.md` §14
  // failure condition, verbatim).
  //
  // RED OBSERVED (plan 190-05), verbatim from
  // `npx vitest run src/components/workflows/phaseVocabulary.test.ts` at commit d78817b8,
  // BEFORE the one-line edit to `phaseVocabulary.ts:812` — recorded here rather than in a
  // summary nobody re-reads, because a test written after the fix it guards proves only
  // that the fix is present, never that the test can see its absence:
  //
  //   ❯ src/components/workflows/phaseVocabulary.test.ts (117 tests | 2 failed) 35ms
  //        × returns FALSE for an external_action phase that HAS a connection_id bound 7ms
  //        × returns TRUE when connection_id is present but empty or whitespace 1ms
  //
  //    FAIL … > returns FALSE for an external_action phase that HAS a connection_id bound
  //   AssertionError: expected true to be false // Object.is equality
  //   - Expected
  //   + Received
  //   - false
  //   + true
  //    ❯ src/components/workflows/phaseVocabulary.test.ts:1003:88
  //
  //    FAIL … > returns TRUE when connection_id is present but empty or whitespace
  //   AssertionError: expected true to be false // Object.is equality
  //   - Expected
  //   + Received
  //   - false
  //   + true
  //    ❯ src/components/workflows/phaseVocabulary.test.ts:1039:53
  //
  //    Test Files  1 failed (1)
  //         Tests  2 failed | 115 passed (117)
  //
  // ⚠ The two `:LINE:COL` references were RE-CAPTURED against the file as committed,
  // after the transcript itself was pasted in — inserting 33 comment lines above an
  // assertion moves it, and a transcript citing pre-insertion numbers would point a
  // future reader at the wrong lines. (The same correction plan 190-01 had to make in
  // commit 0d52542c.) Re-derive with:
  //   npx vitest run src/components/workflows/phaseVocabulary.test.ts
  //
  // ⚠ NOTE WHICH LINE THE SECOND FAILURE LANDED ON — `:1039`, the CONTRAST assertion
  // (`"a"` → false), not one of the eight empty/whitespace/non-string lines above it.
  // That is the whole reason the contrast is in the case: against an unconditional
  // `return true` every "is TRUE" line passes vacuously, so a boundary case without its
  // opposite would have shipped GREEN while pinning nothing at all.

  /**
   * An `external_action` phase carrying a raw stored `connection_id`.
   *
   * `unknown` on purpose, and for the same reason `externalPhase` above types its
   * capability that way: the definition column is JSONB and hand-editable, so the value
   * reaches the client as any JSON value — or not at all. A fixture that could only
   * express `string | undefined` would be testing the type system rather than the
   * predicate. `ABSENT` distinguishes "no key at all" from "the key holding undefined",
   * which are different JSONB shapes and must both resolve to *not connected*.
   *
   * Built WITHOUT the shared `phase()` helper, and the cast is deliberate — the same
   * reasoning `toolPhase` below records for the same reason. `phase()` types its `config`
   * as `PhaseConfigJSON & Record<string, unknown>`, so a `Record<string, unknown>` built
   * up conditionally is not assignable to it (measured: `error TS2322`, which took `tsc`
   * from 33 to 34 on the first draft of this fixture). The conditional build is what
   * expresses "no key at all", so the cast moves rather than the shape.
   */
  const ABSENT = Symbol("connection_id absent")
  const boundExternalPhase = (connectionId: unknown = ABSENT): PhaseSpecJSON => {
    const config: Record<string, unknown> = { phase_type: "external_action" }
    if (connectionId !== ABSENT) config.connection_id = connectionId
    return {
      slug: "notify-owner",
      phase_index: 0,
      config: config as PhaseSpecJSON["config"],
    }
  }

  it("returns FALSE for an external_action phase that HAS a connection_id bound", () => {
    // THE FIRST GENUINE BOUND CASE IN THIS SUITE'S HISTORY. Before 190 this assertion
    // could not be written honestly — there was nothing to bind. It reads the reference
    // field and nothing else: no host, no token, no secret is available to the canvas
    // to read, and none is asked for (D-13 / CONN-03 SC#4 read literally).
    expect(notConnectedOf(boundExternalPhase("3f6c2a1e-9b4d-4c77-a0f2-15b8e7d9c204"))).toBe(
      false,
    )
    // …and it is the DATA that decided, not the type: the same phase type with nothing
    // bound still carries the badge. This is D-12's whole reason for choosing a
    // STATE-conditional badge over a TYPE-conditional one.
    expect(notConnectedOf(boundExternalPhase())).toBe(true)
  })

  it("returns TRUE for an external_action phase with NO connection_id", () => {
    // The shipped polarity, kept beside its new opposite so neither can be deleted
    // without the other looking odd. Three distinct JSONB shapes all mean the same
    // thing — no destination — and none of them may be mistaken for one.
    expect(notConnectedOf(boundExternalPhase())).toBe(true) // key absent entirely
    expect(notConnectedOf(boundExternalPhase(undefined))).toBe(true) // key holding undefined
    expect(notConnectedOf(boundExternalPhase(null))).toBe(true) // key holding null
    // The capability-carrying fixture the rest of this file uses agrees, unbound.
    expect(notConnectedOf(externalPhase("send_email"))).toBe(true)
  })

  it("returns TRUE when connection_id is present but empty or whitespace", () => {
    // AN EMPTY STRING IS NOT A DESTINATION. This pins the SHAPE of the state test, not
    // merely its two headline answers: a `!!phase.config.connection_id` truthiness bug
    // would pass the pair above and fail here, and a `"connection_id" in config` key
    // test would fail here too. The badge must keep flagging a step that cannot reach
    // anything, and a step bound to `""` cannot reach anything.
    expect(notConnectedOf(boundExternalPhase(""))).toBe(true)
    expect(notConnectedOf(boundExternalPhase("   "))).toBe(true)
    expect(notConnectedOf(boundExternalPhase("\t\n "))).toBe(true)
    // A non-string is not an id either — the column is JSONB and admits all of these.
    expect(notConnectedOf(boundExternalPhase(42))).toBe(true)
    expect(notConnectedOf(boundExternalPhase(true))).toBe(true)
    expect(notConnectedOf(boundExternalPhase({ id: "x" }))).toBe(true)
    expect(notConnectedOf(boundExternalPhase(["x"]))).toBe(true)
    // THE CONTRAST that makes every line above falsifiable rather than vacuous: the
    // boundary is non-empty-string, so the shortest possible real id is connected.
    expect(notConnectedOf(boundExternalPhase("a"))).toBe(false)
    expect(notConnectedOf(boundExternalPhase("  a  "))).toBe(false)
  })

  it("still returns FALSE for every non-external_action phase type, bound or not", () => {
    // THE TYPE HALF, RE-ASSERTED ACROSS THE ONE-LINE EDIT. 190 touches the second line
    // only, and this case is what proves the first line still decides first: a state
    // test that ran before the type test — or one fused into a single expression —
    // would light the badge on a `programmatic` step with no `connection_id`, which is
    // the "renders on a step of any other type" failure condition of §14.
    for (const t of PHASE_TYPE_ORDER.filter((x) => x !== "external_action")) {
      expect(notConnectedOf(phase({ config: { phase_type: t } }))).toBe(false)
      expect(
        notConnectedOf(phase({ config: { phase_type: t, connection_id: "" } })),
      ).toBe(false)
      expect(
        notConnectedOf(
          phase({ config: { phase_type: t, connection_id: "3f6c2a1e-9b4d" } }),
        ),
      ).toBe(false)
    }
    // An eighth type nobody has written yet is covered by the same rule.
    expect(
      notConnectedOf(
        phase({ config: { phase_type: "llm_future_type", connection_id: "3f6c2a1e" } }),
      ),
    ).toBe(false)
  })

  it("phaseVocabulary.ts has ZERO import statements", () => {
    // A PROPERTY FENCE, not a description. `phaseVocabulary.ts` has never imported
    // anything, and its own docblock at `:679` warns that this is not the change that
    // should make it start. 190's replacement line reads `phase.config` — a parameter
    // the function already receives — so the property survives BY CONSTRUCTION rather
    // than by care. Its positive control is inline below; its REAL positive control is
    // a planted import in the production file, driven RED in plan 190-05 task 3.
    const IMPORT_FORM =
      /^\s*import[\s({'"]|^\s*export\s[^=]*\bfrom\s*['"]|\brequire\s*\(|\bimport\s*\(/

    // Strip comments first: the module's only two `import`-matching lines are PROSE
    // (`:509` inside a block comment, `:679` inside a line comment), and a fence that
    // counted those would be permanently red for a property that actually holds.
    const code = phaseVocabularySource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
    const offenders = code.split("\n").filter((line) => IMPORT_FORM.test(line))
    expect(offenders).toEqual([])

    // Belt-and-braces on the UNSTRIPPED source, so a comment-stripping mistake above
    // cannot silently disarm the fence.
    expect(phaseVocabularySource).not.toMatch(/^import\s/m)

    // POSITIVE CONTROLS — four real import forms, each of which the fence must catch.
    // A fence with no control is a fence nobody has proved bites.
    expect('import { own } from "./ownProperty"').toMatch(IMPORT_FORM)
    expect('import type { Foo } from "./canvasModel"').toMatch(IMPORT_FORM)
    expect('export { thing } from "./definitionOps"').toMatch(IMPORT_FORM)
    expect('const y = require("./canvasModel")').toMatch(IMPORT_FORM)
    expect('const p = await import("./canvasModel")').toMatch(IMPORT_FORM)
  })

  it("the TYPE test and the STATE test are on SEPARATE LINES (the Phase-190 seam)", () => {
    // D-12 chose a STATE-conditional badge over a TYPE-conditional one so that 190 edits
    // ONE line and the adapter, `PhaseNode.tsx` and the card are all untouched. A fused
    // single-expression predicate would force 190 to re-open all of them, so the shape is
    // asserted rather than described — the numbered-ladder argument, applied to a
    // two-line function.
    //
    // ⚠ AMENDED AT 190-05, AND THE AMENDMENT IS THE POINT. This case shipped at 189-13
    // asserting `body` matched `/\n\s+return true/` — the shipped LITERAL of the state
    // test. That is the one line 190 was designed to replace, so the case went RED on
    // the intended change: it was pinning the placeholder rather than the property. The
    // PROPERTY is "two separate statements, type first, state second", and that is what
    // it pins now. The literal is deliberately NOT re-pinned to 190's text either — a
    // future phase that widens the destination test (a second capability's id shape, an
    // is_enabled read) must not have to come back here.
    const body = phaseVocabularySource
      .slice(phaseVocabularySource.indexOf("export function notConnectedOf"))
      .split("\n}")[0]
    // The two tests live on two lines, so the shape is measured over LINES. (Note the
    // type test's `return false` is NOT at column 0 of its line — it trails an `if (…)`
    // guard — so a `/^\s*return/` count sees one of the two, which is how the first
    // draft of this amendment got it wrong and was corrected by running it.)
    const lines = body.split("\n").filter((l) => /\breturn\b/.test(l))
    // 1 — EXACTLY TWO lines return. A third would mean a branch nobody named.
    expect(lines).toHaveLength(2)
    // 2 — the TYPE test is FIRST, still its own statement, still an early return.
    expect(lines[0]).toMatch(/!== EXTERNAL_ACTION_PHASE_TYPE\) return false/)
    // 3 — the STATE test is SECOND, on its OWN line, and decides on the DESTINATION
    //     rather than on the type a second time.
    expect(lines[1]).toMatch(/^\s*return\b/)
    expect(lines[1]).toMatch(/connection_id/)
    expect(lines[1]).not.toMatch(/EXTERNAL_ACTION_PHASE_TYPE/)
    // Positive control A: a fused one-liner would NOT match the two-line shape above.
    expect("return phase.config?.phase_type === EXTERNAL_ACTION_PHASE_TYPE").not.toMatch(
      /!== EXTERNAL_ACTION_PHASE_TYPE\) return false/,
    )
    // Positive control B: a fused predicate carrying BOTH tests in ONE statement passes
    // control A's negative, but has ONE returning line — which is what assertion 1
    // catches. This is the exact regression that would re-open `PhaseNode.tsx` and the
    // card, so the control is a real string driven through the real matcher.
    const fused =
      "export function notConnectedOf(p: PhaseSpecJSON): boolean {\n" +
      '  return p.config?.phase_type === EXTERNAL_ACTION_PHASE_TYPE &&\n' +
      '    typeof p.config?.connection_id !== "string"'
    expect(fused.split("\n").filter((l) => /\breturn\b/.test(l))).toHaveLength(1)
  })
})

// ── 187-24 / review WR-14 — the membership rule has ONE home ─────────────────────
//
// `SeedReceipt.tsx` declared its own `available_tools ∩ kbTools` loop one line after
// its `groundingCauseOf` call. The two AGREED, and the file's docblock told the next
// reader that "there is no second derivation to drift" — which was aspiration, not a
// property of the code. The predicate MOVED here; these cases pin the rule AND, more
// importantly, the AGREEMENT, so a future divergence is a red rather than a review
// finding. One assertion of agreement is worth more than two parallel copies of the
// same expectations.

/** The server's list, mirrored as a FIXTURE only — no client module owns it. */
const KB_TOOL_FIXTURE: readonly string[] = [
  "search_documents",
  "query_documents",
  "read_document",
]

/** Marks a config with NO `available_tools` KEY AT ALL — distinct from one holding
 *  `undefined`, and one of the shapes the loose JSONB column genuinely admits. */
const NO_TOOLS_KEY = Symbol("available_tools absent")

/**
 * A tool-carrying phase, built WITHOUT the shared `phase()` helper above.
 *
 * That helper types its `config` parameter as `PhaseConfigJSON & Record<string, unknown>`,
 * so every literal must spell `phase_type` and every VALUE must be well-typed — which is
 * exactly what these cases must be able to violate. The definition column is JSONB and
 * hand-editable: `available_tools` reaches the client as any JSON value, or not at all,
 * and a fixture that could not express those shapes would be testing the type system
 * rather than the resolver.
 */
function toolPhase(
  slug: string,
  tools: unknown,
  over: {
    phase_type?: string
    citation_policy?: string
    grounding_escalated?: boolean
  } = {},
): PhaseSpecJSON {
  const config: Record<string, unknown> = { phase_type: over.phase_type ?? "llm_agent" }
  if (tools !== NO_TOOLS_KEY) config.available_tools = tools
  if (over.citation_policy !== undefined) config.citation_policy = over.citation_policy
  return {
    slug,
    phase_index: 0,
    config: config as PhaseSpecJSON["config"],
    grounding_escalated: over.grounding_escalated,
  }
}

describe("phaseVocabulary.intersectingKbToolOf — the tool the step reaches for (WR-14)", () => {
  it("names the FIRST intersecting tool in the STEP's own order, not the list's", () => {
    // Both are KB tools, so a resolver that scanned `kbTools` and returned ITS first
    // member would say "search_documents" for both. The author sees THIS order in the
    // panel, so the surface names what they would name.
    expect(
      intersectingKbToolOf(
        toolPhase("a", ["read_document", "search_documents"]),
        KB_TOOL_FIXTURE,
      ),
    ).toBe("read_document")
    // …and reversing the STEP's list reverses the answer while `kbTools` stays fixed,
    // which is what isolates WHICH of the two lists decides.
    expect(
      intersectingKbToolOf(
        toolPhase("b", ["search_documents", "read_document"]),
        KB_TOOL_FIXTURE,
      ),
    ).toBe("search_documents")
  })

  it("skips a NON-KB tool listed FIRST — it names the intersection, never the head", () => {
    // The case that catches a resolver returning `available_tools[0]`.
    expect(
      intersectingKbToolOf(toolPhase("c", ["execute_code", "query_documents"]), KB_TOOL_FIXTURE),
    ).toBe("query_documents")
  })

  it("a MISS returns null — the caller falls through, it never guesses", () => {
    expect(intersectingKbToolOf(toolPhase("d", ["execute_code"]), KB_TOOL_FIXTURE)).toBeNull()
    // An unread palette marks NOTHING — the same direction `groundingCause` takes, for
    // the same reason: an empty server list must not invent a grounded step.
    expect(intersectingKbToolOf(toolPhase("e", ["search_documents"]), [])).toBeNull()
  })

  it("TOTALITY over the loose definition JSONB — no malformed shape throws", () => {
    // Every shape below is admitted by the JSONB column and reachable by hand-editing.
    const malformed: unknown[] = [
      NO_TOOLS_KEY,
      undefined,
      null,
      "search_documents",
      42,
      {},
      { search_documents: true },
      [null, undefined, 7, {}, ["search_documents"]],
    ]
    for (const tools of malformed) {
      const p = toolPhase("m", tools)
      expect(() => intersectingKbToolOf(p, KB_TOOL_FIXTURE)).not.toThrow()
      expect(intersectingKbToolOf(p, KB_TOOL_FIXTURE)).toBeNull()
    }
    // …and a well-formed member SURVIVING among malformed ones is still found, so the
    // nulls above are about those shapes and not about the guard swallowing everything.
    expect(
      intersectingKbToolOf(toolPhase("n", [null, 7, {}, "read_document"]), KB_TOOL_FIXTURE),
    ).toBe("read_document")
  })

  it("AGREES WITH THE CLASSIFIER, over a table — the property, not two copies of it", () => {
    // THE assertion this whole move exists to make. `groundingCause`'s detected branch
    // and this resolver read one `firstKbTool` body, so the biconditional below holds by
    // construction rather than by coincidence — and a second copy re-introduced in
    // either place turns this red.
    //
    // Stated exactly: a step is `detected` IF AND ONLY IF it carries a dial AND the
    // resolver names a tool. The DIAL GATE is the classifier's alone (D-185-15) — the
    // membership rule knows nothing about phase types — so the two halves are not the
    // same statement, and the type gate is asserted rather than assumed.
    const table: PhaseSpecJSON[] = [
      toolPhase("a", ["search_documents"]),
      toolPhase("b", ["execute_code", "read_document"]),
      toolPhase("c", ["execute_code"]),
      toolPhase("d", []),
      toolPhase("e", NO_TOOLS_KEY),
      toolPhase("f", "search_documents"),
      toolPhase("g", [null, "query_documents"]),
      toolPhase("h", ["read_document"], { phase_type: "llm_batch_agents" }),
      // NO DIAL, but it lists a KB tool: the classifier must still refuse `detected`.
      toolPhase("i", ["search_documents"], { phase_type: "llm_single" }),
      toolPhase("j", ["search_documents"], {
        phase_type: "llm_emit",
        citation_policy: "strict",
      }),
      // A dial, no tools, but the author escalated by hand — `escalated`, not `detected`.
      toolPhase("k", [], { grounding_escalated: true }),
      // A CASE-DIFFERING tool id. Under the shipped exact-equality rule it is a MISS on
      // BOTH sides, so it changes no expectation — it is in the table because it is the
      // input that makes the biconditional FALSIFIABLE. A resolver that started folding
      // case (or matching a prefix family, or reading an alias map) while the classifier
      // did not would name this tool on a dial step the classifier declined to count,
      // and the second half below turns red. Observed red in 187-24's Task-1
      // falsification: "phase l names Search_Documents but is not detected".
      toolPhase("l", ["Search_Documents"]),
    ]

    let detectedSeen = 0
    let namedWithoutDialSeen = 0
    for (const p of table) {
      const cause = groundingCauseOf(p, KB_TOOL_FIXTURE)
      const named = intersectingKbToolOf(p, KB_TOOL_FIXTURE)
      const hasDial = GROUNDING_DIAL_TYPES.includes(p.config.phase_type)
      // FORWARD: every `detected` step names a tool, so a reason can never fall back to
      // its unqualified form on a step the classifier counted BECAUSE of a tool.
      if (cause === "detected") {
        detectedSeen += 1
        expect(named, `phase ${p.slug} is detected but names no tool`).not.toBeNull()
      }
      // REVERSE: a dial step that names a tool is ALWAYS detected — so the resolver can
      // never name a tool the classifier declined to count.
      if (hasDial && named !== null) {
        expect(cause, `phase ${p.slug} names ${named} but is not detected`).toBe("detected")
      }
      // …while a NON-dial step may name a tool and still not be detected: that gate
      // belongs to the classifier alone, and `seedReceiptStepReason` reads the tool only
      // on its `detected` arm, so no surface can print it.
      if (!hasDial && named !== null) {
        namedWithoutDialSeen += 1
        expect(cause).not.toBe("detected")
      }
    }
    // NON-VACUITY. A table that produced no `detected` step, or no dial-less tool
    // holder, would make the branches above assert nothing at all.
    expect(detectedSeen).toBeGreaterThanOrEqual(4)
    expect(namedWithoutDialSeen).toBeGreaterThanOrEqual(2)
  })

  it("reads ONE membership body — the loop is not written twice in this module", () => {
    // The structural half. The rule is `firstKbTool`; a second inline `kbTools.includes`
    // loop anywhere in this file is the drift the move above closed.
    const decls = phaseVocabularySource.match(/function firstKbTool/g) ?? []
    expect(decls).toHaveLength(1)
    // `groundingCause`'s detected branch CALLS it rather than re-writing `.some(...)`.
    expect(phaseVocabularySource).toMatch(/hasDial && firstKbTool\(/)
    expect(phaseVocabularySource).not.toMatch(/availableTools\.some\(/)
    // …and exactly two call sites read it: the classifier and the phase-shaped resolver.
    const calls = phaseVocabularySource.match(/firstKbTool\(/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
    // POSITIVE CONTROL — the pattern that must be absent above really does match the
    // shape it forbids, so its absence is a measurement and not a tautology.
    expect("inputs.availableTools.some((tool) => inputs.kbTools.includes(tool))").toMatch(
      /availableTools\.some\(/,
    )
  })
})

describe("phaseVocabulary.derivedFace — external actions and MCP tools (Phase 209 D-209-01)", () => {
  it("formats MCP step as `<ConnectionName> · <tool_name>` when connection is bound", () => {
    expect(
      derivedFace({
        phaseType: "external_action",
        toolName: "read_wiki_structure",
        connectionName: "DeepWiki",
      }),
    ).toBe("DeepWiki · read_wiki_structure")
  })

  it("formats MCP step as `<tool_name>` when connection is unbound", () => {
    expect(
      derivedFace({
        phaseType: "external_action",
        toolName: "read_wiki_structure",
      }),
    ).toBe("read_wiki_structure")
  })

  it("formats capability step with connection destination", () => {
    expect(
      derivedFace({
        phaseType: "external_action",
        capability: "post_message",
        connectionName: "Slack",
      }),
    ).toBe("Posts a message to Slack")
    expect(
      derivedFace({
        phaseType: "external_action",
        capability: "create_ticket",
        connectionName: "Jira",
      }),
    ).toBe("Creates a ticket in Jira")
    expect(
      derivedFace({
        phaseType: "external_action",
        capability: "send_email",
        connectionName: "Fastmail",
      }),
    ).toBe("Sends an email via Fastmail")
  })

  it("formats capability step without destination when connectionName is absent", () => {
    expect(
      derivedFace({
        phaseType: "external_action",
        capability: "post_message",
      }),
    ).toBe("Posts a message")
  })

  it("derivedFaceOf resolves tool_name and connectionNames from NameContext", () => {
    const mcpPhase: PhaseSpecJSON = {
      slug: "fetch-structure",
      phase_index: 1,
      config: {
        phase_type: "external_action",
        tool_name: "read_wiki_structure",
        connection_id: "conn-dw",
      },
    }
    const nameCtx: NameContext = {
      connectionNames: {
        "conn-dw": "DeepWiki",
      },
    }
    expect(derivedFaceOf(mcpPhase, nameCtx)).toBe("DeepWiki · read_wiki_structure")
    expect(nodeTitle(mcpPhase, nameCtx)).toBe("DeepWiki · read_wiki_structure")
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
