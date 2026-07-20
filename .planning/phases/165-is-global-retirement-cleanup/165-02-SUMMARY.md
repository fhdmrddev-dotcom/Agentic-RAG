---
phase: 165-is-global-retirement-cleanup
plan: 02
subsystem: api
tags: [multi-tenancy, rls, org-isolation, folder-utils, service-role, seed-124, folders, skills]

# Dependency graph
requires:
  - phase: 163-rls-rewrite
    provides: membership-based RLS + per-request user-JWT client (the request-path gate this backstops)
  - phase: 164-secdef-audit
    provides: _null_foreign_global_owner owner-nulling precedent (D-164-05) that WR-01 broadens; the xfail(strict) leak marker
provides:
  - Org-aware, fail-closed service-role folder-visibility helpers (is_in_global_subtree / fetch_visible_folders / get_globally_visible_folder_ids resolve the caller's org set from org_members and gate shared visibility to it)
  - Subtree-descendant owner-nulling (WR-01) — the seeding owner is nulled on the shared row AND its non-shared descendants
  - folders.is_global + skills.is_global renamed to is_org_shared across folder_utils.py / kb.py / tool_dispatcher.py (code side of the mig-111 rename)
affects: [165-03, 165-08, 165-10, 165-11, 166]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service-role caller-org resolution: helpers resolve caller_org_ids from org_members off the threaded user_id (no auth.uid() on the BYPASSRLS producer path), mirroring current_user_org_ids()"
    - "Fail-closed org derivation: empty/unresolved caller org set -> 0 shared folders (over-restrict, never over-share)"
    - "Serialize-time owner-nulling broadened via an optional visible-non-owned id set the folders caller passes (subtree descendants), keeping skills/views callers on the shared-row-only rule"

key-files:
  created:
    - backend/tests/unit/test_165_folder_utils_org_scope.py
  modified:
    - backend/app/utils/folder_utils.py
    - backend/app/api/kb.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/test_seed091_owner_nulling.py
    - backend/tests/test_load_skill_collision.py

key-decisions:
  - "Public helper signatures kept (supabase, user_id) — org resolution happens INSIDE from user_id so the exit-gate leak test drives them positionally (D-165-04)"
  - "is_in_global_subtree gained an optional caller_org_ids param (default empty set = fail-closed) — backward-compatible for any external caller"
  - "_null_foreign_global_owner gained an optional visible_non_owned_ids param; the WR-01 subtree broadening lives in the shared helper (kb.py passes the set), skills/views callers unchanged"
  - "skills.is_system kept verbatim (D-165-02, the skills allow-list) — only is_global tokens renamed to is_org_shared"

patterns-established:
  - "The service-role browse path (ls/tree/read/fetch) is org-gated in folder_utils.py itself — the one seam RLS/DEFINER never covered"

requirements-completed: [MIG-02]

# Metrics
duration: ~30min
completed: 2026-07-20
---

# Phase 165 Plan 02: folder_utils org-scoping + is_global->is_org_shared rename Summary

**Org-scoped, fail-closed service-role folder-visibility helpers that close the SEED-124 CR-01 cross-org browse-tool leak and broaden owner-nulling to subtree descendants (WR-01), with folders/skills `is_global` renamed to `is_org_shared` across the three browse-path files.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-20
- **Tasks:** 2 (Task 1 TDD: RED -> GREEN)
- **Files modified:** 5 (1 created, 4 modified) + 1 rename-induced test fix

## Accomplishments
- **CR-01 closed at the helper level (D-165-04):** `_resolve_caller_org_ids` resolves the caller's org set from `org_members` on the BYPASSRLS service-role client; `is_in_global_subtree` now treats a folder as shared-visible only when `is_org_shared` AND `org_id ∈ caller_org_ids`. A disjoint-org caller no longer enumerates another org's shared folders (unit-proven).
- **Fail-closed (D-165-04 / T-165-08):** a caller with no resolvable org set sees 0 shared folders — `is_in_global_subtree` can never return True for a non-owned folder with an empty `caller_org_ids`.
- **WR-01 subtree owner-nulling (D-165-05):** `kb.py` `tree_path` resolves the non-owned-visible id set once and passes it to `_null_foreign_global_owner`, which now nulls the seeding owner's `user_id` on the shared row AND its non-shared descendants (reused for doc-scoping, no duplicate fetch).
- **Rename (D-165-01):** all `is_global` tokens retired from `folder_utils.py` / `kb.py` / `tool_dispatcher.py` -> `is_org_shared` (skills.is_system untouched — D-165-02, the skills allow-list). Public helper signatures unchanged.
- **New unit test** proves CR-01 exclusion + same-org positive control + fail-closed + org-membership honoring + WR-01 descendant nulling against a no-DB fake supabase (runs green in Wave 1, pre-migration).

## Task Commits

1. **Task 1 (RED): failing unit test for org-scoped helpers** - `6102b8df` (test)
2. **Task 1 (GREEN): org-scope the folder-visibility helpers** - `48bf71fc` (feat)
3. **Task 2: broaden owner-nulling (WR-01) + rename is_global->is_org_shared** - `9ea67b38` (feat)
4. **Deviation fix: load_skill collision test rows -> is_org_shared** - `48405c4e` (fix)

## Files Created/Modified
- `backend/app/utils/folder_utils.py` - org-aware, fail-closed helpers; `_resolve_caller_org_ids` (org_members off user_id); `is_in_global_subtree` gated on `caller_org_ids`; `_null_foreign_global_owner` gains optional `visible_non_owned_ids`; `is_global` fully retired
- `backend/app/api/kb.py` - `tree_path` resolves + passes the non-owned-visible id set (WR-01) and reuses it for doc scoping; ls/tree node dicts `is_global` -> `is_org_shared` (4 keys)
- `backend/app/services/tool_dispatcher.py` - skills read filter (`.or_(...is_org_shared.eq.true)` x6), SEED-102 tie-break order key, and `attach_skill_file` docstrings/comments renamed `is_global` -> `is_org_shared`; `is_system` unchanged
- `backend/tests/unit/test_165_folder_utils_org_scope.py` - new: 4 org-scope behaviors + WR-01 descendant nulling (no live DB)
- `backend/tests/test_seed091_owner_nulling.py` - folders test rows `is_global` -> `is_org_shared` (predicate rename)
- `backend/tests/test_load_skill_collision.py` - collision-fake rows `is_global` -> `is_org_shared` (rename-induced)

## Decisions Made
- Kept `(supabase, user_id)` public signatures; org resolution is internal so the exit-gate leak test (`get_globally_visible_folder_ids(sb, b["uid"])`, plan 08) drives them unchanged.
- Put the WR-01 subtree broadening in the shared `_null_foreign_global_owner` via an optional param rather than duplicating logic in `kb.py`; skills/views callers (no subtree) keep the shared-row-only rule.
- Left `models/kb.py` (FolderEntry/TreeNode `is_global` fields) to plan 165-03 per the plan's files boundary — the api-layer dict rename here pairs with plan 03's model-field rename in the same Wave 1 (no endpoint exercised until post-migration; dev servers stopped per the plan's W1 note).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test_load_skill_collision.py` broke on the tie-break token rename**
- **Found during:** Task 2 (tool_dispatcher.py `.order("is_global")` -> `.order("is_org_shared")`)
- **Issue:** The SEED-102 collision test uses a sorting fake that genuinely sorts by the recorded `.order()` column. After the rename the code sorts by `is_org_shared`, but the seeded rows still carried `is_global` -> `r.get("is_org_shared")` returned None for both rows -> `None < None` TypeError.
- **Fix:** Renamed the `owned`/`builtin` fake-row keys `is_global` -> `is_org_shared` and updated the docstring prose. Behavior preserved (system > org-shared > owned; `is_system` is the primary key). Not in the plan's `files_modified`, but the breakage was directly caused by this plan's rename.
- **Files modified:** backend/tests/test_load_skill_collision.py
- **Verification:** `pytest tests/test_load_skill_collision.py tests/test_load_skill_override.py tests/unit/test_142_load_skill_flag.py tests/unit/test_151_attach_handler.py tests/unit/test_tool_dispatcher.py` -> 39 passed
- **Committed in:** `48405c4e`

**2. [Rule 3 - Blocking] `test_seed091_owner_nulling.py` folders test referenced the old key**
- **Found during:** Task 2 (`_null_foreign_global_owner` predicate rename `is_global` -> `is_org_shared`)
- **Issue:** The folders test drives `_null_foreign_global_owner` directly with rows keyed `is_global`; after the predicate rename those rows would no longer be nulled, and the plan requires 0 bare `is_global` in `folder_utils.py`. The plan's Task 2 acceptance explicitly sanctions updating this test in-place.
- **Fix:** Renamed the 4 folder rows' `is_global` -> `is_org_shared`. The skills/views tests were left untouched — they drive the INLINE nulling in `skills.py`/`document_view_service.py` (still `is_global`, owned by plan 03/04), NOT the shared helper.
- **Files modified:** backend/tests/test_seed091_owner_nulling.py
- **Verification:** `pytest tests/test_seed091_owner_nulling.py` -> 8 passed (2 pre-existing SEED-091 frontend-flag warnings, by design)
- **Committed in:** `9ea67b38`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking — both rename-induced test updates)
**Impact on plan:** Both are necessary consequences of the sanctioned `is_global` -> `is_org_shared` rename; no scope creep beyond the token rename.

## Issues Encountered
- The project `python` on PATH lacks backend deps; used the backend venv (`backend/venv/Scripts/python.exe`) per CLAUDE.md's venv rule. No other issues.

## Threat Flags
None — no new network endpoint, auth path, or schema surface introduced (schema rename lands in plan 165-10). The threat register's `mitigate` dispositions (T-165-07/08/09/10) are addressed: org-scoped predicate (CR-01), fail-closed empty org set, subtree owner-nulling (WR-01), and unit+import gating of the rename.

## Known Stubs
None.

## Next Phase Readiness
- **Blocked until Wave 2 (plan 165-10):** this code reads the renamed `is_org_shared` / `org_id` columns, which do NOT exist until migration 111 applies. Per the plan's W1 note, dev servers must stay stopped until 165-10 applies the migration + regenerates full-schema. Unit tests run green pre-migration (no live DB).
- **Pairs with plan 165-03** (`models/kb.py` FolderEntry/TreeNode `is_global` -> `is_org_shared`) to make the `/kb/ls` + `/kb/tree` endpoints coherent post-migration.
- **Arbiter is plan 165-08/11:** the live two-org `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` flips `xfail(strict)` -> XPASS -> removed; that is the SC#4 acceptance, not this plan's unit proof.

## Self-Check: PASSED
- `backend/tests/unit/test_165_folder_utils_org_scope.py` exists (created, committed `6102b8df`/`9ea67b38`).
- Modified files present: `folder_utils.py`, `kb.py`, `tool_dispatcher.py`, `test_seed091_owner_nulling.py`, `test_load_skill_collision.py`.
- Commits present in `git log`: `6102b8df`, `48bf71fc`, `9ea67b38`, `48405c4e`.
- Verify green: `test_seed091_owner_nulling.py` + `test_165_folder_utils_org_scope.py` = 14 passed; 0 bare `is_global` (grep -v '^#') across the three source files; imports clean.

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*
