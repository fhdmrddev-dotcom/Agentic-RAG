---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 09
subsystem: auth
tags: [rls, multi-tenancy, service-role, org_id, D-05, D-14, TEN-02, eval, harness, reembed]

# Dependency graph
requires:
  - phase: 163-01
    provides: get_service_role_supabase(org_id) — the org-requiring hardened service-role factory (RAISES on a missing org)
  - phase: 163-05
    provides: migrations 107 (RLS predicates) + 108 (TEN-04 org_id on document_chunks/skill_embeddings) APPLIED; test_163_* GREEN
  - phase: 163-06
    provides: the D-05 producer/agent-loop carve-out precedent (db/runs.py optional-org widening) to mirror
provides:
  - "D-05 CLOSED: every remaining fully-async / non-request service-role writer (eval runner, harness engine, golden-run publish helper, re-embed, skill-vector backfill) runs org-aware behind get_service_role_supabase(org_id) — NO bare, org-less service-role client survives on any writer/publish path"
  - "each writer's .eq('user_id') ownership filters are WIDENED org-aware (add an org_id predicate resolved from the run/eval/skill/definition it processes); org_id=None keeps every path byte-identical (D-14 belt-and-suspenders retained)"
affects: [163-10]

# Tech tracking
tech-stack:
  added: []   # no new package
  patterns:
    - "Self-contained org resolution: each writer resolves org_id from the entity it already processes (eval_runs / document_chunks / skills / workflow_run / workflow_definition) via a best-effort bootstrap read, so no classified-retention router (evals.py/settings.py) or agent-loop red-line caller (skill kick) is touched"
    - "Route-through-the-wrapper at the writer's own construction site: get_service_role_supabase(org_id) replaces bare get_supabase() (harness resume, publish fallback) or a resolved org constructs the org-scoped client in-writer (eval_runner run_eval_job, skill_reembed_job) / at the production entry (reembed start_reembed)"
    - "Optional-org widening (mirrors 163-06 db/runs.py): `if org_id is not None: q = q.eq('org_id', org_id)` on reads + writes — byte-identical when the org cannot be resolved (injected-fake unit-test seam)"

key-files:
  created: []
  modified:
    - backend/app/services/eval_runner_service.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/publish_service.py
    - backend/app/services/reembed_service.py
    - backend/app/services/skill_embedding_service.py
    - backend/app/db/workflows.py
    - backend/tests/integration/_reembed_adapter.py
    - backend/tests/test_harness_resume.py
    - backend/tests/test_096_ci_workflow_regression.py
    - backend/tests/test_096_askuser_cleanup.py

key-decisions:
  - "Self-contained org resolution over router threading: eval_runner_service, reembed_service, skill_embedding_service resolve org_id from the entity they process (a best-effort, type-tolerant bootstrap read) instead of threading it from evals.py / settings.py. Rationale: (a) those router handlers are the plan-08-CLASSIFIED service-role RETENTION sites (their Depends(get_supabase) stays by design); (b) the injected-fake unit-test seams (_FakeSupabase / _MockSupabase return empty reads) resolve org_id to None => byte-identical, so the extensive eval/skill unit suites need zero edits; (c) the skill kick's caller is the agent-loop catalog path (D-09 byte-identical red line) — untouchable. org_id=None is a safe, byte-identical fallback everywhere."
  - "harness resume org_id needs a real source: find_resumable_runs did NOT select org_id, and get_service_role_supabase REFUSES a null org (so a bare-singleton fallback that the grep-gate forbids is impossible). Added wr.org_id to find_resumable_runs (db/workflows.py — Rule 3 plumbing) so the live resume run carries it, and seeded org_id on the 3 mock-pool resume-test run stubs (whose pool.fetchval defaults to None). _build_resume_context keeps a defensive pool.fetchval fallback for any caller that omits it."
  - "eval_runner + skill_reembed construct the org-scoped client IN the inner job (guarded by `if org_id:`), NOT in a wrapper: the inner job is the entry the routers/kick spawn, and org_id=None (unit tests) skips construction so the injected fake is used unchanged. reembed constructs in start_reembed (the production entry the adapter tests bypass) so reembed_job stays adapter-injectable."
  - "Fixed _reembed_adapter (test infra, Rule 3): reembed_job's D-10 stale predicate calls .or_('embedding_model.is.null,...') which the asyncpg test adapter never implemented — the LIVE two-user reembed RLS isolation proof (test_111_1_reembed_rls) AttributeError'd + fail-open-swallowed at BASE (0/3 re-embedded). Added .or_() PostgREST-filter support so the D-05 isolation proof actually runs, now proving BOTH user AND org isolation on the real WHERE clause."

