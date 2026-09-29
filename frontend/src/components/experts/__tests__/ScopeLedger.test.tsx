/**
 * Phase 267-03 (D-267-27, UI-SPEC §5.2) — the Will / won't ledger leaf.
 *
 * ⛔ EVERY WORD IS ASSERTED VISIBLE AT REST. jsdom loads no Tailwind, so `toBeVisible()` cannot see
 * a utility class that hides text; each case therefore also walks the ancestors for the four
 * hiding utilities (the 266 UAT fix that caught a tooltip-only note, `FolderNode.test.tsx`).
 * ⛔ Content, not presence: the test ids anchor the query, the assertions read the words.
 */
import { render, screen, within } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { ScopeLedger, type LedgerColumn } from "../ScopeLedger"
import { UNNAMEABLE_FOLDER } from "../catalog/ExpertDetailModal"

const HIDING = new Set(["hidden", "sr-only", "invisible", "opacity-0"])

function assertVisibleAtRest(el: HTMLElement) {
  expect(el).toBeVisible()
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const hiding = (n.getAttribute("class") ?? "").split(/\s+/).filter((t) => HIDING.has(t))
    expect(hiding, `<${n.tagName.toLowerCase()} class="${n.getAttribute("class")}">`).toEqual([])
  }
}

const TWO: LedgerColumn[] = [
  { tone: "yes", heading: "Brings", items: [{ label: "2 folders" }, { label: "Notion" }] },
  { tone: "no", heading: "Missing", items: [{ label: "HubSpot" }] },
]

describe("ScopeLedger", () => {
  it("(1) renders one cell per column, each heading and item visible at rest", () => {
    render(<ScopeLedger columns={TWO} />)
    const ledger = screen.getByTestId("scope-ledger")
    const yes = within(ledger).getByTestId("scope-ledger-col-yes")
    const no = within(ledger).getByTestId("scope-ledger-col-no")
    for (const [cell, words] of [
      [yes, ["Brings", "2 folders", "Notion"]],
      [no, ["Missing", "HubSpot"]],
    ] as const) {
      for (const w of words) assertVisibleAtRest(within(cell).getByText(w))
    }
  })

  it("(2) the heading is a <p id> and the list a <ul aria-labelledby> pointing at it", () => {
    render(<ScopeLedger columns={TWO} />)
    const heading = screen.getByText("Missing")
    expect(heading.tagName).toBe("P")
    const id = heading.getAttribute("id")
    expect(id).toBeTruthy()
    const list = screen.getByRole("list", { name: "Missing" })
    expect(list.tagName).toBe("UL")
    expect(list.getAttribute("aria-labelledby")).toBe(id)
    expect(within(list).getByText("HubSpot")).toBeTruthy()
  })

  it("(3) more than five items: five render, then 'and 2 more'", () => {
    const items = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((label) => ({ label }))
    render(<ScopeLedger columns={[{ tone: "no", heading: "Missing", items }]} />)
    const list = screen.getByRole("list", { name: "Missing" })
    for (const l of ["a1", "a2", "a3", "a4", "a5"]) expect(within(list).getByText(l)).toBeTruthy()
    expect(within(list).queryByText("a6")).toBeNull()
    expect(within(list).queryByText("a7")).toBeNull()
    assertVisibleAtRest(within(list).getByText("and 2 more"))
  })

  it("(4) a column's own `more` count is added to the overflow, never re-derived from the items", () => {
    render(
      <ScopeLedger
        columns={[{ tone: "no", heading: "Won't use", items: [{ label: "x.pdf" }], more: 3 }]}
      />,
    )
    expect(screen.getByText("and 3 more")).toBeTruthy()
  })

  it("(5) an unnameable folder renders the shipped phrase — never a blank", () => {
    render(
      <ScopeLedger
        columns={[{ tone: "yes", heading: "Will use", items: [{ label: "", unnameable: true }] }]}
      />,
    )
    const item = screen.getByText(UNNAMEABLE_FOLDER)
    assertVisibleAtRest(item)
    // The EyeOff glyph beside it (lucide renders an <svg class="lucide lucide-eye-off">).
    expect(item.closest("li")?.querySelector("svg.lucide-eye-off")).toBeTruthy()
  })

  it("(6) a single column spans full width — no two-column grid on a one-column ledger", () => {
    const { rerender } = render(<ScopeLedger columns={[TWO[1]]} />)
    expect(screen.getByTestId("scope-ledger").className).not.toContain("sm:grid-cols-2")
    rerender(<ScopeLedger columns={TWO} />)
    expect(screen.getByTestId("scope-ledger").className).toContain("sm:grid-cols-2")
  })

  it("(7) every item carries its full text in title (truncation never hides the only copy)", () => {
    const long = "Financial Reports & Filings for the ACME account, fiscal 2026"
    render(<ScopeLedger columns={[{ tone: "yes", heading: "Brings", items: [{ label: long }] }]} />)
    const item = screen.getByText(long)
    expect(item.getAttribute("title")).toBe(long)
  })

  it("(8) tone is carried by the cell's colour family AND its word — never colour alone", () => {
    render(<ScopeLedger columns={TWO} />)
    expect(screen.getByTestId("scope-ledger-col-yes").className).toContain("emerald")
    expect(screen.getByTestId("scope-ledger-col-no").className).toContain("rose")
    expect(screen.getByTestId("scope-ledger-col-no").textContent).toContain("Missing")
  })
})

