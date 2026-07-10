# Phase 145 — Deferred Items

## From Plan 03 (threads.py + runs.py extraction onto the run_lifecycle owner)

### D-145-03-DEFER-01 — Update the live-infra cancel/terminal integration tests to the owner writer

**Discovered during:** Plan 03 Task 2 (runs.py cancel zombie-heal → `finalize_run_terminal`).

**What:** Three integration tests assert the **pre-145-03 supabase writer**
(`mock_supabase.table("runs").update({... "status": "cancelled" ...})`) for the cancel
zombie-heal. Plan 03 swaps that writer to `finalize_run_terminal` (asyncpg pool via the
owner), so those assertions will fail and the handler now also calls `get_pg_pool()`:

- `backend/tests/integration/test_062_delete_zombie.py::test_heals_zombie_state`
  (assertion **(a)**: `runs_builder.update` with `status='cancelled'`).
- `backend/tests/integration/test_062_redis_down.py` (asserts `mock_supabase.table("runs").update`
  with `status='cancelled'` + `error='cancelled_by_user'`).
- `backend/tests/integration/test_066_terminal_classification.py::test_delete_writes_cancelled_not_timed_out`
  (asserts the cancel verb writes `status='cancelled'` via `mock_supabase`).

`backend/tests/integration/test_077_cross_cancel.py::test_cross_worker_cancel_via_zombie_heal`
reads the **real Postgres** `runs.status` after the DELETE (not the mock), so it likely
stays green (the owner writes real Postgres via `finalize_run`), but should be re-run to confirm.

**Required fix (next live-infra pass):** repoint the writer assertion in the three tests
from `mock_supabase.table("runs").update(...)` to the owner path — either spy on
`app.services.run_lifecycle.finalize_run_terminal` and assert `status='cancelled'`, or (for
the ones with a real pool fixture) assert the asyncpg `finalize_run` UPDATE. Pattern already
demonstrated in `backend/tests/test_cancel_run.py::test_cancel_handler_routes_zombie_heal_through_owner`.

**Why deferred (not fixed here):** these are **integration tests that bind the live dev
Redis (`redis://localhost:6379`) and, post-swap, a real Postgres pool**. Per the Plan 03
execution constraints (CLAUDE.md + the executor brief), the operator's dev backend + Redis
are LIVE this session and MUST NOT be touched/mutated, and the backend must not be restarted.
Running or verifying these tests would mutate the shared `runs:active` / `run:{id}` keyspace
on the operator's live Redis. Editing them blind (without being able to run them) risks
introducing a wrong fixture, so the honest move is to route them through the same
owner-spy recipe on a next pass against **isolated CI Redis/Postgres**.

**Re-open trigger:** the next time the backend integration suite runs against isolated
infra (CI or a throwaway local Redis DB), update the three assertions above and confirm all
four cancel-zombie integration tests are green.

**Scope note:** Plan 03's designated cancel proof is the NEW self-contained unit test
`backend/tests/test_cancel_run.py` (2 tests, fakes only) — that is green and committed. The
Deep/continuation TERMINAL writer is **unchanged** by Plan 03 (still `finalize_run` via the
owner), so the `test_066` Deep-branch tests (`test_timeout_branch_writes_timed_out`,
`test_failed_error_truncated_to_200_chars`) are not newly affected by this plan.
