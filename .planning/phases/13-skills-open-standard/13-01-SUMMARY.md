---
phase: 13-skills-open-standard
plan: 01
subsystem: api
tags: [zipfile, yaml, pydantic, fastapi, streaming-response, import-export, path-traversal]

# Dependency graph
requires:
  - phase: 10-agent-skills-core
    provides: skills/skill_files tables, SkillResponse/SkillFileResponse models, Supabase storage bucket
  - phase: 11-skills-llm-integration
    provides: skill storage patterns (user_id/skill_id/filename path format)

provides:
  - GET /skills/{id}/export — returns application/zip StreamingResponse with SKILL.md + categorized files
  - POST /skills/import — creates skills from single or multi-skill ZIPs, reports per-skill errors
  - SkillImportError and SkillImportResult Pydantic models
  - Helper functions: _mime_to_subdir, _sanitize_zip_name, _parse_skill_md, _find_skill_entries
  - 15 integration tests covering OPEN-01 through OPEN-06

affects: [13-02-skills-open-standard-frontend, 14-frontend-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - StreamingResponse for in-memory ZIP download (io.BytesIO + zipfile.ZipFile)
    - Path traversal sanitization via os.path.normpath + startswith(..) + isabs check
    - Two-phase import: parse all SKILL.md first, then DB writes (OPEN-05 atomicity)
    - /import route registered before /{skill_id} routes to avoid FastAPI path collision

key-files:
  created:
    - backend/tests/integration/test_skills_import_export.py
  modified:
    - backend/app/models/skill.py
    - backend/app/api/skills.py
    - backend/tests/conftest.py

key-decisions:
  - "POST /import registered before PATCH /{skill_id} — FastAPI matches routes top-down; /import would match /{skill_id} if placed after"
  - "Two-phase import: parse all SKILL.md entries before any DB inserts — OPEN-05 atomicity; per-skill parse errors collected in errors[] but do not block other skills"
  - "Path traversal check uses os.path.normpath(name.replace('\\\\', '/')) then startswith('..') OR isabs() — handles both relative traversal and absolute paths"
  - "storage_bucket.download mock added to conftest _make_supabase and reset_mocks — was missing, required for export tests"
  - "Invalid YAML with single SKILL.md returns 400 (not 201 with empty created[]) — better UX for total failure case"

patterns-established:
  - "Pattern: ZIP assembly uses io.BytesIO buffer + zipfile.ZipFile context manager; buf.seek(0) then StreamingResponse"
  - "Pattern: SKILL.md frontmatter delimited by --- ; split on '---' max 2 times gives [pre, yaml, body]"
  - "Pattern: MIME-type subdirectory mapping: text/x-python -> scripts/, image/* -> assets/, all else -> references/"

requirements-completed: [OPEN-01, OPEN-02, OPEN-03, OPEN-04, OPEN-05, OPEN-06]

# Metrics
duration: 4min 10sec
completed: 2026-04-02
---

# Phase 13 Plan 01: Skills Open Standard — Export and Import Endpoints Summary

**ZIP-based skill export (GET /skills/{id}/export) and import (POST /skills/import) with SKILL.md frontmatter, MIME-type file categorization, bulk multi-skill support, and path traversal rejection**

## Performance

- **Duration:** 4 min 10 sec
- **Started:** 2026-04-02T18:30:28Z
- **Completed:** 2026-04-02T18:34:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Export endpoint assembles an in-memory ZIP with SKILL.md (YAML frontmatter: name, description, license=MIT, compatibility=1.0) and categorized building-block files (scripts/, assets/, references/) streamed as application/zip
- Import endpoint parses single and multi-skill ZIPs atomically (all SKILL.md parsed before any DB writes), reports per-skill errors, rejects path traversal filenames, enforces 10 MB size limit
- 15 integration tests cover all six OPEN requirements with mock-based assertions on storage and DB calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Pydantic models, helper functions, export endpoint, and TDD tests** - `4a1d372` (feat)
2. **Task 2: Import endpoint with bulk support, atomicity, and path traversal safety** - `f11017d` (feat)

## Files Created/Modified

- `backend/app/models/skill.py` - Added SkillImportError and SkillImportResult Pydantic models
- `backend/app/api/skills.py` - Added imports (io, os, zipfile, yaml, StreamingResponse), 4 helper functions, export endpoint, import endpoint
- `backend/tests/conftest.py` - Added storage_bucket.download mock in _make_supabase and reset_mocks
- `backend/tests/integration/test_skills_import_export.py` - New file; 15 tests for OPEN-01 through OPEN-06

## Decisions Made

- POST /import registered before PATCH /{skill_id} to avoid FastAPI path-parameter collision (route ordering is first-match-wins)
- Two-phase import (parse-all then insert-all) satisfies OPEN-05 atomicity — failed skills are reported in errors[] without blocking successfully parsed ones
- Path traversal check normalized with replace("\\", "/") before normpath to handle Windows separator edge cases
- Download mock added to conftest because existing mock only covered upload/remove; export endpoint requires download

## Deviations from Plan

None — plan executed exactly as written. Import endpoint was placed before path-param routes as instructed. Storage mock was added exactly as specified in the task action.

## Issues Encountered

Pre-existing test failures in `test_folders.py` (409 Conflict), `test_threads.py` (list.get() AttributeError), and `test_explorer_agent.py` were present before this plan's changes. These are out of scope for Phase 13 Plan 01 and logged for deferred investigation.

## Known Stubs

None — all endpoints are fully wired to Supabase DB and Storage.

## User Setup Required

None — no new environment variables or external service configuration required.

## Next Phase Readiness

- Export and import backend endpoints are complete and tested
- Phase 13 Plan 02 (frontend) can now wire exportSkill() and importSkill() API calls to SkillCard and SkillsPage
- Pre-existing test failures in folders/threads/explorer-agent modules should be investigated before phase gate

---
*Phase: 13-skills-open-standard*
*Completed: 2026-04-02*
