---
phase: 165-is-global-retirement-cleanup
plan: 04
subsystem: database
tags: [rename, is_global, is_org_shared, is_system_global, semantic-split, rls, migration-111, supabase, backend-services]

# Dependency graph
requires:
  - phase: 165 (Plan 01)
    provides: migration 111 value-preserving RENAME COLUMN ×6 (the DB half this backend rename tracks)
  - phase: 165 (Plan 03)
    provides: renamed model/API layer (models/skill.py is_org_shared field; api/metadata_fields.py + api/workflows.py already on is_system_global)
provides:
  - Backend SERVICE/DB/APP layer renamed off is_global onto its per-table split target (is_system_global for the 4 write-locked platform tables; is_org_shared for folders/skills)
  - The 4 checker-flagged inventory-misclassifications CORRECTED against live source (embedding_service->is_system_global; classification_matcher + workflow_authoring->is_org_shared)
  - agent_loop.py + openai_service.py provably token-only (D-14 red line held)
affects: [165-05, 165-06, 165-07 (backend test renames), 165-10 (migration 111 apply), 165-11 (SC#4 isolation-suite arbiter)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-occurrence table-context verification: each is_global mapped to the column of the table THAT occurrence queries (supabase.table()/raw SQL), never inventory-assumed"
    - "Wrong-rename guard: each file carries ONLY its verified target token (is_org_shared XOR is_system_global)"
    - "D-14 token-only rename on shared Deep-mode path: added==removed==HEAD is_global line count (no structural edit)"

key-files:
  created: []
  modified:
    - backend/app/services/document_view_service.py
    - backend/app/services/classification_rule_service.py
    - backend/app/services/metadata_field_service.py
    - backend/app/services/embedding_service.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/db/workflows.py
    - backend/app/main.py
    - backend/app/services/document_relationship_service.py
    - backend/app/services/skill_tuner_service.py
    - backend/app/services/publish_gate_service.py
    - backend/app/services/harness/skill_snapshot.py
    - backend/app/services/classification_matcher.py
    - backend/app/services/workflow_authoring.py
    - backend/app/services/agent_loop.py
    - backend/app/services/openai_service.py

key-decisions:
  - "D-165-01: split target VERIFIED against each occurrence's actual supabase.table()/raw-SQL, not inventory-assumed"
  - "D-165-02: skills.is_system column name KEPT verbatim (agent_loop L1311 comment kept is_system, only is_global renamed)"
  - "D-14: agent_loop.py + openai_service.py diffs token-only (agent_loop 2/2, openai 1/1)"
  - "T-165-34: main.py has ONE classification_rules router-include comment renamed; NO seed task added (15 workflows are migration-seeded in 061/066/094, auto-preserved by Plan 01 RENAME COLUMN)"

patterns-established:
  - "Semantic-split rename discipline: same source token (is_global) maps to different new names by owning table"
  - "document_relationship_service.py: conceptual-only reword (table has no such column) — no column rename"

requirements-completed: [MIG-02]

# Metrics
duration: 22min
completed: 2026-07-20
---

# Phase 165 Plan 04: Backend `is_global` Retirement (Service/DB/App Layer) Summary

**Renamed `is_global` across the 15 backend service/db/app files onto its per-table split target — `is_system_global` for the four write-locked platform tables and `is_org_shared` for folders/skills — each target verified against the actual `supabase.table()`/raw-SQL it queries, with the 4 checker-flagged misclassifications corrected and the shared Deep-mode path kept token-only.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-07-20T21:09:00Z
- **Completed:** 2026-07-20T21:31:39Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- **Task 1 (platform tables → `is_system_global`):** renamed 8 files whose `is_global` occurrences each query one of the four write-locked platform tables (`document_views`, `classification_rules`, `metadata_field_definitions`, `workflow_definitions`), including the server hard-set write-locks (`"is_global": False` → `"is_system_global": False`), the `metadata_field_service.create()` signature param, and all `.select`/`.or_`/`.eq` filter literals + response dict keys + docstrings.
- **CORRECTED (embedding_service.py):** the `read_enabled_field_defs` query verified against `.table("metadata_field_definitions")` (L282) → `is_system_global`. Renaming it `is_org_shared` (the inventory guess) would have broken metadata-field scoping during ingest.
- **main.py (FOLDED, no seed):** the single `classification_rules` router-include comment renamed to `is_system_global`; NO seed code exists or was added — the 15 seeded workflows live in migrations 061/066/094 and are auto-preserved by Plan 01's `RENAME COLUMN`.
- **Task 2 (folders/skills → `is_org_shared`):** renamed 7 files whose `is_global` occurrences each query `folders` or `skills`; `skills.is_system` preserved verbatim (D-165-02).
- **CORRECTED (classification_matcher.py + workflow_authoring.py):** verified against `.table("folders")` (`_resolve_folder_name` L267) and `.table("skills")` (`_skill_registry` L153/168) respectively → `is_org_shared`. The inventory had them as platform (`is_system_global`), which would have broken folder-name resolution and the workflow-authoring skill catalog.
- **D-14 token-only (agent_loop.py + openai_service.py):** provably mechanical — `git diff --numstat` = `2 2` for agent_loop.py and `1 1` for openai_service.py, both equal to the HEAD count of `is_global` lines; no structural edit to the shared Deep-mode path.

## Task Commits

Each task was committed atomically:

1. **Task 1: platform-table files → `is_system_global`** - `f795cefc` (refactor) — 8 files, 50 insertions / 50 deletions
2. **Task 2: skills/folders files → `is_org_shared` (D-14 token-only agent_loop/openai)** - `e39fe0f8` (refactor) — 7 files, 18 insertions / 18 deletions

## Files Created/Modified

**Task 1 — `is_system_global` (platform tables):**
- `backend/app/services/document_view_service.py` — `document_views` create/list/get; hard-set false write-lock
- `backend/app/services/classification_rule_service.py` — `classification_rules` create/list/get; hard-set false write-lock
- `backend/app/services/metadata_field_service.py` — `metadata_field_definitions` create/list; signature param + hard-set false
- `backend/app/services/embedding_service.py` — `read_enabled_field_defs` `metadata_field_definitions` ingest scoping (CORRECTED)
- `backend/app/services/workflow_kickoff.py` — `workflow_definitions` kickoff select + `.or_`
- `backend/app/db/workflows.py` — `workflow_definitions` raw-SQL (picker/starters/publish/insert/count-foreign)
- `backend/app/main.py` — single `classification_rules` router-include comment (no seed code)
- `backend/app/services/document_relationship_service.py` — conceptual docstring reword only (no column; table has none)

**Task 2 — `is_org_shared` (folders/skills):**
- `backend/app/services/skill_tuner_service.py` — `skills` sibling-catalog queries
- `backend/app/services/publish_gate_service.py` — `skills` read select
- `backend/app/services/harness/skill_snapshot.py` — `skills` `_SKILL_SELECT` + resolve `.or_`
- `backend/app/services/classification_matcher.py` — `folders` `_resolve_folder_name` `.or_` (CORRECTED)
- `backend/app/services/workflow_authoring.py` — `skills` `_skill_registry` select + `.or_` + python filter + docstring (CORRECTED)
- `backend/app/services/agent_loop.py` — `skills` catalog query (L1273) + `match_skills` comment (L1311); token-only, `is_system` kept
- `backend/app/services/openai_service.py` — text-to-SQL `folders`-schema prompt string; token-only

## Decisions Made

None beyond the plan — followed the explicit per-file table→target map exactly, including the 4 `[CORRECTED]` files. `skills.is_system` preserved (D-165-02). No seed task added to main.py (T-165-34).

## Deviations from Plan

None - plan executed exactly as written.

The 4 checker-flagged inventory-misclassifications (`embedding_service`→`is_system_global`, `classification_matcher`/`workflow_authoring`→`is_org_shared`, and the `document_relationship_service` no-op) were already corrected in the plan text; this execution applied the corrected targets and independently re-verified each against its live `supabase.table()`/raw-SQL context before renaming.

## Verification

- **Zero bare `is_global`** across all 15 files (both task groups grep-confirmed 0 remaining; `document_relationship_service` conceptual reference reworded away).
- **Wrong-rename guard:** Task 1 files carry `is_system_global` and 0 `is_org_shared`; Task 2 files carry `is_org_shared` and 0 `is_system_global`. `embedding_service.py` = 5 `is_system_global` (>= 3 required, 0 `is_org_shared`). `classification_matcher.py` (1) + `workflow_authoring.py` (6) carry `is_org_shared`, 0 `is_system_global`.
- **main.py:** exactly the classification_rules comment renamed (1-line change, `git diff --stat` = 2), no seed block.
- **D-14 token-only:** `git diff --numstat` = agent_loop.py `2 2`, openai_service.py `1 1`; `is_system UNIVERSAL escape` at agent_loop L1311 preserved verbatim.
- **Imports:** all 8 Task 1 modules + all 7 Task 2 modules import cleanly via `venv/Scripts/python.exe -c "import ...; print('ok')"` (static import does NOT touch the DB, so it is safe before migration 111 applies in Plan 10).
- **No caller breakage in app code:** grep confirmed no `backend/app/` file passes `is_global=` as a keyword arg (all such call-sites are in `backend/tests/` — owned by Plans 05/06/07 — and the dead `migrations.archive/`).
- **No file deletions** in either commit.

## Issues Encountered

- The glob-based verification transiently matched two out-of-scope files (`backend/app/api/workflows.py`, `backend/app/api/metadata_fields.py`) that ALREADY carry `is_system_global` — renamed by Plan 03 (the model/API layer). Confirmed out of this plan's scope and correct; not modified here.

## Known Stubs

None — pure token rename; no new data sources, placeholders, or empty-value stubs introduced.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries. This plan is a source-token rename tracking the Plan-01 DB `RENAME COLUMN`; no runtime behavior changes.

## User Setup Required

None - no external service configuration required.

> **Wave-1 dev-server note (from PLAN W1):** this commit makes code read the RENAMED columns BEFORE the Wave-2 migration apply (Plan 165-10). A running backend/frontend dev server would 500 in the window between this commit and the migration apply. The operator must keep dev servers stopped until Plan 165-10 applies migration 111 + regenerates full-schema. (Static imports were used for verification precisely because they do not query the DB.)

## Next Phase Readiness

- Backend service/db/app layer is fully off `is_global` — Plans 05/06/07 (test renames) and Plan 10 (migration 111 apply) can proceed.
- Runtime/assertion-level green is deferred to Plan 165-11 (post-migration), which is the SC#4 isolation-suite arbiter.

## Self-Check: PASSED

- `165-04-SUMMARY.md` exists at `.planning/phases/165-is-global-retirement-cleanup/`
- Task 1 commit `f795cefc` present
- Task 2 commit `e39fe0f8` present
- SUMMARY commit `47de6553` present

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-20*
