# Phase 063: Frontend Stream Decoupling — Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 11 (5 backend/frontend production + 1 optional + 5 tests)
**Analogs found:** 11 / 11
**Match quality summary:** 7 exact, 4 role-match

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/threads.py` (rewrite `send_message` return) | controller (route) | request-response (was streaming) | `backend/app/api/runs.py::stream_run` (Phase 062 — mirrors POST→producer-spawn→JSON-return shape) | exact |
| `backend/app/api/threads.py` (delete `event_consumer` 331-426) | utility (module-level async generator) | streaming | (no analog needed — pure deletion; replaced by `replay_tail_consumer` in `runs.py`) | n/a deletion |
| `backend/app/api/threads.py:462` (CR-01: `.single()` → `.maybe_single()`) | controller (route) | request-response | `backend/app/api/runs.py::stream_run` lines 275-285 (already uses `.maybe_single()` correctly) | exact |
| `frontend/src/lib/api.ts` (split `streamMessage` into `postMessage` + `subscribeToRun`; add `getActiveRuns`, `cancelRun`) | service (API client) | request-response + streaming | existing `streamMessage` (api.ts:97-224) for the parser loop; `getMessages` (api.ts:48-71) for plain JSON GET | exact (parser) + role-match (GET wrapper) |
| `frontend/src/hooks/useMessages.ts` (full rewrite) | hook (state + effects) | streaming + request-response | existing `useMessages.ts` itself (Phase 060 ordering invariants) | exact (incremental rewrite) |
| `frontend/src/components/chat/ChatArea.tsx` (add reconcile triggers) | component | event-driven (mount/focus/visibility/pageshow) | existing `ChatArea.tsx:68-90` thread-switch effect | role-match |
| `frontend/src/components/chat/MessageItem.tsx` (Resume button slot) | component | request-response (button click) | existing `MessageFeedback` slot at `MessageItem.tsx:87-89` | role-match |
| `frontend/src/types/index.ts` (extend Message) | type | n/a | existing `Message` interface at `types/index.ts:72-95` | exact |
| `backend/tests/integration/test_063_post_contract.py` | test | request-response | `backend/tests/integration/test_062_active_runs.py` (mock-supabase pattern, no Redis fixture) | exact |
| `backend/tests/integration/test_063_post_then_subscribe.py` | test | streaming + request-response | `backend/tests/integration/test_062_stream_replay.py` (real Redis + producer drive via POST + GET stream drain) | exact |
| `backend/tests/integration/test_063_legacy_path_deleted.py` | test (static check) | n/a | `backend/tests/integration/test_062_active_runs.py` (lightweight mock-only style) | role-match |
| `e2e/tests/063-refresh-mid-stream.spec.ts` | test (e2e) | streaming + bfcache | `e2e/tests/060-thread-race.spec.ts` (Playwright + Supabase auth + multi-step UI flow) | exact |
| `e2e/tests/063-resume-failed.spec.ts` | test (e2e) | request-response | `e2e/tests/060-thread-race.spec.ts` (same harness) | exact |

---

## Pattern Assignments

### `backend/app/api/threads.py` — `send_message` rewrite (controller, request-response)

**Analog:** `backend/app/api/runs.py` (Phase 062 — already ships the JSON-return + Redis-error 503 + `.maybe_single()` ownership pattern that 063's POST handler converges to)

**Imports pattern** (from `runs.py:32-58`, all required by the new POST contract — most already present in `threads.py`):
```python
from fastapi.responses import JSONResponse
from fastapi import status
from redis.exceptions import RedisError  # already imported at top of threads.py — keep style symmetric with runs.py
```

**Preserve verbatim — INSERTs and producer spawn** (`threads.py:746-807` and `2216-2226`):
```python
# threads.py:746-753 — user message INSERT (UNCHANGED).
# A1 in RESEARCH.md: must capture the inserted row's id for the new response shape.
# Change to .insert(...).select("id").single() OR read .data from aexec response.
await aexec(
    supabase.table("messages").insert({
        "thread_id": thread_id,
        "user_id": current_user["id"],
        "role": "user",
        "content": body.content,
    })
)

# threads.py:768-807 — runs row INSERT + ZADD + spawn-failure cleanup (UNCHANGED).
# CRITICAL: do NOT reorder this block. The runs INSERT must commit BEFORE the
# response returns — frontend's GET /runs/{rid}/stream depends on `runs` row
# being SELECT-able by the time the JSONResponse arrives (Pitfall 4).
run_id = _uuid_mod.uuid4()
...
await aexec(supabase.table("runs").insert({...}))
await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _started_score})
await redis.zadd("runs:active", {str(run_id): _started_score})

