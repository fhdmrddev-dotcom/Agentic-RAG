/**
 * ⚠ RESTORED FROM `cd6f7b1d` ON 2026-08-20 — the Phase 200 canvas port re-baselined the
 * captures in this file, and the port is reverted.
 *
 * WHAT MOVED AND WHY IT MOVED BACK. The port replaced the node card's 137-B face (248px,
 * centre-aligned, a 62px 3D mark floating above its top edge) with sketch 200's compact
 * 240x72 row, and `CANVAS_LAYOUT.NODE_MIN_HEIGHT` (104 -> 72) and `EDGE_ANCHOR_Y` (28 -> 36)
 * moved with it. **The operator has since seen both faces rendered and chosen the 137-B
 * one**, so both constants go back and so do the captures derived from them.
 *
 * ⚠ THE CAPTURES HERE ARE THE PRE-PORT ONES, RE-INSTATED UNEDITED RATHER THAN RE-CAPTURED,
 * and they PASS. That is the strongest statement available: a pin nobody re-typed still
 * holds, so the revert reproduces the pre-port tree rather than merely satisfying a fresh
 * reading of itself.
 *
 * ⚠ THE PORT'S OWN RE-BASELINE WAS CAREFUL AND ITS RECORD IS AT `c4463d92`, not lost. Its
 * headline finding is worth carrying forward for whoever moves these constants next: the
 * delta across the twelve editing affordances was NOT uniform — the seven insert marks sit
 * on the connector and moved with `EDGE_ANCHOR_Y`, while the five remove marks hang off the
 * card's bottom and moved with `NODE_MIN_HEIGHT`. A blanket single-term edit made half the
 * rows right and half wrong by 40, and the suite said so immediately.
 */
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
// 189-15: the badge-slot-1 roster case derives its coverage from the shipped type order
// rather than hand-listing six names (the 189-10 / 189-12 lesson).
import { PHASE_TYPE_ORDER, minimalPhaseFor } from "./definitionOps"
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
      // Phase 189-13 — badge slot 1. Same rule as the two above: FLAT and always
      // present, so "not connected" and "not resolved" cannot look alike on the face.
      expect(typeof n.data.notConnected).toBe("boolean")
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

  it("WR-04: an INHERITED phase_type gets the same empty subtitle, not a function", () => {
    // ⚠ THIS SUBTITLE READ WAS UNGUARDED UNTIL 189-13 and was the ONLY read of
    // `PHASE_TYPE_SUBTITLES` outside its own declaration. The map is a plain object
    // literal, so `PHASE_TYPE_SUBTITLES["constructor"]` is the `Object` FUNCTION — never
    // nullish, so the shipped `?? ""` did NOT fire — and the measured consequence of the
    // identical defect one module along (`lib/phaseGlyph.tsx`, 188.1-04) was a function
    // object reaching `createElement` and hard-crashing the whole node face.
    //
    // The case above cannot see it: a table MISS behaves correctly and always did. Only an
    // inherited key distinguishes the guard from its absence, which is why this is a
    // separate case rather than another line in that one.
    for (const inherited of ["constructor", "toString", "__proto__", "valueOf"]) {
      const rows: PhaseSpecJSON[] = [
        { slug: "probe", phase_index: 0, config: { phase_type: inherited } },
      ]
      expect(() => toCanvas(rows)).not.toThrow()
      const data = phaseNodes(toCanvas(rows).nodes)[0].data
      expect(typeof data.subtitle).toBe("string")
      expect(data.subtitle).toBe("")
    }
    // Positive control: a REAL type still gets its real subtitle, so the guard narrowed
    // nothing it was not meant to.
    expect(phaseNodes(toCanvas(threePhase).nodes)[0].data.subtitle).toBe(
      "Searches and decides its own next move",
    )
  })

  it("notConnected lands on the face for external_action, and false everywhere else", () => {
    // D-12 / D-18 badge slot 1, through the projection real callers use. `buildPhaseData`
    // adds ONE delegating line; the rule itself lives in `phaseVocabulary.notConnectedOf`
    // so the panel and the canvas cannot drift apart.
    const external: PhaseSpecJSON[] = [
      { slug: "notify", phase_index: 0, config: { phase_type: "external_action", capability: "send_email" } },
    ]
    const data = phaseNodes(toCanvas(external).nodes)[0].data
    expect(data.notConnected).toBe(true)
    // The capability-derived face rides along on the same projection (D-13) — computed at
    // render, stored nowhere.
    expect(data.title).toBe("Sends an email")
    expect(data.subtitle).toBe("Stops for your approval before it acts outside")
    expect(data.technicalTitle).toBe("External action · notify")
    // …and every shipped type is untouched.
    for (const n of phaseNodes(toCanvas(threePhase).nodes)) {
      expect(n.data.notConnected).toBe(false)
    }
  })

  it("189-15: notConnected is false on EVERY shipped type, each named individually", () => {
    // The badge slot 1 spends is state-conditional, and the falsifiable half available
    // before Phase 190 is the TYPE half — so it is driven over the whole roster rather
    // than over the three types `threePhase` happens to contain. DERIVED from
    // `PHASE_TYPE_ORDER` through the app's own `minimalPhaseFor`, so the EIGHTH type joins
    // this assertion without anyone remembering to extend a list, and a RECORD comparison
    // is used rather than a loop so a failure names the offending type in the diff.
    const roster = PHASE_TYPE_ORDER.map((type, index) =>
      minimalPhaseFor(type, type.replace(/_/g, "-"), index),
    )
    const seen = Object.fromEntries(
      phaseNodes(toCanvas(roster).nodes).map((n) => [n.data.phaseType, n.data.notConnected]),
    )
    expect(seen).toEqual({
      programmatic: false,
      llm_single: false,
      llm_agent: false,
      llm_batch_agents: false,
      llm_human_input: false,
      llm_emit: false,
      external_action: true,
    })
    // Non-vacuity: the roster really did project one node per declared type.
    expect(Object.keys(seen)).toHaveLength(PHASE_TYPE_ORDER.length)
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

// ── Phase 187-08 (VOCAB-01 / D-187-05) — the injected name-lookup context ────────
//
// `toCanvas` gains an OPTIONAL `nameContext`, the `kbTools` shape verbatim: the id→name
// maps are owned by the PAGE, passed IN, and default to a frozen empty context. The
// derivation itself lives in `phaseVocabulary.derivedFaceOf` and has its own suite —
// what these cases pin is the pair of properties that make threading it safe.
//
//  1. AN OMITTED OPTION IS BYTE-IDENTICAL. Every shipped caller keeps its projection,
//     which is why no snapshot moves and why this plan touches no other file.
//  2. A SUPPLIED ONE MOVES THE TITLE AND NOTHING ELSE. Asserted FIELD BY FIELD against
//     the no-context projection rather than by snapshot: a snapshot would go red on any
//     change and tell you nothing about WHICH field moved, and "only the title moved"
//     is the whole claim.
//
// The `ariaLabel` is the one deliberate exception to (2) — it is derived FROM the title
// (`ariaLabelFor(phase, data.title)`), so a face that changes and a label that does not
// would be the screen-reader disagreement this phase exists to prevent.

describe("canvasModel.toCanvas — the injected name context (Phase 187 / D-187-05)", () => {
  const SKILL_ID = "3f2b8c40-1111-4a2b-9c3d-000000000001"
  const FOLDER_ID = "9a1e77d2-2222-4b3c-8d4e-000000000002"

  /** One step with a resolvable `skill_ref` and one bare step, so a hit and a miss are
   *  both inside the same projection. */
  const bound: PhaseSpecJSON[] = [
    { slug: "check", phase_index: 0, config: { phase_type: "llm_agent", skill_ref: SKILL_ID } },
    { slug: "write", phase_index: 1, config: { phase_type: "llm_single" } },
  ]

  const SKILL_CTX = { skillNames: { [SKILL_ID]: "pricing policy check" } }

  /** Every `data` key EXCEPT the title — the fields a name context must never move. */
  const UNMOVED_DATA_KEYS = [
    "slug",
    "phaseIndex",
    "phaseType",
    "technicalTitle",
    "subtitle",
    "grounded",
    "armed",
    "waitsForYou",
  ] as const

  it("omitting the option projects byte-identically to passing an empty one", () => {
    expect(toCanvas(bound)).toEqual(toCanvas(bound, {}))
    expect(JSON.stringify(toCanvas(bound))).toBe(JSON.stringify(toCanvas(bound, {})))
  })

  it("omitting it twice projects byte-identically — the default is a stable reference", () => {
    expect(JSON.stringify(toCanvas(bound))).toBe(JSON.stringify(toCanvas(bound)))
    expect(JSON.stringify(toCanvas(bound, { kbTools: ["search_documents"] }))).toBe(
      JSON.stringify(toCanvas(bound, { kbTools: ["search_documents"] })),
    )
  })

  it("kbTools WITHOUT a name context still renders the shipped type sentence", () => {
    // The pre-187 face, unchanged: a `skill_ref` nobody can resolve names nothing.
    const withKb = toCanvas(bound, { kbTools: ["search_documents"] })
    expect(phaseNodes(withKb.nodes)[0].data.title).toBe("Work out how to do it")
    expect(JSON.stringify(withKb)).toBe(JSON.stringify(toCanvas(bound, { kbTools: ["search_documents"] })))
  })

  it("a supplied context moves the resolving node's TITLE and no other data field", () => {
    const before = toCanvas(bound)
    const after = toCanvas(bound, { nameContext: SKILL_CTX })

    const b = phaseNodes(before.nodes)
    const a = phaseNodes(after.nodes)

    expect(b[0].data.title).toBe("Work out how to do it")
    expect(a[0].data.title).toBe("Run the pricing policy check")

    for (const key of UNMOVED_DATA_KEYS) {
      expect(a[0].data[key]).toEqual(b[0].data[key])
    }
    // The technical form is the SLUG and must stay the slug — the reveal is not a name.
    expect(a[0].data.technicalTitle).toBe("AI agent step · check")
    // The non-resolving step is untouched in every field, its title included.
    expect(a[1].data).toEqual(b[1].data)
  })

  it("the aria label follows the title, so the face and the announcement agree", () => {
    const after = toCanvas(bound, { nameContext: SKILL_CTX })
    expect(phaseNodes(after.nodes)[0].ariaLabel).toContain("Run the pricing policy check")
    expect(phaseNodes(after.nodes)[0].ariaLabel).not.toContain("Work out how to do it")
  })

  it("node ids, positions and the whole edge set are untouched by a name context", () => {
    const before = toCanvas(bound)
    const after = toCanvas(bound, { nameContext: SKILL_CTX })
    expect(after.nodes.map((n) => [n.id, n.type, n.position.x, n.position.y])).toEqual(
      before.nodes.map((n) => [n.id, n.type, n.position.x, n.position.y]),
    )
    expect(after.edges).toEqual(before.edges)
  })

  it("resolves a sole folder_scope through the SAME context, on the folder tier", () => {
    const scoped: PhaseSpecJSON[] = [
      { slug: "read", phase_index: 0, config: { phase_type: "llm_agent", folder_scope: [FOLDER_ID] } },
    ]
    const after = toCanvas(scoped, {
      nameContext: { folderNames: { [FOLDER_ID]: "Supplier Contracts" } },
    })
    expect(phaseNodes(after.nodes)[0].data.title).toBe("Search Supplier Contracts")
  })

  it("an unresolved id NEVER reaches the face — it falls through to the type sentence", () => {
    const after = toCanvas(bound, { nameContext: { skillNames: { "some-other-id": "x" } } })
    expect(phaseNodes(after.nodes)[0].data.title).toBe("Work out how to do it")
    expect(JSON.stringify(after)).not.toContain(SKILL_ID)
  })
})
