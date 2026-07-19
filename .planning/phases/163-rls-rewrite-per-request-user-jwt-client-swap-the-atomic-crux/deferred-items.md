# Phase 163 — Deferred / Out-of-Scope Discoveries

Items discovered during execution that are OUTSIDE the current plan's change scope.
Logged per the executor SCOPE BOUNDARY rule (do not fix pre-existing failures in
unrelated files during an additive plan).

## Pre-existing test rot (NOT introduced by Plan 163-01)

**`tests/integration/test_119_leak.py` — 3 failing tests (asyncpg concurrency).**

- Failing: `test_user_a_never_sees_user_b_signals`, `test_user_b_never_sees_user_a_signals`,
  `test_masked_target_not_reported_as_broken_for_either_viewer`.
- Root symptom: `asyncpg.exceptions._base.InterfaceError: cannot perform operation:
  another operation is in progress` raised during connection RESET on pool release,
  while the test drives the `/document-governance/*` routes through a sync FastAPI
  `TestClient` (threadpool) that shares the app's `get_pg_pool()` singleton.
- **Proven pre-existing:** the same 3 tests fail identically when test_119 is run against
  the Phase-163 BASE-commit conftest (`cf2907fd`) with all of Plan 163-01's additions
  removed. Plan 163-01 adds only NEW fixtures (`pg_pool` / `two_orgs_two_users` /
  `auth_uid_variant`) + `_rls_harness.py`, none of which test_119 consumes (test_119
  defines its own module-level `pg_pool`, which overrides the conftest fixture for that
  module). So this failure is orthogonal to 163-01.
- **Disposition:** out of scope for 163-01 (an additive factories+fixtures plan). Candidate
  for the Wave-4 leak-test wiring or a dedicated test-infra fix — the governance leak
  tests likely need the same TestClient-vs-asyncpg loop isolation the Phase-163 leak
  tests will establish. Not a blocker for this plan.

## Pre-existing test rot (NOT introduced by Plan 163-06)

**`tests/integration/test_threads.py` — 4 failing tests (162.5 extraction source-drift rot).**

- Failing: `TestSendMessage::test_sse_stream_contains_delta_events`,
  `TestSendMessage::test_sse_stream_delta_events_are_valid_json`,
  `TestSendMessageDispatchAttribution::test_dispatch_response_carries_resolved_model_and_provider`,
  `TestSendMessageDispatchAttribution::test_dispatch_response_model_provider_follow_explicit_body_override`.
- Root symptom: `AttributeError: <module 'app.api.threads'> does not have the attribute
  'create_streaming_chat'` / `'insert_run'`. The tests do
  `with patch("app.api.threads.create_streaming_chat", ...)` / `patch("app.api.threads.insert_run", ...)`
  — both symbols were REMOVED from `threads.py` by the Phase 162.5 producer extraction
  (streaming → `run_producer`/`agent_loop`; `insert_run` is imported by `db/runs.py`/`run_lifecycle`,
  never re-exported through `threads.py`). The failure is a `patch()` SETUP `AttributeError`
  raised BEFORE the test body runs — no send_message logic is exercised.
- **Proven pre-existing:** `git show HEAD:backend/app/api/threads.py` (base commit `99d6020a`)
  imports only `from app.db.runs import finalize_run, insert_assistant_message` — neither
  `create_streaming_chat` nor `insert_run` is a module attribute on the base, so the
  `patch()` targets are absent identically on the base. These are the documented
  "insert_run/source-drift rot" from the Phase 162.5 close-out (old-vs-new differential:
  "19 failed / 55 passed IDENTICAL both sides — zero net-new").
- **Independence from 163-06:** Plan 163-06 only swaps `Depends(get_supabase)` → the user-JWT
  client + converts request-scoped pool reads. It never references `create_streaming_chat`
  or `insert_run`. `test_058_concurrency.py` (CONCUR-01, 0.41s < 1.0s gate) + `test_continue.py`
  + the other 21 `test_threads.py`/integration tests pass GREEN with the swap in place.
- **Disposition:** out of scope for 163-06. Candidate for a test-infra refresh that re-targets
  the moved patch seams (`run_producer` / `agent_loop` / `db.runs`). Not a blocker.
