# Architecture
_Last updated: 2026-04-05_

## High-Level System Design

```
Browser (React + Vite)
        │
        │  REST + SSE  (VITE_API_BASE_URL → http://localhost:8000)
        ▼
FastAPI Backend (Python, port 8000)
        │                         │
        │  supabase-py             │  openai SDK (OpenAI-compatible)
        ▼                         ▼
Supabase (Postgres +         LLM Provider
 pgvector + Auth +           (OpenAI / Anthropic /
 Storage + Realtime)         Google / OpenRouter / Ollama)
```

All API calls from the frontend include a Supabase JWT in `Authorization: Bearer <token>`. The backend validates the token by calling `supabase.auth.get_user(token)` via the service-role client in `backend/app/dependencies.py`. The service-role key bypasses database RLS; RLS is enforced on direct client-side Supabase queries (Realtime, auth).

## Module Breakdown

The codebase was built through numbered modules. Current status is in `PROGRESS.md`.

| Module | What it added |
|--------|---------------|
| 1 | App shell: FastAPI + Vite scaffold, Supabase auth, basic chat (OpenAI Assistants — since replaced) |
| 2 | BYO Retrieval: document upload, pgvector embeddings, RAG tool-calling agent, SSE streaming, Supabase Realtime ingestion status |
| 3 | Record Manager: SHA-256 dedup, stale-file replacement |
| 4 | Metadata Extraction: LLM-structured JSON metadata per document, `metadata_filter` on search |
| 5 | Multi-Format Support: PDF (pypdf), DOCX (python-docx), HTML, Markdown |
| 6 | Hybrid Search + Reranking: `keyword_search_chunks` RPC + RRF fusion, optional Cohere/local reranker |
| 6.1 | Settings UI (per-user provider overrides — later reverted) |
| 6.2 | Settings Refactor: global `app_settings` table; settings page is read-only dashboard |
| 7 | Additional Tools: Text-to-SQL (`query_documents`), web search (Tavily), multi-file upload |
| 8 | Sub-Agents: `analyze_document` tool — isolated streaming LLM call on full document content |
| KB v1.0 | Folder system, KB explorer tools (ls/tree/grep/glob/read_document), folder-scoped threads |
| v2.0 | Agent Skills: skills catalog, `load_skill`/`save_skill`/`read_skill_file` tools, Docker sandbox code execution |

## Key Subsystems

### Authentication

- **Provider:** Supabase Auth (email + password)
- **Frontend:** `frontend/src/hooks/useAuth.ts` wraps `supabase.auth.*`. `App.tsx` gates all views behind `user !== null`.
- **Backend:** `backend/app/dependencies.py` — `get_current_user()` FastAPI dependency validates the JWT on every request. Returns `{id, email}` dict injected via `Depends()`.
- **Supabase client:** A single service-role client is created lazily in `get_supabase()` (singleton). Service role bypasses RLS so the backend can read/write on behalf of any user.

### Row-Level Security (RLS)

All tables have RLS enabled. General pattern: `auth.uid() = user_id`.

**Exceptions with broader visibility:**
- `folders`: `auth.uid() = user_id OR is_global = true`
- `skills`: `auth.uid() = user_id OR is_global = true`
- `skill_files`: own rows OR linked skill has `is_global = true`
- `storage.objects` for `skill-files` bucket: own path prefix OR linked skill is global

**Backend access pattern:** The backend uses the service-role client (bypasses RLS). User isolation is enforced by explicitly adding `.eq("user_id", current_user["id"])` to every query, or via the Python-level `fetch_visible_folders()` logic in `backend/app/utils/folder_utils.py` for global folder subtrees.

**Realtime subscriptions:** Frontend subscribes without a `user_id` column filter. RLS policies on the Realtime publication ensure users only receive their own row events.

### Document Ingestion Pipeline

Upload → Text Extraction → Chunking → Embedding → Storage → Realtime Status Updates

**Detailed steps (`backend/app/api/documents.py`):**

