import { memo, useState } from "react"
import { Sparkles, Loader2, RotateCcw, User, Play, Ban } from "lucide-react"
import type { Message } from "@/types"
import { Button } from "@/components/ui/button"
// Phase 092 (CONT-01 / D-07): the inline Continue card reads the per-thread
// workflow lock (carries capPaused + continuesRemaining) keyed by the OWNING
// thread id — delivered OUT-OF-BAND (the role='system' carrier row is filtered
// from /messages, BUG-260528-01) via the cap_paused SSE + the mount reconcile.
// Phase 194 Plan 07 (RUN-01 / BUG-260815-04 / D-18): `usePhases` is the shipped
// selector over the harness demux's `phasesByThread` slice. It is called from
// `HarnessOuterBanner` below — NOT from `MessageItem` itself — and the reason is
// measured rather than stylistic; see that component's docblock.
import { useWorkflowLockForThread, usePhases } from "@/providers/StreamsProvider"
// Phase 092-07 (Facet C): after a Harness Continue the backend mints a FRESH
// producer runs row + returns its id; re-subscribe its live stream (per-thread
// keyed, additive — mirrors panelOpenSignal).
import { requestProducerResubscribe } from "@/providers/producerResubscribeSignal"
import { RunCard, RunTerminalStatus } from "./RunCard"
import { ThinkingBlock } from "./ThinkingBlock"
import { UserBubble } from "./UserMessageBubble"
// BUG-260904-01: the inline Continue card below calls `continueRun`, and this import had gone
// missing — the click threw `ReferenceError`, the surrounding catch logged it, and the button
// re-enabled, so the one affordance that lets a capped run keep going did nothing and said
// nothing. `tsc` reported it as TS2304 the whole time, inside the accepted-error baseline.
import { continueRun } from "@/lib/api"
import { dedupParagraphs } from "./messageText"
import { WorkingBadge } from "./WorkingBadge"
import { MarkdownRenderer } from "./MarkdownRenderer"
import { ChatToolApprovalCard } from "./ChatToolApprovalCard"
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
import { toolLabel, toolSummary, outerBannerLabel, harnessBannerProgress } from "@/lib/toolMeta"
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
 * Phase 087-05 / Phase 224 (Winner D): ask_user renders via the seam as an
 * answered Q&A card in reloaded history. write_todos and workspace_write arms
 * were pruned (the right-hand Workspace panel is the canonical view).
 */
