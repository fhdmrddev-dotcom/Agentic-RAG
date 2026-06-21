/**
 * Tests for FilterBar (Phase 114 Plan 05, sketch 029-A).
 *
 * Locks the no-DSL chip-strip contract: add/edit/remove a condition updates the
 * produced ViewFilter AST; the live count is debounced and calls the count
 * helper; the count turns amber at zero; Save-as-view calls createView with the
 * composed {op:"and", conditions:[...]}; and the bar is controlled (a saved view
 * can be loaded back in via `value`).
 */
import { useState } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { FilterBar } from "@/components/ingestion/FilterBar"
import type { ViewFilter } from "@/types"

// Mock only the api functions FilterBar calls.
const resolveFilterCount = vi.fn()
const createView = vi.fn()
const updateView = vi.fn()
vi.mock("@/lib/api", () => ({
  resolveFilterCount: (...args: unknown[]) => resolveFilterCount(...args),
  createView: (...args: unknown[]) => createView(...args),
  updateView: (...args: unknown[]) => updateView(...args),
}))

beforeEach(() => {
  resolveFilterCount.mockReset()
  createView.mockReset()
  updateView.mockReset()
  resolveFilterCount.mockResolvedValue(42)
  createView.mockResolvedValue({ id: "v1", name: "n", filter_expr: { op: "and", conditions: [] }, is_global: false })
  updateView.mockResolvedValue({ id: "v1", name: "n", filter_expr: { op: "and", conditions: [] }, is_global: false })
})

/** Compose one `title is invoice` condition through the popover. */
function addTitleIsInvoice() {
  fireEvent.click(screen.getByText("condition"))
  fireEvent.change(screen.getByLabelText("Value"), { target: { value: "invoice" } })
  fireEvent.click(screen.getByText("Apply"))
}

