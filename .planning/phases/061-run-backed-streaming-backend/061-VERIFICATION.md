# Phase 061 — Verification

**Phase:** 061-run-backed-streaming-backend
**Goal:** Generation lifetime decoupled from any single HTTP request — the agent producer task writes tokens to a durable per-run buffer in Redis Streams; the SSE handler is a consumer with offset cursor.
**Requirement:** STREAM-04 (foundation layer)
**Status:** static checks green; runtime suite + manual two-tab DevTools checklist pending verifier execution
**Reviewer note:** This phase intentionally INVERTS the 059 disconnect-cancel contract — see Section "Contract Inversion" below before flagging the test rewrite as a regression.

## Mental Model (recap from CONTEXT.md)

- Redis Stream `run:{run_id}` = the event buffer (ephemeral, TTL 600s completed / 60s failed)
- Postgres `public.runs` = the lifecycle record (durable; `runs.status` ∈ {streaming, completed, failed, cancelled})
- The `asyncio.Queue` from 059 is GONE — producer XADDs to Redis; consumer XREADs from Redis
- Producer task lifetime is decoupled from the SSE consumer: killing the consumer does NOT kill the producer (D-061-03)

## Binding Test Results

The 11 binding tests below map verbatim to VALIDATION.md rows 01..11. Each row lists the exact pytest command the verifier (or `/gsd:verify-work`) executes.

| Test | VALIDATION.md ID | Command | Status |
|------|------------------|---------|--------|
| _emit XADD shape | TBD-01 | `cd backend && venv/Scripts/pytest tests/unit/test_061_emit_helper.py::test_emit_xadds_data_field -x` | pending verifier run |
| Consumer last_id advancement | TBD-02 | `cd backend && venv/Scripts/pytest tests/unit/test_061_consumer.py::test_xread_advances_last_id -x` | pending verifier run |
| /health Redis status | TBD-03 | `cd backend && venv/Scripts/pytest tests/unit/test_health.py::test_health_includes_redis_status -x` | pending verifier run |
| Producer survives disconnect (D-061-15) | TBD-04 | `cd backend && venv/Scripts/pytest tests/integration/test_061_producer_survives_disconnect.py::test_producer_continues_after_consumer_disconnect -x` | pending verifier run |
| EXPIRE 600 (completed) + EXPIRE 60 (failed) | TBD-05 | `cd backend && venv/Scripts/pytest tests/integration/test_061_ttl.py -x` | pending verifier run |
| runs row INSERT/UPDATE | TBD-06 | `cd backend && venv/Scripts/pytest tests/integration/test_061_runs_table.py::test_runs_lifecycle_row -x` | pending verifier run |
| RLS policy present in full-schema.sql | TBD-07 (deviation) | `cd backend && venv/Scripts/pytest tests/integration/test_061_runs_table.py::test_rls_policy_present_in_full_schema -x` | pending verifier run |
| 120s asyncio.timeout end-to-end | TBD-08 | `cd backend && venv/Scripts/pytest tests/integration/test_061_hard_timeout.py::test_120s_timeout_fires_full_finally -x` | pending verifier run |
| Disconnect contract INVERTED | TBD-09 | `cd backend && venv/Scripts/pytest tests/integration/test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect -x` | pending verifier run |
| 058 cross-tab regression | TBD-10 | `cd backend && venv/Scripts/pytest tests/integration/test_058_concurrency.py -x` | pending verifier run |
| 060 e2e thread-race regression | TBD-11 | `npx playwright test e2e/tests/060-thread-race.spec.ts` | pending — frontend-running gate |

**Static gate (already green at Plan 05 commit time):**

- All 8 test files exist and parse cleanly (Python AST)
- All grep-count acceptance criteria from 061-05-PLAN.md pass (see 061-05-SUMMARY.md)
- `_run_helpers.py` shared helper exists with `_extract_run_id_from_mock` defined
- `_build_mock_supabase` in `test_058_concurrency.py` routes the `runs` table
- `test_059_disconnect.py` rewrite asserts the new contract (XLEN growth post-disconnect)
- `test_059_disconnect.py` no longer contains the original `count_after == 0` assertion
- File docstring + commit message both reference D-v2.5-08 + Phase 061 + D-061-16

**Runtime gate (pending verifier execution):** the table above. Direct `venv/Scripts/python` invocation is sandbox-blocked from the executor; the runtime test suite is run by the verifier or by the user via `cd backend && venv/Scripts/pytest tests/unit/test_061_*.py tests/unit/test_health.py tests/integration/test_061_*.py tests/integration/test_059_disconnect.py tests/integration/test_058_concurrency.py -q`.

## Contract Inversion (D-061-16) — IMPORTANT for reviewers

`tests/integration/test_059_disconnect.py::test_agent_task_cancels_on_disconnect` was rewritten to `test_agent_task_SURVIVES_on_disconnect`. **This is intentional, not a regression.**

