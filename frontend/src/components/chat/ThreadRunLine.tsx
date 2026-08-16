/**
 * Phase 194.1 Plan 06 (RUN-01 / R4 + R5 — D-15 / D-16 / D-17 / D-18) —
 * THE RUN-ANCHORED, LIST-LEVEL LINE. **One component, two states.**
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * WHY ONE COMPONENT AND NOT TWO
 * ═════════════════════════════════════════════════════════════════════════════
 * Sketches 170-B and 171-C converge here, and treating them as two features is
 * the mis-read `194.1-SPEC.md` names by name.
 *
 *   · **R4, the return.** A stopped workflow thread ends at the original prompt.
 *     The signal is not faint — it is ABSENT, and has been for two months
 *     (`BUG-260816-02`). The stop NULLs `threads.active_workflow_run_id`, so
 *     every live-anchored reader is looking at a field the stop already emptied.
 *   · **R5, the kickoff.** Plan 03 stopped inserting the optimistic assistant
 *     placeholder, so a harness run now has NO assistant node at all. Sketch
 *     171-C claimed the "never-vanishes strip" would cover that gap and **was
 *     refuted by measurement** — `MessageList.tsx`'s `RunStatusStrip` is gated on
 *     `showJumpToLive = !isPinned && isStreaming`, i.e. it appears only once you
 *     have scrolled away, and the only always-present strip lives inside
 *     `RunCard`, which is inside the very message C proposes not to render.
 *
 * C survives its own refutation ONLY because the line it needs is the line 170-B
 * already needs. That line is this component's LIVE state, and building it is
 * what stops C producing dead air.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ 174 D1 IS THE CONSTRAINT, NOT A PREFERENCE: DERIVED FROM PERSISTED STATE
 * ═════════════════════════════════════════════════════════════════════════════
 * The STOPPED reading comes from the persisted `workflow_runs` row, fetched
 * through the shipped, ungated, owner-scoped `GET /threads/{id}/workflow` (plan
 * 02's three additive fields). It reads NOTHING from the live streaming message
 * buckets. **A live-only badge is HOW `BUG-260610-01` is two months old**, and
 * the fence in this component's suite exists so the next person cannot
 * reintroduce it by reaching for the store that happens to be nearer to hand.
 *
 * ⚠ THE TWO FORBIDDEN READERS ARE NAMED BY ROLE HERE AND NEVER SPELLED — the
 * per-thread live-streaming boolean selector, and the per-surface message-bucket
 * map. That is deliberate and it is this repository's standing convention
 * (`toolMeta.ts:160-173`, the 187-24 lesson): the acceptance fence is a RAW grep
 * for those two identifiers in this file, and a docblock spelling either one
 * would turn a measurement of the CODE into a measurement of the PROSE. It is
 * the same trap `194.1-BASELINE.md` §9 Trap 2 and `194.1-02`'s `updated_at`
 * fence each fell into from the other direction.
 *
 * The LIVE reading is the mirror image and is deliberately NOT a fetch: it keys
 * on `useHarnessLiveForThread`, which is stamped SYNCHRONOUSLY at kickoff (plan
 * 03). A fetch-driven presence would leave one round trip in which the transcript
 * shows a prompt and no run instrument at all — exactly the dead air 171-C was
 * refuted for, and exactly what R5's acceptance forbids.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ D-11 — FETCH ON MOUNT AND ON EACH LIVENESS TRANSITION. THIS IS NOT A POLL.
 * ═════════════════════════════════════════════════════════════════════════════
 * The effect keys on `[threadId, isLive]`. That buys exactly three reads over a
 * run's whole life: one on mount (the RETURNING reading), one at kickoff, and one
 * at the terminal (so the stopped receipt is final). `WorkflowRunPage.tsx:683-731`
 * already owns the polling concern for the run surface; a second poller in the
 * chat transcript would be a second home for it.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ D-16 — SILENT ON `completed` AND SILENT ON `failed`. TWO ABSENCES, BY DECISION.
 * ═════════════════════════════════════════════════════════════════════════════
 * `RunCard` and the run surface already carry both outcomes in their own
 * vocabulary, and a failure reading here would be a second capability rather than
 * this one. **An untested decision is a hope**, so each absence has its own case
 * rather than sharing one. Re-open trigger, recorded rather than implied: an
 * operator observation that a FAILED workflow thread is as silent as a stopped
 * one was before this phase.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ D-18 — NO NET-NEW GLYPH. `⊘` AND `◆`, AND NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════════
 * The live mark is in `references/icon-convention.md` §4's canvas table; the
 * stopped mark is shipped tier-1 run-state vocabulary (174 D1/D2). Both are in
 * the CODE below and neither is spelled anywhere in this prose.
 *
 * ⚠ TWO OTHER MARKS ARE REFUSED, AND THEY TOO ARE NAMED ONLY BY ROLE — same
 * convention as the paragraph above, and for the same mechanical reason. The
 * first is `RunCard`'s own `cancelled` STATE mark (`RunCard.tsx:534`), which 194
 * already fenced off in both directions: `194-03` refused it for a Stop CONTROL
 * because a state is not a control, and `194-04` drew the complementary half. The
 * second is the mark the validated sketch drew for a stop. **Neither is in §4's
 * table**, so promoting either would owe a flagged §4 proposal. The acceptance
 * fence is a RAW grep for both characters in this file expecting ZERO, so
 * spelling either here — even to explain the refusal — would red the fence on its
 * own documentation.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ THE ELAPSED ANCHOR IS DISCLOSED IN WORDS, AND THAT IS A SHIPPED RULE
 * ═════════════════════════════════════════════════════════════════════════════
 * The figure is `last_run_created_at → last_run_updated_at`, i.e. FROM QUEUED TO
 * LAST UPDATE — queue time is inside it, and it is not a wall-clock run duration.
 * `claimed_at` was refused on measurement, not on taste: `workflow_runs` carries
 * it on **5 of 181** rows and on **0 of 149 completed** rows, because
 * `claim_run`'s CAS lease is the distributed-worker path and the in-process
 * producer never takes it. Anchoring there would show nothing at all.
 *
 * `WorkflowRunPage.tsx:770-773` states the governing rule and it binds here too:
 * *"a number is only ever shown beside the field it came from … A queued-anchored
 * figure is not a lie — an UNLABELLED one is."* The disclosure is a `title` on the
 * elapsed segment naming both fields in words. That is affordable because the
 * chat subtree has **no `title=` fence** — F1 is scoped to
 * `components/workflows/library/`, and `ActiveRunsTray.tsx:122` already uses one.
 *
 * An unparseable or absent anchor OMITS the segment. It may never become a `NaN`
 * or a number-shaped string derived from a missing field.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ TWO PHASE VOCABULARIES, TWO **SHIPPED** DERIVATIONS, ZERO HAND-ROLLED MAPS
 * ═════════════════════════════════════════════════════════════════════════════
 * This is the one place a reader is likely to expect a single helper and find
 * two, so the reason is written down rather than left to be re-derived:
 *
 *   · The STOPPED arm counts the WIRE's `workflow_phases` rows, whose `status` is
 *     DB-native — `completed`. `lib/runStepCount.ts` owns that, and its totality
 *     over migration 119's seven literals is proved by parsing the migration.
 *   · The LIVE arm counts the STORE's `Phase[]`, whose `status` is the CLIENT
 *     union — the same state is spelled `done` there (`lib/phaseState.ts:59-72`
 *     maps `completed → done`). The shipped `harnessBannerProgress`
 *     (`lib/toolMeta.ts:102`) owns that.
 *
 * Passing a client `Phase[]` to `stepsFrom` TYPECHECKS under its structural
 * parameter and then silently reports `0 of N` — the exact "nothing survived"
 * lie 194 D-13 forbids. So the two are kept apart on purpose, and neither is
 * re-implemented here.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ 194 D-13 — THE STEP COUNT IS IN THE SAME SENTENCE AS THE WORD, IN BOTH STATES
 * ═════════════════════════════════════════════════════════════════════════════
 * A stop must not read as though nothing survived: completed phases survive a
 * stop and the database still holds the evidence. When there is genuinely nothing
 * honest to say — no phase rows at all — the segment is OMITTED rather than
 * printed as `0 of 0`, which would claim a measurement never taken
 * (T-194.1-06-03).
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠ THE `Open the run ›` SEAM IS **NOT** BUILT HERE — DEFERRED, WITH THE REASON
 * ═════════════════════════════════════════════════════════════════════════════
 * Sketch 171's stopped line ends `· Open the run ›`. It is absent, and this is a
 * decision with two measurements behind it rather than an omission:
 *
 *   1. **It already ships, once, behind the identical gate.** `RunSeam`
 *      (`WorkspacePanel.tsx:196-252`) renders exactly `Open the run` and is
 *      enabled by `onOpenRun={canvasEnabled ? openRunSurface : undefined}`
 *      (`ChatLayout.tsx:682`) — the same strict canvas read this line would have
 *      used. A second copy in the transcript is a second home for one affordance.
 *   2. **It is not reachable from here without new props.** The navigation is
 *      `ChatLayout`'s own `useState` (`:231`, `:366-372`); nothing global exposes
 *      it. Threading it would add a prop to `ChatArea` AND a SECOND prop to
 *      `MessageList`, and this plan's D-03 stop condition allows the `MessageList`
 *      prop count to move by exactly ONE.
 *
 * Rendering the words without working navigation would be a link to a locked
 * door, which is the failure this phase exists to remove rather than to add. The
 * absence is FENCED in the suite (no `Open the run` literal, no navigation prop)
 * so the decision is guarded rather than merely stated.
 *
 * **Re-open trigger:** the first surface that needs a chat→run jump for a reason
 * the panel's shipped seam does not already serve, or an operator observation
 * that the panel seam is not findable from a stopped thread.
 */
