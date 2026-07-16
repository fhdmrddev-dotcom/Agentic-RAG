/**
 * Phase 156 (POLISH-01, Wave 1) — NavPanel-as-permanent-rail live contract
 * (SC#1 + D-07).
 *
 * Replaces the Wave-0 `it.todo` scaffold: NavPanel is now the thin 58px icon rail.
 * These tests lock New Chat reachability on every view (SC#1), nav items rendered as
 * icon buttons, the probe-gated operator shield staying OUTSIDE navItems (D-07), the
 * collapse machinery removed (no toggle, no nav_panel_collapsed), and the rail being
 * stream-free (renders with only a TooltipProvider — NO StreamsProvider).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MessageSquare, FileText } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { NavItem } from "@/lib/nav-items"
import type { ActiveView } from "@/App"
import { NavPanel } from "../NavPanel"

const navItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "documents", icon: FileText, label: "Documents" },
]

type NavProps = React.ComponentProps<typeof NavPanel>

function renderRail(overrides: Partial<NavProps> = {}) {
  const props: NavProps = {
    activeView: "chat",
    onNavigate: vi.fn(),
    navItems,
    isOperator: false,
    onNewThread: vi.fn(),
    onSignOut: vi.fn(),
    theme: "dark",
    onToggleTheme: vi.fn(),
    ...overrides,
  }
  // Only a TooltipProvider — deliberately NO StreamsProvider (proves the rail is
  // stream-free after the thread region moved to ChatHistoryColumn).
  const utils = render(
    <TooltipProvider>
      <NavPanel {...props} />
    </TooltipProvider>,
  )
  return { ...utils, props }
}

afterEach(() => cleanup())

describe("NavPanel rail — New Chat reachability (SC#1)", () => {
  it("renders a New Chat button reachable by role name /new chat/i on every activeView", () => {
    for (const view of ["chat", "documents", "settings", "workflows"] as ActiveView[]) {
      const { unmount } = renderRail({ activeView: view })
      expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument()
      unmount()
    }
  })

  it("New Chat click fires onNewThread and navigates to the chat view", () => {
    const { props } = renderRail({ activeView: "settings" })
    fireEvent.click(screen.getByRole("button", { name: /new chat/i }))
    expect(props.onNewThread).toHaveBeenCalled()
    expect(props.onNavigate).toHaveBeenCalledWith("chat")
  })
})

describe("NavPanel rail — nav items + operator shield (D-07)", () => {
  it("renders each navItems entry as a tooltip-wrapped icon button", () => {
    renderRail()
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Documents" })).toBeInTheDocument()
  })

  it("renders NO operator shield when isOperator=false", () => {
    renderRail({ isOperator: false })
    expect(screen.queryByRole("button", { name: /control room/i })).toBeNull()
  })

  it("renders the amber operator shield (name /control room/i) when isOperator=true", () => {
    renderRail({ isOperator: true })
    expect(screen.getByRole("button", { name: /control room/i })).toBeInTheDocument()
  })

  it("keeps the operator shield OUTSIDE navItems (probe-gated, not in NAV_ITEMS)", () => {
    // navItems carries NO control-room entry (the D-07 lock in nav-items.test.ts); the
    // shield still renders purely from isOperator → it is a separate rail element.
    renderRail({ isOperator: true, navItems })
    expect(navItems.some((i) => i.view === "control-room")).toBe(false)
    expect(screen.getByRole("button", { name: /control room/i })).toBeInTheDocument()
  })
})

describe("NavPanel rail — collapse machinery removed + stream-free (D-07)", () => {
  it('renders NO "Collapse navigation" / "Expand navigation" toggle', () => {
    renderRail()
    expect(screen.queryByRole("button", { name: /collapse navigation/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /expand navigation/i })).toBeNull()
  })

  it("reads/writes NO nav_panel_collapsed localStorage key", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    renderRail()
    fireEvent.click(screen.getByRole("button", { name: "Chat" }))
    const touchedKeys = [
      ...getItem.mock.calls.map((c) => c[0]),
      ...setItem.mock.calls.map((c) => c[0]),
    ]
    expect(touchedKeys).not.toContain("nav_panel_collapsed")
    getItem.mockRestore()
    setItem.mockRestore()
  })

  it("renders WITHOUT a StreamsProvider (the rail is stream-free post-refactor)", () => {
    // The render helper wraps only in TooltipProvider — if the rail still imported
    // useStreamingThreadIds/useStreamActions it would throw here.
    expect(() => renderRail()).not.toThrow()
  })
})
