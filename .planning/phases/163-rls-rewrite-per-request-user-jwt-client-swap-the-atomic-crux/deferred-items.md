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
