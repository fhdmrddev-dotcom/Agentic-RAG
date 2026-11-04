/**
 * Phase 307-05 (D-28; UI-SPEC §"Audit words") — the org Audit tab says what a connected app did in
 * the SAME plain words as the Control Room (lockstep), on the existing api_key.* literals.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { OrgAuditTab } from "../OrgAuditTab"
import orgAuditSrc from "../OrgAuditTab.tsx?raw"
import controlRoomAuditSrc from "@/components/admin/AuditTab.tsx?raw"
import type { OrgAuditPage } from "@/lib/api"

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

describe("307-05 OrgAuditTab — connected-app words", () => {
  it("each oauth row reads its sentence; a key row keeps its label", () => {
    render(
      <OrgAuditTab
        {...baseProps}
        result={page([
          { action_type: "api_key.create", metadata: { detail: { credential: "oauth", client_name: "Claude Code", redirect_host: "localhost" } } },
          { action_type: "api_key.revoke", metadata: { detail: { credential: "oauth", client_name: "Claude", redirect_host: "claude.ai" } } },
          { action_type: "api_key.revoke", metadata: { detail: { by_admin: true, owner_name: "Lee Park", credential: "oauth", client_name: "Claude", redirect_host: "claude.ai" } } },
          { action_type: "api_key.revoke", metadata: { detail: { credential: "oauth", scope: "org", count: 1, members: 1 } } },
          { action_type: "api_key.refused", metadata: { api_key_label: "Claude", reason: "refresh_reuse", detail: { credential: "oauth", redirect_host: "claude.ai" } } },
          { action_type: "api_key.refused", metadata: { reason: "revoked", api_key_label: "n8n" } },
        ])}
      />,
    )
    expect(screen.getByText("Connected Claude Code (localhost) as an app")).toBeInTheDocument()
    expect(screen.getByText("Disconnected Claude (claude.ai)")).toBeInTheDocument()
    expect(screen.getByText("Disconnected Lee Park's app Claude (claude.ai)")).toBeInTheDocument()
    expect(screen.getByText("Disconnected all 1 connected app in the organisation")).toBeInTheDocument()
    expect(screen.getByText("Refused a reused sign-in from Claude (claude.ai) and disconnected it")).toBeInTheDocument()
    expect(screen.getByText("Refused an API key call")).toBeInTheDocument()
  })

  it("both audit browsers read the SAME words helper (lockstep, no new literal)", () => {
    for (const src of [orgAuditSrc, controlRoomAuditSrc]) {
      expect(src).toContain("oauthAuditLabel(")
      expect(src).not.toMatch(/"connected_app\./)
    }
  })
})
