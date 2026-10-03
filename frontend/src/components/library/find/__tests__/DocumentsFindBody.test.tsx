/**
 * Phase 271-04 (D-01 / D-02 / D-03 / D-06 / S7) — the Find search row and the Find results
 * surface, state by state.
 *
 * The two failures ROADMAP names for this surface are asserted directly: an error never swaps
 * the list (the previous rows stay, with an alert over them), and the client never re-sorts or
 * re-slices what the server returned (the DOM order IS the response order).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { Document } from "@/types"
import type { DocumentSearchRow } from "@/types"

// DocumentList is mocked so the props Find passes it are observable; it renders the rows it is
// given, in the order given.
const listProps = vi.fn()
vi.mock("@/components/ingestion/DocumentList", () => ({
  DocumentList: (props: { documents: Document[] }) => {
    listProps(props)
    return (
      <ul data-testid="find-doclist">
        {props.documents.map((d) => (
          <li key={d.id}>{d.filename}</li>
        ))}
      </ul>
    )
  },
}))

import { DocumentsFindResults, FindSearchRow } from "@/components/library/find/DocumentsFindBody"
import { DocumentSearchError } from "@/lib/api/documents"

function row(id: string, filename: string): DocumentSearchRow {
  return {
    id,
    user_id: "u1",
    folder_id: null,
    filename,
    file_path: "p",
    file_size: 1,
    mime_type: "application/pdf",
    status: "completed",
    created_at: "2024-02-10T10:00:00Z",
    updated_at: "2024-02-10T10:00:00Z",
    metadata: null,
    version_count: 1,
    has_earlier: false,
  } as unknown as DocumentSearchRow
}

const ROWS = [row("z", "Zeta.pdf"), row("a", "Alpha.pdf"), row("m", "Mid.pdf")]

type ResultsProps = Parameters<typeof DocumentsFindResults>[0]

function results(over: Partial<ResultsProps> = {}) {
  const props: ResultsProps = {
    rows: ROWS,
    total: 3,
    olderMatches: 0,
    loading: false,
    error: null,
    onRetry: vi.fn(),
    sort: "added_desc",
    onSortChange: vi.fn(),
    hasFolderCondition: false,
    hasRelationship: false,
    version: "latest",
    onShowOlder: vi.fn(),
    onClearSearch: vi.fn(),
    offset: 0,
    limit: 25,
    onPageChange: vi.fn(),
    listProps: {
      onDelete: vi.fn(),
      onRefresh: vi.fn(),
      currentUserId: "u1",
      onSelect: vi.fn(),
      selectedDocId: null,
      folders: [],
    },
    ...over,
  }
  render(<DocumentsFindResults {...props} />)
  return props
}

beforeEach(() => listProps.mockReset())

describe("FindSearchRow (D-01 / D-02 / S5)", () => {
  function row_(over: Partial<Parameters<typeof FindSearchRow>[0]> = {}) {
    const props = {
      mode: "find" as const,
      onModeChange: vi.fn(),
      name: "",
      onNameChange: vi.fn(),
      askText: "",
      onAskTextChange: vi.fn(),
      onAsk: vi.fn(),
      ...over,
    }
    render(<FindSearchRow {...props} />)
    return props
  }

  it("renders the mode switch and an h-9 file-name input in find mode", () => {
    row_({ name: "acme" })
    expect(screen.getByRole("radiogroup", { name: "Search mode" })).toBeInTheDocument()
    const input = screen.getByPlaceholderText("Filter by file name…") as HTMLInputElement
    expect(input.value).toBe("acme")
    expect(input.className).toContain("h-9")
  })

  it("ask mode shows the question placeholder and the ASK text, never the find name", () => {
    row_({ mode: "ask", name: "acme", askText: "What changed?" })
    const input = screen.getByPlaceholderText("Ask a question about your documents") as HTMLInputElement
    expect(input.value).toBe("What changed?")
    expect(screen.queryByPlaceholderText("Filter by file name…")).toBeNull()
  })

  it("typing in find mode changes the name; in ask mode the ask text", () => {
    const p = row_()
    fireEvent.change(screen.getByPlaceholderText("Filter by file name…"), { target: { value: "acme" } })
    expect(p.onNameChange).toHaveBeenCalledWith("acme")
    expect(p.onAskTextChange).not.toHaveBeenCalled()
  })

  it("Esc in find clears the name only; Enter in find does nothing", () => {
    const p = row_({ name: "acme" })
    const input = screen.getByPlaceholderText("Filter by file name…")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(p.onAsk).not.toHaveBeenCalled()
    expect(p.onNameChange).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: "Escape" })
    expect(p.onNameChange).toHaveBeenCalledWith("")
    expect(p.onAskTextChange).not.toHaveBeenCalled()
  })

  it("Enter in ask calls onAsk(askText); a blank question calls nothing", () => {
    const p = row_({ mode: "ask", askText: "What changed?" })
    fireEvent.keyDown(screen.getByPlaceholderText("Ask a question about your documents"), { key: "Enter" })
    expect(p.onAsk).toHaveBeenCalledWith("What changed?")
  })

  it("Enter in ask with a blank question calls nothing", () => {
    const p = row_({ mode: "ask", askText: "   " })
    fireEvent.keyDown(screen.getByPlaceholderText("Ask a question about your documents"), { key: "Enter" })
    expect(p.onAsk).not.toHaveBeenCalled()
  })

  it("the ✕ clear button appears only when the find name is non-empty", () => {
    row_({ name: "" })
    expect(screen.queryByRole("button", { name: "Clear file name" })).toBeNull()
  })

  it("the ✕ clears the name", () => {
    const p = row_({ name: "acme" })
    fireEvent.click(screen.getByRole("button", { name: "Clear file name" }))
    expect(p.onNameChange).toHaveBeenCalledWith("")
  })
})

describe("DocumentsFindResults — populated (D-03)", () => {
  it("renders the meta line with the server total and the scope line when no folder is set", () => {
    results({ total: 30 })
    expect(screen.getByText("30 documents")).toBeInTheDocument()
    expect(screen.getByText("Exact match on fields. No AI ranking.")).toBeInTheDocument()
    expect(screen.getByText("Searching every folder you can see.")).toBeInTheDocument()
  })

  it("no scope line when a folder condition is set", () => {
    results({ hasFolderCondition: true })
    expect(screen.queryByText("Searching every folder you can see.")).toBeNull()
  })

  it("mounts DocumentList in the Find column set, unscoped, with the sort's date column", () => {
    results({ sort: "source_created_desc" })
    const props = listProps.mock.calls.at(-1)?.[0]
    expect(props.columns).toBe("find")
    expect(props.folderId).toBeUndefined()
    expect(props.findDateColumn).toEqual({ label: "Created in the file", field: "source_created_at" })
  })

  it("never re-sorts or re-slices: the DOM order IS the server's order", () => {
    results()
    const names = within(screen.getByTestId("find-doclist"))
      .getAllByRole("listitem")
      .map((li) => li.textContent)
    expect(names).toEqual(["Zeta.pdf", "Alpha.pdf", "Mid.pdf"])
  })

  it("Clear search calls onClearSearch", () => {
    const p = results()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(p.onClearSearch).toHaveBeenCalledTimes(1)
  })
})

describe("DocumentsFindResults — loading / error / zero (S7)", () => {
  it("loading keeps the previous rows, marked busy and dimmed", () => {
    results({ loading: true })
    const box = screen.getByTestId("find-results")
    expect(box).toHaveAttribute("aria-busy", "true")
    expect(box.className).toContain("opacity-60")
    expect(screen.getByText("Zeta.pdf")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Searching…")
  })

  it("error: an alert with Try again, and the previous rows are STILL rendered (no list swap)", () => {
    const p = results({ error: new DocumentSearchError(422, "Couldn't run this search.") })
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Couldn't run this search. Your filters are kept.")
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(p.onRetry).toHaveBeenCalledTimes(1)
    expect(screen.getByText("Zeta.pdf")).toBeInTheDocument()
    expect(screen.getByText("Alpha.pdf")).toBeInTheDocument()
  })

  it("zero: the honest empty box with Clear filters, and no list", () => {
    const p = results({ rows: [], total: 0 })
    expect(screen.getByText("No documents match")).toBeInTheDocument()
    expect(
      screen.getByText("Nothing is shown from outside these filters. Remove a filter, or clear them all."),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(p.onClearSearch).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("find-doclist")).toBeNull()
    expect(screen.getByText("0 documents")).toBeInTheDocument()
  })

  it("zero while loading is NOT the empty box (no claim before the answer)", () => {
    results({ rows: [], total: 0, loading: true })
    expect(screen.queryByText("No documents match")).toBeNull()
  })
})

describe("DocumentsFindResults — the older-versions hint (D-06 / P-02)", () => {
  it("3 older matches → plural hint; Show them calls onShowOlder", () => {
    const p = results({ hasRelationship: true, olderMatches: 3 })
    const hint = screen.getAllByRole("status").find((s) => s.textContent?.includes("more match"))
    expect(hint).toBeTruthy()
    expect(hint).toHaveTextContent("3 more matches in older (superseded) versions.")
    expect(hint!.className).toContain("border-dashed")
    fireEvent.click(within(hint!).getByRole("button", { name: "Show them" }))
    expect(p.onShowOlder).toHaveBeenCalledTimes(1)
  })

  it("1 older match → singular", () => {
    results({ hasRelationship: true, olderMatches: 1 })
    expect(screen.getByText(/1 more match in older \(superseded\) versions\./)).toBeInTheDocument()
  })

  it("also shows under the zero box", () => {
    results({ rows: [], total: 0, hasRelationship: true, olderMatches: 2 })
    expect(screen.getByText("No documents match")).toBeInTheDocument()
    expect(screen.getByText(/2 more matches in older/)).toBeInTheDocument()
  })

  it.each([
    ["no older matches", { hasRelationship: true, olderMatches: 0 }],
    ["version not latest", { hasRelationship: true, olderMatches: 3, version: "older" as const }],
    ["no relationship", { hasRelationship: false, olderMatches: 3 }],
  ])("no hint when %s", (_n, over) => {
    results(over)
    expect(screen.queryByText(/more match/)).toBeNull()
  })
})

describe("DocumentsFindResults — the exact pager (FIND-02)", () => {
  it("total 30 → the pager renders", () => {
    results({ total: 30 })
    expect(screen.getByTestId("documents-pager")).toBeInTheDocument()
  })

  it("total 25 → no pager", () => {
    results({ total: 25 })
    expect(screen.queryByTestId("documents-pager")).toBeNull()
  })

  it("a page change reports the new offset and limit", () => {
    const p = results({ total: 60 })
    fireEvent.click(screen.getByRole("button", { name: /Next/ }))
    expect(p.onPageChange).toHaveBeenCalledWith(25, 25)
  })
})
