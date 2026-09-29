/**
 * Phase 268 (UI-SPEC §7.4) — every /admin/spend Expert word has ONE home, and these are its
 * exact strings. The em dash is U+2014, the middle dot U+00B7.
 */
import { describe, expect, it } from "vitest"
import { EXPERT_SPEND_COPY as C, windowLabel } from "../expertSpendCopy"

describe("EXPERT_SPEND_COPY", () => {
  it("pins the ribbon and pill words", () => {
    expect(C.ribbonLabel).toBe("Expert:")
    expect(C.all).toBe("All")
    expect(C.noExpert).toBe("No Expert")
    expect(C.notRecorded).toBe("Not recorded (before 268)")
    expect(C.deletedExpert).toBe("Deleted Expert")
    expect(C.more).toBe("More")
    expect(C.clear).toBe("clear")
  })

  it("pins the statement line and the KPI label", () => {
    expect(C.statementAll("Last 7D")).toBe("Showing all runs · Last 7D")
    expect(C.statementFiltered("HR Advisor", "Last 7D")).toBe(
      "Showing HR Advisor · Last 7D · the cards, charts and ledger follow this filter · clear",
    )
    expect(C.kpiFiltered("HR Advisor")).toBe("Spend · HR Advisor")
    expect(C.chartSuffix("HR Advisor")).toBe("· HR Advisor")
  })

  it("pins the card, table and reconciliation words", () => {
    expect(C.cardHeading).toBe("Spend by Expert")
    expect(C.cardRightLabel("Last 30D")).toBe("every Expert · Last 30D · not filtered")
    expect(C.headers).toEqual(["Expert", "Runs", "Tokens", "USD", "Share"])
    expect(C.unratedChip(3)).toBe("3 unrated")
    expect(C.orgTotal).toBe("Org total")
    expect(C.reconOk(4, "3.3000", 7)).toBe("✓ 4 lines = $3.3000 = org total · 7 runs, 0 unattributed")
    expect(C.reconOk(1, "0.0000", 0)).toBe("✓ 1 line = $0.0000 = org total · 0 runs, 0 unattributed")
    expect(C.reconUsdFail("3.2999", "3.3000", "0.0001")).toBe(
      "✗ Lines sum to $3.2999; the org total is $3.3000 (a difference of $0.0001). This page is not hiding it.",
    )
    expect(C.reconRunsFail(6, 7)).toBe("✗ Lines count 6 runs; the window has 7. 1 runs are unattributed.")
    expect(C.cardLoading).toBe("Loading…")
    expect(C.cardFailed).toBe("Spend by Expert unavailable — spend data did not load.")
  })

  it("pins the D-268-23 rule line verbatim", () => {
    expect(C.ruleLine).toBe(
      "A run counts toward the Expert active when it started. Sub-agent and continued runs count toward their parent run's Expert. Runs from before this was recorded show as Not recorded (before 268), never as No Expert.",
    )
  })

  it("pins the ledger words", () => {
    expect(C.ledgerColumn).toBe("Expert")
    expect(C.ledgerNotRecorded).toBe("Not recorded")
    expect(C.subagentTag(1)).toBe("incl. 1 sub-agent")
    expect(C.subagentTag(2)).toBe("incl. 2 sub-agents")
    expect(C.ledgerHeaderChip("HR Advisor")).toBe("filtered to HR Advisor")
    expect(C.ledgerEmptyFiltered("HR Advisor", "Last 7D")).toBe(
      "No runs for HR Advisor in Last 7D. Its line in Spend by Expert reads $0.0000.",
    )
  })

  it("pins both Blind Spots tiles (UI-SPEC §5.8)", () => {
    expect(C.subagentTile.title).toBe("Sub-agent tokens now counted")
    expect(C.subagentTile.body).toBe(
      "A sub-agent's tokens now count toward the run that started it, and toward that run's Expert. Before Phase 268 they were left out, so totals that include sub-agent work read higher than they used to.",
    )
    expect(C.subagentTile.footer).toBe('Shown as "incl. N sub-agents" in the ledger below.')
    expect(C.handoffTile.title).toBe("Handoff summaries not metered")
    expect(C.handoffTile.body).toBe(
      '"New chat with an Expert" writes a short summary of this chat with one model call. That call is not a run, so its tokens are in no total on this page.',
    )
    expect(C.handoffTile.footer).toBe("Not metered yet")
  })

  it("discloses a partly priced harness run in the operator's words (D-268-28)", () => {
    expect(C.partlyPricedHarness(1)).toBe(
      "1 harness run partly priced — sub-agent costs included, orchestrator cost not",
    )
    expect(C.partlyPricedHarness(3)).toBe(
      "3 harness runs partly priced — sub-agent costs included, orchestrator cost not",
    )
  })

  it("names unpriced sub-agents inside the unrated disclosure (D-268-25)", () => {
    expect(C.unpricedSubagents(1)).toBe(
      "1 sub-agent run inside rated runs has no rate either, so its tokens are not in the total.",
    )
    expect(C.unpricedSubagents(3)).toBe(
      "3 sub-agent runs inside rated runs have no rate either, so their tokens are not in the total.",
    )
  })

  it("maps the Time chip to the window words", () => {
    expect(windowLabel("today")).toBe("Today")
    expect(windowLabel("7d")).toBe("Last 7D")
    expect(windowLabel("30d")).toBe("Last 30D")
    expect(windowLabel("all")).toBe("All Time")
  })

  it("carries no `continued` tag (D-268-24: dropped, it has no data source)", () => {
    expect(JSON.stringify(Object.keys(C))).not.toMatch(/continu/i)
  })
})
