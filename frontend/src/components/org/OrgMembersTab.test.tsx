/**
 * Phase 166 Plan 03 Task 2 → Phase 167 Plan 05 Task 3 (ADMIN-01 / INV-01) — OrgMembersTab tests.
 *
 * The Members roster. Phase 167 makes invites LIVE, so the roster:
 *   - shows an adoption-state chip per row: active members read `Active`; still-pending
 *     invitees render as their own rows with a `Pending` chip (server-derived `state`,
 *     never a client flag — reusing the 166 chip vocabulary);
 *   - NO LONGER carries the stale "read-only / coming soon" banner (invites are live).
 * It still holds NO write affordances of its own (inviting lives in the Invitations tab),
 * so the roster remains a pure read leaf.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { OrgMembersTab } from "./OrgMembersTab"
import type { OrgMember, PendingInvitation } from "@/lib/api"

const MEMBERS: OrgMember[] = [
  { user_id: "u1", email: "ada@acme.test", role: "org-admin", joined_at: "2026-01-05T10:00:00Z", state: "active" },
  { user_id: "u2", email: "grace@acme.test", role: "member", joined_at: "2026-03-11T10:00:00Z", state: "active" },
  { user_id: "u3", email: "linus@acme.test", role: "dept-admin", joined_at: null, state: "active" },
]

const PENDING: PendingInvitation[] = [
  {
    id: "inv1",
    email: "newbie@acme.test",
    role: "member",
    status: "pending",
    state: "pending",
    invited_at: "2026-07-20T10:00:00Z",
    expires_at: "2026-07-27T10:00:00Z",
  },
]

const baseProps = {
  members: MEMBERS,
  query: "",
  onQueryChange: vi.fn(),
}

describe("OrgMembersTab — roster + adoption chips (ADMIN-01 / INV-01)", () => {
  it("renders each member's email + role chip + joined sub-line", () => {
    render(<OrgMembersTab {...baseProps} />)
    expect(screen.getByText("ada@acme.test")).toBeInTheDocument()
    expect(screen.getByText("grace@acme.test")).toBeInTheDocument()
    // Role chips (D-166-05 copy).
    expect(screen.getAllByText("Org-admin").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Member")).toBeInTheDocument()
    // Joined sub-line (absolute, never fabricated — null → "unknown").
    expect(screen.getAllByText(/joined/i).length).toBe(3)
  })

  it("shows an `Active` adoption chip on each member row (server-derived state)", () => {
    render(<OrgMembersTab {...baseProps} />)
    expect(screen.getAllByText("Active").length).toBe(3)
  })

  it("renders a still-pending invitee as its own row with a `Pending` chip", () => {
    render(<OrgMembersTab {...baseProps} pendingInvitations={PENDING} />)
    expect(screen.getByText("newbie@acme.test")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
  })

  it("renders NO invite / disable / grant / role-edit control (roster stays a pure read leaf)", () => {
    render(<OrgMembersTab {...baseProps} />)
    // The roster itself has no action buttons — inviting lives in the Invitations tab. The
    // search box is an input, not a button. A disabled button that lies is rejected (080-A).
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("button", { name: /invite/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /disable/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /make .*admin|grant|edit role/i })).toBeNull()
  })

  it("no longer shows the stale read-only 'coming soon' banner (invites are live)", () => {
    render(<OrgMembersTab {...baseProps} />)
    expect(screen.queryByText(/read-only/i)).toBeNull()
    expect(screen.queryByText(/coming soon/i)).toBeNull()
  })

  it("shows the empty state for an empty roster", () => {
    render(<OrgMembersTab {...baseProps} members={[]} />)
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })

  it("shows the loading placeholder for a null roster", () => {
    render(<OrgMembersTab {...baseProps} members={null} />)
    expect(screen.getByText(/loading members/i)).toBeInTheDocument()
  })
})
