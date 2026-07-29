/**
 * Phase 183-05 Task 1 (CANVAS-01, D-183-10 / D-183-11 / D-183-12, correction C-2) —
 * canvasModel behaviour spec.
 *
 * The projection is the whole truth of this phase, so its contract is asserted here
 * with zero DOM: `toCanvas` is a plain function of the definition and every SC#2 /
 * SC#3 / SC#4 claim reduces to an assertion over the returned arrays.
 *
 * The single most important test in this file is the NON-CONTIGUOUS one. The obvious
 * implementation (sort the array, draw i→i+1) bridges a `phase_index` gap and paints
 * an edge the server's reachability adjacency does NOT have — the phantom edge G-6
 * names as a failure. The gap fixture asserts its ABSENCE by name.
 */
import { describe, it, expect } from "vitest"

import {
  toCanvas,
  CANVAS_LAYOUT,
  type CanvasNode,
} from "./canvasModel"
import type { PhaseSpecJSON } from "./phaseVocabulary"

// ── Local fixtures (module-level consts — the house style for a unit spec) ──────

/** A 3-phase contiguous flow: llm_agent → llm_human_input → llm_single. */
const threePhase: PhaseSpecJSON[] = [
  { slug: "draft", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "confirm", phase_index: 1, config: { phase_type: "llm_human_input" } },
  { slug: "finalize", phase_index: 2, config: { phase_type: "llm_single" } },
]

/** The degenerate one-phase draft — no preceding edge before the ○ end cap. */
const onePhase: PhaseSpecJSON[] = [
  { slug: "only", phase_index: 0, config: { phase_type: "llm_single" } },
]

/** phase_index [0, 1, 3] — the C-2 gap. Index 3 is an ORPHAN, never bridged. */
const nonContiguous: PhaseSpecJSON[] = [
  { slug: "a", phase_index: 0, config: { phase_type: "llm_agent" } },
  { slug: "b", phase_index: 1, config: { phase_type: "llm_single" } },
  { slug: "d", phase_index: 3, config: { phase_type: "llm_single" } },
]

/** A resolvable branch: assess ⇢(on fail) escalate, skipping `draft2`. */
const branching: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
  {
    slug: "assess",
    phase_index: 1,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "structure_check", on_failure: "skip_to_phase:escalate" }],
  },
  { slug: "draft2", phase_index: 2, config: { phase_type: "llm_single" } },
  { slug: "escalate", phase_index: 3, config: { phase_type: "llm_human_input" } },
]

/** An on_failure naming a slug that does not exist (D-183-10). */
const unresolvable: PhaseSpecJSON[] = [
  { slug: "start", phase_index: 0, config: { phase_type: "llm_agent" } },
  {
    slug: "check",
    phase_index: 1,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "structure_check", on_failure: "skip_to_phase:nonexistent" }],
  },
]

/** Every NON-skip disposition, plus a phase with no `validators` array at all. */
const nonSkipDispositions: PhaseSpecJSON[] = [
  {
    slug: "p0",
    phase_index: 0,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "citations_required", on_failure: "fail_run" }],
  },
  {
    slug: "p1",
    phase_index: 1,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "structure_check", on_failure: "ask_user" }],
  },
  {
    slug: "p2",
    phase_index: 2,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "regex_match", on_failure: "retry" }],
  },
  { slug: "p3", phase_index: 3, config: { phase_type: "llm_agent" } },
]

/** literature_review's middle phase — the fan-out that must stay ONE node. */
const batchAgents: PhaseSpecJSON[] = [
  { slug: "split", phase_index: 0, config: { phase_type: "programmatic" } },
  {
    slug: "review",
    phase_index: 1,
    config: { phase_type: "llm_batch_agents", max_parallel_agents: 5 },
  },
  { slug: "merge", phase_index: 2, config: { phase_type: "llm_single" } },
]

const phaseNodes = (nodes: CanvasNode[]) => nodes.filter((n) => n.type === "phase")

