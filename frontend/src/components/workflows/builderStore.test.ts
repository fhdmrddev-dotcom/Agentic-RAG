/**
 * Phase 184 Wave 0 (R4 · D-184-01 · D-184-02 · D-184-03) — the builder-store proofs.
 *
 * WHY THIS FILE EXISTS BEFORE THE TOOLBAR. 184-RESEARCH.md's assumptions log records A3
 * at MEDIUM confidence: zundo's `handleSet` CALL SIGNATURE is verified from upstream
 * source, but the debounce-with-flush composition built on top of it is NOT copied from
 * any shipped example. A3's own discharge instruction is "prove it with a small unit test
 * on the store BEFORE building the toolbar on it". These are that test. The falsification
 * that makes them evidence rather than decoration is recorded in 184-04-SUMMARY.md.
 *
 * NO DOM, NO REACT RENDER. The store is driven directly, in the shipped
 * `__tests__/integration/streamsStore_per_thread.test.ts` shape — except that that suite
 * needs a `beforeEach` global reset because `streamsStore` is a module SINGLETON.
 * `createBuilderStore` is a per-mount FACTORY, so every test below constructs its own
 * store and no reset exists to forget. That is the concrete reason the factory shape is
 * better, and it is why history cannot leak between two Builder sessions.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockInstance } from "vitest"

import builderStoreSource from "./builderStore?raw"
import {
  createBuilderStore,
  selectDefinition,
  CONFIG_COALESCE_MS,
  HISTORY_LIMIT,
  type BuilderStore,
} from "./builderStore"
import type { PhaseSpecJSON } from "./phaseVocabulary"
// Plan 184-10, as SEPARATE statements — the 184-04 import lines above are untouched,
// so `git diff` on this file shows added lines only.
import { toCanvas } from "./canvasModel"
import { CANVAS_NODE_TYPES } from "./canvasModel"

/**
 * The whole-suite network tripwire. D-184-03 says an undo NEVER writes to the server, so
 * the strongest available statement is that nothing this suite drives — including every
 * undo and redo — reaches the network at all. Falsified before it was trusted (see the
 * SUMMARY): a planted call turns it red.
 */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Fixtures, hand-authored inline (the shipped corpus stays untouched, D-184-17) ──

function phase(slug: string, index: number, type = "llm_single"): PhaseSpecJSON {
  return { slug, phase_index: index, config: { phase_type: type } }
}

/** A three-step draft ending in a deliverable — the Starter-Library shape. */
function draft() {
  return {
    slug: "risk-register",
    version: 1,
    business_requirement: "Summarise the week's risks.",
    project_folder_id: null,
    phases: [phase("search", 0, "llm_agent"), phase("write", 1), phase("deliver", 2, "llm_emit")],
  }
}

const past = (store: BuilderStore) => store.temporal.getState().pastStates
const future = (store: BuilderStore) => store.temporal.getState().futureStates

// ── 1. Structural edits push a history entry IMMEDIATELY (D-184-02) ─────────────

describe("builderStore — a structural edit is one undo, recorded synchronously", () => {
  it("addPhaseOfType pushes exactly one entry with no timer advance", () => {
    const store = createBuilderStore(draft())
    expect(past(store)).toHaveLength(0)

    store.getState().addPhaseOfType("llm_single")

    expect(past(store)).toHaveLength(1)
    expect(store.getState().phases).toHaveLength(4)
  })

  it("insertPhaseOfTypeAt pushes exactly one entry with no timer advance", () => {
    const store = createBuilderStore(draft())
    store.getState().insertPhaseOfTypeAt(1, "llm_human_input")

    expect(past(store)).toHaveLength(1)
    expect(store.getState().phases[1].config.phase_type).toBe("llm_human_input")
  })

  it("reorderPhase pushes exactly one entry with no timer advance", () => {
    const store = createBuilderStore(draft())
    store.getState().reorderPhase("deliver", 0)

    expect(past(store)).toHaveLength(1)
    expect(store.getState().phases.map((p) => p.slug)).toEqual(["deliver", "search", "write"])
  })

  it("removePhaseBySlug pushes exactly one entry with no timer advance", () => {
    const store = createBuilderStore(draft())
    store.getState().removePhaseBySlug("write")

    expect(past(store)).toHaveLength(1)
    expect(store.getState().phases.map((p) => p.slug)).toEqual(["search", "deliver"])
  })

  it("four structural edits are four separate undos", () => {
    const store = createBuilderStore(draft())
    const s = store.getState()
    s.addPhaseOfType("llm_single")
    s.insertPhaseOfTypeAt(0, "programmatic")
    s.reorderPhase("search", 0)
    s.removePhaseBySlug("write")

    expect(past(store)).toHaveLength(4)
  })

  it("an unknown slug is a no-op and pushes NOTHING (no phantom entry)", () => {
    const store = createBuilderStore(draft())
    store.getState().reorderPhase("does-not-exist", 0)
    store.getState().removePhaseBySlug("does-not-exist")

    expect(past(store)).toHaveLength(0)
  })
})

