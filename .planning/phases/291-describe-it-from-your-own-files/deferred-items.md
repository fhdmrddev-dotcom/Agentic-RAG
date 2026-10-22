# Phase 291 — deferred items (out of scope for the plan that found them)

## Found during 291-04

- **`backend/tests/integration/test_214_argument_seams.py::test_S7_the_generate_refusal_returns_the_new_code_from_the_real_service` is RED, inherited from 291-02.**
  It counts `"reason_code":` occurrences in `backend/app/services/workflow_authoring.py` and expects exactly 3 (the three `connection_not_allowed` returns); 291-02 added a fourth (`grounding_unavailable` / `removed_powers_broke_draft` refusals). Measured RED at the 291-04 base `73107e648` in a throwaway worktree, so 291-04 did not cause it (291-04 changed no backend source). It lives in `tests/integration`, outside the unit gate. Owner: whoever closes 291-02's review — re-derive the pinned count with a written reason, as 288-04 / 291-01 did for their pins.
