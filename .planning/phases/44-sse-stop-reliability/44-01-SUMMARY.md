---
phase: 44-sse-stop-reliability
plan: 01
subsystem: backend, frontend
tags: [sse, streaming, stop, reliability, ux]
key-files:
  created:
    - backend/app/responses.py
  modified:
    - backend/app/api/threads.py
    - backend/app/main.py
    - frontend/src/hooks/useMessages.ts
    - frontend/src/types/index.ts
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/ToolCallPanel.tsx
    - frontend/src/components/chat/ChatArea.tsx
metrics:
  files_created: 1
  files_modified: 7
  requirements_covered: [STREAM-01, STREAM-02, STREAM-03, STREAM-04]
---

## Plan 44-01: SSE & Stop Reliability

### What was built

Fixed three SSE streaming reliability issues plus one navigation bug:

1. **STREAM-01 — "Saving response..." replaced with "Response stopped"**: When the user clicks Stop during streaming, the UI now shows "Response stopped" with a stop icon instead of "Saving response...". Running tool calls are marked as "interrupted" (amber indicator) rather than left in "running" state forever.

2. **STREAM-02 — Socket error suppression on client disconnect**: Created `SSEStreamingResponse` class in `backend/app/responses.py` that wraps the SSE iterator with `_SilentSSEIterator` to catch `GeneratorExit`, `OSError` (covers `ConnectionResetError`, `BrokenPipeError`, `ConnectionAbortedError` on Windows), and ASGI `AssertionError`/`RuntimeError` (send/close/write patterns). Uses a `stop_event` mechanism so the iterator stops producing chunks immediately when the client disconnects, preventing wasted LLM API calls. All errors are logged at info/debug level instead of propagating as noisy exceptions.

3. **STREAM-03 — Partial message reconciliation**: The `finally` block in `useMessages.ts` schedules a `loadMessages()` reload after stream completion to reconcile the optimistic temp-ID message with the DB-persisted version. On skip for navigation aborts (different thread), the new thread's `loadMessages` replaces it. On the backend, `_persist_assistant_message()` filters out tool calls still in "running" status, only persisting "done" tool calls.

4. **STREAM-04 — Thread navigation during active streaming**: `streamingThreadIdRef` tracks which thread is streaming so `loadMessages` allows updates for a different thread even mid-stream. `abortStream()` provides a quiet abort (no "stopped" label) separate from `stopStreaming()` (explicit user stop). `ChatArea` calls `abortStream()` on thread switch, and skips the stale-thread DB reload so the new thread loads immediately.

### Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d15ec36 | feat(44-01): SSE & Stop Reliability — STREAM-01/02/03 |
| 2 | 4203b7c | fix(44-01): allow thread navigation during active streaming |
| 3 | d243f80 | fix(44-01): robust SSE disconnect handling — OSError + RuntimeError, no socket errors on Windows |
| 4 | 0990166 | docs(44): update STATE and ROADMAP — Phase 44 complete |

### Deviations

None.

### Self-Check: PASSED

- [x] STREAM-01: Clicking Stop shows "Response stopped" — not "Saving response..."
- [x] STREAM-02: No `socket.send()` errors in server logs on disconnect (OSError/RuntimeError caught)
- [x] STREAM-03: Partial responses reconcile with DB after stream ends
- [x] STREAM-04: Clicking a different chat during streaming navigates immediately, no nav freeze
- [x] Running tool calls marked "interrupted" on stop
- [x] Thread switch aborts stream quietly (no "stopped" label on old thread)
- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- [x] Backend imports succeed without errors