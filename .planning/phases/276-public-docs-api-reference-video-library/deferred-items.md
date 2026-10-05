# Phase 276 — deferred / out-of-scope discoveries

## 276-01

- **`backend/tests/test_182_canvas_gate.py::test_openapi_tracks_the_flag_in_both_directions_in_one_process` is RED at base `2b756b1cd`** (measured by checking out base `backend/app/main.py` and re-running, then restoring). The last assertion expects the on/off path difference to be exactly `_CANVAS_PATHS` (3 paths), but the canvas filter now also removes `/workflow-runs` and `/workflow-runs/{workflow_run_id}/phases/{phase_slug}/citations`. The test's constant drifted when those routes were added; not caused by 276. Lives under `backend/tests/` (not `tests/unit`), so it is outside the backend baseline gate. Not fixed here.
