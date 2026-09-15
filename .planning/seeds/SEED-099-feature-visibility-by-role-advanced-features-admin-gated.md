---
seed_id: SEED-099
title: Feature visibility by role/user-type — advanced & scale features (eval, etc.) are admin/privileged-only, not end-user
status: planted
planted: 2026-06-30
phase_origin: "Operator note during Phase 133 (Eval Runner) live verification (2026-06-30). The eval feature currently lives inline in each skill's settings; the operator observed it (a) deflects too much information and (b) is unclear from an end-user perspective ('what does eval even mean'). Broader point raised: features like eval, scale features, and other power/admin features should NOT necessarily be shown to the end user — they belong to admin/privileged users, gated by a role/user-type system to be designed in a future milestone."
category: product / role-based feature gating + information architecture — which users see which features
related_seeds:
  - SEED-095-settings-admin-control-center-provider-model-management-icon-convention (the admin control-center home; model curation lives there)
  - SEED-012-admin-operator-ui-completeness (admin/operator role + control surface)
  - SEED-085-user-friendly-vs-admin-terminology (user-vs-admin language split — "eval" is admin jargon)
  - SEED-024-settings-architecture-unification
related_memories: [project_admin_panel_plan, project_org_level_deferred, project_target_scale, project_settings_design_guidance, project_133_executed, feedback_vibe_coder_communication]
related_decisions:
  - "v2.9 STRETCH Phase 109 / ROLE-01 (operator/admin role tier) was deferred — this seed is a concrete driver for that role tier."
  - "project_admin_panel_plan: a future admin panel governs every dynamic setting; this extends it to govern feature VISIBILITY by role, not just settings values."
  - "Phase 133 D-07: the eval surface shipped as a thin --skip-ui section inside the skill settings dialog; the DESIGNED Skill Evals panel is Phase 137 (PANEL-01, G-2 sketch-gated). Phase 137 is the natural place to (a) gate eval behind a role/privilege check and (b) reframe the label/explanation for whoever is allowed to see it."
re_open_triggers:
  - "The role-tier / admin-shell milestone starts (ROLE-01 / operator role tier / `.planning/PRDs/.../v3.2-operator-ux.md`) — promote this seed: define the user-type model (end-user vs admin/privileged) and the per-feature visibility map."
  - "Phase 137 (PANEL-01, designed Skill Evals panel) enters discuss/sketch — the design MUST decide who sees evals (role gate) and how the feature is framed/labelled for that audience, not just how it looks."
  - "Any phase that adds another advanced/scale/admin-flavored feature to an end-user surface — route it through the role-visibility map instead of dropping it inline."
priority: medium
suggested_phase: "Future role-tier / admin-shell milestone (ROLE-01). Defines: (1) a user-type / role model (end-user vs admin vs privileged), (2) a per-feature visibility map so advanced/scale features (eval, model curation, provider management, cost/registry, run honesty internals, etc.) render only for entitled roles, (3) end-user-facing surfaces stay clean + jargon-free. Phase 137 should honor the gate for evals specifically."
surface: Agentic-RAG
trigger_when: unset
---

# SEED-099 — Feature visibility by role/user-type (advanced features are admin-only)

Operator note captured during Phase 133 live verification (2026-06-30).

## The observation

The eval runner shipped (correctly, per Phase 133 D-07) as a **thin functional
section inside each skill's settings dialog**. From an end-user perspective that is
two problems at once:

1. **Information overload / wrong audience.** Skill settings now carry a power
   feature (run an A/B eval across providers) that most end users won't understand
   or need. It "deflects too much information."
2. **Unclear meaning.** "Eval" is admin/ML jargon — it isn't self-explanatory to a
   normal user. Even if shown, it needs reframing for whoever is meant to use it.

## The broader principle

This isn't just about eval. **Advanced, scale, and admin-flavored features should
not necessarily be shown to the end user.** They belong to **admin / privileged
users**, gated by a **role / user-type system** to be designed in a future
milestone. Examples that should be role-gated, not dropped onto end-user surfaces:

- Skill **evals** (this feature)
- **Model/provider management + curation** (SEED-095 — which models the org uses)
- Per-model **cost/rate registry** (SEED-073)
- **Run-honesty internals**, scale/observability knobs, deployment presets
- Anything that is "operator decides for the org," not "end user does their work"

## What this implies for design

- A **user-type model** (at minimum: end-user vs admin/privileged) + a **per-feature
  visibility map**. Default end-user surfaces stay clean and jargon-free
  (`feedback_vibe_coder_communication`, SEED-085 terminology split).
- The **admin control center** (SEED-095) is the natural home for the admin-only
  features; this seed adds the *visibility gate* on top of the *settings home*.
- **Phase 137** (designed Skill Evals panel, G-2) must decide **who sees evals**
  (role check) and **how the feature is framed** for that audience — not just its
  visuals. The current inline-in-skill-settings placement is interim.

## Not in scope now

The role/entitlement system itself is future-milestone work (ROLE-01 / admin
shell). This seed records the principle + concrete re-open triggers so it surfaces
when that milestone (or Phase 137) is scoped. Ties to `project_org_level_deferred`
(org/multi-tenant + auth/billing still undecided) and `project_admin_panel_plan`.
