# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- 🔄 **v2.0 Agent Skills & Code Execution** — Phases 9–15 (in progress)

## Phases

<details>
<summary>✅ v1.0 Knowledge Base Explorer (Phases 1–8) — SHIPPED 2026-03-29</summary>

- [x] Phase 1: Folder Schema & Core APIs (2/2 plans) — completed 2026-03-21
- [x] Phase 2: Document-Folder Integration (2/2 plans) — completed 2026-03-21
- [x] Phase 3: Ingestion UI (3/3 plans) — completed 2026-03-21
- [x] Phase 4: Navigation Tools (2/2 plans) — completed 2026-03-22
- [x] Phase 5: Search Tools (2/2 plans) — completed 2026-03-21
- [x] Phase 6: Read Tool (2/2 plans) — completed 2026-03-22
- [x] Phase 7: Explorer Sub-Agent (2/2 plans) — completed 2026-03-22
- [x] Phase 8: Folder System Enhancements (3/3 plans) — completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details open>
<summary>🔄 v2.0 Agent Skills & Code Execution (Phases 9–15) — IN PROGRESS</summary>

- [ ] Phase 9: Persistent Tool Memory — store tool_call_id + reconstruct multi-turn history
- [ ] Phase 10: Agent Skills Core — DB schema, RLS, FastAPI router, Supabase Storage bucket
- [ ] Phase 11: Skills LLM Integration — catalog injection, load_skill / save_skill / read_skill_file tools + dispatch
- [ ] Phase 12: Skills UI — Skills tab (CRUD, toggle, share), skill-creator seed skill
- [ ] Phase 13: Skills Open Standard — ZIP import/export (agentskills.io format)
- [ ] Phase 14: Code Execution Sandbox — Docker session manager, execute_code tool, SSE streaming, DB tables
- [ ] Phase 15: Code Output UI — streaming output panel, file download links

</details>

## Phase Details

### Phase 9: Persistent Tool Memory
**Goal**: The LLM can reference prior tool call results across conversation turns without re-executing tools
**Depends on**: Nothing (modifies existing code only)
**Requirements**: TMEM-01, TMEM-02, TMEM-03, TMEM-04
**Success Criteria** (what must be TRUE):
  1. After a tool call in turn N, the LLM in turn N+1 can answer follow-up questions referencing the tool result without calling the tool again
  2. Conversation history loaded for a new turn contains proper multi-turn sequences: `assistant (tool_calls)` -> `tool (result)` -> `assistant (text)` for every prior tool-using turn
  3. Persisted tool results in the `tool_calls` JSONB column include `tool_call_id` alongside name, args, result, and status
  4. Tool results persisted in JSONB are capped at 2000 characters (existing cap preserved)
**Plans:** 1/1 plans complete
Plans:
- [x] 09-01-PLAN.md — Persist tool_call_id + reconstruct multi-turn tool call history

### Phase 10: Agent Skills Core
**Goal**: Skills exist as first-class database entities with full CRUD, global/private ownership, and file attachment support
**Depends on**: Phase 9
**Requirements**: SKIL-01, SKIL-02, SKIL-03, SKIL-04, SKIL-05, SKIL-06, FILE-01, FILE-02, FILE-03, FILE-06
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete a private skill with name, description, and instructions
  2. User can toggle a skill enabled/disabled and the state persists
  3. User can share a skill globally and unshare it; global skills are visible to all authenticated users
  4. User can upload files to a skill and delete them; files are stored in the `skill-files` Supabase Storage bucket
  5. RLS is enforced: users can only access their own skill files (and files on global skills)
**Plans:** 3/3 plans complete
Plans:
- [x] 10-01-PLAN.md — SQL migration, Pydantic models, test scaffold
- [x] 10-02-PLAN.md — Skills CRUD router (list, create, update, delete, toggle-enabled, toggle-global)
- [x] 10-03-PLAN.md — File attachment endpoints (upload, list, delete) + full suite validation

### Phase 11: Skills LLM Integration
**Goal**: The LLM discovers enabled skills from the system prompt catalog and loads full instructions on demand
**Depends on**: Phase 10
**Requirements**: SKIL-09, SKIL-10, SKIL-11, SKIL-12, SKIL-13, FILE-04, FILE-05
**Success Criteria** (what must be TRUE):
  1. Every General Mode chat turn injects the skill catalog (name + description only) into the system prompt
  2. LLM calls `load_skill(skill_name)` when the user's request matches a skill description; full instructions and file list are returned
  3. LLM calls `save_skill(name, description, instructions)` to create a skill from within a conversation
  4. LLM calls `read_skill_file(skill_name, filename)` to read a building-block file attached to a skill
  5. Explorer Mode does not receive any skill tools — only General Mode gets them
  6. A `skill_activated` SSE event is emitted when `load_skill` dispatches
