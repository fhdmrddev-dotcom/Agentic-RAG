/**
 * Phase 187-09 Task 1 (VOCAB-01 / SPEC Req 4, D-187-06 / D-187-16, sketch 149-C) —
 * PhaseNode adapter tests.
 *
 * WHAT THIS SUITE IS FOR. `PhaseNode` is a `NodeProps` → slots ADAPTER over
 * `PhaseNodeCard` (D-184-06). The card's own suite already pins what the card PAINTS;
 * this one pins the one decision the adapter makes — WHICH resolved string lands in
 * WHICH slot when the ⌥ Technical-names reveal is on. That decision had no suite of
 * its own before 187-09, which is why the reveal could destroy the title unnoticed.
 *
 * THE CLAIM UNDER TEST (sketch 149-C). The shipped reveal was a title SWAP:
 * `title = technical ? technicalTitle : title`. That was cheap while the plain title
 * was the generic "Work out how to do it"; 187-04's config-derived tier makes it
 * SPECIFIC, so the same swap now destroys real meaning — and it truncates the one
 * token the reveal exists to show, because the title slot is `truncate` at 14px in a
 * 248px card while the subtitle slot wraps. Req 4 therefore moves the reveal into the
 * SUBTITLE slot: the plain title survives and the whole slug reaches the DOM.
 *
 * HOW THE TITLE EQUALITY IS ASSERTED, and why not against a literal. The acceptance
 * criterion is an EQUALITY — *"with the reveal ON the card title equals its reveal-OFF
 * title"* — so it is asserted as one, over two renders captured in the SAME test. A
 * hand-typed expected string would pin whatever the author believed the derived tier
 * resolves to, and would keep passing if BOTH renders changed together.
 *
 * THE HARNESS IS THE SHIPPED ONE, not a new one. `mockReactFlow()` plus a real
 * `<ReactFlow>` carrying the `nodeTypes` map is the `FlowEdge.test.tsx:80-157`
 * precedent, and the nodes come from `toCanvas()` rather than being hand-built, so the
 * adapter is exercised over the REAL projection — the same `data` object production
 * hands it. The reveal is merged onto `data` exactly as the shell does at
 * `WorkflowCanvas.tsx:949`, because the reveal riding on `data` is what keeps this leaf
 * free of a second technical-names state.
 *
 * `PhaseNodeCard.tsx` IS NOT MODIFIED BY THE PLAN THIS SUITE GUARDS, and two of its
 * invariants are why: a third badge is a typecheck error (`BadgeSlots` is a max-2 tuple
 * union) and no focusable control may live inside the card. Both are asserted below in
 * BOTH toggle states, so a reveal change cannot quietly spend either budget.
 */
import { describe, it, expect } from "vitest"
import { render, waitFor } from "@testing-library/react"
import { ReactFlow, type Node } from "@xyflow/react"

// FILE-LOCAL, never `setupTests.ts` — the `WorkflowCanvas.test.tsx:26-29` rule: the
// helper mutates `HTMLElement.prototype` and a global install would perturb every suite.
import { mockReactFlow } from "@/test-utils/mockReactFlow"
// The adapter SOURCE via Vite's `?raw` loader — the `canvasModel.purity.test.ts:14-17`
// house idiom for a scope fence that must be machine-checkable.
import phaseNodeSource from "./PhaseNode?raw"
import { EndCapNode, PhaseNode, UnresolvedSkipNode } from "./PhaseNode"
import { CANVAS_NODE_TYPES, toCanvas } from "./canvasModel"
import { PHASE_TYPE_SUBTITLES, type NameContext, type PhaseSpecJSON } from "./phaseVocabulary"

mockReactFlow()

// ── The fixture ─────────────────────────────────────────────────────────────────

/**
 * A realistic supplier-renewal draft, hand-authored here rather than taken from
 * `__fixtures__/canvasFixtures.ts` for one reason the shipped fixtures cannot supply:
 * Req 4's whole argument is that the reveal now destroys a SPECIFIC title, so at least
 * one step must reach 187-04's config-derived tier. That needs a `folder_scope` or a
 * `skill_ref` AND an injected `NameContext` to resolve it, which no shipped canvas
 * fixture carries.
 *
 * The slugs are deliberately LONG. `find-renewal-terms` is the exact slug sketch 149
 * measured the truncation on (`AI agent step · find-renewal-t…`), so the "full slug in
 * the DOM" assertion below is made against the string that motivated the change rather
 * than against a short one the title slot would have fitted anyway.
 */
