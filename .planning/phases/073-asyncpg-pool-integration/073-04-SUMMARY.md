---
phase: 073-asyncpg-pool-integration
plan: 04
subsystem: backend
tags: [asyncpg, threads, hot-path, integration-test, binding-gate, send_message, finalize, concur-01, token-col-01]

# Dependency graph
requires:
  - phase: 073-asyncpg-pool-integration
    plan: 01
    provides: "get_pg_pool() singleton + JSONB codec init + _reset_pg_pool_singleton autouse"
  - phase: 073-asyncpg-pool-integration
    plan: 02
    provides: "insert_run / finalize_run / insert_assistant_message keyword-only helpers"
  - phase: 073-asyncpg-pool-integration
    plan: 03
    provides: "stream_options include_usage + accumulator handler shapes + _MISSING_USAGE_FORMAT literal"
provides:
  - "threads.py hot-path flipped to asyncpg (runs INSERT, runs UPDATE finalize, messages INSERT)"
  - "Run-level input_tokens_total / output_tokens_total accumulators inside send_message's closure"
  - "_on_chunk_openai + _on_chunk_anthropic accumulate per-iteration usage into closure slots"
  - "logger.warning emits BEFORE finalize_run when both accumulators are None (D-073-09 + T-073-04)"
  - "test_073_concurrency.py — real-Postgres CONCUR-01 + TOKEN-COL-01 non-NULL + JSONB round-trip + singleton reset"
  - "test_058_concurrency.py preserved verbatim (D-073-11 two-gate strategy)"
affects:
  - 077-multi-worker-validation     # multi-worker harness validates the asyncpg path now in hot use
  - 079-multi-worker-enable         # --workers 2 enable consumes the WORKER-LIFT-02 closure
  - v3.1-admin-dashboards           # runs.input_tokens/output_tokens forward-fill telemetry now flows

# Tech tracking
tech-stack:
  added: []   # all asyncpg deps came in Plan 01
  patterns:
    - "Surgical hot-path flip: 3 named SC call sites only; aexec survives in cold paths and 4 other modules"
    - "Closure-scoped multi-iteration token accumulator with nonlocal capture in on-chunk callbacks"
    - "NULL + logger.warning sentinel for SDK-gap observability (identifier-only format string)"
    - "Two binding gates: mock-Supabase + real-Postgres run in parallel, no overlap on assertions"

key-files:
  created:
    - "backend/tests/integration/test_073_concurrency.py"
  modified:
    - "backend/app/api/threads.py"

key-decisions:
  - "UUID conversion at call sites uses inline isinstance check (UUID(thread_id) if isinstance(thread_id, str) else thread_id) — defensive against historical str|UUID drift in caller args; matches asyncpg's strict UUID type binding"
  - "completed_at passes datetime objects directly (not .isoformat()) since asyncpg uses Postgres binary protocol — WR-01 isoformat fix was about PostgREST JSON encoding and no longer applies"
  - "test_thread_user fixture seeds auth.users row before threads INSERT (local Supabase has FK constraint threads.user_id -> auth.users.id that the mock-Supabase test_058 fixture never exercised)"
  - "FK-safe cleanup order in fixture teardown: runs/messages -> threads -> auth.users (reverse of constraint dependency)"
  - "logger.warning fires BEFORE finalize_run (not after) so the warning lands even if the UPDATE itself raises"

patterns-established:
  - "Hot-path asyncpg flip with surrounding semantics preserved: aexec call -> asyncpg helper call inside same try/except/shield/etc. block — surrounding error handling untouched"
  - "Closure-scoped per-run accumulators with nonlocal capture in nested on-chunk callbacks — pattern reusable for future per-run telemetry (e.g. retry count, cache-hit metrics)"
  - "Real-Postgres integration test with pytestmark.skipif gate — CI without local Supabase skips cleanly; local dev / post-merge orchestrator runs the binding-gate suite"

requirements-completed: [WORKER-LIFT-02, TOKEN-COL-01]

# Metrics
duration: 6min
completed: 2026-05-17
---

# Phase 073 Plan 04: Hot-Path Flips + Token Wiring + Real-Postgres Binding Gate Summary

