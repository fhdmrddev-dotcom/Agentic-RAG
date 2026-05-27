# Phase 073: asyncpg Pool Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 073-asyncpg-pool-integration
**Areas discussed:** Connection topology & pool config, Scope of the asyncpg flip, Token capture mechanics, Test strategy for CONCUR-01 gate

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Connection topology & pool config | Direct Postgres vs Supabase pooler; DSN source; pool sizing | ✓ |
| Scope of the asyncpg flip | Conservative (3 SC sites) vs aggressive (all hot path); SQL home | ✓ |
| Token capture mechanics | Aggregation shape; include_usage flag; missing-usage handling | ✓ |
| Test strategy for CONCUR-01 gate | Mock vs real Postgres; 058 gate preservation; pool-reset fixture | ✓ |

**User's choice:** All four areas selected.

---

## Connection topology & pool config

### Question 1: asyncpg can connect two ways to Supabase. Which do you want?

| Option | Description | Selected |
|--------|-------------|----------|
| Direct Postgres (port 5432) | Recommended. asyncpg owns its own pool, prepared-statement caching at full speed, simplest local-vs-cloud story | ✓ |
| Supabase pooler (port 6543, transaction mode) | Trades raw perf for connection-count efficiency; forces statement_cache_size=0 | |
| You decide | Claude picks | |

**User's choice:** Direct Postgres (port 5432).

### Question 2: How should the asyncpg connection string be sourced?

| Option | Description | Selected |
|--------|-------------|----------|
| New POSTGRES_DSN env var (explicit) | Recommended. Same pattern as Redis. Local default + cloud paste-from-dashboard story | ✓ |
| Derive from SUPABASE_URL | Parse host, swap port; fragile, requires separate password lookup | |

**User's choice:** New POSTGRES_DSN env var.

### Question 3: Pool size defaults — today's app is single-worker; Phase 079 will light up --workers 2.

| Option | Description | Selected |
|--------|-------------|----------|
| min=2 / max=10, env-tunable | Recommended. Conservative for today's load; max=10 leaves headroom for --workers 2 | ✓ |
| min=1 / max=5, env-tunable | Tighter footprint, risks brief queueing under bursts | |
| You decide | Claude picks based on hot-path call frequency | |

**User's choice:** min=2 / max=10, env-tunable.

**Notes:** All three recommended options chosen. Locks D-073-01, D-073-02, D-073-03.

---

## Scope of the asyncpg flip

### Question 1: How aggressive is the flip from aexec→asyncpg in threads.py?

| Option | Description | Selected |
|--------|-------------|----------|
| SC-minimum: 3 named sites only | Recommended. Move runs INSERT, runs UPDATE finalize, assistant message INSERT only. Smallest diff, tightest test surface | ✓ |
| Full hot-path lift | Move all ~8 supabase calls in the streaming hot path. Wins more latency but 2x diff | |
| You decide | Claude picks | |

**User's choice:** SC-minimum: 3 named sites only.

### Question 2: Where do the asyncpg SQL strings live?

| Option | Description | Selected |
|--------|-------------|----------|
| Small typed module: backend/app/db/runs.py | Recommended. Typed helpers, testable, mirrors multimodal_service/extraction_service pattern | ✓ |
| Inline SQL strings in threads.py | Minimum diff but worsens 2725-line file's read-ability | |

**User's choice:** Small typed module: backend/app/db/runs.py.

### Question 3: How does asyncpg handle the JSONB columns?

| Option | Description | Selected |
|--------|-------------|----------|
| Register pool-level JSONB codec | Recommended. set_type_codec at init; call sites pass plain dicts | ✓ |
| Explicit json.dumps() at each call site | More verbose, no global magic, easier per-site debug | |

**User's choice:** Register pool-level JSONB codec.

**Notes:** All three recommended options chosen. Locks D-073-04, D-073-05, D-073-06.

---

## Token capture mechanics

### Question 1: What does runs.input_tokens / runs.output_tokens represent?

| Option | Description | Selected |
|--------|-------------|----------|
| Sum across all iterations in the run | Recommended. Matches v3.1 admin + v3.4 spend-cap use cases | ✓ |
| Only the final iteration's tokens | Under-counts heavily for multi-tool runs | |

**User's choice:** Sum across all iterations in the run.

