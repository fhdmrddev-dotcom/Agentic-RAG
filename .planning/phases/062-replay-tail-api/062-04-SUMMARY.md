---
phase: 062-replay-tail-api
plan: 04
subsystem: testing

tags: [sse, run-backed, multi-consumer, fanout, redis-down, fault-injection, verification, threat-model]

requires:
  - phase: 062-replay-tail-api
    plan: 02
    provides: "GET /runs/{run_id}/stream endpoint + replay_tail_consumer + RedisError shadow-safe imports — Plan 04 fan-out test exercises this end-to-end; Redis-down stream test verifies the 503 + Retry-After path implemented in Plan 02"
  - phase: 062-replay-tail-api
    plan: 03
    provides: "DELETE /runs/{run_id} endpoint — Plan 04's Redis-down DELETE test verifies the per-op try/except discipline implemented in Plan 03 (depends_on relationship; test will go GREEN once Plan 03 worktree merges)"
  - phase: 061.1-run-backed-streaming-cleanup
    provides: "DEF-061.1-02 disposition + canonical -k exclusion clause for the full-suite regression sweep"
provides:
  - "SC#4 multi-consumer fan-out coverage (test_062_multi_consumer_fanout.py — two parallel httpx consumers via asyncio.gather)"
  - "D-062-13 / T-062-03 Redis-down degradation coverage (test_062_redis_down.py — fault-injected dead Redis mock; 503+Retry-After on stream; 204 on DELETE)"
  - "062-VERIFICATION.md scaffold (9 sections, 21-row truths table, 4-row threat-model table, 7-step manual two-tab DevTools checklist + 5-step Redis-down smoke, canonical pytest command bundle, DEF-061.1-02 deferral) — the runbook /gsd:verify-work executes verbatim"
affects: [063-frontend-reconcile, 064-browser-mcp-harness, 061.2-deferred-classifier-fix]

tech-stack:
  added: []
  patterns:
    - "Two-parallel-httpx-AsyncClient + asyncio.gather pattern for multi-consumer fan-out tests — proven to work end-to-end against ASGITransport(app=app) without Pitfall 7 same-loop hang"
    - "MagicMock with `async def _raise(*a, **k): raise ConnectionError(...)` pattern for Redis fault injection — every method on the mock is the same coroutine reference, so any call site (exists/xadd/zrem/expire/xread/aclose) raises identically"
    - "VERIFICATION.md scaffold with 9 sections (frontmatter + scope + truths + artifacts + key links + commands + manual checklist + deferral + threat model + sign-off) mirroring 061-VERIFICATION.md format — copy-pasteable runbook for /gsd:verify-work"

key-files:
  created:
    - backend/tests/integration/test_062_multi_consumer_fanout.py
    - backend/tests/integration/test_062_redis_down.py
    - .planning/phases/062-replay-tail-api/062-VERIFICATION.md
  modified: []

key-decisions:
  - "Used the canonical parallel-httpx-AsyncClient pattern from RESEARCH Open Question 3 — empirically verified no same-loop Pitfall 7 hang under the ASGITransport+asyncio.gather configuration; data-layer fallback is documented but unused"
  - "Used CallingMode from app.services.openai_service (matches Plan 02's existing test convention) — the plan body's `from app.services.adaptive_streaming import CallingMode` reference was a stale import path; corrected silently per Rule 3"
  - "Redis fault injection via app.dependency_overrides[get_redis] (not monkeypatching app.dependencies._redis) — clean per-test isolation matching Plan 02's `_reset_redis_singleton` autouse rationale"
  - "DELETE-side Redis-down test ships the assertion bodies even though Plan 03's DELETE route has not yet merged into this worktree (parallel execution); test is RED with HTTP 404 as expected per the plan's explicit `depends_on: [062-03]` clause and `tests run cleanly OR RED with a clear gap` allowance"

patterns-established:
  - "Multi-consumer end-to-end fan-out test pattern: spawn producer via POST→slow-mock-LLM, extract run_id, configure runs SELECT mock for streaming row, spin up TWO independent AsyncClient+ASGITransport instances, drain via asyncio.gather, assert events1 == events2 + last in TERMINAL_TYPES"
  - "Redis fault-injection test pattern: build a MagicMock with one shared `async def _raise: raise ConnectionError(...)` coroutine assigned to every method (exists/xadd/zrem/expire/xread/aclose); register via app.dependency_overrides[get_redis]; the route's per-op try/except discipline either degrades gracefully (503/204) or leaks (500 = T-062-03 violation)"
  - "VERIFICATION.md scaffold pattern (9 sections): frontmatter w/ inherited_exclusions list → 1.scope → 2.truths table (one row per plan must-haves.truths) → 3.artifacts table (one row per files_modified) → 4.key_links table → 5.canonical pytest bundle → 6.manual checklist (human_needed) → 7.inherited deferrals → 8.threat-model verification (one row per T-NNN-NN) → 9.sign-off"