# threads.py:2216-2226 — RUN_TASKS registration (UNCHANGED).
task = asyncio.create_task(agent_runner(run_id))
RUN_TASKS[run_id] = task
def _evict(_t, _rid=run_id):
    RUN_TASKS.pop(_rid, None)
task.add_done_callback(_evict)
```

**Replace** (`threads.py:2241-2244` — the legacy SSE return):
```python
# DELETE this block:
return EventSourceResponse(
    event_consumer(redis=redis, run_id=run_id, settings=settings),
    ping=None,
)

# REPLACE with new JSON return (HTTP 201, contract D-063-01):
return JSONResponse(
    status_code=status.HTTP_201_CREATED,
    content={"message_id": str(user_msg_id), "run_id": str(run_id)},
)
```

**Deletion target — `event_consumer` generator** (`threads.py:331-426`): delete the entire function. No replacement needed — `replay_tail_consumer` in `runs.py` is the live equivalent for GET /runs/{rid}/stream.

**Reference for the JSONResponse import pattern** (already used in `runs.py:299-303` for the 503 path):
```python
# Source: backend/app/api/runs.py:299-303
return JSONResponse(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    content={"detail": "Streaming infrastructure unavailable"},
    headers={"Retry-After": "10"},
)
```

---

### `backend/app/api/threads.py:449-490` — CR-01 fix (controller, request-response, optional)

**Analog:** `backend/app/api/runs.py::stream_run` lines 275-285 (already uses the correct `.maybe_single()` + null-coerce pattern)

**Pattern to apply** (Source: `runs.py:275-285`, read 2026-05-03):
```python
# Source: backend/app/api/runs.py:275-285
# .maybe_single() returns None on no-row instead of raising APIError(PGRST116).
# postgrest patch in main.py:22-45 only catches code="204"; PGRST116 would
# propagate as 500 — directly violating D-062-12.
row_resp = await aexec(
    supabase.table("runs")
    .select("run_id, status, thread_id, error")
    .eq("run_id", str(run_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

**Apply at threads.py:463-472** (currently uses `.single()` — replace verbatim):
```python
# CURRENT (broken on real Postgres for cross-user requests):
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .single()                      # ← BUG: PGRST116 → 500 on no-row
)
if not thread_resp.data:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

# FIX (mirror runs.py:275-285):
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .maybe_single()                # ← FIX
)
row = thread_resp.data if thread_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

---

### `frontend/src/lib/api.ts` — split into `postMessage` + `subscribeToRun` + `cancelRun` + `getActiveRuns` (service, request-response + streaming)

**Analog (parser loop):** existing `streamMessage` at `api.ts:127-220` — the fetch+ReadableStream reader loop is **reused verbatim** in `subscribeToRun`. Only the URL and method change.

**Analog (plain JSON GET):** existing `getMessages` at `api.ts:48-71` — pattern for `getActiveRuns`.

**Imports pattern** (already present at `api.ts:1-19`):
```typescript
// Source: frontend/src/lib/api.ts:1-19
import { supabase } from "./supabase"
import type { Thread, Message, ... } from "../types"

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
```

**Pattern A: `postMessage`** (small JSON POST returning `{message_id, run_id}` — mirrors `createThread` at `api.ts:35-46`):
```typescript
// Source: derived from api.ts:35-46 (createThread's POST-with-JSON shape)
//         + RESEARCH.md "Pattern 1" + threads.py new contract
export interface PostMessageResponse {
  message_id: string
  run_id: string
}

export async function postMessage(
  threadId: string,
  content: string,
  options: { model?: string; provider?: string; agentMode?: string },
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
  return res.json() as Promise<PostMessageResponse>
}
```

**Pattern B: `subscribeToRun`** — the parser loop is **lifted verbatim** from `streamMessage` (`api.ts:137-220`). Only the URL changes (POST→GET, `/threads/{id}/messages`→`/runs/{rid}/stream?since=...`).

**Reusable parser core** (Source: `frontend/src/lib/api.ts:127-220`, read 2026-05-03 — copy this block under a new URL):
```typescript
// Source: frontend/src/lib/api.ts:127-220 (verbatim reuse — wire format byte-identical
// per Phase 062 D-062-05). Only the URL + method change.
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
if (!res.ok) throw new Error("Failed to open stream")
if (!res.body) throw new Error("No response body")

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buffer = ""
let doneFired = false

while (true) {
  let done: boolean, value: Uint8Array | undefined
  try {
    ;({ done, value } = await reader.read())
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return
    throw err
  }
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    const raw = line.slice(6).trim()
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.type === "delta") onDelta(parsed.content as string)
      // ... 20+ other type discriminators, COPIED VERBATIM from existing streamMessage ...
      else if (parsed.type === "done") {
        if (!doneFired) { doneFired = true; onDone() }
      } else if (parsed.type === "stream_end") {
        return
      } else if (parsed.type === "error") {
        callbacks.onTerminal("error", parsed.error as string | undefined)
        return
      } else if (parsed.type === "cancelled") {
        callbacks.onTerminal("cancelled")
        return
      }
    } catch { /* ignore malformed lines */ }
  }
}
if (!doneFired) onDone()
```

**Pattern C: `getActiveRuns`** (mirrors `getMessages` shape at `api.ts:48-71`):
```typescript
// Source: derived from api.ts:48-71 (getMessages plain-JSON-GET shape)
//         + Phase 062 active-runs response (threads.py:482-490)
export interface ActiveRun {
  run_id: string
  started_at: string
  status: "streaming"
}

