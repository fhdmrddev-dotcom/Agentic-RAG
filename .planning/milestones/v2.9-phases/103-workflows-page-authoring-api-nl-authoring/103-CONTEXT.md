# Phase 103: Workflows Page + Authoring API + NL Authoring - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the shipped v2.8 harness engine an **authoring + browse + launch face**. A domain expert
describes a workflow in plain language → receives a one-shot validated `WorkflowDefinition`
draft → refines it by FORM on a read-only vertical phase-spine graph → publishes it through the
EXISTING 8-stage gauntlet (rendered verbatim from `PublishVerdict`) → launches it from a
project-filtered Workflows page into a new chat thread in workflow mode.

This phase **COMPOSES** the shipped engine and never re-implements it: **no drag-to-build canvas,
no new runtime, no router, Deep chat byte-identical.** Authoring = a NEW Workflows page + NEW
routes on the EXISTING `/workflows` router + ADDITIVE model fields; it MUST NOT touch
`backend/app/api/threads.py` or `backend/app/services/anthropic_service.py` in breaking ways.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `103-SPEC.md` for full requirements, boundaries, and
acceptance criteria. Downstream agents MUST read `103-SPEC.md` before planning or implementing.
Requirements are not duplicated here — this discussion captured only the implementation
decisions (the three confirm-at-discuss items + four operator choices) below.

- **REQ-1 (WFAUTH-01):** Draft CRUD API + persistence on the existing `/workflows` router; published-row mutation → HTTP 409.
- **REQ-2 (WFAUTH-02):** NL one-shot structured generation, single auto-retry on `ValidationError`, grounding fidelity over folder subtree + tool/skill registry + uploaded template.
- **REQ-3:** Additive-optional `PhaseSpec.name` in the JSONB (zero column migration).
- **REQ-4 (WFAUTH-03):** Read-only vertical phase-spine graph (linear `i→i+1` + one dashed `skip_to_phase`); no drag/handles/add-node.
- **REQ-5 (WFAUTH-01/02, D-103-C):** Describe-first Builder + 400px push/split form panel + six phase_type-conditioned forms.
- **REQ-6 (gauntlet UI):** Publish-gauntlet UI client rendering `PublishVerdict` verbatim; judge as a hard wall, no override.
- **REQ-7 (WFAUTH-04, IA):** Workflows page (library + project filter + drafts shelf + Tweak fork + run-from-page launch) + `"workflows"` ActiveView + shared `NAV_ITEMS` + AppDock deletion.

**In scope (from SPEC.md):** draft-CRUD DB fns + POST/PATCH/DELETE/GET routes; the NL `/workflows/generate` route; additive `PhaseSpec.name`; the read-only spine graph; the describe-first Builder + 400px form panel; the publish-gauntlet UI client; the Workflows page (filter rail, drafts-above-published shelves, client `deriveTier()`, Tweak→`v(N+1)` fork, Run→new-thread launch); the `"workflows"` ActiveView + shared `NAV_ITEMS` + AppDock deletion + authoring client fns/types.

**Out of scope (from SPEC.md):** the sketch-022 run-surface DEEP refinement + 3 routed render bugs (D-103-A → 103.1/104); removing the composer Deep/Harness picker (D-103-B); drag-to-build canvas / `depends_on` / parallel lanes / add-node handles; in-place edit of a published definition; a polished blank-canvas no-NL flow as a headline (D-103-C); `react-router`/`useNavigate`/URL; any breaking change to `threads.py`/`anthropic_service.py` or any new runtime/agent-loop/provider-SDK path; a net-new template upload-VALIDATION backend endpoint.

</spec_lock>

<decisions>
## Implementation Decisions

### Confirm-at-discuss items — RESOLVED + adversarially verified (16/16 sub-claims confirmed, 0 refuted)

All three were verified against the real code by independent refute-by-default agents. The
file:line evidence below is **load-bearing for planning** — write tasks directly against it.

