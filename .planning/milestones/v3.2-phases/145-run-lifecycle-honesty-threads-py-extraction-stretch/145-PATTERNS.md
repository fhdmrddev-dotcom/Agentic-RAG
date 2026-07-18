# Phase 145: Run-Lifecycle Honesty + threads.py Extraction - Pattern Map

**Mapped:** 2026-07-09
**Files analyzed:** 10 (2 NEW backend, 1 NEW frontend, 1 maybe-NEW backend test, 6 MODIFIED)
**Analogs found:** 10 / 10 (every file has a shipped in-repo analog — this is a pure "mirror an existing module's shape" phase)

> This is a CODE-EXTRACTION phase. The dominant instruction to the planner is
> **"copy the shape of a shipped, tested module"** — almost nothing here is
> net-new machinery (RESEARCH "Don't Hand-Roll"). Every line ref below was
> RE-VERIFIED against the live files this session; where a RESEARCH ref drifted
> by a line or two the VERIFIED number is used.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/run_lifecycle.py` **(NEW)** | service | event-driven (co-write) | `backend/app/services/run_reconciler.py` | exact (DI shape + best-effort + `finalize_run` reuse) |
| `backend/tests/test_run_lifecycle.py` **(NEW)** | test | transform (assert co-write) | `backend/tests/test_run_reconciler.py` | exact (`_FakePool`/`_FakeRedis` in-memory fakes) |
| `frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts` **(NEW)** | test | event-driven (timer) | `frontend/src/__tests__/providers/StreamsProvider.transient.test.ts` | exact (`vi.mock('@/lib/api')` + `getSnapshot` mock) |
| `backend/tests/test_cancel_run.py` **(maybe NEW)** | test | request-response | `backend/tests/test_run_reconciler.py` + `_FakePool` | role-match |
| `backend/app/services/run_reconciler.py` **(MOD)** | service | event-driven (sweep) | itself (`_is_orphan` predicate swap) | self |
| `backend/app/main.py` **(MOD)** | config/bootstrap | batch (interval) | `_sweep_expired_templates` (`main.py:302-314`) | exact (same-file precedent) |
| `backend/app/api/threads.py` **(MOD, extraction source)** | controller | streaming (SSE producer) | `run_reconciler.py` (destination shape) | n/a — donor |
| `backend/app/api/runs.py` **(MOD, cancel parity)** | controller | request-response | `run_lifecycle.finalize_run_terminal` (new) | role-match |
| `backend/app/config.py` **(MOD)** | config | — | `ask_user_max_timeout_seconds:979` / `llm_call_timeout_seconds:212-220` | exact (sibling settings) |
| `frontend/src/providers/StreamsProvider.tsx` **(MOD)** | provider | event-driven (SSE + timer) | its own transient-reconcile plumbing (`:194-278`, `:2591-2616`) | self |

---

## The Extraction Seam (the heart of D-145-09)

**What MOVES out of `threads.py` → into `run_lifecycle.py`** (VERIFIED line refs):

| Concern | Current site in `threads.py` | Lands in |
|---------|------------------------------|----------|
| START register: `insert_run(status='streaming')` | `:1108-1117` | `register_run_start()` |
| START register: `ZADD runs_by_thread` + `ZADD runs:active` | `:1122-1127` | `register_run_start()` (same atomic unit) |
| SPAWN-FAIL cleanup: `status='failed'` + `ZREM` ×2 | `:1128-1142` | `finalize_run_terminal(status='failed')` |
| Deep TERMINAL: `finalize_run(...)` | `:1684-1693` | `finalize_run_terminal()` |
| Deep TERMINAL: `ZREM runs:active` + `ZREM runs_by_thread` | `:1719-1724` | `finalize_run_terminal()` |
| Continuation TERMINAL: `finalize_run(...)` | `:2176-2188` | `finalize_run_terminal()` |
| Continuation TERMINAL: `ZREM` ×2 (skipped for `cap_paused`) | `:2205-2212` | `finalize_run_terminal()` |
| Cancel zombie-heal terminal (parity, D-145-14) | `runs.py:1176-1183` (UPDATE) + `:1246-1257` (ZREM) | `finalize_run_terminal(status='cancelled')` |

**What STAYS in `threads.py`** (transport/read, NOT lifecycle-status):
- `_emit` / `_emit_terminal` XADD helpers (`:152-183`) — SSE stream transport.
- The terminal sentinel XADD (`:1706-1710`) + `EXPIRE run:{id}` (`:1712-1717`, TTL 600/60) — SSE-ordering, Pitfall 2. Keep in the producer's `_finalize`; the owner should NOT swallow these.
- `get_snapshot` (`:364-489`) — the reconcile READ of `runs.status`; untouched.
- `RUN_TASKS` registry + cancel wiring (cancel verb lives in `runs.py`).

**Key ordering constraint to preserve** (Deep terminal, `:1684-1724`): the shipped
5-step order is `finalize_run` (status) → terminal sentinel XADD → EXPIRE → ZREM ×2.
The extracted `finalize_run_terminal` owns **step 1 (status) + step 5 (ZREM)** as one
unit; steps 2-4 (sentinel/EXPIRE) stay in the producer AFTER the owner call. Do not
reorder — the sentinel-after-status race fix (Plan 075.4-03) depends on status landing first.

---

## Pattern Assignments

### `backend/app/services/run_lifecycle.py` (service, event-driven co-write) — NEW

**Analog:** `backend/app/services/run_reconciler.py` (structure, DI, best-effort, `finalize_run` reuse)
**Terminal writer to REUSE:** `backend/app/db/runs.py:finalize_run` (`:69-109`)
**Start writer to REUSE:** `backend/app/db/runs.py:insert_run` (`:26-66`)

**Module-header / imports pattern** (mirror `run_reconciler.py:42-71`):
```python
from __future__ import annotations
import logging
from datetime import datetime  # timezone only if the owner stamps completed_at
from app.db.runs import finalize_run, insert_run
logger = logging.getLogger(__name__)

