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
- [x] **STREAM-02b**: After tab switch mid-stream (Symptom E) or F5 mid-stream (Symptom F), the assistant message recovers without a manual second F5 — either auto-displays via reconcile fetch, or a "Resume" button appears if the backend is still mid-generation. Stop button (Symptom G) does not trigger reload, and tool-result JSON does not leak into chat content (Bug 3 regression guard). Subsumed by STREAM-04: with run-backed streaming, the recovery is automatic via replay-and-tail, so STREAM-02b's success criteria are met as a side-effect of STREAM-04
 and validated in scenarios E/F/G of TEST-01.
- [x] **STREAM-04**: A streaming response survives client navigation, refresh, and multi-tab access. The user can leave and return mid-generation, refresh the page mid-generation, or open a second tab on the same thread, and see the in-progress or completed result. Generation lifetime is decoupled from any single HTTP request. Verified by: (a) start streaming → refresh page → see continued streaming with no manual action; (b) start streaming → close tab → reopen thread in new tab → see live continuation; (c) open same thread in two tabs while streaming → both tabs render the same tokens in sync. Implementation: per-run ephemeral buffer (Redis Streams per D-v2.5-08) + per-run durable metadata (`public.runs` Postgres table per D-v2.5-11) + `GET /threads/{id}/active-runs` + `GET /runs/{id}/stream?since={offset}` replay-and-tail endpoints + `DELETE /runs/{id}` cancel verb + frontend reconcile-on-(re)connect.

- [x] **STREAM-04-polish**: Following STREAM-04, the user-perceived streaming feel and agent autonomy match a Claude.ai-class chat surface for the RAG-tool domain. Specifically: (a) every latency phase (pre-first-delta, inter-iteration silence, tool-preparing) surfaces a context-aware in-flight label reflecting the actual operation ("Searching knowledge base…", "Spinning up sandbox…", "Loading skill 'docx'…") rather than a generic "Thinking…"/"Working" placeholder; (b) when the user submits a clear multi-step intent (e.g. "search → report → charts → docx"), the agent executes the FULL pipeline end-to-end without intermediate "If you want, I can also…" / "Shall I proceed to…" confirmation prompts, while preserving confirmation for genuinely-ambiguous intents and irreversible/destructive actions; (c) skill-load tool cards explain WHY the skill is being loaded, with a description hint sourced from the `skills.description` column. Additionally, this requirement closes Phase 066 SC#6 (D-066-11 stream-close-on-timeout invariant) — the LangSmith ChatOpenAI sub-trace exception column shows a clean exception type (TimeoutError / CancelledError) rather than `GeneratorExit` at `langsmith/run_helpers.py:1680`, OR the invariant is formally retired in 066-HUMAN-UAT.md with explicit rationale if the upstream langsmith-py BaseException-catch wrapper makes it unfixable. Verified by: re-running the synthetic-timeout protocol + 5 consecutive Fahed-Mrad multi-tool runs via Chrome MCP + DOM assertion `data-testid="skill-load-card"` carries a description hint. Implementation: surgical edits to `backend/app/api/threads.py` (SYSTEM_PROMPT, OpenAI/Anthropic timeout branches, `skill_loaded` follow-up SSE emit), `frontend/src/lib/toolMeta.ts` (new `outerBannerLabel` export), `frontend/src/lib/api.ts` (`onSkillLoaded` callback), `frontend/src/types/index.ts` (`SkillActivation.description?`), `frontend/src/hooks/useMessages.ts` (description merge handler), `frontend/src/components/chat/MessageItem.tsx` (placeholder copy via `outerBannerLabel`), `frontend/src/components/chat/ToolCallPanel.tsx` (skill-load card variant + `data-testid="skill-load-card"`).

- [ ] **STREAM-04-correctness-round3**: Following STREAM-04-correctness-round2, close the residual 2 RED rows + 2 carry-forward deferred rows from Phase 067.3's user-driven UAT plus the 2 UAT-discovered findings, then re-run all three phases' UAT scoreboards to clear Phase 067.2 + Phase 067.3 + Phase 067.4 closure gates together. Five scoped issues: (a) **R-3** suggestion pills not emitted to SSE for Fahed-Mrad search-only prompts — fix branches by uvicorn-stdout evidence (Plan 04 instrumentation at `backend/app/api/threads.py:2487-2526`); narrow exception classes; bump `max_completion_tokens` 200→2000 in `backend/app/services/suggestion_service.py:75/92` (the 800 retest was disconfirmed live; 2000 is empirically the floor for `gpt-5.4-mini` reasoning-token consumption); always emit `suggestions` event even when `questions=[]` (D-067.4-R3-02); wrap `generate_suggestions` in `run_in_threadpool` to close the pre-existing CLAUDE.md D-v2.5-01 violation (D-067.4-R3-03); (b) **R-4** active-thread UI freezes at tool-execution stage — surgical handler audit in `frontend/src/hooks/useMessages.ts` (research static-audit shows all 21 factory handlers ARE bucket-targeted post-R-1; ship the regression vitest as cheap insurance regardless of whether freeze reproduces); (c) **R-5** code-execution progress shown only as a spinner — additive UX via heartbeat `code_executing` SSE event emitted ~once per second from the existing `sandbox_queue` drain loop (D-067.4-R5-01 amended from line-by-line because `InteractiveSandboxSession` does not fire `on_stdout`/`on_stderr` callbacks during execution; line-by-line deferred with re-open trigger when llm-sandbox releases interactive streaming or session-state persistence is dropped); (d) **NR-067.2-11/12** OpenRouter provider-class synthetic-timeout regression — `LLM_CALL_TIMEOUT_OVERRIDES=<openrouter_model>=10` produces clean cancellation format (NOT `GeneratorExit`); model identifiers are representative-not-literal (read two distinct OpenRouter ids from `MODEL_CAPABILITIES` registry at execute time); (e) **Plan 05 closing UAT** `autonomous: false`, scoreboard mirroring back into BOTH 067.2-HUMAN-UAT.md AND 067.3-HUMAN-UAT.md AND 067.4's own 067.4-HUMAN-UAT.md — closes all three phases together when the strict 12/12 GREEN gate is met. Verified by: 067.4-HUMAN-UAT.md 12/12 GREEN with R-1/R-2/R-2-IDOR/067.2-5/N-01 protection regression spot-checks PASSING; frontmatter `status: closed` flipped on all three phase UAT files; STATE.md `Recent Completed Phases` adds entries for 067.2, 067.3, 067.4 in one commit.

