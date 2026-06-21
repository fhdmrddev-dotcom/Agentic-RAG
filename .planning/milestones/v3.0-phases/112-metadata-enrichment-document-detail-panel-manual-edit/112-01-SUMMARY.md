---
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
plan: 01
subsystem: api
tags: [fastapi, supabase, audit-log, rls, jsonb, metadata, pytest, asyncpg]

# Dependency graph
requires:
  - phase: 111-metadata-enrichment-extraction-backend
    provides: "read_enabled_field_defs, _confidence nested-key shape (attach_confidence), _BUILTINS, metadata.update in VALID_ACTION_TYPES"
  - phase: 110-dm-foundations
    provides: "metadata_field_definitions table + audit_log metadata.update CHECK enum (migration 071, live :54322)"
provides:
  - "PATCH /documents/{id}/metadata — audited single-field metadata write (META-05 persistence + audit half)"
  - "MetadataUpdateRequest body model (field + polymorphic value, no client source field)"
  - "Server-stamped metadata._source[field]='user' provenance (clone of the _confidence nested-key shape)"
  - "6 backend Wave-0 test files (1 unit + 5 live-:54322 integration) — the phase's primary false-green guard"
affects: [112-02-reextract-merge-guard, 112-03-frontend-foundation, 112-04-document-detail-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audited owner-scoped single-field JSONB write: owner SELECT + UPDATE both .eq(user_id) -> 404 never 403; run_in_threadpool on every .execute() (D-v2.5-01); await write_audit_entry inline"
    - "Server-hard-stamped provenance: client may never assert _source; route stamps _source[field]='user' and drops stale _confidence[field]"
    - "Leading-underscore + allow-list field gate: reject any field starting with '_', then require field in (7 builtins union enabled custom field_keys)"

key-files:
  created:
    - "backend/tests/unit/test_112_patch_metadata.py"
    - "backend/tests/integration/test_112_patch_audit.py"
    - "backend/tests/integration/test_112_patch_rls.py"
    - "backend/tests/integration/test_112_reextract_merge.py"
    - "backend/tests/integration/test_112_flat_filter_with_source.py"
    - "backend/tests/integration/test_112_custom_field_patch.py"
  modified:
    - "backend/app/api/documents.py"

key-decisions:
  - "value: object | None polymorphic body field (RESEARCH Open Q1) — route trusts the validated field to constrain shape"
  - "Route placed adjacent to move_document but uses the reextract_document threadpool template, NOT move's raw .execute()"
  - "None-guard on the owner SELECT: supabase-py .maybe_single().execute() returns None (not .data=None) on a non-owner miss"

patterns-established:
  - "Pattern: audited owner-scoped metadata PATCH (the shape Plans 03/04 call from the UI)"
  - "Pattern: live-:54322 route test driving the real route function directly with a service-role client + asyncpg assertions (mirrors test_111_metadata_fields_crud.py)"

requirements-completed: [META-05]

# Metrics
duration: ~35min
completed: 2026-06-18
---

# Phase 112 Plan 01: Backend PATCH Metadata Endpoint + Wave-0 Test Scaffolds Summary

**Audited owner-scoped `PATCH /documents/{id}/metadata` that persists one validated metadata field, server-stamps `_source[field]='user'`, drops the stale `_confidence`, and writes a live `metadata.update` audit row — plus the 6 backend Wave-0 test files that are the phase's primary false-green guard.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-18 (Task 1)
- **Completed:** 2026-06-18
- **Tasks:** 2
- **Files modified:** 7 (6 created tests + 1 modified `documents.py`)

## Accomplishments
- The net-new audited metadata-write endpoint (META-05 persistence + audit half) — the dependency the UI plans (03/04) and the merge-guard plan (02) build on.
- Server-stamped `_source` provenance (mirrors the `_confidence` nested-key shape from Phase 111) — a client can never assert source; the route hard-stamps `'user'`.
- 6 backend Wave-0 test files: 1 unit (route validation) + 5 live-`:54322` integration (audit row, RLS-404, re-extract merge xfail-for-Plan-02, flat-`@>`-with-`_source`, custom-field round-trip).
- **13 route tests pass live against :54322** (AC5 audit row, AC6 RLS-404, owner success, custom-field round-trip + audit). The 4 live `@>` containment + flat-filter proofs (AC8) are GREEN. The 2 merge tests are xfail (Plan 02). Net-new suite failures = 0 (SEED-056 stash-proven).

## Task Commits

1. **Task 1: Author the 6 backend Wave-0 test scaffolds** - `21d96953` (test)
2. **Task 2: Implement PATCH /documents/{id}/metadata route + body model** - `ac9209a9` (feat)

_Note: this plan's Task 2 was a `tdd="true"` task; Task 1 committed the RED/scaffold tests, Task 2 committed the GREEN implementation. The xfail merge tests intentionally stay RED for Plan 02._

## Files Created/Modified
- `backend/tests/unit/test_112_patch_metadata.py` - Route validation (field allow-list, `_`-prefix reject, document_type/language lowercasing, `_source` hard-stamp, dict-shaped field-def access); mocked supabase + monkeypatched `read_enabled_field_defs`/`write_audit_entry`.
- `backend/tests/integration/test_112_patch_audit.py` - Live `:54322`: PATCH writes exactly one `metadata.update` audit row keyed to the doc id; persisted row reflects the edit + `_source` (AC5).
- `backend/tests/integration/test_112_patch_rls.py` - Live: non-owner PATCH -> 404 (never 403), no mutation, no audit row; owner PATCH succeeds (AC6).
- `backend/tests/integration/test_112_reextract_merge.py` - Live, **xfail (Plan 02)**: `_source='user'` preserved across re-extract + un-edited field refreshed + degrade-doesn't-wipe (AC7).
- `backend/tests/integration/test_112_flat_filter_with_source.py` - Live, **GREEN**: `@>` containment still matches with BOTH `_confidence` AND `_source` present (document_type + title), with a non-matching negative control (AC8, D-111-9).
- `backend/tests/integration/test_112_custom_field_patch.py` - Live: an enabled custom `field_key` PATCH round-trips on reload + writes an audit row (AC9).
- `backend/app/api/documents.py` - Added `MetadataUpdateRequest` body model, `_METADATA_BUILTINS`, the `update_document_metadata` PATCH route, and a module-level import of `read_enabled_field_defs`.

## Decisions Made
- **Polymorphic `value: object | None`** body field (RESEARCH Open Q1) — the route trusts the validated `field` (allow-list-checked) to constrain shape rather than typing `value` per field.
- **Route placed adjacent to `move_document`** for locality (same PATCH router, same RLS posture) but it uses the `reextract_document` `run_in_threadpool` template — `move_document`'s raw `.execute()` predates the D-v2.5-01 sweep and is deliberately NOT copied for threadpool shape.
- **Route-driving integration tests skip via `importorskip` + `hasattr`** until the route lands, so creating the test files (Task 1) keeps the suite exit code 0 (the Wave-0 RED/scaffold convention).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] None-guard on the owner SELECT (live-:54322-discovered)**
- **Found during:** Task 2 (route implementation, first live run of `test_112_patch_rls.py`)
- **Issue:** The plan's route shape used `if not doc.data:` after the threadpool SELECT. Against the REAL supabase-py client, `.maybe_single().execute()` on a non-owner/no-row miss returns the whole response object as `None` (not an object with `.data=None`), so `doc.data` raised `AttributeError` -> a 500, leaking that the path differs for non-existent vs not-yours (and breaking the AC6 404 contract). The `try/except` only wrapped the `run_in_threadpool` call, not the `.data` access.
- **Fix:** Changed the guard to `if not doc or not getattr(doc, "data", None):` so a non-owner gets a clean 404 (no existence leak, no AttributeError 500).
- **Files modified:** `backend/app/api/documents.py`
- **Verification:** `test_112_patch_rls.py::test_non_owner_patch_returns_404_not_403` now passes live (asserts 404, not 403, no mutation, no audit row).
- **Committed in:** `ac9209a9` (Task 2 commit)

