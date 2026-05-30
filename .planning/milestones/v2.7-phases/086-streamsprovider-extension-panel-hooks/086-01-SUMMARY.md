---
phase: 086-streamsprovider-extension-panel-hooks
plan: 01
subsystem: frontend-streaming
tags: [streamsprovider, sse-dispatch, zustand-store, localStorage-cache, agent-panel, wire-types]
requires:
  - "Phases 084/085 backend panel endpoints + SSE events (todo_updated, workspace_file_written/deleted, ask_user_prompt/response, sub_agent_start/done TASK variant)"
provides:
  - "Todo / WorkspaceFile / PendingAsk / TaskRunIndexItem wire-mirror types (frontend/src/types/index.ts)"
  - "4 per-thread Zustand Maps + 11 additive panel actions (frontend/src/stores/streamsStore.ts)"
  - "7 StreamCallbacks + 6 SSE dispatch branches (payload-shape sub_agent_* split) + 4 GET helpers (frontend/src/lib/api.ts)"
  - "todosByThread + tasksByThread localStorage persistence, cache version 2 (frontend/src/lib/streamsCache.ts)"
affects:
  - "Plan 086-02 (consumer hooks build on these 11 actions + 4 GET helpers)"
  - "Phase 087 (panel rendering consumes these 4 Maps)"
tech-stack:
  added: []
  patterns:
    - "Payload-shape SSE discriminator: parsed.sub_run_id != null splits TASK-variant sub_agent_* from byte-identical legacy analyze_document path (D-086-06)"
    - "Synchronous no-op action stubs (Pitfall 5) for actions that can fire pre-mount"
    - "Synchronous localStorage hydration inside Zustand factory (Pitfall 1/8) for first-paint cache content"
    - "Optional trailing params on writeSnapshotToLocalStorage keep legacy chat-only callers unbroken (additive cache extension)"
key-files:
  created: []
  modified:
    - "frontend/src/types/index.ts (4 wire-mirror interfaces)"
    - "frontend/src/stores/streamsStore.ts (4 Maps + 11 action sigs/stubs + cache-wired defaults)"
    - "frontend/src/lib/api.ts (7 callbacks + 6 dispatch branches + 4 GET helpers)"
    - "frontend/src/lib/streamsCache.ts (version 1->2, 2 persisted slots, 2 read helpers, write extension)"
    - "frontend/src/__tests__/lib/streamsCache.test.ts (version sanity-check 1->2)"
decisions:
  - "D-086-03: only todos+tasks persisted (pendingAsks ephemeral, workspaceFiles large-blob)"
  - "D-086-04: single minor cache version bump 1->2 (invalidates all v1 keys incl. chat buckets — one-time cold reload accepted)"
  - "D-086-06: parsed.sub_run_id != null is the sole discriminator; legacy analyze_document call expressions preserved byte-identical"
  - "D-086-18: strictly additive — no existing symbol altered"
metrics:
  duration: "~25 min"
  completed: "2026-05-28"
  tasks: 3
  files: 5
  commits: 3
---

# Phase 086 Plan 01: StreamsProvider Extension — Panel Data Plumbing Summary

Extended the frontend data-plumbing layer (types, store Maps, SSE dispatch, GET helpers, localStorage cache) so the 6 new agent-panel SSE event types from Phases 084/085 demultiplex into 4 dedicated per-thread Zustand Maps, with zero UI rendering (deferred to Phase 087). PANEL-05 (single demuxed stream) and PANEL-06 (panel events route to separate stores, never re-render chat) are achieved structurally at the dispatch + store layer.

## What Shipped

**Task 1 — 4 wire-mirror types + 4 store Maps + 11 action stubs** (commit `1878428`)
- `frontend/src/types/index.ts`: `Todo` (keyed by `id`), `WorkspaceFile` (keyed by `path`, `id` optional since SSE has none), `PendingAsk` (keyed by `tool_call_id`, NOT `ask_id`), `TaskRunIndexItem` (keyed by `sub_run_id`). Snake_case field names mirror backend JSON byte-for-byte (no client reshape — backend reshapes todo_id->id at panel.py:67).
- `frontend/src/stores/streamsStore.ts`: 4 new `Map<string, T[]>` fields, 11 additive action signatures (precise arg shapes: `removePendingAskForThread(threadId, toolCallId)`, `removeWorkspaceFileForThread(threadId, path)`, `updateTaskStatusForThread(threadId, subRunId, status, summary)`), and 11 synchronous `() => {}` stubs (Pitfall 5 — can fire pre-mount, so NOT `notMounted`).

