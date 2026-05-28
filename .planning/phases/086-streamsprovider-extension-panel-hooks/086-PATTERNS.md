# Phase 086: StreamsProvider Extension + Panel Hooks - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 5 modified + 1 optional new file (`usePanelReconcile.ts`)
**Analogs found:** 6 / 6 (all within the same 5 files — purely additive, in-file analogs)

> Phase 086 is 100% additive frontend wiring. Every new symbol has an **exact existing
> analog in the same file** it will be added to. The planner must replicate these
> in-file patterns byte-for-byte and NEVER touch the existing handlers (D-086-18,
> `feedback_no_cross_provider_regressions`). This map gives the verbatim lines to copy.

---

## File Classification

| New/Modified File | Symbols to add | Role | Data Flow | Closest Analog (same file) | Match Quality |
|-------------------|----------------|------|-----------|----------------------------|---------------|
| `frontend/src/stores/streamsStore.ts` | 4 Maps + 4 action sets on `StreamsState` | store-state | event-driven (per-thread reactive) | `streamingThreads` / `fallbackNotices` / `reconcileErrors` Maps + Sets (lines 62-79, 127-135, 137-145) | exact |
| `frontend/src/lib/api.ts` (interface @209) | 7 `StreamCallbacks` callbacks | callback-dispatch (type decl) | request-response | `onSubAgentStart` / `onCodeStdout` optional callback decls (lines 251-279) | exact |
| `frontend/src/lib/api.ts` (dispatch @419-460) | 6 SSE branches + payload-shape branch | callback-dispatch | event-driven (SSE demux) | `else if (t === "sub_agent_start" …)` chain (lines 440-468) | exact |
| `frontend/src/lib/api.ts` (GET helpers) | `getThreadTodos` / `getThreadWorkspaceFiles` / `getThreadPendingAsks` / `getThreadTasks` | fetch-helper | request-response | `getActiveRuns` / `getSnapshot` / `getMessages` (lines 575-621, 123-131) | exact |
| `frontend/src/providers/StreamsProvider.tsx` (factory @241) | 7 no-op default handlers in `makeStreamCallbacks` | callback-dispatch | event-driven | `onSubAgentDone` no-op / `onDone` setMessages closure (lines 271-278) | exact |
| `frontend/src/providers/StreamsProvider.tsx` (named hooks @1540-1599) | `useTodos` / `useWorkspaceFiles` / `useAskUserPrompt` / `useTasks` | named-hook | event-driven + request-response (reconcile) | `useThreadMessages` selector (1540-1546) + reconcile AbortController body (1348-1430) | exact (selector) / role-match (reconcile-in-hook is NEW shape — see §5) |
| `frontend/src/providers/StreamsProvider.tsx` (action bodies @707-1449) | 4 action-body registrations in useEffect #1 | store-state | event-driven | `setMessagesForBucket` immutable nested-Map replace (717-731) | exact |
| `frontend/src/lib/streamsCache.ts` | `todosByThread` + `tasksByThread` persisted slots + version bump | cache-layer | file-I/O (localStorage) | `SerializedSnapshot` shape + `readSnapshotSyncOrEmpty` + `STREAMS_CACHE_VERSION` (lines 41, 118-166) | exact |
| `frontend/src/types/index.ts` | `Todo` / `WorkspaceFile` / `PendingAsk` / `TaskRunIndexItem` | type-def | n/a | existing wire-mirror types (e.g. `ActiveRun` / `ThreadSnapshot` in api.ts:185-202) | role-match |

---

## Pattern Assignments

### 1. `streamsStore.ts` — 4 new per-thread Maps (store-state) — D-086-01

**Analog:** the D-075.4-A1 per-thread fields already on `StreamsState`. Copy the
**three-part shape verbatim** (interface decl → factory default → action stub).

