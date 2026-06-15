---
title: "v2.9 Exploration — Capability Gap Map + Deferred Connector Layer (our-stack reality check)"
dimension: F (capability-gap-and-connectors)
date: 2026-06-08
author: research subagent (codebase + planning analysis)
scope: Map the v2.9 "real, domain-grounded workflows" vision onto what ALREADY exists in the codebase; identify the true gaps + the deferred connector layer. File-level evidence only.
verdict: ~70-80% of the project-scoped/skill-connected/template-fill vision is expressible by COMPOSITION on shipped v2.8 primitives. The net-new surface is small and well-bounded — 4 additive bindings + 1 ephemeral-upload path + the authoring PAGE. Connectors stay deferred (already seeded).
---

# F — Capability Gap Map & Connectors

## TL;DR

The v2.8 Harness Engine is a complete, locked, resumable workflow runtime. A
"project-scoped, skill-connected, template-filling" workflow is **~80% expressible
TODAY by composition** of existing phase types — the worked example in
`.planning/notes/workflow-authoring-exploration-2026-06-03.md` already proves this
(legal-contract case → 5 of 6 phases map onto shipped primitives). What is genuinely
missing is **not the engine** — it is a small set of **additive bindings** on the
definition model + **one ephemeral-upload path** + **the authoring PAGE/API** (which is
entirely unbuilt). None of the missing pieces require touching the engine's hot path;
they grow the JSONB definition format (which immutability-on-publish does NOT forbid —
"no-edit-published, not no-grow-format", per SEED-051) and add thin executor seams.

Connectors (email/OneDrive/GDrive auto-ingestion + outbound "send") are **already
seeded** (SEED-013 inbound + API/MCP, SEED-014 scheduled/triggered, SEED-051 outbound
plugin seam) and are **NOT v2.9 scope** — they are the *first consumers* that arrive
after the Plugin Contract `data_source`/`secrets_adapter` types are locked.

---

## CAPABILITY GAP MAP (per vision-element)

Legend: ✅ exists · 🟡 partial · ❌ missing

### V1. Project = a folder+subfolders that OWNS a library of workflows

**Status: ❌ missing (the binding) — but every constituent exists**

- ✅ Nested folders (global + per-user, RLS) — shipped since v1.0 (PROJECT.md:81-97).
- ✅ Workflow definitions exist as rows: `workflow_definitions` (migration 056) with
  `slug`/`version`/`name`/`status`/`is_global`/`created_by`/`definition` JSONB,
  immutable-on-publish trigger + `UNIQUE(slug, version)` + RLS (SEED-051:70-72).
- ❌ **No `project_folder_id` / no folder↔workflow ownership link.** A
  `WorkflowDefinition` (`backend/app/models/harness.py:118-124`) has NO folder field; a
  workflow is not "owned by" a folder. There is no "this folder's workflow library"
  concept anywhere.
- ❌ **No project entity.** "Project" today = just a folder. There is no table or model
  binding {folder subtree + workflow library + skills} into one unit.

**Smallest bite:** add an OPTIONAL `project_folder_id: UUID | None` to
`WorkflowDefinition` (grows the JSONB, breaks no published rows) + a list endpoint
filtered by folder. No engine change. A "project" is then just a folder that has
workflows pointing at it — no new heavy entity needed for v1.

### V2. Workflows connected to SKILLS

**Status: ❌ missing — clean additive seam, zero overlap today**

- ✅ Skills fully shipped: `skills` table (global/private, RLS), `skill_files` in the
  `skill-files` Storage bucket, `load_skill`/`save_skill`/`read_skill_file` tools
  (`backend/app/services/tool_dispatcher.py:312-440`), catalog injected into the **Deep
  General-mode** system prompt (`agent_loop.py` ~930), ZIP import/export
  (`backend/app/api/skills.py` `/import` `/export`, agentskills.io format).
- ❌ **A harness phase CANNOT use a skill today.** Verified orthogonal (exploration note
  session-2, lines 120-127): a harness phase REPLACES the global system prompt with
  `phase.config.prompt` via `system_prompt_override`
  (`backend/app/services/harness/phase_types.py:288, :307`) → the skills catalog never
  reaches the phase model; and `load_skill` is whitelisted in **none** of the 4 seed
  workflows. Two separate subsystems, no contradiction, no wiring.
- The open decision already exists: `.planning/research/questions.md` #4 — "Should a
  phase be able to inject a Skill? Recommend: design the field now (`skill_ref` on
  llm_agent/llm_single configs), wire in v2.9."