// ── 2. Config edits coalesce over CONFIG_COALESCE_MS (D-184-02) ─────────────────

describe("builderStore — a run of config edits is ONE undo, not forty", () => {
  it("two patchConfig calls inside 500 ms produce ONE entry, and none before the flush", async () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())

    store.getState().patchConfig("write", { prompt: "Sum" })
    store.getState().patchConfig("write", { prompt: "Summarise" })

    // Nothing yet — the run is still coalescing.
    expect(past(store)).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(CONFIG_COALESCE_MS)

    expect(past(store)).toHaveLength(1)
  })

  it("a third patchConfig AFTER the flush starts a new run and produces a second entry", async () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())

    store.getState().patchConfig("write", { prompt: "a" })
    store.getState().patchConfig("write", { prompt: "ab" })
    await vi.advanceTimersByTimeAsync(CONFIG_COALESCE_MS)
    expect(past(store)).toHaveLength(1)

    store.getState().patchConfig("write", { prompt: "abc" })
    await vi.advanceTimersByTimeAsync(CONFIG_COALESCE_MS)

    expect(past(store)).toHaveLength(2)
  })

  it("the entry a coalesced run records is the state BEFORE the run began", async () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())
    const before = store.getState().phases

    store.getState().patchConfig("write", { prompt: "a" })
    store.getState().patchConfig("write", { prompt: "ab" })
    await vi.advanceTimersByTimeAsync(CONFIG_COALESCE_MS)

    expect(past(store)[0]?.phases).toBe(before)

    store.getState().flushHistory()
    store.temporal.getState().undo()
    expect(store.getState().phases).toBe(before)
  })

  it("flushHistory() commits a coalescing run early — the field-blur path", () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())

    store.getState().patchConfig("write", { prompt: "a" })
    expect(past(store)).toHaveLength(0)

    store.getState().flushHistory()

    expect(past(store)).toHaveLength(1)
  })
})

// ── 2b. Phase 185 — the governance write (D-185-10) ─────────────────────────────

describe("builderStore — setGovernance mirrors patchConfig, guard for guard", () => {
  it("writes the intent onto the named step only, and bumps editSeq", () => {
    const store = createBuilderStore(draft())
    const seqBefore = store.getState().editSeq

    store.getState().setGovernance("search", { grounding_escalated: true })

    const phases = store.getState().phases
    expect(phases[0].grounding_escalated).toBe(true)
    expect(phases[1].grounding_escalated).toBeUndefined()
    expect(phases[2].grounding_escalated).toBeUndefined()
    expect(store.getState().editSeq).toBe(seqBefore + 1)
  })

  it("writes at PhaseSpec level — the target's config is untouched, by reference", () => {
    const store = createBuilderStore(draft())
    const configBefore = store.getState().phases[1].config

    store.getState().setGovernance("write", { action_risk_armed: true })

    expect(store.getState().phases[1].config).toBe(configBefore)
    expect(store.getState().phases[1].action_risk_armed).toBe(true)
  })

  it("a non-drafted builder is a NO-OP — editSeq is unchanged", () => {
    const store = createBuilderStore(draft())
    store.getState().setComposing()
    const seqBefore = store.getState().editSeq
    const phasesBefore = store.getState().phases

    store.getState().setGovernance("search", { grounding_escalated: true })

    expect(store.getState().editSeq).toBe(seqBefore)
    expect(store.getState().phases).toBe(phasesBefore)
  })

  it("an unknown slug is a NO-OP — editSeq is unchanged", () => {
    const store = createBuilderStore(draft())
    const seqBefore = store.getState().editSeq
    const phasesBefore = store.getState().phases

    store.getState().setGovernance("no-such-step", { action_risk_armed: true })

    expect(store.getState().editSeq).toBe(seqBefore)
    expect(store.getState().phases).toBe(phasesBefore)
  })

  it('two consecutive calls both report lastEditKind "config" (the coalescing contract)', () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())

    store.getState().setGovernance("search", { grounding_escalated: true })
    expect(store.getState().lastEditKind).toBe("config")

    store.getState().setGovernance("search", { action_risk_armed: true })
    expect(store.getState().lastEditKind).toBe("config")
  })

  it("a run of governance flicks inside the quiet period is ONE undo, not two", async () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())
    const before = store.getState().phases

    store.getState().setGovernance("search", { grounding_escalated: true })
    store.getState().setGovernance("search", { action_risk_armed: true })
    await vi.advanceTimersByTimeAsync(CONFIG_COALESCE_MS)

    expect(past(store)).toHaveLength(1)
    expect(past(store)[0]?.phases).toBe(before)
  })
})

// ── 3. A structural edit interleaved into a coalescing run flushes it FIRST ──────