# Reuse the exact key constants the reconciler already names (run_reconciler.py:59-66)
_ACTIVE_SET_KEY = "runs:active"
# runs_status_check enum: streaming / cap_paused / completed / failed / cancelled / timed_out
```

**DI signature pattern — the unit-test seam** (mirror `reconcile_orphaned_runs(*, pool, redis, supabase)`, `run_reconciler.py:74`). RESEARCH U5 proposed API, VERIFIED against `db/runs.py` signatures:
```python
async def register_run_start(*, pool, redis, run_id, thread_id, user_id,
                             model, provider, spawned_by_worker=None,
                             parent_run_id=None, status="streaming") -> None:
    """Atomic co-write: insert_run(status) + ZADD runs:active + ZADD runs_by_thread.
    Invariant on success: run_id ∈ runs:active  ⇔  runs.status == 'streaming'."""

async def finalize_run_terminal(*, pool, redis, run_id, thread_id, status, error,
                                completed_at, message_id=None,
                                input_tokens=None, output_tokens=None) -> None:
    """Atomic co-write: db.runs.finalize_run(status=terminal) + ZREM runs:active
    + ZREM runs_by_thread. Reused by threads.py (Deep + continuation), runs.py cancel
    zombie-heal, and run_reconciler.py. Invariant: terminal status ⇔ absent from runs:active."""
```
> Note: `insert_run` takes `pool` positionally then keyword-only params
> (`db/runs.py:26`); `finalize_run` is `finalize_run(pool, *, run_id, status, error,
> completed_at, message_id, input_tokens, output_tokens)` (`db/runs.py:69-79`). Match
> these EXACTLY so the co-writer is a thin wrapper, not a re-implementation.

**Core co-write pattern (terminal)** — the anti-drift core (Pattern 1). Copy the
terminal shape verbatim from `threads.py:1684-1724`, collapsing status+ZREM into one fn:
```python
# finalize_run_terminal body
await finalize_run(pool, run_id=run_id, status=status, error=error,
                   completed_at=completed_at, message_id=message_id,
                   input_tokens=input_tokens, output_tokens=output_tokens)  # db/runs.py:69
