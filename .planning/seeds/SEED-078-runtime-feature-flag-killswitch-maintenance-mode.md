---
seed_id: SEED-078
title: Unified runtime feature-flag / kill-switch / maintenance-mode system (no operator off-switch for a misbehaving capability)
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: admin / operator-tier & runtime governance — a cross-cutting runtime-control plane (feature flags + emergency kill-switch + maintenance/read-only mode), NOT a single feature
related_seeds: [SEED-080, SEED-012, SEED-024, SEED-036, SEED-064, SEED-006, SEED-026, SEED-003]
related_memories: [project_v3_roadmap_locked, project_target_scale, feedback_separate_per_feature_safe_by_construction, project_settings_design_guidance, feedback_apply_migrations_via_sql_editor]
related_decisions:
  - "DECISIONS.md:917 — 'Feature-flag system or entitlement-check pattern needed across the codebase' is flagged as a known cross-cutting hole, first surfacing in v3.0 (Skill Studio = Pro+) and v3.2 (multi-tenancy = Enterprise), with NO owning milestone"
  - "D-PRD-14 (SYSTEM operator role vs ORG 4-tier role split) — the operator surface this control-plane would live behind"
trigger_when:
  - v3.1 Operator UX is scoped — the natural build home for the admin-shell toggle surface
  - A misbehaving capability needs to be disabled without a redeploy (a provider melts down, web_search starts returning garbage, the sandbox fleet must be frozen, a validator-kind from Phase 102 misfires)
  - A schema migration needs a maintenance / read-only / drain-new-runs window (the v3.2 RLS rewrite on 18 tables is the highest-risk apply ever)
  - The entitlement / feature-gating primitive (SEED-080) is scoped — it shares this exact flag substrate; build the substrate once
  - v3.4 Automations ships — a runaway scheduled routine needs an org-wide freeze
  - The hosted multi-tenant SaaS line is scoped — blast radius of a broken capability rises sharply across co-tenants
priority: high — DECISIONS.md itself flags it as homeless and four locked milestones (v3.0/v3.2 tier gating, v3.4 routine governance, plus v2.9 Phase 102) assume the primitive exists; not load-bearing for v2.9 CORE, but an operational-credibility gap that compounds with every blast-radius increase.
suggested_phase: v3.1 Operator UX is the build home (co-planned with SEED-080 entitlement gating — shared flag substrate). NOT v2.9 — Phase 102 only needs to know the off-switch is coming. First consumers are v3.0 / v3.2 entitlement checks.
---

# SEED-078 — Unified runtime feature-flag / kill-switch / maintenance-mode system

## The gap (grounded in current code)

There is **no operator surface to globally enable/disable a capability at runtime**,
and **no maintenance / read-only / drain mode**. `DECISIONS.md:917` names this exact hole
verbatim — *"Feature-flag system or entitlement-check pattern needed across the codebase"*
— and explicitly notes it first surfaces in v3.0 (Skill Studio = Pro+) and v3.2
(multi-tenancy = Enterprise), with **no milestone scoped to build it**. The alignment-sweep
on 2026-06-10 confirmed it is uncaptured by any seed.

What exists today is only fragmented, single-purpose flagging — not a control plane:

| Property | Current behavior | Evidence |
|---|---|---|
| Global capability toggle | **NONE** — no way to kill the sandbox fleet, disable `web_search`, quarantine a provider, or freeze skill execution at runtime | `DECISIONS.md:917` (flagged, no home); no flag registry in `backend/app` |
| Flagging mechanism | **Ad-hoc per-feature booleans only** — e.g. `multimodal_extraction_v2` (one bespoke flag, SEED-006) | SEED-006 (single ad-hoc flag) |
| Tier gating | **Aspirational stubs**, not a primitive — `_is_tier_pro_or_higher` named in the v3.0 PRD, not a reusable runtime check | `PRDs/v3.0.md:368` (`_is_tier_pro_or_higher` stub) |
| Maintenance / read-only mode | **NONE** — no drain-new-runs, no write-reject, no banner during a migration | no maintenance-mode code anywhere in `backend/app` |
| Closest existing hit | **Per-run cancel / stop-control** — per-run, NOT service-wide | SEED-064 (per-run stop, DONE) |
| Mentioned-but-unscoped | SEED-036 names "kill-switch" only as a *hypothetical* example of what an `/admin` page could host — not as scoped work | SEED-036 (kill-switch as a hypothetical `/admin` host) |
| Hot-reload substrate | **Already exists and is reusable** — the global `app_settings` row is read through a 30 s TTL cache, so a flag flip can take effect without a restart | `backend/app/models/user_settings.py:173-195` (`_settings_cache` + `_SETTINGS_CACHE_TTL`, `load_app_settings`) |

