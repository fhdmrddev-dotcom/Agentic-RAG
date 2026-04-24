# Phase 30: Audit Log — Backend - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Create an append-only `audit_log` table in Supabase with INSERT-only RLS, and instrument all significant user actions across the 6 API router files to write audit entries silently and asynchronously without blocking any user-facing operation.

Actions in scope: document upload, document delete, search query, code execution, skill load, thread create, thread delete, settings change.

No frontend work in this phase. Phase 31 covers the Settings viewer UI.

</domain>

<decisions>
## Implementation Decisions

### Action Type Naming — D-01
Use **dotted namespace** format for `action_type` values:
- `document.upload`
- `document.delete`
- `search.query`
- `code.execute`
- `skill.load`
- `thread.create`
- `thread.delete`
- `settings.update`

The prefix (e.g., `document`, `search`) enables Phase 31's filter dropdown to group by category. All 8 values are the complete set for this phase.

### Action Type Column — D-02
Store `action_type` as **plain text with a CHECK constraint** listing all valid values. Do NOT use a Postgres enum. This avoids `ALTER TYPE` friction when future phases add new auditable actions.

### Audit Service Architecture — D-03
Create a **dedicated `backend/app/services/audit_service.py`** with a single async helper function (e.g., `write_audit_entry()`). Each router imports this service and calls it at the appropriate point. This keeps audit write logic centralized — changing the write mechanism later requires touching only one file, not 6 routers.

### Async Mechanism — D-04
Use **FastAPI `BackgroundTasks`** for fire-and-forget. Add `background_tasks: BackgroundTasks` as a dependency to each instrumented endpoint, then call `background_tasks.add_task(write_audit_entry, ...)` after the main operation completes. This is the request-scoped, built-in FastAPI pattern — no extra infrastructure.

### Failure Handling — D-05
On audit write failure: **catch the exception, log to stderr, and swallow it**. The user's operation is never affected. Server logs (and LangSmith if running) will show the failure. No retry, no silent discard, no LangSmith-specific path.

### Settings Change Granularity — D-06
Log **one entry per save** when `PUT /settings` is called. No field-level diff. Store the full new settings payload in the `metadata` JSONB column. Phase 31 viewer shows timestamp + "Settings updated". Simple and predictable.

### Metadata Schema — D-07 (Claude's Discretion)
The `metadata` JSONB column structure per action type:
- `document.upload` — `{document_id, filename, folder_id}`
- `document.delete` — `{document_id, filename}`
- `search.query` — `{query_text, document_ids: [...]}` (AUDIT-02 requirement)
- `code.execute` — `{thread_id, language}` or whatever sandbox context is available
- `skill.load` — `{skill_id, skill_name}`
- `thread.create` — `{thread_id}`
- `thread.delete` — `{thread_id}`
- `settings.update` — `{new_settings: {...}}` (full payload)

Exact fields are Claude's discretion — the above is the intended shape, but planner can adjust based on what data is available at each call site.

### RLS Policy — D-08 (Claude's Discretion)
`audit_log` table RLS: users can INSERT rows where `user_id = auth.uid()`. No SELECT, UPDATE, or DELETE for users. Admin reads (Phase 31 backend endpoint) use service-role key. This satisfies AUDIT-03.

### Claude's Discretion
- Table column set: `id UUID PK`, `user_id UUID FK → auth.users`, `action_type TEXT`, `metadata JSONB`, `created_at TIMESTAMPTZ DEFAULT now()`
- No `updated_at` — audit entries are immutable
- Index on `(user_id, created_at DESC)` for Phase 31 pagination performance
- The `write_audit_entry()` function signature and internal implementation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Requirements
- `.planning/REQUIREMENTS.md` §AUDIT-01 through AUDIT-06 — full requirement text
- `.planning/ROADMAP.md` §Phase 30 — success criteria (4 items)

### Related Phase Context
- `.planning/phases/29-document-versioning-ui/29-CONTEXT.md` — D-04 establishes `POST /documents/{id}/restore` endpoint (not auditable in this phase, but context for documents.py)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/dependencies.py` — `get_current_user` dependency used by all endpoints; `user_id` is available at every instrumentation point
- `backend/app/api/threads.py:send_message` — search query results are assembled here; `document_ids` from retrieval are available for `search.query` metadata
- `backend/app/api/documents.py:upload_document`, `delete_document` — instrumentation points for `document.upload`, `document.delete`
- `backend/app/api/skills.py` — `load_skill` tool dispatch is where `skill.load` should be captured
- `backend/app/api/settings.py:update_settings` — instrumentation point for `settings.update`

### Established Patterns
- All endpoints inject `supabase: Client` via dependency — the audit service can accept the same client
- Background work precedent: `ingest_document` in `documents.py:444` runs as a background thread (uses `threading.Thread`) — audit writes should use FastAPI `BackgroundTasks` instead (cleaner, request-scoped)
- Error pattern: exceptions are caught and re-raised as `HTTPException` in routers; audit errors should NOT follow this pattern — they must be swallowed

### Integration Points
- New file: `backend/app/services/audit_service.py` — imported by `threads.py`, `documents.py`, `skills.py`, `settings.py`, `folders.py` as needed
- New Supabase migration: `audit_log` table creation + RLS policies
- `threads.py:send_message` is the instrumentation point for both `search.query` and `code.execute` — both happen inside the SSE event stream generator

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 30-audit-log-backend*
*Context gathered: 2026-04-13*
