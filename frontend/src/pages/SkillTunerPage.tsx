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
import { ChevronLeft, Target, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSkills } from "@/hooks/useSkills"
import { CaseEditor, type EditorCase } from "@/components/skills/tuner/CaseEditor"
import { ProviderScoreboard } from "@/components/skills/tuner/ProviderScoreboard"
import { CandidateCard } from "@/components/skills/tuner/CandidateCard"
import { LiveRunCard, type ProviderLane } from "@/components/skills/tuner/LiveRunCard"
import {
  startTunerRun,
  getTunerResults,
  streamTunerRun,
  cancelTunerRun,
  getSeededCases,
  getTunerLatest,
  getSettings,
  proposeDescription,
  getLatestDescriptionProposal,
  approveDescriptionProposal,
  rejectDescriptionProposal,
  ApiError,
  type TunerTarget,
  type TunerScoreboard,
  type TunerStreamCallbacks,
  type LatestTunerRun,
} from "@/lib/api"
import { DescriptionProposalCard } from "@/components/skills/studio/DescriptionProposalCard"
import type { Skill, SkillProposal } from "@/types"

interface Props {
  /** The skill being tuned. App holds this selection (per-view state); a null id
   *  means the surface was opened without a target — render a calm guard. */
  skillId: string | null
  /** Return to the 3-pane Skills surface ("‹ Skills"). */
  onBack: () => void
  /** Phase 137 Plan 06 (D-01/D-02): when mounted as the Studio "Triggering" tab, the
   *  Studio's persistent header already carries the ‹ Skills back + skill identity, so
   *  this page's own focused-surface header block is suppressed to avoid a doubled
   *  header. This is the checker-sanctioned one-line render guard — it changes NO tuner
   *  behavior/internals (the 041/042/043/045 winners stay intact, honoring D-02); when
   *  unset the standalone page renders exactly as before. */
  embedded?: boolean
  /** Phase 176 Plan 02 (RENDER-04): when mounted as the Studio "Triggering" tab, the
   *  shell passes its refreshVersions callback here. handleApproveDescription calls it
   *  after approveDescriptionProposal resolves so the shell re-runs listSkillVersions and
   *  re-derives the live version — the header vN + Versions LIVE badge update with no
   *  reload (BUG-260706-01). Undefined for the standalone page → behaves exactly as
   *  before (loadSkills only). */
  onVersionPromoted?: () => void
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

// WR-03: the backend caps the scored target set at MAX_TARGETS (skill_tuner.py:67). The pre-run
// cost preview must clamp to the SAME bound so the "× N models" line never over-states what the
// run will actually score when an org has >8 keyed providers (the honesty class TT-12 closes on
// the backend). Keep this in lockstep with backend MAX_TARGETS.
const MAX_TARGETS = 8

// The lane status vocabulary for the live run (043-A): a queued provider NEVER shows
// a fake percent — queued ≠ running. "reconciling" (Phase 123.1-08 / TT-14) is the
// post-'done' sub-state held while getTunerResults resolves: the LiveRunCard stays
// mounted (no empty-pane flash) and the scoreboard is not nulled.
type RunPhase = "idle" | "running" | "reconciling" | "done" | "error"

export function SkillTunerPage({ skillId, onBack, embedded, onVersionPromoted }: Props) {
  // The Tuner reuses useSkills() to read the live skill list. The one-click apply that
  // used updateSkill (PATCH /skills) is replaced by the SI-02 propose door (D-08); manual
  // description edits still use useSkills().updateSkill from the SkillsPage. `loadSkills`
  // re-reads the list after an approve lands (WR-05 — reconcile-via-fetch, D-v2.5-03).
  const { skills, loading: skillsLoading, loadSkills } = useSkills()
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
  // Phase 123.1-08 (TT-09): an HONEST seeded-fetch-failure note. A getSeededCases failure used to
  // silently setCases([]) → the editor showed "0 cases", the cost-preview read "0 cases × N
  // models" as if zero were the measured truth, and the POST sent cases=[] (the backend then
  // auto-seeds server-side and scores generic off-topic). On failure we now log the swallowed
  // error AND set this note so the empty state is honest (the run still auto-seeds). null = no
  // failure (cleared on a successful fetch).
  const [seededError, setSeededError] = useState<string | null>(null)

  // ── Run state. The elapsed timer derives from a STABLE start-ts (the 095
  //    never-vanishes lesson) — set once at kickoff, never reset on a transient
  //    stream-end. LiveRunCard reads runStartTs. ──
  const [runPhase, setRunPhase] = useState<RunPhase>("idle")
  const [runId, setRunId] = useState<string | null>(null)
  const [runStartTs, setRunStartTs] = useState<number | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  // Phase 123.1-08 (TT-16): an HONEST non-error "still running" note shown when reconnects are
  // exhausted but the durable latest row proves THIS run persisted server-side. It is NOT a
  // failure (no red error) — the job keeps grinding; the author can leave and reopen. null when
  // there's nothing to say (cleared on a fresh kickoff and whenever the run terminates honestly).
  const [runBackgroundNote, setRunBackgroundNote] = useState<string | null>(null)
  const [targets, setTargets] = useState<TunerTarget[]>([])
  const [lanes, setLanes] = useState<ProviderLane[]>([])
  const [scoreboard, setScoreboard] = useState<TunerScoreboard | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Phase 139 (SI-02, D-08): the description-proposal review state. `descProposal`
  //    holds the reconciled server proposal opened by the winner's "Propose this
  //    description" door; the DescriptionProposalCard renders its diff + per-provider
  //    scoreboard + Approve/Reject. `descError` surfaces an approve/reject failure. ──
  const [descProposal, setDescProposal] = useState<SkillProposal | null>(null)
  const [descError, setDescError] = useState<string | null>(null)

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
  //    mount / skill-switch we fetch four things authoritatively:
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

    // WR-01 (139 review): reset the per-skill run + proposal state on mount / skill switch.
    // `runId` feeds handleConfirmWinner (a stale/wrong-skill id 409s at the propose door with a
    // misleading "the tuner has re-run since"), and `descProposal` mounts a review card (skill
    // A's diff + Approve must never render inside skill B's results). The scoreboard/latestRun
    // are NOT nulled here — getTunerLatest below reconciles them authoritatively (D-v2.5-03).
    setRunId(null)
    setRunPhase("idle")
    setLanes([])
    setRunError(null)
    setRunBackgroundNote(null)
    setDescProposal(null)
    setDescError(null)

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
        // A successful fetch clears any stale seeded-fetch-failure note (TT-09).
        setSeededError(null)
      })
      .catch((err) => {
        // TT-09: a seeded-cases read failure is non-fatal (the author can add cases manually +
        // the run auto-seeds server-side), but it is NEVER silent: log the swallowed error AND
        // surface an honest inline note so the editor's "0 cases" / the cost-preview do not
        // present zero as the measured truth.
        console.error("tuner: getSeededCases failed", err)
        if (!cancelled) {
          setCases([])
          setSeededNotTotal(undefined)
          setSeededError(
            "Couldn't load the seeded benchmark cases — add cases manually, or run to auto-seed.",
          )
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

    // 4. WR-04 (139 review): rehydrate the durable description proposal (SI-02) so a
    //    status='proposed' review card survives reload/navigation. Without this the only
    //    recovery was clicking "Propose this description" again, which supersedes the original
    //    to 'rejected' (audit clutter) and re-snapshots. Rejected rows are ignored (the card
    //    renders nothing for them); a read failure is non-fatal (the propose door still works).
    getLatestDescriptionProposal(skillId)
      .then((latest) => {
        if (cancelled) return
        setDescProposal(latest && latest.status !== "rejected" ? latest : null)
      })
      .catch(() => {
        if (!cancelled) setDescProposal(null)
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
    setRunBackgroundNote(null) // TT-16: clear any stale "still running" note on a fresh kickoff
    // WR-01 (139 review): a fresh run invalidates the open review card — approving an OLD run's
    // proposal while looking at NEW evidence would apply the old winner (approve has no
    // staleness gate against a re-run; the card must not outlive the evidence it reviewed).
    setDescProposal(null)
    setDescError(null)
    // TT-14 (no-flash): do NOT null the scoreboard if a durable latest result is already shown —
    // keep the prior scoreboard visible until the new run's result arrives (it's replaced in
    // place on completion). Only clear when there is nothing durable to show (so a stale
    // ephemeral scoreboard from a previous in-session run doesn't linger past a fresh kickoff).
    if (!latestRun) setScoreboard(null)
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
          // TT-07: the backend emits a tuner_progress event with stage="provider_start"
          // carrying provider+model at the START of each column (BEFORE the per-case loop),
          // so the matching lane flips queued→running the moment scoring begins — lanes no
          // longer sit "queued" for the whole run, then jump to "done". This is the honest
          // queued/running/done vocabulary (LiveRunCard) — provider_start only moves
          // queued→running, never fabricates a percent.
          const prov = data.provider as string | undefined
          const mdl = data.model as string | undefined
          if (data.stage === "provider_start" && prov) {
            setLanes((prev) =>
              prev.map((l) =>
                l.provider === prov && (!mdl || l.model === mdl) && l.status === "queued"
                  ? { ...l, status: "running" as const }
                  : l,
              ),
            )
            return
          }
          // Legacy/idempotent: a provider whose cell starts flips queued→running (no fake %).
          // Harmless to keep — provider_start above is the load-bearing pre-completion signal.
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
                  // TT-16: reconnects exhausted. getTunerResults still 404s (it only resolves once
                  // the WHOLE job finishes), but the job may simply be slow — so DON'T immediately
                  // flip to a scary red error. Poll the DURABLE latest row and keep "still running"
                  // ONLY when its run_id matches THIS run (so a previous run's durable row can
                  // never mask a genuinely-dead current run). A null/404 OR a mismatched row means
                  // the current run is dead → take the honest hard-error terminal (NOT stuck).
                  getTunerLatest(skillId)
                    .then((latest) => {
                      if (controller.signal.aborted) return
                      if (latest && latest.run_id === runIdForStream) {
                        // THIS run persisted a durable row — it's still active (or just finished
                        // and the durable upsert landed); keep it honest, no red error.
                        setScoreboard(latest.scoreboard)
                        setLatestRun(latest)
                        setRunPhase("running")
                        setRunError(null)
                        setRunBackgroundNote(
                          "Still running — this is taking a while. You can leave; reopen this skill to load the finished scoreboard.",
                        )
                      } else {
                        // No durable row for THIS run (null/404) OR only a PREVIOUS run's row
                        // exists — the current run is genuinely dead. Honest hard-error terminal.
                        setRunPhase("error")
                        setRunId(null) // WR-01: a dead run's id must not feed the propose door
                        setRunError(
                          "Lost the live connection to the tuning run. Reopen this skill to load the finished scoreboard.",
                        )
                      }
                    })
                    .catch(() => {
                      if (controller.signal.aborted) return
                      // The durable poll itself failed — we cannot prove the run is alive, so a
                      // dead run must still reach an honest terminal (never stuck forever).
                      setRunPhase("error")
                      setRunId(null) // WR-01: a dead run's id must not feed the propose door
                      setRunError(
                        "Lost the live connection to the tuning run. Reopen this skill to load the finished scoreboard.",
                      )
                    })
                }
              })
            return
          }

          // A genuine error terminal (run_not_found / streaming_unavailable / etc.).
          if (status === "error") {
            setRunPhase("error")
            setRunId(null) // WR-01: a failed run's id must not feed the propose door
            setRunError(reason ?? "The tuning run failed.")
            return
          }

          // TT-14 (no-flash): the job is done, but getTunerResults hasn't resolved yet. Hold the
          // card in "reconciling" (it stays MOUNTED with a frozen timer + "finishing — loading
          // results…") rather than unmounting into an empty pane, THEN drop to "done" once the
          // authoritative scoreboard arrives (the SSE tuner_complete is a best-effort hint —
          // D-v2.5-03). On a results-read failure we still leave "reconciling" → "done", keeping
          // whatever the SSE carried (never a flash, never a hard error for a finished run).
          setRunPhase("reconciling")
          getTunerResults(skillId, runIdForStream)
            .then((sb) => {
              setScoreboard(sb)
              setRunPhase("done")
            })
            .catch(() => {
              // keep the SSE-carried scoreboard if the results read fails — still leave reconciling.
              setRunPhase("done")
            })
        },
      }

      void streamTunerRun(skillId, runIdForStream, callbacks, "0", controller.signal)
    } catch (err) {
      setRunPhase("error")
      // WR-01: the kickoff failed — a retained PREVIOUS run's id must not feed the propose door
      // (handleConfirmWinner falls back to the durable latestRun.run_id, which matches the
      // scoreboard actually displayed).
      setRunId(null)
      setRunError(
        err instanceof ApiError && err.status === 409
          ? "A tuning run is already in progress for this skill."
          : "Couldn't start the tuning run. Please try again.",
      )
    }
    // latestRun gates the TT-14 keep-scoreboard-on-kickoff behaviour.
  }, [skillId, runPhase, cases, latestRun])

  const cancelRun = useCallback(async () => {
    // TT-08: a REAL cancel — abort the local SSE AND tell the server to stop the job so it
    // stops burning paid provider calls + releases the in-flight claim (a retry no longer
    // 409s). The DELETE is best-effort: a failure is logged but the local UI still goes idle
    // (the server cancel is best-effort; the UI must never get stuck "running").
    abortRef.current?.abort()
    if (skillId && runId) {
      try {
        await cancelTunerRun(skillId, runId)
      } catch (err) {
        // Log but do NOT block the UI transition — the run is cancelled server-side or will
        // self-clear via the TTL'd flag / claim; the local UI must not hang.
        console.warn("tuner cancel DELETE failed (UI still goes idle)", err)
      }
    }
    setRunPhase("idle")
    // WR-01 (139 review): the cancelled run's id must not feed the propose door — the scoreboard
    // still displayed is the durable PREVIOUS run's, so proposing must use latestRun.run_id
    // (the raw runId would 409 with a misleading "the tuner has re-run since").
    setRunId(null)
  }, [skillId, runId])

  // ── Phase 139 (SI-02, D-08): the one-click "apply winning description" is replaced by the
  //    honest propose door. handleConfirmWinner now opens a description PROPOSAL
  //    (proposeDescription → a SkillProposal held in state) instead of a direct PATCH /skills
  //    write; the DescriptionProposalCard reviews the diff + the per-provider scoreboard, and
  //    Approve writes skills.description (the 079 trigger versions it). The tuner run_id is the
  //    in-session runId, or the durable latestRun.run_id on a rehydrated result. It throws on
  //    failure so the CandidateCard's own propose button surfaces the error inline. ──
  const handleConfirmWinner = useCallback(async () => {
    const proposeRunId = runId ?? latestRun?.run_id ?? null
    if (!skillId || !proposeRunId) return
    setDescError(null)
    const proposal = await proposeDescription(skillId, proposeRunId)
    setDescProposal(proposal)
  }, [skillId, runId, latestRun])

  // Approve → writes skills.description (079 trigger versions it). Refetch-not-optimistic:
  // set the card's proposal from the returned promoted row (D-06/D-08). Reject → dismiss.
  const handleApproveDescription = useCallback(async () => {
    if (!skillId || !descProposal) return
    setDescError(null)
    try {
      const updated = await approveDescriptionProposal(skillId, descProposal.id)
      setDescProposal(updated)
      // WR-05 (139 review): the approve wrote skills.description server-side — refetch the
      // skills list (reconcile-via-fetch, D-v2.5-03) so the "current · live · drives firing"
      // section and the baseline "current description" label stop rendering the pre-approve
      // text on the same screen that just said "this description now drives triggering".
      loadSkills().catch(() => {
        // Non-fatal: the server write landed; the header reconciles on the next fetch.
      })
      // 176-02 (RENDER-04 / BUG-260706-01): the 079 trigger snapshotted a NEW skill version
      // on approve. loadSkills reconciles `skill`, but the Studio shell's once-per-skillId
      // `versions` snapshot is now stale, so deriveLiveVersion(skill, staleVersions) keeps
      // showing the pre-approve vN. Ask the shell to refetch its versions list (and bump the
      // Versions-tab nonce) so the header vN + the Versions LIVE badge update with no reload.
      // Undefined on the standalone page → unchanged behavior (loadSkills only).
      onVersionPromoted?.()
    } catch {
      setDescError("Couldn't apply the proposed description. Please try again.")
    }
  }, [skillId, descProposal, loadSkills, onVersionPromoted])

  const handleRejectDescription = useCallback(async () => {
    if (!skillId || !descProposal) return
    setDescError(null)
    try {
      await rejectDescriptionProposal(skillId, descProposal.id)
      setDescProposal(null)
    } catch {
      setDescError("Couldn't dismiss the proposal. Please try again.")
    }
  }, [skillId, descProposal])

  // ── D-04 standalone block: the BASELINE candidate is the current/live description
  //    (TunerCandidate.is_baseline). Its `cells` feed a standalone ProviderScoreboard at
  //    the top of the results area — distinct from the per-candidate grids. Server scores
  //    only (no client fabrication). ──
  const baselineCandidate = useMemo(
    () => scoreboard?.candidates.find((c) => c.is_baseline) ?? null,
    [scoreboard],
  )

  // A run is "active" (in flight) while streaming OR reconciling the final scoreboard
  // (TT-14) — both keep the LiveRunCard mounted and the Run button disabled.
  const runActive = runPhase === "running" || runPhase === "reconciling"

  // WR-05: a winner is only honest when the backend actually measured something. winner_index
  // is null/None for a wholly-unmeasured / cancelled-then-partial run (every candidate's
  // held_out_score is the 0.0 unmeasured fallback). When there is no winner, the UI must NOT
  // badge a noise winner NOR offer the Use/confirm strip (which would PATCH the live description
  // from a degenerate signal) — it renders an honest "could not measure — no winner" note + a
  // read-only per-candidate breakdown instead.
  const hasCandidates = !!scoreboard && scoreboard.candidates.length > 0
  const hasWinner = !!scoreboard && scoreboard.winner_index != null
  const sortedCandidates = useMemo(
    () =>
      scoreboard
        ? scoreboard.candidates.slice().sort((a, b) => b.held_out_score - a.held_out_score)
        : [],
    [scoreboard],
  )

  // 123.1-rev: the winner can BE the baseline (no rewrite beat the current description).
  // Surface that as an explicit verdict instead of leaving N tied cards with no plain-language
  // recommendation — the honest read of winner_index pointing at the is_baseline candidate is
  // "keep your current description".
  const winningCandidate = useMemo(
    () =>
      scoreboard && scoreboard.winner_index != null
        ? scoreboard.candidates.find((c) => c.index === scoreboard.winner_index) ?? null
        : null,
    [scoreboard],
  )
  const winnerIsBaseline = winningCandidate?.is_baseline === true

  // ── D-12 pre-run cost-preview model count: the persisted run's target_count (once a
  //    run has completed) takes precedence as the authoritative measured count; before
  //    any run, fall back to the live configured-target count, then to the in-flight
  //    `targets` once a kickoff sets it.
  //    WR-03: the authoritative in-flight `targets.length` and the durable `target_count` are
  //    already backend-bounded (the run scored ≤ MAX_TARGETS columns). Only the pre-run
  //    `configuredTargetCount` (a raw keyed-provider count) can exceed the cap, so clamp THAT to
  //    MAX_TARGETS — otherwise an org with >8 keyed providers sees "× 10 models" while the run
  //    scores only 8 (the exact over-statement TT-12 closes on the backend). ──
  const previewModelCount =
    runActive && targets.length > 0
      ? targets.length
      : (latestRun?.target_count ??
          (configuredTargetCount != null ? Math.min(configuredTargetCount, MAX_TARGETS) : null))

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
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Focused-surface header: ‹ Skills back + the skill name. Phase 137-06:
            suppressed when `embedded` (mounted as the Studio Triggering tab — the
            Studio header already carries the back + identity; avoids a doubled header). */}
        {!embedded && (
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
        )}

        {/* Full-width single-column stack (sketch 045-B "Full-width stack"). The pre-run
            360px config rail is GONE — the description, the CaseEditor (its two case columns
            now each get ~half the FULL page width), and the run bar stack full-width, so the
            old empty-results void next to a crammed rail no longer exists. Results render
            full-width BELOW the editor once a run produces them (or a durable latest result
            rehydrates on open). The editor stays mounted so the author can re-edit + re-run. */}
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
            <div className="flex flex-col gap-6 px-8 py-6">
              {/* PRE-RUN / always-editable stack: current description → CaseEditor → run bar. */}
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

                {/* TT-09: an HONEST, non-fatal note when the seeded-cases fetch failed — a muted
                    amber line (NOT a toast, NOT an error boundary). It makes the empty editor +
                    the "0 cases" preview honest: zero is a LOAD FAILURE, not the measured truth. */}
                {seededError && (
                  <p
                    data-testid="seeded-error-note"
                    role="status"
                    className="text-xs text-[hsl(var(--panel-status-active))] -mt-2"
                  >
                    {seededError}
                  </p>
                )}

                {/* Run config / kickoff bar (cases × N models × 3 repeats). The model
                    count is the CONFIGURED-TARGET count pre-run (D-12) — populated on
                    open, not empty until kickoff. */}
                <div className="flex items-center justify-between gap-4 rounded-xl ghost-border bg-card/50 p-4 shadow-sm">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <p data-testid="cost-preview" className="text-xs text-muted-foreground">
                      {cases.length} case{cases.length === 1 ? "" : "s"}
                      {/* TT-09: when the seed fetch failed AND there are no cases, "0 cases" is a
                          LOAD FAILURE — say so, never imply zero is the measured truth. */}
                      {seededError && cases.length === 0 ? " (seed load failed)" : ""}
                      {previewModelCount != null
                        ? ` × ${previewModelCount} model${previewModelCount === 1 ? "" : "s"}`
                        : ""} × 3 repeats
                    </p>
                    {/* Honest cost warning: a tuning run is NOT free — it makes live trigger-
                        classification calls to every configured model and consumes provider
                        tokens. Make that explicit so the author re-runs deliberately, not by
                        reflex (the run is the expensive part of the Tuner). */}
                    <p
                      data-testid="cost-warning"
                      className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--panel-status-active))] leading-snug"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" />
                      <span>
                        Running makes live calls to every model above and <span className="font-semibold">uses provider tokens (real cost)</span>. Re-run only when you want fresh scores.
                      </span>
                    </p>
                  </div>
                  <Button size="sm" onClick={startRun} disabled={runActive} className="shrink-0">
                    {runActive ? "Running…" : "Run tuning"}
                  </Button>
                </div>
              </div>

              {/* FULL-WIDTH results — only when a run is live/reconciling/errored OR results
                  exist. Pre-run with no durable result, this whole block is absent (no empty
                  void). Reuses the EXISTING ProviderScoreboard / LiveRunCard / CandidateCard. */}
              {(runActive ||
                runPhase === "error" ||
                (baselineCandidate && baselineCandidate.cells.length > 0) ||
                (scoreboard && scoreboard.candidates.length > 0)) && (
                <div data-testid="tuner-results" className="flex flex-col gap-5 min-w-0">
                  {/* 123.1-rev: score legend (sketch 042) — rendered ONCE above every scoreboard
                      so a first-time author can read the numbers. The build had dropped it. */}
                  <div
                    data-testid="score-legend"
                    className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed"
                  >
                    <span className="font-semibold text-foreground">How to read the scores.</span>{" "}
                    Every number is <span className="font-mono text-foreground">0.00–1.00</span> (1.00 = perfect).{" "}
                    <span className="font-mono text-foreground">fires</span> = should-trigger recall (did the skill load when it should?) ·{" "}
                    <span className="font-mono text-foreground">no-false</span> = should-NOT precision (did it stay quiet when it should?).{" "}
                    A description that fires on everything scores high on <span className="font-mono">fires</span> but fails{" "}
                    <span className="font-mono">no-false</span> — both must be high.{" "}
                    <span className="font-mono text-foreground">held-out</span> = the ~40% of cases never used to pick the winner.
                  </div>

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

                  {/* TT-14: the card renders while running OR reconciling OR error — staying
                      MOUNTED through the done→getTunerResults gap so the pane never flashes
                      empty. The phase union now includes "reconciling" (frozen timer + an
                      honest "finishing — loading results…" footer). */}
                  {(runActive || runPhase === "error") && (
                    <div className="flex flex-col gap-2">
                      <LiveRunCard
                        lanes={lanes}
                        startTs={runStartTs}
                        phase={runPhase === "error" ? "error" : runPhase === "reconciling" ? "reconciling" : "running"}
                        error={runError}
                        onCancel={cancelRun}
                      />
                      {/* TT-16: an HONEST "still running" note (not a red error) shown when
                          reconnects exhausted but the durable latest row proved THIS run persisted. */}
                      {runBackgroundNote && runPhase === "running" && (
                        <p data-testid="run-background-note" role="status" className="text-[11px] text-muted-foreground px-1">
                          {runBackgroundNote}
                        </p>
                      )}
                    </div>
                  )}

                  {/* WR-05: no winner -> an honest "could not measure" note + a READ-ONLY
                      per-candidate breakdown (NO winner badge, NO Use/confirm strip). */}
                  {hasCandidates && scoreboard && !hasWinner && (
                    <div className="flex flex-col gap-4" data-testid="tuner-candidates">
                      <p
                        data-testid="no-winner-note"
                        role="status"
                        className="text-xs text-muted-foreground"
                      >
                        Could not measure — no winner. None of the candidate descriptions scored on
                        a measured provider column (every target was unmeasured), so there is nothing
                        to confirm. Re-run once the provider columns can be measured.
                      </p>
                      {sortedCandidates.map((candidate) => (
                        <section
                          key={candidate.index}
                          data-testid="candidate-readonly"
                          className="rounded-xl ghost-border bg-card/50 p-4 shadow-sm flex flex-col gap-3"
                        >
                          <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                            {candidate.is_baseline ? "current (baseline)" : "candidate"}
                          </span>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {candidate.description}
                          </p>
                          <ProviderScoreboard cells={candidate.cells} />
                        </section>
                      ))}
                    </div>
                  )}

                  {/* The normal winner path: badge the winner + offer the Use/confirm strip. */}
                  {hasCandidates && scoreboard && hasWinner && (
                    <div className="flex flex-col gap-4" data-testid="tuner-candidates">
                      {/* 123.1-rev: plain-language verdict so tied/perfect scores aren't a mystery.
                          winner_index pointing at the baseline = no rewrite beat the current. */}
                      <p
                        data-testid="winner-verdict"
                        role="status"
                        className={cn(
                          "text-xs rounded-lg px-3 py-2 border",
                          winnerIsBaseline
                            ? "text-muted-foreground border-border/40 bg-card/40"
                            : "text-foreground border-primary/30 bg-primary/5",
                        )}
                      >
                        {winnerIsBaseline ? (
                          <>
                            <span className="font-semibold">No candidate beat your current description — keeping it.</span>{" "}
                            The rewrites below scored the same or lower on held-out, so there's nothing to change. Your current description already triggers reliably across the measured providers.
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">A reworded description scored best on held-out.</span>{" "}
                            Review the highlighted candidate below and press <span className="font-mono">Propose this description</span> to open it for review — nothing is applied until you approve.
                          </>
                        )}
                      </p>
                      {/* SI-02 (D-08): the honest review door — mounted once the winner's
                          "Propose this description" opens a proposal. Owns the diff + the
                          per-provider scoreboard + Approve/Reject; Approve writes the live
                          description (079 trigger versions it). */}
                      {descProposal && (
                        <DescriptionProposalCard
                          proposal={descProposal}
                          onApprove={handleApproveDescription}
                          onReject={handleRejectDescription}
                        />
                      )}
                      {descError && (
                        <p role="alert" className="text-xs text-destructive">
                          {descError}
                        </p>
                      )}
                      {sortedCandidates.map((candidate) => (
                        <CandidateCard
                          key={candidate.index}
                          candidate={candidate}
                          isWinner={candidate.index === scoreboard.winner_index}
                          onConfirm={handleConfirmWinner}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
