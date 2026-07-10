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
