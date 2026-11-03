/**
 * Phase 307-05 (OAUTH-07; D-26, D-28; UI-SPEC Surface 3) — Org admin → API keys → the org's
 * connected apps, and Disconnect all behind the 066 victim-naming sheet.
 *
 * Prices: a Disconnect all offered with nothing to disconnect, a sheet that does not name its
 * victims, a receipt that repeats the sheet's guess instead of the server's count, and a sheet that
 * closes on a refusal. Assertions read RENDERED WORDS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import orgRaw from "../OrgConnectedApps.tsx?raw"

const m = vi.hoisted(() => ({
  listOrgConnectedApps: vi.fn(),
  disconnectOrgApp: vi.fn(),
  revokeAllConnectedApps: vi.fn(),
}))

vi.mock("@/lib/api/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/oauth")>()
  return { ...actual, ...m }
})

import { OrgConnectedApps } from "../OrgConnectedApps"
import type { OrgConnectedApp } from "@/lib/api/oauth"

function app(id: string, owner: string, over: Partial<OrgConnectedApp> = {}): OrgConnectedApp {
  return {
    id,
    client_name: "Claude",
    name_source: "dcr",
    redirect_host: "claude.ai",
    redirect_kind: "web",
    org_id: "o1",
    org_name: "Acme Legal",
    tools: ["search_knowledge_base", "list_documents", "read_document"],
    folders: null,
    include_external: false,
    created_at: "2026-11-01T10:00:00Z",
    last_used_at: "2026-11-03T09:00:00Z",
    expires_at: "2027-01-30T10:00:00Z",
    mcp_off: null,
    owner_name: owner,
    owner_is_you: false,
    ...over,
  }
}

const FOUR = [app("a", "Dana Kim"), app("b", "Lee Park"), app("c", "Ada Admin"), app("d", "Sam Roe"), app("e", "Dana Kim")]

beforeEach(() => {
  m.listOrgConnectedApps.mockReset()
  m.disconnectOrgApp.mockReset()
  m.revokeAllConnectedApps.mockReset()
})

describe("307-05 OrgConnectedApps", () => {
  it("empty: one line, no card, no Disconnect all", async () => {
    m.listOrgConnectedApps.mockResolvedValue({ apps: [] })
    render(<OrgConnectedApps orgName="Acme Legal" />)
    expect(await screen.findByText("No connected apps in Acme Legal.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Disconnect all connected apps" })).toBeNull()
  })

  it("lists the org's apps with the Connected app chip and the owner first, each with its own Disconnect", async () => {
    m.listOrgConnectedApps.mockResolvedValue({ apps: [app("a", "Lee Park")] })
    render(<OrgConnectedApps orgName="Acme Legal" />)
    expect(await screen.findByRole("heading", { name: /Connected apps in Acme Legal/ })).toBeInTheDocument()
    expect(screen.getByText("Apps members signed in to through Syrel's sign-in page. Disconnect all doesn't touch API keys.")).toBeInTheDocument()
    const card = screen.getByTestId("connected-app-a")
    expect(within(card).getByText("Connected app")).toBeInTheDocument()
    expect(within(card).getByTestId("connected-app-meta")).toHaveTextContent(/^owner Lee Park/)
    expect(within(card).getByRole("button", { name: "Disconnect Claude (claude.ai)" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Disconnect all connected apps" })).toBeInTheDocument()
  })

  it("one app: the admin sheet names the owner and uses the admin revoke route", async () => {
    const a = app("a", "Lee Park")
    m.listOrgConnectedApps.mockResolvedValueOnce({ apps: [a] }).mockResolvedValueOnce({ apps: [] })
    m.disconnectOrgApp.mockResolvedValue({})
    const onRecorded = vi.fn()
    render(<OrgConnectedApps orgName="Acme Legal" onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect Claude (claude.ai)" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(sheet).toHaveTextContent("This disconnects Lee Park's app.")
    await userEvent.click(within(sheet).getByRole("button", { name: "Disconnect Claude" }))
    await waitFor(() => expect(m.disconnectOrgApp).toHaveBeenCalledWith("a"))
    await waitFor(() => expect(onRecorded).toHaveBeenCalled())
    expect(await screen.findByText("No connected apps in Acme Legal.")).toBeInTheDocument()
  })

  it("Disconnect all names the victims, keeps focus on Keep them, and says what is kept", async () => {
    m.listOrgConnectedApps.mockResolvedValue({ apps: FOUR })
    render(<OrgConnectedApps orgName="Acme Legal" />)
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect all connected apps" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByText("Disconnect all connected apps in Acme Legal?")).toBeInTheDocument()
    expect(sheet).toHaveTextContent(
      "Every app members signed in to through Syrel in Acme Legal stops on its next call. Members can connect again afterwards.",
    )
    const grid = within(sheet).getByTestId("disconnect-all-facts")
    expect(grid).toHaveTextContent("5")
    expect(grid).toHaveTextContent("connected apps")
    expect(grid).toHaveTextContent("4")
    expect(grid).toHaveTextContent("members")
    expect(within(sheet).getByTestId("disconnect-all-names")).toHaveTextContent("Dana Kim, Lee Park, Ada Admin, and 1 more")
    expect(sheet).toHaveTextContent(
      "Their sign-ins from Claude.ai, Claude Desktop, Claude Code and any other app end in Acme Legal.",
    )
    const kept = within(sheet).getByTestId("disconnect-all-kept")
    expect(kept).toHaveTextContent("✓ API keys, AI tool and workflow, are not touched")
    expect(kept).toHaveTextContent("✓ Other organisations are not touched")
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Keep them" })).toHaveFocus())
    expect(within(sheet).getByRole("button", { name: "Disconnect 5 apps" })).toBeInTheDocument()
  })

  it("on success the band pulses, the list re-reads, and the receipt uses the SERVER's count", async () => {
    m.listOrgConnectedApps.mockResolvedValueOnce({ apps: FOUR }).mockResolvedValueOnce({ apps: [] })
    m.revokeAllConnectedApps.mockResolvedValue({ revoked: 6, members: 4 })
    const onRecorded = vi.fn()
    render(<OrgConnectedApps orgName="Acme Legal" onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect all connected apps" }))
    const sheet = await screen.findByRole("alertdialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Disconnect 5 apps" }))
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    expect(m.listOrgConnectedApps).toHaveBeenCalledTimes(2)
    const receipt = await screen.findByTestId("org-connected-apps-receipt")
    expect(receipt).toHaveAttribute("role", "status")
    expect(receipt).toHaveTextContent("✎ You disconnected 6 connected apps in Acme Legal · recorded")
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  it("a refusal keeps the sheet open and says they are still connected", async () => {
    m.listOrgConnectedApps.mockResolvedValue({ apps: FOUR })
    m.revokeAllConnectedApps.mockRejectedValue(new Error("Only an admin can do that."))
    const onRecorded = vi.fn()
    render(<OrgConnectedApps orgName="Acme Legal" onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect all connected apps" }))
    const sheet = await screen.findByRole("alertdialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Disconnect 5 apps" }))
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Couldn't disconnect the apps. Only an admin can do that. They are still connected.",
    )
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it("a failed read says so with Retry", async () => {
    m.listOrgConnectedApps.mockRejectedValueOnce(new Error("Down.")).mockResolvedValueOnce({ apps: [] })
    render(<OrgConnectedApps orgName="Acme Legal" />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the connected apps. Down.")
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No connected apps in Acme Legal.")).toBeInTheDocument()
  })

  it("an app is disconnected, never revoked, and no word is typed in the component", () => {
    const lines = orgRaw.split("\n").filter((l) => /Revoke/.test(l) && !/import|revoke[A-Z(]|RevokeAll/.test(l))
    expect(lines).toEqual([])
    expect(orgRaw).not.toMatch(/dangerouslySetInnerHTML/)
    expect(orgRaw).not.toMatch(/>\s*[A-Z][a-z]+ [a-z]+[^<{]*</)
  })
})
