---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 08
subsystem: auth
tags: [rls, multi-tenancy, user-jwt, skills, evals, workflows, settings, audit, org_id, TEN-02, D-03, D-05, D-14]

# Dependency graph
requires:
  - phase: 163-01
    provides: get_user_supabase / get_user_pg_connection / get_service_role_supabase factories
  - phase: 163-05
    provides: migrations 107 (RLS predicates) + 108 (TEN-04) APPLIED + inert; test_163_* GREEN (95/95)
  - phase: 163-06
    provides: the get_user_supabase_client FastAPI-injectable adapter + the request-seam swap pattern + the conftest mirror
provides:
  - "TEN-02 (ADVANCED, not complete): the SKILLS cluster (skills/skill_test_cases/skill_tuner) + the eval-cluster PURE-READ handlers now enforce RLS via the per-request user-JWT client — completing RLS coverage of the request-scoped read/CRUD surface the schema supports"
  - "Schema-driven carve-out map for the eval/workflow/settings/audit domains: the write/reconcile/runner + operator/app-level/no-authenticated-policy paths are cleanly classified service-role (commented exceptions), keeping the grep-gate honest and the plan-09 async-writer boundary clean"
affects: [163-09, 163-10]

# Tech tracking
tech-stack:
  added: []   # no new package
  patterns:
    - "Request-seam client swap (reused from plan 06/07): Depends(get_supabase) -> Depends(get_user_supabase_client) on the request handler; conftest mirror makes it test-transparent"
    - "Two-client detached-writer split (reused from plan 06): user-JWT for request-scoped work + a second service_supabase=Depends(get_supabase) for a detached asyncio.create_task writer (skill_tuner._run_tuner_job)"
    - "Schema-driven classification: swap a handler ONLY when EVERY DB op it performs is RLS-supported under authenticated; else keep service-role with a # service-role: <reason> marker (the plan-07 carve-out discipline, applied per-handler against live :54322 policies)"

key-files:
  created: []
  modified:
    - backend/app/api/skills.py
    - backend/app/api/skill_test_cases.py
    - backend/app/api/skill_tuner.py
    - backend/app/api/evals.py
    - backend/app/api/workflows.py
    - backend/app/db/workflows.py
    - backend/app/api/settings.py
    - backend/app/api/audit.py
    - backend/app/models/user_settings.py

key-decisions:
  - "skills cluster = FULL swap (23 handlers): skills.py (12) + skill_test_cases.py (5) + skill_tuner.py (6) -> user-JWT. Verified live: skills/skill_files own+global + owner-scoped CRUD policies + autofill_org_id triggers exist; skill-files storage is owner-path-scoped under authenticated; capture_skill_version is SECURITY DEFINER (version rows still written). is_global/is_system visibility PRESERVED (test_163_rls_skills: a same-org co-member sees the global skill under authenticated)."
  - "skill_tuner._run_tuner_job kept SERVICE-ROLE (D-05 detached-writer carve-out): start_tuner_run injects a SECOND service_supabase=Depends(get_supabase) for the detached asyncio.create_task job (runs up to ~30 min, can outlive the request Bearer token) — tuner_runs has an authenticated SELECT-own policy but NO INSERT/UPDATE policy, so its upsert would be RLS-DENIED under a user-JWT client."
  - "evals.py PARTIAL swap driven by the schema: the eval-cluster tables (eval_runs/eval_results/eval_ratings/skill_proposals) have authenticated SELECT-own but NO authenticated write policy (verified live). So the 6 PURE-READ handlers swap to user-JWT (get_eval_run/list_eval_runs/list_description_proposals/get_eval_aggregate/get_engine_health/get_eval_run_by_id); the 14 write/reconcile-on-read/runner handlers stay service-role (marked # service-role:) — a user-JWT write would be RLS-DENIED. The eval RUNNER is a plan-09 async writer."
  - "workflow cluster (workflows.py + db/workflows.py) kept SERVICE-ROLE (classified): db/workflows.py is a service-role module BY DESIGN, shared by request routes AND the harness engine, with 5 helpers that own their own pool.acquire() transaction (non-duck-typable). /published + /starters are documented RUN CARVE-OUT feeds and is_global is now org-scoped (test_163_rls_workflow_eval: global renders for a co-member, NOT cross-org) so a user-JWT read would HIDE cross-org starters (not behavior-preserving; is_system_global cross-org = Phase 165). delete_workflow_cascade drives the shared _cancel_run_internals writer + operator audit; generate_workflow delegates to the out-of-scope workflow_authoring service. workflow_* membership-RLS is proven at the DB layer."
  - "settings/audit/user_settings kept SERVICE-ROLE (live-schema-driven; the plan's own acceptance allows 'commented operator/app-settings exceptions only'): audit_log has RLS enabled but ONLY an authenticated INSERT policy (NO SELECT) -> a user-JWT read returns empty; app_settings + user_settings have RLS DISABLED (global config); the settings.py injected client only drives the audit BackgroundTask + the plan-09 re-embed subsystem; user_settings.py's 5 get_pg_pool() calls are all global/operator config (app_settings / model_capabilities_overrides / feature-visibility), not per-user data."

