---
phase: 073
slug: asyncpg-pool-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 073 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: distilled from `073-RESEARCH.md` §Validation Architecture (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x + pytest-asyncio (`asyncio_mode=auto`) + `httpx.AsyncClient` (for SSE/concurrency) |
| **Config file** | `backend/pytest.ini` (`asyncio_mode = auto`, `testpaths = tests`) |
| **Quick run command** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_db_runs.py tests/unit/test_pg_pool_singleton.py tests/unit/test_token_accumulator_*.py -x -q` |
| **Full suite command** | `cd backend && venv/Scripts/python.exe -m pytest tests/ -x -q` |
| **Estimated runtime** | ~5s (unit tier) / ~45s (full suite — depends on local Postgres warm path) |

---

## Sampling Rate

- **After every task commit:** Run the unit-tier quick command above (no Postgres needed; ~5s).
- **After every plan wave:** Add `tests/integration/test_073_concurrency.py tests/integration/test_058_concurrency.py` to the quick set (both CONCUR-01 gates green together).
- **Before `/gsd:verify-work`:** Full suite must be green. Specific must-haves: test_058 + test_073 + the 5 new test_token_accumulator_* + test_db_runs + test_pg_pool_singleton + test_lifespan.
- **Max feedback latency:** 10 seconds (unit tier).

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| WORKER-LIFT-02 | CONCUR-01 binding gate stays green under aexec hot paths (mock Supabase) | integration | `pytest backend/tests/integration/test_058_concurrency.py::test_cross_tab_unblocked_during_sse -x` | ✅ EXISTS (D-073-11: preserved verbatim) | ⬜ pending |
| WORKER-LIFT-02 | CONCUR-01 binding gate stays green under asyncpg hot paths (real local Postgres `:54322`) | integration | `pytest backend/tests/integration/test_073_concurrency.py::test_cross_tab_unblocked_during_asyncpg_sse -x` | ❌ NEW (Wave 0) | ⬜ pending |
| WORKER-LIFT-02 | `insert_run`, `finalize_run`, `insert_assistant_message` helpers produce correct SQL + args | unit | `pytest backend/tests/unit/test_db_runs.py -x` | ❌ NEW (Wave 0) | ⬜ pending |
| WORKER-LIFT-02 | Pool singleton lazy-inits at first call, no I/O at import time | unit | `pytest backend/tests/unit/test_pg_pool_singleton.py -x` | ❌ NEW (Wave 0) | ⬜ pending |
| WORKER-LIFT-02 | Lifespan close: `pool.close()` runs BEFORE `_supabase.aclose()`, timeout falls back to `terminate()` | unit | `pytest backend/tests/unit/test_lifespan.py::test_pg_pool_closes_before_supabase -x` | ❌ NEW (Wave 0) — Phase 078 (CQ-SUPA-01) also touches this file; coordinate boundaries | ⬜ pending |
| WORKER-LIFT-02 | JSONB codec round-trips a dict via real pool | integration | `pytest backend/tests/integration/test_073_concurrency.py::test_jsonb_codec_round_trip -x` | ❌ NEW | ⬜ pending |
| TOKEN-COL-01 | `runs.input_tokens` + `runs.output_tokens` populated non-NULL on happy-path completed run | integration | `pytest backend/tests/integration/test_073_concurrency.py::test_token_capture_happy_path -x` | ❌ NEW | ⬜ pending |
| TOKEN-COL-01 | OpenAI on-chunk callback accumulates from trailing usage chunk (`chunk.usage.prompt_tokens` / `.completion_tokens`) | unit | `pytest backend/tests/unit/test_token_accumulator_openai.py -x` | ❌ NEW | ⬜ pending |
| TOKEN-COL-01 | Anthropic on-chunk callback accumulates from `message_start` + `message_delta` events (no double-count) | unit | `pytest backend/tests/unit/test_token_accumulator_anthropic.py -x` | ❌ NEW | ⬜ pending |
| TOKEN-COL-01 | Multi-iteration accumulation: 2 LLM calls in a run sum correctly into `runs.input_tokens` / `.output_tokens` | unit | `pytest backend/tests/unit/test_token_accumulator_multi_iter.py -x` | ❌ NEW | ⬜ pending |
| TOKEN-COL-01 | NULL + `logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)` on SDK-missing path | unit (caplog) | `pytest backend/tests/unit/test_token_accumulator_missing_usage.py -x` | ❌ NEW | ⬜ pending |
| WORKER-LIFT-02 | `_reset_pg_pool_singleton` autouse fixture clears `_pg_pool` between tests (no "Event loop is closed") | meta | `pytest backend/tests/integration/test_073_concurrency.py::test_singleton_reset_between_tests -x` | ❌ NEW | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/app/db/__init__.py` — empty module file (D-073-05 establishes the package)
- [ ] `backend/app/db/runs.py` — three typed helpers (`insert_run`, `finalize_run`, `insert_assistant_message`)
- [ ] `backend/tests/unit/test_db_runs.py` — asserts SQL string + args-tuple shape with AsyncMock pool
- [ ] `backend/tests/unit/test_pg_pool_singleton.py` — asserts `get_pg_pool()` returns same instance + no I/O at import
- [ ] `backend/tests/unit/test_lifespan.py` — pg_pool close-before-supabase ordering (Phase 078 will also touch this file for CQ-SUPA-01 — coordinate plan boundaries)
- [ ] `backend/tests/unit/test_token_accumulator_openai.py` — feeds fake chunks (including trailing usage chunk) through the on-chunk callback
- [ ] `backend/tests/unit/test_token_accumulator_anthropic.py` — feeds fake `message_start` + `message_delta` events
- [ ] `backend/tests/unit/test_token_accumulator_multi_iter.py` — simulates 2 LLM iterations, asserts SUM (no double-count)
- [ ] `backend/tests/unit/test_token_accumulator_missing_usage.py` — simulates SDK-missing path; asserts NULL write + caplog warning
- [ ] `backend/tests/integration/test_073_concurrency.py` — real-pool gate (cross-tab unblocked + jsonb round-trip + token capture happy path + singleton reset)
- [ ] `backend/tests/integration/_run_helpers.py` — add `_build_mock_pg_pool()` factory (AsyncMock with `.execute` / `.fetchval` / `.fetchrow` patched)
- [ ] `backend/tests/conftest.py` — add `_reset_pg_pool_singleton` autouse fixture (D-073-12)
- [ ] **Framework install:** `cd backend && venv/Scripts/python.exe -m pip install asyncpg>=0.29` (or update `backend/requirements.txt` and `pip install -r requirements.txt`)

