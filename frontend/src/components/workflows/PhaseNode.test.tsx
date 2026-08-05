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
// 188-07: the vocabulary module is fenced from HERE as well as from its own consumers —
// Req 2's grep is scoped to the run-state RENDER PATH, which is these two files together.
import runVocabularySource from "./runVocabulary?raw"
import { EndCapNode, PhaseNode, UnresolvedSkipNode } from "./PhaseNode"
import { CANVAS_NODE_TYPES, toCanvas } from "./canvasModel"
import { PHASE_TYPE_SUBTITLES, type NameContext, type PhaseSpecJSON } from "./phaseVocabulary"
import { runReadingLabel, type NodeRunState } from "./runVocabulary"
import type { CanvasReading } from "@/lib/phaseState"

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
async function renderNodes(opts: {
  technical: boolean
  ctx?: NameContext
  /** 188-07: the shell's `runState` lookup, merged onto `data` in the SAME shape
   *  `WorkflowCanvas`'s `settledNodes` memo uses. Omitted ⇒ no node is in run mode,
   *  which is the Builder's canvas and every case above it. */
  run?: (slug: string) => NodeRunState | undefined
}) {
  const projection = toCanvas(renewalDraft, { nameContext: opts.ctx ?? nameContext })
  const nodes: Node[] = projection.nodes.map((node) => ({
    ...node,
    data: { ...node.data, technical: opts.technical, run: opts.run?.(node.id) },
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

// ═══════════════════════════════════════════════════════════════════════════════
// 188-07 · RUNVIZ-01 — the run-state render path
// ═══════════════════════════════════════════════════════════════════════════════
//
// Everything below was added by plan 188-07, which is the plan that first threads a
// reading through this adapter. Appended rather than woven into the blocks above, so a
// reader can still see exactly what 187-09 asserted.

/** The seven readings, DERIVED from a compiler-forced exhaustive table rather than
 *  hand-listed — the 188-06 discipline. An eighth `CanvasReading` member cannot be added
 *  without this list growing, so no loop below can silently under-cover the union. */
const ALL_READINGS: Record<CanvasReading, true> = {
  "not-started": true,
  running: true,
  done: true,
  failed: true,
  skipped: true,
  "waiting-for-you": true,
  unknown: true,
}
const READINGS = Object.keys(ALL_READINGS) as CanvasReading[]

/** A run state in exactly the shape the PAGE builds one: the reading, and the sentence
 *  worded ONCE by `runReadingLabel`. The label is never hand-typed here — a typed one
 *  would test that the author can copy a string, not that the surface derives it once. */
function runFor(reading: CanvasReading, emitFailure?: NodeRunState["emitFailure"]): NodeRunState {
  return { reading, label: runReadingLabel(reading, emitFailure), emitFailure }
}

/** The card's run line, by its own test hook. `null` ⇒ the card is not in run mode. */
function runLineOf(container: HTMLElement, slug: string): HTMLElement | null {
  const card = container.querySelector(`[data-testid="canvas-node-${slug}"]`)
  if (!card) throw new Error(`no card rendered for ${slug}`)
  return card.querySelector('[data-testid="canvas-node-run-line"]')
}

/** Strip block and line comments, so a fence can ask about CODE rather than about prose.
 *  Copied in shape from `PhaseNodeCard.test.tsx` — and for the same measured reason: the
 *  adapter's docblock has to be free to NAME the readings it forwards, while the code
 *  must contain no database vocabulary at all. A bare-token grep could only be satisfied
 *  by deleting the explanation. Exact for these two files: neither contains a regex
 *  literal nor a string containing `//`. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
}

// ── Needles, ASSEMBLED FROM PARTS (the 187-24 lesson) ───────────────────────────
//
// Spelled inline, this file's own source would satisfy any grep later run over a file
// set that included it, and the fence would become vacuous. Every needle below is joined
// at runtime instead. Each also carries a positive control in its own `it(`.

/** The DB status values that exist ONLY in the database vocabulary — none of them is a
 *  `CanvasReading` member, so their absence is a clean, decidable claim. */
const DB_ONLY_STATUSES = [
  ["pen", "ding"].join(""),
  ["act", "ive"].join(""),
  ["comp", "leted"].join(""),
  ["retry", "ing"].join(""),
] as const

/** The two DB values whose SPELLING is shared with a `CanvasReading` member. They are
 *  fenced out of the adapter (which names no reading in code at all) but CANNOT be
 *  fenced out of the vocabulary module, because there they ARE the reading — see the
 *  measured note on the `runVocabulary` block below. */
const SHARED_SPELLINGS = [["fai", "led"].join(""), ["skip", "ped"].join("")] as const

const STEP_ORDINAL_FIELD = ["phase", "_index"].join("")
const STEP_ORDINAL_CAMEL = ["phase", "Index"].join("")

// ── 7 · Req 2 — no harness vocabulary in the run-state render path ──────────────

describe("PhaseNode 188-07 — Req 2: the render path names no database status", () => {
  it("the stripper strips and every needle really matches (positive controls)", () => {
    expect(stripComments(phaseNodeSource).length).toBeLessThan(phaseNodeSource.length)
    expect(stripComments(runVocabularySource).length).toBeLessThan(runVocabularySource.length)
    expect(stripComments(`/* ${DB_ONLY_STATUSES[0]} */`)).not.toContain(DB_ONLY_STATUSES[0])
    for (const needle of [...DB_ONLY_STATUSES, ...SHARED_SPELLINGS]) {
      expect(stripComments(`const s = "${needle}"`)).toContain(needle)
    }
    expect(`{ ${STEP_ORDINAL_FIELD}: 3 }`).toContain(STEP_ORDINAL_FIELD)
    expect(`{ ${STEP_ORDINAL_CAMEL}: 3 }`).toContain(STEP_ORDINAL_CAMEL)
  })

  it("the ADAPTER's code contains no database status and no step ordinal — all six", () => {
    const code = stripComments(phaseNodeSource)
    for (const needle of [...DB_ONLY_STATUSES, ...SHARED_SPELLINGS]) {
      expect(code).not.toContain(needle)
    }
    expect(code).not.toContain(STEP_ORDINAL_FIELD)
    expect(code).not.toContain(STEP_ORDINAL_CAMEL)
    // Non-vacuity: the adapter really does forward a reading, so "no status literal"
    // is a statement about a file that HAS a run-state render path.
    expect(code).toMatch(/status=\{run\?\.reading\}/)
  })

  it("the VOCABULARY's code names no DB-only status, no ordinal and no derivation", () => {
    const code = stripComments(runVocabularySource)
    for (const needle of DB_ONLY_STATUSES) expect(code).not.toContain(needle)
    expect(code).not.toContain(STEP_ORDINAL_FIELD)
    expect(code).not.toContain(STEP_ORDINAL_CAMEL)
    // D-188-02 — one derivation, two vocabularies. This module holds WORDS, so it must
    // not name the mapping symbols at all; a status map is what would have forced the
    // four needles above back into it.
    expect(code).not.toMatch(/phaseStatusFromDb/)
    expect(code).not.toMatch(/DB_PHASE_STATUS/)
    expect(code).not.toMatch(/canvasReading\(/)
  })

  it("MEASURED CORRECTION — the two shared spellings cannot be fenced out of the words", () => {
    // The plan's acceptance asks for zero occurrences of five DB literals across the
    // render path. Two of those five — the failure and the bypass words — are ALSO
    // `CanvasReading` members, spelled identically. In `runVocabulary.ts` they are the
    // reading, so "zero occurrences" there could only be satisfied by deleting the
    // vocabulary the phase exists to add. The honest fence is therefore split: the four
    // DB-ONLY values are absent (above), and the two shared ones are proved to be
    // READINGS rather than statuses — they appear, and nothing that maps a status does.
    const code = stripComments(runVocabularySource)
    for (const needle of SHARED_SPELLINGS) expect(code).toContain(needle)
    // The mechanical half of "they are readings": the module's own reading-keyed tables
    // are exhaustive over the union, so every occurrence is a union member by typecheck.
    expect(code).toMatch(/Record<CanvasReading/)
    // …and the RENDER fence below is what proves none of them reaches a person's eyes.
  })
})

describe("PhaseNode 188-07 — Req 2: nothing technical reaches the face at any reading", () => {
  it("renders no database word and no step ordinal, at all seven readings", async () => {
    for (const reading of READINGS) {
      const view = await renderNodes({ technical: false, run: () => runFor(reading) })
      for (const phase of renewalDraft) {
        const card = view.container.querySelector(`[data-testid="canvas-node-${phase.slug}"]`)
        const text = card?.textContent ?? ""
        for (const needle of [...DB_ONLY_STATUSES, ...SHARED_SPELLINGS]) {
          expect(text).not.toContain(needle)
        }
        expect(text).not.toContain(STEP_ORDINAL_FIELD)
      }
      // Non-vacuity: the run line really is on the face at this reading, so the absences
      // above are measured against a card that is genuinely in run mode.
      expect(runLineOf(view.container, AGENT_SLUG)?.textContent ?? "").not.toBe("")
      view.unmount()
    }
  })

  it("puts no slug on any face at any reading, with the reveal OFF", async () => {
    for (const reading of READINGS) {
      const view = await renderNodes({ technical: false, run: () => runFor(reading) })
      for (const phase of renewalDraft) {
        const { card } = slotsOf(view.container, phase.slug)
        expect(card.textContent ?? "").not.toContain(phase.slug)
      }
      view.unmount()
    }
  })
})

// ── 8 · Req 5 — two facts on one node, and they read as two ────────────────────

describe("PhaseNode 188-07 — Req 5: the design-time badge and the run-time reading", () => {
  /** Word set of a sentence, lowercased and stripped of punctuation. */
  function wordsOf(sentence: string): Set<string> {
    return new Set(
      sentence
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean),
    )
  }

  /** A crude English stem — enough to strip the inflections a "tense variant" would be
   *  built from. If two sentences differ ONLY by tense, their stem sets are equal. */
  function stemsOf(sentence: string): Set<string> {
    return new Set([...wordsOf(sentence)].map((w) => w.replace(/(ing|ed|es|s)$/, "")))
  }

  const WAITING_SLUG = "confirm-with-owner"

  async function renderWaitingNode() {
    // The human-input step is BOTH: the shipped design-time badge (it *will* pause) and,
    // here, the run-time reading (it *is* paused). Both are on one card at once — which
    // is the only configuration in which Req 5 can actually be tested.
    const view = await renderNodes({
      technical: false,
      run: (slug) => (slug === WAITING_SLUG ? runFor("waiting-for-you") : undefined),
    })
    const card = view.container.querySelector(`[data-testid="canvas-node-${WAITING_SLUG}"]`)!
    const badge = card.querySelector('[data-testid="canvas-waits-for-you"]')
    const runLine = card.querySelector('[data-testid="canvas-node-run-line"]')
    return { view, card, badgeText: badge?.textContent ?? "", runText: runLine?.textContent ?? "" }
  }

  it("draws BOTH on the same node — the badge in the badge row, the reading in the body", async () => {
    const { view, card, badgeText, runText } = await renderWaitingNode()
    // Both really rendered — the whole test is vacuous otherwise.
    expect(badgeText.length).toBeGreaterThan(0)
    expect(runText.length).toBeGreaterThan(0)
    // Different CHANNELS: the badge is inside the badge row's chip, the reading is a
    // paragraph in the card body. Neither is nested inside the other.
    expect(card.querySelectorAll('[data-testid="canvas-waits-for-you"]')).toHaveLength(1)
    expect(card.querySelectorAll('[data-testid="canvas-node-run-line"]')).toHaveLength(1)
    expect(
      card
        .querySelector('[data-testid="canvas-node-run-line"]')!
        .querySelector('[data-testid="canvas-waits-for-you"]'),
    ).toBeNull()
    view.unmount()
  })

  it("the two strings are NOT equal and NOT tense variants of each other", async () => {
    const { view, badgeText, runText } = await renderWaitingNode()

    expect(runText).not.toBe(badgeText)

    // Not a tense variant, asserted mechanically rather than asserted about: each
    // sentence contains a WORD the other does not…
    const badgeWords = wordsOf(badgeText)
    const runWords = wordsOf(runText)
    expect([...badgeWords].filter((w) => !runWords.has(w)).length).toBeGreaterThan(0)
    expect([...runWords].filter((w) => !badgeWords.has(w)).length).toBeGreaterThan(0)
    // …and the difference survives STEMMING, which is what makes it a difference of
    // meaning rather than of inflection. Two sentences that differed only by tense would
    // have equal stem sets and would pass the word check above only by accident.
    const badgeStems = stemsOf(badgeText)
    const runStems = stemsOf(runText)
    expect([...badgeStems].filter((s) => !runStems.has(s)).length).toBeGreaterThan(0)
    expect([...runStems].filter((s) => !badgeStems.has(s)).length).toBeGreaterThan(0)
    view.unmount()
  })

  it("the vocabulary module does not carry the badge's literal (source fence)", async () => {
    const { view, badgeText, runText } = await renderWaitingNode()
    // The needle is READ OFF THE DOM, never typed — so this cannot pass because two
    // hand-typed strings happened to match, and it fails the moment the run vocabulary
    // absorbs the design-time wording.
    expect(runVocabularySource).not.toContain(badgeText)
    // POSITIVE CONTROL — the needle is a real, matchable string.
    expect(`x ${badgeText} y`).toContain(badgeText)
    // …and the module really does own the RUN wording, so the absence above is about a
    // file that genuinely holds the other half of the pair.
    expect(runVocabularySource).toContain(runText.split(" — ")[0])
    view.unmount()
  })
})

// ── 9 · One function for the visible line and the announced one ────────────────

describe("PhaseNode 188-07 — the run sentence is derived ONCE", () => {
  it("the rendered run line is byte-equal to the label the shell will announce", async () => {
    // `NodeRunState.label` is the string `WorkflowCanvas` appends to the node's
    // accessible name. If the card re-worded anything, the sighted and the assistive
    // reading would drift — this asserts they are the same bytes, at every reading.
    for (const reading of READINGS) {
      const run = runFor(reading)
      const view = await renderNodes({ technical: false, run: () => run })
      expect(runLineOf(view.container, AGENT_SLUG)?.textContent).toBe(run.label)
      view.unmount()
    }
  })

  it("the failure clause follows the typed enum, never free-form harness text", async () => {
    const withEmit = runFor("failed", "citation_gate_rejected")
    const withoutEmit = runFor("failed")
    const view = await renderNodes({ technical: false, run: () => withEmit })
    expect(runLineOf(view.container, AGENT_SLUG)?.textContent).toBe(withEmit.label)
    // Non-vacuity: the enum really does change the sentence, so threading `emitFailure`
    // is load-bearing rather than decorative (188-06's note to this plan).
    expect(withEmit.label).not.toBe(withoutEmit.label)
    view.unmount()
  })

  it("no run line at all when the shell supplies nothing — the Builder's card", async () => {
    const view = await renderNodes({ technical: false })
    for (const phase of renewalDraft) expect(runLineOf(view.container, phase.slug)).toBeNull()
    view.unmount()
  })
})

// ── 10 · WR-04 site 1 — the tint lookup is TOTAL (188.1-04) ────────────────────

/**
 * Render the real projection with `data.phaseType` OVERRIDDEN, in exactly the shape
 * `renderNodes` merges `technical` and `run` — `data` is what the adapter reads, so
 * writing the discriminator there is writing the adapter's real input.
 */
async function renderWithPhaseType(phaseType: string) {
  const projection = toCanvas(renewalDraft, { nameContext })
  const nodes: Node[] = projection.nodes.map((node) => ({
    ...node,
    data: { ...node.data, phaseType },
  }))
  const view = render(
    <div style={{ width: 1200, height: 800 }}>
      <ReactFlow nodes={nodes} edges={projection.edges} nodeTypes={nodeTypes} fitView={false} />
    </div>,
  )
  await waitFor(() => {
    expect(view.container.querySelectorAll("[data-testid^='canvas-node-']").length).toBeGreaterThan(
      0,
    )
  })
  return view
}

/** The one element the resolved tint reaches — the icon well's `radial-gradient`. */
function wellStyleOf(container: HTMLElement): string {
  return container.querySelector('[style*="radial-gradient"]')?.getAttribute("style") ?? ""
}

describe("PhaseNode 188.1-04 — WR-04 site 1: the phase-type face is total", () => {
  /**
   * WR-04 SITE 1 (`PhaseNode.tsx`, the `ICON_TINT[data.phaseType]` lookup) — the ONE of
   * the five WR-04 sites with a real SINK: the resolved value is interpolated into a CSS
   * string by `PhaseNodeCard`, `radial-gradient(circle, ${tint}, transparent 68%)`.
   *
   * ⚠ OBSERVED RED FIRST, against the shipped tree, before any guard was written — the
   * `lib/phaseState.ts` register. `ICON_TINT` is a plain object literal, so it INHERITS
   * `constructor`, `toString`, `__proto__` and friends; `ICON_TINT["constructor"]` is
   * therefore the `Object` FUNCTION — never nullish, so `?? DEFAULT_TINT` does not fire
   * and a function reaches the style string.
   *
   * ⚠ IT IS ONE TEST BECAUSE `data.phaseType` FEEDS THREE LOOKUPS, NOT ONE, and the
   * property is about the VALUE not about any single table. The adapter hands the same
   * author-supplied discriminator to `ICON_TINT` (the tint) and to
   * `nodePresentation.renderPhaseMark`, which indexes `phaseGlyph`'s `PHASE_GLYPH_MARKS`
   * and then `soulData.PHASE_GLYPHS`. Measured against the shipped tree on 2026-08-06,
   * the FIRST consequence of `"constructor"` is not a bad colour — it is
   * `createElement(Object, …)` and a hard render crash, *"Objects are not valid as a
   * React child"*. Guarding only the tint would leave this test red, which is exactly
   * how a falsification proves the property is wider than the patch it was written for.
   *
   * This asserts the CONSEQUENCE (what the DOM paints) rather than the expression: a
   * test that greps this file's source for `hasOwnProperty` would test the patch.
   */
  it("a prototype-key phase type renders the ORDINARY unknown face, never an inherited member", async () => {
    const proto = await renderWithPhaseType("constructor")
    const protoStyle = wellStyleOf(proto.container)
    const protoCard = proto.container.querySelector(`[data-testid="canvas-node-${AGENT_SLUG}"]`)
    const protoText = protoCard?.textContent ?? ""
    // The sink, stated as the sink: NO rendered style attribute anywhere in the tree
    // carries a stringified function.
    for (const el of Array.from(proto.container.querySelectorAll("[style]"))) {
      expect(el.getAttribute("style") ?? "").not.toContain("function")
    }
    proto.unmount()

    // An ORDINARY unrecognised type — a real table MISS, which is what the prototype key
    // must be indistinguishable from.
    const ordinary = await renderWithPhaseType("llm_time_travel")
    const ordinaryStyle = wellStyleOf(ordinary.container)
    const ordinaryText =
      ordinary.container.querySelector(`[data-testid="canvas-node-${AGENT_SLUG}"]`)?.textContent ??
      ""
    ordinary.unmount()

    // POSITIVE CONTROLS: the ordinary miss really does paint a well and really does fall
    // back to the declared "•" mark, so the equalities below compare two real faces
    // rather than two empty strings.
    expect(ordinaryStyle).toContain("radial-gradient")
    expect(ordinaryText).toContain("•")

    expect(protoStyle).toBe(ordinaryStyle)
    expect(protoText).toBe(ordinaryText)
  })
})
