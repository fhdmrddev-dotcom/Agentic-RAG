---
seed_id: SEED-071
title: Sandbox execution fleet — production scaling, admission control & deployment-flexible topology (no single-host assumption)
status: planted
planted: 2026-06-10
phase_origin: Phase 101 plan-phase 2026-06-10 — operator question on the docxtpl sandbox footprint + "how does this scale with hundreds of users"; answered by a 4-agent fan-out investigation (workflow wf_1a163844) that surfaced the gap as pre-existing and independent of Phase 101
category: scale / infrastructure-flexibility — the Docker code-execution sandbox fleet; an admission-control + topology-selection seam, NOT a new feature
related_seeds: [SEED-001, SEED-003, SEED-004, SEED-036, SEED-070, SEED-062, SEED-025, SEED-043, SEED-063]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, feedback_preserve_engine_optionality]
related_decisions:
  - "D-PRD-12 (multi-worker uvicorn default + singleton audit) — the sandbox _sessions dict was NOT added to the audit table; re-attach-by-name is the de-facto cross-worker mechanism"
  - "D-077-05 (sandbox container re-attach by name on worker bounce — sandbox_service.py:50-56, _find_existing_container:87-125)"
  - "Phase 101 D-13 (keep the render-execution backend a swappable seam) — the same seam an alternate sandbox topology would route through"
trigger_when:
  - A milestone scoped to multi-tenancy / org-level (SEED-004), SaaS, "platform", "infrastructure", or "deployment requirements" is planned
  - The lighter online subscription (multi-tenant hosted SaaS) product line is scoped — per-tenant sandbox isolation + caps + autoscaling become mandatory, not optional
  - Production/telemetry shows sandbox container RAM pressure or a Docker host approaching saturation (container count × resident RAM)
  - A B2B customer with their own infrastructure requires a documented sandbox topology + host-sizing requirements matrix to deploy
  - SANDBOX_ENABLED is turned on for a SHARED (>1 user) deployment for the first time
  - The "Setting up agent…" warm-up phase (BUG-260607-02 / SEED-070) is scoped — pre-warm + pooling overlap with the admission-control work here
priority: medium — a real, pre-existing production gap, but not load-bearing until a shared/multi-tenant deployment exists or telemetry shows host saturation. Single-operator and small-team-on-one-host work fine today.
suggested_phase: a future platform/infrastructure milestone (v3.x), co-planned with SEED-003 (deployment shapes) + SEED-004 (tenancy). NOT v2.9 — Phase 101 only preserves the swappable seam (D-13).
---

# SEED-071 — Sandbox execution fleet: scaling, admission control & deployment-flexible topology

## The gap (grounded in current code)

The agent's `execute_code` tool — and, after Phase 101, the `render_template` tool —
run inside Docker containers managed by `llm_sandbox` (`backend/app/services/sandbox_service.py`).
A 4-agent code investigation on 2026-06-10 found the sandbox fleet has **no production
scaling story**:

| Property | Current behavior | Evidence |
|---|---|---|
| Container unit | **One container per active chat thread** (`sandbox-{thread_id[:12]}`), created **lazily** on the first `execute_code`/render call in that thread | `sandbox_service.py:40,58-61`; `tool_dispatcher.py:554` |
| Lifetime | Kept alive **30 min after last use** (lazy TTL eviction, checked only on the *next* `get_or_create` — **no background reaper**) | `config.py:750` (`sandbox_ttl_minutes=30`); `sandbox_service.py:38,187-195` |
| Concurrency cap | **NONE** — no pool, no semaphore, no `max_containers`, no admission control. Every new code-running thread spawns its own container unconditionally | `sandbox_service.py:25-85` (no cap); `grep` for `mem_limit\|pool_size\|semaphore\|max_containers` → 0 matches |
| Per-container limits | **NONE** — `runtime_configs` sets only `name` + `labels`; no Docker `mem_limit`/`cpu` | `sandbox_service.py:58-61` |
| Worker model | `_sessions`/`_last_used` are **per-uvicorn-worker module-global dicts**; a re-attach-by-name fallback keeps 2 workers from double-spawning the same thread (D-077-05) | `sandbox_service.py:16-17,50-56`; NOT in the D-PRD-12 singleton audit table |
| Host model | `docker.from_env()` → **local Docker socket**; single host implied | `sandbox_service.py:102-103` |
| Prod guidance | The only documented prod target (Phase 080 VPS runbook) sizes Redis/workers/pgbouncer but says **nothing** about sandbox container scaling or host sizing | `080-RESEARCH.md` (Redis/pgbouncer/workers only) |
| Unused capacity | `llm_sandbox` ships a container `pool/` module — **never wired in** | venv `llm_sandbox/pool/` not imported |

**Rough scale math** (resident RAM per active container ≈ **150–400 MB** once an agent
imports pandas/matplotlib/etc. — an *estimate*, not instrumented; the ~700 MB image is
the Claude.ai-analysis-tool stack, not docxtpl):

- ~100 concurrent code-running threads → ~100 containers → **~15–40 GB RAM**
- ~500 → ~**75–200 GB** — on a **single** Docker host, with **no cap** to protect it.

Qualifier: this is "users *concurrently running code/renders in distinct threads within
the same ~30-min window*," which is far below total user count (most chat turns never
touch the sandbox). But there is no ceiling, so a burst is unbounded.

## Why it matters at the product's target scale

The operator's direction (2026-06-10): **this product must serve any scale — a small
company on one box up to multi-thousand-user organizations — with the infrastructure
choice left to the buying company against clear, published requirements.** The earlier
single-VPS plan (Phase 080) was **only for the operator's own self-testing — never the
target deployment.** The product is **B2B-first**, with a possible **lighter hosted
multi-tenant SaaS subscription** alongside. (See `project_target_scale` memory + SEED-003.)

