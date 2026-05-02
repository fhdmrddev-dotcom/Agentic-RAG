# Agentic RAG — AI Agent Platform

## What This Is

A RAG-based AI agent platform where users organize documents into nested folders and interact with a customizable AI agent. The agent remembers preferences across threads, extracts tables and images from documents, shows confidence and citations, runs code in a sandbox, and can be taught new skills that persist. The Deep Midnight visual design delivers a glassmorphic, mobile-responsive experience with knowledge health dashboards and user feedback loops.

## Core Value

The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

## Current Milestone: v2.5 SSE Concurrency & Reconnect Stability

**Goal:** Resolve the Phase 057 deferral by fixing the dominant backend concurrency blocker (sync supabase calls in async event_stream) and shipping a correct frontend reconnect architecture (race fixes + visibilitychange + Resume button).

**Target features:**
- Backend SSE handler doesn't block other requests during long agent loops (cross-tab GET < 1s during streaming)
- Long-running agent loops decoupled from request lifetime (background task + asyncio.Queue + sse-starlette)
- Frontend race conditions eliminated (setViewingThread separation, AbortController-based cancellation, finally-block reload removed)
- Tab-switch (Symptom E) and F5-mid-stream (Symptom F) recover reliably without breaking Stop (G) or thread navigation (H)
- Reproducible browser-based test harness so future SSE work can be validated in isolation

**Key context:** Two prior implementation attempts failed (`057-DEFERRAL.md`). Authoritative research saved at `.planning/research/058-sse-concurrency-research.md`: `run_in_threadpool` is the immediate fix; `--workers N` masks the bug; Supabase Realtime is best-effort, not at-least-once.

## Current State

**Shipped:** v2.4 (Stability, Polish & UX Fixes) — 2026-04-30
**Active:** v2.5 (SSE Concurrency & Reconnect Stability) — started 2026-05-01
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage)
**Codebase:** ~57,000 LOC (Python + TypeScript), 72 files changed in v2.4
**Phases shipped:** 57 phases across 6 milestones (v1.0–v2.4), 80+ plans executed
**Design system:** Aether Intelligence — Deep Midnight theme, glassmorphic cards, gradient accents, mobile-responsive
**Docker:** `llm-sandbox` container for code execution (`SANDBOX_ENABLED=true`)
**Known tech debt:** STREAM-02a closed by Phase 060 (frontend race fixes); STREAM-04 (run-backed streaming for Claude/ChatGPT-class refresh + multi-tab + navigate-away survival) scoped to v2.5 phases 061 (Run-Backed Streaming Backend with Redis Streams per D-v2.5-08), 062 (Replay & Tail API), 063 (Frontend Stream Decoupling — also delivers STREAM-02b); 064 validates the chain; 065 (Skills Test Infra Repair) parallel-able. SKILL-01/02 (catalog full-inject, deferred to Skills Studio); human UAT gaps for Phases 45, 46, 48

## Requirements

### Validated

*Pre-existing (from prior modules):*

- ✓ Chat interface with SSE streaming — Module 1
- ✓ Document ingestion with multi-format support (PDF, DOCX, HTML, Markdown via pypdf + python-docx) — Module 5
- ✓ Hybrid search (keyword + vector with RRF fusion) — Module 6
- ✓ Document analysis sub-agent (loads full document into isolated context) — Module 8
- ✓ Tool calling framework (multi-tool dispatch loop) — Module 7
- ✓ Row-Level Security for per-user data isolation — Module 2
- ✓ Supabase Auth with JWT verification — Module 1
- ✓ Thread and message management — Module 1
- ✓ Real-time ingestion status via Supabase Realtime — Module 2
- ✓ Metadata extraction (LLM-structured JSON) — Module 4
- ✓ Record manager (deduplication via SHA-256) — Module 3
- ✓ Text-to-SQL tool (`query_documents`) — Module 7
- ✓ Web search fallback (Tavily) — Module 7

*v1.0 milestone:*