export async function getActiveRuns(threadId: string, signal?: AbortSignal): Promise<ActiveRun[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/active-runs`, { headers, signal })
  if (!res.ok) throw new Error("Failed to list active runs")
  return res.json() as Promise<ActiveRun[]>
}
```

**Pattern D: `cancelRun`** (mirrors `deleteThread` at `api.ts:80-84`):
```typescript
// Source: derived from api.ts:80-84 (deleteThread DELETE shape)
//         + Phase 062 DELETE /runs/{rid} contract (runs.py:354-494)
export async function cancelRun(runId: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/runs/${runId}`, { method: "DELETE", headers })
  // Phase 062 D-062-09: idempotent — 204 always (cross-user → 404 we let propagate as throw).
  if (!res.ok && res.status !== 404) throw new Error("Failed to cancel run")
}
```

---

### `frontend/src/hooks/useMessages.ts` — full rewrite (hook, streaming + request-response)

**Analog:** existing `useMessages.ts` itself — Phase 060 invariants (`activeThreadIdRef`, `loadAbortRef`, `isSendingRef`) are **preserved**; only the streaming transport changes.

**Preserve verbatim — Phase 060 ordering invariants** (`useMessages.ts:43-79`):
```typescript
// Source: frontend/src/hooks/useMessages.ts:43-79
// D-060-01: setViewingThread is the SOLE writer of activeThreadIdRef.
// D-060-02: post-await guard inside loadMessages discards cross-thread responses.
// D-060-03: cancel previous in-flight getMessages fetch before issuing a new one.
// All three patterns STAY in 063.
const setViewingThread = useCallback((threadId: string | null) => {
  activeThreadIdRef.current = threadId
}, [])

