// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 03 (ADMIN-01 / D-166-01 / sketch 080-A) — the read-only Members roster.
//
// The user-side mirror of the operator `UsersAndAccess` roster, with EVERY write
// path removed: inviting people and managing roles is Phase 167, and until it ships
// the affordances are honestly ABSENT — never disabled buttons that lie (080-A /
// T-166-09). A small banner points at the (locked) Invitations & Roles tab.
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

import type { OrgMember } from "@/lib/api"

interface OrgMembersTabProps {
  /** Every roster row the shell fetched; `null` while the fetch is in flight. */
  members: OrgMember[] | null
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

/** The read-only org members roster (080-A instrument table, writes stripped). */
export function OrgMembersTab({ members, query, onQueryChange }: OrgMembersTabProps) {
  const filtered = useMemo(() => {
    if (members == null) return null
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => (m.email ?? "").toLowerCase().includes(q))
  }, [members, query])

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

      {/* Read-only honesty (ADMIN-01): inviting people / managing roles is ABSENT here.
          It will live in the locked Invitations & Roles tab — no disabled button that
          lies, and no roadmap phase number in the copy (T-146-10). */}
      <p className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        This roster is read-only. Inviting people and managing roles is coming soon &mdash; it will
        live in the Invitations &amp; Roles tab.
      </p>

      {members == null ? (
        <div
          aria-busy="true"
          className="rounded-[10px] border border-border bg-card px-4 py-6 text-sm text-muted-foreground opacity-40"
        >
          Loading members…
        </div>
      ) : filtered != null && filtered.length === 0 ? (
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
          </div>
        </div>
      )}
    </section>
  )
}

/** One roster row — identity block + role chip. No write affordances by construction. */
function MemberRow({ member }: { member: OrgMember }) {
  const email = member.email ?? "unknown member"
  const initial = (member.email ?? "?").trim().charAt(0).toUpperCase() || "?"
  const badge = roleBadge(member.role)

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
    </div>
  )
}