describe("canvasModel.CANVAS_LAYOUT — the ONE frozen constants table", () => {
  it("carries the locked layout values (183-06's CSS reads these, not literals)", () => {
    expect(CANVAS_LAYOUT).toEqual({
      NODE_WIDTH: 260,
      // 185-01 (D-185-17): raised 96 → 104 with the 137-B card rebuild. 104 is the
      // floor at which the mark floating above the card's top edge clears the title
      // by 11px. `NODE_WIDTH` is unchanged and is the NODE BOX — the 137-B card is
      // 248px INSIDE it.
      NODE_MIN_HEIGHT: 104,
      PITCH_X: 320,
      LANE_Y: 0,
      SKIP_LANE_Y: 200,
      EDGE_ANCHOR_Y: 28,
      END_CAP_SIZE: 40,
    })
  })

  it("places five phases inside the 1,600px UAT row U-2 budget by construction", () => {
    expect(4 * CANVAS_LAYOUT.PITCH_X + CANVAS_LAYOUT.NODE_WIDTH).toBeLessThanOrEqual(1600)
  })
})

describe("canvasModel.toCanvas — the empty and degenerate shapes (D-183-11)", () => {
  it("an empty definition yields no nodes and no edges — no end cap, no ghost node", () => {
    expect(toCanvas([])).toEqual({ nodes: [], edges: [] })
  })

  it("a 1-phase definition yields 1 phase node, 1 end-cap node and exactly 1 edge", () => {
    const { nodes, edges } = toCanvas(onePhase)
    expect(phaseNodes(nodes)).toHaveLength(1)
    expect(nodes.filter((n) => n.type === "endCap")).toHaveLength(1)
    expect(edges).toHaveLength(1)
    expect(edges[0].data?.kind).toBe("end")
    expect(edges[0].source).toBe("only")
  })
})

describe("canvasModel.toCanvas — the contiguous spine", () => {
  it("3 contiguous phases yield 3 phase nodes + 1 end cap and 3 edges", () => {
    const { nodes, edges } = toCanvas(threePhase)
    expect(phaseNodes(nodes)).toHaveLength(3)
    expect(nodes.filter((n) => n.type === "endCap")).toHaveLength(1)
    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(3)
    expect(edges.filter((e) => e.data?.kind === "flow")).toHaveLength(2)
    expect(edges.filter((e) => e.data?.kind === "end")).toHaveLength(1)
  })

  it("every phase node's id equals its phase.slug (SC#3)", () => {
    const { nodes } = toCanvas(threePhase)
    expect(phaseNodes(nodes).map((n) => n.id)).toEqual(["draft", "confirm", "finalize"])
  })

  it("lays nodes out at col * PITCH_X on the single lane, cap one pitch past the last", () => {
    const { nodes } = toCanvas(threePhase)
    expect(phaseNodes(nodes).map((n) => n.position)).toEqual([
      { x: 0, y: CANVAS_LAYOUT.LANE_Y },
      { x: CANVAS_LAYOUT.PITCH_X, y: CANVAS_LAYOUT.LANE_Y },
      { x: 2 * CANVAS_LAYOUT.PITCH_X, y: CANVAS_LAYOUT.LANE_Y },
    ])
    const cap = nodes.find((n) => n.type === "endCap")
    expect(cap?.position).toEqual({ x: 3 * CANVAS_LAYOUT.PITCH_X, y: CANVAS_LAYOUT.LANE_Y })
  })

  it("is order-independent: a shuffled input yields byte-identical output", () => {
    const shuffled = [threePhase[2], threePhase[0], threePhase[1]]
    expect(JSON.stringify(toCanvas(shuffled))).toBe(JSON.stringify(toCanvas(threePhase)))
  })

  it("marks every phase node undraggable and gives it a button role + label", () => {
    const { nodes } = toCanvas(threePhase)
    for (const n of phaseNodes(nodes)) {
      expect(n.draggable).toBe(false)
      expect(n.ariaRole).toBe("button")
      expect(typeof n.ariaLabel).toBe("string")
      expect(n.ariaLabel?.length).toBeGreaterThan(0)
    }
    expect(phaseNodes(nodes)[0].ariaLabel).toBe(
      "Phase 1: Work out how to do it (llm_agent)",
    )
  })

  it("makes the end cap and any stub non-selectable, non-focusable, undraggable", () => {
    const { nodes } = toCanvas(unresolvable)
    for (const n of nodes.filter((x) => x.type !== "phase")) {
      expect(n.draggable).toBe(false)
      expect(n.selectable).toBe(false)
      expect(n.focusable).toBe(false)
    }
  })
})