**Plans:** 2/3 plans executed
Plans:
- [x] 11-01-PLAN.md — Test scaffold, tool definitions, skill catalog injection + Explorer Mode gating
- [x] 11-02-PLAN.md — Tool dispatch handlers (load_skill, save_skill, read_skill_file) + full test coverage
- [ ] 11-03-PLAN.md — Frontend skill_activated SSE handler + end-to-end verification

### Phase 12: Skills UI
**Goal**: A dedicated Skills tab provides full skill management and a seed skill-creator global skill is pre-loaded
**Depends on**: Phase 11
**Requirements**: SKIL-07, SKIL-08
**Success Criteria** (what must be TRUE):
  1. Skills tab renders in the main navigation alongside Chat and Documents tabs
  2. Skills list shows all user-owned and global skills; global skills show a badge; disabled skills are dimmed
  3. User can create, edit, enable/disable, share/unshare, and delete skills from the UI
  4. The skill-creator global skill is seeded and visible in the skills list to all users
  5. "Try in Chat" button navigates to chat with a pre-populated prompt designed to trigger the skill
**Plans**: TBD

### Phase 13: Skills Open Standard
**Goal**: Skills can be imported and exported as ZIP files in the agentskills.io open format
**Depends on**: Phase 12
**Requirements**: OPEN-01, OPEN-02, OPEN-03, OPEN-04, OPEN-05, OPEN-06
**Success Criteria** (what must be TRUE):
  1. User can export a skill as a ZIP containing `SKILL.md` (YAML frontmatter + instructions) and attached files in categorized subdirectories
  2. User can import a skill from a valid ZIP; a new skill is created with name, description, and instructions from `SKILL.md`
  3. Bulk import from a multi-skill ZIP creates each skill independently; a parsing failure for one skill does not block others but is reported
  4. ZIP files with path traversal filenames (e.g., `../../etc/passwd`) are rejected — filenames are sanitized
**Plans**: TBD

### Phase 14: Code Execution Sandbox
**Goal**: The LLM can execute Python code in a sandboxed Docker container with session persistence per thread and real-time output streaming
**Depends on**: Phase 11
**Requirements**: SAND-01, SAND-02, SAND-03, SAND-04, SAND-05, SAND-06, SAND-07, SAND-08, SAND-09, SAND-10, SAND-11, SAND-13
**Success Criteria** (what must be TRUE):
  1. When `SANDBOX_ENABLED=true`, LLM can call `execute_code(code, libraries, output_files)` in General Mode
  2. Stdout and stderr stream in real time via SSE events while the Docker container executes
  3. Variables and installed packages persist across multiple `execute_code` calls within the same thread (session-per-thread)
  4. Files written to `/sandbox/output/` are uploaded to `sandbox-outputs` storage and download links returned in `code_execution_complete` event
  5. When a thread is deleted, its Docker session is closed and resources released
  6. When `SANDBOX_ENABLED=false` (default), `execute_code` tool is not registered and Docker is never contacted
**Plans**: TBD

### Phase 15: Code Output UI
**Goal**: The chat interface displays a rich Code Output panel with real-time streaming output and downloadable files
**Depends on**: Phase 14
**Requirements**: SAND-12
**Success Criteria** (what must be TRUE):
  1. Chat renders a Code Output panel when an `execute_code` tool call is dispatched
  2. Panel shows Python badge, status indicator (spinner/check/error), and execution time
  3. Stdout (green) and stderr (red) lines stream in real time as Docker executes — not buffered until completion
  4. Completed executions show download cards for each generated file with filename, size, and working download link
  5. Error state shows a clear error message with red styling
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Folder Schema & Core APIs | v1.0 | 2/2 | Complete | 2026-03-21 |
| 2. Document-Folder Integration | v1.0 | 2/2 | Complete | 2026-03-21 |
| 3. Ingestion UI | v1.0 | 3/3 | Complete | 2026-03-21 |
| 4. Navigation Tools | v1.0 | 2/2 | Complete | 2026-03-22 |
| 5. Search Tools | v1.0 | 2/2 | Complete | 2026-03-21 |
| 6. Read Tool | v1.0 | 2/2 | Complete | 2026-03-22 |
| 7. Explorer Sub-Agent | v1.0 | 2/2 | Complete | 2026-03-22 |
| 8. Folder System Enhancements | v1.0 | 3/3 | Complete | 2026-03-28 |
| 9. Persistent Tool Memory | v2.0 | 1/1 | Complete   | 2026-03-29 |
| 10. Agent Skills Core | v2.0 | 3/3 | Complete    | 2026-03-31 |
| 11. Skills LLM Integration | v2.0 | 2/3 | In Progress|  |
| 12. Skills UI | v2.0 | 0/? | Pending | — |
| 13. Skills Open Standard | v2.0 | 0/? | Pending | — |
| 14. Code Execution Sandbox | v2.0 | 0/? | Pending | — |
| 15. Code Output UI | v2.0 | 0/? | Pending | — |
