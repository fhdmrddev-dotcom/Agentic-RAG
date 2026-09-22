// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 04 (ADMIN-01 / D-166-01 / sketch 080-A) — the org-admin shell.
//
// The user-side mirror of the operator `ControlRoomPage`, re-tinted to org-indigo:
// the 061-B band+tabs shape reused verbatim, but the operator zone's warning tint
// stays RESERVED for /admin — the org home is the user's OWN home, so its active-tab
// accents ride the app's normal `primary` token (hue-239 indigo) — never the
// operator zone's reserved warning tint.
//
// SHELL = OWNER OF FETCH, TABS = PURE LEAVES (148-PATTERNS split): the shell holds
// the `alive.current` guard + the lazy per-tab fetch (Members on tab-open, Audit on
// tab-open — never on mount for a tab you never open) + the honest-degrade `.catch`
// that keeps last-known values (a blip never blanks the surface). The four leaves
// (OrgBand / OrgMembersTab / OrgAuditTab / OrgSettingsTab, Plan 03) receive rows +
// callbacks as props and render only what the server (Plan 01) permitted.
//
// 7 TABS (D-166-01): 3 LIVE (Members read-only · Audit lighter · Settings org-config
// home) + 4 LOCKED "coming soon" `LockedTab` placeholders (Invitations & Roles · SSO
// · Subscription · Retention). The locked copy NEVER names a roadmap phase number
// (T-146-10 / T-166-13 — a grep + test gate assert its absence).
//
// SECURITY (T-166-12): this shell renders off the render-only `canManage` probe flag,
// but every fetch it makes (/org/members, /org/audit) is independently server-gated on
// `org:manage` (Plan 01). A forced client mount shows chrome but the fetches 403 — the
// client is not the boundary. The honest client guard below refuses to paint org chrome
// for a non-manager anyway.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Lock } from "lucide-react"

