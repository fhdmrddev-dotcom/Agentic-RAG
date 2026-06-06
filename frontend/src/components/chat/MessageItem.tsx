import { memo, useRef, useState } from "react"
import { Sparkles, Loader2, RotateCcw, Square, User, Zap, Play } from "lucide-react"
import type { Message } from "@/types"
import { Button } from "@/components/ui/button"
// Phase 092 (CONT-01 / D-07): the inline Continue card reads the per-thread
// workflow lock (carries capPaused + continuesRemaining) keyed by the OWNING
// thread id — delivered OUT-OF-BAND (the role='system' carrier row is filtered
// from /messages, BUG-260528-01) via the cap_paused SSE + the mount reconcile.
import { useWorkflowLockForThread } from "@/providers/StreamsProvider"
// Phase 092-07 (Facet C): after a Harness Continue the backend mints a FRESH
// producer runs row + returns its id; re-subscribe its live stream (per-thread
// keyed, additive — mirrors panelOpenSignal).
import { requestProducerResubscribe } from "@/providers/producerResubscribeSignal"
import { continueRun } from "@/lib/api"
import { RunCard } from "./RunCard"
import { WorkingBadge } from "./WorkingBadge"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ConfidenceBadge } from "./ConfidenceBadge"
import { CitationList } from "./CitationList"
import { SuggestionPills } from "./SuggestionPills"
import { MessageFeedback } from "./MessageFeedback"
import { OutputFileCard } from "./OutputFileCard"
import { toolLabel, toolSummary, outerBannerLabel } from "@/lib/toolMeta"
// Phase 087-05 (D-05 / chat-panel-seam.md): ADDITIVE seam renderers. Live runs
// show quiet pointers / a paused cue; reloaded history resolves to self-contained
// cards. These mount as NEW siblings only — they never touch RunCard /
// ToolCallPanel internals (G-5; BUG-260529-02 stays a separate phase).
import { SeamPointer, type SeamKind } from "@/components/panel/SeamPointer"
import { SeamCard, type SeamCardPayload } from "@/components/panel/SeamCard"
import { PausedRunCue } from "@/components/panel/PausedRunCue"
// Phase 087-02: the WorkspacePanel owns the open action; the chat-side seam
// affordances request it via this module-level signal (additive wiring — no
// MessageItem→MessageList→ChatArea prop re-plumbing, PANEL-06 safe).
import { requestOpenPanel } from "@/components/panel/panelOpenSignal"
import type { ToolCall } from "@/types"

/**
 * Phase 087-05: the three panel-owned tools (write_todos / workspace_write /
 * ask_user) render via the seam, not as raw chat tool rows. Map a ToolCall name
 * to its SeamKind, or null when it is not panel-owned.
 */
function seamKindFor(name: string): SeamKind | null {
  if (name === "write_todos" || name === "workspace_write" || name === "ask_user") {
    return name
  }
  return null
}

/** A paused run is one with an ask_user tool still awaiting the user (D2). */
function hasPendingAsk(toolCalls: ToolCall[] | undefined): boolean {
  return (
    toolCalls?.some(
      (tc) => tc.name === "ask_user" && (tc.status === "running" || tc.status === "interrupted"),
    ) ?? false
  )
}

/**
 * Phase 095.1 Plan 05 (D-095.1-06) — the FLAT "Generated files" list.
 *
 * REVERSES the 095-05/08 hero/working split (operator-approved CONTEXT.md
 * decision): no hero crown caption, no hero/working split, no collapse
 * group. Output files render as ONE equal flat list — every file an equal
 * `OutputFileCard` row, all visible, all downloadable. The frontend IGNORES the
 * backend `is_hero` flag entirely (no read here) — it stays WRITTEN-BUT-UNREAD,
 * harmless and forward-compatible (no backend change). The url-less "Download
 * unavailable" dead-state affordance is an ORTHOGONAL honesty fix that lives in
 * OutputFileCard and is KEPT. No local collapse state, so this sub-component no
 * longer perturbs MessageItem's hook order in any new way.
 */
type FinalOutputFile = NonNullable<Message["finalOutputFiles"]>[number]

function FinalOutputsPanel({ files }: { files: FinalOutputFile[] }) {
  return (
    <div className="mt-3 border-t border-border/60 pt-3.5" data-testid="final-outputs-panel">
      <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground mb-2.5">Generated files</div>
      <div className="space-y-1.5">
        {files.map((f, i) => (
          <OutputFileCard key={`gen-${i}`} file={f} />
        ))}
      </div>
    </div>
  )
}

