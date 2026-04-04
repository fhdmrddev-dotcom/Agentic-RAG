## What This Is

A hands-on course where you collaborate with Claude Code to build a full-featured RAG system and AI agent platform. You're not the one writing code — Claude is. Your job is to guide it, understand what you're building, and course-correct when needed.

**You don't need to know how to code.** You do need to be technically minded and willing to learn about APIs, databases, and system architecture.

## What You'll Build

**v1.0 — Knowledge Base Explorer**
- **Chat interface** with threaded conversations, streaming, tool calls, and subagent reasoning
- **Document ingestion** with drag-and-drop upload and processing status
- **Full RAG pipeline**: chunking, embedding, hybrid search, reranking
- **Agentic patterns**: text-to-SQL, web search, subagents with isolated context
- **Knowledge Base filesystem**: nested folders, `ls` / `tree` / `grep` / `glob` / `read` tools
- **Explorer mode**: dedicated KB-focused agent that navigates your documents like a codebase

**v2.0 — Agent Skills & Code Execution**
- **Agent Skills**: define reusable AI behaviors (name, description, instructions) — the agent discovers and loads them automatically from a catalog injected into every chat
- **Skill file attachments**: attach reference files (templates, scripts, data) to skills; the LLM reads them on demand via `read_skill_file`
- **Skills UI**: full CRUD tab — create, edit, enable/disable, share globally, import/export
- **Skills Open Standard**: ZIP import/export compatible with agentskills.io (`SKILL.md` frontmatter format)
- **Code Execution Sandbox**: Docker-based Python sandbox (`llm-sandbox`) with session persistence per thread, real-time stdout/stderr streaming via SSE, and file harvesting to Supabase Storage
- **Code Output UI**: streaming terminal panel with download cards for generated files
- **Persistent Tool Memory**: tool call results stored in JSONB and replayed as proper multi-turn OpenAI history — LLM can reference prior tool results without re-running tools

## Tech Stack

| Layer          | Tech                                                             |
| -------------- | ---------------------------------------------------------------- |
| Frontend       | React, TypeScript, Tailwind, shadcn/ui, Vite                    |
| Backend        | Python, FastAPI                                                  |
| Database       | Supabase (Postgres + pgvector + Auth + Storage + Realtime)       |
| Doc Processing | pypdf, python-docx (PDF, DOCX, HTML, Markdown)                  |
| AI Models      | Local (LM Studio / Ollama) or Cloud (OpenAI, OpenRouter)        |
| Code Sandbox   | Docker + llm-sandbox (opt-in via `SANDBOX_ENABLED=true`)        |
| Observability  | LangSmith                                                        |
| Design System  | Aether Intelligence — dark/light mode, Inter + Manrope, glassmorphism |

## The Modules

### Core Modules (v1.0 foundation)

1. **App Shell** — Auth, chat UI, managed RAG with OpenAI Responses API
2. **BYO Retrieval + Memory** — Ingestion, pgvector, switch to generic completions API
3. **Record Manager** — Content hashing, deduplication
4. **Metadata Extraction** — LLM-extracted metadata, filtered retrieval
5. **Multi-Format Support** — PDF, DOCX, HTML, Markdown
6. **Hybrid Search & Reranking** — Keyword + vector search, RRF, reranking
7. **Additional Tools** — Text-to-SQL, web search fallback, multi-tool loop
8. **Subagents** — Isolated context, document analysis delegation

### v1.0 Milestone: Knowledge Base Explorer (Phases 1–8)

| Phase | What it builds |
|-------|---------------|
| 1 | Folder schema + CRUD API (adjacency list, RLS, global/private) |
| 2 | Document-folder integration (`folder_id` FK, `full_markdown` storage, move endpoints) |
| 3 | Ingestion UI with folder tree, targeting, and folder CRUD |
| 4 | `ls` + `tree` navigation tools |
| 5 | `grep` (content search) + `glob` (filename pattern) tools |
| 6 | `read_document` tool (full doc or line-range) |
| 7 | Explorer mode — KB-only agent with dedicated system prompt |
| 8 | Global folders, folder-scoped chat threads, folder detail info bar |

### v2.0 Milestone: Agent Skills & Code Execution (Phases 9–17)

| Phase | What it builds |
|-------|---------------|
| 9  | Persistent Tool Memory — `tool_call_id` in JSONB, multi-turn history reconstruction |
| 10 | Agent Skills Core — DB schema, RLS, CRUD API, Supabase Storage bucket |
| 11 | Skills LLM Integration — catalog injection, `load_skill` / `save_skill` / `read_skill_file` |
| 12 | Skills UI — Skills tab, SkillCard, SkillFormDialog, seed skill-creator global skill |
| 13 | Skills Open Standard — ZIP import/export (agentskills.io format) |
| 14 | Code Execution Sandbox — Docker, SSE streaming, file harvesting, DB tables |
| 15 | Code Output UI — `ExecuteCodeBlock` panel, streaming terminal, download cards |
| 16 | Skill File Management UI — upload/list/delete files on skills |
| 17 | Tech Debt Cleanup — stale checkboxes, missing VERIFICATION.md, tool count fix |

## Getting Started

1. Clone this repo
2. Install [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
3. Open in your IDE (Cursor, VS Code, etc.)
4. Run `claude` in the terminal
5. Use the `/onboard` command to get started

### For Code Execution (v2.0)

6. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
7. Add `SANDBOX_ENABLED=true` to `backend/.env`
8. The sandbox starts automatically on first `execute_code` tool call

## Docs

- [PROGRESS.md](./PROGRESS.md) — Full build progress, notes, and migration checklist per phase
- [SKILLS_GUIDE.md](./SKILLS_GUIDE.md) — How to create, import, and use Agent Skills (including the weekly report example)
- [CLAUDE.md](./CLAUDE.md) — Context and rules for Claude Code
- [PRD.md](./PRD.md) — Original product requirements (Modules 1–8)

## Join the Community

If you want to connect with hundreds of builders creating production-grade AI and RAG systems, join us in [The AI Automators community](https://www.theaiautomators.com/). Share your progress, get help when you're stuck, and see what others are building.
