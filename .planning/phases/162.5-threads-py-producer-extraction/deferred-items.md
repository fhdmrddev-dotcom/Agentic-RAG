# Phase 162.5 — Deferred / Out-of-Scope Items

Pre-existing test rot discovered while establishing the byte-identical baseline for the
162.5-01 leaf extraction. These fail on the UNMODIFIED (pre-extraction) `threads.py` too —
they are NOT caused by this phase and are out of scope for a behavior-preserving refactor
(SEED-056 / `075.4-TEST-TRIAGE.md` class). Logged, not fixed.

## Pre-existing failures (baseline: identical before and after 162.5-01)

| Test | Failure | Root cause (pre-existing) |
|------|---------|---------------------------|
| `tests/test_mdl_verification.py::...test_generate_thread_title_uses_provider_default[openai]` / `[google]` | stale assert (`gpt-5.4-mini` != `gpt-4.1-nano`) | Test hardcodes old `_SUB_AGENT_MODEL_DEFAULTS` values; registry curated to newer models (prioritize-newest-models convention). The `get_llm_client` mock IS still called (patch surface intact) — only the expected string is stale. |
| `tests/test_mdl_verification.py::...test_generate_suggestions_uses_provider_default[openai]` / `[google]` | stale assert | Same stale-default drift, in `suggestion_service` (untouched by this phase). |
| `tests/test_mdl_verification.py::...test_sub_agent_model_defaults_dict_keys_match_known_providers` | key mismatch | `KNOWN_PROVIDERS` vs `_SUB_AGENT_MODEL_DEFAULTS` drift. |
| `tests/test_provider_router.py::test_n01_*` (4) | `app.api.threads` has no attribute `insert_run` | Stale patch target — `insert_run` was replaced by `register_run_start` in Phase 145; test never updated. |
| `tests/integration/test_threads.py` (4) | no attribute `create_streaming_chat` (×2) / `insert_run` (×2) | Stale patch targets removed in Phase 092.5 / 145. |
| `tests/test_dual_mode_wiring.py` + `tests/unit/test_explorer_agent.py` (16) | `insert_run` AttributeError + mock-mismatch 500s | Stale `insert_run` patch chain from Phase 145. Baseline proven identical (16 failed) on the original `threads.py` via a backup/restore run. |

**Disposition:** out of scope for Phase 162.5 (pure refactor fixes nothing by design). Candidates for a future backend test-rot sweep (SEED-056 lineage). Do NOT block the 162.5 extraction or its Plan-04 gate on these.