import {
  createSsoProvider,
  deleteSsoProvider,
  getOrgAudit,
  getOrgMembers,
  listInvitations,
  listSsoConfigs,
  resendInvitation,
  revokeInvitation,
  type Invitation,
  type OrgAuditFilters,
  type OrgAuditPage,
  type OrgMember,
  type PendingInvitation,
  type SsoConfig,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { useOrg } from "@/providers/OrgProvider"
import { useTechnicalNames } from "@/providers/TechnicalNamesProvider"
import { LockedTab } from "@/components/admin/LockedTab"
import { OrgBand } from "./OrgBand"
import { OrgMembersTab } from "./OrgMembersTab"
import { OrgAuditTab } from "./OrgAuditTab"
import { OrgSettingsTab } from "./OrgSettingsTab"
import { InvitationsTab } from "./InvitationsTab"
import { SsoTab } from "./SsoTab"
import { OrgExpertsTab } from "./OrgExpertsTab"

interface OrgAdminShellProps {
  /** Return to the ordinary app surface (navigates to "chat"). */
  onBack: () => void
}

type OrgAdminTab =
  | "members"
  | "experts"
  | "audit"
  | "settings"
  | "invitations"
  | "sso"
  | "subscription"
  | "retention"

interface TabDef {
  id: OrgAdminTab
  label: string
  locked: boolean
  /** Plain, roadmap-number-free "coming soon" copy for the locked body (T-146-10). */
  lockedDescription?: string
}

// The 080-A org-admin band-tab IA (D-166-01): three live tabs, then the four honest
// locks that NAME the arriving capability in plain words (never a roadmap number —
// T-146-10 / T-166-13). The operator zone's warning tint is NOT used anywhere here —
// this is the indigo zone.
const TABS: readonly TabDef[] = [
  { id: "members", label: "Members", locked: false },
  // Phase 261 (PACK-07): In-App Expert Management & Authoring Tab
  { id: "experts", label: "Experts", locked: false },
  { id: "audit", label: "Audit", locked: false },
  { id: "settings", label: "Settings", locked: false },
  // Phase 167 (D-167-07): the invitations home is LIVE — the org shell owns the
  // invitation fetch + mutations; the leaf is InvitationsTab.
  { id: "invitations", label: "Invitations & Roles", locked: false },
  // Phase 168 (D-168-01 / SSO-01): the SSO home is LIVE — the org shell owns the SSO-config
  // fetch + create/remove mutations; the leaf is SsoTab (render-gated on canManageSso).
  { id: "sso", label: "SSO", locked: false },
  {
    id: "subscription",
    label: "Subscription",
    locked: true,
    lockedDescription: "Plan and billing management is coming soon.",
  },
  {
    id: "retention",
    label: "Retention",
    locked: true,
    lockedDescription: "Data-retention controls are coming soon.",
  },
]

// Read-only member roster page size (068-A shape). The server clamps <= 100; one modest
// page keeps the manager-gated read light — client-side search filters the loaded page.
const MEMBERS_PAGE_SIZE = 50
// Org audit browse page size (067-A shape). The server clamps <= 100; the pager walks
// the server-scoped total.
const AUDIT_PAGE_SIZE = 50

export function OrgAdminShell({ onBack }: OrgAdminShellProps) {
  const { activeOrgId, orgs, role, canManage, canManageSso, loading } = useOrg()
  // Phase 154 (D-01a): the ⌥ two-audience reveal is the ONE app-wide shared value.
  // The shell reads it here and threads it to OrgBand + OrgAuditTab so the band toggle
  // and the audit raw-code reveal always move together (never two toggles that disagree).
  const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()

  const [activeTab, setActiveTab] = useState<OrgAdminTab>("members")

  // 068-A roster: `null` until the Members tab is first opened (lazy — no roster read on
  // a Settings-only visit); the shell owns the fetch + the search state, OrgMembersTab is
  // a pure leaf. Search filters the LOADED page client-side (never an unbounded fetch).
  const [members, setMembers] = useState<OrgMember[] | null>(null)
  const [memberQuery, setMemberQuery] = useState("")
  // Phase 167 (INV-01): the roster's still-pending invitees ride ON the /org/members
  // response — captured here so OrgMembersTab renders the Pending adoption rows.
  const [memberPending, setMemberPending] = useState<PendingInvitation[]>([])
  // Phase 167 (INV-01): the Invitations & Roles tab list; `null` until first opened (lazy —
  // no invitation read on a Members-only visit). The shell owns the fetch; the leaf is pure.
  const [invitations, setInvitations] = useState<Invitation[] | null>(null)
  // Phase 168 (SSO-01): the SSO tab connections; `null` until first opened (lazy — no SSO read
  // on a non-SSO visit). The shell owns the fetch + create/remove; SsoTab is a pure leaf.
  const [ssoConfigs, setSsoConfigs] = useState<SsoConfig[] | null>(null)
  // 067-A audit: the current server page + its in-flight flag; `null` until the Audit
  // tab is first opened. The load-bearing `scope` flag rides ON this page (server truth).
  // The shell owns the filter + 1-based page state; OrgAuditTab reports intent via callbacks.
  const [auditResult, setAuditResult] = useState<OrgAuditPage | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilters, setAuditFilters] = useState<OrgAuditFilters>({})
  const [auditPage, setAuditPage] = useState(1)

  // Guard setState-after-unmount (ControlRoomPage idiom) so a late fetch never writes
  // into an unmounted tree.
  const alive = useRef(true)

  // ── Stable fetchers. Each read is guarded with its own .catch so one failure keeps
  //    the last-known values (honest degrade, never a crash or a blanked surface). ──
  const fetchMembers = useCallback(async () => {
    try {
      const page = await getOrgMembers(1, MEMBERS_PAGE_SIZE)
      if (alive.current) {
        setMembers(page.members)
        // The still-pending invitees ride on the roster response (INV-01 adoption chips).
        setMemberPending(page.pending_invitations ?? [])
      }
    } catch {
      /* keep the last-known roster */
    }
  }, [])

  // The Invitations & Roles list fetch — guarded, honest-degrade (keeps the last-known list
  // on a blip), mirroring fetchMembers. The shell owns it; InvitationsTab is a pure leaf.
  const fetchInvitations = useCallback(async () => {
    try {
      const list = await listInvitations()
      if (alive.current) setInvitations(list)
    } catch {
      /* keep the last-known invitation list */
    }
  }, [])

  // The SSO connections fetch — guarded, honest-degrade (keeps the last-known list on a blip),
  // mirroring fetchInvitations. The shell owns it; SsoTab is a pure leaf (T-168-06: the fetch
  // is server-gated on sso:manage — a forced client mount still 403s).
  const fetchSsoConfigs = useCallback(async () => {
    try {
      const list = await listSsoConfigs()
      if (alive.current) setSsoConfigs(list)
    } catch {
      /* keep the last-known SSO connection list */
    }
  }, [])

  // The org audit fetch threads the server's `scope` flag straight through on the
  // returned page — the RLS-honest degrade (scope==='own') renders from server truth,
  // never a client decision (T-166-11).
  const fetchAudit = useCallback(async (filters: OrgAuditFilters, page: number) => {
    if (alive.current) setAuditLoading(true)
    try {
      const res = await getOrgAudit(filters, page, AUDIT_PAGE_SIZE)
      if (alive.current) setAuditResult(res)
    } catch {
      /* keep the last-known audit page */
    } finally {
      if (alive.current) setAuditLoading(false)
    }
  }, [])

  // ── Lifecycle guard. ──
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // ── Lazy per-tab fetch: fetch Members the first time the tab is opened (and on each
  //    re-open); fetch Audit on tab-open AND whenever the filters/page change (the shell
  //    owns that state). A non-manager never fires either — the fetch stays off the wire
  //    (belt to the server 403). ──
  useEffect(() => {
    if (!canManage) return
    if (activeTab === "members") void fetchMembers()
    if (activeTab === "audit") void fetchAudit(auditFilters, auditPage)
    if (activeTab === "invitations") void fetchInvitations()
    // The SSO fetch has its OWN gate (sso:manage) — org:manage alone must not read it.
    if (activeTab === "sso" && canManageSso) void fetchSsoConfigs()
  }, [
    activeTab,
    canManage,
    canManageSso,
    fetchMembers,
    fetchAudit,
    fetchInvitations,
    fetchSsoConfigs,
    auditFilters,
    auditPage,
  ])

  // ── Invitation mutations (INV-01): the shell performs the write on the caller's org
  //    (X-Org-Id + the org:invite server gate is the real wall — T-167-17) and re-fetches.
  //    A successful send re-fetches BOTH the list and the roster (the new pending invitee
  //    surfaces as a Pending adoption row). Resend returns the FRESH link-first URL so the
  //    leaf can surface it to copy (D-167-02). ──
  const handleInviteSent = useCallback(() => {
    void fetchInvitations()
    void fetchMembers()
  }, [fetchInvitations, fetchMembers])

  const handleResend = useCallback(
    async (id: string): Promise<string | null> => {
      try {
        const { link } = await resendInvitation(id)
        await fetchInvitations()
        return link || null
      } catch {
        return null
      }
    },
    [fetchInvitations],
  )

  const handleRevoke = useCallback(
    async (id: string): Promise<void> => {
      try {
        await revokeInvitation(id)
      } finally {
        await fetchInvitations()
        void fetchMembers()
      }
    },
    [fetchInvitations, fetchMembers],
  )

  // ── SSO mutations (SSO-01): the shell performs the write on the caller's org (X-Org-Id +
  //    the sso:manage server gate + the mig-104 RLS are the real wall — T-168-06) then
  //    re-fetches (re-fetch-not-optimistic, D-117-9 lineage). Create RE-THROWS so SsoTab's
  //    form can surface the server `{detail}` create-error copy; remove swallows + re-fetches
  //    (the row reflects server truth on the refresh). ──
  const handleSsoCreate = useCallback(
    async (metadataUrl: string, emailDomain: string): Promise<void> => {
      try {
        await createSsoProvider(metadataUrl, emailDomain)
      } finally {
        await fetchSsoConfigs()
      }
    },
    [fetchSsoConfigs],
  )

  const handleSsoRemove = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteSsoProvider(id)
      } finally {
        await fetchSsoConfigs()
      }
    },
    [fetchSsoConfigs],
  )

  // ── Audit filter/page intent from OrgAuditTab. A filter change resets to page 1 (the
  //    scoped total shifts); a page change walks the server pages. Both re-run the fetch
  //    effect above, which threads the fresh server `scope` back into the leaf. ──
  const handleAuditFiltersChange = useCallback((next: OrgAuditFilters) => {
    setAuditFilters(next)
    setAuditPage(1)
  }, [])
  const handleAuditPageChange = useCallback((page: number) => {
    setAuditPage(Math.max(1, page))
  }, [])

  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  // The active org's display name (from the membership set) headlines the band + the
  // Settings home. A never-fabricated fallback for the brief pre-resolve window.
  const orgName = useMemo(() => {
    return orgs.find((o) => o.org_id === activeOrgId)?.name ?? "Your organization"
  }, [orgs, activeOrgId])

  // ── Honest client guard (T-166-12): don't paint org chrome for a non-manager. The
  //    shell mounts only behind the canManage-gated rail entry (Plan 05) AND every fetch
  //    is server-gated (Plan 01) — this render guard is courtesy, not the boundary. ──
  if (!loading && !canManage) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <OrgBand
          orgName={orgName}
          role={role}
          onBack={onBack}
          showTechnical={showTechnical}
          onToggleTechnical={toggleTechnical}
        />
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            You don&rsquo;t have access to organization administration. Ask an org-admin for the
            manage permission.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <OrgBand
        orgName={orgName}
        role={role}
        onBack={onBack}
        showTechnical={showTechnical}
        onToggleTechnical={toggleTechnical}
      />

      {/* Horizontal section tabs (061-B — NOT a second left rail). Phase 155
          (A11Y-01): a <div> host, not <nav> — the interactive "tablist" role must
          not override a <nav> landmark's implicit "navigation" role. */}
      <div className="border-b border-border/60 px-6 py-2">
        <div
          role="tablist"
          aria-label="Organization admin sections"
          className="mx-auto flex max-w-6xl w-full items-center gap-1.5"
        >
          {TABS.map((t) => {
            const isActive = t.id === activeTab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors text-center",
                  isActive
                    ? "bg-primary/10 font-semibold text-primary"
                    : t.locked
                      ? "text-muted-foreground hover:bg-accent/40 hover:text-muted-foreground"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                {t.locked && <Lock className="h-3 w-3 flex-none" aria-hidden="true" />}
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Body switch (copy of the ControlRoomPage:630-793 shape): the 3 live leaves,
            then the FINAL LockedTab fallthrough that serves all 4 locked tabs from their
            phase-number-free `lockedDescription` (T-146-10 / T-166-13). */}
        {activeTab === "members" ? (
          <OrgMembersTab
            members={members}
            pendingInvitations={memberPending}
            query={memberQuery}
            onQueryChange={setMemberQuery}
          />
        ) : activeTab === "experts" ? (
          <OrgExpertsTab />
        ) : activeTab === "invitations" ? (
          // Phase 167 (D-167-07): the live invitations home. The shell owns the fetch +
          // mutations; InvitationsTab is a pure leaf. canManage is the render-only invite
          // gate (org:invite is the server wall — T-167-17).
          <InvitationsTab
            invitations={invitations}
            canInvite={canManage}
            onSent={handleInviteSent}
            onResend={handleResend}
            onRevoke={handleRevoke}
          />
        ) : activeTab === "audit" ? (
          // Thread the audit page straight through: the load-bearing `scope` flag rides ON
          // `result`, so the RLS-honest degrade renders from server truth (T-166-11).
          <OrgAuditTab
            result={auditResult}
            loading={auditLoading}
            filters={auditFilters}
            onFiltersChange={handleAuditFiltersChange}
            onPageChange={handleAuditPageChange}
            showTechnical={showTechnical}
            onToggleTechnical={toggleTechnical}
          />
        ) : activeTab === "settings" ? (
          <OrgSettingsTab orgName={orgName} />
        ) : activeTab === "sso" ? (
          // Phase 168 (D-168-01 / SSO-01): the live SSO home. The shell owns the fetch +
          // create/remove; SsoTab is a pure leaf. canManageSso is the render-only gate
          // (sso:manage is the server wall — T-168-06).
          <SsoTab
            configs={ssoConfigs}
            canManageSso={canManageSso}
            onCreate={handleSsoCreate}
            onRemove={handleSsoRemove}
          />
        ) : (
          <LockedTab title={active.label} description={active.lockedDescription} />
        )}
      </div>
    </div>
  )
}
