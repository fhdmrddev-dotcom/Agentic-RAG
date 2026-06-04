# Phase 094 — Deferred Items

Out-of-scope discoveries logged during execution (SCOPE BOUNDARY rule — not fixed
here; tracked for a future targeted pass).

## Pre-existing test failure (Plan 04 — NOT a 094-04 regression)

- **Test:** `backend/tests/test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts`
- **Symptom:** `_audit_failures(mock_asyncpg_pool) == 0` (expected 3) — no `gate_failed`
  audit rows recorded, so the bounded-retry/audit assertion fails.
- **Proven pre-existing:** with Plan 04's `harness_engine.py` change git-stashed, the
  combined harness suite STILL fails this exact test identically; it also fails when
  run in isolation. Root cause is the documented cross-file/in-file
  `programmatic`-validator registry pollution (referenced repeatedly in STATE.md,
  e.g. 093-05: "the lone `test_bounded_retry_reaches_failed_after_3_attempts` is
  PRE-EXISTING cross-file registry pollution").
- **Disposition:** NOT touched by Plan 04 (out of scope — pre-existing, unrelated to
  the RC-4 failure-persist surface). Plan 04 adds zero net-new failures: the full
  harness suite is 94 passed / 1 pre-existing failure with Plan 04's change applied.