/**
 * Build the reload-mode SeamCard payload from a resolved panel-owned ToolCall
 * (D3). Renders ONLY summarized known fields — never the raw payload. Values are
 * best-effort: args are a Record<string,string> (Phase 086 wire), result is the
 * agent's answer for ask_user.
 */
function seamCardPayloadFor(tc: ToolCall): SeamCardPayload {
  switch (tc.name) {
    case "ask_user":
      return { question: tc.args.prompt, answer: tc.result ?? undefined }
    case "workspace_write": {
      const v = tc.args.version
      return {
        path: tc.args.path ?? tc.args.file_path,
        version: v != null ? Number(v) : undefined,
      }
    }
    case "write_todos": {
      // 087-08 fix: write_todos args carry a `todos` array ({id, content, status});
      // there is no total/done field, so the prior tc.args.total/.done read undefined
      // and the SeamCard always showed "☑ 0 todos". Derive the counts from the list
      // (array, or JSON string per wire drift). status enum: pending|in_progress|completed.
      const raw = (tc.args as Record<string, unknown>).todos
      let todos: Array<{ status?: string }> = []
      if (Array.isArray(raw)) {
        todos = raw as Array<{ status?: string }>
      } else if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) todos = parsed
        } catch {
          /* leave empty — never throw in a render-path mapper */
        }
      }
      const doneCount = todos.filter((t) => t?.status === "completed").length
      return {
        todoTotal: todos.length,
        todoDone: doneCount > 0 ? doneCount : undefined,
      }
    }
    default:
      return {}
  }
}

interface Props {
  message: Message
  isStreaming?: boolean
  onSendMessage?: (content: string) => void
  /** Phase 063 (Pattern 4 / D-063-04): handler for the Resume button shown only on failed assistant runs. */
  onResume?: (message: Message) => void
  /** Phase 092 (CONT-01 / D-07): true when this is the last assistant message —
   *  gates the inline Continue card (cap_paused is delivered out-of-band on the
   *  thread lock, not on this message's runStatus) so it appears once, at the
   *  bottom where the run paused. */
  isLastAssistant?: boolean
}

/**
 * Phase 076.1 D-07: Render-time dedup for consecutive identical text blocks.
 * Two-pass approach:
 *   1. Split by \n\n and collapse consecutive duplicate paragraphs (handles
 *      models that emit paragraph breaks between repeats).
 *   2. Detect repeated sentence-sized chunks within a single block (handles
 *      models like Anthropic/DeepSeek that concatenate repeats without breaks).
 * Preserves raw data in StreamsProvider unchanged — display-only.
 */
function dedupParagraphs(text: string): string {
  if (!text) return text

  // Pass 1: paragraph-level dedup (split by \n\n)
  const paragraphs = text.split('\n\n')
  const deduped: string[] = []
  let prev = ''
  for (const p of paragraphs) {
    const trimmed = p.trim()
    if (trimmed === prev && trimmed.length > 20) continue
    deduped.push(p)
    prev = trimmed
  }

  // Pass 2: within each paragraph, detect repeated sentence-sized chunks.
  // If a block contains the same sentence (>30 chars) repeated 2+ times
  // consecutively, collapse to single occurrence.
  const result = deduped.map(block => {
    if (block.length < 80) return block
    // Split on sentence boundaries (period/exclamation/question + space + capital)
    const sentences = block.split(/(?<=[.!?])\s+(?=[A-Z])/)
    if (sentences.length < 2) return block
    const seen: string[] = []
    for (const s of sentences) {
      const trimmed = s.trim()
      if (trimmed.length > 30 && seen.length > 0 && seen[seen.length - 1] === trimmed) {
        continue
      }
      seen.push(trimmed)
    }
    return seen.join(' ')
  })

  return result.join('\n\n')
}

