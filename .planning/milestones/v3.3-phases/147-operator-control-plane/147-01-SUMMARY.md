---
phase: 147-operator-control-plane
plan: 01
subsystem: database
tags: [feature-flags, app_settings, ttl-cache, fail-closed, supabase, migration, pydantic]

# Dependency graph
requires:
  - phase: 053-settings-unification
    provides: "app_settings boolean-column DDL pattern + the per-worker 30s TTL settings cache and _DIRECT_COLUMNS write-allowlist this plan extends"
provides:
  - "Three additive app_settings boolean columns (self_improve_enabled, workflows_enabled, maintenance_mode) live on the local DB via migration 097"
  - "Fail-closed / last-known-good read helpers with D-Q4 polarity: capability flags cold-read True, maintenance_mode cold-reads False"
  - "GET /settings (FullSettingsResponse) now carries the three flags — the Control Room capability grid's flag-read source, no new endpoint"
  - "_DIRECT_COLUMNS write-allowlist extended with the 3 flags (SQLi-safe operator writes)"
affects: [147-operator-control-plane, FLAG-01, maintenance-middleware, workflow-launch-gate, tool-gates, control-room-grid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-Q4 per-flag cold-cache polarity: a capability flag falls back to its migration default True on a truly-cold cache/exception (never silently disables a capability); maintenance_mode inverts and falls back to False (platform OPEN — failing 'closed' would be a self-inflicted outage)"
    - "Last-known-good TTL flag read: a transient DB blip returns the prior cached value, never flips a flag — proven by a patched one-shot read-failure test"
    - "Zero new flag infrastructure — the existing app_settings substrate + settings cache suffice (no Redis pub/sub cross-worker bust; ≤30s per-worker skew is accepted and honest, Pitfall 5)"

key-files:
  created:
    - supabase/migrations/097_operator_flags.sql
    - backend/tests/test_147_flag_failure_semantics.py
  modified:
    - backend/app/main.py
    - backend/app/models/user_settings.py
    - backend/app/api/settings.py
    - backend/tests/unit/test_settings.py
    - supabase/full-schema.sql
    - docs/DEPLOYMENT-WORKFLOW.md

key-decisions:
  - "D-Q4: maintenance_mode cold-cache/exception reads False (platform OPEN); capability *_enabled flags cold-read the migration default True"
  - "No cross-worker cache-bust (Pitfall 5) — a ≤30s per-worker skew is expected; per-worker invalidate_settings_cache on write suffices"
  - "Migration 097 is a pure additive schema change (ADD COLUMN IF NOT EXISTS, no seed rows) — noted in DEPLOYMENT-WORKFLOW.md §5 'A DB schema change' row, not the data-carrying seed-row row"

patterns-established:
  - "Operator/platform-wide flags live as global app_settings booleans (no per-user RLS scope) read through the shared TTL cache"
  - "Per-flag fail-safe polarity is chosen by the flag's real-world meaning, not a blanket fail-open/fail-closed rule"

requirements-completed: [FLAG-01]

# Metrics
duration: ~12min active (excludes the human-action checkpoint pause while the operator applied migration 097)
completed: 2026-07-11
---

# Phase 147 Plan 01: FLAG-01 Substrate Summary

**Three global `app_settings` operator flags (self_improve_enabled, workflows_enabled, maintenance_mode) wired through the 30s TTL cache with D-Q4 per-flag polarity and last-known-good fail-safety — migration 097 applied to the live DB and captured in full-schema.sql.**

## Performance

- **Duration:** ~12 min active work (Task 1 commit 12:53 → Task 2 commit 13:05); the human-action checkpoint pause (operator pasting migration 097 into the Supabase SQL editor) is excluded.
- **Started:** 2026-07-11 (Task 1)
- **Completed:** 2026-07-11T13:04:58+04:00
- **Tasks:** 2 (1 auto+TDD, 1 blocking human-action checkpoint)
- **Files modified:** 8 (2 created, 6 modified across both tasks)

## Accomplishments
- **Migration 097** adds three additive `app_settings` booleans (`self_improve_enabled DEFAULT true`, `workflows_enabled DEFAULT true`, `maintenance_mode DEFAULT false`) following the `053_settings_unification.sql` DDL pattern — applied to the live local DB and captured in `supabase/full-schema.sql`.
- **Fail-closed read helpers** modeled on `document_management_enabled()`: `self_improve_enabled()` / `workflows_enabled()` fall back to `True`; `maintenance_mode()` inverts and falls back to `False` (D-Q4). A transient DB blip returns last-known-good, never flips a flag.
- **GET /settings exposure**: the three flags added to `FullSettingsResponse` + `_build_response`, so the Control Room capability grid has a flag-read source with no new endpoint — consistent with the existing `web_search_enabled` / `sandbox_enabled` booleans.
- **SQLi-safe writes**: `_DIRECT_COLUMNS` write-allowlist extended with the three code-constant column names (T-147-01 mitigation).
- **Failure-semantics test suite** (`test_147_flag_failure_semantics.py`) proves cold-cache polarity per helper, last-known-good on a patched one-shot read failure, and cache invalidation on write.
- **Deploy parity recorded**: `docs/DEPLOYMENT-WORKFLOW.md` §5 + changelog now flag that migration 097 must be pasted into the cloud Supabase SQL editor at promotion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 097 + wire the 3 flags into the settings model with D-Q4 polarity helpers** — `4aae1f3e` (feat; TDD — migration + model wiring + failure-semantics tests in one commit)
2. **Task 2: [BLOCKING human-action] Apply migration 097 to the live local DB + regenerate the bootstrap schema** — `79a336a9` (docs; regen full-schema.sql + cloud-parity note; migration file itself already committed in Task 1)

_Note: Task 2 was a `checkpoint:human-action` gate — the operator pasted migration 097 into the local Supabase SQL editor and confirmed all three columns are live (`information_schema.columns` returned 3). This continuation agent then completed the machine steps (regen + parity note + commits)._

## Files Created/Modified
- `supabase/migrations/097_operator_flags.sql` — three additive `app_settings` boolean columns (created, Task 1)
- `backend/app/models/user_settings.py` — Pydantic fields + `_build_settings_from_row` mapping + three module-level read helpers with D-Q4 polarity (Task 1)
- `backend/app/main.py` — `_DIRECT_COLUMNS` allowlist extended with the three flags (Task 1)
- `backend/app/api/settings.py` — `FullSettingsResponse` fields + `_build_response` mapping for the three flags (Task 1)
- `backend/tests/test_147_flag_failure_semantics.py` — cold-cache polarity + last-known-good + cache-invalidation tests (created, Task 1)
- `backend/tests/unit/test_settings.py` — settings test updated for the new fields (Task 1)
- `supabase/full-schema.sql` — regenerated from the live local DB; now carries the three new columns (Task 2)
- `docs/DEPLOYMENT-WORKFLOW.md` — §5 deploy-parity note + changelog entry for migration 097 (Task 2)

## Decisions Made
- **D-Q4 per-flag polarity** — maintenance_mode fails OPEN (False) on a cold cache to avoid a self-inflicted outage; capability flags fail to their default ON (True) to never silently disable a capability on a blip.
- **No cross-worker cache-bust** (Pitfall 5) — per-worker `invalidate_settings_cache` on write is sufficient; a ≤30s per-worker skew is expected and honest.
- **097 documented as a schema change, not a seed row** — it is pure additive DDL (no data), so the parity note lives in the "A DB schema change" row of DEPLOYMENT-WORKFLOW.md §5.

## Deviations from Plan

None - plan executed exactly as written.

Task 2 followed the checkpoint's `how-to-verify` machine steps precisely. Two environment notes (not plan deviations):
- The plan's `psql`-based verification command is unavailable on this host (`psql` not on PATH; the Supabase Postgres container is reachable only via Docker, which is permission-gated here). Verification was instead achieved end-to-end: the operator confirmed the three columns via the Supabase SQL editor (`information_schema.columns` returned 3), and the no-reset `regenerate-full-schema.sh` — which dumps the *live* DB schema — produced a `full-schema.sql` containing all three columns (lines 465-467), proving they are live.

## Issues Encountered
None. The migration is idempotent (`ADD COLUMN IF NOT EXISTS`), the regen ran clean (4398 lines, latest migration on disk = `097_operator_flags.sql`), and the commit introduced no file deletions.

## User Setup Required
None - no external service configuration required for local. At cloud promotion, the operator must paste `supabase/migrations/097_operator_flags.sql` into the cloud Supabase SQL editor (now recorded in DEPLOYMENT-WORKFLOW.md §5).

## Next Phase Readiness
- The FLAG-01 substrate is live: every later enforcement seam (maintenance middleware, workflow-launch block, tool gates, the Control Room capability grid) can now read the three flags through the shared TTL cache with correct fail-safe polarity.
- Runtime is byte-identical until an operator flips a flag (defaults preserve current behavior — D-06 substrate ready).
- Cloud parity pending until the next production promotion (migration 097 apply, documented).

## Self-Check: PASSED

- FOUND: `supabase/migrations/097_operator_flags.sql`
- FOUND: `backend/tests/test_147_flag_failure_semantics.py`
- FOUND: `.planning/phases/147-operator-control-plane/147-01-SUMMARY.md`
- FOUND: `supabase/full-schema.sql` (contains all three columns, lines 465-467)
- FOUND: commit `4aae1f3e` (Task 1)
- FOUND: commit `79a336a9` (Task 2)
- FOUND: `docs/DEPLOYMENT-WORKFLOW.md` parity note referencing migration 097

---
*Phase: 147-operator-control-plane*
*Completed: 2026-07-11*
