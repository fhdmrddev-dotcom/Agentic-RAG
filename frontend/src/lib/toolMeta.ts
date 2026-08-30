import type { Phase, ToolCall } from "@/types"

/**
 * Shared tool metadata helpers — used by ToolCallPanel and MessageItem.
 * Keeps labels and summaries in one place so they don't drift.
 */

export function toolLabel(name: string): string {
  if (name === "search_documents") return "Searching documents"
  if (name === "query_documents") return "Querying documents"
  if (name === "web_search") return "Searching the web"
  if (name === "analyze_document") return "Analyzing document"
  if (name === "ls") return "Listing folder"
  if (name === "tree") return "Browsing folder tree"
  if (name === "grep") return "Searching file contents"
  if (name === "glob") return "Finding files by pattern"
  if (name === "read_document") return "Reading document"
  if (name === "execute_code") return "Executing code"
  if (name === "load_skill") return "Loading skill"
  if (name === "save_skill") return "Saving skill"
  if (name === "read_skill_file") return "Reading skill file"
  if (name.includes("__")) {
    const [svc, act] = name.split("__")
    const formattedSvc = svc.charAt(0).toUpperCase() + svc.slice(1).replace(/_/g, " ")
    const formattedAct = act.replace(/_/g, " ")
    return `${formattedSvc} · ${formattedAct}`
  }
  return name
}

export function toolSummary(name: string, args: Record<string, unknown>): string | null {
  if (name === "execute_code" && args.description) return args.description as string
  if (name === "read_document" && args.filename) return args.filename as string
  if (name === "read_document") return null // don't show raw UUID
  if (name === "ls" && args.path) return args.path as string
  if (name === "tree" && args.path) return args.path as string
  if (name === "grep" && args.pattern) return args.pattern as string
  if (name === "glob" && args.pattern) return args.pattern as string
  if (name === "load_skill" && args.skill_name) return args.skill_name as string
  if (name === "save_skill" && args.name) return args.name as string
  if (name === "analyze_document" && args.filename) return args.filename as string
  if (name.includes("__")) {
    if (args.message) return String(args.message)
    if (args.subject) return String(args.subject)
    if (args.summary) return String(args.summary)
    if (args.title) return String(args.title)
    if (args.query) return String(args.query)
    if (args.file_id) return `File: ${args.file_id}`
  }
  if (args.query) return args.query as string
  if (args.filename) return args.filename as string
  return null
}

/**
 * Phase 56 D-07: derive overall task phase from active tool name.
 * Pure frontend logic — no new backend events. Used by ToolCallPanel header.
 * Default returns "Thinking…" per D-07 (between tools / unknown).
 */
export function taskPhaseLabel(toolName: string): string {
  if (toolName === "search_documents") return "Gathering context"
  if (toolName === "query_documents") return "Gathering context"
  if (toolName === "web_search") return "Gathering context"
  if (toolName === "analyze_document") return "Analyzing"
  if (toolName === "execute_code") return "Running code"
  if (toolName === "load_skill") return "Loading skill"
  return "Thinking…"
}

