---
phase: 146-operator-foundation
plan: 02
subsystem: auth
tags: [fastapi, access-control, operator-role, audit-log, router-gate, 404-non-discoverable, asyncpg, supabase]

# Dependency graph
requires:
  - phase: 146-01 (operator-foundation schema)
    provides: "live operator_users + operator_audit_log tables (deny-all RLS), org_id stubs — the tables require_operator reads and the floor writes"
  - phase: 090-harness-schema (mig 059) via 146-01
    provides: "append-only audit idioms (plain-uuid actor, free-text action)"
provides:
  - "require_operator — router-level default-deny gate composing get_current_user; byte-identical 404 {\"detail\":\"Not Found\"} on non-membership (non-discoverable, 404-not-403); sole authority (no RLS backstop)"
  - "operator_audit_floor — yield-dependency writing exactly ONE append-only operator_audit_log row per gated ACTION endpoint (off-latency teardown, swallow-on-error); attached PER-ENDPOINT so the mount probe stays floor-exempt"
  - "operator_service.py — is_operator (asyncpg membership seam), write_operator_audit (append-only, off-loop aexec), seed_operators_from_env (idempotent ON CONFLICT DO NOTHING; wired to startup in Plan 03), get_recent_operator_audit + get_operator_record read helpers"
  - "GET /admin/me (identity probe, floor-EXEMPT) + GET /admin/audit (recent-actions feed, floor-attached); /admin/backpressure re-gated (four signals unchanged)"
  - "config swap: OPERATOR_EMAILS replaces the deleted BACKPRESSURE_ADMIN_USER_IDS allow-list + dev fail-open (D-02); local now behaves exactly like prod"
  - "test_146_operator_gate.py — route-enumeration 404 + byte-identity + operator-reachable + floor-writes-once + probe-exempt (the ADMIN-01 non-discoverability regression suite)"
affects: [146-03, 146-04, 146-05, 146-06, 147-operator-control-plane, 148-governance]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Router-level default-deny gate: APIRouter(dependencies=[Depends(require_operator)]) — a future /admin endpoint cannot forget the gate (Pitfall 1, no RLS backstop)"
    - "Byte-identical 404 (HTTPException(404, detail='Not Found')) for non-members — non-discoverable surface (404-not-403)"
    - "Append-only audit floor as a per-action yield-dependency: teardown after response, reads request.state enrich label/action, writes ONE row (no UPDATE), swallow-on-error"
    - "Probe exemption: floor attached per-action-endpoint, NOT at router level, so GET /admin/me mount probes never spam the ledger (Pitfall 4)"
    - "Lazy pool/supabase imports inside operator_service to break the dependencies<->operator_service cycle"

key-files:
  created:
    - backend/app/services/operator_service.py
    - backend/tests/test_146_operator_gate.py
  modified:
    - backend/app/dependencies.py
    - backend/app/api/admin.py
    - backend/app/config.py
    - backend/.env.example
    - backend/tests/conftest.py
    - backend/tests/unit/test_backpressure.py

key-decisions:
  - "Membership read seam is asyncpg (get_pg_pool.fetchrow), driven in tests by patching app.dependencies._pg_pool — the supabase builder mock has zero effect on it (Pitfall 6)"
  - "test_audit_floor_writes_once drives the operator branch via the pool mock (truthy fetchrow), NOT the require_operator override — the override bypasses request.state.operator so the floor would never fire"
  - "operator_audit_floor declares supabase: Depends(get_supabase) and passes it to write_operator_audit so the shared Supabase mock records the insert (the write path stays supabase-py)"
  - "kept settings.environment (deploy/env-layer marker) but deleted its /admin gating role (D-02); refreshed its comment"

patterns-established:
  - "Router-level require_operator gate + byte-identical 404 as the ADMIN-01 keystone reused by every 147+ /admin endpoint"
  - "Per-action operator_audit_floor yield-dependency (probe-exempt) as the by-construction audit floor"

requirements-completed: [ADMIN-01]

# Metrics
duration: 11min
completed: 2026-07-10
---

# Phase 146 Plan 02: Operator Gate + Audit Floor Summary

**Router-level `require_operator` gate returning a byte-identical 404 on every `/admin` route (non-discoverable), a per-action append-only `operator_audit_floor` yield-dependency (probe-exempt), the `/admin/me` probe + `/admin/audit` feed, and the `OPERATOR_EMAILS`-for-`BACKPRESSURE_ADMIN_USER_IDS` config swap that deletes the dev fail-open — the v3.3 access-control keystone.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-10T21:41:41Z
- **Completed:** 2026-07-10T21:52:11Z
- **Tasks:** 3/3 (all auto)
- **Files modified:** 8 (2 created + 6 modified)

## Accomplishments

