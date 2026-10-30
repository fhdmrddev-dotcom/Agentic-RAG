/**
 * Phase 301-03 (NOTE-01 / NOTE-05 · D-01, D-02, D-05..D-10, D-17, D-28, D-29; UI-SPEC S1, S2, S3) —
 * the "Waiting on you" control and the list it opens.
 *
 * Words-first: every case asserts what the person reads (the count sentence, the row's words, the
 * state lines), not merely that a testid exists — presence assertions cannot see content drift.
 *
 * ⛔ Rows are DropdownMenuItems (role `menuitem`), because Radix Menu cancels Tab inside its content
 *   (UI-D1): a plain button in the list would be unreachable from the keyboard, so every keyboard
 *   case here uses arrow keys + Enter, never Tab.
 * ⛔ Selecting a row calls the condition's onOpen and nothing else — a switchOrg spy proves the
 *   list never changes the active org behind the person's back (D-08, T-301-19).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// The control imports the registry's helpers; the registry's module graph reaches these readers.
// No case calls them — the factories exist so importing never touches a network.
vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: vi.fn().mockResolvedValue({ stopped: [], reader_running: true, poll_interval_seconds: 60 }),
  listSyncRuns: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/api/notifications", () => ({
  getWaitingNotices: vi.fn().mockResolvedValue({ notices: [], total: 0 }),
}))

const { switchOrg } = vi.hoisted(() => ({ switchOrg: vi.fn() }))
vi.mock("@/providers/OrgProvider", () => {
  const value = {
    activeOrgId: "org-a",
    orgs: [
      { org_id: "org-a", name: "Acme Legal" },
      { org_id: "org-b", name: "Beta Partners" },
    ],
    switchOrg,
    canManage: false,
  }
  return { useOrg: () => value, useOrgOptional: () => value }
})

import { WaitingOnYouControl } from "../WaitingOnYouControl"
import { WaitingOnYouList } from "../WaitingOnYouList"
import type { WaitingCondition, WaitingStatus } from "../attentionConditions"

const MIN = 60_000

function row(i: number, overrides: Partial<WaitingCondition> = {}): WaitingCondition {
  return {
    mark: "waiting",
    id: `notice-${i}`,
    title: `Compliance Gap Report ${i}`,
    detail: "",
    onOpen: vi.fn(),
    runId: `run-0000000${i}-uuid`,
    orgId: "org-a",
    orgName: "Acme Legal",
    since: new Date(Date.now() - (20 - i) * MIN).toISOString(),
    kind: "question",
    origin: "app",
    total: 2,
    ...overrides,
  }
}

type ControlProps = React.ComponentProps<typeof WaitingOnYouControl>

function renderControl(overrides: Partial<ControlProps> = {}) {
  const props: ControlProps = {
    variant: "rail",
    expanded: false,
    conditions: [],
    status: "answered",
    ...overrides,
  }
  const utils = render(
    <TooltipProvider>
      <WaitingOnYouControl {...props} />
    </TooltipProvider>,
  )
  const rerenderWith = (next: Partial<ControlProps>) =>
    utils.rerender(
      <TooltipProvider>
        <WaitingOnYouControl {...props} {...next} />
      </TooltipProvider>,
    )
  return { ...utils, props, rerenderWith }
}

async function openRail(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("rail-waiting-trigger"))
  return screen.findByTestId("waiting-popover")
}

afterEach(() => {
  cleanup()
  switchOrg.mockClear()
  vi.useRealTimers()
})

// ══ S1 — the rail control, its name and its pill ════════════════════════════════════════
describe("WaitingOnYouControl — the rail control (D-01, D-02)", () => {
  it("names the control by the count sentence and shows the server TOTAL on the pill", () => {
    renderControl({ conditions: [row(1, { total: 7 }), row(2, { total: 7 })] })
    const trigger = screen.getByRole("button", { name: "7 workflow runs are waiting on you" })
    expect(trigger).toHaveAttribute("data-testid", "rail-waiting-trigger")
    const pill = screen.getByTestId("rail-waiting-badge")
    expect(pill).toHaveTextContent(/^7$/)
    expect(pill).toHaveAttribute("aria-hidden", "true")
    expect(trigger).not.toHaveAttribute("title")
  })

  it("answered with nothing waiting → named 'Waiting on you', no pill (never a 0)", () => {
    renderControl({ conditions: [], status: "answered" })
    expect(screen.getByRole("button", { name: "Waiting on you" })).toBeInTheDocument()
    expect(screen.queryByTestId("rail-waiting-badge")).toBeNull()
  })

  it("loading → no pill", () => {
    renderControl({ conditions: [], status: "loading" })
    expect(screen.getByRole("button", { name: "Waiting on you" })).toBeInTheDocument()
    expect(screen.queryByTestId("rail-waiting-badge")).toBeNull()
  })

  it("stale with rows → the pill keeps the last total", () => {
    renderControl({ conditions: [row(1, { total: 3 })], status: "stale" })
    expect(screen.getByTestId("rail-waiting-badge")).toHaveTextContent(/^3$/)
    expect(screen.getByRole("button", { name: "3 workflow runs are waiting on you" })).toBeInTheDocument()
  })

  it("above 99 the pill reads 99+ and the name still carries the exact number", () => {
    renderControl({ conditions: [row(1, { total: 120 })] })
    expect(screen.getByTestId("rail-waiting-badge")).toHaveTextContent(/^99\+$/)
    expect(screen.getByRole("button", { name: "120 workflow runs are waiting on you" })).toBeInTheDocument()
  })

  it("expanded shows the visible label, and the control is never aria-current", () => {
    renderControl({ expanded: true, conditions: [row(1, { total: 1 })] })
    const trigger = screen.getByRole("button", { name: "1 workflow run is waiting on you" })
    expect(within(trigger).getByText("Waiting on you")).toBeInTheDocument()
    expect(trigger).not.toHaveAttribute("aria-current")
  })

  it("with no status given, rows mean answered and none means loading", () => {
    const { rerenderWith } = renderControl({ status: undefined, conditions: [row(1)] })
    expect(screen.getByTestId("rail-waiting-badge")).toHaveTextContent(/^2$/)
    rerenderWith({ status: undefined, conditions: [] })
    expect(screen.queryByTestId("rail-waiting-badge")).toBeNull()
  })
})

// ══ S2 — the list ═══════════════════════════════════════════════════════════════════════
describe("WaitingOnYouList — the rows (D-05, D-06, D-07, D-28)", () => {
  it("opens with the header and one menu item per row, in the order given (oldest first)", async () => {
    const user = userEvent.setup()
    const a = row(1, { title: "Oldest workflow" })
    const b = row(2, { title: "Newer workflow", kind: "approval" })
    renderControl({ conditions: [a, b] })
    const pop = await openRail(user)
    expect(within(pop).getByText("Waiting on you")).toBeInTheDocument()
    const items = within(pop).getAllByRole("menuitem")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("Oldest workflow")
    expect(items[1]).toHaveTextContent("Newer workflow")
    expect(items[0]).toHaveAttribute("data-testid", "waiting-row")
  })

  it("each row names the workflow, the org (the ACTIVE org too), what it needs and how long it waited", async () => {
    const user = userEvent.setup()
    renderControl({
      conditions: [
        row(1, { title: "Doc Q&A", orgName: "Acme Legal", kind: "question", since: new Date(Date.now() - 14 * MIN).toISOString() }),
        row(2, { title: "Gap Report", orgId: "org-b", orgName: "Beta Partners", kind: "approval" }),
      ],
    })
    const pop = await openRail(user)
    const [first, second] = within(pop).getAllByRole("menuitem")
    expect(first).toHaveTextContent("Doc Q&A")
    expect(first).toHaveTextContent("Acme Legal") // active org still named (D-06)
    expect(first).toHaveTextContent("needs your answer")
    expect(first).toHaveTextContent("waiting 14 min")
    expect(second).toHaveTextContent("Beta Partners")
    expect(second).toHaveTextContent("needs your approval")
    expect(within(first).getByTestId("org-avatar")).toHaveTextContent("A")
  })

  it("names a scheduled run and a key-started run, and says nothing for an app start", async () => {
    const user = userEvent.setup()
    renderControl({
      conditions: [
        row(1, { kind: "approval", origin: "schedule" }),
        row(2, { kind: "approval", origin: "key" }),
        row(3, { origin: "app", total: 3 }),
      ],
    })
    const pop = await openRail(user)
    const [s, k, app] = within(pop).getAllByRole("menuitem")
    expect(s).toHaveTextContent("scheduled")
    expect(k).toHaveTextContent("started by an API key")
    expect(app).not.toHaveTextContent(/scheduled|API key/)
  })

  it("blank names fall back to 'Untitled workflow' and 'Unnamed org' with initial ?", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [row(1, { title: "  ", orgName: "" })] })
    const pop = await openRail(user)
    const item = within(pop).getByRole("menuitem")
    expect(item).toHaveTextContent("Untitled workflow")
    expect(item).toHaveTextContent("Unnamed org")
    expect(within(item).getByTestId("org-avatar")).toHaveTextContent("?")
  })
})

describe("WaitingOnYouList — selecting opens the run and never switches org (D-08, D-29)", () => {
  it("keyboard: ArrowDown opens on the first row, Enter calls the first row's onOpen once", async () => {
    const user = userEvent.setup()
    const a = row(1)
    const b = row(2)
    renderControl({ conditions: [a, b] })
    screen.getByTestId("rail-waiting-trigger").focus()
    // ArrowDown on the trigger opens the list with focus on the FIRST row (Radix), then Enter.
    await user.keyboard("{ArrowDown}")
    await screen.findByTestId("waiting-popover")
    expect(screen.getAllByRole("menuitem")[0]).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(a.onOpen).toHaveBeenCalledTimes(1)
    expect(a.onOpen).toHaveBeenCalledWith()
    expect(b.onOpen).not.toHaveBeenCalled()
    expect(switchOrg).not.toHaveBeenCalled()
  })

  it("click: calls that row's onOpen, closes the list, calls onAfterSelect — never switchOrg", async () => {
    const user = userEvent.setup()
    const onAfterSelect = vi.fn()
    const other = row(2, { orgId: "org-b", orgName: "Beta Partners" })
    renderControl({ conditions: [row(1), other], onAfterSelect })
    const pop = await openRail(user)
    await user.click(within(pop).getAllByRole("menuitem")[1])
    expect(other.onOpen).toHaveBeenCalledTimes(1)
    expect(onAfterSelect).toHaveBeenCalledTimes(1)
    expect(switchOrg).not.toHaveBeenCalled()
    expect(screen.queryByTestId("waiting-popover")).toBeNull()
  })
})

describe("WaitingOnYouList — states (D-17, UI-D7)", () => {
  it("answered and empty → 'Nothing is waiting on you.'", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [], status: "answered" })
    await openRail(user)
    expect(screen.getByTestId("waiting-empty")).toHaveTextContent("Nothing is waiting on you.")
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0)
  })

  it("loading → 'Checking what's waiting on you…'", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [], status: "loading" })
    const pop = await openRail(user)
    expect(within(pop).getByText("Checking what's waiting on you…")).toBeInTheDocument()
    expect(screen.queryByTestId("waiting-empty")).toBeNull()
  })

  it("failed, never answered → 'Couldn't check right now. Trying again shortly.'", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [], status: "failed" })
    const pop = await openRail(user)
    expect(within(pop).getByText("Couldn't check right now. Trying again shortly.")).toBeInTheDocument()
    expect(screen.queryByTestId("waiting-empty")).toBeNull()
  })

  it("stale → the last rows stay, followed by the stale line", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [row(1), row(2)], status: "stale" })
    const pop = await openRail(user)
    expect(within(pop).getAllByRole("menuitem")).toHaveLength(2)
    expect(screen.getByTestId("waiting-stale")).toHaveTextContent(
      "Couldn't refresh just now. This is the last list we got.",
    )
  })

  it("total above the rows → 'and N more' after the last row, plain text, not focusable", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [row(1, { total: 52 }), row(2, { total: 52 })] })
    const pop = await openRail(user)
    const more = screen.getByTestId("waiting-more")
    expect(more).toHaveTextContent(/^and 50 more$/)
    expect(more).not.toHaveAttribute("role", "menuitem")
    expect(more).not.toHaveAttribute("tabindex")
    const items = within(pop).getAllByRole("menuitem")
    expect(items[items.length - 1].compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("no 'and N more' when the server returned every row", async () => {
    const user = userEvent.setup()
    renderControl({ conditions: [row(1), row(2)] })
    await openRail(user)
    expect(screen.queryByTestId("waiting-more")).toBeNull()
  })

  it("a live refetch to zero replaces the rows in place and the list stays open (UI-D12)", async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderControl({ conditions: [row(1), row(2)] })
    await openRail(user)
    rerenderWith({ conditions: [], status: "answered" })
    expect(screen.getByTestId("waiting-popover")).toBeInTheDocument()
    expect(screen.getByTestId("waiting-empty")).toHaveTextContent("Nothing is waiting on you.")
  })
})

describe("WaitingOnYouList — the minute tick (UI-D14)", () => {
  it("'waiting 3 min' becomes 'waiting 4 min' after a minute while open, without a refetch", () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse("2026-10-30T12:00:00.000Z"))
    const since = new Date(Date.now() - 3 * MIN).toISOString()
    const condition = row(1, { since, total: 1 })
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>t</DropdownMenuTrigger>
        <WaitingOnYouList conditions={[condition]} total={1} status="answered" side="right" align="start" sideOffset={8} />
      </DropdownMenu>,
    )
    expect(screen.getByRole("menuitem")).toHaveTextContent("waiting 3 min")
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole("menuitem")).toHaveTextContent("waiting 4 min")
  })
})

describe("WaitingOnYouList — what is NOT there (D-09, T-301-20, T-301-23)", () => {
  it("has no dismiss, mark-read, snooze or clear control, and shows no raw wire value", async () => {
    const user = userEvent.setup()
    const conditions = [row(1, { kind: "question" }), row(2, { kind: "approval", origin: "schedule" })]
    renderControl({ conditions })
    const pop = await openRail(user)
    for (const name of [/dismiss/i, /mark as read/i, /mark read/i, /snooze/i, /clear/i]) {
      expect(within(pop).queryByRole("menuitem", { name })).toBeNull()
      expect(within(pop).queryByRole("button", { name })).toBeNull()
    }
    expect(within(pop).queryByText(/^\s*(question|approval|schedule|app|key)\s*$/)).toBeNull()
    const text = pop.textContent ?? ""
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/)
    for (const c of conditions) {
      expect(text).not.toContain(c.runId)
      expect(text).not.toContain(c.id)
      expect(text).not.toContain(c.since)
    }
  })
})

// ══ S3 — the drawer variant ═════════════════════════════════════════════════════════════
describe("WaitingOnYouControl — the drawer row (D-03, UI-D10)", () => {
  it("is named by the same sentence, shows an INLINE pill and the amber wash, and opens the same list", async () => {
    const user = userEvent.setup()
    const onAfterSelect = vi.fn()
    const a = row(1, { total: 3 })
    renderControl({ variant: "drawer", conditions: [a, row(2, { total: 3 })], onAfterSelect })
    const trigger = screen.getByRole("button", { name: "3 workflow runs are waiting on you" })
    expect(trigger).toHaveAttribute("data-testid", "drawer-waiting-row")
    expect(within(trigger).getByText("Waiting on you")).toBeInTheDocument()
    expect(trigger.className).toContain("bg-warning/10")
    const pill = within(trigger).getByText("3")
    expect(pill).toHaveAttribute("aria-hidden", "true")
    expect(pill.className).toContain("ml-auto")
    expect(pill.className).not.toContain("absolute")

    await user.click(trigger)
    const pop = await screen.findByTestId("waiting-popover")
    expect(within(pop).getAllByRole("menuitem")).toHaveLength(2)
    await user.click(within(pop).getAllByRole("menuitem")[0])
    expect(a.onOpen).toHaveBeenCalledTimes(1)
    expect(onAfterSelect).toHaveBeenCalledTimes(1)
    expect(switchOrg).not.toHaveBeenCalled()
  })

  it("at zero: no wash, no pill, still present, opens the empty line", async () => {
    const user = userEvent.setup()
    renderControl({ variant: "drawer", conditions: [], status: "answered" as WaitingStatus })
    const trigger = screen.getByRole("button", { name: "Waiting on you" })
    expect(trigger.className).not.toContain("bg-warning/10")
    await user.click(trigger)
    expect(await screen.findByTestId("waiting-empty")).toHaveTextContent("Nothing is waiting on you.")
  })
})
