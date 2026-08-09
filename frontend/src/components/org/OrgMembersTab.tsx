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
// mig-104 4-tier role to the D-166-05 Org-admin / Member copy, in org-indigo (via RoleBadge).
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The shell (Plan 04) owns the fetch +
// the search state; this leaf renders the roster and reports query changes.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react"
import { Search } from "lucide-react"

import type { AdoptionState, OrgMember, PendingInvitation } from "@/lib/api"
import { RoleBadge, OrgAvatar } from "./OrgIdentity"
import { StatusChip } from "./StatusChip"

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

/**
 * Map the server-derived member-ADOPTION state to a chip tone (INV-01).
 *
 * DOMAIN EXEMPTION — DO NOT "fix" this to green. Member-adoption ("Active" / "Pending") is a
 * DISTINCT domain from the invitation / SSO LIFECYCLE that `statusChipMeta` (StatusChip.tsx)
 * maps. An active member is the calm resting state of a roster, so `active` deliberately reads
 * `muted` (NOT `success`-green) — otherwise a healthy org becomes a wall of green success chips.
 * `pending` reads org-indigo `primary` (needs attention — still to join). We render this tone
 * THROUGH the shared <StatusChip> COMPONENT (the D-08 cohesion win), but the tone MAPPING stays
 * adoption-domain-specific and intentionally does NOT reuse the lifecycle `statusChipMeta`. */
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

/** The role + adoption chips shared by member + pending rows. Both render through the shared
 *  177-01 primitives: the role badge via <RoleBadge>, the adoption chip via the <StatusChip>
 *  COMPONENT fed the adoption-domain tone (see adoptionChip). Pure spans — no interactive
 *  element, so the roster stays a pure read leaf (zero <button>). */
function RowChips({ role, state }: { role: string; state: AdoptionState }) {
  const adoption = adoptionChip(state)
  return (
    <>
      {/* Role slot (D-04 / D-166-05) — the shared org-indigo Org-admin / Member badge. */}
      <div className="flex-none">
        <RoleBadge role={role} />
      </div>

      {/* Adoption slot (D-08 / INV-01) — the SHARED StatusChip component fed the adoption-domain
          tone (active→muted, NOT success-green; see adoptionChip's domain-exemption note). */}
      <div className="flex-none">
        <StatusChip tone={adoption.tone} testId="adoption-chip">
          {adoption.label}
        </StatusChip>
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
        <OrgAvatar initial={initial} />
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
        <OrgAvatar initial={initial} pending />
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