#### D-103-CONF-1: Run-from-page kickoff wire contract (REQ-7) — *content-only; lighter than the SPEC implied*
- **The kickoff carries exactly ONE free-text input.** `POST /threads/{id}/messages` accepts `MessageCreate{content, model?, provider?, agent_mode, workflow_definition_id: UUID|None}` (`backend/app/models/message.py:8-18`). There is **NO** structured `input_keys`/`workflow_inputs` field. The only workflow input reaching the engine is `body.content`, wrapped server-side as `inputs={"kickoff_prompt": body.content}` (`backend/app/api/threads.py:1155`, SEED-047).
- **Project folder scope is BAKED INTO the published definition**, not chosen at send-time. Scope resolves from `_kickoff_definition.project_folder_id` (`threads.py:1340-1341`); `MessageCreate` has no `project_folder_id`. The Run modal therefore **displays** the bound folder (read-only), it does not pick one.
- **`active_workflow_run_id` is set atomically inside `create_workflow_run`** in the same transaction that inserts the `workflow_runs` row: `UPDATE threads SET active_workflow_run_id = $2 WHERE id = $1` (`backend/app/db/workflows.py:151-155`).
- **The thread must already exist.** `send_message` 404s on a missing thread (`threads.py:881-889`); it never creates one. Launch sequence = **`POST /threads` → `POST /threads/{id}/messages` with `workflow_definition_id`** (two calls; no bespoke `/workflows/{id}/run`).
- **Workflow mode read-back:** `GET /threads/{id}/workflow` → `ThreadWorkflowState{mode: Literal["deep","harness"], ...}` (`backend/app/models/thread.py:74`); `mode = "harness" if active_workflow_run_id is not None else "deep"` (`threads.py:1891`). This is the verifiable proof a real run was kicked off (REQ-7 acceptance f).

#### D-103-CONF-2: Template-asset supply for `/workflows/generate` (REQ-2) — *no new upload route needed*
- **`AssetRef{asset_id, filename, kind: Literal["template","reference"], mime}`** (`backend/app/models/harness.py:213-217`).
- **`resolve_template_source(*, pool, supabase, thread_id, user_id, asset_ref=None) -> dict`** (`backend/app/services/template_asset_service.py:81-210`) returns `{bytes, filename, provenance: "library"|"template_input"|None, mime, error}`.
- **`parse_docx_template_variables(data: bytes) -> dict|None`** (`backend/app/services/template_render_service.py:356-413`) returns `{scalars, collections, columns}` — the placeholder vocabulary to inject into the generation prompt. `build_field_map_tool_schema` passes sorted keys in the tool-schema description (`template_render_service.py:115-135`).
- **There is NO HTTP route that ingests a template into LIBRARY/global scope.** Library assets are fixture-seeded (`backend/tests/fixtures/seed_library_asset.py`). The only raw template-upload HTTP route is THREAD-scoped + ephemeral: `POST /threads/{thread_id}/workspace/files` (kind=`template_input`, TTL) (`backend/app/api/workspace.py:149-204`). `_handle_render_template` already accepts an `asset` dict and resolves it via `resolve_template_source` (`backend/app/services/tool_dispatcher.py:1628-1646`, tool schema `:1543`).
- **Decision (D-103-3 below):** supply is OPTIONAL via the request body — `template_asset_id?` (resolve→parse) **or** `template_placeholders?: string[]` (direct). No new upload route; no Builder upload UI in 103.

#### D-103-CONF-3: `PublishVerdict.named_failures` shape (REQ-6) — *POLYMORPHIC across stages; UI renders by key-detection*
- **`PublishVerdict{published: bool, version: int|None, golden_run_id: UUID|None, blocked_stage: str|None, named_failures: list}`** — `named_failures` is a BARE `list` (`backend/app/api/workflows.py:84-93`).
- **`named_failures` entry shape DIFFERS by `blocked_stage`** (`backend/app/services/harness/publish_service.py`):
  - `lint` → `{code, phase, message}` dict (`:146-149`; codes are the LOWERCASE `LintError.code` literals from `reachability.py`).
  - `judge` → `{criterion, score, evidence}` per failing criterion + a `{summary: str}` row; a judge-shot failure (`verdict["failure"]` truthy) is a **bare STRING** (`_judge_named_failures`, `:445-465`).
  - `interactive_phase` → `{phase, message}` dict (`:424-429`).
  - `structural_gate` → a **STRING** (`:246`).
  - early stages (`not_found`, `already_published`, `business_requirement`, `golden_run_error`, `golden_run_timeout`, `definition_invalid`) → a **STRING** (`:73/87/98/119/132/209/223`).
