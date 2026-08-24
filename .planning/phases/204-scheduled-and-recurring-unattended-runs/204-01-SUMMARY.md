---
phase: 204-scheduled-and-recurring-unattended-runs
plan: 01
subsystem: backend/run-lifecycle
tags: [L-01, cancellation, redis, pubsub, cross-worker, producer-brake, Phase-194-residual]
requires:
  - "redis (already a hard dependency — run-buffer keys)"
  - "db.workflows.finish_run terminal guard (shipped 194)"
provides:
  - "run_lifecycle.broadcast_run_cancellation / is_run_cancelled / cancellation_watch"
  - "harness_engine per-phase-boundary + in-flight cancellation brake"
  - "run_producer F2 cancel-registry consult"
affects:
  - "every stop path: api/runs.py cancel_run, admin kill, admin disable-user, workflow cascade"
tech-stack:
  added: []
  patterns: ["redis pub/sub edge + TTL'd registry level", "asynccontextmanager task-cancelling watcher"]
key-files:
  created:
    - backend/tests/unit/test_cross_worker_cancellation.py
  modified:
    - backend/app/services/run_lifecycle.py
    - backend/app/services/harness_engine.py
    - backend/app/services/run_producer.py
decisions:
  - "D-204-01/02/03 implemented; broadcast sited in cancel_workflow_run_internals so every stop path inherits it unedited"
  - "redis param OPTIONAL, defaults to the app singleton — a fail-safe, not a caller obligation"
  - "is_run_cancelled FAILS OPEN on a Redis fault"
  - "boundary brake RETURNS (does not break) and writes nothing"
metrics:
  duration: ~75m
  tasks: 3
  completed: 2026-08-24
---

# Phase 204 Plan 01: Cross-Worker Cancellation Brake (L-01) Summary

Redis pub/sub edge (`run_cancel:{id}`) plus a 24h TTL registry level (`run_cancelled:{id}`)
that stops a workflow producer on *another* uvicorn worker mid-provider-call — closing the
gap `db/workflows.py:finish_run` has carried a written IOU for since Phase 194.

## What shipped

| Commit | What |
|---|---|
| `d2e4eb3d` | `run_lifecycle.py` — `broadcast_run_cancellation`, `is_run_cancelled`, `cancellation_watch`; `cancel_workflow_run_internals` gains optional `redis` and broadcasts before its two durable writes |
| `6ef6fb93` | `harness_engine.py` boundary check + in-flight watcher; `run_producer.py` F2 consults the registry before writing `failed` |
| `6ecb125c` | `break` → `return` fix + `backend/tests/unit/test_cross_worker_cancellation.py` (28 cases) |

**Mechanism.** Two halves, and the suite asserts neither is redundant:

- **Edge** — `PUBLISH run_cancel:{id}`. `cancellation_watch` wraps each phase's execution,
  and on a message calls `.cancel()` on the running task. The `CancelledError` surfaces at
  the provider `await`, so the executor issues no further request. This is the half that
  makes L-01 about money rather than about a status column.
- **Level** — `SET run_cancelled:{id} EX 86400`, read at every phase boundary and re-read on
  every watcher poll tick. Redis PUBLISH is fire-and-forget: a message with **no subscriber
  is dropped forever**, so a worker that restarted or subscribed late would never learn of
  the cancel. `test_the_level_cancels_a_body_that_missed_the_edge` drives exactly that.

**Write order is load-bearing:** level, *then* edge. Driven by an introspecting fake whose
`publish` reads its own store (`test_the_level_is_written_before_the_edge_is_published`).

## The one-site broadcast — and the hot files this let me NOT touch

`cancel_workflow_run_internals` is the only place that announces a cancel. Measured: it has
exactly **one** external caller (`api/runs.py:1528`) and every other stop path
(`admin.py` kill ×2, `api/workflows.py` cascade, `api/runs.py` cancel_run) funnels through
`_cancel_run_internals`, which lives in the same module and now passes its own `redis`.

The plan's task 1 says "ensure all cancel callers in `run_lifecycle.py` and
`api/workflows.py` / `api/runs.py` trigger Redis cancellation broadcast." **Neither API file
was edited, and neither needs to be.** `redis` defaults to `None` and the composition
resolves `app.dependencies.get_redis()` internally — which performs no I/O at call time — so
the shipped `api/runs.py` caller broadcasts unedited. Both files are G-5-firing and out of
`files_modified`; making the parameter mandatory would have converted a fail-safe into a
caller obligation, and this project has measured what happens to obligations nothing
enforces. Pinned by `test_an_omitted_redis_resolves_the_app_singleton`.

## Deviations from Plan

### 1. [Rule 1 — Bug] The plan's `break` would have shipped the L-01 defect inside its own fix

**Found during:** Task 2, caught by driving the engine in Task 3.

