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
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { OrgAdminShell } from "./OrgAdminShell"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
import { getOrgMembers, getOrgAudit, listInvitations, listSsoConfigs } from "@/lib/api"
import { useOrg } from "@/providers/OrgProvider"
import type { OrgAuditPage, OrgMembersPage, Invitation, SsoConfig } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getOrgMembers: vi.fn(),
  getOrgAudit: vi.fn(),
  // Phase 167: the Invitations tab is LIVE — the shell owns the invitation fetch +
  // the resend/revoke/send callbacks; the mounted InviteMemberDialog imports sendInvitation.
  listInvitations: vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  sendInvitation: vi.fn(),
  // Phase 168: the SSO tab is LIVE — the shell owns the SSO-config fetch + create/remove.
  listSsoConfigs: vi.fn(),
  createSsoProvider: vi.fn(),
  deleteSsoProvider: vi.fn(),
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

// Phase 275-04: the Retention leaf owns its own fetches (its suites live under
// components/retention); here it is a stub that proves the shell mounts it and wires the pulse.
// 275-REVIEW F-WR-10: the stub numbers each MOUNT, so an org switch can be seen to remount it.
const retentionMounts = vi.hoisted(() => ({ n: 0 }))
vi.mock("@/components/retention/RetentionTab", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  return {
    RetentionTab: ({ onRecorded }: { onRecorded?: () => void }) => {
      const [mount] = React.useState(() => ++retentionMounts.n)
      return (
        <div data-testid="retention-tab-stub" data-mount={mount}>
          <button type="button" onClick={() => onRecorded?.()}>
            record a retention write
          </button>
        </div>
      )
    },
  }
})

// Phase 293-04: the API keys leaf owns its own fetches (its suite is OrgApiKeysTab.test.tsx); here
// it is a stub that proves the shell mounts it, keys it on the org, and wires the pulse + audit door.
vi.mock("./OrgApiKeysTab", () => ({
  OrgApiKeysTab: ({ onRecorded, onOpenAudit, orgName }: { onRecorded?: () => void; onOpenAudit?: () => void; orgName?: string | null }) => (
    <div data-testid="api-keys-tab-stub" data-org={orgName ?? ""}>
      <button type="button" onClick={() => onRecorded?.()}>
        record a key revoke
      </button>
      <button type="button" onClick={() => onOpenAudit?.()}>
        open the org audit
      </button>
    </div>
  ),
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

/** The remaining locked tab and its exact phase-number-free copy (T-146-10 / T-166-13).
 *  Phase 167 flipped "Invitations & Roles" LIVE and Phase 168 flipped "SSO" LIVE, so both
 *  left this list.
 *  ⚠ RETIRED DELIBERATELY at 275-04 (D-01, SEED-177 — retire a fence on purpose, never trip it by
 *  surprise): the locked `Retention` entry (its "Data-retention controls are …" placeholder copy)
 *  is GONE because Phase 275 ships the Retention home. Its locked assertions are REPLACED, not
 *  deleted: the "Retention is LIVE" cases below assert the unlocked tab mounts the retention leaf and
 *  that no locked placeholder renders for it — so the suite's case count rises rather than falls. */
const LOCKED_TABS: ReadonlyArray<{ tab: string; description: string }> = [
  { tab: "Subscription", description: "Plan and billing management is coming soon." },
]

/** A pending + accepted pair the shell threads into the live InvitationsTab. */
const INVITES: Invitation[] = [
  { id: "inv1", email: "pending@acme.test", role: "member", status: "pending", expires_at: "2026-07-27T00:00:00Z", created_at: "2026-07-20T00:00:00Z" },
]

/** An active SSO connection the shell threads into the live SsoTab (Phase 168). */
const SSO_CONFIGS: SsoConfig[] = [
  { id: "sso1", email_domain: "acme.test", provider_id: "prov-abc123", status: "active", approved_at: "2026-07-21T00:00:00Z" },
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
  vi.mocked(listSsoConfigs).mockResolvedValue(SSO_CONFIGS)
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

  it("SSO is LIVE — mounts SsoTab with the shell-fetched connections (D-168-01)", async () => {
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "SSO" }))
    // The SsoTab leaf renders its own heading + create CTA (NOT a LockedTab).
    expect(await screen.findByRole("heading", { name: /single sign-on/i })).toBeInTheDocument()
    // The shell-fetched connection is threaded into the leaf (its domain + server-truth chip).
    expect(await screen.findByText("acme.test")).toBeInTheDocument()
    expect(screen.getByTestId("sso-status")).toHaveTextContent(/active/i)
    // NOT a locked placeholder.
    expect(screen.queryByText(/not built yet — coming soon/i)).toBeNull()
    expect(vi.mocked(listSsoConfigs)).toHaveBeenCalled()
  })
})

