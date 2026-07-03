// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 03 Task 2 (PANEL-01 / EVAL-03) — RunHistory.
//
// The 055-B "expandable rows" run list — the reading surface for a skill's eval
// history. Each row is provider logo (048 @lobehub/icons map) + model + version
// binding + an HONEST rollup; clicking expands it IN PLACE to the per-case bodies.
// Pure presentational + controlled: EvalsTab (Plan 05) owns expansion state and the
// data maps; every input is a prop.
//
// D-04 honesty locks (ported from SkillEvalSection :631-637 + the sketch 055 states):
//   - Rollup renders passed/measured verbatim + "· N not measured" when
//     measured_count < case_count. not_measured/judge_error are never counted or
//     colored as fail.
//   - status="interrupted" → an honest banner + a re-run affordance, never a silent
//     failure (the 134/135 lesson).
//   - A running run is the top row; it shows live per-arm progress from `liveByCase`
//     with NO mid-run pass/fail verdict (verdicts land only at finalize, T-137-04).
//
// D-11: on expand the run's results are grouped by test_case_id and each case is
// fed `casesById[test_case_id] ?? null` so RunCaseDetail renders PROMPT-FIRST — the
// uuid never appears as a label (closes BUG-260701-02).
//
// D-09: a finished run with >= 1 failed measured case surfaces an inline "Propose an
// improvement?" nudge pointing at the existing propose action (onProposeFromRun).
//
// T-137-03 (info disclosure): the component renders only the owner-scoped
// runs/results/cases it is handed; it constructs no ids and echoes server responses
// verbatim (a missing case renders RunCaseDetail's neutral fallback, never a leaked id).
// ─────────────────────────────────────────────────────────────────────────────
import { Bot, RotateCw, Sparkles } from "lucide-react"
import { providerLogo } from "@/lib/providerLogo"
import type { EvalResult, EvalRun, TestCase } from "@/types"
import { RunCaseDetail } from "./RunCaseDetail"

interface Props {
  /** The skill's eval runs (rendered newest-first). */
  runs: EvalRun[]
  /** test_case_id → TestCase, the container's map for prompt-first rendering (D-11). */
  casesById: Record<string, TestCase>
  /** The currently-expanded run id (controlled by the container). */
  expandedRunId: string | null
  onToggleExpand: (runId: string) => void
  /** run_id → the run's durable EvalResult[] (both arms per case). */
  resultsByRun: Record<string, EvalResult[]>
  /** `${testCaseId}:${variant}` → arm progress status, for the live (running) run. */
  liveByCase: Record<string, string>
  onRate: (resultId: string, choice: "up" | "down" | null) => void
  onRerun: (runId: string) => void
  onProposeFromRun: (runId: string) => void
}

// The honest rollup line (SkillEvalSection :631-637): passed/measured verbatim +
// "· N not measured" when fewer with-skill cases were measured than exist. null when
// the durable rollup has not landed (old pre-081 rows / error paths).
function rollupSummary(run: EvalRun): string | null {
  if (run.measured_count == null) return null
  const passed = run.passed_count ?? 0
  let txt = `${passed}/${run.measured_count} passed`
  if (run.measured_count < run.case_count) {
    txt += ` · ${run.case_count - run.measured_count} not measured`
  }
  return txt
}

// Rollup color: any measured case failed → danger; else some case went unmeasured →
// amber (mixed); else all measured passed → success. Neutral states are never red.
function rollupTone(run: EvalRun): string {
  const passed = run.passed_count ?? 0
  const measured = run.measured_count ?? 0
  if (measured > 0 && passed < measured) return "text-destructive"
  if (run.measured_count != null && run.measured_count < run.case_count) {
    return "text-amber-600 dark:text-amber-400"
  }
  return "text-emerald-500"
}

