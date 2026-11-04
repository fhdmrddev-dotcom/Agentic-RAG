/**
 * Phase 308-05 (D-04, D-12, D-19, D-28, P-2; UI-SPEC §1a, §1i, A-18, A-19, A-26) — Settings →
 * Webhooks, the member's tab.
 *
 * The list is the ACTIVE org's only and re-reads when the active org changes (dropping any open
 * secret). One card is open at a time. Create shows the secret once in place of the form. Delete
 * leaves a receipt and moves focus to the header title. A "Waiting on you" focus hint opens its card,
 * or says the endpoint is in another org with "Switch to {org}". Assertions read rendered words.
 */
import { StrictMode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import tabRaw from "../WebhooksTab.tsx?raw"

const m = vi.hoisted(() => ({
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  sendWebhookTest: vi.fn(),
  listWebhookDeliveries: vi.fn(),
}))
const org = vi.hoisted(() => ({
  value: {
    activeOrgId: "o1" as string | null,
    orgs: [
      { org_id: "o1", name: "Acme Legal" },
      { org_id: "o2", name: "Beta Corp" },
    ],
    switchOrg: vi.fn(),
  },
}))

vi.mock("@/lib/api/webhooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/webhooks")>()
  return { ...actual, ...m }
})
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value }))

import { WebhooksTab } from "../WebhooksTab"
import { writeWebhookFocus } from "../webhookFocus"
import type { WebhookEndpoint } from "@/lib/api/webhooks"

function endpoint(id: string, over: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id,
    url: `https://${id}.example.com/in`,
    description: null,
    event_types: ["run.finished"],
    enabled: true,
    disabled_reason: null,
    disabled_at: null,
    last_success_at: null,
    consecutive_failures: 0,
    previous_secret_expires_at: null,
    created_at: "2026-11-01T09:00:00Z",
    ...over,
  }
}

function list(endpoints: WebhookEndpoint[], orgName = "Acme Legal") {
  return { endpoints, cap: 10, org_name: orgName }
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset()
  org.value.activeOrgId = "o1"
  org.value.switchOrg.mockReset()
  m.listWebhookDeliveries.mockResolvedValue({ deliveries: [], next_cursor: null })
  sessionStorage.clear()
})

