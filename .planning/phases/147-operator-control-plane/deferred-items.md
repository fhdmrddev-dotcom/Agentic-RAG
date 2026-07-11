# Phase 147 — Deferred Items (out-of-scope discoveries)

Items found during execution that are OUT OF SCOPE for the current task's
changes. Logged, not fixed (executor scope boundary).

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
