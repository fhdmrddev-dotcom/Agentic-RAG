---
status: resolved
phase: 063-frontend-stream-decoupling
source: [063-VERIFICATION.md]
started: 2026-05-04T00:00:00Z
updated: 2026-05-05T00:00:00Z
resolved_by: 063.1-frontend-stream-decoupling-gap-closure
---

## Current Test

[live UAT executed 2026-05-04 via Chrome DevTools MCP + Supabase local stack]

## Tests

### 1. Live POST /threads/{id}/messages returns HTTP 201 JSON {message_id, run_id} against a real Supabase instance

expected: 201 application/json body with two UUID fields; no text/event-stream response; message_id is a real UUID from the messages table
result: **PASS**

evidence:
- `POST /threads/bb1fc774-9bde-4500-b3dc-6ed75bfa0882/messages` → 201
- response body: `{"message_id":"60e85997-eaef-462e-80ca-8df65c46d0a8","run_id":"83f1e825-3fca-4afb-b820-e9016774c372"}`
- content-type: `application/json` (NOT `text/event-stream`)
- DB query of `messages` table confirms `id=60e85997-eaef-462e-80ca-8df65c46d0a8` exists with role='user' and matching content — i.e. `.data[0].get("id")` returned the real PostgREST-assigned UUID, not None
- BL-02 fix structurally correct against live PostgREST/supabase-py

### 2. Refresh mid-stream (SC3): F5 during a long stream → reload → assistant message continues animating

expected: active-runs call fires after reload; GET /runs/{rid}/stream opens; assistant bubble text grows post-reload
result: **PASS** (with one caveat — see Gaps below)

evidence:
- Sent "Write 25 short sentences about coffee" → reloaded mid-stream → clicked thread in sidebar → reconcile fired:
  - GET `/threads/{id}/active-runs` → 200 (returned the streaming run)
  - GET `/threads/{id}/messages` → 200 (returned partial persisted assistant content)
  - GET `/runs/{rid}/stream?since=0` → 200 (reattached via SSE)
- Stream completed in-place; final message rendered all 25 coffee sentences
- Same flow worked for the count-1-to-30 message (which finished while page was reloading; loadMessages fetched the completed assistant message and no SSE was needed)

caveat: Brief visual duplicate during the SSE replay window — see Gaps section.

### 3. Resume button on failed run (SC7): inject failed run → reload → Resume button visible → click fires fresh POST

expected: Resume button with `aria-label='Resume failed run'` appears; clicking triggers POST /threads/{id}/messages
result: [pending]

why: Requires backend restart with `ENABLE_TEST_FIXTURES=1` env var to mount the test-only fixture endpoint. Backend currently running without that flag. Verifier also flagged a data-flow gap: getActiveRuns only returns `status='streaming'` runs, while loadMessages returns raw DB rows that don't carry `runStatus`. The wiring path between persisted-failed-run state and `message.runStatus="failed"` on the Message object after reload remains untested.

### 4. Multi-tab sync (SC4): open same thread in two tabs while streaming → both render same tokens, no cross-thread leak

expected: Both tabs show identical token sequence; switching to another thread and back shows no corruption from the other tab's stream
result: [pending]

why: Single-context Chrome MCP harness can't easily simulate two simultaneous tabs.

### 5. Stop semantics cross-tab (SC5): clicking Stop sends DELETE /runs/{run_id}; terminal event fires; all consumers close cleanly

expected: Stop button click → DELETE /runs/{rid} → cancelled event received by all open SSE consumers → stream stops everywhere
result: **PASS** (single-tab — cross-tab pending)

evidence:
- Sent "Tell me a 10000 word story" → "The Lighthouse Keeper's Daughter" began streaming → clicked Stop button:
  - DELETE `/runs/7743eb76-02e9-4d1a-a83e-cd9468be9e71` → 204
  - SSE GET stream closed cleanly
  - "Response stopped" badge rendered at the end of the assistant bubble
  - Content cut off mid-sentence ("The storm made any hope of summoning help impossible. The phone lines")
  - Send button returned to non-streaming state (input re-enabled)

cross-tab portion still requires a 2-tab manual test.

## Summary

