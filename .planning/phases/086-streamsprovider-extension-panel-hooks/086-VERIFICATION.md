---
phase: 086-streamsprovider-extension-panel-hooks
verified: 2026-05-29T00:00:00Z
status: gaps_found
score: 2/3 must-haves verified
overrides_applied: 0
gaps:
  - truth: "todosByThread and tasksByThread hydrate from localStorage on first paint; pendingAsks and workspaceFiles do not"
    status: partial
    reason: "Read path is wired and correct. Write path is broken: writeSnapshotToLocalStorage is called in useEffect #4 without the todosByThread/tasksByThread optional params (StreamsProvider.tsx:1682-1684), and the subscription selector binds only to state.bucketsBySurface (line 1694-1695) so panel Map mutations never trigger the throttled write. The Plan 01 must-have 'todosByThread and tasksByThread hydrate from localStorage on first paint' is therefore a read-only stub — it will always hydrate empty because nothing ever writes the panel Maps into the snapshot. SC#3 first-paint hydration for todos/tasks is dead."
    artifacts:
      - path: "frontend/src/providers/StreamsProvider.tsx"
        issue: "writeSnapshotToLocalStorage called at line 1682 without todosByThread/tasksByThread params; subscription selector at line 1695 only watches bucketsBySurface — panel Map changes never trigger a write"
      - path: "frontend/src/lib/streamsCache.ts"
        issue: "writeSnapshotToLocalStorage signature accepts optional todosByThread/tasksByThread (lines 268-269) but callers never pass them — read helpers readTodosSyncOrEmpty/readTasksSyncOrEmpty always return empty Maps in practice"
    missing:
      - "Pass state.todosByThread and state.tasksByThread as the 4th/5th args to writeSnapshotToLocalStorage in StreamsProvider useEffect #4 writeNow function"
      - "Widen the subscribeWithSelector subscription selector in useEffect #4 to also trigger on todosByThread and tasksByThread reference changes (separate subscription or tuple selector with custom equality)"
human_verification:
  - test: "Cross-provider SSE routing: send a prompt using each of OpenAI, Anthropic, Google, OpenRouter. Confirm sub_agent_start with sub_run_id routes to onTaskStart (not onSubAgentStart), sub_agent_start without sub_run_id still routes to onSubAgentStart, and todo_updated/workspace_file_written/ask_user_prompt events populate the respective panel Maps without causing any MessageList re-render."
    expected: "Panel Maps update in store; MessageList does not remount or re-render; legacy analyze_document flow unchanged across all 4 providers."
    why_human: "Cross-provider wire-byte differences cannot be unit-mocked; requires live network and real provider SSE streams to validate the discriminator branch and PANEL-06 isolation in practice."
  - test: "Rapid thread-switch during a live tool execution: start a tool call on Thread A, immediately switch to Thread B while the reconcile fetch is in-flight for Thread A. Confirm Thread A's data is not written under Thread B's key and the AbortController abort fires."
    expected: "No cross-thread data bleed; Thread B shows its own panel data; Thread A's reconcile is aborted."
    why_human: "Timing window cannot be reliably reproduced in unit tests; requires manual Chrome DevTools observation of network cancellations and store state."
  - test: "Long-message axis (SC#10 axis 4): send a prompt with >= 50 prior messages or a >= 5 KB user prompt that triggers write_todos and workspace_write tools. Verify todo_updated and workspace_file_written SSE events arrive and update the panel store correctly."
    expected: "Panel Maps populated; no timeout or stream drop; hooks return updated data on the same thread without a thread switch."
    why_human: "Long-message latency and stream-pressure behavior cannot be reliably unit-tested; requires live backend and real streaming session."
---

# Phase 086: StreamsProvider Extension — Panel Hooks Verification Report

