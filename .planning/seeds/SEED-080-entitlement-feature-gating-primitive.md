---
seed_id: SEED-080
title: Entitlement / feature-gating primitive — reusable tier + add-on enforcement check (one home, not N ad-hoc gates)
status: folded
status_note: "Folded into Phase 258 (A Tier Becomes Enforceable) on 2026-09-19. Implemented by TIER-01, TIER-03, TIER-04, TIER-05."
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: licensing / billing / monetization — a cross-cutting enforcement primitive (the layer that READS the locked tier + add-on columns to gate features), NOT a new product feature
related_seeds: [SEED-004, SEED-073, SEED-074, SEED-078, SEED-012, SEED-024, SEED-036, SEED-003]
related_memories: [project_v3_roadmap_locked, project_org_level_deferred, project_target_scale, feedback_separate_per_feature_safe_by_construction, project_settings_design_guidance]
related_decisions:
  - "D-PRD-10 (3-tier per-named-user pricing + add-ons) — locks the business posture: 'every org row must carry subscription_tier + add_ons from day 1 — schema must be designed to support entitlement checks (gating Pro/Enterprise features)' (v3.2.md:23). Its own consequences flag 'Tier feature gating is harder to enforce than usage gating — every Pro/Enterprise feature needs a tier-check gate' (DECISIONS.md:911) and 'Feature-flag system or entitlement-check pattern needed across the codebase' (DECISIONS.md:917) — named as needed, routed nowhere."
  - "D-PRD-02 (hybrid tenancy via deployment, not data-layer) — entitlement is the revenue substrate of the co-tenant hosted-SaaS line."
  - "DECISIONS.md:945 ('entitlement-check infrastructure lands in v3.2') — but v3.2 ships only the columns and DEFERS the one concrete enforcement instance (org-creation quota) to v3.3; the reusable check itself stays unowned."
re_open_triggers:
  - The FIRST milestone that needs to gate a feature behind a paid tier reaches spec — v3.0 Skill Studio Pro-gating is the trigger (D-PRD-10 says it 'must be designed in, not retrofitted'); the v3.0 stub `_is_tier_pro_or_higher(user)` that returns True (PRD v3.0.md:193,368,408) is the placeholder this seed replaces.
  - v3.2 Multi-Tenancy execution begins — the org-creation quota (deferred to v3.3 at v3.2.md:315) and any Enterprise-only feature need the reusable check, and the RLS rewrite is the cheapest moment to co-design the tier-read at request time.
  - v3.3 Open Platform per-org rate-limit / service-account quota work begins — those enforcement points read `subscription_tier`.
  - v3.4 spend-caps scoping — cap defaults and ceilings map to org tier, so the cap evaluator calls the entitlement check.
  - A SECOND ad-hoc tier check is about to be written anywhere in the backend (the fragmentation trigger — one home before two implementations exist).
priority: high
suggested_phase: a future licensing/operator milestone. Build home is v3.1 Operator UX (co-located with the admin shell + SEED-078 flag substrate); first consumers are v3.0 Skill Studio (Pro gating) and v3.2 Multi-Tenancy (Enterprise + org-creation quota). NOT v2.9 — Phase 101 has no tier-gated surface.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-080 — Entitlement / feature-gating primitive (reusable tier + add-on enforcement check)

## The gap

The business posture is **locked** but the mechanism that enforces it is an
**aspiration, not code**. A 2026-06-10 future-milestone alignment sweep (workflow
`wf_13ed5033`, merged from the Multi-tenancy + Licensing hunters) found that the
reusable check which READS the tier/add-on columns to gate features has no
requirement, no phase, and no seed that owns it.

| Property | Current state | Evidence |
|---|---|---|
| Pricing model | LOCKED — 3-tier (Standard / Pro / Enterprise) per-named-user + add-ons | `D-PRD-10` |
| Tier columns | PLANNED — v3.2 `orgs` ships `subscription_tier text default 'standard'` + `add_ons jsonb default '[]'` from day 1 | `PRDs/v3.2.md:23,37,47` |
| The reusable check (`require_tier('pro')` / `require_add_on('governance')`) | **Does not exist** — named as needed, routed nowhere: "Feature-flag system or **entitlement-check pattern needed across the codebase**" | `DECISIONS.md:917` |
| Stated home | DECISIONS.md says it "lands in v3.2" — but v3.2 ships only the **columns** and **defers the one concrete enforcement instance** (org-creation quota) to v3.3 | `DECISIONS.md:945`; `PRDs/v3.2.md:315` |
| Today's only "gate" | A v3.0 **stub** `_is_tier_pro_or_higher(user)` that **always returns True**; entitlement enforcement explicitly "deferred to v3.2" | `PRDs/v3.0.md:193,368,408` |
| Difficulty self-flagged | "Tier feature gating is **harder to enforce than usage gating** — every Pro/Enterprise feature needs a tier-check gate" — accepted as a trade-off, never designed | `DECISIONS.md:911` |
| Standalone licensing seed | **None existed** before this one (the sweep confirmed: "No standalone licensing seed") | — |

