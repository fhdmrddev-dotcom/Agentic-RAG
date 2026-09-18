---
seed_id: SEED-001
title: Scale Readiness — multi-user concurrent load
planted_during: v2.5 SSE Concurrency & Reconnect Stability (2026-05-01)
trigger_when:
  - Feature set declared "complete" (no major new feature milestones in flight)
  - Concurrent-user load reported by >10 simultaneous active users in production
  - Latency or queueing complaints from users (P95 response time degradation, "spinner stuck" reports)
  - Backend logs show AnyIO threadpool saturation (queueing at the limiter)
status: folded
partial: true
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partial-consumed

  Mapped `partial-consumed` -> `folded` + `partial: true`. Reason: READ SEED-001 — consumed_by Phase 073 + 079, load testing still owed.
consumed_by:
  - Phase 073 (asyncpg hot-path integration)
  - Phase 079 (multi-worker enable + D-PRD-12 ADR)
partial_note: "CONCUR-03 asyncpg migration partly addressed by Phase 073; multi-worker production deployment addressed by Phase 079 + D-PRD-12. Remaining scope: full load testing under concurrent users, AnyIO threadpool ceiling audit under production traffic. Retain as planted with narrowed scope for v2.7+ trigger."
related_seeds:
  - SEED-003
  - SEED-036
  - SEED-048
  - SEED-055
  - SEED-065
  - SEED-076
  - SEED-077
  - SEED-081
surface: Agentic-RAG
---

# SEED-001: Scale Readiness — multi-user concurrent load

## Idea

Bring the backend to production-grade concurrent-user readiness by eliminating the AnyIO threadpool ceiling, planning a real multi-worker deployment, and treating Realtime as a tunable enhancement rather than a critical-path dependency.

## Scope (when triggered)

This seed becomes a milestone or set of phases when triggered. Likely scope:

1. **CONCUR-03 — asyncpg migration for hot paths**
   Migrate the streaming endpoint specifically (and any other hot paths) from sync `supabase-py` (`run_in_threadpool`-wrapped) to `asyncpg` directly, removing the AnyIO 40→200 threadpool ceiling entirely. Keep `supabase-py` for less-hot endpoints if RLS / metadata convenience justifies the threadpool dispatch.

2. **Multi-worker production deployment**
   - Validate `uvicorn --workers N` (N = CPU cores) safely with v2.5's blocking-call fixes in place.
   - Audit any module-level globals that assume single-worker state (rare in this codebase, but verify).
   - Move sessions / caches that need cross-worker coherence to Redis.

3. **Sticky websocket sessions if Realtime returns as authoritative**
   - Required only if STREAM-03 (Realtime as low-latency hint layer) is reintroduced as more than best-effort.
   - Load balancer config: hash-based sticky session for Supabase Realtime channel WebSockets.

4. **Backpressure + queueing instrumentation**
   - Metric: AnyIO threadpool saturation (queue depth)
   - Metric: SSE active stream count per worker
   - Metric: Agent loop end-to-end latency P50/P95/P99
   - Surface in Knowledge Health Dashboard or a new operations dashboard.

5. **Rate limiting**
   - Per-user concurrent SSE stream cap (currently no limit — one user could open N tabs and consume all worker slots)
   - Per-user request-rate limit on the SSE endpoint specifically

## Why This Matters

The bug fixed in v2.5 (sync supabase calls blocking the event loop) was masked in dev by single-worker, but the **same bug shape** surfaces in production under load:

- Each worker has a **default 40-thread AnyIO ceiling**
- LLM agent loops issue 5–20 DB calls each (search, embed, persist, audit, …)
- ~8–32 concurrent users saturate per cluster before queueing starts visibly hanging

v2.5 buys 5× headroom by raising the AnyIO ceiling from 40 → 200 (D-058-01 in the Phase 058 plan). That's enough for a small user base but **not** for a production launch with hundreds of concurrent users. The proper fix — `asyncpg` direct — was deliberately deferred from v2.5 because:

- v2.5 is a 5-phase bug-fix milestone; expanding it to include async migration would dilute focus
- The threadpool wrap is mechanical and safe; the async migration touches every retrieval/persistence helper and needs its own milestone with its own test coverage
- Without observability of actual queue depth, premature optimization risks the wrong thing

The right time to do this work is **after** the feature surface stops moving, **before** scaling marketing or customer onboarding past ~10 active concurrent users.

## What This Seed Avoids

Planting this as a seed (rather than expanding v2.5 or planning it now) prevents:

- Scope creep on v2.5 (already a hard fix-up milestone with two prior failures)
- Over-engineering before real load data is available (the AnyIO bump may be sufficient longer than expected)
- Locking in a multi-worker deployment topology before answering the Realtime/STREAM-03 question