describe("builderStore — an atomic act never swallows the config run it interrupted", () => {
  it("records [config-run, structural] in that order", async () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())

    const beforeConfig = store.getState().phases
    store.getState().patchConfig("write", { prompt: "a" })
    store.getState().patchConfig("write", { prompt: "ab" })
    const afterConfig = store.getState().phases

    store.getState().addPhaseOfType("llm_single")

    expect(past(store)).toHaveLength(2)
    expect(past(store)[0]?.phases).toBe(beforeConfig)
    expect(past(store)[1]?.phases).toBe(afterConfig)

    // …and the pending timer, already flushed, adds nothing when it expires.
    await vi.advanceTimersByTimeAsync(CONFIG_COALESCE_MS)
    expect(past(store)).toHaveLength(2)
  })

  it("undoing twice steps back through the structural act and then the whole sentence", () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())
    const beforeConfig = store.getState().phases

    store.getState().patchConfig("write", { prompt: "a" })
    store.getState().patchConfig("write", { prompt: "ab" })
    store.getState().addPhaseOfType("llm_single")

    store.temporal.getState().undo()
    expect(store.getState().phases).toHaveLength(3)
    expect(store.getState().phases[1].config.prompt).toBe("ab")

    store.temporal.getState().undo()
    expect(store.getState().phases).toBe(beforeConfig)
  })
})

// ── 4. partialize holds the definition slice ONLY (R4 / Pitfall 8) ───────────────

describe("builderStore — a server verdict is not undoable", () => {
  it("setVerdicts leaves the undo stack untouched", () => {
    const store = createBuilderStore(draft())
    store.getState().setVerdicts([
      { code: "no_terminal", phase: null, message: "No deliverable.", severity: "error" },
    ])

    expect(past(store)).toHaveLength(0)
    expect(store.getState().verdicts).toHaveLength(1)
  })

  it("setChecking leaves the undo stack untouched", () => {
    const store = createBuilderStore(draft())
    store.getState().setChecking(true)

    expect(past(store)).toHaveLength(0)
    expect(store.getState().checking).toBe(true)
  })

  it("setDegraded leaves the undo stack untouched", () => {
    const store = createBuilderStore(draft())
    store.getState().setDegraded({ kind: "network" })

    expect(past(store)).toHaveLength(0)
    expect(store.getState().degraded).toEqual({ kind: "network" })
  })

  /**
   * RETARGETED, NOT DELETED (186-04 · the Phase 177 count lesson). This case was written
   * against the store's transient save-state setter, and 186-04 retired the slot that half
   * of it drove (four reasons, recorded at the tombstone in `builderStore.ts`). The
   * PROPERTY under test — an untracked setter never reaches the undo stack — outlives the
   * particular setter that happened to demonstrate it, so
   * the case is re-pointed at `setChecking` + `markSaved` with the same assertion shape
   * rather than dropped. Deleting it would have quietly lowered this file's assertion
   * count while every remaining test stayed green.
   */
  it("an untracked setter followed by markSaved leaves the undo stack untouched", () => {
    const store = createBuilderStore(draft())
    store.getState().setChecking(true)
    store.getState().markSaved()

    expect(past(store)).toHaveLength(0)
  })

  it("the snapshotted keys are exactly phases + lastEditKind + editSeq", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")

    expect(Object.keys(past(store)[0] ?? {}).sort()).toEqual([
      "editSeq",
      "lastEditKind",
      "phases",
    ])
  })
})

// ── 5. The cosmetic nudge is STRUCTURALLY absent (D-184-02) ─────────────────────

describe("builderStore — a nudge adds no history entry BY CONSTRUCTION", () => {
  it("the store carries no positional / offset field of any kind", () => {
    const store = createBuilderStore(draft())
    const offending = Object.keys(store.getState()).filter((k) => /dy|nudge|offset|position/i.test(k))

    expect(offending).toEqual([])
  })

  it("the walk is a real control — it FINDS a planted positional key", () => {
    const planted = { phases: [], dy: 12, verdicts: [] }
    const offending = Object.keys(planted).filter((k) => /dy|nudge|offset|position/i.test(k))

    expect(offending).toEqual(["dy"])
  })
})

// ── 6. Undo / redo semantics (verified zundo internals) ─────────────────────────

describe("builderStore — undo / redo", () => {
  it("undo restores the previous phases and moves one entry into the future", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")
    const afterFirst = store.getState().phases
    store.getState().addPhaseOfType("llm_single")
    store.getState().addPhaseOfType("llm_single")

    expect(past(store)).toHaveLength(3)

    store.temporal.getState().undo()

    expect(store.getState().phases).toHaveLength(5)
    store.temporal.getState().undo()
    expect(store.getState().phases).toBe(afterFirst)
    expect(future(store)).toHaveLength(2)
  })

  it("redo re-applies what undo stepped back over", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")
    const afterEdit = store.getState().phases

    store.temporal.getState().undo()
    expect(store.getState().phases).toHaveLength(3)

    store.temporal.getState().redo()
    expect(store.getState().phases).toEqual(afterEdit)
  })

  it("a NEW edit after an undo clears the redo stack (zundo sets futureStates: [])", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")
    store.getState().addPhaseOfType("llm_single")

    store.temporal.getState().undo()
    expect(future(store)).toHaveLength(1)

    store.getState().addPhaseOfType("programmatic")

    expect(future(store)).toHaveLength(0)
  })
})

