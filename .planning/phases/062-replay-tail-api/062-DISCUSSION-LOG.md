# Phase 062: Replay & Tail API - Discussion Log

**Date:** 2026-05-03
**Mode:** discuss (default)
**Outcome:** CONTEXT.md created — ready for `/gsd:plan-phase 062`

This document is a human-readable record of the discussion. It is NOT consumed by downstream agents; agents read `062-CONTEXT.md`.

---

## Area selection

**Question:** Which areas do you want to discuss for Phase 062 (Replay & Tail API)?

**Options presented:**
1. POST contract change — ROADMAP SC#6 explicit deferral
2. Active-runs filter & shape — what runs are returned, what fields per item
3. DELETE on zombie runs — happy path vs zombie/stale producer handling
4. Auth & error semantics — cross-user, Redis-down, idempotency

**User selected:** All four.

---

## Area 1 — POST contract change

**Question:** How should POST `/threads/{id}/messages` behave after 062?

**Options presented:**
- (A) Cut clean: POST returns JSON, no stream
- (B) Keep both paths in 062, cut in 063
- (C) POST returns `{message_id, run_id}` JSON

**User answer:** "you decide the best approach, consider also that we are fixing now in parallel some bugs in phase 061.1"

**Resolution (D-062-01):** Option B with a tweak — 062 leaves POST handler and inline `event_consumer()` at `threads.py:2065` completely untouched. 062 adds a *separate* `replay_tail_consumer(run_id, since)` for the new GET endpoint (parameterized by `since`, so it's not even the same function as 061's hardcoded `last_id="0"`). 063 owns the cut to POST→JSON and any consumer unification.

**Why:** Phase 061.1 is concurrently fixing `event_consumer` (`ERR_INCOMPLETE_CHUNKED_ENCODING` consumer drop, WR-01 cursor `$` race). If 062 also rewrites the same code, merge conflicts on every plan. With this split, 062 and 061.1 modify disjoint code regions. The dual-path window only exists on the long-lived `v2.5-stream` feature branch — production never sees it (D-v2.5-11 single-merge deploy).

---

## Area 2 — Active-runs filter & shape

### Question 2.1: Filter

**Question:** Which runs should `GET /threads/{id}/active-runs` return?

**Options:**
- (A) Streaming only (Recommended)
- (B) Streaming + recent terminal (within Redis TTL)
- (C) Streaming, plus optional `?include_terminal=true`

**User answer:** A — Streaming only.

**Resolution (D-062-02):** `WHERE status='streaming'` only. Uses `idx_runs_active` partial index from migration 035. Terminal runs are reached via existing `GET /threads/{id}/messages`.

### Question 2.2: Cursor

**Question:** What should the per-run response shape include for cursor/offset?

**Options:**
- (A) `last_stream_id` (Redis entry ID like '1759-0')
- (B) Omit cursor; frontend always replays from 0 (Recommended)
- (C) `xlen` event count

**User answer:** B — Omit cursor.

**Resolution (D-062-03):** Per-item shape is `{run_id, started_at, status}`. Frontend always opens `GET /runs/{run_id}/stream?since=0`. Stream entries are immutable + per-run buffer ≤ 2MB (MAXLEN 10000), so full replay is cheap; live-tail picks up new entries seamlessly.

### Question 2.3: Wire shape

**Question:** Bare list at root or wrapped object?

**Options:**
- (A) Bare list `[{...}, {...}]` (Recommended)
- (B) Wrapped `{runs: [...], thread_id: '...'}`

**User answer:** A — Bare list.

**Resolution (D-062-04):** Pydantic `response_model=list[ActiveRunResponse]`. Matches `list_threads` and `get_messages` conventions.

---

## Area 3 — DELETE on zombie runs

### Question 3.1: Zombie response

**Question:** When DELETE hits a zombie (`runs.status='streaming'` but task missing from `RUN_TASKS`), how should it respond?

**Options:**
- (A) Heal: UPDATE runs + emit synthetic terminal + 204 (Recommended)
- (B) Strict: 410 Gone with diagnostic body
- (C) 404

**User answer:** A — Heal.

**Resolution (D-062-11):** UPDATE Postgres `status='cancelled', error='cancelled_by_user', completed_at=now()`. If Redis stream key still exists, `_emit_terminal(redis, run_id, "cancelled", reason="zombie_healed")` so attached consumers close cleanly. ZREM both sorted sets (try/except). EXPIRE 60s (failed/cancelled bucket). Return 204.

### Question 3.2: Already-terminal idempotency

**Question:** DELETE on already-terminal runs — idempotency shape?

**Options:**
- (A) 204 silent (Recommended)
- (B) 200 with current status body

**User answer:** A — 204 silent.

**Resolution (D-062-09):** Always 204 No Content. Matches ROADMAP SC#3 verbatim.

### Question 3.3: Auth check ordering

**Question:** Auth check ordering for DELETE — verify ownership before or after looking at registry?

