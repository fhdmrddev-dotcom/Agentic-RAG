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
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  useAskUserPrompt,
  useViewingThread,
  // Phase 194.1 Plan 05 (R7(b)): the two READS that derive "this run is over".
  // Both are already consumed by WorkspacePanel for its timeline gate, so this
  // adds no fetch and no new source of truth — only a second reader.
  useWorkflowLockForThread,
  usePhases,
} from "@/providers/StreamsProvider"
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
}

type CardState = "pending" | "answered" | "expired"

export function PendingAskCard({ ask, reconcile, runIsOver = false }: PendingAskCardProps) {
  const { tool_call_id, prompt, timeout_seconds, run_id, draft } = ask
  // ask_user with no choices → backend stores options=null (free-text path).
  // Normalize to [] so the `.length`/index reads below never throw (a null here
  // crashed the whole panel — there is no error boundary). See BUG-260529-03.
  const options = ask.options ?? []

  const [choiceIndex, setChoiceIndex] = useState<number | null>(null)
  const [freeText, setFreeText] = useState("")
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
    if (!hasDeadline) return
    if (state !== "pending") return
    if (remaining <= 0) {
      setState("expired")
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, state, hasDeadline])

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
    } catch (err) {
      // Never crash the panel — and never stay silent (096-04 / BUG-260605-01).
      setSubmitting(false)
      if (err instanceof ApiError && err.status === 404) {
        // D-06: the run is terminal — the 404 is the backend's correct
        // IDOR-safe answer (runs.py anchor-confirm); surface it honestly as
        // the calm expired state instead of a dead-but-submittable card.
        setExpiredMessage("This prompt has expired — the run is no longer active")
        setState("expired")
      } else {
        // Transient/unknown failure — leave the card pending so the user can
        // retry, with a visible constant-string error line.
        setSubmitError("Couldn't submit your answer — try again.")
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
    >
      {/* Assertive announce — "blocked on me" must reach a screen reader. */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--warning))]">
        <span
          className="h-[7px] w-[7px] flex-none rounded-full bg-[hsl(var(--warning))] animate-dotBounce"
          aria-hidden="true"
        />
        <span aria-live="assertive">Needs you</span>
        {hasDeadline && (
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

      {/* Phase 094 (D-06): the draft renders ABOVE the question — labelled
          "not yet saved" so it is never read as the final answer. DRAFT-MISSING
          guard: hide the block entirely when draft is undefined/empty (older
          streams), never an empty DRAFT box (DATA-CONTRACT §6). */}
      {draft && <DraftBlock draft={draft} />}

      <p className="text-sm leading-relaxed text-foreground" id={labelId}>
        {prompt}
      </p>

      {/* Choice chips (optional) — radiogroup of role=radio buttons (D3). */}
      {options.length > 0 && (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-1.5">
          {options.map((opt, i) => {
            const selected = choiceIndex === i
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChoiceIndex(selected ? null : i)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-[13px] transition-colors",
                  "min-h-[44px] focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected
                    ? "border-[hsl(var(--warning))] bg-[hsl(var(--warning))] font-semibold text-[hsl(var(--warning-foreground))]"
                    : "border-border bg-card text-foreground hover:border-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.12)]",
                )}
              >
                {opt}
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
 */
export function PendingAskStack() {
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
          <PendingAskCard ask={ask} reconcile={reconcile} runIsOver={runIsOver} />
        </div>
      ))}
    </div>
  )
}

export default PendingAskCard
