# Phase 061: Run-Backed Streaming (Backend) - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Decouple agent generation lifetime from any single HTTP request. The agent loop becomes a **producer task** writing every SSE event (token, tool, error, done) into a per-run Redis Stream keyed by `run_id`; the existing `POST /threads/{id}/messages` SSE handler becomes a **consumer** of that stream with offset-cursor semantics. Killing the consumer does NOT kill the producer. Adds the durable Postgres `runs` lifecycle record (D-v2.5-11) so audit/debugging/future-billing have ground truth that survives Redis TTL expiry.

This is the **foundation layer** for STREAM-04. Phase 062 adds the replay-and-tail HTTP API on top. Phase 063 cuts the frontend over to the new flow. All three ship as one merge from a long-lived feature branch (D-v2.5-11) — no flags, no incremental rollout.

**In scope:**
- New Redis backing for the SSE event stream. `redis>=5` added to `backend/requirements.txt`. `REDIS_URL` env var read by `Settings` in `backend/app/config.py`. `get_redis()` singleton in `backend/app/dependencies.py` mirroring `get_supabase()`.
- Producer task refactor at `backend/app/api/threads.py` — the `agent_runner` task introduced in 059 stops writing to an in-memory `asyncio.Queue` and starts writing directly to `XADD run:{run_id}` entries. The asyncio.Queue from 059 is removed; the Redis Stream IS the buffer.
- New module-level `RUN_TASKS: dict[uuid.UUID, asyncio.Task]` registry in `threads.py` (or a new `backend/app/api/_run_registry.py`) that owns producer-task references after the route handler returns. App lifespan close cancels all entries.
- Consumer rewrite in the same route handler — replaces `async for msg in queue` with a two-mode `XREAD` loop: replay (`COUNT N STREAMS run:{id} 0`) then live-tail (`BLOCK ms STREAMS run:{id} $`). Breaks on receipt of a terminal sentinel entry whose `type` field is in `{done, error, cancelled}`. Defensive max-wait safety net of `RUN_HARD_TIMEOUT_SECONDS + 10` covers producer-crash-without-sentinel.
- Migration `035_runs_table.sql` — new `public.runs` table with columns per ROADMAP SC#5 (run_id, thread_id, user_id, message_id, status, model, provider, started_at, completed_at, input_tokens, output_tokens, error). UUID PK via `gen_random_uuid()`. `thread_id`/`user_id` FKs both `ON DELETE CASCADE`. Partial index `(user_id, thread_id, status) WHERE status='streaming'` for the active-runs hot path; composite `(user_id, thread_id, started_at DESC)` for history/audit. RLS: SELECT-only `auth.uid() = user_id`; backend service-role does all writes.
- Producer wraps its body with `async with asyncio.timeout(settings.run_hard_timeout_seconds):` (default 120s, env-overridable as `RUN_HARD_TIMEOUT_SECONDS`). Timeout raises → `finally` writes terminal `error` event with `error='hard_timeout'`, updates `runs.status='failed'`, EXPIREs the Redis key.
- Producer's `finally` runs unconditionally and includes (a) the `asyncio.shield`-protected partial-response persist from 058/059 (preserved verbatim — still needed for the assistant message body), (b) the terminal sentinel XADD, (c) `runs` row update with `completed_at`/`status`/`error`/token-counts, (d) `EXPIRE run:{id} {600|60}` per status (10 min retention completed, 60s failed/cancelled), (e) registry self-removal.
- `/health` endpoint extended with a Redis ping check returning `{"redis": "ok" | "unreachable"}`. PING on every call (cheap), 1s timeout.
- Bootstrap artifact regenerated: `bash scripts/regenerate-full-schema.sh` after the migration lands (CLAUDE.md project rule).
- New merge gate: `tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect` — slow-mock-LLM, abort consumer after 1 token, assert XADD count grows + terminal sentinel + `runs.status='completed'`. Plus regression assertions that 058's cross-tab <1s and the 061-inverted equivalent of 059's disconnect test still hold.
- Inversion of `tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect` — the contract changes intentionally per D-v2.5-08/SC#3. Renamed/rewritten in 061's scope to assert producer SURVIVES consumer disconnect. The migration commit message and `061-VERIFICATION.md` document the contract change.
- `061-VERIFICATION.md` includes a manual two-tab DevTools timing checklist mirroring 058/059 format as a non-gating human backstop.

