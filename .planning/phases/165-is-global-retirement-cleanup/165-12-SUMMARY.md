---
phase: 165-is-global-retirement-cleanup
plan: 12
subsystem: tests
tags: [multi-tenancy, org-isolation, test-maintenance, folder-utils, mock-sequencing, gap-closure, seed-124, cr-01]
gap_closure: true

# Dependency graph
requires:
  - phase: 165-is-global-retirement-cleanup
    provides: "Plan 165-02's org-scoped folder_utils helpers (the leading org_members query) + the CR-01 cross-org shared-folder closure that these test harnesses had not been updated for"
provides:
  - "The kb / folders / documents integration suites GREEN against the migrated live DB — their supabase mocks budget for the new leading org_members query (table-name-keyed dispatch)"
  - "The 116 / 117 / 119 leak suites GREEN with co-org fixtures (116/117) and a pre-existing-148-gate bypass (119) — every masking/owner-scoping assertion preserved, no cross-org visibility re-introduced"
  - "MIG-02 'tests' pillar closed: the 30 phase-165-flagged failures in 165-VERIFICATION.md all pass"
affects: [165-verification-reverify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Table-name-keyed supabase mock dispatch: an autouse fixture routes table('org_members') to a canned caller-org result so a leading service-role query never consumes an entry from an ordered execute.side_effect list (robust to future insertions)"
    - "Co-org leak fixtures: place the second caller into the folder-owner's auto-provisioned personal org via org_members, so an is_org_shared folder is visible WITHIN the org boundary (CR-01) while a private folder_id=NULL target stays masked"

key-files:
  created: []
  modified:
    - backend/tests/integration/test_kb.py
    - backend/tests/integration/test_folders.py
    - backend/tests/integration/test_documents.py
    - backend/tests/integration/test_116_tool_leak.py
    - backend/tests/integration/test_117_route_leak.py
    - backend/tests/integration/test_119_leak.py

key-decisions:
  - "Fixed root cause A with a table-name-keyed org_members routing fixture rather than editing every positional side_effect list — the existing folder/document sequences stay aligned by construction, and future leading-query insertions won't re-break them (the plan's preferred ROBUST option)"
  - "2 of the 5 test_documents failures had a root cause PREDATING Phase 165 (Phase-163 folder owner-check + Phase-111.1/112/118 metadata enrichment), not the org_members insertion the plan attributed them to; repaired as stale-mock maintenance in the plan-named file, no production change"
  - "test_119's 3 failures were NOT the cross-org precondition the plan diagnosed — they crash on a pre-existing Phase-148 feature-gate (is_operator on the app asyncpg pool) under a bare TestClient event loop; fixed test-only via an is_operator bypass. Co-org was NOT applied to test_119 (unnecessary + misleading: governance is owner-scoped and the signal fixtures have no shared folder)"
  - "Every masking/leak/owner-scoping assertion left intact and meaningful (non-vacuity guards still hold); no cross-org visibility re-introduced anywhere"

patterns-established:
  - "For a service-role query inserted at the FRONT of a helper, route it by table name in the mock rather than re-numbering positional side_effect lists"

requirements-completed: [MIG-02]

# Metrics
duration: ~55min
completed: 2026-07-21
---

# Phase 165 Plan 12: MIG-02 "tests" gap closure Summary

**Closed the 30 phase-165-flagged integration-test failures via test-harness-only fixes — a table-name-keyed org_members mock dispatch for the kb/folders/documents suites, and co-org fixtures (116/117) plus a pre-existing-148-gate bypass (119) for the leak suites — with every masking assertion preserved and zero production-code change.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-07-21
- **Tasks:** 2 (auto)
- **Files modified:** 6 (all test files; zero production source)

## Accomplishments

- **Task 1 (Root cause A — mock sequencing, 25 tests):** Added an autouse `_route_org_members` fixture to `test_kb.py` / `test_folders.py` / `test_documents.py` that dispatches `table("org_members")` (the leading `folder_utils._resolve_caller_org_ids` query added by Plan 165-02) to a canned caller-org result. Because that one query is routed away from the shared side_effect-driven builder, every existing ordered `execute.side_effect` list stays aligned — no positional re-numbering needed, and future leading-query insertions won't re-break them. `test_tree_not_found` additionally got the second folders fetch the WR-01 `get_globally_visible_folder_ids` call (now issued before path resolution in `tree_path`) requires.
- **Task 2 (Root cause B — leak fixtures, 5 tests):** `test_116` / `test_117` genuinely broke because a disjoint-org caller can no longer read another org's `is_org_shared` folder (CR-01). Added `_colocate_in_owner_org` — user B is added to user A's auto-provisioned personal org, so A's shared folder SUBJECT is visible to B within the org boundary while A's PRIVATE (`folder_id=NULL`) target stays masked. `test_119`'s 3 tests were unblocked by an `is_operator` bypass (see Deviations).
- **Whole set GREEN:** the 6 files run **96 passed / 2 xpassed / 0 failed** against the migrated live DB (mig 111 applied). The 2 xpassed are the harmless `xfail(strict=False)` shared-fn twins in `test_117`.
- **Zero production change:** `git diff --stat` for the plan shows ONLY the 6 test files (0 lines under `backend/app`).

## Task Commits

1. **Task 1: budget mocks for the leading org_members query** — `4485053f` (test)
2. **Task 2: co-org leak fixtures + bypass the pre-existing 148 gate** — `879b4a37` (test)

## Actual pytest output (recorded)

- Task 1 (`test_kb.py test_folders.py test_documents.py`): **86 passed** (was 25 failed / 61 passed).
- Task 2 (`test_116_tool_leak.py test_117_route_leak.py test_119_leak.py`): **10 passed, 2 xpassed** (was 5 failed / 5 passed / 1 xfailed / 1 xpassed).
- All 6 together: **96 passed, 2 xpassed, 0 failed**.

## Files Created/Modified

- `backend/tests/integration/test_kb.py` — `_route_org_members` autouse fixture (`CALLER_ORG_ID`, contains `org_members`); `test_tree_not_found` gets the WR-01 second folders fetch.
- `backend/tests/integration/test_folders.py` — `_route_org_members` autouse fixture.
- `backend/tests/integration/test_documents.py` — `_route_org_members` autouse fixture; `test_upload_with_valid_folder_id_returns_201` folder-validation mock carries `user_id`; `test_ingest_stores_full_markdown` legacy metadata mode + empty `return_value` for the ~10-write completion path.
- `backend/tests/integration/test_116_tool_leak.py` — `_colocate_in_owner_org` helper + call in `two_users_with_link`.
- `backend/tests/integration/test_117_route_leak.py` — `_colocate_in_owner_org` helper + call in `two_users_with_link`.
- `backend/tests/integration/test_119_leak.py` — `_bypass_operator_pool_check` autouse fixture (is_operator → True, gate no-op).

## Deviations from Plan

The plan's two root-cause classes were correct for the majority of the 30 failures, but three of them had a **root cause predating Phase 165** that the plan attributed to the org_members insertion / cross-org precondition. All three were repaired as legitimate stale-mock / harness maintenance in the plan-named files, with **zero production change** and no assertion weakened.

### Auto-fixed Issues

**1. [Rule 1 - Stale mock] `test_documents.py::test_upload_with_valid_folder_id_returns_201`**
- **Found during:** Task 1.
- **Issue:** `KeyError: 'user_id'` — the folder-validation mock returned `{"id": FOLDER_ID}`, but the upload endpoint's folder-ownership check (`.select("id, user_id")` → `folder_check.data["user_id"] != current_user["id"]`) was added in **Phase 163-07** (`a1c3acc6`, the user-JWT RLS-gate swap), NOT Phase 165. The mock predated that owner check.
- **Fix:** folder-validation mock carries `"user_id": USER_ID` (the folder is owned by the uploader in this happy path). Real assertion (201 + folder association) preserved.
- **Files modified:** `backend/tests/integration/test_documents.py`
- **Commit:** `4485053f`

**2. [Rule 1 - Stale mock] `test_documents.py::test_ingest_stores_full_markdown`**
- **Found during:** Task 1.
- **Issue:** `StopIteration` + `sample_for_extraction` TypeError — the test's 3-entry `execute.side_effect` and its patched-`extract_metadata` intent predate the enriched-metadata path (Phase 111.1), the `_classification` rule-eval (Phase 118), the ingestion_step badges (Phase 56), and the pdf_extraction_runs telemetry (Phase 71). `ingest_document` now issues ~10 sequential sync writes/reads before the `status='completed'` UPDATE.
- **Fix:** force `metadata_enrichment_mode='legacy'` (matches the patched `extract_metadata` intent, avoids the enriched `sample_for_extraction` branch) and return an empty result for EVERY execute (robust to completion-path drift); assert on the recorded UPDATE calls (unchanged). The real assertion (`full_markdown` + `status='completed'` in the completion UPDATE) is preserved.
- **Files modified:** `backend/tests/integration/test_documents.py`
- **Commit:** `4485053f`

**3. [Rule 1 - Pre-existing harness] `test_119_leak.py` (all 3 failing tests)**
- **Found during:** Task 2.
- **Issue:** The failures were NOT the cross-org precondition the plan diagnosed (root cause B). `two_users_with_signals` has no shared folder at all, and `masked_not_broken`'s assertions are existence-based, not subject-read-based. The actual crash: the whole `/document-governance` router is gated by `require_visible("governance_health")` (**Phase 148**, VIS-01), which calls `is_operator()` on the app's SINGLETON asyncpg pool. Under the bare `TestClient` these tests drive, that pool binds to a portal event loop that CLOSES across the sequential `client.get()` calls, raising `RuntimeError: Event loop is closed` / asyncpg `another operation is in progress` BEFORE the route body runs. This is a Phase-148 harness interaction, untouched by Phase 165.
- **Fix:** an autouse fixture patches `app.dependencies.is_operator` → `True` (governance_health is an Everyone-audience feature, so the gate is a production no-op) so the routes execute without touching the app pool. The routes' OWN owner-scoping (`.eq("user_id", caller)`) and the D-119-3 masking logic — the actual leak assertions, plus their non-vacuity guards — run entirely unchanged. Co-org was deliberately NOT applied to `test_119` (unnecessary + misleading: governance is owner-scoped, not org-scoped).
- **Files modified:** `backend/tests/integration/test_119_leak.py`
- **Commit:** `879b4a37`

---

**Total deviations:** 3 auto-fixed (all pre-existing-root-cause stale mocks / harness, all in plan-named files, all test-only). **Impact on plan:** none — the plan's success criterion (all 6 suites green, zero production change, no masking assertion weakened) is fully met; the deviations only refine WHY 3 of the 30 failures were red.

## Security note (Task 2 is leak-sensitive)

- No masking/leak/owner-scoping assertion was deleted or softened. The 116/117 masking twins (B sees the mask, A sees the real filename) and the 119 owner-scoping + D-119-3 masked-not-broken assertions (with their non-vacuity guards) all run unchanged and pass.
- No cross-org visibility was re-introduced. The co-org fix makes ONLY the `is_org_shared` SUBJECT visible within a shared org; the PRIVATE (`folder_id=NULL`) target remains unseeable to the second viewer, so CR-01's closure of cross-org shared-folder browsing stays proven.

## Issues Encountered

- The project `python` on PATH lacks backend deps; used the backend venv (`backend/venv/Scripts/python.exe`) per CLAUDE.md. No other issues.

## Threat Flags

None — test-only changes; no new network endpoint, auth path, or schema surface introduced.

## Known Stubs

None.

## Self-Check: PASSED

- All 6 modified files present on disk.
- Commits `4485053f` (Task 1) and `879b4a37` (Task 2) present in `git log`.
- `git diff 4485053f~1 HEAD -- backend/` = exactly the 6 test files, 0 files under `backend/app` (zero production change), 0 deletions.
- Live re-run: the 6 files = **96 passed / 2 xpassed / 0 failed**.

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-21*