**Task 2 — 7 callbacks + 6 SSE dispatch branches + 4 GET helpers** (commit `0d74f9a`)
- `frontend/src/lib/api.ts`: 7 optional StreamCallbacks. The `sub_agent_start`/`sub_agent_done` branches became payload-shape blocks — `parsed.sub_run_id != null` routes the TASK variant to `onTaskStart`/`onTaskDone`; the ELSE arm preserves the legacy analyze_document call expressions byte-identical (`callbacks.onSubAgentStart(parsed.filename as string, parsed.task as string)` / `callbacks.onSubAgentDone()`). `sub_agent_delta` untouched. 4 plain branches (`todo_updated`, `workspace_file_written`, `workspace_file_deleted`, `ask_user_prompt`, `ask_user_response`) sit above the terminal `done` with NO `return` (cursor-advance safety) and read FLAT fields (`parsed.todos` / `parsed.path` / `parsed.tool_call_id`). 4 GET helpers mirror `getActiveRuns` (getAuthHeaders + optional AbortSignal + non-OK throw, no new fetch library).

**Task 3 — localStorage persistence + cache version bump** (commit `dd40193`)
- `frontend/src/lib/streamsCache.ts`: `STREAMS_CACHE_VERSION` 1->2; `SerializedSnapshot` gains optional `todosByThread` + `tasksByThread` slots (NO pendingAsks/workspaceFiles per D-086-03); `readTodosSyncOrEmpty()` + `readTasksSyncOrEmpty()` helpers using the same user-scoped key + version-guard + Object->Map discipline; `writeSnapshotToLocalStorage` gains 2 optional trailing Map params serialized as Object records (legacy chat-only callers unchanged). `streamsStore` factory now hydrates todos+tasks synchronously on first paint; pendingAsks+workspaceFiles start empty.

## Verification

- `npx tsc --noEmit` (full project): clean, EXIT 0 — no new type errors after all 3 tasks.
- `git diff` confirms legacy analyze_document call expressions preserved verbatim; `sub_agent_delta` untouched.
- grep `parsed.sub_run_id != null`: exactly the two bookend branches (lines 472, 484 of api.ts).
- grep confirms streamsCache persists only `todosByThread` + `tasksByThread` (the `pendingAsks`/`workspaceFiles` mentions are comments only — no serialized slots).
- `STREAMS_CACHE_VERSION === 2`.
- streamsCache test suite: 10/10 pass (version-drift recovery behavior unchanged).
- No file deletions introduced by any task commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated streamsCache.test.ts version sanity-check 1 -> 2**
- **Found during:** Task 3 (running the existing cache test suite post-version-bump)
- **Issue:** `src/__tests__/lib/streamsCache.test.ts:173` hard-asserts `expect(STREAMS_CACHE_VERSION).toBe(1)` as a sanity-check. The deliberate D-086-04 bump to 2 made this assertion fail (1 of 10 tests). The actual version-drift RECOVERY behavior the test exercises (a non-current version drops the key) was unchanged and still passed.
- **Fix:** Updated the sanity-check to `toBe(2)` with a comment referencing D-086-04. This is an in-scope consequence directly caused by the planned version bump, not a separate defect.
- **Files modified:** `frontend/src/__tests__/lib/streamsCache.test.ts`
- **Commit:** `dd40193`

## Threat Model Compliance

- **T-086-01 (Info Disclosure — cache hydration):** mitigated. `readTodosSyncOrEmpty`/`readTasksSyncOrEmpty` reuse `streamsCacheKey(userId)` (user-scoped) and the `parsed.version !== STREAMS_CACHE_VERSION` guard; the 1->2 bump additionally drops all v1 keys on first read. Both lines verified present.
- **T-086-02 (Tampering — SSE parsing):** accept. No new privilege boundary; same-origin authenticated EventSource; type casts are display-only (rendering is Phase 087). No new network/auth surface introduced.
- **T-086-03 (Spoofing/Routing — sub_agent_* misrouting):** mitigated. `parsed.sub_run_id != null` is the sole discriminator; legacy 2-arg/no-arg call expressions kept byte-identical (verified by grep).

No new high-severity findings; zero new endpoints, zero new auth surface, zero PII persistence beyond the already-RLS-protected user-scoped cache.

## Self-Check: PASSED

- frontend/src/types/index.ts — FOUND (4 interfaces added)
- frontend/src/stores/streamsStore.ts — FOUND (4 Maps, 11 actions, cache-wired defaults)
- frontend/src/lib/api.ts — FOUND (7 callbacks, 6 branches, 4 GET helpers)
- frontend/src/lib/streamsCache.ts — FOUND (version 2, 2 slots, 2 readers)
- Commit 1878428 — FOUND
- Commit 0d74f9a — FOUND
- Commit dd40193 — FOUND
