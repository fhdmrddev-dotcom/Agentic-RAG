---
phase: 093-harness-cross-provider-parity
plan: 04
subsystem: api
tags: [ask-user, round-trip, workflow-run, idor, no-leak, continue, ctx-model, harness, cross-provider]

# Dependency graph
requires:
  - phase: 093-01
    provides: "test_093_ask_user_workflow_run_live.py RED scaffold (3 skipped cases) — the F10 live-DB contract this plan flips GREEN"
  - phase: 093-03
    provides: "resolve_workflow_ctx_model(user_settings) -> str — the resolve-never-mutate ctx-model wrapper (D-04/D-05) threaded onto the Continue wf_ctx (build site 3)"
  - phase: 092-07
    provides: "the Continue endpoint's owner-scoped + thread-anchor-confirmed workflow_runs fallback (continue_run Step-1) — the verbatim template D-07 mirrors; the F5/F8 wf_ctx field set preserved"
provides:
  - "submit_ask_user_response resolves a harness workflow_run id via an owner-scoped + thread-anchor-confirmed workflow_runs fallback (F10, D-07) → 200 + publish under the workflow_run id so the harness ask_user subscribe wakes"
  - "Deep's runs-keyed ask_user path is byte-identical and still returns 200 (BRANCH never replace, D-08)"
  - "Cross-user / non-existent / non-anchor workflow_run id → 404 (never 403, no existence leak — T-093-IDOR HIGH)"
  - "The Continue continuation wf_ctx threads the resolved ctx model (D-04 site 3) from the run owner's effective settings"
affects: [harness, runs.py-ask-user, runs.py-continue, 093-05, ask_user-round-trip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-scoped + thread-anchor-confirmed id-namespace BRANCH (not replace): the Step-1 runs SELECT stays first; the workflow_runs fallback engages only after it 404s — Deep byte-identical"
    - "No-leak 404 contract: cross-user, non-existent, and owner-but-non-anchor ids return the SAME indistinguishable 404 (never 403)"
    - "Continue ctx-model threading: load the run owner's effective settings (verified owner = current_user[id]) → resolve-never-mutate wrapper → wf_ctx.model"
    - "Live-DB endpoint test that bypasses the conftest fake-cloud SUPABASE_URL by reading the real local creds from backend/.env (drives the endpoint coroutine directly + asyncpg seeds the same Postgres)"

key-files:
  created:
    - backend/tests/integration/test_093_ask_user_workflow_run_live.py
  modified:
    - backend/app/api/runs.py
    - .planning/phases/093-harness-cross-provider-parity/deferred-items.md

key-decisions:
  - "F10 fix is Option (i) (D-07): the ANSWER endpoint detects a workflow_run id and resolves it via the workflow_runs fallback — NOT the harness storing a producer id (Option ii, rejected: producer id is re-minted per resume/Continue, not stable)"
  - "Continue ctx-model threading prefers loading the owner's effective settings (Open Q2 recommendation) so the resolver fires on Continue; on load failure it falls back to None settings + '' model (phase.config.model still applies) — never blocks the Continue"
  - "The synthesized fallback row carries status:None for parity with the Continue fallback shape, even though status is never read post-Step-1 (verified by reading Steps 2-4)"

patterns-established:
  - "Verbatim mirror of the proven Continue endpoint security gate for the ask_user answer endpoint — same .eq(user_id) owner scope + threads.active_workflow_run_id == run_id anchor confirm + 404-never-403"
  - "A supabase-py endpoint can be live-tested without the HTTP server by building a service-role client from the real local backend/.env creds and invoking the route coroutine directly while asyncpg seeds/inspects the same DB"

requirements: [PARITY-02]

# Metrics
duration: ~9min
completed: 2026-06-02
---

# Phase 093 Plan 04: ask_user Round-Trip Workflow_Run-Id Fallback (F10) + Continue Ctx-Model Threading Summary

**Fixed the harness ask_user round-trip (F10) by adding an owner-scoped, thread-anchor-confirmed `workflow_runs` fallback to the answer endpoint — so a harness prompt's workflow_run id resolves, persists, and publishes on the same `ask_user:{workflow_run_id}:{tcid}` channel the harness subscribes on — while keeping Deep's runs-keyed path byte-identical and returning a no-leak 404 for cross-user/non-anchor ids; also threaded the resolved ctx model onto the Continue continuation (D-04 site 3).**

## Performance

- **Duration:** ~9 min (2026-06-02 14:47 → 14:56 UTC)
- **Tasks:** 2/2 complete
- **Files:** 1 created, 2 modified
- **Commits:** 2 feature commits (+ this docs commit)

## What Was Built

### Task 1 — ask_user_response workflow_run-id fallback (F10, D-07/D-08) — commit `068e4f71`

The harness `llm_human_input` executor stores `run_id = ctx.run_id` (the **workflow_run id**, not a `runs` row) in the durable prompt row and subscribes on `ask_user:{workflow_run_id}:{tcid}`. The frontend POSTs the answer to `/runs/{workflow_run_id}/ask_user_response`, whose Step-1 SELECT queries the `runs` table → 404 for harness. The fix inserts a fallback between the Step-1 SELECT and the `if not row: raise 404`, mirroring the Continue endpoint verbatim.

**The branch logic (runs SELECT first, workflow_runs fallback second — D-08 BRANCH never replace):**

1. **Step-1 (unchanged, FIRST):** `supabase.table("runs").select("run_id, thread_id, status").eq("run_id", run_id).eq("user_id", current_user["id"]).maybe_single()`. Deep's runs-keyed path succeeds here and returns 200 exactly as before — byte-identical.
2. **Fallback (NEW, only when Step-1 misses):** resolve the id as a `workflow_runs` row **under caller ownership** (`.eq("user_id", current_user["id"])`), then confirm the row's thread carries this id as its live `active_workflow_run_id` (`threads.active_workflow_run_id == run_id`). Only then synthesize `row = {"run_id": run_id, "thread_id": wf_self["thread_id"], "status": None}`.
3. **Steps 2-4 (unchanged):** the messages insert, `_emit`, and `publish_response` all run under `run_id` = the workflow_run id. Because `run_id` is now the workflow_run id, `publish_response` hits `ask_user:{workflow_run_id}:{tcid}` — the SAME channel `subscribe_for_response` blocks on (and `resume_pending_prompt` re-subscribes on after a worker restart).

### Task 2 — Continue ctx-model threading (D-04 site 3) — commit `57630943`

The harness Continue branch built its continuation `wf_ctx` with `user_settings=None` and no `model`, so the resolver never fired on Continue. Now, inside the branch (owner already verified at the Step-1 ownership SELECT), it loads the owner's effective settings via the same `load_user_settings(current_user["id"])` loader the kickoff path uses (threads.py:900), resolves the effective model via `resolve_workflow_ctx_model` (Plan 03's resolve-never-mutate wrapper), and sets `user_settings=_owner_settings` + `model=_ctx_model` in the wf_ctx build. Every other wf_ctx field (producer_run_id, inputs, supabase, spawn, per_run_task_semaphore — the F5/F8 substrate) is unchanged. On load failure it falls back to `None` settings + `""` model (phase-level model still applies) so the Continue is never blocked.

