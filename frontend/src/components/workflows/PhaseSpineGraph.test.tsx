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
// 199-02: the locked 019-D legend, IMPORTED rather than re-typed, so the inventory pin at
// the foot of this file compares character-identity against the component's own exported
// constant instead of a second copy of it (the `186-16` rule). Its own import statement, so
// this plan's diff on this file reads as added lines only.
import { READ_ONLY_LEGEND, SPINE_ORDER_SENTENCE, spineFooterSentence } from "./PhaseSpineGraph"
// 200-05: the run tense's two artifacts, imported so the run-mount cases assert against the
// SAME words the component renders rather than against re-typed copies of them.
import { phaseRunFacts, type SpineRunTense } from "./phaseDuration"
import {
  BRANCH_NOT_TAKEN,
  BRANCH_TAKEN,
  OUTCOME_NEVER_RAN,
  TIME_NOT_RECORDED,
} from "./receiptVocabulary"

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

  it("renders a 'View only' badge and the plain-language order sentence", () => {
    // ⚠ RE-POINTED BY 200-05 (BS-MNR-01 / BS-MR-06), and the re-pointing is the deliverable.
    // The two legend assertions below used to read `getByText(/READ-ONLY GRAPH/i)` and
    // `getByText(/inspect, don't drag/i)`. That legend is machine vocabulary printed at a
    // business author, and it is now SUBTRACTED — so the assertions are INVERTED here rather
    // than deleted (the `192.2-05` method: a removal proved by a live assertion is one a
    // later re-add reddens, which a deleted assertion cannot do). Its replacement is the
    // plain-language pair, asserted in the same breath so this case still measures a header
    // that exists rather than a header that vanished.
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.getByText(/view only/i)).toBeInTheDocument()
    expect(screen.queryByText(/READ-ONLY GRAPH/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/inspect, don't drag/i)).not.toBeInTheDocument()
    expect(screen.getByTestId("graph-order-sentence").textContent).toBe(SPINE_ORDER_SENTENCE)
    expect(screen.getByTestId("graph-footer-count").textContent).toBe("3 steps, runs top to bottom")
  })

  it("the footer count sentence is DERIVED from the definition, person gates included", () => {
    // Both figures are counted from the phases in hand, so both are true before anything has
    // ever run — which is what makes them shippable on an authoring surface at all.
    render(<PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(screen.getByTestId("graph-footer-count").textContent).toBe(
      "3 steps, runs top to bottom, one person gate",
    )
    // ⚠ ZERO GATES OMITS THE CLAUSE rather than rendering `0 person gates` — an absent clause
    // says nothing, where a zero invites the reader to wonder what it counted (`threePhases`
    // has no `llm_human_input` step, asserted in the case above).
    expect(spineFooterSentence(1, 0)).toBe("1 step, runs top to bottom")
    expect(spineFooterSentence(4, 2)).toBe("4 steps, runs top to bottom, 2 person gates")
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
    // ⚠ RE-BASELINED BY 200-05 (BS-MNR-02). This pair read `(llm_agent)` / `(llm_emit)` — the
    // RAW `phase_type` inside the accessible name. An `aria-label` is not "invisible text": it
    // is the text a screen-reader user receives, so subtracting the visible chip while leaving
    // the schema token here would have removed it from sighted readers only. The label now
    // carries the CANVAS's word, and the property this case actually guards — the reveal moves
    // nothing, and the accessible name tracks the visible title (WCAG 2.5.3) — is unchanged.
    expect(labelsBefore).toEqual([
      "Phase 1: Work out how to do it (AI agent step)",
      "Phase 2: Produce the deliverable (Deliverable)",
    ])
  })

  it("the node face is IDENTICAL in both toggle states, and carries no raw id (200-05)", () => {
    // ⚠ RE-SHAPED FROM "keeps its raw phase_type chip and phase_index line in BOTH toggle
    // states", and the re-shaping is the deliverable rather than an erosion. That sentence was
    // the measured BASIS of D-187-16 — the spine never hid the technical vocabulary, so it had
    // nothing to lose by not swapping. 200-05's BS-MNR-02 / BS-MNR-03 SUBTRACT both atoms, so
    // the old assertions are INVERTED here rather than deleted, and the invariant the case
    // exists for — one control flips every node at once, and this surface's face does not move
    // — is asserted in its stronger form: the WHOLE face, byte-identical across the flip.
    render(
      <TechnicalNamesProvider>
        <Harness />
      </TechnicalNamesProvider>,
    )
    const readChrome = () => (screen.getByTestId("spine-node-m1").textContent ?? "").trim()
    const chromeBefore = readChrome()
    // The two subtracted atoms, proved absent by a live assertion.
    expect(chromeBefore).not.toContain("llm_emit")
    expect(chromeBefore).not.toContain("phase_index")
    // NON-VACUITY: the face still exists and still says what the step is, so the two refusals
    // above are statements about a node rather than about an empty string.
    expect(chromeBefore).toContain("Produce the deliverable")
    // …and the raw chip's REPLACEMENT is there: the canvas's own word for this type. It is
    // uppercased by CSS, never by a second string, so the DOM still carries one spelling.
    expect(
      within(screen.getByTestId("spine-node-m1")).getByTestId("node-type-word").textContent,
    ).toBe("Deliverable")

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
    // ⚠ RE-BASELINED BY 200-05 (BS-MNR-02 / BS-MNR-03), with the three original assertions
    // inverted below rather than dropped. The accessible name read
    // `(llm_agent)` and the face carried `llm_agent` plus `phase_index 0`; all three are
    // subtracted, and the property this case guards — the toggle moves NOTHING on this
    // surface — is untouched and is asserted two lines above, against the whole face.
    expect(labelBefore).toBe("Phase 1: Search Supplier Contracts (AI agent step)")
    expect(textBefore).not.toContain("llm_agent")
    expect(textBefore).not.toContain("phase_index")
    // NON-VACUITY: the face is real, so the two refusals are about a node and not a null.
    expect(textBefore).toContain("Search Supplier Contracts")
  })

  it("the SOURCE stops swapping the title and spends the context in ONE place", () => {
    // The `?raw` house idiom, carrying the D-187-16 change as a machine-checkable fact.
    //
    // ANCHORED ON THE ASSIGNMENT FORM, not on the swap expression alone. The component's
    // own comment must be free to QUOTE the line it replaced — that quotation is how a
    // later reader learns what the spine used to do — and a needle spelling only
    // `showTechnical ? technicalTitle` would then be findable in the prose, so the guard
    // could pass only by deleting the explanation. That is the D-ITEM-183-02 trap this
    // project has hit half a dozen times, and it fired HERE on the first run of this
    // test; the fix is a form only CODE can have.
    expect(phaseSpineGraphSource).not.toMatch(/const title = showTechnical/)
    // Positive control: the same regex matches the statement as it was shipped.
    expect("const title = showTechnical ? technicalTitle(phase) : nodeTitle(phase)").toMatch(
      /const title = showTechnical/,
    )
    // The reveal subscription itself is gone, because with the title no longer swapping
    // NOTHING this component renders depends on it — `tsc -b` and ESLint both refused the
    // dead read. Anchored on the CALL form so the docblock may still name the provider
    // when explaining that the app-wide state is untouched.
    expect(phaseSpineGraphSource).not.toMatch(/useTechnicalNamesOptional\(/)
    expect("const s = useTechnicalNamesOptional()?.showTechnical").toMatch(
      /useTechnicalNamesOptional\(/,
    )
    // The context reaches `nodeTitle` and NOTHING else. Counted on the ARGUMENT form
    // rather than on the bare identifier for the same reason as above: the component's
    // docblock and the prop's own JSDoc both name it in prose, and a bare-identifier
    // count would be measuring how much was written about it. (That is not
    // hypothetical — the first draft of this assertion counted 5 where it expected 3,
    // and all five were honest: two declarations, one call and two explanations.)
    expect(phaseSpineGraphSource).toMatch(/nodeTitle\(phase, nameContext\)/)
    expect((phaseSpineGraphSource.match(/nameContext\)/g) ?? []).length).toBe(1)
    // …declared exactly once on the props, and resolved by exactly one `nodeTitle` call.
    expect((phaseSpineGraphSource.match(/nameContext\?: NameContext/g) ?? []).length).toBe(1)
    expect((phaseSpineGraphSource.match(/nodeTitle\(/g) ?? []).length).toBe(1)
    // The type read is still declared here — the fence is not passing because the markup it
    // guards disappeared. ⚠ `phase.config.phase_type` now feeds `data-phase-type` and the
    // canvas-word lookup rather than a visible chip, which is BS-MNR-02's whole point: the id
    // survives where a machine needs it and dies where a person reads it.
    expect(phaseSpineGraphSource).toMatch(/phase\.config\.phase_type/)
    // ⚠ INVERTED BY 200-05 (BS-MNR-03). This read `toMatch(/phase_index \{/)` — the rendered
    // `phase_index {phase.phase_index}` label. The LABEL is subtracted; the FIELD is not, and
    // the next assertion is what keeps those two facts apart.
    expect(phaseSpineGraphSource).not.toMatch(/phase_index \{/)
    // ⚠ `phase_index` IS STILL READ — it is the ordering key, and subtracting the rendered
    // label must never be mistaken for dropping the sort. The `.sort()` comparator and the
    // 1-based ordinal in the accessible name both read it.
    expect(phaseSpineGraphSource).toMatch(/a\.phase_index - b\.phase_index/)
    expect(phaseSpineGraphSource).toMatch(/phase\.phase_index \+ 1/)
  })
})

/**
 * ── 199-02 Task 1 (DES-01 · sheet `c3-phase-spine`, Col 1) — THE PRE-CHANGE INVENTORY ──
 *
 * APPENDED, not woven in: everything above belongs to 103-04, 183-04 and 187-09 and stays
 * theirs. This block adds ZERO assertions to those and deletes none.
 *
 * WHY AN INVENTORY EXISTS AT ALL. This plan's binding claim is that the authoring spine
 * renders **no MORE at rest** than it did before — the sheet's two-line-per-node
 * description is a recorded drift of the "text is noise" rule, and the correct read is the
 * OPPOSITE of the drawing. A claim about "less" is only checkable against a measurement of
 * "before", so the resting face is pinned here as LITERAL STRINGS first, and a removal is
 * then proved by INVERTING an assertion rather than by deleting one (the `192.2-05` method).
 *
 * ⚠ THE LITERALS ARE READ OUT OF THE REAL RENDER, not composed from the source. A pin
 * assembled by re-typing the JSX would go green against a component that renders nothing at
 * all, which is the failure mode a characterization pin exists to refuse.
 */
describe("PhaseSpineGraph — 199-02 pre-change inventory (sheet c3 Col 1)", () => {
  /** The whole node face at rest — glyph (an svg, contributing no text) + title + raw
   *  type chip + raw index line, concatenated exactly as a reader receives them. */
  function faceOf(slug: string): string {
    return (screen.getByTestId(`spine-node-${slug}`).textContent ?? "").trim()
  }

  it("pins the HEADER chrome as three literal atoms — one of which is an engineering note", () => {
    const { container } = render(
      <PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />,
    )
    const header = container.querySelector("section > div")
    expect(header).not.toBeNull()

    // Atom 1 — the shipped cross-surface read-only vocabulary. `WorkflowCanvas.tsx:1000`
    // and `WorkflowRunPage.tsx:960` render the SAME two words, so this one is not this
    // component's to spend. It STAYS.
    expect(header!.textContent).toContain("👁 View only")

    // Atom 2 — ⚠ THE ATOM 199-02 SUBTRACTED. This assertion was committed as
    // `.toContain(...)` against the shipped tree one commit before the span was removed,
    // and it is INVERTED here rather than deleted — a removal proved by a live assertion
    // is a removal that a later re-add reddens, which a deleted assertion cannot do
    // (`192.2-05`). It stated how the component is IMPLEMENTED ("NET-NEW", "no graph
    // lib") to the person authoring a workflow, which is the adopted mindset's third rule
    // ("never name the mechanism to the user") failing on the widest column. Safe to
    // spend because a repo-wide grep measured ZERO other assertions on it.
    expect(header!.textContent).not.toContain("NET-NEW")
    expect(header!.textContent).not.toContain("no graph lib")
    // NON-VACUITY: the header still exists and still renders its one surviving atom, so
    // the two refusals above are statements about a header rather than about a null.
    expect((header!.textContent ?? "").trim()).toBe("👁 View only")

    // Atom 3 — ⚠ THE ATOM 200-05 SUBTRACTED, AND IT IS A DELIBERATE REVERSAL OF A PRIOR
    // DECISION. 199-02 left the locked 019-D legend standing and recorded why, verbatim:
    // *"it is a LOCKED SKETCH CONTRACT and it is asserted in four places … Re-opening it is a
    // phase, not a re-presentation."* This IS that phase. `200-CHECKLIST.md`'s `BS-MNR-01`
    // names it *"11px mono, visible at rest — the noisiest string in the product"*, and its
    // content is machine vocabulary (`phase_index`, `skip_to_phase`, `depends_on`) printed to
    // a business author at the top of the widest column — the same rule 199-02 spent this
    // header's other atom under. `DEC-199-02-F` is therefore REVERSED, on the record, in this
    // plan's SUMMARY.
    //
    // ⚠ THE SCAN IS OF THE RENDERED DOM, NOT THE SOURCE, and the checklist says so in
    // capitals. The identifier is still `export`ed, so a `?raw` source scan for those words
    // would go RED on the export while proving nothing about what a person sees — a
    // deliberate absence must not trip its own fence.
    expect(screen.queryByTestId("graph-legend")).not.toBeInTheDocument()
    expect(container.textContent ?? "").not.toContain(READ_ONLY_LEGEND)
    expect(container.textContent ?? "").not.toContain("READ-ONLY GRAPH")
    // NON-VACUITY, TWICE OVER. First: the constant survives and is non-trivial, so the two
    // refusals above are comparisons against a real string. Second: its REPLACEMENT renders,
    // so the header did not simply lose a paragraph.
    expect(READ_ONLY_LEGEND.length).toBeGreaterThan(80)
    expect(screen.getByTestId("graph-order-sentence").textContent).toBe(SPINE_ORDER_SENTENCE)
  })

  it("pins the RESTING node face of every node as an exact literal", () => {
    render(<PhaseSpineGraph phases={threePhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    // ⚠ RE-BASELINED BY 200-05, deliberately and exactly once. The three literals below read
    // `"Gather sourcesllm_agentphase_index 0"` and its siblings — the resolved title, the RAW
    // `phase_type` chip and the RAW `phase_index` line. `BS-MNR-02` and `BS-MNR-03` subtract
    // the last two and `BS-MR-02` puts the CANVAS's word where the raw id was, so this
    // characterization pin necessarily moves. It is re-captured ONCE, from the real render,
    // with the reason written here — the `doorVocabulary.ts` rule for the first wave that
    // intentionally changes a rendered word.
    //
    // ⚠ 2026-08-20 — THE REFUSAL RECORDED HERE IS RETIRED BY OPERATOR DECISION, and the
    // original wording is kept in this note rather than quietly deleted. This pin used to
    // read: "Still THREE atoms per node and still no fourth … There is NO description line,
    // which remains precisely the sheet element this surface refuses to import."
    //
    // That refusal was honoured for two phases, and it is the single largest reason the
    // shipped spine did not look like sketch 200: the sheet draws a plain-language reading on
    // EVERY row, and this surface was pinned against importing it. The operator's verdict on
    // the shipped result was that it is not what was designed, and their instruction is that
    // the sketch is the absolute reference. So the description line is now BUILT, sourced from
    // `PHASE_TYPE_SUBTITLES` — the CANVAS's own words, so the spine and the canvas still say
    // exactly one thing about a step rather than two.
    //
    // FOUR atoms per node now: title, description, type word, and — where the config declares
    // one — the model. `threePhases` declares no model on any step, so no model atom appears:
    // an absent model renders NOTHING rather than a default (N-6), and that is still asserted
    // as a face rather than as a prop.
    expect(faceOf("gather")).toBe(
      "Gather sourcesSearches and decides its own next moveAI agent step",
    )
    expect(faceOf("emit")).toBe(
      "Produce the deliverableFills your template and produces the fileDeliverable",
    )
    expect(faceOf("review")).toBe(
      "Review the findingsSearches and decides its own next moveAI agent step",
    )
  })

  it("BS-MR-01 — the model renders ONLY where the config declares one", () => {
    const withModel: PhaseSpecJSON[] = [
      { ...threePhases[1], config: { ...threePhases[1].config, model: "gpt-5-mini" } },
      { ...threePhases[2], config: { ...threePhases[2].config, model: "   " } },
    ]
    render(<PhaseSpineGraph phases={withModel} selectedSlug={null} onSelectNode={vi.fn()} />)
    expect(
      within(screen.getByTestId("spine-node-gather")).getByTestId("node-model").textContent,
    ).toBe("gpt-5-mini")
    // ⚠ A BLANK VALUE IS AN ABSENCE, NOT A NAME. An empty model means "use the run's model",
    // and N-6 is explicit that the sketch's `GPT-4o` is placeholder text — a default printed
    // here would be a fabricated claim about which model this step uses.
    expect(
      within(screen.getByTestId("spine-node-emit")).queryByTestId("node-model"),
    ).not.toBeInTheDocument()
  })

  it("the branch outcome reads as WORDS, never as line-style alone (must_have)", () => {
    render(<PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />)
    const edge = screen.getAllByTestId("skip-edge")[0]
    // The shipped edge already carries its meaning in words. The sheet's own requirement —
    // "a branch reads as a word, not colour alone" — is therefore ALREADY-SHIPPED here, and
    // pinning it is what stops a later re-skin quietly reducing it to a dashed amber rule.
    expect((edge.textContent ?? "").trim()).toBe("⤳on fail → skip to human-confirm")
    // Non-vacuity: the words survive with every class attribute stripped, so the claim is
    // about text and not about a colour that happens to spell one.
    const stripped = edge.cloneNode(true) as HTMLElement
    stripped.querySelectorAll("*").forEach((el) => el.removeAttribute("class"))
    stripped.removeAttribute("class")
    expect(stripped.textContent).toContain("on fail → skip to")
  })

  it("REFUSES a determinate mid-phase count anywhere in the authoring spine (sheet flaw 1)", () => {
    // Sheet c3 prints `Processing liability caps section (4/12)`. Nothing in this system
    // emits a within-a-step count, so drawing one is a promise we cannot keep. The refusal
    // is pinned as a fence rather than left to the summary's prose.
    const { container } = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug="gather" onSelectNode={vi.fn()} />,
    )
    const DETERMINATE = /\(\s*\d+\s*\/\s*\d+\s*\)/
    expect(container.textContent ?? "").not.toMatch(DETERMINATE)
    // POSITIVE CONTROL — the fence can actually find the shape it forbids, so the
    // assertion above is a measurement and not a regex that never matches anything.
    expect("Processing liability caps section (4/12)…").toMatch(DETERMINATE)
  })
})

/**
 * ── 200-05 Task 2 (DES-02 · `200-CHECKLIST.md` §2) — THE TWO TENSES ──────────────────────
 *
 * APPENDED, not woven in: everything above belongs to 103-04, 183-04, 187-09 and 199-02 and
 * stays theirs. The assertions this plan HAD to move are re-shaped in place, each with its
 * reason written at the assertion rather than here, where a later reader would not find it.
 *
 * WHAT THIS BLOCK PROVES. D-09 gives the spine a run tense through ONE optional prop, and the
 * whole safety of that design is the absent-prop render: `199-02` refused run-time words on
 * this component because it reads a DRAFT definition and has NO run, and that refusal is now
 * enforced BY CONSTRUCTION rather than remembered. Two halves are needed and neither is
 * sufficient alone —
 *
 *   1. ABSENT ⇒ BYTE-IDENTICAL. Compared as whole `innerHTML`, not as a handful of probes.
 *   2. PRESENT ⇒ A DIFFERENT DOM. Copied from `PhaseFormPanel.rails.test.tsx:125`, because a
 *      prop that changed nothing would pass (1) perfectly while being inert, and nothing else
 *      in this file would say so.
 */
describe("PhaseSpineGraph — the run tense (D-09 / BS-MR-03..05 / BS-MNR-05)", () => {
  const NOW = Date.parse("2026-08-19T14:22:00.000Z")

  /** A run in which `gather` ran, `draft` was routed around, and `human-confirm` is historic. */
  function tenseFor(over: Record<string, Record<string, unknown>> = {}): SpineRunTense {
    const rows = [
      {
        slug: "gather",
        status: "completed",
        started_at: "2026-08-19T14:00:00.000Z",
        completed_at: "2026-08-19T14:00:12.000Z",
        step_count: 312,
        step_noun: "sources",
      },
      { slug: "draft", status: "skipped", started_at: null, completed_at: null },
      { slug: "human-confirm", status: "completed", started_at: null, completed_at: null },
    ]
    const bySlug = new Map(
      rows.map((r) => [
        r.slug,
        { ...phaseRunFacts(r, "completed", NOW), ...(over[r.slug] ?? {}) },
      ]),
    )
    return { factsOf: (slug: string) => bySlug.get(slug), total: "Ran 4m 12s" }
  }

  it("⚠ BS-MNR-05 — WITHOUT the prop, the render is BYTE-IDENTICAL to the authoring one", () => {
    // The whole safety of the two-tense design, asserted as whole markup rather than probed.
    const a = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug="gather" onSelectNode={vi.fn()} />,
    )
    const withoutProp = a.container.innerHTML
    a.unmount()
    const b = render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug="gather"
        onSelectNode={vi.fn()}
        runTense={undefined}
      />,
    )
    expect(b.container.innerHTML).toBe(withoutProp)
    // NON-VACUITY: it is a real spine, not an empty container.
    expect(withoutProp.length).toBeGreaterThan(500)
  })

  it("⚠ BS-MNR-05 — the propless render carries NO duration, NO elapsed and NO run word", () => {
    // 199-02's refusal, now enforced. Every needle below is a word this component CAN emit
    // once the prop is supplied — which the cases further down prove — so none of them is a
    // regex that could never match anything.
    const { container } = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
    )
    const text = container.textContent ?? ""
    for (const needle of [
      OUTCOME_NEVER_RAN,
      TIME_NOT_RECORDED,
      BRANCH_TAKEN,
      BRANCH_NOT_TAKEN,
      "Ran 4m 12s",
      "312 sources",
      "so far",
    ]) {
      expect(text, `authoring mount leaked a run-tense word: ${needle}`).not.toContain(needle)
    }
    // A duration SHAPE, not just the specific words — `12s`, `2m 04s`, `1h 06m`.
    expect(text).not.toMatch(/\b\d+(s|m \d{2}s|h \d{2}m)\b/)
    // And none of the run-tense DOM hooks exists at all.
    for (const id of [
      "spine-total-runtime",
      "node-run-reading",
      "node-run-time",
      "node-run-count",
      "skip-edge-reading",
    ]) {
      expect(screen.queryAllByTestId(id)).toHaveLength(0)
    }
  })

  it("⚠ the prop is LOAD-BEARING — the absent and present renders are NOT the same DOM", () => {
    // `PhaseFormPanel.rails.test.tsx:125`'s assertion, copied for its reason: without it the
    // byte-identity case above would pass just as well against a prop that did nothing.
    const a = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
    )
    const absent = a.container.innerHTML
    a.unmount()
    const b = render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor()}
      />,
    )
    expect(b.container.innerHTML).not.toBe(absent)
  })

  it("BS-MR-04 / BS-MR-05 — WITH the prop, a real duration and the total runtime appear", () => {
    render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor()}
      />,
    )
    expect(screen.getByTestId("spine-total-runtime").textContent).toBe("Ran 4m 12s")
    expect(
      within(screen.getByTestId("spine-node-gather")).getByTestId("node-run-time").textContent,
    ).toBe("12s")
  })

  it("⚠ D-06 on the spine — `never ran` and `time not recorded` are DIFFERENT readings", () => {
    render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor()}
      />,
    )
    const routedAround = within(screen.getByTestId("spine-node-draft"))
      .getByTestId("node-run-time")
      .textContent
    const historic = within(screen.getByTestId("spine-node-human-confirm"))
      .getByTestId("node-run-time")
      .textContent
    expect(routedAround).toBe(OUTCOME_NEVER_RAN)
    expect(historic).toBe(TIME_NOT_RECORDED)
    expect(routedAround).not.toBe(historic)
  })

  it("D-07 on the spine — a declared count renders; a step that declared none renders NO slot", () => {
    render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor()}
      />,
    )
    expect(
      within(screen.getByTestId("spine-node-gather")).getByTestId("node-run-count").textContent,
    ).toBe("312 sources")
    // ⚠ NOTHING AT ALL — never `0`, never a dash, never prose (D-07 / SEED-159 / N-8).
    const draft = within(screen.getByTestId("spine-node-draft"))
    expect(draft.queryByTestId("node-run-count")).not.toBeInTheDocument()
    expect(draft.getByTestId("node-run-reading").textContent).not.toContain("0")
    expect(draft.getByTestId("node-run-reading").textContent).not.toContain("—")
  })

  it("D-07 — a DECLARED `0` renders as the fact it is", () => {
    render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor({ gather: { count: { count: 0, noun: "sources" } } })}
      />,
    )
    expect(
      within(screen.getByTestId("spine-node-gather")).getByTestId("node-run-count").textContent,
    ).toBe("0 sources")
  })

  it("BS-MR-03 — the branch reading is a THREE-state read, not a boolean", () => {
    const taken = render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor({ gather: { branchTaken: true } })}
      />,
    )
    expect(screen.getByTestId("skip-edge-reading").textContent).toBe(BRANCH_TAKEN)
    expect(screen.getByTestId("skip-edge-reading").getAttribute("data-branch-reading")).toBe(
      "traversed",
    )
    taken.unmount()

    // Not taken — a DIFFERENT reading, never the same word in a different colour.
    const notTaken = render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor({ gather: { branchTaken: false } })}
      />,
    )
    expect(screen.getByTestId("skip-edge-reading").textContent).toBe(BRANCH_NOT_TAKEN)
    expect(screen.getByTestId("skip-edge-reading").getAttribute("data-branch-reading")).toBe(
      "skipped",
    )
    notTaken.unmount()

    // ⚠ ABSENT — the caller does not hold the fact, so NOTHING renders. This is the third
    // state a boolean cannot express, and rendering `branch not taken` here would be a claim
    // about a run nobody measured.
    render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor()}
      />,
    )
    expect(screen.queryByTestId("skip-edge-reading")).not.toBeInTheDocument()
    // NON-VACUITY: the edge itself is still there, so the refusal is about a reading.
    expect(screen.getAllByTestId("skip-edge")).toHaveLength(1)
  })

  it("a slug the run never mentioned renders NO run tense — absence is not a fact", () => {
    render(
      <PhaseSpineGraph
        phases={threePhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={tenseFor()}
      />,
    )
    // `threePhases`' slugs are gather / emit / review; the fixture run knows only `gather`.
    expect(
      within(screen.getByTestId("spine-node-gather")).getByTestId("node-run-reading"),
    ).toBeInTheDocument()
    for (const slug of ["emit", "review"]) {
      expect(
        within(screen.getByTestId(`spine-node-${slug}`)).queryByTestId("node-run-reading"),
      ).not.toBeInTheDocument()
    }
  })
})

