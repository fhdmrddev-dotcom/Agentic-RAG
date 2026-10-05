/**
 * Phase 271 plan 02 (D-03 / UI-SPEC S4) — the Find meta line.
 *
 * The ONE count on screen in Find, the server-sort select, and the deterministic line that says
 * what kind of search this is. Props only: the sort labels are passed in, and the select only
 * reports a choice — the server re-sorts, the client never does.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FindMetaLine } from "../FindMetaLine"

// Radix Select needs the standard jsdom pointer-capture + scrollIntoView shims to open.
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const SORT_OPTIONS = [
  { value: "added_desc", label: "Added to Syrel (newest)" },
  { value: "added_asc", label: "Added to Syrel (oldest)" },
  { value: "name_asc", label: "Name (A to Z)" },
] as const

function renderLine(over: Partial<React.ComponentProps<typeof FindMetaLine>> = {}) {
  const props: React.ComponentProps<typeof FindMetaLine> = {
    total: 4,
    loading: false,
    sort: "added_desc",
    sortOptions: SORT_OPTIONS,
    onSortChange: vi.fn(),
    showScopeLine: false,
    onClearSearch: vi.fn(),
    ...over,
  }
  return { ...render(<FindMetaLine {...props} />), props }
}

describe("FindMetaLine — the count", () => {
  it("4 → '4 documents', semibold", () => {
    renderLine({ total: 4 })
    const count = screen.getByText("4 documents")
    expect(count.className).toContain("font-semibold")
    expect(count.className).toContain("tabular-nums")
  })

  it("1 → '1 document' (singular)", () => {
    renderLine({ total: 1 })
    expect(screen.getByText("1 document")).toBeInTheDocument()
  })

  it("0 → '0 documents' in the warning tone", () => {
    renderLine({ total: 0 })
    expect(screen.getByText("0 documents").className).toContain("text-warning")
  })

  it("loading → 'Searching…' in a status region", () => {
    renderLine({ loading: true })
    expect(screen.getByRole("status")).toHaveTextContent("Searching…")
  })

  it("the count container is a polite live region", () => {
    const { container } = renderLine({ total: 4 })
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live).toHaveTextContent("4 documents")
  })
})

describe("FindMetaLine — the server sort", () => {
  it("labels the select 'Sort results' and lists the given options in order", async () => {
    const user = userEvent.setup()
    renderLine()
    expect(screen.getByText("Sorted by")).toBeInTheDocument()
    const trigger = screen.getByRole("combobox", { name: "Sort results" })
    await user.click(trigger)
    const options = await screen.findAllByRole("option")
    expect(options.map((o) => o.textContent)).toEqual(SORT_OPTIONS.map((o) => o.label))
  })

  it("choosing an option reports its value", async () => {
    const user = userEvent.setup()
    const { props } = renderLine()
    await user.click(screen.getByRole("combobox", { name: "Sort results" }))
    await user.click(await screen.findByRole("option", { name: "Name (A to Z)" }))
    expect(props.onSortChange).toHaveBeenCalledWith("name_asc")
  })
})

describe("FindMetaLine — what this search is", () => {
  it("states the deterministic line with a decorative dot", () => {
    const { container } = renderLine()
    expect(screen.getByText("Exact match on fields. No AI ranking.")).toBeInTheDocument()
    const dot = container.querySelector(".bg-success")
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute("aria-hidden", "true")
  })

  it("shows the scope line only when asked", () => {
    const { unmount } = renderLine({ showScopeLine: false })
    expect(screen.queryByText("Searching every folder you can see.")).not.toBeInTheDocument()
    unmount()
    renderLine({ showScopeLine: true })
    expect(screen.getByText("Searching every folder you can see.")).toBeInTheDocument()
  })

  it("'Clear search' calls onClearSearch", () => {
    const { props } = renderLine()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(props.onClearSearch).toHaveBeenCalledTimes(1)
  })
})