**Phase Goal:** The frontend streaming infrastructure routes all new SSE event types to dedicated panel state stores, and per-thread hooks provide reactive data for panel UI components.
**Verified:** 2026-05-29T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Panel subscribes to the same EventSource as chat via StreamsProvider Context — no duplicate SSE connections created when the panel is open | VERIFIED | All 4 named hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`, `useTasks`) read from `useStreamsStore`, which is a singleton. They call `usePanelReconcile` for thread-switch reconcile (GET) only — no additional EventSource is created. The existing `subscribeToRun` path in `makeStreamCallbacks` is the sole SSE subscription. PANEL-05 structural requirement met. |
| 2 | Workspace file events, todo updates, ask_user prompts, and task progress events each route to separate Zustand keys — a `workspace_file_written` event causes zero re-renders in the chat message list | VERIFIED | All 11 action bodies in StreamsProvider (lines 1516-1628) mutate only their dedicated Map (`todosByThread`, `workspaceFilesByThread`, `pendingAsksByThread`, `tasksByThread`) via immutable `new Map(prev)` replace. They never touch `bucketsBySurface`. The `makeStreamCallbacks` default handlers (lines 662-689) route to these actions via `getState().actions`. Chat message selectors read `bucketsBySurface` exclusively; a panel Map mutation cannot trigger a chat re-render. Test FC#1 in `panelHooks.test.tsx` asserts bucket selector ref stability after a panel event. PANEL-06 structural requirement met. |
| 3 | Per-thread hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`, `useTasks`) provide reactive state that reconciles on thread-switch via fetch (D-v2.5-03 pattern) | PARTIAL — core reconcile-on-switch mechanism is correct; localStorage F5-resilience for todos/tasks is broken at the write end (WR-04) | Hooks exist and return `{ data, isLoading, error, reconcile }` (D-086-10). `usePanelReconcile` fires an AbortController-guarded GET fetch on `[threadId]` change and returns `() => controller.abort()` cleanup (L-068-02 pattern honored). Per-hook composite error key (`${threadId}:${hookId}`) isolates failures (D-086-13). HOWEVER: D-086-03 requires `todosByThread`/`tasksByThread` to hydrate from localStorage on first paint. `readTodosSyncOrEmpty()`/`readTasksSyncOrEmpty()` are wired into the store factory (streamsStore.ts lines 200, 206) correctly — but the write side in `useEffect #4` (StreamsProvider.tsx:1682-1684) passes only `state.bucketsBySurface` to `writeSnapshotToLocalStorage`, omitting the two optional Map params. The subscription selector at line 1695 watches only `bucketsBySurface`, so panel Map mutations never trigger the throttled write. The hydration functions always return empty Maps because nothing has ever written todo/task data to the snapshot. F5-resilience for panel state is dead. |

