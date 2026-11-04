---
phase: 298-lists-follow-the-active-org
plan: 01
subsystem: org-scope / lists
tags: [backend, org-scope, lists, rls, security, frontend]
requires: []
provides:
  - backend/app/services/org_lists.py (active_org, active_org_uuid, folder_kw, by_org, root_upload_org)
  - backend/app/api/org_items.py (GET /org-items/elsewhere, GET /org-items/folder-labels)
  - frontend/src/hooks/useActiveOrgId.ts (useActiveOrgId)
affects:
  - GET /folders, /folders/{id}/children, /documents, /library/summary, /workflows/published,
    /workflows/drafts, /threads, /workflow-runs (narrowed when an org resolves; unchanged otherwise)
  - POST /documents/upload (Root uploads minted in the active org)
  - OrgProvider WR-01 self-heal (header synced before the state flip)
tech-stack:
  added: []
  patterns:
    - "polarity-safe narrowing: {} / no predicate when no org resolves (seam-contract rule)"
    - "router-level bearer check for an honest 401"
key-files:
  created:
    - backend/app/services/org_lists.py
    - backend/app/api/org_items.py
    - frontend/src/hooks/useActiveOrgId.ts
    - backend/tests/unit/test_298_list_narrowing.py
    - backend/tests/unit/test_298_org_items_routes.py
    - backend/tests/integration/test_298_two_org_lists_live.py
    - frontend/src/lib/api/__tests__/uploadDocument.orgHeader.test.ts
  modified:
    - backend/app/api/folders.py
    - backend/app/api/documents.py
    - backend/app/api/library.py
    - backend/app/api/threads.py
    - backend/app/api/workflow_runs.py
    - backend/app/api/workflows.py
    - backend/app/db/workflows.py
    - backend/app/main.py
    - frontend/src/lib/api/documents.ts
    - frontend/src/providers/OrgProvider.tsx
    - frontend/src/providers/OrgProvider.test.tsx
    - backend/tests/test_seed190_run_log.py
    - backend/tests/unit/test_284_summary_shape.py
    - backend/tests/unit/test_library_run_facts.py
    - backend/tests/unit/test_284_request_recorder.py
    - scripts/build-public-openapi.cjs
    - scripts/vitest-count-gate.cjs
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/public/api/overview.md
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "org_items routes answer 401 via a router-level bearer dependency: the shared HTTPBearer() answers 403 for a missing header on FastAPI 0.115.6 (measured), and D-22 asks for 401"
  - "Three fences amended deliberately, each with its reason in the test body: D-298-01 (run-log signature gains request), D-298-02 (placeholder counts 3->4 / 1->2), D-298-03 (summary binds one org scalar, never a list)"
  - "OrgProvider.test.tsx was in neither count-gate knob, so it was ADOPTED at 8 rather than 'raised'"
  - "The elsewhere counts exclude archived Root documents (D-36, matches the Library list default)"
requirements-completed: [ORG-01, ORG-02, ORG-03, ORG-04, ORG-06]
duration: ~76 min
completed: 2026-10-28
---

# Phase 298 Plan 01: Lists follow the active org (server half, count read, client plumbing) Summary

Every list Phase 298 names now narrows to the caller's validated active org, through one new module
(`org_lists.py`). Without an org the answer is byte-identical to before. Root uploads land in the
active org. Two new authenticated reads (`/org-items/elsewhere`, `/org-items/folder-labels`) answer
over the caller's RLS connection. The browser now sends the active org on upload, and the provider's
self-heal syncs the header before any child effect can run.

SC#1 (the read-only audit) was already met by `298-ORG-AUDIT.md`. This plan points to it and does not re-run it (D-18: no bulk re-stamp ships).

## Performance

- Started: 2026-10-28T05:03:19Z · Completed: 2026-10-28T06:19:24Z (~76 min, including two full gate runs of ~9 min each)
- Tasks: 3/3 (TDD: RED then GREEN commits for each)
- Files: 7 created, 22 modified

## Task Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `fb573b908` | test(298-01): list narrowing contract + D-298-01 fence amendment |
| 1 | GREEN | `8de3d5fd1` | feat(298-01): narrow list routes to the active org through org_lists (D-02..D-06, D-32) |
| 2 | RED | `a72436536` | test(298-01): workflow feeds, Root upload stamp, client org plumbing |
| 2 | GREEN | `df80406f5` | feat(298-01): org-narrow workflow feeds, stamp Root uploads, send the active org (D-07, D-29, D-36) |
| 3 | RED | `3886a947b` | test(298-01): org_items routes + live two-org list proof |
| 3 | GREEN | `f530ccd43` | feat(298-01): org_items router — elsewhere counts + folder labels (D-15, D-16, D-22) |

