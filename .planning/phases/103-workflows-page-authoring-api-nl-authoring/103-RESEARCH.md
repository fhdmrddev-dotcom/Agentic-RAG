# Phase 103: Workflows Page + Authoring API + NL Authoring — Research

**Researched:** 2026-06-14
**Domain:** Composing an authoring/browse/launch face onto the shipped v2.8 harness engine (FastAPI routes + asyncpg DB layer + forced structured generation via the Phase 092.5 provider gateway; React/Vite no-router SPA + plain-SVG/CSS read-only graph + CSS-grid push panel)
**Confidence:** HIGH (every backend seam read at file:line and cross-checked; the CONTEXT/SPEC dossier of 16/16 confirmed sub-claims independently re-verified; provider forcing behavior verified against Anthropic + OpenAI official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Confirm-at-discuss items — RESOLVED + adversarially verified (16/16 confirmed):**

- **D-103-CONF-1 (kickoff wire — content-only):** Run-from-page = `POST /threads` → `POST /threads/{id}/messages` with `MessageCreate{content, model?, provider?, agent_mode, workflow_definition_id}` (two calls). The ONLY workflow input is `body.content`, wrapped server-side as `inputs={"kickoff_prompt": body.content}` (`threads.py:1155`). NO structured `input_keys`/`workflow_inputs` field. Project folder scope is BAKED INTO the published definition (`_kickoff_definition.project_folder_id`, `threads.py:1340-1341`) — the Run modal DISPLAYS the bound folder read-only, never picks one. The thread must already exist (`send_message` 404s on missing, `threads.py:881-889`). `active_workflow_run_id` set atomically in `create_workflow_run` (`db/workflows.py:151-155`). Verifiable proof a run kicked off: `GET /threads/{id}/workflow` → `mode="harness"` (`threads.py:1891`).
- **D-103-CONF-2 (template-asset supply — no new upload route):** `/workflows/generate` body carries OPTIONAL `template_asset_id?` (resolve via `resolve_template_source` → `parse_docx_template_variables`) OR `template_placeholders?: string[]` (direct). No new upload route; no Builder upload UI in 103.
- **D-103-CONF-3 (`named_failures` POLYMORPHIC — render by key-detection):** `named_failures` entry shape differs per stage: `lint`→`{code, phase, message}`; `judge`→`{criterion, score, evidence}` + `{summary}` + a judge-shot bare STRING; `interactive_phase`→`{phase, message}`; `structural_gate`/early stages→bare STRING. UI renders by DETECTING entry keys (`criterion`→criterion-row; `code`→lint-row; `phase`+`message`→phase-row; `summary`→summary-line; bare string→plain message). ANY string/unrecognized entry renders as a BLOCK, never a pass. Do NOT switch on `blocked_stage`.

**Operator choices:**

- **D-103-1 (Run launch inputs):** Run modal = read-only folder chip (name, not path) + ONE textarea → `content` → `kickoff_prompt`. Declared `inputs`/`input_keys` appear only as a HINT line, never as fake structured fields. Run button stays ENABLED even on empty input.
- **D-103-2 (NL-gen authoring model):** Add `Settings.harness_authoring_model: str | None = None` (mirrors `harness_judge_model`/D-03). Resolves to a confirmed-forceable strong default; NOT the composer's selected model. Cross-provider VALIDATION still proves the path on reasoning-native + tool-sensitive providers.
- **D-103-3 (template grounding supply):** Headline grounds on project folder tree + tool/skill registry. Template grounding OPTIONAL via body (`template_asset_id?` OR `template_placeholders?`). 103 Builder adds NO upload control.
- **D-103-4 (drafts/seeds shelf):** Shelf = caller's own saved drafts (`list_draft_workflows`) + the dashed "Build a workflow" build-card. NO pre-seeded starters (→ SEED-084).

### Claude's Discretion
- Builder "Composing…" loading copy/visual + the second-failure "could not generate" error surface (the single-state-transition + honest-failure contracts are locked; copy/styling is discretionary).
- `deriveTier()`/`TIERS` exact STRICT/MIDDLE/LOOSE thresholds (mapping rule fixed: derive from `(citation_policy + validator-kind set)`; presentation discretionary).
- Lucide icon for the Workflows nav entry (`Workflow` vs `GitBranch` — must be a "distinct non-gear icon").

### Deferred Ideas (OUT OF SCOPE)
- **Starter/seed workflow library** → SEED-084. Re-open: Workflows page exists with ≥1 published workflow AND users ask for pre-built templates to fork, OR v3.x content-pack planning.
- **Sketch-022 run-surface DEEP refinement** (panel-owns-the-meaningful-spine, RUNNING-phase-only activity line, three-way thin-receipt terminal, `.runchip` composer redesign) + **3 routed render bugs** (BUG-260609-04, -02, BUG-260610-01) → carved OUT by D-103-A to candidate 103.1/Phase 104. Only the BASIC launch is IN.
- **Builder template-upload affordance** — deferred (D-103-3). Re-open: when template-grounded NL authoring becomes a headline user request.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **WFAUTH-01** (REQ-1, REQ-5, REQ-6) | Draft CRUD via new API + Workflows page; publish-time structural lint blocks invalid publishes | DB layer pattern (`db/workflows.py` owner-scoped RLS-mirror), 409 mapping (DB trigger raises Postgres 23514 → mirror `already_published`→409 at `workflows.py:132-135`), lint already runs as gauntlet stage 1 (`publish_service.publish`); 6 phase_type form field sets map to the PhaseConfig discriminated union (`harness.py:52-167`); publish-gauntlet UI client renders `PublishVerdict` (`workflows.py:84-93`) by `named_failures` key-detection |
| **WFAUTH-02** (REQ-2, REQ-5) | Describe in NL → valid draft; one-shot forced structured generation over strict `WorkflowDefinition`; grounded; single auto-retry on `ValidationError` | `forced_emit(..., schema_model=WorkflowDefinition)` (`forced_emit.py:205-364` — the CR-01 `schema_model` seam already exists); gateway forcing translation proven on all native-7 (`provider_gateway/*`); grounding via `fetch_visible_folders` + `get_tools(None)` + skills query (the spike pattern); grounding fidelity via `assert_folder_scopes_subset` (`scope.py:92`); retry-count observability via LangSmith span / log event; **STRICT-MODE RISK** flagged below (Pitfall 1) |
| **WFAUTH-03** (REQ-4) | Read-only live graph of phases/edges (view, not drag-to-build) | Net-new plain-SVG/CSS component (NO graph lib in deps); vertical spine ordered by `phase_index`, solid `i→i+1` + one dashed `skip_to_phase` (client edge resolution mirrors `parse_skip_target`, `reachability.py:61`); MUST NOT import/modify `PhaseTimeline`/`PhaseCard` (G-5) |
| **WFAUTH-04** (REQ-3, REQ-7) | Project-filtered library, run-from-thread (workflow mode; Deep resting default), immutable-on-publish + versioned | `PhaseSpec.name` additive (`harness.py:189`, zero migration); `ActiveView`+`NAV_ITEMS`+AppDock deletion (`App.tsx:9`, `NavPanel.tsx:44`, `ChatLayout.tsx:18`, `AppDock.tsx` dead); filter rail → `GET /workflows/published?project_folder_id=` (live, `workflows.py:42`); Tweak fork `v(N+1)` INSERT (trigger freezes published); Run → existing kickoff (D-103-CONF-1); client `deriveTier()` |
</phase_requirements>

## Summary

Phase 103 is a **COMPOSE phase**: it adds an authoring/browse/launch face to a fully-shipped engine. The decisive research finding is that the single highest-risk piece — forced one-shot structured generation (REQ-2) — is **almost entirely already built**. The production `forced_emit` substrate (`backend/app/services/forced_emit.py`) drives the Phase 092.5 provider gateway with a SEALED single shot, already carries a `schema_model: type[BaseModel] | None` parameter (the Phase 102 CR-01 additive seam), and the gateway adapters already translate `force_tool_name` into each native-7 provider's named-tool-forcing shape (Anthropic `{"type":"tool","name":...}` thinking-OFF, OpenAI `{"type":"function","function":{"name":...}}`, Google `function_calling_config mode=ANY`). The NL-gen route therefore calls `forced_emit(..., emitter="emit_workflow_definition", schema_model=WorkflowDefinition, tools=[<schema-as-tool>])` — **no new SDK path, no agent loop, no gateway change**.

There is ONE genuine new-integration risk the planner must address: `forced_emit` reads `strict = cap.get("strict_json_schema")` and passes it to the gateway, which sets `"strict": true` on the function definition for OpenAI/DeepSeek. OpenAI strict mode requires EVERY property in `required` + `additionalProperties:false`; `WorkflowDefinition` has many optional-with-default fields, so a strict forced shot would 400 on those providers (the spike used the native Anthropic SDK with NO strict mode and never hit this). The fix is small and additive (see Pitfall 1) but it MUST be planned.

Everything else is straightforward composition against documented seams: draft-CRUD DB fns mirror the existing owner-scoped RLS predicate; the 409 mapping mirrors the live `already_published`→409 path; `PhaseSpec.name` is a zero-migration additive field; the read-only graph is plain SVG/CSS (no graph lib exists in the frontend deps — and the existing PhaseTimeline spine is itself plain CSS); the 400px form panel mirrors the canonical CSS-grid push pattern already shipped in `ChatLayout` (`gridTemplateColumns` 2-state track); the publish-gauntlet UI renders `PublishVerdict` by `named_failures` key-detection; and the three-homes nav is a `useState<ActiveView>` extension + a shared `NAV_ITEMS` const + the deletion of the verified-dead `AppDock.tsx`.

**Primary recommendation:** Call the existing `forced_emit(schema_model=WorkflowDefinition)` for NL-gen — do NOT write a new generation path. Plan the strict-mode handling for the authoring schema FIRST (the only real net-new integration risk), reuse `assert_folder_scopes_subset` for grounding fidelity, and build all UI surfaces from the locked sketch-018..023 design contract against plain SVG/CSS + the existing CSS-grid push pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Draft CRUD persistence | API / Backend (`api/workflows.py` routes + `db/workflows.py` fns) | Database (RLS + immutability trigger) | Owner-scoping + the published-row freeze are server-enforced invariants; the page is a thin client |
| Published-row mutation rejection (409) | Database (trigger raises 23514) | API (maps to HTTP 409) | The trigger is the source of truth; the route maps the exception — never client-derived |
| NL one-shot structured generation | API / Backend (`/workflows/generate` route → `forced_emit`) | Provider gateway (existing, unchanged) | Forcing + validate + retry are server logic; the gateway owns provider translation; the client only renders the returned draft |
| Grounding-context assembly + fidelity check | API / Backend (folder/tool/skill accessors + `assert_folder_scopes_subset`) | Database (owner-scoped folder fetch) | Scope binding is a server-side guarantee the model can never widen (GOV-01 precedent); the model never participates in scope |
| Read-only phase-spine graph | Browser / Client (net-new SVG/CSS component) | — | Pure render of a draft definition JSON; no server round-trip; no live data |
| 400px form panel + 6 phase_type forms | Browser / Client | API (PATCH persists edits) | Form edits mutate a draft client-side, persisted via the CRUD PATCH route |
| Publish-gauntlet UI client | Browser / Client (renders `PublishVerdict` verbatim) | API (`POST /{id}/publish` — existing, unchanged) | The gauntlet RUNS server-side (Phase 102); 103 only renders the verdict + maps the 4 HTTP outcomes |
| Run-from-page launch | Browser / Client (`doRun()` → 2 API calls) | API (existing kickoff path, unchanged) | Reuses `POST /threads` + `POST /threads/{id}/messages` verbatim; the run executes server-side; the client switches view |
| Tier badge (`deriveTier()`) | Browser / Client | — | DERIVED on every render from `(citation_policy + validator-kind set)`; NO stored label, NO server round-trip |
| Three-homes nav / ActiveView | Browser / Client (`useState<ActiveView>` + shared `NAV_ITEMS`) | — | No router; navigation is pure client state |

## Standard Stack

This is a compose phase — the "stack" is the EXISTING project stack used unchanged. Net-new dependencies: **zero** (backend and frontend). The read-only graph is deliberately built on plain SVG/CSS rather than adding a graph library.

### Core (all existing — reuse, do not add)
| Component | Version | Purpose | Why standard (here) |
|-----------|---------|---------|---------------------|
| FastAPI `APIRouter(prefix="/workflows")` | existing (`api/workflows.py`) | New CRUD + `/generate` routes join the SAME router | Already mounted in `main.py`; the file header forbids growing `threads.py` |
| asyncpg pool helpers | existing (`db/workflows.py`) | New `create/update/delete_workflow_definition`, `list_draft_workflows` | `$N` placeholders only; owner-scoped RLS-mirror predicate is the in-file precedent |
| `forced_emit` (provider gateway substrate) | existing (`forced_emit.py`) [VERIFIED: file read] | One-shot forced structured generation over any Pydantic schema via `schema_model` | The CR-01 `schema_model` seam (Phase 102) already generalizes it beyond `EmitFieldMap`; judge already uses `schema_model=JudgeVerdict` |
| `provider_gateway` (Phase 092.5) | existing (`provider_gateway/*`) | Cross-provider stream + `force_tool_name` translation | One home for provider logic; NEVER imports `agent_loop`/`threads.py` |
| Pydantic `WorkflowDefinition` / `PhaseSpec` / `PhaseConfig` union | existing (`models/harness.py`) | The strict (`extra="forbid"`) response schema + the additive `PhaseSpec.name` | `extra="forbid"` is what makes a hallucinated key a `ValidationError` |
| `lint_workflow` / `parse_skip_target` | existing (`harness/reachability.py`) | Publish-time lint (already gauntlet stage 1) + client edge-resolution mirror | Pure, no I/O; lint runs INSIDE `publish_service.publish` — REQ-1 adds NO separate lint path |
| `publish_service.publish` + `PublishVerdict` | existing (`api/workflows.py`, `harness/publish_service.py`) | The 8-stage gauntlet (RUNS server-side) | REQ-6 is a UI client ONLY |
| `resolve_template_source` / `parse_docx_template_variables` | existing (`template_asset_service.py:81`, `template_render_service.py:356`) | Template grounding supply for `/generate` | D-103-CONF-2 — no new upload route |
| `fetch_visible_folders` / `resolve_project_subtree` / `assert_folder_scopes_subset` | existing (`utils/folder_utils.py`, `harness/scope.py`) | Grounding assembly + grounding-FIDELITY check | `assert_folder_scopes_subset` is the exact ⊆ verification REQ-2(d) needs |
| React 19 + Vite + Tailwind + shadcn/ui | existing (`frontend/package.json`) | All UI surfaces | Aether Deep Midnight; sketches port straight |
| `lucide-react` 0.577 | existing | Phase-type glyphs + the `Workflow`/`GitBranch` nav icon | Already the icon set everywhere |
| Plain SVG + CSS | n/a (native) | The read-only vertical phase-spine graph | NO graph lib in deps (no react-flow/d3/dagre); PhaseTimeline itself is plain CSS |

### Supporting (existing config/model layers to extend)
| Component | Version | Purpose | When to use |
|-----------|---------|---------|-------------|
| `config.py` `Settings.harness_judge_model` pattern | existing (`config.py:962`) | Template for the net-new `Settings.harness_authoring_model` (D-103-2) | Add ONE field; resolve via a `resolve_authoring_model()` helper mirroring `resolve_judge_model` (`validator_kinds.py:58`) |
| `get_model_capability()` registry | existing (`config.py:454`, `MODEL_CAPABILITIES`) | Verify a model is `forced_emission:True` before using it as the authoring default | Full native-7 forcing eligibility already documented (`config.py:214-335`) |
| LangSmith auto-trace (`wrap_openai`) | existing (`openai_service.py:985-1002`, `settings.langsmith_api_key`) | The retry-count observable (one trace span per provider call) | The `nl_generation_attempt` event matches the house structured-log style |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain SVG/CSS read-only graph | react-flow / d3 / dagre | Adds a heavyweight dep for a LINEAR spine + one dashed edge; the locked design (sketch-019-D) is explicitly "no drag-canvas, no horizontal-graph slider" — a graph lib is overkill and invites the anti-feature. PhaseTimeline already proves a CSS spine works. **Recommendation: plain SVG/CSS.** |
| `forced_emit(schema_model=WorkflowDefinition)` | a bespoke generation function calling the gateway directly | A new path duplicates the tier-resolve / truncation-guard / narration-recovery / honest-fail / provider_error backstop logic and risks drifting from the RED LINE. **Recommendation: reuse `forced_emit`.** |
| `Settings.harness_authoring_model` (config layer) | a per-user `UserEffectiveSettings` field | `harness_judge_model` is config-layer (a model id is infra, not per-user); D-103-2 explicitly mirrors it. **Recommendation: config layer.** |

**Installation:** No new packages. (Backend: none. Frontend: none.)

**Version verification:** No new packages to verify. The authoring-model default candidates `claude-opus-4-8` and `gpt-5.5` are both `forced_emission:True` in the live registry [VERIFIED: `config.py:238` (`claude-opus-4-8` forced_emission:True), `config.py:225` (`gpt-5.5` forced_emission:True)]. The same pair is the judge-model default (`validator_kinds.py:76`), already proven forceable live in Phase 102.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── BROWSER (React, no router) ───────────────────────────┐
│                                                                                    │
│  NavPanel / mobile drawer ──[shared NAV_ITEMS]──► setActiveView("workflows")        │
│                                                                                    │
│   THREE HOMES (useState<ActiveView>):                                               │
│                                                                                    │
│   ┌── Builder (authoring) ──────────────────┐   ┌── Workflows page (library) ──┐    │
│   │ describe <textarea>                      │   │ project-folder filter rail   │    │
│   │   │ (disabled until non-empty)           │   │ Drafts shelf + Build-card    │    │
│   │   ▼ POST /workflows/generate             │   │ Published cards              │    │
│   │ "Composing…" → ONE state transition      │   │  · deriveTier() badge (client)│   │
│   │   ▼                                       │   │  · Run (published only)       │   │
│   │ read-only vertical phase-spine graph      │   │  · Tweak → fork v(N+1) draft  │    │
│   │   │ click node                            │   └──────────┬───────────────────┘   │
│   │   ▼                                       │              │ Run                    │
│   │ 400px push/split form panel (6 forms)     │              ▼                        │
│   │   ▼ PATCH /workflows/{id}  (persist edit) │   ┌── Chat thread (execution) ───┐    │
│   │ Publish: golden_input ──► POST /{id}/publish  │ existing run surface AS-IS  │    │
│   │   ▼ render PublishVerdict (key-detection) │   │ (PhaseTimeline/PhaseCard)    │    │
│   │ PASS → auto-return to Workflows page      │   └──────────────────────────────┘   │
│   └──────────────────────────────────────────┘                                      │
└────────────────────────────────────┬───────────────────────────────────────────────┘
                                      │  (all HTTPS to the SAME /workflows router + /threads)
┌─────────────────────────────────── BACKEND (FastAPI) ────────────────────────────────┐
│  api/workflows.py  APIRouter(prefix="/workflows")   ── NEVER api/threads.py ──         │
│   ├ GET  /published?project_folder_id=  (existing)                                     │
│   ├ POST /{id}/publish                  (existing — runs publish_service.publish)      │
│   ├ POST /workflows         (NEW) ──► db.create_workflow_definition (status='draft')   │
│   ├ GET  /workflows/drafts  (NEW) ──► db.list_draft_workflows (owner-scoped)           │
│   ├ PATCH /workflows/{id}   (NEW) ──► db.update_workflow_definition  (23514 → 409)     │
│   ├ DELETE /workflows/{id}  (NEW) ──► db.delete_workflow_definition  (23514 → 409)     │
│   └ POST /workflows/generate (NEW):                                                    │
│        1. assemble grounding: fetch_visible_folders + get_tools(None) + skills query   │
│        2. forced_emit(emitter="emit_workflow_definition",                              │
│                       schema_model=WorkflowDefinition,                                 │
│                       model=resolve_authoring_model(settings))  ── one provider call   │
│        3. WorkflowDefinition.model_validate(emitted)                                   │
│        4. on ValidationError → ONE retry (error appended) ── second provider call      │
│        5. grounding fidelity: assert_folder_scopes_subset + registry-membership check  │
│        6. emit `nl_generation_attempt {attempt: 1|2}` (LangSmith span / structured log)│
│        7. return draft (NOT persisted) OR honest structured failure                    │
│                                                                                        │
│  db/workflows.py  (asyncpg, $N only, owner-scoped RLS-mirror)                          │
│  models/harness.py  PhaseSpec.name: str|None = None  (NEW — zero migration, JSONB)     │
│  config.py  Settings.harness_authoring_model: str|None = None  (NEW)                   │
└────────────────────────────────────┬───────────────────────────────────────────────┘
                                      │  forced_emit → provider_gateway.open_stream (existing)
                ┌─────────────────────┴──────────────────────┐
                │  provider_gateway (Phase 092.5, UNCHANGED)  │
                │  force_tool_name → per-provider translation: │
                │   anthropic  {"type":"tool","name":…} (no-think)
                │   google     function_calling_config ANY     │
                │   openai_compat {"type":"function",…} (+strict?)
                └─────────────────────┬──────────────────────┘
                                      ▼
        OpenAI · Anthropic · Google · DeepSeek · Moonshot · Z.ai-GLM · MiniMax · OpenRouter
```

### Recommended Project Structure
```
backend/app/
├── api/workflows.py          # EXTEND: + POST / GET drafts / PATCH / DELETE / POST generate (same router)
├── db/workflows.py           # EXTEND: + create/update/delete_workflow_definition, list_draft_workflows
├── models/harness.py         # EDIT: PhaseSpec.name: str|None = None  (1 line, additive)
├── config.py                 # EDIT: Settings.harness_authoring_model: str|None = None
└── services/
    ├── workflow_authoring.py  # NEW (suggested): grounding assembly + resolve_authoring_model +
    │                          #   the generate→validate→retry→fidelity orchestration (out of threads.py)
    ├── forced_emit.py         # REUSE unchanged (schema_model=WorkflowDefinition)
    └── harness/scope.py       # REUSE assert_folder_scopes_subset for grounding fidelity

frontend/src/
├── App.tsx                   # EDIT: ActiveView + "workflows"
├── components/layout/
│   ├── NavPanel.tsx          # EDIT: NAV_ITEMS → shared const (+ Workflows entry)
│   ├── ChatLayout.tsx        # EDIT: NAV_ITEMS_MOBILE → consume shared const; + WorkflowsPage render branch
│   └── AppDock.tsx           # DELETE (verified dead — zero importers)
├── pages/
│   ├── WorkflowsPage.tsx     # NEW (library + filter rail + drafts shelf + Run/Tweak)
│   └── WorkflowBuilderPage.tsx # NEW (describe-first + graph + form panel + publish gauntlet UI)
├── components/workflows/     # NEW (suggested home for the build-once inventory)
│   ├── PhaseSpineGraph.tsx   # NEW read-only SVG/CSS graph (NOT PhaseTimeline)
│   ├── PhaseFormPanel.tsx    # NEW 400px push panel + 6 phase_type forms
│   ├── PublishGauntlet.tsx   # NEW PublishVerdict renderer (key-detection)
│   └── deriveTier.ts         # NEW deriveTier()/TIERS (single source of truth)
└── lib/
    ├── api.ts                # EXTEND: draft CRUD fns + generate + publish + types
    └── nav-items.ts          # NEW (suggested): the single shared NAV_ITEMS const
```

### Pattern 1: Forced structured generation via the existing substrate (REQ-2)
**What:** Generate a `WorkflowDefinition` by forcing a single tool call over its JSON schema through `forced_emit` — the same sealed shot the `llm_emit` deliverable + the judge use, never a new SDK path.
**When to use:** The `/workflows/generate` route body.
```python
# Source: backend/app/services/forced_emit.py:205 (the production substrate — REUSE)
# The emit tool's schema = WorkflowDefinition.model_json_schema() with OpenAPI
# `discriminator` keys stripped (the spike's _strip_discriminator at
# scripts/spike-097/authoring_feel.py:241 — Pydantic re-applies the discriminator at
# model_validate, which is the real strict gate). The `const phase_type` per oneOf
# variant lets the model still pick the right config.
emit_tool = {
    "type": "function",
    "function": {
        "name": "emit_workflow_definition",
        "description": "Emit a single valid WorkflowDefinition for this task.",
        "parameters": _strip_discriminator(WorkflowDefinition.model_json_schema()),
    },
}
result = await forced_emit(
    messages=[{"role": "user", "content": grounded_prompt}],
    model=authoring_model,            # resolve_authoring_model(settings) — D-103-2
    provider=provider_for(authoring_model),  # from config inference patterns
    emitter="emit_workflow_definition",
    tools=[emit_tool],
    user_settings=effective_settings,
    system_prompt=AUTHORING_SYSTEM_PROMPT,
    schema_model=WorkflowDefinition,  # CR-01 seam (forced_emit.py:215) — validates the emit
)
# result["emitted"] is a validated WorkflowDefinition | None; result["failure"] honest-fails.
```
**Note:** `forced_emit` itself validates via `_validate_args(..., schema_model)` (`forced_emit.py:140`). The route still runs `WorkflowDefinition.model_validate()` explicitly for the retry contract (a None `emitted` is the validate-failure signal that triggers the single retry).

### Pattern 2: Grounding assembly + grounding-FIDELITY check (REQ-2 d)
**What:** Assemble the folder tree + tool/skill registry into the prompt (server-side); after generation, prove the draft is GROUNDED (distinct from `model_validate()` shape-only).
**When to use:** Before and after the forced shot.
```python
# Source: scripts/spike-097/authoring_feel.py (grounding assembly) +
#         backend/app/services/harness/scope.py:92 (fidelity check)
# ASSEMBLY (mirror the spike — all READ-ONLY accessors):
folders = await fetch_visible_folders(supabase, user_id)   # utils/folder_utils.py (owner-scoped)
tool_names = [t["function"]["name"] for t in get_tools(None)]  # openai_service.py:873
skills = <owner + global enabled skills query>              # spike skill_registry() shape
# ... render names + ids into the prompt; the model emits folder ids + tool names from these.

# FIDELITY (after model_validate succeeds):
# 1. folder UUIDs ⊆ the bound project subtree — REUSE the shipped DB-aware ⊆ check:
await assert_folder_scopes_subset(definition, supabase=supabase, user_id=user_id)  # raises on non-⊆
# 2. every available_tools / skill_ref ∈ the real registry:
for phase in definition.phases:
    for tool in getattr(phase.config, "available_tools", []) or []:
        if tool not in set(tool_names):
            raise GroundingError(f"hallucinated tool {tool!r}")
    ref = getattr(phase.config, "skill_ref", None)
    if ref is not None and ref not in {s["id"] for s in skills}:
        raise GroundingError(f"hallucinated skill_ref {ref!r}")
```
**Key:** `assert_folder_scopes_subset` already resolves the subtree owner-scoped and raises a `ValueError` on any out-of-subtree id — exactly REQ-2(d)'s "every folder_scope/project_folder_id UUID resolves in the bound subtree." This is a server-side guarantee the model cannot widen (GOV-01 precedent). Note the `WorkflowDefinition._folder_scope_requires_project` validator (`harness.py:241`) already forces a `project_folder_id` whenever any phase declares `folder_scope`, so a folder-scoped draft cannot validate without a project binding.

### Pattern 3: Single auto-retry with an observable attempt count (REQ-2 a/b)
**What:** Validate the emit; on the first-pass failure, retry EXACTLY once with the validation error appended; emit one `nl_generation_attempt` event per provider call (integer `attempt`).
**When to use:** The generate route's core loop.
```python
# Source: the spike's by-hand loop (scripts/spike-097/authoring_feel.py:296-341)
#         productized + made observable.
async def generate_once(messages, attempt: int):
    _emit_trace_event("nl_generation_attempt", {"attempt": attempt})  # LangSmith span / log
    res = await forced_emit(messages=messages, schema_model=WorkflowDefinition, ...)
    return res

res1 = await generate_once(base_messages, attempt=1)
wd = res1["emitted"]                       # None ⇔ validate/forcing failed
if wd is None:
    err = res1.get("failure") or "validation_failed"
    retry_messages = base_messages + [
        {"role": "assistant", "content": "<the emitted-but-invalid args>"},
        {"role": "user", "content": f"Your emission failed strict validation:\n{err}\n"
                                    "Re-emit a COMPLETE valid WorkflowDefinition using ONLY schema fields."},
    ]
    res2 = await generate_once(retry_messages, attempt=2)   # EXACTLY one retry — NO third call
    wd = res2["emitted"]
    if wd is None:
        return honest_structured_failure()   # never a runnable/partial draft (REQ-2 c)
return draft_response(wd)   # NOT persisted (persistence is REQ-1's explicit create)
```
**Observability:** The verifier asserts the call count via (a) LangSmith trace span count, (b) the `nl_generation_attempt` log sequence, or (c) a gateway-call-count mock (`forced_emit` patched, `.call_count`). The house structured-log style is `logger.info`/structured `metadata` dict + LangSmith auto-trace (`openai_service.py:985`). One success = one event (`attempt=1`); one first-pass failure = two events (`attempt=1`, `attempt=2`), no third.

### Pattern 4: CSS-grid push/split panel (REQ-5) — mirror the shipped pattern
**What:** The 400px form panel pushes (reflows) the graph column via `gridTemplateColumns`, never overlays.
**When to use:** The Builder's graph + form-panel layout.
```tsx
// Source: frontend/src/components/layout/ChatLayout.tsx:230-235 (the canonical shipped pattern)
<div
  className="grid min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
  style={{
    gridTemplateColumns:
      "minmax(0,1fr) " + (panelOpen ? "400px" : "44px"),   // push, not position:absolute/fixed
  }}
>
  <PhaseSpineGraph .../>     {/* shrinks when the panel opens */}
  <PhaseFormPanel .../>      {/* the 400px column; <768px = bottom-sheet via a media query */}
</div>
```
**Acceptance hooks:** the graph column's computed width DECREASES when the panel opens; the panel element is NOT `position:absolute`/`fixed`; no horizontal scrollbar at ≥1100px; `<768px` renders a bottom-sheet. This mirrors the workspace-panel push (`panel-shell.md` D1) exactly.

### Pattern 5: Render `PublishVerdict` by key-detection (REQ-6)
**What:** The `named_failures` list is polymorphic (D-103-CONF-3); render each entry by which keys it has, never by `blocked_stage`.
```tsx
// Source: backend/app/services/harness/publish_service.py:146/246/424/445/etc. (entry shapes)
function renderFailure(entry: unknown) {
  if (typeof entry === "string") return <BlockMessage text={entry} />        // bare string → block
  if (entry && typeof entry === "object") {
    const e = entry as Record<string, unknown>
    if ("criterion" in e) return <CriterionRow {...e} />                     // judge per-criterion
    if ("code" in e)      return <LintRow code={e.code} phase={e.phase} message={e.message} />  // LOWERCASE codes
    if ("phase" in e && "message" in e) return <PhaseRow {...e} />           // interactive_phase
    if ("summary" in e)   return <SummaryLine text={e.summary} />           // judge summary
  }
  return <BlockMessage text="the judge could not produce a verdict / treated as a block" />  // unrecognized → block
}
```
**Lock:** ANY string / missing-`criterion` / unrecognized shape renders as a BLOCK, never `published=true` (REQ-6 g, the G-6 silent-pass guard). Render the 5 verdict fields verbatim (booleans green/red, nulls italic `null`); the run link gates on `golden_run_id != null`; NO "publish anyway" override (its absence rendered struck-through). HTTP: 200-with-block ≠ success (read the body's `published`/`blocked_stage`); 400=`business_requirement`; 404=`not_found`; 409=`already_published` — a binary `200=ok/else=error` handler is a FAIL.

### Anti-Patterns to Avoid
- **Adding a graph library** for a linear spine + one dashed edge — the locked design is "no drag-canvas, no horizontal slider." Use plain SVG/CSS.
- **Reusing/importing `PhaseTimeline`/`PhaseCard`** for the authoring graph — G-5 hot-file protection; the authoring graph reads a DRAFT definition, the timeline reads live `usePhases`. Different data, different component.
- **Writing a new generation path** that calls the gateway directly — duplicates the tier/truncation/recovery/honest-fail/provider_error logic and risks RED-LINE drift. Reuse `forced_emit`.
- **Switching `named_failures` rendering on `blocked_stage`** — the list can mix shapes; key-detection survives mixed lists (D-103-CONF-3).
- **Strict mode for the authoring schema** without remediation — `WorkflowDefinition` has optional-with-default fields → OpenAI strict 400 (Pitfall 1).
- **Touching `threads.py`/`anthropic_service.py`** in any breaking way — RED LINE; Deep byte-identical.
- **Re-running lint as a separate REQ-1 path** — lint already runs as gauntlet stage 1 inside `publish_service.publish`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-provider forced tool calling | A per-provider forcing switch in the route | `forced_emit` → `provider_gateway` `force_tool_name` | All native-7 translation already shipped + provider-docs-verified; a route-level switch leaks a `if provider ==` branch (the D-14 RED LINE) |
| Validating the emitted definition | A bespoke schema check | `WorkflowDefinition.model_validate()` + `forced_emit(schema_model=...)` | `extra="forbid"` already rejects hallucinated keys; the substrate validates + honest-fails |
| Grounding-fidelity ⊆ check | A new folder-subtree walk | `assert_folder_scopes_subset` (`scope.py:92`) | Already owner-scoped, cycle-guarded, raises on non-⊆; GOV-01 server-side guarantee |
| Folder-tree assembly | A new folders query | `fetch_visible_folders` / `resolve_project_subtree` | Owner-scoped, the triplication-killer (`scope.py` header) |
| The publish gauntlet | Re-running lint/golden-run/judge in the route | `publish_service.publish` (existing) | The whole 8-stage gauntlet is live (Phase 102); 103 renders the verdict only |
| Template placeholder extraction | A new docx parser | `parse_docx_template_variables` (`template_render_service.py:356`) | Stdlib zip+regex; no docxtpl in `backend/app` (Pitfall 4) |
| Published-row immutability | A status guard in the route | The DB trigger `workflow_definitions_block_published` | Migration 067; raises Postgres 23514 — the source of truth; route maps to 409 |
| The CSS-grid push panel | A custom overlay/slider | The `ChatLayout` `gridTemplateColumns` 2-state pattern | Shipped + proven; push-not-overlay is the acceptance bar |
| The retry-count observable | A custom counter | LangSmith trace spans + `nl_generation_attempt` log events | The house tracing style; the verifier asserts span/log count |
| The vertical spine render | A graph engine | Plain SVG line + CSS-positioned nodes | PhaseTimeline proves a CSS spine; the locked design forbids a canvas |

**Key insight:** REQ-2 looks like the hardest piece but is ~90% already built. The substrate (`forced_emit`), the cross-provider translation (gateway), the validation (`model_validate` + `schema_model`), and the grounding-fidelity check (`assert_folder_scopes_subset`) all exist. The genuine net-new work for REQ-2 is: the route shell, the grounding-prompt assembly, the single-retry loop with the observable event, the strict-mode handling (Pitfall 1), and the authoring-model knob.

## Runtime State Inventory

> Phase 103 is greenfield-on-existing-seams (new routes + additive fields + new UI), NOT a rename/refactor/migration. This section is included only to record the one near-migration concern explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `PhaseSpec.name` serializes into the EXISTING `workflow_definitions.definition` JSONB. Pre-103 rows have no `name` on any phase. | Code edit only (`name: str|None = None`). NO data migration — old rows `model_validate()` with `name` absent (the 098/101/102 additive-field precedent). REQ-3(d): `git diff` shows no new `*.sql`. |
| Live service config | None — no external service config carries 103 state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | `Settings.harness_authoring_model` is a config VALUE (model id), NOT a secret — pydantic-settings env-overridable like `harness_judge_model`. No new secret. | None (settings field only). |
| Build artifacts | None new. `AppDock.tsx` deletion is a source removal (verified zero importers) — `tsc -b` + vite build catch any stale import. | Delete file + the `// From AppDock` comment (`NavPanel.tsx:28`); leave the `index.css` AppDock comments (cosmetic, line 34/117). |

**Nothing found in categories Stored-data(migration)/Live-config/OS-state/Secrets that requires a data migration — verified by reading `harness.py:220` (additive JSONB), `config.py:962` (judge-model precedent), and the dead-file grep (only `NavPanel.tsx:28` comment + `index.css` cosmetic mentions reference AppDock).**

## Common Pitfalls

### Pitfall 1: OpenAI/DeepSeek strict mode 400s on the optional-heavy authoring schema (HIGHEST RISK)
**What goes wrong:** `forced_emit` sets `strict = cap.get("strict_json_schema", False)` (`forced_emit.py:238`) and passes `strict_schema=strict` to the gateway. For OpenAI (`strict_json_schema:True`, `config.py:214-227`) and DeepSeek (`config.py:279-280`), the openai_compat adapter sets `"strict": true` on the function definition (`openai_service.py:1392`). OpenAI strict mode requires EVERY property in `required` + `additionalProperties:false` [VERIFIED: OpenAI function-calling docs — "all fields in properties must be marked as required; optional fields denoted by adding null as a type"]. `WorkflowDefinition.model_json_schema()` has MANY optional-with-default fields NOT in `required` (`status`, `project_folder_id`, `output_target_folder`, `reingest_output`, `version_policy`, `provenance`, `inputs`, `assets`, `business_requirement`, `PhaseSpec.name`, and most config-level optionals). A strict forced shot on these providers would 400.
**Why it happens:** The spike (`authoring_feel.py`) used the native Anthropic SDK with NO strict mode (Anthropic forcing is built on forced tool USE, not a token-level schema — `config.py:234-237`, no `strict_json_schema` on Anthropic rows), so it never hit this. `EmitFieldMap` (the `llm_emit` schema) is deliberately strict-shaped (all-required-with-null + `additionalProperties:false`, `forced_emit.py:386` comment) — `WorkflowDefinition` is NOT.
**How to avoid:** For the authoring shot, do NOT request strict mode. Options the planner should weigh: (a) the authoring DEFAULT model is `claude-opus-4-8` (Anthropic — no strict; D-103-2 default) so the headline path is unaffected; (b) for SC#10 cross-provider rows on OpenAI/DeepSeek, pass strict OFF for the authoring shot — e.g. call `forced_emit` with the authoring model but ensure the strict flag is not set for this schema (a small additive seam, or use the named-tool-forcing-without-strict path which is already byte-distinct from strict at `openai_service.py:1378` vs `1380`). Forcing (named `tool_choice`) WITHOUT strict works on OpenAI — strict is an ADDITIONAL token-level guarantee, not required for forcing.
**Warning signs:** A 400 "Invalid schema for function … 'required' is required to be supplied and to be an array including every key" on the OpenAI/DeepSeek SC#10 row; `forced_emit` returning `failure="provider_error"` only on strict-capable providers.

### Pitfall 2: MiniMax-M3 emits malformed tool-call argument JSON (known bug)
**What goes wrong:** MiniMax-M3 can emit invalid function-arguments JSON on large emissions → 400 "invalid function arguments json" [VERIFIED: `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md`, run `2c711ee4`]. A `WorkflowDefinition` is a large nested object, so the MiniMax SC#10 row is at risk.
**Why it happens:** Model-side emission quality; not our parsing. MiniMax is `forced_emission:True` but case-sensitive in the registry (`config.py:296-303` PascalCase).
**How to avoid:** `forced_emit`'s layer-6 backstop (`forced_emit.py:312-319`) catches a provider raise → honest `provider_error` (never a silent crash). The SC#10 MiniMax row's acceptance is "passes OR is documented as a known provider limitation" (the 101.1 SC#4 precedent). Author the VALIDATION row to catch it; do NOT assume OpenAI-green ⇒ MiniMax-green. Also confirm the EXACT case-sensitive model id (`MiniMax-M3`) so it doesn't drop to structured mode (Pitfall 3).
**Warning signs:** MiniMax row red while OpenAI/Anthropic green; `provider_error` on MiniMax only.

### Pitfall 3: GLM/MiniMax case-sensitive registry miss → silent tool-drop
**What goes wrong:** A mis-cased GLM/MiniMax model id misses the case-sensitive `MODEL_CAPABILITIES` lookup → `native_tools` inference → STRUCTURED mode → the tools param is never sent → the model NARRATES (or fabricates) the tool call as text instead of forcing it.
**Why it happens:** `get_model_capability` is an exact-key dict lookup; the registry uses exact case (`MiniMax-M3`, `glm-5.1`). [VERIFIED: project memory `project_cross_provider_native_tools_registry_trap.md`; `config.py:296`/`309` PascalCase/lowercase exact.]
**How to avoid:** Use the EXACT registry-cased model id for SC#10 rows. `forced_emit`'s STRUCTURED-mode narration recovery (`recover_narrated_emission`, `forced_emit.py:98`) + the `_coerce_schema_block` (inlines the schema for STRUCTURED models, `forced_emit.py:68`) mitigate a coerce-tier model, but the goal is to hit the FORCE tier with the correct id.
**Warning signs:** `tier="TIER-COERCE"` on a model you expected to force; `recovered_from_narration:true` in the result.

### Pitfall 4: DeepSeek/Moonshot reasoning-token starvation on structured output
**What goes wrong:** Reasoning-native models (DeepSeek, Moonshot/Kimi) spend tokens on `<think>` and can starve the structured emission, OR forcing errors under thinking (DeepSeek 400 "Thinking mode does not support this tool_choice").
**Why it happens:** Reasoning models default thinking ON; a forced `tool_choice` conflicts with thinking (the same class as Anthropic's extended-thinking-forcing error). [VERIFIED: project memory `project_title_gen_deepseek_moonshot_broken.md`; the gateway already gates DeepSeek thinking-OFF on the forced path, `openai_service.py:1365`.]
**How to avoid:** The gateway already forces thinking-OFF for DeepSeek on the forced path (`force_tool_name is not None`). Moonshot/Kimi are `forced_emission` ABSENT (default-SAFE coerce, `config.py:285-289`) — they ride the TIER-COERCE directive + hard-validate + narration recovery, NEVER a code fallback. Author the SC#10 reasoning-native row against DeepSeek (force tier) AND be ready for a Moonshot coerce-tier honest verdict.
**Warning signs:** A truncated half-object (`is_truncated` → `truncated:true`); thinking-mode 400 on DeepSeek (already mitigated).

### Pitfall 5: The published-row mutation must map to 409, not a silent overwrite or a 500
**What goes wrong:** A PATCH/DELETE against a published row hits the immutability trigger (`workflow_definitions_block_published`, migration 067) which raises Postgres 23514 (CheckViolation). If un-caught, asyncpg surfaces it as a 500; if mis-handled, a silent overwrite.
**Why it happens:** The trigger fires only when `OLD.status='published'`; the allowed draft→published flip is the publish path's `publish_definition` (`db/workflows.py:233`).
**How to avoid:** Catch `asyncpg.exceptions.CheckViolationError` (code `23514`) in the update/delete DB fn or the route and map to HTTP 409 — mirroring the live `already_published`→409 path (`workflows.py:132-135`). Re-read after the rejection must show the published row unchanged (REQ-1 e). The 102 `test_publish_flip.py` already proves the trigger blocks published→edit live.
**Warning signs:** A 500 on PATCH/DELETE of a published row; a published row that mutated.

### Pitfall 6: Tweak fork version arithmetic (the tested versioning clause)
**What goes wrong:** A Tweak that UPDATEs the frozen published row (trigger blocks it), or hardcodes `v2`, or reuses `vN` (trips `UNIQUE(slug,version)`).
**Why it happens:** Versioning is a TESTED clause (WFAUTH-04 second half); the fork must INSERT a new row with `version = published_N + 1`.
**How to avoid:** Tweak = `create_workflow_definition` (INSERT) with `version = N+1`, `status='draft'`, `slug` unchanged. Publishing the fork yields a second published row for the same slug satisfying `UNIQUE(slug,version)` (migration 056). NEVER an UPDATE of the published row.
**Warning signs:** A 23514 on Tweak (UPDATE of published); a `UNIQUE(slug,version)` violation on fork-publish.

### Pitfall 7: The discriminator must be stripped for the emit tool schema
**What goes wrong:** `WorkflowDefinition.model_json_schema()` emits OpenAPI `discriminator` keys that some providers' `input_schema` validation rejects.
**Why it happens:** Pydantic's discriminated union serializes a `discriminator` object the providers don't all accept.
**How to avoid:** Strip `discriminator` keys before passing the schema to the emit tool (the spike's `_strip_discriminator`, `authoring_feel.py:241`); the `const phase_type` per `oneOf` variant still lets the model pick the right config, and Pydantic re-applies the discriminator at `model_validate` (the real strict gate).
**Warning signs:** A 400 on the tool schema before any generation; the model picking the wrong config variant.

## Code Examples

### Draft CRUD DB fn (mirror the owner-scoped RLS predicate)
```python
# Source: backend/app/db/workflows.py:159 (list_published_workflows) + :199 (get_definition) — mirror these
async def create_workflow_definition(
    pool: asyncpg.Pool, *, definition: WorkflowDefinition, user_id: UUID
) -> dict:
    """INSERT a draft (status='draft', is_global=false, created_by=user_id). $N only."""
    row = await pool.fetchrow(
        "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_global) "
        "VALUES ($1, $2, $3, 'draft', $4::jsonb, $5, false) RETURNING id, version",
        definition.slug, definition.version, definition.name,
        json.dumps(definition.model_dump(mode="json")), user_id,
    )
    return dict(row)

async def list_draft_workflows(pool: asyncpg.Pool, *, user_id: UUID) -> list[dict]:
    """Owner-scoped drafts (mirror the RLS predicate — a second user's draft is absent)."""
    rows = await pool.fetch(
        "SELECT id, slug, version, name FROM workflow_definitions "
        "WHERE status = 'draft' AND created_by = $1 ORDER BY name",
        user_id,
    )
    return [dict(r) for r in rows]
```

### The additive PhaseSpec.name (REQ-3, zero migration)
```python
# Source: backend/app/models/harness.py:189 — add ONE additive-optional field
class PhaseSpec(_StrictBase):
    slug: str
    phase_index: int
    config: PhaseConfig
    validators: list[ValidatorSpec] = Field(default_factory=list)
    name: str | None = None   # REQ-3 — additive; serializes into the definition JSONB; pre-103 rows validate with it absent
```

### resolve_authoring_model (mirror resolve_judge_model)
```python
# Source: backend/app/services/harness/validator_kinds.py:58 (resolve_judge_model) — mirror exactly
def resolve_authoring_model(settings) -> str | None:
    model = getattr(settings, "harness_authoring_model", None)
    if model:
        return model
    from app.config import get_model_capability  # function-local (Pitfall 4 discipline)
    for candidate in ("claude-opus-4-8", "gpt-5.5"):   # both forced_emission:True (config.py)
        if (get_model_capability(candidate) or {}).get("forced_emission"):
            return candidate
    return None
```

### The 6 phase_type forms → real PhaseConfig fields (REQ-5)
```
# Source: backend/app/models/harness.py:52-167 (the discriminated union members)
programmatic       → fn, input_keys
llm_single         → prompt, model?, temperature?, folder_scope?, skill_ref?
llm_agent          → + available_tools, max_steps, wall_clock_seconds?
llm_batch_agents   → + max_parallel_agents, merge_strategy("concat"|"concat_numbered")
llm_human_input    → prompt, options[], timeout_seconds
llm_emit           → prompt, emitter, model?, folder_scope?, skill_ref?,
                     citation_policy(strict|flag|partial|draft),
                     integrity_policy(strict|documented_limit — GREYED/read-only in 103, shown-but-inert)
# folder_scope/project_folder_id render the folder NAME + bound UUID, never a path.
```

### deriveTier() (client-side, single source of truth — REQ-7 h)
```ts
// DERIVED on every render from (citation_policy + the SET of validator kinds present).
// NEVER a stored/JSONB/free-text label. STRICT/MIDDLE/LOOSE → strict/flag/draft + the gate signature.
// judge (llm_judge_rubric) is present even on LOOSE. Real enums only — no "level 1/2/3"/"compliance mode".
const TIERS = { STRICT: {...}, MIDDLE: {...}, LOOSE: {...} } as const   // single source of truth
function deriveTier(citationPolicy: CitationPolicy, validatorKinds: Set<ValidatorKind>): Tier { ... }
// Acceptance: toggling citation_policy strict→draft on a draft changes the badge with NO server round-trip.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drag-to-build node-graph editor (n8n/Agent Builder style) | NL describe + form-led refine on a read-only spine | v2.9 design (sketch-018, supersedes 013's talk-led) | OpenAI sunsetting hosted Agent Builder (shutdown 2026-11-30) confirms the "squeezed middle"; our buyer is a domain expert, not an automation engineer (REQUIREMENTS Out-of-Scope) |
| Spike used native Anthropic SDK directly (`authoring_feel.py`) | Production calls `forced_emit` → provider_gateway | Phase 092.5 (gateway) + 101.1 (`forced_emit`) + 102 (`schema_model` seam) | The spike's by-hand forced shot is now a one-line `forced_emit(schema_model=WorkflowDefinition)` call — no new SDK path |
| `forced_emit` hard-bound to `EmitFieldMap` | `forced_emit(schema_model=...)` generalizes it | Phase 102 CR-01 (`forced_emit.py:215`) | NL-gen + the judge both reuse the same substrate with different schemas |
| Per-provider forcing branches in callers | One gateway `force_tool_name` → adapter translation | Phase 101.1 D-05/D-14 | No `if provider ==` forcing branch may leak into a caller (the RED LINE) |

**Deprecated/outdated:**
- The spike (`scripts/spike-097/authoring_feel.py`) is THROWAWAY — it proves the FEEL + the grounding inventory, NOT the production wiring. Do NOT import it; reproduce its grounding-assembly logic against `forced_emit`.
- `sources/013-workflow-builder` (talk-led winner) is SUPERSEDED by sketch-018 (requirement-first, form-led). Build to 018-023, not 013.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest fix for the strict-mode 400 (Pitfall 1) is to NOT request strict mode for the authoring shot (forcing-without-strict works on OpenAI). | Pitfall 1 | If strict CANNOT be disabled per-call without a `forced_emit`/gateway edit, the planner may need a small additive seam (e.g. a `strict_override` kwarg) or to make the schema strict-shaped. LOW risk — forcing-without-strict is the spike's exact proven path and is a distinct code branch (`openai_service.py:1378` vs `1380`); but the EXACT minimal edit needs a plan decision. **Recommend the planner confirm whether `forced_emit` should gain a `strict: bool|None` override or whether the route builds the gateway call differently.** |
| A2 | The `nl_generation_attempt` event is best emitted as a structured `logger`/LangSmith span (matching the house style) rather than a `harness_audit` row. | Pattern 3 / Validation | `harness_audit` event types are a CLOSED CHECK constraint (22 kinds, `db/workflows.py:45`) — adding `nl_generation_attempt` would need a migration. The SPEC says "structured log/trace event," not an audit receipt, so a log/span avoids a migration. If the verifier requires a DB-queryable receipt, a migration would be needed (but the SPEC's wording + the no-new-migration spirit favors a log/span). LOW risk. |
| A3 | Skills for grounding are read via the same `skills` table query the spike used (`user_id.eq OR is_global.eq.true` + `is_enabled`). | Pattern 2 | If a shipped skill-registry accessor exists in `backend/app` it should be reused instead of the raw query. The spike used a raw supabase query; a dedicated accessor would be cleaner. LOW risk — the query shape is verified correct in the spike. |
| A4 | The new generate/grounding orchestration lives in a NEW service module (e.g. `services/workflow_authoring.py`), not inline in the route, to keep it out of `threads.py` and testable. | Project Structure | Purely organizational; the SPEC doesn't mandate a file. No functional risk. |

**These four assumptions are organizational/mechanism choices, not behavioral unknowns — the behavioral contracts (REQ-2 retry count, grounding fidelity, honest fail) are all locked and verified. A1 is the one worth an explicit planner decision.**

## Open Questions (RESOLVED)

> RESOLVED at planning: Q1 → Plan 02 Task 1 (additive `strict: bool | None = None` override on `forced_emit`, default-preserving). Q2 → Plan 02 Task 2 (structured log + LangSmith span + `forced_emit` call-count mock; no migration).

1. **The exact minimal edit to disable strict mode for the authoring shot (Pitfall 1 / A1).** — **RESOLVED:** Plan 02 Task 1 adds the additive `strict` override (recommendation (a)).
   - What we know: `forced_emit` sets `strict` from `cap.get("strict_json_schema")` and the openai_compat adapter applies `"strict": true` to the function def; OpenAI strict requires all-fields-required; `WorkflowDefinition` is optional-heavy; forcing-WITHOUT-strict is a distinct, working code branch.
   - What's unclear: whether to (a) add a `strict: bool | None = None` override kwarg to `forced_emit` (additive, default preserves emit behavior), (b) have the route call the gateway path that forces-without-strict, or (c) make the authoring schema strict-shaped (heavier; fights the optional-with-default design).
   - Recommendation: (a) the additive `strict` override on `forced_emit` is the smallest, safest, RED-LINE-safe edit (default `None` = current `cap`-derived behavior = byte-identical for emit/judge). Plan it as the first REQ-2 task.

2. **Whether `nl_generation_attempt` needs a DB-queryable receipt or a log/span suffices (A2).** — **RESOLVED:** Plan 02 Task 2 emits a structured log + LangSmith span; the unit test asserts the count via a `forced_emit` call-count mock — no migration.
   - What we know: the SPEC says "structured log/trace event"; `harness_audit` is a closed-CHECK constraint (migration to add a kind).
   - What's unclear: the verifier's preferred assertion surface (LangSmith span count vs DB row count vs mocked `forced_emit.call_count`).
   - Recommendation: emit a structured log + rely on LangSmith span count / a `forced_emit` call-count mock for the unit test — no migration. Confirm in VALIDATION.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Provider API keys (native-7 + OpenRouter) | REQ-2 NL-gen + SC#10 rows | ✓ (per project memory `feedback_env_secrets_handling`, `reference_provider_docs_glm_minimax`) | n/a | The authoring DEFAULT is `claude-opus-4-8` (Anthropic) — the headline path needs only the Anthropic key; SC#10 rows need the per-provider keys |
| LangSmith (`settings.langsmith_api_key`) | REQ-2 attempt-count observable (span) | ✓ (auto-trace wired, `openai_service.py:985`) | n/a | A structured log line + a `forced_emit` call-count mock for the unit test |
| Local Supabase (:54322) | All DB-touching tests | ✓ (project standard, `reference_local_dev_app`) | local CLI | psycopg2-direct (the 100/101.1/102 precedent) |
| Backend venv | All backend work | ✓ (CLAUDE.md: Python backend uses venv) | n/a | — |
| Frontend node/vite | All UI work | ✓ (`frontend/package.json`) | vite 8 / vitest 4 | — |

**Missing dependencies with no fallback:** None — Phase 103 composes existing infrastructure.
**Missing dependencies with fallback:** SC#10 rows on a provider whose key is absent fall back to "documented as a known provider limitation" (the 101.1 SC#4 precedent), but the project carries all native-7 keys.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest + `asyncio_mode = auto` ([VERIFIED: `backend/pytest.ini`]) |
| Backend config file | `backend/pytest.ini` (`testpaths = tests`) |
| Backend test home | `backend/tests/unit/` (the Phase 102 precedent: `test_publish_service.py`, `test_validator_kinds.py`, …) |
| Backend quick run | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_103_*.py -x` |
| Backend full suite | `backend/venv/Scripts/python.exe -m pytest backend/tests` (expect pre-existing rot — prove net-new via base-checkout per SEED-056) |
| Frontend framework | vitest 4 + @testing-library/react + vitest-axe ([VERIFIED: `frontend/package.json`, `frontend/vitest.config.ts`]) |
| Frontend quick run | `cd frontend && npx vitest run src/components/workflows` |
| Live-DB tests | psycopg2-direct to :54322 (NEVER `db push`/`db reset` — CLAUDE.md) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-1 | Draft CRUD round-trip (POST→GET drafts→PATCH→DELETE→404); owner-scope (2nd user's draft absent) | unit (live :54322) | `pytest backend/tests/unit/test_103_draft_crud.py -x` | ❌ Wave 0 |
| REQ-1 | PATCH/DELETE published row → HTTP 409, no mutation persists (23514 caught) | unit (live :54322) | `pytest backend/tests/unit/test_103_published_409.py -x` | ❌ Wave 0 |
| REQ-1 | Publish a lint-failing draft → `published=false`, `blocked_stage='lint'`, lowercase codes | unit | `pytest backend/tests/unit/test_103_lint_block.py -x` | ❌ Wave 0 |
| REQ-2 | Valid prompt → `model_validate()` passes; EXACTLY one provider call (1 `nl_generation_attempt`, attempt=1) | unit (mock `forced_emit`, assert call_count==1) | `pytest backend/tests/unit/test_103_nl_generate.py::test_one_call -x` | ❌ Wave 0 |
| REQ-2 | First-pass `ValidationError` → EXACTLY two calls (attempt=1,2), NO third → honest structured failure | unit (mock first emit invalid) | `pytest backend/tests/unit/test_103_nl_generate.py::test_retry_once -x` | ❌ Wave 0 |
| REQ-2 | Grounding fidelity: folder UUIDs ⊆ subtree + tools/skills ∈ registry (beyond model_validate) | unit (assert_folder_scopes_subset + registry-membership) | `pytest backend/tests/unit/test_103_grounding_fidelity.py -x` | ❌ Wave 0 |
| REQ-2 | Strict-mode handling: authoring shot does NOT 400 on OpenAI/DeepSeek (Pitfall 1) | unit (assert strict not requested for authoring schema) | `pytest backend/tests/unit/test_103_nl_generate.py::test_no_strict -x` | ❌ Wave 0 |
| REQ-3 | Pre-103 def validates with `name` absent; new def round-trips `phase.name`; no new `*.sql` | unit + `git diff` | `pytest backend/tests/unit/test_103_phasespec_name.py -x` | ❌ Wave 0 |
| REQ-4 | Graph: nodes in `phase_index` order; one dashed `skip_to_phase` edge; static check NO drag/draggable/handle/add-node | frontend unit (DOM query) | `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx` | ❌ Wave 0 |
| REQ-5 | Empty Builder DOM = EXACTLY 1 textarea + 1 hint + 1 disabled button; absence of chips/dial/picker/node/rail | frontend unit | `npx vitest run src/pages/WorkflowBuilderPage.test.tsx` | ❌ Wave 0 |
| REQ-5 | Single state transition (one DOM batch, no per-node animation/stagger/setTimeout) | frontend unit | same file | ❌ Wave 0 |
| REQ-5 | Panel opens by PUSH (graph col width shrinks; not position:fixed; no h-scroll ≥1100px; bottom-sheet <768px) | frontend unit | `npx vitest run src/components/workflows/PhaseFormPanel.test.tsx` | ❌ Wave 0 |
| REQ-5 | Each of 6 phase types renders only its real fields; `integrity_policy` greyed/read-only only on `llm_emit` | frontend unit | same file | ❌ Wave 0 |
| REQ-6 | 5 verdict fields verbatim; 200-with-block ≠ success; 400/404/409 distinct; no override; bare-string→block | frontend unit | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ❌ Wave 0 |
| REQ-7 | `deriveTier()` client-derived; toggle citation_policy strict→draft changes badge with NO round-trip | frontend unit | `npx vitest run src/components/workflows/deriveTier.test.ts` | ❌ Wave 0 |
| REQ-7 | filter rail → live `GET /workflows/published?project_folder_id=`; drafts shelf above Published; no Run on draft | frontend unit | `npx vitest run src/pages/WorkflowsPage.test.tsx` | ❌ Wave 0 |
| REQ-7 | Tweak fork `version=N+1` INSERT; publishing fork → 2nd published row same slug (UNIQUE satisfied) | unit (live :54322) | `pytest backend/tests/unit/test_103_tweak_fork.py -x` | ❌ Wave 0 |
| REQ-7 | Run → creates thread + server-side `active_workflow_run_id` (GET /workflow → harness) + switch to Chat | unit (frontend doRun) + live (DB read) | `npx vitest run src/pages/WorkflowsPage.test.tsx` | ❌ Wave 0 |
| REQ-7 | AppDock deleted, no broken imports (tsc -b + vite build clean); shared NAV_ITEMS in NavPanel + drawer; no react-router | typecheck + grep | `cd frontend && npx tsc -b && grep -r react-router src \| wc -l` | ❌ Wave 0 |
| Deep | Deep byte-identical: `git diff` vs base shows ZERO change to threads.py/anthropic_service.py Deep paths | static (git diff) + 1 manual UAT | `git diff <base> -- backend/app/api/threads.py backend/app/services/anthropic_service.py` | ❌ Wave 0 |

### SC#10 4-Axis Cross-Provider NL-gen VALIDATION matrix (authored in VALIDATION.md, NOT PLAN tasks)
Per CLAUDE.md: REQ-2 calls a provider via forced structured generation, so VALIDATION rows are REQUIRED across the full native roster — one representative per axis, with reasoning-native AND tool-sensitive BOTH covered (not OpenAI-only):

| Axis | Required coverage for 103 | Representative + watch-for |
|------|---------------------------|---------------------------|
| Cross-provider | OpenAI, Anthropic, Google, OpenRouter (+ name the full native-7: DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax) | NL-gen produces a `model_validate()`-passing GROUNDED draft. Anthropic (`claude-opus-4-8`) = the product default. **OpenAI/DeepSeek: assert NO strict-mode 400 (Pitfall 1).** **DeepSeek/Moonshot (reasoning-native): thinking-OFF on the forced path / coerce-tier honest verdict (Pitfall 4).** **GLM/MiniMax (tool-sensitive): exact registry case (Pitfall 3); MiniMax-M3 passes OR documented (Pitfall 2).** |
| Multi-tool | ≥1 row whose generated draft composes ≥2 phase types using ≥2 distinct `available_tools` from the registry | every `available_tools` ∈ the real registry (grounding fidelity) |
| Parallel-thread | ≥1 row: Builder generating in one view while a separate Chat thread streams | NL-gen never touches the streaming/Deep path; no cross-talk; Deep byte-identical |
| Long-message | ≥1 row: a verbose multi-paragraph describe prompt (≥5 KB) yielding a multi-phase draft | no truncation (`is_truncated` false); `max_tokens` sized for a large `WorkflowDefinition` |

### Manual / Lived-experience UAT (G-4, Chrome MCP or operator-driven)
- Single-render reveal: "Composing…" → all phase nodes in ONE DOM batch (no stagger/incremental append).
- Push-not-overlay: opening a form panel SHRINKS the graph (visible reflow), never floats over.
- Drag-free graph: a synthetic pointer drag on a node changes nothing.
- Judge hard-wall: a judge-blocked publish shows the per-criterion rows + struck-through "publish anyway" + only "Fix & re-publish."
- Run lands in Chat: Run never leaves you on the Workflows page; the thread enters harness mode.
- Deep byte-identical: one Deep-mode chat (non-workflow thread, streaming) unchanged post-merge.

### Sampling Rate
- **Per task commit:** the task's targeted unit file(s) (`pytest … test_103_<area>.py -x` / `npx vitest run <file>`).
- **Per wave merge:** the full 103 unit set + a base-checkout net-new-failure proof (SEED-056) + `tsc -b`.
- **Phase gate:** full backend + frontend suites green (net-new=0) before `/gsd:verify-work`; then the SC#10 4-axis matrix live.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_103_draft_crud.py` — REQ-1 CRUD round-trip + owner-scope (live :54322)
- [ ] `backend/tests/unit/test_103_published_409.py` — REQ-1 23514→409 (live :54322)
- [ ] `backend/tests/unit/test_103_lint_block.py` — REQ-1 lint-block verdict (lowercase codes)
- [ ] `backend/tests/unit/test_103_nl_generate.py` — REQ-2 one-call / retry-once / no-third / honest-fail / no-strict (mock `forced_emit`)
- [ ] `backend/tests/unit/test_103_grounding_fidelity.py` — REQ-2 ⊆ + registry-membership
- [ ] `backend/tests/unit/test_103_phasespec_name.py` — REQ-3 additive round-trip + pre-103 validate
- [ ] `backend/tests/unit/test_103_tweak_fork.py` — REQ-7 v(N+1) fork + UNIQUE (live :54322)
- [ ] `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` — REQ-4 order + dashed edge + drag-free static check
- [ ] `frontend/src/components/workflows/PhaseFormPanel.test.tsx` — REQ-5 push + 6 forms
- [ ] `frontend/src/components/workflows/PublishGauntlet.test.tsx` — REQ-6 verbatim + key-detection + 4 HTTP outcomes
- [ ] `frontend/src/components/workflows/deriveTier.test.ts` — REQ-7 client-derived badge
- [ ] `frontend/src/pages/WorkflowsPage.test.tsx` — REQ-7 filter rail + drafts shelf + Run + Tweak
- [ ] `frontend/src/pages/WorkflowBuilderPage.test.tsx` — REQ-5 empty-Builder DOM + single-transition
- [ ] No new test framework install needed (pytest + vitest both present).

## Security Domain

> `security_enforcement` is ABSENT from config.json (= enabled). Section included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | New routes join the EXISTING `/workflows` router (already auth-gated via `get_current_user`); NEVER `threads.py`; the gateway is the single provider home |
| V2 Authentication | yes | All new routes `Depends(get_current_user)` (the project standard); no new auth surface |
| V4 Access Control | yes | Owner-scoped RLS-mirror predicate (`created_by = $N`) on every new DB fn; cross-user collapses to 404 (no existence leak — the `get_definition` precedent); published-row freeze via DB trigger → 409 |
| V5 Input Validation | yes | Pydantic `WorkflowDefinition` `extra="forbid"` (`harness.py:30`) rejects hallucinated/injected keys; `$N` placeholders only (no f-string SQL); `definition->>'project_folder_id'` bound as a positional param (T-098-10) |
| V6 Cryptography | no | No new crypto; secrets stay name-only (CLAUDE.md), redacted in logs (`logging_sink.py`) |
| V12 Files/Resources | yes | Template grounding reuses `resolve_template_source` (never returns another user's bytes, never a raw 404); NO new upload route |
| V14 Config | yes | `harness_authoring_model` is a config VALUE (not a secret); model id validated against the registry's `forced_emission` flag |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user draft read/mutate/publish | Elevation of Privilege | Owner-scope (`created_by=$N`) on every new fn; 404-collapse on non-owned; the `get_definition` (`db/workflows.py:199`) owner-scoped precedent |
| Published-row mutation (immutability bypass) | Tampering | DB trigger `workflow_definitions_block_published` (23514) → 409; never a route-only guard |
| Prompt injection via NL describe / KB content / template placeholders | Tampering / Spoofing | `extra="forbid"` rejects injected keys; grounding fidelity (`assert_folder_scopes_subset` + registry membership) rejects a hallucinated/injected folder UUID or non-registered tool/skill — the model cannot widen scope (GOV-01 server-side resolution; valid-set computed server-side, KB content can't whitelist itself — the 101.1-06 precedent) |
| Folder-scope widening via a generated UUID outside the bound subtree | Elevation of Privilege | `assert_folder_scopes_subset` raises on any non-⊆ id (server-side, owner-scoped); the `_folder_scope_requires_project` model_validator forces a binding |
| Ungrounded "valid-shape" draft reaching the user (G-6 silent-invalid class) | Tampering | Grounding fidelity check is DISTINCT from `model_validate()` (shape-only) — a shape-valid but ungrounded draft is an honest failure, not a draft |
| Publish-spam DoS (synchronous golden run holds the request) | Denial of Service | The golden run already has `asyncio.wait_for(harness_publish_max_seconds)` (`config.py:972`) → `golden_run_timeout` (Phase 102 WR-04); publish is a rare deliberate authed event |
| NL-gen runaway (unbounded retries / provider hang) | Denial of Service | EXACTLY one retry (REQ-2 contract); `forced_emit` provider-error backstop (`forced_emit.py:312`) + truncation guard; the SEALED single shot never enters the open agent loop |
| Secret leakage in NL-gen logs | Information Disclosure | `logging_sink.py` `_RedactingFilter` + name-only secret handling; the `nl_generation_attempt` event carries only an integer `attempt` index |
| Information leak via the project filter | Information Disclosure | The project filter AND-appends to the owner-scope clause — can only NARROW, never widen (T-098-09); bound as a positional param |

## Sources

### Primary (HIGH confidence — read at file:line this session)
- `backend/app/services/forced_emit.py` — the production forced-shot substrate; the `schema_model` CR-01 seam (`:215`), provider-error backstop (`:312`), narration recovery (`:98`)
- `backend/app/services/provider_gateway/{dispatcher,anthropic,google,openai_compat}.py` — `GatewayRequest.force_tool_name`/`strict_schema` + per-provider forcing translation
- `backend/app/config.py` — `MODEL_CAPABILITIES` (`:214-335` full native-7 `forced_emission`/`strict_json_schema`), `Settings.harness_judge_model` (`:962`), inference patterns (`:351`)
- `backend/app/services/harness/validator_kinds.py` — `resolve_judge_model` (`:58`), `JudgeVerdict`/`JudgeCriterionVerdict` (`:88-112`)
- `backend/app/api/workflows.py` — the router, `PublishVerdict` (`:84-93`), the 4 HTTP outcomes (`:128-143`)
- `backend/app/db/workflows.py` — owner-scoped reads (`list_published_workflows :159`, `get_definition :199`), `publish_definition :233`, `create_workflow_run` anchor (`:151`), `write_audit` closed-CHECK (`:45`)
- `backend/app/models/harness.py` — `PhaseSpec :189` (4 fields, no `name`), `PhaseConfig` union (`:52-167`), `AssetRef :213`, `_folder_scope_requires_project :241`
- `backend/app/services/harness/{reachability,scope,publish_service}.py` — `lint_workflow`/`parse_skip_target`, `assert_folder_scopes_subset :92`, `_judge_named_failures :445`/interactive `:424`/structural `:246`
- `backend/app/services/template_asset_service.py:81` (`resolve_template_source`) + `template_render_service.py:356` (`parse_docx_template_variables`)
- `backend/app/api/threads.py:1148-1160` (kickoff `inputs={"kickoff_prompt": body.content}`)
- `scripts/spike-097/authoring_feel.py` — the proven forced-emit pattern + grounding assembly (THROWAWAY)
- `frontend/src/{App.tsx:9, components/layout/{NavPanel.tsx:44,ChatLayout.tsx:18/230,AppDock.tsx}, lib/api.ts:1116-1147, components/panel/PhaseTimeline.tsx}` + `frontend/package.json` (no graph lib)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — the locked Phase 103 design contract (sketches 018-023)
- `103-SPEC.md` + `103-CONTEXT.md` — the 7 locked requirements + the 16/16-verified dossier

### Secondary (MEDIUM confidence — provider docs, verified against codebase)
- Anthropic Claude tool-use docs — forcing (`{"type":"tool","name":...}`) errors under extended thinking; matches the gateway's thinking-OFF gate
- OpenAI function-calling docs — `tool_choice` forced function (`{"type":"function","name":...}`); strict mode requires all-fields-required + `additionalProperties:false` (the Pitfall 1 root)

### Tertiary (LOW confidence — none load-bearing)
- (none — every load-bearing claim verified at file:line or against official provider docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reused component read at file:line; zero new deps.
- Architecture (NL-gen via `forced_emit`): HIGH — the substrate, the `schema_model` seam, and the per-provider forcing translation all read and confirmed; provider behavior cross-checked against official docs.
- Pitfalls: HIGH — Pitfall 1 (strict mode) derived directly from `forced_emit.py:238` + `openai_service.py:1392` + the verified OpenAI strict-mode requirement; Pitfalls 2-4 from verified project bug reports + memory + the gateway gates.
- Frontend: HIGH — nav arrays, CSS-grid push pattern, dead AppDock, and the no-graph-lib finding all read at file:line.

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (30 days — stable internal seams; the only fast-moving element is provider forcing behavior, already pinned to the codebase's adapters which absorb provider drift)

## RESEARCH COMPLETE

**Phase:** 103 - Workflows Page + Authoring API + NL Authoring
**Confidence:** HIGH

### Key Findings
- **NL-gen is ~90% already built:** `forced_emit(schema_model=WorkflowDefinition)` reuses the Phase 102 CR-01 seam; the Phase 092.5 gateway already translates `force_tool_name` for ALL native-7 providers (verified against Anthropic + OpenAI official docs). No new SDK path, no agent loop, no gateway change.
- **The one genuine net-new integration RISK:** `forced_emit` requests strict mode for `strict_json_schema:True` providers (OpenAI/DeepSeek); OpenAI strict requires all-fields-required, but `WorkflowDefinition` is optional-heavy → a strict authoring shot would 400. The spike used native Anthropic (no strict) and never hit this. Fix is small + additive (Pitfall 1 / Open Q1) but MUST be planned first.
- **Grounding fidelity is a shipped primitive:** `assert_folder_scopes_subset` (`scope.py:92`) is the exact server-side ⊆ check REQ-2(d) needs; registry-membership for tools/skills is a set check; both are distinct from `model_validate()` shape-only.
- **No graph library exists in the frontend deps** — the read-only spine is plain SVG/CSS (PhaseTimeline proves the pattern); the 400px panel mirrors the shipped `ChatLayout` `gridTemplateColumns` 2-state push pattern.
- **All locked decisions verified at file:line:** kickoff content-only (`threads.py:1155`), polymorphic `named_failures` (publish_service entry shapes), 409 mapping (DB trigger 23514), AppDock dead (zero importers), `PhaseSpec.name` additive (zero migration).

### File Created
`.planning/phases/103-workflows-page-authoring-api-nl-authoring/103-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All reused; zero new deps; every component read at file:line |
| Architecture (forced_emit reuse) | HIGH | Substrate + seam + gateway translation read + provider-docs-verified |
| Pitfalls | HIGH | Strict-mode risk derived from code + verified OpenAI requirement; provider quirks from verified bug reports |

### Open Questions (RESOLVED)
1. The minimal edit to disable strict mode for the authoring shot (recommend an additive `strict` override on `forced_emit`, default-preserving) — Open Q1 / A1. **RESOLVED → Plan 02 Task 1.**
2. Whether `nl_generation_attempt` needs a DB receipt or a log/span suffices (recommend log/span — no migration) — Open Q2 / A2. **RESOLVED → Plan 02 Task 2.**

### Ready for Planning
Research complete. The planner can create PLAN.md files. Recommend sequencing the strict-mode handling (Open Q1) as the FIRST REQ-2 task, then the grounding/retry orchestration, then the UI surfaces against the locked sketch-018..023 contract.
