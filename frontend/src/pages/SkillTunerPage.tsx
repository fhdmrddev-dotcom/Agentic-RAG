/**
 * Phase 123 Plan 05 (TRIG-01) — SkillTunerPage: the Skill Trigger Tuner focused
 * full-surface (sketch 041-A).
 *
 * The Tuner is a FOCUSED FULL-SURFACE entered WITH a skillId (NOT a cold top-level
 * nav): the rail stays, the 3-pane SkillsPage list+detail are hidden, and a
 * "‹ Skills" back control returns. It mirrors the GovernancePage self-fetch focused
 * home + the publish-gauntlet "first-class focused surface via an ActiveView switch"
 * precedent (no router). Reachability is owned in-phase: the App.tsx ActiveView
 * union member + the ChatLayout mount branch + the SkillsPage "Tune triggers" entry
 * action are all wired in Plan 05 (the Phase-118 built-but-unreachable lesson).
 *
 * Two-column body (041-A):
 *   LEFT  — the skill's CURRENT description ("current · live · drives firing") +
 *           the CaseEditor (two-column should-fire/should-NOT) + the run config.
 *   RIGHT — the per-provider ProviderScoreboard (N-column, both fires/no-false per
 *           cell) + the CandidateCards (held-out score + author-confirm diff) + the
 *           LiveRunCard (never-vanishing timer, reconcile-on-return).
 *
 * Task 1 ships the shell + the api wiring + the live-run orchestration; Task 2a/2b
 * fill the four tuner components. The author picks the winner by HELD-OUT score and
 * an explicit diff-confirm strip writes the live description via PATCH /skills/{id}
 * (useSkills().updateSkill) — NEVER auto-applied (042-A / D-03).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, Target, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSkills } from "@/hooks/useSkills"
import { CaseEditor, type EditorCase } from "@/components/skills/tuner/CaseEditor"
import { ProviderScoreboard } from "@/components/skills/tuner/ProviderScoreboard"
import { CandidateCard } from "@/components/skills/tuner/CandidateCard"
import { LiveRunCard, type ProviderLane } from "@/components/skills/tuner/LiveRunCard"
import {
  startTunerRun,
  getTunerResults,
  streamTunerRun,
  getSeededCases,
  getTunerLatest,
  getSettings,
  ApiError,
  type TunerTarget,
  type TunerScoreboard,
  type TunerCandidate,
  type TunerStreamCallbacks,
  type LatestTunerRun,
} from "@/lib/api"
import type { Skill } from "@/types"

interface Props {
  /** The skill being tuned. App holds this selection (per-view state); a null id
   *  means the surface was opened without a target — render a calm guard. */
  skillId: string | null
  /** Return to the 3-pane Skills surface ("‹ Skills"). */
  onBack: () => void
}

// The provider ids the backend has a representative model for (the effective scored set
// after WR-01 drops empty-model targets). Used by the pre-run cost preview so the
// `× N models` count equals the set the run will actually score — keyed cloud providers
// count even with an empty `models` list; locals (ollama/lmstudio) do NOT (no representative).
// must mirror backend _REPRESENTATIVE_MODEL keys (skill_tuner_service.py)
const REPRESENTATIVE_PROVIDER_IDS = new Set<string>([
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "deepseek",
  "moonshot",
  "minimax",
  "zhipu",
])

// The lane status vocabulary for the live run (043-A): a queued provider NEVER shows
// a fake percent — queued ≠ running.
type RunPhase = "idle" | "running" | "done" | "error"

