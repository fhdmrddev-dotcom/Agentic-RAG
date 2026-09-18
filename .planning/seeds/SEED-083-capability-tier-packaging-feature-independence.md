---
seed_id: SEED-083
title: Capability-tier packaging + feature-independence discipline — keep RAG / skills / code-exec / workflows separable so the product CAN be sold as ascending capability bundles
status: planted
planted: 2026-06-13
phase_origin: "Operator question during /gsd:secure-phase 102 close-out (2026-06-13) — 'this workflow feature is separated; later if we tier the product, Tier 1 = basic RAG, Tier 2 = + skills, Tier 3 = + workflows ... is that possible, and should we keep features independent for other things too?'"
category: product packaging / monetization architecture — a build-time DISCIPLINE (keep capability boundaries clean + toggleable) + a future product-design decision (how capabilities map to sellable tiers), NOT a new feature
related_seeds: [SEED-080, SEED-078, SEED-004, SEED-073, SEED-074, SEED-003, SEED-036, SEED-024]
related_memories: [feedback_separate_per_feature_safe_by_construction, project_v3_foundational_gaps, project_v3_roadmap_locked, project_target_scale, project_org_level_deferred]
related_decisions:
  - "D-PRD-10 (3-tier per-named-user pricing: Standard / Pro / Enterprise + add-ons) — the LOCKED pricing model is a SEAT-tier axis. The operator's question introduces a CAPABILITY-bundle framing (RAG → skills → workflows). These are two different axes and must be reconciled: do capabilities unlock by seat tier (Pro unlocks workflows), are they à-la-carte add-ons (the `add_ons jsonb` column), or a separate capability-tier axis entirely? Currently undecided — the build discipline in this seed keeps all three options open."
  - "The v2.9 red line — 'workflows COMPOSE the shipped harness / agent-loop / provider-gateway; they never re-implement them; Deep Mode stays byte-identical; no new runtime' (ROADMAP). This compositional posture is WHY the capabilities are already separable enough to tier — the discipline this seed names is the same red line generalized to every capability layer."
