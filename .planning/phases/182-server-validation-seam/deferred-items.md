# Phase 182 — Deferred Items (out-of-scope discoveries)

Logged per the executor SCOPE BOUNDARY rule: discovered while running adjacent suites,
NOT caused by any Phase-182 change, NOT fixed here.

## D1 — `_build_resume_context` refuses the service-role client without an org_id

**Discovered:** 2026-07-25, during plan 182-04 (running `tests/test_098_scope_governance.py`
as the caller-compatibility gate for the new `FolderScopeSubsetError`).

**Symptom:** `tests/test_098_scope_governance.py::test_run_start_resolution` fails with
`ValueError: get_service_role_supabase requires an explicit org_id`, raised at
`backend/app/services/harness_engine.py:1532` — i.e. BEFORE the
`assert_folder_scopes_subset` call the test is actually about (`harness_engine.py:1588`).

**Root cause (unverified, out of scope):** the v3.4 org hardening (`dependencies.py:228`,
`get_service_role_supabase` refuses a falsy `org_id` — D-05) landed after this Phase-098
test was written. The test's fabricated `run` dict carries no org, so the resume-context
builder refuses to mint the BYPASSRLS client. Test rot, not a product defect — the refusal
is the intended hardened behavior.

**Proven pre-existing:** the identical failure reproduces with the phase-start
(`702d6196`) copy of `harness/scope.py` — same 1 failed / 5 passed. Zero net-new.

**Not fixed because:** unrelated file (`harness_engine.py` / the test's own fixture), no
causal link to the folder-scope keying change, and fixing it means deciding what org a
resumed run's service-role client should assume — a v3.4 org-model call, not a 182 call.

**Re-open trigger:** the next phase that touches `harness_engine._build_resume_context`
or the Phase-098 scope-governance suite.

## D2 — `tests/test_dual_mode_wiring.py` source-drift + resume-context rot (15 failures)

**Discovered:** same session, running the adjacent suites that reference `folder_scope` /
`workflow_kickoff`.

**Symptom:** 15 failures in `tests/test_dual_mode_wiring.py` — a mix of source-text
assertions that no longer match `runs.py` (e.g. `assert '("completed", "failed",
"cancelled", "timed_out")' in src`) and the same `_build_resume_context` org_id refusal
as D1.

**Proven pre-existing:** the SAME command against the phase-start source produces an
identical `15 failed, 82 passed, 1 xfailed`. Zero net-new from plan 182-04.

**Not fixed because:** same-class rot in files this plan never touches; the fix-attempt
limit and scope boundary both apply.

**Re-open trigger:** any phase that touches `api/runs.py`'s cancel/terminal-state vocabulary
or `harness_engine._build_resume_context`.
