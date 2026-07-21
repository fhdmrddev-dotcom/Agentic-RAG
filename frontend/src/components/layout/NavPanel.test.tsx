/**
 * Phase 166 Plan 05 Task 2 (ADMIN-01 / ADMIN-05 / D-166-05 / sketch 079-C) — the
 * NavPanel rail-footer org surface: the indigo org-admin Shield-mirror + the
 * ProfileMenu anchor replacing the bare Sign out + the standalone theme RailItem removal.
 *
 * The Phase-156 rail contract (New Chat reachability, the ☰ toggle, stream-free purity)
 * is locked by the sibling __tests__/NavPanel.test.tsx — this file adds ONLY the
 * Phase-166 footer changes:
 *   1. canManage=true → an indigo org-admin Shield-mirror renders (parallel to the amber
 *      operator shield) and clicking it fires onNavigate("org-admin").
 *   2. canManage=false → the indigo shield is ABSENT (never a disabled button) — D-166-05.
 *   3. the indigo shield is NOT a member of the shared NAV_ITEMS array (the
 *      OUTSIDE-NAV_ITEMS contract holds for the org shield too).
 *   4. the footer renders the ProfileMenu anchor in place of the bare Sign out RailItem.
 *   5. exactly ONE theme control lives in the rail footer (inside the ProfileMenu) — the
 *      standalone theme-toggle RailItem is gone (079-C relocates theme into the menu).
 *
 * canManage is read via useOrgOptional() (NavPanel is inside OrgProvider in the app);
 * ProfileMenu (rendered in the footer) reads useAuth() — both mocked.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageSquare, FileText } from "lucide-react"

import { NavPanel } from "./NavPanel"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { NavItem } from "@/lib/nav-items"
import { useAuth } from "@/hooks/useAuth"
import { useOrgOptional } from "@/providers/OrgProvider"
import type { OrgValue } from "@/providers/OrgProvider"

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: vi.fn() }))

const navItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "documents", icon: FileText, label: "Documents" },
]

function orgValue(over: Partial<OrgValue>): OrgValue {
  return {
    activeOrgId: "o1",
    orgs: [{ org_id: "o1", name: "Acme", role: "org-admin" }],
    role: "org-admin",
    canManage: false,
    canAuditView: false,
    loading: false,
    switchOrg: vi.fn(),
    ...over,
  }
}

type NavProps = React.ComponentProps<typeof NavPanel>

function renderRail(overrides: Partial<NavProps> = {}, org: OrgValue = orgValue({})) {
  vi.mocked(useOrgOptional).mockReturnValue(org)
  const props: NavProps = {
    activeView: "chat",
    onNavigate: vi.fn(),
    navItems,
    isOperator: false,
    onNewThread: vi.fn(),
    onSignOut: vi.fn(),
    theme: "dark",
    onToggleTheme: vi.fn(),
    expanded: false,
    onToggleExpanded: vi.fn(),
    ...overrides,
  }
  const user = userEvent.setup()
  const utils = render(
    <TooltipProvider>
      <NavPanel {...props} />
    </TooltipProvider>,
  )
  return { ...utils, props, user }
}

beforeEach(() => {
  vi.clearAllMocks()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  vi.mocked(useAuth).mockReturnValue({
    user: { id: "u1", email: "alice@example.com", user_metadata: { name: "Alice" } },
  } as ReturnType<typeof useAuth>)
})

describe("NavPanel footer — indigo org-admin Shield-mirror (ADMIN-01 / D-166-05)", () => {
  it("renders the indigo org-admin shield when canManage=true and navigates to org-admin", async () => {
    const { props, user } = renderRail({}, orgValue({ canManage: true }))
    const shield = screen.getByRole("button", { name: /organization admin/i })
    expect(shield).toBeInTheDocument()
    await user.click(shield)
    expect(props.onNavigate).toHaveBeenCalledWith("org-admin")
  })

  it("renders NO indigo org-admin shield when canManage=false (absent, not disabled)", () => {
    renderRail({}, orgValue({ canManage: false }))
    expect(screen.queryByRole("button", { name: /organization admin/i })).toBeNull()
  })

  it("keeps the indigo shield OUTSIDE the shared NAV_ITEMS array", () => {
    renderRail({ navItems }, orgValue({ canManage: true }))
    // navItems carries NO org-admin entry; the shield renders purely from canManage.
    expect(navItems.some((i) => i.view === "org-admin")).toBe(false)
    expect(screen.getByRole("button", { name: /organization admin/i })).toBeInTheDocument()
  })

  it("coexists with the amber operator shield (both render, distinct names)", () => {
    renderRail({ isOperator: true }, orgValue({ canManage: true }))
    expect(screen.getByRole("button", { name: /control room/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /organization admin/i })).toBeInTheDocument()
  })
})

describe("NavPanel footer — ProfileMenu anchor replaces the bare Sign out (079-C)", () => {
  it("renders the ProfileMenu account anchor instead of a bare Sign out rail button", () => {
    renderRail()
    // The identity anchor is present…
    expect(screen.getByRole("button", { name: /account menu/i })).toBeInTheDocument()
    // …and Sign out is no longer a top-level rail button (it moved INTO the menu).
    expect(screen.queryByRole("button", { name: /^sign out$/i })).toBeNull()
  })

  it("Sign out lives inside the opened ProfileMenu and fires onSignOut", async () => {
    const { props, user } = renderRail()
    await user.click(screen.getByRole("button", { name: /account menu/i }))
    const signOut = await screen.findByRole("menuitem", { name: /sign out/i })
    await user.click(signOut)
    expect(props.onSignOut).toHaveBeenCalledTimes(1)
  })
})

describe("NavPanel footer — exactly ONE theme control (ADMIN-05 / WARNING-1)", () => {
  it("has NO standalone theme RailItem — the theme control lives ONLY inside the ProfileMenu", async () => {
    const { user } = renderRail({ theme: "dark" })
    // The old standalone theme RailItem (a rail button named Light/Dark Mode) is gone.
    expect(screen.queryByRole("button", { name: /dark mode|light mode/i })).toBeNull()
    // Opening the ProfileMenu reveals EXACTLY ONE theme control (the merged home).
    await user.click(screen.getByRole("button", { name: /account menu/i }))
    const themeControls = await screen.findAllByRole("menuitem", { name: /mode/i })
    expect(themeControls).toHaveLength(1)
  })

  it("the ProfileMenu theme item forwards onToggleTheme", async () => {
    const { props, user } = renderRail({ theme: "dark" })
    await user.click(screen.getByRole("button", { name: /account menu/i }))
    await user.click(await screen.findByRole("menuitem", { name: /mode/i }))
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1)
  })
})
