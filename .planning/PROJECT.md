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
**Phase 071.2 complete (2026-05-15):** Ingestion plumbing + per-aspect extraction dispatcher. 5/5 plans shipped; 8/10 success criteria code-verified; 2 env-blocked (D-071.2-12 quality floor on the thesis PDF + PDF Form-XObject image lift) parked in `071.2-HUMAN-UAT.md` because **both Docling AND the PyMuPDF subprocess fallback crash on the thesis PDF in WSL** (Docling timeout 136s, PyMuPDF subprocess `MemoryError`). Code deliverables: (a) `/upload` returns 201 in ~1s via `_upload_pipeline` BackgroundTask helper (extract+chunk+multimodal moved off the request path); (b) all 6 `/upload` + 3 `/reingest` Supabase calls wrapped in `run_in_threadpool` (closes D-v2.5-01 on the last two foreground-extract routes); (c) chunker reads Docling's `full_markdown` instead of `export_to_text()` (closes the 95%-chunks-drop) + `do_formula_enrichment=True` for LaTeX equations; (d) `multimodal_service.extract_and_store_tables/_images` widened with `extracted_doc` kwarg precedence (closes the telemetry-vs-storage mismatch); (e) `/reextract` returns 404 (not 500) on `is_latest=False`; (f) **per-aspect extraction dispatcher** at `backend/app/services/extractors/aspects/{text,tables,images_pdf,images_docx,equations}.py` + `extract_composable(raw, mime, engines)` composer + `app_settings.extraction.*` columns (migration 045) + `?engines=` per-call hint on `/upload` and `/reextract` + backward-compat shim for legacy `get_extractor(engine=...)`; (g) `zip_xpath_docx` engine verbatim-ports Docling's `MsWordDocumentBackend` XPath (closes Phase 072 RAG-MM-LIFT-02 at the unit-test level); (h) SEED-017 (PyMuPDF4LLM AGPL), SEED-018 (Marker GPL), SEED-019 (PyMuPDF subprocess OOM + non-Docling engine evaluation) all planted. **User-decided pivot 2026-05-15** (see [[feedback-docling-skepticism]]): Docling repeatedly broke fast/light extraction without delivering on table/image recall. The per-aspect dispatcher is now the architectural deliverable — Docling stays available as an opt-in engine, but Phase 071.3 will diagnose the PyMuPDF subprocess OOM and benchmark non-Docling table/image engines (PyMuPDF in-process, Camelot, Tabula, PyMuPDF4LLM, Marker), then ship migration 046 flipping defaults to the benchmark winner. The "Docling-first" thesis from the v2.6 PRD is formally retired in favor of "swap-by-default optionality."
**Phase 072 complete (2026-05-17):** Multimodal Lift + DOCX Completeness. 5/5 plans shipped (Plans 01–05 including in-band gap closure for VERIFICATION.md Gap 2 + Gap 3 / BUG-260517-01). Plans 01–02: replaced `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` hardcoded constants with `app_settings.multimodal_max_*` reads (defaults 100 / 4096 KB, migration 044); shared `_downscale_b64_for_vision` helper; persist-empty-rows contract for failed vision-LLM calls (D-072-03/04); DOCX `zip_xpath_docx` engine catches floating + header/footer images via `wp:anchor`/`related_parts` walk; content-hash dedup for both DOCX and PDF image paths; description-prefix labels for DOCX images (`[Image header]:`, `[Image inline]:`, `[Image floating]:`). Plan 03: `/reextract?retry_empty_descriptions_only=true` short-circuit path refills empty rows without delete-cascade. Plan 04 (gap closure for Gap 2): rewrote `_reextract_refill_empty_descriptions` to use `extract_composable` per-aspect dispatcher — legacy `extract_pdf_images` / `extract_docx_images` were inline-shapes-only and returned `[]` on operator's thesis DOCX (58 floating images). Plan 05 (gap closure for Gap 3 / BUG-260517-01): `/reingest` cascade widened from 2→3 deletes (chunks + tables + images, doc-id-scoped, children-before-parent) to eliminate orphan chunks after `/reextract → /reingest` sequence; `documents.chunk_count` semantics formally documented as TEXT-CHUNKS-ONLY. Both gap closures verified on production data (operator's thesis DOCX): **Gap 2 = 58/58 = 100% refill** (pre-fix 0/58 — wall time 108s for 58 vision-LLM calls); **Gap 3 = chunk count matches actual + idempotent on second `/reingest`**. `vision_sweep` engine + ≥80% recall target DEFERRED to SEED-021 spike-first path per user cost concern. RAG-MM-LIFT-01 + RAG-MM-LIFT-02 → Validated. Code review surfaced 3 warnings (0 critical): WR-01 (load-bearing test-only) — `test_reingest_reextract_orphans.py` patches `app.services.openai_service.embed_texts` but `multimodal_service` imports from `app.services.embedding_service`; orphan-count invariant still holds (chunk count is orthogonal to embeddings) but test likely hits real OpenAI API during live-Supabase runs. Tightening deferred to next polish bundle.
**Phase 075.4 complete (2026-05-23):** Cross-Provider Cleanup + Per-Thread State + E2E Backstop (inserted phase). 6/6 plans shipped across 3 waves; 26 commits; 10/10 ROADMAP Success Criteria code-verified; 22/22 D-075.4-* locked decisions honored; 8/8 behavioral spot-checks PASS. Closed 6 cross-provider bugs surfaced by operator UAT after 075.3 (per [[feedback_regressions_during_075_3_uat]]): **BUG-260523-01** (composer locked globally during any stream — lifted 5 cross-thread globals in `streamsStore.ts` to per-thread `Map<threadId, T>` / `Set<threadId>` + 4 new thread-scoped selectors; Phase 067.5 Branch D-3 `clearThreadBucket` guard preserved verbatim; per-thread composer disable at `ChatArea.tsx:222`); **BUG-260523-02** (Gemini-3 `thought_signature` missing — 3-stage wiring: capture in `_on_chunk_openai` + echo in `_reconstruct_history` + persist via conditional spread in `persisted_tool_calls`, all provider-gated on `active_provider_name == "google"`); **BUG-260523-03 + BUG-260522-02 + BUG-260521-02** (OpenRouter duplicate outputs + missing url + pinned-panel no download link — SHA-256 content-hash dedup with `supersedes` field in `harvest_output_files`; `OutputFileCard` `supersedes` UI affordance); **BUG-260522-01** (empty-response fallback misleading iter count — one-line `{iteration + 1}` fix). Streaming reliability: terminal-status race closed via inline `_emit('done')` removal + `_shielded_finalize` so `runs.status` UPDATE precedes terminal sentinel; sub-agent truncation warning + iteration-cap silent-drop guard both emit `system_warning` events (`kind='context_truncated'` / `kind='iteration_cap_dropped_tool_calls'`) AND persist as `messages` rows for reload-survival (gated on migration 048 — operator-applied 2026-05-23). Provider routing: `UnknownProviderError(ValueError)` raised at FastAPI lifespan startup (D-075.4-B1/B2/B3) — eliminates silent-ollama-fallback footgun; `get_model_capability()` registry-or-inference pattern from 075.3 extended to 6 hardcoded sites; `ModelCapability` extended with `uses_max_completion_tokens` + `supports_parallel_tools` optional fields populated on 14 model rows. Perf + UX + safety: `React.memo(MessageItem)` + `useMemo(MarkdownRenderer)` + `useCallback` stabilization in `ChatArea`; lazy `recharts` (~359 KB chunk-split); `save_override` sentinel allowlist guard (closes WR-02 footgun from 075.3); Settings 2-click bug closed via `flushSync` wrap (D-075.4-F3); `stderr` per-line badge in `ExecuteCodeBlock`. E2E backstop: Playwright + auth/db-teardown/langsmith fixtures + 6 scenarios mapping 1:1 to regression classes (parallel composers / Gemini-3 thought_signature / OpenRouter pptx / done-latency / unknown-model inference / iteration-parity-RED-by-design); `restart-backend.{sh,ps1}` (Windows orphan-worker aware); `/health` endpoint; `.github/workflows/frontend-tests.yml` CI workflow; `075.4-TEST-TRIAGE.md` categorizing 98 pre-existing backend failures with per-file owners (FK-violation cluster of 6 closed via AsyncMock; 92 remaining routed to Phase 076 ~80 + Phase 077 ~10). **Normative rule landed** in CLAUDE.md (SC#10): "Any phase touching streaming, agent loop, provider routing, or UI state MUST include UAT rows for cross-provider × multi-tool × parallel-thread × long-message scenarios." Operator UAT walkthrough 2026-05-23 dispositioned 5 items: migration 048 PASSED; Playwright substrate verified (live execution deferred to operator session block); Settings 2-click verified via unit test; CI dry-run deferred to first real PR. Code review (1 Critical / 7 Warning / 9 Info) — advisory only, CR-01 (auth.fixture.ts committed local-dev creds as fallback defaults) flagged but matches author rationale + `reference_local_dev_app.md` memory + T-075.4-07 mitigation. Migration 048 applied operator-side via Supabase Studio.
**Stack:** React/Vite + FastAPI + Supabase (Postgres + pgvector + Storage) + Redis Streams (run-backed streaming)
**Codebase:** ~160K LOC (Python + TypeScript) post-v2.5; 531 files touched across the v2.5 window
**Phases shipped:** 73 phases across 7 milestones (v1.0–v2.5); 144+ plans executed
**Design system:** Aether Intelligence — Deep Midnight theme, glassmorphic cards, gradient accents, mobile-responsive
**Docker:** `llm-sandbox` container for code execution (`SANDBOX_ENABLED=true`); Redis container for run-backed streaming buffer
**Known tech debt going into next milestone:**
- Phase 064 (Validation Harness) — DEFERRED (intentional; scenarios E/F/H validated organically by 067.x UAT, G + multi-tab sync remain partially deferred)
- Carry-forward seeds: SEED-009 (claude-haiku max_tokens cap), SEED-010 (OpenRouter synthetic-timeout protocol), SEED-011 (test_059 fixture-teardown bug)
- Forward-looking seeds for next-milestone selection: SEED-002, SEED-012, SEED-013, SEED-014
- **Docling integration shipped stability, not quality (2026-05-15).** Phase 071.1 retry on the thesis pair confirmed Docling produces zero improvement in stored `document_tables` / `document_images` counts vs `pypdf-legacy` (same 4 tables / 2 images on PDF, same 39 / 0 on DOCX). PDF chunk count dropped 95% under Docling (~400 → 19) — suspected text-extraction regression. Docling is 25-100× slower on PDFs (~125s vs 1-5s legacy) and loads ~600 MB models + RapidOCR even when `do_ocr=False`. **`EXTRACTOR_PRIMARY=legacy` reverted in `backend/.env` 2026-05-15** for new uploads + `/reingest`; Docling/PyMuPDF remain opt-in per-doc via `/reextract`. 10 open investigations captured in `.planning/phases/071.1-.../071.1-CARRY-FORWARDS.md`; SEED-006 (multimodal extraction quality) retested + addendum added confirming the storage-layer bottleneck is unchanged since 2026-05-02. v2.6 PRD's "Docling-first" thesis is informally reversed pending Phase 071.2 wiring diagnostics + Phase 072 / SEED-006 multimodal lift.

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
- [x] POLISH-SEED-009-01: `claude-haiku-4-5-20251001` no longer 400s on `max_tokens > 64000`; `MODEL_CAPABILITIES.max_output_tokens` populated for all listed models — Validated in Phase 074
- [ ] POLISH-SEED-010-01: OpenRouter Kimi-k2.5 + MiniMax-m2.7 produce clean `runs.status='timed_out'` under synthetic-timeout overrides
- [x] POLISH-SEED-011-01: `pytest test_059_disconnect.py -q` is 3/3 PASS — no "Event loop is closed" — Validated in Phase 074 (loop-binding bug structurally closed via conftest hoist; 3/3 PASS blocked by separate pre-existing Phase 073 FK seeding gap, tracked as D-074-02-DEFER-1)
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
| **D-v2.6-05** (D-PRD-15): Docling demotion + camelot table default + PyMuPDF in-process posture (post-071.3) | Docling consistently failed to deliver on its table/image recall promise across Phases 070, 071, 071.1, 071.2 (4-min stalls, OOM, ~750 MB install with RapidOCR, `httpx<0.29` pin solely to accommodate Docling). User direction 2026-05-15 ([[feedback-docling-skepticism]]): "I believe we should neglect Docling completely... we still need to extract the correct tables and images." Phase 071.3 (`071.3-docling-demotion-table-engine-full-rip`) replaced Docling with **camelot** on the per-aspect dispatcher's tables registry (Plan 01 bench winner: 214 raw tables on user thesis vs pdfplumber's 4 = 53.5x; 15 vs pymupdf's 9 on `friendly_real.pdf`; gmft excluded due to transformers strict-dataclass break on TATR `dilation=None` config). Migration 047 sealed `app_settings.extraction_table_engine_pdf` default to `camelot` with CHECK constraint reducing allowed values to `{camelot, pdfplumber}`. Equation engine reduced to `none` (placeholder — no equation extraction in v2.6). Plan 04 hard-deleted Docling adapters + source file + AGPL subprocess fence (PyMuPDF in-process per Phase G PASS smoke test on `reference.pdf`); `httpx>=0.28.0` upper-bound removed (Phase F PASS — supabase-py's transitive `postgrest==2.29.0` still caps httpx at <0.29 but our requirements.txt no longer carries the policy constraint); EXTRACTOR_DOCLING_* env knobs + EXTRACTOR_PRIMARY env var all evicted. Plan 05 live UAT (3 fixtures): thesis 214 tables / 20 images / 461 chunks; friendly_real.pdf 15/1/65; reference.docx 1/1/2 — SC#6 ship floor (>=15 tables, camelot target) cleared by 14.3x. SEED-019 closed; SEED-020 (retrieval-quality audit) planted; SEED-021 (table/image recall lift) planted because thesis image axis tripped (20 < 45 per D-071.3-16). **Supersedes D-PRD-07 Appendix** (PyMuPDF AGPL subprocess fence policy — fence retired; AGPL in-process posture per D-PRD-07 main clause remains the authority for PyMuPDF specifically). Supersedes D-v2.6-01 partially (`docling>=2.93.0,<3.0.0` no longer in requirements; `httpx<0.29` cap removed; `supabase>=2.29.0` relaxed from `==2.29.0`). | New — locked 2026-05-16 by Phase 071.3 Plan 05 close; v2.6 PRD's "Docling-first" thesis formally retired in favor of per-aspect swap-by-default optionality |

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
*Last updated: 2026-05-21 — Phase 075.1 (Cross-Provider Streaming Stability + Observability Polish Bundle) complete. 4/4 plans shipped. Universal "stuck on Running code until F5" symptom CLOSED — verified live via Chrome MCP on all 3 providers (OpenAI gpt-4.1, Anthropic claude-opus-4-6 + claude-sonnet-4-6, OpenRouter llama-3.3-70b): 45s-sleep test completes without F5, OpenRouter shows no Resume button mid-stream. Plan 02 backend root-cause fix (`harvest_output_files` → `run_in_threadpool` per D-v2.5-01) + Plan 01 widened `_isTransientStreamEnd` filter substrate. Plan 03 Anthropic content-block reducer invariant locked via tests + guard comments (the hypothesized bug was NOT actually present in the post-Plan-01 codebase; UAT 2 against claude-sonnet-4-6 primes-matplotlib stress test confirmed mixed text + tool_use blocks coexist correctly — BUG-260514-02 narration-vs-summary INCIDENTALLY CLOSED). Plan 04 polish bundle: LangSmith Anthropic `@traceable(name="ChatAnthropic")` + per-provider `chat_name`, sub-agent log/payload/UI line + Settings dropdown, snapshot Redis-probe short-circuit on empty active_runs (B-260519-02 FIXED — 36 inspected snapshots all 200), `Dockerfile.sandbox` with pre-installed matplotlib/numpy/pandas/python-pptx (operator-pending: requires `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:075.1 backend/` + `SANDBOX_IMAGE` env var to activate), `deduplicatedToolCalls` in `ToolCallPanel`, output-files per-cell delta + pinned final-outputs panel, stdout vs stderr styling fix (emerald vs red), stale `loadMessages` on ChatArea mount removed (Test 2 dual-/messages: 0 GET /messages across 36 requests). UAT 11/13 PASS, 2 REGRESSIONS deferred to Phase 075.2 (inserted 2026-05-21): BUG-260521-01 (ToolCallPanel duplicates first tool card on both OpenAI AND Anthropic) + BUG-260521-02 (pinned Final Outputs panel renders filenames as plain text, no download link — IN-03 from code review confirmed visually). Code review: 0 critical / 3 warning (WR-01 onToolEnd name+status match, WR-02 two-probe getSnapshot race, WR-03 dedup fallback key collapse) / 4 info. Cross-phase test breakage caught + fixed inline: `test_sandbox_service::TestHarvestOutputFiles` migrated to new 2-tuple `(delta_files, current_files_set)` return signature. Schema drift gate: valid, 0 issues. Next: Phase 075.2 (ToolCallPanel dedup-by-id audit + Final Outputs download link). Prior entry: 2026-05-18 — Phase 074 (SEED-009 + SEED-011 Polish Bundle) complete. 2/2 plans shipped, VERIFICATION 6/6 must-haves verified. Plan 074-01 (SEED-009) extended `MODEL_CAPABILITIES` with optional `max_output_tokens: int` field (29/32 entries populated using docs-verified-2026-05-18 hard caps; 3 preview models intentionally omitted) and inserted a single bottom-of-function clamp gate in `backend/app/services/openai_service.py::_resolve_max_tokens` (refactored to single-return shape; `:exacto` OpenRouter quality-routing suffix stripped via `.removesuffix()`, `:free` preserved as a legitimate model-card suffix). Live UAT operator-approved 2026-05-18 — 2 `claude-haiku-4-5-20251001` runs with `MODEL_OUTPUT_LIMITS=65536` env override reached `status='completed'` with no 400 BadRequestError (the bug class from Phase 067.5 Cycle 5). Plan 074-02 (SEED-011) hoisted the `_reset_redis_singleton` autouse fixture from per-file copies in test_062 + test_063 into a new shared sibling conftest at `backend/tests/integration/conftest.py` (37 lines); SEED-011's loop-binding signature `Event loop is closed` returns zero matches across the full 4-file post-Plan-02 sweep. Code review: 0 critical / 0 warning / 2 info (style only). Two deferred items captured: **D-074-01-DEFER-1** — backend has no `logging.basicConfig()` so the clamp's `logger.info(...)` breadcrumb is currently invisible app-wide (logging-config polish for a future phase; clamp still runs correctly). **D-074-02-DEFER-1** — Phase 073 → Phase 074 fixture-seeding collision: `test_059/062/063` fail with `runs.thread_id_fkey` FK violation on real-asyncpg `runs INSERT` because their fixtures don't seed `auth.users` + `threads` rows like Phase 073's `test_073_concurrency.py` does. Proven pre-existing on pre-merge base `32e873d`; user accepted continue at test-gate decision. Phase 073 binding gate `test_073_concurrency.py` 4/4 PASS (no regression). Schema drift gate: valid, no issues. Next: Phase 075 (SEED-008 + tool_args_progress Polish Bundle). Prior entry: 2026-05-17 — Phase 073 (asyncpg Pool Integration) complete. 4/4 plans shipped, VERIFICATION 5/5 SCs verified. Streaming hot-path Postgres reads/writes flipped from sync `supabase-py`+`aexec` to a new `asyncpg>=0.29` pool singleton (`backend/app/dependencies.py::get_pg_pool`); exactly 3 surgical flips in `backend/app/api/threads.py` (runs INSERT, messages INSERT, runs UPDATE finalize). New typed-helper module `backend/app/db/runs.py` owns the SQL strings. `runs.input_tokens` / `runs.output_tokens` forward-fill from LLM `usage` field — OpenAI `stream_options={'include_usage': True}` + Anthropic message_start/delta events with Pitfall 9 no-double-count guard; missing-usage emits identifier-only `logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)` (T-073-04 no-leak invariant). D-073-11 two-gate strategy live: `test_058_concurrency.py` byte-identical preserved, new `test_073_concurrency.py` (REAL asyncpg pool against local :54322) all 4 binding-gate tests green. `aexec` preserved for 30+ cold-path call sites. WORKER-LIFT-02 + TOKEN-COL-01 Validated. Code review: 0 critical / 1 cosmetic warning (dead `row` dict writes) / 5 info. Next: Phase 074 (SEED-009 haiku max_tokens clamp + SEED-011 test_059 fixture cleanup). Prior entry: 2026-05-17 — Phase 072 (Multimodal Lift + DOCX Completeness) complete. 5/5 plans shipped including in-band gap closure (Plans 04 + 05) for VERIFICATION.md Gap 2 (retry-empty dispatcher mismatch) + Gap 3 (BUG-260517-01 orphan chunks). Both gap closures verified on production data: Gap 2 = 58/58 = 100% refill (pre-fix 0/58); Gap 3 = chunk count matches actual + idempotent on second /reingest. RAG-MM-LIFT-01 + RAG-MM-LIFT-02 Validated. vision_sweep deferred to SEED-021. Prior entry: 2026-05-16 — Phase 071.4 (Post-071.3 polish bundle) complete. 4/4 plans shipped, 4 reported bugs closed (BUG-260516-01..04), SEED-022 magnitude unmasked. Highlights: (1) Camelot precision row/col floor reduces thesis PDF tables 214 → 48 (4.4x reduction, matches DOCX ground truth ±23%). (2) `/reingest` endpoint accumulation bug fixed — was silently doubling document_tables + document_images on every click; now mirrors /reextract's delete cascade. (3) Library Health infinite-fetch loop fixed (useRef<Set<TabKey>> replaces tabData-in-deps anti-pattern). (4) Documents page Realtime now updates counts + status live (spread-merge + refetch on terminal state), and gained a per-row Reingest button matching Library Health affordance. All 4 plans inline-executed + Chrome MCP verified. Prior entry: 2026-05-16 — Phase 071.3 (Docling demotion + camelot table engine + full rip) complete. 5/5 plans shipped, VERIFICATION 7/7 (SC#6 closed via operator override — image baseline inherited from Docling-extractor retirement, recall lift tracked by SEED-021). Camelot wins bench (thesis 214 raw tables vs pdfplumber 4 = 53.5x; vs pymupdf 188; gmft excluded due to upstream transformers strict-dataclass break). Migration 047 seals app_settings.extraction_table_engine_pdf default to 'camelot' with CHECK constraint {camelot, pdfplumber}. Plan 04 hard-deletes Docling adapters + source file + AGPL subprocess fence (PyMuPDF runs clean in-process per Phase G smoke); httpx upper-bound removed (Phase F PASS — supabase-py's transitive postgrest still caps at <0.29 but our requirements.txt no longer carries the policy constraint); EXTRACTOR_DOCLING_* + EXTRACTOR_PRIMARY env knobs evicted. Live UAT: thesis 214/20/461; friendly_real 15/1/65; reference.docx 1/1/2. SEED-019 closed; SEED-020 (retrieval-quality audit) + SEED-021 (image-axis recall lift) planted. v2.6 PRD's "Docling-first" thesis formally retired (D-v2.6-05 supersedes D-PRD-07 Appendix fence policy + parts of D-v2.6-01). Prior entry: 2026-05-15 — Phase 071.2 (Ingestion plumbing + per-aspect extraction dispatcher) complete. 5/5 plans shipped, 8/10 success criteria code-verified, 2 env-blocked parked in `071.2-HUMAN-UAT.md` (both Docling and PyMuPDF subprocess crash on the thesis PDF in WSL). Per-aspect dispatcher (`extract_composable` + `aspects/{text,tables,images_pdf,images_docx,equations}.py` + migration 045 + `?engines=` per-call hint) is now the architectural anchor: every extraction aspect is independently swappable. Docling stays available as opt-in only — Phase 071.3 (SEED-019) will diagnose the PyMuPDF subprocess OOM, benchmark non-Docling engines, then ship migration 046 flipping defaults to the winner. The v2.6 PRD's "Docling-first" thesis is formally retired in favor of swap-by-default optionality. Prior entry: 2026-05-15 — Phase 071.1 (Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback) complete-partial. The 4-min Docling stall failure mode from Phase 071's SC#1 is structurally eliminated; thesis PDF that previously stalled indefinitely now completes in 125s. The 20% binding-gate delta stays RED but the root cause shifted from "stall" to "PDF-vs-DOCX extraction-quality gap" — accept-degraded disposition, escalate to Phase 071.2 (proposed). Next phase: 071.3 (PyMuPDF subprocess OOM diagnostic + non-Docling engine evaluation, per SEED-019). Prior entry: 2026-05-14 — Phase 069 (PdfExtractor Abstraction Scaffold) complete. Carved today's pypdf + pdfplumber + python-docx pipeline behind a `PdfExtractor` ABC seam; binding golden gate live; Q-v2.6-06 closed via D-PRD-07 appendix (PyMuPDF AGPL-3.0 fallback license posture). 8 code-review findings: BLOCKER + 2 HIGH fixed in-phase (tuple-typed dataclass fields, Pillow declared, patch.object test migration); 2 MEDIUM + 3 LOW deferred to Phase 071. Next: Phase 070 (Docling httpx Spike — resolves Q-v2.6-01 dependency conflict). v2.6 (Foundation: RAG Quality + Multi-Worker + Polish) kicked off via `/gsd:new-milestone v2.6`. Scope consumed from `.planning/PRDs/v2.6.md` (locked 2026-05-10, signed off 2026-05-12 with TOKEN-COL-01 added at signoff). 21 Active REQ-IDs across 6 themes; phases 068–082 proposed in PRD §12 (~38 plans). Migration range 039–049 reserved. Continues phase numbering from v2.5's last phase 067.5. Six seeds (006/007/008/009/010/011) consumed at milestone completion; SEED-001 partial. Pre-execution decisions Q-v2.6-01..06 routed to `/gsd:discuss-phase` per phase. v2.5 (Deployment Strategy) shipped 2026-05-09 — 16 phases / 64 plans / ~104K LOC delta.*