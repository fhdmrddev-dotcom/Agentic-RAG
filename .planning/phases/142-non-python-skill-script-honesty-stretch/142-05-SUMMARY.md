---
phase: 142-non-python-skill-script-honesty-stretch
plan: 05
subsystem: api
tags: [skills, import, zip, honesty, fastapi, react, typescript, vitest, pytest]

# Dependency graph
requires:
  - phase: 142-01
    provides: "SCRIPT_EXTS module-scope constant (non-Python script-extension set) in tool_dispatcher.py"
provides:
  - "import_skill attaches a non-blocking notes[] (one entry per skill that bundles a non-Python script) on BOTH the 201 sync and 202 background response bodies"
  - "SkillImportResult.notes? optional TS field so consumers can surface it"
  - "buildImportMessage() pure helper that appends the honesty note onto the existing muted import line (no new component)"
affects: [skills-import, skill-runtime-honesty, DISC-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static ZIP-extension scan over already-_sanitize_zip_name-validated entries (splitext(basename) only — no new traversal surface, T-142-03)"
    - "Additive OPTIONAL response key on both endpoint branches so existing consumers ignore it (Pitfall 5)"
    - "Pure message-builder extracted from a component for isolated vitest unit-testing (buildImportMessage)"

key-files:
  created:
    - "frontend/src/pages/SkillsPage.import.test.tsx"
  modified:
    - "backend/app/api/skills.py"
    - "backend/tests/integration/test_skills_import_export.py"
    - "frontend/src/lib/api.ts"
    - "frontend/src/pages/SkillsPage.tsx"

key-decisions:
  - "Imported SCRIPT_EXTS from tool_dispatcher at module scope (single source, Plan 01) — no circular import (tool_dispatcher never imports app.api.skills); confirmed by the app booting under pytest"
  - "Collected the pre-dedup flat basename for the user-facing note (most meaningful filename), de-duplicated per skill; the note names the exact bundled script(s)"
  - "Extracted buildImportMessage as an exported pure function so the frontend test avoids mounting the heavy page graph (only @/lib/supabase stubbed)"

patterns-established:
  - "Import-time runtime-gap honesty = G-B static extension scan only (D-10); G-A/G-C surface at runtime via Plan 02"
  - "Non-blocking honesty note = additive JSON key computed defensively, never blocks the import (D-08/D-12)"

requirements-completed: [SRH-01]

# Metrics
duration: 12min
completed: 2026-07-08
---

# Phase 142 Plan 05: Import-Time Non-Python Script Honesty Note Summary

**Skill ZIP import now succeeds and returns a non-blocking `notes[]` entry when a skill bundles a non-Python script (e.g. `helper.js`), surfaced on the existing muted SkillsPage import line — all-Python bundles produce no note.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-08T01:00:00Z (approx)
- **Completed:** 2026-07-08T01:10:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified + 1 created)

## Accomplishments
- Backend: `import_skill` runs a static `SCRIPT_EXTS` extension scan over the already-sanitized ZIP entries during its existing per-skill loop and attaches a per-skill `{skill, note}` entry to a `notes[]` list on BOTH the 201 sync and 202 background responses. Import still succeeds regardless (D-08, non-blocking).
- Frontend: `SkillImportResult.notes?` optional field + `buildImportMessage()` pure helper that appends ` Note: {note}` onto the existing muted `importMessage` line — no new UI component (D-09, G-2 does not fire).
- Tests: 3 new backend integration tests (js → note on 201; script bundle → note on 202 background; all-Python → no note) + 5 new frontend unit tests for the message builder.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend the import test — note for a .js ZIP on both 201 and 202 paths** - `4b071513` (test)
2. **Task 2: Add the static ext-scan note to import_skill (both response branches)** - `3457e1ab` (feat)
3. **Task 3: Render the import note in SkillsPage (type + handleImport append + frontend test)** - `5efc5d19` (feat)

## Files Created/Modified
- `backend/app/api/skills.py` - Imports `SCRIPT_EXTS`; initializes `notes: list[dict]`; per-skill `splitext(basename)` scan collecting non-Python script names; appends `{skill, note}` when a skill bundles ≥1 script; adds the `"notes"` key to the 202 JSONResponse and the 201 return dict.
- `backend/tests/integration/test_skills_import_export.py` - `test_import_note_for_js`, `test_no_note_for_all_python`, `test_note_on_background_path` in `TestImportSkill`.
- `frontend/src/lib/api.ts` - `SkillImportResult.notes?: Array<{ skill: string; note: string }>` (optional, additive).
- `frontend/src/pages/SkillsPage.tsx` - Exported `buildImportMessage()` pure helper (appends the note onto the muted line); `handleImport` now calls it.
- `frontend/src/pages/SkillsPage.import.test.tsx` - 5 unit tests for `buildImportMessage` (note present → "Note:"; absent/empty → plain; mixed created+failed still notes; no-skills → error), authored to pass at HEAD (SEED-056).

## Decisions Made
- **SCRIPT_EXTS single source:** module-scope import from `app.services.tool_dispatcher` (Plan 01). No circular import — the app booted cleanly under pytest, confirming `tool_dispatcher` does not import `app.api.skills`.
- **Note names the pre-dedup flat basename** (the meaningful filename the user recognizes), de-duplicated per skill.
- **Pure helper for testability:** `buildImportMessage` extracted so the frontend test unit-tests the exact render-path logic without mounting `SkillsPage` (only `@/lib/supabase` stubbed to prevent real client construction at import time).

## Deviations from Plan

None - plan executed exactly as written. All three tasks' verifications passed on the specified commands; no Rule 1/2/3/4 deviations were required.

## Issues Encountered
- `frontend/package-lock.json` shows a large pre-existing dependency-version churn in the working tree, unrelated to this plan (transitive dev-dep bumps such as `@adobe/css-tools`). Left unstaged per scope boundary — none of this plan's commits touch it. `frontend/test-results/` (Playwright artifacts dated Jul 5) is gitignored and was not committed.

## User Setup Required
None - no external service configuration required. No migration, no schema, no new dependency.

## Next Phase Readiness
- SC#1/D-08 (the only user-facing surface of Phase 142) is complete. G-A/G-C runtime honesty is delivered separately by Plan 02 (reactive reshape) and Plan 04 (proactive tool-description facts).
- No blockers introduced.

## Verification
- `cd backend && venv/Scripts/python -m pytest tests/integration/test_skills_import_export.py -q` → **21 passed** (incl. the 3 new note tests: 201 + 202 + all-python-none).
- `cd frontend && npm run test -- SkillsPage.import` → **5 passed**.
- `cd frontend && npx tsc --noEmit` → no new errors from `api.ts` / `SkillsPage.tsx` / `SkillsPage.import.test.tsx`.
- `git diff` confirms the additive `notes` key on both backend branches, the optional `notes?` type, and the muted-line append — no new UI component (D-09), no flatten/dedup/mime change (D-02).

## Self-Check: PASSED

- All 5 code/test files + the SUMMARY exist on disk.
- All 3 task commits (`4b071513`, `3457e1ab`, `5efc5d19`) present in git history.

---
*Phase: 142-non-python-skill-script-honesty-stretch*
*Completed: 2026-07-08*
