---
status: partial
phase: 063-frontend-stream-decoupling
source: [063-VERIFICATION.md]
started: 2026-05-04T00:00:00Z
updated: 2026-05-04T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live POST /threads/{id}/messages returns HTTP 201 JSON {message_id, run_id} against a real Supabase instance

expected: 201 application/json body with two UUID fields; no text/event-stream response; message_id is a real UUID from the messages table
result: [pending]

why_human: BL-02 fix changed the INSERT pattern from `.select('id').single()` to plain `.insert()` + `.data[0]['id']`. All integration tests run against `_build_mock_supabase`; the real PostgREST/supabase-py path for the messages INSERT has never been exercised against a live DB. REVIEW explicitly flagged: "Verify against a real Supabase instance before shipping." If real supabase-py `.data` shape differs from mocks, every POST 500s.

### 2. Refresh mid-stream (SC3): F5 during a long stream → reload → assistant message continues animating

expected: active-runs call fires after reload; GET /runs/{rid}/stream opens; assistant bubble text grows post-reload
result: [pending]

why_human: e2e spec `063-refresh-mid-stream.spec.ts` exists and parses but was not run against a live browser (worktree dev-server constraint — dev server reads from main-repo path, not worktree). Post-merge `gsd:verify-work` required.

### 3. Resume button on failed run (SC7): inject failed run → reload → Resume button visible → click fires fresh POST

expected: Resume button with `aria-label='Resume failed run'` appears; clicking triggers POST /threads/{id}/messages
result: [pending]

why_human: e2e spec `063-resume-failed.spec.ts` exists and parses but requires `ENABLE_TEST_FIXTURES=1` on backend + live browser. Additionally: `getActiveRuns` only returns `status='streaming'` runs; how the injected `status='failed'` run surfaces as `runStatus='failed'` on the Message object through `loadMessages` needs confirmation (loadMessages returns raw DB rows without runStatus). The data-flow path for the Resume button on fixture-injected runs is uncertain without a live run.

### 4. Multi-tab sync (SC4): open same thread in two tabs while streaming → both render same tokens, no cross-thread leak

expected: Both tabs show identical token sequence; switching to another thread and back shows no corruption from the other tab's stream
result: [pending]

why_human: Multi-tab behavior cannot be automated in the current e2e harness (single-browser context). `subscriptionsRef` is per-hook-instance so each tab independently calls active-runs + attaches. Live browser verification with two tabs required.

### 5. Stop semantics cross-tab (SC5): clicking Stop sends DELETE /runs/{run_id}; terminal event fires; all consumers close cleanly

expected: Stop button click → DELETE /runs/{rid} → cancelled event received by all open SSE consumers including other tabs → stream stops everywhere
result: [pending]

why_human: Cross-tab Stop relies on backend Redis XADD of the cancelled sentinel being consumed by all open `subscribeToRun` consumers. Requires a live streaming session with two tabs simultaneously open.

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
