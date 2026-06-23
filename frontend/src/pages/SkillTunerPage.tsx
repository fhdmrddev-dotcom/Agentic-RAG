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
  ApiError,
  type TunerTarget,
  type TunerScoreboard,
  type TunerCandidate,
} from "@/lib/api"
import type { Skill } from "@/types"

interface Props {
  /** The skill being tuned. App holds this selection (per-view state); a null id
   *  means the surface was opened without a target — render a calm guard. */
  skillId: string | null
  /** Return to the 3-pane Skills surface ("‹ Skills"). */
  onBack: () => void
}

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

  // Cancel any in-flight stream on unmount / skill switch (leave-and-reconcile).
  useEffect(() => {
    return () => abortRef.current?.abort()
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
      void streamTunerRun(
        skillId,
        started.run_id,
        {
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
            if (status === "error") {
              setRunPhase("error")
              setRunError(reason ?? "The tuning run failed.")
              return
            }
            setRunPhase("done")
            // Reconcile the final scoreboard from the authoritative GET results
            // (the SSE tuner_complete is a best-effort hint — D-v2.5-03).
            getTunerResults(skillId, started.run_id)
              .then(setScoreboard)
              .catch(() => {
                /* keep the SSE-carried scoreboard if results read fails */
              })
          },
        },
        "0",
        controller.signal,
      )
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
            <div className="grid gap-6 px-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* LEFT: current description + case editor + run config. */}
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

                <CaseEditor cases={cases} onChange={setCases} skill={skill} />

                {/* Run config / kickoff bar (cases × N models × 3 repeats). */}
                <div className="flex items-center justify-between rounded-xl ghost-border bg-card/50 p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">
                    {cases.length} case{cases.length === 1 ? "" : "s"}
                    {targets.length > 0 ? ` × ${targets.length} model${targets.length === 1 ? "" : "s"}` : ""} × 3 repeats
                  </p>
                  <Button size="sm" onClick={startRun} disabled={runPhase === "running"}>
                    {runPhase === "running" ? "Running…" : "Run tuning"}
                  </Button>
                </div>
              </div>

              {/* RIGHT: live run + scoreboard + candidate cards. */}
              <div className="flex flex-col gap-5 min-w-0">
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
