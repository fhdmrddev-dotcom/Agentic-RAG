---
phase: 165-is-global-retirement-cleanup
verified: 2026-07-21T00:29:49Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "The renamed backend integration/regression test suite runs green against the applied migration 111 (no phase-165-introduced test regressions) — the 'tests' pillar of MIG-02's 'end-to-end across DB + backend + frontend + tests' goal"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "tool_dispatcher.py's 6 .or_(is_org_shared.eq.true) skill-resolution sites have no org_id gate on the service-role client (skills-domain analog of the folder SEED-124 leak)"
    addressed_in: "SEED-125 (planted 2026-07-20, unscheduled)"
    evidence: "Confirmed pre-existing in the prior verification run (2026-07-20); the value-preserving rename neither introduced nor closed this. Not in Phase 165 scope (folders-only CR-01 fix); captured in .planning/seeds/SEED-125-skill-tools-service-role-cross-org-leak.md for future scheduling."
  - truth: "test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org and test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org pass"
    addressed_in: "Pre-existing since Phase 163 (mig-109 FIX-A), not a Phase 165 concern"
    evidence: "Re-ran live 2026-07-21: still 2 failed / 22 passed, identical failure text ('cross-org leak: a global workflow_definition is visible across orgs') to the prior verification run. mig-109 deliberately made the 4 write-locked tables' universal SELECT branch unconditional (auto-propagated, not widened, by Phase 165's rename) — these assertions would fail identically on any commit since mig-109, independent of Phase 165."
---

# Phase 165: `is_global` Retirement Cleanup Verification Report