describe("OrgAdminShell — locked tabs render LockedTab (T-146-10 / T-166-13)", () => {
  it("the 1 remaining locked tab renders LockedTab with its title + phase-number-free copy", async () => {
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

describe("OrgAdminShell — Retention is LIVE (275-04 / D-01; replaces the retired locked-Retention fence)", () => {
  it("Retention is unlocked: no lock glyph, it mounts the retention leaf, and no locked placeholder renders", async () => {
    renderShell()
    const tab = screen.getByRole("tab", { name: "Retention" })
    expect(tab.querySelector("svg")).toBeNull() // the Lock glyph rides only on locked tabs
    await userEvent.click(tab)
    expect(await screen.findByTestId("retention-tab-stub")).toBeInTheDocument()
    expect(screen.queryByText(/not built yet — coming soon/i)).toBeNull()
    expect(screen.queryByText(/Data-retention controls are/)).toBeNull()
    expect(tab).toHaveAttribute("aria-selected", "true")
  })

  it("275-REVIEW F-WR-10: an org switch REMOUNTS the Retention tab, so it never shows the previous org's data", async () => {
    const view = renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Retention" }))
    const first = (await screen.findByTestId("retention-tab-stub")).getAttribute("data-mount")
    mockOrg({ activeOrgId: "o2", orgs: [{ org_id: "o2", name: "Beta GmbH", role: "org-admin" }] })
    view.rerender(
      <TechnicalNamesProvider>
        <OrgAdminShell onBack={vi.fn()} />
      </TechnicalNamesProvider>,
    )
    const second = screen.getByTestId("retention-tab-stub").getAttribute("data-mount")
    expect(Number(second)).toBeGreaterThan(Number(first))
  })

  it("a recorded retention write pulses the band's marker for 1.6 s (062-A), then it settles", async () => {
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "Retention" }))
    const marker = screen.getByText("every action recorded")
    expect(marker.className).not.toContain("bg-success/15")
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole("button", { name: "record a retention write" }))
      expect(screen.getByText("every action recorded").className).toContain("bg-success/15")
      act(() => {
        vi.advanceTimersByTime(1600)
      })
      expect(screen.getByText("every action recorded").className).not.toContain("bg-success/15")
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("OrgAdminShell — API keys (293-04 / D-03, D-18)", () => {
  it("API keys is the LAST tab, after Retention, unlocked, and mounts the keys leaf with the org name", async () => {
    renderShell()
    const names = screen.getAllByRole("tab").map((t) => t.textContent)
    expect(names[names.length - 1]).toBe("API keys")
    expect(names[names.length - 2]).toBe("Retention")
    const tab = screen.getByRole("tab", { name: "API keys" })
    expect(tab.querySelector("svg")).toBeNull() // no lock glyph
    await userEvent.click(tab)
    expect(await screen.findByTestId("api-keys-tab-stub")).toHaveAttribute("data-org", "Acme Inc")
    expect(tab).toHaveAttribute("aria-selected", "true")
  })

  it("a recorded revoke pulses the band's marker (062-A); the audit link opens the Audit tab", async () => {
    renderShell()
    await userEvent.click(screen.getByRole("tab", { name: "API keys" }))
    await screen.findByTestId("api-keys-tab-stub")
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole("button", { name: "record a key revoke" }))
      expect(screen.getByText("every action recorded").className).toContain("bg-success/15")
      act(() => {
        vi.advanceTimersByTime(1600)
      })
    } finally {
      vi.useRealTimers()
    }
    fireEvent.click(screen.getByRole("button", { name: "open the org audit" }))
    expect(screen.getByRole("tab", { name: "Audit" })).toHaveAttribute("aria-selected", "true")
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
