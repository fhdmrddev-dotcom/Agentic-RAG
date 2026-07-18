# Phase 149: Model Registry & Discovery - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator manages model capabilities from the Control Room's Model Registry tab (edit context/output tokens, timeout, native tools, enable/disable, deprecated — effective on the next request via the existing TTL cache, no restart) and runs live model discovery (concurrent fan-out to the 8 cloud providers' `/models` endpoints) that PROPOSES new/changed/vanished models for human confirmation — never silently guessing a capability the provider didn't return (SC#3). The registry becomes the single source of truth for the user-facing model picker (enabled-in-registry = shows-in-picker), and the picker itself gets a bounded visual polish (provider logos, grouped, decluttered rows). A non-operator cannot reach the model-write path (SC#4).

Delivers (MODEL-01 + MODEL-02): the 070-A capability editor (provider-grouped instrument table, inline-edit cells, OVR/DEF honesty, 🔒 lock, enabled→picker coupling chip) and the 071-A discovery propose→confirm diff list (per-provider run cards, ✚New/±Changed/⊘Vanished groups, amber "unknown — you set it" inputs, vanished-flagged-never-deleted, sticky confirm bar), inside the locked Phase-146 shell with 062-A receipts (`✎ model.capability.set`, `✎ model.discover`).

Does NOT deliver: the per-user model-preference layer (v3.4 — `user_settings.preferences` revival), advanced routing-facet editing (emit_tier, max_tools, parallel, prefill, strict_json — v3.4 config-consolidation), the OpenAI Responses-API adapter (SEED-114), secrets/provider-roster work (150), local-provider discovery (Ollama/LM Studio).

This phase PROMOTES the SEED-116 boundary decision to locked status (D-149-01 below) — the first applied instance of the two-layer pattern.

</domain>

<decisions>
## Implementation Decisions

### Boundary promotion (SEED-116 → locked; ratifies `.planning/notes/settings-control-room-boundary.md`)
- **D-149-01 (LOCKED — the three-surfaces rule + two-layer pattern):** Control Room = platform governance (allowed-set + policy + registry + secrets + audit + users + kill-switches + visibility; operator-only, 404-non-discoverable). Settings = user preferences within what the operator allows (privilege-filtered projection). Profile menu = identity (SEED-113, not this phase). For every knob: (1) operator governs allowed-set + policy in CR, (2) user picks within allowed in Settings, (3) operator can LOCK any choice, (4) knob visibility is privilege-gated (VIS-01 audience map). Models are the first applied instance. The exhaustive per-knob map is `.planning/notes/dynamic-control-inventory.md` (the living master table). No per-group greenlists in v3.3 (SEED-115 / v3.4).

### G-2 sketch gate (satisfied 2026-07-12 — the UI is LOCKED, do not re-litigate)
- **D-149-02:** Sketches **070-A** (capability editor) + **071-A** (discovery propose→confirm) are the build contract — RDD 60/61 in `sketch-findings-agentic-rag`. Provider logos = @lobehub/icons (RDD 48 icon convention); plain-first labels with ⌥ Technical names; 061-B band + 062-A receipts.

### Registry universe + deprecated
- **D-149-03 (row universe = full union):** The registry table shows built-in `config.py` MODEL_CAPABILITIES models (dim DEF rows) ∪ DB override rows (OVR) ∪ discovery-confirmed new models as **DB-only rows**. A confirmed new model works end-to-end with ZERO code edits — the read path already supports this (`get_model_capability_async` builds inferred-defaults base + overlays DB fields, `capability_source="db_override"`). `config.py` = shipped baseline; the DB = the living registry. (GPT-5.6 hand-add on 2026-07-11 was the last time a model ever requires a code edit.)
- **D-149-04 (deprecated = own column):** Add `deprecated boolean` (+ optionally a small reason/note field) to `model_capabilities_overrides` in the 149 migration. Deprecated ≠ disabled: deprecated = "provider is sunsetting / vanished from /models — warn, steer away" and can stay enabled; disabled = "operator turned it off — hidden from picker, refused."
- **D-149-05 (deprecated end-user effect = badge only):** A deprecated-but-enabled model stays selectable with a small informational "deprecated" badge in the user picker. No refusal path; only `enabled` controls availability.
- **D-149-06 (advanced facets deferred):** emit_tier, max_tools, parallel tool calls, prefill, strict_json etc. stay code-only in 149 (v3.4 config-consolidation). Optionally render read-only behind ⌥ Technical names.

