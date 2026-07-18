---
phase: 158-first-run-install-wizard-stretch
plan: 02
subsystem: database
tags: [migration, app_settings, supabase, ddl, fail-soft, setup-wizard, deploy, pydantic]

# Dependency graph
requires:
  - phase: 147-operator-maintenance
    provides: 097_operator_flags.sql (the additive-boolean migration shape) + maintenance_mode() (the fail-soft cached-flag reader this mirrors exactly)
  - phase: 158-first-run-install-wizard-stretch (plan 01)
    provides: test_setup_finalize.py::test_finalize_also_writes_auditable_db_flag — the Wave-0 contract asserting user_settings.setup_complete() exists
provides:
  - "Migration 102 (supabase/migrations/102_setup_complete.sql) — app_settings.setup_complete boolean NOT NULL DEFAULT false + the A6 global-row guarantee, authored with the 097 apply-header discipline (NOT applied — live apply is operator-gated plan 158-12)"
  - "user_settings.setup_complete() — the AUDITABLE/app-facing D-05 finalize signal; fail-soft to False on cold cache / DB blip / column-absent (mirrors maintenance_mode())"
  - "UserEffectiveSettings.setup_complete field (default False) + its _build_settings_from_row readback (env_attr=None, app_settings-only, missing-column→False)"
affects: [158-06, 158-12, setup_service, setup-finalize, full-schema-regen, cloud-parity]

# Tech tracking
tech-stack:
  added: []  # zero new packages (158-RESEARCH Package Legitimacy Audit — phase installs nothing)
  patterns:
    - "Authored-but-not-applied migration: the SQL file + a fail-soft reader land autonomously now; the live-DB apply + full-schema regen are a SEPARATE operator-gated plan (158-12). The reader tolerates the column being absent (defaults False) so the code chain is unblocked."
    - "Fail-soft auditable DB flag beside a blip-proof file authority (D-05): the DB boolean is app-facing ONLY, never the gate — a DB blip can never bounce live users into the wizard."

key-files:
  created:
    - supabase/migrations/102_setup_complete.sql
  modified:
    - backend/app/models/user_settings.py

key-decisions:
  - "Applied the setup_complete field to UserEffectiveSettings (the actual Pydantic model load_app_settings() returns) — the plan text said 'AppSettings dataclass/model' but no class by that name exists; UserEffectiveSettings is the real settings model beside maintenance_mode."
  - "setup_complete boolean is NOT NULL DEFAULT false (Postgres backfills existing rows false) — matches D-05 polarity: a fresh box is 'not set up'."
  - "Readback uses _val_bool(row, 'setup_complete', None, False) (env_attr=None, app_settings-only) so a missing/None column reads False — the fail-soft-when-column-absent behavior the execution contract requires."
  - "DEPLOY-02 stays OPEN — this is Wave 1 of a multi-wave phase (migration + reader only); the requirement is not complete until the full wizard chain (158-03..158-12) lands."
  - "No live-DB operation performed (no apply, no full-schema regen) — deliberately deferred to operator-gated plan 158-12 per the execution contract."

patterns-established:
  - "Authored-but-not-applied migration + fail-soft reader: unblocks the autonomous code chain while keeping the live-DB touch operator-gated"
  - "Auditable DB flag mirrors maintenance_mode() no-raise posture; the file marker (setup_store.py) is the sole gate authority (D-05)"

requirements-completed: []  # DEPLOY-02 is NOT completed by this Wave-1 plan — it stays OPEN until the impl chain (158-03..158-12) lands

# Metrics
duration: ~20min
completed: 2026-07-17
---

# Phase 158 Plan 02: Migration 102 + setup_complete() Reader Summary

**Authored migration 102 (`app_settings.setup_complete boolean NOT NULL DEFAULT false` + A6 global-row guarantee, 097 apply-header discipline) and added the fail-soft `setup_complete()` reader beside `maintenance_mode()` — the AUDITABLE DB half of the D-05 dual finalize marker; the live apply + full-schema regen are deliberately deferred to operator-gated plan 158-12.**

## Performance

