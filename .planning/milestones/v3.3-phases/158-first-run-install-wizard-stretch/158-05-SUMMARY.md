---
phase: 158-first-run-install-wizard-stretch
plan: 05
subsystem: infra
tags: [setup-wizard, asyncpg, redis, supabase-auth-admin, ssrf, encrypt-on-write, smoke-checklist, provisioning]

# Dependency graph
requires:
  - phase: 158-01
    provides: Wave-0 Nyquist test scaffold (test_setup_probe/detect/operator/provider/smoke.py) + conftest fixtures (mock_asyncpg_pool, mock_submitted_supabase, setup_store_path)
  - phase: 158-03
    provides: setup_store.py (read_store/write_store/setup_finalized/_is_placeholder) — the infra-tier file authority the service reads/writes
provides:
  - "setup_service.py: sanitized throwaway submitted-value probes (postgres/redis/supabase)"
  - "light env-detect (in_docker/store_present/db+redis_reachable)"
  - "bootstrap_operator: Auth admin create_user(email_confirm=True) + idempotent operator_users upsert"
  - "persist_provider_key: encrypted provider-key save via save_app_settings reuse"
  - "run_smoke_checks: 5-way {checks,all_green} finalize gate"
  - "run_schema_bootstrap: schema-absent-gated, transaction-wrapped auto-runner (SHOULD) + SchemaBootstrapPrivilegeError"
  - "compute_setup_status: static, blip-proof needs_setup entry signal (consumed by 158-06)"
affects: [158-06, 158-07, 158-08]

# Tech tracking
tech-stack:
  added: []  # zero new packages — composes asyncpg / redis.asyncio / supabase / model_discovery_service (all present)
  patterns:
    - "Throwaway-connection submitted-value probes (never the app singletons); SANITIZED type(exc).__name__ reason only (SSRF telemetry hygiene)"
    - "Encrypt-on-write reuse: provider key funnels through save_app_settings — no second encrypt path"
    - "Idempotent operator bootstrap: admin API create + operator_users ON CONFLICT DO NOTHING; duplicate → already_exists, weak-pw → verbatim"
    - "Server-truth smoke checklist: a row is green ONLY on a live probe, never optimistic"

key-files:
  created:
    - backend/app/services/setup_service.py
  modified:
    - backend/tests/test_setup_probe.py
    - backend/tests/test_setup_detect.py
    - backend/tests/test_setup_operator.py
    - backend/tests/test_setup_smoke.py

key-decisions:
  - "compute_setup_status reads the finalized marker DIRECTLY from the store file (D-05 authority), NOT the sticky _finalized_latch — deterministic + blip-proof + order-independent"
  - "Provider save named persist_provider_key (Wave-0 stub contract) with a save_provider_key alias (plan key_link)"
  - "Smoke provider-key check reuses model_discovery_service.discover_all (the SSRF-safe hardcoded /models endpoint allowlist) rather than a hand-rolled endpoint map"

patterns-established:
  - "SSRF-sanitized throwaway probe: bounded asyncio.wait_for(connect), close in finally, return only type(exc).__name__ on failure"
  - "run_in_threadpool wraps every blocking supabase-py call (D-v2.5-01)"

requirements-completed: [DEPLOY-02]

# Metrics
duration: 9min
completed: 2026-07-17
---

# Phase 158 Plan 05: setup_service (probes · operator bootstrap · provider save · smoke · schema auto-runner) Summary

**The pure setup-service logic layer for the first-run wizard: SSRF-sanitized throwaway submitted-value probes, light env-detect, the idempotent Auth-admin operator bootstrap + `operator_users` upsert, the encrypted provider-key save via `save_app_settings` reuse, the 5-way server-truth smoke checklist, and the schema-absent-gated transaction-wrapped schema auto-runner with a typed privilege-error guide fallback.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-17T02:02:28Z
- **Completed:** 2026-07-17T02:11:59Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 tests)

## Accomplishments
- `setup_service.py` (NEW): the router-agnostic, unit-testable service the `/setup/*` router (158-06) orchestrates — probes, env-detect, operator bootstrap, provider save, smoke, schema auto-runner, and the static entry status.
- Every submitted-value probe uses a THROWAWAY connection (never the app singletons — `grep get_pg_pool|get_redis` == 0) and returns ONLY `type(exc).__name__` on failure (17 sanitized sites) — no raw error / DSN / host reaches the browser (T-158-03 SSRF).
- `bootstrap_operator` creates a CONFIRMED auth user via `admin.create_user(email_confirm=True)` (`run_in_threadpool` — supabase-py is blocking), upserts `operator_users` `ON CONFLICT (user_id) DO NOTHING` over a throwaway conn, is idempotent (duplicate email → `already_exists`, never a 500), and propagates a weak-password GoTrue error verbatim (router → 400).
- `persist_provider_key` funnels through the Phase-150 `save_app_settings` seam — encrypt-on-write inherited for free, no second encrypt path (`grep encrypt_secret|Fernet|enc:v1` == 0).
- `run_smoke_checks` returns the 5-row `{checks,all_green}` finalize gate (server-truth only); `run_schema_bootstrap` is the schema-absent-gated, `conn.transaction()`-wrapped SHOULD with a typed `SchemaBootstrapPrivilegeError` → copy-guide fallback.

