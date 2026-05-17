# Phase 073: asyncpg Pool Integration - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

The Postgres reads/writes inside the streaming hot path (run row INSERT, run row UPDATE finalize, assistant-message INSERT) stop going through sync `supabase-py` + the `aexec` threadpool wrap and instead go through a new `asyncpg>=0.29` connection pool singleton at `backend/app/dependencies.py`. As part of the same finalize touch, `runs.input_tokens` / `runs.output_tokens` get populated from the LLM provider's `usage` field. CONCUR-01 binding gate stays green. `aexec` survives for every cold-path endpoint (kb, runs query, sandbox_outputs, test_fixtures, threads GET, etc.) — only the three SC-named hot-path call sites flip.

**Out of phase:** `--workers N` enable, D-PRD-12 ADR authoring, pgbouncer transaction-mode pooler (all Phase 079+); the v3.1 admin dashboard that consumes `runs.input_tokens` / `output_tokens` (v3.1); cached-token columns (out of PRD scope — basic input/output only).

</domain>

<decisions>
## Implementation Decisions

### Connection Topology & Pool Config
- **D-073-01:** asyncpg connects to **direct Postgres on port 5432** (not the Supabase pooler on 6543). Statement-cache stays at asyncpg's default. The pgbouncer transaction-mode pooler is documented in Phase 080 as a v3.x scaling lever — not needed for v2.6's `--workers 2` target.
- **D-073-02:** Connection string comes from a **new `POSTGRES_DSN` env var** added to `backend/.env.example` next to `SUPABASE_URL` / `REDIS_URL`. Local default: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Cloud: paste from Supabase dashboard. Same pattern as Redis. Decouples asyncpg from the supabase-py URL shape.
- **D-073-03:** Pool **min=2 / max=10, env-tunable** via `POSTGRES_POOL_MIN` / `POSTGRES_POOL_MAX`. Leaves headroom for `--workers 2` in Phase 079 (effective ceiling 20 connections, well under Supabase defaults). Conservative enough that the single-worker case today doesn't waste connections.

### Scope of the asyncpg Flip
- **D-073-04:** **SC-minimum scope.** Exactly three call sites in `backend/app/api/threads.py` flip from `aexec` → asyncpg:
  1. `runs` INSERT at `~line 974` (run row creation at request entry)
  2. `runs` UPDATE finalize at `~line 2651` inside `_shielded_finalize` (closure of `_drain_stream_with_close_on_cancel` persistence path)
  3. `messages` INSERT at `~line 1310` inside `_persist_assistant_message`
  Every other supabase-py call (thread SELECT, message-history SELECT, user message INSERT, spawn-failure UPDATE, threads GET handlers, etc.) stays on `aexec`. Smallest diff, tightest test surface, matches SC text precisely.
- **D-073-05:** SQL strings live in a **new typed helper module `backend/app/db/runs.py`**. Exports: `insert_run(pool, ...)`, `finalize_run(pool, run_id, status, error, completed_at, message_id, input_tokens, output_tokens)`, `insert_assistant_message(pool, ...) -> UUID`. Mirrors the way `multimodal_service` / `extraction_service` factor SQL writes today. Tests patch the module function; `threads.py` stays readable.
- **D-073-06:** Pool registers a **JSONB codec at init time** via `await pool.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')`. Call sites pass plain Python dicts/lists for `tool_calls`, `source_refs`, `confidence_*`, and the runs `error` column — no per-call `json.dumps` boilerplate. Standard asyncpg practice.

### Token Capture Mechanics (TOKEN-COL-01)
- **D-073-07:** `runs.input_tokens` and `runs.output_tokens` represent the **sum across all LLM iterations** in a run (think → tool → think → respond → ...). Two run-level slots accumulate per-call usage as the agent loop iterates; the finalize UPDATE writes totals. Matches the v3.1 admin dashboards + v3.4 spend-cap pre-flight use cases.
- **D-073-08:** `stream_options={'include_usage': True}` enabled **globally** on every streaming `chat.completions.create` call (OpenAI service + OpenRouter routing). Zero cost; adds one extra final chunk per stream containing usage. Without this flag, OpenAI streams never surface usage. Anthropic native SDK already exposes usage on `MessageStart` / `MessageDelta` events without a flag, so the per-provider capture path inherits parity automatically. Google + other providers: capture if the SDK surfaces it; otherwise see D-073-09.
- **D-073-09:** When the SDK doesn't surface usage (provider gap, network race, parsing fail), finalize writes **`NULL` + emits `logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)`**. NULL is the type-safe sentinel; the warning is the v2.6 observability signal that v3.1 dashboards will render as a coverage gap. No fail, no `0/0` write (0 would silently corrupt averages).

