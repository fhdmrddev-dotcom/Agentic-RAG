/**
 * Phase 155 Plan 04 Task 1 — TechnicalNamesToggle a11y contract (WCAG 2.1 AA / D-01).
 *
 * The LANG-01 ⌥ two-audience reveal is a PURE PRESENTATIONAL, prop-controlled leaf
 * (`enabled` + `onToggle`): its honest states are simply pressed vs unpressed.
 * This suite locks the D-12 zero-STRUCTURAL-violations bar across both, plus the
 * named contract: the control is a toggle <button> reachable by its accessible
 * name ("Technical names") with `aria-pressed` reflecting the reveal state — the
 * ⌥ glyph is aria-hidden so it never pollutes the accessible name.
 *
 * Note: the component uses the toggle-BUTTON pattern (`<button aria-pressed>`),
 * NOT role="switch" — this suite asserts the ACTUAL contract, not an invented one.
 * STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"

import { TechnicalNamesToggle } from "../TechnicalNamesToggle"

afterEach(() => {
  cleanup()
})

describe("TechnicalNamesToggle a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — unpressed (plain default)", async () => {
    const { container } = render(<TechnicalNamesToggle enabled={false} onToggle={() => {}} />)
    await screen.findByRole("button", { name: /technical names/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — pressed (revealed)", async () => {
    const { container } = render(<TechnicalNamesToggle enabled={true} onToggle={() => {}} />)
    await screen.findByRole("button", { name: /technical names/i })
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("TechnicalNamesToggle a11y — named toggle contract", () => {
  it("exposes an accessible name reachable by role (⌥ glyph is aria-hidden)", () => {
    render(<TechnicalNamesToggle enabled={false} onToggle={() => {}} />)
    const btn = screen.getByRole("button", { name: /technical names/i })
    expect(btn).toBeInTheDocument()
    // The ⌥ glyph is aria-hidden, so it does not leak into the accessible name.
    expect(btn).toHaveAccessibleName(/^technical names$/i)
  })

  it("reflects the reveal state via aria-pressed (false → true)", () => {
    const { rerender } = render(<TechnicalNamesToggle enabled={false} onToggle={() => {}} />)
    expect(screen.getByRole("button", { name: /technical names/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    rerender(<TechnicalNamesToggle enabled={true} onToggle={() => {}} />)
    expect(screen.getByRole("button", { name: /technical names/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
  })
})