- **Judge model shapes:** `JudgeCriterionVerdict{criterion: str, passed: bool, score: int, evidence: str}` + `JudgeVerdict{overall_passed, overall_score, grounded_in_evidence, answers_business_requirement, did_the_work_not_delegated, criteria: list[JudgeCriterionVerdict], summary}` (`backend/app/services/harness/validator_kinds.py:88-112`; `extra=forbid`).
- **HTTP mapping (verbatim `workflows.py:128-143`):** `not_found`→404, `already_published`→409, `business_requirement`→400 (verdict in `detail`), every other block + success→200 with the `PublishVerdict` body.
- **UI render rule (locked):** render `named_failures` by **detecting which keys each entry has** (`criterion`→criterion-row; `code`→lint-row; `phase`+`message`→phase-row; `summary`→summary-line; bare string→plain message). NEVER assume one row shape. Any string / unrecognized entry renders as a **block, never a pass** (REQ-6 acceptance g). Do not switch solely on `blocked_stage` — switch on entry keys (more robust; survives mixed lists).

### NL Authoring & Run-launch (operator choices — confirmed by user "proceed with your recommendations")

#### D-103-1: Run launch inputs (REQ-7) — single textarea + folder chip
- The Run modal = a **read-only chip** for the bound project folder (name, not path; from `definition.project_folder_id`) + **ONE textarea** ("What should this run work on?") whose value becomes `content` → `kickoff_prompt`. No structured/labeled input fields (the wire cannot carry them without touching `threads.py`).
- If the definition declares `inputs`/`input_keys`, surface them as a **hint line** ("This workflow expects: …") so the user knows what to type — still ONE textarea, no secret concatenation of fake fields.
- The Run button stays **enabled even on empty input** (a folder-bound workflow can legitimately run with a terse kickoff). (Builder/Publish buttons keep their own disabled-on-empty rules per SPEC REQ-5/REQ-6.)

#### D-103-2: NL-gen authoring model (REQ-2) — a fixed forceable default via a new knob
- Add **`Settings.harness_authoring_model: str | None = None`** (mirrors the existing `Settings.harness_judge_model` / D-03 pattern). It resolves to a confirmed-forceable strong default (e.g. `claude-opus-4-8`/`gpt-5.5` — both `forced_emission:True`). NOT the composer's currently-selected model.
- Rationale: consistent draft quality regardless of the user's chat model, guaranteed forceability for the `emit_workflow_definition` shot, swappable by operators (preserve-optionality). Cross-provider VALIDATION (REQ-7/SC#10) still proves the **path** works on reasoning-native (DeepSeek/Moonshot) + tool-sensitive (GLM/MiniMax) providers — but the product default is the one authoring model.

#### D-103-3: Template grounding supply (REQ-2) — minimal headline, capable endpoint, no Builder upload UI
- `/workflows/generate` headline grounds on **project folder tree + tool/skill registry**. Template grounding is **OPTIONAL**, supplied in the request body two ways: `template_asset_id?` (resolve via `resolve_template_source` → `parse_docx_template_variables`) **OR** `template_placeholders?: string[]` (passed directly). Satisfies the SPEC "reference an ingested asset OR pass placeholders" clause exactly — zero new infra, no upload-validate route.
- The **103 Builder UI adds NO upload control.** Template grounding is exercised via API + the SC#10 validation rows; a Builder upload affordance is deferred (consistent with D-103-C: NL-describe-first is the headline, not template upload).

#### D-103-4: Drafts/seeds shelf (REQ-7) — drafts + Build-card only; starter library deferred
- The shelf above Published = the caller's **own saved drafts** (`list_draft_workflows`) + the dashed **"Build a workflow"** build-card. **No pre-seeded starter templates** in 103 — "seeds" stays a label. A real fork-a-starter library is deferred (see `<deferred>` → SEED-084).

