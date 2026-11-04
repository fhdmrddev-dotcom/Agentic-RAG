---
phase: 299-links-to-the-thing-itself
plan: 01
subsystem: backend / links + org-scope
tags: [backend, links, security, org-scope, existence-hiding]
requires: []
provides:
  - "GET /links/{kind}/{item_id} -> LinkTarget {kind, id, org_id, org_name, title, state, audience}; one 404 {\"detail\": \"Not found\"} for every refusal"
  - "app.services.link_resolver: SQL_BY_KIND, POOL_KINDS, lookup, audience_of, to_target, workflow_org(pool, id, *, owner_id), strict_uuid"
  - "app.services.item_org_guard.refuse_if_other_org(row_org_id, active_org_id, *, kind, pool)"
  - "WorkflowRunRead.org_id (additive)"
  - "POST /workflows ?from_definition_id (optional) — the Tweak guard"
  - "backend/tests/unit/fixtures/link_audience_cases.json — the shared audience fixture (12 rows) for 299-04's linkAudience leaf"
affects: [299-03, 299-04]
tech-stack:
  added: []
  patterns:
    - "one constant statement per kind; missing and forbidden share it (no existence oracle)"
    - "pool kinds bind the caller as $2 where an RLS policy is narrower than the read rule"
    - "write guard is a no-op (and no I/O) without an active org — 298 D-03 polarity"
key-files:
  created:
    - backend/app/api/links.py
    - backend/app/services/link_resolver.py
    - backend/app/services/item_org_guard.py
    - backend/tests/unit/test_299_links_route.py
    - backend/tests/unit/test_299_link_resolver.py
    - backend/tests/unit/test_299_write_org_guards.py
    - backend/tests/unit/fixtures/link_audience_cases.json
    - backend/tests/integration/test_299_links_live.py
  modified:
    - backend/app/main.py
    - backend/app/api/workflow_runs.py
    - backend/app/api/threads.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/api/workflows.py
    - backend/app/api/runs.py
    - backend/app/api/schedules.py
    - backend/app/db/schedules.py
    - backend/tests/unit/test_279_org_helper.py
    - backend/tests/unit/test_286_workflows_seam_pins.py
    - backend/tests/fixtures/phase286/workflows_openapi.json
    - backend/tests/fixtures/phase286/workflows_routes.json
    - backend/tests/unit/test_workflow_scheduler.py
    - scripts/build-public-openapi.cjs
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "Run and Expert resolve on the service pool with the caller bound as $2 (P1: workflow_runs_select_own is owner-only; P2: expert_bundles_read_policy has no granted arm); thread and workflow stay on the RLS connection"
  - "link_resolver.workflow_org is OWNER-scoped (created_by = $2): an id of someone else's definition reads like a missing one, so the Tweak 409 never names another user's org (T-299-09)"
  - "refuse_if_other_org accepts a pool or the get_pg_pool factory, awaited only on a mismatch, so the no-op path never resolves a pool"
  - "from_definition_id is Annotated[str | None, Query()] = None so direct callers that omit it get None, not a truthy FieldInfo"
metrics:
  duration: "~1h50m"
  completed: 2026-10-28
  tasks: 3
  commits: 6
---

# Phase 299 Plan 01: Links resolver, run org_id and the write-org guards — Summary

`GET /links/{kind}/{id}` now says whether the caller may open a thread, workflow, run or Expert, and
in which of their orgs. Every refusal is one byte-identical `404 {"detail": "Not found"}`, and each
kind runs one statement for missing and forbidden alike. The run read carries `org_id`. Every write
reachable from an item page now either takes the item's org from its row, or is refused with a
sentence that names that org.

## What was built

**Task 1: the resolver** (`538d200cb` RED, `cc2875ee5` GREEN)
- `app/services/link_resolver.py` has one constant SQL per kind:
  - thread: owner (RLS adds org membership).
  - workflow: owner, or a system-global published workflow. No org-member arm (D-33).
  - run: the owner at any status, or any member of the run's org once the run has finished (D-34, the `_ACCESS_SQL` rule).
  - Expert: system; or a member of the bundle's org where the bundle is org/public, theirs, user-granted, or granted to their role in that org. A disabled bundle opens only for an `experts:manage` holder in that org.
