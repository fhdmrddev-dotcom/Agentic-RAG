<!-- refreshed: 2026-05-09 -->
# Architecture

**Analysis Date:** 2026-05-09

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                Browser (React 19 + Vite + Tailwind)                  │
│                                                                      │
│   ChatArea / ChatLayout    Pages (Auth/Settings/Skills/Health/       │
│   `frontend/src/`            Ingestion)                              │
│   components/chat/         `frontend/src/pages/`                     │
│                                                                      │
│   useMessages (per-thread bucket store, run subscriptions)           │
│   `frontend/src/hooks/useMessages.ts`                                │
└─────────┬──────────────────────────────────┬─────────────────────────┘
          │ POST /threads/{id}/messages      │ GET /runs/{id}/stream
          │ → JSON {message_id, run_id}      │ → SSE replay-and-tail
          ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│              FastAPI Backend (single uvicorn worker)                 │
│              `backend/app/main.py`                                   │
│                                                                      │
│   Routers          Services                  Utilities               │
│   `backend/app/    `backend/app/             `backend/app/           │
│    api/`            services/`                utils/db.py` (aexec)   │
│                                                                      │
│   Producer (agent_runner) ──► Redis Stream ◄── Consumer (SSE)        │
│   `threads.py:1059`           `run:{run_id}`   `runs.py:80`          │
└────┬───────────────────┬────────────────────────────┬────────────────┘
     │ supabase-py       │ OpenAI / Anthropic SDK     │ redis.asyncio
     │ (sync, wrapped    │ + LangSmith tracing        │
     │  via aexec)       │                            │
     ▼                   ▼                            ▼
