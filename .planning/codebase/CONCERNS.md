# Concerns & Technical Debt
_Generated: 2026-03-21_

## Summary

The codebase is generally well-structured with intentional safeguards (RLS, user-scoped queries, DOMPurify). The most actionable concerns are the backend's use of a single service-role Supabase client that bypasses RLS (requiring manual scoping that can drift), unbounded message history being sent to the LLM on every request, and two divergent migration directories that could cause confusion. Several features are incomplete stubs (user-specific settings, UI-based LLM provider configuration), and a few silent exception handlers hide operational failures.

---

## High Priority

### Service-Role Client Bypasses RLS — Manual Scoping Required
- **Issue:** `backend/app/dependencies.py` creates a single Supabase client using `supabase_service_role_key`, which bypasses all RLS policies. Every query must manually append `.eq("user_id", current_user["id"])` to scope data. Missing this filter on any new endpoint would silently expose other users' data.
- **Files:** `backend/app/dependencies.py` (line 15), `backend/app/services/sql_service.py` (lines 13–32)
- **Impact:** Data isolation depends entirely on developer discipline. No DB-level enforcement exists for queries made through this client.
- **Fix approach:** Consider creating a per-request Supabase client using the user's JWT (anon key + `Authorization` header) so RLS applies automatically. The service-role client would only be needed for admin operations.

