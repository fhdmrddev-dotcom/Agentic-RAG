---
phase: 164-secdef-audit-cross-org-isolation-test-suite
plan: 03
subsystem: database
tags: [postgres, rls, security-definer, pgvector, search_path, org-isolation, migration, supabase]

# Dependency graph
requires:
  - phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
    provides: "membership RLS (mig 108) + current_user_org_ids() resolver + user-JWT/asyncpg user-context + mig 109 FIX-A is_system-outside-gate precedent"
  - phase: 164-01
    provides: "test_v3_4_org_isolation.py exit-gate suite (the RED-anchor + DB-level legs this migration turns GREEN)"
provides:
  - "migration 110: 4 SECURITY DEFINER fns re-CREATEd with in-body org predicate (org_id = ANY(SELECT current_user_org_ids())) + pinned SET search_path = '' + OPERATOR(public.<=>)"
  - "match_skills keeps is_system OUTSIDE the org gate (mig 109 FIX-A shape) — built-in skill-creator stays universal"
  - "document_chunks SELECT RLS widened additively (PRAG-01) to mirror the documents folder-visibility EXISTS branch"
  - "full-schema.sql regenerated no-reset reflecting the applied 110"
affects: [164-04, 165, 166, 167, 171]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-body org predicate in a SECURITY DEFINER body derived server-side from current_user_org_ids()/auth.uid() — org is NEVER a caller-supplied arg (D-164-01)"
    - "SET search_path = '' + fully schema-qualified refs + OPERATOR(public.<=>) closes the DEFINER search-path-hijack class (CVE-2018-1058) while still matching the HNSW vector_cosine_ops index"
    - "Platform is_system escape hoisted OUTSIDE the org gate (mig 109 FIX-A) so seeded platform content stays universal"
    - "Additive RLS widening (DROP+re-CREATE the single SELECT policy) mirroring the documents folder-visibility predicate for direct reads only"

key-files:
  created:
    - "supabase/migrations/110_secdef_org_scope_audit.sql"
  modified:
    - "supabase/full-schema.sql"
    - "backend/tests/integration/test_v3_4_org_isolation.py"

key-decisions:
  - "TEN-03/PRAG-01 NOT marked complete in this plan — 164-03 lands only the SQL half (inert on the service-role producer until 164-04 routes retrieval onto the asyncpg user-context). Both requirements complete at 164-04 (per STATE 'mark complete then')."
  - "search_path pin form = '' (Supabase advisor-clean) with OPERATOR(public.<=>) qualification, not 'pg_catalog, public' — the stricter, lint-0011-clean form."
  - "Rule 1 fix: three red-anchor/zero-cross-org assertions changed from len(rows)==0 to A-chunk-absence (matching the fixture's own positive-control design)."

patterns-established:
  - "Two-halves security phase: the DEFINER-body org predicate is INERT until the invoking connection carries the caller's identity — apply the SQL half FIRST so the app-code half (164-04) is testable against org-scoped bodies."
  - "Byte-identical-signature CREATE OR REPLACE (no DROP) when only the body + SET clause change — avoids dependent-policy cascade."

requirements-completed: []  # TEN-03 + PRAG-01 are SQL-half-only here; they complete at 164-04. See key-decisions.

# Metrics
duration: 42min
completed: 2026-07-20
---

# Phase 164 Plan 03: SECDEF Org-Scope Audit (migration 110) Summary

**Migration 110 org-scopes the four SECURITY DEFINER retrieval/sharing functions in-body (server-derived `current_user_org_ids()`/`auth.uid()`, never the spoofable `match_user_id`) + pins all four `search_path`s to `''` with `OPERATOR(public.<=>)`, keeps `is_system` universal (mig 109 FIX-A), and widens `document_chunks` SELECT RLS for PRAG-01 — applied live to :54322, all 18 exit-gate legs GREEN, CONCUR-01 15.0ms.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-07-20T15:36:00Z (approx)
- **Completed:** 2026-07-20T16:18:27Z
- **Tasks:** 2 (author + [BLOCKING] apply/regen/gate)
- **Files modified:** 3 (1 created migration, 1 regenerated artifact, 1 test fix)

