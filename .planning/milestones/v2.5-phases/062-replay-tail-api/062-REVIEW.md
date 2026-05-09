---
phase: 062-replay-tail-api
reviewed: 2026-05-03
depth: standard
files_reviewed: 15
files_reviewed_list:
  - backend/app/api/runs.py
  - backend/app/api/threads.py
  - backend/app/main.py
  - backend/app/models/run.py
  - backend/tests/integration/test_062_active_runs.py
  - backend/tests/integration/test_062_cross_user_404.py
  - backend/tests/integration/test_062_stream_replay.py
  - backend/tests/integration/test_062_stream_terminal.py
  - backend/tests/integration/test_062_stream_ttl_expired.py
  - backend/tests/integration/test_062_delete_happy.py
  - backend/tests/integration/test_062_delete_zombie.py
  - backend/tests/integration/test_062_delete_terminal_idempotent.py
  - backend/tests/integration/test_062_multi_consumer_fanout.py
  - backend/tests/integration/test_062_redis_down.py
  - backend/tests/integration/_run_helpers.py
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 062 Code Review — Replay & Tail API

**Files reviewed:** 15 — **Depth:** standard — **Status:** issues_found

## Summary

The Phase 062 implementation is largely faithful to the plan: the replay/tail consumer mirrors `event_consumer` semantics, cross-user → 404 is consistently enforced at the model level, the per-Redis-op try/except discipline is honored in `cancel_run`, and `_synthetic_terminal_generator` correctly maps `runs.status` to SSE terminal types via the shared dict. The `RedisError` shadowing comment in `runs.py` is well-placed and the import is correct.

That said, three classes of issue warrant attention before ship — one CRITICAL (cross-user-404 contract is broken in `list_active_runs` because the postgrest patch only catches `code="204"` but `.single()` raises `PGRST116`/406), several WARNINGs around input validation, race windows, and a carried-forward `"now()"` literal that may not behave as a SQL function, plus minor INFOs.

**Severity counts:** CRITICAL 1 · WARNING 6 · INFO 3 · TOTAL 10

---

## Critical

### CR-01 — `list_active_runs` cross-user → 500 (NOT 404) on real Postgres

**File:** `backend/app/api/threads.py` (the `list_active_runs` ownership SELECT introduced in Plan 01)

**Issue:** The handler uses `.single()` (not `.maybe_single()`) for the threads ownership SELECT. PostgREST's `.single()` raises `APIError` (PGRST116, HTTP 406) when no row matches — the postgrest patch in `main.py` only converts `APIError` to `_Empty` when `getattr(e, "code", None) == "204"`. PGRST116 has `code="PGRST116"`, not `"204"`, so the patch will NOT catch it; the exception propagates out of `aexec`, hits the FastAPI default handler, and returns a 500 — directly violating D-062-12 (cross-user must NOT 500/leak existence) and T-062-01.

The integration tests do not catch this: `_make_result(None)` inside `tests/integration/_run_helpers.py` returns a MagicMock with `.data = None` rather than raising `APIError`, so the ownership-401/404 path is verified against a fake builder that never exercises the real PostgREST behavior.

By contrast, `runs.py` correctly uses `.maybe_single()` for both `stream_run` and `cancel_run`.

**Fix:** Swap to `.maybe_single()` for symmetry with `runs.py`:
```python
thread_resp = await aexec(
    supabase.table("threads")
    .select("id")
    .eq("id", str(thread_id))
    .eq("user_id", current_user["id"])
    .maybe_single()
)
row = thread_resp.data if thread_resp is not None else None
if not row:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```
And add a real-postgrest integration test (or unit test simulating `APIError(code="PGRST116")` from `aexec`) to prevent regression.

---

## Warning

### WR-01 — Carried-forward `"completed_at": "now()"` may store literal string, not timestamp

**File:** `backend/app/api/runs.py` (`cancel_run` zombie-heal UPDATE) — pattern also exists in `backend/app/api/threads.py` `_shielded_finalize` (carried forward from Phase 061).

**Issue:** The zombie-heal UPDATE sends `{"completed_at": "now()"}`. PostgREST sends this as the JSON string `"now()"` over the wire. Postgres' `timestamptz` input parser accepts the special token `'now'` (without parens) but `'now()'` is NOT a documented special timestamp literal — depending on the column definition and version it may error, return NULL, or produce undefined behavior. The same pattern exists in Phase 061's `_shielded_finalize` (so this is carried-forward, not net-new), but this PR widens the surface.

If the upstream behavior is "stored as literal string `now()`" or "rejected with 22008", the zombie-heal contract silently degrades — `completed_at` is wrong/null, the runs row diverges from happy-path semantics, and downstream queries (audit, time-bounded cleanup) lose the cancel timestamp. Tests don't catch this because the mock supabase stores nothing.

**Fix:** Use a Python-side timestamp:
```python
from datetime import datetime, timezone
...
"completed_at": datetime.now(timezone.utc).isoformat(),
```
Apply the fix in *both* `runs.py` and `threads.py` so happy-path and zombie-heal stay symmetric.

### WR-02 — Race: TTL-expired buffer between `redis.exists()` and consumer attach yields no terminal event

**File:** `backend/app/api/runs.py` (`stream_run` TTL detection branch)

**Issue:** `stream_run` checks `redis.exists(f"run:{run_id}")` and on True falls through to `replay_tail_consumer`. If the producer finalizes between the `exists` probe and the consumer's first `xread`, and the EXPIRE 60s window then races to TTL=0 (extreme but possible under clock skew), the consumer enters the live-tail loop and BLOCKs in 5s windows until the deadline (`run_hard_timeout_seconds + 10`) fires the synthetic `consumer_timeout` error event. From the client's perspective: instead of receiving the synthetic `done`/`cancelled`/`error` per D-062-06, they wait for the full hard-timeout deadline before getting a generic `consumer_timeout`. Behavioral contract drift, not a crash.

