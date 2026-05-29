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
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useAskUserPrompt, useViewingThread } from "@/providers/StreamsProvider"
import { answerAskUser } from "@/lib/api"
import type { PendingAsk } from "@/types"

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
}

type CardState = "pending" | "answered" | "expired"

export function PendingAskCard({ ask, reconcile }: PendingAskCardProps) {
  const { tool_call_id, prompt, timeout_seconds, run_id } = ask
  // ask_user with no choices → backend stores options=null (free-text path).
  // Normalize to [] so the `.length`/index reads below never throw (a null here
  // crashed the whole panel — there is no error boundary). See BUG-260529-03.
  const options = ask.options ?? []

  const [choiceIndex, setChoiceIndex] = useState<number | null>(null)
  const [freeText, setFreeText] = useState("")
  const [state, setState] = useState<CardState>("pending")
  const [submitting, setSubmitting] = useState(false)
  const [answeredValue, setAnsweredValue] = useState<string>("")

  // Countdown — drive the calm .expired state (D5). Recomputed from
  // timeout_seconds on mount; ticks once a second while pending.
  const [remaining, setRemaining] = useState<number>(timeout_seconds)

  useEffect(() => {
    if (state !== "pending") return
    if (remaining <= 0) {
      setState("expired")
      return
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining, state])

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
    const valueForDisplay = selectedValue
    try {
      await answerAskUser(run_id, {
        tool_call_id,
        response_text: hasText ? freeText.trim() : "",
        choice_index: hasChoice ? choiceIndex : null,
      })
      // Optimistic green answered state (D4). The ask_user_response SSE then
      // removes the prompt from the store, reactively unmounting this card.
      setAnsweredValue(valueForDisplay)
      setState("answered")
    } catch {
      // Leave the card pending so the user can retry; never crash the panel.
      setSubmitting(false)
    }
  }

  const labelId = `ask-${tool_call_id}-prompt`

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
        <p className="text-[13px] text-[hsl(var(--muted-foreground-dim))]" aria-live="polite">
          No response within {formatClock(timeout_seconds)} — agent stopped
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
        <span className="ml-auto text-[hsl(var(--muted-foreground-dim))]">{formatClock(remaining)}</span>
      </div>

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
        <label htmlFor={`ask-${tool_call_id}-free`} className="sr-only">
          Type an answer
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
          <PendingAskCard ask={ask} reconcile={reconcile} />
        </div>
      ))}
    </div>
  )
}

export default PendingAskCard
