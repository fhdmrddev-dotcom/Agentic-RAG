/**
 * Phase 207 — domain module split out of `lib/api.ts`.
 *
 * ⚠ MOVED VERBATIM, NOT REWRITTEN. `lib/api.ts` is still the only public entry
 * point and keeps its path, because suites mock this module BY PATH and `196-08`
 * measured 249 red tests from a single added export. Nothing outside `lib/` moves.
 *
 * ⚠ This docblock deliberately does NOT spell the mock call it describes: the
 * acceptance census greps for that literal, and prose containing it inflates the
 * count it is supposed to hold still (the 187-24 trap — measured here, not feared).
 */

import type { AskUserAnswerBody, Citation, EmitFailure, EmitSubStep, Message, OutputFile, PendingAsk, SourceReference, TaskRunIndexItem, Thread, Todo, WorkspaceDiff, WorkspaceFile, WorkspaceFileContent, WorkspaceVersion } from "../../types"
import { API_BASE, ApiError, getAuthHeaders } from "./_core"
import type { WorkflowDefinitionJSON } from "./knowledge"
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
  // Phase 223 (BUG-260902-03 / D-223-06): armed connector IDs active when user message was sent
  active_connector_ids?: string[] | null
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
    active_connector_ids,
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
    // Phase 223 (BUG-260902-03 / D-223-06 / D-223-07): preserve [] as [] and null/undefined as undefined
    activeConnectorIds: active_connector_ids != null ? active_connector_ids : undefined,
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
  onTaskDone?: (subRunId: string, status: string, summary?: string) => void
  /** Phase 216 (GRANT-03 / CHAT-07): tool_approval_required SSE event when a connector tool pauses on 'ask' posture. */
  onToolApprovalRequired?: (approval: {
    callId: string
    /** ⚠ THE CONNECTION, NOT ONLY THE SERVICE. Two rows can share a `service_id`, so
     *  "Always allow" must name the row it is changing rather than infer it. Optional on
     *  the type because a run paused before 2026-08-31 has no such field on the wire. */
    connectionId?: string
    serviceId: string
    serviceName: string
    toolName: string
    args: Record<string, any>
  }) => void
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
    /** Phase 214 (STEP-02 / D-214-04) — the declared input values collected by a
     *  launcher (RunModal, the chat launch form, Test Run). Merged server-side into
     *  create_workflow_run.inputs BESIDE kickoff_prompt and folder_id, which are
     *  RESERVED and win over any key spelled the same here (see the merge comment in
     *  backend/app/api/threads.py). Only sent when the map is NON-EMPTY; absence — and
     *  an empty map — produce the byte-identical pre-214 request body, which is what
     *  keeps every ordinary Deep chat send unchanged. Values are strings: the server
     *  declares `dict[str, str]`, so a non-string arrives as a 422 rather than as a
     *  nested object on a flat path. */
    /** Phase 216 (CHAT-05 / CHAT-06): active connector IDs for this turn. */
    activeConnectorIds?: string[]
    inputs?: Record<string, string>
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
      // STEP-02 (D-214-04): additive, and CONDITIONAL for the same reason the two
      // keys above are — an always-present key would change the request body of every
      // chat message in the app. An EMPTY map is not sent either: a workflow that
      // declares no launch inputs must post exactly what it posted before Phase 214.
      ...(options.inputs && Object.keys(options.inputs).length > 0
        ? { inputs: options.inputs }
        : {}),
      // Phase 216 (CHAT-05 / CHAT-06): active connector IDs for this message
      // ⚠ AN EMPTY ARRAY IS SENT, NOT DROPPED. Omitting it used to reach a backend arm
      // that read "absent" as EVERY enabled connection, so turning every chip off asked
      // for all of them. The backend now treats absent and empty alike (none), and this
      // line stops the wire lying about which one the person actually chose.
      ...(options.activeConnectorIds
        ? { active_connector_ids: options.activeConnectorIds }
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

/** Phase 216 (GRANT-03 / CHAT-07): Submit human approval decision for paused tool call. */
/**
 * Submit a decision on a paused tool call.
 *
 * ⚠ `always` IS A THIRD DECISION, NOT `allow` PLUS A FLAG. It means "let this through AND
 * stop asking about this action on this connection", and the server does both — writing
 * the grant with a read-merge-write it owns, because doing that here would put a
 * lost-update race on a permission surface.
 *
 * ⚠ THE GRANT CAN FAIL WHILE THE APPROVAL SUCCEEDS. Approving needs the thread to be
 * yours; changing a grant needs `org:manage`. The response reports both halves separately
 * and the caller must not collapse them — telling someone their setting changed when it
 * did not is the failure mode this whole surface was built to remove.
 */
export async function submitToolApproval(
  threadId: string,
  callId: string,
  decision: "allow" | "reject" | "always",
  options: { connectionId?: string; toolName?: string } = {},
): Promise<{
  status: string
  call_id: string
  decision: string
  grant_persisted?: boolean
  grant_problem?: string | null
}> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/tool-approval`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      call_id: callId,
      decision,
      ...(options.connectionId ? { connection_id: options.connectionId } : {}),
      ...(options.toolName ? { tool_name: options.toolName } : {}),
    }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
    throw new ApiError(
      typeof body?.detail === "string" ? body.detail : "Failed to submit tool approval",
      res.status,
    )
  }
  return (await res.json()) as { status: string; call_id: string; decision: string }
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
        else if (t === "tool_approval_required" && callbacks.onToolApprovalRequired)
          callbacks.onToolApprovalRequired({
            callId: (parsed.call_id ?? parsed.callId) as string,
            connectionId: (parsed.connection_id ?? parsed.connectionId) as string | undefined,
            serviceId: (parsed.service_id ?? parsed.serviceId) as string,
            serviceName: (parsed.service_name ?? parsed.serviceName) as string,
            toolName: (parsed.tool_name ?? parsed.toolName) as string,
            args: (parsed.args ?? {}) as Record<string, any>,
          })
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
   *
   * ── Phase 214 plan 02 (STEP-04 / STEP-05 / D-214-23) — THE SAME MIRROR, WIDENED AGAIN, FOR
   *    THE SAME REASON, AND FOUND A DIFFERENT WAY ──────────────────────────────────────────
   *
   * The four fields below (`failure_reason` / `tool_name` / `capability` / `service_name`) are
   * added here in the SAME COMMIT as `backend/app/models/thread.py::WorkflowPhaseState`, which
   * is the whole point: the paragraph above records that `200-02` widened the backend and not
   * this file, and the panel spent a phase unable to declare fields the wire was sending.
   *
   * ⚠ **WHAT IS DIFFERENT THIS TIME IS HOW IT WAS FOUND.** `200-07` caught it by review.
   * Phase 214 caught the same seam BEFORE writing any code, by a mechanical producer→consumer
   * derivation that walked `_failure_reason` from its writer to its readers and found the two
   * hops no plan owned — this mirror, and `StreamsProvider.tsx::reconcilePhases`, which builds
   * every `Phase` field-by-field so an unmapped field is `undefined` forever with no type error.
   * ⚠ **And the mirror is now checked by a TEST rather than by this comment**:
   * `panel/__tests__/PhaseReconcile.test.tsx` drives the real `reconcilePhases` over a real
   * payload and asserts all four arrive, in BOTH branches, plus a structural fence over the two
   * `Phase`-returning literals. It was observed RED on unmodified source first.
   *
   * ⚠ **STILL A TYPE, NOT A RUNTIME EXPORT** — the property the paragraph above relies on is
   * unchanged, and it was re-proved by grep over THIS plan's real diff rather than quoted.
   *
   * Semantics are stated ONCE, on `WorkflowRunPhase`. The two that bind hardest here:
   * `failure_reason` is `null` when NOT RECORDED and is never an empty string (so the panel's
   * `reason_unknown` sentinel keeps its meaning), and `service_name` is `null` when the bound
   * connection cannot be resolved — the surface then names the ACTION ALONE and never
   * substitutes a string of its own.
   */
  started_at?: string | null
  completed_at?: string | null
  step_count?: number | null
  step_noun?: string | null
  failure_reason?: string | null
  tool_name?: string | null
  capability?: string | null
  service_name?: string | null
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
   * Phase 204.1 (SCHED-01 follow-up) — the soonest ACTIVE schedule on this published row.
   *
   * ⚠ A TYPE, NOT A RUNTIME EXPORT, and that distinction is what this file's ledger row turns
   * on. `api.ts` is the hottest file in the repository and its G-5 seam was RE-DECLINED at
   * `204-03` with a trigger reading: the NEXT phase that adds a runtime export TAKES the
   * split, or escalates it as a phase of its own, and may NOT re-decline. This change adds
   * five optional fields to an existing interface and ZERO runtime exports, so the trigger
   * does not fire — the same measured basis 197 and 192.2 each declined on. Re-derive with a
   * diff of added lines filtered for exported function/const/let/var/class; it must read 0.
   *
   * ⚠ ON `PublishedWorkflow` ONLY. This file's own WR-02-LOOKALIKE warning above records that
   * three identically-typed field sets live here — on `ThreadWorkflowState`, on this type and
   * on `WorkflowDraftRow` — and that a swap between any two TYPECHECKS. These belong to the
   * published library feed alone: the schedules API refuses a draft, and a thread's workflow
   * state is a different question entirely.
   *
   * ⚠ ABSENT MEANS NO ACTIVE SCHEDULE, NOT "NEVER SCHEDULED" — a PAUSED schedule reads absent
   * on purpose. `automationFacts.ts` is the one module that reads that difference.
   */
  next_schedule_at?: string | null
  next_schedule_cron?: string | null
  next_schedule_interval_seconds?: number | null
  next_schedule_timezone?: string | null
  next_schedule_count?: number | null
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
