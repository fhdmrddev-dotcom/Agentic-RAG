# Roadmap: Knowledge Base Explorer

## Overview

This milestone builds a hierarchical folder system on top of the existing Agentic RAG application and equips the AI agent with filesystem-like exploration tools. Work flows from database foundation (Phase 1) through document integration and UI (Phases 2-3) into tool implementation (Phases 4-6) and culminates in an orchestrating explorer sub-agent (Phase 7) that can navigate, search, and read the knowledge base the same way Claude Code explores codebases.

All database changes are delivered as numbered migration SQL files compatible with both local Supabase (Docker) and cloud Supabase — no platform-specific tooling required.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Folder Schema & Core APIs** - Database foundation for nested folders with global/per-user support and CRUD endpoints
- [x] **Phase 2: Document-Folder Integration** - Connect documents to folders, store full markdown, enable file and folder moves
- [x] **Phase 3: Ingestion UI** - Folder tree visualization with CRUD controls and folder-targeted uploads
- [ ] **Phase 4: Navigation Tools** - ls and tree tools for browsing folder structure
- [ ] **Phase 5: Search Tools** - grep and glob tools for content and filename searching
- [ ] **Phase 6: Read Tool** - Full document and line-range reading capability
- [ ] **Phase 7: Explorer Sub-Agent** - Orchestration agent with access to all KB tools

## Phase Details

### Phase 1: Folder Schema & Core APIs
**Goal**: The folder system exists as a first-class database entity that users can create, rename, and delete with full global/per-user visibility rules enforced
**Depends on**: Nothing (first phase)
**Requirements**: FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-05
**Schema change**: CREATE `folders` table — `(id uuid PK, user_id uuid FK auth.users, name text, parent_id uuid FK folders nullable, is_global boolean default false, created_at timestamptz, updated_at timestamptz)` with adjacency list, RLS policies, cascade deletes. Delivered as migration SQL file (works for local Docker or cloud Supabase).
**Success Criteria** (what must be TRUE):
  1. User can create a folder at any nesting depth and it persists correctly with the right parent_id relationship
  2. User can rename a folder and the new name is reflected immediately without affecting its children
  3. User can delete a folder and all nested subfolders and their documents are cascaded correctly
  4. A global folder created by any user is visible to all users; a per-user folder is visible only to its owner (RLS enforced)
  5. API endpoints for folder CRUD return correct responses and enforce Row-Level Security for all operations
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Migration SQL, Pydantic models, and CRUD API endpoints
- [x] 01-02-PLAN.md — Integration tests for folder CRUD endpoints

### Phase 2: Document-Folder Integration
**Goal**: Documents belong to folders, full extracted markdown is stored alongside chunks, and users can reorganize both files and folders
**Depends on**: Phase 1
**Requirements**: FOLDER-04, DOC-01, DOC-02, DOC-03
**Schema change**: ADD `folder_id uuid FK folders nullable` and `full_markdown text nullable` to existing `documents` table. Migration is backward-compatible — existing documents get NULL folder_id (root-level) and NULL full_markdown (re-ingest to populate).
**Success Criteria** (what must be TRUE):
  1. User can upload a file and target a specific folder; the document is stored with the correct folder_id association
  2. User can move a file to a different folder and it appears under the new folder immediately
  3. User can move a folder (including all its contents) to a different parent folder without data loss
  4. Every ingested document has its full extracted markdown stored in the database alongside its chunks, accessible for grep and read operations
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md — Migration SQL, Pydantic model updates, and API endpoint changes
- [x] 02-02-PLAN.md — Integration tests for document-folder features

### Phase 3: Ingestion UI
**Goal**: The ingestion interface displays the full folder hierarchy and lets users manage folders and target uploads without leaving the page
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. User sees the complete folder tree rendered in the ingestion UI with correct parent-child nesting at all depths
  2. Global folders and per-user folders are visually distinct in the tree (different icon, label, or color)
  3. User can create a new folder, rename an existing folder, and delete a folder entirely from the UI without page reload
  4. When a folder is selected in the tree, a file upload targets that folder and the document appears under it after ingestion completes
  5. The folder tree updates in real time as folders are created, renamed, or deleted without requiring a manual refresh
