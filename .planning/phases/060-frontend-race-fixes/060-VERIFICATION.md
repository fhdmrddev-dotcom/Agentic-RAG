---
phase: 060-frontend-race-fixes
status: pending
score: 0/4 must-haves verified
binding_test: e2e/tests/060-thread-race.spec.ts
manual_runbook: included as appendix (non-gating per D-060-13)
gaps: []
human_verification: []
---

# Phase 060: Frontend Race Fixes Verification Report

**Phase Goal:** Switching from a streaming Thread A to Thread B always renders Thread B's correct messages, with no cross-thread data leak and no raw tool-result JSON regression.
**Verified:** _PENDING_ (run after Plans 060-01, 060-02, 060-03 land)
**Status:** _PENDING_
**Binding evidence:** `e2e/tests/060-thread-race.spec.ts` (D-060-12) — automated Playwright test exercises Thread A -> Thread B navigation race against the live dev backend.
**Backstop:** Manual two-tab DevTools checklist below (D-060-13) — non-gating; preserved for ops/UAT smoke tests.

---

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Phase 060 Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `activeThreadIdRef` is written by exactly one function — a new `setViewingThread(threadId)` callback called from ChatArea's `useEffect([thread?.id])` BEFORE `abortStream`/`clearMessages`/`loadMessages`. `loadMessages` only reads the ref post-await. | _PENDING_ | Plan 060-01 Task 2 added `setViewingThread`; Plan 060-02 Task 3 wired it as the first statement of the useEffect. Confirm via `grep -c "const setViewingThread = useCallback" frontend/src/hooks/useMessages.ts` = 1 AND `grep -c "setViewingThread(thread?.id ?? null)" frontend/src/components/chat/ChatArea.tsx` = 1 (must precede `abortStream()` in the same effect body). The single remaining `activeThreadIdRef.current = threadId` write is inside `setViewingThread` — confirm via `grep -c "activeThreadIdRef.current = threadId" frontend/src/hooks/useMessages.ts` = 1. |
| 2 | `loadMessages` accepts an `AbortSignal`; a `loadAbortRef` cancels the previous in-flight `getMessages` fetch when a new `loadMessages` runs, so Thread A's pending fetch does not overwrite Thread B's data. | _PENDING_ | Plan 060-02 Task 1 added `signal?: AbortSignal` to `getMessages`. Plan 060-01 Task 2 added `loadAbortRef` and threaded `controller.signal` into `getMessages`. Confirm via `grep -c "export async function getMessages(threadId: string, signal?: AbortSignal)" frontend/src/lib/api.ts` = 1 AND `grep -c "loadAbortRef.current?.abort()" frontend/src/hooks/useMessages.ts` = 1. |
| 3 | The `loadMessages` call in `useMessages.sendMessage`'s `finally` block is removed — streaming-format messages built up by SSE deltas remain authoritative and the Bug 3 raw-JSON regression (tool-result JSON leaking into chat content) does not recur. | _PENDING_ | Plan 060-01 Task 1 deletion #6 removed the finally-block reload. Confirm via `grep -c "if (!wasStoppedByUser && activeThreadIdRef.current === threadId)" frontend/src/hooks/useMessages.ts` = 0. The Playwright test asserts `expect(bodyText).not.toContain('"tool_call_id":')` and `expect(bodyText).not.toContain('[{"content":"')` as the runtime regression guard. |
| 4 | Browser MCP test: start streaming Thread A -> click Thread B before stream ends -> Thread B view shows only Thread B messages, no leak from A; Network tab shows Thread A's `getMessages` aborted. | _PENDING_ | `e2e/tests/060-thread-race.spec.ts` (Plan 060-03 Task 1) implements this scenario via Playwright. The test asserts (a) Thread B's body text does NOT contain `THREAD_A_USER_MARKER`, (b) at least one Thread A `getMessages` request failed with an abort/cancel reason OR no orphaned in-flight requests remain, (c) no raw tool-result JSON leaks. Run command: `cd e2e && TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npx playwright test 060-thread-race.spec.ts --reporter=line`. |

**Score:** _PENDING_ (target: 4/4 truths VERIFIED)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `frontend/src/hooks/useMessages.ts` | `setViewingThread` callback added; `loadAbortRef` declared; `loadMessages` rewritten with abort-previous + post-await guard + AbortError-swallow; finally-block reload deleted; Realtime subs deleted; clearMessages no longer aborts. | _PENDING_ | Verify via the acceptance-criteria greps from Plans 060-01 Tasks 1-3 and Plan 060-02 Task 2. |
| `frontend/src/lib/api.ts` | `getMessages` signature updated to `(threadId: string, signal?: AbortSignal)` with `signal` threaded into `fetch` options. | _PENDING_ | `grep -c "export async function getMessages(threadId: string, signal?: AbortSignal)" frontend/src/lib/api.ts` = 1. |
| `frontend/src/components/chat/ChatArea.tsx` | useEffect rewritten with order `setViewingThread -> abortStream -> clearMessages -> loadMessages`; dep array `[thread?.id]`; 8s timer + visibilitychange listener deleted; destructure drops subscribe/unsubscribe. | _PENDING_ | Verify via Plan 060-02 Task 3 acceptance-criteria greps. |
| `e2e/tests/060-thread-race.spec.ts` | New Playwright test exercising the race scenario; reads creds from env vars; skips cleanly when creds absent. | _PENDING_ | `test -f e2e/tests/060-thread-race.spec.ts` exits 0. |

---

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| ChatArea useEffect | `setViewingThread` (from useMessages) | First statement of effect body | _PENDING_ | The setViewingThread call appears BEFORE any abortStream/clearMessages/loadMessages call in the rewritten useEffect. |
| useMessages.loadMessages | api.ts getMessages | Second positional arg `controller.signal` threaded into fetch | _PENDING_ | The fetch in `getMessages` has `{ headers, signal }`; loadMessages calls `getMessages(threadId, controller.signal)`. |
| useMessages.loadMessages | activeThreadIdRef post-await guard | `if (activeThreadIdRef.current !== threadId) return` | _PENDING_ | Read-after-await; discards cross-thread response. |
| useMessages.setViewingThread | activeThreadIdRef sole writer | `activeThreadIdRef.current = threadId` (only inside setViewingThread) | _PENDING_ | No other write site in the file. |
| Frontend `AbortController.abort()` | Backend SSE disconnect (Phase 058 + 059) | TCP RST -> ASGI http.disconnect -> agent_runner cancellation | INHERITED FROM 059 | Same mechanism verified in 059-VERIFICATION.md. Phase 060 leans on this guarantee. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| TypeScript clean across all three modified files | `cd frontend && npx tsc --noEmit` | _PENDING — zero errors expected_ | _PENDING_ |
| Frontend builds clean | `cd frontend && npm run build` | _PENDING — build succeeds_ | _PENDING_ |
| Playwright test discovers the new spec | `cd e2e && npx playwright test --list tests/060-thread-race.spec.ts` | _PENDING — test listed_ | _PENDING_ |
| Playwright test passes against live dev backend | `cd e2e && TEST_USER_EMAIL=... TEST_USER_PASSWORD=... npx playwright test 060-thread-race.spec.ts --reporter=line` | _PENDING — 1 passed_ | _PENDING_ |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| STREAM-02a | 060-01-PLAN, 060-02-PLAN, 060-03-PLAN | Switching from a streaming Thread A to Thread B does NOT corrupt Thread B's message list with Thread A's data (Symptom H). Concurrent loadMessages calls cannot overwrite each other's results. | _PENDING — SATISFIED expected_ | Architectural mitigation: Plan 060-01 (`setViewingThread` separation + `loadAbortRef` + post-await guard); Plan 060-02 (ChatArea wiring + `signal` parameter); Plan 060-03 (Playwright e2e proof). |

No orphaned requirements: REQUIREMENTS.md maps only STREAM-02a to phase 060, and all three plans declare STREAM-02a in their `requirements_addressed` frontmatter.

---

### Anti-Patterns Found

_PENDING — fill at verification time. Expected: none introduced by Phase 060._

---

### Human Verification Required

The automated Playwright test is the BINDING evidence path. The manual two-tab DevTools checklist below is preserved as an ops/UAT smoke test backstop (D-060-13, non-gating).

---

## Appendix — Manual Two-Tab DevTools Checklist (D-060-13, non-gating)

Estimated time: 3 minutes. Mirrors the 058/059 manual-runbook format.

### Setup

- [ ] Backend running: `cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --reload` (single worker — do NOT use `--workers N`)
- [ ] Frontend running: `cd frontend && npm run dev`
- [ ] Logged in as a test user with at least 2 existing threads (or willing to create them)
- [ ] Browser DevTools open on the frontend tab; Network tab visible; filter set to `Fetch/XHR`

### Procedure

**Step 1 — Open Thread A and start a long-running stream:**

1. Click into "Thread A" (any existing thread).
2. Type a long-running prompt: `List 10 documents from the knowledge base, then for each one give a 30-word summary based on its content.`
3. Press Enter.
4. Observe the SSE stream begin in DevTools — `POST /threads/{A-id}/messages` shows as `(pending)` with streaming response visible.
5. Wait until tokens are clearly streaming into the assistant bubble (~3-5 seconds).

**Step 2 — Click Thread B mid-stream:**

6. While Thread A is still streaming, click "Thread B" in the sidebar.
7. Note the wall-clock time of the click.

**Step 3 — Verify Thread B view:**

8. Within ~1 second of the click, Thread B's view should render with ONLY Thread B's actual messages (the messages you saw the last time you visited Thread B).
9. Thread A's user-prompt text and Thread A's partial assistant response MUST NOT appear in Thread B's view.

**Step 4 — Verify Thread A's getMessages was aborted:**

10. In DevTools Network tab, find the `GET /threads/{A-id}/messages` request that fired right before the click (Thread A's load that the new ChatArea useEffect started).
11. Its status should show as either:
    - `(canceled)` (the abort signal fired before it completed), OR
    - it never appears at all (loadAbortRef intercepted it before the fetch was initiated).
12. The `GET /threads/{B-id}/messages` request that fires AFTER the click should complete in <1 second (CONCUR-01 from Phase 058 keeps it fast even while Thread A's POST stream continues).

**Step 5 — Verify no raw tool-result JSON in Thread B (Bug 3 guard):**

13. Visually inspect Thread B's message list. Look for any string starting with `[{"content":"` or any inline `"tool_call_id":` text in the chat bubbles.
14. None should be present. If you see any, Plan 060-01 Task 1 deletion #6 (the `finally`-block reload removal) was incomplete.

### Pass Criteria

- [ ] Thread B's view shows only Thread B's messages (no Thread A leak) within 1 second of the click.
- [ ] Thread A's `getMessages` GET is canceled OR never fires.
- [ ] Thread B's `getMessages` GET completes in under 1 second.
- [ ] No raw tool-result JSON appears in Thread B's chat.

### Caveats / Notes

- The dev backend uses a single uvicorn worker (per PROJECT.md D-v2.5-02). Phase 058 made the cross-tab GET fast under load via `run_in_threadpool`; without that, Thread B's GET would queue behind Thread A's stream and the manual test would falsely fail. Confirm 058 is intact via `tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse`.
- After Plans 060-01 and 060-02 land but BEFORE Phase 061 lands, Symptoms E (tab switch mid-stream) and F (F5 mid-stream) will not auto-recover — see CONTEXT.md "Short-term regression note (acceptable)". The manual checklist above does NOT exercise E/F; those regression guards belong to Phase 061's verification doc.

---

_Verified: PENDING_
_Verifier: PENDING_
_Binding evidence: `e2e/tests/060-thread-race.spec.ts` once it passes against live dev backend_
