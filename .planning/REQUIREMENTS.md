# Requirements: Agentic RAG v2.0 — Agent Skills & Code Execution

**Defined:** 2026-03-29
**Core Value:** Users can define reusable AI behaviors (skills) that the agent loads on demand, execute sandboxed Python code within conversations, and share skills using an open standard.

---

## v2.0 Requirements

### Agent Skills — Core

- [ ] **SKIL-01**: User can create a skill with a name, description, and instructions
- [ ] **SKIL-02**: User can edit an existing skill's name, description, or instructions
- [ ] **SKIL-03**: User can delete a skill they own
- [ ] **SKIL-04**: User can toggle a skill enabled/disabled (only enabled skills appear in the LLM catalog)
- [ ] **SKIL-05**: User can share a skill globally so all authenticated users can see and load it
- [ ] **SKIL-06**: User can unshare a global skill (reverts to private)
- [ ] **SKIL-07**: Skills tab in the frontend shows all user-owned and global skills with CRUD actions
- [ ] **SKIL-08**: A seed "skill-creator" global skill is pre-loaded, enabling the LLM to guide users through creating new skills via conversation

### Agent Skills — LLM Integration

- [ ] **SKIL-09**: Enabled skills catalog (name + description only, no full instructions) is injected into the system prompt on every General Mode chat turn
- [ ] **SKIL-10**: LLM can call `load_skill(skill_name)` to retrieve full instructions and file list for a skill
- [ ] **SKIL-11**: LLM can call `save_skill(name, description, instructions)` to create or update a skill from within a conversation
- [ ] **SKIL-12**: A `skill_activated` SSE event is emitted when `load_skill` is dispatched, so the UI can display a visual indicator
- [ ] **SKIL-13**: Skills tools (`load_skill`, `save_skill`, `read_skill_file`) are available in General Mode only — Explorer Mode does not receive them

### Skill Building-Block Files

- [ ] **FILE-01**: User can upload files to a skill (Python scripts, templates, reference data)
- [ ] **FILE-02**: User can delete a file from a skill
- [ ] **FILE-03**: Files are stored in the private `skill-files` Supabase Storage bucket scoped by `user_id/skill_id/filename`
- [ ] **FILE-04**: `load_skill` response includes the list of attached file names so the LLM knows what files are available
- [ ] **FILE-05**: LLM can call `read_skill_file(skill_name, filename)` to retrieve the content of a building-block file
- [ ] **FILE-06**: RLS ensures users can only access files belonging to their own skills or global skills

### Code Execution Sandbox

- [ ] **SAND-01**: When `SANDBOX_ENABLED=true`, the `execute_code` LLM tool is available in General Mode
- [ ] **SAND-02**: Each chat thread maintains a persistent Docker sandbox session (keyed by `thread_id`, TTL 30 min)
- [ ] **SAND-03**: Python sandbox runs via `llm-sandbox`, variables and installed packages persist across tool calls within the same thread
- [ ] **SAND-04**: `execute_code` supports specifying additional PyPI packages to install before execution
- [ ] **SAND-05**: Stdout and stderr are streamed in real time via SSE (`code_stdout`, `code_stderr` events) while Docker executes
- [ ] **SAND-06**: `code_execution_start` SSE event fires when execution begins; `code_execution_complete` fires with exit code, duration, and file list
- [ ] **SAND-07**: Files written to `/sandbox/output/` inside the container are uploaded to the `sandbox-outputs` Supabase Storage bucket after execution
- [ ] **SAND-08**: Sandbox-generated file metadata is stored in the `sandbox_files` table with signed download URLs accessible to the user
- [ ] **SAND-09**: Each execution is logged to the `code_executions` table (thread_id, code, exit_code, duration, created_at)
- [ ] **SAND-10**: Docker sandbox session is closed and resources released when the associated thread is deleted
- [ ] **SAND-11**: Sandbox session manager starts/stops with FastAPI application lifecycle (lifespan handler)
- [ ] **SAND-12**: Frontend displays a Code Output panel that renders stdout/stderr stream and shows download links for output files
- [ ] **SAND-13**: When `SANDBOX_ENABLED=false` (default), `execute_code` tool is not registered — no Docker dependency at startup

### Skills Open Standard (Import / Export)

- [ ] **OPEN-01**: User can export any skill they own as a ZIP file (agentskills.io format)
- [ ] **OPEN-02**: Exported ZIP contains `SKILL.md` with YAML frontmatter (name, description, license, compatibility) and skill instructions body
- [ ] **OPEN-03**: Exported ZIP includes building-block files in categorized subdirectories (`scripts/`, `references/`, `assets/`)
- [ ] **OPEN-04**: User can import a skill from a ZIP file; a new skill is created from the ZIP contents
- [ ] **OPEN-05**: Bulk import from ZIP is atomic — if SKILL.md parsing fails, no partial skill is created
- [ ] **OPEN-06**: ZIP import is safe against path traversal attacks (filenames sanitized before extraction)

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
| SKIL-01 | Phase 2 | Pending |
| SKIL-02 | Phase 2 | Pending |
| SKIL-03 | Phase 2 | Pending |
| SKIL-04 | Phase 2 | Pending |
| SKIL-05 | Phase 2 | Pending |
| SKIL-06 | Phase 2 | Pending |
| FILE-01 | Phase 2 | Pending |
| FILE-02 | Phase 2 | Pending |
| FILE-03 | Phase 2 | Pending |
| FILE-06 | Phase 2 | Pending |
| SKIL-09 | Phase 3 | Pending |
| SKIL-10 | Phase 3 | Pending |
| SKIL-11 | Phase 3 | Pending |
| SKIL-12 | Phase 3 | Pending |
| SKIL-13 | Phase 3 | Pending |
| FILE-04 | Phase 3 | Pending |
| FILE-05 | Phase 3 | Pending |
| SKIL-07 | Phase 4 | Pending |
| SKIL-08 | Phase 4 | Pending |
| OPEN-01 | Phase 5 | Pending |
| OPEN-02 | Phase 5 | Pending |
| OPEN-03 | Phase 5 | Pending |
| OPEN-04 | Phase 5 | Pending |
| OPEN-05 | Phase 5 | Pending |
| OPEN-06 | Phase 5 | Pending |
| SAND-01 | Phase 6 | Pending |
| SAND-02 | Phase 6 | Pending |
| SAND-03 | Phase 6 | Pending |
| SAND-04 | Phase 6 | Pending |
| SAND-05 | Phase 6 | Pending |
| SAND-06 | Phase 6 | Pending |
| SAND-07 | Phase 6 | Pending |
| SAND-08 | Phase 6 | Pending |
| SAND-09 | Phase 6 | Pending |
| SAND-10 | Phase 6 | Pending |
| SAND-11 | Phase 6 | Pending |
| SAND-12 | Phase 7 | Pending |
| SAND-13 | Phase 6 | Pending |

**Coverage:**
- v2.0 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 — initial definition for v2.0 milestone*
