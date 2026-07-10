---
phase: 132-skill-versioning-eval-test-case-persistence
verified: 2026-06-30T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 132: Skill Versioning + Eval Test-Case Persistence — Verification Report

**Phase Goal:** A skill author can build a persistent, editable set of eval test cases for a skill, and every save of a skill's instructions captures an immutable version snapshot so eval history is traceable to the exact instruction state.
**Verified:** 2026-06-30
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Creating or updating a skill's instructions automatically captures an immutable version snapshot; a later edit never overwrites earlier history (VER-01 SC#1) | VERIFIED | `capture_skill_version()` trigger fires `AFTER INSERT OR UPDATE ON public.skills` with IS DISTINCT FROM guard on name/description/instructions trifecta. BEFORE UPDATE block trigger on `skill_versions` raises SQLSTATE 23514. `test_insert_captures_v1` PASSED, `test_content_change_captures_new_version` PASSED, `test_version_update_blocked` PASSED against live DB. |
| 2 | A user can define a set of test cases for a skill (prompt + expected-behavior) and save them; the cases persist across sessions / survive reload (EVAL-01 SC#2) | VERIFIED | `skill_test_cases` table with stable UUID PK, skill_id FK, free-text expected_behavior (D-06), no provider/model columns (D-08). POST `/skills/{id}/test-cases` → 201. `test_create_persists_and_list_ordered` PASSED. `SkillTestCasesSection` reloads from API after every mutation. |
| 3 | A user can edit or delete a saved test case before any eval run, and the change persists (EVAL-01 SC#3) | VERIFIED | PATCH `/test-cases/{case_id}` with `model_dump(exclude_none=True)` (only-supplied fields change, updated_at advances). DELETE → 204. `test_patch_persists_supplied_fields_only` PASSED, `test_delete_removes_row` PASSED. Frontend handleSave/handleDelete both reload after mutation. Operator G-4 UAT confirmed (2026-06-30). |
| 4 | Every test case and version snapshot is owner-scoped; a user never sees another user's cases or versions (VER-01 + EVAL-01 SC#4) | VERIFIED | Owner-only RLS on both tables (NO is_global branch, D-12). `.eq("user_id", current_user["id"])` on all 5 routes in `skill_test_cases.py`. POST parent-skill gate via `_verify_owned_skill()`. `test_owner_scope_isolation` PASSED: user B gets 404/empty for user A's cases, PATCH, DELETE, POST, and versions. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/079_skill_versions_and_test_cases.sql` | Both tables, capture trigger, append-only block trigger, owner-only RLS, v1 backfill | VERIFIED | 218 lines. Contains: skill_versions + skill_test_cases CREATE TABLE, capture_skill_version() AFTER INSERT OR UPDATE trigger, skill_versions_no_update BEFORE UPDATE trigger (23514), owner-only RLS (4 policies on test_cases, 1 on versions), INSERT…SELECT backfill with source='backfill'. |
| `supabase/full-schema.sql` | Regenerated live-DB dump containing skill_versions | VERIFIED | 34 occurrences of 'skill_versions' confirmed. Regenerated no-reset per CLAUDE.md. |
| `backend/tests/integration/test_132_skill_versions.py` | 6 live-DB tests for VER-01 trigger/immutability/backfill | VERIFIED | 6/6 PASSED against live DB at :54322. Covers: insert→v1, content→v2, toggle-skip, UPDATE-blocked (23514), backfill semantics, UNIQUE 23505. Rolled-back tx (no dev-data mutation). :54322-unreachable and 079-unapplied clean-skip guards present. |
| `backend/app/models/skill_test_case.py` | TestCaseCreate / TestCaseUpdate / TestCaseResponse Pydantic models | VERIFIED | All three classes exported. TestCaseUpdate all-optional. No provider/model fields (D-08). expected_behavior free text (D-06). |
| `backend/app/models/skill_version.py` | SkillVersionResponse Pydantic model (read-only) | VERIFIED | SkillVersionResponse with version_number, source, created_at. No create/update model (versions are trigger-created). |
| `backend/app/api/skill_test_cases.py` | Owner-scoped CRUD router + read-only version-history GET | VERIFIED | 183 lines. 5 routes (GET/POST /skills/{id}/test-cases, PATCH/DELETE /test-cases/{id}, GET /skills/{id}/versions). `.eq("user_id", current_user["id"])` on every query. `_verify_owned_skill()` parent gate on POST. No write route for /versions. |
| `backend/app/main.py` | skill_test_cases registered via include_router | VERIFIED | Line 423: combined import includes `skill_test_cases`. Line 446: `app.include_router(skill_test_cases.router)` with Phase 132 EVAL-01/VER-01 comment. |
| `backend/tests/integration/test_132_test_cases.py` | CRUD persistence + owner-scope isolation coverage | VERIFIED | 5/5 PASSED. Includes test_owner_scope_isolation (user B 404/empty for all of user A's resources). In-memory fake supabase genuinely honors `.eq()` filters. |
| `frontend/src/components/skills/SkillTestCasesSection.tsx` | Thin test-case editor + version-history read | VERIFIED | ~218 lines. Uses all 5 api.ts client functions (listTestCases, createTestCase, updateTestCase, deleteTestCase, listSkillVersions). Add/edit/delete with reload-after-mutation. Read-only version list (v{n} · source · date). Thin/functional — Input/Textarea/Button only, no panel chrome. |
| `frontend/src/lib/api.ts` | 5 client functions for test-case CRUD and version list | VERIFIED | listTestCases, createTestCase, updateTestCase, deleteTestCase, listSkillVersions all present, each using getAuthHeaders + fetch + typed json cast pattern. |
| `frontend/src/types/index.ts` | TestCase, TestCaseCreate, TestCaseUpdate, SkillVersion types | VERIFIED | All 4 types exported (lines 529-565). Match backend Pydantic shapes byte-for-byte (snake_case). No provider/model fields. |
| `frontend/src/components/skills/SkillFormDialog.tsx` | SkillTestCasesSection mounted for existing skills | VERIFIED | Line 14: `import { SkillTestCasesSection } from "./SkillTestCasesSection"`. Lines 534-538: mounted inside SkillDetailPanel gated on `savedSkillId`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `public.skills` (INSERT/UPDATE) | `public.skill_versions` | `AFTER INSERT OR UPDATE` trigger `skills_capture_version` | VERIFIED | Trigger confirmed in migration 079. IS DISTINCT FROM guard on name/description/instructions trifecta. Source='manual'. user_id=NEW.user_id (never auth.uid()). |
| `capture_skill_version()` | `skill_versions.user_id` | `NEW.user_id` (not auth.uid() — NULL under service-role, D-03-R3) | VERIFIED | Line 132 of migration: `(NEW.id, NEW.user_id, next_num, ...)`. test_insert_captures_v1 asserts `r["user_id"] == uid`. |
| `backend/app/main.py` | `skill_test_cases.router` | `app.include_router(skill_test_cases.router)` | VERIFIED | Line 446 of main.py. Combined import on line 423. |
| `skill_test_cases.py` routes | `skill_test_cases` / `skill_versions` tables | `.eq("user_id", current_user["id"])` on every query | VERIFIED | Confirmed on all 5 routes. POST additionally gates via `_verify_owned_skill()`. |
| `SkillTestCasesSection.tsx` | `/skills/{id}/test-cases` + `/test-cases/{id}` + `/skills/{id}/versions` | `api.ts` client functions | VERIFIED | All 5 imports confirmed (lines 21-26 of SkillTestCasesSection.tsx). Used in handleAdd, handleSave, handleDelete, and reload(). |
| `SkillFormDialog.tsx` (SkillDetailPanel) | `SkillTestCasesSection` | mounted for `savedSkillId` | VERIFIED | Import confirmed line 14; mount at lines 534-538 gated on `savedSkillId`. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SkillTestCasesSection.tsx` | `cases` (TestCase[]) | `listTestCases(skillId)` → GET /skills/{id}/test-cases → `skill_test_cases` table | Yes — owner-scoped supabase query `.eq("skill_id", …).eq("user_id", …).order("order_index")` returns real rows. | FLOWING |
| `SkillTestCasesSection.tsx` | `versions` (SkillVersion[]) | `listSkillVersions(skillId)` → GET /skills/{id}/versions → `skill_versions` table | Yes — owner-scoped supabase query `.eq("skill_id", …).eq("user_id", …).order("version_number", desc=True)` returns real rows (trigger-captured + backfill). | FLOWING |
| Postgres trigger | `skill_versions` rows | `capture_skill_version()` fires on `public.skills` INSERT/UPDATE | Yes — live-DB tests confirm v1 on INSERT, v2 on content UPDATE, toggle-skip, and backfill rows. 6/6 PASSED. | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| VER-01: 6 trigger/immutability/backfill tests pass | `pytest tests/integration/test_132_skill_versions.py -v` | 6 passed | PASS |
| EVAL-01: CRUD + owner-scope isolation tests pass | `pytest tests/integration/test_132_test_cases.py -v` | 5 passed | PASS |
| Router registered and importable | `python -c "from app.api import skill_test_cases"` | OK (no import error) | PASS |
| Pydantic models importable | `python -c "from app.models.skill_test_case import TestCaseCreate"` | OK | PASS |

---

### Probe Execution

Step 7c: No declared probes in PLAN.md files. Phase is a schema + CRUD phase (no `probe-*.sh` pattern applicable). Behavioral spot-checks above substitute as the functional gate.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VER-01 | 132-01, 132-02, 132-03 | Immutable skill version capture on content change; skip on toggle; backfill for existing skills; append-only | SATISFIED | Migration trigger + 6 live-DB tests pass + read-only version-history API + frontend display |
| EVAL-01 | 132-01, 132-02, 132-03 | Persistent, editable eval test cases (prompt + expected-behavior) bound to skill, surviving reload; owner-scoped | SATISFIED | skill_test_cases table + 5 CRUD route tests pass + thin frontend editor + operator G-4 UAT passed |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TBD/FIXME/XXX markers in any phase-132 files | — | — |

**Pre-existing rot (explicitly excluded from phase verdict):**
- 29 frontend `tsc -b` errors in unrelated files (streamsStore.ts, SettingsPage.tsx, NavPanel.tsx, test files, etc.) — confirmed pre-existing by stash-compare (29 == 29 with/without Plan 03 changes). Tracked as SEED-056.
- 124 pre-existing backend test failures in unrelated subsystems (test_threads_skills.py tool-count mismatch, sql_service, sandbox_service, retrieval_service, streaming_reliability, test_077 collection error). None reference skill_test_cases/skill_versions. Tracked as 075.4-TEST-TRIAGE.

---

### Human Verification Required

**G-4 operator end-to-end UAT — COMPLETED (2026-06-30).**

The operator confirmed "verified" for Plan 03 Task 3 (checkpoint:human-verify, gate=blocking):
- "Eval test cases" section appears in the skill detail panel.
- Add test case persists across reload; edit persists; delete removes.
- Version history shows `v1 · backfill`; changing instructions adds `v2 · manual`; toggling enabled/global adds NO version (D-02 confirmed).
- Owner-scope: only own cases/versions shown.

No pending human verification items.

---

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are VERIFIED by codebase evidence and passing tests. The phase goal is achieved.

---

## Verification Details

### VER-01 Deep-Dive

The version-capture mechanism is implemented as a zero-app-code Postgres trigger (`capture_skill_version`, AFTER INSERT OR UPDATE ON public.skills), making it safe-by-construction across all 6 write paths (create_skill POST, update_skill PATCH, import_skill, toggle-enabled, toggle-global, Trigger Tuner author-confirm PATCH). The trigger's IS DISTINCT FROM guard on the name/description/instructions trifecta correctly skips toggle-only updates (confirmed by `test_toggle_does_not_version`). Append-only immutability is enforced by a BEFORE UPDATE block trigger raising SQLSTATE 23514 (no BEFORE DELETE trigger, so FK cascade correctly removes versions when the skill is deleted, D-03-R2). The UNIQUE(skill_id, version_number) constraint turns concurrent max+1 collisions into retryable 23505 errors (T-132-04). user_id is sourced from NEW.user_id, never auth.uid() which is NULL under the service-role writer (D-03-R3, confirmed by test assertion). The v1 backfill correctly populates existing skills with source='backfill' without triggering a double-capture.

### EVAL-01 Deep-Dive

The skill_test_cases table binds cases to the skill (not a version, D-07), allowing free edit/delete before any eval run. The backend router enforces the owner gate via `.eq("user_id", current_user["id"])` on every query — this is the sole runtime leak control since the service-role client bypasses RLS (077 precedent). The POST route additionally verifies parent skill ownership via `_verify_owned_skill()` before inserting. The owner-scope isolation test (test_owner_scope_isolation) confirms user B receives 404 or empty for all of user A's resources across all 5 route types. The frontend SkillTestCasesSection component is thin/functional (no designed panel structure, no new design-system primitives), gated on savedSkillId, and correctly reloads from the API after every mutation.

### SEED-097 (run_in_threadpool backfill)

The new router mirrors the prevailing `skills.py` convention of calling the sync supabase client inline inside async handlers (no run_in_threadpool). This is accepted tech-debt per operator confirmation during plan-checking; the holistic backfill across all routers is tracked as SEED-097. This is NOT a phase regression.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
