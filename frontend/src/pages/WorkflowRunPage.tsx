// ─────────────────────────────────────────────────────────────────────────────
// Phase 188 Plan 08 (RUNVIZ-01 / RUNVIZ-02 / RUNVIZ-03 — SPEC Req 6 + Req 7) —
// the run's own room.
//
// The fourth home (sketch 152-B): a run gets a surface with the workflow's identity,
// its canvas run view, an honest one-line verdict and an anchored clock. Entered WITH
// an id and returned via a callback — the `SkillStudioPage` shape, and NO ROUTER (the
// three-homes contract holds; `ActiveView` gains one member and this renders in
// `ChatLayout`'s non-chat `else` branch, wired by Plan 09).
//
// THE ONE INVARIANT THIS PAGE OWNS, and the reason it exists as a page rather than as
// canvas props: **the join from the run's live/durable phase rows onto the definition's
// step specs is BY `phase_index`, never by slug (D-188-01).** The live reconcile
// skeleton can emit positional placeholder slugs for rows the harness has not started,
// so the very value a slug join would key on is the value that can be a placeholder —
// an index cannot. Composing the join HERE is also what keeps the step ordinal out of
// the canvas render path (Req 2) and the canvas diff inside its G-5 cap (Req 8): the
// canvas receives an already-worded `NodeRunState` and derives, words and looks up
// nothing. `WorkflowCanvas.test.tsx` fences all three of those absences.
//
// Two more single-source rules owned here (never re-derived by a consumer):
//   • the whole `NodeRunState` — `canvasReading()` once and `runReadingLabel()` once
//     per node, INCLUDING `label`, so the visible run line and the node's accessible
//     name are the same bytes from the same call;
//   • the elapsed figure, anchored on `claimed_at` and LABELLED with that anchor in
//     plain words (D-188-18) — `workflow_runs` has no `started_at` and no
//     `completed_at`, so an unlabelled clock here would be a lie the moment a run
//     waits in the queue.
//
// RECONNECT-DRIVEN RECONCILE IS CLOSED **LOCALLY, FOR THIS PAGE ONLY.** The shared
// panel reconcile hook behind `usePhases` ships NO `visibilitychange` / `focus` /
// `pageshow` listener (D-086-15, stated in its own docblock), and no production path
// calls the `reconcile()` it returns. This page attaches its own `visibilitychange` +
// `online` listeners and calls that same escape hatch, so a laptop lid closed mid-run
// re-reads truth on wake. **The shared hook is NOT modified** — changing it would alter
// every panel consumer's behaviour and is not in this phase's scope — and therefore
// reconnect-driven reconcile remains UNSHIPPED globally. That is a recorded gap, not a
// closed one.
//
// This surface ships ZERO destructive actions and zero run-mutating ones: nothing here
// stops a run, restarts one, or resumes a step-capped one (SPEC out of scope).
// `cap_paused` gets a WORD (D-188-19). The only two controls are the two navigations.
//
// ⚠ Those absences are fenced by a literal grep, so the words for the controls this file
// must not have are deliberately left UNSPELLED here and below — a comment that names
// them would satisfy the grep and turn a measurement into prose (the 187-24 lesson, met
// again by 188-03 and 188-07). 188-UI-SPEC § Copywriting Contract names all four in full.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getWorkflowRun, type WorkflowRunRead } from "@/lib/api"
import { ApiError } from "@/lib/api"
import {
  canvasReading,
  phaseStatusFromDb,
  TERMINAL_RUN_STATUSES,
  type CanvasReading,
} from "@/lib/phaseState"
import { runReadingLabel, type NodeRunState } from "@/components/workflows/runVocabulary"
import { nodeTitle, type PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas"
import { usePhases } from "@/providers/StreamsProvider"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
import type { Phase } from "@/types"

interface Props {
  /** The `workflow_runs.id` to open. ⚠ NOT a producer `runs.run_id` — see
   *  `WorkflowRunRead`'s docblock. A null id renders the calm guard. */
  runId: string | null
  /** Return to the Workflows library ("‹ Workflows"). */
  onBack: () => void
  /** Open the run's chat thread — the D-188-13 seam, and the route to the developer
   *  timeline where a failure's free-form detail lives. */
  onOpenThread: (threadId: string) => void
}

// ── Copy (188-UI-SPEC § Copywriting Contract — verbatim, single-sourced) ────────

const COPY_LOADING = "Opening the run…"
const COPY_MISSING_HEAD = "That run isn't available."
const COPY_MISSING_BODY = "It may have been deleted, or it belongs to another account."
const COPY_BROKEN_HEAD = "We couldn't load this run."
const COPY_BROKEN_BODY = "Something went wrong on our side. Nothing about the run has changed."
const COPY_BACK = "‹ Back to Workflows"
const COPY_OPEN_THREAD = "Open the chat thread"
/** The queued reading. Used in BOTH the run band and the elapsed slot, from one
 *  constant, so the two can never word the same fact differently. */
const WAITING_TO_START = "Waiting to start"

// ── The elapsed figure (D-188-18) ──────────────────────────────────────────────

/**
 * `< 60s → 12s` · `< 60m → 4m 12s` · else `1h 06m`. A local formatter sited next to its
 * one consumer, in the `FilesSection.tsx:38-42` house shape — NO date library is added
 * for one label, and none is wanted: the three branches below are the entire contract.
 */
function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`
}

/** Parse a wire timestamp to epoch ms, or `null` when it is absent/unparseable. An
 *  unparseable anchor is treated exactly like a missing one — it may never become a
 *  `NaN` that renders as a number-shaped string. */
function epochOf(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

// ── The run band: a TOTAL function over `workflow_runs.status` ──────────────────

/**
 * The band's three loudness tiers are INHERITED from 129-C (D-188-20), never
 * re-invented: tier 1 dim = the user did it on purpose · tier 2 amber framed = the run
 * hit the step ceiling · tier 3 red framed = it broke. Everything else is quiet.
 */
type BandTone =
  | "queued"
  | "running"
  | "waiting"
  | "capped"
  | "complete"
  | "failed"
  | "cancelled"
  | "unknown"

interface BandReading {
  /** The state sentence — the ONLY thing inside the polite live region. */
  sentence: string
  tone: BandTone
}

const BAND_TONE_CLASS: Record<BandTone, string> = {
  queued: "text-muted-foreground",
  running: "text-primary",
  waiting: "text-[hsl(var(--warning))]",
  capped:
    "rounded-md border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.08)] px-2 py-1 text-[hsl(var(--warning))]",
  complete: "text-foreground",
  failed:
    "rounded-md border border-destructive bg-destructive/10 px-2 py-1 text-[hsl(0_80%_80%)]",
  cancelled: "text-muted-foreground",
  unknown: "rounded-md border border-border px-2 py-1 text-muted-foreground",
}

/**
 * Read the run band, TOTALLY.
 *
 * ⚠ The last arm is the point of the function. An unrecognised `workflow_runs.status` —
 * a value from a newer server, a typo, a status this client has never heard of — reads
 * **State unknown**, and NEVER *Complete*. This is the same discipline `phaseStatusFromDb`
 * applies one level down, and the third occurrence of one lesson in this codebase: the
 * publish gauntlet's `findIndex → -1` painted an unrecognised blocked stage as 8/8 green.
 * A fallback that claims MORE than its input supports is a fail-open.
 *
 * It is written as a `switch` with a `default:` rather than as an object literal indexed
 * by the server string, and that is deliberate for a second reason: a plain object
 * literal INHERITS `constructor`, `toString` and friends, so `TABLE[key] ?? fallback` is
 * NOT total — the inherited member is never nullish, so the fallback never fires and a
 * *function* comes back typed as the value type (measured in 188-05; the observed value
 * for `"constructor"` was `[Function Object]`).
 */
function readBand(status: string, claimedAt: string | null, failedStepTitle: string | null): BandReading {
  switch (status) {
    case "active":
      // A claimed-nothing run is QUEUED, not running — and it says so with no clock.
      return claimedAt == null
        ? { sentence: WAITING_TO_START, tone: "queued" }
        : { sentence: "● Running", tone: "running" }
    case "paused":
      return { sentence: "Paused for your answer", tone: "waiting" }
    case "cap_paused":
      // D-188-19 — a WORD, never a button. The resume affordance a capped run would
      // want is out of SPEC scope, so this surface states the fact and offers nothing.
      return {
        sentence: "Paused at the step limit — it stopped after the maximum number of steps.",
        tone: "capped",
      }
    case "completed":
      return { sentence: "✓ Complete", tone: "complete" }
    case "failed":
      // Named by TITLE, never by index: on a 1040px viewport a 5-phase spine puts the
      // last node off-screen, so a failure on the final step would otherwise be invisible.
      return {
        sentence: failedStepTitle ? `✕ Failed at "${failedStepTitle}"` : "✕ Failed",
        tone: "failed",
      }
    case "cancelled":
      return { sentence: "⊘ Cancelled", tone: "cancelled" }
    default:
      return {
        sentence: "State unknown — this run reported a state we don't recognise.",
        tone: "unknown",
      }
  }
}

/** The two run-level states that earn an assertive announcement (UI-SPEC § Live-region
 *  policy). Per-NODE changes are never announced: a 5-phase run produces 10+ transitions
 *  and announcing each renders the surface unusable for a screen-reader user. */
const ALERTING_STATUSES = new Set(["failed", "cap_paused"])

// ── The page ───────────────────────────────────────────────────────────────────

type LoadPhase = "loading" | "ready" | "missing" | "broken"

export function WorkflowRunPage({ runId, onBack, onOpenThread }: Props) {
  const [run, setRun] = useState<WorkflowRunRead | null>(null)
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("loading")
  /** Bumped by "Try again" — a retry is a NEW read of the same id, never a mutation. */
  const [retryNonce, setRetryNonce] = useState(0)
  const currentRunRef = useRef(runId)

  // The app-wide ⌥ reveal, READ (never owned) here. Null outside a provider — the page
  // then renders plain language, exactly like every other leaf reader. NO second toggle
  // is rendered on this surface: the canvas ships the shipped one in its own header and
  // it reads this same provider, so the header's `claimed_at` reveal and the canvas's
  // subtitle reveal flip together from one control. Two controls that disagree is the
  // exact LANG-01 failure that provider exists to prevent.
  const technicalNames = useTechnicalNamesOptional()
  const showTechnical = technicalNames?.showTechnical ?? false

  // ── The read (the SkillStudioPage:75-100 stale-response guard, verbatim in shape) ──
  useEffect(() => {
    currentRunRef.current = runId
    // Reset on run switch — no prior run's payload, spine or verdict may leak onto a
    // newly-opened run.
    setRun(null)
    if (!runId) {
      setLoadPhase("loading")
      return
    }
    setLoadPhase("loading")
    const requested = runId
    let cancelled = false
    const alive = () => !cancelled && currentRunRef.current === requested
    getWorkflowRun(requested)
      .then((r) => {
        if (!alive()) return
        setRun(r)
        setLoadPhase("ready")
      })
      .catch((err: unknown) => {
        if (!alive()) return
        // 404 is BOTH "no such run" and "not yours" — the server makes them
        // indistinguishable on purpose (T-092-04), so the copy names both possibilities
        // rather than asserting the one we cannot know.
        const status = err instanceof ApiError ? err.status : 0
        setLoadPhase(status === 404 ? "missing" : "broken")
      })
    return () => {
      cancelled = true
    }
  }, [runId, retryNonce])

  // ── The live slice. This page is the ONLY component on this surface that touches the
  //    stream (067.5 Branch-D3): one subscription, one join, one lookup handed down. ──
  const { data: livePhases, reconcile } = usePhases(run?.thread_id ?? null)

  // Reconnect-driven reconcile, LOCAL to this page (see the header docblock). The shared
  // hook is untouched; this only calls the escape hatch it already returns.
  useEffect(() => {
    if (!run?.thread_id) return
    const onWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void reconcile()
    }
    window.addEventListener("visibilitychange", onWake)
    window.addEventListener("online", onWake)
    return () => {
      window.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("online", onWake)
    }
  }, [run?.thread_id, reconcile])

  /** The definition's step specs — the version that RAN (D-188-14), read defensively:
   *  a definition the server could not load degrades to an empty spine rather than a
   *  throw, and the header says so by way of the empty name. */
  const specs = useMemo<PhaseSpecJSON[]>(() => {
    const raw = (run?.definition as { phases?: unknown } | null | undefined)?.phases
    return Array.isArray(raw) ? (raw as PhaseSpecJSON[]) : []
  }, [run])

  /**
   * THE JOIN KEY (D-188-01). The live slice when there is one; otherwise the inline
   * `run.phases` array a terminal run carries, mapped through `phaseStatusFromDb` so the
   * terminal seed goes through **the same `canvasReading` function** as the live one.
   * There is no second derivation and no second vocabulary — Req 8's grep returns zero
   * either way, and a re-opened finished run cannot disagree with the run it was.
   */
  const byIndex = useMemo(() => {
    const m = new Map<number, Phase>()
    if (livePhases.length > 0) {
      for (const p of livePhases) m.set(p.phaseIndex, p)
      return m
    }
    for (const row of run?.phases ?? []) {
      m.set(row.phase_index, {
        slug: row.slug,
        phaseIndex: row.phase_index,
        phaseType: row.phase_type ?? "unknown",
        status: phaseStatusFromDb(row.status),
        subAgents: [],
        pendingAsk: null,
      })
    }
    return m
  }, [livePhases, run])

  /** slug → the whole worded run state. Built ONCE per (specs, rows) pair, over the
   *  DEFINITION's steps — so a step the run never reached still gets a reading rather
   *  than falling off the spine. */
  const runStateBySlug = useMemo(() => {
    const m = new Map<string, NodeRunState>()
    for (const spec of specs) {
      const phase = byIndex.get(spec.phase_index)
      const reading: CanvasReading = canvasReading(phase)
      const emitFailure = phase?.emitFailure ?? null
      m.set(spec.slug, { reading, label: runReadingLabel(reading, emitFailure), emitFailure })
    }
    return m
  }, [specs, byIndex])

  /**
   * ⚠ `useCallback`, NOT an inline arrow at the call site. An inline arrow is a NEW
   * function identity on every render of this page, which invalidates the canvas's
   * `settledNodes` memo every time and re-creates every node object — dropping React
   * Flow's `measured` dimensions and flickering the cards. 188-07 pinned that memo split
   * with a test; defeating it from here would go red there rather than silently.
   */
  const runState = useCallback((slug: string) => runStateBySlug.get(slug), [runStateBySlug])

  // ── The elapsed figure (D-188-18) ────────────────────────────────────────────
  const runStatus = run?.status ?? ""
  const isTerminal = TERMINAL_RUN_STATUSES.has(runStatus)
  const claimedMs = epochOf(run?.claimed_at)
  const updatedMs = epochOf(run?.updated_at)

  // The once-per-second tick, and ONLY while the run is live and actually anchored. A
  // terminal run's figure is frozen, so it re-renders nothing.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const ticking = !isTerminal && claimedMs != null && loadPhase === "ready"
  useEffect(() => {
    if (!ticking) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [ticking])

  /**
   * The elapsed slot: a number and the field it derives from, or NOTHING AT ALL.
   *
   * `claimed_at == null` renders no digit, no clock and no "0s". An unlabelled clock
   * that silently means *since queued* is a lie the moment a run waits, and a "0s" is
   * worse than silence because it claims a measurement that was never taken.
   */
  const elapsed: { text: string; number: string | null } = useMemo(() => {
    if (claimedMs == null) return { text: WAITING_TO_START, number: null }
    if (isTerminal) {
      const end = updatedMs ?? claimedMs
      return {
        text: "— from when it started processing to its last update",
        number: `Ran for ${fmtElapsed(end - claimedMs)}`,
      }
    }
    return { text: "since it started processing", number: fmtElapsed(nowMs - claimedMs) }
  }, [claimedMs, updatedMs, isTerminal, nowMs])

  // ── The band ────────────────────────────────────────────────────────────────
  /** The failing step's TITLE — the same `nodeTitle` the canvas paints on the face, so
   *  the band names a step the user can actually find. Never the slug, never the index. */
  const failedStepTitle = useMemo(() => {
    const hit = specs.find((s) => runStateBySlug.get(s.slug)?.reading === "failed")
    return hit ? nodeTitle(hit) : null
  }, [specs, runStateBySlug])

  const band = useMemo(
    () => readBand(runStatus, run?.claimed_at ?? null, failedStepTitle),
    [runStatus, run?.claimed_at, failedStepTitle],
  )

  /**
   * The assertive notice — fires exactly ONCE per run, when the run is observed in a
   * state the user must not miss. Kept separate from the polite band because the band's
   * job is to be readable, not to interrupt; this is the shipped panel's
   * polite-announcer / separate-alert split.
   */
  const [alertText, setAlertText] = useState<string | null>(null)
  const alertedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (loadPhase !== "ready" || !run) return
    if (!ALERTING_STATUSES.has(run.status)) return
    if (alertedForRef.current === run.id) return
    alertedForRef.current = run.id
    setAlertText(band.sentence)
  }, [loadPhase, run, band.sentence])

  // ── The three states that are not a run ─────────────────────────────────────

  if (!runId || loadPhase === "loading") {
    // No skeleton spine: it would imply nodes that may not exist.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">{COPY_LOADING}</p>
      </div>
    )
  }

  if (loadPhase === "missing" || loadPhase === "broken") {
    const missing = loadPhase === "missing"
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <h1 className="font-headline text-xl font-semibold text-foreground">
          {missing ? COPY_MISSING_HEAD : COPY_BROKEN_HEAD}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {missing ? COPY_MISSING_BODY : COPY_BROKEN_BODY}
        </p>
        <div className="flex items-center gap-2">
          {missing ? null : (
            <Button size="sm" onClick={() => setRetryNonce((n) => n + 1)}>
              Try again
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onBack}>
            {COPY_BACK}
          </Button>
        </div>
      </div>
    )
  }

  // ── The run ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 1. HEADER — orientation, never a focal point. The only accent it spends is the
             seam link. */}
      <header className="flex shrink-0 flex-col gap-2 border-b border-border/10 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Workflows
        </button>
        <div className="flex items-center gap-3">
          <h1 className="font-headline text-xl font-semibold leading-tight text-foreground">
            {run?.workflow_name || "Workflow"}
          </h1>
          <span className="font-mono text-xs text-muted-foreground">v{run?.workflow_version}</span>
          <button
            type="button"
            onClick={() => run && onOpenThread(run.thread_id)}
            className="ml-auto text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            {COPY_OPEN_THREAD}
          </button>
        </div>
        {/* The status word + the ANCHORED clock. The number is a plain child here (not a
            live region), so it re-renders once a second without ever being announced. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xs font-semibold text-foreground">{band.sentence}</span>
          <span className="text-xs text-muted-foreground" data-testid="run-elapsed">
            {elapsed.number ? <span>{elapsed.number} </span> : null}
            {elapsed.text}
          </span>
          {showTechnical ? (
            <span className="font-mono text-[11px] text-muted-foreground" data-testid="run-elapsed-technical">
              {isTerminal && run?.claimed_at
                ? `claimed_at ${run?.claimed_at} → updated_at ${run?.updated_at}`
                : `claimed_at ${run?.claimed_at ?? "null"}`}
            </span>
          ) : null}
        </div>
      </header>

      {/* 2. RUN BAND — exactly ONE line, truncating. The polite region carries the state
             SENTENCE only; the ticking number lives in an aria-hidden sibling, because a
             per-second announcement is a denial of service for a screen-reader user. */}
      <div className="flex shrink-0 items-center gap-2 px-6 py-2 text-sm">
        <span
          aria-live="polite"
          aria-atomic="true"
          data-testid="run-band"
          className={cn("min-w-0 truncate", BAND_TONE_CLASS[band.tone])}
        >
          {band.sentence}
        </span>
        {elapsed.number ? (
          <span aria-hidden="true" className="shrink-0 text-xs text-muted-foreground">
            · {elapsed.number}
          </span>
        ) : null}
      </div>
      {/* Fires once, on the run reaching a state the user must not miss. */}
      <div role="alert" className="sr-only" data-testid="run-alert">
        {alertText}
      </div>

      {/* 3. CANVAS REGION — the focal point. The canvas ships its own header row and its
             own ⌥ toggle; this surface adds neither, and does not reword its shipped
             view-only copy (which is correct on a run surface). */}
      <section
        aria-busy={!isTerminal}
        data-testid="run-canvas-region"
        className="min-h-0 min-h-[320px] flex-1 px-6"
      >
        <WorkflowCanvas
          phases={specs}
          selectedSlug={null}
          onSelectNode={noop}
          onClearSelection={noop}
          editable={false}
          runState={runState}
        />
      </section>

      {/* 4. DELIVERABLE REGION — the frame only. **Plan 188-10 fills it**; this plan
             fetches no files and renders no rows, so the heading below is the region's
             identity rather than a claim about contents. (Plan 188-09 is the launch
             retarget and never touches this file.) */}
      <section
        data-testid="run-deliverables"
        className="max-h-[220px] shrink-0 overflow-auto border-t border-border/10 px-6 py-4"
      >
        <h2 className="text-xs font-semibold text-foreground">What this run produced</h2>
      </section>
    </div>
  )
}

/** The canvas requires both selection callbacks; this surface has no selection at all
 *  (`selectedSlug` is permanently null), so they are inert by construction rather than
 *  by discipline. Module-scope, so the identity is stable across renders. */
function noop() {}
