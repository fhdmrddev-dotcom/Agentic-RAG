import { supabase } from "./supabase"
import type { Thread, Message, Document, Folder, Skill, SkillCreate, SkillUpdate, SkillFile, OutputFile, SourceReference, Citation, Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem, WorkspaceFileContent, WorkspaceVersion, WorkspaceDiff, AskUserAnswerBody, EmitSubStep, EmitFailure, MetadataFieldDef, ViewFilter, SavedView, RelType, RelatedDocumentsResponse, Relationship, ClassificationRule, TestCase, TestCaseCreate, TestCaseUpdate, SkillVersion, EvalRunKickoff, EvalRunReadout, EvalRun, SkillProposal, ProposalApproveResult, PublishGate, MatrixRunKickoff, EngineHealthBoard, EvalAggregate } from "../types"

export interface SkillImportResult {
  created: Skill[]
  errors: Array<{ skill: string; error: string }>
  // Phase 142 (SRH-01 / SC#1 / D-08): non-blocking honesty notes — one per imported
  // skill that bundles a non-Python script. OPTIONAL so existing consumers keep
  // compiling and ignore it (additive, Pitfall 5).
  notes?: Array<{ skill: string; note: string }>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

/** Phase 148 (VIS-01 / D-04) — the mid-session feature-flip bounce signal. When a
 *  governed page's audience is tightened while a non-operator is on it, that page's
 *  NEXT data fetch is refused server-side (a 403 from `require_visible`). Any api.ts
 *  call that surfaces the refusal as an `ApiError(403)` dispatches this window event
 *  (one chokepoint — the `ApiError` constructor below), so the App-level listener can
 *  bounce home with a plain refusal instead of a dead/blank governed page.
 *  RENDER-ONLY — the server 403 is the security wall; this only avoids a dead-end. */
export const FEATURE_FORBIDDEN_EVENT = "agentic:feature-forbidden"

/** Phase 148 (VIS-01 / D-04 — CR-02 fix) — the EXACT server refusal detail that
 *  `require_visible` returns (dependencies.py) for a non-operator hitting an
 *  Operators-only governed feature. This literal is the SOLE trigger for the
 *  graceful-bounce event: a bare 403 is NOT enough (the FLAG-01 workflows kill-switch
 *  and the app-layer ban check BOTH also return 403 through `ApiError`). The backend
 *  gate, the `ApiError` dispatch guard below, and the App-level `onForbidden` listener
 *  all agree on THIS one literal — keep them in lockstep. */
export const VISIBILITY_REFUSAL = "This feature is available to administrators only."

/** Phase 092 (092-06 / F3): a status-carrying error so the send path can
 *  distinguish a 409 lock-refusal (MODE-02 server-side Harness→Deep refusal)
 *  from a generic failure. Mirrors the existing DownloadError idiom (status +
 *  name). Thrown only by postMessage — the rest of api.ts keeps its generic
 *  throws (additive, minimal diff). */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = "ApiError"
    // Phase 148 (VIS-01 / D-04 — CR-01/CR-02 fix): a bare 403 is NOT uniquely a
    // `require_visible` feature refusal. The FLAG-01 workflows kill-switch
    // (threads.py — reachable via postMessage) and the app-layer ban check
    // (dependencies.py — on the shared auth path) BOTH return 403 through `ApiError`.
    // So gate the graceful-bounce event on the EXACT server refusal detail literal,
    // NOT the bare status — only a genuine `require_visible` refusal carries
    // VISIBILITY_REFUSAL, so only it bounces (the kill-switch/ban 403s keep their real
    // message + their own error handling). getEffectiveFeatures throws a PLAIN Error
    // (never ApiError), so the /features read can never feed this loop either (CR-01).
    // Render-only; the server 403 remains the authority.
    if (status === 403 && message === VISIBILITY_REFUSAL && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(FEATURE_FORBIDDEN_EVENT, { detail: { message, status } }),
      )
    }
  }
}

/** Phase 148 (VIS-01 / D-04) — the governed feature keys (the effective-map keys of
 *  `GET /features`). skill_studio + model_management are Operators-only on the day-one
 *  map; workflow_authoring + governance_health are Everyone (148-05). Phase 181
 *  (REVERT-01 / D-181-01) adds `visual_workflow_canvas` — the v3.6 visual-canvas master
 *  switch, cold-default `"off"` (hidden from EVERYONE incl. operators; the SEED-115
 *  enum-not-boolean contract). It joins the effective map automatically. */
export type GovernedFeature =
  | "skill_studio"
  | "model_management"
  | "workflow_authoring"
  | "governance_health"
  | "visual_workflow_canvas"

// ⚠ THIS UNION IS STALE AGAINST THE SERVER, DELIBERATELY AND WITH AN OWNER — see
// `D-190-DEF-09` in `.planning/phases/190-…/deferred-items.md`. Plan 190-09 added
// `"live_connectors"` to the backend's `_VISIBILITY_FEATURES` (`api/admin.py`) and
// `_GOVERNED_FEATURES` (`models/user_settings.py`, cold default `"off"`), so
// `GET /features` DOES return the key (`api/features.py:81` iterates
// `_GOVERNED_FEATURES`). It is NOT added here by plan 190-16 because widening this union
// makes five `Record<GovernedFeature, …>` exhaustive maps fail to typecheck — two of them
// inside `/admin`, which phase 190's D-25 fences ("do not add anything to /admin") — and
// the honest completion of that half is a `FeatureVisibility.FEATURES` operator card,
// which is a user-facing capability and belongs to its own plan, not to the Settings table.
// 190-16 therefore reads the key through ONE documented, fail-closed reader
// (`settings/connectionsCopy.ts` → `liveConnectorsOnFrom`) rather than half-widening the
// type. Both halves — this union AND the operator card — land in the same later commit.

/** The caller's effective feature→visible map. Partial so the fail-CLOSED `{}`
 *  fallback (hook error / pre-resolve) type-checks — an absent key reads as hidden. */
export type EffectiveFeatures = Partial<Record<GovernedFeature, boolean>>

// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 (D-166-06) — the active-org id injected as an `X-Org-Id` header on
// EVERY authed request. This is a per-device UI HINT, never trusted: the server
// re-validates it against the caller's membership (Plan 01 `get_active_org_id`,
// on a user-JWT/RLS connection) and a forged/stale value reaches no data (403).
//
// Read module-level here — exactly like the access token is read from
// `supabase.auth.getSession()` — so every existing authed call auto-carries the
// header with ZERO call-site churn. `OrgProvider` is the sole WRITER (it calls
// `setActiveOrgId` synchronously on every switch, D-166-08, so any effect keyed on
// the active org sees the new header before it runs). We seed the module var from
// localStorage at load so the very first authed call after a page reload already
// carries the rehydrated org, before OrgProvider's mount effect re-syncs it.
// ─────────────────────────────────────────────────────────────────────────────
export const ACTIVE_ORG_STORAGE_KEY = "active-org-id"

let _activeOrgId: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY) : null

/** The active org id injected as `X-Org-Id` (a hint — the server re-validates it). */
export function getActiveOrgId(): string | null {
  return _activeOrgId
}

/** Set the active org id for the header seam. Called by OrgProvider on every
 *  switch (synchronously, D-166-08) + on mount (rehydrate). Persisting to
 *  localStorage is OrgProvider's job (the `ACTIVE_ORG_STORAGE_KEY` single source). */
export function setActiveOrgId(orgId: string | null): void {
  _activeOrgId = orgId
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  const orgId = getActiveOrgId()
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    // Phase 166 (D-166-06): server RE-VALIDATES this against membership — never trusted.
    ...(orgId ? { "X-Org-Id": orgId } : {}),
  }
}

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return token
}

export async function listThreads(): Promise<Thread[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads`, { headers })
  if (!res.ok) throw new Error("Failed to list threads")
  return res.json() as Promise<Thread[]>
}

export async function createThread(title = "New Chat", folderId?: string | null): Promise<Thread> {
  const headers = await getAuthHeaders()
  const body: Record<string, string> = { title }
  if (folderId) body.folder_id = folderId
  const res = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create thread")
  return res.json() as Promise<Thread>
}

// Phase 075 D-075-03 (frontend half): shared MessageResponse DTO + mapper used
// by both getMessages and getSnapshot. Extracted from the inline destructure
// that previously lived inside getMessages; byte-identical mapping behavior.
type MessageResponseDTO = Message & {
  source_refs?: Citation[]
  confidence_level?: string
  confidence_avg_similarity?: number
  confidence_disclaimer?: string | null
  run_id?: string | null
  run_status?: "streaming" | "completed" | "failed" | "cancelled" | "timed_out" | null  // Phase 066 D-066-04: mirrors backend MessageResponse.run_status 5-value Literal post-migration 038
  reasoning_content?: string | null  // Phase 076.2: DeepSeek thinking mode reasoning_content from backend
  // Phase 095.1-03 (D-04 model attribution + D-05 true reload timer): the runs
  // enrich adds these 4 snake fields; the mapper coerces them null → undefined.
  model?: string | null
  provider?: string | null
  started_at?: string | null
  completed_at?: string | null
}

function _mapMessageResponse(m: MessageResponseDTO): Message {
  // Phase 063.1 (D-063.1-13/15): backend LEFT JOINs public.runs and returns
  // run_id + run_status (snake_case) on assistant rows; user rows + pre-run-backed
  // assistant rows return null for both. Extend the inline response shape and
  // map snake → camel in the same destructure pass that already converts
  // confidence_* and source_refs.
  //
  // WR-02 fix: backend Pydantic MessageResponse declares
  // `run_id: UUID | None = None`, so the wire JSON carries `null` for
  // user rows and pre-run-backed assistant rows. The frontend Message
  // type declares `runId?: string` (optional, NOT `| null`), so we MUST
  // coerce null → undefined here in the mapper.
  const {
    source_refs,
    confidence_level,
    confidence_avg_similarity,
    confidence_disclaimer,
    run_id,
    run_status,
    reasoning_content,  // Phase 076.2: DeepSeek thinking mode
    // Phase 095.1-03 (D-04/D-05): destructure the 4 enrich fields so the snake
    // started_at/completed_at do NOT leak through ...rest, and coerce null →
    // undefined (mirroring the runId/runStatus idiom).
    model,
    provider,
    started_at,
    completed_at,
    ...rest
  } = m
  const mapped: Message = {
    ...rest,
    citations: (source_refs ?? []) as Citation[],
    runId: run_id ?? undefined,
    runStatus: run_status ?? undefined,
    reasoningContent: reasoning_content ?? undefined,  // Phase 076.2
    // Phase 095.1-03 (D-04 model attribution + D-05 true reload timer)
    model: model ?? undefined,
    provider: provider ?? undefined,
    startedAt: started_at ?? undefined,
    completedAt: completed_at ?? undefined,
  }
  if (confidence_level) {
    mapped.confidence = {
      level: confidence_level as "high" | "medium" | "low",
      avg_similarity: confidence_avg_similarity ?? 0,
      disclaimer: confidence_disclaimer ?? null,
    }
  }
  // BUG-260526-03 (D-05): reconstruct finalOutputFiles from persisted tool_calls
  // so reloaded messages display output file download links in the Final Outputs panel.
  // The persisted execute_code result contains output_files with {filename, url}.
  if (mapped.tool_calls?.length) {
    // Phase 095 Plan 05 (D-08): carry the persisted `is_hero` flag through reload
    // reconstruction so a chat reopened the next day re-heroes the same file
    // (the backend persists it onto each execute_code output_files entry).
    const outputFiles: { filename: string; url?: string; size?: number; is_hero?: boolean }[] = []
    for (const tc of mapped.tool_calls) {
      if (tc.name === "execute_code" && tc.result) {
        try {
          const r = typeof tc.result === "string" ? JSON.parse(tc.result) : tc.result
          if (Array.isArray(r.output_files)) {
            for (const f of r.output_files) {
              if (f.filename) {
                outputFiles.push({ filename: f.filename, url: f.url, size: f.size, is_hero: f.is_hero })
              }
            }
          }
        } catch { /* ignore parse errors on non-JSON results */ }
      }
    }
    if (outputFiles.length > 0) {
      mapped.finalOutputFiles = outputFiles
    }
  }
  return mapped
}

export async function getMessages(threadId: string, signal?: AbortSignal): Promise<Message[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, { headers, signal })
  if (!res.ok) throw new Error("Failed to get messages")
  const data = await res.json() as MessageResponseDTO[]
  // Phase 075 D-075-03: delegate to shared mapper so getSnapshot reuses it
  // byte-identically.
  return data.map(_mapMessageResponse)
}

export async function listModels(): Promise<{ models: string[]; default: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/models`, { headers })
  if (!res.ok) throw new Error("Failed to list models")
  return res.json() as Promise<{ models: string[]; default: string }>
}

export async function deleteThread(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${id}`, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete thread")
}

export async function renameThread(id: string, title: string): Promise<Thread> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to rename thread")
  return res.json() as Promise<Thread>
}

// ── Phase 063: Run-backed streaming API ──────────────────────────────────────
//
// The legacy POST-and-stream-on-the-same-request orchestrator was physically
// removed in Phase 063 (D-063-01 hard cutover; no compat shim per RESEARCH
// Open Question #3). The replacement is four explicit functions with clear
// single responsibilities:
//
//   postMessage(...)       → POST /threads/{tid}/messages, returns {message_id, run_id}
//   subscribeToRun(...)    → GET  /runs/{rid}/stream?since={cursor}, dispatches SSE events
//   getActiveRuns(...)     → GET  /threads/{tid}/active-runs
//   cancelRun(...)         → DELETE /runs/{rid}
//
// Wire format on `/runs/{rid}/stream` is byte-identical to the legacy POST-stream
// (Phase 062 D-062-05); the parser body in subscribeToRun is therefore copied
// verbatim from the previous parser, plus two NEW terminal branches (`error`
// payload + `cancelled`) the legacy code did not need.

/** Phase 063 (D-063-01): response shape from POST /threads/{tid}/messages.
 * `message_id` is the USER-message UUID (the only one that exists synchronously
 * — the assistant message is persisted at terminal time). `run_id` is the
 * Redis Stream run identifier the frontend opens GET /runs/{rid}/stream against.
 */
export interface PostMessageResponse {
  message_id: string
  run_id: string
  // Phase 095.1-07 (GAP-2): the already-resolved model/provider the backend
  // wrote to the runs row, surfaced ADDITIVELY on the dispatch response so the
  // live assistant placeholder shows `{provider} · {model}` in the LIVE moment
  // (not only after a reload re-reads them via the Plan-03 enrich SELECT).
  // Optional + nullable to match the wire shape; legacy callers are unaffected.
  model?: string | null
  provider?: string | null
}

/** Phase 062 ActiveRunResponse mirror. Always status='streaming' per D-062-02. */
export interface ActiveRun {
  run_id: string
  started_at: string
  status: "streaming"
}

/** Phase 075 D-075-01: ThreadSnapshotResponse mirror. One-round-trip reconcile
 * primitive — backend GET /threads/{tid}/snapshot composes messages +
 * active_runs + per-run since_cursors into a single fetch. The frontend
 * StreamsProvider.reconcile swaps its 3-call chain for a single getSnapshot()
 * call (D-075-02 atomic swap). since_cursors map keys are run_ids; values are
 * Redis stream cursor strings (e.g., "1731936000000-0" or "0").
 */
export interface ThreadSnapshot {
  messages: Message[]
  active_runs: ActiveRun[]
  since_cursors: Record<string, string>
}

/** Phase 063 / Phase 066: callback shape for subscribeToRun. Mirrors the legacy POST-stream
 * callback signature (preserved for MessageItem rendering compat) plus the
 * `onTerminal` callback that handles Phase 062 TERMINAL_TYPES extended by D-066-06
 * to 4 values (done | error | cancelled | timed_out).
 */
export interface StreamCallbacks {
  onDelta: (text: string) => void
  /** Phase 076.2 D-01: DeepSeek reasoning_content streaming delta.
   * Accumulates on message.reasoningContent for real-time thinking display. */
  onReasoningDelta?: (text: string) => void
  onDone: () => void
  // Phase 066 D-066-06: 4th kind 'timed_out' — distinct from 'error' (LLM/system failure)
  // and 'cancelled' (user-Stop). Hooks set runStatus='timed_out' on this; MessageItem
  // renders the "Agent reached time limit" banner + Resume button per D-066-09/10.
  // Phase 075 D-075-13: return type widened to Promise<void> | void so the
  // StreamsProvider onTerminal wrapper can await the getSnapshot probe before
  // deciding whether to flip runStatus (BUG-260518-01 reconcile-fetch path).
  // Phase 075.1 Plan 01: 5th kind 'reader_done' — defensive close from the
  // SSE reader loop when no explicit terminal SSE event was seen. Pre-Plan-01
  // this fired as ('done', undefined); the consumer-side widened transient
  // filter (StreamsProvider _isTransientStreamEnd) treats this as a probe
  // trigger so a snapshot-streaming run can re-attach instead of being
  // mis-flipped to "completed".
  onTerminal: (
    kind: "done" | "error" | "cancelled" | "timed_out" | "reader_done",
    error?: string,
  ) => Promise<void> | void
  onTitleUpdate?: (title: string) => void
  onToolPreparing?: (name: string, index: number) => void
  onToolStart?: (name: string, args: Record<string, string>) => void
  /** T-260523-09 (2026-05-23): tool args streaming progress. Backend emits
   * `tool_args_progress` SSE every 5KB of cumulative args streamed from the
   * LLM during the long code-generation pauses. Handler updates
   * tool_calls[N].argsBytesStreamed so the UI can show "Generating ... (12.7 KB)"
   * while the tool is still in "preparing" state. Pre-fix behavior was zero
   * progress signal during 60-120s execute_code generation. */
  /** 075.6 Plan 02 / Req #5: 4th positional arg `codeSoFar?: string` carries the
   * cumulative tool-args code text (FULL concatenation, NOT the 5 KB tail).
   * Optional for backward compat with pre-Plan-01 wire events that don't
   * carry `code_so_far`. Plan 02 reducer applies longer-string-wins on
   * tc.argsCodeText. */
  onToolArgsProgress?: (toolIndex: number, name: string, totalArgsBytesSoFar: number, codeSoFar?: string) => void
  // Phase 075.2 Plan 01 Task 2 (D-075.2-04 / WR-01): optional id?:string
  // for future tool_call_id matching. Backend wire-up deferred (RESEARCH
  // §Q1: tool_end SSE today carries name + result only). When undefined
  // the reducer falls back to tc.name match (byte-identical legacy behavior).
  onToolEnd?: (name: string, result: string | undefined, id?: string) => void
  onSubAgentStart?: (filename: string, task: string) => void
  onSubAgentDelta?: (text: string) => void
  onSubAgentDone?: () => void
  onSkillActivated?: (skillName: string) => void
  /** Phase 149 Plan 09 (D-149-10): the honest disabled-model fallback notice. Backend
   * emits `model_disabled_fallback` on the run stream (naming BOTH the disabled model and
   * the org-default fallback) when the user's selected model was operator-DISABLED. Pre-fix
   * the frontend had NO handler → the event was dropped and the user saw a SILENT swap (the
   * UAT Test-7 root cause). The handler stamps `modelFallbackNotice` on the assistant message
   * so MessageItem renders an inline notice. Informational only — carries no terminal state. */
  onModelDisabledFallback?: (disabledModel: string, fallbackModel: string, message: string) => void
  /** Phase 067.1 Plan 04: skill description hint from skill_loaded follow-up SSE event.
   * Fires AFTER skill_activated when the skill row's description column is non-empty. */
  onSkillLoaded?: (skillName: string, description: string) => void
  onCodeExecutionStart?: (codePreview: string) => void
  /** Phase 067.4 R-5 (D-067.4-R5-01 amended): heartbeat tick during sandbox execution.
   * Backend emits `code_executing` SSE every ~1 s carrying tool_index + elapsed_seconds;
   * the hook handler updates tool_calls[N].elapsedSeconds for the matching execute_code
   * tool with status==='running'. Strictly additive — does NOT replace post-completion
   * line emit (`onCodeStdout` / `onCodeStderr` still fire after `code_execution_complete`). */
  onCodeExecuting?: (toolIndex: number, elapsedSeconds: number, phase?: string) => void
  onCodeStdout?: (content: string) => void
  onCodeStderr?: (content: string) => void
  onCodeExecutionComplete?: (
    exitCode: number,
    durationMs: number,
    outputFiles: OutputFile[],
    error?: string,
    /** WR-02 (176): present only when the run was auto-healed (missing module
     * installed + code re-run). The re-run streams NO code_stdout/code_stderr
     * deltas, so the live card still holds the pre-heal error text; when set, the
     * client replaces the streamed outputLines with this healed run of record. */
    healed?: { stdout: string; stderr: string },
  ) => void
  /** Phase 075.1 Plan 04 Atom E (B-260519-11 + BUG-260514-01): cumulative
   * sandbox-output file list emitted after the agent loop terminates.
   * StreamsProvider stores this on the assistant message as
   * `finalOutputFiles`; MessageItem renders the pinned "Final outputs"
   * panel below the per-cell delta panels. Backend wire event type is
   * `final_output_files`. Payload shape: { filename: string; url?: string }[]. */
  onFinalOutputFiles?: (files: { filename: string; url?: string; size?: number; is_hero?: boolean }[]) => void
  onSources?: (sources: SourceReference[]) => void
  onCitations?: (citations: Citation[]) => void
  onConfidence?: (
    level: "high" | "medium" | "low",
    avgSimilarity: number,
    disclaimer: string | null,
  ) => void
  onSuggestions?: (questions: string[]) => void
  onPlanning?: (iteration: number) => void
  onIterationStart?: (iteration: number) => void
  onFallbackModel?: (originalModel: string, fallbackModel: string) => void
  /** Phase 092 (CONT-01 / D-07) — NON-terminal `cap_paused` SSE event. The
   *  iteration cap fired WITH buffered tool calls; the run is paused (NOT
   *  terminal) and a Continue card should appear. Delivered out-of-band (the
   *  durable carrier row is a role='system' message filtered from /messages —
   *  BUG-260528-01), so the consumer renders the Continue affordance from this
   *  callback + the mount-time getThreadWorkflow reconcile. */
  onCapPaused?: (info: {
    runId: string
    toolNames: string[]
    continuesUsed: number
    continuesRemaining: number
  }) => void
  // ──────────────────────────────────────────────────────────────────────────
  // Phase 086 Plan 01 (PANEL-05) — agent-panel SSE callbacks. The 6 new event
  // types (Phases 084/085) demux to these. Field names are VERIFIED against
  // the emit sites (086-01-PLAN <interfaces>). The sub_agent_start/done bookends
  // route here ONLY when `parsed.sub_run_id != null` (TASK variant — D-086-06);
  // the legacy analyze_document path keeps its byte-identical onSubAgentStart/
  // onSubAgentDone call below.
  // ──────────────────────────────────────────────────────────────────────────
  /** todo_updated SSE — FULL canonical todo list (full-state-replace). */
  onTodoUpdated?: (todos: Todo[]) => void
  /** workspace_file_written SSE — built from the FLAT payload (carries
   *  id/path/version/size_bytes/mime_type; Phase 088-05 D-16 added `id`). The
   *  store keys by `path`, but the `id` is now threaded through so the live panel
   *  can fetch content/versions/diff without a refresh. */
  onWorkspaceFileWritten?: (file: WorkspaceFile) => void
  /** workspace_file_deleted SSE — removal keyed by `path`. */
  onWorkspaceFileDeleted?: (path: string) => void
  /** ask_user_prompt SSE — built from the FLAT payload (identity key
   *  `tool_call_id`; no message_id/run_id/created_at on the SSE). */
  onAskUserPrompt?: (ask: PendingAsk) => void
  /** ask_user_response SSE — removal keyed by `tool_call_id`. */
  onAskUserResponse?: (toolCallId: string) => void
  /** sub_agent_start TASK variant (has sub_run_id) — distinct from the legacy
   *  analyze_document onSubAgentStart 2-arg path. */
  onTaskStart?: (subRunId: string, description: string, tools: string[], maxSteps: number) => void
  /** sub_agent_done TASK variant (has sub_run_id) — distinct from the legacy
   *  analyze_document onSubAgentDone no-arg path. */
  onTaskDone?: (subRunId: string, status: string, summary: string) => void
  // ──────────────────────────────────────────────────────────────────────────
  // Phase 094 Plan 02 (PANEL-08 / PANEL-09) — harness phase-lifecycle SSE
  // callbacks. The 6 new event types (phase_started / phase_completed /
  // phase_transition / gate_failed / run_failed / run_completed) are
  // wire-emitted by harness_engine.py (FLAT fields, verified) but DROPPED today
  // (api.ts had ZERO phase branches). They demux to these panel-only callbacks
  // → a new phasesByThread store slice. ADDITIVE ONLY: the dispatch branches sit
  // AFTER the Deep switch (cap_paused) and carry NO `return` (cursor-advance
  // still fires), so every Deep branch stays byte-identical. Provider-agnostic
  // (honest producer events; no provider branching). Mirror the onCapPaused
  // typed-object shape.
  // ──────────────────────────────────────────────────────────────────────────
  /** phase_started SSE — a phase begins (FLAT phase/phase_index/phase_type). */
  onPhaseStarted?: (p: { phase: string; phaseIndex: number; phaseType: string }) => void
  /** phase_completed SSE — a phase finished (FLAT phase/phase_index). */
  onPhaseCompleted?: (phase: string, phaseIndex: number) => void
  /** 101.1 review WR-01: phase_failed SSE — a phase ended FAILED (an honest emit
   *  failure flipped workflow_phases.status='failed'; the engine no longer emits
   *  phase_completed for it). FLAT phase/phase_index/failure. Panel-only — the
   *  handler writes phasesByThread, never bucketsBySurface. */
  onPhaseFailed?: (phase: string, phaseIndex: number, failure?: string) => void
  /** 189 review CR-02: phase_recorded_not_sent SSE — a governed external-action phase
   *  RECORDED the action it intended to take and sent nothing
   *  (`workflow_phases.status='recorded_not_sent'`; the engine emits no phase_completed
   *  for it). Without this event the card never left `running` and BOTH store sweeps
   *  upgraded it to `done`, so the live surface printed "✓ Complete" for the one step
   *  whose whole point is that it did not complete — while a reload showed "Not sent".
   *  FLAT phase/phase_index. Panel-only — the handler writes phasesByThread, never
   *  bucketsBySurface. */
  onPhaseRecordedNotSent?: (phase: string, phaseIndex: number) => void
  /** phase_transition SSE — moved between phases (FLAT from_phase/to_phase/via;
   *  via==="skip_to_phase" marks the from-phase skipped). */
  onPhaseTransition?: (from: string, to: string, via: string) => void
  /** gate_failed SSE — a validation gate failed (FLAT phase/attempt/error). A
   *  non-terminal attempt → retrying; a terminal one precedes run_failed. */
  onGateFailed?: (g: { phase: string; attempt: number; error: string }) => void
  /** run_failed SSE — the run failed (FLAT reason; may be empty → reason_unknown). */
  onRunFailed?: (reason?: string) => void
  /** run_completed SSE — the run finished (FLAT status; the done phase already
   *  flipped via phase_completed — no-op on phase status). */
  onRunCompleted?: (status?: string) => void
  /** Phase 101.1-09 (gap 6 / GAP-C / D-11): phase_substep SSE — a discrete emit
   *  sub-step (forcing → emitting → [recovering] → validating → rendering →
   *  validated) OR a terminal emit failure. The backend emits all 12 via
   *  _emit_phase_substep (phase_types.py); Plan 04 shipped the PhaseCard render
   *  contract but deferred this demux (the G-5 StreamsProvider hot file). FLAT
   *  payload {phase, phase_index, status?, failure?}. Panel-only (writes
   *  phasesByThread); the branch carries NO return (cursor still advances). */
  onPhaseSubstep?: (p: { phase: string; phaseIndex: number; status?: EmitSubStep; failure?: EmitFailure }) => void
  /** Phase 133 Plan 05 (EVAL-02) — eval-runner progress events on the reused
   *  run-stream client (Pattern 3 — the eval run wrote a companion public.runs
   *  row, so the existing chat-run reattach machinery carries these). NON-terminal
   *  progress (no `return`); the run still closes with a single chat terminal
   *  AFTER eval_complete. Payloads are FLAT (eval_runner_service.py:
   *  {test_case_id, variant} / {test_case_id, variant, status} / {status}).
   *  Panel-only, provider-agnostic — the Deep dispatch above is byte-identical. */
  onEvalCaseStarted?: (p: { testCaseId: string; variant: string }) => void
  onEvalCaseDone?: (p: { testCaseId: string; variant: string; status: string }) => void
  onEvalComplete?: (p: { status: string }) => void
  /** Phase 134 Plan 04 (EVAL-03) — additive live verdict event, emitted after the
   *  independent judge grades an arm (D-05). FLAT payload {test_case_id, variant,
   *  verdict_state, verdict_passed}. Optional live reflection only — the durable
   *  readout (getEvalRun on onEvalComplete/terminal) stays authoritative. Sits with
   *  the other additive eval branches: NON-terminal (no `return`, cursor advances),
   *  Deep/harness dispatch untouched (Pattern 3). */
  onEvalVerdict?: (p: {
    testCaseId: string
    variant: string
    verdictState: string
    verdictPassed: boolean | null
  }) => void
  /**
   * Phase 063.1 (D-063.1-01/02): per-event Redis Stream cursor advancement.
   * Fires AFTER each successfully-dispatched `data:` event with the most
   * recent SSE `id:` line value (e.g. "1234567890-0"). The hook layer stores
   * this in `lastSeenOffsetRef.current` keyed by run_id so the next reconcile
   * cycle can call `subscribeToRun(runId, lastSeenOffsetRef.current.get(runId)
   * ?? "0", ...)` instead of replaying the entire stream from offset 0.
   *
   * If no `id:` line precedes a `data:` event (legacy frames), this callback
   * is NOT invoked — the cursor never advances on cursor-less events.
   */
  onCursor?: (msId: string) => void
}

/** Phase 063 (D-063-01): POST a new chat message. Returns synchronously with
 * the inserted user_message id and the Redis Stream run_id; the caller then
 * opens GET /runs/{run_id}/stream?since=0 via subscribeToRun() for tokens.
 * Replaces the legacy POST-and-stream-in-one orchestrator.
 */
export async function postMessage(
  threadId: string,
  content: string,
  options: {
    model?: string
    provider?: string
    agentMode?: string
    /** Phase 092 (MODE-01 / D-02) — when set, this send is a Harness kickoff:
     *  the backend atomically creates a workflow run (create_workflow_run) and
     *  the producer drives run_workflow instead of the Deep agent loop. Only
     *  sent when a workflow is picked — a Deep send omits it (byte-identical). */
    workflowDefinitionId?: string
    /** Phase 152 (WFIN-02 / D-01) — a per-run KB-folder retrieval OVERRIDE for a
     *  Harness kickoff. Travels as `folder_id` in the create_workflow_run.inputs
     *  jsonb (MessageCreate.folder_id, Plan 01); the server owner-gates it (D-05)
     *  and layers it over the definition's author default. Only sent when the Run
     *  modal picks a folder that differs from the workflow default — absence is the
     *  byte-identical D-06 path (no override → the author default / whole-KB). */
    folderId?: string | null
  } = {},
): Promise<PostMessageResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content,
      model: options.model,
      provider: options.provider,
      agent_mode: options.agentMode ?? "default",
      // D-02: include the kickoff field only when a workflow is selected.
      ...(options.workflowDefinitionId
        ? { workflow_definition_id: options.workflowDefinitionId }
        : {}),
      // WFIN-02 (D-01): additive — same shape as workflow_definition_id. Only sent
      // when a per-run folder override is present; absence = D-06 (author default).
      ...(options.folderId ? { folder_id: options.folderId } : {}),
    }),
  })
  // 092-06 (F3): preserve the HTTP status so a 409 lock-refusal is
  // distinguishable in StreamsProvider.sendMessage's catch (roll back both
  // optimistic bubbles + surface a per-thread error instead of leaving ghosts).
  // 099-08 (UAT L10 fix): read the body BEFORE throwing so FastAPI's {detail}
  // (the actionable gate message, e.g. a disabled skill_ref) survives. The
  // downstream 409 branch matches on status and overrides this message with
  // fixed copy → byte-equivalent for 409. Generic fallback when no string
  // detail (unparseable body, or detail is a non-string FastAPI validation array).
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    throw new ApiError(
      typeof body?.detail === "string" ? body.detail : "Failed to send message",
      res.status,
    )
  }
  return (await res.json()) as PostMessageResponse
}

/** Phase 063 (D-063-02): open GET /runs/{runId}/stream?since={since} and
 * dispatch SSE events to callbacks. `since` is always "0" per D-063-02 (full
 * replay is idempotent — React reconciliation handles duplicate setMessages
 * with identical content as a no-op). Same parser as the legacy POST-stream
 * (wire format byte-identical per Phase 062 D-062-05).
 *
 * Bearer auth attaches via getAuthHeaders / fetch — the native EventSource
 * API cannot send custom headers (WHATWG html#2177) and was rejected as an
 * anti-pattern in 063-RESEARCH.
 *
 * Error/terminal handling:
 *   - 404 → onTerminal('error', 'run_not_found') and return (cross-user or expired)
 *   - 503 → onTerminal('error', 'streaming_unavailable') and return (Redis down per D-062-13)
 *   - non-OK other → throws Error
 *   - SSE event {type:'error', error: ...} → onTerminal('error', error) and return
 *   - SSE event {type:'cancelled'} → onTerminal('cancelled') and return (NEW vs legacy POST-stream)
 *   - SSE event {type:'done'} → fires onDone() once; stream stays open for suggestions
 *   - SSE event {type:'stream_end'} → onTerminal('done') and return
 *   - AbortError on reader.read() → silent return (caller-initiated cancel via signal)
 *   - Reader closes without explicit terminal → defensive onTerminal('reader_done')
 *     (Phase 075.1 Plan 01: was 'done' pre-Plan-01; consumer-side widened
 *     transient filter probes /snapshot on 'reader_done' so a still-streaming
 *     run can re-attach instead of being mis-flipped to 'completed'.)
 */
export async function subscribeToRun(
  runId: string,
  since: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/runs/${runId}/stream?since=${encodeURIComponent(since)}`
  const res = await fetch(url, { headers, signal })

  if (res.status === 404) {
    callbacks.onTerminal("error", "run_not_found")
    return
  }
  if (res.status === 503) {
    callbacks.onTerminal("error", "streaming_unavailable")
    return
  }
  if (!res.ok) throw new Error(`Failed to open run stream (status ${res.status})`)
  if (!res.body) throw new Error("No response body on run stream")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let doneFired = false
  // Phase 063.1 (D-063.1-01/02): track the most recent Redis Stream `id:` line
  // seen in the wire. Reset to undefined after each data: event dispatch so
  // legacy frames without an id: prefix don't bleed cursor values from the
  // previous event. See onCursor docstring on StreamCallbacks for the cursor
  // advancement contract.
  let lastEventId: string | undefined

  while (true) {
    let done: boolean, value: Uint8Array | undefined
    try {
      ;({ done, value } = await reader.read())
    } catch (err) {
      // AbortError means caller-initiated cancel via signal — silent return
      if (err instanceof Error && err.name === "AbortError") return
      throw err
    }
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line.startsWith("id: ")) {
        // Phase 063.1: capture Redis Stream entry id; consumed by onCursor
        // after the matching `data:` line is dispatched below. Trim handles
        // both LF and CRLF wire formats.
        lastEventId = line.slice(4).trim()
        continue
      }
      if (!line.startsWith("data: ")) continue
      const raw = line.slice(6).trim()
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const t = parsed.type as string

        if (t === "delta") callbacks.onDelta(parsed.content as string)
        else if (t === "reasoning_delta" && callbacks.onReasoningDelta)
          callbacks.onReasoningDelta(parsed.content as string)
        else if (t === "title" && callbacks.onTitleUpdate)
          callbacks.onTitleUpdate(parsed.content as string)
        else if (t === "tool_preparing" && callbacks.onToolPreparing)
          callbacks.onToolPreparing(parsed.name as string, parsed.index as number)
        else if (t === "tool_start" && callbacks.onToolStart)
          callbacks.onToolStart(parsed.name as string, parsed.args as Record<string, string>)
        else if (t === "tool_args_progress" && callbacks.onToolArgsProgress)
          callbacks.onToolArgsProgress(
            parsed.tool_index as number,
            parsed.name as string,
            parsed.total_args_bytes_so_far as number,
            // 075.6 Plan 02 / Req #5: Plan 01 backend ships the FULL cumulative
            // args string here (NOT the 5 KB tail — that's `args_so_far`).
            // Undefined for pre-Plan-01 wire events (backward compat).
            parsed.code_so_far as string | undefined,
          )
        else if (t === "tool_end" && callbacks.onToolEnd)
          callbacks.onToolEnd(parsed.name as string, parsed.result as string | undefined)
        // Phase 086 Plan 01 (D-086-06): payload-shape branch. The TASK variant
        // (task_service.py) carries `sub_run_id`; the LEGACY analyze_document
        // variant (tool_dispatcher.py) does NOT. `parsed.sub_run_id != null` is
        // the SOLE discriminator. The legacy call expression is preserved
        // BYTE-IDENTICAL (failure mode #3/#4 — cross-provider safety).
        else if (t === "sub_agent_start") {
          if (parsed.sub_run_id != null)
            callbacks.onTaskStart?.(
              parsed.sub_run_id as string,
              parsed.description as string,
              parsed.tools as string[],
              parsed.max_steps as number,
            )
          else if (callbacks.onSubAgentStart)
            callbacks.onSubAgentStart(parsed.filename as string, parsed.task as string)
        } else if (t === "sub_agent_delta" && callbacks.onSubAgentDelta)
          callbacks.onSubAgentDelta(parsed.content as string)
        else if (t === "sub_agent_done") {
          if (parsed.sub_run_id != null)
            callbacks.onTaskDone?.(
              parsed.sub_run_id as string,
              parsed.status as string,
              parsed.summary as string,
            )
          else if (callbacks.onSubAgentDone)
            callbacks.onSubAgentDone()
        }
        else if (t === "skill_activated" && callbacks.onSkillActivated)
          callbacks.onSkillActivated(parsed.skill_name as string)
        // Phase 149 Plan 09 (D-149-10): the honest disabled-model fallback notice.
        // Informational branch (mirrors skill_activated) — carries NO `return`, so the
        // cursor-advance below still fires. Pre-fix this event fell through the ladder and
        // was silently dropped (the UAT Test-7 silent-swap root cause).
        else if (t === "model_disabled_fallback" && callbacks.onModelDisabledFallback)
          callbacks.onModelDisabledFallback(
            parsed.disabled_model as string,
            parsed.fallback_model as string,
            parsed.message as string,
          )
        else if (t === "skill_loaded" && callbacks.onSkillLoaded)
          callbacks.onSkillLoaded(parsed.skill_name as string, parsed.description as string)
        else if (t === "code_execution_start" && callbacks.onCodeExecutionStart)
          callbacks.onCodeExecutionStart(parsed.code_preview as string)
        // Phase 067.4 R-5 (D-067.4-R5-01 amended): code_executing heartbeat —
        // backend emits ~every 1 s during sandbox execution carrying tool_index
        // + elapsed_seconds. Inserted before code_stdout to keep heartbeat dispatch
        // contiguous with execution-lifecycle events.
        else if (t === "code_executing" && callbacks.onCodeExecuting)
          callbacks.onCodeExecuting(parsed.tool_index as number, parsed.elapsed_seconds as number, parsed.phase as string | undefined)
        else if (t === "code_stdout" && callbacks.onCodeStdout)
          callbacks.onCodeStdout(parsed.content as string)
        else if (t === "code_stderr" && callbacks.onCodeStderr)
          callbacks.onCodeStderr(parsed.content as string)
        else if (t === "code_execution_complete" && callbacks.onCodeExecutionComplete)
          callbacks.onCodeExecutionComplete(
            parsed.exit_code as number,
            parsed.duration_ms as number,
            (parsed.output_files ?? []) as OutputFile[],
            parsed.error as string | undefined,
            // WR-02 (176): healed re-run's authoritative output, present only when the
            // backend auto-healed a missing module and re-ran the code.
            parsed.healed
              ? {
                  stdout: (parsed.stdout as string | undefined) ?? "",
                  stderr: (parsed.stderr as string | undefined) ?? "",
                }
              : undefined,
          )
        // Phase 075.1 Plan 04 Atom E (B-260519-11 + BUG-260514-01) —
        // cumulative final-outputs panel. Backend emits exactly one
        // `final_output_files` event after the agent loop terminates,
        // carrying the cumulative filename set from _previous_files_in_run.
        // The reducer in StreamsProvider stamps it on the assistant message
        // as `finalOutputFiles`; MessageItem renders the pinned panel.
        else if (t === "final_output_files" && callbacks.onFinalOutputFiles)
          // Phase 095 Plan 05 (D-08): the additive `is_hero` field flows through
          // untouched as an extra key on each file dict — no dispatch change.
          callbacks.onFinalOutputFiles(
            (parsed.files ?? []) as { filename: string; url?: string; size?: number; is_hero?: boolean }[],
          )
        else if (t === "sources" && callbacks.onSources)
          callbacks.onSources((parsed.sources ?? []) as SourceReference[])
        else if (t === "citations" && callbacks.onCitations)
          callbacks.onCitations((parsed.citations ?? []) as Citation[])
        else if (t === "confidence" && callbacks.onConfidence)
          callbacks.onConfidence(
            parsed.level as "high" | "medium" | "low",
            parsed.avg_similarity as number,
            parsed.disclaimer as string | null,
          )
        // Phase 086 Plan 01 (PANEL-05, PATTERNS §4): 4 plain panel-event
        // branches. They sit ABOVE the terminal `done` branch and carry NO
        // `return` so the cursor-advance block at the bottom still fires
        // (cursor-advance safety). Field names are read from the FLAT SSE
        // payloads verbatim (parsed.todos / parsed.path / parsed.tool_call_id —
        // NOT parsed.file / parsed.file_id / parsed.ask_id).
        else if (t === "todo_updated" && callbacks.onTodoUpdated)
          callbacks.onTodoUpdated((parsed.todos ?? []) as Todo[])
        else if (t === "workspace_file_written" && callbacks.onWorkspaceFileWritten)
          // FLAT payload — build the WorkspaceFile from id/path/version/size_bytes/
          // mime_type (the SSE has no nested `file`; store keys by path). Phase
          // 088-05 (D-16): thread the persisted row `id` through so the live panel
          // fetches content/versions/diff by id (no refresh). `id` may be undefined
          // on a legacy/replayed event — left optional; the store preserves a known
          // id and the select→fetch path reconciles-by-GET if it's ever missing.
          callbacks.onWorkspaceFileWritten({
            id: parsed.id as string | undefined,
            path: parsed.path as string,
            version: parsed.version as number | undefined,
            size_bytes: parsed.size_bytes as number,
            mime_type: parsed.mime_type as string,
          })
        else if (t === "workspace_file_deleted" && callbacks.onWorkspaceFileDeleted)
          callbacks.onWorkspaceFileDeleted(parsed.path as string)
        else if (t === "ask_user_prompt" && callbacks.onAskUserPrompt)
          // FLAT payload — identity key tool_call_id; message_id/run_id/created_at
          // exist only on the GET, not the SSE.
          callbacks.onAskUserPrompt({
            tool_call_id: parsed.tool_call_id as string,
            prompt: parsed.prompt as string,
            options: (parsed.options ?? []) as string[],
            // Phase 185: `null` = no deadline (the armed action-risk checkpoint).
            timeout_seconds: parsed.timeout_seconds as number | null,
            // D-12 (Phase 093): additive — the prior-phase draft the user confirms.
            // Optional; absent on older streams → undefined (harmless).
            draft: parsed.draft as string | undefined,
          })
        else if (t === "ask_user_response" && callbacks.onAskUserResponse)
          callbacks.onAskUserResponse(parsed.tool_call_id as string)
        else if (t === "done") {
          if (!doneFired) {
            doneFired = true
            callbacks.onDone()
          }
        } else if (t === "suggestions" && callbacks.onSuggestions) {
          callbacks.onSuggestions((parsed.questions ?? []) as string[])
        } else if (t === "stream_end") {
          callbacks.onTerminal("done")
          return
        } else if (t === "error") {
          // Phase 075 D-075-13: buffer_expired_* errors stay terminal at the
          // api.ts layer (faithful SSE-to-callback bridge). The
          // transient/recoverable decision is made in the StreamsProvider
          // onTerminal consumer (075-PATTERNS.md §12 — consumer-side
          // layering chosen over api.ts remap). The full error payload
          // (including the new D-075-13 recently_active + runs_status
          // discriminator fields) is passed through verbatim as the
          // parsed.error string so the consumer can inspect it.
          callbacks.onTerminal("error", (parsed.error ?? parsed.message) as string | undefined)
          return
        } else if (t === "timed_out") {
          // Phase 066 D-066-06: distinct system-timeout terminal sentinel —
          // wire-format value matches backend `_RUN_STATUS_TO_TERMINAL_TYPE`
          // map at threads.py:90-94 (Plan 01). The `error` payload is the
          // backend-formatted string (D-066-07: "timed_out: Ns per-call ...");
          // not displayed to the user (banner uses static "Agent reached time
          // limit" copy per D-066-10 / T-066-10) but passed through to the
          // hook layer for debugging if needed.
          callbacks.onTerminal("timed_out", parsed.error as string | undefined)
          return
        } else if (t === "cancelled") {
          callbacks.onTerminal("cancelled")
          return
        } else if (t === "planning" && callbacks.onPlanning) {
          callbacks.onPlanning(parsed.iteration as number)
        } else if (t === "iteration_start" && callbacks.onIterationStart) {
          callbacks.onIterationStart(parsed.iteration as number)
        } else if (t === "fallback_model" && callbacks.onFallbackModel) {
          callbacks.onFallbackModel(
            parsed.original_model as string,
            parsed.fallback_model as string,
          )
        } else if (t === "cap_paused" && callbacks.onCapPaused) {
          // Phase 092 (CONT-01 / D-07) — NON-terminal pause. NOT a terminal
          // sentinel (Landmine 6): the stream stays attachable for Continue.
          // Mirror the fallback_model branch (no `return`).
          callbacks.onCapPaused({
            runId,
            toolNames: (parsed.tool_names ?? []) as string[],
            continuesUsed: (parsed.continues_used ?? 0) as number,
            continuesRemaining: (parsed.continues_remaining ?? 0) as number,
          })
        }
        // ──────────────────────────────────────────────────────────────────
        // Phase 094 Plan 02 (PANEL-08/09) — additive harness phase-lifecycle
        // branches. These are the LAST else-if branches of the switch, AFTER
        // cap_paused and BEFORE the cursor-advance block (676-679). They read
        // the FLAT producer payload verbatim (harness_engine.py: phase /
        // phase_index / phase_type / attempt / error / reason / from_phase /
        // to_phase / via / status) and carry NO `return` — so the cursor-advance
        // still fires, exactly like todo_updated / cap_paused. The Deep dispatch
        // above (delta / reasoning_delta / tool_* / sub_agent_* / code_* /
        // sources / citations / confidence / ask_user_* / the terminal sentinels
        // / planning / iteration_start / fallback_model / cap_paused) is
        // BYTE-IDENTICAL — none of these new branches touches it. Panel-only,
        // provider-agnostic.
        else if (t === "phase_started" && callbacks.onPhaseStarted)
          callbacks.onPhaseStarted({
            phase: parsed.phase as string,
            phaseIndex: parsed.phase_index as number,
            phaseType: parsed.phase_type as string,
          })
        else if (t === "phase_completed" && callbacks.onPhaseCompleted)
          callbacks.onPhaseCompleted(parsed.phase as string, parsed.phase_index as number)
        // 101.1 review WR-01: a phase that ended FAILED gets its own event (the
        // engine no longer emits phase_completed for it). NO return (cursor still
        // advances, exactly like phase_completed). Panel-only.
        else if (t === "phase_failed" && callbacks.onPhaseFailed)
          callbacks.onPhaseFailed(
            parsed.phase as string,
            parsed.phase_index as number,
            parsed.failure as string | undefined,
          )
        // 189 review CR-02: a governed external-action phase that RECORDED and sent
        // nothing gets its own event (the engine emits no phase_completed for it, and
        // emitting nothing left the card `running` for both sweeps to paint `done`).
        // NO return (cursor still advances, exactly like phase_failed). Panel-only.
        else if (t === "phase_recorded_not_sent" && callbacks.onPhaseRecordedNotSent)
          callbacks.onPhaseRecordedNotSent(
            parsed.phase as string,
            parsed.phase_index as number,
          )
        else if (t === "phase_transition" && callbacks.onPhaseTransition)
          callbacks.onPhaseTransition(
            parsed.from_phase as string,
            parsed.to_phase as string,
            parsed.via as string,
          )
        else if (t === "gate_failed" && callbacks.onGateFailed)
          callbacks.onGateFailed({
            phase: parsed.phase as string,
            attempt: parsed.attempt as number,
            error: parsed.error as string,
          })
        else if (t === "run_failed" && callbacks.onRunFailed)
          callbacks.onRunFailed(parsed.reason as string | undefined)
        else if (t === "run_completed" && callbacks.onRunCompleted)
          callbacks.onRunCompleted(parsed.status as string | undefined)
        // Phase 101.1-09 (gap 6): the phase_substep branch Plan 04 deferred.
        // Reads the FLAT payload verbatim (parsed.phase / phase_index / status /
        // failure); NO return (cursor still advances, exactly like phase_started).
        // Panel-only — the callback writes phasesByThread, never bucketsBySurface.
        else if (t === "phase_substep" && callbacks.onPhaseSubstep)
          callbacks.onPhaseSubstep({
            phase: parsed.phase as string,
            phaseIndex: parsed.phase_index as number,
            status: parsed.status as EmitSubStep | undefined,
            failure: parsed.failure as EmitFailure | undefined,
          })
        // Phase 133 Plan 05 (EVAL-02) — eval-runner progress branches. They sit
        // with the other additive panel-event branches (NO return → cursor still
        // advances) and read the FLAT eval_runner_service payloads verbatim. The
        // Deep/harness dispatch above is untouched (Pattern 3 — these ride the
        // reused run-stream client for free via the companion runs row).
        else if (t === "eval_case_started" && callbacks.onEvalCaseStarted)
          callbacks.onEvalCaseStarted({
            testCaseId: parsed.test_case_id as string,
            variant: parsed.variant as string,
          })
        else if (t === "eval_case_done" && callbacks.onEvalCaseDone)
          callbacks.onEvalCaseDone({
            testCaseId: parsed.test_case_id as string,
            variant: parsed.variant as string,
            status: parsed.status as string,
          })
        else if (t === "eval_complete" && callbacks.onEvalComplete)
          callbacks.onEvalComplete({ status: parsed.status as string })
        // Phase 134 Plan 04 (EVAL-03) — additive live verdict branch. Reads the FLAT
        // eval_runner_service payload verbatim (parsed.test_case_id / variant /
        // verdict_state / verdict_passed). NON-terminal → NO return (cursor still
        // advances, exactly like eval_case_done above); the Deep/harness dispatch is
        // untouched. Durable readout remains authoritative (T-134-13).
        else if (t === "eval_verdict" && callbacks.onEvalVerdict)
          callbacks.onEvalVerdict({
            testCaseId: parsed.test_case_id as string,
            variant: parsed.variant as string,
            verdictState: parsed.verdict_state as string,
            verdictPassed: parsed.verdict_passed as boolean | null,
          })

        // Phase 063.1 (D-063.1-01/02): cursor advancement fires AFTER the
        // type-specific callback so the consumer's lastSeenOffsetRef only
        // advances once the event content has been committed to state. We
        // skip terminal branches above (stream_end / error / cancelled)
        // because they `return` directly — the cursor is irrelevant once
        // the run has ended. Reset lastEventId so a subsequent cursor-less
        // data: line doesn't double-fire onCursor with a stale id.
        if (lastEventId !== undefined && callbacks.onCursor) {
          callbacks.onCursor(lastEventId)
        }
        lastEventId = undefined
      } catch (parseErr) {
        // WR-02 fix: log malformed lines so a backend wire-format regression
        // is at least visible in the console (legacy code silently dropped).
        console.warn("subscribeToRun: malformed SSE line", { raw, parseErr })
        // WR-05 fix: reset lastEventId on parse failure too. Otherwise, a
        // malformed `data:` frame following a valid `id:` line would leave
        // lastEventId set; the NEXT well-formed data event would then fire
        // onCursor with the WRONG (stale) id, advancing the consumer's
        // lastSeenOffsetRef past events that were never dispatched. The
        // next reconcile reattach would skip those events. Pair the reset
        // with the success-path reset directly above so cursor advancement
        // is symmetric across success and failure branches.
        lastEventId = undefined
      }
    }
  }

  // Defensive: reader closed without explicit terminal SSE event.
  // Phase 075.1 Plan 01: surface this as `reader_done` instead of `done` so
  // the StreamsProvider widened transient filter can probe /snapshot before
  // flipping runStatus to "completed". Pre-Plan-01 this fell through silently
  // — if the backend run was still streaming (e.g., the SSE wire was killed
  // by a transient network blip), the UI showed "Running code" until F5.
  callbacks.onTerminal("reader_done")
}

