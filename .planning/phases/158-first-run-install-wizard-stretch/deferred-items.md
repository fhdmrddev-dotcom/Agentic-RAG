# Phase 158 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during execution (do NOT fix in the discovering plan).

## From 158-05 (setup_service) execution — 2026-07-17

- **`test_setup_boot_tolerant.py` (2 tests RED) — owned by plan 158-07.**
  - `test_setup_mode_defers_audit_drift_guard` + `test_configured_mode_still_runs_audit_drift_guard`
    assert `backend/app/main.py` wraps `assert_action_types_synced` in `if not _setup_mode:`
    (the D-03 setup-mode-tolerant lifespan guard, RESEARCH Pattern 3).
  - **Pre-existing, NOT a 158-05 regression:** the test imports `app.main` only (never
    `setup_service`), and `main.py` is untouched by 158-05 (`grep setup_finalized main.py` == 0).
    These have been RED since the 158-01 scaffold and go green when 158-07 wires the lifespan guard.
  - Action: none for 158-05. Verify green after 158-07 executes.

- **`test_setup_status.py` full-suite latch isolation — owned by plan 158-06.**
  - 158-06 owns this file (`files_modified`) and consumes `setup_service.compute_setup_status`
    (which 158-05 added — see SUMMARY deviation 1). 158-05's `compute_setup_status` reads the
    `finalized` marker DIRECTLY from the store file (not the sticky `_finalized_latch`), so all 4
    status tests pass deterministically today (isolation AND full suite), immune to the
    `_finalized_latch` pollution that `test_setup_finalize.py` leaves in the per-process global.
  - Action: none required; noted so 158-06 knows the symbol + deterministic behavior already exist.

- **`test_setup_idempotent.py` (SKIPPED) — owned by plan 158-06.**
  - `pytest.importorskip("app.api.setup")` — stays skipped until 158-06 creates the router.
