---
seed_id: SEED-036
title: task() Global Concurrency Cap — Per-User Quota at Multi-Tenant Scale
status: planted
planted: 2026-05-28
planted_by: orchestrator (post-execute-phase 085)
trigger_when: App approaches multi-tenant deployment (≥10 concurrent active users) OR a single user observably starves others by spinning up sub-agents OR org-level multi-tenancy ([[project_org_level_deferred.md]]) lands and needs fair-share scheduling OR ops needs to tune the cap at runtime without a backend restart
priority: medium
tags: [scale, multi-tenancy, sub-agent, concurrency, redis, fair-share, admin-tier, runtime-config]
related_memories:
  - project_target_scale.md
  - project_org_level_deferred.md
  - project_settings_design_guidance.md
related_decisions: [D-085-22 (per-run + global concurrency caps), D-PRD-12 (multi-worker uvicorn default)]
related_phases: [085 (Plan 02 task_service)]
related_seeds: [SEED-002 (skill studio milestone — admin-tier global library), SEED-004 (org multi-tenancy — natural home for per-org admin), SEED-005 (document management — bulk admin operations)]
surface: Agentic-RAG
---

# SEED-036: task() Global Concurrency Cap — Per-User Quota at Multi-Tenant Scale

## Context

Phase 085's `task` tool ships with two concurrency caps to protect the system from runaway sub-agent spawning:

| Layer | Mechanism | Default cap | Scope |
|-------|-----------|-------------|-------|
| Per-run | `asyncio.Semaphore` populated into `ToolContext.per_run_task_semaphore` | 3 | One agent loop |
| Global | Redis `tasks:global:active` counter via Lua atomic `INCR + EXPIRE 7200s` | 20 | **Entire app instance** |

Code reference: `backend/app/services/task_service.py:67-90` + `backend/app/config.py:799`.

The global Redis key is literally `tasks:global:active` — no `user_id`, `thread_id`, or tenant prefix. **One shared counter for every sub-agent running anywhere in the app**.

## Why deferred

Phase 085's design framed `task_global_concurrency=20` as a "safe default for single-user dev + small team" cap. The default makes sense today because:

1. The active deployment is a single-user dev box (operator only)
2. Multi-tenancy is itself deferred ([[project_org_level_deferred.md]]) — there's no org/tenant model to scope against yet
3. The cap is purely protective (prevents runaway costs from a buggy agent loop) — not a fairness mechanism
4. Tuning concurrency in production needs real traffic shape data (P50/P95 sub-agent duration, peak concurrent users) that doesn't exist yet

So the cap exists but doesn't try to be "fair" across users — it's a global blast-radius limit.

## Why it matters at scale

[[project_target_scale.md]] explicitly states the app targets "production at organizational scale (few to thousands of users)." With `task_global_concurrency=20` and no per-user scoping, the failure modes at multi-tenant scale are:

- **Noisy neighbor:** One user prompts the agent in a way that spawns 5 sub-agents back-to-back. Other users issuing `task()` calls get "concurrency limit reached" with no visibility into who consumed the slots.
- **Worker scaling doesn't help:** Adding `WORKER_COUNT=4` or `8` won't relieve the cap because it lives in Redis, not per-worker. Vertical scaling the backend doesn't unblock sub-agent calls.
- **No fair-share at all:** A user with 17 active sub-agents (well above any reasonable per-user budget) gets the same priority as a user with 0 active sub-agents trying their first `task()` call.
- **Silent failure UX:** the cap-reached path returns a ToolResult string to the LLM; the LLM tells the user "I couldn't spawn the sub-agent right now." The user has no way to know why.

## Re-open trigger

Promote this SEED to a phase when **any** of:

1. Operator deploys to a shared environment with ≥10 active concurrent users
2. LangSmith / app logs show `tasks:global:active` hitting the cap during normal usage (not synthetic stress tests)
3. Org-level multi-tenancy ([[project_org_level_deferred.md]]) ships — fair-share quotas must land alongside
4. A user reports "the agent told me it couldn't spawn a sub-agent and I have no idea why"
5. Any milestone after v2.7 expands sub-agent use cases (e.g., "auto-investigate this RAG hit" or "parallelize document analysis across many files")

## Likely shape if promoted

Three candidate designs, ordered by complexity:

### Option A — Per-user cap, keep global as ceiling

Replace the single global counter with **two layered caps**:
- `tasks:user:{user_id}:active` — cheaper, per-user quota (e.g., 5)
- `tasks:global:active` — generous app-wide ceiling (e.g., 200) as a runaway blast-radius limit

Acquire both atomically (Lua script that checks both counters + INCRs both on success). Release both in finally. The Redis key TTL (7200s) handles crash recovery on both layers.

Migration impact: zero (Redis-only — no schema changes). Frontend impact: zero. Config knobs: `task_per_user_concurrency: int = 5`, `task_global_concurrency: int` raised to ~200.

### Option B — Per-org cap (requires org schema)