## Companion Documents

- `.planning/research/058-sse-concurrency-research.md` — Section A2 (asyncpg vs run_in_threadpool tradeoff), Section A4 (Uvicorn workers tradeoffs)
- `.planning/REQUIREMENTS.md` — Future Requirements section: CONCUR-03 already enumerated as deferred
- `.planning/PROJECT.md` — Out of Scope: "Multi-worker uvicorn (`--workers N`)" with reason captured

## Decision Triggers

Surface this seed during `/gsd:new-milestone` if any of the following are true:
- The current milestone is post-feature-complete (no new major capability work)
- Production telemetry reports concurrent-user contention
- A future "operations" or "platform" milestone is being scoped
- A pre-launch readiness review is underway

---
*Planted 2026-05-01 during v2.5 milestone bootstrap by recommendation of research synthesis and user request.*

## Strengthen — 2026-06-10 alignment sweep (Phase 101, workflow wf_13ed5033)

This sweep sharpens the scale-readiness picture with the **Postgres connection
ceiling** — a dimension the original seed underweighted by focusing on the
AnyIO threadpool. Even after CONCUR-03 (asyncpg direct, Phase 073) removes the
threadpool bottleneck, the database itself becomes the next hard wall, and the
math has to be aggregated, not estimated per-component.

### Aggregate the Postgres connection math (do this before any scale launch)

The asyncpg pool is configured **per worker** with `min_size=2` / `max_size=10`.
Under the default multi-worker topology (`WORKER_COUNT=2`, can scale higher per
D-PRD-12), the worst-case asyncpg demand is `WORKER_COUNT × 10` connections —
and that is **on top of** the parallel `supabase-py` clients still in use for
non-hot endpoints (RLS/metadata convenience paths per CONCUR-03 scope item 1).
The sum of (asyncpg pool max across all workers) + (concurrent supabase-py
client connections) must be reconciled against Postgres `max_connections`. There
is **no aggregate audit of this today** — each component sizes its pool in
isolation, so the cluster can silently overcommit the database as `WORKER_COUNT`
climbs. This needs to be computed and bounded, not assumed.

### No connection-pooler posture has been decided (landmine)

The app has **no pgbouncer / transaction-pooler posture decided** — neither in
front of asyncpg nor for the supabase-py clients. This is not a neutral gap: if
a transaction pooler is later dropped in to fan many app connections onto few
Postgres backends, **asyncpg's prepared-statement caching is incompatible with
pgbouncer transaction-pooling mode**. The fix is to set
`statement_cache_size=0` on the asyncpg pool — but that has to be a *deliberate*
decision made when the pooler lands, not discovered as a production incident
(stale/cross-session prepared statements under transaction pooling cause
hard-to-diagnose query failures). Flag this as a known landmine so whoever wires
the pooler does it eyes-open.

### Per-user caps are still unbuilt (re-confirming item 5)

Scope **item 5 (Rate limiting)** above remains entirely unbuilt: there is still
no **per-user concurrent-SSE-stream cap** and no **per-user request-rate limit**
on the SSE endpoint. SEED-055 (true parallel chats) actively *widens* this
exposure — a single user can now legitimately hold multiple concurrent streams,
each consuming a worker slot and a DB connection from the math above, so the
"open N tabs and starve the cluster" risk is larger than when this seed was
planted.

### Make pool/pooler sizing a v3.1 deployment-preset PUBLISHED requirement

The connection-math reconciliation and the pooler posture should not stay
advisory. Promote **pool sizing + pooler posture** to a **PUBLISHED requirement
of the v3.1 deployment-preset** work — i.e. a deployment preset is not
considered valid/publishable until it declares (and self-checks) that
`WORKER_COUNT × asyncpg_max + supabase-py clients ≤ Postgres max_connections`
and states its pooler posture (none / session-pool / transaction-pool +
`statement_cache_size=0`). This ties the abstract scale risk to a concrete gate.

### Cross-links

- **Scale cluster (this sweep's siblings):** SEED-076 (filtered-vector-search
  recall + pgvector index strategy at corpus scale), SEED-077 (durable ingestion
  job queue + throughput at scale), SEED-081 (provider rate-limit resilience +
  fan-out admission control), SEED-065 (load degradation / Redis).
- **SEED-055 (concurrent chats)** — widens the per-user stream/connection
  exposure called out in item 5.
- Adjacent: SEED-003 (deployment flexibility — the v3.1 deployment-preset home),
  SEED-036 (task() concurrency quota), SEED-048 (embeddings SPOF).
