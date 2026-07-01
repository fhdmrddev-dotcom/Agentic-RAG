# Phase 134 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY: issues encountered during execution that are NOT
directly caused by this phase's changes are recorded here and left unfixed.

## Pre-existing backend unit-test rot (discovered during Plan 134-03 full-suite run)

**Discovered:** 2026-07-01 (Plan 134-03 execution, running the success-criteria full suite)
**Status:** pre-existing — NOT a regression from Plan 134-03
**Disposition:** out of scope (do NOT fix in 134); candidate for a dedicated backend test-rot
cleanup pass (sibling to the frontend vitest rot SEED-056 / E2E rot SEED-049).

`cd backend && venv/Scripts/python -m pytest tests/ --ignore=tests/integration -q` reports
**70 failed, 1461 passed** (86s). The full `pytest tests/ -q` (including the live-service
`tests/integration/` folder, which needs a running Redis + local Supabase :54322) reports
**125 failed, 1985 passed, 1 error** (~12 min) — the extra failures are integration tests
gated on live services this run did not have.

**Proof these are pre-existing, not caused by 134-03:** Plan 134-03's entire footprint is
`backend/app/api/evals.py` (+117/-1) + `backend/app/models/eval_run.py` (+18) + the new
`backend/tests/test_evals_router.py`. Every failing test file below — and its
system-under-test module — is byte-identical between baseline (`HEAD~1`) and now
(`git diff --stat HEAD~1..HEAD` shows only the two eval files). Therefore their pass/fail
status is unchanged by this plan. The eval-domain slice is fully green
(`test_eval_runner.py` 11 + `test_evals_router.py` 2 = 13 passed), and all 1461
app.main-importing hermetic tests pass, so the additive eval router/model change imports and
wires cleanly.

**Failing files (hermetic, 70 total) — all unrelated to the eval domain:**

| File | # | Failure class (sampled) |
|------|---|-------------------------|
| `tests/unit/test_retrieval_service.py` | 15 | mock drift — `Expected 'embed_texts' to be called once. Called 0 times.` |
| `tests/unit/test_sql_service.py` | 12 | mock/API drift on `query_documents` validation + RPC |
| `tests/unit/test_multimodal_query.py` | 5 | `TypeError` on query-tables signature |
| `tests/unit/test_sandbox_service.py` | 3 | `harvest_output_files` upload/insert mock drift |
| `tests/unit/test_module7_tools.py` | 2 | tool-surface drift |
| `tests/unit/test_phase56_iteration_start.py` | 1 | threads.py iteration-start source assertion |
| `tests/unit/test_streaming_reliability.py` | 1 | `persist_assistant_message` sync-shape assertion |

These are the classic conftest-mock / API-signature drift rot (same class as the documented
frontend vitest rot and Playwright E2E rot). None touch `evals.py`, `eval_run.py`,
`eval_runner_service.py`, or any eval test. No action taken in 134-03.