### Lock semantics + picker coupling
- **D-149-07 (lock = pin org default):** Locking a model sets it as the org-wide default (writes `llm_model`) + marks the policy "locked"; when the v3.4 per-user layer arrives, locked = users cannot override. At most ONE model carries the lock. Real behavior today + forward-compatible policy, honestly stored.
- **D-149-08 (picker becomes registry-driven):** The user-facing model picker list BECOMES the registry — enabled models from the full union, grouped by provider. `provider_model_lists` (app_settings jsonb) retires or becomes a transition fallback. One source of truth: discovery → confirm → enabled → picker is one chain; no second hand-maintained list.
- **D-149-09 (guards, per the 146-148 graded-guards rule):** Disabling the current org-default (or locked) model is REFUSED with a plain explanation ("this is the org default; pick a new default first"); locked ⇒ unlock first. No dead default can ever exist. Ordinary disables stay a direct flip + ✎ receipt (reversible).
- **D-149-10 (disabled-model UX = fallback + notice):** A user's next message on a just-disabled model runs on the org default instead, with an honest inline notice ("modelX was disabled by your administrator — this reply used modelY"). Never breaks mid-conversation, never silent. Note: `enabled` exists since mig 053 but nothing enforces it today — 149 makes it real.

### Discovery run lifecycle
- **D-149-11 (sync fan-out):** One POST fans out to all keyed providers concurrently server-side (per-provider timeout ~10-15s), returns the full diff in one response. Run cards show client-side timers in flight, then per-provider verbatim errors (rate-limited = excluded-not-failed, the 058/060 lesson) and "capabilities ✓ / IDs only" badges. No new streaming/job infra (red line: no new runtime).
- **D-149-12 (proposals are ephemeral):** The diff lives in the response/UI only. Confirming applies changes immediately with receipts; navigating away discards — re-running is cheap and always fresher. No proposals table, no staleness lifecycle.
- **D-149-13 (new models land disabled + opt-in enable):** Every confirmed new model lands `enabled=false`. The confirm flow offers an "enable now" tick per model ONLY where capabilities are complete — provider-returned (Google/OpenRouter) or hand-filled in the amber "unknown — you set it" inputs. Enabling is always an explicit operator act; SC#3 preserved to the letter.
- **D-149-14 (provider scope = 8 cloud, keyed only):** Discovery covers the 8 cloud providers from `scripts/curate_models.py`; a provider with no key configured renders "no key — skipped" (honest, not failed). Local Ollama/LM Studio are out (deferred).

### Folded bug + picker polish
- **D-149-15 (BUG-260620-01 FOLDED):** Enforce the output-token clamp — a resolved `max_tokens` is capped by the model's (DB-overridable) `max_output_tokens` at the shared resolution point, so the gpt-4o 32768>16384 400 cannot recur and the edited field is honest (SC#1). Trace the failing path first (evidence rule); the clamp data already exists (`openai_service.py:1162` region).
- **D-149-16 (BUG-260711-02 DEFERRED to SEED-114 + UAT stopgap):** The Responses-API adapter is its own phase-sized work. 149 adds ONE UAT row proving the operator can flip gpt-5.6 `native_tools` off in the new UI and a tool-carrying chat then works via the prompt-injected path — doubling as the SC#1 "capability change affects routing live, no restart" proof. Re-open trigger: next OpenAI-adapter phase / v3.4 milestone sweep.
- **D-149-17 (bounded picker polish, in-149):** Since the picker's data source changes anyway (D-149-08): add provider logos (@lobehub/icons per RDD 48), group models by provider, declutter rows — model name primary, context/output info demoted to a subtle secondary line or tooltip, deprecated badge (D-149-05). Explicitly NO redesign — same component, same interaction, visual pass only.

