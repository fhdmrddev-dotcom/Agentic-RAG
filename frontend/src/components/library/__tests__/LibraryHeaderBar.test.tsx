/**
 * Sketch 231-A — the Library's one header row, fenced.
 *
 * ⭐ Two of these cases exist because the first cut of this component FAILED them, and both
 * failures were the same shape: **a thing that looks like a preserved contract but is actually a
 * duplicate.** A hidden `TabsList` kept "for the shell hook" became a second `role="tab"` and
 * broke 41 cases; a count badge appended to a tab's label RENAMED that tab and broke six more.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LibraryHeaderBar } from "../LibraryHeaderBar"

const TABS = [
  ["documents", "Documents"],
  ["views", "Views"],
  ["ingestion", "Ingestion"],
  ["indexing", "Indexing"],
  ["health", "Health"],
] as const

function renderBar(over: Partial<React.ComponentProps<typeof LibraryHeaderBar>> = {}) {
  return render(
    <LibraryHeaderBar
      tab="documents"
      tabs={TABS}
      onSelectTab={vi.fn()}
      inFlight={0}
      totalDocuments={103}
      onOpenQueue={vi.fn()}
      {...over}
    />,
  )
}

afterEach(cleanup)

describe("one row, and everything in it", () => {
  it("renders the title, all five tabs and the pill on a single element", () => {
    renderBar()
    const bar = screen.getByTestId("library-headerbar")
    expect(bar).toBeInTheDocument()
    for (const [, label] of TABS) expect(screen.getByRole("tab", { name: label })).toBeInTheDocument()
    expect(screen.getByTestId("library-queue-pill")).toBeInTheDocument()
    // the title lives in the same row, not in a block above it
    expect(bar.textContent).toContain("Library")
  })

  it("⛔ there is EXACTLY ONE element per tab name — no hidden duplicate control", () => {
    // The first cut kept a hidden TabsList "to preserve the <screen>-tabslist hook" and produced
    // `getMultipleElementsFoundError` in 41 cases. A hidden duplicate of an interactive control
    // is not a preserved contract, it is a second control.
    renderBar()
    for (const [, label] of TABS) {
      expect(screen.getAllByRole("tab", { name: label })).toHaveLength(1)
    }
  })

  it("⛔ the breadcrumb is gone — it duplicated the sidebar and the tab strip", () => {
    renderBar()
    expect(screen.getByTestId("library-headerbar").textContent).not.toContain("›")
  })

  it("marks the active tab and reports a click", async () => {
    const onSelectTab = vi.fn()
    const user = userEvent.setup()
    renderBar({ tab: "ingestion", onSelectTab })
    expect(screen.getByRole("tab", { name: "Ingestion" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Documents" })).toHaveAttribute("aria-selected", "false")
    await user.click(screen.getByRole("tab", { name: "Health" }))
    expect(onSelectTab).toHaveBeenCalledWith("health")
  })

  it("carries the shell hook on the VISIBLE control", () => {
    renderBar({ listTestId: "documents-tabslist" })
    expect(screen.getByTestId("documents-tabslist")).toBeInTheDocument()
  })
})

describe("⭐ the reclaimed corner does a job", () => {
  it("at rest it states the corpus rather than sitting empty", () => {
    renderBar({ inFlight: 0, totalDocuments: 103 })
    const pill = screen.getByTestId("library-queue-pill")
    expect(pill).toHaveAttribute("data-live", "false")
    expect(pill.textContent).toContain("103 documents")
  })

  it('⛔ while work is in flight it says "Reading", never "added"', () => {
    // A file being read is not in the Library yet. Saying "added" is the exact defect the queue
    // fix introduced downstream, and this row exists partly to stop the surface repeating it.
    renderBar({ inFlight: 12 })
    const pill = screen.getByTestId("library-queue-pill")
    expect(pill).toHaveAttribute("data-live", "true")
    expect(pill.textContent).toContain("Reading 12 files")
    expect(pill.textContent).not.toContain("added")
    expect(pill.textContent).not.toContain("Added")
  })

  it("gets the singular right, because 'Reading 1 files' reads as a bug", () => {
    renderBar({ inFlight: 1 })
    expect(screen.getByTestId("library-queue-pill").textContent).toContain("Reading 1 file")
    expect(screen.getByTestId("library-queue-pill").textContent).not.toContain("1 files")
  })

  it("⛔ the pill LANDS somewhere — a control that lights up and goes nowhere is the defect", () => {
    const onOpenQueue = vi.fn()
    renderBar({ inFlight: 3, onOpenQueue })
    screen.getByTestId("library-queue-pill").click()
    expect(onOpenQueue).toHaveBeenCalledTimes(1)
  })
})
