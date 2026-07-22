/**
 * Phase 166 Plan 04 Task 2 (ADMIN-01 / D-166-01 / D-166-04 / sketch 080-A) — OrgAdminShell tests.
 *
 * The fetch-owning org-admin shell composes the four Plan-03 leaves into the 080-A
 * 7-tab shape: 3 LIVE tabs (Members / Audit / Settings) + 4 LOCKED "coming soon"
 * `LockedTab` placeholders (Invitations & Roles / SSO / Subscription / Retention).
 *
 * These tests lock the body switch + the load-bearing beats:
 *   1. each live tab mounts its leaf (Members → OrgMembersTab, Audit → OrgAuditTab,
 *      Settings → OrgSettingsTab).
 *   2. each locked tab renders LockedTab with its title + description.
 *   3. NO locked-tab description names a roadmap phase number (T-146-10 / T-166-13).
 *   4. when getOrgAudit returns scope==='own', the shell threads that page to
 *      OrgAuditTab and its RLS-honest degrade banner renders (D-166-04 / T-166-11).
 *
 * The shell owns the fetch, so getOrgMembers/getOrgAudit + useOrg are mocked; the ⌥
 * two-audience reveal is provided by the real TechnicalNamesProvider (the shell reads
 * it via useTechnicalNames and threads it to OrgBand + OrgAuditTab).
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { OrgAdminShell } from "./OrgAdminShell"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
import { getOrgMembers, getOrgAudit, listInvitations } from "@/lib/api"
import { useOrg } from "@/providers/OrgProvider"
import type { OrgAuditPage, OrgMembersPage, Invitation } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getOrgMembers: vi.fn(),
  getOrgAudit: vi.fn(),
  // Phase 167: the Invitations tab is LIVE — the shell owns the invitation fetch +
  // the resend/revoke/send callbacks; the mounted InviteMemberDialog imports sendInvitation.
  listInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  sendInvitation: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock("@/providers/OrgProvider", () => ({
  useOrg: vi.fn(),
}))

const MEMBERS_PAGE: OrgMembersPage = {
  members: [
    { user_id: "u1", email: "alice@example.com", role: "org-admin", joined_at: "2026-01-01T00:00:00Z" },
    { user_id: "u2", email: "bob@example.com", role: "member", joined_at: "2026-02-01T00:00:00Z" },
  ],
  page: 1,
  page_size: 50,
  total: 2,
}

const ALL_PAGE: OrgAuditPage = {
  entries: [
    { id: "b1", user_id: "u1", action_type: "document.upload", metadata: null, created_at: "2026-07-20T10:00:00Z", org_id: "o1" },
  ],
  total: 1,
  page: 1,
  page_size: 50,
  scope: "all",
}

const OWN_PAGE: OrgAuditPage = {
  entries: [
    { id: "a1", user_id: "u1", action_type: "search.query", metadata: null, created_at: "2026-07-20T09:00:00Z", org_id: "o1" },
  ],
  total: 1,
  page: 1,
  page_size: 50,
  scope: "own",
}

/** The 3 remaining locked tabs and their exact phase-number-free copy (T-146-10 / T-166-13).
 *  Phase 167 flips "Invitations & Roles" LIVE, so it left this list. */
const LOCKED_TABS: ReadonlyArray<{ tab: string; description: string }> = [
  { tab: "SSO", description: "Single sign-on setup is coming soon." },
  { tab: "Subscription", description: "Plan and billing management is coming soon." },
  { tab: "Retention", description: "Data-retention controls are coming soon." },
]

/** A pending + accepted pair the shell threads into the live InvitationsTab. */
const INVITES: Invitation[] = [
  { id: "inv1", email: "pending@acme.test", role: "member", status: "pending", expires_at: "2026-07-27T00:00:00Z", created_at: "2026-07-20T00:00:00Z" },
]

/** A roadmap-phase-number token in any shape a locked description must never carry. */
const PHASE_NUMBER = /Phase\s*\d|\b1[0-9]{2}\b/

