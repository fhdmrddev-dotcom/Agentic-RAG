/**
 * Phase 112 Plan 03 Task 1 — ConfidenceChip Wave-0 tests (AC2/AC3 home).
 *
 * The honesty contract is load-bearing (sketch 028 GROUNDING.md + D-05):
 *   - hardcoded metadata display tiers (High≥0.75 / Med≥0.50 / Low<0.50) —
 *     NOT the retrieval confidence_bucket (0.54/0.38) in agent_loop.py
 *   - a manually-overridden field renders a NEUTRAL "Edited" chip — NO score,
 *     NO success/green (a green chip would falsely imply model confidence)
 *   - a stored value with no _confidence entry renders neutral "Extracted" —
 *     NEVER a fabricated "High"
 *   - never colour-alone: every state renders an aria-hidden glyph + a visible
 *     tier/state WORD
 *   - the raw stored score is shown verbatim to 2 decimals, NEVER a "%"
 *
 * Co-located with the component (the backend Plan 01 owns only the backend stubs).
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfidenceChip } from "./ConfidenceChip"

function chip() {
  return screen.getByTestId("confidence-chip")
}

describe("ConfidenceChip — tier mapping (hardcoded High≥0.75 / Med≥0.50 / Low<0.50)", () => {
  it("score 0.96 → High + raw score 0.96 + panel-status-done tint + CheckCircle2 glyph", () => {
    render(<ConfidenceChip score={0.96} />)
    const el = chip()
    expect(el.textContent).toMatch(/High/i)
    expect(el.textContent).toMatch(/0\.96/)
    // panel-scoped AA token — NOT global --muted-foreground.
    expect(el.className).toMatch(/panel-status-done/)
    // never-colour-alone: aria-hidden glyph present.
    expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
    // the score is a raw value, never a percentage.
    expect(el.textContent).not.toMatch(/%/)
  })

  it("score 0.63 → Med + raw score 0.63 + panel-status-active tint", () => {
    render(<ConfidenceChip score={0.63} />)
    const el = chip()
    expect(el.textContent).toMatch(/Med/i)
    expect(el.textContent).toMatch(/0\.63/)
    expect(el.className).toMatch(/panel-status-active/)
    expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
    expect(el.textContent).not.toMatch(/%/)
  })

  it("score 0.41 → Low + raw score 0.41 + AlertTriangle glyph + lightened red", () => {
    render(<ConfidenceChip score={0.41} />)
    const el = chip()
    expect(el.textContent).toMatch(/Low/i)
    expect(el.textContent).toMatch(/0\.41/)
    // lightened red for AA — NEVER raw --destructive for text.
    expect(el.className).toMatch(/hsl\(0_80%_80%\)/)
    expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
    expect(el.textContent).not.toMatch(/%/)
  })

  it("boundary: exactly 0.75 → High; exactly 0.50 → Med; 0.49 → Low", () => {
    const { rerender } = render(<ConfidenceChip score={0.75} />)
    expect(chip().textContent).toMatch(/High/i)
    rerender(<ConfidenceChip score={0.5} />)
    expect(chip().textContent).toMatch(/Med/i)
    rerender(<ConfidenceChip score={0.49} />)
    expect(chip().textContent).toMatch(/Low/i)
  })
})

describe("ConfidenceChip — honesty contract", () => {
  it("source='user' → NEUTRAL 'Edited' chip: NO score, NO success/green class", () => {
    render(<ConfidenceChip source="user" score={0.96} />)
    const el = chip()
    expect(el.textContent).toMatch(/Edited/i)
    // A manual override must NEVER render a numeric score.
    expect(el.textContent).not.toMatch(/0\.96/)
    expect(el.textContent).not.toMatch(/\d\.\d/)
    // A manual override must NEVER render green (panel-status-done) or "success".
    expect(el.className).not.toMatch(/panel-status-done/)
    expect(el.className).not.toMatch(/success/)
    // still never colour-alone: a glyph + the WORD are present.
    expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
    expect(el.textContent).not.toMatch(/%/)
  })

  it("score=undefined (stored value, no _confidence) → neutral 'Extracted', NO score, NEVER 'High'", () => {
    render(<ConfidenceChip score={undefined} />)
    const el = chip()
    expect(el.textContent).toMatch(/Extracted/i)
    // NEVER fabricate authority for an unscored field.
    expect(el.textContent).not.toMatch(/High/i)
    expect(el.textContent).not.toMatch(/\d\.\d/)
    expect(el.className).not.toMatch(/panel-status-done/)
    expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
    expect(el.textContent).not.toMatch(/%/)
  })

  it("no props at all → neutral 'Extracted' (same unscored path), never 'High'", () => {
    render(<ConfidenceChip />)
    const el = chip()
    expect(el.textContent).toMatch(/Extracted/i)
    expect(el.textContent).not.toMatch(/High/i)
    expect(el.textContent).not.toMatch(/%/)
  })
})

describe("ConfidenceChip — never colour-alone (glyph + WORD in every state)", () => {
  it("every state renders an aria-hidden glyph AND a visible tier/state word", () => {
    const cases: { props: Record<string, unknown>; word: RegExp }[] = [
      { props: { score: 0.96 }, word: /High/i },
      { props: { score: 0.63 }, word: /Med/i },
      { props: { score: 0.41 }, word: /Low/i },
      { props: { source: "user" }, word: /Edited/i },
      { props: { score: undefined }, word: /Extracted/i },
    ]
    for (const c of cases) {
      const { unmount } = render(<ConfidenceChip {...c.props} />)
      const el = chip()
      expect(el.querySelector("[aria-hidden='true']")).not.toBeNull()
      expect(el.textContent).toMatch(c.word)
      unmount()
    }
  })
})
