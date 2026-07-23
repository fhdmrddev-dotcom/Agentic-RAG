/**
 * Phase 166 Plan 05 Task 1 (ADMIN-02 / ADMIN-03 / ADMIN-05 / D-166-02 / D-166-05 /
 * sketch 079-C) — ProfileMenu, the merged rail-footer identity popover.
 *
 * The 079-C Hybrid: ONE rail-footer identity anchor opens a popover holding, top to
 * bottom: identity (name/email from useAuth) + the ◆ Org-admin / Member role badge +
 * the org-switcher section (renders ONLY at 2+ orgs — D-166-02; solo = a quiet name
 * button, no switcher chrome) + the theme toggle + Sign out. Picking an org delegates
 * to OrgProvider.switchOrg (which owns the D-166-08 teardown) — the menu is
 * presentational and NEVER tears down streams itself.
 *
 * These tests lock the composition + the load-bearing beats:
 *   1. the popover header shows the user's name/email + the role badge (org role).
 *   2. with 2+ orgs the switcher renders and picking a non-active org calls switchOrg(id).
 *   3. with exactly 1 org NO switcher chrome renders (solo = a quiet name button).
 *   4. the popover contains a theme toggle + Sign out (sign-out lives INSIDE the menu).
 *   5. the anchor renders icon-only when collapsed (dual-render) and opens on click.
 *   6. (Phase 177 / D-04 / D-05) the badge is the ONE shared RoleBadge and follows the
 *      ACTIVE org's role — muted Member here, ◆ Org-admin there.
 *
 * useAuth + useOrgOptional are mocked (the menu is a presentational leaf over context).
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ProfileMenu } from "./ProfileMenu"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAuth } from "@/hooks/useAuth"
import { useOrgOptional } from "@/providers/OrgProvider"
import type { OrgValue } from "@/providers/OrgProvider"

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: vi.fn() }))

const USER = {
  id: "u1",
  email: "alice@example.com",
  user_metadata: { name: "Alice Doe" },
} as unknown as ReturnType<typeof useAuth>["user"]

/** Build a full OrgValue for the mock (all fields present — the menu reads a subset). */
function orgValue(over: Partial<OrgValue>): OrgValue {
  return {
    activeOrgId: "o1",
    orgs: [],
    role: "member",
    canManage: false,
    canAuditView: false,
    canManageSso: false,
    loading: false,
    switchOrg: vi.fn(),
    ...over,
  }
}

function setup(props: Partial<React.ComponentProps<typeof ProfileMenu>> = {}) {
  const merged: React.ComponentProps<typeof ProfileMenu> = {
    theme: "dark",
    onToggleTheme: vi.fn(),
    onSignOut: vi.fn(),
    collapsed: false,
    ...props,
  }
  const user = userEvent.setup()
  render(
    <TooltipProvider>
      <ProfileMenu {...merged} />
    </TooltipProvider>,
  )
  return { user, props: merged }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
  // implement; stub them so the popover opens under user-event (the standard shim).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  vi.mocked(useAuth).mockReturnValue({ user: USER } as ReturnType<typeof useAuth>)
  vi.mocked(useOrgOptional).mockReturnValue(orgValue({}))
})

describe("ProfileMenu — identity header + role badge (ADMIN-03 / D-166-05)", () => {
  it("shows the user name + email and the ◆ Org-admin badge for an org-admin", async () => {
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ role: "org-admin", orgs: [{ org_id: "o1", name: "Acme", role: "org-admin" }] }),
    )
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))

    // Scope to the opened menu — the expanded anchor ALSO paints the name, so the
    // header assertion targets the popover (role="menu") to avoid the anchor duplicate.
    const menu = await screen.findByRole("menu")
    expect(within(menu).getByText("Alice Doe")).toBeInTheDocument()
    expect(within(menu).getByText("alice@example.com")).toBeInTheDocument()
    expect(within(menu).getByText("Org-admin")).toBeInTheDocument()
    expect(within(menu).queryByText("Member")).toBeNull()
  })

  it("shows the muted Member badge for a plain member", async () => {
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ role: "member", orgs: [{ org_id: "o1", name: "Acme", role: "member" }] }),
    )
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))

    expect(await screen.findByText("Member")).toBeInTheDocument()
    expect(screen.queryByText("Org-admin")).toBeNull()
  })
})

