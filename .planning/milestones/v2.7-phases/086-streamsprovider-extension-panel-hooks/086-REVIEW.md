---
phase: 086-streamsprovider-extension-panel-hooks
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - frontend/src/types/index.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/streamsCache.ts
  - frontend/src/stores/streamsStore.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/hooks/usePanelReconcile.ts
  - frontend/src/__tests__/lib/streamsCache.test.ts
  - frontend/src/providers/__tests__/panelHooks.test.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 086: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 086 adds a data-plumbing layer between the existing SSE vocabulary and four new per-thread Zustand Maps (`todosByThread`, `workspaceFilesByThread`, `pendingAsksByThread`, `tasksByThread`) and exposes four named consumer hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`, `useTasks`). The new code is generally well-structured: panel SSE events are correctly isolated from `bucketsBySurface` (PANEL-06 invariant holds), Map immutability discipline is consistent, the `sub_agent_start` TASK/legacy discriminator is safe, and the `usePanelReconcile` helper correctly aborts in-flight fetches on thread switch.

Four warnings were found. None break cross-provider safety or corrupt existing state, but two could cause silent data loss or stuck UI states under specific timing windows. Three info items round out the report.

## Warnings

### WR-01: `onTaskStart` seeds `parent_run_id: ""` — a GET reconcile may never arrive, leaving stale empty string in the store

**File:** `frontend/src/providers/StreamsProvider.tsx:676-685`

**Issue:** When `sub_agent_start` (TASK variant) fires, `onTaskStart` creates a `TaskRunIndexItem` row with `parent_run_id: ""` because the SSE payload does not carry that field. The comment says "reconcile overwrites with the canonical row." However, the reconcile is triggered only by `usePanelReconcile`'s thread-switch `useEffect` — it fires once per thread switch, not after every SSE event. If the agent finishes before the user next switches threads (e.g., user stays on the same thread for the entire task), the `parent_run_id` stays `""` for the lifetime of the session. Phase 087 panels may display this field for provenance linking (linking a sub-task back to its parent run for navigation). An empty string will silently break that linking.

Additionally, `model: ""` and `provider: ""` have the same gap — they are present in `TaskRunIndexItem` (required fields per the type) but not available on the SSE bookend, so every `setTaskForThread` call from SSE seeds required string fields with empty strings.

**Fix:** Either (a) mark `parent_run_id`, `model`, and `provider` as optional in `TaskRunIndexItem` so the type accurately reflects that SSE-seeded rows are partial, or (b) trigger a task reconcile immediately after `onTaskStart`/`onTaskDone` fires (via the returned `reconcile()` escape hatch or a targeted GET). Option (a) is safer for Phase 086 scope since it only changes the type contract and makes the partiality visible to Phase 087 consumers:

```typescript
// types/index.ts — make SSE-partial fields optional
export interface TaskRunIndexItem {
  sub_run_id: string
  parent_run_id?: string   // absent on SSE bookend; present on GET reconcile
  status: string
  model?: string           // absent on SSE bookend
  provider?: string        // absent on SSE bookend
  // ...rest unchanged
}
```

---

### WR-02: `useReconcileErrorForThread` reads `reconcileErrors.get(threadId)` — but `loadMessages` writes plain `threadId` keys while `usePanelReconcile` writes composite `${threadId}:${hookId}` keys. The named hook is silently useless for panel errors.

**File:** `frontend/src/providers/StreamsProvider.tsx:1859-1860`

**Issue:** `useReconcileErrorForThread(threadId)` does `reconcileErrors.get(threadId)` — this only matches errors written by `loadMessages` (which keys by plain `threadId`). Panel hook errors written by `usePanelReconcile` are keyed `${threadId}:todos`, `${threadId}:files`, etc. If Phase 087 or any future consumer uses `useReconcileErrorForThread` to check whether a panel has an error, it will always return `null` even when the panel's reconcile has failed. This is a silent mismatch between the named hook's apparent semantics and the composite-key scheme introduced in D-086-13.

The existing `loadMessages` path writing plain `threadId` keys is correct for chat-load errors. The issue is that the named hook does not document this scope limitation, and callers will naturally assume it covers all reconcile errors for a thread.

**Fix:** Either restrict the hook's name/docs to make the scope explicit, or add a panel-specific exported hook that accepts the composite key:

```typescript
// Option A: rename + document
/** Returns the chat-load reconcile error for a thread (keyed by plain threadId).
 *  Panel hook errors use composite keys — read via usePanelReconcile's returned error. */
