---
phase: 165-is-global-retirement-cleanup
verified: 2026-07-20T23:49:48Z
status: gaps_found
score: 6/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "The renamed backend integration/regression test suite runs green against the applied migration 111 (no phase-165-introduced test regressions) — the 'tests' pillar of MIG-02's 'end-to-end across DB + backend + frontend + tests' goal"
    status: failed
    reason: >-
      Plan 165-02 added a new service-role call (_resolve_caller_org_ids -> a
      `supabase.table("org_members").select("org_id").eq("user_id", user_id)` query) at the
      FRONT of `fetch_visible_folders` / `get_globally_visible_folder_ids` in
      `folder_utils.py` (confirmed via `git show 48bf71fc~1` — this call did not exist
      before this phase). This inserts one extra sequential supabase call ahead of the
      folders SELECT. Three pre-existing integration test files that exercise the exact
      endpoints Plan 02/03 modified (`/kb/ls`, `/kb/tree`, `/kb/grep`, `/kb/glob` in
      test_kb.py; folder create/move in test_folders.py; document list/upload in
      test_documents.py) mock supabase with a strict ordered
      `mock_builder.execute.side_effect = [...]` list that was never updated to budget for
      the new call. The result: the org_members mock response is consumed as if it were the
      folders response (or vice versa), producing `KeyError: 'user_id'` / `RuntimeError:
      coroutine raised StopIteration` / wrong status codes across 25 tests. Verified this is
      NOT a production bug: calling `fetch_visible_folders` directly against the live local
      DB (service-role client) returns correct real data (8 folders) — the app logic is
      sound; only the pre-existing test mocks are stale.
      Separately, 3 more test files (`test_116_tool_leak.py`, `test_117_route_leak.py`,
      `test_119_leak.py`) seed two users who each get a DIFFERENT auto-provisioned personal
      org (confirmed live: 8 users -> 8 distinct orgs, 1:1) and rely on a shared
      `is_org_shared` folder being visible CROSS-ORG as their "non-vacuous" test-setup
      precondition (`_seed_global_folder` docstring: "its docs are visible to EVERYONE").
      That is exactly the leaky pre-165 behavior; Plan 165-02's CR-01 fix (this phase's own
      flagship SC#4 deliverable) correctly closes it, so the precondition assertion itself
      now fails ("B must be able to read the global-folder SUBJECT") in 5 tests across these
      3 files, before the tests ever reach their actual intent (relationship-leak masking).
      None of these 30 failures (25 + 5) are mentioned anywhere in the phase's SUMMARY.md
      files, 165-REVIEW.md, or deferred-items.md. Plan 165-11's Task 3 ("backend
      rename-regression sweep") — the plan explicitly positioned as the assertion-level
      arbiter — sampled only `test_163_rls_platform_universal.py` +
      `test_163_rls_documents.py` + `test_v3_4_org_isolation.py` (39 passed) and never ran
      `test_kb.py` / `test_folders.py` / `test_documents.py` / the leak-test cluster, despite
      Plan 165-06's own file list including `test_folders.py` and `test_kb.py` and Plan
      165-05's file list including `test_116_tool_leak.py` / `test_117_route_leak.py` /
      `test_119_leak.py`.
      This does NOT undermine the DB/backend/frontend rename correctness (independently
      re-verified, see Observable Truths 1-4/6/7 below) or the SEED-124 security fix (which
      is correct and intentional) — but the phase's own stated goal explicitly includes
      "tests" in "end-to-end across DB + backend + frontend + tests," and this pillar is not
      met.
    artifacts:
      - path: "backend/tests/integration/test_kb.py"
        issue: "16 of 19 tests FAIL (KeyError 'user_id' / StopIteration) — mock_builder.execute.side_effect sequence doesn't budget for the new org_members call folder_utils.py now makes first"
      - path: "backend/tests/integration/test_folders.py"
        issue: "4 tests FAIL (TestCreateFolder x2, TestMoveFolder x2) — same mock-sequencing root cause"
      - path: "backend/tests/integration/test_documents.py"
        issue: "5 tests FAIL (TestListDocuments x3, TestUploadDocument, TestFullMarkdown) — same mock-sequencing root cause"
      - path: "backend/tests/integration/test_116_tool_leak.py"
        issue: "test_unreadable_endpoint_is_masked_for_other_viewer FAILS — fixture's non-vacuity precondition ('B must read A's global-folder subject cross-org') is invalidated by the CR-01 org-scoping fix"
      - path: "backend/tests/integration/test_117_route_leak.py"
        issue: "test_route_masks_unreadable_endpoint_for_other_viewer FAILS — same cross-org fixture-precondition break"
      - path: "backend/tests/integration/test_119_leak.py"
        issue: "3 tests FAIL (test_user_a_never_sees_user_b_signals, test_user_b_never_sees_user_a_signals, test_masked_target_not_reported_as_broken_for_either_viewer) — same cross-org fixture-precondition break"
    missing:
      - "Update test_kb.py / test_folders.py / test_documents.py's mock_builder.execute.side_effect sequences (or refactor to a table-name-keyed mock) so every ls/tree/grep/glob/create/move/list/upload test accounts for the new leading org_members call"
      - "Update test_116_tool_leak.py / test_117_route_leak.py / test_119_leak.py's two-user fixtures to place both callers in the SAME org (mirroring test_v3_4_org_isolation.py's explicit org-seeding pattern) so the relationship-masking behavior under test can be exercised without tripping the now-correctly-enforced org boundary"
      - "Re-run the full kb/folders/documents/leak test clusters to confirm green, and record the fix (or an explicit, reasoned defer) rather than leaving 30 tests silently red post-phase-completion"