Why: Phase 059 (CONCUR-02) required the producer to be cancelled within 1s of consumer disconnect. Phase 061 (D-v2.5-08, STREAM-04 foundation) requires the OPPOSITE — the producer must SURVIVE consumer disconnect so the run buffer fills regardless of whether anyone is listening, enabling refresh / multi-tab / navigate-away in 062-063.

Specifically inverted invariants (from the rewritten test's docstring):

- I1': producer XLEN GROWS for >= 5s after consumer disconnect (was: cancelled within 1s)
- I2': zero or more LLM calls fire after disconnect (was: zero)
- I3': consumer's finally is a no-op — does NOT call task.cancel (D-061-03)
- I4': shielded persist + runs UPDATE + EXPIRE all run in producer's finally (preserved from 059)

The CONCUR-02 cancel-on-disconnect contract is replaced by the **DELETE /runs/{id} cancel verb** in Phase 062 (same merge, D-v2.5-11). During the 061-only window the Stop button is intentionally a no-op backend-side; the 120s asyncio.timeout (D-061-01) is the sole bound on abandoned runs. Users never see this state because 061+062+063 ship as a single merge from a long-lived feature branch.

The commit that lands the rewrite (`test(061-05): invert disconnect-cancel contract per D-061-16`) explicitly cites D-v2.5-08, D-061-03, and D-061-16 in its message body so future reviewers running `git blame` on the test file have the rationale immediately at hand.

Refs: D-v2.5-08, D-v2.5-11, D-061-03, D-061-16

## Manual Two-Tab DevTools Timing Checklist

Mirror of 058/059 format. Run on a local dev environment with backend (`cd backend && venv/Scripts/python -m uvicorn app.main:app --port 8000 --reload`), frontend (`npm run dev`), Supabase (`supabase start`), and Redis (`docker compose -f docker-compose.dev.yml up -d`) all up.

| # | Action | Expected behavior | Pass? |
|---|--------|-------------------|-------|
| 1 | Tab A: send a long message that triggers a slow agent loop (multi-tool) | SSE events flow into Tab A; assistant message renders incrementally | ☐ |
| 2 | Tab A still streaming → close Tab A entirely | Tab A network connection closes; backend logs show consumer's finally completed but no `task.cancel()` was called | ☐ |
| 3 | Wait 30 seconds (well under the 600s completed-TTL window) | Backend logs show producer continuing to XADD events; Redis Insight (or `redis-cli XLEN run:{id}`) shows the Stream still growing | ☐ |
| 4 | Open Tab B on the same thread | Tab B's `loadMessages` reflects the (now-completed) assistant message body — terminal sentinel triggered the runs UPDATE which made the message visible | ☐ |
| 5 | Inspect `redis-cli XRANGE run:{run_id} - +` (run_id from Tab B's network panel — Phase 062 will surface this; 061 manual check uses Redis Insight) | All events visible including terminal `done` sentinel; XLEN > Tab A's last-rendered offset | ☐ |
| 6 | Inspect `psql ... -c "SELECT status, error, completed_at FROM public.runs WHERE thread_id='...'"` | Row exists with status='completed', completed_at non-null, error NULL | ☐ |
| 7 | Wait 11 minutes (past 600s completed TTL) | `redis-cli XLEN run:{id}` returns 0 (key expired); `public.runs` row still exists (durable record) | ☐ |
| 8 | (D-061-04 path) Send a message that exceeds 120s (configure a deliberately slow LLM mock or set `RUN_HARD_TIMEOUT_SECONDS=10` in `backend/.env`) | Producer's finally runs hard_timeout path: redis XLEN final entry has type='error' error='hard_timeout'; `public.runs` row has status='failed' error='hard_timeout'; `redis-cli TTL run:{id}` returns ≤ 60 | ☐ |

Reviewer signs off the manual checklist after all 8 rows pass.

## Cross-Tab GET <1s (058 invariant under 061 architecture)

058's cross-tab benchmark was: with Tab A streaming, an authenticated GET /threads/B/messages returns within 1 second. Under Phase 061's Redis-backed architecture, this STILL HOLDS:

- The producer's Redis writes are async-native (no AnyIO threadpool tokens consumed)
- The 200 AnyIO tokens (D-058-07) are still available for any blocking Supabase calls
- Cross-tab GET goes through `aexec` (D-058-03) which is unchanged

Verified by the 058 regression row above AND by an INLINE assertion inside `test_061_producer_survives_disconnect.py` — while the slow producer is mid-stream the test issues a parallel GET on `THREAD_B` and asserts elapsed < 1.0s. The inline assertion covers the CONTENDED-timing scenario D-061-15 explicitly asks for.

## Sign-off

- [ ] All 11 binding tests green (above)
- [ ] Manual two-tab DevTools checklist all 8 rows passed
- [ ] Contract inversion (D-061-16) reviewed and acknowledged
- [ ] Phase 062 prereqs met: RUN_TASKS registry, runs table, terminal sentinel, EXPIRE TTLs all wired

*Verified by:* <reviewer name>
*Date:* <YYYY-MM-DD>
