---
phase: 165-is-global-retirement-cleanup
plan: 03
subsystem: api
tags: [pydantic, fastapi, supabase, rls, multi-tenancy, is_org_shared, is_system_global, semantic-split-rename]

# Dependency graph
requires:
  - phase: 165-01
    provides: "migration 111 — the value-preserving RENAME COLUMN x6 semantic split (folders/skills.is_global -> is_org_shared; workflow_definitions/document_views/classification_rules/metadata_field_definitions.is_global -> is_system_global). NOT yet applied (lands in plan 165-10)."
provides:
  - "Backend MODEL layer (6 Pydantic files) renamed to the D-165-01 split target verified per model<->table"
  - "Backend API layer (8 route files) renamed to the per-table split target; documents.py MIXED (folders -> is_org_shared + classification_rules -> is_system_global)"
  - "skills.is_system model/wire field preserved verbatim (D-165-02)"
  - "Platform-table write-lock (D-165-03 / T-165-11) structurally preserved: is_system_global absent from every platform Create request model (body-unsettable)"
affects: [165-04, 165-05, 165-06, 165-07, 165-08, 165-09, 165-10, 165-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Semantic-split rename: the SAME token (is_global) maps to DIFFERENT new names by owning table — verified per-occurrence against the actual supabase.table()/model context, not an inventory list"
    - "MIXED-file discipline: documents.py carries BOTH targets (folder reads vs classification_rules ingest) — never blanket-renamed to one target"
    - "Wrong-rename guard: each single-table file carries ONLY its target; documents.py carries both — stronger than a bare 0-is_global grep"

key-files:
  created:
    - .planning/phases/165-is-global-retirement-cleanup/165-03-SUMMARY.md
  modified:
    - backend/app/models/folder.py
    - backend/app/models/skill.py
    - backend/app/models/kb.py
    - backend/app/models/document_view.py
    - backend/app/models/classification_rule.py
    - backend/app/models/metadata_field.py
    - backend/app/api/folders.py
    - backend/app/api/skills.py
    - backend/app/api/documents.py
    - backend/app/api/document_views.py
    - backend/app/api/classification_rules.py
    - backend/app/api/metadata_fields.py
    - backend/app/api/workflows.py
    - backend/app/api/skill_tuner.py

key-decisions:
  - "D-165-01 split targets applied per model<->table: folders/skills/kb -> is_org_shared; document_views/classification_rules/metadata_fields/workflows -> is_system_global"
  - "D-165-02 honored: skills.is_system NOT renamed (count unchanged vs HEAD in both skill.py model and skills.py api)"
  - "D-165-03 write-lock: the actual code hard-set literal (\"is_global\": False) lives in the SERVICE layer (plan 04 scope), not the api files; plan-03 api files carry only docstring references — renamed to is_system_global=False. Write-lock preserved because platform Create request models never carried the flag (body-unsettable)."

patterns-established:
  - "Single-table files renamed via scoped replace-all (every is_global == that table's column); MIXED documents.py via targeted per-occurrence edits"

requirements-completed: [MIG-02]

# Metrics
duration: 26min
completed: 2026-07-20
---

# Phase 165 Plan 03: is_global Retirement — Backend Model + API Layer Summary

**Renamed `is_global` to its D-165-01 split target (is_org_shared vs is_system_global) across 6 Pydantic model files + 8 FastAPI route files, deriving each occurrence's target from the actual table it queries — documents.py MIXED — with skills.is_system and the platform write-lock preserved.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-20T20:57Z (approx)
- **Completed:** 2026-07-20T21:23Z
- **Tasks:** 2
- **Files modified:** 14 (6 models + 8 api)

## Accomplishments
- Model layer: folder.py/skill.py/kb.py -> `is_org_shared`; document_view.py/classification_rule.py/metadata_field.py -> `is_system_global`. All six modules import clean.
- API layer: folders.py/skills.py/skill_tuner.py -> `is_org_shared`; document_views.py/classification_rules.py/metadata_fields.py/workflows.py -> `is_system_global`. All eight modules import clean.
- documents.py MIXED handled per-occurrence: the two `.table("folders")` scope filters (~L1351/1528) -> `is_org_shared`; the classification_rules ingest block (comment + `.or_` + `.order` + `r.get`, ~L1911/1922/1924/1932) -> `is_system_global`.
- Wrong-rename guard passes: single-table files carry ONLY their target; documents.py carries BOTH (`is_org_shared` x2 + `is_system_global` x4).
- D-165-02: `is_system` preserved (skill.py model count 2==2 vs HEAD; skills.py api count 5==5 vs HEAD).
- D-165-03 / T-165-11 write-lock structurally preserved: `is_system_global` appears only on the platform *Response* models (RuleResponse/MetadataFieldResponse/ViewResponse), never on their *Create* models — a user cannot set the universal flag from a request body.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the model layer (6 Pydantic files)** - `2f916351` (refactor)
2. **Task 2: Rename the API layer (8 route files, documents.py MIXED)** - `72dca493` (refactor)

## Files Created/Modified
- `backend/app/models/folder.py` - FolderCreate/FolderResponse `is_global` -> `is_org_shared` (+ SEED-091 owner-null comment)
- `backend/app/models/skill.py` - SkillCreate/SkillResponse `is_global` -> `is_org_shared`; `is_system` KEPT verbatim
- `backend/app/models/kb.py` - FolderEntry/TreeNode (ls/tree folder repr) `is_global` -> `is_org_shared`
- `backend/app/models/document_view.py` - ViewResponse `is_global` -> `is_system_global`
- `backend/app/models/classification_rule.py` - RuleResponse + HARD-SET docstring `is_global` -> `is_system_global`
- `backend/app/models/metadata_field.py` - MetadataFieldResponse + T-111-03-01 docstring `is_global` -> `is_system_global`
- `backend/app/api/folders.py` - create body key + toggle read/update -> `is_org_shared` (folders are a genuine body-supplied toggle)
- `backend/app/api/skills.py` - all owner-scoped `.or_` filters + create hard-set + toggle + list serialize -> `is_org_shared`; `is_system` KEPT
- `backend/app/api/documents.py` - MIXED: folder scope filters -> `is_org_shared`; classification_rules ingest -> `is_system_global`
- `backend/app/api/document_views.py` - service-hard-set docstrings -> `is_system_global`
- `backend/app/api/classification_rules.py` - service-hard-set docstrings/comments -> `is_system_global`
- `backend/app/api/metadata_fields.py` - HARD-SET docstring/comment -> `is_system_global`
- `backend/app/api/workflows.py` - published/starter/create/cascade RLS-mirror docstrings -> `is_system_global`
- `backend/app/api/skill_tuner.py` - owner-scoped skills `.or_` filters -> `is_org_shared`

## Decisions Made
- **Write-lock lives in the service layer, not the API layer.** The plan's per-file map already flagged document_views/classification_rules/metadata_fields as "service hard-set". Confirmed live: the actual `"is_global": False` code literal is in `document_view_service.py` / `classification_rule_service.py` / `metadata_field_service.py` (plan 165-04 scope). The plan-03 api files carry only docstring/comment references to that hard-set, which were renamed to `is_system_global=False`. The write-lock is preserved by construction because none of the platform *Create* request models carry the flag.
- **Single-table files via scoped replace-all, MIXED via targeted edits.** For files that query exactly one table, every `is_global` == that table's column, so a scoped replace-all is both safe and correct. documents.py (folders + classification_rules) required per-occurrence targeted edits.

## Deviations from Plan

None - plan executed exactly as written. All renames applied per the explicit per-file table->target map; no auto-fixes required.

**Note on acceptance criterion 3 (Task 2 write-lock grep):** The plan's grep
`grep -rn "is_system_global=false\|is_system_global = false\|\"is_system_global\": False" <3 platform api files>`
returns no match (exit 1). This is EXPECTED, not a failure: the actual write-lock code literal (`"is_global": False`) lives in the SERVICE files (plan 165-04's scope), not the api files. The api files carry the write-lock only as docstrings, which were renamed to `is_system_global=False` (Python-style capital F — the grep's `=false` alternatives are lowercase and the `"...": False` alternative expects a dict literal). The write-lock is genuinely intact: verified that `is_system_global` is absent from RuleCreate/MetadataFieldCreate/ViewCreate (present only on the Response models), so the flag remains server-owned and body-unsettable. The load-bearing wrong-rename guard (each file's tokens match the table it queries; documents.py carries both) passes fully.

## Issues Encountered
None.

## Verification Results
- **All 14 modules import clean** (6 models + 8 api) via the backend venv.
- **Zero bare `is_global`** (non-comment) across all 14 files; zero residual `is_global` even including comments/docstrings (full-token sweep exit 1).
- **Wrong-rename guard:**
  - Models: `is_org_shared` only in folder/skill/kb; `is_system_global` only in document_view/classification_rule/metadata_field.
  - API: folders/skills/skill_tuner carry `is_org_shared` (4/14/4) + 0 `is_system_global`; document_views/classification_rules/metadata_fields/workflows carry `is_system_global` (3/4/2/7) + 0 `is_org_shared`; **documents.py carries BOTH** (`is_org_shared`=2, `is_system_global`=4).
- **D-165-02:** `is_system` count unchanged vs HEAD (skill.py 2==2; skills.py 5==5).
- **D-165-03 write-lock:** platform Create models carry no `is_system_global` (body-unsettable); service-layer hard-set untouched.

## User Setup Required
None - no external service configuration required.

**Dev-server note (from plan W1):** These renames read the RENAMED columns BEFORE migration 111 is applied (plan 165-10). A running backend/frontend dev server will 500 on folder/skill/view/workflow endpoints in the window between this commit and the apply. This is by design — the operator stops dev servers for Wave 1 and restarts only after plan 165-10 applies migration 111 + regenerates full-schema.

## Next Phase Readiness
- Wire contract (Pydantic + API-wire field names) now matches migration 111's renamed columns. Frontend (plans 165-08/09) and the migration apply (165-10) must agree on this contract.
- Plan 165-04 (backend service/db/main rename) is the direct downstream: it owns the actual `"is_global": False` service-layer write-lock literals + the DB helper `folder_is_globally_visible` -> `folder_is_org_shared` rename.
- Runtime (wire-level green) verification lands in plan 165-11 AFTER migration 111 is applied — this plan is static-import + grep-guard verified only.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/165-is-global-retirement-cleanup/165-03-SUMMARY.md`.
- Commits verified present: `2f916351` (Task 1 models), `72dca493` (Task 2 api), `3bcf5b2d` (SUMMARY).
- All 14 modified files present on disk and imported clean via the backend venv.

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*