deferred: []
---

# Phase 165: `is_global` Retirement Cleanup Verification Report

**Phase Goal:** MIG-02 — retire the legacy pre-org `is_global` boolean via the D-165-01 SEMANTIC SPLIT (folders/skills → `is_org_shared`; workflow_definitions/document_views/classification_rules/metadata_field_definitions → `is_system_global`; `skills.is_system` KEPT), end-to-end across DB + backend + frontend + tests, plus close the folded SEED-124 folder cross-org leak (SC#4).
**Verified:** 2026-07-20T23:49:48Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `is_global` is value-preservingly RENAMEd to `is_org_shared`/`is_system_global` everywhere it lives (SQL columns, `folder_utils.py`, Storage skill-files policy) — never drop+add (ROADMAP SC#1) | VERIFIED | Live catalog query confirms 6/6 columns renamed correctly per the split (folders/skills→`is_org_shared`; workflow_definitions/document_views/classification_rules/metadata_field_definitions→`is_system_global`); `skills.is_system` untouched. `folder_is_globally_visible` renamed OID-preservingly to `folder_is_org_shared` (confirmed via `pg_proc`). Storage policy confirmed: `s.is_system = true OR s.is_org_shared = true`. Row counts preserved (workflow_definitions is_system_global=true: 15; folders is_org_shared=true: 1; skills is_org_shared=true: 1) — no data movement. |
| 2 | User-facing copy reads "Shared with org" (not "Global"); no previously-shared folder/skill/view silently un-shares (ROADMAP SC#2 / D-165-07) | VERIFIED | `grep -rn "Shared with org" frontend/src/components` hits the folder + skill toggle sites; `grep -rln "ToggleGlobal\|toggleGlobal"` in frontend/src returns 0 (all compound identifiers retired with call sites, tsc-verified per 165-08/09 SUMMARYs); spot-ran 5 renamed vitest suites (FolderNode/FolderTree/NavRow/SkillCard/RuleBuilderPanel) = 50/50 passed. |
| 3 | An `is_system_global` allow-list keeps the seeded `skill-creator` cross-org visible; no route can set `is_system_global` (migration-only) (ROADMAP SC#3) | VERIFIED | Live RLS policy dump shows all 4 write-locked tables' SELECT universal branch = unconditional `is_system_global = true` (not org-gated) — auto-propagated verbatim from mig-109, not widened. INSERT/UPDATE WITH CHECK still hard-sets `is_system_global = false`; confirmed the literal `"is_system_global": False` write-lock lives only in the service layer (document_view_service.py/classification_rule_service.py/metadata_field_service.py), never settable from a request body (no platform Create model carries the field). 15 seeded workflows confirmed `is_system_global=true` live. |
| 4 | (Folded SEED-124/CR-01, SC#4) `folder_utils.py` visibility helpers are org-scoped; the agent's service-role KB browse/read tools can no longer enumerate another org's `is_org_shared` folders; xfail(strict) flipped to XPASS then removed; WR-01 owner-nulling broadened to subtree descendants | VERIFIED | `folder_utils.py` code inspection confirms `_resolve_caller_org_ids` + org-gated `is_in_global_subtree` (fail-closed on empty org set) + broadened `_null_foreign_global_owner`. Ran `test_v3_4_org_isolation.py` live: **23 passed / 0 failed / 0 xfail** — `test_browse_tools_cross_org_isolation_seed124_closed` (renamed from the `KNOWN_OPEN` xfail) passes as a normal test; `grep -c "xfail\|KNOWN_OPEN"` in the file = 0. |
| 5 | The renamed backend/frontend test suite runs green against the applied migration ("tests" pillar of "end-to-end across DB + backend + frontend + tests") | **FAILED** | 30 tests across 6 backend files (test_kb.py×16, test_folders.py×4, test_documents.py×5, test_116_tool_leak.py×1, test_117_route_leak.py×1, test_119_leak.py×3) are RED, directly traceable to Plan 165-02's new `_resolve_caller_org_ids` call and the CR-01 org-scoping fix — see Gaps below. None triaged/documented anywhere in the phase's artifacts. |
| 6 | `skills.is_system` preserved verbatim everywhere (D-165-02) | VERIFIED | Live catalog: `skills.is_system` column exists unchanged. Repo-wide: every plan's summary confirms `is_system` counts unchanged vs HEAD; spot-checked `match_skills` DEFINER fn keeps `s.is_system = true` as the universal escape outside the org gate. |
| 7 | Zero bare `is_global` remains across backend/app, backend/tests (non-comment), frontend/src, migration 111, and `full-schema.sql` | VERIFIED | `grep` sweep: 0 hits in `backend/app` (source, excluding stale `.pyc`), 0 in `frontend/src` (source, excluding 2 rename-annotation comments), 0 in `supabase/full-schema.sql` (`grep -Ec "\bis_global\b"` = 0). One acknowledged pre-existing residual: `backend/scripts/seed_115_uat_views.py:41` (out of `backend/app`+`backend/tests` scope, documented in `deferred-items.md`, not exercised by app/tests). |

**Score:** 6/7 truths verified

### Confirmed Pre-Existing / Out-of-Scope Findings (not counted as gaps, per phase-provided context)

| Item | Disposition |
|------|-------------|
| SEED-125 — `tool_dispatcher.py`'s 6 `.or_(is_org_shared.eq.true)` skill-resolution sites have no `org_id` gate on the service-role client (the skills analog of the folder SEED-124 leak) | Confirmed pre-existing (the rename was value-preserving; it neither introduced nor closed this). Captured in `.planning/seeds/SEED-125-skill-tools-service-role-cross-org-leak.md`. Not a 165 regression. |
| `test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org` + `test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org` FAIL | Confirmed pre-existing — both assert `is_system_global=true` rows are hidden cross-org, but mig-109 (Phase 163 FIX-A) deliberately made the 4 write-locked tables' universal branch unconditional. Verified: live RLS policy text matches "auto-propagated, not widened" exactly as claimed; these assertions would fail identically on any commit since mig-109, independent of Phase 165. Logged in `deferred-items.md`. |
| `backend/scripts/seed_115_uat_views.py:41` still has `"is_global": False` | Confirmed pre-existing residual, outside `backend/app`+`backend/tests` scope, not exercised by app or tests. Documented in `deferred-items.md`. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/111_is_global_retirement_rename.sql` | Atomic value-preserving rename migration | VERIFIED | Single `BEGIN…COMMIT`; 6 RENAME COLUMN; DEFINER/trigger fn rewrites; storage policy reconciliation; applied live (confirmed via psycopg2 catalog query) |
| `backend/app/utils/folder_utils.py` | Org-scoped, fail-closed visibility helpers (CR-01/WR-01) | VERIFIED | `_resolve_caller_org_ids`, org-gated `is_in_global_subtree`, broadened `_null_foreign_global_owner` — read in full, logic sound |
| `backend/app/models/*.py` + `backend/app/api/*.py` | Per-table split target on model/API layer | VERIFIED | Spot-checked `documents.py` MIXED (folders→is_org_shared, classification_rules→is_system_global), `embedding_service.py`/`classification_matcher.py`/`workflow_authoring.py` (the 4 checker-corrected files) — all match live source |
| `frontend/src/types/index.ts` + `frontend/src/lib/api.ts` | Client contract mirroring renamed wire | VERIFIED | 0 bare is_global/isGlobal in source; toggle identifiers fully OrgShared |
| `backend/tests/integration/test_v3_4_org_isolation.py` | Exit gate, SC#4 arbiter | VERIFIED | 23 passed / 0 failed / 0 xfail, live-run confirmed |
| `backend/tests/integration/test_kb.py`, `test_folders.py`, `test_documents.py` | Pre-existing integration tests for the endpoints this phase modified | **STUB/BROKEN** | 25 tests fail — mock sequencing not updated for the new org-scoping call this phase added |
| `backend/tests/integration/test_116/117/119_*.py` | Pre-existing cross-org leak-masking tests | **BROKEN** | 5 tests fail — fixture precondition invalidated by this phase's own CR-01 fix, not updated |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `folder_utils.get_globally_visible_folder_ids` | `org_members` | service-role `_resolve_caller_org_ids` query | VERIFIED | Confirmed live: fail-closed, org-gated, matches exit-gate expectations |
| `supabase/migrations/111...sql` | mig-108/109 RLS policies | RENAME COLUMN auto-propagation | VERIFIED | Live `pg_policies` dump shows all 10 policies across the 6 tables auto-propagated correctly, no over-widening |
| `frontend/src/hooks/useFolders.ts` | `frontend/src/lib/api.ts` | `toggleOrgShared` → `apiToggleFolderOrgShared` | VERIFIED | grep confirms rename + call sites; tsc -b clean per 165-08 SUMMARY |
| `backend/app/api/kb.py` (`ls`/`tree`) | `folder_utils.fetch_visible_folders` | direct call | **PARTIAL** | Production path VERIFIED correct (live-DB direct call test returned real data); but the pre-existing integration-test harness for this exact link (test_kb.py) is broken (see Gap) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `folder_utils.fetch_visible_folders` | `all_folders` | live `folders` table via service-role client | Yes — direct live-DB call returned 8 real folder rows for a real user | FLOWING |
| `kb.py` `/kb/ls` `/kb/tree` | folder/doc listings | `fetch_visible_folders` / `get_globally_visible_folder_ids` | Yes (verified via direct function call against live DB) | FLOWING (production); test harness stale (see Gap) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live DB catalog matches the D-165-01 split | `psycopg2` query against `information_schema.columns` | 6/6 columns correctly split, 0 `is_global` | PASS |
| SC#4 exit gate passes live | `pytest test_v3_4_org_isolation.py` | 23 passed / 0 failed / 0 xfail | PASS |
| `fetch_visible_folders` returns real data against live DB | direct async call via service-role client | 8 real folders returned for a real user | PASS |
| Renamed frontend component suites pass | `vitest run` (FolderNode/FolderTree/NavRow/SkillCard/RuleBuilderPanel) | 50/50 passed | PASS |
| Pre-existing `/kb/ls`,`/kb/tree`,`/kb/grep`,`/kb/glob` integration tests | `pytest test_kb.py` | 16/19 FAIL | **FAIL** |
| Pre-existing folder create/move integration tests | `pytest test_folders.py` | 4/~19 FAIL | **FAIL** |
| Pre-existing document list/upload integration tests | `pytest test_documents.py` | 5/53 FAIL | **FAIL** |
| Cross-org relationship-leak-masking tests | `pytest test_116_tool_leak.py test_117_route_leak.py test_119_leak.py` | 5/~15 FAIL | **FAIL** |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase (schema/backend/frontend rename phase, not a probe-based migration/tooling phase). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| MIG-02 | All 11 plans (01-11) | Retire `is_global` via value-preserving rename + semantic split; close SEED-124 | PARTIALLY SATISFIED | DB/backend/frontend rename + SC#4 closure: SATISFIED (Truths 1-4, 6, 7). "tests" pillar: BLOCKED (Truth 5 — 30 tests newly red, untriaged). `.planning/REQUIREMENTS.md` line 39/126 still shows MIG-02 as `[ ]` / "Pending" — bookkeeping not updated to reflect phase completion (matches the known recurring `phase.complete` ROADMAP/REQUIREMENTS staleness pattern; hand-fix recommended once the Truth-5 gap is closed). |

No orphaned requirements found — MIG-02 is the only requirement ID mapped to Phase 165 in REQUIREMENTS.md, and all 11 plans declare it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/placeholder debt markers found in the phase's key modified files (migration 111, folder_utils.py, kb.py, tool_dispatcher.py, models, frontend types/api) | ℹ️ Info | Clean |

### Human Verification Required

None. All findings in this report are programmatically verified (live DB queries, live pytest/vitest runs, git diff provenance, direct code reads) — no visual/UX/real-time behavior requires human judgment for this phase's scope.

### Gaps Summary

The DB migration, backend model/API/service rename, frontend contract/component/copy rename, and the SC#4 SEED-124 security fix are all **independently verified correct** against the live local database and codebase — this is solid, well-executed work. The gap is narrower but real: Plan 165-02's org-scoping fix (`_resolve_caller_org_ids`) inserted a new sequential service-role call into `folder_utils.py`'s two visibility helpers, and this broke the pre-existing mocked test harnesses for `test_kb.py` (16 tests), `test_folders.py` (4 tests), and `test_documents.py` (5 tests) — all of which exercise the exact endpoints this phase modified. Separately, the same CR-01 fix correctly invalidates the "global folder visible cross-org" precondition baked into `test_116_tool_leak.py`, `test_117_route_leak.py`, and `test_119_leak.py`'s two-user fixtures (5 tests), which were written before org-scoping existed.

None of these 30 failures are pre-existing rot unrelated to this phase (confirmed via `git show` that the new call didn't exist before commit `48bf71fc`, and via a direct live-DB function call proving the *production* code path is correct — only the *test* harnesses are stale). None are mentioned in any of the phase's 11 SUMMARY.md files, in `165-REVIEW.md`, or in `deferred-items.md`. Plan 165-11's Task 3 ("backend rename-regression sweep"), which is explicitly positioned as the assertion-level arbiter for the whole phase, sampled only 3 unrelated RLS files and never ran the test files most directly affected by Plan 02's change — several of which (`test_folders.py`, `test_kb.py`, `test_116/117/119_*.py`) were in fact in Plans 05/06's own `files_modified` lists (they were token-renamed for `is_global`→`is_org_shared` but never functionally re-run against the applied migration).

This is a fixable, scoped gap (test-mock/fixture staleness, not a production defect), but it must be closed — or explicitly, reasonedly deferred with a tracked follow-up — before declaring MIG-02's "end-to-end across DB + backend + frontend + tests" goal fully achieved.

---

_Verified: 2026-07-20T23:49:48Z_
_Verifier: Claude (gsd-verifier)_