re_open_triggers:
  - The FIRST product-packaging / pricing-page decision that asks 'which capabilities are in which tier' — this seed supplies the capability-decomposition map and the seat-tier-vs-add-on-vs-capability-tier reconciliation question. Co-decide with SEED-080 (the enforcement check that makes a tier real).
  - ANY new major capability enters spec (a new top-level surface: a new tool family, a new mode, a new authored-artifact type, connectors, scheduling) — apply the discipline at scope time: is it behind a clean capability boundary (one home, one toggle, no hard-wiring into another feature's shared path) so it stays independently packageable? Audit this the way G-5 audits hot files.
  - SEED-080 (entitlement primitive) reaches promotion — this seed is its consumer-facing other half: SEED-080 ENFORCES a tier; this seed DEFINES what a capability tier contains and guarantees the capabilities are cleanly separable enough to enforce against.
  - A capability gets hard-wired into another's shared path (the fragmentation trigger) — e.g. skills become non-optional inside the workflow engine, or code-exec becomes inseparable from chat — making that capability un-removable and therefore un-tierable. Catch before it ships.
  - Deployment-shape work (SEED-003) — on-prem/dedicated vs hosted-SaaS shapes may ship different capability bundles (an on-prem buyer may license all capabilities; a SaaS Standard seat may get RAG-only). The published-requirements matrix names which capabilities apply per shape.
priority: medium-high
suggested_phase: the future licensing/packaging milestone (co-planned with SEED-080 in v3.1 Operator UX). The DISCIPLINE half applies NOW to every capability-bearing phase (v2.9 workflows, v3.0 Skill Studio) — it is a scope-time checklist item, not a build. NOT a v2.9 deliverable.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-083 — Capability-tier packaging + the feature-independence discipline

## The idea (operator's framing)

If the product is later packaged in tiers, the natural shape is **ascending
capability bundles**:

| Tier | Adds | Built in |
|---|---|---|
| Tier 1 | Basic RAG — chat over your knowledge base + cited search | v1.0–v2.4 base |
| Tier 2 | + Skills — teach the agent persistent, shareable behaviors | v2.0 Agent Skills |
| Tier 3 | + Workflows — author/publish reusable multi-phase automations (Workflow Studio) | v2.9 |
| Tier 4+ | + Code execution / scheduling / connectors / governance receipts / grid renderer … | v2.0 sandbox, v2.9 STRETCH 105–107, v3.3+ |

The operator's two questions: **(1) Is this possible?** **(2) Should we keep
features independent "for other things" too** — i.e. is feature-independence a
discipline worth protecting generally, beyond just tiering?

## The answer (why it's already feasible)

**Yes — and the architecture is already mostly tier-shaped**, because every
capability was built as a **separable, additive layer** following the operator's
own `feedback_separate_per_feature_safe_by_construction` principle ("one home per
concern, safe-by-construction primitives"). Concrete evidence the boundaries are
already clean:

- **Code execution** is gated by a single switch (`SANDBOX_ENABLED`) and isolated
  in `sandbox_service.py` — already independently toggleable.
- **Skills** are an optional composition: Phase 099 made `skill_ref` an *optional*
  field and proved the Deep path stays **byte-identical** when it is absent. A
  workflow can run with zero skills; a chat can run with zero skills.
- **Workflows COMPOSE** the harness / agent-loop / provider-gateway behind the
  v2.9 red line — they never re-implement the base, and Deep Mode is byte-identical
  whether or not workflows exist. Remove the Workflows page and the base still runs.
- **RAG retrieval** is the shared base every higher layer reads through (bound
  folder-scope, server-resolved) — it is the floor, not entangled upward.

So the **dependency stack already mirrors a tier stack**: RAG (floor) → skills
(compose RAG) → workflows (compose RAG + optional skills + harness). A higher tier
is a superset of the lower one, which is exactly what clean tiering needs.

## Why feature-independence is worth protecting generally (the "for other things")

Tiering is only ONE payoff of clean capability boundaries. The same discipline buys:

- **Deployment-shape flexibility** (`SEED-003`) — ship RAG-only to a light SaaS
  seat, all-capabilities to an on-prem buyer, without code forks.
- **Kill-switch / maintenance mode** (`SEED-078`) — disable one capability under
  load or incident without taking down the rest.
- **Auditability** — "what does this customer actually have" is answerable from one
  capability matrix, not reverse-engineered from scattered `if` checks (the
  procurement/entitlement-matrix ask at org scale, `project_target_scale`).
- **Blast-radius containment** — a bug or a security incident in one capability
  (e.g. sandbox) is contained to that capability, not the shared path.
- **Independent evolution** — a capability can be rebuilt/swapped (the
  `feedback_preserve_engine_optionality` posture) without a cross-feature refactor.

The discipline, stated as a rule: **every major capability lives behind a clean
boundary — one home, one toggle, never hard-wired into another capability's shared
path — so it can be independently enabled, disabled, priced, or replaced.** This is
the v2.9 red line ("compose, never re-implement; Deep byte-identical") generalized
to every layer.

## What's missing (the gap to close WHEN tiering is decided)

Feasible ≠ done. Promoting this needs:

1. **A capability-decomposition map** — an explicit, named list of the toggleable
   capability units (RAG-search, skills, code-exec, workflows-author, workflows-run,
   scheduling, connectors, governance-receipts, grid-renderer …) and their hard
   dependencies. A tier is then a *valid downward-closed subset* of this graph (you
   cannot sell "workflows" without the RAG + harness they require, unless those deps
   are themselves optional within the engine).
2. **The enforcement check — `SEED-080`.** This seed defines WHAT a tier contains;
   `SEED-080`'s `require_tier()` / `require_add_on()` primitive ENFORCES it at the
   request boundary. They are two halves of one mechanism — neither is sufficient
   alone. Do NOT build a second toggle system; both ride the `SEED-078` flag substrate.
3. **Per-capability gates at the service/API boundary + UI.** Each capability gated
   in one place (a FastAPI dependency / tool-registration filter), and the UI must
   *hide or disable* (not 500 on) capabilities the tier lacks — one recognizable
   "upgrade to unlock" surface, not per-feature copy (mirrors `SEED-080` item 4).
4. **Graceful downgrade honesty.** A lower-tier caller hitting a higher-tier endpoint
   gets a clean 402/403 "upgrade required", never a crash; and shared artifacts
   authored at a higher tier (e.g. a global workflow) must not break a lower-tier
   user's view — they see it as locked, not broken.
5. **Reconcile the two pricing axes (the open product decision).** The LOCKED model
   `D-PRD-10` is **seat tiers** (Standard / Pro / Enterprise) + à-la-carte `add_ons`.
   The operator's framing is **capability bundles**. Decide: do capabilities unlock by
   seat tier (Pro = workflows), are they add-ons (`add_ons jsonb` already exists), or a
   distinct capability-tier axis? The clean-boundary discipline keeps **all three**
   open; the decision itself is a PRD/business call for the packaging milestone.

## Why it is deferred / not now

- **No tier-gated surface exists in v2.9.** Nothing is sold behind a paid capability
  tier yet, so building a tier system now would be a primitive with zero callers (same
  reasoning that defers `SEED-080`).
- **The packaging decision is a business call, not an engineering one** — it needs the
  pricing/PRD reconciliation (axes above), best made when the hosted-SaaS line is real.
- **The DISCIPLINE half is the only part that is "now."** It costs nothing and is just
  a scope-time checklist item: when a new capability is built, keep its boundary clean
  and toggleable. Pay that tax continuously and tiering is a later config exercise; skip
  it and tiering becomes a cross-cutting refactor (the retrofit `D-PRD-10` forbids for
  Pro-gating, generalized).

## Deliberately NOT in scope (when it lands)

The billing/subscription surface (Stripe, invoicing, proration, dunning) — that
consumes tiers, it is not this; usage metering / spend caps (`SEED-073`/`SEED-074` —
cost, not capability entitlement); the enforcement check itself (`SEED-080`); named-seat
counting (`D-PRD-10` sub-concern); and building any of it before there is a tier-gated
surface to enforce against. This seed is the **capability map + the build-separable
discipline** — its siblings own the rest.

## Links

The v2.9 red line (compose-never-reimplement, Deep byte-identical) — `.planning/ROADMAP.md`
"## v2.9 Workflow Studio" → "Red line & guardrails" · `backend/app/services/sandbox_service.py`
(`SANDBOX_ENABLED` — an existing clean capability toggle) · Phase 099 (`skill_ref` optional,
Deep byte-identical — the separability proof) ·
`.planning/prd-reset/DECISIONS.md` (`D-PRD-10` seat-tier model)

Sibling seeds:
- **SEED-080 — entitlement / feature-gating primitive.** The enforcement other-half. SEED-080
  READS the tier and gates; THIS seed DEFINES what a capability tier contains and guarantees the
  capabilities are separable enough to gate. Co-plan.
- **SEED-078 — runtime feature-flag / kill-switch.** The shared toggle substrate both this map and
  SEED-080 read from — one toggle home, not two.
- **SEED-004 — org multi-tenancy.** Supplies `orgs.subscription_tier` + `add_ons` — where a tier
  assignment lives.
- **SEED-003 — deployment flexibility.** Different deployment shapes ship different capability
  bundles; the published-requirements matrix maps capability → shape.
- **SEED-073 / SEED-074 — cost / token rollup.** Usage gating (a sibling axis); a capability tier
  may also carry usage ceilings that map through SEED-080.
- **SEED-036 — `task()` concurrency quota.** A usage-gating primitive; per-capability/per-tier
  ceilings are a natural consumer.

---
*Planted 2026-06-13 during the /gsd:secure-phase 102 close-out. The operator asked whether the
workflow feature's separation means the product could later be sold as ascending capability tiers
(RAG → skills → workflows), and whether feature-independence is worth protecting generally. Answer:
yes and yes — the layers are already separable (the operator's own safe-by-construction principle +
the v2.9 compose-never-reimplement red line), so the only "now" cost is keeping every new capability
behind a clean toggle. The packaging decision and the enforcement check (SEED-080) come later; this
seed captures the capability map + the build-separable discipline that keeps the option alive.*