┌─────────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
│  Supabase Postgres  │ │   LLM Providers    │ │   Redis (run-buffer) │
│  pgvector + RLS +   │ │   OpenAI / Anth.   │ │   Streams + sorted   │
│  Storage + Realtime │ │   / Google /       │ │   sets + TTL         │
│                     │ │   OpenRouter /     │ │                      │
│  `supabase/         │ │   Ollama           │ │   `docker-compose.   │
│   full-schema.sql`  │ │                    │ │    dev.yml`          │
│                     │ │  + Docker          │ │                      │
│                     │ │  `llm-sandbox`     │ │                      │
│                     │ │  for execute_code  │ │                      │
└─────────────────────┘ └────────────────────┘ └──────────────────────┘
```

All frontend API calls include a Supabase JWT in `Authorization: Bearer <token>`. The backend validates tokens via `supabase.auth.get_user(token)` in `backend/app/dependencies.py:47-58` using a service-role client (bypasses RLS — the backend enforces ownership via `.eq("user_id", current_user["id"])` filters on every query). RLS still protects direct client-side Supabase queries (Auth, Realtime, Storage) and is the canonical authorization layer for global-vs-private folders/skills.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| FastAPI app | Mounts routers, configures CORS, lifespan startup/shutdown (Redis ping, AnyIO thread tokens, sandbox cleanup, RUN_TASKS cancellation) | `backend/app/main.py` |
| `threads` router | Thread CRUD + `POST /threads/{id}/messages` (spawns producer task, returns `{message_id, run_id}`) + `GET /threads/{id}/active-runs` | `backend/app/api/threads.py` |
| `runs` router | `GET /runs/{run_id}/stream?since=N` (replay-and-tail consumer) and `DELETE /runs/{run_id}` (cancel verb — happy/zombie/terminal paths) | `backend/app/api/runs.py` |
| `documents` router | Upload + ingestion pipeline + version management + reingest | `backend/app/api/documents.py` |
| `kb` router | Knowledge-base tools (`ls`, `tree`, `grep`, `glob`, `read`) — also reused by the LLM tool-dispatch path inside threads.py | `backend/app/api/kb.py` |
| `skills` router | Skill CRUD + ZIP import/export + skill_files | `backend/app/api/skills.py` |
| `feedback` router | Thumbs up/down ratings (INSERT-only) + feedback stats | `backend/app/api/feedback.py` |
| `audit` router | Audit log query + CSV export | `backend/app/api/audit.py` |
| `knowledge_health` router | 4-signal library-health metrics (most-retrieved, never-retrieved, low-confidence, stale) | `backend/app/api/knowledge_health.py` |
| `sandbox_outputs` router | Signed-URL download for sandbox-generated files (Phase 067.4) | `backend/app/api/sandbox_outputs.py` |
| `settings` router | Settings persistence (`user_settings`, `app_settings`) | `backend/app/api/settings.py` |
| `folders` router | Folder CRUD + global toggle | `backend/app/api/folders.py` |
| `test_fixtures` router | E2E harness fixture endpoints (gated by `ENABLE_TEST_FIXTURES=1`) | `backend/app/api/test_fixtures.py` |
| Producer (`agent_runner`) | Runs the LLM tool-dispatch loop and `XADD`s every SSE event to `run:{run_id}`. Lifetime decoupled from the SSE consumer. | `backend/app/api/threads.py:1059` |
| Consumer (`replay_tail_consumer`) | Two-mode `XREAD` from `run:{run_id}` — replay backlog from `since`, then live-tail with `BLOCK 5000`. Wraps in `EventSourceResponse`. | `backend/app/api/runs.py:80` |
| LLM service layer | OpenAI-compatible streaming, Anthropic native SDK, structured tool-call parser, sub-agent wrapper, retrieval, web search, SQL, embeddings, multimodal, reranking, suggestions | `backend/app/services/` |
| Sandbox manager | Lazy `llm-sandbox` import, per-thread Docker session TTL, `harvest_output_files` to Storage, lifespan close-all | `backend/app/services/sandbox_service.py` |
| `aexec` helper | `await aexec(query)` runs sync supabase-py `.execute()` off the event loop via `run_in_threadpool` (D-v2.5-01) | `backend/app/utils/db.py:32` |
| `useMessages` hook | Per-thread `messagesByThread` Map, run subscriptions, `lastSeenOffsetRef` cursor, AbortController cancel of GET stream, `reconcile` on (re)connect, `resumeFromFailed` | `frontend/src/hooks/useMessages.ts` |
| `ChatArea` | Wires thread switching → `setViewingThread` + `clearMessages` + reconcile-via-ref on visibilitychange/focus/pageshow/mount | `frontend/src/components/chat/ChatArea.tsx` |
| `subscribeToRun` | SSE parser for `GET /runs/{id}/stream` — dispatches typed events to `StreamCallbacks`, exposes Redis Stream entry id via `onCursor` for cursor advancement | `frontend/src/lib/api.ts:274` |

## Pattern Overview

**Overall:** Layered FastAPI service + React SPA with **decoupled producer/consumer streaming** (Phase 061: D-v2.5-08). The HTTP request that posts a chat message returns immediately with `{message_id, run_id}`; a separate `GET /runs/{id}/stream?since=N` request consumes the SSE event buffer from Redis Streams. The producer task's lifetime is independent of any HTTP request — disconnect, refresh, or multi-tab access all attach/reattach to the same buffer.

**Key Characteristics:**
- **Run-backed streaming via Redis Streams** — every SSE event is `XADD`-ed to `run:{run_id}` (MAXLEN ~10000, ~10 min TTL). Multiple consumers can `XREAD` non-destructively from the same stream — the foundation for multi-tab sync, navigate-away, and refresh-mid-stream working without manual F5.
- **Stateless chat completions** — no provider-side thread state. Full message history is reconstructed from `messages` table on every request and trimmed to fit per-provider context budgets in `services/context_window.py`.
- **No LangChain / LangGraph** — raw provider SDK calls only. `services/openai_service.py` (OpenAI-compatible) and `services/anthropic_service.py` (native Anthropic SDK) implement parallel streaming paths, both feeding `_drain_stream_with_close_on_cancel` (`threads.py:158`) which decouples the sync provider stream from the async event loop.
- **Per-LLM-call adaptive timeouts (Phase 066, D-066-01..03)** — no total-deadline cap on the agent loop. Each LLM call has its own `asyncio.timeout(per_call_budget)` wrapper inside the iteration loop; tool execution is OUTSIDE the timer (tools own their own discipline). Per-model budgets via `MODEL_CAPABILITIES[model]['llm_call_timeout_seconds']` in `config.py`.
- **Single uvicorn worker (D-v2.5-02)** — concurrency comes from asyncio + threadpool, NOT process workers. `RUN_TASKS` registry, `_BACKGROUND_TASKS` set, and sandbox session manager are in-process state that would break under multi-worker.
- **Async sync-wrapping discipline (D-v2.5-01)** — every supabase-py `.execute()` call goes through `aexec()` (`utils/db.py:32`); blocking sandbox / SDK / SQL paths use `run_in_threadpool`. AnyIO default thread tokens bumped to `settings.anyio_thread_tokens` at startup (`main.py:59`) so the SSE-path doesn't queue at the 40-token default.
- **Row-Level Security as the durable boundary** — every user-facing table has an RLS policy in `supabase/full-schema.sql` keyed on `auth.uid() = user_id`, plus `runs_select_own` (line 1493) for the v2.5 runs table. Global folders/skills are the only shared scope, surfaced via `folder_is_globally_visible(uuid)` SECURITY DEFINER function and `is_global` flags.
- **Realtime is best-effort hint, not source of truth (D-v2.5-03)** — frontend always reconciles via fetch on (re)connect. `useMessages.reconcile()` runs `getActiveRuns(threadId) || loadMessages(threadId)` in parallel on every mount/visibilitychange/focus/pageshow.
- **Strict-mode-safe React state** — every per-event `setMessages` is bucket-targeted via `setMessagesForThread(threadId, updater)`; ChatArea's reconcile listener routes through `reconcileRef.current` to avoid effect-recreate-mid-stream tearing.

## Layers

**Frontend — `frontend/src/`:**
- Purpose: Browser UI for chat, ingestion, skills, knowledge-health, settings.
- Location: `frontend/src/`
- Contains: React 19 components, Vite build, Tailwind + shadcn/ui Aether Intelligence design system (Deep Midnight theme), TanStack Query for server-cache, custom hooks for stateful flows.
- Depends on: Supabase JS SDK (auth + Realtime), `lib/api.ts` (REST + SSE wire), Lucide icons, `react-markdown`, `recharts`.
- Used by: Browser. Talks to FastAPI over CORS-enabled HTTP/SSE.

**FastAPI Routers — `backend/app/api/`:**
- Purpose: HTTP/SSE surface; authentication; per-route ownership enforcement.
- Location: `backend/app/api/`
- Contains: One module per resource family (`threads`, `runs`, `documents`, `kb`, `skills`, `audit`, `feedback`, `knowledge_health`, `folders`, `sandbox_outputs`, `settings`, `test_fixtures`).
- Depends on: `services/`, `models/`, `utils/db.py`, `dependencies.py`.
- Used by: FastAPI app in `main.py` (mounted in order at lines 138–148).

**Service Layer — `backend/app/services/`:**
- Purpose: LLM + tool integrations + retrieval + sandboxing + observability.
- Location: `backend/app/services/`
- Contains: Provider-specific SDK adapters (`openai_service.py`, `anthropic_service.py`), retrieval (`retrieval_service.py`), sub-agent (`sub_agent_service.py`), sandbox (`sandbox_service.py`), web search (`web_search_service.py`), SQL tool (`sql_service.py`), embedding (`embedding_service.py`), reranking (`rerank_service.py`), suggestions (`suggestion_service.py`), context window trimming (`context_window.py`), multimodal (`multimodal_service.py`), tool parser (`tool_parser.py`), audit (`audit_service.py`).
- Depends on: External SDKs + supabase-py.
- Used by: Routers (especially `threads.py`).

**Models — `backend/app/models/`:**
- Purpose: Pydantic types for request/response bodies and database row shapes.
- Location: `backend/app/models/`
- Contains: `document.py`, `folder.py`, `kb.py`, `message.py`, `run.py`, `skill.py`, `thread.py`, `user_settings.py`.
- Depends on: Pydantic.
- Used by: Routers (request/response models) + services where structured outputs are coerced.

**Utils — `backend/app/utils/`:**
- Purpose: Cross-cutting helpers.
- Location: `backend/app/utils/`
- Contains: `db.py` (the `aexec` async-exec wrapper around supabase-py — Phase 058 D-058-03), `folder_utils.py` (visible-folder fetch + subtree resolution).
- Depends on: starlette.concurrency, supabase-py.
- Used by: Routers + services.

**Database / Storage — Supabase:**
- Purpose: Authoritative storage. Postgres + pgvector for documents/chunks; Supabase Storage for files; Auth for JWT; Realtime for ingestion-status hints (best-effort only).
- Location: `supabase/migrations/` (numbered SQL — currently 001 → 038), `supabase/full-schema.sql` (regenerated from live DB; deploy artifact).
- Contains: 24 tables with RLS, ~10 RPC functions, partial indexes, generated columns, triggers.
- Depends on: pgvector extension.
- Used by: All backend modules (via `dependencies.get_supabase()`).

**Run Buffer — Redis:**
- Purpose: Ephemeral per-run SSE event buffer for the producer/consumer split. No schema, no migrations — keys created on first write.
- Location: `docker-compose.dev.yml` at repo root (local), Upstash `rediss://` URL (cloud).
- Contains: `run:{run_id}` (Redis Stream — events), `runs_by_thread:{thread_id}` (sorted set — active runs per thread), `runs:active` (sorted set — all currently-streaming run_ids), `run:{run_id}:cancel_lock` (SETNX cancel-lock for zombie-heal idempotency).
- Depends on: redis-py async client.
- Used by: `threads.py` (producer), `runs.py` (consumer + DELETE).