/** Phase 063 / Phase 062 contract: list streaming runs the requesting user
 * owns on the given thread. Empty array when nothing is in flight. RLS+
 * defense-in-depth filtered server-side; cross-user → 404 (D-062-12).
 */
export async function getActiveRuns(
  threadId: string,
  signal?: AbortSignal,
): Promise<ActiveRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/active-runs`, {
    headers,
    signal,
  })
  if (!res.ok) throw new Error("Failed to list active runs")
  return (await res.json()) as ActiveRun[]
}

/** Phase 075 D-075-01 + D-075-02: one-round-trip reconcile primitive.
 *
 * Replaces the parallel Promise.all([getActiveRuns, loadMessages]) at
 * StreamsProvider.reconcile (tsx:478-485) with a single fetch. Server-derived
 * since_cursors seed lastSeenOffsetRef on first attach (existing client
 * cursors win on subsequent reconciles per D-075-01). getMessages and
 * getActiveRuns stay exported (used outside the reconcile hot path per
 * D-075-02 — no removal).
 *
 * Backend returns 404 on cross-user (T-062-01) and 503 + Retry-After: 10 on
 * Redis-down (D-062-13). Both surface as a generic Error to the caller; the
 * StreamsProvider consumer routes via its existing error handler.
 */
export async function getSnapshot(
  threadId: string,
  signal?: AbortSignal,
): Promise<ThreadSnapshot> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/snapshot`, {
    headers,
    signal,
  })
  if (!res.ok) throw new Error(`Failed to fetch snapshot (status ${res.status})`)
  const data = (await res.json()) as {
    messages: MessageResponseDTO[]
    active_runs: ActiveRun[]
    since_cursors: Record<string, string>
  }
  return {
    messages: data.messages.map(_mapMessageResponse),
    active_runs: data.active_runs,
    since_cursors: data.since_cursors,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 086 Plan 01 (PANEL-05): 4 agent-panel GET helpers for thread-switch
// reconcile. Each mirrors getActiveRuns verbatim — getAuthHeaders() + fetch
// with optional AbortSignal + non-OK throw — and reuses the existing fetch
// stack (NO new fetch library). The backend already reshapes (panel.py:67 maps
// todo_id -> id) so no client mapper is needed; cast the JSON to the typed array.
// ────────────────────────────────────────────────────────────────────────────

/** GET /threads/{tid}/todos (panel.py:67). Returns the thread's full todo list. */
export async function getThreadTodos(
  threadId: string,
  signal?: AbortSignal,
): Promise<Todo[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/todos`, { headers, signal })
  if (!res.ok) throw new Error("Failed to list thread todos")
  return (await res.json()) as Todo[]
}

/** GET /threads/{tid}/workspace/files (workspace.py:99). Returns the workspace
 *  file index for the thread. */
export async function getThreadWorkspaceFiles(
  threadId: string,
  signal?: AbortSignal,
): Promise<WorkspaceFile[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files`, { headers, signal })
  if (!res.ok) throw new Error("Failed to list workspace files")
  return (await res.json()) as WorkspaceFile[]
}

/** GET /threads/{tid}/ask_user/pending (panel.py:103). Returns the thread's
 *  outstanding ask_user prompts. */
export async function getThreadPendingAsks(
  threadId: string,
  signal?: AbortSignal,
): Promise<PendingAsk[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/ask_user/pending`, { headers, signal })
  if (!res.ok) throw new Error("Failed to list pending asks")
  return (await res.json()) as PendingAsk[]
}

/** GET /threads/{tid}/tasks (panel.py:156). Returns the thread's sub-agent task
 *  run index. */
export async function getThreadTasks(
  threadId: string,
  signal?: AbortSignal,
): Promise<TaskRunIndexItem[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/tasks`, { headers, signal })
  if (!res.ok) throw new Error("Failed to list thread tasks")
  return (await res.json()) as TaskRunIndexItem[]
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 087 Plan 01 (PANEL-03/04/07): 3 workspace file GET helpers + the
// ask_user answer POST. Each mirrors the Phase 086 GET helper shape verbatim —
// getAuthHeaders() + fetch with optional AbortSignal + non-OK throw — and reuses
// the existing fetch stack (NO new fetch library). The backend already shapes
// the JSON (workspace.py two-shape content + difflib unified-diff string), so no
// client mapper is needed; cast the JSON to the typed shape. Routes VERIFIED
// against workspace.py:124-323 / runs.py:496.
// ────────────────────────────────────────────────────────────────────────────

/** GET /threads/{tid}/workspace/files/{id}/content (workspace.py:124). Returns
 *  the two-shape content payload: inline (text) or bucket (signed_url, 60s TTL,
 *  may be null). FilePreview routes on `storage_type` (D-02). */
export async function getWorkspaceFileContent(
  threadId: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<WorkspaceFileContent> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/content`,
    { headers, signal },
  )
  if (!res.ok) throw new Error("Failed to fetch workspace file content")
  return (await res.json()) as WorkspaceFileContent
}

/** GET /threads/{tid}/workspace/files/{id}/versions (workspace.py:202). Returns
 *  the file's version rows sorted version DESC — feeds the red-base/green-target
 *  version picker (D-04). */
export async function getWorkspaceFileVersions(
  threadId: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<WorkspaceVersion[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/versions`,
    { headers, signal },
  )
  if (!res.ok) throw new Error("Failed to list workspace file versions")
  return (await res.json()) as WorkspaceVersion[]
}

/** GET /threads/{tid}/workspace/files/{id}/diff?from=&to= (workspace.py:238).
 *  Returns a raw unified-diff STRING in `delta.diff` (parsed client-side by
 *  VersionDiff — Pattern 2). Backend truncates at 500 diff lines and sets
 *  `delta.truncated` (Pitfall 4). */
export async function getWorkspaceFileDiff(
  threadId: string,
  fileId: string,
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<WorkspaceDiff> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/diff?from=${from}&to=${to}`,
    { headers, signal },
  )
  if (!res.ok) throw new Error("Failed to fetch diff")
  return (await res.json()) as WorkspaceDiff
}

/** POST /runs/{runId}/ask_user_response (runs.py:496). Persist-first-then-publish:
 *  the backend persists the answer then publishes the resume; the resulting
 *  `ask_user_response` SSE removes the prompt from the store, reactively clearing
 *  the card and un-pausing the run (Pattern 3). `runId` comes from
 *  `PendingAsk.run_id` (GET-only — Pitfall 1 / A2); the submit caller (Plan 05)
 *  gates on its presence. Throws on non-OK. */
export async function answerAskUser(
  runId: string,
  body: AskUserAnswerBody,
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/runs/${runId}/ask_user_response`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new ApiError("Failed to submit ask_user answer", res.status)
}

/** Phase 063 (D-063-03): server-side Stop. DELETE /runs/{runId} cancels the
 * producer; the terminal sentinel arrives via the open SSE subscription;
 * cross-tab Stop falls out for free. Idempotent — DELETE on already-terminal
 * returns 204; on 404 we silently return (the run may have completed or been
 * cancelled by another tab) so the UI doesn't surface a confusing error.
 *
 * WR-03 fix: accept an optional AbortSignal so the UI can cancel an
 * in-flight DELETE if the user navigates away mid-click. Matches the
 * signal-accepting shape of every other API helper in this module.
 */
export async function cancelRun(runId: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/runs/${runId}`, {
    method: "DELETE",
    headers,
    signal,
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to cancel run (status ${res.status})`)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 092 (MODE-01 / MODE-02 / CONT-01) — dual-mode + Continue clients.
// Backend contracts: 092-02-SUMMARY (GET /threads/{id}/workflow, GET
// /workflows/published) + 092-03-SUMMARY (POST /runs/{id}/continue).
// ────────────────────────────────────────────────────────────────────────────

/** Phase 092 (SC#5 / D-v2.5-03) — the reconcile-via-fetch contract mirroring
 *  the backend `ThreadWorkflowState` Pydantic model (backend/app/models/thread.py).
 *  GET /threads/{id}/workflow is a PURE READ — the source of truth for a thread's
 *  Deep/Harness mode + workflow lock + current phase + Continue budget. NEVER
 *  trust a Realtime/SSE hint alone (D-v2.5-03). */
export interface ThreadWorkflowState {
  thread_id: string
  /** harness iff active_workflow_run_id IS NOT NULL. */
  mode: "deep" | "harness"
  /** True iff a non-terminal workflow run holds the lock. */
  locked: boolean
  active_workflow_run_id: string | null
  /** workflow_runs.status; null when the run row is absent. */
  run_status: string | null
  definition_slug: string | null
  definition_name: string | null
  current_phase_slug: string | null
  current_phase_index: number | null
  total_phases: number | null
  /** SC#5 heal: anchor set BUT the run row is missing or terminal. */
  lock_is_stale: boolean
  /** CONT-01 / D-06 — a Continue affordance is currently pending. */
  cap_paused: boolean
  continues_used: number
  /** max_continues_per_run - continues_used (D-06). */
  continues_remaining: number
  /** Facet C (092-07) — the thread's latest producer `runs.run_id` WHEN live
   *  (non-terminal). The StreamsProvider reconcile re-subscribes
   *  GET /runs/{id}/stream to re-attach a startup-sweep-resumed run's live stream
   *  on mount with no page action. null when the latest producer row is
   *  terminal/absent. PURE additive read (no new query, no write — the 092-05 F2
   *  invariant holds). */
  latest_producer_run_id?: string | null
  /** Phase 188 CR-03 — the `workflow_runs` row this thread MOST RECENTLY held: the live
   *  `active_workflow_run_id` when set, ELSE the thread's latest `workflow_runs` row. It is
   *  the SAME value the server already resolves to source `phases` below, surfaced rather
   *  than recomputed.
   *
   *  ⚠ Read THIS, not `active_workflow_run_id`, whenever the target is "the run this thread
   *  ran" rather than "the run this thread is running now". `finish_run` NULLs the live
   *  anchor in the same transaction as the terminal status (Phase 092 SC#2), so the anchor is
   *  absent for exactly the FINISHED runs a re-open affordance serves.
   *
   *  ⚠ It is a `workflow_runs.id`, NEVER a producer `runs.run_id` — see
   *  `latest_producer_run_id` directly above, which is the OTHER table. Both are bare uuids,
   *  so a swap typechecks and then resolves nothing. */
  last_workflow_run_id?: string | null
  /** Phase 194.1 (D-09 AMENDED) — the LAST run's status and its two timestamps, keyed to the
   *  same anchor-then-latest run as `last_workflow_run_id` directly above. The server reads
   *  them off SELECTs it already issued: no new route, no extra round trip.
   *
   *  ⚠ `last_run_status` is the LAST run's status. It is NOT `run_status` above, which is the
   *  LIVE anchor's and is `null` after a stop — that gap is why these exist. Both are
   *  `string | null` and a swap TYPECHECKS, exactly like the two id types warned about above.
   *
   *  ⚠ ELAPSED IS `last_run_created_at` -> `last_run_updated_at`, i.e. from QUEUED to LAST
   *  UPDATE — NOT a wall-clock run duration, because queue time is inside it. `claimed_at` is
   *  deliberately not offered (0 of 149 completed rows carry it — the in-process producer
   *  never takes `claim_run`'s CAS lease). Any surface printing the interval owes that
   *  disclosure. Timestamps are ISO strings on the wire.
   *
   * ⚠ WR-02-LOOKALIKE-LAST-RUN-STATUS — THREE IDENTICALLY-TYPED `last_run_status?: string | null`
   * FIELDS EXIST IN THIS FILE, AND A SWAP BETWEEN ANY TWO OF THEM TYPECHECKS. They live on
   * `ThreadWorkflowState`, on `PublishedWorkflow` and on `WorkflowDraftRow`. Named by TYPE and
   * never by line number, because a line number rots on the next edit to this 6,000-line file.
   *
   *   · `ThreadWorkflowState.last_run_status` — THE LIVE THREAD's last `workflow_runs` row,
   *     keyed to `last_workflow_run_id`. Paired with `last_run_created_at`.
   *   · `PublishedWorkflow.last_run_status` and `WorkflowDraftRow.last_run_status` — THE
   *     LIBRARY ROW's last run, OWNER-SCOPED (`r.user_id = $1`). Both paired with `last_run_at`.
   *
   * ⚠ AND THE TWO TIMESTAMP NAMES ARE THE SAME COLUMN. `last_run_created_at` (on
   * `ThreadWorkflowState`) and `last_run_at` (on the two library rows) BOTH render
   * `workflow_runs.created_at`. That divergence is KNOWN AND DECIDED (192.2-10 DEC-10-B), not an
   * oversight: renaming either one is a wire change across the backend, three serializers, two
   * interfaces here and both library normalizers — a large blast radius to make two names agree
   * about a readability defect, taken inside a gap-closure round, on the hottest file in this
   * repository. `last_run_at` is also the better name for the question the LIBRARY asks (*when
   * did it last run*), where `last_run_created_at` names the column's provenance for a surface
   * that also shows `last_run_updated_at`. The rename is DECLINED; the cross-reference is the fix.
   *
   * The marker token above is bound by `apiRunFields.fences.test.ts`, which counts THREE
   * declarations and THREE markers. Deleting one of these paragraphs reds it.
   */
  last_run_status?: string | null
  last_run_created_at?: string | null
  last_run_updated_at?: string | null
  /** Phase 098-UAT run-honesty fix (B) — the run's durable per-phase status array
   *  (ordered by phase_index) from workflow_phases, so the reconcile floor can
   *  rebuild an HONEST timeline for a TERMINAL run instead of returning [] (which
   *  blanked the timeline on revisit/reload of a finished workflow thread). null
   *  for Deep / no run. Statuses are DB-native (pending/active/completed/failed/
   *  skipped); reconcilePhases maps them to the Phase status union. */
  phases?: WorkflowPhaseState[] | null
}

/** Phase 098-UAT run-honesty fix (B) — one workflow_phases row's durable per-phase
 *  status (mirrors backend WorkflowPhaseState). status is DB-native. */
export interface WorkflowPhaseState {
  slug: string
  phase_index: number
  status: string
  phase_type?: string
  /**
   * ── Phase 200-07 (DES-02 / D-05 / D-07) — THE CLIENT MIRROR OF TRANSPORT 3, CAUGHT
   *    MISSING AND ADDED HERE ────────────────────────────────────────────────────────
   *
   * ⚠ `200-02` widened the BACKEND `WorkflowPhaseState` (`models/thread.py:122-125`) with
   * these four fields and did NOT widen this client mirror, so `GET /threads/{id}/workflow`
   * has been sending them and the panel has been unable to declare them. `200-02`'s own
   * SUMMARY states the reason the two models must move together, verbatim: *"widening only
   * the other model would ship a run page with durations and a chat panel without them."*
   * That is exactly the state this restores — measured against the Python model rather than
   * inferred from the plan's prose, which asserts both transports already carried them.
   *
   * ⚠ **A TYPE, NOT A RUNTIME EXPORT.** These four lines are fully erased at build, so
   * `197`'s decline on this file still holds and `196-08`'s mock-factory failure mode
   * (a `vi.mock("@/lib/api")` factory missing a newly-added export) measurably cannot fire.
   * Proved by grep over this plan's real diff (D-15), never by quoting this paragraph.
   *
   * Semantics are stated ONCE, on `WorkflowRunPhase` — the run page's mirror of the same
   * `workflow_phases` rows. The two that bind hardest, repeated because getting either
   * wrong is a rendered lie rather than a crash: a NULL timestamp means **the time was not
   * recorded** (there is no backfill), and `step_count` distinguishes `0` (a real
   * measurement of nothing) from `null` (this phase type declares no count) — so the arm is
   * `typeof === "number"` and never `?? 0`.
   */
  started_at?: string | null
  completed_at?: string | null
  step_count?: number | null
  step_noun?: string | null
}

