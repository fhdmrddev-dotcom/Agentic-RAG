# Phase 078: Backpressure JSON Primitive + Code-Quality Bundle - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Five backend code-quality improvements shipped as a single phase: (1) `GET /admin/backpressure` JSON endpoint for the v3.1 dashboard primitive, (2) Supabase singleton `aclose()` on FastAPI lifespan shutdown, (3) context-window protected-only overrun hardening, (4) concurrent-upload dedup race closure via partial unique index + atomic CAS, (5) title-generation failure logging.

No frontend work. No new SSE events. No schema changes beyond migration 043 (partial unique index).

</domain>

<decisions>
## Implementation Decisions

### Context-Window Overrun Strategy (CQ-CTX-01)
- **D-078-01:** Progressive trim — when all trimmable messages are exhausted and the protected tail (`reserve_recent`) still exceeds `max_tokens`, continue trimming oldest protected messages inward. The agent keeps working but may lose some recent context. The existing `_TRIM_MARKER` synthetic message marks the cut point. Matches how Claude.ai and ChatGPT handle long threads — they silently drop older turns rather than refusing.
- **D-078-02:** No hard error path. The function always returns a valid message list that fits within `max_tokens`. The only hard floor is system prompt + the last user message — if even those two don't fit, that's an impossible model configuration (context_window < ~200 tokens), not a runtime condition worth handling.

### Concurrent Upload Dedup (CQ-DEDUP-01)
- **D-078-03:** Migration 043 adds a partial unique index on `documents (user_id, content_hash, folder_id) WHERE status != 'failed'`. The `folder_id` NULL case needs `COALESCE` or `IS NOT DISTINCT FROM` semantics so root-level uploads also dedup correctly.
- **D-078-04:** When a concurrent duplicate INSERT hits the unique constraint, the backend catches the Postgres unique-violation error and returns **HTTP 409** with a clear message ("File already exists in this folder"). No silent swallowing — the user knows one upload won, one didn't.
- **D-078-05:** The existing SELECT-based dedup check at `documents.py:407-420` stays as a fast-path (avoids the INSERT attempt in the common case). The unique index is the safety net for the race condition.

### Backpressure Endpoint (WORKER-LIFT-04)
- **D-078-06:** Ship the 4 SC-specified signals: `anyio_threadpool_depth` (limiter.borrowed_tokens / total_tokens), `redis_active_runs` (ZCARD runs:active), `postgres_pool_in_use` (pool.get_size() - pool.get_idle_size()), `per_worker_run_count` (len(RUN_TASKS)).
- **D-078-07:** Auth gating via `BACKPRESSURE_ADMIN_USER_IDS` env var (comma-separated Supabase Auth user IDs). Fail-closed when `ENVIRONMENT=production` and the var is empty/unset — returns 403. In dev (default), fail-open so testing works without config. The endpoint uses the existing `get_current_user` Supabase Auth dependency to extract the caller's user ID.
- **D-078-08:** JSON shape is additive-only — v3.1 can add fields (uptime, sandbox sessions, memory) without breaking existing consumers.

### Supabase Shutdown (CQ-SUPA-01)
- **D-078-09:** `await _supabase.aclose()` runs as the final step in the lifespan shutdown sequence — after RUN_TASKS cancel, after Redis aclose, after asyncpg pool close, before sandbox close_all. Mirrors the startup-reverse teardown pattern already in `main.py:64-126`.

### Title-Gen Warning (CQ-TITLE-01)
- **D-078-10:** Add `logger.warning` inside `generate_thread_title` at the generic `except Exception` handler (currently `threads.py:1036`) with exception detail. The caller at `threads.py:1360-1367` already logs but the function-level catch is silent. Both sites should log — the function logs "what failed" and the caller logs "title generation skipped for this run". Fallback behavior (`first_user_message[:40]`) preserved unchanged.