- The module also has `audience_of` and `to_target`. `to_target` returns a null org for global and system items (D-35).
- `app/api/links.py`: a router-level 401 with `WWW-Authenticate: Bearer`. The strict UUID and kind check runs before any I/O, and `NOT_FOUND_DETAIL` is the only refusal body. It never uses `get_active_org_id`, `require_capability` or `require_visible`.
- `main.py`: one `include_router(links.router)`.
- `WorkflowRunRead.org_id` (D-10): one field, filled from the column the select already reads. No new branch.
- `build-public-openapi.cjs`: adds the `links` tag and the `/links/` flagged prefix.

**Task 2: the refusing guards** (`835a72485` RED, `05dbd5e8b` GREEN)
- `app/services/item_org_guard.py` holds the three S8 sentences and an unnamed-org fallback. It is a no-op without an active org.
- One call each in `send_message` (chat), `preflight_workflow_kickoff` (run) and `create_draft` (tweak, through the new optional `from_definition_id` query param).

**Task 3: row-org stamps and OpenAPI** (`fdcf93df4` RED, `437809ef7` GREEN)
- The ask_user answer is stamped with the run's `org_id`.
- `create_schedule` has a keyword-only `org_id`. Without it, the SQL is byte-identical to base (sha256 pinned).
- A new schedule takes your own workflow's org. For a global workflow it takes the active org, and with neither it falls to the trigger.
- The OpenAPI snapshot and public spec were regenerated, and `--check` reports them current.

## Planner corrections P1 / P2 (re-verified against `supabase/full-schema.sql`)

- **P1, run.** `workflow_runs_select_own` is owner-only (`org_id IN current_user_org_ids() AND auth.uid() = thread owner`). On the user-JWT connection the D-34 member arm could never match. The run kind therefore runs on the pool with `$2` = the caller, copying `workflow_run_evidence._ACCESS_SQL`.
- **P2, Expert.** `expert_bundles_read_policy` has no granted arm. The Expert kind runs on the pool with `$2` = the caller. The `experts:manage` arm is written inline (`org_members m2 JOIN role_permissions rp`), because `auth.uid()` is NULL on the pool. The schema's grant columns are `grantee_type` / `grantee_id` (text), which matched the research text.

The live suite tested both by planting defects: replacing the run terminal-status arm, or the Expert role-grant arm, with an always-true condition turns `test_299_links_live.py` red. Planting `TRUE OR` over the workflow owner arm does **not** turn it red, because RLS still enforces the rule on an RLS kind.

## Write inventory (D-18 / D-38)

| Write from an item page | Disposition |
|---|---|
| Send / typed Continue on a non-Expert chat | **guard added**: 409 "This chat is in {Org}. Switch to {Org} to keep chatting." (before the typed Continue, the preflight and the INSERT) |
| Send on an Expert chat | resolves from row (`_require_thread_org`, unchanged, fires first) |
| Workflow kickoff from a chat | **guard added**: 409 "This workflow is in {Org}. Switch to {Org} to run it." (non-global only) |
| Tweak (`POST /workflows?from_definition_id=`) | **guard added**: 409 "This workflow is in {Org}. Switch to {Org} to make your own copy." (only for your own non-global source; an unreadable source is silent) |
| ask_user answer | **stamped from the row**: the message carries the run's `org_id` |
| New schedule | **stamped from the row**: your workflow's org, else the active org, else the trigger |
| Deep Continue, Stop, Save draft, Expert start-chat, Install, Handoff | resolves from row (unchanged) |

Polarity: with no active org, every guard is a no-op with no I/O, so a header-less caller gets exactly today's behaviour.

## Gate verdicts (verbatim)