await redis.zrem(_ACTIVE_SET_KEY, str(run_id))
await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
```

**Core co-write pattern (start)** — copy from `threads.py:1108-1127`:
```python
# register_run_start body
await insert_run(pool, run_id=run_id, thread_id=thread_id, user_id=user_id,
                 status=status, model=model, provider=provider,
                 spawned_by_worker=spawned_by_worker, parent_run_id=parent_run_id)
_score = time.time()   # started_at unix score (threads.py:1122)
await redis.zadd(f"runs_by_thread:{thread_id}", {str(run_id): _score})
await redis.zadd(_ACTIVE_SET_KEY, {str(run_id): _score})
```

**Error-handling pattern** — the producer wraps these in its own try/except today
(`threads.py:1128-1142` spawn-fail, `:1694-1695` finalize log). Decision for the
planner: the owner should stay THIN (let callers own best-effort framing) so the
`threads.py` producer keeps its existing "log-and-continue per Redis op" discipline
(`:1716`, `:1723`), and the reconciler keeps its per-row try/except (`run_reconciler.py:169-186`).

**Docstring must state the chat-scoped invariant** (RESEARCH Runtime State Inventory):
`runs:active == {status='streaming'}` holds for **chat/Deep runs only** this phase —
the 5 eval/tuner writers are NOT migrated (D-145-12). A future reader must not assume
a global invariant.

---

### `backend/tests/test_run_lifecycle.py` (test, assert atomic co-write) — NEW

**Analog:** `backend/tests/test_run_reconciler.py` (`_FakePool`/`_FakeRedis`/`_FakeSupabase` at `:34-136`)

**Fixture pattern — REUSE the in-memory fakes verbatim.** `_FakePool` already records
`executed: list[(sql, params)]` (`test_run_reconciler.py:124-136`); `_FakeRedis` already
honors `set(nx)`/`zscore`/`delete`/`zrem` (`:34-71`). For `register_run_start` you must
extend `_FakeRedis` with a `zadd` recorder (the existing fake only has `zrem`):
```python
# add to _FakeRedis (mirror the zrem shape at test_run_reconciler.py:67-71)
async def zadd(self, key, mapping, *a, **k):
    z = self.active if key == "runs:active" else self.by_thread.setdefault(key, {})
    z.update({str(m): s for m, s in mapping.items()})
    return len(mapping)
```

**Atomicity assertion pattern** (RESEARCH deterministic recipe, D-145-02/09):
```python
# assert BOTH the status write AND the mirror write fired for the SAME run_id in ONE call
n_before = len(pool.executed)
await finalize_run_terminal(pool=pool, redis=redis, run_id=run_id, thread_id=tid,
                            status="completed", error=None, completed_at=now, ...)