**Options:**
- (A) Postgres first (Recommended)
- (B) Registry first, then verify

**User answer:** A — Postgres first.

**Resolution (D-062-08):** Fetch the runs row first via `aexec` on a SELECT with `.eq("run_id", ...).eq("user_id", current_user["id"]).maybe_single()`. Missing → 404. Same pattern as `send_message` thread-ownership check at `threads.py:586-594`.

---

## Area 4 — Auth & error semantics

### Question 4.1: Cross-user

**Question:** GET `/runs/{run_id}/stream` when the run exists but is owned by a different user — response?

**Options:**
- (A) 404 (Recommended)
- (B) 403

**User answer:** A — 404.

**Resolution (D-062-12):** 404 Not Found. Don't leak existence. Matches existing project convention (`get_messages` 404 on foreign threads).

### Question 4.2: Redis down

**Question:** When Redis is unreachable, what should each endpoint do?

**Options:**
- (A) Differentiated: active-runs degrades to Postgres-only; stream returns 503; DELETE works on Postgres + skips Redis (Recommended)
- (B) Uniform 503

**User answer:** A — Differentiated.

**Resolution (D-062-13):** active-runs is purely Postgres-backed (Redis-down has no effect). Stream returns 503 with `Retry-After: 10`. DELETE: Postgres UPDATE always succeeds, each Redis call wrapped in try/except + `logger.exception`, returns 204 even if all Redis ops fail. Catch `redis.exceptions.RedisError` at the route boundary.

### Question 4.3: Terminal stream

**Question:** GET `/runs/{id}/stream` when run is already terminal — what does the response look like?

**Options:**
- (A) Replay buffer + immediate terminal sentinel + close (Recommended)
- (B) Refuse with 409 if status != 'streaming'

**User answer:** A — Replay buffer + close.

**Resolution (D-062-05, D-062-06):** Same consumer code path as live runs. The producer's terminal sentinel per D-061-12 is already in the buffer; consumer breaks naturally. If `await redis.exists(f"run:{run_id}")` is 0 (TTL expired), SELECT runs row, translate `runs.status` via `_RUN_STATUS_TO_TERMINAL_TYPE`, emit a synthetic terminal event with `error="buffer_expired"`, close. If runs row also missing → 404.

---

## Bonus question — File layout

**Question:** Where should 062's new endpoints live to minimize conflict with 061.1's parallel work in `threads.py`?

**Options:**
- (A) New `backend/app/api/runs.py` for stream + DELETE; active-runs in `threads.py` (Recommended)
- (B) All three in `threads.py`
- (C) All three in new `runs.py` with two prefixes

**User answer:** A.

**Resolution (D-062-14):** `backend/app/api/runs.py` (new) for `/runs/{id}/stream` + `DELETE /runs/{id}`. `GET /threads/{id}/active-runs` appends to existing `threads.py`. Mount runs router in `main.py`. 061.1 conflict surface = ~30 lines of new code in `threads.py` for active-runs, zero for the other two.

---

## Decisions index (for reference — full text in 062-CONTEXT.md)

| ID | Topic | Resolution |
|----|-------|------------|
| D-062-01 | POST handler | Untouched in 062; 063 owns the cut |
| D-062-02 | Active-runs filter | `WHERE status='streaming'` only |
| D-062-03 | Per-item cursor | None — frontend always replays from 0 |
| D-062-04 | Active-runs wire shape | Bare list |
| D-062-05 | Terminal-run stream | Replay + close (sentinel already in buffer) |
| D-062-06 | TTL-expired stream | Synthetic terminal event from runs row + close |
| D-062-07 | `?since=` param | Pass-through string, default `"0"` |
| D-062-08 | DELETE auth order | Postgres SELECT first (RLS-consistent) |
| D-062-09 | DELETE on terminal | 204 silent |
| D-062-10 | DELETE happy path | `task.cancel()` + 204 immediately |
| D-062-11 | DELETE zombie heal | UPDATE Postgres + synthetic sentinel + ZREM + EXPIRE + 204 |
| D-062-12 | Cross-user access | 404, never 403 |
| D-062-13 | Redis down | Differentiated per endpoint |
| D-062-14 | File layout | New `runs.py` for `/runs/*`; active-runs in `threads.py` |

---

## Deferred ideas captured

All scope-creep candidates redirected to `<deferred>` section of CONTEXT.md:
- `?include_terminal=true` variant of active-runs
- Cursor-aware response (`last_stream_id` field)
- Wrapped response shape
- 410/409 on zombie DELETE
- Uniform 503 across all endpoints
- POST→JSON cut → Phase 063
- Consumer unification → Phase 063
- `RUN_TASKS` extraction to `_run_registry.py` → Claude's Discretion in 062
- Cross-worker coordination → out of v2.5
- Sorted-set sweeper → carried forward from 061
- Resume button → Phase 063 (frontend)
- Multi-tab E2E with browser MCP → Phase 064

---

*Discussion completed: 2026-05-03*