/** A picker row from GET /workflows/published (backend/app/api/workflows.py
 *  PublishedWorkflow). The minimum the Harness picker needs to list + kick off.
 *
 *  Phase 103-06 (REQ-7 D9/D10): `definition` is the ADDITIVE full WorkflowDefinition
 *  JSONB the Workflows page card uses to derive the client-side strictness tier
 *  (deriveTier) + the phase-type chain. Optional — the composer Harness picker only
 *  reads id/slug/name and ignores it (backward compatible).
 *
 *  Phase 192 (LIB-01 / D-04): `is_mine` + `is_system_global` are the ADDITIVE ownership
 *  bits that let the library's *Yours* and *Starters* chips filter client-side with honest
 *  SIMULTANEOUS counts, instead of the `?scope=mine` server round-trip a re-query chip
 *  would need. Both are computed server-side against the authenticated caller; the backend
 *  deliberately never sends a raw `created_by` UUID (see the binding rule on the Python
 *  model — that pool bypasses RLS, so whatever it emits, the caller receives).
 *
 *  DECLARED OPTIONAL ON PURPOSE, AND THIS IS A CONTRACT, NOT LAZINESS. A frontend deployed
 *  AHEAD of the backend receives rows without these keys. The honest client behaviour is to
 *  read `undefined` as "unknown" and fall back to feed-derived provenance
 *  (`provenance !== "starter"`), which is CORRECT rather than merely non-fatal — a row is
 *  still genuinely the user's own even when the field is absent. Consumers (notably
 *  `library/libraryFilter.ts`) inherit that rule from here: never treat `undefined` as
 *  `false`, because that silently renders an empty *Yours* chip on a stale deploy. */
export interface PublishedWorkflow {
  id: string
  slug: string
  name: string
  definition?: WorkflowDefinitionJSON | null
  is_mine?: boolean
  is_system_global?: boolean
  /**
   * Phase 192.1 (LIB-05 / D-15) — when this row last changed, ISO-8601 as the server
   * rendered it. The recency half of the library identity line ("changed 2 months ago").
   *
   * OPTIONAL AND NULLABLE for the reason spelled out in the block above this interface: a
   * frontend deployed AHEAD of the backend receives rows without the key. `undefined` means
   * "the wire did not say", and the honest rendering of that is NO `changed` segment — never
   * a fabricated time, and never `new Date()`.
   *
   * ⚠ D-17 — ON A PUBLISHED ROW THIS IS THE PUBLISH TIME, AND THAT IS HONEST RATHER THAN A
   * BUG. `workflow_definitions_block_published` makes a published row immutable, so its
   * `updated_at` is frozen at the publish flip — which IS the last time it changed. Do not
   * add a second field to "fix" it.
   */
  updated_at?: string | null
  /**
   * Phase 192.2 (LIB-06 / D-07 / D-08) — WHEN THIS ROW LAST RAN, ISO-8601 as the server
   * rendered it. Joined from `workflow_runs` by a `LEFT JOIN LATERAL … LIMIT 1` that is
   * OWNER-SCOPED (`r.user_id = $1`), so it answers *"did MY last run of this work?"* and
   * never reports another caller's activity on a world-readable global row.
   *
   * ⚠ THIS IS NOT `updated_at`, AND THE TWO VISIBLY DISAGREE ON REAL DATA. `updated_at` on a
   * published row is the PUBLISH time (see the ⚠ D-17 paragraph directly above); this is the
   * last time anybody pressed Run. Measured on the live feed 2026-08-19, the first populated
   * published row's run is two days LATER than its publish. Do not read one for the other.
   *
   * ⚠ THREE STATES, NOT TWO — the whole point of D-08. `undefined` means THE WIRE DID NOT SAY
   * (a frontend deployed ahead of its backend: the key is simply absent from the payload).
   * `null` means the backend looked and there is NO RUN. They are different facts and the
   * client must not collapse them: the honest rendering of `null` is an explicit *never run*,
   * and the honest rendering of `undefined` is an explicit *unknown* — never a fabricated
   * time, never `new Date()`, never a blank, and never a green tick. This is the same rule
   * `updated_at` states one field up, with one extra arm because absence here has two causes.
   *
   * ⚠ CORRECTED BY 192.2-10 (CR-01) — THE PARAGRAPH ABOVE IS PRESERVED VERBATIM AND IS
   * SUPERSEDED, NEVER OVERWRITTEN. Its sentence *"`null` means the backend looked and there is
   * NO RUN"* is FALSE AS A ROW-LEVEL CLAIM. The lateral behind this field is OWNER-SCOPED
   * (`r.user_id = $1`, `backend/app/db/workflows.py`), which is the correct security posture and
   * stands — but it makes the fact CALLER-SCOPED. So `null` means *the backend looked and **YOU**
   * have no run of this row*. It says nothing whatever about whether anybody else has.
   *
   * Measured on the live feeds 2026-08-19 as a caller who is not the runner: **5 of 92**
   * `/workflows/published` rows and **1 of 3** `/workflows/starters` rows come back with
   * `last_run_at: null` on a definition that HAS been run. Rendering that as an affirmative
   * *"Never run"* is precisely the false claim CR-01 names.
   *
   * ⚠ THE ROW-LEVEL ANSWER LIVES ONE FIELD DOWN — `has_any_run`, added by `192.2-08`. When the
   * question is *"has this ever run?"* read THE PAIR, never this field alone.
   */
  last_run_at?: string | null
  /**
   * Phase 192.2 (LIB-06 / D-08) — the RAW status of the run `last_run_at` describes, exactly
   * as `workflow_runs.status` spells it. The backend deliberately ships no business word: the
   * library card owns the vocabulary (`library/runFacts.ts`), and a status word chosen here
   * would be a second copy of it living on the wire.
   *
   * ⚠ THE COLUMN'S DOMAIN IS SIX VALUES AND IT CAN GROW WITHOUT THIS TYPE CHANGING —
   * `active` · `paused` · `cap_paused` · `completed` · `failed` · `cancelled`
   * (`supabase/migrations/057_workflow_runs.sql:19`, widened by `063_dual_mode_continue.sql`).
   * It is therefore typed `string`, not a union: a union would make a new terminal state a
   * COMPILE error in a client that is merely reading, while the real requirement is that the
   * client keep working and say so. Any consumer mapping this to words needs a TOTAL default
   * arm, and that arm must never be success.
   *
   * `undefined` / `null` carry the same two meanings as on `last_run_at` above.
   *
   * ⚠ WR-02-LOOKALIKE-LAST-RUN-STATUS — THREE IDENTICALLY-TYPED `last_run_status?: string | null`
   * FIELDS EXIST IN THIS FILE, AND A SWAP BETWEEN ANY TWO OF THEM TYPECHECKS. They live on
   * `ThreadWorkflowState`, on `PublishedWorkflow` and on `WorkflowDraftRow`. Named by TYPE and
   * never by line number, because a line number rots on the next edit to this 6,000-line file.
   *
   *   · `ThreadWorkflowState.last_run_status` — THE LIVE THREAD's last `workflow_runs` row,
   *     keyed to `last_workflow_run_id`. Paired with `last_run_created_at`.
   *   · `PublishedWorkflow.last_run_status` and `WorkflowDraftRow.last_run_status` — THE
   *     LIBRARY ROW's last run, OWNER-SCOPED (`r.user_id = $1`). Both paired with `last_run_at`.
   *
   * ⚠ AND THE TWO TIMESTAMP NAMES ARE THE SAME COLUMN. `last_run_created_at` (on
   * `ThreadWorkflowState`) and `last_run_at` (on the two library rows) BOTH render
   * `workflow_runs.created_at`. That divergence is KNOWN AND DECIDED (192.2-10 DEC-10-B), not an
   * oversight: renaming either one is a wire change across the backend, three serializers, two
   * interfaces here and both library normalizers — a large blast radius to make two names agree
   * about a readability defect, taken inside a gap-closure round, on the hottest file in this
   * repository. `last_run_at` is also the better name for the question the LIBRARY asks (*when
   * did it last run*), where `last_run_created_at` names the column's provenance for a surface
   * that also shows `last_run_updated_at`. The rename is DECLINED; the cross-reference is the fix.
   *
   * The marker token above is bound by `apiRunFields.fences.test.ts`, which counts THREE
   * declarations and THREE markers. Deleting one of these paragraphs reds it.
   */
  last_run_status?: string | null
  /**
   * Phase 192.2 (LIB-06 / CR-01) — WHETHER ANY RUN OF THIS DEFINITION EXISTS, BY ANYBODY.
   * A ROW-LEVEL fact, and the only deliberately UNSCOPED field on this model. Landed by
   * `192.2-08` as one projection-only SQL `EXISTS` at four sites.
   *
   * ⚠ IT ANSWERS A DIFFERENT QUESTION FROM ITS TWO NEIGHBOURS DIRECTLY ABOVE, AND THE TWO ARE
   * MEANT TO DISAGREE. `last_run_at` / `last_run_status` come off an OWNER-SCOPED lateral
   * (`r.user_id = $1`) and answer *did MY last run of this work?*. This one answers *has
   * ANYBODY run it?*. **`has_any_run: true` WITH `last_run_at: null` is the meaningful pair —
   * somebody ran it, and it was not you.** That shape is real on 5 `/published` rows and 1
   * `/starters` row today for any caller who is not the runner (measured 2026-08-19).
   *
   * ⚠ THREE STATES, AND A CONSUMER MAY NOT COLLAPSE THEM (192.2-10 DEC-10-A):
   *   · `true`           — somebody has run it.
   *   · `false`          — the backend looked and NOBODY has. **The only state that honestly
   *                        earns the words "Never run".**
   *   · absent or `null` — THE WIRE DID NOT SAY: a frontend deployed ahead of its backend, or a
   *                        read path that omits the column. NOT a synonym for `false`.
   * A `?? false` anywhere downstream manufactures the affirmative claim *nobody has run this*
   * out of an absence — CR-01's exact shape, one layer down.
   *
   * ⚠ THE DISCLOSURE BUDGET IS EXISTENCE-ONLY, AND IT IS A DECISION RATHER THAN AN OMISSION
   * (`192.2-08` DEC-08-A). A bare SQL `EXISTS`: never WHO, never WHEN, never HOW MANY, never
   * WITH WHAT OUTCOME. Widening this key toward any of those is a cross-tenant disclosure, not
   * a richer field. Re-open trigger: the first workflow row visible to a caller who is not
   * entitled to know it has been exercised at all.
   */
  has_any_run?: boolean | null
}

/** Phase 092 (SC#5 / D-v2.5-03) — GET /threads/{id}/workflow pure-read reconcile.
 *  Returns the authoritative mode/lock/phase/Continue state for a thread. Used on
 *  thread mount to reconcile the composer lock + Continue card from truth (never a
 *  stale SSE hint). Ownership-gated 404 on the backend. (getThreadPendingAsks shape.) */
export async function getThreadWorkflow(
  threadId: string,
  signal?: AbortSignal,
): Promise<ThreadWorkflowState> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/workflow`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to load thread workflow state (status ${res.status})`)
  return (await res.json()) as ThreadWorkflowState
}

/** Phase 092 (MODE-01 / D-01) — GET /workflows/published. The Harness-mode
 *  picker feed: published workflow definitions the user may start (owner-scoped
 *  on the backend via the RLS-mirroring predicate — the frontend cannot widen
 *  the scope, T-092-17). */
export async function listPublishedWorkflows(
  /** Phase 103-06 (REQ-7): the project-folder filter rail. When a folder id is
   *  given, the backend AND-appends `definition->>'project_folder_id'` to the
   *  owner-scope clause — it can only NARROW, never widen (T-098-09). Omitting it
   *  (or passing null) returns the full owner-scoped published list unchanged. */
  projectFolderId?: string | null,
  signal?: AbortSignal,
  /** Phase 143 (WF-01 / D-143-2b): the Workflows-page Published shelf opts into
   *  `scope: "mine"` so the backend AND-narrows to `created_by = me` (dropping the
   *  bare `is_system_global`), de-duping the curated Starters + the mig-061 dev scaffolds
   *  that now render in their own Starters shelf. EVERY other caller (the composer
   *  Harness picker, the WorkspacePanel run-soul recovery) OMITS it and keeps the
   *  byte-identical global-OR-mine feed those surfaces depend on (Pitfall 3). */
  opts?: { scope?: "mine" },
): Promise<PublishedWorkflow[]> {
  const headers = await getAuthHeaders()
  // Preserve the existing project_folder_id encoding byte-for-byte; append scope only
  // when the caller opts in (default-off — no behavior change for existing callers).
  const params: string[] = []
  if (projectFolderId) params.push(`project_folder_id=${encodeURIComponent(projectFolderId)}`)
  if (opts?.scope) params.push(`scope=${encodeURIComponent(opts.scope)}`)
  const url = params.length
    ? `${API_BASE}/workflows/published?${params.join("&")}`
    : `${API_BASE}/workflows/published`
  const res = await fetch(url, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list published workflows (status ${res.status})`)
  return (await res.json()) as PublishedWorkflow[]
}

/** Phase 143 (WF-01 / D-143-2) — GET /workflows/starters. The curated Starters-shelf
 *  feed: `is_system_global` published definitions carrying `definition.category = 'starter'`
 *  (a server-side JSONB-path predicate, `list_starter_workflows`). No project/user
 *  scope — curated globals are world-readable by the mig-056 SELECT policy, so this
 *  is a clone of listPublishedWorkflows with NO query params. The Workflows page
 *  renders these on top; "Use this starter" forks a fresh owned copy off each row. */
export async function listStarterWorkflows(signal?: AbortSignal): Promise<PublishedWorkflow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/starters`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list starter workflows (status ${res.status})`)
  return (await res.json()) as PublishedWorkflow[]
}

/** The POST /runs/{id}/continue response (092-03). `status:"ok"` resumes the
 *  SAME run with a fresh bounded budget; `status:"refused"` means the 3-cap is
 *  exhausted (a clean 200 refusal — surface the message, do NOT throw). */
export interface ContinueRunResult {
  status: "ok" | "refused"
  run_id?: string
  /** Facet C (092-07) — on a Harness re-drive the backend mints a FRESH producer
   *  `runs` row (the original stream EXPIREd) and returns its id here so the
   *  frontend re-subscribes GET /runs/{producer_run_id}/stream. Absent on the Deep
   *  consume path (same run_id) and on a `refused` response. */
  producer_run_id?: string
  message?: string
  continues_used: number
  continues_remaining: number
}

/** Phase 092 (CONT-01 / D-06) — POST /runs/{id}/continue. Resumes a cap_paused
 *  run with a fresh bounded budget that CONSUMES the dropped tool calls (Deep) or
 *  re-drives the active phase (Harness). The backend refuses the (max+1)-th
 *  Continue with a clean 200 `{status:"refused"}` payload — we DON'T throw on that
 *  (it is the expected exhausted-cap path, D-06); we only throw on a real HTTP
 *  error. (cancelRun mutation shape.) */
export async function continueRun(
  runId: string,
  signal?: AbortSignal,
): Promise<ContinueRunResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/runs/${runId}/continue`, {
    method: "POST",
    headers,
    signal,
  })
  if (!res.ok) {
    throw new Error(`Failed to continue run (status ${res.status})`)
  }
  return (await res.json()) as ContinueRunResult
}

export async function listDocuments(): Promise<Document[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents`, { headers })
  if (!res.ok) throw new Error("Failed to list documents")
  return res.json() as Promise<Document[]>
}

export async function uploadDocument(file: File, folderId?: string | null): Promise<{ doc: Document; isDuplicate: boolean }> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  if (folderId) formData.append("folder_id", folderId)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  const doc = await res.json() as Document
  return { doc, isDuplicate: res.status === 200 }
}

// Phase 100 (TMPL-01 / D-01): upload an ephemeral OOXML template into the
// thread's workspace via POST /threads/{tid}/workspace/files (workspace.py
// `upload_template`). Mirrors uploadDocument's FormData + Bearer shape — the
// NO-Content-Type detail is load-bearing so the browser sets the multipart
// boundary itself. The server is the real gate (validate_ooxml magic-byte
// check, Plan 100-04); the panel reconciles by upserting the returned row.
export async function uploadWorkspaceTemplate(
  threadId: string,
  file: File,
): Promise<WorkspaceFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  // WR-08 (100-REVIEW): the backend route returns write_file's dict whose key is
  // `file_id` (no `id`). Map it at the API boundary instead of a blind cast so the
  // optimistically upserted store row carries a real id — 088-05 D-16 history:
  // missing workspace-file ids caused live `/files//content` 404s.
  const row = (await res.json()) as WorkspaceFile & { file_id?: string }
  return { ...row, id: row.id ?? row.file_id }
}

// Phase 067.3 (D-067.3-R2-01/02/04): JS blob fetch+download for
// /sandbox-outputs/{path}. Plain <a href> clicks send only cookies and
// the FastAPI get_current_user dependency reads Authorization: Bearer
// headers exclusively → 401. This helper injects the Bearer token via
// fetch, follows the 302 to Supabase CDN, downloads as Blob, triggers
// programmatic <a download> click. NO backend changes (sandbox_outputs.py
// stays as-is). Right-click "Save link as" falls back to the default
// browser behavior (raw anchor click → 401) — accepted UX trade-off
// for chat-history context (D-067.3-R2-03 + Specifics §"R-2 right-click").
export class DownloadError extends Error {
  readonly status: number | "network"
  constructor(status: number | "network", message: string) {
    super(message)
    this.status = status
    this.name = "DownloadError"
  }
}

export async function downloadSandboxOutput(
  relativeUrl: string,
  filename: string,
): Promise<void> {
  // Normalize: prepend API_BASE only for relative URLs (matches the
  // resolveOutputUrl shape used by tool-bodies/ExecuteCodeBody.tsx
  // (Phase 075.7 rename of the legacy execute-code wrapper) — keeps the
  // call site simple
  // by accepting either form).
  const url = relativeUrl.startsWith("/") ? `${API_BASE}${relativeUrl}` : relativeUrl

  let token: string
  try {
    token = await getAuthToken()
  } catch {
    throw new DownloadError(401, "Session expired — please refresh the page and try again.")
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      // redirect: "follow" is the default; the 302 → Supabase CDN is
      // auto-followed and the final response carries the file bytes.
    })
  } catch {
    // Network failure (offline, DNS, CORS preflight reject) → status="network".
    throw new DownloadError("network", "Download failed — try again.")
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new DownloadError(401, "Session expired — please refresh the page and try again.")
    }
    if (res.status === 404) {
      // Backend collapses missing-and-IDOR to 404 (sandbox_outputs.py:48-67
      // existence-leak prevention) — frontend mirrors that message verbatim.
      throw new DownloadError(404, "File not found.")
    }
    // 5xx + any other non-2xx
    throw new DownloadError(res.status, "Download failed — try again.")
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    // Append-then-click-then-remove pattern — required by Firefox.
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Revoke after a short delay — some browsers are async about the
    // download trigger and revoking immediately can race the save dialog.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }
}

// Phase 101.1-09 (gap 3): the 067.3 blob-download pattern for a workspace
// deliverable. A produced docx/pptx/xlsx is stored INLINE, so its bytes are NOT
// reachable via the /content route (which str-decodes inline content and corrupts
// the binary). This helper hits the raw-bytes route (workspace.py
// /files/{id}/raw) with the Bearer token, blobs the EXACT bytes, and triggers a
// programmatic <a download> click — mirroring downloadSandboxOutput's contract
// (DownloadError on 401/404/5xx; the missing-and-IDOR-collapsed 404 maps to the
// same "File not found"). Closes the "Download is dead text" last mile of TMPL-02.
export async function downloadWorkspaceFile(
  threadId: string,
  fileId: string,
  filename: string,
): Promise<void> {
  let token: string
  try {
    token = await getAuthToken()
  } catch {
    throw new DownloadError(401, "Session expired — please refresh the page and try again.")
  }

  const url = `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/raw`
  let res: Response
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new DownloadError("network", "Download failed — try again.")
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new DownloadError(401, "Session expired — please refresh the page and try again.")
    }
    if (res.status === 404) {
      // Backend collapses missing-and-IDOR-and-expired to 404 (existence-leak rule).
      throw new DownloadError(404, "File not found.")
    }
    throw new DownloadError(res.status, "Download failed — try again.")
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }
}

export async function deleteDocument(id: string, scope?: "version" | "all"): Promise<void> {
  const headers = await getAuthHeaders()
  const url = scope
    ? `${API_BASE}/documents/${id}?scope=${scope}`
    : `${API_BASE}/documents/${id}`
  const res = await fetch(url, { method: "DELETE", headers })
  if (!res.ok) throw new Error("Failed to delete document")
}

export async function fetchDocumentVersions(documentId: string): Promise<Document[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/versions`, { headers })
  if (!res.ok) throw new Error("Failed to fetch document versions")
  return res.json() as Promise<Document[]>
}

export async function restoreDocumentVersion(documentId: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${documentId}/restore`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Failed to restore version. Please try again.")
  return res.json() as Promise<Document>
}

export async function listFolders(): Promise<Folder[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, { headers })
  if (!res.ok) throw new Error("Failed to list folders")
  return res.json() as Promise<Folder[]>
}

export async function createFolder(name: string, parentId: string | null, isOrgShared = false): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers,
    // Phase 165 (MIG-02): the wire field is is_org_shared (folders = FUNCTIONAL org-share).
    body: JSON.stringify({ name, parent_id: parentId, is_org_shared: isOrgShared }),
  })
  if (!res.ok) throw new Error("Failed to create folder")
  return res.json() as Promise<Folder>
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to rename folder")
  return res.json() as Promise<Folder>
}

export async function deleteFolder(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete folder")
}

export async function toggleFolderOrgShared(id: string): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}/toggle-global`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the folder owner can change org sharing")
    throw new Error("Failed to update folder sharing")
  }
  return res.json() as Promise<Folder>
}

export async function listSkills(): Promise<Skill[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills`, { headers })
  if (!res.ok) throw new Error("Failed to list skills")
  return res.json() as Promise<Skill[]>
}

export async function createSkill(body: SkillCreate): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to save skill. Please try again.")
  return res.json() as Promise<Skill>
}

export async function updateSkill(id: string, body: SkillUpdate): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update skill. Please try again.")
  return res.json() as Promise<Skill>
}

export async function deleteSkill(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill. Please try again.")
}

export async function toggleSkillEnabled(id: string): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-enabled`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to update skill.")
  return res.json() as Promise<Skill>
}

/** Phase 136 (GATE-01): a typed carrier for the structured 409 publish-gate
 *  refusal. Holds the server-computed `PublishGate` so the dialog can render the
 *  SAME honest counts/reason the server used — the client never recomputes `met`
 *  (D-07). Mirrors the ApiError idiom (a named Error with a typed field). */
export class PublishGateError extends Error {
  readonly gate: PublishGate
  constructor(gate: PublishGate) {
    super(gate.reason || "This skill can't be published yet — its eval gate isn't met.")
    this.gate = gate
    this.name = "PublishGateError"
  }
}

export async function toggleSkillOrgShared(id: string, override?: boolean): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-global`, {
    method: "PATCH",
    headers,
    // Only the private→org-shared publish direction sends a body ({ override }); the
    // ungated shared→private unshare direction (no arg) sends none — unchanged.
    ...(override !== undefined ? { body: JSON.stringify({ override }) } : {}),
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the skill owner can change org sharing")
    if (res.status === 409) {
      // Structured publish-gate refusal — detail is an OBJECT { error, gate }, NOT
      // a string (do NOT route through proposalError's string path). Surface the
      // gate via a typed error so the dialog renders the server's honest evidence.
      let gate: PublishGate | undefined
      try {
        const j = (await res.json()) as { detail?: { error?: string; gate?: PublishGate } }
        gate = j?.detail?.gate
      } catch {
        /* non-JSON / malformed 409 body — fall through to the generic message */
      }
      if (gate) throw new PublishGateError(gate)
      throw new Error("This skill can't be published yet — its eval gate isn't met.")
    }
    throw new Error("Failed to update skill.")
  }
  return res.json() as Promise<Skill>
}

/** GET /skills/{id}/publish-gate — the server-computed publish read-model the
 *  PublishGateDialog renders before a private→global share (D-05). Owner-scoped
 *  server-side (404 cross-user). Mirrors getEvalRun's getAuthHeaders→fetch→typed
 *  json cast; the client never computes `met` (D-07). */
export async function getPublishGate(skillId: string): Promise<PublishGate> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/publish-gate`, { headers })
  if (!res.ok) throw new Error("Failed to load publish gate.")
  return res.json() as Promise<PublishGate>
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 132 Plan 03 (EVAL-01 / VER-01) — eval test-case CRUD + read-only version
// history client. Mirrors the listSkills/createSkill/updateSkill/deleteSkill
// pattern above (getAuthHeaders → fetch → typed json cast). Owner-scoping is
// enforced SERVER-SIDE on every route (Plan 02 `.eq("user_id", …)`); this is a
// thin client and not itself a security boundary. Backs the THIN 132 foundation
// surface — the designed Evals panel is Phase 137 (PANEL-01, G-2).
// ────────────────────────────────────────────────────────────────────────────

export async function listTestCases(skillId: string): Promise<TestCase[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/test-cases`, { headers })
  if (!res.ok) throw new Error("Failed to load test cases.")
  return res.json() as Promise<TestCase[]>
}

export async function createTestCase(skillId: string, body: TestCaseCreate): Promise<TestCase> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/test-cases`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to create test case.")
  return res.json() as Promise<TestCase>
}

export async function updateTestCase(caseId: string, body: TestCaseUpdate): Promise<TestCase> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/test-cases/${caseId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update test case.")
  return res.json() as Promise<TestCase>
}

export async function deleteTestCase(caseId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/test-cases/${caseId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete test case.")
}

export async function listSkillVersions(skillId: string): Promise<SkillVersion[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/versions`, { headers })
  if (!res.ok) throw new Error("Failed to load version history.")
  return res.json() as Promise<SkillVersion[]>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 133 Plan 05 (EVAL-02) — eval-runner client. These mirror the existing
// fetch + getAuthHeaders() shape; the eval run writes a companion public.runs row
// (Plan 04, Pattern 3) so the chat-run stream client (subscribeToRun) reattaches
// with ZERO new stream code. The DURABLE readout always comes from getEvalRun
// (the DB) so it renders after the Redis buffer TTL expires (D-06 / SC#3).
// ─────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/evals/runs — kick off a bounded with/without eval run.
 *  Returns the run_id immediately (202, non-blocking — D-06); the run_id doubles
 *  as the stream run_id you pass to subscribeToRun. Model validation is the
 *  backend's job (registry check — Plan 04). */
export async function startEvalRun(
  skillId: string,
  body: { provider: string; model: string },
): Promise<EvalRunKickoff> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `Failed to start eval run (status ${res.status}).`
    try {
      const j = (await res.json()) as { detail?: string }
      if (j?.detail) detail = j.detail
    } catch {
      /* non-JSON body — keep the generic message */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<EvalRunKickoff>
}

/** GET /skills/{id}/evals/runs/{runId} — the DURABLE owner-scoped readout
 *  (eval_run row + the per-(case × variant) eval_results rows). */
export async function getEvalRun(skillId: string, runId: string): Promise<EvalRunReadout> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/runs/${runId}`, { headers })
  if (!res.ok) throw new Error("Failed to load eval run.")
  return res.json() as Promise<EvalRunReadout>
}

/** GET /skills/{id}/evals/runs — owner-scoped eval runs, newest-first. The
 *  skill-scoped analog of getActiveRuns for reattach discovery: a row whose
 *  status is still 'running' is a live run to reattach to via subscribeToRun
 *  (the thin client has no ephemeral eval thread_id to feed getActiveRuns —
 *  see SUMMARY deviation). */
export async function listEvalRuns(skillId: string): Promise<EvalRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/runs`, { headers })
  if (!res.ok) throw new Error("Failed to load eval runs.")
  return res.json() as Promise<EvalRun[]>
}

/** PUT /skills/{id}/evals/results/{resultId}/rating — set or CLEAR the caller's
 *  thumbs rating on ONE eval answer (EVAL-04). Owner-gated server-side (.eq(user_id)
 *  → 404 cross-user, T-134-11); the client cannot forge another user's rating. Pass
 *  null to clear (re-ratable — D-08). Mirrors startEvalRun's fetch + getAuthHeaders()
 *  + error-detail extraction shape. Returns the persisted rating; the caller should
 *  re-load the durable readout (getEvalRun) so thumbs state stays derived from the DB,
 *  never a separate stale store (respects the BUG-260701-02 skill-switch reset). */
export async function rateEvalResult(
  skillId: string,
  resultId: string,
  rating: "up" | "down" | null,
): Promise<{ eval_result_id: string; rating: string | null }> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/evals/results/${resultId}/rating`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ rating }),
    },
  )
  if (!res.ok) {
    let detail = `Failed to rate eval answer (status ${res.status}).`
    try {
      const j = (await res.json()) as { detail?: string }
      if (j?.detail) detail = j.detail
    } catch {
      /* non-JSON body — keep the generic message */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<{ eval_result_id: string; rating: string | null }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 137.1 (EVAL-05) — matrix runs, engine smoke-sweep health, and run-history
// aggregation client. THIN wrappers over the Plan 04/05/07 routes; they mirror the
// existing eval fetch + getAuthHeaders() shape and carry NO backend logic. Owner-
// scoping is enforced SERVER-SIDE on every route (404 cross-user); this is a thin
// client and not itself a security boundary. Each matrix arm rides the existing
// eval_* SSE via subscribeToRun (its run_id), and the DURABLE readout still comes
// from getEvalRun / getEvalRunById (the DB) after the Redis buffer TTL expires.
// ─────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/evals/matrix — kick off a matrix run (N single-provider arms
 *  under one matrix_group_id; D-06). `gate_provider` designates the arm whose rows
 *  feed the publish gate (D-05; defaults server-side to the user's active provider
 *  when omitted). Returns the group id + per-arm kickoffs (202, non-blocking). */
export async function startMatrixRun(
  skillId: string,
  body: { gate_provider?: string } = {},
): Promise<MatrixRunKickoff> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/matrix`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `Failed to start matrix run (status ${res.status}).`
    try {
      const j = (await res.json()) as { detail?: string }
      if (j?.detail) detail = j.detail
    } catch {
      /* non-JSON body — keep the generic message */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<MatrixRunKickoff>
}

/** POST /evals/engine-sweep — kick the skill-less cross-provider smoke sweep (D-02).
 *  Returns the refreshed engine-health board (each provider ✓/✗ with its verbatim
 *  error). Skill-less by design — the built-in in-memory fixture persists arms with
 *  NULL skill_id (migration 085), so the sweep never pollutes a user's run history. */
export async function runEngineSweep(): Promise<EngineHealthBoard> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/evals/engine-sweep`, { method: "POST", headers })
  if (!res.ok) throw new Error("Failed to run engine sweep.")
  return res.json() as Promise<EngineHealthBoard>
}

/** GET /evals/engine-health — the per-provider ✓/✗ smoke-sweep board (D-02 / 060-A).
 *  A missing provider key renders as an honest ✗ with its verbatim error, never a
 *  blocker. `swept_at` is null before the first sweep. */
export async function getEngineHealth(): Promise<EngineHealthBoard> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/evals/engine-health`, { headers })
  if (!res.ok) throw new Error("Failed to load engine health.")
  return res.json() as Promise<EngineHealthBoard>
}

/** GET /evals/runs/{runId} — the SKILL-LESS run readout (D-02). Same run+results
 *  shape as the skill-scoped getEvalRun, but keyed only by run_id so a NULL-skill
 *  smoke-sweep arm (migration 085) is readable without a skill_id in the path.
 *  Owner-scoped server-side (404 cross-user). */
export async function getEvalRunById(runId: string): Promise<EvalRunReadout> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/evals/runs/${runId}`, { headers })
  if (!res.ok) throw new Error("Failed to load eval run.")
  return res.json() as Promise<EvalRunReadout>
}

/** GET /skills/{id}/evals/aggregate — mean±stddev/delta over the accumulated eval-run
 *  history, grouped per (provider, model) (D-07). stddev is null at run_count<2; the
 *  analyst_notes are deterministic backend-computed lines (D-08). Empty configs = no
 *  history yet. */
export async function getEvalAggregate(skillId: string): Promise<EvalAggregate> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/evals/aggregate`, { headers })
  if (!res.ok) throw new Error("Failed to load eval aggregate.")
  return res.json() as Promise<EvalAggregate>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 135 (SI-01) — self-improvement proposal lifecycle helpers.
//
// The whole propose → review → approve → re-eval → promote/not-promote loop.
// All authorization is enforced server-side (owner gate, 404-not-403 for cross-
// user — Plans 04/05, T-135-01); these helpers only carry getAuthHeaders() and
// never trust client state for authorization. The re-eval rides the EXISTING
// eval_* SSE via the companion `re_eval_run_id` — subscribe with subscribeToRun,
// no new demux branch. Each helper copies the startEvalRun fetch + getAuthHeaders
// + error-detail-extraction shape.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared detail-extracting error for the proposal helpers (mirrors startEvalRun). */
async function proposalError(res: Response, fallback: string): Promise<Error> {
  let detail = `${fallback} (status ${res.status}).`
  try {
    // FastAPI 422 responses return `detail` as an ARRAY of objects, not a
    // string — assign only when it's actually a string, else keep the generic
    // fallback so validation errors never render as "[object Object]" (WR-04).
    const j = (await res.json()) as { detail?: unknown }
    if (typeof j?.detail === "string") detail = j.detail
  } catch {
    /* non-JSON body — keep the generic message */
  }
  return new Error(detail)
}

