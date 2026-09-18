---
seed_id: SEED-081
title: Provider rate-limit resilience + fan-out admission control under load (shared keys, no Retry-After backoff, uncapped concurrent fan-out against the shared per-account limit)
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: scale / performance — provider availability under load; an admission-control + backoff seam in front of the shared provider keys, NOT a new feature
related_seeds: [SEED-001, SEED-036, SEED-048, SEED-057, SEED-065, SEED-053, SEED-076, SEED-077, SEED-073, SEED-074, SEED-080, SEED-003, SEED-004, SEED-012, SEED-024]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, project_embeddings_openai_spof, feedback_cross_provider_full_native_roster, feedback_multi_provider_behavior_variance]
related_decisions:
  - "BUG-260606-01 (429 → rate_limit classification ALWAYS precedes billing — provider_gateway/errors.py:106-107,133-162) — classification is solved; behavior UNDER sustained 429 is not"
  - "D-PRD-12 (multi-worker uvicorn default) — each worker drives the SAME shared provider keys, multiplying the self-inflicted 429 surface with no cross-worker coordination"
trigger_when:
  - Phase 106 (v2.9 STRETCH) llm_batch_agents grid is scoped — a wide concurrent fan-out against shared keys self-inflicts 429s with no admission control in front; this seed is a soft prerequisite
  - Phase 102 (v2.9) llm_judge validation gate ships — every gated run adds concurrent provider calls to the same shared account
  - The lighter hosted multi-tenant SaaS subscription tier is scoped (SEED-004) — hundreds-to-thousands of users on SHARED provider keys make provider-side rate-limit the binding availability constraint
  - v3.0 Skill Studio multi-agent orchestration is scoped — more concurrent provider calls per run
  - v3.3 Open Platform exposes the API — external consumers drive provider load that the existing org/API-key token-bucket does NOT translate into provider-account admission control
  - Production/telemetry shows a sustained 429 rate or a provider account hitting its per-account RPM/TPM ceiling under multi-user load or a single wide fan-out
  - A B2B customer requires a documented "max concurrent provider calls / expected throughput on shared vs BYOK keys" requirement for their deployment
priority: medium — a real, pre-existing availability gap that bites only under sustained multi-user load or a single wide fan-out; single-operator and small-team usage stays under the shared-account ceiling today. Load-bearing once the co-tenant SaaS tier or the Phase 106 grid exists.
suggested_phase: a future scale-hardening milestone (v3.x), co-planned with SEED-001/065/076/077 (the datastore + concurrency scale cluster) and SEED-004 tenancy. A soft prereq to flag at Phase 106 spec time. NOT v2.9 core.
re_open_triggers:
  - same as trigger_when above
surface: Agentic-RAG
---

# SEED-081 — Provider rate-limit resilience + fan-out admission control under load

## The gap (grounded in current code)

The provider gateway **classifies** a 429 correctly and honestly — but nothing
**reacts** to it, and nothing **prevents** the platform from manufacturing its own
429s against the shared per-account rate limit. A future-milestone alignment sweep on
2026-06-10 (workflow `wf_13ed5033`) found three compounding facts:

