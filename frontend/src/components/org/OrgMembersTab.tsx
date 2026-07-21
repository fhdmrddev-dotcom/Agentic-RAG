// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 03 → Phase 167 Plan 05 (ADMIN-01 / INV-01 / sketch 080-A) — the Members roster.
//
// The user-side mirror of the operator `UsersAndAccess` roster. Phase 167 makes invites
// LIVE (the invite/resend/revoke affordances live in the sibling Invitations & Roles tab,
// NOT here — the roster stays a pure read leaf with no write controls). What Phase 167 ADDS
// here is server-derived ADOPTION-STATE chips (INV-01): every active member reads `Active`,
// and the org's still-PENDING invitees render as their own rows with a `Pending` chip. The
// stale "read-only / coming soon" banner is GONE (invites are live now).
//
// Reused from the operator roster: the header + client-side search-over-the-loaded-
// page (never an unbounded fetch), the `members == null` loading placeholder + empty
// state, and the avatar + email + joined identity block. The role chip maps the
// mig-104 4-tier role to the D-166-05 `◆ Org-admin` / `Member` copy, in org-indigo.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 04) owns the fetch +
// the search state; this leaf renders the roster and reports query changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react"
import { Search } from "lucide-react"

import type { AdoptionState, OrgMember, PendingInvitation } from "@/lib/api"

interface OrgMembersTabProps {
  /** Every roster row the shell fetched; `null` while the fetch is in flight. */
  members: OrgMember[] | null
  /** The org's still-pending invitees (Phase 167 / INV-01) — rendered as `Pending` rows
   *  beneath the active members. Optional (empty pre-167 / when none pending). */
  pendingInvitations?: PendingInvitation[]
  /** The client-side email search value (the shell owns the state). */
  query: string
  onQueryChange: (query: string) => void
}

/** The joined date for the identity sub-line — absolute, never fabricated. */
function formatJoined(iso: string | null): string {
  if (!iso) return "unknown"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "unknown"
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** Map the mig-104 4-tier role to a display chip (D-166-05). Managers read as the
 *  indigo `◆ Org-admin` badge; members read as the muted `Member` badge. */
function roleBadge(role: string): { label: string; admin: boolean } {
  if (role === "org-admin" || role === "super-admin") return { label: "Org-admin", admin: true }
  if (role === "dept-admin") return { label: "Dept-admin", admin: true }
  return { label: "Member", admin: false }
}

/** Map the server-derived adoption state to a chip (INV-01). `active` reads as a calm muted
 *  chip; `pending` reads as the org-indigo `primary` chip (needs attention — still to join).
 *  Reuses the 166 two-shape chip vocabulary; amber stays reserved for the operator zone. */
function adoptionChip(state: AdoptionState): { label: string; tone: "muted" | "primary" } {
  return state === "pending"
    ? { label: "Pending", tone: "primary" }
    : { label: "Active", tone: "muted" }
}

/** The org members roster (080-A instrument table) — read-only rows + adoption chips. */
export function OrgMembersTab({
  members,
  pendingInvitations,
  query,
  onQueryChange,
}: OrgMembersTabProps) {
  const filtered = useMemo(() => {
    if (members == null) return null
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => (m.email ?? "").toLowerCase().includes(q))
  }, [members, query])

  // Still-pending invitees render beneath the active members (INV-01), searchable too.
  const filteredPending = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pending = pendingInvitations ?? []
    if (!q) return pending
    return pending.filter((p) => (p.email ?? "").toLowerCase().includes(q))
  }, [pendingInvitations, query])

  return (
    <section aria-label="Organization members" className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-headline text-base font-bold text-foreground">Members</h3>
        <span className="flex-1" />
        {/* Search over the loaded page — client-side, never an unbounded fetch. */}
        <label className="relative inline-flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground/60"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search email…"
            aria-label="Search members by email"
            className="w-56 rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-muted-foreground/40 focus:outline-none"
          />
        </label>
      </div>

      {/* Invites are LIVE (Phase 167): the send/resend/revoke affordances live in the
          sibling Invitations & Roles tab — this roster stays a pure read view with
          server-derived adoption chips. No stale "coming soon" banner. */}

      {members == null ? (
        <div
          aria-busy="true"
          className="rounded-[10px] border border-border bg-card px-4 py-6 text-sm text-muted-foreground opacity-40"
        >
          Loading members…
        </div>
      ) : filtered != null && filtered.length === 0 && filteredPending.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <div className="text-sm font-semibold text-foreground">
            {query.trim() ? "No members match that search" : "No members yet"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {query.trim()
              ? "Try a different email fragment."
              : "People appear here once they join your organization."}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="divide-y divide-border/60">
            {(filtered ?? []).map((member) => (
              <MemberRow key={member.user_id} member={member} />
            ))}
            {/* Still-pending invitees (INV-01) — not yet org_members, shown with a Pending chip. */}
            {filteredPending.map((inv) => (
              <PendingRow key={inv.id} invite={inv} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** The role + adoption chips shared by member + pending rows (166 two-shape vocabulary). */
function RowChips({ role, state }: { role: string; state: AdoptionState }) {
  const badge = roleBadge(role)
  const adoption = adoptionChip(state)
  return (
    <>
      {/* Role chip (D-166-05) — org-indigo; managers show the ◆ badge. */}
      <div className="flex-none">
        {badge.admin ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <span aria-hidden="true">◆</span>
            {badge.label}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {badge.label}
          </span>
        )}
      </div>

      {/* Adoption chip (INV-01) — Active (muted) vs Pending (indigo primary). */}
      <div className="flex-none">
        <span
          data-testid="adoption-chip"
          className={
            adoption.tone === "primary"
              ? "inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              : "inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {adoption.label}
        </span>
      </div>
    </>
  )
}

/** One member row — identity block + role + adoption chips. No write affordances. */
function MemberRow({ member }: { member: OrgMember }) {
  const email = member.email ?? "unknown member"
  const initial = (member.email ?? "?").trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
      {/* Identity: avatar + email + joined sub-line. */}
      <div className="flex min-w-0 flex-[2] items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-semibold text-white"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground" title={email}>
            {email}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            joined {formatJoined(member.joined_at)}
          </div>
        </div>
      </div>

      {/* A member is active by construction; the server marks it so. */}
      <RowChips role={member.role} state={member.state ?? "active"} />
    </div>
  )
}

/** One still-pending invitee row — identity + role + a Pending adoption chip (INV-01). Not
 *  an org_members row yet; management (resend/revoke) lives in the Invitations & Roles tab. */
function PendingRow({ invite }: { invite: PendingInvitation }) {
  const email = invite.email ?? "unknown invitee"
  const initial = (invite.email ?? "?").trim().charAt(0).toUpperCase() || "?"

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
      <div className="flex min-w-0 flex-[2] items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-dashed border-primary/40 bg-primary/[0.06] text-sm font-semibold text-primary"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground" title={email}>
            {email}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">invited, not yet joined</div>
        </div>
      </div>

      <RowChips role={invite.role} state="pending" />
    </div>
  )
}
