# Requirements: Agentic RAG — Milestone v2.5

**Milestone:** v2.5 SSE Concurrency & Reconnect Stability
**Defined:** 2026-05-01
**Core Value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.
**Milestone Goal:** Resolve the Phase 057 deferral by fixing the dominant backend concurrency blocker and shipping a correct frontend reconnect architecture, so chat streaming survives tab-switches, page refreshes, and concurrent thread navigation.

## v1 Requirements

Active scope for v2.5. Each maps to exactly one phase below.

### Backend Concurrency

- [ ] **CONCUR-01**: While Thread A is mid-SSE-stream, an authenticated `GET /threads/B/messages` request returns within 1 second (currently hangs ~30s until the SSE finishes). Verified by: open Thread A streaming → in another tab, fetch Thread B's messages endpoint → measure response time in DevTools network panel.
- [ ] **CONCUR-02**: When the SSE client disconnects (tab close, F5, network drop), the backend agent task is cancelled within 1 second — no wasted LLM tokens generating responses no client will receive. Verified by: trigger a long-running agent loop → close the SSE connection mid-stream → confirm in backend logs that the agent task receives `CancelledError` and that no further LLM API calls fire after disconnect.

### Frontend Streaming Reliability

- [ ] **STREAM-02a**: Switching from a streaming Thread A to Thread B does NOT corrupt Thread B's message list with Thread A's data (Symptom H). Concurrent `loadMessages` calls cannot overwrite each other's results. Verified by: start streaming on Thread A → click Thread B before stream ends → confirm Thread B shows only Thread B's messages, no leak from A.
- [ ] **STREAM-02b**: After tab switch mid-stream (Symptom E) or F5 mid-stream (Symptom F), the assistant message recovers without a manual second F5 — either auto-displays via reconcile fetch, or a "Resume" button appears if the backend is still mid-generation. Stop button (Symptom G) does not trigger reload, and tool-result JSON does not leak into chat content (Bug 3 regression guard). Verified by: scripted scenarios E, F, G in browser MCP.

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
| CONCUR-01 | Phase 058 | Pending |
| CONCUR-02 | Phase 059 | Pending |
| STREAM-02a | Phase 060 | Pending |
| STREAM-02b | Phase 061 | Pending |
| TEST-01 | Phase 062 | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

## Phase Sequencing

- **058 → 059 → 060 → 061** are hard-ordered. 058 is the dominant blocker; without it, every downstream symptom remains masked by backend concurrency. 059 builds on 058 by completing the architecture cleanup. 060 must precede 061 because 061's reconcile logic depends on `loadMessages` being non-racing.
- **062 is parallel-able with 058**. The validation harness lives in different files (test scripts) and lessons-learned dictate it must exist BEFORE 061 lands so reconnect fixes can be validated in isolation.

---
*Requirements defined: 2026-05-01 — milestone v2.5 bootstrap*
*Source research: `.planning/research/058-sse-concurrency-research.md`*
*Companion: `.planning/phases/057-sse-realtime-reconnect-fix/057-DEFERRAL.md` (deferral context for two prior failed attempts)*