export const useChatLoadErrorForThread = (threadId: string | null): Error | null =>
  useStreamsStore((s) => (threadId ? (s.reconcileErrors.get(threadId) ?? null) : null))

// Option B: add panel key variant alongside (non-breaking)
export const usePanelErrorForThread = (
  threadId: string | null,
  hookId: string,
): Error | null =>
  useStreamsStore((s) =>
    threadId ? (s.reconcileErrors.get(`${threadId}:${hookId}`) ?? null) : null,
  )
```

---

### WR-03: `usePanelReconcile`'s manual `reconcile()` escape hatch creates an `AbortController` that is never aborted — leaked controller on unmount

**File:** `frontend/src/hooks/usePanelReconcile.ts:108-112`

**Issue:** The manual `reconcile()` callback (returned from the hook for consumers to call imperatively) creates a fresh `AbortController` inline but that controller is never stored or aborted. If the component unmounts while the manual fetch is in-flight (e.g., user clicks "Refresh" then immediately switches tabs), the `runReconcile` call will proceed past the `signal.aborted` guard, call `replace(tid, data)`, and write stale data into the store for a thread that may no longer be the active context. The thread-switch `useEffect`'s cleanup only aborts the `controller` created *inside that effect* — it has no handle on the manually-created controller.

Compare with `loadMessages` in `StreamsProvider.tsx:1406-1407` which tracks `loadAbortRef.current` and calls `.abort()` before each new fetch precisely to avoid this window.

```typescript
// usePanelReconcile.ts:108-112 (current)
const reconcile = useCallback(async (): Promise<void> => {
  if (!threadId) return
  const controller = new AbortController()
  await runReconcile(threadId, controller.signal)
}, [threadId, runReconcile])
```

**Fix:** Track the manual controller in a ref so the effect cleanup (or a new manual call) can abort the prior one:

```typescript
const manualControllerRef = useRef<AbortController | null>(null)

const reconcile = useCallback(async (): Promise<void> => {
  if (!threadId) return
  manualControllerRef.current?.abort()
  const controller = new AbortController()
  manualControllerRef.current = controller
  await runReconcile(threadId, controller.signal)
}, [threadId, runReconcile])

// In the effect cleanup:
return () => {
  controller.abort()
  manualControllerRef.current?.abort()
}
```

---

### WR-04: `writeSnapshotToLocalStorage` now accepts optional `todosByThread`/`tasksByThread` but the throttled writer in `StreamsProvider` useEffect #4 never passes them — todos and tasks are never actually persisted on bucket-change

**File:** `frontend/src/providers/StreamsProvider.tsx:1675-1704`

**Issue:** `streamsCache.ts` was extended (D-086-03) to serialize `todosByThread` and `tasksByThread` alongside the chat buckets. However, `useEffect #4` in `StreamsProvider` (the throttled writer) only passes `state.bucketsBySurface` to `writeSnapshotToLocalStorage` and omits the two new optional params:

```typescript
// StreamsProvider.tsx:1682-1684 (current)
writeSnapshotToLocalStorage(state.bucketsBySurface, Date.now(), (_surface, tid) =>
  tid === streamingTid || tid === activeTid,
)
// todosByThread and tasksByThread are never passed
```

The store factory correctly hydrates `todosByThread`/`tasksByThread` from `readTodosSyncOrEmpty()`/`readTasksSyncOrEmpty()` on first paint, but those Maps are always empty at startup because nothing ever writes them into the snapshot. This means the D-086-03 persistence for todos and tasks is wired up at the read end but the write end was omitted. F5-resilience for todos and tasks (which the plan explicitly targets) does not work in practice.

Additionally, the subscription in `useEffect #4` is selector-bound to `state.bucketsBySurface`, so todo/task Map mutations (which update `state.todosByThread`, not `bucketsBySurface`) don't trigger the throttled write at all, even if the params were added.

**Fix:** Pass the panel Maps to the write call, and add a second subscription (or widen the selector) to also trigger on panel Map changes:

