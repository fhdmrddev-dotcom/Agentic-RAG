---
id: SEED-116
title: Control Room ↔ Settings boundary + full dynamic-control inventory
planted: 2026-07-12
status: resolved
resolved: 2026-07-12
resolved_by: ".planning/notes/settings-control-room-boundary.md (/gsd:explore session, operator-affirmed)"
related_seeds: [SEED-115, SEED-112, SEED-113]
related_memory: [project_admin_panel_plan, project_dynamic_settings_direction, project_settings_design_guidance, project_target_scale]
re_open_trigger: "Before or at the start of Phase 149 (Model Registry & Discovery) — the first phase whose scope concretely straddles the Settings↔Control-Room line (a user picking a model vs an operator governing the registry). Resolve the boundary rule before 149 wires a model-management surface, so we don't build the split twice."
---

> **RESOLVED 2026-07-12** via `/gsd:explore` (operator-affirmed). The boundary RULE lives in
> **`.planning/notes/settings-control-room-boundary.md`**; the **exhaustive evidence-based item-by-item
> decision table** (every Settings knob + backend config + gaps + future, from a two-scout code sweep)
> lives in **`.planning/notes/dynamic-control-inventory.md`**. Both promote to a locked **D-149-NN** at
> `/gsd:discuss-phase 149`. Key reframe (F1): today's Settings is ALREADY global + operator-gated ⇒ a
> misplaced Control Room, not a split. TL;DR of the ruling:
> - **Three surfaces, not two:** Control Room = platform governance (operator) · Settings = user
>   preferences *within what the operator allows*, privilege-gated · Profile menu (top-right) = identity.
> - **One pattern for every knob:** operator governs the allowed-set + policy → user picks a preference
>   within it → operator can **lock** any choice → Settings-knob visibility is privilege-gated (VIS-01).
> - **Models (the 149 blocker) resolved:** registry/capabilities/discovery = operator; user picks from
>   the enabled set; lock = policy flag; no per-group greenlist until v3.4 (SEED-115).
> - **v3.3 scope:** 149 (models) + 150 (secrets, operator-only) + profile-menu split (SEED-113).
>   Everything else (greenlists, retrofit existing knobs, cost caps, scheduled triggers, doc-ACL) →
>   v3.4 governance/org-RBAC backlog — where automation + integration live.

# SEED-116: Control Room ↔ Settings boundary + full dynamic-control inventory

## The question (operator-raised, 2026-07-12, during Phase 148 UAT)

We are building the Operator Control Room (v3.3, Phases 146–158) as the "control everything dynamically" surface. The operator asked, honestly: **what is the crisp rule for what lives in the existing Settings page vs the Control Room — does Settings migrate fully into the Control Room, or do we split it, and along what line?** Plus: **have we thought comprehensively about *everything* that should be dynamically controllable** (they named model-capability scraping per provider + new-model discovery, and skill evals as examples), or are there gaps?

This is a genuine, unresolved product-design decision — not a coding task. It needs a focused `/gsd:explore` (freeform ideation), not an execute-phase.

## Current thinking (first-pass, to be pressure-tested in explore — NOT locked)

**Proposed boundary rule:**
- **Settings = "my preferences"** — inherently per-user: my default model, theme, my embedding choice, my profile/general settings (SEED-113). These stay in Settings.
- **Control Room = "platform governance"** — who-sees-what (feature visibility, VIS-01/148), kill-switches (FLAG-01/147), audit (ADMIN-03/148), the model *registry* (149), secrets at rest (150), dependency/engine health, user roster. Operator-scoped, no-RLS-backstop surface.
- **The overlap is real and unresolved:** model management is the sharp case — the *registry of available models + capabilities* is Control-Room/operator (149), but a user *picking their model* is Settings. 148 already gated `model_management` as a feature; 149 builds the registry. We have NOT drawn a crisp whole-page rule. The existing Settings page also already needs a design review (project_settings_design_guidance).

**Comprehensive inventory of dynamic-control candidates (draft — the explore should complete + prioritize this):**
- Model registry + per-provider capability scraping + new-model discovery — **Phase 149 (MODEL-01/02)**, read path live since mig 053. (This is the operator's named ask — already the next phase.)
- Secrets / API keys at rest — **Phase 150 (SEC-01)**, encrypt in app_settings (only true secrets stay env).
- Feature visibility — **Phase 148 (VIS-01)** ✅ done. Kill-switches — **Phase 147 (FLAG-01)** ✅ done. Audit/users — **Phase 148 (ADMIN-03)** ✅ done.
- Eval / Skill Studio config — judge model (in Settings engine-health, 137.1), eval-matrix targets (live in Studio per project_dynamic_settings_direction, NOT Settings). Boundary q: does any of this move to Control Room?
- Embedding model + re-embed — already dynamic in Settings (Phase 111.1).
- NOT yet scoped anywhere (candidates surfaced by this question): retrieval/chunking/top-k tuning, system-prompt / prompt-template governance, provider routing + failover policy (MODEL_CAPABILITIES), sandbox config (image/timeouts), ingestion knobs, rate limits, **cost/budget caps + usage dashboards** (deferred v3.4 — prerequisite for scheduled runs), **scheduled/recurring triggers** (deferred v3.4), **org-level RBAC / departments / greenlists** (SEED-115, deferred; 148 audience was built enum-not-boolean precisely to grow into this).

## Honest status

v3.3 covers the highest-ROI governance spine (roles → control plane → governance → model registry → secrets) end-to-end, but it is **not** the complete "control everything" endstate, and the Settings↔Control-Room split is a real open decision with no dedicated design pass yet. This seed exists so that decision gets made deliberately (before Phase 149) rather than drifting.

## Next action

Run `/gsd:explore` on this seed before Phase 149. Feed it: this file, project_admin_panel_plan, project_dynamic_settings_direction, project_settings_design_guidance, SEED-113 (profile/general settings), SEED-115 (org roles). Output: a boundary decision (D-NN) + a prioritized dynamic-control backlog mapped to phases/milestones.