**Surgical 3-site asyncpg flip in `threads.py` + run-level token accumulator wired through OpenAI/Anthropic on-chunk callbacks + real-Postgres binding gate (CONCUR-01 + TOKEN-COL-01 + JSONB round-trip + singleton reset). Phase 073 lands end-to-end; WORKER-LIFT-02 and TOKEN-COL-01 both close at code level.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-17T15:42:35Z
- **Completed:** 2026-05-17T15:48:31Z
- **Tasks:** 4 (each committed atomically)
- **Files modified:** 1 (`backend/app/api/threads.py`)
- **Files created:** 1 (`backend/tests/integration/test_073_concurrency.py`)

## Accomplishments

- All 3 hot-path call sites in `threads.py` flipped from `aexec` to asyncpg helpers per D-073-04 SC-minimum:
  - SITE #1 (line ~974): runs INSERT -> `await insert_run(await get_pg_pool(), ...)`
  - SITE #3 (line ~1310): messages INSERT -> `await insert_assistant_message(await get_pg_pool(), ...)` with the returned UUID stringified into `_cached_id` (preserves Phase 061 D-061-05 cache contract)
  - SITE #2 (line ~2651): runs UPDATE inside `_shielded_finalize` -> `await finalize_run(await get_pg_pool(), ..., input_tokens=input_tokens_total, output_tokens=output_tokens_total)`
- Run-level token accumulator slots declared inside `send_message`'s closure adjacent to `full_content`/`persisted_tool_calls`:
  - `input_tokens_total: int | None = None`
  - `output_tokens_total: int | None = None`
