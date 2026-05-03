---
phase: 062
slug: replay-tail-api
status: ready_to_verify
nyquist_compliant: false   # toggle to true after the verifier executes the canonical sweep
last_updated: 2026-05-03
inherited_exclusions:
  - test_normal_stream_unchanged              # DEF-061.1-01 carried forward
  - test_failed_run_expires_60s               # DEF-061.1-02 carried forward
  - test_120s_timeout_fires_full_finally      # DEF-061.1-02 carried forward
  - test_producer_continues_after_consumer_disconnect  # DEF-061.1-02 carried forward
---

# Phase 062 — Replay & Tail API Verification

## 1. Phase Scope

Phase 062 surfaces the durable Redis Stream buffer shipped in Phase 061 as a clean
HTTP API: `GET /threads/{tid}/active-runs`, `GET /runs/{rid}/stream?since={offset}`,
`DELETE /runs/{rid}`. This document is the single source of truth for `/gsd:verify-work`.

Per D-062-14 file layout: active-runs lives in `app.api.threads`; stream + delete
live in the new `app.api.runs` module. Zero new schema (uses migration 035 from
Phase 061). Zero new dependencies. Zero modifications to `event_consumer`,
`agent_runner`, `_shielded_finalize`, `send_message` — those regions are
physically out of scope to keep merge surface zero with any parallel work
(Phase 061.1 cleanup phase runs concurrently on the same `v2.5-stream` feature
branch per D-v2.5-11).

See `062-CONTEXT.md` for full decision register (D-062-01..16) and
`062-RESEARCH.md` for the patterns rationale.

## 2. Must-Haves Verification Table

Each row is one truth from a Plan 01-04 frontmatter `must_haves.truths`. Verify
by running the corresponding pytest target (or grep where stated).

