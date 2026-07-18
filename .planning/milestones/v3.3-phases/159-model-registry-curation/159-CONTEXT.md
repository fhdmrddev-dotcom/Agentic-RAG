# Phase 159: Model Registry Curation - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator can curate the model registry without wading through hundreds of irrelevant models. Live discovery (the Phase-149 concurrent fan-out to the 8 cloud providers' `/models`) is **filtered to chat/tool-capable models by default** — the utility noise (embeddings, audio, image, moderation, rerank, transcription) is hidden, with a "show all" opt-in — so the operator sees ~a dozen relevant proposals instead of the ~401 flat entries the raw fan-out returns today. And the operator can **add one new model by ID directly** — type the id, pick the provider, set its capabilities (context window, max output, native tool support) with sensible per-provider-family defaults pre-filled — without running a full discovery pass, generalizing the one-off GPT-5.6 hand-add (SEED-088) into a first-class UI path.

Delivers (MODEL-03, STRETCH): (1) a suitability filter on the live discovery panel (071-A / `ModelDiscoveryPanel`), default-on, persisted, "show all" opt-in; (2) a dedicated "+ Add model by ID" affordance in the registry tab (070-A / `ModelRegistryTab`) that writes a DB-only `model_capabilities_overrides` row landing `enabled=false`; (3) source-labeled capability pre-fills (provider-returned > family-default > blank) on both the add-by-ID form and the discovery-confirm hand-fill.

Does NOT deliver: any change to the shipped 149 discovery mechanics/registry-editor beyond the filter + defaults; registry-table search (the table is already curated — built-in ∪ overrides ∪ confirmed); local-provider discovery (Ollama/LM Studio — still out per D-149-14); advanced routing-facet editing (emit_tier/max_tools/parallel/prefill/strict_json — v3.4, D-149-06); per-user model preference (v3.4, D-149-07); the OpenAI Responses-API adapter (SEED-114). This is a **curation/UX layer on the shipped Phase-149 write-path + discovery service — not new plumbing.**

Companion already shipped: the model-icons picker polish (provider + model `@lobehub` logos in the composer + Settings model list) landed ad-hoc as commit `0d81d088` (2026-07-18) and is NOT re-scoped here.

</domain>

<decisions>
## Implementation Decisions