### `app_settings` Table Has No RLS Policies
- **Issue:** `supabase/migrations/010_app_settings.sql` creates the `app_settings` table but never calls `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and defines no policies. Any authenticated user could read (and potentially write) global API keys stored there (embedding key, rerank key, LLM providers).
- **Files:** `supabase/migrations/010_app_settings.sql`
- **Impact:** Credential exposure if any Supabase anon-key client ever touches this table. Currently only service-role reads it, but this is fragile.
- **Fix approach:** Add `ENABLE ROW LEVEL SECURITY` and a policy that allows only service-role access, or restrict the table to server-side reads only.

### Unbounded Message History Sent to LLM on Every Request
- **Issue:** `backend/app/api/threads.py` (lines 184–196) loads the entire thread history from the DB and prepends it to every LLM call with no token/message count limit. Long conversations will eventually exceed the model's context window, causing API errors that surface only as generic failures.
- **Files:** `backend/app/api/threads.py` (lines 184–196)
- **Impact:** API errors and degraded quality on long threads. Cost also grows linearly with thread length.
- **Fix approach:** Implement a sliding window (e.g., keep last N messages or stay under a token budget). The `finish_reason == "length"` truncation note on line 243 handles the response side but not the input side.

### SQL Injection Risk in `query_documents` / `_inject_user_id`
- **Issue:** `backend/app/services/sql_service.py` uses regex string manipulation to inject `user_id = '{user_id}'` directly into the SQL string (line 23, 30, 32). The `user_id` comes from the validated JWT, so it is a UUID (low risk in practice), but the approach is structurally unsafe and could break with unexpected UUID formats or future refactors. The DB-side `query_user_documents` RPC uses `EXECUTE format(...)` which is also a dynamic SQL execution pattern — mitigated by the SELECT-only guard but still worth noting.
- **Files:** `backend/app/services/sql_service.py` (lines 13–32), `supabase/migrations/012_query_documents_fn.sql`
- **Impact:** Low immediate risk (UUID is validated by auth), but non-parameterized injection pattern is a code smell that fails security audits.
- **Fix approach:** Pass `user_id` as a parameterized bind variable to the RPC rather than string-interpolating it.

---

## Medium Priority

### Two Divergent Migration Directories
- **Issue:** There are two separate migration directories: `supabase/migrations/` (13 files, canonical, used for Supabase CLI) and `backend/supabase/migrations/` (8 files, stale subset). The backend copy is missing migrations `006` through `009` and `013`. This creates confusion about which is the source of truth.
- **Files:** `supabase/migrations/`, `backend/supabase/migrations/`
- **Impact:** A developer following `backend/supabase/migrations/` would set up an incomplete schema. CI/CD pipelines pointing to the wrong directory would miss schema changes.
- **Fix approach:** Delete `backend/supabase/migrations/` or add a README clearly marking it as deprecated. The `supabase/migrations/` directory is the canonical source.

### LangSmith Tracing Enabled by Default — Sends Data Externally
- **Issue:** `backend/app/config.py` (line 62) defaults `langsmith_tracing` to `"true"`. This means all LLM calls, retrieval queries, and web searches are traced and sent to LangSmith even if no `LANGSMITH_API_KEY` is set. When no key is set, this likely fails silently or logs warnings; when a key is set, all user query content is sent externally.
- **Files:** `backend/app/config.py` (lines 60–63), `backend/app/main.py` (lines 8–12)
- **Impact:** Privacy concern — user document content and queries are sent to LangSmith. Also a latency overhead for every traced call.
- **Fix approach:** Default `langsmith_tracing` to `"false"` and require explicit opt-in. Check if tracing silently no-ops when key is absent (current behavior is unclear).

### No File Size Limit on Document Upload
- **Issue:** `backend/app/api/documents.py` (line 58) reads the entire uploaded file into memory with `await file.read()` but performs no size check. Only an empty-file guard exists (line 59–63). Very large files (hundreds of MB) would be fully loaded into RAM before rejection.
- **Files:** `backend/app/api/documents.py` (lines 58–64)
- **Impact:** Memory exhaustion on the backend server from a single large upload. Denial-of-service vector.
- **Fix approach:** Add a size check after reading (e.g., reject if `len(raw) > 50_000_000`) or use FastAPI's `UploadFile` chunked reading with a size cap.

### `load_user_settings` Is a Stub — Per-User Settings Not Implemented
- **Issue:** `backend/app/models/user_settings.py` (lines 78–79) defines `load_user_settings(user_id, supabase=None)` which simply calls `load_app_settings()` and ignores both arguments. The function signature implies per-user overrides are planned but the implementation is global-only.
- **Files:** `backend/app/models/user_settings.py` (lines 78–79)
- **Impact:** The `user_settings` DB table (with `preferences jsonb` column) exists but is never read. Any future per-user customization work must not assume this function provides isolation.
- **Fix approach:** Either implement per-user settings or rename to `load_global_settings()` throughout to remove the misleading signature.

### UI-Based LLM Provider Configuration Is Disabled
- **Issue:** Per PROGRESS.md (line 162–166), the editable LLM Providers section in `SettingsPage.tsx` was intentionally disabled. The DB table (`app_settings.llm_providers`) and migration exist, but the write API endpoints and UI are commented out or removed. The `LLMProvider` model still exists in `backend/app/models/user_settings.py` (lines 10–16) but is unused.
- **Files:** `backend/app/models/user_settings.py` (lines 10–16), `frontend/src/pages/SettingsPage.tsx`
- **Impact:** Users cannot switch LLM providers without editing `.env` and restarting the server. The dead code creates maintenance confusion.
- **Fix approach:** Either implement the feature or remove the `LLMProvider` model and `llm_providers` column to reduce noise.

### Silent Storage Upload Failures During Ingestion
- **Issue:** `backend/app/api/documents.py` (lines 122–129) silently swallows storage upload failures with `except Exception: pass`. The document is still ingested into the DB, but the original file is not stored in Supabase Storage. Similarly, storage removal on stale document replacement (lines 92–95) silently ignores errors.
- **Files:** `backend/app/api/documents.py` (lines 92–95, 122–129, 168–171)
- **Impact:** Documents show as "completed" but their original files are missing from storage. Delete operations also silently fail to clean up storage.
- **Fix approach:** At minimum log these failures with a warning. Consider whether storage failure should be surfaced to the user or retried.

### No Rate Limiting or Request Throttling
- **Issue:** No rate limiting exists on any endpoint. The `/threads/{thread_id}/messages` route is the most expensive (triggers LLM calls, embeddings, and potentially web search), but there is no per-user throttle, request queue, or concurrency guard.
- **Files:** `backend/app/main.py`, `backend/app/api/threads.py`
- **Impact:** A single user can flood the backend with concurrent LLM requests, exhausting API rate limits and inflating costs. Malicious users could abuse the system.
- **Fix approach:** Add middleware-level rate limiting (e.g., `slowapi`) or a per-user request queue.

---

## Low Priority / Nice to Have

### Bare `except Exception` on Storage Delete in `delete_document`
- **Issue:** `backend/app/api/documents.py` (lines 168–171) silently ignores storage removal failures during document deletion. No logging occurs.
- **Files:** `backend/app/api/documents.py` (lines 168–171)
- **Fix approach:** Add `logger.warning(...)` on failure for operational visibility.

### `generate_thread_title` Makes a Synchronous Blocking LLM Call Inside an Async Handler
- **Issue:** `backend/app/api/threads.py` (lines 101–120) calls `client.chat.completions.create(...)` synchronously inside the async `event_stream()` generator. This blocks the event loop during title generation.
- **Files:** `backend/app/api/threads.py` (lines 101–120, 350–355)
- **Fix approach:** Move title generation to a `BackgroundTasks` call after the stream completes, or use the async OpenAI client.

### Frontend Errors Silently Swallowed via `catch(console.error)`
- **Issue:** Several `useEffect` calls use `.catch(console.error)` for data loading failures with no user-visible error state: `ChatArea.tsx` (lines 26, 31), `Sidebar.tsx` (line 40), `useDocuments.ts` (line 25). If these API calls fail (e.g., network down, token expired), the UI shows blank state with no explanation.
- **Files:** `frontend/src/components/chat/ChatArea.tsx` (lines 26, 31), `frontend/src/components/layout/Sidebar.tsx` (line 40), `frontend/src/hooks/useDocuments.ts` (line 25)
- **Fix approach:** Surface loading errors in UI state (toast, inline message, or error boundary).

### `marked` Runs Synchronously — No Async Rendering
- **Issue:** `frontend/src/components/chat/MarkdownRenderer.tsx` (line 14) calls `marked.parse(content)` synchronously on every render. For large LLM responses this runs on the React render thread.
- **Files:** `frontend/src/components/chat/MarkdownRenderer.tsx`
- **Fix approach:** Use `marked.parseAsync()` or memoize with `useMemo`.

### Duplicate Markdown Libraries
- **Issue:** `frontend/package.json` includes both `marked` (^17.0.4) and `react-markdown` (^10.1.0). `MarkdownRenderer.tsx` uses `marked`; `react-markdown` appears unused in the current UI (likely a leftover from an earlier approach).
- **Files:** `frontend/package.json`
- **Fix approach:** Remove whichever library is not used to reduce bundle size.

### `tool_calls` Not Loaded on Page Refresh
- **Issue:** Per PROGRESS.md (line 199), `tool_calls` are persisted to the DB (`messages.tool_calls` JSONB column via migration `013`) but `backend/app/api/threads.py` (line 196) only loads `role, content` columns — it never selects `tool_calls`. The `MessageResponse` model also does not include this field. So the ToolCallPanel is blank on page reload even though data exists in the DB.
- **Files:** `backend/app/api/threads.py` (line 196), `backend/app/models/message.py`
- **Impact:** Tool call history is invisibly persisted but never surfaced after a refresh. The PROGRESS.md note treats this as known/acceptable, but it is a UX gap.
- **Fix approach:** Add `tool_calls` to the messages SELECT and `MessageResponse` model.

### `chunk_text` Uses Character-Count Chunking With No Semantic Awareness
- **Issue:** `backend/app/services/embedding_service.py` uses a simple character-offset chunking algorithm with a sentence-boundary heuristic. This produces poor chunks for tables, code blocks, and structured documents (DOCX, HTML).
- **Files:** `backend/app/services/embedding_service.py` (lines 10–41)
- **Impact:** Retrieval quality degrades for structured content. Not a bug, but a known retrieval quality limit.
- **Fix approach:** Consider token-aware chunking or document-structure-aware splitting for future modules.

### `openai_thread_id` Orphan Column in `threads` Schema
- **Issue:** `supabase/migrations/001_initial_schema.sql` (line 53) includes `openai_thread_id text not null default ''` from Module 1's OpenAI Assistants integration. This column was made obsolete in Module 2 (BYO retrieval). It is never read or written in the current codebase.
- **Files:** `supabase/migrations/001_initial_schema.sql` (line 53)
- **Fix approach:** Add a migration to drop the column, or leave it harmless until a schema cleanup pass.

---

## TODOs Found in Code

No explicit `TODO`, `FIXME`, `HACK`, or `XXX` comments were found in the codebase source files. Deferred work is tracked in `PROGRESS.md` under "Deferred" sections:

- **`PROGRESS.md` lines 159–166:** "Deferred: UI-Based LLM Provider Configuration" — write endpoints for `PUT /settings/providers`, `DELETE /settings/providers/{id}`, `PATCH /settings/providers/{id}/activate` and re-enable editable LLM Providers section in `SettingsPage.tsx`.