## Accomplishments
- Authored `110_secdef_org_scope_audit.sql` — 4× `CREATE OR REPLACE` DEFINER (byte-identical signatures, no DROP) with the in-body org predicate + pinned `search_path = ''` + `OPERATOR(public.<=>)`, `match_skills` is_system-outside-gate, and the `document_chunks` PRAG-01 SELECT-RLS widening.
- Applied migration 110 DIRECTLY to the live local DB (:54322) via psycopg2 (operator-authorized this session) — **NEVER** `db push`/`db reset`. Verified live: all four fns `prosecdef=true` + `proconfig` contains `search_path=""` (pg_proc probe).
- Regenerated `supabase/full-schema.sql` no-reset (docker `pg_dump`) — reflects 110 (4× `OPERATOR(public.<=>)` present); committed SAME-COMMIT with the migration.
- All 18 `test_v3_4_org_isolation.py` legs GREEN (red-anchor `test_definer_ignores_spoofed_match_user_id` PASSES; the two chunk-fn distance operators + org gate resolve with no "operator does not exist" error).
- CONCUR-01 perf gate re-benchmarked: `test_058_concurrency.py` PASS at **15.0ms** (threshold < 1000ms).

## Task Commits

1. **Task 1 + Task 2 (SQL half — same-commit per D-164-08):** migration 110 + regenerated full-schema — `e14c146b` (feat)
2. **Rule 1 fix (test assertions):** red-anchor + zero-cross-org assertions check A-chunk-absence — `c8a67e86` (fix)

**Plan metadata:** (final docs commit — SUMMARY + STATE + ROADMAP)

_Note: Task 1 (authoring) and Task 2 (apply + regen) share ONE commit because the CLAUDE.md/D-164-08 same-commit rule binds the migration and its regenerated `full-schema.sql` together._

## Files Created/Modified
- `supabase/migrations/110_secdef_org_scope_audit.sql` — the SECDEF org-scope audit migration (4 DEFINER re-CREATE + document_chunks PRAG-01 widening).
- `supabase/full-schema.sql` — regenerated no-reset deploy artifact reflecting 110.
- `backend/tests/integration/test_v3_4_org_isolation.py` — Rule 1 assertion fix (3 assertions).

