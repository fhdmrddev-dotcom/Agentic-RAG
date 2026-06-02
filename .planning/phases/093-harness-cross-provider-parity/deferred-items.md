# Phase 093 — Deferred Items (out-of-scope discoveries during execution)

## From Plan 093-03 (sub-agent model resolver field fix)

### Pre-existing test failure (NOT caused by 093-03) — `test_infer_openai_from_gpt_prefix`

- **File:** `backend/tests/unit/test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix`
- **Symptom:** `assert cap["llm_call_timeout_seconds"] == 90` fails with `300 == 90`.
- **Discovered:** during the 093-03 baseline run (BEFORE any edit) — confirmed pre-existing.
- **Root cause (likely):** the `get_model_capability` inference safe-default for an
  unknown `gpt-*` model now returns a 300s `llm_call_timeout_seconds`, but the test
  still pins the old 90s expectation. This is in `config.py`'s capability-inference
  defaults — NOT in `_SUB_AGENT_MODEL_DEFAULTS` and NOT in the model resolver this
  plan touches.
- **Scope:** out of scope for 093-03 (files_modified = sub_agent_models.py, config.py
  `_SUB_AGENT_MODEL_DEFAULTS` only, test_sub_agent_routing.py). Left untouched per the
  executor scope boundary. Candidate for a `/gsd:quick` test-pin update.
