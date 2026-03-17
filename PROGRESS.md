# Progress

Track your progress through the masterclass. Update this file as you complete modules - Claude Code reads this to understand where you are in the project.

## Convention

- `[ ]` = Not started
- `[-]` = In progress
- `[x]` = Completed

## Modules

### Module 1: App Shell + Observability ✅ COMPLETE

- [X] 0.1 Supabase schema (profiles, threads, messages + RLS)
- [X] 0.2 Backend scaffold (FastAPI + venv)
- [X] 0.3 Frontend scaffold (Vite + Tailwind + shadcn/ui)
- [X] 0.4 OpenAI vector store setup (run setup_vector_store.py, paste ID into backend/.env)
- [X] 1.1 Auth pages (sign in/sign up)
- [X] 2.1 Pydantic models
- [X] 2.2 OpenAI service + LangSmith tracing
- [X] 2.3 Threads & messages API
- [X] 3.1 API client + SSE utility
- [X] 3.2 Chat layout & components
- [X] 3.3 UX polish (thinking indicator, user/assistant avatars, LangSmith API key fix)

### Module 2: BYO Retrieval + Memory ✅ COMPLETE

- [X] Phase 1: Foundation (DB migration, config, types, Pydantic models)
  - [X] 1.1 DB migration: documents, document_chunks, HNSW index, RPC, Realtime
  - [X] 1.2 Backend config: LLM/embedding/retrieval settings
  - [X] 1.3 Frontend types: Document interface
  - [X] 1.4 DocumentResponse Pydantic model
- [X] Phase 2: LLM Service + Thread Model
  - [X] 2.1 openai_service.py: client factory, Chat Completions, embed_texts, tool schema
  - [X] 2.2 thread.py: removed openai_thread_id
- [X] Phase 3: Embedding + Retrieval Services
  - [X] 3.1 embedding_service.py: chunk_text, embed_chunks
  - [X] 3.2 retrieval_service.py: search_documents via pgvector RPC
- [X] Phase 4: Documents API + Threads Refactor
  - [X] 4.1 documents.py: upload/list/delete + background ingestion
  - [X] 4.2 threads.py: stateless history + tool-calling agentic loop
- [X] Phase 5: Router + Frontend API + Navigation
  - [X] 5.1 main.py: documents router registered
  - [X] 5.2 api.ts: listDocuments, uploadDocument, deleteDocument
  - [X] 5.3 Navigation: Sidebar Documents button, App/ChatLayout view routing
- [X] Phase 6: Ingestion Hook + UI Components
  - [X] 6.1 useDocuments hook with Supabase Realtime
  - [X] 6.2 IngestionPage, DocumentUpload, DocumentList, DocumentStatusBadge
- [X] Phase 7: Polish + Edge Cases
  - [X] 7.1 event_stream: length truncation, tool parse errors, API errors
  - [X] 7.2 Ingestion: empty file, UTF-8 decode error, embedding errors
  - [X] 7.3 PROGRESS.md updated

### Module 3: Record Manager ✅ COMPLETE

- [X] DB migration: `content_hash` column + indexes + unique constraint (`006_record_manager.sql`)
- [X] Backend: SHA-256 hash on upload + 3-case decision tree (skip duplicate / replace stale / new)
- [X] Pydantic: `content_hash: str | None` field on `DocumentResponse`
- [X] Frontend types: `content_hash: string | null` on `Document` interface
- [X] `api.ts`: `uploadDocument` returns `{ doc, isDuplicate }` using HTTP 200 vs 201
- [X] `useDocuments`: `upload` returns `Promise<{ isDuplicate: boolean }>`
- [X] `DocumentUpload`: shows "already up to date" notice on duplicate

### UX Enhancements (outside PRD modules) ✅ COMPLETE

- [X] Auto-title: LLM generates 4-6 word title after first exchange; sent as SSE event → sidebar updates instantly
- [X] Delete thread: `DELETE /threads/{id}`; messages cascade-delete in DB
- [X] Rename thread: `PATCH /threads/{id}`; inline edit via hover `...` menu in sidebar
- [X] `ThreadUpdate` Pydantic model; `deleteThread` + `renameThread` in api.ts + useThreads

#### Notes (Module 3)

