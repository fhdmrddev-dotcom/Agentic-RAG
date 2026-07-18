---
phase: 146-operator-foundation
plan: 03
subsystem: infra
tags: [fastapi, lifespan, asyncpg, operator-role, bootstrap-seed, on-conflict, multi-worker, pytest]

# Dependency graph
requires:
  - phase: 146-02 (operator gate + audit floor)
    provides: "seed_operators_from_env() (idempotent ON CONFLICT DO NOTHING upsert), OPERATOR_EMAILS config, live operator_users table (mig 095)"
provides:
  - "Lifespan wiring: seed_operators_from_env() runs at backend startup after get_pg_pool(), best-effort wrapped (logs + continues, never blocks startup) — the OPERATOR_EMAILS bootstrap is now automatic, no manual SQL (D-01)"
  - "Concurrent-safe operator bootstrap under WORKER_COUNT=2 by construction (the seed's ON CONFLICT (user_id) DO NOTHING — both workers race, first wins, second no-ops; no lock/leader-election)"
  - "test_146_operator_seed.py — the idempotent-seed regression suite (conflict-safe INSERT, parameterized $1::text[] resolve, second-run idempotence, unmatched-email warn+defer, empty-emails no-op)"
affects: [146-04, 147-operator-control-plane, 148-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-worker-safe idempotent startup seed in lifespan: mirror _migrate_settings_override (best-effort try/except after get_pg_pool()), rely on ON CONFLICT DO NOTHING for concurrency instead of a lock"
    - "Recorder-pool seed test: drive an async service fn via _MockAsyncpgPool + patch app.dependencies._pg_pool, assert on the exact recorded (sql, args) — never touch real Postgres"

key-files:
  created:
    - backend/tests/test_146_operator_seed.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Kept the wiring strictly main.py-only (plan files_modified) — did NOT touch the already-shipped/owned operator_service.py; the optional count-info log was omitted because it would require changing Plan 02's seed signature"
  - "Placed the seed block immediately AFTER the settings-migration block so both idempotent per-worker startup writes run adjacently, mirroring the exact best-effort try/except shape (logs on failure, continues)"

patterns-established:
  - "Operator bootstrap = env-seeded, DB-is-truth: OPERATOR_EMAILS resolves auth.users on every startup and upserts conflict-safe; a not-yet-signed-up email warns and re-seeds on a later restart"

requirements-completed: [ADMIN-01]

# Metrics
duration: 3min
completed: 2026-07-10
---

# Phase 146 Plan 03: Operator Seed Lifespan Wiring Summary

**`seed_operators_from_env()` wired into the FastAPI `lifespan` startup after the asyncpg pool is ready — best-effort wrapped (logs + continues), concurrent-safe under `WORKER_COUNT=2` via `ON CONFLICT (user_id) DO NOTHING` — plus the idempotent multi-worker seed regression suite (5 tests) proving parameterized resolve + second-run idempotence + unmatched-email warn/defer.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-10T21:59:44Z
- **Completed:** 2026-07-10T22:02:19Z
- **Tasks:** 2/2 (all auto)
- **Files modified:** 2 (1 created + 1 modified)

## Accomplishments

- **Automatic operator bootstrap (D-01):** the lifespan now calls `seed_operators_from_env()` right after `await get_pg_pool()`, inside a try/except that logs on failure and continues — an exact mirror of the `_migrate_settings_override` block at `main.py:237-243`. The first operator is bootstrapped from `OPERATOR_EMAILS` with **no manual SQL**; the DB table (`operator_users`) is the runtime source of truth, the env var is bootstrap-only.
- **Concurrent-safe by construction:** no lock, no leader-election. The seed's `INSERT ... ON CONFLICT (user_id) DO NOTHING` makes the WORKER_COUNT=2 startup race safe — both workers seed the same rows, the first wins, the second no-ops. A seed failure never blocks startup (best-effort, matching every other lifespan hook in the module).
- **Idempotent-seed regression suite (5/5 green):** `test_146_operator_seed.py` drives `seed_operators_from_env()` through the `_MockAsyncpgPool` recorder (never touching real Postgres). It pins: (1) the INSERT carries `ON CONFLICT (user_id) DO NOTHING` (T-146-08); (2) the `auth.users` resolve is parameterized `$1::text[]` with no email interpolated into the SQL (T-146-05); (3) a second seed run stays conflict-safe (no duplicate-key error surfaces); (4) an unmatched email is warned + deferred, never inserted; (5) empty `OPERATOR_EMAILS` is a pure no-op (zero pool activity).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire seed_operators_from_env into the lifespan startup** - `b8f0b07c` (feat)
2. **Task 2: Idempotent multi-worker seed test** - `98ae1cb2` (test)

## Files Created/Modified

- `backend/app/main.py` (modified) - added the best-effort `seed_operators_from_env()` call in the `lifespan` startup path, adjacent to (after) the settings-migration block, with an explanatory D-01 comment (concurrency, best-effort, warn-and-defer semantics)
- `backend/tests/test_146_operator_seed.py` (new) - the idempotent multi-worker operator-seed regression suite (5 tests)

## Decisions Made

- **Wiring kept strictly `main.py`-only** — the plan's `files_modified` is exactly `main.py` + the test file. `seed_operators_from_env()` (owned + shipped + now tested by Plan 02/03) was NOT modified. The plan's *optional* "log how many operators were resolved" info line was omitted because emitting a count would require changing the seed's return signature in Plan 02's file (out of this plan's declared scope); the seed already logs a WARNING per unmatched email, which gives the operator the notable-case visibility in the uvicorn console.
- **Placed the seed block after the settings-migration block** — both are idempotent per-worker startup writes; grouping them keeps the two "after get_pg_pool()" best-effort writes adjacent and mirrors the exact try/except-logs-and-continues shape.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None during planned work. **Verification note:** the plan's `<verification>` asks for a green *full backend suite*, but per the execution brief `tests/unit/` carries ~60 pre-existing, unrelated failures (the documented backend rot triaged to Phase 076/077 — see 146-02-SUMMARY.md and memory `project_e2e_suite_rotted`). This plan's gate is (a) its own tests green and (b) collection cleanliness — both satisfied: `pytest tests/test_146_operator_seed.py` → **5 passed**, and full-suite collection is clean (**2375 tests collected**, 2370 prior + 5 new, no import breakage from the new test file). My commits touch only `main.py` (a purely additive lifespan block) and a new test file — no unrelated surface.

## Known Stubs

None. The lifespan call is live (it runs the real seed against the real pool at startup); the seed function itself was shipped + is now covered by the new regression suite. The test drives the real service function through a recorder pool — no mocked-away logic.

## Threat Flags

None. The only security-relevant surface is the seed's SQL, which is exactly the plan's `<threat_model>` register: T-146-05 (parameterized `$1::text[]` resolve — asserted) and T-146-08 (seed race under WORKER_COUNT=2 → `ON CONFLICT DO NOTHING` + best-effort try/except — asserted via the second-run idempotence test). No new trust boundary, no package installs (T-146-SC N/A).

## User Setup Required

None new for local dev (`OPERATOR_EMAILS` already documented in `.env.example` from Plan 02). **Deployment parity (operator-gated, at promotion):** set `OPERATOR_EMAILS` in Coolify to the comma-separated emails of already-signed-up users; the seed runs on the next cloud backend startup and bootstraps them into `operator_users` (paired with the migrations 095+096 SQL-editor paste from Plan 01, per D-02 / docs/DEPLOYMENT-WORKFLOW.md).

## Next Phase Readiness

- **The operator role is now fully self-bootstrapping end-to-end** — mig 095/096 live (Plan 01), gate + audit floor + `/admin` endpoints live (Plan 02), and the startup seed wired (this plan). An operator listed in `OPERATOR_EMAILS` is granted on backend start with no manual SQL.
- **Plan 04+ (Control Room frontend) unblocked:** the probe (`/admin/me`), health (`/admin/backpressure`), and feed (`/admin/audit`) endpoints are live + gated, and a seeded operator exists to exercise them (D-09 live UAT can run once the frontend lands).
- No blockers.

---
*Phase: 146-operator-foundation*
*Completed: 2026-07-10*

## Self-Check: PASSED

- Files: `backend/app/main.py`, `backend/tests/test_146_operator_seed.py` — both FOUND
- Commits: `b8f0b07c` (feat, Task 1), `98ae1cb2` (test, Task 2) — both FOUND in git log
- Tests: `pytest tests/test_146_operator_seed.py` → 5 passed; full-suite collection clean (2375 tests, no import breakage)