### Claude's Discretion
- Builder "Composing…" loading copy/visual + the second-failure "could not generate" error surface (REQ-5/REQ-2 lock the single-state-transition + honest-failure contracts; exact copy/styling is discretionary).
- `deriveTier()`/`TIERS` exact STRICT/MIDDLE/LOOSE thresholds (derive from `(citation_policy + validator-kind set)` per the SPEC Constraints; the mapping rule is fixed, the presentation is discretionary).
- Lucide icon choice for the Workflows nav entry (`Workflow` vs `GitBranch` — SPEC says "distinct non-gear icon").

### Folded Todos
None — `gsd-sdk todo.match-phase 103` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** All backend file:line refs
below were adversarially verified during discuss-phase (16/16 confirmed).

### Locked requirements (read FIRST)
- `.planning/phases/103-workflows-page-authoring-api-nl-authoring/103-SPEC.md` — the 7 locked requirements, boundaries, acceptance criteria, "How we'd know this failed" (G-6). **MUST read before planning.**
- `.planning/ROADMAP.md` → "### Phase 103" — goal, 4 success criteria, WFAUTH-01..04 mapping, G-2/SC#10 notes.

### Run-from-page kickoff (REQ-7) — reuse AS-IS, never bespoke
- `backend/app/api/threads.py:873` — `send_message` route; `:1155` kickoff `inputs={"kickoff_prompt": body.content}`; `:1340-1341` scope from `_kickoff_definition.project_folder_id`; `:881-889` 404-on-missing-thread; `:1891` `mode` derivation. **G-5 hot file — additive/read-only only, Deep byte-identical.**
- `backend/app/models/message.py:8-18` — `MessageCreate` (content + workflow_definition_id only).
- `backend/app/models/thread.py:62-106` — `ThreadWorkflowState` (`mode` at `:74`).
- `backend/app/db/workflows.py:127-160` — `create_workflow_run` (anchor UPDATE at `:151-155`); also `get_definition`, `list_published_workflows`, `publish_definition`.

### Publish gauntlet UI client (REQ-6)
- `backend/app/api/workflows.py:84-93` — `PublishVerdict` (5 fields, `named_failures: list`); `:128-143` — the 4 HTTP outcomes; `APIRouter(prefix="/workflows")` — the router NEW routes join (NEVER threads.py).
- `backend/app/services/harness/publish_service.py:445-465` — `_judge_named_failures`; `:146-149` lint entries; `:424-429` interactive_phase; `:246` structural_gate string; `:73/87/98/119/132/209/223` early-stage strings.
- `backend/app/services/harness/validator_kinds.py:88-112` — `JudgeCriterionVerdict` + `JudgeVerdict`.
- `backend/app/services/harness/reachability.py` — `lint_workflow` + `LintError{code, phase_slug, message}`; 5 LOWERCASE codes (`bad_index`, `unsatisfiable_skip`, `orphan_phase`, `no_terminal`, `input_unsatisfied`); `parse_skip_target`.

### Schema (REQ-3, REQ-1, REQ-5)
- `backend/app/models/harness.py:189-193` — `PhaseSpec` (gains additive `name: str|None`); `:213-217` `AssetRef`; `:154` `LlmEmitPhaseConfig.citation_policy`/`integrity_policy`; `WorkflowDefinition` (slug/version/status/phases/project_folder_id/inputs/assets/business_requirement).
- `workflow_definitions` table — migration `056` (UNIQUE(slug,version) + RLS) + `067` (immutability trigger `workflow_definitions_block_published`, Postgres 23514 on published-row mutation).

### NL generation + template grounding (REQ-2)
- `scripts/spike-097/authoring_feel.py` — the PROVEN forced-`emit_workflow_definition` pattern over `WorkflowDefinition.model_json_schema()` (not yet in production).
- `backend/app/services/template_asset_service.py:81-210` — `resolve_template_source`.
- `backend/app/services/template_render_service.py:356-413` — `parse_docx_template_variables`; `:115-135` `build_field_map_tool_schema`.
- `backend/app/services/tool_dispatcher.py:1628-1646` (`+:1543`) — `_handle_render_template` asset resolution (the asset-dict shape to reuse).
- `backend/app/api/workspace.py:149-204` — ephemeral thread-scoped template upload (the ONLY upload route; do NOT build a new one).
- The existing provider gateway (no new SDK path / no agent loop) for the generation call — see `backend/app/services/llm_gateway*`/provider-gateway from Phase 092.5.