describe("canvasModel.toCanvas — the C-2 index-lookup edge set (no phantom edge)", () => {
  it("phase_index [0,1,3] yields EXACTLY ONE sequential edge (0→1)", () => {
    const { edges } = toCanvas(nonContiguous)
    const flow = edges.filter((e) => e.data?.kind === "flow")
    expect(flow).toHaveLength(1)
    expect({ source: flow[0].source, target: flow[0].target }).toEqual({
      source: "a",
      target: "b",
    })
  })

  it("draws NO bridging edge across the gap — b→d must not exist", () => {
    const { edges } = toCanvas(nonContiguous)
    expect(edges.some((e) => e.source === "b" && e.target === "d")).toBe(false)
  })

  it("caps the flow at the MAXIMUM phase_index, leaving the pre-gap phase open", () => {
    const { edges } = toCanvas(nonContiguous)
    const end = edges.filter((e) => e.data?.kind === "end")
    expect(end).toHaveLength(1)
    expect(end[0].source).toBe("d")
    expect(edges.filter((e) => e.source === "b")).toHaveLength(0)
  })
})

describe("canvasModel.toCanvas — skip edges (D-183-10)", () => {
  it("a skip_to_phase naming an existing slug yields exactly one skip edge to it", () => {
    const { edges, nodes } = toCanvas(branching)
    const skips = edges.filter((e) => e.data?.kind === "skip")
    expect(skips).toHaveLength(1)
    expect(skips[0].source).toBe("assess")
    expect(skips[0].target).toBe("escalate")
    expect(nodes.filter((n) => n.type === "unresolvedSkip")).toHaveLength(0)
  })

  it("an unresolvable target yields a stub node AND an edge terminating on it", () => {
    const { nodes, edges } = toCanvas(unresolvable)
    const stubs = nodes.filter((n) => n.type === "unresolvedSkip")
    expect(stubs).toHaveLength(1)
    expect(stubs[0].data).toMatchObject({ declaredTarget: "nonexistent", fromSlug: "check" })

    const skips = edges.filter((e) => e.data?.kind === "skip")
    expect(skips).toHaveLength(1)
    expect(skips[0].source).toBe("check")
    expect(skips[0].target).toBe(stubs[0].id)
    // never an edge to the slug that does not exist
    expect(edges.some((e) => e.target === "nonexistent")).toBe(false)
  })

  it("the stub sits on the skip lane, half a pitch past its source column", () => {
    const { nodes } = toCanvas(unresolvable)
    const stub = nodes.find((n) => n.type === "unresolvedSkip")
    expect(stub?.position).toEqual({
      x: CANVAS_LAYOUT.PITCH_X + CANVAS_LAYOUT.PITCH_X / 2,
      y: CANVAS_LAYOUT.SKIP_LANE_Y,
    })
  })

  it("fail_run / ask_user / retry and a missing validators array yield no skip, no stub", () => {
    const { nodes, edges } = toCanvas(nonSkipDispositions)
    expect(edges.filter((e) => e.data?.kind === "skip")).toHaveLength(0)
    expect(nodes.filter((n) => n.type === "unresolvedSkip")).toHaveLength(0)
    expect(phaseNodes(nodes)).toHaveLength(4)
  })
})

