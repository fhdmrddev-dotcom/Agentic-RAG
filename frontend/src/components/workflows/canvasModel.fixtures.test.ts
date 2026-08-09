/**
 * Phase 183-05 Task 2 (CANVAS-01 / SC#4) — the fixture sweep.
 *
 * SC#4's bar: every canonical seed, the Starter Library, the PM pack and the 5-phase
 * maximum project with NO DROPPED PHASE and NO PHANTOM EDGE. That is asserted here
 * structurally over `ALL_FIXTURES`, so a fixture added to the corpus is swept
 * automatically and cannot be silently skipped.
 *
 * The structural invariants are the real gate. The `toMatchSnapshot()` at the end is
 * the DRIFT TRIPWIRE — it catches an unintended change to a title, a grounding badge,
 * a position or an id that no invariant above would notice.
 */
import { describe, it, expect } from "vitest"

import { toCanvas } from "./canvasModel"
import { ALL_FIXTURES } from "./__fixtures__/canvasFixtures"

describe("canvasFixtures — the corpus itself (SC#4 coverage)", () => {
  it("registers at least 14 fixtures in the sweep list", () => {
    expect(ALL_FIXTURES.length).toBeGreaterThanOrEqual(14)
  })

  it("covers all six phase types", () => {
    const types = new Set(
      ALL_FIXTURES.flatMap((f) => f.phases.map((p) => p.config.phase_type)),
    )
    for (const t of [
      "programmatic",
      "llm_single",
      "llm_agent",
      "llm_batch_agents",
      "llm_human_input",
      "llm_emit",
    ]) {
      expect(types.has(t)).toBe(true)
    }
  })

  it("covers node counts 0, 1, 2, 3 and 5", () => {
    const counts = new Set(ALL_FIXTURES.map((f) => f.phases.length))
    for (const n of [0, 1, 2, 3, 5]) expect(counts.has(n)).toBe(true)
  })

  it("names a source for every fixture (transcribed, or explicitly hand-authored)", () => {
    for (const f of ALL_FIXTURES) {
      expect(f.source.length).toBeGreaterThan(0)
      expect(/:\d+|hand-authored, test-only/.test(f.source)).toBe(true)
    }
  })
})

describe.each(ALL_FIXTURES)("toCanvas sweep — $name", ({ phases }) => {
  it("emits exactly one 'phase' node per phase (no dropped phase)", () => {
    const { nodes } = toCanvas(phases)
    expect(nodes.filter((n) => n.type === "phase")).toHaveLength(phases.length)
  })

  it("gives every phase node an id equal to its slug (SC#3)", () => {
    const { nodes } = toCanvas(phases)
    const ids = nodes.filter((n) => n.type === "phase").map((n) => n.id)
    const slugs = [...phases].sort((a, b) => a.phase_index - b.phase_index).map((p) => p.slug)
    expect(ids).toEqual(slugs)
  })

  it("resolves every edge's source AND target to an emitted node id (no phantom edge)", () => {
    const { nodes, edges } = toCanvas(phases)
    const ids = new Set(nodes.map((n) => n.id))
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true)
      expect(ids.has(e.target)).toBe(true)
    }
  })

  it("emits no duplicate node id and no duplicate edge id", () => {
    const { nodes, edges } = toCanvas(phases)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length)
  })

  it("survives a JSON round-trip unchanged (serializable)", () => {
    const out = toCanvas(phases)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
  })

  it("matches its committed snapshot (the drift tripwire)", () => {
    expect(toCanvas(phases)).toMatchSnapshot()
  })
})

describe("toCanvas — the targeted assertions the general sweep cannot express", () => {
  const fixture = (name: string) => {
    const found = ALL_FIXTURES.find((f) => f.name.startsWith(name))
    if (!found) throw new Error(`fixture ${name} missing from ALL_FIXTURES`)
    return found.phases
  }

  it("renders llm_batch_agents as exactly ONE node — in both witnesses", () => {
    for (const name of ["literature_review", "eval_coverage"]) {
      const { nodes } = toCanvas(fixture(name))
      const batch = nodes.filter(
        (n) => n.type === "phase" && n.data.phaseType === "llm_batch_agents",
      )
      expect(batch).toHaveLength(1)
    }
  })

  it("draws exactly one skip edge, landing on `escalate`, for the branching fixture", () => {
    const { edges, nodes } = toCanvas(fixture("branching"))
    const skips = edges.filter((e) => e.data?.kind === "skip")
    expect(skips).toHaveLength(1)
    expect(skips[0].source).toBe("assess")
    expect(skips[0].target).toBe("escalate")
    expect(nodes.filter((n) => n.type === "unresolvedSkip")).toHaveLength(0)
  })

  it("draws exactly one stub and no edge to a non-existent id for the broken reference", () => {
    const { nodes, edges } = toCanvas(fixture("unresolvable skip"))
    const stubs = nodes.filter((n) => n.type === "unresolvedSkip")
    expect(stubs).toHaveLength(1)
    expect(stubs[0].data.declaredTarget).toBe("nonexistent")
    expect(edges.some((e) => e.target === "nonexistent")).toBe(false)
    expect(edges.filter((e) => e.target === stubs[0].id)).toHaveLength(1)
  })

  it("draws exactly ONE sequential edge across the [0,1,3] gap — no phantom bridge", () => {
    const { edges } = toCanvas(fixture("non-contiguous"))
    const flow = edges.filter((e) => e.data?.kind === "flow")
    expect(flow).toHaveLength(1)
    expect(flow[0].source).toBe("first")
    expect(flow[0].target).toBe("second")
    expect(edges.some((e) => e.source === "second" && e.target === "stranded")).toBe(false)
  })

  it("emits no end cap at all for the empty draft (D-183-11)", () => {
    expect(toCanvas(fixture("empty draft"))).toEqual({ nodes: [], edges: [] })
  })

  it("keeps the 5-phase maximum inside the sketch 136-B width budget (UAT U-2)", () => {
    const { nodes } = toCanvas(fixture("eval_coverage"))
    const xs = nodes.filter((n) => n.type === "phase").map((n) => n.position.x)
    expect(Math.max(...xs)).toBeLessThanOrEqual(1600)
  })
})