- **The security keystone:** `require_operator` is attached at the ROUTER level (`APIRouter(prefix="/admin", dependencies=[Depends(require_operator)])`) so a future `/admin` endpoint cannot forget the gate. It composes `get_current_user`, checks `operator_users` membership via the asyncpg seam, and raises `HTTPException(404, detail="Not Found")` — byte-identical to FastAPI's unknown-route 404, so the surface is non-discoverable (404-not-403). The backend runs on the service-role key with NO RLS backstop, so this gate is the sole authority (T-146-01/-02/-06 mitigated).
- **D-02 clean replace:** deleted `_check_backpressure_auth` + the dev fail-open + the `backpressure_admin_user_ids` config field. Non-operators now get 404 even in dev — local behaves exactly like prod. `OPERATOR_EMAILS` (bootstrap-only) replaces the allow-list.
- **The audit floor (D-03):** `operator_audit_floor` is a yield-dependency attached PER-ACTION-ENDPOINT (backpressure + audit, never the router). Its teardown runs after the response (off the latency path), reads an enrich label/action from `request.state`, and writes exactly ONE append-only `operator_audit_log` row (no UPDATE), swallowing errors after logging (T-146-07 repudiation mitigated). The `GET /admin/me` mount probe is floor-EXEMPT so probes never spam the ledger (Pitfall 4).
- **New endpoints:** `GET /admin/me` (operator identity `{id,email,granted_at}` for the Control Room band) and `GET /admin/audit` (recent-actions feed for the ledger card). `/admin/backpressure`'s four signals are unchanged.
- **`operator_service.py`:** `is_operator` (overridable asyncpg membership seam — Pitfall 6), `write_operator_audit` (append-only, off-loop `aexec`, swallow-on-error), `seed_operators_from_env` (idempotent `ON CONFLICT DO NOTHING` — wired to startup in Plan 03), plus `get_recent_operator_audit` + `get_operator_record` read helpers that keep `admin.py` thin.
- **Regression suite green (4/4):** route-enumeration 404 (auto-covers every current + future `/admin` GET route), byte-identity vs unknown route (pins A1), operator-reachable (200 + four signals), and floor-writes-once-but-probe-does-not.

## Task Commits

Each task was committed atomically:

1. **Task 1: operator_service.py + Wave-0 gate test scaffold (RED)** - `3e09c53b` (feat)
2. **Task 2: require_operator gate + operator_audit_floor + config swap** - `b2826b7d` (feat)
3. **Task 3: gate admin.py at router, add /me probe + /audit feed, re-gate backpressure** - `40c03d65` (feat)

## Files Created/Modified

- `backend/app/services/operator_service.py` (new) - membership read, append-only audit write, env seed, feed/probe read helpers
- `backend/tests/test_146_operator_gate.py` (new) - the ADMIN-01 non-discoverability regression suite (4 tests)
- `backend/app/dependencies.py` - `_NOT_FOUND`, `require_operator`, `operator_audit_floor` + route-derived label/action helpers; module-level `operator_service` import
- `backend/app/api/admin.py` - router-level gate; deleted `_check_backpressure_auth`; re-gated backpressure with the per-action floor; added `/admin/me` (floor-exempt) + `/admin/audit`
- `backend/app/config.py` - deleted `backpressure_admin_user_ids`; added `operator_emails`; refreshed `environment` comment
- `backend/.env.example` - added `OPERATOR_EMAILS` (bootstrap-only)
- `backend/tests/conftest.py` - `operator_override` helper fixture + guarded `require_operator` override cleanup in `reset_mocks`
- `backend/tests/unit/test_backpressure.py` - dropped 3 obsolete D-078-07 auth tests; adapted shape + resilience tests to the new gate

## Decisions Made