describe("canvasModel.toCanvas — topology honesty", () => {
  it("llm_batch_agents renders as exactly ONE node (fan-out is runtime)", () => {
    const { nodes } = toCanvas(batchAgents)
    expect(phaseNodes(nodes)).toHaveLength(3)
    expect(phaseNodes(nodes).filter((n) => n.data.phaseType === "llm_batch_agents")).toHaveLength(1)
  })

  it("every emitted edge's source AND target resolve to an emitted node id", () => {
    for (const fixture of [threePhase, onePhase, nonContiguous, branching, unresolvable, batchAgents]) {
      const { nodes, edges } = toCanvas(fixture)
      const ids = new Set(nodes.map((n) => n.id))
      for (const e of edges) {
        expect(ids.has(e.source)).toBe(true)
        expect(ids.has(e.target)).toBe(true)
      }
    }
  })

  it("emits no duplicate node id and no duplicate edge id, even on repeated validators", () => {
    const repeated: PhaseSpecJSON[] = [
      { slug: "one", phase_index: 0, config: { phase_type: "llm_agent" } },
      {
        slug: "two",
        phase_index: 1,
        config: { phase_type: "llm_single" },
        validators: [
          { kind: "structure_check", on_failure: "skip_to_phase:ghost" },
          { kind: "freshness", on_failure: "skip_to_phase:ghost" },
          { kind: "citations_required", on_failure: "skip_to_phase:one" },
          { kind: "output_file_valid", on_failure: "skip_to_phase:one" },
        ],
      },
    ]
    const { nodes, edges } = toCanvas(repeated)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length)
  })

  it("keeps reserved ids clear of a slug that collides with the reserved namespace", () => {
    const colliding: PhaseSpecJSON[] = [
      { slug: "__canvas__end", phase_index: 0, config: { phase_type: "llm_single" } },
    ]
    const { nodes, edges } = toCanvas(colliding)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
    const cap = nodes.find((n) => n.type === "endCap")
    expect(cap?.id).not.toBe("__canvas__end")
    expect(edges[0].target).toBe(cap?.id)
  })
})

describe("canvasModel.toCanvas — node data (both title forms, always)", () => {
  it("carries the plain-language title AND the technical label · slug form", () => {
    const { nodes } = toCanvas(threePhase)
    const first = phaseNodes(nodes)[0]
    expect(first.data.title).toBe("Work out how to do it")
    expect(first.data.technicalTitle).toBe("AI agent step · draft")
    expect(first.data.subtitle).toBe("Searches and decides its own next move")
  })

  it("carries slug, phaseIndex, phaseType, grounded, armed and waitsForYou on every node", () => {
    const { nodes } = toCanvas(threePhase)
    for (const n of phaseNodes(nodes)) {
      expect(typeof n.data.slug).toBe("string")
      expect(typeof n.data.phaseIndex).toBe("number")
      expect(typeof n.data.phaseType).toBe("string")
      expect(typeof n.data.title).toBe("string")
      expect(typeof n.data.technicalTitle).toBe("string")
      // Phase 185 — the two governance booleans replace the three-face `grounding`
      // object. FLAT and always present: the seal (185-09) and the detour (185-10)
      // both read a boolean, and an absent key would make "not marked" and "not
      // resolved" indistinguishable on the face.
      expect(typeof n.data.grounded).toBe("boolean")
      expect(typeof n.data.armed).toBe("boolean")
      expect(n.data.grounding).toBeUndefined()
      expect(typeof n.data.waitsForYou).toBe("boolean")
    }
    const human = phaseNodes(nodes).find((n) => n.data.phaseType === "llm_human_input")
    expect(human?.data.waitsForYou).toBe(true)
    expect(phaseNodes(nodes)[0].data.waitsForYou).toBe(false)
  })

  it("gives an unknown phase_type an empty subtitle rather than inventing one", () => {
    const unknown: PhaseSpecJSON[] = [
      { slug: "weird", phase_index: 0, config: { phase_type: "future_type" } },
    ]
    const { nodes } = toCanvas(unknown)
    expect(phaseNodes(nodes)[0].data.subtitle).toBe("")
    expect(phaseNodes(nodes)[0].data.title).toBe("future_type")
  })

  it("an llm_emit at citation_policy 'strict' is grounded; a plain agent is not", () => {
    const emit: PhaseSpecJSON[] = [
      {
        slug: "emit",
        phase_index: 0,
        config: { phase_type: "llm_emit", citation_policy: "strict" },
        validators: [{ kind: "citations_required", on_failure: "fail_run" }],
      },
    ]
    expect(phaseNodes(toCanvas(emit).nodes)[0].data.grounded).toBe(true)
    expect(phaseNodes(toCanvas(threePhase).nodes)[0].data.grounded).toBe(false)
  })
})

