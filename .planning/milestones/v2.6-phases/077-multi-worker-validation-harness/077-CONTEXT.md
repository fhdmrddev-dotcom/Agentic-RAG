# Phase 077: Multi-Worker Validation Harness - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove that `uvicorn --workers 2` is safe under synthetic load. Run-tracking survives cross-worker cancel, sandbox Docker sessions stay usable across worker bounces via re-create-on-miss, and per-worker Redis/asyncpg/Supabase singletons initialize without cross-talk. This phase does NOT enable multi-worker in production — that's Phase 079. This phase builds the validation harness and proves the contracts hold.

</domain>

<decisions>
## Implementation Decisions

### Load Harness Shape
- **D-077-01:** Claude's discretion on location (pytest integration test vs standalone script vs hybrid). The harness must launch a real `uvicorn --workers 2` subprocess and fire 50 concurrent HTTP requests via `httpx.AsyncClient` — cannot use ASGITransport (single-process only).
- **D-077-02:** **Full LLM mock, zero API cost.** Patch `create_adaptive_streaming_chat` to return a fake stream with ~5 chunks + a tool call. Proves multi-worker plumbing without testing provider behavior (already covered by 075.x phases). Deterministic, millisecond-per-run execution.
- **D-077-03:** The harness asserts CONCUR-01 binding gate stays green under --workers 2 (cross-tab GET unblocked during SSE). The existing `test_058_concurrency.py` mock-Supabase test remains unchanged — it protects the `aexec` contract. The new 077 test hits a live --workers 2 instance.

### Sandbox Stickiness
- **D-077-04:** **Re-create on miss.** If a request lands on a worker without a sandbox session for that `thread_id`, create a new `llm_sandbox` session. No reverse proxy, no Redis session registry, no consistent hashing at the load-balancer level. Simplest approach — no new infrastructure.
- **D-077-05:** **Verify + re-attach to existing Docker container.** Before creating a fresh container, check if the Docker container for that `thread_id` is still running. If alive, attach a new `llm_sandbox` session to the existing container (preserves pip installs, generated files, interpreter state). If container is gone/stopped, create fresh. Gives users seamless experience — installed packages and files survive worker bounces.
- **D-077-06:** The stickiness mechanism must be transparent to the agent loop — `sandbox_manager.get_or_create(thread_id)` remains the only call site. Internal implementation handles the Docker container lookup.

### Cross-Worker Cancel Verification
- **D-077-07:** **Automated test only.** The pytest harness launches --workers 2, starts a mocked long-running run (hits Worker A), then sends `DELETE /runs/{run_id}` (likely hits Worker B since `RUN_TASKS` won't have it). Asserts: run reaches `cancelled` status in Postgres + terminal `zombie_healed` sentinel appears in Redis stream + cancel_lock key was SET. Fully automated, repeatable, no Chrome MCP needed for this infrastructure phase.
- **D-077-08:** The zombie-heal path at `runs.py:459-623` already handles the cross-worker case (SETNX cancel-lock → Postgres UPDATE → synthetic terminal sentinel). No new cancel logic needed — only verification that it works correctly.

### Singleton Safety
- **D-077-09:** **Assert-in-harness validation.** After all 50 runs complete: `redis.zcard('runs:active')` shows correct count (union, not duplicates); asyncpg pool connection count per worker is within configured bounds (max=10). No explicit post-fork hooks needed — the lazy-init-from-None pattern is safe by construction (lifespan runs post-fork in uvicorn pre-fork model).
- **D-077-10:** The three singletons (`_redis`, `_pg_pool`, `_supabase`) are all `None` at module-import time. Lifespan calls `get_redis()` at line 78 of `main.py` — this runs AFTER fork (each worker gets its own event loop + lifespan). Each worker independently initializes its own connections.

### Claude's Discretion
- Exact pytest fixture structure and subprocess management approach for launching --workers 2
- Whether to use a Docker container name convention (e.g., `sandbox-{thread_id}`) for re-attach discovery, or query Docker API by label
- The `llm_sandbox` library's API for attaching to existing containers — researcher to investigate
- Harness assertion granularity (per-run vs batch summary)
- Whether the 50-run count is sequential-then-parallel or all-at-once (asyncio.gather vs staged ramp)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Multi-Worker Architecture
- `.planning/PRDs/v2.6.md` §4 Theme B — Multi-Worker Readiness requirements
- `.planning/REQUIREMENTS.md` line 25 — WORKER-LIFT-01 acceptance criteria
- `CLAUDE.md` "Single uvicorn worker" rule — the D-v2.5-02 constraint this phase validates lifting (Phase 079 officially supersedes)

### Existing Code (Critical Paths)
- `backend/app/dependencies.py` — all three singletons (`_redis`, `_pg_pool`, `_supabase`) with lazy init pattern
- `backend/app/api/runs.py:459-623` — cancel verb + zombie-heal path (SETNX cancel-lock, Postgres UPDATE, terminal sentinel)
- `backend/app/api/threads.py:92` — `RUN_TASKS: dict[UUID, Task]` in-memory per-process registry
- `backend/app/services/sandbox_service.py` — `SandboxSessionManager` with `_sessions` dict keyed by `thread_id`
- `backend/app/main.py:63-112` — lifespan (runs post-fork, initializes Redis, cancels RUN_TASKS, closes pools)

### Existing Tests (Binding Gates)
- `backend/tests/integration/test_058_concurrency.py` — CONCUR-01 cross-tab GET unblocked (mock-Supabase, single-worker). Must stay green.
- `backend/tests/integration/test_073_concurrency.py` — asyncpg hot-path concurrency (real Postgres, single-worker)

### Prior Phase Context
- `.planning/phases/073-asyncpg-pool-integration/073-CONTEXT.md` — D-073-01..12 decisions (pool config, DSN, init pattern, test strategy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `test_058_concurrency.py` — pattern for httpx.AsyncClient + mocked LLM + concurrent request assertions
- `backend/tests/integration/_run_helpers.py` — `_build_mock_supabase()` helper for table-routing mocks
- `sandbox_service.py:SandboxSessionManager` — already has `get_or_create`, `close_session`, `evict_expired` methods
- `backend/app/db/runs.py` — typed SQL helpers (`insert_run`, `finalize_run`) from Phase 073

### Established Patterns
- Module-level singleton with lazy init (`get_redis()`, `get_pg_pool()`, `get_supabase()`) — the pattern all workers inherit
- `_reset_redis_singleton` autouse fixture (`conftest.py`) — pattern for test isolation of module-level singletons
- Redis sorted sets for run tracking (`runs:active`, `runs_by_thread:{thread_id}`) — established key conventions from Phase 061

### Integration Points
- The harness subprocess needs to launch uvicorn with a way to inject mocks (env var to enable test mode? Or monkey-patch at import time?)
- `sandbox_service.py` needs Docker API access to check container status — may need `docker` Python package or subprocess calls to `docker inspect`
- The asyncpg pool sizing (min=2/max=10) was explicitly designed for --workers 2 headroom (D-073-03)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for load harness design and container re-attach mechanics.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Bugs (not folded)
- BUG-260526-02 (Kimi thinking leaks into content) — frontend/streaming domain, not multi-worker
- BUG-260526-03 (finalOutputFiles SSE-only) — frontend/streaming domain, not multi-worker
- BUG-260526-04 (timer disappears mid-cycle) — frontend/streaming domain, not multi-worker

</deferred>

---

*Phase: 077-multi-worker-validation-harness*
*Context gathered: 2026-05-26*
