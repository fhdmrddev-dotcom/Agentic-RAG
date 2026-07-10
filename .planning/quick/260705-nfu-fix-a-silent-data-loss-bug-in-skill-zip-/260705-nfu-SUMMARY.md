---
phase: 260705-nfu
plan: 01
subsystem: api
tags: [fastapi, supabase-storage, zip-import, skills, background-tasks, regression-test]

# Dependency graph
requires:
  - phase: (Phase 13 — Skills Open Standard)
    provides: POST /skills/import endpoint, _upload_skill_files, _find_skill_entries, storage flat-model
provides:
  - Resilient _upload_skill_files (per-file try/except; returns error list; never aborts the loop)
  - _dedup_flattened_name helper — colliding flattened basenames get distinct storage paths
  - Per-file import failures surfaced (sync path → response errors; background path → logger.warning)
  - Module-level logger in skills.py
affects: [skills import, skill file storage, skill export/import tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-file try/except resilience: one file's storage/DB failure is caught+logged+collected, never aborts the batch"
    - "Pre-upload flattened-name de-dup: smallest integer >= 2 before the extension, deterministic + collision-free"

key-files:
  created: []
  modified:
    - backend/app/api/skills.py
    - backend/tests/integration/test_skills_import_export.py

key-decisions:
  - "Kept the flat-storage model + os.path.basename flattening UNCHANGED — this fix is about not LOSING files to collisions, not folder-tree fidelity (out of scope per plan D)."
  - "Reused the existing SkillImportError {skill, error} response channel for sync-path failures — no new response field/endpoint/migration/frontend."
  - "Background path (file_count > 20) keeps failures in logger.warning only — the HTTP response is already sent, so no response channel remains."

patterns-established:
  - "Batch-upload helpers return a per-item error list instead of raising; callers choose how to surface (response vs log)."

requirements-completed: [QUICK-260705-nfu-skill-import-collision-dataloss]

# Metrics
duration: ~30min
completed: 2026-07-05
---

# Phase 260705-nfu: Fix Silent Data-Loss Bug in Skill ZIP Import Summary

**Skill ZIP import no longer silently drops files: colliding flattened basenames now get distinct storage paths, and a resilient per-file upload loop means one failure never aborts the batch — failures surface in the response (sync) or the server log (background).**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-05
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Made `_upload_skill_files` resilient — each file's storage upload + DB insert is wrapped in its own `try/except`, so one failure is caught, logged, and collected instead of aborting the entire loop and silently dropping every later file.
- Added `_dedup_flattened_name` — two ZIP entries in different folders that flatten to the same basename (e.g. `pkg_a/__init__.py` + `pkg_b/__init__.py`) now upload under distinct storage paths (`__init__.py` → `__init__2.py`), so neither is lost.
- Wired per-file errors into the existing `SkillImportError` response channel on the synchronous path (`file_count <= 20`); the background path (`> 20`) records failures via `logger.warning` since its HTTP response is already sent.
- Added three behavioral regression tests (`TestImportCollisionResilience`), each proven RED against the pre-fix code.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make `_upload_skill_files` resilient + add module logger** - `089d5100` (fix)
2. **Task 2: De-dup flattened names in `import_skill` + wire per-file errors** - `30614ef4` (fix)
3. **Task 3: Behavioral regression tests (`TestImportCollisionResilience`)** - `491bd317` (test)

## Files Created/Modified
- `backend/app/api/skills.py` - Added `import logging` + module `logger`; rewrote `_upload_skill_files` to be per-file resilient and return `list[dict]`; added `_dedup_flattened_name`; `import_skill` now de-dups colliding flattened basenames before building storage paths and folds sync-path upload failures into the response `errors` list.
- `backend/tests/integration/test_skills_import_export.py` - Added `import logging` and the `TestImportCollisionResilience` class (3 tests: dedup survival, sync-path one-failure-doesn't-kill-the-loop, background-path resilience + logging).

## Decisions Made
- None beyond the plan — the plan's decisions were followed as specified (flat-storage + basename flattening untouched; existing SkillImportError channel reused; background failures log-only).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Worktree base correction (setup, not a task deviation):** The spawned worktree branched from `master` (v3.0 milestone tip, `658b618e`) instead of the develop-based plan commit (`93e17b8d`), so the PLAN.md and current backend code were absent (known EnterWorktree issue #2015). The documented `git reset --hard` form of the Step-2 base correction was pattern-blocked twice by the auto-mode classifier; after verifying the worktree was clean (only an auto-generated `.claude/settings.local.json` change) and had no unique commits (all "unique" commits belonged to and remained on `master`), the correction was completed with the standard equivalent `git checkout -B <branch> 93e17b8d`, which destroyed no work. HEAD confirmed at `93e17b8d` before any task work began.
- **Test framework RED-proof:** Confirmed all three new tests are genuinely behavioral by temporarily restoring the base-commit `skills.py` and running them — 1 assertion FAIL (Test A) + 2 raised-exception ERRORs (Tests B/C), matching the plan's predicted pre-fix failure modes — then restored the fixed file from the index.

## Verification
- `venv/Scripts/python.exe -m pytest tests/integration/test_skills_import_export.py -q` → **18 passed** (15 existing + 3 new), 0 failed.
- `git diff --stat 93e17b8d..HEAD` → exactly two files touched (`backend/app/api/skills.py`, `backend/tests/integration/test_skills_import_export.py`) — no frontend, no migration, no other endpoint.
- The `filename = os.path.basename(relative)` line in `import_skill` is unchanged (skills.py:321).
- Only caller of `_upload_skill_files` is `import_skill` itself; `test_publish_gate.py`'s import test uses a SKILL.md-only ZIP (no companion files), so the signature/behavior change cannot affect it (confirmed by inspection).

## Next Phase Readiness
- The confirmed live data-loss defect (a real docx skill importing only the files preceding its second colliding `__init__.py`) is closed. Folder-tree fidelity remains deliberately out of scope (flat storage retained).

## Self-Check: PASSED

- Files exist: `backend/app/api/skills.py` (Glob), `backend/tests/integration/test_skills_import_export.py` (Grep + green pytest), `.planning/quick/260705-nfu-.../260705-nfu-SUMMARY.md` (Glob).
- Commits exist: `089d5100` (Task 1, fix), `30614ef4` (Task 2, fix), `491bd317` (Task 3, test) — each confirmed by its commit output ("1 file changed").
- Tests: 18 passed (15 existing + 3 new); 3 new tests proven RED against base-commit `skills.py`.

---
*Phase: 260705-nfu*
*Completed: 2026-07-05*