describe("308-05 WebhooksTab", () => {
  it("header: title, count, description, scope naming the org; the cards newest first", async () => {
    m.listWebhooks.mockResolvedValue(
      list([endpoint("older", { created_at: "2026-10-01T09:00:00Z" }), endpoint("newer", { created_at: "2026-11-02T09:00:00Z" })]),
    )
    render(<WebhooksTab />)
    expect(screen.getByText("Loading your webhooks…")).toBeInTheDocument()
    expect(await screen.findByText("2 of 10")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /Webhooks/ })).toBeInTheDocument()
    expect(
      screen.getByText(/Syrel tells your own systems when a run finishes, a run waits on you, or a document is ingested\./),
    ).toBeInTheDocument()
    expect(screen.getByText(/Each one gets events from/).closest("p")).toHaveTextContent(
      "Endpoints in Acme Legal. Each one gets events from Acme Legal only.",
    )
    const toggles = screen.getAllByRole("button", { expanded: false })
    expect(toggles[0]).toHaveTextContent("newer.example.com")
    expect(toggles[1]).toHaveTextContent("older.example.com")
    expect(screen.getByRole("button", { name: "Add endpoint" })).toBeEnabled()
  })

  it("empty: one sentence and Add endpoint", async () => {
    m.listWebhooks.mockResolvedValue(list([]))
    render(<WebhooksTab />)
    expect(
      await screen.findByText("No endpoints yet. Add an https address your system listens on, pick the events, and send a test."),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Add endpoint" })).toHaveLength(1)
  })

  it("at the cap: Add endpoint is disabled with its reason as DOM text", async () => {
    m.listWebhooks.mockResolvedValue(list(Array.from({ length: 10 }, (_, i) => endpoint(`e${i}`))))
    render(<WebhooksTab />)
    const add = await screen.findByRole("button", { name: "Add endpoint" })
    expect(add).toBeDisabled()
    const why = screen.getByText("You have 10 endpoints in Acme Legal, the most allowed. Delete one to add another.")
    expect(add.getAttribute("aria-describedby")).toBe(why.id)
  })

  it("a failed load says so with Retry; a failed RE-read keeps the last-known list", async () => {
    const user = userEvent.setup()
    m.listWebhooks
      .mockRejectedValueOnce(new Error("Server down."))
      .mockResolvedValueOnce(list([endpoint("a"), endpoint("b")]))
      .mockRejectedValueOnce(new Error("Again."))
    m.deleteWebhook.mockResolvedValue(undefined)
    render(<WebhooksTab />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your webhooks. Server down.")
    await user.click(screen.getByRole("button", { name: "Retry" }))
    const [a] = await screen.findAllByRole("button", { expanded: false })
    expect(screen.queryByRole("alert")).toBeNull()
    await user.click(a)
    await user.click(screen.getByRole("button", { name: "Delete a.example.com" }))
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete endpoint" }))
    expect(await screen.findByText("Couldn't load your webhooks. Again.")).toBeInTheDocument()
    expect(screen.getByText(/b\.example\.com/)).toBeInTheDocument()
  })

  it("one card open at a time", async () => {
    const user = userEvent.setup()
    m.listWebhooks.mockResolvedValue(list([endpoint("a"), endpoint("b")]))
    render(<WebhooksTab />)
    const [a, b] = await screen.findAllByRole("button", { expanded: false })
    await user.click(a)
    expect(a).toHaveAttribute("aria-expanded", "true")
    await user.click(b)
    expect(b).toHaveAttribute("aria-expanded", "true")
    expect(a).toHaveAttribute("aria-expanded", "false")
  })

  it("Add: the form, then the secret once in its place (only filled button), then the list", async () => {
    const user = userEvent.setup()
    m.listWebhooks.mockResolvedValueOnce(list([])).mockResolvedValue(list([endpoint("new")]))
    m.createWebhook.mockResolvedValue({ endpoint: endpoint("new"), secret: "whsec_shown_once" })
    m.sendWebhookTest.mockResolvedValue({ delivered: true, status_code: 200, latency_ms: 50, error: null })
    render(<WebhooksTab />)
    await user.click(await screen.findByRole("button", { name: "Add endpoint" }))
    expect(screen.getByText("Add an endpoint")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add endpoint" })).toBeNull()
    await user.type(screen.getByLabelText("Address"), "https://new.example.com/in")
    await user.click(screen.getByRole("button", { name: "Save endpoint" }))

    expect(await screen.findByText("whsec_shown_once")).toBeInTheDocument()
    expect(screen.queryByText("Add an endpoint")).toBeNull()
    expect(screen.queryByRole("button", { name: "Add endpoint" })).toBeNull()
    // the new endpoint is not ALSO listed while its secret shows
    expect(screen.queryAllByRole("button", { expanded: false })).toHaveLength(0)

    await user.click(screen.getByRole("button", { name: "Send test" }))
    expect(await screen.findByText(/It is in this endpoint's log\./)).toBeInTheDocument()
    expect(m.sendWebhookTest).toHaveBeenCalledWith("new")

    await user.click(screen.getByRole("button", { name: "I've saved the secret" }))
    expect(document.body.textContent).not.toContain("whsec_shown_once")
    expect(await screen.findByRole("button", { expanded: false })).toHaveTextContent("new.example.com")
  })

  it("an org switch re-reads the list and drops an open secret (P-2)", async () => {
    const user = userEvent.setup()
    m.listWebhooks.mockResolvedValueOnce(list([])).mockResolvedValueOnce(list([])).mockResolvedValue(list([endpoint("beta")], "Beta Corp"))
    m.createWebhook.mockResolvedValue({ endpoint: endpoint("x"), secret: "whsec_acme_secret" })
    const { rerender } = render(<WebhooksTab />)
    await user.click(await screen.findByRole("button", { name: "Add endpoint" }))
    await user.type(screen.getByLabelText("Address"), "https://x.example.com/in")
    await user.click(screen.getByRole("button", { name: "Save endpoint" }))
    expect(await screen.findByText("whsec_acme_secret")).toBeInTheDocument()

    org.value.activeOrgId = "o2"
    rerender(<WebhooksTab />)
    expect(await screen.findByText(/beta\.example\.com/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain("whsec_acme_secret")
    expect(m.listWebhooks).toHaveBeenCalledTimes(3)
  })

  it("Delete: the sheet, then a receipt naming the host and focus on the header title", async () => {
    const user = userEvent.setup()
    m.listWebhooks.mockResolvedValueOnce(list([endpoint("gone")])).mockResolvedValue(list([]))
    m.deleteWebhook.mockResolvedValue(undefined)
    render(<WebhooksTab />)
    await user.click(await screen.findByRole("button", { expanded: false }))
    await user.click(screen.getByRole("button", { name: "Delete gone.example.com" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByText("Delete this endpoint?")).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "Delete endpoint" }))
    expect(m.deleteWebhook).toHaveBeenCalledWith("gone")
    expect(await screen.findByText("✎ gone.example.com deleted · recorded")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("heading", { name: /Webhooks/ })).toHaveFocus())
  })

  it("a focus hint for THIS org opens that card", async () => {
    writeWebhookFocus({ endpointId: "b", orgId: "o1" })
    m.listWebhooks.mockResolvedValue(list([endpoint("a"), endpoint("b", { enabled: false, disabled_reason: "failing" })]))
    render(<WebhooksTab />)
    await waitFor(() => expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("b.example.com"))
    expect(sessionStorage.getItem("webhook_focus")).toBeNull()
    await waitFor(() => expect(screen.getByRole("button", { expanded: true })).toHaveFocus())
  })

  // 308 UAT row 3: the app mounts under <StrictMode> (main.tsx), whose dev double-run of the mount
  // effect read the hint once, then read null and overwrote it — the card stayed shut.
  it("a focus hint survives a StrictMode double mount and still opens that card", async () => {
    writeWebhookFocus({ endpointId: "b", orgId: "o1" })
    m.listWebhooks.mockResolvedValue(list([endpoint("a"), endpoint("b", { enabled: false, disabled_reason: "failing" })]))
    render(
      <StrictMode>
        <WebhooksTab />
      </StrictMode>,
    )
    await waitFor(() => expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("b.example.com"))
    expect(sessionStorage.getItem("webhook_focus")).toBeNull()
  })

  it("WR-06: a hint written while the tab is ALREADY open opens that card and is consumed at once", async () => {
    m.listWebhooks.mockResolvedValue(list([endpoint("a"), endpoint("b", { enabled: false, disabled_reason: "failing" })]))
    render(<WebhooksTab />)
    await waitFor(() => expect(m.listWebhooks).toHaveBeenCalled())
    await screen.findAllByText(/b\.example\.com/)
    expect(screen.queryByRole("button", { expanded: true })).toBeNull()
    act(() => writeWebhookFocus({ endpointId: "b", orgId: "o1" }))
    await waitFor(() => expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("b.example.com"))
    expect(sessionStorage.getItem("webhook_focus")).toBeNull()
  })

  it("a focus hint for ANOTHER org says so; Switch to {org} switches and the card opens", async () => {
    const user = userEvent.setup()
    writeWebhookFocus({ endpointId: "b", orgId: "o2" })
    m.listWebhooks.mockResolvedValueOnce(list([endpoint("a")])).mockResolvedValue(list([endpoint("b")], "Beta Corp"))
    org.value.switchOrg.mockImplementation((id: string) => {
      org.value.activeOrgId = id
    })
    const { rerender } = render(<WebhooksTab />)
    const lead = await screen.findByText(/The endpoint Syrel turned off is in/)
    expect(lead.parentElement).toHaveTextContent("The endpoint Syrel turned off is in Beta Corp.")
    expect(screen.getByText("Beta Corp").tagName).toBe("B")
    await user.click(screen.getByRole("button", { name: "Switch to Beta Corp" }))
    expect(org.value.switchOrg).toHaveBeenCalledWith("o2")
    rerender(<WebhooksTab />)
    await waitFor(() => expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("b.example.com"))
    expect(screen.queryByText(/The endpoint Syrel turned off is in/)).toBeNull()
  })

  it("keys its load on the active org and never builds a link from an address", async () => {
    expect(tabRaw).toMatch(/activeOrgId/)
    expect(tabRaw).not.toMatch(/href=\{/)
    await act(async () => {})
  })
})
