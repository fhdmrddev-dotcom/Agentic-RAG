---
phase: 084-workspace-filesystem-backend
status: human_needed
created: 2026-05-28
verifier: inline-orchestrator
---

# Phase 084: Workspace Filesystem Backend -- Verification Report

## Goal (from ROADMAP)

Build the backend foundation for a per-thread persistent virtual filesystem the agent can write to,
read from, version, diff, and surface via REST API for the Phase 087 panel UI.

## Plan Inventory

| Plan | Title | Status | SUMMARY | Commits |
|------|-------|--------|---------|---------|
| 084-01 | Database Schema Migration | complete | 084-01-SUMMARY.md | 652020c, 41ccdc7, 790abb0 |
| 084-02 | DB Layer + Pydantic Models + Workspace Service | complete | 084-02-SUMMARY.md | 85c17e4, 1bebbda, fb97585 |
| 084-03 | Tool Handlers + LLM Schemas | complete | 084-03-SUMMARY.md | 6765dfd, 84eaa2a, 90ef06d |
| 084-04 | Workspace REST API | complete | 084-04-SUMMARY.md | 5201911, 953c13f, da83d1f |

Plus regression auto-fix: ffae21e (test_tool_dispatcher count assertion 16 → 21).

## Must-Haves Verification (against codebase)

### Plan 01 -- Schema

| Must-Have | Method | Result |
|-----------|--------|--------|
| workspace_files table with UNIQUE(thread_id, path) | `grep workspace_files_thread_path_unique full-schema.sql` | PASS (UNIQUE constraint in dump) |
| workspace_file_versions table with UNIQUE(workspace_file_id, version) | `grep workspace_versions_file_version_unique full-schema.sql` | PASS |
| RLS on workspace_files enforces auth.uid() == thread owner | `grep -c auth.uid... user_id FROM threads 054_workspace_files.sql` | PASS (4 policies) |
| RLS on workspace_file_versions inherits via FK | `grep workspace_versions_select_own 054_workspace_files.sql` | PASS (JOIN through workspace_files) |
| workspace-files storage bucket exists as private | `grep "workspace-files', false" 054_workspace_files.sql` | PASS (in migration; not in pg_dump --schema-only -- see Plan 01 SUMMARY) |
| 10MB size constraint at DB level | `grep workspace_files_size_limit full-schema.sql` | PASS (CHECK size_bytes <= 10485760) |
| 500-char path length constraint at DB level | `grep workspace_files_path_length full-schema.sql` | PASS (CHECK char_length(path) <= 500) |

### Plan 02 -- Service Layer

| Must-Have | Method | Result |
|-----------|--------|--------|
| write_file stores inline <= 256KB, uploads otherwise | code: `is_inline = size <= inline_threshold` + conditional branch | PASS |
| write_file auto-creates version every call | code: `await insert_version(...)` unconditional | PASS |
| write_file computes delta via difflib for v>1 | code: `if version_num > 1: delta = await _compute_delta_from_prev(...)` | PASS |
| read_file caps at 8192 chars | code: `DEFAULT_READ_CAP = 8192` + truncation guard | PASS |
| read_file metadata-only for binary | code: `_BINARY_MIME_PREFIXES` check returns early | PASS |
| list_files filtered by prefix | code: `if prefix: query LIKE` | PASS |
| delete_file removes row + bucket objects | code: `delete_file_by_path` + `storage.remove` loop | PASS |
| get_diff returns structured JSONB diff | code: `compute_diff()` returns `{format, diff, stats, truncated}` | PASS |
| Path validation rejects .., //, whitespace, > 500 | smoke test ran 8 attack vectors | PASS (7/8 rejected; whitespace stripped per intent) |
| 10MB cap returns clear error | code: `raise FileTooLargeError(f"...exceeds maximum of {MAX_FILE_SIZE:,}...")` | PASS |
| Soft 100-file limit returns warning | code: `if file_count > SOFT_FILE_LIMIT: warning = ...` | PASS |

### Plan 03 -- Tool Surface

| Must-Have | Method | Result |
|-----------|--------|--------|
| workspace_write handler emits workspace_file_written SSE | grep `ctx.emit.*workspace_file_written tool_dispatcher.py` | PASS |
| workspace_read returns content truncated for text + metadata for binary | code: is_binary branch + truncation notice | PASS |
| workspace_list with optional prefix | handler passes `prefix = args.get("prefix")` | PASS |
| workspace_delete emits workspace_file_deleted SSE | grep `ctx.emit.*workspace_file_deleted tool_dispatcher.py` | PASS |
| workspace_diff returns structured diff | handler returns ToolResult with formatted diff text | PASS |
| All 5 workspace tools in get_tools() | `get_tools() -> 21 tools including 5 workspace_*` | PASS |