const loadMessages = useCallback(async (threadId: string) => {
  loadAbortRef.current?.abort()
  const controller = new AbortController()
  loadAbortRef.current = controller
  try {
    const data = await getMessages(threadId, controller.signal)
    if (activeThreadIdRef.current !== threadId) return
    if (isSendingRef.current) return
    setMessages(data)
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return
    throw err
  }
}, [])
```

**Optimistic placeholder pattern** (`useMessages.ts:88-111` — preserve as-is for `sendMessage`; new deterministic `temp-${run_id}` form for reconcile):
```typescript
// Source: frontend/src/hooks/useMessages.ts:88-111 (verbatim preserve for sendMessage path)
const userMsg: Message = {
  id: makeTempId(),
  thread_id: threadId,
  user_id: "",
  role: "user",
  content,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
setMessages((prev) => [...prev, userMsg])

const assistantId = makeTempId()
const assistantMsg: Message = {
  id: assistantId,
  thread_id: threadId,
  user_id: "",
  role: "assistant",
  content: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tool_calls: [],
}
setMessages((prev) => [...prev, assistantMsg])
setIsStreaming(true)
```

**Replace — Stop semantics** (current `useMessages.ts:34-37`):
```typescript
// CURRENT (D-060):
const stopStreaming = useCallback(() => {
  stoppedByUserRef.current = true
  abortControllerRef.current?.abort()
}, [])

// REPLACE per D-063-03 (Source: RESEARCH.md "Pattern 3"):
const stopStreaming = useCallback(async () => {
  // Read run_id from the latest streaming assistant message (Open Question 2)
  const streamingMsg = [...messages].reverse().find(
    (m) => m.role === "assistant" && m.runStatus === "streaming",
  )
  const runId = streamingMsg?.runId
  if (!runId) return
  stoppedByUserRef.current = true
  try {
    await cancelRun(runId)   // DELETE /runs/{rid}
    // Terminal sentinel arrives via the open SSE — parser breaks naturally.
  } catch (err) {
    console.error("Stop failed:", err)
  }
}, [messages])
```

**New — `reconcile` pattern** (Source: RESEARCH.md "Pattern 2", lines 357-413):
```typescript
// Source: RESEARCH.md "Pattern 2: Reconciliation Hook Ordering" + CONTEXT.md
// "Reconciliation Hook Ordering" mandate. Lives in useMessages.ts.
const subscriptionsRef = useRef<Map<string, AbortController>>(new Map())

const reconcile = useCallback(async (threadId: string) => {
  // CONTEXT.md mandate: active-runs MUST resolve in parallel with loadMessages,
  // otherwise the local message list will appear missing the in-flight assistant
  // message until the next reconcile tick.
  const [activeRuns] = await Promise.all([
    getActiveRuns(threadId),
    loadMessages(threadId),
  ])

  for (const run of activeRuns) {
    // Pitfall 1 short-circuit: skip if already subscribed (StrictMode double-mount,
    // rapid focus events, etc.).
    if (subscriptionsRef.current.has(run.run_id)) continue

    // Deterministic temp-id — idempotent React reconciliation.
    const placeholderId = `temp-${run.run_id}`
    const placeholder: Message = {
      id: placeholderId,
      thread_id: threadId,
      user_id: "",
      role: "assistant",
      content: "",
      created_at: run.started_at,
      updated_at: run.started_at,
      tool_calls: [],
      runId: run.run_id,
      runStatus: "streaming",
    }
    setMessages((prev) => {
      if (prev.some((m) => m.id === placeholderId)) return prev
      return [...prev, placeholder]
    })

    const controller = new AbortController()
    subscriptionsRef.current.set(run.run_id, controller)
    subscribeToRun(run.run_id, "0", makeCallbacksFor(placeholderId), controller.signal)
      .catch((err) => {
        if (!(err instanceof Error && err.name === "AbortError")) console.error(err)
      })
      .finally(() => {
        subscriptionsRef.current.delete(run.run_id)
        loadMessages(threadId).catch(console.error)  // Pitfall 5: terminal-time merge
      })
  }
}, [])
```

---

### `frontend/src/components/chat/ChatArea.tsx` — add reconcile triggers (component, event-driven)

**Analog:** existing `ChatArea.tsx:68-90` thread-switch effect — preserve verbatim; **add a second `useEffect`** for the four reconcile triggers.

**Preserve verbatim — D-060-08 thread-switch ordering** (`ChatArea.tsx:68-90`):
```typescript
// Source: frontend/src/components/chat/ChatArea.tsx:68-90 (UNCHANGED).
// setViewingThread → abortStream → clearMessages → loadMessages MUST stay in this order.
useEffect(() => {
  setViewingThread(thread?.id ?? null)
  if (!thread) {
    clearMessages()
    return
  }
  if (justCreatedThreadRef.current === thread.id) {
    justCreatedThreadRef.current = null
    return
  }
  abortStream()
  clearMessages()
  loadMessages(thread.id).catch(console.error)
}, [thread?.id])
```

**New — reconcile-triggering effect** (Source: RESEARCH.md "Pattern 2" + CONTEXT.md "bfcache Handling"):
```typescript
// Source: RESEARCH.md Pattern 2 ChatArea wiring (lines 419-444) + bfcache mandate.
// Add as a SECOND useEffect alongside the existing thread-switch effect.
useEffect(() => {
  if (!thread?.id) return
  // Mount trigger — fires once per thread.id change.
  reconcile(thread.id).catch(console.error)

  const onVis = () => {
    if (document.visibilityState === "visible") reconcile(thread.id).catch(console.error)
  }
  const onFocus = () => reconcile(thread.id).catch(console.error)
  const onPageShow = (e: PageTransitionEvent) => {
    // CONTEXT.md mandate: bfcache restore ALWAYS reconciles, regardless of local state.
    if (e.persisted) reconcile(thread.id).catch(console.error)
  }

  document.addEventListener("visibilitychange", onVis)
  window.addEventListener("focus", onFocus)
  window.addEventListener("pageshow", onPageShow)

  return () => {
    document.removeEventListener("visibilitychange", onVis)
    window.removeEventListener("focus", onFocus)
    window.removeEventListener("pageshow", onPageShow)
  }
}, [thread?.id, reconcile])
```

---

### `frontend/src/components/chat/MessageItem.tsx` — Resume button slot (component, request-response)

**Analog:** existing `MessageFeedback` slot at `MessageItem.tsx:87-89` — same conditional-render pattern, same shadcn Button affordance, same "post-message action" placement.

**Existing analog pattern** (Source: `MessageItem.tsx:87-89`, read 2026-05-03):
```typescript
// Source: frontend/src/components/chat/MessageItem.tsx:87-89
// Existing "post-message action" affordance — render after content, conditional on assistant role.
{!isStreaming && message.role === "assistant" && message.content && (
  <MessageFeedback messageId={message.id} />
)}
```

**Pattern to apply — Resume button** (Source: RESEARCH.md "Pattern 4", lines 487-498):
```typescript
// Source: RESEARCH.md Pattern 4 + existing MessageFeedback slot at MessageItem.tsx:87-89.
// Add adjacent to MessageFeedback — same slot, same affordance pattern.
// Imports needed: Button from "@/components/ui/button"; RotateCcw from "lucide-react".
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

{message.role === "assistant" && message.runStatus === "failed" && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => onResume?.(message)}
    className="mt-2 text-xs"
  >
    <RotateCcw className="w-3 h-3 mr-1.5" />
    Resume
  </Button>
)}
```

**Resume click handler** (lives in `useMessages.ts` or `ChatArea.tsx`; Source: RESEARCH.md "Pattern 4", lines 502-512):
```typescript
const handleResume = useCallback((failedMsg: Message) => {
  const idx = messages.findIndex((m) => m.id === failedMsg.id)
  const userMsg = idx > 0 ? messages[idx - 1] : null
  if (!userMsg || userMsg.role !== "user") return
  // Re-POST per D-063-04 / D-v2.5-05: explicit user intent (the click); never auto-fired.
  sendMessage(failedMsg.thread_id, userMsg.content, /* same options */)
}, [messages, sendMessage])
```

---

### `frontend/src/types/index.ts` — extend `Message` (type)

**Analog:** existing `Message` interface at `types/index.ts:72-95`.

**Existing pattern** (Source: `types/index.ts:72-95`, read 2026-05-03):
```typescript
// Source: frontend/src/types/index.ts:72-95 — existing Message interface
export interface Message {
  id: string
  thread_id: string
  user_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
  updated_at: string
  tool_calls?: ToolCall[]
  iterationCount?: number
  sub_agent?: SubAgentState
  activatedSkill?: string
  activatedSkills?: SkillActivation[]
  sources?: SourceReference[]
  citations?: Citation[]
  confidence?: ConfidenceResult
  suggestions?: string[]
  isPlanning?: boolean
  stopped?: boolean
}
```

**Apply — add two optional fields** (insert next to `stopped?: boolean`):
```typescript
// Source: RESEARCH.md Open Question 2 — frontend stop/resume needs run_id on the message.
/** Phase 063: Redis Stream run_id this assistant message is/was streamed from. Set by reconcile and sendMessage; absent for DB-only loaded messages until backfilled. */
runId?: string
/** Phase 063: lifecycle status of the underlying run (matches public.runs.status). 'streaming' | 'completed' | 'failed' | 'cancelled'. Resume button surfaces only when runStatus === 'failed' (D-063-04). */
runStatus?: "streaming" | "completed" | "failed" | "cancelled"
```

---

### `backend/tests/integration/test_063_post_contract.py` (test, request-response)

**Analog:** `backend/tests/integration/test_062_active_runs.py` — mock-supabase only, no Redis fixture (the contract under test is the response shape, not Redis I/O).

**Imports + fixture pattern** (Source: `test_062_active_runs.py:13-22`, read 2026-05-03):
```python
# Source: backend/tests/integration/test_062_active_runs.py:13-22
import pytest
from uuid import uuid4
import httpx
from httpx import ASGITransport

