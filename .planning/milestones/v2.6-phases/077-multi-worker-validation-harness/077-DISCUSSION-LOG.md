# Phase 077: Multi-Worker Validation Harness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 077-multi-worker-validation-harness
**Areas discussed:** Load harness shape, Sandbox stickiness, Cross-worker cancel proof, Singleton safety

---

## Load Harness Shape

### Q1: Where should the 50-parallel-run harness live?

| Option | Description | Selected |
|--------|-------------|----------|
| pytest integration test | New test_077_multiworker_load.py alongside test_058 pattern. Runs with pytest, uses httpx.AsyncClient against live --workers 2 uvicorn with mocked LLM. | |
| Standalone script + pytest gate | scripts/multiworker_load.py launches uvicorn subprocess, fires 50 requests, thin pytest wrapper calls script. | |
| You decide | Claude picks based on existing test patterns. | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** Claude will pick best approach based on existing test infrastructure patterns.

### Q2: Should the harness mock the LLM or use real calls?

| Option | Description | Selected |
|--------|-------------|----------|
| Full mock | Patch create_adaptive_streaming_chat to return fake stream. Zero API cost, deterministic. | ✓ |
| Hybrid — mock + 1 real | 49 mocked + 1 real run for end-to-end proof. | |
| You decide | Claude picks based on test infrastructure constraints. | |

**User's choice:** Full mock
**Notes:** Zero API cost, millisecond runs, deterministic. Proves plumbing without testing provider behavior.

---

## Sandbox Stickiness

### Q3: How should sandbox sessions survive worker bouncing?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-create on miss | Create new session if request lands on wrong worker. Sandbox container is per-thread, so new session attaches to same Docker container. ~2s delay on first code run after bounce. | ✓ |
| Redis session registry | Store session metadata in Redis. Any worker can look up and re-attach. Adds Redis dependency to sandbox path. | |
| Consistent hash at proxy | Add nginx/caddy with sticky sessions. Guarantees same client hits same worker. Heaviest change. | |

**User's choice:** Re-create on miss
**Notes:** Simplest approach, no new infrastructure.

### Q4: Container re-attach behavior on miss?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify + re-attach | Check if Docker container is still running. If yes, attach to existing (preserves pip installs, files). If gone, create fresh. | ✓ |
| Always fresh | Discard affinity, always create new container. User loses pip packages and files on bounce. | |
| You decide | Claude picks based on llm_sandbox API. | |

**User's choice:** Verify + re-attach
**Notes:** Preserves user's installed packages and generated files across worker bounces.

---

## Cross-Worker Cancel Proof

### Q5: How to verify cross-worker cancel works?

| Option | Description | Selected |
|--------|-------------|----------|
| Automated test only | pytest launches --workers 2, starts run on W1, sends DELETE from W2, asserts cancelled status + zombie_healed sentinel. | ✓ |
| Both automated + Chrome MCP | Automated plus two-tab live Chrome MCP scenario. | |
| Chrome MCP only | Skip automated, verify via lived-experience only. | |

**User's choice:** Automated test only
**Notes:** Fully automated, repeatable, no Chrome MCP needed for infrastructure phase.

---

## Singleton Safety

### Q6: How deep should singleton validation go?

| Option | Description | Selected |
|--------|-------------|----------|
| Assert in harness | After 50 runs: check redis.zcard('runs:active') for correct count + asyncpg pool size within bounds. Observable behavior validation. | ✓ |
| Explicit post-fork hook | Add uvicorn post-fork callback that resets singletons to None (defense-in-depth). Overkill given lazy-init pattern. | |
| You decide | Claude picks appropriate validation depth. | |

**User's choice:** Assert in harness
**Notes:** Validate via observable behavior, not defensive hooks. Lazy-init-from-None pattern is safe by construction.

---

## Claude's Discretion

- Exact harness location (pytest integration test vs standalone script)
- Docker container discovery mechanism for re-attach
- llm_sandbox API for attaching to existing containers
- Subprocess management for launching --workers 2 in tests
- 50-run concurrency pattern (all-at-once vs staged ramp)

## Deferred Ideas

None — discussion stayed within phase scope.
