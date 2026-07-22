---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 02
subsystem: database
tags: [postgres, pgvector, rls, org_id, multi-tenancy, migration, backfill, hnsw, asyncpg, pytest]

# Dependency graph
requires:
  - phase: 161-org-dept-role-schema
    provides: "documents.org_id / skills.org_id (NOT NULL) — the parent-FK backfill source"
  - phase: 162-personal-org-backfill
    provides: "mig 105 batched-backfill + self-guarded-flip idiom; mig 106 autofill_org_id_from_parent()"
  - phase: 163-01-front-b-db-context-factories
    provides: "_rls_harness (PG skip-guard) + conftest pg_pool / two_orgs_two_users fixtures"
provides:
  - "Migration 107 (authored, NOT applied): org_id denormalized onto document_chunks + skill_embeddings, parent-FK backfilled, self-guarded NOT-NULL flip, btree(org_id) per table, mig-106 autofill trigger attached — HNSW + GIN vector indexes untouched"
  - "test_163_ten04_backfill.py: the applied-state contract (column NOT NULL / zero-NULL / btree present / HNSW+GIN untouched / autofill trigger attached) — RED until plan 05 applies 107"
affects: [163-03-rls-rewrite (mig 108 references this org_id), 163-05-blocking-apply (applies 107 then 108), 163-09-concur01-benchmark, 164-secdef-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalize-for-RLS: parent org_id copied onto a hot child table so RLS filters the column directly, never a per-row join over a pgvector scan (CONCUR-01 join-killer, D-07)"
    - "Non-`id`-PK batch paging: skill_embeddings pages on skill_id (its PK) — the mig-105 apply-time bug applied correctly from authoring"

key-files:
  created:
    - "supabase/migrations/107_ten04_chunk_embedding_org_id.sql"
    - "backend/tests/integration/test_163_ten04_backfill.py"
  modified: []

key-decisions:
  - "Honored the plan-time slot inversion 107=TEN-04 / 108=RLS (forced data-dependency: 108's chunk/embedding predicates reference the org_id column 107 adds; Postgres applies in integer order)"
  - "skill_embeddings backfill pages on skill_id (its PK — it has NO `id` column); document_chunks pages on its uuid `id` PK"
  - "Plain btree(org_id) is the authored default; the composite (org_id, user_id) is left as the plan-09 CONCUR-01-benchmark-decided alternative"
  - "TEN-04 kept Pending — this plan AUTHORS the substrate only; it is applied (plan 05) + benchmarked (plan 09/10) before the requirement is honestly complete"

patterns-established:
  - "Self-guarded NOT-NULL flip on a denormalized column: RAISE-EXCEPTION zero-NULL guard before every SET NOT NULL (the DB, not a human, enforces backfill completeness — T-163-BF)"
  - "Applied-state contract test authored RED-first: the same file encodes the additive contract (RED now) AND regression-guards pre-existing invariants (HNSW/GIN GREEN now, must stay GREEN)"

requirements-completed: []  # TEN-04 is NOT completed here — authored-only substrate; completes at plan-05 apply + plan-09/10 benchmark. Kept Pending (honest bookkeeping).

# Metrics
duration: 8min
completed: 2026-07-19
---

# Phase 163 Plan 02: TEN-04 org_id Denormalize Substrate Summary

**Migration 107 lays a NOT-NULL, parent-FK-backfilled, btree-indexed `org_id` on the two pgvector hot tables (`document_chunks` + `skill_embeddings`) with the HNSW/GIN vector indexes untouched and the mig-106 autofill trigger wired — plus the RED-until-applied test that encodes the applied-state contract.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-19T12:10:13Z
- **Completed:** 2026-07-19T12:16:53Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- Authored `107_ten04_chunk_embedding_org_id.sql` — the CONCUR-01 join-killer substrate: denormalized `org_id` on both pgvector tables so 163's RLS (mig 108) and Phase 164's SECDEF filter the column directly, never a per-row join to `documents` over the pgvector seq-scan (D-07).
- Backfill resolves strictly from the parent FK (`document_chunks.org_id ← documents.org_id` via `document_id`; `skill_embeddings.org_id ← skills.org_id` via `skill_id`) — same owner ⇒ same org (T-163-BF), with a self-guarded NOT-NULL flip that RAISEs on any residual NULL.
- Vector indexes explicitly untouched (no `DROP INDEX`, no `hnsw`/`gin` DDL) — no per-tenant partial vector index (unbounded org count); only a plain btree(org_id) added per table.
- Both tables attached to the mig-106 `autofill_org_id_from_parent` BEFORE-INSERT net so future chunk/embedding INSERTs auto-fill `org_id` and pass RLS `WITH CHECK` without the app threading it (T-163-05).
- `test_163_ten04_backfill.py` encodes the full applied-state contract (column NOT NULL, zero-NULL, btree present, HNSW+GIN untouched, autofill trigger attached) — verified RED now (8 additive asserts fail, migration not applied) with the 2 HNSW/GIN regression guards already GREEN, proving the test is meaningful, not a false-green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author migration 107 (org_id denormalize + backfill + NOT-NULL + btree + autofill trigger)** - `5eb13afb` (feat)
2. **Task 2: Author test_163_ten04_backfill.py (applied-state contract, RED until plan 05)** - `ad10950a` (test)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/107_ten04_chunk_embedding_org_id.sql` — TEN-04 substrate: `ADD COLUMN org_id` + `_mig163_backfill` batched parent-FK backfill + pre-flip census + self-guarded NOT-NULL flip + `idx_{document_chunks,skill_embeddings}_org_id` btree + mig-106 autofill trigger attach; HNSW/GIN untouched; SECDEF retrieval fns untouched (Phase 164). Re-paste-safe. **Authored only — applied in plan 05.**
- `backend/tests/integration/test_163_ten04_backfill.py` — 10 collected tests (2 tables × columns/null/btree/trigger + 2 vector-index regression guards). Reuses the plan-01 `_rls_harness` skip-guard + conftest `pg_pool` fixture. RED until apply.

## Decisions Made
- **Slot inversion honored (107=TEN-04, 108=RLS):** the plan corrected the pre-allocated "107=RLS/108=TEN-04" intent because migration 108's `document_chunks`/`skill_embeddings` membership predicates reference the `org_id` column 107 adds, and Postgres applies migrations in integer filename order. The column must land first. Executed as planned.
- **`skill_embeddings` paged on `skill_id`:** its PK is `skill_id` (no `id` column, full-schema.sql:1458-1466). The mig-105 batch-paging idiom pages on `id`; the skill_embeddings backfill was written to page on `skill_id` from the start — the exact non-`id`-PK paging bug that bit the mig-105 *apply*, avoided at authoring.
- **btree(org_id) default, composite deferred to the benchmark:** a plain btree is authored; whether the composite `(org_id, user_id)` is needed is left for the plan-09 CONCUR-01 benchmark (`test_058_concurrency.py:270` `assert elapsed < 1.0`) to decide before merge (D-07).
- **TEN-04 kept `Pending` (honest bookkeeping):** this plan authors the migration + test but does NOT apply the migration (project rule: SQL-editor apply only, operator-gated, plan 05). The DB column does not exist yet and the test is RED, so `requirements-completed` is empty and REQUIREMENTS.md `TEN-04 | 163 | Pending` is left unchanged. TEN-04 completes at the plan-05 apply + plan-09/10 benchmark (both other plans also claim TEN-04). Marking it complete now would be false traceability.

## Deviations from Plan

None - plan executed exactly as written. Both tasks produced their deliverables per the plan's `<action>` steps; no Rule 1-4 deviations were needed.

## Issues Encountered
- **Minor authoring hygiene (Task 2, within-scope):** the test's failure-assertion messages initially used non-ASCII glyphs (em-dash, `§`), which the Windows console renders as `�` on a failing run (cosmetic — pytest did not crash). Since assertion messages are exactly what prints to a possibly-cp1252 terminal, they were switched to ASCII (`-`, `sec.`) before the Task-2 commit. Docstrings/comments keep the codebase's em-dash style. Not a plan deviation — authoring polish on my own just-written file.

## User Setup Required
None for THIS plan (authoring only). **Downstream operator action (plan 05, [BLOCKING]):** paste migration 107 THEN 108 into the LOCAL Supabase SQL editor (order load-bearing; never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit both migrations + the regenerated `full-schema.sql` together. At the next production push, 107 joins the pending 099–106 set in order.

## Next Phase Readiness
- **Ready for plan 163-03 (RLS rewrite / migration 108):** the `org_id` column that 108's `document_chunks`/`skill_embeddings` membership predicates reference is now authored and slot-ordered before 108.
- **Ready for plan 163-05 (the [BLOCKING] apply):** 107 is re-paste-safe and idempotent; `test_163_ten04_backfill.py` is the GREEN gate the apply must satisfy.
- **Perf gate stands for plan 163-09:** btree(org_id) authored; the CONCUR-01 <1s benchmark decides plain-vs-composite before merge.
- **No blockers.** SECDEF retrieval functions (`match_document_chunks`/`keyword_search_chunks`) deliberately untouched — Phase 164 boundary held.

## Self-Check: PASSED
- FOUND: `supabase/migrations/107_ten04_chunk_embedding_org_id.sql`
- FOUND: `backend/tests/integration/test_163_ten04_backfill.py`
- FOUND commit: `5eb13afb` (Task 1 — migration 107)
- FOUND commit: `ad10950a` (Task 2 — TEN-04 backfill test)
- `pytest test_163_ten04_backfill.py --collect-only` → 10 tests collected cleanly (imports resolve)
- Live-run state (read-only) → 8 additive asserts RED (expected — not applied) + 2 HNSW/GIN regression guards GREEN (expected — vector indexes present)

---
*Phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux*
*Completed: 2026-07-19*
