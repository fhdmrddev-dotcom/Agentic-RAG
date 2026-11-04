/**
 * Phase 308-05 (D-20, D-29, D-30; UI-SPEC §1b, §1c, A-3..A-6, A-11) — one endpoint, collapsed and open.
 *
 * The header is a button that toggles; the open card carries the state notice, the action row, the
 * test verdict, the roll's secret-once panel in place, the edit form in place, a per-card receipt and
 * the log. Every write changes the card only from the server's answer. Assertions read rendered words.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

const m = vi.hoisted(() => ({
  listWebhookDeliveries: vi.fn(),
  resendWebhookDelivery: vi.fn(),
  sendWebhookTest: vi.fn(),
  setWebhookEnabled: vi.fn(),
  rollWebhookSecret: vi.fn(),
  updateWebhook: vi.fn(),
}))

vi.mock("@/lib/api/webhooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/webhooks")>()
  return { ...actual, ...m }
})

import { WebhookEndpointCard } from "../WebhookEndpointCard"
import { WebhookError, type WebhookEndpoint } from "@/lib/api/webhooks"

const NOW = new Date(2026, 10, 4, 12, 0, 0)

function endpoint(over: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "e1",
    url: "https://hooks.example.com/in?token=abc123",
    description: "Ops alerts",
    event_types: ["run.finished", "run.waiting"],
    enabled: true,
    disabled_reason: null,
    disabled_at: null,
    last_success_at: new Date(2026, 10, 4, 9, 30).toISOString(),
    consecutive_failures: 0,
    previous_secret_expires_at: null,
    created_at: "2026-11-01T09:00:00Z",
    ...over,
  }
}

/** A tab-like host: holds the endpoint and the open flag, applies the server's answers. */
function Host({ initial, startOpen = true, onDelete = () => {} }: { initial: WebhookEndpoint; startOpen?: boolean; onDelete?: (e: WebhookEndpoint) => void }) {
  const [e, setE] = useState(initial)
  const [open, setOpen] = useState(startOpen)
  return (
    <WebhookEndpointCard
      endpoint={e}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      now={NOW}
      onChanged={setE}
      onDelete={onDelete}
    />
  )
}

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset()
  m.listWebhookDeliveries.mockResolvedValue({ deliveries: [], next_cursor: null })
})

