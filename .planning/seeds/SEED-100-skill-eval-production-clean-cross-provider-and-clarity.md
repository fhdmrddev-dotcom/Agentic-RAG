---
seed_id: SEED-100
title: Dedicated phase — make Skill Eval production-clean (cross-provider robustness for ALL providers + user-facing clarity)
status: planted
planted: 2026-07-01
phase_origin: "Operator note after running live evals across the full native roster during/after Phase 133 (2026-06-30 → 2026-07-01). The eval engine + thin --skip-ui surface shipped and verified, but two gaps remain before it's something an end user can trust: (1) the WITHOUT-skill baseline arm trips provider-specific request-shape rules on several providers, and (2) the surface is confusing to a non-expert — it lives in the sidebar with very detailed information and the user doesn't know what 'eval' even means."
category: product + cross-provider robustness — close the Skill Eval feature cleanly, 100%, for every provider, with an end-user-legible surface
related_seeds:
  - SEED-099-feature-visibility-by-role-advanced-features-admin-gated (who sees evals + reframe the label)
  - SEED-095-settings-admin-control-center-provider-model-management-icon-convention (model curation / dynamic registry)
  - SEED-088-dynamic-model-registry-live-discovery-db-backed-ui-managed
related_memories: [project_133_executed, feedback_cross_provider_full_native_roster, feedback_no_cross_provider_regressions, feedback_vibe_coder_communication, feedback_provider_docs_first]
related_bugs:
  - BUG-260630-01 (DeepSeek without-skill reasoning_content 400)
  - BUG-260701-01 (agent-loop assistant prefill 400 on claude-sonnet-5 / 4.6+ family — without-skill arm)
related_decisions:
  - "D-14 red line: fix provider differences at the gateway/adapter/sanitizer boundary; never fork the shared Deep/agent-loop path. The eval without-skill (empty-catalog) baseline must produce a clean completion on ALL 8 providers (OpenAI/Anthropic/Google/OpenRouter + DeepSeek/Moonshot/GLM/MiniMax) — today it 400s on some and returns empty on others."
  - "Phase 134 (EVAL-03/04) owns the honest per-provider verdict + side-by-side + ratings; Phase 137 (PANEL-01, G-2 sketch) owns the DESIGNED eval panel. The clarity work below is that panel's acceptance bar, not the thin --skip-ui surface."
re_open_triggers:
  - "Phase 134 or Phase 137 enters discuss/sketch — fold this in: the panel must (a) explain what an eval is + what with/without means in plain language, (b) hide the verbose run internals behind progressive disclosure, and (c) only show evals to entitled roles (SEED-099)."
  - "Any eval run 400s or returns empty on a provider's baseline arm — the cross-provider hardening below is the fix."
priority: high
suggested_phase: "A dedicated 'Skill Eval — production-clean' phase (after the Phase 133 engine; pairs with 134/137). Two halves: (1) CROSS-PROVIDER ROBUSTNESS — the WITH and WITHOUT arms both complete a clean A/B on all 8 native providers, with provider request-shape traps fixed at the gateway/adapter boundary (assistant-prefill removed for prefill-rejecting models, DeepSeek reasoning_content shape, empty-baseline handling), per the full-native-roster mandate; (2) USER-FACING CLARITY — a legible eval surface that says what it is and what with/without means, with verbose run detail behind progressive disclosure, gated to entitled roles (SEED-099)."
---

# SEED-100 — Make Skill Eval production-clean (all providers + clarity)

Operator note, 2026-07-01, after running live evals across the native roster.

## The two gaps

**1. Cross-provider robustness of the baseline arm.** Phase 133's engine is sound and
the WITH-skill arm works across providers, but the **WITHOUT-skill (empty-catalog)
baseline** trips provider-specific request-shape rules:
- `claude-sonnet-5` (and the Claude 4.6+/5 family): **400 — assistant prefill removed** (BUG-260701-01).
- DeepSeek: **400 — `reasoning_content`** message-shape (BUG-260630-01).
- Some providers (haiku, gemini) returned an **empty** "no response after 2 iterations" baseline rather than a real completion.

Per `feedback_cross_provider_full_native_roster` + D-14, a clean A/B requires BOTH
arms to complete on **all 8 providers**, with the differences absorbed at the
gateway/adapter/sanitizer boundary — never by forking the shared path. This is the
"close it cleanly, 100%, for all providers" the operator asked for.

## The user-facing clarity gap

From the user, verbatim intent: *"as a user I still do not know what that means, and it
is in the sidebar with very detailed information that confuses the user."* The thin
`--skip-ui` surface (correct for Phase 133, D-07) exposes raw run internals. The
designed panel (Phase 137 / PANEL-01) must:
- **Explain the feature** — what a skill eval is, and what "with-skill vs without-skill"
  means, in plain language (`feedback_vibe_coder_communication`).
- **Progressive disclosure** — headline verdict first; the verbose per-case/per-arm
  detail behind a click, not dumped in the sidebar.
- **Role-gate it** — evals are an advanced/admin feature, not default end-user surface
  (SEED-099). Decide who sees it before polishing how it looks.

## Why a dedicated phase

The engine is done; what's left is (a) provider hardening that touches the shared
gateway boundary (needs its own careful, D-14-respecting pass with full-roster UAT) and
(b) a designed, role-gated, legible surface (sketch-gated, pairs with 134/137). Bundling
both as one "production-clean" phase keeps the eval feature from shipping half-trustable.
