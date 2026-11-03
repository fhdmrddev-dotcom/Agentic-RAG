/**
 * Phase 307-05 (D-28; UI-SPEC §"Audit words") — the Control Room's platform ledger says what a
 * connected app did in plain words, on the EXISTING api_key.* literals (no new literal): the row's
 * `metadata.detail.credential === "oauth"` picks the words. A client's name is plain text capped at 60.
 * The operator ledger names the allowlist writes too.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { AuditTab } from "../AuditTab"
import type { OperatorAuditRow, PlatformAuditPage } from "@/lib/api"

function page(entries: { action_type: string; metadata: Record<string, unknown> | null }[]): PlatformAuditPage {
  return {
    entries: entries.map((e, i) => ({ id: `r${i}`, user_id: "user-abcd1234ef", created_at: "2026-11-04T10:00:00Z", ...e })),
    page: 1,
    page_size: 25,
    has_more: false,
  }
}

function renderPlatform(result: PlatformAuditPage, operatorRows: OperatorAuditRow[] = []) {
  return render(
    <AuditTab
      source="platform"
      onSourceChange={vi.fn()}
      operatorRows={operatorRows}
      platformResult={result}
      platformLoading={false}
      onQueryPlatform={vi.fn()}
      onExportPlatform={vi.fn().mockResolvedValue(undefined)}
      showTechnical={false}
      onToggleTechnical={vi.fn()}
    />,
  )
}

const LONG = "A".repeat(80)

describe("307-05 AuditTab — connected-app words", () => {
  it("each oauth row reads its UI-SPEC sentence; a key row keeps its 293 label", () => {
    renderPlatform(
      page([
        { action_type: "api_key.create", metadata: { api_key_label: "Claude", detail: { credential: "oauth", client_name: "Claude", redirect_host: "claude.ai" } } },
        { action_type: "api_key.revoke", metadata: { api_key_label: "Claude", detail: { credential: "oauth", client_name: "Claude", redirect_host: "claude.ai" } } },
        { action_type: "api_key.revoke", metadata: { api_key_label: "Cursor", detail: { by_admin: true, owner_id: "u2", owner_name: "Lee Park", credential: "oauth", client_name: "Cursor", redirect_host: "cursor.example.com" } } },
        { action_type: "api_key.revoke", metadata: { detail: { credential: "oauth", scope: "org", count: 3, members: 2 } } },
        { action_type: "api_key.refused", metadata: { api_key_label: "Claude", reason: "refresh_reuse", detail: { credential: "oauth" } } },
        { action_type: "api_key.refused", metadata: { api_key_label: "Claude", reason: "wrong_resource", detail: { credential: "oauth", client_name: "Claude", redirect_host: "claude.ai" } } },
        { action_type: "api_key.revoke", metadata: { api_key_label: "n8n-prod" } },
      ]),
    )
    expect(screen.getByText("Connected Claude (claude.ai) as an app")).toBeInTheDocument()
    expect(screen.getByText("Disconnected Claude (claude.ai)")).toBeInTheDocument()
    expect(screen.getByText("Disconnected Lee Park's app Cursor (cursor.example.com)")).toBeInTheDocument()
    expect(screen.getByText("Disconnected all 3 connected apps in the organisation")).toBeInTheDocument()
    expect(screen.getByText("Refused a reused sign-in from Claude and disconnected it")).toBeInTheDocument()
    expect(screen.getByText("Refused a sign-in meant for another server from Claude (claude.ai)")).toBeInTheDocument()
    expect(screen.getByText("Revoked an API key")).toBeInTheDocument()
  })

  it("a client's name is capped at 60 characters and rendered as text", () => {
    const { container } = renderPlatform(
      page([{ action_type: "api_key.create", metadata: { detail: { credential: "oauth", client_name: `<b>${LONG}`, redirect_host: "x.example" } } }]),
    )
    const expected = `Connected ${`<b>${LONG}`.slice(0, 60)} (x.example) as an app`
    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(container.querySelector("b")).toBeNull()
  })

  it("the operator ledger's allowlist rows have plain action names in the filter", () => {
    render(
      <AuditTab
        source="operator"
        onSourceChange={vi.fn()}
        operatorRows={[
          { id: "o1", action: "settings.mcp_sign_in_hosts.add", label: "Allowed AI tool sign-in to return to chat.example.com", is_write: true, target_type: null, target_id: null, created_at: "2026-11-04T10:00:00Z" },
        ]}
        platformResult={null}
        platformLoading={false}
        onQueryPlatform={vi.fn()}
        onExportPlatform={vi.fn().mockResolvedValue(undefined)}
        showTechnical={false}
        onToggleTechnical={vi.fn()}
      />,
    )
    expect(screen.getByText("Allowed AI tool sign-in to return to chat.example.com")).toBeInTheDocument()
  })
})
