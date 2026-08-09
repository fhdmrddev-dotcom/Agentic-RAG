---
phase: 165-is-global-retirement-cleanup
plan: 11
subsystem: testing
tags: [multi-tenancy, rls, org-isolation, seed-124, exit-gate, xfail, is_org_shared, is_system_global, pytest]

# Dependency graph
requires:
  - phase: 165-10
    provides: migration 111 applied live (is_global → is_org_shared / is_system_global; folder_is_globally_visible → folder_is_org_shared) + full-schema regen with zero bare is_global
  - phase: 165-02
    provides: org-scoped, fail-closed service-role folder-visibility helpers (get_globally_visible_folder_ids) that close the SEED-124 CR-01 cross-org browse-tool leak
provides:
  - The SC#4 arbiter GREEN — test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124 flipped xfail(strict) → XPASS → marker removed, now a normal passing regression (test_browse_tools_cross_org_isolation_seed124_closed) driven live against the real service-role client
  - The two-org exit gate re-renamed to the mig-111 identifiers (folder_is_org_shared DEFINER fn + is_org_shared folders/skills literals) and GREEN end-to-end (23 passed / 0 failed / 0 xfail)
  - MIG-02 rename-regression evidence: backend/app + backend/tests carry 0 bare is_global; the named RLS suites pass against the renamed DB
affects: [166, 167, 168]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SC#4 arbitration is a LIVE two-org drive (real service-role BYPASSRLS client via the :54321 REST gate), never code inspection — the former xfail(strict) marker converting to XPASS is the honest close signal"
    - "A strict-xfail that starts passing REPORTS as failure (XPASS under strict); the plan's job is to observe that flip, then convert it to a plain passing regression test (marker removed, assertion body unchanged)"

key-files:
  created:
    - .planning/phases/165-is-global-retirement-cleanup/165-11-SUMMARY.md
  modified:
    - backend/tests/integration/test_v3_4_org_isolation.py
    - .planning/phases/165-is-global-retirement-cleanup/deferred-items.md

key-decisions:
  - "SC#4 closed by the LIVE XPASS (REST gate at :54321 reachable — probe returned 200, not skipped), not by code inspection — T-165-26 mitigation satisfied"
  - "Leak assertion body left UNCHANGED (a['shared_folder_id'] not in visible_ids) — only the xfail marker + KNOWN_OPEN naming removed (T-165-27 no-weakening)"
  - "The two failing behavioral RLS tests (dm/workflow_eval) are PRE-EXISTING ROT since Phase 163 mig-109 FIX-A (is_system_global universal by design), NOT rename-induced and NOT a leak — documented, not fixed (out of this plan's file scope)"

patterns-established:
  - "Rename-regression proof for a same-token→different-name-by-table split: verify against the LIVE renamed DB + confirm 0 bare is_global in backend/app + backend/tests (the migration file legitimately keeps is_global only as its own RENAME COLUMN FROM-references)"

requirements-completed: [MIG-02]

# Metrics
duration: ~25min
completed: 2026-07-21
---

# Phase 165 Plan 11: SC#4 Exit-Gate Arbitration Summary

**The SEED-124 known-open leak test flipped xfail(strict) → live XPASS → marker removed (now a normal passing cross-org-isolation regression), the exit-gate literals were renamed to the mig-111 identifiers, and the two-org isolation suite is GREEN end-to-end (23 passed) — SC#4 arbitrated by the live two-org drive, not code inspection.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-21
- **Completed:** 2026-07-21
- **Tasks:** 3
- **Files modified:** 2 (1 test file + deferred-items.md); 1 summary created

