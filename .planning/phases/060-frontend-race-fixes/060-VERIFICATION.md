---
phase: 060-frontend-race-fixes
verified: 2026-05-02T00:00:00Z
status: human_needed
score: 3/4 must-haves verified
binding_test: e2e/tests/060-thread-race.spec.ts
manual_runbook: included as appendix (non-gating per D-060-13)
gaps: []
human_verification:
  - test: "Run the Playwright e2e test against live dev backend: cd e2e && TEST_USER_EMAIL=<email> TEST_USER_PASSWORD=<password> npx playwright test 060-thread-race.spec.ts --reporter=line"
    expected: "1 test passes in ~25-30 seconds. Thread B view shows only Thread B messages (no RACE-TEST-THREAD-A-MARKER leak), at least one Thread A getMessages fails with abort/cancel, no raw tool-result JSON appears."
    why_human: "SC #4 requires a live LLM backend, real SSE streaming, and browser-level network observation. The test infrastructure (Playwright spec, AbortController wiring, request listeners) is fully verified in code. Only the live execution against a streaming LLM response requires human/CI with running dev servers and credentials."
---

# Phase 060: Frontend Race Fixes Verification Report

**Phase Goal:** Switching from a streaming Thread A to Thread B always renders Thread B's correct messages, with no cross-thread data leak and no raw tool-result JSON regression.
**Verified:** 2026-05-02
**Status:** human_needed — SC #1/2/3 VERIFIED by automated code inspection + TypeScript check; SC #4 requires live Playwright run
**Re-verification:** No — initial verification
**Binding evidence:** `e2e/tests/060-thread-race.spec.ts` (D-060-12) — automated Playwright test exercises Thread A -> Thread B navigation race against the live dev backend.
**Backstop:** Manual two-tab DevTools checklist below (D-060-13) — non-gating; preserved for ops/UAT smoke tests.

