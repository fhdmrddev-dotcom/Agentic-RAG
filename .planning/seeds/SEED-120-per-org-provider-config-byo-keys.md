---
seed_id: SEED-120
title: Per-org provider configuration + bring-your-own API keys (org-scoped model/provider selection, one-provider-only, local-model pointer)
status: open
planted: 2026-07-18
planted_during: v3.4 new-milestone (strategic Q&A — operator asked about API keys at scale, one-provider-per-company, and local deployment)
category: multi-tenancy config projection — rides the v3.4 org substrate + v3.3 encrypted secrets; deliver in v3.5
priority: high
scope: Medium
related_seeds: [SEED-117, SEED-081, SEED-121, SEED-122, SEED-115, SEED-080, SEED-003]
related_memories: [project_settings_control_room_boundary, project_dynamic_settings_direction, project_v34_milestone_started, project_provider_feature_fit_routing, project_target_scale]
re_open_trigger: "At v3.5 (Open Platform / config-consolidation), OR the moment a customer needs (a) their own provider billing/keys, (b) a single-provider-only org, or (c) to point an org at their own local/self-hosted model. v3.4 must leave the org-settings schema forward-compatible so this lands with NO rewrite."
surface: Agentic-RAG
trigger_when: unset
---

# SEED-120 — Per-org provider config + BYO API keys

## Why This Matters

Today provider config is **platform-global**: one API key per provider (encrypted at rest since v3.3 SEC-01), and the operator picks the enabled model set via the v3.3 model registry. That's correct for a single deployment. It is NOT enough once **orgs** exist (v3.4):

- A company on a shared co-tenant SaaS may want to **bring its own provider key** (their billing, their rate limits, their compliance) instead of riding the operator's shared key.
- A company may want **one provider only** (e.g. "we only allow Anthropic") — a per-org narrowing of the platform-allowed set.
- A company running **on-prem / locally** may want to point its org at its **own local/self-hosted model** (Ollama / LM Studio / OpenAI-compatible — already supported architecturally; see [[SEED-122]]).

v3.4 makes this **possible for the first time** because it delivers the two prerequisites: the **org schema** (v3.4) + **encrypted secrets at rest** (v3.3). This seed is the config-projection that rides on top — the natural next step, deliberately deferred so v3.4 stays focused on the isolation crux.

## The two-layer pattern this inherits

Exactly the SEED-116 / VIS-01 / VIS-02 pattern v3.4 builds: **operator governs the platform-allowed provider/model set + policy → org-admin narrows to the org's allowed set (+ optional BYO key) → user picks within it → operator/org can LOCK**. Per-org provider config is just "providers/keys" plugged into the greenlist + preference substrate v3.4 ships in Phase 167.

## Scope (when triggered)

1. **Org-scoped provider config** — an `org_id`-scoped settings layer (org-level `app_settings` analog) for enabled providers/models, base URLs, and an optional per-org BYO key column set (encrypted via the shipped MultiFernet `enc:v1:` envelope, reusing SEC-01 — no new crypto).
2. **Precedence** — per-org key/config > platform key/config > env fallback (extends the existing DB>env `_val` chain; never break the shared path or env-fallback).
3. **One-provider-only org** — an org-admin narrows the platform-allowed set to a subset; the model picker + registry become org-aware.
4. **Local/self-hosted pointer** — an org points at its own Ollama/LM-Studio/OpenAI-compatible endpoint (the embeddings picker + model registry already support these shapes).
5. **Cross-provider red line preserved** — all provider differences stay at the gateway/adapter boundary; org config selects, it never forks the shared path.

## Why NOT in v3.4

v3.4 is the one-way-door isolation crux. Per-org provider config is a config-projection, not tenant-isolation-critical, and config-consolidation is already deferred to v3.5 ([[SEED-117]]). **The only v3.4 obligation:** keep the org-settings schema forward-compatible (org-scoped settings + the encrypted-secret column pattern) so this needs no rewrite. Flag at the Phase-160 ADR + Phase-161 schema.

## Related
[[SEED-117]] (v3.5 config-consolidation — this is a provider slice of it) · [[SEED-081]] (provider rate-limit resilience — pairs at scale) · [[SEED-121]] (key pooling/rotation — the scale sibling) · [[SEED-122]] (local-model validation) · [[SEED-080]] (entitlements — per-org key may be a tier gate) · [[project_provider_feature_fit_routing]].