- ✓ Nested folder structure with unlimited depth — v1.0 Phase 1
- ✓ Global folders (shared across all users) and per-user folders (private) — v1.0 Phase 1
- ✓ Document-folder integration (folder_id FK on documents, move document, move folder) — v1.0 Phase 2
- ✓ Store full extracted markdown alongside chunks for grep/read operations — v1.0 Phase 2
- ✓ Folder CRUD in ingestion UI (create, rename, delete folders) — v1.0 Phase 3
- ✓ Upload files to selected folder in UI — v1.0 Phase 3
- ✓ `ls` tool — list files and subfolders in a given path — v1.0 Phase 4
- ✓ `tree` tool — hierarchical structure with depth limit and truncation — v1.0 Phase 4
- ✓ `grep` tool — regex search over document content, returns matching document names — v1.0 Phase 5
- ✓ `glob` tool — file pattern matching against document names — v1.0 Phase 5
- ✓ `read` tool — read full document or line range — v1.0 Phase 6
- ✓ Explorer sub-agent — orchestrates KB tools for synthesized exploration answers — v1.0 Phase 7
- ✓ Explorer mode selector in chat UI (General / Explorer toggle) — v1.0 Phase 7
- ✓ Visual indicator for global vs per-user folders — v1.0 Phase 8
- ✓ Global folder RLS: documents in global folders readable by all authenticated users — v1.0 Phase 8
- ✓ Folder-scoped chat threads: RAG retrieval auto-scoped to folder subtree — v1.0 Phase 8
- ✓ Folder detail info bar: compact stats in ingestion UI — v1.0 Phase 8

*v2.0 milestone:*

- ✓ Persistent Tool Memory — store tool results in JSONB, reconstruct full tool call history on conversation load — v2.0 Phase 9
- ✓ Agent Skills Core — skills table with CRUD, global/private ownership, RLS, Supabase Storage bucket — v2.0 Phase 10
- ✓ Skill File Attachments — upload/list/delete files on skills — v2.0 Phase 10
- ✓ Skill tool dispatch (`load_skill`, `save_skill`, `read_skill_file`) wired into LLM chat loop — v2.0 Phase 11
- ✓ Skill catalog injection into General Mode system prompt; Explorer Mode gated out — v2.0 Phase 11
- ✓ `skill_activated` SSE event emitted on tool dispatch; frontend Zap indicator — v2.0 Phase 11/12
- ✓ Skills UI — Skills tab with full CRUD, toggle, share, "Try in Chat" — v2.0 Phase 12
- ✓ Skill-creator seed skill pre-loaded as global skill — v2.0 Phase 12
- ✓ Skills Open Standard ZIP import/export (agentskills.io format) — v2.0 Phase 13
- ✓ Code Execution Sandbox (Docker/llm-sandbox, session persistence, SSE streaming) — v2.0 Phase 14
- ✓ Code Output UI — ExecuteCodeBlock with streaming terminal + file download cards — v2.0 Phase 15
- ✓ Skill File Management UI — upload/list/delete files on skills — v2.0 Phase 16

*v2.1 milestone:*

- ✓ Rolling context window trimming with atomic tool-pair removal — v2.1 Phase 18
- ✓ Inter-iteration trim: tool result messages removed atomically between agent loop iterations — v2.1 Phase 18
- ✓ Sub-agent content cap (600k chars) enforced before API call — v2.1 Phase 19
- ✓ Blank response guards: force-no-tools empty content fallback + finish_reason=length error event — v2.1 Phase 20
- ✓ Keyword search folder scope — v2.1 Phase 21
- ✓ Read document context capped at 3,000 chars with truncation note — v2.1 Phase 22
- ✓ Metadata case normalization (document_type/language) — v2.1 Phase 22
- ✓ System prompt confidence hedging + structured citation format guidance — v2.1 Phase 23
- ✓ Settings file TTL cache (5s) on `_load_override()` — v2.1 Phase 24
- ✓ Sentence boundary chunking fix — v2.1 Phase 24
- ✓ Sub-agent model auto-selection per provider — v2.1 Phase 25
- ✓ Provider-aware context budgets — v2.1 Phase 25

*v2.2 milestone:*

- ✓ F-01 Citations — collapsible passage cards with exact retrieved text — v2.2 Phases 26–27
- ✓ F-05 Confidence — High/Medium/Low badge with colour coding — v2.2 Phases 26–27
- ✓ F-02 Document versioning — upload new versions, view history, restore — v2.2 Phases 28–29
- ✓ F-06 Audit log — immutable action log with filter, paginate, CSV export — v2.2 Phases 30–31
- ✓ F-08 Suggested follow-up questions — 2–3 clickable pills after each response — v2.2 Phase 32

