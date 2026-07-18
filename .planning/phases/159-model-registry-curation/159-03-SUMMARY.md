---
phase: 159-model-registry-curation
plan: 03
subsystem: database
tags: [supabase, migration, app_settings, pydantic, settings-cache, fail-soft, model-registry, feature-flag]

# Dependency graph
requires:
  - phase: 147-operator-control-plane (FLAG-01, migration 097)
    provides: "the _DIRECT_COLUMNS flag-column precedent + the 30s TTL settings cache (_load_settings_from_db / save_app_settings / _val_bool readback) the toggle rides + the app_settings-only (env_attr=None) flag-field pattern"
  - phase: 158-install-wizard (DEPLOY-02, migration 102)
    provides: "the setup_complete fail-soft readback precedent (_val_bool(row, ..., None, <default>)) — code ships safely ahead of an operator-applied migration"
  - phase: 159-model-registry-curation (plan 02)
    provides: "model_discovery_filter_enabled on _FLAG_HUMAN_NAMES — the WRITE key whose READBACK this plan wires (PUT /admin/flags -> save_app_settings)"
provides:
  - "migration 103 — idempotent ADD COLUMN app_settings.model_discovery_filter_enabled boolean NOT NULL DEFAULT true (self-seeding, operator-applied)"
  - "UserEffectiveSettings.model_discovery_filter_enabled (bool, default True) + fail-soft _val_bool readback in _build_settings_from_row (absent/None column -> True, never raises)"
  - "GET /settings model_discovery_filter_enabled response field + _build_response serialization (the Control Room shell reads the persisted default)"
  - "main._DIRECT_COLUMNS entry (legacy settings_override.json->DB migration allowlist, documentation-completeness)"
  - "supabase/full-schema.sql regenerated with the column"
