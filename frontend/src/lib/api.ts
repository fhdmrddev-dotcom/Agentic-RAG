import { supabase } from "./supabase"
import type { Thread, Message, Document, Folder, Skill, SkillCreate, SkillUpdate, SkillFile, OutputFile, SourceReference, Citation } from "../types"

export interface SkillImportResult {
  created: Skill[]
  errors: Array<{ skill: string; error: string }>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL as string

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
    ...rest
  } = m
  const mapped: Message = {
    ...rest,
    citations: (source_refs ?? []) as Citation[],
    runId: run_id ?? undefined,
    runStatus: run_status ?? undefined,
  }
  if (confidence_level) {
    mapped.confidence = {
      level: confidence_level as "high" | "medium" | "low",
      avg_similarity: confidence_avg_similarity ?? 0,
      disclaimer: confidence_disclaimer ?? null,
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
  onDone: () => void
  // Phase 066 D-066-06: 4th kind 'timed_out' — distinct from 'error' (LLM/system failure)
  // and 'cancelled' (user-Stop). Hooks set runStatus='timed_out' on this; MessageItem
  // renders the "Agent reached time limit" banner + Resume button per D-066-09/10.
  onTerminal: (kind: "done" | "error" | "cancelled" | "timed_out", error?: string) => void
  onTitleUpdate?: (title: string) => void
  onToolPreparing?: (name: string, index: number) => void
  onToolStart?: (name: string, args: Record<string, string>) => void
  onToolEnd?: (name: string, result?: string) => void
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
    }),
  })
  if (!res.ok) throw new Error("Failed to send message")
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
 *   - Reader closes without explicit terminal → defensive onTerminal('done')
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
        else if (t === "title" && callbacks.onTitleUpdate)
          callbacks.onTitleUpdate(parsed.content as string)
        else if (t === "tool_preparing" && callbacks.onToolPreparing)
          callbacks.onToolPreparing(parsed.name as string, parsed.index as number)
        else if (t === "tool_start" && callbacks.onToolStart)
          callbacks.onToolStart(parsed.name as string, parsed.args as Record<string, string>)
        else if (t === "tool_end" && callbacks.onToolEnd)
          callbacks.onToolEnd(parsed.name as string, parsed.result as string | undefined)
        else if (t === "sub_agent_start" && callbacks.onSubAgentStart)
          callbacks.onSubAgentStart(parsed.filename as string, parsed.task as string)
        else if (t === "sub_agent_delta" && callbacks.onSubAgentDelta)
          callbacks.onSubAgentDelta(parsed.content as string)
        else if (t === "sub_agent_done" && callbacks.onSubAgentDone)
          callbacks.onSubAgentDone()
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
          callbacks.onTerminal("error", parsed.error as string | undefined)
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
        }

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
  callbacks.onTerminal("done")
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
  // Normalize: prepend API_BASE only for relative URLs (matches
  // ExecuteCodeBlock.tsx resolveOutputUrl shape — keeps the call site
  // simple by accepting either form).
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
  llm_max_output_tokens: number
  openrouter_tool_strategy: "quality" | "native" | "xml"
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
