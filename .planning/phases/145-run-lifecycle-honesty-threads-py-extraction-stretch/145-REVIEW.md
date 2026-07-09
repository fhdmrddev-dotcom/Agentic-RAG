---
phase: 145-run-lifecycle-honesty-threads-py-extraction-stretch
reviewed: 2026-07-09T15:27:17Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - backend/app/services/run_lifecycle.py
  - backend/app/services/run_reconciler.py
  - backend/app/api/threads.py
  - backend/app/api/runs.py
  - backend/app/config.py
  - backend/app/main.py
  - backend/tests/test_run_lifecycle.py
  - backend/tests/test_run_reconciler.py
  - backend/tests/test_cancel_run.py
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts
  - frontend/src/__tests__/providers/StreamsProvider.transient.test.ts
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: resolved
resolved: 2026-07-09
---

> **RESOLUTION (2026-07-09):** All 5 findings fixed + tested, atomic commits on `develop`:
> CR-01 `47ccbf67` (best-effort mirror ZADDs) · CR-02 `06035f6b` (start-grace `run_start_grace_seconds`=60s vs the missing-stream false-kill) · WR-01 `11080aa4` (watchdog derives honest persisted status) · WR-02 `b817fd30` (config bounds validator) · IN-01 `a7b64365` (dead imports). New regression tests: best-effort-ZADD, fresh-run-not-swept, watchdog-honest-status. 19 backend unit + watchdog/transient vitest green, no new regressions. Two logic changes (CR-02 60s grace vs slow-model TTFT; WR-01 snapshot enrichment) flagged for the operator's live UAT eyeball.

# Phase 145: Code Review Report

