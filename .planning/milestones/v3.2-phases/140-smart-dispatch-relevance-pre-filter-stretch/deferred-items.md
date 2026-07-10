# Phase 140 — Deferred / Out-of-Scope Items

Discoveries logged during execution that are OUT OF SCOPE for the current plan
(pre-existing failures NOT caused by this phase's changes — do not fix here).

## Pre-existing test rot (baseline failures, unrelated to Plan 04)

Discovered during Plan 04's regression sweep of `run_agent_loop`-driving suites.
All 8 fail **identically against the pre-140-04 `agent_loop.py`** (verified by
temporarily restoring the base file), so they are baseline rot, NOT a Plan 04
regression. Root cause is upstream of the pre-filter: the `send_message` handler
aborts with `User-message INSERT did not return id` (`threads.py:1046`) because the
mock supabase in these suites returns no id on the user-message INSERT — the
TestClient/mock-supabase rot pattern already noted in project memory
(`project_frontend_vitest_rot` / backend equivalents). The agent loop's catalog
block (where Plan 04 lives) is never reached in these tests.

Failing (baseline):
- `tests/unit/test_forced_emit.py::test_forced_emit_judge_verdict_unmocked`
- `tests/test_dual_mode_wiring.py::test_published_workflows_list_endpoint`
- `tests/unit/test_explorer_agent.py::TestSendMessageAgentModeBranching::*` (6 cases)

Disposition: leave for a dedicated test-rot revival pass (SEED-049/SEED-056 family).
Not folded into Phase 140.
