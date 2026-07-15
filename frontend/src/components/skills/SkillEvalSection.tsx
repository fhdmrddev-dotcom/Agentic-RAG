// ─────────────────────────────────────────────────────────────────────────────
// Phase 133 Plan 05 (EVAL-02) — THIN with-skill-vs-without-skill eval runner surface.
//
// DELIBERATELY NON-DESIGNED / FUNCTIONAL-ONLY (--skip-ui, operator scope fence, D-07).
// This is the EVAL-02 runner made usable end-to-end: pick a provider/model, press
// "Run eval", watch a live per-case with/without progress list, and read a plain
// per-case results readout. It must NOT introduce designed structure (no panel
// chrome, no tabs, no new design-system primitives) that would pre-empt or
// constrain the Phase 137 sketch-gated Skill Evals panel (PANEL-01, G-2). Phase 137
// SUPERSEDES this surface — keep it plain on purpose.
//
// STREAM REUSE (RESEARCH Pattern 3): the eval run wrote a companion public.runs row
// (Plan 04), so the EXISTING chat-run stream client (`subscribeToRun`) carries the
// eval_* progress events with ZERO new stream code — no bespoke EventSource. The
// DURABLE readout always comes from `getEvalRun` (the DB) so it survives the Redis
// buffer TTL + a reload (D-06 / SC#3). Owner-scoping is enforced SERVER-SIDE on
// every route (Plan 04 `.eq("user_id")`); this client only renders what they return.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react"
import {
  Loader2,
  Play,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Check,
  X,
  RotateCw,
  ArrowUpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { lineDiff } from "@/lib/lineDiff"
import type { EvalResult, EvalRun, SkillProposal, PromotionGate, PublishGate } from "@/types"

interface Props {
  skillId: string
}

// Live per-arm status keyed by `${testCaseId}:${variant}` — driven off the eval_*
// SSE events while a run streams. "running" on eval_case_started, the terminal
// per-case status on eval_case_done. Falls back to the durable readout once done.
type LiveStatus = Record<string, string>

const VARIANTS = ["with_skill", "without_skill"] as const

// Phase 134 (EVAL-03) — the thin per-arm verdict badge text, derived from the
// DURABLE readout's verdict_state (D-04 honesty): a completed+non-empty arm reads
// PASS/FAIL; an errored/empty arm reads "not measured" (NEVER a fabricated pass/
// fail — EVAL-03 SC#1); a completed arm whose independent-judge shot failed reads
// "judge error". null → no badge (old pre-081 rows / verdict absent). Undesigned
// per D-10 — plain text, no design-system chrome.
function verdictBadge(r: EvalResult): string | null {
  switch (r.verdict_state) {
    case "graded":
      return r.verdict_passed ? "PASS" : "FAIL"
    case "not_measured":
      return "not measured"
    case "judge_error":
      return "judge error"
    default:
      return null
  }
}

// Phase 135 (SI-01) — pick the proposal to surface: the most-recently-updated one
// that the user hasn't rejected. A `rejected` latest ⇒ no card (dismissed), which
// also re-enables "Propose improvement" for a fresh attempt. Terminal promoted /
// not_promoted rows stay visible so the honest gate verdict persists (D-13).
function pickActiveProposal(list: SkillProposal[]): SkillProposal | null {
  if (list.length === 0) return null
  const latest = [...list].sort((a, b) =>
    (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at),
  )[0]
  return latest.status === "rejected" ? null : latest
}

// Phase 135 (SI-01) — the honest case-matched promotion-gate counts (D-13). The
// SAME renderer is called from BOTH the `promoted` and `not_promoted` branches so
// the counts are "always displayed alongside the verdict", not only on failure. A
// null gate (interrupted / not-yet-reconciled) renders nothing (no fabricated pass).
function renderGateCounts(gate: PromotionGate | null | undefined) {
  if (!gate) return null
  return (
    <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        {gate.passed ? "Gate passed" : "Gate not passed"} — no-regression:{" "}
        {gate.no_regression ? "yes" : "no"} · improved: {gate.improved ? "yes" : "no"}
      </p>
      <p>
        prev pass {gate.prev_pass} · prev fail {gate.prev_fail} · still pass{" "}
        {gate.still_pass} · newly pass {gate.newly_pass} · not measured{" "}
        {gate.excluded_not_measured}
      </p>
    </div>
  )
}

// Phase 136 (GATE-01, D-06) — the honest per-state copy for the UNMET publish gate.
// Plain text, no chrome (137 fence). "passed" never reaches here (the met branch
// renders the satisfied X/N line instead). Renders server state only — no client-side
// gate math (D-07).
function unmetGateLine(state: PublishGate["state"]): string {
  switch (state) {
    case "latest_failed":
      return "Not publishable — the latest eval on the current version failed"
    case "passed_on_older_version":
      return "Not publishable — the last passing eval was on an older version; re-eval to publish"
    case "never_evaled":
    default:
      return "Not publishable yet — run an eval on the current version"
  }
}

export function SkillEvalSection({ skillId }: Props) {
  const [providers, setProviders] = useState<
    { id: string; name: string; models: string[] }[]
  >([])
  const [provider, setProvider] = useState<string>("")
  const [model, setModel] = useState<string>("")

  const [runId, setRunId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [live, setLive] = useState<LiveStatus>({})
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null)
  const [results, setResults] = useState<EvalResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // Phase 135 (SI-01) — the self-improvement proposal card lives under the eval
  // readout (D-08). State is the DB row (never optimistic — T-135-04): hydrated on
  // mount, re-fetched after every action, reset on skill switch like the eval state.
  const [proposal, setProposal] = useState<SkillProposal | null>(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState<string | null>(null)

  // Phase 136 (GATE-01, D-06) — the server-computed publish gate (met/state +
  // owner-visible last_override). Hydrated on mount from getPublishGate, reset on
  // skill switch like the eval/proposal state. Rendered as a plain status line; the
  // client NEVER recomputes `met` (D-07) — it only renders these server fields.
  const [publishGate, setPublishGate] = useState<PublishGate | null>(null)

  // Abort the in-flight stream subscription on unmount / re-run so we never leak
  // a reader (subscribeToRun returns silently on AbortError).
  const abortRef = useRef<AbortController | null>(null)

  // The live active skill, tracked in a ref so an in-flight loadReadout can detect a
  // skill switch that happened while its fetch (or a terminal/complete callback) was
  // pending and DROP the stale result — abortRef stops the SSE reader but cannot cancel
  // an already-dispatched getEvalRun. Updated at the top of the [skillId] effect below.
  const currentSkillRef = useRef(skillId)

  // BUG-260702-03 self-heal: bounded re-attach counter for TRANSIENT stream drops
  // (buffer_expired_* open race, redis_timeout on a silent arm). Reset per fresh run
  // and per skill switch. The eval job keeps computing server-side across a drop, so
  // the client re-subscribes instead of painting a dead "error" end-state.
  const reattachRef = useRef(0)

  // Phase 135 (SI-01) — when non-null, the currently-attached eval readout belongs
  // to a proposal's re-eval; loadReadout then reconciles the proposal (status + gate)
  // from the DB on every readout (Pattern 3). Reset per fresh eval run + skill switch.
  const reEvalProposalIdRef = useRef<string | null>(null)

  // Pull the durable readout from the DB (survives the Redis TTL — SC#3). Guarded
  // against a skill switch (WR-02 / BUG-260701-02): capture the skill this fetch is for
  // and bail before ANY setState if the active skill changed while it was in flight, so
  // a stale response (or a terminal/complete callback for the previous run) never lands
  // the old skill's results into the new skill's view.
  async function loadReadout(rid: string) {
    const requestedSkill = skillId
    try {
      const { eval_run, eval_results } = await getEvalRun(requestedSkill, rid)
      if (currentSkillRef.current !== requestedSkill) return
      setEvalRun(eval_run)
      setResults(eval_results)
      // 135 (SI-01): if this readout is for a proposal's re-eval, reconcile the
      // proposal (status + honest gate counts) from the DB too — never optimistic.
      const pid = reEvalProposalIdRef.current
      if (pid) void refetchProposal(pid)
    } catch (err) {
      if (currentSkillRef.current !== requestedSkill) return
      setError(err instanceof Error ? err.message : "Failed to load eval results.")
    }
  }

  // Attach the EXISTING run-stream client to an eval run_id (live or reattach).
  // No new stream code (Pattern 3) — eval_* events ride the companion runs row.
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
        // Phase 134 (EVAL-03) — additive live verdict reflection. Merges the pass/
        // fail into the EXISTING `live` map (already reset in both the skill-switch
        // block and handleRun — no new state that could leak stale across skills).
        // Idempotent: strips any prior verdict before re-appending. The durable
        // readout (loadReadout on onEvalComplete/terminal) stays authoritative.
        onEvalVerdict: ({ testCaseId, variant, verdictState, verdictPassed }) =>
          setLive((prev) => {
            const key = `${testCaseId}:${variant}`
            const badge =
              verdictState === "graded" ? (verdictPassed ? "PASS" : "FAIL") : verdictState
            const base = (prev[key] ?? "done").split(" · ")[0]
            return { ...prev, [key]: `${base} · ${badge}` }
          }),
        onEvalComplete: () => {
          // Durable readout is authoritative; refresh from the DB.
          void loadReadout(rid)
        },
        onTerminal: async (kind, err) => {
          // BUG-260702-03 self-heal: a transient stream drop is NOT a run failure —
          // the eval job keeps computing server-side. Probe the durable readout; if
          // the run is still live, re-attach (bounded) instead of painting a dead
          // "error" end-state with a stale 'running' readout.
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
              // Run already terminal — the durable readout above is the honest final
              // state; no error banner for a drop the run itself outlived.
              setRunning(false)
              return
            } catch {
              /* probe failed — fall through to the standard terminal handling */
            }
          }
          setRunning(false)
          if (kind === "error") setError("Eval run ended with an error.")
          // Always re-fetch the durable readout on any terminal (covers reattach
          // to an already-finished run whose buffer only replayed a terminal).
          void loadReadout(rid)
        },
      },
      ctrl.signal,
    )
  }

  // 135 (SI-01) — reconcile a proposal from the DB (status + honest gate counts).
  // Never optimistic (T-135-04): the card can't show "promoted" unless the server
  // reconciled it. A `rejected` result clears the card (re-enables Propose). Guarded
  // against a skill switch exactly like loadReadout.
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

  // 135 (SI-01) — if the proposal is mid-re-eval, reattach the shared eval live
  // readout to its companion run (Pattern 3) so progress keeps streaming + heartbeats;
  // the run's terminal reconciles the proposal via loadReadout. Idempotent.
  function reattachProposalReeval(p: SkillProposal | null) {
    if (p && p.status === "re_evaling" && p.re_eval_run_id) {
      reEvalProposalIdRef.current = p.id
      attach(p.re_eval_run_id)
    }
  }

  // On mount: load the provider list + reattach to a still-live run (D-06).
  // The thin client has no ephemeral eval thread_id to feed getActiveRuns, so it
  // discovers a live run via the owner-scoped listEvalRuns (the skill-scoped
  // analog) and reattaches via subscribeToRun verbatim — see SUMMARY deviation.
  useEffect(() => {
    let cancelled = false
    // WR-02: publish the now-active skill so any still-pending loadReadout from the
    // PREVIOUS skill sees the switch and drops its stale result before setState.
    currentSkillRef.current = skillId
    // Switching skills: clear the previous skill's readout/live state BEFORE
    // fetching the new skill's runs. Without this, a skill that has no eval runs
    // keeps rendering the previously-viewed skill's results — the stale-state bug
    // where the SAME eval appeared under every skill (the durable readout was
    // never reset when listEvalRuns returned []). The provider/model picker
    // selection is intentionally preserved across skills.
    setRunId(null)
    setRunning(false)
    setLive({})
    setEvalRun(null)
    setResults([])
    setError(null)
    reattachRef.current = 0
    // 135 (SI-01): reset the proposal card the SAME way (skill-switch safe).
    setProposal(null)
    setProposalLoading(false)
    setProposalError(null)
    reEvalProposalIdRef.current = null
    // 136 (GATE-01, D-06): reset the publish-gate line the SAME way (skill-switch safe).
    setPublishGate(null)
    async function init() {
      try {
        const p = await getProviders()
        if (cancelled) return
        setProviders(p.providers)
        setProvider(p.active || p.providers[0]?.id || "")
        setModel(p.active_model || p.providers[0]?.models?.[0] || "")
      } catch {
        /* picker is a convenience; backend validates — ignore load failure */
      }
      try {
        const runs = await listEvalRuns(skillId)
        if (cancelled) return
        const latest = runs[0]
        if (latest) {
          // Always show the latest run's durable readout; reattach if still live.
          await loadReadout(latest.id)
          if (latest.status === "running") attach(latest.id)
        }
      } catch {
        /* no prior runs / load failure — start clean */
      }
      // 135 (SI-01): hydrate the latest non-rejected proposal for this skill from
      // the DB (survives reload/skill-switch; DB is source of truth). A still-live
      // re-eval reattaches to the shared readout in the reattach block below.
      try {
        const proposals = await listProposals(skillId)
        if (cancelled || currentSkillRef.current !== skillId) return
        const active = pickActiveProposal(proposals)
        setProposal(active)
        // A reload mid-re-eval keeps streaming instead of freezing (Pattern 3).
        reattachProposalReeval(active)
      } catch {
        /* no proposals / load failure — no card */
      }
      // 136 (GATE-01, D-06): hydrate the server-computed publish gate for the plain
      // gate-status line + owner-visible override record. Refetch-not-optimistic (the
      // DB is source of truth); skill-switch guarded exactly like the proposal load.
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
    // A fresh eval run is NOT a proposal re-eval — detach the reconcile hook.
    reEvalProposalIdRef.current = null
    try {
      const { run_id } = await startEvalRun(skillId, { provider, model })
      attach(run_id)
    } catch (err) {
      setRunning(false)
      setError(err instanceof Error ? err.message : "Failed to start eval run.")
    }
  }

  // Phase 134 (EVAL-04) — thumbs rating. Toggles or clears through the owner-gated
  // endpoint, then RE-LOADS the durable readout so the thumbs state is derived from
  // the DB (single source of truth — never a separate store; this is what respects
  // the BUG-260701-02 skill-switch reset). Reload keys off the displayed run
  // (evalRun.id) with runId as the live fallback, so it also fires for a completed
  // run loaded on mount (when runId is null) — the guard also satisfies tsc-b since
  // loadReadout(rid: string) is non-nullable.
  async function handleRate(r: EvalResult, choice: "up" | "down") {
    try {
      await rateEvalResult(skillId, r.id, r.rating === choice ? null : choice)
      const rid = runId ?? evalRun?.id
      if (rid) await loadReadout(rid)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rating.")
    }
  }

  // 135 (SI-01) — propose an improved instructions revision from the current eval
  // run's evidence (D-01: only once the run has results). The fresh `proposed`
  // proposal comes straight back from the DB via the POST (never optimistic).
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

  // 135 (SI-01) — proposal lifecycle handlers. Each mirrors handleRate: call the
  // owner-gated endpoint, THEN re-fetch the proposal from the DB (never optimistic —
  // T-135-04). Approve/rerun additionally reattach the shared eval live readout to the
  // companion re-eval run (Pattern 3); the run's terminal reconciles status + gate.
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

  const activeProvider = providers.find((p) => p.id === provider)

  // 135 (SI-01) — Propose is enabled once the eval run has landed durable results
  // (D-01) and there is no active proposal already in flight for this skill.
  const evalHasResults = !!evalRun && results.length > 0 && !running
  const proposalActive =
    !!proposal && ["proposed", "approved", "re_evaling"].includes(proposal.status)
  const canPropose = evalHasResults && !proposalActive && !proposalLoading

  // Group durable results by test case for the readout.
  const byCase = new Map<string, Partial<Record<string, EvalResult>>>()
  for (const r of results) {
    const entry = byCase.get(r.test_case_id) ?? {}
    entry[r.variant] = r
    byCase.set(r.test_case_id, entry)
  }
  const caseIds = Array.from(byCase.keys())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {/* Phase 155 (A11Y-01): section heading, not a single-control label -> <span>
            (jsx-a11y/label-has-associated-control). */}
        <span className="text-sm font-medium text-foreground">Eval runner</span>
      </div>

      {/* Phase 136 (GATE-01, D-06) — plain publish-readiness gate line + owner-visible
          override record, straight from the server getPublishGate (no client-side gate
          math, D-07). Additive/undesigned, reusing the surface's honest-counts text
          style — Phase 137 (PANEL-01, G-2) owns the designed panel (137 fence). */}
      {publishGate && (
        <div className="flex flex-col gap-0.5">
          {publishGate.met ? (
            <p className="text-xs font-medium text-foreground">
              Publish ready — eval passed {publishGate.passed}/{publishGate.measured} on the
              current version
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {unmetGateLine(publishGate.state)}
              </p>
              {publishGate.reason && (
                <p className="text-xs text-muted-foreground/80">{publishGate.reason}</p>
              )}
            </>
          )}
          {publishGate.last_override && (
            <p className="text-xs text-muted-foreground">
              Published without a passing eval on{" "}
              {new Date(publishGate.last_override.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Provider / model picker (convenience only — backend validates). */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
          value={provider}
          onChange={(e) => {
            const next = e.target.value
            setProvider(next)
            const np = providers.find((p) => p.id === next)
            setModel(np?.models?.[0] ?? "")
          }}
          disabled={running}
        >
          {providers.length === 0 && <option value="">No providers</option>}
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          className="rounded border border-border/30 bg-background px-2 py-1 text-xs"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={running}
        >
          {(activeProvider?.models ?? []).length === 0 && <option value="">No models</option>}
          {(activeProvider?.models ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <Button
          type="button"
          size="sm"
          className="text-xs gap-1"
          onClick={handleRun}
          disabled={running || !provider || !model}
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run eval
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Run status line. */}
      {runId && (
        <p className="text-xs text-muted-foreground">
          Run {runId.slice(0, 8)} ·{" "}
          {running ? "streaming…" : evalRun?.status ?? "done"}
        </p>
      )}

      {/* Phase 134 (EVAL-03) — per-run honest verdict line. Reads the rollup
          (passed_count / measured_count, written at run-finalize) and appends an
          honest "N not measured" note when fewer with-skill cases were measured
          than exist (errored/empty arms — D-04/D-07). Gated on measured_count so it
          only appears once the durable rollup lands (never mid-stream). */}
      {evalRun && evalRun.measured_count != null && (
        <p className="text-xs font-medium text-foreground">
          {evalRun.passed_count ?? 0}/{evalRun.measured_count} with-skill cases passed
          {evalRun.measured_count < evalRun.case_count &&
            ` · ${evalRun.case_count - evalRun.measured_count} not measured`}
        </p>
      )}

      {/* Live per-arm progress (driven by eval_* events while streaming). */}
      {running && Object.keys(live).length > 0 && (
        <ul className="flex flex-col gap-1">
          {Object.entries(live).map(([key, status]) => (
            <li key={key} className="text-xs text-muted-foreground">
              {key.replace(":", " · ")} → {status}
            </li>
          ))}
        </ul>
      )}

      {/* Phase 135 (SI-01) — self-improvement proposal card (thin, 137-fenced).
          Sits under the eval readout (D-08): "Propose improvement" (D-01) then the
          unified line diff (D-09) + rationale + which-evidence-drove-it (D-10); the
          status-driven approve/reject/re-eval action row + honest gate counts (D-13)
          render below the diff. */}
      {(evalHasResults || (proposal && proposal.status !== "rejected")) && (
        <div className="flex flex-col gap-3 border-t border-border/30 pt-3">
          {/* Propose button hidden while a re-eval streams (evalHasResults gates on
              !running); the card itself stays mounted so it never vanishes mid-run. */}
          {evalHasResults && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => void handlePropose()}
                disabled={!canPropose}
              >
                {proposalLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Propose improvement
              </Button>
            </div>
          )}

          {proposalError && <p className="text-xs text-destructive">{proposalError}</p>}

          {proposal && proposal.status !== "rejected" && (
            <div className="flex flex-col gap-3 rounded border border-border/30 p-3">
              {/* Unified line diff of base vs proposed instructions (D-09). */}
              <p className="text-xs font-medium text-foreground">
                Proposed instructions change
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-2 font-mono text-xs">
                {lineDiff(
                  proposal.base_instructions,
                  proposal.proposed_instructions,
                ).map((row, i) => (
                  <span
                    key={i}
                    className={
                      row.type === "add"
                        ? "block bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : row.type === "remove"
                          ? "block bg-destructive/10 text-destructive"
                          : "block text-foreground/70"
                    }
                  >
                    {row.type === "add" ? "+ " : row.type === "remove" ? "- " : "  "}
                    {row.text || " "}
                  </span>
                ))}
              </pre>

              {/* Rationale + which evidence drove it (D-10). */}
              {proposal.rationale && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground">Why this change</p>
                  <p className="whitespace-pre-wrap text-xs text-foreground/80">
                    {proposal.rationale}
                  </p>
                </div>
              )}
              {proposal.evidence_summary && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                  <p className="whitespace-pre-wrap text-xs text-foreground/80">
                    {proposal.evidence_summary}
                  </p>
                </div>
              )}

              {/* Status-driven action row + honest terminal verdict (D-06/D-13/D-14).
                  State is always the reconciled DB row (refetch-not-optimistic). */}
              {proposal.status === "proposed" && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => void handleApprove()}
                  >
                    <Check className="h-3 w-3" /> Approve &amp; re-eval
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    onClick={() => void handleReject()}
                  >
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              )}

              {proposal.status === "re_evaling" && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Re-evaluating the proposed skill — live progress shows above.
                </p>
              )}

              {/* CR-03 (frontend) — `approved` is transient in the happy path
                  (it flips to `re_evaling` in the same approve response); a
                  persistent `approved` on refetch means the re-eval launch failed
                  and the loop is wedged. Offer a Reject escape so the human stays
                  in the loop (rejectProposal accepts ANY status server-side). */}
              {proposal.status === "approved" && (
                <div className="flex flex-col gap-2">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Re-evaluating the proposed skill — live progress shows above.
                  </p>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => void handleReject()}
                    >
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
              )}

              {proposal.status === "promoted" && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-emerald-500">
                    Promoted to the live skill
                    {proposal.override_forced ? " (forced override)" : ""}.
                  </p>
                  {renderGateCounts(proposal.gate)}
                </div>
              )}

              {proposal.status === "not_promoted" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-destructive">
                    Not promoted — the re-eval gate did not pass (failing cases in the
                    results above).
                  </p>
                  {renderGateCounts(proposal.gate)}
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => void handleForcePromote()}
                    >
                      <ArrowUpCircle className="h-3 w-3" /> Force promote anyway
                    </Button>
                  </div>
                </div>
              )}

              {proposal.status === "interrupted" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Interrupted — not promoted. The re-eval did not finish.
                  </p>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => void handleRerun()}
                    >
                      <RotateCw className="h-3 w-3" /> Re-run re-eval
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Durable per-case with/without readout (re-fetched from the DB). */}
      {caseIds.length > 0 && (
        <ul className="flex flex-col gap-3">
          {caseIds.map((cid) => {
            const entry = byCase.get(cid) ?? {}
            return (
              <li key={cid} className="flex flex-col gap-2 rounded border border-border/30 p-3">
                <p className="text-xs font-medium text-foreground">Case {cid.slice(0, 8)}</p>
                {VARIANTS.map((v) => {
                  const r = entry[v]
                  const badge = r ? verdictBadge(r) : null
                  return (
                    <div key={v} className="flex flex-col gap-1">
                      {/* Arm header: label · status · verdict badge · thumbs. */}
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {v === "with_skill" ? "With skill" : "Without skill"}
                          {r ? ` · ${r.status}` : " · —"}
                        </p>
                        {badge && (
                          <span
                            className={
                              badge === "PASS"
                                ? "text-xs font-semibold text-emerald-500"
                                : badge === "FAIL"
                                  ? "text-xs font-semibold text-destructive"
                                  : "text-xs font-medium text-muted-foreground"
                            }
                          >
                            {badge}
                          </span>
                        )}
                        {r && (
                          <span className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              aria-label="Thumbs up"
                              aria-pressed={r.rating === "up"}
                              onClick={() => void handleRate(r, "up")}
                              className={
                                r.rating === "up"
                                  ? "text-emerald-500"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Thumbs down"
                              aria-pressed={r.rating === "down"}
                              onClick={() => void handleRate(r, "down")}
                              className={
                                r.rating === "down"
                                  ? "text-destructive"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                      </div>
                      {/* One-line judge reason (muted, truncated; full text on hover). */}
                      {r?.verdict_reason && (
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={r.verdict_reason}
                        >
                          {r.verdict_reason}
                        </p>
                      )}
                      {r?.output && (
                        <pre className="whitespace-pre-wrap break-words text-xs text-foreground/80">
                          {r.output}
                        </pre>
                      )}
                      {r?.error && <p className="text-xs text-destructive">{r.error}</p>}
                    </div>
                  )
                })}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