---

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Phase 060 Success Criteria) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `activeThreadIdRef` is written by exactly one function — a new `setViewingThread(threadId)` callback called from ChatArea's `useEffect([thread?.id])` BEFORE `abortStream`/`clearMessages`/`loadMessages`. `loadMessages` only reads the ref post-await. | VERIFIED | `useMessages.ts` line 47: `const setViewingThread = useCallback((threadId: string | null) => { activeThreadIdRef.current = threadId }, [])` — 1 declaration, 1 write site (line 48), 0 other writes. `ChatArea.tsx` line 71: `setViewingThread(thread?.id ?? null)` is the FIRST statement of the useEffect body (before `clearMessages`, `abortStream`, `loadMessages`). `loadMessages` reads `activeThreadIdRef.current` only at line 70, after `await getMessages(...)` completes. `UseMessages` interface (line 14) declares `setViewingThread: (threadId: string | null) => void`. Return statement (line 394) includes `setViewingThread`. |
| 2 | `loadMessages` accepts an `AbortSignal`; a `loadAbortRef` cancels the previous in-flight `getMessages` fetch when a new `loadMessages` runs, so Thread A's pending fetch does not overwrite Thread B's data. | VERIFIED | `api.ts` line 48: `export async function getMessages(threadId: string, signal?: AbortSignal)` — signature confirmed; `{ headers, signal }` threaded into fetch at line 50. `useMessages.ts` line 28: `const loadAbortRef = useRef<AbortController \| null>(null)`. Line 62: `loadAbortRef.current?.abort()` — abort-previous is the FIRST statement of `loadMessages`. Line 63-64: fresh `AbortController` installed. Line 66: `await getMessages(threadId, controller.signal)`. Line 70: `if (activeThreadIdRef.current !== threadId) return` — post-await cross-thread guard. TypeScript `--noEmit` returns 0 errors (confirmed: empty output). |
| 3 | The `loadMessages` call in `useMessages.sendMessage`'s `finally` block is removed — streaming-format messages built up by SSE deltas remain authoritative and the Bug 3 raw-JSON regression does not recur. | VERIFIED | `grep -c "wasStoppedByUser && activeThreadIdRef.current === threadId"` returns 0 — the deleted `finally`-block reload guard is gone. `grep -c "loadMessages(threadId)"` in `useMessages.ts` returns 0 — no self-call from `sendMessage`. The `finally` block (lines 341-391) contains only state resets and tool-call status updates. No `loadMessages` invocation remains in the stream completion path. The e2e test includes Bug 3 regression guards: `expect(bodyText).not.toContain('"tool_call_id":')` and `expect(bodyText).not.toContain('[{"content":"')`. |
| 4 | Browser MCP test: start streaming Thread A -> click Thread B before stream ends -> Thread B view shows only Thread B messages, no leak from A; Network tab shows Thread A's `getMessages` aborted. | HUMAN NEEDED | `e2e/tests/060-thread-race.spec.ts` exists (156 lines). All three assertions are coded: (a) `expect(bodyText).not.toContain(THREAD_A_USER_MARKER)`, (b) abort/cancel check via `page.on("requestfailed")` listener, (c) Bug 3 guard. Creds loaded from env vars; `test.skip()` guard when absent; no `123456` hardcoded. The architectural primitives backing the test are VERIFIED in code (AbortController, loadAbortRef, post-await guard). Requires live LLM stream + running dev servers to execute. |

**Score:** 3/4 truths verified by automated inspection (SC #4 awaits live browser run)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `frontend/src/hooks/useMessages.ts` | `setViewingThread` callback added; `loadAbortRef` declared; `loadMessages` rewritten with abort-previous + post-await guard + AbortError-swallow; finally-block reload deleted; Realtime subs deleted; clearMessages no longer aborts. | VERIFIED | 396 lines (down from 503). `setViewingThread` declared at line 47, in interface at line 14, returned at line 394. `loadAbortRef` declared at line 28. `loadMessages` body: abort-previous (line 62), fresh controller (63-64), `getMessages(threadId, controller.signal)` (line 66), post-await guard (line 70), AbortError-swallow (line 76). No `subscribeToThread`, `unsubscribeFromThread`, `channelRef`, `threadChannelRef`, `reloadTimerRef`, `supabase.channel` (all grep counts = 0). `clearMessages` (lines 51-57): `setMessages([])`, `setIsStreaming(false)`, `isSendingRef.current = false` only — no `abortControllerRef` reference. `abortControllerRef.current?.abort()` appears exactly twice: `stopStreaming` (line 36) and `abortStream` (line 40) — never in `clearMessages`. |
| `frontend/src/lib/api.ts` | `getMessages` signature updated to `(threadId: string, signal?: AbortSignal)` with `signal` threaded into `fetch` options. | VERIFIED | Line 48: `export async function getMessages(threadId: string, signal?: AbortSignal): Promise<Message[]>`. Line 50: `const res = await fetch(..., { headers, signal })`. Mapping body (lines 52-70) preserved verbatim. |
| `frontend/src/components/chat/ChatArea.tsx` | useEffect rewritten with order `setViewingThread -> abortStream -> clearMessages -> loadMessages`; dep array `[thread?.id]`; 8s timer + visibilitychange listener deleted; destructure drops subscribe/unsubscribe. | VERIFIED | Line 27 destructure: `setViewingThread` present, `subscribeToThread`/`unsubscribeFromThread` absent. useEffect (lines 68-90): `setViewingThread(thread?.id ?? null)` at line 71 (first statement, unconditional); `abortStream()` at line 83; `clearMessages()` at line 84; `loadMessages(thread.id).catch(console.error)` at line 85. `}, [thread?.id])` at line 90. ESLint suppression at line 89. No `setTimeout`, `visibilitychange`, `addEventListener`, `removeEventListener`, `8000`, `fallbackTimer`, `clearTimeout`, `handleVisibilityChange` (all grep counts = 0). |
| `e2e/tests/060-thread-race.spec.ts` | New Playwright test exercising the race scenario; reads creds from env vars; skips cleanly when creds absent. | VERIFIED | File exists, 156 lines. `process.env.TEST_USER_EMAIL` and `process.env.TEST_USER_PASSWORD` each appear (count = 2 total across both vars). `test.skip()` guard at line 59. No `123456` hardcoded (count = 0). All three assertions present. `page.on("requestfailed")` listener at line 71. |

---

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| ChatArea useEffect | `setViewingThread` (from useMessages) | First statement of effect body (line 71), unconditional | VERIFIED | `setViewingThread(thread?.id ?? null)` executes before the `if (!thread)` null-guard, before `abortStream()`, before `clearMessages()`, before `loadMessages()`. |
| useMessages.loadMessages | api.ts getMessages | Second positional arg `controller.signal` threaded into fetch | VERIFIED | `useMessages.ts` line 66: `const data = await getMessages(threadId, controller.signal)`. `api.ts` line 50: `fetch(..., { headers, signal })`. Chain is complete. |
| useMessages.loadMessages | activeThreadIdRef post-await guard | `if (activeThreadIdRef.current !== threadId) return` at line 70 | VERIFIED | Guard appears exactly once, after the `await` on line 66 — reads the ref only after the async fetch resolves, never before. |
| useMessages.setViewingThread | activeThreadIdRef sole writer | `activeThreadIdRef.current = threadId` inside `setViewingThread` only | VERIFIED | One write site in the file (line 48 inside `setViewingThread`). `loadMessages` no longer writes the ref before await (old pattern eliminated). No other write site found. |
| Frontend `AbortController.abort()` | Backend SSE disconnect (Phase 058 + 059) | TCP RST -> ASGI http.disconnect -> agent_runner cancellation | INHERITED FROM 059 | Same mechanism verified in 059-VERIFICATION.md. Phase 060 leans on this guarantee. |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 060 is a hook refactor (no new data-rendering components). The data flow `getMessages → setMessages → MessageList` was pre-existing and unchanged. The race fix adds correctness guards around when `setMessages` is called but does not change the source of data. The only meaningful data-flow check is that `setMessages(data)` at `useMessages.ts` line 73 is called with real API data (not a stub empty array), which is confirmed by the substantive `getMessages` implementation in `api.ts`.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| TypeScript clean across all three modified files | `cd frontend && npx tsc --noEmit` | Empty output — 0 errors | VERIFIED |
| No subscribeToThread/unsubscribeFromThread remain in useMessages.ts | `grep -c "subscribeToThread\|unsubscribeFromThread" frontend/src/hooks/useMessages.ts` | 0 | VERIFIED |
| No Realtime artefacts remain in useMessages.ts | `grep -c "supabase.channel\|postgres_changes\|threadChannelRef\|reloadTimerRef\|channelRef"` | 0 | VERIFIED |
| No @ts-expect-error directives remain in useMessages.ts | `grep -c "@ts-expect-error"` | 0 | VERIFIED |
| finally-block reload deleted from sendMessage | `grep -c "loadMessages(threadId)" useMessages.ts` | 0 | VERIFIED |
| Phase-057 band-aids gone from ChatArea | `grep -c "setTimeout\|visibilitychange\|addEventListener\|8000" ChatArea.tsx` | 0 | VERIFIED |
| Playwright test discovers the new spec | `cd e2e && npx playwright test --list tests/060-thread-race.spec.ts` | SKIP — requires Playwright install; structural existence confirmed by file read | SKIP (file verified) |
| Playwright test passes against live dev backend | `cd e2e && TEST_USER_EMAIL=... npx playwright test 060-thread-race.spec.ts` | PENDING — requires live LLM stream + running dev servers | HUMAN NEEDED |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| STREAM-02a | 060-01-PLAN, 060-02-PLAN, 060-03-PLAN | Switching from a streaming Thread A to Thread B does NOT corrupt Thread B's message list with Thread A's data (Symptom H). Concurrent `loadMessages` calls cannot overwrite each other's results. | ARCHITECTURALLY SATISFIED — browser proof pending | Plan 060-01: `setViewingThread` separation + `loadAbortRef` + post-await guard. Plan 060-02: ChatArea wiring + `signal` parameter. Plan 060-03: Playwright e2e proof (code verified; live run pending). REQUIREMENTS.md maps STREAM-02a to Phase 060 only. All three plans declare `requirements_addressed: [STREAM-02a]`. No orphaned requirements. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `useMessages.ts` | 82 | `if (isSendingRef.current) return` is missing leading whitespace (indentation is off: `if` is at column 0 vs surrounding code at column 4) | Info | Cosmetic only — no functional impact; TypeScript and React are indentation-agnostic. |
| `useMessages.ts` | 346 | Comment `// D-04: allow Realtime callbacks to process now` is stale (no Realtime callbacks remain) | Info | Dead comment — noted in 060-01-SUMMARY.md as acceptable; future maintenance phase can clean up. |
| `useMessages.ts` | 26, 30 | `sendGenerationRef` and `streamingThreadIdRef` are now write-only (their read-side roles subsumed by the new mechanism) | Info | Deliberately kept per CONTEXT.md Claude's Discretion guidance; documented in 060-01-SUMMARY.md; scheduled for future cleanup. |

No blockers or warnings found. All anti-patterns are cosmetic/deferred and do not affect the race-fix goal.

---

### Human Verification Required

#### 1. Live Playwright Race Test (SC #4 — binding)

**Test:** With dev servers running (`uvicorn app.main:app --reload` + `npm run dev`), execute:

```
cd e2e
TEST_USER_EMAIL="<dev-test-email>" TEST_USER_PASSWORD="<dev-test-password>" npx playwright test 060-thread-race.spec.ts --reporter=line
```

**Expected:** 1 test, 1 passed in ~25-30 seconds. Playwright headlessly:
- Signs in and opens Thread A (new chat)
- Sends the long-running RACE-TEST-THREAD-A-MARKER prompt
- Waits ~4 seconds for streaming to begin
- Clicks New Chat (Thread B) mid-stream
- Asserts Thread B body text does NOT contain `RACE-TEST-THREAD-A-MARKER`
- Asserts at least one Thread A `getMessages` GET failed with abort/cancel reason, OR no orphaned in-flight requests remain
- Asserts no `[{"content":"` or `"tool_call_id":` raw JSON appears

**Why human:** Requires a live LLM backend producing a real SSE stream for >= 4 seconds, running dev servers at localhost:5173 and localhost:8000, and valid Supabase test credentials. The architectural primitives (AbortController, loadAbortRef, post-await guard) are verified in code; only the live race timing cannot be simulated statically.

**After green run:** Update this document — replace `status: human_needed` with `status: passed`, set `score: 4/4`, fill in the Playwright run timestamp below.

---

### Gaps Summary

No gaps found. All three automated success criteria are fully satisfied by the codebase. SC #4 is not a gap — the code is correct and the Playwright test is properly written; the live run is simply the empirical proof that cannot be executed without a running LLM backend.

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

_Verified: 2026-05-02_
_Verifier: Claude (gsd-verifier)_
_Binding evidence: `e2e/tests/060-thread-race.spec.ts` — code verified; live run pending human execution_