| Property | Current behavior | Evidence |
|---|---|---|
| 429 classification | A native SDK 429 maps to a normalized `rate_limit` `ErrorKind`, ordered so `429 → rate_limit` **always** precedes any billing classification (BUG-260606-01) | `backend/app/services/provider_gateway/errors.py:64-74,102-107,117-162` |
| Backoff / Retry-After | **NONE** — no automatic retry-with-backoff, no `Retry-After` honoring, no quota-aware re-routing. A 429 is classified, then surfaced straight to the user | `errors.py` is classification-only (no retry/routing logic); the only response is `message_for_kind` (errors.py:202) |
| Shared keys | **All users share the SAME provider API keys** (keys live in `backend/.env` / settings, not per-user/per-org) | per CLAUDE.md (`env vars are for secrets and infra only`); no per-user/per-tenant key column |
| Fan-out cap level | `llm_batch_agents` fans out **N parallel sub-agents** (`gather(run_task_sub_agent × N)`), bounded by `max_parallel_agents` (default 5) composing with the per-run `Semaphore(3)` / Redis-Lua(20) **task-slot** caps | `phase_types.py:407-413`; `task_service.py:17-25` |
| Per-provider in-flight limiter | **NONE** — every one of those concurrent task slots drives the SAME shared provider key; there is no semaphore/token-bucket keyed by *provider account*. The task caps bound sub-agent slots, NOT provider concurrency | `task_service.py:17-25` caps tasks, not provider calls; `grep` for a provider-keyed limiter → 0 matches |
| Multi-worker multiplier | `WORKER_COUNT=2` default — each worker drives the same shared keys with **no cross-worker coordination** of provider in-flight count | D-PRD-12 (multi-worker default) |

The shape of the bug: the task-concurrency caps (`Semaphore(3)` / Redis-Lua(20) /
per-phase `max_parallel_agents=5`) bound how many **sub-agent slots** run at once — they
do **not** bound how many **concurrent calls hit one provider account**. So under
multi-user load, OR a single wide `llm_batch_agents` fan-out, the platform self-inflicts
429s against the shared per-account RPM/TPM limit and the only current response is to
show the user the error. Classification is excellent; admission control in front of the
shared key is absent.

This is **orthogonal** to two things it is often confused with:

- **Spend caps** (cost — token-to-USD ceilings, Phase 105 / v3.4): those gate *dollars*,
  not *request-rate / concurrency*. SEED-073/074 supply the price table + token rollup
  those need; this seed is a different lever entirely.
- **Per-user request limiting** (one tab-heavy user monopolizing worker SSE slots —
  captured in SEED-001 item-5): that protects *worker* slots, not the *provider account*.

## Why it matters at the product's target scale

The operator's direction: **this product must serve any scale — a small company on one
box up to multi-thousand-user organizations — with the infrastructure choice left to the
buying company against clear, published requirements.** The product is **B2B-first**, with
a possible **lighter hosted multi-tenant SaaS subscription** alongside. The single-VPS
plan (Phase 080) was operator self-testing only, never the target. (See
`project_target_scale` + `project_v3_roadmap_locked`.)

Against that vision, shared per-account provider keys with no admission control is a
**self-inflicted availability ceiling that tightens exactly as the platform succeeds**:

- **The hosted co-tenant SaaS tier is the sharpest exposure:** hundreds-to-thousands of
  users on the SAME shared keys make the provider-account rate limit the *binding*
  availability constraint. One tenant's wide fan-out can 429 every other tenant on the
  same account, with no admission control to keep them fair.
- **v2.9 itself raises the concurrent-call count:** Phase 102's `llm_judge` gate adds a
  provider call per gated run, and Phase 106's `llm_batch_agents` grid is *designed* to
  fan out many concurrent calls — the exact phase that already hit the task cap in UAT
  (`harness.py:100`). The grid is a soft prerequisite consumer of this seed.
- **No throughput requirement to publish:** a B2B customer can't be told "expect N
  concurrent provider calls / X requests-per-minute on shared keys before you hit the
  ceiling" because there is no limiter, no backoff, and no measured behavior under
  sustained 429s to base a requirement on (the SEED-003 published-requirements gap, the
  provider-availability row of its tier matrix).
- **BYOK changes the math but not the mechanism:** even per-org/BYOK keys (a likely
  enterprise ask) need the same per-account in-flight limiter + backoff — they just shift
  *whose* ceiling you protect.

Cross-provider note: this is a native-7 concern, not a big-4 one. Each provider's
per-account RPM/TPM ceiling and `Retry-After` semantics differ; per
`feedback_multi_provider_behavior_variance` + `feedback_cross_provider_full_native_roster`,
the limiter and backoff must be keyed per-provider-account and honor each provider's own
retry signal — never a single shared constant.

