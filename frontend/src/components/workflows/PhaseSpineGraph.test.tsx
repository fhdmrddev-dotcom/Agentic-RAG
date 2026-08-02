/**
 * Phase 103-04 Task 1 (REQ-4 / WFAUTH-03, sketch 019-D) — PhaseSpineGraph tests.
 *
 * The read-only VERTICAL phase-spine graph. These tests pin the locked contract:
 *  - nodes appear in strict phase_index order (DOM order asserted).
 *  - a `skip_to_phase:<slug>` validator renders EXACTLY ONE dashed edge landing on
 *    the resolved target node (the only non-linear edge).
 *  - STATIC drag-free check: ZERO draggable=true / drag handlers / connection-handle
 *    / add-node control anywhere in the DOM (the REQ-4 acceptance-c bar).
 *  - the "View only" badge + the legend + phase-type glyphs render; phase.name uses
 *    a non-empty fallback when absent.
 *  - the module never imports PhaseTimeline/PhaseCard (G-5 — source-grep assertion).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import {
  TechnicalNamesProvider,
  useTechnicalNames,
} from "@/providers/TechnicalNamesProvider"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way —
// typechecks under `vite/client`, no node:fs/process needed) for the G-5 grep.
import phaseSpineGraphSource from "./PhaseSpineGraph?raw"
import { PhaseSpineGraph } from "./PhaseSpineGraph"
import { nodeTitle, type NameContext, type PhaseSpecJSON } from "./phaseVocabulary"
// 187-09 lands as its OWN import statement rather than by widening the line above, so
// this file's whole 187-09 diff reads as added lines plus the two re-shaped assertions
// whose reasons are written at the assertions themselves (the 184-08 convention).
// `toCanvas` is imported for the card↔spine agreement check: the claim is that TWO
// SURFACES agree, so the comparison is against the canvas PROJECTION, not against a
// second call of the same pure function.
import { toCanvas } from "./canvasModel"

/**
 * The rendered title of one spine node.
 *
 * MODULE SCOPE since 187-09, hoisted verbatim out of the reveal block below rather than
 * copied into the new one: two spellings of a title reader is how two halves of one
 * suite start measuring different elements (the `SEAL_TEST_ID` lesson from
 * `PhaseNodeCard.test.tsx:86-89`).
 */
function titleOf(slug: string): string {
  return within(screen.getByTestId(`spine-node-${slug}`))
    .getByTestId("node-title")
    .textContent!.trim()
}

/** A 3-phase draft (intentionally OUT of phase_index order in the array to prove
 *  the component sorts; the rendered order must be 0,1,2 regardless of input order). */
const threePhases: PhaseSpecJSON[] = [
  {
    slug: "review",
    phase_index: 2,
    name: "Review the findings",
    config: { phase_type: "llm_agent", prompt: "review", available_tools: ["search_documents"] },
  },
  {
    slug: "gather",
    phase_index: 0,
    name: "Gather sources",
    config: { phase_type: "llm_agent", prompt: "gather", available_tools: ["search_documents"] },
  },
  {
    slug: "emit",
    phase_index: 1,
    // name intentionally ABSENT → the fallback must render. Since D-183-06 that
    // fallback is the plain-language sentence ("Produce the deliverable") with NO
    // slug in it. Until 187-09 the old "<type label> · <slug>" form was reachable HERE
    // behind the ⌥ reveal; D-187-16 stops the spine swapping its title, so the reveal
    // no longer changes this node's face at all — see the re-shaped block at the foot
    // of this file for why, and for where the technical form still lives (the CANVAS
    // card's subtitle slot, which the spine has no analogue of).
    config: { phase_type: "llm_emit", prompt: "emit", emitter: "render_template", citation_policy: "strict" },
  },
]

/** A draft whose phase 0 carries a `skip_to_phase:<slug>` on-fail validator → one
 *  dashed edge to the matched target node. */
const skipPhases: PhaseSpecJSON[] = [
  {
    slug: "gather",
    phase_index: 0,
    name: "Gather",
    config: { phase_type: "llm_agent", prompt: "g", available_tools: ["search_documents"] },
    validators: [{ kind: "freshness", on_failure: "skip_to_phase:human-confirm" }],
  },
  {
    slug: "draft",
    phase_index: 1,
    name: "Draft",
    config: { phase_type: "llm_single", prompt: "d" },
  },
  {
    slug: "human-confirm",
    phase_index: 2,
    name: "Confirm",
    config: { phase_type: "llm_human_input", prompt: "ok?" },
  },
]