// ── 7. D-184-03 — undo crosses the save boundary and NEVER writes ────────────────

describe("builderStore — undo re-arms dirty and writes nothing", () => {
  it("markSaved clears dirty; a later undo flips it back to true", () => {
    const store = createBuilderStore(draft())

    store.getState().addPhaseOfType("llm_single")
    expect(store.getState().dirty).toBe(true)

    store.getState().markSaved()
    expect(store.getState().dirty).toBe(false)

    store.temporal.getState().undo()

    expect(store.getState().dirty).toBe(true)
  })

  it("opening a definition does NOT mark the draft dirty", () => {
    const store = createBuilderStore(null)
    expect(store.getState().dirty).toBe(false)

    store.getState().setDrafted(draft())

    expect(store.getState().dirty).toBe(false)
    expect(store.getState().builderPhase).toBe("drafted")
  })

  it("a replaced DOCUMENT is not undoable back into the previous one", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")
    expect(past(store)).toHaveLength(1)

    store.getState().setDrafted({ slug: "other", phases: [phase("only", 0)] })

    expect(past(store)).toHaveLength(0)
    expect(future(store)).toHaveLength(0)
  })

  it("the store source names no network seam (the belt to the spy's braces)", () => {
    expect(builderStoreSource).not.toMatch(/fetch\(/)
    expect(builderStoreSource).not.toMatch(/from\s+["']@\/lib\/api["']/)
    expect(builderStoreSource).not.toMatch(/XMLHttpRequest|EventSource|sendBeacon/)
  })

  it("those fences are real — each regex matches its planted literal", () => {
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|sendBeacon/)
  })
})

// ── 8. limit eviction (verified: one entry per push at a >= boundary) ────────────

describe("builderStore — the history depth cap", () => {
  it(`holds at exactly HISTORY_LIMIT (${HISTORY_LIMIT}) after HISTORY_LIMIT + 5 edits`, () => {
    const store = createBuilderStore(draft())
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) store.getState().addPhaseOfType("llm_single")

    expect(past(store)).toHaveLength(HISTORY_LIMIT)
  })
})

// ── 9. selectDefinition — the ONE recombination point ────────────────────────────

describe("builderStore — selectDefinition", () => {
  it("returns the input definition's KEY SET (never asserted on key ORDER)", () => {
    const source = draft()
    const store = createBuilderStore(source)

    const out = selectDefinition(store.getState())

    expect(Object.keys(out).sort()).toEqual(Object.keys(source).sort())
  })

  it("carries the store's CURRENT phases array, not the loaded one", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")

    const out = selectDefinition(store.getState())

    expect(out.phases).toBe(store.getState().phases)
    expect(out.phases).toHaveLength(4)
  })

  it("adds no key of its own — no positional field can reach the payload (R3)", () => {
    const store = createBuilderStore(draft())
    const out = selectDefinition(store.getState())

    expect(Object.keys(out).filter((k) => /^(x|y|position|layout|dy)$/i.test(k))).toEqual([])
  })
})

// ── The per-mount property, and the network tripwire's verdict ───────────────────

describe("builderStore — two mounts, two independent histories", () => {
  it("an edit in one store leaves the other's history empty", () => {
    const a = createBuilderStore(draft())
    const b = createBuilderStore(draft())

    a.getState().addPhaseOfType("llm_single")

    expect(past(a)).toHaveLength(1)
    expect(past(b)).toHaveLength(0)
    expect(b.getState().phases).toHaveLength(3)
  })
})

// ── 11. The canvas-originated order commit (plan 184-10, R2 · D-184-09) ─────────
//
// APPENDED, never edited: every assertion above this line is 184-04's and is
// untouched. This block is deliberately placed BEFORE the whole-suite network
// tripwire below, so the spy's "exactly 0 calls" claim still covers it.
//
// The node arrays are built with the REAL `toCanvas` projection rather than
// hand-rolled, which is what makes the end-cap / stub filtering a genuine test of
// `fromCanvas`'s behaviour instead of a test of a fixture I shaped to pass.

/** The phase nodes of `phases`, in render order, reordered by `slugs`, with the
 *  non-phase nodes (the ○ end cap, an unresolved-skip stub) left in place. */