*11 NEW test/helper files + 1 install command + 2 existing files modified (`tests/conftest.py`, `tests/integration/_run_helpers.py`).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live cloud-Supabase end-to-end smoke (asyncpg directly against the real Supabase Postgres `:5432`, NOT the local Docker `:54322`) | WORKER-LIFT-02 | Local-vs-cloud DSN differs; local pool reuse cannot exercise the real network/TLS path | Set `POSTGRES_DSN` to the cloud Supabase project DSN in `backend/.env`, restart uvicorn, send one streaming chat message, then `SELECT input_tokens, output_tokens, completed_at FROM runs ORDER BY started_at DESC LIMIT 1;` — expect both non-NULL on a happy-path completion |
| Live token-usage capture across all configured providers in `MODEL_CAPABILITIES` (Anthropic, OpenAI, OpenRouter, Google) | TOKEN-COL-01 | Per-provider SDK quirks (esp. OpenRouter pass-through and Google) need actual provider responses; unit fakes cannot fully simulate | For each provider in `MODEL_CAPABILITIES`, send a streaming chat completion via the app, then `SELECT model, input_tokens, output_tokens FROM runs WHERE model=...` — expect non-NULL on the providers that surface usage; expect NULL + a `logger.warning('runs.usage missing for run=... provider=... model=...')` line on those that don't (acceptable per D-073-09) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (11 NEW files mapped above)
- [ ] No watch-mode flags
- [ ] Feedback latency <10s on unit tier
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner finalizes per-task automated commands)

**Approval:** pending