// ── Phase 185 (GOVERN-01 / GOVERN-02 / GOVERN-03) — the two governance booleans ──
//
// The cause and its total order live in `phaseVocabulary.groundingCauseOf`, which the
// panel's dial reads through the same body. These cases pin what the PROJECTION does
// with it: which phases come out marked, and what an unread palette does.

describe("canvasModel.toCanvas — grounded / armed (Phase 185)", () => {
  /** An agent step that reads the knowledge base. `search_documents` is one of the
   *  five names the SERVER serves as `kb_tools`; the client never hardcodes them. */
  const kbAgent: PhaseSpecJSON[] = [
    {
      slug: "research",
      phase_index: 0,
      config: { phase_type: "llm_agent", available_tools: ["search_documents"] },
    },
  ]
  const SERVER_KB_TOOLS = ["search_documents"] as const

  it("a phase carrying a KB tool is grounded — cause DETECTED", () => {
    const { nodes } = toCanvas(kbAgent, { kbTools: SERVER_KB_TOOLS })
    expect(phaseNodes(nodes)[0].data.grounded).toBe(true)
  })

  it("a phase with only NON-KB tools is not grounded", () => {
    const other: PhaseSpecJSON[] = [
      {
        slug: "crunch",
        phase_index: 0,
        config: { phase_type: "llm_agent", available_tools: ["execute_code", "web_search"] },
      },
    ]
    expect(phaseNodes(toCanvas(other, { kbTools: SERVER_KB_TOOLS }).nodes)[0].data.grounded).toBe(false)
  })

  it("grounding_escalated marks a step with no tool at all — cause ESCALATED", () => {
    const escalated: PhaseSpecJSON[] = [
      { slug: "think", phase_index: 0, config: { phase_type: "llm_agent" }, grounding_escalated: true },
    ]
    expect(phaseNodes(toCanvas(escalated, { kbTools: SERVER_KB_TOOLS }).nodes)[0].data.grounded).toBe(true)
  })

  it("a stored escalation on a type that carries no dial is INERT (D-185-07)", () => {
    // The same bit on an `llm_single`. Detection can never apply there, so neither
    // can the author's escalation — the canvas must not claim a lock the panel does
    // not offer, or two surfaces one click apart disagree about one stored field.
    const inert: PhaseSpecJSON[] = [
      { slug: "write", phase_index: 0, config: { phase_type: "llm_single" }, grounding_escalated: true },
    ]
    expect(phaseNodes(toCanvas(inert, { kbTools: SERVER_KB_TOOLS }).nodes)[0].data.grounded).toBe(false)
  })

  it("action_risk_armed lands on the face as `armed`, and defaults to OFF", () => {
    const armed: PhaseSpecJSON[] = [
      { slug: "send", phase_index: 0, config: { phase_type: "llm_emit" }, action_risk_armed: true },
    ]
    expect(phaseNodes(toCanvas(armed).nodes)[0].data.armed).toBe(true)
    expect(phaseNodes(toCanvas(threePhase).nodes)[0].data.armed).toBe(false)
  })

  it("NO kbTools marks NOTHING — an unread palette never un-marks, and never invents", () => {
    // The same KB-reading phase, projected with the option omitted entirely. The safe
    // direction, stated as an executable case: the run-time gate is server-side and
    // unconditional, so under-marking is a display gap and over-marking would be a lie.
    expect(phaseNodes(toCanvas(kbAgent).nodes)[0].data.grounded).toBe(false)
    expect(phaseNodes(toCanvas(kbAgent, {}).nodes)[0].data.grounded).toBe(false)
    expect(phaseNodes(toCanvas(kbAgent, { kbTools: [] }).nodes)[0].data.grounded).toBe(false)
  })

  it("stays TOTAL on a hand-edited row whose available_tools is not an array", () => {
    const junk: PhaseSpecJSON[] = [
      { slug: "odd", phase_index: 0, config: { phase_type: "llm_agent", available_tools: "search_documents" } },
    ]
    expect(() => toCanvas(junk, { kbTools: SERVER_KB_TOOLS })).not.toThrow()
    expect(phaseNodes(toCanvas(junk, { kbTools: SERVER_KB_TOOLS }).nodes)[0].data.grounded).toBe(false)
  })
})

