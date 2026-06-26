/**
 * Phase 124-01 Task 2 (WUX-01, sketch 046-A / D-04) — PhaseSpine tests.
 *
 * The HORIZONTAL glyph-dot phase spine — a sibling of the vertical PhaseSpineGraph
 * that shares ONLY the glyph vocabulary (imported from soulData, never re-declared).
 * These tests pin the 046-A locked deltas:
 *  - one glyph dot per phase, in strict phase_index order (input order irrelevant).
 *  - type RIBBONS are stripped (no "server"/"agent"/"deliverable" label text).
 *  - phase-index NUMBERS are stripped (no "phase_index N" / index digit render).
 *  - the llm_emit ◆ node carries the accent-violet tint class.
 *  - the source never imports PhaseTimeline / PhaseCard (G-5).
 */
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import phaseSpineSource from "./PhaseSpine?raw"
import { PhaseSpine } from "./PhaseSpine"
import type { DefShape } from "./soulData"

/** A 4-phase def, intentionally OUT of phase_index order to prove the sort. */
const def: DefShape = {
  phases: [
    { slug: "emit", phase_index: 2, name: "Render the report", config: { phase_type: "llm_emit" } },
    { slug: "gather", phase_index: 0, name: "Gather sources", config: { phase_type: "llm_agent" } },
    { slug: "draft", phase_index: 1, name: "Draft", config: { phase_type: "llm_single" } },
    { slug: "server", phase_index: 3, name: "Fetch data", config: { phase_type: "programmatic" } },
  ],
}

describe("PhaseSpine — horizontal glyph-dot row", () => {
  it("renders one glyph dot per phase in strict phase_index order", () => {
    render(<PhaseSpine def={def} scale="card" />)
    const dots = screen.getAllByTestId(/^spine-dot-/)
    expect(dots).toHaveLength(4)
    const order = dots.map((d) => d.getAttribute("data-slug"))
    expect(order).toEqual(["gather", "draft", "emit", "server"])
  })

  it("renders the type glyph for each phase (from PHASE_GLYPHS)", () => {
    render(<PhaseSpine def={def} scale="card" />)
    expect(within(screen.getByTestId("spine-dot-gather")).getByText("🤖")).toBeInTheDocument()
    expect(within(screen.getByTestId("spine-dot-draft")).getByText("✎")).toBeInTheDocument()
    expect(within(screen.getByTestId("spine-dot-emit")).getByText("◆")).toBeInTheDocument()
    expect(within(screen.getByTestId("spine-dot-server")).getByText("⚙")).toBeInTheDocument()
  })

  it("STRIPS type ribbons — no 'server'/'agent'/'deliverable' type-label text (046-A)", () => {
    const { container } = render(<PhaseSpine def={def} scale="card" />)
    const text = container.textContent ?? ""
    // The PhaseChain donor rendered these type labels; the spine must not.
    expect(text).not.toMatch(/\bserver\b/i)
    expect(text).not.toMatch(/\bagent\b/i)
    expect(text).not.toMatch(/\bdeliverable\b/i)
    expect(text).not.toMatch(/\bparallel\b/i)
  })

  it("STRIPS phase-index numbers — no 'phase_index' label or index digit render (046-A)", () => {
    const { container } = render(<PhaseSpine def={def} scale="card" />)
    const text = container.textContent ?? ""
    expect(text).not.toMatch(/phase_index/i)
    // No bare phase-index digit (0..3) rendered as visible text.
    expect(text).not.toMatch(/\b[0-3]\b/)
  })

  it("tints the llm_emit ◆ node with the accent-violet treatment", () => {
    render(<PhaseSpine def={def} scale="card" />)
    const emitDot = screen.getByTestId("spine-dot-emit")
    expect(emitDot.className).toMatch(/accent-violet/)
    // A non-emit node must NOT carry the violet tint.
    const gatherDot = screen.getByTestId("spine-dot-gather")
    expect(gatherDot.className).not.toMatch(/accent-violet/)
  })

  it("at card scale puts the phase name in a title= attribute (quiet, hover-only)", () => {
    render(<PhaseSpine def={def} scale="card" />)
    expect(screen.getByTestId("spine-dot-gather").getAttribute("title")).toBe("Gather sources")
  })

  it("at run/pub scale shows the phase name as visible quiet text", () => {
    render(<PhaseSpine def={def} scale="run" />)
    expect(screen.getByText("Gather sources")).toBeInTheDocument()
    expect(screen.getByText("Render the report")).toBeInTheDocument()
  })

  it("renders nothing fatal for an empty / null def", () => {
    expect(() => render(<PhaseSpine def={null} scale="card" />)).not.toThrow()
    expect(() => render(<PhaseSpine def={{ phases: [] }} scale="card" />)).not.toThrow()
  })

  it("the SOURCE never imports PhaseTimeline or PhaseCard (G-5)", () => {
    expect(phaseSpineSource).not.toMatch(/PhaseTimeline/)
    expect(phaseSpineSource).not.toMatch(/PhaseCard/)
    // The glyph map is imported from soulData, not re-declared locally.
    expect(phaseSpineSource).not.toMatch(/const PHASE_GLYPHS/)
    expect(phaseSpineSource).toMatch(/soulData/)
  })
})
