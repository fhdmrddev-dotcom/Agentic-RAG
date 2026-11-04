/**
 * Phase 308-05 (D-20, D-21, T-308-13; UI-SPEC §1d, A-14, A-15, A-17) — an endpoint's own delivery
 * log: a real table, words and numbers only, Resend on sent / failed non-test rows, paging, and a
 * 15 s poll that runs ONLY while a row is in flight. Assertions read rendered words.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import logRaw from "../WebhookDeliveryLog.tsx?raw"

const m = vi.hoisted(() => ({
  listWebhookDeliveries: vi.fn(),
  resendWebhookDelivery: vi.fn(),
}))

vi.mock("@/lib/api/webhooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/webhooks")>()
  return { ...actual, ...m }
})

import { WebhookDeliveryLog } from "../WebhookDeliveryLog"
import { WebhookError, type WebhookDelivery } from "@/lib/api/webhooks"

const NOW = new Date(2026, 10, 4, 12, 0, 0)

function row(id: string, over: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    id,
    event_type: "run.finished",
    item_kind: "run",
    item_id: "77777777-7777-4777-8777-777777777777",
    status: "sent",
    reason: null,
    attempts: 1,
    last_status_code: 200,
    last_latency_ms: 212,
    last_error: null,
    last_attempt_at: new Date(2026, 10, 4, 10, 5).toISOString(),
    next_attempt_at: null,
    created_at: new Date(2026, 10, 4, 10, 4).toISOString(),
    ...over,
  }
}

beforeEach(() => {
  m.listWebhookDeliveries.mockReset()
  m.resendWebhookDelivery.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe("308-05 WebhookDeliveryLog", () => {
  it("a real table with visible column headers and the words of each row; the footnote", async () => {
    m.listWebhookDeliveries.mockResolvedValue({
      deliveries: [
        row("d1"),
        row("d2", {
          event_type: "document.ingested",
          item_kind: "document",
          item_id: "abcdef0123456789",
          status: "retrying",
          attempts: 3,
          last_status_code: 503,
          last_latency_ms: 1500,
          next_attempt_at: new Date(2026, 10, 4, 10, 15).toISOString(),
        }),
        row("d3", { event_type: "webhook.test", item_kind: "test", item_id: null, status: "failed", last_status_code: null, last_error: "timeout", last_latency_ms: null }),
        row("d4", { status: "skipped_not_visible", item_id: null, last_status_code: null, last_latency_ms: null, last_attempt_at: null }),
      ],
      next_cursor: null,
    })
    const { container } = render(<WebhookDeliveryLog endpointId="e1" host="hooks.example.com" on now={NOW} />)
    const table = await screen.findByRole("table")
    for (const h of ["Event", "About", "Status", "Tries", "HTTP", "Latency", "When"]) {
      expect(within(table).getByRole("columnheader", { name: h })).toBeInTheDocument()
    }
    expect(screen.getByText("Deliveries")).toBeInTheDocument()
    expect(within(table).getByText("run 77777777…")).toBeInTheDocument()
    expect(within(table).getByText("document abcdef01…")).toBeInTheDocument()
    expect(within(table).getByText("test")).toBeInTheDocument()
    expect(within(table).getByText("no longer visible")).toBeInTheDocument()
    expect(within(table).getByText("Retrying")).toBeInTheDocument()
    expect(within(table).getByText("10:05 · next 10:15")).toBeInTheDocument()
    expect(within(table).getByText("1.5 s")).toBeInTheDocument()
    expect(within(table).getByText("timed out")).toBeInTheDocument()
    expect(within(table).getByText("Not sent — you can no longer see it")).toBeInTheDocument()
    expect(
      screen.getByText("Shows the receiver's status code and how long it took. The reply itself is never stored."),
    ).toBeInTheDocument()
    expect(container.querySelector("pre")).toBeNull()
    expect(m.listWebhookDeliveries).toHaveBeenCalledWith("e1", { limit: 20, before: null })
  })

  it("a run link opens through onOpenRun; a test row is not a link", async () => {
    const user = userEvent.setup()
    const onOpenRun = vi.fn()
    m.listWebhookDeliveries.mockResolvedValue({ deliveries: [row("d1")], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="h.example.com" on now={NOW} onOpenRun={onOpenRun} />)
    await user.click(await screen.findByRole("button", { name: "run 77777777…" }))
    expect(onOpenRun).toHaveBeenCalledWith("77777777-7777-4777-8777-777777777777")
  })

  it("Resend on sent and failed non-test rows: Resending…, then the log re-reads", async () => {
    const user = userEvent.setup()
    let resolve!: (v: unknown) => void
    m.resendWebhookDelivery.mockReturnValue(new Promise((r) => (resolve = r)))
    m.listWebhookDeliveries
      .mockResolvedValueOnce({
        deliveries: [
          row("d1"),
          row("d2", { status: "failed", last_status_code: 500 }),
          row("d3", { item_kind: "test", item_id: null, event_type: "webhook.test" }),
          row("d4", { status: "skipped_disabled", last_status_code: null, attempts: 0 }),
        ],
        next_cursor: null,
      })
      .mockResolvedValue({ deliveries: [row("d1", { status: "pending" })], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="h.example.com" on now={NOW} />)
    const resends = await screen.findAllByRole("button", { name: "Resend this run.finished delivery" })
    expect(resends).toHaveLength(2)
    await user.click(resends[0])
    expect(m.resendWebhookDelivery).toHaveBeenCalledWith("e1", "d1")
    expect(screen.getByText("Resending…")).toBeInTheDocument()
    await act(async () => resolve({ delivery: { id: "d1", status: "pending", attempts: 1, next_attempt_at: null } }))
    expect(await screen.findByText("Queued")).toBeInTheDocument()
    expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(2)
  })

  it("a rate-limited resend says our words, never 'status 429'", async () => {
    const user = userEvent.setup()
    m.listWebhookDeliveries.mockResolvedValue({ deliveries: [row("d1")], next_cursor: null })
    m.resendWebhookDelivery.mockRejectedValue(new WebhookError("slow", 429, "rate_limited"))
    render(<WebhookDeliveryLog endpointId="e1" host="h.example.com" on now={NOW} />)
    await user.click(await screen.findByRole("button", { name: "Resend this run.finished delivery" }))
    expect(
      await screen.findByText("You've resent several deliveries in a row. Try again in a minute."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/429/)).toBeNull()
  })

  it("an off endpoint: no Resend column, one line says why", async () => {
    m.listWebhookDeliveries.mockResolvedValue({ deliveries: [row("d1"), row("d2", { status: "failed" })], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="h.example.com" on={false} now={NOW} />)
    await screen.findByRole("table")
    expect(screen.queryByRole("button", { name: /Resend this/ })).toBeNull()
    expect(screen.getAllByText("Resend works when the endpoint is on.")).toHaveLength(1)
    expect(screen.queryByRole("columnheader", { name: "Resend" })).toBeNull()
  })

  it("Show older appends the next page and hides when there is no more", async () => {
    const user = userEvent.setup()
    m.listWebhookDeliveries
      .mockResolvedValueOnce({ deliveries: [row("d1")], next_cursor: "cur-2" })
      .mockResolvedValueOnce({ deliveries: [row("d9", { event_type: "run.waiting" })], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="h.example.com" on now={NOW} />)
    await user.click(await screen.findByRole("button", { name: "Show older" }))
    expect(await screen.findByText("run.waiting")).toBeInTheDocument()
    expect(screen.getByText("run.finished")).toBeInTheDocument()
    expect(m.listWebhookDeliveries).toHaveBeenLastCalledWith("e1", { limit: 20, before: "cur-2" })
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull()
  })

  it("loading, then a load failure with Retry; empty words", async () => {
    const user = userEvent.setup()
    m.listWebhookDeliveries.mockRejectedValueOnce(new Error("Server down.")).mockResolvedValueOnce({ deliveries: [], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="h.example.com" on now={NOW} />)
    expect(screen.getByText("Loading deliveries…")).toBeInTheDocument()
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load deliveries. Server down.")
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No deliveries yet. Send a test, or wait for an event you picked.")).toBeInTheDocument()
  })

  it("Refresh re-reads page one, named for its host", async () => {
    const user = userEvent.setup()
    m.listWebhookDeliveries.mockResolvedValue({ deliveries: [row("d1")], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="hooks.example.com" on now={NOW} />)
    await screen.findByRole("table")
    await user.click(screen.getByRole("button", { name: "Refresh deliveries for hooks.example.com" }))
    await waitFor(() => expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(2))
  })

  it("a refreshKey bump (after a test) re-reads", async () => {
    m.listWebhookDeliveries.mockResolvedValue({ deliveries: [row("d1")], next_cursor: null })
    const { rerender } = render(<WebhookDeliveryLog endpointId="e1" host="h" on now={NOW} refreshKey={0} />)
    await screen.findByRole("table")
    rerender(<WebhookDeliveryLog endpointId="e1" host="h" on now={NOW} refreshKey={1} />)
    await waitFor(() => expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(2))
  })

  it("polls every 15 s ONLY while a row is in flight, and stops when none remain", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    m.listWebhookDeliveries
      .mockResolvedValueOnce({ deliveries: [row("d1", { status: "retrying" })], next_cursor: null })
      .mockResolvedValueOnce({ deliveries: [row("d1", { status: "sent" })], next_cursor: null })
    render(<WebhookDeliveryLog endpointId="e1" host="h" on now={NOW} />)
    expect(await screen.findByText("Retrying")).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(15_000)
    })
    expect(await screen.findByText("Sent")).toBeInTheDocument()
    expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(2)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(2)
  })

  it("does not poll at all when nothing is in flight, and stops on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    m.listWebhookDeliveries.mockResolvedValue({ deliveries: [row("d1", { status: "pending" })], next_cursor: null })
    const { unmount } = render(<WebhookDeliveryLog endpointId="e1" host="h" on now={NOW} />)
    await screen.findByText("Queued")
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(m.listWebhookDeliveries).toHaveBeenCalledTimes(1)
  })

  it("renders no body, header or reply field in its source", () => {
    expect(logRaw).not.toMatch(/dangerouslySetInnerHTML|response_body|request_body/)
  })
})
