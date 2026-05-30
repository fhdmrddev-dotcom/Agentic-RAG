---
id: SEED-040
status: dormant
planted: 2026-05-30
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 089/090 cross-provider debugging)
trigger_when: A new model needs a config.py code edit (or manual DB insert) to get correct capabilities, OR provider_model_lists drifts from a provider's live /models, OR an admin/operator-UI / settings-unification milestone is scoped
scope: Medium
---

# SEED-040: Model Registry Self-Service — operator-facing model/capability management so new models work without code edits

## Why This Matters

Model capabilities (`native_tools`, `llm_call_timeout_seconds`, `max_output_tokens`, `context_window_tokens`) live **hardcoded in `backend/app/config.py` `MODEL_CAPABILITIES`**. Today, adding a new model or correcting a model's capabilities means a **code edit** — the operator has to ask the developer every time. That is the exact pain the operator raised on 2026-05-30: "for every change I am requesting you to go and even modify the settings on code level."

The non-obvious part: **the DB plumbing already exists but was never surfaced.** Migration `053_settings_unification.sql` (Phase 081.1, D-09/D-10) created `model_capabilities_overrides`, and `config.py::get_model_capability_async` (the function the agent loop actually uses) **already reads it on the hot path** and merges `native_tools` / `llm_call_timeout_seconds` / `max_output_tokens` / `context_window_tokens` per model. But there is **no write UI or API anywhere** (verified by grep across backend API + frontend) — so the table sits empty and the override path is dead. The schema + read half shipped; only the operator-facing write half is missing.

Without this, the registry silently rots: model lists drift from what providers actually serve (e.g. zhipu exposed China-only `glm-4-plus`/`glm-4-flash` that aren't in z.ai's int'l `/models`), and capability errors stay invisible until a user hits them.

## When to Surface

**Trigger:** the next time a new model needs a `config.py` code edit (or manual DB insert) to get correct capabilities, OR `provider_model_lists` drifts from a provider's live `/models`, OR an admin/operator-UI or settings-architecture milestone is scoped.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of:
- Admin / operator UI work (folds naturally into **SEED-012 admin-operator-ui-completeness**)
- Settings architecture / unification work (**SEED-024**)
- Any milestone adding or curating provider models (e.g. the Phase 096 / EVAL-01 "per-provider model-ID curation pass" already flagged in STATE.md)
- Recurrence of a "had to edit code to add/fix a model" event

## Scope Estimate

**Medium** — a phase or two. Three layers, two of which are already partly built:
1. **List freshness (small):** a "Refresh models" action that pulls each provider's live `/models` endpoint → updates `app_settings.provider_model_lists`. The app already calls `/models` successfully (proven 2026-05-30). Lists must be ordered **newest/highest-first** (see memory `feedback_prioritize_newest_models`).
2. **Capability precision, no-code (medium):** a small admin/settings CRUD screen + one endpoint to populate `model_capabilities_overrides` (native_tools / timeout / max_output_tokens / context_window). Schema + read path already shipped (053) — **only the write surface is missing**.
3. **Zero-config default layer (DONE):** the inference fallback `config.py::_build_inferred_defaults` + `_NATIVE_TOOL_PROVIDERS` (fixed 2026-05-30) already gives any new model on the native-tool providers (openai/anthropic/google/deepseek/moonshot/minimax/zhipu) sane defaults incl. `native_tools=True`. This is the "works naturally without curation" baseline.

## Breadcrumbs

- `backend/app/config.py` — `MODEL_CAPABILITIES` registry; `get_model_capability` (sync, pure) and **`get_model_capability_async` (config.py:545 — merges the DB override)**; `_build_inferred_defaults` + `_NATIVE_TOOL_PROVIDERS` (the 2026-05-30 inference fix); `get_per_call_timeout_async` (config.py:501 — DB timeout override tier)
- `backend/app/models/user_settings.py:260` — `_load_model_overrides()` (reads `model_capabilities_overrides`, cached)
- `supabase/migrations/053_settings_unification.sql` — the `model_capabilities_overrides` table (Phase 081.1, D-09/D-10)
- `backend/app/api/settings.py:208` + `backend/app/main.py:122` — where `provider_model_lists` is written (Settings API + one-time migration; NOT auto-refreshed)
- Related seeds: **SEED-012** (admin-operator-ui-completeness — natural parent), **SEED-024** (settings-architecture-unification), **SEED-022/023** (timeout settings UI / adaptive timeouts), **SEED-031** (direct-provider SDK integrations)
- STATE.md Blockers/Concerns: "Per-provider eval model list (EVAL-01 / Phase 096): needs a curation pass to current model IDs per native provider"

## Notes

Surfaced while fixing the zhipu/minimax "tool calls narrated as text" bug (see memory `project-cross-provider-native-tools-registry-trap`): the registry-miss → `native_tools=False` trap was the symptom; this seed is the structural cure (stop hardcoding, give the operator a surface). The 2026-05-30 inference fix bought breathing room (new models on the 7 native-tool providers now work for tool-calling with no edit), but accurate per-model metadata + list freshness still need the operator UI. Operator is a vibe coder — the UI should be plain-language (e.g. a "supports tools" toggle, a timeout field), not raw JSONB editing.
