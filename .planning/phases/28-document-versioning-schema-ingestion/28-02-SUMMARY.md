---
phase: 28-document-versioning-schema-ingestion
plan: "02"
subsystem: retrieval-pipeline, frontend-citations
tags: [version-number, citations, rag, sse, frontend]
dependency_graph:
  requires: [28-01]
  provides: [version_number in citation SSE events, CitationCard version badge]
  affects: [retrieval_service.py, threads.py, CitationCard.tsx]
tech_stack:
  added: []
  patterns: [version_number propagation via _enrich_with_filenames, optional TypeScript field]
key_files:
  created: []
  modified:
    - backend/app/services/retrieval_service.py
    - backend/app/api/threads.py
    - backend/tests/unit/test_retrieval_service.py
    - frontend/src/types/index.ts
    - frontend/src/components/chat/CitationCard.tsx
decisions:
  - "version_number defaults to 1 in all enrichment and citation paths — safe for pre-migration document rows"
  - "CitationCard shows no version suffix for v1 (clean default experience); renders '(vN)' only when N > 1"
  - "SSE citations event carries version_number via dict(c) copy — no additional code in emission path"
metrics:
  duration: "150s"
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 5
---

# Phase 28 Plan 02: Version Number Citation Propagation Summary

VER-06 end-to-end: version_number flows from the documents table through _enrich_with_filenames, retrieved_citations, SSE citations event, and renders as "(vN)" in CitationCard when N > 1.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Propagate version_number through retrieval and citation pipeline | b330517 | retrieval_service.py, threads.py, test_retrieval_service.py |
| 2 | Add version_number to frontend Citation type and render in CitationCard | 0649f4a | types/index.ts, CitationCard.tsx |

## What Was Built

**Task 1 — Backend pipeline:**
- `_enrich_with_filenames` select string extended to include `version_number` from the documents table
- Enrichment loop adds `entry["version_number"] = doc.get("version_number", 1)` after building each result
- `search_documents` citation dict in threads.py includes `"version_number": hit.get("version_number", 1)`
- `analyze_document` citation dict in threads.py includes `"version_number": doc.get("version_number", 1)` from the full document fetch
- SSE emission path (`dict(c)` copy) carries version_number automatically — no code change needed there
- Two new unit tests: `test_enrich_with_filenames_includes_version_number` (version_number=3) and `test_enrich_with_filenames_defaults_version_number_to_1` (missing field → defaults to 1)

**Task 2 — Frontend type and rendering:**
- `Citation` interface in index.ts extended with `version_number?: number` (optional for backward compatibility)
- `CitationCard` filename span renders `(vN)` suffix when `citation.version_number != null && citation.version_number > 1`
- No suffix rendered for v1 or absent version_number — clean default experience

## Verification

- 19 backend tests pass: test_retrieval_service.py (15) + test_document_versioning.py (4)
- All CitationCard frontend tests pass (8 tests)
- grep confirms version_number in all 4 required files
- Pre-existing test failures (test_explorer_agent, test_infrastructure, test_sql_service) are unrelated to this plan

## Deviations from Plan

None — plan executed exactly as written. The SSE emission path was confirmed to require no changes (dict(c) copy propagates all keys automatically), matching the plan's prediction.

## Known Stubs

None — version_number flows from real database data through the full pipeline. No placeholder values.

## Self-Check: PASSED

Files exist:
- backend/app/services/retrieval_service.py — FOUND (version_number at line 106, 117)
- backend/app/api/threads.py — FOUND (version_number at lines 743, 769)
- frontend/src/types/index.ts — FOUND (version_number at line 56)
- frontend/src/components/chat/CitationCard.tsx — FOUND (version_number at lines 21-22)

Commits exist:
- b330517 — FOUND (feat(28-02): propagate version_number...)
- 0649f4a — FOUND (feat(28-02): add version_number to Citation type...)