// 267-REVIEW WR-08 — D-267-19's promise ("Chat attachments" stay readable) was appended AFTER the
// Expert's folders and the ledger shows five items, so an Expert with five or more folders folded
// the promise into "and 1 more": invisible at rest, the 266 UI-3 failure. The real selector feeds
// the real ledger here.
describe("WR-08 — Chat attachments is never folded into 'and k more'", () => {
  it("six Expert folders: five named, the overflow line for the sixth, and Chat attachments visible", async () => {
    const { previewLedgerColumns } = await import("../catalog/expertCatalog")
    const folders = ["A", "B", "C", "D", "E", "F"].map((n, i) => ({ id: `f${i}`, name: `Folder ${n}` }))
    render(
      <ScopeLedger
        columns={previewLedgerColumns({
          expert_id: "e",
          expert_name: "Wide",
          mode: "restricted",
          expert_folders: folders,
          thread_folder: null,
          excluded_count: 0,
          excluded_names: [],
        })}
      />,
    )
    const yes = screen.getByTestId("scope-ledger-col-yes")
    expect(within(yes).getByText("Chat attachments")).toBeVisible()
    expect(within(yes).getByText("and 1 more")).toBeVisible()
    for (const n of ["A", "B", "C", "D", "E"]) expect(within(yes).getByText(`Folder ${n}`)).toBeVisible()
  })
})

// Phase 268-03 (CHAT-08 · UI-SPEC §4.1 / §5.3) — the scope picker reuses this leaf: a `held` tone
// (saved, not in effect — amber on both themes), an `Expert` tag on an Expert's folder, and a muted
// literal ("Nothing changes") that is a statement, not an item.
describe("268-03 — held tone, the Expert tag and a muted literal", () => {
  it("(268-1) the held column is amber on both themes and every word is visible at rest", () => {
    render(
      <ScopeLedger
        columns={[
          { tone: "held", heading: "Saved", items: [{ label: "/Client ACME/Q3 Contracts" }] },
          { tone: "yes", heading: "Searching", items: [{ label: "HR Policies", tag: "Expert" }] },
        ]}
      />,
    )
    const held = screen.getByTestId("scope-ledger-col-held")
    expect((held.getAttribute("class") ?? "").split(/\s+/)).toEqual(
      expect.arrayContaining(["border-amber-600/40", "dark:border-amber-500/30"]),
    )
    for (const w of ["Saved", "/Client ACME/Q3 Contracts"]) assertVisibleAtRest(within(held).getByText(w))
    const yes = screen.getByTestId("scope-ledger-col-yes")
    const tag = within(yes).getByText("Expert")
    assertVisibleAtRest(tag)
    expect(tag.closest("li")?.textContent).toContain("HR Policies")
  })

  it("(268-2) a muted item renders muted, never as a foreground item", () => {
    render(
      <ScopeLedger
        columns={[{ tone: "no", heading: "Stops searching", items: [{ label: "Nothing changes", muted: true }] }]}
      />,
    )
    const cell = within(screen.getByTestId("scope-ledger-col-no")).getByText("Nothing changes")
    assertVisibleAtRest(cell)
    const cls = cell.className.split(/\s+/)
    expect(cls).toContain("text-muted-foreground")
    expect(cls).not.toContain("text-foreground")
  })
})
