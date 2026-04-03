# Requirements: Agentic RAG v2.0 — Agent Skills & Code Execution

**Defined:** 2026-03-29
**Core Value:** Users can define reusable AI behaviors (skills) that the agent loads on demand, execute sandboxed Python code within conversations, and share skills using an open standard.

---

## v2.0 Requirements

### Agent Skills — Core

- [x] **SKIL-01**: User can create a skill with a name, description, and instructions
- [x] **SKIL-02**: User can edit an existing skill's name, description, or instructions
- [x] **SKIL-03**: User can delete a skill they own
- [x] **SKIL-04**: User can toggle a skill enabled/disabled (only enabled skills appear in the LLM catalog)
- [x] **SKIL-05**: User can share a skill globally so all authenticated users can see and load it
- [x] **SKIL-06**: User can unshare a global skill (reverts to private)
- [x] **SKIL-07**: Skills tab in the frontend shows all user-owned and global skills with CRUD actions
- [ ] **SKIL-08**: A seed "skill-creator" global skill is pre-loaded, enabling the LLM to guide users through creating new skills via conversation

### Agent Skills — LLM Integration

- [x] **SKIL-09**: Enabled skills catalog (name + description only, no full instructions) is injected into the system prompt on every General Mode chat turn
- [x] **SKIL-10**: LLM can call `load_skill(skill_name)` to retrieve full instructions and file list for a skill
- [x] **SKIL-11**: LLM can call `save_skill(name, description, instructions)` to create or update a skill from within a conversation
- [x] **SKIL-12**: A `skill_activated` SSE event is emitted when `load_skill` is dispatched, so the UI can display a visual indicator
- [x] **SKIL-13**: Skills tools (`load_skill`, `save_skill`, `read_skill_file`) are available in General Mode only — Explorer Mode does not receive them

### Skill Building-Block Files

- [x] **FILE-01**: User can upload files to a skill (Python scripts, templates, reference data)
- [x] **FILE-02**: User can delete a file from a skill
- [x] **FILE-03**: Files are stored in the private `skill-files` Supabase Storage bucket scoped by `user_id/skill_id/filename`
- [x] **FILE-04**: `load_skill` response includes the list of attached file names so the LLM knows what files are available
- [x] **FILE-05**: LLM can call `read_skill_file(skill_name, filename)` to retrieve the content of a building-block file
- [x] **FILE-06**: RLS ensures users can only access files belonging to their own skills or global skills

### Code Execution Sandbox

- [ ] **SAND-01**: When `SANDBOX_ENABLED=true`, the `execute_code` LLM tool is available in General Mode
- [x] **SAND-02**: Each chat thread maintains a persistent Docker sandbox session (keyed by `thread_id`, TTL 30 min)
- [x] **SAND-03**: Python sandbox runs via `llm-sandbox`, variables and installed packages persist across tool calls within the same thread
- [x] **SAND-04**: `execute_code` supports specifying additional PyPI packages to install before execution
- [x] **SAND-05**: Stdout and stderr are streamed in real time via SSE (`code_stdout`, `code_stderr` events) while Docker executes
- [x] **SAND-06**: `code_execution_start` SSE event fires when execution begins; `code_execution_complete` fires with exit code, duration, and file list
- [ ] **SAND-07**: Files written to `/sandbox/output/` inside the container are uploaded to the `sandbox-outputs` Supabase Storage bucket after execution
- [ ] **SAND-08**: Sandbox-generated file metadata is stored in the `sandbox_files` table with signed download URLs accessible to the user
- [x] **SAND-09**: Each execution is logged to the `code_executions` table (thread_id, code, exit_code, duration, created_at)
- [ ] **SAND-10**: Docker sandbox session is closed and resources released when the associated thread is deleted
- [x] **SAND-11**: Sandbox session manager starts/stops with FastAPI application lifecycle (lifespan handler)
- [ ] **SAND-12**: Frontend displays a Code Output panel that renders stdout/stderr stream and shows download links for output files
- [x] **SAND-13**: When `SANDBOX_ENABLED=false` (default), `execute_code` tool is not registered — no Docker dependency at startup

### Skills Open Standard (Import / Export)

- [x] **OPEN-01**: User can export any skill they own as a ZIP file (agentskills.io format)
- [x] **OPEN-02**: Exported ZIP contains `SKILL.md` with YAML frontmatter (name, description, license, compatibility) and skill instructions body
- [x] **OPEN-03**: Exported ZIP includes building-block files in categorized subdirectories (`scripts/`, `references/`, `assets/`)
- [x] **OPEN-04**: User can import a skill from a ZIP file; a new skill is created from the ZIP contents
- [x] **OPEN-05**: Bulk import from ZIP is atomic — if SKILL.md parsing fails, no partial skill is created
- [x] **OPEN-06**: ZIP import is safe against path traversal attacks (filenames sanitized before extraction)