describe("PhaseSpineGraph — read-only vertical spine", () => {
  it("renders one node per phase in strict phase_index order", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    const nodes = screen.getAllByRole("button", { name: /phase/i })
    expect(nodes).toHaveLength(3)
    // DOM order must be phase_index 0,1,2 → slugs gather, emit, review.
    const order = nodes.map((n) => n.getAttribute("data-slug"))
    expect(order).toEqual(["gather", "emit", "review"])
  })

  it("renders phase.name when present and a non-empty fallback when absent", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText("Gather sources")).toBeInTheDocument()
    expect(screen.getByText("Review the findings")).toBeInTheDocument()
    // The emit phase has no name → the fallback node still has a non-empty title.
    const emitNode = screen.getByTestId("spine-node-emit")
    const title = within(emitNode).getByTestId("node-title")
    expect(title.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    // …and with the reveal OFF that fallback carries no slug (D-183-06).
    expect(title.textContent).not.toContain("emit")
  })

  it("renders the 3D phase-type mark on each node card (data-phase-type + svg hooks)", () => {
    // Migrated from literal unicode assertions to the durable hooks the 127-01
    // migration established (PhaseSpine.test.tsx:38-55): the flat text glyphs this
    // file used to assert no longer render — the spine draws the bundled 3D marks.
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    // Scope to each node card so the bullet + card duplication doesn't skew counts.
    const gather = screen.getByTestId("spine-node-gather")
    const review = screen.getByTestId("spine-node-review")
    const emit = screen.getByTestId("spine-node-emit")
    expect(gather.getAttribute("data-phase-type")).toBe("llm_agent")
    expect(review.getAttribute("data-phase-type")).toBe("llm_agent")
    expect(emit.getAttribute("data-phase-type")).toBe("llm_emit")
    expect(gather.querySelector("svg")).not.toBeNull()
    expect(review.querySelector("svg")).not.toBeNull()
    expect(emit.querySelector("svg")).not.toBeNull()
  })

  it("renders a 'View only' badge and the read-only legend", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/view only/i)).toBeInTheDocument()
    expect(screen.getByText(/READ-ONLY GRAPH/i)).toBeInTheDocument()
    expect(screen.getByText(/inspect, don't drag/i)).toBeInTheDocument()
  })

  it("renders EXACTLY ONE dashed skip edge landing on the resolved target node", () => {
    render(<PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    const skipEdges = screen.getAllByTestId("skip-edge")
    expect(skipEdges).toHaveLength(1)
    // The target is resolved by slicing off the literal `skip_to_phase:` prefix BY
    // LENGTH — the backend's semantics (reachability.py:89-98), which the shared
    // parseSkipTarget now matches (correction C-1). This fixture's on_failure has no
    // extra colon, so the expected value is unchanged by that correction.
    expect(skipEdges[0].getAttribute("data-target-slug")).toBe("human-confirm")
  })

  it("renders NO skip edge when no validator carries skip_to_phase", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.queryAllByTestId("skip-edge")).toHaveLength(0)
  })

  it("calls onSelectNode with the phase slug on node click (selection only)", async () => {
    const onSelect = vi.fn()
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={onSelect} />)
    await user.click(screen.getByTestId("spine-node-gather"))
    expect(onSelect).toHaveBeenCalledWith("gather")
  })

  it("STATIC drag-free DOM: no draggable=true, no drag handler attrs, no connection-handle, no add-node control", () => {
    const { container } = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
    )
    // No draggable element.
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
    expect(container.querySelectorAll("[draggable]")).toHaveLength(0)
    // No connection handles / add-node controls (by data hook).
    expect(container.querySelectorAll('[data-connection-handle]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-add-node]')).toHaveLength(0)
    // No "add" / "+" build affordance buttons (the graph is inspect-only).
    const buttons = Array.from(container.querySelectorAll("button"))
    for (const b of buttons) {
      const label = (b.getAttribute("aria-label") ?? "") + (b.textContent ?? "")
      expect(label.toLowerCase()).not.toContain("add node")
    }
  })

  it("the selected node carries an open/selected affordance (selection anchor)", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug="gather" onSelectNode={vi.fn()} />)
    expect(screen.getByTestId("spine-node-gather").getAttribute("data-selected")).toBe("true")
    expect(screen.getByTestId("spine-node-review").getAttribute("data-selected")).toBe("false")
  })

  it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
    const src = phaseSpineGraphSource
    expect(src).not.toMatch(/PhaseTimeline/)
    expect(src).not.toMatch(/PhaseCard/)
    // No graph lib import either — the spine is plain HTML/CSS, and it must never
    // reach for the canvas library (@xyflow/react) that lands beside it in 183.
    expect(src).not.toMatch(/react-flow|reactflow|xyflow|\bd3\b|dagre/)
  })

  it("the SOURCE declares no second copy of the shared vocabulary (D-183-13, G-6)", () => {
    // The machine-checkable form of "no third copy exists at phase end". The glyph
    // map lives in soulData, the on-fail parse and the read shapes in
    // phaseVocabulary — this file imports all of them and declares none.
    const src = phaseSpineGraphSource
    expect(src).not.toMatch(/const PHASE_GLYPHS/)
    expect(src).not.toMatch(/const PHASE_TYPE_LABELS/)
    expect(src).not.toMatch(/(function|const)\s+parseSkipTarget/)
    expect(src).not.toMatch(/interface (PhaseSpecJSON|PhaseConfigJSON|ValidatorJSON)/)
    // The retired last-colon split is gone with it (correction C-1).
    expect(src).not.toMatch(/lastIndexOf/)
    // …and it really does import from the one shared home.
    expect(src).toMatch(/phaseVocabulary/)
    expect(src).toMatch(/soulData/)
  })
})