const FOLDER_ID = "0f2b7a44-8c31-4d0e-9a55-1c6f2c9d7e10"
const SKILL_ID = "9d31c6b2-7a04-4f18-8e2b-55c7a1f0b3d9"

const renewalDraft: PhaseSpecJSON[] = [
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
  {
    slug: "apply-pricing-policy",
    phase_index: 1,
    config: { phase_type: "llm_single", prompt: "apply the pricing policy", skill_ref: SKILL_ID },
  },
  {
    slug: "confirm-with-owner",
    phase_index: 2,
    config: { phase_type: "llm_human_input", prompt: "ok to send?" },
  },
]

/** The page-owned id→name maps (D-187-05). Without these the derived tier MISSES and
 *  the generic type sentence renders — which is the safe direction, and is exercised
 *  by its own case at the foot of this file. */
const nameContext: NameContext = {
  folderNames: { [FOLDER_ID]: "Supplier Contracts" },
  skillNames: { [SKILL_ID]: "pricing policy check" },
}

// ── The harness ─────────────────────────────────────────────────────────────────

const nodeTypes = {
  [CANVAS_NODE_TYPES.phase]: PhaseNode,
  [CANVAS_NODE_TYPES.unresolvedSkip]: UnresolvedSkipNode,
  [CANVAS_NODE_TYPES.endCap]: EndCapNode,
}

/**
 * Render the real projection through the real `nodeTypes` map.
 *
 * `technical` is merged onto `data` here in exactly the shape the shell uses
 * (`WorkflowCanvas.tsx:949`), so this harness cannot accidentally test a reveal
 * mechanism the app does not have.
 */
async function renderNodes(opts: { technical: boolean; ctx?: NameContext }) {
  const projection = toCanvas(renewalDraft, { nameContext: opts.ctx ?? nameContext })
  const nodes: Node[] = projection.nodes.map((node) => ({
    ...node,
    data: { ...node.data, technical: opts.technical },
  }))

  const view = render(
    <div style={{ width: 1200, height: 800 }}>
      <ReactFlow nodes={nodes} edges={projection.edges} nodeTypes={nodeTypes} fitView={false} />
    </div>,
  )
  // The mocked ResizeObserver fires on a `setTimeout(…, 0)`, so a synchronous read runs
  // before the observer callback and is unreliable (`mockReactFlow.ts:22-24`).
  await waitFor(() => {
    expect(view.container.querySelectorAll("[data-testid^='canvas-node-']").length).toBeGreaterThan(
      0,
    )
  })
  return view
}

/**
 * The card's two text slots, read back off the DOM by POSITION rather than by test id.
 *
 * `PhaseNodeCard` gives the title and the subtitle no hooks of their own and this plan
 * may not add any — it does not modify that file. The card's only `<p>` elements are
 * the title, the subtitle and the (never-passed) technical line, in that DOM order, so
 * position is the honest reading. `PhaseNodeCard.test.tsx:132` already counts the same
 * `<p>` set for the same reason.
 */
function slotsOf(container: HTMLElement, slug: string) {
  const card = container.querySelector(`[data-testid="canvas-node-${slug}"]`)
  if (!card) throw new Error(`no card rendered for ${slug}`)
  const paragraphs = Array.from(card.querySelectorAll("p"))
  return {
    card,
    title: paragraphs[0] ?? null,
    subtitle: paragraphs[1] ?? null,
    paragraphs,
  }
}

const AGENT_SLUG = "find-renewal-terms"
const TECHNICAL_AGENT_TITLE = `AI agent step · ${AGENT_SLUG}`

// ── 1 · The reveal OFF face is unchanged from HEAD ──────────────────────────────