## What was built

- **`org_lists.py`**: `folder_kw` returns `{}` or `{"restrict_org_ids": {org}}`. It never returns an empty set and never passes `None` (grep gates: `get_active_org_id` 0, `set()` outside comments 0). `by_org` returns the same query object when there is no org. `root_upload_org` returns `None` for any foldered upload without resolving the org.
- **Narrowed routes** (one expression each, D-26): folders ×2 (`folder_kw`), documents list (`by_org` inside `build()`, every read, D-32), library summary (`WHERE is_latest AND ($1::uuid IS NULL OR org_id = $1)`), threads, workflow-runs, published + drafts (keyword-only `org_id`, system globals kept on the published feed).
- **Root upload stamp** (D-07): one `org_id=` keyword on the single minter call. Stated consequence: if a two-org user uploads identical bytes to Root in org B, org B now gets its own copy (org-scoped dedup, mig 195). That is the SEED-313 fix, not a regression.
- **`/org-items` router**:
  - `elsewhere`: one round trip, RLS connection, member orgs only, the caller's own rows only, `[]` without a query when no org resolves.
  - `folder-labels`: at most 50 strict UUIDs, else 422. Only ids in the unrestricted visible set that also have a readable org name are returned. Everything else is omitted, so the route reveals nothing about which other ids exist.
  - The router is mounted in `main.py`. The tag is grouped and flagged UI-internal in the public spec, and the docs overview now covers `router:org_items`.
- **Client**: `uploadDocument` sends `X-Org-Id` from `getActiveOrgId()`, read at send time. New `useActiveOrgId()` hook. OrgProvider's self-heal now calls `syncActiveOrgHeader(resolvedOrgId)` on the line before `setActiveOrgIdState(resolvedOrgId)`.

**Base sha256 recorded for `fetch_visible_folders`** (`inspect.getsource`, base `828d884b1`):
`5c331f0875dadfc1e5f1d2753d9bc6ad71c0614d8ed24a0ec3ae6096e73bdbc7`. It is pinned in `test_298_list_narrowing.py` and the test passes. `git diff 828d884b1 -- backend/app/utils/folder_utils.py` is empty.

Base SQL sha256s for the four workflow-feed shapes (published, published owned-only, published + project, drafts) were recorded from the unmodified builders. With no org, the SQL is byte-identical to them.

## Verification (gate lines verbatim)

- **Backend baseline (final, committed tree):** `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).`. Summary: `69 failed, 10198 passed, 1 skipped, 2 xfailed, 2 xpassed, 54 warnings in 492.83s`.
  - The first run (before the D-298-03 fix) read `failed: 70 <= 71`. The extra failure was `test_284_request_recorder::test_the_summary_reads_the_view_and_sends_no_id_list`, caused by this plan, and was fixed before the final commit.
- **Vitest count gate (final):** `count gate OK — 533/533 pinned files present, no per-file decrease, 0 failing.` · `total 12546 · failed 0 · pinned total 11373`. Per-file: `OrgProvider.test.tsx 8 8 0`, `uploadDocument.orgHeader.test.ts 4 4 0`.
  - The first run read `COUNT GATE VIOLATED … [failing-tests] 2 test(s) failed`. The failing names come from the gate's own JSON report:
    - `docsCoverageGate.test.ts`: caused by this plan (`[uncovered] router:org_items`). Fixed with a docs `covers:` entry.
    - `WorkflowBuilderPage.canvas.test.tsx` ("clicking Canvas flips aria-selected…"): the file has no changes since base, it passed on an isolated re-run and in the final gate. That does not prove it innocent; it looks like an intermittent timing flake.