**Smallest bite:** add OPTIONAL `skill_ref: str | None` to `LlmAgentPhaseConfig` /
`LlmSinglePhaseConfig` (`models/harness.py:50-62`); in `_exec_llm_agent`
(`phase_types.py:259`) resolve the skill's `instructions` and prepend/compose into
`system_prompt_override`, and auto-whitelist `read_skill_file`. Additive — Deep path
untouched, byte-identical.

### V3. Workflows scoped to the PROJECT's KB (folder subtree)

**Status: 🟡 partial — mechanism is solid; the SOURCE of scope is wrong for "project-owned"**

- ✅ Folder-scoped retrieval works end-to-end: `search_documents(folder_ids=…)`
  (`tool_dispatcher.py:165-172`), subtree walk + path build
  (`backend/app/api/threads.py:1192-1232`), keyword/glob/ls/tree all scoped
  (`tool_dispatcher.py:124-151`). `ToolContext.folder_subtree_ids` /
  `scoped_folder_path` (`tool_dispatcher.py:69-70`) are first-class.
- 🟡 **Scope is THREAD-derived, not WORKFLOW-owned.** At harness kickoff the subtree is
  computed from `threads.folder_id` (the folder the launching thread sits in,
  `threads.py:1195-1232`) and applied uniformly to every phase. So a workflow is scoped
  to the project's KB **only if the user happens to launch it from a thread in that
  folder** — the scope is not bound to the definition, and there is no **per-phase**
  folder pinning. (`questions.md` #7 — per-phase `folder_scope` is an explicit open
  decision; the exploration note marks "per-phase folder scoping" as a design choice not
  yet built.)

**Smallest bite:** source `folder_subtree_ids` from the workflow's `project_folder_id`
(V1) instead of — or as an override of — the thread folder, in the same threads.py block
that already builds it. Per-phase `folder_scope` is a later refinement (the subtree-walk
helper already exists). No new infra; a sourcing change.

### V4. Upload a TEMPLATE (docx/pptx/xlsx) temporarily → retrieve from KB → fill THAT exact template

**Status: ❌ missing (ephemeral upload + first-class fill) — generation half ✅ via sandbox**

- ✅ **Generation/fill mechanics exist.** Sandbox ships `python-docx` + `python-pptx` +
  `openpyxl` + `reportlab` + pandas/matplotlib (CLAUDE.md sandbox section;
  `backend/Dockerfile.sandbox`). An `llm_agent [search_documents, execute_code,
  write_file]` phase can read the KB, compute fill values, run python-docx, and emit a
  workspace file. The worked example marks "fill the template deterministically" ✅
  (note line 64).
- ❌ **No ephemeral / temporary in-chat upload path anywhere.** Three upload routes
  exist, NONE ephemeral:
  1. `backend/app/api/documents.py:338 /upload` → **permanent KB document**
     (storage→extract→chunk→embed via `_upload_pipeline` BackgroundTask). Not temporary.
  2. `backend/app/api/skills.py:414 /{skill_id}/files` → **skill-scoped** asset.
  3. Workspace files are **agent-written only** — `workspace_service.py` exposes
     `write_file/read_file/list/delete/diff` (lines 209-473) but **no `UploadFile`
     route** (grep confirms zero `UploadFile` in the service). The user cannot put a file
     INTO the workspace.
  → So the user's template bytes have **no home** the sandbox can read. This is the one
  genuinely net-new surface for template-fill.
- ❌ **No `inputs`/`assets` on `WorkflowDefinition`.** `create_workflow_run`
  (`backend/app/db/workflows.py:58-127`) persists an `inputs` jsonb, but the only key the
  engine reads is `kickoff_prompt` (free text — `phase_types.py:110-119`). No typed
  launch-form inputs; no workflow-owned attached assets. (`questions.md` #5/#6; worked
  example marks "inputs / launch form" ⚠️ gap, note line 62.)