*v2.3 milestone:*

- ✓ F-03 Cross-Thread Memory — remember/recall tools with auto-injection — v2.3 Phases 33–34
- ✓ F-07 Multi-Modal Table & Image Extraction — pdfplumber tables, vision-LLM image descriptions, query_tables tool — v2.3 Phases 35–36
- ✓ F-09 Knowledge Health Dashboard — most-retrieved, never-retrieved, low-confidence, stale metrics with action hooks — v2.3 Phases 37–38
- ✓ F-10 User Feedback Loop — thumbs up/down with reason selector, feedback stats in Library Health — v2.3 Phases 39–40
- ✓ UI Deep Midnight Redesign — glassmorphic ToolCallPanel, gradient CitationCards, floating pill MessageInput, AppDock, 3-pane SkillsPage, mobile-responsive NavPanel — v2.3 Phases 41–43
- ✓ STREAM-01: Stop cancels SSE immediately — v2.4 Phase 44 *(KI-001: in-flight LLM runs to yield point)*
- ✓ STREAM-03: Partial responses persisted on stop (asyncio.shield) — v2.4 Phase 44+55
- ✓ CHAT-01: Thread delete confirmation dialog (AlertDialog) — v2.4 Phase 45
- ✓ CHAT-02: No ghost content after thread delete (clearMessages on switch) — v2.4 Phase 45
- ✓ CHAT-03: Folder selector on new chat creation — v2.4 Phase 45
- ✓ DOC-01/02/03: Version-aware document delete with cleanup and promotion — v2.4 Phase 46
- ✓ DOC-04/05/06: Root document visibility, specific upload errors, root upload — v2.4 Phase 47
- ✓ SETT-01/02: Web search toggle in Settings, tool excluded when off — v2.4 Phase 48
- ✓ NAV-01/02: Icon label alignment, logo visible when sidebar collapsed — v2.4 Phase 48
- ✓ HLTH-01/02/03/04: Paginated health dashboard, accurate labels, actionable empty states — v2.4 Phase 49
- ✓ CTX-01/02/03/04/05: Context-aware sub-agent routing, per-model settings, tiktoken estimation — v2.4 Phase 51
- ✓ MDL-01/02/03/04/05: Multi-provider model routing, fallback on 404, resolved model in Settings — v2.4 Phase 52
- ✓ TOOL-01: Cross-provider tool calling reliability (MODEL_CAPABILITIES, tool_parser.py) — v2.4 Phase 53
- ✓ GEN-01/02/04/05: Anthropic native SDK, no token reduction, generation mode disambiguation — v2.4 Phase 54

### Active (v2.5 in flight)

- [ ] CONCUR-01: Backend SSE handler does not block concurrent requests during long agent loops *(v2.5 Phase 058)*
- [ ] CONCUR-02: SSE architecture decouples handler lifetime from agent loop lifetime *(v2.5 Phase 059)*
- [x] STREAM-02a: Frontend race conditions eliminated (setViewingThread, AbortController, finally-block reload removed) *(v2.5 Phase 060 — shipped 2026-05-02)*
- [ ] STREAM-02b: Tab-switch (E) and F5 mid-stream (F) recover without breaking Stop (G) or navigation (H) *(v2.5 Phase 063 — subsumed by STREAM-04)*
- [ ] STREAM-04: Stream survives navigation, refresh, and multi-tab access — generation lifetime decoupled from any single HTTP request via Redis Streams + replay-and-tail API + frontend reconcile-on-(re)connect (Claude/ChatGPT-class behavior) *(v2.5 Phases 061 + 062 + 063)*
- [ ] TEST-01: Reproducible browser-based test harness for SSE/reconnect scenarios including run-backed streaming + multi-tab sync + refresh-mid-stream *(v2.5 Phase 064)*
- [ ] SKILL-01: Skill catalog uses relevance-based filtering, not all enabled skills *(Skills Studio milestone)*
- [ ] SKILL-02: Non-relevant skills never triggered even if in catalog *(Skills Studio milestone)*

### Out of Scope

