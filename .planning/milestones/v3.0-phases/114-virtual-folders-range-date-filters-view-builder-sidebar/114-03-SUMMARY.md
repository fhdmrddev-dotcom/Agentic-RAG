---
phase: 114-virtual-folders-range-date-filters-view-builder-sidebar
plan: 03
subsystem: database / virtual-folders typed-column migration
tags: [VIEW-03, migration-074, generated-stored-columns, immutable-date-parser, btree-index, explain, R-114-B, psycopg2-apply, full-schema]

# Dependency graph
requires:
  - phase: 114-01
    provides: "Authored migration 074 (the two GENERATED STORED typed columns + btree indexes); the Fragment compiler routing document_type→document_type_norm and date→date_typed"
  - phase: 114-02
    provides: "The widened two-leg resolve_view that queries document_type_norm / date_typed; the 3 typed-leg xfail rows guarding on a live information_schema.columns check"
  - phase: 113
    provides: "The per-viewer leak-safe resolve core + the live :54322 test harness (skip-clean-when-down, FK-safe throwaway-user teardown)"
provides:
  - "Migration 074 LIVE on :54322 — document_type_norm + date_typed GENERATED ALWAYS AS (...) STORED + idx_documents_document_type_norm + idx_documents_date_typed btree indexes, auto-backfilled, dev data preserved (33 docs)"
  - "public.view_iso_to_date(text) — IMMUTABLE plpgsql ISO-date parser (regex-guard + make_date + EXCEPTION→NULL): the calendar-safe replacement for the rejected (text)::date cast (R-114-B / Open Q2 / Assumption A1 resolved at apply time)"
  - "Regenerated supabase/full-schema.sql carrying both typed columns + indexes + the helper fn (machine-dumped, no hand-edit)"
  - "test_114_typed_columns.py (auto-backfill across the full dataset + bad-date safety matrix) + test_114_explain_index.py (~10k-seed SC#3 index-use proof with a real-doc preservation guard)"
  - "The 3 Plan-02 typed-leg xfail rows converted to GREEN (2 in resolve_range_date, 1 in count_only)"
  - "scripts/apply_migration_074.py — the psycopg2-direct applier (idempotent, pre/post doc-count guard, read-back assertions)"
affects:
  - "Plans 05/06 (frontend) — the date-range / document_type filters now resolve through indexed typed columns; the live builder count + sidebar badges scale to ~10k docs"
  - "Phase 115 (agent-tool) — relative-date + typed-column queries hit the index"
  - "Any future migration adding date-from-jsonb columns — reuse public.view_iso_to_date instead of (text)::date in a generation expression"

# Tech tracking
tech-stack:
  added: []  # zero new packages
  patterns:
    - "IMMUTABLE plpgsql wrapper for a STABLE/raising parse so it is legal in a GENERATED STORED expression: regex-guard the shape, parse via an immutable primitive (make_date), trap the residual error in an EXCEPTION block returning NULL (calendar-safe, write-never-breaks)"
    - "psycopg2-direct migration apply against :54322 in ONE transaction with a pre/post documents-count guard proving no reset (the 072/073/100/102/110/111.1 precedent) — NEVER db push/db reset"
    - "SC#3 EXPLAIN index-use test seeds ~10k throwaway rows + ANALYZE so the planner has real stats (a tiny table seq-scans regardless of indexes), asserts Index/Bitmap Index Scan (not Seq Scan), then fully tears down the seed with a real-doc preservation assertion"

key-files:
  created:
    - scripts/apply_migration_074.py
    - backend/tests/integration/test_114_typed_columns.py
    - backend/tests/integration/test_114_explain_index.py
  modified:
    - supabase/migrations/074_view_typed_columns.sql
    - supabase/full-schema.sql
    - backend/tests/integration/test_114_resolve_range_date.py
    - backend/tests/integration/test_114_count_only.py

key-decisions:
  - "Replaced the authored (metadata->>'date')::date generation expression with an IMMUTABLE plpgsql helper (public.view_iso_to_date) — PG15 rejects the bare cast as 'generation expression is not immutable' (the text→date I/O cast and to_date() are STABLE). The helper is strictly SAFER than the original: it also NULLs calendar-invalid shape-passing dates (2026-13-99, 2026-02-31) that the original would have errored on."
  - "The applier mirrors apply_migration_073.py exactly (one transaction, pre/post doc-count baseline, read-back assertions) and adds an idempotency guard skipping the ALTER if the columns already exist."
  - "Un-marked the 3 typed-leg xfail rows by removing only the @pytest.mark.xfail decorator — each row keeps its column-existence guard, which now fails loudly (not xfails) if migration 074 is ever rolled back."

