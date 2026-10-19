/**
 * Phase 087 Plan 05 Task 1 — PendingAskCard + PendingAskStack (PANEL-04, D-03/D-04/D-05).
 *
 * The pending-question answer surface. `ask_user` is the one tool that blocks
 * the whole agent loop, so the panel pins the answer card to the very top
 * (pending-question.md D1, sketch 006 winner C — dual-surface calm-pin).
 *
 * - `PendingAskStack` consumes useAskUserPrompt(threadId) → PendingAsk[] and
 *   renders the FULL array, newest pinned on top, each its own sticky amber card
 *   (D-03 — no cap; simultaneous asks are rare but never silently dropped).
 * - `PendingAskCard` is the per-prompt card: amber "Needs you" chrome + countdown,
 *   optional choice chips (role=radio in a radiogroup), an always-present
 *   free-text field (D3 — no-options trap), and a `Send Answer` button that is
 *   aria-disabled until (a choice is picked OR text typed) AND run_id is present.
 *
 * A2 / Pitfall 1: PendingAsk.run_id is GET-only — the SSE flat payload omits it.
 * We NEVER POST without run_id (the route is /runs/{run_id}/... → 404). If a
 * prompt arrives without run_id we call the hook's reconcile() once on mount to
 * fetch the GET-reconciled prompt (which carries run_id), and keep submit
 * disabled with a quiet "preparing…" affordance until it lands.
 *
 * On submit → answerAskUser(run_id, {tool_call_id, response_text, choice_index});
 * the card flips green (.answered, "Answered · agent resumed") with an aria-live
 * announce. The backend's ask_user_response SSE then removes the prompt from the
 * store (Phase 086 dispatch), reactively clearing the card and un-pausing the run
 * (D4). On 0-countdown the card renders the calm grey .expired state (D5) — never
 * a crash/hang. All agent-supplied text (prompt, options) and the user's answer
 * render as plain React text children — never as raw HTML (T-087-11).
 *
 * 096-04 (BUG-260605-01 / D-06 honesty): the countdown seeds from created_at
 * when present, so a reconciled stale prompt renders expired on mount (never a
 * fresh 5:00 for a dead prompt). A 404 on submit (the backend's IDOR-safe "run
 * not active" answer) flips the card to the expired state with a visible
 * constant message; other failures show a retryable error line — never silence.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
// ── Phase 214-11 Task 2 (STEP-04 / D-214-16) — the shared identity element, the FIFTH surface.
// It takes props; this card resolves nothing and reaches for no connection list.
import { StepIdentity, type StepIdentityProps } from "@/components/workflows/StepIdentity"
import { stepActionWords, stepMarkShape } from "@/components/workflows/stepActionWords"
import {
  useAskUserPrompt,
  useViewingThread,
  // Phase 194.1 Plan 05 (R7(b)): the two READS that derive "this run is over".
  // Both are already consumed by WorkspacePanel for its timeline gate, so this
  // adds no fetch and no new source of truth — only a second reader.
  useWorkflowLockForThread,
  usePhases,
} from "@/providers/StreamsProvider"
// Phase 244-15 (G-8): the STORE, deliberately — not a provider hook. See `settleAnswered`
// in `PendingAskStack` for the measured reason (eight suites mock the provider module).
import { useStreamsStore } from "@/stores/streamsStore"
// Phase 282-02 (FIX-07 / D-12): the ONE draft home. A plain module, not a provider hook, so the
// eight suites that mock `@/providers/StreamsProvider` with an allow-list are unaffected.
import { useAskDraft, useAskDraftStore, useAskSettled, usePanelHomeMounted } from "@/stores/askDraftStore"
import { answerAskUser, ApiError } from "@/lib/api"
import type { PendingAsk } from "@/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Phase 094 Plan 05 (D-06): a draft longer than this (word count) previews
// behind a faded mask + opens the WIDE review overlay; shorter drafts render
// inline. The threshold is presentational — the contract is "long ⇒ preview +
// open-wide" (DATA-CONTRACT §4.4), driven by draft length (generic).
const LONG_DRAFT_WORD_THRESHOLD = 60

/**
 * Phase 094 Plan 05 Task 2 (D-06 — run-honesty draft preview).
 *
 * Renders `ask.draft` (the prior phase's text the user is being asked to review)
 * ABOVE the question, labelled with the VERBATIM amber tag
 * "DRAFT · awaiting your review — not yet saved" — the "not yet saved" half is
 * NON-NEGOTIABLE: it prevents the draft being read as the final saved answer
 * (UI-SPEC Copywriting Contract). A long draft shows a faded-mask preview + a
 * word count + "⤢ Review & edit full draft", which opens a WIDE overlay OVER the
 * chat (never auto-widens the panel — sketch 010-C D4, reuses the 005 overlay
 * pattern). The draft body renders as plain React text children — NEVER as
 * raw/innerHTML markup (T-094-05-02 / T-087-11 XSS guard).
 *
 * GUARD: callers render this only when a draft string is present — but it also
 * self-guards on an empty draft, returning null (DRAFT-MISSING, DATA-CONTRACT §6).
 */
