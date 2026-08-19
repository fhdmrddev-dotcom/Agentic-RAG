/**
 * Phase 124-01 Task 2 (WUX-01, sketch 046-A / D-03 / D-04) — WorkflowSoul tests.
 *
 * The scale-keyed 5-atom soul (purpose HERO · needs · glyph-dot spine · ONE tier
 * chip · output). These tests pin the locked contract:
 *  - all 5 atoms render at scale="card".
 *  - TIER CONSISTENCY INVARIANT: the SAME fixture yields the SAME data-tier on the
 *    tier chip at scale card / run / pub (SC#1+SC#2).
 *  - HONEST empty-states (D-03): null business_requirement → "draft · purpose not
 *    declared yet"; no terminal llm_emit → "produces: answer in chat". Both atoms
 *    are ALWAYS rendered, never hidden.
 *  - GLYPH + WORD: the tier chip renders tier.glyph AND a WORD at every scale
 *    (never colour-alone — WCAG 1.4.1).
 *  - G-5: the source never imports PhaseTimeline / PhaseCard.
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import workflowSoulSource from "./WorkflowSoul?raw"
// 199-03 Task 1 (DES-01): the `UNDETERMINED` sweep runs over the WHOLE soul chain, not
// just the renderer — the word could arrive as a tier label, a derivation arm or a
// vocabulary entry, and only one of those three lives in the component.
import soulDataSource from "./soulData?raw"
import deriveTierSource from "./deriveTier?raw"
import { WorkflowSoul } from "./WorkflowSoul"
import type { DefShape } from "./soulData"

/** A full STRICT workflow: purpose + needs + a terminal strict llm_emit. */
const strictDef: DefShape = {
  name: "Weekly Status",
  business_requirement: "Summarize this week's progress for leadership.",
  input_keys: ["week_of"],
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather updates", config: { phase_type: "llm_agent" } },
    {
      slug: "emit",
      phase_index: 1,
      name: "Render report",
      config: { phase_type: "llm_emit", citation_policy: "strict" },
    },
  ],
}

/** A draft (null business_requirement) chat-only workflow → both honest empties. */
const draftChatDef: DefShape = {
  name: "Untitled draft",
  business_requirement: null,
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather", config: { phase_type: "llm_agent" } },
    { slug: "chat", phase_index: 1, name: "Discuss", config: { phase_type: "llm_single" } },
  ],
}

const SCALES = ["card", "run", "pub"] as const

