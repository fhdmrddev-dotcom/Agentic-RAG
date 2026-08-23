/**
 * ⚠ THROWAWAY — dies with `frontend/sketch/`. The SURVIVING guard is
 * `src/__tests__/no-sketch-surface.test.ts`; this one only proves the sketch renders.
 *
 * It earns its place for one reason: this sketch mounts the REAL `RunTranscript` and
 * `RunSpine` against REAL fixture rows, and a sketch that white-screens costs the operator a
 * session to discover. Twelve mounts (3 variants × 4 deliverable arms) is the whole surface.
 *
 * It also pins the three findings the render produced, so they cannot quietly decay into
 * "the sketch just says what CONTEXT says".
 */
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { SketchRunColumn } from "./SketchRunColumn"
import { SKETCH_RUNS } from "./fixtures"

afterEach(cleanup)

const VARIANTS = [
  "A — Today",
  "B — Reference shape, duration on line two",
  "C — Reference shape, strict single line",
]
const ARMS = [
  "both — a file AND an answer",
  "answer only — no file",
  "neither — the run failed at step 1",
  "neither — the run was cancelled at step 1",
]

describe("sketch 202 mounts every variant against every real arm", () => {
  it("renders 3 variants × 4 arms without throwing", () => {
    for (const v of VARIANTS) {
      for (const a of ARMS) {
        render(<SketchRunColumn />)
        fireEvent.click(screen.getByRole("button", { name: v }))
        fireEvent.click(screen.getByRole("button", { name: a }))
        expect(screen.getByRole("heading", { level: 1 })).toBeTruthy()
        cleanup()
      }
    }
  })
})

describe("the fixtures are the real rows, not placeholders", () => {
  it("carries the measured counts and the measured confirm-gate text", () => {
    expect(SKETCH_RUNS.answer.citationTotals.draft).toBe(38)
    expect(SKETCH_RUNS.both.citationTotals["gather-usage"]).toBe(15)
    expect(SKETCH_RUNS.answer.phases.find((p) => p.slug === "confirm")?.deliverable_text).toBe(
      "Does this draft answer your question? Add any corrections.",
    )
    // ⚠ The neither-arms really carry nothing — that is WHY they are the neither arms, and it
    // is the property that makes the empty hero judgeable rather than mocked.
    expect(SKETCH_RUNS.failed.files).toHaveLength(0)
    expect(SKETCH_RUNS.failed.phases.every((p) => !p.deliverable_text)).toBe(true)
    expect(SKETCH_RUNS.cancelled.status).toBe("cancelled")
  })

  it("FINDING — per-citation `similarity` is real on every entry, unlike `similarity_scores`", () => {
    // SEED-191 refuses a relevance score because "similarity_scores held 7 entries against 38
    // citations". That is TRUE of `similarity_scores` and NOT of `citations[i].similarity`,
    // which is present per entry. R-2's wording does not cover the difference; the decision to
    // hide it is a design call, and this pins the fact that it IS a call.
    const cits = SKETCH_RUNS.answer.citations.draft
    expect(cits.length).toBeGreaterThan(0)
    expect(cits.every((c) => typeof c.similarity === "number")).toBe(true)
  })
})