assert len(pool.executed) == n_before + 1          # finalize_run → pool.execute
assert params_of(pool.executed[-1])[1] == "completed"   # status is $2 (db/runs.py:91-101)
assert str(run_id) not in redis.active             # ZREM ran on the same run_id
```
**Header docstring style:** copy the 4-bullet "Proves the N load-bearing behaviors"
format from `test_run_reconciler.py:1-25`.

**Test-map targets** (from RESEARCH Validation Architecture, author each `@pytest.mark.asyncio`):
- `test_register_cowrites_status_and_active` — insert + ZADD ×2 fired together.
- `test_finalize_cowrites_terminal_and_zrem` — `finalize_run` status + ZREM ×2 fired together.

---

### `frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts` (test, fake-timer) — NEW

**Analog:** `frontend/src/__tests__/providers/StreamsProvider.transient.test.ts` (whole file)

**Mock-boundary pattern — copy verbatim** (`transient.test.ts:27-63`):
```typescript
const { mockGetSnapshot } = vi.hoisted(() => ({ mockGetSnapshot: vi.fn() }))
vi.mock("@/lib/api", () => ({
  getSnapshot: mockGetSnapshot,
  getMessages: vi.fn(), postMessage: vi.fn(), subscribeToRun: vi.fn(),
  getActiveRuns: vi.fn(), cancelRun: vi.fn(),
}))
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn()... } } }))
// IMPORT AFTER the mocks (transient.test.ts:60)
```

**Snapshot factory pattern — copy** `snapshotWithRun(streaming)` (`transient.test.ts:68-76`):
returns `active_runs: [{run_id, started_at, status:"streaming"}]` (or `[]` for terminal)
+ `since_cursors`.

**Fake-timer watchdog pattern** (NEW — RESEARCH recipe): `vi.useFakeTimers()`, mock
`getSnapshot` → `active_runs: []` (terminal), `vi.advanceTimersByTime(N*1000)`, assert
`streamingThreads` no longer holds the thread and the placeholder `runStatus` flipped.
Mirror the existing `mockGetSnapshot.mockResolvedValueOnce(...)` + `expect(...).toBe(snap)`
assertion style (`transient.test.ts:87-99`).

**Test-map targets:** `watchdog silent-finalizes on terminal snapshot` (D-145-03/04),
`watchdog no-ops while streaming` (D-145-03), `reconcile clears streamingThreads on
terminal snapshot` (Pattern 2 / U7), `transient reattach keeps streamingThreads`
(D-145-10 — extend the existing `.transient.test.ts` rather than duplicate).

---

### `backend/tests/test_cancel_run.py` (test, cancel parity) — MAYBE NEW

**Analog:** `test_run_reconciler.py` `_FakePool`/`_FakeRedis` (`:34-136`)
**Target (D-145-14):** cancel happy-path / zombie-heal routes its terminal through
`finalize_run_terminal('cancelled')` → assert `pool.execute` (status='cancelled') AND
`redis` ZREM ×2 both fired. Same atomicity-assertion recipe as `test_run_lifecycle.py`.
Grep first for an existing cancel test before creating (RESEARCH flags "if not present").

---

### `backend/app/services/run_reconciler.py` (service, sweep) — MODIFIED

**The predicate swap (the crux of D-145-06).** REPLACE the membership oracle:

**Current** (`:190-198`) — becomes UNSAFE under D-145-02 (a genuine orphan is now
PRESENT in the mirror):
```python
async def _is_orphan(redis, run_id) -> bool:
    score = await redis.zscore(_ACTIVE_SET_KEY, str(run_id))
    return score is None
```
**New** — stream-age oracle (RESEARCH U3; use `XINFO STREAM last-generated-id`):
```python
async def _is_orphan(redis, run_id) -> bool:
    """Orphan iff the run:{id} stream is MISSING or its last event is older than
    STALE_TIMEOUT. Stream-age, not membership (D-145-02 makes membership blind)."""
    try:
        info = await redis.xinfo_stream(f"run:{run_id}")   # already used threads.py:449
    except ResponseError as e:
        if "no such key" in str(e).lower():
            return True     # missing stream + non-terminal PG row = orphan (Pitfall 5)
        raise               # real fault → per-row handler SKIPS (Pitfall 6)
    last_id = info.get("last-generated-id")
    last_ms = int((last_id.decode() if isinstance(last_id, bytes) else last_id).split("-")[0])
    sec, usec = await redis.time()          # Redis clock, no app↔Redis skew (Pitfall 4)
    now_ms = sec * 1000 + usec // 1000
    return (now_ms - last_ms) > STALE_TIMEOUT_MS