### Question 2: OpenAI / OpenRouter streaming omits usage unless stream_options={'include_usage': True}. Do we flip it on?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — enable globally for streaming | Recommended. Zero cost; one extra final chunk per stream | ✓ |
| Per-provider, gated by capability flag | Creates two code paths; gate would be true everywhere anyway | |

**User's choice:** Yes — enable globally for streaming.

### Question 3: When the SDK doesn't surface usage, what does the finalize write?

| Option | Description | Selected |
|--------|-------------|----------|
| NULL + logger.warning | Recommended. Per PRD: NULL writes become dashboard warning signal | ✓ |
| Write 0 / 0 | Silently corrupts averages in dashboards | |

**User's choice:** NULL + logger.warning.

**Notes:** All three recommended options chosen. Locks D-073-07, D-073-08, D-073-09. Anthropic native SDK already surfaces usage on MessageStart/MessageDelta events without a flag; per-provider capture inherits parity automatically.

---

## Test strategy for CONCUR-01 gate

### Question 1: How should asyncpg show up in the test suite — mock the pool, or hit real Postgres?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid — mock for unit tests, real local Postgres for integration | Recommended. Honors prior mock/prod-divergence burn | ✓ |
| Pure mock everywhere | Faster CI but lets deadlock-prone code pass tests | |
| Pure real Postgres | Highest fidelity but overkill for unit tests | |

**User's choice:** Hybrid — mock for unit tests, real local Postgres for integration.

### Question 2: CONCUR-01 binding gate (test_058_concurrency.py) currently mocks Supabase. What's the protection contract after the flip?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend 058 + add new test_073_concurrency.py | Recommended. Two gates, no overlap, no false reds | ✓ |
| Rewrite 058 to use real asyncpg, retire mock | Loses protection for the aexec contract preserved in cold paths | |

**User's choice:** Extend 058 + add new test_073_concurrency.py.

### Question 3: Singleton hygiene — asyncpg pools are event-loop-bound (same "Event loop is closed" trap as aioredis).

| Option | Description | Selected |
|--------|-------------|----------|
| Add _reset_pg_pool_singleton autouse fixture | Recommended. Mirrors established _reset_redis_singleton pattern | ✓ |
| Per-file fixture, opt-in | Smaller blast radius; easy to forget on new test file | |

**User's choice:** Add _reset_pg_pool_singleton autouse fixture.

**Notes:** All three recommended options chosen. Locks D-073-10, D-073-11, D-073-12.

---

## Claude's Discretion

The following were not asked of the user but flagged in CONTEXT.md as Claude-decided:

- Pool init pattern (lazy, mirrors get_redis at dependencies.py:20-44)
- Lifespan shutdown ordering (close pool before _supabase)
- Connection auth (password embedded in POSTGRES_DSN — standard postgres pattern)
- Exact SQL string shape in db/runs.py (planner finalizes column names + RETURNING clauses)
- Anthropic / Google / OpenRouter exact usage-extraction shape (per-SDK; planner finalizes)
- Backward-compat shim for `aexec` import in threads.py (kept; still used by 5 modules)

## Deferred Ideas

- pgbouncer transaction-mode pooler → Phase 080 / v3.x scaling lever
- --workers N enable + D-PRD-12 ADR + CLAUDE.md rewrite → Phases 077 / 079 / 080
- v3.1 admin dashboard rendering of token-usage + missing-usage warning → v3.1
- Cached-token columns → out of PRD scope; v3.4 spend-cap candidate
- Retry-accounting policy (double-count on transient retry) → v3.4 spend-cap
- Aggressive hot-path flip (alternative to D-073-04) → follow-on phase if Phase 077 surfaces latency

## Reported Bugs Cross-Reference

Filter: `surface: Agentic-RAG` + `status: open` + `affected_areas` overlapping Phase 073 domain (backend/agent-loop, backend/ingestion, runs table, streaming finalize, DB layer).

| Bug | Domain | Disposition |
|---|---|---|
| BUG-260514-02 (Anthropic end-of-cycle shows actions not summary) | backend/agent-loop, backend/system-prompts | NOT FOLDED — system-prompt issue, not DB-layer. Stays open. |
| BUG-260514-01 (Tool-output download bloat) | frontend/tool-card-display | NOT IN DOMAIN |
| BUG-260514-03 (Streaming indicator desync) | frontend/streaming | NOT IN DOMAIN |

Zero bugs folded into Phase 073.