function DraftBlock({ draft }: { draft: string }) {
  const [overlayOpen, setOverlayOpen] = useState(false)
  if (!draft) return null

  const wordCount = draft.trim().split(/\s+/).filter(Boolean).length
  const isLong = wordCount >= LONG_DRAFT_WORD_THRESHOLD

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.06)] p-2.5">
      {/* The non-negotiable label — verbatim copy, amber mono tag. */}
      <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--warning))]">
        DRAFT · awaiting your review — not yet saved
      </span>

      {isLong ? (
        <>
          {/* Faded-mask preview — the gradient fades the draft tail so it reads
              as a peek, not the full answer. Plain text children (XSS guard). */}
          <div className="relative max-h-[6.5rem] overflow-hidden">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {draft}
            </p>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[hsl(var(--warning)/0.06)] to-transparent"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            {/* IN-04: panel-scoped dim token (8.42:1 dark / 4.66:1 light) — the
                global --muted-foreground-dim is 3.59:1 on the dark panel (fails). */}
            <span className="font-mono text-[10px] text-panel-muted-foreground-dim">
              ≈ {wordCount} words · long draft
            </span>
            <button
              type="button"
              onClick={() => setOverlayOpen(true)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium",
                "text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.12)]",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              ⤢ Review &amp; edit full draft
            </button>
          </div>

          {/* The WIDE overlay OVER the chat (min(760px, 88%)) — reuses the repo's
              shadcn Dialog (focus-trap + Escape + restore for free; mirrors the
              087 DiffExpandOverlay). NEVER auto-widens the panel. */}
          <Dialog open={overlayOpen} onOpenChange={setOverlayOpen}>
            <DialogContent className="w-[88vw] max-w-[760px] gap-3 p-0">
              <DialogHeader className="border-b border-border/60 px-4 py-3">
                <DialogTitle className="font-mono text-sm text-[hsl(var(--warning))]">
                  Draft · not yet saved
                </DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {draft}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {draft}
        </p>
      )}
    </div>
  )
}

/**
 * Phase 185 (GOVERN-03 / SPEC Req 9) — the ONLY sentence this surface is allowed
 * to say about an open-ended wait, exported so a test can assert it
 * character-identically.
 *
 * It renders ONLY when `timeout_seconds` is null — the armed action-risk
 * checkpoint, where the engine really does wait forever (`subscribe_for_response`
 * with no timeout). It must NEVER appear on a card that has a deadline: on those
 * the run does NOT wait, it expires, and claiming otherwise is the exact dishonesty
 * Req 9's third acceptance bullet forbids ("Claiming the run waits unless the
 * fail-closed change has actually shipped").
 *
 * It deliberately says nothing about WHO may answer — "someone else approved it"
 * is Phase 186's surface, and promising it here would be a second lie.
 */
export const NO_DEADLINE_WAITING_LINE =
  "No deadline — the run is waiting for your answer and will not continue on its own"

/**
 * Phase 194.1 Plan 05 Task 3 (R7(b)) — THE FOURTH RETIREMENT SENTENCE, and the
 * only one raised by a STOP rather than by a clock or a server.
 *
 * Exported so the mount, the fence and this file read ONE string rather than
 * three transcriptions of it.
 *
 * ⚠ FOUR RETIREMENTS WEARING ONE COAT WOULD BE FOUR LIES, so this sentence is
 * PAIRWISE-DISTINCT from the three shipped ones and shares no complete sentence
 * with any of them (`PendingAskCard.test.tsx` asserts all SIX pairs, reading the
 * shipped three out of this file's own source rather than re-typing them). The
 * three it must differ from say, in order: the run is no longer active (a 404 on
 * submit); no response arrived within the deadline (a clock); and the prompt is no
 * longer active (no deadline at all). NONE of them says a PERSON stopped the run,
 * which is the one fact this arm exists to report.
 *
 * ⚠ IT NAMES THE ACT, NOT A CAUSE IT CANNOT KNOW. The client learns the run ended
 * by watching the workflow lock clear; that clears on EVERY terminal route. This
 * arm is only reached when the surface already shows a stop, so "stopped" is
 * honest — but it claims nothing about who stopped it, or why, or what survived.
 * The step count belongs on the stopped receipt (plan 07's run line), which is the
 * reading D-13 is actually about.
 */
export const RUN_STOPPED_RETIREMENT_LINE =
  "The run was stopped, so this question no longer needs an answer"

/**
 * Phase 289 (289-01, D-13 / SEED-360 F-1) — the line a PAUSED run's card shows where the clock
 * was. The window has passed, but the run is paused and still waiting, so the card keeps its
 * answer control instead of saying "agent stopped".
 *
 * ⚠ IT MAKES NO CLAIM THAT THE RUN CONTINUES. That sentence comes back only once the
 * paused-then-answered path is driven green live (S5, plan 05).
 */
export const PAUSED_WAITING_LINE =
  "The answer window has passed. The run is paused and still waiting for your answer."

/** mm:ss from a non-negative seconds count. */
function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

