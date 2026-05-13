# Requirements: Agentic RAG — Milestone v2.6 (Foundation: RAG Quality + Multi-Worker + Polish)

**Defined:** 2026-05-12
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Scope brief:** [.planning/PRDs/v2.6.md](PRDs/v2.6.md) (locked 2026-05-10, signed off 2026-05-12 with TOKEN-COL-01 added)
**Migration range reserved:** 039–049 (per `.planning/prd-reset/MIGRATION-RESERVATIONS.md`)

## v2.6 Requirements

22 Active requirements grouped by theme. Each maps to exactly one roadmap phase (filled in §Traceability after roadmap generation).

> **Mid-milestone amendment 2026-05-13:** CHAT-RESILIENCE-01 added in response to BUG-260513-01 re-opening with expanded scope (page-nav + occasional load failure). Owned by Phase 068.5 — direct frontend follow-up to Phase 068's StreamsProvider lift. PRD v2.6 §4 amendment recommended at user's discretion.

### Theme A — RAG Quality Lift

- [ ] **RAG-DOCLING-01**: A user-uploaded PDF and the same source's DOCX produce comparable table + image counts (within 20% delta) when re-ingested under the new extractor. Docling primary path used by default; `PdfExtractor` abstraction allows per-document fallback to PyMuPDF without flipping the global default.
- [ ] **RAG-DOCLING-02**: The httpx<0.28 vs supabase 2.10 conflict has a chosen resolution path (per Q-v2.6-01) and is verified in CI: `pytest backend/tests/integration/test_pdf_extractor_*.py` green on the chosen resolution.
- [ ] **RAG-MM-LIFT-01**: `multimodal_service._MAX_VISION_CALLS` and `_MAX_B64_BYTES` are admin-tunable via `app_settings`; default raised to a value that covers ≥80% of figures on a 4 MB academic PDF. Empty-vision-description rows persisted (with `description=''`) instead of dropped, so re-runs can fill in.
- [ ] **RAG-MM-LIFT-02**: DOCX extraction reaches floating shapes and headers/footers via the full `doc.part.related_parts` walk (replaces `inline_shapes`-only).
- [ ] **RAG-RECAL-01**: Confidence thresholds recalibrated after Docling lands — Q-v2.6-03 chosen path executed and the resulting score distributions documented in PROJECT.md.

### Theme B — Multi-Worker Readiness

- [ ] **WORKER-LIFT-01**: `uvicorn --workers 2` runs cleanly: run-tracking survives across workers (cancelled run started in W1 cancellable from W2), sandbox sessions are sticky to the originating worker via consistent hashing on `thread_id`, Redis singleton initializes per worker without cross-talk.
- [ ] **WORKER-LIFT-02**: `asyncpg` connection pool replaces sync `supabase-py` calls inside the streaming endpoint (`agent_runner` Postgres reads/writes in `threads.py`) and inside `_drain_stream_with_close_on_cancel`'s persistence finalize path. CONCUR-01 binding pytest gate (`backend/tests/integration/test_058_concurrency.py`) stays green.
- [ ] **WORKER-LIFT-03**: A new ADR (`D-PRD-12`) explicitly supersedes `D-v2.5-02`; `CLAUDE.md`'s "Single uvicorn worker" rule is updated to "Multi-worker — see D-PRD-12 for the audit checklist".
- [ ] **WORKER-LIFT-04**: `GET /admin/backpressure` returns the documented JSON shape, gated on the existing operator role check (when none exists yet, scoped to a hard-coded admin user list via env var until v3.1 ships RBAC).

### Theme C — Streams Provider Pre-emptive Lift + Chat-Surface Resilience

- [ ] **STREAMS-PROVIDER-01**: A `<StreamsProvider>` Context owns all run-stream subscriptions; `useMessages` reads from it via `useStreamsContext()`; a second concurrent stream surface (mocked eval pane) renders without state collision. The Phase 067.5 Branch D-3 streaming-bucket guard at `frontend/src/hooks/useMessages.ts:572-590` is preserved verbatim; existing chat regression tests (063 / 063.1 / 067.x) stay green.
- [ ] **CHAT-RESILIENCE-01**: The chat surface paints last-known-good messages immediately on thread switch / page navigation / page refresh (no blank window). `GET /threads/{id}/messages` reconciles in the background without clobbering streaming buckets (Phase 067.5 Branch D-3 guard respected). Assistant turns whose `runs.status` is `running` or `queued` render with a visible in-flight pulse / animated brand mark until terminal SSE arrives. Fetch failures surface an inline retry over cached content instead of blanking the message list. Closes BUG-260513-01.

