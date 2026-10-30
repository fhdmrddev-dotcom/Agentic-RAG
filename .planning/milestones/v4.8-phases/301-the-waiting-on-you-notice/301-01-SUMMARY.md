---
phase: 301-the-waiting-on-you-notice
plan: 01
subsystem: backend-notifications
tags: [backend, route, migration, realtime, security, mutates-local-db]
requires:
  - migration 218 (public.notifications + its triggers) applied locally
provides:
  - GET /notifications (WaitingNotices wire contract for 301-02)
  - app.db.notifications.LIST_OPEN_SQL + list_open_notices
  - migration 219 (notifications in supabase_realtime) + supplement section 4 line
affects:
  - docs/public/api/openapi.snapshot.json / openapi.public.json
tech-stack:
  added: []
  patterns:
    - pool read with the caller bound as $1 in every access predicate (links.py / link_resolver posture)
    - router-level _require_bearer (401 + WWW-Authenticate before any I/O)
    - idempotent DO-block publication add + read-only VERIFY select
key-files:
  created:
    - supabase/migrations/219_notifications_realtime.sql
    - backend/app/api/notifications.py
    - backend/tests/unit/test_301_notifications_route.py
    - backend/tests/unit/test_301_migration_219_shape.py
    - backend/tests/integration/test_301_notifications_live.py
  modified:
    - backend/app/db/notifications.py
    - backend/app/main.py
    - scripts/build-public-openapi.cjs
    - scripts/full-schema-supplement.sql
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
decisions:
  - "301-01: GET /notifications runs on the pool; the caller is $1 in both the recipient predicate and the org_members join, so the statement IS the access wall (D-27)"
  - "301-01: a notice is listed only while its run is active or paused, so a swallowed 218 close never shows a stale notice (F10)"
  - "301-01: supabase/full-schema.sql NOT regenerated in the agent shell (docker denied; worktree project id differs) and NOT hand-edited — operator step named below (D-35)"
metrics:
  duration: ~45 min
  completed: 2026-10-30
  tasks: 3
  files: 11
---

# Phase 301 Plan 01: GET /notifications and migration 219 Summary

`GET /notifications` lists the caller's open waiting-run notices across every org they belong to (pool read with the caller bound as `$1` in both the recipient predicate and the membership join, active/paused status wall, origin, true window total, 50-row cap). Migration 219 adds `public.notifications` to the `supabase_realtime` publication as a hint channel. The OpenAPI snapshot is regenerated in the same commit as the route.

## What was built

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | RED: route contract, 219 shape, cross-org live read | `4cdf5f37a` | 3 test files |
| 2 | GREEN: migration 219 + supplement section 4, applied locally | `00a01901d` | `219_notifications_realtime.sql`, `full-schema-supplement.sql` |
| 3 | GREEN: GET /notifications, mounted, OpenAPI regenerated | `de582979c` | `api/notifications.py`, `db/notifications.py`, `main.py`, `build-public-openapi.cjs`, both OpenAPI JSON files |

### Wire contract (301-02 mirrors these names)

`GET /notifications` → `200 {"notices": [{"id", "run_id", "org_id", "org_name", "workflow_name", "kind": "question"|"approval", "origin": "app"|"schedule"|"key"|null, "created_at"}], "total": int}`. No bearer → `401 {"detail": "Not authenticated"}` + `WWW-Authenticate: Bearer`, before any database I/O.

## TDD gate record

