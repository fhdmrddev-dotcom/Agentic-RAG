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

## Plan 149-08 (2026-07-12) — pre-existing integration-env failure (1 test)

Discovered while running the `-k "149 or model_gate or admin"` regression sweep for the
gap-closure fixes (the test name contains "admin" so it matched the filter — it is NOT an
admin/model-registry test).

- `tests/integration/test_extraction_dispatcher.py::TestExtractionDispatcher::test_per_call_hint_respects_admin_disable`

**Root cause: out of scope + environmental.** The test drives `POST /documents/{id}/reextract`
(the documents router) and receives `503 Service Unavailable` — it needs live extraction/DB
services this test environment does not provide. It **fails identically in isolation (fresh
process)**, so it is not an ordering artifact of the 149-08 tests and is entirely unrelated to
this plan's changes (which touch only `openai_service.resolve_calling_mode` + the two `admin.py`
model-route decorators — neither can affect the documents reextract path). Not fixed per the
SCOPE BOUNDARY rule.

**Re-open trigger:** revisit when the integration suite is run against live extraction services
(or when the reextract 503 service-availability guard is next audited).