### Theme D — Polish Carry-forwards

- [ ] **POLISH-SEED-008-01**: Thread switch latency reduced ≥50% on cold-cache (post-F5) thread switch. New `GET /threads/{id}/snapshot` endpoint replaces the 3-call sequential chain.
- [ ] **POLISH-SEED-008-02**: Sandbox `for i in range(5): print(i); time.sleep(1)` produces ≥3 distinct `code_stdout` SSE events across ≥1 second elapsed.
- [ ] **POLISH-SEED-009-01**: `claude-haiku-4-5-20251001` runs no longer 400 with `max_tokens > 64000`. `MODEL_CAPABILITIES.max_output_tokens` populated for all currently-listed Anthropic models.
- [ ] **POLISH-SEED-010-01**: `LLM_CALL_TIMEOUT_OVERRIDES=moonshotai/kimi-k2.5=10,minimax/minimax-m2.7=10` produces clean `runs.status='timed_out'` (NOT `GeneratorExit`) on both OpenRouter-routed models.
- [ ] **POLISH-SEED-011-01**: `pytest backend/tests/integration/test_059_disconnect.py -q` is 3/3 PASS without `RuntimeError: Event loop is closed`.
- [ ] **POLISH-TOOL-PROG-01**: Tools other than `execute_code` emit `tool_args_progress` SSE events when their argument JSON exceeds 5 KB during streaming.

### Theme E — Opportunistic Code-Quality (Cluster G)

- [ ] **CQ-SUPA-01**: Supabase client `aclose()` runs on FastAPI shutdown without `RuntimeWarning`; verified in `pytest backend/tests/unit/test_lifespan.py`.
- [ ] **CQ-CTX-01**: When protected-only messages exceed `max_tokens`, `trim_messages_to_fit` either trims oldest-protected progressively OR raises `ConversationTooLongError` (decision routed to phase-level discuss). No silent overrun.
- [ ] **CQ-DEDUP-01**: Concurrent same-file uploads produce exactly one `documents` row + one set of `document_chunks` (race closed by partial unique index + atomic transition).
- [ ] **CQ-TITLE-01**: Title-generation failures emit a `logger.warning` with the exception detail; fallback behavior preserved.

### Theme F — Token Telemetry

- [ ] **TOKEN-COL-01**: `runs.input_tokens` and `runs.output_tokens` are populated for every completed LLM call (read from response `usage`). Backfill: existing NULL rows stay NULL — forward-fill only. NULL writes after this ship become a dashboard warning. No caps or limits introduced. Used by v3.1 admin observability + v3.4 spend-cap pre-flight.

## Future Requirements (deferred)

Owned by later milestones per `.planning/PRDs/v2.6.md` §11 + locked roadmap (`memory: project_v3_roadmap_locked.md`).

### v2.7 — Agent Workspace + Harness + Plugin Contract
- Per-thread workspace filesystem, state-machine harness with 5 phase types, right-side panel UI (Claude.ai-style), 3 new LLM tools (write_todos / task / ask_user), formal Plugin Contract for vertical packs

### v3.0 — Skill Studio (full PRD)
- Iterative skill development + eval environment (headline differentiator vs OpenAI Assistants); SKILL-01/02 relevance-based catalog filtering; sandbox per-execution timeout; settings UI redesign; `tool_args_progress` for `execute_code`; accessibility WCAG 2.1 AA lift