/** POST /skills/{id}/proposals — propose an improved instructions revision from
 *  a source eval run. Returns the fresh `proposed` SkillProposal. */
export async function proposeImprovement(
  skillId: string,
  sourceEvalRunId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/proposals`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source_eval_run_id: sourceEvalRunId }),
  })
  if (!res.ok) throw await proposalError(res, "Failed to propose improvement")
  return res.json() as Promise<SkillProposal>
}

/** GET /skills/{id}/proposals — owner-scoped proposals for the skill. */
export async function listProposals(skillId: string): Promise<SkillProposal[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/proposals`, { headers })
  if (!res.ok) throw await proposalError(res, "Failed to load proposals")
  return res.json() as Promise<SkillProposal[]>
}

/** GET /skills/{id}/proposals/{proposalId} — one proposal (durable readout). */
export async function getProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}`,
    { headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to load proposal")
  return res.json() as Promise<SkillProposal>
}

/** POST /skills/{id}/proposals/{proposalId}/approve — accept the proposal and
 *  kick off the companion re-eval. Returns the updated proposal + the
 *  `re_eval_run_id` to subscribe to (rides the existing eval_* SSE). */
export async function approveProposal(
  skillId: string,
  proposalId: string,
): Promise<ProposalApproveResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/approve`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to approve proposal")
  return res.json() as Promise<ProposalApproveResult>
}

/** POST /skills/{id}/proposals/{proposalId}/rerun — re-run the re-eval (e.g.
 *  after an interrupted run). Returns the updated proposal + a fresh
 *  `re_eval_run_id`. */
export async function rerunProposalReeval(
  skillId: string,
  proposalId: string,
): Promise<ProposalApproveResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/rerun`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to re-run proposal re-eval")
  return res.json() as Promise<ProposalApproveResult>
}

/** POST /skills/{id}/proposals/{proposalId}/reject — dismiss the proposal. */
export async function rejectProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/reject`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to reject proposal")
  return res.json() as Promise<SkillProposal>
}

/** POST /skills/{id}/proposals/{proposalId}/force-promote — operator override
 *  that promotes despite a failed gate (`override_forced` is recorded). */
export async function forcePromoteProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/proposals/${proposalId}/force-promote`,
    // Send an explicit empty JSON body — a body-less POST 422s against the
    // force-promote route (CR-01, belt-and-suspenders per REVIEW.md). Content-Type
    // is already application/json via getAuthHeaders().
    { method: "POST", headers, body: JSON.stringify({}) },
  )
  if (!res.ok) throw await proposalError(res, "Failed to force-promote proposal")
  return res.json() as Promise<SkillProposal>
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 139 (SI-02) — description-proposal wires. These mirror the SI-01 proposal
// helpers above but hit the `/description-proposals` routes. Additive, D-13: no
// shared-path change, reuse getAuthHeaders() + proposalError. A description
// proposal wraps a Trigger Tuner run's held-out winning DESCRIPTION in the
// propose→review-diff→approve→immutable-version lifecycle — there is NO
// post-approval re-eval (D-07), so approve returns a PLAIN SkillProposal (not the
// ProposalApproveResult / re_eval_run_id shape the SI-01 approve carries).
// ─────────────────────────────────────────────────────────────────────────────

/** POST /skills/{id}/description-proposals — propose a new trigger description
 *  from a Trigger Tuner run's held-out per-provider winner. Body carries the
 *  tuner run's `run_id`; the `source_tuner_run_id` provenance FK is derived
 *  server-side from `tuner_runs.id`. Returns the fresh `proposed` SkillProposal
 *  (`kind='description'`). */
export async function proposeDescription(
  skillId: string,
  runId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals`,
    { method: "POST", headers, body: JSON.stringify({ run_id: runId }) },
  )
  if (!res.ok) throw await proposalError(res, "Failed to propose description")
  return res.json() as Promise<SkillProposal>
}

/** GET /skills/{id}/description-proposals — owner-scoped description proposals for
 *  the skill, newest-first. Returns the most recent row (or null when none) for
 *  rehydration-on-open of the Triggering-tab proposal card. */
export async function getLatestDescriptionProposal(
  skillId: string,
): Promise<SkillProposal | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals`,
    { headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to load description proposals")
  const rows = (await res.json()) as SkillProposal[]
  return rows.length > 0 ? rows[0] : null
}

/** POST /skills/{id}/description-proposals/{proposalId}/approve — accept the
 *  proposal, writing skills.description (which the 079 trigger versions). Returns
 *  a PLAIN SkillProposal — there is no companion re-eval run (D-07), so this does
 *  NOT return the ProposalApproveResult / re_eval_run_id shape the SI-01 approve
 *  carries. */
export async function approveDescriptionProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals/${proposalId}/approve`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to approve description proposal")
  return res.json() as Promise<SkillProposal>
}

/** POST /skills/{id}/description-proposals/{proposalId}/reject — dismiss the
 *  description proposal. Returns the updated SkillProposal. */
export async function rejectDescriptionProposal(
  skillId: string,
  proposalId: string,
): Promise<SkillProposal> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/skills/${skillId}/description-proposals/${proposalId}/reject`,
    { method: "POST", headers },
  )
  if (!res.ok) throw await proposalError(res, "Failed to reject description proposal")
  return res.json() as Promise<SkillProposal>
}

export interface ProviderInfo {
  id: string
  name: string
  base_url: string
  has_key: boolean
  is_active: boolean
  models: string[]
}

export interface FullAppSettings {
  active_provider: string
  llm_model: string
  available_models: string[]
  providers: ProviderInfo[]
  embedding_model: string
  embedding_base_url: string
  embedding_dimensions: number
  embedding_has_api_key: boolean
  // Phase 111.1 — the stored provider the picker reads back to show the current
  // selection (routes by stored provider, never name-inference — D-06 / D-09).
  embedding_provider: string
  extraction_provider: string
  extraction_model: string
  rerank_enabled: boolean
  rerank_provider: string
  rerank_model: string
  rerank_top_n: number
  rerank_has_api_key: boolean
  retrieval_top_k: number
  retrieval_match_threshold: number
  hybrid_search_enabled: boolean
  hybrid_candidate_count: number
  vector_search_weight: number
  keyword_search_weight: number
  rrf_k: number
  web_search_enabled: boolean
  web_search_has_api_key: boolean
  web_search_max_results: number
  sandbox_enabled: boolean
  // Phase 147 (FLAG-01 / migration 097) — the three net-new per-feature kill-switch
  // + maintenance flags added to the `FullSettingsResponse` contract (Plan 147-01).
  // `getSettings()` is the Control Room grid's flag-read source (no new flags GET);
  // `setFlag()` is the write path. Defaults keep existing behavior byte-identical:
  // self_improve/workflows default true, maintenance_mode false.
  self_improve_enabled: boolean
  workflows_enabled: boolean
  maintenance_mode: boolean
  // Phase 159 (MODEL-03 / D-159-04) — the persisted operator toggle that hides known
  // non-chat "utility" model ids (embeddings / audio / image / …) from the model-
  // discovery panel by default. Default true (migration 103). Rides the same
  // `getSettings()` read + `setFlag("model_discovery_filter_enabled", …)` write path as
  // the FLAG-01 booleans above; purely a display/curation concern (never gates the
  // confirmable diff — 149 red line). ControlRoomPage passes it to ModelDiscoveryPanel.
  model_discovery_filter_enabled: boolean
  context_window_max_tokens: number
  sub_agent_max_output_tokens: number
  sub_agent_model: string
  resolved_sub_agent_model: string
  // Phase 123 (D-08 / TRIG-01) — the skill-builder model knob (the model that
  // WRITES candidate descriptions + seeds Tuner cases). `skill_builder_model` is
  // the raw setting ("" => unset); `resolved_skill_builder_model` is the strong
  // default the resolver picks when unset (null only if no forceable default
  // exists — the honest-None floor). Decoupled from the benchmark targets.
  skill_builder_model: string
  resolved_skill_builder_model: string | null
  // Phase 137.1 (EVAL-05 / D-11, D-12) — the INDEPENDENT judge model knob (the model
  // that grades eval answers + the publish gate). `harness_judge_model` is the raw
  // setting ("" => unset); `resolved_harness_judge_model` is the strong registry
  // default the resolver picks when unset (claude-opus-4-8; null only if no forceable
  // default exists). Mirrors the skill_builder_model pair above; ONE resolver (D-11).
  harness_judge_model: string
  resolved_harness_judge_model: string | null
  llm_max_output_tokens: number
  openrouter_tool_strategy: "quality" | "native" | "xml"
  // Phase 075.3 D-075.3-13: registry-known model_ids — frontend uses this set
  // to decide whether to render the "unverified" badge inline next to each
  // model in the main LLM dropdown + selected-label.
  verified_models: string[]
  // Phase 075.3 D-075.3-13 + D-075.3-12: per-unknown-model inferred provider
  // mapping; frontend reads this to substitute {provider} in the tooltip text.
  inferred_provider_for: Record<string, string>
  // Phase 149 (MODEL-01 / D-149-05) — the global set of model_ids flagged
  // `deprecated` in the model registry. Plan 05 populates this in the backend
  // settings payload; the picker (ModelPillRow / MessageInput) reads it
  // defensively (`new Set(deprecated_models ?? [])`) to render an informational
  // `deprecated` badge on those pills. Optional so an older backend response
  // without the field never crashes the frontend (absent → empty set → no badge).
  deprecated_models?: string[]
}

export type AppSettings = FullAppSettings

export interface ProviderUpdate {
  id: string
  api_key?: string
  models?: string[]
  base_url?: string
}

export interface SettingsUpdate {
  active_provider?: string
  llm_model?: string
  providers?: ProviderUpdate[]
  embedding_model?: string
  embedding_api_key?: string
  embedding_base_url?: string
  embedding_dimensions?: number
  // Phase 111.1 — explicit provider pinning (D-06 embedding / D-09 extraction).
  // The picker stores the preset key so the backend routes by it. `extraction_model`
  // travels with the picker default; the backend persists `extraction_provider`
  // through the contract today (the model is stored via app_settings).
  embedding_provider?: string
  extraction_provider?: string
  extraction_model?: string
  confidence_bucket_high?: number
  confidence_bucket_medium?: number
  rerank_enabled?: boolean
  rerank_provider?: string
  rerank_api_key?: string
  rerank_model?: string
  rerank_top_n?: number
  retrieval_top_k?: number
  retrieval_match_threshold?: number
  hybrid_search_enabled?: boolean
  hybrid_candidate_count?: number
  vector_search_weight?: number
  keyword_search_weight?: number
  rrf_k?: number
  tavily_api_key?: string
  web_search_max_results?: number
  sandbox_enabled?: boolean
  context_window_max_tokens?: number
  sub_agent_max_output_tokens?: number
  sub_agent_model?: string
  // Phase 123 (D-08) — the skill-builder model id (any provider incl. local; no SPOF).
  skill_builder_model?: string
  // Phase 137.1 (D-12) — the independent judge model id (registry-validated server-side;
  // "" clears back to the resolver default). Any provider incl. local — no SPOF.
  harness_judge_model?: string
  llm_max_output_tokens?: number
  openrouter_tool_strategy?: "quality" | "native" | "xml"
}

export async function getSettings(): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get settings")
  return res.json() as Promise<FullAppSettings>
}

export async function updateSettings(body: SettingsUpdate): Promise<FullAppSettings> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    try {
      const err = await res.json() as { detail?: string | Array<{ msg: string }> }
      if (typeof err.detail === "string") throw new Error(err.detail)
      if (Array.isArray(err.detail)) throw new Error(err.detail.map((e) => e.msg).join("; "))
    } catch (parseErr) {
      // If the thrown error from inner block propagates, let it through
      if (parseErr instanceof Error && parseErr.message !== "Failed to parse error response") throw parseErr
    }
    throw new Error("Failed to save settings")
  }
  return res.json() as Promise<FullAppSettings>
}

// Phase 137.1 (EVAL-05 / D-11, D-12) — independent judge-model get/set. THIN wrappers
// over getSettings / updateSettings (harness_judge_model is part of the settings
// contract, not a dedicated endpoint — mirrors the skill_builder_model wiring). The
// picker offers ONLY registry-known models (validated server-side, D-12); the effective
// judge (resolve_judge_model → claude-opus-4-8 default) is shown when unset.

/** Read the effective judge model. `judge_model` is the raw setting ("" => unset);
 *  `resolved_judge_model` is the strong default the resolver picks (null only if no
 *  forceable default exists — the honest-None floor). */
export async function getJudgeModel(): Promise<{ judge_model: string; resolved_judge_model: string | null }> {
  const s = await getSettings()
  return { judge_model: s.harness_judge_model, resolved_judge_model: s.resolved_harness_judge_model }
}

/** Set the independent judge model (registry-validated server-side — D-12). Pass ""
 *  to clear back to the resolver default. Returns the full refreshed settings. */
export async function setJudgeModel(model: string): Promise<FullAppSettings> {
  return updateSettings({ harness_judge_model: model })
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 167 VIS-02 (D-167-04) — the per-user default-model preference client.
//
// The FIRST concrete SEED-116 two-layer preference: the operator/org governs the
// ENABLED allowed-set + the lock; the user picks a default WITHIN it. Both fns hit
// the RLS-scoped /me/preferences route (Plan 04) — getAuthHeaders() auto-carries the
// caller's JWT (the write is keyed on auth.uid() server-side). The server is the
// source of truth: PUT re-validates the model ∈ the allowed-set (400 otherwise) and
// re-derives the effective pair, so the picker stays server-derived (never optimistic).
// ─────────────────────────────────────────────────────────────────────────────

/** The two-layer model-default view (`GET/PUT /me/preferences`, Plan 04). `default_model`
 *  is the caller's own raw preference (null = unset → the operator default flows);
 *  `effective_model` is what a new chat actually defaults to under the SEED-116 compose
 *  (surfaced in the footer, never blank — falls back to the org default); `locked` surfaces
 *  the operator lock (disable the picker + name the governed default); `allowed_models` is
 *  the operator/org ENABLED set the picker offers (the user can never pick outside it). */
export interface ModelDefault {
  default_model: string | null
  effective_model: string | null
  locked: boolean
  allowed_models: string[]
}

/** Read the caller's per-user default model + the two-layer context (`GET /me/preferences`).
 *  A defensive `?? fallback` unwrap keeps the picker honest if the server omits a field. */
export async function getModelDefault(): Promise<ModelDefault> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/me/preferences`, { headers, cache: "no-store" })
  if (!res.ok) throw new ApiError("Failed to load your default model.", res.status)
  const body = (await res.json()) as Partial<ModelDefault>
  return {
    default_model: body.default_model ?? null,
    effective_model: body.effective_model ?? null,
    locked: body.locked ?? false,
    allowed_models: body.allowed_models ?? [],
  }
}

/** Set (or clear) the caller's own default model (`PUT /me/preferences`). Pass `null` to
 *  clear the override (the operator default flows). The server validates the model ∈ the
 *  enabled allowed-set (400 otherwise — T-167-13) and honors the lock, then returns the
 *  fresh two-layer view so the picker re-reads server-derived state (never optimistic). */
export async function setModelDefault(model: string | null): Promise<ModelDefault> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/me/preferences`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ default_model: model }),
  })
  if (!res.ok) throw new ApiError("Failed to save your default model.", res.status)
  const body = (await res.json()) as Partial<ModelDefault>
  return {
    default_model: body.default_model ?? null,
    effective_model: body.effective_model ?? null,
    locked: body.locked ?? false,
    allowed_models: body.allowed_models ?? [],
  }
}

// Phase 111.1 EMBED-05 — re-embed lifecycle (Plan 05 backend). Counts are derived
// live from document_chunks on every fetch (the source of truth — reconcile-on-fetch,
// D-v2.5-03); `status` is a cosmetic hint reconciled against the counts (counts win).
export interface ReembedProgress {
  status: "idle" | "running" | "partial" | "complete" | "failed"
  total: number | null
  re_embedded: number | null
  remaining: number | null
  model: string | null
  updated_at: number | null
}

/** GET /settings/reembed-progress — reconcile-on-fetch progress for the status card. */
export async function getReembedProgress(): Promise<ReembedProgress> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/reembed-progress`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get re-embed progress")
  return res.json() as Promise<ReembedProgress>
}

/** POST /settings/reembed — manual "Re-embed now" re-kick of a failed/partial run. */
export async function kickReembed(): Promise<ReembedProgress> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/reembed`, { method: "POST", headers })
  if (!res.ok) throw new Error("Failed to start re-embed")
  return res.json() as Promise<ReembedProgress>
}

/**
 * Phase 196 Plan 07 (D-18 / BUG-260718-04): `disabled_models` joins `deprecated_models` on this
 * payload — the operator-DISABLED id set, so the composer's per-thread model restore can apply
 * D-07's disabled rule BY NAME instead of inferring it from a provider's offered list.
 *
 * Both sets are OPTIONAL on the wire type and both are read with a `?? []` default at the call
 * site. That is not defensive noise: an older backend answers without the key, and a degraded
 * read must resolve to "no badge / no disabled ids" rather than to a crash in the chat composer.
 * The two sets are INDEPENDENT — a deprecated model stays selectable (D-149-05); a disabled one
 * is the thing the restore must refuse.
 */
export async function getProviders(): Promise<{ active: string; active_model: string; providers: { id: string; name: string; models: string[]; is_active: boolean }[]; deprecated_models?: string[]; disabled_models?: string[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/settings/providers`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error("Failed to get providers")
  return res.json()
}

export async function exportSkill(id: string, name: string): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}/skills/${id}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export skill")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${name.replace(/\s+/g, "-").toLowerCase()}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importSkillZip(file: File): Promise<SkillImportResult> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Import failed" }))
    throw new Error((body as { detail?: string }).detail || "Import failed")
  }
  return res.json() as Promise<SkillImportResult>
}

export async function listSkillFiles(skillId: string): Promise<SkillFile[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, { headers })
  if (!res.ok) throw new Error("Failed to list skill files")
  return res.json() as Promise<SkillFile[]>
}

export async function uploadSkillFile(skillId: string, file: File): Promise<SkillFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/skills/${skillId}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  return res.json() as Promise<SkillFile>
}

export async function deleteSkillFile(skillId: string, fileId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/files/${fileId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new Error("Failed to delete skill file")
}

// ── Audit Log (Phase 31) ────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  action_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogsResponse {
  entries: AuditEntry[]
  total: number
  page: number
  page_size: number
}

export async function getAuditLogs(
  page = 1,
  since?: string,
  actionType?: string,
): Promise<AuditLogsResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ page: String(page), page_size: "50" })
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs?${params}`, { headers })
  if (!res.ok) throw new Error("Failed to load audit log")
  return res.json() as Promise<AuditLogsResponse>
}

export async function exportAuditLogs(since?: string, actionType?: string): Promise<void> {
  const token = await getAuthToken()
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export audit log")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "audit-log.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Knowledge Health types ────────────────────────────────────────────────────

export interface MostRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  retrieval_count: number
  last_retrieved_at: string
}

export interface NeverRetrievedDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
}

export interface LowConfidenceDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  avg_similarity: number
}

export interface StaleDoc {
  document_id: string
  filename: string
  folder_id: string | null
  created_at: string
  file_size: number
  days_stale: number
}

export interface HealthSummary {
  total_documents: number
  most_retrieved: MostRetrievedDoc[]
  never_retrieved: NeverRetrievedDoc[]
  low_confidence: LowConfidenceDoc[]
  stale: StaleDoc[]
}

export interface HealthOverview {
  health_score: number
  high_confidence_rate: number
  total_documents: number
  retrieved_this_month: number
  never_retrieved_count: number
  stale_count: number
  low_confidence_queries_count: number
  coverage_percent: number
  avg_confidence: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface RetrievalTrendPoint {
  date: string
  retrieval_count: number
  unique_documents: number
}

export interface LowConfidenceQuery {
  query_text: string
  avg_similarity: number
  occurrence_count: number
  document_count: number
}

// -- Feedback types -----------------------------------------------------------

export interface FeedbackRequest {
  message_id: string
  rating: "positive" | "negative"
  reason?: string | null
}

export interface DownvotedDocument {
  document_id: string
  filename: string
  folder_id: string | null
  downvote_count: number
}

export interface FeedbackStats {
  positive_rate: number
  total_ratings: number
  positive_count: number
  negative_count: number
  downvoted_documents: DownvotedDocument[]
}

// ── Knowledge Health API functions ────────────────────────────────────────────

/**
 * @deprecated Use paginated endpoints (getHealthOverview, getMostRetrieved, etc.) instead.
 */
export async function getKnowledgeHealthSummary(staleDays = 90): Promise<HealthSummary> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/summary?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health summary")
  return res.json() as Promise<HealthSummary>
}

export async function getHealthOverview(staleDays = 90): Promise<HealthOverview> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/overview?stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load health overview")
  return res.json() as Promise<HealthOverview>
}

export async function getMostRetrieved(offset = 0, limit = 20): Promise<PaginatedResponse<MostRetrievedDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/most-retrieved?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load most retrieved documents")
  return res.json() as Promise<PaginatedResponse<MostRetrievedDoc>>
}

export async function getNeverRetrieved(offset = 0, limit = 20): Promise<PaginatedResponse<NeverRetrievedDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/never-retrieved?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load never retrieved documents")
  return res.json() as Promise<PaginatedResponse<NeverRetrievedDoc>>
}

export async function getStaleDocs(offset = 0, limit = 20, staleDays = 90): Promise<PaginatedResponse<StaleDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/stale?offset=${offset}&limit=${limit}&stale_days=${staleDays}`, { headers })
  if (!res.ok) throw new Error("Failed to load stale documents")
  return res.json() as Promise<PaginatedResponse<StaleDoc>>
}

export async function getLowConfidenceDocs(offset = 0, limit = 20): Promise<PaginatedResponse<LowConfidenceDoc>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/low-confidence/documents?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low confidence documents")
  return res.json() as Promise<PaginatedResponse<LowConfidenceDoc>>
}

export async function getLowConfidenceQueries(offset = 0, limit = 20): Promise<PaginatedResponse<LowConfidenceQuery>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/low-confidence/queries?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low confidence queries")
  return res.json() as Promise<PaginatedResponse<LowConfidenceQuery>>
}

export async function getRetrievalTrend(days = 30): Promise<RetrievalTrendPoint[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/knowledge-health/retrieval-trend?days=${days}`, { headers })
  if (!res.ok) throw new Error("Failed to load retrieval trend")
  return res.json() as Promise<RetrievalTrendPoint[]>
}

// ── Phase 119 (DGOV-01/02) — Document Governance Health ──────────────────────
// Three read-only fetch helpers wrapping the Plan-01 `document_governance` router
// (`backend/app/api/document_governance.py`). Each mirrors the knowledge-health
// helpers above verbatim — getAuthHeaders() + throw-on-non-ok — and returns the
// shared `{items, total, offset, limit}` PaginatedResponse shape the 3 stacked
// Governance cards consume. Read-only / owner-scoped server-side; no write path.

/** A broken-relationship row (D-119-3). `readable_doc_id` (aliased `document_id`)
 *  is the OPENABLE end of a dangling edge — it MAY be null when both ends are
 *  gone, so the row link-out must guard the click. The broken end can't be opened. */
export interface GovBrokenItem {
  relationship_id: string
  rel_type: string
  broken_doc_id: string
  /** The openable end (the broken end's surviving counterpart). Null when both ends are gone. */
  readable_doc_id: string | null
  /** Alias of `readable_doc_id` — the doc the row navigates to. Null guards the link-out. */
  document_id: string | null
}

/** An unclassified-document row (D-119-4) — a doc with a pending
 *  `_classification.status == "suggested"`. */
export interface GovUnclassifiedItem {
  document_id: string
  filename: string
  folder_id: string | null
  suggested_folder_name?: string | null
}

/** A low-confidence-metadata row (D-119-5) — a doc with any extracted field whose
 *  `_confidence[field] < 0.5`. `min_confidence` is the worst field's RAW score
 *  (rendered honestly via the 112 ConfidenceChip, never fabricated). */
export interface GovLowConfidenceItem {
  document_id: string
  filename: string
  folder_id: string | null
  low_fields: Record<string, number>
  min_confidence: number
}

// Phase 148 (VIS-01 / D-04): the three `document-governance` signal reads are
// governed by `require_visible('governance_health')` (148-05). They throw `ApiError`
// (carrying `res.status`) — NOT a plain Error — so a mid-session governance_health
// tighten surfaces the 403 through the D-04 graceful bounce (GovernancePage auto-fetches
// all three on mount, so a non-operator landing after a tighten bounces home instead of
// dead-ending). ApiError extends Error, so existing message-only catch sites are unaffected.
export async function getGovBroken(offset = 0, limit = 20): Promise<PaginatedResponse<GovBrokenItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/broken-relationships?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load broken relationships", res.status)
  return res.json() as Promise<PaginatedResponse<GovBrokenItem>>
}

export async function getGovUnclassified(offset = 0, limit = 20): Promise<PaginatedResponse<GovUnclassifiedItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/unclassified?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load unclassified documents", res.status)
  return res.json() as Promise<PaginatedResponse<GovUnclassifiedItem>>
}

export async function getGovLowConfidence(offset = 0, limit = 20): Promise<PaginatedResponse<GovLowConfidenceItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/low-confidence?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load low-confidence metadata", res.status)
  return res.json() as Promise<PaginatedResponse<GovLowConfidenceItem>>
}

export async function moveDocument(id: string, folderId: string | null): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/move`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ folder_id: folderId }),
  })
  if (!res.ok) throw new Error("Failed to move document")
  return res.json() as Promise<Document>
}

export async function reingestDocument(id: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/reingest`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Failed to reingest document")
  return res.json() as Promise<Document>
}

/** Phase 112 (META-02) — manual single-field metadata edit. Clones the
 *  `moveDocument` PATCH shape. The body is `{ field, value }` ONLY — the client
 *  MUST NOT send `source`: the server hard-stamps provenance (`_source='user'`)
 *  so the client can never assert it (T-112-03-02). Returns the updated Document;
 *  the panel reconciles by calling `loadDocuments()` after a 200. */
export async function updateDocumentMetadata(id: string, field: string, value: unknown): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${id}/metadata`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ field, value }),
  })
  if (!res.ok) throw new Error("Failed to update metadata")
  return res.json() as Promise<Document>
}

/** Phase 112 (META-02) — the caller's own + global metadata field definitions.
 *  Thin consumer of the already-secured `GET /metadata-fields` (own-or-global
 *  scoping enforced server-side, T-112-03-03). The panel renders the union of
 *  built-in fields + enabled custom defs. */
export async function listMetadataFields(): Promise<MetadataFieldDef[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/metadata-fields`, { headers })
  if (!res.ok) throw new Error("Failed to load metadata fields")
  return res.json() as Promise<MetadataFieldDef[]>
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 114 (VIEW-03 / UX-01) — saved-view ("virtual folder") CRUD + count.
//
// Thin consumers of the already-leak-safe document-views router (Plans 02/03):
//   POST   /document-views                       create a named saved view
//   GET    /document-views                       list own + global views
//   DELETE /document-views/{id}                  delete an owned view
//   GET    /document-views/{id}/resolve?count_only=true   → {total: N}
//   GET    /document-views/{id}/resolve                    → {documents, total}
//
// The client ONLY assembles the `filter_expr` AST — ALL field-whitelist
// validation + value binding happens server-side (T-114-05-01: the client is not
// a trust boundary). Mirrors the `listMetadataFields` fetch-wrapper conventions.
// ────────────────────────────────────────────────────────────────────────────

/** POST /document-views — persist the current filter as a named saved view
 *  (D-114-1: Save-as-view just persists what you're looking at). The server
 *  hard-sets `is_system_global=false` (the body never supplies it). Returns the new
 *  `SavedView`. */
export async function createView(
  name: string,
  filter_expr: ViewFilter,
  folder_scope?: string | null,
): Promise<SavedView> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      filter_expr,
      ...(folder_scope ? { folder_scope } : {}),
    }),
  })
  if (!res.ok) throw new Error("Failed to save view")
  return res.json() as Promise<SavedView>
}

/** PATCH /document-views/{id} — update an OWNED saved view in place (the
 *  `ViewUpdate` body shape: every field optional, the backend applies only the
 *  keys present via `exclude_none=True`). Used by the FilterBar's edit-on-save
 *  path (D-114-3): after "Edit view" a Save PATCHes the SAME row instead of
 *  POSTing a new one. Mirrors `createView`'s auth-header + fetch shape; the
 *  backend re-runs whitelist validation when `filter_expr` is present and
 *  returns the updated view. 404 on a cross-user / absent id (never 403). */
export async function updateView(
  id: string,
  body: { name?: string; filter_expr?: ViewFilter; folder_scope?: string | null },
): Promise<SavedView> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update view")
  return res.json() as Promise<SavedView>
}

/** GET /document-views — the caller's own + global saved views (leak-safe
 *  server-side, Phase 113). Selecting one loads its `filter_expr` back into the
 *  filter bar (D-114-1). */
export async function listViews(): Promise<SavedView[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views`, { headers })
  if (!res.ok) throw new Error("Failed to list views")
  return res.json() as Promise<SavedView[]>
}

/** DELETE /document-views/{id} — remove an owned view (204; 404 on a cross-user
 *  miss, never 403 — D-113-4). Idempotent from the UI's perspective. */
export async function deleteView(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete view")
}

/** GET /document-views/{id}/resolve — resolve a SAVED view. `count_only` returns
 *  just `{total: N}` (the live builder count + per-view sidebar badges, D-114-15);
 *  the full resolve returns `{documents, total}`. The returned `documents` are
 *  plain rows (no response_model) so `_source`/`_confidence` survive (112 CR-01). */
export async function resolveView(
  id: string,
  opts: { count_only?: boolean } = {},
): Promise<{ documents?: Document[]; total: number }> {
  const headers = await getAuthHeaders()
  const qs = opts.count_only ? "?count_only=true" : ""
  const res = await fetch(`${API_BASE}/document-views/${id}/resolve${qs}`, { headers })
  if (!res.ok) throw new Error("Failed to resolve view")
  return res.json() as Promise<{ documents?: Document[]; total: number }>
}

/** POST /document-views/resolve — STATELESS ad-hoc resolve/count for an UNSAVED
 *  filter (114 CR-01). Carries the `filter_expr` AST inline; the backend runs the
 *  SAME caller-scoped own+global two-leg resolve as the saved-view route but writes
 *  NO `document_views` row and NO audit entry — so it is safe to call on every
 *  debounced keystroke. `count_only` returns `{total}`; otherwise `{documents,
 *  total}` (plain rows so `_source`/`_confidence` survive, 112 CR-01).
 *
 *  This REPLACES the old `createView → resolve → deleteView` dance, which fired a
 *  `view.create` governance-audit row per keystroke that was never cleaned up
 *  (audit-log pollution) and double-round-tripped (the page + the bar each ran
 *  their own transient cycle). */
export async function resolveAdHoc(
  filter_expr: ViewFilter,
  opts: { count_only?: boolean } = {},
): Promise<{ documents?: Document[]; total: number }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-views/resolve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ filter_expr, count_only: opts.count_only ?? false }),
  })
  if (!res.ok) throw new Error("Failed to resolve filter")
  return res.json() as Promise<{ documents?: Document[]; total: number }>
}

/** Live "N documents match" count for an AD-HOC (unsaved) filter (D-114-2).
 *  Thin count-only wrapper over the stateless `resolveAdHoc` endpoint (114 CR-01) —
 *  NO transient view, NO audit pollution. An empty filter (`conditions: []`) is "no
 *  narrowing" and needs no round-trip — the caller short-circuits before calling. */
