# Phase 098 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY rule: failures/issues NOT directly caused
by the current task's changes are recorded here, not fixed.

## Plan 098-04

### Pre-existing test failure — `test_harness_gates.py::test_bounded_retry_reaches_failed_after_3_attempts`

- **Discovered during:** Plan 098-04 regression sweep (harness test surface).
- **Status:** PRE-EXISTING — reproduced at the plan base commit
  `1d2fd7cd804671d890355b23b30658d6d7e6537a` (proven via a throwaway base worktree),
  before any 098-04 change.
- **Symptom:** `_audit_failures(mock_asyncpg_pool) == 0` (expected 3). The bounded-retry
  fail path crashes in `run_workflow` → `_expire_pending_ask_user`
  (`harness_engine.py:219`) with `KeyError: 'tool_call_id'` — the mock pool's fetch
  rows omit `tool_call_id`, so the audit-failure rows are never written.
- **Root area:** `_expire_pending_ask_user` / the gate retry-audit path + the
  `test_harness_gates` mock fixture data. NONE of these were touched by Plan 098-04
  (which changed only the import area + `_build_resume_context` in `harness_engine.py`,
  the kickoff F5 block in `threads.py`, and the Continue `wf_ctx` in `runs.py`).
- **Disposition:** OUT OF SCOPE for 098-04. Candidate for a harness-gates fixture
  repair (likely a conftest `_MockAsyncpgPool` row missing `tool_call_id`, or a
  `_expire_pending_ask_user` `.get()` hardening) in a future maintenance pass.
