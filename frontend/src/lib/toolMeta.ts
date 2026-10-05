import type { Phase, ToolCall } from "@/types"
import { toolName } from "@/lib/toolNames"

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
  // Phase 273-05 (UI-D-06, OV-273-04): the activity string (`Showing an artifact…`).
  if (name === "show_artifact") return "Showing an artifact"
  if (name.includes("__")) {
    const [svc, act] = name.split("__")
    const formattedSvc = svc.charAt(0).toUpperCase() + svc.slice(1).replace(/_/g, " ")
    const formattedAct = act.replace(/_/g, " ")
    return `${formattedSvc} · ${formattedAct}`
  }
  return toolName(name)
}

/**
 * Phase 273-05 (UI-D-06) — the label a RAIL STEP wears (`Preparing {x}…`, `Running {x}`,
 * `{x} → {result}`). For every tool but the ones below it is `toolLabel`, byte-for-byte as
 * before. `show_artifact` reads the phrase (`Show an artifact`) in the step list and the
 * activity string (`Showing an artifact`) only where the run says what it is doing NOW —
 * the UI-SPEC rail table names both, and one string cannot be both.
 */
const STEP_PHRASE_TOOLS: ReadonlySet<string> = new Set(["show_artifact"])

export function stepLabel(name: string): string {
  return STEP_PHRASE_TOOLS.has(name) ? toolName(name) : toolLabel(name)
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
 * Phase 272 (FIND-07, D-08) — the ONE home of the filter line on the search tool card,
 * e.g. "Filtered: document date 1–31 Oct 2025 · legal entity = Acme GmbH".
 *
 * D-08 — derived from the call's ARGS, never its result: the result is truncated at
 * 2000 chars on persist while args persist whole, so the line is identical after a
 * reload. It states what the model ASKED for; what the server APPLIED is on the audit
 * row (272-04, D-12).
 *
 * The args shape is the `filters` contract of SEARCH_DOCUMENTS_TOOL
 * (`{field, op, value, value2, values, unit}`, op = ViewCondition.op), plus the legacy
 * `metadata_filter` object, rendered as `eq` after the conditions. ISO days are formatted
 * by string parsing only: a calendar day is not an instant, and parsing one as a date
 * object would shift it a day back in a negative-offset timezone. Anything unparseable
 * renders verbatim — this never throws on model-emitted args.
 */
export function searchFilterLine(name: string, args: Record<string, unknown>): string | null {
  if (name !== "search_documents") return null
  const conds: unknown[] = Array.isArray(args.filters) ? args.filters : []
  const legacyRaw = args.metadata_filter
  const legacy =
    legacyRaw && typeof legacyRaw === "object" && !Array.isArray(legacyRaw)
      ? Object.entries(legacyRaw as Record<string, unknown>).map(([field, value]) => ({
          field,
          op: "eq",
          value,
        }))
      : []
  const parts = [...conds, ...legacy]
    .map(formatCondition)
    .filter((p): p is string => Boolean(p))
  return parts.length ? `Filtered: ${parts.join(" · ")}` : null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const DATE_WORD_LABELS: Record<string, string> = {
  date: "document date",
  added: "added",
  source_created: "created in file",
  source_modified: "modified in file",
}

function fieldLabel(field: string): string {
  return DATE_WORD_LABELS[field] ?? field.replace(/_/g, " ")
}

function scalarText(v: unknown): string {
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return ""
}

interface IsoDay {
  y: number
  m: number // 1-12
  d: number
}

function parseIsoDay(s: string): IsoDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

/** "2025-10-03" → "3 Oct 2025"; anything else verbatim. */
function formatIsoDay(s: string): string {
  const day = parseIsoDay(s)
  return day ? `${day.d} ${MONTHS[day.m - 1]} ${day.y}` : s
}

/** Collapse the shared month / year: "1–31 Oct 2025", "1 Sep – 31 Oct 2025". */
function formatRange(a: string, b: string): string {
  const x = parseIsoDay(a)
  const y = parseIsoDay(b)
  if (x && y) {
    if (x.y === y.y && x.m === y.m) {
      if (x.d === y.d) return formatIsoDay(a)
      return `${x.d}–${y.d} ${MONTHS[x.m - 1]} ${x.y}`
    }
    if (x.y === y.y) return `${x.d} ${MONTHS[x.m - 1]} – ${y.d} ${MONTHS[y.m - 1]} ${y.y}`
  }
  return `${formatIsoDay(a)} – ${formatIsoDay(b)}`
}

function formatSpan(value: string, unit: string): string {
  const u = value === "1" && unit.endsWith("s") ? unit.slice(0, -1) : unit
  return u ? `${value} ${u}` : value
}

function formatCondition(c: unknown): string | null {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null
  const cond = c as Record<string, unknown>
  const field = typeof cond.field === "string" ? cond.field.trim() : ""
  const op = typeof cond.op === "string" ? cond.op.trim() : ""
  if (!field || !op) return null
  const label = fieldLabel(field)
  const value = scalarText(cond.value)
  const value2 = scalarText(cond.value2)
  const unit = typeof cond.unit === "string" ? cond.unit : ""
  switch (op) {
    case "eq":
      return `${label} = ${formatIsoDay(value)}`
    case "one_of": {
      const values = Array.isArray(cond.values) ? cond.values.map(scalarText).filter(Boolean) : []
      return `${label} in ${values.join(", ")}`
    }
    case "contains":
      return `${label} contains ${value}`
    case "is_empty":
      return `${label} is empty`
    case "gte":
      return `${label} ≥ ${formatIsoDay(value)}`
    case "lte":
      return `${label} ≤ ${formatIsoDay(value)}`
    case "before":
      return `${label} before ${formatIsoDay(value)}`
    case "after":
      return `${label} after ${formatIsoDay(value)}`
    case "between":
      return value2 ? `${label} ${formatRange(value, value2)}` : `${label} from ${formatIsoDay(value)}`
    case "within_next":
      return `${label} within next ${formatSpan(value, unit)}`
    case "older_than":
      return `${label} older than ${formatSpan(value, unit)}`
    default:
      return `${label} ${op.replace(/_/g, " ")} ${value}`.trim()
  }
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
