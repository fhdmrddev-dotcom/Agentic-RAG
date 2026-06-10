# Phase 099 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are OUT OF SCOPE for the current task
(pre-existing failures in unrelated files, per the SCOPE BOUNDARY rule).

## Pre-existing test failures (not caused by Phase 099 plans)

- **`tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts`**
  - Discovered during: Plan 099-02 Task 1 regression run.
  - Symptom: `KeyError: 'tool_call_id'` — `tcid = r["tool_call_id"]` in the test/gate path.
  - Status: **PRE-EXISTING** — confirmed by stashing the Plan 02 changes and re-running:
    the test fails identically at the phase base (commit `0341e879`). Not a regression
    introduced by `_skill_block` / auto-whitelist (a no-snapshot phase composes `""`
    and the whitelist is unchanged, so the gate-retry path is byte-identical).
  - Disposition: NOT fixed in this plan (out of scope). Route to a harness-gates
    polish pass / next harness-touching phase.
  - **Re-confirmed Plan 099-07 Task 4 regression sweep (2026-06-10):** still fails
    identically. Proven PRE-EXISTING again by checking out `harness_engine.py` at the
    phase base (`b169b29d`) and re-running — fails identically with the 099-07
    `_load_run_definition` graft reverted. 099-07's only `harness_engine.py` change is in
    `_load_run_definition` (lines ~1055-1067, the skill_snapshots SELECT + graft); it does
    NOT touch `_expire_pending_ask_user` (line 219) where the `KeyError` raises. Net-new = 0.

- **`tests/integration/test_threads_skills.py` — 11 failures (FK-violation cluster)**
  - Discovered during: Plan 099-03 Task 2 regression run.
  - Symptom: `asyncpg.exceptions.ForeignKeyViolationError: insert or update on table
    "runs" violates foreign key constraint "runs_thread_id_fkey"` — the live-Supabase
    integration fixture inserts a `run` whose `thread_id` is not present in `threads`.
  - Status: **PRE-EXISTING** — confirmed by stashing the Task 2 dispatcher change
    (`_decode_skill_file_bytes` extraction + the gated snapshot branch) and re-running
    at the Task-1 commit (`9fa2c364`): **11 failed identically** with NO dispatcher
    change. The extraction is a pure refactor — the offline unit dispatcher suite
    (`tests/unit/test_tool_dispatcher.py`, 15/15 green) and the 099 red-line proof
    (`test_deep_noop`) confirm the live `read_skill_file` path is byte-identical.
  - Disposition: NOT fixed (out of scope — live-DB fixture/teardown rot, part of the
    98-failure cluster triaged in `075.4-TEST-TRIAGE.md` / MEMORY.md). Net-new = 0.