requirements-completed: []   # TEN-02 stays Pending until the [BLOCKING] 163-10 CONCUR-01 <1s benchmark + the operator-run D-08 two-user live leak + SC#10 4-axis UAT (163-01/06 precedent)

# Metrics
duration: 125min
completed: 2026-07-19
---

# Phase 163 Plan 09: Org-Aware Service-Role Retention Sites (D-05 Close) Summary

**Every remaining fully-async / non-request service-role writer — the eval runner, the harness engine's resume path, the golden-run publish helper, the re-embed job, and the skill-vector backfill — now constructs its BYPASSRLS client via `get_service_role_supabase(org_id)` (the org-requiring wrapper that REFUSES a missing org) and widens its `.eq("user_id")` ownership filters to org-aware, closing the D-05 async-writer exception with NO bare, org-less `get_supabase()` call site surviving on any writer/publish path — while every `.eq("user_id")` filter is KEPT (D-14) and `org_id=None` keeps each path byte-identical.**

## Performance
- **Duration:** ~125 min
- **Tasks:** 2 (both `type="auto"`, no checkpoints)
- **Commits:** 2 per-task + this metadata commit

## Accomplishments
- **The last bare `get_supabase()` singletons on writer/publish paths are gone (T-163-05b).** `harness_engine._build_resume_context` (`get_supabase()` at the resume F5 site) and `publish_service._drive_golden_run` (the `if supabase is None:` golden-run fallback) now build their service-role clients via `get_service_role_supabase(org_id)`. Grep gate: `get_supabase(` == **0** across all five writer files; `get_service_role_supabase(` present in each construction path.
- **Every widened query carries both `user_id` AND `org_id` (D-05 + D-14).** eval runner (`_gather_tool_evidence` read + `_update_eval_run_status` update), re-embed (batch read + per-row write + both progress counts), skill backfill (owner read), and the harness `_expire_pending_ask_user` raw-asyncpg SELECT each gain a conditional `.eq("org_id")` / `AND org_id = $N` predicate — retained alongside the existing `.eq("user_id")` (never replaced).
- **org_id is resolved from the entity each writer already processes** — `eval_runs.org_id` (eval), `document_chunks.org_id` (re-embed, TEN-04), `skills.org_id` (skill backfill), `workflow_runs.org_id` (harness resume, via `find_resumable_runs`), `workflow_definitions.org_id` (publish). No new lookup was invented where the entity already carries it; no classified-retention router (`evals.py` / `settings.py`) and no agent-loop red-line caller was touched.
- **The re-embed D-05 isolation proof now actually runs.** `test_111_1_reembed_rls` (the LIVE two-user asyncpg-adapter test) was AttributeError'ing + fail-open-swallowing at BASE (the adapter never implemented `.or_()`, which `reembed_job`'s stale predicate calls) → 0/3 re-embedded. Fixed the adapter; the test now proves **both** user AND org isolation on the real two-user WHERE clause.
- **Deep red line held (D-09):** no provider/gateway/agent-loop file in the diff; the writers are DB-only. **D-14 preserved:** all `.eq("user_id")` filters KEPT; `run_in_threadpool` around every blocking supabase-py call intact.

## Task Commits
1. **Task 1** — `e79aeac8` (feat): eval-runner + harness-engine resume + golden-run publish → org-aware service-role via `get_service_role_supabase(org_id)`; `_expire_pending_ask_user` + eval filters widened; `find_resumable_runs` selects `org_id`; 3 resume-test run stubs seeded.
2. **Task 2** — `f0e89989` (feat): re-embed + skill-vector writers → org-aware service-role; `start_reembed` / `skill_reembed_job` construct via the wrapper; `_reembed_adapter.or_()` added so the two-user isolation proof runs.

