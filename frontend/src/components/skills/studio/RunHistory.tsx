// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 03 Task 2 (PANEL-01 / EVAL-03) — RunHistory.
// Phase 137.1 Plan 08 Task 3 (EVAL-05 / 058-A + 059-A) — matrix grouped card +
// determinate unit bar.
// Phase 137.1 Plan 09 Task 1 (EVAL-05b / 058-A / D-07 + D-08) — the matrix card's
// aggregation FOOTER (per-config mean±σ + Δ skill-lift + deterministic analyst notes,
// rendered VERBATIM from the Plan 07 aggregate endpoint).
//
// The 055-B "expandable rows" run list — the reading surface for a skill's eval
// history. Each row is provider logo (048 @lobehub/icons map) + model + version
// binding + an HONEST rollup; clicking expands it IN PLACE to the per-case bodies.
// Pure presentational + controlled: EvalsTab (Plan 05) owns per-row expansion state
// and the data maps; every input is a prop. (The matrix card owns its OWN collapse
// locally — a resting-history anti-flood concern, not run-expansion state.)
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
// 058-A (EVAL-05b / D-05): runs sharing a `matrix_group_id` collapse into ONE
// grouped matrix card whose N sub-rows ARE the SAME 055-B RunRow (reused, never
// forked). A collapsed matrix occupies ONE resting row (anti-flood). Exactly ONE
// sub-row carries the "▣ feeds gate" chip, rendered off the SERVER `feeds_gate` flag
// (T-137.1-U1 — a label on data, never a client-side gate recomputation), and the
// card header states the gate semantics ONCE. The aggregation FOOTER (Plan 09) renders
// below the sub-rows AT FINALIZE only — per-config mean±σ + Δ + deterministic analyst
// notes, ALL echoed verbatim from the Plan 07 endpoint (no client stats, T-137.1-U2).
//
// 059-A (EVAL-05c): a RUNNING row carries a thin DETERMINATE unit bar —
// total = case_count*2 + 1 (2 arms/case + 1 judge unit that completes at finalize);
// done = the finished units in the live map. Pure FE math off the existing live
// events (no backend progress event). It scales to ANY case count (no segmented
// pips) and shows NO mid-run verdicts — the bar counts units, it never renders
// pass/fail.
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
import { useEffect, useState } from "react"
import { Bot, RotateCw, Sparkles } from "lucide-react"
import { providerLogo } from "@/lib/providerLogo"
import { getEvalAggregate } from "@/lib/api"
import type { EvalAggregate, EvalResult, EvalRun, TestCase } from "@/types"
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
  /** `${testCaseId}:${variant}` → arm progress status, for the single live run. */
  liveByCase: Record<string, string>
  /** 137.1 (058-A): run_id → its own live map, so N parallel matrix arms each render
   *  their own progress. A run resolves `liveByRun[run.id] ?? liveByCase`, so the
   *  single-run path (no liveByRun) is byte-unchanged. */
  liveByRun?: Record<string, Record<string, string>>
  onRate: (resultId: string, choice: "up" | "down" | null) => void
  onRerun: (runId: string) => void
  onProposeFromRun: (runId: string) => void
}