**Out of scope (belongs to other phases):**
- `GET /threads/{id}/active-runs` and `GET /runs/{id}/stream?since={offset}` HTTP endpoints — Phase 062.
- `DELETE /runs/{id}` cancel verb — Phase 062. (061 leaves Stop intentionally non-functional backend-side; the 120s hard timeout is the sole guard during the 061-only dev window. The single-feature-branch deploy means users never see this state — D-v2.5-11.)
- Frontend wiring to POST→run_id→subscribe — Phase 063. POST handler in 061 still streams the response back to the originating connection; only the source of those bytes changes (Redis instead of asyncio.Queue).
- Browser-MCP scenario harness — Phase 064.
- Skills test infra repair — Phase 065.
- Abandoned-run sweeper task / per-run no-consumer TTL — explicitly deferred (no separate sweeper in 061; hard timeout is sole bound).
- Cleanup of `runs:active` / `runs_by_thread:{id}` sorted-set entries when their referenced `run:{id}` keys EXPIRE — passive cleanup at query time in 061; revisit if entry counts grow.
- Migration to `asyncpg` / async Supabase client — CONCUR-03, deferred.
- KI-001 mid-LLM-call cancellation — still bounded by the same yield-point semantics as 058/059. The 120s hard timeout is the ceiling, not a granular cancel signal.

</domain>

<decisions>
## Implementation Decisions

### D-v2.5-09 specifics: cancel/timeout policy

- **D-061-01 — Server-side hard timeout default = 120s.** Implemented as `async with asyncio.timeout(settings.run_hard_timeout_seconds):` wrapping the producer body. Env-overridable via `RUN_HARD_TIMEOUT_SECONDS`. Setting added to `Settings` in `backend/app/config.py` alongside `anyio_thread_tokens` (matches the 058 pattern). Rationale: 12-iteration default agent loop × ~10s/iteration with tools ≈ 2 min in pathological cases; 120s gives enough headroom for typical agentic chains while bounding abandoned-run cost to ~$0.50 of Sonnet/4o tokens.

- **D-061-02 — No abandoned-run sweeper.** The 120s hard timeout is the sole bound. No `last_consumer_seen_at` tracking, no periodic asyncio sweeper task, no per-run no-consumer TTL distinct from the wall-clock cap. Rationale: simpler implementation, no edge cases around quick reconnects, the cost ceiling is already bounded. Reconsider only if post-061 cost evidence shows the 120s cap is too loose.

- **D-061-03 — Stop is intentionally a no-op backend-side in the 061-only window.** Frontend `AbortController.abort()` closes the consumer; the consumer's `finally` does NOT cancel the producer. Producer continues until natural completion or 120s timeout. The DELETE /runs/{id} cancel verb that actually stops the producer ships in **062, in the same merge** (D-v2.5-11). Users never see this broken-Stop window because 061+062+063 ship together. Document explicitly in `061-VERIFICATION.md`.

- **D-061-04 — Hard-timeout persistence shape.** When `asyncio.timeout` fires: producer writes a terminal sentinel stream entry `{type: "error", error: "hard_timeout", ...}`, updates `runs.status='failed' error='hard_timeout' completed_at=now()`, EXPIREs the key with 60s TTL (failed-bucket). Status enum stays at 4 values: `streaming` / `completed` / `failed` / `cancelled`. Frontend treats it as a generic failure with a recognizable error code; 062's Resume button surfaces (per D-v2.5-05).

### `public.runs` schema details (migration 035)

