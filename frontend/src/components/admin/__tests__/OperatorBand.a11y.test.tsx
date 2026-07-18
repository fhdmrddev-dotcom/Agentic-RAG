/**
 * Phase 155 Plan 04 Task 1 — OperatorBand a11y contract (WCAG 2.1 AA / D-01).
 *
 * The 146-05 amber operator band is a PURE PRESENTATIONAL LEAF (props in, DOM
 * out — no fetch, no context), so its honest states are simply "identity known"
 * vs "identity still probing (null)". This suite locks the D-12 zero-STRUCTURAL-
 * violations bar for the shell band across both, plus the named contract the
 * live keyboard drive (D-09 scenario 3) leans on:
 *   - the "Back to app" affordance is a real, name-carrying <button>;
 *   - the OPERATOR zone marker is a visible WORD (never colour-alone);
 *   - the "every action recorded" ledger marker is announced as role="status".
 *
 * STRUCTURAL rules only — jsdom cannot compute colour-contrast (D-01 live-scan
 * half owns that); no "verify contrast" assertion is written here.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"

import { OperatorBand } from "../OperatorBand"
import type { OperatorIdentity } from "@/lib/api"

const IDENTITY: OperatorIdentity = {
  id: "op-1",
  email: "operator@acme.io",
  granted_at: "2026-07-15T00:00:00Z",
}

afterEach(() => {
  cleanup()
})

describe("OperatorBand a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — identity resolved", async () => {
    const { container } = render(<OperatorBand identity={IDENTITY} onBack={() => {}} />)
    await screen.findByText(/control room/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — identity still probing (null)", async () => {
    const { container } = render(<OperatorBand identity={null} onBack={() => {}} />)
    await screen.findByText(/control room/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — recording pulse flashing", async () => {
    const { container } = render(
      <OperatorBand identity={IDENTITY} onBack={() => {}} recordingPulse />,
    )
    await screen.findByText(/control room/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("OperatorBand a11y — named role/name contract", () => {
  it("the 'Back to app' control is a real <button> reachable by accessible name", () => {
    render(<OperatorBand identity={IDENTITY} onBack={() => {}} />)
    expect(screen.getByRole("button", { name: /back to app/i })).toBeInTheDocument()
  })

  it("the OPERATOR zone marker is a visible WORD (never colour-alone)", () => {
    render(<OperatorBand identity={IDENTITY} onBack={() => {}} />)
    expect(screen.getByText("OPERATOR")).toBeInTheDocument()
  })

  it("the 'every action recorded' ledger marker is announced as role=status", () => {
    render(<OperatorBand identity={IDENTITY} onBack={() => {}} />)
    const marker = screen.getByRole("status")
    expect(marker).toHaveTextContent(/every action recorded/i)
  })
})