| Feature | Reason |
|---------|--------|
| In-document PDF highlighting (F-01 v2) | Requires PDF renderer integration; citation cards sufficient for v2.2 |
| Citation export / cross-thread citation linking | Complexity vs. value; defer |
| Diff view between document versions | Nice-to-have; version history + restore covers core need |
| Per-claim confidence scoring | Too granular; response-level confidence sufficient |
| Organisation-level audit view / SIEM integration | Single-user audit sufficient; no multi-tenant yet |
| Suggestions in Explorer mode | Explorer is KB-focused tool mode; follow-ups add noise |
| Multi-tenancy / Org-level transform | Requires clarity on isolated vs co-tenant architecture and auth/billing model |
| Automatic local folder scanning/import | Phase II feature, adds complexity |
| Team-based folder sharing with access controls | Keep it simple: global or private only |
| Real-time collaboration on folders | Not needed for current use case |
| Folder-level permissions | Global folders visible to all, per-user folders private |
| Switching to Docling | Existing pypdf + python-docx pipeline is working |
| Nyquist VALIDATION.md compliance | Phase-level validation files in draft state; full compliance deferred |
| Comprehensive skills system overhaul | Planned for next milestone; this milestone only fixes dispatch relevance |

## Context

**Architecture:** React/Vite frontend + FastAPI backend + Supabase (Postgres with pgvector). Supabase can run locally via Docker or as a cloud instance.

**Schema (v2.3 shipped state):**
- `folders`: id, user_id, name, parent_id, is_global, created_at, updated_at — adjacency list with RLS
- `documents`: id, user_id, folder_id, filename, file_path, file_size, mime_type, status, full_markdown, chunk_count, content_hash, metadata, version_number, is_latest, created_at, updated_at
- `document_chunks`: id, document_id, user_id, content, chunk_index, embedding (vector), search_vector (tsvector), created_at
- `document_tables`: id, document_id, user_id, page, table_index, headers, rows, created_at
- `document_images`: id, document_id, user_id, page, image_index, description, created_at
- `threads`: id, user_id, folder_id (nullable FK), title, created_at
- `messages`: id, thread_id, role, content, tool_calls, citations, source_refs, confidence, suggestions, created_at
- `user_memory`: id, user_id, key, value, created_at, updated_at — UNIQUE(user_id, key) with upsert trigger
- `message_feedback`: id, message_id, user_id, rating, reason, created_at — UNIQUE(message_id, user_id), INSERT-only
- `skills`: id, user_id, name, description, instructions, is_enabled, is_global, created_at, updated_at
- `skill_files`: id, skill_id, user_id, filename, storage_path, file_size, mime_type, created_at
- `code_executions`: id, thread_id, user_id, code, exit_code, duration_ms, created_at
- `sandbox_files`: id, thread_id, user_id, filename, storage_path, file_size, signed_url, created_at
- `audit_log`: id, user_id, action_type, details, created_at — INSERT-only RLS
- `profiles`, `user_settings`, `app_settings`

**Agent modes:**
- General: default chat with 16 tools (search, query_documents, web_search, analyze_document, ls, tree, grep, glob, read_document, load_skill, save_skill, read_skill_file, execute_code, remember, recall, query_tables)
- Explorer: KB-focused mode with 6 KB tools, dedicated system prompt, max_iterations=8

