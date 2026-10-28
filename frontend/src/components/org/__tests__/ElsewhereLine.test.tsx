/**
 * Phase 298-05 (ORG-06 / D-17 / UI-D4..UI-D7) — "N more … in <Org> · Switch".
 *
 * Asserted by the RENDERED WORDS, because the words are the deliverable: every non-answer
 * (loading, solo, no org, a failed read, every count 0) renders NOTHING, and no state ever
 * shows "0 more". Switch is a real button named "Switch to <Org>"; it moves focus to the
 * line's wrapper first, then calls OrgProvider.switchOrg.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

const org = vi.hoisted(() => ({
  value: null as null | {
    activeOrgId: string | null
    orgs: { org_id: string; name: string; role: string }[]
    switchOrg: (id: string) => void
  },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value }))

const header = vi.hoisted(() => ({ org: "A" as string | null }))
vi.mock("@/lib/api/_core", () => ({
  API_BASE: "http://api.test",
  ApiError: class ApiError extends Error {},
  getAuthHeaders: async () => ({}),
  getActiveOrgId: () => header.org,
}))

const client = vi.hoisted(() => ({ getElsewhereCounts: vi.fn() }))
vi.mock("@/lib/api/orgItems", () => ({
  getElsewhereCounts: client.getElsewhereCounts,
  getMovePreview: vi.fn(),
  moveOrgItem: vi.fn(),
}))

import { ElsewhereLine } from "../ElsewhereLine"
import { resetElsewhereCounts } from "@/lib/elsewhereCounts"

const TWO_ORGS = [
  { org_id: "A", name: "Personal", role: "owner" },
  { org_id: "B", name: "Acme Legal", role: "member" },
]

function row(over: Record<string, unknown> = {}) {
  return { org_id: "B", org_name: "Acme Legal", folders: 0, root_documents: 0, workflows: 0, threads: 0, runs: 0, ...over }
}

const switchOrg = vi.fn()

beforeEach(() => {
  header.org = "A"
  client.getElsewhereCounts.mockReset()
  switchOrg.mockReset()
  org.value = { activeOrgId: "A", orgs: TWO_ORGS, switchOrg }
})
afterEach(() => resetElsewhereCounts())

async function settle() {
  await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalled())
  await act(async () => {})
}

describe("ElsewhereLine — absent for every non-answer (UI-D6)", () => {
  it("while loading: nothing, no placeholder, never 0", async () => {
    client.getElsewhereCounts.mockReturnValue(new Promise(() => {}))
    render(<ElsewhereLine kind="library" />)
    await waitFor(() => expect(client.getElsewhereCounts).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId("elsewhere-library")).toBeEmptyDOMElement()
    expect(screen.queryByText(/\b0 more/)).toBeNull()
  })

  it("for a solo user: nothing, and nothing is asked", async () => {
    org.value = { activeOrgId: "A", orgs: [TWO_ORGS[0]], switchOrg }
    client.getElsewhereCounts.mockResolvedValue([row({ folders: 3 })])
    render(<ElsewhereLine kind="library" />)
    await act(async () => {})
    expect(client.getElsewhereCounts).not.toHaveBeenCalled()
    expect(screen.getByTestId("elsewhere-library")).toBeEmptyDOMElement()
  })

  it("outside an OrgProvider, or with no active org: nothing", async () => {
    org.value = null
    const { unmount } = render(<ElsewhereLine kind="workflows" />)
    expect(screen.getByTestId("elsewhere-workflows")).toBeEmptyDOMElement()
    unmount()
    org.value = { activeOrgId: null, orgs: TWO_ORGS, switchOrg }
    render(<ElsewhereLine kind="workflows" />)
    await act(async () => {})
    expect(client.getElsewhereCounts).not.toHaveBeenCalled()
    expect(screen.getByTestId("elsewhere-workflows")).toBeEmptyDOMElement()
  })

  it("when the route answers [] (no org resolved): nothing", async () => {
    client.getElsewhereCounts.mockResolvedValue([])
    render(<ElsewhereLine kind="threads" />)
    await settle()
    expect(screen.getByTestId("elsewhere-threads")).toBeEmptyDOMElement()
  })

  it("when this kind's count is 0 in every org: nothing (never '0 more')", async () => {
    client.getElsewhereCounts.mockResolvedValue([row({ workflows: 4 })])
    render(<ElsewhereLine kind="runs" />)
    await settle()
    expect(screen.getByTestId("elsewhere-runs")).toBeEmptyDOMElement()
    expect(screen.queryByText(/\b0 more/)).toBeNull()
  })

  it("on a failed read: nothing on screen, a console warning only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    client.getElsewhereCounts.mockRejectedValue(new Error("offline"))
    render(<ElsewhereLine kind="library" />)
    await settle()
    expect(screen.getByTestId("elsewhere-library")).toBeEmptyDOMElement()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("ElsewhereLine — the words (UI-D5, exact plurals)", () => {
  it.each([
    ["library", { folders: 2, root_documents: 5 }, "2 more folders and 5 more Root documents in Acme Legal · Switch"],
    ["library", { folders: 1 }, "1 more folder in Acme Legal · Switch"],
    ["library", { root_documents: 1 }, "1 more Root document in Acme Legal · Switch"],
    ["workflows", { workflows: 3 }, "3 more workflows in Acme Legal · Switch"],
    ["workflows", { workflows: 1 }, "1 more workflow in Acme Legal · Switch"],
    ["threads", { threads: 1 }, "1 more chat in Acme Legal · Switch"],
    ["threads", { threads: 12 }, "12 more chats in Acme Legal · Switch"],
    ["runs", { runs: 4 }, "4 more runs in Acme Legal · Switch"],
    ["runs", { runs: 1 }, "1 more run in Acme Legal · Switch"],
  ] as const)("%s %j reads %s", async (kind, over, words) => {
    client.getElsewhereCounts.mockResolvedValue([row(over)])
    render(<ElsewhereLine kind={kind} />)
    await settle()
    expect(screen.getByTestId(`elsewhere-${kind}`)).toHaveTextContent(words)
    expect(screen.queryByText(/\b0 more/)).toBeNull()
  })

  it("one line per org with a count above 0, in the server's order", async () => {
    client.getElsewhereCounts.mockResolvedValue([
      row({ org_id: "B", org_name: "Acme Legal", threads: 2 }),
      row({ org_id: "C", org_name: "Beta Co", threads: 0 }),
      row({ org_id: "D", org_name: "Zeta Group", threads: 1 }),
    ])
    org.value = {
      activeOrgId: "A",
      orgs: [...TWO_ORGS, { org_id: "C", name: "Beta Co", role: "member" }, { org_id: "D", name: "Zeta Group", role: "member" }],
      switchOrg,
    }
    render(<ElsewhereLine kind="threads" />)
    await settle()
    const lines = screen.getAllByTestId("elsewhere-row")
    expect(lines.map((l) => l.textContent)).toEqual([
      "2 more chats in Acme Legal · Switch",
      "1 more chat in Zeta Group · Switch",
    ])
  })

  it("never lists the ACTIVE org even if the server echoed it", async () => {
    client.getElsewhereCounts.mockResolvedValue([row({ org_id: "A", org_name: "Personal", threads: 5 })])
    render(<ElsewhereLine kind="threads" />)
    await settle()
    expect(screen.getByTestId("elsewhere-threads")).toBeEmptyDOMElement()
  })

  it("a long org name truncates visually but stays whole in the DOM text and the button name", async () => {
    const long = "The Very Long Organization Name Incorporated"
    client.getElsewhereCounts.mockResolvedValue([row({ org_name: long, workflows: 2 })])
    render(<ElsewhereLine kind="workflows" />)
    await settle()
    const name = screen.getByText(long)
    expect(name.className).toContain("truncate")
    expect(name.className).toContain("max-w-[12rem]")
    expect(screen.getByRole("button", { name: `Switch to ${long}` })).toBeInTheDocument()
    expect(name.getAttribute("title")).toBeNull()
  })
})

describe("ElsewhereLine — Switch (UI-D7)", () => {
  it("is a real button, primary and semibold, kept on one line with its separator", async () => {
    client.getElsewhereCounts.mockResolvedValue([row({ workflows: 3 })])
    render(<ElsewhereLine kind="workflows" />)
    await settle()
    const button = screen.getByRole("button", { name: "Switch to Acme Legal" })
    expect(button).toHaveAttribute("type", "button")
    expect(button).toHaveTextContent("Switch")
    expect(button.className).toContain("text-primary")
    expect(button.className).toContain("font-semibold")
    expect(button.className).toContain("min-h-6")
    expect(button.parentElement?.className).toContain("whitespace-nowrap")
    expect(screen.getByTestId("elsewhere-row").className).toContain("text-[12px]")
    expect(screen.getByTestId("elsewhere-row").className).toContain("text-muted-foreground")
  })

  it("moves focus to the line's wrapper FIRST, then calls switchOrg with that org", async () => {
    client.getElsewhereCounts.mockResolvedValue([row({ workflows: 3 })])
    let focusedAtSwitch: Element | null = null
    switchOrg.mockImplementation(() => {
      focusedAtSwitch = document.activeElement
    })
    render(<ElsewhereLine kind="workflows" />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "Switch to Acme Legal" }))
    const wrapper = screen.getByTestId("elsewhere-workflows")
    expect(switchOrg).toHaveBeenCalledWith("B")
    expect(focusedAtSwitch).toBe(wrapper)
    expect(wrapper).toHaveAttribute("tabindex", "-1")
    expect(wrapper).toHaveAttribute("aria-live", "polite")
  })

  it("the wrapper stays mounted (empty) so an updated count is announced", async () => {
    client.getElsewhereCounts.mockResolvedValue([])
    render(<ElsewhereLine kind="library" className="px-2 mb-2" />)
    await settle()
    const wrapper = screen.getByTestId("elsewhere-library")
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveAttribute("aria-live", "polite")
    // The list's gutter only applies when there is a line (an empty wrapper takes no space).
    expect(wrapper.className).not.toContain("mb-2")
  })
})