**Sandbox — Docker / `llm-sandbox`:**
- Purpose: Isolated Python execution for the `execute_code` tool. Per-thread session with TTL eviction.
- Location: `backend/app/services/sandbox_service.py` (lazy import — module is gated by `SANDBOX_ENABLED=true`).
- Contains: `sandbox_manager` (singleton), `harvest_output_files` (copies container output to `sandbox-outputs` Storage bucket, signs URLs).
- Used by: `threads.py` `execute_code` tool dispatch + `sandbox_outputs.py` for signed-URL download (Phase 067.4).

## Data Flow

### Run-Backed Streaming Flow (Phase 061 → 067.5 — the v2.5 architectural shift)

This is the most important flow in the codebase. The core decoupling pattern: **the HTTP request that initiates a run has nothing to do with the HTTP request that consumes the SSE events**.

**1. POST /threads/{thread_id}/messages — `threads.py:875` (`send_message`)**

   a. Validate thread ownership (line 883) and INSERT user message row, capturing `_user_msg_id` (line 905).
   b. Resolve provider via `body.provider` → `MODEL_CAPABILITIES[model]['provider']` → `active_provider` chain (line 957) — the model→provider router (D-067.3-N01).
   c. Generate fresh `run_id = uuid4()` (line 948); INSERT `runs` row with `status='streaming'`, model, provider (line 974); `ZADD` to `runs_by_thread:{tid}` and `runs:active` sorted sets (line 990).
   d. Auto-generate thread title from first user message if `title='New Chat'` (line 1020) — fires BEFORE producer spawn so title persists regardless of run outcome.
   e. Spawn `agent_runner(run_id)` as `asyncio.create_task` (line 2698); register in `RUN_TASKS[run_id]` registry; attach done-callback to self-evict.
   f. Return `JSONResponse(201, {"message_id": _user_msg_id, "run_id": run_id})` (line 2719). **The agent runs in the background.**

