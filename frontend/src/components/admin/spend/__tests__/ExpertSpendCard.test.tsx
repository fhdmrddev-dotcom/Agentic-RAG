/**
 * Phase 268 (UI-SPEC §5.7-§5.8, D-268-10) — the Spend by Expert card, its reconciliation
 * footer, and the ledger's Expert cell. Content, not presence: every assertion reads the words.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ExpertSpendCard,
  LedgerExpertCell,
  SubagentTag,
  reconcileExpertLines,
} from "../ExpertSpendCard"
import { EXPERT_SPEND_COPY as C } from "../expertSpendCopy"
import type { ExpertSpendLine } from "@/types/spend"

afterEach(cleanup)

const HR = "11111111-1111-4111-8111-111111111111"
const FA = "22222222-2222-4222-8222-222222222222"
const GONE = "9f3c2a71-0000-4000-8000-000000000000"

function line(key: string, over: Partial<ExpertSpendLine> = {}): ExpertSpendLine {
  return {
    key,
    expertId: key === "none" || key === "unrecorded" ? null : key,
    name: null,
    deleted: false,
    scopeMode: null,
    runCount: 1,
    inputTokens: 1000,
    outputTokens: 500,
    spendUsd: 0.1,
    unratedCount: 0,
    ...over,
  }
}

// 0.9 + 0.2 + 0.1 + 1.1 + 1.0 = 3.3 — float addition leaves a residue (3.3000000000000003),
// which is exactly why the footer compares integer ten-thousandths.
const LINES: ExpertSpendLine[] = [
  line(FA, { name: "Financial Analyzer", scopeMode: "biased", spendUsd: 0.9, runCount: 2, unratedCount: 1 }),
  line(HR, { name: "HR Advisor", scopeMode: "restricted", spendUsd: 0.2, runCount: 1 }),
  line(GONE, { deleted: true, spendUsd: 0.1, runCount: 1 }),
  line("none", { spendUsd: 1.1, runCount: 2 }),
  line("unrecorded", { spendUsd: 1.0, runCount: 1 }),
]

function renderCard(over: Partial<React.ComponentProps<typeof ExpertSpendCard>> = {}) {
  const onSelect = vi.fn()
  render(
    <ExpertSpendCard
      state="ready"
      lines={LINES}
      windowTotalUsd={3.3}
      windowRunCount={7}
      windowLabel="Last 30D"
      selected={null}
      selectedLabel={null}
      onSelect={onSelect}
      {...over}
    />,
  )
  return onSelect
}

describe("reconcileExpertLines", () => {
  it("reconciles in integer ten-thousandths, so a float residue is not an alarm", () => {
    expect(reconcileExpertLines(LINES, 3.3, 7)).toEqual({ ok: true, lines: 5, total: "3.3000", runs: 7 })
  })

  it("names a 0.0001 USD difference", () => {
    expect(reconcileExpertLines(LINES, 3.3001, 7)).toEqual({
      ok: false,
      kind: "usd",
      sum: "3.3000",
      total: "3.3001",
      diff: "0.0001",
    })
  })

  it("names a run-count difference", () => {
    expect(reconcileExpertLines(LINES, 3.3, 9)).toEqual({ ok: false, kind: "runs", counted: 7, window: 9 })
  })

  it("counts an unpriced line as $0 in the sum, never as NaN", () => {
    const withNull = [...LINES.slice(0, 4), line("unrecorded", { spendUsd: null, runCount: 1 })]
    expect(reconcileExpertLines(withNull, 2.3, 7)).toEqual({ ok: true, lines: 5, total: "2.3000", runs: 7 })
  })
})

describe("ExpertSpendCard", () => {
  it("lists Experts, then No Expert, then Not recorded, then the org total — all visible", () => {
    renderCard()
    const table = screen.getByTestId("expert-spend-table")
    const rows = within(table).getAllByRole("row").slice(1) // drop the header
    const names = rows.map((r) => within(r).getAllByRole("cell")[0].textContent)
    expect(names).toEqual([
      "Financial AnalyzerBiased1 unrated",
      "HR AdvisorRestricted",
      `Deleted Expert ${GONE.slice(0, 8)}`,
      "No Expert",
      "Not recorded (before 268)",
      "Org total",
    ])
    expect(screen.getByText("Spend by Expert")).toBeVisible()
    expect(screen.getByText("every Expert · Last 30D · not filtered")).toBeVisible()
    const fa = screen.getByTestId(`expert-spend-row-${FA}`)
    expect(within(fa).getByText("$0.9000")).toBeVisible()
    expect(within(fa).getByText("1.5k")).toBeVisible()
    expect(within(fa).getByText("1 unrated")).toBeVisible()
    const total = screen.getByTestId("expert-spend-row-total")
    expect(within(total).getByText("$3.3000")).toBeVisible()
    expect(within(total).getByText("7")).toBeVisible()
  })

  it("keeps No Expert even at 0 · 0 · $0.0000 in an empty window", () => {
    renderCard({
      lines: [line("none", { runCount: 0, spendUsd: 0, inputTokens: 0, outputTokens: 0 })],
      windowTotalUsd: 0,
      windowRunCount: 0,
    })
    const none = screen.getByTestId("expert-spend-row-none")
    expect(within(none).getByText("No Expert")).toBeVisible()
    expect(within(none).getByText("$0.0000")).toBeVisible()
    expect(screen.getByTestId("expert-spend-recon")).toHaveTextContent(
      "✓ 1 line = $0.0000 = org total · 0 runs, 0 unattributed",
    )
  })

  it("the recon footer reads ✓ when the lines add up", () => {
    renderCard()
    const recon = screen.getByTestId("expert-spend-recon")
    expect(recon).toHaveTextContent(C.reconOk(5, "3.3000", 7))
    expect(recon).not.toHaveAttribute("role", "alert")
  })

  it("the recon footer is a rose alert on a 0.0001 mismatch — this page is not hiding it", () => {
    renderCard({ windowTotalUsd: 3.3001 })
    const recon = screen.getByTestId("expert-spend-recon")
    expect(recon).toHaveAttribute("role", "alert")
    expect(recon).toHaveTextContent(C.reconUsdFail("3.3000", "3.3001", "0.0001"))
  })

  it("the recon footer names unattributed runs on a run-count mismatch", () => {
    renderCard({ windowRunCount: 9 })
    const recon = screen.getByTestId("expert-spend-recon")
    expect(recon).toHaveAttribute("role", "alert")
    expect(recon).toHaveTextContent("✗ Lines count 7 runs; the window has 9. 2 runs are unattributed.")
  })

  it("states the D-268-23 rule at rest", () => {
    renderCard()
    expect(screen.getByText(C.ruleLine)).toBeVisible()
  })

  it("a row click toggles the filter; the selected row is pressed", async () => {
    const user = userEvent.setup()
    const onSelect = renderCard({ selected: HR, selectedLabel: "HR Advisor" })
    const hrButton = within(screen.getByTestId(`expert-spend-row-${HR}`)).getByRole("button")
    expect(hrButton).toHaveAttribute("aria-pressed", "true")
    await user.click(hrButton)
    expect(onSelect).toHaveBeenLastCalledWith(null)
    await user.click(within(screen.getByTestId("expert-spend-row-none")).getByRole("button"))
    expect(onSelect).toHaveBeenLastCalledWith("none")
  })

  it("does not follow the filter: every line stays listed while one is selected", () => {
    renderCard({ selected: HR, selectedLabel: "HR Advisor" })
    expect(screen.getByTestId(`expert-spend-row-${FA}`)).toBeVisible()
    expect(screen.getByTestId("expert-spend-row-none")).toBeVisible()
  })

  it("adds a $0.0000 line for a selected Expert with no runs in this window", () => {
    renderCard({ lines: LINES.filter((l) => l.key !== HR), windowTotalUsd: 3.1, windowRunCount: 6, selected: HR, selectedLabel: "HR Advisor" })
    const hr = screen.getByTestId(`expert-spend-row-${HR}`)
    expect(within(hr).getByText("HR Advisor")).toBeVisible()
    expect(within(hr).getByText("$0.0000")).toBeVisible()
    // the added zero line is not a server line: the footer still counts what the server sent
    expect(screen.getByTestId("expert-spend-recon")).toHaveTextContent(C.reconOk(4, "3.1000", 6))
  })

  it("shows Loading… with no figures while loading", () => {
    renderCard({ state: "loading", lines: [] })
    expect(within(screen.getByTestId("expert-spend-table")).getByText("Loading…")).toBeVisible()
    expect(screen.queryByTestId("expert-spend-recon")).not.toBeInTheDocument()
  })

  it("a failed load says so, with no table and no footer (257 CR-07)", () => {
    renderCard({ state: "failed", lines: [] })
    expect(screen.getByText("Spend by Expert unavailable — spend data did not load.")).toBeVisible()
    expect(screen.queryByTestId("expert-spend-table")).not.toBeInTheDocument()
    expect(screen.queryByTestId("expert-spend-recon")).not.toBeInTheDocument()
  })

  it("renders an unpriced line as — with its unrated chip, never a confident $0.0000", () => {
    renderCard({
      lines: [line(FA, { name: "Local Expert", spendUsd: null, unratedCount: 2, runCount: 2 }), line("none", { spendUsd: 3.3, runCount: 5 })],
    })
    const fa = screen.getByTestId(`expert-spend-row-${FA}`)
    expect(within(fa).getByText("—")).toBeVisible()
    expect(within(fa).getByText("2 unrated")).toBeVisible()
    expect(within(fa).queryByText("$0.0000")).not.toBeInTheDocument()
  })
})

describe("LedgerExpertCell", () => {
  const base = { expertId: null, expertName: null, expertDeleted: false, expertAttributed: true }

  it("an Expert is a named pill, the full name visible and in title", () => {
    render(<LedgerExpertCell run={{ ...base, expertId: HR, expertName: "HR Advisor" }} />)
    const cell = screen.getByTestId("ledger-expert-cell")
    expect(within(cell).getByText("HR Advisor")).toBeVisible()
    expect(cell).toHaveAttribute("title", "HR Advisor")
  })

  it("No Expert, Deleted Expert and Not recorded are three different words", () => {
    const { unmount } = render(<LedgerExpertCell run={base} />)
    expect(screen.getByTestId("ledger-expert-cell")).toHaveTextContent("No Expert")
    unmount()
    const r2 = render(<LedgerExpertCell run={{ ...base, expertId: GONE, expertDeleted: true }} />)
    expect(screen.getByTestId("ledger-expert-cell")).toHaveTextContent("Deleted Expert")
    r2.unmount()
    render(<LedgerExpertCell run={{ ...base, expertAttributed: false }} />)
    expect(screen.getByTestId("ledger-expert-cell")).toHaveTextContent(/^Not recorded$/)
  })
})

describe("SubagentTag", () => {
  it("says how many sub-agents a root's figures include, and nothing at zero", () => {
    const { rerender, container } = render(<SubagentTag count={2} />)
    expect(screen.getByText("incl. 2 sub-agents")).toBeVisible()
    rerender(<SubagentTag count={1} />)
    expect(screen.getByText("incl. 1 sub-agent")).toBeVisible()
    rerender(<SubagentTag count={0} />)
    expect(container).toBeEmptyDOMElement()
  })
})