### Frontend integration points (REQ-7)
- `frontend/src/App.tsx:9` — `ActiveView` union (5 members; add `"workflows"`).
- `frontend/src/components/.../NavPanel.tsx:44` — `NAV_ITEMS` (becomes the shared const); `AppDock.tsx:12` — DEAD `NAV_ITEMS` (delete file + the `// From AppDock` comment); `ChatLayout.tsx:18` — `NAV_ITEMS_MOBILE` (consume shared const).
- `frontend/src/components/chat/MessageInput.tsx` — composer Deep/Harness picker (`workflow-mode-selector`/`workflow-picker`/`workflow-option-{slug}`); STAYS working (D-103-B).
- `frontend/src/lib/api.ts:1116` `PublishedWorkflow{id,slug,name}`; `:1126` `getThreadWorkflow()`; `:1140` `listPublishedWorkflows()` — extend with authoring client fns + `PublishVerdict`/`LintError`/draft types.
- Run surface reused AS-IS (do NOT modify): `WorkspacePanel`, `PhaseTimeline.tsx:77`, `PhaseCard.tsx:242`, `StreamsProvider` (`usePhases`/`useTasks`/`useViewingThread`/`useWorkflowLockForThread`). The read-only authoring graph (REQ-4) is a NET-NEW component that MUST NOT import/modify `PhaseTimeline`/`PhaseCard` (G-5).

### Design contract (UI build)
- Project skill `sketch-findings-agentic-rag` — the Phase 103 Workflow Studio findings (requirement-first Builder, read-only vertical phase-spine graph, 400px side-panel forms, 8-stage publish gauntlet + judge hard-wall, Workflows page library+launch, three-homes nav/IA). Auto-loads during UI implementation.

