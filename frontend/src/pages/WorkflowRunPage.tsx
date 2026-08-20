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
// Phase 188 Plan 10 (SPEC Req 7) filled the fourth region — the deliverable list. It is
// sourced from the RUN's thread (`run.thread_id`) through the shipped thread-scoped
// workspace-files read, so the thing the run made is reachable with **zero net-new
// backend wire and no new endpoint**. Every row is a one-click download and NOTHING on
// this surface previews a file; see the region's own docblock for why that is a decision
// rather than a shortfall.
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
// Phase 195 Plan 06 (RUN-03) — the ONE shared file row and the pure helpers behind it.
// The eight lucide file-glyph imports that used to sit above are GONE with the local
// mapping they fed; the glyph now resolves once, inside the shared row.
import { FileRow } from "@/components/files/FileRow"
import { baseName, byNewestFirst, formatBytes } from "@/components/files/fileRowUtils"
// Phase 194.1 Plan 06 — the elapsed formatter, hoisted out of this file VERBATIM so the
// chat run line consumes the shipped one instead of becoming a fourth copy. See the
// docblock where it used to live (search `fmtElapsed NO LONGER LIVES HERE`).
import { fmtElapsed } from "@/lib/fmtElapsed"
import { downloadWorkspaceFile, getWorkflowRun, type WorkflowRunRead } from "@/lib/api"
import { ApiError } from "@/lib/api"
import {
  canvasReading,
  phaseStatusFromDb,
  TERMINAL_RUN_STATUSES,
  type CanvasReading,
} from "@/lib/phaseState"
import { runReadingLabel, type NodeRunState } from "@/components/workflows/runVocabulary"
import { nodeTitle, waitsForYou, type PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
// ── Phase 200-07 (DES-02 / D-09 · `RS-MR-05`) — THE RECEIPT'S FIRST AND ONLY MOUNT ────────
//
// `200-05` created `RunReceipt` and mounted it NOWHERE, deliberately and load-bearingly: it
// keeps `199-02`'s refusal intact BY CONSTRUCTION, because a component the builder cannot
// reach cannot fabricate a run-tense claim about a draft that has no run. Until this line it
// had never rendered in the product. It is mounted HERE and must never be mounted on
// `WorkflowBuilderPage.tsx`; that absence is asserted by grep, on both files.
import { RunReceipt } from "@/components/workflows/RunReceipt"
// The ONE resolver's read shape. ⚠ A TYPE ONLY, and that absence is the point: the page
// derives NO duration and NO span of its own. `min(started_at) → max(completed_at)` has
// exactly one home (`phaseDuration.runSpan`) and exactly one call site (the receipt), so
// there is no second place for the product's first honest total runtime to drift.
import { type PhaseTimingRow } from "@/components/workflows/phaseDuration"
import { WorkflowCanvas } from "@/components/workflows/WorkflowCanvas"
// Phase 194.1 Plan 07 (R3) — the FOURTH and last mount of the ONE shared Stop. It owns its
// own dispatch and its own pressed state; this page hands it a thread id and nothing else.
import { StopControl } from "@/components/chat/StopControl"
// ── Phase 200 — the run surface's right-hand spine. Both are PANEL parts taken as
//    props, not the panel SHELL: see the mount docblock at the canvas region below for
//    why the shell itself cannot come here (a global chat singleton, and the previewer).
import { PhaseTimeline } from "@/components/panel/PhaseTimeline"
import { PendingAskCard } from "@/components/panel/PendingAskCard"
import {
  useAskUserPrompt,
  usePhases,
  useStreamActions,
  useWorkspaceFiles,
} from "@/providers/StreamsProvider"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
import { useGroundingBundle } from "@/hooks/useGroundingBundle"
import type { Phase, WorkspaceFile } from "@/types"

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
/**
 * ⚠ PHASE 199 PLAN 07 (sheet `c8-run-panel`, the "unknown values SAY so" rule) —
 * THE DEGRADE PATH'S HONEST HEADLINE, AND A CORRECTION TO TWO SHIPPED CLAIMS.
 *
 * `WorkflowRunRead`'s docblock records the server's degrade path verbatim: *"if the
 * definition row cannot be read, the server returns `workflow_name: ""` /
 * `workflow_slug: ""` / `workflow_version: 0` / `definition: null` rather than
 * 404ing. Treat an empty `workflow_name` as 'definition unavailable', **never render
 * the empty string**."* And this file's own `specs` memo claims *"the header says so
 * by way of the empty name."*
 *
 * ⚠ MEASURED AT HEAD, BOTH CLAIMS WERE FALSE, and `199-07`'s Task-1 pin recorded the
 * readings before they were touched. The header rendered `{workflow_name || "Workflow"}`
 * — the generic word `Workflow`, a plausible-looking DEFAULT — and beside it `v0`, a
 * fabricated version number that looks exactly like a real one. Neither is the empty
 * string, so the letter of the rule was kept while its whole point was lost: **a
 * plausible wrong value is worse than a blank**, because a blank at least invites a
 * question.
 *
 * The voice is this file's own (`COPY_BROKEN_HEAD` = *"We couldn't load this run."*).
 * It is deliberately about the WORKFLOW's details and not about the run: the run is
 * fine — it has a status, an elapsed figure and its deliverables — and only the
 * definition it was drawn from could not be read.
 *
 * ⚠ THE VERSION CHIP IS OMITTED IN THIS ARM RATHER THAN REWORDED. There is no honest
 * version to print, and absence is the honest reading; `v0` is a claim.
 */
const COPY_NAME_UNAVAILABLE = "We couldn't read this workflow's details"
/** The queued reading. Used in BOTH the run band and the elapsed slot, from one
 *  constant, so the two can never word the same fact differently. */
const WAITING_TO_START = "Waiting to start"
/** The deliverable region's identity. Not a claim about contents — the two empty
 *  states below carry that, and they differ because the truth differs.
 *
 *  ── ⚠ PHASE 195 (D-02) — THE STRING CHANGED, AND THE OLD ONE IS QUOTED HERE RATHER
 *     THAN ERASED, because the reason it was wrong is the interesting part. ─────────
 *
 *  It read, verbatim:  "What this run produced"
 *
 *  That is an authorship claim, and this region cannot support one. The list is read
 *  THREAD-scoped (D-01: no run attribution column exists, and none was added — the
 *  candidate field that looks like one is null on every row and belongs to a different
 *  feature). A thread can legitimately hold files this run did not write: the template
 *  a user uploaded before launching, and anything an earlier run or a chat turn on the
 *  same thread left behind. Measured at planning time, thread-scope is exact for 60 of
 *  the 61 file-bearing runs and visibly wrong for one — so the old label was a lie with
 *  a small blast radius rather than a rare one, which is exactly the kind that survives
 *  review. The new label names WHERE the files are, which is the thing the read can
 *  actually prove, and leaves WHO WROTE THEM unclaimed.
 *
 *  ⚠ THE TWO EMPTY STRINGS BELOW ARE DELIBERATELY UNCHANGED and must stay that way.
 *  "This run produced no files." looks like the same overclaim and is not: a run is a
 *  subset of its thread, so an EMPTY thread-scoped list entails the run produced
 *  nothing. The overclaim only bites in the NON-empty direction. D-15 ships both
 *  strings byte-identical, and a source fence pins each at exactly one occurrence. */
const COPY_DELIVERABLE_HEADING = "Files in this run's workspace"
const COPY_NO_FILES_LIVE = "No files yet — this run hasn't written anything."
const COPY_NO_FILES_TERMINAL = "This run produced no files."
const COPY_DOWNLOAD_FAILED = "Download failed — try again."
/**
 * Phase 200-07 (D-09 · `RS-MR-05`) — the receipt region's heading.
 *
 * ⚠ PAST TENSE, and it is the receipt's whole premise rather than a stylistic choice: the
 * canvas above says what the run IS DOING, and this region says what it DID. `200-05`'s
 * `receiptVocabulary.ts` owns every string INSIDE the receipt; this one names the region on
 * the page and therefore belongs to the page, beside the three copy constants above it.
 *
 * ⚠ It deliberately does not repeat the word `run` twice in one line with the deliverable
 * heading below, and it names no mechanism — no *phases*, no *timeline*, no *spine*.
 */
const COPY_RECEIPT_HEADING = "What this run did, step by step"

// ── The deliverable list (SPEC Req 7) ──────────────────────────────────────────
//
// ZERO NET-NEW BACKEND WIRE. A run is 1:1 with a thread, `run.thread_id` is on the
// payload, and `GET /threads/{tid}/workspace/files` already lists a TERMINAL run's
// files exactly as it lists a live one's (no run-state condition on the route). So the
// thing the run made is reachable with the shipped thread-scoped read and the shipped
// bearer-authed raw-bytes helper — the SPEC excludes a new file endpoint and none is
// owed. Two independent ownership gates stand in front of it: the run read that yielded
// this thread id, and the thread-ownership check on the files route itself.
//
// ⚠ THE ROWS ARE DOWNLOADS. THERE IS NO PREVIEW HERE AND NONE IS PROMISED.
// DOCX / PPTX / XLSX / PDF are download-only by decision, and the template-fill engine
// emits .docx — so the flagship deliverable is precisely the artefact a reviewer cannot
// read in place. Req 7 asks that it be LISTED and DOWNLOADABLE, which is exactly what
// ships. Text / markdown / csv lose their in-place read on this surface too, and that is
// deliberate rather than an oversight: the chat thread's panel still renders them, and
// the header's thread seam is the route to it. Building a viewer here would duplicate a
// shipped one on a surface whose job is the run, not the file.
//
// ⚠ The panel's own file list is MIRRORED, never imported — it resolves its thread from
// the globally-viewed-thread selector rather than from a prop, so mounting it here would
// mean writing chat's viewed thread as a side effect of opening a run. Only the icon
// mapping and the byte formatter are copied; both are pure.
//
// ── ⚠ PHASE 195 PLAN 06 (RUN-03) — THE LAST SENTENCE ABOVE IS NO LONGER TRUE, AND IT IS
//    KEPT RATHER THAN OVERWRITTEN so the drift is visible instead of erased. ────────────
//
//  · **"Only the icon mapping and the byte formatter are copied"** — they are no longer
//    copied AT ALL. This file used to declare its own byte formatter, its own basename
//    and its own extension/mime→glyph mapping (plus three long office-mime constants),
//    every one of them a duplicate of the panel's, which was itself a duplicate of the
//    chat output card's. All three copies are DELETED here; the presentation now comes
//    from the ONE shared row in `components/files/`, and the formatter/basename/ordering
//    helpers from the pure module beside it. That is the whole of RUN-03.
//
//  · **The first sentence still holds, and holds for the same reason.** The panel's file
//    list is still not mounted here — it resolves its thread from the globally-viewed-
//    thread selector rather than from a prop, so mounting it would write chat's viewed
//    thread as a side effect of opening a run. What is shared is a PRESENTATIONAL row
//    that is handed no thread id, no file id and no hook; it cannot resolve a thread, so
//    adopting it cannot re-open that hazard.
//
//  · **The rows are still downloads and still promise no preview** — the paragraph above
//    is unchanged and remains the decision.
//
//  · **ONE BEHAVIOUR CHANGED, deliberately, and it is an improvement rather than a
//    side effect:** a row the listing gives with no id used to be a SILENT
//    non-interactive element — a filename the user cannot act on, with nothing said
//    about why. It now carries the shared row's shipped "no link" affordance (the same
//    one the chat card has had since `BUG-260523-03`). ⚠ That affordance is a
//    non-focusable `span` marked `aria-disabled`, NEVER a button, and the reason is
//    mechanical rather than aesthetic: this region's shipped fence asserts that an
//    id-less row leaves ZERO `button` elements in the region, and the only thing making
//    that survive unification is the affordance not being one. It must not read as luck.
//    The authorization gate is still the code-level early return inside `onDownload`,
//    never the visual state.
//
// ⚠ EVERY COMPONENT AND HOOK NAMED IN THIS COMMENT IS NAMED IN WORDS ON PURPOSE. Four
// shipped fences grep this file's RAW source for identifiers — the panel's file-list
// component, the previewer, the viewed-thread selector hook and the stop control — and a
// docblock is not exempt from a source sweep. Writing any of those four tokens in prose
// reds a fence exactly as loudly as calling it would, and one of those fences lives in a
// suite that has nothing to do with files.

// ── The elapsed figure (D-188-18) ──────────────────────────────────────────────

/**
 * ⚠ `fmtElapsed` NO LONGER LIVES HERE — Phase 194.1 Plan 06 HOISTED it, VERBATIM, to
 * `@/lib/fmtElapsed` (imported at the top of this file). It is not gone and it was not
 * rewritten: `lib/__tests__/runStepCount.test.ts` compares the moved body against a
 * constant captured with `git show f9e55b6d…:frontend/src/pages/WorkflowRunPage.tsx`,
 * so the move is byte-proved rather than promised.
 *
 * WHY IT MOVED, stated so nobody moves it back: `components/chat/ThreadRunLine.tsx`
 * became its SECOND consumer, and this tree already carried THREE elapsed formatters
 * (`RunCard`'s `formatElapsed`, `MessageList`'s `formatFloatingElapsed`, and this one).
 * `194.1-RESEARCH.md`'s *Don't Hand-Roll* table names a fourth as the thing not to write.
 *
 * ⚠ WHAT DID **NOT** MOVE, and stays here because the thing it guards is here: this page
 * names the panel component by ROLE, never by its identifier — an acceptance fence
 * measures that this page does NOT import it, and a comment spelling the name would turn
 * that measurement into prose (the 187-24 lesson, met again).
 *
 * ⚠ THE ANCHOR DECISION IS ALSO STILL HERE, DELIBERATELY. The formatter takes a duration
 * in milliseconds and nothing else; `:758-791` below decides what this page's two anchors
 * are and discloses them in words. The chat run line makes its own, different choice. A
 * formatter that knew which would be a second home for a per-caller decision.
 */

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
  void claimedAt // F3: retained in the signature; deliberately no longer read (see below).
  switch (status) {
    case "active":
      // F3 (UAT 2026-08-05) — this used to read `claimed_at == null` as "queued, not running".
      // That inference is unsound HERE: nothing populates the field on the in-process producer
      // path (0 of 149 completed runs carry it), so the branch fired on a run whose first step
      // was visibly Running and the band announced "Waiting to start" over a moving canvas.
      //
      // A field that is null for queued AND running runs alike cannot separate them. Between
      // two wrong readings the honest one is the one the row's own status asserts: `active`
      // means the run was created and its producer spawned. The per-node readings carry the
      // finer truth — an un-started step still says "Not started" beside this — so nothing is
      // over-claimed by naming the RUN running.
      return { sentence: "● Running", tone: "running" }
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

/** CR-01 — how often the RUN row itself is re-read while it is still live. */
const RUN_POLL_MS = 5000

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

  /**
   * ⚠ CR-01 — RE-READ THE RUN ITSELF. A run-level status is the ONE fact no other source
   * on this surface carries: the phase slice knows about steps, the file list knows about
   * artefacts, and neither can tell you the run finished. Before this, `setRun` had exactly
   * one caller (the mount effect above, whose other key is bumped only by a button that
   * renders on the broken screen), so `band`, `isTerminal`, `ticking` and the alert were
   * all frozen at mount — the surface asserted a run was running at exactly the moment it
   * was not, with a clock still counting to make the claim actively.
   *
   * TWO RULES, both load-bearing:
   *   1. `loadPhase` is NEVER touched here. This is a refresh of a surface that already
   *      resolved, so a blip must leave the run standing rather than replacing it with the
   *      broken screen. Only the mount read owns the load phase.
   *   2. The stale-response guard is re-applied per call. A poll in flight across a run
   *      switch must not write the OLD run's payload over the new one — the same reason
   *      the mount read carries it.
   */
  const refreshRun = useCallback(() => {
    const requested = currentRunRef.current
    if (!requested) return
    getWorkflowRun(requested)
      .then((r) => {
        if (currentRunRef.current === requested) setRun(r)
      })
      .catch(() => {
        /* a blip must not tear down a good surface — see rule 1 above */
      })
  }, [])

  // ── The live slice. This page is the ONLY component on this surface that touches the
  //    stream (067.5 Branch-D3): one subscription, one join, one lookup handed down. ──
  const { data: livePhases, reconcile } = usePhases(run?.thread_id ?? null)

  /**
   * The deliverable list, keyed on **the RUN's thread — never the viewed thread**. The
   * shipped hook is already thread-parameterised and fetches on every thread-id change,
   * so it fills itself the moment the run read resolves; nothing new is fetched from the
   * server that was not already reachable.
   *
   * MEASURED, because getting this wrong reads "No files yet" exactly when a deliverable
   * has just been written: the shipped terminal refetch (`StreamsProvider.tsx:1053-1063`,
   * the Phase-101.1-09 gap-4 fix) is keyed on the **owning** thread — it lives inside the
   * per-thread SSE consumer factory and closes over that factory's `threadId`, and it
   * writes through `replaceWorkspaceFilesForThread(threadId, …)`. It is NOT keyed on the
   * viewed thread, so a run watched from this surface self-heals its own list with no
   * extra call from here.
   */
  const {
    data: files,
    isLoading: filesLoading,
    reconcile: reconcileFiles,
  } = useWorkspaceFiles(run?.thread_id ?? null)

  /**
   * D-12 — NEWEST FIRST, client-side, on THIS surface only.
   *
   * ⚠ THE SORT KEY IS ABSENT ON EXACTLY THE FILE THIS ORDERING EXISTS TO SURFACE, which
   * is why the comparator is the shared two-regime one and not a bare timestamp compare.
   * The reconciled GET supplies a creation timestamp on every row; the LIVE arrival does
   * NOT (the streamed payload carries id/path/version/size/mime only) and the store
   * APPENDS it. So a naive newest-first over the timestamp alone would put the
   * just-produced deliverable LAST — the exact inverse of the intent. The shared
   * comparator sorts a MISSING key FIRST for that reason, and its own unit suite pins
   * both regimes.
   *
   * ⚠ SORTED ON A COPY. The provider hands out a stable array reference, so an in-place
   * sort would mutate store state and re-render forever — the rule recorded at
   * `canvasModel.ts:368`. The empty/loading branches below still read the ORIGINAL
   * `files`, so nothing about the three-way empty state depends on this memo.
   *
   * The panel's own list keeps its shipped path ordering; no decision authorises changing
   * it, and this ordering is scoped to the run surface deliberately.
   */
  const orderedFiles = useMemo(() => [...files].sort(byNewestFirst), [files])

  /**
   * ⚠ F5 (UAT 2026-08-05) — THE RUN-TIME WAITING READING WAS UNREACHABLE ON THIS SURFACE.
   *
   * `canvasReading` has always had its `pendingAsk != null` arm, and it is FIRST, ahead of
   * every status (`phaseState.ts:124`). But `reconcilePhases` hardcodes `pendingAsk: null`
   * in BOTH branches (`StreamsProvider.tsx:3427` live, `:3466` terminal), so the field is
   * populated only by a live SSE event — and after F1 this surface rides POLLED reconciles,
   * every one of which resets it to null. Observed live on `doc_qa_scoped_098uat`: an
   * `llm_human_input` step sitting `active` with a real ask pending read "Running".
   *
   * The DURABLE slice below already shipped (`StreamsProvider.tsx:3263`) — a fetched
   * `PendingAsk[]` with its own reconcile. **No new endpoint is owed.**
   *
   * It is read here rather than fixed in `reconcilePhases` deliberately: that reducer is
   * shared with the developer `PhaseTimeline`, teaching it about asks would put the ask
   * slice inside the phase fetcher, and the SPEC puts panel changes out of scope.
   */
  const { data: asks, reconcile: reconcileAsks } = useAskUserPrompt(run?.thread_id ?? null)

  /**
   * ⚠ F7 (UAT 2026-08-05) — SC#1'S GOVERNANCE HALF NEVER REACHED THIS SURFACE.
   *
   * The criterion is that each node shows live state **and its grounded-cited vs open
   * governance state**. The first shipped; the second could not, because `toCanvas`
   * resolves `grounded` through `isGrounded(phase, kbTools)` and defaults an omitted
   * `kbTools` to the frozen empty `NO_KB_TOOLS` (`canvasModel.ts:360`). This page rendered
   * the canvas with no `kbTools` at all, so `available_tools ∩ kb_tools` was taken against
   * the empty set and the **`detected`** cause could never resolve.
   *
   * That is the quiet shape of the bug: `already-set` (an explicit `citation_policy`) and
   * `escalated` (the author's own flag) still resolved, so governance LOOKED right on the
   * workflows that declare it explicitly — while every step that is grounded merely by
   * reading the knowledge base, which is most of them, painted as ungoverned.
   *
   * Falsified live on `doc_qa_scoped_098uat`, the same workflow on both surfaces: the
   * Builder canvas gave node `draft` `data-grounded="true"`; this one gave no attribute.
   *
   * The rule below is the Builder's, VERBATIM (`WorkflowBuilderPage.tsx:904-907`) and for
   * its stated reason: the kb-tool list is served OUTSIDE every registry read, so it
   * arrives intact on a degraded bundle too, and carrying it only on `ready` would let an
   * unrelated folder-registry blip silently un-mark a locked step. Absent, it is empty —
   * which marks nothing, the safe direction, because the run-time gate is server-side and
   * unconditional either way. R11: the list is the SERVER's; this page authors none of it.
   */
  const bundle = useGroundingBundle(true)
  const kbTools = useMemo<readonly string[]>(
    () => (bundle.kind === "ready" || bundle.kind === "unavailable" ? bundle.kbTools : []),
    [bundle],
  )

  /**
   * ⚠ CR-02 — SOMETHING HAS TO OPEN THE RUN'S STREAM, and after the retarget nothing did.
   *
   * The store's `reconcile(threadId)` action is the ONLY caller of `subscribeToRun` for a
   * thread the user did not send from. It is NOT the `reconcile()` returned by `usePhases`
   * beside it — that one refetches the slice and opens no connection. Before this phase the
   * subscription was armed by landing on the CHAT view: `ChatArea`'s layout effect calls
   * `setViewingThread`, whose body fires this action, and `ChatArea` is the ONLY production
   * caller of it (`ChatArea.tsx:224,:323` — measured). `ChatArea` mounts only inside the
   * `activeView === "chat"` branch, so on this surface that chain does not exist and no
   * `phase_started` / `phase_completed` / `phase_failed` event ever reached the slice. The
   * canvas painted its mount-time snapshot and stayed there for the whole run.
   *
   * Restoring `selectThread` in the launch path would NOT have fixed it: selection alone
   * arms nothing, and the component that turns selection into a subscription is unmounted
   * here. Doing it on the PAGE also makes it path-independent — the panel-receipt door and
   * a re-opened finished run get the same treatment as a fresh launch.
   *
   * The action is called DIRECTLY rather than through `setViewingThread`, which would also
   * write `viewedThreadId`: opening a run writes no chat state, the same rule this surface
   * already keeps from the reading side by never resolving the globally-viewed thread. The
   * consequence is recorded rather than discovered — the provider's own visibility/focus
   * listeners key on the thread `setViewingThread` publishes, so they still do not cover
   * this one, and the wake handler below carries it instead.
   */
  const { reconcile: reconcileStream } = useStreamActions()
  useEffect(() => {
    const tid = run?.thread_id
    if (!tid) return
    void reconcileStream(tid)
  }, [run?.thread_id, reconcileStream])

  // Reconnect-driven reconcile, LOCAL to this page (see the header docblock). The shared
  // hook is untouched; this only calls the escape hatch it already returns — for the live
  // slice AND for the file list, because a lid closed while the last step was writing is
  // precisely when the deliverable row appears without anyone watching. CR-02 adds the
  // STREAM to the same handler: a reconnect drops the SSE connection, so re-reading the
  // slice without re-attaching leaves the surface frozen from that moment on.
  useEffect(() => {
    if (!run?.thread_id) return
    const threadId = run.thread_id
    const onWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      void reconcileStream(threadId)
      void reconcile()
      void reconcileFiles()
      // F5: and the ASKS. The waiting reading is derived from this slice, so leaving it out
      // here would give it exactly the staleness F1 just removed from the phase slice.
      void reconcileAsks()
      // CR-01: and the RUN. A lid closed across the run's completion must re-read the
      // VERDICT on wake rather than wait out the poll below — the phase slice cannot
      // supply it, and a stale "Running" is the single loudest thing this surface can
      // get wrong.
      refreshRun()
    }
    window.addEventListener("visibilitychange", onWake)
    window.addEventListener("online", onWake)
    return () => {
      window.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("online", onWake)
    }
  }, [run?.thread_id, reconcile, reconcileAsks, reconcileFiles, reconcileStream, refreshRun])

  /** A download that fails must say so where the user clicked — a swallowed rejection
   *  leaves a dead row, and an unhandled one is a console-only failure. */
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const runThreadId = run?.thread_id ?? null
  const onDownload = useCallback(
    (file: WorkspaceFile) => {
      const fileId = file.id
      if (!runThreadId || !fileId) return
      setDownloadError(null)
      downloadWorkspaceFile(runThreadId, fileId, baseName(file.path)).catch((err: unknown) => {
        setDownloadError(err instanceof Error ? err.message : COPY_DOWNLOAD_FAILED)
      })
    },
    [runThreadId],
  )

  /** The definition's step specs — the version that RAN (D-188-14), read defensively:
   *  a definition the server could not load degrades to an empty spine rather than a
   *  throw, and the header says so by way of the empty name.
   *
   *  ⚠ 199-07 — THAT LAST CLAUSE WAS FALSE WHEN WRITTEN, and it is corrected BESIDE the
   *  original rather than over it (this project's standing rule). The header did NOT
   *  say so: it rendered the generic word `Workflow` and a fabricated `v0`. It says so
   *  NOW — see `COPY_NAME_UNAVAILABLE` and the header's single sentinel read — so the
   *  sentence above is true as of this commit and was not true before it. */
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
  /**
   * ── Phase 200-07 (DES-02 · `RS-MR-01` / `RS-MR-02` / `RS-MR-03` / `RS-MR-05`) — THE
   *    DURABLE PHASE ROWS, WHICH ARE THE ONLY PLACE THE TIMINGS AND THE COUNTS LIVE ──────
   *
   * ⚠ THE LIVE SLICE CANNOT SUPPLY THESE AND NEVER COULD. `Phase` (`types/index.ts`) has no
   * timestamps and no counts on it at all, so every figure this page prints about a step
   * comes from `run.phases` — i.e. from the FETCH, which `refreshRun` already polls while
   * the run is live and re-reads on the terminal edge. That is the project rule rather than
   * a convenience: *"Realtime is a best-effort hint, not a source of truth — always
   * reconcile via fetch"* (D-v2.5-03), and a terminal run has no stream to read at all.
   *
   * ⚠ AND THIS IS WHY THE PANEL AND THE PAGE CANNOT DISAGREE. `200-02` widened BOTH wire
   * models for these same `workflow_phases` rows — `WorkflowRunPhaseRead` here and
   * `WorkflowPhaseState` on the chat panel's transport — and both halves resolve their arms
   * through the ONE `phaseDuration.ts`. Two surfaces, one derivation, one vocabulary.
   */
  const wireRows = useMemo<PhaseTimingRow[]>(() => run?.phases ?? [], [run])

  /** slug → the durable row. The join for the count the canvas paints on a connection. */
  const wireBySlug = useMemo(() => {
    const m = new Map<string, PhaseTimingRow>()
    for (const row of wireRows) m.set(row.slug, row)
    return m
  }, [wireRows])

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
  // Hoisted above the memo below (F5) — the run-level live/terminal fact is part of whether
  // a step can honestly be said to be waiting. The elapsed block downstream reads these same
  // two consts rather than re-deriving them.
  const runStatus = run?.status ?? ""
  const isTerminal = TERMINAL_RUN_STATUSES.has(runStatus)

  const runStateBySlug = useMemo(() => {
    const m = new Map<string, NodeRunState>()
    /**
     * F5 — WHICH step the pending ask belongs to, derived rather than joined.
     *
     * ⚠ `PendingAsk` carries NO phase reference at all (`types/index.ts:925-937`), so an
     * ask cannot be matched to a step by id. The derivation is sound only because of two
     * facts about the harness, and it is written out here because the moment either stops
     * holding this reading starts over-claiming:
     *
     *   1. the spine is LINEAR and one phase runs at a time, so there is at most one
     *      candidate; and
     *   2. only an `llm_human_input` phase blocks on an ask, so an ask on the thread says
     *      nothing about any other step that happens to be running.
     *
     * Hence all three conditions, none of them removable: an ask must exist, the step must
     * be the one actually RUNNING (a step the run has not reached is waiting on nobody),
     * and it must be the step type that can block. The run must also still be live — a
     * cancelled run with an unanswered ask left on its thread does NOT need your reply,
     * and saying so would be this phase's own defect in a new place.
     *
     * The step TYPE is read off the definition spec, never off the live phase row: the
     * terminal seed carries `phase_type: null` on older rows (`:517` degrades it to
     * `"unknown"`), and D-188-14 makes the definition the version that RAN.
     *
     * `pendingAsk` is a `tool_call_id` POINTER (`types/index.ts:1024`), so this hands
     * `canvasReading` the same shape a live SSE event would have. That is the point: the
     * waiting arm stays inside the ONE derivation function rather than being re-decided
     * here, and the page's `canvasReading(` count stays at 1.
     */
    const askToken = asks.length > 0 ? asks[0].tool_call_id : null
    const runIsLive = !isTerminal
    for (const spec of specs) {
      const phase = byIndex.get(spec.phase_index)
      const waiting =
        askToken != null && runIsLive && phase?.status === "running" && waitsForYou(spec)
      const reading: CanvasReading = canvasReading(
        waiting && phase ? { ...phase, pendingAsk: askToken } : phase,
      )
      const emitFailure = phase?.emitFailure ?? null
      // ── Phase 200-07 · `BC-MR-01`'s SUPPLY LINE, which `200-06` built the seam for and
      //    deliberately left unwired because this file was not its to edit ────────────────
      //
      // The canvas renders a connection's payload label from the UPSTREAM step's DECLARED
      // count, through the `runState` seam that already exists. `200-06` shipped the seam,
      // the relay and the render, and recorded the hand-off in its SUMMARY verbatim: *"one
      // line — forwarding the phase row's `step_count` / `step_noun` into the object it
      // already builds — makes the label appear on the live run canvas."* This is that line.
      //
      // ⚠ THE PAGE DECLARES; NOTHING DOWNSTREAM COUNTS. There is no second counting path and
      // no second fetch — the number is the executor's own, carried on the wire since
      // `200-02`, and it passes through here untouched (`BC-MNR-05`).
      //
      // ⚠ ABSENT IS NOT ZERO. `wireBySlug` misses for a step the durable read has not
      // mentioned, and `payloadLabel` renders NOTHING for a non-number — never `0`, never a
      // dash, never an empty pill. A declared `0` is a real measurement and DOES render.
      const wire = wireBySlug.get(spec.slug)
      // ── Phase 200 · `PORT-canvas.md`'s ONE REAL GAP — the page half of it ─────────────
      //
      // The canvas author built the marching "running" connector and BACKED IT OUT, because
      // `WorkflowCanvas.test.tsx` forbids that file from spelling any of the seven reading
      // words or importing `runVocabulary` as a value (D-188-01/02): `reading === "running"`
      // trips it, and a second fence forbids the run lookup below the anti-blink memo split.
      // The recorded clean fix was "a page-resolved boolean on `NodeRunState`" — and the page
      // is this file, which that dispatch was not allowed to edit. This is that boolean.
      //
      // ⚠ IT IS `reading === "running"`, NOT `!isTerminal` AND NOT `status !== "done"`. A
      // step `waiting-for-you` is stopped dead awaiting a human and a step `not-started` has
      // not been reached — animating either would be motion asserting progress that is not
      // happening, which is the fabricated-figure defect told in movement instead of in type.
      // Reading it off the SAME `reading` the label is worded from is what keeps the moving
      // line and the printed sentence from ever disagreeing.
      m.set(spec.slug, {
        reading,
        label: runReadingLabel(reading, emitFailure),
        emitFailure,
        count: wire?.step_count,
        noun: wire?.step_noun,
        live: reading === "running",
      })
    }
    return m
  }, [specs, byIndex, asks, isTerminal, wireBySlug])

  /**
   * ⚠ `useCallback`, NOT an inline arrow at the call site. An inline arrow is a NEW
   * function identity on every render of this page, which invalidates the canvas's
   * `settledNodes` memo every time and re-creates every node object — dropping React
   * Flow's `measured` dimensions and flickering the cards. 188-07 pinned that memo split
   * with a test; defeating it from here would go red there rather than silently.
   */
  const runState = useCallback((slug: string) => runStateBySlug.get(slug), [runStateBySlug])

  /**
   * ── Phase 200-07 · the receipt's step names ────────────────────────────────────────────
   *
   * ⚠ THE TITLE IS THE PAGE'S, RE-DERIVED NOWHERE. `nodeTitle`'s ladder needs a page-owned
   * name context, and the receipt's own docblock refuses to re-derive it for exactly that
   * reason: a second derivation would give the SAME step a different face on the receipt
   * than on the canvas above it — the two-views-two-languages defect, one surface along.
   * This is the same `nodeTitle` the canvas paints, so the two provably agree.
   *
   * A slug with no spec falls back to the slug itself rather than to a placeholder: an
   * unrecognised step is still a step that ran, and inventing a friendly name for it would
   * be the fabrication this whole screen is built to avoid.
   */
  const titleBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const spec of specs) m.set(spec.slug, nodeTitle(spec))
    return m
  }, [specs])
  const titleOf = useCallback(
    (slug: string) => titleBySlug.get(slug) ?? slug,
    [titleBySlug],
  )


  // ── The elapsed figure (D-188-18) ────────────────────────────────────────────
  // (`runStatus` / `isTerminal` are hoisted above the run-state memo — F5 needs the live/
  // terminal fact to decide whether any step can honestly be said to be waiting.)
  const claimedMs = epochOf(run?.claimed_at)
  const updatedMs = epochOf(run?.updated_at)
  // F3: the fallback anchor. `created_at` is NOT NULL on `workflow_runs`, so this is the one
  // timestamp always available — `claimed_at` is populated on 5 of 181 rows and 0 of 149
  // completed ones.
  const createdMs = epochOf(run?.created_at)

  /**
   * ⚠ F6 (UAT 2026-08-05) — THE ANCHOR IS COMPUTED HERE, ONCE, AND THAT IS THE FIX.
   *
   * F3 moved the figure's anchor to the `created_at` fallback but left the TICK GATE below
   * reading `claimedMs` — "is there an anchor?" existed in two places and only one was
   * updated. Since `claimed_at` is null on essentially every run (F3's own measurement: 5 of
   * 181 rows, 0 of 149 completed), the interval never armed on ANY live run: `nowMs` stayed
   * frozen at its mount value and the band rendered a number that looked live and was not.
   *
   * Observed live on run `99f10a40` — created 15:38:45.8, read at 15:40:31 (~106 s), band
   * saying "3s since it was queued". That is precisely the defect F3 existed to remove,
   * one field along. Both the gate and the figure now read this const.
   */
  const anchorMs = claimedMs ?? createdMs

  // The once-per-second tick, and ONLY while the run is live and actually anchored. A
  // terminal run's figure is frozen, so it re-renders nothing.
  const [nowMs, setNowMs] = useState(() => Date.now())
  const ticking = !isTerminal && anchorMs != null && loadPhase === "ready"
  useEffect(() => {
    if (!ticking) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [ticking])

  // CR-01: the run poll, sited HERE because it is gated on `isTerminal` and that is derived
  // just above. It runs ONLY while the run is non-terminal and the surface has resolved,
  // and it tears itself down the moment a read comes back terminal — `isTerminal` is a
  // dependency, and the value it reads is the one this poll wrote. So a finished run is
  // never re-read forever, and no interval survives a run switch.
  //
  // 5s is a deliberate order of magnitude apart from the 1s clock above: the clock is a
  // local render, the poll is a network read, and pinning them to the same beat would make
  // a per-second request out of a per-second repaint.
  // F1 (UAT 2026-08-05) — THE PHASE SLICE RIDES THIS SAME BEAT, and before it did the
  // canvas froze at its mount-time paint while a person watched it.
  //
  // Measured live: a 3-phase run whose DB rows read `completed / active / pending` painted
  // `Running / Not started / Not started` for 100 s on a VISIBLE tab. The reconcile
  // machinery was never broken — dispatching a wake event snapped the readings straight to
  // the truth. Nothing was DRIVING it. Two channels were meant to and neither could:
  //
  //   1. The STREAM. `reconcileStream` ran once, at mount — where the thread's
  //      `latest_producer_run_id` is legitimately `null` on an `llm_human_input` phase,
  //      because the producer run ends while the `workflow_run` stays active. One attempt
  //      against a value that is not there yet is the same as no attempt, so it is retried
  //      on the beat rather than assumed.
  //   2. The WAKE handler above, which fires on `visibilitychange` / `online` — neither of
  //      which happens to someone sitting and watching. "Watch a run" is this phase's goal
  //      and the watching case is precisely the one with no wake event in it.
  //
  // This is also the shape the project already mandates: Realtime is a hint, not a source of
  // truth — always reconcile via fetch (D-v2.5-03). The slice is now correct whether or not
  // an SSE connection ever arms, which is why the fix is a poll and not a second stream.
  useEffect(() => {
    if (!runId || loadPhase !== "ready" || isTerminal) return
    const threadId = run?.thread_id ?? null
    const tick = () => {
      refreshRun()
      if (!threadId) return
      void reconcile()
      void reconcileStream(threadId)
      // F5: the pending-ask slice rides the SAME beat. A step that starts waiting after
      // mount is precisely the case with no wake event in it — someone sitting and
      // watching — which is the F1 lesson applied to the second slice this page derives
      // a reading from.
      void reconcileAsks()
    }
    const id = window.setInterval(tick, RUN_POLL_MS)
    return () => window.clearInterval(id)
  }, [
    runId,
    loadPhase,
    isTerminal,
    refreshRun,
    run?.thread_id,
    reconcile,
    reconcileAsks,
    reconcileStream,
  ])

  // The terminal EDGE. The poll above tears itself down on the read that observes the
  // verdict, so that same tick is the last one — and the deliverable row is written as the
  // run finishes. Without a read here the final per-node state and the file both land after
  // the last poll and are never fetched. Gated on `isTerminal` so it fires once, on the
  // transition, not on every render of a finished run.
  useEffect(() => {
    if (!runId || loadPhase !== "ready" || !isTerminal) return
    if (!run?.thread_id) return
    void reconcile()
    void reconcileFiles()
  }, [runId, loadPhase, isTerminal, run?.thread_id, reconcile, reconcileFiles])

  /**
   * The elapsed slot: a number and the field it derives from, or NOTHING AT ALL.
   *
   * `claimed_at == null` renders no digit, no clock and no "0s". An unlabelled clock
   * that silently means *since queued* is a lie the moment a run waits, and a "0s" is
   * worse than silence because it claims a measurement that was never taken.
   */
  const elapsed: { text: string; number: string | null } = useMemo(() => {
    // F3 (UAT 2026-08-05) — `claimed_at` is NEVER POPULATED, so anchoring on it alone made
    // this slot contradict the band beside it. Measured against the live DB:
    //
    //     workflow_runs: 181 total ·   5 with claimed_at
    //       completed:   149 rows  ·   0 with claimed_at
    //
    // Zero of 149 finished runs carry it — `claim_run`'s CAS lease is the distributed-worker
    // path and the in-process producer never takes it. So the original "no claimed_at ⇒ show
    // nothing" rule fired on essentially every run, and a finished run rendered the
    // self-contradiction "✓ Complete   Waiting to start".
    //
    // `created_at` is NOT NULL and is the honest fallback. The rule the docblock above states
    // is UNCHANGED and is what makes the fallback safe: a number is only ever shown beside the
    // field it came from. A queued-anchored figure is not a lie — an UNLABELLED one is, which
    // is why the wording changes with the anchor rather than the anchor being hidden.
    // F6: the anchor is the hoisted one — the SAME expression the tick gate reads, so the
    // two can no longer disagree about whether this run has a clock at all.
    const queued = claimedMs == null
    if (anchorMs == null) return { text: WAITING_TO_START, number: null }
    if (isTerminal) {
      const end = updatedMs ?? anchorMs
      return {
        text: queued
          ? "— from when it was queued to its last update"
          : "— from when it started processing to its last update",
        number: `Ran for ${fmtElapsed(end - anchorMs)}`,
      }
    }
    return {
      text: queued ? "since it was queued" : "since it started processing",
      number: fmtElapsed(nowMs - anchorMs),
    }
  }, [claimedMs, anchorMs, updatedMs, isTerminal, nowMs])

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
          {/* ⚠ 199-07: ONE reading of "the definition could not be read", taken from the
                server's OWN documented sentinel (the empty name), and used for BOTH the
                headline and the version chip. Two independent tests here would let the
                two atoms disagree — an honest title beside a fabricated `v0` is exactly
                the half-corrected state this fix exists to avoid. See COPY_NAME_UNAVAILABLE. */}
          <h1 className="font-headline text-xl font-semibold leading-tight text-foreground">
            {run?.workflow_name || COPY_NAME_UNAVAILABLE}
          </h1>
          {run?.workflow_name ? (
            <span className="font-mono text-xs text-muted-foreground">v{run.workflow_version}</span>
          ) : null}
          {/* ── THE STOP (Phase 194.1 Plan 07 / R3 / D-19) ──────────────────────────────
                SKETCH 169-A, chosen over the sketch's OWN lean toward B, and the reason is
                a measurement rather than taste: `isTerminal` (:604) is a component-level
                const already in scope for BOTH this row and the state row below, so A's
                liveness gate is ONE clause reading the same variable — not a new
                derivation. B's headline argument, *"the gate comes free"*, overstated the
                difference and is corrected here rather than repeated. A also dodges a real
                hazard B carries: the state row below is `flex-wrap` and grows a long
                `claimed_at … → created_at … → updated_at …` string under the ⌥ reveal, so a
                control living there wraps unpredictably.

                THE GUARD IS A DIRECT FLIP — no sheet, no arm-to-confirm, no second press.
                The shipped ladder is *irreversible + names a victim → sheet; consequential
                but reversible → arm-to-confirm; reversible with no victim → direct flip*,
                and a Stop is your own run, which you launched and are watching (Phase 194
                verified on seven live runs that completed phases survive and only the
                interrupted one is marked). The asymmetry, said out loud: a Stop that is too
                easy costs you one run; a Stop that is too hard costs you the reason the
                control exists.

                THE ACCENT COST, stated rather than left for a later reader to notice: this
                header's own docblock (:870-871) says it is *"orientation, never a focal
                point. The only accent it spends is the seam link."* This mount spends a
                SECOND accent, and puts a primary-tinted link beside a destructive control.
                That was weighed at sketch time and accepted with the placement.

                C — the lane beside the running node — WAS REJECTED, on canvas-vocabulary
                grounds, and it is recorded so it is not re-proposed: that lane already
                spends itself on `＋ insert` and `✕ remove`, so a stop there is one glance
                from reading as *delete this step* on a surface whose own chrome says
                👁 View only; and Phase 188.2 pins that no focusable control may live inside
                `PhaseNodeCard` at all.

                ⚠ THE WRAPPER IS LOAD-BEARING, NOT TIDINESS. `COPY_OPEN_THREAD` carries
                `ml-auto`, so a Stop appended AFTER it would shove the seam link left every
                time the run went terminal — the "row twitches" failure G-4 row 2 judges.
                Right-grouping both instead pins the seam link's RIGHT edge: the group grows
                leftward and the link does not move. The seam button below is byte-unchanged
                (its own `ml-auto` is inert inside a shrink-wrapped group), so no shipped
                class string was edited to make room. ── */}
          <div className="ml-auto flex items-center gap-3">
            {!isTerminal ? <StopControl threadId={run?.thread_id ?? null} variant="page" /> : null}
            <button
              type="button"
              onClick={() => run && onOpenThread(run.thread_id)}
              className="ml-auto text-xs font-medium text-primary transition-opacity hover:opacity-80"
            >
              {COPY_OPEN_THREAD}
            </button>
          </div>
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
              {/* F3: the reveal must name the field the number ACTUALLY came from. Printing
                  `claimed_at null` beside a real figure derived from `created_at` would make
                  the ⌥ layer — whose entire job is to show the anchor — the least honest thing
                  on the surface. */}
              {run?.claimed_at
                ? isTerminal
                  ? `claimed_at ${run.claimed_at} → updated_at ${run?.updated_at}`
                  : `claimed_at ${run.claimed_at}`
                : isTerminal
                  ? `claimed_at null → created_at ${run?.created_at} → updated_at ${run?.updated_at}`
                  : `claimed_at null → created_at ${run?.created_at}`}
            </span>
          ) : null}
        </div>
      </header>

      {/* 2. RUN BAND — the ANNOUNCEMENT channel, and only that. It carries the state
             SENTENCE for assistive tech and is visually hidden, because the header above
             already renders `band.sentence` (:888) and the same elapsed reading (:889-892)
             to sighted users.

             It used to be visible, and both this band and the header are `shrink-0` in a
             flex column — so neither ever scrolled away and every run surface permanently
             showed its status twice, one line under the other. Operator-reported 2026-08-06
             against a completed run ("✓ Complete · Ran for 2m 18s" directly beneath "✓
             Complete   Ran for 2m 18s — from when it was queued to its last update").

             `sr-only` is the correct fix rather than deleting the node: the polite region is
             what announces state CHANGES, and the header's copy is a plain child chosen
             specifically so its per-second number is never announced. Removing this element
             would silence the announcement; hiding it removes only the duplicate.

             The previously-visible `· {elapsed.number}` sibling is gone with it — it was
             `aria-hidden`, so inside an `sr-only` container it would have been markup no
             one could reach. The header's `data-testid="run-elapsed"` remains the single
             visible home for that number. */}
      <div className="sr-only">
        <span
          aria-live="polite"
          aria-atomic="true"
          data-testid="run-band"
          className={cn("min-w-0 truncate", BAND_TONE_CLASS[band.tone])}
        >
          {band.sentence}
        </span>
      </div>
      {/* Fires once, on the run reaching a state the user must not miss. */}
      <div role="alert" className="sr-only" data-testid="run-alert">
        {alertText}
      </div>

      {/* 3. CANVAS REGION — the focal point. The canvas ships its own header row and its
             own ⌥ toggle; this surface adds neither, and does not reword its shipped
             view-only copy (which is correct on a run surface). */}
      {/* ── Phase 200 · THE RIGHT-HAND RUN PANEL (sketch `run-surface.html`) ──────────────
             The sheet draws a step spine down the right of the run surface, and every part
             of it was already built — `PhaseTimeline` (the spine), `PhaseCard` (the violet
             active bar and the raised needs-review face) and `PendingAskCard` (the answer
             control). None of it reached this surface: `WorkspacePanel`'s ONLY mount is
             `ChatLayout.tsx:673`, inside `activeView === "chat"`, and this page rendered in
             the `else` branch with no panel at all.

             ⚠ THE SHELL IS NOT MOUNTED, ITS PARTS ARE — and that is a resolution of two
             hard constraints, not a shortcut.

               1. The shell resolves its thread through the globally-viewed-thread
                  SELECTOR — a zustand singleton written only by `ChatArea`. Mounting the
                  shell here would have meant this page writing chat state as a side effect
                  of opening a run, which the CR-02 docblock above deliberately refuses
                  ("opening a run writes no chat state") and which is why the stream is armed
                  through `reconcile` directly. `PhaseTimeline` and `PendingAskCard` both
                  take what they need as PROPS, so they need no such write.

               2. The shell also reaches the workspace previewer through the panel's file
                  list, and `WorkflowRunPage.test.tsx` records why this surface has neither:
                  DOCX/PPTX/XLSX/PDF are download-only and the template engine emits `.docx`,
                  so the flagship deliverable is exactly the artefact that cannot be shown in
                  place. Mounting the shell would have smuggled the previewer back in behind
                  a section header. Mounting the two parts leaves that list unmounted, so the
                  fence holds BY CONSTRUCTION rather than by a new suppression flag — and no
                  cross-surface prop was added, so chat is byte-unchanged.

               ⚠ AND NEITHER MECHANISM IS SPELLED ABOVE, WHICH IS ITSELF THE RULE. This
                  file's own suite sweeps its `?raw` source for the previewer's identifier,
                  the panel list's identifier and the viewed-thread selector's — comments
                  included, because a source fence cannot tell prose from code. The first
                  draft of this docblock NAMED all three while explaining why it mounts none
                  of them, and both fences went red. They were right to: the fences forbid
                  the MECHANISM APPEARING IN THIS FILE, and they were not re-baselined.

             The asks come from THIS page's own `asks` / `reconcileAsks` (`:545`), already
             fetched for the `waiting-for-you` reading, so the panel opens no new request.
             `runIsOver` is the page's own `isTerminal` rather than `PendingAskStack`'s
             two-hook derivation — this surface holds the run row itself, which is the
             stronger source, and a terminal run's unanswered prompt must not offer a
             control that would post into a run that has stopped. ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
            kbTools={kbTools}
          />
        </section>

        <aside
          data-testid="run-panel"
          aria-label="Run steps"
          className="hidden w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/10 px-3 py-4 lg:flex"
        >
          {/* The ask stack, newest first — the same ordering rule `PendingAskStack` keeps,
              re-derived here rather than imported because the stack resolves its own thread
              from the chat singleton. `created_at` is GET-only, so an SSE-delivered ask with
              no timestamp falls back to store insertion order rather than being invented a
              position (`PendingAskCard.tsx:610-613`). */}
          {asks.length > 0
            ? [...asks]
                .sort((a, b) =>
                  a.created_at && b.created_at ? b.created_at.localeCompare(a.created_at) : 0,
                )
                .map((ask) => (
                  <PendingAskCard
                    key={ask.tool_call_id}
                    ask={ask}
                    reconcile={reconcileAsks}
                    runIsOver={isTerminal}
                  />
                ))
            : null}
          {/* ⚠ THE THREAD IS THE RUN'S, PASSED EXPLICITLY. `PhaseTimeline` has taken
              `threadId` as a prop since Phase 094; nothing about it was chat-specific
              except its caller. */}
          <PhaseTimeline threadId={run?.thread_id ?? null} />
        </aside>
      </div>

      {/* 4. RUN RECEIPT — the same spine above, re-read in the PAST TENSE (D-09 ·
             `RS-MR-02` / `RS-MR-03` / `RS-MR-04` / `RS-MR-05`).
             ────────────────────────────────────────────────────────────────────────────
             ⚠ THIS IS `RunReceipt`'s FIRST AND ONLY MOUNT IN THE PRODUCT. `200-05` built it
             and deliberately mounted it nowhere; until this line it had never rendered
             outside a suite. Siting it HERE and only here is what keeps `199-02`'s refusal
             intact BY CONSTRUCTION — the builder's spine reads a DRAFT and has no run, so a
             component it cannot reach cannot fabricate a run-tense claim there. That absence
             is asserted by grep over `WorkflowBuilderPage.tsx`, not left to care.

             ⚠ THE TOTAL RUNTIME AT ITS TOP IS THE PRODUCT'S FIRST HONEST ONE, and it is
             DELIBERATELY NOT ALSO PRINTED IN THE PAGE HEADER. The header's figure measures
             `created_at → updated_at` and says so in words (*from when it was queued*); this
             one measures the steps that really ran. Two labelled measurements of two
             different things are honest; two unlabelled clocks one under the other are the
             duplicate-status defect an operator reported on this exact surface on
             2026-08-06, which is why the band above is `sr-only` today. So the phase-derived
             total is rendered ONCE, at the top of the region it belongs to.

             ⚠ NO `deliverableOf` IS PASSED, and the omission is a decision. Nothing on
             `workflow_phases` says which file a step produced — the run's file list is
             thread-scoped, not step-scoped — so joining one here would be a fabricated
             claim about WHICH step made WHAT. The deliverables region below lists them
             honestly, as the run's output rather than any step's.

             `now` is the page's ONE hoisted instant, so a still-running row on the receipt
             and the header's clock cannot straddle a second boundary and disagree. */}
      <section
        data-testid="run-receipt-region"
        className="shrink-0 border-t border-border/10 px-6 py-4"
      >
        <h2 className="mb-2 text-xs font-semibold text-foreground">{COPY_RECEIPT_HEADING}</h2>
        <RunReceipt phases={wireRows} titleOf={titleOf} runStatus={runStatus} now={nowMs} />
      </section>

      {/* 5. DELIVERABLE REGION — the thing the run made, listed and downloadable. The
             region caps its height on desktop and flows on mobile (<768px), where a
             fixed cap would hide the very rows the surface exists to hand over. It is
             the only new focus-stop GROUP on this page (§ Focus order): one stop per
             downloadable row, and nothing else here is focusable. */}
      <section
        data-testid="run-deliverables"
        className="shrink-0 overflow-auto border-t border-border/10 px-6 py-4 md:max-h-[220px]"
      >
        <h2 className="text-xs font-semibold text-foreground">{COPY_DELIVERABLE_HEADING}</h2>
        {files.length === 0 ? (
          // No heading on the empty state, and the two copies differ because the truths
          // differ: a live run may still write something; a terminal one never will.
          // While the very first read is still in flight we claim NEITHER — asserting
          // "produced no files" before the answer arrives is a lie with a short lifetime.
          filesLoading ? null : (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="run-deliverables-empty">
              {isTerminal ? COPY_NO_FILES_TERMINAL : COPY_NO_FILES_LIVE}
            </p>
          )
        ) : (
          <ul role="list" className="mt-2 flex flex-col gap-0.5">
            {orderedFiles.map((file) => {
              // The VISIBLE label is the basename; the full path lives in `title=`. Both
              // come from the shared helper now, and so does the size — the accessible
              // name below is assembled from that same output, so the words a screen
              // reader hears and the words on screen cannot drift apart.
              const name = baseName(file.path)
              const size = formatBytes(file.size_bytes)
              const fileId = file.id
              return (
                <li key={fileId ?? file.path}>
                  {fileId ? (
                    // Phase 195-06: the PRESENTATION is the shared row; the control, the
                    // activation and the skin stay here. `asChild` means the button below
                    // IS the rendered element — the shared row does not wrap it, so the
                    // "exactly one control per row" contract is untouched.
                    // ⚠ The shared row's `run` density carries LAYOUT ONLY
                    // (`flex items-center gap-2`), because Radix joins `className` rather
                    // than twMerging it. Every class below is padding, radius, width,
                    // alignment, hover or ring — none competes with it.
                    <FileRow
                      asChild
                      density="run"
                      name={name}
                      // ⚠ Load-bearing: without it a file that arrives with a meaningful
                      // mime type and NO extension falls to the default glyph.
                      mimeType={file.mime_type}
                      sizeBytes={file.size_bytes}
                      trailing="download"
                    >
                      <button
                        type="button"
                        onClick={() => onDownload(file)}
                        title={file.path}
                        aria-label={`Download ${name} (${size})`}
                        className="w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </FileRow>
                  ) : (
                    // A row the listing gave us with no id cannot be fetched — the raw
                    // route would be built with an empty segment and 404. It is shown as
                    // a fact rather than as a control that does nothing when clicked.
                    //
                    // ⚠ `trailing="dead"` is what changed in Phase 195-06: the row used
                    // to say NOTHING about why the filename could not be acted on. It now
                    // carries the shared "no link" affordance — and that affordance is a
                    // non-focusable `span` marked `aria-disabled`, never a control. This
                    // region's shipped fence asserts an id-less row leaves ZERO `button`
                    // elements here, and the ONLY reason that survives is the element
                    // choice. Turning the affordance into a control would red it, and the
                    // gate on a download is the early return inside `onDownload` — the
                    // code — never the visual state.
                    <FileRow asChild density="run" name={name} mimeType={file.mime_type} sizeBytes={file.size_bytes} trailing="dead">
                      <div title={file.path} className="w-full rounded-md px-2 py-2 text-left" />
                    </FileRow>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {downloadError ? (
          <p className="mt-2 text-xs text-[hsl(0_80%_80%)]" data-testid="run-download-error">
            {downloadError}
          </p>
        ) : null}
      </section>
    </div>
  )
}

/** The canvas requires both selection callbacks; this surface has no selection at all
 *  (`selectedSlug` is permanently null), so they are inert by construction rather than
 *  by discipline. Module-scope, so the identity is stable across renders. */
function noop() {}
