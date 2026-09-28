/**
 * Phase 268 (UI-SPEC §5.7-§5.8, D-268-10) — "Spend by Expert", its reconciliation footer, and
 * the ledger's Expert cell + sub-agent tag.
 *
 * ⛔ THE TABLE DOES NOT FOLLOW THE EXPERT FILTER. It is the navigator: it always lists every line
 * for the window (the server computes them with the filter OFF) and highlights the selected one.
 * Its header says so, which is why the page's statement line says "the cards, charts and
 * ledger" follow the filter and never "all cards" (§9-D7).
 *
 * ⛔ THE FOOTER IS AN INDEPENDENT CHECK, NOT A RESTATEMENT. The client sums the lines the server
 * sent and compares them with the server's window total in INTEGER TEN-THOUSANDTHS, so a float
 * residue (0.9 + 0.2 + … = 3.3000000000000003) can never raise a false alarm and a real 0.0001
 * difference can never hide. When it fails it says so, in rose, as an alert.
 *
 * Light-theme contract (§4.3): every hue text step is a light/dark PAIR on ONE source line —
 * `expertThemeContrast.test.tsx` fences this file line by line.
 */
import React from "react"
import { CheckCircle2, CornerDownRight, Sparkles, XCircle } from "lucide-react"
import type { ExpertSpendLine, SpendRunItem } from "@/types/spend"
import { EXPERT_SPEND_COPY as C } from "./expertSpendCopy"
import { expertLineLabel } from "./ExpertFilterPills"

const TEN_THOUSANDTHS = 1e4

function toUnits(usd: number | null | undefined): number {
  return Math.round((usd ?? 0) * TEN_THOUSANDTHS)
}

function fromUnits(units: number): string {
  return (units / TEN_THOUSANDTHS).toFixed(4)
}