/**
 * Phase 183-04 Task 1 (D-183-06 / D-183-08) — the ⌥ technical names reveal,
 * RE-SHAPED by 187-09 Task 2 (SPEC Req 4 / D-187-16).
 *
 * WHAT THIS BLOCK USED TO SAY, and why it could not survive. 183-04 built the spine to
 * SWAP its title under the reveal, matching the canvas's swap, and this block asserted
 * that symmetry. 187-09 moves the canvas's reveal into the card's SUBTITLE slot, and
 * the spine has no subtitle slot to move into — so the two views can only stay in
 * agreement if the spine stops swapping. It does, and that is D-187-16.
 *
 * THE ASYMMETRY IS RECORDED, NOT DESIGNED AWAY. The spine's second and third elements
 * are a raw `phase_type` mono chip and a raw `phase_index` line, BOTH unconditional and
 * both present with the reveal OFF, and its `aria-label` carries the raw type as well.
 * So the technical vocabulary was never hidden on this surface in the first place, and
 * Req 4's "both graph views agree in both toggle states" is satisfied on the TITLE —
 * which is exactly what the SPEC's own acceptance criterion says. Adding a
 * subtitle consumer to the spine, or stripping its raw chrome, would both grow scope
 * into a second component's layout for no Req-4 gain.
 *
 * The G-6 tripwire ("Spine and Canvas disagree on a step's icon, title, or order") is
 * therefore guarded MORE strongly than before: the agreement is now asserted against
 * the canvas PROJECTION's own `data.title`, in both toggle states, rather than against
 * a hand-typed string that happened to match.
 */
