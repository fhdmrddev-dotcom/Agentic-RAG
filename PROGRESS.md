# Progress

Track your progress through the masterclass. Update this file as you complete modules - Claude Code reads this to understand where you are in the project.

## Convention
- `[ ]` = Not started
- `[-]` = In progress
- `[x]` = Completed

## Modules

### Module 1: App Shell + Observability ✅ COMPLETE
- [x] 0.1 Supabase schema (profiles, threads, messages + RLS)
- [x] 0.2 Backend scaffold (FastAPI + venv)
- [x] 0.3 Frontend scaffold (Vite + Tailwind + shadcn/ui)
- [x] 0.4 OpenAI vector store setup (run setup_vector_store.py, paste ID into backend/.env)
- [x] 1.1 Auth pages (sign in/sign up)
- [x] 2.1 Pydantic models
- [x] 2.2 OpenAI service + LangSmith tracing
- [x] 2.3 Threads & messages API
- [x] 3.1 API client + SSE utility
- [x] 3.2 Chat layout & components
- [x] 3.3 UX polish (thinking indicator, user/assistant avatars, LangSmith API key fix)

### Module 2: BYO Retrieval + Memory ✅ COMPLETE
- [x] Phase 1: Foundation (DB migration, config, types, Pydantic models)
  - [x] 1.1 DB migration: documents, document_chunks, HNSW index, RPC, Realtime
  - [x] 1.2 Backend config: LLM/embedding/retrieval settings
  - [x] 1.3 Frontend types: Document interface
  - [x] 1.4 DocumentResponse Pydantic model
- [x] Phase 2: LLM Service + Thread Model
  - [x] 2.1 openai_service.py: client factory, Chat Completions, embed_texts, tool schema
  - [x] 2.2 thread.py: removed openai_thread_id
- [x] Phase 3: Embedding + Retrieval Services
  - [x] 3.1 embedding_service.py: chunk_text, embed_chunks
  - [x] 3.2 retrieval_service.py: search_documents via pgvector RPC
- [x] Phase 4: Documents API + Threads Refactor
  - [x] 4.1 documents.py: upload/list/delete + background ingestion
  - [x] 4.2 threads.py: stateless history + tool-calling agentic loop
- [x] Phase 5: Router + Frontend API + Navigation
  - [x] 5.1 main.py: documents router registered
  - [x] 5.2 api.ts: listDocuments, uploadDocument, deleteDocument
  - [x] 5.3 Navigation: Sidebar Documents button, App/ChatLayout view routing
- [x] Phase 6: Ingestion Hook + UI Components
  - [x] 6.1 useDocuments hook with Supabase Realtime
  - [x] 6.2 IngestionPage, DocumentUpload, DocumentList, DocumentStatusBadge
- [x] Phase 7: Polish + Edge Cases
  - [x] 7.1 event_stream: length truncation, tool parse errors, API errors
  - [x] 7.2 Ingestion: empty file, UTF-8 decode error, embedding errors
  - [x] 7.3 PROGRESS.md updated

### Module 3: Record Manager ✅ COMPLETE
- [x] DB migration: `content_hash` column + indexes + unique constraint (`006_record_manager.sql`)
- [x] Backend: SHA-256 hash on upload + 3-case decision tree (skip duplicate / replace stale / new)
- [x] Pydantic: `content_hash: str | None` field on `DocumentResponse`
- [x] Frontend types: `content_hash: string | null` on `Document` interface
- [x] `api.ts`: `uploadDocument` returns `{ doc, isDuplicate }` using HTTP 200 vs 201
- [x] `useDocuments`: `upload` returns `Promise<{ isDuplicate: boolean }>`
- [x] `DocumentUpload`: shows "already up to date" notice on duplicate

### UX Enhancements (outside PRD modules) ✅ COMPLETE
- [x] Auto-title: LLM generates 4-6 word title after first exchange; sent as SSE event → sidebar updates instantly
- [x] Delete thread: `DELETE /threads/{id}`; messages cascade-delete in DB
- [x] Rename thread: `PATCH /threads/{id}`; inline edit via hover `...` menu in sidebar
- [x] `ThreadUpdate` Pydantic model; `deleteThread` + `renameThread` in api.ts + useThreads

#### Notes (Module 3)
- Run `006_record_manager.sql` in Supabase SQL editor before testing
- Existing rows will have `content_hash = null` — nullable field, no impact on existing data
- supabase-py v2: UPDATE does not return rows — do a follow-up SELECT to get updated row

### Module 4: Metadata Extraction [ ] NOT STARTED
- [ ] LLM extracts structured metadata from documents on ingestion
- [ ] Store metadata fields on `documents` table
- [ ] Filter retrieval by metadata

### Module 5: Multi-Format Support [ ] NOT STARTED
- [ ] PDF/DOCX/HTML/Markdown via docling
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