/** The shipped KPI token formatter (`AdminSpendPage` Tokens Counted). */
export function formatTokens(n: number): string {
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${(n / 1_000).toFixed(1)}k`
}

export type ReconResult =
  | { ok: true; lines: number; total: string; runs: number }
  | { ok: false; kind: "usd"; sum: string; total: string; diff: string }
  | { ok: false; kind: "runs"; counted: number; window: number }

/**
 * Do the lines add up to the window? USD first (the figure an operator quotes), then runs.
 * An unpriced line (`spendUsd: null`) adds $0 — exactly as the server's total excludes it.
 */
export function reconcileExpertLines(
  lines: ExpertSpendLine[],
  windowTotalUsd: number | null,
  windowRunCount: number,
): ReconResult {
  const sumUnits = lines.reduce((acc, l) => acc + toUnits(l.spendUsd), 0)
  const totalUnits = toUnits(windowTotalUsd)
  if (sumUnits !== totalUnits) {
    return {
      ok: false,
      kind: "usd",
      sum: fromUnits(sumUnits),
      total: fromUnits(totalUnits),
      diff: fromUnits(Math.abs(totalUnits - sumUnits)),
    }
  }
  const counted = lines.reduce((acc, l) => acc + l.runCount, 0)
  if (counted !== windowRunCount) {
    return { ok: false, kind: "runs", counted, window: windowRunCount }
  }
  return { ok: true, lines: lines.length, total: fromUnits(totalUnits), runs: windowRunCount }
}

interface ExpertSpendCardProps {
  state: "ready" | "loading" | "failed"
  /** The server's lines for the window — unfiltered whatever is selected. */
  lines: ExpertSpendLine[]
  windowTotalUsd: number | null
  windowRunCount: number
  windowLabel: string
  selected: string | null
  selectedLabel: string | null
  onSelect: (key: string | null) => void
}

function ModeTag({ mode }: { mode: string | null }) {
  if (!mode || !C.modeTag[mode]) return null
  return (
    <span className="ml-1.5 text-[11px] px-1.5 py-px rounded border border-border/60 text-muted-foreground font-normal not-italic">
      {C.modeTag[mode]}
    </span>
  )
}

function NameCell({ line }: { line: ExpertSpendLine }) {
  if (line.key === "none" || line.key === "unrecorded") {
    return <span className="italic text-muted-foreground">{expertLineLabel(line)}</span>
  }
  if (line.deleted || !line.name) {
    return (
      <>
        {C.deletedExpert}{" "}
        <span className="font-mono text-muted-foreground">{line.key.slice(0, 8)}</span>
      </>
    )
  }
  return <>{line.name}</>
}

export const ExpertSpendCard: React.FC<ExpertSpendCardProps> = ({
  state,
  lines,
  windowTotalUsd,
  windowRunCount,
  windowLabel,
  selected,
  selectedLabel,
  onSelect,
}) => {
  // A selected Expert with no runs in this window still gets a $0.0000 line (§5.6). It is the
  // page's selection, not a server line, so the footer does not count it.
  const rows: ExpertSpendLine[] = [...lines]
  if (
    selected &&
    selected !== "none" &&
    selected !== "unrecorded" &&
    !lines.some((l) => l.key === selected)
  ) {
    const zero: ExpertSpendLine = {
      key: selected,
      expertId: selected,
      name: selectedLabel,
      deleted: false,
      scopeMode: null,
      runCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      spendUsd: 0,
      unratedCount: 0,
    }
    const firstFixed = rows.findIndex((l) => l.key === "none" || l.key === "unrecorded")
    rows.splice(firstFixed === -1 ? rows.length : firstFixed, 0, zero)
  }

  const totalUnits = toUnits(windowTotalUsd)
  const recon = reconcileExpertLines(lines, windowTotalUsd, windowRunCount)

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm" data-testid="expert-spend-card">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />
          {C.cardHeading}
        </h2>
        <span className="text-[11px] font-mono text-muted-foreground">{C.cardRightLabel(windowLabel)}</span>
      </div>

      {state === "failed" ? (
        <p className="text-xs font-mono text-amber-700 dark:text-amber-300">{C.cardFailed}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse" data-testid="expert-spend-table">
              <thead>
                <tr className="border-b border-border/40 font-mono text-[11px] text-muted-foreground">
                  {C.headers.map((h, i) => (
                    <th key={h} className={`py-2 px-3 font-medium ${i >= 1 && i <= 3 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {state === "loading" ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground font-mono">
                      {C.cardLoading}
                    </td>
                  </tr>
                ) : (
                  <>
                    {rows.map((line) => {
                      const on = selected === line.key
                      const cellSel = on ? "bg-indigo-500/10 dark:bg-indigo-500/[0.18]" : ""
                      const unpriced = line.spendUsd === null && line.runCount > 0
                      const share = totalUnits > 0 ? Math.min(100, (toUnits(line.spendUsd) / totalUnits) * 100) : 0
                      return (
                        <tr key={line.key} data-testid={`expert-spend-row-${line.key}`}>
                          <td className={`py-2 px-3 ${cellSel}`}>
                            <button
                              type="button"
                              aria-pressed={on}
                              onClick={() => onSelect(on ? null : line.key)}
                              className="text-left text-foreground hover:underline min-h-[44px] sm:min-h-0"
                            >
                              <NameCell line={line} />
                            </button>
                            {!line.deleted && <ModeTag mode={line.scopeMode} />}
                            {line.unratedCount > 0 && (
                              <span className="ml-1.5 text-amber-700 dark:text-amber-300 border border-amber-600/40 dark:border-amber-500/30 bg-amber-500/10 rounded-full px-2 text-[11px]">
                                {C.unratedChip(line.unratedCount)}
                              </span>
                            )}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono ${cellSel}`}>{line.runCount}</td>
                          <td className={`py-2 px-3 text-right font-mono ${cellSel}`}>
                            {formatTokens(line.inputTokens + line.outputTokens)}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono ${cellSel}`}>
                            {unpriced ? "—" : `$${fromUnits(toUnits(line.spendUsd))}`}
                          </td>
                          <td className={`py-2 px-3 ${cellSel}`}>
                            <div className="h-1.5 rounded-full bg-background min-w-[80px] overflow-hidden" aria-hidden="true">
                              <div
                                className={`h-full ${line.key === "none" ? "bg-muted-foreground/60" : "bg-indigo-600 dark:bg-indigo-400"}`}
                                style={{ width: `${share}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="border-t border-border" data-testid="expert-spend-row-total">
                      <td className="py-2 px-3 font-semibold text-foreground">{C.orgTotal}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{windowRunCount}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">
                        {formatTokens(lines.reduce((a, l) => a + l.inputTokens + l.outputTokens, 0))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">${fromUnits(totalUnits)}</td>
                      <td className="py-2 px-3" />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {state === "ready" && (
            <>
              {recon.ok ? (
                <p
                  className="mt-3 text-[11px] font-mono flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"
                  data-testid="expert-spend-recon"
                >
                  <CheckCircle2 className="h-3 w-3 flex-none" aria-hidden="true" />
                  {C.reconOk(recon.lines, recon.total, recon.runs)}
                </p>
              ) : (
                <p
                  role="alert"
                  className="mt-3 text-[11px] font-mono flex items-center gap-1.5 text-rose-700 dark:text-rose-300"
                  data-testid="expert-spend-recon"
                >
                  <XCircle className="h-3 w-3 flex-none" aria-hidden="true" />
                  {recon.kind === "usd"
                    ? C.reconUsdFail(recon.sum, recon.total, recon.diff)
                    : C.reconRunsFail(recon.counted, recon.window)}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">{C.ruleLine}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}

type LedgerAttribution = Pick<SpendRunItem, "expertId" | "expertName" | "expertDeleted" | "expertAttributed">

const LEDGER_PILL = "rounded-full px-2 text-[11px] inline-flex items-center gap-1"
const LEDGER_DASHED = `${LEDGER_PILL} border border-dashed border-border bg-transparent text-muted-foreground italic`

/** The ledger's Expert column (§5.8). Three words that must never merge: No Expert, Deleted
 * Expert, Not recorded — each is a different fact about the row. */
export const LedgerExpertCell: React.FC<{ run: LedgerAttribution }> = ({ run }) => {
  if (!run.expertAttributed) {
    return (
      <span className="text-[11px] text-muted-foreground" data-testid="ledger-expert-cell">
        {C.ledgerNotRecorded}
      </span>
    )
  }
  if (run.expertId === null) {
    return (
      <span className={LEDGER_DASHED} data-testid="ledger-expert-cell">
        {C.noExpert}
      </span>
    )
  }
  if (run.expertDeleted || !run.expertName) {
    return (
      <span className={LEDGER_DASHED} data-testid="ledger-expert-cell">
        {C.deletedExpert}
      </span>
    )
  }
  return (
    <span
      className={`${LEDGER_PILL} bg-violet-500/10 dark:bg-violet-500/15 border border-violet-600/40 dark:border-violet-500/35 text-violet-700 dark:text-violet-200`}
      title={run.expertName}
      data-testid="ledger-expert-cell"
    >
      <Sparkles className="h-3 w-3 flex-none" aria-hidden="true" />
      <span className="truncate max-w-[16ch]">{run.expertName}</span>
    </span>
  )
}

/** D-268-09: the row's tokens now include its sub-agents', and this tag is what says why. */
export const SubagentTag: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null
  return (
    <span className="text-[11px] px-1.5 rounded border border-border/40 text-muted-foreground inline-flex items-center gap-1">
      <CornerDownRight className="h-3 w-3" aria-hidden="true" />
      {C.subagentTag(count)}
    </span>
  )
}