Against that vision, an **unbounded, unlimited, single-host, no-reaper** sandbox fleet is
the sharpest mismatch in the runtime:

- **Noisy neighbour / DoS-by-accident:** one tenant's agent loop spinning up code-heavy
  threads can exhaust host RAM for everyone — no per-user/per-tenant cap exists.
- **Vertical scaling doesn't help cleanly:** more workers don't relieve it (re-attach is
  per-thread by name); the bottleneck is host RAM × live-container count.
- **No host-sizing requirements to publish:** a B2B customer can't be told "you need X RAM
  for Y concurrent code users" because there's no cap, no per-container limit, and no
  measured footprint to base a requirement on.
- **The hosted-SaaS line needs hard isolation + quotas + autoscaling** that don't exist.

## Why it is NOT a Phase 101 concern (important)

Phase 101 adds `docxtpl` (~0.1–1.3 MB, pure Python, deps already in the image) — a **<1%
image-size delta and ~zero runtime memory delta**. It introduces **no** scaling regression.
Template render simply *uses* the same sandbox, so it inherits this pre-existing gap (a
fill workflow's first render in a fresh thread pays the same cold start). Phase 101's only
obligation is **D-13** — route render through the swappable `sandbox_service` seam so an
alternate topology stays possible. This seed is the home for the actual fix.

## Likely shape if promoted

Co-plan with SEED-003 (deployment shapes) and SEED-004 (tenancy). Candidate scope, ordered:

1. **Instrument first.** Set a Docker `mem_limit`/`cpu` per container and emit telemetry
   (live container count, resident RAM/container, create latency, evictions) so every
   number below stops being an estimate. (Overlaps SEED-025 sandbox telemetry.)
2. **Admission control + reaper.** A configurable **max-live-container cap** with
   backpressure/queueing when exceeded (reuse the SEED-036 Lua-counter pattern), plus a
   **background idle reaper** (don't rely on the next `get_or_create` to evict). Add
   `_sessions` to the D-PRD-12 singleton audit.
3. **Per-user / per-tenant quotas.** Sibling to SEED-036's `task()` quota: `sandbox:user:{id}`
   / `sandbox:org:{id}` live-container limits, fair-share, honest "you've hit your sandbox
   limit" UX. Needs the admin-tier substrate SEED-036 describes.
4. **Topology selection as a deployment-flexible seam** (the SEED-003 spectrum):
   - **Single host / local** (today) — one Docker daemon, small-team scale.
   - **Warm pool** — pre-warmed containers to kill the 15–22 s cold start (overlaps SEED-070 / BUG-260607-02).
   - **Dedicated sandbox host(s) / orchestrated pool** — separate the execution fleet from the app process; route over the `sandbox_service` seam (D-13) to a remote daemon / k8s job runner / external sandbox service.
   - **Hardened isolation for multi-tenant SaaS** — gVisor / Firecracker / per-tenant namespaces (overlaps SEED-062 sandbox security hardening).
   - **Lightweight path** — monty for no-dependency code (SEED-070); render stays Docker-only.
5. **Published infra-requirements matrix.** Per scale tier (single-user / small-org /
   enterprise self-host / hosted SaaS): expected concurrent code-users, RAM/host, container
   cap, isolation level, autoscaling expectation. This is the "clear requirements for the
   buying company" deliverable — lands in SEED-003's packaging milestone.

## Deliberately NOT in scope (when it lands)

A new runtime (the fix routes through the existing `sandbox_service` seam); replacing
Docker for the library-heavy/render path (it must stay — third-party libs); building k8s
autoscaling before SEED-004 tenancy + SEED-003 deployment shapes are decided; premature
optimization before step-1 telemetry produces real footprint data.

## Relationship to sibling seeds (the scale family)

- **SEED-001** — app/SSE/worker concurrency (asyncpg, AnyIO ceiling, multi-worker). This seed is its **sandbox-fleet sibling** — same "scale-readiness" theme, different subsystem.
- **SEED-036** — `task()` sub-agent global-concurrency → per-user quota. **Same admission-control pattern**, applied to the sandbox container fleet instead of sub-agents.
- **SEED-003** — deployment flexibility / install UX / scale-tier presets. The **packaging + published-requirements home**; this seed supplies the sandbox row of its tier matrix.
- **SEED-004** — org multi-tenancy. Provides the tenant model the per-tenant quotas scope against.
- **SEED-070** — monty/dynamic execute-backend (latency). Overlaps step-4 (lightweight path) + warm pool.
- **SEED-062 / SEED-025 / SEED-043 / SEED-063** — sandbox security hardening / execution telemetry / package management / wall-clock timeout: adjacent sandbox concerns that co-plan naturally.

## Links

`backend/app/services/sandbox_service.py` (the fleet) · `backend/app/services/tool_dispatcher.py:554` (the call site) ·
`backend/app/config.py:749-758` (sandbox knobs) · Phase 080 VPS runbook (the self-test-only target, NOT the product target) ·
`.planning/reported-bugs/setting-up-agent-hides-model-activity.md` (BUG-260607-02 cold-start) ·
SEED-001 · SEED-003 · SEED-004 · SEED-036 · SEED-070 · investigation: workflow `wf_1a163844`

---
*Planted 2026-06-10 during Phase 101 plan-phase, from the operator's question on whether the docxtpl add pressures resources at scale. The investigation confirmed docxtpl is negligible and surfaced the real, pre-existing gap: the sandbox container fleet has no cap, no per-container limit, no reaper, and a single-host assumption — at odds with the "serve any scale, customer-chosen infra, B2B" product vision.*