export async function resolveFilterCount(filter_expr: ViewFilter): Promise<number> {
  const { total } = await resolveAdHoc(filter_expr, { count_only: true })
  return total
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 117 (REL-02 / UX-01) — document-relationships read + create + remove.
//
// Thin consumers of the leak-safe relationship router:
//   GET    /document-relationships?document_id={id}   read outgoing + incoming
//                                                      links (the net-new Plan 02
//                                                      read seam) → RelatedDocumentsResponse
//   POST   /document-relationships                     create an OUTGOING link
//                                                      (visible-both gate server-side)
//   DELETE /document-relationships/{id}                remove an owned link (204;
//                                                      404-tolerant own-scoped delete)
//
// The client is NOT a trust boundary — the per-viewer readability re-check + the
// visible-both create gate are enforced server-side. A masked row arrives with
// `document_id: null` (D-117-8); the client never sees the hidden id/title. Mirrors
// the `document-views` family fetch-wrapper conventions (getAuthHeaders + throw-on-
// non-ok + the 404-tolerant DELETE).
// ────────────────────────────────────────────────────────────────────────────

/** GET /document-relationships?document_id= — a document's outgoing + incoming
 *  typed links (the Plan 02 read seam). Returns the plain dict the panel renders
 *  (subject + total + rows); a row's `document_id` is null for a masked "no access"
 *  endpoint (D-117-8). 404 on an unreadable/unknown subject → throws (the section
 *  renders its honest error state, distinct from empty — D-117-10). */
export async function listRelationships(documentId: string): Promise<RelatedDocumentsResponse> {
  const headers = await getAuthHeaders()
  // encodeURIComponent the id (IN-02, folded into WR-01): doc ids are UUIDs today so
  // this is safe in practice, but defensive URL construction keeps a non-UUID/whitespace
  // value from corrupting the query (and pairs with the route's uniform-404 hardening).
  const res = await fetch(
    `${API_BASE}/document-relationships?document_id=${encodeURIComponent(documentId)}`,
    { headers },
  )
  if (!res.ok) throw new Error("Failed to load relationships")
  return res.json() as Promise<RelatedDocumentsResponse>
}

/** POST /document-relationships — create an OUTGOING link from the open document
 *  (D-117-1: outgoing-only authoring). Body is `{ source_doc_id, target_doc_id,
 *  rel_type }` EXACTLY (mirrors `RelationshipCreate`). The server runs the
 *  visible-both gate + self-link guard; a non-ok (422 = unseeable endpoint /
 *  self-link / forged type, uniform) throws. Idempotent server-side (D-116-6).
 *  Returns the persisted `Relationship` (the POST 201 body).
 *
 *  Throws an `ApiError` carrying `res.status` (WR-03): a 422 is a PERMANENT
 *  rejection (self-link / unseeable / forged type — uniform server-side, never
 *  succeeds on retry), so the caller can render a non-retry-implying message and
 *  reserve "try again" for network/5xx. */
export async function createRelationship(
  source_doc_id: string,
  target_doc_id: string,
  rel_type: RelType,
): Promise<Relationship> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships`, {
    method: "POST",
    headers,
    body: JSON.stringify({ source_doc_id, target_doc_id, rel_type }),
  })
  if (!res.ok) throw new ApiError("Failed to create link", res.status)
  return res.json() as Promise<Relationship>
}

/** DELETE /document-relationships/{id} — remove an owned link (204; either
 *  direction — D-117-2). Own-scoped server-side, so a cross-user/absent id is a
 *  uniform 404 → treated as a no-op (404-tolerant, the `deleteView` pattern):
 *  the link is gone either way, so a 404 is not an error from the UI's view. */
export async function deleteRelationship(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error("Failed to remove link")
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 118 (CLASS-01 / CLASS-03) — classification-rule CRUD + accept/dismiss.
//
// Thin consumers of the leak-safe classification-rules router (Plans 02/03):
//   GET    /classification-rules                          list own + global rules
//   POST   /classification-rules                          create a rule (is_system_global server-owned)
//   PATCH  /classification-rules/{id}                      update an owned rule (incl. the enabled toggle)
//   DELETE /classification-rules/{id}                      delete an owned rule (204; 404-tolerant)
//   PATCH  /documents/{id}/classification/accept           accept the suggestion (moves + stamps prior_folder_id)
//   PATCH  /documents/{id}/classification/dismiss          dismiss the suggestion (clears _classification; no move)
//
// The client is NOT a trust boundary — the `match_expr` whitelist validation, the
// `is_system_global` hard-set, the own+global leak-safe reads, and the accept-move folder
// re-check are all enforced server-side. The builder's "would match N" live count
// REUSES the existing `resolveAdHoc`/`resolveFilterCount` (a rule's `match_expr` is
// the SAME `ViewFilter` AST) — NO new count fn, NO new backend endpoint. Undo reuses
// the existing `moveDocument(id, prior_folder_id)` — reversible by construction
// (D-118-6). Mirrors the `document-views` family fetch-wrapper conventions
// (getAuthHeaders + throw-on-non-ok + the 404-tolerant DELETE).
// ────────────────────────────────────────────────────────────────────────────

/** GET /classification-rules — the caller's own + global classification rules
 *  (leak-safe server-side, the `.or_()` own+global predicate). The Automation
 *  sidebar group + the rules page render these. */
export async function listRules(): Promise<ClassificationRule[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules`, { headers })
  if (!res.ok) throw new Error("Failed to list rules")
  return res.json() as Promise<ClassificationRule[]>
}

/** POST /classification-rules — create a named rule. The body is
 *  `{ name, match_expr, suggest_folder_id }` ONLY — it NEVER supplies `is_system_global`
 *  (the server hard-sets it false; mirrors `createView`, T-118-04-01). The server
 *  re-runs the `match_expr` whitelist + operand validation (the client is not a
 *  trust boundary). Returns the new `ClassificationRule`. */
export async function createRule(
  name: string,
  match_expr: ViewFilter,
  suggest_folder_id: string | null,
): Promise<ClassificationRule> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, match_expr, suggest_folder_id }),
  })
  if (!res.ok) throw new Error("Failed to create rule")
  return res.json() as Promise<ClassificationRule>
}

/** PATCH /classification-rules/{id} — update an OWNED rule in place (the
 *  `RuleUpdate` body: every field optional, the backend applies only the keys
 *  present). The `enabled` toggle rides THIS path — no separate endpoint. The
 *  backend re-runs whitelist validation when `match_expr` is present and returns
 *  the updated rule. 404 on a cross-user / absent id (never 403). */
export async function updateRule(
  id: string,
  body: { name?: string; match_expr?: ViewFilter; suggest_folder_id?: string | null; enabled?: boolean },
): Promise<ClassificationRule> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed to update rule")
  return res.json() as Promise<ClassificationRule>
}

/** DELETE /classification-rules/{id} — remove an owned rule (204; 404 on a
 *  cross-user miss, never 403). Idempotent from the UI's perspective (the
 *  `deleteView` 404-tolerant pattern). */
export async function deleteRule(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/classification-rules/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete rule")
}

/** PATCH /documents/{id}/classification/accept — accept the doc's active
 *  classification suggestion. The server moves the doc to the suggested folder,
 *  stamps `prior_folder_id` (the Undo target, D-118-6), flips the suggestion
 *  `status` to `"accepted"`, and writes the `classification.apply` audit AFTER
 *  the move succeeds. Returns the updated Document; the section reconciles by
 *  re-fetching (not optimistic). Undo = `moveDocument(id, prior_folder_id)`. */
export async function acceptClassification(docId: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${docId}/classification/accept`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to accept classification")
  return res.json() as Promise<Document>
}

/** PATCH /documents/{id}/classification/dismiss — dismiss the doc's active
 *  classification suggestion. The server clears `_classification` from the doc's
 *  metadata; NO move, NO audit. Returns the updated Document; the section
 *  reconciles by re-fetching (not optimistic). */
export async function dismissClassification(docId: string): Promise<Document> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents/${docId}/classification/dismiss`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) throw new Error("Failed to dismiss classification")
  return res.json() as Promise<Document>
}

// -- Feedback API functions ---------------------------------------------------

/**
 * Submit thumbs-up or thumbs-down rating for an assistant message.
 * Returns raw Response so callers can inspect status 409 (already rated) themselves.
 * Throws only on network errors, never on HTTP error status codes.
 */
export async function submitFeedback(body: FeedbackRequest): Promise<Response> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  return res
}

export async function getFeedbackStats(): Promise<FeedbackStats> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/feedback/stats`, { headers })
  if (!res.ok) throw new Error("Failed to load feedback stats")
  return res.json() as Promise<FeedbackStats>
}

// ── Workflow authoring API (Phase 103, REQ-1 / REQ-2 / REQ-6) ────────────────
//
// The client layer the Builder (Plan 04), the publish gauntlet (Plan 05), and
// the Workflows page (Plan 06) all consume. Mirrors the new /workflows authoring
// routes from Plans 01/02 (NEVER threads.py). The load-bearing contract is that
// the client NEVER re-derives a server verdict and NEVER swallows a 409/404 as
// success (threat T-103-03-01 / -04).

/** A permissive `WorkflowDefinition` JSONB alias — the Builder (Plan 04) refines
 *  the real shape. The authoring CRUD/generate fns pass it through opaquely. */
export type WorkflowDefinitionJSON = Record<string, unknown>

/** Mirror of the backend `PublishVerdict` (api/workflows.py:84-93). Rendered
 *  VERBATIM by the publish-gauntlet UI — the client never re-derives any field.
 *  `named_failures` is POLYMORPHIC across stages (lint `{code,phase,message}` /
 *  judge `{criterion,score,evidence}` / `{summary}` / bare string) so it is typed
 *  `unknown[]` and rendered by KEY-DETECTION in Plan 05 (D-103-CONF-3). */
export interface PublishVerdict {
  published: boolean
  version: number | null
  golden_run_id: string | null
  blocked_stage: string | null
  named_failures: unknown[]
}

/** A lint failure entry (the 5 LOWERCASE `LintError.code` literals:
 *  bad_index / unsatisfiable_skip / orphan_phase / no_terminal / input_unsatisfied). */
export interface LintError {
  code: string
  phase: string
  message: string
}

/** A draft row from GET /workflows/drafts (owner-scoped on the backend).
 *
 *  Phase 103-06 (REQ-7 D9/D10): `definition` is the ADDITIVE full WorkflowDefinition
 *  JSONB the drafts-shelf card uses to derive the tier badge + phase chain
 *  client-side. Optional — pre-103 shelf callers ignore it. */
export interface WorkflowDraftRow {
  id: string
  slug: string
  version: number
  name: string | null
  definition?: WorkflowDefinitionJSON | null
  /**
   * OPAQUE concurrency token (Phase 186 / D-186-07). Echo it VERBATIM on the next
   * PATCH and treat it as bytes with no internal structure.
   *
   * NEVER PARSE IT INTO A JS DATE VALUE — not with the `Date` constructor, not with
   * `Date.parse`, not with any library that wraps either. Postgres keeps microseconds
   * and a JS date value keeps only milliseconds, so a parsed-and-re-rendered token is
   * truncated and matches ZERO rows: every save would then refuse as stale (probed
   * against the live database, 2026-08-01). The server renders it and the server
   * compares it; this client only carries it.
   *
   * ⚠ IF YOU CAME HERE WANTING A TIMESTAMP, THE FIELD YOU WANT IS `updated_at` DIRECTLY
   * BELOW. Phase 192.1 (D-16) added it as a SEPARATE field precisely because this one must
   * never be parsed as a date, even though both are rendered from the same
   * `workflow_definitions.updated_at` column server-side. Two fields off one column is the
   * intended shape, not duplication.
   */
  token: string
  /**
   * Phase 192.1 (LIB-05 / D-15) — when this draft last changed, ISO-8601 as the server
   * rendered it. Feeds the library identity line's "changed <rel>" segment.
   *
   * PLACED HERE, ADJACENT TO `token`, ON PURPOSE: this is where a reader wondering why there
   * are two near-identical timestamps will look. See the ⚠ paragraph on `token` above — the
   * token is opaque and comparison-only; this field is formattable and display-only. They
   * are never interchangeable, and collapsing them makes every save after the first refuse
   * as stale.
   *
   * Optional and nullable on the same stale-deploy contract as `PublishedWorkflow`:
   * `undefined` is "the wire did not say", rendered as no `changed` segment.
   */
  updated_at?: string | null
  /**
   * Phase 192.2 (LIB-06 / D-07 / D-08) — when this DRAFT last ran, and what that run did.
   * The mirror of the two fields on `PublishedWorkflow`; read their docblocks for the
   * three-state rule, which is identical here and is the load-bearing part.
   *
   * ⚠ A DRAFT'S RUN IS ITS GOLDEN RUN, AND COUNTING IT IS DELIBERATE. A draft cannot be Run
   * from the library — publish IS the test — so the only runs a draft has are the ones the
   * publish gauntlet made. *"Your test run failed"* is exactly the answer LIB-06 asks for on
   * a shelf that is 69% drafts, so the join does not exclude them.
   *
   * ⚠ AND NEITHER OF THESE IS `token`. See the ⚠ paragraph on that field above: it is opaque
   * by contract and parsing it as a date breaks every later save. These two are display
   * fields off a different table entirely.
   */
  last_run_at?: string | null
  /**
   * Phase 192.2 (LIB-06 / D-08) — the RAW `workflow_runs.status` of the run `last_run_at`
   * describes. The mirror of `PublishedWorkflow.last_run_status`; read that docblock for the
   * three-state rule and for why it is `string` rather than a union.
   *
   * ⚠ WR-02-LOOKALIKE-LAST-RUN-STATUS — THREE IDENTICALLY-TYPED `last_run_status?: string | null`
   * FIELDS EXIST IN THIS FILE, AND A SWAP BETWEEN ANY TWO OF THEM TYPECHECKS. They live on
   * `ThreadWorkflowState`, on `PublishedWorkflow` and on `WorkflowDraftRow`. Named by TYPE and
   * never by line number, because a line number rots on the next edit to this 6,000-line file.
   *
   *   · `ThreadWorkflowState.last_run_status` — THE LIVE THREAD's last `workflow_runs` row,
   *     keyed to `last_workflow_run_id`. Paired with `last_run_created_at`.
   *   · `PublishedWorkflow.last_run_status` and `WorkflowDraftRow.last_run_status` — THE
   *     LIBRARY ROW's last run, OWNER-SCOPED (`r.user_id = $1`). Both paired with `last_run_at`.
   *
   * ⚠ AND THE TWO TIMESTAMP NAMES ARE THE SAME COLUMN. `last_run_created_at` (on
   * `ThreadWorkflowState`) and `last_run_at` (on the two library rows) BOTH render
   * `workflow_runs.created_at`. That divergence is KNOWN AND DECIDED (192.2-10 DEC-10-B), not an
   * oversight: renaming either one is a wire change across the backend, three serializers, two
   * interfaces here and both library normalizers — a large blast radius to make two names agree
   * about a readability defect, taken inside a gap-closure round, on the hottest file in this
   * repository. `last_run_at` is also the better name for the question the LIBRARY asks (*when
   * did it last run*), where `last_run_created_at` names the column's provenance for a surface
   * that also shows `last_run_updated_at`. The rename is DECLINED; the cross-reference is the fix.
   *
   * The marker token above is bound by `apiRunFields.fences.test.ts`, which counts THREE
   * declarations and THREE markers. Deleting one of these paragraphs reds it.
   */
  last_run_status?: string | null
  /**
   * Phase 192.2 (LIB-06 / CR-01) — the mirror of `PublishedWorkflow.has_any_run`; read THAT
   * docblock for the three states and the disclosure budget, which are identical here and are
   * the load-bearing part.
   *
   * ⚠ MIRRORED FOR CONSISTENCY, AND SAYING SO IS THE POINT. `/workflows/drafts` is already
   * scoped to `created_by = $1`, so on this feed the caller is normally the only person with
   * runs and the row-level bit AGREES with the two owner-scoped fields above. That agreement is
   * a property of THIS FEED, not an invariant of the pair — leaving the field off here would
   * have made *"the two facts agree"* an unstated assumption that the next feed quietly breaks.
   */
  has_any_run?: boolean | null
}

/**
 * What a draft WRITE answers with — the create (201) and the PATCH (200) return the
 * identical shape, so both share this type (Phase 186 / D-186-07).
 *
 * `token` is the value the NEXT write must echo. A save that dropped it would leave the
 * following one guarded by a token the server has already superseded, which is a
 * self-inflicted stale refusal on the second keystroke.
 *
 * NOTE ON THE PATCH's RETURN TYPE. `updateWorkflowDraft` was declared as returning
 * `WorkflowDefinitionJSON`; that was a type lie from the start — the route has always
 * answered `DraftCreateResponse` (`api/workflows.py`), and nothing read the result, so
 * nothing noticed. It is corrected here rather than left, because the autosave hook now
 * genuinely reads the response to chain the next write.
 */
export interface WorkflowDraftWriteResult {
  id: string
  version: number
  token: string
}

/** Phase 197 (D-13) — the server's publish-readiness verdict for ONE generated draft.
 *  THREE representable states, and the THIRD IS THE ABSENCE OF THIS WHOLE OBJECT:
 *  `{status:"present"}` · `{status:"missing", message}` · the field not there at all.
 *  ⚠ ABSENT MEANS THE SERVER SAID NOTHING — never that everything is fine. A
 *  `readiness ?? {}` default, or a `=== "missing"` read whose false branch renders a
 *  green tick, collapses that third state into the first. Both are the shipped floor
 *  in one shape: `useModelRegistry`'s (a failed read is `status:"failed"`, never an
 *  empty success) and `model_registry`'s (an ABSENT override row means ENABLED).
 *  ⚠ ONE ENTRY, DELIBERATELY. Measured across the whole publish gauntlet, stage 1's
 *  `business_requirement` is the ONLY definition-level predicate — nothing anywhere
 *  refuses a publish for a missing knowledge-base binding, a missing document, the
 *  AI-chosen name or the deliverable. A second key here would be a claim no gate makes.
 *  ⚠ IT RIDES THE `ok:true` ARM ALONE. A failed generation carries no verdict
 *  server-side, so reading one off the failure arm is a typecheck error here too. */
export type GenerateReadiness = {
  business_requirement:
    | { status: "present" }
    | { status: "missing"; message: string }
}

/** The structured result of POST /workflows/generate. The route returns HTTP 200
 *  even on a FAILED generation (`ok:false`) — read the body, never throw on it. */
export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON; readiness?: GenerateReadiness }
  | { ok: false; error: string; detail?: string }

/** The body of POST /workflows/generate (D-103-CONF-2 / D-103-3 template supply). */
export interface GenerateWorkflowBody {
  describe: string
  project_folder_id?: string | null
  template_asset_id?: string | null
  template_placeholders?: string[]
}

/** The 4 distinguished outcomes of POST /workflows/{id}/publish. A binary
 *  `200 = ok / else = error` handler is FORBIDDEN — a 200 can carry a BLOCK
 *  (`published:false`), and 400/404/409 each mean something distinct. */
export type PublishOutcome =
  | { kind: "verdict"; verdict: PublishVerdict }
  | { kind: "business_requirement"; verdict: PublishVerdict }
  | { kind: "not_found" }
  | { kind: "already_published" }

/** A published-row mutation (or a cross-user attempt resolving to a published
 *  row) → HTTP 409. Thrown (never swallowed) so the UI surfaces it instead of a
 *  silent overwrite (T-103-03-04). */
export class WorkflowConflictError extends Error {
  constructor(message = "workflow is published and cannot be modified") {
    super(message)
    this.name = "WorkflowConflictError"
  }
}

/** A draft mutation against a non-existent / non-owned definition → HTTP 404. */
export class WorkflowNotFoundError extends Error {
  constructor(message = "workflow not found") {
    super(message)
    this.name = "WorkflowNotFoundError"
  }
}

/**
 * The draft moved since this session read it → HTTP 409 coded `stale_token`
 * (Phase 186 / D-186-09). Another tab, another device, or the same author's older
 * window wrote first; this write matched 0 rows and was refused rather than applied.
 *
 * `currentToken` is the token the server holds NOW. It exists so that "overwrite with
 * what's on screen" costs ONE more PATCH instead of a re-read followed by a PATCH.
 * Returning it leaks nothing: the server's disambiguating re-read is owner-scoped, so
 * this is a token for a row the caller already owns. It is `null` when the refusal
 * carried no token, and it is opaque here exactly as everywhere else — echo it, never
 * inspect it.
 */
export class WorkflowStaleTokenError extends Error {
  readonly currentToken: string | null
  constructor(currentToken: string | null = null) {
    super("this draft was changed somewhere else since you loaded it")
    this.name = "WorkflowStaleTokenError"
    this.currentToken = currentToken
  }
}

/**
 * `PATCH /workflows/{id}` answered HTTP 422 — the draft's SHAPE was rejected before the
 * handler ran, so nothing was written (Phase 186 / D-186-04). A mid-edit definition can
 * legitimately reach this state, and the honest answer is "not saved, and here is why",
 * never a false `Saved ✓`.
 *
 * THE RAW BODY IS LOGGED HERE AND CARRIED NO FURTHER — the
 * `WorkflowValidateUnreadableError` precedent, copied deliberately. The constructor
 * writes it to the console once, at this boundary, and this error's `message` is a FIXED
 * business-plain sentence with nothing interpolated into it. A validation body is a list
 * of internal field paths and framework phrasing; pretty-printing it onto an authoring
 * surface aimed at business users would leak implementation detail and still not say what
 * to do. The class exists so the hook can branch on `name` rather than parse a string.
 */
export class WorkflowDraftUnreadableError extends Error {
  constructor(rawBody?: unknown) {
    super("the draft's shape could not be read, so nothing was saved")
    this.name = "WorkflowDraftUnreadableError"
    // Logged, never shown. One line, at the boundary that received it.
    console.warn("PATCH /workflows/{id} → 422 (shape rejected before the handler):", rawBody)
  }
}

/**
 * Phase 193 (AUTH-03, piece 2) — the descriptor `POST /workflows/{id}/template` returns.
 *
 * FIELD-FOR-FIELD the backend's `TemplateAssetRef` (`workflows.py:1617`), which is itself
 * field-for-field `app.models.harness.AssetRef`. That identity is the whole contract: the
 * object goes STRAIGHT into `definition.assets[]` and the `extra='forbid'` WorkflowDefinition
 * accepts it unchanged, so no client-side re-shaping exists to drift.
 *
 * `kind` is the single-value literal, not `string` — this door mints templates and never
 * `reference` assets, and typing it wide would let a caller write an asset the run engine's
 * `resolve_template_source` Branch 1 would silently skip.
 */
export interface WorkflowTemplateAsset {
  kind: "template"
  asset_id: string
  filename: string
  mime: string
}

/**
 * Phase 193 (AUTH-03) — `POST /workflows/{id}/template` refused, or never arrived.
 *
 * It carries the STATUS and the server's `detail` sentence SEPARATELY rather than one
 * pre-worded message, because the three refusals mean three different things to the person
 * looking at the panel and only the caller knows which surface is asking:
 *   • `404` — the workflow is gone or is not theirs (deliberately indistinguishable
 *     server-side, so the client must not invent a distinction either).
 *   • `422` — the FILE was refused. The backend's detail is a plain, actionable sentence by
 *     contract ("A workflow template must be a .docx, .pptx or .xlsx document (got .png).",
 *     "File too large. Maximum size is 10 MB.") and is safe to show verbatim.
 *   • `502` — Storage write failed. Also a clean sentence, never a traceback.
 * `"network"` is the request that never got an answer at all.
 *
 * `detail` is `null` whenever the body was missing or unreadable — a caller must therefore
 * always have a fallback sentence and can never render `null` at a person.
 */
export class WorkflowTemplateUploadError extends Error {
  readonly status: number | "network"
  readonly detail: string | null
  constructor(status: number | "network", detail: string | null) {
    super(detail ?? `workflow template upload failed (${status})`)
    this.name = "WorkflowTemplateUploadError"
    this.status = status
    this.detail = detail
  }
}

/**
 * Phase 193 (AUTH-03, piece 2) — attach a template to a workflow AT AUTHORING TIME.
 *
 * Mirrors `uploadWorkspaceTemplate`'s FormData + Bearer shape (see its comment): the
 * NO-`Content-Type` detail is load-bearing so the browser writes the multipart boundary
 * itself, and the single part is named `file` because that is the part name the route
 * declares.
 *
 * ⚠ THIS DOES NOT WRITE THE DEFINITION, and that is the backend's deliberate contract
 * (`AUTH-03-BACKEND-SUMMARY.md`): it returns the descriptor and stops. The caller appends it
 * to `definition.assets[]` and saves through the EXISTING draft-save path, which keeps
 * exactly ONE writer on the `definition` JSONB and off Phase 186's `If-Match` token.
 */
export async function uploadWorkflowTemplate(
  definitionId: string,
  file: File,
): Promise<WorkflowTemplateAsset> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/workflows/${definitionId}/template`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
      body: formData,
    })
  } catch {
    throw new WorkflowTemplateUploadError("network", null)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const detail = typeof body?.detail === "string" ? body.detail : null
    throw new WorkflowTemplateUploadError(res.status, detail)
  }
  return (await res.json()) as WorkflowTemplateAsset
}

/**
 * What a bound template asks the step to fill in, and whether we could read it.
 *
 * `read` is not decoration. An empty `placeholders` list is ambiguous on its own —
 * it could mean *we opened the document and it carries no fill-in fields*, or *we
 * never opened it at all*. Rendering those two as the same sentence lets an author
 * conclude their template is field-less when the read simply failed, and they then
 * ship a workflow that fills nothing. The server therefore carries them separately.
 */
export interface WorkflowTemplatePlaceholders {
  read: "ok" | "unreadable"
  placeholders: string[]
}

/**
 * GET /workflows/{id}/template/placeholders — the fields a bound template expects.
 *
 * Sited HERE, beside `uploadWorkflowTemplate`, rather than beside `getGroundingBundle`:
 * it shares that function's concern (the template a workflow binds) and its gate
 * (`require_visible("workflow_authoring")`), not the palette's `require_canvas()`.
 *
 * ⚠ WHY THIS IS NOT `getGroundingBundle(assetId)`, recorded here because the older seam
 * next door looks like it should already do this job. `getGroundingBundle`'s
 * `templateAssetId` parameter feeds a backend query param typed `UUID | None`, while
 * every asset id this app mints is a Storage PATH (`{user_id}/_library/{definition_id}/…`)
 * — so passing a real one is a **measured 422** (`uuid_parsing`, before the handler
 * runs). That parameter, and the `GroundingBundle.template_placeholders` field it
 * populates, therefore remain **unused by the app**. They are left in place rather than
 * deleted: removing a shipped typed seam is a separate decision from adding this one.
 */
export async function getWorkflowTemplatePlaceholders(
  definitionId: string,
  assetId: string,
  signal?: AbortSignal,
): Promise<WorkflowTemplatePlaceholders> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/workflows/${definitionId}/template/placeholders?asset_id=${encodeURIComponent(assetId)}`,
    { headers, signal },
  )
  if (!res.ok) throw new Error(`Failed to read the template's fields (status ${res.status})`)
  return (await res.json()) as WorkflowTemplatePlaceholders
}

/**
 * Phase 193.1 (AUTH-03, D-05) — POST /workflows/template/placeholders: WHAT A DOCUMENT ASKS
 * FOR, READ FROM BYTES ALONE, BEFORE ANY WORKFLOW EXISTS.
 *
 * ── WHAT THIS IS FOR, AND WHAT IT DELIBERATELY IS NOT ────────────────────────────────────
 * It takes bytes and returns names. **It persists NOTHING** — no definition row, no Storage
 * object, no draft, not even a temporary one. That is the whole reason it needs no
 * `definitionId`: there is no row to key on because nothing is being written, which is what
 * makes it usable on the pre-draft describe screen where neither an id nor a saved asset
 * exists yet.
 *
 * ── ITS BOUND-TEMPLATE SIBLING, NAMED SO NOBODY HAS TO GUESS WHY THERE ARE TWO ───────────
 * `getWorkflowTemplatePlaceholders` above answers the same question about a document ALREADY
 * BOUND to a saved workflow, and is keyed on `(definitionId, assetId)` for exactly that
 * reason. Both return `WorkflowTemplatePlaceholders`, and the shared return type is a decision
 * rather than a convenience: ONE wire shape for both doors means a caller derives the SAME
 * reading arms from either, so the pre-draft screen and the deliverable step's rail can never
 * disagree about what an answer means.
 *
 * ── THE SHAPE, AND THE ONE DETAIL THAT IS LOAD-BEARING ───────────────────────────────────
 * `uploadWorkflowTemplate`'s body — FormData, a single part named `file` because that is the
 * part name the route declares, `Authorization: Bearer`, and **NO `Content-Type`** so the
 * browser writes the multipart boundary itself. Setting that header by hand produces a request
 * with no boundary and the server rejects it. Plus the abortable tail its sibling has and the
 * upload lacks: a pre-draft read is racing an author who may replace the file, so the caller
 * needs to cancel a read that has been overtaken.
 *
 * ⚠ NOTHING ABOUT THE CALLER IS SENT BEYOND THE TOKEN — no id, no path, no filename. The route
 * accepts no path and owns no row, so the cross-tenant class that required an owner-prefix
 * check on the bound-template door has nothing here to attach to. That is elimination by
 * construction, not a guard that could be removed.
 *
 * ── REFUSALS ARE RELAYED, NOT RE-WORDED ──────────────────────────────────────────────────
 * Throws `WorkflowTemplateUploadError` carrying `status: number | "network"` and the server's
 * own `detail` when the body has one, so a caller can show a 422's own actionable sentence
 * rather than inventing a second copy of a rule the server owns and can drift from.
 */
export async function readTemplatePlaceholdersFromFile(
  file: File,
  signal?: AbortSignal,
): Promise<WorkflowTemplatePlaceholders> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  let res: Response
  try {
    res = await fetch(`${API_BASE}/workflows/template/placeholders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the boundary
      body: formData,
      signal,
    })
  } catch {
    throw new WorkflowTemplateUploadError("network", null)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    const detail = typeof body?.detail === "string" ? body.detail : null
    throw new WorkflowTemplateUploadError(res.status, detail)
  }
  return (await res.json()) as WorkflowTemplatePlaceholders
}

/** POST /workflows — create a draft. Returns {id, version, token} (Phase 186: the
 *  token seeds the session, because three of the Builder's four entry routes create). */
export async function createWorkflowDraft(
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<WorkflowDraftWriteResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows`, {
    method: "POST",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to create workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDraftWriteResult
}

/** GET /workflows/drafts — the caller's own draft rows (owner-scoped server-side). */
export async function listDraftWorkflows(signal?: AbortSignal): Promise<WorkflowDraftRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/drafts`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list draft workflows (status ${res.status})`)
  return (await res.json()) as WorkflowDraftRow[]
}

/**
 * PATCH /workflows/{id} — update a draft. Throws WorkflowConflictError on 409
 * (the row is published/frozen) and WorkflowNotFoundError on 404 — a 409/404 is
 * NEVER swallowed as success (T-103-03-04).
 *
 * `token` is the opaque concurrency token from the response that seeded this session
 * (Phase 186 / D-186-07). When present it travels as the conditional-request header,
 * and the server refuses the write if the row moved since that token was minted. When
 * absent NO header is sent and the server runs today's unguarded UPDATE — the
 * deliberate one-release concession for a tab that was already open when the guard
 * shipped, recorded on the route as well.
 *
 * The token is inserted BEFORE `signal` in the argument list. That is safe because no
 * call site passed a third argument (verified by grep across `frontend/src`, 186-03).
 */
export async function updateWorkflowDraft(
  id: string,
  def: WorkflowDefinitionJSON,
  token?: string | null,
  signal?: AbortSignal,
): Promise<WorkflowDraftWriteResult> {
  const authHeaders = (await getAuthHeaders()) as Record<string, string>
  // The header is ADDED, never substituted: a missing token must send no header at
  // all, not an empty one (an empty conditional value would guard against nothing
  // while still reading as guarded).
  const headers: Record<string, string> =
    typeof token === "string" && token.length > 0
      ? { ...authHeaders, "If-Match": token }
      : authHeaders
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 409) {
    // Phase 186: this arm used to throw the body away, which made a second 409 cause
    // invisible. Read it, and branch on the machine `code` — NEVER on the prose, and
    // never on a narrowed union: `code` stays `string` because the SERVER owns the
    // refusal vocabulary (the `Verdict.code` rule below, VALID-03 / D-182-06). A client
    // allow-list would make this a second, drifting copy of a one-owner vocabulary.
    const body = (await res.json().catch(() => ({}))) as {
      detail?: { code?: string; token?: string }
    }
    const code = body.detail?.code
    if (code === "stale_token") throw new WorkflowStaleTokenError(body.detail?.token ?? null)
    // EVERY other value lands here: a missing body, a body that would not parse, a body
    // with no `detail`, and a code minted after this client shipped. That is today's
    // behaviour, kept deliberately — a refusal we cannot classify must never become a
    // success (the WR-02 malformed-body rule, `publishWorkflow` below).
    throw new WorkflowConflictError()
  }
  if (res.status === 422) {
    // Read the body for the LOG only; a body that will not parse must not mask the 422.
    const rawBody = await res.json().catch(() => null)
    throw new WorkflowDraftUnreadableError(rawBody)
  }
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to update workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDraftWriteResult
}

/** DELETE /workflows/{id} — delete a draft (204). Throws WorkflowConflictError on
 *  409 (published/frozen) and WorkflowNotFoundError on 404. */
export async function deleteWorkflowDraft(id: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "DELETE",
    headers,
    signal,
  })
  if (res.status === 409) throw new WorkflowConflictError()
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to delete workflow draft (status ${res.status})`)
}

// ── Phase 184-06 (VALID-02 / VALID-03 · D-184-13 / D-184-14) — the FIRST clients of
//    the two canvas routes Phase 182 shipped and nothing called. Both are consumed
//    EXACTLY as shipped: this plan changes no backend file. ─────────────────────────

/**
 * One finding from `POST /workflows/validate`, exactly as the wire carries it.
 *
 * `code` IS DECLARED AS `string`, DELIBERATELY, AND MUST STAY THAT WAY (VALID-03 /
 * D-182-06). The SERVER owns the whole verdict vocabulary — reachability's lint codes,
 * grounding's fidelity codes, the two the route mints itself, and the degraded marker —
 * and the route's own classifier FAILS CLOSED, meaning a code nobody has classified yet
 * comes back at the hard severity rather than the soft one. The client's job is to render
 * whatever arrives, including codes it has never seen; Phase 185 adds more of them and
 * this file must need no edit for that. Narrowing this to a union of literals would make
 * the client a second, drifting copy of a vocabulary that has exactly one owner — which is
 * the red line the whole server-validation seam exists to hold. Do not "helpfully" narrow it.
 *
 * `phase` is the phase SLUG (== the canvas node id), or `null` for a workflow-wide
 * finding, which therefore needs a home in the problems tray rather than on a node.
 *
 * ONE SHAPE, TWO DECLARATIONS, AND A COMPILE-TIME BRIDGE. `builderStore.ts` declares the
 * structurally identical `ServerVerdict`, because it landed first and because the two
 * modules cannot import each other: the store carries a source fence forbidding it from
 * naming this API client at all (an undo must never be able to write to the server), and
 * this client must not import a store that type-imports `WorkflowBuilderPage`. So instead
 * of a silent second copy, `useLiveValidation.ts` — the one module that legitimately sees
 * both — carries a mutual-assignability assertion, making any drift a typecheck error.
 */
export interface Verdict {
  code: string
  phase: string | null
  message: string
  severity: "error" | "incomplete"
}

/**
 * The always-200 envelope of `POST /workflows/validate`, returned UNTOUCHED.
 *
 * `ok === (verdicts.length === 0)` is the server's invariant, not a client derivation —
 * an `incomplete`-only verdict set still reports not-ok, because an unfinished draft
 * cannot publish either. Nothing here interprets, filters, re-orders or re-classifies
 * the array.
 */
export interface ValidateResponse {
  ok: boolean
  verdicts: Verdict[]
}

/**
 * `GET /workflows/grounding-bundle` — the server-sourced palette of valid building
 * blocks (the CANVAS-04 tool whitelist, the KB folder tree, the enabled skills).
 *
 * `degraded` IS THE HONESTY FIELD AND IT IS NOT OPTIONAL READING. It names the registries
 * whose read FAILED, sorted. An EMPTY array is the ONLY value that means "this palette is
 * complete" — because a registry blip serves `{folders: [], skills: []}` at HTTP 200,
 * which is byte-indistinguishable from an author who genuinely owns nothing. A picker
 * that renders an empty-but-normal dropdown on a failed read is telling the user
 * something false, so a caller MUST branch on this rather than on emptiness.
 */
export interface GroundingBundle {
  tools: string[]
  /** D-185-09 — the SERVER's safety-defining list of knowledge-base-reading tool names.
   *  The client intersects it with a step's `available_tools` to PREDICT the lock; it
   *  never enforces (the run-time gate is server-side and unconditional), so a wrong
   *  read here is a display bug by construction. Never re-declare this list client-side. */
  kb_tools: string[]
  folders: { id: string; name: string; parent_id: string | null }[]
  skills: { id: string; name: string | null }[]
  template_placeholders: string[]
  degraded: string[]
}

/**
 * `POST /workflows/validate` answered HTTP 422 — the definition's SHAPE was rejected
 * before the handler ran (the model's forbid-extra-keys tier, or one of the two
 * cross-field model validators), so the always-200 envelope was bypassed entirely.
 *
 * THE RAW BODY IS LOGGED HERE AND CARRIED NO FURTHER (D-184-14 / T-184-06-01). The
 * constructor writes it to the console once, at this boundary, and the error's `message`
 * is a FIXED business-plain sentence with nothing interpolated into it. A validation
 * error body is a list of internal field paths and framework phrasing; pretty-printing it
 * onto an authoring surface aimed at business users would leak implementation detail and
 * still not tell them what to do. Turning those bodies into something a person can act on
 * is a server-side envelope change that is deliberately deferred — it is not a job for a
 * client-side formatter, and this class exists so the hook can branch on `name` rather
 * than parse a string.
 */
export class WorkflowValidateUnreadableError extends Error {
  constructor(rawBody?: unknown) {
    super("the workflow's shape could not be read by the validator")
    this.name = "WorkflowValidateUnreadableError"
    // Logged, never shown. One line, at the boundary that received it.
    console.warn("POST /workflows/validate → 422 (shape rejected before the handler):", rawBody)
  }
}

/**
 * POST /workflows/validate — the live structural check (VALID-02).
 *
 * Takes a RAW definition, never a draft id, so an UNSAVED draft validates with no save
 * and no row. Returns the `{ok, verdicts}` envelope verbatim: no severity classifier, no
 * code allow-list, no friendly-message map. The 422 branch is typed and comes BEFORE the
 * generic not-ok throw, because a shape rejection and an unreachable server are different
 * things the caller must be able to word differently (D-184-14).
 *
 * `signal` is the house signature and is what makes the live loop's abort-on-new-edit
 * possible; an abort surfaces as the usual DOM abort error and is the caller's to ignore.
 */
export async function validateWorkflow(
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<ValidateResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/validate`, {
    method: "POST",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 422) {
    // Read the body for the LOG only; a body that will not parse must not mask the 422.
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new WorkflowValidateUnreadableError(body)
  }
  if (!res.ok) throw new Error(`Failed to validate workflow (status ${res.status})`)
  return (await res.json()) as ValidateResponse
}

