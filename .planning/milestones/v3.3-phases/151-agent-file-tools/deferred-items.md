# Phase 151 — Deferred / Out-of-Scope Items

## Pre-existing backend unit-test rot (discovered during 151-04 execution, 2026-07-14)

Running the FULL `pytest tests/unit` tier surfaced **63 pre-existing failures** across
~18 service test files that are UNRELATED to FILE-01/FILE-02 and predate this phase.

**Verified pre-existing:** restoring `tool_dispatcher.py` + `openai_service.py` to the
pre-plan baseline commit `a0a86e8e` and re-running `test_sql_service.py` +
`test_sandbox_service.py` + `test_retrieval_service.py` reproduced 30 of those failures
with the ORIGINAL source — so they are baseline rot, not caused by the FILE-01 changes.

Failing files (count): test_retrieval_service (15), test_sql_service (12),
test_explorer_agent (6), test_multimodal_query (5), test_111_1_reembed_kickoff (4),
test_sandbox_service (3), test_lifespan (3), test_db_runs (3), test_module7_tools (2),
test_extraction_service (2), and 9 singletons (test_streaming_reliability,
test_phase56_iteration_start, test_get_model_capability_inference, test_forced_emit,
test_103_nl_generate, test_075_4_unknown_provider_error, test_071_1_threadpool_sweep,
test_061_consumer).

Sampled root causes (all behavioral, none import/collection):
- `test_sql_service` — `pytest.raises(ValueError, match="Only SELECT")` → "DID NOT RAISE"
  (query-validation behavior drifted from the test's expectation).
- `test_sandbox_service` — `assert current_files_set == set()` fails with `{} == set()`
  (a dict-vs-set assertion mismatch in the harvest test).

**Scope decision (per executor scope-boundary rule):** NOT fixed here — out of scope for
151-04 (they touch none of this plan's files). The FILE-01/FILE-02 suites +
the three finalized exact-count assertions are all green
(`test_151_attach_handler`, `test_151_registration`, `test_151_cross_provider_schema`,
`test_151_fetch_handler`, `test_151_tool_schema`, `test_085_tool_registration`,
`test_tool_dispatcher` = 67/67).

**Re-open trigger:** surface at Phase 151 `/gsd:verify-work` as a candidate cleanup
(mirrors the SEED-056 frontend-vitest-rot / SEED-049 E2E-rot precedent — a dedicated
test-hygiene sweep, not a feature phase).