So the schema half is designed and the read-half is a stub that lies (`return True`).
**Four milestones independently assume a working entitlement check exists** (v3.0
Pro gating, v3.2 Enterprise + org-creation quota, v3.3 per-org rate-limit reads tier,
v3.4 spend caps map to tier). If each builds its own ad-hoc tier check, gating
**fragments and becomes unauditable** — the exact "one home per concern" failure the
operator's architecture principle warns against (`feedback_separate_per_feature_safe_by_construction`).

## Why it matters at the product's target scale

Licensing is the **revenue substrate of the hybrid-SaaS posture**. The product is
B2B-first with a possible lighter hosted multi-tenant SaaS subscription, and pricing
is monetized through exactly the Standard/Pro/Enterprise + add-on model `D-PRD-10`
locks. The entitlement check is the thing that turns "we sell tiers" into "the codebase
actually withholds Pro features from Standard callers."

- **It is load-bearing for v3.0 before v3.2 ever ships.** The operator may reorder v3.0
  Skill Studio ahead, and `D-PRD-10` is explicit that v3.0 Pro-gating "must be designed
  in, **not retrofitted**." Shipping v3.0 against a `return True` stub bakes in the
  retrofit the decision forbids.
- **One home beats N ad-hoc gates.** Without a single reusable check, every Pro/Enterprise
  feature point grows its own inline `if tier == ...` — gating fragments, the refusal UX
  diverges per feature, and there is no single place to audit "what does Pro actually
  unlock." This is unauditable at exactly the scale (multi-thousand-user orgs, hosted
  co-tenant tier) where procurement asks for an entitlement matrix.
- **Add-ons need representation, not just a tier enum.** `add_ons jsonb` is shipped, but
  nothing defines how an add-on entitlement (e.g. `governance`) is represented and
  checked — `require_add_on('governance')` has no implementation behind it.

Future milestones it unblocks: **v3.0** (Skill Studio Pro gating), **v3.2** (Enterprise
features + the org-creation quota deferred to v3.3), **v3.3** (Open Platform per-org
rate-limit / service-account quota reads `subscription_tier`), **v3.4** (spend-cap
defaults/ceilings map to org tier).

## Why it is deferred / not now

- **No tier-gated surface exists in v2.9.** Phase 101 (template-fill) and the v2.9
  Workflow Studio milestone gate nothing behind a paid tier, so there is nothing for the
  check to enforce yet — building it now would be a primitive with zero callers.
- **It needs the org/tier model to be real.** The `subscription_tier` + `add_ons` columns
  land in v3.2 (`SEED-004`); designing the check before the columns exist as live data is
  premature. The cheapest moment to wire the request-time tier-read is **alongside the
  v3.2 RLS rewrite**, not as a later retrofit.
- **It shares substrate with the kill-switch work (`SEED-078`).** The same flag/registry
  + hot-reload TTL-cache substrate that powers runtime feature flags is the natural place
  the entitlement check reads tier/add-on state from. Building both on one substrate avoids
  two parallel toggle systems — so this seed should co-plan with `SEED-078`, not race it.

## Likely shape if promoted

Build home **v3.1 Operator UX** (co-located with the admin shell + the `SEED-078` flag
substrate); first consumers **v3.0 Skill Studio** and **v3.2 Multi-Tenancy**. Candidate
scope, ordered:

