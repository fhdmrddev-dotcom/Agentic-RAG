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

  it("setSaveState and markSaved leave the undo stack untouched", () => {
    const store = createBuilderStore(draft())
    store.getState().setSaveState("saving")
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

describe("builderStore — zero network calls across the entire suite (D-184-03)", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fetchSpy.mock.calls).toHaveLength(0)
  })
})
