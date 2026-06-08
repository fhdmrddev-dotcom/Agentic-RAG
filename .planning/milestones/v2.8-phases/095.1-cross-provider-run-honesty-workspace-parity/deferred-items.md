# Phase 095.1 — Deferred Items

Out-of-scope discoveries logged during plan execution (per the executor SCOPE
BOUNDARY rule — NOT fixed; tracked for the verifier / a future cleanup).

## From Plan 095.1-07 (GAP-2)

### DI-095.1-07-01 — Rotted legacy SSE-on-POST tests in test_threads.py (pre-existing)

- **Where:** `backend/tests/integration/test_threads.py::TestSendMessage::test_sse_stream_contains_delta_events` and `::test_sse_stream_delta_events_are_valid_json`
- **Symptom:** Both FAIL at `patch("app.api.threads.create_streaming_chat", ...)` with `AttributeError: module 'app.api.threads' does not have the attribute 'create_streaming_chat'`.
- **Root cause:** The SSE-on-POST streaming path (status 200, `create_streaming_chat`) was REMOVED in Phase 062/063 (the modern dispatch path returns a 201 JSONResponse with `{message_id, run_id, model, provider}`; `postMessage` reads that body and opens `GET /runs/{id}/stream` separately). These two tests target the dead path and never got removed — pure test rot, NOT a backend regression.
- **Proven pre-existing:** present in HEAD before this plan (`git stash` / pre-plan checkout shows the identical 2 failures); ZERO net-new — this plan's new `TestSendMessageDispatchAttribution` is the modern-path replacement coverage.
- **Disposition:** out-of-scope for 095.1-07 (the plan touches only the dispatch JSONResponse content). Candidate for deletion when someone next sweeps `test_threads.py`.

### DI-095.1-07-02 — Pre-existing frontend baseline test cluster (16 failures in src/__tests__)

- **Where:** `frontend/src/__tests__/` — `streamsProvider.test.tsx` (Phase-068/068.5/075.6 reconcile + argsCodeText slice), `streamsProvider_075_9_clientkey.test.tsx`, `components/MessageItem.test.tsx` (thinking-indicator), `components/Plan04.frontend.test.tsx` (stdout/stderr styling).
- **Symptom:** 16 failed / 294 passed in `src/__tests__`.
- **Proven pre-existing:** this exact 6-file cluster is the documented baseline recorded by the 095.1-03 / 095.1-05 / 095.1-08 SUMMARYs. NONE of the failing tests reference this plan's touched surface (the additive dispatch attribution stamp is unrelated to reconcile locks / argsCodeText / clientKey / message-item rendering). The `src/providers/` suites (the StreamsProvider tests that DO matter to this plan) are 21/21 GREEN.
- **Disposition:** out-of-scope (pre-existing rot, SEED-049 E2E/test-revival territory). ZERO net-new from 095.1-07.