function mockOrg(overrides: Record<string, unknown> = {}) {
  vi.mocked(useOrg).mockReturnValue({
    activeOrgId: "o1",
    orgs: [{ org_id: "o1", name: "Acme Inc", role: "org-admin" }],
    role: "org-admin",
    canManage: true,
    canAuditView: true,
    canManageSso: true,
    loading: false,
    switchOrg: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useOrg>)
}

function renderShell() {
  return render(
    <TechnicalNamesProvider>
      <OrgAdminShell onBack={vi.fn()} />
    </TechnicalNamesProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockOrg()
  vi.mocked(getOrgMembers).mockResolvedValue(MEMBERS_PAGE)
  vi.mocked(getOrgAudit).mockResolvedValue(ALL_PAGE)
  vi.mocked(listInvitations).mockResolvedValue(INVITES)
})

describe("OrgAdminShell — live tabs mount their leaves (ADMIN-01 / D-166-01)", () => {
  it("Members (default) mounts OrgMembersTab with the fetched roster rows + adoption chips", async () => {
    renderShell()
    // The email row is rendered only by OrgMembersTab, never the shell skeleton.
    expect(await screen.findByText("alice@example.com")).toBeInTheDocument()
    expect(screen.getByText("bob@example.com")).toBeInTheDocument()
    // Phase 167: the roster leaf shows server-derived adoption chips (members read Active).
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0)
  })

  it("Audit mounts OrgAuditTab with the fetched audit page", async () => {
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Audit" }))
    // The chip-filter strip belongs to OrgAuditTab, not the skeleton.
    expect(await screen.findByText(/any action/i)).toBeInTheDocument()
    expect(screen.getByText(/any time/i)).toBeInTheDocument()
  })

  it("Settings mounts OrgSettingsTab (the org-config home) with the org name", async () => {
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Settings" }))
    // The three-homes seam sentence is unique to OrgSettingsTab.
    expect(await screen.findByText(/org-wide configuration/i)).toBeInTheDocument()
    expect(screen.getByText(/organization name/i)).toBeInTheDocument()
    expect(screen.getAllByText("Acme Inc").length).toBeGreaterThan(0)
  })

  it("Invitations & Roles is LIVE — mounts InvitationsTab with the shell-fetched invitations (D-167-07)", async () => {
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Invitations & Roles" }))
    // The InvitationsTab leaf renders its own heading + send affordance (NOT a LockedTab).
    expect(await screen.findByRole("heading", { name: /invitations & roles/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send invite/i })).toBeInTheDocument()
    // The shell-fetched invitation is threaded into the leaf (its row + pending chip render).
    expect(await screen.findByText("pending@acme.test")).toBeInTheDocument()
    // NOT a locked placeholder.
    expect(screen.queryByText(/not built yet — coming soon/i)).toBeNull()
    expect(vi.mocked(listInvitations)).toHaveBeenCalled()
  })
})

describe("OrgAdminShell — locked tabs render LockedTab (T-146-10 / T-166-13)", () => {
  it("each of the 3 locked tabs renders LockedTab with its title + phase-number-free copy", async () => {
    renderShell()
    for (const { tab, description } of LOCKED_TABS) {
      await userEvent.click(screen.getByRole("tab", { name: tab }))
      // Title (the tab label) + the calm coming-soon line + the exact description.
      expect(await screen.findByRole("heading", { name: tab })).toBeInTheDocument()
      expect(screen.getByText(/not built yet — coming soon/i)).toBeInTheDocument()
      expect(screen.getByText(description)).toBeInTheDocument()
    }
  })

  it("NO locked-tab description names a roadmap phase number", async () => {
    renderShell()
    for (const { tab, description } of LOCKED_TABS) {
      await userEvent.click(screen.getByRole("tab", { name: tab }))
      const el = await screen.findByText(description)
      expect(el.textContent ?? "").not.toMatch(PHASE_NUMBER)
    }
  })
})

describe("OrgAdminShell — audit scope threads through (ADMIN-04 / D-166-04 / T-166-11)", () => {
  it("scope='own' from the server renders OrgAuditTab's RLS-honest degrade banner", async () => {
    vi.mocked(getOrgAudit).mockResolvedValue(OWN_PAGE)
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Audit" }))
    // The own-only degrade banner renders from the server's scope flag — never a
    // silent empty list. Threading the page (with its scope) is the whole beat.
    const banner = await screen.findByTestId("org-audit-own-banner")
    expect(banner.textContent ?? "").toMatch(/your own activity/i)
    // The own row still renders (honest degrade, not empty).
    expect(screen.getByText("Searched documents")).toBeInTheDocument()
  })

  it("scope='all' hides the degrade banner", async () => {
    vi.mocked(getOrgAudit).mockResolvedValue(ALL_PAGE)
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Audit" }))
    expect(await screen.findByText(/any action/i)).toBeInTheDocument()
    expect(screen.queryByTestId("org-audit-own-banner")).toBeNull()
  })
})
