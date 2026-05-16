# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1–8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9–17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18–25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26–32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33–43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44–57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058–067.5 (shipped 2026-05-09)
- 🔄 **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068–082 (in progress, started 2026-05-12)

---

## v2.6 Milestone Context

**Goal:** Build the production-ready substrate the next four milestones depend on — close the user-observed PDF↔DOCX extraction inconsistency, lift the single-worker concurrency ceiling, hoist the streams subscription surface out of `useMessages`, and absorb six carry-forward seeds before they compound.

**Scope brief:** [`.planning/PRDs/v2.6.md`](PRDs/v2.6.md) (locked 2026-05-10, signoff 2026-05-12 with TOKEN-COL-01 addition). All 6 PRD gates passed (compatibility, scalability, coverage, doc-validity, surprise-feature, lean).

**Phase numbering basis:** Continues from v2.5's last phase 067.5 → v2.6 starts at Phase **068** and runs through Phase **082** (16 phases, ~40 plans total — includes mid-milestone amendment Phase 068.5). Matches PRD §12 phase outline verbatim except for Phase 068.5, added 2026-05-13 to absorb BUG-260513-01 (chat-surface persistent rendering); PRD v2.6 §4 amendment recommended at user's discretion.

**Migration range reserved:** `039 – 049` (per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`).
- Used: `039` (071), `040` (071), `041` (071), `042` (071), `043` (078), `044` (072)
- Conditional: `045` (079, on Q-v2.6-02 outcome)
- Buffer: `046 – 049` (unanticipated phase-level discoveries)

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

<details open>
<summary>🔄 v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068–082) — IN PROGRESS, started 2026-05-12</summary>

**Wave 0 — Foundational** (no inter-wave dependencies; can start in parallel)

- [ ] **Phase 068: `<StreamsProvider>` Context Lift** — Hoist `subscriptionsRef`, `lastSeenOffsetRef`, `messagesByThread` Map, and the Phase 067.5 Branch D-3 `clearMessages` guard from `frontend/src/hooks/useMessages.ts` (1229 LOC) into a top-level `<StreamsProvider>` Context. `useMessages` becomes a thin reader. Frontend-only. (4 plans)
- [ ] **Phase 068.5: Chat-Surface Persistent Rendering + In-Flight Pulse** — Render last-known-good messages immediately on thread switch / page nav / refresh; reconcile via `GET /threads/{id}/messages` in background; animated pulse on un-terminated assistant turns (`runs.status='running'`); inline retry on fetch failure. Closes BUG-260513-01. Frontend-only with backend touchpoint to expose `runs.status` per-message client-side. (2 plans)
- [ ] **Phase 069: `PdfExtractor` Abstraction Scaffold** — Carve current pypdf + python-docx + pdfplumber pipeline behind a `PdfExtractor` ABC; no behavior change at the wire layer. (2 plans)
- [ ] **Phase 070: Docling httpx Spike** — Validate Q-v2.6-01 resolution path: try (a) supabase-py 2.10 → 2.29, (b) docling pin-back, (c) subprocess isolation, in that order. Output: a chosen path + a working CI proof. (2 plans)

**Wave 1 — Parallelizable RAG + asyncpg + Polish**

- [ ] **Phase 071: Docling Primary Path** — Make Docling the default extractor; PyMuPDF (AGPL, subprocess-fenced) + pypdfium2 fallbacks wired. Migrations 039 (`pdf_extraction_runs`), 040 (`documents.extractor`), 041 (`document_images.bbox`), 042 (`document_tables.bbox + extractor`). (4 plans)
- [ ] **Phase 071.2: Ingestion Plumbing + Docling Quality Diagnostics** — `/upload` + `/reingest` `run_in_threadpool` sweep + instant-201 BackgroundTask refactor (document row INSERTed BEFORE extract so Realtime drives frontend status); diagnose + close the 95%-chunks-drop on Docling-extracted PDFs + the 4-vs-1 telemetry-vs-storage table-count mismatch. Inserted 2026-05-15 before Phase 072 so multimodal lift doesn't compound the foreground-extract latency bug. (4 plans)
- [ ] **Phase 071.3: Docling Demotion — Table Engine Pick + Full Rip** — Promote SEED-019. Bench PyMuPDF `find_tables(strategy="text")` + gmft (MIT, TATR-backed) + Camelot 1.0 Stream on the user's thesis; pick a non-Docling table engine that beats `pdfplumber`'s 4-of-20+ ceiling. Ship migration 047 flipping `extraction_table_engine_pdf` default. Full Docling cleanup: delete `docling` from `requirements.txt`, delete `docling.py` + 4 Docling adapters, unpin `httpx<0.29`, delete `pymupdf_isolated.py` subprocess fence if PyMuPDF runs clean in-process post-unpin. Plant SEED-020 (embedding-model audit) at close. Inserted 2026-05-16 after migration 046 demoted Docling defaults (commit `315f307`) but `pdfplumber` interim still misses 16+ tables. (5 plans)
- [ ] **Phase 072: Multimodal Lift + DOCX Completeness** — Replace `_MAX_VISION_CALLS` / `_MAX_B64_BYTES` module constants with `app_settings` keys; persist empty-vision-description rows (`description=''`); DOCX `related_parts` walk catches floating shapes + headers/footers. Migration 044 (`app_settings_multimodal_limits`). (3 plans)
- [ ] **Phase 073: asyncpg Pool Integration** — Replace sync `supabase-py` calls in streaming endpoint + ingestion task with asyncpg. New `_pg_pool` singleton at `dependencies.py`. Forward-fill `runs.input_tokens` / `runs.output_tokens` from LLM `usage` in the `_drain_stream_with_close_on_cancel` finalize path (TOKEN-COL-01 attaches here — see FLAGS below). (4 plans)
- [ ] **Phase 074: SEED-009 + SEED-011 Polish Bundle** — `MODEL_CAPABILITIES.max_output_tokens` field + `_clamp_max_tokens` in `anthropic_service.py` + `_reset_redis_singleton` autouse fixture in `test_059_disconnect.py`. (2 plans)
- [ ] **Phase 075: SEED-008 + tool_args_progress Polish Bundle** — `GET /threads/{id}/snapshot` combined endpoint + line-by-line `code_stdout` SSE re-wire + `tool_args_progress` SSE event for non-execute_code tools. (3 plans)

**Wave 2 — Depends on Wave 1**

- [ ] **Phase 076: Confidence Recalibration** — Re-run Phase 32.5 calibration on post-071.3 default-set chunks (camelot tables + pymupdf_full images + legacy text + `none` equations); Q-v2.6-03 answer locked at 071.3 close to "re-run on new defaults". Score distributions documented in PROJECT.md. (2 plans)
- [ ] **Phase 077: Multi-Worker Validation Harness** — 50-parallel-run synthetic load; cross-worker cancel via Redis zombie-heal path; consistent-hashing-on-thread_id sandbox stickiness; per-worker Redis singleton verified idempotent. (3 plans)
- [ ] **Phase 078: Backpressure JSON Primitive + Code-Quality Bundle** — `GET /admin/backpressure` JSON endpoint (gated on `BACKPRESSURE_ADMIN_USER_IDS` env var allow-list) + Supabase aclose lifespan hook + context-window protected-only overrun branch + concurrent-upload dedup race partial-unique-index migration 045 + title-gen `logger.warning` log. (3 plans)

**Wave 3 — Release-Gating**

- [ ] **Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable** — Author the D-PRD-12 ADR; update `CLAUDE.md` "Single uvicorn worker" rule to "Multi-worker — see D-PRD-12"; enable `--workers 2` in dev + prod uvicorn config. Optional migration 045 (`runs.spawned_by_worker`) conditional on Q-v2.6-02 outcome. (2 plans)
- [ ] **Phase 080: VPS Runbook + Deployment Guide Correction** — Update `RECOVERED_VPS_Deployment_Guide.md` to `--workers N` + Redis container deployment section + struck manual postgrest-py patch (auto-applied since v2.5 Phase 058 D-058-05). Update `RECOVERED_Deploy_Hostinger_Supabase_Cloud.md` for Redis omission only. (1 plan)
- [ ] **Phase 081: SEED-010 OpenRouter UAT** — UAT-only ~30 min: env edit (`LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10,minimax/minimax-m2.7=10`) + uvicorn restart + 4 runs against Kimi-k2.5 + MiniMax-m2.7; ports Phase 067.2 Rows 11-12 scoreboard. (1 plan)

**Wave 4 — Verify**

- [ ] **Phase 082: Cross-cutting Verification + Extraction Telemetry** — Validate final default-set output (post-071.3: camelot + pymupdf_full + legacy + `none` equations) against the user's reference PDF + DOCX baseline (ground truth: 35 tables / 59 figures on user thesis). Verify `--workers 2` doesn't regress the CONCUR-01 binding gate (`backend/tests/integration/test_058_concurrency.py`). Verify SEED-007 lift didn't regress 067.5 cycles (Chrome MCP + Playwright e2e against 063 / 063.1 / 067.x specs). (2 plans)

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
  6. Live UAT on the user's reference thesis PDF: `/upload` (or `/reextract`) returns; SQL on `document_tables` returns count ≥ 15 (gmft target) OR ≥ 12 (PyMuPDF-only target if gmft underperforms). `document_images` count ≥ 30 (preserved from prior baseline post-migration 046). Chunks ≥ 200. Recorded in `071.3-HUMAN-UAT.md`.
  7. SEED-019 frontmatter status flipped from `planted` → `closed`. SEED-020 (embedding-model audit) planted with concrete re-open trigger per [[project-phase071-3-scope]] direction.

**Plans:** 5 plans

- [x] 071.3-01-PLAN.md — Bench 3 table engines on 2 fixtures (user thesis + friendly_real.pdf); user picks winner via WINNER.md sentinel. (Wave 1; autonomous: false) — **winner: camelot** (thesis 214 / friendly_real 15; gmft excluded — transformers strict-dataclass break)
- [x] 071.3-02-PLAN.md — Wire winner adapter into aspects/tables.py + TABLE_ENGINES registry + unit + integration tests. (Wave 2 — depends on Plan 01 WINNER.md sentinel; autonomous: true) — camelot adapter shipped, 11/11 tests pass
- [x] 071.3-03-PLAN.md — Migration 047 + supabase/full-schema.sql regen + user_settings.py defaults flip. (Wave 3 — depends on Plan 02; autonomous: false — Task 2 paste-in-SQL-editor is a checkpoint:human-action) — migration applied, constraint sealed to (camelot, pdfplumber), default flipped to camelot; verified live
- [x] 071.3-04-PLAN.md — Full Docling rip (8 phases A-H): delete adapters, source files, env knobs, EXTRACTOR_PRIMARY, drop docling from requirements, unpin httpx, conditional PyMuPDF in-process smoke + fence delete. (Wave 4 — depends on Plan 03; autonomous: true) — Docling fully purged; httpx unpinned (Phase F PASS); fence deleted, in-process PyMuPDF (Phase G PASS); no seeds needed
- [ ] 071.3-05-PLAN.md — Live UAT on 3 fixtures (thesis + friendly_real + DOCX sibling); close SEED-019; plant SEED-020; conditional SEED-021 plant; PROJECT.md ADR + ROADMAP wording updates. (Wave 5 — depends on Plan 04; autonomous: false — live UAT requires user)

**Notes:**
- This phase is BEFORE Phase 072 because Phase 072's multimodal lift verification (SC#1 ≥80% of visible figures) re-extracts documents and would be tested under whichever table engine 071.3 ships. Doing 072 first would force a re-verification after 071.3.
- **Phase 076** (Confidence Recalibration): rescopes to the new default engine's chunk distribution. Q-v2.6-03 "re-run vs reuse" answer flips to "re-run on new defaults" definitively.
- **Phase 082** (Cross-cutting Verification): SC#1 rephrased at 071.3 close from the Docling-era wording to "Validate final default-set output against baseline" (camelot tables + pymupdf_full images + legacy text + `none` equations).
- Sibling commit: `315f307` (2026-05-16) already flipped `app_settings` defaults for tables (`docling_tf` → `pdfplumber`) and equations (`docling_formula` → `none`) via migration 046. 071.3 supersedes the interim defaults.
- Per `feedback_preserve_engine_optionality`: the per-aspect dispatcher pattern stays — just different engines in the registries. Docling adapters get deleted because Docling is genuinely uninstalled, not because we're abandoning optionality.
- Per `feedback_dont_hedge_to_no_new_infra`: the "keep Docling as opt-in fallback" hedge was explicitly rejected at scope-lock; deleting Docling reclaims the httpx pin + subprocess fence (~150 LOC).
- Research brief: `.planning/research/071.3-table-engine-comparison.md` (2026-05-16, arXiv 2410.09871-backed). gmft expected winner; PyMuPDF text-strategy expected fallback.

### Phase 072: Multimodal Lift + DOCX Completeness
**Goal**: A 4 MB academic PDF re-ingested under v2.6 stores ≥80% of its visible figures, and a hand-crafted DOCX with floating shapes + header images surfaces both via the related-parts walk.
**Depends on**: Phase 069
**Plans**: 3
**Requirements**: RAG-MM-LIFT-01, RAG-MM-LIFT-02
**Success Criteria** (what must be TRUE):
  1. `multimodal_max_vision_calls` and `multimodal_max_b64_bytes_kb` are admin-tunable via `app_settings` (migration 044); defaults raised from current 20 / 512 KB to 100 / 4 MB (covers ≥80% of figures on the reference 4 MB academic PDF).
  2. Empty-vision-description rows persist with `description=''` instead of being dropped (so retries can fill them in cheaply); count of stored vs visible figures on reference PDF assertable via SQL.
  3. DOCX extraction walks `doc.part.related_parts` + detects `wp:anchor` floating shapes; a hand-crafted DOCX with a floating shape + a header image produces both `document_images` rows.
  4. `app_settings` reader at `models/user_settings.py` is wired to consult the new keys (closing the `app_settings` table dead-code state per `CONCERNS.md:520-524` for these two specific keys).

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

### Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable
**Goal**: A new D-PRD-12 ADR explicitly supersedes the single-worker rule, `CLAUDE.md` reflects the lift, and dev + prod uvicorn configs run `--workers 2` cleanly.
**Depends on**: Phase 077, Phase 078
**Plans**: 2
**Requirements**: WORKER-LIFT-03, WORKER-LIFT-01 (full enablement)
**Success Criteria** (what must be TRUE):
  1. `D-PRD-12` ADR authored in `.planning/prd-reset/DECISIONS.md` (and reflected in `PROJECT.md` Key Decisions table): names which singletons MUST stay per-worker (`RUN_TASKS`, sandbox sessions, settings TTL cache) vs which are Redis-backed; explicitly supersedes D-v2.5-02.
  2. `CLAUDE.md` "Single uvicorn worker" rule (currently in the Rules section) is replaced by "Multi-worker enabled — see D-PRD-12 for the audit checklist". `backend/CLAUDE.md` mirrors the change.
  3. Dev `uvicorn` invocation uses `--workers 2` (env-overridable via `WORKER_COUNT`); prod systemd / Docker config matches. A two-tab live test verifies multi-worker behavior end-to-end without manual intervention.
  4. Optional migration 045 (`runs.spawned_by_worker text`) ships conditional on Q-v2.6-02 atomic-rollout outcome — debug-only column for post-mortem if a run's lifecycle splits across workers unexpectedly.
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

### Phase 082: Cross-cutting Verification + Extraction Telemetry
**Goal**: All three v2.6 workstreams are proven not to regress each other — final default-set output (post-071.3) matches reference, multi-worker doesn't break CONCUR-01, and StreamsProvider doesn't regress the 067.5 empty-thread-until-refresh fix.
**Depends on**: Phase 076, Phase 080, Phase 081
**Plans**: 2
**Requirements**: (cross-cutting verification — all 21 v2.6 REQ-IDs validated through their phase tests; this phase is the orchestration gate)
**Success Criteria** (what must be TRUE):
  1. Re-extraction with the post-071.3 default-set (camelot tables + pymupdf_full images + legacy text + `none` equations) against the user's reference PDF + DOCX pair holds table + image counts within 20% delta of the 071.3 Plan 05 UAT baseline (re-running the RAG-DOCLING-01 acceptance under the full v2.6 stack with multi-worker + StreamsProvider live).
  2. `pytest backend/tests/integration/test_058_concurrency.py` (CONCUR-01 binding gate) green under `--workers 2`; no regression vs single-worker baseline.
  3. Phase 067.5 Branch D-3 `clearMessages` guard regression test green; 5/5 lived-experience cycles on Chrome MCP show no empty-thread-until-refresh repro post-StreamsProvider lift.
  4. `pdf_extraction_runs` telemetry table populated for every document re-ingested during the verification pass; admin can query per-document extractor lineage + durations (per-aspect composer signature `composable[<text>/<tables>/<images>/<equations>]` per 071.3).
  5. Milestone-close audit confirms all 21 v2.6 REQ-IDs are GREEN; carry-forward seeds (SEED-001 partial downgrade; SEED-006/007/008/009/010/011 fully consumed) recorded in `seeds/` directory.

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
| 046–049 | (buffer) | Reserved for unanticipated phase-level discoveries |

Six migrations committed unconditionally; one conditional (per Q-v2.6-02 outcome); four reserved as buffer. Total 11 slots claimed against the `039–049` reservation per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`.

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

- **v2.6 Active requirements:** 22 (per REQUIREMENTS.md; PRD §4 holds the original 21 — see note below)
- **Mapped to phases:** 22 / 22 ✓
- **Orphaned requirements:** 0
- **Phases with no REQ-ID owner:** 0 (Phase 068 owns STREAMS-PROVIDER-01; Phase 068.5 owns CHAT-RESILIENCE-01 added 2026-05-13; Phase 069 is structural prep verified by RAG-DOCLING-01 at Phase 071; Phase 080 is documentation-only support for WORKER-LIFT-01/03; Phase 082 is cross-cutting verification; all four are intentional non-REQ-bearing phases with explicit roles)
- **PRD amendment status:** `.planning/PRDs/v2.6.md` §4 still lists 21 Active REQs (matches signoff 2026-05-12). REQUIREMENTS.md and ROADMAP carry the 22nd REQ (CHAT-RESILIENCE-01) for Phase 068.5. User decision on whether to amend the locked PRD pending.

See REQUIREMENTS.md Traceability table for the per-REQ-ID mapping.

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 068 — StreamsProvider Context Lift | 4/4 | Complete    | 2026-05-13 |
| 068.5 — Chat-Surface Persistent Rendering + In-Flight Pulse | 2/2 | Complete    | 2026-05-14 |
| 069 — PdfExtractor Abstraction Scaffold | 2/2 | Complete    | 2026-05-13 |
| 070 — Docling httpx Spike | 2/2 | Complete    | 2026-05-14 |
| 071 — Docling Primary Path | 4/4 | Complete    | 2026-05-14 |
| 071.1 — Docling SC#1 retry — threadpool, timeouts, PyMuPDF fallback | 2/2 | Complete-partial | 2026-05-15 |
| 071.2 — Ingestion Plumbing + Docling Quality Diagnostics | 5/5 | Complete    | 2026-05-15 |
| 072 — Multimodal Lift + DOCX Completeness | 0/3 | Not started | — |
| 073 — asyncpg Pool Integration | 0/4 | Not started | — |
| 074 — SEED-009 + SEED-011 Polish Bundle | 0/2 | Not started | — |
| 075 — SEED-008 + tool_args_progress Polish Bundle | 0/3 | Not started | — |
| 076 — Confidence Recalibration | 0/2 | Not started | — |
| 077 — Multi-Worker Validation Harness | 0/3 | Not started | — |
| 078 — Backpressure JSON + Code-Quality Bundle | 0/3 | Not started | — |
| 079 — D-v2.5-02 Supersession + Multi-Worker Enable | 0/2 | Not started | — |
| 080 — VPS Runbook + Deployment Guide Correction | 0/1 | Not started | — |
| 081 — SEED-010 OpenRouter UAT | 0/1 | Not started | — |
| 082 — Cross-cutting Verification + Extraction Telemetry | 0/2 | Not started | — |
| **Total (v2.6)** | **4/40** | **In progress** | **—** |

---

*Roadmap authored 2026-05-12 from `.planning/PRDs/v2.6.md` §12 (canonical phase outline) + REQUIREMENTS.md (21 Active REQ-IDs). Continues phase numbering from v2.5's last phase 067.5.*