## Why it is deferred / not now

- **Not a v2.9-core blocker:** single-operator and small-team usage stays under the
  shared-account ceiling; the 429-classification fix (BUG-260606-01) already makes the
  failure honest. The platform degrades *visibly*, not silently, today.
- **Soft (not hard) prereq for Phase 106:** the `llm_batch_agents` grid already composes
  the per-run / Redis-Lua / per-phase task caps (`phase_types.py:411-413`), so a wide
  grid is *bounded* — it just isn't bounded at the *provider-account* layer. Phase 106 can
  ship behind those task caps; this seed turns "bounded sub-agent slots" into "bounded
  provider concurrency + graceful backoff." Flag it at Phase 106 spec time.
- **Instrument first:** the right cap, backoff curve, and degrade policy are unknowable
  until provider in-flight count + 429 rate are measured — premature tuning would be a
  guess.
- **Tenancy-shaped:** per-org/per-tenant fairness needs the SEED-004 tenant model and the
  SEED-080 entitlement primitive (which tier gets what concurrency) before the quota half
  can land.

## Likely shape if promoted

Co-plan with the scale cluster (SEED-001 / SEED-065 / SEED-076 / SEED-077) and SEED-004
tenancy. Candidate scope, ordered:

1. **Instrument first.** Emit telemetry: per-provider-account in-flight call count, 429
   rate, observed `Retry-After` values, time-in-backoff. Every number below stays a guess
   until this exists.
2. **Retry-After-aware backoff.** On a classified `rate_limit` (`errors.py`), retry with
   exponential backoff that honors each provider's native `Retry-After` — provider-keyed,
   bounded retries, additive at the gateway boundary so the shared SSE path stays
   byte-identical (per `feedback_no_cross_provider_regressions`).
3. **Per-provider in-flight admission control.** A concurrency limiter
   (semaphore / token-bucket) keyed by **provider account**, shared across users AND
   across uvicorn workers (reuse the SEED-036 Redis-Lua-counter pattern that already
   coordinates `tasks:global:active` cross-worker — `task_service.py:23-25`). When the
   provider ceiling is reached, queue-or-degrade rather than firing the call and eating a
   429. This sits *in front of* the task-slot caps, not in place of them.
4. **Quota-aware degrade.** When a provider is rate-limited, optionally degrade gracefully
   (queue, slow the fan-out, or surface an honest "provider is busy, retrying" state) —
   distinct from the SEED-048 embeddings *fallback-provider* shape but adjacent.
5. **Per-tenant fairness (needs SEED-004 + SEED-080).** Sibling to SEED-036's `task()`
   quota: fair-share the shared-account budget across tenants so one tenant's fan-out can't
   429 the others. Tier-aware via the SEED-080 entitlement check.
6. **Published throughput requirement.** The provider-availability row of the SEED-003
   tier matrix: expected concurrent calls / RPM on shared vs BYOK keys per scale tier — the
   "clear requirements for the buying company" deliverable.

## Deliberately NOT in scope (when it lands)

Spend / cost caps (that's SEED-073 price table + SEED-074 token rollup + Phase 105 /
v3.4 — dollars, not request-rate); per-user SSE-slot / worker admission control (that's
SEED-001 item-5 — protects workers, not the provider account); the embeddings-provider
fallback selector (SEED-048 — single-path availability, a sibling not this); changing the
429 *classification* (BUG-260606-01 already solved it correctly); per-org / BYOK key
storage as its own feature (it shifts whose ceiling is protected but reuses this same
limiter + backoff mechanism); breaking the shared SSE / chunk-handler path — the limiter
and backoff are additive at the gateway boundary only.

## Relationship to sibling seeds (the scale cluster + the new batch)