**2. agent_runner producer — `threads.py:1059` (function defined inline inside `send_message`)**

   a. Outer `try`/`finally` — finally is shielded (Phase 061 Plan 03 Task 3) and runs the 5-step finalize: terminal sentinel → `runs` UPDATE → Redis `EXPIRE 60` → ZREM × 2 → RUN_TASKS.pop.
   b. Per-iteration loop (max_iterations=15 in General mode, 8 in Explorer):
      - Update `_last_iteration` / `_last_model_id` / `_last_per_call_budget` BEFORE the SDK call so the outer except can build a meaningful `timed_out` error string (D-066-07).
      - Resolve `per_call_budget` from `MODEL_CAPABILITIES` (default 180s for unknown models).
      - Anthropic native path (~line 1149) or OpenAI/Google/OpenRouter path (~line 1213): `async with asyncio.timeout(per_call_budget)` + `_drain_stream_with_close_on_cancel(stream, ...)` — drains the sync SDK stream from a thread executor, with explicit `close_fn` so timeout cancellation closes the SDK stream from the OUTSIDE (avoids `langsmith._TracedStream.__iter__` recording `error=GeneratorExit` — Phase 067.1 Track A).
      - On every chunk, `await _emit(redis, run_id, type, **fields)` → `XADD run:{run_id} {data: json}` with MAXLEN ~10000.
      - Tool calls dispatched via in-module handlers; results round-trip into the next iteration as `tool` role messages.
      - `code_executing` heartbeat events (~every 1s during sandbox execution) emitted by sandbox dispatch (Phase 067.4 R-5).
   c. On natural completion: persist assistant message to `messages` (with citations, source_refs, confidence, suggestions); emit `done`, then `suggestions`, then `stream_end` (terminal sentinel).
   d. On `asyncio.CancelledError` (DELETE /runs/{rid} fired): set `_terminal_status='cancelled'`; finally writes terminal `cancelled` sentinel.
   e. On per-call `asyncio.TimeoutError`: set `_terminal_status='timed_out'`; finally writes `timed_out` sentinel with iteration/model context (D-066-06/07).
   f. On other exception: set `_terminal_status='failed'`; finally writes `error` sentinel.
   g. The 5-step finalize translates `runs.status` → SSE TERMINAL_TYPES via `_RUN_STATUS_TO_TERMINAL_TYPE` (line 95) and writes the terminal sentinel through `_emit_terminal` (which is exempt from MAXLEN trimming — Pitfall 5).

**3. GET /runs/{run_id}/stream?since={offset} — `runs.py:331` (`stream_run`)**

   a. Ownership SELECT on `runs` row via `aexec(...).maybe_single()` (line 342). 404 (NOT 403) on miss to avoid existence leak (T-062-01, D-062-12).
   b. Bounded Redis health probe `await asyncio.wait_for(redis.exists(...), timeout=2.0)`. On `RedisError`/timeout: 503 + `Retry-After: 10`.
   c. If buffer exists → return `EventSourceResponse(replay_tail_consumer(redis, run_id, since, settings))`.
   d. If buffer TTL-expired → return `EventSourceResponse(_synthetic_terminal_generator(runs.status, runs.error))` — emits ONE terminal SSE event mapped from the durable `runs` row.

**4. replay_tail_consumer — `runs.py:80`**

   a. Phase 1 (replay): `XREAD streams={key: since} count=100` in a loop until empty. For each entry, advance `last_id`, yield `{"data": data_field}`, parse JSON, break on `payload.type ∈ TERMINAL_TYPES`.
   b. Phase 2 (live-tail): `XREAD ... block=5000`. Same dispatch. On empty result, probe `redis.exists(stream_key)` — if missing, emit synthetic `buffer_expired_during_tail` and return.
   c. Deadline guard: `monotonic() + settings.consumer_timeout_seconds` (~610s, bumped from 130s in Phase 066 to outlast `max_iterations × per_call_budget`).
   d. WR-01 invariant: never reset `last_id` to `$` between Phase 1 and Phase 2 — always carry forward, otherwise a fast producer can emit between phases and the entry is missed.
   e. `finally: pass` (D-061-03) — consumer disconnect MUST NOT cancel producer.
   f. Cancellation discipline: `asyncio.CancelledError` re-raises (cooperative); `RedisTimeoutError` (cancellation-equivalent at xread BLOCK) emits a clean SSE error and returns; other `RedisError` emits `redis_error`.

**5. DELETE /runs/{run_id} — `runs.py:421` (`cancel_run`) — the Stop verb**

   a. Ownership SELECT (404 not 403).
   b. Already-terminal (`completed`/`failed`/`cancelled`/`timed_out`) → 204 silent (idempotent, D-062-09).
   c. **Happy path** — `RUN_TASKS[run_id]` alive → `task.cancel()` → 204 immediately. Producer's CancelledError handler runs the shielded finalize asynchronously.
   d. **Zombie heal** (D-062-11) — RUN_TASKS missing but `runs.status='streaming'`: SETNX `run:{rid}:cancel_lock` (idempotency under concurrent DELETEs), UPDATE `runs.status='cancelled'`, emit synthetic `cancelled` sentinel via `_emit_terminal`, ZREM both sorted sets, EXPIRE 60. All Redis ops in independent try/except — Postgres UPDATE is the durable cancel record (T-062-03).
   e. Cross-tab Stop falls out for free — the sentinel propagates to ALL attached consumers via the same Redis Stream.