import { useEffect, useState } from "react"
import { getThreadWorkflow, type ThreadWorkflowState } from "@/lib/api"
import { fmtElapsed } from "@/lib/fmtElapsed"
import { stepsFrom } from "@/lib/runStepCount"
import { harnessBannerProgress, outerBannerLabel } from "@/lib/toolMeta"
import { useHarnessLiveForThread } from "@/providers/StreamsProvider"
import { useStreamsStore } from "@/stores/streamsStore"
import type { Phase } from "@/types"

/** Module-scope so the selector below returns a STABLE reference on the miss
 *  path. A fresh `[]` per render would re-render this line on every unrelated
 *  store write — the churn hazard `StreamsProvider.tsx:3293` records by name. */
const EMPTY_PHASES: Phase[] = []

/** The two words the two states lead with. Declared once so the suite can assert
 *  the rendered VALUE rather than a re-typed copy of it. */
const STOPPED_WORD = "Stopped by you"

/** ⚠ Named by ROLE, never spelled: the LIVE arm's word is the SHIPPED harness
 *  activity string, taken by CALLING `outerBannerLabel` rather than by copying
 *  the literal. Phase 174 D4 already chose that sentence and `toolMeta.ts` pins
 *  it byte-exact; a copy here would move the acceptance grep and make that pin
 *  vacuous (the 187-24 lesson, which `toolMeta.ts:160-173` records at length). */