/**
 * Phase 194 Plan 07 (RUN-01 / BUG-260815-04 / D-18) — the harness banner's
 * progress input, derived from the phase slice the panel already renders.
 *
 * ⚠ WHY THIS EXISTS, because the instinct on reading `outerBannerLabel` below is
 * that its harness pre-tools string is a copy bug. It is not. `hasAnyTools` is
 * `(message.tool_calls?.length ?? 0) > 0` and **a harness run writes NO
 * `tool_calls`** — its progress lives in `workflow_phases` rows and in
 * `phase_started` / `phase_completed` SSE. So the pre-tools branch below held
 * from kickoff to terminal and the banner was STRUCTURALLY INCAPABLE of
 * advancing. The fix is this advancing input; the string is untouched.
 *
 * TWO HONESTY RULES ARE BAKED INTO THE SHAPE, not left to the caller:
 *
 *  1. **No total is claimed, deliberately** (T-194-07-01). It is tempting to say
 *     "Phase 2 of 5" — the panel does, and the sketch approves that vocabulary
 *     (`workflow-run-surface.md` D2 line 2). The panel may: it holds the
 *     RECONCILE FLOOR, `getThreadWorkflow`'s authoritative `total_phases`
 *     (`StreamsProvider.tsx:3382-3388`). But `appendPhaseForThread`
 *     (`StreamsProvider.tsx:2779`) GROWS the slice as phases start, so a
 *     length-derived total is understated in any window where the floor has not
 *     landed — "Phase 2 of 2" on a five-phase run. Rather than race the fetch,
 *     the chat banner claims no total. That is also the 094/103 split: the panel
 *     owns the meaningful spine, chat carries a THIN run receipt
 *     (`workflow-run-surface.md` D1). Re-open trigger: if a later phase gives
 *     the chat surface a corroborated total (a wire field, or a slice flag that
 *     says "this is the seeded plan"), the "of N" is honest and worth adding.
 *  2. **No workflow-author content** (T-194-07-02). The interface carries two
 *     NUMBERS. No slug, no phase output, no run error text and no user content
 *     can reach the sentence without changing this type — which is the point of
 *     it being a type rather than a formatted string.
 */
export interface HarnessBannerProgress {
  /** Phases the slice reports as genuinely finished (`done` ONLY — a `skipped`,
   *  `failed`, `cancelled` or `recorded-not-sent` phase is not a phase that
   *  finished, and the banner says "done"). */
  phasesDone: number
  /** 1-based ordinal of the phase currently working, or null when none is. */
  runningPhase: number | null
}

/**
 * Derive the banner's progress from `phasesByThread`'s rows. Returns null for an
 * empty slice (pre-kickoff, or a Deep thread, which carries no phases at all) so
 * the caller's default and this return value are the same "no progress" value.
 */
export function harnessBannerProgress(phases: readonly Phase[]): HarnessBannerProgress | null {
  if (phases.length === 0) return null
  let phasesDone = 0
  let runningPhase: number | null = null
  phases.forEach((p, i) => {
    if (p.status === "done") phasesDone += 1
    // `retrying` is the same phase still working — a retry has not advanced past it.
    if (runningPhase === null && (p.status === "running" || p.status === "retrying")) {
      // phaseIndex is server-supplied; fall back to the array position rather
      // than render "Working on phase 0…" or "…phase NaN…" if it is unusable.
      runningPhase =
        Number.isInteger(p.phaseIndex) && p.phaseIndex >= 0 ? p.phaseIndex + 1 : i + 1
    }
  })
  return { phasesDone, runningPhase }
}

/**
 * Phase 067.1 Plan 02: derive outer-banner placeholder copy from in-flight state.
 * Used by MessageItem outer placeholder to replace generic "Thinking" / "Working".
 * Pure frontend logic — no new backend events; derives from already-emitted SSE state
 * (iteration_start, tool_preparing, tool_start, code_execution_start, skill_activated).
 *
 * State precedence (most-specific first):
 * - No tools and no isPlanning → "Setting up agent…" (pre-first-delta silence)
 * - isPlanning (true) → "Thinking…"
 * - hasAnyTools but no activeTool → "Synthesizing answer…" (all-tools-done state)
 * - activeTool present → tool-specific copy from the per-tool branches below
 */
