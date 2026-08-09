---
phase: 164-secdef-audit-cross-org-isolation-test-suite
plan: 02
subsystem: api
tags: [rls, seed-091, serialize, pydantic, fastapi, owner-nulling, multi-tenancy, ten-06]

# Dependency graph
requires:
  - phase: 163-rls-rewrite-user-jwt-client-swap
    provides: membership-RLS baseline + is_global/is_system live column semantics (mig 108/109)
provides:
  - "Shared _null_foreign_global_owner(rows, caller) serialize helper (folder_utils.py) — the single uniform SEED-091 rule reused by folders + kb tree paths"
  - "Non-owner readers get user_id=None on global/system skills, folders, and views serialize paths (+ folder_scope=None on global views)"
  - "skill_files list serializer nulls the foreign owner on a non-owner's read of a global skill's files (A3 confirmed)"
  - "FolderResponse.user_id / SkillResponse.user_id / SkillFileResponse.user_id loosened to UUID | None"
  - "tests/test_seed091_owner_nulling.py — DB-independent unit proof of the null-on-non-owner contract across all three surfaces"
affects: [165-is_global-retirement, 166-org-admin-shell, frontend-types-follow-up]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serialize-time owner-identity projection: RLS gates rows, one shared helper nulls the foreign owner column uniformly across surfaces (Shared Pattern C)"
    - "Pure unit test drives the REAL list_skills / list_views over a no-DB fake supabase client (both bottom out at a sync .execute() returning .data)"

key-files:
  created:
    - backend/tests/test_seed091_owner_nulling.py
  modified:
    - backend/app/utils/folder_utils.py
    - backend/app/api/skills.py
    - backend/app/api/folders.py
    - backend/app/api/kb.py
    - backend/app/services/document_view_service.py
    - backend/app/models/folder.py
    - backend/app/models/skill.py

key-decisions:
  - "A3 RESOLVED (loosen + null): list_skill_files DOES surface a foreign owner (non-owner reaches it via the is_global branch), so SkillFileResponse.user_id loosened to UUID | None and nulled inline keyed on the PARENT skill's ownership (skill_files has no is_global column)"
  - "kb.py seam: apply _null_foreign_global_owner in tree_path (which drives _serialize_tree) on the raw folder rows before they become nodes — _serialize_tree is recursive/per-node and its output omits user_id, so this is defense-in-depth + contract uniformity"
  - "Frontend NOT edited (plan: 'no UI build'): Folder.user_id / Skill.user_id are hard-required `string` — FLAGGED as a follow-up to loosen to `string | null`, not silently passed"

patterns-established:
  - "Shared Pattern C (SEED-091): one _null_foreign_global_owner rule ((is_global OR is_system) AND not-owner) so the folders/skills/views serialization contract cannot diverge"

requirements-completed: [TEN-06]

# Metrics
duration: ~30min
completed: 2026-07-20
---

# Phase 164 Plan 02: SEED-091 Owner-Identity Nulling (TEN-06) Summary

**Global/system-shared folders, skills, and views now null the seeding owner's `user_id` (and views' `folder_scope` UUID) for non-owner readers — one shared serialize rule, three model loosens, a DB-independent 6/6 unit proof.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-20
- **Completed:** 2026-07-20
- **Tasks:** 2 (both tdd-flagged; implement-then-prove per the plan's task decomposition)
- **Files modified:** 7 (+1 created)

## Accomplishments
- Added the single shared `_null_foreign_global_owner(rows, caller)` helper implementing the D-164-05 rule (`(is_global OR is_system) AND str(user_id) != caller → user_id = None`), reused by `folders.py` (both list endpoints) and `kb.py` tree path.
- Nulled the foreign global/system owner inline in `skills.py` `list_skills` (keeps the `is_system` OR-branch — the built-in skill-creator is the cross-org-visible surface today) and in `document_view_service.list_views` (additionally nulling `folder_scope`, the views-only scope UUID — D-164-05).
- Confirmed A3: `list_skill_files` surfaces a foreign owner on a non-owner's read of a global skill's files → loosened `SkillFileResponse.user_id` and nulled it there, keyed on the parent skill's ownership.
- Loosened `FolderResponse.user_id` and `SkillResponse.user_id` to `UUID | None` (mirroring the already-nullable `ViewResponse.user_id`).
- Wrote a pure (no-DB) unit test proving the null-on-non-owner contract across all three surfaces — 6/6 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Null the foreign global/system owner in skills/views/folders serialize paths + loosen the two (three) models** - `07840986` (feat)
2. **Task 2: Unit-test the null-on-non-owner serialize contract + frontend TS null-owner UI-contract check** - `2acf3934` (test)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + deferred-items)

_Note: the plan decomposed the TDD feature as implement (Task 1) → prove (Task 2); both tasks carry tdd="true"._