requirements-completed: [STREAM-04]

duration: 6min
completed: 2026-05-03
---

# Phase 062 Plan 04: Cross-Cutting Tests + Verification Scaffold Summary

**SC#4 multi-consumer fan-out + D-062-13 Redis-down degradation tests shipped (3 test fns); 062-VERIFICATION.md scaffold (9 sections, 21 truths, 4 threats, 12-step manual checklist) ready for /gsd:verify-work.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-03T10:43:14Z
- **Completed:** 2026-05-03T10:49:17Z
- **Tasks:** 2 (T1 = both test files in one TDD step; T2 = VERIFICATION.md scaffold)
- **Files created:** 3 (2 integration test files, 1 verification document)
- **Files modified:** 0

## Accomplishments

- Shipped SC#4 multi-consumer fan-out coverage with the canonical parallel-httpx-AsyncClient + asyncio.gather pattern (no Pitfall 7 same-loop hang observed; data-layer fallback documented but unused — RESEARCH Open Question 3 resolved in favor of the truer end-to-end test)
- Shipped D-062-13 / T-062-03 Redis-down degradation coverage via dead-Redis MagicMock fault injection — stream side returns 503 + Retry-After: 10 (no 500 stack-trace leak); DELETE side asserts Postgres UPDATE landed even when every Redis op fails
- Shipped 062-VERIFICATION.md (9 sections, 227 lines) with the 21-row must-haves table covering every truth across Plans 01-04, 4-row threat-model verification table covering T-062-01..04, and the canonical pytest command bundle with the inherited DEF-061.1-01 + DEF-061.1-02 -k exclusion clause
- Phase 062 ready for `/gsd:verify-work` — the verifier copy-pastes Section 5 commands verbatim
- D-062-14 file-layout discipline holds: zero modifications to threads.py, runs.py, or any production code; all work is in tests + planning docs

## Task Commits

Each task was committed atomically (with `--no-verify` per parallel-worktree contract):

1. **Task 1: Wave 0 stubs for SC#4 + D-062-13** — `95348ec` (test) — 2 files / 367 insertions covering test_062_multi_consumer_fanout.py + test_062_redis_down.py
2. **Task 2: 062-VERIFICATION.md scaffold** — `28aacfd` (docs) — 1 file / 227 insertions, 9 sections, 21-row truths + 4-row threats

## Files Created/Modified

### Created

