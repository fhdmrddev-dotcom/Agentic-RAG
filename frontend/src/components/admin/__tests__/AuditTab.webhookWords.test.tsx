/**
 * Phase 308-06 (D-31; UI-SPEC §"Audit words") — the Control Room's platform ledger names each of the
 * nine webhook.endpoint.* rows in plain words, in its own "Webhooks" group, and shows the host from
 * metadata as text (never a query, never a secret — neither is in the metadata).
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AuditTab } from "../AuditTab"
import type { PlatformAuditPage } from "@/lib/api"

const WEBHOOK_WORDS: [string, string][] = [
  ["webhook.endpoint.created", "Added a webhook endpoint"],
  ["webhook.endpoint.updated", "Changed a webhook endpoint"],
  ["webhook.endpoint.deleted", "Deleted a webhook endpoint"],
  ["webhook.endpoint.enabled", "Turned on a webhook endpoint"],
  ["webhook.endpoint.disabled", "Turned off a webhook endpoint"],
  ["webhook.endpoint.secret_rolled", "Rolled a webhook signing secret"],
  ["webhook.endpoint.test_sent", "Sent a webhook test"],
  ["webhook.endpoint.delivery_resent", "Resent a webhook delivery"],
  ["webhook.endpoint.auto_disabled", "Syrel turned off a webhook endpoint after repeated failures"],
]

function page(entries: { action_type: string; metadata: Record<string, unknown> | null }[]): PlatformAuditPage {
  return {
    entries: entries.map((e, i) => ({ id: `r${i}`, user_id: "user-abcd1234ef", created_at: "2026-11-04T10:00:00Z", ...e })),
    page: 1,
    page_size: 25,
    has_more: false,
  }
}

function renderPlatform(result: PlatformAuditPage) {
  return render(
    <AuditTab
      source="platform"
      onSourceChange={vi.fn()}
      operatorRows={[]}
      platformResult={result}
      platformLoading={false}
      onQueryPlatform={vi.fn()}
      onExportPlatform={vi.fn().mockResolvedValue(undefined)}
      showTechnical={false}
      onToggleTechnical={vi.fn()}
    />,
  )
}

describe("308-06 AuditTab — webhook words", () => {
  it("each of the nine webhook rows reads its sentence and shows the host as text", () => {
    renderPlatform(
      page(WEBHOOK_WORDS.map(([code], i) => ({ action_type: code, metadata: { actor: "owner", endpoint_id: `e${i}`, host: `h${i}.example.com` } }))),
    )
    WEBHOOK_WORDS.forEach(([code, words], i) => {
      expect(screen.getByText(words)).toBeInTheDocument()
      expect(screen.getByText(`h${i}.example.com`)).toBeInTheDocument()
      expect(screen.queryByText(code)).toBeNull()
    })
  })

  it("a host is capped at 253 characters and never shown for a non-webhook row", () => {
    const long = `${"a".repeat(300)}.example.com`
    const { container } = renderPlatform(
      page([
        { action_type: "webhook.endpoint.created", metadata: { host: long } },
        { action_type: "api_key.create", metadata: { host: "not-a-webhook.example.com" } },
      ]),
    )
    expect(screen.getByText(long.slice(0, 253))).toBeInTheDocument()
    expect(screen.queryByText("not-a-webhook.example.com")).toBeNull()
    expect(container.querySelector("a[href]")).toBeNull()
  })

  it("the action filter offers a Webhooks group with the nine words", async () => {
    renderPlatform(page([]))
    await userEvent.click(screen.getByRole("button", { name: /any action/i }))
    const group = screen.getByText("Webhooks")
    expect(group).toBeInTheDocument()
    for (const [, words] of WEBHOOK_WORDS) {
      expect(screen.getAllByText(words).length).toBeGreaterThan(0)
    }
    expect(within(document.body).queryByText("webhook.endpoint.created")).toBeNull()
  })
})
