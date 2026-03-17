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

### Module 5: Multi-Format Support [ ] NOT STARTED

- [ ] PDF/DOCX/HTML/Markdown via docling (PDF and docx are already implemented)
- [ ] Cascade deletes

### Module 6: Hybrid Search & Reranking [ ] NOT STARTED

- [ ] Keyword + vector search
- [ ] RRF combination
- [ ] Reranking

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
