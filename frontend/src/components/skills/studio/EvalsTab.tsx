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
  startMatrixRun,
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
  /** Notify the shell its header-strip gate is stale (a run just finalized) so both
   *  homes of the one truth-teller (D-10) refresh without a page reload. */
  onGateStale?: () => void
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

export function EvalsTab({ skillId, skillVersion, onNavigateStage, onGateStale }: Props) {
  // ── Picker state (kept HERE so selection persists across skills — D-12). ──
  const [providers, setProviders] = useState<
    { id: string; name: string; models: string[] }[]
  >([])
  const [provider, setProvider] = useState<string>("")
  const [model, setModel] = useState<string>("")
  // 137.1 (058-A / D-05): the designated gate-feeder for a matrix run. Preserved
  // across skills like provider/model (D-12); hydrated to the active provider on mount.
  const [gateProvider, setGateProvider] = useState<string>("")

  // ── Run / stream state (LIFTED from SkillEvalSection). ──
  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [live, setLive] = useState<LiveStatus>({})
  // 137.1 (058-A): per-arm live maps for a matrix run — run_id → its own
  // `${testCaseId}:${variant}` status map, so N parallel arms each render their own
  // determinate progress (RunHistory reads liveByRun[run.id]). Separate from `live`
  // (the single-run/re-eval map) so the battle-tested single-run path is untouched.
  const [matrixLive, setMatrixLive] = useState<Record<string, LiveStatus>>({})
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
  // 137.1 (058-A / D-06): ONE abort for ALL matrix arm subscriptions + the set of arm
  // run_ids still live. `running` stays true until the LAST arm settles (one claim per
  // skill — the RunBar disables both launchers for the whole group).
  const matrixAbortRef = useRef<AbortController | null>(null)
  const matrixPendingRef = useRef<Set<string>>(new Set())

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

  // Re-pull the server publish gate (skill-switch-guarded). The gate changes when a
  // run finalizes; without this the stepper/strip stay stale until a page reload
  // (137-UAT gap, found live during U7).
  async function refreshGate() {
    const requestedSkill = skillId
    try {
      const gate = await getPublishGate(requestedSkill)
      if (currentSkillRef.current !== requestedSkill) return
      setPublishGate(gate)
    } catch {
      /* keep the last known gate; the next skill switch re-fetches */
    }
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
    // 137.1: tear down any in-flight matrix subscriptions + clear per-arm live maps so
    // no prior skill's matrix progress leaks (gateProvider is preserved — D-12).
    matrixAbortRef.current?.abort()
    matrixPendingRef.current = new Set()
    setMatrixLive({})
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
        // 137.1 (D-05): default the gate-feeder to the active provider (preserved across
        // skills like the picker — D-12).
        setGateProvider((cur) => cur || p.active || p.providers[0]?.id || "")
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
      matrixAbortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId])

  // When a run finalizes (running true→false), refresh the durable history so the
  // just-finished run (and its honest rollup) persists in the list, not just in the
  // single-run readout.
  useEffect(() => {
    if (prevRunningRef.current && !running) {
      void refreshRuns()
      // The finished run changed the server gate — refresh BOTH homes of the one
      // truth-teller (this tab's stepper + the shell's header strip) without a reload.
      void refreshGate()
      onGateStale?.()
    }
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

  // 137.1 (058-A): attach the EXISTING run-stream client to ONE matrix arm (Pattern 3,
  // no bespoke matrix SSE) — N arms = N of these. Writes ONLY into that arm's bucket of
  // matrixLive so parallel arms never collide; renders NO mid-run verdicts (the
  // determinate bar counts units; verdicts load from the durable readout on expand,
  // T-137-04). On finalize it refreshes the durable history, and the gate-feeder arm
  // also refreshes the publish gate (the 40e2f8a3 path — a matrix finalize refreshes
  // the gate just like a single run).
  function attachMatrixArm(rid: string, ctrl: AbortController, isGateFeeder: boolean) {
    void subscribeToRun(
      rid,
      "0",
      {
        onDelta: () => {},
        onDone: () => {},
        onEvalCaseStarted: ({ testCaseId, variant }) =>
          setMatrixLive((prev) => ({
            ...prev,
            [rid]: { ...(prev[rid] ?? {}), [`${testCaseId}:${variant}`]: "running" },
          })),
        onEvalCaseDone: ({ testCaseId, variant, status }) =>
          setMatrixLive((prev) => ({
            ...prev,
            [rid]: { ...(prev[rid] ?? {}), [`${testCaseId}:${variant}`]: status },
          })),
        // No mid-run verdicts on a matrix arm (T-137-04) — the durable readout is
        // authoritative and loads on expand.
        onEvalVerdict: () => {},
        onEvalComplete: () => {
          if (ctrl.signal.aborted) return
          // Durable rollups are authoritative — refresh the history so this arm's honest
          // rollup lands. The gate-feeder arm ALSO refreshes the gate (both homes of the
          // one truth-teller) the moment it finalizes.
          void refreshRuns()
          if (isGateFeeder) {
            void refreshGate()
            onGateStale?.()
          }
        },
        onTerminal: () => {
          if (ctrl.signal.aborted) return
          matrixPendingRef.current.delete(rid)
          void refreshRuns()
          // When the LAST arm settles, drop the claim → RunBar re-enables; the
          // running→false effect refreshes the gate + history (backstop).
          if (matrixPendingRef.current.size === 0) setRunning(false)
        },
      },
      ctrl.signal,
    )
  }

  // 137.1 (058-A / D-06): launch a matrix run — one click fans the skill's eval across
  // all configured providers as N single-provider arms under ONE group claim. EvalsTab
  // owns the call + the N subscriptions; RunBar stays dumb. The gate-feeder (D-05) is
  // the controlled `gateProvider` (default = the active provider); its arm's rows feed
  // the publish gate, the others are analysis-only.
  async function handleRunMatrix() {
    const gp = gateProvider || provider || providers[0]?.id || ""
    setError(null)
    setMatrixLive({})
    setRunning(true)
    reattachRef.current = 0
    reEvalProposalIdRef.current = null
    matrixAbortRef.current?.abort()
    const ctrl = new AbortController()
    matrixAbortRef.current = ctrl
    try {
      const { arms } = await startMatrixRun(skillId, { gate_provider: gp })
      if (currentSkillRef.current !== skillId || ctrl.signal.aborted) return
      if (arms.length === 0) {
        setRunning(false)
        setError("No configured providers to run a matrix across.")
        return
      }
      // Pull the durable arm rows (server matrix_group_id + feeds_gate — never
      // client-computed, T-137.1-U1) into the history so the grouped card renders.
      void refreshRuns()
      // The gate-feeder arm = the one whose provider matches the requested gate provider
      // (else the first arm — mirrors the server's D-05 fallback). Used only to refresh
      // the gate EARLY on its finalize; the running→false effect is the backstop.
      const gateFeederRunId =
        arms.find((a) => a.provider === gp)?.run_id ?? arms[0].run_id
      matrixPendingRef.current = new Set(arms.map((a) => a.run_id))
      for (const arm of arms) {
        attachMatrixArm(arm.run_id, ctrl, arm.run_id === gateFeederRunId)
      }
    } catch (err) {
      if (currentSkillRef.current !== skillId) return
      setRunning(false)
      setError(err instanceof Error ? err.message : "Failed to start matrix run.")
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
        // A single run carries no group + never feeds the gate (mig 085). The matrix
        // arms come from the durable list (refreshRuns) with their SERVER flags — never
        // synthesized/client-computed here (T-137.1-U1).
        matrix_group_id: null,
        feeds_gate: false,
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
          configuredProviders={providers}
          gateProvider={gateProvider}
          onGateProviderChange={setGateProvider}
          onRunMatrix={handleRunMatrix}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <RunHistory
          runs={runsForHistory}
          casesById={casesById}
          expandedRunId={expandedRunId}
          onToggleExpand={handleToggleExpand}
          resultsByRun={resultsByRun}
          liveByCase={live}
          liveByRun={matrixLive}
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