- Run `006_record_manager.sql` in Supabase SQL editor before testing
- Existing rows will have `content_hash = null` — nullable field, no impact on existing data
- supabase-py v2: UPDATE does not return rows — do a follow-up SELECT to get updated row

### Module 4: Metadata Extraction ✅ COMPLETE

- [X] DB migration: `metadata` JSONB column + GIN index + updated `match_document_chunks` RPC (`007_document_metadata.sql`)
- [X] Pydantic: `DocumentMetadata` model (title, author, date, document_type, topics, language, summary)
- [X] Backend: `extract_metadata()` in `embedding_service.py` — LLM structured JSON output, best-effort (never blocks ingestion)
- [X] Backend: `ingest_document()` calls `extract_metadata()` and persists result to `documents.metadata`
- [X] Retrieval: `search_documents()` accepts optional `metadata_filter` dict, passes to RPC
- [X] Agent: `SEARCH_DOCUMENTS_TOOL` updated with optional `metadata_filter` parameter
- [X] Threads: parses `metadata_filter` from tool call args, passes to retrieval
- [X] Frontend types: `DocumentMetadata` interface + `metadata` field on `Document`
- [X] Frontend UI: expandable metadata panel in `DocumentList` (chevron toggle, topics as pill badges)

#### Notes (Module 4)

