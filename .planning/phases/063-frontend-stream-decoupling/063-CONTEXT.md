---
phase: 063
phase_name: frontend-stream-decoupling
date: 2026-05-03
gathered_via: discuss-phase
---

# Phase 063: Frontend Stream Decoupling — Context

## Domain

Rewire the frontend so the assistant-message stream lives independently of the POST request that started it. On every (re)connect, the frontend reconciles state via Phase 062's `active-runs` and reattaches to the replay-and-tail endpoint. Refresh-mid-stream, navigate-away-and-back, bfcache restore, and multi-tab sync all work as a side-effect.

This phase is the user-visible payoff for the v2.5 architecture (Phases 058–062). Without it, the run-backed buffer in Redis exists but the UI cannot exploit it.

## Boundaries

**In scope (Phase 063):**
- Backend: rewrite `POST /threads/{thread_id}/messages` to return `{message_id, run_id}` synchronously (no SSE on POST)
- Backend: delete the legacy SSE-on-POST code path entirely (per ROADMAP risk note: "don't keep two streaming code paths longer than one phase")
- Frontend: `useMessages` hook + `streamMessage` API function rewritten to use POST→`run_id`, then GET `/runs/{run_id}/stream?since=0`
- Frontend: reconciliation hook fires on `mount`, `focus`, `visibilitychange`, `pageshow` — queries `/threads/{thread_id}/active-runs` and reattaches to any in-flight run
- Frontend: Stop button calls `DELETE /runs/{run_id}` (replaces `AbortController.abort()` for cancellation)
- Frontend: Resume button surfaces on failed runs (per SC#7)
- Test coverage for refresh-mid-stream, multi-tab sync, Stop cross-tab, navigate-mid-stream

**Not in scope (deferred):**
- Browser MCP regression harness (Phase 064)
- Skills test infrastructure repair (Phase 065)
- `messages.confidence_*` columns being all NULL — separate behavioral bug, file scoped to a backlog item
- POST `/threads` and other non-streaming endpoints — only `/threads/{tid}/messages` changes

## Canonical Refs (MUST READ before planning)

- `.planning/ROADMAP.md` — Phase 063 success criteria + risks/pitfalls (lines 251–272)
- `.planning/PROJECT.md` — v2.5 architecture decisions (D-v2.5-01..10), key invariants
- `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — D-061-15 (producer survives consumer disconnect), D-061-11 (RUN_TASKS lifecycle)
- `.planning/phases/062-replay-tail-api/062-CONTEXT.md` — D-062-02..16 (active-runs filter, replay-tail consumer, DELETE cancel verb, cross-user 404, Redis-down 503)
- `.planning/phases/062-replay-tail-api/062-VERIFICATION.md` — what 062 proved + the 5 still-pending HUMAN-UAT items 063 can close
- `backend/app/api/threads.py:727-2244` — current `send_message` legacy POST handler (TO BE REWRITTEN — most of agent_runner stays, only the SSE return changes)
- `backend/app/api/runs.py` — Phase 062 endpoints frontend will consume
- `backend/app/api/threads.py:331-426` — module-level `event_consumer` (legacy SSE consumer used by POST stream — TO BE DELETED after migration; replaced by `replay_tail_consumer` in `runs.py`)
- `frontend/src/hooks/useMessages.ts` — entire file rewritten
- `frontend/src/lib/api.ts:97-...` — `streamMessage` rewritten

## Code Context

**Reusable assets:**
- Phase 062 endpoints (`/threads/{tid}/active-runs`, `/runs/{rid}/stream?since=N`, `DELETE /runs/{rid}`) are LIVE and tested against real Redis
- Backend `agent_runner` task body, `_emit`, `_emit_terminal`, `_shielded_finalize`, `RUN_TASKS` registry — all stay; only the response shape of `send_message` changes
- Frontend `AbortController` pattern stays for the `loadMessages` cancellation (D-060-11) — only the streaming abort flow changes
- Shadcn UI Button component for Resume button affordance

**Patterns to follow:**
- D-v2.5-01: `run_in_threadpool` for blocking supabase-py calls in async handlers
- D-v2.5-05: Never auto-retry LLM calls — Resume button only, explicit user intent
- D-v2.5-06: AbortController cancellation for fetch races (still applies to non-streaming fetches like `loadMessages`)
- D-061-15: Producer survives consumer disconnect — preserved by leaving `agent_runner` task structure unchanged
- D-062-12: Cross-user → 404 (not 403) — preserved automatically; 062 endpoints already enforce this

**Files that should NOT change (D-v2.5-08 / D-061 invariants):**
- `agent_runner` body (LLM streaming loop, tool calling, persistence, finalizer)
- `RUN_TASKS` registry semantics
- `_shielded_finalize` ordering (sentinel → UPDATE → EXPIRE → ZREM → pop)
- Phase 062 `runs.py` module (it's the contract this phase consumes)

## Decisions

### D-063-01: Hard cutover (POST contract change)

**Decision:** Rewrite `POST /threads/{thread_id}/messages` to return `{message_id, run_id}` synchronously (HTTP 201). Delete the legacy SSE-on-POST code path (`return EventSourceResponse(event_consumer(...))` at threads.py:2241-2244 + the `event_consumer` generator function at threads.py:331-426). Frontend uses `GET /runs/{run_id}/stream` exclusively for token streaming.

**Rationale:** ROADMAP risk note explicitly: "Don't keep two streaming code paths (legacy POST-streams + new run-stream) longer than one phase — choose one, deprecate the other, delete dead code in this phase." Single-developer dev project, no external API consumers, no backwards compatibility shim needed. Cleanest possible architecture.

**Implications:**
- The `event_consumer` generator at threads.py:331-426 becomes dead code → delete it
- Tests that exercise the legacy POST-streaming path either get rewritten to the new contract or deleted (cannot keep them — they exercise removed code)
- Backend integration tests under `backend/tests/integration/test_058_*`, `test_059_*`, `test_061_*` may have references to the SSE-on-POST contract — audit and update during execution

### D-063-02: Always `since=0` for reattach

**Decision:** Frontend always opens `GET /runs/{run_id}/stream?since=0` on every (re)attach. No client-side offset persistence (no localStorage, no sessionStorage). The replay is full and idempotent — `setMessages` with identical content is a no-op for React reconciliation.

**Rationale:** Phase 062 testing showed full replay completes in 152ms for 95 events (typical assistant message). Implementation cost of offset persistence (per-run localStorage entry, eviction on TTL expiry, cross-tab race on offset writes) is not justified by the marginal speedup. Matches ChatGPT/Claude.ai recovery semantics (also full-replay).

**Implications:**
- Frontend state model: assistant message content is fully derivable from the SSE stream, never partially-persisted to localStorage
- No "stream cursor" state to invalidate or migrate
- Reconnect logic is uniform across all triggers (mount, focus, visibilitychange, pageshow, bfcache)

### D-063-03: Server-only Stop semantics

**Decision:** Stop button calls `DELETE /runs/{run_id}` only — no client-side `AbortController.abort()` on the SSE subscription. The server cancels the producer task; the terminal `cancelled` event propagates via Redis Stream to all attached consumers (this tab + other tabs); all SSE subscriptions close cleanly when they receive the terminal event per Phase 062's `TERMINAL_TYPES` break logic.

**Rationale:** Aligned with SC#5 (Stop sends DELETE). Single source of truth for run lifecycle (server). Cross-tab Stop works automatically — no state synchronization needed across tabs. Matches Claude.ai/ChatGPT semantics. The client SSE subscription closes naturally when the terminal sentinel arrives.

**Implications:**
- The existing `abortStream`/`stopStreaming` Frontend functions are repurposed: instead of `AbortController.abort()` on the streamMessage fetch, they fire `fetch('/runs/{rid}', {method: 'DELETE'})` and await the terminal event
- AbortController stays for the GET stream subscription itself ONLY for genuine timeout cases (e.g., user navigates away — close the open SSE without cancelling the run)
- D-062-08..11 zombie-heal protocol on the backend handles the case where a Stop arrives after the producer already terminated (idempotent → 204)

### D-063-04: Resume button only on failed runs (no auto-retry)

**Decision:** When `active-runs` returns a run with `status: 'failed'`, the frontend surfaces a Resume button on the assistant message bubble. Clicking it re-POSTs the original user message via the new `POST /threads/{tid}/messages` contract (gets a fresh `run_id`, opens a fresh stream). No automatic retry.

**Rationale:** SC#7 + D-v2.5-05 explicit-intent principle: never auto-retry LLM calls (costs money, may duplicate). User stays in control of paid retries. Avoids hidden cost surprises.

**Implications:**
- The "original user message" must be retrievable when the assistant message is rendered — already true since both are in the messages table linked by thread_id + ordering
- Resume button visible only when the corresponding `runs.status = 'failed'` (not `streaming`, not `completed`, not `cancelled`)
- For `cancelled` runs (user clicked Stop), no Resume button — user can manually re-send if they want
- For long-stalled `streaming` runs (producer alive but no events for a long time), no Resume button — Phase 061 hard timeout (D-061-01) eventually transitions them to `failed` then Resume becomes available

## Carrying Forward From Earlier Phases

- **D-v2.5-01** (run_in_threadpool for blocking supabase-py in async handlers) — applies to the rewritten POST handler if it does any blocking I/O
- **D-v2.5-02** (single uvicorn worker) — unchanged
- **D-v2.5-05** (no auto-retry on LLM failures) — directly informs D-063-04
- **D-v2.5-06** (AbortController for fetch race conditions) — preserved for `loadMessages`; superseded by DELETE for streaming cancellation
- **D-v2.5-08** (producer survives consumer disconnect) — preserved by leaving `agent_runner` task structure intact
- **D-061-11** (RUN_TASKS registry, lifespan cancels all on shutdown) — preserved
- **D-061-15** (producer-consumer contract inversion) — preserved
- **D-062-02..16** (Phase 062 endpoint contracts) — these are the dependencies this phase consumes

## Reconciliation Hook Ordering (per ROADMAP risk note)

> "active-runs must be queried on the client *before* loadMessages settles, otherwise the local message list will appear missing the in-flight assistant message until the next reconcile tick."

**Implementation guidance for planner:**

On chat thread mount (selecting a thread or initial page load with a saved active thread):
1. Fire `GET /threads/{thread_id}/active-runs` AND `GET /threads/{thread_id}/messages` in parallel (both via `Promise.all`)
2. When `messages` resolves, render them as-is
3. When `active-runs` resolves with a non-empty list, for each active run:
   a. Synthesize a placeholder assistant message in the local state (matches the assistant message that the producer will eventually persist; reuse the temp-id pattern in `useMessages.ts`)
   b. Open `GET /runs/{run_id}/stream?since=0` and append received deltas to the placeholder
   c. On terminal event, replace placeholder with the canonical persisted assistant message (re-fetch `loadMessages` once, OR just clear the placeholder when the persisted message arrives via Realtime)

For `visibilitychange` / `focus` / `pageshow` triggers: same flow but without re-rendering messages — only the active-runs check + reattach if found.

## Multi-Tab Sync (SC#4 — falls out for free)

Phase 062 already supports multi-consumer fan-out (verified by `test_062_multi_consumer_fanout.py`). Phase 063 inherits this — two tabs both opening `GET /runs/{rid}/stream?since=0` both receive identical event sequences. No frontend dedupe needed; React's `setMessages` with identical content is a no-op. SC#4 is satisfied as a side-effect.

## bfcache Handling (per ROADMAP risk note)

> "pageshow fires on bfcache restore — the local buffer may be hours stale. Treat bfcache restore as 'always reconcile via active-runs,' even if local state looks complete."

**Implementation guidance for planner:** Hook the reconciliation logic to `pageshow` event with `event.persisted === true` check; on bfcache restore, ALWAYS run the active-runs check + reattach flow regardless of local state. Treat the local React state as untrusted.

## Deferred Ideas

None surfaced in this discussion. The phase scope is tight and the ROADMAP success criteria + risks already enumerate the relevant decisions.