**Smallest bite (spike-first per SEED-051):** add `POST /threads/{tid}/workspace/files`
that lands a user upload via the existing `workspace_service.write_file` + `workspace-files`
bucket (run/thread-scoped, TTL-eligible) → an `execute_code` phase reads it with
`read_file` and fills it. SEED-051's recommended spike exists precisely to prove
"KB-grounded docx/pdf fill is robust enough to make first-class" before committing the
`assets` schema (`questions.md` #6).

### V5. Workflows PAGE + NL/visual authoring

**Status: ❌ entirely unbuilt — confirmed both ends; richly pre-planned**

- ❌ **No Workflows page / no route.** `frontend/src/pages/` contains Auth, Skills,
  Ingestion, KnowledgeHealth, Settings — **no WorkflowsPage**. The ONLY workflow UI is
  launch-from-composer: the Deep/Harness pill + published-workflow picker in
  `frontend/src/components/chat/MessageInput.tsx:21-67` + the panel phase timeline
  (`components/panel/PhaseTimeline.tsx` / `PhaseCard.tsx`). The operator's stated bar:
  "picking a workflow from a composer menu is not user-friendly nor practical"
  (SEED-051:97-99).
- ❌ **Backend authoring API is read-only.** `backend/app/api/workflows.py` is a SINGLE
  endpoint — `GET /workflows/published` (the picker feed). Its header states verbatim:
  "There was NO workflows API router before this … only the engine ran workflows, no live
  HTTP surface." No create/draft/update/publish endpoint exists. Workflows are authored
  ONLY as SQL seed templates (migrations 061/065/066, `eval_coverage` etc.).
- ✅ **The substrate for safe NL-authoring is already in place** (SEED-051:64-82):
  - The strict `WorkflowDefinition` + discriminated-union `PhaseConfig` with
    `extra="forbid"` (`models/harness.py`) **IS** the NL-generation response schema —
    safe-by-construction (the model literally cannot emit unknown fields).
  - `reachability.py:lint_workflow` (orphans / unsatisfiable skips / `INPUT_UNSATISFIED`)
    is the publish gate that kills structurally-broken graphs.
  - Migration 056 immutable-on-publish + `UNIQUE(slug,version)` + RLS (users draft
    `is_global=false`; only operator publishes global) = the versioning + authz substrate.
- 📋 **Prior planning is dense:** SEED-051 (generalized NL→workflow authoring, spike-first),
  the exploration note (worked example + skills/workflows/tools/agents taxonomy +
  two-grounding-moments), `questions.md` (8 open decisions), **D-092-AUTHOR**
  (NL-describe → strict-parse → form-edit → lint → publish; explicitly NOT a drag-canvas)
  and **D-092-UX** (execution stays thread-bound; library/builder is a PAGE). The
  `sketch-findings-agentic-rag` skill already names "Workflows page, NL workflow builder"
  as a sketch surface (G-2 fires — sketch before plan).

**Smallest bite:** Phase A = the authoring API onto the existing validator/lint (CRUD
draft definitions, lint-on-publish) — no generator yet. Phase B = NL→draft via the
structured-output layer we already own (`questions.md` #3 recommends one-shot structured
call → `model_validate` + lint + auto-retry). The live read-mostly visualization renders
the `WorkflowDefinition` + `reachability.py` graph we ALREADY compute (cheap; reuse, no
new backend).

---

## PLUGIN CONTRACT (D-v2.8-01) — which of the 6 types the v2.9 vision exercises

**Decision** (`.planning/milestones/v2.8-ROADMAP.md:292`): "v2.8 = Harness Engine +
dual-mode ONLY; the 6-type Plugin Contract + `super_admin`/operator role tier deferred to
v2.9 (cross-milestone load-bearing — lock on real harness telemetry, mirrors the v2.7
split)." The 6 types (PROJECT.md:30): **`tool`, `panel_renderer`, `phase_type`,
`file_preview`, `data_source`, `secrets_adapter`**.

How strongly the project-management / template-fill flagship exercises each:

| Plugin type | Exercised by v2.9 vision? | Evidence / why |
|---|---|---|
| **`phase_type`** | **STRONGLY** | A first-class "fill_template" phase type IS a plugin phase_type. The dispatch SEAM already exists: `PHASE_TYPE_REGISTRY` (`harness_engine.py:111`) + `register_all()` (`phase_types.py:573`). `questions.md` #6 asks whether fill is a phase. This is the single most-exercised type. |
| **`file_preview`** | **STRONGLY** | Viewing the filled docx/pptx/xlsx in the panel = exactly **SEED-037** (office/PDF in-panel viewer gap) and the named **PPTX reference plugin** (PROJECT.md:30). A real consumer with a real gap. |
| **`tool`** | **YES** | A `fill_template` / domain tool, or the eventual `send` tool, as registered plugin tools (`_TOOL_REGISTRY` is the existing closed-registry pattern). |
| **`data_source`** | **PARTIAL (seam only)** | The "upload a template" ephemeral path + future KB connectors = the `data_source` extension type. SEED-051:160-163 cross-links it: "Plugin Contract `data_source`/`secrets_adapter` must meet the workflow engine at the 'send' phase." Touched by the upload seam; fully exercised only when connectors land. |
| **`secrets_adapter`** | **NO (deferred with connectors)** | Only needed for outbound send / external creds (email/DocuSign/GDrive). The core template-fill flagship never authenticates outward. Arrives with the connector layer. |
| **`panel_renderer`** | **LEAST** | A custom run/phase visualization. The live workflow-builder visual is explicitly "reuse the data we already compute, not a new renderer" (SEED-051:123-125). Barely touched. |

**Scope implication:** the v2.9 template-fill flagship gives **`phase_type` + `file_preview`
(+ `tool`)** real, telemetry-generating consumers to LOCK the contract against — which is
exactly D-v2.8-01's rationale ("lock on real harness telemetry"). `data_source` /
`secrets_adapter` should be DESIGNED (seam named) but locked later with connectors;
`panel_renderer` can be specified last. Don't try to exercise all 6 with one vision.

---

## CONNECTORS (FUTURE) — deferred email/OneDrive/GDrive auto-ingestion

**Existing ingestion-automation hooks: NONE.** CLAUDE.md rule is explicit: "Ingestion is
manual file upload only — no connectors or automated pipelines." Confirmed in code +
seeds:
- Only ingest path = `documents.py /upload` (manual UploadFile; the BackgroundTask is just
  async extract, not a connector).
- No webhooks (in/out), no scheduler, no event bus (SEED-013:42-47 audit: "No MCP code
  anywhere", "No webhook system", "No API keys/service accounts"; SEED-014:58-60: "nothing
  is responsible for wake-at-time-T-and-run-X", "no event bus").

**Recommendation: do NOT mint a fresh standalone seed — these are already owned. Route +
add concrete re-open triggers as addenda:**

1. **Inbound auto-ingestion (email/OneDrive/GDrive → KB) → SEED-013 (External
   Integrations: API + MCP + Webhooks + Service Accounts).** SEED-013 Phase 3 already
   names "Incoming — endpoint that accepts a document URL or content + metadata, kicks off
   ingestion." Add an addendum: *"Source connectors (GDrive/OneDrive/email inbox) are the
   first concrete `data_source` plugins — re-open when the v2.9 Plugin Contract
   `data_source` type is being designed; the first reference `data_source` should be a
   read-only GDrive/OneDrive folder→KB sync."*
2. **Scheduled / triggered ingestion (watch a folder/feed → ingest) → SEED-014
   (Automations & Routines, v3.4).** Already lists `document.ingested` triggers + RSS/feed
   monitors with watermarks. Re-open trigger: *"first request to auto-pull a
   GDrive/OneDrive/IMAP source on a schedule."*
3. **Outbound "send the filled artifact" (email/DocuSign/GDrive upload) → SEED-051 plugin
   seam + Plugin Contract `data_source`/`secrets_adapter` + a `programmatic`/`tool` `send`
   phase.** SEED-051:160-163 already cross-links this; the worked example marks step 6
   ("send to client") as "the one genuinely-new surface → v2.9 Plugin Contract." Keep it a
   named seam in v2.9, build the connector after the contract locks.

**Concrete re-open trigger to plant (single line, ties all three to v2.9):** *"When the
v2.9 Plugin Contract `data_source` and `secrets_adapter` types enter design, the FIRST
reference data_source = a read-only external-folder→KB connector (GDrive/OneDrive) and the
FIRST secrets_adapter = its OAuth token store — but auto-ingestion + outbound send are
post-contract consumers (v3.x via SEED-013/014), NOT v2.9 build scope."*

**Not v2.9:** v2.9 = lock the contract TYPES + `super_admin`/operator role tier + ONE
reference plugin (PPTX preview). Connectors are the payoff that the locked contract
enables next — building them inside v2.9 would re-introduce exactly the "lock the contract
wrong, then it's expensive" risk D-v2.8-01 defers against.

---

## Engine deep-dive: can the harness express the vision by COMPOSITION today?

**Yes for the orchestration; no for the bindings.** The worked example
(`workflow-authoring-exploration-2026-06-03.md:54-72`) is the ground-truth answer — the
recurring legal-contract case maps to:

| # | Phase (our type) | Status today | Evidence |
|---|---|---|---|
| inputs | launch form | ⚠️ free-text only | `create_workflow_run` persists `inputs` jsonb but engine reads only `kickoff_prompt` (`phase_types.py:110-119`) |
| 1 | `llm_agent [search_documents]` pull KB data | ✅ (thread-scoped) | `_exec_llm_agent` (`phase_types.py:259`) + folder scope (`threads.py:1192-1288`) |
| 2 | `execute_code` fill template | ✅ generation / ❌ user-template input | sandbox libs present; no ephemeral upload to feed the exact template |
| 3 | `llm_single`/`llm_agent` analyze clauses | ✅ | `_exec_llm_single` (`phase_types.py:238`) |
| 4 | `llm_human_input` review before send | ✅ first-class | `_exec_llm_human_input` (`phase_types.py:411`) — pause/resume, draft carried |
| 5 | `llm_single` final → workspace file | ✅ | final phase output IS the chat message (D-10), `write_file` writes the artifact |
| 6 | `programmatic` **send** | ❌ → Plugin Contract | the one new outbound surface (deferred) |

Locked-in correctness the engine ALREADY provides (do NOT rebuild): deterministic
index-driven order (LLM can't escape — `harness_engine.run_workflow` while-loop), per-phase
tool whitelist enforced at `dispatch_tool` (`tool_dispatcher.py:1615`) + `apply_tool_budget`
(`phase_types.py:277`), 4 validator kinds + bounded retry ≤3 + step/wall-clock caps
(`_run_phase_with_gates`), 2-phase write resumability (`db/workflows.py`
mark_active→complete-with-output), immutable-on-publish definitions, INSERT-only audit
trail, run-level grounding union (F7) so the final answer shows earlier phases' sources.

**The net-new for v2.9 is therefore a short additive list, none on the engine hot path:**
1. `project_folder_id` (+ optional per-phase `folder_scope`) on the definition — folder↔workflow binding (V1/V3).
2. `skill_ref` on `LlmAgent`/`LlmSingle` phase configs — workflow↔skill binding (V2).
3. `assets` + typed `inputs` schema on `WorkflowDefinition` + an ephemeral workspace-upload endpoint — template handling (V4).
4. A `fill_template` first-class capability — either a `phase_type` plugin or a registered tool (V4 / Plugin `phase_type`).
5. The Workflows PAGE + authoring API/generator (V5) — the largest piece, but greenfield (no hot-file refactor; G-5 doesn't fire here).

All five GROW the JSONB definition format / add new surfaces; immutability-on-publish
forbids editing published rows, not growing the format (SEED-051:129-132). Spike-first is
the operator-agreed approach (SEED-051:127-141, `questions.md`).

---

## Key load-bearing files (for the planner)

- Engine: `backend/app/services/harness_engine.py` (`run_workflow`, `PHASE_TYPE_REGISTRY`)
- Model (NL-gen schema): `backend/app/models/harness.py` (`WorkflowDefinition`, `PhaseConfig`)
- Executors / seams: `backend/app/services/harness/phase_types.py` (`system_prompt_override`:288, folder ctx build:151-201)
- Lint gate: `backend/app/services/harness/reachability.py` (`lint_workflow`)
- Run creation / DB: `backend/app/db/workflows.py` (`create_workflow_run`:58, `list_published_workflows`:130)
- API (read-only today): `backend/app/api/workflows.py` (`GET /workflows/published` only)
- Folder scope wiring: `backend/app/api/threads.py:1192-1288`; `tool_dispatcher.py:60-106` (ToolContext), `:165-172` (scoped search)
- Skills: `backend/app/api/skills.py`; `tool_dispatcher.py:312-440` (load/save/read_skill_file)
- Workspace (agent-write only, NO user upload): `backend/app/services/workspace_service.py`
- KB upload (permanent only): `backend/app/api/documents.py:338`
- Frontend workflow UI (no page): `frontend/src/components/chat/MessageInput.tsx`, `components/panel/PhaseTimeline.tsx`
- Planning: `.planning/seeds/SEED-051-*`, `.planning/notes/workflow-authoring-exploration-2026-06-03.md`, `.planning/research/questions.md`, `.planning/milestones/v2.8-ROADMAP.md:290-298` (D-v2.8-01)
- Connector seeds: `SEED-013` (inbound/API/MCP/webhooks), `SEED-014` (scheduled/triggered), `SEED-051:160-163` (outbound send seam)
