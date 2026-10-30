/**
 * Phase 304-06 (KEY-06, D-03; UI-SPEC Surface 4) — the operator's deployment MCP switch is ONE
 * more CapabilityGrid entry, appended after Workflows, with the shipped grid's behaviour: direct
 * flip, armed OFF with "off for everyone", and NO count (065-A: never a fabricated number).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CapabilityGrid, type CapabilityKey } from "../CapabilityGrid"
import gridSrc from "../CapabilityGrid.tsx?raw"
import controlRoomSrc from "../ControlRoomPage.tsx?raw"

afterEach(() => {
  cleanup()
})

const ALL_ON: Record<CapabilityKey, boolean> = {
  web_search_enabled: true,
  sandbox_enabled: true,
  self_improve_enabled: true,
  workflows_enabled: true,
  mcp_enabled: true,
}

const LABEL = "AI tool access (MCP)"
const IMPACT = "Every AI tool key is refused on its next call, in every organisation. Keys are kept."

function card(): HTMLElement {
  const el = document.querySelector('[data-capability="mcp_enabled"]')
  if (!el) throw new Error("no mcp_enabled card")
  return el as HTMLElement
}

describe("304-06 CapabilityGrid — the deployment MCP switch", () => {
  it("is the fifth card, after Workflows, with its plain label and sub line", () => {
    render(<CapabilityGrid flags={ALL_ON} onToggle={vi.fn()} showTechnical={false} />)
    const switches = screen.getAllByRole("switch")
    expect(switches).toHaveLength(5)
    expect(switches[4]).toHaveAccessibleName(LABEL)
    expect(screen.getByText("Members can connect AI tools with personal keys.")).toBeInTheDocument()
    expect(card()).toHaveAttribute("data-armed", "false")
    expect(screen.queryByText(IMPACT)).toBeNull()
  })

  it("OFF is armed with 'off for everyone' and the count-free impact line, even when counts are passed", () => {
    render(
      <CapabilityGrid
        flags={{ ...ALL_ON, mcp_enabled: false }}
        impactCounts={{ workflows_enabled: 3, mcp_enabled: 7 }}
        onToggle={vi.fn()}
        showTechnical={false}
      />,
    )
    expect(card()).toHaveAttribute("data-armed", "true")
    expect(card().textContent ?? "").toContain("off for everyone")
    expect(screen.getByText(IMPACT)).toBeInTheDocument()
    // No number is ever claimed for this switch.
    expect(card().textContent ?? "").not.toMatch(/\b7\b/)
  })

  it("a flip calls the shell's handler with mcp_enabled and the inverse value", async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn().mockResolvedValue(undefined)
    render(<CapabilityGrid flags={ALL_ON} onToggle={onToggle} showTechnical={false} />)
    await user.click(screen.getByRole("switch", { name: LABEL }))
    expect(onToggle).toHaveBeenCalledWith("mcp_enabled", false)
  })

  it("⌥ Technical names reveals the raw key", () => {
    render(<CapabilityGrid flags={ALL_ON} onToggle={vi.fn()} showTechnical={true} />)
    expect(screen.getByText("mcp_enabled")).toBeInTheDocument()
  })

  it("the entry carries no countImpact, and the Control Room maps the setting defaulting ON", () => {
    const entry = gridSrc.slice(gridSrc.indexOf('key: "mcp_enabled"'))
    const block = entry.slice(0, entry.indexOf("},"))
    expect(block).not.toContain("countImpact")
    expect(controlRoomSrc).toContain("mcp_enabled: settings?.mcp_enabled ?? true,")
  })
})