The substrate to build on is already in the codebase: `load_app_settings`
(`user_settings.py:179-195`) returns the global `app_settings` row through a 30 s
TTL cache, with writes routed through `save_app_settings` via asyncpg (D-20). A flag
registry that lives in `app_settings.feature_flags` (JSONB) — or a small `feature_flags`
table read the same way — inherits hot-reload for free. The missing piece is the
**control plane on top**: the flag namespace, the read-check helpers wired at each
capability boundary, the operator toggle UI, and the global panic switch.

## Why it matters at the product's target scale

The operator's direction: **this product must serve any scale — a small company on one box
up to multi-thousand-user organizations — with infrastructure left to the buying company
against clear, published requirements; B2B-first, with a possible lighter hosted
multi-tenant SaaS subscription alongside.** (See `project_target_scale` + `project_v3_roadmap_locked`.)

For a "serve any scale from one codebase" product, the **inability to disable a broken
capability or enter maintenance mode without a redeploy** is an operational-credibility gap
that gets sharper at every step of the locked roadmap:

- **No emergency containment.** When one capability misbehaves — a provider melts down,
  `web_search` returns garbage, the sandbox fleet must be quarantined, a Phase 102
  validator-kind misfires — the only response today is a code change + redeploy. A B2B
  operator who cannot stop a misbehaving capability in seconds will not trust the platform
  with production traffic.
- **No safe migration window.** The project's own migration discipline (paste-into-SQL-editor,
  never `db push`; `feedback_apply_migrations_via_sql_editor`) has no productized equivalent,
  and there is no read-only / drain mode to fence a migration behind. The **v3.2 RLS rewrite
  on 18 tables** is the highest-risk apply the platform will ever do — it wants a maintenance
  window it cannot currently express.
- **Blast radius rises with automation and tenancy.** v3.4 Automations introduces scheduled
  routines that can run away; v3.2 multi-tenancy and any hosted-SaaS tier mean one broken
  capability now affects many tenants at once. A per-org / global freeze is the containment
  primitive both assume.
- **Gating fragments without a shared home.** Four milestones (v3.0/v3.2 tier gating, v3.4
  routine governance, v2.9 Phase 102) independently assume a flag/check primitive. If each
  builds its own ad-hoc boolean, gating becomes un-auditable — the exact "one home per
  concern" failure the operator's architecture principle warns against
  (`feedback_separate_per_feature_safe_by_construction`).

## Why it is deferred / not now

