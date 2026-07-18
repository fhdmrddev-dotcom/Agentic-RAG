---
phase: 150-secrets-at-rest
plan: 04
subsystem: infra
tags: [cryptography, fernet, multifernet, secrets, fastapi, lifespan, asyncpg, app_settings]

# Dependency graph
requires:
  - phase: 150-01
    provides: secret_cipher module (get_cipher, sweep_row, SECRET_COLUMNS, encrypt/decrypt)
  - phase: 150-02
    provides: migration 100 — the 12 real secret columns on app_settings (live)
  - phase: 150-03
    provides: encrypt-on-write (save_app_settings) + decrypt-on-read (_build_settings_from_row) seams
provides:
  - "Boot-time master-key gate: malformed SECRETS_ENCRYPTION_KEY refuses startup (D-150-04 fail-hard); missing key warns + boots plaintext (D-150-01 fail-open)"
  - "Eager idempotent at-rest sweep in lifespan: encrypts existing plaintext in place + rotates non-primary values (D-150-03/06), best-effort + WORKER_COUNT=2-safe"
  - "update_settings surfaces a failed save as HTTP 500 before the audit write + re-embed kick (D-150-07 / SC#2)"
  - "_API_KEY_COLUMNS re-pointed to secret_cipher.SECRET_COLUMNS (single source of truth)"
