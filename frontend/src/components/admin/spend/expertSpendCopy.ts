/**
 * Phase 268 (METER-08, UI-SPEC §7.4) — every /admin/spend Expert word, ONE home.
 * Pinned by `__tests__/expertSpendCopy.test.ts`. Em dash U+2014, middle dot U+00B7.
 * ⛔ No paused-then-resumed ledger tag: every such shell looks identical in `runs`, so it has no
 *    data source (D-268-24). The only word for it here is inside the rule line.
 */

export type SpendWindow = "today" | "7d" | "30d" | "all"

const WINDOW_LABELS: Record<SpendWindow, string> = {
  today: "Today",
  "7d": "Last 7D",
  "30d": "Last 30D",
  all: "All Time",
}

/** The Time chip as the statement line and card label say it. */
export function windowLabel(w: SpendWindow): string {
  return WINDOW_LABELS[w]
}

export const EXPERT_SPEND_COPY = {
  ribbonLabel: "Expert:",
  all: "All",
  noExpert: "No Expert",
  notRecorded: "Not recorded (before 268)",
  deletedExpert: "Deleted Expert",
  more: "More",
  clear: "clear",
  showing: "Showing",
  allRuns: "all runs",
  followsFilter: "the cards, charts and ledger follow this filter",
  statementAll: (w: string): string => `Showing all runs · ${w}`,
  statementFiltered: (name: string, w: string): string =>
    `Showing ${name} · ${w} · the cards, charts and ledger follow this filter · clear`,
  kpiFiltered: (name: string): string => `Spend · ${name}`,
  chartSuffix: (name: string): string => `· ${name}`,
  cardHeading: "Spend by Expert",
  cardRightLabel: (w: string): string => `every Expert · ${w} · not filtered`,
  headers: ["Expert", "Runs", "Tokens", "USD", "Share"] as const,
  modeTag: { biased: "Biased", restricted: "Restricted" } as Record<string, string>,
  unratedChip: (n: number): string => `${n} unrated`,
  orgTotal: "Org total",
  reconOk: (k: number, total: string, runs: number): string =>
    `✓ ${k} ${k === 1 ? "line" : "lines"} = $${total} = org total · ${runs} runs, 0 unattributed`,
  reconUsdFail: (sum: string, total: string, diff: string): string =>
    `✗ Lines sum to $${sum}; the org total is $${total} (a difference of $${diff}). This page is not hiding it.`,
  reconRunsFail: (counted: number, windowRuns: number): string =>
    `✗ Lines count ${counted} runs; the window has ${windowRuns}. ${windowRuns - counted} runs are unattributed.`,
  ruleLine:
    "A run counts toward the Expert active when it started. Sub-agent and continued runs count toward their parent run's Expert. Runs from before this was recorded show as Not recorded (before 268), never as No Expert.",
  cardLoading: "Loading…",
  cardFailed: "Spend by Expert unavailable — spend data did not load.",
  ledgerColumn: "Expert",
  ledgerNotRecorded: "Not recorded",
  subagentTag: (n: number): string => (n === 1 ? "incl. 1 sub-agent" : `incl. ${n} sub-agents`),
  ledgerHeaderChip: (name: string): string => `filtered to ${name}`,
  ledgerEmptyFiltered: (name: string, w: string): string =>
    `No runs for ${name} in ${w}. Its line in Spend by Expert reads $0.0000.`,
  unpricedSubagents: (n: number): string =>
    n === 1
      ? "1 sub-agent run inside rated runs has no rate either, so its tokens are not in the total."
      : `${n} sub-agent runs inside rated runs have no rate either, so their tokens are not in the total.`,
  subagentTile: {
    title: "Sub-agent tokens now counted",
    body: "A sub-agent's tokens now count toward the run that started it, and toward that run's Expert. Before Phase 268 they were left out, so totals that include sub-agent work read higher than they used to.",
    footer: 'Shown as "incl. N sub-agents" in the ledger below.',
  },
  handoffTile: {
    title: "Handoff summaries not metered",
    body: '"New chat with an Expert" writes a short summary of this chat with one model call. That call is not a run, so its tokens are in no total on this page.',
    footer: "Not metered yet",
  },
} as const