requirements-completed: []   # TEN-02 is phase-spanning: ADVANCED here (skills + eval reads swapped) but completes after 163-09 (async writers) + the 163-10 CONCUR-01 benchmark. Kept Pending (163-01/06/07 precedent).

# Metrics
duration: 36min
completed: 2026-07-19
---

# Phase 163 Plan 08: RLS User-JWT Client Swap — Skills + Workflow-Eval + Identity Cluster Summary

**The skills cluster (skills/skill_test_cases/skill_tuner — 23 request handlers) now enforces RLS via the per-request user-JWT client with the is_global/is_system global branch preserved, and the eval-cluster PURE-READ surface (6 handlers) is RLS-gated — while a live-schema-driven carve-out map keeps the eval writes, the shared/Run-carve-out workflow cluster, the no-authenticated-SELECT audit_log reads, and the RLS-disabled app-level settings on the hardened service-role client (each a commented exception), and cleanly leaves the eval/harness/re-embed async writers to plan 09.**

## Performance
- **Duration:** ~36 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Commits:** 3 per-task + this metadata commit

## Accomplishments
- **THE FLIP landed on the skills cluster.** 23 request handlers swapped `Depends(get_supabase)` (service-role, BYPASSRLS) -> `Depends(get_user_supabase_client)` (per-request ANON-key + Bearer, RLS-ENFORCED): skills.py (12: CRUD + files + import/export), skill_test_cases.py (5), skill_tuner.py (6). RLS (mig 108's membership predicates) is now the primary gate on the skill surface. The `is_global`/`is_system` branch is **preserved + proven** — `test_163_rls_skills` shows a same-org co-member sees a global skill (e.g. the seeded skill-creator) under the `authenticated` role, and `capture_skill_version` (SECURITY DEFINER) still writes version rows on skill create/update.
- **The eval READ surface is RLS-gated (schema-intended split).** The eval-cluster tables carry authenticated SELECT-own but no authenticated write policy, so the 6 pure-read handlers (`get_eval_run`, `list_eval_runs`, `list_description_proposals`, `get_eval_aggregate`, `get_engine_health`, `get_eval_run_by_id`) swapped to user-JWT; the 14 write/reconcile-on-read/runner handlers stay service-role (each marked `# service-role:`).
- **The D-05 detached-writer carve-out reused + extended.** `skill_tuner.start_tuner_run` keeps a second `service_supabase=Depends(get_supabase)` for the detached `_run_tuner_job` (a ~30-min `asyncio.create_task` that upserts `tuner_runs`, which has no authenticated INSERT/UPDATE policy) — mirroring plan 06's producer split.
- **Live-schema investigation drove every carve-out** (psycopg2 @ :54322, per the orchestrator's discipline): confirmed the eval tables are SELECT-only for authenticated; `audit_log` is INSERT-only (no SELECT); `app_settings`/`user_settings` have RLS DISABLED; global workflows have non-NULL org_ids and are org-scoped (not cross-org). Each finding is cited in the code comments so the grep-gate "commented exceptions only" stays honest.
- **Red lines held (D-05 / D-14 / plan-09 boundary).** `eval_runner_service.py` / `harness_engine.py` / `reembed_service.py` / `skill_embedding_service.py` are NOT in this plan's diff (plan-09 owns the async-writer widening). The `.eq("user_id")` / `.or_(...own,global)` belt-and-suspenders filters are intact everywhere (D-14); `run_in_threadpool` wraps every blocking supabase-py call (D-v2.5-01).

## Task Commits
1. **Task 1** — `d4b07572` (feat): skills/skill_test_cases/skill_tuner -> user-JWT (23 handlers); skill_tuner detached `_run_tuner_job` keeps the service-role carve-out; stale "SOLE gate" docstrings corrected to "belt-and-suspenders behind RLS".
2. **Task 2** — `fb7f8734` (feat): evals.py 6 pure-read swaps + 14 service-role classified; workflows.py + db/workflows.py kept service-role (Run-carve-out + shared service-role module + acquire-based helpers + RLS proven at DB layer), documented.
3. **Task 3** — `bb26e38b` (feat): audit.py (2) + settings.py (3) classified service-role; models/user_settings.py documented (global config, no per-user conversion).

## Verification
- **Full `test_163_*` suite: 95 passed** (unchanged from the phase baseline) — the RLS harness (leak/role-swap/factories + the per-cluster `test_163_rls_skills` + `test_163_rls_workflow_eval`) is GREEN through the swap; the is_global co-member visibility + cross-org isolation are proven under the `authenticated` role the user-JWT client uses.
- **Grep-gate:** 0 UNCOMMENTED `Depends(get_supabase)` across the 7 routers (skills=0 / skill_test_cases=0 remaining; skill_tuner=1 carve-out; evals=14 classified; workflows=2 classified; settings=3 classified; audit=2 classified — all with a `# service-role:`/carve-out comment). 6 eval reads on the user-JWT client.
- **Plan-09 boundary:** `git diff` shows NO `eval_runner_service` / `harness_engine` / `reembed_service` / `skill_embedding_service` touched.
- **Task suites (established via a patch-out/patch-in HEAD differential, zero net-new):**
  - Skills cluster: **78 passed / 21 pre-existing failures** IDENTICAL before+after (16 `test_skill_tuner_routes` + 5 `test_132_test_cases` — all fail at the Phase-148 `require_visible("skill_studio")` router gate, before the swapped `supabase` dep resolves).
  - Eval/workflow: **65 passed / 15 pre-existing failures** IDENTICAL at HEAD baseline and post-change (same `require_visible` gate class + `test_thread_workflow_endpoint` shape drift) — none in the 6 swapped read handlers.
  - Settings/audit/user_settings: **53 passed / 0 failed** (`test_audit` 7 + settings/user_settings suites 46) — Task 3 is comment-only, no functional change.
- **App import smoke: OK** across all 9 modified modules.

## Deviations from Plan

### Auto-decided (schema/architecture-driven carve-outs — the plan-07 "investigate rather than blindly swap" discipline)

**1. [Rule 3 - Correctness] evals.py is a PARTIAL swap, not a full swap**
- **Found during:** Task 2 (live-schema investigation @ :54322)
- **Issue:** the plan's objective ("evals.py is the highest-Depends-count router — swap them") assumed the eval surface was swappable, but the eval-cluster tables (`eval_runs`/`eval_results`/`eval_ratings`/`skill_proposals`) have RLS enabled with ONLY an authenticated SELECT-own policy — NO authenticated write policy. A blind full swap would RLS-DENY every eval write (rate/propose/approve/reject/reconcile/runner), breaking the Skill Studio.
- **Fix:** swapped only the 6 pure-read handlers (RLS SELECT-own supports them); classified the 14 write/reconcile-on-read/runner handlers service-role with `# service-role:` markers + a module-level rationale. This is the schema's own intent (SELECT policies exist so reads are RLS-gated; writes flow through service-role paths that plan 09 widens).
- **Files modified:** backend/app/api/evals.py — **Commit:** fb7f8734

**2. [Rule 3 - Correctness] workflow cluster (workflows.py + db/workflows.py) kept service-role rather than converted**
- **Found during:** Task 2
- **Issue:** the plan's D-02 wanted request-scoped `db/workflows.py` pool calls converted to `get_user_pg_connection`. But `db/workflows.py` is a service-role module BY DESIGN (documented header), shared by BOTH the request routes AND the background harness engine on the same helpers; 5 helpers own their own `pool.acquire()` transaction (non-duck-typable to a request Connection). And `/published`+`/starters` are documented RUN CARVE-OUT feeds — global workflows are now org-scoped (proven by `test_163_rls_workflow_eval`: a global renders for a co-member but NOT cross-org), so a user-JWT read would HIDE cross-org starters (NOT behavior-preserving; `is_system_global` cross-org visibility is Phase 165).
- **Fix:** kept the workflow cluster service-role (classified: the 2 `Depends(get_supabase)` sites + a module note + a `db/workflows.py` header note). `workflow_*` membership-RLS is already LIVE + proven at the DB layer; app-code `created_by`/`workflow_run_id` scoping stays the in-code gate (D-14). `delete_workflow_cascade` (destructive cross-user cascade + shared cancel writer + operator audit) and `generate_workflow` (out-of-scope authoring service) are legitimate service-role paths.
- **Files modified:** backend/app/api/workflows.py, backend/app/db/workflows.py — **Commit:** fb7f8734

**3. [Rule 3 - Correctness] audit.py + settings.py + user_settings.py kept service-role (the plan anticipated these as "operator/app-settings exceptions")**
- **Found during:** Task 3 (live-schema investigation @ :54322)
- **Issue:** the plan expected `audit_log` reads to see own-org + null-org rows under a user-JWT client, but the live `audit_log` has RLS enabled with ONLY an authenticated INSERT policy — NO SELECT policy — so a user-JWT read returns EMPTY (plan-07 knowledge_health.py precedent). `app_settings`/`user_settings` have RLS DISABLED (global config), and `user_settings.py`'s 5 `get_pg_pool()` calls are all global/operator config (app_settings / model_capabilities_overrides / feature-visibility), not per-user data.
- **Fix:** classified audit.py (2) + settings.py (3) service-role with `# service-role:` markers; documented `user_settings.py`'s global-config decision in its module docstring. Owner-scoping stays the app `.eq("user_id")` gate (D-14). The plan's own acceptance criterion explicitly allows "commented operator/app-settings exceptions only".
- **Files modified:** backend/app/api/audit.py, backend/app/api/settings.py, backend/app/models/user_settings.py — **Commit:** bb26e38b

**4. [Rule 3 - Blocking] Plan verify commands name non-existent test files -> ran the actual coverage (plan-07 precedent)**
- **Found during:** verification
- **Issue:** the plan's `<automated>` commands reference `tests/test_skills.py` / `test_skill_test_cases.py` / `test_workflows.py` / `test_evals.py` / `test_settings.py`, none of which exist at those paths (only `tests/test_audit.py` does). The real coverage lives under `tests/integration/` + `tests/unit/`.
- **Fix:** ran the actual integration/unit suites + the full `test_163_*` suite; established a pre-change HEAD baseline (patch-out/patch-in) to separate regressions from pre-existing rot.

## Pre-existing failures (NOT regressions — proven zero net-new via HEAD differential)
- Skills cluster: `test_skill_tuner_routes.py` ×16 + `test_132_test_cases.py` ×5 — all fail at the Phase-148 `require_visible("skill_studio")` router gate (403 before the `supabase` dep resolves), independent of the client swap. IDENTICAL 21-fail set before + after Task 1.
- Eval/workflow: `test_evals_router` ×2 + `test_eval_runner` ×3 + `test_139_description_proposals` ×5 + `test_skill_proposals_router` ×4 + `test_thread_workflow_endpoint` ×1 — same `require_visible` gate class + a `/threads` workflow-shape drift. IDENTICAL 15-fail set at HEAD baseline and post-change.

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary schema surface beyond the plan's `<threat_model>` (T-163-08a grep-gate satisfied; T-163-08b is_global preserved; T-163-06b request-scoped BYPASSRLS reads addressed where the schema supports it; T-163-08c background/harness calls left service-role).

## Known Stubs
None — this is a behavior-preserving client-construction swap + schema-driven service-role classification; no placeholder data, no unwired components.

## Self-Check: PASSED
- Files: FOUND all 9 modified source files + `163-08-SUMMARY.md`.
- Commits: FOUND `d4b07572` (Task 1), `fb7f8734` (Task 2), `bb26e38b` (Task 3).
- Gates: `test_163_*` 95/95 (is_global co-member visibility + cross-org isolation proven); grep-gate 0 uncommented `Depends(get_supabase)` across the 7 routers; plan-09 async writers absent from the diff; task suites zero net-new failures vs HEAD baseline.
