# Phase 104: PM Flagship Content Pack - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship project-management workflows as **authored CONTENT on the generic harness primitives** —
example **templates** (project charter / weekly status report / risk register) + **workflow
definitions** + **register schemas** — with **ZERO PM-specific engine code** (no new phase type,
no PM math, no bespoke route). The headline: a **single template-fill produces a weekly status
report from the project KB, cited and integrity-checked** (PM-01 / ROADMAP SC#2). And SC#3: a
domain author can **re-author or extend** a pack workflow through the shipped Workflows page
without code changes.

This is a **content + seed phase**, not an engine phase. Everything ships as data: workflow
definitions as published `workflow_definitions` rows, `.docx` templates as Storage-backed
`AssetRef`s, register schemas as `EmitFieldMap` shapes + validator configs, and a small synthetic
sample KB. The ONLY net-new code is a **seed/provisioning script** + the synthetic content itself.

**Explicitly out of this phase's boundary** (routed elsewhere — see `<deferred>`):
- The sketch-022 **run-surface DEEP refinement** + the 3 routed render bugs (BUG-260609-02/-04,
  BUG-260610-01) — D-103-A carved these to a candidate **103.1**, NOT here. 104 stays content-only.
- Grid renderers (RAID / stakeholder matrix / risk-register-as-grid) → STRETCH **Phase 106 (GRID-01)**.
- CPM/float + EVM/cost compute → deferred (REQUIREMENTS "Future").
- SEED-069 living-document output re-ingestion → deferred (the weekly status report is a natural
  candidate, but out of scope for 104).

</domain>

<decisions>
## Implementation Decisions

> **All code claims below were adversarially verified during discuss-phase** (5 refute-by-default
> agents, 13 claims, **all CONFIRMED** with the noted caveats; workflow `wf_9c59dcb9-7db`). The
> file:line anchors in `<canonical_refs>` are load-bearing — write tasks directly against them.

### D-104-1: How the pack ships + the "domain-author-driven" proof — opt-in self-contained seed script

- **The pack ships as ONE idempotent, opt-in provisioning script** (e.g. `scripts/seed-pm-pack.py`),
  NOT an auto-applied migration. It provisions the whole pack atomically: demo folder → synthetic
  source docs ingested → `.docx` templates uploaded to Storage + `AssetRef`s → published
  `workflow_definitions` rows. Opt-in because it ingests synthetic data + burns embeddings (D-104-3).
- **Scoped per-account (`is_global=false`), NOT global** — see D-104-3 for why (a global sample KB
  pollutes every tenant's search; a true `is_global=true` published pack + library assets is an
  **untested** path). The flagship runs **as the demo/seed account**.
- **"Domain-author-driven, no PM-hardcoded engine code" is proven two HONEST ways:**
  1. **Project Charter is authored end-to-end THROUGH the Workflows page** during the phase
     (describe → draft → refine-by-form → publish). It is a **TEXT deliverable** (`llm_single`/
     `llm_agent`), which the shipped page fully supports with **no template and no code** (C1 ✓).
     This is the live SC#1/SC#3 proof.
  2. **SC#3 "re-author/extend" is proven by Tweak → v(N+1)** on a seeded pack workflow: open a
     published def → fork to a new-version DRAFT (INSERT, never UPDATE) → edit → re-publish. The
     immutability trigger guarantees the shipped v1 stays frozen (C2 ✓).
- **The template-fill workflows (status, risk) are SEED-AUTHORED, and the context is upfront about
  why:** the shipped Builder has **no template-attach UI** (A3 ✓) and `/workflows/generate`'s
  `template_asset_id` is UUID-typed while the real library path is a Storage-path *string* (a dead
  path for library assets — A2 ✓). So a `.docx`-filling workflow **cannot be page-authored today**;
  it must ship as a pre-authored published definition with `assets[]` baked in.

### D-104-2: Pack contents — depth on the headline, breadth via two more

Three workflows ship, each mapped to the mechanism it fits:

| Workflow | Deliverable | Mechanism | Acceptance bar |
|---|---|---|---|
| **Weekly Status Report** | `.docx` (template-fill) | seeded; 2-phase `llm_agent`→`llm_emit` | **THE headline (SC#2) + the full SC#10 4-axis cross-provider scoreboard (D-104-6)** |
| **Risk Register** | `.docx` (template-fill) | seeded; 2-phase `llm_agent`→`llm_emit` | full publishable (judge-passing golden run on the default authoring/judge model); **no full scoreboard required** |
| **Project Charter** | TEXT / markdown | **authored through the page** (`llm_single`/`llm_agent`) | the live author-driven proof (D-104-1); publishable, no template |

- Depth (the full cross-provider proof) lands on **Weekly Status Report only** — three full
  scoreboards would be expensive and the headline is the singular acceptance bar.
- The "register schemas" deliverable (SC#1) = the **Risk Register** `EmitFieldMap`/template
  (RAID/stakeholder grids → Phase 106).

### D-104-3: Sample project KB — synthetic "PM Demo Project", per-account, opt-in

- Ship a small **synthetic** corpus (meeting notes / task-&-sprint updates / a risk log) seeded into
  a clearly-labeled folder (e.g. **"PM Demo Project (sample data)"**) so the flagship runs
  reproducibly end-to-end (SC#2/SC#10 acceptance is reproducible for the verifier).
- **Seed it per-account (`is_global=false`), NOT global.** Verified pollution risk (D1 ✓): docs in a
  global-folder subtree surface in **every** authenticated user's `search_documents` /
  `query_documents` / `list_documents`, and there is **no mechanism to exclude global-folder docs**
  from a user's search. A global demo corpus would silently contaminate every tenant's KB. Per-account
  seeding (docs INSERT RLS only needs `auth.uid()=user_id`) is trivial and pollution-free.
- **Ingest via the existing `POST /documents/upload` route** (preferred — produces byte-identical
  rows to a human upload, so dedup/versioning/freshness behave naturally), or `_upload_pipeline`
  in-process if no server is running. **Seed-time dependency: one live embeddings call per doc**
  (OpenAI by default) + a best-effort metadata LLM call — an embedding key must be configured before
  the seed runs. Keep the corpus small (N embedding calls).
- The status-report / risk-register workflow defs bind `project_folder_id = <the demo folder id>`
  (resolved by the script at seed time).

### D-104-4: Deliverable shape — 2-phase fill, standard PM sections, strict gates

- **Template-fill workflows are 2-phase, not 1-phase (load-bearing, B3 ✓):** `llm_agent` (retrieve
  with `search_documents`, `folder_scope`=the project folder) → `llm_emit` (`emitter:"render_template"`).
  The emit's citation gate validates cited `source_chunk_id`s against the source_refs gathered by the
  **upstream** retrieval phase; a lone emit phase has an empty valid-id set → every value reads
  "invented" → honest-fail under `citation_policy:"strict"`.
- **Weekly Status Report sections** (KB-grounded, each value cited): project name + reporting period
  (template-derived scalars), overall RAG status + summary, accomplishments this period, planned next
  period, risks & blockers, key milestones/metrics.
- **Risk Register schema** = the spike's proven 9-column shape (id, description, category,
  probability, impact, score, owner, mitigation, status) with a **worded→numeric Score mapping**
  (spike Condition 3 — deterministic, non-LLM: Low=1/Med=2/High=3) so `score = P×I` isn't blank on
  worded inputs. `.docx` only (pptx/xlsx caveated; pdf is a v1 stub).
- **Gates** on each fill phase: `citations_required` (mode `deterministic` over the emit field-map)
  + `output_file_valid` (re-opens the produced `.docx` via `assert_integrity`). `citation_policy`
  and `integrity_policy` default `strict` (B2 ✓). Each workflow declares one `business_requirement`
  (required at publish, E1 ✓).
- **Run UX** is the shipped single-textarea kickoff (E2 ✓): `POST /threads` → `POST /threads/{id}/
  messages` with `workflow_definition_id`; scope is baked into the def, not chosen at send-time. No
  bespoke run route, `threads.py` byte-identical.

### D-104-5: Template binding is seed-time (`assets[]` baked into the definition)

- The bound template is selected **server-side** by `_emit_bound_asset_ref(definition)`, which scans
  `definition.assets[]` for the entry with `kind=="template"` (NOT `assets[0]`, NOT a phase-config
  field — B1 ✓). The model never selects it.
- **Seed shape (A2 ✓):** upload bytes to bucket **`workspace-files`** at key
  **`{demo_user_id}/_library/<slug>.<ext>`** (the leading folder MUST equal the owner uid for RLS).
  That **exact path string** becomes `AssetRef.asset_id` (a Storage path, NOT a row id). The def's
  `assets[]` entry = `{asset_id: "<that path>", filename, kind:"template", mime: "<ooxml mime>"}`.
- The fill phase's `available_tools` MUST include `render_template` (else the harness never
  whitelists the render tool — WR-01 precedent).
- **Do NOT bind via `/workflows/generate`** (its `template_asset_id` is UUID-typed and won't match a
  path-keyed Storage key). Bake `assets[]` into the seeded definition JSONB directly.
- **Idempotency:** the 056/067 immutability trigger blocks UPDATE on a published row — the seeder
  must **DELETE-then-INSERT** to refresh, never UPDATE.

### D-104-6: SC#10 cross-provider scoreboard (the headline acceptance bar)

The Weekly Status Report runs the full 4-axis scoreboard. Because the forced emission composes ONE
shared gateway path (no provider branch in the emit path — E3 ✓), cross-provider coverage is a
**model-list problem, not N codepaths** — pick representatives that exercise each capability tier:
- **TIER-FORCE + strict:** OpenAI `gpt-*`, DeepSeek v4.
- **TIER-FORCE (no strict):** Anthropic `claude-*`, Google `gemini-*`, MiniMax.
- **TIER-COERCE (unforceable):** Moonshot/Kimi.
- **Use EXACT PascalCase IDs for GLM/MiniMax** (`MiniMax-M3` etc.) — a case-sensitivity registry miss
  silently degrades to coerce (the GLM/MiniMax tool-drop trap).
- Add a **long-deliverable row** for DeepSeek/Moonshot to prove the truncation guard fires as an
  HONEST failure, not a half-emitted artifact (reasoning-truncation trap).
- The Charter's NL-authoring demo should include an **OpenAI + DeepSeek authoring row** to confirm
  the Phase-103 `strict=False` override avoids a strict-mode 400 on the optional-heavy
  `WorkflowDefinition` shot.

### Claude's Discretion
- The exact synthetic corpus content (doc count, topics) — keep small to bound seed-time embedding
  cost; must contain the raw material the status report + risk register cite.
- Template visual design (`.docx` layout, `{%tr %}` rows, `{{ }}` tags) — must follow the spike's
  proven docxtpl tag conventions.
- Exact section copy / field labels in the templates.
- Whether the seed script drives the live publish gauntlet (golden run + judge) per workflow at
  provision time, or leaves publish to the verifier — both satisfy the seed shape (planner decides).

### Folded Todos
None — `gsd-sdk query todo.match-phase 104` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.** All backend file:line refs
were adversarially verified during discuss-phase (workflow `wf_9c59dcb9-7db`, all CONFIRMED).

### Locked requirement + roadmap
- `.planning/REQUIREMENTS.md` → **PM-01** (line 47) — the one requirement this phase closes.
- `.planning/ROADMAP.md` → "### Phase 104" (lines 220-229) — goal, 3 success criteria, SC#10 note.

### Schema (the def shape the pack authors)
- `backend/app/models/harness.py:123-154` — `LlmEmitPhaseConfig` (`emitter` default `render_template`;
  `citation_policy`/`integrity_policy` default `strict`; `folder_scope` resolved-id list; `skill_ref`).
- `backend/app/models/harness.py:170-186` — `ValidatorSpec` (kinds incl. `citations_required`,
  `output_file_valid`; `on_failure`/`max_retries`/`timing` defaults).
- `backend/app/models/harness.py:189-194` — `PhaseSpec` (`slug`/`phase_index`/`config`/`validators`/`name`).
- `backend/app/models/harness.py:214-218` — `AssetRef` (`asset_id` = **Storage path string**, `filename`,
  `kind:"template"|"reference"`, `mime`).
- `backend/app/models/harness.py:221-254` — `WorkflowDefinition` (`assets`, `project_folder_id`,
  `business_requirement`; the `_folder_scope_requires_project` model_validator — folder_scope needs a
  project_folder_id).
- `supabase/migrations/061_harness_seed_templates.sql` — the global-published seed pattern (fixed
  UUIDs, `ON CONFLICT DO NOTHING`, `is_global=true`). **NOTE: 0 existing seed defs use `llm_emit`/
  `render_template`/`assets`/`business_requirement` — the PM defs are entirely NET-NEW JSONB.**

### Template-fill executor + emitter (the fill mechanism)
- `backend/app/services/harness/phase_types.py:1050+` — `_exec_llm_emit`; `:724-741`
  `_emit_bound_asset_ref` (scans `definition.assets[]` for `kind=="template"`); `:789-857`
  `_emit_evidence`/`_retrieved_ids` (why a prior retrieval phase is required); `:1088-1109` asset
  resolution; `:1187-1195` the single `forced_emit` shot (no provider branch).
- `backend/app/services/harness/emitters.py:82-95` `resolve_emitter` (closed registry, only
  `render_template`); `:183-188` the `render_template` registration.
- `backend/app/services/template_render_service.py:186-198` — the flat `EmitFieldMap` output shape
  (scalars + rows, depth-3, all-nullable); `:356-413` `parse_docx_template_variables` (docx-only
  oracle); `:507-530` `is_truncated`.
- `backend/app/services/template_asset_service.py:81-134` — `resolve_template_source`
  (Branch 1 = library by `asset_id` Storage path, `provenance="library"`).
- `backend/app/services/harness/validator_kinds.py:191-231` `citations_required`; `:245-339`
  `output_file_valid` (config `path` is workspace-scoped via `get_file_by_path`, WR-07).
- `backend/tests/fixtures/seed_library_asset.py` — **the canonical library-asset seed recipe to mirror**
  (bucket/path/AssetRef/def-INSERT shape; `is_global=false` — flag for a global variant).
- `backend/tests/unit/test_llm_emit_executor.py:37-108` — working `AssetRef`/phase/`EmitFieldMap` fixtures.

### Publish gauntlet + judge (the quality gate the pack must pass)
- `backend/app/services/harness/publish_service.py:124` (business_requirement→400), `:184-196`
  (real golden run, `is_golden_run=True`, no mocks), `:264-294` (judge HARD blocker), `:296-325`
  (publish flip); `:638-740` `resolve_judge_model` (independent judge model, cross-provider key/base_url).
- `backend/app/api/workflows.py:166-213` — `POST /workflows/{id}/publish` + HTTP mapping.

### NL authoring + Tweak fork (the author-driven proof — Charter)
- `backend/app/api/workflows.py:343-384` — `POST /workflows/generate` (JSON only, optional
  `template_asset_id`/`template_placeholders`; **`template_asset_id` UUID-typed = dead path for
  library assets**).
- `backend/app/services/workflow_authoring.py:61-70` — the AUTHORING_SYSTEM_PROMPT **DELIVERABLE
  RULE** (no template → `llm_single`/`llm_agent` TEXT deliverable, never an unpublishable
  `render_template`; soft prompt steering, caught at publish not at /generate); `:358-486`
  `generate_workflow_definition` (`forced_emit(schema_model=WorkflowDefinition, strict=False)`,
  retry-once, honest-fail).
- `backend/app/db/workflows.py:269-297` `create_workflow_definition` (INSERT = the v(N+1) fork);
  `:192`/`:215-231` owner/global read predicates; `:238-260` `publish_definition` flip.
- `frontend/src/pages/WorkflowsPage.tsx:285-310` `onTweak` (v(N+1) INSERT fork); `WorkflowBuilderPage.tsx`
  (describe-first + project-folder dropdown + read-only spine + form panel); `PhaseFormPanel.tsx:654-709`
  (llm_emit form — read-only emitter, NO template attach).
- `supabase/full-schema.sql:226-244` — the live `workflow_definitions_block_published` immutability
  trigger (blocks published-row UPDATE; allows draft→published flip + DELETE).

### Run kickoff (the headline demo run)
- `backend/app/api/threads.py:1155` (`inputs={"kickoff_prompt": body.content}`), `:1326-1354`
  (scope from `definition.project_folder_id`, not the thread), `:1437`/`:1451` (ctx build). **G-5 hot
  file — read-only reuse, Deep byte-identical.**
- `backend/app/models/message.py:8-18` — `MessageCreate` (content + `workflow_definition_id` only).

### Sample-KB ingest + living-document infra
- `backend/app/api/documents.py:338-516` `upload_document` route (+ `_upload_pipeline:136-252`,
  `ingest_document:1334-1506` requires pre-extracted text). Embedding hard-dep:
  `backend/app/services/embedding_service.py:94-97` → `openai_service.py:1466-1477`.
- `backend/app/api/documents.py:402-423` (sha256 dedup), `:425-449` (filename versioning,
  `is_latest=false`), `:656` (`POST /documents/{id}/reingest`) — SEED-069 infra (already shipped).
- `supabase/migrations/019_global_folder_subtree_visibility.sql:54-62` +
  `supabase/full-schema.sql:2138` — global-folder doc visibility RLS (**the pollution mechanism** —
  why D-104-3 seeds per-account).

### Cross-provider tiers (SC#10)
- `backend/app/config.py:214-308` — `MODEL_CAPABILITIES` tiers (`forced_emission`/`strict_json_schema`),
  the GLM/MiniMax case-sensitive-miss → coerce safety (`:173-175`, `:295`), exact PascalCase IDs.
- `backend/app/services/forced_emit.py:215,237-275` (`strict` override + cross-provider judge
  key/base_url), `:323` (`open_stream`); `backend/app/services/provider_gateway/dispatcher.py:80-127`
  (the only per-provider branch — D-14 red line); `openai_compat.py:180-268,403-404` (`<think>`
  strip + force translation).

### Prior context (cross-phase consistency)
- `scripts/spike-097/CONCLUSION.md` — the GO + the schema shape + the 6 named failure modes + the
  worded→numeric Score mapping (Condition 3) + the full-native-roster mandate (Condition 7) +
  SEED-069 (Condition 8).
- `.planning/phases/103-.../103-CONTEXT.md` — the authoring/run surface this pack is authored on.
- `.planning/phases/101-.../101-CONTEXT.md` + `101.1-.../101.1-CONTEXT.md` — the template-fill +
  emission layer.
- `.planning/phases/102-.../102-CONTEXT.md` — the validation-gate library + publish path.
- `.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md`,
  `.planning/seeds/SEED-084-starter-workflow-library.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (compose, don't rebuild — ZERO new engine code)
- **`llm_emit` + `render_template` emitter** (101/101.1) — the entire template-fill mechanism. The
  PM defs are JSONB that drives it; no new phase type.
- **Validation-gate library** (102) — `citations_required` + `output_file_valid` attach as phase
  validators; `citation_policy`/`integrity_policy` are phase-config fields.
- **Publish gauntlet** (102) — `business_requirement` + real golden run + hard judge wall already
  enforce output quality. The pack's published defs pass it.
- **Workflows page** (103) — describe→draft→refine→publish (text deliverable) + Tweak→v(N+1) fork
  give the author-driven proof with no new UI.
- **`seed_library_asset.py` fixture** — the exact recipe (Storage bucket/path → AssetRef → published
  def INSERT) the production seed script mirrors.
- **`POST /documents/upload`** — the audited ingest path for the synthetic sample corpus.
- **`POST /threads/{id}/messages` + `workflow_definition_id`** — the run kickoff; no bespoke route.

### Established Patterns
- **Seed-as-data via migration/script** (061/066 pattern) — global published rows with fixed UUIDs,
  `ON CONFLICT DO NOTHING`; for published refresh use **DELETE-then-INSERT** (the immutability trigger
  blocks UPDATE).
- **Template binding lives in `definition.assets[]`, not the phase config** — server-side
  `_emit_bound_asset_ref` selects `kind=="template"`.
- **Forced structured emission composes ONE shared gateway path** — provider variance isolated to 3
  gateway adapters + the capability registry; cross-provider = a model-list problem.
- **Scope baked into the definition** (`project_folder_id`) — the model cannot widen it; run carries
  one free-text `kickoff_prompt`.

### Integration Points (where new content connects)
- New seed script under `scripts/` (off the uvicorn `--reload` watched `backend/` tree).
- The pack's workflow defs land in `public.workflow_definitions`; templates in Storage bucket
  `workspace-files` under `{demo_user_id}/_library/`; sample docs in a per-account "PM Demo Project"
  folder via `/documents/upload`.
- The Charter is authored live via the shipped Workflows page (`/workflows/generate` → publish).
- **No `threads.py` / `anthropic_service.py` change; no new migration required for the schema** (all
  fields are additive-optional and already shipped); a migration is only needed IF the pack ships
  global defs (see `<deferred>` is_global flag).

</code_context>

<specifics>
## Specific Ideas
- **The headline status-report workflow is 2 phases on purpose** — retrieve (`llm_agent`
  `search_documents`) then fill (`llm_emit`). A single-phase emit honest-fails the citation gate.
- **Each deliverable maps to the mechanism it fits:** Charter = page-authored TEXT (the live proof);
  Status + Risk = seeded template-fill `.docx` (the page can't attach a template). Be HONEST in the
  pack docs that template-fill is seed-authored, not page-authored, today.
- **Seed the sample KB per-account, never global** — a global sample corpus pollutes every tenant's
  `search_documents`/`list_documents` with no exclusion mechanism (verified D1).
- **Bake `assets[]` into the def JSONB directly** — `/workflows/generate`'s `template_asset_id` is
  UUID-typed and won't resolve a path-keyed library asset (verified A2 seam).
- **Use exact PascalCase model IDs for the SC#10 GLM/MiniMax rows** — a case miss silently degrades
  to coerce; cover all three forcing tiers + a reasoning-truncation row.

</specifics>

<deferred>
## Deferred Ideas

- **Run-surface DEEP refinement + 3 render bugs** (`BUG-260609-02`, `BUG-260609-04`,
  `BUG-260610-01`) — D-103-A carved these to a candidate **103.1**. Kept OUT of 104 (content-only).
  Status unchanged (deferred/routed).
- **Globally-shared (`is_global=true`) variant of the pack** — would make the flagship visible to all
  tenants out-of-box, BUT (a) a global project folder pollutes every user's KB search (no exclusion
  mechanism), and (b) a published `is_global=true` def + library assets is an **untested** path (the
  fixture ships `is_global=false`). Deferred; pairs with **ROLE-01 (STRETCH Phase 109)** /
  operator-publish. 104 ships per-account.
- **Builder template-attach affordance** — a UI control to attach/upload a `{{placeholder}}` template
  in the Builder (so template-fill workflows become page-authorable). Deferred per D-103-3 / adjacent
  to **SEED-084**. Re-open: when template-grounded NL authoring becomes a headline user request.
- **`/workflows/generate` `template_asset_id` UUID-vs-Storage-path-string seam** — a real half-built
  path (the route types UUID; the library path is a path string). 104 sidesteps it by baking
  `assets[]` directly. Worth a follow-up fix/reported-bug, NOT in 104 scope.
- **SEED-069 living-document output re-ingestion** — the weekly status report (recurring artifact) is
  the canonical candidate; the infra exists (dedup/versioning/reingest). Deferred — out of 104 scope.
- **Grids (RAID / stakeholder / risk-register-as-grid)** → **Phase 106 (GRID-01, STRETCH)**.
  **CPM/EVM math** → deferred (REQUIREMENTS "Future").
- **Starter/fork-a-template workflow library** → **SEED-084**.

### Reviewed Todos (not folded)
None — 0 todos matched Phase 104.

### Reported-bugs cross-check (mandatory, `surface: Agentic-RAG` only)
6 open `surface: Agentic-RAG` reports reviewed; **none overlap a content-authoring domain** —
all are streaming/provider/run-honesty/run-UI defects (`BUG-260609-02`, `BUG-260609-04`,
`BUG-260610-01`, `general-chat-intermittent-silent-send-drop`, `minimax-m3-invalid-tool-args-400`,
`setting-up-agent-hides-model-activity`). None folded. The 3 run-surface ones are already routed to
103.1 by D-103-A. **Watch `minimax-m3-invalid-tool-args-400`** as a known risk for the SC#10
MiniMax scoreboard row (forced structured generation on MiniMax) — exact PascalCase ID mitigates.

</deferred>

---

*Phase: 104-pm-flagship-content-pack*
*Context gathered: 2026-06-14*
*All load-bearing code claims adversarially verified (5 agents / 13 claims / all CONFIRMED, workflow wf_9c59dcb9-7db) before lock.*
