/**
 * Phase 184 Wave 0 (CANVAS-02, R1, D-184-05) — the definitionOps proofs.
 *
 * R1's bar in one sentence: after any add / insert / reorder / delete, `phase_index`
 * is exactly `[0..n-1]` in render order, with no duplicate and no hole. That is
 * asserted here over the WHOLE shipped fixture corpus via `describe.each`, in the
 * `canvasModel.fixtures.test.ts:52-63` sweep shape, so a fixture added to the corpus is
 * swept automatically and cannot be silently skipped.
 *
 * The contiguity walk is backed by a PLANTED-GAP POSITIVE CONTROL in the
 * `canvasModel.purity.test.ts:69-72` style — an assertion that has never been seen to
 * fail is not evidence. The control builds the shipped `indexGap` shape (`[0, 1, 3]`)
 * inline and proves the walk FINDS the hole before `renumber` and does not after.
 *
 * No canvas, no store, no React, no network — that is the whole point of D-184-05.
 */
import { describe, it, expect, beforeAll, afterAll, vi, type MockInstance } from "vitest"

import definitionOpsSource from "./definitionOps?raw"
import {
  addPhase,
  allowedTypesAt,
  canRemovePhase,
  insertPhaseAt,
  minimalPhaseFor,
  movePhase,
  patchPhaseConfig,
  PHASE_TYPE_ORDER,
  removePhase,
  renumber,
  resolveDrop,
  setPhaseGovernance,
  slugForType,
  STRANDING_REASON,
  ACTION_RISK_ARM_LABEL,
  ACTION_RISK_ARMED_NOTE,
  GOVERNANCE_GATE_ROW_LABEL,
  GOVERNANCE_SEAL_LABEL,
  GROUNDING_ALREADY_SET_NOTE,
  GROUNDING_ATTACHED_GATE,
  GROUNDING_DIAL_LOOSE_LABEL,
  GROUNDING_DIAL_STRICT_LABEL,
  GROUNDING_LOCK_REFUSAL,
  GROUNDING_NOTHING_TO_PROVE,
  GROUNDING_TOOL_LIST_IS_THE_CONTROL,
  GROUNDING_WHY_DETECTED,
  GROUNDING_WHY_ESCALATED,
  IDENTITY_BEARING_CONFIG_KEYS,
  seedReceiptHeading,
  seedReceiptGroundingLead,
  seedReceiptCarriedLead,
  seedReceiptStepReason,
  SEED_RECEIPT_ONE_WAY_RULE,
  SEED_RECEIPT_NOTHING_COMMITTED,
  SEED_RECEIPT_DISMISS_LABEL,
  SEED_RECEIPT_DISMISS_GLYPH,
  starterSeedSentence,
  STARTER_DOOR_LINE,
  STARTER_DOOR_HEADING,
  STARTER_DOOR_NOTE,
  STARTER_DOOR_LOADING,
  STARTER_DOOR_UNAVAILABLE,
  STARTER_DOOR_EMPTY,
  type PhaseTypeId,
} from "./definitionOps"
import { ALL_FIXTURES } from "./__fixtures__/canvasFixtures"
import type { PublishedWorkflow } from "@/lib/api"
import { nodeTitle, type NameContext, type PhaseSpecJSON } from "./phaseVocabulary"

/**
 * The whole-suite network tripwire. R10 forbids either refusal from consulting the
 * server, so the spy is installed for the ENTIRE file and the final test asserts it
 * recorded exactly zero calls. It is a belt to the `?raw` source grep's braces: the
 * grep proves the module cannot name the seam, the spy proves nothing it calls does.
 */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

/** A JSON deep clone — every fixture is JSON-safe by construction. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/**
 * The throwing named-fixture accessor (`canvasModel.fixtures.test.ts:91-95`). It
 * THROWS rather than silently skipping, so a renamed fixture is a red test and not a
 * quietly-vanished assertion.
 */
const fixture = (name: string): PhaseSpecJSON[] => {
  const found = ALL_FIXTURES.find((f) => f.name.startsWith(name))
  if (!found) throw new Error(`fixture ${name} missing from ALL_FIXTURES`)
  return found.phases
}

/**
 * The R1 contiguity walk, expressed so it can NAME what is wrong rather than return a
 * bare boolean: sort the `phase_index` values and report every position whose value is
 * not its own 0-based ordinal. `[]` means exactly `[0..n-1]` — no hole, no duplicate.
 */
const contiguityGaps = (phases: readonly PhaseSpecJSON[]): number[] => {
  const sorted = phases.map((p) => p.phase_index).sort((a, b) => a - b)
  return sorted.filter((value, position) => value !== position)
}

/** The render-order index sequence of a result array, read as the ops emit it. */
const indicesOf = (phases: readonly PhaseSpecJSON[]): number[] =>
  phases.map((p) => p.phase_index)

/** A minimal net-new step. Its `phase_index` is deliberately absurd — the ops must
 *  derive position from the CALLER's argument, never from the incoming value. */
const newStep = (slug = "__new_step__"): PhaseSpecJSON => ({
  slug,
  phase_index: 999,
  config: { phase_type: "llm_single", prompt: "" },
})

// ── The R1 sweep over the whole shipped corpus ─────────────────────────────────

describe.each(ALL_FIXTURES)("definitionOps R1 sweep — $name", ({ phases }) => {
  const n = phases.length

  it("renumber yields exactly [0..n-1]", () => {
    const out = renumber(phases)
    expect(out).toHaveLength(n)
    expect(indicesOf(out)).toEqual(phases.map((_, i) => i))
    expect(contiguityGaps(out)).toEqual([])
  })

  it("addPhase yields exactly [0..n] and grows the array by one", () => {
    const out = addPhase(phases, newStep())
    expect(out).toHaveLength(n + 1)
    expect(indicesOf(out)).toEqual(out.map((_, i) => i))
    expect(contiguityGaps(out)).toEqual([])
    expect(out[out.length - 1].slug).toBe("__new_step__")
  })

  it("insertPhaseAt (mid-point) yields exactly [0..n] and grows the array by one", () => {
    const at = Math.floor(n / 2)
    const out = insertPhaseAt(phases, at, newStep())
    expect(out).toHaveLength(n + 1)
    expect(indicesOf(out)).toEqual(out.map((_, i) => i))
    expect(contiguityGaps(out)).toEqual([])
    expect(out[at].slug).toBe("__new_step__")
    expect(out[at].phase_index).toBe(at)
  })

  it("movePhase (first step to the end) yields exactly [0..n-1]", () => {
    if (n === 0) {
      expect(movePhase(phases, "__absent__", 0)).toEqual([])
      return
    }
    const first = renumber(phases)[0].slug
    const out = movePhase(phases, first, n - 1)
    expect(out).toHaveLength(n)
    expect(indicesOf(out)).toEqual(out.map((_, i) => i))
    expect(contiguityGaps(out)).toEqual([])
    expect(out[n - 1].slug).toBe(first)
  })

  it("removePhase (first step) yields exactly [0..n-2] and shrinks by one", () => {
    if (n === 0) {
      expect(removePhase(phases, "__absent__")).toEqual([])
      return
    }
    const first = renumber(phases)[0].slug
    const out = removePhase(phases, first)
    expect(out).toHaveLength(n - 1)
    expect(indicesOf(out)).toEqual(out.map((_, i) => i))
    expect(contiguityGaps(out)).toEqual([])
    expect(out.some((p) => p.slug === first)).toBe(false)
  })

  it("patchPhaseConfig leaves every phase_index untouched", () => {
    if (n === 0) {
      expect(patchPhaseConfig(phases, "__absent__", { prompt: "x" })).toEqual([])
      return
    }
    const target = phases[0].slug
    const out = patchPhaseConfig(phases, target, { prompt: "a new prompt" })
    expect(indicesOf(out)).toEqual(indicesOf(phases))
    expect(out).toHaveLength(n)
  })

  it("no op mutates the input array or any of its member objects", () => {
    const before = clone(phases)
    renumber(phases)
    addPhase(phases, newStep())
    insertPhaseAt(phases, 1, newStep("__another__"))
    movePhase(phases, phases[0]?.slug ?? "__absent__", 0)
    removePhase(phases, phases[0]?.slug ?? "__absent__")
    patchPhaseConfig(phases, phases[0]?.slug ?? "__absent__", { prompt: "mutated?" })
    expect(phases).toStrictEqual(before)
  })
})

// ── The positive control: prove the contiguity walk can FAIL ───────────────────

