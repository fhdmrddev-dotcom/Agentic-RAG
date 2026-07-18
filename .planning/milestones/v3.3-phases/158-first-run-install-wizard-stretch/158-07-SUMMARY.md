---
phase: 158-first-run-install-wizard-stretch
plan: 07
subsystem: infra
tags: [fastapi, lifespan, middleware, asgi, setup-wizard, boot-tolerance, self-host]

# Dependency graph
requires:
  - phase: 158-01
    provides: Wave-0 Nyquist scaffold (test_setup_boot_tolerant, test_setup_gate) + conftest setup fixtures
  - phase: 158-03
    provides: SetupMiddleware (pure-ASGI gate) + setup_store (setup_finalized latch, announce_token_if_unfinalized)
  - phase: 158-06
    provides: setup router (/setup/* token-gated + open /setup/status) + public_router (/public-config)
provides:
  - Setup-mode-tolerant lifespan — the ONE un-guarded DB hard-fail (assert_action_types_synced) + the four reconciler spawns are gated behind `if not _setup_mode` (marker-derived, no DB)
  - First-boot setup-token announce (D-15) once per unfinalized boot, best-effort
  - SetupMiddleware registered before CORS (stack [CORS, Setup, Maintenance]) — a configured box is a single-bool no-op
  - Setup router + open /public-config mounted on the real app
  - Byte-identical integration proof (real app boots finalized -> gate is a literal passthrough)
affects: [158-verify, 158-secure, first-run install wizard, self-host onebox deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Marker-derived setup mode: `_setup_mode = not setup_store.setup_finalized()` early in the lifespan (cheap file read, NO DB) gates the one un-guarded DB hard-fail + reconciler spawns"
    - "Gate registered inside CORS but outside Maintenance so a 503 carries CORS headers and a fresh box is gated with zero DB touch"
    - "Unit suite runs as a FINALIZED box (SETUP_STORE_PATH -> finalized store + per-test latch reset) so the security gate is byte-transparent to the existing suite"

key-files:
  created: []
  modified:
    - backend/app/main.py
    - backend/tests/test_setup_boot_tolerant.py
    - backend/tests/test_setup_gate.py
    - backend/tests/conftest.py

key-decisions:
  - "Gate SetupMiddleware OUTSIDE Maintenance (Setup runs first) so a fresh/unbound box is gated with zero DB touch; both are no-ops once finalized"
  - "announce_token_if_unfinalized() wrapped best-effort — a setup-store write failure must not crash the boot (D-03 degrade-not-crash)"
  - "Unit suite treated as a finalized box via a global finalized SETUP_STORE_PATH + a per-test latch reset, keeping the byte-identical suite green while fresh-store proofs still see unfinalized"

patterns-established:
  - "Behavioral lifespan proof: monkeypatch the finalized marker + spy assert_action_types_synced / intercept asyncio.create_task (close the coro) while the REAL lifespan runs offline"
  - "Real-app byte-identical integration proof via a bare TestClient (no lifespan, the test_147 idiom) with the store forced finalized"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 33min
completed: 2026-07-17
---

# Phase 158 Plan 07: main.py — setup-mode-tolerant lifespan + SetupMiddleware wiring Summary

**Wired the first-run setup mechanism into the app entry: the lifespan now degrades (not crashes) on an unbound box by gating the sole un-guarded DB hard-fail + the four reconciler spawns behind a marker-derived `_setup_mode`, announces the setup token once, registers SetupMiddleware inside CORS, and mounts the setup router + open /public-config — a configured box is byte-identical.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-07-17T06:43Z (approx, after 158-06 landed)
- **Completed:** 2026-07-17T07:16Z
- **Tasks:** 2 (Task 1 TDD)
- **Files modified:** 4

## Accomplishments
- **D-03 boot tolerance:** `_setup_mode = not setup_store.setup_finalized()` computed early in the lifespan (cheap file read, no DB). In setup mode the lifespan DEFERS `assert_action_types_synced(await get_pg_pool())` — the one un-guarded crash path (RESEARCH Pattern 3 / Pitfall 3) — and SKIPS all four `asyncio.create_task(...)` reconciler spawns. A finalized box runs them all (byte-identical).
- **D-15 token announce:** on an unfinalized boot the lifespan calls `announce_token_if_unfinalized()` exactly once (best-effort) so the operator reads the token from `docker compose logs backend`.
- **D-04 gate registration:** `SetupMiddleware` registered alongside `MaintenanceMiddleware`, BEFORE CORS — the built stack is `[CORS, Setup, Maintenance]` (CORS outermost so a 503 `setup_required` carries CORS headers; Setup before Maintenance so a fresh box is gated with zero DB touch).
- **Router include:** `setup_api.router` (`/setup/*` + open `/setup/status`) and `setup_api.public_router` (open `GET /public-config`, D-07) mounted on the real app.
- **Byte-identical proof (folded plan-checker item):** a new `test_setup_gate` integration test boots the REAL app with the store forced finalized and asserts `/health` keeps its exact pre-158 shape (`{status, redis, maintenance}`) AND a non-allowlisted `/models` passes through — empirical end-to-end proof, not just the middleware-unit proof.

## Task Commits

1. **Task 1 (TDD RED): behavioral setup-mode-tolerant lifespan proof** - `25e10ba2` (test)
2. **Task 1 (TDD GREEN): setup-mode-tolerant lifespan guard + token announce** - `64cbba0d` (feat) — `main.py` lifespan + `conftest.py` finalize
3. **Task 2: register SetupMiddleware before CORS + include setup router** - `2bc6356e` (feat) — `main.py` middleware+router + `test_setup_gate.py` integration proof

## Files Created/Modified
- `backend/app/main.py` - Lifespan `_setup_mode` guard on `assert_action_types_synced` + the 4 reconciler spawns; best-effort token announce; `SetupMiddleware` registered before CORS; `setup_api.router` + `public_router` included.
- `backend/tests/test_setup_boot_tolerant.py` - Replaced the 158-01 source-string scaffold with the full behavioral proof (setup mode defers audit + 0 spawns + announce once; configured mode runs audit + 4 spawns + no announce).
- `backend/tests/test_setup_gate.py` - Added `test_configured_real_app_boot_byte_identical` (real-app end-to-end byte-identical proof).
- `backend/tests/conftest.py` - Test-env finalize (see Deviations): global finalized `SETUP_STORE_PATH` + per-test latch reset.

## Decisions Made
- **Gate OUTSIDE Maintenance:** registering Setup right after Maintenance yields `[CORS, Setup, Maintenance]` — Setup runs before Maintenance so a fresh (unbound) box is gated with zero DB touch, and both are no-ops once finalized.
- **Module-qualified store access** (`from app.services import setup_store; setup_store.setup_finalized()`) — monkeypatch-friendly for the behavioral test AND keeps `announce_token_if_unfinalized` to exactly one source occurrence (the plan's grep acceptance).
- **Two routers included** — `setup_api.router` (`/setup` prefix) and `setup_api.public_router` (top-level `/public-config`), both already built in 158-06; no top-level `@app.get` needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test suite would 503 / run setup-mode once the gate + lifespan guard landed**
- **Found during:** Task 1/Task 2 (wiring the security middleware + lifespan guard onto the real app)
- **Issue:** The conftest `client` fixture runs the FULL lifespan (`TestClient(app)` context manager) and ~34 test files hit non-allowlisted routes through the real app. The test env has no `/data/setup.json` marker, so `setup_finalized()` returns False → the lifespan would run in setup mode (audit skipped, reconcilers not spawned, `announce` attempting a `/data` write) AND `SetupMiddleware` would 503 every non-allowlisted route — breaking the byte-identical suite (`test_setup_finalize` also asserts a fresh store reads False, so a naive global latch would break it too).
- **Fix:** `conftest.py` now (a) points a global `SETUP_STORE_PATH` at a finalized store file so the suite boots as a CONFIGURED box (gate no-op + lifespan byte-identical), and (b) resets the monotonic finalized latches (`setup_store._finalized_latch`, `setup_mw._finalized_latch`) in the autouse `reset_mocks` fixture so each test re-derives finalized state — the `setup_store_path` fixture (fresh tmp) keeps the fresh-store proofs seeing unfinalized.
- **Files modified:** `backend/tests/conftest.py`
- **Verification:** Full setup suite (12 files) 60 passed; the fresh-store proofs (`test_setup_finalized_false_on_fresh_store` etc.) still green; broader client-fixture spot-check shows 0 net-new failures (A/B: 17=17 with/without the middleware; 0 `503`/`setup_required` across all 34 files).
- **Committed in:** `64cbba0d` (Task 1 GREEN commit)

**2. [Rule 2 - Boot hardening] Wrapped the token announce best-effort**
- **Found during:** Task 1 (lifespan token announce)
- **Issue:** `announce_token_if_unfinalized()` mints + persists the token via a `/data/setup.json` write; if the volume is unwritable it raises. Unwrapped, that raise would crash the boot in setup mode — exactly the crash-loop D-03 exists to prevent (the operator would never see the token).
- **Fix:** wrapped the announce in a best-effort `try/except` that logs and continues (mirrors every other lifespan side-effect); the box still boots into setup mode.
- **Files modified:** `backend/app/main.py`
- **Verification:** behavioral test spies the announce (called once in setup mode, zero in configured); `import app.main` clean.
- **Committed in:** `64cbba0d`

**3. [Expected — plan Task 2 acceptance] Modified `test_setup_gate.py` (not in files_modified frontmatter)**
- **Found during:** Task 2
- **Issue:** the plan frontmatter lists only `main.py` + `test_setup_boot_tolerant.py`, but Task 2's acceptance (and the folded plan-checker item) explicitly requires extending `test_setup_gate.py` with the real-app byte-identical integration proof.
- **Fix:** added `test_configured_real_app_boot_byte_identical` as a sibling test (kept the existing mini-app unit proof intact).
- **Files modified:** `backend/tests/test_setup_gate.py`
- **Committed in:** `2bc6356e`

---

**Total deviations:** 2 auto-fixed (1 blocking test-harness, 1 boot hardening) + 1 plan-mandated file addition.
**Impact on plan:** The conftest finalize is required test infrastructure for wiring a pre-auth security gate onto the real app; it makes the security gate byte-transparent to the existing suite exactly as the byte-identical invariant demands. No production-behavior scope creep — the runtime change is precisely D-03/D-04/D-15.

## Issues Encountered
- **Broader-suite noise (19 pre-existing failures):** the full 34-file client-fixture spot-check showed 19 failures in 5 files (`tests/integration/test_documents.py`, `test_skills_lint.py`, `test_threads.py`, `test_dual_mode_wiring.py`, `test_knowledge_health.py`). Confirmed pre-existing and unrelated to the gate: a controlled A/B (the 4 overlapping files fail 17 both WITH and WITHOUT the middleware), zero `503`/`setup_required` across all 34 files, and failure signatures are integration/network (`getaddrinfo failed`, 502), DB-seed-data mismatches (endpoint returned 200 then data differed), mock-shape gaps (`KeyError: 'user_id'`), and test rot (`AttributeError: ... create_streaming_chat`). Matches the documented suite rot; not folded (out of scope).

## Known Stubs
None — the wiring is complete; no placeholder data paths introduced.

## User Setup Required
None - no external service configuration required. (Runtime effect: on a real fresh onebox boot the setup token now prints to `docker compose logs backend`; that is the live-UAT deferred item, operator-gated.)

## Next Phase Readiness
- The integration seam is complete: a fresh box boots into setup mode + prints the token instead of crash-looping; a configured box is byte-identical.
- Ready for `/gsd:verify-work 158` (byte-identical invariant is the verification bar) and `/gsd:secure-phase 158` (T-158-07 boot-guard, T-158-01 token-to-logs, T-158-05 file-marker mitigations are now wired).
- No STATE/ROADMAP writes performed (per plan instruction — orchestrator owns those).

## Self-Check: PASSED

All modified files exist (`main.py`, `test_setup_boot_tolerant.py`, `test_setup_gate.py`, `conftest.py`, `158-07-SUMMARY.md`); all three task commits exist in git (`25e10ba2`, `64cbba0d`, `2bc6356e`).

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