patterns-established:
  - "IMMUTABLE-wrapper-for-a-non-immutable-parse: the canonical way to put a fallible jsonb→typed derivation into a Postgres GENERATED STORED column without breaking writes on bad data"
  - "Seed-ANALYZE-EXPLAIN-teardown with a data-preservation guard: the reusable shape for any 'prove the index is used at scale' test against the shared dev DB"

requirements-completed: [VIEW-03]

# Metrics
duration: 40min
completed: 2026-06-19
---

# Phase 114 Plan 03: Migration 074 Live Apply + Immutable Date Parser + SC#3 Index Proof Summary

**Crossed migration 074 into the live :54322 DB — adding `document_type_norm`/`date_typed` GENERATED STORED columns + btree indexes — but the authored `(text)::date` generation expression was rejected as non-immutable at apply time, so it was replaced with an IMMUTABLE, calendar-safe `view_iso_to_date` helper; auto-backfill, bad-date safety (R-114-B), and SC#3 index-use at a ~10k seed are all proven live, the 33-doc dataset preserved, and the 3 Plan-02 typed-leg xfails converted to GREEN.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-19T16:05:00Z (approx)
- **Completed:** 2026-06-19T16:45:00Z
- **Tasks:** 2 (Task 1 = the BLOCKING apply; the human-action authorization gate was pre-cleared by the operator, so it ran autonomously)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- **Migration 074 is LIVE on :54322** via `scripts/apply_migration_074.py` (psycopg2-direct, one transaction, NEVER `db push`/`db reset`): both columns read back `is_generated = ALWAYS`, both btree indexes present, **documents preserved 33 → 33** (no reset). Auto-backfill landed at ALTER time with no job: `document_type_norm` not-null on all 27 rows with a raw `document_type`, `date_typed` not-null on all 12 rows with a raw `date`, **0 `lower()` mismatches** across the full dataset.
- **Fixed the migration's immutability defect (the apply-time gate the research flagged as Assumption A1 / Open Q2):** PG15 rejects `(metadata->>'date')::date` (and `to_date()`) in a generation expression because both are STABLE. Replaced with `public.view_iso_to_date(text)` — an IMMUTABLE plpgsql helper that regex-guards the ISO shape, parses via the immutable `make_date(int,int,int)`, and traps the residual `DatetimeFieldOverflow` in an `EXCEPTION` block returning NULL. This is **strictly safer** than the original would have been — it also NULLs calendar-invalid shape-passing dates (`2026-13-99`, `2026-02-31`) the bare cast would have hard-errored on (the full R-114-B guarantee: a bad stored date breaks neither the ALTER backfill nor any future insert).
- **SC#3 EXPLAIN index-use proven at ~10k** (`test_114_explain_index.py`): seeded 10,000 throwaway docs (varied `document_type` + ISO dates spread ±365 days) + `ANALYZE`, asserted the `date_typed` range and `document_type_norm` eq queries use an **Index/Bitmap Index Scan, NOT a Seq Scan**, then fully deleted the seed with a real-document-count preservation guard (33 → 33, no leftover seed rows or users).
- **Regenerated `supabase/full-schema.sql`** via `bash scripts/regenerate-full-schema.sh` (no `--reset`) — it now carries both typed columns + both indexes + the `view_iso_to_date` helper (machine-dumped by pg_dump, never hand-edited).
- **Un-marked the 3 Plan-02 typed-leg xfail rows to GREEN** (2 in `test_114_resolve_range_date.py`, 1 in `test_114_count_only.py`). The Plan-02 suites went from 15 passed / 3 xfailed → **18 passed / 0 xfailed**. The full Task-2 command is **26/26 GREEN live** on :54322.

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply migration 074 to live :54322 + immutable date parser fix + regen full-schema** - `3448c2b3` (feat)
2. **Task 2: Live typed-column safety + 10k EXPLAIN index proof + un-mark Plan-02 xfails** - `0b2b21ab` (test)

**Plan metadata:** (final docs commit — this SUMMARY)