- [ ] **STREAM-04-correctness-round2**: Following STREAM-04-correctness, close the 3 RED rows + 1 HIGH new finding from Phase 067.2's user-driven UAT (per `.planning/phases/067.2-streaming-render-and-storage-fixes/067.2-06-SUMMARY.md`): (a) cross-thread switch mid-stream preserves the streamed-into thread's render via a per-thread streaming cache (the deeper refactor that CONTEXT.md `### D-067.2-04` flagged out-of-scope for 067.2); (b) sandbox output downloads work via real browser `<a href>` clicks (the `/sandbox-outputs/{path}` endpoint must accept either a token-in-URL signed JWT in `?token=<jwt>` query param OR be replaced by a JS blob fetch+download flow — design fork resolved in `/gsd:discuss-phase 067.3`); (c) confidence + suggestions render with parity (suggestion pills visibly render alongside the confidence indicator on a Fahed-Mrad search-only prompt — investigate post-`done` emit at `threads.py:2477` and frontend gate before patching); (d) model→provider router auto-resolves from `MODEL_CAPABILITIES[model]["provider"]` when `body.provider` is unset, falling back to `user_settings.active_provider` only if the registry lacks the entry — fixes the HIGH-severity router bug at `backend/app/api/threads.py:949` (repro: run `6eab949f-78da-4ea4-ac01-f04b16c9be7d`, Anthropic model + openai default → 404 from OpenAI SDK). Phase 067.3 closes alongside Phase 067.2 by re-ticking 067.2's deferred UAT rows 5, 11, 12 and turning RED rows 3, 4, 6 green. Verified by: re-running `067.2-HUMAN-UAT.md` after fixes land + a new `067.3-HUMAN-UAT.md` with R-1/R-2/R-3/N-01 evidence rows; both scoreboards must show 12/12 GREEN (or explicit `n/a — provider unconfigured` for unreachable providers per the Phase 067.2 multi-provider availability rule).

- [ ] **STREAM-04-correctness**: Following STREAM-04 + STREAM-04-polish, the streaming-render and persistence pipeline meets the lived-experience contract that STREAM-04-polish's DOM-observer-based UAT did not actually verify. Specifically: (a) submitting a multi-step prompt on a NEW thread (no pre-existing thread.id) renders assistant content progressively delta-by-delta in the UI, NOT empty-until-end-of-run with a lump-replace at run-finish; (b) F5 mid-stream reloads the page and continues streaming with no blank-state period (replay-and-tail per Phase 062 contract delivers events into UI state); (c) navigating Thread A → Thread B → back to Thread A mid-stream shows content present and continuing; (d) confidence indicators and follow-up suggestions are visible in the assistant message UI when the agent emits them; (e) chat titles generate from the first user message regardless of run outcome (success / failure / timeout / cancellation), so failed-run sidebar entries are not stuck as "New Chat"; (f) sandbox output download URLs (docx, png, etc.) remain clickable in chat history beyond 1 hour after generation — no `InvalidJWT` errors from short-TTL signed URLs; (g) Plan 01 Track A drain-into-queue helper produces clean LangSmith traces and Plan 03 multi-step SYSTEM_PROMPT executes the full pipeline across 4 additional providers (Anthropic claude-opus-4-6, claude-sonnet-4-6, OpenRouter Kimi 2.5, OpenRouter MiniMax 2.7), not just gpt-5.4. Verified by: user-driven UAT scoreboard with 12 checkboxes (no DOM-observer proxies, no test-passes-as-acceptance), all 12 GREEN before phase marked complete. Implementation: synchronous `setViewingThread` ref-alignment in `ChatArea.tsx` (closes the `guardedSetMessages` race for both sendMessage and reconcile paths); hoist auto-title generation in `threads.py` from end-of-run to right after first user message persists; replace `create_signed_url(path, 3600)` in `sandbox_service.py:138` with on-demand re-sign endpoint at `GET /sandbox-outputs/{path:path}`; verify-or-add render blocks for `message.confidence` + `message.suggestions` in `MessageItem.tsx`; live UAT against 4 additional models for synthetic-timeout + multi-step contracts.

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
| STREAM-02b | Phase 063 (subsumed by STREAM-04) | Complete |
| STREAM-04 | Phases 061 + 062 + 063 | Complete |
| STREAM-04-polish | Phase 067.1 (sub-phase of Phase 067) | Complete |
| STREAM-04-correctness | Phase 067.2 (sub-phase of Phase 067) | Pending |
| STREAM-04-correctness-round2 | Phase 067.3 (sub-phase of Phase 067; escalated from 067.2 UAT Branch B) | Pending |
| STREAM-04-correctness-round3 | Phase 067.4 (sub-phase of Phase 067; closes 067.2 + 067.3 + 067.4 together via cross-phase 12/12 GREEN gate per D-067.4-CLOSURE-01) | Pending |
| TEST-01 | Phase 064 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
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