### Discovery suitability filter
- **D-159-01 (filter = exclude-list, LIFTED from `curate_models.py`, NOT a family-allowlist):** Reuse the proven `_MISSING_EXCLUDE` regex already in `scripts/curate_models.py` (`embed|whisper|tts|audio|realtime|image|dall-e|moderation|transcribe|rerank|…`) as the starting point, lifting it into the live `model_discovery_service`. Hide matches by default; show everything else. Chosen over a flagship-family allowlist specifically so a **brand-new chat family is never wrongly hidden** the day it drops (false-negatives are worse than a few extra rows). The filter is a pure **display/curation** concern — it never auto-enables, never auto-deletes, never mutates the diff the operator confirms (149's "Discovery proposes, humans confirm" red line is untouched). **⚠ Research/plan nuance:** the `curate_models.py` regex was written for `CURATE_MISSING` (registry-gap flagging) and also excludes `chatgpt|instruct|codex|davinci|babbage` — some of those (e.g. `chatgpt-4o-latest`) ARE valid chat models. The planner must tune the final set for the *chat-filter* purpose with real evidence from a live discovery pull (keep the true non-chat utility excludes; re-examine the chat-legacy tokens). DRY the final regex to ONE shared source so it can't drift between `curate_models.py` and the service.
- **D-159-04 (filter scope = discovery-panel-only + persisted operator toggle):** The filter lives ONLY in the discovery panel (071-A / `ModelDiscoveryPanel`) — that is where the ~401 live. Default-on. Persisted as an operator-governed `app_settings` key (Control-Room layer per D-149-01) so it survives sessions and workers (TTL-cache rideable). A "show all" opt-in toggle reveals the hidden utility models with the hidden-count shown (honest: "N utility models hidden"). The registry table (070-A / `ModelRegistryTab`) is UNCHANGED — it already shows only built-in ∪ overrides ∪ confirmed (already curated); NO registry-table search this phase.

### Add model by ID
- **D-159-02 (add-by-ID = dedicated form in the registry tab):** A "+ Add model by ID" affordance in `ModelRegistryTab` (070-A idiom): model id (text) + provider (the native-7 + OpenRouter roster) + the 3 capability knobs (context window, max output, native tools) [+ optional deprecated/note]. It writes a **DB-only row** into `model_capabilities_overrides` — the D-149-03 path that already works end-to-end with ZERO code edits (`get_model_capability_async` builds the inferred base + overlays DB fields). The new model lands **`enabled=false`** (149's opt-in-enable rule) → operator enables explicitly. This is the operator's concrete ask ("Kimi K3 dropped — add it with the correct context/output/tools") and generalizes the SEED-088 GPT-5.6 hand-add. Discovery stays the "show me what's new" path; this is the "I already know the exact id" path. Graded-guards + `✎` receipt on the write, per 146-149 conventions.

### Capability defaults
- **D-159-03 (capability pre-fill = hybrid, source-labeled):** On BOTH the add-by-ID form and the discovery-confirm hand-fill, pre-fill each capability with precedence: **provider-returned value** (where the `/models` endpoint gave it) → **per-provider-family default** (a small context/output/tools default table, family inferred from provider/id) → **blank** (149's amber "unknown — you set it"). Each source is VISUALLY DISTINCT: provider-confirmed vs `default — confirm` vs operator-typed. The default is a **pre-fill the operator reviews, never an auto-enable** — the model still lands disabled + explicit enable, so SC#3 honesty ("never silently guess a capability the provider didn't return") holds while the "hand-type every field" friction is removed. Tools default is inferred from family (known tool-capable families → suggested `true`, clearly labeled, still operator-confirmed). Reuse the family-inference idiom from `config.py` inferred-defaults + the just-shipped `modelLogo` substring→family mapping (`frontend/src/lib/providerLogo.tsx`).

### Reported-bugs cross-check
- **BUG-260714-01 (gpt-5.6 parameter error → gpt-4o fallback):** overlaps `backend/model-registry` in `affected_areas`, surfaced per the mandate → **LEFT OPEN (not folded).** Root cause is a provider parameter the OpenAI adapter sends (a routing/param-handling bug), not registry curation; it belongs with the OpenAI-adapter work (SEED-114 / D-149-16), not this phase. Operator agreed (2026-07-18).

### Claude's Discretion
- Exact `app_settings` key name + shape for the persisted filter toggle (TTL-cache-rideable; Control-Room-governed per D-149-01).
- The per-provider-family default table's exact values (context/output/tools per family) — sensible modern defaults, editable; derive from `config.py` MODEL_CAPABILITIES + `frontend/src/lib/model-info.ts` patterns.
- Where the shared filter regex lives (one importable constant so `curate_models.py` and the service can't drift) + the exact final chat-filter token set (D-159-01 nuance — evidence-based).
- The add-by-ID form's placement/shape in `ModelRegistryTab` (header button → inline row vs modal vs expandable) — follow the 070-A instrument-table idiom + graded-guards + receipt conventions.
- Whether a migration is needed (likely just an `app_settings` key for the toggle; the model rows already exist via mig 053/099) — numbering from the live tree at planning + full-schema regen + cloud-parity note.
- Audit receipt vocabulary for the add-by-id write (e.g., `✎ model.added` vs reuse `✎ model.capability.set`) — 146 D-03 plain-sentence labels.

### Reviewed Todos
- `spike-nl-workflow-authoring.md` — matched on the generic keyword "run"/"add" only; it belongs to the workflow-authoring cluster, NOT model-registry (same disposition as 149). Reviewed, not folded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's scope + the upstream contract it extends
- `.planning/ROADMAP.md` §Phase 159 — the three success criteria (filter / add-by-id / newest-first honesty preserved)
- `.planning/REQUIREMENTS.md` — MODEL-03 (STRETCH) + the "Auto-enabling discovered model capabilities" anti-scope row (the red line this phase must not cross)
- `.planning/phases/149-model-registry-discovery/149-CONTEXT.md` — the DIRECT predecessor: D-149-01 two-layer governance, D-149-03 DB-only-rows-work, D-149-11/12/13 discovery lifecycle + new-models-land-disabled + opt-in-enable, D-149-14 8-cloud-keyed scope, the 070-A/071-A locked UI contract, SC#3 honesty (amber "unknown — you set it")

### Approved design (149's G-2 gate — the UI idiom this phase extends, do not re-litigate)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — RDD 60 (070-A instrument table + inline edit + OVR/DEF + lock + coupling chip) and RDD 61 (071-A propose→confirm diff list + "unknown — you set it" + vanished-not-deleted); RDD 48 (icon convention, now extended by the shipped model-icons). Load before touching `ModelRegistryTab`/`ModelDiscoveryPanel`.

### Code + schema precedents (the reuse surface — this is a lift, not a rewrite)
- `scripts/curate_models.py` — **the `_MISSING_EXCLUDE` regex (lines ~104-109) + the flagship-family include filters (lines ~88-91) are the suitability-filter source** (D-159-01); also PROVIDER_ENDPOINTS + per-shape extractors + newest-first sort
- `backend/app/services/model_discovery_service.py` — the live fan-out service that today returns ALL ids unfiltered; D-159-01 wires the filter in here
- `backend/app/config.py` — `MODEL_CAPABILITIES`, `get_model_capability`/`get_model_capability_async` (~line 680, the DB-only-row overlay path add-by-ID rides), inferred-defaults (the family-default source for D-159-03)
- `supabase/migrations/053_settings_unification.sql` + `099_*` — `model_capabilities_overrides` (model_id PK, provider, context_window_tokens, max_output_tokens, native_tools, enabled, deprecated) — add-by-ID writes a row here; no new model-row columns expected
- `backend/app/api/admin.py` — the operator router (`require_operator` + `operator_audit_floor`); the add-by-ID + filter-toggle endpoints join it
- `frontend/src/components/admin/ModelRegistryTab.tsx` — the 070-A editor; hosts the "+ Add model by ID" form (D-159-02)
- `frontend/src/components/admin/ModelDiscoveryPanel.tsx` — the 071-A discovery surface; hosts the filter toggle + "show all" (D-159-04)
- `frontend/src/lib/providerLogo.tsx` — the just-shipped `modelLogo(id)` substring→family mapping (reuse for the family-default inference in D-159-03) + the model-icons already on these surfaces
- `frontend/src/lib/model-info.ts` — the per-model context/output/costTier table (a family-default reference)

### Cross-cutting rules
- `backend/app/models/user_settings.py` — `_load_model_overrides` TTL cache the filter toggle + new rows ride (WORKER_COUNT=2; "next request, no restart")
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud parity for any new `app_settings` row / migration
- `CLAUDE.md` — migrations via Supabase SQL editor (never db push/reset) → `bash scripts/regenerate-full-schema.sh`; run_in_threadpool for supabase-py in async handlers

### Folded/deferred bug
- `.planning/reported-bugs/BUG-260714-01-gpt56-model-parameter-error.md` — LEFT OPEN (not folded; provider-param root cause → SEED-114/D-149-16, not curation)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The filter regex already exists** — `scripts/curate_models.py:_MISSING_EXCLUDE` + family-include filters. D-159-01 lifts it into `model_discovery_service.py` (tuned for the chat-filter purpose). This is the phase's single biggest de-risker: the curation logic is proven, only the wiring + toggle is new.
- **DB-only model rows already work end-to-end** — `get_model_capability_async` (`config.py:~680`) overlays DB fields on the inferred base, so an add-by-ID row needs ZERO code edits to take effect (D-149-03). Add-by-ID is a write into what the read path already serves.
- **The 070-A/071-A surfaces exist** — `ModelRegistryTab` (add-by-ID form home) + `ModelDiscoveryPanel` (filter toggle home) are shipped; this phase adds affordances, not new surfaces.
- **`modelLogo(id)` family mapping** (`providerLogo.tsx`, shipped `0d81d088`) — the substring→family idiom to infer per-family capability defaults (D-159-03).
- **Family-default sources** — `config.py` inferred-defaults + `model-info.ts` (context/output/costTier per model) seed the default table.

### Established Patterns
- **Propose-not-auto-enable (149 red line):** the filter hides, never enables; add-by-ID + discovery-confirm both land `enabled=false`; pre-filled defaults are operator-reviewed, never silent.
- **Two-layer governance (D-149-01):** the persisted filter toggle is a Control-Room / operator-governed `app_settings` knob, not a per-user setting.
- **Source-honesty (149 amber "unknown — you set it"):** D-159-03 keeps three visually-distinct capability sources (provider-confirmed / default-suggested / operator-typed).
- **Multi-worker TTL cache (WORKER_COUNT=2):** filter toggle + new rows propagate within the TTL window; no restart (SC#1 precedent from 149).
- **Graded guards + `✎` receipts** (146-149) on the add-by-ID write; `run_in_threadpool` for supabase-py; migrations via SQL editor + full-schema regen + cloud-parity.

### Integration Points
- `model_discovery_service` fan-out result → the new filter pass (default-on) → `ModelDiscoveryPanel` render (+ "show all" toggle reading the persisted `app_settings` key).
- `ModelRegistryTab` "+ Add model by ID" form → `admin.py` write → `model_capabilities_overrides` upsert → immediately live via `get_model_capability_async` (enabled=false until opt-in).
- The per-provider-family default table → both the add-by-ID form and the discovery-confirm hand-fill.

</code_context>

<specifics>
## Specific Ideas

- The filter is a **lift of an existing proven regex**, not a new design — frame the plan around "wire + tune + toggle", not "invent a classifier".
- The operator's concrete driving case (verbatim intent): "Kimi K3 just dropped — let me add it with the correct context window, correct max output, correct tool-call support" → the dedicated add-by-ID form (D-159-02), fast, no 401-scroll.
- "Show all" must show an honest hidden-count ("N utility models hidden") so the filter never feels like it's silently swallowing models.
- Capability defaults must never read as authoritative — `default — confirm` styling distinct from provider-confirmed; the operator is deliberately adding + reviewing, so a suggested `tools=true` is fine ONLY when clearly labeled and still landing disabled.
- Companion model-icons (provider + model logos in composer + Settings) already shipped `0d81d088` — the registry/discovery surfaces already carry the marks; do not re-scope.

</specifics>

<deferred>
## Deferred Ideas

- **Flagship-family allowlist tightening toggle** (Q1 alternative) — considered; deferred unless the exclude-list proves insufficient in practice (re-open trigger: operator reports the filtered discovery is still too noisy).
- **Registry-table search/filter** (070-A) — deferred; the registry is already curated. Re-open if the enabled registry grows large enough to need in-table find.
- **Live capability probing** (send a test tool-call to detect `native_tools` instead of family-default + confirm) — out; defaults + operator confirm is enough and cheaper.
- **Local-provider discovery** (Ollama `/api/tags`, LM Studio `/v1/models`) — still out (env-specific local state, D-149-14).
- **Advanced routing-facet editing** (emit_tier, max_tools, parallel, prefill, strict_json) → v3.4 config-consolidation (D-149-06).
- **Per-user model preference within the allowed set** (revive `user_settings.preferences`) → v3.4 (D-149-07).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched on a generic keyword only; belongs to the workflow-authoring cluster, not model-registry. Reviewed, not folded (149 precedent).

</deferred>

---

*Phase: 159-model-registry-curation*
*Context gathered: 2026-07-18*