**Fix:** When `xread` returns empty during the live-tail BLOCK loop AND `redis.exists(stream_key) == 0`, exit via `_synthetic_terminal_generator` semantics — re-fetch `runs.status` and emit the mapped terminal type. Or bound the live-tail deadline more aggressively when the buffer was already proven to exist but went away mid-stream.

### WR-03 — Malformed `?since=` raises unhandled RedisError → silent SSE drop

**File:** `backend/app/api/runs.py` (`replay_tail_consumer` xread call)

**Issue:** `since: str = "0"` accepts any string. Redis XREAD requires `<ms>-<seq>` / `0` / `$`; anything else raises `ResponseError` (subclass of `RedisError`). In `replay_tail_consumer`, the `xread` call sits OUTSIDE the per-entry `try/except BaseException` block, so a malformed `since` on the first iteration raises into the generator's outer `try` whose `finally` is just `pass`. The exception propagates to EventSourceResponse, which closes the response mid-stream after sending HTTP 200 + zero events. Client sees a 200 with no `data:` lines — no terminal sentinel, no error event. This contradicts the D-062-07 "any string accepted; replay starts from earliest matching entry" contract documented in the route comment.

**Fix:** Validate `since` at the route boundary — reject malformed input with 422, OR catch `RedisError` in `replay_tail_consumer` and yield a synthetic `{"type":"error","error":"invalid_since"}` event before returning.

### WR-04 — Concurrent DELETE → both paths execute zombie heal twice

**File:** `backend/app/api/runs.py` (`cancel_run`)

**Issue:** Two concurrent DELETEs on the same `run_id` can both pass the ownership SELECT, both find `runs.status == "streaming"` and `RUN_TASKS` empty, and both execute the full zombie-heal sequence (UPDATE, XADD synthetic terminal, ZREM × 2, EXPIRE). UPDATE and ZREM are idempotent; the duplicate XADD adds a *second* `cancelled`+`zombie_healed` sentinel to the stream. Any consumer attached to that stream observes two `cancelled` events — but the consumer breaks on the first per `TERMINAL_TYPES`, so it disconnects after #1. The second sentinel is consumed only by parallel late-attaching consumers, which still terminate cleanly.

**Real impact:** Minor — duplicate sentinel is not user-visible. But the racy double-write is a code smell and could surface as test flakes if assertion counts get tight.

**Fix:** Optional. If you want strict "one sentinel per cancel", gate XADD on a Redis `SETNX run:{run_id}:cancel_lock` with short TTL, or accept the duplication and document it.

### WR-05 — `replay_tail_consumer` silently drops events if `fields["data"]` is missing

**File:** `backend/app/api/runs.py` (`replay_tail_consumer` payload yields)

**Issue:** `yield {"data": fields["data"]}` then `payload = json.loads(fields["data"])`. If a producer (or future migration) writes an entry whose payload doesn't have a `data` field, the `KeyError` is caught by `except BaseException`, logged, and re-raised. The consumer dies with a partial response — no terminal event.

This is exactly the behavior in the existing `event_consumer` so it's not a regression, but it's a fragile contract: any future XADD that forgets the `{"data": ...}` envelope kills the SSE stream silently.

**Fix:** Defensive `.get("data")` with a synthetic error event on missing key, OR add a producer-side assertion in `_emit`/`_emit_terminal` that the payload has `"data"`.

### WR-06 — Tests sequence-override `runs_builder.execute.side_effect` after producer is in-flight

**Files:**
- `backend/tests/integration/test_062_stream_replay.py`
- `backend/tests/integration/test_062_delete_happy.py`
- `backend/tests/integration/test_062_multi_consumer_fanout.py`

**Issue:** After the POST spawns a real producer, the test reassigns `runs_builder.execute.side_effect` to return a streaming-row dict. The same MagicMock is shared with the still-running producer, so the producer's `_shielded_finalize` UPDATE call now receives the streaming-row dict instead of the original `_make_result([])`. The producer doesn't read the result body for UPDATEs, so it works in practice — but the test silently mutates the contract for the producer mid-flight.

This isn't a production bug, but it's a fragile test pattern: any future producer code that *does* inspect `update.execute()` data could fail nondeterministically depending on scheduling.

**Fix:** Wrap the side_effect to dispatch by op (insert vs select vs update) rather than overwriting wholesale.

---

## Info

### IN-01 — Magic numbers should be module constants

**File:** `backend/app/api/runs.py`

**Issue:** Hardcoded `2.0` (Redis exists timeout), `"10"` (Retry-After), `60` (zombie-heal EXPIRE) are scattered across the route body. Each has a comment justifying the choice, but a constant block at module-top would centralize them and let ops tune via env without code changes.

**Fix:** Extract to module-level constants or wire through `settings`.

### IN-02 — Untyped `redis` and `settings` parameters in `replay_tail_consumer`

**File:** `backend/app/api/runs.py`

**Issue:** Signature is `async def replay_tail_consumer(redis, run_id: UUID, since: str, settings)` — `redis` and `settings` are untyped. The comparable `event_consumer` in `threads.py` has the same issue (so this is consistency, not a regression).

**Fix:** `redis: aioredis.Redis, ..., settings: Settings` for type-checker support.

### IN-03 — `task.cancel()` return value ignored

**File:** `backend/app/api/runs.py`

**Issue:** `task.cancel()` returns `False` if the task is already done. The check `not task.done()` precedes the call, but there's a small TOCTOU window. Calling `.cancel()` on a done task is safe, so this is benign.

**Fix:** One-line clarifying comment.
