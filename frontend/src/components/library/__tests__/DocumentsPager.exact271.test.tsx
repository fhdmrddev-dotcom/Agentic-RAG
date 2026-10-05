/**
 * Phase 271-04 (FIND-02) — `exact`: Find's total is the SERVER's exact count, so the 1000-row
 * "the list may be larger" arm (which exists because `GET /documents` is capped by PostgREST)
 * must not fire for it. Browse passes nothing and keeps the shipped cap wording.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DocumentsPager } from "@/components/library/DocumentsPager"

describe("DocumentsPager exact (Phase 271-04)", () => {
  it("exact with total 1500: no 'may be larger' wording and no '+' on the total", () => {
    render(<DocumentsPager total={1500} offset={0} limit={25} onChange={vi.fn()} exact />)
    const pager = screen.getByTestId("documents-pager")
    expect(pager.textContent).not.toMatch(/may be larger/)
    expect(pager.textContent).not.toMatch(/\+/)
  })

  it("without exact the shipped cap arm still renders (browse unchanged)", () => {
    render(<DocumentsPager total={1500} offset={0} limit={25} onChange={vi.fn()} />)
    expect(screen.getByTestId("documents-pager").textContent).toMatch(
      /The list may be larger than shown/,
    )
  })

  it("below the cap the two render the same words", () => {
    const a = render(<DocumentsPager total={30} offset={0} limit={25} onChange={vi.fn()} exact />)
    const exactText = a.container.textContent
    a.unmount()
    const b = render(<DocumentsPager total={30} offset={0} limit={25} onChange={vi.fn()} />)
    expect(b.container.textContent).toBe(exactText)
  })
})
