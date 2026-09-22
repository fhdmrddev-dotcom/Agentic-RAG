/** Phase 217.1 (Plan 17) — CheckedQueriesSection tests. */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CheckedQueriesSection, verdictFor, rankChangeSentence } from "../CheckedQueriesSection"
import type { CheckedQueryRow } from "@/lib/api"

const mockList = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockTrigger = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({
  listCheckedQueries: mockList,
  createCheckedQuery: mockCreate,
  triggerCheck: mockTrigger,
  triggerCheckAll: vi.fn(),
  deleteCheckedQuery: mockDelete,
}))

function makeRow(overrides: Partial<CheckedQueryRow> = {}): CheckedQueryRow {
  return {
    id: "cq-1",
    user_id: "user-1",
    question: "What is the retention policy?",
    expected_document_id: "doc-abc",
    last_rank: 2,
    previous_rank: 6,
    checked_at: "2026-08-30T00:00:00Z",
    created_at: "2026-08-29T00:00:00Z",
    updated_at: "2026-08-30T00:00:00Z",
    org_id: "org-1",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("verdictFor / rankChangeSentence", () => {
  it("Not checked yet when checked_at is null", () => {
    expect(verdictFor(makeRow({ checked_at: null, last_rank: null, previous_rank: null }))).toBe(
      "Not checked yet",
    )
    expect(rankChangeSentence(makeRow({ checked_at: null }))).toBeNull()
  })

  it("Slipped when last_rank > previous_rank", () => {
    expect(verdictFor(makeRow({ last_rank: 6, previous_rank: 2 }))).toBe("Slipped")
    expect(rankChangeSentence(makeRow({ last_rank: 6, previous_rank: 2 }))).toBe("was 2, now 6")
  })

  it("Holding when rank improved or held", () => {
    expect(verdictFor(makeRow({ last_rank: 2, previous_rank: 6 }))).toBe("Holding")
    expect(verdictFor(makeRow({ last_rank: 3, previous_rank: 3 }))).toBe("Holding")
    // First check ever (no previous_rank) → Holding, with an honest sentence.
    expect(verdictFor(makeRow({ previous_rank: null }))).toBe("Holding")
    expect(rankChangeSentence(makeRow({ previous_rank: null }))).toBe("ranked 2")
  })

  it("distinct Not found verdict when checked but not ranked (never folded into Slipped)", () => {
    const row = makeRow({ checked_at: "2026-08-30T00:00:00Z", last_rank: null })
    expect(verdictFor(row)).toBe("Not found")
    expect(verdictFor(row)).not.toBe("Slipped")
    expect(rankChangeSentence(row)).toBe("not ranked")
  })
})

describe("CheckedQueriesSection", () => {
  it("renders the table with Question · Should find · Rank · Verdict columns", async () => {
    mockList.mockResolvedValue([makeRow()])
    render(<CheckedQueriesSection />)
    expect(await screen.findByText("Question")).toBeTruthy()
    expect(screen.getByText("Should find")).toBeTruthy()
    expect(screen.getByText("Rank")).toBeTruthy()
    expect(screen.getByText("Verdict")).toBeTruthy()
  })

  it("renders the live count to the parent tile", async () => {
    mockList.mockResolvedValue([makeRow(), makeRow()])
    const onTotal = vi.fn()
    render(<CheckedQueriesSection onTotalChange={onTotal} />)
    await waitFor(() => expect(onTotal).toHaveBeenCalledWith(2))
  })

  it("renders a Slipped row with the was→now sentence", async () => {
    mockList.mockResolvedValue([makeRow({ last_rank: 6, previous_rank: 2 })])
    render(<CheckedQueriesSection />)
    expect(await screen.findByText("Slipped")).toBeTruthy()
    expect(screen.getByText("was 2, now 6")).toBeTruthy()
  })

  it("renders Not checked yet for a fresh row", async () => {
    mockList.mockResolvedValue([makeRow({ checked_at: null, last_rank: null, previous_rank: null })])
    render(<CheckedQueriesSection />)
    expect(await screen.findByText("Not checked yet")).toBeTruthy()
  })

  it("renders the distinct Not found verdict, not Slipped", async () => {
    mockList.mockResolvedValue([makeRow({ checked_at: "2026-08-30T00:00:00Z", last_rank: null })])
    render(<CheckedQueriesSection />)
    expect(await screen.findByText("Not found")).toBeTruthy()
    expect(screen.queryByText("Slipped")).toBeNull()
  })

  it("Add a check opens the form and submit calls create then trigger", async () => {
    const created = makeRow({ id: "cq-new", question: "new question" })
    mockCreate.mockResolvedValue(created)
    mockTrigger.mockResolvedValue(created)
    // Initial load: empty. After create+trigger reload: the new row.
    mockList.mockResolvedValueOnce([]).mockResolvedValue([created])

    render(<CheckedQueriesSection />)
    // Await the resolved empty list before interacting.
    await screen.findByText(/No checked queries yet/)
    fireEvent.click(screen.getByText("Add a check"))
    fireEvent.change(screen.getByPlaceholderText("e.g. What is the retention policy?"), {
      target: { value: "new question" },
    })
    fireEvent.change(screen.getByPlaceholderText("Paste the document id that should rank"), {
      target: { value: "doc-new" },
    })
    fireEvent.click(screen.getByText("Add and check"))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      question: "new question",
      expected_document_id: "doc-new",
    }))
    await waitFor(() => expect(mockTrigger).toHaveBeenCalledWith("cq-new"))
    // Reconcile-by-fetch: the new row appears in the table.
    await screen.findByText("new question")
  })

  it("Re-check and Delete call their routes then reload", async () => {
    const row = makeRow()
    // Initial load: row. After re-check reload: still the row. After delete reload: empty.
    mockList.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]).mockResolvedValue([])
    mockTrigger.mockResolvedValue(row)
    mockDelete.mockResolvedValue(undefined)

    render(<CheckedQueriesSection />)
    await screen.findByText("Re-check")
    fireEvent.click(screen.getByText("Re-check"))
    await waitFor(() => expect(mockTrigger).toHaveBeenCalledWith("cq-1"))

    fireEvent.click(screen.getByText("Delete"))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("cq-1"))
    // After delete + reload, the row is gone.
    await waitFor(() => expect(screen.queryByText("What is the retention policy?")).toBeNull())
  })
})
// ── BUG-260923-02 — checked queries page past 25 ─────────────────────────────────────────
describe("CheckedQueriesSection — paged (BUG-260923-02)", () => {
  it("shows 25 at a time and pages forward", async () => {
    mockList.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) =>
        makeRow({ id: `cq-${i}`, question: `Question number ${String(i).padStart(2, "0")}?` }),
      ),
    )
    render(<CheckedQueriesSection />)
    expect(await screen.findByText("Showing 1–25 of 30")).toBeInTheDocument()
    expect(screen.queryByText("Question number 25?")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(await screen.findByText("Showing 26–30 of 30")).toBeInTheDocument()
    expect(screen.getByText("Question number 25?")).toBeInTheDocument()
  })
})
