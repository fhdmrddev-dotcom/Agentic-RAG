# Phase 079: D-v2.5-02 Supersession + Multi-Worker Enable - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 079-d-v2-5-02-supersession-multi-worker-enable
**Areas discussed:** ADR wording + scope, Worker count + config, Migration 045 decision, Live verification scope, CLAUDE.md rule wording, backend/CLAUDE.md creation, PROJECT.md Key Decisions update, How we'd know this failed, .env.example update, Prod deployment specifics

---

## ADR Wording + Scope (Q-v2.6-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Singleton audit table | Include concrete table listing each singleton, per-worker vs Redis-backed, Phase 077 test proof, plus re-trigger clause | ✓ |
| Minimal supersession | Just state supersession + reference Phase 077 | |
| You decide | Claude picks depth | |

**User's choice:** Singleton audit table
**Notes:** User wants the full audit table in D-PRD-12, not just a reference

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — include scaling triggers | Add section with backpressure endpoint as signal source | ✓ |
| No — just enable 2 | Scaling guidance is v3.1 concern | |
| You decide | Claude picks | |

**User's choice:** Yes — include scaling triggers
**Notes:** Backpressure endpoint (Phase 078) is the signal source for when to scale beyond 2

| Option | Description | Selected |
|--------|-------------|----------|
| Reference test file paths | Inline links to 3 test files | |
| Reference 077-VERIFICATION.md only | One level of indirection | |
| You decide | Claude picks based on conventions | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate revert to --workers 1 | Env var flip + bug report | |
| Degraded mode first | Diagnose before reverting | |
| You decide | Claude picks severity threshold | ✓ |

**User's choice:** You decide

---

## Worker Count + Config

| Option | Description | Selected |
|--------|-------------|----------|
| 2 workers fixed | WORKER_COUNT=2 in .env, matches Phase 077 harness | ✓ |
| CPU-based formula | min(cpu_count, 4) at runtime | |
| 1 dev / 2 prod | Different defaults per environment | |

**User's choice:** 2 workers fixed

| Option | Description | Selected |
|--------|-------------|----------|
| .env + backend entrypoint | WORKER_COUNT in backend/.env.example, entrypoint reads it | ✓ |
| Docker Compose only | Set --workers in docker-compose command | |
| You decide | | |

**User's choice:** .env + backend entrypoint

| Option | Description | Selected |
|--------|-------------|----------|
| WORKER_COUNT | Matches ROADMAP.md SC#3, short, project-specific | ✓ |
| WEB_CONCURRENCY | Heroku/Railway convention | |
| UVICORN_WORKERS | Most explicit | |

**User's choice:** WORKER_COUNT

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — update restart-backend.ps1 | Read WORKER_COUNT from .env | |
| No — script is dev-only | Leave as-is | |
| You decide | | ✓ |

**User's choice:** You decide

---

## Migration 052 (runs.spawned_by_worker)

| Option | Description | Selected |
|--------|-------------|----------|
| Ship it — cheap debug utility | One nullable TEXT column, zero perf cost | ✓ |
| Skip it — not needed yet | Phase 077 proved multi-worker without it | |
| You decide | | |

**User's choice:** Ship it

| Option | Description | Selected |
|--------|-------------|----------|
| At run INSERT time | Write PID when run row first INSERTed | ✓ |
| Only when WORKER_COUNT > 1 | Conditional write | |
| You decide | | |

**User's choice:** At run INSERT time

| Option | Description | Selected |
|--------|-------------|----------|
| PID string | str(os.getpid()), e.g., '12345' | ✓ |
| Worker index | 'worker-0', 'worker-1' | |
| hostname:pid | 'vps-01:12345' | |

**User's choice:** PID string

**Notes:** Migration 045 already taken; using 052 as next free slot

---

## Live Verification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Quick smoke test | Two tabs, ~5 min, Phase 077 did heavy lifting | ✓ |
| Cross-provider exercise | Two tabs, different providers, ~15 min | |
| Chrome MCP automated | Script via Chrome MCP, reusable | |

**User's choice:** Quick smoke test

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run 077 tests | Run 3 test files after enabling --workers 2 | ✓ |
| Skip — 077 green is sufficient | No code changes to regress | |
| You decide | | |

**User's choice:** Re-run 077 tests

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — quick backpressure spot-check | Hit endpoint while 2 runs active, verify per-worker counts | ✓ |
| Defer to Phase 082 | Cross-cutting verification covers this | |
| You decide | | |

**User's choice:** Yes — quick backpressure spot-check

---

## CLAUDE.md Rule Wording

| Option | Description | Selected |
|--------|-------------|----------|
| Short reference | One line pointing at D-PRD-12 | ✓ |
| Inline summary | 2-3 lines with singleton summary | |
| You decide | | |

**User's choice:** Short reference

---

## backend/CLAUDE.md Creation

| Option | Description | Selected |
|--------|-------------|----------|
| Skip — repo-root CLAUDE.md is enough | No backend/CLAUDE.md exists; avoids sync burden | ✓ |
| Create backend/CLAUDE.md | Minimal backend-specific rules file | |
| You decide | | |

**User's choice:** Skip — repo-root CLAUDE.md is enough

---

## PROJECT.md Key Decisions Update

| Option | Description | Selected |
|--------|-------------|----------|
| Add to Key Decisions table | New D-PRD-12 row + mark D-v2.5-02 SUPERSEDED | ✓ |
| Just update D-v2.5-02 row | Annotate existing row only | |
| You decide | | |

**User's choice:** Add to Key Decisions table

---

## How We'd Know This Failed (G-6)

| Option | Description | Selected |
|--------|-------------|----------|
| Worker crash on startup | Singleton init doesn't tolerate fork() | |
| Cross-worker state corruption | Garbled output, missing messages, duplicate runs | |
| All of the above + more | Crash + corruption + backpressure wrong counts + sandbox wrong container + doc inconsistency | ✓ |

**User's choice:** All of the above + more
**Notes:** Full failure criteria captured in CONTEXT.md `<failure_criteria>` section

---

## .env.example Update

| Option | Description | Selected |
|--------|-------------|----------|
| Near the top with infra vars | Group with SUPABASE_URL, REDIS_URL, SANDBOX_ENABLED | ✓ |
| In a new 'Performance' section | Separate section for perf vars | |
| You decide | | |

**User's choice:** Near the top with infra vars

---

## Prod Deployment Specifics

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 079 = dev config only; Phase 080 = prod docs | Clean separation: 079 = code + ADR, 080 = ops docs | ✓ |
| Phase 079 includes prod config | Both dev and prod in one phase | |
| You decide | | |

**User's choice:** Phase 079 = dev config only

---

## Claude's Discretion

- ADR reference style (test file paths vs verification report link)
- Re-trigger clause severity threshold
- restart-backend.ps1 update decision
- Lifespan hook ordering and graceful shutdown documentation
- Singleton categories detail level in audit table

## Deferred Ideas

None — discussion stayed within phase scope.