```
- **Preserve the safe-default:** a raised exception propagates to the per-row handler
  which logs + SKIPS (`_reconcile_chat_runs:169-186` / `_reconcile_eval_runs:126-147`);
  NEVER flip on unverifiable liveness (Pitfall 6, docstring `:194-195`).
- **The `no such key` handling already exists** in `get_snapshot` (`threads.py:452-466`)
  and `_drop_stream` (`:201-208`) — copy that recognition.
- **`cap_paused` edge** (Pitfall 3 / Open Q2): `_NON_TERMINAL_CHAT_STATUSES` includes
  `cap_paused` (`:66`). A legitimately-paused Continue run has a quiet stream — EXCLUDE
  `cap_paused` from the PERIODIC sweep (keep boot behavior), or the sweep kills re-attachable runs.
- **Docstring rewrite:** the module docstring lines `:24-28`/`:59-61` call `runs:active`
  "the AUTHORITATIVE streaming set" — that is now false (D-145-01 makes `runs.status`
  authoritative). Rewrite to name stream-age as the oracle.

**Periodic-invocation support:** `reconcile_orphaned_runs` already SET-NX-guards
(`:83-88`, key `run_reconcile_lock`, TTL `_RECONCILE_LOCK_TTL_S=300`). For the periodic
call the guard TTL should be SHORTER than the tick (~90s for a 120s tick) so exactly one
`WORKER_COUNT=2` worker sweeps per tick and the guard self-expires before the next tick
(RESEARCH U6). Consider a `lock_ttl` param so boot (300s) and periodic (90s) differ.

**`_FakeRedis` in the test must gain `xinfo_stream` + `time`** to cover stale/fresh/missing
cases (RESEARCH Wave 0 gap) — extend `test_run_reconciler.py:34-71`.

---

### `backend/app/main.py` (bootstrap, interval task) — MODIFIED

**Analog:** `_sweep_expired_templates` (`main.py:302-314`) — the same-file interval precedent.

**Interval-task pattern — copy the shape verbatim** (`:302-314`):
```python
async def _reconcile_orphans_periodic():
    while True:
        try:
            from app.services.run_reconciler import reconcile_orphaned_runs
            from app.dependencies import get_redis, get_supabase
            count = await reconcile_orphaned_runs(
                pool=await get_pg_pool(), redis=get_redis(), supabase=get_supabase())
            if count:
                logger.info("Periodic run reconciler closed %d orphan(s)", count)
        except Exception:
            logger.exception("Periodic run reconciler failed (app continues)")
        await asyncio.sleep(settings.run_stale_sweep_interval_seconds)   # ~120s