### Claude's Discretion
- Migration 043 exact DDL (partial unique index syntax, COALESCE handling for NULL folder_id) — planner decides based on Postgres partial index best practices
- `test_lifespan.py` test structure — researcher/planner decide assertion approach
- `test_context_window.py` new test cases for protected-only trim — planner decides edge case coverage
- Backpressure integration test structure — planner decides mock vs live approach
- Ordering of the 5 items across plans and waves — planner decides optimal dependency ordering

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — CQ-SUPA-01, CQ-CTX-01, CQ-DEDUP-01, CQ-TITLE-01, WORKER-LIFT-04 requirement definitions
- `.planning/ROADMAP.md` Phase 078 details (line ~870) — Success Criteria 1-5, depends-on Phase 073

### Migration
- `.planning/prd-reset/MIGRATION-RESERVATIONS.md` — migration 043 reserved for Phase 078
- `supabase/migrations/` — existing migration numbering convention (NNN_name.sql)

### Backend Code (primary touch points)
- `backend/app/services/context_window.py` — `trim_messages_to_fit` (line 151), `_remove_oldest_atomic` (line 248) — the overrun fix site
- `backend/app/main.py` — `lifespan()` (line 64) — Supabase aclose insertion site
- `backend/app/api/threads.py` — `generate_thread_title` (line 969), `RUN_TASKS` dict — title-gen + backpressure signal source
- `backend/app/api/documents.py` — upload handler (line ~400), `content_hash` dedup check (line 407-420) — dedup CAS site
- `backend/app/dependencies.py` — `_pg_pool` singleton (asyncpg pool stats), `get_redis`, Supabase client

### Prior Decisions
- D-v2.5-01 — no blocking I/O in async handlers (applies to the new backpressure endpoint)
- Phase 073 — asyncpg pool at `_pg_pool` in `dependencies.py` (backpressure reads its stats)
- Phase 061+ — `runs:active` Redis sorted set convention (backpressure reads ZCARD)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_current_user` dependency at `backend/app/dependencies.py` — Supabase Auth JWT extraction, reuse for backpressure endpoint auth
- `aexec()` helper — wraps sync Supabase calls in threadpool, used throughout `threads.py` and `documents.py`
- `settings` singleton at `backend/app/config.py` — env var reader, add `BACKPRESSURE_ADMIN_USER_IDS` and `ENVIRONMENT` here
- Existing test patterns in `backend/tests/unit/test_context_window.py` — 8 existing tests for `trim_messages_to_fit`, add protected-overrun cases

### Established Patterns
- Lifespan shutdown follows startup-reverse order: RUN_TASKS cancel → Redis aclose → asyncpg pool close → sandbox close
- Migration files at `supabase/migrations/NNN_name.sql` — apply via SQL editor, never `db push`/`db reset`
- Router registration at `backend/app/main.py` — new admin router follows existing `include_router` pattern
- Config env vars read via pydantic `Settings` class at `backend/app/config.py`

### Integration Points
- New `GET /admin/backpressure` route — either on existing router or a new `/admin` router
- `_supabase` client import from `dependencies.py` into `main.py` lifespan
- `RUN_TASKS` import from `threads.py` into backpressure endpoint (already imported in lifespan)
- `_pg_pool` import from `dependencies.py` into backpressure endpoint (already imported in lifespan)

</code_context>

<specifics>
## Specific Ideas

- User wants the backpressure endpoint designed for competitive advantage: ship the 4 SC-specified signals now, but architect the JSON shape to be additive so v3.1 can enrich with `uptime_seconds`, `sandbox_active_sessions`, `memory_rss_mb`, request latency percentiles without breaking consumers
- Auth escalation path: env-var allow-list (v2.6) → RBAC operator role (v3.1) → API key auth (v3.3) — each layer replaces the previous, no backwards-compat shims

</specifics>

<deferred>
## Deferred Ideas

- **Additional backpressure signals** (uptime, sandbox sessions, memory RSS, latency percentiles) — deferred to v3.1 dashboard UI phase; JSON shape is additive-only so no breaking change needed
- **RBAC auth for admin endpoints** — deferred to v3.1 operator role; env-var allow-list is the v2.6 stepping stone
- **ConversationTooLongError hard-error path** — rejected for v2.6 in favor of progressive trim; could be revisited if users report confusion from heavily-trimmed contexts

None — discussion stayed within phase scope

</deferred>

---

*Phase: 078-backpressure-json-primitive-code-quality-bundle*
*Context gathered: 2026-05-27*