**Known issues:**
- UAT verification gaps for phases 038–042 (require live browser testing) — carried from v2.3
- Human UAT pending for Phases 45, 46, 48 (delete dialog, ghost content, web search toggle, nav visual)
- Metadata ingest normalization covers only document_type/language
- Skill catalog injected in full for every request (SKILL-01/02 deferred to Skills Studio milestone)
- KI-001: In-flight LLM calls continue after SSE disconnect — GeneratorExit only fires at yield points; current call completes before iteration stops. See KNOWN-ISSUES.md.
- STREAM-02: Supabase Realtime INSERT timing unreliable for tab-switch and F5 scenarios — polling approach recommended for next milestone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Store full markdown alongside chunks | Enables efficient grep/read without reconstruction from chunks | ✓ Good — implemented Phase 2, used by read/grep tools |
| Unlimited folder nesting depth | Flexibility like a real filesystem | ✓ Good — adjacency list with no depth limit |
| Global + per-user folders (no teams) | Avoids permission complexity while enabling shared content | ✓ Good — `is_global` flag + RLS |
| grep returns document names only | Keeps output lightweight; use read for content | ✓ Good — agents follow up with read when content needed |
| tree uses depth limit + truncation | Protects context window for large KBs | ✓ Good — `truncated=True` indicator on cut nodes |
| Keep pypdf + python-docx (not Docling) | Already working; avoids migration risk | ✓ Good — no issues encountered |
| ON DELETE SET NULL on folder_id FK | Deleting folder orphans documents to root, not destroys them | ✓ Good — safe default behavior |
| document_chunks RLS not updated | match_document_chunks RPC is SECURITY DEFINER — RAG queries bypass RLS correctly | ✓ Good — no change needed |
| Python-side subtree resolution | Preferred over SQL CTE for folder scoping — simpler, testable | ✓ Good — used in grep, glob, query_documents, system prompt |
| ON DELETE SET NULL on threads.folder_id | Thread history preserved when folder deleted | ✓ Good — no data loss on folder delete |
| tools_override=None signals default mode | No override → get_tools() used; default mode completely unchanged | ✓ Good — clean branching pattern |
| JSONB for tool_call_id persistence | Store alongside existing tool call data without schema migration | ✓ Good — non-breaking, reconstructs correctly |
| asyncio.Queue bridge for Docker SSE | Decouples Docker blocking I/O from FastAPI async SSE loop | ✓ Good — real-time streaming without blocking |
| SKILL.md frontmatter YAML + agentskills.io format | Open standard for skill portability | ✓ Good — ZIP round-trip works, path traversal rejected |
| chars/3 for JSON token estimation | JSON punctuation overhead means chars/4 underestimates tool call sizes | ✓ Good — existing trim tests pass |
| Provider-aware context budgets (hardcoded) | Dynamic context limit mapping adds complexity; hardcoded per-provider sufficient | ✓ Good — avoids tiktoken dependency |
| 3k char cap on read_document context injection | Large documents were flooding agent context; 3k + truncation note preserves usefulness | ✓ Good — agents follow up with start_line/end_line |
| User memory UNIQUE(user_id, key) upsert | Enables remember tool to update in-place; consistent with per-user scoping | ✓ Good — clean upsert-by-key pattern |
| asyncio.create_task for non-blocking writes | Memory writes, feedback posts, audit log entries never delay responses | ✓ Good — consistent fire-and-forget pattern across phases 30, 33, 39 |
| Vision LLM for image descriptions | Embedded images described and indexed for vector search | ✓ Good — enables MODAL-02 and MODAL-03 |
| Python-side JSONB aggregation for health metrics | Simpler than raw SQL with Supabase client for aggregation queries | ✓ Good — fast enough for 10k document libraries |
| Immutable feedback (INSERT-only RLS) | One rating per message per user; no modification allowed | ✓ Good — clean audit trail |
| Deep Midnight is additive CSS/Tailwind only | No logic changes to SSE parsing or state management | ✓ Good — zero regression risk |
| NavPanel collapses from Sidebar + AppDock | Single component with localStorage-persisted state replaces dual-component layout | ✓ Good — cleaner responsive breakpoint story |
| 5-tab SettingsPage | Per-tab scoped Save handlers fix KEY_PLACEHOLDER contamination | ✓ Good — WR-03/WR-04 resolved |
| System prompt Q&A vs Generation disambiguation (PROMPT-01) | Old prompt keyword-matched "report"/"summary" → triggered execute_code on Q&A queries. Fix: Generation mode only activates on explicit file-creation verbs. Default is always Q&A. | ✓ Good — eliminates false-positive .docx generation |
| Two tool calling modes (D-53-01/02) | Native (API tools param) for proven models in MODEL_CAPABILITIES, Structured (JSON-in-prompt) for everything else. No retries, one-shot deterministic. | ✓ Good — clean branching; tool_parser.py handles structured path reliably |
| OpenRouter strategy setting (D-53-03) | quality/native/xml — user-controllable. quality default uses :extended model IDs for better compliance. | ✓ Good — no hardcoded assumptions about OpenRouter model behavior |
| NATIVE_PROVIDERS bypass for token cap (v2.4) | Anthropic and Google bypass the _resolve_max_tokens cap; Settings hides irrelevant sliders for those providers. | ✓ Good — clean provider-conditional UI pattern |
| _announced_tools set[int] guard (D-056.1-01) | Guards tool_preparing SSE to emit exactly once per tool index in OpenAI path. Anthropic path has separate _announced_tools_ant guard. | ✓ Good — prevents duplicate preparing events on parallel same-name tool calls |
| loadMessages outside React state updater (v2.4 Phase 57) | Side effects (loadMessages, stoppedByUserRef reset) must be outside setMessages updater — Strict Mode double-invokes updaters and bail-out optimization can skip them entirely. | ✓ Good — structural correctness; documented for future hook maintainers |
| Realtime reconnect deferred (STREAM-02) | Supabase Realtime INSERT delivery timing unreliable for tab-switch and F5 scenarios. Use polling for F5 + visibilitychange for tab-switch in next attempt. Verify REPLICA IDENTITY on messages table first. | ⚠ Revisit — see 057-DEFERRAL.md |
| **D-v2.5-08**: Run-backed streaming via Redis Streams (not pgmq, not LISTEN/NOTIFY) | Redis Streams provide native replay-from-offset + live-tail (`XREAD` with cursor), trivial multi-consumer fan-out (each tab is an independent reader), one-line per-key TTL, and battle-tested for chat-streaming infra at scale. pgmq is a queue (consume-once) which fights the use case; LISTEN/NOTIFY hits 8KB payload limits and requires a separate events table for replay. Free Upstash tier covers this app's scale; Redis is a one-line add when deploying to Hostinger (SEED-003). | New — locked 2026-05-02 by user before /gsd:discuss-phase 061 |
| **D-v2.5-09**: LLM token cost shift on rescope | Run-backed streaming decouples generation from HTTP request lifetime, so navigating away no longer cancels the LLM call. Mitigations: explicit Stop button (cancel verb hits server, not just frontend abort), server-side hard timeout per generation (default 120s), abandoned-run TTL (no consumer for N minutes → cancel producer). Specific values to be locked in /gsd:discuss-phase 061. | New — flagged 2026-05-02 |
| **D-v2.5-10**: STREAM-02b absorbed by STREAM-04 (run-backed streaming) | The original Reconnect Handlers approach (visibilitychange + pageshow + reconcile-fetch + Resume button) was the right symptom-treating layer for the legacy POST-streams architecture. Run-backed streaming makes recovery automatic at the architecture level — STREAM-02b's success criteria (E, F, G recover without manual F5) are met as a side-effect. Resume button retained only for `failed` runs, preserving D-v2.5-05's "no auto-retry of paid LLM calls" principle. | New — locked 2026-05-02 |
| **D-v2.5-11**: v2.5 stream-architecture deployment + run history persistence | (a) Phases 061 + 062 + 063 ship as a single merge from a long-lived feature branch — no feature flags, no incremental rollout. Reason: dev-stage single-developer change, atomic architectural shift, feature-flag complexity outweighs benefit. (b) Run lifecycle metadata persists in a new `public.runs` Postgres table (`run_id`, `thread_id`, `user_id`, `message_id`, `status`, `model`, `provider`, `started_at`, `completed_at`, `input_tokens`, `output_tokens`, `error`) with full RLS — Redis Stream is the ephemeral event buffer (TTL ~10 min), Postgres `runs` is the durable record. Migration `035_runs_table.sql` lands in Phase 061 scope. Active-runs API (Phase 062) reads from Postgres; replay-and-tail reads from Redis. Useful for audit, debugging, future billing/usage UI, and validation-harness assertions (Phase 064). | New — locked 2026-05-02 |

## Constraints

- **Tech stack**: Must use existing Supabase infrastructure — no new databases or storage systems
- **Supabase deployment**: Agnostic — works with local Docker or cloud; all schema changes as numbered migration SQL files
- **Extraction**: Keep pypdf + python-docx pipeline — no Docling migration
- **Context window**: Tree/ls output must respect context limits — use depth limits and truncation
- **RLS**: All tools must respect Row-Level Security — users only see their folders/documents/skills (except global)
- **Ingestion dependency**: grep/glob/read only work on ingested content, not raw uploaded files
- **Sandbox**: Docker required for code execution; SANDBOX_ENABLED=false (default) disables all sandbox features safely

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-02 — Phase 060 shipped (STREAM-02a closed); v2.5 milestone rescoped to deliver STREAM-04 (Claude/ChatGPT-class run-backed streaming): added Phase 063 (Frontend Stream Decoupling), rescoped Phase 061 (Run-Backed Streaming Backend) and Phase 062 (Replay & Tail API), renumbered prior 062→064 and 063→065; D-v2.5-08 (Redis Streams) and D-v2.5-10 (STREAM-02b absorbed) locked*