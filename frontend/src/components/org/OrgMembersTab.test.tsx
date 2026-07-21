/**
 * Phase 166 Plan 03 Task 2 (ADMIN-01 / D-166-01 / sketch 080-A) — OrgMembersTab tests.
 *
 * The Members tab is a READ-ONLY roster (invite/role editing is Phase 167). These
 * tests lock the load-bearing honesty:
 *   - Each row renders email + role chip + joined sub-line.
 *   - NO invite/disable/grant/role-edit control renders — the write affordances are
 *     ABSENT, never disabled buttons that lie (T-166-09).
 *   - An empty roster shows the empty state; a null roster shows the loading placeholder.
 *   - The read-only banner points at the (locked) Invitations tab and names NO roadmap
 *     phase number (T-146-10).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { OrgMembersTab } from "./OrgMembersTab"
import type { OrgMember } from "@/lib/api"

const MEMBERS: OrgMember[] = [
  { user_id: "u1", email: "ada@acme.test", role: "org-admin", joined_at: "2026-01-05T10:00:00Z" },
  { user_id: "u2", email: "grace@acme.test", role: "member", joined_at: "2026-03-11T10:00:00Z" },
  { user_id: "u3", email: "linus@acme.test", role: "dept-admin", joined_at: null },
]

const baseProps = {
  members: MEMBERS,
  query: "",
  onQueryChange: vi.fn(),
}

describe("OrgMembersTab — read-only roster (ADMIN-01)", () => {
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

  it("renders NO invite / disable / grant / role-edit control (affordances ABSENT, not disabled)", () => {
    render(<OrgMembersTab {...baseProps} />)
    // Read-only roster: there are no action buttons at all — the search box is an input,
    // not a button. A disabled button that lies is explicitly rejected (080-A).
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByRole("button", { name: /invite/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /disable/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /make .*admin|grant|edit role/i })).toBeNull()
  })

  it("shows the empty state for an empty roster", () => {
    render(<OrgMembersTab {...baseProps} members={[]} />)
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })

  it("shows the loading placeholder for a null roster", () => {
    render(<OrgMembersTab {...baseProps} members={null} />)
    expect(screen.getByText(/loading members/i)).toBeInTheDocument()
  })

  it("points the read-only banner at the Invitations tab with NO roadmap phase number", () => {
    render(<OrgMembersTab {...baseProps} />)
    const banner = screen.getByText(/read-only/i)
    expect(banner).toBeInTheDocument()
    expect(banner.textContent ?? "").toMatch(/invitations/i)
    // T-146-10: shipped copy NEVER names a roadmap phase number.
    expect(banner.textContent ?? "").not.toMatch(/\d/)
  })
})
