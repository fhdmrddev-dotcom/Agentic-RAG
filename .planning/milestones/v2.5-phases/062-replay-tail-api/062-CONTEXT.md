# Phase 062: Replay & Tail API - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<inherited_concern>
## Inherited Concern from Phase 061.1 — DEF-061.1-02

**Source:** `.planning/phases/061.1-run-backed-streaming-cleanup/deferred-items.md` §DEF-061.1-02 (logged 2026-05-03 by Plan 01 executor).

**Suspicion:** During the 061.1 verification sweep, 3 race tests still failed AFTER `await_producer_finalized` made them deterministic — pointing at a possible **production-code classifier bug** rather than a test-side race:

- `test_failed_run_expires_60s` — asserts TTL ∈ (30, 65] for a failed run; got TTL=600 (the completed-run bucket).
- `test_120s_timeout_fires_full_finally` — similar mismatch on terminal-status / TTL.
- `test_producer_continues_after_consumer_disconnect` — assertion path interacts with the same finalize ordering.

**Hypothesis:** the producer's exception classifier (around `threads.py:1003-1875` agent_runner) appears to coerce certain LLM exceptions into `_terminal_status='completed'` instead of `'failed'`, so the finalizer writes the wrong TTL bucket and `runs.status` enum value.

**Why this matters for Phase 062:**
- 062's `GET /threads/{thread_id}/active-runs` filters by `runs.status='streaming'` and uses the table as source of truth. If the classifier is wrong, terminal runs that should be `'failed'` may persist as `'streaming'` (because the wrong-bucket UPDATE may not happen) OR appear as `'completed'` (because they were misclassified). Either case produces phantom rows in 062's listing.
- 062's `GET /runs/{run_id}/stream` fallback when `redis.exists` returns 0 maps `runs.status` → terminal SSE event via `_RUN_STATUS_TO_TERMINAL_TYPE`. A wrong status enum produces a wrong synthetic terminal event.
- 062's DELETE zombie-heal path UPDATEs `status='cancelled'` — if the classifier already wrote `'completed'`, the cancel may be racey or no-op.

**Recommendation for the 062 researcher / planner:**
1. **Read** `.planning/phases/061.1-run-backed-streaming-cleanup/deferred-items.md` in full.
2. **Investigate** whether the suspected classifier path actually mis-classifies. Concrete test: run `test_061_ttl.py::test_failed_run_expires_60s` in isolation against the current `threads.py` and inspect `mock_supabase.table("runs").update.call_args_list` to see what `status` value the producer actually writes when the LLM raises a stock `Exception`.
3. **Decide one of three dispositions and document it in 062-PLAN.md:**
   - **(a) Fix in 062 as a pre-requisite:** add a Plan 0 / Wave 0 task that fixes the classifier before the new endpoints land. 062's contract depends on `runs.status` being correct, so this may be the cleanest path.
   - **(b) Insert a 061.2 cleanup phase before 062:** if the classifier fix is large enough to warrant its own atomic phase. Use `/gsd:insert-phase 061.2`.
   - **(c) Defer further:** if investigation shows the classifier IS correct and the 3 tests fail for an orthogonal reason (e.g., the test mock raises wrong exception class). Update `deferred-items.md` with the actual root cause and proceed with 062 as currently scoped.

**Disposition decision-maker:** the 062 planner. The 061.1 verifier passed 18/18 must-haves on 061.1's own scope, so DEF-061.1-02 is a real but not-061.1-blocking concern.

DEF-061.1-01 (`test_normal_stream_unchanged` expects old `stream_end` event name) is pure test cleanup with no 062 implications — disposition stays "future test cleanup phase".

</inherited_concern>

<domain>
## Phase Boundary

Surface the durable Redis Stream buffer shipped in Phase 061 as a clean HTTP API so any client can list active runs for a thread, reattach to one and tail its events to completion, and cancel an in-flight run via a server-side verb. Three new endpoints — `GET /threads/{thread_id}/active-runs`, `GET /runs/{run_id}/stream`, `DELETE /runs/{run_id}` — built on top of 061's `RUN_TASKS` registry, `public.runs` lifecycle table, Redis Stream buffer (`run:{run_id}`), and sorted-set indexes (`runs:active`, `runs_by_thread:{thread_id}`).

This is the **API layer** for STREAM-04. Phase 063 cuts the frontend over to the new flow (POST returns JSON, frontend opens the stream endpoint separately). Phase 064 validates the full chain end-to-end. All three (061+062+063) ship as a single merge from a long-lived feature branch (D-v2.5-11) — no flags, no incremental rollout.

