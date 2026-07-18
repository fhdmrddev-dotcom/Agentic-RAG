import { memo, useLayoutEffect, useRef, useState } from "react"
import { Sparkles, Loader2, RotateCcw, Square, User, Play } from "lucide-react"
import type { Message } from "@/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
// Phase 153-05 (CITE-01 / G-5 additive): the cited-answer render path. Swapped in
// ONLY on the settled cited-assistant branch (message.citations?.length); every
// other path stays byte-identical on the shared MarkdownRenderer (D-12/D-14).
import { CitedMarkdown } from "./CitedMarkdown"
// Phase 153-05 (CITE-01 / 074-A): the quiet absence-as-signal ⓘ. Mounted once
// under the answer body on the settled cited-assistant branch (self-guards on
// citations, never a banner) — never on the streaming/user path (G-5 additive).
import { AbsenceHint } from "./AbsenceHint"
import { StreamingNarration } from "./StreamingNarration"
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
import { type SeamKind } from "@/components/panel/SeamPointer"
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
 * Phase 128 Plan 02 — CTC-04 user-prompt clamp (sketch 050-A / D-03).
 *
 * A long USER prompt (a pasted ≥5KB spec) renders at full height today and
 * shoves the live run off-screen. This collapses it to a `-webkit-line-clamp:7`
 * preview with a fade matched to the violet END of the bubble's 135°
 * `gradient-primary` (`index.css:199` → `hsl(258 90% 66%)`, NOT the page bg) and
 * an inline "Read more" / "Show less" chip. SHORT prompts render byte-identically
 * to today — the clamp classes are gated on `!expanded`, and the fade + chip on
 * `overflowing`, which only trips when the clamped <p> actually overflows.
 *
 * Factored as a LOCAL subcomponent (mirrors FinalOutputsPanel) so its
 * useRef/useLayoutEffect/useState do NOT perturb MessageItem's hook order
 * (MessageItem has hooks before the `if (isUser)` early return).
 *
 * `content` renders as React text children (auto-escaped) — never
 * dangerouslySetInnerHTML (T-128-02-01 / V5 output-encoding). The overflow
 * measure is a pure ref-guarded DOM read (scrollHeight/clientHeight) that cannot
 * throw on user content (T-128-02-02); jsdom reports 0/0 (no layout) so the
 * effect no-ops in tests, which assert structure + the fade class instead.
 */