- **SEED-001** — app/SSE/worker concurrency + per-user request limiting. This seed is its
  **provider-account sibling**: SEED-001 protects *worker* slots; SEED-081 protects the
  *provider account*. Same scale-readiness theme, orthogonal lever.
- **SEED-065** — load degradation / Redis timeout / fan-out event-loop blockers (Blocker B
  deferred). The fan-out that this seed throttles at the provider layer is the SAME fan-out
  SEED-065 found blocking the event loop on stream-CREATE — co-plan.
- **SEED-076 / SEED-077** — filtered-vector-search recall + durable ingestion queue. The
  three of us (`076 ↔ 077 ↔ 081`) plus **SEED-001 / SEED-065** are the silent-scale cluster
  that single-user dev can never expose — none reproduce in single-user UAT, all degrade as
  the platform succeeds. Candidate to fold into one "Scale Hardening / published datastore +
  provider requirements" milestone rather than loose seeds.
- **SEED-036** — `task()` sub-agent global-concurrency quota. **Same admission-control
  pattern** (Redis-Lua cross-worker counter), applied to provider-account concurrency
  instead of sub-agent task slots — the direct mechanism to reuse for step 3.
- **SEED-048** — embeddings single-provider SPOF + 429 fail-soft. Adjacent availability
  facet (fallback *provider*); this seed is the *concurrency / backoff* facet on the chat /
  agent-loop path. Both are provider-availability work.
- **SEED-057** — Google 429 credit-depletion mislabel (classification only, fixed). The
  classification ancestor; this seed is what reacts to the now-correct classification.
- **SEED-053** — sub-agent events surfaced up. The honest "provider busy / backing off"
  state from step 4 wants to surface up the same channel.
- **SEED-073 / SEED-074 / SEED-080** — the cost/entitlement triad (price table ↔ token
  rollup ↔ entitlement gating). This seed is the **rate/availability** lever, deliberately
  distinct from their **cost** lever — but the per-tenant fairness half (step 5) consumes
  SEED-080's entitlement check to make concurrency tier-aware, and v3.4 rate budgets will
  interact with their spend caps.
- **SEED-003 / SEED-004** — deployment shapes (published-requirements home for step 6) +
  org tenancy (the tenant model step 5 scopes against).
- **SEED-012 / SEED-024** — admin/operator UI + settings unification: the limiter cap, the
  backoff knobs, and a per-provider kill/quarantine switch want an operator surface and a
  settings home.

## Links

`backend/app/services/provider_gateway/errors.py:64-74,102-107,117-162` (429 → `rate_limit`
classification, no retry/backoff) · `backend/app/services/harness/phase_types.py:407-413`
(`llm_batch_agents` `gather(run_task_sub_agent × N)` fan-out) ·
`backend/app/services/task_service.py:17-25` (per-run `Semaphore(3)` + Redis-Lua(20) task
caps — bound task slots, NOT provider concurrency) · `backend/app/models/harness.py:95-100`
(the `llm_batch_agents` phase that hit the cap in UAT) ·
SEED-001 · SEED-036 · SEED-048 · SEED-057 · SEED-065 · SEED-076 · SEED-077 · SEED-080 ·
investigation: workflow `wf_13ed5033`

---
*Planted 2026-06-10 during Phase 101 plan-phase, from an 8-agent future-milestone
alignment sweep. The provider 429 is classified correctly and honestly (BUG-260606-01) —
but nothing honors `Retry-After`, nothing re-routes, and all users share the same provider
keys while `llm_batch_agents` fans out N concurrent sub-agents with no per-provider-account
admission control. Under multi-user load or a single wide fan-out, the platform manufactures
its own 429s against the shared per-account limit and just shows users the error. Orthogonal
to spend caps (cost) and per-user request limiting (worker slots) — this is the
provider-availability lever, load-bearing once the co-tenant SaaS tier or the Phase 106 grid
exists.*