function seamKindFor(name: string): SeamKind | null {
  if (name === "ask_user") {
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
 * Build the reload-mode SeamCard payload from a resolved ask_user ToolCall (D3).
 * Renders question + resolved answer.
 */
function seamCardPayloadFor(tc: ToolCall): SeamCardPayload {
  if (tc.name === "ask_user") {
    return { question: tc.args.prompt, answer: tc.result ?? undefined }
  }
  return {}
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
 * Phase 194 Plan 07 (RUN-01 / BUG-260815-04 / D-18) — THE ADVANCING HARNESS BANNER.
 *
 * ── What was broken, and it was a MECHANISM, never copy ──────────────────────
 * `hasAnyTools` (below, `:329`) is `(message.tool_calls?.length ?? 0) > 0`, and a
 * HARNESS run writes NO `tool_calls` — its progress lives in `workflow_phases`
 * rows and in `phase_started` / `phase_completed` SSE. So the pre-tools branch
 * held from kickoff to terminal and the banner was structurally incapable of
 * advancing: one sentence for the whole run. The pinned string is not the bug and
 * is not edited (D-13); this component is the advance.
 *
 * ── THE PANEL-09 CROSSING, RECORDED BESIDE ITS ORIGINAL REASONING, NOT OVER IT ─
 *
 * 1. PANEL-09's original reasoning, QUOTED verbatim from its source
 *    (`StreamsProvider.tsx:971-978`), not paraphrased:
 *
 *      "Phase 094 Plan 02 (PANEL-08 / PANEL-09) — harness phase-lifecycle demux.
 *       ... They write phasesByThread ONLY — never bucketsBySurface
 *       (PANEL-09: the chat selector useThreadMessages reads bucketsBySurface
 *       exclusively → zero chat re-renders). ..."
 *
 *    That was a considered performance decision and it still stands.
 *
 * 2. WHAT IS AND IS NOT BEING CHANGED. PANEL-09 is a rule about what the demux
 *    WRITES. This adds a READ and changes NOT ONE LINE of the demux
 *    (`StreamsProvider.tsx:963-1100` is untouched by this plan — `git diff
 *    --numstat` on that file is empty). `bucketsBySurface` is untouched. This is
 *    exactly what `useWorkflowLockForThread` has done in this same component
 *    since Phase 092: `workflowLockByThread` is written by the SAME harness demux.
 *    A chat component has consumed a harness-demux slice for a hundred phases.
 *
 * 3. THE ACCEPTED COST, WITH THE MEASURED NUMBERS (D-18 requires measurements,
 *    not an assurance — `194-07-SUMMARY.md` § "The two measured re-render counts"
 *    carries the raw output):
 *      - Across a 6-token simulated stream the commit count is IDENTICAL with the
 *        subscription live (harness) and without it (Deep): **7 and 7**. The
 *        re-render is NOT per token.
 *      - Across a 3-transition simulated phase sequence with the message object
 *        held fixed: **3** commits — one per transition, which is the cost D-18
 *        accepted. A workflow run has a handful of phases.
 *    ⇒ the cost PANEL-09 was protecting against (token-rate re-renders) is not
 *    the cost being incurred.
 *
 * ── WHY THIS IS A CHILD COMPONENT AND NOT A HOOK CALL IN `MessageItem` ────────
 * ⚠ MEASURED, and it corrects the plan's own instruction to read `usePhases`
 * beside the `useWorkflowLockForThread` call at `:303`. The two hooks are NOT
 * equivalent in cost: `useWorkflowLockForThread` is a bare store selector, while
 * `usePhases` also mounts `usePanelReconcile`, which fires a `getThreadWorkflow`
 * FETCH per mount. `MessageList` renders one `MessageItem` per message with no
 * virtualisation (`MessageList.tsx:175-188`), so a hook at `MessageItem`'s top
 * level would fire ONE FETCH PER ASSISTANT ROW on every thread open — measured at
 * 6 rows: **6 calls**, versus **1** with this component. That is T-194-07-03's
 * denial-of-service disposition, and it is closed by construction here.
 *
 * Mounting is doubly narrow, and both narrowings are load-bearing:
 *   - only inside the `isStreaming && !hasAnyTools` arm, and `MessageList.tsx:182`
 *     passes `isStreaming={isStreaming && isLastAssistant}` ⇒ at most ONE row;
 *   - only when `workflowLock != null` ⇒ a DEEP thread never mounts it, so the
 *     Deep path costs zero fetches and zero subscriptions and stays byte-identical.
 *
 * The rendered `<span className="italic">` is the shipped one, unchanged.
 */
function HarnessOuterBanner({ message }: { message: Message }) {
  const { data: phases } = usePhases(message.thread_id ?? null)
  return (
    <span className="italic">
      {outerBannerLabel(
        null,
        false,
        message.isPlanning ?? false,
        true,
        !message.content && !!message.reasoningContent,
        harnessBannerProgress(phases),
      )}
    </span>
  )
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
  // (timed_out / stopped) still renders from the terminal block below; the
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
        {/* Phase 243 Plan 02 (CHAT-01 / CHAT-04 / D-243-01 — sketch 235 winner B) — THE ONE
            REASONING RENDERER, mounted for BOTH message shapes.
            ⛔ UNCONDITIONAL BY CONSTRUCTION, AND THAT IS THE WHOLE FIX. It used to live
            inside `RunCard`, which mounts only on a turn that called a tool — so the 31% of
            reasoning-bearing turns that call none had their reasoning drawn NOWHERE
            (measured: 105 of 340 rows, D-243-03). The block self-guards on its own content,
            so this site tests nothing. ⛔ Do not add a tool condition here; that would
            restore the defect in a form that reads as tidiness. Fenced on source by
            `ThinkingBlock.characterization.test.tsx` §12.
            ⛔ NO `key` EITHER, and it is a DECISION rather than an omission (243-PATTERNS
            §F.8): `key={message.id}` would close an open fold on every temp-id → DB-id
            reconcile. Fenced by §12 on source and by §13 on behaviour.
            ⚠ ORDER IS THE ORDER IN TIME — above the run card's tool rows and above the
            answer. A sibling of WorkingBadge and RunCard, in the style those two use. */}
        <ThinkingBlock
          reasoningContent={message.reasoningContent}
          isStreaming={isMessageStreaming}
        />
        {message.tool_calls && message.tool_calls.length > 0 && (
          <RunCard message={message} isStreaming={isStreaming} />
        )}
        {/* Phase 216 / Phase 224: inline tool approval decision card (settled transcript receipt or when not streaming) */}
        {message.toolApproval && (message.toolApproval.decision || !isStreaming) && (
          <ChatToolApprovalCard
            threadId={message.thread_id}
            approval={message.toolApproval}
          />
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
        {/* Phase 174 Plan 03 (STATE-01b / D-04 / D-06 / sketch 129-C amber tier) — the
            honest administrative-block bubble. When a workflow launch is refused by the
            workflows kill-switch (an ApiError.status===403 raised BEFORE any run/message is
            inserted), StreamsProvider's catch stamps `blockedNotice` onto this empty
            assistant placeholder. Reuses the `model-fallback-notice` amber primitive verbatim
            (border-amber-400/30 bg-amber-400/10 text-amber-400/90 — no bespoke CSS, D-06) +
            adds a Ban glyph so the tier is never color-alone (A10 / WCAG 1.4.1). The server
            string renders as React TEXT children ONLY — never dangerouslySetInnerHTML
            (A23/T-174-03-01 XSS-safe). A SIBLING of the content block (shows with empty
            content). Absent → nothing extra (the non-blocked path is byte-identical). */}
        {message.role === "assistant" && message.blockedNotice && (
          <div
            data-testid="blocked-notice"
            className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-400/90"
          >
            <Ban className="w-3.5 h-3.5 flex-shrink-0" aria-label="Blocked" />
            <span>{message.blockedNotice.message}</span>
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
                /* Phase 224-05 (BUG-260902-07, first half) — FOLDED, EVERY TIME.
                   ⚠ This REVERSES Phase 153's D-06/D-07 open-by-default contract, and the
                   reversal is deliberate rather than an oversight — see CitationList's own
                   docblock, where the superseded rule is kept struck through so a later
                   phase does not "restore" it. Measured 2026-09-02: the old expression
                   asked whether the answer had an in-range marker, and a grounded answer
                   normally DOES, so the footer was open on essentially every real answer
                   and the collapsed state only ever appeared on the degraded path. The
                   operator: "the sources should be by default folded ... this is very bad
                   user experience." ⚠ `hasInRangeMarker` is NOT deleted — it still gates
                   the AbsenceHint below, which is a different question. */
                defaultOpen={false}
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
                aria-label="Retry turn"
                data-testid="retry-turn-button"
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Retry turn
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
            {/* Phase 174 / STATE-03: count already-stamped cross-provider reasoning
                as activity so the pre-first-token window reads "Reasoning…" instead
                of the dead "Setting up agent…". Scoped to the reasoning-before-any-
                token window (no content yet). Anthropic/Google never emit reasoning,
                so they keep the calm fallback (by design). No new backend state (D-08). */}
            {/* Phase 194 Plan 07 (BUG-260815-04 / D-18): the harness arm reads the
                phase slice so this sentence ADVANCES; the Deep arm is the shipped
                call with `false` substituted for `workflowLock != null` — provably
                the same value, since that is the only branch where the lock is null.
                Both arms render the identical shipped <span className="italic">. */}
            {workflowLock != null ? (
              <HarnessOuterBanner message={message} />
            ) : (
              <span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false, false, !message.content && !!message.reasoningContent)}</span>
            )}
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
          // affordance instead (mirrors the stopped-indicator styling: muted
          // italic — Phase 224 dropped the Square glyph from BOTH sites, SC#3:
          // a status sentence must not wear a control's costume, and this one sat
          // directly under SeamCard's `☑`). Reached only in the falsy-content branch, so a
          // cancelled run WITH content renders its content normally + the
          // persistent "Response stopped" indicator below. Pure render-derive from
          // the persisted runStatus — no shared-path fork (D-03/G-5 safe).
          <div
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            data-testid="cancelled-no-output"
          >
            <span className="italic">cancelled — no output yet</span>
          </div>
        ) : null}
        {/* SEED-098 Change 2: the `hasAnyTools` bottom italic echo
            (`Preparing code…/Synthesizing answer…` + dots) is GONE — the RunCard
            header strip (RunStatusStrip) already carries the live verb + timer,
            so this was a duplicate. Terminal-state copy renders from the terminal
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
        {/* Phase 227 SC#1 / SC#3: RunTerminalStatus delegated to RunCard */}
        <RunTerminalStatus message={message} isStreaming={isStreaming} />
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