asyncio.create_task(_reconcile_orphans_periodic())
```
- **Note the two precedents in this same block:** the BOOT reconciler `_reconcile_orphans`
  is already here (`:280-292`, one-shot, no `while`); the template sweep `_sweep_expired_templates`
  (`:302-314`) is the INTERVAL shape (`while True` + `asyncio.sleep`). The periodic reconciler
  is literally "the boot reconciler wrapped in the template-sweep loop."
- **Do NOT fold into `harness_engine.resume_stranded_workflows`** (`:257-269`) — that is
  boot-only and re-drives workflows (wrong semantics; RESEARCH U6 anti-pattern).
- **Best-effort import-inside-the-fn** style is the house convention here (every lifespan
  task imports lazily inside its body: `:259-260`, `:282-283`, `:305-306`).

---

### `backend/app/api/threads.py` (controller, SSE producer — EXTRACTION SOURCE) — MODIFIED

**This file is the DONOR.** Replace the 4 inline lifecycle blocks with `run_lifecycle` calls:

| Replace block at | With |
|------------------|------|
| `:1108-1127` (insert_run + ZADD ×2) | `await register_run_start(pool=..., redis=redis, run_id=..., thread_id=..., user_id=..., model=_resolved_model, provider=_resolved_provider, spawned_by_worker=str(os.getpid()))` |
| `:1128-1142` (spawn-fail UPDATE + ZREM ×2) | `await finalize_run_terminal(..., status="failed", error="spawn_failed", ...)` |
| `:1684-1693` + `:1719-1724` (Deep finalize + ZREM ×2) | `await finalize_run_terminal(...)` — KEEP sentinel `:1706-1710` + EXPIRE `:1712-1717` in the producer AFTER the call |
| `:2176-2188` + `:2205-2212` (continuation finalize + ZREM ×2) | `await finalize_run_terminal(...)` — KEEP `cap_paused` skip logic: `cap_paused` is non-terminal (no ZREM, `:2205-2207`), so the owner must NOT be called for `cap_paused`, only for true terminals |

**Preserve verbatim** (do NOT move):
- `_emit` / `_emit_terminal` (`:152-183`), the terminal sentinel + EXPIRE (`:1697-1717`,
  `:2189-2204`), `get_snapshot` (`:364-489`), `RUN_TASKS`.
- The `_RUN_STATUS_TO_TERMINAL_TYPE` enum→SSE mapping (`:1707`, `:2191-2195`) — SSE
  transport, not lifecycle.

**`cap_paused` is the trap:** in the continuation path (`:2205-2212`) ZREM is GATED on
`_terminal_status != "cap_paused"` — a `cap_paused` run stays in the active sets
(re-attachable). The extracted `finalize_run_terminal` is only for TRUE terminals; call
it only when `_terminal_status != "cap_paused"`, mirroring the existing gate.

---

### `backend/app/api/runs.py` (controller, cancel parity) — MODIFIED

**Analog / target:** the new `run_lifecycle.finalize_run_terminal` (D-145-14 parity).

**Zombie-heal terminal → adopt the owner.** Today the zombie-heal writes status via a
**supabase-py UPDATE** (`:1176-1183`) then ZREMs ×2 (`:1246-1257`) — a DIFFERENT writer
than the producer's `db.runs.finalize_run`. For parity, route the zombie-heal chat-run
terminal through `finalize_run_terminal(status='cancelled', error='cancelled_by_user', ...)`.
```python
# current zombie-heal (runs.py:1176-1183) — supabase-py UPDATE, NOT finalize_run
await aexec(supabase.table("runs").update({
    "status": "cancelled", "error": "cancelled_by_user",
    "completed_at": datetime.now(timezone.utc).isoformat()}).eq("run_id", str(run_id)))
