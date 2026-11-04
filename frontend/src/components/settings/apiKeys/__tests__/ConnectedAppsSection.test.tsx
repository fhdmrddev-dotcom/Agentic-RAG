/**
 * Phase 307-05 (OAUTH-07; D-25, D-28; UI-SPEC Surface 2) — Settings → API keys → Connected apps.
 *
 * Prices the ways a connected-apps list can lie: a card that lingers after a disconnect the server
 * confirmed (or leaves before it answered), a client's self-chosen name rendered as markup, the key
 * verb ("Revoke") on an app, a receipt that vanishes before it is read, and a section that renders
 * on a deployment where sign-in does not exist. Assertions read RENDERED WORDS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import sectionRaw from "../ConnectedAppsSection.tsx?raw"
import cardRaw from "../ConnectedAppCard.tsx?raw"
import sheetRaw from "../DisconnectAppSheet.tsx?raw"

const m = vi.hoisted(() => ({
  listMyConnectedApps: vi.fn(),
  disconnectApp: vi.fn(),
}))

vi.mock("@/lib/api/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/oauth")>()
  return { ...actual, ...m }
})

import { ConnectedAppsSection } from "../ConnectedAppsSection"
import type { ConnectedApp } from "@/lib/api/oauth"
import { MCP_CATALOGUE } from "./fixtures"

const URL = "https://syrel.example.com/mcp"

function app(over: Partial<ConnectedApp> = {}): ConnectedApp {
  return {
    id: "g1",
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
    last_used_at: null,
    expires_at: "2027-01-30T10:00:00Z",
    mcp_off: null,
    ...over,
  }
}

beforeEach(() => {
  m.listMyConnectedApps.mockReset()
  m.disconnectApp.mockReset()
})

describe("307-05 ConnectedAppsSection", () => {
  it("renders NOTHING and reads nothing when sign-in is not available (the tab is 306's)", async () => {
    const { container } = render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable={false} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container).toBeEmptyDOMElement()
    expect(m.listMyConnectedApps).not.toHaveBeenCalled()
  })

  it("loading says so, then the header names the count and the connector address with its Copy", async () => {
    let resolve: (v: unknown) => void = () => {}
    m.listMyConnectedApps.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading your connected apps…")
    resolve({ apps: [app()] })
    expect(await screen.findByText("Claude")).toBeInTheDocument()
    const section = screen.getByTestId("connected-apps")
    expect(within(section).getByRole("heading", { name: /Connected apps/ })).toBeInTheDocument()
    expect(within(section).getByTestId("connected-apps-count")).toHaveTextContent("1")
    expect(section).toHaveTextContent(
      "Apps you signed in to with your Syrel account, such as Claude.ai, Claude Desktop or Claude Code. Each one acts as you, only in the organisation, folders and tools you picked. Disconnect one and its next call is refused.",
    )
    expect(section).toHaveTextContent("To connect one, add Syrel as a custom connector with this address:")
    expect(within(section).getByText(URL)).toBeInTheDocument()
    expect(within(section).getByRole("button", { name: "Copy the connector address" })).toBeInTheDocument()
  })

  it("with no address says the 305 sentence instead of a dead one", async () => {
    m.listMyConnectedApps.mockResolvedValue({ apps: [] })
    render(<ConnectedAppsSection mcpUrl={null} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    expect(
      await screen.findByText(/doesn't have a public https address for AI tools yet/),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Copy the connector address" })).toBeNull()
  })

  it("empty: the card says where connecting starts, and offers no button", async () => {
    m.listMyConnectedApps.mockResolvedValue({ apps: [] })
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    expect(
      await screen.findByText(
        "No apps connected. When you add Syrel as a connector in Claude.ai, Claude Desktop or Claude Code and sign in, the app shows up here with what it can reach and a Disconnect button.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Disconnect/ })).toBeNull()
  })

  it("a failed read says so with Retry, and Retry reads again", async () => {
    m.listMyConnectedApps.mockRejectedValueOnce(new Error("Network down."))
    m.listMyConnectedApps.mockResolvedValueOnce({ apps: [app()] })
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load your connected apps. Network down.")
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Claude")).toBeInTheDocument()
  })

  it("a web DCR card: name as a claim, the host as the fact, scope chips and the meta line", async () => {
    m.listMyConnectedApps.mockResolvedValue({ apps: [app()] })
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    const card = await screen.findByTestId("connected-app-g1")
    expect(card).toHaveAttribute("data-mark", "web")
    expect(within(card).getByText("calls itself")).toBeInTheDocument()
    expect(within(card).getByTestId("connected-app-host")).toHaveTextContent("claude.ai")
    expect(within(card).queryByText("verified")).toBeNull()
    expect(within(card).getByText("Read only")).toBeInTheDocument()
    expect(within(card).getByText("All folders")).toBeInTheDocument()
    const meta = within(card).getByTestId("connected-app-meta")
    expect(meta).toHaveTextContent("acts in Acme Legal")
    expect(meta).toHaveTextContent("connected")
    expect(meta).toHaveTextContent("Not used yet")
    expect(meta).toHaveTextContent("disconnects itself if unused by")
    expect(within(card).getByRole("button", { name: "Disconnect Claude (claude.ai)" })).toBeInTheDocument()
    // a grant has no secret, prefix, label, call strip or How to connect
    expect(card).not.toHaveTextContent("srl_")
    expect(within(card).queryByText("How to connect")).toBeNull()
  })

  it("a loopback CIMD card: the laptop mark, verified, the bare host", async () => {
    m.listMyConnectedApps.mockResolvedValue({
      apps: [app({ id: "g2", name_source: "cimd", redirect_host: "localhost", redirect_kind: "loopback", client_name: "Claude Code" })],
    })
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    const card = await screen.findByTestId("connected-app-g2")
    expect(card).toHaveAttribute("data-mark", "loopback")
    expect(within(card).getByText("verified")).toBeInTheDocument()
    expect(within(card).queryByText("calls itself")).toBeNull()
    expect(within(card).getByTestId("connected-app-host")).toHaveTextContent(/^localhost$/)
  })

  it("a switched-off app says so on its card", async () => {
    m.listMyConnectedApps.mockResolvedValue({ apps: [app({ mcp_off: "org" })] })
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    const card = await screen.findByTestId("connected-app-g1")
    expect(within(card).getByText("⏸ switched off")).toBeInTheDocument()
    expect(within(card).getByTestId("mcp-off-notice")).toBeInTheDocument()
  })

  it("the client's name is TEXT, never markup (T-307-23)", async () => {
    const evil = '<img src=x onerror="alert(1)">'
    m.listMyConnectedApps.mockResolvedValue({ apps: [app({ client_name: evil })] })
    const { container } = render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    expect(await screen.findByText(evil)).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("disconnect is never optimistic: the card leaves on the re-read, and the receipt stays", async () => {
    const a = app()
    m.listMyConnectedApps.mockResolvedValueOnce({ apps: [a] }).mockResolvedValueOnce({ apps: [] })
    let finish: (v: unknown) => void = () => {}
    m.disconnectApp.mockReturnValue(new Promise((r) => (finish = r)))
    render(<ConnectedAppsSection mcpUrl={URL} mcpTools={MCP_CATALOGUE} oauthAvailable />)
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect Claude (claude.ai)" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByText("Disconnect Claude (claude.ai)?")).toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole("button", { name: "Disconnect Claude" }))
    expect(m.disconnectApp).toHaveBeenCalledWith(a)
    // in flight: the card is still there, the sheet still open
    expect(screen.getByTestId("connected-app-g1")).toBeInTheDocument()
    expect(within(sheet).getByRole("button", { name: "Disconnecting…" })).toBeDisabled()
    finish({})
    await waitFor(() => expect(screen.queryByTestId("connected-app-g1")).toBeNull())
    expect(m.listMyConnectedApps).toHaveBeenCalledTimes(2)
    const receipt = screen.getByTestId("connected-apps-receipt")
    expect(receipt).toHaveAttribute("role", "status")
    expect(receipt).toHaveTextContent("✎ Claude (claude.ai) disconnected · recorded")
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByTestId("connected-apps-receipt")).toBeInTheDocument() // no timer
  })

  it("an app is disconnected, never revoked (A-23), and no new string is typed in a component", () => {
    for (const raw of [sectionRaw, cardRaw, sheetRaw]) {
      const lines = raw.split("\n").filter((l) => /Revoke/.test(l) && !/import|revoke[A-Z(]|RevokeAll/.test(l))
      expect(lines).toEqual([])
      expect(raw).not.toMatch(/dangerouslySetInnerHTML/)
      // JSX text nodes made of words belong in oauthCopy.ts / mcpKeyCopy.ts
      expect(raw).not.toMatch(/>\s*[A-Z][a-z]+ [a-z]+[^<{]*</)
    }
  })
})