describe("WorkflowSoul — the scale-keyed 5-atom soul", () => {
  it("renders all 5 atoms at scale='card'", () => {
    render(<WorkflowSoul def={strictDef} scale="card" />)
    // (1) purpose HERO
    expect(screen.getByTestId("soul-purpose")).toHaveTextContent(
      "Summarize this week's progress for leadership.",
    )
    // (2) needs
    expect(screen.getByTestId("soul-needs")).toHaveTextContent("week_of")
    // (3) glyph-dot spine
    expect(screen.getByTestId("soul-spine")).toBeInTheDocument()
    expect(screen.getAllByTestId(/^spine-dot-/)).toHaveLength(2)
    // (4) ONE tier chip
    expect(screen.getAllByTestId("soul-tier")).toHaveLength(1)
    // (5) output
    expect(screen.getByTestId("soul-output")).toBeInTheDocument()
  })

  it("TIER CONSISTENCY: the same fixture yields the same data-tier at card/run/pub", () => {
    const tiers = SCALES.map((scale) => {
      const { unmount } = render(<WorkflowSoul def={strictDef} scale={scale} />)
      const dataTier = screen.getByTestId("soul-tier").getAttribute("data-tier")
      unmount()
      return dataTier
    })
    expect(tiers).toEqual(["STRICT", "STRICT", "STRICT"])
    // All three identical — the invariant.
    expect(new Set(tiers).size).toBe(1)
  })

  it("HONEST empty-state (D-03): null purpose → 'draft · purpose not declared yet' (atom present)", () => {
    render(<WorkflowSoul def={draftChatDef} scale="card" />)
    const purpose = screen.getByTestId("soul-purpose")
    expect(purpose).toBeInTheDocument()
    expect(purpose).toHaveTextContent(/draft · purpose not declared yet/i)
  })

  it("HONEST empty-state (D-03): no terminal llm_emit → 'produces: answer in chat' (atom present)", () => {
    render(<WorkflowSoul def={draftChatDef} scale="card" />)
    const output = screen.getByTestId("soul-output")
    expect(output).toBeInTheDocument()
    expect(output).toHaveTextContent(/produces: answer in chat/i)
  })

  it("GLYPH + WORD: the tier chip renders tier.glyph AND the tier WORD at every scale", () => {
    for (const scale of SCALES) {
      const { unmount } = render(<WorkflowSoul def={strictDef} scale={scale} />)
      const chip = screen.getByTestId("soul-tier")
      // The locked STRICT glyph 🔒 AND the WORD "Strict" — never colour-alone.
      expect(within(chip).getByText("🔒")).toBeInTheDocument()
      expect(chip.textContent ?? "").toMatch(/strict/i)
      unmount()
    }
  })

  it("renders a file deliverable label when a terminal llm_emit phase exists", () => {
    render(<WorkflowSoul def={strictDef} scale="card" />)
    const output = screen.getByTestId("soul-output")
    // Honest file signal — NOT "answer in chat", and a non-empty label.
    expect(output.textContent ?? "").not.toMatch(/answer in chat/i)
    expect((output.textContent ?? "").trim().length).toBeGreaterThan(0)
  })

  it("never throws on a null def", () => {
    expect(() => render(<WorkflowSoul def={null} scale="card" />)).not.toThrow()
  })

  it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
    const src = workflowSoulSource
    expect(src).not.toMatch(/PhaseTimeline/)
    expect(src).not.toMatch(/PhaseCard/)
    // No local PHASE_GLYPHS / tierForDefinition re-declaration — derived from soulData.
    expect(src).not.toMatch(/const PHASE_GLYPHS/)
    expect(src).not.toMatch(/function tierForDefinition/)
    expect(src).toMatch(/soulData/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 199-03 Task 1 (DES-01 · sheet 178 `c7-gauntlet-soul` §2) — THE PRE-CHANGE
// INVENTORY at the two scales that are actually MOUNTED, and the sheet's third arm.
//
// ⚠ `scale="card"` is no longer a live consumer: Phase 192.2 removed
// `<WorkflowSoul scale="card" />` from `WorkflowCard.tsx` as its D-03 subtraction, so the
// shipped mounts are `run` (the run header) and `pub` (the publish summary). The cases
// above still exercise `card` and are untouched — the prop still exists and must keep
// working — but a resting inventory that claimed to measure the shipped surface at `card`
// would be measuring a size nothing renders. Both live scales are pinned here instead.
//
// ⚠ AND THE SHEET DRAWS A DIFFERENT COMPONENT. Its §2 rows are `glyph + NAME + tier chip`
// on ONE line — that is the LIBRARY CARD's identity line, not the soul. The soul's five
// atoms and their ORDER are locked (046-A) with PURPOSE as the hero at every size, and
// `name` is not one of them. Adopting the sheet's row would delete four atoms including
// the hero, so the shipped language wins and the disagreement is reported, not resolved.
// ─────────────────────────────────────────────────────────────────────────────

/** A MIDDLE workflow — `flag` citation policy WITHOUT the full floor-raising gate set. */
const middleDef: DefShape = {
  name: "Vendor Renewal Risk Sweep",
  business_requirement: "Flag vendor contracts whose renewal terms changed this quarter.",
  input_keys: ["quarter"],
  phases: [
    { slug: "gather", phase_index: 0, name: "Gather contracts", config: { phase_type: "llm_agent" } },
    {
      slug: "emit",
      phase_index: 1,
      name: "Render the sweep",
      config: { phase_type: "llm_emit", citation_policy: "flag" },
      validators: [{ kind: "structure_check" }],
    },
  ],
}

/** A LOOSE workflow — `draft` policy and no structural gate at all. */
const looseDef: DefShape = {
  name: "Scratch notes",
  business_requirement: "Turn my meeting notes into a short summary.",
  phases: [
    {
      slug: "emit",
      phase_index: 0,
      name: "Write it up",
      config: { phase_type: "llm_emit", citation_policy: "draft" },
    },
  ],
}

const LIVE_SCALES = ["run", "pub"] as const

describe("WorkflowSoul 199-03 — the pre-change RESTING inventory at the two LIVE scales", () => {
  it.each(LIVE_SCALES)("(%s) all five atoms render, in the locked order, as literals", (scale) => {
    const { container } = render(<WorkflowSoul def={strictDef} scale={scale} />)

    expect(screen.getByTestId("soul-purpose")).toHaveTextContent(
      "Summarize this week's progress for leadership.",
    )
    expect(screen.getByTestId("soul-needs")).toHaveTextContent("needs week_of")
    expect(screen.getByTestId("soul-spine")).toBeInTheDocument()
    expect(screen.getByTestId("soul-tier")).toHaveAttribute("data-tier", "STRICT")
    expect(screen.getByTestId("soul-output")).toHaveTextContent("produces: Weekly Status · file")

    // THE ORDER IS THE ATOM. A re-presentation may retune layout and typography; it may
    // not reorder, and purpose must lead. Read off the rendered DOM, never asserted twice.
    const ids = Array.from(container.querySelectorAll<HTMLElement>("[data-testid^='soul-']")).map(
      (el) => el.getAttribute("data-testid"),
    )
    expect(ids).toEqual(["soul-purpose", "soul-needs", "soul-spine", "soul-tier", "soul-output"])
  })

  it.each(LIVE_SCALES)("(%s) both honest empty-states are RENDERED, never hidden", (scale) => {
    render(<WorkflowSoul def={draftChatDef} scale={scale} />)
    expect(screen.getByTestId("soul-purpose")).toHaveTextContent("draft · purpose not declared yet")
    expect(screen.getByTestId("soul-output")).toHaveTextContent("produces: answer in chat")
    // The atoms are PRESENT in both empty cases — an absence would be the worse trade.
    expect(screen.getByTestId("soul-needs")).toHaveTextContent("needs kickoff_prompt")
  })

  it("the two live scales render the SAME data — only layout and typography differ", () => {
    const read = (scale: (typeof LIVE_SCALES)[number]) => {
      const { unmount } = render(<WorkflowSoul def={strictDef} scale={scale} />)
      const snapshot = {
        purpose: screen.getByTestId("soul-purpose").textContent,
        needs: screen.getByTestId("soul-needs").textContent,
        tier: screen.getByTestId("soul-tier").getAttribute("data-tier"),
        output: screen.getByTestId("soul-output").textContent,
      }
      unmount()
      return snapshot
    }
    expect(read("run")).toEqual(read("pub"))
  })
})

describe("WorkflowSoul 199-03 — the sheet's UNDETERMINED third arm is NOT adopted", () => {
  it("the third derived band is MIDDLE — a REAL band, and it says its own word", () => {
    // The sheet's third row is captioned `UNDETERMINED` with a `help` glyph and a dashed
    // border — the visual language of "we could not tell". Our third band is `MIDDLE`, and
    // it is a value the code CAN tell: a `flag` citation policy carrying some but not all
    // of the floor-raising gates. Printing "undetermined" over it would be a FALSE claim
    // about our own certainty, so the sheet's word is refused.
    render(<WorkflowSoul def={middleDef} scale="pub" />)
    const chip = screen.getByTestId("soul-tier")
    expect(chip).toHaveAttribute("data-tier", "MIDDLE")
    expect(chip.textContent ?? "").toMatch(/middle/i)
    expect(within(chip).getByText("◐")).toBeInTheDocument()
    // It is a derived band, not an unknown: the chip's own description says what it means.
    expect(chip.getAttribute("title") ?? "").toMatch(/citations flagged or partial/i)
  })

  it("all three arms are real, distinct, derived bands — none of them is an 'unknown'", () => {
    const seen: string[] = []
    for (const def of [strictDef, middleDef, looseDef]) {
      const { unmount } = render(<WorkflowSoul def={def} scale="pub" />)
      seen.push(screen.getByTestId("soul-tier").getAttribute("data-tier") ?? "")
      unmount()
    }
    expect(seen).toEqual(["STRICT", "MIDDLE", "LOOSE"])
  })

  it("no soul module spells the sheet's word — and the sweep is NON-VACUOUS", () => {
    // A positive control first: without it these three `not.toMatch` calls could be passing
    // because they inspect nothing at all.
    expect("the tier is UNDETERMINED").toMatch(/undetermined/i)
    for (const src of [workflowSoulSource, soulDataSource, deriveTierSource]) {
      expect(src.length).toBeGreaterThan(500) // the module really loaded
      expect(src).not.toMatch(/undetermined/i)
    }
  })
})
