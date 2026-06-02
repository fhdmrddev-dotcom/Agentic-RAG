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

## From Plan 093-04 (ask_user F10 fallback + Continue ctx-model thread)

### Pre-existing live-DB integration failures (NOT caused by 093-04) — runs-table FK / Redis-stream env

- **Files:** `test_061_producer_survives_disconnect.py`, `test_061_runs_table.py`,
  `test_062_delete_happy.py`, `test_062_multi_consumer_fanout.py`,
  `test_062_stream_replay.py`, `test_063_post_contract.py` (2 cases),
  `test_063_post_then_subscribe.py` — 8 failures total in the runs/sse-stream surface.
- **Symptom:** `asyncpg.exceptions.ForeignKeyViolationError: insert or update on table
  "runs" violates foreign key constraint "runs_thread_id_fkey"` — these live-DB tests
  seed `runs` rows against `thread_id`s that are not present in the current local DB
  (test-data setup assumption that no longer holds against the live local Supabase).
- **Discovered:** during the 093-04 regression sweep (`pytest tests/integration -k
  "ask_user or continue or 092 or 063 or runs or 062"`).
- **Why NOT a 093-04 regression:** the FK-violation signature is a test-data/environment
  issue at run-INSERT time. 093-04's diff is confined to (a) a fallback branch in
  `submit_ask_user_response` that engages ONLY after the Step-1 runs SELECT 404s, and
  (b) the Continue branch's wf_ctx model threading. None of these 8 tests exercise the
  ask_user_response endpoint or the Continue endpoint — they hit run-creation / SSE
  producer-stream paths that 093-04 does not touch. The `test_093_ask_user_workflow_run_live.py`
  suite (5 cases) + the `test_092_*` ownership/continue tests all pass.
- **Scope:** out of scope for 093-04 (files_modified = runs.py ask_user/continue paths +
  the 093 live test). Left untouched per the executor scope boundary. Likely the same
  live-DB test-data hygiene class already noted for Phase 091; candidate for a dedicated
  integration-test-fixture revival pass (relates to SEED-049 E2E-suite revival).