## Task Commits

Each task was committed atomically (all `feat` — the Wave-0 scaffolds were the pre-existing RED, filled green):

1. **Task 1: submitted-value probes + light env-detect** - `01fab7b3` (feat)
2. **Task 2: operator bootstrap + encrypted provider-key save** - `1e4161e6` (feat)
3. **Task 3: 5-way smoke checklist + schema-bootstrap auto-runner** - `5f1dc5bc` (feat)

_Note: `setup_service.py` was authored as one cohesive module under Task 1 (its primary deliverable = the probes); Tasks 2 & 3 land their respective test files against the already-present functions._

## Files Created/Modified
- `backend/app/services/setup_service.py` - NEW. All service functions: `probe_submitted_postgres/redis/supabase`, `detect_environment`, `compute_setup_status`, `bootstrap_operator`, `persist_provider_key` (+ `save_provider_key` alias), `run_smoke_checks`, `run_schema_bootstrap`, `SchemaBootstrapPrivilegeError`.
- `backend/tests/test_setup_probe.py` - Filled the reachable + schema-absent paths (mocked throwaway connect); kept the real bad-host SSRF-sanitization assertions.
- `backend/tests/test_setup_detect.py` - Filled with hermetic stubbed probes (no live infra) asserting the 4 orientation flags + `store_present`.
- `backend/tests/test_setup_operator.py` - Rewired from `_pg_pool` monkeypatch → throwaway `asyncpg.connect` mock; added the weak-password verbatim-propagation test.
- `backend/tests/test_setup_smoke.py` - Filled with hermetic mocked sub-probes: all-5 presence, all-green gate, any-red block, and the unrun-provider honesty case.

_(`test_setup_provider.py` passed unmodified — the scaffold already called `persist_provider_key`.)_

## Wave-0 stubs flipped green
- `test_setup_probe.py` (4), `test_setup_detect.py` (2), `test_setup_operator.py` (4), `test_setup_provider.py` (2), `test_setup_smoke.py` (4) → **16/16 green**.
- **Bonus:** `test_setup_status.py` (4/4) — creating `setup_service.py` un-skips it; the added `compute_setup_status` (deviation 1) makes it deterministically green instead of AttributeError-red.

## Acceptance-gate results (all met)
- Task 1: `pytest test_setup_probe test_setup_detect` → 6 passed; `type(exc).__name__` = 17 (≥3); `get_pg_pool|get_redis` = 0; `to_regclass` = 2 (≥1); `run_in_threadpool` within `probe_submitted_supabase -A6` = 1 (≥1).
- Task 2: `pytest test_setup_operator test_setup_provider` → 6 passed; `email_confirm` = 2; `run_in_threadpool` = 7; `save_app_settings` = 7; `encrypt_secret|Fernet|enc:v1` = 0; `ON CONFLICT` = 6.
- Task 3: `pytest test_setup_smoke` → 4 passed; `conn.transaction()` = 3 (≥1); `all_green` = 4 (≥1); the full 5-file gate → **16 passed**.

## Decisions Made
- **`compute_setup_status` reads the store file marker directly** (not the sticky per-process latch) so the status probe is deterministic and reflects the on-disk `finalized` marker — the D-05 gate authority — immune to `_finalized_latch` pollution that a sibling test leaves in the global. The middleware hot-path latch (158-03) is unchanged.
- **Provider-key smoke check reuses `model_discovery_service.discover_all`** — the project's canonical, SSRF-safe (hardcoded allowlist) `/models` seam — instead of hand-rolling provider endpoints (Don't-Hand-Roll; avoids shipping unverified provider URLs per the provider-docs-first rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `compute_setup_status` to `setup_service.py`**
- **Found during:** Task 1 (module creation — blast-radius check of the `importorskip` un-skip).
- **Issue:** Plan 158-06 (`depends_on: [..., 158-05]`) consumes `setup_service.compute_setup_status` for `GET /setup/status` and `test_setup_status.py` imports it, but 158-06 does NOT modify `setup_service.py` (not in its `files_modified`). 158-05 is the ONLY plan that owns `setup_service.py`, so the symbol must originate here. Creating the module without it would flip `test_setup_status.py` from cleanly-skipped to AttributeError-red.
- **Fix:** Implemented `compute_setup_status(supabase_url=None)` as a static, blip-proof `{needs_setup, finalized, has_token}` computation reading the store file marker directly (no DB probe).
- **Files modified:** backend/app/services/setup_service.py
- **Verification:** `test_setup_status.py` → 4/4 green (isolation AND full suite).
- **Committed in:** `01fab7b3` (Task 1 commit)