/**
 * GET /workflows/grounding-bundle — the palette (CANVAS-04).
 *
 * `templateAssetId` is appended only when supplied; the base palette returns an empty
 * placeholder list. The response is returned untouched, `degraded` included — see the
 * `GroundingBundle` docblock for why that field, and not emptiness, is what a caller
 * must branch on.
 */
export async function getGroundingBundle(
  templateAssetId?: string,
  signal?: AbortSignal,
): Promise<GroundingBundle> {
  const headers = await getAuthHeaders()
  const query =
    templateAssetId !== undefined && templateAssetId !== null && templateAssetId !== ""
      ? `?template_asset_id=${encodeURIComponent(templateAssetId)}`
      : ""
  const res = await fetch(`${API_BASE}/workflows/grounding-bundle${query}`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to load the grounding bundle (status ${res.status})`)
  return (await res.json()) as GroundingBundle
}

// ── Phase 188 Plan 08 (RUNVIZ-03 / D-188-14 / D-188-15) — the ONE net-new read that
//    gives a workflow RUN an address. Mirrors `GET /workflow-runs/{id}` (Plan 03).
//    Sited beside the two other canvas-gated reads above rather than beside
//    `getThreadWorkflow`, because it shares their gate, not their router. ──────────

/** One durable `workflow_phases` row as the run read returns it (backend
 *  `WorkflowRunPhaseRead`). `status` is the **DB-native** vocabulary
 *  (`pending | active | completed | failed | skipped`) and is deliberately
 *  untranslated on the wire — `@/lib/phaseState`'s `phaseStatusFromDb` owns the one
 *  mapping to the client union, and this client must never grow a second one.
 *  `phase_type` is derived server-side from the definition JSON (the table stores no
 *  such column), so it is nullable for a slug the definition no longer names. */
export interface WorkflowRunPhase {
  slug: string
  phase_index: number
  status: string
  phase_type: string | null
  /** Phase 200 (DES-02 / D-05) — when this step flipped to active.
   *
   *  ⚠ `null` means **the time was not recorded**, not "zero". Either the step never ran
   *  (a `skipped` phase is routed around, so it has no start instant at all) or it ran
   *  before migration 121 existed. **There is NO BACKFILL** — a value derived from
   *  `updated_at` would be right for some rows and silently wrong for others, with nothing
   *  on the row to say which. Render nothing for `null`; never render `0s`. */
  started_at?: string | null
  /** Phase 200 (DES-02 / D-05) — when this step reached a terminal status.
   *
   *  With `started_at`, this is the first per-step duration the wire has ever carried:
   *  `completed_at − started_at`. `null` while the step is still running, on a `skipped`
   *  step, and on every pre-migration-121 row. ⚠ A run SPAN is
   *  `min(started_at) → max(completed_at)` across the phases — see `WorkflowRunRead`. */
  completed_at?: string | null
  /** Phase 200 (DES-02 / D-07) — the count this step's phase type DECLARED, read from the
   *  step's own output server-side.
   *
   *  ⚠ **`0` AND `null` ARE DIFFERENT ANSWERS AND MUST BE BRANCHED, NEVER COALESCED.**
   *  `0` is a real measurement — the step searched and found nothing. `null` means **this
   *  phase type declares no count at all**, and four of the seven do: `programmatic`,
   *  `llm_single`, `llm_human_input`, `external_action`. Writing `step_count ?? 0` prints
   *  "0 sources" under a step that never claimed to measure anything. Test for `null`
   *  explicitly (or `typeof === "number"`) and render nothing when absent — never a `0`,
   *  never a dash. */
  step_count?: number | null
  /** Phase 200 (DES-02 / D-07) — the noun for `step_count`: `sources` | `agents` |
   *  `fields`. Non-null iff `step_count` is non-null.
   *
   *  ⚠ AUTHORED COPY owned by the executor that declares it, and deliberately
   *  domain-neutral. Render the pair verbatim (`312 sources`). **Never substitute a domain
   *  word of your own** — "312 docs matched" is a claim about the customer's domain that
   *  nothing measured. */
  step_noun?: string | null
}

/**
 * One workflow run + the definition version that RAN + its durable phase spine
 * (backend `WorkflowRunRead`, `api/workflow_runs.py`).
 *
 * ⚠ **THE ID TRAP.** `WorkflowRunRead.id` is a `workflow_runs.id`. It is **NOT**
 * `PostMessageResponse.run_id`, which is the producer `runs` row consumed by
 * `GET /runs/{id}/stream`. **They are different tables with different id spaces** —
 * `backend/app/api/runs.py:714-729` has to resolve a `workflow_runs.id` handed to a
 * `runs` route as a documented repair, which is the whole reason this route is spelled
 * `/workflow-runs/{id}` and not `/runs/{id}` (D-188-15). Navigating the run surface with
 * the wrong one yields a page that resolves nothing, and the two ids look identical
 * (both bare uuids), so the compiler cannot help — read the field name.
 *
 * **Why `definition` is returned INLINE, and why it is the version that ACTUALLY ran
 * (D-188-14).** The server joins it on `workflow_runs.definition_id`, never by slug:
 * `listPublishedWorkflows` only ever returns the *current* published version, so a
 * re-opened older run resolved by slug would be drawn against a definition it never
 * executed — a spine whose steps the run never had. Carrying it inline also means a
 * terminal run renders with no stream and no second fetch.
 *
 * **`claimed_at` is the ONLY honest elapsed anchor** *(⚠ SUPERSEDED FOR A RUN SPAN —
 * Phase 200. The original sentence is kept rather than deleted, because erasing a
 * superseded invariant hides that a promise changed.)*
 *
 * It stays TRUE OF THIS TABLE: `workflow_runs` still has no `started_at` and no
 * `completed_at`, so a run-row duration is `updated_at − claimed_at` and a null
 * `claimed_at` means the run has not started processing at all (D-188-18).
 *
 * ⚠ **But it is no longer the best anchor for a run SPAN, and the reason is measured
 * rather than stylistic: `claimed_at` is null on 100% of completed runs** — 149 rows, 0
 * with `claimed_at` (`WorkflowRunPage.tsx:849-851`). So the anchor this sentence
 * recommends is, in practice, absent exactly when a span is wanted. Since Phase 200 the
 * PHASE rows carry their own timestamps, so the honest span is
 * `min(phases.started_at) → max(phases.completed_at)` — derived from steps that really
 * ran, and null-safe because a phase that never ran contributes neither end.
 *
 * The degrade path Plan 03 recorded: if the definition row cannot be read, the server
 * returns `workflow_name: ""` / `workflow_slug: ""` / `workflow_version: 0` /
 * `definition: null` rather than 404ing. Treat an empty `workflow_name` as "definition
 * unavailable", never render the empty string.
 */
export interface WorkflowRunRead {
  /** `workflow_runs.id` — NOT `PostMessageResponse.run_id`. See the docblock. */
  id: string
  /** The thread this run streamed into. The deliverable list and the live phase slice
   *  are both reachable from it, which is why no new file endpoint was needed. */
  thread_id: string
  definition_id: string
  workflow_name: string
  workflow_slug: string
  workflow_version: number
  /** `active | paused | cap_paused | completed | failed | cancelled` — the
   *  `workflow_runs_status_check` members. Consumers must map it TOTALLY: an
   *  unrecognised value reads as unknown, never as success. */
  status: string
  created_at: string | null
  /** When the worker picked the run up. **The elapsed anchor** — null ⇒ queued. */
  claimed_at: string | null
  updated_at: string | null
  /** The raw `workflow_definitions.definition` JSONB of the version that ran. */
  definition: WorkflowDefinitionJSON | null
  phases: WorkflowRunPhase[]
}

/**
 * GET /workflow-runs/{id} — the run read (Plan 03). Ownership-gated server-side: a run
 * belonging to another account is indistinguishable from one that does not exist, and
 * both are a 404.
 *
 * Throws the shipped status-carrying `ApiError` rather than the bare `Error` most reads
 * in this file use, because the run surface has to WORD a 404 ("That run isn't
 * available.") differently from a 5xx ("We couldn't load this run."). That is the
 * existing in-tree convention (`ApiError`, used by `postMessage`), not a second one —
 * the alternative would have been a bespoke error class per outcome, which is what
 * `getWorkflowDeletePreview` does and what this deliberately does not multiply.
 * `ApiError`'s 403 side-effect cannot fire here: it is gated on the exact
 * `VISIBILITY_REFUSAL` literal, and this route's gate answers `{"detail": "Not Found"}`.
 *
 * ⚠ APPENDED BY 188.1-04 (WR-07), not a rewrite of the above. The run id is now encoded
 * into the path segment. The ownership gate this docblock already describes is the
 * SECURITY control and is unchanged; the encode is the defensive URL construction that
 * pairs with it, in the `listRelationships` register. A falsification in
 * `pages/WorkflowRunPage.test.tsx` asserts the URL a mocked `fetch` actually RECEIVES for
 * `runId = "a/b"` — it was observed RED before the encode was written.
 *
 * The unused `signal` parameter is DELIBERATELY left alone (D4). The same review
 * paragraph proposed threading an `AbortController` through it; that changes request-
 * cancellation behaviour on a live polling surface and is a behaviour change this
 * refactor phase may not make. Re-open trigger: the next phase touching
 * `WorkflowRunPage`'s fetch lifecycle, or a superseded read causing a visible defect.
 */
export async function getWorkflowRun(
  runId: string,
  signal?: AbortSignal,
): Promise<WorkflowRunRead> {
  const headers = await getAuthHeaders()
  // encodeURIComponent the id (WR-07): run ids are UUIDs today so this is safe in
  // practice, but `/`, `?` and `#` are STRUCTURAL in a path segment — defensive URL
  // construction keeps a non-UUID value from reshaping the request the client sends
  // (and pairs with the route's ownership gate, which answers a uniform 404).
  const res = await fetch(`${API_BASE}/workflow-runs/${encodeURIComponent(runId)}`, {
    headers,
    signal,
  })
  if (!res.ok) throw new ApiError(`Failed to load the run (status ${res.status})`, res.status)
  return (await res.json()) as WorkflowRunRead
}

// ── SEED-190 — THE RUN LOG ──────────────────────────────────────────────────────────
//
// ⚠ THIS FIRES THE 197 DECLINE'S OWN RE-OPEN TRIGGER AND THE TRIGGER IS BEING HONOURED
// RATHER THAN STEPPED AROUND. `docs/HOT-FILE-LEDGER.md` records this file as the hottest in
// the repository (176 commits / 100 phases / 6430 lines) with a standing DECLINE to extract,
// whose trigger reads: *"the next phase adding a RUNTIME export or a second concern here"*.
// `listWorkflowRuns` below IS a runtime export. It is added here anyway, and the reason is
// that it is not a second CONCERN: it sits directly beneath `getWorkflowRun`, hits the same
// router, shares its `ApiError` convention and its encode discipline, and an extraction that
// moved one without the other would split a two-function surface across two files. **The
// trigger is not thereby discharged** — it is recorded as fired, with the next phase touching
// this file owing the extraction rather than another paragraph explaining why not.

/**
 * One row of the run log (backend `WorkflowRunListItem`).
 *
 * ⚠ IT IS A PROJECTION OF `WorkflowRunRead`, NOT A SECOND VOCABULARY. Every field is the
 * same field under the same name; what is ABSENT is `definition` (a log draws no spine) and
 * the per-phase rows (the span is pre-reduced server-side). A client that starts deriving
 * something here that `WorkflowRunRead` derives differently is the defect this note exists
 * to name in advance.
 */
export interface WorkflowRunListItem {
  /** ⚠ A `workflow_runs.id` — the SAME id space `getWorkflowRun` takes, and NOT a `runs.id`.
   *  The id trap is documented in full on `WorkflowRunRead` above. */
  id: string
  thread_id: string
  definition_id: string
  /** ⚠ EMPTY STRING when the definition row is gone. Deleting a workflow does not delete its
   *  runs, so an orphaned run reaches the log with no name and the surface says so in words.
   *  It is never `null` — the backend normalises, so the client has one case, not two. */
  workflow_name: string
  workflow_slug: string
  workflow_version: number
  /** The DB-native status. The sentence a person reads comes from `runFacts` (D-17). */
  status: string
  created_at: string | null
  /** Phase rows this run created — a fact about the RUN, not about the definition today. */
  step_total: number
  /** `min(started_at)` across the run's phases. ⚠ NULL on every pre-migration-121 run, and
   *  that is "not recorded", never zero. */
  started_at: string | null
  /** `max(completed_at)` across the run's phases. NULL while a run is still going. */
  completed_at: string | null
}

/** One page of the run log (backend `WorkflowRunListRead`). `total` is the count UNDER THE
 *  SAME FILTER — the number the surface says "showing N of" against. */
export interface WorkflowRunListPage {
  runs: WorkflowRunListItem[]
  total: number
  limit: number
  offset: number
}

/**
 * GET /workflow-runs — this caller's runs, newest first.
 *
 * Owner-scoped in the query server-side; there is no "everyone" mode to ask for. An empty
 * page is a 200 with no rows, never a 404 — "you have no runs" is an answer.
 *
 * @param slug restrict to ONE workflow, across every version sharing the slug. ⚠ NOT a
 *   `definition_id`: a workflow's runs span its published versions, so a definition filter
 *   would show a VERSION's history under the workflow's name. Measured on the dev database:
 *   `pm-weekly-status-report` has 21 runs across 3 definition rows.
 *
 * Throws the status-carrying `ApiError`, matching `getWorkflowRun` directly above, because
 * the log has to word a canvas-off 404 differently from a 5xx.
 */
export async function listWorkflowRuns(
  options: { slug?: string; limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<WorkflowRunListPage> {
  const headers = await getAuthHeaders()
  // `URLSearchParams` rather than template interpolation — a slug is server-supplied today
  // but reaches here as a plain string, and `&` / `#` are STRUCTURAL in a query string. Same
  // defensive-construction rule as `getWorkflowRun`'s path encode (WR-07), one component over.
  const params = new URLSearchParams()
  if (options.slug !== undefined) params.set("slug", options.slug)
  if (options.limit !== undefined) params.set("limit", String(options.limit))
  if (options.offset !== undefined) params.set("offset", String(options.offset))
  const query = params.toString()
  const res = await fetch(`${API_BASE}/workflow-runs${query ? `?${query}` : ""}`, {
    headers,
    signal: options.signal,
  })
  if (!res.ok) {
    throw new ApiError(`Failed to load the run log (status ${res.status})`, res.status)
  }
  return (await res.json()) as WorkflowRunListPage
}

// ── Phase 152-04 (WFIN-03 / D-LOCK-03/04/05) — the published-workflow safe DELETE
//    cascade + its server-sourced victim-naming counts. These hit DISTINCT routes on
//    api/workflows.py (Plan 02, D-08) — NEVER the draft `DELETE /workflows/{id}` above
//    (Pitfall 7 — the routes must not collide). ────────────────────────────────────

/** The victim-naming delete sheet's EXACT server-sourced counts (D-LOCK-03). The sheet
 *  never guesses these: `versions` + `runs` are the Removed group (definition versions +
 *  run records hard-deleted), `threads` is the Kept group (chats detached but preserved),
 *  and `in_flight` is the count of runs STILL LIVE — the honest signal the amber
 *  cancel-first banner gates on (D-LOCK-05). `in_flight` is the LIVE count, never `runs`
 *  (which is historical run records — "in progress" off that would be a lie). */
export interface WorkflowDeletePreview {
  name: string
  versions: number
  runs: number
  threads: number
  in_flight: number
}

/** GET /workflows/{id}/delete-preview — the server-sourced Removed/Kept counts the
 *  victim-naming sheet renders BEFORE commit (D-LOCK-03). Owner-gated + 404-collapse on
 *  the backend (a non-owner / unknown id → WorkflowNotFoundError, no existence leak). The
 *  error is NOT swallowed — the sheet renders its own load-error state on a throw. */
export async function getWorkflowDeletePreview(
  id: string,
  signal?: AbortSignal,
): Promise<WorkflowDeletePreview> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}/delete-preview`, { headers, signal })
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to load workflow delete preview (status ${res.status})`)
  return (await res.json()) as WorkflowDeletePreview
}

/** DELETE /workflows/{id}/cascade — the WFIN-03 hard-delete (204): the definition + ALL
 *  versions + ALL runs are removed; in-flight runs are cancelled-first server-side; threads
 *  are detached-but-KEPT (they become normal chats). A DISTINCT route from the draft
 *  `DELETE /workflows/{id}` (Pitfall 7 — never collide). Owner-gated on the backend (404 on
 *  non-owner). The error is NOT swallowed — the sheet's error state renders on a throw, and
 *  the card is removed only AFTER the server confirms (D-LOCK-04 — no optimistic vanish,
 *  no undo; hard-delete is irreversible). */
export async function deleteWorkflowCascade(id: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}/cascade`, {
    method: "DELETE",
    headers,
    signal,
  })
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to delete workflow (status ${res.status})`)
}

/** POST /workflows/generate — NL one-shot structured generation. The route
 *  returns HTTP 200 even on a FAILED generation (`ok:false`), so we read the body
 *  and NEVER throw on `ok:false` (only on a real HTTP/network error). */
export async function generateWorkflow(
  body: GenerateWorkflowBody,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to generate workflow (status ${res.status})`)
  return (await res.json()) as GenerateResult
}

/** POST /workflows/{id}/publish — run the 8-stage publish gauntlet. The client
 *  distinguishes the 4 HTTP outcomes and reads the SERVER verdict verbatim:
 *   - 200 → {kind:"verdict"}: the body tells pass (published:true) from BLOCK
 *     (published:false / blocked_stage set) — we DO NOT re-derive it.
 *   - 400 → {kind:"business_requirement"}: the verdict is in `detail`.
 *   - 404 → {kind:"not_found"}.
 *   - 409 → {kind:"already_published"}.
 *   - anything else → throw.
 *  A binary `200 = ok / else = error` handler is FORBIDDEN (T-103-03-01). */
export async function publishWorkflow(
  id: string,
  golden_input: string,
  signal?: AbortSignal,
): Promise<PublishOutcome> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}/publish`, {
    method: "POST",
    headers,
    body: JSON.stringify({ golden_input }),
    signal,
  })
  if (res.status === 200) {
    const verdict = (await res.json()) as PublishVerdict
    return { kind: "verdict", verdict }
  }
  if (res.status === 400) {
    // WR-02: defend against a detail-less / mistyped 400 body. The backend rides the
    // full PublishVerdict in `detail` (api/workflows.py:209), but a malformed body must
    // NEVER cast `undefined` to PublishVerdict — the gauntlet would then crash on
    // `verdict.named_failures.length`. Verify the shape; otherwise throw an honest error.
    const body = (await res.json().catch(() => ({}))) as { detail?: unknown }
    const detail = body.detail
    if (detail && typeof detail === "object" && "published" in detail) {
      return { kind: "business_requirement", verdict: detail as PublishVerdict }
    }
    throw new Error("business_requirement block: malformed verdict body (no PublishVerdict in detail)")
  }
  if (res.status === 404) return { kind: "not_found" }
  if (res.status === 409) return { kind: "already_published" }
  throw new Error(`Failed to publish workflow (status ${res.status})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 123-05 (TRIG-01) — Skill Trigger Tuner client calls.
//
// Mirror the Plan-04 router contract (backend/app/api/skill_tuner.py):
//   POST   /skills/{id}/tuner/runs           → kick off a BOUNDED background run, get a run_id
//   GET    /skills/{id}/tuner/runs/{run}/stream  → live tuner_* SSE progress
//   GET    /skills/{id}/tuner/runs/{run}     → the held-out scoreboard once complete
//
// The per-provider cell shape (`{ provider, model, axes: { fires, no_false }, score }`)
// is the ProviderScoreboard render input (042-A — BOTH sub-scores present, never a
// hidden aggregate). The scoreboard is N-column = the org's configured targets; the
// candidate set is held-out-scored and the author picks the winner by held-out (D-03).
// ─────────────────────────────────────────────────────────────────────────────

/** A benchmark target column = a provider + its representative model (043-A run config). */
export interface TunerTarget {
  provider: string
  model: string
}

/** One (client-held) benchmark case: a user prompt + whether the skill SHOULD fire on it
 *  (the should-NOT cases are the false-fire rail). Cases are ephemeral / never persisted. */
export interface TunerCase {
  prompt: string
  should_fire: boolean
}

/** A single per-provider scoreboard cell. BOTH sub-scores carry the honest unmeasured
 *  sentinel from 123.1-06 (TT-05/TT-12): `fires` = should-trigger recall, `no_false`
 *  = should-NOT precision — each is `null` when that axis had NO cases to score (the
 *  frontend renders "n/a"), NEVER a fabricated `1.0`. `score` is the server-computed
 *  combined cell score (the mean of the MEASURED axes) and is `null` when the cell is
 *  WHOLLY unmeasured. `measured` is `false` (and `error_count > 0`) when every classify
 *  call for the cell RAISED — an all-error column that the scoreboard must render
 *  honestly as "could not measure", distinct from a measured `0.00`. `error_count` is the
 *  count of classify calls that raised. (`measured`/`error_count` are optional so a
 *  legacy cell that predates 123.1-06 still types — a missing `measured` is treated as
 *  measured, and `score == null` is the unmeasured signal regardless.) */
export interface TunerCell {
  provider: string
  model: string
  axes: { fires: number | null; no_false: number | null }
  score: number | null
  measured?: boolean
  error_count?: number
}

/** One scored candidate description: its held-out score + the per-provider cells. */
export interface TunerCandidate {
  index: number
  description: string
  cells: TunerCell[]
  held_out_score: number
  is_baseline: boolean
}

/** The held-out scoreboard returned by GET results (and carried on tuner_complete). */
export interface TunerScoreboard {
  skill_id: string
  candidates: TunerCandidate[]
  winner_index: number | null
  winner_description: string | null
}

/** The POST /runs response (run kicked off; reconcile via /stream + /results). */
export interface StartTunerRunResponse {
  run_id: string
  skill_id: string
  targets: TunerTarget[]
  case_count: number
  n: number
}

export interface StartTunerRunBody {
  cases?: TunerCase[]
  targets?: TunerTarget[]
  n?: number
}

/** Kick off a bounded background tuning run; the response carries the run_id to
 *  stream + reconcile (D-06 non-blocking). 409 means a run is already in flight. */
export async function startTunerRun(
  skillId: string,
  body: StartTunerRunBody = {},
): Promise<StartTunerRunResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (res.status === 409) {
    throw new ApiError("A tuning run is already in progress for this skill.", 409)
  }
  if (!res.ok) throw new ApiError("Failed to start the tuning run. Please try again.", res.status)
  return (await res.json()) as StartTunerRunResponse
}

/** Read the held-out scoreboard once the run completes. A 404 means the run is
 *  still in progress (or its ephemeral buffer expired) — the caller polls or relies
 *  on the tuner_complete SSE event. Throws ApiError(404) so the caller can branch. */
export async function getTunerResults(
  skillId: string,
  runId: string,
): Promise<TunerScoreboard> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/${runId}`, { headers })
  if (!res.ok) {
    throw new ApiError(
      res.status === 404 ? "Tuner run not complete or result expired." : "Failed to load tuner results.",
      res.status,
    )
  }
  return (await res.json()) as TunerScoreboard
}

/** REALLY cancel an in-flight tuning run (Phase 123.1-07 / TT-08). Issues a DELETE so the
 *  background job stops at its next loop checkpoint (no more paid provider calls) and the
 *  in-flight claim is released immediately (a retry no longer 409s). Best-effort from the
 *  caller's view: on a non-ok response it throws an ApiError so the caller CAN log it, but the
 *  caller still transitions the UI to idle (the run is being cancelled server-side regardless,
 *  and the local SSE is aborted). */
export async function cancelTunerRun(skillId: string, runId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/${runId}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) {
    throw new ApiError("Failed to cancel the tuning run on the server.", res.status)
  }
}

/** The DURABLE latest tuner result for a skill (Phase 123.1 / D-07 — survives a Redis flush /
 *  refresh). Returned by GET .../tuner/runs/latest; the `scoreboard` is the same TunerScoreboard
 *  shape carried on `tuner_complete`, plus attribution fields. */
export interface LatestTunerRun {
  skill_id: string
  run_id: string
  scoreboard: TunerScoreboard
  builder_model: string
  target_count: number
  case_count: number
  updated_at: string
}

/** One seeded benchmark case carrying its provenance (Phase 123.1 / D-05): `"seeded"` =
 *  this skill's own description/paraphrase or the generic off-topic set; `"sibling"` = an
 *  owner-scoped sibling skill's description (the false-fire rail). NEVER `"held"`. */
export interface SeededCase {
  prompt: string
  provenance: string
}

/** The seeded-cases response — should_fire (recall rail) + should_not (false-fire rail), each
 *  carrying provenance so the editor can show + edit them before a run (fixes WR-05).
 *  `total` (Phase 123.1-05 / BUG-260624-01 #1) is the FULL uncapped sibling-sourced should_not
 *  count; `should_not` is capped (MAX_SEEDED_SHOULD_NOT) so the editor shows an honest
 *  "showing N of M — capped" banner whenever `total` exceeds the shown sibling count. */
export interface SeededCasesResponse {
  should_fire: SeededCase[]
  should_not: SeededCase[]
  total: number
}

/** Read the DURABLE latest tuner result for a skill (D-07 rehydration-on-open). Unlike
 *  `getTunerResults` (per-run-id, ephemeral Redis), this survives a refresh. A 404 means NO
 *  run has ever completed for this skill yet → resolves to `null` (the caller renders the
 *  empty / never-run state), NOT a thrown error. */
export async function getTunerLatest(skillId: string): Promise<LatestTunerRun | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/runs/latest`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError("Failed to load the latest tuner result.", res.status)
  return (await res.json()) as LatestTunerRun
}

/** Read the already-computed seeded benchmark cases (with provenance) so the editor can show +
 *  edit them before a run (D-05 / WR-05). Owner-scoped on the server (404 cross-user). */
export async function getSeededCases(skillId: string): Promise<SeededCasesResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${skillId}/tuner/cases/seeded`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the seeded tuner cases.", res.status)
  return (await res.json()) as SeededCasesResponse
}

/** Tuner-specific SSE events (the Plan-04 vocab — NEVER chat event types). The
 *  terminal `done` / `error` sentinel breaks the consumer (mirrors the shared
 *  replay_tail_consumer contract). */
export interface TunerStreamCallbacks {
  /** tuner_progress — stage-carrying progress (building_candidates / candidate_scored …). */
  onProgress?: (data: Record<string, unknown>) => void
  /** tuner_provider_done — one provider cell finished for a candidate. */
  onProviderDone?: (data: { candidate_index: number; provider: string; model: string; cell: TunerCell }) => void
  /** tuner_complete — the full scoreboard (non-terminal progress carrying the result). */
  onComplete?: (scoreboard: TunerScoreboard) => void
  /** the terminal sentinel — 'done' on success, 'error' (with reason) on failure. */
  onTerminal: (status: "done" | "error", reason?: string) => void
}

/** Open GET /skills/{id}/tuner/runs/{run}/stream and dispatch tuner_* events.
 *
 *  A focused, purpose-built SSE reader (not the chat subscribeToRun) — it speaks ONLY
 *  the tuner vocab + the done/error terminal. Bearer auth attaches via getAuthHeaders +
 *  fetch (the native EventSource can't send headers — same rationale as subscribeToRun).
 *  `since` is "0" (full replay is idempotent; React reconciles duplicate progress as a
 *  no-op). The caller passes an AbortSignal to cancel (leave-and-reconcile-on-return). */
export async function streamTunerRun(
  skillId: string,
  runId: string,
  callbacks: TunerStreamCallbacks,
  since = "0",
  signal?: AbortSignal,
): Promise<void> {
  const headers = await getAuthHeaders()
  const url = `${API_BASE}/skills/${skillId}/tuner/runs/${runId}/stream?since=${encodeURIComponent(since)}`
  const res = await fetch(url, { headers, signal })

  if (res.status === 404) {
    callbacks.onTerminal("error", "run_not_found")
    return
  }
  if (res.status === 503) {
    callbacks.onTerminal("error", "streaming_unavailable")
    return
  }
  if (!res.ok) throw new Error(`Failed to open tuner stream (status ${res.status})`)
  if (!res.body) throw new Error("No response body on tuner stream")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    let done: boolean, value: Uint8Array | undefined
    try {
      ;({ done, value } = await reader.read())
    } catch {
      // AbortError (caller-initiated cancel via signal) — silent return. The run
      // keeps computing server-side; the author reconciles on return.
      return
    }
    if (done) {
      // Reader closed without an explicit terminal — defensive done so the UI
      // reconciles via GET results rather than hanging.
      callbacks.onTerminal("done")
      return
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data:")) continue
      const raw = line.slice(5).trim()
      if (!raw) continue
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>
      } catch {
        continue
      }
      const t = parsed.type as string
      if (t === "tuner_progress") callbacks.onProgress?.(parsed)
      else if (t === "tuner_provider_done")
        callbacks.onProviderDone?.(
          parsed as unknown as { candidate_index: number; provider: string; model: string; cell: TunerCell },
        )
      else if (t === "tuner_complete")
        callbacks.onComplete?.(parsed.scoreboard as TunerScoreboard)
      else if (t === "done") {
        callbacks.onTerminal("done")
        return
      } else if (t === "error") {
        callbacks.onTerminal("error", (parsed.error ?? parsed.message) as string | undefined)
        return
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 146 (ADMIN-01) — Control Room admin data layer.
//
// SECURITY NOTE (Pitfall 13 / D-07): these client functions decide RENDERING
// ONLY. The backend `require_operator` router gate (Plan 02) is the sole
// authority — a non-operator's `GET /admin/me` returns a byte-identical 404
// {"detail":"Not Found"} (non-discoverable, 404-not-403), so the surface never
// reveals it exists. A forged `isOperator=true` in the browser reveals nothing
// and reaches no data: every /admin call is independently 404-gated server-side.
// ─────────────────────────────────────────────────────────────────────────────

/** The operator identity returned by `GET /admin/me` (Plan 02). */
export interface OperatorIdentity {
  id: string
  email: string
  granted_at: string
}

/** The four raw backpressure signals from `GET /admin/backpressure` (Plan 02).
 *  The Control Room maps each to a plain label (Server capacity · Agents working
 *  · Database connections · Work spread) behind the "⌥ Technical names" toggle. */
export interface BackpressureSignals {
  anyio_threadpool_depth: { borrowed: number; total: number }
  redis_active_runs: number
  postgres_pool_in_use: number
  per_worker_run_count: number
  // Phase 147 (ADMIN-02 / D-078-08 additive-only) — the dependency-health probes
  // appended to the SAME `GET /admin/backpressure` payload. OPTIONAL for
  // back-compat: a backend that has not yet shipped Plan 147-04 omits the key and
  // the four fields above stay byte-identical. `sandbox` has a third `"off"` state
  // — a deliberately-disabled sandbox (SANDBOX_ENABLED=false) is grey, never red.
  dependencies?: {
    redis: { state: "up" | "down"; latency_ms: number | null }
    supabase: { state: "up" | "down"; latency_ms: number | null }
    sandbox: { state: "off" | "up" | "down"; latency_ms: number | null }
  }
  // Phase 150 (SEC-01 / D-150-02 / additive, back-compat) — the at-rest secrets
  // encryption state, appended to the SAME payload. OPTIONAL: a backend that has
  // not shipped Plan 150-05 omits the key and every field above stays byte-compatible.
  // `encrypted` = all secret columns are ciphertext at rest; `plaintext` = the
  // deliberate no-key config (NEUTRAL, never red — Pitfall 6); `error` = genuine
  // decrypt failures (columns_unreadable) and/or lingering plaintext under an active
  // key (columns_plaintext — a swallowed sweep); `unknown` = a key is active but ZERO
  // secret values were observed (an empty / cold-cache row — WR-02: NEUTRAL, never green,
  // so a DB outage can't paint a false "Encrypted"). Only counters > 0 are present.
  secrets_encryption?: {
    state: "encrypted" | "plaintext" | "error" | "unknown"
    columns_unreadable?: number
    columns_plaintext?: number
  }
}

/** One append-only `operator_audit_log` row from `GET /admin/audit` (Plan 02) —
 *  the recent-actions ledger feed. `label` is the human sentence; `is_write`
 *  drives the ✎ write mark. */
export interface OperatorAuditRow {
  id: string
  action: string
  label: string
  is_write: boolean
  target_type: string | null
  target_id: string | null
  created_at: string
}

/** The operator probe. Calls `GET /admin/me`; a 404 means "not an operator" →
 *  resolves to `null` so the caller renders NOTHING (the D-07 non-discoverable
 *  contract — a non-operator's nav stays byte-identical to today). Returns the
 *  operator identity on 200. Mirrors the `getTunerLatest` 404→null idiom.
 *  RENDER-ONLY: never a security boundary (see SECURITY NOTE above). */
export async function getOperatorProbe(): Promise<OperatorIdentity | null> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/me`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError("Failed to load the operator identity.", res.status)
  return (await res.json()) as OperatorIdentity
}

/** Phase 148 (VIS-01 / D-04): the caller's effective feature→visible map from the
 *  authenticated `GET /features` (148-05). EVERY authenticated user has a map — a
 *  non-operator reaches it (200) to learn which governed nav items to hide; this is
 *  deliberately NOT the operator-probe's 404→null idiom (there is no "you have no
 *  map" state). RENDER-ONLY: the per-endpoint `require_visible` gates (148-05) are the
 *  sole security authority — a governed page fetch still returns 403 server-side
 *  regardless of this map (that 403 is the graceful-bounce trigger, not this call). */
export async function getEffectiveFeatures(): Promise<EffectiveFeatures> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/features`, { headers })
  // CR-01 fix: NEVER throw ApiError here. A banned user's `GET /features` returns 403
  // (get_current_user → _is_banned), and an ApiError(403) would dispatch the
  // FEATURE_FORBIDDEN_EVENT → App.onForbidden → refetchFeatures() → this call again →
  // an unbounded /features refetch storm. A PLAIN Error keeps the effective-features
  // read entirely out of the graceful-bounce loop; useEffectiveFeatures catches it and
  // fails CLOSED to `{}` (every governed feature hidden). The server 403 stays the wall.
  if (!res.ok) throw new Error("Failed to load feature visibility.")
  const body = (await res.json()) as { features?: EffectiveFeatures }
  return body.features ?? {}
}

