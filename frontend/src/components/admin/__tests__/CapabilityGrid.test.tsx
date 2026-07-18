/**
 * Phase 147 Plan 08 (FLAG-01 / sketch 065-A) — CapabilityGrid contract.
 *
 * Locks the 065-A weight + graded-friction rules:
 *   • four capability switches render (web / sandbox / self-improve / workflows);
 *   • switches flip DIRECTLY via onToggle(key, invertedValue) — NO confirm dialog
 *     appears (emergency speed);
 *   • OFF is the ARMED state (destructive tint + "off for everyone" tag + a
 *     concrete impact line) — count-based ONLY where a count prop is supplied
 *     (workflows), the plain count-free fallback otherwise (never a fabricated
 *     number);
 *   • ON is calm/neutral (no armed styling, no impact copy);
 *   • ⌥ showTechnical reveals the raw flag key; default hides it.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CapabilityGrid, type CapabilityKey } from "../CapabilityGrid"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const ALL_ON: Record<CapabilityKey, boolean> = {
  web_search_enabled: true,
  sandbox_enabled: true,
  self_improve_enabled: true,
  workflows_enabled: true,
}

describe("CapabilityGrid (065-A) — armed-OFF switches + concrete impact copy", () => {
  it("renders exactly the four capability switches", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    render(<CapabilityGrid flags={ALL_ON} onToggle={onToggle} showTechnical={false} />)

    expect(screen.getAllByRole("switch")).toHaveLength(4)
    expect(screen.getByRole("switch", { name: /web search/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /code sandbox/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /self-improvement/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /workflows/i })).toBeInTheDocument()
  })

  it("flips DIRECTLY — toggling calls onToggle with the right key + inverted value, no confirm dialog", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn().mockResolvedValue(undefined)
    render(<CapabilityGrid flags={ALL_ON} onToggle={onToggle} showTechnical={false} />)

    await user.click(screen.getByRole("switch", { name: /code sandbox/i }))

    // Emergency-fast: the write fired immediately with the inverted value…
    expect(onToggle).toHaveBeenCalledWith("sandbox_enabled", false)
    // …and NO confirm dialog appeared (graded friction — capabilities flip direct).
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("an OFF workflows card with a supplied count renders the count-based impact + armed styling", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <CapabilityGrid
        flags={{ ...ALL_ON, workflows_enabled: false }}
        impactCounts={{ workflows_enabled: 2 }}
        onToggle={onToggle}
        showTechnical={false}
      />,
    )

    const card = container.querySelector<HTMLElement>('[data-capability="workflows_enabled"]')!
    expect(card).not.toBeNull()
    // Armed: the OFF state is destructive, not neutral.
    expect(card.getAttribute("data-armed")).toBe("true")
    expect(card.className).toContain("destructive")
    // The "off for everyone" tag + the honest count-based impact line.
    expect(within(card).getByText(/off for everyone/i)).toBeInTheDocument()
    expect(within(card).getByText(/2 running workflows/i)).toBeInTheDocument()
  })

  it("an OFF card with NO count renders the plain fallback impact — never a fabricated number", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <CapabilityGrid
        flags={{ ...ALL_ON, sandbox_enabled: false }}
        onToggle={onToggle}
        showTechnical={false}
      />,
    )

    const card = container.querySelector<HTMLElement>('[data-capability="sandbox_enabled"]')!
    expect(card.getAttribute("data-armed")).toBe("true")
    expect(within(card).getByText(/off for everyone/i)).toBeInTheDocument()
    // The plain fallback impact line renders…
    const impact = within(card).getByText(/plain refusal/i)
    expect(impact).toBeInTheDocument()
    // …with NO fabricated count anywhere in the card body.
    expect(card.textContent ?? "").not.toMatch(/\d/)
  })

  it("an ON card is calm/neutral — no armed styling, no 'off for everyone' tag, no impact copy", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const { container } = render(
      <CapabilityGrid flags={ALL_ON} onToggle={onToggle} showTechnical={false} />,
    )

    const card = container.querySelector<HTMLElement>('[data-capability="web_search_enabled"]')!
    expect(card.getAttribute("data-armed")).toBe("false")
    expect(card.className).not.toContain("destructive")
    expect(within(card).queryByText(/off for everyone/i)).not.toBeInTheDocument()
  })

  it("⌥ showTechnical reveals the raw flag key; default hides it", () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <CapabilityGrid flags={ALL_ON} onToggle={onToggle} showTechnical={false} />,
    )
    expect(screen.queryByText("sandbox_enabled")).not.toBeInTheDocument()

    rerender(<CapabilityGrid flags={ALL_ON} onToggle={onToggle} showTechnical={true} />)
    expect(screen.getByText("sandbox_enabled")).toBeInTheDocument()
  })
})