- **Duration:** ~20 min (reads + authoring + verification; task commits span 2026-07-17T05:04→05:06 +04:00)
- **Started:** ~2026-07-17T00:47Z
- **Completed:** 2026-07-17T01:06Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- **Migration 102 authored** with the exact 097 apply-header discipline — one additive column (`setup_complete boolean NOT NULL DEFAULT false`) plus the A6 `INSERT ... ('global') ON CONFLICT DO NOTHING` global-row guarantee. Header states: paste into the LOCAL Supabase SQL editor (or psycopg2 to 127.0.0.1:54322), NEVER `db push`/`db reset`; regen full-schema after; cloud parity appended to the migs-099/100/101 + `SECRETS_ENCRYPTION_KEY` pending list. The live apply is explicitly marked as operator-gated plan 158-12.
- **`setup_complete()` reader added** immediately beside `maintenance_mode()` (user_settings.py) — mirrors its no-raise posture verbatim: `try: return load_app_settings().setup_complete` / `except Exception: return False`. Docstring states this is the AUDITABLE/app-facing signal ONLY, NOT the gate authority (D-05).
- **Fail-soft-when-column-absent verified both directions** — the field + `_build_settings_from_row` readback (`env_attr=None`) resolve column-absent→False, column-True→True, column-False→False, so the reader degrades gracefully even though migration 102 is authored-but-not-applied on the local DB.
- **Zero regression** — `test_150_save_seam.py` + `test_147_maintenance_mw.py` (the settings-seam + sibling-flag suites) = 25 passed; the change is purely additive (new defaulted field + new builder kwarg + new function).

## Task Commits

Each task was committed atomically:

1. **Task 1: write migration 102 (analog 097)** — `5d1146ac` (feat)
2. **Task 2: add the setup_complete() reader beside maintenance_mode()** — `311875b9` (feat)

**Plan metadata:** (this SUMMARY) — final docs commit by the orchestrator.

## Files Created/Modified
- `supabase/migrations/102_setup_complete.sql` — **created.** `ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;` + `INSERT INTO public.app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;` with the 097 apply/cloud-parity header + a 158-12-deferral note.
- `backend/app/models/user_settings.py` — **modified** (3 additive edits): (1) `setup_complete: bool = False` field on `UserEffectiveSettings` beside the Phase-147 flags; (2) `setup_complete=_val_bool(row, "setup_complete", None, False)` readback in `_build_settings_from_row`; (3) the `def setup_complete() -> bool:` fail-soft reader beside `maintenance_mode()`.

## Acceptance Gate Results

**Task 1 (all pass):**
- `test -f supabase/migrations/102_setup_complete.sql` → PASS
- `grep -c "setup_complete boolean"` → **1** (exactly once, in the ALTER)
- `grep -c "ON CONFLICT DO NOTHING"` → **1** (≥1, the A6 global-row guarantee)
- `db push`/`db reset` → appear ONLY inside the "NEVER" warning (lines 17-18); no directive to run them

**Task 2 (all pass):**
- `grep -c "def setup_complete"` → **1**
- `python -c "import app.models.user_settings"` → `IMPORT_OK` (no syntax/attribute error)
- `python -c "from app.models.user_settings import setup_complete; print(setup_complete())"` → **`False`** (fail-soft, no raise, column not applied)
- Extra: `_build_settings_from_row` wiring proven both directions (absent→False, True→True, False→False → `WIRING_OK`)

**Wave-0 stubs flipped green:** **none this plan.** The single Wave-0 contract asserting this reader — `test_setup_finalize.py::test_finalize_also_writes_auditable_db_flag` (checks `getattr(us, "setup_complete", None)` is callable) — is gated behind a module-level `pytest.importorskip("app.services.setup_store")`. `setup_store.py` does not exist yet (it lands in a later impl wave), so the whole file currently **SKIPS** (`1 skipped`), not passes. The `setup_complete()` helper now satisfies that assertion, so the stub will flip green the moment `setup_store.py` lands — no moving target.

