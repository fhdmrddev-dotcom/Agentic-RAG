/**
 * Phase 184-05 Task 3 (R2, D-184-17) — the round-trip property.
 *
 * THE CLAIM. Any field the canvas does not model survives an edit session. `toCanvas`
 * reads six things off a phase and drops roughly twenty more — every prompt, every tool
 * list, every folder scope, every skill snapshot, `merge_strategy`, `validators[].config`
 * / `.timing` / `.max_retries` — so a serializer that REBUILT phases field by field
 * would silently discard authored data the moment the user saved. `fromCanvas` therefore
 * carries phases through BY REFERENCE, and the proof below is REFERENCE IDENTITY
 * (`toBe`) per element, which is a strictly stronger claim than any deep compare.
 *
 * ⚠ THE TRAP, stated up front so nobody files it as a defect: **`toCanvas` SORTS.** Its
 * comparator is total — `phase_index` ascending, `slug` as the string tiebreak — and it
 * lives at `canvasModel.ts:220-223`. The round trip therefore returns the SORTED source,
 * not the caller's array order, and every assertion here compares against
 * `[...phases].sort(byIndexThenSlug)`. Compared against the raw input array, a correct
 * serializer looks broken on any unsorted definition.
 *
 * ZERO I/O AT TEST TIME. The corpus arrives as a build-resolved JSON import of a
 * COMMITTED artifact (`resolveJsonModule` is on in `tsconfig.app.json`), never as a live
 * database read, so Phase 183's no-live-read property survives D-184-17 intact.
 *
 * NO SERIALIZED-FORM COMPARISON ANYWHERE IN THIS FILE — deliberately, and the
 * serializer's name is left unwritten here so a grep for it over this file returns
 * zero and cannot be satisfied only by making this paragraph lie (D-ITEM-183-02).
 * Comparing serialized forms makes key ORDER load-bearing for no reason and turns a
 * correct round trip red on a merely reordered object literal. The projection's
 * serializability is already pinned by `canvasModel.fixtures.test.ts:80-83`; it is not
 * this property's job.
 *
 * WHAT THE SWEEP RUNS OVER. The committed dump's definitions (named `corpus:<slug>`)
 * UNION the hand-rolled `generatedShapes()`. The generator is where the coverage lives:
 * the live corpus is 2-steps-modal and uses `skip_to_phase` zero times, so a dump alone
 * would barely exercise the serializer. When the dump is empty — which it is whenever
 * the local stack was down at dump time, and its `_provenance.note` says so plainly —
 * this suite is still fully meaningful.
 */
import { describe, it, expect } from "vitest"

import { fromCanvas, toCanvas } from "./canvasModel"
import corpusDump from "./__fixtures__/corpusDump.json"
import { generatedShapes, GENERATED_PHASE_TYPES } from "./__fixtures__/shapeGenerator"
import { indexGap } from "./__fixtures__/canvasFixtures"
import type { CanvasFixture } from "./__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "./phaseVocabulary"

/** The dump's row shape. Declared locally because an EMPTY `definitions` array infers
 *  as `never[]`, and the sweep must read the same way whether the dump is full or not. */
interface CorpusDefinition {
  id: string
  slug: string
  version: number
  status: string
  phases: PhaseSpecJSON[]
}

const corpusDefinitions = corpusDump.definitions as unknown as CorpusDefinition[]

/** The EXACT comparator `toCanvas` applies (`canvasModel.ts:220-223`) — index first,
 *  slug as the tiebreak. The property is only meaningful against this one. */
const byIndexThenSlug = (a: PhaseSpecJSON, b: PhaseSpecJSON) =>
  a.phase_index - b.phase_index || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)

/** Run the trip: project, then serialize back. */
const roundTrip = (phases: PhaseSpecJSON[]): PhaseSpecJSON[] =>
  fromCanvas(toCanvas(phases).nodes, phases)

/** Layout keys that must never reach a definition payload (Pitfall 3 — a leaked key
 *  422s against the backend's `extra="forbid"`). */
const FORBIDDEN_PAYLOAD_KEYS = ["position", "x", "y", "layout"]

const forbiddenKeysIn = (value: unknown, found: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) forbiddenKeysIn(item, found)
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_PAYLOAD_KEYS.includes(k)) found.push(k)
      forbiddenKeysIn(v, found)
    }
  }
  return found
}

const GENERATED = generatedShapes()

/** The union sweep list: the committed corpus, then the generated shapes. */
const ALL_SHAPES: CanvasFixture[] = [
  ...corpusDefinitions.map((definition) => ({
    name: `corpus:${definition.slug}`,
    phases: definition.phases,
    source: "committed dump — scripts/dump-workflow-corpus.py",
  })),
  ...GENERATED,
]

// ── The corpus meta block — a SHRINKING corpus is itself a failure ───────────────