- **tsc set-diff** (`npx tsc -p tsconfig.app.json --noEmit`, base measured by temporarily swapping in the base copies of the 3 touched files and removing the 2 new ones, then restoring them): base 54 unique errors, now 53. **New: 0.** One error disappeared: the unused `ReactNode` import in `OrgProvider.test.tsx` is now used.
- **Ledger gate:** `node scripts/check-hot-file-ledger.cjs --files <15 non-test files>` → `ledger gate OK — every watched file has a row.` (exit 0).
- **CLAUDE.md size gate:** `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (CLAUDE.md at 102,618 chars).
- **Targeted suites:** `test_298_list_narrowing.py` 43 passed. `test_298_org_items_routes.py` 18 passed. Fences all passed (202 passed across the Task 2 set, Task 1 set green apart from the inherited reds noted below): `test_284_summary_shape`, `test_165_folder_utils_org_scope`, `test_284_route_inventory`, `test_seed190_run_log`, `test_267_handoff`, `test_workflows_updated_at`, `test_library_run_facts` (its live arms ran), `test_286_workflows_seam_pins`, `test_280_minter_sequence`, `test_276_openapi_snapshot_fresh`, `test_285_stuck_pending_live`. Frontend: uploadDocument, OrgProvider, libraryPaging284, apiBarrel, libraryListFence and publicOpenapi suites all passed. `build-public-openapi --check OK`.
- **Live two-org proof:** `tests/integration/test_298_two_org_lists_live.py` → **11 passed, 0 skipped** under `-rs`, which includes the system-globals arm and the anon read. A follow-up SQL check found nothing left behind (0 orgs, users, workflows, folders or documents).
- **Inherited reds (not caused by this plan):** `test_071_1_threadpool_sweep` upload + extract_composable. Both were checked against base `828d884b1` and the offenders are identical there.

## Deviations from Plan

**1. [Rule 1/2 - Correctness] 401 via a router-level bearer dependency.** FastAPI 0.115.6's shared `HTTPBearer()` answers **403** for a missing header (measured: `GET /folders` → 403). D-22 and the plan require 401, so `org_items.router` carries `_require_bearer` (`HTTPBearer(auto_error=False)` → 401 + `WWW-Authenticate: Bearer`). Routes that 298-03 adds to this router inherit it. (`f530ccd43`)

**2. [Rule 3 - Blocking] Two more fences amended deliberately** (the plan named only the run-log one). Each reason is written in the test body:
- `test_library_run_facts::test_the_placeholder_numbering_is_PROVED_unchanged`, D-298-02: published `$` 3→4, draft 1→2, `$1` counts unchanged. (`df80406f5`)
- `test_284_request_recorder::test_the_summary_reads_the_view_and_sends_no_id_list`, D-298-03: the summary binds at most one non-sequence scalar, never a list of ids. (`f530ccd43`)

**3. [Rule 3 - Blocking] `docs/public/api/overview.md` gains `router:org_items` in `covers:`.** `check-docs-coverage.cjs` flagged the new router as uncovered. (`f530ccd43`)

**4. [Rule 2] OrgProvider.test.tsx ADOPTED into both count-gate knobs at 8** (6 existing + 2 new). The plan said "raise its pin", but it had no pin and no directory entry, so it ran and guarded nothing. (`a72436536`)

**5. [Rule 1 - test bug] My own published-feed test used `index("ORDER BY")`, which matched a LATERAL's ORDER BY.** Fixed to `rindex` in `df80406f5`.

**6. Ledger: 2 more rows in the CLAUDE.md FIRING table.** `backend/app/api/library.py` (now 3 phases) and `frontend/src/providers/OrgProvider.tsx` (now 3 phases) crossed into G-5 with this plan. `scripts/build-public-openapi.cjs`'s old row (`7 / 3 / 468`) was stale; the pre-298 measurement was `10 / 4 / 468`.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat register. T-298-01..06 are mitigated as planned and proven by unit tests plus the live suite, including the anon read of the counts SQL. The 401 dependency is an extra hardening of T-298-03/04.

## Notes for later plans

- `ingest_splice.py`'s D-266-18 prose ("/upload passes no org_id") is now stale for the Root arm. I did not edit it because the file is outside this plan's scope.
- The shared consumers of `/workflows/published` (chat picker, WorkspacePanel soul lookup, ConnectionsTab) are now active-org scoped (RESEARCH B6, accepted consequence). `useDraftPersistence.reload`'s by-id lookup in the drafts list is RESEARCH B7, decided in Plan 4.
- STATE.md and ROADMAP.md are untouched (the orchestrator owns them).

## Self-Check: PASSED

- All 7 created files exist on disk. Commits `fb573b908`, `8de3d5fd1`, `a72436536`, `df80406f5`, `3886a947b` and `f530ccd43` are all present in `git log`. The local-DB lock file is removed.