function UserBubble({ content }: { content: string }) {
  const pRef = useRef<HTMLParagraphElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // useLayoutEffect (NOT useEffect) so the measure runs pre-paint — avoids the
  // one-frame full-height flash before the clamp applies (RESEARCH Pitfall 5).
  useLayoutEffect(() => {
    const el = pRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [content])

  return (
    <div className="relative">
      <p
        ref={pRef}
        className={cn(
          "whitespace-pre-wrap break-words",
          !expanded && "[display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden",
        )}
      >
        {content}
      </p>
      {/* Fade dissolves into the bubble violet (the 135° gradient's END,
          index.css:199), NOT the page bg — D-03. Only while clamped + overflowing. */}
      {overflowing && !expanded && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[hsl(258_90%_66%)] to-transparent"
        />
      )}
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-white/80 underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
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
    // Only flatten-dedup single-line run-on repeats (models that concatenate
    // the same sentence without a break). A block with real line breaks — e.g.
    // the agent's interim narration — is preserved verbatim so markdown keeps
    // its newlines (breaks:true renders them); Pass 1 already handled
    // paragraph-level repeats. Without this guard the sentence rejoin below
    // collapsed every intra-paragraph newline into a single space (the
    // reported run-on-blob narration).
    if (block.includes('\n')) return block
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

/**
 * Phase 153-05 (CITE-01 / D-06/D-07): does the settled content carry ≥1 valid
 * in-range inline marker? Drives the canonical `defaultOpen` on the References
 * footer — the footer opens by default only when markers exist, else it keeps
 * today's collapsed default (footer-only degradation). The backend already
 * strips non-members/out-of-range markers before persist (D-02), so any `[n]`
 * with n ∈ [1, count] in the persisted content is a real, keyed marker.
 */
function hasInRangeMarker(content: string, count: number): boolean {
  if (!count || !content) return false
  const re = /\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const n = parseInt(m[1], 10)
    if (n >= 1 && n <= count) return true
  }
  return false
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
  // Phase 153-05 (CITE-01): a callback-ref to the settled answer body so the
  // References footer's row→marker flash (flashCitationMarker) is scoped to THIS
  // message's marker host (the body contains both the cited markdown and the
  // footer). A callback ref that stores the node in state makes it reactive
  // without prop-drilling; adding it changes no DOM (byte-identical, G-5).
  const [messageBody, setMessageBody] = useState<HTMLDivElement | null>(null)

  if (isUser) {
    return (
      <div className="flex justify-end py-2 animate-fadeSlideUp" data-testid="user-message">
        <div className="flex items-end gap-2.5 max-w-[70%]">
          <div className="gradient-primary text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed shadow-sm">
            <UserBubble content={message.content} />
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
  // SEED-098 Change 2: the bottom italic `Preparing code…/Analyzing document…`
  // echo (stickyLabelRef / computedLabel / stickyBottomLabel) is GONE — the
  // RunCard header strip already carries the live verb + timer, so the loose
  // duplicate below the run card was pure noise. Terminal-state copy
  // (timed_out / stopped) still renders from the Square block below; the
  // no-tools-yet thinking indicator renders from its own branch (both untouched).
  const isMessageStreaming = message.runStatus === "streaming"

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
        {/* SEED-098 Change 2: the loose write_todos/workspace_write `→ see panel`
            pointers are GONE — todos live only in the right Workspace panel.
            The ask_user PausedRunCue is load-bearing (not duplicated) and stays. */}
        {isMessageStreaming && message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {hasPendingAsk(message.tool_calls) && <PausedRunCue />}
          </div>
        )}
        {/* SEED-098 Change 2/3: the loose `Skill activated: docx` line is GONE —
            the in-card `Loading skill` SkillRow (ToolCallPanel, from the
            activated-skills array) already covers it. The legacy single-skill
            field is no longer READ in this render path; it stays intact in
            types + StreamsProvider for DB-loaded-message compat. */}
        {/* Phase 149 Plan 09 (D-149-10) — honest disabled-model fallback notice. When the
            user's selected model was operator-DISABLED, the backend runs the org default and
            emits `model_disabled_fallback`; StreamsProvider stamps it here. Rendered as a
            small inline informational notice showing the backend `message` string (which
            already names BOTH the disabled model and the fallback) — never a silent swap.
            A SIBLING of the content block (renders regardless of content) so it shows even
            before any delta streams. Absent → nothing extra (enabled path byte-identical). */}
        {message.role === "assistant" && message.modelFallbackNotice && (
          <div
            data-testid="model-fallback-notice"
            className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-400/90"
          >
            {message.modelFallbackNotice.message}
          </div>
        )}
        {message.content ? (
          <div ref={setMessageBody} className="text-sm text-foreground">
            {isMessageStreaming && (message.tool_calls?.length ?? 0) > 0 && message.role === "assistant" ? (
              // Live agentic run: message.content here is the model's interim
              // narration ("Now I'll search…"), not the final answer. Fold it to
              // a one-line gist (click to expand the full trail). At run-end the
              // backend-persisted final answer renders normally via the else path.
              // NEVER given markers — the body streams calm & unmarked (D-05).
              <StreamingNarration content={dedupParagraphs(message.content)} />
            ) : message.role === "assistant" && message.citations && message.citations.length > 0 ? (
              // Phase 153-05 (CITE-01 / G-5 additive): the settled cited-assistant
              // answer routes to CitedMarkdown, which upgrades validated [n] to
              // interactive markers over the SAME dedupParagraphs output. This is
              // the ONLY new branch; the else path stays byte-identical (D-12/D-14).
              <CitedMarkdown content={dedupParagraphs(message.content)} citations={message.citations} />
            ) : (
              <MarkdownRenderer content={message.role === "assistant" ? dedupParagraphs(message.content) : message.content} />
            )}
            {isStreaming && !hasRunningTools && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary/50 animate-pulse rounded-sm align-text-bottom" />
            )}
            {message.confidence && <ConfidenceBadge confidence={message.confidence} />}
            {/* Phase 153-05 (CITE-01 / 074-A): the absence-as-signal ⓘ — mounted
                ONCE under the answer body, between the answer and the footer, on
                the settled cited-assistant path only. Self-guards on citations
                (null otherwise) and is never given the streaming-narration path. */}
            {message.role === "assistant" &&
              !(isMessageStreaming && (message.tool_calls?.length ?? 0) > 0) && (
                <AbsenceHint citations={message.citations} />
              )}
            {message.citations && message.citations.length > 0 && (
              <CitationList
                citations={message.citations}
                // Phase 153-05 (CITE-01 / D-06/D-07): open by default only when the
                // settled answer actually carries valid in-range markers; else keep
                // today's collapsed default (footer-only degradation).
                defaultOpen={hasInRangeMarker(dedupParagraphs(message.content), message.citations.length)}
                // Scope the row→marker flash to this message's marker host.
                flashContainer={messageBody}
              />
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
            <span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false, workflowLock != null)}</span>
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "160ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-dotBounce" style={{ animationDelay: "320ms" }} />
            </span>
          </span>
        ) : message.runStatus === "cancelled" ? (
          // BUG-260710-02 (Phase 147 / D-03): cancelling BEFORE the first visible
          // token persists a genuinely empty assistant row (content_len=0 — e.g. a
          // DeepSeek early cancel whose only output was stripped DSML markup). The
          // renderer previously drew an avatar-only empty bubble that reads as
          // "something broke". Render an honest "cancelled — no output yet"
          // affordance instead (mirrors the stopped-indicator styling: Square icon
          // + muted italic). Reached only in the falsy-content branch, so a
          // cancelled run WITH content renders its content normally + the
          // persistent "Response stopped" indicator below. Pure render-derive from
          // the persisted runStatus — no shared-path fork (D-03/G-5 safe).
          <div
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            data-testid="cancelled-no-output"
          >
            <Square className="w-3 h-3" />
            <span className="italic">cancelled — no output yet</span>
          </div>
        ) : null}
        {/* SEED-098 Change 2: the `hasAnyTools` bottom italic echo
            (`Preparing code…/Synthesizing answer…` + dots) is GONE — the RunCard
            header strip (RunStatusStrip) already carries the live verb + timer,
            so this was a duplicate. Terminal-state copy renders from the Square
            block below; the no-tools thinking indicator stays in its own arm. */}
        {/* Phase 066 D-066-10: stopped/timed-out indicator — shown after content
            when the run ended without completing. Banner copy mirrors the
            in-content banner switch (lines 130-145): runStatus === 'timed_out'
            renders "Agent reached time limit"; otherwise (cancelled or legacy
            stopped rows pre-D-063.1-15) renders "Response stopped". Without
            this dual update, a timed_out run with content would show
            contradictory copy (in-content banner suppressed because content
            present; bottom indicator says "Response stopped"). */}
        {/* BUG-260710-01 (Phase 147 / D-03): `message.stopped` is LIVE-only state and
            is NOT re-derived on reload, so a persisted cancelled run lost its
            "Response stopped" indicator after navigating away and back (the
            partial answer then read as a normal completed answer). Add the
            `runStatus === 'cancelled'` clause so the indicator persists across
            reload — the copy switch above already renders "Response stopped" for
            the non-timed-out case (types/index.ts:163 already SAYS cancelled
            renders "Response stopped"; the render condition was the bug). Gated on
            `!!message.content` so an EMPTY early-cancel row is handled instead by
            the "cancelled — no output yet" affordance in the content region (no
            double indicator). Render-derive only — no shared-path fork (D-03/G-5). */}
        {(message.stopped ||
          message.runStatus === "timed_out" ||
          (message.runStatus === "cancelled" && !!message.content)) &&
          !isStreaming && (
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