- **`backend/tests/integration/test_062_multi_consumer_fanout.py`** (~175 lines) — 1 test for SC#4:
  - `test_two_consumers_receive_identical_sequences` — drives POST `/threads/{tid}/messages` with slow-mock LLM patches (3 chunks @ 0.3s + done_chunk = ~1.5s of streaming); extracts run_id from mock; configures runs SELECT mock for streaming row; spins up TWO independent `httpx.AsyncClient` + `ASGITransport(app=app)` instances; drains both via `asyncio.gather(_consume_stream(c1, run_id), _consume_stream(c2, run_id))`; asserts `events1 == events2` + last event in TERMINAL_TYPES.
  - Includes `_reset_redis_singleton` autouse fixture (per Plan 02's Pitfall 6 pattern).
  - Module docstring documents the canonical-vs-fallback choice (RESEARCH Open Question 3) and the threat refs (T-062-04 small-scale fan-out test path).

- **`backend/tests/integration/test_062_redis_down.py`** (~190 lines) — 2 tests for D-062-13 / T-062-03:
  - `_build_dead_redis()` factory — returns a MagicMock with one shared `async def _raise: raise redis.exceptions.ConnectionError(...)` coroutine assigned to every method (`exists`, `xadd`, `zadd`, `zrem`, `expire`, `xread`, `aclose`).
  - `test_stream_returns_503_on_redis_unreachable` — registers dead-Redis via `app.dependency_overrides[get_redis]`; mocks runs SELECT to pass ownership; drives GET `/runs/{rid}/stream?since=0`; asserts HTTP 503 (not 500) + `Retry-After: 10` header.
  - `test_delete_returns_204_on_redis_unreachable` — same dead-Redis fault injection; mocks runs SELECT to return streaming row; drives DELETE `/runs/{rid}`; asserts HTTP 204 + asserts `runs.update` call_args_list contains `{status:'cancelled', error:'cancelled_by_user'}` payload (proves Postgres UPDATE happened FIRST in the zombie path per D-062-11 step ordering).

- **`.planning/phases/062-replay-tail-api/062-VERIFICATION.md`** (227 lines) — 9-section scaffold mirroring 061-VERIFICATION.md format:
  1. Phase Scope (1-paragraph summary referencing CONTEXT.md + D-062-14 file layout)
  2. Must-Haves Verification Table — 21 rows (T1-T21) covering every truth across Plans 01-04
  3. Artifacts Table — 15 rows covering every files_modified entry across all plans
  4. Key Links Table — 8 rows with grep-verifiable patterns
  5. Canonical Pytest Command Bundle — 062-only fast sweep + full-suite with inherited -k exclusions + 058/059/061 binding regression
  6. Manual Two-Tab DevTools Checklist (`human_needed`) — 7 steps for two-tab fan-out + 5 steps for Redis-down wall-clock smoke
  7. Inherited Deferral — DEF-061.1-02 verbatim rationale from Plan 01 + 4-row table of inherited exclusions
  8. Threat-Model Verification — 4 rows (T-062-01..04) with mitigation observable in code + binding test
  9. Sign-Off Checklist — 10 items the verifier ticks before flipping `nyquist_compliant: true`

### Modified

None. Per D-062-14 file-layout discipline, Plan 04 touches no production code — only tests + planning docs.

## Decisions Made

- **Canonical parallel-httpx-AsyncClient pattern adopted (not the data-layer fallback).** Per RESEARCH Open Question 3, the multi-consumer test attempted the canonical `asyncio.gather(consumer1, consumer2)` pattern first. Empirically: the test passed end-to-end on the first run with no Pitfall 7 same-loop hang. Both consumers received identical sequences (proving XREAD non-destructive fan-out at the Redis layer surfaces correctly through the route's per-request `replay_tail_consumer` instances). The data-layer fallback (one httpx + one direct `redis_client.xread`) is documented in the test's module docstring for future maintainers but ships unused.
- **`CallingMode` imported from `app.services.openai_service`** matching the existing `test_062_stream_replay.py` convention (Plan 02). The 062-04-PLAN body's verbatim test skeleton used `from app.services.adaptive_streaming import CallingMode` — that path does not exist in the codebase. Corrected silently per Rule 3 (blocking-issue auto-fix; the wrong import would have crashed the test at collect time).
- **`side_effect=lambda` (not `return_value=`) on `create_adaptive_streaming_chat` patch.** Matches Plan 02 convention. `_slow_chunks()` returns a sync generator; if the patch used `return_value=(iter(_slow_chunks()), ...)` then the iterator would be exhausted after the first call and any subsequent producer-side iteration would receive an exhausted iterator. The lambda gives each invocation a fresh generator.
- **Redis fault injection via `app.dependency_overrides[get_redis]` (not module-level `_deps._redis = mock` patching).** Plan 02 uses the latter for its `_reset_redis_singleton` fixture (which sets the singleton to None to force re-init); Plan 04 uses the former because `dependency_overrides` is the FastAPI-native path for swapping dependencies and gives clean per-test cleanup via `app.dependency_overrides.pop(get_redis, None)` in the finally block.
- **Plan 03's DELETE route is NOT in this worktree (parallel execution).** The DELETE-side Redis-down test ships its full assertion body and currently fails RED with HTTP 404 (no DELETE route registered). This is the expected state per the plan's `depends_on: [062-03]` clause and the `<done>` criteria allowance: "Tests run cleanly (either GREEN ... OR RED with a clear gap). Both outcomes are recorded in the SUMMARY." Once both Wave-2 worktrees merge back to v2.5-stream, the DELETE test will go GREEN (Plan 03's per-op try/except discipline + Postgres-UPDATE-first ordering are the contract being verified).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Corrected stale `CallingMode` import path**

- **Found during:** Task 1 (test file authoring — would have crashed at pytest collect time)
- **Issue:** The plan body's verbatim test skeleton used `from app.services.adaptive_streaming import CallingMode`. That module does not exist in the codebase — `CallingMode` is defined at `app/services/openai_service.py:743`. The existing Plan 02 test files (`test_062_stream_replay.py:23`) use `from app.services.openai_service import CallingMode`.
- **Fix:** Used the existing-convention import in `test_062_multi_consumer_fanout.py`: `from app.services.openai_service import CallingMode`.
- **Files modified:** `backend/tests/integration/test_062_multi_consumer_fanout.py`
- **Verification:** Test imports cleanly; the GREEN run shows `PASSED` for the multi-consumer test on the first attempt.
- **Committed in:** `95348ec` (Task 1 commit, with the corrected import already in place — fixed before commit).

---

**Total deviations:** 1 auto-fixed (blocking issue — Rule 3)
**Impact on plan:** No scope change. The fix is a single import-path correction matching the existing Plan 02 convention. All other plan-body verbatim code shipped unchanged.

## Issues Encountered

None. The TDD-style execution surfaced one stale-import path (documented above as the Rule 3 deviation) and one expected RED test (DELETE-side Redis-down, blocked on Plan 03 merging). Both were anticipated:

- The stale import is a planner-side typo against an old module name; the existing Plan 02 test file shows the correct path.
- The DELETE-side RED is explicit in the plan's `depends_on: [062-03]` clause and the `<done>` criteria allowance for "RED with a clear gap" outcomes.

## Multi-Consumer Fan-out Approach (RESEARCH Open Question 3 Resolution)

Per the plan's `<objective>` clause and RESEARCH Open Question 3: this plan
SHIPS the canonical parallel-`httpx.AsyncClient` pattern, NOT the data-layer
fallback.

**Empirical evidence:** The test passes end-to-end on the first run against
the existing `app.api.runs.replay_tail_consumer` (Plan 02) with full
`asyncio.gather(consumer1, consumer2)` parallelism. Both consumers drain to
TERMINAL_TYPES sentinel; `events1 == events2` assertion holds.

**No Pitfall 7 same-loop hang observed** under the
`ASGITransport(app=app)` + `asyncio.gather` configuration. The route's
per-request `replay_tail_consumer` instance maintains its own `last_id`
cursor, so two concurrent consumers operate against the same Redis Stream
without cross-consumer interference.

**Fallback documentation:** The test's module docstring describes the
fallback (one httpx consumer + one direct `redis_client.xread`) for future
maintainers — if a future regression introduces the same-loop hang (e.g.,
a future change to BLOCK semantics), the fallback path is one swap-and-go
edit, not a research exercise.

## Test Run Results

```
test_062_multi_consumer_fanout.py::test_two_consumers_receive_identical_sequences  PASSED
test_062_redis_down.py::test_stream_returns_503_on_redis_unreachable               PASSED
test_062_redis_down.py::test_delete_returns_204_on_redis_unreachable               FAILED (404 — depends_on Plan 03)

Plans 01-02 unchanged sweep:
test_062_active_runs.py (5 tests)             5 PASSED
test_062_cross_user_404.py (2 tests)          2 PASSED  (Plan 03 will append the 3rd)
test_062_stream_replay.py (2 tests)           2 PASSED
test_062_stream_terminal.py (1 test)          1 PASSED
test_062_stream_ttl_expired.py (4 tests)      4 PASSED

058/059/061 binding regression sweep:
test_058_concurrency.py::test_cross_tab_unblocked_during_sse                       PASSED
test_059_disconnect.py::test_agent_task_SURVIVES_on_disconnect                     PASSED
test_061_consumer_cursor_race.py (3 tests)                                         PASSED

Total: 21 PASSED + 1 FAILED (the FAILED is the documented depends_on:062-03 case).
```

## Plan-Wide Verification (post-completion)

All checks from the plan's `<verification>` block:

| # | Check | Expected | Actual | Result |
|---|-------|----------|--------|--------|
| 1a | test_062_multi_consumer_fanout.py exists | yes | yes | PASS |
| 1b | test_062_redis_down.py exists | yes | yes | PASS |
| 1c | `test_two_consumers_receive_identical_sequences` defined | >=1 | 1 | PASS |
| 1d | `test_stream_returns_503_on_redis_unreachable` + `test_delete_returns_204_on_redis_unreachable` defined | 2 grep hits | 2 | PASS |
| 2a | 062-VERIFICATION.md exists | yes | yes | PASS |
| 2b | Section 2 truth-row count | >=21 | 21 | PASS |
| 2c | Section 8 threat-row count | 4 (T-062-01..04) | 4 | PASS |
| 3 | All 062 tests + 058/059/061 binding tests pass | excluding depends_on:Plan 03 case | 21/22 | PASS (1 RED expected) |

## Off-Limits Region Verification

Per D-062-14 the following regions of `backend/app/api/threads.py` MUST NOT be modified by Plan 04. Confirmed via `git diff backend/app/api/threads.py HEAD~2 HEAD` → no output (file untouched across both commits):

- `event_consumer` (lines 336-423) — untouched
- `agent_runner` (lines ~757-2156) — untouched
- `_shielded_finalize` (lines ~2087-2146) — untouched
- `send_message` (lines ~675-2186) — untouched
- Registry constants region (RUN_TASKS, TERMINAL_TYPES, _emit, _emit_terminal, _RUN_STATUS_TO_TERMINAL_TYPE) — untouched
- All Plan 01 + Plan 02 additions (`list_active_runs` route, `runs.py` module, `main.py` router registration, ActiveRunResponse import) — untouched

Plan 04 only added:
- 2 new test files (`backend/tests/integration/test_062_multi_consumer_fanout.py`, `test_062_redis_down.py`)
- 1 new planning doc (`.planning/phases/062-replay-tail-api/062-VERIFICATION.md`)

## DEF-061.1-02 Disposition (carried forward unchanged)

DEF-061.1-02 (suspected producer exception classifier coercing `failed` → `completed`) is carried forward to a future 061.2 phase per the disposition recorded in `062-01-PLAN.md` `must_haves.deferred` and re-affirmed in 062-VERIFICATION.md Section 7. The 062 full-suite verify inherits 061.1's canonical `-k` exclusion clause for the four affected tests.

## Phase 062 Final Stats

- **4 plans:** 01 (active-runs read-side) + 02 (GET stream) + 03 (DELETE — parallel worktree) + 04 (cross-cutting tests + VERIFICATION.md, this plan)
- **2 waves:** Wave 1 = Plans 01 + 02 + 03 (parallel-eligible); Wave 2 = Plan 04 (cross-cutting closer)
- **Source files modified across phase:** 3 (`backend/app/api/threads.py`, `backend/app/api/runs.py`, `backend/app/main.py`) + 1 created (`backend/app/models/run.py`)
- **Test files created across phase:** 11 (`test_062_active_runs.py`, `test_062_cross_user_404.py`, `test_062_stream_replay.py`, `test_062_stream_terminal.py`, `test_062_stream_ttl_expired.py`, `test_062_delete_happy.py`, `test_062_delete_zombie.py`, `test_062_delete_terminal_idempotent.py`, `test_062_multi_consumer_fanout.py`, `test_062_redis_down.py`, plus the threat-model file count includes Plan 02's append to `test_062_cross_user_404.py`). Plan 03's 3 delete-test files materialize when its worktree merges.
- **Verification document:** 1 (`062-VERIFICATION.md`, 227 lines, 9 sections)
- **Total integration tests across phase:** 22 (active-runs 5 + cross-user 3 + stream-replay 2 + stream-terminal 1 + stream-ttl-expired 4 + delete-happy 1 + delete-zombie 1 + delete-terminal-idempotent 3 + multi-consumer 1 + redis-down 2). 16 currently green in this worktree; remaining 6 land when Plan 03 merges.

## Phase 062 Ready for `/gsd:verify-work`

After both Wave-2 worktrees merge back to v2.5-stream:
- All 22 integration tests should be GREEN
- 062-VERIFICATION.md Section 5 canonical sweep is the single source of truth for the verifier
- DEF-061.1-02 deferral is recorded; the inherited `-k` exclusion clause in Section 5 covers the four affected tests
- Threat-model Section 8 lists the 4 mitigations + binding tests; verifier confirms each via grep

## Self-Check: PASSED

- File `backend/tests/integration/test_062_multi_consumer_fanout.py` exists with `test_two_consumers_receive_identical_sequences` ✓
- File `backend/tests/integration/test_062_redis_down.py` exists with both `test_stream_returns_503_on_redis_unreachable` and `test_delete_returns_204_on_redis_unreachable` ✓
- File `.planning/phases/062-replay-tail-api/062-VERIFICATION.md` exists with 9 sections, 21 truth rows, 4 threat rows, 12-step manual checklist ✓
- Commit `95348ec` exists in `git log --oneline` (Task 1 RED+GREEN combined per "Tests run cleanly" allowance) ✓
- Commit `28aacfd` exists in `git log --oneline` (Task 2 docs) ✓
- 16/17 062 tests + 5/5 binding tests GREEN ✓
- 1 RED test (test_delete_returns_204_on_redis_unreachable) is the documented `depends_on: [062-03]` case — will go GREEN once parallel worktree merges ✓
- D-062-14 off-limits regions of threads.py untouched (zero diff across both commits) ✓
- No modifications to STATE.md or ROADMAP.md (parallel-worktree contract honored) ✓

---

*Phase: 062-replay-tail-api*
*Plan: 04*
*Completed: 2026-05-03*