**RED (Task 1, before any code):** `15 failed, 7 errors`, broken down as:
- 7 errors: `ModuleNotFoundError: No module named 'app.api.notifications'` (route unit)
- the 219 shape cases: `_migration("219")` found no file (`AssertionError: []`), plus the supplement case (no notifications block)
- 9 failures: `AttributeError: module 'app.db.notifications' has no attribute 'LIST_OPEN_SQL'` (8 live cases + the statement source scan). Each live case first passed its own non-vacuity check (218's real trigger wrote the open notice), so the seeding was proven before the missing constant failed it.
- publication case: `assert 0 == 1` (notifications not yet in `supabase_realtime`)

**GREEN after Task 2:** `7 passed, 8 failed`. The 8 failures were all the `LIST_OPEN_SQL` AttributeError, as planned. The 5 shape cases, the publication case and `test_a_chat_ask_user_writes_no_notice` passed.

**GREEN after Task 3:** `59 passed` with zero skips under `-rs` (route unit, 219 shape, `test_300_notification_drainer.py` with `LIST_OPEN_SQL` now in its parametrized `*_SQL` scan, `test_276_openapi_snapshot_fresh.py`, the live suite, and the 300 chat-ask exclusion).

Gate sequence in git: `test(301-01)` `4cdf5f37a`, then `feat(301-01)` `00a01901d` and `de582979c`. No refactor commit was needed.

## Verification

- Migration 219 applied LOCALLY through the backend venv's asyncpg, one transaction per apply (the SQL-editor equivalent), under the local-DB lock:
  - `apply #1: migration_219_verify = PASS`
  - `apply #2: migration_219_verify = PASS` (idempotent)
- `node scripts/build-public-openapi.cjs --check`: `build-public-openapi --check OK — docs/public/api/openapi.public.json is current (228/270 paths, 314 schemas, version 4.5).`
- `frontend/src/docs/__tests__/publicOpenapi.test.ts`: 15/15 passed (`GSD_VITEST_MAX_WORKERS=2`).
- Backend unit baseline gate (`node scripts/check-backend-unit-baseline.cjs`): `[GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).` Summary line: `70 failed, 10728 passed, 1 skipped, 2 xfailed, 2 xpassed, 61 warnings in 580.49s`.
- Acceptance greps: `include_router(notifications.router)` = 1 in main.py; `run_in_threadpool|get_active_org_id|get_user_pg_connection` = 0 in api/notifications.py; `"/notifications"` = 1 in build-public-openapi.cjs and 1 in the snapshot; the route file and the snapshot are in the same commit (`de582979c`). For 219, comment-stripped `replica identity` = 0 and `grant|revoke|create policy|create function` = 0. In the supplement, `ADD TABLE public.notifications` = 1 and `219 (notifications)` = 1.
- The local-DB lock was taken for each DB step (Task 1 RED run, Task 2 apply + verify, Task 3 live run) and released after. It does not exist at the end of the plan.

## D-35: full-schema.sql was NOT regenerated (operator step owed)

`bash scripts/regenerate-full-schema.sh` refused in the agent shell: `Error: Supabase is not running locally.` Its `supabase status` check derives the project id from the worktree directory (`supabase_db_agent-ab2a9768afd94b998`, which does not exist). The script also needs `docker exec`, and `docker` is denied in this agent shell. Per D-35, `supabase/full-schema.sql` was **left unchanged and not hand-edited**.

**OPERATOR STEP (named, never silently skipped):** from the main checkout, after 219 is applied locally (it already is: VERIFY read PASS twice), run `bash scripts/regenerate-full-schema.sh` with no `--reset`. Expect the supplement's new section 4 line (`DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; ...`) to appear in `full-schema.sql`, and expect no other diff. Then commit `full-schema.sql` on its own.

## Cloud parity (T-301-10, accepted)

Migration 219 has NOT been applied to cloud. At deploy, the operator pastes it into the cloud SQL editor with per-action approval, requires `migration_219_verify = PASS`, then runs `get_advisors(security)`. Nothing in this plan touched the cloud project.

## Ledger triples for 301-03 Task 3 (CLAUDE.md recipe, measured at `de582979c`)

| File | commits / phases / lines |
|---|---|
| `backend/app/api/notifications.py` | 1 / 1 / 107 |
| `backend/app/db/notifications.py` | 3 / 2 / 384 |
| `backend/app/main.py` | 99 / 73 / 1021 |
| `scripts/build-public-openapi.cjs` | 13 / 7 / 473 |
| `scripts/full-schema-supplement.sql` | 27 / 19 / 891 |

(Six-digit quick-task buckets were subtracted. `build-public-openapi.cjs` reads `13 / 7` against the ledger's `11 / 5`. That gap is in the recipe's bucket parsing, not something this plan did. 301-03 should re-derive it rather than copy either figure.)

## Deviations from Plan

**1. [Rule 3 - Blocking] The live suite seeds a thread and a published definition per org**
- **Found during:** Task 1
- **Issue:** 218's ask trigger only writes a notice for a prompt in the run's OWN thread (300-SECURITY UF-1). The 300 `_world` has one thread in org A, so a waiting run in org B needs its own thread.
- **Fix:** `_world` creates `thread_b` and `def_b` ("Vendor Check") in org B. The B row's expected `workflow_name` is "Vendor Check". A's is "Compliance Gap Report", as the plan specified.
- **Files:** `backend/tests/integration/test_301_notifications_live.py`
- **Commit:** `4cdf5f37a`

**2. [Rule 3 - Blocking] "Waited longest" needs an explicit age shift**
- **Found during:** Task 1
- **Issue:** `now()` is fixed for the whole transaction, so two notices written in one test tie on `created_at`.
- **Fix:** an `UPDATE public.notifications SET created_at = created_at - interval` on B's notice. This is an UPDATE, never an INSERT. Notices still come only from the trigger.
- **Commit:** `4cdf5f37a`

**3. Ended-run case closes the gap with the plan's second option**
- The plan offered disabling 218's status trigger OR setting `closed_at` back to NULL after the update. I took the second, so the test holds no ACCESS EXCLUSIVE lock on `workflow_runs`. A non-vacuity assert confirms the notice really is open before the list is read.

Otherwise the plan executed as written.

## Known Stubs

None.

## Threat Flags

None. The only new surface is `GET /notifications` and the publication membership, and both are in the plan's threat register (T-301-01..10).

## Self-Check

## Self-Check: PASSED

- FOUND: the 5 created files (`219_notifications_realtime.sql`, `api/notifications.py` and the three test files)
- FOUND: commits `4cdf5f37a`, `00a01901d`, `de582979c`
- The local-DB lock file is absent at the end of the plan
- STATE.md and ROADMAP.md were not modified (the orchestrator owns them)