**Part A — interface declaration** (`streamsStore.ts:62-79` — the template):
```typescript
  /** Set of thread IDs currently streaming. … */
  streamingThreads: Set<string>
  /** Per-thread fallback-model notice strings. … */
  fallbackNotices: Map<string, string>
  /** Per-thread reconcile error state … */
  reconcileErrors: Map<string, Error>
  loadingThreads: Set<string>
  subscriptionsByThread: Map<string, Set<string>>
```
The 4 new fields slot in here as `Map<string, Todo[]>` etc. (the CONTEXT names
`todosByThread` / `workspaceFilesByThread` / `pendingAsksByThread` / `tasksByThread`).

**Part B — factory default** (`streamsStore.ts:127-135` — note the type-annotation
comment ABOVE each default; D-075.4-A1 added these so a grep finds both interface
AND default):
```typescript
  // Type: streamingThreads: Set<string>
  streamingThreads: new Set<string>(),
  // Type: fallbackNotices: Map<string, string>
  fallbackNotices: new Map<string, string>(),
  // Type: reconcileErrors: Map<string, Error>
  reconcileErrors: new Map<string, Error>(),
```
→ new: `todosByThread: new Map<string, Todo[]>(),` etc.

**Part C — action stub** (`streamsStore.ts:136-145` — synchronous no-op `() => {}`,
NOT `notMounted`, per RESEARCH §Pitfall 5 since they can fire pre-mount):
```typescript
  actions: {
    setMessagesForBucket: () => {},
    clearThreadBucket: () => {},
    setViewingThread: () => {},
    sendMessage: notMounted,
    reconcile: notMounted,
    …
  },
```
→ new action stubs (all synchronous, all `() => {}`):
`setTodosForThread`, `replaceTodosForThread`, `setWorkspaceFileForThread`,
`removeWorkspaceFileForThread`, `replaceWorkspaceFilesForThread`,
`addPendingAskForThread`, `removePendingAskForThread`, `replacePendingAsksForThread`,
`setTaskForThread`, `updateTaskStatusForThread`, `replaceTasksForThread`.

