---
phase: 147-operator-control-plane
plan: 02
subsystem: api
tags: [fastapi, redis, asyncpg, operator, health-probe, active-runs, audit-floor, admin]

# Dependency graph
requires:
  - phase: 146-operator-foundation
    provides: "admin.py require_operator router + operator_audit_floor yield-dependency + /backpressure + /me exempt precedent"
  - phase: 145-fnd-01
    provides: "run_lifecycle owner (runs:active mirror) + run_reconciler._is_chat_orphan stream-age oracle"
provides:
  - "GET /admin/backpressure additive dependencies.{redis,supabase,sandbox} block (state + latency, 3-state sandbox)"
  - "GET /admin/runs cross-user active-runs list with chat/workflow/eval/tuner kind badges + killable + not_responding"
  - "POST /admin/control-plane/record (D-07 visit/refresh ledger row, server-owned label/action)"
  - "health_probe.py probe_redis/probe_supabase/probe_sandbox/probe_dependencies"
  - "ActiveRun response shape the downstream frontend (147-06/07) consumes"
affects: [147-06, 147-07, 147-09, frontend-active-runs, frontend-health-signals, control-room-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-health probe: {state, latency_ms} best-effort, never raises out of the endpoint; 3-state sandbox (off-by-config != down)"
    - "D-Q1 Option A run-kind derivation (no migration): runs-row presence + eval_runs.id + threads.active_workflow_run_id"
    - "Floor-exempt poll GETs + one floor-attached record endpoint for deliberate rows (D-07)"
    - "Read-only reuse of run_reconciler._is_chat_orphan as the not_responding oracle"

key-files:
  created:
    - backend/app/services/health_probe.py
    - backend/tests/test_147_health_probe.py
    - backend/tests/test_147_active_runs.py
  modified:
    - backend/app/api/admin.py
    - backend/tests/test_146_operator_gate.py

key-decisions:
  - "user_email + eval + workflow enrichment via 3 additional asyncpg SELECTs over the active id set (all metadata-only, no thread content)"
  - "Workflow split = a run whose thread carries an active_workflow_run_id; eval split = eval_runs.id == run_id (companion UUID)"
  - "not_responding degrades to False on any oracle exception (never a false 'not responding' tag on a Redis hiccup)"
  - "/backpressure demoted to floor-EXEMPT (D-07) — repointed the 146 floor-writes-once regression to /admin/audit"

patterns-established:
  - "Probe contract: latency_ms only for 'up'; 'down'/'off' carry None; asyncio.gather runs the three concurrently"
  - "Server-owned event Literal → hardcoded (label, action) so no client string reaches operator_audit_log (T-147-13)"

requirements-completed: [ADMIN-02]

# Metrics
duration: 30min
completed: 2026-07-11
---

# Phase 147 Plan 02: ADMIN-02 Read Surface Summary

**Additive Redis/Supabase/sandbox dependency-health on `/admin/backpressure`, a cross-user `GET /admin/runs` list with honest chat/workflow/eval/tuner kind badges + server-derived `not_responding`, and the D-07 poll-exempt / one-deliberate-row `POST /admin/control-plane/record` ledger discipline.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-11T12:22:00Z
- **Completed:** 2026-07-11T12:33:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 5 (2 created services/tests + 1 route file + 2 test files)

## Accomplishments
- `health_probe.py` — `probe_redis` / `probe_supabase` / `probe_sandbox` returning `{state, latency_ms}`, run concurrently via `asyncio.gather`; sandbox honors the 3-state off/up/down contract (a disabled sandbox is `off`, never `down` — Pitfall 6).
- `/admin/backpressure` now carries the additive top-level `dependencies` block; the four original signals stay byte-identical (D-078-08). The endpoint is now floor-EXEMPT (D-07) so the ~10s auto-poll never spams the ledger.
- `GET /admin/runs` — ZRANGE `runs:active` WITHSCORES → batch `runs` enrichment; D-Q1 Option A kind derivation with **no migration** (runs-row presence → chat/workflow/eval; absent → tuner; workflow split via `threads.active_workflow_run_id`, eval split via `eval_runs.id`). `killable` true only for chat/workflow (D-01); a tuner id with no `runs` row renders generically and never raises.
- Each run carries a server-derived `not_responding` computed by **read-only reuse** of the reconciler's stream-age oracle (`run_reconciler._is_chat_orphan`) — a stalled stream is true, a fresh/young stream or a tuner/eval row is false (RESEARCH Open Q3).
- `POST /admin/control-plane/record` — floor-ATTACHED; the server maps a Pydantic `Literal` event to a hardcoded (label, action): `visit`→"Opened the Control Plane"/`control_plane.visit`, `refresh`→"Viewed system health"/`health.view`; an unknown event → 422 (T-147-13: no client string ever reaches `operator_audit_log`).

## Task Commits

Each task was committed atomically (TDD: RED test → GREEN feat):

1. **Task 1 (RED): health-probe tests** - `0f1662ce` (test)
2. **Task 1 (GREEN): dependency-health probes + floor-exempt /backpressure** - `d61f82de` (feat)
3. **Task 2 (RED): /admin/runs + record-endpoint tests** - `551c7545` (test)
4. **Task 2 (GREEN): GET /admin/runs + POST /control-plane/record** - `f32d9614` (feat)

## Files Created/Modified
- `backend/app/services/health_probe.py` (created) - The three async dependency probes + `probe_dependencies` gather.
- `backend/app/api/admin.py` (modified) - Additive `dependencies` on `/backpressure` (floor-exempt); new `GET /admin/runs` + `_uuid_list`/`_derive_not_responding` helpers + `POST /admin/control-plane/record` + `ControlPlaneRecord` model.
- `backend/tests/test_147_health_probe.py` (created) - Probe state matrix + `/backpressure` superset + floor-exempt.
- `backend/tests/test_147_active_runs.py` (created) - Kind badges + killable + tuner-no-raise + not_responding + floor-exempt + 404 + record mapping.
- `backend/tests/test_146_operator_gate.py` (modified) - Repointed the floor-writes-once regression to `/admin/audit`; asserts `/backpressure` is now exempt (deviation 1).

## Decisions Made
- **Enrichment via 3 extra asyncpg SELECTs** (`eval_runs`, `threads` workflow anchor, `auth.users` email) over the active id set — all metadata-only, never touching thread content (sketch linkage rule #11). Each is best-effort (logged + skipped on failure) so one missing join never sinks the list.
- **UUID coercion helper** (`_uuid_list`) drops any non-UUID member instead of raising, so a malformed id can't break the `::uuid[]` enrichment.
- **not_responding is fail-safe** — any oracle exception (including the reconciler's re-raised real-Redis-fault) degrades to `False`; the tag never lies on a transient hiccup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repointed the Phase-146 floor-writes-once regression test**
- **Found during:** Task 1 (making `/backpressure` floor-exempt per D-07)
- **Issue:** `test_146_operator_gate.py::test_audit_floor_writes_once` pinned the now-superseded behavior — it used `/admin/backpressure` as its "gated action endpoint" example and asserted exactly one `health.view` audit row. D-07 demotes `/backpressure` to floor-EXEMPT, so that assertion fails.
- **Fix:** Repointed the "writes exactly one row" assertion to the still-floor-attached `/admin/audit` (`audit.view` / "Viewed recent actions") and extended the exemption assertion to cover BOTH `/admin/me` and `/admin/backpressure`.
- **Files modified:** `backend/tests/test_146_operator_gate.py`
- **Verification:** `pytest tests/test_146_operator_gate.py` → 6/6 green; full 146+147 admin suite 29/29 green.
- **Committed in:** `d61f82de` (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a regression test encoding the superseded floor behavior).
**Impact on plan:** Necessary to keep the 146 regression suite honest under the D-07 change. No scope creep — the change is a test-only repoint that still proves the floor-writes-once + probe-exempt invariant.

## Issues Encountered
- The `_is_chat_orphan` oracle is a private (`_`-prefixed) reconciler helper; the plan explicitly sanctions read-only import reuse (no edit to `run_reconciler.py`). Reused via a late import inside `_derive_not_responding`, matching the plan's "do not re-derive the age math" constraint.

## User Setup Required
None - no external service configuration required. This plan adds zero dependencies and no migration (D-Q1 Option A is deliberately no-migration).

## Next Phase Readiness
- The `ActiveRun` response shape (`run_id, kind, thread_id, user_id, user_email, model, provider, started_at, killable, not_responding`) is the contract the frontend plans (147-06 `ActiveRun` type, 147-07 tag render) consume.
- The `dependencies` block shape matches the `BackpressureSignals` extension planned in 147-06/api.ts.
- `POST /admin/control-plane/record` is ready for the shell (147-09) to call once on mount (`visit`) and on manual ↻ (`refresh`).
- Operator Kill (`POST /admin/runs/{id}/kill`, shared cancel-internals refactor) is a SEPARATE plan (147-03) — not in scope here; this plan is the read surface only.

## Self-Check: PASSED

- FOUND: `backend/app/services/health_probe.py`
- FOUND: `backend/tests/test_147_health_probe.py`
- FOUND: `backend/tests/test_147_active_runs.py`
- FOUND commit `0f1662ce`, `d61f82de`, `551c7545`, `f32d9614`
- Plan verification `pytest tests/test_147_health_probe.py tests/test_147_active_runs.py -x` → 18 passed

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
