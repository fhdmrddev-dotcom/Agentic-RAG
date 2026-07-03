// ─────────────────────────────────────────────────────────────────────────────
// Phase 137 Plan 05 Task 2 (PANEL-01) — the stateful Evals-tab container.
//
// This is the D-15 "lift state, re-skin render" core. The run/SSE/proposal/gate
// machinery is LIFTED VERBATIM IN LOGIC from SkillEvalSection (the battle-tested
// surface hardened across Phases 133/134/135) — attach()'s subscribeToRun handlers +
// the BUG-260702-03 bounded re-attach self-heal, loadReadout()'s durable getEvalRun
// fetch, the currentSkillRef/requestedSkill skill-switch guard (BUG-260701-02), the
// [skillId] reset/hydration effect, and every endpoint-then-refetch mutation handler.
// Rewriting that flow re-introduces the exact races already fixed; it is transcribed,
// not redesigned.
//
// EvalsTab OWNS the skill's test-case list (lifted from CaseEditor via onCasesChanged)
// so the run history can render prompt-first per-case detail (BUG-260701-02): it holds
// `cases`, clears it on skill switch, and derives caseCount (→ LifecycleStepper) +
// casesById (→ RunHistory → RunCaseDetail).
//
// Composition (D-08 / D-12 order): LifecycleStepper (top) → CaseEditor → RunBar
// (directly above history) → RunHistory (live run = top row) → ProposalCard (below).
// The provider/model picker state lives here so the selection persists across skills
// (D-12).
//
// Honesty locks preserved verbatim: onEvalComplete triggers loadReadout (the DB is
// authoritative — no mid-run verdicts, T-137-04); every mutation hits the owner-gated
// endpoint THEN re-fetches (never optimistic, T-137-04); the publish gate is passed to
// LifecycleStepper untouched — `met` is never recomputed here (T-137-01).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react"
import {
  getProviders,
  startEvalRun,
  getEvalRun,
  listEvalRuns,
  subscribeToRun,
  rateEvalResult,
  proposeImprovement,
  listProposals,
  getProposal,
  approveProposal,
  rejectProposal,
  rerunProposalReeval,
  forcePromoteProposal,
  getPublishGate,
} from "@/lib/api"
import type { EvalResult, EvalRun, SkillProposal, PublishGate, TestCase } from "@/types"
import { LifecycleStepper } from "./LifecycleStepper"
import { CaseEditor } from "./CaseEditor"
import { RunBar } from "./RunBar"
import { RunHistory } from "./RunHistory"
import { ProposalCard } from "./ProposalCard"

type Stage = "cases" | "eval" | "gate"

interface Props {
  skillId: string
  /** The live skill version number (supplied by the consumer, never derived here). */
  skillVersion: number
  /** Deep-link scroll handler threaded into the LifecycleStepper stage nodes. */
  onNavigateStage?: (stage: Stage) => void
}

// Live per-arm status keyed by `${testCaseId}:${variant}` — driven off the eval_*
// SSE events while a run streams (LIFTED from SkillEvalSection).
type LiveStatus = Record<string, string>

// LIFTED VERBATIM from SkillEvalSection :85-91 — pick the proposal to surface: the
// most-recently-updated one the user hasn't rejected.
function pickActiveProposal(list: SkillProposal[]): SkillProposal | null {
  if (list.length === 0) return null
  const latest = [...list].sort((a, b) =>
    (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at),
  )[0]
  return latest.status === "rejected" ? null : latest
}