export function RunHistory({
  runs,
  casesById,
  expandedRunId,
  onToggleExpand,
  resultsByRun,
  liveByCase,
  onRate,
  onRerun,
  onProposeFromRun,
}: Props) {
  // Newest-first (defensive — the container fetches newest-first, but a running run
  // must sit on top regardless of input order).
  const ordered = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at))

  // The expanded body for a running run: live per-arm progress, NO verdicts.
  function renderLive() {
    const entries = Object.entries(liveByCase)
    return (
      <div data-testid="run-live" className="flex flex-col gap-2 pt-2">
        <ul className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          {entries.length === 0 && <li>Starting…</li>}
          {entries.map(([key, status]) => {
            const [tcId, variant] = key.split(":")
            const tc = casesById[tcId]
            return (
              <li key={key} className="truncate" title={tc?.prompt}>
                {tc ? tc.prompt : "case"} · {variant} → {status}
              </li>
            )
          })}
        </ul>
        <p className="text-[11px] text-muted-foreground/80">
          Verdicts land when the run finalizes — no mid-run pass/fail is shown.
        </p>
      </div>
    )
  }

  // The expanded body for an interrupted run: honest banner + re-run.
  function renderInterrupted(run: EvalRun) {
    return (
      <div
        data-testid="run-interrupted"
        className="mt-2 flex items-start gap-2 rounded-md border border-border/40 bg-muted/30 p-3 text-xs text-muted-foreground"
      >
        <span aria-hidden>⏸</span>
        <div className="flex flex-col gap-2">
          <p>
            <span className="font-semibold text-foreground">This run was interrupted</span>{" "}
            (the backend restarted mid-run). No cases were measured — nothing was
            counted, nothing was fabricated.
          </p>
          <div>
            <button
              type="button"
              data-testid="run-rerun"
              onClick={() => onRerun(run.id)}
              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-surface px-2.5 py-1 text-xs hover:bg-accent"
            >
              <RotateCw className="h-3 w-3" /> Re-run
            </button>
          </div>
        </div>
      </div>
    )
  }

  // The expanded body for a finished run: one RunCaseDetail per case + D-09 nudge.
  function renderCases(run: EvalRun) {
    const results = resultsByRun[run.id] ?? []
    const byCase = new Map<string, EvalResult[]>()
    for (const r of results) {
      const arr = byCase.get(r.test_case_id) ?? []
      arr.push(r)
      byCase.set(r.test_case_id, arr)
    }
    // A "failed measured case" = a with-skill arm the judge GRADED as a fail.
    const hasFailedMeasured = results.some(
      (r) => r.verdict_state === "graded" && r.verdict_passed === false,
    )
    const judge = results.find((r) => r.judge_model)?.judge_model
    return (
      <div data-testid="run-cases" className="flex flex-col gap-1 pb-1">
        <p className="pt-2 font-mono text-[10px] text-muted-foreground/70">
          {judge ? `judge ${judge} · ` : ""}
          {new Date(run.created_at).toLocaleDateString()}
        </p>
        {byCase.size === 0 ? (
          <p className="pt-1 text-xs text-muted-foreground">No case results.</p>
        ) : (
          Array.from(byCase.entries()).map(([tcId, caseResults]) => (
            <RunCaseDetail
              key={tcId}
              testCase={casesById[tcId] ?? null}
              results={caseResults}
              onRate={onRate}
            />
          ))
        )}
        {hasFailedMeasured && (
          <div
            data-testid="run-propose-nudge"
            className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5"
          >
            <p className="text-xs text-muted-foreground">A case failed on this run.</p>
            <button
              type="button"
              data-testid="run-propose"
              onClick={() => onProposeFromRun(run.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" /> Propose an improvement?
            </button>
          </div>
        )}
      </div>
    )
  }

  if (ordered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No eval runs yet — run one above.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((run) => {
        const Mark = providerLogo(run.provider)
        const expanded = expandedRunId === run.id
        const isRunning = run.status === "running"
        const isInterrupted = run.status === "interrupted"
        return (
          <div key={run.id} data-testid={`run-row-${run.id}`}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => onToggleExpand(run.id)}
              className={
                "flex w-full items-center gap-2.5 border border-border/40 bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 " +
                (expanded ? "rounded-t-md" : "rounded-md")
              }
            >
              {Mark ? (
                <Mark size={16} />
              ) : (
                <Bot data-testid="provider-fallback" aria-hidden className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-xs font-semibold text-foreground">{run.model}</span>
              <span className="font-mono text-[10px] text-muted-foreground/70">
                ver {run.skill_version_id.slice(0, 8)}
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold">
                {isRunning ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    <span className="text-primary">running</span>
                  </>
                ) : isInterrupted ? (
                  <span className="text-muted-foreground">interrupted</span>
                ) : (
                  <span className={rollupTone(run)}>{rollupSummary(run) ?? run.status}</span>
                )}
              </span>
            </button>
            {expanded && (
              <div className="rounded-b-md border border-t-0 border-border/40 bg-muted/10 px-3 pb-3">
                {isRunning
                  ? renderLive()
                  : isInterrupted
                    ? renderInterrupted(run)
                    : renderCases(run)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
