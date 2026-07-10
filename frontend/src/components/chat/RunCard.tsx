import { memo, useEffect, useRef, useState } from "react"
import { Bot, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { providerLogo } from "@/lib/providerLogo"
import type { Message, ToolCall } from "@/types"
import { ToolCallPanel } from "./ToolCallPanel"
import { RunStatusStrip } from "./RunStatusStrip"
import { outerBannerLabel } from "@/lib/toolMeta"
import { unifiedStepCount } from "@/lib/stepCount"
import { categorizeError } from "@/lib/errorCategories"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface RunCardProps {
  message: Message
  isStreaming?: boolean
}

/**
 * Phase 075.7 RunCard — wrapper for assistant turns with tool_calls.length > 0.
 *
 * Per CONTEXT D-09: MessageItem mounts <RunCard> for tool-bearing turns only.
 *   Pure-text replies render with NO RunCard, NO border.
 * Per CONTEXT D-10: whole-message prop; memoized via React.memo with default
 *   shallow-eq (mirrors MessageItem.tsx:30 — Phase 075.4-04 invariant).
 * Per CONTEXT D-11 (CORRECTED — see RESEARCH §3.2): sticky header uses
 *   `position: sticky; top: 0` against the Radix ScrollArea Viewport that
 *   MessageList.tsx:91 wraps the message list in. No new scroll container
 *   introduced.
 * Per CONTEXT D-12: RunCard owns the TOP sticky header; MessageItem keeps the
 *   BOTTOM stickyLabelRef indicator at MessageItem.tsx:105-120 verbatim.
 *   Two independent sticky surfaces at opposite ends of the message.
 * Per CONTEXT D-07 + SPEC out-of-scope #6: NO new keyframes — reuse
 *   animate-brandPulse, animate-fadeSlideUp, tool-progress-bar, animate-pulseGlow.
 * Per RESEARCH §6: message.content (final assistant answer) renders OUTSIDE
 *   RunCard in MessageItem so the deferred Anthropic terminal-frame bug
 *   (BUG-260514-02) remains re-litigable.
 *
 * Plan 03 (this version) adds (atop Plan 02's visual frame):
 *   - Lazy useState initializer that defaults to collapsed only when terminal
 *     AND has tools — historical DB-loaded turns mount already collapsed.
 *   - useEffect with wasStreamingRef one-shot guard so streaming→terminal
 *     transition auto-collapses live runs (R-6 + CONTEXT D-05/D-07).
 *   - Collapsed-row JSX `[bot icon] Run · N tool calls · ✓ status · duration ▸`
 *     shown when `!expanded && isTerminal && hasTools` (sketch live-run-container
 *     D5 + UI-SPEC §8.2). Click-to-expand restores the full body.
 *   - Header click is a NO-OP while `runStatus === "streaming"` (CONTEXT D-08).
 *   - aria-expanded + role="button" + tabIndex management for keyboard a11y.
 */
export const RunCard = memo(function RunCard({ message, isStreaming }: RunCardProps) {
  const hasTools = (message.tool_calls?.length ?? 0) > 0
  const isStreamingNow = message.runStatus === "streaming"
  // Terminal predicate per RESEARCH §5.4: any non-"streaming" runStatus —
  // including undefined for DB-loaded historical messages — is treated as
  // terminal. The lazy initializer below uses this to mount historical
  // tool-bearing turns already collapsed.
  const isTerminal = !isStreamingNow

  // Pure-derivation collapse model — see 075.7-DEBUG-runstatus-transition.md.
  // Replaces a wasStreamingRef one-shot useEffect that could silently miss the
  // streaming→terminal transition under React 18 batching or temp-id → DB-id
  // remounts. Rules:
  //   - streaming → always show body (D-08: user cannot fold a live run)
  //   - terminal + no tools → show body (no collapse target — R-6 exception)
  //   - terminal + tools → collapsed UNLESS user explicitly expanded via click
  // userExpanded is the user-toggle state; React re-evaluates the derivation
  // on every render. Reset on message.id change so DB-reload remounts get
  // the default-collapsed historical view.
  const [userExpanded, setUserExpanded] = useState(false)
  // Phase 076.2 D-01: collapsible Thinking block state — collapsed by default.
  const [thinkingOpen, setThinkingOpen] = useState(false)
  // Reset user-toggle when message identity changes (e.g., temp-id → DB-id
  // swap on first persistence reconcile). Pattern matches the pre-fix
  // RunCard's setExpanded(false) effect; setState-in-effect is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUserExpanded(false) }, [message.id])
  const expanded = isStreamingNow || !hasTools || userExpanded

  // Header click: CONTEXT D-08 mandates this be a NO-OP while streaming, so
  // the user cannot accidentally hide the live progress they're watching.
  // Once terminal, the header toggles expand/collapse like a normal button.
  const handleHeaderClick = () => {
    if (isStreamingNow) return  // D-08 no-op
    setUserExpanded(v => !v)
  }

  // ---- D-06 persistent timer (Phase 095 Plan 02 — the ROOT vanish fix) ----
  // SKETCH-CONSISTENCY §B: "never-vanishes is a timer-derivation fix, not a
  // placement choice." The old impl gated the WHOLE timer on a
  // streaming-OR-nonzero-elapsed condition with a perf-clock baseline set
  // inside a streaming-gated effect — so a long Kimi/Moonshot run that never
  // ticked, a transient stream_end, a backgrounded tab, or a temp-id→DB-id
  // remount dropped the timer entirely (BUG-260528-01). The fix:
  //
  //   1. Derive elapsed from `Date.parse(message.created_at)` — a STABLE
  //      wall-clock baseline that survives the 083 temp-id→DB-id remount
  //      (RESEARCH A2: the reconcile placeholder sets created_at = run.started_at).
  //      Using created_at actively REINFORCES the 083 fix (BUG-260526-04) —
  //      it never regresses it.
  //   2. Recompute `elapsed = (frozenEnd ?? now) - start` EACH tick — never an
  //      accumulator — so background-tab setInterval throttling only coarsens
  //      the tick, it can never freeze/skew the value (the immune-to-throttle
  //      guarantee).
  //   3. Render CONTINUOUSLY whenever `start` parses (Number.isFinite) — no
  //      nonzero-elapsed gate. Freeze at a TRUE terminal by capturing frozenEnd
  //      to Date.now() exactly ONCE on the streaming→terminal edge.
  // ---- Plan 095.1-03 (D-05 true reload timer) — the BUG-260606-02 fix ----
  // The OLD impl froze a terminal run at `Date.now()` captured at first render
  // (`frozenEndRef`) and measured from `created_at`. On RELOAD of a day-old run
  // that first render is already terminal, so the freeze captured the CURRENT
  // clock against a day-old created_at → a fabricated "1440m" duration.
  //
  // D-05 honesty rule: a FINISHED run's duration is the persisted wall-clock
  // `completedAt − startedAt` (identical live and on reload). A finished run
  // with NO completedAt shows NO duration — never a current-clock fabrication.
  // The live streaming tick is unchanged (the 095 never-vanishes behavior must
  // not regress).
  //
  // Baselines:
  //   - `runStartMs` = the run's true start (message.startedAt) if present,
  //     else `created_at` (the live-tick baseline that survives the 083
  //     temp-id→DB-id remount). Used for BOTH the live tick AND the true duration.
  const runStartMs = message.startedAt ? Date.parse(message.startedAt) : Date.parse(message.created_at)
  const hasStart = Number.isFinite(runStartMs)
  const completedMs = message.completedAt ? Date.parse(message.completedAt) : NaN
  const hasTrueEnd = Number.isFinite(completedMs)
  const [now, setNow] = useState(() => Date.now())
  // frozenEndRef is kept ONLY as the live→terminal transition fallback: a run
  // that terminates THIS session (was streaming, then flipped terminal) before a
  // persisted completedAt arrives still needs a frozen end. A RELOADED terminal
  // run mounts already-terminal — it was NEVER streaming this session — so it
  // must NOT capture Date.now() (that is the BUG-260606-02 "1440m" lie). The
  // `wasStreamingRef` gate is what distinguishes the two: only a run we actually
  // watched stream gets a same-session frozen end; a reloaded terminal run with
  // no completedAt simply shows NO duration (the honesty rule).
  const frozenEndRef = useRef<number | null>(null)
  const wasStreamingRef = useRef<boolean>(false)
  if (isStreamingNow) {
    wasStreamingRef.current = true
    if (frozenEndRef.current != null) frozenEndRef.current = null  // re-arm (defensive)
  } else if (
    wasStreamingRef.current &&
    frozenEndRef.current == null &&
    hasStart &&
    !hasTrueEnd
  ) {
    // Observed streaming→terminal this session with no persisted completedAt →
    // a legitimate same-session end-time.
    frozenEndRef.current = Date.now()
  }
  useEffect(() => {
    if (!isStreamingNow) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [isStreamingNow])

  // Duration derivation, honesty-gated:
  //   - streaming → live tick from runStartMs to now (never-vanishes).
  //   - terminal + persisted completedAt → TRUE duration completedMs − runStartMs.
  //   - terminal + no completedAt but a same-session frozenEnd → that frozen end
  //     (a run that JUST finished live this session — a real end-time, not the
  //     current clock against a stale created_at).
  //   - terminal + no completedAt + no frozenEnd → NO duration (the honesty rule).
  let elapsedMs: number | null = null
  if (hasStart) {
    if (isStreamingNow) {
      elapsedMs = now - runStartMs
    } else if (hasTrueEnd) {
      elapsedMs = completedMs - runStartMs
    } else if (frozenEndRef.current != null) {
      elapsedMs = frozenEndRef.current - runStartMs
    }
  }
  // `hasElapsed` gates the timer render — a terminal run with no honest end-time
  // shows nothing rather than a fabricated value. `elapsedLabel` is "" when null
  // so legacy render sites that interpolate it produce no duration text.
  const hasElapsed = elapsedMs != null
  const elapsedLabel = hasElapsed ? formatElapsed(elapsedMs as number) : ""

  // Phase 076.1-04: Cumulative file count from completed tool call results.
  // Parses tc.result JSON for output_files arrays across all tool calls.
  const fileCount = (message.tool_calls ?? []).reduce((sum, tc) => {
    if (tc.status === "done" && tc.result) {
      try {
        const parsed = JSON.parse(tc.result)
        if (parsed.output_files) return sum + parsed.output_files.length
      } catch { /* not JSON or no output_files key */ }
    }
    return sum
  }, 0)

  const lastTool = message.tool_calls?.[message.tool_calls.length - 1] ?? null
  const activeTool =
    lastTool && (lastTool.status === "running" || lastTool.status === "preparing")
      ? lastTool
      : null

  // ---- D-04 unified step count (Phase 095 Plan 02) ----
  // ALL THREE RunCard count sites — the header title, the RunStatusStrip "Step N",
  // and the collapsed-row "N steps" — read this ONE integer so they can never
  // disagree (SKETCH-CONSISTENCY §A "row numbering is load-bearing").
  // `unifiedStepCount` is PERSISTED (it reads the deduped `tool_calls`, which a
  // DB reload reconstructs) whereas `iterationCount` is OMITTED on reload by
  // `_mapMessageResponse` — so the step label now survives next-day reopen
  // (RESEARCH correction #5) AND is cross-provider-safe (ignores the diverging
  // iteration_start semantics).
  const stepCount = unifiedStepCount(message)
  // The raw iteration index is still forwarded to ToolCallPanel for its in-panel
  // per-iteration ("Round N") divider — but it NEVER drives a visible RunCard
  // step number anymore (that is now stepCount). Destructured here so no RunCard
  // count site reads the raw iteration field to derive a displayed number.
  const { iterationCount: panelIterationCount } = message

  // ---- Plan 07 (GAP-095-03 MED): single verb + calm run-identity title ----
  // The activity verb USED to occupy the title line (the streaming branch derived
  // the verb here) while the strip's `activityVerb` ALSO derived it — the verb
  // rendered TWICE. The operator-locked fix: the verb lives in the STRIP ONLY; the
  // title becomes a calm, deterministic run identity for BOTH streaming and
  // terminal. The status word is NOT carried here — it already lives honestly on
  // the collapsed-row (`Run · N steps · ✓ done · elapsed`); the expanded terminal
  // header reads the title + the now-`.done` (success-toned, verb=null) strip,
  // which is sufficient. The verb helper is now invoked from exactly ONE site
  // (the strip's `activityVerb` below).
  const headerTitle = hasTools
    ? `Run · ${stepCount} step${stepCount === 1 ? "" : "s"}`
    : "Agent run"

  // ---- Plan 095.1-03 (D-04 model attribution): the honest `{provider} · {model} · turn N` run-sub ----
  // 095-07 left this as a "model OMITTED" stub because the Message type carried
  // no model/provider field. D-04 now threads the REAL resolved runs.model /
  // runs.provider through the additive enrich → message.model / message.provider,
  // so the run-sub shows WHICH model actually answered (e.g. `google · gemini-3.5-flash`).
  // GRACEFUL: a legacy / pre-run-backed message (no run row) has no model/provider
  // → the run-sub falls back to just `turn N`. All values render as React text
  // children only — never innerHTML (T-095.1-03-01 XSS mitigation).
  //
  // ---- Plan 095.1-07 (GAP-2) turn reconciliation: live == reload ----
  // The run-sub describes ONE run = ONE turn. It used to read message.iterationCount
  // (a WITHIN-run agent-loop iteration, NOT a conversation turn) → the live path
  // showed `turn {iterationCount+1}` while a reload (iterationCount omitted by
  // _mapMessageResponse) showed `turn 1` — the same run disagreed live vs reload
  // (095.1-UAT 6b). The reload value (`turn 1` for a single exchange) is the
  // operator-accepted intended value, so render a STABLE turn that is identical
  // live and on reload. The raw iterationCount is still forwarded to
  // ToolCallPanel's per-iteration "Round N" divider (panelIterationCount) — that
  // consumer is unchanged; only the run-sub stops reading it.
  const turnNumber = 1
  const runSub = message.provider && message.model
    ? `${message.provider} · ${message.model} · turn ${turnNumber}`
    : `turn ${turnNumber}`

  // Phase 128 Plan 04 (CTC-01 / D-01): the tool-card header avatar shows the
  // REAL per-provider @lobehub/icons mark (via the shared providerLogo helper)
  // on the existing gradient-primary backing; unmapped providers (lmstudio /
  // unknown / undefined) resolve to null → the brand-pulse Bot fallback (D-08).
  // Pure presentation over the already-resolved message.provider — no new wire.
  const HeaderMark = providerLogo(message.provider)

  return (
    <div
      data-testid="run-card"
      className={cn(
        "mb-3 rounded-[14px] overflow-hidden max-w-full text-sm transition-all duration-300",
        isStreamingNow
          ? "bg-primary/5 border border-primary/35 shadow-[0_0_24px_hsl(239_100%_82%/0.18)]"
          : "bg-card/80 backdrop-blur-sm border border-border",
      )}
      data-streaming={isStreaming ? "true" : "false"}
    >
      {/* Sticky header — pins against the Radix ScrollArea Viewport that
          MessageList.tsx:91 wraps the message list in (RESEARCH §3.2). */}
      <header
        role="button"
        tabIndex={isStreamingNow ? -1 : 0}
        aria-expanded={expanded}
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (isStreamingNow) return  // D-08: keyboard activation also no-op while streaming
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setUserExpanded(v => !v)
          }
        }}
        className={cn(
          "sticky top-0 z-10 backdrop-blur-md bg-popover/92 border-b border-border px-4 py-3 flex items-center gap-3",
          !isStreamingNow && "cursor-pointer hover:bg-popover/98 transition-colors",
        )}
      >
        {/* Brand-pulse avatar — mirrors MessageItem.tsx:137 predicate verbatim.
            Phase 128 Plan 04 (CTC-01): the inner glyph is now the per-provider
            @lobehub mark (HeaderMark) at ~18px inside the 32px (w-8 h-8) backing,
            or the Bot fallback when providerLogo() returns null. The
            gradient-primary backing + the isStreamingNow animate-brandPulse ring
            are UNCHANGED (D-01: the pulse stays while streaming in every case). */}
        <div
          data-testid="run-card-avatar"
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm",
            // Phase 128 (CTC-01 contrast fix): real @lobehub brand marks need a light
            // chip to stay legible in BOTH themes — .Color marks show true brand colors
            // on white, and .Mono marks (OpenAI/Anthropic/Moonshot/OpenRouter/Ollama)
            // inherit the forced dark `currentColor` instead of vanishing on the violet
            // gradient. The unmapped Bot fallback keeps the gradient-primary identity
            // (a white glyph reads fine there).
            HeaderMark
              ? "bg-white text-zinc-900 ring-1 ring-black/10"
              : "gradient-primary text-white shadow-primary/20",
            isStreamingNow && "animate-brandPulse",
          )}
        >
          {HeaderMark ? (
            <HeaderMark size={18} />
          ) : (
            <Bot className="w-4 h-4 text-white" />
          )}
        </div>

        {/* Title + the ONE RunStatusStrip (header placement). Per SKETCH §B the
            strip rides the header while the run is in view (Plan 04 adds the
            floating placement on scroll-away). The strip composes the D-06
            continuous timer + the D-04 unifiedStepCount + the activity verb —
            replacing the old separate `stepLabel` subtitle and the gated timer
            span (both removed; this is the single source for elapsed/step/verb). */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {headerTitle}
          </div>
          {/* Plan 095.1-03 (D-04 model attribution): the run-sub subline UNDER
              the calm title (sketch HTML: title + run-sub + hdr-strip). Shows the
              REAL resolved `{provider} · {model} · turn N` (message.provider/model
              from the additive enrich); falls back to `turn N` for legacy/no-run
              messages. Rendered as React text children only (T-095.1-03-01). */}
          <div className="font-mono text-xs text-muted-foreground/70 truncate">
            {runSub}
          </div>
          {hasStart && (
            <RunStatusStrip
              placement="header"
              elapsedLabel={elapsedLabel}
              showElapsed={hasElapsed}
              stepCount={stepCount}
              activityVerb={
                isStreamingNow
                  ? outerBannerLabel(activeTool, hasTools, message.isPlanning ?? false)
                  : null
              }
            />
          )}
        </div>

        {/* Phase 076.1-04: Cumulative file count badge — grows during multi-batch runs. */}
        {fileCount > 0 && (
          <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </span>
        )}

        {/* Loader spinner during streaming */}
        {isStreamingNow && (
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
        )}
      </header>

      {/* Progress shimmer band — existing class from index.css:246-265.
          No new keyframes per UI-SPEC §5.2 + R-7. */}
      {isStreamingNow && <div className="tool-progress-bar" />}

      {/* Plan 03 (R-6 + sketch D5 + UI-SPEC §8.2): Collapsed-row JSX —
          shown when !expanded && terminal && hasTools. Clicking expands the
          body. Uses existing animate-fadeSlideUp (CONTEXT D-07; R-7 — no
          new keyframes). */}
      {!expanded && isTerminal && hasTools && (
        <button
          type="button"
          data-testid="run-card-collapsed"
          onClick={() => setUserExpanded(true)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-accent/30 transition-colors animate-fadeSlideUp text-sm text-muted-foreground"
          aria-label="Expand run details"
        >
          <Bot className="w-4 h-4 text-primary/60 flex-shrink-0" />
          {/* D-04: same unifiedStepCount as the header + strip — relabeled
              "N tool calls" → "N steps" per SKETCH-CONSISTENCY (the three
              sites can never disagree). */}
          <span>
            Run · {stepCount} step{stepCount === 1 ? "" : "s"}
          </span>
          <span aria-hidden="true">·</span>
          <span title={message.runError || undefined}>
            {statusGlyph(message.runStatus)} {statusWord(message.runStatus, message.runError)}
          </span>
          {/* D-095.1-05 honesty rule: only show the elapsed segment when there
              is a TRUE duration (persisted completedAt − startedAt, or a
              same-session frozen end). A terminal run with no real end-time
              shows the status word but NO fabricated duration. */}
          {hasElapsed && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{elapsedLabel}</span>
            </>
          )}
          <ChevronDown className="w-4 h-4 ml-auto flex-shrink-0" />
        </button>
      )}

      {/* Inner body — existing ToolCallPanel renders the per-tool list,
          narration interleave, step-list collapse-at-3+, active-glow on
          inner tool cards. All preserved verbatim by Plan 01. Plan 03
          gates the body behind `expanded` (true by default for streaming;
          false for terminal+tools turns until user clicks to expand). */}
      {expanded && (
        <div className="p-3">
          {/* Phase 076.2 D-01: Collapsible Thinking block for DeepSeek reasoning content.
              Three rendering states:
              1. reasoningContent present (streaming or completed): collapsible block
              2. Streaming + isPlanning + no reasoningContent yet: placeholder shimmer
              3. Neither: nothing rendered */}
          {message.reasoningContent ? (
            <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen} className="mb-2">
              <CollapsibleTrigger asChild>
                <button
                  data-testid="thinking-trigger"
                  aria-expanded={thinkingOpen}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors w-full text-left"
                >
                  {thinkingOpen ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">
                    {isStreamingNow ? "Thinking..." : "Thinking"}
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
                <div className="px-3 py-2 text-xs text-muted-foreground/70 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto border-l-2 border-muted-foreground/20 ml-3">
                  {message.reasoningContent}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : isStreamingNow && message.isPlanning ? (
            <div
              data-testid="thinking-row"
              className="px-3 py-1.5 text-xs italic text-muted-foreground/80 flex items-center gap-2"
              aria-label="Agent is planning the next step"
            >
              <span aria-hidden="true">💭</span>
              <span className="flex-1 truncate">
                Thinking · planning next step
              </span>
              {hasElapsed && (
                <span className="font-mono opacity-60 tabular-nums">
                  {elapsedLabel}
                </span>
              )}
            </div>
          ) : null}
          <ToolCallPanel
            toolCalls={message.tool_calls ?? []}
            subAgent={message.sub_agent}
            isPlanning={message.isPlanning}
            iterationCount={panelIterationCount}
            activatedSkills={message.activatedSkills}
          />
          {/* Phase 075.8 Task 5 (sketch 001 D4 — Next-up footer).
              While the run is streaming AND there's a forward-look signal
              (planning between iterations, OR the last tool just finished
              and the agent is deciding the next step), render a
              dashed-border row at the bottom of the run body. Per sketch
              live-run-container D4, this completes the past/present/future
              triad: past = result-summary rows, present = active tool +
              header timer, future = this Next-up footer. */}
          {isStreamingNow && shouldShowNextUp(message, activeTool) && (
            <div
              data-testid="next-up-footer"
              className="mx-1 mt-2 flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md text-xs font-mono text-muted-foreground"
            >
              <span className="uppercase tracking-wider opacity-60 flex-shrink-0">Next</span>
              <span className="flex-1 truncate">
                {nextHint(message, activeTool)}
              </span>
              <span className="opacity-50 flex-shrink-0 font-mono tabular-nums">
                {elapsedLabel}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// Phase 075.8 Task 5 — derive the next-up hint copy from message state.
// Priority:
//   1. While there's an active tool, the active step itself is "now" — don't
//      show a Next: footer (the timer in the header carries the present moment).
//   2. When isPlanning is true (post-tool, pre-next-tool window), show the
//      explicit planning copy.
//   3. Fallback: "deciding next step…" — covers the brief moment between
//      iteration boundaries before isPlanning flips.
function shouldShowNextUp(message: Message, activeTool: ToolCall | null): boolean {
  if (activeTool) return false
  if (message.isPlanning) return true
  // If there's at least one done tool and no active tool, the agent is
  // between iterations — show the deciding placeholder.
  const tools = message.tool_calls ?? []
  if (tools.length === 0) return false
  const lastTool = tools[tools.length - 1]
  return lastTool.status === "done"
}

function nextHint(message: Message, activeTool: ToolCall | null): string {
  if (activeTool) return ""
  if (message.isPlanning) return "planning next step…"
  return "deciding next step…"
}

// Phase 095 Plan 02 (D-06) — format the continuous elapsed duration.
// Short runs read `X.Xs` (the existing 1-decimal form); once a run crosses a
// minute it reads the compact `Xm Ys` form the sketch shows (`3m12s`-style),
// so a long Kimi/Moonshot run never shows an unwieldy `192.4s`.
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}m ${seconds}s`
}

// File-local helpers — UI-SPEC §8.2 copy contract.
function statusGlyph(s: Message["runStatus"]): string {
  if (s === "completed" || s === undefined) return "✓"
  if (s === "failed") return "✗"
  if (s === "timed_out") return "⏱"
  if (s === "cancelled") return "■"
  return "✓"
}

function statusWord(s: Message["runStatus"], runError?: string): string {
  if (s === "completed" || s === undefined) return "done"
  if (s === "failed") {
    const suffix = runError ? ` - ${categorizeError(runError).shortLabel}` : ""
    return `failed${suffix}`
  }
  if (s === "timed_out") {
    const suffix = runError ? ` - ${categorizeError(runError).shortLabel}` : ""
    return `timed out${suffix}`
  }
  if (s === "cancelled") return "cancelled"
  return "done"
}
