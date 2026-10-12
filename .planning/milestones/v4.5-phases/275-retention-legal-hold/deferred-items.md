# Phase 275 — deferred items (out of scope for the plan that found them)

## 275-01: a refused function call crashes the LOCAL Postgres backend

- **Found:** 2026-10-12, 275-01 Task 2, while a live test called `retention_held_documents` as `authenticated`.
- **What:** calling ANY function the role lacks EXECUTE on kills the backend and puts the local database
  into crash recovery for every session. The pre-existing `resize_embedding_column(integer)` (migration 177)
  reproduces it identically, so it is not caused by migration 204/205. Table-privilege refusals do not crash.
- **Likely home:** a preloaded extension's hook (`pgaudit`, `plpgsql_check`, `pg_tle`, `plan_filter`,
  `supautils` are all loaded). Not narrowed further — that needs server logs (`docker logs`), which this
  executor cannot read.
- **Why it matters:** if production behaves the same, any authenticated caller could crash a backend by
  calling a revoked RPC through PostgREST (e.g. `POST /rest/v1/rpc/resize_embedding_column`). UNMEASURED in
  production — measuring it means crashing a production backend, which needs an explicit operator decision.
- **Interim rule for tests:** assert function privileges with `has_function_privilege` / `proacl`; never
  call a revoked function as a JWT role against the shared local database.
- **Suggested route:** a reported bug (`surface: Agentic-RAG`, infra) — read `docker logs supabase_db_*`
  around a single reproduction, then decide whether production needs a probe.
