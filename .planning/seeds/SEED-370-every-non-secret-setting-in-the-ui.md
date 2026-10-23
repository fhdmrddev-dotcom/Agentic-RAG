---
seed_id: SEED-370
title: Every non-secret setting is controllable in the UI — 62 env-only settings remain
created: 2026-10-23
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next milestone is scoped, or any phase touching backend/app/config.py, backend/app/models/user_settings.py, backend/app/api/settings.py or frontend/src/pages/SettingsPage.tsx.
trigger_paths: ["backend/app/config.py", "backend/app/models/user_settings.py", "backend/app/api/settings.py", "frontend/src/pages/SettingsPage.tsx", "supabase/migrations/*app_settings*"]
trigger_surfaces: []
migration_note:
relates_to: ["supabase/migrations/212_app_settings_harness_authoring_model.sql", "supabase/migrations/086_app_settings_harness_judge_model.sql", "frontend/src/components/settings/AuthoringModelPicker.tsx", "phase 291 UAT S1"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-370: Every non-secret setting is controllable in the UI

## The finding

Operator direction, 2026-10-23: *"we should have everything to be controlled in the UI except
secrets."* CLAUDE.md already says settings live in `user_settings` / `app_settings` and the
Settings UI, and that env vars are for secrets and infra only. It was not followed everywhere.

Measured on 2026-10-23: `config.Settings` fields whose names don't look like a secret, checked
against `app_settings` columns in `supabase/full-schema.sql` (84 columns). **63 were env-only.**
One was moved the same day (`harness_authoring_model`, migration 212, Settings → AI Model →
"Workflow drafting model"), so **62 remain.** The triage below is a first pass and needs
checking per item.

**A — product knobs: belong in the UI (≈17)**
`ask_user_min_timeout_seconds`, `ask_user_max_timeout_seconds`, `harness_phase_max_steps`,
`harness_phase_wall_clock_seconds`, `harness_publish_max_seconds`, `max_continues_per_run`,
`task_max_steps`, `sandbox_exec_timeout_seconds`, `sandbox_ttl_minutes`, `sub_agent_max_chars`,
`fetch_document_file_max_mb`, `context_window_reserve_recent`, `chunk_size`, `chunk_overlap`
(check: these may already be shadowed by a `user_settings` field under another name),
`retention_sweep_enabled`, `email_provider` + `invite_from_email`, `langsmith_tracing` +
`langsmith_project`.

**B — model data the Model Registry may already own (≈15): verify, then retire or keep as seed**
`*_models` (anthropic, openai, google, deepseek, zhipu, minimax, moonshot, openrouter, ollama,
lmstudio), `available_models`, `custom_models`, `model_context_limits`, `model_output_limits`,
`llm_call_timeout_overrides` (the registry carries a per-model timeout since phase 282).

**C — infrastructure / deploy: stays in env (≈30)**
`environment`, `supabase_project_ref`, `postgres_pool_min/max`, `ingest_*`, `watch_*`,
`scheduler_*`, `run_stale_sweep_*`, `run_start_grace_seconds`, `consumer_timeout_seconds`,
`task_global_concurrency`, `task_per_run_concurrency`, `hnsw_*`,
`harness_resume_lease_seconds`, the `*_oauth_client_id` values (deploy config paired with a
secret), and `operator_emails` (the bootstrap authority — moving it into the UI would let an
operator remove the last operator).

## Why it matters

A model id or knob that lives only in `.env` needs a file edit and a backend restart. A
non-technical operator can't do that, and the value silently drifts between local and cloud. At
291 UAT S1 the drafting model was stuck on a provider with no credit, and the only fix was an
`.env` edit.

## When to surface

When the next milestone is scoped, or when any phase's `files_modified` touches
`config.py`, `user_settings.py`, `api/settings.py` or `SettingsPage.tsx`. Each setting moved
follows the 086/212 pattern: an `app_settings` column, a `UserEffectiveSettings` field, a
validated `SettingsUpdate` field, a Settings control, and the env var kept as a fallback.

## Scope estimate

Large as a whole (about 17 controls plus a registry audit); each group A item is Small. G-5:
`SettingsPage.tsx` and `api/settings.py` are both FIRING hot files, so a phase that moves many
settings should first take the named state-split seam (D-15) in `docs/HOT-FILE-LEDGER.md`.