from app.dependencies import get_supabase
from app.main import app
from tests.integration._run_helpers import _build_mock_supabase, _make_result, USER_ID
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402

THREAD_A = str(uuid4())
```

**Test body pattern** (Source: `test_062_active_runs.py:26-66`):
```python
# Source: backend/tests/integration/test_062_active_runs.py:26-66 (mock-supabase POST contract test shape)
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_returns_message_and_run_ids():
    """D-063-01: POST returns {message_id, run_id} JSON, NOT EventSourceResponse."""
    mock_supabase = _build_mock_supabase()
    threads_builder = mock_supabase.table("threads")
    threads_builder.execute.side_effect = lambda *a, **k: _make_result({"id": THREAD_A})
    # ... configure messages.insert + runs.insert side_effects per existing _build_mock_supabase ...

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            resp = await c.post(
                f"/threads/{THREAD_A}/messages",
                headers={"Authorization": "Bearer test-token"},
                json={"content": "hello", "agent_mode": "default"},
            )
        assert resp.status_code == 201, f"Expected 201; got {resp.status_code} body={resp.text}"
        # Anti-false-RED guard: response must be JSON, NOT text/event-stream
        assert resp.headers.get("content-type", "").startswith("application/json"), \
            f"Expected JSON content-type, got {resp.headers.get('content-type')!r}"
        body = resp.json()
        assert "message_id" in body and "run_id" in body, f"Expected {{message_id, run_id}}; got {body!r}"
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