## Security — T-093-IDOR (HIGH): the no-leak 404 proof

The fallback is the verbatim owner-scoped + anchor-confirmed gate from the Continue endpoint. The endpoint returns **404 — never 403** for every non-resolving case, so "doesn't exist" and "not yours" are **indistinguishable** (no existence leak):

| Case | Resolution | Response | Asserted by |
|------|-----------|----------|-------------|
| harness workflow_run id, OWNING user, thread anchored | workflow_runs fallback resolves | **200** + publish on `ask_user:{wf_id}:{tcid}` + messages row | `test_ask_user_answer_resolves_via_workflow_run_fallback` |
| real `runs.run_id` (Deep) | Step-1 runs SELECT succeeds (unchanged) | **200** + publish on `ask_user:{run_id}:{tcid}` | `test_deep_runs_id_path_still_200` |
| workflow_run id owned by ANOTHER user | owner-scope `.eq(user_id)` misses | **404** (never 403); nothing published | `test_other_users_workflow_run_returns_404_no_leak` |
| wholly non-existent id | both SELECTs miss | **404** (same as cross-user) | `test_non_existent_id_returns_404` |
| owner's workflow_run but NOT the thread anchor | anchor-confirm gate fails | **404**; nothing published | `test_workflow_run_not_thread_anchor_returns_404` |

The cross-user and non-existent cases both assert `status_code == 404` AND `!= 403` AND `redis.published == []` — the cross-user attacker cannot even tell the id exists.

## Verification