**2. [Rule 3 - Blocking] Function-name reconciliation: `persist_provider_key` (+ `save_provider_key` alias)**
- **Found during:** Task 2 (provider-key save).
- **Issue:** The plan prose/key_links name the save `save_provider_key`, but the Wave-0 stub contract (`test_setup_provider.py`) calls `setup_service.persist_provider_key`. The test is the ground truth that must flip green.
- **Fix:** Implemented `persist_provider_key` (test-driven) and aliased `save_provider_key = persist_provider_key`; both funnel through `save_app_settings` (the plan key_link `pattern: save_app_settings` is satisfied).
- **Files modified:** backend/app/services/setup_service.py
- **Verification:** `test_setup_provider.py` → 2/2 green (enc envelope on write; plaintext passthrough with no master key).
- **Committed in:** `1e4161e6` (Task 2 commit)

**3. [Rule 3 - Blocking] Rewired `test_setup_operator.py` to mock the throwaway `asyncpg.connect`**
- **Found during:** Task 2.
- **Issue:** The execution contract + plan mandate a THROWAWAY `asyncpg.connect(pg_dsn)` for the operator upsert (never the app pool). The Wave-0 stub monkeypatched `app.dependencies._pg_pool`, which a throwaway-conn impl does not touch — so the upsert tried a real localhost connect (ConnectionRefusedError) instead of recording.
- **Fix:** Rewrote the two failing operator tests to monkeypatch `asyncpg.connect` → a recording throwaway conn (records into the shared `mock_asyncpg_pool.calls` + supports `close()`), and added the `setup_store_path` fixture so the best-effort `OPERATOR_EMAILS` store-write hits `tmp_path`, not the real `/data`. (Test file is in this plan's `files_modified`.)
- **Files modified:** backend/tests/test_setup_operator.py
- **Verification:** `test_setup_operator.py` → 4/4 green (create `email_confirm=True`; ON CONFLICT DO NOTHING upsert; duplicate → already_exists; weak-pw → verbatim).
- **Committed in:** `1e4161e6` (Task 2 commit)

**4. [Rule 2 - Missing Critical] Contract-shape alignment for `run_smoke_checks`**
- **Found during:** Task 3.
- **Issue:** The plan prose described `run_smoke_checks(cfg)` returning `checks` as a LIST; the Wave-0 stub calls `run_smoke_checks()` with NO args and indexes `result["checks"]` as a DICT keyed by the 5 ids. The test is the contract.
- **Fix:** Made `cfg` optional (falls back to `settings`) and returned `checks` as a `{id: {state, reason}}` dict; `all_green = all(state=="up")`.
- **Files modified:** backend/app/services/setup_service.py
- **Verification:** `test_setup_smoke.py` → 4/4 green.
- **Committed in:** `5f1dc5bc` (Task 3 commit)

**5. [Coverage add] Two extra hardening tests (no scope creep)**
- Added `test_bootstrap_operator_weak_password_propagates_verbatim` (T-158-06) and `test_smoke_unrun_provider_is_neutral_not_optimistic` (D-13 honesty) — both assert plan-mandated behaviors that the Wave-0 stubs named but left as placeholder assertions.

---

**Total deviations:** 5 (2 missing-critical, 2 blocking, 1 coverage-add).
**Impact on plan:** All changes align the implementation to the Wave-0 stub contract (the ground truth) and the execution contract's throwaway-connection + SSRF mandates. `compute_setup_status` is the one function beyond this plan's named task list — required because 158-05 solely owns `setup_service.py` and 158-06 depends on the symbol. No scope creep beyond the setup-service layer; zero new packages.

## Threat surface scan
No security-relevant surface beyond the plan's `<threat_model>`. The submitted-value probes open connections to operator-supplied hosts by design (T-158-03) — mitigated exactly as specified: sanitized `type(exc).__name__`-only reasons, bounded 3s timeouts, no host/DSN/error reflection. Provider-key validation routes through the SSRF-safe hardcoded `/models` allowlist (`model_discovery_service`). No new endpoints/auth paths/schema at trust boundaries introduced by this plan.

## Issues Encountered
- **`test_setup_boot_tolerant.py` (2 RED) — PRE-EXISTING, owned by 158-07.** Creating `setup_service.py` does NOT affect it (it imports only `app.main`, never `setup_service`; `main.py` is untouched and has 0 `setup_finalized` references). These assert the D-03 lifespan setup-mode guard that 158-07 wires. Logged to `deferred-items.md`; verify green after 158-07.

## Next Phase Readiness
- **158-06 (router):** `compute_setup_status`, `bootstrap_operator`, `persist_provider_key`, `run_smoke_checks`, `run_schema_bootstrap`, `SchemaBootstrapPrivilegeError` are all present and green — the router can orchestrate them directly. Ordering contract is docstringed (schema bootstrap BEFORE `bootstrap_operator`).
- **158-07 (main.py wiring):** unblocks `test_setup_boot_tolerant.py`.
- No STATE/ROADMAP writes performed (per execution contract — the phase orchestrator owns those).

## Self-Check: PASSED

- Created files verified on disk: `setup_service.py`, `158-05-SUMMARY.md`, `deferred-items.md`, and the 4 modified test files.
- Commits verified in git: `01fab7b3` (Task 1), `1e4161e6` (Task 2), `5f1dc5bc` (Task 3).
- Final 5-file gate re-run: **16 passed**.

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