**Score:** 2/3 truths fully verified (SC#1 and SC#2 pass; SC#3 passes at the reconcile-on-switch level but the first-paint hydration goal is unachieved due to WR-04)

### Code Review Warning Assessment

The code review flagged 4 warnings. Assessment of each against success criteria:

**WR-04 (REAL, blocks must-have):** Confirmed by direct code inspection. `StreamsProvider.tsx:1682-1684` calls `writeSnapshotToLocalStorage(state.bucketsBySurface, Date.now(), ...)` without the 4th/5th args. `useEffect #4` subscription at line 1694-1695 is selector-bound to `state.bucketsBySurface` only. `streamsCache.ts` write signature accepts optional params but they are never supplied. Plan 01 must-have "todosByThread and tasksByThread hydrate from localStorage on first paint" is therefore a stub — it only reads from an empty key. This is a real gap against SC#3/D-086-03.

**WR-02 (REAL, quality warning, does not block SC#1-3):** Confirmed. `useReconcileErrorForThread` at StreamsProvider.tsx:1859-1860 reads `reconcileErrors.get(threadId)` (plain key). `usePanelReconcile` writes composite keys `${threadId}:todos`, `${threadId}:files`, etc. The named hook `useReconcileErrorForThread` silently returns null for all panel hook errors. This does NOT block SC#1, SC#2, or SC#3: the 4 panel hooks expose their own `error` field from `usePanelReconcile` directly (each hook returns `{ data, isLoading, error, reconcile }`), so Phase 087 consumers using those hooks get correct error state. The gap is only a problem if Phase 087 uses `useReconcileErrorForThread` to surface panel errors — which it cannot be (Phase 087 is not yet built). This is a forward-compatibility hazard, not a current blocker.

**WR-03 (REAL, quality warning, does not block SC#1-3):** Confirmed. `usePanelReconcile.ts:108-112` — the manual `reconcile()` escape hatch creates a fresh `AbortController` that is not tracked or aborted on unmount. If a user triggers a manual reconcile and immediately unmounts, the post-await `signal.aborted` guard (`if (signal.aborted) return`) at line 74 will not fire (the controller is not aborted), and `replace(tid, data)` may write stale data. This is a real stale-write risk but only on the manual escape hatch path (the thread-switch reconcile is correctly guarded). The primary reconcile path (thread-switch useEffect) is sound. This is a quality defect, not a blocker for the goal "hooks provide reactive state that reconciles on thread-switch."

**WR-01 (QUALITY ISSUE, not a gap against current SCs):** Confirmed. `TaskRunIndexItem.parent_run_id` is typed as `string` (required) but seeded as `""` from the SSE bookend (StreamsProvider.tsx:678). The GET reconcile will overwrite with the correct value, but only after a thread-switch. On the same thread, `parent_run_id` stays `""` if no thread-switch occurs. This does not break SC#1, SC#2, or SC#3 (the hooks return data, reconcile on switch, and the empty string is valid from a type perspective). Phase 087 rendering of `parent_run_id` for navigation may display an empty string before the next reconcile. Surfaced as a quality flag — the correct fix is marking `parent_run_id`, `model`, `provider` as optional in the type to reflect that SSE-seeded rows are partial until a GET reconcile fires.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/types/index.ts` | 4 wire-mirror interfaces (Todo, WorkspaceFile, PendingAsk, TaskRunIndexItem) | VERIFIED | All 4 interfaces present. `PendingAsk` has `tool_call_id` (not `ask_id`). `WorkspaceFile.id` is optional (correct — SSE has no id). `TaskRunIndexItem.parent_run_id` is required string (see WR-01 — quality issue, not missing). |
| `frontend/src/lib/api.ts` | 7 StreamCallbacks + 6 SSE dispatch branches + 4 GET helpers | VERIFIED | 7 optional callbacks declared (lines 300-316). 6 dispatch branches present: 2 payload-shape blocks for `sub_agent_start`/`done` (discriminator `parsed.sub_run_id != null` at lines 472, 484), 4 plain branches for `todo_updated`/`workspace_file_written`/`workspace_file_deleted`/`ask_user_prompt`/`ask_user_response` (lines 542-565). No terminal `return` on plain branches. 4 GET helpers with getAuthHeaders + AbortSignal + non-OK throw (lines 709-753). |
| `frontend/src/stores/streamsStore.ts` | 4 per-thread Maps + 11 action stubs + cache-wired factory defaults | VERIFIED | 4 Maps declared in interface (lines 93-102). 11 action signatures (lines 134-159). 11 synchronous `() => {}` stubs (lines 220-230). Factory hydrates `todosByThread` via `readTodosSyncOrEmpty()` (line 200) and `tasksByThread` via `readTasksSyncOrEmpty()` (line 206). pendingAsksByThread and workspaceFilesByThread start empty (lines 202, 204). |
| `frontend/src/lib/streamsCache.ts` | version=2, 2 persisted slots, 2 read helpers, write extension | VERIFIED (read only) | `STREAMS_CACHE_VERSION = 2` (line 47). `SerializedSnapshot` has optional `todosByThread?` and `tasksByThread?` (lines 132-133). `readTodosSyncOrEmpty()` and `readTasksSyncOrEmpty()` exist (lines 212-242). `writeSnapshotToLocalStorage` accepts optional 4th/5th params (lines 268-269). No `pendingAsks`/`workspaceFiles` slot added. Write path callers never supply the params — see WR-04 gap. |
| `frontend/src/hooks/usePanelReconcile.ts` | Shared helper with AbortController + isLoading + composite-error-key | VERIFIED | AbortController created per reconcile (line 121), cleanup returns `() => controller.abort()` (line 129). `isLoading` is local useState (line 53). Error read via composite key `${threadId}:${hookId}` (line 59). No visibilitychange/focus/pageshow listeners. Manual escape hatch reconcile() present (lines 108-112) — untracked controller (WR-03, quality). |
| `frontend/src/providers/StreamsProvider.tsx` | 4 EMPTY constants + 11 action bodies + 7 callback defaults + 4 named hooks | VERIFIED | EMPTY_TODOS/FILES/ASKS/TASKS at lines 101-104. 11 action bodies registered in useEffect #1 (lines 1516-1628). 7 makeStreamCallbacks defaults at lines 662-689. `useTodos`/`useWorkspaceFiles`/`useAskUserPrompt`/`useTasks` at lines 1734-1810. `useStreamsStore` not exported. |
| `frontend/src/providers/__tests__/panelHooks.test.tsx` | 12-test integration backstop | VERIFIED | File exists, covers FC#1/#3/#4/#5/#6/#9 and D-086-13. Plan 02 SUMMARY confirms 12/12 GREEN. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api.ts` SSE dispatch `sub_agent_start` | `onTaskStart` / `onSubAgentStart` | `parsed.sub_run_id != null` discriminator | WIRED | Lines 471-480: TASK variant routes to `onTaskStart?.()`; ELSE arm preserves legacy `callbacks.onSubAgentStart(parsed.filename as string, parsed.task as string)` byte-identical. `sub_agent_delta` untouched at line 481-482. |
| `api.ts` panel branches | `onTodoUpdated`/`onWorkspaceFileWritten`/`onWorkspaceFileDeleted`/`onAskUserPrompt`/`onAskUserResponse` | event type `t === "..."` checks | WIRED | Lines 542-565. Field names: `parsed.todos`, `parsed.path`, `parsed.tool_call_id`. No terminal `return`. All sit above the `done` branch. |
| `makeStreamCallbacks` defaults | `useStreamsStore.getState().actions.*ForThread` | closure over `threadId` | WIRED | Lines 662-689. Each handler calls the correct action. `getState().actions` indirection mirrors existing `setMessagesForBucketBound` pattern. |
| `useTodos` hook selector | `todosByThread.get(threadId) ?? EMPTY_TODOS` | `useStreamsStore` subscription | WIRED | Line 1740-1742. Stable EMPTY_TODOS fallback prevents undefined. |
| `usePanelReconcile` thread-switch effect | `getThreadTodos` -> `replaceTodosForThread` | `useEffect([threadId])` + AbortController | WIRED | Lines 116-130. Cleanup returns abort. |
| `useEffect #4` persistence subscription | `writeSnapshotToLocalStorage` with `todosByThread`/`tasksByThread` | throttled subscribe on `bucketsBySurface` | NOT WIRED | Lines 1694-1695: subscription selector is `(state) => state.bucketsBySurface` only. `writeNow` at 1682-1684 omits the 4th/5th args. Panel Maps never written to localStorage. |
| `streamsStore` factory | `readTodosSyncOrEmpty()` + `readTasksSyncOrEmpty()` (hydration on first paint) | synchronous factory body | WIRED (read side) | Lines 200, 206. Correct. But since the write side never persists the Maps, these helpers always return empty Maps in practice. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `useTodos` hook | `s.todosByThread.get(threadId)` | SSE `todo_updated` -> `replaceTodosForThread`; thread-switch GET `getThreadTodos` -> `replaceTodosForThread` | YES — via SSE (live) and GET (thread-switch) | FLOWING for live SSE + reconcile-on-switch; STATIC (empty) for first-paint localStorage hydration due to WR-04 |
| `useWorkspaceFiles` hook | `s.workspaceFilesByThread.get(threadId)` | SSE `workspace_file_written/deleted`; GET `getThreadWorkspaceFiles` on thread-switch | YES — via SSE and GET | FLOWING |
| `useAskUserPrompt` hook | `s.pendingAsksByThread.get(threadId)` | SSE `ask_user_prompt/response`; GET `getThreadPendingAsks` on thread-switch | YES — via SSE and GET (not persisted per D-086-03 — correct) | FLOWING |
| `useTasks` hook | `s.tasksByThread.get(threadId)` | SSE `sub_agent_start/done` TASK variant; GET `getThreadTasks` on thread-switch | YES — via SSE and GET | FLOWING for live SSE + reconcile-on-switch; STATIC (empty) for first-paint localStorage hydration due to WR-04 |

### Behavioral Spot-Checks

Step 7b: SKIPPED for server startup. The following checks are compile-time / module-level only.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript clean | `npx tsc --noEmit` | EXIT 0 (confirmed by Plan 01 + 02 SUMMARY) | PASS |
| 12 new panel hook tests | `vitest run src/providers/__tests__/panelHooks.test.tsx` | 12/12 pass (confirmed by Plan 02 SUMMARY) | PASS |
| Sub_run_id discriminator present | grep `parsed.sub_run_id != null` in api.ts | Found at lines 472, 484 — exactly 2 bookend branches | PASS |
| Panel branches above terminal `done` | Lines 542-565 in api.ts precede `else if (t === "done")` at line 566 | Confirmed by reading | PASS |
| No `export.*useStreamsStore` in StreamsProvider | grep result | 0 matches (confirmed D-086-02) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PANEL-05 | 086-01, 086-02 | Panel subscribes to the same SSE stream as chat via StreamsProvider Context — single subscription, demultiplexed by event type, no duplicate connections | SATISFIED | 4 named hooks use `useStreamsStore` (singleton). 6 SSE event types demux via existing `subscribeToRun` path + `makeStreamCallbacks` defaults. No new EventSource created. |
| PANEL-06 | 086-01, 086-02 | Panel events route to separate state stores — no chat message list re-renders triggered by panel updates | SATISFIED | All 11 panel action bodies mutate only the 4 dedicated Maps via `new Map(prev)` replace, never touching `bucketsBySurface`. Subscription selector in useEffect #4 further isolates: it only watches `bucketsBySurface` (which paradoxically IS the WR-04 bug for persistence, but IS correct for PANEL-06 isolation). Test FC#1 asserts bucket ref stability. |

### Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `StreamsProvider.tsx` | 1682-1684, 1694-1695 | `writeSnapshotToLocalStorage` called without `todosByThread`/`tasksByThread` params; subscription selector watches only `bucketsBySurface` | Blocker | D-086-03 F5-resilience for todos/tasks is dead — hydration always returns empty Maps. First-paint `readTodosSyncOrEmpty()`/`readTasksSyncOrEmpty()` calls always return empty. |
| `usePanelReconcile.ts` | 108-112 | Manual `reconcile()` creates `AbortController` that is never tracked or aborted on unmount | Warning | Stale-write window on manual reconcile + unmount race; not triggered on the primary thread-switch path. |
| `StreamsProvider.tsx` | 1859-1860 | `useReconcileErrorForThread` reads plain `threadId` key but panel hook errors are written under composite `${threadId}:${hookId}` keys | Warning | `useReconcileErrorForThread` silently useless for panel errors; only chat-load errors are visible via this hook. Phase 087 must not use it for panel error display. |
| `StreamsProvider.tsx` | 678 | `onTaskStart` seeds `parent_run_id: ""`, `model: ""`, `provider: ""` in `TaskRunIndexItem` despite those being declared required `string` fields | Info | SSE-seeded task rows show empty strings until a GET reconcile fires on the next thread-switch. Phase 087 rendering of `parent_run_id` for navigation links may display empty before reconcile. |

### Human Verification Required

#### 1. Cross-Provider SSE Routing

**Test:** Start a task-tool run on each of OpenAI, Anthropic, Google, OpenRouter. Confirm `sub_agent_start` with `sub_run_id` routes to `onTaskStart` (not `onSubAgentStart`), `sub_agent_start` without `sub_run_id` still routes to `onSubAgentStart`, and `todo_updated`/`workspace_file_written`/`ask_user_prompt` events populate the respective panel Maps without causing any MessageList re-render.
**Expected:** Panel Maps update in store; MessageList does not remount or re-render; legacy analyze_document flow unchanged across all 4 providers.
**Why human:** Cross-provider wire-byte differences cannot be unit-mocked. Requires live network and real provider SSE streams.

#### 2. Rapid Thread-Switch Abort Window

**Test:** Start a tool call on Thread A, immediately switch to Thread B while the reconcile fetch is in-flight for Thread A. Confirm Thread A's data is not written under Thread B's key and the AbortController abort fires (check DevTools Network panel for cancelled request).
**Expected:** No cross-thread data bleed; Thread B shows its own panel data; Thread A's reconcile is aborted.
**Why human:** Timing window cannot be reliably reproduced in unit tests.

#### 3. Long-Message Axis (SC#10 Axis 4)

**Test:** Send a prompt with >= 50 prior messages or a >= 5 KB user prompt that triggers `write_todos` and `workspace_write` tools. Verify `todo_updated` and `workspace_file_written` SSE events arrive and update the panel store correctly.
**Expected:** Panel Maps populated; no timeout or stream drop; hooks return updated data on the same thread without a thread switch.
**Why human:** Long-message latency and stream-pressure behavior cannot be reliably unit-tested.

### Gaps Summary

One gap blocks the phase plan's stated must-have about first-paint localStorage hydration (WR-04). The root cause is a write-side omission in two locations:

1. `StreamsProvider.tsx:1682-1684` — `writeSnapshotToLocalStorage` is called without the `todosByThread`/`tasksByThread` optional params.
2. `StreamsProvider.tsx:1694-1695` — the `subscribeWithSelector` subscription is selector-bound to `state.bucketsBySurface` only, so panel Map mutations never trigger the throttled write even if the params were added.

The `readTodosSyncOrEmpty()`/`readTasksSyncOrEmpty()` helpers in the store factory are correctly wired for the read side. The `writeSnapshotToLocalStorage` signature in `streamsCache.ts` is correctly extended to accept the optional params. The gap is purely at the call site in `useEffect #4`.

The gap does NOT affect:
- PANEL-05 (single demuxed stream) — fully satisfied
- PANEL-06 (panel events never re-render chat) — fully satisfied  
- The four named hooks returning reactive data from live SSE + thread-switch GET reconcile
- TypeScript cleanliness and test coverage

The core goal ("streaming infrastructure routes SSE events to dedicated panel stores; per-thread hooks provide reactive data") is achieved for the runtime data path. The F5-resilience for todos/tasks (first-paint hydration) is the unmet portion.

---

_Verified: 2026-05-29T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
