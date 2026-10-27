---
seed_id: SEED-374
title: The model registry becomes the ONLY source of the model list (retire provider_model_lists)
created: 2026-10-24
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The first phase whose files_modified names backend/app/models/user_settings.py, backend/app/api/settings.py or backend/app/api/admin.py after Phase 292.1 closes; or the operator asks for model-list cleanup. Route via /gsd:discuss-phase.
trigger_paths: ["backend/app/models/user_settings.py", "backend/app/api/settings.py", "backend/app/api/admin.py", "frontend/src/pages/SettingsPage.tsx", "frontend/src/components/admin/ModelRegistryTab.tsx"]
trigger_surfaces: ["settings", "admin", "provider"]
migration_note:
relates_to: ["85ec45110", "backend/app/models/user_settings.py::_build_providers", "app_settings.provider_model_lists", "model_capabilities_overrides", "Phase 262 (capabilities are DATA)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-374: The model registry becomes the ONLY source of the model list

## The finding

The chat model picker has two sources of truth:

- the model registry (`model_capabilities_overrides`, edited in the Control Room)
- `app_settings.provider_model_lists`, which the Settings page writes back IN FULL (the merged list) on every save

Quick task `85ec45110` (2026-10-24, session agentic-rag-f9) made the picker follow the registry: added ids appear, and removed ids are hidden even when `provider_model_lists` still names them (`_build_providers`). But both stores still exist.

Measured on the local DB: **21 ids live ONLY in `provider_model_lists`** with no registry row (e.g. `kimi-k2.7-code`, `gpt-oss-20b`).

## Why it matters

Two writable homes for one fact drift apart. Every Settings save re-persists the merged list, so a removed model can be resurrected into the stored list, and the picker stays correct only because of the tombstone filter added in `85ec45110`. Cloud has its own `provider_model_lists`, so the drift exists in production too.

## When to surface

Any phase whose `files_modified` names `backend/app/models/user_settings.py`, `backend/app/api/settings.py` or `backend/app/api/admin.py`, once Phase 292.1 has closed (292.1 also touches `user_settings.py`). Or when the operator asks for model-list cleanup.

## Scope estimate

Phase-sized (Medium-Large). Steps, as proposed by the operator and session f9:

1. A migration backfills the 21 list-only ids as registry rows. Removed ids stay removed.
2. `_build_providers` reads the registry only.
3. The Settings provider card becomes a second door onto the same add-by-ID / remove API.
4. `provider_model_lists` stays unread for one release, then gets dropped.

All touched files are G-5 hot files: `user_settings.py`, `settings.py`, `admin.py`, `SettingsPage.tsx`. Cloud needs the same backfill: a seed-bearing migration, following the deploy-parity rules.

**Open operator decision:** does Settings model editing become operator-only? Session f9 recommended yes.

## Breadcrumbs

- `85ec45110`: fix(quick-261024), the chat picker follows the model registry; discovery gets a provider filter.
- Handoff from session agentic-rag-f9 to agentic-rag-3d, 2026-10-24 (operator idea, not started).
- CLAUDE.md: "A model's capabilities are DATA, not code (Phase 262 / migration 190)."
</content>
</invoke>
<invoke name="Bash">
<parameter name="command">cd "/c/Vibe Apps/Agentic RAG" && node scripts/check-seeds-register.cjs 2>&1 | tail -3; git add -- .planning/seeds/SEED-374-model-registry-is-the-only-source-of-the-model-list.md && git commit -q -m "docs(seeds): plant SEED-374 — model registry as the only model-list source

Operator idea handed over by session agentic-rag-f9 after 85ec45110;
not started. Route via discuss-phase after 292.1 closes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- .planning/seeds/SEED-374-model-registry-is-the-only-source-of-the-model-list.md && git log --oneline -1