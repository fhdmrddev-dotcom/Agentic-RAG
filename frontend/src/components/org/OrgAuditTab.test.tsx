/**
 * Phase 166 Plan 03 Task 3 (ADMIN-04 / D-166-04 / sketch 080-A) — OrgAuditTab tests.
 *
 * The lighter, single-ledger org audit list (list + chip filters, NO CSV, NO source
 * switch). The load-bearing beat is the RLS-honest degrade: when the server returns
 * `scope === "own"` (the caller lacks `org:audit_view`), the tab shows an explicit
 * "you see only your own activity" banner + the own-only rows — NEVER a silent empty
 * list (T-166-08). These tests lock that, plus the plain-first vocabulary + the ⌥
 * two-audience raw-code reveal.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { OrgAuditTab } from "./OrgAuditTab"
import type { OrgAuditPage } from "@/lib/api"

const OWN_PAGE: OrgAuditPage = {
  entries: [
    { id: "a1", user_id: "u1", action_type: "document.upload", metadata: null, created_at: "2026-07-20T10:00:00Z", org_id: "o1" },
    { id: "a2", user_id: "u1", action_type: "search.query", metadata: null, created_at: "2026-07-20T09:00:00Z", org_id: "o1" },
  ],
  total: 2,
  page: 1,
  page_size: 50,
  scope: "own",
}

const ALL_PAGE: OrgAuditPage = {
  entries: [
    { id: "b1", user_id: "u1", action_type: "document.upload", metadata: null, created_at: "2026-07-20T10:00:00Z", org_id: "o1" },
    { id: "b2", user_id: "u2", action_type: "thread.create", metadata: null, created_at: "2026-07-20T09:00:00Z", org_id: "o1" },
  ],
  total: 2,
  page: 1,
  page_size: 50,
  scope: "all",
}

const baseProps = {
  loading: false,
  filters: {},
  onFiltersChange: vi.fn(),
  onPageChange: vi.fn(),
  showTechnical: false,
  onToggleTechnical: vi.fn(),
}

describe("OrgAuditTab — RLS-honest degrade (ADMIN-04 / D-166-04)", () => {
  it("scope='own' renders the 'you see only your own activity' banner AND the own rows (never a silent empty list)", () => {
    render(<OrgAuditTab {...baseProps} result={OWN_PAGE} />)
    const banner = screen.getByTestId("org-audit-own-banner")
    expect(banner).toBeInTheDocument()
    expect(banner.textContent ?? "").toMatch(/your own activity/i)
    // The own rows still render — the degrade is honest, not empty.
    expect(screen.getByText("Uploaded a document")).toBeInTheDocument()
    expect(screen.getByText("Searched documents")).toBeInTheDocument()
  })

  it("scope='all' hides the degrade banner and renders cross-member rows", () => {
    render(<OrgAuditTab {...baseProps} result={ALL_PAGE} />)
    expect(screen.queryByTestId("org-audit-own-banner")).toBeNull()
    expect(screen.getByText("Uploaded a document")).toBeInTheDocument()
    expect(screen.getByText("Started a chat")).toBeInTheDocument()
  })
})

describe("OrgAuditTab — lighter cut (no CSV, no source switch)", () => {
  it("renders the action-type + date chip filter strip", () => {
    render(<OrgAuditTab {...baseProps} result={ALL_PAGE} />)
    expect(screen.getByText(/any action/i)).toBeInTheDocument()
    expect(screen.getByText(/any time/i)).toBeInTheDocument()
  })

  it("renders NO CSV export button and NO operator/platform source switch", () => {
    render(<OrgAuditTab {...baseProps} result={ALL_PAGE} />)
    expect(screen.queryByRole("button", { name: /export/i })).toBeNull()
    // Single-ledger: there is no operator/platform tab switch.
    expect(screen.queryByRole("tab")).toBeNull()
    expect(screen.queryByText(/platform activity/i)).toBeNull()
    expect(screen.queryByText(/operator actions/i)).toBeNull()
  })
})

describe("OrgAuditTab — plain-first vocabulary + ⌥ raw-code reveal", () => {
  it("shows plain-first labels from the vocabulary map, hiding raw codes by default", () => {
    render(<OrgAuditTab {...baseProps} result={ALL_PAGE} showTechnical={false} />)
    expect(screen.getByText("Uploaded a document")).toBeInTheDocument()
    // Raw action code is hidden while the ⌥ reveal is off.
    expect(screen.queryByText("document.upload")).toBeNull()
  })

  it("reveals the raw action code when ⌥ Technical names is on", () => {
    render(<OrgAuditTab {...baseProps} result={ALL_PAGE} showTechnical={true} />)
    expect(screen.getByText("Uploaded a document")).toBeInTheDocument()
    expect(screen.getByText("document.upload")).toBeInTheDocument()
  })
})
