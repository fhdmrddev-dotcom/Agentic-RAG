---
seed_id: SEED-126
title: Per-provider title-generation model selector + fallback in Settings
status: open
planted: 2026-07-22
phase_origin: "Operator flag during Phase 175 discuss-phase (2026-07-22): while routing the reasoning-provider title-quality bug (BUG-260722-01), the operator asked for a future Settings surface to choose the title-generation model per provider, with a fallback."
category: settings / dynamic-config — title-generation model resolution
related_bugs:
  - BUG-260722-01 (.planning/reported-bugs/BUG-260722-01-reasoning-provider-title-quality-degenerate-fallback.md) — the quality gap that motivated the request; 175 fixes the reasoning-off title call, this seed adds operator control.
  - BUG-260623-01 (.planning/reported-bugs/BUG-260623-01-title-gen-cross-provider-fallback-banner.md) — the cross-provider fallback banner; the D-03 shared utility-model guard is the substrate a per-provider selector would build on.
related_seeds:
  - SEED-088 (dynamic model registry / live discovery) — the registry a selector would draw its model list from.
  - SEED-117 (config consolidation — revive user_settings.preferences) — natural home for a per-provider title-model preference.
related_memories: [project_dynamic_settings_direction, project_admin_panel_plan, project_settings_control_room_boundary, feedback_provider_uniform_ux]
priority: low
---

# SEED-126 — Per-provider title-generation model selector + fallback (Settings)

## The ask (operator, 2026-07-22)

A Settings surface to **select the title-generation model per provider**, with a **fallback**. Today title-gen model resolution is code-driven: single-model providers use the chat model, multi-model providers use `sub_agent_model` → `_SUB_AGENT_MODEL_DEFAULTS[provider]` (`thread_title.py:116-137`). There is no operator control over which model titles a thread on each provider.

## Why a seed, not this phase

Phase 175 (XPROV-04 / BUG-260722-01) fixes the **quality** floor — reasoning providers emit a real title via a reasoning-off title call at the adapter boundary, no new config. This seed is the **operator-control** layer on top: a net-new Settings surface (per-provider title-model + fallback), which is out of scope for a cleanup milestone and aligns with the standing "everything dynamic → Settings/admin (except secrets)" direction ([[project_dynamic_settings_direction]], [[project_admin_panel_plan]]).

## Suggested shape (advice, not decided)

1. **Two-layer pattern** (operator allowed-set + lock → user preference → gated visibility), consistent with the resolved SEED-116 control-room boundary ([[project_settings_control_room_boundary]]).
2. **Draw the model list from the dynamic registry** (SEED-088) so new/discovered models appear without a hand-edit.
3. **Fallback chain** honors the D-03 cross-provider guard (never send a model to a provider it doesn't belong to — [[BUG-260623-01]]).
4. **Uniform UX across providers** — one selector shape, N adapters ([[feedback_provider_uniform_ux]]).
5. Candidate home: `user_settings.preferences` if SEED-117 config-consolidation revives it; else a scoped `app_settings` / `user_settings` field.

## Re-open triggers

- A future Settings/config-consolidation phase (SEED-117), OR
- v3.6+ when operator model-control surfaces are revisited, OR
- operator asks to control title-gen model per provider directly, OR
- the XPROV-04 reasoning-off title fix proves insufficient for some provider and a manual per-provider override becomes the pragmatic escape hatch.

## Evidence

- `backend/app/services/thread_title.py:116-137` (current code-driven title-model resolution).
- BUG-260722-01 (the quality gap), BUG-260623-01 (the cross-provider banner + guard substrate).