- **D-061-05 — Primary key: `run_id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.** Matches Supabase convention used by `messages.id`, `threads.id`, `documents.id`, `skills.id` (since migration 001). The Redis Stream key is `run:{run_id}` so this UUID flows verbatim into Redis and into the URLs introduced in 062. Server-side generation; INSERT returns the value.

- **D-061-06 — FK ON DELETE behavior: both CASCADE.** `thread_id` references `threads(id) ON DELETE CASCADE` (matches `messages.thread_id` since 001). `user_id` references `auth.users(id) ON DELETE CASCADE`. Delete a thread → its runs vanish with the messages. Delete a user → all their runs vanish. The Redis Stream entries are independently TTLed and not coupled to Postgres lifecycle. SET NULL was rejected because audit-as-source-of-truth is a future-billing concern, not a v2.5 requirement.

- **D-061-07 — Index strategy.** Two indexes:
  - Partial index `idx_runs_active ON runs(user_id, thread_id, status) WHERE status = 'streaming'` — tiny because 99.9% of rows are terminal; serves the active-runs hot path that Phase 063's frontend hits on every (re)connect.
  - Composite `idx_runs_history ON runs(user_id, thread_id, started_at DESC)` — serves run-history queries (audit, debugging, future billing/usage UI).

  PK index handles direct `run_id` lookup. No additional indexes in 061; revisit if `runs` grows past 100k rows in production.

- **D-061-08 — RLS shape: SELECT-only.** Policy: `CREATE POLICY runs_select_own ON runs FOR SELECT USING (auth.uid() = user_id)`. No INSERT/UPDATE/DELETE policies (so all writes require service-role, which the backend uses). Mirrors the `messages` table pattern: backend owns lifecycle, frontend can read for active-runs / history UI. RLS is defense-in-depth — the 062 GET endpoints route through the backend service-role anyway.

- **D-061-09 — Other column shapes (planner-discretion mechanical decisions, listed for downstream awareness):**
  - `status` — TEXT with `CHECK (status IN ('streaming','completed','failed','cancelled'))`. Postgres enum types are slightly more code (DDL for ALTER TYPE) and don't add safety over a CHECK constraint at this scale.
  - `error` — TEXT NULL. Plain text discriminator strings (e.g., `'hard_timeout'`, `'llm_api_error'`, `'cancelled_by_user'`); not JSONB. Structured error metadata can move to a separate column later if needed.
  - `input_tokens` / `output_tokens` — INTEGER NULL (filled at completion only).
  - `started_at` — TIMESTAMPTZ NOT NULL DEFAULT now(). `completed_at` — TIMESTAMPTZ NULL.
  - `model` / `provider` — TEXT NOT NULL (always known at run start; populated from `UserEffectiveSettings`).
  - `message_id` — UUID NULL (filled at completion when the assistant message row is persisted).

### Producer architecture

- **D-061-10 — Producer XADDs directly; no intermediate `asyncio.Queue`.** Every existing `await queue.put(json.dumps({...}))` from 059 becomes `await redis.xadd(f'run:{run_id}', {'data': json.dumps({...})})`. The single-field `data` shape mirrors 059's queue payload format byte-for-byte so the consumer's emit is `{'data': entry['data']}` for `EventSourceResponse`. Frontend wire format unchanged from 059. Smallest mental model. The asyncio.Queue from 059 is removed.

- **D-061-11 — Producer task ownership: module-level `RUN_TASKS` registry.** Type: `dict[uuid.UUID, asyncio.Task]`. Lives in `backend/app/api/threads.py` (or extracted to `backend/app/api/_run_registry.py` if planner prefers). Route handler creates the run row, spawns the producer with `asyncio.create_task(agent_runner(run_id, ...))`, registers it (`RUN_TASKS[run_id] = task`), then returns the consumer. Producer's `finally` removes itself: `RUN_TASKS.pop(run_id, None)`. App lifespan close in `backend/app/main.py` cancels all entries (`for t in RUN_TASKS.values(): t.cancel()`) and awaits them. 062's `DELETE /runs/{id}` will look up the run_id here and call `task.cancel()`. Single uvicorn worker (D-v2.5-02) means one registry per process — simple.

- **D-061-12 — Consumer termination: terminal sentinel + safety-net timeout.**
  - Producer's `finally` writes one final stream entry whose JSON `data.type` is in `TERMINAL_TYPES = {'done', 'error', 'cancelled'}` BEFORE EXPIREing the key.
  - Consumer's two-mode XREAD loop: replay phase reads `COUNT 100 STREAMS run:{id} 0` until no more backlog, then live-tail phase reads `BLOCK 5000 STREAMS run:{id} $`. After yielding each entry, check `if json.loads(entry['data'])['type'] in TERMINAL_TYPES: break`.
  - Defensive safety net: consumer enforces `total_wait < RUN_HARD_TIMEOUT_SECONDS + 10` (default 130s); if exceeded with no terminal entry, consumer breaks and emits its own synthetic error event. Covers producer-crash-without-sentinel.

- **D-061-13 — Redis client lifecycle: singleton via `get_redis()`.** Add `backend/app/dependencies.py::get_redis() -> redis.asyncio.Redis` mirroring `get_supabase()`. Lazy-init from `settings.redis_url`, module-level cache. `lifespan()` close calls `await client.aclose()`. Routes that need Redis declare `redis: Redis = Depends(get_redis)`; the producer task captures the instance via closure when spawned. `aexec` (D-058-03) is unchanged — Redis calls are already async natively, no threadpool wrap needed.

### Redis test infrastructure

- **D-061-14 — Real Redis via `docker-compose.dev.yml`; CI assumes Redis is up.** No fakeredis (Streams semantics drift). No testcontainers (overkill at v2.5 scale). Pytest fixture: session-scoped `redis.asyncio.Redis` connecting to `localhost:6379`. CI workflow adds `docker compose -f docker-compose.dev.yml up -d redis` before pytest. Conftest does FLUSHDB at session end.

- **D-061-15 — New 061 binding test: `tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect`.** Pattern mirrors 058/059 binding gates. Uses 058's slow-mock-LLM fixture. Steps: drive `POST /threads/{tid}/messages`, read the first SSE token chunk, abort the client. Then assert (a) over the next 5s, `await redis.xlen(f'run:{run_id}') > N_at_disconnect`, (b) eventually a terminal entry with `data.type == 'done'` is written, (c) `runs.status == 'completed'` in Postgres after the slow-mock-LLM finishes its scripted token sequence. Plus inline regression assertions that 058's cross-tab GET <1s still holds while a 061 stream is in flight.

- **D-061-16 — Invert `tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect` in 061's scope.** The 059 invariant ("producer cancelled within 1s of disconnect") is structurally incompatible with 061's SC#3 ("producer survives consumer disconnect"). Rewrite the test in the same file (or move to `test_061_*.py`) to assert the new invariant. Document in commit message + `061-VERIFICATION.md` that this is an intentional contract change, NOT a regression. The file's earlier docstring should reference D-v2.5-08 and the 061 phase as the source of the new contract. The 058 cross-tab test stays untouched.

- **D-061-17 — Test isolation: UUID-based, no per-test prefix.** Every `run_id` is a UUID at INSERT time, so collision is statistically impossible across test workers and sessions. `runs:active` sorted-set entries accumulate during a test session; FLUSHDB at session end wipes them. Production code does NOT carry test-specific config (no key-prefix override). If pytest-xdist parallelism ever produces flakes attributable to shared Redis state, fall back to testcontainers — that's a one-fixture change.

### Claude's Discretion

- Whether to extract `RUN_TASKS` and `agent_runner` to `backend/app/api/_run_registry.py` and `backend/app/api/_agent_runner.py` (cleaner imports, easier to test) or keep nested inside `threads.py` (smaller diff, matches 059's nesting). Functionally equivalent.
- Exact `redis-py` version pin in `requirements.txt` (latest stable 5.x at planning time; verify compatibility with Python 3.12).
- Whether the producer wraps each `redis.xadd(...)` in a small helper like `_emit(run_id, type, **fields)` to avoid repeating `json.dumps` and the field shape — purely ergonomics.
- Exact name of the test fixture providing the session-scoped Redis client (`redis_client`, `aredis`, etc.).
- Whether the consumer's two-mode XREAD loop is structured as `if/else` on a `mode` variable or as two separate `async for` loops; both work, planner picks based on readability.
- Whether `RUN_HARD_TIMEOUT_SECONDS` lives next to `anyio_thread_tokens` in `Settings` or in a new `RunStreamingSettings` nested model — purely config layout.
- The XADD MAXLEN cap (10k entries? unbounded?). 10k entries × ~200 bytes = 2 MB per run, well within Redis defaults; recommend `XADD MAXLEN ~ 10000` as a safety bound but planner can drop if it complicates the call site. Sentinel entry must NOT be trimmed; document if MAXLEN is set.
- Whether `runs_by_thread:{thread_id}` sorted-set add/remove happens in the producer's finally or in a tiny synchronous helper called from the route handler. Any path is fine as long as the membership is consistent.
- Whether the `/health` Redis ping result is cached for N seconds or PINGs every call. PING is sub-millisecond on local Redis; uncached is fine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level decisions and milestone scope (LOCKED)
- `.planning/PROJECT.md` — Key Decisions table. **D-v2.5-08** (Redis Streams chosen over pgmq / LISTEN-NOTIFY), **D-v2.5-09** (LLM cost-shift mitigations — specifics locked in this CONTEXT.md as D-061-01..04), **D-v2.5-10** (STREAM-02b absorbed by STREAM-04), **D-v2.5-11** (single-feature-branch deploy + `runs` Postgres table mandate). All four are LOCKED upstream.
- `.planning/REQUIREMENTS.md` — **STREAM-04** is the binding multi-phase acceptance criterion (a/b/c verifications). The `public.runs` Postgres table mandate and `DELETE /runs/{id}` cancel verb (in 062) are part of the requirement text. **Locked.**
- `.planning/ROADMAP.md` Phase 061 entry — Success Criteria #1–8 are the binding behavioural contract reproduced here as decisions. Risks/pitfalls section codifies the architectural traps to avoid (XTRIM vs EXPIRE, run_id vs message_id, redis-py async path, Upstash setup). **Locked.**

### Operational guides
- `REDIS-SETUP.md` — local + cloud Redis setup, key conventions table (`run:{run_id}` Stream, `runs_by_thread:{thread_id}` sorted set, `runs:active` sorted set), TTL discipline (600s completed / 60s failed/aborted / immediate on abandoned). **Required reading for the planner; the key namespace is locked here, not in CONTEXT.md.**
- `supabase/SETUP.md` — migration workflow. After 035_runs_table.sql lands, run `bash scripts/regenerate-full-schema.sh` to rebuild `supabase/full-schema.sql`. **Required reading.**
- `docker-compose.dev.yml` — local Redis dev infra (port 6379, no auth, `--save ""` ephemeral, `--maxmemory 256mb`, `restart: unless-stopped`). CI uses the same compose file.

### Schema / migration precedents
- `supabase/migrations/001_initial_schema.sql` — UUID PK + `gen_random_uuid()` + `auth.uid() = user_id` RLS conventions. The `messages` table CASCADE on `thread_id` is the precedent for D-061-06.
- `supabase/migrations/028_message_feedback.sql` — INSERT-only RLS reference (rejected for `runs` because runs are mutable across lifecycle).
- `supabase/full-schema.sql` — single-file deploy artifact. Regenerated automatically; never hand-edited (CLAUDE.md project rule).

### Phase 058/059/060 hand-off (architectural foundation)
- `.planning/phases/058-backend-sse-concurrency-fix/058-CONTEXT.md` — **D-058-03** (`backend/app/utils/db.py::aexec` helper — reused unchanged), **D-058-07** (AnyIO 200-token limiter set in lifespan — unchanged), `Settings` env-overridable pattern at `config.py:128–283` (mirror for `RUN_HARD_TIMEOUT_SECONDS`).
- `.planning/phases/059-sse-architecture-refactor/059-CONTEXT.md` — **D-059-01..05** (the producer/consumer pattern that 061 evolves; in particular D-059-04 queue protocol is the wire format that maps to Redis Stream entries' `data` field). The `agent_runner` task structure is the diff base.
- `.planning/phases/059-sse-architecture-refactor/059-VERIFICATION.md` — verification format precedent for `061-VERIFICATION.md`.
- `tests/integration/test_058_concurrency.py` — slow-mock-LLM fixture; cross-tab regression test (must keep passing, D-058-09).
- `tests/integration/test_059_disconnect.py` — the test whose contract is intentionally inverted in 061 (D-061-16). Read the existing file to understand the fixture wiring before rewriting.
- `.planning/phases/060-frontend-race-fixes/060-CONTEXT.md` — D-060-04 `getMessages(threadId, signal?)` and the `setViewingThread` foundation that Phase 063 will build on. Frontend wire format is **unchanged** from 059 → 061; Phase 063 will change frontend behavior, not the SSE event JSON.

### Codebase landmarks (concrete edit sites)
- `backend/app/api/threads.py:511` — pre-stream user-message INSERT (already `aexec`-wrapped per D-058-02). 061 also INSERTs the new `runs` row here, BEFORE spawning the producer task.
- `backend/app/api/threads.py:520+` — `agent_runner` background producer task introduced in 059 (location depends on whether 059 nested it inside the route handler or extracted to a module). 061 swaps `queue.put(...)` for `redis.xadd(...)`, removes the asyncio.Queue, registers the task in `RUN_TASKS`, and wraps the body in `asyncio.timeout(settings.run_hard_timeout_seconds)`.
- `backend/app/api/threads.py` route handler — replaces `EventSourceResponse(consumer())` queue-fed body with the new XREAD-based `event_consumer` reading from Redis. POST handler wire shape unchanged for 061 (still streams the response back); only the source of bytes changes.
- `backend/app/api/threads.py` (post-loop) — terminal sentinel write + EXPIRE + `runs` row update + sorted-set deregistration (`runs:active`, `runs_by_thread:{thread_id}`) all live in producer's `finally`.
- `backend/app/main.py:50` — `lifespan()` async context manager. Add `get_redis()` startup ping (best-effort log warning if unreachable; don't block startup) and `RUN_TASKS` shutdown cancel + `await client.aclose()`.
- `backend/app/main.py` `/health` endpoint — extend with the Redis ping check returning `{"redis": "ok" | "unreachable", ...}`.
- `backend/app/dependencies.py` — new `get_redis()` singleton mirroring `get_supabase()`. Reads `settings.redis_url`.
- `backend/app/config.py:128–283` — `Settings(BaseSettings)`. Add `redis_url: str = "redis://localhost:6379"` and `run_hard_timeout_seconds: int = 120`.
- `backend/requirements.txt` — add `redis>=5` (async client). Pin a 5.x version compatible with Python 3.12.
- `supabase/migrations/035_runs_table.sql` — new migration. After landing, run `bash scripts/regenerate-full-schema.sh`.
- `tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse` — must keep passing (regression guard SC#7).
- `tests/integration/test_059_disconnect.py` — invert the disconnect-cancellation invariant per D-061-16 (the file moves into 061's commit history).
- `tests/integration/test_061_producer_survives_disconnect.py` — new merge gate per D-061-15.

### Codebase intelligence
- `.planning/codebase/STACK.md` — Python 3.12.6, FastAPI 0.115.6, Uvicorn standard, single-worker dev. Confirms redis-py async is the right async client family.
- `.planning/codebase/ARCHITECTURE.md` — `get_supabase()` singleton pattern that `get_redis()` mirrors. SSE event-types table (line 130+) is the wire format that maps to Redis Stream entries.
- `.planning/codebase/INTEGRATIONS.md` — environment-variable conventions (`SUPABASE_*`, etc.). `REDIS_URL` follows the same `pydantic-settings` pattern.

### Out-of-scope context (read for boundary, do NOT implement here)
- ROADMAP Phase 062 — replay-and-tail API + DELETE /runs/{id} cancel verb. 061's `RUN_TASKS` registry and `runs.status='cancelled'` enum value exist to be USED by 062, not by 061.
- ROADMAP Phase 063 — frontend cutover to POST→run_id flow. The wire format compat in 061 (POST still streams back to caller) is what lets 063 land cleanly.
- `.planning/research/058-sse-concurrency-research.md` — option **F** in the decision matrix is what 059 implemented; 061 builds the next layer on top.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`backend/app/utils/db.py::aexec(query)`** — wraps sync supabase `.execute()` in `run_in_threadpool`. The new `runs` row INSERT/UPDATE calls use it unchanged (D-058-03 unchanged in 061).
- **`backend/app/dependencies.py::get_supabase()` singleton pattern** — `get_redis()` is a structural copy. Lazy-init from `settings`, module-level cache, lifespan close releases.
- **058's slow-mock-LLM fixture in `tests/integration/test_058_concurrency.py`** — reused in 061's binding test for deterministic streaming windows.
- **`asyncio.shield`-protected `_persist_assistant_message` (`threads.py:~683`)** — survives 061 unchanged. Still wraps the assistant-message DB write because the `messages` table is the source of truth for chat history; the Redis Stream is the EVENT BUFFER, not the persistent message body.
- **`backend/app/main.py:50` lifespan** — already accepts startup hooks (058 added the AnyIO limiter). 061 adds Redis ping + `RUN_TASKS` shutdown cancel.
- **`Settings(BaseSettings)` `pydantic-settings` env-loading pattern** — already supports adding new fields with defaults that env-override automatically. `RUN_HARD_TIMEOUT_SECONDS` and `REDIS_URL` slot in trivially.
- **The `agent_runner` background task pattern from 059** — the producer's overall structure (closure over `current_user`/`body`/`thread_id`, `asyncio.shield` finalizer, `try/finally`) all carry forward verbatim. Only the queue interaction changes to XADD.

### Established Patterns

- **Single uvicorn worker (D-v2.5-02)** is the foundation that makes the module-level `RUN_TASKS` registry work without coordination. If we ever scale to N>1 workers, the registry becomes per-worker and the cancel verb in 062 needs cross-worker coordination (Redis Pub/Sub or a `runs:cancel:{run_id}` key the producer polls). Out of scope for 061.
- **All Supabase calls in the SSE path are `await aexec(...)`** since 058. Producer body inherits this — 061 introduces no new sync DB calls.
- **`asyncio.shield` end-of-stream persistence** is the existing pattern for protecting the final DB write from cancellation. 061 preserves it; the only addition is the `runs` row UPDATE and the sentinel XADD, both inside the same shielded block.
- **Frontend wire format is `data: {"type": "...", ...}\n\n`** (per ARCHITECTURE.md SSE event-types table). The Redis Stream entry's `data` field carries the same JSON byte-for-byte. Phase 063 will consume this same wire format from the new replay-and-tail endpoint.
- **Migration files use the `<digits>_name.sql` pattern** (e.g., `035_runs_table.sql`). Letter suffixes (`007b`) are silently skipped by the Supabase CLI (CLAUDE.md project rule). After adding the migration, regenerate `supabase/full-schema.sql` via `bash scripts/regenerate-full-schema.sh`.

### Integration Points

- **Producer task lifetime is now decoupled from the route handler.** When the consumer's `EventSourceResponse` finishes (client closes the SSE), `sse-starlette`'s disconnect detection no longer leads to producer cancellation — because the consumer's `finally` does NOT call `task.cancel()` on the producer (D-061-03). The producer runs to completion in the background, registry-tracked.
- **`runs` row lifecycle:** INSERT in route handler before producer spawn (status='streaming', started_at=now()); UPDATE in producer's finally (status, completed_at, message_id, input_tokens, output_tokens, error). One INSERT, one UPDATE per run.
- **Redis Stream key `run:{run_id}` lifecycle:** XADD entries during producer body; final sentinel XADD in finally; EXPIRE 600/60 in finally; sorted-set membership in `runs:active` and `runs_by_thread:{thread_id}` ZADD on start, ZREM in finally. Six Redis touches in the happy-path producer.
- **058's cross-tab test (`test_cross_tab_unblocked_during_sse`)** must keep passing under the new architecture — the SSE path is now Redis-backed, but the cross-tab GET still benefits from D-058-03/07 unchanged. New regression risk: if Redis client init in `get_redis()` does any sync I/O on the event loop, it could re-introduce blocking. Verify lazy-init is async-clean.
- **059's disconnect test inverts** (D-061-16) — the test file moves into 061's commit history with a contract change explanation.
- **Migration 035** is the v2.5 schema delta. The `runs` table is read by Phase 062's `GET /threads/{id}/active-runs` endpoint; 061 only writes.

</code_context>

<specifics>
## Specific Ideas

- New module-level constant: `TERMINAL_TYPES = frozenset({"done", "error", "cancelled"})` — used by the consumer break check.
- Producer-side helper recommendation: `async def _emit(run_id, type: str, **fields): await redis.xadd(f"run:{run_id}", {"data": json.dumps({"type": type, **fields})})` — replaces every `await queue.put(json.dumps({...}))` from 059. Planner-discretion if the helper is worth it.
- Setting names match REDIS-SETUP.md exactly: `REDIS_URL` (not `REDIS_DSN` or `REDIS_HOST`), `RUN_HARD_TIMEOUT_SECONDS` (not `RUN_TIMEOUT` or `MAX_RUN_DURATION`).
- `run_id` is a `uuid.UUID` in Python; serialize to str for Redis keys (`f"run:{run_id}"` works because UUID has a `__str__`). Postgres stores native UUID.
- Status enum values are exactly `streaming`, `completed`, `failed`, `cancelled` — matches ROADMAP SC#5 verbatim. CHECK constraint enforces.
- Migration filename: `035_runs_table.sql`. Description heading inside the file should read "Phase 061: per-run lifecycle metadata for run-backed streaming (D-v2.5-11)".
- Test filename: `tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect`. Single deterministic assertion: `xlen` grows post-disconnect AND terminal sentinel lands AND runs.status='completed'.
- Verification doc: `.planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md` includes the manual two-tab DevTools timing checklist mirroring 058/059 format. Document the contract inversion explicitly.
- Mental model recap for downstream agents: **Redis Stream = the event buffer (ephemeral, TTL'd). `public.runs` = the lifecycle record (durable). The asyncio.Queue from 059 is gone.** Producer XADDs to one and UPSERTs the other; consumer XREADs only the Stream.

</specifics>

<deferred>
## Deferred Ideas

- **Abandoned-run sweeper task** (no-consumer-for-N-min cancellation). Out of 061 scope per D-061-02. Revisit if post-061 cost evidence shows the 120s wall-clock cap is too loose for typical disconnect patterns. Implementation sketch if needed: periodic asyncio task scanning `runs:active` against last-attached timestamps.
- **Cleanup of `runs:active` and `runs_by_thread:{id}` sorted-set entries when their referenced `run:{id}` Stream key EXPIREs.** Redis doesn't auto-clean sorted-set entries on key expiry of a different key. 061 defaults to passive cleanup at query time (Phase 062's active-runs endpoint filters by `status='streaming'` from Postgres anyway). Revisit if entry counts grow into the millions in production.
- **`testcontainers-python` per-session Redis** as a fallback test substrate if UUID-based isolation produces flakes under pytest-xdist parallelism. One-fixture change.
- **Migration to `asyncpg` / async Supabase client (CONCUR-03)** — already tracked in REQUIREMENTS.md "Future Requirements." Removes the AnyIO 200-token ceiling entirely. Out of v2.5 scope.
- **Hidden `/__health/sse` endpoint** that reports current `RUN_TASKS` count + Redis stream backlog. Useful observability; not v2.5 requirement. Carried forward from 059's deferred list.
- **Structured `event:` field routing on the SSE wire** (e.g., `event: token`, `event: tool_start`). The 061 producer/consumer pair carries data-only payloads with `type` discriminator inside the JSON; a future refactor could introduce SSE event-name routing. Not v2.5 scope.
- **KI-001 mid-LLM-call cancellation.** Same `yield`-point semantics as 058/059 — the 120s hard timeout is the wall-clock guard, not a granular cancel. A future phase could thread an `asyncio.CancelScope` or `httpx.AsyncClient` cancel token through provider SDKs.
- **Cross-worker coordination if uvicorn ever scales to `--workers N>1`.** The `RUN_TASKS` registry is per-process today (D-v2.5-02 keeps single-worker). 062's DELETE /runs/{id} would need Redis Pub/Sub or a `runs:cancel:{run_id}` poll-key to broadcast cancellation across workers.
- **Token-counter accounting source** (LLM SDK return value vs `tiktoken` estimate). Not in 061 scope to lock — planner picks the simplest path that gives a non-NULL number at completion. Revisit when billing/usage UI lands.
- **`message_id` backfill semantics.** When the assistant message is persisted in the producer's `finally`, its `id` is written into `runs.message_id`. If persistence fails (rare; `asyncio.shield` protects but doesn't guarantee DB success), `runs.message_id` stays NULL and `runs.status='failed' error='persist_error'`.

</deferred>

---

*Phase: 061-run-backed-streaming-backend*
*Context gathered: 2026-05-02*