## Files Created/Modified
- `backend/app/utils/folder_utils.py` - New `_null_foreign_global_owner` shared helper (the canonical D-164-05 rule).
- `backend/app/api/skills.py` - `list_skills` dedup loop nulls foreign global/system owner; `list_skill_files` nulls foreign owner on file rows (A3).
- `backend/app/api/folders.py` - `list_folders` + `list_children` route their output through the shared helper.
- `backend/app/api/kb.py` - `tree_path` nulls foreign global owner on folder rows before tree-node construction (helper imported).
- `backend/app/services/document_view_service.py` - `list_views` nulls `user_id` AND `folder_scope` on non-owned global views.
- `backend/app/models/folder.py` - `FolderResponse.user_id: UUID → UUID | None`.
- `backend/app/models/skill.py` - `SkillResponse.user_id` and `SkillFileResponse.user_id → UUID | None`.
- `backend/tests/test_seed091_owner_nulling.py` - **Created.** Pure unit proof (folders via helper; skills/views via the real endpoints over a no-DB fake) + frontend UI-contract locate/flag.

## Decisions Made
- **A3 (skill-files) → loosen + null.** Evidence: `list_skill_files` (`skills.py:668`) gates access via `or_(user_id.eq.{caller},is_global.eq.true)` and returns raw `skill_files` rows including `user_id`. A non-owner only reaches it via the `is_global` branch, so every file row would leak the seeding owner's id. Since `skill_files` carries no `is_global`/`is_system` column, the null is keyed on the already-fetched parent skill's ownership (`str(skill.data["user_id"]) != str(caller)`), and `SkillFileResponse.user_id` was loosened to `UUID | None`.
- **kb.py helper placement.** The `_serialize_tree` output dict does NOT currently expose `user_id`, and the function is recursive/per-node without a caller-id parameter. The helper is applied in `tree_path` on the flat `all_folders` list before `_build_tree_map` copies them into nodes — correct, uniform (same shared rule), and defense-in-depth (any future exposure of `user_id` in the tree output is already nulled for non-owners). Satisfies the acceptance grep (≥3 call sites + 1 def).
- **`ViewResponse.user_id` left unchanged** — already `str | None` (`document_view.py:87`); it is the reference shape the two other models were loosened to match.

## Deviations from Plan

None - plan executed exactly as written. (The A3 skill-files loosen+null and the kb.py `tree_path` seam are plan-authorized discretion points, documented under Decisions Made — not deviations.)

## Issues Encountered

- **2 pre-existing 163 RLS suite failures surfaced during the no-regression check** (`pytest tests/integration -k "163"` → 2 failed / 101 passed): `test_163_rls_dm.py::test_global_rule_renders_for_comember_not_cross_org` and `test_163_rls_workflow_eval.py::test_global_workflow_def_renders_for_comember_not_cross_org`. Both are raw `SELECT count(*)` asyncpg assertions on `classification_rules` / `workflow_definitions` cross-org visibility — a live-DB RLS-state concern with ZERO execution path through this plan's diff (verified: `git show --name-only 07840986` = 7 serialize/model files only). **Out of scope** (scope-boundary rule): logged to `deferred-items.md` (D-164-02-A), not fixed. Does not block 164-02 — the SEED-091 unit gate is DB-independent and passes 6/6.

## Frontend Follow-up (A5 — FLAGGED, not fixed)

`frontend/src/types/index.ts` — both `Folder.user_id` (`:451`) and `Skill.user_id` (`:495`) are the HARD-REQUIRED `string` type. The backend now returns `null` for non-owner readers of global/system rows. **Follow-up:** loosen both to `string | null`. This plan is backend-only ("no UI build"), and a null owner is inert for the owner-gated `user_id === me.id` affordance checks (a `===` on null is simply false → owner affordances correctly hidden), so this is a forward follow-up, not a blocker. The unit test (`test_frontend_owner_field_located_and_flagged`) locates + warns on this and asserts the current state so a reviewer sees it explicitly.

## Threat Mitigation

- **T-164-ID-05 (Information Disclosure — mitigate):** the folders/skills/views list serializers no longer expose the seeding owner's `user_id` (+ view scope UUID) to non-owner readers. Mitigated via one shared `_null_foreign_global_owner` rule and unit-proved in `test_seed091_owner_nulling.py`. No new security surface introduced (serialize-output narrowing only).

## Known Stubs

None — the `user_id = None` nulling is intentional security behavior (owner-identity projection), not a placeholder/stub.

## Next Phase Readiness
- TEN-06 (SEED-091) closed for the three list/serialize surfaces; the milestone exit-gate suite (`test_v3_4_org_isolation.py`, Plan 164-01) is unaffected.
- Remaining Phase 164 work is disjoint: Plan 164-03 (migration 110 — DEFINER org-scope audit) and Plan 164-04 (producer asyncpg client swap + `kb.py` grep-regex deletion). Note: 164-04 also edits `kb.py` (a different concern — the grep `_inject_user_id_for_grep` deletion) and runs in a later wave; this plan's `kb.py` edit is the tree serialize import + `tree_path` call only.
- Frontend TS owner-field loosening carried as an A5 follow-up (see above).

## Self-Check: PASSED

- FOUND: `backend/tests/test_seed091_owner_nulling.py`
- FOUND: `164-02-SUMMARY.md`, `deferred-items.md`
- FOUND commit: `07840986` (feat, Task 1)
- FOUND commit: `2acf3934` (test, Task 2)
- Verify: import check exits 0; `pytest tests/test_seed091_owner_nulling.py` → 6 passed (2 intentional frontend-flag warnings).

---
*Phase: 164-secdef-audit-cross-org-isolation-test-suite*
*Completed: 2026-07-20*