1. `POST /documents/upload` (multipart form: `file`, optional `folder_id`)
2. MIME type validation — allowed: `text/plain`, `text/markdown`, `text/html`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
3. Folder ownership validated if `folder_id` provided (only owner may upload into a folder)
4. SHA-256 hash computed on raw bytes
5. **Dedup check (folder-scoped):** if identical hash + `status=completed` in same folder → return HTTP 200 (skip re-ingestion)
6. **Stale check:** if same filename with different hash → delete old doc + storage object, then proceed
7. Text extracted synchronously: PDF via `pypdf.PdfReader`, DOCX via `python-docx`, others decoded as UTF-8
8. Document row inserted (`status=pending`); file uploaded to Supabase Storage bucket `documents` at `{user_id}/{doc_id}/{filename}`
9. FastAPI `BackgroundTasks` queues `ingest_document()` — returns HTTP 201 immediately
10. **Background task (`ingest_document`):**
    - `status → processing` (Realtime UPDATE fires → frontend shows "processing")
    - `chunk_text()` → overlapping fixed-size chunks with sentence-boundary snapping
    - `embed_chunks()` → calls embedding model via openai-compatible API
    - Bulk insert into `document_chunks` table (content + vector embedding)
    - `extract_metadata()` — LLM call for structured JSON (best-effort, never blocks)
    - `status → completed`, stores `chunk_count`, `metadata`, `full_markdown`

**Frontend awareness:** `useDocuments` (`frontend/src/hooks/useDocuments.ts`) subscribes to Supabase Realtime `postgres_changes` on the `documents` table. UPDATE events patch status in-place; INSERT events prepend new rows; DELETE events remove rows.

### RAG / Chat Architecture

**Stateless history:** No server-side session. Each `POST /threads/{id}/messages` loads full message history from `messages` table, reconstructs it into OpenAI-compatible multi-turn format, prepends the system prompt, then calls the LLM.

**History reconstruction** (`_reconstruct_history()` in `backend/app/api/threads.py`): Messages with persisted `tool_calls` are expanded into three entries: (1) `assistant` + `tool_calls`, (2) `tool` result messages, (3) `assistant` text. This reconstructs the exact wire format OpenAI expects for multi-turn tool use.

**Agentic loop** (`event_stream()` in `backend/app/api/threads.py`):

```
for iteration in range(max_iterations):   # default 12; explorer mode 8
    stream = create_streaming_chat(messages, ...)
    buffer tool_call deltas from stream
    if finish_reason == "tool_calls":
        execute tools, append results to messages
        continue
    else:
        break   # natural stop
# Final iteration forces tool_choice="none" to prevent infinite loops
```

**Tool roster (13 tools in default mode):**
- `ls`, `tree`, `grep`, `glob`, `read_document` — KB filesystem navigation (implemented in `backend/app/api/kb.py`)
- `search_documents` — vector/hybrid semantic search with optional `metadata_filter`
- `query_documents` — SQL SELECT via Supabase RPC (Text-to-SQL)
- `analyze_document` — sub-agent: full-document analysis via isolated streaming LLM call
- `web_search` — Tavily API (tool excluded entirely when `TAVILY_API_KEY` absent)
- `load_skill`, `save_skill`, `read_skill_file` — skill catalog operations
- `execute_code` — Docker sandbox Python execution (excluded when `SANDBOX_ENABLED=false`)

**Agent modes:** `default` (all 13 tools, 12 iterations) or `explorer` (KB navigation tools only, 8 iterations, `EXPLORER_SYSTEM_PROMPT`). Mode sent as `agent_mode` field in POST body.

**Folder-scoped threads:** A thread can have a `folder_id`. When set, the backend resolves the full subtree of that folder, injects a scope note into the system prompt, and restricts relevant tool results to that subtree.

**Skills catalog injection:** On each chat request in default mode, enabled skills (own + global) are fetched and appended to the system prompt as a markdown catalog. LLM calls `load_skill(skill_name)` to get full instructions.

