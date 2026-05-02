# Requirements: Agentic RAG — Milestone v2.5

**Milestone:** v2.5 SSE Concurrency & Reconnect Stability
**Defined:** 2026-05-01
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Milestone Goal:** Resolve the Phase 057 deferral by fixing the dominant backend concurrency blocker and shipping a correct run-backed streaming architecture (modeled on Claude/ChatGPT) so chat streaming survives tab-switches, page refreshes, concurrent thread navigation, AND multi-tab access — generation lifetime decoupled from any single HTTP request.

## v1 Requirements

Active scope for v2.5. Each maps to exactly one phase below.

### Backend Concurrency

- [ ] **CONCUR-01**: While Thread A is mid-SSE-stream, an authenticated `GET /threads/B/messages` request returns within 1 second (currently hangs ~30s until the SSE finishes). Verified by: open Thread A streaming → in another tab, fetch Thread B's messages endpoint → measure response time in DevTools network panel.
- [x] **CONCUR-02
**: When the SSE client disconnects (tab close, F5, network drop), the backend agent task is cancelled within 1 second — no wasted LLM tokens generating responses no client will receive. Verified by: trigger a long-running agent loop → close the SSE connection mid-stream → confirm in backend logs that the agent task receives `CancelledError` and that no further LLM API calls fire after disconnect.

### Frontend Streaming Reliability

- [x] **STREAM-02a**: Switching from a streaming Thread A to Thread B does NOT corrupt Thread B's message list with Thread A's data (Symptom H). Concurrent `loadMessages` calls cannot overwrite each other's results. Verified by: start streaming on Thread A → click Thread B before stream ends → confirm Thread B shows only Thread B's messages, no leak from A.
- [ ] **STREAM-02b**: After tab switch mid-stream (Symptom E) or F5 mid-stream (Symptom F), the assistant message recovers without a manual second F5 — either auto-displays via reconcile fetch, or a "Resume" button appears if the backend is still mid-generation. Stop button (Symptom G) does not trigger reload, and tool-result JSON does not leak into chat content (Bug 3 regression guard). Subsumed by STREAM-04: with run-backed streaming, the recovery is automatic via replay-and-tail, so STREAM-02b's success criteria are met as a side-effect of STREAM-04 and validated in scenarios E/F/G of TEST-01.
- [x] **STREAM-04**: A streaming response survives client navigation, refresh, and multi-tab access. The user can leave and return mid-generation, refresh the page mid-generation, or open a second tab on the same thread, and see the in-progress or completed result. Generation lifetime is decoupled from any single HTTP request. Verified by: (a) start streaming → refresh page → see continued streaming with no manual action; (b) start streaming → close tab → reopen thread in new tab → see live continuation; (c) open same thread in two tabs while streaming → both tabs render the same tokens in sync. Implementation: per-run ephemeral buffer (Redis Streams per D-v2.5-08) + per-run durable metadata (`public.runs` Postgres table per D-v2.5-11) + `GET /threads/{id}/active-runs` + `GET /runs/{id}/stream?since={offset}` replay-and-tail endpoints + `DELETE /runs/{id}` cancel verb + frontend reconcile-on-(re)connect.

### Test Infrastructure

- [ ] **TEST-01**: A reproducible browser-driven test harness exists for the SSE/reconnect scenarios — at minimum scripts covering E (tab switch), F (F5 mid-stream), G (Stop regression), H (thread navigation), and "navigate during stream." Each scenario runnable in isolation via chrome-in-browser MCP without manual setup beyond launching the dev server. Verified by: developer can run any single scenario script and observe pass/fail without writing new code.

## Future Requirements

Deferred to later milestones. Tracked but not in v2.5 roadmap.

### Backend Async Migration

- **CONCUR-03**: Migrate Supabase calls from sync `supabase-py` to `asyncpg` (or supabase async client) for the streaming endpoint specifically. Removes the AnyIO 40-thread ceiling. Deferred because `run_in_threadpool` is sufficient for current scale.

### Realtime Source-of-Truth

- **STREAM-03**: Reintroduce Supabase Realtime as a low-latency hint layer on top of the reconcile-fetch source-of-truth (best-effort enhancement, not required path). Deferred because v2.5 scope already proves recovery works without Realtime.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-worker uvicorn (`--workers N`) | Masks the bug, breaks in-memory state, hides the issue from observability. Confirmed wrong fix in `058-sse-concurrency-research.md`. |
| Celery + Redis pub/sub | Over-engineered for current scale. Adds infrastructure burden and serialization round-trip per token. Re-evaluate only if horizontal scaling becomes required. |
| `EventSource` + `Last-Event-Id` replay | Backend persists only at end-of-stream — no resumable state to replay. POST + auth headers also blocked by EventSource API. |
| Auto-retry of LLM call after F5 mid-stream | Costs money, may produce duplicate responses. Resume button is the correct UX. |
| Long polling (continuous 2s loop after page load) | A single reconcile fetch + Resume button is cleaner and more honest UX than burning bandwidth. |
| Custom `SSEStreamingResponse` subclass | Replaced by `sse-starlette` + `request.is_disconnected()` polling — canonical Starlette pattern. |
| Realtime as authoritative source for chat-message arrival | Confirmed best-effort by Supabase #21093. Architecture must not depend on Realtime delivery guarantees. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONCUR-01 | Phase 058 | Complete |
| CONCUR-02 | Phase 059 | Complete |
| STREAM-02a | Phase 060 | Complete |
| STREAM-02b | Phase 063 (subsumed by STREAM-04) | Pending |
| STREAM-04 | Phases 061 + 062 + 063 | Complete |
| TEST-01 | Phase 064 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

## Phase Sequencing

- **058 → 059 → 060** shipped 2026-05-01/02 — backend concurrency, SSE architecture refactor, frontend race fixes (STREAM-02a closed).
- **061 → 062 → 063** are the run-backed streaming work delivering STREAM-04: 061 builds the durable per-run buffer (Redis Streams), 062 adds replay-and-tail HTTP API on top, 063 rewires the frontend to POST→run_id→subscribe and reconcile-on-(re)connect. Hard-ordered.
- **064 (Validation Harness)** validates the full chain — must land after 063 (no point validating before the architecture is in place). Was originally scoped before 061 but the v2.5-dev-failure lesson (build harness before fix) no longer applies because the rescope is architectural, not iterative-debugging.
- **065 (Skills Test Infra Repair)** is parallel-able with 061–064 — different test surface, no streaming dependency.

---
*Requirements defined: 2026-05-01 — milestone v2.5 bootstrap*
*Source research: `.planning/research/058-sse-concurrency-research.md`*
*Companion: `.planning/phases/057-sse-realtime-reconnect-fix/057-DEFERRAL.md` (deferral context for two prior failed attempts)*