// Plan 075.4-04 D-075.4-SC#6 — React.memo wrap with default shallow-eq props.
// ChatArea stabilizes onSendMessage + onResume via useCallback (ref-stable
// across parent re-renders); StreamsProvider mutates messagesByThread by
// REPLACE (not in-place push), so message prop identity reliably changes
// only when the message actually changed. Named inner function preserves
// DevTools display name. Target: ≥30% MessageItem render-cost reduction on
// 50-message thread during streaming (verified via React DevTools profiler).
export const MessageItem = memo(function MessageItem({ message, isStreaming, onSendMessage, onResume, isLastAssistant }: Props) {
  const isUser = message.role === "user"
  // Phase 092 (CONT-01 / D-07): the per-thread workflow lock for THIS message's
  // owning thread (out-of-band cap_paused state). The Continue card renders only
  // on the last assistant message when the lock reports cap_paused.
  const workflowLock = useWorkflowLockForThread(message.thread_id ?? null)
  const [continuePending, setContinuePending] = useState(false)
  const [continueExhausted, setContinueExhausted] = useState(false)

  if (isUser) {
    return (
      <div className="flex justify-end py-2 animate-fadeSlideUp" data-testid="user-message">
        <div className="flex items-end gap-2.5 max-w-[70%]">
          <div className="gradient-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed shadow-sm">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border border-border/50 flex items-center justify-center mb-0.5">
            <User className="w-3.5 h-3.5 text-foreground/70" />
          </div>
        </div>
      </div>
    )
  }

  const hasRunningTools = message.tool_calls?.some((tc) => tc.status === "running") ?? false
  const hasAnyTools = (message.tool_calls?.length ?? 0) > 0
  const allToolsDone = hasAnyTools && !hasRunningTools
  // Phase 095.1 Plan 05 (D-095.1-07): deliverable-aware Resume gate predicate.
  // True when this run already produced execute_code output files (persisted +
  // reload-reconstructed onto finalOutputFiles, api.ts) before a later iteration
  // failed/timed_out — so Resume must NOT be offered (the user's work is already
  // on disk). Closes BUG-260518-01.
  const producedDeliverables = (message.finalOutputFiles?.length ?? 0) > 0
  // Phase 067.1 Plan 02: extend activeTool to include "preparing" so outerBannerLabel
  // can render the ~2s sandbox-warmup copy ("Preparing code…") before tool_start fires.
  // Mirror of ToolCallPanel.tsx:540 active-tool detection (PATTERNS.md).
  const activeTool = message.tool_calls?.find(
    (tc) => tc.status === "running" || tc.status === "preparing"
  ) ?? null

  // Label shown when the agent is actively running a tool alongside existing content
  const activeToolLabel = activeTool
    ? (() => {
        const summary = toolSummary(activeTool.name, activeTool.args)
        return summary
          ? `${toolLabel(activeTool.name)} — "${summary}"`
          : `${toolLabel(activeTool.name)}…`
      })()
    : null

  // Phase 075.1 Plan 03 Task 2 — BUG-260514-03 + B-260519-07 indicator portion.
  // Phase 075 D-075-14 (a) introduced a sticky bottom-indicator cache that
  // retained the last non-null `outerBannerLabel(...)` value across silent
  // windows inside long tool calls so the bottom indicator wouldn't go blank
  // (notably during silent matplotlib render windows where no fresh
  // state-change event arrives — the prior 169-second chart cell repro).
  //
  // Phase 075 used the provider-level `isStreaming` prop as the cache reset
  // trigger. That breaks under PARALLEL runs on the same surface: when ANY
  // run completes, isStreaming flips false and the sticky cache resets for
  // THIS message — even when this message's own runStatus is still
  // "streaming" (B-260519-07 / Plan 075-INDICATOR-DEBUG diagnosis).
  //
  // Plan 03 swaps the gating signal to per-message `runStatus`. The literal
  // codebase enum values (frontend/src/types/index.ts:113) are:
  //   "streaming" | "completed" | "failed" | "cancelled" | "timed_out"
  //
  // Reset trigger (post-Plan-03):
  //   - runStatus === "streaming"  → retain (regardless of isStreaming)
  //   - runStatus terminal (completed/failed/cancelled/timed_out) → reset
  //   - runStatus === undefined    → treat as terminal (legacy DB-loaded row;
  //     matches the Phase 075 isStreaming==false behavior for those rows)
  //
  // Part (b) of D-075-14 — re-anchor on code_stdout — is covered implicitly:
  // each new code_stdout SSE event mutates the active tool_call's outputLines
  // (StreamsProvider.tsx onCodeStdout handler), which re-renders MessageItem;
  // the recompute below picks up activeTool and refreshes the sticky text.
  // No explicit subscription needed in this component — the tool-call
  // mutation IS the subscription.
  //
  // Note on the JSX gating downstream (lines 181, 188, 214, 221): the dots
  // animation + spinner remain gated on the provider-level `isStreaming` —
  // it's correct to hide the spinner when no run is active anywhere on the
  // surface, even if the sticky label is still rendered. During a silent
  // window for THIS message after another concurrent run completed, the
  // label keeps showing without the spinner — the correct UX per
  // B-260519-07 indicator-portion scope.
  const stickyLabelRef = useRef<string | null>(null)
  const isMessageStreaming = message.runStatus === "streaming"
  const computedLabel = isMessageStreaming
    ? outerBannerLabel(activeTool, hasAnyTools, message.isPlanning ?? false)
    : null
  if (isMessageStreaming && computedLabel !== null) {
    stickyLabelRef.current = computedLabel
  } else if (!isMessageStreaming) {
    stickyLabelRef.current = null
  }
  const stickyBottomLabel: string | null = isMessageStreaming
    ? (computedLabel ?? stickyLabelRef.current)
    : message.runStatus === "timed_out"
      ? "Agent reached time limit"
      : message.runStatus === "cancelled" || message.stopped
        ? "Response stopped"
        : null

  return (
    <div
      className="group flex gap-3 py-3 animate-fadeSlideUp"
      data-testid="assistant-message"
      data-streaming={isStreaming ? "true" : "false"}
    >
      {/* Phase 068.5 (D-068.5-05..07 + L-068.5-04 + RESEARCH §Finding #8):
          Pulse fires ONLY on runStatus === 'streaming' — the literal value
          from the 5-value codebase enum (NOT 'running' or 'queued' which do
          not exist). Resume button gate at lines 109-120 uses 'failed' ||
          'timed_out'; mutual exclusivity is structural (enum is one value
          at a time). Pattern S1 enum-conditional render. */}
      <div
        data-testid="assistant-bot-icon"
        className={`flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center mt-0.5 shadow-sm shadow-primary/20${message.runStatus === "streaming" ? " animate-brandPulse" : ""}`}
      >
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {/* 075.6 Plan 03 / Req #8 — pinned ✦ Working badge at top of active
            assistant turn. Folds BUG-260514-03 per D-075.6-D1.
            2026-05-24 UX refinement: hide the badge whenever the ToolCallPanel
            is rendering, because that panel's header already shows live
            activity ("Step N — Running code…" + spinner + shimmer bar) and
            the duplicated indicator made the page look noisy. The badge now
            only surfaces during the planning gap — isPlanning is true but no
            tool_calls have started yet — which IS the long-silence window
            the original BUG-260514-03 re_open_trigger cared about. The
            stable outer wrapper still preserves the DOM node across
            visibility transitions (Pitfall 5 mitigation in tandem with
            React.memo). */}
        <WorkingBadge
          visible={
            !!message.isPlanning &&
            (message.tool_calls?.length ?? 0) === 0 &&
            !allToolsDone
          }
        />
        {message.tool_calls && message.tool_calls.length > 0 && (
          <RunCard message={message} isStreaming={isStreaming} />
        )}
        {/* Phase 087-05 (D-05 / chat-panel-seam.md D2) — ADDITIVE live seam.
            While THIS run is streaming, panel-owned tools render as quiet
            one-line pointers (the panel is the canonical live view; duplicating
            the rich state here would be noise + drift). A still-awaiting
            ask_user additionally surfaces the paused cue (pending-question.md
            D2). Rendered as NEW siblings next to RunCard — no RunCard internals
            touched. When not live, nothing extra renders here. */}
        {isMessageStreaming && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {message.tool_calls
              .filter((tc) => seamKindFor(tc.name) !== null && tc.name !== "ask_user")
              .map((tc, i) => (
                <SeamPointer
                  key={tc.clientKey ?? tc.id ?? `seam-live-${i}`}
                  kind={seamKindFor(tc.name) as SeamKind}
                  label={tc.args.path ?? tc.args.file_path}
                  onSeePanel={requestOpenPanel}
                />
              ))}
            {hasPendingAsk(message.tool_calls) && <PausedRunCue />}
          </div>
        )}
        {message.activatedSkill && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-primary animate-fadeSlideUp">
            <Zap className="h-3 w-3" />
            <span>Skill activated: {message.activatedSkill}</span>
          </div>
        )}
        {message.content ? (
          <div className="text-sm text-foreground">
            <MarkdownRenderer content={message.role === "assistant" ? dedupParagraphs(message.content) : message.content} />
            {isStreaming && !hasRunningTools && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
            )}
            {message.confidence && <ConfidenceBadge confidence={message.confidence} />}
            {message.citations && message.citations.length > 0 && (
              <CitationList citations={message.citations} />
            )}
            {!isStreaming && message.suggestions && message.suggestions.length > 0 && onSendMessage && (
              <SuggestionPills
                questions={message.suggestions}
                onSelect={onSendMessage}
              />
            )}
            {!isStreaming && message.role === "assistant" && message.content && (
              <MessageFeedback messageId={message.id} />
            )}
            {/* Phase 063 (Pattern 4 / D-063-04) + Phase 066 D-066-09: Resume
                button on failed OR timed_out runs. Surfaces when runStatus
                ∈ {failed, timed_out} — never on cancelled (user explicitly
                stopped), completed, streaming, or undefined (DB-loaded
                historical messages without run metadata). Same onResume
                callback re-POSTs the original prompt with full conversation
                context (today's failed-state Resume code path).

                Phase 095.1 Plan 05 (D-095.1-07): deliverable-aware. A run that
                already produced its deliverables (execute_code output files,
                persisted + reload-reconstructed onto finalOutputFiles) before a
                later iteration failed/timed_out does NOT falsely offer Resume —
                the work the user wanted is already on disk. Closes
                BUG-260518-01 (the genuine-terminal case 075 didn't cover).
                "Deliverables" = execute_code output files specifically; we do
                NOT count workspace_write files here (out of scope). */}
            {!isStreaming && message.role === "assistant" && (message.runStatus === "failed" || message.runStatus === "timed_out") && !producedDeliverables && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResume?.(message)}
                className="mt-2 text-xs"
                aria-label="Resume run"
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Resume
              </Button>
            )}

            {/* Phase 092 (CONT-01 / D-07): inline Continue card — ADDITIVE
                SIBLING of the Resume button. Gated on cap_paused delivered
                OUT-OF-BAND via the thread lock (NOT message.runStatus — the
                role='system' carrier row is filtered from /messages,
                BUG-260528-01). Renders once, on the last assistant message
                where the run paused. Amber = paused/needs-you (design skill).
                When 0 continues remain, show the stop message instead of a
                clickable button (the 3-cap, D-06). */}
            {message.role === "assistant" &&
              isLastAssistant &&
              workflowLock?.capPaused && (
                <div className="mt-2 flex flex-col gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2">
                  <span className="text-xs text-amber-400">
                    {continueExhausted || workflowLock.continuesRemaining <= 0
                      ? "Reached the Continue limit — this run is stopped. Start a new message to keep going."
                      : "Reached the iteration limit — some tools haven't run yet."}
                  </span>
                  {!continueExhausted && workflowLock.continuesRemaining > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={continuePending}
                      onClick={async () => {
                        if (!workflowLock.runId) return
                        setContinuePending(true)
                        try {
                          const res = await continueRun(workflowLock.runId)
                          if (res.status === "refused") {
                            // D-06: the 3-cap was hit — show the stop message, no throw.
                            setContinueExhausted(true)
                          } else if (res.producer_run_id && message.thread_id) {
                            // Facet C (092-07): the Harness re-drive minted a FRESH
                            // producer runs row (the original stream EXPIREd) — the
                            // /continue 200 body carries its id. Re-subscribe its
                            // live stream (per-thread keyed, idempotent) so the panel
                            // shows the resumed run's events with no page action.
                            requestProducerResubscribe({
                              threadId: message.thread_id,
                              producerRunId: res.producer_run_id,
                            })
                          }
                        } catch (err) {
                          console.error("continueRun failed:", err)
                        } finally {
                          setContinuePending(false)
                        }
                      }}
                      className="self-start text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                      aria-label="Continue run"
                      data-testid="continue-run"
                    >
                      {continuePending ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 mr-1.5" />
                      )}
                      Continue ({workflowLock.continuesRemaining} left)
                    </Button>
                  )}
                </div>
              )}
          </div>
        ) : isStreaming && !hasAnyTools ? (
          // No tools yet — first LLM call is thinking
          <span className="flex items-center gap-2 text-muted-foreground text-sm animate-fadeSlideUp">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false)}</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
            </span>
          </span>
        ) : hasAnyTools ? (
          // Tools ran but no text yet — show whether we're still working or waiting
          // Shown regardless of isStreaming so SSE drops don't cause a blank
          <span className="flex items-center gap-2 text-muted-foreground text-sm mt-1.5 animate-fadeSlideUp">
            {isStreaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
            {/* Phase 075 D-075-14 / BUG-260514-03: stickyBottomLabel retains the
                last non-null label across silent windows inside long tool calls
                (matplotlib renders, sandbox time.sleep, etc.) so the bottom
                indicator no longer goes blank. Computed above the JSX —
                see stickyLabelRef comment block. */}
            <span className="italic">{stickyBottomLabel}</span>
            {isStreaming && (
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
              </span>
            )}
          </span>
        ) : null}
        {/* Phase 066 D-066-10: stopped/timed-out indicator — shown after content
            when the run ended without completing. Banner copy mirrors the
            in-content banner switch (lines 130-145): runStatus === 'timed_out'
            renders "Agent reached time limit"; otherwise (cancelled or legacy
            stopped rows pre-D-063.1-15) renders "Response stopped". Without
            this dual update, a timed_out run with content would show
            contradictory copy (in-content banner suppressed because content
            present; bottom indicator says "Response stopped"). */}
        {(message.stopped || message.runStatus === "timed_out") && !isStreaming && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <Square className="w-3 h-3" />
            <span className="italic">
              {message.runStatus === "timed_out" ? "Agent reached time limit" : "Response stopped"}
            </span>
          </div>
        )}
        {/* Active tool indicator — shown below content when a tool is running alongside text */}
        {isStreaming && hasRunningTools && message.content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground animate-fadeSlideUp">
            <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
            <span className="italic truncate">{activeToolLabel ?? "Working…"}</span>
          </div>
        )}
        {/* Between-round planning indicator */}
        {isStreaming && message.isPlanning && !hasRunningTools && message.content && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground animate-fadeSlideUp">
            <Loader2 className="w-3 h-3 animate-spin text-primary flex-shrink-0" />
            <span className="italic">Thinking…</span>
          </div>
        )}
        {/* Phase 075.1 Plan 04 Atom E (B-260519-11 + BUG-260514-01) — pinned
            final-outputs panel. Backend emits one `final_output_files` SSE
            event after the agent loop terminates carrying the cumulative
            sandbox filenames; StreamsProvider stamps it on the assistant
            message; MessageItem renders the panel below per-cell delta panels
            inside ToolCallPanel / tool-bodies/ExecuteCodeBody (Phase 075.7
            rename). Closes the 12-download-
            links-for-1-desired-file cumulative-repeat symptom. */}
        {/* Phase 095.1 Plan 05 (D-095.1-06) — FLAT "Generated files" list.
            FinalOutputsPanel renders every file as ONE equal OutputFileCard row
            (no hero crown, no hero/working split, no collapse group) — reverses
            the 095-05/08 visual per the operator-approved CONTEXT.md decision.
            ALL files are present + downloadable; the backend `is_hero` flag is
            IGNORED by the frontend (written-but-unread, no backend change). The
            empty-state guard (`finalOutputFiles.length > 0`) and the
            `data-testid="final-outputs-panel"`
            are preserved (D-075.2-07 + the existing test). */}
        {message.finalOutputFiles && message.finalOutputFiles.length > 0 && (
          <FinalOutputsPanel files={message.finalOutputFiles} />
        )}
        {/* Phase 087-05 (D-05 / chat-panel-seam.md D3) — ADDITIVE reload seam.
            On a rehydrated/terminal message the panel won't replay history, so
            panel-owned tools resolve to self-contained cards here: the answered
            ask_user Q&A (closes the documented reload gap), a workspace_write
            file chip, a write_todos final-state note. Rendered as a NEW sibling
            near the final-outputs panel — no existing markup changed. Gate:
            message NOT streaming (mode = rehydrated history vs live run). */}
        {!isMessageStreaming &&
          message.tool_calls &&
          message.tool_calls.some((tc) => seamKindFor(tc.name) !== null) && (
            <div className="mt-2 flex flex-col gap-2">
              {message.tool_calls
                .filter((tc) => seamKindFor(tc.name) !== null)
                .map((tc, i) => (
                  <SeamCard
                    key={tc.clientKey ?? tc.id ?? `seam-reload-${i}`}
                    kind={seamKindFor(tc.name) as SeamKind}
                    payload={seamCardPayloadFor(tc)}
                    onOpenPanel={requestOpenPanel}
                  />
                ))}
            </div>
          )}
      </div>
    </div>
  )
})
