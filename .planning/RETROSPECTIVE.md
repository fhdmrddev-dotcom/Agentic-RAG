# Retrospective

Living retrospective — updated at each milestone boundary.

---

## Milestone: v1.0 — Knowledge Base Explorer

**Shipped:** 2026-03-29
**Phases:** 8 | **Plans:** 18 | **Tasks:** 22
**Timeline:** 2026-03-16 → 2026-03-29 (13 days)
**Commits:** ~137

### What Was Built

- Postgres adjacency-list `folders` table with RLS and 5 CRUD API endpoints
- Document-folder integration: `folder_id` FK, `full_markdown` storage, move endpoints
- Ingestion UI with full folder tree, CRUD controls, and folder-targeted uploads
- `ls` and `tree` tools for KB navigation (depth limits + truncation for context safety)
- `grep` (content regex) and `glob` (filename pattern) search tools
- `read` tool for full document or line-range retrieval from stored markdown
- Explorer sub-agent: backend mode branching on `agent_mode` with KB-only tool set and dedicated system prompt
- General/Explorer mode selector dropdown in chat toolbar
- Global folder sharing via updated RLS
- Folder-scoped chat threads with recursive subtree RAG scoping
- Folder detail info bar in ingestion UI

### What Worked

- **Plan-first approach** — Each phase had a concrete PLAN.md with must-have truths before execution; made agent runs predictable and auditable
- **Shared helpers pattern** — Extracting `ls_path()` / `tree_path()` into reusable helpers (Phase 4) paid dividends in grep, glob, and folder-scoped chat
- **Python-side subtree resolution** — Preferred over SQL CTEs; simpler to test and reason about
- **Quick tasks for bug fixes** — Using `/gsd:quick` for post-milestone bugs kept the main phase flow clean
- **conftest mock builder wiring** — Establishing `.is_`, `.or_`, `.neq()`, `.limit()` globally early on prevented repeated test failures

### What Was Inefficient

- **07-02 SUMMARY never written** — The frontend mode selector was built but no SUMMARY.md was created; milestone completion was blocked until it was written manually
- **Phase ordering** — Phase 8 was executed before Phase 7 fully completed (07-02 was skipped); the ROADMAP showed Phase 7 as incomplete even though Phase 8 was done
- **Duplicate Validated sections in PROJECT.md** — Two `### Validated` blocks accumulated during milestone; caught and fixed at milestone completion

### Patterns Established

- **agent_mode branching** — `tools_override=None` signals default mode; `tools_override=[...]` signals explorer mode. Clean pattern for future agent modes
- **SECURITY DEFINER RPC bypass** — `match_document_chunks` RPC bypasses RLS by design; no need to update `document_chunks` RLS for new access patterns
- **ON DELETE SET NULL** — Used for both `documents.folder_id` and `threads.folder_id`; preferred over CASCADE to preserve data on folder delete

### Key Lessons

- Write SUMMARY.md immediately after executing a plan — don't defer it
- When skipping a plan during execution, explicitly mark it in ROADMAP and STATE at the time, not later
- Quick task commits should reference the task ID in the message for traceability
- `conftest` mock builder gaps surface late in test runs — audit builder wiring at phase start

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: multiple across 13 days
- Notable: Phase executions consistently 1–8 min per plan; quick tasks added ~4 post-milestone

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Avg Plans/Phase | Timeline |
|-----------|--------|-------|-----------------|----------|
| v1.0 KB Explorer | 8 | 18 | 2.25 | 13 days |
