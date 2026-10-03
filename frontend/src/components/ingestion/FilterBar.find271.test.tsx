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