function nodesInOrder(phases: PhaseSpecJSON[], slugs: string[]) {
  const projection = toCanvas(phases)
  const byId = new Map(projection.nodes.map((n) => [n.id, n]))
  const phaseNodes = slugs.map((slug) => byId.get(slug)!)
  const others = projection.nodes.filter((n) => n.type !== CANVAS_NODE_TYPES.phase)
  return [...phaseNodes, ...others]
}

describe("builderStore — commitCanvasNodes runs through fromCanvas into the ONE reorder op", () => {
  it("a reordered node array produces that phases order, renumbered [0..n-1]", () => {
    const store = createBuilderStore(draft())

    store.getState().commitCanvasNodes(nodesInOrder(draft().phases, ["write", "search", "deliver"]))

    expect(store.getState().phases.map((p) => p.slug)).toEqual(["write", "search", "deliver"])
    expect(store.getState().phases.map((p) => p.phase_index)).toEqual([0, 1, 2])
  })

  it("moves a card FORWARD as well as backward (the derivation is not one-directional)", () => {
    const store = createBuilderStore(draft())

    store.getState().commitCanvasNodes(nodesInOrder(draft().phases, ["write", "deliver", "search"]))

    expect(store.getState().phases.map((p) => p.slug)).toEqual(["write", "deliver", "search"])
    expect(store.getState().phases.map((p) => p.phase_index)).toEqual([0, 1, 2])
  })

  it("raises pastStates by EXACTLY ONE, synchronously — a reorder is one atomic act", () => {
    const store = createBuilderStore(draft())
    expect(past(store)).toHaveLength(0)

    store.getState().commitCanvasNodes(nodesInOrder(draft().phases, ["deliver", "search", "write"]))

    // No timer advance: `lastEditKind` is "structural", so it does not coalesce.
    expect(past(store)).toHaveLength(1)
  })

  it("a node array in the CURRENT order is a NO-OP: no history entry, no dirty flag", () => {
    const store = createBuilderStore(draft())

    store.getState().commitCanvasNodes(nodesInOrder(draft().phases, ["search", "write", "deliver"]))

    expect(past(store)).toHaveLength(0)
    expect(store.getState().dirty).toBe(false)
    expect(store.getState().phases.map((p) => p.slug)).toEqual(["search", "write", "deliver"])
  })

  it("a source carrying DUPLICATE slugs is a no-op (the fromCanvas fail-safe propagates)", () => {
    // THE ARRAY ORDER IS DELIBERATELY NOT THE RENDER ORDER. `fromCanvas`'s fail-safe
    // hands back `[...source]` — the source's own array order — while the "nothing
    // moved" comparison is against the RENDER order. On a source that happens to be
    // stored in render order the two coincide and the later bail-out would mask this
    // one. Falsified: commenting out the duplicate-slug bail with THIS fixture turns
    // the test red (`movePhase` picks the first `dup` and commits a reorder nobody
    // performed); with a render-ordered fixture it stays green for the wrong reason.
    const store = createBuilderStore({
      ...draft(),
      phases: [phase("other", 2), phase("dup", 0), phase("dup", 1)],
    })

    store
      .getState()
      .commitCanvasNodes(nodesInOrder([phase("dup", 0), phase("other", 1)], ["other", "dup"]))

    expect(past(store)).toHaveLength(0)
    expect(store.getState().dirty).toBe(false)
    expect(store.getState().phases.map((p) => p.slug)).toEqual(["other", "dup", "dup"])
  })

  it("the end cap and an unresolved-skip stub in the array become no phases at all", () => {
    const withBrokenSkip: PhaseSpecJSON[] = [
      { slug: "start", phase_index: 0, config: { phase_type: "llm_single" } },
      {
        slug: "check",
        phase_index: 1,
        config: { phase_type: "llm_single" },
        validators: [{ on_failure: "skip_to_phase:nonexistent" }],
      },
    ]
    const store = createBuilderStore({ ...draft(), phases: withBrokenSkip })

    const projection = toCanvas(withBrokenSkip)
    // Positive control: the array really does carry both reserved-id node kinds.
    expect(projection.nodes.filter((n) => n.type !== CANVAS_NODE_TYPES.phase)).toHaveLength(2)

    store.getState().commitCanvasNodes(nodesInOrder(withBrokenSkip, ["check", "start"]))

    expect(store.getState().phases.map((p) => p.slug)).toEqual(["check", "start"])
    expect(store.getState().phases).toHaveLength(2)
  })

  it("a partial node array (a phase missing) is a no-op — a reorder never loses a step", () => {
    const store = createBuilderStore(draft())

    store.getState().commitCanvasNodes(nodesInOrder(draft().phases, ["write", "search"]))

    expect(past(store)).toHaveLength(0)
    expect(store.getState().phases.map((p) => p.slug)).toEqual(["search", "write", "deliver"])
  })

  it("marks the draft dirty on a real reorder (the D-184-03 subscription still fires)", () => {
    const store = createBuilderStore(draft())
    expect(store.getState().dirty).toBe(false)

    store.getState().commitCanvasNodes(nodesInOrder(draft().phases, ["deliver", "search", "write"]))

    expect(store.getState().dirty).toBe(true)
  })
})