describe("PhaseSpineGraph — ⌥ technical names reveal (D-183-06 / D-183-08 / D-187-16)", () => {
  /** Two UNNAMED phases — the dominant live shape, and two of them so "every node at
   *  once" is actually exercised.
   *
   *  (This comment used to read "only 10 of 119 phases are named". That figure is
   *  REFUTED: the 187 SPEC measured **0 of 57** phases across the 27 well-formed
   *  `workflow_definitions` rows — the other 145 rows store `definition` as a
   *  double-encoded JSON string no app read path can parse. The correction strengthens
   *  the point the fixture is making rather than weakening it: unnamed is not the
   *  dominant shape, it is the ONLY shape the shipped ladder ever saw.) */
  const unnamedPhases: PhaseSpecJSON[] = [
    { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent", prompt: "r" } },
    { slug: "m1", phase_index: 1, config: { phase_type: "llm_emit", prompt: "e" } },
  ]

  /** The shipped provider-driven harness idiom (lib/__tests__/termMap.test.tsx:138-164):
   *  a "flip" button calling the context's own toggle — never a second copy of the state. */
  function Harness() {
    const { toggle } = useTechnicalNames()
    return (
      <div>
        <PhaseSpineGraph phases={unnamedPhases} selectedSlug={null} onSelectNode={vi.fn()} />
        <button type="button" onClick={toggle}>
          flip
        </button>
      </div>
    )
  }

  beforeEach(() => {
    // The provider persists to localStorage; start every case from the plain default.
    window.localStorage.clear()
  })

  it("with the reveal OFF shows the plain-language sentence — no slug, no · separator", () => {
    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )
    expect(titleOf("retrieve")).toBe("Work out how to do it")
    expect(titleOf("retrieve")).not.toContain("retrieve")
    expect(titleOf("retrieve")).not.toContain("·")
    expect(titleOf("m1")).toBe("Produce the deliverable")
    expect(titleOf("m1")).not.toContain("m1")
    expect(titleOf("m1")).not.toContain("·")
  })

  it("flipping the reveal ON does NOT change the title on any node (D-187-16)", () => {
    // RE-SHAPED FROM "shows '<type label> · <slug>' on EVERY node at once", and the
    // re-shaping is the point rather than an erosion of it. That sentence is exactly
    // what Req 4 had to make false on this surface: the swap destroyed the plain title,
    // which 187-04's derived tier makes specific and worth keeping. What the old test
    // was really guarding — "one control flips every node at once, and the accessible
    // name tracks the visible one" — is guarded below in its stronger form: the titles
    // and the accessible names are asserted IDENTICAL across the flip, on every node,
    // and the technical vocabulary the reveal exists to expose is asserted still
    // present on this surface (the raw chip) rather than assumed gone.
    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )
    const before = ["retrieve", "m1"].map(titleOf)
    const labelsBefore = ["retrieve", "m1"].map(
      (slug) => screen.getByTestId(`spine-node-${slug}`).getAttribute("aria-label"),
    )

    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })

    expect(["retrieve", "m1"].map(titleOf)).toEqual(before)
    // Non-vacuity: the titles really are the plain-language sentences, so "unchanged"
    // is a statement about a face that exists rather than about two empty strings.
    expect(before).toEqual(["Work out how to do it", "Produce the deliverable"])
    // The accessible name tracks the visible one (WCAG 2.5.3 label-in-name) — which
    // now means it does not move either, because it is derived from the same resolved
    // title. The RAW `phase_type` is still inside it, exactly as it is with the reveal
    // off: this surface never hid the technical vocabulary.
    expect(
      ["retrieve", "m1"].map((slug) =>
        screen.getByTestId(`spine-node-${slug}`).getAttribute("aria-label"),
      ),
    ).toEqual(labelsBefore)
    expect(labelsBefore).toEqual([
      "Phase 1: Work out how to do it (llm_agent)",
      "Phase 2: Produce the deliverable (llm_emit)",
    ])
  })

  it("keeps its raw phase_type chip and phase_index line in BOTH toggle states", () => {
    // The spine's answer to "where did the technical names go?" — they were never
    // hidden here. This is the measured basis of D-187-16, asserted rather than
    // asserted-about: `:183-185` and `:187-189` are unconditional chrome.
    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )
    const readChrome = () => {
      const node = screen.getByTestId("spine-node-m1")
      return (node.textContent ?? "").trim()
    }
    const chromeBefore = readChrome()
    expect(chromeBefore).toContain("llm_emit")
    expect(chromeBefore).toContain("phase_index 1")

    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })

    expect(readChrome()).toBe(chromeBefore)
  })

  it("renders plain language and does NOT throw with no provider mounted at all", () => {
    expect(() =>
      render(
        <PhaseSpineGraph phases={unnamedPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
      ),
    ).not.toThrow()
    expect(titleOf("retrieve")).toBe("Work out how to do it")
    expect(titleOf("retrieve")).not.toContain("·")
  })
})

/**
 * ── 187-09 Task 2 (VOCAB-01 · SPEC Req 4 · D-187-05 / D-187-16) — THE NAME CONTEXT ──
 *
 * APPENDED, not woven in: everything above belongs to 103-04 and 183-04 and stays
 * theirs. Exactly TWO shipped assertions were re-shaped — the reveal swap, because Req 4
 * had to make it false, and the fixture comment that promised the swap — and the reason
 * for each is written at the assertion rather than here, where a later reader would not
 * find it.
 *
 * WHAT THIS BLOCK PROVES. 187-04 gave `nodeTitle` a second parameter: the page-owned
 * folder/skill id→name maps plus the definition's template filename. It is what lets a
 * step say what THAT step does. The canvas received it in 187-08; the spine receives it
 * here, so the two views one toggle apart cannot resolve different faces from the same
 * definition.
 *
 * THE AGREEMENT IS ASSERTED AGAINST THE PROJECTION, not against a second call of the
 * same function. `toCanvas(...).nodes[0].data.title` is the string the CARD paints, so
 * comparing the spine's rendered `node-title` against it compares two surfaces. A
 * `nodeTitle(p, ctx) === nodeTitle(p, ctx)` check would be a tautology dressed as a
 * contract.
 */
