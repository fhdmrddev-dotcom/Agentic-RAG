---
phase: 13-skills-open-standard
plan: 02
subsystem: frontend
tags: [react, typescript, api, import-export, file-download, form-data, skills]

# Dependency graph
requires:
  - phase: 13-01
    provides: GET /skills/{id}/export and POST /skills/import backend endpoints

provides:
  - exportSkill(id, name) — triggers ZIP download via blob URL
  - importSkillZip(file) — POSTs FormData to /skills/import, returns SkillImportResult
  - SkillImportResult interface — typed { created: Skill[], errors: Array<{skill, error}> }
  - Export button on owner SkillCards with loading/spinner state
  - Import Skill button in SkillsPage header with hidden file input and feedback message

affects: [frontend-ui, skills-open-standard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Blob URL download pattern (createObjectURL + anchor click + revokeObjectURL)
    - FormData POST without Content-Type header (browser sets multipart/form-data with boundary automatically)
    - useRef<HTMLInputElement> for hidden file input trigger via button click
    - Post-import list refresh via exposed loadSkills from useSkills hook

key-files:
  created: []
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/skills/SkillCard.tsx
    - frontend/src/pages/SkillsPage.tsx
    - frontend/src/hooks/useSkills.ts

key-decisions:
  - "exportSkill uses getAuthToken() not getAuthHeaders() — must not set Content-Type: application/json on blob download request"
  - "importSkillZip uses getAuthToken() not getAuthHeaders() — FormData sets its own Content-Type with multipart boundary; explicit header would break it"
  - "loadSkills exposed from useSkills return value — SkillsPage needs to re-fetch after import; internal function promoted to public interface"
  - "Export button placed before Edit (Pencil) in owner actions row per UI-SPEC ordering"

# Metrics
duration: 2min 27sec
completed: 2026-04-02
---

# Phase 13 Plan 02: Skills Open Standard — Export and Import UI Summary

**Export button on SkillCards (owner-only, Download icon with spinner) and Import Skill button in SkillsPage header (.zip file picker with inline feedback), wired to backend ZIP endpoints**

## Performance

- **Duration:** 2 min 27 sec
- **Started:** 2026-04-02T18:38:31Z
- **Completed:** 2026-04-02T18:41:00Z
- **Tasks:** 1 implementation task + 1 human-verify checkpoint
- **Files modified:** 4

## Accomplishments

- Added `exportSkill()` and `importSkillZip()` to `api.ts` — `exportSkill` triggers a browser download via Blob URL, `importSkillZip` sends FormData without setting Content-Type (browser adds multipart boundary automatically)
- Exported `SkillImportResult` interface (`{ created: Skill[], errors: Array<{skill, error}> }`) in `api.ts`
- Added Export button (Download icon, Loader2 spinner during export) to `SkillCard` owner-only actions section, placed before Edit (Pencil) per UI-SPEC
- Added Import Skill button (Upload icon, "Importing..." spinner state) to `SkillsPage` header with hidden `<input type="file" accept=".zip">` wired via `useRef`
- Import handler shows inline success/error message (cleared after 5s) and re-fetches skills list via `loadSkills()`
- Exposed `loadSkills` from `useSkills` return object to enable SkillsPage re-fetch after import

## Task Commits

Each task was committed atomically:

1. **Task 1: Add API functions and wire export/import into SkillCard, SkillsPage, and useSkills** - `1db52b5` (feat)
2. **Task 2: Verify export and import in browser** - Human-verified (approved — export creates ZIP with SKILL.md, import round-trips correctly)

## Files Created/Modified

- `frontend/src/lib/api.ts` - Added `SkillImportResult` interface, `exportSkill()`, and `importSkillZip()`
- `frontend/src/components/skills/SkillCard.tsx` - Added `onExport` prop, `exporting` state, `handleExport`, Download/Loader2 icons, Export tooltip button
- `frontend/src/pages/SkillsPage.tsx` - Added import, fileInputRef, importing/importMessage state, handleImport, Import Skill button, hidden file input, message display, `onExport={exportSkill}` on SkillCard
- `frontend/src/hooks/useSkills.ts` - Added `loadSkills` to `UseSkills` interface and return value

## Decisions Made

- `exportSkill` uses `getAuthToken()` not `getAuthHeaders()` — must not set `Content-Type: application/json` on blob download request, or the server may respond with JSON error instead of binary stream
- `importSkillZip` uses `getAuthToken()` not `getAuthHeaders()` — FormData sets its own Content-Type with multipart boundary; explicit JSON Content-Type header would break the multipart parsing on the backend
- `loadSkills` promoted to public in `useSkills` return — SkillsPage needs to re-fetch the full skills list after import; optimistic update is insufficient because import creates new skills the hook doesn't know about
- Export button placed before Edit (Pencil) in owner actions row — matches UI-SPEC ordering

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — export and import are fully wired to the backend endpoints implemented in Plan 01.

## User Setup Required

None — no new environment variables. Backend export/import endpoints were completed in Plan 01.

## Next Phase Readiness

- Phase 13 is fully complete — backend endpoints (13-01) and UI controls (13-02) verified end-to-end in the browser
- Export creates a valid ZIP containing SKILL.md with YAML frontmatter and instructions body
- Import round-trips correctly: exported ZIP re-imports as a new skill visible in the list
- Skills open standard format is operational; ready for any future phase involving skill sharing, marketplace, or distribution

---
*Phase: 13-skills-open-standard*
*Completed: 2026-04-02*
