---
phase: 147-operator-control-plane
plan: 05
subsystem: infra
tags: [fastapi, middleware, asgi, maintenance-mode, feature-flags, app_settings, health, sse]

# Dependency graph
requires:
  - phase: 147-01
    provides: "maintenance_mode() TTL-cached read helper + the three app_settings flag columns (self_improve_enabled / workflows_enabled / maintenance_mode)"
provides:
  - "MaintenanceMiddleware — a single pure-ASGI write-block seam that 503s non-allowlisted mutating requests while maintenance is ON (D-06)"
  - "Off-switch-safe allowlist: /auth/*, ALL /admin/* (incl. PUT /admin/flags), and DELETE /runs/{id} always pass under maintenance (Pitfall 4)"
  - "Additive `maintenance` boolean on the PUBLIC /health payload — the end-user banner's non-admin flag source (T-147-15: boolean only)"
affects: [147-frontend-maintenance-banner, operator-control-plane, maintenance-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-ASGI middleware (NOT BaseHTTPMiddleware) so the write-block never buffers/interferes with SSE streaming responses"
    - "Middleware registered BEFORE CORS so CORS stays outermost (preflight answerable + CORS headers on the 503)"
    - "Fail-OPEN flag polarity for a platform switch (D-Q4): cold/blip read => maintenance False, never wedge the platform read-only"

key-files:
  created:
    - backend/app/middleware/__init__.py
    - backend/app/middleware/maintenance.py
    - backend/tests/test_147_maintenance_mw.py
  modified:
    - backend/app/main.py

key-decisions:
  - "Pure-ASGI middleware chosen over BaseHTTPMiddleware to stay byte-transparent to the SSE hot path (CLAUDE.md streaming rule)"
  - "Flag read via the sync maintenance_mode() in-memory TTL helper — zero per-request DB/supabase I/O (D-v2.5-01), fail-OPEN on cold cache (D-Q4)"
  - "MaintenanceMiddleware registered before CORS so CORS is outermost (preflight + CORS headers on the 503 write-block)"
  - "Allowlist matches /admin & /auth on a path-segment boundary (prefix + '/') so a sibling like /administrate is NOT falsely allowlisted"

patterns-established:
  - "Pattern 1: Cross-cutting write-block as ONE ASGI seam (not a per-route dependency a future endpoint would forget)"
  - "Pattern 2: Off-switch-safe allowlist — the write-block must never block its own disable path (PUT /admin/flags) or login"

requirements-completed: [FLAG-01]

# Metrics
duration: ~13min
completed: 2026-07-11
---

# Phase 147 Plan 05: Maintenance Write-Block Middleware Summary

**Pure-ASGI FastAPI middleware that 503s mutating requests during maintenance while keeping login, ALL /admin/* (the off-switch), and self-cancel reachable — plus an additive `maintenance` boolean on public /health for the end-user banner.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-11T13:58Z (approx, after 147-04 handoff)
- **Completed:** 2026-07-11T14:10:34Z (GREEN commit)
- **Tasks:** 1 (tdd)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- A single `MaintenanceMiddleware` ASGI seam that rejects non-allowlisted POST/PUT/PATCH/DELETE with a plain `503 {"error":"maintenance","message":"maintenance mode — read-only"}` while maintenance is ON.
- Off-switch-safe allowlist (Pitfall 4): `/auth/*`, **ALL** `/admin/*` (so `PUT /admin/flags` can always turn maintenance back OFF), and `DELETE /runs/{id}` (self-cancel) always pass — even under maintenance. GET/HEAD/OPTIONS reads + preflight always pass.
- Fail-OPEN polarity (D-Q4): a cold/blip settings read resolves to maintenance=False so a transient settings failure can never wedge the whole platform read-only.
- No blocking I/O per request (D-v2.5-01): the flag is read from the in-memory 30s TTL settings cache via `maintenance_mode()` — no per-request supabase/DB call, and no SSE interference (pure ASGI, not BaseHTTPMiddleware).
- Additive `maintenance` boolean on the PUBLIC `/health` payload — the non-operator end-user banner's flag source, boolean only (no other settings leak, T-147-15).

## Task Commits

TDD task (RED → GREEN):

1. **Task 1 (RED): failing maintenance-middleware suite** - `25ce2663` (test)
2. **Task 1 (GREEN): middleware body + main.py wiring + /health flag** - `355ff06c` (feat)

_No REFACTOR commit — the GREEN implementation was already clean._

## Files Created/Modified
- `backend/app/middleware/__init__.py` - New middleware package init.
- `backend/app/middleware/maintenance.py` - `MaintenanceMiddleware` (pure ASGI) + `_is_allowlisted` + `_read_maintenance` (fail-OPEN in-memory flag read).
- `backend/app/main.py` - `app.add_middleware(MaintenanceMiddleware)` registered before CORS; `/health` now returns an additive `maintenance` boolean.
- `backend/tests/test_147_maintenance_mw.py` - 19-case end-to-end suite (block/pass/allowlist/cold-cache/no-supabase/health).

## Decisions Made
- **Pure ASGI over BaseHTTPMiddleware:** the app streams every chat/workflow response over SSE; a pure-ASGI middleware either short-circuits a blocked request or passes the scope through untouched, so it never buffers/interferes with the stream. `BaseHTTPMiddleware` wraps the response body and risks stalling SSE.
- **Sync `maintenance_mode()` in-memory read (not `load_app_settings_async()`):** matches the plan `<action>` + orchestrator middleware note ("the TTL-cached helper, in-memory after warm"). It is a pure in-memory dict read — zero per-request I/O, trivially satisfying D-v2.5-01 and the `no supabase.table(` acceptance grep. Cross-worker propagation lag stays within the documented 30s TTL window (Pitfall 5 — expected, honest).
- **CORS stays outermost:** registered maintenance BEFORE CORS so CORS wraps it — keeps OPTIONS preflight answerable in maintenance and puts CORS headers on the 503 so a browser can READ the write-block instead of seeing an opaque CORS error.
- **Segment-boundary allowlist match** (`path == prefix or path.startswith(prefix + "/")`) so `/administrate` is not falsely treated as `/admin`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a test's HEAD-method expectation**
- **Found during:** Task 1 (GREEN run)
- **Issue:** The RED test asserted `HEAD /read == 200`, assuming FastAPI auto-registers HEAD for a `@app.get` route. FastAPI does NOT (unlike raw Starlette `Route`), so the router returned 405 — a test-only wrong assumption, not a middleware defect. The 405 (from routing) already proves the middleware let the request through (never 503'd it).
- **Fix:** Changed the HEAD/OPTIONS assertion to `!= 503` (the actual middleware contract: never block a read/preflight). The middleware body was correct as written.
- **Files modified:** backend/tests/test_147_maintenance_mw.py
- **Verification:** Full suite green (19 passed).
- **Committed in:** `355ff06c` (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 test-expectation bug)
**Impact on plan:** Test-only correction; middleware implementation unchanged. No scope creep.

## Issues Encountered
None beyond the deviation above.

## Threat Model Coverage
- **T-147-10 (self-inflicted lock-out):** allowlist tests assert `PUT /admin/flags`, `POST /auth/login`, any `/admin/*` write, and `DELETE /runs/{id}` all pass under maintenance; cold-cache defaults OPEN.
- **T-147-11 / T-147-COLD (blocking I/O + cold-cache polarity):** flag read is the in-memory TTL helper (no supabase call — asserted by source grep); cold cache => False.
- **T-147-15 (public /health leak):** only the `maintenance` boolean is added to /health; no other settings field crosses.

## Verification
- `venv/Scripts/python -m pytest tests/test_147_maintenance_mw.py` → **19 passed**.
- No regressions across the FLAG-01 + operator suites: `test_147_flag_failure_semantics / flag_hide / flag_refuse / workflows_flag` (39 passed) and `test_147_operator_kill / active_runs / health_probe` (27 passed) — the middleware is byte-transparent when maintenance is OFF (the cold-cache default).
- Acceptance greps: `main.py` contains `add_middleware(MaintenanceMiddleware` and `"maintenance": maintenance_mode()` on /health; `maintenance.py` contains no `supabase.table(`.
- Live curl smoke (manual, per plan) — deferred to phase UAT; the automated TestClient suite exercises the same block/pass/allowlist/health behaviors end-to-end.

## User Setup Required
None - no external service configuration required. (Migration 097 for the flag columns is owned by 147-01, already applied this wave.)

## Next Phase Readiness
- The write-block seam + public `/health` maintenance flag are live. The frontend end-user maintenance banner can now read the flag from `/health` (non-admin source).
- The operator off-switch is guaranteed reachable: `PUT /admin/flags` (147-03) is under `/admin`, which the allowlist always passes even when maintenance is ON.

## Self-Check: PASSED
- Created files exist: `backend/app/middleware/__init__.py`, `backend/app/middleware/maintenance.py`, `backend/tests/test_147_maintenance_mw.py`, `147-05-SUMMARY.md`.
- Commits present in git: `25ce2663` (test/RED), `355ff06c` (feat/GREEN).

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