interface PendingAskCardProps {
  ask: PendingAsk
  /** Re-fetch the GET-reconciled prompt (carries run_id) — A2 / Pitfall 1. */
  reconcile: () => Promise<void>
  /**
   * Phase 194.1 Plan 05 (R7(b)) — true once the run this prompt belongs to is
   * over. DERIVED by `PendingAskStack` from two hooks the panel already calls; it
   * is never fetched, never stored and never written by this card.
   *
   * ⚠ OPTIONAL, defaulting to `false` — so every existing caller renders exactly
   * the card it rendered before this prop existed. `PendingAskStack` is the only
   * production caller and it always passes it.
   */
  runIsOver?: boolean
  /**
   * Phase 244-15 (SHELL-03 / UAT gap G-8) — fired ONCE after a SUCCESSFUL answer, never in
   * any `catch` arm.
   *
   * ⚠ OPTIONAL, defaulting to `undefined` — the same register as `runIsOver` / `action` /
   * `service`, and for the same reason: every existing caller renders exactly the card it
   * rendered before this prop existed. `PendingAskStack` is the only production caller that
   * passes it. `WorkflowRunPage` mounts this card DIRECTLY (`:1629`) and its home was
   * measured CORRECT during the drive, so it stays behaviourally byte-unchanged.
   *
   * ⚠ THE CARD DOES NOT KNOW WHAT SETTLING MEANS, and that is deliberate. It knows only that
   * its answer was accepted. The stack composes what happens next (the ask reconcile + the
   * workflow-lock release) because the stack is the one of the two that knows the thread id.
   */
  onAnswered?: () => void
  /**
   * Phase 214-11 Task 2 (STEP-04 / D-214-16 · sketch 216 §3 surface 5) — the identity of the
   * step this pause belongs to, RESOLVED BY THE CALLER.
   *
   * ⚠ OPTIONAL AND BOTH-OR-NEITHER IN EFFECT: with no `action` nothing renders, so every
   * existing caller — and every ordinary `ask_user` prompt, which belongs to no external step
   * — draws exactly the card it drew before these props existed.
   *
   * ⚠ `service: null` IS A LEGITIMATE VALUE, not a missing one: the bound connection was
   * deleted or belongs to another org. `StepIdentity` renders the action alone for it. Never
   * substitute a string here — never "Unknown service", never the capability id.
   *
   * ⚠ THIS CARD RESOLVES NEITHER (D-214-14 / T-214-11-04). `PendingAskStack` and
   * `WorkflowRunPage` both already hold the run's phase rows, so the answer comes off the same
   * wire the panel and the run page read — two surfaces that resolved independently would
   * disagree about one step at one moment.
   *
   * ⚠ D-213-14 STANDS: this adds IDENTITY and no receipt field. What is shown here is still
   * shown once and recorded never.
   */
  action?: string | null
  service?: string | null
  /**
   * The mark's structural input — the step's own wire facts. Never a connection lookup.
   *
   * ⚠ TYPED THROUGH THE ELEMENT (`StepIdentityProps["shape"]`) RATHER THAN FROM THE MARK
   * MODULE, deliberately. The rule this plan asserts mechanically is *no panel or chat surface
   * reaches past the element to the map*, and a direct import — even a type-only one that
   * erases at build — would make that fence read a hit it has to be argued away. Reaching
   * through the element is also the honest dependency: this card knows about `StepIdentity`,
   * and `StepIdentity` knows about the map.
   */
  shape?: StepIdentityProps["shape"]
  /**
   * Phase 282-02 (D-10 / D-14) — which `PendingAskStack` home rendered this card. It is written
   * onto the pending root as `data-ask-home` beside `data-ask-card={tool_call_id}`, so the chat
   * pointer's `Answer in panel →` can find the PANEL card for its ask. Omitted (no attribute) for
   * a direct mount such as WorkflowRunPage's.
   */
  home?: "chat" | "panel"
  /**
   * Phase 289 (289-01, D-13) — true when the run this prompt belongs to is `paused` on its human
   * gate. The countdown then never expires the card: it keeps the live-answer layout and shows
   * PAUSED_WAITING_LINE where the clock was. Passed by `WorkflowRunPage`, which holds the run row.
   *
   * ⚠ OPTIONAL, defaulting to false, so every existing caller renders exactly the card it
   * rendered before this prop existed. `PendingAskStack` cannot derive it (289-01-SUMMARY.md,
   * "Named gap: PendingAskStack") and does not pass it.
   */
  paused?: boolean
}

type CardState = "pending" | "answered" | "expired"