**Context budget:** Tool results in the reconstructed `messages` array are capped to 3,000 chars (10,000 for `analyze_document`) to prevent unbounded context growth across many iterations.

### SSE Streaming Architecture

**Backend:** `event_stream()` is an `AsyncGenerator[str, None]` returned as `StreamingResponse`. Emits newline-delimited `data: <json>\n\n` events.

**SSE event types:**

| Event type | Payload | Purpose |
|---|---|---|
| `delta` | `{content}` | LLM text token chunk |
| `title` | `{content}` | Auto-generated thread title after first exchange |
| `tool_start` | `{name, args}` | Tool call beginning |
| `tool_end` | `{name, result}` | Tool call result |
| `sub_agent_start` | `{filename, task}` | Analyze-document sub-agent starting |
| `sub_agent_delta` | `{content}` | Sub-agent token stream |
| `sub_agent_done` | — | Sub-agent finished |
| `skill_activated` | `{skill_name}` | `load_skill` tool resolved a skill |
| `code_execution_start` | `{code_preview}` | Sandbox execution starting |
| `code_stdout` | `{content}` | Sandbox stdout line |
| `code_stderr` | `{content}` | Sandbox stderr line |
| `code_execution_complete` | `{exit_code, duration_ms, output_files, error}` | Sandbox finished |
| `[DONE]` | — | Stream complete |

**Frontend parsing:** `streamMessage()` in `frontend/src/lib/api.ts` reads the response body as a `ReadableStream`, buffers incomplete lines across chunks, and dispatches each event type to callback functions. Unknown types are silently ignored.

### Supabase Realtime Usage

Three tables are added to the `supabase_realtime` publication:

| Table | Subscribed by | Purpose |
|---|---|---|
| `documents` | `useDocuments` hook | Ingestion status updates (pending → processing → completed/failed) |
| `folders` | `useFolders` hook | Folder create/rename/delete/global-toggle sync |
| `messages` | Not subscribed (pulled on demand) | — |

Realtime channels use the `postgres_changes` API. No `user_id` filter is applied on the channel (avoids needing `REPLICA IDENTITY FULL`). RLS on the table enforces row isolation.

### Hybrid Search & Retrieval

`backend/app/services/retrieval_service.py`

**Vector search:** Embeds query text → calls `match_document_chunks` Supabase RPC (pgvector cosine similarity, HNSW index). Accepts optional `metadata_filter` (JSONB containment `@>`) and `folder_ids` scope list.

**Keyword search:** Calls `keyword_search_chunks` RPC (Postgres `tsvector` GIN index, full-text `@@` operator).

**RRF fusion:** `_rrf_fuse()` — `score(d) = Σ weight / (k + rank_i(d))`. `k=60` by default. Both vector and keyword weights configurable.

**Reranking (optional):** `backend/app/services/rerank_service.py` — API mode (Cohere via httpx) or local mode (sentence-transformers `CrossEncoder`, lazy-loaded). Graceful fallback if reranker unavailable.

Config: `HYBRID_SEARCH_ENABLED=true` (default), `RERANK_ENABLED=false` (default).

### Folder System

**Schema:** `folders` table — adjacency list with self-referencing `parent_id`, `is_global` boolean. Documents linked via nullable `folder_id` FK with `ON DELETE SET NULL`. Migrations: `014_folders.sql`, `015_global_folder_document_rls.sql`, `019_global_folder_subtree_visibility.sql`.

**Visibility logic** (`backend/app/utils/folder_utils.py`):
- `fetch_visible_folders()` — returns all folders a user can see: owned folders + any folder that is itself global or has a global ancestor (recursive tree walk with memoization cache)
- `get_globally_visible_folder_ids()` — returns IDs of foreign-owned folders in global subtrees (used by `list_documents` to include global folder contents)
- `is_in_global_subtree()` — recursive ancestor check