**6. Frontend consumer — `useMessages.sendMessage` (`useMessages.ts:673`) and `useMessages.reconcile` (`useMessages.ts:948`)**

   a. `sendMessage`: optimistic user + assistant placeholders inserted into `messagesByThread` Map keyed by threadId; `streamingThreadIdRef.current = threadId`; `await postMessage()` returns `{message_id, run_id}`; reserve `subscriptionsRef.set(run_id, controller)` BEFORE the runId-stamping `setMessages` (D-067-01) to short-circuit racing reconcile triggers; swap user-temp-id for real `message_id`; stamp `run_id` on placeholder; `subscribeToRun(run_id, "0", callbacks, controller.signal)` opens `GET /runs/{run_id}/stream`.
   b. `reconcile(threadId)` fires from ChatArea on mount/visibilitychange/focus/pageshow (`ChatArea.tsx:163-188` via `reconcileRef`). Body:
      - `reconcileInFlightRef` lock (D-063.1-11) — multi-tab activation fires both visibilitychange + focus in <50ms; coalesces.
      - `Promise.all([getActiveRuns(threadId), loadMessages(threadId)])` (CONTEXT.md ordering mandate).
      - For each active run: runId-match dedup against the DB-loaded messages (D-063.1-04) → re-use the persisted message id as the SSE callback target if one exists, else insert idempotent `temp-${run_id}` placeholder.
      - Skip subscribe if `subscriptionsRef.has(run_id)` (live consumer already attached); else reserve slot BEFORE `subscribeToRun` (WR-06) and pass `lastSeenOffsetRef.current.get(run_id) ?? "0"` as `since`.
   c. `subscribeToRun` parser (`api.ts:274`) emits typed events through `StreamCallbacks` (`onDelta`, `onToolPreparing`, `onToolStart`, `onToolEnd`, `onCitations`, `onConfidence`, `onSuggestions`, `onCodeExecuting`, `onIterationStart`, `onTerminal`, etc.). After every successful event dispatch, fires `onCursor(redisStreamEntryId)` so `lastSeenOffsetRef` advances (D-063.1-01/02). On `stream_end` / `error` / `cancelled` / `timed_out`, calls `onTerminal(kind, errorPayload?)` and returns.
   d. `onTerminal` → flips `runStatus` on the matching message id (existence-check guarded — D-067-02), deletes `subscriptionsRef.get(runId)`, falls back to `loadMessages(threadId)` if `errorPayload === 'buffer_expired'`.
   e. **Critical clearMessages guard (Phase 067.5 Branch D-3, `useMessages.ts:572-590`)**: ChatArea calls `clearMessages()` on every thread switch. Without the guard, switching BACK to a thread whose run is still streaming wipes the live placeholder (because `tid === streamingThreadIdRef.current`). Fix: `if (tid && tid !== streamingThreadIdRef.current) { ... delete bucket ... }`. Loaded message buckets for non-streaming threads still clear; streaming bucket is preserved through the round-trip.

**7. Stop button — `useMessages.stopStreaming` (`useMessages.ts:477`)**

   a. Find the streaming assistant message via `messagesRef.current` (latest snapshot of streaming bucket, NOT viewing bucket — D-067.3-R1-04 / Pitfall 3).
   b. `await cancelRun(runId)` → DELETE /runs/{rid} → producer cancelled server-side.
   c. The terminal `cancelled` sentinel arrives via the still-open SSE; `subscribeToRun` parses it; `onTerminal('cancelled')` flips `runStatus='cancelled'` + `stopped: true` on the placeholder. **No client-side AbortController.abort()** — that would only close the consumer-side socket; the producer would keep running until natural completion.

### Document Ingestion Flow (manual file upload only — not automated)

1. User uploads file via `IngestionPage` / `DocumentUpload` (`frontend/src/components/ingestion/DocumentUpload.tsx`).
2. `POST /documents/upload` (`backend/app/api/documents.py`) — multipart upload; Storage write to `documents` bucket; INSERT `documents` row with `status='pending'`, `ingestion_step='received'`.
3. Background ingestion task: extract (pypdf / python-docx / pdfplumber / python-pptx / openpyxl / ebooklib), chunk via sentence-boundary, embed (`services/embedding_service.py`), tables via pdfplumber, images via vision-LLM (`services/multimodal_service.py`), persist to `document_chunks` / `document_tables` / `document_images`. Updates `documents.status` and `ingestion_step` at each stage; Realtime notifies the frontend (best-effort hint, frontend reconciles via fetch).
4. SHA-256 dedup via `documents.content_hash`; new versions bump `version_number` and toggle `is_latest`.

## Key Abstractions