describe("FilterBar", () => {
  it("adding a condition updates the produced ViewFilter AST", () => {
    const onChange = vi.fn()
    render(<FilterBar onChange={onChange} debounceMs={10} />)
    addTitleIsInvoice()
    expect(onChange).toHaveBeenLastCalledWith({
      op: "and",
      conditions: [{ field: "title", op: "eq", value: "invoice" }],
    })
    // the chip renders a plain-language summary
    expect(screen.getByText(/title is invoice/i)).toBeInTheDocument()
  })

  it("removing a condition updates the AST", () => {
    const onChange = vi.fn()
    render(<FilterBar onChange={onChange} debounceMs={10} />)
    addTitleIsInvoice()
    fireEvent.click(screen.getByLabelText("Remove condition 1"))
    expect(onChange).toHaveBeenLastCalledWith({ op: "and", conditions: [] })
  })

  it("editing an existing chip updates that condition in the AST", () => {
    const onChange = vi.fn()
    render(<FilterBar onChange={onChange} debounceMs={10} />)
    addTitleIsInvoice()
    // click the chip to re-open the editor, change the value, apply
    fireEvent.click(screen.getByText(/title is invoice/i))
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "receipt" } })
    fireEvent.click(screen.getByText("Apply"))
    expect(onChange).toHaveBeenLastCalledWith({
      op: "and",
      conditions: [{ field: "title", op: "eq", value: "receipt" }],
    })
  })

  it("the debounced count calls the count helper and renders the result", async () => {
    resolveFilterCount.mockResolvedValue(7)
    render(<FilterBar debounceMs={10} />)
    addTitleIsInvoice()
    await waitFor(() => expect(resolveFilterCount).toHaveBeenCalled())
    expect(resolveFilterCount).toHaveBeenCalledWith({
      op: "and",
      conditions: [{ field: "title", op: "eq", value: "invoice" }],
    })
    await screen.findByText(/7 documents match/i)
  })

  it("the count is amber at zero (the no-DSL trust signal)", async () => {
    resolveFilterCount.mockResolvedValue(0)
    render(<FilterBar debounceMs={10} />)
    addTitleIsInvoice()
    const countEl = await screen.findByTestId("match-count")
    await waitFor(() => expect(countEl).toHaveAttribute("data-zero", "true"))
    expect(countEl.className).toContain("text-amber-500")
    expect(countEl.textContent).toMatch(/0 documents match/i)
  })

  it("Save-as-view calls createView with the composed filter_expr", async () => {
    const onViewSaved = vi.fn()
    render(<FilterBar debounceMs={10} onViewSaved={onViewSaved} />)
    addTitleIsInvoice()
    fireEvent.click(screen.getByText("Save as view"))
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Invoices" } })
    fireEvent.click(screen.getByText("Save"))
    await waitFor(() => expect(createView).toHaveBeenCalled())
    expect(createView).toHaveBeenCalledWith("Invoices", {
      op: "and",
      conditions: [{ field: "title", op: "eq", value: "invoice" }],
    })
    // Create mode must NOT PATCH an existing view (the D-114-3 regression guard).
    expect(updateView).not.toHaveBeenCalled()
    await waitFor(() => expect(onViewSaved).toHaveBeenCalled())
  })

  it("edit mode (editingView set): Save PATCHes the SAME view, never POSTs a new one (D-114-3)", async () => {
    const onViewSaved = vi.fn()
    const editingView = {
      id: "view-42",
      name: "Invoices",
      filter_expr: {
        op: "and" as const,
        conditions: [{ field: "title", op: "eq" as const, value: "invoice" }],
      },
      is_global: false,
    }
    // Wrap so onChange feeds back into `value` — mirrors how IngestionPage drives
    // the controlled bar (setFilter), so a chip edit actually re-renders the chip.
    function Harness() {
      const [filter, setFilter] = useState<ViewFilter>(editingView.filter_expr)
      return (
        <FilterBar
          debounceMs={10}
          value={filter}
          onChange={setFilter}
          editingView={editingView}
          onViewSaved={onViewSaved}
        />
      )
    }
    render(<Harness />)
    // The save trigger reads "Update view" in edit mode and pre-fills the name.
    fireEvent.click(screen.getByText("Update view"))
    expect((screen.getByLabelText("View name") as HTMLInputElement).value).toBe("Invoices")
    // Edit the existing chip so the saved filter actually changes.
    fireEvent.click(screen.getByText(/title is invoice/i))
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "receipt" } })
    fireEvent.click(screen.getByText("Apply"))
    // Save → PATCH the same view id, NOT a fresh createView POST.
    fireEvent.click(screen.getByText("Save"))
    await waitFor(() => expect(updateView).toHaveBeenCalled())
    expect(updateView).toHaveBeenCalledWith("view-42", {
      name: "Invoices",
      filter_expr: {
        op: "and",
        conditions: [{ field: "title", op: "eq", value: "receipt" }],
      },
    })
    expect(createView).not.toHaveBeenCalled()
    await waitFor(() => expect(onViewSaved).toHaveBeenCalled())
  })

  it("is controlled: a saved view's filter loads back into the bar via `value`", () => {
    const loaded: ViewFilter = {
      op: "and",
      conditions: [{ field: "document_type", op: "eq", value: "invoice" }],
    }
    render(<FilterBar value={loaded} debounceMs={10} />)
    // the loaded condition renders as a chip immediately
    expect(screen.getByText(/document_type is invoice/i)).toBeInTheDocument()
  })

  it("does not count an empty filter (no narrowing — no round-trip)", () => {
    render(<FilterBar debounceMs={10} />)
    // no conditions yet → no count fetch, no count element
    expect(resolveFilterCount).not.toHaveBeenCalled()
    expect(screen.queryByTestId("match-count")).not.toBeInTheDocument()
  })

  it("uses the term 'view' / 'condition', never 'query'", () => {
    render(<FilterBar debounceMs={10} />)
    addTitleIsInvoice()
    expect(within(document.body).queryByText(/query/i)).toBeNull()
    expect(screen.getByText("Save as view")).toBeInTheDocument()
  })
})
