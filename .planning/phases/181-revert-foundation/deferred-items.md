# Phase 181 — Deferred / Out-of-Scope Items

## Pre-existing backend test rot (out of scope — logged, NOT fixed)

During the Plan 01 wave-merge full run (`pytest tests -q`), **202 pre-existing failures**
were observed alongside 2957 passing. These are NOT caused by Phase 181 changes:

- The full 203-failure list was grepped for every keyword in the Phase-181 touched
  surface (`feature|visibil|canvas|dependenc|admin|user_settings|test_148|test_181|revert|operator`).
- Exactly **one** overlap was a genuine Phase-181 regression — `test_148_effective_features.py::test_operator_sees_all_features_true` hard-coded `set(feats) == {4 keys}` + all-True; Phase 181 adds a 5th governed key (`visual_workflow_canvas: off`). **Fixed in this plan** (Rule 1 deviation, commit `83562caa`).
- The other two keyword hits were substring false-matches, confirmed pre-existing:
  - `test_extraction_dispatcher.py::test_per_call_hint_respects_admin_disable` — fails `assert 503 == 202` (a maintenance/setup-gate environment issue; unrelated to the feature-visibility admin allowlist).
  - `test_eval_runner.py::test_post_applies_provider_override_to_user_settings` — fails `403 "available to administrators only"` (the eval endpoint's own `require_visible` gate; the test never grants operator status — untouched by Phase 181).

The remaining ~200 failures are clustered in service-unit files the feature-visibility
subsystem never touches (`test_retrieval_service`, `test_sql_service`, `test_sandbox_service`,
`test_multimodal_query`, `test_streaming_reliability`, `test_phase56_iteration_start`,
`test_077_cross_cancel`, …) with signature/mock source-drift (e.g. `embed_texts called 0
times`, `DID NOT RAISE ValueError`). This matches the documented repo-wide rot
(SEED-049 e2e rot, SEED-056 vitest rot, the Phase-162.5 old-vs-new differential's stable
pre-existing failing set).

**Disposition:** out of scope for Phase 181 (REVERT-01/02 is a purely additive
feature-flag phase). Not fixed here. A dedicated test-rot cleanup pass is the correct home.
