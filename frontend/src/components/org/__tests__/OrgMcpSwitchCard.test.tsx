/**
 * Phase 304-06 (KEY-06, D-02, D-35; UI-SPEC Surface 3) — the org admin's MCP switch.
 *
 * Prices the failures a switch can lie with: a guessed value after a failed read (T-304-44), an
 * optimistic flip the server refused (T-304-43), and a flip with no visible record (T-304-45).
 * Assertions read RENDERED WORDS and the switch's aria state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const m = vi.hoisted(() => ({
  getOrgMcpAccess: vi.fn(),
  setOrgMcpAccess: vi.fn(),
}))

vi.mock("@/lib/api/apiKeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/apiKeys")>()
  return { ...actual, ...m }
})

import { OrgMcpSwitchCard } from "../OrgMcpSwitchCard"

const TITLE = "AI tool access (MCP)"

beforeEach(() => {
  m.getOrgMcpAccess.mockReset()
  m.setOrgMcpAccess.mockReset()
})

describe("304-06 OrgMcpSwitchCard", () => {
  it("says Loading…, then shows the switch ON and calm, with the sub line naming the org", async () => {
    m.getOrgMcpAccess.mockResolvedValue({ enabled: true })
    render(<OrgMcpSwitchCard orgName="Acme Inc" />)
    expect(screen.getByText("Loading…")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).toBeNull()
    const sw = await screen.findByRole("switch", { name: TITLE })
    expect(sw).toHaveAttribute("aria-checked", "true")
    expect(
      screen.getByText(
        "Members can make personal keys that let Claude Code, Cursor or VS Code search and read as them in Acme Inc.",
      ),
    ).toBeInTheDocument()
    const card = screen.getByTestId("org-mcp-switch")
    expect(card).toHaveAttribute("data-armed", "false")
    expect(within(card).queryByText("off for Acme Inc")).toBeNull()
    expect(within(card).queryByText(/is refused on its next call/)).toBeNull()
  })

  it("OFF is armed: the tag names the org and the impact line says what happens to members' keys", async () => {
    m.getOrgMcpAccess.mockResolvedValue({ enabled: false })
    render(<OrgMcpSwitchCard orgName="Acme Inc" />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    expect(sw).toHaveAttribute("aria-checked", "false")
    const card = screen.getByTestId("org-mcp-switch")
    expect(card).toHaveAttribute("data-armed", "true")
    expect(card.className).toContain("border-destructive/50")
    expect(within(card).getByText("off for Acme Inc")).toBeInTheDocument()
    expect(
      within(card).getByText(
        "Every member's AI tool key in Acme Inc is refused on its next call. Keys are kept; switching back on restores them.",
      ),
    ).toBeInTheDocument()
  })

  it("a failed read shows the words and Retry, and NO switch (never a guessed value)", async () => {
    const user = userEvent.setup()
    m.getOrgMcpAccess.mockRejectedValueOnce(new Error("Forbidden.")).mockResolvedValueOnce({ enabled: false })
    render(<OrgMcpSwitchCard orgName="Acme Inc" />)
    expect(await screen.findByText("Couldn't load this setting.")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("switch", { name: TITLE })).toHaveAttribute("aria-checked", "false")
    expect(m.getOrgMcpAccess).toHaveBeenCalledTimes(2)
  })

  it("a flip is disabled in flight, then shows the SERVER's answer and calls onRecorded once", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.getOrgMcpAccess.mockResolvedValue({ enabled: true })
    let resolveWrite: (v: { enabled: boolean }) => void = () => {}
    m.setOrgMcpAccess.mockImplementation(
      () => new Promise<{ enabled: boolean }>((r) => {
        resolveWrite = r
      }),
    )
    render(<OrgMcpSwitchCard orgName="Acme Inc" onRecorded={onRecorded} />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    expect(m.setOrgMcpAccess).toHaveBeenCalledWith(false)
    // Never optimistic: still ON, and disabled, until the server answers.
    expect(sw).toHaveAttribute("aria-checked", "true")
    expect(sw).toBeDisabled()
    expect(onRecorded).not.toHaveBeenCalled()
    resolveWrite({ enabled: false })
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"))
    expect(sw).not.toBeDisabled()
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(screen.getByText("off for Acme Inc")).toBeInTheDocument()
  })

  it("shows what the server stored, even when it differs from the click", async () => {
    const user = userEvent.setup()
    m.getOrgMcpAccess.mockResolvedValue({ enabled: true })
    m.setOrgMcpAccess.mockResolvedValue({ enabled: true })
    render(<OrgMcpSwitchCard orgName="Acme Inc" />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    await waitFor(() => expect(m.setOrgMcpAccess).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(sw).not.toBeDisabled())
    expect(sw).toHaveAttribute("aria-checked", "true")
  })

  it("a failed write stays put, says so, and records nothing", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.getOrgMcpAccess.mockResolvedValue({ enabled: true })
    m.setOrgMcpAccess.mockRejectedValue(new Error("boom"))
    render(<OrgMcpSwitchCard orgName="Acme Inc" onRecorded={onRecorded} />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't change it. Try again.")
    expect(sw).toHaveAttribute("aria-checked", "true")
    expect(sw).not.toBeDisabled()
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it("is a direct flip: no confirm dialog opens", async () => {
    const user = userEvent.setup()
    m.getOrgMcpAccess.mockResolvedValue({ enabled: true })
    m.setOrgMcpAccess.mockResolvedValue({ enabled: false })
    render(<OrgMcpSwitchCard orgName="Acme Inc" />)
    await user.click(await screen.findByRole("switch", { name: TITLE }))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("falls back to 'this organisation' when no org name is known", async () => {
    m.getOrgMcpAccess.mockResolvedValue({ enabled: false })
    render(<OrgMcpSwitchCard orgName={null} />)
    expect(await screen.findByText("off for this organisation")).toBeInTheDocument()
  })
})