describe("PhaseNode — the reveal OFF (unchanged from HEAD)", () => {
  it("renders data.title in the title slot and data.subtitle in the subtitle slot", async () => {
    const { container } = await renderNodes({ technical: false })
    const { title, subtitle } = slotsOf(container, AGENT_SLUG)

    // 187-04's folder tier resolved, so the title says what THIS step does.
    expect(title?.textContent).toBe("Search Supplier Contracts")
    // D-187-06 — the type subtitle ALWAYS stays, so the reveal always has something
    // to swap and card height never depends on which tier won.
    expect(subtitle?.textContent).toBe(PHASE_TYPE_SUBTITLES.llm_agent)
  })

  it("puts no slug and no · separator on any face", async () => {
    const { container } = await renderNodes({ technical: false })
    for (const phase of renewalDraft) {
      const { card } = slotsOf(container, phase.slug)
      expect(card.textContent ?? "").not.toContain(phase.slug)
      expect(card.textContent ?? "").not.toContain("·")
    }
  })
})

// ── 2 · The reveal ON swaps the SUBTITLE, never the title (Req 4) ───────────────

describe("PhaseNode — the ⌥ reveal swaps the SUBTITLE (SPEC Req 4, sketch 149-C)", () => {
  it("the reveal-ON title EQUALS the reveal-OFF title — captured from two renders here", async () => {
    // The acceptance criterion is an equality, so it is asserted as one rather than
    // against a hand-typed string. Both values are read in THIS test; neither is a
    // literal, so a change that moved both together could not hide behind it.
    const off = await renderNodes({ technical: false })
    const titleWhenTechnicalOff = slotsOf(off.container, AGENT_SLUG).title?.textContent
    off.unmount()

    const on = await renderNodes({ technical: true })
    const titleWhenTechnicalOn = slotsOf(on.container, AGENT_SLUG).title?.textContent

    expect(titleWhenTechnicalOn).toBe(titleWhenTechnicalOff)
    // Non-vacuity: an empty title on BOTH renders would satisfy the equality above.
    expect((titleWhenTechnicalOn ?? "").trim().length).toBeGreaterThan(0)
    // …and it is the MEANING that survived, not merely some string.
    expect(titleWhenTechnicalOn).toBe("Search Supplier Contracts")
  })

  it("the technical form lands in the SUBTITLE slot, on every node at once", async () => {
    const { container } = await renderNodes({ technical: true })
    expect(slotsOf(container, AGENT_SLUG).subtitle?.textContent).toBe(TECHNICAL_AGENT_TITLE)
    expect(slotsOf(container, "apply-pricing-policy").subtitle?.textContent).toBe(
      "AI write step · apply-pricing-policy",
    )
    expect(slotsOf(container, "confirm-with-owner").subtitle?.textContent).toBe(
      "Needs you · confirm-with-owner",
    )
  })

  it("every plain title survives the reveal, not just the derived one", async () => {
    const off = await renderNodes({ technical: false })
    const before = renewalDraft.map((p) => slotsOf(off.container, p.slug).title?.textContent)
    off.unmount()

    const on = await renderNodes({ technical: true })
    const after = renewalDraft.map((p) => slotsOf(on.container, p.slug).title?.textContent)

    expect(after).toEqual(before)
    expect(before).toEqual([
      "Search Supplier Contracts",
      "Run the pricing policy check",
      "Wait for your approval",
    ])
  })
})

// ── 3 · The whole slug reaches the DOM, with no ellipsis ───────────────────────

describe("PhaseNode — the reveal shows the WHOLE slug (the finding that decided 149-C)", () => {
  it("the subtitle carries the entire slug, uncut", async () => {
    const { container } = await renderNodes({ technical: true })
    const { subtitle } = slotsOf(container, AGENT_SLUG)
    expect(subtitle?.textContent).toContain(AGENT_SLUG)
    // The slug is the only genuinely technical token on the card and the entire reason
    // to turn the reveal on. A clipped one would be the reveal failing at its one job.
    expect(subtitle?.textContent).not.toContain("…")
    expect(subtitle?.textContent).not.toContain("...")
  })

  it("the subtitle slot does NOT truncate while the title slot does", async () => {
    // The measured asymmetry sketch 149 turned on: `.ttl` is `truncate` at 14px in a
    // 248px card; `.sub` wraps. Read off the SHIPPED card's class strings rather than
    // asserted about a stylesheet, so a card change moves this rather than fooling it.
    const { container } = await renderNodes({ technical: true })
    const { title, subtitle } = slotsOf(container, AGENT_SLUG)
    expect(title?.className ?? "").toContain("truncate")
    expect(subtitle?.className ?? "").not.toContain("truncate")
  })
})