---

### `backend/tests/integration/test_063_post_then_subscribe.py` (test, streaming + request-response)

**Analog:** `backend/tests/integration/test_062_stream_replay.py` — drives a real producer via POST, then opens a follow-up GET stream against the new endpoint, drains to terminal.

**Critical Redis-singleton-reset fixture** (Source: `test_062_stream_replay.py:36-51`, read 2026-05-03):
```python
# Source: backend/tests/integration/test_062_stream_replay.py:36-51
# REQUIRED for any test that hits real Redis through the singleton.
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    """Reset app.dependencies._redis between tests (loop-binding trap)."""
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

**Producer-drive-via-POST + GET pattern** (Source: `test_062_stream_replay.py:54-100`, read 2026-05-03):
```python
# Source: backend/tests/integration/test_062_stream_replay.py:54-100 (Step 1: POST → producer spins up).
# 063 modifies this to: POST returns JSON ({message_id, run_id}); read run_id from JSON;
# THEN open GET /runs/{run_id}/stream?since=0 for the actual tokens.
@pytest.mark.asyncio
@pytest.mark.timeout(15)
async def test_post_then_get_stream_renders_full_response(redis_client):
    mock_supabase = _build_mock_supabase()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        with patch(
            "app.api.threads.create_adaptive_streaming_chat",
            side_effect=lambda *a, **k: (iter(_slow_chunks()), CallingMode.NATIVE),
        ), patch(
            "app.services.suggestion_service.generate_suggestions",
            return_value=([], None),
        ), patch(
            "app.api.threads.generate_thread_title",
            return_value=("T", None),
        ):
            async with httpx.AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                # Step 1 (063 form): POST returns JSON not SSE
                resp = await ac.post(
                    f"/threads/{THREAD_A}/messages",
                    headers={"Authorization": "Bearer test-token"},
                    json={"content": "hello", "agent_mode": "default"},
                )
                assert resp.status_code == 201
                run_id = resp.json()["run_id"]

                # Step 2: GET /runs/{rid}/stream?since=0 — drain until TERMINAL_TYPES
                async with ac.stream(
                    "GET",
                    f"/runs/{run_id}/stream?since=0",
                    headers={"Authorization": "Bearer test-token"},
                ) as stream_resp:
                    events = []
                    async for line in stream_resp.aiter_lines():
                        if line.startswith("data: "):
                            payload = json.loads(line[6:])
                            events.append(payload)
                            if payload.get("type") in TERMINAL_TYPES:
                                break
                    # Assert we got delta + terminal
                    assert any(e.get("type") == "delta" for e in events)
                    assert events[-1].get("type") in TERMINAL_TYPES
    finally:
        app.dependency_overrides.pop(get_supabase, None)
```

---

### `backend/tests/integration/test_063_legacy_path_deleted.py` (test, static check)

**Analog:** `backend/tests/integration/test_062_active_runs.py` — mock-supabase-only, lightweight.

**Pattern — static-check via import + AST** (no analog file pattern needed; standard pytest static check):
```python
# Static-check tests: prove event_consumer is gone and POST handler returns JSON.
import pytest
from fastapi.responses import JSONResponse


