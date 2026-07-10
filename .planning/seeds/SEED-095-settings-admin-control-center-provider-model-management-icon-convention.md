---
seed_id: SEED-095
title: Settings → Admin Control Center — visual + functional rework with first-class provider/model management + the shared icon convention surfaced there
status: planted
planted: 2026-06-27
phase_origin: "Operator note during the Phase 127 (WUX-03) /gsd:sketch --wrap-up (2026-06-27) — raised alongside the icon-convention decision (Running Design Decision 43): the Settings page should be reworked not just visually but FUNCTIONALLY (admin controls everything), and should carry first-class items for providers and models."
category: settings / admin UX + functionality — a CONVERGENCE seed that bundles the existing settings/admin/model-registry seeds into one 'admin control center' home, plus the provider/model management surface where the shared icon convention is reflected
related_seeds:
  - SEED-024-settings-architecture-unification (the closest existing 'settings rework' home)
  - SEED-012-admin-operator-ui-completeness (admin/operator role + control surface)
  - SEED-040-model-registry-self-service (provider/model registry self-service)
  - SEED-088-dynamic-model-registry-live-discovery-db-backed-ui-managed (live model discovery, DB-backed, UI-managed)
  - SEED-058-chat-surface-ux-polish-provider-logos-nav-presence (provider logos in the chat surface)
  - SEED-085-user-friendly-vs-admin-terminology (the user-vs-admin language split)
  - SEED-073-model-cost-rate-registry-token-to-usd (per-model cost registry — an admin item)
related_memories: [project_admin_panel_plan, project_settings_design_guidance, project_settings_save_silent_failure, feedback_prioritize_newest_models, feedback_model_names_representative, project_v3_roadmap_locked]
related_decisions:
  - "Phase 127 Running Design Decision 43 (icon convention): provider/model icons = SINGLE SOURCE @lobehub/icons everywhere; phase-type icons = the shared 3D PHASE_GLYPHS map. The reworked Settings provider/model surface MUST render those same canonical marks (no per-surface variation)."
  - "CLAUDE.md rule: settings live in user_settings / app_settings + the Settings UI; only secrets (API keys) stay in env. The admin rework keeps adding knobs to Settings/DB, not .env (project_admin_panel_plan)."
  - "project_settings_save_silent_failure: save_app_settings swallows write errors → fake 'Saved'. The rework must stop swallowing + audit api_key columns + verify every knob persists."
re_open_triggers:
  - The v3.2 Operator UX milestone starts (admin shell + operator role tier + deployment presets per `.planning/PRDs/SEQUENCE.md` / `v3.2-operator-ux.md`) — this is the natural home; promote this seed + its bundled seeds (012/024/040/088/058/085/073) into that milestone's scope.
  - Any phase that reworks `frontend/src/pages/SettingsPage.tsx` (visual OR functional) — fold in the provider/model management items + the icon convention surfacing then.
  - Any phase that builds a provider/model registry / picker / enable-disable surface — make Settings the home and render the @lobehub/icons canonical marks.
  - The Phase 127 build adopts the icon convention — when the provider-logo helper (Phase 128 `providerLogo.tsx`) becomes the single source, plan to surface the provider list (with those marks) in Settings.
priority: medium
suggested_phase: v3.2 Operator UX (admin shell). Likely a 'Settings/Admin Control Center' phase that (a) reworks SettingsPage visuals, (b) makes it the functional admin home that controls every dynamic setting, (c) adds first-class provider + model management (enable/disable, defaults, per-provider config, model registry self-service, cost/rate), and (d) reflects the shared icon convention (canonical @lobehub/icons provider marks).
---

# SEED-095 — Settings → Admin Control Center (provider/model management + icon convention)

Operator note captured during the Phase 127 sketch wrap-up (2026-06-27). Two
linked ideas, both forward-looking (next-milestone territory, not v3.1):

## 1. Rework the Settings page — visuals AND functionality

Beyond a visual refresh, the Settings page should become the **functional admin
control center** — the operator controls *everything dynamic* from one place
(the standing direction in `project_admin_panel_plan`: only API-key secrets stay
in env; every other knob lives in `user_settings` / `app_settings` + the Settings
UI). This is the convergence point for the already-planted settings/admin seeds
(SEED-024 architecture unification · SEED-012 admin-operator UI · SEED-085
user-vs-admin terminology) — they should be scoped together, not piecemeal.

