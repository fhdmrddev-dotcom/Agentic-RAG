# Agentic RAG — AI Agent Platform

## What This Is

A RAG-based AI agent platform where users organize documents into nested folders and interact with a customizable AI agent. The agent remembers preferences across threads, extracts tables and images from documents, shows confidence and citations, runs code in a sandbox, and can be taught new skills that persist. The Deep Midnight visual design delivers a glassmorphic, mobile-responsive experience with knowledge health dashboards and user feedback loops.

## Core Value

The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

## Current Milestone: v2.6 Foundation — RAG Quality + Multi-Worker + Polish

**Goal:** Build the production-ready substrate the next four milestones depend on — close the user-observed PDF↔DOCX extraction inconsistency, lift the single-worker concurrency ceiling, hoist the streams subscription surface out of `useMessages`, and absorb six carry-forward seeds before they compound.

**Scope brief:** `.planning/PRDs/v2.6.md` (locked 2026-05-10, signoff 2026-05-12). All 6 PRD gates passed (compatibility, scalability, coverage, doc-validity, surprise-feature, lean). 21 Active REQ-IDs in PRD §4 + 1 mid-milestone amendment (CHAT-RESILIENCE-01 added 2026-05-13 to absorb BUG-260513-01, owned by Phase 068.5). 16 phases (068–082 in PRD §12 + Phase 068.5 amendment). PRD v2.6 §4 amendment recommended.

**Target features (6 themes):**

- **Theme A — RAG Quality Lift:** Docling primary extractor (MIT) + PyMuPDF AGPL fallback (subprocess-fenced) behind a new `PdfExtractor` abstraction; multimodal ceiling lift to ≥80% figure coverage with empty-description rows persisted; DOCX `related_parts` walk; confidence threshold recalibration on Docling-extracted distributions.
- **Theme B — Multi-Worker Readiness:** `asyncpg>=0.29` pool in hot paths; supersede `D-v2.5-02` via the new `D-PRD-12` ADR; `--workers N` uvicorn enable validated under 50-parallel-run synthetic load; `GET /admin/backpressure` JSON primitive (UI hookup deferred to v3.1).
- **Theme C — Streams Provider Pre-emptive Lift (per D-PRD-06):** Hoist `subscriptionsRef` / `lastSeenOffsetRef` / `messagesByThread` Map out of `frontend/src/hooks/useMessages.ts` (1229 LOC) into a top-level `<StreamsProvider>` Context. **The Phase 067.5 Branch D-3 `clearMessages` guard at `useMessages.ts:572-590` MUST survive the lift verbatim.**
- **Theme D — Polish & Quality Carry-forwards:** SEED-008 (`GET /threads/{id}/snapshot` + line-by-line `code_stdout`), SEED-009 (`MODEL_CAPABILITIES.max_output_tokens` extension), SEED-010 (OpenRouter Kimi/MiniMax UAT), SEED-011 (`_reset_redis_singleton` fixture), `tool_args_progress` SSE for non-execute_code tools.
- **Theme E — Opportunistic Code-Quality (Cluster G):** Supabase singleton `aclose()` on lifespan, context-window protected-only overrun branch, concurrent-upload dedup race (partial unique index migration), title-gen silent-failure `WARNING` log.
- **Theme F — Token Telemetry:** TOKEN-COL-01 — populate `runs.input_tokens` / `runs.output_tokens` from LLM `usage`. Pure observability, no caps, no enforcement. Used by v3.1 admin dashboards + v3.4 spend-cap pre-flight.

**Key context:**