**Plans**: 3 plans
Plans:
- [x] 03-01-PLAN.md — Types, API functions, buildFolderTree utility, and useFolders hook
- [x] 03-02-PLAN.md — FolderNode, FolderCreateInput, and FolderTree components with shadcn installs
- [x] 03-03-PLAN.md — IngestionPage two-panel layout, DocumentUpload/DocumentList modifications, and visual verification

### Phase 4: Navigation Tools
**Goal**: The agent can enumerate files and folders at any path using ls and tree, with output sized to fit context window constraints
**Depends on**: Phase 3
**Requirements**: TOOL-01, TOOL-02
**Success Criteria** (what must be TRUE):
  1. Agent calls `ls(path)` and receives a flat list of all immediate files and subfolders at that path
  2. Agent calls `tree(path)` and receives a hierarchical structure showing all descendants with correct indentation
  3. Agent calls `tree(path, depth=2)` and output is truncated at the specified depth with a clear indicator that deeper content exists
  4. Both tools respect RLS — agent sees global folders plus the authenticated user's private folders, nothing else
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md — Pydantic models, shared helpers, ls endpoint with integration tests (TOOL-01)
- [ ] 04-02-PLAN.md — tree endpoint with depth-limited serialization and integration tests (TOOL-02)

### Phase 5: Search Tools
**Goal**: The agent can find documents by content pattern or filename pattern across the knowledge base
**Depends on**: Phase 4
**Requirements**: TOOL-03, TOOL-04
**Success Criteria** (what must be TRUE):
  1. Agent calls `grep(pattern)` with a regex and receives the names of documents whose extracted markdown content matches
  2. Agent calls `grep(pattern, path="/reports")` and results are scoped to that folder subtree only
  3. Agent calls `glob("*.pdf")` and receives all document names matching the pattern regardless of folder location
  4. Agent calls `glob("reports/**/*.pdf")` and results are correctly scoped to the named subtree with recursive matching
  5. Both tools return only documents the authenticated user is permitted to see (global + own private)
**Plans**: TBD

### Phase 6: Read Tool
**Goal**: The agent can retrieve full document content or any specific line range from stored markdown
**Depends on**: Phase 5
**Requirements**: TOOL-05, TOOL-06
**Success Criteria** (what must be TRUE):
  1. Agent calls `read(document_id)` and receives the complete extracted markdown for that document
  2. Agent calls `read(document_id, start_line=10, end_line=30)` and receives exactly those lines with correct boundaries
  3. Read tool returns a clear error if document_id does not exist or the user is not permitted to access it
  4. Line-range output includes the line numbers in the response so the agent can orient further reads
**Plans**: TBD

### Phase 7: Explorer Sub-Agent
**Goal**: A dedicated sub-agent orchestrates all KB tools and the document analysis sub-agent to deliver synthesized findings to the user
**Depends on**: Phase 6
**Requirements**: AGENT-01, AGENT-02, AGENT-03
**Success Criteria** (what must be TRUE):
  1. User asks a question that requires navigating the KB and the explorer sub-agent autonomously calls ls, tree, grep, glob, and/or read to gather the needed information
  2. Explorer sub-agent can invoke the existing document analysis sub-agent when deep per-document analysis is required, passing the correct document_id
  3. Explorer sub-agent returns a coherent synthesized answer — not raw JSON tool output — that directly addresses the user's question
  4. Explorer sub-agent handles the case where no matching documents are found and communicates this clearly instead of returning empty results silently
  5. Explorer sub-agent is accessible from the main chat interface as a selectable agent mode
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Folder Schema & Core APIs | 2/2 | Complete | 2026-03-21 |
| 2. Document-Folder Integration | 2/2 | Complete | 2026-03-21 |
| 3. Ingestion UI | 3/3 | Complete | 2026-03-21 |
| 4. Navigation Tools | 1/2 | In Progress|  |
| 5. Search Tools | 0/? | Not started | - |
| 6. Read Tool | 0/? | Not started | - |
| 7. Explorer Sub-Agent | 0/? | Not started | - |
