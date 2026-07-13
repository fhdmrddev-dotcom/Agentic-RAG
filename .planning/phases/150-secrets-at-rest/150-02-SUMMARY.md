---
phase: 150-secrets-at-rest
plan: 02
subsystem: database
tags: [migration, postgres, supabase, app_settings, secrets, ddl]

# Dependency graph
requires:
  - phase: 150-01
    provides: "secret_cipher.py + SECRET_COLUMNS frozenset (set-equal to main._API_KEY_COLUMNS) — the 12-column contract this migration must satisfy"
provides:
  - "10 missing app_settings secret text columns (9 {provider}_api_key + tavily_api_key) applied to the live local DB"
  - "All 12 members of _API_KEY_COLUMNS now exist as text on app_settings — provider/Tavily keys are DB-persistable + encryptable"
  - "supabase/migrations/100_secret_key_columns.sql (idempotent DDL) + regenerated supabase/full-schema.sql"
  - "Cloud parity carried: mig 100 listed pending on cloud (not applied)"
affects: [150-03, 150-04, 150-05, secrets-encryption, provider-key-save]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent text-column ADD (ADD COLUMN IF NOT EXISTS, no DEFAULT) mirroring mig 099/097 shape"
    - "Apply-via-psycopg2/SQL-editor + regenerate-full-schema (no --reset) + carry cloud parity"

key-files:
  created:
    - supabase/migrations/100_secret_key_columns.sql
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "10 text columns, no DEFAULT — a NULL secret column is the correct 'unset → env fallback' state (D-150-01/08)"
  - "No RLS change — app_settings writes are service-role only (no per-user backstop)"
  - "Applied to live local DB via inline psycopg2 python -c (never a scratch .py in backend/); never db push/db reset"

patterns-established:
  - "Secret-column migration convention: source of truth is main._API_KEY_COLUMNS; add only the missing members; IF NOT EXISTS makes re-runs safe"

requirements-completed: []  # SEC-01 stays OPEN by convention (false-green avoidance) — closes at phase verify-work/secure-phase after all 5 plans land

# Metrics
duration: ~2min
completed: 2026-07-13
---

# Phase 150 Plan 02: Secret Key Columns Migration Summary

**Migration 100 adds the 10 missing app_settings secret text columns (9 provider keys + tavily_api_key), applied to the live local DB so all 12 members of `_API_KEY_COLUMNS` exist — closing the DB divergence behind the D-150-07 silent provider-key save.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-13T17:32:14Z
- **Completed:** 2026-07-13T17:34:03Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 regenerated)

## Accomplishments
- Authored `supabase/migrations/100_secret_key_columns.sql` — idempotent DDL adding exactly the 10 missing `text` secret columns (openai/anthropic/google/openrouter/ollama/deepseek/moonshot/minimax/zhipu + tavily `_api_key`), no DEFAULT, plus a global-row guard and the full APPLY/regenerate/CLOUD-PARITY header block.
- [BLOCKING] Applied the migration to the running local Supabase Postgres via inline psycopg2 — all 12 secret columns now present as `text` (was 2: embedding_api_key + rerank_api_key). Raw `SELECT openai_api_key FROM app_settings` now executes without `UndefinedColumn`.
- Regenerated `supabase/full-schema.sql` (no --reset, live-DB dump) — the 10 new columns are reflected; cloud parity carried (`pending-cloud-migrations.sh` lists mig 100).
- Unblocked Wave 2 (Plan 03 ciphertext-at-rest, Plan 04 D-150-07 raise-on-failure): encrypt-on-write now targets real columns (RESEARCH Pitfall 2 closed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 100 (10 missing secret text columns)** - `fbd6cb4e` (feat)
2. **Task 2 [BLOCKING]: Apply mig 100 to live DB + regenerate full-schema** - `0bc5f83d` (chore)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — see final metadata commit.

## Files Created/Modified
- `supabase/migrations/100_secret_key_columns.sql` - Idempotent DDL adding the 10 missing `app_settings` secret `text` columns; APPLY/regenerate/cloud-parity header.
- `supabase/full-schema.sql` - Regenerated single-file deploy artifact now reflecting all 12 secret columns (4412 lines).

## Decisions Made
None beyond the plan — followed D-150-08 as specified. Text columns, no DEFAULT (NULL = env-fallback state); no RLS change (service-role writes only); applied via psycopg2, never `db push`/`db reset`; cloud parity carried, not applied (operator-gated deploy).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. The migration applied cleanly on first run; the automated 12-column assertion and raw-SELECT probe both passed; full-schema regenerated without a reset.

## Threat Model Notes
- **T-150-07 (Information Disclosure):** Mitigated as planned — the 10 new columns default NULL; the migration writes no plaintext. Encryption activates on the Plan 04 keyed-boot sweep. The migration only creates capacity.
- **T-150-07b (Tampering / re-run):** Mitigated — `ADD COLUMN IF NOT EXISTS` is idempotent (verified: applied against a DB that already had embedding_api_key/rerank_api_key with no error).
- **T-150-04a (DoS / provider-key save):** Mitigated — this [BLOCKING] apply precedes Wave-2 verification; wave ordering (mig Wave 1 → seams Wave 2) enforced.

No new threat surface beyond the plan's `<threat_model>`.

## Known Stubs
None — this is a pure DDL migration; no application code, no data-flow stubs.

## User Setup Required
None for local dev. **Cloud parity (deferred, operator-gated):** at the next production promotion, paste `supabase/migrations/100_secret_key_columns.sql` into the CLOUD Supabase SQL editor (it joins mig 099 in the pending-on-cloud set). Do NOT touch cloud now.

## Next Phase Readiness
- Wave 2 unblocked: all 12 secret columns exist as `text` in the live local DB — Plan 03 (encrypt-on-write / ciphertext-at-rest) and Plan 04 (D-150-07 raise-on-failure sweep) can now target real columns.
- SEC-01 intentionally NOT marked complete (mirrors 148/149 false-green-avoidance convention) — the phase requirement closes at verify-work/secure-phase after all 5 plans land.

---
*Phase: 150-secrets-at-rest*
*Completed: 2026-07-13*
