# Phase 096 — Deferred Items

Out-of-scope discoveries logged during execution (scope-boundary rule: not fixed, not chased).

## DI-096-02-A — Pre-existing rot: test_085_sub_agent_cross_provider stub uses the dead `llm_models` field

- **Found during:** 096-02 Task 2 (touched-surface net-new-failure sweep)
- **What:** 4 of 7 params of `tests/integration/test_085_sub_agent_cross_provider.py::test_cross_provider_default_path_no_footgun` fail (anthropic / google / deepseek / moonshot): the resolver returns the stale `gpt-4.1` candidate instead of the provider default.
- **Root cause (static):** the test's `_StubUserSettings` sets `llm_models` (the old CSV field), but `resolve_sub_agent_model_safely` reads `available_models` since the 093-03 D-06 field fix (`sub_agent_models.py:84-94` — the docstring documents the rename). With no `available_models` on the stub, `_active_models_list` is `[]` → the documented empty-list passthrough returns the candidate → the 4 hard-default params fail. The test encodes the pre-093 field contract.
- **Decoupling proof (why it is NOT 096-02 net-new):** the test file imports ONLY `app.config._SUB_AGENT_MODEL_DEFAULTS` + `app.services.sub_agent_models.resolve_sub_agent_model_safely` (lines 36-37) and never executes `task_service.run_task_sub_agent` — the sole production function 096-02 touched. Zero coupling to the 096-02 diff.
- **Suggested fix (one line, whoever owns it):** add `self.available_models = [m.strip() for m in llm_models.split(",")]` to `_StubUserSettings.__init__` so the stub matches the real `UserEffectiveSettings` field the resolver reads.
- **Re-open trigger:** any plan touching `sub_agent_models.py` or the 085 integration suite; or the Phase 096 verifier's baseline sweep.
