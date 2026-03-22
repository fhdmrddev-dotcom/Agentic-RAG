---
phase: 06-read-tool
plan: "01"
subsystem: backend
tags: [read-tool, kb-api, tool-spec, integration-tests]
dependency_graph:
  requires: [05-search-tools]
  provides: [read_document tool, read_path helper, ReadResponse model]
  affects: [threads.py tool loop, openai_service get_tools, kb API]
tech_stack:
  added: []
  patterns: [read_path helper pattern, single().execute() with try/except for zero-row guard]
key_files:
  created: []
  modified:
    - backend/app/models/kb.py
    - backend/app/api/kb.py
    - backend/app/services/openai_service.py
    - backend/app/api/threads.py
    - backend/tests/integration/test_kb.py
decisions:
  - "Wrap single().execute() in try/except — supabase-py raises APIError on zero rows; matches Pitfall 4 from research"
  - "end_line clamped with min(end_line, total_lines) not errored — LLM may guess large end_line to read entire document"
  - "read_document placed at position 5 in system prompt (between glob and query_documents) to group exploration tools together"
metrics:
  duration: "2min 43sec"
  completed_date: "2026-03-22"
  tasks_completed: 3
  files_modified: 5
---

# Phase 6 Plan 1: Read Tool Backend Summary

Backend read_document tool: ReadResponse model, read_path() helper with line-range slicing, GET /kb/read endpoint, READ_DOCUMENT_TOOL spec registered in get_tools(), threads.py handler branch, system prompt updated to nine tools, and 5 integration tests passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ReadResponse model, read_path() helper, and GET /kb/read endpoint | 2d31b45 | backend/app/models/kb.py, backend/app/api/kb.py |
| 2 | Wire read_document into OpenAI tool spec, threads.py handler, and system prompt | 92a0b2c | backend/app/services/openai_service.py, backend/app/api/threads.py |
| 3 | Add TestRead integration tests for read endpoint | db9d9d1 | backend/tests/integration/test_kb.py |

## What Was Built

- **ReadResponse** Pydantic model in `backend/app/models/kb.py` with fields: `document_id` (UUID), `filename` (str), `total_lines` (int), `content` (str), `start_line` (int | None), `end_line` (int | None)

- **read_path()** helper in `backend/app/api/kb.py` that:
  - Fetches `full_markdown` directly from `documents` table by `id` + `user_id` (enforces RLS at query level)
  - Handles `NULL` full_markdown (returns "No content available" error)
  - Supports line-range slicing with 1-based numbering: `f"{start_line + i}: {line}"`
  - Clamps `end_line` to `total_lines` silently (no error on overshoot)
  - Wraps `.single().execute()` in try/except to handle supabase-py APIError on zero rows

- **GET /kb/read endpoint** in `backend/app/api/kb.py`: accepts `document_id`, optional `start_line`/`end_line`, returns `ReadResponse` on success, 404 on not-found/no-content

- **READ_DOCUMENT_TOOL** spec in `backend/app/services/openai_service.py`: `document_id` required (string), `start_line`/`end_line` optional (integer); registered in `get_tools()` between GLOB_TOOL and ANALYZE_DOCUMENT_TOOL

- **read_document handler** in `backend/app/api/threads.py`: added `read_path` import and `elif tool_name == "read_document":` branch in tool-execution loop

- **System prompt** updated from "eight tools" to "nine tools"; `read_document` added as tool 5 (between glob and query_documents); key rule added: "Read full document content or a line range → read_document"

- **TestRead class** in `backend/tests/integration/test_kb.py` with 5 tests:
  - `test_read_full_document`: full content, total_lines=3, start_line/end_line None
  - `test_read_line_range`: lines 2-3, content contains "2: Line two" and "3: Line three"
  - `test_read_not_found`: 404 on missing document
  - `test_read_no_content`: 404 with "No content available" in detail
  - `test_read_line_range_clamped`: end_line=3 when requesting 9999

## Verification Results

- `python -c "from app.models.kb import ReadResponse"` — OK
- `python -c "from app.api.kb import read_path"` — OK
- `python -c "from app.services.openai_service import get_tools; assert 'read_document' in [t['function']['name'] for t in get_tools()]"` — OK
- `pytest tests/integration/test_kb.py::TestRead -x -v` — 5 passed
- `pytest tests/integration/test_kb.py -x -v` — 24 passed (no regressions)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. The read tool fetches from the live `full_markdown` column which is populated by the ingestion pipeline from Phase 2.

## Self-Check: PASSED

Files confirmed:
- `backend/app/models/kb.py` — contains `class ReadResponse(BaseModel):`
- `backend/app/api/kb.py` — contains `def read_path(` and `@router.get("/read", response_model=ReadResponse)`
- `backend/app/services/openai_service.py` — contains `READ_DOCUMENT_TOOL` and `READ_DOCUMENT_TOOL` in `get_tools()` list
- `backend/app/api/threads.py` — contains `read_path` import and `elif tool_name == "read_document":`
- `backend/tests/integration/test_kb.py` — contains `class TestRead:` with 5 test methods

Commits confirmed:
- 2d31b45 feat(06-01): add ReadResponse model, read_path() helper, and GET /kb/read endpoint
- 92a0b2c feat(06-01): wire read_document into tool spec, threads.py handler, and system prompt
- db9d9d1 test(06-01): add TestRead integration tests for read endpoint