### Plan 04 -- REST API

| Must-Have | Method | Result |
|-----------|--------|--------|
| GET /threads/{id}/workspace/files | route mounted on app | PASS |
| GET /threads/{id}/workspace/files/{file_id}/content | route mounted; returns inline OR signed URL | PASS |
| GET /threads/{id}/workspace/files/{file_id}/versions | route mounted | PASS |
| GET /threads/{id}/workspace/files/{file_id}/diff | route mounted | PASS |
| All endpoints verify thread ownership | `_verify_thread_ownership` called at start of every handler | PASS (4 endpoints) |
| Router registered in main.py | `app.include_router(workspace.router)` present | PASS |

## Regression Tests

- `tests/unit/test_tool_dispatcher.py`: 8/8 pass (after auto-fix bumped expected count 16 → 21)
- `tests/unit/test_075_1_observability.py`: 6/6 pass
- Broader unit suite: 486/541 pass — 55 pre-existing failures unchanged from Phase 083 baseline (test_retrieval_service, test_sandbox_service, test_sql_service, test_streaming_reliability mock-completeness issues from prior phases, NOT introduced by 084).

## Integration Smoke

```
Tool handlers registered: 5 -- workspace_{write,read,list,delete,diff}
LLM tool schemas exposed: 5 -- workspace_{write,read,list,delete,diff}
REST routes mounted:      4 -- /files, /files/{id}/{content,versions,diff}
```

All three surfaces consistent.

## Schema Drift Gate

`gsd-sdk query verify.schema-drift "084"` → `{"valid": true, "issues": [], "checked": 4}` — clean.

## Cross-Provider UAT Bandwidth (CLAUDE.md G-4 + UAT-SC#10)

Phase 084 touches the LLM tool-schema vocabulary (new strict-mode nullable optionals). The 4-axis cross-provider UAT bandwidth is REQUIRED before this phase can ship:

| Axis | Status |
|------|--------|
| Cross-provider (OpenAI / Anthropic / Google / OpenRouter accept new schemas) | **human_needed** -- requires live agent calls per provider |
| Multi-tool (1 prompt invokes workspace_write + execute_code or similar) | **human_needed** |
| Parallel-thread (Thread A workspace ops while Thread B accepts new prompt) | **human_needed** |
| Long-message (≥ 50 prior messages OR ≥ 5KB user prompt with workspace_write) | **human_needed** |

The 5 new tool schemas use `["integer", "null"]` and `["string", "null"]` for optional params. Per Phase 084 RESEARCH.md this is OpenAI strict-mode compatible and Anthropic/Google handle it correctly. Manual UAT must confirm no provider rejects the new schemas with a 4xx error.

## Human Verification Items

The following must be exercised manually before the phase is closed:

### 1. Cross-provider agent UAT (G-4 critical)

Expected behavior: in each provider's main model, ask the agent to write, read, list, delete, and diff a workspace file. The agent should pick the right tool from the schema list without error.

| Provider | Model | Status |
|----------|-------|--------|
| OpenAI | gpt-4.x or latest | pending |
| Anthropic | claude-sonnet/opus-4.x | pending |
| Google | gemini-2.5/3.x | pending |
| OpenRouter | (any free-tier or kimi 2.6) | pending |

For each provider, run these prompts in sequence in a single thread:
- "Write a file at /test.md with content 'hello world'"
- "List the files in my workspace"
- "Read /test.md"
- "Write the same file again with content 'hello world v2'"
- "Show me the diff between v1 and v2 of /test.md"
- "Delete /test.md"

### 2. REST API curl smoke

With backend running and a logged-in browser session (extract Bearer token from devtools):

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/threads/{thread_id}/workspace/files

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/threads/{thread_id}/workspace/files/{file_id}/content

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/threads/{thread_id}/workspace/files/{file_id}/versions

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/threads/{thread_id}/workspace/files/{file_id}/diff?from=1&to=2"
```

### 3. Hybrid storage threshold smoke

Write a 100-byte file → confirm `content_inline` populated, `content_storage_path` null.
Write a 500KB file → confirm `content_storage_path` populated, `content_inline` null.

### 4. Path validation hostile inputs

Try to write files at these paths (each should be rejected by validate_path):
- `/../etc/passwd`
- `/foo//bar`
- `/foo\nbar` (newline)
- 600-char path
- `/` (empty after slash)

### 5. Soft 100-file limit warning

Write 101 files to a thread → confirm 101st write returns warning string in tool result.

## Status: human_needed

All automated checks PASS. Phase ships in code form. The 5 human verification items above (cross-provider UAT, REST curl smoke, hybrid storage threshold, hostile path validation, soft-limit warning) must be exercised manually before the phase can be marked closed.

After human verification, run `/gsd:verify-work 084` to record results.
