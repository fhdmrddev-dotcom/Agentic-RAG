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
import { describe, it, expect } from "vitest"

import definitionOpsSource from "./definitionOps?raw"
import {
  addPhase,
  insertPhaseAt,
  movePhase,
  patchPhaseConfig,
  removePhase,
  renumber,
} from "./definitionOps"
import { ALL_FIXTURES } from "./__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "./phaseVocabulary"

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
})