**2. [Rule 1 - Test scaffold hardening] Guard route-driving integration imports with importorskip**
- **Found during:** Task 1 verification (first run of the 6-file suite)
- **Issue:** The three route-driving integration tests hard-imported `MetadataUpdateRequest`/`update_document_metadata` at function entry, which raised `ImportError` (4 hard failures) before Task 2 landed the route — violating Task 1's acceptance criterion "suite exits 0; no hard failures from un-built code."
- **Fix:** Added a `_require_route()` helper (`pytest.importorskip` + `hasattr` skip) to `test_112_patch_audit.py`, `test_112_patch_rls.py`, `test_112_custom_field_patch.py` so they skip cleanly until the route exists, then run live once it does.
- **Files modified:** the three integration test files
- **Verification:** 6-file suite exits 0 (3 passed / 13 skipped / 2 xfailed) before Task 2; 16 passed / 2 xfailed after.
- **Committed in:** `21d96953` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — 1 real route bug found live, 1 test-scaffold convention fix)
**Impact on plan:** Both necessary for correctness/contract compliance. No scope creep — the route delta is exactly the plan's spec plus the live-discovered None-guard; the test guard is the Wave-0 RED convention.

## Test Results — honest green/unrun ledger

**All test runs below were executed against a LIVE local Supabase Postgres on :54322 (reachable, confirmed at execution start) and the live REST gate.** No false greens.

