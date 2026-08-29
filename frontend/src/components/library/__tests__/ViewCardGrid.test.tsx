/**
 * Phase 217.1 plan 07 (LIB-01 / D-217.1-07 / SC#5) — the Views tab card grid.
 *
 * ⭐ THE REDUCER CONTRACT (T-217.1-12a): the grid dispatches the SAME callbacks the
 * sidebar row dispatches — no second selection state. The existing 25-case
 * `librarySelection.test.ts` suite is the regression gate; this suite asserts the
 * grid calls `onSelectView` (never a local handler).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { SavedView } from "@/types"

// ── Mock resolveView so the lazy count cache has something to resolve. ──
const resolveView = vi.fn<() => Promise<{ total: number }>>()
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    resolveView: (id: string) => resolveView(id),
  }
})

import { ViewCardGrid } from "../ViewCardGrid"

const view = (over: Partial<SavedView> = {}): SavedView => ({
  id: "v-1",
  user_id: "u1",
  name: "Needs review",
  filter_expr: {
    op: "and",
    conditions: [{ field: "type", op: "eq", value: "contract" }],
  },
  is_system_global: false,
  ...over,
})

const views: SavedView[] = [
  view(),
  view({
    id: "v-2",
    name: "Recently added",
    filter_expr: {
      op: "and",
      conditions: [{ field: "added", op: "within_next", value: 7, unit: "days" }],
    },
  }),
  view({
    id: "v-3",
    name: "Contracts",
    is_system_global: true,
    filter_expr: {
      op: "and",
      conditions: [{ field: "type", op: "eq", value: "contract" }],
    },
  }),
]

const defaultProps = {
  views,
  selectedViewId: null as string | null,
  corpusCount: 224,
  onSelectView: vi.fn(),
  onEditView: vi.fn(),
  onRenameView: vi.fn(),
  onDelete: vi.fn(),
  onNewView: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  resolveView.mockImplementation((id: string) => {
    const map: Record<string, number> = { "v-1": 8, "v-2": 34, "v-3": 0 }
    return Promise.resolve({ total: map[id] ?? 0 })
  })
})

describe("ViewCardGrid — card composition (D-217.1-07)", () => {
  it("renders a 2-column card grid with one card per view", () => {
    render(<ViewCardGrid {...defaultProps} />)
    expect(screen.getByTestId("views-vgrid")).toBeInTheDocument()
    const cards = screen.getAllByTestId("view-card")
    expect(cards).toHaveLength(3)
    // 2-column grid on sm+.
    const grid = cards[0].parentElement
    expect(grid?.className).toContain("sm:grid-cols-2")
  })

  it("each card shows the name and the rule in plain words via viewRuleWords", async () => {
    render(<ViewCardGrid {...defaultProps} />)
    // "type is contract" from the extracted rule-words leaf (two cards share it).
    const rules = await screen.findAllByText("type is contract")
    expect(rules.length).toBeGreaterThanOrEqual(1)
  })

  it("shows N of M documents on the footer", async () => {
    render(<ViewCardGrid {...defaultProps} />)
    // v-1 resolves 8 of 224.
    expect(await screen.findByText("8 of 224 documents")).toBeInTheDocument()
  })

  it("a system-global view's footer renders 'Built in · shared with everyone'", async () => {
    render(<ViewCardGrid {...defaultProps} />)
    expect(await screen.findByText("Built in · shared with everyone")).toBeInTheDocument()
  })

  it("a view resolving 0 renders the amber zero-match card — 'Matches nothing right now'", async () => {
    render(<ViewCardGrid {...defaultProps} />)
    expect(await screen.findByText("Matches nothing right now")).toBeInTheDocument()
    // The zero-match card carries data-empty and the amber count 0.
    const zeroCard = screen.getAllByTestId("view-card").find((c) => c.getAttribute("data-empty") === "true")
    expect(zeroCard).toBeTruthy()
  })
})

describe("ViewCardGrid — the reducer contract (T-217.1-12a / SC#5)", () => {
  it("clicking a card invokes the SAME onSelectView the sidebar row dispatches", async () => {
    const user = userEvent.setup()
    const onSelectView = vi.fn()
    render(<ViewCardGrid {...defaultProps} onSelectView={onSelectView} />)
    await user.click(screen.getByText("Needs review"))
    expect(onSelectView).toHaveBeenCalledTimes(1)
    expect(onSelectView).toHaveBeenCalledWith(expect.objectContaining({ id: "v-1" }))
  })

  it("'New view' invokes the same filter-bar open flow (the callback), not a new modal", async () => {
    const user = userEvent.setup()
    const onNewView = vi.fn()
    render(<ViewCardGrid {...defaultProps} onNewView={onNewView} />)
    await user.click(screen.getByRole("button", { name: "New view" }))
    expect(onNewView).toHaveBeenCalledTimes(1)
  })
})

describe("ViewCardGrid — shared match-count cache", () => {
  it("resolves each view's count lazily and shares it (one resolve per view)", async () => {
    render(<ViewCardGrid {...defaultProps} />)
    await waitFor(() => expect(resolveView).toHaveBeenCalledWith("v-1"))
    expect(resolveView).toHaveBeenCalledWith("v-2")
    expect(resolveView).toHaveBeenCalledWith("v-3")
    // Exactly three resolves — no double-fetch per view.
    expect(resolveView).toHaveBeenCalledTimes(3)
  })
})
