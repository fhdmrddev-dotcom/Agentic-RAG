/**
 * Phase 155 Plan 04 Task 1 — LockedTab a11y contract (WCAG 2.1 AA / D-01).
 *
 * The Control Room honest-lock refusal leaf is PURE PRESENTATIONAL (props in, DOM
 * out): its honest states are "default copy" vs "caller-supplied description".
 * This suite locks the D-12 zero-STRUCTURAL-violations bar across both, plus the
 * never-colour-alone contract: the locked state is announced as a visible WORD
 * ("Not built yet — coming soon"), and the Lock glyph is decorative (aria-hidden).
 *
 * STRUCTURAL rules only (no contrast assertion — the D-01 live-scan half owns it).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"

import { LockedTab } from "../LockedTab"

afterEach(() => {
  cleanup()
})

describe("LockedTab a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — default copy", async () => {
    const { container } = render(<LockedTab title="Secrets" />)
    await screen.findByText(/not built yet/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — caller-supplied description", async () => {
    const { container } = render(
      <LockedTab title="Secrets" description="Encrypted provider-key management is on the way." />,
    )
    await screen.findByText(/encrypted provider-key/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("LockedTab a11y — named contract", () => {
  it("the locked state is announced as a visible WORD (never colour-alone)", () => {
    render(<LockedTab title="Secrets" />)
    expect(screen.getByText(/not built yet — coming soon/i)).toBeInTheDocument()
  })

  it("the section title renders as a heading", () => {
    render(<LockedTab title="Secrets" />)
    expect(screen.getByRole("heading", { name: /secrets/i })).toBeInTheDocument()
  })
})
