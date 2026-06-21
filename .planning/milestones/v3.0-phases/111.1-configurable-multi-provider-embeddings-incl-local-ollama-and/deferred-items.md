# Phase 111.1 — Deferred Items (discovered during execution)

## Plan 02 (D-09 data-egress routing fixes)

### DI-111.1-02-A — pre-existing rot in `test_get_model_capability_inference.py`

- **Found during:** Plan 02 Task 1 verification.
- **Test:** `tests/unit/test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix`
- **Symptom:** asserts `cap["llm_call_timeout_seconds"] == 90`, but the inferred
  safe-default timeout for an unknown `gpt-*` id is now `300`.
- **Proof it is pre-existing (out of scope, SEED-056):** stashing ALL Plan-02 edits
  (`config.py` + `documents.py`) and re-running the single test still FAILS identically
  (`assert 300 == 90`). Plan 02's `config.py` change is a comment-only addition near
  `_INFERENCE_PATTERNS` — it cannot alter an inferred timeout default.
- **Disposition:** NOT fixed here (a stale assertion in an unrelated 075.3 inference test,
  not caused by this task's changes). The inference *provider* assertions in the same file
  still pass, so the legacy-inference byte-behavior the threat model relies on (T-111.1-02-04)
  is preserved. Route to the inference-test owner / a future polish pass.
