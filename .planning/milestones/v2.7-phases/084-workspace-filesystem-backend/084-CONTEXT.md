# Phase 084: Workspace Filesystem Backend - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the per-thread workspace filesystem backend: database tables, hybrid storage (Postgres inline + Supabase Storage), versioning, diffing, RLS, SSE events, REST API endpoints, and 5 new tool handlers registered through the tool_dispatcher. No UI in this phase — the panel consumes these APIs in Phases 086-087.

</domain>

<decisions>
## Implementation Decisions

### File Paths & Structure
- **D-01:** Workspace files support nested paths (e.g., `/reports/2026/weekly.md`). The `path` column stores the full path string — there are no actual OS directories or a separate folders table. The path is the unique key within a thread (`UNIQUE(thread_id, path)`).
- **D-02:** Path validation rules: no leading/trailing whitespace, no double slashes, no `..` traversal, max path length ~500 chars. Claude has discretion on exact validation implementation.

### Storage Limits & Quotas
- **D-03:** Single-file size cap is **10 MB**. The agent receives a clear error in the tool result if a write exceeds this. This covers generated PDFs, CSVs, images, and data exports while preventing runaway writes.
- **D-04:** Soft file count limit of **100 files per thread**. When the limit is exceeded, the write still succeeds but the tool result includes a warning: `"Warning: 102/100 files in workspace. Consider deleting unused files."` The agent can self-correct. No hard block.
- **D-05:** Hybrid storage threshold is **256KB** (from research), configurable via `app_settings`. Files at or below this size are stored inline in Postgres (`content_inline bytea`); larger files are uploaded to a `workspace-files` Supabase Storage bucket with a signed URL reference (`content_storage_url`).

### Versioning & Diffing
- **D-06:** Every `workspace_write` auto-creates a new version row in `workspace_file_versions`. Full version history is retained (no auto-pruning). The `workspace_diff(path, from_version, to_version)` tool returns a structured diff generated via Python's `difflib`.
- **D-07:** Claude has discretion on diff format details — unified text diff, JSON-structured delta, or both. Pick what the eventual panel DiffViewer (Phase 087) can consume most easily.

### Visibility & API Endpoints
- **D-08:** REST API endpoints are built in this phase — `GET /threads/{thread_id}/workspace/files`, `GET .../files/{file_id}/content`, `GET .../files/{file_id}/versions`, `GET .../files/{file_id}/diff?from=N&to=M`. These are consumed by the panel in Phase 087 and are curl-able for dev testing now.
- **D-09:** No UI surface in this phase. Users interact with workspace files only through the agent (agent writes/reads/lists) or by hitting the API endpoints directly. The panel ships in Phase 087.

### SSE Events
- **D-10:** Two new SSE event types ride the existing `run:{run_id}` Redis Stream via `_emit()`: `workspace_file_written` with payload `{path, version, size_bytes, mime_type}` and `workspace_file_deleted` with payload `{path}`. Same pattern as existing tool events.

### RLS & Security
- **D-11:** RLS on `workspace_files` via FK chain: `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)`. Same pattern as existing tables. Users cannot see other users' workspace files.
- **D-12:** Storage bucket RLS follows the existing `documents` and `sandbox-outputs` bucket pattern from migration 029 — path prefix is `{user_id}/{thread_id}/{filename}`.

### Tool Registration
- **D-13:** Five new tool handlers registered in `tool_dispatcher.py`'s `_TOOL_REGISTRY`: `workspace_write`, `workspace_read`, `workspace_list`, `workspace_delete`, `workspace_diff`. Each follows the `async _handle_<name>(args, ctx) -> ToolResult` pattern from Phase 083.
- **D-14:** Tool definitions added to `openai_service.py:get_tools()` — mechanical list append following existing pattern.

### Claude's Discretion
- Whether `workspace_service.py` is one file or split into service + storage adapter — pick what stays maintainable
- Diff output format details (unified text vs JSON delta vs both)
- Migration numbering starting point (next available after 053)
- Whether to include a `workspace_read` content preview in the `workspace_file_written` SSE event or keep it metadata-only
- Test strategy: unit tests for service layer, integration tests for API endpoints, or both

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Design
- `.planning/research/ARCHITECTURE.md` — Full integration map, data flow diagrams (Section 3.1 workspace write flow), table schemas (Section 2.3), API routes (Section 2.4), SSE event types (Section 2.5)
- `.planning/research/ARCHITECTURE.md` §3.1 — Workspace write flow diagram (agent → dispatch → service → DB/Storage → emit → SSE → panel)
- `.planning/codebase/ARCHITECTURE.md` — System overview and component responsibilities