- **F10 live-DB suite GREEN:** `pytest backend/tests/integration/test_093_ask_user_workflow_run_live.py` → **5 passed** against local Supabase (the 3 RED scaffold cases flipped GREEN + 2 added: non-existent 404 + non-anchor 404). The suite drives the `submit_ask_user_response` coroutine directly (no HTTP server) — a service-role supabase client built from the real local `backend/.env` creds (bypassing the conftest fake-cloud `SUPABASE_URL`) + an asyncpg pool seeding the same Postgres + a recording fake Redis that captures the publish channel. **Skips cleanly** when the live DB is down (asyncpg `:54322` probe gates the module; the supabase REST probe skips on any connect failure) — never hard-fails.
- **Continue ctx-model threading in place (D-04 site 3):** `grep -c resolve_workflow_ctx_model runs.py` = 3 (import + call + comment); `python -m py_compile runs.py` exits 0; the wf_ctx build now carries `model=_ctx_model` with `user_settings=_owner_settings`, all other fields unchanged.
- **Unit resolver suite GREEN:** `pytest backend/tests/unit/test_sub_agent_routing.py` → 16 passed.
- **Targeted regression backstop GREEN (zero net-new failures in the touched surface):** the ownership/no-leak + FK + F10 set (`test_092_subagent_parent_fk_live.py`, `test_062_cross_user_404.py`, `test_063_cross_user_no_runid_leak.py`, `test_093_ask_user_workflow_run_live.py`) → **14 passed**.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Live test must bypass the conftest fake-cloud SUPABASE_URL**
- **Found during:** Task 1 (first test run).
- **Issue:** The root `backend/tests/conftest.py` forces `SUPABASE_URL=https://test.supabase.co` at import time (so the rest of the suite uses a mock client). The F10 endpoint uses supabase-py (PostgREST), so the test got `httpx.ConnectError: getaddrinfo failed` against the fake host. The plan assumed an asyncpg-only live test (like `test_092_*_live.py`), but the endpoint's resolution logic lives in the supabase-py HTTP handler.
- **Fix:** the test reads the real local `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` straight from `backend/.env` (names+values at runtime, never printed), builds a fresh `create_client`, probes the REST gate, and skips cleanly on any connect failure (constraint: live DB unreachable → SKIP not FAIL). The endpoint coroutine is then invoked directly with that client + a recording fake Redis.
- **Files modified:** `backend/tests/integration/test_093_ask_user_workflow_run_live.py`
- **Commit:** `068e4f71`

**2. [Rule 1 - Bug] Test-seed used invalid runs.status / param-codec-dependent JSONB assertion**
- **Found during:** Task 1 (second test run).
- **Issue:** (a) the Deep test seeded a `runs` row with `status="paused"`, which violates `runs_status_check` (valid: streaming/cap_paused/completed/failed/cancelled/timed_out). (b) the persisted-message assertion used `tool_calls @> $2::jsonb` with a pre-dumped string param, which the asyncpg jsonb codec double-encoded → 0 matches.
- **Fix:** (a) seed `status="streaming"` (a Deep ask_user pause keeps the run streaming while the handler blocks). (b) switch the assertion to codec-independent JSONB path operators (`tool_calls -> 0 ->> 'kind'` / `->> 'tool_call_id'`).
- **Files modified:** `backend/tests/integration/test_093_ask_user_workflow_run_live.py`
- **Commit:** `068e4f71`

**3. [Open Q2 resolution] Continue loads owner settings (preferred path), with a documented fallback**
- The plan offered loading owner settings OR `phase.config.model`-only. Per Open Q2's recommendation, the implementation loads the owner's effective settings (owner verified at the Step-1 ownership SELECT) so the resolver fires on Continue. If the load raises, it falls back to `None` settings + `""` model with the limitation logged — phase-level `phase.config.model` still applies. Not a regression; this is the intended D-04 root-cause fix.
- **Commit:** `57630943`

## Out-of-Scope (Deferred, NOT fixed)

8 live-DB integration tests in the runs/SSE-stream surface (`test_061_*`, `test_062_*`, `test_063_post_*`) fail with `runs_thread_id_fkey` FK violations — a test-data/environment issue (they seed `runs` rows against thread_ids absent from the current local DB). **Verified NOT a 093-04 regression:** none of these tests reference `ask_user_response`, `continue_run`, or `/continue` (grep = 0 matches), so my diff (which only touches those two code paths) cannot affect them. Logged to `093/deferred-items.md`; relates to the SEED-049 E2E/integration-fixture revival class. The same FK-env failure family was already noted for Phase 091.

## Threat Flags

None — this plan reduces threat surface (it adds a no-leak ownership gate to an endpoint and a resolve-never-mutate model thread); no new network endpoints, auth paths, file access, or schema at trust boundaries.

## Requirements

- **PARITY-02** — traced (the ask_user round-trip + Continue ctx-model half). Stays **OPEN**: the phase verifier owns the native-7 × 5-phase-type × 4-workflow LIVE UAT closure (D-13, authored in 093-VALIDATION.md). Not marked complete here.

## Self-Check: PASSED

- Created/modified files verified on disk: `test_093_ask_user_workflow_run_live.py` (created), `runs.py` (modified), `093-04-SUMMARY.md` (created), `deferred-items.md` (updated) — all FOUND.
- Commits verified in git log: `068e4f71` (Task 1), `57630943` (Task 2) — both FOUND.
