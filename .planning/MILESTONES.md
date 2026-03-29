# Milestones

## v1.0 Knowledge Base Explorer (Shipped: 2026-03-29)

**Phases completed:** 8 phases, 18 plans, 22 tasks

**Key accomplishments:**

- Postgres adjacency-list folders table with RLS, 4 policies, cascade delete, and 5 FastAPI CRUD endpoints covering create/list/list-children/rename/delete with service-role ownership enforcement
- 23 integration tests across 5 test classes verifying folder create/list/rename/delete endpoints with ownership enforcement, global visibility, whitespace stripping, and parent_id validation
- Migration 014 adds folder_id FK and full_markdown to documents; upload and move endpoints wire documents and folders together with ownership-enforced PATCH /move routes.
- 51 passing integration tests covering upload-with-folder, document move, folder move, and full_markdown storage — with conftest builder fix enabling multi-query mock patterns.
- One-liner:
- One-liner:
- One-liner:
- FastAPI /kb/ls endpoint with in-memory tree path resolution, Pydantic response models, and 5 passing integration tests covering root listing, subfolder listing, 404, empty folder, and RLS filtering
- GET /kb/tree endpoint with depth-limited recursive folder serialization, truncation indicators, and 4 integration tests — completes TOOL-02 and Phase 4 navigation tools
- GET /kb/glob endpoint with glob_path helper: filename pattern matching using
- BookOpen icon, "Reading document" label, and collapsible ReadDocumentResult component added to ToolCallPanel for read_document tool call display
- One-liner:
- One-liner:
- RLS migration + PATCH toggle-global endpoint + Globe button in folder tree hover actions + isGlobal checkbox in create input
- Migration + backend subtree resolution + frontend folder picker and scope badges — scoped threads auto-restrict RAG retrieval and KB tools to the selected folder subtree
- New FolderDetail component showing compact stats bar (doc count, size, global badge, subfolder count, creation date) mounted in IngestionPage between breadcrumb and upload

---