- **Phase numbering:** continues from v2.5's last phase 067.5 → v2.6 starts at Phase **068**.
- **Migration range reserved:** `039 – 049` (per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`). 039/040/041/042/043/044 used; 045 conditional on Q-v2.6-02; 046–049 buffer.
- **Locked decisions inheritance (PRD §2):** D-PRD-01 (mid-large enterprise), D-PRD-03 (closed core + open peripherals → AGPL subprocess fence), D-PRD-04 (feature-complete timing), D-PRD-06 (Streams Provider lift pre-emptive), D-PRD-07 (Docling-first + PyMuPDF fallback; PyMuPDF Pro deferred), D-PRD-08 (multi-worker readiness in v2.6). Inherits v2.5: D-v2.5-01, D-v2.5-03, D-v2.5-08, D-v2.5-11, D-v2.5-12. **Supersedes** D-v2.5-02 via the new D-PRD-12 ADR authored in Phase 079.
- **Pre-execution decisions (PRD §13):** Q-v2.6-01..06 route to `/gsd:discuss-phase` per their owning phase — not blocking the roadmap.
- **Seeds consumed at milestone completion:** SEED-006, SEED-007, SEED-008, SEED-009, SEED-010, SEED-011 close; SEED-001 downgrades to partial (per-user SSE cap + sticky sessions remain planted).

## Current State

**Shipped:** v2.5 (Deployment Strategy) — 2026-05-09 (16 phases, 64 plans, 445 commits, ~104K LOC delta)
**Active:** v2.6 Foundation (RAG Quality + Multi-Worker + Polish) — kicked off 2026-05-12; phases 068–082 proposed in PRD §12 + Phase 068.5 amendment (added 2026-05-13); scope brief at `.planning/PRDs/v2.6.md`
**Phase 069 complete (2026-05-14):** PdfExtractor abstraction scaffold shipped — `PdfExtractor` ABC + `LegacyExtractor` (today's pypdf + pdfplumber + python-docx pipeline rewrapped) + `get_extractor(mime)` dispatcher live in `backend/app/services/extraction_service.py`; `documents.py` upload + re-ingest paths routed through the seam; binding golden-fixture gate live (synthetic PDF + DOCX). Zero observable behavior change confirmed via golden gate; Q-v2.6-06 closed via D-PRD-07 appendix (PyMuPDF AGPL-3.0 fallback license posture locked). Phase 071 will plug Docling primary + PyMuPDF (subprocess-fenced) fallback behind the same dispatcher.
**Phase 071.1 complete-partial (2026-05-15):** Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback. Plan 01 shipped clean (4 commits): `/reextract` async handler now wraps 6 sync supabase calls in `run_in_threadpool` (D-v2.5-01 compliance), `asyncio.wait_for(timeout=EXTRACTOR_DOCLING_TIMEOUT_S + 10)` wraps the Docling extract step as Layer 2 wall-clock fail-safe, and PyMuPDF auto-fallback fires on Docling timeout only (narrow override of D-071-11). Three new env knobs (`EXTRACTOR_DOCLING_TIMEOUT_S` / `_DISABLE_TABLE_STRUCTURE` / `_IMAGES_SCALE`). 8 new tests + reset_docling_singleton fixture. Plan 02 live UAT against thesis pair: 4-min Docling stall **structurally eliminated** (thesis PDF that previously stalled indefinitely now completes in 125s; backend `/health` stayed responsive at 1-2s during in-flight extract vs frozen previously). The 20% binding gate per D-071.1-06 stays RED at 89.7% tables / 100% images delta — but the root cause has shifted from "Docling stalls" to "PDF and DOCX extraction quality differ structurally" (deeper PDF-vs-DOCX semantic gap, NOT a Plan 01 regression). User-decided disposition 2026-05-15: ACCEPT-DEGRADED, escalate the delta gap to Phase 071.2 (proposed) — PDF-side extraction quality (TableFormer A/B with `DISABLE_TABLE_STRUCTURE=1`, persisted-vs-telemetry accounting reconciliation, possible SEED-006 multimodal-quality promotion).
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage) + Redis Streams (run-backed streaming)
**Codebase:** ~160K LOC (Python + TypeScript) post-v2.5; 531 files touched across the v2.5 window
**Phases shipped:** 73 phases across 7 milestones (v1.0–v2.5); 144+ plans executed
**Design system:** Aether Intelligence — Deep Midnight theme, glassmorphic cards, gradient accents, mobile-responsive
**Docker:** `llm-sandbox` container for code execution (`SANDBOX_ENABLED=true`); Redis container for run-backed streaming buffer
**Known tech debt going into next milestone:**
- Phase 064 (Validation Harness) — DEFERRED (intentional; scenarios E/F/H validated organically by 067.x UAT, G + multi-tab sync remain partially deferred)
- Carry-forward seeds: SEED-009 (claude-haiku max_tokens cap), SEED-010 (OpenRouter synthetic-timeout protocol), SEED-011 (test_059 fixture-teardown bug)
- Forward-looking seeds for next-milestone selection: SEED-002, SEED-012, SEED-013, SEED-014

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

*v2.5 milestone (Deployment Strategy):*

- ✓ CONCUR-01: Backend SSE handler does not block concurrent requests during long agent loops — v2.5 Phase 058 (shipped 2026-05-01; cross-tab GET <1s during streaming, measured ~15ms)
- ✓ CONCUR-02: SSE architecture decouples handler lifetime from agent loop lifetime — v2.5 Phase 059 (shipped 2026-05-02; agent_runner producer + asyncio.Queue + sse-starlette)
- ✓ STREAM-02a: Frontend race conditions eliminated — v2.5 Phase 060 (shipped 2026-05-02; setViewingThread separation + AbortController + finally-block reload removed)
- ✓ STREAM-02b: Tab-switch / F5 mid-stream recover without breaking Stop or navigation — v2.5 (subsumed by STREAM-04; final reconcile fix landed in Phase 067.5)
- ✓ STREAM-04: Stream survives navigation, refresh, multi-tab access — Redis Streams + replay-and-tail API + frontend reconcile — v2.5 Phases 061 + 062 + 063 (shipped 2026-05-04 as a single feature branch per D-v2.5-11)
- ✓ STREAM-04-correctness: Run-backed streaming gap closures — v2.5 Phase 063.1 (shipped 2026-05-04; closed Gap-001..005)
- ✓ Gap-006 closed: Per-LLM-call timeout machinery + cancelled vs timed_out lifecycle distinction — v2.5 Phase 066 (shipped 2026-05-06; HUMAN-UAT green/approved)
- ✓ UX-067-01..05 closed: Empty-paint, "Saving response…" thrash, refresh-required first-paint, redis-consumer log noise, tool-call iteration boundary — v2.5 Phase 067 (shipped 2026-05-07)
- ✓ Gap-007 closed + agent behavior polish — v2.5 Phase 067.1 (shipped 2026-05-07; Track A drain-into-queue, multi-step pipeline system prompt, context-aware in-flight copy)
- ✓ STREAM-04-correctness-round2 closed: Per-thread message store + sandbox download via JS blob + model→provider router + suggestions emit + active-thread tool-stage + code-execution heartbeat — v2.5 Phases 067.2 / 067.3 / 067.4 (shipped 2026-05-09 via cross-phase chain)
- ✓ STREAM-04-correctness-round3 closed: Empty-thread-until-refresh reconcile fix — v2.5 Phase 067.5 (shipped 2026-05-09; Branch D-3 `clearMessages` guard, 5/5 lived-experience cycles GREEN)
- ✓ TEST-DEBT-059 closed: Skills test infrastructure repaired — v2.5 Phase 065 (shipped 2026-05-09; combined skills test run 26/26 pass)

### Active (v2.6 — Foundation: RAG Quality + Multi-Worker + Polish)

21 Active REQ-IDs scoped in `.planning/PRDs/v2.6.md` §4. Materialized in `.planning/REQUIREMENTS.md` and mapped to phases in `.planning/ROADMAP.md`.

**Theme A — RAG Quality Lift**
- [ ] RAG-DOCLING-01: Docling primary path produces comparable PDF↔DOCX table/image counts (≤20% delta on reference thesis)
- [ ] RAG-DOCLING-02: httpx<0.28 vs supabase 2.10 conflict resolved per Q-v2.6-01; CI green
- [ ] RAG-MM-LIFT-01: `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` lifted to `app_settings`; ≥80% figure coverage on 4 MB reference PDF; empty-description rows persisted
- [ ] RAG-MM-LIFT-02: DOCX extraction reaches floating shapes + headers/footers via `doc.part.related_parts` walk
- [ ] RAG-RECAL-01: Confidence thresholds recalibrated per Q-v2.6-03; distributions documented in PROJECT.md

**Theme B — Multi-Worker Readiness**
- [ ] WORKER-LIFT-01: `uvicorn --workers 2` runs cleanly — run-tracking + sandbox stickiness + per-worker Redis singleton all verified
- [ ] WORKER-LIFT-02: `asyncpg` pool replaces sync `supabase-py` in streaming endpoint + finalize path; CONCUR-01 stays green
- [ ] WORKER-LIFT-03: D-PRD-12 ADR supersedes D-v2.5-02; `CLAUDE.md` rule updated
- [ ] WORKER-LIFT-04: `GET /admin/backpressure` returns documented JSON shape, gated on env-var allow-list

**Theme C — Streams Provider Lift**
- [ ] STREAMS-PROVIDER-01: `<StreamsProvider>` Context owns all run-stream subscriptions; two-pane mock renders without state collision; Branch D-3 guard preserved; 067.5 regression specs green

**Theme D — Polish Carry-forwards**
- [ ] POLISH-SEED-008-01: Thread-switch perceived latency reduced ≥50% via new `GET /threads/{id}/snapshot`
- [ ] POLISH-SEED-008-02: Sandbox stdout emits ≥3 distinct `code_stdout` SSE events over ≥1s for the `range(5)+sleep(1)` reference loop
- [ ] POLISH-SEED-009-01: `claude-haiku-4-5-20251001` no longer 400s on `max_tokens > 64000`; `MODEL_CAPABILITIES.max_output_tokens` populated for all listed models
- [ ] POLISH-SEED-010-01: OpenRouter Kimi-k2.5 + MiniMax-m2.7 produce clean `runs.status='timed_out'` under synthetic-timeout overrides
- [ ] POLISH-SEED-011-01: `pytest test_059_disconnect.py -q` is 3/3 PASS — no "Event loop is closed"
- [ ] POLISH-TOOL-PROG-01: Non-execute_code tools emit `tool_args_progress` SSE events when arg JSON exceeds 5 KB

**Theme E — Code-Quality (Cluster G)**
- [ ] CQ-SUPA-01: Supabase singleton `aclose()` on FastAPI shutdown — no RuntimeWarning
- [ ] CQ-CTX-01: Protected-only overrun trims oldest-protected or raises `ConversationTooLongError` — no silent overrun
- [ ] CQ-DEDUP-01: Concurrent same-file uploads produce exactly one `documents` row + one chunk set (partial unique index + atomic CAS)
- [ ] CQ-TITLE-01: Title-generation failures emit `logger.warning`; fallback preserved

**Theme F — Token Telemetry**
- [ ] TOKEN-COL-01: `runs.input_tokens` / `runs.output_tokens` populated from LLM `usage` for every completed call; forward-fill only; NULL writes become dashboard warning

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
| **D-v2.5-12**: Schema-restore — `messages.confidence_*` columns | The columns `confidence_level` (text), `confidence_avg_similarity` (double precision), and `confidence_disclaimer` (text) on `public.messages` were defined ONLY in the retired bootstrap file `supabase/migrations/000_full_schema.sql`. That file was moved out of the migration sequence in commit 197b53a (2026-05-02) when the regenerate-full-schema.sh pipeline was introduced. Because no sequenced migration ever created the columns, the regenerated `supabase/full-schema.sql` lost them and any DB rebuilt from migrations alone was missing them. Affected runtime: `threads.py:1027-1029` (writes), `knowledge_health.py:148-484` (reads for low-confidence dashboards), `models/message.py:25-27` (Pydantic). Restored via migration `037_messages_confidence_columns.sql` (idempotent `ADD COLUMN IF NOT EXISTS`). Audit: at-the-time only confidence_* was missing — `source_refs`, `tool_calls`, skills tables, and all other expected columns are intact. The new `documents.ingestion_step` + narrowed `documents.status` CHECK are intentional (commit a2b0a36). | New — locked 2026-05-03 |
| **D-v2.6-01**: Q-v2.6-01 resolution — path (a): supabase-py 2.10 → 2.29.x in-process upgrade | The httpx<0.28 (supabase 2.10) vs httpx>=0.28 (docling 2.x) conflict is resolved by upgrading supabase-py to 2.29.x, which drops the `gotrue`-inherited httpx constraint. Path (a) succeeded on the first attempt; paths (b) (pin docling back) and (c) (subprocess isolate) rejected — (b) falsified by PyPI metadata (no docling 2.x publishes httpx<0.28 wheels), (c) pro-forma per D-070-05 (subprocess overhead unjustified once in-process works; D-PRD-07 Appendix subprocess-fence precedent remains available as a future fallback). Pins locked: `supabase==2.29.0`, `httpx>=0.28.0,<0.29.0`, `docling>=2.93.0,<3.0.0`. Full backend pytest suite green post-upgrade; D-070-14 regression-guardrail comment block in `requirements.txt` names `backend/tests/integration/test_pdf_extractor_docling_compat.py` as the binding gate. Full matrix in `.planning/phases/070-docling-httpx-spike/070-SUMMARY.md`. | New — locked 2026-05-14 by Phase 070 spike; CI test green; closes RAG-DOCLING-02 |
| **D-v2.6-04**: Q-v2.6-04 LOCKED — opt-in re-extraction via `POST /documents/{id}/reextract` (per-document, explicit engine override) | Three options considered: (a) auto-re-extract all existing documents on deploy, (b) opt-in per-document via a new `/reextract` route, (c) defer the engine-swap story to v3.1. Path (a) rejected — would regenerate every chunk embedding + re-run every vision-LLM image description (cost-uncapped on the existing library; user-facing latency spike on first request after deploy; no UAT mechanism to validate the new engine's output BEFORE committing the user's library to it). Path (c) rejected — leaves the per-document fallback story unowned through v2.6→v3.0, and breaks Phase 076's extraction-comparison UAT plan (which needs `/reextract` to A/B Docling vs PyMuPDF vs Legacy on the same source bytes). Path (b) selected. Implementation (Phase 071 Plan 04): `POST /documents/{id}/reextract` body `{engine: Literal['docling','pymupdf','legacy']}` REQUIRED; owner-only RLS returning 404 (not 403) on cross-user miss (T-071-04-01 information-disclosure mitigation); hard-deletes existing `document_chunks` + `document_tables` + `document_images` before resetting `documents.status='pending'` + `extractor=NULL`; `version_number` NOT bumped (D-25 versioning contract preserved — engine swap is not a source-bytes change); BackgroundTask threads `engine_override=body.engine` into `ingest_document`. Migration 040 backfills `documents.extractor='pypdf-legacy'` for existing rows (so the engine lineage column is non-NULL on day-1 of v2.6 close); existing chunks/tables/images stay byte-identical until an operator opts a document into `/reextract`. New uploads default to `EXTRACTOR_PRIMARY='docling'`. See `.planning/phases/071-docling-primary-path/071-CONTEXT.md` D-071-13 + `backend/app/api/documents.py::reextract_document` + the 4 binding tests at `backend/tests/integration/test_documents.py::TestReextractDocument` (happy_path_returns_202 / invalid_engine_returns_422 / missing_engine_returns_422 / owner_only_returns_404). | New — locked 2026-05-14 by Phase 071 Plan 04 close; closes Q-v2.6-04 |

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
*Last updated: 2026-05-15 — Phase 071.1 (Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback) complete-partial. The 4-min Docling stall failure mode from Phase 071's SC#1 is structurally eliminated; thesis PDF that previously stalled indefinitely now completes in 125s. The 20% binding-gate delta stays RED but the root cause shifted from "stall" to "PDF-vs-DOCX extraction-quality gap" — accept-degraded disposition, escalate to Phase 071.2 (proposed). Next phase: 072 (Multimodal Lift + DOCX Completeness). Prior entry: 2026-05-14 — Phase 069 (PdfExtractor Abstraction Scaffold) complete. Carved today's pypdf + pdfplumber + python-docx pipeline behind a `PdfExtractor` ABC seam; binding golden gate live; Q-v2.6-06 closed via D-PRD-07 appendix (PyMuPDF AGPL-3.0 fallback license posture). 8 code-review findings: BLOCKER + 2 HIGH fixed in-phase (tuple-typed dataclass fields, Pillow declared, patch.object test migration); 2 MEDIUM + 3 LOW deferred to Phase 071. Next: Phase 070 (Docling httpx Spike — resolves Q-v2.6-01 dependency conflict). v2.6 (Foundation: RAG Quality + Multi-Worker + Polish) kicked off via `/gsd:new-milestone v2.6`. Scope consumed from `.planning/PRDs/v2.6.md` (locked 2026-05-10, signed off 2026-05-12 with TOKEN-COL-01 added at signoff). 21 Active REQ-IDs across 6 themes; phases 068–082 proposed in PRD §12 (~38 plans). Migration range 039–049 reserved. Continues phase numbering from v2.5's last phase 067.5. Six seeds (006/007/008/009/010/011) consumed at milestone completion; SEED-001 partial. Pre-execution decisions Q-v2.6-01..06 routed to `/gsd:discuss-phase` per phase. v2.5 (Deployment Strategy) shipped 2026-05-09 — 16 phases / 64 plans / ~104K LOC delta.*