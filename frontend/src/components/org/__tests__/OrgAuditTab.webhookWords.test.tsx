/**
 * Phase 308-06 (D-31; UI-SPEC §"Audit words") — the org Audit tab says what happened to a webhook
 * endpoint in the SAME plain words as the Control Room (lockstep), in group "Webhooks", with the host
 * from metadata as text.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { OrgAuditTab } from "../OrgAuditTab"
import orgAuditSrc from "../OrgAuditTab.tsx?raw"
import controlRoomAuditSrc from "@/components/admin/AuditTab.tsx?raw"
import type { OrgAuditPage } from "@/lib/api"

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

function page(entries: { action_type: string; metadata: Record<string, unknown> | null }[]): OrgAuditPage {
  return {
    entries: entries.map((e, i) => ({ id: `r${i}`, user_id: "u1", created_at: "2026-11-04T10:00:00Z", org_id: "o1", ...e })),
    total: entries.length,
    page: 1,
    page_size: 50,
    scope: "all",
  }
}

const baseProps = {
  loading: false,
  filters: {},
  onFiltersChange: vi.fn(),
  onPageChange: vi.fn(),
  showTechnical: false,
  onToggleTechnical: vi.fn(),
}

describe("308-06 OrgAuditTab — webhook words", () => {
  it("each of the nine webhook rows reads its sentence and shows the host as text", () => {
    render(
      <OrgAuditTab
        {...baseProps}
        result={page(WEBHOOK_WORDS.map(([code], i) => ({ action_type: code, metadata: { actor: "admin", endpoint_id: `e${i}`, host: `h${i}.example.com` } })))}
      />,
    )
    WEBHOOK_WORDS.forEach(([code, words], i) => {
      expect(screen.getByText(words)).toBeInTheDocument()
      expect(screen.getByText(`h${i}.example.com`)).toBeInTheDocument()
      expect(screen.queryByText(code)).toBeNull()
    })
  })

  it("the action filter offers a Webhooks group", async () => {
    render(<OrgAuditTab {...baseProps} result={page([])} />)
    await userEvent.click(screen.getByRole("button", { name: "any action" }))
    expect(screen.getByText("Webhooks")).toBeInTheDocument()
    expect(screen.getByText("Syrel turned off a webhook endpoint after repeated failures")).toBeInTheDocument()
  })

  it("both audit browsers carry the SAME nine labels (lockstep)", () => {
    for (const [code, words] of WEBHOOK_WORDS) {
      const line = `"${code}": { label: "${words}", group: "Webhooks" }`
      expect(orgAuditSrc).toContain(line)
      expect(controlRoomAuditSrc).toContain(line)
    }
  })
})