export function PendingAskCard({
  ask,
  reconcile,
  runIsOver = false,
  onAnswered,
  action = null,
  service = null,
  shape,
  home,
  paused = false,
}: PendingAskCardProps) {
  const { tool_call_id, prompt, timeout_seconds, run_id, draft } = ask
  // ask_user with no choices → backend stores options=null (free-text path).
  // Normalize to [] so the `.length`/index reads below never throw (a null here
  // crashed the whole panel — there is no error boundary). See BUG-260529-03.
  const options = ask.options ?? []

  // ── Phase 282-02 (FIX-07 / D-12) — the draft is READ, not owned. ──
  // It used to be two `useState`s here, so the chat card and the panel card for ONE pause held
  // two drafts that disagreed (BUG-260918-01 B). Now every rendering reads the one draft keyed by
  // `tool_call_id`; the two setters keep their old names so every downstream read is unchanged.
  const { choiceIndex, freeText } = useAskDraft(tool_call_id)
  const setChoice = useAskDraftStore((s) => s.setChoice)
  const setFreeTextAction = useAskDraftStore((s) => s.setFreeText)
  const markSettled = useAskDraftStore((s) => s.markSettled)
  const setChoiceIndex = (i: number | null) => setChoice(tool_call_id, i)
  const setFreeText = (t: string) => setFreeTextAction(tool_call_id, t)
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [state, setState] = useState<CardState>("pending")
  const [submitting, setSubmitting] = useState(false)
  const [answeredValue, setAnsweredValue] = useState<string>("")
  // 096-04 (BUG-260605-01): non-404 submit failures surface a visible,
  // retryable, CONSTANT-string error line — never silence, never raw server text.
  const [submitError, setSubmitError] = useState<string | null>(null)
  // 096-04: a 404-driven expiry carries its own honesty message; null → the
  // default countdown-timeout copy in the expired-state render.
  const [expiredMessage, setExpiredMessage] = useState<string | null>(null)

  // Countdown — drive the calm .expired state (D5). 096-04 (BUG-260605-01):
  // derive the initial remaining from created_at when present (GET-reconciled
  // prompts carry it — panel.py:154) so a stale reconciled prompt renders
  // expired on mount, never a misleading fresh 5:00. SSE-path prompts lack
  // created_at (genuinely fresh — emission ≈ mount) and honestly seed at
  // timeout_seconds. Ticks once a second while pending.
  //
  // Phase 185 (GOVERN-03 / L-15): ONE reading of "does this prompt have a
  // deadline at all". The armed action-risk checkpoint sends `null` — the run
  // waits for a person indefinitely — and the countdown is TOTAL over that case
  // rather than arithmetic on it. Doing the arithmetic would seed `remaining` at
  // NaN/0 and flip straight to "No response within 0:00 — agent stopped", i.e.
  // render every armed prompt as dead the instant it appeared.
  const hasDeadline = typeof timeout_seconds === "number"
  const initialRemaining =
    typeof timeout_seconds === "number"
      ? ask.created_at
        ? Math.max(0, timeout_seconds - Math.floor((Date.now() - Date.parse(ask.created_at)) / 1000))
        : timeout_seconds
      : 0
  const [remaining, setRemaining] = useState<number>(initialRemaining)

  useEffect(() => {
    // No deadline → no tick, and the `remaining <= 0 → expired` transition below
    // is UNREACHABLE. Such a card can still reach `expired` through the 404 path
    // (expiredMessage), which is correct — there the run really is terminal.
    // 289-01 (D-13): a PAUSED run is still waiting for this answer, so it never expires here.
    if (!hasDeadline || paused) return
    if (state !== "pending") return
    if (remaining <= 0) {
      setState("expired")
      // 282-02 (D-12): the draft dies with the ask, and the pointer learns it is settled.
      markSettled(tool_call_id)
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, state, hasDeadline, paused, markSettled, tool_call_id])

  // 289-REVIEW CR-02 (D-13 on the LIVE path): the client clock can reach 0 before the run page's
  // 5 s poll reports `paused`, and the card is keyed on tool_call_id, so it keeps that `expired`.
  // A CLOCK expiry (no `expiredMessage`) is not terminal for a paused run that is still waiting:
  // when `paused` arrives, return to the live-answer layout. A server-driven expiry (404 / 409,
  // which sets `expiredMessage`) stays terminal. What was typed before the clock expiry is gone
  // (the clock arm settled the draft); the person can answer afresh.
  useEffect(() => {
    if (paused && state === "expired" && expiredMessage === null) setState("pending")
  }, [paused, state, expiredMessage])

  // A2 / Pitfall 1: a pure-SSE prompt lacks run_id. Trigger ONE reconcile on
  // mount-if-missing so the GET-reconciled prompt (carrying run_id) replaces it
  // in the store. Submit stays gated until run_id lands.
  const reconciledOnce = useRef(false)
  useEffect(() => {
    if (run_id == null && !reconciledOnce.current) {
      reconciledOnce.current = true
      void reconcile()
    }
  }, [run_id, reconcile])

  const hasChoice = choiceIndex !== null
  const hasText = freeText.trim().length > 0
  const hasAnswer = hasChoice || hasText
  const runReady = run_id != null
  const canSubmit = hasAnswer && runReady && !submitting && state === "pending"

  const selectedValue = useMemo(() => {
    if (hasChoice && choiceIndex !== null) return options[choiceIndex]
    return freeText.trim()
  }, [hasChoice, choiceIndex, options, freeText])

  const handleSubmit = async () => {
    if (!canSubmit || run_id == null) return
    setSubmitting(true)
    setSubmitError(null)
    const valueForDisplay = selectedValue
    try {
      await answerAskUser(run_id, {
        tool_call_id,
        // BUG-260607-01: a choice-click answer must carry the chosen option's
        // TEXT — selectedValue resolves options[choiceIndex] for choices and
        // freeText for typed answers (the documented contract at the top of
        // this file). Sending "" for choices fed the model an empty answer.
        response_text: selectedValue,
        choice_index: hasChoice ? choiceIndex : null,
      })
      // Optimistic green answered state (D4). The ask_user_response SSE then
      // removes the prompt from the store, reactively unmounting this card.
      setAnsweredValue(valueForDisplay)
      setState("answered")
      // 282-02 (D-12): SUCCESS ONLY — clear the one draft and record the settle in one write.
      markSettled(tool_call_id)
      // ── Phase 244-15 (G-8) — SUCCESS ONLY, and after the optimistic flip. ──────────
      //
      // The comment two lines up describes the SSE path and is still true THERE. On the
      // WORKFLOW path the client is not subscribed to this run's stream, so that SSE never
      // lands, the SHARED store is never written, and the sibling home — a different
      // component instance with its own `useState` — keeps offering to answer a prompt the
      // server has already settled. This callback is what reaches the store on that path.
      //
      // ⛔ NEVER IN A `catch` ARM. A refused answer must leave the card answerable; settling
      // on a refusal would clear a prompt that is still genuinely waiting.
      //
      // ⚠ GUARDED: a throwing callback must not take the card down with it. There is no error
      // boundary anywhere above this component (`BUG-260529-03`), and the answer has already
      // been accepted by the server at this point — losing the receipt to a consumer's bug
      // would be strictly worse than losing the settle.
      try {
        onAnswered?.()
      } catch (cbErr) {
        console.warn("[PendingAskCard] onAnswered callback threw", cbErr)
      }
    } catch (err) {
      // Never crash the panel — and never stay silent (096-04 / BUG-260605-01).
      setSubmitting(false)
      const status = err instanceof ApiError ? err.status : null
      if (status === 404) {
        // D-06: the run is absent or not ours — the 404 is the backend's correct
        // IDOR-safe answer (runs.py anchor-confirm); surface it honestly as
        // the calm expired state instead of a dead-but-submittable card.
        setExpiredMessage("This prompt has expired — the run is no longer active")
        setState("expired")
        markSettled(tool_call_id)
      } else if (status === 409) {
        // ⚠ THE RUN IS OVER, AND THE SERVER IS THE ONLY PARTY THAT KNOWS.
        //
        // Operator-reported 2026-09-01: a chat run was cancelled 20 seconds after its ask
        // posted, and this card was still offering `Send Answer` a minute later. The stack's
        // `runIsOver` cannot catch it — it requires `phases.length > 0`, i.e. WORKFLOW
        // phases, so it is structurally always false for a chat run. The server now refuses
        // with 409.
        //
        // ⚠ THE SERVER'S OWN SENTENCE IS NOT SHOWN, AND THE COMMENT SAYING IT WAS HAS BEEN
        // CORRECTED. `answerAskUser` throws `new ApiError("Failed to submit ask_user
        // answer", res.status)` — a CONSTANT — so `err.message` carries the client's own
        // placeholder, never the server's `detail`. Rendering it would have shown a person
        // "Failed to submit ask_user answer", which is exactly the uninformative shape this
        // change exists to remove. Surfacing the real detail means teaching the client to
        // read the body; that is a separate change and is not pretended at here.
        //
        // ⚠ It retires rather than erroring, because a dead run is not a failure the person
        // can act on — offering a retry on it is the defect this replaces.
        setExpiredMessage("This run has already ended — your answer was not saved")
        setState("expired")
        markSettled(tool_call_id)
      } else if (status !== null && status >= 500) {
        // ⚠ NAMED, NOT "try again". A 500 means the answer was NOT recorded, and clicking
        // the same button again will do the same thing. Saying which half failed is the
        // difference between a person retrying usefully and retrying blindly.
        setSubmitError("The server couldn't record your answer. It has not been saved.")
      } else if (status !== null) {
        setSubmitError(`Your answer was refused (${status}). It has not been saved.`)
      } else {
        // No status at all — the request never reached the server (offline, dropped,
        // aborted). This is the ONE case where trying again is genuinely the right advice.
        setSubmitError("Couldn't reach the server — check your connection and try again.")
      }
    }
  }

  const labelId = `ask-${tool_call_id}-prompt`

  // ── Retired by a stopped run (194.1-05 / R7(b)) — DERIVED, never stored. ──
  //
  // ⚠ THIS IS A DERIVATION AND NOT A TENTH `useState`, and the distinction is the
  // D-03 stop condition rather than a style preference. This card already carries
  // NINE pieces of state; a tenth holding a fact that is a pure function of a prop
  // and existing state would be new state ownership on a file this plan is only
  // supposed to give a RENDER arm.
  //
  // ⚠ IT SHORT-CIRCUITS **ABOVE** THE `expired` ARM, WHICH IS WHY `canSubmit` IS
  // BYTE-UNTOUCHED. `canSubmit`'s `state === "pending"` conjunct is never re-read
  // once this branch is taken, so the retirement needs no clause there and cannot
  // perturb the 404 path, the countdown path or the "Preparing…" gate.
  //
  // ⚠ ONLY `pending` IS RETIRED. A card that already reached `answered` records
  // something the user really did and must keep saying so; one that already
  // reached `expired` has its own honest sentence. Overwriting either with a
  // fourth would be replacing a true statement with a different true statement,
  // for no reader's benefit.
  const arm: CardState | "retired" = runIsOver && state === "pending" ? "retired" : state

  if (arm === "retired") {
    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-[hsl(var(--muted-foreground-dim))] bg-muted/80 p-3 opacity-90"
        role="status"
      >
        {/* The SHAPE is adopted from the shipped `expired` arm below — calm grey,
            a `role="status"` root, a label, the question, a message slot. That is
            reuse of a settled design, not a new one. Only the WORD and the
            SENTENCE are new, because this is a different event. */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground-dim))]">
          <span
            className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--muted-foreground-dim))]"
            aria-hidden="true"
          />
          Retired
        </div>
        {/* ⚠ THE QUESTION STAYS. "Retired with a sentence, never removed" is a rule
            across every sketch-170 variant: a card that vanishes mid-read leaves
            the user unable to tell "the run stopped" from "the app lost my
            question". */}
        <p className="text-sm leading-relaxed text-foreground" id={labelId}>
          {prompt}
        </p>
        {/* IN-05: the root is already `role="status"`, so this inner line must NOT
            carry aria-live — a nested polite region can double-announce. */}
        <p className="text-[13px] text-[hsl(var(--muted-foreground-dim))]">
          {RUN_STOPPED_RETIREMENT_LINE}
        </p>
        {/* ⚠ THE SUBMIT CONTROL IS RENDERED, VISIBLY DEAD, RATHER THAN DELETED —
            and that is the same argument as keeping the card. A user who had
            already chosen an answer and reached for Send needs to see that the
            thing they were about to press is no longer available; a control that
            silently disappears from under a moving cursor is the small dishonesty
            this phase exists to remove, in miniature.

            BOTH axes are hard-`true` here, never one: `disabled` is what the
            BROWSER honours and `aria-disabled` is what a SCREEN READER announces,
            and a retirement that set only one would make the two audiences
            disagree. There is deliberately NO `onClick` — the attribute is not the
            only thing standing between this button and a dispatch. */}
        <button
          type="button"
          aria-disabled={true}
          disabled
          className={cn(
            "self-end rounded-md px-3.5 py-2 text-[13px] font-semibold",
            "min-h-[44px] bg-muted text-[hsl(var(--muted-foreground-dim))]",
            "cursor-not-allowed opacity-40",
          )}
        >
          Send Answer
        </button>
      </div>
    )
  }

  // ── Expired (D5) — calm grey, never a crash. ──
  if (state === "expired") {
    return (
      <div
        className="flex flex-col gap-2 rounded-md border border-[hsl(var(--muted-foreground-dim))] bg-muted/80 p-3 opacity-90"
        role="status"
      >
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground-dim))]">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--muted-foreground-dim))]" aria-hidden="true" />
          Expired
        </div>
        <p className="text-sm leading-relaxed text-foreground" id={labelId}>
          {prompt}
        </p>
        {/* IN-05: the card root is already role="status" (a polite live region),
            so this inner line must NOT also carry aria-live — a nested polite
            region inside role="status" can double-announce. The root announces.
            096-04: a 404-driven expiry renders its own constant honesty message;
            countdown-driven expiry keeps the timeout copy. */}
        <p className="text-[13px] text-[hsl(var(--muted-foreground-dim))]">
          {/* Phase 185: never call formatClock on a null deadline. A no-deadline
              card only reaches here via the 404 path, which always supplies its
              own message; the fallback stays honest rather than saying "0:00". */}
          {expiredMessage ??
            (typeof timeout_seconds === "number"
              ? `No response within ${formatClock(timeout_seconds)} — agent stopped`
              : "This prompt is no longer active")}
        </p>
      </div>
    )
  }

  // ── Answered (D4) — green, records the answer. ──
  if (state === "answered") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-[hsl(var(--success))] bg-[hsl(var(--success)/0.12)] p-3">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--success))]" aria-hidden="true" />
          Answered · agent resumed
        </div>
        <p className="text-sm leading-relaxed text-foreground" id={labelId}>
          {prompt}
        </p>
        <p className="text-[13px] text-foreground" aria-live="polite">
          You answered <b className="font-semibold text-[hsl(var(--success))]">{answeredValue}</b>
        </p>
      </div>
    )
  }

  // ── Pending (amber, needs you) ──
  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.12)] p-3"
      role="group"
      aria-labelledby={labelId}
      // 282-02 (D-14): how the chat pointer's `Answer in panel →` finds THIS ask's panel card.
      data-ask-card={tool_call_id}
      data-ask-home={home}
    >
      {/* Assertive announce — "blocked on me" must reach a screen reader. */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--warning))]">
        <span
          className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--warning))] animate-dotBounce"
          aria-hidden="true"
        />
        <span aria-live="assertive">Needs you</span>
        {hasDeadline && !paused && (
          <span className="ml-auto text-[hsl(var(--muted-foreground-dim))]">{formatClock(remaining)}</span>
        )}
      </div>

      {/* Phase 185 (GOVERN-03): in place of the countdown, an honest line — but
          ONLY when there is genuinely no deadline. See NO_DEADLINE_WAITING_LINE. */}
      {!hasDeadline && (
        <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground-dim))]">
          {NO_DEADLINE_WAITING_LINE}
        </p>
      )}
      {/* 289-01 (D-13): a paused run's window has passed; the clock gives way to this line. */}
      {hasDeadline && paused && (
        <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground-dim))]">
          {PAUSED_WAITING_LINE}
        </p>
      )}

      {/* Phase 094 (D-06): the draft renders ABOVE the question — labelled
          "not yet saved" so it is never read as the final answer. DRAFT-MISSING
          guard: hide the block entirely when draft is undefined/empty (older
          streams), never an empty DRAFT box (DATA-CONTRACT §6). */}
      {/* ── Phase 214-11 Task 2 (STEP-04 / D-214-16 · sketch 216 §3 surface 5) — WHAT IS ABOUT
             TO RUN, AND THROUGH WHAT.
             Above the question, because at a pause the reader's first question is *what is
             this about to do* — the prompt beneath then answers *what exactly will it send*.
             ⚠ Nothing renders when the caller resolved no action: an ordinary `ask_user`
             prompt belongs to no external step, and drawing a neutral mark beside it would
             claim a step identity the prompt does not have. */}
      {action && (
        <StepIdentity
          shape={shape ?? {}}
          action={action}
          service={service}
          size="row"
          className="text-[hsl(var(--muted-foreground-dim))]"
        />
      )}

      {draft && <DraftBlock draft={draft} />}

      <p className="text-sm leading-relaxed text-foreground" id={labelId}>
        {prompt}
      </p>

      {/* Choice chips (optional) — radiogroup of role=radio buttons (D3).
          282-02 (D-13 / D-24) completes the APG radio pattern: ONE tab stop (roving tabindex —
          the selected chip, else the first), arrows move AND select with wrap, Space selects
          only (never deselects), while Enter and click keep the D-13 toggle through `onClick`.
          The aria-hidden mark + its dot make selection a SHAPE as well as a colour. */}
      {options.length > 0 && (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
          {options.map((opt, i) => {
            const selected = choiceIndex === i
            const onChipKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
              let target: number | null = null
              if (e.key === "ArrowDown" || e.key === "ArrowRight") target = (i + 1) % options.length
              else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
                target = (i - 1 + options.length) % options.length
              else if (e.key === " ") {
                e.preventDefault()
                if (!selected) setChoiceIndex(i)
                return
              }
              if (target === null) return
              e.preventDefault()
              setChoiceIndex(target)
              chipRefs.current[target]?.focus()
            }
            return (
              <button
                key={i}
                ref={(el) => {
                  chipRefs.current[i] = el
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={(choiceIndex ?? 0) === i ? 0 : -1}
                onClick={() => setChoiceIndex(selected ? null : i)}
                onKeyDown={onChipKeyDown}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                  "min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected
                    ? "border-[hsl(var(--warning))] bg-[hsl(var(--warning))] font-semibold text-[hsl(var(--warning-foreground))]"
                    : "border-border bg-card text-foreground hover:border-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.12)]",
                )}
              >
                <span
                  aria-hidden="true"
                  data-testid="ask-radio-mark"
                  className={cn(
                    "flex h-4 w-4 flex-none items-center justify-center rounded-full border-2",
                    selected
                      ? "border-[hsl(var(--warning-foreground))]"
                      : "border-[hsl(var(--muted-foreground-dim))]",
                  )}
                >
                  {selected && (
                    <span
                      data-testid="ask-radio-dot"
                      className="h-2 w-2 rounded-full bg-[hsl(var(--warning-foreground))]"
                    />
                  )}
                </span>
                <span>{opt}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* "or" divider — only meaningful when both surfaces are present. */}
      {options.length > 0 && (
        <div className="text-center font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground-dim))]">
          or
        </div>
      )}

      {/* Always-present free-text (D3 — no-options trap). */}
      <div className="flex flex-col gap-1.5">
        {/* ── Phase 200 (sketch `run-panel-parts.html`) — THE LABEL IS VISIBLE NOW ──────
              The sheet draws a "Reason" field label above this box. It shipped `sr-only`,
              so a screen-reader user was told what the box was for and a SIGHTED user was
              told nothing — the same asymmetry `PORT-canvas.md` found on the plane's end
              cap and fixed the same way.

              ⚠ THE WORD DEPENDS ON WHAT THE BOX IS FOR, and both arms are honest rather
              than one being the sheet's. With options present the choice is the answer and
              this box is the SUPPORTING SENTENCE beside it — the sheet's "Reason", which is
              what it draws it next to. With NO options (the D3 no-options case) this box IS
              the answer, and calling it a reason would mislabel the only control on the
              card. So the sr-only wording is kept verbatim for that arm rather than
              replaced, and nothing is renamed for a case the sheet does not draw.

              Still tied by `htmlFor`/`id`, so the accessible name is the visible text and
              the two cannot drift — which is exactly what an `sr-only` label risks. */}
        <label
          htmlFor={`ask-${tool_call_id}-free`}
          data-testid="ask-free-label"
          className="text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground-dim))]"
        >
          {options.length > 0 ? "Reason" : "Type an answer"}
        </label>
        <textarea
          id={`ask-${tool_call_id}-free`}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Type an answer…"
          rows={2}
          className="resize-y rounded-md border border-border bg-background px-2.5 py-2 text-[13px] text-foreground focus:border-[hsl(var(--warning))] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          aria-disabled={!canSubmit}
          disabled={!canSubmit}
          className={cn(
            "self-end rounded-md px-3.5 py-2 text-[13px] font-semibold transition-opacity",
            "min-h-[44px] bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            !canSubmit && "cursor-not-allowed opacity-40",
          )}
        >
          {/* A2: a real run_id has not landed yet → quiet "preparing…" affordance. */}
          {hasAnswer && !runReady ? "Preparing…" : "Send Answer"}
        </button>
        {/* 096-04: non-404 submit failure — visible + retryable. CONSTANT string,
            never raw server text (T-096-04-01/02). role="alert" announces the
            failure; it renders only on error so it never double-announces. */}
        {submitError && (
          <p role="alert" className="self-end text-[12px] text-[hsl(var(--destructive))]">
            {submitError}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Pinned stack of pending asks. Consumes the Phase 086 hook and renders the
 * full PendingAsk[] newest-first, each its own sticky amber card (D-03). Mounted
 * by WorkspacePanel (Plan 02) at the very top, regardless of section order.
 *
 * Phase 282-02 (FIX-07 / D-10, D-11) — `home` says which of the two mounts this is. The panel
 * mount passes `home="panel"` and registers its presence for the thread; the chat column's
 * unconditional mount keeps the default `"chat"` and, WHILE a panel home is mounted for the same
 * thread, renders a one-line `AskPointer` per ask instead of a second card — so one pause shows
 * one answer input. With no panel home it renders the full card, exactly as before (the
 * BUG-260828-07 reachability). Neither mount's CONDITION changes; only what the chat one renders.
 */
export function PendingAskStack({ home = "chat" }: { home?: "chat" | "panel" } = {}) {
  const threadId = useViewingThread()
  const { data: asks, reconcile } = useAskUserPrompt(threadId)
  // Phase 194.1 Plan 05 (R7(b)) — the run-is-over signal, DERIVED from two hooks
  // the panel already calls for its timeline. No new fetch, no new endpoint, no
  // new store slice, and nothing written anywhere.
  //
  //   lock == null            the anchor is released. The lock invariant is
  //                           "a thread holds a lock IFF a NON-TERMINAL Harness
  //                           run owns its `active_workflow_run_id`", and it is
  //                           cleared on every terminal route.
  //   phases.length > 0       a harness run EXISTED. Durable phase rows outlive a
  //                           terminal (`threads.py:1176-1186`), so this is what
  //                           separates "the run ended" from "there was never one".
  //
  // ⚠ BOTH CONJUNCTS ARE LOAD-BEARING AND EACH ONE ALONE IS WRONG IN A DIFFERENT
  // DIRECTION. `lock == null` alone is TRUE on a Deep thread, which has no run to
  // stop and whose `ask_user` prompts must stay answerable — that would retire
  // every Deep approval the instant it appeared. `phases.length > 0` alone is TRUE
  // mid-run, which would retire a LIVE prompt the moment its first phase landed —
  // the exact failure mode of the shipped Stop row this plan's Task 1 fixed, in a
  // new place.
  const workflowLock = useWorkflowLockForThread(threadId)
  const { data: phases } = usePhases(threadId)
  const runIsOver = workflowLock == null && phases.length > 0

  // ── Phase 214-11 Task 2 (STEP-04 / D-214-16 / D-214-14) — THE STACK RESOLVES; THE CARD
  //    RENDERS.
  //
  // ⚠ NO NEW FETCH, NO NEW HOOK, NO NEW STORE SLICE. `phases` is already in hand two lines
  // up — it is what `runIsOver` is derived from — so this reads the SAME rows the panel's
  // timeline draws, off the SAME wire. That is what makes the pause and the timeline
  // structurally incapable of naming one step two ways (T-214-11-04); a lookup of our own
  // would have been the disagreement's first day.
  //
  // ⚠ THE RUNNING EXTERNAL STEP, NOT "AN" EXTERNAL STEP. A run can hold several, and the
  // prompt belongs to the one that is executing. When none is running the identity is absent
  // rather than guessed — a wrong service on an approval surface is worse than none, which is
  // this phase's own opening argument.
  const pausedStep =
    phases.find((p) => p.phaseType === "external_action" && p.status === "running") ?? null
  // ⚠ THROUGH THE SHARED RESOLVER, never a local bracket read. `capability` is author-supplied
  // JSONB off the wire; `stepActionWords` is total over it and carries the WR-04 own-guard.
  const pausedAction = stepActionWords(pausedStep?.capability)

  // ── Phase 244-15 (SHELL-03 / UAT gap G-8) — THE SETTLE, COMPOSED FROM TWO SHIPPED THINGS ──
  //
  // Built HERE and not in the card, because the stack is the one of the two that knows the
  // thread id. It composes exactly two existing mechanisms and creates no third:
  //
  //   1. `reconcile()` — the ask reconcile this component ALREADY holds from
  //      `useAskUserPrompt(threadId)`. ⭐ THIS IS THE WHOLE CROSS-HOME SETTLE, and it needs no
  //      new fetch code: one GET → `replacePendingAsksForThread` → ONE shared store key
  //      (`pendingAsksByThread`), which BOTH homes read. `D-244-11`'s structural claim was
  //      always true of the store; this is what makes it true of the path that reaches it.
  //   2. `releaseSettledWorkflowLock(threadId)` — re-read the thread's workflow state and
  //      release a lock the server has already dropped. It RELEASES ONLY; see its own comment.
  //
  // ⛔ REACHED THROUGH `useStreamsStore.getState().actions`, NOT through `useStreamActions()`,
  // and the reason is MEASURED rather than stylistic. Eight suites mock
  // `@/providers/StreamsProvider` with an ALLOW-LIST factory and render this stack directly or
  // through `WorkspacePanel` / `MessageList` (ChatArea.approval, MessageItem.continueButton,
  // StopControl.baseline, PendingAskCard, PendingAskCard.retired.baseline, WorkspacePanel,
  // WorkspacePanel.derived, WorkflowRunPage). A new provider-hook import would make every one
  // of them throw on an omitted export. The STORE module is not mocked in those suites, and
  // its synchronous no-op default is exactly the right behaviour for a stack mounted without a
  // provider: with no provider there is no lock to release. ⚠ Do not "tidy" this into the hook.
  //
  // ⚠ FIRE-AND-FORGET AND ORDER-FREE: neither call depends on the other's result, and both are
  // best-effort reads whose failure leaves the surface exactly as stale as it already was.
  const settleAnswered = () => {
    if (!threadId) return
    void reconcile()
    useStreamsStore.getState().actions.releaseSettledWorkflowLock(threadId)
  }

  // ── Phase 282-02 (D-11 / D-24) — the panel-home presence registry. ──
  // A LAYOUT effect, not a passive one: the chat stack's switch to the pointer must land before
  // the browser paints, or one frame shows two inputs (Pitfall 7). Mount presence equals
  // visibility, because WorkspacePanel renders its body only while the desktop panel is open or
  // the mobile Sheet is open — so `ChatLayout.tsx`'s panel state is never read.
  useLayoutEffect(() => {
    if (home !== "panel" || !threadId) return
    const { addPanelHome, removePanelHome } = useAskDraftStore.getState()
    addPanelHome(threadId)
    return () => removePanelHome(threadId)
  }, [home, threadId])
  const panelMounted = usePanelHomeMounted(threadId)

  if (asks.length === 0) return null

  // Newest pinned on top (D-03). created_at is GET-only; fall back to the array
  // order (store insertion order) when it is absent on the SSE path.
  const ordered = [...asks].sort((a, b) => {
    if (a.created_at && b.created_at) return b.created_at.localeCompare(a.created_at)
    return 0
  })

  return (
    <div className="flex flex-col gap-2">
      {ordered.map((ask) => (
        <div
          key={ask.tool_call_id}
          className="sticky top-0 z-[4]"
        >
          {home === "chat" && panelMounted ? (
            <AskPointer ask={ask} runIsOver={runIsOver} />
          ) : (
            <PendingAskCard
              ask={ask}
              reconcile={reconcile}
              runIsOver={runIsOver}
              onAnswered={settleAnswered}
              action={pausedAction}
              service={pausedStep?.serviceName ?? null}
              shape={stepMarkShape(pausedStep?.capability, pausedStep?.toolName)}
              home={home}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/** The arrival flash on the panel card after `Answer in panel →` (UI-SPEC Surface 1, step 4). */
const ARRIVAL_FLASH = ["outline", "outline-2", "outline-offset-4", "outline-[hsl(var(--warning))]"]
const ARRIVAL_FLASH_MS = 900

/**
 * Phase 282-02 (FIX-07 / D-10, D-14 · sketch 282 variant A) — the chat column's one-line pointer
 * to the panel card, rendered while a panel home shows the pause. It is NOT an input: it shows
 * the question, the ONE draft (read from the store, never copied) and a working
 * `Answer in panel →` that moves focus into the panel card.
 *
 * - Renders nothing once the ask is settled (answered or expired in any rendering) or retired, so
 *   it never reads "No answer yet" for an answered ask; the panel card carries the receipt.
 * - No live region: the panel card's `aria-live="assertive"` "Needs you" already announces the
 *   pause, and a live draft line would chatter on every keystroke.
 * - Prompt and draft are plain React text (T-087-11).
 */
function AskPointer({ ask, runIsOver }: { ask: PendingAsk; runIsOver: boolean }) {
  const { tool_call_id: id, prompt } = ask
  const options = ask.options ?? []
  const settled = useAskSettled(id)
  const { choiceIndex, freeText } = useAskDraft(id)
  if (settled || runIsOver) return null

  // Copywriting Contract: the option wins (the card's own `selectedValue` rule), then trimmed
  // free text in curly quotes, else "No answer yet". The full string is in the DOM; only CSS
  // truncates it.
  const option = choiceIndex !== null ? options[choiceIndex] : undefined
  const typed = freeText.trim()
  const draftLine =
    option !== undefined ? `Draft: ${option}` : typed ? `Draft: “${typed}”` : "No answer yet"
  const questionId = `ask-${id}-pointer-q`

  // D-14: always a handler. It finds THIS ask's panel card by its data attributes (iterated and
  // compared, not a built selector — no CSS.escape needed), focuses its first control (the chip
  // holding the roving tab stop, else the textarea) and flashes a static outline. If the card is
  // gone (a race with the panel collapsing) it does nothing and throws nothing.
  const goToPanel = () => {
    const card = Array.from(document.querySelectorAll<HTMLElement>('[data-ask-home="panel"]')).find(
      (el) => el.dataset.askCard === id,
    )
    if (!card) return
    const target =
      card.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ??
      card.querySelector<HTMLElement>("textarea")
    target?.focus()
    card.classList.add(...ARRIVAL_FLASH)
    window.setTimeout(() => card.classList.remove(...ARRIVAL_FLASH), ARRIVAL_FLASH_MS)
  }

  return (
    <div
      role="group"
      aria-labelledby={questionId}
      data-testid="ask-pointer"
      data-tool-call-id={id}
      className="flex items-center gap-3 rounded-md border border-dashed border-[hsl(var(--warning))] px-3 py-2"
    >
      <span className="flex flex-none items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--warning))]">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" aria-hidden="true" />
        Needs you
      </span>
      <span id={questionId} title={prompt} className="min-w-0 flex-1 truncate text-[13px] leading-5 text-foreground">
        {prompt}
      </span>
      <span
        data-testid="ask-pointer-draft"
        className="flex-none max-w-[12rem] truncate text-[12px] leading-5 text-[hsl(var(--muted-foreground-dim))]"
      >
        {draftLine}
      </span>
      <button
        type="button"
        data-testid="ask-pointer-go"
        onClick={goToPanel}
        className="flex-none min-h-[32px] rounded-md border border-[hsl(var(--warning))] px-3 py-1 text-[12px] font-semibold text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Answer in panel <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}

export default PendingAskCard