### Test Strategy
- **D-073-10:** **Hybrid mock + real Postgres.** Unit tests against `backend/app/db/runs.py` use an `AsyncMock` pool — fast, deterministic. Integration tests that exercise the actual streaming hot path (CONCUR-01 + new TOKEN-COL-01 gate) hit the local Supabase Postgres on `:54322` via a real asyncpg pool fixture. Honors [[feedback-extraction-root-cause-not-plumbing]] sibling principle: mock for plumbing, real for behavior gates.
- **D-073-11:** **Two binding gates, no overlap.** Keep `backend/tests/integration/test_058_concurrency.py` as-is (mock-Supabase) — it still protects the aexec contract that survives this phase. Add a new `backend/tests/integration/test_073_concurrency.py` that drives a real asyncpg pool against local Postgres, asserts cross-tab GET stays <1s while an asyncpg-finalized run is in flight, AND asserts `runs.input_tokens` / `runs.output_tokens` are non-NULL on a happy-path run (closes SC#3). Two gates prevent false reds on either side.
- **D-073-12:** New autouse fixture **`_reset_pg_pool_singleton`** in `backend/tests/conftest.py` mirrors the established `_reset_redis_singleton` pattern (Phase 062 invented, Phase 074 SEED-011 formalizes). Clears the module-level `_pg_pool` before each test, awaits `pool.close()` in teardown if non-None. Prevents the entire "Event loop is closed" test-debt category from reappearing (asyncpg pools are event-loop-bound, same trap as `aioredis`).

### Claude's Discretion
- **Pool init pattern.** Default to lazy init mirroring `get_redis()` at `dependencies.py:20-44` — module-level cache, no I/O at call time, `from_url`-equivalent only sets up pool config; first awaited acquire does the TCP connect. Planner can pick eager-at-startup-lifespan if there's a concrete reason.
- **Lifespan shutdown ordering.** Close `_pg_pool` before `_supabase` in `backend/app/main.py` lifespan (mirrors the Redis-then-Supabase order already established).
- **Connection auth.** Password embedded in `POSTGRES_DSN` (standard postgres pattern). No separate password lookup.
- **Exact SQL string shape** in `db/runs.py`. Planner finalizes column names + `RETURNING` clauses against the live schema in `supabase/full-schema.sql`.
- **Anthropic / Google / OpenRouter exact usage-extraction shape.** Planner finalizes per-SDK based on what each provider's stream events / response objects expose. Strategy: capture if surfaced; D-073-09 NULL-path if not.
- **Backward-compat shim for `aexec` import in `threads.py`.** Keep the import even if 0 hot-path callers remain in some refactor pass — `aexec` is still imported in 5 other modules (`kb.py`, `runs.py`, `sandbox_outputs.py`, `test_fixtures.py`, `threads.py` for non-hot calls).

### Folded Todos
None. Cross-reference against `.planning/reported-bugs/*.md` with `surface: Agentic-RAG` + `status: open` returned zero hits in the asyncpg / token-telemetry domain. BUG-260514-02 (Anthropic end-of-cycle summary) is in `backend/agent-loop` but is a system-prompt issue, not a DB-layer issue — stays open against its current null routing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement & PRD Sources
- `.planning/PRDs/v2.6.md` §3 Theme B + §4 — WORKER-LIFT-02 scope text (locked 2026-05-10, signoff 2026-05-12)
- `.planning/PRDs/v2.6.md` §3 Theme F + §4 — TOKEN-COL-01 scope (pure observability, forward-fill only, no caps)
- `.planning/REQUIREMENTS.md` line 26 — WORKER-LIFT-02 acceptance criteria
- `.planning/REQUIREMENTS.md` line 53 — TOKEN-COL-01 acceptance criteria
- `.planning/ROADMAP.md` lines 418–429 — Phase 073 goal + 4 success criteria
- `.planning/ROADMAP.md` lines 570–584 — FLAG F-1: TOKEN-COL-01 routing rationale to Phase 073
- `.planning/prd-reset/DECISIONS.md` — D-PRD-08 (multi-worker readiness in v2.6)

### Code Touch Points
- `backend/app/dependencies.py:18-30` — target for `_pg_pool` singleton (SC#1 anchor) + existing `get_redis()` pattern at lines 20-44 to mirror
- `backend/app/utils/db.py` — `aexec` helper (preserved for cold paths, SC#4)
- `backend/app/api/threads.py:158-255` — `_drain_stream_with_close_on_cancel` (Track A drain helper context)
- `backend/app/api/threads.py:974-983` — runs INSERT (flip target #1)
- `backend/app/api/threads.py:1267-1316` — `_persist_assistant_message` + messages INSERT at line 1310 (flip target #3)
- `backend/app/api/threads.py:2616-2682` — `_shielded_finalize` + runs UPDATE at line 2651 (flip target #2 + TOKEN-COL-01 write site)
- `backend/app/main.py` — FastAPI lifespan; extension point for `pool.close()` on shutdown
- `backend/.env.example` — add `POSTGRES_DSN`, `POSTGRES_POOL_MIN`, `POSTGRES_POOL_MAX`

### Test Touch Points
- `backend/tests/integration/test_058_concurrency.py` — CONCUR-01 binding gate (preserved, SC#2). `_build_mock_supabase()` helper is the template for unit-test mock pool.
- `backend/tests/conftest.py` — destination for new `_reset_pg_pool_singleton` autouse fixture (D-073-12)
- `backend/tests/integration/test_073_concurrency.py` (NEW) — asyncpg-specific CONCUR-01 gate + TOKEN-COL-01 non-NULL assertion

### Infrastructure Docs
- `CLAUDE.md` Rules section — D-v2.5-01 ("Do not run blocking I/O directly inside async handlers — wrap with `run_in_threadpool`") — asyncpg satisfies this natively; aexec preservation for cold paths keeps the rule consistent
- `supabase/SETUP.md` — connection-string topology (local Docker on `:54322` + cloud), schema migration story
- `REDIS-SETUP.md` — singleton lazy-init + lifespan shutdown precedent; key-conventions section establishes pattern this phase mirrors for asyncpg
- `supabase/full-schema.sql` — canonical column types for `runs` (input_tokens, output_tokens already exist per PRD §5) and `messages` (JSONB cols for tool_calls, source_refs, confidence_*)

### Prior-Phase Decision Carry-Forward
- Phase 061 STATE.md line ~252 — "token-counter accounting deferred — runs UPDATE leaves input_tokens/output_tokens NULL; SDK usage capture scoped out of 061" — Phase 073 closes this deferral
- Phase 062 plan 02 — `_reset_redis_singleton` per-file autouse fixture (Pitfall 6 mirror) — template for D-073-12
- Phase 074 (SEED-011) — formalizes `_reset_redis_singleton` as suite-wide autouse fixture; aligns with D-073-12 timing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`get_redis()` at `backend/app/dependencies.py:20-44`** — direct model for `get_pg_pool()`: module-level singleton, lazy init at first call, no I/O at call time, closed via lifespan `await aclose()`. Same `global _redis is None: _redis = ...; return _redis` shape.
- **`aexec()` at `backend/app/utils/db.py:32-44`** — survives this phase. Imported by `kb.py`, `runs.py`, `sandbox_outputs.py`, `test_fixtures.py`, and still by `threads.py` for the non-hot calls (thread SELECT, message-history SELECT, user message INSERT, etc.). No deprecation path; coexistence is the point.
- **`_build_mock_supabase()` in `tests/integration/test_058_concurrency.py`** — template for `_build_mock_pg_pool()` in new unit tests. Same factory-fixture pattern.
- **`_shielded_finalize` shape at `threads.py:2616-2682`** — has 6 numbered steps already; step 3 (runs UPDATE) is the surgical insertion point for asyncpg. Steps 2, 4, 5 (Redis terminal sentinel + EXPIRE + ZREM) stay untouched.

### Established Patterns
- **Singleton + lazy init + lifespan close.** Established by `_supabase` and `_redis` in `dependencies.py`. Phase 073 extends to `_pg_pool` without inventing a new pattern.
- **`async with asyncio.shield(...)`** wrapping the finalize block (threads.py:2676) — preserves 058/059 invariant under lifespan cancel. asyncpg pool operations inside the shield work the same as aexec calls did.
- **JSONB col handling via supabase-py** auto-serialization today (e.g., `row["tool_calls"] = completed_tools` at line 1298) — pool-level JSONB codec preserves the same call-site ergonomics.
- **Per-file autouse fixture for event-loop-bound singletons** (`_reset_redis_singleton` pattern) — D-073-12 is the same idiom, suite-wide instead of per-file because asyncpg is going to be touched by more test files than Redis was at Phase 062 introduction.

### Integration Points
- **FastAPI lifespan in `backend/app/main.py`** — add `await pool.close()` BEFORE the existing supabase aclose. Init: `_pg_pool` lazy-loaded on first request (no startup work needed; matches Redis pattern).
- **`backend/.env.example`** — add three lines: `POSTGRES_DSN`, `POSTGRES_POOL_MIN`, `POSTGRES_POOL_MAX` (with comments referencing this phase).
- **`backend/requirements.txt`** — add `asyncpg>=0.29` between `redis` and `supabase` lines (alphabetical-ish placement; mirrors Phase 061's redis insertion).
- **`backend/app/api/threads.py:29`** — `from app.utils.db import aexec` stays. New line: `from app.db.runs import insert_run, finalize_run, insert_assistant_message`.
- **`backend/app/services/openai_service.py`** + provider-specific streaming wrappers — flip `stream_options={'include_usage': True}` on streaming requests (D-073-08). Anthropic native SDK path needs per-event usage capture wiring through to the agent loop accumulator.

</code_context>

<specifics>
## Specific Ideas

- "asyncpg connects to direct Postgres :5432" — explicit rejection of pooler :6543 with rationale (statement caching, simpler local-vs-cloud, no pgbouncer transaction-mode constraints)
- "POSTGRES_DSN env var, same pattern as Redis" — operator-friendly, decoupled from SUPABASE_URL shape
- "Pool min=2 / max=10 env-tunable, headroom for Phase 079's --workers 2"
- "SC-minimum: 3 named sites only" — runs INSERT, runs UPDATE finalize, assistant message INSERT
- "Typed helper module `backend/app/db/runs.py`" — `insert_run`, `finalize_run`, `insert_assistant_message`
- "Pool-level JSONB codec at init" — `set_type_codec` once, plain dicts at every call site
- "Sum across all LLM iterations" — run-level accumulator, not per-call slot
- "stream_options={'include_usage': True} globally" — zero cost, single extra final chunk
- "NULL + `logger.warning` when usage missing" — type-safe sentinel + observability signal for v3.1 dashboards
- "Hybrid test strategy" — AsyncMock pool for unit, real local Postgres :54322 for integration
- "Two binding gates: keep 058 mock, add 073 real" — no false reds, both contracts protected
- "`_reset_pg_pool_singleton` autouse fixture in conftest" — mirrors `_reset_redis_singleton`

</specifics>

<deferred>
## Deferred Ideas

- **pgbouncer transaction-mode pooler / Supabase :6543 endpoint.** Documented in Phase 080 (`RECOVERED_VPS_Deployment_Guide.md` update) as a v3.x scaling lever once connection counts become the bottleneck. Not needed at v2.6's `--workers 2` target.
- **`--workers N` enable + D-PRD-12 ADR authoring + `CLAUDE.md` "Single uvicorn worker" rule rewrite.** Phase 079 owns this; Phase 077 validates the multi-worker harness; Phase 080 updates the deployment docs. Phase 073 is the asyncpg-only prep.
- **v3.1 admin dashboard rendering of token-usage + missing-usage warning signal.** Phase 073 produces the data + the log line; the UI surface is v3.1 (per PRD §11 / project_v3_roadmap_locked).
- **Cached-token columns** (`input_tokens_cached_read`, `input_tokens_cached_write`, etc.). PRD §3 Theme F explicitly scopes to `input_tokens` + `output_tokens` only. Cached-token telemetry can layer in v3.4 spend-cap work if it proves load-bearing for accurate cost calc.
- **Retry-accounting policy** (when a transient provider error retries inside the same run, do we double-count tokens?). Out of scope for v2.6; defer to v3.4 spend-cap work which has stronger correctness requirements.
- **Aggressive hot-path flip** (the alternative to D-073-04). If Phase 077's multi-worker validation surfaces latency hot spots in the still-aexec'd thread SELECT / message-history SELECT / user message INSERT paths, a follow-on phase flips those too. Not pre-planned.

### Reviewed Todos (not folded)
None — no pending todos surfaced as relevant to the asyncpg / token-telemetry domain.

</deferred>

---

*Phase: 073-asyncpg-pool-integration*
*Context gathered: 2026-05-17*