/**
 * ── 200-05 Task 3 (DES-02 · `200-CHECKLIST.md` §2.2) — THE `MUST NOT RENDER` FENCE ───────
 *
 * ⚠ A `MUST NOT RENDER` FENCE THAT CANNOT FIRE IS NOT A FENCE, and this repo has TWO
 * independent measurements of exactly that failure. `199-03` planted a live
 * `<a href="/publish?force=1">Proceed to publish anyway</a>` inside a shipped hard wall and
 * watched BOTH guards pass GREEN — a `?raw` source regex could not see a control composed
 * from a variable, and a `queryAllByRole("button")` filter could not see a LINK. Only a
 * role-SET scan went red. Wave 3 hit the other shape: a fence was reached and still wrote
 * nothing, because its fixture queue was empty. So this fence:
 *
 *   • scans the RENDERED DOM, never the source. `BS-MNR-01` says so in capitals, and the
 *     reason is structural: `READ_ONLY_LEGEND` is still `export`ed, so a source scan would go
 *     RED on the export while proving nothing about what a person sees — a deliberate absence
 *     must not trip its own fence;
 *   • reads announced text as well as visible text (`aria-label`, `title`, `alt`,
 *     `placeholder`), because an `aria-label` carrying a schema token would have removed the
 *     chip from sighted readers only;
 *   • sweeps a ROLE SET (`a[href]`, `button`, `[role]`) rather than filtering buttons, which
 *     is the one predicate 199-03 measured as able to fire;
 *   • carries TWO PERMANENT NON-VACUITY CONTROLS — a fixture that renders all three atoms and
 *     is asserted to be CAUGHT, and the honest shipped render asserted CLEAN. Without the
 *     first, every negative could pass against a predicate that matches nothing.
 *
 * ⚠ AND IT WAS DRIVEN AGAINST THE REAL COMPONENT. A violation was planted in
 * `PhaseSpineGraph.tsx` itself — the legend restored to the header, the raw `phase_type` chip
 * restored to the node face, and the `phase_index N` line restored beneath it — the fence
 * observed RED naming all three row ids, and the source then restored byte-exactly
 * (`git diff --numstat` → empty). A fence nobody drove is a fence nobody built. The result is
 * recorded in `200-05-SUMMARY.md`.
 *
 * ⚠ SITING — A DECLARED DEVIATION. The plan lists this fence under Task 3's files, whose
 * `<files>` names `RunReceipt.test.tsx`. It lives HERE instead, in the suite of the component
 * it actually guards, because a fence sited in an unrelated suite is one nobody re-reads when
 * the guarded component changes — which is how the four ledger rows this phase had to ADD
 * went missing in the first place. Recorded in the SUMMARY rather than done quietly.
 */
