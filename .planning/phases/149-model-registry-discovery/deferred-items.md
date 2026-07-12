# Phase 149 — Deferred Items

Out-of-scope discoveries logged during execution (per the executor SCOPE BOUNDARY
rule — do NOT fix; pre-existing, unrelated to the current task's changes).

## Plan 149-03 (2026-07-12) — pre-existing backend test rot (17 tests)

Discovered while running a regression sweep for the `max_output_tokens` clamp fix.
**All 17 fail identically at the phase base commit `a3b3df48` (verified in a
throwaway worktree)** — none is caused by the 149-03 clamp change. They are
mock/registry rot from the `threads.py` run-lifecycle extraction (e.g. tests
patch `app.api.threads.insert_run`, a symbol that no longer exists there) and
provider-router/MDL fixture drift.

- `tests/test_provider_router.py::test_n01_runs_6eab949f_router_uses_capability_registry`
- `tests/test_provider_router.py::test_n01_openrouter_model_resolves_via_registry`
- `tests/test_provider_router.py::test_n01_explicit_body_provider_takes_precedence`
- `tests/test_provider_router.py::test_n01_unknown_model_falls_back_to_active_provider`
- `tests/test_mdl_verification.py::TestMDL02ProviderAwareModelResolution::test_generate_thread_title_uses_provider_default[openai-gpt-4.1-nano]`
- `tests/test_mdl_verification.py::TestMDL02ProviderAwareModelResolution::test_generate_thread_title_uses_provider_default[google-gemini-2.5-flash]`
- `tests/test_mdl_verification.py::TestMDL02ProviderAwareModelResolution::test_generate_suggestions_uses_provider_default[openai-gpt-4.1-nano]`
- `tests/test_mdl_verification.py::TestMDL02ProviderAwareModelResolution::test_generate_suggestions_uses_provider_default[google-gemini-2.5-flash]`
- `tests/test_mdl_verification.py::TestMDL02ProviderAwareModelResolution::test_sub_agent_model_defaults_dict_keys_match_known_providers`
- `tests/integration/test_085_sub_agent_cross_provider.py::test_cross_provider_default_path_no_footgun[anthropic|google|deepseek|moonshot]` (4)
- `tests/integration/test_threads.py::TestSendMessageDispatchAttribution::test_dispatch_response_carries_resolved_model_and_provider`
- `tests/integration/test_threads.py::TestSendMessageDispatchAttribution::test_dispatch_response_model_provider_follow_explicit_body_override`
- `tests/unit/test_075_4_unknown_provider_error.py::test_known_providers_includes_all_five_providers`

**Re-open trigger:** the overdue `backend/app/api/threads.py` G-5 extraction refactor
(ledger: "G-5 fires — extraction due") should sweep these mock targets when it lands.
