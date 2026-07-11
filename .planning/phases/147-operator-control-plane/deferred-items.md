# Phase 147 — Deferred Items (out-of-scope discoveries)

Items found during execution that are OUT OF SCOPE for the current task's
changes. Logged, not fixed (executor scope boundary).

## From Plan 147-04 (Task 1)

- **Pre-existing stale hardcoded tool counts:**
  `backend/tests/unit/test_085_tool_registration.py::test_get_tools_returns_22_tools_with_no_conditional_enabled`
  asserts the no-web/no-sandbox base toolbox is exactly 22 and both-conditionals-on is
  exactly 24. Reality at committed HEAD (before 147-04): the base list is already **24**
  tools — `query_documents_by_view` (Phase 115) + `get_related_documents` (Phase 116) were
  added to the always-on base after this Phase-085 test's counts were written, but the
  hardcoded `22`/`24` were never bumped, so it fails `24 != 22` on the baseline. Verified via
  `git show HEAD:...openai_service.py` (base-list count = 24). Plan 147-04's `get_tools`
  change is exactly count-neutral (it removes `SAVE_SKILL_TOOL` from the base list and
  re-appends it via a default-ON conditional `getattr(effective, "self_improve_enabled",
  True)`), so the count is 24 both before and after — the failure is Phase 115/116
  documentation debt in an unrelated test, NOT a 147-04 regression. Not fixed (scope
  boundary). Fix = bump expected counts to 24 (base) / 26 (both on), or assert conditional
  membership instead of a brittle total. FLAG-01's own self_improve conditional is fully
  covered by the new `test_147_flag_hide.py` set-equality assertions.

## From Plan 147-04 (Task 2)

- **Pre-existing integration-test rot (stale patch target):**
  `backend/tests/integration/test_threads.py` — `TestSendMessage::test_sse_stream_contains_delta_events`,
  `::test_sse_stream_delta_events_are_valid_json`, and both
  `TestSendMessageDispatchAttribution::*` tests fail at BASELINE with
  `AttributeError: module 'app.api.threads' does not have the attribute 'create_streaming_chat'`.
  That symbol was removed from `threads.py` in a prior refactor (Phase 089 agent_loop
  extraction) — verified 0 references in both committed HEAD and this plan's working copy,
  and Plan 147-04's threads.py diff is import + one D-05 guard only (never touches
  `create_streaming_chat` or the streaming path). Unrelated to 147-04. Fix = re-point the
  patch to the current streaming entry point (agent_loop) or delete the stale tests. The
  D-05 kickoff guard is covered by the new `test_147_workflows_flag.py` (3/3 green).

## From Plan 147-06 (Task 2)

- **Pre-existing test rot (SEED-056):** `frontend/src/__tests__/components/MessageItem.test.tsx`
  → `MessageItem – streaming state > shows thinking indicator when streaming with empty content`
  fails at BASELINE (verified by stashing this plan's `MessageItem.tsx` edit and
  re-running — the failure reproduces on untouched source). The assertion
  `getByText(/thinking/i)` no longer matches the `outerBannerLabel(...)` copy for a
  streaming empty-content assistant message (the thinking indicator DOM still
  renders; only the literal word "thinking" is gone). Unrelated to the 147-06
  cancelled-honesty edits — those are in a separate new test file
  (`src/components/chat/__tests__/MessageItem.test.tsx`, 3/3 green). Not fixed per
  the plan's acceptance note ("pre-existing SEED-056 rot in unrelated tests is not
  this plan's concern").

## From Plan 147-03 (Task 1)

- **Pre-existing integration-test rot (stale data-layer assertion):**
  `backend/tests/integration/test_062_delete_zombie.py::test_heals_zombie_state` fails at
  BASELINE (verified by running it before this plan's refactor). It asserts the
  zombie-heal terminal write on the supabase `runs.update` mock, but the 145-03 / D-145-14
  co-write refactor moved that write to the asyncpg pool (`finalize_run_terminal`). The
  DELETE still correctly returns 204 — only the stale mock-layer assertion is wrong. This
  plan's refactor is byte-equivalent (the endpoint still returns 204 + zombie-heals), so
  the failure is unchanged. The NEW backstop `backend/tests/test_062_cancel_run.py` asserts
  the SAME contract against the CORRECT data layer (patched `finalize_run_terminal`). Not
  fixed here (out of scope; matches the MEMORY lesson "match test mocks to the data-access
  layer"). Fix = re-point the integration assertion to the pool layer (or delete it in
  favor of the new backstop).
- **Pre-existing integration-test rot (FK seeding):**
  `backend/tests/integration/test_062_delete_happy.py::test_cancels_in_flight_producer`
  fails at BASELINE with `ForeignKeyViolationError: runs_thread_id_fkey` — the test inserts
  a `runs` row against the real local Postgres without seeding the parent `threads` row
  (the `fk_aware_runs_factory` conftest fixture exists for exactly this but this file
  predates it). Unrelated to this plan's cancel refactor (the failure is at POST-time run
  INSERT, before any DELETE). Fix = adopt `fk_aware_runs_factory`.
