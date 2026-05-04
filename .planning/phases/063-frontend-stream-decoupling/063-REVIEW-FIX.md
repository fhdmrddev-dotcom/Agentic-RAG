---
phase: 063-frontend-stream-decoupling
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/063-frontend-stream-decoupling/063-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 15
skipped: 0
status: all_fixed
---

# Phase 063: Code Review Fix Report

**Fixed at:** 2026-05-03
**Source review:** `.planning/phases/063-frontend-stream-decoupling/063-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 15 (6 blockers + 9 warnings; Info findings out of scope)
- Fixed: 15
- Skipped: 0

## Fixed Issues

### BL-01: POST handler does blocking `.execute()` calls inside async route

**Files modified:** `backend/app/api/threads.py`
**Commit:** `03a6702`
**Applied fix:** Wrapped four sync `.execute()` call sites with `await aexec(...)` so the event loop is no longer blocked on Supabase round-trips: `create_thread` (insert), `rename_thread` (update + select), `delete_thread` (sandbox-files cleanup SELECTs + thread DELETE), and `get_messages` (ownership SELECT + messages SELECT). The `supabase.storage.remove(...)` call inside `delete_thread` is also now wrapped with `run_in_threadpool` for consistency. Restores Phase 058 D-058-09 cross-tab GET unblocking invariant.

### BL-02: `send_message` user-message INSERT will return `None` in production

**Files modified:** `backend/app/api/threads.py`
**Commit:** `ca61704`
**Applied fix:** Replaced the structurally-invalid `.insert(...).select("id").single()` chain with the standard supabase-py insert pattern used elsewhere in the module (line ~970 for the assistant INSERT): plain `.insert(row)`, then read the id from `response.data[0]["id"]`. PostgREST returns the inserted row(s) under `.data` as a list by default (Prefer: return=representation). Defensive list/dict branch retained for test mocks that hand back a single dict.

### BL-03: `subscriptionsRef` controller mismatch leaks subscriptions

**Files modified:** `frontend/src/hooks/useMessages.ts`
**Commit:** `571331d`
**Applied fix:** Moved subscription cleanup into the `onTerminal` callback (the canonical "producer is actually done" signal) for both `sendMessage` and `reconcile` paths, instead of the `finally` / `.finally(...)` blocks that ran before the SSE consumer state was fully drained in some races. Kept a `has` + delete safety net in the catch/finally paths to handle thrown-error and AbortError cases where `onTerminal` doesn't fire. Eliminates the duplicate-consumer race when `reconcile` fires during a still-streaming run.

### BL-04: `test_fixtures.inject_failed_run` accepts arbitrary string as `thread_id`

**Files modified:** `backend/app/api/test_fixtures.py`, `backend/app/main.py`
**Commit:** `92a9262`
**Applied fix:** (1) Annotated the path param as `UUID` so FastAPI returns 422 (rather than a generic 500 from PostgREST) on non-UUID input. Convert to `str` at the PostgREST boundary so existing eq/INSERT payloads work unchanged. (2) Added a hard refusal-to-start in `main.py` when `ENABLE_TEST_FIXTURES=1` AND `ENVIRONMENT` is `production`/`prod`, so accidental misconfiguration crashes loudly rather than silently exposing the route.

### BL-05: `MessageList.tsx` smooth-scroll fires on every token delta

**Files modified:** `frontend/src/components/chat/MessageList.tsx`
**Commit:** `4ce4a7e`
**Applied fix:** (1) Switched the scroll-listener attachment from `useEffect` to `useLayoutEffect` plus a `requestAnimationFrame` retry loop until the Radix ScrollArea viewport mounts — the previous code's `closest()` lookup returned null on first render and `isNearBottomRef` stayed at its initial `true` forever, so the auto-follow ignored user scroll-up. (2) Gated the new-message scroll branch on `isNearBottomRef.current` and switched to `behavior: "instant"` while streaming to eliminate the smooth → snap → smooth jitter on reconcile + send.

### BL-06: `resumeFromFailed` reads stale `messages` and double-click silent no-op

**Files modified:** `frontend/src/hooks/useMessages.ts`
**Commit:** `4107b88`
**Applied fix:** Walk backward from the failed assistant message to find the most recent user message (instead of indexing `messages[idx - 1]` which broke if any tool/system row was interleaved), with a console.warn when no preceding user message exists. Added `resumeInFlightRef` so a rapid double-click no-ops the second click visibly via the ref rather than silently hitting `sendMessage`'s `isSendingRef` gate.

### WR-01: Dead imports in `threads.py`

**Files modified:** `backend/app/api/threads.py`
**Commit:** `e3102b8`
**Applied fix:** Removed unused `from typing import AsyncGenerator` and `from sse_starlette import EventSourceResponse` imports left behind after the legacy SSE-on-POST path deletion (D-063-01). No runtime impact.

### WR-02: SSE parser silently swallows malformed lines

**Files modified:** `frontend/src/lib/api.ts`
**Commit:** `2cd75a7`
**Applied fix:** Switched the parse-error catch from `catch { /* ignore */ }` to `catch (parseErr) { console.warn("subscribeToRun: malformed SSE line", { raw, parseErr }) }` so a backend wire-format regression is visible in the console.

### WR-03: `cancelRun` cannot be aborted; `stopStreaming` recreated every token

**Files modified:** `frontend/src/lib/api.ts`, `frontend/src/hooks/useMessages.ts`
**Commit:** `67105b7`
**Applied fix:** (1) Added optional `signal?: AbortSignal` parameter to `cancelRun` to match every other API helper. (2) Refactored `stopStreaming` to read latest messages from a `messagesRef` (synced via a separate effect) and dropped `messages` from its `useCallback` dep array, making it a stable callback that doesn't churn on every token delta.

### WR-04: `message_id` from POST response was dropped

**Files modified:** `frontend/src/hooks/useMessages.ts`
**Commit:** `6d671b5`
**Applied fix:** Use `message_id` from the POST response to swap the optimistic user placeholder's temp id for the persisted UUID immediately. Without this, a Realtime upsert arriving before the next `loadMessages` refetch could side-by-side a duplicate persisted user message with the temp placeholder.

### WR-05: `reconcile` cross-thread guard fires too late for live updates

**Files modified:** `frontend/src/hooks/useMessages.ts`
**Commit:** `5a668cf`
**Applied fix:** Wrapped the reconcile callbacks' `setMessages` with a `guardedSetMessages` that no-ops when `activeThreadIdRef.current !== threadId`, gating live updates on the user still viewing this thread (Phase 060 D-060-01 invariant). The placeholder INSERT and terminal `runStatus` flip remain unconditional so the correct end state is visible when the user navigates back. Reconcile re-attaches on focus so live updates resume automatically.

### WR-06: `reconcile` race window opens duplicate consumer in StrictMode

**Files modified:** `frontend/src/hooks/useMessages.ts`
**Commit:** `9057607`
**Applied fix:** Reordered the reconcile loop body so `subscriptionsRef.current.set(run.run_id, controller)` runs BEFORE the placeholder insert and BEFORE firing `subscribeToRun`. Subsequent reconcile ticks now short-circuit deterministically on the `subscriptionsRef.has(run.run_id)` check, eliminating the StrictMode-double-invoke duplicate consumer.

### WR-07: ChatArea effect re-attach storm on `reconcile` recreation

**Files modified:** `frontend/src/components/chat/ChatArea.tsx`
**Commit:** `5f9c3b3`
**Applied fix:** Routed `reconcile` through a `reconcileRef` updated in a separate effect so the visibility/focus/pageshow listener-bind effect can depend on `thread?.id` alone and remain stable across any future `reconcile` recreations.

### WR-08: JSX indentation in MessageItem reads as parser/linter trap

**Files modified:** `frontend/src/components/chat/MessageItem.tsx`
**Commit:** `1411935`
**Applied fix:** Re-indented the ternary inside the italic `<span>` block to standard 14-space alignment and corrected the closing `) : null}` to align with its parent `?` so prettier won't rewrite this on next save and produce a noisy diff in an unrelated PR.

### WR-09: Tests don't assert run_id leakage in cross-user 404 responses

**Files modified:** `backend/tests/integration/test_063_cross_user_no_runid_leak.py` (new file)
**Commit:** `a0aaf06`
**Applied fix:** Added two focused tests covering both surfaces touched by Phase 063's POST → run_id → GET stream / DELETE flow. Each asserts both the 404 status code AND that the response body does NOT contain the queried run_id. The existing `test_062_cross_user_404.py` only asserted the status code and the route's `HTTPException` detail string ("Run not found"); a future regression that echoed the run_id into the 404 detail would silently defeat T-062-01's information-disclosure guard while still passing the existing tests. The reviewer's broader request for full RLS-aware tests against a real Supabase instance is tracked as a SEED for the next milestone (no real-Supabase test infra exists in this phase's harness).

---

_Fixed: 2026-05-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