## Decisions Made
- **search_path pin = `''` + `OPERATOR(public.<=>)`** (not `pg_catalog, public`): the Supabase advisor-clean / lint-0011 form. Live-verified pgvector 0.8.0 is `WITH SCHEMA public`, so bare `<=>` won't resolve under `''` — `OPERATOR(public.<=>)` qualifies it and still matches the HNSW `vector_cosine_ops` index (smoke: `match_document_chunks` executes with no operator error).
- **`= ANY (SELECT public.current_user_org_ids())`** in the DEFINER bodies (the RESEARCH Pattern-1 / must_haves.key_links form) vs the base-policy `IN (SELECT …)` — equivalent; the policy widening keeps `IN (…)` to mirror mig 108.
- **TEN-03 / PRAG-01 not marked complete here** — this plan lands the SQL half only, which is INERT on the service-role producer connection until Plan 164-04 routes retrieval onto the asyncpg user-context. Marking them now would be dishonest (the app still runs retrieval on service-role → 0 rows). They complete at 164-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Red-anchor + zero-cross-org assertions used `len(rows) == 0` instead of A-chunk-absence**
- **Found during:** Task 2 (running the DB-level exit-gate legs after applying migration 110)
- **Issue:** Three assertions in `test_v3_4_org_isolation.py` (authored in Plan 164-01) asserted `len(rows) == 0` for the spoofed-`match_user_id` legs: `test_definer_ignores_spoofed_match_user_id` and `test_definer_zero_cross_org[match_document_chunks]` + `[keyword_search_chunks]`. Post-164 the org-scoped bodies correctly key on `auth.uid() = B`, so user B legitimately retrieves its OWN matching chunk (the fixture seeds B a chunk with the same unit embedding / "secret" content). The assertions conflated "zero of A's cross-org chunks" (the real property + their own docstrings) with "zero rows total", so they false-FAILED the GREEN state (returned 1 = B's own chunk). Verified via a live asyncpg reproduction: under B's context, `match_document_chunks(spoofed A_uid)` returned **B's own** chunk id — NOT A's — proving the migration correctly isolates.
- **Fix:** Intersect the returned ids with `{a["private_chunk_id"], a["shared_chunk_id"]}` and assert the intersection is empty — the exact style already used (and passing) in the sibling `test_prag01_retrieval_isolation` (with its positive-control `b["private_chunk_id"] in own_ids`) and the `match_skills` leg. Preserves RED-pre-164 (A's chunks present) and GREEN-post-110 (A's chunks absent; B's own allowed).
- **Files modified:** `backend/tests/integration/test_v3_4_org_isolation.py`
- **Verification:** `pytest -k "definer or search_path or table_matrix or prag01_retrieval"` → 12/12 pass; full suite 18/18 pass; red-anchor PASSES.
- **Committed in:** `c8a67e86`

---

**Total deviations:** 1 auto-fixed (1 bug — a test-assertion logic error surfaced by the correct GREEN state).
**Impact on plan:** The migration itself matched the plan exactly (no SQL deviation). The one fix corrects a latent 164-01 assertion bug that could only manifest once a correct migration made the legs GREEN. No scope creep — the fix narrows a raw-count check to the documented cross-org property.

## Issues Encountered
- **Red-anchor initially RED** after apply — root-caused via a live asyncpg reproduction to the `len(rows) == 0` assertion bug above (not a migration defect: B's own matching chunk was being counted). Fixed under Rule 1.
- **2 pre-existing 163 RLS failures** (`test_163_rls_dm::test_global_rule_renders_for_comember_not_cross_org`, `test_163_rls_workflow_eval::test_global_workflow_def_renders_for_comember_not_cross_org`) — documented out-of-scope in `164/deferred-items.md` (D-164-02-A), untouched by migration 110 (they concern `classification_rules`/`workflow_definitions`, not `document_chunks` or the 4 fns). 101/103 `-k 163` legs pass; the 2 failures reproduce independent of this plan.

## Expected Transient State (NOT a bug)
Retrieval RPCs invoked on the SERVICE-ROLE producer connection now return 0 rows (`auth.uid()` is NULL there → `current_user_org_ids()` empty → org gate excludes all). This is the DESIGNED two-halves window: Plan 164-04 routes those calls onto the asyncpg user-context to resolve `auth.uid()`. Do NOT "fix" retrieval here or revert the migration on a service-role smoke returning empty. (Smoke confirmed: `match_document_chunks`/`keyword_search_chunks` → 0 rows on service-role; `match_skills` → 1 row because the is_system universal escape sits OUTSIDE the org gate.)

## User Setup Required
None — no external service configuration. **Cloud parity owed** (operator-gated, do NOT apply now): migrations 099→110 + `SECRETS_ENCRYPTION_KEY`, in order, at the next production push.

## Next Phase Readiness
- **164-04 UNBLOCKED:** the four DEFINER bodies are org-scoped and the `document_chunks` RLS is widened; Plan 164-04 can now swap the producer's retrieval + text-to-SQL DB calls onto the asyncpg user-context and delete `_inject_user_id`/`_inject_user_id_for_grep`, testable against the org-scoped bodies. The full 18-leg suite already GREEN at the DB level; 164-04 closes the app-code half so live retrieval returns the caller's rows.
- TEN-03 / PRAG-01 complete at 164-04 (SQL half landed here).

## Self-Check: PASSED

- Files verified present: `110_secdef_org_scope_audit.sql`, `full-schema.sql`, `164-03-SUMMARY.md`, `test_v3_4_org_isolation.py`.
- Commits verified in git log: `e14c146b` (migration + full-schema), `c8a67e86` (test fix).
- No unexpected file deletions in either commit.

---
*Phase: 164-secdef-audit-cross-org-isolation-test-suite*
*Completed: 2026-07-20*
