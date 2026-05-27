# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18–25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26–32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33–43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44–57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058–067.5 (shipped 2026-05-09)
- ✅ **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068–082 (shipped 2026-05-27)

---

## v2.6 Milestone Context

**Goal:** Build the production-ready substrate the next four milestones depend on — close the user-observed PDF↔DOCX extraction inconsistency, lift the single-worker concurrency ceiling, hoist the streams subscription surface out of `useMessages`, and absorb six carry-forward seeds before they compound.

**Scope brief:** [`.planning/PRDs/v2.6.md`](PRDs/v2.6.md) (locked 2026-05-10, signoff 2026-05-12 with TOKEN-COL-01 addition). All 6 PRD gates passed (compatibility, scalability, coverage, doc-validity, surprise-feature, lean).

**Phase numbering basis:** Continues from v2.5's last phase 067.5 → v2.6 starts at Phase **068** and runs through Phase **082** (16 phases, ~40 plans total — includes mid-milestone amendment Phase 068.5). Matches PRD §12 phase outline verbatim except for Phase 068.5, added 2026-05-13 to absorb BUG-260513-01 (chat-surface persistent rendering); PRD v2.6 §4 amendment recommended at user's discretion.

**Migration range reserved:** `039 – 049` (per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`).
- Used: `039` (071), `040` (071), `041` (071), `042` (071), `043` (078), `044` (072), `045` (071.2), `046` (071.3), `047` (071.3), `048` (075.3), `049` (075.10), `050` (076.1), `051` (078), `052` (079)
- Overflow: `050 – 052` exceeded reserved range; absorbed by mid-milestone insert phases

**Pre-execution decisions:** Six PRD §13 questions (Q-v2.6-01..06) routed to per-phase `/gsd:discuss-phase` — **not blocking the roadmap**. See PRD §13 + `REQUIREMENTS.md` Pre-execution Decisions table for owning-phase mapping.

---

## Phases

<details>
<summary>✅ v1.0 Knowledge Base Explorer (Phases 1–8) — SHIPPED 2026-03-29</summary>

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) — completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) — completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) — completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) — completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) — completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) — completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) — completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) — completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Agent Skills & Code Execution (Phases 9–17) — SHIPPED 2026-04-04</summary>

- [X] Phase 9: Persistent Tool Memory (1/1 plans) — completed 2026-03-29
- [X] Phase 10: Agent Skills Core (3/3 plans) — completed 2026-03-31
- [X] Phase 11: Skills LLM Integration (3/3 plans) — completed 2026-04-01
- [X] Phase 12: Skills UI (3/3 plans) — completed 2026-04-02
- [X] Phase 13: Skills Open Standard (2/2 plans) — completed 2026-04-02
- [X] Phase 14: Code Execution Sandbox (5/5 plans) — completed 2026-04-03
- [X] Phase 15: Code Output UI (2/2 plans) — completed 2026-04-03
- [X] Phase 16: Skill File Management UI (2/2 plans) — completed 2026-04-04
- [X] Phase 17: Tech Debt Cleanup (1/1 plans) — completed 2026-04-04

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Stability & RAG Correctness (Phases 18–25) — SHIPPED 2026-04-11</summary>

- [X] Phase 18: Context Window Hardening (1/1 plans) — completed 2026-04-09
- [X] Phase 19: Sub-Agent Guards & API Error Visibility (1/1 plans) — completed 2026-04-10
- [X] Phase 20: Blank Response Guards (1/1 plans) — completed 2026-04-10
- [X] Phase 21: Keyword Search Folder Scope (1/1 plans) — completed 2026-04-10
- [X] Phase 22: RAG Correctness Fixes (1/1 plans) — completed 2026-04-10
- [X] Phase 23: System Prompt Quality (1/1 plans) — completed 2026-04-10
- [X] Phase 24: Infrastructure Hardening (1/1 plans) — completed 2026-04-10
- [X] Phase 25: Sub-Agent Intelligence & Model-Aware Context (1/1 plans) — completed 2026-04-10

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>✅ v2.2 Trust & Compliance (Phases 26–32) — SHIPPED 2026-04-16</summary>

- [X] Phase 26: Citations & Confidence — Backend (2/2 plans) — completed 2026-04-12
- [X] Phase 27: Citations & Confidence — Frontend (1/1 plans) — completed 2026-04-12
- [X] Phase 28: Document Versioning — Schema & Ingestion (2/2 plans) — completed 2026-04-12
- [X] Phase 29: Document Versioning — UI (2/2 plans) — completed 2026-04-13
- [X] Phase 30: Audit Log — Backend (2/2 plans) — completed 2026-04-14
- [X] Phase 31: Audit Log — Settings UI (2/2 plans) — completed 2026-04-14
- [X] Phase 32: Suggested Follow-Up Questions (2/2 plans) — completed 2026-04-16

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3 Memory, Multimodal & Experience (Phases 33–43) — SHIPPED 2026-04-19</summary>

- [X] Phase 33: Cross-Thread Memory — Backend (2/2 plans) — completed 2026-04-17
- [X] Phase 34: Cross-Thread Memory — Settings UI (1/1 plans) — completed 2026-04-17
- [X] Phase 35: Multi-Modal Ingestion (4/4 plans) — completed 2026-04-18
- [X] Phase 36: Multi-Modal Query & Library UI (3/3 plans) — completed 2026-04-18
- [X] Phase 37: Knowledge Health Dashboard — Backend (2/2 plans) — completed 2026-04-18
- [X] Phase 38: Knowledge Health Dashboard — Frontend (2/2 plans) — completed 2026-04-18
- [X] Phase 39: User Feedback Loop — Backend (2/2 plans) — completed 2026-04-18
- [X] Phase 40: User Feedback Loop — Frontend (2/2 plans) — completed 2026-04-19
- [X] Phase 41: UI Redesign — Tool Call Visualizer & Citations (2/2 plans) — completed 2026-04-19
- [X] Phase 42: UI Redesign — Layout Shell & Skills (3/3 plans) — completed 2026-04-19
- [X] Phase 43: UI Redesign — Mobile & Responsive (3/3 plans) — completed 2026-04-19

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>✅ v2.4 Stability, Polish & UX Fixes (Phases 44–57) — SHIPPED 2026-04-30</summary>

- [X] Phase 44: SSE & Stop Reliability (1/1 plans) — completed 2026-04-23
- [X] Phase 45: Chat UX Fixes (2/2 plans) — completed 2026-04-23
- [X] Phase 46: Document Version Deletion (2/2 plans) — completed 2026-04-25
- [X] Phase 47: Document List & Upload Polish (2/2 plans) — completed 2026-04-25
- [X] Phase 48: Settings & Navigation Polish (3/3 plans) — completed 2026-04-25
- [X] Phase 49: Library Health at Scale (2/2 plans) — completed 2026-04-25
- [X] Phase 51: Context Window Management (7/7 plans) — completed 2026-04-24
- [X] Phase 52: Multi-Provider Model Routing (3/3 plans) — completed 2026-04-25
- [X] Phase 53: Cross-Provider Tool Calling Reliability (4/4 plans) — completed 2026-04-26
- [X] Phase 54: Reliable Agentic Generation (5/5 plans) — completed 2026-04-26
- [~] Phase 55: Streaming Reliability & Connection Resilience (4/5 plans) — DEFERRED (Realtime INSERT race)
- [X] Phase 56: Agent Real-Time Feedback (3/3 plans) — completed 2026-04-29
- [X] Phase 56.1: Agent Feedback Gaps (3/3 plans) — completed 2026-04-29
- [~] Phase 57: SSE Realtime Reconnect Fix (2/2 plans executed, tests unreliable) — DEFERRED → v2.5

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>✅ v2.5 Deployment Strategy (Phases 058–067.5) — SHIPPED 2026-05-09</summary>

- [X] Phase 058: Backend SSE Concurrency Fix (3/3 plans) — completed 2026-05-01
- [X] Phase 059: SSE Architecture Refactor (3/3 plans) — completed 2026-05-02
- [X] Phase 060: Frontend Race Fixes (3/3 plans) — completed 2026-05-02
- [X] Phase 061: Run-Backed Streaming Backend (5/5 plans) — completed 2026-05-02
- [X] Phase 061.1: Run-Backed Streaming Cleanup — completed 2026-05-03
- [X] Phase 062: Replay & Tail API (4/4 plans) — completed 2026-05-03
- [X] Phase 063: Frontend Stream Decoupling (5/5 plans) — completed 2026-05-04
- [X] Phase 063.1: Frontend Stream Decoupling Gap Closure (5/5 plans) — completed 2026-05-04
- [~] Phase 064: Validation Harness — DEFERRED (covered organically by 067.x UAT scoreboards)
- [X] Phase 065: Skills Test Infrastructure Repair (3/3 plans) — completed 2026-05-09
- [X] Phase 066: Adaptive Run Timeouts & Lifecycle States (5/5 plans) — completed 2026-05-06
- [X] Phase 067: Frontend Streaming-UX Fix (5/5 plans) — completed 2026-05-07
- [X] Phase 067.1: Agent Streaming & Behavior Polish (4/4 plans) — completed 2026-05-07
- [X] Phase 067.2: Streaming Render & Storage Fixes (6/6 plans) — completed 2026-05-09 (cross-phase chain via 067.3/067.4/067.5)
- [X] Phase 067.3: Streaming Render & Storage Fixes Round 2 (5/5 plans) — completed 2026-05-09 (cross-phase chain via 067.4)
- [X] Phase 067.4: Streaming Suggestions, Tool-Stage Render & Code-Execution Stream (5/5 plans) — completed 2026-05-09 (Row 11 closed via 067.5)
- [X] Phase 067.5: Frontend Reconcile Fix Empty-Thread-Until-Refresh (2/2 plans) — completed 2026-05-09

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>✅ v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068–082) — SHIPPED 2026-05-27</summary>

**Wave 0 — Foundational** (no inter-wave dependencies; can start in parallel)

- [ ] **Phase 068: `<StreamsProvider>` Context Lift** — Hoist `subscriptionsRef`, `lastSeenOffsetRef`, `messagesByThread` Map, and the Phase 067.5 Branch D-3 `clearMessages` guard from `frontend/src/hooks/useMessages.ts` (1229 LOC) into a top-level `<StreamsProvider>` Context. `useMessages` becomes a thin reader. Frontend-only. (4 plans)
- [ ] **Phase 068.5: Chat-Surface Persistent Rendering + In-Flight Pulse** — Render last-known-good messages immediately on thread switch / page nav / refresh; reconcile via `GET /threads/{id}/messages` in background; animated pulse on un-terminated assistant turns (`runs.status='running'`); inline retry on fetch failure. Closes BUG-260513-01. Frontend-only with backend touchpoint to expose `runs.status` per-message client-side. (2 plans)
- [ ] **Phase 069: `PdfExtractor` Abstraction Scaffold** — Carve current pypdf + python-docx + pdfplumber pipeline behind a `PdfExtractor` ABC; no behavior change at the wire layer. (2 plans)
- [ ] **Phase 070: Docling httpx Spike** — Validate Q-v2.6-01 resolution path: try (a) supabase-py 2.10 → 2.29, (b) docling pin-back, (c) subprocess isolation, in that order. Output: a chosen path + a working CI proof. (2 plans)

**Wave 1 — Parallelizable RAG + asyncpg + Polish**

- [ ] **Phase 071: Docling Primary Path** — Make Docling the default extractor; PyMuPDF (AGPL, subprocess-fenced) + pypdfium2 fallbacks wired. Migrations 039 (`pdf_extraction_runs`), 040 (`documents.extractor`), 041 (`document_images.bbox`), 042 (`document_tables.bbox + extractor`). (4 plans)
- [ ] **Phase 071.2: Ingestion Plumbing + Docling Quality Diagnostics** — `/upload` + `/reingest` `run_in_threadpool` sweep + instant-201 BackgroundTask refactor (document row INSERTed BEFORE extract so Realtime drives frontend status); diagnose + close the 95%-chunks-drop on Docling-extracted PDFs + the 4-vs-1 telemetry-vs-storage table-count mismatch. Inserted 2026-05-15 before Phase 072 so multimodal lift doesn't compound the foreground-extract latency bug. (4 plans)
- [ ] **Phase 071.3: Docling Demotion — Table Engine Pick + Full Rip** — Promote SEED-019. Bench PyMuPDF `find_tables(strategy="text")` + gmft (MIT, TATR-backed) + Camelot 1.0 Stream on the user's thesis; pick a non-Docling table engine that beats `pdfplumber`'s 4-of-20+ ceiling. Ship migration 047 flipping `extraction_table_engine_pdf` default. Full Docling cleanup: delete `docling` from `requirements.txt`, delete `docling.py` + 4 Docling adapters, unpin `httpx<0.29`, delete `pymupdf_isolated.py` subprocess fence if PyMuPDF runs clean in-process post-unpin. Plant SEED-020 (embedding-model audit) at close. Inserted 2026-05-16 after migration 046 demoted Docling defaults (commit `315f307`) but `pdfplumber` interim still misses 16+ tables. (5 plans)
- [x] **Phase 071.4: Post-071.3 Polish Bundle** — Camelot precision row/col floor (SEED-022 partial close — drops thesis PDF from 214 → 48 stored tables, 4.4x reduction verified); BUG-260516-02 fix (Library Health infinite-fetch loop); BUG-260516-01 + BUG-260516-03 fixes (documents-list realtime counts + Reingest button); BUG-260516-04 fix (/reingest endpoint accumulation — silent data corruption on every Reingest click). Inserted + shipped 2026-05-16 after Phase 071.3 testing surfaced 4 friction points on surfaces Phase 072 will build on. 4 bugs closed, SEED-022 magnitude unmasked. (4 plans)
- [x] **Phase 072: Multimodal Lift + DOCX Completeness** — Replace `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` module constants with `app_settings` keys; persist empty-vision-description rows (`description=''`); DOCX `related_parts` walk catches floating shapes + headers/footers. Shipped 2026-05-17 with in-band gap closure (Plans 04 + 05): retry-empty `/reextract?retry_empty_descriptions_only=true` rewritten to use `extract_composable` per-aspect dispatcher (Gap 2 / floating-shape DOCX refill — verified 58/58 = 100% on operator's thesis DOCX), and `/reingest` cascade widened to delete chunks + tables + images doc-id-scoped (Gap 3 / BUG-260517-01 orphan chunks — verified orphan-free + idempotent on production data). `vision_sweep` engine + ≥80% recall target DEFERRED to SEED-021 spike-first path per user cost concern. (5 plans)
- [ ] **Phase 073: asyncpg Pool Integration** — Replace sync `supabase-py` calls in streaming endpoint + ingestion task with asyncpg. New `_pg_pool` singleton at `dependencies.py`. Forward-fill `runs.input_tokens` / `runs.output_tokens` from LLM `usage` in the `_drain_stream_with_close_on_cancel` finalize path (TOKEN-COL-01 attaches here — see FLAGS below). (4 plans)
- [ ] **Phase 074: SEED-009 + SEED-011 Polish Bundle** — `MODEL_CAPABILITIES.max_output_tokens` field + `_clamp_max_tokens` in `anthropic_service.py` + `_reset_redis_singleton` autouse fixture in `test_059_disconnect.py`. (2 plans)
- [ ] **Phase 075: SEED-008 + tool_args_progress Polish Bundle** — `GET /threads/{id}/snapshot` combined endpoint + line-by-line `code_stdout` SSE re-wire + `tool_args_progress` SSE event for non-execute_code tools. (3 plans)
- [x] **Phase 075.1: Cross-Provider Streaming Stability + Observability Polish Bundle** (INSERTED, shipped 2026-05-21) — Closed 9/11 UAT bugs + BUG-260514-01 from `075-CROSS-PROVIDER-UAT.md` (v4). Universal SSE-break ROOT-CAUSE fixed (Plan 02: `harvest_output_files` → `run_in_threadpool` per D-v2.5-01). Verified live via Chrome MCP on all 3 providers: 45s-sleep test completes without F5 on OpenAI / Anthropic / OpenRouter, no Resume button mid-stream. Anthropic content-block reducer invariant locked (Plan 03 — bug was not actually present in post-Plan-01 codebase, but tests + guards lock invariant). Snapshot 503 fixed (Plan 04), stdout/stderr styling fixed, per-cell + pinned final-outputs panels render, output download links work, dual-/messages eliminated. BUG-260514-02 narration-vs-summary INCIDENTALLY CLOSED. Deferred to Phase 075.2: BUG-260521-01 (ToolCallPanel dedup duplicates first tool card across providers) + BUG-260521-02 (pinned Final Outputs panel has no download link). Operator-pending: B-260519-08 sandbox image needs `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:075.1 backend/` + `SANDBOX_IMAGE` env var. (4 plans)
- [x] **Phase 075.2: ToolCallPanel Dedup + Final Outputs Download Link** (INSERTED 2026-05-21, shipped 2026-05-22) — Close 2 defects surfaced by Phase 075.1 Chrome MCP UAT. (1) BUG-260521-01 cross-provider transient duplicate first-tool card — **CLOSED** via Plan 01: WR-02 snapshot threading + `onToolStart` else-branch replay-idempotency + WR-01 onToolEnd id-match + WR-03 dedup-key idx tiebreaker. Chrome MCP UAT confirmed exactly ONE card across t≈3s/10s/15s/30s on OpenAI gpt-4.1 (45s sleep, "Used 1 tool 60.7s") AND Anthropic claude-sonnet-4-6 (primes-matplotlib, "Used 1 tool 12.7s"). (2) BUG-260521-02 pinned Final Outputs missing download link — **PARTIAL CLOSE** via Plan 02: OutputFileCard extracted to shared module + reused in pinned panel (visual consistency achieved, url-optional fallback render verified live). Click-to-download remains broken because backend `_previous_files_in_run: set[str]` deliberately discards URLs (Phase 075.1 Plan 04 Atom E design) — surfaced as BUG-260522-02 for a future phase. Vitest 24/24 + typecheck clean. (2 plans)
- [ ] **Phase 075.3: Defensive Chunk Handler + Unknown-Model Graceful Degradation** (INSERTED 2026-05-22) — Two-plan bundle. Plan 01: Convert quick-task 260522-gdg Path A hotfix into defensive Path B at the chunk handler (drop `chunk.usage`-triggered early-return, provider-aware usage accumulator, revert Path A gate, restore non-NULL Google token rows). Plan 02: Close the "added a new model from Settings → silent failure" loop — pattern-based provider inference for unknown model_ids (`gpt-*`/`claude-*`/`gemini-*`/`*/*` patterns), safe defaults per inferred provider (conservative `max_output_tokens` / `llm_call_timeout` / `native_tools=True` for Google/OpenAI/Anthropic), `model_capability_unknown` warning log, frontend "unverified — using safe defaults" badge. Chrome MCP UAT across all 5 Gemini models + 1 negative-test pass for an unregistered model_id (e.g., `gemini-3.5-flash`). BUG-260522-01 → Phase 082.5; SEED-028 native Google SDK split → v3.1; DB-backed override table + hot-reload cache + admin UI → Phase 081.1; `/models` endpoint probe + verify-and-promote → v3.1. (2 plans)
- [ ] **Phase 075.6: Live Streaming UX + Cross-Provider Parity** (INSERTED 2026-05-23) — Three-plan bundle informed by Claude.ai gold-standard comparison (`.planning/phases/075.5-gemini-native-sdk/claude-ai-comparison/COMPARISON.md`). Plan 01: Add `code_so_far: string` field to existing `tool_args_progress` SSE event in all 4 service adapters (anthropic + google + openai + openrouter) — provider-uniform vocabulary so one frontend renders for all providers. Plan 02: Frontend `<ToolArgsLivePanel>` collapsible code panel during `tool_preparing` state; `argsCodeText` reducer slice; auto-collapse on `tool_start`. Plan 03: Surface accumulated `m.sub_agent.content` live for all sub-agent kinds (currently gated to `analyze_document` only); step-list collapse when 3+ completed tool calls precede active step; pinned "✦ Working" badge at top of active assistant turn. UAT covers the mandatory 4-axis bandwidth (CLAUDE.md). Out of scope: file output card polish (T-260523-10 → next polish bundle), live PPTX preview pane (defer), extended-thinking summary surface (defer to thinking-models phase). Closes the felt UX gap behind T-260523-09 (byte counter is interim signal, panel supersedes). (3 plans)
- [x] **Phase 075.7: Live-Execution UX Refactor (Run-Card + Tool-Call Panel)** (INSERTED 2026-05-24, SHIPPED 2026-05-24) — Refactor phase consuming the validated sketch findings (`Skill("sketch-findings-agentic-rag")`) to settle G-1 + G-5 guardrails on the chat surface. Replaces the current ad-hoc rendering with: (a) bracketed Run-Card per assistant turn (sticky header with timer + counter + bot avatar, progress shimmer while active, fold-to-summary on completion), (b) Editor-Inset tool-call panel with per-tool inner-body components (`execute_code` → editor pane + STDOUT/STDERR labeled regions + file-output preview cards; `search_documents` → ranked-result rows; `read_file` → file metadata; outer frame shared, inner body selected by tool name), (c) Focus Mode composition under long-run stress (past tool calls fold to result-summary like `→ yoy_q3 = 30.87%`, only active step keeps full editor, explicit `Next: ...` footer). Depends on Phase 075.6 (`code_so_far` SSE field). UAT covers the mandatory 4-axis bandwidth (CLAUDE.md SC#10). Hot-file ledger flips from "fires" → "satisfied" on `ToolCallPanel.tsx` / `MessageItem.tsx` / `useMessages.ts` / `StreamsProvider.tsx` rows. (~3-4 plans, locked at /gsd:spec-phase + /gsd:plan-phase)
- [x] **Phase 075.8: Live-Execution Visual Polish** (INSERTED 2026-05-24, SHIPPED 2026-05-24) — Close the 7 documented sketch-fidelity gaps left BEST-EFFORT after 075.7 architectural refactor. Pure rendering polish on existing data — no architecture/schema/API/provider contract changes. Deliverables: universal `<StatusPill>` (replaces icon spinners across tool-bodies), active-tool glow + bottom progress shimmer, per-step result-summary lines (`→ {summarize(tc)}`) on past tools in Focus Mode, explicit `Next: ...` footer mid-run, compact dim `💭 Thinking` row, editor inset for `execute_code` (gutter + Shiki syntax highlighting + Python lang chip), labeled STDOUT/STDERR regions. Sketches are the spec (`Skill("sketch-findings-agentic-rag")` sources 001/002/003) so SPEC/CONTEXT/RESEARCH ceremony skipped. Single wave / 1 plan / 7 tasks. UAT: G-4 mandatory lived-experience pass against the 4 sketch reference scenarios via Chrome MCP. (1 plan)
- [x] **Phase 075.9: Live-Execution Fidelity Handoff** (INSERTED 2026-05-24, SHIPPED-PARTIAL 2026-05-24) — Close two felt-experience defects surfaced during Phase 075.8 manual UAT plus 3 advisory warnings from 075.8 code review. Defect 1: sub-agent (`analyze` etc.) cards visually duplicate mid-stream because `deduplicatedToolCalls` fallback key includes `idx` so the same logical tool at preparing-idx vs running-idx generates two dedup keys; heals only at array compaction post-`tool_start`. Fix: stable client-side `clientKey` stamped at first observation in the streams store, used by all `tc.id`-keyed surfaces (closes WR-03 from 075.8). Defect 2: `execute_code` shows code only AFTER execution completes (Claude.ai shows it streaming line-by-line); the Shiki inset reads final `tc.args.code` while the live `tc.argsCodeText` lives in a separate unhighlighted `<pre><code>` panel that vanishes at `tool_start`. Fix: Shiki inset reads `tc.argsCodeText ?? tc.args.code` with `useDeferredValue` 50ms throttle; ToolArgsLivePanel body suppressed for `execute_code` (header + byte-counter only) since the inset now owns the body. Plus WR-01 (Shiki promise singleton resets `highlighterPromise = null` on rejection) and WR-02 (JSDoc trust contract for `dangerouslySetInnerHTML`). Single wave / 1 plan / 5 tasks. G-1 phase-chain-cap operator-authorized continuation. UAT: G-4 mandatory — sub-agent dedup + live code stream + long code stream + Shiki failure recovery. (1 plan)
- [x] **Phase 075.11: Agent Timeout 3-Layer Audit + Unification** (INSERTED 2026-05-24, CLOSED-BY-QUICKFIX 2026-05-25) — Investigation showed the "900s wall" was actually L1 (per-LLM-call timeout) firing on `claude-sonnet-4-6` at its 240s default (operator memory was approximate). No backend code change needed — `LLM_CALL_TIMEOUT_OVERRIDES` env var already exists for this exact purpose. Resolution: `.env` tweak bumps Anthropic flagships (Sonnet 4-6/4-5 + Opus 4-6/4-7) to 1800s each + `CONSUMER_TIMEOUT_SECONDS=1810` so the SSE consumer outlasts the producer. Layers mapped: L1 = `MODEL_CAPABILITIES.llm_call_timeout_seconds` + `LLM_CALL_TIMEOUT_OVERRIDES` env var. L2 = `threads.py:1445-1452 max_iterations` (15 default / 8 explorer, no wall-clock; intentional per D-066-01 to match Claude/ChatGPT UX). L3 = `consumer_timeout_seconds` (610s default → 1810s post-fix). Note: `RUN_HARD_TIMEOUT_SECONDS` env var is silently ignored (Phase 066 D-066-01 removed it). The original 075.11 scope (Settings-UI tier presets matching Snappy/Default/Heavy/Extended-thinking public benchmarks) is preserved as a SEED for the future Settings-overhaul milestone — re-open trigger is "operator wants to tune timeouts without editing .env."
- [x] **Phase 075.10: Fine-Grained tool_args_progress Emission** (INSERTED 2026-05-24) — Close the backend SSE wire-format gap that 075.9 HUMAN-UAT exposed via Chrome MCP + patched-fetch SSE intercept on gpt-5.4 + claude-opus-4-6 + gemini-2.5-flash: ZERO `tool_args_progress` events fire for typical code (<5 KB) on any provider. Root causes: `anthropic_service.py:254` + `google_service.py:482` hardcode a 5120-byte cumulative-boundary emit cadence (any code <5 KB crosses zero boundaries → zero events); `openai_service.py` is missing the entire emission block (never emits at all, even though it accumulates `tool_calls[].function.arguments` deltas internally). Fix: migration 049 adds `app_settings.chat_tool_args_progress_emit_boundary_bytes INT DEFAULT 256`; anthropic + google services read it instead of the hardcoded 5120 (~20× more frequent emits, ~one event per Python line); openai_service.py gets the verbatim port of `google_service.py:367-490` adapted to OpenAI's tool_calls shape. OpenRouter parity for free if it routes through openai_service. Single wave / 1 plan / 5 tasks (migration → readers → 3 service ports → live UAT). 075.9 frontend is unchanged — already correctly wired, just needs chunks to render. (1 plan)

**Wave 2 — Depends on Wave 1**

- [x] **Phase 076: Confidence Recalibration** — Re-run Phase 32.5 calibration on post-071.3 default-set chunks (camelot tables + pymupdf_full images + legacy text + `none` equations); Q-v2.6-03 answer locked at 071.3 close to "re-run on new defaults". Score distributions documented in PROJECT.md. Thresholds adjusted 0.55/0.40 -> 0.54/0.38. (2 plans, shipped 2026-05-25)
- [x] **Phase 076.1: Provider Integration + UX Status Fidelity** (INSERTED 2026-05-25, shipped 2026-05-26) — 4 plans + 11 post-UAT fixes. **UX shipped:** auto-scroll to active tool panel, "Generating code"/"Executing code" labels, sticky timer bar, elapsed counter (no more "queued"), failure reason badges, two-pass text dedup, multi-batch tool panels render real-time (iteration-aware dedup fix). **Providers shipped:** DeepSeek/Moonshot/MiniMax/Zhipu direct integration, Settings UI 9 providers, OpenRouter relabeled experimental, single-source KNOWN_PROVIDERS. **DeepSeek:** working with thinking disabled (SEED-032 tracks full thinking mode + real-time UI parity). Migration 050 (reasoning_content column). Code review 4/4 warnings closed.
- [x] **Phase 076.2: Provider Streaming Parity + Full Integration** (INSERTED 2026-05-26, shipped 2026-05-26) — 4 plans + 2 UAT fixes. **DeepSeek shipped:** thinking mode enabled (reasoning_effort="high"), reasoning_content round-trip in agent loop (SEED-032 Gap 1+2 CLOSED), reasoning_delta SSE, collapsible Thinking block in RunCard, 9 unit tests. **Frontend:** reasoning_delta pipeline (types + api.ts + StreamsProvider + RunCard). **Google:** BUG-260524-01 confirmed behavioral (Gemini receives skills but doesn't invoke); debug logging added. **Kimi fixes:** base URL api.moonshot.cn→api.moonshot.ai, sub-agent moonshot-v1-8k→kimi-k2.6. **UAT:** DeepSeek DS-1..5 PASS, Kimi KI-1..3 PASS, MiniMax/GLM deferred (API keys pending). 4 bugs documented (BUG-260526-01..04). Code review 0 blockers / 2 warnings.
- [x] **Phase 077: Multi-Worker Validation Harness** — 50-parallel-run synthetic load; cross-worker cancel via Redis zombie-heal path; Docker container re-attach sandbox stickiness; per-worker Redis singleton verified idempotent. (3 plans, complete 2026-05-27)
- [x] **Phase 078: Backpressure JSON Primitive + Code-Quality Bundle** — `GET /admin/backpressure` JSON endpoint (gated on `BACKPRESSURE_ADMIN_USER_IDS` env var allow-list) + Supabase aclose lifespan hook + context-window protected-only overrun progressive trim + concurrent-upload dedup race NULL-safe unique index migration 051 + title-gen `logger.warning` log. (3/3 plans, shipped 2026-05-27)

**Wave 3 — Release-Gating**

- [x] **Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable** — Author the D-PRD-12 ADR; update `CLAUDE.md` single-worker rule to multi-worker reference; enable `--workers 2` via `WORKER_COUNT` env var; migration 052 (`runs.spawned_by_worker`). (2/2 plans, shipped 2026-05-27)
Plans:
- [x] 079-01-PLAN.md — D-PRD-12 ADR + docs + migration 052 + code + env config (Wave 1; autonomous)
- [x] 079-02-PLAN.md — Migration apply + full-schema regen + live multi-worker verification (Wave 2; autonomous: false)
- [x] **Phase 080: VPS Runbook + Deployment Guide Correction** — Update `RECOVERED_VPS_Deployment_Guide.md` to `--workers N` + Redis container deployment section + struck manual postgrest-py patch (auto-applied since v2.5 Phase 058 D-058-05). Update `RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` for Redis omission only. (1/1 plans, shipped 2026-05-27)
- [x] **Phase 081: SEED-010 OpenRouter UAT** — 4/4 OpenRouter synthetic-timeout UAT runs GREEN; Kimi-k2.5 and MiniMax-m2.7 verified; BUG-260526-02 not observed on OpenRouter route; closes 067.2 Rows 11-12 carry-forward. (1/1 plans, shipped 2026-05-27)
Plans:
- [x] 081-01-PLAN.md — Synthetic-timeout UAT: .env override + 4 runs (2 Kimi + 2 MiniMax) + 3-layer verify + .env restore (Wave 1; autonomous: false)
- [ ] **Phase 081.1: Settings Architecture Unification** (INSERTED 2026-05-27) — Eliminate settings_override.json; migrate 36 keys to app_settings DB + model_capabilities_overrides table; 30s TTL hot-reload cache; 4-tier model capability resolution (DB > env CSV > static dict > default). Foundation for v3.1 admin shell. (4 plans)
Plans:
- [x] 081.1-01-PLAN.md — Migration 053 SQL + async DB cache functions + unit tests (Wave 1; autonomous)
- [x] 081.1-02-PLAN.md — Migration apply checkpoint + migration runner in lifespan + frontend subtitle (Wave 2; autonomous: false)
- [x] 081.1-03-PLAN.md — Consumer rewire: user_settings.py DB-backed + settings.py async API + config.py 4-tier (Wave 3; autonomous)
- [x] 081.1-04-PLAN.md — Integration tests + human verification (Wave 4; autonomous: false)

**Wave 4 — Verify**

- [x] **Phase 082: Cross-cutting Verification + Extraction Telemetry** — 5/5 SCs GREEN: extraction counts within 20% band (SC#1), CONCUR-01 pytest green (SC#2), 067.5 Branch D-3 vitest 5/5 + Chrome MCP 5/5 lived-experience PASS (SC#3), telemetry populated (SC#4), 24/24 REQ-IDs Validated + 7 seeds dispositioned (SC#5). v2.6 milestone-close verification gate PASSED. (2 plans, shipped 2026-05-27)
- [ ] **Phase 082.5: Error Handler Foundation** — Urgent slice of SEED-026: global FastAPI exception handler + structured `ErrorResponse{code, user_message, admin_message, trace_id, timestamp, run_id, thread_id}` model + `logging.basicConfig` (closes D-074-01-DEFER-1) + new `app_errors` audit table + frontend `ApiError` typed parsing. Stops backend SDK internals from leaking to users; gives admins a `trace_id` to correlate user reports with server-side state before any production-shape rollout. Frontend toast lib + admin error inspector deferred to v2.7 (SEED-026 pillars 4-5). (2 plans)

Full details below in **Phase Details**.

</details>

---

### v2.6 Deployment Strategy

**Phased rollout per Q-v2.6-02 (recommended: phased, NOT atomic).** Unlike v2.5's atomic stream-architecture deployment (D-v2.5-11), v2.6's two independent workstreams ship sequentially:

1. **RAG quality lift (069 → 070 → 071 → 072 → 076 → 082):** Docling abstraction scaffold lands first as no-op refactor; httpx spike validates path; Docling primary swaps in with new migrations; multimodal ceiling + DOCX completeness ride alongside; confidence recalibration follows once Docling output is observable.
2. **Multi-worker rewrite (073 → 077 → 078 → 079 → 080):** asyncpg pool integration ships independently (well-understood mechanical refactor). Multi-worker validation harness proves cross-worker cancel + sandbox stickiness + per-worker Redis init are clean BEFORE the D-v2.5-02 supersession ADR lights up `--workers 2`. VPS runbook correction trails the supersession.
3. **Frontend Streams Provider lift (068) parallel from day one.** No dependencies on either workstream. Phase 067.5 Branch D-3 guard at `useMessages.ts:572-590` must survive verbatim — explicit Vitest regression test required.
4. **Polish bundles (074, 075, 081) parallel** — they cluster opportunistic carry-forwards.
5. **Cross-cutting verify (082) gates milestone close** — proves the three workstreams didn't regress each other (Docling baseline, CONCUR-01 under multi-worker, 067.5 cycles under StreamsProvider).

**No feature flags, no dual code paths.** Each phase ships green-or-revert; the abstractions (PdfExtractor ABC, asyncpg pool alongside aexec, StreamsProvider Context) make rollback per-phase, not milestone-wide.

---

## Phase Details

### Phase 068: `<StreamsProvider>` Context Lift
**Goal**: A new top-level Context owns all run-stream subscriptions so a second concurrent stream surface (e.g., v3.0 eval pane) can render without state collision; existing chat behavior is byte-identical.
**Depends on**: Nothing (Wave 0; parallel-able from start of milestone per D-PRD-06)
**Plans**: 4
**Requirements**: STREAMS-PROVIDER-01
**Success Criteria** (what must be TRUE):
  1. `useMessages` no longer owns `subscriptionsRef`, `lastSeenOffsetRef`, `reconcileInFlightRef`, `activeThreadIdRef`, or the per-run `messagesByThread` Map — they live in a `<StreamsProvider>` Context wrapped near `frontend/src/App.tsx`. `useMessages` reads them via `useStreamsContext()`.
  2. The Phase 067.5 Branch D-3 `clearMessages` guard at `useMessages.ts:572-590` (refuses to wipe a bucket whose thread is `streamingThreadIdRef.current`) is preserved verbatim — Vitest regression test asserts the guard fires identically post-lift.
  3. A mocked second stream surface (test-only) subscribes alongside chat and renders without colliding on the per-thread bucket invariant; existing 063 / 063.1 / 067.x Playwright e2e regression specs stay green.
  4. The `reconcileInFlightRef` D-063.1-11 single-bit lock semantics survive the lift — concurrent reconcile calls still bail at the top guard.

**Plans:** 4/4 plans complete
- [x] 068-01-PLAN.md — Store + provider scaffold (Wave 1; install zustand@^5.0.13; create streamsStore.ts + StreamsProvider.tsx + 4 named hooks; mount in App.tsx below auth gate; useMessages unchanged)
- [x] 068-02-PLAN.md — useMessages becomes thin reader + L-068-01..07 Vitest regression (Wave 2; binding gate SC#2 Branch D-3 per-surface; lift action bodies into provider; useMessages.ts < 100 LOC)
- [x] 068-03-PLAN.md — Reconcile listeners migration complete (Wave 3; delete ChatArea.tsx:157-187 listener block + reconcileRef indirection; provider is sole listener owner)
- [x] 068-04-PLAN.md — Mocked second surface + Chrome MCP exercise (Wave 4; SC#3 binding gate; DevTwoPaneMock dev-only component; re-render isolation test; manual checkpoint)

### Phase 068.5: Chat-Surface Persistent Rendering + In-Flight Pulse
**Goal**: The chat surface never blanks during thread switches, page navigations, or refreshes — last-known-good content paints instantly, server data reconciles in the background without clobbering streaming buckets, and in-flight assistant turns show a visible pulse so users can tell "still working" from "broken / stuck".
**Depends on**: Phase 068 (consumes the `<StreamsProvider>` Context surface; reads `streamsStore` bucket as the in-memory cache source)
**Plans**: 2
**Plans:**
- [x] 068.5-01-PLAN.md — Cache substrate + cold-render fix (localStorage snapshot + sync hydrate in Zustand factory; throttled-write + LRU eviction + quota-exceeded fallback; MessageSkeleton for cold-load; DELETE unconditional clearMessages() at ChatArea.tsx:134; Wave 0 RED tests for throttle/cache/hydrate/MERGE/cross-state/skeleton) — 2026-05-14
- [x] 068.5-02-PLAN.md — In-flight pulse + retry banner + Chrome MCP UAT (brandPulse keyframe in index.css + tailwind.config; MessageItem.tsx Bot icon gated on runStatus === 'streaming'; silent-1s-then-banner retry wrap on loadMessages with L-068.5-02 MERGE filter byte-identical; sticky retry banner in ChatArea; SC#5 Chrome MCP paint-timing UAT + SC#6 5/5 lived-experience cycles flipping BUG-260513-01 folded→closed)
**Requirements**: CHAT-RESILIENCE-01
**Mid-milestone amendment**: Added 2026-05-13 in response to BUG-260513-01 re-opening with expanded scope (page-nav + occasional load failure + Claude-style cached-render UX direction). Not in original PRD §12 outline — PRD amendment recommended.
**Success Criteria** (what must be TRUE):
  1. Switching thread, navigating to a chat surface, or refreshing the page renders prior messages immediately (no blank message-list window). Cache source: `streamsStore` bucket if populated; localStorage snapshot if bucket cold post-F5; empty state with skeleton only as last resort.
  2. `GET /threads/{id}/messages` reconciles in background without violating the Phase 067.5 Branch D-3 guard (`streamingThreadIdRef.current` buckets are never clobbered); existing Vitest regression test L-068-01 stays green.
  3. Assistant messages whose `runs.status` is `running` or `queued` (and whose terminal SSE has not yet replayed) render with a visible pulse / animated brand mark; transition to static state when terminal arrives.
  4. Fetch failures (network error, 5xx, timeout) surface an inline retry affordance over cached content rather than blanking the message list. Cached content remains visible during retry attempts.
  5. Chrome MCP UAT: cold-cache F5 → re-navigate to a thread with 38KB of messages → cached snapshot paints within 100ms of route-render; reconciled fresh data within 1s; no visible blank intermediate state.
  6. BUG-260513-01 status transitions `folded → closed` at milestone close after verify-work confirms 5/5 lived-experience UAT cycles green.

### Phase 069: `PdfExtractor` Abstraction Scaffold
**Goal**: Document ingestion flows through a `PdfExtractor` abstract base class so swapping extractors becomes a 1-line config change, with zero observable behavior change in this phase.
**Depends on**: Nothing (Wave 0)
**Plans**: 2
**Requirements**: (structural prep — directly verified by RAG-DOCLING-01 once Phase 071 lands)
**Success Criteria** (what must be TRUE):
  1. A new `backend/app/services/extraction_service.py` defines a `PdfExtractor` ABC with `extract(file_bytes) -> ExtractedDocument` contract; the current pypdf + python-docx + pdfplumber pipeline is rewrapped as the default implementation.
  2. `backend/app/api/documents.py` ingest path calls the abstraction (not the legacy direct imports); existing Phase 32.5 chunking + embedding pipeline reads the normalized `ExtractedDocument` without schema changes.
  3. `query_tables` tool (Phase 36) keeps working unchanged — `document_tables` schema is additive only.
  4. Q-v2.6-06 (PyMuPDF AGPL fallback license posture) is documented as a `D-PRD-07` appendix entry in `DECISIONS.md` before this phase ships.

### Phase 070: Docling httpx Spike
**Goal**: A chosen resolution path for the docling 2.x ↔ supabase 2.10 httpx pin conflict is locked in and verified in CI, so Phase 071 can ship Docling without dependency-hell risk.
**Depends on**: Phase 069
**Plans**: 2
**Requirements**: RAG-DOCLING-02 (CI gate enabled by spike outcome)
**Success Criteria** (what must be TRUE):
  1. Q-v2.6-01 is resolved: one of (a) supabase-py 2.10 → 2.29 upgrade with package renames absorbed, (b) docling pin-back to an httpx<0.28-compatible version, or (c) subprocess isolation is chosen and documented in PROJECT.md.
  2. `pytest backend/tests/integration/test_pdf_extractor_*.py` is green on the chosen resolution (CI integration test runs end-to-end against a fixture PDF).
  3. `requirements.txt` reflects the chosen pins; `EXTRACTOR_DOCLING_ISOLATION=subprocess|in-process` env var documented if (c) is chosen.
  4. Spike outcome is recorded in 070-SUMMARY.md with the matrix of options tried and the rejection rationale for unchosen paths (so future maintainers don't relitigate).

### Phase 071: Docling Primary Path
**Goal**: A user re-ingesting the reference PDF + DOCX pair under Docling produces comparable table + image counts (within 20% delta), and per-document re-extraction is opt-in via a documented admin route.
**Depends on**: Phase 070
**Plans**: 4
**Requirements**: RAG-DOCLING-01
**Success Criteria** (what must be TRUE):
  1. Re-ingesting the user's reference thesis PDF (`551f03f9-...`) under Docling primary path yields table + image counts within 20% of the same source's DOCX (closing the user-observed 5/4 vs 50+/0 inconsistency).
  2. `documents.extractor` column is populated for every newly-ingested document; existing rows backfilled to `'pypdf-legacy'` by the one-time migration pass. `document_images.bbox` and `document_tables.bbox + extractor` are populated by Docling output.
  3. Per-document fallback works: `EXTRACTOR_PRIMARY` env override OR `POST /documents/{id}/reextract` returns `202` and queues a single re-ingest task with PyMuPDF as the chosen engine, without flipping the global default.
  4. `pdf_extraction_runs` telemetry table records `engine`, `duration_ms`, `table_count`, `image_count`, `error` for every extraction run — visible per-document.
  5. Q-v2.6-04 (re-extraction migration policy: opt-in via `POST /documents/{id}/reextract`, NOT auto-run on deploy) is locked before this phase ships.

**Plans:** 4/4 plans complete
- [x] 071-01-PLAN.md — Schema + migrations 039-044 + telemetry plumbing + user_settings reader hookup (Wave 1; autonomous: false; DRY-RUN dedup gate before migration 045 apply)
- [x] 071-02-PLAN.md — DoclingExtractor adapter + dispatcher rewire + ExtractedDocument extension + pdf_extraction_runs telemetry writes + academic_synth fixtures + test_docling_extractor.py (Wave 2; depends on Plan 01)
- [x] 071-03-PLAN.md — PyMuPDF subprocess fence (backend/extractors/ child + parent wrapper + requirements.txt pin + test_pymupdf_fence.py AGPL invariant) (Wave 2; depends on Plan 01; parallel with Plan 02)
- [x] 071-04-PLAN.md — POST /reextract endpoint + D-v2.6-04 lock + backend/README.md + live SC#1 UAT on 551f03f9-... + 071-SUMMARY.md (Wave 3; depends on Plans 01+02+03; autonomous: false for live UAT)

### Phase 071.1: Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback (INSERTED, complete-partial 2026-05-15)

**Goal:** Close the three live-UAT defects from Phase 071 Plan 04's SC#1 binding-gate run against the user's thesis PDF + DOCX siblings. Specifically: (a) comprehensive `run_in_threadpool` sweep of `/reextract`'s remaining sync supabase-py + storage calls, (b) per-call Docling timeout enforcement + wall-clock Layer 2 fail-safe at the route, (c) PyMuPDF auto-fallback on Docling timeout only (narrow override of D-071-11). Plus three operator-tunable env knobs (`EXTRACTOR_DOCLING_TIMEOUT_S` / `_DISABLE_TABLE_STRUCTURE` / `_IMAGES_SCALE`). Then retry the SC#1 20%-delta gate on the thesis pair.
**Requirements**: RAG-DOCLING-01
**Depends on:** Phase 071
**Plans:** 2/2 complete (Plan 01 autonomous code fixes, Plan 02 live UAT close-out)

Plans:
- [x] 071.1-01-PLAN.md — Threadpool sweep + Layer 2 wall-clock timeout + PyMuPDF auto-fallback + 3 env knobs + 8 tests (autonomous, Wave 1) (completed 2026-05-15)
- [x] 071.1-02-PLAN.md — Live UAT close-out: friendly fixture (arXiv 2605.15184v1 CC-BY 4.0) + thesis SC#1 retry + fill 071-VERIFICATION.md AFTER counts + author 071.1-SUMMARY.md (autonomous:false, Wave 2) (completed 2026-05-15, accept-degraded disposition)

**Outcome:** Plan 01 fixes verified live — the 4-min Docling stall failure mode from Phase 071 is structurally ELIMINATED. Thesis PDF now completes in 125s (vs previously stalling indefinitely). Backend `/health` stays at 1-2s during in-flight extracts (vs frozen previously). The 20% binding-gate per D-071.1-06 stays RED at 89.7% / 100% — but the root cause has shifted from "Docling stalls" to "PDF and DOCX extraction quality differ structurally", which is NOT a Plan 01 regression. **Carry-forward:** Phase 071.2 (proposed) — PDF-side extraction quality (TableFormer A/B with DISABLE_TABLE_STRUCTURE=1, accounting reconciliation, SEED-006 promotion consideration). See 071-VERIFICATION.md and 071.1-SUMMARY.md for full close-out.

### Phase 071.2: Ingestion Plumbing + Per-Aspect Extraction Dispatcher (INSERTED 2026-05-15; SCOPE EXPANDED 2026-05-15)

**Goal**: Close the ingestion-path defects from Phase 072 discuss-phase setup AND land a per-aspect extraction dispatcher so every engine (text / tables / images / equations) is independently swappable via `app_settings` or per-call hint. The dispatcher decouples the project from any single library dominance and turns "legacy + enhancement and enrichment through other tools" from a wish into a runtime config choice. Specifically: (a) `/upload` + `/reingest` `run_in_threadpool` sweep + `/upload` instant-201 BackgroundTask refactor; (b) chunker reads Docling `full_markdown` (closes the 95%-chunks-drop); (c) `multimodal_service` reads `extracted_doc.tables/images` (closes the 4-vs-1 telemetry mismatch); (d) per-aspect dispatcher seam with new defaults (legacy text, ZIP-XPath DOCX images, PyMuPDF-full PDF images, Docling-TF tables, do_formula_enrichment equations) + `app_settings.extraction.*` (migration 045) + per-call hints on `/upload` and `/reextract`; (e) absorbs the DOCX `wp:anchor` floating-shape walk that was Phase 072's RAG-MM-LIFT-02.
**Depends on:** Phase 071.1
**Plans**: 5
**Requirements**: (operational gap-closure under RAG-DOCLING-01 + RAG-DOCLING-02 umbrellas; CLOSES Phase 072 RAG-MM-LIFT-02 via Plan 05; SC verification flows through 071-VERIFICATION.md SC#1 retest + new Docling-quality assertions + per-aspect dispatcher binding tests)
**Success Criteria** (what must be TRUE):
  1. `/upload` POST returns 201 within ~1s on any size PDF (1 MB or 4 MB thesis). Document row INSERTed with `status='pending'` BEFORE extract starts; storage upload + extract + chunking happen in a BackgroundTask. Existing dedup, version, folder-routing semantics unchanged.
  2. `/reingest` no longer blocks the async handler on `extractor.extract()` — same `run_in_threadpool` wrap as 071.1 applied to `/reextract`. Backend `/health` stays responsive (<2s) during in-flight extracts on either route.
  3. Frontend documents list shows the new row immediately on upload completion (via Supabase Realtime INSERT trigger on `documents` table) with the `processing` badge; transitions to `completed` when the BackgroundTask finishes — no manual page refresh required to see status.
  4. Thesis PDF re-ingested under the new per-aspect defaults produces: **tables ≥ 20 AND figures ≥ 10 AND chunks ≥ 200** (D-071.2-12 floor). Below this floor → escalate to Marker GPL-fenced opt-in engine (SEED-018 promoted to phase). Extended probe harness confirms predictions before commit.
  5. `pdf_extraction_runs.table_count` (foreground Docling) equals the count of `document_tables` rows for the same `(document_id, extractor)` pair on the thesis PDF re-extract. Root cause closed: `multimodal_service` reads `extracted_doc.tables/images` instead of running its own pdfplumber pass.
  6. `/reextract` returns 404 (not 500) on documents with `is_latest=False` (single-line fix per 071.1-CARRY-FORWARDS item #3).
  7. `extract_composable(raw, mime, engines={text, tables, images, docx_imgs, equations})` exists and routes each aspect through its independent registry. Default config matches D-071.2-02. `app_settings.extraction.*` columns (migration 045) override per-aspect engine choice. Per-call hint on `/upload` and `/reextract` overrides `app_settings`. Backward-compat shim preserves the legacy `get_extractor(engine=...)` API for existing callers.
  8. DOCX with pasted-in (floating-anchor) pictures returns ≥ 1 `document_images` row via the new `zip_xpath` DOCX image engine — closes the python-docx `inline_shapes`-only ceiling. Closes Phase 072 RAG-MM-LIFT-02 here.
  9. PDF with images inside Form XObjects returns more `document_images` rows under the new `pymupdf_full` engine than under `pdfplumber.page.images` on the thesis PDF.
  10. SEED-017 (PyMuPDF4LLM AGPL-fenced text engine) + SEED-018 (Marker GPL-fenced GPU-opt-in table engine) planted at phase close with concrete re-open triggers per D-071.2-15/16.

**Plans:**
5/5 plans complete
- [x] 071.2-02-PLAN.md — Frontend status-pulse + Realtime-driven `pending` → `processing` → `completed` badge UAT + optional `extracting_tables` / `extracting_images` ingestion_step labels (Wave 2; depends on 01) — code complete; Task 2 browser UAT parked in 071.2-HUMAN-UAT.md
- [x] 071.2-03-PLAN.md — Diagnose + close the 95%-chunks-drop: extend `probe_docling_timeout.py` harness to compare `text` vs `full_markdown` chunk counts + Docling pipeline-flag effects + per-aspect image/table counts; swap `docling.py:198` to `text = full_markdown or doc.export_to_text()`; enable `do_formula_enrichment=True`. (Wave 1)
- [x] 071.2-04-PLAN.md — Close the telemetry-vs-storage table-count mismatch: `multimodal_service.extract_and_store_tables/_images` accept `extracted_doc: ExtractedDocument | None` and use its data when present; legacy pdfplumber/python-docx path preserved for `None`. Includes `/reextract` `is_latest=False` 500 → 404 fix. (Wave 1)
- [x] 071.2-05-PLAN.md — Per-aspect extraction dispatcher: new `backend/app/services/extractors/aspects/` (text/tables/images_pdf/images_docx/equations registries + adapters); `extract_composable(raw, mime, engines)` composer; `multimodal_service` refactor to use composer; `app_settings.extraction.*` columns (migration 045); per-call hint plumbing on `/upload` + `/reextract`; backward-compat shim for legacy `get_extractor(engine=...)`. Includes new `zip_xpath` DOCX image engine (ports Docling `MsWordDocumentBackend:78-83` `.//a:blip` + `.//v:imagedata` walk — absorbs Phase 072 RAG-MM-LIFT-02) and `pymupdf_full` PDF image engine (invokes existing `pymupdf_isolated.py` subprocess). (Wave 1; ~700 LOC + migration 045) — code complete; D-071.2-12 floor UAT parked in 071.2-HUMAN-UAT.md; non-Docling engine evaluation deferred to SEED-019 (Phase 071.3)

**Notes:**
- This phase is BEFORE Phase 072 because 072's multimodal lift (raising `_MAX_VISION_CALLS` from 20 → 100) would compound the `/upload` latency problem if the foreground-extract bug stays.
- **Phase 072 narrows after this lands** to RAG-MM-LIFT-01 only (vision-LLM cap lift + empty-row persistence). RAG-MM-LIFT-02 (DOCX floating-shape walk) is absorbed here via Plan 05's `zip_xpath` engine.
- **Phase 076** (Confidence Recalibration) becomes data-dependent on this phase's per-aspect data — the new default engines produce a different chunk score distribution than legacy-only.
- Migration 043 adds `app_settings.extraction.*` columns. Apply via Supabase SQL editor (not `db push`), then regen full-schema.sql per project discipline.
- Sibling carry-forward: `load_dotenv()` fix was applied as hot-fix (commit `33860a7`, 2026-05-15) BEFORE this phase opened — pydantic-settings env-population gap. The hot-fix unblocked `EXTRACTOR_PRIMARY=legacy` revert.
- The per-aspect dispatcher framing supersedes the prior "Docling-primary" framing for this phase. `EXTRACTOR_PRIMARY` env var stays for backward-compat but `app_settings.extraction.*` wins when set.

### Phase 071.3: Docling Demotion — Table Engine + Full Rip

**Inserted:** 2026-05-16 (promotes SEED-019)
**Goal**: Replace the interim `pdfplumber` table default with a non-Docling engine that recovers borderless / layout-aligned academic tables (thesis floor: ≥ 15 tables vs current 4), then complete the Docling demotion by deleting the runtime dependency and reclaiming the install-pollution side-effects (httpx pin, PyMuPDF subprocess fence). Promotes SEED-019.
**Depends on:** Phase 071.2 (consumes the per-aspect dispatcher shipped in 071.2 Plan 05; reads `TABLE_ENGINES` registry as the integration point)
**Plans**: 5
**Requirements**: RAG-DOCLING-01 (re-asserted under non-Docling defaults — the original "non-Docling engines, investigate cheaper OSS first" rephrasing of the 5/4 vs 50+/0 baseline)
**Success Criteria** (what must be TRUE):
  1. Bench script in `backend/scripts/bench_table_engines.py` (throwaway-acceptable) runs PyMuPDF `find_tables(strategy="text")` + gmft (TATR) + Camelot 1.0 Stream against the user's reference thesis PDF and prints per-engine: tables found, wall time, peak RSS, install footprint. Output committed to `.planning/research/071.3-bench-results.md`. Winning engine documented with rationale.
  2. Winning engine wired into `backend/app/services/extractors/aspects/tables.py` as a new adapter; entry added to `TABLE_ENGINES` registry in `aspects/__init__.py`; lazy-imported per Pattern SP-4 (no FastAPI startup cost). Unit tests cover happy path + invalid-mime + empty-PDF on a small fixture.
  3. Migration 047 (`047_app_settings_table_engine_default.sql`) flips `extraction_table_engine_pdf` default to the winning engine (interim `pdfplumber` → winner). `user_settings.py` `UserEffectiveSettings.extraction_table_engine_pdf` default + `load_app_settings()` default updated to match. `supabase/full-schema.sql` regenerated.
  4. Docling rip: `docling>=2.93.0,<3.0.0` removed from `backend/requirements.txt`. `backend/app/services/extractors/docling.py` deleted. The 4 docling adapters (`docling_text`, `docling_tf_tables`, `docling_formula_equations`, `docling_pictures_pdf`) deleted from `aspects/`. The 3 EXTRACTOR_DOCLING_* env knobs (`_TIMEOUT_S`, `_DISABLE_TABLE_STRUCTURE`, `_IMAGES_SCALE`) deleted from `backend/app/config.py`. All references in tests + code cleaned up.
  5. httpx unpin: `httpx>=0.28.0,<0.29.0` in `backend/requirements.txt` relaxed (preferably to whatever `pymupdf` + `supabase==2.29.0` jointly tolerate). If PyMuPDF runs clean in-process post-unpin (verified via a temporary `import fitz` smoke test in `backend/tests/integration/test_pymupdf_in_process.py`), delete `backend/extractors/pymupdf_isolated.py` (child entrypoint), the parent wrapper at `backend/app/services/extractors/pymupdf.py`, and the AGPL fence test `backend/tests/integration/test_pymupdf_fence.py`. Update `pymupdf_full_images_pdf` adapter to use in-process `fitz` directly. AGPL fence note: PyMuPDF's AGPL still applies in-process — keep `requirements.txt` comment block; project license posture confirmed via D-PRD-07 (already permits AGPL in-process for this exact lib).
  6. Live UAT on the user's reference thesis PDF: `/upload` (or `/reextract`) returns; SQL on `document_tables` returns count ≥ 15 (camelot target — gmft was excluded at Plan 01 PICK time due to upstream transformers strict-dataclass break) OR ≥ 12 (PyMuPDF-only fallback target — unused at ship). `document_images` count reflects `pymupdf_full` as the engine of record (≥ 20 on thesis confirmed at ship — the prior 30-image baseline was Docling's image extractor, which was retired with the rip). Image recall lift to be addressed by SEED-021. Chunks ≥ 200. Recorded in `071.3-HUMAN-UAT.md`. **Rewritten 2026-05-16 at phase close** to match what was actually shipped after Plan 04 retired Docling: ship floor is tables-only; image floor is preservation-not-lift; SEED-021 carries the lift work.
  7. SEED-019 frontmatter status flipped from `planted` → `closed`. SEED-020 (embedding-model audit) planted with concrete re-open trigger per [[project-phase071-3-scope]] direction.

**Plans:** 5/5 plans complete

- [x] 071.3-01-PLAN.md — Bench 3 table engines on 2 fixtures (user thesis + friendly_real.pdf); user picks winner via WINNER.md sentinel. (Wave 1; autonomous: false) — **winner: camelot** (thesis 214 / friendly_real 15; gmft excluded — transformers strict-dataclass break)
- [x] 071.3-02-PLAN.md — Wire winner adapter into aspects/tables.py + TABLE_ENGINES registry + unit + integration tests. (Wave 2 — depends on Plan 01 WINNER.md sentinel; autonomous: true) — camelot adapter shipped, 11/11 tests pass
- [x] 071.3-03-PLAN.md — Migration 047 + supabase/full-schema.sql regen + user_settings.py defaults flip. (Wave 3 — depends on Plan 02; autonomous: false — Task 2 paste-in-SQL-editor is a checkpoint:human-action) — migration applied, constraint sealed to (camelot, pdfplumber), default flipped to camelot; verified live
- [x] 071.3-04-PLAN.md — Full Docling rip (8 phases A-H): delete adapters, source files, env knobs, EXTRACTOR_PRIMARY, drop docling from requirements, unpin httpx, conditional PyMuPDF in-process smoke + fence delete. (Wave 4 — depends on Plan 03; autonomous: true) — Docling fully purged; httpx unpinned (Phase F PASS); fence deleted, in-process PyMuPDF (Phase G PASS); no seeds needed
- [x] 071.3-05-PLAN.md — Live UAT on 3 fixtures (thesis + friendly_real + DOCX sibling); close SEED-019; plant SEED-020; conditional SEED-021 plant; PROJECT.md ADR + ROADMAP wording updates. (Wave 5 — depends on Plan 04; autonomous: false — live UAT requires user) — UAT green (thesis 214 tables / 20 images / 461 chunks; SC#6 ≥15 cleared 14.3x); SEED-019 closed; SEED-020 + SEED-021 (image-axis) planted; PROJECT.md D-v2.6-05 ADR added

**Notes:**
- This phase is BEFORE Phase 072 because Phase 072 re-extracts documents and would be tested under whichever table engine 071.3 ships. Doing 072 first would force a re-verification after 071.3. (Note: the original "≥80% of visible figures" target this phase was sequenced around has since been deferred from Phase 072 — see Phase 072 CONTEXT.md `<deferred>` ▸ vision_sweep / SEED-021. The sequencing rationale still holds for table-engine continuity.)
- **Phase 076** (Confidence Recalibration): rescopes to the new default engine's chunk distribution. Q-v2.6-03 "re-run vs reuse" answer flips to "re-run on new defaults" definitively.
- **Phase 082** (Cross-cutting Verification): SC#1 rephrased at 071.3 close from the Docling-era wording to "Validate final default-set output against baseline" (camelot tables + pymupdf_full images + legacy text + `none` equations).
- Sibling commit: `315f307` (2026-05-16) already flipped `app_settings` defaults for tables (`docling_tf` → `pdfplumber`) and equations (`docling_formula` → `none`) via migration 046. 071.3 supersedes the interim defaults.
- Per `feedback_preserve_engine_optionality`: the per-aspect dispatcher pattern stays — just different engines in the registries. Docling adapters get deleted because Docling is genuinely uninstalled, not because we're abandoning optionality.
- Per `feedback_dont_hedge_to_no_new_infra`: the "keep Docling as opt-in fallback" hedge was explicitly rejected at scope-lock; deleting Docling reclaims the httpx pin + subprocess fence (~150 LOC).
- Research brief: `.planning/research/071.3-table-engine-comparison.md` (2026-05-16, arXiv 2410.09871-backed). gmft expected winner; PyMuPDF text-strategy expected fallback.

### Phase 071.4: Post-071.3 Polish Bundle
**Inserted:** 2026-05-16 (post-071.3 session friction)
**Goal**: Resolve four issues observed during Phase 071.3 testing — camelot table precision overcount (5.5x inflation on PDFs), Library Health infinite-fetch loop, documents-list status-not-realtime + missing Reingest button, AND silent data corruption in `/reingest` (does not delete prior tables/images, causing accumulation on every click). Each is small in scope, but together they accumulate friction and pollute the surfaces Phase 072 will build on. **Plan 04 (the /reingest accumulation fix) is now major-severity data-integrity — added 2026-05-16 mid-phase when 071.4-01 verification surfaced the underlying bug.**
**Depends on**: Phase 071.3
**Plans**: 4
**Requirements**: none new — closes BUG-260516-01 + BUG-260516-02 + BUG-260516-03 + BUG-260516-04, and partial-mitigates SEED-022.
**Success Criteria** (what must be TRUE):
  1. Camelot precision mitigation: `aspects/tables.py::camelot_tables` rejects Table objects where `len(rows) < 2 OR len(cols) < 2` before yielding. **Verified 2026-05-16 with operator reingest: PDF 214 → 48 fresh post-floor count, a 4.4x reduction (much better than the predicted 80-120).** Floor effectiveness magnitude recorded in SEED-022 + Plan 04 SUMMARY for Phase 076 plan-phase reference.
  2. Library Health infinite-fetch loop fixed: `/knowledge-health/low-confidence/documents` no longer fires endlessly when the Library Health → Stale/Low-confidence page is open. UI no longer "shakes." Verified via Chrome MCP — single fetch on mount, additional fetches only on user-driven pagination.
  3. Documents-list realtime status + Reingest button: uploaded documents transition from `pending` → `processing` → `completed` without manual refresh / route change; per-row Reingest action button surfaced on the Documents page (was Library Health-only). Realtime fix implemented via either (a) properly-wired Supabase Realtime subscription with fetch-on-event reconcile per D-v2.5-03, or (b) polling shim. Decision logged in plan/SUMMARY.
  4. `/reingest` endpoint deletes prior `document_tables` + `document_images` rows before queueing the BackgroundTask, mirroring `/reextract`'s delete cascade at lines 803-811. Regression test asserts no accumulation across multiple reingests. Operator verification reingest on thesis confirms steady-state counts.

**Plans**:
- [x] 071.4-01-PLAN.md — Camelot precision quick mitigation (SEED-022 partial close): row/col floor in `aspects/tables.py` + unit test + re-run UAT count on thesis to confirm drop. (~30 min; autonomous: true) — code shipped (commits 46987c4 + 4931443); operator verification deferred to Plan 04 (which fixes the /reingest accumulation that was masking the result)
- [x] 071.4-02-PLAN.md — BUG-260516-02 fix: identify the unstable useEffect dep in the Library Health Low-Confidence hook, memoize or flatten to primitive deps, verify via Chrome MCP. (~30 min; autonomous: false — Chrome MCP verification)
- [x] 071.4-03-PLAN.md — BUG-260516-01 + BUG-260516-03 fixes: investigate documents-list Realtime (ship smallest viable fix — proper subscription OR polling shim) + add per-row Reingest action button to Documents page (was Library Health-only). (~45-60 min; autonomous: false — live upload + Chrome MCP verification)
- [x] 071.4-04-PLAN.md — BUG-260516-04 fix: add `document_tables` + `document_images` delete calls to `/reingest` mirroring `/reextract`'s cascade (4 LOC fix) + regression integration test + SQL cleanup + operator verification reingest. (~30-45 min; autonomous: false — SQL cleanup + verification reingest)

**Notes:**
- Per [[document-status-not-realtime-on-upload]] BUG-260516-01 + [[knowledge-health-low-confidence-infinite-fetch-loop]] BUG-260516-02 + [[SEED-022-camelot-pdf-table-precision-audit]] SEED-022.
- This is a polish phase, not a feature phase. Cross-AI review is not required; standard execute-phase flow is sufficient.
- SEED-022 stays planted after 071.4 ships — Plan 01 here is the row/col floor mitigation (drops magnitude of inflation), NOT the full precision audit (which Phase 076 inherits as a prerequisite).

### Phase 072: Multimodal Lift + DOCX Completeness
**Goal**: Close the `app_settings` dead-code seam for `multimodal_max_*` (migration 044 already shipped — wiring follows); persist empty-description rows so retry surfaces them cheaply; ship the DOCX location-aware completeness via the already-shipped `zip_xpath_docx` engine + content-hash dedup across BOTH PDF and DOCX paths; ship the `/reextract?retry_empty_descriptions_only=true` lazy-retry path. The ≥80% PDF figure-recall lift is OUT of Phase 072 scope (deferred to a SEED-021 spike — see Phase 072 CONTEXT.md `<deferred>`); default `pymupdf_full` baseline (~34% on thesis) is preserved.
**Depends on**: Phase 069
**Plans**: 5 (3 original 2026-05-16; +2 gap-closure 2026-05-17 — Plan 04 retry-helper dispatcher rewrite + Plan 05 orphan-chunks cleanup, both spawned from 072-VERIFICATION.md + BUG-260517-01)
**Requirements**: RAG-MM-LIFT-01, RAG-MM-LIFT-02
**Success Criteria** (what must be TRUE):
  1. `multimodal_service` reads `multimodal_max_vision_calls` + `multimodal_max_b64_bytes_kb` from `app_settings` (migration 044 already shipped); module constants `_MAX_VISION_CALLS` + `_MAX_B64_BYTES` deleted; new constant `MULTIMODAL_THUMBNAIL_MAX_EDGE = 1024` drives a PIL.thumbnail downscale before every vision-LLM call.
  2. Empty-vision-description rows persist with `description=''` instead of being dropped. `/reextract?retry_empty_descriptions_only=true` ships as the lazy retry path (D-072-04 Shape B): skips delete-cascade + re-extract; loops over empty rows and refills via describe_image.
  3. Content-hash dedup helper `_dedup_images_by_hash` invoked by BOTH DOCX (`zip_xpath_docx`) and PDF (`pymupdf_full_images_pdf`) image engines. DOCX images annotated with location label (`bbox.location` = header / footer / inline / floating); chunk-embedding prefix renders `[Image header]: ...`, `[Image floating]: ...`, etc.
  4. Live UAT on thesis PDF under default `pymupdf_full`: `total >= 20` images stored + `empty / total <= 0.10`. DOCX micro-UAT on a hand-crafted floating-shape document returns exactly 3 deduped rows with location prefixes. (The ≥80% recall target is deferred — see SEED-021.)

**Plans:**
5/5 plans complete
- [x] 072-02-PLAN.md — Content-hash dedup helper (PDF + DOCX) + DOCX location-prefix labels (Wave 2; autonomous) — SHIPPED
- [x] 072-03-PLAN.md — /reextract retry-empty-only branch + default-engine live UAT + DOCX micro-UAT (Wave 3; checkpoint:human-action for live UAT) — SHIPPED PARTIAL (endpoint contract green; refill effectiveness blocked by Gap 2 → Plan 04)
- [x] 072-04-PLAN.md — gap-closure: retry-helper dispatcher rewrite + non-mocked integration test (Wave 1; autonomous) — closes Gap 2 from 072-VERIFICATION.md
- [x] 072-05-PLAN.md — gap-closure: reingest chunks cascade-delete + orphan-free regression test (Wave 2; autonomous; depends on 072-04 — both touch documents.py) — closes BUG-260517-01

### Phase 073: asyncpg Pool Integration
**Goal**: The streaming endpoint's Postgres reads/writes go through an `asyncpg>=0.29` connection pool instead of sync `supabase-py` calls, CONCUR-01 stays green, and every completed run finalizes with `runs.input_tokens` + `runs.output_tokens` populated from the LLM `usage` field.
**Depends on**: Nothing (Wave 1; parallel with 068-072)
**Plans**: 4
**Requirements**: WORKER-LIFT-02, TOKEN-COL-01
**Success Criteria** (what must be TRUE):
  1. A new `_pg_pool` asyncpg singleton lives at `backend/app/dependencies.py:18-30`; `_drain_stream_with_close_on_cancel`'s persistence finalize path (`backend/app/api/threads.py:158-255`) calls asyncpg directly (not `aexec` wrapping sync supabase-py).
  2. The CONCUR-01 binding pytest gate at `backend/tests/integration/test_058_concurrency.py` stays green — cross-tab GET <1s benchmark preserved.
  3. `runs.input_tokens` and `runs.output_tokens` are populated for every completed LLM call from the response `usage` field — backend integration test asserts non-NULL on a happy-path run; NULL writes after this ship become a dashboard warning. No caps or enforcement introduced (pure observability).
  4. `aexec` helper at `backend/app/utils/db.py:32` is preserved for non-hot endpoints; both `_supabase` singleton and `_pg_pool` shut down via FastAPI lifespan.
  5. Q-v2.6-02 (multi-worker rollout: phased vs atomic) is locked to phased before this phase starts.

**Plans:**
4/4 plans complete
- [x] 073-01-PLAN.md — Pool plumbing: asyncpg install + env vars + get_pg_pool() singleton with JSONB codec + lifespan close + autouse fixture + mock factory + singleton/lifespan unit tests (Wave 0; autonomous)
- [x] 073-02-PLAN.md — Typed helper module backend/app/db/runs.py + AsyncMock-pool unit tests for insert_run / finalize_run / insert_assistant_message (Wave 1; autonomous; depends on 01)
- [x] 073-03-PLAN.md — Token accumulator wiring: openai_service stream_options=include_usage + anthropic_service usage event yields + 4 token-accumulator unit tests (Wave 1; autonomous; depends on 01)
- [x] 073-04-PLAN.md — Three hot-path flips in threads.py (runs INSERT / runs UPDATE finalize / messages INSERT) + real-Postgres binding gate test_073_concurrency.py (Wave 2; autonomous; depends on 01+02+03)

### Phase 074: SEED-009 + SEED-011 Polish Bundle
**Goal**: `claude-haiku-4-5-20251001` runs with `max_tokens > 64000` no longer 400 (clamped via registry), and the `test_059_disconnect.py` suite is 3/3 PASS without "Event loop is closed".
**Depends on**: Nothing (Wave 1)
**Plans**: 2
**Requirements**: POLISH-SEED-009-01, POLISH-SEED-011-01
**Success Criteria** (what must be TRUE):
  1. `MODEL_CAPABILITIES` registry gets a new `max_output_tokens: int` field populated for every currently-listed Anthropic + OpenAI + OpenRouter model; `anthropic_service.py:150-200` reads from registry before passing `max_tokens` to the SDK.
  2. A `_clamp_max_tokens(model, requested)` helper at `backend/app/services/anthropic_service.py` returns `min(requested, MODEL_CAPABILITIES[model]["max_output_tokens"])`; unit test covers the haiku-4.5 64K boundary.
  3. Live UAT: `claude-haiku-4-5-20251001` run with `max_tokens=65536` succeeds (was 400 BadRequestError; surfaced during Phase 067.5 cycle 5).
  4. `pytest backend/tests/integration/test_059_disconnect.py -q` is 3/3 PASS without `RuntimeError: Event loop is closed` — the `_reset_redis_singleton` autouse fixture pattern from `test_062_stream_replay.py:36-51` is pasted in.
**Plans:**
2/2 plans complete
- [x] 074-02-PLAN.md — SEED-011: hoist `_reset_redis_singleton` autouse fixture into new `backend/tests/integration/conftest.py` + delete 2 local copies + 4-file pytest ship gate (Wave 1; autonomous=true; parallel-able with Plan 01) [2026-05-18]

### Phase 075: SEED-008 + tool_args_progress Polish Bundle
**Goal**: Thread switch cold-cache latency drops ≥50% (snapshot endpoint), sandbox stdout streams line-by-line as it's captured, and non-execute_code tools emit `tool_args_progress` SSE for >5KB argument JSON.
**Depends on**: Nothing (Wave 1)
**Plans**: 3
**Requirements**: POLISH-SEED-008-01, POLISH-SEED-008-02, POLISH-TOOL-PROG-01
**Success Criteria** (what must be TRUE):
  1. New `GET /threads/{id}/snapshot` returns `{messages, active_runs, since_cursors}` in one round-trip; Chrome MCP timing run shows post-F5 thread switch cold-cache latency reduced ≥50% vs the 3-call sequential chain (`GET /messages` + `GET /active-runs` + `GET /stream?since=`).
  2. Sandbox `for i in range(5): print(i); time.sleep(1)` produces ≥3 distinct `code_stdout` SSE events across ≥1 second elapsed — backend integration test asserts monotonic `captured_at` timestamps.
  3. `tool_args_progress` SSE event fires for non-`execute_code` tools when argument JSON exceeds 5 KB during streaming; payload shape `{tool_index, args_so_far ≤5KB chunk, total_args_bytes_so_far}`. Integration test on `analyze_document` with a long-form prompt.
  4. Existing `code_executing` heartbeat (Phase 067.4 Plan 03) is preserved — `code_stdout` re-wire is additive.

**Plans:** 3 plans
- [ ] 075-01-PLAN.md — Snapshot endpoint full stack + BUG-260518-01 Resume-mid-stream fix (Wave 1; new `GET /threads/{id}/snapshot` + `_enrich_messages_with_runs` extraction + atomic-swap in StreamsProvider.reconcile + onTerminal reconcile-fetch on buffer_expired_* — D-075-01/02/03/04/13)
- [ ] 075-02-PLAN.md — Line-by-line code_stdout SSE rewire + BUG-260514-03 bottom-indicator fix (Wave 1, parallel-able; `session.execute_command("python -u", on_stdout, on_stderr)` replaces session.run + line-buffer accumulator + silent-window heartbeat + DELETE post-completion emit + sticky bottom-indicator text — D-075-05/06/07/08/14)
- [ ] 075-03-PLAN.md — tool_args_progress SSE primitive (Wave 1, parallel-able; OpenAI delta accumulator + Anthropic input_json_delta + execute_code + STRUCTURED filters + 5KB sliding-window tail; backend-only no frontend — D-075-09/10/11/12)

### Phase 075.1: Cross-Provider Streaming Stability + Observability Polish Bundle (INSERTED)

**Goal:** Close the 11 bugs catalogued in `075-CROSS-PROVIDER-UAT.md` (v4) — universal SSE-break (frontend stuck on "Running code" until F5), Anthropic content-block render failure mid-stream, snapshot 503 on empty threads, sub-agent silent downgrade with no UI surface, LangSmith Anthropic main-loop untraced + provider mislabel, OpenAI ModuleNotFoundError give-up, OpenRouter sandbox path inconsistency + Resume-button surfacing, stdout-in-red styling, ToolCallPanel duplication, output-files panel cumulative-repeat. 4-plan split locked: Plan 01 universal stream-end recovery (frontend), Plan 02 backend SSE transport stability (root cause: `harvest_output_files` blocking on async loop), Plan 03 Anthropic content-block rendering + sticky indicator, Plan 04 observability + sub-agent transparency + polish bundle.
**Requirements**: TBD
**Depends on:** Phase 075
**Plans:** 4/4 plans complete

Plans:
- [x] 075.1-01-PLAN.md — Plan 01 universal stream-end recovery (frontend; `_isTransientBufferExpired` widen + `/snapshot.active_runs` reconcile on terminal)
- [x] 075.1-02-PLAN.md — Plan 02 backend SSE transport stability (`harvest_output_files` → `run_in_threadpool` per D-v2.5-01; drain_step pure helper + post-completion safety-net emit; test skipif fix)
- [x] 075.1-03-PLAN.md — Plan 03 Anthropic content-block rendering + sticky indicator (StreamsProvider reducer fix for mixed text + tool_use ordering; MessageItem sticky-cache per-message runStatus)
- [x] 075.1-04-PLAN.md — Plan 04 observability + sub-agent transparency + polish (LangSmith Anthropic wrap + per-provider ls_provider/name tagging; sub-agent model logged + payload field + tool-card metadata + Settings UI override; system-prompt pip install + /sandbox/output hints; pre-install python-pptx/matplotlib/numpy/pandas in sandbox image; ToolCallPanel dedup; output-files delta view; code_stdout vs code_stderr styling audit; snapshot Redis-probe short-circuit on empty active_runs; delete stale loadMessages on ChatArea mount)

### Phase 075.2: ToolCallPanel Dedup + Final Outputs Download Link (INSERTED)

**Goal:** Close 2 frontend defects deferred from Phase 075.1 Chrome MCP UAT (2026-05-21) — (1) BUG-260521-01: ToolCallPanel transiently renders a duplicate card on the FIRST tool of a run (collapses to one on snapshot reconcile after ~10-15s; cross-provider — OpenAI gpt-4.1, Anthropic claude-sonnet-4-6 confirmed, OpenRouter inferred); end state correct but the transient window misleads the user. Root cause hypothesis: streaming-side reducer creates a fresh `running-${Date.now()}` id when `onToolStart` can't find a `preparing` entry, then snapshot reconcile merges to canonical `tool_call_id`. Fix at the streaming-state vs canonical-state mismatch in `StreamsProvider.tsx` `onToolPreparing` / `onToolStart` paths + dedup-key fallback hardening at `ToolCallPanel.tsx:538`. (2) BUG-260521-02: pinned "Final outputs" panel in `MessageItem.tsx:255-264` renders filenames as plain text — reuse the per-cell `<OutputFileCard>` from `ExecuteCodeBlock.tsx` to surface download + size badge + ghost-border + downloading spinner. Bonus pickup folded into same wave (same files): WR-01 (`onToolEnd` matches by name+status, should match by `tool_call_id`) + WR-02 (two-probe getSnapshot race in `_isTransientStreamEnd` / `_reattachAfterTransient`) from `075.1-REVIEW.md`. Out of scope: WR-03 (covered under dedup hardening), IN-01/02/04 (backend, orthogonal), BUG-260514-02 (deferred to v2.7 Agent Workspace).
**Requirements**: TBD
**Depends on:** Phase 075.1
**Plans:** 2/2 plans complete

Plans:
- [x] 075.2-01-PLAN.md — Plan 01 BUG-260521-01 reducer-quality pass (Wave 1; frontend; `StreamsProvider.tsx` WR-02 snapshot threading + `onToolStart` replay-idempotency + `onToolEnd` id-match per WR-01 + `ToolCallPanel.tsx:530-548` dedup-key idx tiebreaker per WR-03 — D-075.2-01/02/03/04) [shipped 2026-05-22, Chrome MCP cross-provider UAT PASS]
- [x] 075.2-02-PLAN.md — Plan 02 BUG-260521-02 Final Outputs download link (Wave 1; frontend; OutputFileCard extracted to shared module + reused in pinned Final Outputs panel — D-075.2-05/06/07) [shipped 2026-05-22, PARTIAL — presentation closes BUG-260521-02 visually, download blocked by backend data gap surfaced as BUG-260522-02]

### Phase 075.3: Defensive Chunk Handler + Unknown-Model Graceful Degradation (INSERTED)

**Goal:** Two-plan bundle covering (a) the OpenAI-compat chunk handler at `backend/app/api/threads.py:1806-1816` no longer drops content chunks when `chunk.usage` is populated + Path A revert + non-NULL Google token rows, AND (b) adding a new model via the Settings UI no longer silently breaks token accounting / tool routing / timeouts — unknown model_ids get pattern-based provider inference + safe defaults + a visible "unverified" badge.

**Origin:** Quick task `260522-gdg-google-15-iter-loop-diagnostic` (2026-05-22) shipped Path A hotfix `ee3b1f9` (gate `stream_options.include_usage` off for Google) — restored Gemini content delivery at the cost of NULL `runs.input_tokens` / `output_tokens` on Google runs. Plan 02 was added 2026-05-22 in pre-discuss strategic alignment: the same Google bug surface that triggered 075.3 also surfaces a structural gap — `get_model_capability` returns `{provider: "unknown"}` for any model_id not literally in `MODEL_CAPABILITIES`, which silently breaks the new defensive accumulator's provider branching AND ships wrong `max_output_tokens` / timeouts for any future model the user adds from Settings.

**Depends on:** Phase 073 (Phase 073-03 commit `be13baa` enabled `stream_options.include_usage` globally — the root cause Plan 01 fixes); quick-task 260522-gdg (the Path A gate Plan 01 reverts).

**Curation decision (2026-05-22):** Skip pre-075.3 MODEL_CAPABILITIES pruning. Cutting deprecated entries (`gpt-4o`, `gpt-5`, `o1`, `claude-sonnet-4-5`, `minimax/minimax-01`) BEFORE Plan 02 ships would silently break any user whose `user_settings.llm_model` points to one of them (`get_model_capability` returns `{provider: "unknown"}` until Plan 02 introduces the inference fallback). Curation belongs in Phase 081.1 once `model_capabilities_overrides` table + admin UI ship — at which point it becomes a 1-click admin action with an audit row instead of a code change. ONE registry add did land pre-075.3 (commit pending): `gemini-3.5-flash` added as a representative-class entry (caps mirrored from gemini-2.5-flash) since it's currently in active live use.

**Requirements:** TBD (decisions baked at /gsd:discuss-phase 075.3)

**Plans:** 2 plans (planned 2026-05-22 — 075.3-01-PLAN.md + 075.3-02-PLAN.md written)

**Success Criteria** (what must be TRUE):
  1. `_on_chunk_openai` at `threads.py:1806-1816` does NOT early-`return` after accumulating `chunk.usage` — content chunks that also carry `usage` flow through to `delta.content` processing.
  2. A provider-aware usage accumulator handles both shapes correctly: overwrite-last-wins for Google (per-chunk cumulative `usage`) vs `+=` accumulate for OpenAI/OpenRouter (final-chunk-only emission). The Google branch's accumulator strategy is locked at discuss-phase time via either Google compat-layer doc research OR a quick repro probe (delta vs cumulative).
  3. The Path A gate at `openai_service.py:886-893` is **reverted** — `stream_options.include_usage` is enabled for all providers again, including Google.
  4. `get_model_capability(unknown_id)` returns inferred provider + safe defaults instead of `{provider: "unknown"}`. Inference patterns: `gpt-*` / `o1`-`o9` → openai, `claude-*` → anthropic, `gemini-*` → google, `*/*` (slash-bearing) → openrouter, else → ollama. Safe defaults per inferred provider: conservative `max_output_tokens` (8192 for unknown OpenAI/Anthropic/Google, 4096 for unknown OpenRouter), `llm_call_timeout_seconds: 90`, `native_tools: True` for the big-3 providers (openai/anthropic/google), `False` for openrouter/ollama.
  5. When `get_model_capability` falls back to inferred-defaults (model not in `MODEL_CAPABILITIES`), backend logs a `model_capability_unknown` warning with the inferred provider + model_id, and frontend Settings UI surfaces an "unverified — using safe defaults" badge next to the model in the dropdown.
  6. Integration tests cover: (a) Google-spec mock chunk with both `usage` AND `content`, (b) OpenAI/OpenRouter-shape (final-chunk-only `usage`), (c) `get_model_capability("gemini-99-flash")` returns inferred-google with safe defaults + logs the warning.
  7. Chrome MCP UAT confirms green on all 5 Gemini models (`gemini-2.5-flash`, `gemini-2.5-pro`, plus 3 others from `MODEL_CAPABILITIES`) — content delivered correctly AND `runs.input_tokens` / `runs.output_tokens` populated non-NULL post-completion. PLUS one negative-test pass: add `gemini-99-flash` (intentionally unregistered) via Settings, send a "hi" prompt, confirm content streams + warning logs + UI badge appears.

Plans:
- [ ] 075.3-01-PLAN.md — Plan 01 defensive chunk handler + provider-aware accumulator (extract _accumulate_chunk_usage helper) + Path A revert at openai_service.py:886-893 + 6-Gemini Chrome MCP UAT + Wave 0 live probe locks Google cumulative-vs-delta shape
- [ ] 075.3-02-PLAN.md — Plan 02 unknown-model graceful degradation: pattern-based provider inference + safe-default fallback table in `get_model_capability` + `model_capability_unknown` warning log + frontend "unverified" Settings badge + negative-test UAT

**Carry-forward decisions (baked in from quick-task 260522-gdg + 2026-05-22 strategic alignment, do NOT re-litigate):**
- BUG-260522-01 (misleading "after 15 iterations" fallback message) routed to Phase 082.5 (Error Handler Foundation) — NOT bundled into 075.3.
- Native Google SDK split → SEED-028 (deferred to v3.1 alongside Provider key management UI) — NOT in 075.3 scope.
- DB-backed `model_capabilities_overrides` table + hot-reload cache + admin Settings UI for editing caps → Phase 081.1 (Settings Architecture Unification, already in v2.6 roadmap) — NOT in 075.3 scope.
- Provider `/models` endpoint probe + admin "verify & promote" workflow → v3.1 (Provider key management UI) — NOT in 075.3 scope.
- Diagnostic re-add (if needed during 075.3) — write fresh against the new code shape; do NOT reach for what was removed in quick-task 260522-gdg.

### Phase 075.4: Cross-Provider Cleanup + Per-Thread State + E2E Backstop (INSERTED)

**Goal:** Close the 6 open bugs (BUG-260523-01..04 + BUG-260522-02 + empty-response-fallback) as a coherent cleanup, eliminate the 5 cross-thread global state pollutions in `streamsStore.ts`, eliminate the 7 provider/model hardcoded sites that bypass the Phase 075.3 inference fallback, ship the streaming/agent-loop reliability fixes (terminal-status race, content-hash output dedup, sub-agent truncation warning, iteration-cap drop guard), land the perf + UX + safety wins (React.memo, useMemo, lazy recharts, sentinel guard against api_key clobber, Settings form-state fix), and install the smallest E2E test backstop (Playwright + frontend CI) that would have caught all 4 BUG-260523-* before they shipped. After this phase ships, Phases 076 → 082.5 proceed without insert-phases because the test backstop + the normative UAT recipe rule (cross-provider × multi-tool × parallel-thread × long-message) catches what phase-internal UATs have been missing.

**Origin:** Operator caught 4 cross-provider regressions during real-world testing after 075.3 closeout (2026-05-23). 4-axis audit (provider hardcoding + streaming reliability + perf + test coverage) surfaced 6 root-cause buckets spanning the filed bugs + 12 additional latent issues. Full evidence at `.planning/AUDIT-2026-05-23-cross-cutting-cleanup.md` (commit `1cecde5`); alignment-checked against remaining v2.6 phases (076..082.5) + v2.7+ outlook = 0 hard conflicts + 6 documentable forward-references. Plan-mode artifact at `~/.claude/plans/serialized-rolling-puppy.md`.

**Depends on:** Phase 075.3 (consumes the `get_model_capability()` registry-or-inference pattern from 075.3 Plan 02; Plan 02 of 075.4 extends that pattern to 6 other hardcoded sites).

**Requirements:** TBD (decisions baked at /gsd:discuss-phase 075.4; the headline new decision is D-075.4-NN: "unknown provider = explicit error, NOT silent ollama default").

**Plans:** 6/6 plans complete

**Success Criteria** (what must be TRUE):
  1. All 5 globals in `frontend/src/stores/streamsStore.ts` (`isStreaming`, `loadingThreadId`, `reconcileError`, `fallbackNotice`, `subscriptionsByRunId`) are promoted to per-thread keys with per-thread selectors. Cross-thread bleed-through eliminated. 067.5 empty-thread-until-refresh regression test added (Phase 082 inherits coverage).
  2. Gemini 3 / 3.5 / 3.1-pro-preview run multi-tool agent flows without 400 INVALID_ARGUMENT — `thought_signature` captured from Google chunks AND echoed on next round when `active_provider == "google"`. Unit test row + multi-tool integration test green.
  3. The 6 other hardcoded provider/model sites (config.py:447 `_PROVIDER_BASE_URLS`, openai_service.py:758-762 `_uses_max_completion_tokens`, context_window.py:106 tiktoken gate, threads.py:1679 Anthropic-native gate, openai_service.py:896 `_NO_PARALLEL_TOOL_CALLS`, threads.py:1106-1109 `_reconstruct_history`) use the Phase 075.3 Plan 02 registry-or-inference pattern. Unknown provider raises a clear startup error (D-075.4-NN); does NOT silently fall through to ollama.
  4. Streaming reliability fixes shipped: SSE `done` event fires AFTER `runs.status` UPDATE (terminal-status race closed); `_previous_files_in_run` keyed by content hash not filename (BUG-260523-03 dup outputs); sub-agent truncation warning surfaces when parent context drops user-intent; iteration-cap silent drop becomes a visible warning.
  5. BUG-260522-02 closed (final_output_files backend payload includes url + size, ~30 lines). empty-response-fallback-misleading-iter-count closed (adjacent to iteration-cap fix). Anthropic LangSmith `@traceable` verified producing traces (the 0-traces-in-agentic-rag-module2 gap observed 2026-05-23).
  6. Perf wins shipped: `React.memo(MessageItem)`, `useMemo` on `MarkdownRenderer` output, lazy `recharts` via `React.lazy` for Library Health, `SANDBOX_IMAGE` env var documented prominently, `stderr` badge next to red lines in `ExecuteCodeBlock`. Verified via React DevTools profiler on a 50-message thread during streaming (≥30% render-cost reduction target).
  7. Safety guards shipped: defensive sentinel guard in `backend/app/models/user_settings.py::save_override` rejects any api_key write matching `***` / `__KEEP__` / common sentinel patterns (closes WR-02 from 075.3 REVIEW, prevents the data-loss footgun the orchestrator hit during 075.3 UAT). Settings form-state "needs 2 clicks to save" bug fixed.
  8. E2E backstop shipped: Playwright + 6 scenarios that each map to a regression class (parallel composers / Gemini-3 multi-tool / OpenRouter single final output / SSE done→UI settled <500ms / unknown-model inference fallback / cross-provider iteration-count parity). Each scenario asserts a clean LangSmith trace. Teardown asserts no orphaned `runs.status='streaming'` rows.
  9. Dev-infra cleanup shipped: `scripts/restart-backend.ps1` + `scripts/restart-backend.sh` handle the Windows multiprocessing-spawn orphan-worker case (closes the phantom-port issue the orchestrator hit during 075.3 UAT); `/health` endpoint added or documented; new `.github/workflows/frontend-tests.yml` runs vitest + Playwright on PR; 44 pre-existing backend test failures triaged (delete-dead / fix-real / mock-drift).
  10. CLAUDE.md updated with normative UAT recipe rule: "Any phase touching streaming, agent loop, provider routing, or UI state MUST include UAT rows for cross-provider × multi-tool × parallel-thread × long-message scenarios."

Plans:
- [x] 075.4-01-PLAN.md — Per-thread state cleanup (frontend) — refactor 5 globals in streamsStore.ts to per-thread Maps/Sets; new per-thread selectors; update ChatArea/MessageList/MessageItem consumers; add 067.5 regression test — shipped 2026-05-23 (commits 16ba3ea / 18ee433 / 36fb727 / a7f2faf) — 5 globals → per-thread Map/Set; 4 new selectors (useStreamingForThread / useLoadingForThread / useReconcileErrorForThread / useFallbackNoticeForThread); BUG-260523-01 closed at ChatArea L:222 (per-thread composer disable); 067.5 Branch D-3 guard preserved VERBATIM; 14 new tests GREEN (285 + 328 lines across 2 test files); 8 pre-existing test failures (rooted in Phase 075 D-075-02 reconcile→getSnapshot swap, NOT this plan) DEFERRED to Plan 075.4-06 via D-075.4-01-DEFER-1.
- [x] 075.4-02-PLAN.md — Gemini 3 thought_signature + provider-agnostic hardcoding sweep (backend) — capture+echo thought_signature for google; apply Phase 075.3 Plan 02 registry-or-inference pattern to 6 hardcoded sites; explicit-error gate at _PROVIDER_BASE_URLS — shipped 2026-05-23 (commits 4ff13eb / 034552a / 1d13794) — UnknownProviderError(ValueError) raised at lifespan startup (D-075.4-B1/B2/B3); ModelCapability extended with uses_max_completion_tokens + supports_parallel_tools optional fields populated on 14 rows; 6-site sweep complete (sites 1+2+3+5 registry-driven, site 4 audit-only with comment, site 6 via persisted_tool_calls); Gemini-3 thought_signature 3-stage wiring (capture _on_chunk_openai → echo _reconstruct_history → persist messages.tool_calls jsonb) — closes BUG-260523-02; 30 new tests GREEN (148 + 190 + 353 lines across 3 test files); 0 075.1/tool_memory regressions.
- [x] 075.4-03-PLAN.md — Streaming + agent-loop reliability + remaining bugs (backend) — shipped 2026-05-23 (commits 7e727a6 / 2eab5bc / b4d21f1 / 85269e1 / d3e809f) — terminal-status race closed (T-075.4-04: inline _emit('done') removed + _shielded_finalize step 2/3 swap so finalize_run UPDATE precedes terminal sentinel); SHA-256 content-hash sandbox output dedup with supersedes detection (closes BUG-260523-03 + naturally closes BUG-260522-02 + auto-closes BUG-260521-02 via re_open_trigger); iteration-cap silent-drop guard + system_warning kind='iteration_cap_dropped_tool_calls' + structured log (T-075.4-05); sub-agent / iteration trim warning + system_warning kind='context_truncated' + persisted messages row (D-075.4-E1); BUG-260522-01 one-liner ({iteration + 1} iteration(s)); Anthropic LangSmith @traceable re-verified producing real spans; supabase/migrations/048_messages_allow_system_role.sql widens role CHECK constraint for D-075.4-E1 persistence path (operator action: apply via Supabase Studio); 18 new tests GREEN + 1 skipped clean across 7 test files; 51 cross-plan regression tests still GREEN.
- [x] 075.4-04-PLAN.md — Perf + UX + safety (frontend + small backend) — React.memo MessageItem, useMemo MarkdownRenderer, lazy recharts, SANDBOX_IMAGE docs, stderr badge, defensive sentinel guard in save_override (WR-02), Settings form-state 2-click fix, "supersedes previous" UI affordance for output dedup — shipped 2026-05-23 (commits e6aa38c / 11e5b6c / 315f5dd / 3104dcb / 11b7a0a / 56c033a) — flushSync wrap closes Settings 2-click; save_override sentinel allowlist (20/20 tests GREEN); React.memo + useMemo + lazy recharts (3 memo tests GREEN); OutputFileCard supersedes UI; backend/README.md sandbox docs; live Chrome MCP UAT for the Settings 2-click fix deferred to Plan 075.4-06 operator pass per DIAGNOSIS-settings-2click.md.
- [x] 075.4-05-PLAN.md — E2E backstop bootstrap (Wave 0, test infra substrate) — CLAUDE.md normative UAT recipe rule; Playwright config + 3 fixtures (auth env-driven, db-teardown localhost-gated, langsmith poller); restart-backend.{ps1,sh} scripts (Windows orphan-worker aware); /health endpoint; frontend-tests.yml CI workflow; backend/tests/conftest.py FK-aware runs factory; 7 bug-report frontmatter updates (5 folded + 1 deferred + 1 auto-close) — shipped 2026-05-23 (commits 902dce8 / b1f590c / 262688e / afb7cca / 1858067)
- [x] 075.4-06-PLAN.md — E2E backstop finalize (Wave 3, depends on 01-05) — shipped 2026-05-23 (commits defcba2 / ed01b78 / 9bb3c39) — 6 Playwright @075.4 scenarios mapping 1:1 to regression classes (scenario-01 BUG-260523-01 parallel composers, scenario-02 BUG-260523-02 Gemini-3 thought_signature, scenario-03 BUG-260523-03a OpenRouter exactly-one pptx, scenario-04 BUG-260523-03b done <500ms, scenario-05 unknown-model inference guard, scenario-06 BUG-260523-04 iteration-parity MEASUREMENT stays RED by design); 075.4-TEST-TRIAGE.md categorizing 98 backend failures (drift from stale 95 baseline — 3 tests added by Plans 075.4-01..05); FK-violation cluster closed (6 tests via AsyncMock-patches on app.api.threads.{insert_run,finalize_run,insert_assistant_message} — Rule-1 pragmatic over fk_aware_runs_factory since both files use placeholder SUPABASE_URL); post-Task-3 pytest re-count = 92 (98-6) confirmed; 92 remaining backend failures routed to Phase 076/077 per per-file owner column. Operator-led live UAT (Chrome MCP scenarios + UAT scoreboard fill + CI dry-run) deferred to Task 4 manual checkpoint.

**Forward-references (must be honored by downstream phases — captured in plan files):**
- → Phase 077/079 (multi-worker enable): Plan 02's `_WARNED_UNKNOWN_MODEL_IDS: set[str]` module-level dedup is single-worker-safe per D-v2.5-02; under `--workers N` becomes warn-once-per-worker (acceptable noise). Do NOT pre-emptively Redis-back it.
- → Phase 079: Plan 05's `restart-backend.ps1` assumes single worker; update path documented in script header for when 079 enables `--workers 2`.
- → Phase 081.1 (Settings Architecture Unification): Plan 04's sentinel guard in `save_override` is interim defense-in-depth; when 081.1 replaces save_override entirely, port the defensive logic forward.
- → Phase 081.1: Plan 04's "2-click save" fix lands now (small, prevents user pain); 081.1's rewrite must preserve the fix.
- → Phase 082 (cross-cutting verification): Plan 01's 067.5 regression test is inherited; Plan 05's Playwright infrastructure is the test substrate 082 rides on.
- → Phase 082.5 (Error Handler Foundation): Plan 03's user-visible warnings use lightweight inline pattern; 082.5 retrofits to unified error sink + trace_id. Do NOT pre-build a sophisticated error system in 075.4.

**Carry-forward decisions (baked at proposal time, do NOT re-litigate at discuss-phase):**
- BUG-260523-04 root cause fix (Anthropic 22-iter loop) — E2E scenario 6 in Plan 05 measures it; actual root-cause fix needs trace data Plan 03/05 unlocks. NOT in 075.4 scope — defer to focused phase after 075.4 ships.
- MIME fidelity in `import_skill` (known prior-milestone gap) — ingestion axis, NOT in 075.4 streaming/agent-loop scope.
- SEED-006 / 020 / 021 (extraction quality) — ingestion axis, NOT in 075.4.
- Full `settings_override.json` rewrite — Phase 081.1 owns it.
- Unified error sink + `trace_id` — Phase 082.5 owns it.
- Multi-worker enable — Phase 079 owns it.

### Phase 075.6: Live Streaming UX + Cross-Provider Parity (INSERTED)

**Goal:** Close the felt UX gap during long LLM code-generation pauses by surfacing the live code text inside a collapsible panel (replacing the byte counter from T-260523-09), and bring OpenAI + OpenRouter to parity with Anthropic + Google on the `tool_args_progress` SSE event so the new UX renders for ALL four providers uniformly.

**Origin:** Operator manual testing 2026-05-23 confirmed T-260523-09 byte-counter fix (commit `0a5a2db`) didn't solve the felt problem — the badge ticks 5→40 KB in ~830ms then vanishes, leaving 60-120s pauses silent again. Chrome-MCP-driven comparison with Claude.ai on 3 prompts (4 recordings, ~775s analyzed in `.planning/phases/075.5-gemini-native-sdk/claude-ai-comparison/COMPARISON.md`) identified the gold-standard pattern: live code streams into a scrollable panel during prep; step list collapses once 3+ steps accumulate; pinned "Working" badge persists. Backend already streams the raw `input_json_delta` chunks (we aggregate+discard); 80% of substrate (Phase 068 StreamsProvider, 068.5 pulse+cached render, 075 tool_args_progress) already shipped.

**Depends on:** Phase 075 (tool_args_progress backend event), Phase 075.1 (cross-provider streaming stability bundle — extends same pattern to 2 more providers).

**Requirements:** TBD (locked at `/gsd:spec-phase 075.6` per workflow; headline new decision will be D-075.6-NN: "additive `code_so_far` field on existing `tool_args_progress` event, NOT a new event type" — keeps backward-compat for consumers).

**Plans:** 3/0 plans complete
- [x] 075.6-PLAN-01-backend-cross-provider-emit.md — All 4 service adapter emits gain code_so_far + OpenAI execute_code skip removed + per-provider boundary state isolation (Wave 1; Reqs #1/#2/#3; backend-only).
- [x] 075.6-PLAN-02-frontend-live-panel-reducer.md — ToolArgsLivePanel component + argsCodeText reducer slice + onToolStart clear + 067.5 D-3 zero-call regression (Wave 2 parallel with 03; Reqs #4/#5).
- [x] 075.6-PLAN-03-frontend-ux-bundle.md — Narrow sub-agent gate drop + step-list collapse + WorkingBadge + provider-uniform audit + bug-report frontmatter updates (Wave 2 parallel with 02; Reqs #6/#7/#8/#9 + D-075.6-D1/D2).

**Success Criteria** (what must be TRUE — will be sharpened to falsifiable form at `/gsd:spec-phase 075.6`):
  1. Across all 4 providers (Anthropic + Google + OpenAI + OpenRouter), no pause longer than ~2 seconds during any `tool_preparing → tool_start` window for `execute_code` over the 5 KB cadence threshold has zero visible activity. The live code panel renders monotonically growing code text.
  2. OpenAI + OpenRouter emit `tool_args_progress` with the new `code_so_far` field at the same 5 KB cadence Anthropic + Google use today. Cross-provider parity check via Chrome MCP UAT on the same dissertation/gallery prompts.
  3. Frontend `<ToolArgsLivePanel>` collapses on `tool_start` (so the args object in `tc.args.code` becomes the source of truth post-start); no double-render of the same code.
  4. Sub-agent live text (`m.sub_agent.content`) renders for ALL sub-agent kinds, not only `analyze_document` (drops the narrow gate at `ToolCallPanel.tsx:694`).
  5. Step-list collapses when 3+ completed tool calls precede the active step; expand restores per-step view; iteration divider semantics unchanged.
  6. Pinned `✦ Working` badge renders at top of active assistant turn whenever `(activeTool || isPlanning) && !allDone`; vanishes on terminal.
  7. UAT covers the mandatory 4-axis bandwidth from CLAUDE.md: cross-provider × multi-tool × parallel-thread × long-message.
  8. Phase 067.5 Branch D-3 `clearMessages` guard at `useMessages.ts:572-590` (preserved verbatim through 068 + 068.5 + 075.4-01) survives 075.6 verbatim; Vitest regression test stays green.

**Forward-references (to be honored by downstream phases):**
- → Phase 082 (cross-cutting verification): 075.6's live-panel rendering pattern should be a reusable component for any future per-token signal (extended thinking summary, eval pane streaming, etc.).
- → Phase 082.5 (Error Handler Foundation): when a provider's `tool_args_progress` errors mid-stream, surface via the unified error sink (do NOT pre-build error UI in 075.6).
- → v2.7+ thinking-models phase: extended-thinking summary surface is a sibling pattern to ToolArgsLivePanel — same collapsible-during-streaming, persisted-after-done lifecycle.

**Carry-forward decisions (baked at proposal time, do NOT re-litigate at discuss-phase):**
- File output card polish (T-260523-10) — NOT in 075.6 scope; SEED into next polish bundle.
- Live PPTX preview pane (right-side page navigator like Claude.ai) — NOT in 075.6 scope; requires server-side PPTX-to-image conversion; defer.
- Extended-thinking summary collapsible block — NOT in 075.6 scope; only relevant once thinking models are wired in (claude-opus-4-7 Extended Thinking, gpt-5-thinking).
- T-260523-09 byte-counter (commit `0a5a2db`) stays as interim signal; once 075.6 ships, byte counter becomes redundant inside the live panel — close T-260523-09 with "superseded" disposition.
- Provider-specific UX branches — FORBIDDEN per `feedback-provider-uniform-ux` memory; if a provider's adapter can't emit the normalized event, the adapter is incomplete (not the UI's problem).

### Phase 075.7: Live-Execution UX Refactor (Run-Card + Tool-Call Panel) (INSERTED)

**Origin:** G-1 (Phase chain cap) + G-5 (Refactor between feature waves) both fire on the same hot files (`ToolCallPanel.tsx` — 5+ touches; `StreamsProvider.tsx` — 4+; `MessageItem.tsx` and `useMessages.ts` — 4+). G-2 satisfied 2026-05-24 by sketch session (commits `10ce3a3` / `f18df4c` / `7fbe609` / `2ea3d7e`) which packaged validated visual decisions into `Skill("sketch-findings-agentic-rag")` with two reference files (`live-run-container.md`, `tool-call-panel.md`). This phase IS the refactor G-1 has been demanding — apply the locked sketch findings to the production chat surface before the next feature wave touches these files.

**Goal:** Migrate the live-execution chat surface from its current ad-hoc rendering to the validated sketch design: bracketed Run-Card per assistant turn (sticky header with timer + counter + bot avatar, progress shimmer while active, fold-to-summary on completion), Editor-Inset tool-call panel with per-tool inner-body components (`execute_code` gets a real editor pane with gutter + syntax + STDOUT/STDERR labeled regions + file-output preview cards; `search_documents` gets ranked-result rows; `read_file` gets file metadata; outer frame is one component, inner body is selected by tool name), Focus Mode composition under long-run stress (past tool calls fold to result-summary `→ yoy_q3 = 30.87%`, only active step keeps full editor, explicit `Next: ...` footer).

**Requirements:** _TBD (likely new `LIVE-EXEC-UX-01` REQ-ID; spec-phase will surface the right binding gate)_

**Depends on:** Phase 075.6 (ships first — the `code_so_far` SSE field on `tool_args_progress` is upstream of the new Editor-Inset panel rendering). Optional pre-req: Phase 068 (StreamsProvider Context Lift) — state-management refactor that complements but doesn't block this visual layer; can ship in either order.

**Plans:** 3/3 plans complete

**Design contract:** [`Skill("sketch-findings-agentic-rag")`](../.claude/skills/sketch-findings-agentic-rag/SKILL.md) — auto-loads when any chat-surface component is edited per CLAUDE.md routing.

**Predicted files modified:**
- `frontend/src/components/chat/ToolCallPanel.tsx` (rewrite — G-5 hot file)
- `frontend/src/components/chat/MessageItem.tsx` (consumer of new RunCard)
- `frontend/src/hooks/useMessages.ts` (becomes reader-only over time)
- `frontend/src/providers/StreamsProvider.tsx` (consumer; no contract change unless 068 lands first)
- New: `frontend/src/components/chat/RunCard.tsx`
- New: `frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx`
- New: `frontend/src/components/chat/tool-bodies/SearchDocumentsBody.tsx`
- New: `frontend/src/components/chat/tool-bodies/ReadFileBody.tsx`

**Hot-file ledger update (post-merge):** flip G-5 status from "fires — refactor due" to "satisfied" on the four affected rows in CLAUDE.md.

**UAT bandwidth:** mandatory 4-axis coverage per CLAUDE.md SC#10 (cross-provider × multi-tool × parallel-thread × long-message). Chrome MCP drives all four against the 4 reference scenarios from the sketches.

Plans:
- [x] 075.7-01: Extract tool-bodies (ToolCallPanel 957→702 LOC; tool-bodies/ registry shipped 2026-05-24, commit `cd883ca`)
- [x] 075.7-02: RunCard wrapper (memoized bordered container + sticky header + brand-pulse avatar + 250ms timer + iteration counter + active-glow frame; mounted via single-hunk MessageItem swap 2026-05-24, commits `90aa0a5` + `0adc09e`)
- [x] 075.7-03: Focus Mode + 4-axis UAT (T1 `5199412` → {summary} render; T2 `ce07a57` RunCard auto-collapse + collapsed-row + click-to-expand; T3 `ffc77d5` 6 Playwright specs scenario-07..12 covering 3 of 4 UAT axes; T4 `db0b6f4` VALIDATION.md + long-message manual UAT auto-approved per AUTO_MODE; T5 [final commit] CLAUDE.md hot-file ledger 4 frontend rows flipped to satisfied — 2026-05-24)

### Phase 075.8: Live-Execution Visual Polish (INSERTED)

**Origin:** Sketches 001/002/003 (`Skill("sketch-findings-agentic-rag")` sources) enumerate 7 visual decisions that Phase 075.7 documented as BEST-EFFORT (not gated). Phase 075.7 UAT verified the architectural seams are correct (cross-thread, per-thread composer, Anthropic DOM order — all PASS 2026-05-24); the sketches still don't match visually. This phase closes that gap.

**Goal:** Close the 7 documented sketch-fidelity gaps left BEST-EFFORT after 075.7 — universal `<StatusPill>` component, active-tool glow + bottom progress shimmer, per-step result-summary on past tools (Focus Mode polish), `Next: ...` footer, compact 💭 thinking row, editor inset for `execute_code` (gutter + Shiki syntax + Python lang chip), labeled STDOUT/STDERR regions. Pure rendering polish on existing data flow.

**Requirements:** Inherits LIVE-EXEC-UX-01 binding gate from Phase 075.7 — extends the same UAT bandwidth (CLAUDE.md SC#10 4-axis).

**Depends on:** Phase 075.7 (consumes the RunCard wrapper + per-tool-body dispatch registry shipped in 075.7-01/02; this phase only touches rendering inside those seams).

**Plans:** 1/1 plans complete

**Design contract:** [`Skill("sketch-findings-agentic-rag")`](../.claude/skills/sketch-findings-agentic-rag/SKILL.md) — sketches ARE the spec; no SPEC.md / CONTEXT.md / RESEARCH.md authored.

**Predicted files modified:**
- `frontend/src/components/chat/StatusPill.tsx` (NEW, ~40 lines)
- `frontend/src/components/chat/RunCard.tsx` (Tasks 5+6 — Next-up footer + thinking row)
- `frontend/src/components/chat/ToolCallPanel.tsx` (Tasks 2+4 — pill sweep + per-step summary)
- `frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx` (Tasks 2+7 — pill swap + editor inset)
- `frontend/src/components/chat/tool-bodies/ShikiCode.tsx` (NEW, ~30 lines, only if Task 7 lands)
- `frontend/src/index.css` (Task 3 — glow class + bottom progress; possibly `dotBounce` keyframe)
- `frontend/package.json` (NEW dep: `shiki` if Task 7 lands)

Estimated effort: 3-4h focused single session. No new schema, no new API, no provider contract change, no architecture refactor.

**UAT bandwidth:** G-4 mandatory — Chrome MCP through 4 sketch reference scenarios (single tool fast, multi-tool Focus Mode, long-running with progress, cross-provider parity).

Plans:
- [x] 075.8-01: All 7 sketch-gap closures in one wave (7 tasks, parallelizable except Task 7 depends on syntax-library install) — shipped 2026-05-24

### Phase 075.9: Live-Execution Fidelity Handoff (INSERTED)

**Origin:** Two felt-experience defects surfaced during Phase 075.8 manual UAT (operator-observed in lived experience, not caught by orchestrator UAT — exactly the gap [[feedback_uat_lived_experience_gap]] flagged): (1) sub-agent cards (`analyze` and other sub-agents) visually duplicate mid-stream and only heal once the agent loop finishes; (2) `execute_code` shows the code block all-at-once after streaming completes rather than appearing line-by-line like Claude.ai. Both diagnosed to dual root causes — defect 1 shares the same root cause as WR-03 from 075.8 code review (`tc.id` typed optional and used as a stable key, fallback dedup key includes array index so preparing vs running positions don't coalesce); defect 2 is the architectural seam between `ToolArgsLivePanel` (preparing-only, plain text) and the Shiki inset (final-only, highlighted) — both render paths exist but the streaming view doesn't carry Shiki and the highlighted view doesn't show until tool_start.

**Goal:** Streaming → terminal handoff is seamless across the chat surface: tool identity stays stable across preparing/running/done so cards don't visually duplicate, and the `execute_code` editor view stays mounted with Shiki-highlighted code from the first streamed byte through completion (Claude.ai parity).

**Requirements:** Inherits LIVE-EXEC-UX-01 binding gate from Phase 075.7. Extends Phase 075.6's `code_so_far` SSE field consumption (frontend changes only; backend SSE vocabulary unchanged).

**Depends on:** Phase 075.8 (consumes the StatusPill + RunCard + Shiki inset + ToolArgsLivePanel architecture shipped/locked through 075.8).

**Plans:** 1 plan (single wave / 5 tasks)

**Design contract:** Sketches 002 D1 (already covers Shiki-inset rendering) + Claude.ai gold-standard live-stream reference. No new sketch/spec/research/context ceremony — root causes are diagnosed, no design ambiguity.

**Guardrail overrides:** G-1 phase chain cap (075.x cascade now at 9 phases on ToolCallPanel/ExecuteCodeBody hot files) — operator-authorized continuation 2026-05-24 to bundle felt defects + advisory warnings in one atomic phase rather than fragmenting across milestones. Audit trail in PLAN.md frontmatter.

**Predicted files modified:**
- `frontend/src/lib/toolKey.ts` (NEW, ~25 lines — stable client-side tool key util)
- `frontend/src/lib/__tests__/toolKey.test.ts` (NEW, ~30 lines)
- `frontend/src/providers/StreamsProvider.tsx` (stamp `clientKey` at first observation)
- `frontend/src/types/index.ts` (extend `ToolCall` with `clientKey?: string`)
- `frontend/src/components/chat/ToolCallPanel.tsx` (migrate `tc.id`-keyed surfaces to `clientKey` + gate ToolArgsLivePanel body for `execute_code`)
- `frontend/src/components/chat/ToolArgsLivePanel.tsx` (`hideBody` prop OR children slot for execute_code)
- `frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx` (argsCodeText fallback chain in Shiki inset)
- `frontend/src/components/chat/tool-bodies/ShikiCode.tsx` (streaming prop with `useDeferredValue` throttle + singleton reset on rejection + JSDoc trust contract)
- `frontend/src/__tests__/providers/streamsProvider_075_9_clientkey.test.tsx` (NEW)
- `frontend/src/components/chat/ShikiCode.test.tsx` (NEW)

Estimated effort: 3-4h focused single session. No new schema, no new API, no provider contract change.

**UAT bandwidth:** G-4 mandatory — Chrome MCP through 4 felt-experience scenarios (sub-agent dedup mid-stream / live code stream byte-by-byte / long code stream throttle smoothness / Shiki failure recovery via singleton reset).

Plans:
- [x] 075.9-01: stable clientKey + live Shiki streaming + WR-01/02 (5 tasks, sequential chain T1→T2→T3→T4→T5) — shipped 2026-05-24 + hot-fix `443b4be` for ExecuteCodeBody mount-during-preparing seamless handoff. HUMAN-UAT: scenario 1 (sub-agent dedup) PASS verified via SSE intercept on gpt-5.4; scenarios 2-3 (live code stream) BLOCKED-BY-BACKEND — frontend wiring correct, but `tool_args_progress` SSE events don't fire fine-grained enough (anthropic_service.py:254 + google_service.py:482 hardcode 5120-byte boundary; openai_service.py never emits at all). Routed to Phase 075.10. Scenario 4 (Shiki failure recovery via WR-01) PASS verified via vitest.

### Phase 075.10: Fine-Grained tool_args_progress Emission (INSERTED)

**Origin:** Phase 075.9 HUMAN-UAT diagnosed via Chrome MCP + SSE intercept (patched fetch in browser console). gpt-5.4 + claude-opus-4-6 + gemini-2.5-flash all emit ZERO `tool_args_progress` events for typical code (<5 KB). Root causes: (a) `anthropic_service.py:254` and `google_service.py:482` hardcode a 5120-byte cumulative-boundary emit cadence, so any code under 5 KB crosses zero boundaries; (b) `openai_service.py` has the entire emission block missing — never emits `tool_args_progress` at all even though it accumulates tool_call argument deltas internally. Frontend (Phase 075.9) is correctly wired but receives no chunks to render mid-stream.

**Goal:** Close the SSE wire-format gap so `tc.argsCodeText` actually populates during args generation on all 4 providers. After this phase the `ExecuteCodeBody` Shiki inset (already mounted during preparing per 075.9 + hot-fix `443b4be`) shows visible character-by-character code rendering through the args-generation window on every provider — matching Claude.ai's live-code experience.

**Requirements:** Inherits LIVE-EXEC-UX-01 binding gate. Extends 075.6 `code_so_far` SSE field contract — same protocol, finer cadence + OpenAI/OpenRouter parity.

**Depends on:** Phase 075.9 (frontend wiring + hot-fix); Phase 075.6 (SSE wire-format origin).

**Plans:** 1/1 plans complete

**Design contract:** `google_service.py:367-490` is the canonical 5KB-boundary emitter — verbatim-cloneable to the other 2 services with only the OpenAI shape adapter. Claude.ai live-code reference is the visible-streaming target.

**Guardrail overrides:** G-1 phase chain cap (075.x cascade now at 10 phases on streaming/agent-loop surface) + G-5 refactor cadence on backend provider services (9+ touches each) — operator-authorized 2026-05-24 to close the SSE-completeness work that has accreted incrementally since 075.6.

**Predicted files modified:**
- `supabase/migrations/049_tool_args_progress_boundary.sql` (NEW, ~10 lines — `chat_tool_args_progress_emit_boundary_bytes INT DEFAULT 256`)
- `supabase/full-schema.sql` (auto-regenerated)
- `backend/app/dependencies.py` or settings helper module (~15 LOC — `_read_setting_int` helper, may already exist)
- `backend/app/services/anthropic_service.py` (~10 LOC — read boundary from settings + widen tail slice)
- `backend/app/services/google_service.py` (~10 LOC — mirror of anthropic edit)
- `backend/app/services/openai_service.py` (~40 LOC — port emission block from google_service.py, adapt to OpenAI tool_calls[].function.arguments deltas; ensure tool_preparing fires too)

Estimated effort: 2h focused single session. No new architecture, no provider contract change.

**UAT bandwidth:** G-4 mandatory — SSE intercept on each of 4 providers (≥3 `tool_args_progress` events for a 1 KB code body) + Chrome MCP eyeball-vs-Claude.ai parity check.

Plans:
- [x] 075.10-01: backend tool_args_progress fine-grained emission across 4 providers (5 tasks, sequential T1→T5)

### Phase 075.11: Agent Timeout 3-Layer Audit + Unification (INSERTED)

**Origin:** Operator observed claude-opus-4-6 hit an unexplained ~900s wall during a multi-tool dissertation task on 2026-05-24. Public-benchmark sweep shows the major chat apps treat this as 3 layers in tension, not 1 knob: Claude.ai ~30 min extended / ~5 min normal; ChatGPT ~10 min o3 / ~2 min 4o; Cursor 5-30 min configurable. Our codebase has the layers — `config.py:get_per_call_timeout()` (L1), `threads.py:1448 max_iterations` (L2 — iteration-cap only, no wall-clock), sse-starlette `ping=` somewhere (L3) — but they're scattered, unrecorded, and the operator-observed 900s site is not yet pinpointed.

**Goal:** After this phase, the 3 timeout layers are unified under `app_settings` with operator-tunable tier presets matching public benchmarks. The 900s silent cut doesn't reproduce. Settings UI exposes `agent_loop_max_seconds` (default 1200 = 20 min, matching Claude.ai median × 2.5). System_warning fires on wall-clock overflow (reload-survivable per Phase 075.4 pattern), so the user sees "run capped at 20 min" instead of an indefinite "Synthesizing answer…" hang.

**Requirements:** Closes operator-observed "900s silent cut" + makes timeout discipline self-documenting. No new functional contract — unifies existing.

**Depends on:** Phase 075.10 (already adds the `_read_setting_int` helper + migration pattern that 075.11 reuses).

**Plans:** 0/1 plans complete

**Design contract:** Claude.ai (~30 min extended thinking, ~5 min normal) + ChatGPT (~10 min o3, ~2 min 4o) + Cursor (5-30 min configurable) + Aider (10 min) wall-clock benchmarks. Phase 075.4 system_warning pattern (reload-survivable inline events) for the overflow surface.

**Guardrail overrides:** G-1 phase chain cap (075.x cascade at 11 phases on streaming/agent-loop surface) + G-5 refactor cadence on `threads.py` (9+ touches, longest hot file) — operator-authorized 2026-05-24 to close the timeout-completeness work that the 075.x cascade incrementally exposed (075.4 iteration-cap silent-drop + 075.6 SSE keepalive race + 075.10 SSE wire-format).

**Predicted files modified:**
- `supabase/migrations/050_agent_timeout_unification.sql` (NEW, ~10 lines — `agent_loop_max_seconds INT DEFAULT 1200` + `sse_keepalive_ping_seconds INT DEFAULT 60`)
- `supabase/full-schema.sql` (auto-regenerated)
- `backend/app/api/threads.py` (Task 3 — `asyncio.timeout(agent_loop_max_seconds)` wrap around the iteration loop + `system_warning` overflow event)
- `backend/app/api/runs.py` (Task 4 — SSE `ping=` from settings; exact site confirmed by Task 1 audit)
- `frontend/src/pages/SettingsPage.tsx` + `frontend/src/lib/api.ts` (Task 5 — Settings → Advanced → Agent timeouts section with tier preset dropdown)
- `.planning/phases/075.11-agent-timeout-3-layer-audit/075.11-AUDIT.md` (NEW, ~40 lines — Task 1 deliverable: file:line for each timeout site + current value + overflow behavior + recommendation)

Estimated effort: 2-3h focused single session.

**UAT bandwidth:** G-4 mandatory — Chrome MCP through 4 scenarios: (1) Default profile baseline run; (2) Operator-observed 900s reproduction with NEW ceiling; (3) `agent_loop_max_seconds=30` smoke test (60s sleep tool terminates at ~30s with system_warning); (4) Cross-provider parity at fixed ceiling.

Plans:
- [ ] 075.11-01: 3-layer timeout audit + unification under app_settings (5 tasks, sequential T1 audit → T2 migration → T3 loop wrap → T4 SSE ping → T5 Settings UI)

### Phase 076: Confidence Recalibration
**Goal**: Confidence thresholds match the chunk score distribution under the post-071.3 default-set (camelot tables + pymupdf_full images + legacy text + `none` equations), so `messages.confidence_*` reads stay accurate after the extractor swap.
**Depends on**: Phase 071.3
**Plans**: 2
**Requirements**: RAG-RECAL-01
**Success Criteria** (what must be TRUE):
  1. Q-v2.6-03 LOCKED at 071.3 close: re-run full Phase 32.5 calibration over post-071.3 default-set extracted historical corpus (the "reuse" option is rejected — the new chunk distribution differs materially from the Docling-era distribution).
  2. New thresholds for `_compute_confidence` at `backend/app/api/threads.py:133-139` are derived from the new score distribution; PROJECT.md gets a "Confidence calibration v2 (post-071.3 default-set)" appendix entry with before/after histograms.
  3. Existing `messages.confidence_*` schema (per `D-v2.5-12`) is unchanged — column reads/writes preserve the v2.5 contract; only threshold constants change.
  4. The `pdf_extraction_runs` telemetry makes the per-extractor lineage observable (camelot vs pdfplumber vs future engines) so this calibration is re-litigable if the default-set output drifts.

**Plans:**
2/2 plans complete
- [x] 076-02-PLAN.md — Apply threshold decision + PROJECT.md appendix + test update + schema verification + operator approval (Wave 2; depends on Plan 01; autonomous: false) — shipped 2026-05-25: ADJUST path taken (0.55/0.40 -> 0.54/0.38), N=121 queries, 30.6%/45.5%/24.0% bucket balance

### Phase 076.1: Provider Integration + UX Status Fidelity (INSERTED 2026-05-25)

**Goal:** Two-scope phase absorbing ALL findings from the 6-provider cross-provider monitoring session. **UX scope:** Make the agent run always feel alive — surface the already-streaming `argsCodeText` code preview where the user is looking (not hidden above the viewport), differentiate "generating code" from "executing code" states, surface failure reasons on failed runs, and deduplicate repeated narration text. Competitive UX research confirms streaming text IS the progress indicator. **Provider scope:** Add 4 direct OpenAI-compatible provider integrations (DeepSeek, Kimi/Moonshot, MiniMax, GLM/Zhipu) reusing `openai_service.py` with per-provider base URLs and API keys; keep OpenRouter as generic fallback for unregistered models; set per-provider sub-agent model defaults and timeout profiles. Absorbs SEED-031.
**Depends on**: Phase 075.10 (fine-grained `tool_args_progress` emission — already shipped)
**Requirements**: UX-STATUS-01 (status fidelity), SEED-030 (streaming silence gap), SEED-031 (direct provider integrations)
**Evidence**: `.planning/reports/SESSION-20260525-ux-status-fidelity-findings.md` (master), `.planning/notes/competitive-ux-long-code-generation.md` (research), 6 per-provider monitoring reports in `.planning/reports/SESSION-20260525-*.md`
**Critical constraint (UX)**: Do NOT add new SSE events or UI elements — reverted commit `0dce56a` proved this causes React re-renders + text/code leakage. Better utilize EXISTING signals (`tool_args_progress`, `argsCodeText`, `tool_preparing`).
**Success Criteria** (what must be TRUE):

  _UX Status Fidelity:_
  1. During `execute_code` tool arg generation (TTFT gap), the user sees streaming code in the viewport — not "Thinking..." with a static byte counter. The `ExecuteCodeEditorInset` (already wired at ToolCallPanel.tsx:717-719) must be visible by auto-scrolling to the active tool panel when `tool_preparing` fires.
  2. The status label accurately reflects backend state: "Generating code" during `preparing`, "Executing code" during `running`, not "RUNNING" for both. "queued" replaced with elapsed timer or active spinner when delta events are arriving.
  3. Failed runs surface an error category in the UI — timeout, code error, truncation, or model limit — not just "failed" with zero explanation. Backend run error reason piped to frontend via existing `runs` schema.
  4. Consecutive identical text blocks from the same assistant turn are deduplicated (Anthropic 4x / DeepSeek 4x narration pattern). Backend or frontend normalization — single occurrence rendered.
  5. Google's atomic tool args (no progressive streaming) handled honestly: "Waiting for model..." with visible elapsed counter, not pretending to be "queued" or showing an empty code panel.
  6. Sticky elapsed timer visible during active runs regardless of scroll position (P0).
  7. Running file count visible during multi-batch runs (Sonnet 4-batch pattern).
  8. No new SSE event types added. No new fields on existing SSE events for UX scope.

  _Provider Architecture:_
  9. 4 direct provider integrations added: DeepSeek (`api.deepseek.com`), Kimi/Moonshot (`api.moonshot.cn`), MiniMax (`api.minimax.chat`), GLM/Zhipu (`open.bigmodel.cn`) — each with own `MODEL_CAPABILITIES` entries, `provider` field, env var API keys (`DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`, `MINIMAX_API_KEY`, `ZHIPU_API_KEY`), and `base_url` routing through `openai_service.py`.
  10. OpenRouter kept as generic fallback for any model not directly integrated. Model ID routing: if `MODEL_CAPABILITIES[model].provider` matches a direct provider, route direct; else route OpenRouter.
  11. Per-provider sub-agent model defaults set (e.g., `deepseek-chat` for DeepSeek sub-agents, `moonshot-v1-8k` for Kimi) so sub-agents don't fall back to the main model (DeepSeek monitoring: 893K tokens because sub-agent used deepseek-v4-pro).
  12. Per-provider timeout profiles in `MODEL_CAPABILITIES` — DeepSeek/Kimi get longer defaults (observed 24min/17min runs).

  _Cross-cutting:_
  13. Chrome MCP UAT across the DBA PPTX generation task on at least 3 providers (OpenAI + Anthropic + one direct-integrated provider): at no point during the run does the visible screen stay unchanged for >10s (liveness), status labels match backend state (accuracy), and failure reasons surface on failed runs.

**Plans:** 4 plans

Plans:
- [ ] 076.1-01-PLAN.md - Backend provider config (4 providers in config.py + user_settings.py + .env.example)
- [ ] 076.1-02-PLAN.md - Settings UI provider entries (PROVIDER_META + OpenRouter relabel)
- [ ] 076.1-03-PLAN.md - UX status fidelity Part 1 (auto-scroll + status labels + sticky timer + Google atomic)
- [ ] 076.1-04-PLAN.md - UX status fidelity Part 2 (failure reason + text dedup + file count + UAT)

### Phase 076.2: Provider Streaming Parity + Full Integration
**Inserted:** 2026-05-26
**Goal**: Close all streaming/integration gaps from 076.1 live testing across 4 curated providers. Ship DeepSeek thinking mode (reasoning_content round-trip). Fix Google Skills registration bug (BUG-260524-01). Verify per-provider model resolution for sub-agent/title/suggestions via UAT. Document provider-side limitations.
**Depends on**: Phase 076.1
**Plans**: 4
**Requirements**: (inserted phase -- scope from CONTEXT.md D-01 through D-12)
**Success Criteria** (what must be TRUE):
  1. DeepSeek V4 thinking mode enabled (reasoning_effort="high"); multi-tool runs complete without 400 error (reasoning_content round-trip works in agent loop).
  2. reasoning_content displays in a collapsible Thinking block in RunCard (collapsed by default, expandable).
  3. reasoning_delta SSE events stream during DeepSeek thinking; GET /messages returns reasoning_content on assistant messages.
  4. BUG-260524-01 resolved: Google Skills tool registration investigated with debug logging; fix applied or behavioral finding documented.
  5. SEED-032 absorbed: Gap 1 (in-memory round-trip) closed; Gap 2 (real-time UI reflection) investigated and documented.
  6. Cross-provider UAT with D-12 4-axis bandwidth: DeepSeek deep + Kimi/MiniMax/GLM smoke + title/suggestions/skills per provider.

**Plans:** 4 plans
Plans:
- [x] 076.2-01-PLAN.md -- Backend: DeepSeek thinking enable + reasoning_content round-trip + SSE emit + API exposure + unit tests (Wave 1; autonomous)
- [x] 076.2-02-PLAN.md -- Frontend: reasoning_content wiring (types + api.ts + StreamsProvider) + RunCard collapsible Thinking block (Wave 2; depends on 01; autonomous)
- [x] 076.2-03-PLAN.md -- Google Skills investigation + fix (BUG-260524-01) + debug logging (Wave 2; depends on 01; autonomous)
- [x] 076.2-04-PLAN.md -- Cross-provider live UAT with 4-axis bandwidth + VALIDATION.md scoreboard (Wave 3; depends on 01+02+03; autonomous=false)

### Phase 077: Multi-Worker Validation Harness
**Goal**: Under `--workers 2` and a 50-parallel-run synthetic load, run-tracking survives cross-worker cancel, sandbox sessions stay sticky to the originating worker via consistent hashing on `thread_id`, and the per-worker Redis singleton initializes without cross-talk.
**Depends on**: Phase 073
**Plans**: 3
**Requirements**: WORKER-LIFT-01 (validated here; final lighting up in Phase 079)
**Success Criteria** (what must be TRUE):
  1. A 50-parallel-run synthetic load harness runs against `--workers 2`; CONCUR-01 binding gate stays green; no cross-worker state corruption observed across run lifecycles.
  2. A run started in Worker 1 is cancellable from Worker 2 via the existing Redis zombie-heal path (`backend/app/api/runs.py:421` SETNX cancel-lock → Postgres UPDATE → terminal sentinel propagates to all consumers). Two-tab live test confirms cancel-from-other-tab works under multi-worker.
  3. Sandbox sessions become worker-sticky via consistent hashing on `thread_id`; a re-attached SSE consumer always lands on the same worker that owns the sandbox session for that thread.
  4. Redis singleton initializes per-worker (idempotent); telemetry assertion: `redis.zcard("runs:active")` shows the union across workers, not duplicates.

Plans:
- [x] 077-01-PLAN.md — Mock LLM infrastructure + sandbox re-attach production code (Wave 1; autonomous) — shipped 2026-05-27
- [x] 077-02-PLAN.md — 50-run load harness + CONCUR-01 multi-worker gate + singleton validation (Wave 2; depends on 01; autonomous) — shipped 2026-05-27
- [x] 077-03-PLAN.md — Cross-worker cancel verification + sandbox re-attach test (Wave 2; depends on 01; autonomous) — shipped 2026-05-27

### Phase 078: Backpressure JSON Primitive + Code-Quality Bundle
**Goal**: `GET /admin/backpressure` exposes the four bottleneck signals as JSON for the v3.1 dashboard, Supabase singleton shuts down cleanly on lifespan close, protected-only context overrun fails loud (or trims), concurrent-upload races produce exactly one row, and title-gen failures log a warning.
**Depends on**: Phase 073
**Plans**: 3
**Requirements**: WORKER-LIFT-04, CQ-SUPA-01, CQ-CTX-01, CQ-DEDUP-01, CQ-TITLE-01
**Success Criteria** (what must be TRUE):
  1. `GET /admin/backpressure` returns `{anyio_threadpool_depth, redis_active_runs, postgres_pool_in_use, per_worker_run_count}` as documented JSON; gated on `BACKPRESSURE_ADMIN_USER_IDS` env-var allow-list (fail-closed if `ENVIRONMENT=production` and the var is empty); integration test asserts shape + auth.
  2. `await _supabase.aclose()` runs as final step in FastAPI lifespan close-out (after `RUN_TASKS` cancel + Redis aclose); `pytest backend/tests/unit/test_lifespan.py` asserts no `RuntimeWarning: coroutine was never awaited` on shutdown.
  3. Context-window protected-only overrun: when `protected_only_tokens > max_tokens`, `trim_messages_to_fit` drops oldest protected messages progressively OR raises `ConversationTooLongError` (decision locked at phase-level discuss); no silent overrun. New unit test in `test_context_window.py`.
  4. Migration 043 (partial unique index `documents (user_id, content_hash, folder_id) WHERE status != 'failed'`) + atomic `UPDATE ... WHERE status='pending'` compare-and-swap at top of `ingest_document` close the concurrent-upload race; integration test: two parallel `POST /documents/upload` of the same file produce exactly one `documents` row + one set of `document_chunks`.
  5. Title-gen failures in `generate_thread_title` (`threads.py:259-292`) emit `logger.warning` with exception detail before returning the fallback; log-capture unit test asserts the warning fires.

**Plans:**
- [x] 078-01-PLAN.md — Config fields + Supabase aclose + title-gen warning (Wave 1) — shipped 2026-05-27
- [x] 078-02-PLAN.md — Context-window protected overrun + dedup CAS + migration 051 (Wave 1) — shipped 2026-05-27
- [x] 078-03-PLAN.md — GET /admin/backpressure endpoint + tests (Wave 2; depends on 078-01) — shipped 2026-05-27

### Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable
**Goal**: A new D-PRD-12 ADR explicitly supersedes the single-worker rule, `CLAUDE.md` reflects the lift, and dev + prod uvicorn configs run `--workers 2` cleanly.
**Depends on**: Phase 077, Phase 078
**Plans**: 2
**Requirements**: WORKER-LIFT-03, WORKER-LIFT-01 (full enablement)
**Success Criteria** (what must be TRUE):
  1. `D-PRD-12` ADR authored in `.planning/prd-reset/DECISIONS.md` (and reflected in `PROJECT.md` Key Decisions table): names which singletons MUST stay per-worker (`RUN_TASKS`, sandbox sessions, settings TTL cache) vs which are Redis-backed; explicitly supersedes D-v2.5-02.
  2. `CLAUDE.md` "Single uvicorn worker" rule (currently in the Rules section) is replaced by "Multi-worker enabled — see D-PRD-12 for the audit checklist". No `backend/CLAUDE.md` needed (per D-19).
  3. Dev `uvicorn` invocation uses `--workers 2` (env-overridable via `WORKER_COUNT`); prod systemd / Docker config matches. A two-tab live test verifies multi-worker behavior end-to-end without manual intervention.
  4. Migration 052 (`runs.spawned_by_worker text`) ships — debug-only column recording the OS PID of the uvicorn worker that INSERTed each run. Populated at INSERT time for new runs; NULL for historical.
  5. Q-v2.6-05 (D-PRD-12 ADR wording) is locked before this phase ships.

### Phase 080: VPS Runbook + Deployment Guide Correction
**Goal**: The recovered deployment guides reflect post-v2.6 reality — `--workers N` is the recommended config, Redis container deployment is documented, and the obsolete manual postgrest-py patch is struck.
**Depends on**: Phase 079
**Plans**: 1
**Requirements**: (supports WORKER-LIFT-01/03 in documentation form)
**Success Criteria** (what must be TRUE):
  1. `.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md` updated: `--workers 2` → `--workers N` (with `WORKER_COUNT` env var documented); new Redis container deployment section added; manual `postgrest-py` patch step struck (replaced by inline note pointing at `backend/app/main.py:22` `_patch_postgrest_maybe_single`).
  2. `.planning/research/recovered/RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` updated: Redis container section added (matching the VPS guide); existing `--workers N` line preserved.
  3. Both docs show the pgbouncer transaction-mode pool sizing curve as a tuning reference for asyncpg under multi-worker.
  4. Doc audit at milestone close confirms no stale "single worker" references remain in the planning tree.

**Plans:** 1/1 plans complete
Plans:
- [x] 080-01-PLAN.md — VPS guide update (6 content blocks) + Hostinger guide update (4 content blocks) + stale-reference grep audit (Wave 1; autonomous)

### Phase 081: SEED-010 OpenRouter UAT
**Goal**: A ~30-minute UAT pass confirms the synthetic-timeout protocol produces clean `runs.status='timed_out'` (NOT `GeneratorExit`) on both OpenRouter Kimi-k2.5 and MiniMax-m2.7 routes.
**Depends on**: Phase 079
**Plans**: 1
**Requirements**: POLISH-SEED-010-01
**Success Criteria** (what must be TRUE):
  1. With `LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10,minimax/minimax-m2.7=10` in `.env`, restart uvicorn; trigger 4 runs (2 per model) against multi-step prompts that exceed the 10s budget.
  2. Each timed-out run shows `runs.status='timed_out'`, `runs.error='timed_out after 10s'` (NOT `GeneratorExit`); SSE stream emits clean lifecycle terminal sentinel; LangSmith trace shows clean termination (no `error=GeneratorExit` recording).
  3. UAT scoreboard rows ported from Phase 067.2 Rows 11-12 are all GREEN.
  4. No code change required — pure UAT exercise; verifies the v2.5 Phase 067.1 Track A drain helper handles OpenRouter-routed providers under synthetic timeout.

### Phase 081.1: Settings Architecture Unification
**Goal**: `backend/settings_override.json` is eliminated; every non-secret value it holds today lives in `app_settings` (global) or `user_settings` (per-user) tables, read through a single hot-reload cache. Secrets stay in `.env`. CLAUDE.md's stated principle ("Settings live in `user_settings` / `app_settings`; env vars are for secrets and infra only") finally holds in code. Foundation for v3.1 admin shell + v3.2 multi-tenancy — eliminates the JSON-file drift before downstream milestones inherit it.
**Depends on**: Phase 073 (asyncpg pool — all new settings reads use it)
**Plans**: 4
**Requirements**: SETTINGS-UNIFY-01, SETTINGS-UNIFY-02 (new; carry SEED-024)
**Success Criteria** (what must be TRUE):
  1. `backend/settings_override.json` is deleted from the repo; its 30+ keys migrated to `app_settings` (global ops/feature toggles, model lists, retrieval params) and `user_settings` (per-user prefs). One-shot migration job runs on first startup post-deploy: reads any existing JSON, writes into the DB tables, renames file to `settings_override.json.migrated` for operator rollback artifact.
  2. New columns on `app_settings` cover the user-named admin knobs that v3.1 PRD doesn't enumerate yet: `title_drafting_config` (model + prompt template, JSONB), `sub_agent_config` (model + max_output_tokens + system prompt, JSONB), `openrouter_tool_strategy`, `token_capture_enabled` (default true).
  3. Per-model knobs (`context_window_tokens`, `llm_call_timeout_seconds`, `max_output_tokens`) move from `MODEL_CAPABILITIES` static dict + env CSV overrides to a new `model_capabilities_overrides` table (foundation that v3.1 admin shell will then add UI on top of). Hot-reload cache pattern mirrors `_TTL_CACHE` at `backend/app/models/user_settings.py:27` (30s TTL, per-key invalidation on write).
  4. `LLM_CALL_TIMEOUT_OVERRIDES` env CSV path stays as a fallback (deployment bootstrap) but DB row takes precedence when both exist. Documented in `backend/.env.example` as "operator bootstrap only; prefer admin UI in v3.1+."
  5. Verifier integration test asserts: (a) no code path reads from `settings_override.json` after migration, (b) all values previously in the JSON resolve cleanly from DB through the new cache, (c) hot-reload observed — write to `app_settings`, next read within 30s reflects change.

**Plans:** 4/4 plans complete
Plans:
- [ ] 081.1-01-PLAN.md — Migration 053 SQL + async DB cache functions + unit tests (Wave 1; autonomous)
- [ ] 081.1-02-PLAN.md — Migration apply checkpoint + migration runner in lifespan + frontend subtitle (Wave 2; autonomous: false)
- [ ] 081.1-03-PLAN.md — Consumer rewire: user_settings.py DB-backed + settings.py async API + config.py 4-tier (Wave 3; autonomous)
- [ ] 081.1-04-PLAN.md — Integration tests + human verification (Wave 4; autonomous: false)

### Phase 082: Cross-cutting Verification + Extraction Telemetry
**Goal**: All three v2.6 workstreams are proven not to regress each other — final default-set output (post-071.3) matches reference, multi-worker doesn't break CONCUR-01, and StreamsProvider doesn't regress the 067.5 empty-thread-until-refresh fix.
**Depends on**: Phase 076, Phase 080, Phase 081, Phase 081.1 (Phase 082.5 decoupled per D-01)
**Plans:** 2/2 plans complete
Plans:
- [ ] 082-01-PLAN.md — Automated verification: extraction re-extract SC#1 + CONCUR-01 pytest SC#2 + telemetry SC#4 (Wave 1; autonomous)
- [ ] 082-02-PLAN.md — Lived-experience UAT SC#3 + milestone-close REQ-ID audit SC#5 + seed disposition (Wave 2; autonomous: false)
**Requirements**: (cross-cutting verification — all 24 v2.6 REQ-IDs validated through their phase tests; this phase is the orchestration gate)
**Success Criteria** (what must be TRUE):
  1. Re-extraction with the post-071.3 default-set (camelot tables + pymupdf_full images + legacy text + `none` equations) against the user's reference PDF + DOCX pair holds table + image counts within 20% delta of the 071.3 Plan 05 UAT baseline (re-running the RAG-DOCLING-01 acceptance under the full v2.6 stack with multi-worker + StreamsProvider live).
  2. `pytest backend/tests/integration/test_058_concurrency.py` (CONCUR-01 binding gate) green under `--workers 2`; no regression vs single-worker baseline.
  3. Phase 067.5 Branch D-3 `clearMessages` guard regression test green; 5/5 lived-experience cycles on Chrome MCP show no empty-thread-until-refresh repro post-StreamsProvider lift.
  4. `pdf_extraction_runs` telemetry table populated for every document re-ingested during the verification pass; admin can query per-document extractor lineage + durations (per-aspect composer signature `composable[<text>/<tables>/<images>/<equations>]` per 071.3).
  5. Milestone-close audit confirms all 24 v2.6 REQ-IDs are GREEN; carry-forward seeds (SEED-001 partial downgrade; SEED-006/007/008/009/010/011 fully consumed) recorded in `seeds/` directory.

### Phase 082.5: Error Handler Foundation (SEED-026 urgent slice)
**Goal**: User-visible error messages stop leaking backend SDK internals, every `logger.error/info/warning` call surfaces to a single configured sink, and every error response carries a `trace_id` that links the client report to a server-side record. Closes D-074-01-DEFER-1 in the same patch.
**Depends on**: Nothing (independent of v2.6 multi-worker / extraction tracks)
**Plans**: 2 (planner may split as scope dictates)
**Requirements**: (cross-cutting infra — no new v2.6 REQ-ID; addresses SEED-026 pillars 1-3 + D-074-01-DEFER-1)
**Success Criteria** (what must be TRUE):
  1. `backend/app/main.py` registers `@app.exception_handler(Exception)` and `@app.exception_handler(HTTPException)` that convert any thrown exception into a Pydantic `ErrorResponse(code: str, user_message: str, admin_message: str | None, trace_id: str, timestamp: datetime, run_id: str | None, thread_id: str | None)`. Untrusted exception detail is sanitized — internal SDK error strings (e.g., `supabase-py APIError`, `asyncpg.exceptions.X`, `anthropic._exceptions.X`) never reach `user_message`.
  2. `logging.basicConfig(level=logging.INFO, format=<JSON or structured text>)` lives in `app.main` startup — every `logger.info/warning/error/exception` call in the 36 affected modules now emits to stdout. D-074-01-DEFER-1 is verifiably closed: re-running the Phase 074 Live UAT with `MODEL_OUTPUT_LIMITS` override now shows the clamp `logger.info` breadcrumb in uvicorn stdout.
  3. A new `app_errors` table records every `ErrorResponse` issued (`code, user_id, run_id, thread_id, admin_message, trace_id, timestamp, request_path`). RLS owners-only (`user_id`); admin role exempt (admin role TBD — Phase 082.5 includes a minimal `is_admin` boolean on `auth.users` metadata or `app_settings.admin_user_ids` allowlist for now, full RBAC deferred to SEED-012).
  4. Every `ErrorResponse` carries the same `trace_id` used by LangSmith and the new `app_errors` row, so an admin can join "user reported X at HH:MM" → backend log line → LangSmith trace → `app_errors` row by a single id.
  5. `lib/api.ts` parses `ErrorResponse` shape and exposes a typed `ApiError { code, user_message, trace_id }`. No frontend toast lib in this phase (deferred to v2.7 per SEED-026 pillar 4) — but the parsed shape replaces the current generic `Error("Failed to ...")` throws so a follow-up phase can drop a toast lib in without re-plumbing.
  6. `asyncio.CancelledError` is NOT caught by the global handler (normal stream-disconnect signal, not an error — distinguished per SEED-026 Open Question 4).

---

## Migration Claims Summary

| Migration | Phase | Purpose |
|---|---|---|
| 039_pdf_extraction_runs.sql | 071 | Per-document extraction telemetry table |
| 040_documents_extractor_column.sql | 071 | `documents.extractor text` column |
| 041_document_images_bbox.sql | 071 | `document_images.bbox jsonb` from Docling/PyMuPDF |
| 042_document_tables_bbox_extractor.sql | 071 | `document_tables.bbox jsonb` + `extractor text` |
| 043_documents_dedup_unique_index.sql | 078 | Partial unique index closing concurrent-upload race |
| 044_app_settings_multimodal_limits.sql | 072 | Admin-tunable multimodal ceilings |
| 045_runs_worker_id.sql | 079 (conditional) | `runs.spawned_by_worker` debug column |
| 048_app_settings_admin_knobs_unification.sql | 081.1 | `app_settings` JSONB columns (`title_drafting_config`, `sub_agent_config`) + `model_capabilities_overrides` table scaffold — eliminates `settings_override.json` (SEED-024) |
| 046, 047, 049 | (buffer) | Reserved for unanticipated phase-level discoveries (047 already in use by 071.3; see actual on-disk files) |

Six migrations committed unconditionally; one conditional (per Q-v2.6-02 outcome); one claimed for SEED-024 settings unification (081.1); three reserved as buffer. Total 11 slots claimed against the `039–049` reservation per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`. **Note:** the on-disk migration filenames at slots 045/046/047 are extraction-aspect work from Phase 071.2/071.3 (not the `runs_worker_id` originally reserved at 045) — pre-existing claims-table drift; reconcile at milestone close.

---

## Cross-PRD Reference Table

v2.6's outputs unblock downstream milestone PRDs as follows:

| v2.6 Output | Unblocks | How |
|---|---|---|
| Phase 068 `<StreamsProvider>` Context | v3.0 Skill Studio | v3.0 eval pane can subscribe to a second concurrent run-stream surface without colliding on the per-thread `messagesByThread` Map invariant (per D-PRD-06). |
| Phase 071 Docling primary path + `PdfExtractor` ABC | v3.5+ vertical packs | Per-pack extractors (legal redaction-aware, finance table-heavy) can be plugged in without app-code changes — the abstraction is the swap point per D-PRD-07. |
| Phase 071 `pdf_extraction_runs` telemetry | v3.1 Operator UX | v3.1 admin shell renders per-document extractor lineage + duration histograms over this table. |
| Phase 073 asyncpg pool | v3.3 Open Platform API | Public REST API needs the connection-pool-backed hot path to scale beyond ~10 concurrent users (D-PRD-08 implication). |
| Phase 073 TOKEN-COL-01 (`runs.input_tokens/output_tokens`) | v3.1 admin observability + v3.4 spend caps | v3.1 dashboards read these columns directly; v3.4 spend-cap pre-flight reads them instead of falling back to its token-estimator path. |
| Phase 077 multi-worker validation | v3.3 Open Platform API | Public API + MCP server + service accounts can ship knowing run-tracking + sandbox stickiness + Redis singletons survive `--workers N`. |
| Phase 078 `GET /admin/backpressure` JSON | v3.1 backpressure dashboard UI | v3.1 ships the UI render over this primitive; v2.6 ships only the JSON shape. |
| Phase 078 partial unique index (CQ-DEDUP-01) | v3.2 multi-tenancy | Per-org uniqueness can layer on the same `(user_id, content_hash, folder_id)` shape with `org_id` prepended once v3.2's RLS shift ships. |
| Phase 079 D-PRD-12 ADR (D-v2.5-02 supersession) | v3.3 Open Platform API + v3.4 Automations | Both milestones explicitly assume multi-worker. The ADR + the `CLAUDE.md` rule update + the audit checklist are the gate. |
| Phase 080 VPS runbook correction | v3.1 deployment presets | v3.1's install wizard + scale-tier presets read from the corrected runbook as their authoritative source. |

---

## FLAGS

### F-1: TOKEN-COL-01 routing — attached to Phase 073 (not in PRD §12 outline)

**Issue.** TOKEN-COL-01 was added at signoff (2026-05-12, PRD §3 Theme F) but the §12 phase outline pre-dates the signoff addition; the §12 table does not name TOKEN-COL-01 explicitly.

**Resolution applied.** Attach TOKEN-COL-01 to **Phase 073 (asyncpg Pool Integration)** as a forward-fill of `runs.input_tokens` / `runs.output_tokens` during the agent_runner finalize path that asyncpg refactors anyway. The natural code site is `_drain_stream_with_close_on_cancel` at `backend/app/api/threads.py:158-255`, which already writes `runs.UPDATE` — adding two more columns to that update statement is the minimal-friction shape. Rationale:
- Pure observability; no caps, no enforcement (per PRD §3 Theme F)
- Existing schema columns already in place (no migration needed; PRD §5 confirms)
- Schema deferred from v2.5 Phase 061 plan 03 (per STATE.md:252 "token-counter accounting deferred")
- Phase 073 is the right code site because the asyncpg refactor touches the exact UPDATE statement that needs the two new column writes — bundling avoids a second touch-point in the same hot path

**Plan count impact.** Phase 073 stays at 4 plans (TOKEN-COL-01 absorbed into the existing finalize-path plan rather than spawning a 5th plan). Documented here so reviewers can audit the call-out.

**No restructure proposed.** PRD §12 outline remains canonical for phase boundaries and dependencies; this FLAG is purely a routing note for a requirement that landed post-signoff.

---

## Coverage Summary

- **v2.6 Active requirements:** 24 (per REQUIREMENTS.md; PRD §4 holds the original 21 — CHAT-RESILIENCE-01 added 2026-05-13, SETTINGS-UNIFY-01/02 added 2026-05-27)
- **Mapped to phases:** 24 / 24 ✓
- **Orphaned requirements:** 0
- **Phases with no REQ-ID owner:** 0 (Phase 068 owns STREAMS-PROVIDER-01; Phase 068.5 owns CHAT-RESILIENCE-01 added 2026-05-13; Phase 069 is structural prep verified by RAG-DOCLING-01 at Phase 071; Phase 080 is documentation-only support for WORKER-LIFT-01/03; Phase 082 is cross-cutting verification; all five are intentional non-REQ-bearing phases with explicit roles)
- **All 24 requirements Complete** -- verified by Phase 082 SC#5 milestone-close audit (24/24 Validated, 2026-05-27)

See REQUIREMENTS.md Traceability table for the per-REQ-ID mapping.

---

---

*Roadmap authored 2026-05-12 from `.planning/PRDs/v2.6.md` §12 (canonical phase outline) + REQUIREMENTS.md (21 Active REQ-IDs). Continues phase numbering from v2.5's last phase 067.5. Milestone shipped 2026-05-27 — 35 phases, 91 plans, 846 commits, 24/24 REQ-IDs Validated.*
