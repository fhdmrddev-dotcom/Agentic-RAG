/**
 * Phase 308-06 (HOOK-06; D-30, D-51, P-1; UI-SPEC Surface 2) — Org admin → API keys → "Webhooks in
 * {org}": every member's endpoint, Turn off (direct), Turn on (admin-off rows only), Delete behind the
 * admin victim-naming sheet.
 *
 * Prices: a query string or receiver token reaching the admin's DOM; a Turn on offered for an endpoint
 * that kept failing (the receiver is the owner's to fix); a write that changes the screen before the
 * server answers; a receipt or band pulse with no server-confirmed write; a feature gate that hides the
 * section. Assertions read RENDERED WORDS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import orgWebhooksRaw from "../OrgWebhooks.tsx?raw"
import tabRaw from "../OrgApiKeysTab.tsx?raw"

const m = vi.hoisted(() => ({
  listOrgWebhooks: vi.fn(),
  adminSetWebhookEnabled: vi.fn(),
  adminDeleteWebhook: vi.fn(),
}))

vi.mock("@/lib/api/webhooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/webhooks")>()
  return { ...actual, ...m }
})

import { OrgWebhooks } from "../OrgWebhooks"
import { WebhookError, type OrgWebhook } from "@/lib/api/webhooks"

const TOKEN = "s3cr3t-receiver-token"

function ep(id: string, over: Partial<OrgWebhook> = {}): OrgWebhook {
  return {
    id,
    owner_name: "Lee Park",
    owner_is_you: false,
    owner_is_member: true,
    host: "hooks.example.com",
    path: "/in/syrel",
    has_query: false,
    event_types: ["run.finished", "document.ingested"],
    enabled: true,
    disabled_reason: null,
    last_success_at: null,
    consecutive_failures: 0,
    ...over,
  }
}

beforeEach(() => {
  m.listOrgWebhooks.mockReset()
  m.adminSetWebhookEnabled.mockReset()
  m.adminDeleteWebhook.mockReset()
})

describe("308-06 OrgWebhooks", () => {
  it("always reads and renders — no feature gate (P-1)", async () => {
    m.listOrgWebhooks.mockResolvedValue({ endpoints: [], org_name: "Acme Legal" })
    render(<OrgWebhooks orgName="Acme Legal" />)
    expect(await screen.findByText("No webhook endpoints in Acme Legal.")).toBeInTheDocument()
    expect(m.listOrgWebhooks).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("heading", { name: /Webhooks in Acme Legal/ })).toBeInTheDocument()
    expect(screen.queryByRole("table")).toBeNull()
    expect(orgWebhooksRaw).not.toMatch(/oauthAvailable|featureFlag|isFeatureEnabled/)
  })

  it("lists every endpoint with its owner, host + path, events, status and failures; never a query", async () => {
    m.listOrgWebhooks.mockResolvedValue({
      endpoints: [
        ep("a", { has_query: true, consecutive_failures: 3 }),
        ep("b", { owner_name: "Ada Admin", owner_is_you: true, host: "ada.example.org", path: "/x", event_types: ["run.waiting"] }),
        ep("c", { owner_name: "", owner_is_member: false, enabled: false, disabled_reason: "owner_removed", host: "gone.example.net", path: "/" }),
      ],
      org_name: "Acme Legal",
    })
    const { container } = render(<OrgWebhooks orgName="Acme Legal" />)
    const table = await screen.findByRole("table")
    for (const col of ["Owner", "Address", "Events", "Status", "Last delivered", "Failed in a row"]) {
      expect(within(table).getByRole("columnheader", { name: col })).toBeInTheDocument()
    }
    expect(screen.getByText("3 endpoints · 3 members")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Every webhook endpoint a member of Acme Legal has added. Turning one off stops its deliveries; only an admin can turn it back on. Query strings are hidden — they may hold a receiver's password.",
      ),
    ).toBeInTheDocument()

    const rowA = screen.getByTestId("org-webhook-a")
    expect(within(rowA).getByText("Lee Park")).toBeInTheDocument()
    expect(within(rowA).getByText("hooks.example.com/in/syrel")).toBeInTheDocument()
    expect(within(rowA).getByText("query hidden")).toBeInTheDocument()
    expect(within(rowA).getByText("On")).toBeInTheDocument()
    expect(within(rowA).getByText("Never")).toBeInTheDocument()
    expect(within(rowA).getByText("3")).toBeInTheDocument()
    expect(within(rowA).getByText("2")).toBeInTheDocument()

    const rowB = screen.getByTestId("org-webhook-b")
    expect(rowB).toHaveTextContent("Ada Admin (you)")

    const rowC = screen.getByTestId("org-webhook-c")
    expect(within(rowC).getByText("A former member")).toBeInTheDocument()
    expect(within(rowC).getByText("Off — the owner left Acme Legal")).toBeInTheDocument()

    expect(container.textContent).not.toContain("?")
    expect(container.innerHTML).not.toContain(TOKEN)
    expect(container.querySelector("a[href]")).toBeNull()
  })

  it("orders by owner name A–Z, keeping the server's order within an owner", async () => {
    m.listOrgWebhooks.mockResolvedValue({
      endpoints: [ep("z1", { owner_name: "Zoe" }), ep("a1", { owner_name: "Ana" }), ep("z2", { owner_name: "Zoe" })],
      org_name: "Acme Legal",
    })
    render(<OrgWebhooks orgName="Acme Legal" />)
    await screen.findByRole("table")
    const ids = screen.getAllByTestId(/^org-webhook-/).map((r) => r.getAttribute("data-testid"))
    expect(ids).toEqual(["org-webhook-a1", "org-webhook-z1", "org-webhook-z2"])
  })

  it("Turn off is direct: server first, then the receipt, ONE band pulse and a re-read", async () => {
    m.listOrgWebhooks
      .mockResolvedValueOnce({ endpoints: [ep("a")], org_name: "Acme Legal" })
      .mockResolvedValueOnce({ endpoints: [ep("a", { enabled: false, disabled_reason: "admin" })], org_name: "Acme Legal" })
    let release: (v: unknown) => void = () => {}
    m.adminSetWebhookEnabled.mockReturnValue(new Promise((r) => (release = r)))
    const onRecorded = vi.fn()
    render(<OrgWebhooks orgName="Acme Legal" onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Turn off Lee Park's endpoint hooks.example.com" }))
    expect(m.adminSetWebhookEnabled).toHaveBeenCalledWith("a", false)
    // never optimistic: still On until the server answers
    expect(within(screen.getByTestId("org-webhook-a")).getByText("On")).toBeInTheDocument()
    expect(onRecorded).not.toHaveBeenCalled()
    release({ endpoint: ep("a", { enabled: false, disabled_reason: "admin" }) })
    const receipt = await screen.findByTestId("org-webhooks-receipt")
    expect(receipt).toHaveAttribute("role", "status")
    expect(receipt).toHaveTextContent("✎ You turned off Lee Park's endpoint hooks.example.com · recorded")
    expect(onRecorded).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(m.listOrgWebhooks).toHaveBeenCalledTimes(2))
    const row = screen.getByTestId("org-webhook-a")
    expect(await within(row).findByText("Off — turned off by an org admin")).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Turn on Lee Park's endpoint hooks.example.com" })).toBeInTheDocument()
  })

  it("Turn on is offered ONLY on admin-off rows (never failing, gone, owner left or self-off)", async () => {
    m.listOrgWebhooks.mockResolvedValue({
      endpoints: [
        ep("adm", { enabled: false, disabled_reason: "admin" }),
        ep("fail", { enabled: false, disabled_reason: "failing", host: "f.example.com" }),
        ep("gone", { enabled: false, disabled_reason: "gone", host: "g.example.com" }),
        ep("left", { enabled: false, disabled_reason: "owner_removed", host: "l.example.com" }),
        ep("self", { enabled: false, disabled_reason: null, host: "s.example.com" }),
      ],
      org_name: "Acme Legal",
    })
    m.adminSetWebhookEnabled.mockResolvedValue({ endpoint: ep("adm") })
    const onRecorded = vi.fn()
    render(<OrgWebhooks orgName="Acme Legal" onRecorded={onRecorded} />)
    await screen.findByRole("table")
    expect(screen.getAllByRole("button", { name: /^Turn on / })).toHaveLength(1)
    for (const id of ["fail", "gone", "left", "self"]) {
      expect(within(screen.getByTestId(`org-webhook-${id}`)).queryByRole("button", { name: /^Turn (on|off) / })).toBeNull()
    }
    expect(within(screen.getByTestId("org-webhook-fail")).getByText("Off — kept failing")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Turn on Lee Park's endpoint hooks.example.com" }))
    await waitFor(() => expect(m.adminSetWebhookEnabled).toHaveBeenCalledWith("adm", true))
    expect(await screen.findByTestId("org-webhooks-receipt")).toHaveTextContent(
      "✎ You turned on Lee Park's endpoint hooks.example.com · recorded",
    )
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it("a refused write keeps the table, shows the server's words, and records nothing", async () => {
    m.listOrgWebhooks.mockResolvedValue({ endpoints: [ep("a")], org_name: "Acme Legal" })
    m.adminSetWebhookEnabled.mockRejectedValue(new WebhookError("Only an org admin can do that.", 403, "forbidden"))
    const onRecorded = vi.fn()
    render(<OrgWebhooks orgName="Acme Legal" onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Turn off Lee Park's endpoint hooks.example.com" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Only an org admin can do that.")
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(within(screen.getByTestId("org-webhook-a")).getByText("On")).toBeInTheDocument()
    expect(onRecorded).not.toHaveBeenCalled()
    expect(screen.queryByTestId("org-webhooks-receipt")).toBeNull()
  })

  it("Delete opens the admin sheet naming owner and org, and uses the admin route", async () => {
    m.listOrgWebhooks
      .mockResolvedValueOnce({ endpoints: [ep("a")], org_name: "Acme Legal" })
      .mockResolvedValueOnce({ endpoints: [], org_name: "Acme Legal" })
    m.adminDeleteWebhook.mockResolvedValue(undefined)
    const onRecorded = vi.fn()
    render(<OrgWebhooks orgName="Acme Legal" onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Delete Lee Park's endpoint hooks.example.com" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByText("Delete Lee Park's endpoint?")).toBeInTheDocument()
    expect(sheet).toHaveTextContent("hooks.example.com/in/syrel")
    expect(sheet).toHaveTextContent("Lee Park's system stops getting events from Acme Legal.")
    expect(sheet).toHaveTextContent("Lee Park sees it gone; the audit log records you.")
    expect(sheet).toHaveTextContent("Lee Park's other endpoints and orgs are not touched.")
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Keep it" })).toHaveFocus())
    expect(onRecorded).not.toHaveBeenCalled()
    await userEvent.click(within(sheet).getByRole("button", { name: "Delete endpoint" }))
    await waitFor(() => expect(m.adminDeleteWebhook).toHaveBeenCalledWith("a"))
    expect(await screen.findByTestId("org-webhooks-receipt")).toHaveTextContent(
      "✎ You deleted Lee Park's endpoint hooks.example.com · recorded",
    )
    expect(onRecorded).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("No webhook endpoints in Acme Legal.")).toBeInTheDocument()
  })

  it("a failed read says so with Retry", async () => {
    m.listOrgWebhooks.mockRejectedValueOnce(new Error("Down.")).mockResolvedValueOnce({ endpoints: [], org_name: "Acme Legal" })
    render(<OrgWebhooks orgName="Acme Legal" />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading the org's webhooks…")
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the org's webhooks. Down.")
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No webhook endpoints in Acme Legal.")).toBeInTheDocument()
  })

  it("is mounted ONCE in OrgApiKeysTab, directly after the connected apps", () => {
    expect(tabRaw.match(/<OrgWebhooks /g)).toHaveLength(1)
    const apps = tabRaw.indexOf("<OrgConnectedApps ")
    const hooks = tabRaw.indexOf("<OrgWebhooks ")
    expect(apps).toBeGreaterThan(-1)
    expect(hooks).toBeGreaterThan(apps)
    const between = tabRaw.slice(apps, hooks)
    expect(between.split("\n")).toHaveLength(2)
    expect(orgWebhooksRaw).not.toMatch(/href=\{|dangerouslySetInnerHTML/)
  })
})