## Decisions Made
- **Applied the field to `UserEffectiveSettings`, not "AppSettings":** the plan's Task 2 action referenced an "`AppSettings` dataclass/model" that does not exist in `user_settings.py`; the real settings model (a Pydantic `BaseModel`, returned by `load_app_settings()`, home of `maintenance_mode`) is `UserEffectiveSettings`. Applied all three edits there. See Deviations.
- **`NOT NULL DEFAULT false`** (per the plan must_have) — Postgres backfills existing rows to `false`; a fresh box reads "not set up".
- **DEPLOY-02 stays OPEN** — Wave 1 of a multi-wave phase; the SQL is authored-but-not-applied and the reader is only the auditable half. `requirements-completed: []` (mirrors 158-01's Wave-0 precedent).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / plan naming mismatch] Applied the field to `UserEffectiveSettings` (the plan said "AppSettings")**
- **Found during:** Task 2 (add the setup_complete field to the settings model)
- **Issue:** The plan's Task 2 `<action>` says "add the field with a `False` default to the `AppSettings` dataclass/model and to `_build_settings_from_row`". `user_settings.py` has **no** class named `AppSettings` (verified: `grep "AppSettings"` → 0 matches). The actual settings model that `load_app_settings()` builds and returns — and where `maintenance_mode: bool` / `_build_settings_from_row` live — is the Pydantic `UserEffectiveSettings` `BaseModel`.
- **Fix:** Added `setup_complete: bool = False` to `UserEffectiveSettings` (beside the Phase-147 `maintenance_mode` field) and `setup_complete=_val_bool(row, "setup_complete", None, False)` to `_build_settings_from_row`. This is the class the plan's own analog reference (`maintenance_mode` at `user_settings.py:910`) reads via `load_app_settings().maintenance_mode`, so the intent is unambiguous.
- **Files modified:** `backend/app/models/user_settings.py`
- **Verification:** `setup_complete()` returns False fail-soft; `_build_settings_from_row` wiring proven both directions (`WIRING_OK`); import clean; 25 sibling-seam tests pass.
- **Committed in:** `311875b9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking / plan naming reconciliation)
**Impact on plan:** Zero scope change — the field landed on the correct, unambiguous model (the one `maintenance_mode` uses). Only the class name in the plan text was wrong; the deliverable is exactly as specified.

## Issues Encountered
- **Windows LF→CRLF warning** on `git add` of the migration — benign line-ending normalization notice, not an error; the file commits and greps correctly.
- **`RequestsDependencyWarning`** in pytest output (urllib3/chardet version mismatch) — a pre-existing environment warning unrelated to this plan; all targeted tests pass.

## Threat Surface Scan
No new security-relevant surface beyond the plan's `<threat_model>`. The migration adds one additive boolean column (no data exposure, no cross-user read path — T-158-mig). The reader is a fail-soft, read-only auditable signal that is explicitly NOT the gate authority (T-158-05 mitigation implemented: `setup_complete()` fails soft to False, so a DB blip can never bounce live users into the wizard). Zero new packages (T-158-SC). No threat flags.

## Known Stubs
None in the masking sense. The migration is a complete, valid DDL file — its **authored-but-not-applied** state is the intended autonomous deliverable per the execution contract (the live apply + `full-schema.sql` regen are operator-gated plan 158-12), documented in the migration header and the reader docstring. The `setup_complete()` reader is fully functional and degrades gracefully (defaults False) until the column exists — this is correct-by-design, not a stub that hides an unmet goal.

## Next Phase Readiness
- **158-06 (finalize endpoint)** has its DB write target (`app_settings.setup_complete` via `save_app_settings`) and its auditable read path (`setup_complete()`) ready.
- **158-12 (operator-gated apply)** owns: paste `102_setup_complete.sql` into the LOCAL Supabase SQL editor → `bash scripts/regenerate-full-schema.sh` (no `--reset`) → commit both → append 102 to the cloud-parity list (migs 099/100/101 + `SECRETS_ENCRYPTION_KEY`).
- **No blockers.** Zero new packages, zero live-DB touches, zero out-of-scope edits (only `supabase/migrations/102_setup_complete.sql` + `backend/app/models/user_settings.py` staged).

## Self-Check: PASSED

- `supabase/migrations/102_setup_complete.sql` — FOUND on disk.
- `backend/app/models/user_settings.py` — FOUND (modified) on disk.
- Commit `5d1146ac` (Task 1) — FOUND in git log.
- Commit `311875b9` (Task 2) — FOUND in git log.
- No file deletions in either commit; no untracked files left in scope.

---
*Phase: 158-first-run-install-wizard-stretch*
*Completed: 2026-07-17*