### Tool Dispatcher (Phase 083 output)
- `backend/app/services/tool_dispatcher.py` — Registry pattern, `ToolContext` dataclass, `ToolResult` dataclass, `dispatch_tool()` router. New tools register here.
- `.planning/phases/083-foundation-tool-dispatch-extraction-bug-fixes/083-CONTEXT.md` — D-01 through D-04 define the dispatcher contract

### Storage Patterns (existing)
- `supabase/migrations/029_storage_buckets.sql` — Existing bucket + RLS pattern for `documents` and `sandbox-outputs`; workspace-files bucket follows this template
- `backend/app/services/sandbox_service.py` — `harvest_output_files` and Storage upload pattern (lines ~250+)
- `backend/app/api/sandbox_outputs.py` — `create_signed_url` pattern for storage bucket reads

### SSE & Streaming
- `backend/app/api/threads.py` — `_emit()` helper for XADD to `run:{run_id}` Redis Stream
- `frontend/src/providers/StreamsProvider.tsx` — `makeStreamCallbacks` factory where new event type callbacks will be wired (Phase 086)

### Requirements
- `.planning/REQUIREMENTS.md` — WS-01 through WS-07 (workspace filesystem requirements)
- `.planning/ROADMAP.md` Phase 084 section — success criteria, dependency on Phase 083

### Research
- `.planning/research/FEATURES.md` — Feature implementation patterns from open-source landscape
- `.planning/research/PITFALLS.md` — Known pitfalls and failure modes for workspace features
- `.planning/research/STACK.md` — Technology stack decisions and compatibility notes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/tool_dispatcher.py` — Tool registration pattern (handler + `_TOOL_REGISTRY` entry). Phase 084 adds 5 new entries.
- `backend/app/utils/db.py:aexec()` — Async wrapper for sync supabase-py calls; used by existing tool handlers
- `supabase/migrations/029_storage_buckets.sql` — Template for bucket creation + RLS policies
- `backend/app/api/sandbox_outputs.py` — `create_signed_url` pattern for serving files from Storage buckets
- `backend/app/services/sandbox_service.py:harvest_output_files` — File upload to Storage bucket pattern

### Established Patterns
- Supabase Storage: `supabase.storage.from_("bucket-name").upload(path, data)` used in documents, sandbox-outputs, skill-files
- RLS via FK chain: `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)` — standard across all thread-scoped tables
- SSE emission: `_emit(redis, run_id, event_type, **payload)` → `XADD run:{run_id}` Redis Stream
- `run_in_threadpool` wrapping for sync supabase-py calls in async handlers (D-v2.5-01)
- Per-thread Map pattern in `streamsStore.ts` (from D-075.4-A1) — workspace files will follow this pattern in Phase 086

### Integration Points
- `tool_dispatcher.py:_TOOL_REGISTRY` — Where new workspace tool handlers register
- `openai_service.py:get_tools()` — Where tool JSON schemas are added for LLM function calling
- `threads.py:_emit()` — SSE event emission entry point
- `threads.py:agent_runner` — ToolContext construction (may need new fields if workspace service needs additional context)

</code_context>

<specifics>
## Specific Ideas

- The workspace service should be designed as a clean abstraction that the tool handlers call — `workspace_service.write_file(thread_id, path, content)` returning version info. The hybrid storage logic (inline vs bucket) should be invisible to callers.
- Migration numbering continues from 053 (latest in `supabase/migrations/`). Phase 084 needs at minimum 2 migrations: `workspace_files` table and `workspace_file_versions` table. Bucket creation can be in the same or a separate migration.
- The 5 workspace tools should have clear, descriptive tool schemas so the LLM knows when to use each one. The system prompt may need a brief mention that workspace tools are available for persistent file operations.

</specifics>

<deferred>
## Deferred Ideas

- **User inline editing of workspace files** — Out of scope per REQUIREMENTS.md. Agent writes, user reads for v1. Natural v2.8 follow-up.
- **Workspace files as RAG corpus** — Explicitly out of scope. AI-generated content would degrade search accuracy.
- **Cross-thread file sharing** — Per-thread scoping is simpler. Sharing adds permission complexity.
- **Auto-pruning of old versions** — Keep all versions for now. Revisit if storage grows significantly.
- **File type restrictions / content scanning** — No restrictions for now. Agent can write text, markdown, code, CSV, JSON. Binary files (images from sandbox) follow the same path.

</deferred>

---

*Phase: 084-workspace-filesystem-backend*
*Context gathered: 2026-05-28*
