---
seed_id: SEED-024
title: Settings & runtime-config architecture unification — eliminate settings_override.json, fold non-secret values into app_settings + user_settings + model_capabilities_overrides, expand admin scope to include title drafting, sub-agents, context window
status: deferred
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: scheduled

  Mapped `scheduled` -> `deferred`. Reason: named for a later slot.
planted: 2026-05-17
scheduled: 2026-05-17
scheduled_phase: 081.1 (proposed — Settings Architecture Unification, inserted between Phase 081 OpenRouter UAT and Phase 082 cross-cutting verify)
option_locked: B (small v2.6 polish phase before v3.0 starts; user lock-in 2026-05-17 — "we need to be consistent to establish a correct and solid ground to future milestones and plans")
phase_origin: 073-asyncpg-pool-integration (user-raised concern post-073 close)
related_seeds: [SEED-009, SEED-012, SEED-023, SEED-078, SEED-003, SEED-001, SEED-004]
relates_to:
  - CLAUDE.md project rule — "Settings live in `user_settings` / `app_settings` and the Settings UI; env vars are for secrets and infra only"
  - `backend/settings_override.json` — current 30+ non-secret values on disk that DRIFT from the CLAUDE.md principle
  - `backend/app/models/user_settings.py:2-4,27,340` — current loader: ".env → settings_override.json (UI writes here). Priority: settings_override.json > .env" — explicit doc that the file overrides env
  - `backend/app/config.py::MODEL_CAPABILITIES` — model registry currently lives as Python literal in code (no admin tunability)
  - `backend/app/config.py::Settings.llm_call_timeout_overrides` — operator override as a comma-separated env string (works but ergonomically poor)
  - v3.1 PRD §6 (`.planning/PRDs/v3.1.md:47`) — already plans `model_capabilities_overrides` DB table + admin UI editor (closes part of this seed)
  - v3.1 PRD §7 (`.planning/PRDs/v3.1.md:48`) — already plans Provider key management UI with "never write back to settings_override.json" explicit fix for secrets
  - SEED-012 — admin-operator-ui-completeness (v3.1's parent seed; this seed expands its scope)
  - SEED-023 — adaptive per-call timeouts (sibling — both want runtime-tunable knobs without redeploys)

re_open_triggers:
  - When v3.1 plan-phase opens (highest-priority trigger — this seed MUST be folded in or explicitly deferred before v3.1 phases start)
  - Any user-reported security concern related to secrets/config persistence
  - Any operator who hand-edits `settings_override.json` in production (sign that admin UI surface is missing)
  - Multi-tenancy planning (v3.2) — a JSON file on disk doesn't survive multi-tenant deployment patterns
  - When `settings_override.json` file diverges between local dev and production (drift inevitable, just a question of when)
  - **Reinforced 2026-06-01 (discuss-093):** the harness stale-model bug (F9) traced to scattered model-resolution — `override_provider` (`models/user_settings.py:514`) updates provider/key/base-url but NOT `llm_model`, and the cross-provider safety net (`resolve_sub_agent_model_safely`) was dead code reading a non-existent field (`llm_models` vs `available_models`). Phase 093 adds a contained shared model-resolver (resolve-don't-mutate) as the immediate root-fix; this seed owns the WIDER theme the operator raised — admin/full controllability over model + settings across ALL features at scale (also SEED-012). Re-open when the v2.9 admin/operator role tier is scoped.

priority: HIGH (security/architecture concern; affects v3.1 scope directly)
suggested_phase: Fold into v3.1 plan-phase OR ship as a v2.6 polish phase before v3.0 starts (e.g., 081.x or 082.x). Cannot defer past v3.1 close.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-024 — Settings & runtime-config architecture unification

## What we observed

Current settings live in **five places** with overlapping precedence:

| Source | Contents | Writable how? | Risk |
|---|---|---|---|
| `backend/.env` | Secrets (API keys), infra (DSNs, Redis URL), some operational toggles (`LLM_CALL_TIMEOUT_OVERRIDES`) | Hand-edit + restart | Correct for secrets; mismatched for operational toggles |
| **`backend/settings_override.json`** | **30+ non-secret values** — LLM provider/model, embedding model, retrieval params, rerank config, model lists per provider, `context_window_max_tokens`, `sub_agent_max_output_tokens`, `sub_agent_model`, `llm_max_output_tokens` | **UI writes here; bypasses .env** | **Drift from CLAUDE.md principle; not multi-tenant-safe; single-deploy file** |
| `user_settings` table (Supabase, RLS) | Per-user prefs | UI per user | Correct |
| `app_settings` table | Global feature toggles (extraction engine defaults) | Manual SQL today; v3.1 admin UI planned | Correct shape, sparse content |
| `MODEL_CAPABILITIES` dict in `config.py` | Model registry (provider, native_tools, per-call timeout, max output tokens) | Code change + redeploy | Bad — needs runtime tunability for v3.1 admin |

The middle row is the problem. `settings_override.json` is:

- **Architecturally inconsistent** with CLAUDE.md's stated principle (`Settings live in user_settings / app_settings`)
- **Single-file fate** — delete the file, lose all your tuning
- **Not multi-tenant** — a single JSON file can't represent per-org config (org-level deferred per [[project_org_level_deferred]] but coming in v3.2)
- **Not auditable** — no `updated_by` / `updated_at` / `updated_from` columns; no rollback
- **A latent attack surface if writable from the wrong context** (mitigated today by it being filesystem-local, but the moment any HTTP write path lands on the file, it's a file-system-write-from-web-input pattern that becomes hard to audit)
- **Frictioned for ops** — operators edit JSON manually for things that should be Admin UI affordances; the v3.1 PRD already calls this out as a `CONCERNS.md:81-83` finding for API keys but doesn't extend the same fix to non-secret values

## What v3.1 already plans (good — this seed expands, not replaces)

The v3.1 PRD `.planning/PRDs/v3.1.md` already commits to:
- `model_capabilities_overrides` table — admin-editable overrides on top of MODEL_CAPABILITIES; hot-reload TTL cache (§6)
- Provider key management UI with secrets-store binding — explicit "**never** back to settings_override.json" rule (§7)
- Sandbox config UI rows inside `app_settings` (§Theme G)
- Operator audit log for every admin shell action (§Theme F)
- New `operator_users` role tier (super_admin / operator) above users
- Settings page redesign deferred to v3.0 Skill Studio (but the user-vs-operator tier separation happens here)

**Gap:** v3.1 PRD enumerates model-capability overrides and provider keys but DOES NOT enumerate the rest of `settings_override.json`. The user's specific named gaps (title drafting, sub-agents, context window) are NOT in v3.1 scope as currently written.

## What this seed adds on top of v3.1

### 1. Eliminate `settings_override.json` outright

Categorize every key in the current JSON file and route it to the correct home:

| Key | Today | Should be |
|---|---|---|
| `llm_provider`, `llm_model` | settings_override.json | `app_settings` (deployment default) + `user_settings` (per-user override) |
| `embedding_model`, `embedding_dimensions` | settings_override.json | `app_settings` only (changing per-user breaks the vector index — global is right) |
| `rerank_*` | settings_override.json | `app_settings` (admin tunes globally) |
| `retrieval_top_k`, `retrieval_match_threshold`, `hybrid_search_enabled`, `hybrid_candidate_count`, `vector_search_weight`, `keyword_search_weight`, `rrf_k` | settings_override.json | `app_settings` + per-user override allowed |
| `web_search_max_results`, `web_search_enabled`, `sandbox_enabled` | settings_override.json | `app_settings` only (operational toggles) |
| `openai_models`, `anthropic_models`, `google_models`, `openrouter_models`, `ollama_models` | settings_override.json (CSV strings) | `model_capabilities_overrides.enabled` boolean per row (already v3.1-scoped — extend to cover allow-listing) |
| `context_window_max_tokens` | settings_override.json | `model_capabilities_overrides.context_window_tokens` per-model (NOT a single global; varies per model) |
| `sub_agent_model`, `sub_agent_max_output_tokens` | settings_override.json | `app_settings.sub_agent_config` (JSONB) — see §3 |
| `llm_max_output_tokens` | settings_override.json | `model_capabilities_overrides.max_output_tokens` per-model (SEED-009 closes this; extend coverage) |
| `openrouter_tool_strategy` | settings_override.json | `app_settings.openrouter_tool_strategy` (single global) |
| `ollama_base_url` | settings_override.json | Borderline — has infra characteristics; keep in `.env` as `OLLAMA_BASE_URL` |
| `embedding_base_url` | settings_override.json | Borderline — keep in `.env` as `EMBEDDING_BASE_URL` |

After migration: `settings_override.json` is DELETED from the repo. Loader at `user_settings.py:27` removed. CLAUDE.md principle holds.

### 2. Migration path (backward-compat without leaving the file behind)

One-shot migration runs on first startup after the change:
1. If `settings_override.json` exists, read it once, write each key to its new home, log `"Migrated <key>=<value> from settings_override.json → app_settings"`, then RENAME the file to `settings_override.json.migrated` (don't delete — operator artifact for rollback).
2. New code path reads only from DB tables; old file path removed.
3. v3.1 admin UI exposes everything that used to be in the JSON.

### 3. Admin scope expansion — the user-named knobs that v3.1 PRD doesn't enumerate yet

| Knob | Where today | Admin tier | Per-user override? |
|---|---|---|---|
| **Title drafting model** | hardcoded in `backend/app/services/title_service.py` (verify on plan-phase) | global default in `app_settings.title_drafting_config` | no |
| **Title drafting prompt template** | hardcoded | global default in `app_settings.title_drafting_config.prompt_template` | no |
| **Sub-agent model** | `settings_override.json::sub_agent_model` | `app_settings.sub_agent_config.model` | maybe per-user (sub-agent personalization tier — v3.0 Skill Studio adjacent) |
| **Sub-agent max output tokens** | `settings_override.json::sub_agent_max_output_tokens` | `app_settings.sub_agent_config.max_output_tokens` | no |
| **Sub-agent system prompt** | hardcoded in `backend/app/services/sub_agent_service.py` (verify) | `app_settings.sub_agent_config.system_prompt` | no |
| **Per-model context window** | `MODEL_CAPABILITIES.<model>.context_window_input_tokens` + `settings_override.json::context_window_max_tokens` global override | `model_capabilities_overrides.context_window_tokens` (already in v3.1 — extend) | no |
| **Per-call timeout** | `MODEL_CAPABILITIES.<model>.llm_call_timeout_seconds` + `LLM_CALL_TIMEOUT_OVERRIDES` env CSV | `model_capabilities_overrides.llm_call_timeout_seconds` (already in v3.1) | no |
| **Token streaming defaults** | `stream_options={'include_usage': True}` hardcoded (Phase 073) | `app_settings.token_capture_enabled` boolean (default true; admin can disable for cost optimization in v3.4 if false-positive cost) | no |

Each gets a row in the admin shell's "Behavior" section (new — distinct from the existing v3.1 themes A-K).

### 4. Audit + observability requirements

- Every admin write to `app_settings` / `model_capabilities_overrides` / `user_settings` writes to `operator_audit_log` (v3.1 already plans this — confirm extension covers these tables)
- Admin UI shows current value, default value, last-changed-by, last-changed-at
- "Restore default" affordance per row — clears the override row (null check on read path)

### 5. Hot-reload pattern (locked from v3.1's `_TTL_CACHE` precedent)

All DB-backed settings reads go through a short-TTL cache (~30s, matches `backend/app/models/user_settings.py:27` `_TTL_CACHE`). Admin writes invalidate the cache row for the changed key only. No global cache flush. No process restart needed.

### 6. Chat-UI ModelPicker surfacing for user-added custom model↔provider mappings

(Added 2026-05-23 — operator question raised after Phase 075.4 context-gathering.)

Once the admin UI lets any model_id be bound to any provider (with `model_capabilities_overrides` as the data layer), the chat-area ModelPicker needs to decide how custom user-added mappings appear:

| Surfacing option | Description | Trade-off |
|---|---|---|
| Fold into provider group | Custom `gpt-5.5-mega` mapped to `openai` shows up inside the "OpenAI" section alongside built-in models | Cleanest UX; user thinks in provider→model. Loses visibility into "this is a user-added entry" |
| New "Custom" / "Other" category | All user-added mappings collected under a "Custom" section regardless of provider | Visible audit signal ("I added this"); easier to spot a typo. But forces the user to remember which group "their" model lives in |
| Both (provider group + Custom-marker badge) | Show in the provider's group with a small "custom" badge | Best of both worlds; ~10 LOC extra in the picker. **Recommended** |

Decision deferred to `/gsd:discuss-phase 081.1`. Reference at plan-phase time so the admin-UI scope includes the chat-UI display shape, not just the data layer.

**Related Phase 075.4 context:** Phase 075.4 Plan 02 sweep is the prerequisite — 081.1's DB-backed registry replaces `MODEL_CAPABILITIES` cleanly only because Plan 02 routed all 7 hardcoded sites through `get_model_capability()`.

## Scope question for whoever picks this up

**Option A — Fold into v3.1 plan-phase.** v3.1 already touches the same surfaces (admin shell, `model_capabilities_overrides`, audit log). Adding `app_settings` rows for title-drafting + sub-agent + `settings_override.json` migration is a natural extension. Cost: v3.1 grows by ~2-3 plans.

**Option B — Ship a v2.6 polish phase first (recommended).** Phases 077-082 are the remaining v2.6 slots. A small new phase "Settings architecture unification" lands the migration + folds non-secret values into `app_settings` BEFORE v3.0 starts. v3.1 then inherits the clean foundation. Cost: 1 new v2.6 phase (~3-4 plans). Benefit: v3.0 Skill Studio (and Phase 074-082 polish work) gets to consume clean DB-backed settings, not a JSON file.

**Option C — Defer entirely to v3.1.** Risk: every phase that touches settings between now and v3.1 close (v2.6 polish + v3.0 Skill Studio) keeps writing to `settings_override.json`, deepening the migration debt. Not recommended.

User preference recorded at planting: lean toward **Option B**. The seed says "do this BEFORE multi-tenancy" (v3.2) and "don't let v3.0 inherit the JSON file." If v3.0 plan-phase opens with `settings_override.json` still in the tree, the seed re-opens with high priority.

## Spike candidates before commitment

1. **Audit `settings_override.json` consumers** — every place that reads a key from `_OVERRIDE_FILE`. Map each one to its new home. Confirm no consumer needs synchronous load-at-import (which would break the DB-backed pattern).
2. **Title-drafting + sub-agent code audit** — confirm where these prompts/models actually live today (mostly hardcoded?), so the migration knows what to migrate vs. what to net-new.
3. **`app_settings` schema delta** — current `app_settings` is a single-row table (per memory). Either keep single-row with JSONB columns OR move to key-value shape. Decision needed before plan-phase.
4. **Hot-reload cache invalidation contract** — exact API for "I changed key X, invalidate caches" (Pub/Sub via Redis? Direct cache.invalidate(key) call? Whichever survives multi-worker).

## Strengthen — 2026-06-10 alignment sweep (Phase 101, workflow wf_13ed5033)

This unification leaves one boundary under-specified: which values *legitimately* stay env-only and require a process restart, versus which only live in `.env` today by accident and should become hot-reloadable through `app_settings`. Operators currently discover that distinction by trial-and-error — they change a value, nothing happens, and they have to guess whether a restart is required. That guessing is the operational tax this seed must eliminate alongside deleting `settings_override.json`.

**New deliverable — full env-var classification inventory.** Produce a complete, per-variable inventory of every operational env var the backend reads, classifying each one as either:

- **Legitimately env-only / restart-required** — secrets and connection material (provider API keys, `SUPABASE_*`, DSNs, `REDIS_URL`, embedding/Ollama base URLs), and process-shaping knobs that genuinely cannot hot-reload because they bind at worker startup: `WORKER_COUNT` (forks uvicorn workers — D-PRD-12), `SANDBOX_ENABLED` (gates the Docker sandbox subsystem at import), and the AnyIO threadpool ceiling (the `run_in_threadpool` capacity limit — D-v2.5-01 — set once at process boot). These are correctly env-only; the inventory's job is to *say so explicitly* so nobody tries to migrate them into `app_settings` and nobody waits for a hot-reload that will never come.
- **Should-be hot-reloadable via `app_settings`** — everything operational that has no startup-binding reason to stay in env: the retrieval/rerank/web-search/timeout knobs and the rest of the `settings_override.json` migration targets already enumerated above.

**Surfacing requirement (two homes, same truth):**

1. **OPERATOR.md** carries the inventory as the canonical reference — one table, every var, its classification, and (for the restart-required rows) a one-line reason it cannot hot-reload. This is where an operator reads *before* changing anything.
2. **The v3.1 admin shell** marks each surfaced setting per-row as **`live`** (takes effect on next read via the short-TTL cache / invalidation contract in §5) vs **`restart required`** (the operator must bounce the workers). Pair this with the per-row "current / default / last-changed-by / last-changed-at" affordances from §4 so the restart expectation is visible at the point of edit, not buried in docs.

The inventory feeds directly off the §1 categorization table and the §3 admin-scope rows — every row that lands in `app_settings` should carry a `live` marker; every row the inventory pins as env-only should carry a `restart required` marker (and ideally not be editable in the shell at all, just documented).

**Cross-link — SEED-078 (unified runtime feature-flag / kill-switch / maintenance-mode):** the `live` marker and SEED-078's flags ride the *same hot-reload substrate* — the short-TTL cache + targeted invalidation contract from §5. A feature flag, a kill-switch, a maintenance-mode toggle, and a hot-reloadable `app_settings` knob are all "change a DB-backed value, have it take effect within seconds across all workers, without a restart." Build that substrate once and both seeds consume it; the env-var inventory's `live`-vs-`restart` distinction is exactly the line SEED-078's kill-switches must land on the `live` side of (a kill-switch that needs a restart is not a kill-switch). Co-scope the hot-reload primitive when either seed is picked up.

Sibling cross-links: SEED-012 (admin/operator UI — this inventory is a concrete admin-shell deliverable), SEED-003 (deployment flexibility — env-only classification is what makes the local↔cloud env-var switch legible), SEED-001 (scale readiness — `WORKER_COUNT`/AnyIO-ceiling are the scale knobs the inventory must explain), and SEED-004 (org multi-tenancy — restart-required env vars are deployment-global and can't be per-org, which the inventory should flag for the v3.2 multi-tenant pass).