// ── 12. F14 — binding a knowledge base ARMS the guard (186-04 · D-186-15) ───────
//
// APPENDED, never edited, and deliberately still ABOVE the whole-suite network
// tripwire so the "exactly 0 calls" claim covers these too.
//
// WHY THIS FILE HAS TO ASSERT `dirty` AT ALL. The D-184-03 subscription in the
// factory arms `dirty` on a **phases** reference change and on nothing else. A
// knowledge-base binding lives on `meta`, so without an explicit arm it would be a
// real definition edit that the leave guard never noticed: a new `definition` memo
// identity on the page (autosave fires), no `dirty` (no beforeunload, no canLeave
// prompt, the toolbar never reads "Not saved yet"). That is Pitfall 4, and these
// four cases are what keep it closed.

describe("builderStore — setProjectFolder writes and arms in ONE act (F14)", () => {
  it("binding writes meta.project_folder_id AND arms dirty in the same act", () => {
    const store = createBuilderStore(draft())
    // The arming is only meaningful if the store was clean immediately before.
    expect(store.getState().dirty).toBe(false)

    store.getState().setProjectFolder("folder-1")

    expect(store.getState().meta.project_folder_id).toBe("folder-1")
    expect(store.getState().dirty).toBe(true)
  })

  it("UNBINDING arms dirty too — clearing a binding is a definition edit as well", () => {
    const store = createBuilderStore({ ...draft(), project_folder_id: "folder-1" })
    expect(store.getState().dirty).toBe(false)

    store.getState().setProjectFolder(null)

    expect(store.getState().meta.project_folder_id).toBeNull()
    expect(store.getState().dirty).toBe(true)
  })

  it("leaves the undo stack untouched — a re-bind is undone by re-picking, not by ⌘Z", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")
    const depthBefore = past(store).length

    store.getState().setProjectFolder("folder-1")

    expect(past(store)).toHaveLength(depthBefore)
  })

  it("carries no other meta field away with it", () => {
    const store = createBuilderStore(draft())

    store.getState().setProjectFolder("folder-1")

    const meta = store.getState().meta
    expect(meta.slug).toBe("risk-register")
    expect(meta.version).toBe(1)
    expect(meta.business_requirement).toBe("Summarise the week's risks.")
  })

  it("a non-drafted builder is a NO-OP — meta unchanged by reference, still clean", () => {
    const store = createBuilderStore(draft())
    store.getState().setComposing()
    const metaBefore = store.getState().meta
    expect(store.getState().dirty).toBe(false)

    store.getState().setProjectFolder("folder-1")

    expect(store.getState().meta).toBe(metaBefore)
    expect(store.getState().dirty).toBe(false)
  })
})

// ── 13. BUG-260809-02 — the business requirement is WRITABLE (quick 260809-klo) ──
//
// APPENDED, never edited, and — like section 12 above — deliberately still ABOVE the
// whole-suite network tripwire so the "exactly 0 calls" claim covers these too.
//
// WHY THIS SECTION EXISTS. A workflow authored on the CANVAS could never be published:
// `business_requirement` was declared on the definition and round-tripped by the store,
// but no UI anywhere WROTE it, and the publish gauntlet's stage 1 refuses without it
// (`backend/app/api/workflows.py:712-721`). The store half of that hole is this action.
//
// The load-bearing case is the FIRST one: what reaches `selectDefinition` is what reaches
// the PATCH body (`useDraftPersistence.ts:619` calls exactly that), so asserting on the
// recombined definition — phases reference included — is what proves the write cannot
// truncate the payload the endpoint requires whole.

