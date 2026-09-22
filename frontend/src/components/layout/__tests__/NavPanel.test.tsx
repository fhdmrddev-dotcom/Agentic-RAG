/**
 * Phase 156 (POLISH-01, Wave 1) — NavPanel-as-permanent-rail live contract
 * (SC#1 + D-07).
 *
 * Replaces the Wave-0 `it.todo` scaffold: NavPanel is now the thin 58px icon rail.
 * These tests lock New Chat reachability on every view (SC#1), nav items rendered as
 * icon buttons, the probe-gated operator shield staying OUTSIDE navItems (D-07), and the
 * rail being stream-free (renders with only a TooltipProvider — NO StreamsProvider).
 *
 * Refinement (operator 2026-07-16): the OLD content-masking collapse (which hid New
 * Chat) is gone; a NEW pinned ☰ toggle swaps icons⇄labels WITHOUT hiding content — so
 * the D-07 invariant (New Chat reachable in every rail state) is now structural. The
 * rail stays presentational: the toggle delegates to a parent callback, the rail itself
 * touches no localStorage (parent owns nav_rail_expanded).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { MessageSquare, FileText } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { NAV_ITEMS, type NavItem } from "@/lib/nav-items"
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
    // Phase 156 REFINEMENT: the pinned ☰ expand/collapse state (parent-owned).
    expanded: false,
    onToggleExpanded: vi.fn(),
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

  // ── Phase 257.1 (METER-07 reachability) ──────────────────────────────────────────────
  // Phase 257 shipped the spend cockpit with its ActiveView and its ChatLayout mount and NO
  // ENTRY ACTION, so the only way to reach it was to type `/admin/spend` into the address
  // bar. That is the Phase-118 built-but-unreachable lesson recurring, and it is exactly the
  // leg of the triad that no typecheck and no unit test can notice on its own — which is why
  // these three cases exist rather than a comment.

  it("renders a Spend entry when isOperator=true — the cockpit is reachable without typing a URL", () => {
    renderRail({ isOperator: true })
    expect(screen.getByRole("button", { name: /spend/i })).toBeInTheDocument()
  })

  it("renders NO Spend entry for a non-operator (the D-07 vanish, not a disabled control)", () => {
    renderRail({ isOperator: false })
    expect(screen.queryByRole("button", { name: /spend/i })).not.toBeInTheDocument()
  })

  it("navigates to admin-spend when the Spend entry is clicked", () => {
    const onNavigate = vi.fn()
    renderRail({ isOperator: true, onNavigate })
    fireEvent.click(screen.getByRole("button", { name: /spend/i }))
    expect(onNavigate).toHaveBeenCalledWith("admin-spend")
  })

  // ── Phase 262 plan 05 (PACK-11 / D-262-03) ───────────────────────────────────────────
  // The catalog's entry action, in the Phase-257.1 shape one describe over. ⛔ These two
  // render the SHIPPED `NAV_ITEMS`, never the two-item fixture at the top of this file — a
  // rail proven against a fixture proves the rail, and the leg that goes missing is the
  // ARRAY ENTRY. `activeViewReachability` covers the member and the branch and is blind to
  // this one, which is why it is a rendered click and not a comment.

  it("renders an Experts entry from the SHIPPED NAV_ITEMS — the catalog is reachable without typing a URL", () => {
    renderRail({ navItems: NAV_ITEMS })
    expect(screen.getByRole("button", { name: "Experts" })).toBeInTheDocument()
  })

  it("navigates to the catalog when the Experts entry is clicked", () => {
    const onNavigate = vi.fn()
    renderRail({ navItems: NAV_ITEMS, onNavigate })
    fireEvent.click(screen.getByRole("button", { name: "Experts" }))
    expect(onNavigate).toHaveBeenCalledWith("experts")
  })

  it("keeps Spend OUTSIDE navItems, like the shield — navItems also feeds the mobile drawer", () => {
    // An entry in NAV_ITEMS would leak an operator surface to every member, because
    // ChatLayout's mobile drawer consumes the same array. Same contract as control-room.
    renderRail({ isOperator: true, navItems })
    expect(navItems.some((i) => i.view === "admin-spend")).toBe(false)
    expect(screen.getByRole("button", { name: /spend/i })).toBeInTheDocument()
  })
})

describe("NavPanel rail — ☰ expand/collapse toggle (refinement 2026-07-16)", () => {
  // The OLD content-masking collapse (w-64↔w-16, which hid New Chat + the thread list —
  // SEED-045) is gone. This new toggle only swaps icons⇄labels and NEVER hides content,
  // so the D-07 intent (New Chat always reachable) is preserved by construction.
  it("renders an 'Expand navigation' toggle when collapsed (the default)", () => {
    renderRail({ expanded: false })
    expect(screen.getByRole("button", { name: /expand navigation/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /collapse navigation/i })).toBeNull()
  })

  it("flips the toggle's accessible name to 'Collapse navigation' when expanded", () => {
    renderRail({ expanded: true })
    expect(screen.getByRole("button", { name: /collapse navigation/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /expand navigation/i })).toBeNull()
  })

  it("clicking the ☰ toggle delegates to onToggleExpanded (pinned — never hover)", () => {
    const { props } = renderRail({ expanded: false })
    fireEvent.click(screen.getByRole("button", { name: /expand navigation/i }))
    expect(props.onToggleExpanded).toHaveBeenCalledTimes(1)
  })

  it("renders nav labels as visible body text ONLY when expanded", () => {
    renderRail({ expanded: true })
    // Full-width rows show the label beside the icon — real text nodes, not just aria.
    expect(screen.getByText("Documents")).toBeInTheDocument()
    expect(screen.getByText("New chat")).toBeInTheDocument()
  })

  it("collapsed rail shows icons only — the label is the accessible name, not body text", () => {
    renderRail({ expanded: false })
    expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument() // reachable
    expect(screen.queryByText("New chat")).toBeNull() // but not a rendered text node
  })

  it("keeps New Chat reachable in BOTH rail states (the invariant the old collapse broke)", () => {
    for (const expanded of [false, true]) {
      const { unmount } = renderRail({ expanded })
      expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument()
      unmount()
    }
  })
})

describe("NavPanel rail — pure + stream-free (D-07)", () => {
  it("touches NO localStorage itself (parent owns rail-expand persistence)", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const { props } = renderRail()
    fireEvent.click(screen.getByRole("button", { name: /expand navigation/i }))
    // The rail is presentational: the toggle delegates to the parent callback and the
    // rail itself never reads/writes storage — neither the OLD masking key nor the new
    // parent-owned one leaks into this component.
    expect(props.onToggleExpanded).toHaveBeenCalled()
    const touchedKeys = [
      ...getItem.mock.calls.map((c) => c[0]),
      ...setItem.mock.calls.map((c) => c[0]),
    ]
    expect(touchedKeys).not.toContain("nav_panel_collapsed")
    expect(touchedKeys).not.toContain("nav_rail_expanded")
    getItem.mockRestore()
    setItem.mockRestore()
  })

  it("renders WITHOUT a StreamsProvider (the rail is stream-free post-refactor)", () => {
    // The render helper wraps only in TooltipProvider — if the rail still imported
    // useStreamingThreadIds/useStreamActions it would throw here.
    expect(() => renderRail()).not.toThrow()
  })
})
