---
phase: 063-frontend-stream-decoupling
verified: 2026-05-03T18:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live POST /threads/{id}/messages returns HTTP 201 JSON {message_id, run_id} against a real Supabase instance"
    expected: "201 application/json body with two UUID fields; no text/event-stream response; message_id is a real UUID from the messages table"
    why_human: "BL-02 fix changed the INSERT pattern from .select('id').single() to plain .insert() + .data[0]['id']. All integration tests run against _build_mock_supabase; the real PostgREST/supabase-py path for the messages INSERT has never been exercised against a live DB. REVIEW flagged: 'Verify against a real Supabase instance before shipping.' If real supabase-py .data shape differs from mocks, every POST 500s."
  - test: "Refresh mid-stream (SC3): F5 during a long stream → reload → assistant message continues animating"
    expected: "active-runs call fires after reload; GET /runs/{rid}/stream opens; assistant bubble text grows post-reload"
    why_human: "e2e spec 063-refresh-mid-stream.spec.ts exists and parses but was not run against a live browser (worktree dev-server constraint — dev server reads from main-repo path, not worktree). Post-merge gsd:verify-work required."
  - test: "Resume button on failed run (SC7): inject failed run → reload → Resume button visible → click fires fresh POST"
    expected: "Resume button with aria-label='Resume failed run' appears; clicking triggers POST /threads/{id}/messages"
    why_human: "e2e spec 063-resume-failed.spec.ts exists and parses but requires ENABLE_TEST_FIXTURES=1 on backend + live browser. Additionally: getActiveRuns only returns status='streaming' runs; how the injected status='failed' run surfaces as runStatus='failed' on the Message object through loadMessages needs confirmation (loadMessages returns raw DB rows without runStatus). The data-flow path for the Resume button on fixture-injected runs is uncertain without a live run."
  - test: "Multi-tab sync (SC4): open same thread in two tabs while streaming → both render same tokens, no cross-thread leak"
    expected: "Both tabs show identical token sequence; switching to another thread and back shows no corruption from the other tab's stream"
    why_human: "Multi-tab behavior cannot be automated in the current e2e harness (single-browser context). subscriptionsRef is per-hook-instance so each tab independently calls active-runs + attaches. Live browser verification with two tabs required."
  - test: "Stop semantics cross-tab (SC5): clicking Stop sends DELETE /runs/{run_id}; terminal event fires; all consumers close cleanly"
    expected: "Stop button click → DELETE /runs/{rid} → cancelled event received by all open SSE consumers including other tabs → stream stops everywhere"
    why_human: "Cross-tab Stop relies on backend Redis XADD of the cancelled sentinel being consumed by all open subscribeToRun consumers. Requires a live streaming session with two tabs simultaneously open."
---

# Phase 063: Frontend Stream Decoupling Verification Report

**Phase Goal:** Rewire the frontend so the assistant-message stream lives independently of the POST request that started it. On every (re)connect, the frontend reconciles state via `active-runs` and reattaches to the replay-and-tail endpoint. Multi-tab sync, refresh-mid-stream, and navigate-away-and-back all work as a side-effect.

