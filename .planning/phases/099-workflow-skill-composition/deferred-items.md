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