## Files Created/Modified
- `scripts/apply_migration_074.py` (new) — psycopg2-direct applier mirroring 073: one transaction, pre/post documents-count baseline (proves no reset), read-back asserting both columns (`is_generated=ALWAYS`) + both indexes + `lower()` correctness across the full dataset; idempotency guard skips the ALTER if columns already exist.
- `supabase/migrations/074_view_typed_columns.sql` (modified) — replaced the rejected `CASE ... (metadata->>'date')::date` with the IMMUTABLE `public.view_iso_to_date(text)` helper + `date_typed GENERATED ALWAYS AS (public.view_iso_to_date(metadata->>'date')) STORED`; updated the immutability-facts comment block to the verified-at-apply reality.
- `supabase/full-schema.sql` (modified) — regenerated from the live DB (no reset): `view_iso_to_date` fn at L227, `document_type_norm`/`date_typed` columns at L537-538, both indexes at L1488/L1495.
- `backend/tests/integration/test_114_typed_columns.py` (new) — full-dataset auto-backfill correctness (`document_type_norm == lower(raw)`, `date_typed == view_iso_to_date(raw)`), fresh-insert roundtrip, the R-114-B bad-date safety matrix (non-ISO + regex-passing-calendar-invalid → NULL, insert succeeds, never raises), and the helper-is-IMMUTABLE proof.
- `backend/tests/integration/test_114_explain_index.py` (new) — ~10k-seed SC#3 index-use proof with the seed/ANALYZE/EXPLAIN/teardown + real-doc preservation guard.
- `backend/tests/integration/test_114_resolve_range_date.py` (modified) — removed the 2 typed-leg `@pytest.mark.xfail` decorators; kept the column-existence guards (now fail-loud).
- `backend/tests/integration/test_114_count_only.py` (modified) — removed the 1 typed-leg `@pytest.mark.xfail` decorator; kept the column-existence guard.

## Decisions Made
- **IMMUTABLE plpgsql helper over the bare cast (the central decision):** the only way to put a fallible jsonb→date derivation into a GENERATED STORED column on PG15. A function *declared* IMMUTABLE is permitted in a generation expression; the EXCEPTION block makes it calendar-safe. Documented in-migration so future date-from-jsonb columns reuse it instead of re-discovering the rejection.
- **Applier idempotency guard:** skip the ALTER/CREATE if the typed columns already exist, so a re-run (or an early apply) is harmless; the read-back assertions still validate live state.
- **Un-mark by decorator-removal only:** kept each row's `_column_exists` guard so a future migration rollback produces a loud `pytest.fail`, not a silent xfail — the schema-drift early-warning the Plan-02 SUMMARY intended.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug + Blocking] The authored `(metadata->>'date')::date` generation expression is rejected as non-immutable**
- **Found during:** Task 1 (the migration apply — first `apply_migration_074.py` run)
- **Issue:** PG15 raised `InvalidObjectDefinition: generation expression is not immutable` on the `date_typed` column. Diagnosis confirmed the text→date I/O cast AND `to_date(text, fmt)` are both STABLE (DateStyle-sensitive) → illegal in a generation expression. `make_date(int,int,int)` is immutable but raises `DatetimeFieldOverflow` on a calendar-invalid value, so it cannot sit bare in the expression either (a bad stored row would error the backfill). This blocked the entire plan and is the exact failure mode RESEARCH flagged: Assumption A1 (`[ASSUMED — VERIFY at apply time]`), Open Q2, and Pitfall 2. The plan's Task-1 `resume-signal` explicitly anticipated "an ALTER error on a specific row → see Task 2's bad-date handling."
- **Fix:** Replaced the inline `CASE ... ::date` with an IMMUTABLE plpgsql helper `public.view_iso_to_date(text)` — regex-guards the ISO shape, parses via immutable `make_date`, and traps the residual overflow in an `EXCEPTION WHEN others THEN RETURN NULL` block. Verified each candidate expression empirically against :54322 before committing the fix (bare `::date` rejected, `to_date` rejected, `make_date` accepted-but-raises, IMMUTABLE-wrapper accepted-and-NULL-safe).
- **Files modified:** `supabase/migrations/074_view_typed_columns.sql` (+ `scripts/apply_migration_074.py` asserts the result, + `supabase/full-schema.sql` regenerated)
- **Verification:** Re-apply succeeded; read-back asserts both columns `is_generated=ALWAYS` + both indexes; auto-backfill landed across all 33 docs with 0 errors; `test_114_typed_columns.py` proves the bad-date matrix (`2026-13-99`/`2026-02-31` → NULL, insert succeeds) + the helper is IMMUTABLE.
- **Committed in:** `3448c2b3` (Task 1 commit)

**2. [Rule 1 - Bug] `provolatile` assertion compared bytes to str in the new test**
- **Found during:** Task 2 (first run of `test_114_typed_columns.py`)
- **Issue:** `pg_proc.provolatile` is the Postgres `"char"` type, which asyncpg decodes to `bytes` (`b'i'`), so `assert volatility == "i"` failed.
- **Fix:** Cast `provolatile::text` in the query so asyncpg returns a proper Python `str`.
- **Files modified:** `backend/tests/integration/test_114_typed_columns.py`
- **Verification:** Re-run → 26/26 GREEN.
- **Committed in:** `0b2b21ab` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking migration-immutability bug, 1 test-assertion bug)
**Impact on plan:** Deviation #1 was the central work of the plan — the migration could not be applied without it, and the fix realizes the R-114-B safety the plan demanded (and the threat register T-114-03-01 anticipated). It stayed inside the plan's own scope (the migration file + the bad-date gate); the plan explicitly authorized "tighten per Open Q2" if a regex-passing-invalid value errored the cast. No architectural change (no new table, no new RLS, no library swap — a helper function inside the same migration). #2 was a trivial test-correctness fix. No scope creep.