### v3.1 — Operator UX + Deployment Flexibility
- Admin shell + install wizard + RBAC operator role + deployment presets; backpressure dashboard UI (consumes v2.6's `GET /admin/backpressure` primitive); per-doc extractor override UI; per-user concurrent SSE stream cap; MODEL_CAPABILITIES editor; accessibility lift

### v3.2 — Multi-Tenancy (Hybrid SaaS Foundation)
- Org/dept/role primitives + RLS shift + SSO + audit; `match_document_chunks` SECURITY DEFINER → INVOKER audit; auth dependency `except Exception` masking fix; GDPR DPA pre-emptive at v3.2 close

### v3.3 — Open Platform: API + MCP + Service Accounts
- Versioned REST API + open-source MCP server + service accounts + webhooks + rate limiting

### v3.4 — Automations & Routines + DM Tier B
- Scheduled / triggered / reactive runs (as harness workflows from v2.7); Document Mgmt Tier B (retention, check-in/out, approvals); `agent_tasks` table

### v3.5+ — Vertical packs (legal / finance / healthcare)
- Per-pack milestones reactive to customer wins; ship as plugins through v2.7's Plugin Contract

## Out of Scope (this milestone)

Explicit exclusions for v2.6. See PRD §4 / §10 / §11 for full rationale.

| Feature | Reason |
|---------|--------|
| PyMuPDF Pro commercial license adoption | Deferred until first paying customer (`D-PRD-07`); `PdfExtractor` abstraction makes the swap painless |
| Full Skill Studio eval-driven dev loop | Owned by v3.0 (`D-PRD-09`) |
| Operator admin shell + install wizard | Owned by v3.1 |
| Multi-tenancy org/dept/role primitives | Owned by v3.2 (`D-PRD-02`) |
| Public REST API + MCP server + service accounts | Owned by v3.3 |
| Automations & Routines + DM Tier B | Owned by v3.4 |
| Vertical packs (legal / finance / healthcare) | Deferred to v3.5+ reactive-to-customer-win (`D-PRD-11`) |
| Sandbox per-execution timeout | Carry-forward to v3.0 polish slot — pairs more naturally with Skill Studio's eval-execution surface |
| Async OpenAI client conversion | Rejected — Phase 067.1 Track A `_drain_stream_with_close_on_cancel` solved the symptom (PRD §10 entry 4) |
| Per-claim confidence scoring | Permanent out-of-scope at project level (`PROJECT.md`) |
| Real-time multi-user collaboration on threads | No demand signal yet (PRD §10 entry 5) |
| Pgvector HNSW index migration | Awaiting decision — re-trigger if vector p95 > 500ms on real workload OR corpus > 100k chunks |
| `agent_tasks` table / Background Research Agent precursor | Owned by v3.4 (`SEED-014`) |
| `match_document_chunks` SECURITY DEFINER → INVOKER audit | Owned by v3.2 multi-tenancy RLS shift |
| Realtime as authoritative source for chat-message arrival | Permanent (`D-v2.5-03`) |
| Adobe PDF Services API as primary extractor | Recurring per-page cost incompatible with `D-PRD-10` 3-tier flat pricing; Docling MIT closes ~80% of gap at zero recurring cost |
| Migrate vector store off pgvector | One-way migration adds operational complexity; pgvector performant at projected scale; complicates v3.2 multi-tenancy RLS |
| `_strip_nul` bytes branch fix (Code-Quality §6.B) | Low-impact, no observed bug; closing every code-review finding regardless of impact is bad precedent |
| `ToolCall.args` type narrowing | Deferred to v3.0 frontend rework |
| Auth dependency `except Exception` masking | Deferred to v3.2 multi-tenancy security audit |
| Per-doc extractor override UI surface | Backend ships in v2.6 (`POST /documents/{id}/reextract`); UI deferred to v3.1 admin shell |
| Per-user concurrent SSE stream cap | Deferred to v3.1 (pairs with backpressure dashboard UI) |
| Sticky websocket sessions for Realtime | Awaiting decision — required only if Realtime is promoted above `D-v2.5-03` |
| Mobile native apps (iOS / Android) | Web-mobile responsive is current commitment; native depends on customer demand |
| Browser extension (highlight web → ingest) | Awaiting decision — re-trigger: integration partner asks for it |

## Pre-execution Decisions (PRD §13)

Six questions deferred to per-phase `/gsd:discuss-phase` — NOT blocking the roadmap.

| ID | Question | Owning phase | By when |
|---|---|---|---|
| Q-v2.6-01 | docling 2.x ↔ supabase 2.10 httpx pin conflict resolution | Phase 070 spike | Before Phase 071 |
| Q-v2.6-02 | Multi-worker rollout strategy (phased vs atomic) | Phase 073 discuss | Before Phase 073 |
| Q-v2.6-03 | Confidence threshold recalibration scope | Phase 076 discuss | Before Phase 076 |
| Q-v2.6-04 | Re-extraction migration policy (auto vs opt-in vs defer) | Phase 071 discuss | Before Phase 071 ship |
| Q-v2.6-05 | D-v2.5-02 supersession ADR wording (D-PRD-12 candidate) | Phase 079 | Before Phase 079 ship |
| Q-v2.6-06 | PyMuPDF AGPL fallback license posture formalization | Phase 069 | Before Phase 069 ship |

## Traceability

Each requirement maps to exactly one phase. See ROADMAP.md Phase Details + FLAGS section for the routing rationale (in particular F-1 for TOKEN-COL-01's attach point at Phase 073).

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAG-DOCLING-01 | 071 — Docling Primary Path | Pending |
| RAG-DOCLING-02 | 070 — Docling httpx Spike | Pending |
| RAG-MM-LIFT-01 | 072 — Multimodal Lift + DOCX Completeness | Pending |
| RAG-MM-LIFT-02 | 072 — Multimodal Lift + DOCX Completeness | Pending |
| RAG-RECAL-01 | 076 — Confidence Recalibration | Pending |
| WORKER-LIFT-01 | 077 — Multi-Worker Validation Harness (full enable at 079) | Pending |
| WORKER-LIFT-02 | 073 — asyncpg Pool Integration | Pending |
| WORKER-LIFT-03 | 079 — D-v2.5-02 Supersession + Multi-Worker Enable | Pending |
| WORKER-LIFT-04 | 078 — Backpressure JSON Primitive + Code-Quality Bundle | Pending |
| STREAMS-PROVIDER-01 | 068 — `<StreamsProvider>` Context Lift | Pending |
| CHAT-RESILIENCE-01 | 068.5 — Chat-Surface Persistent Rendering + In-Flight Pulse | Pending |
| POLISH-SEED-008-01 | 075 — SEED-008 + tool_args_progress Polish Bundle | Pending |
| POLISH-SEED-008-02 | 075 — SEED-008 + tool_args_progress Polish Bundle | Pending |
| POLISH-SEED-009-01 | 074 — SEED-009 + SEED-011 Polish Bundle | Pending |
| POLISH-SEED-010-01 | 081 — SEED-010 OpenRouter UAT | Pending |
| POLISH-SEED-011-01 | 074 — SEED-009 + SEED-011 Polish Bundle | Pending |
| POLISH-TOOL-PROG-01 | 075 — SEED-008 + tool_args_progress Polish Bundle | Pending |
| CQ-SUPA-01 | 078 — Backpressure JSON Primitive + Code-Quality Bundle | Pending |
| CQ-CTX-01 | 078 — Backpressure JSON Primitive + Code-Quality Bundle | Pending |
| CQ-DEDUP-01 | 078 — Backpressure JSON Primitive + Code-Quality Bundle | Pending |
| CQ-TITLE-01 | 078 — Backpressure JSON Primitive + Code-Quality Bundle | Pending |
| TOKEN-COL-01 | 073 — asyncpg Pool Integration (see ROADMAP F-1 routing note) | Pending |

**Coverage:**
- v2.6 requirements: 22 total
- Mapped to phases: 22 / 22 ✓
- Unmapped: 0
- Orphaned phases (no REQ-ID owner): 0 — Phase 068 owns STREAMS-PROVIDER-01; Phase 068.5 owns CHAT-RESILIENCE-01 (added 2026-05-13 to absorb BUG-260513-01); Phase 069 is structural prep verified by RAG-DOCLING-01 at Phase 071; Phase 080 is documentation-only support for WORKER-LIFT-01/03; Phase 082 is cross-cutting milestone-close verification

**Routing notes:**
- **TOKEN-COL-01 → Phase 073** (per ROADMAP F-1): added at PRD signoff 2026-05-12; the PRD §12 outline pre-dates the addition. Attached to 073 as a forward-fill of `runs.input_tokens` / `runs.output_tokens` during the asyncpg-refactored `_drain_stream_with_close_on_cancel` finalize path — the natural code site for the two new column writes.
- **WORKER-LIFT-01 spans two phases:** validated under synthetic load in Phase 077 (harness), final enablement (`--workers 2` lit up in dev + prod) in Phase 079. Traceability row attached to 077 since the validation is the verification gate.
- **RAG-DOCLING-02 → Phase 070** (the spike phase). The CI gate (`pytest backend/tests/integration/test_pdf_extractor_*.py` green) is the spike output; Phase 071 consumes it but does not re-verify it.

---
*Requirements defined: 2026-05-12 from `.planning/PRDs/v2.6.md` §4 (Active section)*
*Last updated: 2026-05-12 — traceability filled in by gsd-roadmapper after ROADMAP.md generation*