function liveWord(phases: readonly Phase[]): string {
  return outerBannerLabel(
    null,
    false,
    false,
    /* isHarness */ true,
    /* reasoningActive */ false,
    harnessBannerProgress([...phases]),
  )
}

/** The disclosure the elapsed figure carries. Both field names in WORDS, per the
 *  shipped `WorkflowRunPage.tsx:770-773` rule. */
const ELAPSED_DISCLOSURE =
  "Measured from the run's created_at to its updated_at — from when it was queued to its last update, so queue time is inside it."

interface Props {
  threadId: string | null
}

export function ThreadRunLine({ threadId }: Props) {
  const isLive = useHarnessLiveForThread(threadId)
  const [frame, setFrame] = useState<ThreadWorkflowState | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  // The live phase slice — read DIRECTLY rather than through `usePhases`, which
  // wraps `usePanelReconcile` and would fire its OWN fetch. This line already
  // owns one read; it must not acquire a second by accident.
  const livePhases = useStreamsStore((s) =>
    threadId ? (s.phasesByThread.get(threadId) ?? EMPTY_PHASES) : EMPTY_PHASES,
  )

  // ── D-11: mount + liveness transitions. NOT a poll. ──
  useEffect(() => {
    if (!threadId) {
      setFrame(null)
      return
    }
    let cancelled = false
    const ctrl = new AbortController()
    void (async () => {
      try {
        const next = await getThreadWorkflow(threadId, ctrl.signal)
        if (!cancelled) setFrame(next)
      } catch {
        // A frame read that fails degrades to NO LINE. It must never throw into
        // the transcript, and it must never leave a half-read frame on screen —
        // the `RunSeam` precedent (`WorkspacePanel.tsx:225-230`), same reasoning.
        if (!cancelled) setFrame(null)
      }
    })()
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [threadId, isLive])

  // ── The live clock. One interval, ONLY while live, cleared on every exit. ──
  useEffect(() => {
    if (!isLive) return
    setNowMs(Date.now())
    const handle = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(handle)
  }, [isLive])

  if (!threadId) return null

  const startedMs = parseMs(frame?.last_run_created_at)

  // ── STATE 1 — LIVE. Presence is the SYNCHRONOUS kickoff mark, so this arm can
  //    render before the frame has arrived and there is no dead frame. Every
  //    segment beyond the word is omitted when its input is absent.
  if (isLive) {
    const total = livePhases.length
    const progress = harnessBannerProgress([...livePhases])
    const step =
      total > 0 && progress
        ? `Step ${progress.runningPhase ?? Math.min(progress.phasesDone + 1, total)} of ${total}`
        : null
    const elapsed = startedMs == null ? null : fmtElapsed(nowMs - startedMs)
    return (
      <RunLine
        glyph="◆"
        word={liveWord(livePhases)}
        step={step}
        elapsed={elapsed}
        state="live"
      />
    )
  }

  // ── STATE 2 — STOPPED. Persisted-derived, and silent on every other status
  //    (D-16: `completed` AND `failed` both render nothing).
  if (frame?.last_run_status !== "cancelled") return null

  const steps = stepsFrom(frame.phases)
  const endedMs = parseMs(frame.last_run_updated_at)
  const elapsed =
    startedMs == null || endedMs == null ? null : fmtElapsed(endedMs - startedMs)

  return (
    <RunLine
      glyph="⊘"
      word={STOPPED_WORD}
      step={steps ? `${steps.done} of ${steps.total} steps` : null}
      elapsed={elapsed}
      state="stopped"
    />
  )
}

/** Epoch ms, or `null` when the wire value is absent OR unparseable. The two are
 *  treated identically ON PURPOSE — an unparseable anchor may never become a
 *  `NaN` that renders as a number-shaped string. Mirrors `WorkflowRunPage`'s own
 *  `epochOf`, which states the same rule for the same reason. */
function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

/**
 * The rendered shape, shared by both states so they cannot drift apart in
 * spacing, separator or order. ONE `data-testid`, present in BOTH states, so a
 * consumer asserts presence/absence without having to know which state is
 * showing — and so D-16's two absences are expressible as one query.
 */
function RunLine({
  glyph,
  word,
  step,
  elapsed,
  state,
}: {
  glyph: string
  word: string
  step: string | null
  elapsed: string | null
  state: "live" | "stopped"
}) {
  return (
    <div
      data-testid="thread-run-line"
      data-run-line-state={state}
      role="status"
      className="mt-1 flex items-center gap-2 px-1 py-1 font-mono text-xs text-muted-foreground"
    >
      <span aria-hidden="true" className="opacity-70">
        {glyph}
      </span>
      <span data-testid="thread-run-line-word">{word}</span>
      {step && (
        <>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span data-testid="thread-run-line-steps">{step}</span>
        </>
      )}
      {elapsed && (
        <>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span data-testid="thread-run-line-elapsed" title={ELAPSED_DISCLOSURE}>
            {elapsed}
          </span>
        </>
      )}
    </div>
  )
}