## Verification
- **Full `test_163_*` suite: 95 passed** — unchanged from the 163-05/06 baseline; the org-aware widening does not regress the RLS/leak proofs.
- **`test_111_1_reembed_rls` (two-user LIVE isolation): PASS** — user A's stale chunks re-embedded (3/3), user B's chunks (model tag + vector) untouched, now exercising both the `.eq("user_id")` AND `.eq("org_id")` scopes on real SQL.
- **`test_111_1_reembed_resume` (resumable/non-destructive): PASS · `test_140_skill_embedding_service` + `test_140_catalog_trim`: 25 PASS.**
- **Harness resume: PASS** (`test_harness_resume`, `test_096_ci_workflow_regression`, `test_094_rc4_failure`, `test_harness_engine`) — the resume ctx builds its org-scoped client; the 3 mock-pool run stubs carry `org_id`.
- **Grep gate:** `get_supabase(` == 0 in eval_runner_service / harness_engine / publish_service / reembed_service / skill_embedding_service; `get_service_role_supabase` present in each.
- **No live server started** (per orchestrator — live UAT is Wave 5). DB at :54322; in-process verification only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `_reembed_adapter.py` `.or_()` support — unblocked the D-05 reembed isolation proof**
- **Found during:** Task 2 (running the plan's named verify `tests/integration/test_111_1_reembed_rls.py`).
- **Issue:** the test's asyncpg `SupabaseTxnAdapter._Query` never implemented `.or_()`, but `reembed_job`'s D-10 stale predicate calls `.or_('embedding_model.is.null,embedding_model.neq."<model>"')`. At BASE the job raised `AttributeError`, was fail-open-swallowed, re-embedded 0/3, and the isolation assertion failed — i.e. the plan's own reembed acceptance test was pre-existing-broken (proven against base).
- **Fix:** added `.or_()` to the adapter (parses the PostgREST `col.op.val` OR-filter into a SQL `(… OR …)` clause) so the LIVE job runs and the two-user isolation is genuinely proven.
- **Files modified:** backend/tests/integration/_reembed_adapter.py — **Commit:** f0e89989

**2. [Rule 3 - Blocking] `find_resumable_runs` selects `org_id` + 3 resume-test run stubs seeded**
- **Found during:** Task 1 (harness resume path).
- **Issue:** `_build_resume_context` must build its service-role client via `get_service_role_supabase(org_id)`, which RAISES on a null org — but `find_resumable_runs` did not select `org_id`, and the mock-pool resume tests' `pool.fetchval` defaults to `None`. A bare `get_supabase()` fallback is forbidden by the T-163-05b grep gate, so the org must genuinely be present.
- **Fix:** added `wr.org_id` to the `find_resumable_runs` SELECT (live runs now carry it) and seeded `org_id` on the run stubs in `test_harness_resume.py` (4 stubs), `test_096_ci_workflow_regression.py`, and `test_096_askuser_cleanup.py` — exactly as real `workflow_runs` rows (NOT-NULL post-162) carry it. `_build_resume_context` keeps a defensive `pool.fetchval` fallback.
- **Files modified:** backend/app/db/workflows.py + the 3 test files — **Commit:** e79aeac8

### Design choice (in-scope, worth recording)
- **Self-contained org resolution over router threading** (see key-decisions): the injected writers resolve `org_id` from the entity they process rather than accepting it from `evals.py` / `settings.py`. This keeps the change to the five writer files, honors plan-08's service-role-retention classification of the eval/settings routers, respects the agent-loop red line (the skill kick's caller), and — because the injected-fake test seams return empty reads → `org_id=None` → byte-identical — required **zero** edits to the large eval/skill unit suites.

## Pre-existing Failures (proven against base — NOT regressions)
All confirmed failing at base with my changes reverted (none touch the code I changed):
- `test_eval_runner.py` (3) + `test_evals_router.py` (2): Phase-148 `require_visible` 403 gate rot (the eval router — untouched by 163-09 — returns "administrators only").
- `test_096_askuser_cleanup::test_pending_route_filters_dead_prompt_keeps_legacy` (1): patches `app.api.panel.get_pg_pool`, which plan-06 removed from `panel.py`.
- `test_harness_gates::test_bounded_retry_reaches_failed_after_3_attempts` (1): pre-existing `_expire_pending_ask_user` mock-fetch `KeyError` (fails identically at base).
- `test_111_1_reembed_kickoff.py` (4): the `_fake_save` returns `None` → `update_settings` raises 500 (a `save_app_settings` test-seam drift, fails identically at base).

## Known Stubs
None — no hardcoded empty values, placeholders, or unwired data paths introduced. Every widened filter is live behind a resolved `org_id`; `org_id=None` is a deliberate byte-identical fallback (D-14), not a stub.

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary schema surface beyond the plan's `<threat_model>` (T-163-05 / T-163-05b / T-163-09 all mitigated: every writer/publish path routes through the org-requiring wrapper; no provider/gateway file in the diff; no new package).

## Self-Check: PASSED
- Files: FOUND all 10 modified files (5 writer service files + db/workflows.py + _reembed_adapter.py + 3 resume test files)
- Commits: FOUND `e79aeac8`, `f0e89989`
- SUMMARY: FOUND `163-09-SUMMARY.md`
- Gates: `test_163_*` 95/95; `test_111_1_reembed_rls` PASS (two-user user+org isolation); grep `get_supabase(` == 0 in all 5 writer files; `get_service_role_supabase` present in each; all other affected-area failures proven pre-existing against base.