- Run `007_document_metadata.sql` then `007b_fix_match_document_chunks_overload.sql` in Supabase SQL editor before starting the backend
- Existing documents will have `metadata = null` — no impact on existing data or retrieval
- Metadata extraction uses `content[:3000]` to keep token usage low (~750 tokens per document)
- Uses `json_object` response format for broad OpenRouter/Ollama/LM Studio compatibility
- Extraction is best-effort — failures are logged but never block ingestion
- System prompt updated to guide LLM to use `metadata_filter` for scoped queries
- Sidebar fix: replaced Radix ScrollArea with plain div (ScrollArea viewport doesn't constrain child widths), three-dots menu uses absolute overlay with solid bg

### Module 5: Multi-Format Support ✅ COMPLETE

- [X] PDF extraction (pypdf), DOCX extraction (python-docx), HTML, Markdown — all supported
- [X] Cascade deletes (document_chunks → documents via ON DELETE CASCADE)

### Module 6: Hybrid Search & Reranking ✅ COMPLETE

- [X] DB migration: `search_vector tsvector` column + GIN index + trigger + backfill (`008_hybrid_search.sql`)
- [X] DB migration: dimension-agnostic `match_document_chunks` — removes `vector(1536)` hardcode (`008b_dynamic_vector_match.sql`)
- [X] Config: `hybrid_search_enabled`, `hybrid_candidate_count`, `vector/keyword_search_weight`, `rrf_k`, `embedding_dimensions`, `rerank_*` settings
- [X] `rerank_service.py`: API (Cohere via httpx) + local (sentence-transformers CrossEncoder, lazy-loaded), graceful fallback, LangSmith traceable
- [X] `retrieval_service.py`: hybrid RRF fusion (`_vector_search` + `_keyword_search` + `_rrf_fuse`), optional reranking, backward-compatible vector-only fallback
- [X] `requirements.txt`: added `sentence-transformers>=3.0.0`

#### Notes (Module 6)

- Run `008_hybrid_search.sql` then `008b_dynamic_vector_match.sql` in Supabase SQL editor
- Hybrid search is **enabled by default** (`HYBRID_SEARCH_ENABLED=true`) — set to `false` to revert to vector-only
- Reranking is **disabled by default** (`RERANK_ENABLED=false`) — no Cohere key required for normal operation
- Local reranking (`RERANK_PROVIDER=local`) auto-downloads `cross-encoder/ms-marco-MiniLM-L-6-v2` (~80MB) on first use
- Switching embedding models requires: update `EMBEDDING_MODEL` + `EMBEDDING_DIMENSIONS`, run `SELECT resize_embedding_column(N)`, re-ingest all documents

### Module 6.1: UI Settings — LLM Providers, Embedding, Reranking & Retrieval ✅ COMPLETE

- [X] DB migration: `009_user_settings_extended.sql` — adds llm_providers (JSONB), embedding_*, rerank_*, retrieval_* columns
- [X] `backend/app/models/user_settings.py` — `LLMProvider`, `UserEffectiveSettings`, `load_user_settings()`
- [X] `backend/app/api/settings.py` — full CRUD: GET /settings, PUT /providers, DELETE /providers/{id}, PATCH /providers/{id}/activate, PUT /embedding, PUT /reranking, PUT /retrieval
- [X] `backend/app/services/openai_service.py` — `get_llm_client()`, `get_embedding_client()`, `create_streaming_chat()`, `embed_texts()` accept optional `user_settings`
- [X] `backend/app/services/rerank_service.py` — `rerank()` accepts optional `user_settings`
- [X] `backend/app/services/retrieval_service.py` — `search_documents()` accepts optional `user_settings`; all config reads from effective settings
- [X] `backend/app/api/threads.py` — loads `UserEffectiveSettings` per-request, passes to all services
- [X] `frontend/src/lib/api.ts` — `FullAppSettings` type, new API functions for all settings sections
- [X] `frontend/src/pages/SettingsPage.tsx` — full rewrite: LLM Providers, Embedding, Reranking, Retrieval sections
- [X] `frontend/src/components/chat/ChatArea.tsx` — reads available_models from getSettings() (active provider)

#### Notes (Module 6.1)

- Run `009_user_settings_extended.sql` in Supabase SQL editor before starting the backend
- All new user_settings columns are nullable — NULL = use env default (zero user impact on existing rows)
- API keys are write-only: GET responses return `has_api_key: bool` only; empty string on PUT = keep existing key
- First provider added auto-activates; switching active provider updates chat model dropdown on next load

### Module 6.2: Settings Architecture Refactor ✅ COMPLETE

- [X] DB migration: `010_app_settings.sql` — global `app_settings` table (single row, `id='global'`); replaces per-user settings
- [X] DB migration: `011_cleanup_user_settings.sql` — drops all env-related columns from `user_settings`; adds `preferences jsonb` for future UI prefs
- [X] `backend/app/models/user_settings.py` — `load_app_settings(supabase)` reads global row + `.env` fallback; `_v()` treats NULL and empty string as unset
- [X] `backend/app/api/settings.py` — all settings read from `.env`; Settings UI is fully read-only (no DB writes)
- [X] `backend/app/services/openai_service.py` — `get_embedding_client()` falls back to `llm_api_key` + `llm_base_url` together (prevents key/endpoint mismatch)
- [X] `backend/app/api/documents.py` — replaced stale `user_settings` read with `load_app_settings()`
- [X] `frontend/src/pages/SettingsPage.tsx` — fully read-only dashboard showing LLM, Embedding, Reranking, Retrieval values from `.env`

#### Notes (Module 6.2)

- Run `010_app_settings.sql` then `011_cleanup_user_settings.sql` in Supabase SQL editor
- All settings come from `.env` — Settings page is an inspection dashboard only
- `user_settings` table is reserved for future user-specific UI preferences

#### Deferred: UI-Based LLM Provider Configuration

**Goal:** Allow adding/switching local model providers (Ollama, LM Studio, etc.) via the Settings UI without touching `.env`.

**What's needed:**
- Fix the root cause: old uvicorn process (different terminal session) stays alive on port 8000 with stale code after hot-reload — write logic must handle this gracefully, or document a restart requirement
- Implement: `PUT /settings/providers`, `DELETE /settings/providers/{id}`, `PATCH /settings/providers/{id}/activate` writing to `app_settings.llm_providers`
- The `app_settings` table and backend API already support this (migrations + handlers exist but UI is disabled)
- Re-enable editable LLM Providers section in `SettingsPage.tsx`

### Module 7: Additional Tools [ ] NOT STARTED

- [ ] Text-to-SQL tool
- [ ] Web search fallback

### Module 8: Sub-Agents [ ] NOT STARTED

- [ ] Detect full-document scenarios
- [ ] Spawn isolated sub-agent with its own tools
- [ ] Nested tool call display in UI

#### Notes (Module 2)

- Run `002_module2_byo_retrieval.sql` in Supabase SQL editor before starting backend
- Create a `documents` Storage bucket in Supabase dashboard (public or private)
- Update `backend/.env`: replace OPENAI_API_KEY with LLM_API_KEY, add LLM_MODEL, EMBEDDING_MODEL, etc.