**Reviewed:** 2026-07-09T15:27:17Z
**Depth:** standard
**Files Reviewed:** 11 (StreamsProvider.transient.test.ts included in scope but only skimmed — no new findings there beyond what's covered by the watchdog test)
**Status:** issues_found

## Summary

Phase 145 does three things: (1) a new `run_lifecycle.py` owner that atomically co-writes Postgres `runs.status` with the Redis `runs:active`/`runs_by_thread` mirrors; (2) re-points `threads.py`'s chat-run start/finalize and `runs.py`'s cancel zombie-heal onto that owner; (3) a stream-age staleness sweep in `run_reconciler.py`, plus a frontend reconcile-derived `streamingThreads` + inactivity watchdog in `StreamsProvider.tsx`.

The mechanism swap itself is faithful to the stated design (Postgres-authoritative, Redis-derived-mirror, status-before-sentinel-before-EXPIRE ordering is preserved, `cap_paused` correctly stays out of the atomic-terminal path in both the continuation and reconciler code). The unit tests for the new owner and the reconciler's stream-age predicate are solid and match their stated intent.

However, tracing the two areas the phase intent explicitly flagged as high-risk — (a) co-write atomicity/ordering and (b) the stream-age sweep's false-kill risk — turned up two real correctness regressions that the new test suite does not cover:

1. A transient Redis failure during `register_run_start`'s mirror ZADDs now escalates into a hard `raise` that propagates out of `POST /threads/{id}/messages`, turning a previously best-effort/non-fatal mirror write into a user-facing 500 and a "failed" run — a resilience regression versus the pre-145 code, which treated ZADD failures as best-effort ("continuing").
2. The periodic stream-age sweep's "missing stream ⇒ orphan" branch has no grace period tied to `runs.started_at`. A brand-new run (especially the first message of a new thread, which synchronously blocks on title generation before the producer task is even created) can have its Postgres row flipped to `failed` and its Redis stream deleted by a sweep tick that fires in the window between `register_run_start` and the producer's first `_emit`. This is a live, exercisable false-kill of a legitimately-just-started run — precisely the class of bug the phase exists to eliminate.

Also flagged: a frontend design tradeoff (documented, but worth a second look) that mislabels a failed/cancelled/timed_out run as "completed" during the watchdog's silent finalize, two dead imports left behind by the extraction, and a missing bounds-check on the two new stale-sweep settings.

## Critical Issues

### CR-01: Redis mirror-write failure during run start now hard-fails the send, instead of degrading gracefully

**File:** `backend/app/services/run_lifecycle.py:76-90`, `backend/app/api/threads.py:1119-1147`

**Issue:**

Pre-145, `threads.py` inserted the `runs` row and then ZADDed the two mirrors in a *separate* `try/except` that only logged on failure:

```python
# pre-145 (see `git diff 864f01d3..HEAD -- backend/app/api/threads.py`)
await insert_run(...)
try:
    await redis.zadd(f"runs_by_thread:{thread_id}", {...})
    await redis.zadd("runs:active", {...})
except Exception:
    logger.exception("ZADD failed for run %s; continuing (passive cleanup at query time)", run_id)
```
A Redis hiccup during the ZADD left the run genuinely `streaming` in Postgres and the request succeeded normally.

Post-145, `register_run_start` performs the INSERT and both ZADDs with **no exception handling at all**:

```python
# backend/app/services/run_lifecycle.py:77-90
await insert_run(pool, run_id=run_id, ..., status=status, ...)
_score = time.time()
await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _score})
await redis.zadd(_ACTIVE_SET_KEY, {str(run_id): _score})
```

and the call site in `threads.py` treats *any* exception from `register_run_start` — including a pure-Redis `ZADD` failure that has nothing to do with the Postgres INSERT already having succeeded — as total spawn failure:

```python
# backend/app/api/threads.py:1119-1147
try:
    await register_run_start(...)
except Exception:
    try:
        await finalize_run_terminal(..., status="failed", error="spawn_failed", ...)
    except Exception:
        logger.exception("Failed to finalize spawn-failed run %s", run_id)
    raise   # <-- propagates out of send_message; nothing else in the handler catches it
```

Because nothing higher up in `send_message` catches this `raise`, a transient Redis blip during the ZADD now produces an unhandled exception → FastAPI's default 500 handler → the user sees "an error occurred," their message is already persisted, and the run row is churned from `streaming` → `failed` for a purely-cosmetic mirror-write failure. This directly contradicts the project's own best-effort-Redis posture used everywhere else in this same file (e.g. every other Redis op around the finalizer is wrapped in its own `try/except BaseException: logger.exception(...)`).

Not covered by `test_register_cowrites_status_and_active` (`backend/tests/test_run_lifecycle.py`) — that test only exercises the success path; there is no test that a `redis.zadd` failure post-INSERT does *not* fail the whole request.

**Fix:** Keep the Postgres INSERT as the fatal, authoritative write, but make the two mirror ZADDs best-effort inside the owner (matching the module's own stated authority model — "Postgres `runs.status` is AUTHORITATIVE… `runs:active` is a DERIVED mirror"):

```python
await insert_run(pool, run_id=run_id, thread_id=thread_id, user_id=user_id,
                  status=status, model=model, provider=provider,
                  spawned_by_worker=spawned_by_worker, parent_run_id=parent_run_id)
_score = time.time()
try:
    await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _score})
    await redis.zadd(_ACTIVE_SET_KEY, {str(run_id): _score})
except Exception:
    logger.exception("register_run_start: mirror ZADD failed for run %s (status write already succeeded; continuing)", run_id)
```
Add a regression test that seeds a `redis.zadd` that raises and asserts `register_run_start` does NOT raise (Postgres row stays `streaming`, request still returns 201).

---

### CR-02: Periodic stream-age sweep can false-kill a run that hasn't written its first stream event yet

**File:** `backend/app/services/run_reconciler.py:190-266` (`_reconcile_chat_runs` / `_is_chat_orphan`)

**Issue:**

`_reconcile_chat_runs` selects every non-terminal `runs` row with no notion of how recently it started:

```python
rows = await pool.fetch(
    "SELECT run_id, thread_id FROM runs WHERE status = ANY($1::text[])",
    statuses,
)
```

and `_is_chat_orphan` treats a **missing** Redis stream as an *immediate* orphan, with no minimum-age check at all:

```python
try:
    info = await redis.xinfo_stream(f"run:{run_id}")
except ResponseError as e:
    if "no such key" in str(e).lower():
        return True     # missing stream + non-terminal PG row = orphan (Pitfall 5)
    raise
```

Compare this with the *stale*-stream branch, which correctly requires `STALE_TIMEOUT` (2400s) of silence before flipping a run. The *missing*-stream branch requires **zero** seconds of silence — a run whose stream has simply not been created yet is treated identically to a stream that was genuinely GC'd/expired.

There is a real, non-zero window where this fires on a live run: `register_run_start` (Postgres INSERT + mirror ZADDs) happens in `send_message` *before* the auto-title-generation block, which makes a real (albeit budget-capped) blocking LLM call via `run_in_threadpool(generate_thread_title, ...)` for the first message of every new thread (`threads.py:1183-1221`), and *before* `agent_runner` is even spawned as a task (`threads.py:1825`). The producer's first `_emit()` (the first `XADD` that creates `run:{run_id}`) only happens once `agent_runner` starts, resolves the provider client, and the LLM returns its first stream event/token. For the first message of a new thread this window is very plausibly 1-5+ seconds (title-gen network round-trip + LLM time-to-first-token), and it also applies uniformly to every other non-terminal `runs` row lacking a stream yet (including `task`-tool sub-agent rows inserted by `task_service.py`, which are also swept by this same unscoped query).

If the periodic sweep (`main.py:_reconcile_orphans_periodic`, every `run_stale_sweep_interval_seconds` = 120s) happens to tick during that window for any given run, `_is_chat_orphan` returns `True` immediately, and the row is finalized `failed` + its (about-to-exist) Redis stream key is deleted via `_drop_stream`, all while the real producer is still alive and about to start streaming. This is exactly the "false-kill risk" the phase intent calls out as a top review priority — the missing-stream branch is the one path in the whole sweep with no timing safeguard whatsoever.

The existing test `test_missing_stream_is_orphan` (`backend/tests/test_run_reconciler.py:322-337`) locks in the current (unsafe) behavior — it asserts a missing stream is *always* an orphan, with no `started_at` grace period exercised or asserted.

**Fix:** Select `started_at` alongside `run_id`/`thread_id` and require a minimum grace period before treating a missing stream as orphan (e.g. reuse `stale_timeout_ms`, or a much smaller floor like 30-60s, whichever is more appropriate for the real title-gen + provider-TTFT latency budget):

```python
rows = await pool.fetch(
    "SELECT run_id, thread_id, started_at FROM runs WHERE status = ANY($1::text[])",
    statuses,
)
...
async def _is_chat_orphan(redis, run_id, stale_timeout_ms, started_at, now_ms) -> bool:
    grace_ms = min(stale_timeout_ms, 30_000)  # or a dedicated setting
    if now_ms - _to_ms(started_at) < grace_ms:
        return False  # too young to judge — the producer may not have emitted yet
    try:
        info = await redis.xinfo_stream(f"run:{run_id}")
    except ResponseError as e:
        if "no such key" in str(e).lower():
            return True
        raise
    ...
```
Add a test seeding a row whose `started_at` is "now" with no stream yet and assert it is **not** flipped, alongside the existing `test_missing_stream_is_orphan` (which should seed an old `started_at`).

## Warnings

### WR-01: Watchdog's silent finalize always labels a missed-terminal run "completed", even if it actually failed/cancelled/timed out

**File:** `frontend/src/providers/StreamsProvider.tsx:2704-2725`

**Issue:** `finalizeThreadSilently` unconditionally flips any `runStatus === "streaming"` placeholder to `runStatus: "completed"` once the watchdog's read-only probe (`snapshot.active_runs.some(r => r.status === "streaming")`) returns false:

```tsx
useStreamsStore.getState().actions.setMessagesForBucket("chat", threadId, (prev) =>
  prev.map((m) =>
    m.role === "assistant" && m.runStatus === "streaming"
      ? { ...m, runStatus: "completed" as const }
      : m,
  ),
)
```

This is a documented, intentional tradeoff (145-05-SUMMARY.md: "if the run actually errored, the next tab-focus/reconcile hydrates the true persisted status from `snapshot.messages`"), and it is self-healing on the next reconcile. But it means a run that genuinely failed/was cancelled/timed out while its owning thread was in the background (not the actively-viewed thread — the watchdog sweeps ALL of `streamingThreads`, not just the viewed thread) is shown to the user as a normal, successful "completed" turn with no error, for however long until the next reconcile (page reload, tab focus, or thread navigation) happens to touch that thread. Given the phase's stated goal is *lifecycle honesty*, silently mislabeling a failure as a success — even temporarily — cuts against that goal more than the "no banner" framing suggests, especially for a background thread the user may not revisit soon.

**Fix:** The `ThreadSnapshot` already carries `messages` with each assistant row's `run_status` (via `_enrich_messages_with_runs`). Consider using that inline data (already fetched by the same `getSnapshot` call in `probeThread`) to pick the terminal status honestly instead of hardcoding `"completed"`:

```tsx
const persistedMsg = snapshot.messages.find((m) => m.runId === /* the run id for this thread's placeholder */)
const finalStatus = persistedMsg?.runStatus ?? "completed"
```
At minimum, note the tradeoff more visibly (e.g. in a code comment near the flip) so a future reader doesn't assume the flip is always correct.

### WR-02: New stale-sweep settings have no bounds validation, unlike the sibling `LLM_CALL_TIMEOUT_OVERRIDES` pattern

**File:** `backend/app/config.py:996-997`

**Issue:** `run_stale_sweep_timeout_seconds` (2400s default) and `run_stale_sweep_interval_seconds` (120s default) are plain `int` fields with no min/max guard:

```python
run_stale_sweep_timeout_seconds: int = 2400
run_stale_sweep_interval_seconds: int = 120
```

The surrounding docstring explicitly warns "do not lower without re-checking that ceiling" — i.e. the authors already know a misconfigured low value is dangerous (it would kill legitimately-waiting `ask_user` runs or long reasoning turns). Yet unlike `LLM_CALL_TIMEOUT_OVERRIDES` in the same file (`_LLM_CALL_TIMEOUT_MIN_S`/`_LLM_CALL_TIMEOUT_MAX_S`, with an explicit rationale: "Operator misconfiguration to 0 / negative integer would cause the per-call timer to fire instantly… (DoS)"), these two new settings have no analogous defense-in-depth check. An operator env-var typo (e.g. `RUN_STALE_SWEEP_INTERVAL_SECONDS=0`) would spin the periodic sweep in a tight loop hammering Redis SET NX + Postgres; a typo on the timeout (e.g. missing a zero, `RUN_STALE_SWEEP_TIMEOUT_SECONDS=240`) would silently start killing every run that goes quiet for 4 minutes, including any `ask_user`-waiting run.

**Fix:** Add a `model_validator` (the file already uses `pydantic.model_validator` elsewhere) that clamps or rejects out-of-range values for both fields, mirroring the `_LLM_CALL_TIMEOUT_MIN_S`/`_MAX_S` pattern — e.g. reject `run_stale_sweep_interval_seconds < 5` and `run_stale_sweep_timeout_seconds < ask_user_max_timeout_seconds`.

## Info

### IN-01: Two dead imports left behind by the extraction in `threads.py`

**File:** `backend/app/api/threads.py:5`, `backend/app/api/threads.py:41`

**Issue:** `import time as time_mod` (line 5) and `insert_run` from `from app.db.runs import insert_run, finalize_run, insert_assistant_message` (line 41) are no longer referenced anywhere in the file as actual calls — both usages moved into `run_lifecycle.py` as part of this phase's extraction (`time_mod.time()` → `time.time()` inside the owner; the direct `insert_run(...)` call site → `register_run_start(...)`). Confirmed via `grep -n "time_mod\."` and `grep -n "insert_run("` against the file: zero call-site matches, only comment references remain. `finalize_run` is still legitimately used at `threads.py:2213` (the `cap_paused` branch), so only `insert_run` needs dropping from that import line.

**Fix:**
```python
# remove line 5: import time as time_mod
# line 41 becomes:
from app.db.runs import finalize_run, insert_assistant_message
```

---

_Reviewed: 2026-07-09T15:27:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