describe("builderStore — setBusinessRequirement writes into the PATCH body (BUG-260809-02)", () => {
  it("reaches selectDefinition, leaving the phases array REFERENTIALLY unchanged", () => {
    const store = createBuilderStore(draft())
    const phasesBefore = store.getState().phases

    store.getState().setBusinessRequirement("Summarise vendor risk.")

    const out = selectDefinition(store.getState())
    expect(out.business_requirement).toBe("Summarise vendor risk.")
    // The PATCH takes a COMPLETE WorkflowDefinition — a meta write that disturbed
    // `phases` could silently truncate it. Identity, not deep-equality, is the claim.
    expect(out.phases).toBe(phasesBefore)
    expect(out.phases).toHaveLength(3)
  })

  it("arms dirty in the SAME act — clean immediately before, dirty immediately after", () => {
    const store = createBuilderStore(draft())
    expect(store.getState().dirty).toBe(false)

    store.getState().setBusinessRequirement("Summarise vendor risk.")

    expect(store.getState().dirty).toBe(true)
  })

  it("is UNTRACKED — typing a sentence never floods the undo stack (positive control inline)", () => {
    const store = createBuilderStore(draft())
    const depthBefore = past(store).length

    store.getState().setBusinessRequirement("S")
    store.getState().setBusinessRequirement("Su")
    store.getState().setBusinessRequirement("Sum")

    expect(past(store)).toHaveLength(depthBefore)

    // The positive control, in this same test: without it the assertion above would
    // pass just as happily on a store where NOTHING is tracked at all.
    store.getState().addPhaseOfType("llm_single")
    expect(past(store)).toHaveLength(depthBefore + 1)
  })

  it("a non-drafted builder is a NO-OP — meta unchanged by reference, still clean", () => {
    const store = createBuilderStore(null)
    expect(store.getState().builderPhase).toBe("empty")
    const metaBefore = store.getState().meta

    store.getState().setBusinessRequirement("x")

    expect(store.getState().meta).toBe(metaBefore)
    expect(store.getState().dirty).toBe(false)
  })

  it("writes whitespace THROUGH — the server owns the emptiness rule, not this client", () => {
    const store = createBuilderStore(draft())

    store.getState().setBusinessRequirement("   ")

    // `grounding.py:894` is `not (definition.business_requirement or "").strip()`.
    // A client that trimmed or nulled here would be a second copy of a server
    // predicate, which D-182-06 forbids.
    expect(store.getState().meta.business_requirement).toBe("   ")
  })

  it("carries no other meta field away with it", () => {
    const store = createBuilderStore(draft())

    store.getState().setBusinessRequirement("Summarise vendor risk.")

    const meta = store.getState().meta
    expect(meta.slug).toBe("risk-register")
    expect(meta.version).toBe(1)
    expect(meta.project_folder_id).toBeNull()
  })
})

// ── 14. Phase 197 (AUTH-02 · D-15) — the workflow's NAME is writable ────────────
//
// APPENDED, never edited, and — like sections 12 and 13 above — deliberately still ABOVE
// the whole-suite network tripwire so the "exactly 0 calls" claim covers these too.
//
// WHY THIS SECTION EXISTS. `setName` is the ONE write path for the workflow's name and the
// only store action Phase 197 creates. It inherits five properties from the three
// `meta`-writing siblings that precede it, and each is driven as its own case rather than
// assumed from the family resemblance — a fourth sibling that merely LOOKS like the other
// three is exactly how one of the five silently goes missing.
//
// The load-bearing case is the SECOND one. D-15's whole content is that the key identity,
// forks and versioning key off is NEVER written, and the object that proves it is
// `selectDefinition`'s output — that is what reaches the PATCH body
// (`useDraftPersistence.ts` calls exactly that), and `WorkflowDefinition` is
// `extra="forbid"`, so a stray key there is a 422 that would destroy the write on the very
// first autosave. Asserting on `meta` alone would fence an internal field instead of the
// payload the server actually validates.

/** Keys present in `after` and absent from `before`, sorted. */
const addedKeys = (before: readonly string[], after: readonly string[]) =>
  after.filter((k) => !before.includes(k)).sort()

