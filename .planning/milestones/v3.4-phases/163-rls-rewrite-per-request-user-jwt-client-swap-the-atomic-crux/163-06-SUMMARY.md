---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 06
subsystem: auth
tags: [rls, multi-tenancy, user-jwt, set-local, chat, streaming, org_id, TEN-02, D-05, D-09]

# Dependency graph
requires:
  - phase: 163-01
    provides: get_user_supabase / get_user_pg_connection / get_service_role_supabase factories + _apply_rls_user_context
  - phase: 163-05
    provides: migrations 107 (RLS predicates) + 108 (TEN-04) APPLIED + inert; test_163_* GREEN (95/95)
  - phase: 162.5
    provides: the clean post-extraction send_message seam (run_producer.py owns the producer shell)
provides:
  - "TEN-02 (ADVANCED, not complete): the CHAT/STREAMING hot path (threads.py + runs.py + the workspace/panel/feedback/sandbox cluster) now enforces RLS via the per-request user-JWT clients — the service-role get_supabase singleton is replaced on these request handlers"
  - "get_user_supabase_client: the FastAPI-injectable Depends() adapter over the plan-01 get_user_supabase factory (the router swap seam plans 07/08 reuse)"
  - "the D-05 producer/agent-loop carve-out proven live: run_producer stays service-role; db/runs.py widened org-aware"
affects: [163-07, 163-08, 163-09, 163-10]

# Tech tracking
tech-stack:
  added: []   # no new package
  patterns:
    - "Request-seam client swap: Depends(get_supabase) -> Depends(get_user_supabase_client) (RLS-enforced) on request handlers"
    - "Connectionless pool.* request reads -> `async with get_user_pg_connection(request, current_user) as conn` (SET LOCAL ROLE authenticated)"
    - "Duck-typed pool|Connection: db/workspace + workspace_service take a `pool` that is an RLS conn on the request path / a service-role pool on the agent path — no signature change"
    - "Two-client handler split (send_message / continue_run / cancel_run): user-JWT for request-scoped work + service_supabase=Depends(get_supabase) for the D-05 background producer/writer"
    - "Central conftest mirror: get_user_supabase_client dependency-override tracks the get_supabase override so the existing DB-mock test seam survives the swap"

key-files:
  created: []
  modified:
    - backend/app/dependencies.py
    - backend/app/api/threads.py
    - backend/app/api/runs.py
    - backend/app/api/panel.py
    - backend/app/api/feedback.py
    - backend/app/api/sandbox_outputs.py
    - backend/app/api/workspace.py
    - backend/app/db/workspace.py
    - backend/app/db/runs.py
    - backend/app/services/todos_service.py
    - backend/app/services/workspace_service.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/services/thread_title.py
    - backend/tests/conftest.py
    - backend/tests/test_dual_mode_wiring.py
    - backend/tests/integration/test_085_panel_endpoints.py
    - backend/tests/test_workspace_template.py

key-decisions:
  - "Added an injectable adapter get_user_supabase_client to dependencies.py (Rule 3): the plan-01 get_user_supabase(request, current_user, token) takes an explicit token so it is not directly Depends()-able, and handlers lack the token in scope. The adapter resolves current_user + the bearer token and calls the factory — the shared Depends() seam for 06/07/08."
  - "send_message / continue_run / cancel_run keep a SECOND service_supabase=Depends(get_supabase) for the D-05 carve-out (the detached producer/harness/Deep-continuation + the shared cancel writer stay service-role). Using Depends(get_supabase) — NOT a direct get_supabase() call — so the test override seam still injects the mock and the producer never carries the user-JWT client."
  - "pin_templates_for_run classified as a request-scoped EXCEPTION (the plan permits swapped OR commented-exception): it delegates to the out-of-scope template_service on the raw pool, the thread is already RLS-ownership-gated upstream, and converting it would force pool-patch changes into 3 delicate producer tests. RLS conversion deferred to when template_service is swapped."
  - "db/runs.py stays service-role (raw asyncpg pool, no auth.uid()); load_cap_paused_tool_calls gains an optional org_id predicate threaded from continue_run's RLS-verified run row (belt-and-suspenders); insert_run/insert_assistant_message keep omitting org_id (mig-106 triggers fill)."

requirements-completed: []   # TEN-02 is phase-spanning: ADVANCED here (chat hot path swapped) but completes after the 07/08 router swaps + the plan-09/10 CONCUR-01 benchmark. Kept Pending (163-01 precedent).