**Run** (Phase 061+):
- Purpose: Server-side handle for one agent invocation, decoupled from the HTTP request that started it.
- Examples: `supabase/migrations/035_runs_table.sql` (durable lifecycle), `supabase/migrations/038_runs_timed_out_status.sql` (status enum extension), `RUN_TASKS` registry at `threads.py:80`, `run:{run_id}` Redis Stream key.
- Pattern: durable Postgres lifecycle row + ephemeral Redis Stream event buffer + in-process asyncio.Task registry. Status enum: `streaming` → `{completed, failed, cancelled, timed_out}` (terminal). SSE wire types map via `_RUN_STATUS_TO_TERMINAL_TYPE` at `threads.py:95`.

**StreamCallbacks bag** (Phase 063):
- Purpose: Typed event-dispatch interface from the SSE parser to `useMessages`. Replaces the legacy POST-stream closure.
- Examples: `frontend/src/lib/api.ts` (StreamCallbacks type + `subscribeToRun` parser), `frontend/src/hooks/useMessages.ts` (`makeStreamCallbacks` factory at line 58).
- Pattern: callback factory takes a `threadId` + `assistantId` + `setMessages: ThreadBoundSetMessages` and produces the bag. Caller wraps `onTerminal` to flip `runStatus` and clean up `subscriptionsRef`. `onCursor(msId)` advances the per-run replay offset.

**Per-thread message bucket store** (Phase 067.3 D-067.3-R1-01..08):
- Purpose: Isolate cross-thread message state so a streaming run into thread A doesn't lose its render when the user navigates to thread B and back.
- Examples: `useMessages.ts:394` (`messagesByThread: Map<string, Message[]>`), `setMessagesForThread` (line 556), LRU N=5 eviction with streaming-thread pinning (`evictIfOverCapacity`, line 520).
- Pattern: state is a Map; visible `messages` is a `useMemo` derived against `viewedThreadId`; every per-event `setMessages` is bucket-targeted via threadId. The legacy single-array `messages: Message[]` is gone.

**Tool dispatch loop** (General mode = 16 tools; Explorer mode = 6 KB tools):
- Purpose: Multi-iteration agent loop that lets the LLM emit tool calls, execute them, feed results back, until the model returns a content-only response or `max_iterations` is hit.
- Examples: `threads.py` `agent_runner` (the inline closure inside `send_message`), `services/openai_service.py` (`get_tools()`, `get_explorer_tools()`, `EXPLORER_SYSTEM_PROMPT`), `services/tool_parser.py` (structured-mode JSON-in-prompt path).
- Pattern: native tool-calling for proven providers (OpenAI, Anthropic, Google) gated by `MODEL_CAPABILITIES[model]['native_tools']`; structured tool-calling (JSON-in-prompt + parser) for everything else (D-53-01/02). One-shot deterministic — no retries.

**Sub-agent (Explorer / Document analysis)**:
- Purpose: Isolated LLM context for high-stakes single-shot tasks (full-document analysis, KB exploration with synthesis).
- Examples: `backend/app/services/sub_agent_service.py`, `backend/app/api/threads.py` analyze_document tool dispatch.
- Pattern: separate model resolution (`_SUB_AGENT_MODEL_DEFAULTS`), separate context budget, content cap (~600k chars), result returns as `tool` role message.

**Skill** (Phase 10 — agentskills.io open standard):
- Purpose: User-authored / shared persistent agent capability — `SKILL.md` + attached files.
- Examples: `supabase/migrations/017_skills.sql`, `supabase/migrations/018_skill_creator_seed.sql`, `frontend/src/components/skills/SkillFormDialog.tsx`, `backend/app/api/skills.py`, `load_skill` / `save_skill` / `read_skill_file` tool dispatch in `threads.py`.
- Pattern: SKILL.md frontmatter YAML; private bucket in Supabase Storage; ZIP import/export; global vs private via RLS.

## Entry Points