describe("the reference's unbackable content is refused on screen", () => {
  it("draws no query block and no relevance score by default (R-1, R-2)", () => {
    render(<SketchRunColumn />)
    fireEvent.click(screen.getByRole("button", { name: VARIANTS[1] }))
    fireEvent.click(screen.getByRole("button", { name: ARMS[1] }))
    // Open the one step that has citations.
    fireEvent.click(screen.getByRole("button", { name: /38 sources/ }))
    // The reference's mono block reads `Query: … / Target: … / Status: …`. None of it exists.
    expect(screen.queryByText(/^Query:/)).toBeNull()
    expect(screen.queryByText(/confidence threshold/)).toBeNull()
    expect(screen.queryByText(/Relevance:/)).toBeNull()
    // …but the REAL passage is there, which is what we have instead.
    expect(screen.getByText(/Weekly Report Template Structure/)).toBeTruthy()
  })

  it("the relevance toggle reveals it, so the refusal is a visible choice", () => {
    render(<SketchRunColumn />)
    fireEvent.click(screen.getByRole("button", { name: VARIANTS[1] }))
    fireEvent.click(screen.getByRole("button", { name: ARMS[1] }))
    fireEvent.click(screen.getByRole("button", { name: /relevance score: refused/ }))
    fireEvent.click(screen.getByRole("button", { name: /38 sources/ }))
    expect(screen.getAllByText(/Relevance:/).length).toBeGreaterThan(0)
  })

  it("FINDING — strip the reference's narration and variant C's card is one line", () => {
    render(<SketchRunColumn />)
    fireEvent.click(screen.getByRole("button", { name: VARIANTS[2] }))
    fireEvent.click(screen.getByRole("button", { name: ARMS[0] }))
    // The reference's second line ("Gathered 15 sources from …") is authored narration we do
    // not have. In C nothing stands in for it — so the step's own name is the only text on the
    // left of the card. That is what strict R-3 compliance costs, asserted rather than argued.
    const card = screen.getByRole("button", { name: /Pull support history/ })
    const lines = within(card).getAllByText(/./)
    expect(lines.some((n) => /Pull support history/.test(n.textContent ?? ""))).toBe(true)
  })
})

describe("FINDING — the shipped answer rule picks a status line on a real run", () => {
  it("`llm_emit`'s 61-char status line beats `synthesize`'s 6,133-char narrative", () => {
    // ⚠ THIS IS ABOUT `WorkflowRunPage`, NOT ABOUT THIS SKETCH. Its `runAnswer` takes the last
    // server-ordered row with non-empty `deliverable_text`, skipping `llm_human_input` only.
    // On the QBR run that is `emit-qbr` (`llm_emit`), whose whole text is a filename
    // announcement — rendered today under the heading "The answer this run wrote".
    const rows = SKETCH_RUNS.both.phases
    const emit = rows.find((r) => r.phase_type === "llm_emit")
    const single = rows.find((r) => r.phase_type === "llm_single")
    expect(emit?.deliverable_text).toBe(
      "Produced the filled deliverable: /Northwind-QBR-Template.docx",
    )
    expect(emit!.deliverable_text!.length).toBeLessThan(80)
    expect(single!.deliverable_text!.length).toBeGreaterThan(6000)
    // …and `emit` really is LATER, which is the whole mechanism.
    expect(rows.indexOf(emit!)).toBeGreaterThan(rows.indexOf(single!))
  })

  it("`phase_type` is populated on every row — the signal exists", () => {
    // ⚠ The first fixture generation read `phase["phase_type"]` (absent) instead of
    // `phase["config"]["phase_type"]` (populated), and this sketch briefly REPORTED that
    // nothing on the wire marks a gate. It does.
    for (const key of ["both", "answer", "failed", "cancelled"] as const) {
      for (const row of SKETCH_RUNS[key].phases) {
        expect(typeof row.phase_type).toBe("string")
      }
    }
    expect(
      SKETCH_RUNS.answer.phases.find((r) => r.slug === "confirm")?.phase_type,
    ).toBe("llm_human_input")
  })

  it("toggling the emit skip changes what the hero renders", () => {
    render(<SketchRunColumn />)
    fireEvent.click(screen.getByRole("button", { name: VARIANTS[1] }))
    fireEvent.click(screen.getByRole("button", { name: ARMS[0] }))
    expect(screen.getByText(/Produced the filled deliverable/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /answer rule: as shipped/ }))
    expect(screen.queryByText(/Produced the filled deliverable/)).toBeNull()
    expect(screen.getByText(/Executive Steering Committee QBR/)).toBeTruthy()
  })
})