/** Read the four live backpressure/health signals (`GET /admin/backpressure`).
 *  Plain authed GET — the router gate returns 404 to non-operators. */
export async function getBackpressure(): Promise<BackpressureSignals> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/backpressure`, { headers })
  if (!res.ok) throw new ApiError("Failed to load system health.", res.status)
  return (await res.json()) as BackpressureSignals
}

/** Read the recent operator-actions ledger feed (`GET /admin/audit`). Plain
 *  authed GET; `limit` optionally caps how many rows come back.
 *
 *  CR-01: the backend returns an ENVELOPE `{"entries": [...]}` (admin.py) — the
 *  same shape as `getAuditLogs` above. Unwrap `.entries` here; casting the raw
 *  object to `OperatorAuditRow[]` shipped a `{entries}` object into `auditRows`
 *  state, and the next `auditRows.slice(...)` crashed the whole Control Room tree
 *  (no error boundary above it → white screen). The unwrap is the contract. */
export async function getOperatorAudit(limit?: number): Promise<OperatorAuditRow[]> {
  const headers = await getAuthHeaders()
  const qs = limit != null ? `?limit=${encodeURIComponent(limit)}` : ""
  const res = await fetch(`${API_BASE}/admin/audit${qs}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the operator audit feed.", res.status)
  const body = (await res.json()) as { entries?: OperatorAuditRow[] }
  return body.entries ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 148 (ADMIN-03 / 067-A) — the platform-audit browser (BOTH-ledger client).
//
// The operator ledger above is your OWN governance actions (operator_audit_log).
// This section adds the SECOND source of the 067-A one-browser-two-sources surface:
// the cross-user PLATFORM `audit_log` (every user's real activity — the 19-action
// vocabulary of migs 030/071). These are the SC#4 no-RLS-backstop cross-user READS:
// every `GET /admin/platform-audit` call records `audit.view_platform` server-side
// (viewing user activity is ITSELF in the ledger — never silent), and a successful
// export records `audit.export` naming the exact count. Query/scope/cap safety is
// entirely server-side (148-04/06 — parameterized binds, page_size ≤ 100,
// COUNT-first refuse-over-50000). The client only renders + passes filters; it never
// does an unbounded client-side fetch. RENDER-ONLY (Pitfall 13): every /admin call
// is independently 404-gated server-side.
// ─────────────────────────────────────────────────────────────────────────────

/** The shared filter shape for the platform-audit browse + CSV export (067-A). A
 *  NULL/absent `userId` is the deliberate ALL-users read; a value scopes to one user.
 *  `actionTypes` maps to the repeatable `action_type` query param (text[] ANY);
 *  `since`/`until` are ISO timestamps forming a half-open `[since, until)` window. */
export interface PlatformAuditFilters {
  userId?: string | null
  actionTypes?: string[]
  since?: string | null
  until?: string | null
}

/** One cross-user `audit_log` row from `GET /admin/platform-audit` (148-06). Unlike
 *  the operator ledger this is the RAW platform vocabulary — `action_type` is a code
 *  (e.g. `document.upload`) the UI maps to a plain-first label + group. `user_id` is
 *  the acting user (clickable → filter-to-them); no email is joined (metadata only). */
export interface PlatformAuditRow {
  id: string
  user_id: string | null
  action_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

/** One server page of the platform-audit browse. `has_more` drives the pager Next —
 *  the browse endpoint is COUNT-free by design (no full-tenant total leak, SC#4). */
export interface PlatformAuditPage {
  entries: PlatformAuditRow[]
  page: number
  page_size: number
  has_more: boolean
}

/** Shared query-string builder for the two platform-audit calls (browse + export) so
 *  the export set is EXACTLY the browsed/filtered set (067-A CSV honesty). */
function platformAuditParams(filters: PlatformAuditFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.userId) params.set("user_id", filters.userId)
  for (const at of filters.actionTypes ?? []) params.append("action_type", at)
  if (filters.since) params.set("since", filters.since)
  if (filters.until) params.set("until", filters.until)
  return params
}

/** Browse the cross-user platform `audit_log` (`GET /admin/platform-audit`, 148-06).
 *  A RECORDED read — every call stamps `audit.view_platform` server-side (SC#4: viewing
 *  user activity is itself in the ledger). Plain authed GET; the router gate returns a
 *  byte-identical 404 to non-operators. Pagination is 1-based; the server clamps
 *  `pageSize` ≤ 100 (no full-tenant leak). The backend returns an envelope
 *  `{entries, page, page_size, has_more}` — unwrap defensively (CR-01 precedent). */
export async function getPlatformAudit(
  filters: PlatformAuditFilters,
  page = 1,
  pageSize = 50,
): Promise<PlatformAuditPage> {
  const headers = await getAuthHeaders()
  const params = platformAuditParams(filters)
  params.set("page", String(Math.max(1, page)))
  params.set("page_size", String(pageSize))
  const res = await fetch(`${API_BASE}/admin/platform-audit?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load platform activity.", res.status)
  const body = (await res.json()) as Partial<PlatformAuditPage>
  return {
    entries: body.entries ?? [],
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
    has_more: body.has_more ?? false,
  }
}

/** Export EXACTLY the filtered platform `audit_log` set as CSV (`GET
 *  /admin/platform-audit/export`, 148-06) and trigger a browser download. On SUCCESS the
 *  server records ONE `audit.export` row naming the exact count (the ✎ receipt lands in
 *  the OPERATOR ledger on the next read). On an over-cap set the server REFUSES with 413
 *  (never a partial download) — surfaced here as an `ApiError(413)` so the caller shows
 *  "narrow the filter" instead of downloading a truncated file. Mirrors `exportAuditLogs`'s
 *  blob-download idiom. NOTE: /admin never returns 403, so this ApiError cannot trip the
 *  VIS-01 feature-forbidden bounce (that is uniquely a `require_visible` 403). */
export async function exportPlatformAudit(filters: PlatformAuditFilters): Promise<void> {
  const token = await getAuthToken()
  const params = platformAuditParams(filters)
  const res = await fetch(`${API_BASE}/admin/platform-audit/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new ApiError(
      res.status === 413
        ? "Too many rows — narrow the filter, then export again."
        : "Failed to export platform activity.",
      res.status,
    )
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "platform-audit.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 148 (ADMIN-03 users roster + VIS-01 feature visibility) — the Users &
// Access write layer (068-A roster · graded action guards · 069-A audience rows).
//
// SAME security posture as every /admin call above: these decide RENDERING + fire
// the SERVER-enforced writes. The router `require_operator` gate (146) is the sole
// authority — a non-operator gets a byte-identical 404. The self-guards the roster
// UI shows (disable/remove-operator on your own row) are COURTESY only; the server
// refuses a self-target with 409 (148-06) — that is the real lockout-proof wall.
// ─────────────────────────────────────────────────────────────────────────────

/** One roster row from `GET /admin/users` (148-06 → `list_users_roster`, one join).
 *  Honest last-active: `last_sign_in_at` NULL means the user has NEVER signed in (the
 *  UI renders "never signed in" italic — never fabricated). `banned_until` in the
 *  FUTURE means the account is disabled (GoTrue ban) → the Disabled status chip.
 *  `is_operator` drives the ⛨ role chip; `doc_count`/`chat_count` are the identity sub. */
export interface UserRosterRow {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  is_operator: boolean
  doc_count: number
  chat_count: number
}

/** One server page of the users roster. The backend returns newest-active-first
 *  (`ORDER BY last_sign_in_at DESC NULLS LAST`); the client only filters/searches
 *  the loaded page — never an unbounded client-side fetch. */
export interface UserRosterPage {
  users: UserRosterRow[]
  page: number
  page_size: number
}

// NOTE: the governed-feature key union `GovernedFeature` is already defined once near
// the top of this file (the `GET /features` effective-map keys). It IS the backend
// `_VISIBILITY_FEATURES` allowlist — reused here as the `setFeatureVisibility` key type
// (a value outside it is rejected 400 server-side before any write). Do NOT redeclare it.

/** The audience an advanced feature is visible to. An ENUM, **NEVER a boolean** —
 *  the SEED-115 extensible-audience forward-compat contract: the two-position control
 *  is the degenerate two-audience case of a value designed to grow into an audience
 *  picker (IdP groups / departments at v3.4). `everyone` = all end users see it;
 *  `operators` = operators only (end users are refused server-side, not just hidden);
 *  `off` = hidden from EVERYONE incl. operators — the Phase 181 (REVERT-01 / D-181-01)
 *  master switch that hides an entire feature layer (the visual_workflow_canvas Off state,
 *  resolved BEFORE the operator bypass so flag-off is byte-identical for all). */
export type FeatureAudience = "everyone" | "operators" | "off"

/** Read the users roster (`GET /admin/users`, 148-06). Plain authed GET — the router
 *  gate returns 404 to non-operators; this cross-user read is floor-EXEMPT (the `/runs`
 *  poll precedent, D-07). 1-based pagination; the server clamps `pageSize` ≤ 100. The
 *  backend returns an envelope `{users, page, page_size}` — unwrap defensively (CR-01). */
export async function getUsersRoster(page = 1, pageSize = 50): Promise<UserRosterPage> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    page_size: String(pageSize),
  })
  const res = await fetch(`${API_BASE}/admin/users?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the users roster.", res.status)
  const body = (await res.json()) as Partial<UserRosterPage>
  return {
    users: body.users ?? [],
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
  }
}

/** Disable a user (`POST /admin/users/{id}/disable`, 148-06). Server-enforced: GoTrue
 *  ban + in-flight run cancel + a recorded `user.disable` row. A self-target is refused
 *  409 BEFORE any mutation (lockout-proof — the UI self-guard is only courtesy). The
 *  user's documents/chats/settings are KEPT; re-enable restores access. */
export async function disableUser(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/disable`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to disable the user.", res.status)
}

/** Re-enable a user (`POST /admin/users/{id}/enable`, 148-06). Restorative + direct:
 *  lifts the GoTrue ban and records a `user.enable` row. */
export async function enableUser(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/enable`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to re-enable the user.", res.status)
}

/** Grant operator access (`POST /admin/users/{id}/operator`, 148-06 / D-01). The server
 *  INSERTs the membership populating `granted_by` (mig 095 provenance), idempotently, and
 *  records `operator.grant`. Blast radius: the grantee can see every user's activity + kill
 *  anyone's runs — the amber roster sheet names it before firing. */
export async function grantOperator(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/operator`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to grant operator access.", res.status)
}

/** Revoke operator access (`DELETE /admin/users/{id}/operator`, 148-06). The person keeps
 *  their normal account (only the membership row is removed); past operator actions stay in
 *  the trail forever. A self-revoke is refused 409 server-side BEFORE any delete. */
export async function revokeOperator(userId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/operator`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to revoke operator access.", res.status)
}

/** Set a governed feature's audience (`PUT /admin/visibility`, 148-06 / VIS-01). The body
 *  is `{feature, audience}` where `audience` is an ENUM VALUE (`"everyone"`|`"operators"`),
 *  **never a boolean** — the extensible-audience forward-compat contract (SEED-115). The
 *  server allowlist-validates both (400 on a bad value BEFORE any write), atomically JSONB-
 *  merges the single record (no lost-update clobber), and records `visibility.set`. The
 *  audience flip propagates within the ~30s per-worker TTL ("on their next call"). */
export async function setFeatureVisibility(
  feature: GovernedFeature,
  audience: FeatureAudience,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/visibility`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ feature, audience }),
  })
  if (!res.ok) throw new ApiError("Failed to update feature visibility.", res.status)
}

/** Phase 167 (VIS-01 / D-167-06) — the 4-tier org roles a `role` greenlist can name.
 *  The server allowlist-validates every role ⊆ this set (400 on a bad role); the client
 *  control is render-only (never the boundary — T-167-10b). */
export type GreenlistRole = "super-admin" | "org-admin" | "dept-admin" | "member"

/** One governed feature's persisted visibility record (`GET /admin/visibility`, Phase 167
 *  WR-05). `audience` is the ENUM value (cold-default aware); `roles` is the greenlist,
 *  meaningful only when `audience === "role"`. */
export interface FeatureVisibilityRecord {
  audience: FeatureAudience | "role"
  roles: GreenlistRole[]
}

/** Read the persisted per-feature audience + greenlist map (`GET /admin/visibility`, Phase 167
 *  WR-05). Seeds the Control Room's visibility/greenlist UI from SERVER truth on mount so an
 *  operator never sees a stale default audience after a reload. Operator-gated (404 to
 *  non-operators); floor-EXEMPT config read. Returns a `{feature: {audience, roles}}` map. */
export async function getFeatureVisibility(): Promise<
  Record<GovernedFeature, FeatureVisibilityRecord>
> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/visibility`, { headers, cache: "no-store" })
  if (!res.ok) throw new ApiError("Failed to load feature visibility.", res.status)
  const body = (await res.json()) as { features?: Record<GovernedFeature, FeatureVisibilityRecord> }
  return body.features ?? ({} as Record<GovernedFeature, FeatureVisibilityRecord>)
}

/** Set a governed feature's audience to a ROLE greenlist (`PUT /admin/visibility`, Phase
 *  167 / VIS-01 / D-167-06). Extends setFeatureVisibility's binary audience to the `role`
 *  audience: the SAME allowlist-validated PUT, plus a `roles[]` greenlist the server checks
 *  ⊆ the 4-tier set BEFORE any write (400 otherwise — SQLi-safe). The greenlist resolver
 *  makes hide == refuse (the UI hide and the API 403 can never disagree). Pass `roles=[]`
 *  for the everyone/operators audiences — they ignore it. */
export async function setFeatureAudience(
  feature: GovernedFeature,
  audience: string,
  roles: string[] = [],
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/visibility`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ feature, audience, roles }),
  })
  if (!res.ok) throw new ApiError("Failed to update feature visibility.", res.status)
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 147 (ADMIN-02 + FLAG-01) — Control Plane client contract.
//
// The Wave-1 seam: types + client fns every Wave-2/3 admin component consumes
// (ActiveRunsSection, CapabilityGrid, MaintenancePanel). SAME security posture as
// the 146 operator calls above: these decide RENDERING ONLY. Every /admin call is
// independently 404-gated server-side (Pitfall 13 / T-147-12) — the client is
// presentation, never a trust boundary. A forged operator flag reaches no data.
// ─────────────────────────────────────────────────────────────────────────────

/** One live entry from `GET /admin/runs` (Plan 147-02) — every `runs:active`
 *  member, enriched from its `runs` row for the 064-B card. `started_at` is a unix
 *  epoch so the client computes elapsed with local math (no poll to tick — D-07).
 *  `killable` is false for eval/tuner jobs (bounded internal work — D-01); those
 *  render an honest "ends on its own" copy with no Kill affordance. `not_responding`
 *  is the SERVER-derived stalled-stream signal (run:{id} stream age — the 064-B
 *  not-responding tag source), never inferred client-side. */
export interface AdminActiveRun {
  run_id: string
  kind: "chat" | "workflow" | "eval" | "tuner"
  thread_id: string | null
  user_id: string | null
  user_email: string | null
  model: string | null
  provider: string | null
  started_at: number
  killable: boolean
  not_responding: boolean
}

/** The five per-feature kill-switch / maintenance flags on the `app_settings` TTL
 *  substrate (FLAG-01). `web_search_enabled` + `sandbox_enabled` are live since 053;
 *  the other three ship with migration 097 (Plan 147-01). Fail-closed polarity is a
 *  BACKEND concern (capability flags default-on last-known-good; `maintenance_mode`
 *  cold-cache → false / platform OPEN). This union is the write key for `setFlag`. */
export type FlagKey =
  | "web_search_enabled"
  | "sandbox_enabled"
  | "self_improve_enabled"
  | "workflows_enabled"
  | "maintenance_mode"
  // Phase 159 (MODEL-03 / D-159-04) — the discovery-panel utility filter toggle. Rides
  // `PUT /admin/flags` verbatim (backend added the key to `_FLAG_HUMAN_NAMES`).
  | "model_discovery_filter_enabled"

/** Read the live active-runs list (`GET /admin/runs`, Plan 147-02). Plain authed
 *  GET — the router gate returns 404 to non-operators. The backend returns an
 *  ENVELOPE `{"runs": [...]}` (same shape as `getOperatorAudit`'s `{entries}`);
 *  unwrap `.runs` here — casting the raw object to `AdminActiveRun[]` would ship a
 *  `{runs}` object into list state and crash the next `.map` (CR-01 precedent). */
export async function getAdminActiveRuns(): Promise<AdminActiveRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/runs`, { headers })
  if (!res.ok) throw new ApiError("Failed to load active runs.", res.status)
  const body = (await res.json()) as { runs?: AdminActiveRun[] }
  return body.runs ?? []
}

/** Operator Kill: cancel ANY user's run (`POST /admin/runs/{run_id}/kill`,
 *  Plan 147-02 — the ownership-unscoped sibling of the owner `DELETE /runs/{id}`).
 *  Idempotent-terminal → 204; the killed user sees exactly a self-cancel (D-03) —
 *  who/why lives only in `operator_audit_log`, never in the victim's chat. */
export async function killRun(runId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/runs/${encodeURIComponent(runId)}/kill`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to end the run.", res.status)
}

/** Flip a per-feature kill-switch / maintenance flag (`PUT /admin/flags`, Plan
 *  147-03). Body `{key, value}`; the backend writes `app_settings` + invalidates
 *  the TTL cache. Effect propagates within the ~30s per-worker window ("takes
 *  effect on their next call" — the 065-A impact copy accounts for this latency). */
export async function setFlag(key: FlagKey, value: boolean): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/flags`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) throw new ApiError("Failed to update the setting.", res.status)
}

/** Extract a FastAPI `detail` STRING from a non-2xx response for an `ApiError`
 *  message, falling back to a generic line when the body is a 422 detail-array or
 *  non-JSON. Mirrors `proposalError` but returns the string (ApiError owns status).
 *  Used by the model-registry write seams so a 409 refusal preserves the server's
 *  plain-language `detail` (the default/locked-guard reason) instead of a generic. */
async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown }
    if (typeof j?.detail === "string") return j.detail
  } catch {
    /* non-JSON body — keep the generic fallback */
  }
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 149 (MODEL-01 + MODEL-02 / D-149-07) — the model-registry client contract.
//
// The interface-first Wave-1 seams the operator Model Registry tab (Plan 07)
// consumes: read the registry (`getModelRegistry`), edit one model's capabilities
// (`setModelCapability`), lock/unlock + pin the org default (`setModelLock` — the
// DEDICATED PUT endpoint, SEPARATE from PATCH), and run live `/models` discovery
// (`runModelDiscovery`, ephemeral diff). SAME security posture as the 146/147
// admin calls above: these decide RENDERING ONLY — every /admin call is
// independently 404-gated server-side (Pitfall 13 / T-149-08). The client adds
// NO authority; the backend `require_operator` 404 gate (Plan 05/06) is the sole
// wall. A non-operator simply gets a 404 → ApiError. The read seam UNWRAPS the
// `{models}` envelope IN THE CLIENT (never in the component — CR-01 precedent).
// ─────────────────────────────────────────────────────────────────────────────

/** One row of the model registry from `GET /admin/models` (Plan 05). Mirrors the
 *  backend registry columns: `capability_source` distinguishes a `"registry"`
 *  hardcoded-default row from a `"db_override"` operator-edited row (the
 *  `model_capabilities_overrides` table, live since mig 053). `is_default` marks
 *  the pinned org default; `is_locked` reflects the D-149-07 lock. `deprecated`
 *  drives the picker's informational badge (surfaced via `deprecated_models`). */
export interface ModelRegistryRow {
  model_id: string
  provider: string
  capability_source: "registry" | "db_override"
  enabled: boolean
  deprecated: boolean
  /** IN-02: the stored deprecation reason (operator context, never shown to end users). The
   *  tab seeds the DeprecatedControl input from this so re-editing a deprecated model
   *  preserves the current note instead of clobbering it with a blank. Optional/nullable —
   *  absent or unset → empty input. */
  deprecated_reason?: string | null
  /** WR-04 honesty: a numeric capability NOT tracked in the built-in registry reads `null`
   *  (rendered as "—" in the tab), NOT a concrete `0`. No built-in MODEL_CAPABILITIES row
   *  carries `context_window_tokens`, so it is `null` on every pure-DEF row until an operator
   *  sets an override. `null` shows an empty edit input (the operator can type a number). */
  context_window_tokens: number | null
  max_output_tokens: number | null
  native_tools: boolean
  llm_call_timeout_seconds: number | null
  is_default: boolean
  is_locked: boolean
  /** AUTH-04 / D-14: the forced-emission tier an OPERATOR asserts for this model. The SAME
   *  WR-04 honesty rule as the numerics applies, with one addition the numerics do not need:
   *  a model with no tracked tier reads `null`, and the tab renders that `null` as the
   *  read-time `coerce` default rather than as blank. Blank would be a lie — the backend
   *  ladder (`forced_emit.py`) does NOT treat an absent tier as "unknown", it treats it as
   *  `coerce`, so a model showing "—" here would already be behaving as best-effort. All 37
   *  rows shipping before migration 120 read `null`. */
  emit_tier: "force_strict" | "force" | "coerce" | null
  /** The editable columns actually STORED as a DB override (OVR) vs inherited from the
   *  built-in registry (DEF). The tab renders per-field OVR/DEF and shows a Reset only on
   *  overridden fields; a Reset sends an explicit `null` for that field (clears to DEF, Plan
   *  05 Task 3). Additive — the Plan-05 backend `_registry_row` already emits it (the seven
   *  `_MODEL_CAP_COLUMNS` names); Plan 07 extends the TS type per the 149-04/05 handoff. */
  overridden_fields: string[]
}

/** The editable-columns patch body for `PATCH /admin/models/{id}` (Plan 06). Every
 *  field optional — the tab sends only what changed. `deprecated` + `deprecated_reason`
 *  flip the D-149-05 badge (the reason is operator context, never shown to end users). */
export interface ModelCapabilityPatch {
  enabled?: boolean
  deprecated?: boolean
  deprecated_reason?: string | null
  context_window_tokens?: number
  max_output_tokens?: number
  native_tools?: boolean
  llm_call_timeout_seconds?: number
  /** AUTH-04: an explicit `null` is a Reset (clears the override to DEF) — the same
   *  explicit-null semantics every other column here carries. */
  emit_tier?: "force_strict" | "force" | "coerce" | null
}

/** The request body for `POST /admin/models` (Plan 02 — the D-159-02 add-by-ID write).
 *  Adds ONE model as a DB-only `model_capabilities_overrides` row from the operator's
 *  EXPLICIT `provider` pick (validated server-side against the native-7 + openrouter
 *  roster). The capability fields are optional pre-fills (every column is null-safe on
 *  the table). There is deliberately NO `enabled` field — the server FORCES
 *  `enabled=false` (the 149 opt-in-enable rule / SC#3: an add never auto-enables; the
 *  operator flips it on from the registry table afterward). Mirrors the backend
 *  `AddModelRequest` pydantic shape exactly. */
export interface AddModelBody {
  model_id: string
  provider: string
  context_window_tokens?: number | null
  max_output_tokens?: number | null
  native_tools?: boolean | null
  deprecated?: boolean
  deprecated_reason?: string | null
}

// ── Plan-07 shape reconciliation (149-06 SUMMARY handoff) ─────────────────────
// The Plan-04 `DiscoveryResult` stub (`{providers:[{new_models,…}]}`) was an
// interface-first placeholder. The Plan-06 backend actually returns
// `compute_diff`'s top-level `{new,changed,vanished}` groups PLUS an additive
// per-provider `providers` outcome summary (names + status only — NEVER the
// response body or key, T-149-04). These types now mirror that exact wire shape,
// which the ModelDiscoveryPanel consumes.

/** The propose-only sentinel the backend emits for a capability a provider did NOT
 *  return (`model_discovery_service.UNKNOWN`). The panel renders any field equal to
 *  this as the amber "unknown — you set it" input — NEVER a guessed value (SC#3). */
export const DISCOVERY_UNKNOWN = "unknown"

/** One discovered-but-unknown model (`compute_diff` "new"). Lands `enabled=false`; each
 *  capability field is a concrete provider-returned value OR the `DISCOVERY_UNKNOWN`
 *  sentinel string (SC#3 — never a guess; keys are the discovery-service field names
 *  `context` / `max_output` / `native_tools`). */
export interface DiscoveredNewModel {
  provider: string
  model_id: string
  enabled: boolean
  /** Phase 159 (MODEL-03 / D-159-01) — a DISPLAY-ONLY tag: `true` when the backend's
   *  `is_utility_model` matched this id as non-chat "utility" noise (embeddings / audio /
   *  image / moderation / rerank / …). The discovery panel (Plan 06) hides utility-flagged
   *  entries by default behind the persisted `model_discovery_filter_enabled` toggle, but it
   *  NEVER gates the confirmable diff (149 red line — propose, humans confirm). Optional for
   *  backward-compat: an older backend response without the field → undefined → not hidden. */
  utility?: boolean
  capabilities: Record<string, number | boolean | string>
}

/** One model whose provider-RETURNED capability differs from the stored value. */
export interface DiscoveredChangedModel {
  provider: string
  model_id: string
  changes: Record<string, { from: number | boolean | string | null; to: number | boolean | string }>
}

/** One stored model an OK provider did NOT return — flagged, never auto-deleted (058/060). */
export interface DiscoveredVanishedModel {
  provider: string
  model_id: string
}

/** One provider's honest run outcome — names + status only. `status` is `"ok"`,
 *  `"no_key"`, `"http-{code}"`, or `"error-{ExceptionName}"`; `ok` is the derived
 *  boolean so the panel can show ran-vs-skipped/errored. */
export interface DiscoveryProviderOutcome {
  provider: string
  status: string
  ok: boolean
}

/** The full ephemeral diff returned by `runModelDiscovery` — never persisted; the
 *  operator reviews it and confirms individual changes through `setModelCapability`. */
export interface DiscoveryResult {
  new: DiscoveredNewModel[]
  changed: DiscoveredChangedModel[]
  vanished: DiscoveredVanishedModel[]
  providers: DiscoveryProviderOutcome[]
}

/** Read the model registry (`GET /admin/models`, Plan 05). Plain authed GET — the
 *  router gate returns 404 to non-operators. The backend returns an ENVELOPE
 *  `{"models": [...]}` (same shape as `getAdminActiveRuns`'s `{runs}`); unwrap
 *  `.models` HERE — casting the raw object to `ModelRegistryRow[]` would ship a
 *  `{models}` object into list state and crash the next `.map` (CR-01 precedent). */
export async function getModelRegistry(): Promise<ModelRegistryRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the model registry.", res.status)
  const body = (await res.json()) as { models?: ModelRegistryRow[] }
  return body.models ?? []
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 196 (AUTH-04 / D-01) — the NON-OPERATOR author view of the same registry.
//
// `getModelRegistry` above is operator-only: `GET /admin/models` 404s a normal
// author, by design and with no RLS backstop behind it. But a workflow author must
// still see what models exist in order to pick one, and neither shipped list is the
// live registry (`verified_models` misses every DB-only id; `allowed_models` misses
// 35 code-registry ids). `GET /models/registry` is the second, NARROWER door: same
// union, six allowlisted fields, authenticated but not operator-gated.
// ─────────────────────────────────────────────────────────────────────────────

/** One model as a workflow AUTHOR may see it — the six-field allowlist projection
 *  served by `GET /models/registry`.
 *
 *  ⚠ This is deliberately a STANDALONE interface. It does not `extends` the operator
 *  row and is not derived from it by a `Pick<…>` or any other mapped type — a grep
 *  for either against this file must come back empty. The operator row carries
 *  `deprecated_reason`, whose own doc-comment above declares it "operator context,
 *  never shown to end users". A structural allowlist is what stops a field added to
 *  the operator row later from travelling to every author by inheritance — the
 *  Phase 190 CR-01 shape, where migration 116's RLS copy leaked a secret column
 *  precisely by inheriting rather than allowlisting. The duplication is the point.
 *
 *  `emit_tier` is `null` when untracked, and `null` is NOT "unknown": the backend
 *  ladder reads an absent tier as `coerce`, so a surface rendering this must say
 *  `coerce` rather than blank (the same rule the operator row's field carries). */
export interface AuthorModelRow {
  model_id: string
  provider: string
  capability_source: string
  enabled: boolean
  deprecated: boolean
  emit_tier: "force_strict" | "force" | "coerce" | null
}

/** Read the LIVE model registry as a non-operator author (`GET /models/registry`).
 *
 *  How this differs from `getModelRegistry` above, in three ways that all matter:
 *  (1) it is NOT operator-gated — a plain authenticated author gets 200 where
 *  `/admin/models` gives them a byte-identical 404; (2) every row is the six-field
 *  author projection, never the operator row; (3) `run_default_model` is the model a
 *  run would ACTUALLY inherit, resolved server-side through the run's own chain — it
 *  is neither `app_settings.llm_model` (a different function, which is why the
 *  registry's `is_default` is not exposed here) nor a hardcoded id, and it is `null`
 *  rather than a guess when the chain cannot resolve.
 *
 *  The backend returns the same `{"models": [...]}` ENVELOPE as `/admin/models`, so
 *  the same rule applies: unwrap `.models` HERE, never in the component — casting the
 *  raw object would ship a `{models}` object into list state and crash the next
 *  `.map` (CR-01 precedent). */
export async function getAuthorModelRegistry(): Promise<{
  models: AuthorModelRow[]
  run_default_model: string | null
}> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/models/registry`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the model registry.", res.status)
  const body = (await res.json()) as {
    models?: AuthorModelRow[]
    run_default_model?: string | null
  }
  return {
    models: body.models ?? [],
    run_default_model: body.run_default_model ?? null,
  }
}

/** Edit one model's capabilities (`PATCH /admin/models/{id}`, Plan 06). Sends only
 *  the changed fields. A 409 (the default/locked guard — e.g. disabling the pinned
 *  default) surfaces as `ApiError` carrying the server `detail` so the tab can show
 *  the plain-language refusal rather than a generic failure. */
export async function setModelCapability(
  modelId: string,
  patch: ModelCapabilityPatch,
): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(modelId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to update the model."), res.status)
}

/** Add ONE model by explicit id + provider (`POST /admin/models`, Plan 02 — the
 *  D-159-02 add-by-ID write). Writes a DB-only override row that lands `enabled=false`
 *  (SC#3 — the server forces it; `AddModelBody` carries NO `enabled` field). A 409
 *  ("already in the registry") or 422 (bad provider / wrong-typed capability) surfaces
 *  as `ApiError` carrying the server `detail` so the add-by-ID form can show the
 *  plain-language refusal (mirrors `setModelCapability`). The client adds NO authority —
 *  the router 404-gates non-operators server-side. */
export async function addModelById(body: AddModelBody): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to add the model."), res.status)
}

/** Lock/unlock + pin the org default (`PUT /admin/models/{id}/lock`, Plan 06) — the
 *  DEDICATED D-149-07 lock endpoint, SEPARATE from the PATCH capability seam. Body
 *  `{ locked }`: `true` locks + pins the org default, `false` unlocks. A 409 (e.g. the
 *  no-dead-default guard refusing to lock a disabled model) surfaces as `ApiError`
 *  with the server `detail`. This is the seam Plan 07's `onLock`/`handleLock` calls. */