Task 2 says: *"If cancelled, break immediately."* `run_workflow`'s `while` loop **does not
fall through to nothing.** The statements after it are `finish_run(pool, run_id,
"completed")`, a `run_completed` audit row, `_surface_final_answer` and a `run_completed`
SSE frame. So `break` exits the loop and then lets the caller run straight past the cancel
boundary into the success terminal: it overwrites the cancelling worker's `cancelled` with
`completed`, persists a **partial** answer as the run's deliverable, and tells the browser
the run finished. A user who pressed Stop would see a completed run with a half-built
deliverable — which is the *Phase 200* "a paused run claimed it had finished" shape, and it
would have been introduced by the fix for exactly that class of lie.

**Fix:** `return`. Pinned by `test_the_boundary_brake_never_lets_the_run_report_completed`;
reverting the single word turns it red (driven, CF-A below).

**Commit:** `6ecb125c`

### 2. [Rule 1 — Bug] The boundary brake writes nothing — a shipped 194 fence forbids it

**Found during:** Task 2.

Task 2 also says to *"invoke `cancel_phase`"* at the boundary. That is **not available**:
`backend/tests/test_harness_engine.py::test_the_cancel_arm_is_the_harness_engines_alone_and_deep_never_enters_it`
AST-counts `cancel_phase` **`Call` nodes** in `harness_engine.py` and asserts **exactly 1** —
the interrupted-phase terminalize on the escape arm. A second call site read **2** and went
red on first run.

The fence is right and was answered by **removing the write, not by re-baselining the
count**, for two independent reasons:

1. `cancel_phase` is `WHERE id = $1` with **no status predicate**
   (`db/workflows.py:1770`). At the boundary the row is `pending` in every case but a
   resume — so an ungated call flips a step *that never ran* to `cancelled`, which the
   client's vocabulary renders as "Stopped by you". That is verbatim the 194 CR-02 defect
   this same file already carries the correction for.
2. **The write has already happened.** `broadcast_run_cancellation` is called from *inside*
   `cancel_workflow_run_internals`, whose very next statements are `finish_run` +
   `cancel_active_phases` — the run-keyed, `AND status = 'active'` set-predicate that owns
   this write. There is no path that publishes the signal without also running it.

**This is the finding the next plan most needs:** a G-5 hot file can carry an AST-counted
call-site fence that a plan's action text will contradict without knowing. Check
`test_harness_engine.py`'s fence block before adding *any* writer call to `harness_engine.py`.

### 3. [Rule 2 — Missing critical functionality] `run_producer` F2 consults the registry

Task 2's third bullet ("without re-writing terminal statuses over `cancelled`") is
implemented, **but the honest framing is defence-in-depth, not a defect repair.**
`finish_run` already carries a 194 terminal guard —
`AND (status IS NULL OR status NOT IN ('completed','failed','cancelled') OR status = $2)` —
so a `failed` write over a `cancelled` is *already refused at the SQL level*. What the
registry read adds is that the producer now **binds the right value at source** rather than
issuing a write that is silently discarded. Both directions are pinned
(`..._may_not_write_failed_over_a_cancel`, `..._only_ever_turns_failed_into_cancelled`).

### 4. [Process] I lost this plan's own fix to my own counterfactual

The `break` → `return` fix was uncommitted when I ran a counterfactual that ended in
`git checkout -- backend/app/services/harness_engine.py`. The revert restored the *committed*
`break`. The suite caught it (the case failed in isolation while passing in the full run,
because an earlier drive had left a stale expectation) — but the lesson stands and is
recorded here rather than in a comment: **drive counterfactuals only against a committed
tree.** Every subsequent counterfactual in this plan was run after `6ecb125c`.

## Threat-model coverage (the standing criterion for this phase)

All three mitigations have real assertions. Phase 203 wrote three and implemented none.