If multi-tenancy lands first ([[SEED-004 org-multi-tenancy]]):
- `tasks:org:{org_id}:active` — per-org quota (e.g., 50)
- `tasks:user:{user_id}:active` — per-user quota within an org (e.g., 5)
- Global is still the safety ceiling

Three counters atomically managed in one Lua script. More complex but enables per-org plans/billing tiers.

### Option C — Token-bucket / fair-share scheduler

Drop the hard cap entirely; implement a Redis-backed token bucket per user. Users accumulate tokens (one per sub-agent slot) over time; `task()` calls consume tokens; calls block-and-wait when tokens are exhausted (configurable max wait before cap-reached error).

Strictly fairer than fixed caps but introduces queuing latency and complexity. Likely overkill until traffic data justifies it. Park as a "Option C if A+B aren't enough."

## Forward-looking notes

- The per-run `asyncio.Semaphore(3)` cap is fine and doesn't need per-user scoping (it's already scoped to a single agent loop). Only the global Redis cap needs the fair-share treatment.
- The Lua INCR pattern in `acquire_global_task_slot` is the right substrate for Options A and B — just needs the script extended to check multiple counters.
- The cap-reached UX gap (silent failure) is a separate concern worth surfacing in the panel UI once Phase 087 ships — surface "you've hit your sub-agent limit, X others active" rather than just bouncing the tool call.

## Admin-tier runtime control (cross-cutting sub-consideration)

Today the cap lives in `backend/app/config.py` as `task_global_concurrency: int = 20` — an **env-var-only knob**, tunable only via `.env` / restart. This **violates the CLAUDE.md project rule** that "Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only." Phase 085 shipped it as env to keep scope tight, but the rule applies and the destination is `app_settings`.

**Why runtime control matters operationally:**
- Ops scenario: real traffic hits the 20 cap at peak. Today you edit `.env`, restart uvicorn (downtime), and wait — no live response possible.
- Tuning loop: A/B'ing `15 vs 30 vs 60` over a week requires N restarts. Hostile UX.
- Multi-tenant scaling: per-org or per-user caps NEED runtime mutability (operator can't restart the app every time a paying customer's quota changes).
- The current env-var shape silently fails the CLAUDE.md compliance audit.

**Blocker — there's no admin tier today.**

The existing Settings UI surface is per-user (everyone sees the same form, mutations write to `user_settings`). A concurrency cap is intrinsically an admin/ops concern — one global value, operators only. To expose it correctly the app needs admin-tier infrastructure that doesn't exist yet:

| Path | Schema impact | UI impact | Operator readiness | Notes |
|------|--------------|-----------|---------------------|-------|
| **A — Admin role on `users` table** | Add `is_admin: bool` column (~1 line migration) + RLS read-gate on `app_settings` rows | New "Admin" Settings tab visible only when `currentUser.is_admin=true` | Clean long-term shape | Requires role bootstrap (how does the first admin get created?) |
| **B — Separate `/admin` route** | Same as A (need a role check somewhere) + new auth-gate | Whole new page surface; can grow to host other admin concerns (user list, telemetry, kill-switch) | Bigger UX scaffolding | Better for "admin sees a different app, not just an extra tab" |
| **C — Hardcoded operator email** | Zero — a single env var `OPERATOR_EMAIL=fhdmrd@gmail.com` gates the admin UI render | Single "Admin" Settings tab gated on `currentUser.email === settings.operator_email` | Cheapest interim | Ugly long-term but unblocks runtime control NOW; replace once role schema lands |
| **D — `app_settings` table + CLI tool** | Add `app_settings(key, value, updated_at)` table | None — operator runs `python -m app.cli set task_global_concurrency 50` to mutate | No UI needed | Skips the admin-UI problem entirely; works today; loses live-tune-from-browser convenience |

Pairs naturally with [[SEED-004 org-multi-tenancy]] — when orgs land, paths A or B become natural homes for per-org admin controls. Path C is what most production apps do as a stopgap (works today, replace later).

**How this sub-consideration changes Options A/B/C above:**

The 3 quota designs (per-user cap, per-org cap, token-bucket) each need runtime tunability of their respective parameters. So whatever admin-tier path lands first, the quota config goes there:

- Option A (per-user + global): `app_settings.task_per_user_concurrency` + `app_settings.task_global_concurrency`, admin-tier-gated UI
- Option B (per-org + per-user + global): `org_settings.task_per_org_concurrency` + reuse from A
- Option C (token-bucket): `app_settings.task_bucket_refill_rate` + `app_settings.task_bucket_capacity` + `app_settings.task_bucket_max_wait_ms`

**Recommendation when SEED-036 is promoted:** scope an admin-tier UI substrate (path C "hardcoded operator email" as the interim, path A "is_admin column" as the durable target) AS PART OF the same phase. Don't ship runtime-tunable quotas through a non-admin Settings tab — exposing global system caps to every user is a vulnerability.

**Related SEEDs that benefit from the same admin-tier scaffolding:** SEED-004 (org multi-tenancy), SEED-005 (document management capabilities — bulk admin operations), SEED-002 (skill studio — admin-tier global skill library). When the admin tab lands once, all four benefit.