## Threat-Model Compliance

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-114-03-01 (malformed stored date breaks the generated column) | mitigate | DONE — proven LIVE against the full dataset AND the explicit edges. The IMMUTABLE `view_iso_to_date` regex-guard + `EXCEPTION→NULL` yields NULL on non-ISO, calendar-invalid (`2026-13-99`/`2026-02-31`), and absent dates; the insert always succeeds (`test_114_typed_columns.py`). The "static would false-green" lesson honored — the migration is proven applied + safe live, not assumed. **Stronger than planned:** the original `::date` would have hard-errored on calendar-invalid dates; the helper NULLs them. |
| T-114-03-02 (the apply step itself / dev-data loss) | mitigate | DONE — psycopg2-direct in ONE transaction (rolls back on partial failure; the first failed apply left the DB clean — 0 columns, 33 docs); NEVER `db push`/`db reset`; pre/post documents-count guard 33→33; read-back asserts columns + indexes before done. |
| T-114-03-03 (schema drift code vs live DB) | mitigate | DONE — `full-schema.sql` regenerated (no `--reset`) and committed with the migration + tests; the auto-backfill + EXPLAIN tests gate against a phantom apply (they `pytest.fail` if the columns are absent). |
| T-114-03-SC (npm/pip installs) | accept | N/A — zero packages installed. |

## Known Stubs

None. The 3 typed-leg rows that were `xfail` are now GREEN (the migration they waited on is live). Each retains a `_column_exists` guard that fails loudly on a future rollback — an intentional schema-drift early-warning, not a stub.

## Verification

- `scripts/apply_migration_074.py` → `OK migration 074 live` — columns `is_generated=ALWAYS`, both indexes present, auto-backfill 27/27 type + 12/12 date, `lower()` mismatches 0, documents 33→33 preserved.
- `bash scripts/regenerate-full-schema.sh` → 2980 lines; `grep` confirms `view_iso_to_date` (L227), `document_type_norm` (L537), `date_typed` (L538), `idx_documents_date_typed` (L1488), `idx_documents_document_type_norm` (L1495).
- `cd backend && venv/Scripts/python -m pytest tests/integration/test_114_typed_columns.py tests/integration/test_114_explain_index.py tests/integration/test_114_resolve_range_date.py tests/integration/test_114_count_only.py -q` → **26 passed, 0 failed, 0 xfailed**.
- Post-run data-preservation re-check: real documents 33, 0 leftover throwaway users, 0 leftover seed docs, typed columns + indexes + helper fn all live.
- Regression: `test_113_view_resolve.py` + `test_114/113_view_filter_compiler.py` → 30 passed, 1 xfailed (a pre-existing unrelated unit xfail) — no regressions from the un-marking or the migration.

## Issues Encountered
- The migration-immutability rejection (deviation #1) required empirical diagnosis against the live DB — the research correctly flagged `::date` immutability as VERIFY-at-apply (Assumption A1) rather than assuming it. Resolving it took the bulk of the time and produced a reusable IMMUTABLE-wrapper pattern.

## User Setup Required
None — the [BLOCKING] migration-apply human-action gate was pre-authorized by the operator (psycopg2-direct against :54322) and executed in this run. No further external configuration.

## Next Phase Readiness
- **Plans 05/06 (frontend):** the date-range and `document_type` filters now resolve through indexed typed columns; the live builder count + per-view sidebar badges have an indexed path at scale.
- **Phase 115 (agent-tool):** typed-column + relative-date queries hit the btree indexes.
- **General:** any future migration deriving a `date` from jsonb should reuse `public.view_iso_to_date` (or the same IMMUTABLE-wrapper pattern) — `(text)::date` and `to_date()` are NOT legal in a generation expression on this Postgres.
- No blockers. The phase is no longer in the build-passes-without-apply false-positive state.

## Self-Check: PASSED

- Created files exist: `scripts/apply_migration_074.py`, `backend/tests/integration/test_114_typed_columns.py`, `backend/tests/integration/test_114_explain_index.py`, `114-03-SUMMARY.md` — all FOUND.
- Commits exist: `3448c2b3` (Task 1), `0b2b21ab` (Task 2) — all FOUND.
- Verification green: migration applied live (33→33 docs preserved); full Task-2 command 26/26 GREEN on :54322; the 3 Plan-02 xfails converted to GREEN; full-schema.sql carries both columns + indexes + helper fn.

---
*Phase: 114-virtual-folders-range-date-filters-view-builder-sidebar*
*Completed: 2026-06-19*