describe("ProfileMenu — org switcher (ADMIN-02 / D-166-02 / D-166-08)", () => {
  it("renders the switcher + lists orgs, and picking a non-active org calls switchOrg(id)", async () => {
    const switchOrg = vi.fn()
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({
        activeOrgId: "o1",
        role: "org-admin",
        switchOrg,
        orgs: [
          { org_id: "o1", name: "Acme", role: "org-admin" },
          { org_id: "o2", name: "Globex", role: "member" },
        ],
      }),
    )
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))

    expect(await screen.findByText("Switch organization")).toBeInTheDocument()
    expect(screen.getByText("Acme")).toBeInTheDocument()
    // Pick the non-active org → switchOrg fires with ITS id (never a teardown here).
    await user.click(screen.getByRole("menuitem", { name: /globex/i }))
    expect(switchOrg).toHaveBeenCalledWith("o2")
    expect(switchOrg).toHaveBeenCalledTimes(1)
  })

  it("renders NO switcher chrome for a solo (1-org) user — quiet name button (D-166-02)", async () => {
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ role: "org-admin", orgs: [{ org_id: "o1", name: "Acme", role: "org-admin" }] }),
    )
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))

    const menu = await screen.findByRole("menu")
    expect(within(menu).getByText("Alice Doe")).toBeInTheDocument()
    expect(within(menu).queryByText("Switch organization")).toBeNull()
  })
})

describe("ProfileMenu — theme + sign out live inside the menu (ADMIN-05)", () => {
  it("renders a theme toggle + Sign out, and Sign out fires onSignOut", async () => {
    const { user, props } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))

    expect(await screen.findByRole("menuitem", { name: /mode/i })).toBeInTheDocument()
    const signOut = screen.getByRole("menuitem", { name: /sign out/i })
    await user.click(signOut)
    expect(props.onSignOut).toHaveBeenCalledTimes(1)
  })

  it("the theme item fires onToggleTheme without closing to another home", async () => {
    const { user, props } = setup({ theme: "dark" })
    await user.click(screen.getByRole("button", { name: /account menu/i }))
    await user.click(await screen.findByRole("menuitem", { name: /mode/i }))
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1)
  })
})

describe("ProfileMenu — collapsed-rail dual-render (sketch 079-C)", () => {
  it("renders icon-only when collapsed (no email in the anchor) and opens the popover on click", async () => {
    cleanup()
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ role: "org-admin", orgs: [{ org_id: "o1", name: "Acme", role: "org-admin" }] }),
    )
    const { user } = setup({ collapsed: true })

    // Collapsed anchor is icon-only: the email is NOT painted until the popover opens.
    expect(screen.queryByText("alice@example.com")).toBeNull()
    const anchor = screen.getByRole("button", { name: /account menu/i })
    await user.click(anchor)
    // Opening reveals the full identity header inside the popover.
    expect(await screen.findByText("Alice Doe")).toBeInTheDocument()
    expect(screen.getAllByText("alice@example.com").length).toBeGreaterThan(0)
  })
})

describe("ProfileMenu — per-org role display via the shared RoleBadge (Phase 177 / D-04 / D-05)", () => {
  // D-05: the badge reflects the ACTIVE org's role. OrgProvider re-derives `role` per active
  // org (the activeOrgId-keyed, fail-closed permissions probe), so an org switch re-drives the
  // provider value the menu reads (`org?.role`). The menu itself adds NO switching behavior —
  // here we assert the DISPLAY tracks that per-org role: Member when active at Globex,
  // Org-admin when active at Acme, rendered through the ONE shared RoleBadge.
  it("follows the active org's role — muted Member (member active org), then ◆ Org-admin (org-admin active org)", async () => {
    const orgs = [
      { org_id: "o1", name: "Acme", role: "org-admin" },
      { org_id: "o2", name: "Globex", role: "member" },
    ]

    // Active org = Globex (role member) → the shared badge shows the muted Member pill.
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ activeOrgId: "o2", role: "member", orgs }),
    )
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))
    const memberBadge = await screen.findByTestId("role-badge")
    expect(memberBadge).toHaveAttribute("data-admin", "false")
    expect(memberBadge).toHaveTextContent("Member")
    expect(memberBadge).not.toHaveTextContent("Org-admin")

    // Switch the active org = Acme (role org-admin) → the SAME shared badge now shows ◆ Org-admin
    // (the display follows the provider's per-org role — no new switching logic in the menu).
    cleanup()
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ activeOrgId: "o1", role: "org-admin", orgs }),
    )
    const { user: user2 } = setup()
    await user2.click(screen.getByRole("button", { name: /account menu/i }))
    const adminBadge = await screen.findByTestId("role-badge")
    expect(adminBadge).toHaveAttribute("data-admin", "true")
    expect(adminBadge).toHaveTextContent("Org-admin")
  })

  // D-04: the role is rendered by the ONE shared RoleBadge component (its data-testid) — the
  // same element the OrgBand shell band renders — not a per-surface inline look-alike.
  it("renders the role via the shared RoleBadge component (data-testid) inside the popover header", async () => {
    vi.mocked(useOrgOptional).mockReturnValue(
      orgValue({ role: "org-admin", orgs: [{ org_id: "o1", name: "Acme", role: "org-admin" }] }),
    )
    const { user } = setup()
    await user.click(screen.getByRole("button", { name: /account menu/i }))

    // Scope to the opened popover; the shared primitive renders exactly one role-badge there.
    const menu = await screen.findByRole("menu")
    const badge = within(menu).getByTestId("role-badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent("Org-admin")
  })
})