describe("definitionOps — the contiguity walk is a real control", () => {
  /** The shipped `indexGap` shape (`canvasFixtures.ts:265-269`), hand-authored inline
   *  per D-184-17: the fixture module carries an acceptance guard and new corpus data
   *  belongs in a separate artifact, so nothing is added to it here. */
  const plantedGap: PhaseSpecJSON[] = [
    { slug: "first", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "second", phase_index: 1, config: { phase_type: "llm_single" } },
    { slug: "stranded", phase_index: 3, config: { phase_type: "llm_single" } },
  ]

  it("FINDS the planted [0,1,3] hole before renumber", () => {
    expect(contiguityGaps(plantedGap)).toContain(3)
    expect(contiguityGaps(plantedGap)).not.toEqual([])
  })

  it("finds nothing after renumber — the hole is repaired to [0,1,2]", () => {
    const repaired = renumber(plantedGap)
    expect(indicesOf(repaired)).toEqual([0, 1, 2])
    expect(contiguityGaps(repaired)).toEqual([])
    // Render order survives the repair — the gap moved, the sequence did not.
    expect(repaired.map((p) => p.slug)).toEqual(["first", "second", "stranded"])
  })

  it("FINDS a planted duplicate phase_index too", () => {
    const duplicated: PhaseSpecJSON[] = [
      { slug: "a", phase_index: 0, config: { phase_type: "llm_single" } },
      { slug: "b", phase_index: 1, config: { phase_type: "llm_single" } },
      { slug: "c", phase_index: 1, config: { phase_type: "llm_single" } },
    ]
    expect(contiguityGaps(duplicated)).not.toEqual([])
    expect(contiguityGaps(renumber(duplicated))).toEqual([])
  })
})

// ── R1's named case: insert into the 5-phase maximum ──────────────────────────