export async function setModelLock(modelId: string, locked: boolean): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(modelId)}/lock`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ locked }),
  })
  if (!res.ok) throw new ApiError(await errorDetail(res, "Failed to update the model lock."), res.status)
}

/** Run live `/models` discovery across the configured providers (`POST
 *  /admin/models/discover`, Plan 06). Returns the ephemeral propose-only diff
 *  (SC#3 — never auto-enables anything); the operator confirms each change. */
export async function runModelDiscovery(): Promise<DiscoveryResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/models/discover`, { method: "POST", headers })
  if (!res.ok) throw new ApiError("Failed to run model discovery.", res.status)
  return (await res.json()) as DiscoveryResult
}

/** Record ONE deliberate Control Plane ledger row (`POST /admin/control-plane/record`,
 *  Plan 147-02). D-07 honesty seam: automated polls are floor-EXEMPT (silent);
 *  instead a `"visit"` row ("Opened the Control Plane") is written once on tab-open
 *  and the manual ↻ writes a `"refresh"` row. Every ledger row stays a human action. */
export async function recordControlPlaneEvent(event: "visit" | "refresh"): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/control-plane/record`, {
    method: "POST",
    headers,
    body: JSON.stringify({ event }),
  })
  if (!res.ok) throw new ApiError("Failed to record the Control Plane event.", res.status)
}

/** Read the maintenance flag from the PUBLIC `GET /health` endpoint (Plan 147-01
 *  appends an additive `maintenance` boolean). This is the NON-ADMIN flag source
 *  for the end-user maintenance banner: end users get a 404 on every `/admin/*`
 *  route, so the app-shell banner cannot read `/settings`-gated operator data —
 *  it reads the public health probe instead. Unauthed, best-effort: any failure
 *  or a backend that has not yet shipped the field resolves to `false` (banner
 *  hidden — never falsely announce maintenance). */
export async function getMaintenanceStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) return false
    const body = (await res.json()) as { maintenance?: boolean }
    return body.maintenance ?? false
  } catch {
    return false
  }
}

/** Phase 158 (DEPLOY-02 / D-06) — the STATIC, blip-proof first-run setup-entry signal.
 *
 *  Read from the PUBLIC (unauth) `GET /setup/status`. Users are PRE-AUTH here, so this NEVER
 *  routes through `getAuthHeaders` (which throws "Not authenticated") — it mirrors
 *  `getMaintenanceStatus`, the unauth sibling. Any failure resolves to a safe
 *  `{needs_setup:false}`: a box that can't reach the backend must fall through to the normal
 *  auth page, never falsely render the wizard.
 *
 *  URL note: the backend serves this UNPREFIXED at `/setup/status`; in prod `API_BASE` is
 *  `/api` and nginx strips the single `/api`, in local dev `API_BASE` is `http://localhost:8000`
 *  — so `${API_BASE}/setup/status` is correct in BOTH (exactly like `${API_BASE}/health`). */
export interface SetupStatus {
  needs_setup: boolean
  finalized: boolean
  has_token: boolean
}

export async function getSetupStatus(): Promise<SetupStatus> {
  try {
    const res = await fetch(`${API_BASE}/setup/status`)
    if (!res.ok) return { needs_setup: false, finalized: false, has_token: false }
    const body = (await res.json()) as Partial<SetupStatus>
    return {
      needs_setup: body.needs_setup ?? false,
      finalized: body.finalized ?? false,
      has_token: body.has_token ?? false,
    }
  } catch {
    return { needs_setup: false, finalized: false, has_token: false }
  }
}

/** Phase 158 (DEPLOY-02 / D-07) — the two PUBLIC Supabase values from the open
 *  `GET /public-config`, so the browser's Supabase client can bind at runtime WITHOUT a
 *  frontend rebuild (VITE_* are baked at build — the SC#3 honesty hinge). NEVER a secret: the
 *  backend returns ONLY `supabase_url` + `supabase_anon_key` (both public by design). Returns
 *  null on any failure — the caller then keeps the baked VITE_* fallback.
 *
 *  Note: `lib/supabase.ts` `hydrateSupabaseFromRuntime` inlines its own equivalent fetch to
 *  avoid an api.ts → supabase.ts import cycle; this helper is for any OTHER consumer (the
 *  wizard) that wants the runtime creds through the shared api layer. */
export interface PublicConfig {
  supabase_url: string
  supabase_anon_key: string
}

export async function getPublicConfig(): Promise<PublicConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/public-config`)
    if (!res.ok) return null
    const body = (await res.json()) as Partial<PublicConfig>
    if (!body.supabase_url || !body.supabase_anon_key) return null
    return { supabase_url: body.supabase_url, supabase_anon_key: body.supabase_anon_key }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 (ADMIN-01..05) — the org-admin surface client (the user-side mirror
// of the /admin operator client above). Backs `useOrgPermissionsProbe`, the org
// switcher, the read-only Members tab, and the lighter org-scoped Audit tab.
//
// SECURITY NOTE (mirror of the /admin note): these functions decide RENDERING
// ONLY. The backend `require_org_manage` router gate (Plan 01) over mig 104's
// `current_user_has_permission` SECDEF helper is the sole authority — a forged
// `can_manage`/`can_audit_view` in the browser reaches no data (a non-manager's
// `/org/members` + `/org/audit` return 403). `X-Org-Id` is a hint the server
// re-validates against membership; a spoofed active org is a 403, never trusted.
// ─────────────────────────────────────────────────────────────────────────────

/** One membership row from `GET /org/me` `memberships[]` (org_members JOIN
 *  organizations). Feeds the org switcher — which renders only at 2+ (D-166-02). */
export interface OrgMembership {
  org_id: string
  name: string
  role: string
}

/** The org-permissions probe payload from `GET /org/me` (Plan 01). `can_manage`
 *  gates the shell/rail shield; `can_audit_view` unlocks the cross-member audit
 *  read; `memberships` feeds the switcher. RENDER-ONLY (the backend gate is the wall). */
export interface OrgPermissions {
  /** The server-validated active org (null only on the fail-closed default). */
  org_id: string | null
  role: string
  can_manage: boolean
  can_audit_view: boolean
  /** Phase 168 (SSO-01): true while the caller holds `sso:manage` — gates the SSO tab
   *  (render-only; the backend `require_sso_manage` gate is the wall, T-168-06). Lockstep
   *  sibling of `can_manage`/`can_audit_view`; fail-closed default `false`. */
  can_manage_sso: boolean
  memberships: OrgMembership[]
}

/** The server-derived adoption projection (Phase 167 / INV-01): `active` (a membership
 *  row exists), `pending` (a still-pending invite, no membership yet), `not-yet-invited`
 *  (neither). Computed server-side via `derive_adoption_state` — NEVER a client flag. */
export type AdoptionState = "not-yet-invited" | "pending" | "active"

/** One roster row from `GET /org/members` (org_members JOIN auth.users). `email` is null
 *  if unresolved. Phase 167 adds the server-derived adoption `state` (members are always
 *  `active`) for the roster's adoption chip (INV-01). */
export interface OrgMember {
  user_id: string
  email: string | null
  role: string
  joined_at: string | null
  /** Server-derived adoption state (INV-01). A membership row is always `active`. */
  state?: AdoptionState
}

/** A still-PENDING invitee surfaced on `GET /org/members` `pending_invitations[]` (Phase
 *  167 / INV-01). It is NOT yet an `org_members` row — it carries the invite `id` (for
 *  resend/revoke) + the `pending` adoption state so the roster renders it as a pending chip. */
export interface PendingInvitation {
  id: string
  email: string | null
  role: string
  status: string
  state: AdoptionState
  invited_at: string | null
  expires_at: string | null
}

/** One server page of the org members roster. 1-based; the server clamps
 *  `page_size` <= 100. `total` is the org's member count (COUNT behind the manage gate).
 *  Phase 167 adds `pending_invitations` — the org's still-pending invitees for the roster
 *  adoption chips (INV-01); optional so pre-167 callers/fixtures still typecheck. */
export interface OrgMembersPage {
  members: OrgMember[]
  pending_invitations?: PendingInvitation[]
  page: number
  page_size: number
  total: number
}

/** One org-scoped `audit_log` row from `GET /org/audit`. Same RAW platform
 *  vocabulary as the operator platform-audit (`action_type` is a code the UI maps
 *  to a plain-first label); `org_id` is always the active org (never cross-org). */
export interface OrgAuditRow {
  id: string
  user_id: string | null
  action_type: string
  metadata: Record<string, unknown> | null
  created_at: string
  org_id: string
}

/** The filter shape for the org audit browse (the lighter cut — single source,
 *  no CSV, no user filter). `since` is a chip preset (7d/30d/90d); `actionType`
 *  maps to the single `action_type` query param. */
export interface OrgAuditFilters {
  since?: string | null
  actionType?: string | null
}

/** One server page of the org audit browse. `scope` is the load-bearing honesty
 *  flag: `"all"` = the caller holds `org:audit_view` (all org rows); `"own"` = the
 *  RLS-honest degrade (own rows only) the UI banners — NEVER a silent empty list
 *  (D-166-04). `total` is the COUNT of the (scoped) filtered set for the pager. */
export interface OrgAuditPage {
  entries: OrgAuditRow[]
  total: number
  page: number
  page_size: number
  scope: "all" | "own"
}

/** The org-permissions probe. Calls `GET /org/me` (floor-exempt) and returns the
 *  caller's org identity + permissions + memberships. Mirrors `getOperatorProbe`
 *  (typed GET, `ApiError` on non-OK) but has NO 404→null idiom — every member
 *  reaches their own org's probe (200). The active org is carried by the `X-Org-Id`
 *  header (server-validated), so no arg is needed. RENDER-ONLY (backend gate is the wall). */
export async function getOrgPermissions(): Promise<OrgPermissions> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/me`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org permissions.", res.status)
  const body = (await res.json()) as Partial<OrgPermissions>
  return {
    org_id: body.org_id ?? null,
    role: body.role ?? "member",
    can_manage: body.can_manage ?? false,
    can_audit_view: body.can_audit_view ?? false,
    // Phase 168 (SSO-01): fail-closed unwrap — an absent/false flag hides the SSO tab.
    can_manage_sso: body.can_manage_sso ?? false,
    memberships: body.memberships ?? [],
  }
}

/** Read the read-only org members roster (`GET /org/members`, Plan 01 — manager-only).
 *  Mirrors `getUsersRoster`: 1-based pagination, `pageSize` clamped server-side, an
 *  envelope `{members, page, page_size, total}` unwrapped defensively (CR-01 precedent). */
export async function getOrgMembers(page = 1, pageSize = 50): Promise<OrgMembersPage> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    page_size: String(pageSize),
  })
  const res = await fetch(`${API_BASE}/org/members?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org members.", res.status)
  const body = (await res.json()) as Partial<OrgMembersPage>
  return {
    members: body.members ?? [],
    // Phase 167 (INV-01): the still-pending invitees for the roster's adoption chips.
    pending_invitations: body.pending_invitations ?? [],
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
    total: body.total ?? 0,
  }
}

/** Shared query-string builder for the org audit browse (the lighter single-source
 *  cut of `platformAuditParams`). */
function orgAuditParams(filters: OrgAuditFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.since) params.set("since", filters.since)
  if (filters.actionType) params.set("action_type", filters.actionType)
  return params
}

/** Browse the org-scoped `audit_log` (`GET /org/audit`, Plan 01 — manager-only).
 *  Mirrors `getPlatformAudit` (params builder + defensive envelope unwrap) but keeps
 *  the single-source `scope` flag: on the own-only degrade the UI banners "you see
 *  only your own activity" instead of a silent empty list (D-166-04). 1-based
 *  pagination; the server clamps `pageSize` <= 100. */
export async function getOrgAudit(
  filters: OrgAuditFilters,
  page = 1,
  pageSize = 50,
): Promise<OrgAuditPage> {
  const headers = await getAuthHeaders()
  const params = orgAuditParams(filters)
  params.set("page", String(Math.max(1, page)))
  params.set("page_size", String(pageSize))
  const res = await fetch(`${API_BASE}/org/audit?${params}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the org audit activity.", res.status)
  const body = (await res.json()) as Partial<OrgAuditPage>
  return {
    entries: body.entries ?? [],
    total: body.total ?? 0,
    page: body.page ?? page,
    page_size: body.page_size ?? pageSize,
    scope: body.scope === "all" ? "all" : "own",
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 168 (SSO-01) — the SSO connection client fns. Backs the SSO tab (the
// org-admin manage surface) + the identifier-first login route lookup + the
// silent JIT provision that runs on the SSO callback.
//
// SECURITY NOTE (mirror of the /org note above): the manage fns decide RENDERING
// ONLY. The backend `require_sso_manage` router gate (Plan 04) over mig 104's
// `current_user_has_permission` SECDEF helper is the sole authority — a forged
// `can_manage_sso` in the browser reaches no data (T-168-06). The management
// token / any provider secret is NEVER returned to or stored in the browser
// (T-168-04) — only the opaque `provider_id` + lifecycle fields cross the wire.
//
// `getSsoRoute` is the ONE exception to the `getAuthHeaders` shape: it is called
// PRE-auth from the login page (before any session/active-org exists), so it is a
// BARE fetch with no `Authorization`/`X-Org-Id` — the endpoint is membership-free
// and boolean-only (anti-enumeration, T-168-10). `createSsoProvider` /
// `updateSsoProvider` read the server `{detail}` before throwing so the four
// UI-SPEC create-error messages (public-domain reject, metadata-URL unreachable,
// etc.) surface verbatim to the SsoTab (mirror of postMessage's 099-08 unwrap).
// ─────────────────────────────────────────────────────────────────────────────

/** One SSO connection row from `GET /org/sso/providers` (Plan 04). `provider_id` is the
 *  opaque GoTrue provider handle (null only in the brief create window); `status` is server
 *  truth — only `active` routes logins (`pending_approval` awaits operator approval, D-168-05).
 *  NO secret / management token is ever present on this shape (T-168-04). */
export interface SsoConfig {
  id: string
  email_domain: string
  provider_id: string | null
  status: "pending_approval" | "active" | "disabled"
  approved_at: string | null
}

/** Read a non-OK response's FastAPI `{detail}` string (or a fallback) so the server's
 *  actionable create/update copy (public-domain reject, unreachable metadata URL) survives
 *  onto the thrown `ApiError` (mirror of postMessage's 099-08 detail unwrap). */
async function ssoErrorDetail(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
  return typeof body?.detail === "string" ? body.detail : fallback
}

/** Look up whether an email domain routes to an active SSO connection (`GET
 *  /org/sso/route?domain=`, Plan 04). Called PRE-auth from the identifier-first login page,
 *  so it is a BARE fetch — NO `Authorization`, NO `X-Org-Id` (the endpoint is fully public +
 *  boolean-only, anti-enumeration T-168-10). Defensive `{ sso: body.sso ?? false }`. The
 *  login form fails OPEN to the password field if this throws (D-168-02 / SC#3). */
export async function getSsoRoute(domain: string): Promise<{ sso: boolean }> {
  const params = new URLSearchParams({ domain })
  const res = await fetch(`${API_BASE}/org/sso/route?${params}`)
  if (!res.ok) throw new ApiError("Failed to look up the SSO route.", res.status)
  const body = (await res.json()) as { sso?: boolean }
  return { sso: body.sso ?? false }
}

/** List the active org's SSO connections (`GET /org/sso/providers`, Plan 04 — sso:manage-
 *  gated). Mirrors `getOrgMembers`: `getAuthHeaders()` auto-injects `X-Org-Id`, `ApiError`
 *  on non-OK, a defensive envelope unwrap. */
export async function listSsoConfigs(): Promise<SsoConfig[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the SSO connections.", res.status)
  const body = (await res.json()) as { providers?: SsoConfig[] }
  return body.providers ?? []
}

/** Create an SSO connection from an IdP metadata URL + email domain (`POST
 *  /org/sso/providers`, Plan 04 — sso:manage-gated). The server calls the provider-CRUD API
 *  first (fail-closed), rejects public domains 422 BEFORE any provider call (Control 1), and
 *  lands the row `pending_approval` (D-168-05). The server `{detail}` is surfaced verbatim so
 *  the SsoTab renders the actionable create-error copy. NEVER carries a secret in/out. */
export async function createSsoProvider(
  metadataUrl: string,
  emailDomain: string,
): Promise<SsoConfig> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ metadata_url: metadataUrl, email_domain: emailDomain }),
  })
  if (!res.ok) {
    throw new ApiError(await ssoErrorDetail(res, "Failed to add the SSO connection."), res.status)
  }
  return (await res.json()) as SsoConfig
}

/** Update an SSO connection (`PUT /org/sso/providers/{id}`, Plan 04 — sso:manage-gated). A
 *  domain change re-runs the public-domain blocklist server-side; the server `{detail}` is
 *  surfaced verbatim (same actionable-copy contract as create). */
export async function updateSsoProvider(
  id: string,
  patch: { metadata_url?: string; email_domain?: string },
): Promise<SsoConfig> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    throw new ApiError(await ssoErrorDetail(res, "Failed to update the SSO connection."), res.status)
  }
  return (await res.json()) as SsoConfig
}

/** Remove an SSO connection (`DELETE /org/sso/providers/{id}`, Plan 04 — sso:manage-gated).
 *  The server deletes the GoTrue provider FIRST, then the row (no orphan, T-168-09); a 502
 *  keeps the row on upstream failure. Returns 204 No Content (no body to parse). */
export async function deleteSsoProvider(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/providers/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to remove the SSO connection.", res.status)
}

/** Silently provision org membership for a first-time SSO user (`POST /org/sso/provision`,
 *  Plan 04 — get_current_user ONLY, NO X-Org-Id / org gate). The server resolves the org from
 *  the caller's AUTHENTICATED SSO identity (`auth.identities`, never a client claim) and
 *  hardcodes role `member` (D-168-03 / T-168-03 — the client sends NO role/org). Idempotent +
 *  join-additive (safe to call on every SIGNED_IN); a password user gets a 200 no-op
 *  (`joined: false`). Fired by `OrgProvider` on an SSO session before the `/org/me` re-probe. */
export async function provisionSso(): Promise<{
  org_id: string | null
  role: string | null
  joined: boolean
}> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/sso/provision`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to provision the SSO membership.", res.status)
  const body = (await res.json()) as {
    org_id?: string | null
    role?: string | null
    joined?: boolean
  }
  return {
    org_id: body.org_id ?? null,
    role: body.role ?? null,
    joined: body.joined ?? false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Org invitations (Phase 167 / INV-01 + INV-02) — the invitation client fns.
//
// Mirrors the `getOrgMembers`/`getOrgAudit` shape exactly: `getAuthHeaders()` auto-
// injects the active-org `X-Org-Id` (D-166-06) so the server RE-VALIDATES the caller's
// org membership + the `org:invite` gate (the client is never the boundary — T-167-17);
// `ApiError` on non-OK; a defensive `?? fallback` envelope unwrap. The write bodies
// (send/accept) are JSON-serialized. Delivery is link-first (D-167-02): send/resend
// return the raw-token invite LINK for the inviter to copy/share (T-167-18 — the raw
// token lives ONLY in that link, never stored/logged separately).
// ─────────────────────────────────────────────────────────────────────────────

/** One invitation row from `GET /org/invitations` (Phase 167). `token_hash` is NEVER
 *  returned (T-161-04) — only the lifecycle-visible fields. `status` ∈
 *  pending/accepted/expired/revoked. */
export interface Invitation {
  id: string
  email: string | null
  role: string
  status: string
  expires_at: string | null
  invited_by?: string | null
  created_at?: string | null
}

/** `POST /org/invitations` result — the copy/share `link` (raw token, link-first
 *  D-167-02) + the created pending `invitation`. */
export interface SendInvitationResult {
  link: string
  invitation: Invitation
}

/** `POST /org/invitations/accept` result — the org the invitee JOINED, their granted
 *  `role`, and `joined` (true on the first successful join; false on an idempotent
 *  already-accepted re-accept). */
export interface AcceptInvitationResult {
  org_id: string
  role: string
  joined: boolean
}

/** Send an org invitation (`POST /org/invitations`; org:invite-gated server-side).
 *  Returns the link-first copy/share URL (D-167-02) + the created pending invitation.
 *  The role is validated server-side to member/org-admin (400 otherwise). */
export async function sendInvitation(
  email: string,
  role: string,
): Promise<SendInvitationResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, role }),
  })
  if (!res.ok) throw new ApiError("Failed to send the invitation.", res.status)
  const body = (await res.json()) as Partial<SendInvitationResult>
  return {
    link: body.link ?? "",
    invitation: (body.invitation ?? {}) as Invitation,
  }
}

/** List the active org's invitations (`GET /org/invitations`; org:invite-gated). An
 *  optional `status` chip filters by lifecycle state. `token_hash` is never returned. */
export async function listInvitations(status?: string): Promise<Invitation[]> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/org/invitations${qs ? `?${qs}` : ""}`, { headers })
  if (!res.ok) throw new ApiError("Failed to load the invitations.", res.status)
  const body = (await res.json()) as { invitations?: Invitation[] }
  return body.invitations ?? []
}

/** Re-mint a fresh token + expiry for a pending invite (`POST /org/invitations/{id}/resend`;
 *  org:invite-gated). Returns the FRESH copy/share link (D-167-02). A non-pending /
 *  cross-org id → 404 server-side. */
export async function resendInvitation(id: string): Promise<{ link: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations/${id}/resend`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to resend the invitation.", res.status)
  const body = (await res.json()) as { link?: string }
  return { link: body.link ?? "" }
}

/** Revoke a pending invite (`DELETE /org/invitations/{id}`; org:invite-gated). A soft
 *  `status='revoked'` flip server-side (keeps the audit trail); a non-pending / cross-org
 *  id → 404. Returns 204 No Content (no body to parse). */
export async function revokeInvitation(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) throw new ApiError("Failed to revoke the invitation.", res.status)
}

/** Accept an invitation via its raw token (`POST /org/invitations/accept`; INV-02 — the
 *  JIT seam). Token-gated server-side (get_current_user ONLY): the org comes from the
 *  VALIDATED token, NOT the `X-Org-Id` header (which the accept route ignores — an
 *  invitee is not yet a member). Idempotent + join-additive (D-167-01). Consumed by
 *  Plan 06's accept landing. */
export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/org/invitations/accept`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new ApiError("Failed to accept the invitation.", res.status)
  const body = (await res.json()) as Partial<AcceptInvitationResult>
  return {
    org_id: body.org_id ?? "",
    role: body.role ?? "member",
    joined: body.joined ?? false,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 190 (CONN-02 / CONN-03) — the connector-connection client
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// Five functions in this file's EXISTING bare-`fetch` shape: `getAuthHeaders()`, an explicit
// `res.ok` check, a typed cast. There is deliberately NO generic request wrapper in api.ts
// and this phase does not introduce one — a wrapper here would be a 5 000-line refactor
// smuggled in behind a feature.
//
// ⚠ THE COPY IS NOT HERE. Every string below is a DEVELOPER message (the `listThreads`
// idiom, "Failed to …"), never a sentence a person reads. UI-SPEC §4c's six refusal
// sentences and §4b's two refusal blocks are authored in the component layer as exported
// identifiers (the `GovernanceSection.tsx:10-17` idiom), so they can be asserted by
// character-identity. What this layer owes the component is the SERVER'S OWN `reason_code`,
// unmodified — that code is the key into the closed §4c map, and a client that invents its
// own wording for it produces a seventh sentence nobody ratified.
//
// The check action's client function landed with its endpoint in plan 190-15, in one commit —
// the seam plan 190-09 named. Six functions now.

/** The closed capability set (the backend `ConnectorCapability`, mig 116's CHECK, and
 *  `EXTERNAL_ACTION_CAPABILITIES` are the other three spellings of this one set). */
export type ConnectorCapability = "send_email" | "create_ticket" | "post_message"

/** SMTP destination facts. There is NO password field — the credential rides `secret` on
 *  the create/update body and is never echoed back (T7). `tls` is a closed two-member union
 *  because D-07 requires TLS either way; there is no plaintext-SMTP member to choose. */
export interface SendEmailConnectionConfig {
  host: string
  port: number
  from_address: string
  /** The NON-secret half of the SMTP credential pair (D-03). */
  username?: string | null
  tls: "starttls" | "implicit"
}

/** Jira Cloud destination facts. `account_email` is the basic-auth USERNAME half (D-03) — a
 *  non-secret fact, which is what lets the pair be shown to an org admin without decrypting
 *  anything. The API token rides `secret`. */
export interface CreateTicketConnectionConfig {
  base_url: string
  project_key: string
  account_email: string
}

/** Slack destination facts — a channel, and NOTHING else (D-02). There is deliberately no
 *  `base_url` / `host` / `webhook_url`: Slack's API host is a module constant in
 *  `app/security/egress.py`, so one of the three destinations is unforgeable by
 *  construction. Do not add a URL field here to "make the form symmetric". */
export interface PostMessageConnectionConfig {
  default_channel: string
}

export type ConnectorConnectionConfig =
  | SendEmailConnectionConfig
  | CreateTicketConnectionConfig
  | PostMessageConnectionConfig

/** What a client is allowed to learn about a connection.
 *
 *  WARNING — THIS TYPE MUST NEVER DECLARE A CREDENTIAL FIELD, IN EITHER FORM. The real gate
 *  is the Pydantic `ConnectorConnectionResponse`, which declares neither, is `extra='forbid'`,
 *  and whose projection is fenced by a module-scope assert that makes adding one an IMPORT
 *  failure (proved by a plant in `test_190_connectors_api.py`, observed RED as a collection
 *  error). This type is documentation — and documentation that names a field the server never
 *  sends invites a component to render it: first as `undefined`, then, the day somebody
 *  "fixes" the backend to match the type, for real.
 *
 *  `last_check_verdict` is a QUALITY HINT the picker renders (UI-SPEC §6d), never an
 *  authorization boundary — mig 116 says so in the column's own COMMENT. A `failed`
 *  connection is still listed and still bindable. */
export interface ConnectorConnection {
  id: string
  org_id: string
  capability: ConnectorCapability
  name: string
  config: ConnectorConnectionConfig
  is_enabled: boolean
  last_checked_at?: string | null
  last_check_verdict?: "not_checked" | "ok" | "failed" | null
  created_at?: string | null
  updated_at?: string | null
}

/** A new connection. `org_id` / `created_by` are absent on purpose — the server hard-sets
 *  both from the authenticated caller, and a body field for either would be a
 *  tenant-selection parameter (the D-14 leak with a friendlier name). */
export interface ConnectorConnectionCreate {
  capability: ConnectorCapability
  name: string
  config: ConnectorConnectionConfig
  /** Write-only plaintext, at this boundary and nowhere else. Encrypted before it touches
   *  the database and never rendered back to any browser once saved (UI-SPEC §3d). */
  secret: string
}

/** All-optional. A present `secret` is a REPLACE, never a merge — and it resets the stored
 *  verdict to `not_checked` server-side. `capability` is absent on purpose: changing it
 *  would orphan both the config shape and the stored credential in one edit. */
export interface ConnectorConnectionUpdate {
  name?: string
  config?: ConnectorConnectionConfig
  secret?: string
  is_enabled?: boolean
}

/** An `ApiError` that also carries the server's machine-readable refusal code.
 *
 *  UI-SPEC §4d's single most likely copy defect is flattening REFUSED (we declined to open
 *  the socket, for a security property) / UNREACHABLE (allowed, nothing answered) /
 *  REJECTED (we reached it and IT said no) into one "could not connect". Three states, three
 *  headings, three next steps — and the client can only keep them apart if it keeps the
 *  server's own code. So `reasonCode` is surfaced verbatim and is NEVER translated here. */
export class ConnectorApiError extends ApiError {
  readonly reasonCode: string | null
  constructor(message: string, status: number, reasonCode: string | null) {
    super(message, status)
    this.name = "ConnectorApiError"
    this.reasonCode = reasonCode
  }
}

/** Pull `detail.reason_code` out of a refusal body without inventing one.
 *
 *  The server sends `{"detail": {"reason_code": "...", "message": "..."}}` for the refusals
 *  that have a code (today: `no_encryption_key`, UI-SPEC §4b moment 9 — Save goes DISABLED)
 *  and a plain string `detail` for the ones that do not. A body carrying no code yields
 *  `null`, which the component renders as its generic branch — never as a fabricated code
 *  that would key into the closed §4c map and print the wrong sentence. */
async function readConnectorReasonCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    const detail = body?.detail
    if (detail && typeof detail === "object" && "reason_code" in detail) {
      const code = (detail as { reason_code?: unknown }).reason_code
      return typeof code === "string" ? code : null
    }
  } catch {
    // A non-JSON body (a proxy's HTML 502, an empty 204) is not a refusal we can key on.
  }
  return null
}

/** `GET /connectors/connections` — every connection in the caller's active org, optionally
 *  narrowed to one capability (the picker's read; mig 116's `(org_id, capability)` index is
 *  exactly this pattern). Org-WIDE: read and bind are available to every member (U-02), so a
 *  non-admin author can still populate the picker. */
export async function listConnectorConnections(
  capability?: string,
): Promise<ConnectorConnection[]> {
  const headers = await getAuthHeaders()
  const qs = capability ? `?capability=${encodeURIComponent(capability)}` : ""
  const res = await fetch(`${API_BASE}/connectors/connections${qs}`, { headers })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to list connections",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection[]>
}

/** `GET /connectors/connections/{id}` — 404 for an absent id AND for another org's, with no
 *  way to tell them apart. Do not "improve" the caller by branching on that 404. */
export async function getConnectorConnection(id: string): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}`, { headers })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to load the connection",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

/** `POST /connectors/connections` — org admins only, enforced SERVER-side (U-02). The panel
 *  removes the button for a non-admin, but the refusal that matters is this request's.
 *  A 503 whose `reasonCode` is `no_encryption_key` is UI-SPEC §4b moment 9: a refusal the
 *  person cannot fix, so Save goes DISABLED rather than staying enabled over a retry. */
export async function createConnectorConnection(
  body: ConnectorConnectionCreate,
): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to create the connection",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

/** `PATCH /connectors/connections/{id}` — org admins only. Ownership is validated server-side
 *  BEFORE the body is interpreted, so an unowned id 404s whatever was sent; no status here
 *  reveals whether an id exists in some other org. */
export async function updateConnectorConnection(
  id: string,
  body: ConnectorConnectionUpdate,
): Promise<ConnectorConnection> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to update the connection",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorConnection>
}

/** `DELETE /connectors/connections/{id}` — org admins only. 204 No Content, so there is no
 *  body to parse. UI-SPEC §2g's graded guard (the victim-naming confirm) lives in the
 *  component; this function is the wire call it makes once the person has confirmed. */
export async function deleteConnectorConnection(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}`, {
    method: "DELETE",
    headers,
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to delete the connection",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
}

/** UI-SPEC §4d's THREE STATES, and they must survive to the client as DISTINCT values.
 *
 *  `refused`     — WE declined to open the socket, for a security property. `reasonCode`
 *                  keys into §4c's CLOSED six-row sentence table; there is no vendor to
 *                  quote, so `provider_message` is empty on this branch.
 *  `unreachable` — the address is allowed and nothing answered on it. The next step is the
 *                  network, not the token.
 *  `rejected`    — we reached it and IT said no. This is the only bucket §5b's *"The host
 *                  rejected this credential"* is written for.
 *
 *  Collapsing these into one "could not connect" is the single most likely copy defect on
 *  this surface, and THIS TYPE is where that collapse would first become possible — a union
 *  of three is a compile error away from becoming a boolean. Do not widen it to a string. */
export type ConnectorCheckBucket = "refused" | "unreachable" | "rejected"

/** The result of one credential check (`POST /connectors/connections/{id}/check`).
 *
 *  ⚠ A CHECK RETURNS A VERDICT — never the credential, in either form. The enforcing gate is
 *  the Pydantic `ConnectorCheckResponse` (no `secret` field, no `secret_ciphertext` field,
 *  `extra='forbid'`); this type is documentation, and documentation that named a credential
 *  field would invite a component to render it.
 *
 *  `bucket` is `null` on success. `reasonCode` is the SERVER'S OWN code, unmodified — a
 *  client that invents its own wording for it produces a seventh sentence nobody ratified. */
export interface ConnectorCheckResult {
  ok: boolean
  verdict: "ok" | "failed"
  /** WHO we authenticated as, as the vendor names it. §5c renders *"Authenticated as
   *  {identity}"*, and it is the half that makes a green check mean something: a credential
   *  that works for the WRONG account is a distinct failure from one that does not work. */
  identity: string | null
  /** The destination that was contacted, derived from the STORED row — never from a body. */
  host: string
  port: number | null
  checked_at: string | null
  bucket: ConnectorCheckBucket | null
  /** The vendor's words VERBATIM — unparaphrased, untranslated, untruncated (071-A, the rule
   *  §5b's `what the host said, verbatim` block binds). `""` when the vendor said nothing. */
  provider_message: string
  /** The guard's own `egress.REFUSAL_REASONS` code on a `refused` bucket, else `null`. */
  reason_code: string | null
}

/** `POST /connectors/connections/{id}/check` — org admins only, enforced SERVER-side (U-02).
 *
 *  ⚠ IT SENDS NO BODY, AND THAT IS THE SECURITY PROPERTY RATHER THAN AN OMISSION. The check
 *  runs on the connection ALREADY STORED, so no plaintext secret ever crosses the wire for a
 *  non-storage purpose — and it exercises the same org-scoped resolver a RUN uses, which is
 *  what makes a green verdict evidence about the row the engine will actually resolve. Do
 *  not "improve" this by posting the form's fields.
 *
 *  It has a SIDE EFFECT (it writes the stored verdict and its timestamp), which is why it is
 *  a POST on its own path rather than a query parameter on the read. Callers should re-fetch
 *  the connection list afterwards rather than flipping a chip optimistically (the 068-A rule).
 *
 *  Authors no user-facing sentence: §5c's headline and §4c's six refusal sentences live in
 *  the component layer as exported identifiers so they can be asserted by character-identity.
 *  A string here is a string nobody tests for drift. */
export async function checkConnectorConnection(id: string): Promise<ConnectorCheckResult> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/connectors/connections/${id}/check`, {
    method: "POST",
    headers,
  })
  if (!res.ok) {
    throw new ConnectorApiError(
      "Failed to check the credential",
      res.status,
      await readConnectorReasonCode(res),
    )
  }
  return res.json() as Promise<ConnectorCheckResult>
}