def test_event_consumer_not_importable():
    """D-063-01: event_consumer at threads.py:331-426 must be DELETED."""
    from app.api import threads as threads_module
    assert not hasattr(threads_module, "event_consumer"), \
        "event_consumer is still defined in app.api.threads — D-063-01 hard cutover not complete"


def test_post_does_not_return_eventsourceresponse():
    """D-063-01: POST send_message must return JSONResponse, not EventSourceResponse."""
    import inspect
    from app.api.threads import send_message
    src = inspect.getsource(send_message)
    assert "EventSourceResponse" not in src, \
        "send_message still references EventSourceResponse — D-063-01 not complete"
    assert "JSONResponse" in src or "201" in src, \
        "send_message must return JSONResponse with status 201"
```

---

### `e2e/tests/063-refresh-mid-stream.spec.ts` and `e2e/tests/063-resume-failed.spec.ts` (e2e)

**Analog:** `e2e/tests/060-thread-race.spec.ts` — full Supabase auth + multi-step Playwright UI flow + request listener for backend evidence.

**Auth pattern** (Source: `060-thread-race.spec.ts:31-39`, read 2026-05-03):
```typescript
// Source: e2e/tests/060-thread-race.spec.ts:31-39
async function signIn(page: Page) {
  await page.goto("/")
  const emailInput = page.getByRole("textbox", { name: /email/i })
  if ((await emailInput.count()) === 0) return // already signed in
  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/new chat/i)).toBeVisible({ timeout: 15_000 })
}
```

**Long-stream prompt + send pattern** (Source: `060-thread-race.spec.ts:25-55`):
```typescript
// Source: e2e/tests/060-thread-race.spec.ts:25-55
const LONG_STREAM_PROMPT =
  "List 10 documents from the knowledge base, then for each one give a 30-word summary based on its content."

async function sendMessageInActiveThread(page: Page, text: string): Promise<void> {
  const messageInput = page.getByRole("textbox", { name: /message|type/i }).or(
    page.locator("textarea"),
  )
  await messageInput.first().fill(text)
  await page.keyboard.press("Enter")
  await expect(page.getByText(text)).toBeVisible({ timeout: 5_000 })
}
```

**Request listener for backend evidence** (Source: `060-thread-race.spec.ts:65-84`):
```typescript
// Source: e2e/tests/060-thread-race.spec.ts:65-84
// 063 adapts this to listen for /runs/{rid}/stream GETs (proves reattach happened)
// and /runs/{rid} DELETEs (proves Stop fired).
const streamActivity: Array<{ url: string; status: "started" | "finished" }> = []
page.on("request", (req) => {
  if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
    streamActivity.push({ url: req.url(), status: "started" })
  }
})
page.on("requestfinished", (req) => {
  if (req.method() === "GET" && /\/runs\/[^/]+\/stream/.test(req.url())) {
    streamActivity.push({ url: req.url(), status: "finished" })
  }
})
```

**Refresh-mid-stream specific** (063-only — no direct analog, derived from CONTEXT.md SC#1):
```typescript
// 063-refresh-mid-stream: send long prompt, wait 3s mid-stream, page.reload(),
// then assert the assistant bubble continues to fill from active-runs reattach.
await sendMessageInActiveThread(page, LONG_STREAM_PROMPT)
await page.waitForTimeout(3_000)  // let some tokens stream
await page.reload()                // F5 mid-stream
// After reload: ChatArea mounts → useMessages.reconcile → getActiveRuns → subscribeToRun.
// Assert /threads/{tid}/active-runs was called AND /runs/{rid}/stream was opened.
const activeRunsCalled = await page.waitForRequest(
  (req) => req.method() === "GET" && /\/threads\/[^/]+\/active-runs$/.test(req.url()),
  { timeout: 10_000 },
)
expect(activeRunsCalled.url()).toMatch(/\/active-runs$/)
// Assert assistant bubble eventually fills past the pre-reload content.
```

---

## Shared Patterns

### Authentication
**Source:** `frontend/src/lib/api.ts:11-19` — `getAuthHeaders()` async helper
**Apply to:** All new frontend API functions (`postMessage`, `subscribeToRun`, `getActiveRuns`, `cancelRun`)
```typescript
// Source: frontend/src/lib/api.ts:11-19 (verbatim — same JWT bearer pattern for every fetch)
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Not authenticated")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}
```

### Backend ownership-then-act ordering
**Source:** `backend/app/api/runs.py:275-285` (stream_run) and `runs.py:365-381` (cancel_run)
**Apply to:** All new/modified `threads.py` endpoints touching `runs` or `threads` rows
**Why:** D-062-12 (404 not 403 for cross-user) + T-062-01 (no existence leak)
```python
# Source: backend/app/api/runs.py:275-285 (verbatim — defense-in-depth pattern)
row_resp = await aexec(
    supabase.table("<table>")
    .select("<cols>")
    .eq("<id_col>", str(<id>))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = row_resp.data if row_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="<resource> not found")