### Prior phase context (cross-phase consistency)
- `.planning/phases/102-.../102-CONTEXT.md` — the validation-gate library + publish path this phase is a client of.
- `.planning/phases/101-.../101-CONTEXT.md` + `101.1-.../101.1-CONTEXT.md` — the template-asset path (AssetRef, resolve_template_source) reused for grounding.
- `.planning/phases/098-.../098-CONTEXT.md` — project-folder binding (the filter rail's source of truth).
- `.planning/phases/099-.../099-CONTEXT.md` — `skill_ref` (the `llm_single`/`llm_emit` form field).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (compose, don't rebuild)
- **Publish gauntlet:** `publish_service.publish` + `POST /workflows/{definition_id}/publish` already run live (Phase 102). REQ-6 is a UI client ONLY — render the existing `PublishVerdict`.
- **Lint:** `lint_workflow` already runs as gauntlet stage 1 (inside `publish_service`). REQ-1 does NOT add a separate lint path.
- **Kickoff:** `POST /threads/{id}/messages` + `create_workflow_run` already create + anchor a run. REQ-7's Run reuses this verbatim (D-103-CONF-1).
- **Template resolution:** `resolve_template_source` + `parse_docx_template_variables` + the `_handle_render_template` asset-dict shape are reused by `/workflows/generate` grounding (D-103-CONF-2).
- **DB data layer:** `db/workflows.py` already has `get_definition`/`list_published_workflows`/`publish_definition`/`create_workflow_run`/`write_audit`. REQ-1 ADDS `create_workflow_definition`/`update_workflow_definition`/`delete_workflow_definition`/`list_draft_workflows`.
- **Frontend nav:** router-less `useState<ActiveView>` + `setActiveView` is the navigation model; `listPublishedWorkflows()`/`getThreadWorkflow()` clients exist in `api.ts`.

### Established Patterns
- **Additive-optional model fields serialize into the `definition` JSONB** — `PhaseSpec.name` needs NO SQL migration (REQ-3); pre-103 rows validate with it absent (the 101/102 additive-field precedent).
- **Immutability-on-publish via DB trigger** — a published row cannot be mutated (Postgres 23514); refinement happens only via Tweak→new-version draft INSERT (`v(N+1)`), never UPDATE.
- **Forced structured generation via the provider gateway** — `forced_emit` over a `model_json_schema()`, validated with `model_validate()`, honest-fail on a failed verdict (the 101.1/102 pattern). NL-gen reuses this, NOT a new SDK path or agent loop.
- **Independent operator-set model knob** — `harness_judge_model` (D-03) is the template for `harness_authoring_model` (D-103-2).
- **Owner-scoped RLS-mirroring reads** — `list_published_workflows`/`get_definition` mirror the RLS predicate (`created_by=$2 OR is_global`) for service-role reads; `list_draft_workflows` follows the same shape.

### Integration Points (where new code connects)
- New routes join the EXISTING `APIRouter(prefix="/workflows")` in `api/workflows.py` — already mounted in `main.py`, no new registration. **NEVER `threads.py`.**
- `"workflows"` ActiveView render branch lands in `ChatLayout` BEFORE the trailing `: <KnowledgeHealthPage/>` else.
- The shared `NAV_ITEMS` const is consumed by `NavPanel` + the mobile drawer; `AppDock.tsx` is deleted.
- The Run launch reuses `POST /threads/{id}/messages` with `workflow_definition_id`; `doRun()` creates a thread, sets `selectedThread` + `setViewingThread`, fires a redirect toast, switches `activeView` to `chat`.

</code_context>

<specifics>
## Specific Ideas
- **Render `named_failures` by key-detection, not by `blocked_stage`** — the list is polymorphic and can mix shapes; key-detection (`criterion`/`code`/`phase`+`message`/`summary`/bare-string) is more robust and is the locked render rule (D-103-CONF-3).
- **The Run modal is honest about the wire** — one textarea + a read-only folder chip; declared `input_keys` appear only as a hint, never as fake structured fields (D-103-1).
- **Watch MiniMax for the NL-gen SC#10 row** — `BUG-260610` family aside, the open `minimax-m3-invalid-tool-args-400` report is a known risk for forced structured generation on MiniMax (REQ-2 acceptance e requires a tool-sensitive provider). Author the VALIDATION row to catch it; do not assume OpenAI-green ⇒ MiniMax-green.

</specifics>

<deferred>
## Deferred Ideas

- **Starter/seed workflow library (fork-a-starter)** → **SEED-084** (`.planning/seeds/SEED-084-starter-workflow-library.md`). Re-open trigger: when a Workflows page exists with ≥1 published workflow AND users ask for pre-built templates to fork, OR at v3.x content-pack planning. (D-103-4 keeps "seeds" a label only in 103.)
- **Sketch-022 run-surface DEEP refinement** (panel-owns-the-meaningful-spine, RUNNING-phase-only activity line, three-way thin-receipt terminal, `.runchip` composer redesign) + the **3 routed render bugs** (`BUG-260609-04` phase-0 clobber, `BUG-260609-02` Sub-task desc loss, `BUG-260610-01` dup-avatar) → carved OUT by **D-103-A** to a candidate **103.1 / Phase 104**. Only the BASIC launch (create thread + set workflow mode + switch to Chat, reusing the surface unchanged) is IN 103.
- **Builder template-upload affordance** — a UI control to upload/select a `{{placeholder}}` template inside the Builder. Deferred (D-103-3); the `/workflows/generate` endpoint accepts template grounding via the body, but the 103 Builder exposes no upload UI. Re-open trigger: when template-grounded NL authoring becomes a headline user request.

### Reviewed Todos (not folded)
None — 0 todos matched Phase 103.

### Reported-bugs cross-check (mandatory, `surface: Agentic-RAG` only)
- `BUG-260609-02`, `BUG-260609-04`, `BUG-260610-01` — already carved OUT by SPEC D-103-A (run-surface render bugs → 103.1/104). Status unchanged (deferred), routed.
- `minimax-m3-invalid-tool-args-400` — NOT folded (provider quirk); noted as a REQ-2/SC#10 VALIDATION risk in `<specifics>`.
- `general-chat-intermittent-silent-send-drop`, `setting-up-agent-hides-model-activity` — Deep/run-loop domain, not 103 authoring scope; leave open.

</deferred>

---

*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Context gathered: 2026-06-14*
*All three confirm-at-discuss items adversarially verified (16/16 sub-claims confirmed, 0 refuted) before lock.*
