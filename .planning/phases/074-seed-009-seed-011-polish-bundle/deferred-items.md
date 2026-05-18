# Phase 074 — Deferred Items

Items discovered during execution that are out of phase scope per the
GSD scope-boundary rule (auto-fix only issues DIRECTLY caused by the
current task's changes).

---

## D-074-02-DEFER-1: test_059 / test_062 / test_063 FK seeding gap after Phase 073 asyncpg flip

**Surfaced by:** Plan 074-02 Task 3 ship-gate sweep (D-074-14)
**Date:** 2026-05-18
**Status:** open, deferred to a future test-infra polish phase
**Severity:** test-infra (not production)

### Symptom

Running the 4-file ship-gate sweep on either the pre-Plan-02 base
(`32e873d`) OR the post-Plan-02 head (`03d51da`) produces the same
4 failures:

```
4 failed, 2 passed, 1 warning in 7.99s
FAILED tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect
FAILED tests/integration/test_059_disconnect.py::test_normal_stream_unchanged
FAILED tests/integration/test_062_stream_replay.py::test_replay_then_tail_to_terminal
FAILED tests/integration/test_063_post_then_subscribe.py::test_post_then_get_stream_renders_full_response
```

All four fail with the same root cause:

```
asyncpg.exceptions.ForeignKeyViolationError: insert or update on
table "runs" violates foreign key constraint "runs_thread_id_fkey"
DETAIL:  Key (thread_id)=(<uuid>) is not present in table "threads".
```

### Diagnosis

This is a **Phase 073 → Phase 074 fixture-seeding collision**, NOT
caused by Plan 074-02. Plan 074-02 only touched fixture hoisting
(`_reset_redis_singleton`); the asyncpg `runs INSERT` hot path and
the `runs.thread_id` FK constraint are untouched by Plan 02.

Phase 073 Plan 04 flipped 3 hot-path writes from `aexec` (mock-able
via Supabase dependency override) to `asyncpg` calls into the real
local Postgres pool. Phase 073's own integration test
(`test_073_concurrency.py`) handles this correctly by seeding
`auth.users` + `threads` rows in its fixture (see commit message of
Phase 073 Plan 04 — "test_thread_user fixture initially used bare
try/except: pass around threads INSERT, but local Supabase has
threads.user_id -> auth.users.id FK constraint that mock-Supabase
test_058 fixture never exercises").

Phase 073's D-073-11 strategy was: keep `test_058_concurrency.py`
byte-identical as the legacy mock-Supabase binding gate, and ship
the new `test_073_concurrency.py` as the real-asyncpg binding gate.
The strategy explicitly tolerated test_058 staying mock-only.

What was NOT documented in Phase 073: `test_059_disconnect.py`,
`test_062_stream_replay.py`, and `test_063_post_then_subscribe.py`
also drive their POSTs into the real `runs INSERT` path via
`httpx.AsyncClient(transport=ASGITransport(app=app))`. Phase 073's
preserved-test list (D-073-11) named only test_058 explicitly;
test_059 / 062 / 063 fell into the gap and now FK-violate because
their Supabase mocks never inserted into the real `threads` table.

### Proof this is pre-existing, not Plan-02-introduced

Sweep on commit `32e873d` (pre-Plan-02 base):
```
4 failed, 2 passed in 7.51s
[same 4 failures]
```

Sweep on commit `03d51da` (post-Plan-02 head):
```
4 failed, 2 passed in 7.99s
[same 4 failures]
```

Identical failure set. Plan 02 introduces zero new failures.

### Confirmation that Plan 074-02 closed SEED-011 at the fixture level

The original SEED-011 bug signature is
`RuntimeError: Event loop is closed` — caused by
`app.dependencies._redis` singleton outliving pytest-asyncio's
per-function event loops.

A `grep "Event loop is closed"` across the full 4-file post-Plan-02
sweep returns **ZERO matches**. The new failures are
`ForeignKeyViolationError`, structurally and mechanically distinct
from the loop-binding trap. SEED-011 IS closed at the fixture level:
the hoisted autouse `_reset_redis_singleton` in
`backend/tests/integration/conftest.py` runs before every integration
test, including test_059's 3 tests, and resets the Redis singleton so
each per-test event loop gets a fresh client.

### Recommended next-phase scope (NOT in Plan 074-02)

A future test-infra polish phase should:

1. Apply Phase 073 Plan 04's `test_thread_user` fixture pattern
   (seed `auth.users` row + `threads` row before each test, cascade
   delete in cleanup) to the integration test files that drive POST
   → real `runs INSERT`:
   - `test_059_disconnect.py`
   - `test_062_stream_replay.py`
   - `test_063_post_then_subscribe.py`
2. Decide on D-074-FOLLOWUP: do we want all integration tests to
   speak to real Postgres (matches Phase 073 D-073-11 trajectory)
   or do we want a sibling-conftest async fixture that seeds the FK
   parents transparently the way Plan 074-02 hoisted the Redis
   reset?

### Action for Plan 074-02

NONE — out of scope. Document this collision in the SUMMARY,
preserve the hoisted conftest contribution, do not attempt fixture
seeding in this plan (would balloon scope and break the SCOPE
BOUNDARY rule).
