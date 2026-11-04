/**
 * Phase 293-04 (START-02; D-02, D-04, D-11, D-18, D-19, T-293-21) — Settings → API keys, member view.
 *
 * Each case prices a lived failure from 293-UI-SPEC §"How we'd know this UI failed":
 *   · the secret visible after "I've saved the secret", or written to localStorage /
 *     sessionStorage / the URL at ANY point of the flow (failure 1);
 *   · a start `curl` built without the workflow's declared fields (failure 2);
 *   · the ⋯ menu landing without the workflow ticked (failure 9);
 *   · a create failure that throws the person's choices away.
 * Assertions read RENDERED WORDS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ApiKeyList, StartableWorkflowList } from "@/lib/api/apiKeys"
import { READ_ONLY_TOOLS, makeFolder, makeKey, makeMcp, makeMcpKey, makeStartable } from "./fixtures"

const m = vi.hoisted(() => ({
  listApiKeys: vi.fn(),
  listStartableWorkflows: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  // 304-05: the MCP draft's folder read.
  listPickableFolders: vi.fn(),
}))

vi.mock("@/lib/api/apiKeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/apiKeys")>()
  return { ...actual, ...m }
})

import { ApiKeysTab } from "../ApiKeysTab"

const SECRET = "srl_live_TESTsecretNOTreal0000000000000000000000"
const LIMITS = { starts_per_minute: 10, reads_per_minute: 120, searches_per_minute: 30 }
const EMPTY: ApiKeyList = { keys: [], limits: LIMITS }
const PICKER: StartableWorkflowList = {
  workflows: [
    makeStartable(),
    makeStartable({ id: "w2", name: "Weekly digest", fields: [] }),
    makeStartable({ id: "w3", name: "Scan intake", startable: false, reason: "file_upload", fields: [] }),
  ],
  drafts_hidden: 2,
}
const FOLDERS = [makeFolder({ id: "f1", name: "Contracts" }), makeFolder({ id: "f2", name: "Policies", shared: true })]

let setItemSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset()
  m.listStartableWorkflows.mockResolvedValue(PICKER)
  m.listPickableFolders.mockResolvedValue({ folders: FOLDERS })
  sessionStorage.clear()
  localStorage.clear()
  setItemSpy = vi.spyOn(Storage.prototype, "setItem")
})

afterEach(() => {
  setItemSpy.mockRestore()
})

function storageNeverHeld(secret: string) {
  for (const call of setItemSpy.mock.calls) {
    expect(String(call[0]) + String(call[1])).not.toContain(secret)
  }
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i++) {
      expect(store.getItem(store.key(i) ?? "") ?? "").not.toContain(secret)
    }
  }
  expect(window.location.href).not.toContain(secret)
}

describe("293-04 ApiKeysTab — reading the list", () => {
  it("loading shows the status line and no New key button", () => {
    m.listApiKeys.mockReturnValue(new Promise(() => {}))
    render(<ApiKeysTab />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading your keys…")
    expect(screen.queryByRole("button", { name: "New key" })).toBeNull()
    expect(screen.getByText("API keys")).toBeInTheDocument()
  })

  it("a failed read shows the alert and Retry reads again", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockRejectedValueOnce(new Error("The server is down.")).mockResolvedValueOnce(EMPTY)
    render(<ApiKeysTab />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load your API keys. The server is down.")
    await user.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await screen.findByText(/No keys yet\./)).toBeInTheDocument()
    expect(m.listApiKeys).toHaveBeenCalledTimes(2)
  })

  it("empty: the KeyRound sentence and New key; no limits line", async () => {
    m.listApiKeys.mockResolvedValue(EMPTY)
    render(<ApiKeysTab />)
    expect(await screen.findByText(/No keys yet\. A key lets another system/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New key" })).toBeInTheDocument()
    expect(screen.queryByTestId("api-keys-limits")).toBeNull()
  })

  it("has keys: the limits line from the server and the cards in order", async () => {
    m.listApiKeys.mockResolvedValue({
      keys: [makeKey({ id: "old", label: "old-key", state: "revoked" }), makeKey({ id: "live", label: "live-key" })],
      limits: { starts_per_minute: 7, reads_per_minute: 90, searches_per_minute: 30 },
    })
    render(<ApiKeysTab />)
    expect(await screen.findByTestId("api-keys-limits")).toHaveTextContent(
      "Each key: 7 starts and 90 status reads a minute. Set by your operator.",
    )
    const labels = screen.getAllByTestId("api-key-card").map((c) => within(c).getByTestId("api-key-label").textContent)
    expect(labels).toEqual(["live-key", "old-key"])
    expect(screen.getByRole("button", { name: "New key" })).toBeInTheDocument()
  })
})

describe("293-04 ApiKeysTab — the draft card", () => {
  it("New key opens the draft with focus in Label; Create key is disabled with its reason", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(EMPTY)
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    expect(within(draft).getByText("draft · not created")).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(within(draft).getByLabelText("Label")))
    expect(screen.queryByRole("button", { name: "New key" })).toBeNull()
    const create = within(draft).getByRole("button", { name: "Create key" })
    expect(create).toBeDisabled()
    expect(create).toHaveAccessibleDescription("Add a label.")
    await user.type(within(draft).getByLabelText("Label"), "n8n-prod")
    expect(create).toHaveAccessibleDescription("Pick at least one workflow.")
    await user.click(await within(draft).findByRole("checkbox", { name: /Contract review/ }))
    expect(create).toBeEnabled()
  })

  it("lists published workflows with their keys, disables a file-upload one, and counts hidden drafts", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(EMPTY)
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    expect(await within(draft).findByText("counterparty, due_date")).toBeInTheDocument()
    expect(within(draft).getByText("no inputs")).toBeInTheDocument()
    expect(within(draft).getByRole("checkbox", { name: /Scan intake/ })).toBeDisabled()
    expect(within(draft).getByText("needs a file upload, not possible with a key yet")).toBeInTheDocument()
    expect(within(draft).getByText("Only published workflows are listed. 2 drafts are hidden until they are published.")).toBeInTheDocument()
    // Expires: a radiogroup with 90 days preselected (D-04).
    const group = within(draft).getByRole("radiogroup", { name: "Expires" })
    expect(within(group).getByRole("radio", { name: "90 days" })).toHaveAttribute("aria-checked", "true")
    expect(within(draft).getByText("You can revoke it any time before then.")).toBeInTheDocument()
    await user.click(within(group).getByRole("radio", { name: "Never" }))
    expect(within(draft).getByText("It works until you revoke it.")).toBeInTheDocument()
  })

  it("no published workflows → the no-workflows sentence; the one-draft wording", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(EMPTY)
    m.listStartableWorkflows.mockResolvedValue({ workflows: [], drafts_hidden: 1 })
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    expect(
      await screen.findByText("You have no published workflows yet. Publish one on the Workflows page, then make a key for it."),
    ).toBeInTheDocument()
    expect(screen.getByText("Only published workflows are listed. 1 draft is hidden until it is published.")).toBeInTheDocument()
  })

  it("Discard draft closes it; Esc does not", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(EMPTY)
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    await user.type(within(draft).getByLabelText("Label"), "x")
    await user.keyboard("{Escape}")
    expect(screen.getByTestId("api-key-draft")).toBeInTheDocument()
    await user.click(within(draft).getByRole("button", { name: "Discard draft" }))
    expect(screen.queryByTestId("api-key-draft")).toBeNull()
  })

  it("a create failure keeps the values and shows the server's sentence", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(EMPTY)
    m.createApiKey.mockRejectedValue(new Error("You already have an active key called n8n-prod."))
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    await user.type(within(draft).getByLabelText("Label"), "n8n-prod")
    await user.click(await within(draft).findByRole("checkbox", { name: /Contract review/ }))
    await user.click(within(draft).getByRole("button", { name: "Create key" }))
    expect(await within(draft).findByRole("alert")).toHaveTextContent(
      "Couldn't create the key. You already have an active key called n8n-prod. Your choices are kept; try again.",
    )
    expect(within(draft).getByLabelText("Label")).toHaveValue("n8n-prod")
    expect(within(draft).getByRole("checkbox", { name: /Contract review/ })).toBeChecked()
  })
})

describe("293-04 ApiKeysTab — the secret, shown once", () => {
  async function createOne(user: ReturnType<typeof userEvent.setup>) {
    m.listApiKeys.mockResolvedValue(EMPTY)
    const created = makeKey({ id: "new", label: "n8n-prod", last_used_at: null, calls: [] })
    m.createApiKey.mockResolvedValue({ key: created, secret: SECRET })
    const view = render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    await user.type(within(draft).getByLabelText("Label"), "n8n-prod")
    await user.click(await within(draft).findByRole("checkbox", { name: /Contract review/ }))
    m.listApiKeys.mockResolvedValue({ keys: [created], limits: LIMITS })
    await user.click(within(draft).getByRole("button", { name: "Create key" }))
    const once = await screen.findByTestId("api-key-once")
    return Object.assign(once, { unmountTab: view.unmount })
  }

  it("sends label, the picked ids and 90 days by default", async () => {
    const user = userEvent.setup()
    await createOne(user)
    expect(m.createApiKey).toHaveBeenCalledWith({ label: "n8n-prod", workflow_ids: ["w1"], expires_in_days: 90 })
  })

  it("swaps the draft for the show-once card: warning, secret, start + status curl, closed sample", async () => {
    const user = userEvent.setup()
    const once = await createOne(user)
    expect(screen.queryByTestId("api-key-draft")).toBeNull()
    expect(within(once).getByText("● created")).toBeInTheDocument()
    expect(within(once).getByText(/Copy the secret now\. It is not stored and can't be shown again/)).toBeInTheDocument()
    expect(within(once).getByTestId("api-key-secret")).toHaveTextContent(SECRET)
    const start = within(once).getByTestId("curl-start").textContent ?? ""
    expect(start).toContain("/inbound/workflows/w1/runs")
    expect(start).toContain(`Authorization: Bearer ${SECRET}`)
    expect(start).toContain(`{"inputs": {"counterparty": "<counterparty>", "due_date": "<due_date>"}}`)
    expect(within(once).getByTestId("curl-status").textContent).toContain("/inbound/runs/RUN_ID")
    expect(within(once).getByText("Start Contract review")).toBeInTheDocument()
    expect(within(once).getByText("Read its status and result (poll until it finishes)")).toBeInTheDocument()
    const details = within(once).getByText("What a status read returns").closest("details")
    expect(details).not.toBeNull()
    expect(details!.open).toBe(false)
    const guide = within(once).getByRole("link", { name: "Guide: start a workflow from outside ↗" })
    expect(guide).toHaveAttribute("href", "/docs/api/guides/start-a-workflow-from-outside")
    expect(guide).toHaveAttribute("target", "_blank")
    expect(guide.getAttribute("rel")).toContain("noopener")
    expect(screen.queryByRole("button", { name: "New key" })).toBeNull()
    storageNeverHeld(SECRET)
  })

  it("after I've saved the secret, the secret is gone from the DOM and the card is an ordinary key card", async () => {
    const user = userEvent.setup()
    const once = await createOne(user)
    await user.click(within(once).getByRole("button", { name: "I've saved the secret" }))
    expect(screen.queryByTestId("api-key-once")).toBeNull()
    expect(document.body.textContent).not.toContain(SECRET)
    const card = await screen.findByTestId("api-key-card")
    expect(within(card).getByTestId("api-key-label")).toHaveTextContent("n8n-prod")
    expect(card).toHaveAttribute("data-fresh", "true")
    expect(screen.getByRole("button", { name: "New key" })).toBeInTheDocument()
    storageNeverHeld(SECRET)
  })

  it("the secret does not survive an unmount", async () => {
    const user = userEvent.setup()
    const once = await createOne(user)
    once.unmountTab()
    expect(document.body.textContent).not.toContain(SECRET)
    storageNeverHeld(SECRET)
  })

  it("a key on two workflows says the other one works the same way", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(EMPTY)
    m.createApiKey.mockResolvedValue({
      key: makeKey({
        id: "new",
        workflows: [
          { id: "w1", name: "Contract review", state: "startable" },
          { id: "w2", name: "Weekly digest", state: "startable" },
        ],
      }),
      secret: SECRET,
    })
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    await user.type(within(draft).getByLabelText("Label"), "two")
    await user.click(await within(draft).findByRole("checkbox", { name: /Contract review/ }))
    await user.click(within(draft).getByRole("checkbox", { name: /Weekly digest/ }))
    await user.click(within(draft).getByRole("button", { name: "Create key" }))
    expect(await screen.findByText("Start Contract review (the other 1 work the same way)")).toBeInTheDocument()
  })
})

describe("293-04 ApiKeysTab — the ⋯ menu pre-pick", () => {
  it("opens the draft with that workflow ticked and the from-menu hint, read once", async () => {
    sessionStorage.setItem("api_keys_prepick", JSON.stringify({ workflowId: "w1", name: "Contract review" }))
    m.listApiKeys.mockResolvedValue(EMPTY)
    render(<ApiKeysTab />)
    const draft = await screen.findByTestId("api-key-draft")
    // The hint waits for the server's list, so it never says "already picked" about a row it can't tick.
    expect(await within(draft).findByText("From the ⋯ menu of Contract review. It is already picked.")).toBeInTheDocument()
    expect(await within(draft).findByRole("checkbox", { name: /Contract review/ })).toBeChecked()
    expect(sessionStorage.getItem("api_keys_prepick")).toBeNull()
  })

  it("a file-upload pre-pick shows the can't-be-picked hint and ticks nothing", async () => {
    sessionStorage.setItem("api_keys_prepick", JSON.stringify({ workflowId: "w3", name: "Scan intake" }))
    m.listApiKeys.mockResolvedValue(EMPTY)
    render(<ApiKeysTab />)
    const draft = await screen.findByTestId("api-key-draft")
    expect(
      await within(draft).findByText("From the ⋯ menu of Scan intake. It needs a file upload, so a key can't start it yet."),
    ).toBeInTheDocument()
    expect(within(draft).getAllByRole("checkbox").filter((c) => (c as HTMLInputElement).checked)).toHaveLength(0)
  })
})

describe("293-04 ApiKeysTab — revoke", () => {
  it("revoking re-fetches the list; the card turns revoked from the server's answer", async () => {
    const user = userEvent.setup()
    const live = makeKey()
    m.listApiKeys.mockResolvedValueOnce({ keys: [live], limits: LIMITS })
    m.revokeApiKey.mockResolvedValue({ ...live, state: "revoked" })
    render(<ApiKeysTab />)
    await user.click(await screen.findByRole("button", { name: "Revoke n8n-prod" }))
    m.listApiKeys.mockResolvedValueOnce({
      keys: [{ ...live, state: "revoked", revoked_at: live.created_at, revoked_by_name: "Dana Kim" }],
      limits: LIMITS,
    })
    // The sheet's confirm carries the same accessible name; Radix hides the card behind the dialog.
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Revoke n8n-prod" }))
    await waitFor(() => expect(m.revokeApiKey).toHaveBeenCalledWith("k1"))
    expect(await screen.findByTestId("api-key-receipt")).toHaveTextContent(/✎ Revoked by you/)
    expect(m.listApiKeys).toHaveBeenCalledTimes(2)
  })
})

// ── Phase 304-05: the MCP kind (D-01, D-07, D-08, D-30; SC2 / KEY-04; G-4 row 2) ─────────────────

const MCP_EMPTY: ApiKeyList = { keys: [], limits: LIMITS, mcp: makeMcp() }

async function openMcpDraft(user: ReturnType<typeof userEvent.setup>, list: ApiKeyList = MCP_EMPTY) {
  m.listApiKeys.mockResolvedValue(list)
  render(<ApiKeysTab />)
  await user.click(await screen.findByRole("button", { name: "New key" }))
  const draft = await screen.findByTestId("api-key-draft")
  await user.click(within(draft).getByRole("radio", { name: /For an AI tool \(MCP\)/ }))
  return draft
}

describe("304-05 ApiKeysTab — the kind choice", () => {
  it("New key starts with the choice: no Label, no Create key, only Discard and why; focus on the first tile", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue(MCP_EMPTY)
    render(<ApiKeysTab />)
    expect(await screen.findByText(/No keys yet\. An AI tool key lets Claude Code/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    const group = within(draft).getByRole("radiogroup", { name: "What is this key for?" })
    expect(within(group).getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true)
    expect(within(draft).queryByLabelText("Label")).toBeNull()
    expect(within(draft).queryByRole("button", { name: "Create key" })).toBeNull()
    expect(within(draft).getByRole("button", { name: "Discard draft" })).toBeInTheDocument()
    expect(within(draft).getByText("Choose what the key is for.")).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(within(group).getAllByRole("radio")[0]))
  })

  it("choosing a kind moves focus to Label; switching kind keeps the Label", async () => {
    const user = userEvent.setup()
    const draft = await openMcpDraft(user)
    await waitFor(() => expect(document.activeElement).toBe(within(draft).getByLabelText("Label")))
    expect(within(draft).getByLabelText("Label")).toHaveAttribute("placeholder", "e.g. claude-code-laptop")
    await user.type(within(draft).getByLabelText("Label"), "laptop")
    await user.click(within(draft).getByRole("radio", { name: /For a workflow integration/ }))
    expect(within(draft).getByLabelText("Label")).toHaveValue("laptop")
    expect(await within(draft).findByRole("checkbox", { name: /Contract review/ })).toBeInTheDocument()
    await user.click(within(draft).getByRole("radio", { name: /For an AI tool \(MCP\)/ }))
    expect(within(draft).getByLabelText("Label")).toHaveValue("laptop")
  })

  it("deployment off / not available: no choice row, the 293 draft as it was (D-30)", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, mcp: makeMcp({ available: false, off: "deployment", url: null }) })
    render(<ApiKeysTab />)
    expect(await screen.findByText(/No keys yet\. A key lets another system/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    expect(within(draft).queryByRole("radiogroup", { name: "What is this key for?" })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(within(draft).getByLabelText("Label")))
    expect(within(draft).getByRole("radio", { name: "Never" })).toBeInTheDocument()
    expect(screen.queryByTestId("mcp-off-notice")).toBeNull()
  })

  it("a failed switch read (unknown): the header and card say we couldn't check, never the operator (304-REVIEW WR-02)", async () => {
    const unknown = "Couldn't check whether AI tool access is on. Reload to try again."
    m.listApiKeys.mockResolvedValue({
      ...MCP_EMPTY,
      keys: [makeMcpKey({ mcp_off: "unknown" })],
      mcp: makeMcp({ available: false, off: "unknown" }),
    })
    render(<ApiKeysTab />)
    const notices = await screen.findAllByTestId("mcp-off-notice")
    expect(notices.length).toBeGreaterThan(0)
    for (const n of notices) expect(n).toHaveTextContent(unknown)
    expect(screen.queryByText(/by the operator/)).toBeNull()
    expect(screen.queryByText(/by an admin/)).toBeNull()
  })

  it("org off: the MCP tile is disabled with the org sentence; the header says so", async () => {
    const user = userEvent.setup()
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, mcp: makeMcp({ off: "org" }) })
    render(<ApiKeysTab />)
    expect(await screen.findByTestId("mcp-off-notice")).toHaveTextContent(
      "MCP access is switched off for this organisation by an admin.",
    )
    await user.click(screen.getByRole("button", { name: "New key" }))
    const draft = await screen.findByTestId("api-key-draft")
    const mcpTile = within(draft).getByRole("radio", { name: /For an AI tool \(MCP\)/ })
    expect(mcpTile).toHaveAttribute("aria-disabled", "true")
    expect(within(mcpTile).getByText("MCP access is switched off for this organisation by an admin.")).toBeInTheDocument()
  })

  it("the ⋯ menu pre-pick pre-selects the workflow kind and ticks the workflow", async () => {
    sessionStorage.setItem("api_keys_prepick", JSON.stringify({ workflowId: "w1", name: "Contract review" }))
    m.listApiKeys.mockResolvedValue(MCP_EMPTY)
    render(<ApiKeysTab />)
    const draft = await screen.findByTestId("api-key-draft")
    expect(await within(draft).findByRole("radio", { name: /For a workflow integration/ })).toHaveAttribute("aria-checked", "true")
    expect(await within(draft).findByRole("checkbox", { name: /Contract review/ })).toBeChecked()
  })

  it("the limits line shows only when a workflow key exists", async () => {
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, keys: [makeMcpKey()] })
    const { unmount } = render(<ApiKeysTab />)
    expect(await screen.findByTestId("api-key-card")).toBeInTheDocument()
    expect(screen.queryByTestId("api-keys-limits")).toBeNull()
    unmount()
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, keys: [makeMcpKey(), makeKey()] })
    render(<ApiKeysTab />)
    expect(await screen.findByTestId("api-keys-limits")).toBeInTheDocument()
  })

  it("305-03: with an AI tool key, the MCP limits line names searches and reads; without one, it is absent", async () => {
    const limits = { starts_per_minute: 10, reads_per_minute: 90, searches_per_minute: 25 }
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, limits, keys: [makeMcpKey()] })
    const { unmount } = render(<ApiKeysTab />)
    expect(await screen.findByTestId("api-keys-limits-mcp")).toHaveTextContent(
      "Each AI tool key: 25 searches and 90 reads a minute. Set by your operator.",
    )
    unmount()
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, limits, keys: [makeKey()] })
    render(<ApiKeysTab />)
    expect(await screen.findByTestId("api-keys-limits")).toBeInTheDocument()
    expect(screen.queryByTestId("api-keys-limits-mcp")).toBeNull()
  })
})

describe("304-05 ApiKeysTab — the MCP draft", () => {
  it("the default body: Read only, All folders, no external, 90 days (SC2)", async () => {
    const user = userEvent.setup()
    const draft = await openMcpDraft(user)
    m.createApiKey.mockResolvedValue({ key: makeMcpKey({ id: "new" }), secret: "srl_mcp_TESTsecretNOTreal000000000000000000" })
    await user.type(within(draft).getByLabelText("Label"), "claude-code-laptop")
    await user.click(within(draft).getByRole("button", { name: "Create key" }))
    expect(m.createApiKey).toHaveBeenCalledWith({
      kind: "mcp",
      label: "claude-code-laptop",
      tools: READ_ONLY_TOOLS,
      folder_ids: null,
      include_external: false,
      expires_in_days: 90,
    })
  })

  it("Only these folders with none ticked: Create key disabled and says why (G-4 row 2)", async () => {
    const user = userEvent.setup()
    const draft = await openMcpDraft(user)
    await user.type(within(draft).getByLabelText("Label"), "laptop")
    await user.click(within(draft).getByRole("radio", { name: "Only these folders" }))
    await waitFor(() => expect(m.listPickableFolders).toHaveBeenCalled())
    const create = within(draft).getByRole("button", { name: "Create key" })
    expect(create).toBeDisabled()
    expect(create).toHaveAccessibleDescription("Tick at least one folder, or choose All folders I can see.")
    await user.click(await within(draft).findByRole("checkbox", { name: /Contracts/ }))
    expect(create).toBeEnabled()
    m.createApiKey.mockResolvedValue({ key: makeMcpKey({ id: "new" }), secret: "srl_mcp_x" })
    await user.click(create)
    expect(m.createApiKey).toHaveBeenCalledWith(expect.objectContaining({ folder_ids: ["f1"] }))
  })

  it("Create key says Add a label first", async () => {
    const user = userEvent.setup()
    const draft = await openMcpDraft(user)
    expect(within(draft).getByRole("button", { name: "Create key" })).toHaveAccessibleDescription("Add a label.")
  })

  it("a server refusal renders its sentence and keeps every choice", async () => {
    const user = userEvent.setup()
    const draft = await openMcpDraft(user)
    m.createApiKey.mockRejectedValue(new Error("Pick at least one folder, or choose All folders I can see."))
    await user.type(within(draft).getByLabelText("Label"), "laptop")
    await user.click(within(draft).getByRole("radio", { name: "Read and ask" }))
    await user.click(within(draft).getByRole("radio", { name: "365 days" }))
    await user.click(within(draft).getByRole("button", { name: "Create key" }))
    expect(await within(draft).findByRole("alert")).toHaveTextContent(
      "Couldn't create the key. Pick at least one folder, or choose All folders I can see. Your choices are kept; try again.",
    )
    expect(within(draft).getByLabelText("Label")).toHaveValue("laptop")
    expect(within(draft).getByRole("radio", { name: "Read and ask" })).toHaveAttribute("aria-checked", "true")
    expect(within(draft).getByRole("radio", { name: "365 days" })).toHaveAttribute("aria-checked", "true")
  })

  it("G-4 row 1 (unit): the secret once with the Claude Code snippet, then gone; the card reads its defaults", async () => {
    const user = userEvent.setup()
    const MCP_SECRET = "srl_mcp_TESTsecretNOTreal0000000000000000000000"
    const created = makeMcpKey({ id: "new" })
    const draft = await openMcpDraft(user)
    m.createApiKey.mockResolvedValue({ key: created, secret: MCP_SECRET })
    await user.type(within(draft).getByLabelText("Label"), "claude-code-laptop")
    m.listApiKeys.mockResolvedValue({ ...MCP_EMPTY, keys: [created] })
    await user.click(within(draft).getByRole("button", { name: "Create key" }))
    const once = await screen.findByTestId("api-key-once")
    expect(within(once).getByTestId("api-key-secret")).toHaveTextContent(MCP_SECRET)
    const snippet = within(once).getByTestId("mcp-snippet-claudeCode").textContent ?? ""
    expect(snippet).toContain("${SYREL_MCP_KEY}")
    expect(snippet).not.toContain(MCP_SECRET)
    expect(within(once).queryByTestId("curl-start")).toBeNull()
    expect(within(once).queryByTestId("curl-status")).toBeNull()
    expect(within(once).getByRole("note")).toHaveTextContent(/Don't paste this key into Claude\.ai/)
    expect(within(once).getAllByTestId("api-key-chip").map((c) => c.textContent)).toEqual(["Read only", "All folders"])
    storageNeverHeld(MCP_SECRET)

    await user.click(within(once).getByRole("button", { name: "I've saved the secret" }))
    expect(screen.queryByTestId("api-key-once")).toBeNull()
    expect(document.body.textContent).not.toContain(MCP_SECRET)
    const card = await screen.findByTestId("api-key-card")
    expect(within(card).getByText("● active")).toBeInTheDocument()
    expect(within(card).getAllByTestId("api-key-chip").map((c) => c.textContent)).toEqual(["Read only", "All folders"])
    expect(within(card).getByTestId("api-key-meta")).toHaveTextContent("Not used yet")
    expect(within(card).getByTestId("api-key-meta")).toHaveTextContent(/expires \w{3} \d+ \w{3}/)
    storageNeverHeld(MCP_SECRET)
  })

  it("a failed folder read says so and Retry reads again", async () => {
    const user = userEvent.setup()
    m.listPickableFolders.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ folders: FOLDERS })
    const draft = await openMcpDraft(user)
    await user.click(within(draft).getByRole("radio", { name: "Only these folders" }))
    const alert = await within(draft).findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load your folders.")
    await user.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await within(draft).findByRole("checkbox", { name: /Contracts/ })).toBeInTheDocument()
  })
})