export function SkillTunerPage({ skillId, onBack }: Props) {
  // The Tuner reuses useSkills() so the author-confirm winner write goes through
  // the SAME updateSkill (PATCH /skills/{id}) the SkillsPage uses (042-A / D-03).
  const { skills, loading: skillsLoading, updateSkill } = useSkills()
  const skill: Skill | null = useMemo(
    () => skills.find((s) => s.id === skillId) ?? null,
    [skills, skillId],
  )

  // ── Benchmark cases (043-A): hybrid auto-seed + author edits; ephemeral, never
  //    persisted. Task 2b's CaseEditor owns the two-column should-fire/should-NOT
  //    editing; the page holds the case list + the run config. ──
  const [cases, setCases] = useState<EditorCase[]>([])
  // Phase 123.1-05 (BUG-260624-01 #1): the FULL uncapped sibling-sourced should_not count from
  // the seeded GET. Threaded into CaseEditor so the should-NOT column shows an honest
  // "showing N of M — capped" banner when the backend capped the seed. undefined = no banner
  // (no seeded fetch yet, or it failed).
  const [seededNotTotal, setSeededNotTotal] = useState<number | undefined>(undefined)

  // ── Run state. The elapsed timer derives from a STABLE start-ts (the 095
  //    never-vanishes lesson) — set once at kickoff, never reset on a transient
  //    stream-end. LiveRunCard reads runStartTs. ──
  const [runPhase, setRunPhase] = useState<RunPhase>("idle")
  const [runId, setRunId] = useState<string | null>(null)
  const [runStartTs, setRunStartTs] = useState<number | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [targets, setTargets] = useState<TunerTarget[]>([])
  const [lanes, setLanes] = useState<ProviderLane[]>([])
  const [scoreboard, setScoreboard] = useState<TunerScoreboard | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── D-12 pre-run cost preview: the SCORED-TARGET model count resolved client-side from
  //    the user's providers, mirroring the POST-WR-01 effective backend scored set
  //    (skill_tuner_service.py — `_REPRESENTATIVE_MODEL` + `_run_tuner_job` drops
  //    empty-model targets). A provider counts IFF `has_key` is true AND the backend has a
  //    representative model for it — so the `× M models` line is populated on open (NOT
  //    empty until kickoff, NOT a raw all-models count) and equals what the run will score. ──
  const [configuredTargetCount, setConfiguredTargetCount] = useState<number | null>(null)
  // ── D-07/D-12 persisted run metadata (attribution): the durable latest run carries the
  //    builder model + the target count it was measured on — "Built by {model} · measured
  //    on N models". Null until a run has ever completed for this skill. ──
  const [latestRun, setLatestRun] = useState<LatestTunerRun | null>(null)
  // A transient SSE transport timeout (redis_timeout / consumer_timeout) is NOT a
  // run failure — the bounded job keeps computing server-side. We reconnect the
  // stream from the buffer rather than surfacing a hard failure; this counter
  // bounds the reconnect loop so a genuinely dead run can't spin forever.
  const reconnectsRef = useRef(0)

  // Cancel any in-flight stream on unmount / skill switch (leave-and-reconcile).
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [skillId])

  // ── Reconcile-via-fetch on open (D-v2.5-03 — SSE/Realtime is a hint, NOT truth). On
  //    mount / skill-switch we fetch three things authoritatively:
  //      1. getSeededCases  → hydrate the editor (D-05/D-06) so seeded/sibling cases show
  //         + are editable BEFORE a run (no more "0 cases" while the run uses hidden cases).
  //      2. getTunerLatest  → rehydrate the durable latest result (D-07) so a completed
  //         scoreboard survives refresh / navigation / a Redis flush. A 404 → null (no run
  //         yet) leaves `scoreboard` null and renders the empty/initial state — NEVER errors.
  //      3. getSettings     → resolve the configured-target model count (D-12) for the
  //         pre-run cost preview, mirroring the backend `configured_targets` presence filter.
  //    The effect guards against a skill-switch race: a stale resolution is dropped. ──
  useEffect(() => {
    // With no skill the surface renders the calm guard (see the early `if (!skillId)`
    // return below), so stale results are never shown — no synchronous reset needed.
    if (!skillId) return
    let cancelled = false

    // 1. Hydrate the case editor from the backend's seeded cases (real provenance).
    getSeededCases(skillId)
      .then((seeded) => {
        if (cancelled) return
        const hydrated: EditorCase[] = [
          ...seeded.should_fire.map((c, i) => ({
            id: `seed-fire-${i}`,
            prompt: c.prompt,
            should_fire: true,
            // The backend emits only "seeded" / "sibling"; anything else degrades to "seeded".
            provenance: (c.provenance === "sibling" ? "sibling" : "seeded") as EditorCase["provenance"],
          })),
          ...seeded.should_not.map((c, i) => ({
            id: `seed-not-${i}`,
            prompt: c.prompt,
            should_fire: false,
            provenance: (c.provenance === "sibling" ? "sibling" : "seeded") as EditorCase["provenance"],
          })),
        ]
        setCases(hydrated)
        // The uncapped sibling total drives the honest "showing N of M — capped" banner.
        setSeededNotTotal(seeded.total)
      })
      .catch(() => {
        // A seeded-cases read failure leaves the editor empty (author can add cases
        // manually + the run auto-seeds) — never surfaces an error toast, and no cap banner.
        if (!cancelled) {
          setCases([])
          setSeededNotTotal(undefined)
        }
      })

    // 2. Rehydrate the durable latest result (D-07). 404 → null (no run yet) → empty state.
    getTunerLatest(skillId)
      .then((latest) => {
        if (cancelled) return
        if (latest) {
          setScoreboard(latest.scoreboard)
          setLatestRun(latest)
        } else {
          // No run has ever completed for this skill — stay in the empty/initial state.
          setScoreboard(null)
          setLatestRun(null)
        }
      })
      .catch(() => {
        // A non-404 read failure is non-fatal — leave the empty state, never error-boundary.
        if (!cancelled) {
          setScoreboard(null)
          setLatestRun(null)
        }
      })

    // 3. Resolve the configured-target model count for the pre-run cost preview (D-12).
    getSettings()
      .then((settings) => {
        if (cancelled) return
        // Mirror the POST-WR-01 effective backend scored set: a provider is scored IFF it
        // has a key AND has a backend representative model. The run's `_run_tuner_job` drops
        // empty-model targets, so a keyed cloud provider with an empty `models` list is STILL
        // scored (its representative model comes from the fixed map), and a local provider
        // (ollama/lmstudio) with no representative is NOT scored. Counting `p.models.some(...)`
        // under-counts the former; including locals over-counts the latter — so count keyed
        // providers that the backend has a representative model for. `has_key` is the
        // present-credential signal (backend: `bool(api_key && api_key != "ollama")`).
        const count = settings.providers.filter(
          (p) => p.has_key && REPRESENTATIVE_PROVIDER_IDS.has(p.id),
        ).length
        setConfiguredTargetCount(count)
      })
      .catch(() => {
        if (!cancelled) setConfiguredTargetCount(null)
      })

    return () => {
      cancelled = true
    }
  }, [skillId])

  // ── Kick off a background tuning run (D-06 non-blocking) and stream live
  //    progress. The run keeps computing server-side if the author leaves; on
  //    return the surface reconciles via GET results (Realtime/SSE is a hint, not
  //    truth — D-v2.5-03). ──
  const startRun = useCallback(async () => {
    if (!skillId || runPhase === "running") return
    setRunError(null)
    setScoreboard(null)
    try {
      const started = await startTunerRun(skillId, {
        cases: cases.map((c) => ({ prompt: c.prompt, should_fire: c.should_fire })),
      })
      setRunId(started.run_id)
      setTargets(started.targets)
      // A queued provider lane per target — NEVER a fake percent (043-A): queued.
      setLanes(started.targets.map((t) => ({ ...t, status: "queued" as const })))
      setRunStartTs(Date.now()) // stable start-ts (never reset on transient ends)
      setRunPhase("running")

      const controller = new AbortController()
      abortRef.current = controller
      reconnectsRef.current = 0
      // A long builder/scoring stretch emits no stream events, so the shared SSE
      // consumer's socket read can hit its deadline and yield a transient
      // redis_timeout / consumer_timeout. That is NOT a run failure (the bounded
      // job keeps computing server-side), so we reconcile via the authoritative
      // GET results and, if it isn't done yet, reconnect the stream from the buffer
      // (idempotent replay) — bounded by MAX_RECONNECTS. Only a genuine error
      // (run_not_found / streaming_unavailable) or exhausting reconnects fails the UI.
      const MAX_RECONNECTS = 20
      const TRANSIENT_TERMINALS = new Set(["redis_timeout", "consumer_timeout"])
      const runIdForStream = started.run_id

      const callbacks: TunerStreamCallbacks = {
        onProviderDone: ({ provider, model, cell }) => {
          setLanes((prev) =>
            prev.map((l) =>
              l.provider === provider && l.model === model
                ? { ...l, status: "done" as const, score: cell.score }
                : l,
            ),
          )
        },
        onProgress: (data) => {
          // A provider whose first cell starts flips queued→running (no fake %).
          const prov = data.provider as string | undefined
          const mdl = data.model as string | undefined
          if (prov) {
            setLanes((prev) =>
              prev.map((l) =>
                l.provider === prov && (!mdl || l.model === mdl) && l.status === "queued"
                  ? { ...l, status: "running" as const }
                  : l,
              ),
            )
          }
        },
        onComplete: (sb) => setScoreboard(sb),
        onTerminal: (status, reason) => {
          if (controller.signal.aborted) return

          // Transient transport timeout → reconcile, then reconnect if still running.
          if (status === "error" && reason && TRANSIENT_TERMINALS.has(reason)) {
            getTunerResults(skillId, runIdForStream)
              .then((sb) => {
                setScoreboard(sb)
                setRunPhase("done")
              })
              .catch(() => {
                if (controller.signal.aborted) return
                if (reconnectsRef.current < MAX_RECONNECTS) {
                  reconnectsRef.current += 1
                  // Replay from the start of the buffer — re-applying already-seen
                  // events is idempotent (setLanes / setScoreboard just re-set).
                  void streamTunerRun(skillId, runIdForStream, callbacks, "0", controller.signal)
                } else {
                  setRunPhase("error")
                  setRunError(
                    "Lost the live connection to the tuning run. Reopen this skill to load the finished scoreboard.",
                  )
                }
              })
            return
          }

          // A genuine error terminal (run_not_found / streaming_unavailable / etc.).
          if (status === "error") {
            setRunPhase("error")
            setRunError(reason ?? "The tuning run failed.")
            return
          }

          setRunPhase("done")
          // Reconcile the final scoreboard from the authoritative GET results
          // (the SSE tuner_complete is a best-effort hint — D-v2.5-03).
          getTunerResults(skillId, runIdForStream)
            .then(setScoreboard)
            .catch(() => {
              /* keep the SSE-carried scoreboard if results read fails */
            })
        },
      }

      void streamTunerRun(skillId, runIdForStream, callbacks, "0", controller.signal)
    } catch (err) {
      setRunPhase("error")
      setRunError(
        err instanceof ApiError && err.status === 409
          ? "A tuning run is already in progress for this skill."
          : "Couldn't start the tuning run. Please try again.",
      )
    }
  }, [skillId, runPhase, cases])

  const cancelRun = useCallback(() => {
    abortRef.current?.abort()
    setRunPhase("idle")
  }, [])

  // ── Author-confirm winner write (042-A / D-03): writes the live description via
  //    PATCH /skills/{id} (useSkills().updateSkill re-lints). NEVER auto-applied —
  //    CandidateCard reveals an explicit diff strip; this fires only on confirm. ──
  const handleConfirmWinner = useCallback(
    async (candidate: TunerCandidate) => {
      if (!skillId) return
      await updateSkill(skillId, { description: candidate.description })
    },
    [skillId, updateSkill],
  )

  // ── D-04 standalone block: the BASELINE candidate is the current/live description
  //    (TunerCandidate.is_baseline). Its `cells` feed a standalone ProviderScoreboard at
  //    the top of the results area — distinct from the per-candidate grids. Server scores
  //    only (no client fabrication). ──
  const baselineCandidate = useMemo(
    () => scoreboard?.candidates.find((c) => c.is_baseline) ?? null,
    [scoreboard],
  )

  // ── D-12 pre-run cost-preview model count: the persisted run's target_count (once a
  //    run has completed) takes precedence as the authoritative measured count; before
  //    any run, fall back to the live configured-target count, then to the in-flight
  //    `targets` once a kickoff sets it. ──
  const previewModelCount =
    runPhase === "running" && targets.length > 0
      ? targets.length
      : (latestRun?.target_count ?? configuredTargetCount)

  if (!skillId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Target className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Open the Trigger Tuner from a skill (Skills → select → Tune triggers).
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Skills
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Decorative left rail — tonal depth anchor (mirrors SkillsPage pane 1). */}
      <div className="w-16 shrink-0 bg-sidebar" />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Focused-surface header: ‹ Skills back + the skill name. */}
        <div className="px-8 pt-6 pb-4 shrink-0 border-b border-border/10">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ChevronLeft className="h-4 w-4" />
            Skills
          </button>
          <div className="flex items-center gap-2.5">
            <Target className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-headline font-bold text-foreground">
              Trigger Tuner{skill ? ` · ${skill.name}` : ""}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Benchmark when this skill should — and should NOT — fire, score candidate
            descriptions cross-provider, and confirm the winner.
          </p>
        </div>

        {/* Two-column body (041-A). On narrow widths it stacks (single column). */}
        <div className="flex-1 overflow-y-auto">
          {skillsLoading && !skill ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground" role="status">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
              Loading skill…
            </div>
          ) : !skill ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
              <p className="text-sm text-destructive">This skill isn&apos;t available.</p>
              <p className="text-xs text-muted-foreground max-w-[32ch]">
                It may have been deleted, or you don&apos;t have access to it.
              </p>
            </div>
          ) : (
            /* D-03: a NARROW left config rail + a materially-WIDER results column — the
               results no longer wedge into a 50/50 half, they get all remaining width.
               On narrow widths it stacks (single column). */
            <div className="grid gap-6 px-8 py-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              {/* LEFT (narrow rail): current description + case editor + run config. */}
              <div className="flex flex-col gap-5 min-w-0">
                {/* The CURRENT live description — "drives firing" honesty label. */}
                <section className="rounded-xl ghost-border bg-card/50 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-primary">
                      current · live · drives firing
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {skill.description?.trim() || (
                      <span className="italic text-muted-foreground">No description yet.</span>
                    )}
                  </p>
                </section>

                <CaseEditor cases={cases} onChange={setCases} skill={skill} seededNotTotal={seededNotTotal} />

                {/* Run config / kickoff bar (cases × N models × 3 repeats). The model
                    count is the CONFIGURED-TARGET count pre-run (D-12) — populated on
                    open, not empty until kickoff. */}
                <div className="flex items-center justify-between rounded-xl ghost-border bg-card/50 p-4 shadow-sm">
                  <p data-testid="cost-preview" className="text-xs text-muted-foreground">
                    {cases.length} case{cases.length === 1 ? "" : "s"}
                    {previewModelCount != null
                      ? ` × ${previewModelCount} model${previewModelCount === 1 ? "" : "s"}`
                      : ""} × 3 repeats
                  </p>
                  <Button size="sm" onClick={startRun} disabled={runPhase === "running"}>
                    {runPhase === "running" ? "Running…" : "Run tuning"}
                  </Button>
                </div>
              </div>

              {/* RIGHT (full-remaining-width results): D-04 standalone block + live run +
                  candidate cards + attribution. */}
              <div data-testid="tuner-results" className="flex flex-col gap-5 min-w-0">
                {/* D-04 standalone per-provider scoreboard for the BASELINE (current/live
                    description) — distinct from the per-candidate grids. Server cells only. */}
                {baselineCandidate && baselineCandidate.cells.length > 0 && (
                  <section
                    data-testid="baseline-scoreboard"
                    className="rounded-xl ghost-border bg-card/50 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-mono text-primary">
                        current description · per-provider scores
                      </span>
                      {latestRun && (
                        <span
                          data-testid="run-attribution"
                          className="text-[10px] font-mono text-muted-foreground text-right"
                        >
                          Built by {latestRun.builder_model} · measured on {latestRun.target_count} model
                          {latestRun.target_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <ProviderScoreboard cells={baselineCandidate.cells} />
                  </section>
                )}

                {(runPhase === "running" || runPhase === "error") && (
                  <LiveRunCard
                    lanes={lanes}
                    startTs={runStartTs}
                    phase={runPhase}
                    error={runError}
                    onCancel={cancelRun}
                  />
                )}

                {scoreboard && scoreboard.candidates.length > 0 ? (
                  <div className="flex flex-col gap-4" data-testid="tuner-candidates">
                    {scoreboard.candidates
                      .slice()
                      .sort((a, b) => b.held_out_score - a.held_out_score)
                      .map((candidate) => (
                        <CandidateCard
                          key={candidate.index}
                          candidate={candidate}
                          isWinner={candidate.index === scoreboard.winner_index}
                          currentDescription={skill.description ?? ""}
                          onConfirm={handleConfirmWinner}
                        />
                      ))}
                  </div>
                ) : runPhase === "idle" ? (
                  <div className="rounded-xl ghost-border bg-card/30 p-8 text-center">
                    <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" aria-hidden="true" />
                    <p className="text-sm text-muted-foreground">
                      Run the benchmark to score candidate descriptions across your
                      configured providers.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
