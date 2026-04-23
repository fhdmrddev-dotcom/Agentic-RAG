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
metrics:
  files_created: 1
  files_modified: 6
  requirements_covered: [STREAM-01, STREAM-02, STREAM-03]
---

## Plan 44-01: SSE & Stop Reliability

### What was built

Fixed three SSE streaming reliability issues:

1. **STREAM-01 — "Saving response..." replaced with "Response stopped"**: When the user clicks Stop during streaming, the UI now shows "Response stopped" with a stop icon instead of "Saving response...". Running tool calls are marked as "interrupted" (amber indicator) rather than left in "running" state forever.

2. **STREAM-02 — Socket error suppression on client disconnect**: Created `SSEStreamingResponse` class in `backend/app/responses.py` that wraps the SSE iterator with `_SilentSSEIterator` to catch `GeneratorExit`, `ConnectionResetError`, `BrokenPipeError`, and ASGI `AssertionError` (send/close/write patterns). Uses a `stop_event` mechanism so the iterator stops producing chunks immediately when the client disconnects, preventing wasted LLM API calls. All errors are logged at info/debug level instead of propagating as noisy exceptions.

3. **STREAM-03 — Partial message reconciliation**: The `finally` block in `useMessages.ts` now always schedules a `loadMessages()` reload (800ms delay) after stream completion, not just when content is empty. This reconciles the optimistic temp-ID message with the DB-persisted version. On the backend, `_persist_assistant_message()` filters out tool calls still in "running" status, only persisting "done" tool calls.

### Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | feat(44-01): SSE error suppression — SSEStreamingResponse with stop_event | Backend socket error handling via custom response class |
| 2 | feat(44-01): Stop indicator UX — "Response stopped" instead of "Saving response..." | Frontend stopped state, interrupted tool calls, always-reload logic |
| 4 | feat(44-01): Filter running tool calls in persist — only save "done" status | Backend partial save filters incomplete tool calls |

### Deviations

None.

### Self-Check: PASSED

- [x] STREAM-01: Clicking Stop shows "Response stopped" — not "Saving response..."
- [x] STREAM-02: No `socket.send()` errors in server logs on disconnect
- [x] STREAM-03: Partial responses reconcile with DB after stream ends
- [x] Running tool calls marked "interrupted" on stop
- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- [x] Backend imports succeed without errors