**Load-bearing fix to carry in:** `project_settings_save_silent_failure` —
`save_app_settings` currently swallows write errors and shows a fake "Saved." The
rework must stop swallowing, audit the `api_key` columns, and verify every knob
actually persists.

## 2. First-class provider + model management in Settings

Add explicit items for **providers** and **models**: enable/disable a provider,
set defaults, per-provider config (base_url, key-as-secret), the model registry
self-service + live discovery (SEED-040 / SEED-088), and per-model cost/rate
(SEED-073). This is where the org curates "the models you actually use"
(`feedback_prioritize_newest_models` — newest-first, validate-served-via-/models;
`feedback_model_names_representative` — the user's model names are provider classes
needing a curation pass).

## 3. Reflect the shared icon convention here

Phase 127 set the icon convention (Running Design Decision 43): **provider/model
icons come from one source — `@lobehub/icons` — and render identically everywhere**
(chat tool-card, workflow run "engine" chips, scoreboards, and — per this seed —
the Settings provider/model surface). The reworked provider list should show those
SAME canonical brand marks; adding/enabling a provider uses the same logos. No
hand-drawn or per-surface variants (the exact trap Phase 127 fixed in its sketches).

## Why a seed, not a v3.1 fold

This is operator/admin-facing scope that maps to the **v3.2 Operator UX** slot
(admin shell, operator role tier) per the PRD sequence — explicitly NOT the v3.1
Workflow & Skill Studio milestone (which 127 closes). Planted so it surfaces at
`/gsd:new-milestone` with its bundled seeds and a concrete re-open trigger.

## Evidence + sharpened trigger (2026-06-30, Phase 133 eval UAT)

Phase 133 live cross-provider eval UAT produced concrete proof the curation pass
is needed — and that it is now **load-bearing for the eval feature**, not just chat:

- The provider model lists contain **aspirational / unserved ids** that 404 on the
  live account (e.g. `claude-sonnet-4-6`, `claude-haiku-4-5` without the dated
  suffix). Working ids were identified only by cross-referencing the `runs` table
  for models with real `status='completed'` history.
- The **eval router requires the model to be in `MODEL_CAPABILITIES`** (stricter
  than chat, which is more permissive for OpenRouter). So a curated registry that
  stays in sync with the picker lists is required for the eval picker to never
  offer a model that 404s. `meta-llama/llama-3.3-70b-instruct` works in chat but
  is absent from the registry → an eval can't use it today.

**Concrete curation-pass shape** (when this seed is promoted): per provider,
validate served models (live `/models` endpoint where available, else a cheap
1-token ping), trim `app_settings.provider_model_lists` to the proven set, pick a
single **default model per provider** (newest-first = default), and keep
`MODEL_CAPABILITIES` aligned with the picker. Keep ALL providers — curate the
*model lists*, not the roster.

**Sharper re-open trigger:** any time a configured model 404s in chat OR in an eval
run (the eval picker offering a dead model is the most visible failure).

## Validation-pass results (2026-06-30, read-only probe)

Ran a live `/models` + run-history probe per provider (proposed-only; no settings changed). Findings to carry into the curation phase:

- **Live `/models` worked for 6 providers** and every configured model was served: Google (50 served), DeepSeek (2), Moonshot (11), GLM/zhipu (8), MiniMax (8), OpenRouter (338).
- **Probe gaps (need a better per-provider served-check):** OpenAI's provider `base_url` is empty (SDK default) → naive `{base}/models` had nothing to hit; Anthropic `GET /v1/models` returned 404. So a robust probe must special-case these (OpenAI default base; Anthropic models endpoint/headers) or use a cheap 1-token test-call.
- **Run-history is NOT a reliable "served-today" signal:** Anthropic `claude-sonnet-4-6` had 10 historical `completed` runs but **404s now** (proven live in the Phase 133 eval UAT). Curation MUST validate live, not trust history.
- **Registry/picker drift (eval-specific, the load-bearing part):** models served + used in chat but ABSENT from `MODEL_CAPABILITIES` (so the eval router rejects them): `glm-5.2` (proven ×6), `kimi-k2.7-code`, and 6 OpenRouter slugs incl. `meta-llama/llama-3.3-70b-instruct` (proven ×8), `nvidia/nemotron-*`, `google/gemma-*`. The curation pass must KEEP the registry and the picker lists in sync, and add a default-model-per-provider (newest-first).
- **Confirmed-dead (drop candidates), live-proven:** Anthropic `claude-sonnet-4-6`, `claude-haiku-4-5` (no dated suffix) — both 404 on this account.