**FastAPI app**:
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app --reload` (dev) — single worker only (D-v2.5-02).
- Responsibilities: postgrest 204-error patch (line 22), LangSmith env config (line 47), CORS, lifespan (Redis ping, AnyIO thread tokens, RUN_TASKS shutdown cancel, sandbox close-all), router mounting.

**React app**:
- Location: `frontend/src/main.tsx` → `frontend/src/App.tsx` → `frontend/src/components/layout/ChatLayout.tsx`.
- Triggers: `npm run dev` (Vite at localhost:5173 by default).
- Responsibilities: auth gate via `useAuth`, `TooltipProvider`, view routing between `chat` / `documents` / `skills` / `settings` / `library-health`.

**Producer task entry**:
- Location: `agent_runner` inline closure inside `send_message` at `backend/app/api/threads.py:1059`; spawned at `:2698`.
- Triggers: `POST /threads/{thread_id}/messages`.
- Responsibilities: agent loop, SSE event emission via XADD, terminal classification, shielded finalize.

**Consumer entry**:
- Location: `replay_tail_consumer` at `backend/app/api/runs.py:80`; mounted via `EventSourceResponse` in `stream_run` at `:331`.
- Triggers: `GET /runs/{run_id}/stream?since={offset}`.
- Responsibilities: replay backlog from `since`, live-tail with BLOCK 5000, terminate on TERMINAL_TYPES.

## Architectural Constraints

- **Threading:** Single-process, single-uvicorn-worker (D-v2.5-02). Concurrency comes from asyncio. Blocking I/O (supabase-py `.execute()`, sandbox Docker calls, sync provider streams, sync SQL) is offloaded via `run_in_threadpool` / `aexec` / `_drain_stream_with_close_on_cancel`. AnyIO default thread limiter is bumped to `settings.anyio_thread_tokens` at startup so the SSE-path `aexec` calls don't queue at the 40-token default (D-058-07).
- **Global state (in-process):** `_supabase` singleton (`dependencies.py:10`); `_redis` singleton (`dependencies.py:20`); `RUN_TASKS: dict[UUID, Task]` (`threads.py:80`); `_BACKGROUND_TASKS: set[Task]` (`threads.py:60`); `sandbox_manager` (lazy import in `services/sandbox_service.py`); module-level `_TTL_CACHE` for settings file (5s) in `models/user_settings.py`. **All require single-worker discipline.**
- **Stateless chat completions:** No provider-side thread state (CLAUDE.md). Full message history rebuilt from `messages` table per request and trimmed to fit per-provider context budget in `services/context_window.py`.
- **Run history persistence (D-v2.5-11):** Run lifecycle metadata persists in `public.runs` Postgres table with full RLS; Redis Stream is the ephemeral event buffer (TTL ~10 min). Active-runs API reads from Postgres; replay-and-tail reads from Redis.
- **Redis is best-effort except for the durable cancel:** Postgres `runs.status` is the source of truth; Redis ops in `cancel_run` zombie-heal each have their own try/except so DELETE returns 204 even if every Redis op fails (D-062-13).
- **Schema discipline:** Migrations are append-only numbered SQL under `supabase/migrations/`. Apply via Supabase SQL editor only — never `db push` / `db reset`. Then run `bash scripts/regenerate-full-schema.sh` to refresh `supabase/full-schema.sql`.

## Anti-Patterns

### Calling supabase-py `.execute()` directly inside an async handler

**What happens:** A `.execute()` call inside an `async def` handler blocks the asyncio event loop because supabase-py is sync (D-v2.5-01). Cross-tab GETs queue behind the streaming run.
**Why it's wrong:** The CONCUR-01 binding pytest gate (`backend/tests/integration/test_058_concurrency.py`) measures cross-tab GET latency during streaming and fails if it exceeds 1s. Direct `.execute()` regresses this from ~15ms to ~30s.
**Do this instead:** `await aexec(supabase.table(...).select(...).eq(...))` (`backend/app/utils/db.py:32`). Pass the query object (NOT a callable); `aexec` calls `.execute` on it inside the threadpool.

### Running uvicorn with `--workers N`

**What happens:** Multiple worker processes each have their own `RUN_TASKS` registry, `sandbox_manager`, `_BACKGROUND_TASKS`, settings TTL cache. A run started in worker 1 can't be cancelled by a DELETE that lands in worker 2.
**Why it's wrong:** Masks concurrency bugs and breaks all in-process state (D-v2.5-02).
**Do this instead:** Single uvicorn worker. Use asyncio + threadpool for concurrency; use Redis for cross-process coordination (the design choice for v2.5 scale).

### Treating Supabase Realtime as the source of truth for streaming state

**What happens:** Frontend listens to a Realtime INSERT on `messages` and assumes the assistant message will appear. Realtime delivery is unreliable for tab-switch and F5 mid-stream scenarios.
**Why it's wrong:** D-v2.5-03 — Realtime is a best-effort hint, not a source of truth. Failure mode is "thread looks empty until F5".
**Do this instead:** Always reconcile via fetch on (re)connect. `useMessages.reconcile()` runs `Promise.all([getActiveRuns, loadMessages])` on mount/visibilitychange/focus/pageshow.

### Cancelling the producer by aborting the consumer-side fetch

**What happens:** Frontend `controller.abort()` closes the SSE connection; the user thinks Stop worked; the LLM call keeps running on the backend until natural completion.
**Why it's wrong:** D-061-03 / D-063-03 — consumer disconnect MUST NOT cancel producer (the whole point of run-backed streaming is decoupling). Producer continues burning paid tokens.
**Do this instead:** Server-side cancel via `DELETE /runs/{run_id}` (`useMessages.stopStreaming` → `cancelRun(runId)`). The terminal `cancelled` sentinel arrives via the still-open SSE; the parser handles UI update.

### Resetting `last_id` to `$` between replay and live-tail XREAD phases

**What happens:** Phase 1 of `replay_tail_consumer` finishes; you set `last_id = "$"` to switch to live-tail; the producer XADDs an entry between Phase 1 exit and Phase 2 entry — entry is silently lost.
**Why it's wrong:** WR-01 invariant in `runs.py:80`. Multi-consumer fan-out depends on every consumer seeing every event.
**Do this instead:** Always carry `last_id` forward across phases (`runs.py:179`).

### Calling `clearMessages()` on every thread switch without checking the streaming thread

**What happens:** User starts a run on thread A, navigates to thread B, navigates back to thread A. ChatArea fires `clearMessages` on every thread.id change; without the guard, the live `temp-*` placeholder for thread A is wiped from `messagesByThread.get('A')`; the next loadMessages early-returns because `isSendingRef` is still true; subsequent SSE deltas no-op via the `m.id === assistantId` map (placeholder is gone). User stares at empty thread until F5.
**Why it's wrong:** Phase 067.5 Branch D-3 reproduction (`useMessages.test.ts` RED test). The bucket store is per-thread, so the wipe must be per-thread AND must skip the streaming thread.
**Do this instead:** `if (tid && tid !== streamingThreadIdRef.current) { ...delete bucket... }` at `useMessages.ts:572-590`.

### Using `redis.exceptions.X` inside a route that has `redis: aioredis.Redis = Depends(get_redis)`

**What happens:** Inside `stream_run` / `cancel_run` route bodies, the parameter `redis` shadows the `redis` MODULE. Writing `redis.exceptions.RedisError` dereferences `.exceptions` on the Redis INSTANCE → `AttributeError`.
**Why it's wrong:** D-062-13 / `runs.py:24-30` documentation invariant.
**Do this instead:** Import unqualified at module top: `from redis.exceptions import RedisError, TimeoutError as RedisTimeoutError`. Use bare names inside route bodies.

### Putting reconcile (or its dep) into an effect's dep array if it's recreated mid-stream

**What happens:** `useEffect(..., [reconcile])` tears down + re-adds visibility/focus/pageshow listeners every time `reconcile` changes identity (e.g. message-state changes via `useCallback([...messages])`); the new listener fires immediately on the next visibility hint and races into a duplicate consumer.
**Why it's wrong:** WR-07 fix in `ChatArea.tsx:135-159`. Reconcile MUST have a stable identity for the listener effect to be mount-only.
**Do this instead:** Route through `reconcileRef.current(tid)`; keep `reconcile`'s `useCallback` deps minimal (`[loadMessages, setMessagesForThread]`).

## Error Handling

**Strategy:** Defense-in-depth at the wire layer (terminal sentinel guarantee), explicit exception-to-status mapping at the route layer, fail-loudly at the producer (each iteration logs context), best-effort with logger.exception swallow at the cleanup layer.

**Patterns:**
- Producer's outer try/finally writes a terminal sentinel on EVERY exit path (completion / cancellation / timeout / exception). The shielded finalize is exempt from MAXLEN trimming (`_emit_terminal`).
- 5 SSE TERMINAL_TYPES: `done`, `error`, `cancelled`, `timed_out`, plus `stream_end` as the closing marker after `done` + `suggestions`. Frontend's `subscribeToRun` parser routes each to `onTerminal(kind, errorPayload?)`.
- Consumer surfaces structural errors as synthetic SSE events (`{type: 'error', error: 'consumer_timeout'}` / `'invalid_since'` / `'redis_timeout'` / `'redis_error'` / `'buffer_expired_during_tail'`) so the client always gets a clean SSE close, never a silent drop.
- Route-level: 401 (invalid JWT, `dependencies.py:55`), 404 (ownership mismatch — never 403 to avoid existence leak, D-062-12), 503 + `Retry-After: 10` (Redis down on stream open, D-062-13), 500 (defensive — e.g. user-message INSERT didn't return id, `threads.py:926`).
- Background tasks (audit log writes, memory writes, feedback) use `_spawn(coro)` (`threads.py:63`) — fire-and-forget but with strong reference retention so the event loop doesn't garbage-collect mid-execution (WR-05).
- Sandbox: try/except + best-effort cleanup in `delete_thread` (`threads.py:620`) — pre-deletion cleanup of `sandbox_files` Storage paths, swallowed on failure.
- LLM 404 fallback: sub-agent retries with provider default; emits `fallback_model` SSE event so frontend shows a 4s notice via `setFallbackNotice`.

## Cross-Cutting Concerns

**Logging:** Standard Python `logging.getLogger(__name__)` in every module. `asyncio` logger set to ERROR in `main.py:12` to suppress benign "socket.send() raised exception" warnings during disconnect. LangSmith tracing wired via env vars at `main.py:48-51`.
**Validation:** Pydantic models in `backend/app/models/` for every request body and response shape. Structured LLM output via Pydantic-validated JSON parsing (no LangChain).
**Authentication:** Supabase JWT in `Authorization: Bearer <token>` header → `dependencies.get_current_user` validates via `supabase.auth.get_user(token)` (line 47-58). RLS is the secondary defense layer (kicks in if the service-role bypass is ever lifted; also enforced on direct client-side queries from the browser).
**Authorization:** Per-route `.eq("user_id", current_user["id"])` filter on every supabase-py query is the primary boundary (the service-role key bypasses RLS). RLS policies in `supabase/full-schema.sql` are the durable defense if a route forgets the filter — but treat them as belt-and-suspenders, not the canonical layer.
**Observability:** LangSmith for LLM traces (`LANGSMITH_TRACING`, `LANGSMITH_PROJECT`, `LANGSMITH_API_KEY` env vars). Health check at `GET /health` reports Redis status.
**Audit:** `services/audit_service.write_audit_entry` called via `BackgroundTasks` (non-SSE routes) or `_spawn` / `asyncio.create_task` (SSE producers). 8 action types: thread.create / thread.delete / message.send / document.upload / document.delete / version.restore / settings.update / web_search.toggle. INSERT-only RLS; CSV export endpoint.

---

*Architecture analysis: 2026-05-09*
