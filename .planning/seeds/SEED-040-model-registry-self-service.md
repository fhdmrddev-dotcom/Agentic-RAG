---
id: SEED-040
status: dormant
planted: 2026-05-30
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 089/090 cross-provider debugging)
trigger_when: A new model needs a config.py code edit (or manual DB insert) to get correct capabilities, OR provider_model_lists drifts from a provider's live /models, OR an admin/operator-UI / settings-unification milestone is scoped
trigger_fired: 2026-07-22 (Phase 175 — gpt-5.6 reasoning models needed config.py `reasoning_first`/`reasoning_off` edits; the DB-override tier does NOT cover these flags and the routing seams bypass the DB entirely — see 2026-07-22 update)
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

## Update 2026-05-31 — Named Layer-2 use case: OLLAMA / LOCAL MODELS per-model `native_tools` toggle

Concrete, operator-raised example that the Layer-2 no-code capability override (scope item #2 above) is *designed* to solve. Surfaced during Phase 090 operator-testing-notes triage: the operator noted ollama was never tested (no local resources for models larger than ~4B) and said it "should work like deepseek/moonshot."

**The direction:**

- Modern local models (`llama3.x`, `qwen2.5+`, etc.) **DO** support OpenAI-style tools. So in principle ollama can tool-call.
- BUT ollama's **PROVIDER default stays `native_tools=False` ON PURPOSE** (`backend/app/config.py:305-306`). This is deliberate, not an oversight: local models served via ollama are **heterogeneous** — the same endpoint can serve a capable `llama3.x` or a tiny 4B model that *narrates fake tool calls* instead of emitting real ones. A model that fakes tool calls is **worse** than a model we never sent tools to (the user gets confident-looking output with zero actual tool execution). That is the exact same trap that hit `minimax-m2.7` — see the registry-trap notes above and [[SEED-034]].
- Because the provider is heterogeneous, the RIGHT granularity is **PER-MODEL, not per-provider** — which is precisely what this seed's `model_capabilities_overrides` write-UI provides. The read half already merges a DB-supplied `native_tools` value on the hot path (`backend/app/config.py:562-566` inside `get_model_capability_async`), so flipping a *specific* ollama model (e.g. `llama3.3:70b`) to `native_tools=True` needs **ZERO code** — just one row in `model_capabilities_overrides`.

**The framing for the operator:** ollama earns tool-calling **per-model** via the override toggle — the operator-facing equivalent of "behaving like deepseek/moonshot." The difference is that deepseek/moonshot get tool-calling by **provider default** because their *hosted* endpoints uniformly support tools (every model behind that provider is known to tool-call), whereas ollama serves a mixed bag, so the operator opts each capable local model in deliberately.

This is also the cleanest answer to the "ollama untested" gap: rather than blanket-flipping the ollama provider default (which would re-arm the fake-tool-call trap for tiny models), the operator validates and flips capable local models one at a time through the same toggle UI everyone else uses.

**Evidence gate (per [[SEED-034]]):** before flipping any ollama/local model's `native_tools` override to `True`, validate via the cross-provider eval harness that the model emits **real** tool calls (not narrated ones). The flip must be evidence-gated, not assumed — see the SEED-034 onboarding-checklist cross-reference added the same day.

Breadcrumbs for this use case: `backend/app/config.py:305-306` (ollama provider default `native_tools=False`), `backend/app/config.py:562-566` (`get_model_capability_async` merges DB override), related [[SEED-034]] (per-provider tool-use + new-model onboarding checklist + eval harness).

## Update 2026-07-22 — TRIGGER FIRED in Phase 175: the DB-override tier is too narrow AND the routing seams bypass it (operator-raised, again)

Phase 175 (Cross-Provider Streaming Fidelity) is a **textbook instance of this seed's trigger** — and the operator raised the pain directly: *"we want it to be native when we discover new models and we add it; it should take minimal effort to add it from the UI rather than just fixing in the code."* Phase 175 fixed it in code. It shouldn't have had to.

**What Phase 175 exposed (two structural gaps beyond the missing write-UI already documented above):**

1. **The DB-override overlay is a fixed 5-field allow-list — the behavioral capability flags are NOT in it.** `get_model_capability_async` (`config.py:700`) only overlays these DB fields onto the static defaults:
   ```
   llm_call_timeout_seconds, context_window_tokens, max_output_tokens, native_tools, deprecated
   ```
   Phase 175 added TWO new capability flags that decide correct streaming/routing behavior — **`reasoning_first`** (route reasoning-first OpenAI models like gpt-5.6 STRUCTURED so they don't 400) and **`reasoning_off`** (inject the per-model reasoning-off param so a reasoning model produces a real chat title instead of the degenerate first-few-words fallback) — and **neither is in the overlay list**. So even a perfect `model_capabilities_overrides` row cannot express them; they can ONLY be set by hardcoding a per-model entry in `MODEL_CAPABILITIES` (`config.py:253`). When the write-UI ships (scope item #2), its field set must be **extended** to these behavioral flags, not just the 5 above — and ideally be schema-driven off the `ModelCapability` TypedDict so a future flag is UI-editable by construction.

2. **The routing seams read the SYNC resolver, which has NO DB tier at all.** `resolve_calling_mode` (`openai_service.py:1662`) and the title-gen seam both call the SYNC `get_model_capability` (`config.py:529`) → exact-match static dict, else pattern inference. The DB override is `async`-only. So even the 5 fields that ARE UI-editable never reach the calling-mode / title-gen decisions. Any "capabilities from the Registry" work must also route these hot seams through a DB-aware resolver (or a warm cache) — otherwise the UI edits are silently inert at exactly the seams that matter for streaming fidelity.

**Inference-first is the real ergonomic win (restate + extend scope item #3).** The cleanest "add a model, zero effort" story is: `_infer_provider_for` / `_build_inferred_defaults` should recognise reasoning-first / reasoning-off *families* from the model-id + provider pattern so common new reasoning models work with **no UI action at all**, and the Registry UI is the override for the exceptions. Phase 175 hardcoded specific ids (`gpt-5.6-sol/terra/luna` for `reasoning_first`; a 13-row docs-confirmed SAFE set for `reasoning_off`) precisely because neither inference nor UI covers these yet — that hardcoded list is the debt this seed retires.

**Sharpened scope for the next registry milestone:**
- (a) Extend `model_capabilities_overrides` + the write-UI field set to the behavioral flags (`reasoning_first`, `reasoning_off`, and audit the rest of `ModelCapability` for others that belong), schema-driven where possible.
- (b) Route the calling-mode + title-gen seams through a DB-aware capability read (warm cache — no async on the hot path; mirror the `_resolve_db_native_tools` pattern already used for `native_tools`).
- (c) Teach inference the reasoning families so the common case needs no UI at all; the Registry UI overrides the exceptions.
- Acceptance bar (operator's words): discovering + adding a new reasoning model is a **UI action, not a code change**.

Breadcrumbs added this update: `config.py:700` (`get_model_capability_async` overlay field list — the 5-field allow-list to extend), `config.py:529` (sync `get_model_capability` — no DB tier; used by the routing seams), `openai_service.py:1662` (`resolve_calling_mode` reads sync), `config.py:253` (`MODEL_CAPABILITIES` static dict — where `reasoning_first`/`reasoning_off` are hardcoded today), Phase 175 (`.planning/phases/175-cross-provider-streaming-fidelity/`). Related: [[SEED-034]], the `project_dynamic_settings_direction` + `project_admin_panel_plan` memories ("everything dynamic → admin UI, except secrets").
