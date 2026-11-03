/**
 * Phase 307-05 (OAUTH-07; D-25, D-26; UI-SPEC §2d) — the per-app Disconnect sheet, the 066
 * victim-naming guard on the RevokeApiKeySheet shape. Never optimistic; "Keep it" holds focus;
 * a failure keeps the sheet open and says the app is still connected.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DisconnectAppSheet } from "../DisconnectAppSheet"
import type { OrgConnectedApp } from "@/lib/api/oauth"
import { MCP_CATALOGUE } from "./fixtures"

const NOW = new Date("2026-11-04T12:00:00Z")

const APP: OrgConnectedApp = {
  id: "g1",
  client_name: "Claude",
  name_source: "dcr",
  redirect_host: "claude.ai",
  redirect_kind: "web",
  org_id: "o1",
  org_name: "Acme Legal",
  tools: ["search_knowledge_base", "list_documents", "read_document"],
  folders: [{ id: "f1", name: "Contracts" }, { id: "f2", name: "2026" }],
  include_external: true,
  created_at: "2026-11-01T10:00:00Z",
  last_used_at: null,
  expires_at: "2027-01-30T10:00:00Z",
  mcp_off: null,
  owner_name: "Lee Park",
  owner_is_you: false,
}

function renderSheet(props: Partial<Parameters<typeof DisconnectAppSheet>[0]> = {}) {
  const onClose = vi.fn()
  const onDone = vi.fn()
  const disconnect = props.disconnect ?? vi.fn().mockResolvedValue({})
  render(
    <DisconnectAppSheet target={APP} mcpTools={MCP_CATALOGUE} now={NOW} onClose={onClose} onDone={onDone} disconnect={disconnect} {...props} />,
  )
  return { onClose, onDone, disconnect }
}

describe("307-05 DisconnectAppSheet", () => {
  it("names the app, its org, its reach, its last use and what is kept; Keep it holds focus", async () => {
    renderSheet()
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByText("Disconnect Claude (claude.ai)?")).toBeInTheDocument()
    expect(sheet).toHaveTextContent("Its next call to Syrel is refused. To use it again, add Syrel in the app and sign in again.")
    const facts = within(sheet).getByTestId("disconnect-facts")
    expect(facts).toHaveTextContent("Acts in Acme Legal")
    expect(facts).toHaveTextContent("Can use Read only on 2 folders and mail & synced sources")
    expect(facts).toHaveTextContent("Last used Not used yet")
    expect(facts).toHaveTextContent("Connected")
    expect(within(sheet).getByTestId("disconnect-kept")).toHaveTextContent(
      "Your chats, documents and API keys are not touched.",
    )
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Keep it" })).toHaveFocus())
    expect(sheet).not.toHaveTextContent(/Revoke/)
  })

  it("the admin sub line names the owner", async () => {
    renderSheet({ admin: true })
    const sheet = await screen.findByRole("alertdialog")
    expect(sheet).toHaveTextContent("This disconnects Lee Park's app. Its next call to Syrel is refused.")
  })

  it("confirm waits for the server, then hands back and closes", async () => {
    let finish: (v: unknown) => void = () => {}
    const disconnect = vi.fn().mockReturnValue(new Promise((r) => (finish = r)))
    const { onDone, onClose } = renderSheet({ disconnect })
    const sheet = await screen.findByRole("alertdialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Disconnect Claude" }))
    expect(disconnect).toHaveBeenCalledWith(APP)
    expect(onDone).not.toHaveBeenCalled()
    expect(within(sheet).getByRole("button", { name: "Disconnecting…" })).toBeDisabled()
    finish({})
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(APP))
    expect(onClose).toHaveBeenCalled()
  })

  it("a failure keeps the sheet open and says the app is still connected", async () => {
    const disconnect = vi.fn().mockRejectedValue(new Error("The server said no."))
    const { onDone, onClose } = renderSheet({ disconnect })
    const sheet = await screen.findByRole("alertdialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Disconnect Claude" }))
    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Couldn't disconnect Claude. The server said no. It is still connected.",
    )
    expect(onDone).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