| Threat | Cases | Counterfactual |
|---|---|---|
| **Race Conditions** | `test_two_concurrent_cancels_interleave_idempotently` (both `gather`-ed cancels return `True`, both bind `cancelled` — asserted as **value identity**, which is what the composition's own docstring names as the guard), `test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`, `test_the_registry_read_only_ever_turns_failed_into_cancelled`, `test_a_cancel_landing_during_the_final_phase_still_halts_it` | CF-C |
| **Stranded Channels** | `test_the_listener_is_torn_down_on_every_exit_path[normal/exception/cancelled]` (asserted as a **count of live subscriptions**, not an ordering of events), `test_the_watcher_task_does_not_outlive_the_context`, `test_a_long_run_does_not_accumulate_subscriptions` (25 phases → 0), `test_a_subscribe_failure_degrades_to_the_level_and_never_raises` | CF-D, CF-E |
| **Silent Token Bleed** | `test_worker_b_issues_no_provider_call_after_worker_a_cancels`, `test_the_provider_counter_is_frozen_after_the_signal` | CF-F |

**The L-01 acceptance is behavioural, as required.** The headline case drives a real 3-phase
`run_workflow` on "worker B" whose executor makes 40 mock provider requests per phase, while
"worker A" — a separate coroutine holding *only* the shared Redis and the pool, exactly as a
second uvicorn worker would — calls the real `cancel_workflow_run_internals` mid-step-1. The
assertions are the **call log**: `set(call_log) == {"p0"}`, `entered == ["p0"]`, and
`len(call_log) < calls_per_phase` (so step 1 was genuinely interrupted, not merely finished).
The sibling case reads the counter at the moment worker B dies and again **60 call periods
later** and asserts it is unchanged. No case asserts `status == 'cancelled'` as evidence of a
halt.

Non-vacuity is asserted in every drive: `calls_at_cancel > 0` and `not worker_b.done()`
before the cancel, so a case that cancelled a run which had not started would fail rather
than pass silently.

## Counterfactuals driven (all against the committed tree)

| | Plant | Red |
|---|---|---|
| CF-A | boundary brake `return` → `break` | `..._never_lets_the_run_report_completed` (1) |
| CF-B | boundary level check disabled | `..._stops_the_run_between_phases`, `..._never_lets_the_run_report_completed` (2) |
| CF-C | F2 ignores the registry | `..._may_not_write_failed_over_a_cancel` (1) |
| CF-D | `cancellation_watch` never unsubscribes | 5 cases incl. all three exit paths |
| CF-E | watcher task left running | `..._does_not_outlive_the_context` + the degrade case (2) |
| CF-F | `cancellation_watch` removed from the engine | all 3 token-bleed / halt cases |

## Test figures

```
backend/tests/unit/test_cross_worker_cancellation.py -v   ->  28 passed        (plan gate)
backend/tests/test_run_lifecycle.py + test_062_cancel_run.py ->  40 passed
backend/tests/test_harness_engine.py                      ->  61 passed
```

**New failures against base SHA `cd6af1c5`: ZERO.** Measured rather than assumed — the same
scope (`test_harness_engine.py` + all of `backend/tests/unit`, new file excluded) was run
twice, once with the base sources restored via
`git checkout cd6af1c5 -- backend/app/services/{run_lifecycle,harness_engine,run_producer}.py`
and once at HEAD. **65 failing before, 65 failing after, identical sets** (the two lines that
differ textually are the same two test ids with a pytest `unraisableexception` RuntimeWarning
glued onto a different one of them per run). Full scope at HEAD including the new file:
`67 failed, 2558 passed`.

## What this does NOT prove

Stated plainly rather than left to be assumed, and written into the suite's own module
docstring:

- **The mock provider sits at `harness_engine._execute_phase`** — the registry dispatch. The
  real `task_service.run_task_sub_agent` / `_stream_one_iteration` bodies are **not**
  exercised. What is proven is that cancellation reaches and kills the task that *would* call
  them, through the real `asyncio.wait_for` wall-clock cap and the real gate loop. **A
  provider client that swallowed `CancelledError` internally would defeat this**, and no unit
  test at this level can see it. If a later plan wants that closed, the seam is a pre-call
  `is_run_cancelled` check inside `task_service.py` — which is not in this plan's
  `files_modified`.
- **No live two-worker UAT was run.** D-204-04 says "verified at `WORKER_COUNT=2`"; what is
  verified here is the *isolation property* (worker A shares nothing with worker B but Redis
  and Postgres) in a single process. A real two-uvicorn-worker row is owed.
- **`_cancel_run_internals` Step 3a does not broadcast.** That is the arm where the producer
  task IS on this worker and `task.cancel()` already works; adding a broadcast there would
  need the workflow run id, which that arm does not read. Named, not hidden.

## Notes for wave 2

- **`204-02`'s `CircuitBreaker.record_tokens` source is still unproven.** The pre-flight
  flagged it and this plan did not need to resolve it; nothing here surfaces per-call token
  counts to the harness. Establish it before building the tracker.
- **Tripping the breaker should call `cancel_workflow_run_internals`** — it is now the single
  broadcast site, so a breaker that calls it inherits the producer brake for free (D-204-03).
  A breaker that writes `finish_run` directly would get the status and none of the halt.

## Threat Flags

None. No new network endpoint, auth path, file access or trust-boundary schema change. The
two new Redis keys are asserted not to collide with the three shipped run-buffer key shapes
(`test_the_keys_do_not_collide_with_the_shipped_run_buffer_keys`), including prefix collision
against `run:{id}`, which the SSE transport's own EXPIRE/DEL paths sweep.

## Self-Check: PASSED

All 4 source/test artifacts present on disk; all 3 commits resolve; both task-1 acceptance
symbols (`async def broadcast_run_cancellation`, `async def is_run_cancelled`) present; both
task-2 brake sites present in `harness_engine.py` (`:1689` level check, `:1760` watcher).