### Persistent Tool Memory

- [x] **TMEM-01**: When the LLM calls a tool, the `tool_call_id` is stored alongside the tool name, args, and result in the `messages.tool_calls` JSONB column (no schema change required)
- [x] **TMEM-02**: When loading conversation history for a new turn, assistant messages with tool calls are reconstructed as proper multi-turn sequences: `assistant (tool_calls)` → `tool (result)` → `assistant (text)`
- [x] **TMEM-03**: The LLM can reference prior tool results across conversation turns without re-executing the tool
- [x] **TMEM-04**: Persisted tool results are capped at 2000 characters to prevent database bloat (existing behavior preserved)

---

## v3 Requirements (Deferred)

### Skill Marketplace

- **MRKT-01**: User can browse a public directory of community-published skills
- **MRKT-02**: User can one-click install a skill from the directory into their account
- **MRKT-03**: User can rate and review skills
- **MRKT-04**: Publisher can see install count and ratings for their published skills

### Multi-Language Sandbox

- **MLNG-01**: Sandbox supports Node.js execution in addition to Python
- **MLNG-02**: Sandbox supports R execution for data science workflows
- **MLNG-03**: LLM can select runtime language per `execute_code` call

### Scheduled Skills

- **SCHD-01**: User can schedule a skill to run on a cron schedule
- **SCHD-02**: Scheduled skill results are stored and surfaced in the UI
- **SCHD-03**: User can view execution history for scheduled skills

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full skill instructions injected into every system prompt | Anti-pattern — 10 skills × avg instructions = 5-15k tokens per request. Progressive catalog/load pattern used instead |
| Explorer Mode gets skill or sandbox tools | Explorer Mode is KB-navigation-only by design contract |
| Automated skill connectors / triggers | Adds orchestration complexity not needed in v2.0 |
| LangChain / LangGraph for skill orchestration | Project constraint: raw SDK calls only |
| Real-time collaborative skill editing | Niche, high complexity, not in PRD |
| Docker-in-Docker for sandbox isolation | Overkill for local dev; `llm-sandbox` security policy sufficient |
| Non-Python sandbox languages in v2.0 | Python covers 95% of data analysis use cases; other runtimes deferred to v3 |
| Admin UI for skill moderation | Config via env vars / DB; no admin UI project-wide |
| Skill versioning / history | Future concern; v2.0 treats save as overwrite |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TMEM-01 | Phase 1 | Complete |
| TMEM-02 | Phase 1 | Complete |
| TMEM-03 | Phase 1 | Complete |
| TMEM-04 | Phase 1 | Complete |
| SKIL-01 | Phase 2 | Complete |
| SKIL-02 | Phase 2 | Complete |
| SKIL-03 | Phase 2 | Complete |
| SKIL-04 | Phase 2 | Complete |
| SKIL-05 | Phase 2 | Complete |
| SKIL-06 | Phase 2 | Complete |
| FILE-01 | Phase 2 | Complete |
| FILE-02 | Phase 2 | Complete |
| FILE-03 | Phase 2 | Complete |
| FILE-06 | Phase 2 | Complete |
| SKIL-09 | Phase 3 | Complete |
| SKIL-10 | Phase 3 | Complete |
| SKIL-11 | Phase 3 | Complete |
| SKIL-12 | Phase 3 | Complete |
| SKIL-13 | Phase 3 | Complete |
| FILE-04 | Phase 3 | Complete |
| FILE-05 | Phase 3 | Complete |
| SKIL-07 | Phase 4 | Complete |
| SKIL-08 | Phase 4 | Pending |
| OPEN-01 | Phase 5 | Complete |
| OPEN-02 | Phase 5 | Complete |
| OPEN-03 | Phase 5 | Complete |
| OPEN-04 | Phase 5 | Complete |
| OPEN-05 | Phase 5 | Complete |
| OPEN-06 | Phase 5 | Complete |
| SAND-01 | Phase 6 | Pending |
| SAND-02 | Phase 6 | Complete |
| SAND-03 | Phase 6 | Complete |
| SAND-04 | Phase 6 | Complete |
| SAND-05 | Phase 6 | Complete |
| SAND-06 | Phase 6 | Complete |
| SAND-07 | Phase 6 | Pending |
| SAND-08 | Phase 6 | Pending |
| SAND-09 | Phase 6 | Complete |
| SAND-10 | Phase 6 | Pending |
| SAND-11 | Phase 6 | Complete |
| SAND-12 | Phase 7 | Pending |
| SAND-13 | Phase 6 | Complete |

**Coverage:**
- v2.0 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — initial definition for v2.0 milestone*