This is **not** a v2.9 CORE concern. v2.9 Phase 102 (validation-gate library) only needs to
*know* a runtime off-switch is coming so a misbehaving validator-kind can be disabled later —
it does not need the control plane to ship first. Single-operator and small-team deployments
work fine today: the operator who can redeploy *is* the kill-switch. The gap becomes
load-bearing only once (a) a non-developer operator runs production without redeploy access
(v3.1's whole thesis), (b) blast radius rises via tenancy/automation (v3.2/v3.4), or (c) a
broken capability must be contained in seconds rather than minutes. v3.1 Operator UX is the
right build home — and it is cheaper to build the flag substrate *once*, jointly with the
entitlement primitive (SEED-080) that needs the identical substrate, than to retrofit two
fragmented gating systems.

## Likely shape if promoted

Build the substrate **once** in v3.1, co-planned with SEED-080 (entitlement gating reads the
same flag namespace). Candidate scope, ordered:

1. **Flag substrate + hot-reload (reuse, don't reinvent).** Store flags in
   `app_settings.feature_flags` (JSONB) or a small `feature_flags` table, read through the
   existing 30 s TTL cache (`user_settings.py:179-195`) so a flip propagates without a
   restart. Writes go through `save_app_settings` with audit-on-write (the `operator_audit_log`
   pattern already shipped at migration 067).
2. **Capability-boundary checks.** A small `feature_enabled("web_search")` / `capability_killed(...)`
   helper wired at each capability seam (sandbox fleet entry, `web_search` tool, per-provider
   gateway, skill execution). Fail-closed where disabling is the safe default; honest UX when
   a capability is off ("this capability is temporarily disabled by your operator").
3. **Emergency kill-switch.** A service-wide panic switch distinct from per-run cancel
   (SEED-064 is per-run): instantly quarantine a provider, freeze the sandbox fleet, or halt
   skill execution. Reuse the same flag substrate; expose as a prominent operator action.
4. **Maintenance / read-only / drain mode.** A global mode that (a) drains new runs (stop
   accepting kickoffs, let in-flight runs finish), (b) rejects writes, (c) shows a banner —
   the migration-window primitive the v3.2 RLS rewrite needs. Pairs with the v3.1 migration
   UI (SEED-012 §5).
5. **Operator toggle UI in the v3.1 admin shell.** A flag/toggle registry view (per-capability
   on/off, scope, last-changed-by) plus the panic switch and maintenance-mode control. This is
   one of the levers SEED-012 already maps into the admin shell.
6. **Scope levels (forward-compatible with tenancy).** Global → per-org (v3.2) → per-routine
   (v3.4). Design the flag key with a scope dimension from day one so v3.4's org-wide
   routine-freeze and v3.2's per-org entitlement gating layer on without a schema unwind.

## Deliberately NOT in scope (when it lands)

A third-party feature-flag SaaS (LaunchDarkly/Flagsmith) — the substrate is a JSONB column +
the existing TTL cache, near-zero cost; the entitlement *enforcement* mechanism itself
(SEED-080 owns the tier/add-on read logic — this seed owns only the shared flag substrate it
sits on); per-user A/B experimentation / gradual rollout percentages (this is an operator
control plane, not an experimentation platform); the productized migration-*apply* path
(SEED-012 §5 owns that fork — this seed supplies only the read-only/drain *mode* a migration
fences behind); and building the per-org / per-routine scope before v3.2 tenancy and v3.4
automation are decided (design the scope dimension in; build the global tier first).

## Relationship to sibling seeds

- **SEED-080** — entitlement / feature-gating primitive (tier + add-on enforcement). **Shares
  this exact flag substrate.** SEED-078 owns the runtime control plane (operator flips a
  capability on/off, panic switch, maintenance mode); SEED-080 owns the entitlement read logic
  (`require_tier('pro')` / `require_add_on(...)`). Build the substrate once in v3.1; both are
  consumers. This is the *operator-governance* half of the same primitive the cost/entitlement
  triad (SEED-073 ↔ SEED-074 ↔ SEED-080) depends on.
- **SEED-012** — admin / operator UI. The flag-toggle registry, panic switch, and
  maintenance-mode control are levers this seed's v3.1 admin shell hosts.
- **SEED-024** — settings / runtime-config unification. The `app_settings` hot-reload
  substrate SEED-078 reuses is exactly what SEED-024 consolidates; co-plan so the flag
  namespace lands in the unified settings home, not a fourth ad-hoc place.
- **SEED-036** — `task()` sub-agent concurrency quota. Mentions "kill-switch" only as a
  hypothetical `/admin` host; SEED-078 is the actual scoped home for that idea.
- **SEED-064** — per-run stop control (DONE). The closest existing hit, but **per-run, not
  service-wide** — SEED-078's panic switch is the service-wide complement.
- **SEED-006** — `multimodal_extraction_v2` is the single ad-hoc flag that proves the pattern
  exists nowhere reusable; it should migrate into the SEED-078 registry when this lands.
- **SEED-026** — error handling / observability lift. A killed/disabled capability must surface
  honestly through the same error/observability pipeline.

## Links

`backend/app/models/user_settings.py:173-195` (the `app_settings` TTL-cache substrate to build on) ·
`.planning/prd-reset/DECISIONS.md:917` (the verbatim flagged hole — "Feature-flag system or entitlement-check pattern needed across the codebase") ·
`PRDs/v3.0.md:368` (`_is_tier_pro_or_higher` stub — gating-as-aspiration) ·
SEED-080 (entitlement gating — shared substrate) · SEED-012 (admin shell — build home) ·
SEED-024 (settings unification) · SEED-036 (kill-switch as hypothetical) · SEED-064 (per-run stop) ·
SEED-006 (single ad-hoc flag) · investigation: workflow `wf_13ed5033`

---
*Planted 2026-06-10 during Phase 101 plan-phase, from the future-milestone alignment sweep. `DECISIONS.md:917` already flags this as a homeless cross-cutting need first surfacing in v3.0/v3.2; the sweep confirmed no seed owns it. The substrate exists (`app_settings` + a 30 s TTL cache); what is missing is the control plane on top — a flag registry, capability-boundary checks, a service-wide panic switch, and a maintenance/read-only/drain mode. Build it once in v3.1 jointly with the entitlement primitive (SEED-080), which sits on the identical substrate.*