- Backend baseline (`node scripts/check-backend-unit-baseline.cjs`, under the local-DB lock): `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` The summary line was `69 failed, 10418 passed, 1 skipped, 2 xfailed, 2 xpassed`. The failures named in this plan's area were each proven inherited:
  - `test_071_1_threadpool_sweep` (two cases): they scan `documents.py`, which is untouched.
  - `test_db_runs` (three cases): `db/runs.py` is untouched.
  - `test_phase56_iteration_start`: the asserted string is absent from base `threads.py` (`git show 593068492:… | grep -c` = 0).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/299-links-to-the-thing-itself`: `ledger gate OK — every watched file has a row.`
- `node scripts/check-claude-md-size.cjs`: `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (102,889 chars)
- `node scripts/build-public-openapi.cjs --check`: `build-public-openapi --check OK — docs/public/api/openapi.public.json is current (226/268 paths, 311 schemas, version 4.5).`
- Live suite `tests/integration/test_299_links_live.py`: **ran and passed** against local Postgres :54322, inside one always-rolled-back transaction (local-DB lock held). It covers the matrix of owner, second member (finished vs running run), non-member, user and role grantee, the manager on a disabled Expert, a random UUID, and the anon role.
- Targeted suites: 299 ×3 + 279 + 286 + 298 foreign binding + every unit file importing `workflow_runs` / `workflow_kickoff` / schedules / ask_user all pass, apart from the inherited cases above. One more failure, `tests/test_096_askuser_cleanup.py::test_pending_route_filters_dead_prompt_keeps_legacy`, sits outside `tests/unit`. It fails because it patches a missing `app.api.panel.get_pg_pool`, and `panel.py` is untouched.

## Deviations from Plan

### Auto-fixed issues

1. **[Rule 2 - Security] `workflow_org` is owner-scoped.** The planned `workflow_org(pool, id)` read any definition's org on the pool. A Tweak with someone else's definition id would then 409 with that definition's org name, which makes it an existence oracle (T-299-09). The function now takes `owner_id`, and its SQL is `WHERE d.id = $1 AND d.created_by = $2`. The schedule route uses the same read: `get_definition` returns no org column, and `db/workflows.py` stays unedited. Files: `link_resolver.py`, `workflows.py`, `schedules.py`. Commits: `05dbd5e8b`, `437809ef7`.
2. **[Rule 1 - Bug] `from_definition_id` default.** The planned `Query(None)` default leaves a truthy `FieldInfo` for direct callers, such as the 298 harness that calls `create_draft` directly. It is now `Annotated[str | None, Query(...)] = None`, and a test pins it.
3. **[Rule 3 - Blocking] `link_resolver.strict_uuid`.** `workflows.py` had no strict-UUID helper. One canonical-form parser now lives in `link_resolver` rather than as a new module-level regex in a FIRING file.
4. **[Rule 3 - Blocking] The guard's `pool` argument accepts the `get_pg_pool` factory.** Passing `pool=await get_pg_pool()` as planned would resolve a pool on every send, even on the no-op path. That breaks the "no I/O" behaviour and every unit send test that does not patch the pool. The factory is now awaited only on a mismatch.
5. **[Rule 1 - Fence re-targeted] `test_279_org_helper.py::test_a_plain_thread_in_another_org_is_not_refused`.** This test asserted exactly the behaviour D-18 changes. It was renamed `…_by_the_expert_helper` and re-targeted with the dated reason in its body. It still proves that the Expert helper does not fire on a plain thread and that the refusal comes before every write.
6. **[Rule 3] 286 fixtures.** `PIN286_CAPTURE=1` was run once and each diff was read. `workflows_openapi.json` changed +28/−8 (one parameter, plus key re-ordering) and `workflows_routes.json` +3/−1. A line-ending-only rewrite of `workflows_moved_ast.json` was restored. These fixture files were not in the plan's file list.
7. **[Rule 3] `test_workflow_scheduler.py`'s `_RecordingPool` gained `fetchval`** (returning `None`). The fake did not model the pool's `fetchval`, which the schedule route now uses.

## Known Stubs

None.

## Threat Flags

None. The new surface (`/links`, the guards and the stamps) is the plan's own threat register: T-299-01..10 are all mitigated or accepted as written. T-299-09 is mitigated more strictly than planned (deviation 1).

## Deploy notes (operator)

No migration ships with this plan. After deploy, run `get_advisors(security)`: no new table, function or grant was added, so the advisor should show no new finding.

## TDD Gate Compliance

Each task has a `test(299-01)` RED commit before its `feat(299-01)` GREEN commit (538d200cb → cc2875ee5, 835a72485 → 05dbd5e8b, fdcf93df4 → 437809ef7). Each RED run was observed failing for the expected reason before GREEN.

## Self-Check: PASSED

- All 8 created files exist on disk.
- All 6 commits exist on `develop` (`git log 593068492..HEAD`).
- `STATE.md` and `ROADMAP.md` were not modified.
