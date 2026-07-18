---
phase: 158-first-run-install-wizard-stretch
plan: 06
subsystem: api
tags: [fastapi, setup-wizard, pre-auth, setup-token, supabase, install-wizard, deploy]

# Dependency graph
requires:
  - phase: 158-01
    provides: Wave-0 Nyquist test scaffold (test_setup_status/token/idempotent/finalize + setup_store_path fixture)
  - phase: 158-02
    provides: user_settings.setup_complete() auditable DB-flag reader
  - phase: 158-03
    provides: setup_store (finalize latch, verify_token, get_or_create_token, finalize, INFRA_KEYS)
  - phase: 158-05
    provides: setup_service seams (compute_setup_status, probes, detect_environment, bootstrap_operator, save_provider_key, run_smoke_checks, run_schema_bootstrap, SchemaBootstrapPrivilegeError)
provides:
  - Pre-auth, token-gated /setup/* router (detect/validate/schema-bootstrap/operator/provider-key/smoke/finalize)
  - require_setup_token dependency (409 finalized-latch -> 429 rate-limit -> 401 constant-time token)
  - Open GET /setup/status (static entry signal) + open GET /public-config (two public Supabase values only)
  - POST /setup/finalize dual finalize marker (file marker + auditable DB flag) + restart-to-apply signal
affects: [158-07, 158-08, secure-phase-158, verify-work-158]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-auth token gate INVERTING admin.py's router-level operator gate: per-route Depends(require_setup_token), no RLS backstop"
    - "Finalize-latch checked BEFORE the token so a post-finalize write can never mutate config (409)"
    - "In-process failed-attempt sliding-window rate-limit that clears on success (only sustained failures trip 429)"
    - "Two routers in one module: prefixed /setup writes + a no-prefix public_router for top-level /public-config"

key-files:
  created:
    - backend/app/api/setup.py
  modified:
    - backend/tests/test_setup_status.py
    - backend/tests/test_setup_token.py
    - backend/tests/test_setup_idempotent.py
    - backend/tests/test_setup_finalize.py

key-decisions:
  - "Endpoint shape (Claude's Discretion): stateless steps carry their infra in the request body (store not written until finalize); GET reads open, POST writes token-gated"
  - "/public-config uses getattr(settings, 'supabase_anon_key', '') defensively — the field is absent from Settings on a fresh box (only supabase_url + service_role_key are declared)"
  - "Finalize writes the file marker (D-05 gate authority) then a best-effort auditable DB flag reported honestly as setup_complete_persisted, NOT a hard 500 (Rule-1 correctness deviation — see Deviations)"

patterns-established:
  - "require_setup_token: finalize-latch 409 -> rate-limit 429 -> constant-time token 401 (order is load-bearing)"
  - "Every /setup/* WRITE carries Depends(require_setup_token); only /setup/status + /public-config are open (introspection-proven, zero un-tokened writes)"
  - "Honest write-through: save-False on provider-key surfaces a real 500 (mirrors PUT /admin/flags)"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 18min
completed: 2026-07-17
---

# Phase 158 Plan 06: Token-gated `/setup/*` router + `/public-config` + dual finalize marker Summary

**The pre-auth security wall for the install wizard: a `require_setup_token`-gated `/setup/*` router (detect → validate → schema-bootstrap → operator → provider-key → smoke → finalize) plus the two open reads (`/setup/status`, `/public-config`), with a dual finalize marker and a hard lock-out — zero un-tokened write holes.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-17T02:25Z
- **Completed:** 2026-07-17T02:42Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 5 (1 created, 4 test files extended)

## Accomplishments
- `backend/app/api/setup.py` (421 lines) — the token-gated wizard router orchestrating the 158-03/158-05 seams (never forking one).
- `require_setup_token` — the SOLE pre-auth access authority (no RLS backstop): finalize-latch **409** first (D-14 lock-out), token-verify **429** rate-limit (T-158-08), constant-time **401** (D-15/T-158-01).
- Six token-gated step endpoints + `POST /setup/finalize` (server-side smoke gate + dual marker + restart signal), and the two OPEN reads.
- **Security contract proven by route introspection: 7 POST writes all gated, 2 GET reads open, `UN-TOKENED WRITE HOLES: NONE`.**
- Flipped the Wave-0 stubs green: `test_setup_status`, `test_setup_token`, `test_setup_idempotent` (un-skipped), `test_setup_finalize` — 30/30 across the four target files.

## Task Commits

Each task was TDD (RED test commit → GREEN feat commit):

1. **Task 1: router skeleton — require_setup_token, open status + public-config**
   - `5a233f1f` (test) → `bc6b60e1` (feat)
2. **Task 2: the six token-gated step endpoints**
   - `9d077562` (test) → `16736825` (feat)
3. **Task 3: POST /setup/finalize — dual marker + restart signal**
   - `07d573ba` (test) → `1db1de67` (feat)

## Files Created/Modified
- `backend/app/api/setup.py` (**created**) — `require_setup_token` dep + rate-limit; `router` (prefixed `/setup`) with open `/status` + 7 token-gated writes; `public_router` with open `/public-config`.
- `backend/tests/test_setup_status.py` — added open-route TestClient tests (`/setup/status` shape, `/public-config` exactly-two-keys + no-secret guard).
- `backend/tests/test_setup_token.py` — added `require_setup_token` over-the-wire tests (401 missing/wrong, 200 correct, 409 after finalize).
- `backend/tests/test_setup_idempotent.py` — added the every-write-route-carries-the-token introspection proof, provider-key save-False→500, idempotent re-run, operator dup→already_exists / password-error→400, step-after-finalize→409.
- `backend/tests/test_setup_finalize.py` — added the finalize endpoint tests (smoke-gate 409 refusal, dual-marker write + restart_required, post-finalize lock-out).

## Decisions Made
- **Endpoint shape / step statelessness (Claude's Discretion per plan):** each write step carries the infra values it needs in the request body (the store is only written at finalize), keeping steps stateless + re-entrant. `run_smoke_checks(cfg)` and `bootstrap_operator(...)` already take explicit args, so this composes cleanly.
- **Two routers:** `router` (prefix `/setup`) holds the open `/status` + the writes; a separate no-prefix `public_router` holds the top-level `/public-config` (nginx strips `/api` → backend sees `/public-config`, which the SetupMiddleware allowlist exempts). 158-07 includes both.
- **Guide fallback content:** `_SEED_SEQUENCE` mirrors the exact `docs/OPERATOR.md` Step-3 list (full-schema + 9 ordered seeds); `run_schema-bootstrap` returns `{fallback:"guide", seed_sequence:[...]}` on a privilege error or a missing artifact — the D-18 MUST copy-path, never a partial silent bootstrap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] `/public-config` reads `supabase_anon_key` defensively (field absent from `Settings`)**
- **Found during:** Task 1 (public-config route)
- **Issue:** The RESEARCH code example returns `settings.supabase_anon_key`, but `config.py`'s `Settings` only declares `supabase_url` + `supabase_service_role_key`; `supabase_anon_key` is set on `settings` ONLY when the setup-store overlay (158-04) has it. On a fresh box (empty store) `settings.supabase_anon_key` raises `AttributeError` → the open route would 500.
- **Fix:** `getattr(settings, "supabase_anon_key", "") or ""` — returns `""` when the field is absent. Response is still EXACTLY `{supabase_url, supabase_anon_key}`, never a secret.
- **Files modified:** `backend/app/api/setup.py`
- **Verification:** `test_public_config_returns_only_two_public_keys_no_secret` passes (exactly 2 keys, no `service_role`/`secret`/`dsn`).
- **Committed in:** `bc6b60e1` (Task 1)

**2. [Rule 1 - Correctness] Finalize DB-flag failure is reported honestly, not hard-500'd**
- **Found during:** Task 3 (finalize endpoint)
- **Issue:** The Task 3 action prose says write the file marker FIRST then "surface a False `save_app_settings` return as a real 500 — retry is safe." But `save_app_settings` uses the app pg pool, which under **restart-to-apply + WORKER_COUNT=2** stays bound to placeholder config until the restart — so on a fresh box the DB-flag write can legitimately not land at finalize. A hard 500 AFTER the file marker is written would (a) falsely claim finalize failed when the D-05 gate authority (the file marker) IS set, and (b) be **unrecoverable** — the marker now 409s any retry (the retry-lock paradox).
- **Fix:** Write the file marker (gate authority, D-05), then attempt the auditable DB flag **best-effort**; report the outcome as `setup_complete_persisted: <bool>` in a 200 response and log a warning on failure — never a false "saved". `setup_complete()` reads default-False-safe and the flag re-syncs post-restart / from `/admin`, so the box is correctly finalized either way. Both markers are still written (D-05 truth satisfied); `restart_required:true` is returned.
- **Files modified:** `backend/app/api/setup.py`
- **Verification:** `test_finalize_writes_both_markers_and_locks_out` (both markers + restart_required + post-finalize 409) and `test_finalize_refuses_when_smoke_not_all_green` pass. Provider-key keeps the literal honest-500-on-False discipline (`test_provider_key_save_false_surfaces_500`).
- **Committed in:** `1db1de67` (Task 3)

**3. [Rule 3 - Blocking] Docstring reword to satisfy the `grep -c "require_operator" == 0` gate**
- **Found during:** Task 1 (acceptance greps)
- **Issue:** Prose in the module docstring referenced `require_operator` to explain the inversion; the acceptance is a literal substring check requiring **0** occurrences (token-gated, not operator-gated).
- **Fix:** Reworded to "the `/admin` surface's operator gate" / "NO router-level operator gate" — same meaning, no literal `require_operator` token.
- **Files modified:** `backend/app/api/setup.py`
- **Verification:** `grep -c "require_operator" backend/app/api/setup.py` == 0.
- **Committed in:** `bc6b60e1` (Task 1)

---

**Total deviations:** 3 auto-fixed (2 Rule-1 correctness, 1 Rule-3 blocking)
**Impact on plan:** No scope change. Deviation #2 is the only behavioral one — it makes the plan's own "retry is safe" guarantee literally true and keeps finalize completable on a fresh box, while still writing both D-05 markers and returning `restart_required`. Provider-key retains the literal honest-500 discipline the plan mandates.

## Issues Encountered
- **`test_setup_boot_tolerant.py` (2 failing) is out of scope and pre-existing.** Those two tests assert `main.py`'s lifespan contains `setup_finalized` (the `assert_action_types_synced` guard) — that is **158-07 wiring**, not this router plan. They failed identically at baseline before my changes (`2 failed, 40 passed, 1 skipped`) and the plan's own Task 3 acceptance notes "boot_tolerant may still skip until 158-07." Not touched. The full setup suite is now `57 passed, 2 failed` (the two pending-158-07 boot_tolerant rows).
- **Finalized-latch cross-test contamination** (the monotonic `_finalized_latch` module global): endpoint tests monkeypatch `setup_api.setup_finalized` (or reset `setup_store._finalized_latch`) to stay independent of latch order — matching the existing 158-01 idempotent-stub pattern.

## Known Stubs
None. `/public-config`'s `getattr(..., "")` default is defensive field-absence handling, not a stub; the schema-bootstrap auto-runner is a real (SHOULD) path with a documented guide fallback.

## User Setup Required
None - no external service configuration required. (The router itself is what the operator will drive at runtime; the live end-to-end operator UAT is the phase-level DEFERRED item per D-18.)

## Next Phase Readiness
- **158-07 (wiring):** include `setup.router` + `setup.public_router` in `main.py`, register `SetupMiddleware`, and guard `assert_action_types_synced` behind `if not setup_finalized()` — which turns the 2 pending `test_setup_boot_tolerant.py` rows green. The contract this router exposes (`GET /setup/status`, `GET /public-config`, the token-gated writes, `finalize` → `{finalized, restart_required, setup_complete_persisted}`) is stable for the middleware allowlist + lifespan token announcement.
- **158-08 (frontend):** consumes this exact wire contract — `setupApi.ts` carries `X-Setup-Token` on writes; the finalize response's `restart_required` drives the "restart to apply" screen; the schema-bootstrap `{fallback:"guide", seed_sequence}` drives `SchemaGuidancePanel`.
- **secure-phase-158:** every threat-register mitigation for this surface is in code — token gate on all writes (introspection-proven), finalize-latch 409, rate-limit 429, `/public-config` leaks only the two public values, probes reflect only `type(exc).__name__`, operator password error → 400 verbatim.

## Self-Check: PASSED

- Files verified on disk: `backend/app/api/setup.py`, `158-06-SUMMARY.md` — both FOUND.
- Commits verified in git: `5a233f1f`, `bc6b60e1`, `9d077562`, `16736825`, `07d573ba`, `1db1de67` — all FOUND.
- Verification command (`pytest test_setup_status/token/idempotent/finalize -q`): **30 passed**.
- Security introspection: 7 POST writes GATED, 2 GET reads open, **UN-TOKENED WRITE HOLES: NONE**.
- Acceptance greps: `require_operator`==0, `429|rate`==7, `fallback`==7, `restart_required`==2.

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
