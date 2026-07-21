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
  getOrgAudit,
  getOrgMembers,
  type OrgAuditFilters,
  type OrgAuditPage,
  type OrgMember,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import { useOrg } from "@/providers/OrgProvider"
import { useTechnicalNames } from "@/providers/TechnicalNamesProvider"
import { LockedTab } from "@/components/admin/LockedTab"
import { OrgBand } from "./OrgBand"
import { OrgMembersTab } from "./OrgMembersTab"
import { OrgAuditTab } from "./OrgAuditTab"
import { OrgSettingsTab } from "./OrgSettingsTab"

interface OrgAdminShellProps {
  /** Return to the ordinary app surface (navigates to "chat"). */
  onBack: () => void
}

type OrgAdminTab =
  | "members"
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
  { id: "audit", label: "Audit", locked: false },
  { id: "settings", label: "Settings", locked: false },
  {
    id: "invitations",
    label: "Invitations & Roles",
    locked: true,
    lockedDescription: "Inviting people and managing roles is coming soon.",
  },
  {
    id: "sso",
    label: "SSO",
    locked: true,
    lockedDescription: "Single sign-on setup is coming soon.",
  },
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
  const { activeOrgId, orgs, role, canManage, loading } = useOrg()
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
      if (alive.current) setMembers(page.members)
    } catch {
      /* keep the last-known roster */
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
  }, [activeTab, canManage, fetchMembers, fetchAudit, auditFilters, auditPage])

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
      <div
        role="tablist"
        aria-label="Organization admin sections"
        className="flex flex-wrap items-center gap-1 border-b border-border/60 px-6 py-2"
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
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : t.locked
                    ? "text-muted-foreground hover:bg-accent/40 hover:text-muted-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
              )}
            >
              {t.locked && <Lock className="h-3 w-3 flex-none" aria-hidden="true" />}
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Body switch (copy of the ControlRoomPage:630-793 shape): the 3 live leaves,
            then the FINAL LockedTab fallthrough that serves all 4 locked tabs from their
            phase-number-free `lockedDescription` (T-146-10 / T-166-13). */}
        {activeTab === "members" ? (
          <OrgMembersTab members={members} query={memberQuery} onQueryChange={setMemberQuery} />
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
        ) : (
          <LockedTab title={active.label} description={active.lockedDescription} />
        )}
      </div>
    </div>
  )
}