describe("PhaseSpineGraph — the §2.2 MUST NOT RENDER fence", () => {
  /**
   * Everything a person can READ or HEAR from this subtree: visible text, plus the announced
   * text a screen reader receives. ⚠ It deliberately does NOT read `data-*` attributes:
   * `data-phase-type` and `data-branch-reading` are machine hooks this plan KEEPS on purpose,
   * and a scan that could not tell a hook from a label would forbid the wrong thing.
   */
  function readableText(container: HTMLElement): string {
    const chunks: string[] = [container.textContent ?? ""]
    for (const el of Array.from(container.querySelectorAll("*"))) {
      for (const attr of ["aria-label", "title", "alt", "placeholder", "aria-description"]) {
        const v = el.getAttribute(attr)
        if (v) chunks.push(v)
      }
    }
    // ⚠ THE ROLE SET, not a button filter — 199-03's measured lesson. A violation smuggled in
    // as a link, or as any element carrying an explicit role, is invisible to a button scan.
    for (const el of Array.from(container.querySelectorAll("a[href], button, [role]"))) {
      chunks.push(el.textContent ?? "", el.getAttribute("aria-label") ?? "")
    }
    return chunks.join("   ")
  }

  /** The seven raw `phase_type` ids — `BS-MNR-02` forbids any of them as visible text. */
  const RAW_TYPE_IDS = [
    "programmatic",
    "llm_single",
    "llm_agent",
    "llm_batch_agents",
    "llm_human_input",
    "llm_emit",
    "external_action",
  ]

  /**
   * N-5's Material Symbols ligature names. ⚠ SPLIT INTO TWO CLASSES ON PURPOSE. The
   * snake_case ones are unambiguous and are matched anywhere in the text. The single words
   * (`search`, `person`, `info`, `add`, `output`, `description`, `psychology`) are ordinary
   * English — the spine's own footer legitimately contains `person gate` — so those are
   * matched only where an element's ENTIRE trimmed text is the ligature, which is exactly how
   * one renders (`<span class="material-symbols">search</span>`). A needle that fired on
   * honest prose would be worse than no needle at all.
   */
  const LIGATURES_SNAKE = [
    "chat_bubble", "account_tree", "check_circle", "chevron_right", "health_and_safety",
    "add_circle", "arrow_back", "account_circle", "priority_high", "fit_screen", "save_as",
  ]
  const LIGATURES_WORD = [
    "search", "person", "info", "add", "output", "description", "psychology", "bolt",
    "folder", "lock", "shield", "close", "error", "sync", "summarize", "widgets", "remove",
    "warning", "menu", "settings", "check", "category", "dataset", "policy",
  ]

  /** Every §2.2 row this predicate can find, by its checklist id. */
  function spineViolations(container: HTMLElement): string[] {
    const text = readableText(container)
    const found: string[] = []
    if (/READ-ONLY GRAPH|inspect, don't drag|skip_to_phase\)|depends_on/.test(text)) {
      found.push("BS-MNR-01")
    }
    // ⚠ A BARE `includes`, AND THE WORD-BOUNDARY VERSION IS THE BUG. The first draft used
    // `(^|[^\w-])<id>([^\w-]|$)` and MISSED a real planted chip, because adjacent DOM text
    // nodes concatenate without a separator — `<span>Gather sources</span><span>llm_agent</span>`
    // reads as `Gather sourcesllm_agent`, so the id is preceded by a word character. These are
    // schema tokens that appear in no product sentence, so containment is both sufficient and
    // the only form that can actually fire. Found by the positive control, which is the whole
    // reason it is permanent.
    if (RAW_TYPE_IDS.some((id) => text.includes(id))) found.push("BS-MNR-02")
    if (/phase_index\s*\d+/.test(text)) found.push("BS-MNR-03")
    if (/Confirm the QBR before rendering|Fill the QBR template/.test(text)) {
      found.push("BS-MNR-04")
    }
    if (LIGATURES_SNAKE.some((l) => text.includes(l))) found.push("BS-MNR-06")
    else {
      const exact = Array.from(container.querySelectorAll("*")).some((el) =>
        el.children.length === 0 && LIGATURES_WORD.includes((el.textContent ?? "").trim()),
      )
      if (exact) found.push("BS-MNR-06")
    }
    return found
  }

  /** ⚠ PERMANENT NON-VACUITY CONTROL 1 — the predicate really finds what it forbids. */
  it("POSITIVE CONTROL — a planted violation is CAUGHT, and all three atoms are named", () => {
    const { container } = render(
      <section aria-label="planted">
        <p>{READ_ONLY_LEGEND}</p>
        <button type="button">
          <span>Gather sources</span>
          <span>llm_agent</span>
        </button>
        <span>phase_index 3</span>
      </section>,
    )
    const found = spineViolations(container)
    expect(found).toContain("BS-MNR-01")
    expect(found).toContain("BS-MNR-02")
    expect(found).toContain("BS-MNR-03")
    expect(found.length).toBeGreaterThanOrEqual(3)
  })

  it("POSITIVE CONTROL — it also catches a violation smuggled into a LINK's announced text", () => {
    // 199-03's exact failure mode: a `queryAllByRole("button")` filter cannot see a link, and
    // a source regex cannot see a control composed from a variable. The role SET can see both.
    const { container } = render(
      <section aria-label="planted-2">
        <a href="/x" aria-label="phase_index 7 — jump">
          jump
        </a>
      </section>,
    )
    expect(spineViolations(container)).toContain("BS-MNR-03")
  })

  it("POSITIVE CONTROL — a Material Symbols ligature is caught in BOTH of its shapes", () => {
    const snake = render(
      <section aria-label="planted-3">
        <span className="material-symbols">chat_bubble</span>
      </section>,
    )
    expect(spineViolations(snake.container)).toContain("BS-MNR-06")
    snake.unmount()
    const word = render(
      <section aria-label="planted-4">
        <span className="material-symbols">search</span>
      </section>,
    )
    expect(spineViolations(word.container)).toContain("BS-MNR-06")
  })

  it("⚠ NEGATIVE CONTROL — the honest single word `person` in prose does NOT fire", () => {
    // The spine's own footer reads `…, one person gate`. A needle that forbade that sentence
    // would make this fence unusable, and an unusable fence gets loosened rather than obeyed.
    const { container } = render(
      <section aria-label="honest">
        <p>3 steps, runs top to bottom, one person gate</p>
      </section>,
    )
    expect(spineViolations(container)).toEqual([])
  })

  /** ⚠ PERMANENT NON-VACUITY CONTROL 2 — the honest shipped copy is CLEAN. */
  it("the SHIPPED authoring render trips NOTHING in §2.2", () => {
    const { container } = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug="gather" onSelectNode={vi.fn()} />,
    )
    expect(spineViolations(container)).toEqual([])
    // NON-VACUITY: a real spine with three nodes and an on-fail edge, not an empty container.
    expect(screen.getAllByTestId(/^spine-node-/)).toHaveLength(3)
    expect(screen.getAllByTestId("skip-edge")).toHaveLength(1)
  })

  it("the shipped RUN-TENSE render trips nothing either — a second tense is a second surface", () => {
    const NOW = Date.parse("2026-08-19T14:22:00.000Z")
    const facts = phaseRunFacts(
      {
        slug: "gather",
        status: "completed",
        started_at: "2026-08-19T14:00:00.000Z",
        completed_at: "2026-08-19T14:00:12.000Z",
        step_count: 312,
        step_noun: "sources",
      },
      "completed",
      NOW,
    )
    const { container } = render(
      <PhaseSpineGraph
        phases={skipPhases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        runTense={{
          factsOf: (slug: string) => (slug === "gather" ? { ...facts, branchTaken: true } : undefined),
          total: "Ran 4m 12s",
        }}
      />,
    )
    expect(spineViolations(container)).toEqual([])
    // NON-VACUITY: the run tense really did render, so this is a clean READING and not a
    // clean absence — the wave-3 failure shape (a fence reached with an empty queue).
    expect(screen.getByTestId("spine-total-runtime").textContent).toBe("Ran 4m 12s")
    expect(screen.getByTestId("skip-edge-reading")).toBeInTheDocument()
  })

  it("the `data-*` machine hooks are DELIBERATELY not swept — a hook is not a label", () => {
    const { container } = render(
      <PhaseSpineGraph phases={skipPhases} selectedSlug={null} onSelectNode={vi.fn()} />,
    )
    // The raw id survives where a machine needs it…
    expect(
      screen.getByTestId("spine-node-gather").getAttribute("data-phase-type"),
    ).toBe("llm_agent")
    // …and the fence is still clean, because that attribute is not text anyone reads.
    expect(spineViolations(container)).toEqual([])
  })
})