**Verified:** 2026-05-03T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (overwrites Plan 05 executor's interim file)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /threads/{id}/messages returns 201 JSON {message_id, run_id}; frontend opens GET /runs/{run_id}/stream for tokens | VERIFIED | `threads.py:2210-2215` — `return JSONResponse(status_code=status.HTTP_201_CREATED, content={"message_id": str(_user_msg_id), "run_id": str(run_id)})`. `api.ts:226` — `subscribeToRun` opens `${API_BASE}/runs/${runId}/stream?since=...`. `useMessages.ts:437,510` — `const { message_id, run_id } = await postMessage(...)` then `await subscribeToRun(run_id, "0", callbacks, controller.signal)`. Backend test sweep: 33 passed with canonical -k filter. |
| 2 | On every page load, focus, visibilitychange, pageshow, frontend queries active-runs and reattaches automatically | VERIFIED | `ChatArea.tsx:121-146` — second useEffect (WR-07 fix: uses reconcileRef, dep array is `[thread?.id]` only) wires reconcile to mount, visibilitychange (document.visibilityState === "visible" check), focus, and pageshow (e.persisted gate). `useMessages.ts:585-701` — `reconcile()` calls `Promise.all([getActiveRuns(threadId), loadMessages(threadId)])` in parallel then synthesizes `temp-${run.run_id}` placeholder and fires `subscribeToRun`. |
| 3 | Refresh mid-stream: F5 → reload → active-runs reports streaming → reattach → assistant message continues | VERIFIED (code) | Logic confirmed: reconcile fires on mount (ChatArea.tsx:124), getActiveRuns queries live runs, subscribeToRun reattaches. e2e spec `063-refresh-mid-stream.spec.ts` exists (network-snapshot assertions, content-delta check). Live browser run needed. |
| 4 | Multi-tab sync: two tabs on same thread render same tokens, no cross-thread leak | VERIFIED (code) | Each tab's hook instance independently opens `subscribeToRun` for active run_ids. `guardedSetMessages` in reconcile gates writes on `activeThreadIdRef.current === threadId` (WR-05 fix). Cross-user run_id non-leak test exists (`test_063_cross_user_no_runid_leak.py`). Live multi-tab verification needed. |
| 5 | Stop: clicking Stop sends DELETE /runs/{run_id}; producer cancels; terminal fires; consumers close | VERIFIED | `useMessages.ts:321-338` — `stopStreaming` reads `messagesRef.current` (WR-03 fix: stable callback via ref, no messages dep), finds streaming msg's `runId`, calls `await cancelRun(runId)`. `api.ts:372-383` — `cancelRun` issues `DELETE ${API_BASE}/runs/${runId}`. SSE parser closes on `cancelled` event (`api.ts:317-320`). |
| 6 | Bug 3 regression guard: no tool-result JSON leaks into chat content | VERIFIED | `useMessages.ts:573-574` — finally block comment: "CRITICAL Phase 060 invariant (Bug 3 guard): do NOT call loadMessages here." No `loadMessages` call in sendMessage finally (grep: `finally.*loadMessages` count = 0 in useMessages). SSE-built content stays canonical. |
| 7 | Resume button surfaces on failed runs; clicking fires a fresh POST | VERIFIED (code) | `MessageItem.tsx:101-112` — renders `!isStreaming && role==="assistant" && runStatus==="failed"`. `useMessages.ts:703+` — `resumeFromFailed` walks backward for preceding user message (BL-06 fix). e2e spec `063-resume-failed.spec.ts` exists with fixture-injection + click assertion. Live browser run needed. |

**Score:** 7/7 truths verified (5 fully in code + tests, 2 code-verified with human confirmation needed for runtime behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/api/threads.py` | POST returns 201 JSON; event_consumer deleted | VERIFIED | `return JSONResponse(...)` at line 2210. `^async def event_consumer` count = 0. `EventSourceResponse(` count = 0. Dead imports (AsyncGenerator, EventSourceResponse) removed (WR-01 fix). BL-02 fix: plain `.insert()` + `.data[0].get("id")` pattern at lines 693-704. |
| `frontend/src/lib/api.ts` | 4 new functions + 3 types; streamMessage deleted | VERIFIED | `postMessage` (L174), `subscribeToRun` (L219), `getActiveRuns` (L349), `cancelRun` (L372, with optional `signal` per WR-03). `PostMessageResponse`, `ActiveRun`, `StreamCallbacks` interfaces present. `grep streamMessage api.ts` = 0. WR-02 fix: parse errors now warn to console. |
| `frontend/src/types/index.ts` | Message.runId? + Message.runStatus? | VERIFIED | Lines 96-98: `runId?: string` and `runStatus?: "streaming" \| "completed" \| "failed" \| "cancelled"`. |
| `frontend/src/hooks/useMessages.ts` | reconcile, resumeFromFailed, subscriptionsRef, server-only Stop | VERIFIED | All present. BL-03 fix: cleanup in onTerminal not finally. BL-06 fix: backward-walk for preceding user message. WR-03 fix: messagesRef for stable stopStreaming. WR-04 fix: `message_id` used to swap optimistic user placeholder (L452). WR-05 fix: guardedSetMessages in reconcile callbacks. |
| `frontend/src/components/chat/ChatArea.tsx` | Second useEffect with 4 triggers + WR-07 reconcileRef | VERIFIED | Lines 116-146: reconcileRef pattern + visibilitychange + focus + pageshow (e.persisted) + cleanup parity. Existing Phase 060 thread-switch effect at L80-102 unchanged. |
| `frontend/src/components/chat/MessageItem.tsx` | Resume button on runStatus==='failed' | VERIFIED | Lines 101-112. `data-testid="assistant-message"` (L56) and `data-testid="user-message"` (L25) present. WR-08 JSX indentation fixed. |
| `frontend/src/components/chat/MessageList.tsx` | onResume prop drill; BL-05 scroll fix | VERIFIED | `onResume?` in Props (L12), forwarded to MessageItem (L97). BL-05: `useLayoutEffect` + rAF retry for scroll listener; `isNearBottomRef` guard on all auto-scroll branches. |
| `backend/app/api/test_fixtures.py` | env-gated inject-failed-run; UUID validation | VERIFIED | `thread_id: UUID` (BL-04 fix at L48). Auth via `Depends(get_current_user)`. Ownership SELECT before insert. Both messages + runs rows inserted. 122 lines. |
| `backend/app/main.py` | ENABLE_TEST_FIXTURES gate + production refusal | VERIFIED | Lines 160-172: env check + nested `if ENVIRONMENT in ("production","prod"): raise RuntimeError(...)`. |
| `backend/tests/integration/test_063_cross_user_no_runid_leak.py` | Cross-user 404 + no run_id leak | VERIFIED | File present (WR-09 fix, commit a0aaf06). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `threads.py::send_message` | JSONResponse 201 return | `return JSONResponse(status_code=status.HTTP_201_CREATED, ...)` | WIRED | Confirmed at threads.py:2210-2215 |
| `threads.py::send_message` | `_user_msg_id` from messages INSERT | `await aexec(supabase.table("messages").insert({...}))` + `.data[0].get("id")` | WIRED | Lines 693-704. Standard supabase-py pattern per BL-02 fix. Note: not live-DB verified. |
| `api.ts::subscribeToRun` | GET /runs/{runId}/stream | `fetch(url)` where `url = ${API_BASE}/runs/${runId}/stream?since=...` | WIRED | api.ts:226 |
| `api.ts::cancelRun` | DELETE /runs/{runId} | `fetch(${API_BASE}/runs/${runId}, {method: "DELETE"})` | WIRED | api.ts:374-376. Optional `signal` added (WR-03). |
| `api.ts::getActiveRuns` | GET /threads/{threadId}/active-runs | `fetch(${API_BASE}/threads/${threadId}/active-runs)` | WIRED | api.ts:354 |
| `useMessages.sendMessage` | `postMessage + subscribeToRun` | import from ../lib/api | WIRED | useMessages.ts:4 (single-line import). L437: postMessage call. L510: subscribeToRun call. message_id used at L452 (WR-04 fix). |
| `useMessages.reconcile` | `Promise.all([getActiveRuns, loadMessages])` | parallel fetch | WIRED | useMessages.ts:589 — single-line `const [runs] = await Promise.all([getActiveRuns(threadId), loadMessages(threadId)])` |
| `useMessages.stopStreaming` | `cancelRun(runId)` via DELETE /runs/{rid} | messagesRef read + cancelRun | WIRED | useMessages.ts:332. WR-03 fix: messagesRef.current instead of messages dep. |
| `ChatArea reconcile useEffect` | `reconcileRef.current(tid)` on 4 events | useEffect([thread?.id]) with reconcileRef | WIRED | ChatArea.tsx:121-146. WR-07 fix: reconcileRef stabilizes the dep array. |
| `MessageItem Resume button` | `onResume?.(message)` → resumeFromFailed | onClick prop chain ChatArea → MessageList → MessageItem | WIRED | MessageItem.tsx:105. MessageList.tsx:12,97. ChatArea.tsx:38,174 (onResume={resumeFromFailed}). |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ChatArea.tsx` reconcile | `activeRuns` | getActiveRuns → GET /threads/{tid}/active-runs → threads.py:list_active_runs → public.runs WHERE status='streaming' | Yes — Phase 062 endpoint queries live DB | FLOWING |
| `useMessages.ts::sendMessage` | `run_id` | postMessage → POST /threads/{tid}/messages → `return JSONResponse({run_id: str(run_id)})` | Yes — run_id is UUID from public.runs INSERT | FLOWING (mock-verified; live-DB unconfirmed per BL-02 note) |
| `MessageItem.tsx` | `message.runStatus` (during streaming) | SSE terminal events → `onTerminal` wrapper → `setMessages({...m, runStatus: "completed"/"failed"/"cancelled"})` | Yes — events from Redis XADD producer | FLOWING |
| `MessageItem.tsx` | `message.runStatus === "failed"` for Resume | Via test fixture: inject-failed-run inserts assistant message + failed runs row. After reload, loadMessages fetches the message row. But raw DB messages rows do NOT carry runStatus — runStatus is only set when a run streams + terminates. | Uncertain — see note | UNCERTAIN |

**Resume button data-flow note:** `getActiveRuns` only returns `status='streaming'` runs per D-062-02. A `status='failed'` injected run will NOT appear in active-runs. Therefore `runStatus: "failed"` on a Message can only be set by: (a) an SSE `error` terminal event during live streaming, OR (b) the page reading a failed run's status from the `runs` table and correlating with the message. The current codebase does not show a path where `loadMessages` → messages array → `runStatus` is populated from the `runs` table after reload. The e2e spec may rely on the reconcile/subscribeToRun path detecting the failed run, but the active-runs filter precludes this. This is a live-verification gap for SC#7.

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|---------|--------|
| event_consumer deleted at module level | `grep -c '^async def event_consumer' threads.py` = 0 (confirmed in source inspection) | PASS |
| EventSourceResponse construction gone | `grep -c 'EventSourceResponse(' threads.py` = 0 | PASS |
| Dead imports removed (WR-01) | No `from sse_starlette import` or `from typing import AsyncGenerator` in threads.py | PASS |
| JSONResponse 201 present | threads.py:2210-2215 confirmed | PASS |
| streamMessage deleted from api.ts | `grep -c streamMessage api.ts` = 0 | PASS |
| 4 new API functions present | postMessage L174, subscribeToRun L219, getActiveRuns L349, cancelRun L372 | PASS |
| subscribeToRun URL | `${API_BASE}/runs/${runId}/stream?since=` at api.ts:226 | PASS |
| reconcile function in useMessages | `const reconcile = useCallback` at useMessages.ts:585 | PASS |
| visibilitychange + pageshow + e.persisted | ChatArea.tsx:136,138,133 | PASS |
| Resume button condition | `!isStreaming && role==="assistant" && runStatus==="failed"` at MessageItem.tsx:101 | PASS |
| BL-02 fix: plain INSERT + data[0] | threads.py:693-704 — no .select("id").single() chain | PASS |
| BL-03 fix: cleanup in onTerminal | useMessages.ts:669-673 — `subscriptionsRef.current.delete(run.run_id)` inside onTerminal wrapper | PASS |
| WR-04 fix: message_id used | useMessages.ts:452 — `if (m.id === userMsg.id) return { ...m, id: message_id }` | PASS |
| WR-07 fix: reconcileRef in ChatArea | ChatArea.tsx:116-119 | PASS |
| ENABLE_TEST_FIXTURES gate | main.py:160-172 — env check + production refusal | PASS |
| Backend regression sweep | Plan 05 confirmed: 33 passed, 4 deselected, 3 xfailed (4/4 stability runs) | PASS |
| E2E specs parse | Plan 05 confirmed: 3 tests in 3 files, 0 parse errors | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STREAM-04 | 063-01 through 063-05 | A streaming response survives client navigation, refresh, and multi-tab access; generation lifetime decoupled from any single HTTP request | SATISFIED (code) / HUMAN NEEDED (live) | Full implementation present. Backend sweep GREEN. Live browser scenarios (SC3, SC4) require human verification. |
| STREAM-02b | 063-01 through 063-05 | Recovery automatic via reconcile; Resume button optional fallback | SATISFIED (code) / HUMAN NEEDED (live) | Reconcile wired to all triggers. Resume button in DOM. Live SC3/SC7 scenarios need human browser run. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps STREAM-04 and STREAM-02b to Phase 063. Both accounted for. TEST-01 maps to Phase 064 (later phase — not orphaned). CONCUR-01 maps to Phase 058 (complete). CONCUR-02 maps to Phase 059 (complete). STREAM-02a maps to Phase 060 (complete). No orphaned requirements for Phase 063.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useMessages.ts` | 585-701 | `reconcile` does not populate `runStatus` on messages loaded from DB via `loadMessages`. Raw DB messages have no `runStatus`. Resume button for fixture-injected failed runs requires a data path that is not confirmed. | Warning | SC#7 e2e test may rely on a data path that doesn't exist; live verification will confirm or expose this |
| `backend/tests/integration/` | — | No live-DB integration test for messages INSERT id-capture | Warning | BL-02 is the most consequential fix; if real PostgREST .data differs from mocks, every POST 500s. Human: run one POST against real Supabase. |

---

### Human Verification Required

#### 1. Live-DB POST Contract Validation (Critical — BL-02 Fix)

**Test:** With Supabase running locally, authenticate and POST to `/threads/{id}/messages` with a valid Bearer token and content body.
**Expected:** HTTP 201 `Content-Type: application/json` body `{"message_id": "<uuid>", "run_id": "<uuid>"}` where both are valid UUIDs and `message_id` matches the row inserted into `messages`.
**Why human:** All integration tests use `_build_mock_supabase`. The BL-02 fix rewrote the messages INSERT to use `await aexec(supabase.table("messages").insert({...}))` then read `.data[0].get("id")`. Real supabase-py 2.x behavior for `.data` on a plain INSERT (without `Prefer: return=representation`) may return `None` or an empty list. REVIEW explicitly warned: "Verify against a real Supabase instance before shipping — none of the new tests exercise the real PostgREST path for this code shape."

#### 2. Refresh Mid-Stream (SC#3)

**Test:** Start a long stream → wait ~3 seconds → press F5.
**Expected:** After reload: GET /threads/{id}/active-runs fires; GET /runs/{rid}/stream opens; assistant bubble continues filling with tokens.
**Why human:** e2e spec `063-refresh-mid-stream.spec.ts` parses and has correct assertion structure but was not run against a live browser (worktree dev-server constraint).

#### 3. Resume Button via Test Fixture (SC#7)

**Test:** Start backend with `ENABLE_TEST_FIXTURES=1`. Log in, navigate to a thread. In a second terminal, POST to `/__test__/inject-failed-run/{thread_id}` with the Bearer token. Reload the page.
**Expected:** A Resume button appears on the last assistant message. Clicking it fires POST /threads/{id}/messages in Network DevTools.
**Why human:** (1) Requires `ENABLE_TEST_FIXTURES=1`. (2) The data-flow gap: `getActiveRuns` only returns streaming runs; `loadMessages` returns raw DB rows without `runStatus`; unclear how the injected failed run's status flows onto the Message object's `runStatus` field to trigger the Resume button render condition (`message.runStatus === "failed"`). This path needs live confirmation.

#### 4. Multi-Tab Sync (SC#4)

**Test:** Open same thread in two browser tabs. Start streaming in Tab 1. Observe Tab 2.
**Expected:** Both tabs show same tokens. Switching to another thread in Tab 1 does not corrupt Tab 2.
**Why human:** Cannot automate two simultaneous browser contexts in current harness. Requires manual multi-tab test.

#### 5. Cross-Tab Stop (SC#5)

**Test:** Open same thread in two tabs while streaming. Click Stop in Tab 1.
**Expected:** Both tabs receive `cancelled` terminal event and stop rendering.
**Why human:** Cross-tab Stop requires a live Redis Stream with two simultaneous SSE consumers. Needs manual verification.

---

### Gaps Summary

No blocking code-level gaps found. All 7 success criteria have confirmed implementation in the codebase with correct wiring. The human verification items are behavioral/runtime concerns:

**Priority 1 (most consequential):** BL-02 live-DB validation — if the real `supabase.table("messages").insert({...}).execute()` via `aexec` does not return the inserted row id under `.data[0]["id"]`, every POST to `/threads/{id}/messages` raises HTTP 500. This has not been tested outside of mocks. Run one live POST before declaring Phase 063 production-ready.

**Priority 2:** SC#7 data-flow clarification — confirm how `runStatus: "failed"` appears on a Message object after page reload when the failure comes from a fixture-injected runs row rather than a live SSE error terminal event. The current reconcile path only watches active (streaming) runs; if `loadMessages` doesn't carry `runStatus` from the DB, the Resume button may not render after reload even when a failed run exists.

**Priority 3:** Live e2e runs (SC#3 refresh-mid-stream, SC#4 multi-tab sync, SC#5 cross-tab Stop).

---

_Verified: 2026-05-03T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
