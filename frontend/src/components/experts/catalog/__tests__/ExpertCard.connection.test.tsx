/**
 * Phase 267-03 (PACK-22 · D-267-06 / D-267-08 · UI-SPEC §5.4) — the catalog card tells the truth
 * about connections before anyone starts a chat.
 *
 * ⛔ EVERY WORD IS ASSERTED VISIBLE AT REST — `toBeVisible()` plus an ancestor walk for the hiding
 * utilities jsdom cannot see (the 266 UAT fix: a tooltip-only note passed four tests while nobody
 * could read it). A `title` attribute never counts as the visible copy.
 * ⛔ Content, not presence: test ids anchor the query; the assertions read the words.
 */
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import { ExpertCard } from "../ExpertCard"
import type { ExpertBundle } from "@/types"

const HIDING = new Set(["hidden", "sr-only", "invisible", "opacity-0"])

function assertVisibleAtRest(el: HTMLElement) {
  expect(el).toBeVisible()
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const hiding = (n.getAttribute("class") ?? "").split(/\s+/).filter((t) => HIDING.has(t))
    expect(hiding, `<${n.tagName.toLowerCase()} class="${n.getAttribute("class")}">`).toEqual([])
  }
}

function coach(over: Partial<ExpertBundle> = {}): ExpertBundle {
  return {
    id: "coach",
    name: "Sales Pipeline Coach",
    slug: "sales-pipeline-coach",
    description: "",
    scope_mode: "biased",
    member_skills: ["pipeline_scorer"],
    required_connections: ["hubspot", "notion"],
    knowledge_folder_ids: ["f1", "f2"],
    prompt_suggestions: [],
    visibility: "org",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}

const MISSING = [
  { slug: "hubspot", name: "HubSpot", connected: false },
  { slug: "notion", name: "Notion", connected: true },
]

function mount(expert: ExpertBundle, extra: { startBusy?: boolean; door?: boolean } = {}) {
  const onStartChat = vi.fn()
  const onInspect = vi.fn()
  const onOpenConnections = vi.fn()
  render(
    <ExpertCard
      expert={expert}
      onInspect={onInspect}
      onStartChat={onStartChat}
      onOpenConnections={extra.door === false ? undefined : onOpenConnections}
      startBusy={extra.startBusy}
    />,
  )
  return { onStartChat, onInspect, onOpenConnections }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ExpertCard · a missing connection (267-03)", () => {
  it("(1) admin: the Brings / Missing ledger replaces the envelope, the requires line is visible at rest, Connect replaces Start Chat", () => {
    const { onOpenConnections, onStartChat } = mount(
      coach({ connection_state: MISSING, can_connect: true }),
    )
    const ledger = screen.getByTestId("scope-ledger")
    for (const w of ["Brings", "2 folders", "pipeline_scorer", "Notion"]) {
      assertVisibleAtRest(within(within(ledger).getByTestId("scope-ledger-col-yes")).getByText(w))
    }
    for (const w of ["Missing", "HubSpot"]) {
      assertVisibleAtRest(within(within(ledger).getByTestId("scope-ledger-col-no")).getByText(w))
    }
    const line = screen.getByTestId("connection-gate-line")
    expect(line.textContent).toBe("Requires HubSpot — not connected")
    assertVisibleAtRest(line)

    const connect = screen.getByTestId("connection-gate-connect")
    expect(connect.textContent).toContain("Connect HubSpot →")
    assertVisibleAtRest(connect)
    expect(screen.queryByRole("button", { name: /start chat/i })).toBeNull()
    // No disabled button stands in for the control that cannot act.
    expect(screen.queryAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(0)

    fireEvent.click(connect)
    expect(onOpenConnections).toHaveBeenCalledTimes(1)
    expect(onStartChat).not.toHaveBeenCalled()
  })

  it("(2) member: the requires line AND the member pill are visible; no Connect, no Start Chat", () => {
    mount(coach({ connection_state: MISSING, can_connect: false }))
    assertVisibleAtRest(screen.getByTestId("connection-gate-line"))
    expect(screen.getByTestId("connection-gate-line").textContent).toBe(
      "Requires HubSpot — not connected",
    )
    const pill = screen.getByText("An org admin must connect HubSpot")
    assertVisibleAtRest(pill)
    expect(screen.queryByTestId("connection-gate-connect")).toBeNull()
    expect(screen.queryByRole("button", { name: /connect/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /start chat/i })).toBeNull()
    // Details is the one control left.
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Details"])
  })

  it("(3) two missing, admin: 'Open Connections →'; the line names both", () => {
    mount(
      coach({
        connection_state: [
          { slug: "hubspot", name: "HubSpot", connected: false },
          { slug: "salesforce", name: "Salesforce", connected: false },
        ],
        can_connect: true,
      }),
    )
    expect(screen.getByTestId("connection-gate-connect").textContent).toContain("Open Connections →")
    expect(screen.getByTestId("connection-gate-line").textContent).toBe(
      "Requires HubSpot and Salesforce — not connected",
    )
  })

  it("(4) can_connect but NO door wired → the member's words, never a Connect button that goes nowhere", () => {
    mount(coach({ connection_state: MISSING, can_connect: true }), { door: false })
    expect(screen.queryByTestId("connection-gate-connect")).toBeNull()
    assertVisibleAtRest(screen.getByText("An org admin must connect HubSpot"))
  })
})

describe("ExpertCard · every connection connected — base behaviour kept (267-03)", () => {
  it("(5) CHARACTERIZATION: Start Chat present, the envelope pills unchanged, no ledger, no requires line", () => {
    const { onStartChat } = mount(
      coach({
        connection_state: [
          { slug: "hubspot", name: "HubSpot", connected: true },
          { slug: "notion", name: "Notion", connected: true },
        ],
        can_connect: true,
      }),
    )
    const start = screen.getByRole("button", { name: /start chat/i })
    // The envelope still lists the folder count, the skill and each required connection.
    for (const w of ["2 folders", "pipeline_scorer", "hubspot", "notion"]) {
      expect(screen.getByText(w)).toBeTruthy()
    }
    expect(screen.queryByTestId("scope-ledger")).toBeNull()
    expect(screen.queryByTestId("connection-gate-line")).toBeNull()
    fireEvent.click(start)
    expect(onStartChat).toHaveBeenCalledTimes(1)
  })
})

describe("ExpertCard · Start Chat in flight (SEED-309 R265-262-04)", () => {
  it("(6) startBusy → 'Starting…', disabled, aria-busy; a click is a no-op", () => {
    const { onStartChat } = mount(coach({ required_connections: [] }), { startBusy: true })
    const btn = screen.getByRole("button", { name: /starting/i }) as HTMLButtonElement
    expect(btn.textContent).toContain("Starting…")
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute("aria-busy")).toBe("true")
    fireEvent.click(btn)
    expect(onStartChat).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /^start chat$/i })).toBeNull()
  })
})
