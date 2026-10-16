/**
 * Phase 271-04 (FIND-02) — `exact`: Find's total is the SERVER's exact count, so the 1000-row
 * "the list may be larger" arm (which exists because `GET /documents` is capped by PostgREST)
 * must not fire for it. Browse passes nothing and keeps the shipped cap wording.
 *
 * ⚠ 284-03 (D-09): browse pages on the server now, so EVERY total is exact and the cap arm is
 * deleted. `exact` is a declared no-op until DocumentsFindBody next changes.
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

  // 284-03 (D-09): REWRITTEN IN PLACE. This case pinned the 1000-row cap arm for browse. Browse
  // now pages on the server and its total is exact, so the arm is deleted — no caller can reach it.
  it("browse at total 1,500 renders the exact total, grouped — no '+', no cap line", () => {
    render(<DocumentsPager total={1500} offset={0} limit={25} onChange={vi.fn()} />)
    const pager = screen.getByTestId("documents-pager")
    expect(pager.textContent).toContain("1–25 of 1,500")
    expect(pager.textContent).not.toMatch(/\+/)
    expect(pager.textContent).not.toMatch(/may be larger/)
  })

  it("below the cap the two render the same words", () => {
    const a = render(<DocumentsPager total={30} offset={0} limit={25} onChange={vi.fn()} exact />)
    const exactText = a.container.textContent
    a.unmount()
    const b = render(<DocumentsPager total={30} offset={0} limit={25} onChange={vi.fn()} />)
    expect(b.container.textContent).toBe(exactText)
  })
})