describe("round-trip corpus — the inputs the property runs over", () => {
  it("the dump's recorded row_count matches the rows it actually carries", () => {
    expect(corpusDump._provenance.row_count).toBe(corpusDump.definitions.length)
  })

  it("the dump carries a provenance note, so an empty dump can never read as an empty corpus", () => {
    expect(corpusDump._provenance.note.length).toBeGreaterThan(0)
    expect(corpusDump._provenance.dumped_at.length).toBeGreaterThan(0)
    expect(corpusDump._provenance.query).toContain("workflow_definitions")
  })

  it("the generator emits at least 12 shapes", () => {
    expect(GENERATED.length).toBeGreaterThanOrEqual(12)
  })

  it("the generator emits every named shape CATEGORY the property depends on", () => {
    const names = GENERATED.map((shape) => shape.name)
    for (const token of ["skip", "gap", "duplicate-slug", "deep"]) {
      expect(names.some((name) => name.includes(token))).toBe(true)
    }
    for (const phaseType of GENERATED_PHASE_TYPES) {
      expect(names.some((name) => name.includes(phaseType))).toBe(true)
    }
  })

  it("every generated shape states where it came from", () => {
    for (const shape of GENERATED) {
      expect(shape.source.length).toBeGreaterThan(0)
      expect(shape.source).toContain("hand-authored")
    }
  })

  it("the union sweep covers node counts 0, 1, 2 and >= 5", () => {
    const counts = ALL_SHAPES.map((shape) => shape.phases.length)
    for (const n of [0, 1, 2]) expect(counts).toContain(n)
    expect(counts.some((n) => n >= 5)).toBe(true)
  })

  it("the union sweep covers all six phase types", () => {
    const types = new Set(
      ALL_SHAPES.flatMap((shape) => shape.phases.map((p) => p.config.phase_type)),
    )
    for (const phaseType of GENERATED_PHASE_TYPES) expect(types.has(phaseType)).toBe(true)
  })
})

// ── The property itself ─────────────────────────────────────────────────────────

describe.each(ALL_SHAPES)("R2 round trip — $name", ({ phases }) => {
  it("returns the SAME objects, in the SAME order, as the sorted source (reference identity)", () => {
    const expected = [...phases].sort(byIndexThenSlug)
    const round = roundTrip(phases)
    expect(round).toHaveLength(expected.length)
    // The primary proof. `toBe` is `Object.is` — it cannot be satisfied by a rebuild,
    // however faithful, so no dropped field can hide behind a passing assertion.
    round.forEach((phase, i) => expect(phase).toBe(expected[i]))
  })

  it("deep-equals the sorted source (the readable backstop, not the property)", () => {
    expect(roundTrip(phases)).toStrictEqual([...phases].sort(byIndexThenSlug))
  })

  it("carries no layout key into the definition payload (Pitfall 3 / R3)", () => {
    expect(forbiddenKeysIn(roundTrip(phases))).toEqual([])
    expect(forbiddenKeysIn(phases)).toEqual([])
  })

  it("leaves the source array itself untouched", () => {
    const lengthBefore = phases.length
    const firstBefore = phases[0]
    roundTrip(phases)
    expect(phases).toHaveLength(lengthBefore)
    expect(phases[0]).toBe(firstBefore)
  })
})

// ── The two targeted regressions the sweep cannot express ───────────────────────

describe("R2 regressions — the two shapes that break a naive serializer", () => {
  it("the SHIPPED indexGap fixture round-trips with its [0, 1, 3] indices UNCHANGED", () => {
    const round = roundTrip(indexGap)
    expect(round.map((p) => p.phase_index)).toEqual([0, 1, 3])
    // Renumbering lives in `definitionOps.renumber`, applied after a structural edit.
    // A serializer that renumbered would rewrite this committed fixture on save.
    expect(round).toHaveLength(indexGap.length)
  })

  it("a duplicate-slug source is handed back untouched — the fail-safe, never lossy", () => {
    const shape = GENERATED.find((s) => s.name.includes("duplicate-slug"))
    if (!shape) throw new Error("the duplicate-slug shape is missing from generatedShapes()")
    const round = roundTrip(shape.phases)
    expect(round).toHaveLength(shape.phases.length)
    round.forEach((phase, i) => expect(phase).toBe(shape.phases[i]))
  })
})

// ── The workflow-level half of R2 ───────────────────────────────────────────────

describe("R2 at the payload level — the cheaper, second assertion", () => {
  /**
   * DELIBERATELY a second, cheaper claim than the per-phase property above. `toCanvas`
   * is never handed the workflow-level fields at all, so they cannot be corrupted by
   * the projection — but a save path that rebuilt the definition around the new phases
   * could still drop one. Replacing ONLY `phases` and asserting (a) the key SET is
   * identical and (b) every non-`phases` value is reference-identical pins that, and
   * simultaneously discharges R3's "no positional field appears in any payload".
   *
   * Asserted on the key SET, never on key ORDER — key order is not part of the contract
   * and making it so would fail correct code.
   */
  const wholeDefinition = (phases: PhaseSpecJSON[]): Record<string, unknown> => ({
    slug: "synthetic-workflow",
    version: 3,
    name: "A synthetic workflow",
    status: "draft",
    project_folder_id: "44444444-4444-4444-8444-444444444444",
    output_target_folder: null,
    reingest_output: false,
    version_policy: "manual",
    provenance: { authored_by: "hand" },
    inputs: [],
    assets: [],
    business_requirement: "hand-authored requirement",
    category: "synthetic",
    phases,
  })

  it.each(GENERATED)("$name: only `phases` differs, and it differs by REFERENCE only", ({ phases }) => {
    const before = wholeDefinition(phases)
    // Annotated: spreading a `Record<string, unknown>` and adding one known key drops
    // the index signature, and the key walk below needs it back.
    const after: Record<string, unknown> = { ...before, phases: roundTrip(phases) }

    expect(new Set(Object.keys(after))).toEqual(new Set(Object.keys(before)))
    for (const key of Object.keys(before)) {
      if (key === "phases") continue
      expect(after[key]).toBe(before[key])
    }
    expect(forbiddenKeysIn(after)).toEqual([])
  })
})