**In scope:**
- New module `backend/app/api/runs.py` containing `APIRouter(prefix="/runs", tags=["runs"])` with two endpoints: `GET /runs/{run_id}/stream?since={offset}` and `DELETE /runs/{run_id}`.
- New endpoint added to existing `backend/app/api/threads.py` router: `GET /threads/{thread_id}/active-runs` returning `list[ActiveRunResponse]`.
- New router mounted in `backend/app/main.py` alongside the existing threads router.
- New Pydantic response models: `ActiveRunResponse(run_id: UUID, started_at: datetime, status: str)` in `backend/app/models/run.py` (or co-located in `runs.py` if planner prefers).
- New `replay_tail_consumer(redis, run_id, since)` async generator that mirrors the structure of 061's `event_consumer` at `threads.py:2065` but parameterized by a `since` cursor. Two-mode XREAD (replay COUNT 100 from `since` → live-tail BLOCK 5000 from `$`) with deadline = `settings.run_hard_timeout_seconds + 10`. Breaks on terminal sentinel.
- DELETE handler imports `RUN_TASKS` from `app.api.threads` (keeps registry as the single source of truth — D-061-11 single-worker invariant unchanged).
- For DELETE on a zombie (Postgres `runs.status='streaming'` but `RUN_TASKS[run_id]` missing): UPDATE Postgres `status='cancelled', error='cancelled_by_user', completed_at=now()`; if `await redis.exists(f"run:{run_id}")` is truthy, call `_emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")` so any attached consumer closes cleanly; ZREM both sorted-set entries; `await redis.expire(f"run:{run_id}", 60)`; return 204.
- For GET `/runs/{run_id}/stream` on already-terminal runs: open EventSourceResponse normally — the producer's terminal sentinel is already in the buffer per D-061-12, the consumer's loop breaks naturally, response closes. If `await redis.exists(f"run:{run_id}")` is 0 (TTL expired), SELECT the runs row to get final `status` + `error`, emit a synthetic terminal event matching that status (mapped via `_RUN_STATUS_TO_TERMINAL_TYPE`), close. If runs row also missing → 404.
- New Pydantic request/response models live alongside existing `MessageResponse` / `ThreadResponse` patterns in `backend/app/models/`.
- Integration tests in `backend/tests/integration/test_062_*.py` covering: active-runs returns streaming-only filter, stream endpoint replays + tails, stream endpoint on terminal run replays sentinel + closes, stream endpoint on TTL-expired run emits synthetic terminal, DELETE happy path cancels producer, DELETE zombie heals, DELETE on terminal returns 204 silent, cross-user 404s, multi-consumer fan-out (two consumers of same run_id receive same sequence).
- `062-VERIFICATION.md` mirroring 061 format (artifact-by-artifact verification + manual two-tab DevTools checklist as human backstop, with the heavy multi-tab work deferred to Phase 064's harness).

**Out of scope (belongs to other phases):**
- Cutting `POST /threads/{id}/messages` to return JSON (delete the inline `event_consumer()` at `threads.py:2065`) — **Phase 063**. 062 leaves the POST handler completely untouched. Both POST's inline consumer and 062's new `replay_tail_consumer` coexist on the feature branch between 062 and 063 merges; neither is reachable from production until the branch lands as one merge (D-v2.5-11).
- Frontend wiring (POST→`{run_id}` flow, on-(re)connect reconcile via `active-runs`, Resume button on failed runs) — **Phase 063**.
- Browser-MCP scenario harness for refresh-mid-stream / multi-tab sync / Symptom E/F/G/H — **Phase 064**.
- Skills test infrastructure repair — Phase 065.
- Cross-worker coordination if uvicorn ever scales to `--workers N>1`. Single-worker (D-v2.5-02) keeps `RUN_TASKS` per-process; DELETE is a local lookup. Out of v2.5.
- Abandoned-run sweeper (no-consumer-for-N-min cancellation) — explicitly deferred per D-061-02. The 120s `run_hard_timeout_seconds` remains the sole bound.
- Cleanup of `runs:active` / `runs_by_thread:{thread_id}` sorted-set entries when their referenced `run:{run_id}` Stream key EXPIREs. 061 chose passive cleanup at query time. 062 inherits this — active-runs filters by `WHERE status='streaming'` from Postgres, so stale sorted-set entries never surface. Revisit only if entry counts grow into the millions.
- Modifying `event_consumer()` at `threads.py:2065` or any of 061's producer code. Phase 061.1 owns the `ERR_INCOMPLETE_CHUNKED_ENCODING` diagnosis + WR-01 cursor `$` race fix in that region; 062 stays out to keep merge conflicts to zero.

</domain>

<decisions>
## Implementation Decisions

### Endpoint contracts

- **D-062-01 — POST `/threads/{id}/messages` is untouched in 062.** The new GET stream endpoint coexists with the legacy inline POST consumer until 063 cuts the frontend over and deletes the legacy path. Rationale: 061.1 is fixing `event_consumer()` (cursor `$` race, `ERR_INCOMPLETE_CHUNKED_ENCODING` consumer drop) in parallel; 062 modifying the same function would create merge conflicts on every plan. The dual-path window only exists on the long-lived `v2.5-stream` feature branch (D-v2.5-11) — production never sees it.

- **D-062-02 — `GET /threads/{thread_id}/active-runs` returns streaming-only.** Query: `SELECT run_id, started_at, status FROM public.runs WHERE thread_id = ? AND user_id = auth.uid() AND status = 'streaming' ORDER BY started_at DESC`. Uses the partial index `idx_runs_active` shipped in migration 035 (zero-row scan in the common case where no run is in flight). Terminal runs are reached via the existing `GET /threads/{thread_id}/messages` path. Rejected `?include_terminal=true` variant — adds API surface for an unproven UX need.

- **D-062-03 — Active-runs response items include no cursor; frontend always replays from `since=0`.** Per-item shape: `{run_id, started_at, status}`. Redis Stream entries are immutable + the per-run buffer is bounded by MAXLEN 10000 (≤ ~2MB), so a full replay on every reconnect is cheap; live-tail picks up new entries seamlessly. Rationale: skips an XINFO/XREVRANGE call per active run on the active-runs endpoint, simplifies the frontend (no cursor bookkeeping in 063), and keeps the response compact. Frontend dedupes by message structure on render.

- **D-062-04 — Active-runs response is a bare JSON array `list[ActiveRunResponse]`.** Matches existing project convention: `list_threads` (`threads.py:329`) returns `list[ThreadResponse]`; `get_messages` (`threads.py:494`) returns `list[MessageResponse]`. Empty case is `[]`. Pydantic `response_model=list[ActiveRunResponse]` on the route decorator.

### Stream endpoint behavior

- **D-062-05 — `GET /runs/{run_id}/stream?since={offset}` on already-terminal runs replays the buffer + closes.** Same consumer code path as live runs: open `EventSourceResponse(replay_tail_consumer(redis, run_id, since), ping=15)`, the consumer XREADs all entries from `since` to current head, the producer's terminal sentinel (`done` / `error` / `cancelled`) per D-061-12 is already in the buffer, the loop breaks on first sentinel match, response closes. Caller sees an identical wire shape regardless of run state at request time.

- **D-062-06 — TTL-expired run on stream endpoint emits a synthetic terminal event.** Detection: `await redis.exists(f"run:{run_id}")`. If 0: SELECT runs row by `run_id` (RLS-enforced via `.eq("user_id", current_user["id"])`); if row also missing → 404. Otherwise translate `runs.status` via `_RUN_STATUS_TO_TERMINAL_TYPE` (`completed→done`, `failed→error`, `cancelled→cancelled`; `streaming` shouldn't happen at this branch — defensive: emit `error` with `error="buffer_expired_while_streaming"`); yield exactly one synthetic SSE entry with `{type: <mapped>, error: "buffer_expired", runs_status: <orig>}`; close. Frontend can render the appropriate terminal UI.

- **D-062-07 — `?since=` query param accepts any string; defaults to `"0"`; passed through to XREAD.** Per D-062-03, frontend always passes `0`. The param is preserved on the URL signature for forward-compat and ad-hoc client use (e.g., dev tools). Validation: minimal — Redis XREAD itself rejects malformed IDs with `ResponseError` which 062 catches and translates to 400. No schema enforcement of the Redis ID format (`<ms>-<seq>`) in 062 — keeps the surface small.

### Cancel verb (DELETE)

- **D-062-08 — DELETE auth check fetches the runs row first via aexec.** Before touching `RUN_TASKS`: `await aexec(supabase.table("runs").select("run_id, status, thread_id").eq("run_id", str(run_id)).eq("user_id", current_user["id"]).maybe_single())`. If no row → 404 (don't leak existence to other users). Same pattern as `send_message` at `threads.py:586-594`. Defense-in-depth alongside RLS — the SELECT itself is RLS-filtered.

- **D-062-09 — DELETE on already-terminal runs returns 204 silent.** If the SELECTed row's `status` is in `{completed, failed, cancelled}`: return 204 immediately, no further work. Matches ROADMAP SC#3 verbatim. Idempotent re-call has no observable effect.

- **D-062-10 — DELETE happy path: `task = RUN_TASKS.get(run_id); task.cancel()` → return 204.** Producer's existing `CancelledError` handler (already in `threads.py` at the `_terminal_status` declaration site) sets `_terminal_status='cancelled'`; the `_shielded_finalize` path UPDATEs the runs row, emits the `cancelled` terminal sentinel, EXPIREs 60s, ZREMs both sorted sets. The DELETE handler does NOT await task completion — return 204 immediately, finalization runs asynchronously. Connected stream consumers receive the terminal sentinel and close cleanly within the next XREAD BLOCK cycle (≤5s).

- **D-062-11 — DELETE on zombie heals: UPDATE Postgres + synthetic terminal event + ZREM + EXPIRE + 204.** When `runs.status='streaming'` but `RUN_TASKS[run_id]` is missing (process restarted, producer died without finalizing, etc.):
  1. `UPDATE runs SET status='cancelled', error='cancelled_by_user', completed_at=now() WHERE run_id = ?` (via aexec).
  2. `if await redis.exists(f"run:{run_id}"): await _emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")` — gives any attached consumers the sentinel they need to close.
  3. `await redis.zrem("runs:active", str(run_id))` and `await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))` — each wrapped in try/except matching the 061 pattern at `threads.py:642-643`.
  4. `await redis.expire(f"run:{run_id}", 60)` — failed/cancelled TTL bucket per D-061-04.
  5. Return 204.
  
  Rationale: user intent ("Stop my run") is respected even when the producer is dead. No 410/409 surface to push complexity onto the frontend.

### Auth & error semantics

- **D-062-12 — Cross-user access on stream/active-runs returns 404, not 403.** Pattern: every endpoint's first DB call applies both `.eq("run_id", ...)` (or `thread_id`) AND `.eq("user_id", current_user["id"])`. No row → 404. Don't leak existence to other users. Consistent with the existing `/threads/{id}/messages` pattern (`threads.py:586-594`).

- **D-062-13 — Redis-unreachable degradation is differentiated per endpoint.**
  - `GET /threads/{id}/active-runs` — purely Postgres-backed (D-062-02); Redis being down has no effect on this endpoint.
  - `GET /runs/{id}/stream` — returns 503 with `Retry-After: 10` header. No buffer means no replay possible; surfacing the truth is more honest than blocking.
  - `DELETE /runs/{id}` — Postgres UPDATE always succeeds (Postgres is the durable record). Each Redis call (synthetic XADD, ZREM × 2, EXPIRE) wrapped in try/except + `logger.exception` — per-call best-effort. Returns 204 even if all Redis ops fail. Maximizes graceful degradation: user can still see active runs and cancel them during a Redis outage; only the active stream surface is unavailable.
  
  Detection: catch `redis.exceptions.RedisError` (and asyncio timeouts) at the route boundary. Don't leak Redis tracebacks as 500s.

### Phase 062 file layout & router mounting

- **D-062-14 — New `backend/app/api/runs.py` for `/runs/*`; active-runs stays in `threads.py`.** Layout:
  - `backend/app/api/runs.py` — new file. Contains `router = APIRouter(prefix="/runs", tags=["runs"])`, `replay_tail_consumer()` async generator, `GET /runs/{run_id}/stream` route, `DELETE /runs/{run_id}` route. Imports `RUN_TASKS`, `TERMINAL_TYPES`, `_emit_terminal`, `_RUN_STATUS_TO_TERMINAL_TYPE` from `app.api.threads`.
  - `backend/app/api/threads.py` — append `GET /threads/{thread_id}/active-runs` route near `list_threads` at line 329. Single new function ~30 lines. No modifications to the POST handler, `agent_runner`, or `event_consumer`.
  - `backend/app/main.py` — register the new runs router alongside existing routers.
  
  Rationale: minimizes overlap with 061.1's parallel work in `threads.py` (which is fixing the existing `event_consumer` and `_shielded_finalize`). Active-runs naturally lives under the `/threads` prefix; the other two endpoints have a `/runs` prefix and naturally split out.

### Claude's Discretion

- Whether `RUN_TASKS`, `TERMINAL_TYPES`, `_emit_terminal`, and `_RUN_STATUS_TO_TERMINAL_TYPE` get extracted from `threads.py` into a new `backend/app/api/_run_registry.py` (cleaner imports, no `threads.py` ↔ `runs.py` cross-dependency) versus `runs.py` importing them directly from `threads.py` (smaller diff). Functionally equivalent. Recommendation: import directly in 062, consider extraction only if the cross-dependency creates test isolation pain. The same trade-off was Claude's Discretion in 061 (D-061-09 follow-up).
- Pydantic model location: `backend/app/models/run.py` (matches `models/thread.py`, `models/message.py` convention) versus inlined at top of `runs.py`. Default to a new `models/run.py` for symmetry.
- Whether `replay_tail_consumer` is an `async def` generator nested inside the route handler (closure-captured `redis`, `run_id`, `since`) or a module-level function with explicit parameters. 061 nested its `event_consumer` inside the handler; 062 can do the same for symmetry.
- Whether the 503 path on `GET /runs/{id}/stream` returns `Retry-After: 10` (recommended) versus a different value or no header at all.
- Test fixture organization — whether to add a new `_062_helpers.py` next to 061's `_run_helpers.py`, or extend the existing `_run_helpers.py`. Recommendation: extend the existing helper to keep the run-related test utilities together.
- Whether `DELETE /runs/{run_id}` returns plain `204 No Content` (FastAPI `Response(status_code=204)`) or `status.HTTP_204_NO_CONTENT` from `fastapi.status` (matches `delete_thread` at `threads.py:380`). Matter of style; pick the latter for consistency with existing deletes.
- Exact name for the synthetic terminal event's `error` field on TTL-expired runs — `"buffer_expired"` is the recommended discriminator string. Add to a constants block at top of `runs.py` if reused.
- Whether to add an `idx_runs_active`-aware `ORDER BY started_at DESC` to the active-runs query (recommended) or rely on insertion order (which is undefined under concurrent INSERTs).

</decisions>

<specifics>
## Specific Ideas

- **Endpoint paths exactly:** `GET /threads/{thread_id}/active-runs`, `GET /runs/{run_id}/stream` (query: `?since={string}`), `DELETE /runs/{run_id}`.
- **Path parameter typing:** `run_id: UUID` and `thread_id: UUID` — FastAPI auto-validates and rejects malformed UUIDs with 422 before any handler runs.
- **Pydantic response model:** `class ActiveRunResponse(BaseModel): run_id: UUID; started_at: datetime; status: str` (status is always `'streaming'` per D-062-02 but the field is on the wire for forward-compat with the rejected `?include_terminal` variant).
- **Replay-tail consumer skeleton (parameters and structure):**
  ```python
  async def replay_tail_consumer(redis, run_id: UUID, since: str = "0"):
      stream_key = f"run:{run_id}"
      last_id = since
      deadline = time_mod.monotonic() + settings.run_hard_timeout_seconds + 10
      try:
          # Phase 1: replay from `since` (no block)
          while True:
              if time_mod.monotonic() > deadline: ...; return
              result = await redis.xread(streams={stream_key: last_id}, count=100)
              if not result: break
              for _stream_name, entries in result:
                  for entry_id, fields in entries:
                      last_id = entry_id
                      yield {"data": fields["data"]}
                      if json.loads(fields["data"]).get("type") in TERMINAL_TYPES: return
          # Phase 2: live-tail
          last_id = "$"
          while True: ...  # mirrors 061's event_consumer at threads.py:2103-2122
      finally:
          pass  # consumer disconnect MUST NOT cancel producer (D-061-03 invariant)
  ```
- **Mental model:** `runs.py` owns the ephemeral-buffer surface (`/runs/*`); `threads.py` owns the thread-level surface (`/threads/{id}/active-runs`). The inline `event_consumer` at `threads.py:2065` and 062's `replay_tail_consumer` are independent functions with overlapping logic; consolidation is 063's responsibility.
- **Wire format unchanged:** every SSE entry is `{"data": "<json string>"}` per ARCHITECTURE.md SSE event-types table. Frontend in 063 will use one parser for both POST and GET stream endpoints.
- **Test filename pattern:** `backend/tests/integration/test_062_active_runs.py`, `test_062_stream_replay.py`, `test_062_stream_terminal.py`, `test_062_stream_ttl_expired.py`, `test_062_delete_happy.py`, `test_062_delete_zombie.py`, `test_062_delete_terminal_idempotent.py`, `test_062_cross_user_404.py`, `test_062_multi_consumer_fanout.py`. Reuse `redis_client` and `_flushdb_at_session_end` fixtures from 061 conftest.
- **Synthetic terminal-event `error` discriminators:** `"buffer_expired"` (TTL-expired run on stream endpoint), `"zombie_healed"` (DELETE on zombie's reason field), `"cancelled_by_user"` (runs.error column on DELETE-induced cancellation, distinct from the producer's own cancellation cause).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level decisions and milestone scope (LOCKED)
- `.planning/PROJECT.md` — Key Decisions table. **D-v2.5-08** (Redis Streams chosen over pgmq / LISTEN-NOTIFY), **D-v2.5-09** (LLM cost-shift mitigations — Stop / hard timeout / abandoned-TTL; specifics locked in 061-CONTEXT.md as D-061-01..04 and operationalized in 062 as the DELETE verb), **D-v2.5-10** (STREAM-02b absorbed by STREAM-04), **D-v2.5-11** (single-feature-branch deploy + `runs` Postgres table mandate). All four LOCKED upstream.
- `.planning/REQUIREMENTS.md` — **STREAM-04** acceptance text mandates the `GET /threads/{id}/active-runs` and `GET /runs/{id}/stream?since={offset}` endpoints + the `DELETE /runs/{id}` cancel verb + frontend reconcile-on-(re)connect. The DELETE verb is explicitly named in the requirement text. **Locked.**
- `.planning/ROADMAP.md` Phase 062 entry — Success Criteria #1–6 are the binding behavioural contract (active-runs filter + replay-and-tail semantics + DELETE idempotency + multi-consumer fan-out + RLS-enforced auth). The SC#6 deferral on POST contract is the explicit gate that this CONTEXT.md resolves (D-062-01). Risks/pitfalls section codifies the architectural traps to avoid (XREAD two-mode pattern, Redis errors as 503s not 500s, cheap active-runs index, Phase 063/064 hand-off boundary). **Locked.**

### Phase 061 hand-off (architectural foundation — REQUIRED reading)
- `.planning/phases/061-run-backed-streaming-backend/061-CONTEXT.md` — **D-061-01..17** are the building blocks 062 sits on. In particular: D-061-09 (status enum, error column, FK CASCADE), D-061-11 (RUN_TASKS registry, single-worker invariant, 062's DELETE looks up here), D-061-12 (consumer two-mode XREAD pattern, terminal sentinel discipline, deadline guard) — 062's `replay_tail_consumer` mirrors this exactly with one parameter difference (`since` instead of hardcoded `0`). D-061-03 contract inversion (consumer disconnect MUST NOT cancel producer) — 062's new consumer's `finally` is also a no-op for the same reason.
- `.planning/phases/061-run-backed-streaming-backend/061-VERIFICATION.md` — artifacts as actually shipped + 17/18 truth verification table. Concrete proof of which symbols exist at which line numbers in `threads.py`. Use this to find the exact import sites for 062.
- `supabase/migrations/035_runs_table.sql` — already shipped. The 11 columns, 2 indexes (including `idx_runs_active` partial index used by D-062-02), and SELECT-only RLS policy. 062 makes ZERO new schema changes.

### Operational guides
- `REDIS-SETUP.md` — local + cloud Redis setup, key conventions table (`run:{run_id}` Stream, `runs_by_thread:{thread_id}` sorted set, `runs:active` sorted set), TTL discipline (600s completed / 60s failed/cancelled). 062 inherits these conventions verbatim — no new keys introduced.
- `supabase/SETUP.md` — migration workflow. 062 does NOT add a migration. (If any planning step suggests a migration, that's a scope-creep red flag.)
- `docker-compose.dev.yml` — local Redis dev infra. CI workflow at `.github/workflows/backend-tests.yml` already has the Redis preamble (shipped in 061). 062 inherits.

### Phase 058/059/060 hand-off (lower-layer foundations)
- `.planning/phases/058-backend-sse-concurrency-fix/058-CONTEXT.md` — `aexec` pattern for sync supabase calls (D-058-03) used by every 062 DB call. AnyIO 200-token limiter (D-058-07) — unchanged.
- `.planning/phases/059-sse-architecture-refactor/059-CONTEXT.md` — `EventSourceResponse(generator, ping=15)` pattern that both 061's `event_consumer` and 062's `replay_tail_consumer` use. The wire-format JSON-in-data-field shape is locked here.
- `.planning/phases/060-frontend-race-fixes/060-CONTEXT.md` — frontend foundations Phase 063 will build on; not consumed by 062's backend work but useful for the planner to understand what 063 will subscribe to.

### Codebase landmarks (concrete edit/import sites for 062)
- `backend/app/api/threads.py:76` — `RUN_TASKS: dict[uuid.UUID, asyncio.Task]` registry. 062's DELETE imports this.
- `backend/app/api/threads.py:80` — `TERMINAL_TYPES = frozenset({"done", "error", "cancelled"})`. 062's `replay_tail_consumer` imports this.
- `backend/app/api/threads.py:87` — `_RUN_STATUS_TO_TERMINAL_TYPE` dict mapping runs.status → SSE TERMINAL_TYPES. Used by 062's TTL-expired synthetic terminal event (D-062-06) and zombie heal path (D-062-11).
- `backend/app/api/threads.py:111` — `_emit_terminal(redis, run_id, type, **fields)`. Used by 062's zombie heal to write the synthetic `cancelled` event.
- `backend/app/api/threads.py:329` — `list_threads` route. The `response_model=list[ThreadResponse]` pattern + Pydantic + APIRouter wiring is the template for 062's active-runs route.
- `backend/app/api/threads.py:380` — `delete_thread` route. The `status_code=status.HTTP_204_NO_CONTENT` pattern is the template for 062's DELETE.
- `backend/app/api/threads.py:494` — `get_messages` route. Query param + auth pattern reference.
- `backend/app/api/threads.py:578-594` — `send_message` thread-ownership SELECT pattern. The exact `.eq("id", thread_id).eq("user_id", current_user["id"]).single()` shape is what 062's runs-row SELECT mirrors (with `maybe_single()` so missing-row returns None instead of raising).
- `backend/app/api/threads.py:619-658` — runs row INSERT + ZADD pattern + try/except wrapping. 062's zombie heal mirrors the ZREM/EXPIRE try/except discipline.
- `backend/app/api/threads.py:2065-2130` — `event_consumer()` async generator. Full reference implementation of the two-mode XREAD pattern. **062's `replay_tail_consumer` mirrors this verbatim with `last_id = since` instead of `last_id = "0"` initialization.** Do NOT modify this function.
- `backend/app/dependencies.py` — `get_current_user`, `get_supabase`, `get_redis` (singleton). All three needed by 062's endpoints.
- `backend/app/utils/db.py::aexec` — wraps sync supabase `.execute()` in `run_in_threadpool`. Used by every 062 DB call (D-058-03 invariant).
- `backend/app/main.py` — router registration site. 062's new `runs.py` router needs `app.include_router(runs.router)` here.
- `backend/app/models/thread.py` and `backend/app/models/message.py` — Pydantic model precedents for `backend/app/models/run.py`.

### Test infrastructure (inherited from 061)
- `backend/tests/conftest.py:172-222` — `redis_client` function-scoped async fixture + `_flushdb_at_session_end` session-autouse. Reused by all 062 integration tests.
- `backend/tests/integration/_run_helpers.py` — shared `_extract_run_id_from_mock` helper. Extend (not duplicate) for 062 needs.
- `backend/tests/integration/test_058_concurrency.py` — slow-mock-LLM fixture. Reuse for 062 multi-consumer fan-out test (need a deterministic streaming window).
- `backend/tests/integration/test_061_producer_survives_disconnect.py` — pattern reference for 062's tests that need a real producer + Redis Stream + auth + Postgres runs row.
- `.github/workflows/backend-tests.yml` — already provisions Redis before pytest. 062 needs no CI changes.

### Codebase intelligence
- `.planning/codebase/STACK.md` — Python 3.12.6, FastAPI 0.115.6. `redis>=5.2,<8` pinned in `requirements.txt:18` per 061.
- `.planning/codebase/ARCHITECTURE.md` — SSE event-types table (line 130+). Wire format `data: {"type": "...", ...}\n\n` unchanged in 062.
- `.planning/codebase/INTEGRATIONS.md` — environment-variable conventions and dependency wiring patterns.

### Out-of-scope context (read for boundary, do NOT implement here)
- ROADMAP Phase 063 — frontend wiring. The wire format that 062 ships is what 063's frontend consumes. POST→JSON cut + frontend on-(re)connect reconcile + Resume button on `failed` runs all live in 063.
- ROADMAP Phase 064 — browser-MCP scenario harness. The multi-tab fan-out / refresh-mid-stream / Symptom E/F/G/H validation is owned there, not in 062 integration tests.
- Phase 061.1 (parallel cleanup) — fixes `event_consumer` cursor `$` race (WR-01) + `ERR_INCOMPLETE_CHUNKED_ENCODING` + 5 test-pattern races + WR-04/06/07 + IN-01..04. **062 must not modify any code in `event_consumer` or `agent_runner` or `_shielded_finalize` to avoid merge conflicts.** D-062-14 file layout enforces this physically.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`RUN_TASKS` module-level dict at `threads.py:76`** — single source of truth for in-flight producer tasks. 062's DELETE imports and reads from it; never re-creates a parallel registry.
- **`TERMINAL_TYPES`, `_emit_terminal()`, `_RUN_STATUS_TO_TERMINAL_TYPE` at `threads.py:80-125`** — all reused in 062 for zombie heal (`_emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")`) and TTL-expired synthetic terminal event.
- **`event_consumer` two-mode XREAD pattern at `threads.py:2065-2130`** — REFERENCE only (do not modify). 062's `replay_tail_consumer` is a parallel implementation with one parameter difference (`since` initialization).
- **`aexec(query)` at `backend/app/utils/db.py`** — wraps sync supabase `.execute()` in `run_in_threadpool`. Used by every 062 DB call.
- **`get_redis()` singleton at `backend/app/dependencies.py:23`** — async Redis client. 062 endpoints declare `redis: aioredis.Redis = Depends(get_redis)`.
- **`get_current_user` dependency** — auth bearer token → user dict. Same dependency on every 062 endpoint.
- **058's slow-mock-LLM fixture** — deterministic streaming windows for the multi-consumer fan-out test in 062.
- **061's `redis_client` + `_flushdb_at_session_end` fixtures (`conftest.py:172-222`)** — reused unchanged.
- **Existing thread-ownership SELECT pattern (`send_message` at `threads.py:586-594`)** — template for 062's runs-row ownership check (with `maybe_single()` substituting for `single()` to make missing rows non-fatal).
- **Existing `delete_thread` 204 pattern (`threads.py:380`)** — template for 062's `DELETE /runs/{run_id}` route signature.

### Established Patterns

- **All Supabase calls in async paths go through `aexec`** since 058 (D-058-03). 062 introduces zero new sync DB calls.
- **404 not 403 for ownership mismatches** — established convention (`threads.py:586-594`, `get_messages`). 062 inherits.
- **`asyncio.shield` is NOT needed in 062** — no producer-side critical sections in 062's code path. 062 endpoints are CRUD + a stateless consumer; cancellation of an HTTP request handler doesn't risk a partial DB write.
- **Pydantic `response_model` on every route decorator** — typed wire shape, OpenAPI doc, automatic validation. 062 endpoints all declare `response_model`.
- **Single uvicorn worker (D-v2.5-02)** — `RUN_TASKS` is per-process; DELETE is a local-memory lookup; no Redis pub/sub needed. Out-of-scope: cross-worker coordination if uvicorn ever scales (carried forward from 061's deferred list).
- **Redis call try/except + `logger.exception` discipline** — established at `threads.py:642-643` for ZADD. 062 mirrors for ZREM, synthetic XADD, EXPIRE in the zombie heal and DELETE happy paths.

### Integration Points

- **062 imports from `app.api.threads`:** `RUN_TASKS`, `TERMINAL_TYPES`, `_emit_terminal`, `_RUN_STATUS_TO_TERMINAL_TYPE`. This creates a `runs.py → threads.py` import dependency. Acceptable today (single-direction). If extraction to `_run_registry.py` happens later, `runs.py` and `threads.py` both import from there; this is the cleaner long-term shape but not required in 062.
- **062's stream endpoint (`GET /runs/{id}/stream`) and 061's POST handler both XREAD from `run:{run_id}`.** Multi-consumer fan-out works at the Redis layer (XREAD doesn't consume entries; it's a read cursor). Two attached consumers receive the same sequence independently. This is the foundation for 063's multi-tab sync.
- **062's DELETE writes to the same `runs:active` and `runs_by_thread:{thread_id}` sorted sets that 061's POST writes to.** Symmetric ZADD/ZREM membership. The zombie heal path also ZREMs to keep the active set honest even when the producer is dead.
- **062's active-runs Postgres query uses `idx_runs_active` partial index** shipped in migration 035 — partial WHERE `status='streaming'` keeps the index physically tiny (terminal runs aren't in it).
- **Wire format byte-identical to 061** — `EventSourceResponse(replay_tail_consumer(...), ping=15)`. 063's frontend uses one parser for both POST and GET stream endpoints.
- **`/health` endpoint Redis ping (shipped in 061)** — operational visibility into Redis health. If 062's stream endpoint returns 503, the `/health` endpoint is the diagnostic surface (will report `"redis": "unreachable"`).

</code_context>

<deferred>
## Deferred Ideas

- **`?include_terminal=true` variant of GET active-runs** — opted for streaming-only filter (D-062-02). Revisit if 063's frontend needs to reconcile against just-completed runs in a way that the existing `GET /threads/{id}/messages` path doesn't satisfy.
- **Cursor-aware response from active-runs (`last_stream_id` field)** — opted to omit (D-062-03). Revisit if profiling shows the always-replay-from-zero approach causes meaningful frontend work on common reconnect patterns. Stream entries are immutable + buffer ≤ 2MB, so this is unlikely.
- **Wrapped response shape `{runs: [...], thread_id: '...'}`** — opted for bare list (D-062-04). Revisit only when adding response-level metadata (server timestamp, polling hint, etc.) is concretely needed.
- **`410 Gone` or `409 Conflict` on zombie DELETE** — opted to heal silently (D-062-11). Revisit if frontend telemetry shows zombie DELETEs are common (would suggest producer-crash patterns worth surfacing diagnostically).
- **Uniform 503 across all 062 endpoints when Redis is down** — opted for differentiated degradation (D-062-13). Revisit if operational complexity from per-endpoint behavior becomes painful (single signal "streaming infra down" is simpler).
- **POST→JSON cut + delete inline `event_consumer()` at `threads.py:2065`** — explicitly Phase 063 scope (D-062-01). Defers conflict with 061.1's parallel work in the same region.
- **Consumer unification (`event_consumer` and `replay_tail_consumer` collapse to one helper)** — Phase 063. The two functions exist in parallel until then.
- **`RUN_TASKS` extraction to `backend/app/api/_run_registry.py`** — Claude's Discretion. Recommended only if `runs.py → threads.py` cross-import creates test isolation pain; otherwise the directness is fine.
- **Cross-worker coordination if uvicorn ever scales to `--workers N>1`** — carried forward from 061. DELETE today is in-process; cross-worker would need Redis Pub/Sub or a `runs:cancel:{run_id}` poll-key.
- **Sweeper task for stale `runs:active` / `runs_by_thread:{id}` sorted-set entries** — carried forward from 061. Active-runs filtering by `status='streaming'` from Postgres makes stale Redis sorted-set entries invisible at the API layer; revisit only if entry counts grow into the millions.
- **`Retry-After` header value tuning on 503s** — recommended `Retry-After: 10`; revisit based on operational experience.
- **OpenAPI schema metadata polish** — Pydantic models are the source of truth; manual OpenAPI tweaks deferred unless docs render poorly.
- **Multi-tab E2E validation with browser MCP** — Phase 064 owns the harness. 062's integration tests exercise multi-consumer fan-out at the API layer (two pytest consumers of the same `run_id`); browser-level multi-tab is 064.
- **Resume button for `failed` runs** — Phase 063 (frontend). 062's stream endpoint serves the buffer that the Resume button would re-attach to (or the synthetic `error` event from D-062-06 if the buffer expired).

</deferred>

---

*Phase: 062-replay-tail-api*
*Context gathered: 2026-05-03*
