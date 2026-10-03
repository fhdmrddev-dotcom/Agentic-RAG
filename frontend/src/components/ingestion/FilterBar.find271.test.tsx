/**
 * Phase 271-04 (D-114-1 / P-06) — FilterBar's Find-only extensions, and the proof that the
 * Views tab did not move.
 *
 * ⛔ ONE BUILDER. Find adds optional props to the shipped FilterBar; it never forks it. So the
 * first block here is a BYTE-IDENTITY pin: the DOM FilterBar renders with ONLY the shipped
 * props is compared against a snapshot written from the merged wave-1 tree BEFORE any 271-04
 * edit to FilterBar or ConditionPopover. A Find-only prop that leaked into the shipped render
 * (a stray wrapper, a class, an extra button) changes the snapshot and reds here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, fireEvent, act } from "@testing-library/react"
import { FilterBar } from "@/components/ingestion/FilterBar"
import type { MetadataFieldDef, ViewFilter } from "@/types"

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
  resolveFilterCount.mockResolvedValue(5)
})

const TWO: ViewFilter = {
  op: "and",
  conditions: [
    { field: "document_type", op: "eq", value: "Contract" },
    { field: "date", op: "between", value: "2019-01-01", value2: "2019-12-31" },
  ],
}

const CUSTOM: MetadataFieldDef[] = [
  { id: "f1", field_key: "region", field_type: "string", is_system_global: false, enabled: true },
]

describe("FilterBar — the Views tab is byte-identical (shipped props only)", () => {
  it("empty filter: the shipped DOM", () => {
    const { container } = render(<FilterBar customFields={CUSTOM} value={{ op: "and", conditions: [] }} matchCount={null} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("two conditions with a host count: the shipped DOM", () => {
    const { container } = render(<FilterBar customFields={CUSTOM} value={TWO} matchCount={5} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("the ＋ condition popover open: the shipped DOM (the full field list, nothing excluded)", () => {
    const { container, getByText } = render(
      <FilterBar customFields={CUSTOM} value={TWO} matchCount={5} />,
    )
    act(() => {
      fireEvent.click(getByText("condition"))
    })
    expect(container.innerHTML).toMatchSnapshot()
  })
})

describe("FilterBar — the Find-only props", () => {
  it("quickAdd renders after 'Where' and before ＋ condition", () => {
    const { container } = render(
      <FilterBar value={TWO} matchCount={5} quickAdd={<button type="button">QUICK-ADD-SLOT</button>} />,
    )
    const text = container.textContent ?? ""
    const where = text.indexOf("Where")
    const slot = text.indexOf("QUICK-ADD-SLOT")
    const plus = text.lastIndexOf("condition")
    expect(where).toBeGreaterThanOrEqual(0)
    expect(slot).toBeGreaterThan(where)
    expect(plus).toBeGreaterThan(slot)
  })

  it("suppressCount hides the match-count span AND makes no count request", () => {
    vi.useFakeTimers()
    try {
      const { queryByTestId } = render(<FilterBar value={TWO} suppressCount debounceMs={10} />)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(queryByTestId("match-count")).toBeNull()
      expect(resolveFilterCount).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("without suppressCount the shipped self-count still runs (control for the case above)", () => {
    vi.useFakeTimers()
    try {
      const { getByTestId } = render(<FilterBar value={TWO} debounceMs={10} />)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(getByTestId("match-count")).toBeInTheDocument()
      expect(resolveFilterCount).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("saveDisabledReason replaces the Save-as-view link with the muted reason", () => {
    const reason = "This search can't be saved as a view yet."
    const { queryByText, getByText } = render(
      <FilterBar value={TWO} matchCount={5} saveDisabledReason={reason} />,
    )
    expect(queryByText("Save as view")).toBeNull()
    const line = getByText(reason)
    expect(line.className).toContain("text-xs")
    expect(line.className).toContain("text-muted-foreground")
  })

  it("saveDisabledReason shows even when the filter holds no metadata condition (a name alone)", () => {
    const reason = "This search can't be saved as a view yet."
    const { getByText } = render(
      <FilterBar value={{ op: "and", conditions: [] }} suppressCount saveDisabledReason={reason} />,
    )
    expect(getByText(reason)).toBeInTheDocument()
  })

  it("excludeFieldKeys reaches the ＋ condition popover's field list", () => {
    const { getByText, getByLabelText } = render(
      <FilterBar value={TWO} matchCount={5} excludeFieldKeys={["name", "type", "size"]} />,
    )
    act(() => {
      fireEvent.click(getByText("condition"))
    })
    const options = Array.from((getByLabelText("Field") as HTMLSelectElement).options).map((o) => o.value)
    expect(options).not.toContain("name")
    expect(options).not.toContain("type")
    expect(options).not.toContain("size")
    expect(options).toContain("title")
    expect(options).toContain("path")
  })
})

describe("FilterChip — the shipped chip markup, exported", () => {
  it("renders a summary button and a separate keyboard-reachable ✕ with the given name", async () => {
    const { FilterChip } = await import("@/components/ingestion/FilterBar")
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    const { getByRole } = render(
      <FilterChip
        summary="Added by You"
        removeLabel="Remove Added by condition"
        onEdit={onEdit}
        onRemove={onRemove}
        expanded={false}
      />,
    )
    const edit = getByRole("button", { name: "Added by You" })
    expect(edit).toHaveAttribute("aria-haspopup", "dialog")
    expect(edit).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(edit)
    expect(onEdit).toHaveBeenCalledTimes(1)
    const remove = getByRole("button", { name: "Remove Added by condition" })
    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(edit.parentElement?.className).toContain("rounded-full border border-border bg-card")
  })

  it("with no onRemove there is no ✕ at all (the Version default)", async () => {
    const { FilterChip } = await import("@/components/ingestion/FilterBar")
    const { getAllByRole } = render(<FilterChip summary="Version: Latest" onEdit={vi.fn()} />)
    expect(getAllByRole("button")).toHaveLength(1)
  })
})