export function EvalsTab({ skillId, skillVersion, onNavigateStage }: Props) {
  // ── Picker state (kept HERE so selection persists across skills — D-12). ──
  const [providers, setProviders] = useState<
    { id: string; name: string; models: string[] }[]
  >([])
  const [provider, setProvider] = useState<string>("")
  const [model, setModel] = useState<string>("")

  // ── Run / stream state (LIFTED from SkillEvalSection). ──
  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [live, setLive] = useState<LiveStatus>({})
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null)
  const [results, setResults] = useState<EvalResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // ── Proposal state (LIFTED — always the DB row, never optimistic). ──
  const [proposal, setProposal] = useState<SkillProposal | null>(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState<string | null>(null)

  // ── Publish gate (LIFTED — server-computed; `met` never recomputed here). ──
  const [publishGate, setPublishGate] = useState<PublishGate | null>(null)

  // ── 137-05: container-owned surfaces the leaves compose over. ──
  const [cases, setCases] = useState<TestCase[]>([]) // lifted from CaseEditor
  const [runs, setRuns] = useState<EvalRun[]>([]) // the eval-run history list
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  // Refs (LIFTED verbatim).
  const abortRef = useRef<AbortController | null>(null)
  const currentSkillRef = useRef(skillId)
  const reattachRef = useRef(0)
  const reEvalProposalIdRef = useRef<string | null>(null)
  // Tracks the running→false edge so we refresh the history when a run finalizes.
  const prevRunningRef = useRef(false)

  // Pull the durable readout from the DB (survives the Redis TTL). Guarded against a
  // skill switch (BUG-260701-02) — LIFTED VERBATIM from SkillEvalSection :183-198.
  async function loadReadout(rid: string) {
    const requestedSkill = skillId
    try {
      const { eval_run, eval_results } = await getEvalRun(requestedSkill, rid)
      if (currentSkillRef.current !== requestedSkill) return
      setEvalRun(eval_run)
      setResults(eval_results)
      const pid = reEvalProposalIdRef.current
      if (pid) void refetchProposal(pid)
    } catch (err) {
      if (currentSkillRef.current !== requestedSkill) return
      setError(err instanceof Error ? err.message : "Failed to load eval results.")
    }
  }

  // Attach the EXISTING run-stream client to an eval run_id (Pattern 3, no new stream
  // code) — LIFTED VERBATIM from SkillEvalSection :202-280, incl. the BUG-260702-03
  // bounded re-attach self-heal in onTerminal.
  function attach(rid: string) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRunId(rid)
    setRunning(true)

    void subscribeToRun(
      rid,
      "0",
      {
        onDelta: () => {},
        onDone: () => {},
        onEvalCaseStarted: ({ testCaseId, variant }) =>
          setLive((prev) => ({ ...prev, [`${testCaseId}:${variant}`]: "running" })),
        onEvalCaseDone: ({ testCaseId, variant, status }) =>
          setLive((prev) => ({ ...prev, [`${testCaseId}:${variant}`]: status })),
        onEvalVerdict: ({ testCaseId, variant, verdictState, verdictPassed }) =>
          setLive((prev) => {
            const key = `${testCaseId}:${variant}`
            const badge =
              verdictState === "graded" ? (verdictPassed ? "PASS" : "FAIL") : verdictState
            const base = (prev[key] ?? "done").split(" · ")[0]
            return { ...prev, [key]: `${base} · ${badge}` }
          }),
        onEvalComplete: () => {
          // Durable readout is authoritative; refresh from the DB (no mid-run verdicts).
          void loadReadout(rid)
        },
        onTerminal: async (kind, err) => {
          // BUG-260702-03 self-heal: a transient drop is NOT a run failure — probe the
          // durable readout and re-attach (bounded) if the run is still live.
          const transient =
            kind === "error" && /buffer_expired|redis_timeout|redis_error/.test(err ?? "")
          if (
            transient &&
            reattachRef.current < 20 &&
            !ctrl.signal.aborted &&
            currentSkillRef.current === skillId
          ) {
            reattachRef.current += 1
            try {
              const { eval_run, eval_results } = await getEvalRun(skillId, rid)
              if (currentSkillRef.current !== skillId) return
              setEvalRun(eval_run)
              setResults(eval_results)
              if (eval_run?.status === "running") {
                window.setTimeout(() => {
                  if (!ctrl.signal.aborted && currentSkillRef.current === skillId) {
                    attach(rid)
                  }
                }, 1000)
                return
              }
              setRunning(false)
              return
            } catch {
              /* probe failed — fall through to the standard terminal handling */
            }
          }
          setRunning(false)
          if (kind === "error") setError("Eval run ended with an error.")
          void loadReadout(rid)
        },
      },
      ctrl.signal,
    )
  }

  // Reconcile a proposal from the DB (never optimistic) — LIFTED VERBATIM :286-295.
  async function refetchProposal(pid: string) {
    const requestedSkill = skillId
    try {
      const p = await getProposal(requestedSkill, pid)
      if (currentSkillRef.current !== requestedSkill) return
      setProposal(p.status === "rejected" ? null : p)
    } catch {
      /* keep the last known card; the next action re-fetches from the DB */
    }
  }

  // If the proposal is mid-re-eval, reattach the shared readout — LIFTED :300-305.
  function reattachProposalReeval(p: SkillProposal | null) {
    if (p && p.status === "re_evaling" && p.re_eval_run_id) {
      reEvalProposalIdRef.current = p.id
      attach(p.re_eval_run_id)
    }
  }

  // Refresh the history list (owner-scoped). Guarded against a skill switch.
  async function refreshRuns() {
    const requestedSkill = skillId
    try {
      const list = await listEvalRuns(skillId)
      if (currentSkillRef.current !== requestedSkill) return
      setRuns(list)
    } catch {
      /* keep the last known list */
    }
  }

  // On [skillId]: reset run/proposal/gate/case/history state, then hydrate providers +
  // latest run (+reattach if running) + latest proposal (+reattach re-eval) + gate.
  // LIFTED from SkillEvalSection :311-388; provider/model deliberately preserved
  // across skills (D-12) via functional-init below, and the 137-05 case/history state
  // is cleared alongside the eval state.
  useEffect(() => {
    let cancelled = false
    currentSkillRef.current = skillId
    setRunId(null)
    setRunning(false)
    setLive({})
    setEvalRun(null)
    setResults([])
    setError(null)
    reattachRef.current = 0
    setProposal(null)
    setProposalLoading(false)
    setProposalError(null)
    reEvalProposalIdRef.current = null
    setPublishGate(null)
    // 137-05: clear the container-owned surfaces (no prior skill's cases/runs leak).
    setCases([])
    setRuns([])
    setExpandedRunId(null)

    async function init() {
      try {
        const p = await getProviders()
        if (cancelled) return
        setProviders(p.providers)
        // D-12: preserve an existing manual selection across skills; hydrate only when
        // nothing is chosen yet (first mount).
        setProvider((cur) => cur || p.active || p.providers[0]?.id || "")
        setModel((cur) => cur || p.active_model || p.providers[0]?.models?.[0] || "")
      } catch {
        /* picker is a convenience; backend validates — ignore load failure */
      }
      try {
        const list = await listEvalRuns(skillId)
        if (cancelled || currentSkillRef.current !== skillId) return
        setRuns(list) // 137-05: own the full history list
        const latest = list[0]
        if (latest) {
          await loadReadout(latest.id)
          if (latest.status === "running") attach(latest.id)
        }
      } catch {
        /* no prior runs / load failure — start clean */
      }
      try {
        const proposals = await listProposals(skillId)
        if (cancelled || currentSkillRef.current !== skillId) return
        const active = pickActiveProposal(proposals)
        setProposal(active)
        reattachProposalReeval(active)
      } catch {
        /* no proposals / load failure — no card */
      }
      try {
        const gate = await getPublishGate(skillId)
        if (cancelled || currentSkillRef.current !== skillId) return
        setPublishGate(gate)
      } catch {
        /* no gate / load failure — no line */
      }
    }
    void init()
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId])

  // When a run finalizes (running true→false), refresh the durable history so the
  // just-finished run (and its honest rollup) persists in the list, not just in the
  // single-run readout.
  useEffect(() => {
    if (prevRunningRef.current && !running) void refreshRuns()
    prevRunningRef.current = running
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // Launch a fresh eval run — LIFTED VERBATIM from SkillEvalSection :390-410.
  async function handleRun() {
    if (!provider || !model) {
      setError("Pick a provider and model first.")
      return
    }
    setError(null)
    setLive({})
    setResults([])
    setEvalRun(null)
    setRunning(true)
    reattachRef.current = 0
    reEvalProposalIdRef.current = null
    try {
      const { run_id } = await startEvalRun(skillId, { provider, model })
      attach(run_id)
    } catch (err) {
      setRunning(false)
      setError(err instanceof Error ? err.message : "Failed to start eval run.")
    }
  }

  // Thumbs rating — endpoint-then-refetch, never optimistic (LIFTED logic from
  // SkillEvalSection :419-427). The leaf (RunCaseDetail) owns the toggle and hands us
  // (resultId, choice|null), so this adapts the signature while preserving the
  // rate → reload-the-displayed-run flow exactly.
  async function handleRate(resultId: string, choice: "up" | "down" | null) {
    try {
      await rateEvalResult(skillId, resultId, choice)
      const rid = evalRun?.id ?? runId
      if (rid) await loadReadout(rid)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rating.")
    }
  }

  // Propose an improvement from the current run's evidence — LIFTED VERBATIM :432-447.
  async function handlePropose() {
    const rid = evalRun?.id ?? runId
    if (!rid) return
    setProposalError(null)
    setProposalLoading(true)
    try {
      const p = await proposeImprovement(skillId, rid)
      if (currentSkillRef.current !== skillId) return
      setProposal(p)
    } catch (err) {
      if (currentSkillRef.current !== skillId) return
      setProposalError(err instanceof Error ? err.message : "Failed to propose improvement.")
    } finally {
      setProposalLoading(false)
    }
  }

  // Proposal lifecycle handlers — endpoint-then-refetch (LIFTED VERBATIM :453-513).
  async function handleApprove() {
    if (!proposal) return
    const pid = proposal.id
    setProposalError(null)
    try {
      const { re_eval_run_id } = await approveProposal(skillId, pid)
      if (currentSkillRef.current !== skillId) return
      await refetchProposal(pid)
      setLive({})
      reEvalProposalIdRef.current = pid
      attach(re_eval_run_id)
    } catch (err) {
      if (currentSkillRef.current !== skillId) return
      setProposalError(err instanceof Error ? err.message : "Failed to approve proposal.")
    }
  }

  async function handleReject() {
    if (!proposal) return
    const pid = proposal.id
    setProposalError(null)
    try {
      await rejectProposal(skillId, pid)
      if (currentSkillRef.current !== skillId) return
      await refetchProposal(pid)
    } catch (err) {
      if (currentSkillRef.current !== skillId) return
      setProposalError(err instanceof Error ? err.message : "Failed to reject proposal.")
    }
  }

  async function handleRerun() {
    if (!proposal) return
    const pid = proposal.id
    setProposalError(null)
    try {
      const { re_eval_run_id } = await rerunProposalReeval(skillId, pid)
      if (currentSkillRef.current !== skillId) return
      await refetchProposal(pid)
      setLive({})
      reEvalProposalIdRef.current = pid
      attach(re_eval_run_id)
    } catch (err) {
      if (currentSkillRef.current !== skillId) return
      setProposalError(err instanceof Error ? err.message : "Failed to re-run the re-eval.")
    }
  }

  async function handleForcePromote() {
    if (!proposal) return
    const pid = proposal.id
    setProposalError(null)
    try {
      await forcePromoteProposal(skillId, pid)
      if (currentSkillRef.current !== skillId) return
      await refetchProposal(pid)
    } catch (err) {
      if (currentSkillRef.current !== skillId) return
      setProposalError(err instanceof Error ? err.message : "Failed to force-promote proposal.")
    }
  }

  // Expand/collapse a history row; load the expanded run's durable readout so its
  // per-case bodies render (skip for the live run already streaming into the readout).
  function handleToggleExpand(rid: string) {
    if (expandedRunId === rid) {
      setExpandedRunId(null)
      return
    }
    setExpandedRunId(rid)
    if (!(rid === runId && running)) void loadReadout(rid)
  }

  // ── Derived: the container is the single source for the leaves. ──
  const activeProvider = providers.find((p) => p.id === provider)
  const caseCount = cases.length
  const casesById = useMemo(
    () => Object.fromEntries(cases.map((c) => [c.id, c])) as Record<string, TestCase>,
    [cases],
  )

  // The history feed: the durable list merged with the single-run readout + a
  // synthesized top row for a live run not yet in the persisted list. The live run's
  // body renders from `live` (RunHistory only shows verdicts once finalized).
  const runsForHistory = useMemo<EvalRun[]>(() => {
    const map = new Map<string, EvalRun>()
    for (const r of runs) map.set(r.id, r)
    if (evalRun) map.set(evalRun.id, evalRun)
    if (running && runId && !map.has(runId)) {
      map.set(runId, {
        id: runId,
        skill_id: skillId,
        skill_version_id: "",
        user_id: "",
        provider,
        model,
        status: "running",
        case_count: cases.length,
        error: null,
        created_at: new Date().toISOString(),
        completed_at: null,
        passed_count: null,
        measured_count: null,
        verdict_summary: null,
      })
    }
    return Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [runs, evalRun, running, runId, provider, model, skillId, cases.length])

  // The expanded run's durable results are the single-run readout (loaded on expand).
  const resultsByRun = useMemo<Record<string, EvalResult[]>>(
    () => (evalRun ? { [evalRun.id]: results } : {}),
    [evalRun, results],
  )

  const proposalState = proposal?.status ?? null

  // Propose is enabled once the run has durable results (D-01) and no proposal is
  // already active — LIFTED gate logic from SkillEvalSection :519-522.
  const evalHasResults = !!evalRun && results.length > 0 && !running
  const proposalActive =
    !!proposal && ["proposed", "approved", "re_evaling"].includes(proposal.status)
  const canPropose = evalHasResults && !proposalActive && !proposalLoading

  // The proposal's re-eval progress (reuses the shared live map) shown inside the card.
  const reEvalLive =
    proposal && (proposal.status === "re_evaling" || proposal.status === "approved") ? (
      <ul className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
        {Object.entries(live).length === 0 && <li>Starting…</li>}
        {Object.entries(live).map(([key, status]) => {
          const [tcId, variant] = key.split(":")
          const tc = casesById[tcId]
          return (
            <li key={key} className="truncate" title={tc?.prompt}>
              {tc ? tc.prompt : "case"} · {variant} → {status}
            </li>
          )
        })}
      </ul>
    ) : undefined

  return (
    <div className="flex flex-col gap-5">
      {/* Status truth (top): the shared 054-B stepper renders the server gate verbatim. */}
      <LifecycleStepper
        variant="full"
        publishGate={publishGate}
        caseCount={caseCount}
        skillVersion={skillVersion}
        proposalState={proposalState}
        onNavigateStage={onNavigateStage}
      />

      {/* The prompt-first case list — the container owns the loaded list. */}
      <CaseEditor skillId={skillId} onCasesChanged={setCases} />

      {/* Launch bar directly above the history; the live run is the top history row. */}
      <div className="flex flex-col gap-3">
        <RunBar
          providers={providers}
          provider={provider}
          model={model}
          models={activeProvider?.models ?? []}
          onProviderChange={setProvider}
          onModelChange={setModel}
          running={running}
          onRun={handleRun}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <RunHistory
          runs={runsForHistory}
          casesById={casesById}
          expandedRunId={expandedRunId}
          onToggleExpand={handleToggleExpand}
          resultsByRun={resultsByRun}
          liveByCase={live}
          onRate={handleRate}
          onRerun={handleRun}
          onProposeFromRun={handlePropose}
        />
      </div>

      {/* Self-improvement proposal (below history). */}
      {proposalError && <p className="text-xs text-destructive">{proposalError}</p>}
      <ProposalCard
        proposal={proposal}
        reEvalLive={reEvalLive}
        onPropose={canPropose ? handlePropose : undefined}
        onApprove={handleApprove}
        onReject={handleReject}
        onRerun={handleRerun}
        onForcePromote={handleForcePromote}
      />
    </div>
  )
}