// The shared per-row context forwarded identically to every RunRow (top-level rows
// AND matrix sub-rows) so the row renderer is reused, never forked.
interface RowContext {
  expandedRunId: string | null
  onToggleExpand: (runId: string) => void
  resultsByRun: Record<string, EvalResult[]>
  casesById: Record<string, TestCase>
  liveByCase: Record<string, string>
  liveByRun?: Record<string, Record<string, string>>
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

// 059-A determinate unit math — units = cases × 2 arms + 1 judge step. `done` counts
// the settled units in the live map (started-but-not-running/queued); the judge unit
// completes only at finalize, so a running bar never reads 100% and never shows a
// verdict. Pure FE math off the existing per-arm events.
function unitProgress(run: EvalRun, live: Record<string, string>) {
  const total = run.case_count * 2 + 1
  const done = Object.values(live).filter(
    (v) => v && v !== "running" && v !== "queued",
  ).length
  const startedCases = new Set(Object.keys(live).map((k) => k.split(":")[0])).size
  const runningEntry = Object.entries(live).find(([, v]) => v === "running")
  const currentArm = runningEntry ? runningEntry[0].split(":")[1] : ""
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  const caseLabel = Math.min(startedCases, run.case_count)
  const caption = `case ${caseLabel}/${run.case_count}${
    currentArm ? ` · ${currentArm}` : ""
  } · ${done}/${total} · ${pct}%`
  return { total, done, pct, caption }
}

// ── The 055-B run row — the ONE renderer used for both top-level rows and matrix
//    sub-rows (top-level so its local scope is stable across re-renders). ──
function RunRow({ run, ctx }: { run: EvalRun; ctx: RowContext }) {
  const Mark = providerLogo(run.provider)
  const expanded = ctx.expandedRunId === run.id
  const isRunning = run.status === "running"
  const isInterrupted = run.status === "interrupted"
  // Per-run live map: a matrix arm has its own bucket; the single run falls back to
  // the shared liveByCase (so the single-run path is unchanged).
  const live = ctx.liveByRun?.[run.id] ?? ctx.liveByCase
  const somethingBelow = expanded || isRunning
  const bar = isRunning ? unitProgress(run, live) : null

  // The expanded body for a running run: live per-arm progress, NO verdicts.
  function renderLive() {
    const entries = Object.entries(live)
    return (
      <div data-testid="run-live" className="flex flex-col gap-2 pt-2">
        <ul className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          {entries.length === 0 && <li>Starting…</li>}
          {entries.map(([key, status]) => {
            const [tcId, variant] = key.split(":")
            const tc = ctx.casesById[tcId]
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
  function renderInterrupted() {
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
              onClick={() => ctx.onRerun(run.id)}
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
  function renderCases() {
    const results = ctx.resultsByRun[run.id] ?? []
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
              testCase={ctx.casesById[tcId] ?? null}
              results={caseResults}
              onRate={ctx.onRate}
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
              onClick={() => ctx.onProposeFromRun(run.id)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Sparkles className="h-3 w-3" /> Propose an improvement?
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid={`run-row-${run.id}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => ctx.onToggleExpand(run.id)}
        className={
          "flex w-full items-center gap-2.5 border border-border/40 bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 " +
          (somethingBelow ? "rounded-t-md" : "rounded-md")
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
        {run.feeds_gate && (
          <span
            data-testid="feeds-gate-chip"
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary"
          >
            <span aria-hidden>▣</span> feeds gate
          </span>
        )}
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

      {/* 059-A determinate unit bar — on the running row itself (not gated on expand). */}
      {bar && (
        <div
          data-testid="determinate-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={bar.total}
          aria-valuenow={bar.done}
          aria-label="eval progress"
          className={
            "flex flex-col gap-1 border-x border-border/40 bg-background px-3 pb-1.5 " +
            (expanded ? "" : "rounded-b-md border-b")
          }
        >
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent-violet transition-all"
              style={{ width: `${bar.pct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/70">{bar.caption}</span>
        </div>
      )}

      {expanded && (
        <div className="rounded-b-md border border-t-0 border-border/40 bg-muted/10 px-3 pb-3">
          {isRunning ? renderLive() : isInterrupted ? renderInterrupted() : renderCases()}
        </div>
      )}
    </div>
  )
}

// ── 058-A aggregation FOOTER (Plan 09 / D-07 + D-08). Per-config mean±σ + a Δ
//    skill-lift column + deterministic analyst notes — ALL rendered VERBATIM from the
//    Plan 07 `getEvalAggregate` endpoint. The component computes NO statistics: it
//    echoes the server `with_mean` / `with_stddev` / `delta` / `analyst_notes`. A
//    spread (σ) renders ONLY when the server provides `with_stddev` (run_count >= 2, the
//    server's honest floor); a single-run config reads "first run — no spread yet"
//    (T-137.1-U2 spread honesty). The notes are the server's fixed-phrasing rows (D-08 —
//    never LLM prose, never client-derived). A failed fetch renders nothing — the footer
//    is additive and never blocks the run rows above it. ──
function MatrixFooter({ skillId }: { skillId: string }) {
  const [agg, setAgg] = useState<EvalAggregate | null>(null)

  useEffect(() => {
    let cancelled = false
    getEvalAggregate(skillId)
      .then((a) => {
        if (!cancelled) setAgg(a)
      })
      .catch(() => {
        /* additive footer — a failed aggregate never blocks the run rows */
      })
    return () => {
      cancelled = true
    }
  }, [skillId])

  if (!agg) return null

  return (
    <div
      data-testid="matrix-aggregation-footer"
      className="mt-1 flex flex-col gap-2 border-t border-primary/20 pt-2"
    >
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
        Aggregation · per config, from run history
      </p>
      {agg.configs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/80">
          Aggregation appears once runs finish — spread accumulates from run history.
        </p>
      ) : (
        agg.configs.map((c) => {
          const Mark = providerLogo(c.provider)
          // VERBATIM from the server — no client stats. The explicit +/− sign and
          // toFixed are DISPLAY formatting of the server `delta`, not a computation.
          const deltaTxt = c.delta >= 0 ? `+${c.delta.toFixed(2)}` : c.delta.toFixed(2)
          return (
            <div
              key={`${c.provider}:${c.model}`}
              data-testid="agg-config"
              className="flex flex-col gap-1 rounded-md border border-border/30 bg-background/40 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2">
                {Mark ? (
                  <Mark size={13} />
                ) : (
                  <Bot aria-hidden className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-[11px] font-semibold text-foreground">{c.model}</span>
                <span className="font-mono text-[9px] text-muted-foreground/60">
                  {c.run_count} {c.run_count === 1 ? "run" : "runs"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
                <span>
                  mean <span className="text-foreground">{c.with_mean.toFixed(2)}</span>
                  {c.with_stddev != null ? (
                    <>
                      {" "}
                      ± <span className="text-foreground">{c.with_stddev.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="italic text-muted-foreground/70">
                      {" "}
                      · first run — no spread yet
                    </span>
                  )}
                </span>
                <span>
                  Δ <span className="text-foreground">{deltaTxt}</span> skill lift
                </span>
              </div>
              {c.analyst_notes.length > 0 && (
                <ul className="flex flex-col gap-0.5 pt-0.5">
                  {c.analyst_notes.map((note, i) => (
                    <li
                      key={`${c.provider}:${c.model}:${i}`}
                      data-testid="analyst-note"
                      className="flex items-start gap-1 text-[10px] leading-relaxed text-muted-foreground/90"
                    >
                      <span aria-hidden className="text-muted-foreground/50">
                        ◈
                      </span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── 058-A: the grouped matrix card. Collapsed = ONE resting row (anti-flood); the
//    card owns its own local collapse (defaults open while any arm streams). Its
//    sub-rows are the SAME RunRow — reused, never forked. ──
function MatrixCard({ groupId, arms, ctx }: { groupId: string; arms: EvalRun[]; ctx: RowContext }) {
  const anyRunning = arms.some((a) => a.status === "running")
  const [open, setOpen] = useState(anyRunning)
  const n = arms.length
  const m = arms[0]?.case_count ?? 0
  // The skill under eval (all arms share it) — the aggregation footer's fetch key.
  const skillId = arms[0]?.skill_id
  // The gate-feeder arm (server-flagged); its provider is named ONCE in the header.
  const gateArm = arms.find((a) => a.feeds_gate)
  const gateProvider = gateArm?.provider ?? "the selected provider"

  return (
    <div
      data-testid={`matrix-card-${groupId}`}
      className="rounded-md border border-primary/30 bg-primary/[0.04]"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span aria-hidden className="text-sm text-primary">
          ⧉
        </span>
        <span className="text-xs font-semibold text-foreground">Matrix run</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          · {n} configs · {m} cases
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold">
          {anyRunning ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-primary">running</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {n} {n === 1 ? "arm" : "arms"}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <p data-testid="matrix-gate-semantics" className="text-[11px] text-muted-foreground/80">
            gate reads{" "}
            <span className="font-semibold text-foreground">{gateProvider}</span> only —
            other arms are analysis-only and never flip the publish gate.
          </p>
          <div className="flex flex-col gap-2">
            {arms.map((arm) => (
              <RunRow key={arm.id} run={arm} ctx={ctx} />
            ))}
          </div>
          {/* 058-A aggregation FOOTER (Plan 09) — per-config mean±σ/Δ + analyst notes,
              VERBATIM from the Plan 07 endpoint. Only AT FINALIZE (no arm running):
              aggregation lands at finalize, never mid-run (058 design lock). */}
          {!anyRunning && skillId && <MatrixFooter skillId={skillId} />}
        </div>
      )}
    </div>
  )
}

export function RunHistory({
  runs,
  casesById,
  expandedRunId,
  onToggleExpand,
  resultsByRun,
  liveByCase,
  liveByRun,
  onRate,
  onRerun,
  onProposeFromRun,
}: Props) {
  // Newest-first (defensive — the container fetches newest-first, but a running run
  // must sit on top regardless of input order).
  const ordered = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at))

  const ctx: RowContext = {
    expandedRunId,
    onToggleExpand,
    resultsByRun,
    casesById,
    liveByCase,
    liveByRun,
    onRate,
    onRerun,
    onProposeFromRun,
  }

  // Group by matrix_group_id (058-A): a group renders ONCE, at its newest arm's
  // position; single runs (null group) render as top-level rows. Order preserved.
  type Item =
    | { kind: "single"; run: EvalRun }
    | { kind: "group"; groupId: string; arms: EvalRun[] }
  const items: Item[] = []
  const seenGroups = new Set<string>()
  for (const run of ordered) {
    const gid = run.matrix_group_id
    if (!gid) {
      items.push({ kind: "single", run })
      continue
    }
    if (seenGroups.has(gid)) continue
    seenGroups.add(gid)
    items.push({ kind: "group", groupId: gid, arms: ordered.filter((r) => r.matrix_group_id === gid) })
  }

  if (ordered.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No eval runs yet — run one above.</p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) =>
        item.kind === "single" ? (
          <RunRow key={item.run.id} run={item.run} ctx={ctx} />
        ) : (
          <MatrixCard key={item.groupId} groupId={item.groupId} arms={item.arms} ctx={ctx} />
        ),
      )}
    </div>
  )
}