- **Membership seam is asyncpg, tests patch the pool** — `is_operator` reads via `get_pg_pool().fetchrow`; the non-operator branch is driven by `set_fetchrow_result(None)`, the operator branch by a truthy row. The supabase builder mock has zero effect on this path (Pitfall 6), so tests never touch the real local Postgres.
- **Floor-write test drives the pool (not the override)** — overriding `require_operator` bypasses `request.state.operator = current_user`, so the floor teardown would return early and write nothing. `test_audit_floor_writes_once` uses a truthy pool fetchrow to exercise the REAL gate + floor path; the floor's `Depends(get_supabase)` injects the shared mock so the insert is recorded.
- **Broke the import cycle with lazy imports** — `operator_service` imports `get_pg_pool`/`get_supabase` lazily inside its functions; `dependencies.py` imports `is_operator`/`write_operator_audit` at module level. No circular import (full-suite collection clean, 2370 tests).
- **Added two read helpers beyond the plan's three functions** — `get_recent_operator_audit` (the `/admin/audit` feed) and `get_operator_record` (the `/admin/me` `granted_at`). Keeps `admin.py` thin per the RESEARCH structure; no new exports break the plan's contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted the obsolete Phase-078 backpressure test suite**
- **Found during:** Task 3 (deleting `_check_backpressure_auth` + the `backpressure_admin_user_ids` config field per D-02)
- **Issue:** `backend/tests/unit/test_backpressure.py` pinned the exact D-078-07 behavior this plan deletes — three auth-gating tests (`test_backpressure_200_in_dev` dev fail-open, `test_backpressure_403_in_production_no_config` prod fail-closed, `test_backpressure_200_for_allowed_user`) monkeypatched the now-deleted `settings.backpressure_admin_user_ids` and asserted 200/403 behavior that no longer exists. Left as-is, they would break the suite the moment Task 2 landed the config deletion.
- **Fix:** Deleted the three obsolete auth-gating tests (their behavior is superseded — the 404/non-discoverability contract now lives in `test_146_operator_gate.py`); kept and adapted the two still-valid tests (`test_backpressure_response_shape`, `test_backpressure_redis_unreachable_does_not_500`) to drive as an authenticated operator via the asyncpg pool mock. Rewrote the module docstring to record the D-02 supersession.
- **Files modified:** `backend/tests/unit/test_backpressure.py`
- **Verification:** `pytest tests/unit/test_backpressure.py` → 2 passed.
- **Committed in:** `40c03d65` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Necessary — the plan's own D-02 deletion breaks the old test; adapting it is required to keep the touched surface green. No scope creep (only the file the deletion directly invalidated was touched; `test_backpressure.py` was not in the plan's `files_modified` because the plan implicitly folds it into the D-02 delete).

## Issues Encountered

None during planned work. Verification note: the broad backend unit suite (`tests/unit/`) has **60 pre-existing failures across 18 unrelated files** (`test_sql_service`, `test_sandbox_service`, `test_retrieval_service`, `test_explorer_agent`, `test_lifespan`, `test_multimodal_query`, `test_streaming_reliability`, etc.) — the documented ~92-failure backend rot triaged to Phase 076/077 (memory: `project_e2e_suite_rotted` / 075.4-TEST-TRIAGE). Confirmed OUT OF SCOPE: my commits touch only the operator surface (git-diff verified — none touch `sql_service`/`sandbox_service`/`streaming`/their tests); the failure reasons are unrelated (e.g. `test_lifespan`'s `MagicMock can't be used in 'await'` is in the untouched `assert_action_types_synced` audit-drift guard, and `test_sql_service`'s `DID NOT RAISE "Only SELECT"` is untouched validation logic); and full-suite **collection is clean (2370 tests, no import breakage from the new `operator_service` import)**. Per the SCOPE BOUNDARY rule these are not this plan's to fix.

## Known Stubs

None. All new code is live: the gate performs a real DB membership check, the floor writes real rows, and the read helpers query real tables (returning `[]`/`None` on error is deliberate best-effort, not a placeholder). `granted_at` from `/admin/me` is a real column read.

## User Setup Required

None now. **Deployment parity (operator-gated, at promotion — from Plan 01):** SET `OPERATOR_EMAILS` + REMOVE `BACKPRESSURE_ADMIN_USER_IDS` in Coolify at the same promotion the migrations are pasted into cloud Supabase (docs/DEPLOYMENT-WORKFLOW.md, D-02).

## Threat Flags

None. All security surface introduced (the router gate, the 404 shape, the audit floor, `/admin/me`, `/admin/audit`) is exactly the plan's `<threat_model>` register: T-146-01 (router-level gate + route-enumeration test), T-146-02 (byte-identical 404), T-146-06 (server-side DB-backed authority), T-146-07 (best-effort logged audit write). T-146-03 (405 method-mismatch) accepted as documented LOW residual; T-146-SC N/A (zero package installs). No new trust boundary beyond the register.

## Next Phase Readiness

- **Plan 03 unblocked:** wire `seed_operators_from_env()` into the `main.py` lifespan (mirrors `_migrate_settings_override`), and build the Control Room frontend (probe-gated shield, band, health signals, ledger). The backend probe (`/admin/me`), health (`/admin/backpressure`), and feed (`/admin/audit`) endpoints it consumes are live and gated.
- **D-09 live UAT** (invisible door / zone / ledger-is-receipt) can run once the frontend lands and an operator is seeded.
- No blockers.

---
*Phase: 146-operator-foundation*
*Completed: 2026-07-10*

## Self-Check: PASSED

- Files: operator_service.py, test_146_operator_gate.py, admin.py, dependencies.py, config.py, .env.example, conftest.py, test_backpressure.py, 146-02-SUMMARY.md all present
- Commits: 3e09c53b, b2826b7d, 40c03d65 all found in git log
- Gate suite 4/4 green; adapted backpressure 2/2 green; full-suite collection clean (2370 tests, no import breakage)