total: 5
passed: 3
issues: 0
pending: 2 (SC4 multi-tab, SC7 Resume button)
skipped: 0
blocked: 0

## Gaps

### Gap-001: Duplicate assistant bubble during SSE replay window

severity: minor (visual flicker; auto-resolves)
discovered: live UAT 2026-05-04, refresh-mid-stream test
screenshot: 063-UAT-bug-duplicate-bubble.png

repro:
1. Send a message that produces a long streaming response.
2. While the stream is in flight, F5 the page.
3. Click the thread in the sidebar to re-activate it.
4. During the SSE replay window, the assistant content is rendered in TWO bubbles simultaneously:
   - One from the `temp-${run_id}` placeholder created by `reconcile()` and filled by `subscribeToRun(runId, "0", ...)` SSE deltas
   - One from `loadMessages` returning the persisted assistant DB row with whatever content was already saved
5. After the SSE terminal event fires, the temp placeholder gets reconciled away and only the persisted bubble remains.

root cause: `reconcile()` calls `subscribeToRun(runId, "0", callbacks, signal)` — the `since="0"` argument replays the Redis stream FROM THE BEGINNING regardless of how much content `loadMessages` already returned. Both data paths feed the same content into the message list (under different IDs: `temp-${run_id}` vs the real message id), producing visible duplication until terminal-event reconciliation merges them.

suggested fix (gap closure 063.1):
- After loadMessages, compute the latest assistant message offset for the active run (e.g., from a new `last_seen_offset` field on the message row, OR from `eventCount` length when streamed live).
- Pass that as `since={offset}` instead of `since="0"` so SSE only replays NEW events.
- Alternative: when reconcile creates the temp placeholder, check if a persisted message already exists for the run_id and skip the placeholder if so.

### Gap-002: Resume button data-flow on persisted failed runs (verifier-flagged, unconfirmed)