Also add their signatures to the `actions:` interface block (`streamsStore.ts:80-103`,
mirroring `setMessagesForBucket`'s `(surface, threadId, updater)` shape).

**Import:** add `import type { Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem } from "@/types"`
next to the existing `import type { Message } from "@/types"` (line 38).

---

### 2. `streamsStore.ts` action BODIES — registered in StreamsProvider useEffect #1 (store-state)

**Analog:** `setMessagesForBucket` immutable nested-Map replace (`StreamsProvider.tsx:717-731`).
This is the canonical "clone the Map, set one key, return new ref" pattern that keeps
`subscribeWithSelector` selectors stable. The new `replaceXForThread` / `setXForThread` /
`addX` / `removeX` action bodies register in the SAME `useStreamsStore.setState({ actions: {…} })`
block (the registration spans `StreamsProvider.tsx:714-1449`).

**Per-thread immutable-replace template** (`StreamsProvider.tsx:717-731`):
```typescript
        setMessagesForBucket: (surface, threadId, updater) => {
          useStreamsStore.setState((state) => {
            const surfMap = state.bucketsBySurface.get(surface) ?? new Map<string, Message[]>()
            const prev = surfMap.get(threadId) ?? EMPTY_ARRAY
            const updated =
              typeof updater === "function" ? (updater as …)(prev) : updater
            const nextSurf = new Map(surfMap)
            nextSurf.set(threadId, updated)
            const nextBuckets = new Map(state.bucketsBySurface)
            nextBuckets.set(surface, nextSurf)
            return { bucketsBySurface: nextBuckets }
          })
        },
```
The new actions are SIMPLER (single-level Map, not nested-per-surface). Mirror this
clone-then-set discipline:
```typescript
        replaceTodosForThread: (threadId, todos) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.todosByThread)
            next.set(threadId, todos)
            return { todosByThread: next }
          }),
        addPendingAskForThread: (threadId, ask) =>
          useStreamsStore.setState((s) => {
            const next = new Map(s.pendingAsksByThread)
            const prev = next.get(threadId) ?? EMPTY_ASKS
            next.set(threadId, [...prev, ask])
            return { pendingAsksByThread: next }
          }),
        // removePendingAskForThread mirrors the reconcileErrors delete at 1387-1391:
        //   const next = new Map(s.pendingAsksByThread); filter inner array; set/delete
```
**Delete-key analog** (clear an entry — `StreamsProvider.tsx:1386-1392`):
```typescript
              if (useStreamsStore.getState().reconcileErrors.has(threadId)) {
                useStreamsStore.setState((s) => {
                  const next = new Map(s.reconcileErrors)
                  next.delete(threadId)
                  return { reconcileErrors: next }
                })
              }
```

---

### 3. `api.ts` — 7 new `StreamCallbacks` callbacks (callback-dispatch, type decl) — D-086-06

**Analog:** existing optional callbacks (`api.ts:251-279`). All new ones are `?`-optional.

```typescript
  onSubAgentStart?: (filename: string, task: string) => void
  onSubAgentDelta?: (text: string) => void
  onSubAgentDone?: () => void
  onSkillActivated?: (skillName: string) => void
  …
  onFinalOutputFiles?: (files: { filename: string; url?: string }[]) => void
```
Add the 7 new optional callbacks in this block (recommended names per Claude's Discretion):
`onTodoUpdated`, `onWorkspaceFileWritten`, `onWorkspaceFileDeleted`, `onAskUserPrompt`,
`onAskUserResponse`, `onTaskStart`, `onTaskDone`. Each gets a docstring matching the
existing style (event name + payload shape + which Phase 085/084 emit site).

---

### 4. `api.ts` — 6 SSE dispatch branches + payload-shape branch (callback-dispatch) — **D-086-06 CRITICAL**

**Analog:** the `else if (t === "<event>" && callbacks.onX)` chain (`api.ts:419-468`).
The exact form to copy:
```typescript
        if (t === "delta") callbacks.onDelta(parsed.content as string)
        else if (t === "title" && callbacks.onTitleUpdate)
          callbacks.onTitleUpdate(parsed.content as string)
        else if (t === "tool_start" && callbacks.onToolStart)
          callbacks.onToolStart(parsed.name as string, parsed.args as Record<string, string>)
        …
```

**THE LOAD-BEARING EXISTING LINES (must stay byte-identical) — `api.ts:440-445`:**
```typescript
        else if (t === "sub_agent_start" && callbacks.onSubAgentStart)
          callbacks.onSubAgentStart(parsed.filename as string, parsed.task as string)
        else if (t === "sub_agent_delta" && callbacks.onSubAgentDelta)
          callbacks.onSubAgentDelta(parsed.content as string)
        else if (t === "sub_agent_done" && callbacks.onSubAgentDone)
          callbacks.onSubAgentDone()
```
These are the **legacy `analyze_document` path** (emit sites:
`tool_dispatcher.py:235` sub_agent_start{filename,task}, `:270` sub_agent_delta,
`:276` sub_agent_done no-payload). The new Phase 085 `task` tool emits the SAME event
NAMES but with `sub_run_id` present (`task_service.py:264` / `:428`).

**Required change (payload-shape branch — D-086-06):** rewrite the two bookend
branches so the legacy 2-arg call is preserved as the `else` arm and the new
`sub_run_id`-keyed branch is the `if` arm. The delta branch is UNTOUCHED.
```typescript
        else if (t === "sub_agent_start") {
          if (parsed.sub_run_id != null) {
            // Phase 085 task tool — new payload variant (task_service.py:264)
            callbacks.onTaskStart?.(
              parsed.sub_run_id as string,
              parsed.description as string,
              parsed.tools as string[],
              parsed.max_steps as number,
            )
          } else if (callbacks.onSubAgentStart) {
            // LEGACY analyze_document — BYTE-IDENTICAL to api.ts:440-441
            callbacks.onSubAgentStart(parsed.filename as string, parsed.task as string)
          }
        }
        else if (t === "sub_agent_delta" && callbacks.onSubAgentDelta)
          callbacks.onSubAgentDelta(parsed.content as string)  // UNCHANGED — api.ts:442-443
        else if (t === "sub_agent_done") {
          if (parsed.sub_run_id != null) {
            callbacks.onTaskDone?.(
              parsed.sub_run_id as string,
              parsed.status as string,
              parsed.summary as string,
            )
          } else if (callbacks.onSubAgentDone) {
            callbacks.onSubAgentDone()  // LEGACY — BYTE-IDENTICAL to api.ts:444-445
          }
        }
```
> Failure mode #3/#4 (CONTEXT `<failure_criteria>`): the `parsed.sub_run_id != null`
> discriminator is the ONLY thing keeping the two payload shapes apart. Verify exact
> field name against `task_service.py:264` wire JSON during planning.

**The 4 remaining new branches** (plain, no payload-shape branching) follow the
verbatim chain form, inserted before the terminal `else if (t === "done")` at line 489:
```typescript
        else if (t === "todo_updated" && callbacks.onTodoUpdated)
          callbacks.onTodoUpdated(parsed.todos as Todo[])              // emit: tool_dispatcher.py:1239
        else if (t === "workspace_file_written" && callbacks.onWorkspaceFileWritten)
          callbacks.onWorkspaceFileWritten(parsed.file as WorkspaceFile)  // emit: tool_dispatcher.py:892
        else if (t === "workspace_file_deleted" && callbacks.onWorkspaceFileDeleted)
          callbacks.onWorkspaceFileDeleted(parsed.file_id as string)   // emit: tool_dispatcher.py:987
        else if (t === "ask_user_prompt" && callbacks.onAskUserPrompt)
          callbacks.onAskUserPrompt(parsed.ask as PendingAsk)          // emit: tool_dispatcher.py:1357
        else if (t === "ask_user_response" && callbacks.onAskUserResponse)
          callbacks.onAskUserResponse(parsed.ask_id as string)         // emit: runs.py:560
```
> Exact wire field names (`todos` vs `todo`, `file` vs `file_id`, `ask` shape) MUST be
> read from the emit sites in `tool_dispatcher.py` / `runs.py` and the GET reshape in
> `panel.py` (CONTEXT notes panel.py reshapes `todo_id` → `id`) during planning.

**Cursor-advance safety:** these new non-terminal branches sit ABOVE the
`onCursor` block at `api.ts:534-544` — they will correctly advance the cursor (good;
they are not terminal). Do NOT add `return` to any of them.

---

### 5. `StreamsProvider.tsx` — 4 named hooks (named-hook) — D-086-02 / D-086-09 / D-086-10

**Selector analog (the stable-ref read):** `useThreadMessages` (`StreamsProvider.tsx:1540-1546`):
```typescript
export const useThreadMessages = (
  threadId: string | null,
  surfaceId: SurfaceId = "chat",
): Message[] =>
  useStreamsStore((state) =>
    threadId ? state.bucketsBySurface.get(surfaceId)?.get(threadId) ?? EMPTY_ARRAY : EMPTY_ARRAY,
  )
```
Plus the thread-scoped null-safe selectors at `1589-1599` (`useStreamingForThread` etc.)
showing the `threadId ? … : false/null` guard pattern.

**EMPTY constant analog** (`StreamsProvider.tsx:86`):
```typescript
const EMPTY_ARRAY: Message[] = []
```
→ add `EMPTY_TODOS: Todo[] = []`, `EMPTY_FILES: WorkspaceFile[] = []`,
`EMPTY_ASKS: PendingAsk[] = []`, `EMPTY_TASKS: TaskRunIndexItem[] = []` at module level (D-086-05).

**Reconcile-fetch analog (NEW shape — the hooks own an in-hook `useEffect`):**
The existing named hooks are pure selectors; they do NOT fetch. The 4 new hooks add a
reconcile `useEffect` on `[threadId]`. There is NO existing in-hook fetch to copy
verbatim, so compose from these two existing patterns:

1. **AbortController-per-fetch + cross-thread guard + silent-retry** — the `reconcile`/
   `loadMessages` action body (`StreamsProvider.tsx:1348-1430`):
   ```typescript
   const tryFetch = async (attempt: number): Promise<void> => {
     loadAbortRef.current?.abort()
     const controller = new AbortController()
     loadAbortRef.current = controller
     try {
       const data = await getMessages(threadId, controller.signal)
       if (activeThreadIdRef.current !== threadId) return   // L-068-03 post-await guard
       …setMessagesForBucket(…)
     } catch (err) {
       if (err instanceof Error && err.name === "AbortError") return
       … // per-thread reconcileErrors.set on failure (1423-1428)
     }
   }
   ```
2. **AbortController in effect cleanup (L-068-02 in-flight lock)** — the canonical
   "switch threads → abort in-flight" is the same `controller.abort()` discipline at
   line 1350 + the unmount cleanup at `1483-1490`.

**Hook return contract (D-086-10) — compose into each hook:**
```typescript
export function useTodos(threadId: string | null): {
  data: Todo[]; isLoading: boolean; error: Error | null; reconcile: () => Promise<void>
} {
  const data = useStreamsStore((s) =>
    threadId ? s.todosByThread.get(threadId) ?? EMPTY_TODOS : EMPTY_TODOS,
  )
  const [isLoading, setIsLoading] = useState(false)
  const error = useStreamsStore((s) =>
    threadId ? s.reconcileErrors.get(`${threadId}:todos`) ?? null : null,  // D-086-13 composite key
  )
  const reconcile = useCallback(async () => { /* getThreadTodos → replaceTodosForThread */ }, [threadId])
  useEffect(() => {
    if (!threadId) return
    const controller = new AbortController()
    // setIsLoading(true); fetch with controller.signal; post-await guard; replace store; clear error
    return () => controller.abort()   // L-068-02
  }, [threadId])
  return { data, isLoading, error, reconcile }
}
```
- `useAskUserPrompt` returns `PendingAsk[]` (array, not single — D-085-06 parallel asks).
- Reconcile REPLACES the inner Map atomically via `replacePendingAsksForThread` (D-086-08).
- NO visibility/focus listeners (D-086-15 — do NOT copy useEffect #2 at 1456-1481 into the hooks).
- `reconcileErrors` key extends `threadId` → `${threadId}:todos` etc. (D-086-13). The
  existing store field is reused; only the key string changes per hook.

**Discretion:** a shared `usePanelReconcile<T>(fetcher, threadId, replaceAction, hookId)`
helper (`frontend/src/hooks/usePanelReconcile.ts`) can DRY the 4 copies of the
AbortController + isLoading + error-key plumbing. Planner finalizes (inline is also fine).

---

### 6. `StreamsProvider.tsx` — 7 no-op default handlers in `makeStreamCallbacks` (callback-dispatch)

**Analog:** the no-op + setMessages-closure handlers in `makeStreamCallbacks`
(`StreamsProvider.tsx:241-278`). The factory captures `{ assistantId, threadId, … }` via
closure (L-068-04). Existing no-op example (`onTerminal`, line 276-278):
```typescript
    onTerminal: () => {
      // Default no-op — caller wraps to flip runStatus and handle buffer_expired.
    },
```
Existing closure-captured store write (`onDone`, 271-275):
```typescript
    onDone: () => {
      setMessages((prev) => prev.map((m) => …))
    },
```
The 7 new handlers in this factory write to the **store actions** (not `setMessages`,
which is the chat-message bucket). They close over `threadId` and call the new actions:
```typescript
    onTodoUpdated: (todos) =>
      useStreamsStore.getState().actions.replaceTodosForThread(threadId, todos),
    onWorkspaceFileWritten: (file) =>
      useStreamsStore.getState().actions.setWorkspaceFileForThread(threadId, file),
    onWorkspaceFileDeleted: (fileId) =>
      useStreamsStore.getState().actions.removeWorkspaceFileForThread(threadId, fileId),
    onAskUserPrompt: (ask) =>
      useStreamsStore.getState().actions.addPendingAskForThread(threadId, ask),
    onAskUserResponse: (askId) =>
      useStreamsStore.getState().actions.removePendingAskForThread(threadId, askId),
    onTaskStart: (subRunId, description, tools, maxSteps) =>
      useStreamsStore.getState().actions.setTaskForThread(threadId, { sub_run_id: subRunId, … }),
    onTaskDone: (subRunId, status, summary) =>
      useStreamsStore.getState().actions.updateTaskStatusForThread(threadId, subRunId, status, summary),
```
> `getState().actions.X` is the same indirection the bound `setMessagesForBucketBound`
> helper uses (`StreamsProvider.tsx:709-712`). Both call sites where
> `makeStreamCallbacks({…})` is invoked (`tsx:901` and `tsx:1104`) already pass `threadId`
> in `opts` — the closure is available with NO call-site signature change.

---

### 7. `api.ts` — 4 GET helpers (fetch-helper) — D-086-19

**Analog:** `getActiveRuns` (`api.ts:575-586`) and `getSnapshot` (`api.ts:601-621`).
The exact reusable fetch shape (auth header + optional AbortSignal + non-OK throw):
```typescript
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
```
The 4 new helpers mirror this 1:1 (reuse `getAuthHeaders` at line 11 — **NO new fetch
library**, per `<specifics>`):
```typescript
export async function getThreadTodos(threadId: string, signal?: AbortSignal): Promise<Todo[]>
  → GET ${API_BASE}/threads/${threadId}/todos                (panel.py:67)
export async function getThreadWorkspaceFiles(threadId, signal): Promise<WorkspaceFile[]>
  → GET ${API_BASE}/threads/${threadId}/workspace/files      (workspace.py — Phase 084 D-08)
export async function getThreadPendingAsks(threadId, signal): Promise<PendingAsk[]>
  → GET ${API_BASE}/threads/${threadId}/ask_user/pending     (panel.py:103)
export async function getThreadTasks(threadId, signal): Promise<TaskRunIndexItem[]>
  → GET ${API_BASE}/threads/${threadId}/tasks                (panel.py:156)
```
If the wire JSON needs reshaping (panel.py reshapes `todo_id` → `id`), add a small
mapper mirroring `_mapMessageResponse` (`api.ts:61-121`) / the inline map in `getSnapshot`
(`api.ts:616-620`). Confirm whether reshape happens server-side (then no mapper needed).

---

### 8. `streamsCache.ts` — persisted-shape extension + version bump (cache-layer) — D-086-03 / D-086-04

**Version constant analog** (`streamsCache.ts:41`):
```typescript
export const STREAMS_CACHE_VERSION = 1 as const
```
→ bump to `2 as const` (single minor bump; invalidates all chat-bucket caches too —
accepted one-time cold reload, document in commit, per `<specifics>`).

**Persisted-shape analog** (`streamsCache.ts:113-121`):
```typescript
interface SerializedThreadEntry {
  messages: Message[]
  lastAccessedAt: number
}
interface SerializedSnapshot {
  version: number
  surfaces: Record<SurfaceId, Record<string, SerializedThreadEntry>>
}
```
Extend `SerializedSnapshot` with `todosByThread?: Record<string, Todo[]>` +
`tasksByThread?: Record<string, TaskRunIndexItem[]>` (ONLY these two — NOT pendingAsks
[ephemeral, D-086-03] NOR workspaceFiles [large blobs]).

**Sync-read-in-factory analog** (`streamsCache.ts:130-166`, called from store factory at
`streamsStore.ts:117` — D-068.5-01 first-paint hydration):
```typescript
export function readSnapshotSyncOrEmpty(): Map<SurfaceId, Map<string, Message[]>> {
  try {
    const userId = getCurrentUserIdSync()
    if (!userId) return new Map()
    const raw = localStorage.getItem(streamsCacheKey(userId))
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as SerializedSnapshot
    if (!parsed || parsed.version !== STREAMS_CACHE_VERSION) { /* drop key */ return new Map() }
    … // structural rebuild Object→Map
  } catch { return new Map() }
}
```
Add parallel `readTodosSyncOrEmpty()` / `readTasksSyncOrEmpty()` (or extend the return
shape) following this exact try/catch/version-guard/structural-rebuild discipline, and
wire the reads into the `streamsStore.ts` factory body (line 117 neighbourhood) so
`todosByThread` / `tasksByThread` hydrate on first paint. Mirror the write side in
`writeSnapshotToLocalStorage` (`streamsCache.ts:182-275`) — add the two new slots to the
serialized `snapshot` object. The user-scoped key (`streamsCacheKey`, line 80-82) and
QuotaExceeded fallback (260-270) are reused unchanged — they close failure mode #8
(localStorage cross-user leak).

---

### 9. `types/index.ts` — 4 new wire-mirror types (type-def)

**Analog:** wire-mirror interfaces like `ActiveRun` / `ThreadSnapshot` (`api.ts:185-202`)
— flat interfaces whose fields snake_case-match the backend JSON. The new types mirror
the `panel.py` / `workspace.py` response shapes:
```typescript
export interface Todo { id: string; content: string; status: string; … }        // panel.py:67 reshape (todo_id → id)
export interface WorkspaceFile { file_id: string; filename: string; size: number; … }  // workspace.py
export interface PendingAsk { ask_id: string; prompt: string; run_id: string; … }      // panel.py:103
export interface TaskRunIndexItem { sub_run_id: string; status: string; model: string; started_at: string; … } // panel.py:156
```
> Field names MUST be read from `backend/app/api/panel.py` (lines 67/103/156) +
> `backend/app/api/workspace.py` response models during planning — the table above is
> a placeholder. `TaskRunIndexItem.sub_run_id` is load-bearing (Phase 087 feeds it to
> `subscribeToRun(sub_run_id)`).

---

## Shared Patterns

### Per-thread immutable Map replace (PANEL-06 / D-086-05)
**Source:** `StreamsProvider.tsx:717-731` (`setMessagesForBucket`) + `1387-1391` (delete-key).
**Apply to:** all 4 new store action bodies. Always `new Map(prev)` → mutate → return new
ref so `subscribeWithSelector` selectors stay stable and chat does NOT re-render.

### Module-level EMPTY constant for stable empty refs (D-086-05, RESEARCH §Finding #1)
**Source:** `StreamsProvider.tsx:86` (`const EMPTY_ARRAY: Message[] = []`).
**Apply to:** each of the 4 hooks — one EMPTY constant each, returned when the per-thread
Map has no entry / `threadId === null`. This structurally satisfies PANEL-06 (failure mode #1).

### Named-hook layer hides raw store (D-068-02 / D-086-02)
**Source:** the named-hook block header `StreamsProvider.tsx:1535-1538` + all hooks below.
**Apply to:** `useTodos` / `useWorkspaceFiles` / `useAskUserPrompt` / `useTasks` — exported
from StreamsProvider.tsx; NEVER export `useStreamsStore`.

### AbortController + post-await thread guard (L-068-02 / L-068-03 → D-086-14)
**Source:** `StreamsProvider.tsx:1348-1357` (controller create + `activeThreadIdRef.current !== threadId` guard) + `1483-1490` (cleanup abort).
**Apply to:** each hook's reconcile `useEffect` — `const c = new AbortController()` →
fetch with `c.signal` → `return () => c.abort()`. Closes failure mode #5 (rapid thread-switch stale data).

### Per-thread reconcileErrors (extended composite key) (D-086-13)
**Source:** `StreamsProvider.tsx:1386-1392` (clear) + `1423-1428` (set).
**Apply to:** reuse the existing `reconcileErrors: Map<string, Error>` store field; key
the 4 panel fetches as `${threadId}:todos` / `:files` / `:asks` / `:tasks` so a
`workspace/files` 500 does not break the todos panel (parallel fan-out, D-086-13).

### Synchronous no-op action stubs (RESEARCH §Pitfall 5)
**Source:** `streamsStore.ts:136-145` (`setMessagesForBucket: () => {}`).
**Apply to:** all 11 new action stubs in the store factory — synchronous `() => {}`,
because they can fire before the provider's mount-time `useEffect` registers real bodies.

### First-paint localStorage hydration (D-068.5-01 / D-086-03)
**Source:** `streamsCache.ts:130-166` (`readSnapshotSyncOrEmpty`) called in the Zustand
factory (`streamsStore.ts:117`).
**Apply to:** `todosByThread` + `tasksByThread` only (NOT pendingAsks / workspaceFiles).

---

## No Analog Found

None. Every new symbol maps to an exact in-file analog. The ONLY structurally new shape
is **a reconcile `useEffect` living inside a named hook** (§5) — Phase 068's named hooks
are pure selectors with no fetch. That shape is COMPOSED from two existing patterns
(selector @1540-1546 + AbortController fetch body @1348-1430), not copied from one analog.
The planner should treat §5 as the highest-care item.

---

## Metadata

**Analog search scope:**
`frontend/src/stores/streamsStore.ts` (146 LOC, read in full),
`frontend/src/lib/streamsCache.ts` (316 LOC, read in full),
`frontend/src/lib/api.ts` (lines 1-621 + GET-helper grep — StreamCallbacks, dispatch chain, fetch helpers),
`frontend/src/providers/StreamsProvider.tsx` (1599 LOC — header/EMPTY @1-120, factory @241-360, action bodies @700-759 + 1340-1530, reconcile listeners @1456-1490, named hooks @1535-1599).
**Files scanned:** 4 (all 5 target files except `types/index.ts`, mapped to api.ts wire-mirror analogs).
**Backend emit/GET sites:** referenced from CONTEXT `<canonical_refs>` (read-only; planner confirms exact wire field names against `tool_dispatcher.py` / `panel.py` / `task_service.py` / `runs.py`).
**Pattern extraction date:** 2026-05-28

## PATTERN MAPPING COMPLETE

**Phase:** 086 - streamsprovider-extension-panel-hooks
**Files classified:** 9 symbol-groups across 5 modified files + 1 optional new helper
**Analogs found:** 6 / 6 (all in-file)

### Coverage
- Symbol-groups with exact in-file analog: 8
- Symbol-groups with composed analog (no single source): 1 (the in-hook reconcile useEffect, §5)
- Symbol-groups with no analog: 0

### Key Patterns Identified
- Per-thread `Map<threadId, T>` state follows the D-075.4-A1 three-part shape verbatim (interface decl + type-annotated factory default + synchronous no-op action stub); immutable `new Map(prev)` replace keeps `subscribeWithSelector` selectors stable.
- SSE demux is a flat `else if (t === "<event>" && callbacks.onX)` chain; the `sub_agent_start`/`sub_agent_done` legacy `analyze_document` lines (api.ts:440-445) MUST stay byte-identical, with `parsed.sub_run_id != null` as the ONLY discriminator splitting the new `task` payload from the legacy one (D-086-06, highest-risk).
- Named hooks are selector + (new) in-hook reconcile `useEffect`; module-level EMPTY constants + null-safe `threadId ?` guard give stable empty refs (PANEL-06); AbortController-in-cleanup + post-await thread guard prevent stale cross-thread data; NO visibility/focus listeners on panel hooks (D-086-15).
- GET helpers mirror `getActiveRuns`/`getSnapshot` (getAuthHeaders + optional AbortSignal + non-OK throw); no new fetch library. Cache extends `SerializedSnapshot` with `todosByThread`+`tasksByThread` only + single version bump 1→2.

### File Created
`C:\Vibe Apps\Agentic RAG\.planning\phases\086-streamsprovider-extension-panel-hooks\086-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference exact analog line numbers in each PLAN.md action. Highest-care items: §4 (payload-shape branch — byte-identical legacy path) and §5 (composed in-hook reconcile shape).
