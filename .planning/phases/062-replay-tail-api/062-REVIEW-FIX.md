---
phase: 062-replay-tail-api
fixed_at: 2026-05-03
review_path: .planning/phases/062-replay-tail-api/062-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 062: Code Review Fix Report

**Fixed at:** 2026-05-03
**Source review:** `.planning/phases/062-replay-tail-api/062-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 7
- Fixed: 6
- Skipped: 1 (test-quality only — explicitly deferred per orchestrator context)

All Phase 062 integration tests (`backend/tests/integration/test_062_*.py`)
green after fixes — 23/23 pass under `pytest --timeout=60`.

## Fixed Issues

### CR-01: `list_active_runs` cross-user → 500 (NOT 404) on real Postgres

**Files modified:** `backend/app/api/threads.py`
**Commit:** `7add0ae`
**Status:** fixed
**Applied fix:** Replaced `.single()` with `.maybe_single()` in the threads
ownership SELECT inside `list_active_runs`. PostgREST's `.single()` raises
`APIError(code="PGRST116", HTTP 406)` on no-row; the postgrest patch in
`main.py` only converts `code="204"` to `_Empty`, so `PGRST116` would
propagate to FastAPI's default handler and surface as 500 — directly
violating D-062-12 / T-062-01. `.maybe_single()` returns `None` on no-row
(consistent with the patch). Mirrors the pattern already used by
`stream_run` and `cancel_run` in `runs.py`.

Empirically confirmed pre-fix: `GET /threads/{fake_uuid}/active-runs`
returned 500 against real Postgres while stream + delete correctly returned
404.

**Verification:** `pytest test_062_active_runs.py test_062_cross_user_404.py`
→ 8 passed.

---

### WR-01: Carried-forward `"completed_at": "now()"` may store literal string

**Files modified:** `backend/app/api/runs.py`, `backend/app/api/threads.py`
**Commit:** `46d2e97`
**Status:** fixed
**Applied fix:** Replaced the literal string `"now()"` with
`datetime.now(timezone.utc).isoformat()` in BOTH locations:
- `runs.py` `cancel_run` zombie-heal UPDATE
- `threads.py` `_shielded_finalize` happy-path UPDATE

PostgREST sends UPDATE payloads as JSON; the string `"now()"` arrives over
the wire as a literal JSON string. Postgres' `timestamptz` only accepts
the bare token `'now'` (no parens) as a special literal — `'now()'` may
store a literal string, return NULL, or error depending on column
definition / Postgres version, silently corrupting `completed_at`.

Symmetric fix per REVIEW.md guidance — no asymmetry between zombie heal
and happy-path completion. Added `from datetime import datetime, timezone`
import to `runs.py`; `threads.py` already had it.

**Verification:** `pytest test_062_delete_zombie.py` → 1 passed.

---

### WR-02: TTL-expired buffer race → no terminal event until full deadline

**Files modified:** `backend/app/api/runs.py`
**Commit:** `1742774`
**Status:** fixed: requires human verification
**Applied fix:** When `xread` returns empty during the live-tail BLOCK
loop AND `redis.exists(stream_key) == 0`, emit a synthetic
`{"type":"error","error":"buffer_expired_during_tail"}` event and exit.
Probe is best-effort with `try/except (RedisError, OSError)` per D-062-13
— if the probe itself fails, fall back to the original deadline-based
behavior so we never make the bug worse.

Closes the race where the producer finalizes (EXPIRE 60) between the
route's `redis.exists` probe and the consumer's first `xread`, the
EXPIRE then races to TTL=0, and the consumer is left BLOCKing in 5s
windows until the full `run_hard_timeout_seconds + 10` deadline fires
`consumer_timeout`.

**Why "requires human verification":** This involves loop-control logic
(when to exit Phase 2 prematurely vs. continue BLOCKing). Tier 1+2
verification only confirms syntax correctness. The decision to short-
circuit on `exists=0` is semantically correct per the REVIEW guidance
and D-062-06 contract, but the developer should manually confirm the
behavior matches the intended D-062-06 semantics before phase verifier
runs end-to-end.

**Verification:** `pytest test_062_stream_replay.py test_062_stream_terminal.py
test_062_stream_ttl_expired.py` → 7 passed.

---

### WR-03: Malformed `?since=` → silent SSE drop

**Files modified:** `backend/app/api/runs.py`
**Commit:** `6f67fdc`
**Status:** fixed
**Applied fix:** Wrapped both `xread` calls (Phase 1 replay + Phase 2
live-tail, defense-in-depth) in `try/except RedisError`. On failure
yield a synthetic `{"type":"error","error":"invalid_since"}`
(replay-phase) or `{"type":"error","error":"redis_error"}` (tail-phase)
event so the client gets a clean SSE termination instead of an HTTP 200
+ zero-events silent drop.

Per orchestrator context: chose to catch in `replay_tail_consumer` over
route-boundary 422 validation — less invasive, keeps the existing
two-mode loop intact, preserves the D-062-07 "any string accepted"
contract documented in the route comment.

**Verification:** `pytest test_062_stream_replay.py test_062_stream_terminal.py`
→ 3 passed.

---

### WR-04: Concurrent DELETE → duplicate `cancelled` sentinel

**Files modified:** `backend/app/api/runs.py`, `backend/tests/integration/test_062_redis_down.py`
**Commits:** `f4733f7` (fix), `b283023` (test mock follow-up)
**Status:** fixed
**Applied fix:** Gate the zombie-heal sentinel XADD on a Redis
`SETNX cancel_lock` (SET NX EX 60). Two concurrent DELETEs on the same
`run_id` can both pass the ownership SELECT + status check; only the
SETNX winner emits the sentinel, the loser skips. UPDATE / ZREM /
EXPIRE remain idempotent and outside the lock, preserving the existing
best-effort contract per D-062-13.

If the SETNX itself fails (Redis hiccup), fall through and emit the
sentinel anyway — preserves the prior best-effort behavior in degraded
mode rather than silently dropping the only event the consumer needs to
terminate.

Test mock follow-up (`b283023`): `_build_dead_redis` in
`test_062_redis_down` did not stub `redis.set`, so the post-fix
`await redis.set(...)` returned a fresh sync MagicMock that failed the
`await`. Added `dead.set = _raise` so every Redis op fails uniformly
with `ConnectionError`.

**Verification:** `pytest test_062_delete_zombie.py test_062_delete_happy.py
test_062_delete_terminal_idempotent.py test_062_redis_down.py` → 7 passed.

---

### WR-05: Envelope-less stream entry → silent SSE drop on KeyError

**Files modified:** `backend/app/api/runs.py`
**Commit:** `f049971`
**Status:** fixed
**Applied fix:** Replaced `fields["data"]` with `fields.get("data")` in
both Phase 1 (replay) and Phase 2 (live-tail) entry loops. If a future
migration / misbehaving producer / cross-version backfill writes a
stream entry without the `data` field, log a warning and `continue`
(skip the malformed entry) instead of letting the `KeyError` get caught
by the `BaseException` wrapper, logged + re-raised, and kill the SSE
stream silently mid-replay.

Same fragile contract exists in `event_consumer` (threads.py:336-423)
but that is the pre-Phase-062 carry-forward; this fix scopes to the new
`replay_tail_consumer` per REVIEW.md.

**Verification:** `pytest test_062_stream_replay.py test_062_stream_terminal.py
test_062_stream_ttl_expired.py test_062_multi_consumer_fanout.py` → 8 passed.

---

## Skipped Issues

### WR-06: Tests sequence-override `runs_builder.execute.side_effect`

**Files:**
- `backend/tests/integration/test_062_stream_replay.py`
- `backend/tests/integration/test_062_delete_happy.py`
- `backend/tests/integration/test_062_multi_consumer_fanout.py`

**Reason:** Skipped per orchestrator context guidance: "this is
test-quality only — fix is optional. If too invasive, document in
REVIEW-FIX.md as deferred."

The proper fix (dispatch `runs_builder.execute.side_effect` by op kind:
insert vs select vs update) requires either reworking
`_make_table_builder` in `_run_helpers.py` to track the last-called
chained method (and dispatch accordingly), or restructuring all three
test files to install per-op side_effect routers before the producer
spawns. Either approach has cross-test reach beyond Phase 062's
delivery scope.

**Original issue:** After the POST spawns a real producer, the test
reassigns `runs_builder.execute.side_effect` to return a streaming-row
dict. The same MagicMock is shared with the still-running producer, so
the producer's `_shielded_finalize` UPDATE call now receives the
streaming-row dict instead of the original `_make_result([])`. The
producer doesn't read the result body for UPDATEs, so it works in
practice — but the test silently mutates the contract for the producer
mid-flight. Any future producer code that *does* inspect
`update.execute()` data could fail nondeterministically depending on
scheduling.

**Recommended follow-up:** Open a tech-debt ticket to refactor
`_make_table_builder` with op-aware dispatch so side_effect overrides
become non-destructive. Target: a future test-infrastructure cleanup
phase.

---

_Fixed: 2026-05-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