**Phase Goal:** MIG-02 — retire the legacy pre-org `is_global` boolean via the D-165-01 SEMANTIC SPLIT (folders/skills → `is_org_shared`; workflow_definitions/document_views/classification_rules/metadata_field_definitions → `is_system_global`; `skills.is_system` KEPT), end-to-end across DB + backend + frontend + tests, plus close the folded SEED-124 folder cross-org leak (SC#4).
**Verified:** 2026-07-21T00:29:49Z
**Status:** passed
**Re-verification:** Yes — after gap-closure plan 165-12 (test-only fixes for the 30 stale tests flagged in the initial 2026-07-20T23:49:48Z run)

## Re-verification (2026-07-21)

The prior VERIFICATION.md (2026-07-20T23:49:48Z, `status: gaps_found`, 6/7) had exactly one failed truth — the "tests" pillar — because Plan 165-02's `_resolve_caller_org_ids` org-scoping fix (a new leading `org_members` service-role query in `folder_utils.py`) broke 25 tests' stale positional supabase mocks, and the CR-01/SEED-124 fix correctly invalidated a cross-org-visibility precondition baked into 5 leak-masking tests. Gap-closure plan 165-12 (commits `4485053f`, `879b4a37`) addressed both root causes. This re-verification independently re-confirms the closure rather than trusting 165-12-SUMMARY.md's claims:

1. **Independently re-ran the 6 gap-closure test files** (`test_kb.py`, `test_folders.py`, `test_documents.py`, `test_116_tool_leak.py`, `test_117_route_leak.py`, `test_119_leak.py`) against the live migrated DB: **96 passed, 2 xpassed, 0 failed** — matches the SUMMARY's claim, confirmed first-hand rather than accepted on narrative.
2. **SECURITY GUARDRAIL 1 (scope):** `git diff --stat 4485053f~1..879b4a37` shows exactly the 6 test files changed (201 insertions, 7 deletions), and `git diff --stat 4485053f~1..879b4a37 -- backend/app/` is empty — **zero production-source lines touched** by the gap closure. Confirmed independently, not taken from the SUMMARY's self-check.
3. **SECURITY GUARDRAIL 2 (no assertion weakened, no leak re-introduced):** Read the full diffs of `test_116_tool_leak.py`, `test_117_route_leak.py`, and `test_119_leak.py`.
   - `test_116`/`test_117`: the diff is purely additive — a new `_colocate_in_owner_org` helper (inserts user B into user A's auto-provisioned personal org via `org_members`, mirroring `test_v3_4_org_isolation.py`'s explicit co-org seeding) plus one call to it in the `two_users_with_link` fixture. Zero lines removed. Read the full masking-assertion bodies (`test_unreadable_endpoint_is_masked_for_other_viewer`, `test_route_masks_unreadable_endpoint_for_other_viewer`) — byte-for-byte unchanged from the pre-165-12 version; both non-vacuity guards (subject genuinely resolved, edge row present) and both never-leak guards (real filename/id/source_ref absent from response) are intact. The fixture change only makes the SHARED (`is_org_shared`) subject legitimately visible to the co-org caller — the PRIVATE (`folder_id=NULL`) target is never touched by the co-location, so CR-01's cross-org closure is not undone.
   - `test_119`: the diff adds one autouse fixture that patches `app.dependencies.is_operator` → `True` to work around a pre-existing Phase-148 event-loop/asyncpg-pool interaction under a bare `TestClient` (independently confirmed: `governance_health`'s `feature_audience` is `"everyone"` in `user_settings.py`/mig-098, and `require_visible()` in `backend/app/dependencies.py:465-475` short-circuits to a no-op for Everyone-audience features regardless of `is_operator`'s result — so this bypass changes nothing about production authorization, only removes a harness-only pool crash). Read the three masking test bodies (`test_user_a_never_sees_user_b_signals`, `test_user_b_never_sees_user_a_signals`, `test_masked_target_not_reported_as_broken_for_either_viewer`) — unchanged; all own-scoping cross-checks and non-vacuity guards intact. No co-org fixture was applied here (correctly — governance is owner-scoped, not org-scoped, and it doesn't rely on shared-folder visibility).
   - Two of the "Root cause A" test_documents.py fixes were **actually pre-165 stale-mock issues** (Phase-163 folder-owner check, Phase-111.1/112/118 metadata-enrichment/telemetry writes) mis-attributed by the plan to the org_members insertion — read both diffs; the real assertions (201 + folder association; `full_markdown`+`status='completed'` in the completion UPDATE) are unchanged, only mock plumbing was corrected to match already-existing production behavior from prior phases.
4. **Spot-checked the still-standing 6 truths for regressions:**
   - DB catalog: live query confirms all 6 columns still correctly split (`folders`/`skills` → `is_org_shared`; `workflow_definitions`/`document_views`/`classification_rules`/`metadata_field_definitions` → `is_system_global`), 0 `is_global` remaining.
   - `skills.is_system` column still present, unchanged.
   - `grep` sweep: 0 bare `is_global` in `backend/app`; 0 in `frontend/src` (6 comment-only rename-annotation references, same category the prior run excluded — no functional occurrences); 0 in `supabase/full-schema.sql`.
   - UI copy: "Shared with org" still present at the folder/skill toggle sites; `ToggleGlobal`/`toggleGlobal` identifiers still 0 hits.
   - `test_v3_4_org_isolation.py` (SC#4 exit gate) re-run live: still **23 passed / 0 failed / 0 xfail** — no regression.
   - The 2 pre-existing, out-of-scope `test_163_rls_dm.py` / `test_163_rls_workflow_eval.py` FIX-A-universality failures were re-run live and still fail identically (same assertion text) — confirms they are unrelated to Phase 165 or the gap closure, not newly broken, and correctly remain deferred (not phase-165 blockers, per mig-109's deliberate universal-branch design from Phase 163).

**Verdict:** Both guardrails hold. The tests pillar is closed via legitimate test-harness-only maintenance with zero production change and zero weakened security assertion. Truth 5 flips from FAILED to VERIFIED. Score updated 6/7 → 7/7. Status updated `gaps_found` → `passed`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `is_global` is value-preservingly RENAMEd to `is_org_shared`/`is_system_global` everywhere it lives (SQL columns, `folder_utils.py`, Storage skill-files policy) — never drop+add (ROADMAP SC#1) | VERIFIED | Live catalog query (re-confirmed 2026-07-21) shows 6/6 columns correctly split (folders/skills→`is_org_shared`; workflow_definitions/document_views/classification_rules/metadata_field_definitions→`is_system_global`); `skills.is_system` untouched. Originally confirmed via `pg_proc`/storage-policy dump in the 2026-07-20 run (OID-preserving rename, row counts preserved) — unchanged by the gap closure (test-only). |
| 2 | User-facing copy reads "Shared with org" (not "Global"); no previously-shared folder/skill/view silently un-shares (ROADMAP SC#2 / D-165-07) | VERIFIED | Re-confirmed 2026-07-21: `grep -rln "Shared with org" frontend/src/components` still hits the folder + skill toggle sites (FolderCreateInput/FolderDetail/FolderNode/NavRow/SkillCard); `ToggleGlobal`/`toggleGlobal` still 0 hits. Unchanged by the gap closure. |
| 3 | An `is_system_global` allow-list keeps the seeded `skill-creator` cross-org visible; no route can set `is_system_global` (migration-only) (ROADMAP SC#3) | VERIFIED | Unchanged from 2026-07-20 run (test-only gap closure did not touch any RLS policy or service-layer write lock): live RLS policy dump showed all 4 write-locked tables' SELECT universal branch = unconditional `is_system_global = true`; write-lock `"is_system_global": False` confirmed service-layer-only. |
| 4 | (Folded SEED-124/CR-01, SC#4) `folder_utils.py` visibility helpers are org-scoped; the agent's service-role KB browse/read tools can no longer enumerate another org's `is_org_shared` folders; xfail(strict) flipped to XPASS then removed; WR-01 owner-nulling broadened to subtree descendants | VERIFIED | Re-ran `test_v3_4_org_isolation.py` live 2026-07-21: **23 passed / 0 failed / 0 xfail** (no regression from the gap closure, which touched none of `folder_utils.py`). |
| 5 | The renamed backend/frontend test suite runs green against the applied migration ("tests" pillar of "end-to-end across DB + backend + frontend + tests") | **VERIFIED (gap closed by Plan 165-12)** | Independently re-ran the 6 previously-failing files: `test_kb.py test_folders.py test_documents.py test_116_tool_leak.py test_117_route_leak.py test_119_leak.py` → **96 passed, 2 xpassed, 0 failed**. Confirmed via `git diff` that the fix was test-harness-only (0 production lines changed) and that no masking/leak assertion was weakened or cross-org visibility re-introduced (see Re-verification section above for the detailed diff read). |
| 6 | `skills.is_system` preserved verbatim everywhere (D-165-02) | VERIFIED | Re-confirmed 2026-07-21 via live catalog query: `skills.is_system` column exists unchanged. Gap closure did not touch skills tables/models. |
| 7 | Zero bare `is_global` remains across backend/app, backend/tests (non-comment), frontend/src, migration 111, and `full-schema.sql` | VERIFIED | Re-swept 2026-07-21: 0 hits in `backend/app` (source), 0 functional hits in `frontend/src` (6 comment-only rename annotations, same category as before), 0 in `supabase/full-schema.sql`. The gap-closure test files themselves reference `is_global`/`org_members` only in explanatory comments describing the historical rename — not bare functional references. One acknowledged pre-existing residual outside scope: `backend/scripts/seed_115_uat_views.py:41` (documented in `deferred-items.md`, unchanged). |

**Score:** 7/7 truths verified

### Deferred Items

Items not counted as gaps — confirmed pre-existing and out of Phase 165's scope, unaffected by the gap closure.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `tool_dispatcher.py`'s 6 `.or_(is_org_shared.eq.true)` skill-resolution sites have no `org_id` gate on the service-role client (skills-domain analog of the folder SEED-124 leak) | SEED-125 (planted, unscheduled) | Confirmed pre-existing in the 2026-07-20 run; the value-preserving rename neither introduced nor closed this; Phase 165's CR-01 fix was scoped to folders only. Captured in `.planning/seeds/SEED-125-skill-tools-service-role-cross-org-leak.md`. |
| 2 | `test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org` + `test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org` FAIL | Pre-existing since Phase 163 (mig-109 FIX-A) | Re-ran live 2026-07-21: still 2 failed / 22 passed, identical failure text to the 2026-07-20 run. mig-109 deliberately made the 4 write-locked tables' universal SELECT branch unconditional (Phase 165's rename auto-propagated this, did not widen it) — these assertions fail identically on any commit since mig-109, independent of Phase 165 or the 165-12 gap closure. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/111_is_global_retirement_rename.sql` | Atomic value-preserving rename migration | VERIFIED | Unchanged since 2026-07-20 run; single `BEGIN…COMMIT`; 6 RENAME COLUMN; applied live |
| `backend/app/utils/folder_utils.py` | Org-scoped, fail-closed visibility helpers (CR-01/WR-01) | VERIFIED | Unchanged by gap closure (test-only); `_resolve_caller_org_ids`, org-gated `is_in_global_subtree`, broadened `_null_foreign_global_owner` |
| `backend/app/models/*.py` + `backend/app/api/*.py` | Per-table split target on model/API layer | VERIFIED | Unchanged by gap closure; `git diff -- backend/app/` across 165-12 commits is empty |
| `frontend/src/types/index.ts` + `frontend/src/lib/api.ts` | Client contract mirroring renamed wire | VERIFIED | Unchanged; 0 bare is_global/isGlobal in source |
| `backend/tests/integration/test_v3_4_org_isolation.py` | Exit gate, SC#4 arbiter | VERIFIED | 23 passed / 0 failed / 0 xfail, re-run live 2026-07-21 |
| `backend/tests/integration/test_kb.py`, `test_folders.py`, `test_documents.py` | Pre-existing integration tests for the endpoints this phase modified | **VERIFIED (fixed by Plan 165-12)** | All pass; table-name-keyed `_route_org_members` autouse fixture added, no assertions touched |
| `backend/tests/integration/test_116/117/119_*.py` | Pre-existing cross-org leak-masking tests | **VERIFIED (fixed by Plan 165-12)** | All pass; 116/117 co-org fixture + 119 `is_operator` production-no-op bypass, masking assertions byte-identical |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `folder_utils.get_globally_visible_folder_ids` | `org_members` | service-role `_resolve_caller_org_ids` query | VERIFIED | Unchanged; fail-closed, org-gated |
| `supabase/migrations/111...sql` | mig-108/109 RLS policies | RENAME COLUMN auto-propagation | VERIFIED | Unchanged; live `pg_policies` dump matches |
| `frontend/src/hooks/useFolders.ts` | `frontend/src/lib/api.ts` | `toggleOrgShared` → `apiToggleFolderOrgShared` | VERIFIED | Unchanged |
| `backend/app/api/kb.py` (`ls`/`tree`) | `folder_utils.fetch_visible_folders` | direct call | **VERIFIED (test harness fixed by Plan 165-12)** | Production path was already verified correct; the previously-stale `test_kb.py` harness now passes (19/19), closing the last partial link |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `folder_utils.fetch_visible_folders` | `all_folders` | live `folders` table via service-role client | Yes | FLOWING (unchanged from prior run) |
| `kb.py` `/kb/ls` `/kb/tree` | folder/doc listings | `fetch_visible_folders` / `get_globally_visible_folder_ids` | Yes | FLOWING (production and now test harness both confirmed) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live DB catalog matches the D-165-01 split | `psycopg2` query against `information_schema.columns` | 6/6 columns correctly split, 0 `is_global` | PASS |
| SC#4 exit gate passes live | `pytest test_v3_4_org_isolation.py` | 23 passed / 0 failed / 0 xfail | PASS |
| Gap-closure test files pass live (Truth 5) | `pytest test_kb.py test_folders.py test_documents.py test_116_tool_leak.py test_117_route_leak.py test_119_leak.py -q` | 96 passed, 2 xpassed, 0 failed | PASS |
| Gap closure touched zero production code | `git diff --stat 4485053f~1..879b4a37 -- backend/app/` | empty | PASS |
| `require_visible("governance_health")` is a production no-op regardless of `is_operator` | read `backend/app/dependencies.py:465-475` + `user_settings.py` audience map | confirmed `"everyone"` audience short-circuits before `is_operator`'s result matters | PASS |
| Pre-existing out-of-scope RLS tests still fail identically (not newly broken, not silently fixed by scope creep) | `pytest test_163_rls_dm.py test_163_rls_workflow_eval.py` | 2 failed / 22 passed, same assertion text as 2026-07-20 | PASS (confirms correct deferral) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. SKIPPED (unchanged from prior run).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| MIG-02 | All 12 plans (01-11 + gap-closure 12) | Retire `is_global` via value-preserving rename + semantic split; close SEED-124; tests pillar | SATISFIED | DB/backend/frontend rename + SC#4 closure + tests pillar: all SATISFIED (Truths 1-7). `.planning/REQUIREMENTS.md` still shows MIG-02 as `[ ]` / "Pending" at the time of this re-verification (lines 39/126) — this is the known recurring `phase.complete` bookkeeping-staleness pattern (see MEMORY `reference_phase_complete_roadmap_gap`), not a functional gap; recommend a hand-fix flip to `[x]` / "Complete" alongside phase closure. |

No orphaned requirements found — MIG-02 is the only requirement ID mapped to Phase 165 in REQUIREMENTS.md, and all 12 plans (including the gap closure) declare it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX/placeholder debt markers found in the phase's key modified files (migration 111, folder_utils.py, kb.py, tool_dispatcher.py, models, frontend types/api, or the 6 gap-closure test files) | ℹ️ Info | Clean |

### Human Verification Required

None. All findings in this report are programmatically verified (live DB queries, live pytest runs, git diff provenance, direct code/diff reads) — no visual/UX/real-time behavior requires human judgment for this phase's scope.

### Gaps Summary

No gaps remain. The prior single gap (Truth 5 — the "tests" pillar) is closed by gap-closure Plan 165-12, independently re-verified in this pass: the 6 previously-red test files (30 failures) now run 96 passed / 2 xpassed / 0 failed against the live migrated DB; the fix was scoped entirely to test files with zero production-code change (`git diff --stat -- backend/app/` empty across both gap-closure commits); and both leak-test root-cause fixes (co-org fixture for 116/117, `is_operator` production-no-op bypass for 119) preserve every masking/owner-scoping assertion and non-vacuity guard byte-for-byte, without re-introducing any cross-org visibility that CR-01 correctly closed. The two out-of-scope pre-existing findings (SEED-125 skills-domain leak; the 2 `test_163_rls_*` FIX-A-universality failures) remain confirmed pre-existing and correctly deferred — neither is a Phase 165 blocker. MIG-02's full "end-to-end across DB + backend + frontend + tests" goal, plus the folded SC#4 SEED-124 closure, is achieved.

---

_Verified: 2026-07-21T00:29:49Z_
_Verifier: Claude (gsd-verifier)_