// ── 4 · `technicalLine` stays Phase 188's ──────────────────────────────────────

describe("PhaseNode — the reserved technical-line slot is NOT spent (Phase 188)", () => {
  it("renders no technical-line element in EITHER toggle state", async () => {
    for (const technical of [false, true]) {
      const view = await renderNodes({ technical })
      expect(
        view.container.querySelectorAll('[data-testid="canvas-node-technical-line"]'),
      ).toHaveLength(0)
      view.unmount()
    }
  })

  it("the adapter never passes it as a JSX prop — only the reservation comment names it", () => {
    // Anchored on the JSX PROP FORM, never the bare identifier: the reservation comment
    // must be free to spell the slot it reserves, and a bare-identifier grep could only
    // pass by deleting that comment (the D-ITEM-183-02 trap).
    expect(phaseNodeSource).not.toMatch(/technicalLine=/)
    // Positive control: the same regex DOES match a planted prop.
    expect("<PhaseNodeCard technicalLine={x} />").toMatch(/technicalLine=/)
    // …and the reservation comment really is still there, so the fence is not passing
    // because the whole subject vanished.
    expect(phaseNodeSource).toMatch(/technicalLine/)
  })
})

// ── 5 · The card's two hard invariants, in BOTH states ─────────────────────────

describe("PhaseNode — the card invariants survive the reveal", () => {
  it("badge slots are unchanged by the toggle — same count, same labels", async () => {
    const off = await renderNodes({ technical: false })
    const badgesOff = Array.from(off.container.querySelectorAll("[data-tone]")).map((el) => [
      el.getAttribute("data-testid"),
      el.textContent,
    ])
    off.unmount()

    const on = await renderNodes({ technical: true })
    const badgesOn = Array.from(on.container.querySelectorAll("[data-tone]")).map((el) => [
      el.getAttribute("data-testid"),
      el.textContent,
    ])

    expect(badgesOn).toEqual(badgesOff)
    // Non-vacuity: the human-input step really does carry slot 2, so "unchanged" is a
    // statement about a badge that exists rather than about an empty set.
    expect(badgesOff).toEqual([["canvas-waits-for-you", "Waits for you"]])
    // Slot 1 stays EMPTY — it belongs to 188 (run state) / 189 (external actions).
    expect(badgesOff.length).toBeLessThanOrEqual(2)
  })

  it("no focusable control exists inside any card, in EITHER toggle state", async () => {
    for (const technical of [false, true]) {
      const view = await renderNodes({ technical })
      const cards = Array.from(view.container.querySelectorAll("[data-testid^='canvas-node-']"))
      expect(cards.length).toBe(renewalDraft.length)
      for (const card of cards) {
        expect(card.querySelectorAll("button, a, [tabindex]")).toHaveLength(0)
      }
      view.unmount()
    }
  })
})

// ── 6 · The safe direction with no name context at all ─────────────────────────

describe("PhaseNode — an omitted name context is the SAFE direction (D-187-05)", () => {
  it("falls through to the generic type sentence, never to an id-shaped face", async () => {
    const { container } = await renderNodes({ technical: false, ctx: {} })
    const { title, card } = slotsOf(container, AGENT_SLUG)
    expect(title?.textContent).toBe("Work out how to do it")
    expect(card.textContent ?? "").not.toContain(FOLDER_ID)
    expect(card.textContent ?? "").not.toContain(SKILL_ID)
  })

  it("still swaps the subtitle when the reveal is on", async () => {
    const { container } = await renderNodes({ technical: true, ctx: {} })
    const { title, subtitle } = slotsOf(container, AGENT_SLUG)
    expect(title?.textContent).toBe("Work out how to do it")
    expect(subtitle?.textContent).toBe(TECHNICAL_AGENT_TITLE)
  })
})