| File | Result | Notes |
|------|--------|-------|
| `test_112_patch_metadata.py` (unit) | **GREEN** (mocked) | 6 behaviors: allow-list accept, `_`-prefix reject (x3), unknown-field reject, document_type/language lowercase (x2), enabled-custom accept, dict-shaped field_key access. No DB. |
| `test_112_patch_audit.py` (live) | **GREEN** | AC5 — metadata.update audit count 0 -> 1; persisted row has edit + `_source`. |
| `test_112_patch_rls.py` (live) | **GREEN** | AC6 — non-owner 404 (not 403, no mutation, no audit); owner success. |
| `test_112_flat_filter_with_source.py` (live) | **GREEN** | AC8 — `@>` matches with `_confidence`+`_source` present (document_type + title) + negative control. |
| `test_112_custom_field_patch.py` (live) | **GREEN** | AC9 — enabled custom field_key round-trips + audits. |
| `test_112_reextract_merge.py` (live) | **XFAIL (intentional)** | AC7 — merge guard lands in **Plan 02**; 2 tests xfail(strict=False), Plan 02 removes the xfail and flips to a live merge proof. |

**Combined 6-file run:** 16 passed, 2 xfailed, 0 failures.
**Net-new full-suite failures:** **0** — SEED-056 stash-proven: with `documents.py` stashed back to the Task-1 base, the document-selection regression set is 28 failed / 74 passed; with the route added it is identical (28 failed / 74 passed). The 28 failures are pre-existing `test_sql_service.py` rot (text-to-SQL `query_documents`), unrelated to this plan — NOT fixed (out of scope per the scope boundary), logged here.

## Issues Encountered
- The live discovery that supabase-py returns `None` (not `.data=None`) on a non-owner `.maybe_single()` miss — resolved via the None-guard (Rule 1 above). This is the exact false-green class the plan called out: a static/mock-only test would have passed the original shape; the live RLS test caught it.

## User Setup Required
None - no external service configuration required. (Live tests require local Supabase :54322 + service-role creds in `backend/.env`, both already present on this dev tree.)

## Next Phase Readiness
- **Plan 02 (re-extract merge guard):** `test_112_reextract_merge.py` is in place with the falsifiable contract (xfail). Plan 02 adds the merge guard in `ingest_document` (the single metadata-write site), reads the prior `_source` map off the doc row, restores user fields before the UPDATE, and removes the xfail.
- **Plans 03/04 (frontend):** the `PATCH /documents/{id}/metadata` endpoint + `_source='user'` stamp + `_confidence`-drop are live; the panel/inline-edit can call it and reconcile via `loadDocuments()`. The frontend Wave-0 stubs (`ConfidenceChip.test.tsx` / `InlineEdit.test.tsx` / `*.a11y.test.tsx`) are co-located in Plans 03/04 (not this plan).
- No blockers.

## Self-Check: PASSED

- All 6 created test files present on disk (verified `[ -f ]`).
- `112-01-SUMMARY.md` present.
- `update_document_metadata` route present in `backend/app/api/documents.py`.
- Both task commits present in git history: `21d96953` (test), `ac9209a9` (feat).

---
*Phase: 112-metadata-enrichment-document-detail-panel-manual-edit*
*Completed: 2026-06-18*