```

### Test fixture: Redis singleton reset
**Source:** `backend/tests/integration/test_062_stream_replay.py:36-51`
**Apply to:** Every new 063 backend test file that touches the real Redis singleton
**Why:** pytest-asyncio function-scope creates a fresh loop per test; the singleton would otherwise be invoked against a closed loop → `RuntimeError("Event loop is closed")`
```python
# Source: backend/tests/integration/test_062_stream_replay.py:36-51 (verbatim)
@pytest.fixture(autouse=True)
def _reset_redis_singleton():
    import app.dependencies as _deps
    _deps._redis = None
    yield
    _deps._redis = None
```

### Test imports: SSE app status reset
**Source:** every existing 062 test file imports `_reset_sse_starlette_app_status` from `test_059_disconnect`
**Apply to:** All new 063 backend integration tests
```python
# Source: ubiquitous in tests/integration/test_062_*.py:21
from tests.integration.test_059_disconnect import _reset_sse_starlette_app_status  # noqa: F401, E402
```

### Frontend optimistic placeholder + setMessages immutable update
**Source:** `frontend/src/hooks/useMessages.ts:88-111` (sendMessage path) and `122-124` (delta callback)
**Apply to:** All reconcile-path placeholders (deterministic `temp-${run_id}` form) and delta accumulation
```typescript
// Source: frontend/src/hooks/useMessages.ts:122-124 (delta accumulation pattern — reusable for reconcile callbacks)
setMessages((prev) =>
  prev.map((m) => (m.id === assistantId ? { ...m, isPlanning: false, content: m.content + delta } : m)),
)
```

### Error handling — `if (!res.ok) throw`
**Source:** every `api.ts` function (`api.ts:31, 44, 51, 75, 83, 93, 134`)
**Apply to:** All new 063 frontend API functions
```typescript
// Source: ubiquitous in frontend/src/lib/api.ts
if (!res.ok) throw new Error("Failed to <action>")
```

---

## No Analog Found

None. Every file in scope has a clear analog in the existing codebase. Phase 063 is — per RESEARCH.md "Don't Hand-Roll" — the thinnest possible new surface; every non-trivial subsystem (run-buffer, replay, cancel, multi-consumer fan-out) is already shipped in Phases 061+062, and every mechanical pattern (auth, parser loop, mock-supabase test, Playwright harness) is already in the repo.

---

## Metadata

**Analog search scope:**
- `backend/app/api/runs.py` (Phase 062 — primary backend analog)
- `backend/app/api/threads.py` (in-place rewrite target + neighbor patterns)
- `backend/tests/integration/test_062_*.py` (10 files — backend test patterns)
- `frontend/src/lib/api.ts` (existing streamMessage + getMessages + getAuthHeaders + deleteThread)
- `frontend/src/hooks/useMessages.ts` (in-place rewrite target — Phase 060 invariants)
- `frontend/src/components/chat/ChatArea.tsx` (thread-switch effect ordering)
- `frontend/src/components/chat/MessageItem.tsx` (MessageFeedback affordance slot)
- `frontend/src/types/index.ts` (Message interface)
- `e2e/tests/060-thread-race.spec.ts` (Playwright + Supabase auth harness)

**Files scanned:** 17 source files + 10 test files = 27 total

**Pattern extraction date:** 2026-05-03

**Key insight for planner:** Most of 063 is **delete + reuse**, not write-new. The backend POST diff is ~5 lines (delete EventSourceResponse return; add JSONResponse return; capture user_msg_id). The frontend `subscribeToRun` is the existing `streamMessage` parser loop with a different URL. The reconcile hook is genuinely new but its trigger wiring (Pattern 2 in RESEARCH.md, lines 419-444) is short. The biggest planning hazard is **NOT deleting** the legacy `event_consumer` (D-063-01 hard cutover) — explicit Wave 0 static-check tests guard this.