# ...later ZREM ×2 at :1246-1257
```
**Preserve:** the ownership SELECT (`:1107-1119`, 404-not-403 T-062-01), the already-terminal
204 short-circuit (`:1124-1125`), the happy-path `task.cancel()` + `publish_cancel_sentinel`
(`:1133-1155`), the synthetic sentinel + `cancel_lock` SETNX (`:1208-1241`), and the EXPIRE
(`:1259-1262`). The happy path already reaches the owner via the producer's `_shielded_finalize`
— only the **zombie-heal** branch needs the swap. Note the zombie-heal is a supabase-py
path while the owner is asyncpg-`pool`-based; the planner must thread a pool into the cancel
handler (it currently only has `supabase` + `redis` deps at `:1097-1101`).

**Do NOT add new cancel logic** (D-145-14) — the cancel path already works (RESEARCH U4).
The cross-worker gap (Open Q1) is flagged, NOT fixed here.

---

### `backend/app/config.py` (config settings) — MODIFIED

**Analog:** sibling int settings — `ask_user_max_timeout_seconds: int = 1800` (`:979`),
`llm_call_timeout_seconds` tier model (`:212-220`).

**Add two Settings fields** in the same `int`-with-comment style as the ask_user block
(`:974-982`):
```python
# Phase 145 (FND-01, D-145-06/07) — run staleness sweep (Direction B).
# STALE_TIMEOUT KILLS a dead-producer run → must EXCEED the longest legit silent gap
# of a LIVE producer: ask_user wait (ask_user_max_timeout_seconds=1800) > silent
# reasoning ceiling (900). Operator-ratified generous default = 2400s (40 min).
run_stale_sweep_timeout_seconds: int = 2400      # OPERATOR-RATIFIED (RESEARCH A1 / U2)
run_stale_sweep_interval_seconds: int = 120      # periodic tick (RESEARCH U6)
```
> RESEARCH A1 flags that 2400s CORRECTS CONTEXT's "2–5 min" (D-145-07) — 2–5 min would
> kill a live `ask_user`-waiting run. The 2400s value is operator-ratified per MEMORY.
> Config field so it is tunable without a deploy (project dynamic-settings direction).

---

### `frontend/src/providers/StreamsProvider.tsx` (provider, SSE + watchdog) — MODIFIED

**Analog:** its OWN transient-reconcile plumbing + visibility listeners (self-modification).

**Pattern 2 — reconcile-derive `streamingThreads` from `snapshot.active_runs` (NEW, U7).**
The load-bearing frontend fix. Today `streamingThreads` is written ONLY by the send path
(add `:1713-1715`, reattach re-add `:1850-1853`, delete-in-finally `:2016-2023`);
`reconcile()` NEVER touches it (`:1298-1314` clearThreadBucket is bucket-only). Make the
reconcile/watchdog derive it:
```typescript
// on every reconcile/watchdog tick, after getSnapshot:
const hasActive = snapshot.active_runs.some(r => r.status === "streaming")
useStreamsStore.setState((s) => {
  const next = new Set(s.streamingThreads)
  if (hasActive) next.add(threadId)
  // GUARD (Pitfall 1): never delete a thread with an in-flight send
  else if (!sendingThreadsRef.current.has(threadId)) next.delete(threadId)
  return { streamingThreads: next }
})
```
- **The in-flight-send guard is mandatory** — mirror the `sendingThreadsRef.current.has(...)`
  checks already used at `clearThreadBucket:1302` and the reconcile temp-survival at
  `:1402-1428`. `sendingThreadsRef` is declared at `:1123`.

**Terminal-flip map to REUSE for the silent-finalize** (`:1562-1567` send-path, `:1873-1878`
reconcile-path). On a confirmed-terminal watchdog verdict, flip the placeholder `runStatus`
the same way:
```typescript
if (kind === "done") return { ...m, runStatus: "completed" }
if (kind === "error") return { ...m, runStatus: "failed", runError: errorPayload }
// ...cancelled / timed_out / reader_done
```

**Watchdog timer pattern (NEW, D-145-03/05).** ONE shared `setInterval` (~5s tick) over
the `streamingThreads` set; per-thread inactivity window N≈20s that RESETS on every stream
event. On N-inactivity → `getSnapshot` probe → if `active_runs` lacks a streaming entry for
that run, silent-finalize (Pattern 2 delete + terminal-flip). Structure it as a THIRD
`useEffect` alongside the existing listener effect:

**Visibility/focus belt to REUSE** (`:2591-2616`) — `useEffect #2` already fires
`reconcile(tid)` on `visibilitychange`/`focus`/`pageshow`. Once Pattern 2 makes
`reconcile()` clear `streamingThreads`, this belt starts healing Direction A for free.
Reuse the exact add/removeEventListener + cleanup shape:
```typescript
document.addEventListener("visibilitychange", onVisibility)
window.addEventListener("focus", onFocus)
window.addEventListener("pageshow", onPageShow)
return () => { /* symmetric removeEventListener */ }
```

**Probe primitive to REUSE:** `_isTransientStreamEnd`'s snapshot check
(`snapshot.active_runs.some(r => r.run_id === runId && r.status === "streaming")`,
`:232-234`) — the watchdog wants the READ-ONLY probe, NOT the full `reconcile()` action
(which re-derives buckets + re-attaches; RESEARCH anti-pattern).

**Selectors the Stop button reads** (do NOT change their signature): `useStreamingForThread`
(`:2973`, `streamingThreads.has(threadId)`), `useAnyStreaming` (`:2946`), the streaming-set
selector (`:2982`). Making `streamingThreads` reconcile-derived fixes both directions
through these existing selectors with zero call-site changes.

---

## Shared Patterns