affects: [159-plan-04, 159-plan-05, 159-plan-06 (frontend ModelDiscoveryPanel reads model_discovery_filter_enabled from GET /settings as the persisted filter default), 159-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persisted operator toggle READBACK rides the existing 30s TTL settings cache as an app_settings-only field (env_attr=None) — no new cache, no new read path (the FLAG-01 pattern)"
    - "Fail-soft default-ON: _val_bool(row, key, None, True) returns True when the column is absent (migration authored-but-unapplied) — the mig-102 setup_complete precedent, but default-ON not default-OFF"
    - "Operator-gated migration checkpoint: Claude AUTHORS the migration (Task 1), an OPERATOR applies it via the Supabase SQL editor (Task 2, human-action gate), then Claude regenerates full-schema.sql — never db push/reset, never Claude-applied"

key-files:
  created:
    - "supabase/migrations/103_model_discovery_filter.sql — the self-seeding ADD COLUMN (099-style apply/cloud-parity header)"
    - "backend/tests/test_159_filter_setting.py — 5 tests (fail-soft absent->True, None->True, False round-trip, True round-trip, _DIRECT_COLUMNS membership)"
    - ".planning/phases/159-model-registry-curation/deferred-items.md — out-of-scope pre-existing eval_runner 403 rot logged"
  modified:
    - "backend/app/models/user_settings.py — UserEffectiveSettings field + fail-soft readback line"
    - "backend/app/api/settings.py — FullSettingsResponse field + _build_response serialization"
    - "backend/app/main.py — _DIRECT_COLUMNS entry"
    - "supabase/full-schema.sql — regenerated (1-line insertion: the new column on app_settings)"
    - "backend/tests/unit/test_settings.py — _fake_settings helper carries the new field _build_response now reads (deviation, Rule 1)"

key-decisions:
  - "Fail-soft default-ON via _val_bool(row, \"model_discovery_filter_enabled\", None, True): an absent column (migration not yet applied) OR a DB NULL both read True, and the settings load never raises (T-159-07) — so the code shipped + committed AHEAD of the operator apply"
  - "The _DIRECT_COLUMNS entry is for documentation-completeness of the legacy settings_override.json->DB migration path (the ONLY consumer), mirroring the mig 097/099 flag-column additions — it is NOT the write-path SQLi guard (that is _FLAG_KEYS + save_app_settings's _VALID_COLUMN_NAME regex, wired in Plan 02)"
  - "Migration authored in Task 1 but NOT applied by Claude — Task 2 is a human-action gate: the operator pastes the SQL into the LOCAL Supabase editor (never db push/reset), then Claude regenerates full-schema.sql (no --reset, live-DB dump)"
  - "Self-seeding DEFAULT true column => no seed row, no deploy-artifact change (check-deploy-drift.sh PASS exit 0; migration 103 correctly NOT flagged seed-like)"

patterns-established:
  - "app_settings-only readback field (env_attr=None) added beside the FLAG-01 kill-switches, threading automatically through _load_settings_from_db -> _build_settings_from_row"
  - "When a new field is added to _build_response, the hand-maintained _fake_settings namespace stand-in in tests/unit/test_settings.py must carry it (it mirrors every attribute _build_response reads directly)"

requirements-completed: []  # MODEL-03 is a phase-spanning requirement delivered across all 6 plans — NOT marked complete at plan 03 (verify-work owns the final flip)

# Metrics
duration: ~40 min active (plus an operator checkpoint pause for the migration-103 apply; 111 min wall-clock incl. the pause)
completed: 2026-07-18
---

# Phase 159 Plan 03: Persist Discovery-Filter Default as an Operator-Governed app_settings Knob Summary

**Migration 103 adds a self-seeding `app_settings.model_discovery_filter_enabled boolean DEFAULT true`, and the full fail-soft readback chain (Settings field + `GET /settings` + `_DIRECT_COLUMNS`) gives the discovery filter a durable, multi-worker home that rides the existing 30s TTL settings cache — the code shipped ahead of the operator-applied migration and reads a safe `true` default when the column is absent.**

## Performance

- **Duration:** ~40 min active work (Task 1 wiring + tests, Task 2 schema regen), plus an operator checkpoint pause for the migration-103 apply (111 min wall-clock including the pause).
- **Started:** 2026-07-17T23:32:49Z
- **Completed:** 2026-07-18T01:23:52Z
- **Tasks:** 2 (Task 1 autonomous; Task 2 operator-gated human-action)
- **Files modified:** 8 (3 source modified, 1 migration created, 1 schema regenerated, 2 test files created/modified, 1 deferred-items doc)

## Accomplishments
- **Migration 103** (`supabase/migrations/103_model_discovery_filter.sql`) — one idempotent `ADD COLUMN IF NOT EXISTS app_settings.model_discovery_filter_enabled boolean NOT NULL DEFAULT true`, self-seeding (existing rows inherit `true`), carrying the verbatim 099-style APPLY / CLOUD-PARITY header. Authored by Claude, applied by the operator (D-159-04, SC#1).
- **Fail-soft readback chain** — `UserEffectiveSettings.model_discovery_filter_enabled` (default `True`) reads via `_val_bool(row, "model_discovery_filter_enabled", None, True)`; an absent column (pre-apply) OR a DB NULL returns `True` and never raises (T-159-07). Proven by 5 unit tests over `_build_settings_from_row`.
- **`GET /settings` surface** — the field is on `FullSettingsResponse` + serialized in `_build_response`, so the Control Room shell can read the persisted "filter on by default" preference (D-159-04).
- **`main._DIRECT_COLUMNS`** — the column joins the legacy-migration allowlist for documentation-completeness (mirroring the mig 097/099 flag columns), correctly distinguished from the write-path SQLi guard.
- **Operator-applied + schema regenerated** — the operator applied migration 103 to the local Supabase DB (independently psycopg2-verified: `boolean, NOT NULL, DEFAULT true`); `scripts/regenerate-full-schema.sh` (no `--reset`) rebuilt `supabase/full-schema.sql` with exactly one added line (`grep -c` = 1, at line 481).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 103 + wire the app_settings readback chain (fail-soft)** — `7a4809ae` (feat)
2. **Task 2: [OPERATOR] Apply migration 103 + regenerate full-schema.sql** — `e13e842a` (chore — the schema regen; migration file itself was committed in `7a4809ae`)

**Plan metadata:** `<final-commit>` (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/103_model_discovery_filter.sql` — the self-seeding `ADD COLUMN` (authored, operator-applied).
- `backend/app/models/user_settings.py` — `UserEffectiveSettings.model_discovery_filter_enabled: bool = True` (app_settings-only) + the `_val_bool(row, ..., None, True)` fail-soft readback in `_build_settings_from_row`.
- `backend/app/api/settings.py` — `model_discovery_filter_enabled: bool` on `FullSettingsResponse` + `model_discovery_filter_enabled=s.model_discovery_filter_enabled` in `_build_response`.
- `backend/app/main.py` — `"model_discovery_filter_enabled"` added to `_DIRECT_COLUMNS`.
- `supabase/full-schema.sql` — regenerated (single-line insertion: the new column on `app_settings`).
- `backend/tests/test_159_filter_setting.py` — 5 tests (fail-soft default, None->True, False/True round-trips, `_DIRECT_COLUMNS` membership).
- `backend/tests/unit/test_settings.py` — `_fake_settings` helper updated to carry the new field (deviation).
- `.planning/phases/159-model-registry-curation/deferred-items.md` — logs the out-of-scope pre-existing `test_eval_runner` 403.

## Decisions Made
- **Fail-soft default-ON** — `_val_bool(row, "model_discovery_filter_enabled", None, True)`: absent column OR DB NULL -> `True`, no exception, so the code was safe to land + commit before the operator applied migration 103 (mig-102 `setup_complete` precedent, but default-ON per D-159-04).
- **`_DIRECT_COLUMNS` is documentation-completeness, not the SQLi guard** — the only consumer is `_migrate_settings_override` (the one-shot legacy `settings_override.json`->DB path); the write-path SQLi safety is independently `_FLAG_KEYS` + `save_app_settings`'s `_VALID_COLUMN_NAME` regex (Plan 02). Added for consistency with the shipped mig 097/099 flag columns, for the correct reason.
- **Operator-gated apply** — migration authored in Task 1, applied by the operator via the Supabase SQL editor in Task 2 (human-action gate); Claude never runs the SQL, never `db push`/`db reset`. After the operator's "applied" confirmation, Claude regenerated `full-schema.sql` (no `--reset`, a data-preserving live-DB dump).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Update the `_fake_settings` test helper to carry the new `_build_response` field**
- **Found during:** Task 1 (settings.py serialization wiring)
- **Issue:** `_build_response` now reads `s.model_discovery_filter_enabled`. The hand-maintained `_fake_settings` `SimpleNamespace` stand-in in `tests/unit/test_settings.py` (which mirrors "every attribute the response builder reads directly") lacked the field, so `test_build_response_wires_shared_judge_resolver` raised `AttributeError: 'types.SimpleNamespace' object has no attribute 'model_discovery_filter_enabled'` at `settings.py:241`. The production change is correct; the test helper must track the new read.
- **Fix:** Added `model_discovery_filter_enabled=True` to the `_fake_settings` base dict (mirroring production ordering, beside the FLAG-01 flags).
- **Files modified:** `backend/tests/unit/test_settings.py`
- **Verification:** `test_build_response_wires_shared_judge_resolver` passes after the fix (re-run confirmed green).
- **Committed in:** `7a4809ae` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 correctness). Both the fix and the new field are additive/defensive.
**Impact on plan:** No scope creep — the helper fix is the mechanical consequence of adding a required read to `_build_response`, exactly the plan's intent.

## Issues Encountered

- **Out-of-scope pre-existing failure (logged, NOT fixed):** `tests/test_eval_runner.py::test_post_applies_provider_override_to_user_settings` fails with `403 {"detail":"This feature is available to administrators only."}` — the eval-run endpoint's Phase-148 `require_visible` operator gate denies the test's non-operator user. This is unrelated to Plan 03: the test builds settings via `UserEffectiveSettings.model_construct(...)` (immune to the new defaulted field) and never touches `_build_response`/`GET /settings`; after fixing the one genuinely-affected helper, the 403 persists unchanged (a clean gate denial, not a construction error). An empirical clean-HEAD re-run was attempted via a throwaway `git worktree` but blocked by a Windows `Filename too long` limit on a deep `.planning/milestones/v2.6-phases/...` path (environment limitation). Logged to `deferred-items.md` per the executor SCOPE BOUNDARY rule; broken worktree pruned, main tree confirmed intact on `develop`.
- **Windows CRLF warnings** on the new/regenerated files are harmless line-ending normalization (Git auto-converts on next touch).

## User Setup Required

**Cloud parity (DEFERRED to the standing production-push checklist — do NOT touch cloud now).** At the next promotion, paste `supabase/migrations/103_model_discovery_filter.sql` into the CLOUD Supabase SQL editor alongside the already-pending migrations 099/100/101/102, and set/verify any related cloud config per `docs/DEPLOYMENT-WORKFLOW.md`. The local apply is complete (operator-confirmed + psycopg2-verified).

## Next Phase Readiness
- The persisted, operator-governed, multi-worker discovery-filter default is live locally: `GET /settings` returns `model_discovery_filter_enabled: true`, and it survives sessions + `WORKER_COUNT=2` via the 30s TTL settings cache.
- Frontend plans (04-06) can now read `settings?.model_discovery_filter_enabled ?? true` for the `ModelDiscoveryPanel` filter default (the shell `capabilityFlags` idiom).
- The write half (Plan 02, `PUT /admin/flags`) + this read half (Plan 03) together close D-159-04's persistence requirement.
- **MODEL-03 stays open** — it spans all 6 plans and is flipped at phase verify-work, not here.

## Self-Check: PASSED
- `supabase/migrations/103_model_discovery_filter.sql` — FOUND
- `backend/tests/test_159_filter_setting.py` — FOUND
- `.planning/phases/159-model-registry-curation/deferred-items.md` — FOUND
- `model_discovery_filter_enabled` in `supabase/full-schema.sql` — FOUND (1, line 481)
- `model_discovery_filter_enabled` in `backend/app/models/user_settings.py` — FOUND
- `model_discovery_filter_enabled` in `backend/app/api/settings.py` — FOUND
- `"model_discovery_filter_enabled"` in `backend/app/main.py` `_DIRECT_COLUMNS` — FOUND
- Commit `7a4809ae` (Task 1 feat) — FOUND
- Commit `e13e842a` (Task 2 chore, schema regen) — FOUND

---
*Phase: 159-model-registry-curation*
*Completed: 2026-07-18*