export function outerBannerLabel(
  activeTool: ToolCall | null,
  hasAnyTools: boolean,
  isPlanning: boolean,
  // BUG-260609-02 polish: a Harness/workflow run shows the agent-mode copy
  // "Setting up agent…" in the pre-first-output window, which reads oddly for a
  // multi-phase workflow (whose real progress is in the workspace panel). When the
  // thread is workflow-locked, surface "Starting workflow…" instead. Purely the
  // pre-tools placeholder text — every other branch is unchanged and Deep mode
  // (isHarness=false, the default) is byte-identical.
  isHarness = false,
  // Phase 174 / STATE-03: a reasoning model (Kimi ~4,000 reasoning tokens, GLM,
  // DeepSeek) streams reasoning BEFORE any tool or visible token exists, so the
  // pre-first-token window currently reads as a dead "Setting up agent…". Count
  // the already-stamped reasoning signal (message.reasoningContent, accumulated
  // cross-provider at StreamsProvider onReasoningDelta — no new backend event) as
  // activity: surface "Reasoning…" instead. Mirrors the isHarness additive-default
  // shape above — default false keeps every existing caller + Deep Mode
  // byte-identical (D-14). Anthropic/Google never emit reasoning_delta, so they
  // keep the calm fallback by design (not a bug).
  reasoningActive = false,
  // Phase 194 Plan 07 (BUG-260815-04 / D-18): the harness run's phase progress,
  // from `harnessBannerProgress()` over the `phasesByThread` slice. Mirrors the
  // isHarness / reasoningActive additive-default shape above — default null
  // keeps every existing caller + the whole Deep path byte-identical (D-14).
  harnessProgress: HarnessBannerProgress | null = null,
): string {
  if (!hasAnyTools && !isPlanning) {
    if (reasoningActive) return "Reasoning…"
    // ⚠⚠ THE HARNESS STRING ON THE `return` LINE BELOW IS THE PRE-PHASE-1
    // VALUE, NOT THE ONLY VALUE, and it is byte-pinned by
    // `__tests__/toolMeta.test.ts` as a D-14 decision. (It is not quoted
    // anywhere in this comment ON PURPOSE: this file's prose already spells it
    // once at the isHarness parameter above, and every further prose copy both
    // moves the acceptance grep and makes a future copy fence over this module
    // vacuous — the 187-24 / 193.2-F-3 lesson, and the same trap 194-04's own
    // `default:` grep fell into.) The next reader's instinct will be to delete or reword it —
    // don't. BUG-260815-04 was never that the string is wrong; it was that the
    // banner never LEFT it, because a harness run writes no `tool_calls` (see
    // `harnessBannerProgress` above). This arm is what advances it, and it
    // deliberately falls THROUGH to the pinned string whenever the run has not
    // actually got past phase 1 — an absent or empty slice degrades to the
    // shipped truth rather than to an invented one (T-194-07-01).
    if (isHarness && harnessProgress) {
      const { phasesDone, runningPhase } = harnessProgress
      const advanced = phasesDone > 0 || (runningPhase !== null && runningPhase > 1)
      if (advanced) {
        if (runningPhase !== null) return `Working on phase ${runningPhase}…`
        return phasesDone === 1 ? "1 phase done…" : `${phasesDone} phases done…`
      }
    }
    return isHarness ? "Starting workflow…" : "Setting up agent…"
  }
  if (isPlanning) return "Thinking…"
  if (!activeTool) return "Synthesizing answer…"
  if (activeTool.name === "search_documents") return "Searching knowledge base…"
  if (activeTool.name === "query_documents") return "Querying document metadata…"
  if (activeTool.name === "web_search") return "Searching the web…"
  if (activeTool.name === "analyze_document") return "Analyzing document…"
  if (activeTool.name === "execute_code") {
    if (activeTool.status === "preparing") return "Preparing code…"
    // SAND (silence fix): honest sub-phase during the otherwise-silent sandbox
    // setup window, from the code_executing `phase` field the backend emits.
    if (activeTool.codePhase === "starting_sandbox") return "Starting sandbox…"
    if (activeTool.codePhase === "installing_libraries") return "Installing libraries…"
    return "Running code…"
  }
  if (activeTool.name === "load_skill") {
    const skillName = (activeTool.args?.skill_name as string | undefined) ?? ""
    return `Loading skill "${skillName}"…`
  }
  return "Working…"
}