### Atomic status⇄mirror co-write (Pattern 1 — the anti-drift core)
**Source (extract from):** `threads.py:1684-1724` (terminal), `:1108-1127` (start).
**New home:** `run_lifecycle.py`.
**Apply to:** every chat-run start/terminal in `threads.py`, `runs.py` cancel zombie-heal,
`run_reconciler.py`. Status (`db.runs.finalize_run`/`insert_run`) + `runs:active` membership
move as ONE unit. This is the fix — today they live in different code paths and drifted.

### DI-for-testability (explicit `pool`/`redis` params)
**Source:** `reconcile_orphaned_runs(*, pool, redis, supabase)` (`run_reconciler.py:74`).
**Apply to:** `run_lifecycle.py` public fns. Enables the in-memory `_FakePool`/`_FakeRedis`
injection (`test_run_reconciler.py:34-136`) → unit-testable in isolation, no live Redis/DB.

### Best-effort per-row / per-op try/except (never abort the batch)
**Source:** `run_reconciler.py:169-186` (per-row), `threads.py:1716`/`:1723` (per Redis op),
`runs.py:1176-1257` (per zombie-heal op, D-062-13).
**Apply to:** the periodic sweep, the extracted owner's callers. One bad row/op never
aborts the sweep or unwinds a completed DB terminalization.

### SET NX single-flight guard (WORKER_COUNT=2 safe)
**Source:** `run_reconciler.py:83-88` (`redis.set(key, nx=True, ex=TTL)`, key `run_reconcile_lock`).
**Apply to:** the periodic sweep (D-145-08) — TTL shorter than the tick so exactly one
worker sweeps per interval. Test double already models it (`test_run_reconciler.py:48-53`
`set(nx)` + `lock_held`).

### Lifespan interval task (`while True` + `asyncio.sleep` + `create_task`)
**Source:** `_sweep_expired_templates` (`main.py:302-314`).
**Apply to:** the periodic reconciler host in `main.py`. Best-effort background task;
lazy import inside the fn body (house convention `:305-306`).

### Reconcile-via-fetch, never trust the live signal (D-v2.5-03)
**Source:** `get_snapshot` (`threads.py:364-489`) + `_isTransientStreamEnd` (`StreamsProvider.tsx:194-236`).
**Apply to:** the frontend watchdog + Pattern 2. The watchdog is an EXTENSION of this —
reconcile via `getSnapshot`, treat `runs.status` as truth, never the local `streamingThreads` flag.

### Ownership SELECT before any state op (V4 access control, T-062-01)
**Source:** `runs.py:1107-1119` (cancel), `threads.py:379-388` (snapshot) — 404-not-403.
**Apply to (preserve):** the extraction must NOT change these. `run_lifecycle` is called by
already-authorized paths; the sweep is service-role, scoped by row id + CAS.

---

## No Analog Found

None. Every file to be created or modified has a shipped, tested in-repo analog. This is a
"mirror an existing module" phase by construction — the planner copies shapes, it does not
invent new machinery (RESEARCH "Don't Hand-Roll": almost everything needed already exists as
a shipped primitive; the work is RE-WIRING).

---

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/db/`, `backend/app/api/`,
`backend/app/main.py`, `backend/app/config.py`, `backend/tests/`, `frontend/src/providers/`,
`frontend/src/__tests__/providers/`.
**Files scanned (read this session):** `run_reconciler.py`, `db/runs.py`,
`test_run_reconciler.py`, `threads.py` (5 ranges: `:150-189`, `:360-489`, `:1100-1159`,
`:1680-1729`, `:2170-2219`), `main.py` (`:245-324`), `runs.py` (`:1090-1264`), `config.py`
(`:205-234`, `:968-992`), `StreamsProvider.tsx` (7 ranges), `StreamsProvider.transient.test.ts`.
**Line refs:** all VERIFIED against live code 2026-07-09; drift from RESEARCH corrected to the
verified numbers (e.g. spawn-fail is `:1128-1142` not `:1131-1141`; Deep ZREM is `:1719-1724`).
**Pattern extraction date:** 2026-07-09