**KB Explorer tools** (`backend/app/api/kb.py`): `ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path` are pure Python functions callable both as HTTP handlers (`GET /kb/ls` etc.) and directly from the agent tool loop in `threads.py`.

### Skills System

**Schema:** `skills` table (name, description, instructions, `is_enabled`, `is_global`) + `skill_files` table for file attachments. RLS: own rows + global. Supabase Storage bucket `skill-files` at `{user_id}/{skill_id}/{filename}`. Migration `017_skills.sql`.

**Skill catalog injection:** On each chat request in default mode, enabled skills (own + global) are fetched and appended to the system prompt as a markdown list.

**YAML import/export:** `backend/app/api/skills.py` supports bulk import from ZIP archives containing `SKILL.md` files with YAML frontmatter + markdown body.

### Code Execution Sandbox

`backend/app/services/sandbox_service.py` — `SandboxSessionManager` maintains `InteractiveSandboxSession` instances (from `llm-sandbox[docker]`) keyed by `thread_id`. Sessions persist within a thread (variables and installed packages survive between calls in the same thread). Sessions are evicted after `SANDBOX_TTL_MINUTES` idle time and closed on app shutdown. Entirely gated by `SANDBOX_ENABLED=false` default (Docker SDK not imported when disabled).

### Settings Architecture

Settings resolution priority: `settings_override.json` > `.env` > pydantic defaults.

- `backend/app/config.py` — `Settings` (pydantic-settings) reads from `.env`. LLM provider resolution via `@model_validator`: `LLM_PROVIDER` env var selects provider; resolved to `llm_api_key` / `llm_base_url`. Supported: `openai`, `anthropic`, `google`, `openrouter`, `ollama`.
- `backend/app/models/user_settings.py` — `load_user_settings()` merges env defaults with `settings_override.json`. `UserEffectiveSettings` is passed to all services per-request.
- Settings page in UI is **read-only** — it displays current effective values. No writes to DB.

## Data Flow: Upload → Ingest → Chat

```
1. User drags file onto DocumentUpload (frontend)
2. useDocuments.upload() → POST /documents/upload (multipart)
3. Backend: dedup check → text extract → insert documents row (status=pending)
4. Backend: file upload to Supabase Storage bucket
5. BackgroundTask: ingest_document()
   a. status → processing  →  Realtime UPDATE → frontend shows "processing"
   b. chunk_text() → embed_chunks() → insert document_chunks rows
   c. extract_metadata() (best-effort, never blocks)
   d. status → completed   →  Realtime UPDATE → frontend shows "completed"
6. User opens chat, types message
7. POST /threads/{id}/messages (JSON body: content, model, agent_mode)
8. Backend: insert user message → event_stream() yields SSE
9. Backend: load history → reconstruct OpenAI messages → enter agentic loop
10. LLM responds with tool_call: search_documents
    a. embed query → match_document_chunks RPC → optional rerank
    b. tool_start SSE → frontend shows ToolCallPanel
    c. tool result appended to messages
11. LLM generates final answer → delta SSE events stream token-by-token
12. Loop ends → [DONE] SSE event
13. Backend: persist assistant message (content + tool_calls) to messages table
14. (First exchange only) generate_thread_title() → title SSE → sidebar updates
```

## Error Handling Strategy

- **Ingestion failures:** Caught in background `ingest_document()`; `status → failed`, `error_message` persisted to DB.
- **LLM API errors:** `openai.APIError` caught in `event_stream()`; error note emitted; stream closes.
- **Tool execution errors:** Each tool wrapped in `try/except`; error string returned as tool result so LLM can handle gracefully.
- **Response truncation:** `finish_reason == "length"` appends a `*[Response truncated]*` note and breaks the loop.
- **Metadata extraction:** `extract_metadata()` returns `None` on any failure — never blocks ingestion.
- **Null bytes:** `_strip_nul()` recursively removes PostgreSQL-illegal `\x00` bytes from all strings before DB writes.