describe("builderStore — setName writes the name and NEVER the identity key (D-15)", () => {
  it("writes meta.name verbatim", () => {
    const store = createBuilderStore(draft())

    store.getState().setName("Northwind QBR")

    expect(store.getState().meta.name).toBe("Northwind QBR")
  })

  it("leaves the slug identical and adds exactly one key to the PATCH body", () => {
    const store = createBuilderStore(draft())
    const before = selectDefinition(store.getState())
    const slugBefore = before.slug
    const keysBefore = Object.keys(before)
    expect(slugBefore).toBe("risk-register")

    store.getState().setName("Northwind QBR")

    // The slug is the key identity, forks and versioning key off. D-15 leaves it alone.
    expect(store.getState().meta.slug).toBe(slugBefore)

    // Asserted over what actually SHIPS, not over `meta`: `selectDefinition` is what the
    // autosave PATCH body is built from, and the endpoint's model forbids extra keys.
    const after = selectDefinition(store.getState())
    expect(after.slug).toBe(slugBefore)
    expect(addedKeys(keysBefore, Object.keys(after))).toEqual(["name"])

    // POSITIVE CONTROL, in this same block: without it the comparison above would pass
    // just as happily if `addedKeys` could never report anything at all. Compare the same
    // "before" key set against a locally-constructed object carrying ONE extra key and
    // prove the comparison names it.
    const withStray = { ...after, stray_key: true }
    expect(addedKeys(keysBefore, Object.keys(withStray))).toEqual(["name", "stray_key"])
  })

  it("arms dirty in the SAME act, on a store whose phases reference did not change", () => {
    const store = createBuilderStore(draft())
    const phasesBefore = store.getState().phases
    expect(store.getState().dirty).toBe(false)

    store.getState().setName("Northwind QBR")

    // This is the case that would fail if the action leaned on the `phases` subscription:
    // that subscription arms `dirty` on a change to the phases REFERENCE and nothing else.
    expect(store.getState().phases).toBe(phasesBefore)
    expect(store.getState().dirty).toBe(true)
  })

  it("a non-drafted builder is a NO-OP — meta unchanged by reference, still clean", () => {
    const store = createBuilderStore(null)
    expect(store.getState().builderPhase).toBe("empty")
    const metaBefore = store.getState().meta

    store.getState().setName("Northwind QBR")

    expect(store.getState().meta).toBe(metaBefore)
    expect(store.getState().dirty).toBe(false)
  })

  it("is UNTRACKED — an undo restores STEPS and never the name (positive control inline)", () => {
    const store = createBuilderStore(draft())
    const depthBefore = past(store).length

    store.getState().setName("N")
    store.getState().setName("No")
    store.getState().setName("Nor")

    // `partialize` narrows the tracked slice to `phases` plus the two edit discriminators,
    // so three name writes predict a stack depth of exactly zero pushes.
    expect(past(store)).toHaveLength(depthBefore)

    // The POSITIVE CONTROL: without it the assertion above would pass just as happily on a
    // store where NOTHING is tracked at all.
    store.getState().addPhaseOfType("llm_single")
    expect(past(store)).toHaveLength(depthBefore + 1)

    // And the property that matters to the author: undoing steps back over the STEP, while
    // the workflow's name survives untouched.
    store.getState().setName("Northwind QBR")
    store.temporal.getState().undo()

    expect(store.getState().phases).toHaveLength(3)
    expect(store.getState().meta.name).toBe("Northwind QBR")
  })

  it("writes whitespace and the empty string THROUGH — the server owns emptiness", () => {
    const store = createBuilderStore(draft())

    store.getState().setName("  ")
    expect(store.getState().meta.name).toBe("  ")

    store.getState().setName("")
    expect(store.getState().meta.name).toBe("")

    // A client that trimmed, nulled or defaulted here would be a second copy of a server
    // predicate, which D-182-06 forbids. The store states what the author typed.
  })

  it("adds NO provenance key — C-1's declined mark, pinned mechanically", () => {
    const store = createBuilderStore(draft())
    const keysBefore = Object.keys(store.getState().meta)

    store.getState().setName("Northwind QBR")

    // Assembled at runtime from parts: this suite sweeps the store's RAW source for
    // needles, and a spelled-out token in a test is one grep away from being mistaken for
    // an implementation that carries it.
    const provenanceToken = ["seeded", "by", "ai"].join("_")
    const added = addedKeys(keysBefore, Object.keys(store.getState().meta))
    expect(added.filter((k) => k.includes(provenanceToken))).toEqual([])
    expect(added).toEqual(["name"])

    // POSITIVE CONTROL: the filter really does catch such a key when one is present.
    const planted = [...added, `name_${provenanceToken}`]
    expect(planted.filter((k) => k.includes(provenanceToken))).toEqual([`name_${provenanceToken}`])
  })

  it("carries no other meta field away with it", () => {
    const store = createBuilderStore(draft())

    store.getState().setName("Northwind QBR")

    const meta = store.getState().meta
    expect(meta.slug).toBe("risk-register")
    expect(meta.version).toBe(1)
    expect(meta.business_requirement).toBe("Summarise the week's risks.")
    expect(meta.project_folder_id).toBeNull()
  })
})

// ── 15. Phase 205 (STATE-01 / D-07) — is_stateful living register toggle ────────
describe("builderStore — setIsStateful sets is_stateful and arms dirty (Phase 205)", () => {
  it("toggles meta.is_stateful to true and arms dirty", () => {
    const store = createBuilderStore(draft())
    expect(store.getState().dirty).toBe(false)
    expect(store.getState().meta.is_stateful).toBeUndefined()

    store.getState().setIsStateful(true)

    expect(store.getState().meta.is_stateful).toBe(true)
    expect(store.getState().dirty).toBe(true)
  })

  it("can toggle meta.is_stateful back to false", () => {
    const store = createBuilderStore(draft())
    store.getState().setIsStateful(true)
    expect(store.getState().meta.is_stateful).toBe(true)

    store.getState().setIsStateful(false)
    expect(store.getState().meta.is_stateful).toBe(false)
    expect(store.getState().dirty).toBe(true)
  })

  it("leaves undo stack untouched (untracked)", () => {
    const store = createBuilderStore(draft())
    store.getState().addPhaseOfType("llm_single")
    expect(store.getState().phases).toHaveLength(4)

    store.getState().setIsStateful(true)
    expect(store.getState().meta.is_stateful).toBe(true)

    store.temporal.getState().undo()
    // Steps are undone, meta.is_stateful is preserved
    expect(store.getState().phases).toHaveLength(3)
    expect(store.getState().meta.is_stateful).toBe(true)
  })
})

describe("builderStore — zero network calls across the entire suite (D-184-03)", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls).toHaveLength(0)
  })
})