| ID | Truth | Verified by | Status |
|----|-------|-------------|--------|
| T1  | GET /active-runs filter (D-062-02, SC#1) | `pytest tests/integration/test_062_active_runs.py::test_returns_streaming_only_filter` | ⬜ pending |
| T2  | GET /active-runs response shape (D-062-03, SC#1) | `pytest tests/integration/test_062_active_runs.py::test_returns_response_model_shape` | ⬜ pending |
| T3  | GET /active-runs empty case (D-062-04) | `pytest tests/integration/test_062_active_runs.py::test_empty_when_no_streaming` | ⬜ pending |
| T4  | GET /active-runs malformed UUID → 422 (D-062-04) | `pytest tests/integration/test_062_active_runs.py::test_malformed_uuid_returns_422` | ⬜ pending |
| T5  | GET /active-runs ownership SELECT first (D-062-12) | `pytest tests/integration/test_062_active_runs.py::test_thread_ownership_select_runs_first` | ⬜ pending |
| T6  | GET /stream replay-then-tail-to-terminal (SC#2, D-062-05) | `pytest tests/integration/test_062_stream_replay.py::test_replay_then_tail_to_terminal` | ⬜ pending |
| T7  | GET /stream cursor parameterization (D-062-07) | `pytest tests/integration/test_062_stream_replay.py::test_replay_from_specific_offset` | ⬜ pending |
| T8  | GET /stream already-terminal replays + closes (D-062-05) | `pytest tests/integration/test_062_stream_terminal.py::test_terminal_run_replays_and_closes` | ⬜ pending |
| T9  | GET /stream TTL-expired synthetic terminal — completed (D-062-06) | `pytest tests/integration/test_062_stream_ttl_expired.py::test_emits_synthetic_terminal_when_buffer_expired_completed` | ⬜ pending |
| T10 | GET /stream TTL-expired synthetic terminal — failed (D-062-06) | `pytest tests/integration/test_062_stream_ttl_expired.py::test_emits_synthetic_terminal_when_buffer_expired_failed` | ⬜ pending |
| T11 | GET /stream TTL-expired synthetic terminal — cancelled (D-062-06) | `pytest tests/integration/test_062_stream_ttl_expired.py::test_emits_synthetic_terminal_when_buffer_expired_cancelled` | ⬜ pending |
| T12 | GET /stream missing row → 404 (D-062-06) | `pytest tests/integration/test_062_stream_ttl_expired.py::test_404_when_runs_row_missing` | ⬜ pending |
| T13 | DELETE in-flight cancels producer (SC#3, D-062-10) | `pytest tests/integration/test_062_delete_happy.py::test_cancels_in_flight_producer` | ⬜ pending |
| T14 | DELETE zombie heal (D-062-11) | `pytest tests/integration/test_062_delete_zombie.py::test_heals_zombie_state` | ⬜ pending |
| T15 | DELETE on terminal (3 statuses) returns 204 silent (D-062-09) | `pytest tests/integration/test_062_delete_terminal_idempotent.py::test_terminal_returns_204_silent` (parametrized: completed/failed/cancelled) | ⬜ pending |
| T16 | Cross-user GET /active-runs → 404 (SC#5, T-062-01) | `pytest tests/integration/test_062_cross_user_404.py::test_active_runs_other_user_returns_404` | ⬜ pending |
| T17 | Cross-user GET /stream → 404 (SC#5, T-062-01) | `pytest tests/integration/test_062_cross_user_404.py::test_get_stream_other_user_returns_404` | ⬜ pending |
| T18 | Cross-user DELETE → 404 (SC#5, T-062-01, T-062-02) | `pytest tests/integration/test_062_cross_user_404.py::test_delete_other_user_returns_404` | ⬜ pending |
| T19 | Multi-consumer fan-out — identical sequences (SC#4, T-062-04) | `pytest tests/integration/test_062_multi_consumer_fanout.py::test_two_consumers_receive_identical_sequences` | ⬜ pending |
| T20 | Redis-down stream → 503 + Retry-After: 10 (D-062-13, T-062-03) | `pytest tests/integration/test_062_redis_down.py::test_stream_returns_503_on_redis_unreachable` | ⬜ pending |
| T21 | Redis-down DELETE → 204 (D-062-13, T-062-03) | `pytest tests/integration/test_062_redis_down.py::test_delete_returns_204_on_redis_unreachable` | ⬜ pending |

**Total: 21 truths.** Verifier toggles each Status column to ✅ green / ❌ red /
⚠️ flaky after running the canonical sweep in Section 5.

## 3. Artifacts

One row per file in any plan's `files_modified` (read from each plan's
frontmatter). Notes column is filled by the verifier with the actual line
range of insertions.

| Path | Provides | Status | Notes |
|------|----------|--------|-------|
| `backend/app/models/run.py` | ActiveRunResponse Pydantic model | ⬜ pending | Plan 01 — created (24 lines) |
| `backend/app/api/threads.py` (modified) | `list_active_runs` route appended | ⬜ pending | Plan 01 — 45 insertions / 0 deletions; insertion between former `list_threads` (ends ~line 440) and `create_thread` (starts ~line 487) |
| `backend/app/api/runs.py` | New module: `replay_tail_consumer` + `_synthetic_terminal_generator` + GET /stream + DELETE /{run_id} | ⬜ pending | Plans 02 + 03 — created; ~242 lines after Plan 02; Plan 03 appends `cancel_run` route |
| `backend/app/main.py` (modified) | `runs.router` registered | ⬜ pending | Plan 02 — 2-line change (import + include_router) |
| `backend/tests/integration/_run_helpers.py` (modified) | `setup_zombie_state` helper appended (if Plan 03 needs it) | ⬜ pending | Plan 03 — fill if helper added |
| `backend/tests/integration/test_062_active_runs.py` | SC#1 + ownership coverage (5 tests) | ⬜ pending | Plan 01 — created (~203 lines) |
| `backend/tests/integration/test_062_stream_replay.py` | SC#2 replay-tail coverage (2 tests) | ⬜ pending | Plan 02 — created (~165 lines) |
| `backend/tests/integration/test_062_stream_terminal.py` | SC#2 already-terminal coverage (1 test) | ⬜ pending | Plan 02 — created (~75 lines) |
| `backend/tests/integration/test_062_stream_ttl_expired.py` | D-062-06 TTL-expired coverage (4 tests) | ⬜ pending | Plan 02 — created (~190 lines) |
| `backend/tests/integration/test_062_delete_happy.py` | SC#3 happy path coverage (1 test) | ⬜ pending | Plan 03 — created |
| `backend/tests/integration/test_062_delete_zombie.py` | D-062-11 zombie heal coverage (1 test) | ⬜ pending | Plan 03 — created |
| `backend/tests/integration/test_062_delete_terminal_idempotent.py` | D-062-09 idempotency coverage (3 parametrized tests) | ⬜ pending | Plan 03 — created |
| `backend/tests/integration/test_062_cross_user_404.py` (modified) | SC#5 cross-user coverage (3 tests across all 3 endpoints) | ⬜ pending | Plan 01 created; Plan 02 appended `test_get_stream_other_user_returns_404`; Plan 03 appended `test_delete_other_user_returns_404` |
| `backend/tests/integration/test_062_multi_consumer_fanout.py` | SC#4 multi-consumer coverage (1 test) | ⬜ pending | Plan 04 — created (~175 lines) |
| `backend/tests/integration/test_062_redis_down.py` | D-062-13 degradation coverage (2 tests) | ⬜ pending | Plan 04 — created (~190 lines) |

## 4. Key Links

Each row is from a plan's frontmatter `key_links`. Verifier confirms each
pattern via `grep` (or `rg`) against the shipped code.

| From | To | Via | Pattern (verifiable via grep) |
|------|----|-----|-------------------------------|
| `threads.py:list_active_runs` | `app/models/run.py` | `from app.models.run import ActiveRunResponse` | `from app\.models\.run import ActiveRunResponse` |
| `runs.py` | `app/api/threads.py` | `from app.api.threads import RUN_TASKS, TERMINAL_TYPES, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE` | `from app\.api\.threads import.*RUN_TASKS` |
| `runs.py:stream_run` | sse-starlette + redis | `EventSourceResponse(replay_tail_consumer(...), ping=None)` | `EventSourceResponse\(.*ping=None` |
| `runs.py:cancel_run` | `RUN_TASKS` registry | `RUN_TASKS.get(run_id).cancel()` (in-flight); `_emit_terminal(reason="zombie_healed")` (zombie) | `RUN_TASKS\.get\(.*task\.cancel\(\)\|reason="zombie_healed"` |
| `main.py` | `runs.router` | `app.include_router(runs.router)` | `app\.include_router\(runs\.router\)` |
| `runs.py` | `redis.exceptions` | Top-level `from redis.exceptions import RedisError` (NOT `import redis.exceptions` — variable shadowing on the route's `redis` parameter) | `^from redis\.exceptions import RedisError` |
| `test_062_multi_consumer_fanout.py` | `runs.py` (parallel consumers) | Two `httpx.AsyncClient.stream` calls against `/runs/{rid}/stream` via `asyncio.gather` | `asyncio\.gather\(\s*_consume_stream\(c1` |
| `test_062_redis_down.py` | `app.dependencies.get_redis` | `app.dependency_overrides[get_redis] = lambda: dead_redis` (mock raising `redis.exceptions.ConnectionError`) | `redis\.exceptions\.ConnectionError` |

## 5. Canonical Pytest Command Bundle

Copy-paste for `/gsd:verify-work`. All commands assume `cd backend &&` prefix
and `venv/Scripts/python` interpreter (Windows; substitute `venv/bin/python` on
POSIX).

```bash
# 1) 062-only fast sweep — runs ~20 tests in ~30s
cd backend && venv\Scripts\python -m pytest tests/integration/test_062_*.py -v --tb=short

# 2) Full suite with inherited DEF-061.1-01 + DEF-061.1-02 exclusions.
#    The -k filter is the canonical regression sweep clause — do not change it
#    without updating Section 7 (DEF-061.1-02 disposition) and the
#    `inherited_exclusions` frontmatter list.
cd backend && venv\Scripts\python -m pytest tests/integration/ tests/unit/ -v -k "not (test_normal_stream_unchanged or test_failed_run_expires_60s or test_120s_timeout_fires_full_finally or test_producer_continues_after_consumer_disconnect)"

# 3) 058/059/061 binding tests — no regression check (D-062-14 + D-061-16 contracts)
cd backend && venv\Scripts\python -m pytest tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect tests/integration/test_061_consumer_cursor_race.py -x --tb=short
```

## 6. Manual Two-Tab DevTools Checklist (Human Backstop — `human_needed`)

Per CONTEXT.md "in scope" + ROADMAP Phase 064 deferral. Multi-tab automation is
Phase 064's responsibility (browser-MCP harness); 062 covers multi-consumer
fan-out at the API layer (T19) and provides this manual checklist for end-to-end
smoke confirmation. Each step is `human_needed` per the verifier convention.

1. Open Tab A on a thread → send long message → see SSE streaming. ⬜
2. Open Tab B on same thread → call `GET /threads/{tid}/active-runs` in DevTools
   console (or curl) → see one streaming row with the in-flight `run_id`. ⬜
3. In Tab B: open `GET /runs/{rid}/stream?since=0` (curl or `EventSource` in
   console) → see backlog replay then live-tail in sync with Tab A. ⬜
4. In Tab B: trigger
   `fetch('/runs/{rid}', {method: 'DELETE', headers: {Authorization: 'Bearer <token>'}})`
   → both tabs receive `cancelled` terminal event within ~5s; both close cleanly. ⬜
5. After completion: `GET /threads/{tid}/active-runs` returns `[]`. ⬜
6. Wait 11 minutes after completion: `redis-cli XLEN run:{rid}` returns 0
   (TTL expired); `GET /runs/{rid}/stream` returns synthetic terminal
   `{"type":"done","error":"buffer_expired",...}`. ⬜
7. Cross-user: log in as different user, attempt `GET /runs/{rid}/stream` → 404;
   `GET /threads/{tid}/active-runs` → `[]`. ⬜

Mark each step ✅/❌ and capture screenshots if any step fails. The checklist
backstops T6-T7, T9-T11, T16-T17 with wall-clock evidence the integration tests
cannot provide (Redis TTL expiry timing, real-browser SSE parsing, true
cross-tab coordination).

### Manual Redis-down smoke (D-062-13 wall-clock side)

The integration test `test_062_redis_down.py` exercises Redis-down via mock
fault injection (synchronous, deterministic). The wall-clock smoke confirms
the same behavior under real Redis container failure:

8. Stop the Redis container: `docker stop $(docker ps -q --filter ancestor=redis)`
   (or `docker compose -f docker-compose.dev.yml stop redis`). ⬜
9. `curl -N http://localhost:8000/runs/{any-uuid}/stream` → 503 with
   `Retry-After: 10` header. ⬜
10. `curl http://localhost:8000/threads/{tid}/active-runs` → 200 (Postgres-only
    path; D-062-13 differentiated degradation). ⬜
11. `curl -X DELETE http://localhost:8000/runs/{rid}` → 204 (Postgres UPDATE
    succeeds even with Redis down). ⬜
12. Restart Redis: `docker start <container>` (or `docker compose ... start redis`). ⬜

## 7. Inherited Deferral — DEF-061.1-02 Producer Exception Classifier

DEF-061.1-02 (the producer's exception classifier may be coercing failed runs
to `_terminal_status='completed'`) is carried forward to a future 061.2 phase
per the disposition recorded in `062-01-PLAN.md` frontmatter
`must_haves.deferred`.

Rationale (verbatim from Plan 01):

> The suspected fix lives at threads.py:2057-2076 (agent_runner exception
> classifier) — a region D-062-14 physically partitions OUT of 062's scope
> to prevent merge conflicts on the v2.5-stream feature branch. The
> misclassification only affects audit metadata: a wrong-bucket 'completed'
> run is filtered OUT of active-runs anyway (D-062-02 SELECT WHERE
> status='streaming'), so 062's user-visible contract (active-runs / stream
> / delete UX) is unaffected. The TTL synthetic terminal mapping (D-062-06)
> would map 'completed' → 'done' instead of 'failed' → 'error' in the rare
> case a misclassified run's buffer also expires — a minor wire-format
> issue, not a security or data-integrity issue.

The full-suite verify inherits 061.1's canonical `-k` exclusion clause
documented in Section 5 above. The four exclusions are:

| Exclusion | Source | Reason |
|-----------|--------|--------|
| `test_normal_stream_unchanged` | DEF-061.1-01 | Pure test cleanup — expects old `stream_end` event name |
| `test_failed_run_expires_60s` | DEF-061.1-02 | Suspected classifier bug — TTL=600 instead of 30-65 |
| `test_120s_timeout_fires_full_finally` | DEF-061.1-02 | Same classifier bug — terminal-status / TTL mismatch |
| `test_producer_continues_after_consumer_disconnect` | DEF-061.1-02 | Same classifier bug — finalize ordering interaction |

DEF-061.1-01 disposition stays "future test cleanup phase" (no 062 implications).
DEF-061.1-02 disposition stays "future 061.2 cleanup phase" — see 062-01-PLAN
must_haves.deferred for the planner's decision rationale.

## 8. Threat-Model Verification

Each row mirrors the STRIDE threat register from each plan's frontmatter
`threat_refs` + the cross-cutting threats defined in 062-04-PLAN.md
`<threat_model>` block. Verifier confirms the mitigation is observable in code
(not just documented).

| Threat ID | Category | Mitigation observable in | Test |
|-----------|----------|--------------------------|------|
| T-062-01 | Information Disclosure (cross-user IDOR) | `.eq("user_id", current_user["id"])` in all 3 endpoints + 404-not-403 (D-062-12) | `test_062_cross_user_404.py` (3 tests — T16/T17/T18) |
| T-062-02 | Tampering (cross-user cancel) | DELETE auth check happens BEFORE `RUN_TASKS.get` (Plan 03 D-062-08 step 1 ordering) | `test_062_cross_user_404.py::test_delete_other_user_returns_404` (T18) |
| T-062-03 | Information Disclosure (stack-trace leak) + DoS | `redis.exceptions.RedisError` + `asyncio.TimeoutError` caught at route boundary; generic 503/204 returned (D-062-13) | `test_062_redis_down.py` (2 tests — T20/T21) |
| T-062-04 | DoS (parallel-consumer connection exhaustion) | Accept disposition; bounded by deadline (`run_hard_timeout_seconds + 10`) + bounded aioredis connection pool. Future production mitigation (max_connections tuning + per-user rate limit) explicitly out of 062 scope per CONTEXT.md "Out of Scope" + Plan 02 threat_model. | `test_062_multi_consumer_fanout.py` (T19) — proves fan-out works correctly at small scale; production-scale degradation observed via `/health` Redis status |

## 9. Sign-Off Checklist

- [ ] All 21 truths in Section 2 verified via canonical sweep (Section 5)
- [ ] All 15 artifacts in Section 3 confirmed shipped (line ranges populated in Notes)
- [ ] All 8 key links in Section 4 grep-verified
- [ ] Manual two-tab DevTools checklist (Section 6, steps 1-7) executed; result documented inline
- [ ] Manual Redis-down smoke (Section 6, steps 8-12) executed; result documented inline
- [ ] No regression in 058/059/061 binding tests (Section 5 command 3)
- [ ] DEF-061.1-02 deferral acknowledged; `-k` exclusion clause used as documented (Section 7)
- [ ] All four T-062-NN threat mitigations observable in code (Section 8)
- [ ] Frontmatter `nyquist_compliant: true` toggled by verifier after green
- [ ] Frontmatter `last_updated` bumped to verification date
