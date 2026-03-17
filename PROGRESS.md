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
- [x] 1. DB migration: `content_hash` column + indexes + unique constraint
- [x] 2. Backend: SHA-256 hash + 3-case decision tree (skip / replace / new)
- [x] 3. Pydantic: `content_hash` field on `DocumentResponse`
- [x] 4. Frontend types: `content_hash` on `Document` interface
- [x] 5. `api.ts`: `uploadDocument` returns `{ doc, isDuplicate }`
- [x] 6. `useDocuments`: `upload` returns `{ isDuplicate }`
- [x] 7. `DocumentUpload`: duplicate notice UI

#### Notes (Module 3)
- Run `006_record_manager.sql` in Supabase SQL editor before testing
- Existing rows will have `content_hash = null` — GET /documents will still work (field is nullable)

### Module 4: Chat Thread Management ✅ COMPLETE
- [x] 1. Auto-title: LLM generates 4-6 word title after first message exchange; sent as SSE event, updates sidebar instantly
- [x] 2. Delete thread: `DELETE /threads/{id}` endpoint; messages cascade-delete in DB; sidebar updates instantly
- [x] 3. Rename thread: `PATCH /threads/{id}` endpoint; inline edit in sidebar on hover → `...` menu → Rename
- [x] 4. `ThreadUpdate` Pydantic model
- [x] 5. `api.ts`: `deleteThread`, `renameThread` functions
- [x] 6. `useThreads`: `deleteThread`, `renameThread`, `updateThreadTitle` callbacks
- [x] 7. `ChatLayout`: wires title update callback to ChatArea
- [x] 8. `ChatArea`: accepts `onTitleUpdate` prop, passes to `sendMessage`
- [x] 9. `useMessages`: passes `onTitleUpdate` through to `streamMessage`
- [x] 10. `Sidebar`: hover `...` menu per thread with Rename (inline input) + Delete (trash)

#### Notes (Module 4)
- No DB migration needed — uses existing `threads` table
- Auto-title fires only on first exchange (history has exactly 1 message when stream starts)
- supabase-py v2: UPDATE requires a follow-up SELECT to return the updated row

#### Notes (Module 2)
- Run `002_module2_byo_retrieval.sql` in Supabase SQL editor before starting backend
- Create a `documents` Storage bucket in Supabase dashboard (public or private)
- Update `backend/.env`: replace OPENAI_API_KEY with LLM_API_KEY, add LLM_MODEL, EMBEDDING_MODEL, etc.
