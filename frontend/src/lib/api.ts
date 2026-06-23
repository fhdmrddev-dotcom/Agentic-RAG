import { supabase } from "./supabase"
import type { Thread, Message, Document, Folder, Skill, SkillCreate, SkillUpdate, SkillFile, OutputFile, SourceReference, Citation, Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem, WorkspaceFileContent, WorkspaceVersion, WorkspaceDiff, AskUserAnswerBody, EmitSubStep, EmitFailure, MetadataFieldDef, ViewFilter, SavedView, RelType, RelatedDocumentsResponse, Relationship, ClassificationRule } from "../types"

export interface SkillImportResult {
  created: Skill[]
  errors: Array<{ skill: string; error: string }>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

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
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
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
  /** Phase 067.1 Plan 04: skill description hint from skill_loaded follow-up SSE event.
   * Fires AFTER skill_activated when the skill row's description column is non-empty. */
  onSkillLoaded?: (skillName: string, description: string) => void
  onCodeExecutionStart?: (codePreview: string) => void
  /** Phase 067.4 R-5 (D-067.4-R5-01 amended): heartbeat tick during sandbox execution.
   * Backend emits `code_executing` SSE every ~1 s carrying tool_index + elapsed_seconds;
   * the hook handler updates tool_calls[N].elapsedSeconds for the matching execute_code
   * tool with status==='running'. Strictly additive — does NOT replace post-completion
   * line emit (`onCodeStdout` / `onCodeStderr` still fire after `code_execution_complete`). */
  onCodeExecuting?: (toolIndex: number, elapsedSeconds: number) => void
  onCodeStdout?: (content: string) => void
  onCodeStderr?: (content: string) => void
  onCodeExecutionComplete?: (
    exitCode: number,
    durationMs: number,
    outputFiles: OutputFile[],
    error?: string,
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
        else if (t === "skill_loaded" && callbacks.onSkillLoaded)
          callbacks.onSkillLoaded(parsed.skill_name as string, parsed.description as string)
        else if (t === "code_execution_start" && callbacks.onCodeExecutionStart)
          callbacks.onCodeExecutionStart(parsed.code_preview as string)
        // Phase 067.4 R-5 (D-067.4-R5-01 amended): code_executing heartbeat —
        // backend emits ~every 1 s during sandbox execution carrying tool_index
        // + elapsed_seconds. Inserted before code_stdout to keep heartbeat dispatch
        // contiguous with execution-lifecycle events.
        else if (t === "code_executing" && callbacks.onCodeExecuting)
          callbacks.onCodeExecuting(parsed.tool_index as number, parsed.elapsed_seconds as number)
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
            timeout_seconds: parsed.timeout_seconds as number,
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
}

/** A picker row from GET /workflows/published (backend/app/api/workflows.py
 *  PublishedWorkflow). The minimum the Harness picker needs to list + kick off.
 *
 *  Phase 103-06 (REQ-7 D9/D10): `definition` is the ADDITIVE full WorkflowDefinition
 *  JSONB the Workflows page card uses to derive the client-side strictness tier
 *  (deriveTier) + the phase-type chain. Optional — the composer Harness picker only
 *  reads id/slug/name and ignores it (backward compatible). */
export interface PublishedWorkflow {
  id: string
  slug: string
  name: string
  definition?: WorkflowDefinitionJSON | null
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
): Promise<PublishedWorkflow[]> {
  const headers = await getAuthHeaders()
  const url = projectFolderId
    ? `${API_BASE}/workflows/published?project_folder_id=${encodeURIComponent(projectFolderId)}`
    : `${API_BASE}/workflows/published`
  const res = await fetch(url, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list published workflows (status ${res.status})`)
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

export async function createFolder(name: string, parentId: string | null, isGlobal = false): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, parent_id: parentId, is_global: isGlobal }),
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

export async function toggleFolderGlobal(id: string): Promise<Folder> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/folders/${id}/toggle-global`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the folder owner can toggle global status")
    throw new Error("Failed to toggle folder global status")
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

export async function toggleSkillGlobal(id: string): Promise<Skill> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/skills/${id}/toggle-global`, {
    method: "PATCH",
    headers,
  })
  if (!res.ok) {
    if (res.status === 403) throw new Error("Only the skill owner can toggle global status")
    throw new Error("Failed to update skill.")
  }
  return res.json() as Promise<Skill>
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
  llm_max_output_tokens: number
  openrouter_tool_strategy: "quality" | "native" | "xml"
  // Phase 075.3 D-075.3-13: registry-known model_ids — frontend uses this set
  // to decide whether to render the "unverified" badge inline next to each
  // model in the main LLM dropdown + selected-label.
  verified_models: string[]
  // Phase 075.3 D-075.3-13 + D-075.3-12: per-unknown-model inferred provider
  // mapping; frontend reads this to substitute {provider} in the tooltip text.
  inferred_provider_for: Record<string, string>
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

export async function getProviders(): Promise<{ active: string; active_model: string; providers: { id: string; name: string; models: string[]; is_active: boolean }[] }> {
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

export async function getGovBroken(offset = 0, limit = 20): Promise<PaginatedResponse<GovBrokenItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/broken-relationships?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load broken relationships")
  return res.json() as Promise<PaginatedResponse<GovBrokenItem>>
}

export async function getGovUnclassified(offset = 0, limit = 20): Promise<PaginatedResponse<GovUnclassifiedItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/unclassified?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load unclassified documents")
  return res.json() as Promise<PaginatedResponse<GovUnclassifiedItem>>
}

export async function getGovLowConfidence(offset = 0, limit = 20): Promise<PaginatedResponse<GovLowConfidenceItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-governance/low-confidence?offset=${offset}&limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load low-confidence metadata")
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
 *  hard-sets `is_global=false` (the body never supplies it). Returns the new
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
//   POST   /classification-rules                          create a rule (is_global server-owned)
//   PATCH  /classification-rules/{id}                      update an owned rule (incl. the enabled toggle)
//   DELETE /classification-rules/{id}                      delete an owned rule (204; 404-tolerant)
//   PATCH  /documents/{id}/classification/accept           accept the suggestion (moves + stamps prior_folder_id)
//   PATCH  /documents/{id}/classification/dismiss          dismiss the suggestion (clears _classification; no move)
//
// The client is NOT a trust boundary — the `match_expr` whitelist validation, the
// `is_global` hard-set, the own+global leak-safe reads, and the accept-move folder
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
 *  `{ name, match_expr, suggest_folder_id }` ONLY — it NEVER supplies `is_global`
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
}

/** The structured result of POST /workflows/generate. The route returns HTTP 200
 *  even on a FAILED generation (`ok:false`) — read the body, never throw on it. */
export type GenerateResult =
  | { ok: true; definition: WorkflowDefinitionJSON }
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

/** POST /workflows — create a draft. Returns {id, version}. */
export async function createWorkflowDraft(
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<{ id: string; version: number }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows`, {
    method: "POST",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to create workflow draft (status ${res.status})`)
  return (await res.json()) as { id: string; version: number }
}

/** GET /workflows/drafts — the caller's own draft rows (owner-scoped server-side). */
export async function listDraftWorkflows(signal?: AbortSignal): Promise<WorkflowDraftRow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/drafts`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list draft workflows (status ${res.status})`)
  return (await res.json()) as WorkflowDraftRow[]
}

/** PATCH /workflows/{id} — update a draft. Throws WorkflowConflictError on 409
 *  (the row is published/frozen) and WorkflowNotFoundError on 404 — a 409/404 is
 *  NEVER swallowed as success (T-103-03-04). */
export async function updateWorkflowDraft(
  id: string,
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<WorkflowDefinitionJSON> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 409) throw new WorkflowConflictError()
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to update workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDefinitionJSON
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

/** A single per-provider scoreboard cell. BOTH sub-scores are always present (042-A — the
 *  false-fire rail is never a hidden aggregate): `fires` = should-trigger recall, `no_false`
 *  = should-NOT precision. `score` is the server-computed combined cell score. */
export interface TunerCell {
  provider: string
  model: string
  axes: { fires: number; no_false: number }
  score: number
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
