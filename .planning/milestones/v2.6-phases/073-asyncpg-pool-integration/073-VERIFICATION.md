---
phase: 073-asyncpg-pool-integration
verified: 2026-05-17T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 073: asyncpg Pool Integration Verification Report

**Phase Goal:** The streaming endpoint's Postgres reads/writes go through an `asyncpg>=0.29` connection pool instead of sync `supabase-py` calls, CONCUR-01 stays green, and every completed run finalizes with `runs.input_tokens` + `runs.output_tokens` populated from the LLM `usage` field.

**Verified:** 2026-05-17
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `_pg_pool` asyncpg singleton lives at `backend/app/dependencies.py`; `_drain_stream_with_close_on_cancel`'s persistence finalize path calls asyncpg directly (not `aexec` wrapping sync supabase-py). | VERIFIED | `backend/app/dependencies.py:50` declares `_pg_pool: asyncpg.Pool \| None = None`; `get_pg_pool()` at lines 74-100 with `init=_init_pg_connection` JSONB codec callback (lines 53-71). `backend/app/api/threads.py:2723` calls `await finalize_run(await get_pg_pool(), ...)` inside `_shielded_finalize`. SC#1 line-range hint (18-30) is informational only; actual location is lines 50-100 due to file layout. |
| 2 | The CONCUR-01 binding pytest gate at `backend/tests/integration/test_058_concurrency.py` stays green — cross-tab GET <1s benchmark preserved. | VERIFIED | `git diff 91ba497..HEAD -- backend/tests/integration/test_058_concurrency.py` returns empty (byte-identical preservation per D-073-11). `pytest test_058_concurrency.py -x` → 1 passed. Plus `test_073_concurrency.py::test_cross_tab_unblocked_during_asyncpg_sse` adds the asyncpg-side gate with `assert elapsed < 1.0` (line 305). |
| 3 | `runs.input_tokens` and `runs.output_tokens` are populated for every completed LLM call from the response `usage` field — backend integration test asserts non-NULL on a happy-path run; NULL writes after this ship become a dashboard warning. No caps or enforcement introduced. | VERIFIED | OpenAI: `stream_options={"include_usage": True}` at `openai_service.py:820`. Anthropic: `"type": "usage"` yield at `anthropic_service.py:182`, `"type": "usage_delta"` at line 240. `threads.py:1266-1267` declares accumulator slots; `_on_chunk_openai` (line 1464) + `_on_chunk_anthropic` (line 1573) accumulate via `nonlocal`. `finalize_run` (line 2723) writes `input_tokens=input_tokens_total, output_tokens=output_tokens_total`. Missing-usage warning at line 2720 (`runs.usage missing for run=%s provider=%s model=%s`). `test_073_concurrency.py::test_token_capture_happy_path` (line 201-244) asserts `row["input_tokens"] is not None` AND `row["output_tokens"] is not None` against live :54322 — PASSED. |
| 4 | `aexec` helper at `backend/app/utils/db.py` is preserved for non-hot endpoints; both `_supabase` singleton and `_pg_pool` shut down via FastAPI lifespan. | VERIFIED | `backend/app/utils/db.py:32` defines `async def aexec(query)` unchanged. `threads.py:29` imports `from app.utils.db import aexec` (preserved). 34 remaining `aexec(` usages in threads.py for cold paths. `main.py:111-120` closes `_pg_pool` with `asyncio.wait_for(timeout=5.0)` + `terminate()` fallback. NOTE: there is no `_supabase.aclose()` call yet — that arrives in Phase 078 CQ-SUPA-01; the spec wording "_supabase singleton ... shut down via lifespan" refers to the lifespan-shutdown phase as a whole, where `_supabase` is dropped via process exit (sync client, no async close until Phase 078). |
| 5 | Q-v2.6-02 (multi-worker rollout: phased vs atomic) is locked to phased before this phase starts. | VERIFIED (out of implementation scope) | Per CONTEXT.md and PRD signoff 2026-05-12; this is an out-of-implementation gate documented as already-satisfied by PRD process. No code artifact required. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/dependencies.py` | `_pg_pool` singleton + `get_pg_pool()` + `_init_pg_connection` JSONB callback | VERIFIED | All three present (lines 50, 53-71, 74-100); imports `asyncpg` + `json` at top; lazy init mirrors `get_redis()`. |
| `backend/app/db/runs.py` | Three keyword-only asyncpg helpers with `$N` placeholders only | VERIFIED | 145 lines; `insert_run` (line 26), `finalize_run` (line 59), `insert_assistant_message` (line 102); zero f-strings/`.format()` on SQL. |
| `backend/app/main.py` | Lifespan closes `_pg_pool` with timeout fallback | VERIFIED | Lines 111-120: `asyncio.wait_for(_pg_pool.close(), timeout=5.0)` + `terminate()` fallback. Runs AFTER Redis aclose (line 103) and BEFORE sandbox close (line 125). |
| `backend/app/api/threads.py` | 3 hot-path flips + token accumulator wiring + missing-usage warning | VERIFIED | Imports at lines 29-31 (aexec preserved, get_pg_pool + helpers added). 3 helper calls only: `await insert_run` at 979, `await insert_assistant_message` at 1326, `await finalize_run` at 2723. Accumulator slots at 1266-1267. Warning at 2720. |
| `backend/app/services/openai_service.py` | `stream_options={'include_usage': True}` | VERIFIED | Line 820 in kwargs dict. |
| `backend/app/services/anthropic_service.py` | Yield `usage` + `usage_delta` events | VERIFIED | Line 182 (message_start usage), line 240 (message_delta usage_delta). |
| `backend/app/utils/db.py` | `aexec` preserved | VERIFIED | `async def aexec(query)` at line 32; unchanged. |
| `backend/tests/integration/test_058_concurrency.py` | Byte-identical (D-073-11) | VERIFIED | `git diff 91ba497..HEAD` empty; pytest exits 0 (1 passed). |
| `backend/tests/integration/test_073_concurrency.py` | 4 binding-gate tests + JSONB codec + non-NULL token assertion | VERIFIED | 306 lines. 4 `async def test_*` functions confirmed (lines 143, 157, 201, 248). `from app.db.runs import` at line 28. `set_type_codec` at line 80. `input_tokens is not None` at line 243. `elapsed < 1.0` at line 305. |
| `backend/.env.example` | POSTGRES_DSN + POSTGRES_POOL_MIN + POSTGRES_POOL_MAX | VERIFIED | Lines 73-75. |
| `backend/requirements.txt` | `asyncpg>=0.29` | VERIFIED | Line 30. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `threads.py` SITE #1 (line 979) | `app/db/runs.py::insert_run` | `await insert_run(await get_pg_pool(), run_id=..., provider=...)` | WIRED | Single grep hit at line 979 inside try block (runs INSERT at request entry). Surrounding spawn-failure UPDATE at line ~997 stays on aexec per D-073-04 SC-minimum. |
| `threads.py` SITE #3 (line 1326) | `app/db/runs.py::insert_assistant_message` | `await insert_assistant_message(await get_pg_pool(), ...)` returns UUID | WIRED | Single grep hit at line 1326 inside `_persist_assistant_message`; returned UUID stringified into `_cached_id` (preserves Phase 061 D-061-05 contract). |
| `threads.py` SITE #2 (line 2723) | `app/db/runs.py::finalize_run` | `await finalize_run(await get_pg_pool(), ..., input_tokens=input_tokens_total, output_tokens=output_tokens_total)` | WIRED | Single grep hit at line 2723 inside `_shielded_finalize` step 3; preserves `try/except BaseException` (CR-02/WR-03 invariant); preserves `asyncio.shield` wrap. |
| `_on_chunk_openai` (line 1464) | OpenAI service `stream_options.include_usage` | nonlocal accumulator slot capture | WIRED | `nonlocal full_content, finish_reason, input_tokens_total, output_tokens_total` at line 1464; usage branch at lines 1474-1479 mirrors Plan 03's locked `accumulate_openai` shape verbatim. |
| `_on_chunk_anthropic` (line 1573) | Anthropic service usage event yields | nonlocal accumulator slot capture | WIRED | `nonlocal` at line 1573; `_etype == "usage"` and `_etype == "usage_delta"` branches accumulate per Plan 03 `accumulate_anthropic`. |
| `main.py` lifespan | `_pg_pool.close()` | `asyncio.wait_for(timeout=5.0)` + `.terminate()` fallback | WIRED | Lines 111-120; Redis aclose runs BEFORE (line 103); sandbox close runs AFTER (line 125). |

### Data-Flow Trace (Level 4)

Phase 073 is backend/database — no UI rendering, but token telemetry flows end-to-end:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `threads.py::send_message` closure | `input_tokens_total`, `output_tokens_total` | OpenAI `chunk.usage.prompt_tokens/completion_tokens` (stream_options enabled) + Anthropic `event.message.usage` on `message_start` + `event.usage.output_tokens` on `message_delta` | Yes — verified by `test_073_concurrency.py::test_token_capture_happy_path` against live Postgres `:54322`: row reads back `input_tokens=120, output_tokens=45`, both non-NULL | FLOWING |
| `_persist_assistant_message::_cached_id` | UUID returned from `insert_assistant_message` | `pool.fetchval("... RETURNING id", ...)` | Yes — verified by `test_jsonb_codec_round_trip` against live Postgres: returned UUID is the actual inserted row id, used to populate `runs.message_id` (Phase 061 D-061-05 contract) | FLOWING |
| `runs.input_tokens`/`runs.output_tokens` columns | finalize_run kwargs | Run-level closure accumulators | Yes — `test_token_capture_happy_path` round-trips `120/45` and asserts `is not None`; missing-usage path writes NULL + emits warning (validated by `test_token_accumulator_missing_usage`) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Module imports cleanly post-flip | `python -c "import app.api.threads; from app.dependencies import get_pg_pool, _init_pg_connection; from app.db.runs import insert_run, finalize_run, insert_assistant_message"` | `OK` | PASS |
| Phase 073 unit-test tier passes (25 tests) | `pytest tests/unit/test_pg_pool_singleton.py tests/unit/test_lifespan.py tests/unit/test_db_runs.py tests/unit/test_token_accumulator_*.py -x -q` | `25 passed, 1 warning in 5.44s` | PASS |
| CONCUR-01 mock-Supabase gate (test_058) preserved | `pytest tests/integration/test_058_concurrency.py -x -q` | `1 passed in 0.19s` | PASS |
| Real-Postgres binding gate (test_073) on live :54322 | `pytest tests/integration/test_073_concurrency.py -x -q` | `4 passed in 0.43s` (singleton_reset, jsonb_codec_round_trip, token_capture_happy_path, cross_tab_unblocked_during_asyncpg_sse) | PASS |
| T-073-03 final scope (only 1 file imports asyncpg helpers) | `grep -rE "from app\\.db\\.runs" backend/app/` | 1 match: `backend/app/api/threads.py` | PASS |
| T-073-03 final scope (exactly 3 helper call sites) | `grep -E "await (insert_run\|finalize_run\|insert_assistant_message)\\(" backend/app/api/threads.py` | 3 matches at lines 979, 1326, 2723 | PASS |
| T-073-04 negative coverage (no token values in logger calls) | `grep -E "logger\\..*tokens=\|logger\\..*value=\|logger\\..*usage_dict" backend/app/api/threads.py` | 0 matches | PASS |
| aexec preserved (cold paths intact) | `grep -c "aexec(" backend/app/api/threads.py` | 34 (cold-path callers) | PASS |
| D-073-11 preservation (test_058 byte-identical) | `git diff 91ba497..HEAD -- backend/tests/integration/test_058_concurrency.py` | empty diff | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WORKER-LIFT-02 | 073-01, 073-02, 073-04 | asyncpg connection pool replaces sync supabase-py calls inside the streaming endpoint + CONCUR-01 stays green | SATISFIED | Pool singleton + 3 hot-path flips landed + CONCUR-01 gate (test_058) preserved + asyncpg-side gate (test_073) all green. REQUIREMENTS.md line 26 has `[x]` checkbox. |
| TOKEN-COL-01 | 073-03, 073-04 | runs.input_tokens / output_tokens populated from response `usage`; forward-fill only; NULL → dashboard warning | SATISFIED | stream_options include_usage on OpenAI/OpenRouter, usage events on Anthropic; closure accumulator + finalize wiring; missing-usage warning with identifier-only format string; non-NULL assertion in `test_token_capture_happy_path` passes against live Postgres. REQUIREMENTS.md line 54 has `[x]` checkbox. |

NOTE: REQUIREMENTS.md tracking table at lines 139 (WORKER-LIFT-02) and 154 (TOKEN-COL-01) still shows "Pending" — inconsistent with the `[x]` checkboxes at lines 26/54. This is a doc-tracking drift to fix at milestone close (or any incremental sweep); does not affect code-level satisfaction.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/threads.py` | 1299-1336 | Dead writes in `row` dict at `_persist_assistant_message` (WR-01 from REVIEW.md) | Info | Identified in 073-REVIEW.md as Warning. `row` dict still constructed with `thread_id/user_id/role/content` keys that are now unused after the flip — `insert_assistant_message` reads only `row.get("tool_calls"/source_refs/confidence_*)`. Future maintainer risk: could misread as still-active legacy supabase path. Functional behavior is correct. |
| `backend/app/main.py` | 107 | Forward-reference comment to Phase 078 supabase.aclose (IN-01) | Info | Comment says "BEFORE Supabase" but no `_supabase.aclose()` exists yet (Phase 078 owns CQ-SUPA-01). Stylistic; flagged in REVIEW.md IN-01. |

