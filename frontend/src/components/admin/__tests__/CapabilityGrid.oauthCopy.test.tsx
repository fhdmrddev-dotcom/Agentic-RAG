/**
 * Phase 307-04 (D-21, D-51; UI-SPEC §"Changed strings") — the deployment MCP switch now also stops
 * every connected app (an OAuth grant is a key minted through a consent screen, so the same switch
 * refuses it). Its two sentences say so. DATA ONLY: no element, prop, class or union changes.
 *
 * Assertions read the rendered TEXT, never a test id (presence assertions cannot see content drift).
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { CapabilityGrid, type CapabilityKey } from "../CapabilityGrid"

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

const SUB = "Members can connect AI tools with personal keys or by signing in."
const IMPACT = "Every AI tool key and connected app is refused on its next call, in every organisation. They are kept."

describe("307-04 CapabilityGrid — the MCP switch names connected apps", () => {
  it("ON: the sub line says members connect with keys or by signing in", () => {
    render(<CapabilityGrid flags={ALL_ON} onToggle={vi.fn()} showTechnical={false} />)
    expect(screen.getByText(SUB)).toBeInTheDocument()
    expect(screen.queryByText("Members can connect AI tools with personal keys.")).toBeNull()
    expect(screen.queryByText(IMPACT)).toBeNull()
  })

  it("OFF: the impact line names keys AND connected apps, and says they are kept", () => {
    render(<CapabilityGrid flags={{ ...ALL_ON, mcp_enabled: false }} onToggle={vi.fn()} showTechnical={false} />)
    expect(screen.getByText(IMPACT)).toBeInTheDocument()
    expect(screen.queryByText(/Keys are kept\./)).toBeNull()
  })
})