## Accomplishments
- **SC#4 arbitrated (the phase acceptance):** ran the SEED-124 leak test as-is against the applied-renamed DB — it reported `[XPASS(strict)]` (the org-scoped plan-02 helper resolves the caller's org set from `org_members` and returns 0 of a disjoint org's shared folders, so the `a["shared_folder_id"] not in visible_ids` assertion now passes). The httpx logs confirm the LIVE service-role REST gate at `:54321` was reachable (probe `GET /rest/v1/folders → 200`), so this is a genuine live PASS, not a skip.
- **Marker removed → normal passing test:** deleted the `@pytest.mark.xfail(strict=True, …)` decorator, renamed `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` → `test_browse_tools_cross_org_isolation_seed124_closed`, and flipped the section header from "KNOWN-OPEN (folded to Phase 165)" to "CLOSED by Phase 165". The assertion BODY is unchanged (not weakened).
- **Exit-gate rename (D-165-01):** `_DEFINER_FUNCTIONS` tuple + the fourth DEFINER leg (call + audit) now reference `folder_is_org_shared`; the fixture's folders/skills raw-SQL `is_global` literals → `is_org_shared` (skills.`is_system` kept verbatim); the over-widening guard `test_user_is_global_stays_org_scoped` → `test_user_is_org_shared_stays_org_scoped`.
- **Two-org exit gate GREEN:** `pytest test_v3_4_org_isolation.py` = **23 passed / 0 failed / 0 xfail / 0 xpass** (was 22 passed / 1 xfailed). The platform-universal guard (`test_is_system_stays_universal`) + the over-widening guard (renamed) both still pass — no over-widening of the 15 seeded workflows / `is_system` escape.
- **MIG-02 rename-regression proven:** `backend/app` + `backend/tests` carry **0 bare `is_global`**; `full-schema.sql` = 0; the named RLS suites pass against the renamed live DB (**39 passed** across `test_163_rls_platform_universal.py` + `test_163_rls_documents.py` + `test_v3_4_org_isolation.py`). `folder_is_globally_visible` fully retired from the exit gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: rename exit-gate is_global literals + folder_is_globally_visible refs** - `688833a6` (test)
2. **Task 2: flip SEED-124 leak test to normal passing regression (SC#4 arbiter)** - `c694ac9a` (test)
3. **Task 3: backend rename-regression sweep — triage documentation** - `e251e3c8` (docs)

**Plan metadata:** _(final SUMMARY commit — see completion output)_

## Files Created/Modified
- `backend/tests/integration/test_v3_4_org_isolation.py` — Task 1: renamed the folders/skills raw-SQL `is_global` literals → `is_org_shared`, the `_DEFINER_FUNCTIONS` tuple entry + fourth DEFINER leg + `pg_proc` audit `folder_is_globally_visible` → `folder_is_org_shared`, comment/docstring/assert wording, and the over-widening guard function name. Task 2: removed the `xfail(strict)` marker, renamed the leak test, updated the section header to CLOSED (assertion body unchanged).
- `.planning/phases/165-is-global-retirement-cleanup/deferred-items.md` — appended the Task-3 triage: 2 pre-existing rot behavioral RLS tests (dm/workflow_eval) + the `scripts/seed_115_uat_views.py` residual.

## Decisions Made
- **SC#4 closed on the LIVE drive, not code inspection.** The `:54321` REST gate was up, so the leak leg genuinely ran and passed (T-165-26). Had it been unreachable, the leg would SKIP and SC#4 would stay BLOCKING until an operator-confirmed live PASS — that contingency did not fire.
- **Assertion body left unchanged** (only the marker + KNOWN_OPEN name removed) — T-165-27: the two-DISJOINT-org drive against the real service-role client stays the arbiter; nothing weakened to force a pass.
- **The two dm/workflow_eval failures are pre-existing rot, documented not fixed** — see Deviations below. They are out of Plan 165-11's file scope (`files_modified` = the exit-gate test only) and out of the plan's declared Task-3 named-suite gate.

## Deviations from Plan

None to the plan's declared work — all three tasks executed as written. One out-of-scope discovery was triaged (not fixed) per the executor SCOPE BOUNDARY rule:

### Deferred (out-of-scope, documented not fixed)

**1. [SCOPE BOUNDARY — pre-existing rot] Two stale behavioral RLS tests fail against the renamed DB**
- **Found during:** Task 3 (broader rename-regression sweep, beyond the plan's declared named suites)
- **Tests:** `test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org` + `test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org`
- **Root cause (evidence-based):** both assert an `is_system_global = true` row is NOT visible cross-org (`crossorg_sees == 0`). The LIVE policy on all four write-locked platform tables is `(is_system_global = true) OR (org_id IN current_user_org_ids() AND auth.uid() = <owner>)` — `is_system_global = true` is an **unconditional universal branch** (cross-org visible by design; the analog of `skills.is_system`). Migration evidence: **mig-108 (163)** created it org-gated → the tests passed; **mig-109 (163-11 FIX-A)** DELIBERATELY lifted the branch to universal for these four tables (only seeds/platform content can be `is_system_global = true` under the `WITH CHECK is_system_global = false` write-lock, so universal is safe); **mig-111 (this phase)** only renamed the column ("auto-propagated, not widened" per 165-10). So these assertions have contradicted live DB behavior **since Phase 163 mig-109**, independent of any 165 change. NOT the MIG-02 rename regression (the literals are correctly renamed) and NOT a security leak.
- **Disposition:** documented in `deferred-items.md` with the mig-109 baseline reference. Not fixed — out of this plan's file scope; correct follow-up is to flip the cross-org leg to expect universal visibility (`crossorg_sees == 1`) or drop it, in the owning files (Plan 165-05 domain).

**2. [SCOPE BOUNDARY — residual] `backend/scripts/seed_115_uat_views.py:41` still uses `"is_global": False`**
- **Found during:** Task 3 (repo-wide grep)
- **Issue:** a Phase-115 UAT one-off seed helper inserts a `document_views` row with the pre-rename column name (now `is_system_global`).
- **Disposition:** `scripts/` is outside the Task-3 acceptance-grep scope (`backend/app` + `backend/tests`) and outside any 165 plan's file ownership; not exercised by the app or any test. Documented, not fixed.

---

**Total deviations:** 0 auto-fixes; 2 out-of-scope discoveries triaged (both pre-existing, documented not fixed).
**Impact on plan:** None on the declared work. The rename (MIG-02) is complete and the SC#4 exit gate is green; the two red tests are a separate pre-existing semantic-obsolescence issue that predates Phase 165.

## Issues Encountered
- `docker ps` / port-probe Bash calls were sandbox-denied, so I confirmed the local stack indirectly: the leak test's httpx logs showed the `:54321` REST gate returning `200` (up), and the `:54322` Postgres was reachable via the `pg_pool`/psycopg2 harness. No blocker.
- The project `python` on PATH lacks backend deps; used the backend venv (`backend/venv/Scripts/python.exe`) per CLAUDE.md's venv rule.

## Threat Flags
None — no new network endpoint, auth path, or schema surface introduced (test-file-only plan; migration 111 landed in 165-10). The threat register's `mitigate` dispositions are satisfied: T-165-26 (arbiter = live XPASS, gate reachable), T-165-27 (assertion body unchanged), T-165-28 (`test_is_system_stays_universal` + the renamed over-widening guard both green in the 23-pass run).

## Known Stubs
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **SC#4 closed / SEED-124 fully arbitrated:** the milestone exit-gate suite (`test_v3_4_org_isolation.py`) is green (23 passed) and will be re-run after 166/167/168 land per the milestone exit gate. The former-xfail marker is gone — the browse-tool cross-org isolation now stands as a permanent passing regression.
- **Follow-up (not a blocker):** the two pre-existing rot behavioral RLS tests (dm/workflow_eval) should be corrected to expect universal `is_system_global` visibility — a `/gsd:quick` candidate or a phase-verifier item, tracked in `deferred-items.md`.
- **Cloud parity still owed** at the next operator-gated push: migrations 099 → 110 → 111 + `SECRETS_ENCRYPTION_KEY`, in order.

## Self-Check: PASSED
- `backend/tests/integration/test_v3_4_org_isolation.py` exists (modified, committed `688833a6` + `c694ac9a`).
- `.planning/phases/165-is-global-retirement-cleanup/deferred-items.md` exists (modified, committed `e251e3c8`).
- Commits present in `git log`: `688833a6`, `c694ac9a`, `e251e3c8`.
- Verify green: `pytest test_v3_4_org_isolation.py` = 23 passed / 0 failed / 0 xfail; forbidden-token grep in the exit-gate file = 0 (`is_global`, `xfail`, `KNOWN_OPEN`, `folder_is_globally_visible`); named RLS suites = 39 passed.

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-21*