# Metrics
duration: 59min
completed: 2026-07-19
---

# Phase 163 Plan 06: RLS User-JWT Client Swap — the Chat/Streaming Hot Path (THE FLIP) Summary

**The chat/streaming cluster (threads.py + runs.py + workspace/panel/feedback/sandbox) now enforces RLS via the per-request user-JWT clients on BOTH DB paths — RLS becomes the real gate on the hottest request path — while the agent-loop producer/writer stays service-role (D-05) and `agent_loop.py`/the provider gateway/`run_producer.py` are byte-unchanged (Deep red line D-09 held).**

## Performance
- **Duration:** ~59 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Commits:** 3 per-task + this metadata commit

## Accomplishments
- **THE FLIP landed on the chat hot path.** 22 request handlers across 6 API modules swapped `Depends(get_supabase)` (service-role, BYPASSRLS) → `Depends(get_user_supabase_client)` (per-request ANON-key + Bearer, RLS-ENFORCED): threads.py (9), runs.py (4), panel.py (3), workspace.py (6), feedback.py (2), sandbox_outputs.py (1). RLS is now the primary gate on chat/streaming/workspace reads + writes.
- **Connectionless BYPASSRLS pool reads on request paths converted to `get_user_pg_connection`** (SET LOCAL ROLE authenticated + both JWT-claim GUC forms): `get_thread_workflow`'s 6 reconcile reads, `panel.get_pending_ask_user` + `get_thread_tasks`, `workspace.upload_template` + `download_raw` (via the duck-typed pool|Connection seam into db/workspace + workspace_service — no signature change; the agent path keeps `ctx.pool`).
- **[BLOCKER FIXED — T-163-06c]** `preflight_workflow_kickoff` (the 162.5-extracted module called synchronously request-scoped from `send_message` BEFORE any INSERT) no longer reads `workflow_runs` via a raw `get_pg_pool().fetchval` (the D-02/Pitfall-6 cross-org BYPASSRLS leak). It runs on `get_user_pg_connection` with `request` threaded through.
- **`thread_title.py` EXPLICITLY classified** (Warning #2, no silent inheritance): its only caller `send_message` awaits it inline pre-producer-spawn, so it inherits the swapped user-JWT client — recorded in a docstring classification.
- **D-05 producer/writer carve-out proven + widened.** `run_producer` (byte-unchanged), the harness/Deep continuations, and the shared cancel/zombie-heal writer keep the service-role client (via a second `service_supabase=Depends(get_supabase)` param). `db/runs.py` (the agent-loop async writer) stays on the raw pool and gains an optional org_id predicate on its ownership read (`load_cap_paused_tool_calls`) threaded from `continue_run`.
- **Deep red line held (D-09):** `git diff 99d6020a HEAD` on `agent_loop.py`, `provider_gateway/`, and `run_producer.py` is EMPTY. **D-14 preserved:** the `.eq("user_id")` belt-and-suspenders filters (18 in threads.py, 10 in runs.py, +…) and `run_in_threadpool` around every blocking supabase-py call are intact.

## Task Commits
1. **Task 1** — `bcc7d6f7` (feat): threads.py + runs.py chat/stream handlers → user-JWT (both DB paths) + the shared `get_user_supabase_client` adapter + conftest mirror.
2. **Task 2** — `a8e53b46` (feat): workspace/panel/feedback/sandbox handlers → user-JWT; db/runs.py widened org-aware; todos_service classified.
3. **Task 3** — `02513cfb` (fix): [BLOCKER] preflight workflow_runs read under RLS; thread_title/build_harness/pin_templates classified.

## Verification
- **CONCUR-01 smoke (`test_058_concurrency.py`): PASS, 0.41s < 1.0s gate.**
- **Full `test_163_*` suite: 95 passed** — RLS still isolates through the swap; the plan-01 `test_163_factories` pass (adapter is compatible).
- Task verify sets: `test_continue` (8/8), `test_147_*` (67/67), `test_085_panel_endpoints` + workspace + feedback + sandbox + todos (72/72), `test_locked_thread_deep_send_refused_409` (the T-163-06c path) GREEN.
- **Deep red line:** agent_loop.py / provider_gateway / run_producer.py byte-unchanged phase-wide.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added an injectable adapter `get_user_supabase_client` to dependencies.py (not in files_modified)**
- **Found during:** Task 1
- **Issue:** the plan-01 `get_user_supabase(request, current_user, token)` factory takes an explicit `token` and so is NOT directly `Depends()`-able; the chat handlers only inject `current_user` (via `get_current_user`, which returns `{id, email}` — not the token). The plan's literal "swap to `Depends(get_user_supabase)`" cannot compile.
- **Fix:** added a thin async adapter `get_user_supabase_client(request, current_user=Depends(get_current_user), credentials=Depends(bearer_scheme))` that resolves the validated identity + the raw bearer token and calls the factory. It is the shared `Depends()` seam plans 07/08 reuse (additive, existing functions byte-unchanged — mirrors plan-01's discipline).
- **Files modified:** backend/app/dependencies.py — **Commit:** bcc7d6f7

**2. [Rule 3 - Blocking] Central conftest mirror so the swap keeps the existing DB-mock test seam**
- **Found during:** Task 1
- **Issue:** the unit/integration suite mocks the DB by overriding `get_supabase` (centrally to `_supabase`, or per-test to a bespoke `sb`). Swapping handlers to `Depends(get_user_supabase_client)` bypasses those overrides → handlers would build REAL user-JWT clients against a placeholder Supabase URL, breaking every test.
- **Fix:** added a dynamic `_user_supabase_override` in `backend/tests/conftest.py` (registered at import + in the autouse `reset_mocks`) that resolves whatever `get_supabase` currently maps to at request time — so both the central mock and per-test local overrides flow through without re-wiring each test.
- **Files modified:** backend/tests/conftest.py — **Commit:** bcc7d6f7

**3. [Rule 3 - Blocking] Test-seam follow-on for the pool→get_user_pg_connection interception change**
- **Found during:** Task 2 + Task 3
- **Issue:** several tests interpose at the module-level `get_pg_pool` with pool-shaped mocks; the conversion moved the seam to `app.dependencies.get_pg_pool` with an `acquire()`→conn RLS shape.
- **Fix:** updated the mock seam in `test_085_panel_endpoints.py` (get_user_pg_connection-compatible mock + patch `app.dependencies.get_pg_pool`), `test_workspace_template.py` (raw-route direct-call tests: `request` arg + dependencies-seam patch), and `test_dual_mode_wiring.py` (`test_locked_thread_deep_send_refused_409` + `patch_get_pg_pool` now patch the dependencies seam). All targeted tests GREEN.
- **Files modified:** the 3 test files — **Commits:** a8e53b46, 02513cfb

### Classified-not-swapped (per the plan's explicit "swapped OR commented-exception" latitude)
- **`pin_templates_for_run`** (workflow_kickoff.py): request-scoped best-effort expiry-extend delegated to the out-of-scope `template_service` on the raw pool; the thread is already RLS-ownership-gated upstream. Classified with a comment; RLS conversion deferred (converting it would force pool-patch changes into 3 delicate producer tests).
- **`build_harness_run_context`** (workflow_kickoff.py): D-05 background/producer path — its injected supabase/pool stay service-role.
- **`db/runs.py`** (agent-loop writer): stays service-role; org-awareness via the mig-106 autofill triggers on INSERT + the optional org_id read predicate.

## Deferred Issues
Pre-existing 162.5 source-drift rot (patch targets removed by the extraction — `insert_run` / `create_streaming_chat`) + a Phase-147 (`_cancel_run_internals`) source-inspection drift + a `/workflows/published` shape drift. **Proven zero net-new:** `test_dual_mode_wiring.py` = **10 failed / 43 passed IDENTICAL at the phase base (99d6020a) and at HEAD**; `test_threads.py` (integration) 4 pre-existing failures likewise. All logged in `deferred-items.md` (out of scope — a test-infra refresh, not a blocker).

## Threat Flags
None — no new network endpoint, auth path, or trust-boundary schema surface beyond the plan's `<threat_model>` (T-163-06a/b/c/d, T-163-05/09 all mitigated).

## Self-Check: PASSED
- Files: FOUND `backend/app/dependencies.py`, `backend/app/api/threads.py`, `backend/app/services/workflow_kickoff.py` (+ the full modified set)
- Commits: FOUND `bcc7d6f7`, `a8e53b46`, `02513cfb`
- SUMMARY: FOUND `163-06-SUMMARY.md`
- Gates: CONCUR-01 0.41s < 1.0s; `test_163_*` 95/95; agent_loop/gateway/run_producer diff EMPTY (Deep red line); test_dual_mode_wiring 10-fail baseline IDENTICAL at base + HEAD (zero net-new)
</content>
</invoke>
