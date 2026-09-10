/**
 * Phase 239 plan 03 — F-6, the receipt auto-detection never had.
 *
 * ⭐ WHAT THIS SUITE IS FOR, and why it is a bug rather than a polish item. `239-02` shipped
 * detection that WORKS: pressing *Refresh actions* on a saved MCP row calls
 * `POST /connectors/connections/{id}/discover`, and the server writes
 * `config["source_tools"]` in the same UPDATE as `discovered_tools`. But the panel's seeding
 * effect early-returns on an unchanged `mode:id` key — its own shipped comment says so — and
 * `handleDiscoverTools` sets `probeResult` in memory without re-reading the row. **So the
 * binding lands in the database and both dropdowns keep reading "Not set" until the panel is
 * closed and reopened.**
 *
 * ⚠ NOTHING IS LOST; THE FEEDBACK IS. That makes it the same class of defect as the one this
 * plan exists to fix — a surface telling a person the opposite of what is true — and it is
 * the first step of the phase's owed G-4 UAT row (*"connect an MCP file server, press Refresh
 * actions, and read the binding"*), which cannot pass without it.
 *
 * ⛔ THE SEED IS GUARDED, AND THE GUARD IS THE WHOLE CORRECTNESS. It fills a slot ONLY when
 * that slot is currently empty. A person who typed a binding and then pressed Refresh has an
 * UNSAVED choice the server has never seen; overwriting it with the stored row would be a
 * silent edit of the thing they were in the middle of doing — the wipe `239-02` closed, in a
 * new costume.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionFormPanel } from "../ConnectionFormPanel"
import { SOURCE_TOOLS_LIST_LABEL, SOURCE_TOOLS_READ_LABEL } from "../connectionFormCopy"
import type { ConnectorConnection, McpDiscoveredTool } from "@/lib/api"

const DISCOVERED: McpDiscoveredTool[] = [
  { name: "ls", description: "List a directory." },
  { name: "cat", description: "Read a file." },
  { name: "rm", description: "Delete a file." },
]

/** What the server wrote during the SAME discover call — the row as it now exists. */
const REFRESHED_ROW = {
  id: "conn-mcp-1",
  org_id: "org-1",
  service_id: "custom_mcp",
  name: "Team file server",
  auth_type: "mcp",
  mcp_server_url: "https://files.example.com/mcp",
  config: { headers: {}, source_tools: { list_tool: "ls", read_tool: "cat" } },
  is_enabled: true,
  discovered_tools: DISCOVERED,
} as unknown as ConnectorConnection

const discoverConnectorTools = vi.fn()
const getConnectorConnection = vi.fn()
const probeMcpAuth = vi.fn()

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    discoverConnectorTools: (...args: unknown[]) => discoverConnectorTools(...args),
    getConnectorConnection: (...args: unknown[]) => getConnectorConnection(...args),
    probeMcpAuth: (...args: unknown[]) => probeMcpAuth(...args),
  }
})

/** The row BEFORE the refresh: connected, never discovered, nothing bound. */
function unboundConnection(): ConnectorConnection {
  return {
    ...REFRESHED_ROW,
    config: { headers: {} },
    discovered_tools: [],
  } as unknown as ConnectorConnection
}

/** A row discovered BEFORE `239-02` shipped detection: it has tools and no binding, so the
 *  block is already on screen and a person can make a choice before pressing refresh. */
function discoveredButUnboundConnection(): ConnectorConnection {
  return { ...REFRESHED_ROW, config: { headers: {} } } as unknown as ConnectorConnection
}

function renderEdit(connection: ConnectorConnection) {
  return render(
    <ConnectionFormPanel
      open
      mode="edit"
      isOrgAdmin
      liveConnectorsOn
      connection={connection}
      presetServiceId={null}
      orgName="Northwind"
      onClose={() => {}}
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onSetEnabled={vi.fn().mockResolvedValue(undefined)}
      usedBy={0}
    />,
  )
}

const listSelect = () =>
  screen.getByLabelText(SOURCE_TOOLS_LIST_LABEL) as HTMLSelectElement
const readSelect = () =>
  screen.getByLabelText(SOURCE_TOOLS_READ_LABEL) as HTMLSelectElement

/** The MCP shape's own discovery control — the capability shape's `Refresh actions` button
 *  is deliberately NOT rendered for an `mcp` row (the panel says so in as many words). */
const clickDiscover = () =>
  userEvent.click(screen.getByTestId("connection-probe-mcp-btn"))

beforeEach(() => {
  vi.clearAllMocks()
  discoverConnectorTools.mockResolvedValue(DISCOVERED)
  getConnectorConnection.mockResolvedValue(REFRESHED_ROW)
  probeMcpAuth.mockResolvedValue({ kind: "open" })
})
afterEach(cleanup)

describe("F-6 · a discovery shows the binding it just detected", () => {
  it("⭐ THE DEFECT: after a discovery both dropdowns read the DETECTED names", async () => {
    // Before this, the same click wrote `{list_tool: "ls", read_tool: "cat"}` to the database
    // and left the panel saying "Not set" — correct data, and a screen that denies it.
    renderEdit(unboundConnection())
    await clickDiscover()
    await waitFor(() => expect(listSelect().value).toBe("ls"))
    expect(readSelect().value).toBe("cat")
  })

  it("re-reads the SAVED row — the discover route returns tools, never the binding", async () => {
    renderEdit(unboundConnection())
    await clickDiscover()
    await waitFor(() => expect(getConnectorConnection).toHaveBeenCalledWith("conn-mcp-1"))
  })

  it("⛔ a binding the PERSON chose is never overwritten by the refresh", async () => {
    // The unsaved local choice the server has never seen. Seeding over it would be the
    // 239-02 wipe in a new costume: a silent edit of what they were in the middle of doing.
    // ⚠ The chosen value is `ls`, not `rm`. This case used to pick `rm` — which the picker
    // now correctly refuses to OFFER (CR-01, after the word list was re-synced to the
    // server's 34 on 2026-09-08). The case is about a HUMAN CHOICE surviving a refresh; it
    // was never about `rm`, and asserting on an unofferable value would have quietly turned
    // it into a test of the withholding instead.
    renderEdit(discoveredButUnboundConnection())
    await userEvent.selectOptions(listSelect(), "ls")
    expect(listSelect().value).toBe("ls")

    await clickDiscover()
    await waitFor(() => expect(readSelect().value).toBe("cat"))
    // …the slot they filled is untouched, while the EMPTY one still gets its receipt.
    expect(listSelect().value).toBe("ls")
  })

  it("⛔ a failed re-read changes nothing and never blanks what is on screen", async () => {
    getConnectorConnection.mockRejectedValue(new Error("network"))
    renderEdit(unboundConnection())
    await clickDiscover()
    // The tools still arrived, so the options are there; the binding simply stays unset —
    // exactly the behaviour before this fix, which is the honest degrade.
    // ⚠ NOT `DISCOVERED.length + 1`. `rm` is withheld — CR-01: a destructive tool is never
    // offered as a file reader, and `rm` deleting a file is the whole danger. The old
    // assertion counted it as offered, which was true and WRONG until the word list was
    // re-synced to the server's 34 on 2026-09-08 (`rm` was absent from the frontend's 18).
    const OFFERED = DISCOVERED.filter((t) => t.name !== "rm").length
    await waitFor(() => expect(listSelect().options.length).toBe(OFFERED + 1))
    expect(listSelect().value).toBe("")
  })
})