1. **One reusable check service.** A single entitlement module that reads the calling
   org's `subscription_tier` + `add_ons` at request time and answers `is_entitled(tier=…,
   add_on=…)`. Replace the lying `_is_tier_pro_or_higher` stub (`PRDs/v3.0.md:193`) with
   a real call. Read-half hot-reloads via the existing TTL-cache settings pattern
   (`SEED-024`), sharing the `SEED-078` flag substrate.
2. **Decorator / FastAPI-dependency gate.** `require_tier('pro')` / `require_add_on('governance')`
   as a dependency or decorator so any endpoint or tool-registration point gates uniformly
   — no inline `if tier ==` scattered across services.
3. **Add-on representation.** Define how an add-on entitlement is stored in `add_ons jsonb`
   and checked (allow-list vocabulary, effective state), so add-ons are first-class, not
   ad-hoc string matches.
4. **Honest Pro-only refusal UX.** A single, recognizable "this is a Pro/Enterprise feature"
   refusal surface (one component, not per-feature copy) so gating is consistent and
   upgrade-legible — and auditable as one entitlement matrix.
5. **First concrete consumers wired.** v3.0 Skill Studio Pro tools (the three General-Mode
   tools at `PRDs/v3.0.md:408`); v3.2's org-creation quota (move it off the v3.3 deferral
   at `v3.2.md:315` so the first real enforcement instance lands with the primitive, not
   after it).
6. **Forward-notes in the PRDs.** Add a line in the v3.0 and v3.2 PRDs that the gating
   PATTERN (not just the columns) needs a design phase — close the "first user surfaces"
   hand-waving in `DECISIONS.md:917-919` with an explicit "entitlement primitive lands in
   <this phase>."

## Deliberately NOT in scope (when it lands)

The customer-facing **billing/subscription surface** (Stripe/payment, invoice generation,
subscription lifecycle, proration, dunning, downgrade-on-non-payment) and the **trial /
free-tier mode** — those are a separate unrouted monetization gap (the sweep's "no hosted-SaaS
billing surface" finding) and consume this primitive rather than being it; **named-seat
counting + shadow-user enforcement** (its own D-PRD-10 sub-concern); **usage metering /
spend caps** — that is cost, not entitlement (it MAPS to tier via this check but is owned by
`SEED-073` + `SEED-074` + v3.4); building the check before the v3.2 tier columns carry live
data; and a second parallel toggle system separate from the `SEED-078` flag substrate.

## Links

`backend/app/services/openai_service.py:get_tools(calling_mode)` — where the `_is_tier_pro_or_higher`
stub lives and the first real gate attaches (`PRDs/v3.0.md:193,408`) ·
`.planning/prd-reset/DECISIONS.md:911,917,945` (the pattern named-but-unrouted) ·
`.planning/PRDs/v3.2.md:23,37,47,315` (tier columns shipped; org-creation quota deferred to v3.3) ·
`.planning/PRDs/v3.0.md:368` (the `return True` stub note) · investigation: workflow `wf_13ed5033`

Sibling seeds:
- **SEED-073 / SEED-074 — the cost/entitlement triad (073 ↔ 074 ↔ 080).** Spend caps need
  the per-model price table (`SEED-073`) + the workflow/sub-agent token rollup (`SEED-074`)
  to compute a dollar figure, and this check to map a cap's default/ceiling to the org's
  tier. The three interlock: a budget cap is a price table × a token rollup × an entitlement
  read. None alone is sufficient.
- **SEED-078 — unified runtime feature-flag / kill-switch.** Shares the SAME flag/registry +
  hot-reload substrate; co-plan so there is one toggle home, not two. The sweep flagged these
  two as sharing substrate explicitly.
- **SEED-004 — org multi-tenancy.** Supplies the `orgs.subscription_tier` + `add_ons` columns
  this check reads; the v3.2 RLS rewrite is the cheapest co-design window.
- **SEED-012 — admin/operator UI.** The v3.1 admin shell is where the entitlement matrix /
  tier overrides are exposed.
- **SEED-024 — settings/runtime-config unification.** Provides the TTL-cache hot-reload read
  path the check uses for tier/add-on state.
- **SEED-036 — `task()` concurrency quota.** A sibling enforcement primitive (usage gating);
  per-tier quota ceilings are a natural entitlement consumer (`require_tier` informs the cap).
- **SEED-003 — deployment flexibility.** The dedicated/on-prem vs hosted-SaaS shapes determine
  whether entitlement is even active (single-tenant on-prem may run all-Enterprise); the
  published-requirements matrix names which tiers apply per shape.

---
*Planted 2026-06-10 during the Phase 101 future-milestone alignment sweep. The pricing model
is locked (D-PRD-10) and the tier columns are designed (v3.2), but the reusable check that
reads them is a `return True` stub and four milestones silently assume it exists. Captured as
one home for the concern before the second ad-hoc tier check gets written.*