severity: unknown (could be design flaw OR could work via path I haven't traced)
discovered: gsd-verifier code review, not yet exercised live

description: Per Plan 04, Resume button on `MessageItem.tsx:101-112` renders when `runStatus === "failed"`. After page reload:
- `getActiveRuns` only returns `status='streaming'` runs (D-062-02 explicit filter)
- `loadMessages` returns raw DB rows from the `messages` table — these rows do not carry `runStatus`
- It is unclear how `message.runStatus` gets set to `"failed"` after a reload when the run terminated as failed

needs: live exercise with `ENABLE_TEST_FIXTURES=1` to confirm whether the Resume button actually renders for fixture-injected failed runs. If it doesn't, this is a real gap requiring a `runs.status` join on the messages query or a separate "failed runs for thread" endpoint.

### Gap-003: Thread switch mid-stream — blank window + duplicate Redis Stream replay

severity: **major** (user-reported UX issue + Redis bandwidth waste)
discovered: live UAT 2026-05-04, thread-switch test
network evidence: reqid 409 (sendMessage SSE) + reqid 418 (reconcile SSE) both for run_id=108874ad with `since=0`

repro:
1. In thread A, send a long-streaming message.
2. While the stream is producing tokens, click thread B in the sidebar.
3. After ~1s, click thread A again to return.
4. **Observed**: Main area is BLANK (just the heading) for ~1-2 seconds.
5. Then the persisted user message + a fresh-from-zero SSE replay appear, populating content from the start.
6. Network tab shows TWO SSE GETs to `/runs/{rid}/stream?since=0` for the SAME run id.

root cause:
- `sendMessage` (useMessages.ts:498) opens an SSE consumer and registers it in `subscriptionsRef`. The `controller` is NOT explicitly aborted on thread switch; React effect cleanup likely fires `controller.abort()` indirectly during `useMessages` hook teardown when ChatArea remounts with a new thread.id.
- That AbortError trips the `finally` safety net at line 524 → `subscriptionsRef.delete(run_id)`.
- When user clicks back, ChatArea's reconcile fires for thread A. `subscriptionsRef.has(run_id)` returns FALSE (just deleted) → reconcile creates a NEW temp placeholder and opens a FRESH SSE with `since=0`, replaying the entire stream from the beginning of the Redis Stream.
- During the replay window, the temp placeholder is empty and no persisted assistant message exists yet → user sees blank.
- Wasted Redis bandwidth: every back-navigation = full stream re-read from Redis.

related Redis-efficiency concerns surfaced by this finding:
- `since=0` is hard-coded everywhere a subscribeToRun is called (sendMessage, reconcile, resumeFromFailed). There is no offset checkpoint anywhere on the client.
- Backend `event_consumer` clone in 062-02 supports the `last_id=since` parameter — the API surface IS there, the frontend just doesn't use it.
- Each thread switch with active streams = full stream re-replay = `XREAD COUNT N STREAMS run:{id} 0` against Redis. For long streams this is many KB of network + Redis CPU.

suggested fix (063.1):
- Track the highest-seen Redis stream offset on the client side (e.g., `eventCount` per run on the in-memory message, or `lastSeenOffset` on the temp placeholder).
- When sendMessage's SSE is aborted on navigate-away, do NOT delete the subscriptionsRef entry — keep the controller alive so reconcile sees it as "live" and short-circuits. OR: snapshot the lastSeenOffset before aborting, store it in a map keyed by run_id, and pass that as `since` on reconcile reattach.
- Alternative architectural fix: don't abort the SSE on thread switch at all. The user-visible state goes inactive, but the SSE keeps reading deltas in the background, mutating the placeholder (still in messages array). When user navigates back, `subscribeToRun` is already running and producing updates — no replay needed.

### Gap-004: Hard-coded `since="0"` — no offset checkpointing

severity: minor by itself, but compounds with Gap-001 + Gap-003

call sites in useMessages.ts:
- Line 498: `await subscribeToRun(run_id, "0", callbacks, controller.signal)` (sendMessage)
- Line 680: `subscribeToRun(run.run_id, "0", callbacks, controller.signal)` (reconcile)
- resumeFromFailed (line 703+): also passes `"0"`

fix: thread a `lastSeenOffset` ref through. Backend already supports `since={ms-id}` per the legacy event_consumer signature.

---

## Resolution (Phase 063.1)

All four gaps closed by Phase 063.1 — Frontend Stream Decoupling Gap Closure (completed 2026-05-05). Live-bundle verification via Chrome MCP confirmed Wave 2/3/4 fix markers are served at `localhost:5173`.

| Gap | Status | Fixed by | Verification |
|---|---|---|---|
| Gap-001 (duplicate-bubble flicker) | resolved | Plan 063.1-02 — runId-match dedup against `messagesRef.current` | `e2e/tests/063.1-refresh-no-duplicate-bubble.spec.ts` |
| Gap-002 (Resume button data flow) | resolved | Plan 063.1-01 — backend two-query merge surfaces `runStatus` + `runId` per assistant row | manual UAT pending under `ENABLE_TEST_FIXTURES=1` (carry-forward) |
| Gap-003 (blank window + duplicate SSE) | resolved | Plan 063.1-03 — removed `abortStream()` from ChatArea thread-change effect; `guardedSetMessages` wraps sendMessage callbacks | `e2e/tests/063.1-thread-switch-mid-stream.spec.ts` |
| Gap-004 (hard-coded `since="0"`) | resolved | Plan 063.1-02 — `lastSeenOffsetRef` Map + `onCursor` parser threads `since={highest-seen-ms-id}` through reconcile's `subscribeToRun` | `e2e/tests/063.1-thread-switch-mid-stream.spec.ts` (asserts since param) |

A fifth gap (Gap-005 — concurrent reconcile race wiping placeholder) was discovered during 063.1's UAT planning and closed by Plan 063.1-04 (`reconcileInFlightRef` guard + `loadMessages` REPLACE→MERGE). Captured in `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-CONTEXT.md` and verified by `e2e/tests/063.1-concurrent-reconcile.spec.ts`.

A new gap (Gap-006 — `RUN_HARD_TIMEOUT_SECONDS=120` cancelling complex tool-call agents mid-iteration) was filed during 063.1 close-out as `out-of-scope` and escalated to a follow-on phase. Recorded in `.planning/phases/063.1-frontend-stream-decoupling-gap-closure/063.1-HUMAN-UAT.md`.