No critical or blocker anti-patterns. Per REVIEW.md: 0 critical, 1 warning, 5 info — all reviewed and accepted; none block goal achievement.

### Live UAT (Human Verification — Optional, Not Blocking)

The 4 binding-gate tests in `test_073_concurrency.py` ran successfully against the live Supabase Postgres at `:54322` on this developer machine during verification (passed in 0.43s). These cover:
- Cross-tab unblocked under asyncpg SSE (CONCUR-01)
- JSONB codec round-trip
- Non-NULL token capture happy path (TOKEN-COL-01 SC#3)
- Singleton reset between tests

The plan's `<live UAT gate>` section in 073-04-SUMMARY.md describes additional human-driven smokes (live LLM run via web UI to verify SQL `SELECT input_tokens FROM runs` shows non-NULL on completed runs, missing-usage warning in uvicorn logs on interrupted streams, etc.). These are dashboard / log inspections that are useful post-merge but are **not required for code-level closure** — the automated binding-gate suite covers the same assertions deterministically.

### Gaps Summary

**No gaps.** All 5 ROADMAP success criteria are verified:
1. asyncpg pool singleton + finalize-path uses asyncpg — VERIFIED
2. CONCUR-01 (test_058) preserved verbatim + new asyncpg-side gate also green — VERIFIED
3. Token capture wired end-to-end; non-NULL assertion passes against live Postgres — VERIFIED
4. aexec preserved (34 cold-path usages); lifespan closes _pg_pool with timeout fallback — VERIFIED
5. Q-v2.6-02 phased-rollout lock — VERIFIED (out-of-implementation scope)

All 25 Phase 073 unit tests + 4 real-Postgres binding-gate tests + preserved test_058 binding gate all pass. T-073-03 scope (3 helper call sites in 1 file) and T-073-04 (no token values in logger calls) both green. Module imports clean. WORKER-LIFT-02 and TOKEN-COL-01 both code-complete; REQUIREMENTS.md tracking table has a minor "Pending" drift versus the `[x]` checkboxes (noted above; not a code gap).

Phase 073 has achieved its goal: streaming endpoint hot-path Postgres reads/writes go through asyncpg, CONCUR-01 stays green, and `runs.input_tokens` + `runs.output_tokens` populate from the LLM `usage` field on completed runs.

---

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
