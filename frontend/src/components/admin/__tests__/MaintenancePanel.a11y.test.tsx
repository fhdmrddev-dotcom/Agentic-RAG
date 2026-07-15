/**
 * Phase 155 Plan 04 Task 2 — MaintenancePanel a11y contract (WCAG 2.1 AA / D-01, D-09).
 *
 * The 147-08 Platform-state panel is a PURE PRESENTATIONAL LEAF (props in, DOM
 * out): its honest states are OFF-idle, armed (confirm prompt revealed), and ON
 * (persistent consequence banner). This is the component that owns the D-09
 * scenario-3 arm-to-confirm guard (the CapabilityGrid switches flip directly —
 * see that suite's FINDING). This suite locks the D-12 zero-STRUCTURAL-violations
 * bar across all three states, plus the destructive-guard contract:
 *   - the panel is a landmark <section aria-label="Platform state">;
 *   - the guarded trigger is a real <button> reachable by accessible name;
 *   - the ARM-TO-CONFIRM step is a keyboard-operable <button> ("Confirm") queryable
 *     by role+name (never colour/hover-alone) — the automatable half of the live
 *     keyboard drive (D-09 scenario 3);
 *   - while ON, the read-only consequence banner exposes its state via role="status"
 *     AND a visible WORD sentence, never colour-alone.
 *
 * STRUCTURAL rules only (no contrast assertion — the D-01 live-scan half owns it).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { MaintenancePanel } from "../MaintenancePanel"

afterEach(() => {
  cleanup()
})

describe("MaintenancePanel a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — OFF (idle)", async () => {
    const { container } = render(
      <MaintenancePanel maintenanceOn={false} onSetMaintenance={vi.fn().mockResolvedValue(undefined)} />,
    )
    await screen.findByRole("button", { name: /put the platform in read-only mode/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — armed (confirm prompt revealed)", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MaintenancePanel maintenanceOn={false} onSetMaintenance={vi.fn().mockResolvedValue(undefined)} />,
    )
    await user.click(screen.getByRole("button", { name: /put the platform in read-only mode/i }))
    await screen.findByRole("button", { name: /^confirm$/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — ON (persistent consequence banner)", async () => {
    const { container } = render(
      <MaintenancePanel maintenanceOn={true} onSetMaintenance={vi.fn().mockResolvedValue(undefined)} />,
    )
    await screen.findByText(/the whole platform is read-only right now/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("MaintenancePanel a11y — D-09 arm-to-confirm guard roles + names", () => {
  it("the panel is a landmark section with an accessible name", () => {
    render(<MaintenancePanel maintenanceOn={false} onSetMaintenance={vi.fn()} />)
    expect(screen.getByRole("region", { name: /platform state/i })).toBeInTheDocument()
  })

  it("the guarded trigger is a real <button> reachable by accessible name", () => {
    render(<MaintenancePanel maintenanceOn={false} onSetMaintenance={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: /put the platform in read-only mode/i }),
    ).toBeInTheDocument()
  })

  it("the ARM-TO-CONFIRM step is a keyboard-operable Confirm button (never colour/hover-alone)", async () => {
    const user = userEvent.setup()
    render(<MaintenancePanel maintenanceOn={false} onSetMaintenance={vi.fn().mockResolvedValue(undefined)} />)

    // First click ARMS (does not flip) — the confirm/cancel pair are real buttons.
    await user.click(screen.getByRole("button", { name: /put the platform in read-only mode/i }))
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument()
  })

  it("while ON the read-only consequence banner exposes state via role=status + a visible WORD sentence", () => {
    render(<MaintenancePanel maintenanceOn={true} onSetMaintenance={vi.fn()} />)
    const banner = screen.getByRole("status")
    expect(banner).toHaveTextContent(/the whole platform is read-only right now/i)
  })
})