affects: [150-05, secure-phase-150, verify-work-150, cloud-deploy-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boot-time intent polarity: hard-fail validation (un-wrapped) beside best-effort side-effect (try/except) in one lifespan region"
    - "Testable lifespan steps extracted as named module-level callables (_validate_and_report_cipher / _sweep_secret_columns) mirroring seed_operators_from_env / assert_action_types_synced"

key-files:
  created:
    - backend/tests/api/test_150_settings_error.py
    - backend/tests/integration/test_150_sweep.py
    - backend/tests/integration/test_150_failopen.py
  modified:
    - backend/app/api/settings.py
    - backend/app/main.py

key-decisions:
  - "Extracted the boot key-gate + sweep into two named module-level helpers (vs pure inline lifespan code) so both polarities are unit/integration testable without booting the full lifespan (Redis ping / migrations / resume sweeps). The lifespan calls _validate_and_report_cipher() UN-wrapped, preserving the D-150-04 fail-hard wiring."
  - "The eager sweep helper takes the asyncpg pool as an argument (rather than calling get_pg_pool internally) so integration tests drive it against the live-PG fixture pool."

patterns-established:
  - "Different-polarity boot steps in one region: get_cipher() un-wrapped (crash on malformed) directly above a try/except-wrapped sweep (log + continue)."
  - "Live-PG integration tests reuse the test_081_1 guard + pool + save/restore-app_settings fixtures; the master key is driven by monkeypatching app.config.settings.secrets_encryption_key (test_150_cipher precedent)."

requirements-completed: [SEC-01]

# Metrics
duration: 4min
completed: 2026-07-13
---

# Phase 150 Plan 04: Boot-Time Key Gate + Eager Sweep + Failed-Save 500 Summary

**Lifespan now refuses startup on a malformed SECRETS_ENCRYPTION_KEY, warns + boots plaintext when it is missing, eager-sweeps existing plaintext secrets to enc:v1: idempotently on a keyed boot, and update_settings surfaces a failed save as HTTP 500 before any false audit row or spurious re-embed.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-13T17:52:27Z
- **Completed:** 2026-07-13T17:56:23Z
- **Tasks:** 2
- **Files modified:** 5 (2 source, 3 tests)

## Accomplishments
- **D-150-07 / SC#2:** `update_settings` raises `HTTPException(500, "Failed to save settings")` the moment `save_app_settings` returns False — placed immediately after the save and BEFORE the audit write + re-embed kick, so a swallowed DB write never reports a false 200 / false audit row / spurious re-embed.
- **D-150-04 fail-hard + D-150-01 fail-open:** `_validate_and_report_cipher()` is called UN-wrapped in `lifespan` — a malformed key re-raises `ValueError` and refuses startup for all WORKER_COUNT=2 workers; a missing key logs one loud warning naming `SECRETS_ENCRYPTION_KEY` and boots plaintext.
- **D-150-03 idempotent + D-150-06 rotation:** `_sweep_secret_columns()` (best-effort, try/except → log + continue) runs after `_migrate_settings_override()`, encrypts existing plaintext in place and rotates non-primary values via `sweep_row`, issuing one parameterized UPDATE writing only the changed columns; a second boot is a no-op.
- **Single source of truth:** `_API_KEY_COLUMNS` re-pointed to `secret_cipher.SECRET_COLUMNS` (no cycle; the legacy `key in _API_KEY_COLUMNS` use resolves against the frozenset).

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface the failed-save bool as HTTP 500 (D-150-07)** — `6c4a7b12` (feat; TDD RED→GREEN in one commit per phase convention)
2. **Task 2: Lifespan key validation + eager idempotent sweep + legacy comment** — `e9fb5c9c` (feat)

**Plan metadata:** (this SUMMARY + STATE.md + ROADMAP.md) — see final docs commit.

## Files Created/Modified
- `backend/app/api/settings.py` — `update_settings` now `if not await save_app_settings(updates): raise HTTPException(500, ...)`, before the audit + re-embed.
- `backend/app/main.py` — added `_validate_and_report_cipher()` + `_sweep_secret_columns(pool)`; wired both into `lifespan` (validation un-wrapped, sweep best-effort) after `_migrate_settings_override()`; re-pointed `_API_KEY_COLUMNS` to `SECRET_COLUMNS`; added the Pattern-5 sweep-backstop comment to `_migrate_settings_override`.
- `backend/tests/api/test_150_settings_error.py` (new) — 3 tests: 500 on failed save, audit+reembed short-circuit, successful save unaffected.
- `backend/tests/integration/test_150_sweep.py` (new) — live-PG: plaintext → enc:v1: after sweep + round-trip, second sweep a no-op (idempotent).
- `backend/tests/integration/test_150_failopen.py` (new) — missing key warns/no-raise, malformed key re-raises (T-150-05 wiring), no-key load path unchanged (SC#4).

## Decisions Made
- Extracted the two lifespan steps into named module-level callables (`_validate_and_report_cipher`, `_sweep_secret_columns`) instead of pure inline code, so both failure polarities are testable without booting the full lifespan. This mirrors the existing lifespan convention where each step is a named callable (`seed_operators_from_env`, `assert_action_types_synced`, `_migrate_settings_override`). The lifespan still calls the validator UN-wrapped, so the D-150-04 fail-hard wiring (T-150-05) is preserved and directly source-reviewable.
- `_sweep_secret_columns` takes the pool as an argument so the live-PG integration fixture can drive it directly.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the plan's `<action>` verbatim (the helper extraction is the plan-specified "add … a named step alongside the operator-seed block" shape, not a scope change).

## Issues Encountered
None. TDD RED was confirmed for Task 1 (the handler ignored the failed-save bool and fell through to `_build_response`, which errored on the stubbed settings — proving no 500 was raised pre-fix), then GREEN after the raise was added.

## Known Stubs
None — no hardcoded empty values, placeholders, or unwired data sources introduced.

## User Setup Required
None required for this plan. (Standing cloud-parity note, not new here: `SECRETS_ENCRYPTION_KEY` must be set in Coolify at promotion or cloud runs plaintext per D-150-01; migrations 099 + 100 still pending on cloud — tracked on the production-push checklist, do not couple.)

## Verification
- `pytest tests/api/test_150_settings_error.py -x -q` → 3 passed.
- `pytest tests/integration/test_150_sweep.py tests/integration/test_150_failopen.py -x -q` → 4 passed (PG up).
- `python -c "import app.main; ... assert app.main._API_KEY_COLUMNS == SECRET_COLUMNS"` → "constant re-pointed, main imports clean".
- Regression: `test_150_cipher` + `test_147_flag_failure_semantics` + `test_081_1_settings_migration` + `test_150_settings_error` → 27 passed.
- Source review: validation call NOT in try/except (mirrors `assert_action_types_synced`); sweep IS in try/except; `settings.py` raise sits before the audit write + re-embed kick.

## Next Phase Readiness
- Plan 05 (Control Plane signal via `encryption_status()`) is unblocked — the boot gate + sweep are the runtime-state producers whose status it surfaces.
- SEC-01 stays OPEN by phase convention (148/149 false-green avoidance) — it closes at verify-work / secure-phase after Plan 05 lands.

## Self-Check: PASSED
All 5 source/test files exist on disk; both task commits (`6c4a7b12`, `e9fb5c9c`) are present in git history.

---
*Phase: 150-secrets-at-rest*
*Completed: 2026-07-13*