describe("308-05 WebhookEndpointCard — collapsed", () => {
  it("the address with query values masked, the tag, the events, the meta phrase; a toggle button", async () => {
    const user = userEvent.setup()
    render(<Host initial={endpoint()} startOpen={false} />)
    const toggle = screen.getByRole("button", { expanded: false })
    expect(toggle).toHaveTextContent("https://hooks.example.com/in?token=••••")
    expect(document.body.textContent).not.toContain("abc123")
    expect(toggle).toHaveTextContent("On")
    expect(toggle).toHaveTextContent("Ops alerts")
    expect(toggle).toHaveTextContent("run.finished")
    expect(toggle).toHaveTextContent("Last delivered 09:30")
    expect(screen.queryByRole("button", { name: /Send a test/ })).toBeNull()
    expect(document.querySelector("a")).toBeNull()

    toggle.focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("button", { expanded: true })).toBe(toggle)
    expect(toggle.getAttribute("aria-controls")).toBeTruthy()
    expect(document.getElementById(toggle.getAttribute("aria-controls") as string)).not.toBeNull()
    await user.keyboard(" ")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("off states read their own tag", () => {
    render(<Host initial={endpoint({ enabled: false, disabled_reason: "failing", disabled_at: new Date(2026, 10, 4, 8, 0).toISOString() })} startOpen={false} />)
    const toggle = screen.getByRole("button", { expanded: false })
    expect(toggle).toHaveTextContent("Off — kept failing")
    expect(toggle).toHaveTextContent("Turned off 08:00")
  })
})

describe("308-05 WebhookEndpointCard — open", () => {
  it("On: the action row with names per host, and the log", async () => {
    render(<Host initial={endpoint()} />)
    for (const name of [
      "Send a test to hooks.example.com",
      "Roll the secret for hooks.example.com",
      "Turn off hooks.example.com",
      "Edit hooks.example.com",
      "Delete hooks.example.com",
    ]) {
      expect(screen.getByRole("button", { name })).toBeEnabled()
    }
    expect(await screen.findByText("No deliveries yet. Send a test, or wait for an event you picked.")).toBeInTheDocument()
    expect(m.listWebhookDeliveries).toHaveBeenCalled()
  })

  it("Send test: Sending…, then the verdict, then the log re-reads", async () => {
    const user = userEvent.setup()
    let resolve!: (v: unknown) => void
    m.sendWebhookTest.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<Host initial={endpoint()} />)
    await screen.findByText(/No deliveries yet/)
    await user.click(screen.getByRole("button", { name: "Send a test to hooks.example.com" }))
    expect(screen.getByRole("button", { name: "Send a test to hooks.example.com" })).toHaveTextContent("Sending…")
    await act(async () => resolve({ delivered: true, status_code: 200, latency_ms: 140, error: null }))
    expect(await screen.findByText("Delivered — your receiver answered 200 in 140 ms. It is in the log below.")).toBeInTheDocument()
    await waitFor(() => expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(2))
  })

  it("a failed test reads in failure words", async () => {
    const user = userEvent.setup()
    m.sendWebhookTest.mockResolvedValue({ delivered: false, status_code: 500, latency_ms: 80, error: "http_status" })
    render(<Host initial={endpoint()} />)
    await user.click(screen.getByRole("button", { name: "Send a test to hooks.example.com" }))
    expect(
      await screen.findByText("Your receiver answered 500 in 80 ms, so the test counts as failed. It is in the log below."),
    ).toBeInTheDocument()
  })

  it("Turn off: the tag changes from the server's answer, the button swaps in place keeping focus, a receipt", async () => {
    const user = userEvent.setup()
    let resolve!: (v: unknown) => void
    m.setWebhookEnabled.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<Host initial={endpoint()} />)
    const off = screen.getByRole("button", { name: "Turn off hooks.example.com" })
    await user.click(off)
    expect(m.setWebhookEnabled).toHaveBeenCalledWith("e1", false)
    // never optimistic: still On until the server answers
    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("On")
    await act(async () => resolve({ endpoint: endpoint({ enabled: false, disabled_at: NOW.toISOString() }) }))
    const on = await screen.findByRole("button", { name: "Turn on hooks.example.com" })
    expect(on).toHaveFocus()
    expect(screen.getByText("✎ Turned off · recorded")).toBeInTheDocument()
    expect(screen.getByText("Off. Nothing is sent and new events for it are not kept. Turn it on to start again.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send a test to hooks.example.com" })).toBeDisabled()
    expect(screen.getByText("Turn the endpoint on to send a test.")).toBeInTheDocument()
  })

  it("a refused flip keeps the card and says so in the server's words", async () => {
    const user = userEvent.setup()
    m.setWebhookEnabled.mockRejectedValue(new WebhookError("Busy right now.", 503, "unavailable"))
    render(<Host initial={endpoint()} />)
    await user.click(screen.getByRole("button", { name: "Turn off hooks.example.com" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't turn off the endpoint. Busy right now. Nothing changed.")
    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("On")
  })

  it("admin-off: the notice, Turn on disabled with its reason as DOM text, no Resend column", async () => {
    render(<Host initial={endpoint({ enabled: false, disabled_reason: "admin", disabled_at: NOW.toISOString() })} />)
    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("Off — turned off by an org admin")
    expect(screen.getByText("Turned off by an org admin. Ask them to turn it back on.")).toBeInTheDocument()
    const on = screen.getByRole("button", { name: "Turn on hooks.example.com" })
    expect(on).toBeDisabled()
    const why = screen.getByText("Only an org admin can turn this back on.")
    expect(on.getAttribute("aria-describedby")).toContain(why.id)
    expect(await screen.findByText("Resend works when the endpoint is on.")).toBeInTheDocument()
  })

  it("failing and gone notices", () => {
    const { unmount } = render(<Host initial={endpoint({ enabled: false, disabled_reason: "failing" })} />)
    expect(
      screen.getByText("Turned off after 5 deliveries in a row failed. Fix the receiver, then turn it back on. Nothing is sent while it is off."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Turn on hooks.example.com" })).toBeEnabled()
    unmount()
    render(<Host initial={endpoint({ enabled: false, disabled_reason: "gone" })} />)
    expect(
      screen.getByText("The receiver answered 410 Gone, so Syrel stopped sending. Turn it back on only if the address is live again."),
    ).toBeInTheDocument()
  })

  it("Roll: the sheet, then the new secret IN the card from the server's answer; it leaves when the card closes", async () => {
    const user = userEvent.setup()
    m.rollWebhookSecret.mockResolvedValue({
      endpoint: endpoint({ previous_secret_expires_at: new Date(2026, 10, 5, 12, 0).toISOString() }),
      secret: "whsec_rolled_once",
      previous_secret_expires_at: new Date(2026, 10, 5, 12, 0).toISOString(),
    })
    render(<Host initial={endpoint()} />)
    await user.click(screen.getByRole("button", { name: "Roll the secret for hooks.example.com" }))
    const sheet = await screen.findByRole("alertdialog")
    await user.click(within(sheet).getByRole("button", { name: "Roll secret" }))
    expect(await screen.findByText("whsec_rolled_once")).toBeInTheDocument()
    expect(screen.getByText("⚠ Copy the new secret into your receiver now. Syrel can't show it again.")).toBeInTheDocument()
    expect(screen.getByText("✎ Secret rolled · recorded")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { expanded: true }))
    expect(document.body.textContent).not.toContain("whsec_rolled_once")
    await user.click(screen.getByRole("button", { expanded: false }))
    expect(document.body.textContent).not.toContain("whsec_rolled_once")
  })

  it("Edit: the form in place with the saved address; Save changes applies the server's answer and says so", async () => {
    const user = userEvent.setup()
    m.updateWebhook.mockResolvedValue({ endpoint: endpoint({ description: "Ops pager" }) })
    render(<Host initial={endpoint()} />)
    await user.click(screen.getByRole("button", { name: "Edit hooks.example.com" }))
    expect(screen.getByText("Edit endpoint")).toBeInTheDocument()
    expect(screen.getByLabelText("Address")).toHaveValue("https://hooks.example.com/in?token=abc123")
    const desc = screen.getByLabelText("Description")
    await user.clear(desc)
    await user.type(desc, "Ops pager")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(m.updateWebhook).toHaveBeenCalledWith("e1", {
      url: "https://hooks.example.com/in?token=abc123",
      event_types: ["run.finished", "run.waiting"],
      description: "Ops pager",
    })
    expect(await screen.findByText("✎ Changes saved · recorded")).toBeInTheDocument()
    expect(screen.queryByText("Edit endpoint")).toBeNull()
    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent("Ops pager")
  })

  it("Delete hands the endpoint to the tab (which owns the sheet)", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<Host initial={endpoint()} onDelete={onDelete} />)
    await user.click(screen.getByRole("button", { name: "Delete hooks.example.com" }))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }))
  })
})