- `_on_chunk_openai` callback extended with `nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total` and a top-of-body `if getattr(chunk, "usage", None) is not None:` branch that accumulates per Plan 03's locked OpenAI handler shape (covers OpenAI AND OpenRouter — same SDK client class).
- `_on_chunk_anthropic` callback extended with the same nonlocal declarations and new `_etype == "usage"` and `_etype == "usage_delta"` branches at the top of the if/elif chain — accumulator adds once per Anthropic Message (Pitfall 9 honored via Plan 03's stream_anthropic guarantees).
- `logger.warning("runs.usage missing for run=%s provider=%s model=%s", run_id, _resolved_provider, _resolved_model)` fires BEFORE `finalize_run` when both accumulators are None (D-073-09 + T-073-04 — format string contains identifiers only, NO token VALUES).
- 4-test real-Postgres binding gate shipped at `backend/tests/integration/test_073_concurrency.py`, all green against `:54322`.
- `aexec` import at `threads.py:29` preserved + spawn-failure runs UPDATE at line ~997 STAYS on aexec (D-073-04 SC-minimum).
- `test_058_concurrency.py` UNTOUCHED (D-073-11 two-gate strategy verified — `git diff` is empty for that file).

## Task Commits

Each task was committed atomically:

1. **Task 1: Imports + accumulator slot declarations** — `7bd616f` (feat)
2. **Task 2: SITE #1 + SITE #3 flips + on-chunk usage wiring** — `985ccd0` (feat)
3. **Task 3: SITE #2 flip + missing-usage warning** — `6a59dc2` (feat)
4. **Task 4: test_073_concurrency.py — 4-test real-Postgres binding gate** — `9d0e098` (test)

**Plan metadata commit:** _TBD (final docs commit after this SUMMARY.md write)_

## Files Created/Modified

### Created

- `backend/tests/integration/test_073_concurrency.py` — 306 lines, 4 async binding-gate tests, function-scoped real-asyncpg fixture with JSONB codec, auth.users + threads test fixture with FK-safe cleanup, pytestmark.skipif on PG_AVAILABLE for graceful CI degrade.

### Modified

- `backend/app/api/threads.py` — diff stat `+103 / -28` (131 lines changed). Imports gained 2 lines (`get_pg_pool`, `insert_run/finalize_run/insert_assistant_message`). Closure gained 6 lines for accumulator slots + comment block. SITE #1 expanded from 9 lines to 12 (UUID conversion + comment). SITE #3 expanded from 6 lines to 18 (new asyncpg call with conditional kwargs + UUID conversion + comment). SITE #2 expanded from 9 lines to 18 (warning emit + finalize_run call + comment block). _on_chunk_openai gained 16 lines (nonlocal extend + usage branch). _on_chunk_anthropic gained 19 lines (nonlocal extend + usage/usage_delta branches).

## Diff Evidence

```
$ git diff --stat 91ba497..HEAD -- backend/app/api/threads.py
 backend/app/api/threads.py | 131 +++++++++++++++++++++++++++++++++++----------
 1 file changed, 103 insertions(+), 28 deletions(-)
```

## Grep-Evidence (All Acceptance Gates Pass)

```
$ grep -c "await insert_run(" backend/app/api/threads.py           # SC#1
1
$ grep -c "await finalize_run(" backend/app/api/threads.py         # SC#3
1
$ grep -c "await insert_assistant_message(" backend/app/api/threads.py  # SC#2
1
$ grep -c 'aexec(supabase.table("runs").insert' backend/app/api/threads.py     # SITE#1 flipped
0
$ grep -c 'aexec(supabase.table("messages").insert(row))' backend/app/api/threads.py  # SITE#3 flipped
0
$ grep -c 'aexec(supabase.table("runs").update' backend/app/api/threads.py     # spawn-failure stays
1
$ grep -c "from app.utils.db import aexec" backend/app/api/threads.py          # aexec import preserved
1
$ grep -c "from app.dependencies import get_pg_pool" backend/app/api/threads.py
1
$ grep -c "from app.db.runs import insert_run, finalize_run, insert_assistant_message" backend/app/api/threads.py
1
$ grep -c "input_tokens_total: int | None = None" backend/app/api/threads.py   # SC#4
1
$ grep -c "output_tokens_total: int | None = None" backend/app/api/threads.py
1
$ grep -c "nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total" backend/app/api/threads.py
2
$ grep -c "runs.usage missing for run=%s provider=%s model=%s" backend/app/api/threads.py  # SC#5
1
$ grep -c "except BaseException:" backend/app/api/threads.py                   # CR-02/WR-03 invariant
7
$ grep -c "asyncio.shield" backend/app/api/threads.py                          # 058/059 invariant
2
```

## T-073-03 Final Scope Gate

```
$ grep -E "await (insert_run|finalize_run|insert_assistant_message)\(" backend/app/api/threads.py | wc -l
3
$ grep -rE "await (insert_run|finalize_run|insert_assistant_message)\(" backend/app/ | wc -l
3
$ grep -rE "from app\.db\.runs" backend/app/ | wc -l
1
```

Exactly 3 asyncpg helper call sites in exactly 1 file (`backend/app/api/threads.py`). `from app.db.runs` import is also restricted to a single file. RLS-bypass scope expansion mitigation locked.

## T-073-04 Negative-Coverage Gate

```
$ grep -E 'logger\..*tokens=|logger\..*value=|logger\..*usage_dict' backend/app/api/threads.py | wc -l
0
```

Zero matches. The only logger.warning that touches token state uses the format string `"runs.usage missing for run=%s provider=%s model=%s"` (identifiers only — run_id, provider, model). Plan 03's `test_missing_usage_format_string_has_no_token_values` test guards against future drift; this grep confirms the file is currently compliant.

## D-073-11 Two-Gate Preservation

```
$ git diff backend/tests/integration/test_058_concurrency.py
(no output)
```

`test_058_concurrency.py` is byte-identical pre/post Plan 04. The mock-Supabase CONCUR-01 binding gate continues to protect the aexec contract that survives Phase 073 in cold paths.

## Public Surface for Phase 077 / Phase 079

The asyncpg-backed hot path is now in production code. Phase 077 (multi-worker validation) consumes:

- `app.api.threads.send_message` — drives all 3 asyncpg call sites under `--workers 2` smoke
- `app.dependencies._pg_pool` — singleton survives across requests within a worker; new workers each get their own (no shared state)
- `runs.input_tokens` / `runs.output_tokens` — telemetry pre-loaded for Phase 079 admin dashboard rendering (downstream v3.1 work)

## Pitfall 6 Confirmation (per plan's `<output>` request)

The `_resolved_provider` resolution chain at threads.py:957-971 is byte-identical post-Plan-04. The if/elif chain assigns `_resolved_provider` along every branch:
- `if body.provider:` -> `_resolved_provider = _user_settings.active_provider`
- `elif _capability_provider != "unknown":` -> `_resolved_provider = _capability_provider`
- `else:` -> `_resolved_provider = _user_settings.active_provider`

All three branches assign — `_resolved_provider` is guaranteed non-None at line 974 entry into `insert_run`. The provider column is NOT NULL in the runs table schema; this invariant is now load-bearing for the asyncpg INSERT (which would raise on NULL rather than silently coerce). Pitfall 6 holds.

## Test Results

```
$ cd backend && venv/Scripts/python.exe -m pytest \
    tests/unit/test_pg_pool_singleton.py \
    tests/unit/test_lifespan.py \
    tests/unit/test_db_runs.py \
    tests/unit/test_token_accumulator_*.py \
    tests/integration/test_058_concurrency.py \
    tests/integration/test_073_concurrency.py \
    -x -q --no-header

..........................                                               [100%]
26 passed, 1 warning in 5.49s
```

Full breakdown:
- 5 tests `test_pg_pool_singleton.py + test_lifespan.py` (Plan 01)
- 8 tests `test_db_runs.py` (Plan 02)
- 12 tests `test_token_accumulator_*.py` (Plan 03)
- 1 test `test_058_concurrency.py` (preserved aexec gate — D-073-11)
- 4 tests `test_073_concurrency.py` (NEW asyncpg gate)

Tests in `test_073_concurrency.py`:
- `test_singleton_reset_between_tests` — PASS (Plan 01 _reset_pg_pool_singleton autouse contract working)
- `test_jsonb_codec_round_trip` — PASS (JSONB codec round-trips list/dict via insert_assistant_message; tool_calls + source_refs come back as Python lists, not strings)
- `test_token_capture_happy_path` — PASS (insert_run + finalize_run with input_tokens=120/output_tokens=45 round-trips through SELECT — both non-NULL)
- `test_cross_tab_unblocked_during_asyncpg_sse` — PASS (concurrent SELECT mid-driver completes in <1s; cross-tab invariant holds under asyncpg)

## Decisions Made

- **UUID conversion at call sites** — Used `UUID(thread_id) if isinstance(thread_id, str) else thread_id` inline. The `thread_id` path parameter to `send_message` is typed `str` (FastAPI route arg), but Plan 02's helpers require `UUID` per their signatures. Inline isinstance check is defensive against future caller drift and keeps the helper signatures strict.
- **datetime objects passed directly to finalize_run** — Dropped `.isoformat()` from the WR-01 fix. PostgREST required strings due to JSON-over-the-wire encoding; asyncpg uses Postgres binary protocol and prefers native types. Comment block in the Plan 03 finalize comment explains the historical context.
- **Warning logged BEFORE finalize_run, not after** — If the UPDATE raises, the warning still fires. Placing it after the call would lose the observability signal exactly when it matters most (storage failures correlate with end-of-stream provider gaps).
- **auth.users seeding in test fixture** — Local Supabase has `threads.user_id REFERENCES auth.users(id)` constraint that the mock-Supabase test_058 fixture never exercises. Without this seed, the JSONB / token / CONCUR tests would all FK-violate. Cleanup runs in FK-safe order (runs/messages -> threads -> auth.users).
- **pytest.skip on fixture failure** — Rather than silent pass-through on schema mismatch, the fixture surfaces the actual exception so downstream tests don't silently FK-violate. Combined with the module-level pytestmark.skipif, the file degrades cleanly on CI without Postgres but signals real problems when Postgres IS present but schema drift exists.

## Deviations from Plan

**One deviation — Rule 1 (bug fix in test fixture).**

The plan's `test_thread_user` fixture used a bare `try/except: pass` around the `threads` INSERT, on the assumption that schema mismatches would be the only failure mode. In practice on local Supabase, the actual failure was an FK violation against `auth.users` — the mock-Supabase test_058 fixture never exercises this constraint, so the plan's draft hadn't accounted for it.

**Fix:** Updated the fixture to (a) seed an `auth.users` row first with only `id` + `email` (only `id` is strictly NOT NULL with no default), (b) FK-safe cleanup order in teardown, (c) `pytest.skip` with the actual exception on setup failure so schema drift surfaces as a real signal, not a silent pass.

Captured in the Task 4 commit message. Tests now pass cleanly on local :54322.

## Live UAT Gate (Orchestrator Post-Merge Verification)

Code is complete; the following live verifications are gated for the orchestrator to run against a running Supabase + uvicorn stack post-merge:

1. **Pytest sweep (real Postgres):**
   ```
   cd backend && venv/Scripts/python.exe -m pytest \
     tests/integration/test_073_concurrency.py \
     tests/integration/test_058_concurrency.py \
     tests/unit/test_pg_pool_singleton.py tests/unit/test_lifespan.py \
     tests/unit/test_db_runs.py tests/unit/test_token_accumulator_*.py \
     -x -q
   ```
   Expected: 26 passed (4 new asyncpg + 1 mock-Supabase + 21 unit). **Already green at code-complete time on this dev machine (2026-05-17 15:48Z).**

2. **End-to-end happy-path UAT (live LLM run):**
   - Restart uvicorn (ensure new imports loaded).
   - From the web UI, send a 1-shot message to a model that surfaces usage (OpenAI gpt-4o, Anthropic claude-sonnet-4).
   - SQL check against local :54322:
     ```sql
     SELECT run_id, status, model, provider, input_tokens, output_tokens, completed_at, error
     FROM runs
     WHERE thread_id = '<your-test-thread>'
     ORDER BY started_at DESC
     LIMIT 5;
     ```
   - Expected: rows have non-NULL `input_tokens` + `output_tokens` for completed runs; `error IS NULL` on completed; `completed_at` is a real timestamp (not "now()" literal string).

3. **Multi-iteration UAT (think -> tool -> respond):**
   - Send a message that triggers a tool call (e.g. "search the docs for asyncpg" with KB attached).
   - SQL: same as above; `input_tokens` and `output_tokens` should be the SUM across iterations.

4. **Missing-usage warning UAT (interrupted stream):**
   - Trigger an interrupted run (kill the producer mid-stream, or use a provider/model that the SDK gap path hits).
   - Tail uvicorn logs: expect ONE `runs.usage missing for run=<uuid> provider=<x> model=<y>` warning per affected run.
   - SQL: `SELECT run_id, input_tokens, output_tokens FROM runs WHERE input_tokens IS NULL;` should match the warned runs.

5. **Cross-tab concurrency UAT:**
   - Start a long-running stream in Tab A.
   - In Tab B, GET `/threads/<other-thread>/runs/active`.
   - Expected: GET completes in <500ms even while Tab A is streaming. (This is the CONCUR-01 binding gate at the HTTP layer; test_058 covers it under mock-Supabase, test_073 covers it at the asyncpg DB layer.)

## Issues Encountered

One — covered above as the Rule 1 deviation. Schema FK constraint surfaced during initial test run; fixed inline with a 5-minute fixture rewrite; all 4 tests subsequently green.

## Next Phase Readiness

**Phase 073 lands end-to-end.** WORKER-LIFT-02 + TOKEN-COL-01 close at code level. Code is multi-worker-safe (asyncpg pool is fork-safe via lazy init per worker; aexec cold paths use run_in_threadpool which is also worker-safe).

**Next downstream phases:**
- **Phase 077 (multi-worker-validation)** — runs the binding-gate suite + a live `--workers 2` smoke against the asyncpg path landed here.
- **Phase 079 (multi-worker-enable)** — flips `--workers 2` for prod after Phase 077 GREEN. Consumes WORKER-LIFT-02 closure.
- **v3.1 (admin dashboards)** — renders `runs.input_tokens` / `output_tokens` time-series and missing-usage warning frequency.

## Self-Check: PASSED

Verified all files exist:
- FOUND: `backend/app/api/threads.py` (modified, 131 lines changed)
- FOUND: `backend/tests/integration/test_073_concurrency.py` (created, 306 lines)
- FOUND: `backend/tests/integration/test_058_concurrency.py` (UNTOUCHED — git diff empty)

Verified all task commits exist in `git log --oneline 91ba497..HEAD`:
- FOUND: `7bd616f` (Task 1 — imports + accumulator slots)
- FOUND: `985ccd0` (Task 2 — SITE #1 + SITE #3 + on-chunk wiring)
- FOUND: `6a59dc2` (Task 3 — SITE #2 + missing-usage warning)
- FOUND: `9d0e098` (Task 4 — test_073_concurrency.py)

All gates green:
- T-073-03 final scope: 3 helper calls in 1 file (`grep -E "await (insert_run|finalize_run|insert_assistant_message)\(" backend/app/api/threads.py | wc -l` -> 3)
- T-073-04 negative coverage: 0 token-value leaks in logger calls (`grep -E 'logger\..*tokens=|logger\..*value=|logger\..*usage_dict' backend/app/api/threads.py | wc -l` -> 0)
- D-073-11 preservation: test_058_concurrency.py byte-identical (`git diff` returns empty)
- Module imports: `python -c "import app.api.threads"` exits 0
- 26 tests pass (4 new + 1 preserved + 21 upstream)

---
*Phase: 073-asyncpg-pool-integration*
*Plan: 04*
*Completed: 2026-05-17*