describe("definitionOps — R1's named case (insert at 2 into eval_coverage)", () => {
  it("increments EVERY downstream phase_index by exactly 1, index by index", () => {
    const before = fixture("eval_coverage")
    expect(before).toHaveLength(5)
    expect(indicesOf(before)).toEqual([0, 1, 2, 3, 4])

    const after = insertPhaseAt(before, 2, newStep("inserted"))

    expect(after).toHaveLength(6)
    expect(after.map((p) => p.slug)).toEqual([
      "split",
      "fanout",
      "inserted",
      "deep_dive",
      "confirm",
      "summarize",
    ])
    // Upstream of the insertion point: unchanged.
    expect(after[0].phase_index).toBe(0)
    expect(after[1].phase_index).toBe(1)
    // The insertion itself.
    expect(after[2].phase_index).toBe(2)
    // Downstream: each shifted by exactly +1 from its pre-insert value.
    expect(after[3].phase_index).toBe(3)
    expect(after[4].phase_index).toBe(4)
    expect(after[5].phase_index).toBe(5)
    for (const original of before) {
      const moved = after.find((p) => p.slug === original.slug)
      expect(moved).toBeDefined()
      const expected = original.phase_index >= 2 ? original.phase_index + 1 : original.phase_index
      expect(moved?.phase_index).toBe(expected)
    }
  })

  it("ignores the incoming spec.phase_index — the caller's index is the intent", () => {
    const after = insertPhaseAt(fixture("eval_coverage"), 1, newStep("inserted"))
    // newStep() carries phase_index 999; it must land at 1, not at the end.
    expect(after[1].slug).toBe("inserted")
    expect(after[1].phase_index).toBe(1)
    expect(indicesOf(after)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it("clamps an out-of-range insertion position instead of throwing", () => {
    const head = insertPhaseAt(fixture("eval_coverage"), -40, newStep("head"))
    expect(head[0].slug).toBe("head")
    expect(indicesOf(head)).toEqual([0, 1, 2, 3, 4, 5])

    const tail = insertPhaseAt(fixture("eval_coverage"), 40, newStep("tail"))
    expect(tail[5].slug).toBe("tail")
    expect(indicesOf(tail)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

// ── movePhase / removePhase, targeted ─────────────────────────────────────────

describe("definitionOps — movePhase and removePhase, targeted", () => {
  it("moves a middle step backwards and renumbers the whole spine", () => {
    const out = movePhase(fixture("eval_coverage"), "confirm", 1)
    expect(out.map((p) => p.slug)).toEqual([
      "split",
      "confirm",
      "fanout",
      "deep_dive",
      "summarize",
    ])
    expect(indicesOf(out)).toEqual([0, 1, 2, 3, 4])
  })

  it("moves a middle step forwards and renumbers the whole spine", () => {
    const out = movePhase(fixture("eval_coverage"), "fanout", 3)
    expect(out.map((p) => p.slug)).toEqual([
      "split",
      "deep_dive",
      "confirm",
      "fanout",
      "summarize",
    ])
    expect(indicesOf(out)).toEqual([0, 1, 2, 3, 4])
  })

  it("clamps an out-of-range move target instead of throwing", () => {
    const out = movePhase(fixture("eval_coverage"), "split", 99)
    expect(out[4].slug).toBe("split")
    expect(indicesOf(out)).toEqual([0, 1, 2, 3, 4])
  })

  it("re-stitches the spine after a middle delete", () => {
    const out = removePhase(fixture("eval_coverage"), "deep_dive")
    expect(out.map((p) => p.slug)).toEqual(["split", "fanout", "confirm", "summarize"])
    expect(indicesOf(out)).toEqual([0, 1, 2, 3])
  })

  it("repairs a pre-existing index gap on the way through", () => {
    const gapped = fixture("non-contiguous")
    expect(indicesOf(gapped)).toEqual([0, 1, 3])
    const out = removePhase(gapped, "second")
    expect(out.map((p) => p.slug)).toEqual(["first", "stranded"])
    expect(indicesOf(out)).toEqual([0, 1])
  })
})

// ── patchPhaseConfig — the merge lifted from WorkflowBuilderPage.tsx:334-345 ───

describe("definitionOps — patchPhaseConfig preserves everything it is not asked to change", () => {
  const shaped: PhaseSpecJSON[] = [
    {
      slug: "emit",
      phase_index: 0,
      name: "Produce the report",
      config: {
        phase_type: "llm_emit",
        prompt: "write it",
        emitter: "render_template",
        citation_policy: "strict",
      },
      validators: [{ kind: "citations_required", on_failure: "fail_run" }],
    },
    { slug: "after", phase_index: 1, config: { phase_type: "llm_single", prompt: "x" } },
  ]

  it("merges the patch and keeps every non-patched config key", () => {
    const out = patchPhaseConfig(shaped, "emit", { citation_policy: "draft" })
    expect(out[0].config).toEqual({
      phase_type: "llm_emit",
      prompt: "write it",
      emitter: "render_template",
      citation_policy: "draft",
    })
  })

  it("keeps every non-config phase key (name, validators, phase_index, slug)", () => {
    const out = patchPhaseConfig(shaped, "emit", { citation_policy: "draft" })
    expect(out[0].slug).toBe("emit")
    expect(out[0].phase_index).toBe(0)
    expect(out[0].name).toBe("Produce the report")
    expect(out[0].validators).toStrictEqual([
      { kind: "citations_required", on_failure: "fail_run" },
    ])
  })

  it("touches no other phase", () => {
    const out = patchPhaseConfig(shaped, "emit", { citation_policy: "draft" })
    expect(out[1]).toBe(shaped[1])
  })

  it("does not mutate the input", () => {
    const before = clone(shaped)
    patchPhaseConfig(shaped, "emit", { citation_policy: "draft" })
    expect(shaped).toStrictEqual(before)
  })
})

// ── Phase 187 (D-187-07) — the demote-on-identity-edit rule ───────────────────
//
// A stored name has no invalidation story of its own. Re-bind a step's skill and a
// GENERATOR-written name still promises the old behaviour — the face lies. Clearing
// the seeded name (and its provenance marker) lets the face fall back to the derived
// tier, which tracks the config for free. A HAND-TYPED name is the author's writing
// and is never cleared by any config edit (SPEC Req 3) — that asymmetry is the whole
// reason the marker exists.

describe("definitionOps — patchPhaseConfig demotes a SEEDED name (D-187-07)", () => {
  const SKILL_A = "11111111-1111-4111-8111-111111111111"
  const SKILL_B = "22222222-2222-4222-8222-222222222222"
  const FOLDER_A = "33333333-3333-4333-8333-333333333333"

  /** The injected name lookups the derived tier reads (D-187-05). */
  const ctx: NameContext = {
    skillNames: { [SKILL_A]: "supplier check", [SKILL_B]: "pricing policy check" },
    folderNames: { [FOLDER_A]: "Supplier Contracts" },
  }

  /** One seeded step plus an innocent bystander. */
  const seeded = (): PhaseSpecJSON[] => [
    {
      slug: "search",
      phase_index: 0,
      name: "Check supplier pricing",
      name_seeded_by_ai: true,
      config: {
        phase_type: "llm_agent",
        prompt: "look it up",
        available_tools: ["search_documents"],
        skill_ref: SKILL_A,
      },
      validators: [{ kind: "citations_required", on_failure: "fail_run" }],
    },
    { slug: "after", phase_index: 1, config: { phase_type: "llm_single", prompt: "x" } },
  ]

  /** The same step, but the name is the AUTHOR's — the marker is simply absent. */
  const handTyped = (): PhaseSpecJSON[] => {
    const phases = seeded()
    const author = { ...phases[0] }
    delete author.name_seeded_by_ai
    return [author, phases[1]]
  }

  it("re-binding skill_ref clears BOTH the seeded name and its provenance marker", () => {
    const out = patchPhaseConfig(seeded(), "search", { skill_ref: SKILL_B })
    expect(out[0].name).toBeUndefined()
    expect(out[0].name_seeded_by_ai).toBeUndefined()
    // No spurious key survives with an `undefined` value either.
    expect("name" in out[0]).toBe(false)
    expect("name_seeded_by_ai" in out[0]).toBe(false)
  })

  it("the FACE then falls to the derived tier and tracks the new binding", () => {
    const before = seeded()
    expect(nodeTitle(before[0], ctx)).toBe("Check supplier pricing")
    const out = patchPhaseConfig(before, "search", { skill_ref: SKILL_B })
    // The user-visible consequence, not a field read: the face now says what the
    // step actually does after the re-bind.
    expect(nodeTitle(out[0], ctx)).toBe("Run the pricing policy check")
  })

  it("a HAND-TYPED name survives every identity-bearing patch (SPEC Req 3, T-187-10-01)", () => {
    for (const patch of [
      { skill_ref: SKILL_B },
      { folder_scope: [FOLDER_A] },
      { available_tools: ["search_documents", "list_documents"] },
    ]) {
      const out = patchPhaseConfig(handTyped(), "search", patch)
      expect(out[0].name).toBe("Check supplier pricing")
      expect(nodeTitle(out[0], ctx)).toBe("Check supplier pricing")
    }
  })

  it("a hand-typed name with an explicit `name_seeded_by_ai: false` also survives", () => {
    const explicit = seeded().map((p, i) =>
      i === 0 ? { ...p, name_seeded_by_ai: false } : p,
    )
    const out = patchPhaseConfig(explicit, "search", { skill_ref: SKILL_B })
    expect(out[0].name).toBe("Check supplier pricing")
    expect(out[0].name_seeded_by_ai).toBe(false)
  })

  it("folder_scope and available_tools demote a seeded name too", () => {
    for (const patch of [
      { folder_scope: [FOLDER_A] },
      { available_tools: ["search_documents"] },
    ]) {
      const out = patchPhaseConfig(seeded(), "search", patch)
      expect(out[0].name).toBeUndefined()
      expect(out[0].name_seeded_by_ai).toBeUndefined()
    }
  })

  it("prompt / model / max_steps / wall_clock_seconds / temperature do NOT demote", () => {
    for (const patch of [
      { prompt: "a completely different instruction" },
      { model: "gpt-5" },
      { max_steps: 12 },
      { wall_clock_seconds: 90 },
      { temperature: 0.2 },
    ]) {
      const out = patchPhaseConfig(seeded(), "search", patch)
      expect(out[0].name).toBe("Check supplier pricing")
      expect(out[0].name_seeded_by_ai).toBe(true)
      expect(nodeTitle(out[0], ctx)).toBe("Check supplier pricing")
    }
  })

  it("a multi-key patch demotes when ANY key is identity-bearing", () => {
    const out = patchPhaseConfig(seeded(), "search", {
      prompt: "still fine",
      temperature: 0.1,
      skill_ref: SKILL_B,
    })
    expect(out[0].name).toBeUndefined()
    // The rest of the patch still landed — the demote is not a short-circuit.
    expect(out[0].config.prompt).toBe("still fine")
    expect(out[0].config.temperature).toBe(0.1)
  })

  it("a multi-key patch with NO identity-bearing key leaves the name alone", () => {
    const out = patchPhaseConfig(seeded(), "search", { prompt: "p", temperature: 0.1 })
    expect(out[0].name).toBe("Check supplier pricing")
    expect(out[0].name_seeded_by_ai).toBe(true)
  })

  it("demoting one phase never touches another — the carry-through invariant", () => {
    const before = seeded()
    const out = patchPhaseConfig(before, "search", { skill_ref: SKILL_B })
    expect(out[1]).toBe(before[1])
    expect(out).toHaveLength(2)
    expect(indicesOf(out)).toEqual([0, 1])
  })

  it("the demote writes NOTHING beyond `config`, `name` and the marker", () => {
    const before = seeded()
    const out = patchPhaseConfig(before, "search", { skill_ref: SKILL_B })
    expect(out[0].slug).toBe("search")
    expect(out[0].phase_index).toBe(0)
    expect(out[0].validators).toStrictEqual(before[0].validators)
    // Every remaining key is untouched; only these three could have changed.
    expect(Object.keys(out[0]).sort()).toEqual(["config", "phase_index", "slug", "validators"])
  })

  it("never mutates the input array or any of its member objects", () => {
    const before = seeded()
    const snapshot = clone(before)
    patchPhaseConfig(before, "search", { skill_ref: SKILL_B })
    patchPhaseConfig(before, "search", { folder_scope: [FOLDER_A] })
    expect(before).toStrictEqual(snapshot)
    expect(before[0].name).toBe("Check supplier pricing")
    expect(before[0].name_seeded_by_ai).toBe(true)
  })

  it("a phase with NO name is unaffected — nothing cleared, no spurious key written", () => {
    const unnamed: PhaseSpecJSON[] = [
      { slug: "search", phase_index: 0, config: { phase_type: "llm_agent", prompt: "" } },
    ]
    const out = patchPhaseConfig(unnamed, "search", { skill_ref: SKILL_B })
    expect(Object.keys(out[0]).sort()).toEqual(["config", "phase_index", "slug"])
    expect("name" in out[0]).toBe(false)
    expect("name_seeded_by_ai" in out[0]).toBe(false)
  })

  it("an unknown slug still hands every phase back toBe-identical", () => {
    const before = seeded()
    const out = patchPhaseConfig(before, "no-such-step", { skill_ref: SKILL_B })
    out.forEach((phase, i) => expect(phase).toBe(before[i]))
  })

  it("IDENTITY_BEARING_CONFIG_KEYS is the ONE source of truth, and it is what fires", () => {
    // Named members (the template arm is definition-level and has no config key today).
    expect([...IDENTITY_BEARING_CONFIG_KEYS].sort()).toEqual([
      "available_tools",
      "folder_scope",
      "skill_ref",
    ])
    // Every member demotes; nothing outside it does. This is the property, not a list.
    for (const key of IDENTITY_BEARING_CONFIG_KEYS) {
      expect(patchPhaseConfig(seeded(), "search", { [key]: null })[0].name).toBeUndefined()
    }
    for (const key of ["prompt", "model", "max_steps", "wall_clock_seconds", "temperature"]) {
      expect(IDENTITY_BEARING_CONFIG_KEYS.has(key)).toBe(false)
      expect(patchPhaseConfig(seeded(), "search", { [key]: null })[0].name).toBe(
        "Check supplier pricing",
      )
    }
  })
})

// ── Phase 185 — setPhaseGovernance writes at the PhaseSpec level, never into config ──

describe("definitionOps — setPhaseGovernance (D-185-10)", () => {
  const governed: PhaseSpecJSON[] = [
    {
      slug: "search",
      phase_index: 0,
      name: "Find the risks",
      config: {
        phase_type: "llm_agent",
        prompt: "find them",
        available_tools: ["search_documents"],
      },
      validators: [{ kind: "citations_required", on_failure: "fail_run" }],
    },
    { slug: "send", phase_index: 1, config: { phase_type: "programmatic", fn: "send_email" } },
    { slug: "deliver", phase_index: 2, config: { phase_type: "llm_emit", prompt: "write it" } },
  ]

  it("sets the named field on the named slug only", () => {
    const out = setPhaseGovernance(governed, "send", { action_risk_armed: true })
    expect(out[1].action_risk_armed).toBe(true)
    expect(out[0].action_risk_armed).toBeUndefined()
    expect(out[2].action_risk_armed).toBeUndefined()
  })

  it("leaves every OTHER phase toBe-identical — the carry-through invariant", () => {
    const out = setPhaseGovernance(governed, "send", { action_risk_armed: true })
    expect(out[0]).toBe(governed[0])
    expect(out[2]).toBe(governed[2])
    // The target is a NEW object — the op is immutable, not a mutation in disguise.
    expect(out[1]).not.toBe(governed[1])
  })

  it("NEVER writes into config — the whole reason this op exists", () => {
    const out = setPhaseGovernance(governed, "search", { grounding_escalated: true })
    // Reference identity on the config object is the strongest possible proof that the
    // spread landed at PhaseSpec level and not one layer down.
    expect(out[0].config).toBe(governed[0].config)
    expect(out[0].grounding_escalated).toBe(true)
    expect("grounding_escalated" in out[0].config).toBe(false)
  })

  it("keeps the array length and every phase_index unchanged (no renumber, no reorder)", () => {
    const out = setPhaseGovernance(governed, "deliver", { action_risk_armed: true })
    expect(out).toHaveLength(governed.length)
    expect(indicesOf(out)).toEqual(indicesOf(governed))
    expect(out.map((p) => p.slug)).toEqual(governed.map((p) => p.slug))
  })

  it("keeps every other PhaseSpec key on the target (name, validators, slug, index)", () => {
    const out = setPhaseGovernance(governed, "search", { grounding_escalated: true })
    expect(out[0].slug).toBe("search")
    expect(out[0].phase_index).toBe(0)
    expect(out[0].name).toBe("Find the risks")
    expect(out[0].validators).toBe(governed[0].validators)
  })

  it("writes both booleans in one patch", () => {
    const out = setPhaseGovernance(governed, "search", {
      grounding_escalated: true,
      action_risk_armed: true,
    })
    expect(out[0].grounding_escalated).toBe(true)
    expect(out[0].action_risk_armed).toBe(true)
  })

  it("an unknown slug is a no-op — every member comes back toBe-identical", () => {
    const out = setPhaseGovernance(governed, "no-such-step", { action_risk_armed: true })
    expect(out).toHaveLength(governed.length)
    out.forEach((phase, i) => expect(phase).toBe(governed[i]))
  })

  it("un-setting is expressible — false is a real value, not an absence", () => {
    const armed = setPhaseGovernance(governed, "send", { action_risk_armed: true })
    const disarmed = setPhaseGovernance(armed, "send", { action_risk_armed: false })
    expect(disarmed[1].action_risk_armed).toBe(false)
  })

  it("does not mutate the input", () => {
    const before = clone(governed)
    setPhaseGovernance(governed, "send", { action_risk_armed: true })
    expect(governed).toStrictEqual(before)
  })

  it("survives an empty phases array and never throws (TOTALITY)", () => {
    expect(setPhaseGovernance([], "nope", { action_risk_armed: true })).toEqual([])
    expect(() => setPhaseGovernance(governed, "send", {})).not.toThrow()
  })
})

// ── Phase 185 — the governance vocabulary is BINDING (SPEC Req 7 / D-185-02) ──────

describe("definitionOps — the governance copy is a lock, not a suggestion", () => {
  /** Every user-visible governance sentence this phase ships. */
  const GOVERNANCE_COPY = [
    GROUNDING_DIAL_LOOSE_LABEL,
    GROUNDING_DIAL_STRICT_LABEL,
    GROUNDING_NOTHING_TO_PROVE,
    GROUNDING_WHY_DETECTED,
    GROUNDING_WHY_ESCALATED,
    GROUNDING_ALREADY_SET_NOTE,
    GROUNDING_TOOL_LIST_IS_THE_CONTROL,
    GROUNDING_ATTACHED_GATE,
    GROUNDING_LOCK_REFUSAL,
    GOVERNANCE_GATE_ROW_LABEL,
    ACTION_RISK_ARM_LABEL,
    ACTION_RISK_ARMED_NOTE,
  ]

  it("ships all twelve sentences, each non-empty", () => {
    expect(GOVERNANCE_COPY).toHaveLength(12)
    for (const sentence of GOVERNANCE_COPY) expect(sentence.length).toBeGreaterThan(0)
  })

  it("carries the three REQUIRED phrases of Req 7's binding vocabulary", () => {
    expect(GROUNDING_DIAL_STRICT_LABEL).toContain("Must prove it")
    expect(GROUNDING_DIAL_LOOSE_LABEL).toContain("Free to think")
    expect(GROUNDING_NOTHING_TO_PROVE).toBe("Nothing to prove here")
  })

  it("uses NONE of the banned readings anywhere in the copy", () => {
    // Assembled from parts so a grep of this file for the banned words does not itself
    // become the thing that fails (the D-ITEM-183-02 trap). "prove"/"proves" are fine;
    // the banned one is the past participle.
    const banned = [
      ["prov", "en"].join(""),
      ["un", "governed"].join(""),
      ["un", "checked"].join(""),
      ["not ", "applicable"].join(""),
      ["n", "/", "a"].join(""),
      // `traceable` is legitimate only at the review moment, which is Phase 188.
      ["trace", "able"].join(""),
    ]
    for (const sentence of GOVERNANCE_COPY) {
      for (const word of banned) {
        expect(sentence.toLowerCase()).not.toContain(word)
      }
    }
  })

  it("the banned-word check is a REAL control — it finds each planted term", () => {
    const banned = [
      ["prov", "en"].join(""),
      ["un", "governed"].join(""),
      ["un", "checked"].join(""),
      ["not ", "applicable"].join(""),
      ["trace", "able"].join(""),
    ]
    for (const word of banned) {
      expect(`This step is ${word}.`.toLowerCase()).toContain(word)
    }
  })

  it("D-185-02: the attached-gate sentence does not borrow the deliverable path's claim", () => {
    // The emit-path wording is computable only over a structured leaf set. Its two
    // signature phrases are assembled from parts here so this guard reads the CONSTANT,
    // never a literal somebody could satisfy by editing a docblock.
    const emitPathClaims = [
      ["every value ", "trace", "able"].join(""),
      ["everything it says is ", "checked"].join(""),
    ]
    for (const claim of emitPathClaims) {
      expect(GROUNDING_ATTACHED_GATE.toLowerCase()).not.toContain(claim)
    }
    // What it DOES claim: retrieved, and pointed at.
    expect(GROUNDING_ATTACHED_GATE).toContain("retrieved")
    expect(GROUNDING_ATTACHED_GATE).toContain("point at what it used")
  })

  it("the refusal names what switching the tools off COSTS (lobotomy, not loophole)", () => {
    expect(GROUNDING_LOCK_REFUSAL).toContain("does not loosen the step")
    expect(GROUNDING_LOCK_REFUSAL).toContain("stops it opening your files")
  })

  it("the armed note promises a wait, never a timeout that advances on its own", () => {
    expect(ACTION_RISK_ARMED_NOTE).toContain("waits for your answer")
    expect(ACTION_RISK_ARMED_NOTE).toContain("will not continue on its own")
  })

  it("every sentence is a distinct string — no constant is an alias of another", () => {
    expect(new Set(GOVERNANCE_COPY).size).toBe(GOVERNANCE_COPY.length)
  })
})

// ── Phase 187 (VOCAB-02 / Req 5) — the seed receipt's sentences ────────────────
//
// Same lock as the governance copy above: every sentence the receipt renders is an
// exported identifier asserted CHARACTER-IDENTICALLY here, because a sentence that
// lives inside a component is a sentence nobody can test for drift (T-187-10-05).

describe("definitionOps — the seed-receipt copy is a lock (sketch 150-B)", () => {
  it("the heading names the step count, and pluralises 0 / 1 / N", () => {
    expect(seedReceiptHeading(0)).toBe("Here's what I built — 0 steps")
    expect(seedReceiptHeading(1)).toBe("Here's what I built — 1 step")
    expect(seedReceiptHeading(5)).toBe("Here's what I built — 5 steps")
  })

  it("the heading is TOTAL — a non-finite or negative count never throws", () => {
    expect(seedReceiptHeading(Number.NaN)).toBe("Here's what I built — 0 steps")
    expect(seedReceiptHeading(-3)).toBe("Here's what I built — 0 steps")
    expect(seedReceiptHeading(2.7)).toBe("Here's what I built — 2 steps")
  })

  it("the grounding lead names the count and the SHIPPED governance words", () => {
    expect(seedReceiptGroundingLead(1)).toBe(
      "1 step reads your documents, so I set it to must prove it.",
    )
    expect(seedReceiptGroundingLead(2)).toBe(
      "2 steps read your documents, so I set them to must prove it.",
    )
    // It must speak the shipped vocabulary, not a synonym of it.
    for (const count of [1, 2, 7]) {
      expect(seedReceiptGroundingLead(count)).toContain(GOVERNANCE_SEAL_LABEL.toLowerCase())
    }
  })

  it("ZERO grounded steps yields NO grounding paragraph at all (D-187-10)", () => {
    // The orientation half and the nothing-committed half are useful regardless; only
    // the grounding paragraph is conditional. An empty string is the caller's signal.
    expect(seedReceiptGroundingLead(0)).toBe("")
    expect(seedReceiptGroundingLead(Number.NaN)).toBe("")
    expect(seedReceiptGroundingLead(-1)).toBe("")
  })

  it("states the one-way rule plainly rather than letting the user discover it", () => {
    expect(SEED_RECEIPT_ONE_WAY_RULE).toBe(
      "You can't turn that off — but you can see exactly where it applies.",
    )
  })

  // ── 187-16 (review CR-01) — the carried causes get their OWN sentence ──────────
  //
  // `already-set` and `escalated` wear the same ⛨ seal on the canvas, so the receipt
  // must still name them; but this generation applied neither. The sentence below is
  // what lets both facts be true at once.

  it("the carried lead names the count and the SHIPPED governance words", () => {
    expect(seedReceiptCarriedLead(1)).toBe("1 step was already set to must prove it.")
    expect(seedReceiptCarriedLead(2)).toBe("2 steps were already set to must prove it.")
    for (const count of [1, 2, 7]) {
      expect(seedReceiptCarriedLead(count)).toContain(GOVERNANCE_SEAL_LABEL.toLowerCase())
    }
  })

  it("ZERO carried steps yields NO carried paragraph — the same shape as its sibling", () => {
    expect(seedReceiptCarriedLead(0)).toBe("")
    expect(seedReceiptCarriedLead(Number.NaN)).toBe("")
    expect(seedReceiptCarriedLead(-1)).toBe("")
    // TOTALITY, matching the shipped `wholeCount` treatment: a fractional count from
    // author-supplied JSONB resolves rather than printing "2.7 steps".
    expect(seedReceiptCarriedLead(2.7)).toBe("2 steps were already set to must prove it.")
  })

  it("the carried sentence ATTRIBUTES NO CAUSE — it counts two of them (187-20/WR-09)", () => {
    // The count sums `already-set` and `escalated`. 187-16 shipped this sentence ending
    // " by its own settings" — true of the first cause, FALSE of the second, and on an
    // escalated-only draft it contradicted that step's own reason two lines below it on
    // the same card. Needles assembled from parts, the idiom this file already uses.
    const CAUSE_CLAIMS = [
      ["by", "its", "own", "settings"].join(" "),
      ["by", "their", "own", "settings"].join(" "),
    ]
    for (const count of [1, 2, 9]) {
      const sentence = seedReceiptCarriedLead(count)
      for (const claim of CAUSE_CLAIMS) expect(sentence).not.toContain(claim)
      // Nor may it borrow either per-step reason: naming a cause is the ROW's job, and
      // `seedReceiptStepReason` is the one function that is actually handed the cause.
      expect(sentence).not.toContain(seedReceiptStepReason("escalated"))
      expect(sentence).not.toContain(seedReceiptStepReason("already-set"))
    }
  })

  it("the carried sentence CLAIMS NO AUTHORSHIP — with a positive control", () => {
    // Needles assembled from parts, the idiom this file already uses: a grep of this
    // guard must not be able to satisfy the fence it protects.
    const APPLICATION_CLAIM = ["so", "I", "set"].join(" ")
    const FIRST_PERSON = [["I", "set"].join(" "), ["I", "turned"].join(" "), ["I", "applied"].join(" ")]
    for (const count of [1, 2, 9]) {
      const sentence = seedReceiptCarriedLead(count)
      expect(sentence).not.toContain(APPLICATION_CLAIM)
      for (const needle of FIRST_PERSON) expect(sentence).not.toContain(needle)
    }
    // POSITIVE CONTROL — the DETECTED lead really does make that claim, so the fence
    // above cannot be passing by asserting the absence of a string nothing ever says.
    expect(seedReceiptGroundingLead(2)).toContain(APPLICATION_CLAIM)
    expect(seedReceiptGroundingLead(2)).toContain(FIRST_PERSON[0])
  })

  it("the carried sentence is SELF-CONTAINED — it may render first, or alone", () => {
    // On the typical non-KB draft the detected sentence is absent entirely, so a lead-in
    // antecedent would point at nothing. It must also promise no one-way lock: those
    // steps are undone by whatever set them (D-185-07 is the DETECTED lock).
    for (const count of [1, 3]) {
      const sentence = seedReceiptCarriedLead(count)
      expect(sentence).not.toMatch(/^(That|Those|The other|More|Another|Also)\b/)
      expect(sentence).not.toContain(SEED_RECEIPT_ONE_WAY_RULE)
      expect(sentence.toLowerCase()).not.toContain("turn that off")
    }
  })

  it("the per-step reason NAMES the actual intersecting tool (D-187-08)", () => {
    expect(seedReceiptStepReason("detected", "search_documents")).toBe(
      "it reads your documents (search_documents)",
    )
    expect(seedReceiptStepReason("detected", "list_documents")).toBe(
      "it reads your documents (list_documents)",
    )
  })

  it("the reason formatter CLASSIFIES nothing — it renders the cause it is handed", () => {
    expect(seedReceiptStepReason("already-set")).toBe("it already has to cite its sources")
    expect(seedReceiptStepReason("escalated")).toBe("you turned this on by hand")
    // No cause ⇒ no sentence. A step with nothing to explain is never listed.
    expect(seedReceiptStepReason(null)).toBe("")
    expect(seedReceiptStepReason(null, "search_documents")).toBe("")
  })

  it("never fabricates a tool name when none was handed to it", () => {
    for (const tool of [undefined, null, "", "   "]) {
      expect(seedReceiptStepReason("detected", tool)).toBe("it reads your documents")
    }
  })

  it("closes by saying nothing is committed, and offers a dismiss", () => {
    expect(SEED_RECEIPT_NOTHING_COMMITTED).toBe(
      "Everything else is yours to change. Nothing is saved or published yet.",
    )
    expect(SEED_RECEIPT_DISMISS_LABEL).toBe("Dismiss")
    // The glyph is a separate export precisely so the ACCESSIBLE label carries none —
    // the GOVERNANCE_SEAL_LABEL precedent (185-09).
    expect(SEED_RECEIPT_DISMISS_GLYPH).toBe("✕")
    expect(SEED_RECEIPT_DISMISS_LABEL).not.toContain(SEED_RECEIPT_DISMISS_GLYPH)
  })
})

// ── Phase 187 (VOCAB-03 / Req 6) — the template door's sentences ───────────────

describe("definitionOps — the template-door copy is a lock (sketch 151-C)", () => {
  /** A starter as `listStarterWorkflows` hands it over (`api.ts:1303`). */
  const riskRegister = {
    name: "Risk Register",
    definition: {
      slug: "risk-register",
      business_requirement: "Track and report the risks on my active projects.",
    },
  }

  it("ships exactly one quiet line at rest, plus the panel's heading and its note", () => {
    expect(STARTER_DOOR_LINE).toBe("Not sure where to start? Start from a template.")
    expect(STARTER_DOOR_HEADING).toBe("Start from a template")
    expect(STARTER_DOOR_NOTE).toBe(
      "Picking one fills the describe box with its own words. You can edit it before anything is generated.",
    )
  })

  it("keeps 'we could not look' and 'there are none' as DIFFERENT sentences (187-14)", () => {
    // The picker fetches, and a fetch has three outcomes besides success. Collapsing a
    // failure into an empty state would let the surface report a fact it does not have.
    expect(STARTER_DOOR_LOADING).toBe("Looking up the templates…")
    expect(STARTER_DOOR_UNAVAILABLE).toBe(
      "The templates could not be loaded just now. Describe what you need instead.",
    )
    expect(STARTER_DOOR_EMPTY).toBe("There are no templates to start from yet.")
    expect(STARTER_DOOR_UNAVAILABLE).not.toBe(STARTER_DOOR_EMPTY)
  })

  it("seeds the describe box with the starter's OWN plain-language sentence", () => {
    expect(starterSeedSentence(riskRegister)).toBe(
      "Track and report the risks on my active projects.",
    )
  })

  it("falls back to the starter's NAME — never an empty string, never a fabrication", () => {
    for (const definition of [
      undefined,
      null,
      {},
      { business_requirement: null },
      { business_requirement: "" },
      { business_requirement: "   " },
      { business_requirement: 42 },
    ]) {
      expect(starterSeedSentence({ name: "Risk Register", definition })).toBe("Risk Register")
    }
  })

  it("is TOTAL — a starter with neither a requirement nor a name never throws", () => {
    expect(starterSeedSentence({ name: "" })).toBe("")
    expect(starterSeedSentence({ name: "   ", definition: {} })).toBe("")
  })

  it("trims, so a padded requirement does not seed the box with whitespace", () => {
    expect(
      starterSeedSentence({ name: "X", definition: { business_requirement: "  Do a thing.  " } }),
    ).toBe("Do a thing.")
  })

  it("accepts a REAL `listStarterWorkflows` row without an adapter (187-14's contract)", () => {
    // `PublishedWorkflow` is imported as a TYPE only — erased at compile, so the pure
    // module still names no API client and the `?raw` fence above is untouched. This
    // assignment is the actual guard: if `StarterChoiceJSON` ever drifts away from the
    // shipped row shape, this file stops compiling rather than 187-14 discovering it.
    const row: PublishedWorkflow = {
      id: "00000000-0000-4000-8000-000000000000",
      slug: "weekly-status-report",
      name: "Weekly Status Report",
      definition: { business_requirement: "Summarise the week for stakeholders." },
    }
    expect(starterSeedSentence(row)).toBe("Summarise the week for stakeholders.")
  })
})

// ── Phase 187 — the new copy obeys the shipped honesty + glyph rules ───────────

describe("definitionOps — the Phase 187 copy carries no overclaim and no unshipped glyph", () => {
  /** EVERY string the two new surfaces can render, formatters included. */
  const PHASE_187_COPY = [
    seedReceiptHeading(0),
    seedReceiptHeading(1),
    seedReceiptHeading(5),
    seedReceiptGroundingLead(1),
    seedReceiptGroundingLead(2),
    seedReceiptCarriedLead(1),
    seedReceiptCarriedLead(2),
    SEED_RECEIPT_ONE_WAY_RULE,
    seedReceiptStepReason("detected", "search_documents"),
    seedReceiptStepReason("detected"),
    seedReceiptStepReason("already-set"),
    seedReceiptStepReason("escalated"),
    SEED_RECEIPT_NOTHING_COMMITTED,
    SEED_RECEIPT_DISMISS_LABEL,
    SEED_RECEIPT_DISMISS_GLYPH,
    STARTER_DOOR_LINE,
    STARTER_DOOR_HEADING,
    STARTER_DOOR_NOTE,
    STARTER_DOOR_LOADING,
    STARTER_DOOR_UNAVAILABLE,
    STARTER_DOOR_EMPTY,
    starterSeedSentence({ name: "Risk Register" }),
  ]

  it("uses none of the three overclaiming words", () => {
    // Assembled from parts so a grep of THIS file for the banned words is not itself
    // what fails (the D-ITEM-183-02 trap the governance block above also avoids).
    const banned = new RegExp(
      `\\b(${[["sa", "fe"].join(""), ["appro", "ved"].join(""), ["prov", "en"].join("")].join("|")})\\b`,
      "i",
    )
    for (const sentence of PHASE_187_COPY) expect(sentence).not.toMatch(banned)
  })

  it("the overclaim check is a REAL control — it finds each planted term", () => {
    const banned = new RegExp(
      `\\b(${[["sa", "fe"].join(""), ["appro", "ved"].join(""), ["prov", "en"].join("")].join("|")})\\b`,
      "i",
    )
    for (const word of [["sa", "fe"].join(""), ["appro", "ved"].join(""), ["prov", "en"].join("")]) {
      expect(`This step is ${word}.`).toMatch(banned)
    }
    // …and it does NOT fire on the shipped words that merely contain those letters.
    expect("Nothing is saved or published yet.").not.toMatch(banned)
    expect("so I set them to must prove it.").not.toMatch(banned)
  })

  it("carries no UNSHIPPED canvas glyph (icon-convention §4)", () => {
    // The two sketch-150-C proposals, assembled from escapes so this guard is not the
    // thing a source grep for them finds.
    const unshipped = [String.fromCharCode(0x2726), String.fromCharCode(0x2713)]
    for (const sentence of PHASE_187_COPY) {
      for (const glyph of unshipped) expect(sentence).not.toContain(glyph)
    }
    for (const glyph of unshipped) expect(definitionOpsSource).not.toContain(glyph)
  })

  it("every new sentence is non-empty and distinct — no constant is an alias", () => {
    const constants = [
      SEED_RECEIPT_ONE_WAY_RULE,
      SEED_RECEIPT_NOTHING_COMMITTED,
      SEED_RECEIPT_DISMISS_LABEL,
      SEED_RECEIPT_DISMISS_GLYPH,
      STARTER_DOOR_LINE,
      STARTER_DOOR_HEADING,
      STARTER_DOOR_NOTE,
      STARTER_DOOR_LOADING,
      STARTER_DOOR_UNAVAILABLE,
      STARTER_DOOR_EMPTY,
    ]
    for (const sentence of constants) expect(sentence.length).toBeGreaterThan(0)
    expect(new Set(constants).size).toBe(constants.length)
  })
})

// ── TOTALITY: nothing here may throw ──────────────────────────────────────────

describe("definitionOps — TOTALITY (author-supplied JSONB must never crash an op)", () => {
  const empty: PhaseSpecJSON[] = []

  it("every op survives an empty phases array", () => {
    expect(renumber(empty)).toEqual([])
    expect(addPhase(empty, newStep())).toEqual([
      { slug: "__new_step__", phase_index: 0, config: { phase_type: "llm_single", prompt: "" } },
    ])
    expect(insertPhaseAt(empty, 7, newStep())[0].phase_index).toBe(0)
    expect(movePhase(empty, "nope", 3)).toEqual([])
    expect(removePhase(empty, "nope")).toEqual([])
    expect(patchPhaseConfig(empty, "nope", { a: 1 })).toEqual([])
  })

  it("an unknown slug leaves the definition unchanged, and does not throw", () => {
    const before = fixture("eval_coverage")
    expect(movePhase(before, "no-such-step", 0)).toStrictEqual(before)
    expect(removePhase(before, "no-such-step")).toStrictEqual(before)
    expect(patchPhaseConfig(before, "no-such-step", { prompt: "x" })).toStrictEqual(before)
  })

  it("a phase with no validators key and an unknown phase_type resolves honestly", () => {
    const odd: PhaseSpecJSON[] = [
      { slug: "mystery", phase_index: 4, config: { phase_type: "a_type_from_the_future" } },
      { slug: "known", phase_index: 0, config: { phase_type: "llm_single", prompt: "" } },
    ]
    const out = renumber(odd)
    expect(out.map((p) => p.slug)).toEqual(["known", "mystery"])
    expect(indicesOf(out)).toEqual([0, 1])
    expect(out[1].validators).toBeUndefined()
    expect(() => removePhase(odd, "mystery")).not.toThrow()
  })

  it("a non-finite index clamps to the head rather than producing a hole", () => {
    const out = insertPhaseAt(fixture("eval_coverage"), Number.NaN, newStep("nan"))
    expect(out[0].slug).toBe("nan")
    expect(indicesOf(out)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

// ── The purity fence (the shipped `?raw` grep idiom) ──────────────────────────

describe("definitionOps — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("imports nothing from React, the store, the API client or the canvas model", () => {
    expect(definitionOpsSource).not.toMatch(/from\s+["']react["']/)
    expect(definitionOpsSource).not.toMatch(/from\s+["']zustand["']/)
    expect(definitionOpsSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(definitionOpsSource).not.toMatch(/from\s+["']@\/components\/workflows\/canvasModel["']/)
  })

  it("reads no DOM, no clock and no randomness", () => {
    expect(definitionOpsSource).not.toMatch(
      /getBoundingClientRect|offsetHeight|offsetWidth|document\.|window\.|Date\.now|Math\.random/,
    )
  })

  it("imports the shared vocabulary rather than re-deriving it", () => {
    expect(definitionOpsSource).toMatch(/from "@\/components\/workflows\/phaseVocabulary"/)
  })

  it("declares no second copy of the on-fail parse (G-5)", () => {
    expect(definitionOpsSource).not.toMatch(/function parseSkipTarget/)
    expect(definitionOpsSource).toMatch(/parseSkipTarget/)
  })

  it("never names the server validation seam and never opens a network call", () => {
    expect(definitionOpsSource).not.toMatch(/fetch\(/)
    expect(definitionOpsSource).not.toMatch(/workflows\/validate/)
    expect(definitionOpsSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })
})

// ── R10a — the orphaning-delete refusal ───────────────────────────────────────

describe("definitionOps — canRemovePhase (R10a: a refusal, with its reason)", () => {
  it("refuses a delete that would leave a dangling skip_to_phase target", () => {
    // `branching`: assess ⇢(on fail) escalate. Deleting `escalate` orphans that branch.
    const outcome = canRemovePhase(fixture("branching"), "escalate")
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error("expected a refusal")
    expect(outcome.reason.length).toBeGreaterThan(0)
    // The reason names the REFERRING step by its plain-language title, never its slug.
    expect(outcome.reason).toContain("Write it up")
    expect(outcome.reason).not.toContain("assess")
    expect(outcome.reason).toContain("Remove that fallback first.")
  })

  it("allows a delete on the 5-phase shape that breaks nothing", () => {
    for (const slug of ["split", "fanout", "deep_dive", "confirm", "summarize"]) {
      expect(canRemovePhase(fixture("eval_coverage"), slug)).toEqual({ ok: true })
    }
  })

  it("allows deleting a slug nothing references, even on a branching definition", () => {
    expect(canRemovePhase(fixture("branching"), "draft")).toEqual({ ok: true })
    expect(canRemovePhase(fixture("branching"), "gather")).toEqual({ ok: true })
  })

  it("allows deleting the REFERRER itself (it takes its own fallback with it)", () => {
    expect(canRemovePhase(fixture("branching"), "assess")).toEqual({ ok: true })
  })

  it("does not refuse on a self-reference", () => {
    const selfRef: PhaseSpecJSON[] = [
      {
        slug: "loop",
        phase_index: 0,
        config: { phase_type: "llm_single" },
        validators: [{ kind: "structure_check", on_failure: "skip_to_phase:loop" }],
      },
    ]
    expect(canRemovePhase(selfRef, "loop")).toEqual({ ok: true })
  })

  it("names the count when more than one step refers to the target", () => {
    const many: PhaseSpecJSON[] = [
      {
        slug: "one",
        phase_index: 0,
        name: "First check",
        config: { phase_type: "llm_single" },
        validators: [{ kind: "structure_check", on_failure: "skip_to_phase:rescue" }],
      },
      {
        slug: "two",
        phase_index: 1,
        name: "Second check",
        config: { phase_type: "llm_single" },
        validators: [{ kind: "structure_check", on_failure: "skip_to_phase:rescue" }],
      },
      { slug: "rescue", phase_index: 2, config: { phase_type: "llm_human_input" } },
    ]
    const outcome = canRemovePhase(many, "rescue")
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error("expected a refusal")
    expect(outcome.reason).toContain("First check")
    expect(outcome.reason).toContain("1 other step")
  })

  it("is TOTAL — a missing validators array, a malformed on_failure and an unknown slug", () => {
    const odd: PhaseSpecJSON[] = [
      { slug: "a", phase_index: 0, config: { phase_type: "llm_single" } },
      {
        slug: "b",
        phase_index: 1,
        config: { phase_type: "llm_single" },
        validators: [{ kind: "structure_check", on_failure: "skip_to_phase:" }],
      },
      {
        slug: "c",
        phase_index: 2,
        config: { phase_type: "llm_single" },
        validators: [{ kind: "structure_check", on_failure: "retry" }],
      },
    ]
    expect(canRemovePhase(odd, "a")).toEqual({ ok: true })
    expect(canRemovePhase(odd, "no-such-step")).toEqual({ ok: true })
    expect(canRemovePhase([], "anything")).toEqual({ ok: true })
  })
})

// ── R10b — the stranding-add refusal ──────────────────────────────────────────

describe("definitionOps — allowedTypesAt (R10b: disabled with its reason, never omitted)", () => {
  /** A deliverable-terminated definition: the `llm_emit` sits at render position 2. */
  const withEmit: PhaseSpecJSON[] = [
    { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
    { slug: "draft", phase_index: 1, config: { phase_type: "llm_single" } },
    { slug: "emit", phase_index: 2, config: { phase_type: "llm_emit" } },
  ]

  it("returns exactly 6 entries, in the fixed order, at EVERY index", () => {
    for (const index of [-5, 0, 1, 2, 3, 4, 99]) {
      const choices = allowedTypesAt(withEmit, index)
      expect(choices).toHaveLength(6)
      expect(choices.map((c) => c.type)).toEqual([...PHASE_TYPE_ORDER])
    }
  })

  it("offers every type where the deliverable stays terminal (indices 0, 1 and 2)", () => {
    // Index 2 is the slot immediately BEFORE the deliverable: inserting there pushes
    // the emit to position 3 and it is still last. See the boundary note in
    // definitionOps.ts and Deviation 1 in 184-02-SUMMARY.md.
    for (const index of [0, 1, 2]) {
      const choices = allowedTypesAt(withEmit, index)
      expect(choices.filter((c) => c.disabledReason !== undefined)).toEqual([])
    }
  })

  it("marks every choice disabled, with a non-empty reason, AFTER the deliverable", () => {
    for (const index of [3, 4, 99]) {
      const choices = allowedTypesAt(withEmit, index)
      expect(choices).toHaveLength(6)
      for (const choice of choices) {
        expect(choice.disabledReason).toBe(STRANDING_REASON)
        expect(choice.disabledReason?.length).toBeGreaterThan(0)
      }
    }
  })

  it("disables nothing when the definition carries no deliverable", () => {
    for (const index of [0, 1, 2, 3, 4, 5]) {
      const choices = allowedTypesAt(fixture("eval_coverage"), index)
      expect(choices).toHaveLength(6)
      expect(choices.filter((c) => c.disabledReason !== undefined)).toEqual([])
    }
    const empty = allowedTypesAt([], 0)
    expect(empty).toHaveLength(6)
    expect(empty.filter((c) => c.disabledReason !== undefined)).toEqual([])
  })

  it("measures from the LAST deliverable when a definition carries two", () => {
    const twoEmits: PhaseSpecJSON[] = [
      { slug: "first-emit", phase_index: 0, config: { phase_type: "llm_emit" } },
      { slug: "middle", phase_index: 1, config: { phase_type: "llm_single" } },
      { slug: "last-emit", phase_index: 2, config: { phase_type: "llm_emit" } },
    ]
    expect(allowedTypesAt(twoEmits, 1).filter((c) => c.disabledReason)).toEqual([])
    expect(allowedTypesAt(twoEmits, 2).filter((c) => c.disabledReason)).toEqual([])
    expect(allowedTypesAt(twoEmits, 3)).toHaveLength(6)
    expect(allowedTypesAt(twoEmits, 3).every((c) => c.disabledReason)).toBe(true)
  })

  it("offers the real Starter Library shape correctly (emit terminal at position 1)", () => {
    const starter = fixture("risk-register")
    expect(allowedTypesAt(starter, 1).filter((c) => c.disabledReason)).toEqual([])
    expect(allowedTypesAt(starter, 2).every((c) => c.disabledReason)).toBe(true)
  })
})

// ── D-184-11 — slug generation and the minimal phase ──────────────────────────

describe("definitionOps — slugForType (D-184-11: derived from the closed set, never user text)", () => {
  it("yields six distinct base slugs, all matching /^[a-z0-9-]+$/", () => {
    const slugs = PHASE_TYPE_ORDER.map((type) => slugForType([], type))
    expect(new Set(slugs).size).toBe(6)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it("appends -2 on the first collision and -3 on the second", () => {
    const base = slugForType([], "llm_single")
    const once: PhaseSpecJSON[] = [
      { slug: base, phase_index: 0, config: { phase_type: "llm_single" } },
    ]
    const second = slugForType(once, "llm_single")
    expect(second).toBe(`${base}-2`)
    expect(second).toMatch(/^[a-z0-9-]+$/)

    const twice: PhaseSpecJSON[] = [
      ...once,
      { slug: second, phase_index: 1, config: { phase_type: "llm_single" } },
    ]
    const third = slugForType(twice, "llm_single")
    expect(third).toBe(`${base}-3`)
    expect(third).toMatch(/^[a-z0-9-]+$/)
  })

  it("never reads a phase name or any other author-supplied text", () => {
    const named: PhaseSpecJSON[] = [
      {
        slug: "existing",
        phase_index: 0,
        name: "<script>alert(1)</script>",
        config: { phase_type: "llm_single", prompt: "'; DROP TABLE phases; --" },
      },
    ]
    for (const type of PHASE_TYPE_ORDER) {
      expect(slugForType(named, type)).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it("stays unique against a definition that already holds every base plus -2", () => {
    const crowded: PhaseSpecJSON[] = PHASE_TYPE_ORDER.flatMap((type, i) => [
      { slug: slugForType([], type), phase_index: i * 2, config: { phase_type: type } },
      { slug: `${slugForType([], type)}-2`, phase_index: i * 2 + 1, config: { phase_type: type } },
    ])
    for (const type of PHASE_TYPE_ORDER) {
      const next = slugForType(crowded, type)
      expect(next).toBe(`${slugForType([], type)}-3`)
      expect(crowded.some((p) => p.slug === next)).toBe(false)
    }
  })
})

describe("definitionOps — minimalPhaseFor (extra=\"forbid\": required keys and nothing more)", () => {
  const REQUIRED_CONFIG_KEYS: Record<PhaseTypeId, string[]> = {
    programmatic: ["phase_type", "fn"],
    llm_single: ["phase_type", "prompt"],
    llm_agent: ["phase_type", "prompt", "available_tools"],
    llm_batch_agents: ["phase_type", "prompt", "available_tools"],
    llm_human_input: ["phase_type", "prompt"],
    llm_emit: ["phase_type", "prompt"],
  }

  it.each(PHASE_TYPE_ORDER)("%s emits exactly the union-required config keys", (type) => {
    const phase = minimalPhaseFor(type, "some-slug", 3)
    expect(Object.keys(phase.config).sort()).toEqual([...REQUIRED_CONFIG_KEYS[type]].sort())
    expect(phase.config.phase_type).toBe(type)
  })

  it.each(PHASE_TYPE_ORDER)("%s emits no optional key with a backend default", (type) => {
    const phase = minimalPhaseFor(type, "some-slug", 0)
    for (const defaulted of [
      "max_steps",
      "max_parallel_agents",
      "merge_strategy",
      "emitter",
      "citation_policy",
      "integrity_policy",
      "timeout_seconds",
      "options",
      "input_keys",
      "model",
      "temperature",
      "folder_scope",
      "skill_ref",
      "skill_snapshot",
      "wall_clock_seconds",
    ]) {
      expect(phase.config).not.toHaveProperty(defaulted)
    }
  })

  it("emits only slug / phase_index / config at the phase level", () => {
    const phase = minimalPhaseFor("llm_single", "write", 2)
    expect(Object.keys(phase).sort()).toEqual(["config", "phase_index", "slug"])
    expect(phase.slug).toBe("write")
    expect(phase.phase_index).toBe(2)
    expect(phase).not.toHaveProperty("validators")
    expect(phase).not.toHaveProperty("name")
  })

  it("returns a FRESH object graph — two created steps never alias each other", () => {
    const a = minimalPhaseFor("llm_agent", "search", 0)
    const b = minimalPhaseFor("llm_agent", "search-2", 1)
    expect(a.config).not.toBe(b.config)
    expect(a.config.available_tools).not.toBe(b.config.available_tools)
    ;(a.config.available_tools as string[]).push("search_documents")
    expect(b.config.available_tools).toEqual([])
  })

  it("composes with insertPhaseAt to keep the spine contiguous", () => {
    const before = fixture("eval_coverage")
    const slug = slugForType(before, "llm_emit")
    const out = insertPhaseAt(before, 5, minimalPhaseFor("llm_emit", slug, 5))
    expect(out).toHaveLength(6)
    expect(indicesOf(out)).toEqual([0, 1, 2, 3, 4, 5])
    expect(out[5].slug).toBe(slug)
  })
})

// ── D-184-10 — the drag axis split ────────────────────────────────────────────

describe("definitionOps — resolveDrop (D-184-10: the axes split the two meanings)", () => {
  /** Four lanes at a 320 px pitch — the shipped CANVAS_LAYOUT.PITCH_X, passed IN
   *  rather than imported, because a pure axis resolver reads no layout table. */
  const lanes = [100, 420, 740, 1060]

  it("a purely VERTICAL drag never produces a definition edit", () => {
    const out = resolveDrop({ x: 100, y: 0 }, { x: 100, y: 64 }, lanes)
    expect(out.reorderTo).toBeNull()
    expect(out.dy).toBe(64)
  })

  it("separation by construction: reorderTo is independent of ANY dy", () => {
    for (const dy of [-4000, -321, -1, 0, 1, 321, 4000]) {
      const out = resolveDrop({ x: 740, y: 12 }, { x: 740, y: 12 + dy }, lanes)
      expect(out.reorderTo).toBeNull()
      expect(out.dy).toBe(dy)
    }
  })

  it("a HORIZONTAL drag past half a pitch resolves the target lane, with dy 0", () => {
    const out = resolveDrop({ x: 100, y: 0 }, { x: 420, y: 0 }, lanes)
    expect(out.reorderTo).toBe(1)
    expect(out.dy).toBe(0)
  })

  it("a HORIZONTAL drag under half a pitch produces no definition edit", () => {
    const out = resolveDrop({ x: 100, y: 0 }, { x: 240, y: 0 }, lanes)
    expect(out.reorderTo).toBeNull()
    expect(out.dy).toBe(0)
  })

  it("a DIAGONAL drag returns BOTH readings", () => {
    const out = resolveDrop({ x: 100, y: 0 }, { x: 420, y: 80 }, lanes)
    expect(out.reorderTo).toBe(1)
    expect(out.dy).toBe(80)
  })

  it("resolves the NEAREST lane, not merely the next one", () => {
    expect(resolveDrop({ x: 100, y: 0 }, { x: 1060, y: 0 }, lanes).reorderTo).toBe(3)
    expect(resolveDrop({ x: 1060, y: 0 }, { x: 100, y: 0 }, lanes).reorderTo).toBe(0)
    expect(resolveDrop({ x: 100, y: 0 }, { x: 700, y: 0 }, lanes).reorderTo).toBe(2)
  })

  it("crossing the half-pitch threshold is what flips the reading", () => {
    // 159 px of travel: under half a pitch (160) — cosmetic only.
    expect(resolveDrop({ x: 100, y: 0 }, { x: 259, y: 0 }, lanes).reorderTo).toBeNull()
    // 165 px of travel: past it — a real lane change.
    expect(resolveDrop({ x: 100, y: 0 }, { x: 265, y: 0 }, lanes).reorderTo).toBe(1)
  })

  it("is TOTAL — a single lane, an empty lane list and a zero pitch all resolve", () => {
    expect(resolveDrop({ x: 0, y: 0 }, { x: 900, y: 7 }, [100])).toEqual({
      reorderTo: null,
      dy: 7,
    })
    expect(resolveDrop({ x: 0, y: 0 }, { x: 900, y: 7 }, [])).toEqual({
      reorderTo: null,
      dy: 7,
    })
    expect(resolveDrop({ x: 0, y: 0 }, { x: 900, y: 7 }, [100, 100])).toEqual({
      reorderTo: null,
      dy: 7,
    })
  })

  it("is pure — the same drag resolves identically every time", () => {
    const once = resolveDrop({ x: 420, y: 40 }, { x: 740, y: 90 }, lanes)
    const twice = resolveDrop({ x: 420, y: 40 }, { x: 740, y: 90 }, lanes)
    expect(once).toEqual(twice)
    expect(once).toEqual({ reorderTo: 2, dy: 50 })
  })
})

// ── The whole-suite network tripwire (must run LAST) ──────────────────────────

describe("definitionOps — zero network calls across the entire suite", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls).toHaveLength(0)
  })
})