### Claude's Discretion
- Lock storage shape (policy flag(s) beside `llm_model` in `app_settings` vs elsewhere) — must satisfy "one lock max" + survive the v3.4 per-user layer
- Where the enabled/fallback enforcement lives on the request path (and how the fallback notice is emitted to the UI — reuse an existing SSE event shape if one fits)
- Migration numbering (next free from the live tree at planning) + full-schema regen + cloud-parity notes
- Discovery diff computation details (what counts as "changed" per provider payload shape; per-provider extractors already exist in `curate_models.py`)
- Registry write API shape in `admin.py` (`require_operator` router-level + `operator_audit_floor` per-write; upsert vs field-patch semantics)
- Audit action vocabulary details beyond `model.capability.set` / `model.discover` (follow 146 D-03 plain-sentence labels)
- TTL-cache invalidation details for `_load_model_overrides` (change must be visible on next request per SC#1 — verify the existing TTL behavior suffices across WORKER_COUNT=2)
- How DEF (inherited) values render vs OVR (stored) in API responses (the editor needs both to show Reset)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The boundary decision + inventory (promoted to D-149-01 here)
- `.planning/notes/settings-control-room-boundary.md` — the SEED-116 three-surfaces rule + two-layer pattern (THE design input this phase makes binding)
- `.planning/notes/dynamic-control-inventory.md` — the living master decision table; §"Discovery ≠ full capabilities" is the SC#3 evidence base (only Google + OpenRouter return capability metadata)

### Approved design (G-2 gate satisfied 2026-07-12 — LOCKED, do not re-litigate)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Running Design Decisions **60** (070-A instrument table + inline edit + OVR/DEF + lock + coupling chip) and **61** (071-A propose→confirm diff list + "unknown — you set it" + vanished-not-deleted); RDD 48 (icon convention), 51/56 (Control Room shell + locked Model Registry tab)
- `.planning/sketches/070-model-capability-editor/` — winner A
- `.planning/sketches/071-model-discovery-propose-confirm/` — winner A

### Prior phase ground truth
- `.planning/phases/148-governance-audit-users-feature-visibility/148-CONTEXT.md` — audience/`require_visible` contract, graded guards, receipt vocabulary, no-RLS-backstop threat model
- `.planning/phases/147-operator-control-plane/147-CONTEXT.md` — `app_settings` TTL substrate + D-Q4 polarity precedent, kill-switch grid (spatial separation from non-destructive controls)
- `.planning/phases/146-operator-foundation/146-CONTEXT.md` — D-03 audit floor, D-07/D-08 shell + plain-first + ⌥ Technical names
- `.planning/ROADMAP.md` §Phase 149 — the four success criteria
- `.planning/REQUIREMENTS.md` — MODEL-01 + MODEL-02 (+ the "Auto-enabling discovered model capabilities" anti-scope row)

### Code + schema precedents
- `supabase/migrations/053_settings_unification.sql` — `model_capabilities_overrides` table (model_id PK, provider, llm_call_timeout_seconds, context_window_tokens, max_output_tokens, native_tools, enabled) — 149's migration extends it (deprecated column)
- `backend/app/config.py` — `MODEL_CAPABILITIES` (built-in registry), `get_model_capability` (sync, inferred-defaults fallback), `get_model_capability_async` (~line 680 — the DB overlay + `capability_source="db_override"` path that makes DB-only rows viable), `_SUB_AGENT_MODEL_DEFAULTS`
- `backend/app/models/user_settings.py` — `_load_model_overrides` (the TTL-cached DB read the editor must invalidate/ride)
- `scripts/curate_models.py` — PROVIDER_ENDPOINTS for all 8 cloud providers + per-response-shape extractors + newest-first sort — the discovery service lifts from here (MODEL-02 requirement text says so)
- `backend/app/api/admin.py` — the operator router (post-148); 149's registry/discovery endpoints join it (`require_operator` + `operator_audit_floor`)
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud parity for the new migration + any `app_settings` rows

### Folded/deferred bug reports
- `.planning/reported-bugs/gpt4o-max-tokens-exceeds-completion-cap.md` — BUG-260620-01, FOLDED (D-149-15); clamp data at `openai_service.py:1162` region, enforcement gap is the bug
- `.planning/reported-bugs/BUG-260711-02-gpt56-reasoning-tools-chat-completions-400.md` — DEFERRED to SEED-114 with the D-149-16 UAT stopgap row; workaround C (registry `native_tools` flip) is the stopgap 149 makes operator-serviceable

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `get_model_capability_async` (`backend/app/config.py:680`) — the read path is DONE, including the DB-only-row case (inferred-defaults base + DB overlay). 149 writes into what it already reads.
- `scripts/curate_models.py` — provider endpoints, auth headers, per-shape extractors (`_extract_openai_compat`, `_extract_minimax`, …), newest-first sort. The discovery service is a lift-and-wrap, not a rewrite.
- `backend/app/api/admin.py` — `require_operator`, `operator_audit_floor`, receipt plumbing; the Control Room frontend shell (OperatorBand, ControlRoomPage, TechnicalNamesToggle, LockedTab — the Model Registry tab unlocks)
- 070-A/071-A sketch HTML + the 112/FolderNode inline-edit pattern for numeric cells
- @lobehub/icons provider logos (Phase 127/128 single-source convention) — reuse in both the registry table and the picker polish

### Established Patterns
- **No RLS backstop on service-role admin paths** — explicit filtering; writes get deliberate ledger rows
- **`run_in_threadpool` for supabase-py calls** (D-v2.5-01) in all new admin endpoints
- **Multi-worker TTL caches (WORKER_COUNT=2)** — capability edits propagate within the TTL window identically per worker (the 147 kill-switch "on their next call" precedent); SC#1 says "next request, no restart" — verify TTL semantics satisfy it
- **Graded guards** (146-148): victim-naming sheet / arm-to-confirm / direct flip — D-149-09 applies the middle grade to default-model disable
- **Plain-first + ⌥ Technical names** — field labels plain; raw column names behind the toggle
- **Migrations:** numbered SQL under `supabase/migrations/`, applied via Supabase SQL editor (never db push/reset), then `bash scripts/regenerate-full-schema.sh`
- **SC#10 mandate:** capability changes affect provider routing → VALIDATION.md needs cross-provider × multi-tool × parallel-thread × long-message rows (4 providers minimum; the D-149-16 gpt-5.6 stopgap row is one of the cross-provider rows)

### Integration Points
- Control Room Model Registry tab (locked placeholder from 146) — unlocks with the 070-A table + 071-A discovery surface
- The user-facing model picker (chat/Settings) — data source flips to the registry (D-149-08); visual polish (D-149-17)
- `app_settings.llm_model` — the org default the lock pins; guards on disable (D-149-09)
- The shared max-tokens resolution point on the request path — the D-149-15 clamp
- The request path's model resolution — the D-149-10 enabled-enforcement + fallback-notice seam (find the one shared spot; never fork per provider)

</code_context>

<specifics>
## Specific Ideas

- The registry table IS the sketch: provider-grouped collapsible sections, click-to-edit numeric cells, `✓ in picker / ✕ hidden` coupling chip derived from `enabled`, 🔓/🔒 per-row lock, OVR distinct from dim+italic DEF with a Reset, ✎ receipts on every write
- Discovery's SC#3 hero moment: un-returned capability fields render as explicit amber "unknown — you set it" inputs — NEVER a guess, NEVER auto-enabled; "capabilities ✓" vs "IDs only" badge per provider makes the asymmetry legible
- Vanished models are FLAGGED (mark deprecated / disable / keep), never auto-deleted — a model can vanish because a provider paused an endpoint
- The disabled-model fallback notice speaks plain language and names both models ("modelX was disabled by your administrator — this reply used modelY")
- Picker polish (operator's words): "we added a lot of models under each provider and did not include icons… the context info makes it not very good" → logos + grouping + name-primary rows with capability info demoted to a secondary line/tooltip

</specifics>

<deferred>
## Deferred Ideas

- **Advanced routing-facet editing** (emit_tier, max_tools, parallel, prefill, strict_json) → v3.4 config-consolidation (D-149-06)
- **Per-user model preference within the allowed set** (revive `user_settings.preferences`, dead since mig 011) → v3.4; the lock's "users can't override" half activates then (D-149-07)
- **OpenAI Responses-API adapter for reasoning-first tool-using models** → SEED-114; re-open trigger: next OpenAI-adapter phase / v3.4 milestone sweep (D-149-16)
- **Local-provider discovery** (Ollama `/api/tags`, LM Studio `/v1/models`) — env-specific local state, out of the org-level registry (D-149-14)
- **Persisted discovery proposals** (survive navigation, review later) — documented alternative if ephemeral proves annoying in practice (D-149-12)
- **Full picker redesign** — 149 does a bounded visual pass only; anything deeper goes to Phase 156 (Everyday UX Polish) or its own sketch

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched on the generic keyword "run" only; belongs to the workflow-inputs cluster, resurfaces at Phase 151/152 discuss-phase (same disposition as 146/147/148)

</deferred>

---

*Phase: 149-model-registry-discovery*
*Context gathered: 2026-07-12*
