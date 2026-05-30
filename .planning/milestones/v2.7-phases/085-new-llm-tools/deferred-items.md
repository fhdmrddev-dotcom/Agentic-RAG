# Phase 085 — Deferred Items

Items discovered during execution that are OUT OF SCOPE for the current plan
per the executor's SCOPE BOUNDARY rule (only auto-fix issues DIRECTLY caused by
the current task's changes).

## From Plan 03 execution (2026-05-28)

### Pre-existing FK-violation in test_062 suite (NOT caused by Plan 03)

**Symptom:**

```
asyncpg.exceptions.ForeignKeyViolationError: insert or update on table "runs"
violates foreign key constraint "runs_thread_id_fkey"
DETAIL:  Key (thread_id)=(<uuid>) is not present in table "threads".
```

**Affected tests (sampled — likely more):**
- `tests/integration/test_062_delete_happy.py::test_cancels_in_flight_producer`

**Reproduced at:** worktree base `a9c7e0b` BEFORE any Plan 03 commits — so the
failure is pre-existing and NOT a regression introduced by Plan 03.

**Root cause:** the test inserts a `runs` row directly without seeding the
parent `threads` row first; current local DB enforces the FK
(`runs_thread_id_fkey`). The same pattern is fixed elsewhere via the
`fk_aware_runs_factory` fixture in `backend/tests/conftest.py:256-340` —
test_062 just hasn't been migrated to it yet.

**Why not fixed in Plan 03:** Plan 03 only touches `_handle_ask_user`,
`runs.py:cancel_run`, `runs.py:submit_ask_user_response`, and `main.py`
lifespan. The test_062 FK-violation is unrelated to those changes; fixing it
would be scope creep (per executor SCOPE BOUNDARY rule).

**Re-open trigger:** any future phase that touches `/runs/{rid}` DELETE
behavior or the broader test_062 suite should migrate those tests to
`fk_aware_runs_factory` (likely a 1-line fixture swap per test).
