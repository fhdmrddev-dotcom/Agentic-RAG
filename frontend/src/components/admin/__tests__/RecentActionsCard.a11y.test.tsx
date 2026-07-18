/**
 * Phase 155 Plan 04 Task 1 — RecentActionsCard a11y contract (WCAG 2.1 AA / D-01).
 *
 * The 146-05 ledger-is-receipt card is a PURE PRESENTATIONAL LEAF (props in, DOM
 * out): its honest states are "empty" (calm "nothing yet" copy) vs "populated"
 * (newest-first rows). This suite locks the D-12 zero-STRUCTURAL-violations bar
 * across both, plus the never-glyph/colour-alone contract for a WRITE row: the
 * ✎ mark is aria-hidden, so a write is announced to assistive tech via an sr-only
 * "Change:" word — a read row carries no such word.
 *
 * STRUCTURAL rules only (no contrast assertion — that is the D-01 live-scan half).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { axe } from "vitest-axe"

import { RecentActionsCard } from "../RecentActionsCard"
import type { OperatorAuditRow } from "@/lib/api"

function makeRow(overrides: Partial<OperatorAuditRow> = {}): OperatorAuditRow {
  return {
    id: "row-1",
    action: "flag.set",
    label: "Turned OFF code sandbox",
    is_write: true,
    target_type: "flag",
    target_id: "sandbox_enabled",
    created_at: "2026-07-15T20:00:00Z",
    ...overrides,
  }
}

const ROWS: OperatorAuditRow[] = [
  makeRow(),
  makeRow({ id: "row-2", action: "audit.view", label: "Viewed the audit log", is_write: false }),
]

afterEach(() => {
  cleanup()
})

describe("RecentActionsCard a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — populated (a write row + a read row)", async () => {
    const { container } = render(<RecentActionsCard rows={ROWS} />)
    await screen.findByText(/turned off code sandbox/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — empty", async () => {
    const { container } = render(<RecentActionsCard rows={[]} />)
    await screen.findByText(/no actions yet/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("RecentActionsCard a11y — named contract", () => {
  it("the empty state announces its calm word copy (never colour-alone)", () => {
    render(<RecentActionsCard rows={[]} />)
    expect(screen.getByText(/no actions yet/i)).toBeInTheDocument()
  })

  it("a WRITE row exposes its write-ness as an sr-only 'Change:' word (✎ is aria-hidden)", () => {
    render(<RecentActionsCard rows={[makeRow({ is_write: true })]} />)
    // The ✎ glyph is aria-hidden; the write is announced via the sr-only word.
    expect(screen.getByText(/change:/i)).toBeInTheDocument()
  })

  it("a READ row carries no 'Change:' word", () => {
    render(<RecentActionsCard rows={[makeRow({ id: "r-read", is_write: false })]} />)
    expect(screen.queryByText(/change:/i)).not.toBeInTheDocument()
  })
})
