# Phase 061.1 — Deferred Items

Out-of-scope discoveries logged during Plan 01 execution per executor deviation rules
(Rule scope boundary: only auto-fix issues directly caused by the current task; log
unrelated pre-existing failures here).

## DEF-061.1-01 — `test_normal_stream_unchanged` pre-existing failure

**File:** `backend/tests/integration/test_059_disconnect.py::test_normal_stream_unchanged`
**Discovered during:** Plan 01 Task 3b verification sweep (2026-05-03)

**Symptom:**
```
AssertionError: Expected 'stream_end' event in stream;
got types=['iteration_start', 'delta', 'delta', 'delta', 'done'].
```

**Status:** Pre-existing — verified by stashing the T3b edit and re-running on the
unmodified pre-T3b state of `threads.py` (commit c2d7c37). The test still failed
identically, so this is NOT a regression introduced by Plan 01.

**Likely root cause:** The test asserts a `stream_end` SSE event exists, but the
Phase 061 producer wire format uses `done` (in `TERMINAL_TYPES`) as the terminal
sentinel — `stream_end` was an older 058/059-era event name. Plan 01's
`-k "not (... or test_normal_stream_unchanged)"` filter clause in the plan's
`<verify>` block (PLAN.md line 727) implies the planner expected this test to be
excluded from the baseline. The test pre-existed Plan 02's helper migration
(commit 79d5f55) and is unrelated to WR-01 / IN-03 / IN-04.

**Disposition:** Deferred. Plan 01 baseline regression sweep uses the plan's
documented `-k "not (...)"` filter clause that already excludes this test. A future
test cleanup phase should either delete the assertion, rename the expected event to
`done`, or migrate the test to the post-061 contract.

**Not addressed in Plan 01:** The plan does not list this test in `files_modified`
and the executor instructions explicitly prohibit modifying `test_059_disconnect.py`.

## DEF-061.1-02 — Three S2 race tests still flaky on Windows post-Plan 02

**Files:**
- `backend/tests/integration/test_061_ttl.py::test_failed_run_expires_60s`
- `backend/tests/integration/test_061_hard_timeout.py::test_120s_timeout_fires_full_finally`
- `backend/tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect`

**Discovered during:** Plan 01 Task 3b verification sweep (2026-05-03)

**Symptoms (all pre-existing):**
- `test_failed_run_expires_60s`: asserts TTL ∈ (30, 65] on a failed run; got TTL=600.
  The producer is classifying the simulated LLM exception as `completed` instead
  of `failed`, so the finalizer applies the 600s completed-run TTL.
- `test_120s_timeout_fires_full_finally`: similar — assertion mismatch on the
  expected terminal-status / TTL combination.
- `test_producer_continues_after_consumer_disconnect`: asserts producer survives
  consumer disconnect; the assertion path interacts with the same finalize ordering.

**Status:** Pre-existing — verified by stashing the T3b edit and running the sweep
on the unmodified pre-T3b state of `threads.py` (commit c2d7c37). The same 3
tests failed identically. Each test also fails when run in isolation, so this is
not a flake from cross-test fixture interference — it's a real condition that
predates Plan 01.

**Likely root cause:** Plan 02 (commit 79d5f55) migrated these tests to the new
`await_producer_finalized` helper to make them deterministic, but the production-
code classifier in `agent_runner` (around `threads.py:1003-1875`) appears to coerce
exceptions into `_terminal_status='completed'` in some path, making the failed/timeout
TTL assertion trip. The test mock raises a stock `Exception("simulated LLM API
error")` which should land as `failed`, but the producer's finally writes 600s TTL
(the completed-run TTL).

**Disposition:** Deferred. The plan's `<verify>` block at PLAN.md line 727 already
excludes all 3 tests via `-k "not (... or test_failed_run_expires_60s or
test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect ...)"`.
This is the planner-authored exclusion clause; the executor honors it. A future
phase should investigate the producer's exception-classifier path — this might
be a STREAM-04 follow-up requirement.

**Not addressed in Plan 01:** Executor instructions explicitly prohibit modifying
`test_059_disconnect.py`, `test_061_runs_table.py`, `test_061_ttl.py`,
`test_061_hard_timeout.py`, and `test_061_producer_survives_disconnect.py`.