describe("PhaseSpineGraph — the injected name context (D-187-05)", () => {
  const FOLDER_ID = "0f2b7a44-8c31-4d0e-9a55-1c6f2c9d7e10"

  /** One unnamed `llm_agent` step scoped to a single folder — the shape that reaches
   *  187-04's derived tier, and the shape no shipped spine fixture carries. */
  const scopedPhases: PhaseSpecJSON[] = [
    {
      slug: "find-renewal-terms",
      phase_index: 0,
      config: {
        phase_type: "llm_agent",
        prompt: "find the renewal terms",
        available_tools: ["search_documents"],
        folder_scope: [FOLDER_ID],
      },
    },
  ]

  const ctx: NameContext = { folderNames: { [FOLDER_ID]: "Supplier Contracts" } }

  function ScopedHarness({ nameContext }: { nameContext?: NameContext }) {
    const { toggle } = useTechnicalNames()
    return (
      <div>
        <PhaseSpineGraph
          phases={scopedPhases}
          selectedSlug={null}
          onSelectNode={vi.fn()}
          nameContext={nameContext}
        />
        <button type="button" onClick={toggle}>
          flip
        </button>
      </div>
    )
  }

  beforeEach(() => {
    window.localStorage.clear()
  })

  it("threads the context into nodeTitle — the derived face reaches the spine", () => {
    render(
      <TechnicalNamesProvider>
        <ScopedHarness nameContext={ctx} />
      </TechnicalNamesProvider>,
    )
    expect(titleOf("find-renewal-terms")).toBe("Search Supplier Contracts")
  })

  it("OMITTING it renders exactly what HEAD rendered — the generic type sentence", () => {
    // The safe direction, stated as a test: an absent map makes the derived tier MISS
    // and falls through to the plain-language sentence, never to a raw UUID.
    render(
      <TechnicalNamesProvider>
        <ScopedHarness />
      </TechnicalNamesProvider>,
    )
    const title = titleOf("find-renewal-terms")
    expect(title).toBe("Work out how to do it")
    expect(title).toBe(nodeTitle(scopedPhases[0]))
    expect(title).not.toContain(FOLDER_ID)
  })

  it("the spine's title EQUALS the canvas card's, in BOTH toggle states", () => {
    // Req 4's headline claim, checked across the seam rather than within one module.
    const cardTitle = toCanvas(scopedPhases, { nameContext: ctx }).nodes[0].data.title
    expect(cardTitle).toBe(nodeTitle(scopedPhases[0], ctx))

    render(
      <TechnicalNamesProvider>
        <ScopedHarness nameContext={ctx} />
      </TechnicalNamesProvider>,
    )
    expect(titleOf("find-renewal-terms")).toBe(cardTitle)

    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })
    expect(titleOf("find-renewal-terms")).toBe(cardTitle)
  })

  it("leaves the raw chrome and the accessible name untouched by the toggle", () => {
    render(
      <TechnicalNamesProvider>
        <ScopedHarness nameContext={ctx} />
      </TechnicalNamesProvider>,
    )
    const node = () => screen.getByTestId("spine-node-find-renewal-terms")
    const labelBefore = node().getAttribute("aria-label")
    const textBefore = (node().textContent ?? "").trim()

    act(() => {
      screen.getByRole("button", { name: "flip" }).click()
    })

    expect(node().getAttribute("aria-label")).toBe(labelBefore)
    expect((node().textContent ?? "").trim()).toBe(textBefore)
    // The accessible name still carries the RAW `phase_type`, exactly as it ships.
    expect(labelBefore).toBe("Phase 1: Search Supplier Contracts (llm_agent)")
    expect(textBefore).toContain("llm_agent")
    expect(textBefore).toContain("phase_index 0")
  })

  it("the SOURCE stops swapping the title and spends the context in ONE place", () => {
    // The `?raw` house idiom, carrying the D-187-16 change as a machine-checkable fact.
    // Anchored on the SWAP EXPRESSION, not on the bare identifier, so this file's own
    // prose above may keep explaining what the spine used to do.
    expect(phaseSpineGraphSource).not.toMatch(/showTechnical \? technicalTitle/)
    // Positive control: the same regex matches the expression as it was shipped.
    expect("const t = showTechnical ? technicalTitle(phase) : nodeTitle(phase)").toMatch(
      /showTechnical \? technicalTitle/,
    )
    // The context reaches `nodeTitle` and nothing else: declared on the props, taken off
    // the props, and used once. Three occurrences, no fourth.
    expect(phaseSpineGraphSource).toMatch(/nodeTitle\(phase, nameContext\)/)
    expect((phaseSpineGraphSource.match(/nameContext/g) ?? []).length).toBe(3)
    // The raw chrome is still declared here — the fence is not passing because the
    // markup it guards disappeared.
    expect(phaseSpineGraphSource).toMatch(/phase\.config\.phase_type/)
    expect(phaseSpineGraphSource).toMatch(/phase_index \{/)
  })
})