```typescript
// In useEffect #4, widen selector and pass panel Maps:
const unsubscribe = useStreamsStore.subscribe(
  (state) => [state.bucketsBySurface, state.todosByThread, state.tasksByThread] as const,
  () => {
    throttledWrite(useStreamsStore.getState())
  },
)

// And in writeNow:
const writeNow = (state: StreamsState) => {
  const streamingTid = streamingThreadIdRef.current
  const activeTid = activeThreadIdRef.current
  if (!streamingTid && !activeTid) return
  writeSnapshotToLocalStorage(
    state.bucketsBySurface,
    Date.now(),
    (_surface, tid) => tid === streamingTid || tid === activeTid,
    state.todosByThread,
    state.tasksByThread,
  )
}
```

Note: the `subscribeWithSelector` selector returning an array will cause the equality check to fire on every render (array identity changes). A tuple-compare approach or separate subscriptions would be more precise, but either is more correct than the current state of never persisting.

## Info

### IN-01: `onTaskStart` with `description` cast — missing null-guard for `parsed.description` when field is absent on wire

**File:** `frontend/src/lib/api.ts:473-478`

**Issue:** The `sub_agent_start` TASK branch casts `parsed.description as string`. If the backend emits the event without a `description` field (e.g., a future backend version or a cross-provider routing path that simplifies the payload), the cast will silently produce `undefined`, which then populates `task.description` as `undefined` despite the TypeScript signature accepting `string`. This is a minor type-safety gap — it doesn't crash but silently violates the contract.

**Fix:** Use a nullish fallback:
```typescript
callbacks.onTaskStart?.(
  parsed.sub_run_id as string,
  (parsed.description as string) ?? "",
  (parsed.tools as string[]) ?? [],
  (parsed.max_steps as number) ?? 0,
)
```

---

### IN-02: Dead `void threadId` in `_reattachAfterTransient` and `void toolIndex` in `onCodeExecuting` — leftover suppression artifacts

**File:** `frontend/src/providers/StreamsProvider.tsx:218`, `534`

**Issue:** Both `void threadId` (line 218 in `_reattachAfterTransient`) and `void toolIndex` (line 534 in `onCodeExecuting`) are lint-suppression artifacts for unused parameters. `void threadId` in particular has an accompanying comment "retained for context/logging parity with the caller" — but there is no logging; the comment describes intent that was never implemented. These are harmless but misleading.

**Fix:** Either use the parameter in a debug log (e.g., `console.debug("[reattach]", threadId, runId)`) or remove the parameter from the function signature and update the two call sites. For `toolIndex` in `onCodeExecuting`, the code matches by `tc.name === "execute_code"` rather than by index, so the index is genuinely unused; consider removing it from the callback signature in a future cleanup phase.

---

### IN-03: `readSnapshotParsedOrNull` is called twice per `readTodosSyncOrEmpty` + `readTasksSyncOrEmpty` on cold start — redundant localStorage parse

**File:** `frontend/src/lib/streamsCache.ts:212-243`

**Issue:** `readTodosSyncOrEmpty()` and `readTasksSyncOrEmpty()` each call `readSnapshotParsedOrNull()` independently, which parses the full localStorage JSON blob twice in the Zustand store factory. `readSnapshotSyncOrEmpty()` (for `bucketsBySurface`) also parses the same key as a third parse. This is a cold-start inefficiency: three JSON.parse calls on the same key before the first render. With a typical 5-10 KB snapshot, this is not a performance concern (parse takes < 1 ms), but the triple parse is architecturally inconsistent with the "one packed write" design principle stated in the file header.

**Fix:** Expose a single `readFullSnapshotSync()` function that returns all three Maps at once, called once from the store factory:

```typescript
// streamsCache.ts
export function readFullSnapshotSync(): {
  buckets: Map<SurfaceId, Map<string, Message[]>>
  todos: Map<string, Todo[]>
  tasks: Map<string, TaskRunIndexItem[]>
} {
  const parsed = readSnapshotParsedOrNull()
  if (!parsed) return { buckets: new Map(), todos: new Map(), tasks: new Map() }
  // ... single pass over parsed
}
```

This is a non-blocking quality improvement; it does not affect correctness.

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