describe("canvasModel.toCanvas — serializable (the snapshot gate depends on it)", () => {
  it("survives a JSON round-trip unchanged and holds no function values", () => {
    const out = toCanvas(branching)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out)
    const walk = (v: unknown): void => {
      expect(typeof v).not.toBe("function")
      if (v && typeof v === "object") Object.values(v).forEach(walk)
    }
    walk(out)
  })
})

// ── 185-10 (GOVERN-03 / D-185-18) — edge.type and the armed detour state ────────
//
// `edge.type` was set on NONE of the four pushes before this plan, so these cases pin
// the two halves of D-185-18 that a pure function can prove: that ONLY flow edges moved
// onto our renderer, and that the checkpoint state rides on the edge running INTO the
// step rather than out of it.

/** Two adjacent steps where the SECOND one is armed. */
const armedSecond: PhaseSpecJSON[] = [
  { slug: "compose", phase_index: 0, config: { phase_type: "llm_single" } },
  {
    slug: "send",
    phase_index: 1,
    config: { phase_type: "llm_emit" },
    action_risk_armed: true,
  },
  { slug: "log", phase_index: 2, config: { phase_type: "programmatic" } },
]

const flowEdges = (edges: ReturnType<typeof toCanvas>["edges"]) =>
  edges.filter((e) => e.data?.kind === "flow")

describe("canvasModel.toCanvas — edge.type (D-185-18)", () => {
  it("sets type === 'flow' on every flow edge", () => {
    const flow = flowEdges(toCanvas(threePhase).edges)
    expect(flow.length).toBeGreaterThan(0)
    for (const edge of flow) expect(edge.type).toBe("flow")
  })

  it("leaves the SKIP edge without a type, so it keeps the library's default renderer", () => {
    const skips = toCanvas(branching).edges.filter((e) => e.data?.kind === "skip")
    expect(skips.length).toBeGreaterThan(0)
    for (const edge of skips) expect(edge.type).toBeUndefined()
  })

  it("leaves the END edge without a type, for the same reason", () => {
    const ends = toCanvas(threePhase).edges.filter((e) => e.data?.kind === "end")
    expect(ends).toHaveLength(1)
    expect(ends[0].type).toBeUndefined()
  })

  it("leaves the unresolvable-skip stub edge without a type", () => {
    const stubs = toCanvas(unresolvable).edges.filter((e) => e.data?.kind === "skip")
    expect(stubs.length).toBeGreaterThan(0)
    for (const edge of stubs) expect(edge.type).toBeUndefined()
  })
})

describe("canvasModel.toCanvas — the armed checkpoint rides the edge INTO the step", () => {
  it("marks the edge INTO an armed phase with armed: true", () => {
    const into = toCanvas(armedSecond).edges.find((e) => e.id === "seq:compose->send")
    expect(into).toBeDefined()
    expect(into!.data?.armed).toBe(true)
  })

  it("does NOT mark the edge OUT of an armed phase (the checkpoint is on the way IN)", () => {
    const outOf = toCanvas(armedSecond).edges.find((e) => e.id === "seq:send->log")
    expect(outOf).toBeDefined()
    expect(outOf!.data?.armed).not.toBe(true)
  })

  it("carries NO armed key at all on an unarmed neighbour's connector", () => {
    // The ABSENT third state, asserted as absence rather than as `false`: an ordinary
    // step declares no checkpoint, so its `data` object is byte-identical to the
    // pre-185 projection and the committed snapshot gains nothing on that edge.
    const outOf = toCanvas(armedSecond).edges.find((e) => e.id === "seq:send->log")
    expect(Object.keys(outOf!.data!)).toEqual(["kind"])
  })

  it("marks nothing when no phase is armed", () => {
    for (const edge of toCanvas(threePhase).edges) {
      expect(Object.keys(edge.data!)).toEqual(["kind"])
    }
  })
})
