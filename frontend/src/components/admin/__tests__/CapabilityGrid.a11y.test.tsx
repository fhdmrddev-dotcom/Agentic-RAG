/**
 * Phase 155 Plan 04 Task 2 — CapabilityGrid a11y contract (WCAG 2.1 AA / D-01, D-09).
 *
 * The 147-08 kill-switch grid is a PURE PRESENTATIONAL LEAF (props in, DOM out):
 * its honest states are all-ON (calm) and armed-OFF (destructive). This suite
 * locks the D-12 zero-STRUCTURAL-violations bar across both (+ ⌥ Technical names),
 * plus the D-09 scenario-3 (automatable half) destructive-guard contract:
 *   - each capability is a role="switch" reachable by accessible NAME with
 *     `aria-checked` reflecting on/off — keyboard-operable, never colour-alone;
 *   - the ARMED (OFF) consequence is announced as visible WORDS ("off for
 *     everyone" tag + a concrete impact line), never colour-alone.
 *
 * FINDING (asserted honestly per the plan SUMMARY): CapabilityGrid switches flip
 * DIRECTLY — there is NO confirm/arm-to-confirm step in THIS component (065-A
 * emergency speed). The arm-to-confirm guard the plan's acceptance criteria
 * references lives on MaintenancePanel (asserted in its own suite); here we assert
 * the switches are keyboard-operable role+name controls so the live keyboard
 * drive can reach them. STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import { axe } from "vitest-axe"

import { CapabilityGrid, type CapabilityKey } from "../CapabilityGrid"

afterEach(() => {
  cleanup()
})

const ALL_ON: Record<CapabilityKey, boolean> = {
  web_search_enabled: true,
  sandbox_enabled: true,
  self_improve_enabled: true,
  workflows_enabled: true,
}

const ALL_OFF: Record<CapabilityKey, boolean> = {
  web_search_enabled: false,
  sandbox_enabled: false,
  self_improve_enabled: false,
  workflows_enabled: false,
}

describe("CapabilityGrid a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — all ON (calm)", async () => {
    const { container } = render(
      <CapabilityGrid flags={ALL_ON} onToggle={vi.fn().mockResolvedValue(undefined)} showTechnical={false} />,
    )
    await screen.findByRole("switch", { name: /web search/i })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — all OFF (armed / destructive) with a count", async () => {
    const { container } = render(
      <CapabilityGrid
        flags={ALL_OFF}
        impactCounts={{ workflows_enabled: 2 }}
        onToggle={vi.fn().mockResolvedValue(undefined)}
        showTechnical={false}
      />,
    )
    await screen.findAllByText(/off for everyone/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — ⌥ Technical names revealed", async () => {
    const { container } = render(
      <CapabilityGrid flags={ALL_ON} onToggle={vi.fn().mockResolvedValue(undefined)} showTechnical={true} />,
    )
    await screen.findByText("sandbox_enabled")
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("CapabilityGrid a11y — D-09 kill-switch roles + names", () => {
  it("each capability is a role=switch reachable by accessible name (keyboard-operable)", () => {
    render(<CapabilityGrid flags={ALL_ON} onToggle={vi.fn()} showTechnical={false} />)
    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(4)
    expect(screen.getByRole("switch", { name: /web search/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /code sandbox/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /self-improvement/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /workflows/i })).toBeInTheDocument()
  })

  it("aria-checked reflects the live on/off state (never colour-alone)", () => {
    render(
      <CapabilityGrid
        flags={{ ...ALL_ON, sandbox_enabled: false }}
        onToggle={vi.fn()}
        showTechnical={false}
      />,
    )
    expect(screen.getByRole("switch", { name: /web search/i })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: /code sandbox/i })).toHaveAttribute("aria-checked", "false")
  })

  it("the ARMED (OFF) consequence is announced as visible WORDS, not colour-alone", () => {
    const { container } = render(
      <CapabilityGrid
        flags={{ ...ALL_ON, sandbox_enabled: false }}
        onToggle={vi.fn()}
        showTechnical={false}
      />,
    )
    const card = container.querySelector<HTMLElement>('[data-capability="sandbox_enabled"]')!
    expect(within(card).getByText(/off for everyone/i)).toBeInTheDocument()
    expect(within(card).getByText(/plain refusal/i)).toBeInTheDocument()
  })
})
