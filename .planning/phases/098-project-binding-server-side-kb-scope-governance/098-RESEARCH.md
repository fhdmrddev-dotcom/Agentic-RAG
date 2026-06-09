# Phase 098: Project Binding + Server-Side KB Scope Governance - Research

**Researched:** 2026-06-09
**Domain:** Backend schema-lock (Pydantic over JSONB) + server-side KB retrieval-scope governance (FastAPI / Supabase RPC / Redis run-events)
**Confidence:** HIGH (every code seam read directly; line numbers verified against current files, not CONTEXT's approximations)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add `project_folder_id: UUID | None = None` to `WorkflowDefinition`. Binds a workflow to **one** project folder + subtree = default read scope. Old unbound workflows keep validating (zero-migration, additive). A project is a **single-folder object**; the output target is a *separate* field (D-08).
- **D-02:** Add `folder_scope: list[UUID] | None = None` to the `LlmAgent` / `LlmSingle` phase configs. It is a **bound, resolved id list** — NOT a prompt hint. Name/path→id resolution is an authoring-time (Phase 103) concern; the field stored here is always resolved UUIDs.
- **D-03:** The Workflows library is **filterable by `project_folder_id`** at the API/data layer (a `GET` query filter on workflow-definitions load). The library *page* UI is Phase 103 — 098 ships only the queryable capability.
- **D-04:** `scope_folder_ids` resolved **server-side at run start from the user's RLS context**, bound to every retrieval call the model cannot override. Reuses the existing `ctx.folder_subtree_ids` → `search_documents(folder_ids=...)` → RPC `p_folder_ids` channel, but sources scope from the **workflow's `project_folder_id` (+ per-phase `folder_scope`)** rather than the thread folder.
- **D-05:** Retrieved `folder_id`s asserted **⊆ scope**; RLS remains backstop. DB RPC folder filter (`d.folder_id = ANY(p_folder_ids)`) is primary enforcement; post-query assert is the in-app guard.
- **D-05a (GATED — Deep byte-identical red line):** The ⊆ assert + clip live on the path **shared with Deep mode**. The assert runs **only when scope is present**; when `folder_ids is None` (Deep whole-KB) it is a **literal no-op**. Shared retrieval path stays byte-identical for Deep.
- **D-06:** On a runtime scope violation: **clip + observe** — drop offending rows, continue the run, **emit a visible warning event** (e.g. `scope_violation`) on the **existing harness run-event channel** buffered to the Phase-061+ Redis run buffer `run:{run_id}`. NOT a hard fail; NOT silent.
- **D-07:** A per-phase `folder_scope` must be **narrow-only** — a subset of the project subtree. Enforced by a **server-side validator that runs whenever a definition is validated/saved**, independent of the Phase-103 publish UI. A non-⊆ scope is a **validation error at definition-save/validate time**, NOT silently clipped at runtime.
- **D-08:** **Lock the field SHAPES now; defer the BEHAVIOR.** Add additive-optional to `WorkflowDefinition`: `output_target_folder: UUID | None = None`, `reingest_output: bool = False`, `version_policy: Literal["supersede-by-filename","keep-all"] = "supersede-by-filename"`, `provenance: Literal["source","derived"] = "source"` (the one genuinely net-new field — self-feedback guard). Re-ingestion wiring is Phase 100/101/102.
- **D-09:** 098 runs **representative-4 live UAT** (OpenAI, Anthropic, Google, OpenRouter). Scope is provider-agnostic by construction. Full native-7 structured-output validation is **reserved for Phase 101**. `minimax-m3-invalid-tool-args-400` is a **watch item** only.
- **D-10:** All new fields **OPTIONAL** on the `_StrictBase` (`extra="forbid"`) models → existing published rows `model_validate()` cleanly. Immutability stays per-version.
- **D-11:** `Cited` provenance lives in run **OUTPUT only**, never in an `inputs`/schema field.
- **D-12:** `folder_scope` is a **resolved UUID list**, never a string path; bound via the existing `ToolContext.folder_subtree_ids` seam.
- **D-13:** GOV-01 act/export separability is **already provided** by the existing per-phase `phase_whitelist`. 098 only **preserves** it + adds **one UAT row** asserting an act/export tool can be excluded from a read-only phase's whitelist.

### Claude's Discretion
- **Co-locking `inputs` / `assets` shapes:** 098 is not required to lock these (PROJ/GOV only). **Lean: co-lock the shapes** to avoid a second additive change on the model; behavior stays Phase 100/103. If co-locked, carry spike open-Q (i): `InputFieldSpec.source` enum includes `"template_derived"`. → **Researcher recommendation below: CO-LOCK (storage is JSONB → zero marginal cost). See §1.**
- **Migration mechanics** (column types, single vs split migration, exact RPC assert placement) are planner implementation choices. → **Researcher finding below: NO migration is needed at all. See §1 + §6.**

### Deferred Ideas (OUT OF SCOPE)
- Output re-ingestion BEHAVIOR (SEED-069 wiring) → Phase 100/101/102. 098 locks only shapes.
- `inputs` / `assets` field BEHAVIOR → Phase 100 (assets) + Phase 103 (inputs / launch form / NL authoring).
- Full native-7 + OpenRouter structured-output validation (Condition 7) → Phase 101.
- Workflows page UI (project filter surface) → Phase 103 (sketch-gated, G-2).
- `minimax-m3-invalid-tool-args-400` → leave open; watch during 098 cross-provider UAT.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PROJ-01** | A workflow can be bound to a project (folder + subtree) via optional `project_folder_id`; the Workflows library can be filtered to a project. | §1 (additive field on `WorkflowDefinition`, JSONB storage → zero-migration) + §5 (the `GET /workflows/published` + `list_published_workflows` filter seam). |
| **PROJ-02** | A bound workflow's KB retrieval defaults to its project subtree; optional per-phase `folder_scope` narrows for that phase. Scope from the binding, not a prompt hint. | §1 (the `folder_scope` field) + §2 (`_build_phase_tool_context` narrowing seam + run-start resolution at all 3 ctx-build sites). |
| **GOV-01** | Retrieval scope (`scope_folder_ids`) resolved server-side from RLS context at run start, bound to every retrieval call the model can't widen; retrieved `folder_id`s asserted ⊆ scope (RLS backstop); read-untrusted vs act/export separable via per-phase tool whitelist. | §2 (the existing scope channel + where the source changes) + §3 (the ⊆ assert+clip+`scope_violation` event seam, Deep-gated) + D-13 (whitelist already provides act/export separability). |
</phase_requirements>

## Summary

098 is **schema-lock + governance-wiring**, not greenfield. The server-side scope channel **already exists end-to-end** and was verified line-by-line: `ToolContext.folder_subtree_ids` → `_handle_search_documents` → `retrieval_service.search_documents(folder_ids=...)` → `_vector_search`/`_keyword_search` → RPC `p_folder_ids` → `d.folder_id = ANY(p_folder_ids)`. The model already cannot widen scope through tool args (the dispatcher passes `ctx.folder_subtree_ids`, never `args`). What is missing is (a) the schema fields that let a workflow *carry* a project binding + per-phase scope, (b) sourcing the run-start scope from that binding instead of the thread folder, (c) the explicit post-query ⊆ assert + clip + observable warning, and (d) the narrow-only definition validator.

**The pivotal finding (answers the brief's central question): `workflow_definitions.definition` is a single `jsonb` column** (`full-schema.sql:701`; the full `WorkflowDefinition` is `model_validate()`'d out of it at `harness_engine.py:1070` and `threads.py:862`). **Therefore the entire schema lock is a Pydantic-only change with ZERO SQL migration** — old rows' JSONB simply lacks the new keys, and because every new field is optional-with-default on an `extra="forbid"` model, `model_validate()` fills defaults and old published rows validate unchanged. The only thing that could *optionally* introduce a migration is an expression index for the PROJ-01 library filter — and even that is unnecessary because the filter can run as a JSONB-path predicate (`definition->>'project_folder_id'`).

**Primary recommendation:** Ship 098 as a **zero-migration** phase: additive-optional Pydantic fields on `WorkflowDefinition` + the retrieval-bearing phase configs; source run-start `scope_folder_ids` from `project_folder_id` at all **three** harness ctx-build sites (live kickoff, resume sweep, Continue); narrow per-phase inside `_build_phase_tool_context`; land the ⊆ assert + clip + `scope_violation` emit inside `_handle_search_documents` gated on `ctx.folder_subtree_ids is not None` (literal no-op for Deep); add a JSONB-path `project_folder_id` filter to `list_published_workflows`. Co-lock `inputs`/`assets` shapes (free under JSONB).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project-binding storage (`project_folder_id`, `folder_scope`, output-side fields) | Database / Storage (JSONB `definition`) | API/Backend (Pydantic model) | Single JSONB column already holds the whole definition; no relational shape needed for the lock. |
| Run-start scope resolution (`project_folder_id` → subtree) | API/Backend (harness ctx-build sites) | Database (folder tree via `fetch_visible_folders`) | Server resolves from the user's RLS context at run start; the model never participates. |
| Per-phase `folder_scope` narrowing | API/Backend (`phase_types._build_phase_tool_context`) | — | Phase config is read where the per-phase `ToolContext` is built. |
| ⊆ assert + clip + observable warning | API/Backend (`tool_dispatcher._handle_search_documents`) | Database (RPC `p_folder_ids` = primary filter) | Dispatcher holds both the scope and the emit channel; RPC is the server-side primary enforcement. |
| Model-cannot-widen guarantee | API/Backend (scope from `ctx`, not `args`) | Database (RPC `match_user_id` + RLS) | Provider-agnostic by construction — scope binding is server-side, identical across all providers (D-09). |
| Narrow-only definition validation | API/Backend (Pydantic `@model_validator` + server-side ⊆ fn) | — | Structural part is always-on; the DB-dependent ⊆ check runs at run-start (and future Phase-103 save). |
| Library project filter | API/Backend (`workflows` router + `db/workflows.py`) | Database (JSONB path predicate) | Pure read; filter rides the existing published-list query. |

## System Architecture Diagram

```
                          ┌──────────────────────────────────────────────────────┐
   AUTHORING (Phase 103)  │  WorkflowDefinition (JSONB in workflow_definitions)   │
   resolves names→ids ───▶│   project_folder_id · phases[].folder_scope · ...     │
   (NOT 098)              └───────────────────────────┬──────────────────────────┘
                                                      │  model_validate()  (threads.py:862 / harness_engine.py:1070)
                                                      ▼
   RUN START (098 wires source) ──────────────────────────────────────────────────────────
        ┌───────────────────────────── 3 harness ctx-build sites ──────────────────────────┐
        │ live kickoff (threads.py:1184-1288)  · resume (_build_resume_context:1199)        │
        │ · Continue (_harness_continuation)                                                │
        │   resolve project_folder_id ──[ fetch_visible_folders + subtree walk ]──▶ subtree │
        │   (TODAY: sourced from threads.folder_id — 098 CHANGES the SOURCE to the binding) │
        └───────────────────────────────────────────┬──────────────────────────────────────┘
                                                     │ ctx.folder_subtree_ids = subtree
                                                     ▼
        phase_types._build_phase_tool_context (:151-201)
           effective = subtree ∩ phase.config.folder_scope   ◀── PROJ-02 narrowing (098)
                                                     │ ToolContext.folder_subtree_ids
                                                     ▼
        tool_dispatcher._handle_search_documents (:165-216)   model args carry only {query, metadata_filter}
           folder_ids = ctx.folder_subtree_ids  (NOT from args — model cannot widen)
                                                     ▼
        retrieval_service.search_documents(folder_ids=...) (:245)
           ├─ _vector_search  → rpc match_document_chunks(p_folder_ids)   (full-schema.sql:120)
           └─ _keyword_search → rpc keyword_search_chunks(p_folder_ids)   (full-schema.sql:93)
                 WHERE dc.user_id = match_user_id                          ◀── user-scope (SECURITY DEFINER)
                   AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))  ◀── PRIMARY scope filter (D-05)
                                                     ▼  enriched rows (+folder_id, additive)
        BACK in _handle_search_documents:  if ctx.folder_subtree_ids is not None:   ◀── D-05a gate (Deep=None → no-op)
           drop rows whose folder_id ∉ scope  →  ctx.emit(redis, run_id, 'scope_violation', ...) ◀── D-06
                                                     │ XADD run:{run_id}  (threads.py:_emit :144)
                                                     ▼
                                         run log / live timeline  (UAT asserts the event appears)

   RLS BACKSTOP (documents SELECT policy, full-schema.sql:2080): auth.uid()=user_id OR globally-visible folder
```

## Standard Stack

This phase adds **no new libraries.** Everything is in-tree.

### Core (already present — versions are informational, not to be changed by 098)
| Library | Role here | Evidence |
|---------|-----------|----------|
| Pydantic v2 | The strict-parse layer (`_StrictBase` = `ConfigDict(extra="forbid")`); new optional fields land here | `backend/app/models/harness.py:23,26-29` [VERIFIED: code] |
| FastAPI | The `GET /workflows/published` route gaining the `project_folder_id` filter param | `backend/app/api/workflows.py:38-53` [VERIFIED: code] |
| asyncpg | The `db/workflows.py` data layer (`list_published_workflows`) — `$N` placeholders only | `backend/app/db/workflows.py:130-150` [VERIFIED: code] |
| supabase-py | The retrieval RPC client (`.rpc("match_document_chunks", params)`) | `backend/app/services/retrieval_service.py:56,78` [VERIFIED: code] |
| redis.asyncio | The run-event buffer `run:{run_id}` for the `scope_violation` event | `backend/app/api/threads.py:144-158` [VERIFIED: code] |
| pytest (`asyncio_mode=auto`) | Test runner | `backend/pytest.ini` [VERIFIED: code] |

**Installation:** none. No `requirements.txt`, no `Dockerfile.sandbox`, no `SANDBOX_IMAGE` change. (Contrast Phase 101, which adds `docxtpl`.)

## Architecture Patterns

### Recommended structure of the change (file-by-file)
```
backend/app/models/harness.py
  + WorkflowDefinition: project_folder_id, output_target_folder, reingest_output,
                        version_policy, provenance  (all optional)  + (co-lock) inputs, assets
  + LlmAgentPhaseConfig / LlmBatchAgentsPhaseConfig (+ LlmSinglePhaseConfig): folder_scope
  + @model_validator(mode="after") on WorkflowDefinition: STRUCTURAL narrow-only guard
  + new InputFieldSpec / AssetRef strict models (if co-locking)
  + import: from uuid import UUID   (NOT currently imported — see Pitfall 2)

backend/app/services/harness/scope.py   (NEW — small shared module, recommended)
  + resolve_project_subtree(project_folder_id, *, supabase, user_id) -> list[str] | None
  + assert_folder_scopes_subset(definition, subtree_ids)  -> raises on a non-⊆ phase scope (DB-aware ⊆)

backend/app/api/threads.py            (live kickoff ctx-build — change scope SOURCE)
backend/app/services/harness_engine.py (_build_resume_context :1199 + _harness_continuation — 2 more sites)
backend/app/services/harness/phase_types.py (_build_phase_tool_context :186 — per-phase narrowing)
backend/app/services/retrieval_service.py (_enrich_with_filenames :118-133 — add folder_id to the dict)
backend/app/services/tool_dispatcher.py (_handle_search_documents :165-216 — ⊆ assert+clip+emit, gated)
backend/app/db/workflows.py            (list_published_workflows — add project_folder_id JSONB filter)
backend/app/api/workflows.py           (GET /published — add project_folder_id query param)
```

### Pattern 1: Additive-optional fields on `_StrictBase` (the zero-migration immutability pattern)
**What:** New fields are optional-with-default on an `extra="forbid"` model. Old JSONB rows lack the keys → defaults fill in → `model_validate()` succeeds.
**When to use:** Every 098 field. This is the established pattern (the whole model is already this shape).
```python
# backend/app/models/harness.py  — Source: VERIFIED current file, lines 26-29 + 118-124
class _StrictBase(BaseModel):
    model_config = ConfigDict(extra="forbid")          # rejects unknown keys (D-07 / D-10)

class WorkflowDefinition(_StrictBase):
    slug: str
    version: int
    name: str
    status: Literal["draft", "published"] = "draft"
    phases: list[PhaseSpec]
    # ── 098 additive-optional (all zero-migration) ──
    project_folder_id: UUID | None = None                                   # D-01 / PROJ-01
    output_target_folder: UUID | None = None                               # D-08
    reingest_output: bool = False                                          # D-08
    version_policy: Literal["supersede-by-filename","keep-all"] = "supersede-by-filename"  # D-08
    provenance: Literal["source","derived"] = "source"                     # D-08 (net-new flag)
    # (co-lock — Claude's discretion, free under JSONB)
    inputs: list[InputFieldSpec] | None = None                             # Phase 103 behavior
    assets: list[AssetRef] | None = None                                   # Phase 100 behavior
```
Confirmed class names (the brief asked to verify): `LlmAgentPhaseConfig` (`harness.py:50`), `LlmSinglePhaseConfig` (`:42`), `LlmBatchAgentsPhaseConfig` (`:64`) — all match CONTEXT. [VERIFIED: code]

### Pattern 2: Scope comes from `ctx`, never from the model's tool args (the "can't widen" guarantee)
**What:** `_handle_search_documents` reads `ctx.folder_subtree_ids` for `folder_ids`; the model's `args` only ever carry `query` + `metadata_filter`. This is *already true* — 098 hardens it with the post-query assert.
```python
# backend/app/services/tool_dispatcher.py — Source: VERIFIED current file, lines 165-172
async def _handle_search_documents(args: dict, ctx: ToolContext) -> ToolResult:
    metadata_filter = args.get("metadata_filter") or None
    results, avg_sim = await search_documents(
        args["query"], ctx.current_user["id"], ctx.supabase,
        metadata_filter=metadata_filter,
        user_settings=ctx.user_settings,
        folder_ids=ctx.folder_subtree_ids,     # ◀── scope is server-bound, NOT from args
    )
```

### Pattern 3: Per-phase narrowing at the single ToolContext-build seam
**What:** `_build_phase_tool_context(phase, ctx)` already copies the harness ctx's scope into the per-phase `ToolContext` (`phase_types.py:186`). It receives `phase`, so it can read `phase.config.folder_scope` and intersect.
```python
# backend/app/services/harness/phase_types.py — Source: VERIFIED current file, line 186 (the seam)
# TODAY:
folder_subtree_ids=getattr(ctx, "folder_subtree_ids", None),
# 098 (recommended): narrow project subtree by the per-phase folder_scope when present
_proj = getattr(ctx, "folder_subtree_ids", None)            # the resolved project subtree
_phase_scope = getattr(phase.config, "folder_scope", None)  # PROJ-02 resolved id list (or None)
_effective = (
    [f for f in _proj if f in set(map(str, _phase_scope))]   # narrow-only ∩
    if _proj is not None and _phase_scope else _proj
)
# ... folder_subtree_ids=_effective
```
(The narrow-only ⊆ *validity* of `_phase_scope` is enforced earlier by the validator — §4 — so this intersection is defensive, not the place violations are reported.)

### Anti-Patterns to Avoid
- **Changing `search_documents`'s return signature** to carry clip metadata — it is shared with Deep; touching its shape risks the byte-identical red line. Put the clip+emit in `_handle_search_documents` (which has `ctx.emit`), not in the pure retrieval fn.
- **Passing a Python `set` to the RPC.** `ToolContext.folder_subtree_ids` is *annotated* `set[str]` but is a `list[str]` at runtime everywhere (Deep: `agent_loop.py:989`; workflow: `threads.py:1217`). supabase-py JSON-serializes RPC params; a real `set` would raise. Keep it a list; `set()`-ify only locally for the ⊆ membership test (Pitfall 1).
- **Putting the DB-dependent ⊆ check inside a pure Pydantic validator.** A `@model_validator` has no `supabase`/`user_id`, so it cannot resolve the subtree. Split: structural guard in Pydantic, ⊆ check in a server-side fn (§4).
- **Adding a `scope_violation` row to `harness_audit`** without extending its CHECK — the 9-kind constraint (`db/workflows.py:42-54`, migration 059) would reject it (would need a migration). D-06's named seam is the Redis run-event channel, not `harness_audit`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subtree resolution (`project_folder_id` → ids) | A new tree walker | The existing flat-list `parent_id` walk (`agent_loop.py:982` / `threads.py:1210`) — extract once into `resolve_project_subtree` | Already battle-tested on the Deep + workflow paths; triplicated inline today — centralize, don't reinvent. |
| Folder filter in retrieval | A new query path | The shipped `p_folder_ids` RPC params (`match_document_chunks` / `keyword_search_chunks`) | The `d.folder_id = ANY(p_folder_ids)` filter is the primary enforcement and is already wired through `search_documents`. |
| Run-event emission for the warning | A new SSE channel | `ctx.emit(ctx.redis, ctx.run_id, 'scope_violation', ...)` → `_emit` XADD `run:{run_id}` | One canonical event shape (`threads.py:144`); the frontend already renders these on the producer stream. |
| Old-row compatibility | A data backfill / migration | Optional-with-default Pydantic fields | JSONB rows missing keys validate to defaults — no row ever needs rewriting. |
| Output dedup/versioning (D-08 deferred) | New ingestion machinery | `documents.py:402-423` (sha256 dedup), `:425-449` (filename versioning), `:656` (`/reingest`) | Already shipped (SEED-069). 098 only locks the *shapes*; wiring is Phase 100/101/102. |

**Key insight:** 098's value is *not* new mechanism — it is binding the existing mechanism to a new source (the project binding) and adding a loud, observable guard. The brief is right that "most of the retrieval-scope plumbing already exists."

## Detailed Findings by Research Question

### §1 — Schema landing (PROJ-01 / PROJ-02 / D-01/D-02/D-08/D-10)

**`_StrictBase` confirms `extra="forbid"`** — `harness.py:26-29`. [VERIFIED: code]

**`WorkflowDefinition` current fields** (`harness.py:118-124`): `slug, version, name, status (Literal draft/published = "draft"), phases: list[PhaseSpec]`. **No project/folder/scope/inputs/assets field exists.** [VERIFIED: code]

**Phase config classes** (`harness.py`): `LlmSinglePhaseConfig:42` (fields `prompt, model, temperature` — **no tools**, `_exec_llm_single` calls with `tools=[]`, `phase_types.py:252`), `LlmAgentPhaseConfig:50` (`prompt, available_tools, max_steps, wall_clock_seconds, model`), `LlmBatchAgentsPhaseConfig:64` (`prompt, available_tools, max_steps, max_parallel_agents, merge_strategy, ...`). [VERIFIED: code]

> **Finding worth surfacing (mild divergence from D-02):** D-02 names `LlmAgent` / `LlmSingle` for `folder_scope`. But the retrieval-bearing phases are **`llm_agent` AND `llm_batch_agents`** (both run sub-agents that call `search_documents`); **`llm_single` does NO retrieval** (no tools). So a `folder_scope` on `llm_single` is inert, and a `folder_scope` on `llm_batch_agents` is the one that actually matters and is *missing* from D-02's list. **Recommendation:** add `folder_scope` to **`LlmAgentPhaseConfig` + `LlmBatchAgentsPhaseConfig`** (the retrieval phases) and OPTIONALLY `LlmSinglePhaseConfig` for shape uniformity/forward-compat. Both batch + agent narrow through the same `_build_phase_tool_context` seam (`phase_types.py:281,361`), so covering both is one code path. [VERIFIED: code — `_exec_llm_single:238-256` has no tools; `_exec_llm_batch_agents:324-408` fans out retrieval sub-agents] — flag for planner/discuss confirmation.

**THE PIVOTAL QUESTION — JSONB or columns?** **JSONB.** `workflow_definitions.definition` is `jsonb DEFAULT '{}'::jsonb NOT NULL` (`full-schema.sql:701`). The **entire** `WorkflowDefinition` is serialized into this one column:
- `harness_engine.py:1052` docstring: "the FULL WorkflowDefinition jsonb, migration 056:23"; `:1070` `return WorkflowDefinition.model_validate(definition)`.
- `threads.py:859-862` `_raw_def = _def_row["definition"]; ... WorkflowDefinition.model_validate(_raw_def)`.
[VERIFIED: code + full-schema.sql]

**⟹ NO column-add migration is needed for the schema lock.** The Pydantic shape change is sufficient. Old published rows (including the seeded templates in migrations `061_harness_seed_templates` / `065_harness_seed_fixes`) lack the new JSONB keys; the optional defaults fill in; `model_validate()` succeeds. This *is* SC#1's "old rows still validate." [VERIFIED: code]

**Table columns that DO exist** (`full-schema.sql:694-708`): `id, slug, version, name, description, status, definition (jsonb), created_by, is_global, org_id, created_at, updated_at`. Note `slug/version/name/status` are **duplicated** (top-level columns AND inside the jsonb) — the precedent for *optionally* denormalizing `project_folder_id` to a top-level column IF an indexed filter is ever wanted (it is not needed for 098 — see §5). [VERIFIED: code]

**Exact new fields + types/defaults** (per D-01/D-02/D-08; matches the spike §3 recommendation):

| Field | Lands on | Type / default |
|-------|----------|----------------|
| `project_folder_id` | `WorkflowDefinition` | `UUID \| None = None` |
| `output_target_folder` | `WorkflowDefinition` | `UUID \| None = None` |
| `reingest_output` | `WorkflowDefinition` | `bool = False` |
| `version_policy` | `WorkflowDefinition` | `Literal["supersede-by-filename","keep-all"] = "supersede-by-filename"` |
| `provenance` | `WorkflowDefinition` | `Literal["source","derived"] = "source"` |
| `folder_scope` | `LlmAgentPhaseConfig` + `LlmBatchAgentsPhaseConfig` (±`LlmSinglePhaseConfig`) | `list[UUID] \| None = None` |
| `inputs` (co-lock) | `WorkflowDefinition` | `list[InputFieldSpec] \| None = None` |
| `assets` (co-lock) | `WorkflowDefinition` | `list[AssetRef] \| None = None` |

**Co-lock `inputs`/`assets`? — RECOMMEND YES.** Because storage is JSONB, co-locking costs *nothing extra* (no migration either way; it is one Pydantic edit regardless). Locking the shapes now means old rows validate against the FINAL schema forever and Phases 100/103 never need a second model change. Carry spike open-Q (i): `InputFieldSpec.source: Literal["user","kb_auto","template_derived"] = "user"`. Use the spike §3 shapes verbatim for `InputFieldSpec` / `AssetRef`. [CITED: scripts/spike-097/CONCLUSION.md §3] — **Note:** the CONTEXT's "098's single migration" phrasing assumed a column migration; under JSONB there is none, so the "avoid a second migration" rationale becomes "avoid a second Pydantic touch" — still favors co-lock.

### §2 — Server-side scope resolution channel (GOV-01 / D-04)

**The exact hops (every signature + line VERIFIED):**

1. `ToolContext.folder_subtree_ids: set[str] | None` — `tool_dispatcher.py:69` (annotation; **runtime value is `list[str]`** — Pitfall 1).
2. `_handle_search_documents(args, ctx) -> ToolResult` — `tool_dispatcher.py:165`; binds `folder_ids=ctx.folder_subtree_ids` at `:171`.
3. `search_documents(query, user_id, supabase, metadata_filter=None, user_settings=None, folder_ids: list[str] | None = None) -> tuple[list[dict], float]` — `retrieval_service.py:245-252`.
4. `_vector_search(..., folder_ids: list[str] | None = None)` — `retrieval_service.py:25-57`; `if folder_ids: params["p_folder_ids"] = folder_ids` (`:53-54`) → `rpc("match_document_chunks", params)` (`:56`).
5. `_keyword_search(..., folder_ids: list[str] | None = None)` — `retrieval_service.py:60-79`; `if folder_ids: params["p_folder_ids"] = folder_ids` (`:75-76`) → `rpc("keyword_search_chunks", params)` (`:78`).
6. RPC filter `AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))` — `full-schema.sql:133` (vector) / `:109` (keyword).
[VERIFIED: code]

**Where the per-phase `folder_scope` resolution attaches** — `phase_types._build_phase_tool_context(phase, ctx)` at `phase_types.py:151-201`, specifically `:186` (`folder_subtree_ids=getattr(ctx, "folder_subtree_ids", None)`). This is the single seam where the harness ctx's scope becomes the per-phase ToolContext's scope; it has `phase` in hand, so per-phase narrowing belongs here. Callers: `_exec_llm_agent:281`, `_exec_llm_batch_agents:361`. [VERIFIED: code]

**Where the run-level scope is SET at run start (the SOURCE 098 changes) — THREE sites, not one:**

| Site | Location | Today | 098 change |
|------|----------|-------|-----------|
| **Live kickoff** | `threads.py:1184-1288` (the "F5" block) | reads `threads.folder_id` (`:1195-1204`) → `_wf_get_subtree(thread_folder_id, all_folders)` (`:1210-1219`) → `wf_ctx.folder_subtree_ids` (`:1278`) | source from `_kickoff_definition.project_folder_id` (already parsed at `:862`) instead of the thread folder |
| **Resume sweep** | `harness_engine._build_resume_context:1073` → `folder_subtree_ids=None` (`:1199`) | **UNSCOPED on resume today (a GAP)** | resolve `project_folder_id` → subtree from the run's definition (loadable via `_load_run_definition`) so resumed runs stay governed |
| **Continue** | `harness_engine._harness_continuation` (referenced `:333`) — the 3rd ctx-build site named in `phase_types.py:166-167` | same family as resume | same resolution |

> **Important GAP found:** `_build_resume_context` hard-codes `folder_subtree_ids=None` (`harness_engine.py:1199`) — a resumed workflow currently runs **whole-KB unscoped**. For GOV-01 to hold across a restart, the project-binding resolution MUST be applied here too (and in Continue). **Recommendation:** extract `resolve_project_subtree(project_folder_id, *, supabase, user_id)` into a shared `harness/scope.py` and call it from all three sites — removes the triplicated inline walk and closes the resume gap. [VERIFIED: code]

**`_collect_folder_ids` (kb.py:185-193)** — `def _collect_folder_ids(node: dict) -> list[str]`; BFS over a **pre-built nested tree node** (`node["children"]`). **Caveat for reuse:** it needs an already-nested tree, whereas the run-start sites have a **flat** `fetch_visible_folders` list and use the `parent_id` recursive walk (`_wf_get_subtree`/`_get_subtree`). The flat-list walk is the better reuse target for `project_folder_id` → subtree (CONTEXT suggested `_collect_folder_ids`, but its input shape differs). [VERIFIED: code]

**The kickoff definition-parse seam** — `threads.py:835-863`: `_kickoff_definition = WorkflowDefinition.model_validate(_raw_def)` at `:862` (RLS-scoped fetch at `:840-846` via `.or_(is_global.eq.true,created_by.eq.{user})`). From `:862` onward `_kickoff_definition.project_folder_id` is available; thread it into the F5 block (`:1184+`). [VERIFIED: code]

### §3 — The ⊆ assert + clip + observability (GOV-01 / D-05 / D-05a / D-06)

**`search_documents` signature** — `retrieval_service.py:245-252` (returns `tuple[list[dict], float]`). **The enriched rows do NOT carry `folder_id`.** `_enrich_with_filenames` (`:113-137`) selects `id, filename, metadata, version_number` from `documents` (`:118-119`) and builds the dict at `:126-133` (`content, document_id, filename, chunk_index, similarity, version_number, metadata`). **To assert/clip by folder, add `folder_id` to that SELECT and to the dict** — a one-field additive change, inert for Deep. [VERIFIED: code]

**Recommended assert+clip+warn site: `_handle_search_documents` (`tool_dispatcher.py:165-216`)**, NOT `search_documents`. It holds BOTH the scope (`ctx.folder_subtree_ids`) AND the emit channel (`ctx.emit`, `ctx.redis`, `ctx.run_id`); `search_documents` has neither and is shared with Deep. Shape:
```python
# AFTER `results, avg_sim = await search_documents(...)`  (tool_dispatcher.py:167)
if ctx.folder_subtree_ids is not None:                    # D-05a gate → Deep (None) = literal no-op
    _scope = set(map(str, ctx.folder_subtree_ids))        # Pitfall 1: set()-ify locally only
    _kept, _dropped = [], []
    for hit in (results or []):
        (_kept if hit.get("folder_id") in _scope else _dropped).append(hit)
    if _dropped:                                          # primary RPC filter means this is ~always empty
        results = _kept
        await ctx.emit(ctx.redis, ctx.run_id, "scope_violation",
                       dropped=len(_dropped),
                       out_of_scope_folders=sorted({h.get("folder_id") for h in _dropped}),
                       query=args["query"])
```
- **Why it ~never fires in normal operation:** the RPC `p_folder_ids` filter already guarantees `d.folder_id = ANY(p_folder_ids)` server-side, so the post-query set is already ⊆ scope. The assert is the belt-and-suspenders for "a bug or a future tool path" (D-06). That makes the UAT slightly tricky (you must *inject* an out-of-scope row to see the event) — note for VALIDATION.
- **Deep red line (D-05a):** when `ctx.folder_subtree_ids is None` the whole block is skipped — no clip, no event, the added `folder_id` enrich key is ignored → byte-identical. [VERIFIED: code — the gate condition mirrors `_handle_glob:145` which already does `if ctx.folder_subtree_ids is not None`]

**The run-event/observability seam (D-06)** — `_emit(redis, run_id, type, **fields)` at `threads.py:144-158`: one canonical `XADD run:{run_id} {"data": json.dumps({"type": type, **fields})}` (MAXLEN ~10000). `ToolContext` carries `emit` (the `_emit` ref), `redis`, `run_id`. On the harness path `_build_phase_tool_context` sets `ToolContext.run_id = _producer_id` (`phase_types.py:180`), and engine/sub-agent events route to the **producer stream `run:{producer_run_id}`** the frontend watches (Facet B). So a `scope_violation` emitted from `_handle_search_documents` surfaces in the run log/timeline exactly like `skill_activated`, `code_execution_complete`, `sub_agent_start`, etc. **A UAT can deterministically assert the event by reading `run:{run_id}`.** [VERIFIED: code]
- Existing event-kind vocabulary (examples, for naming consistency): `skill_activated`, `skill_loaded`, `sub_agent_start/delta/done`, `code_execution_start/complete`, `code_stdout/stderr`, `ask_user_prompt`, `workspace_file_written/deleted`, `fallback_model`, `keepalive`. `scope_violation` is a clean new kind (planner names the final string). [VERIFIED: code]
- **Optional durable audit:** `harness_audit` has a 9-kind CHECK (`db/workflows.py:42-54`: `phase_started, phase_completed, phase_transition, gate_passed, gate_failed, tool_refused, run_started, run_completed, run_failed`). A durable `scope_violation` audit row would require **extending that CHECK (a migration)**. D-06's named seam is the Redis run-event channel, so **no migration is needed** for observability; flag the durable-audit option only if the planner wants it. [VERIFIED: code]

**The RPC filters + RLS backstop (quoted):**
```sql
-- full-schema.sql:93-113  (keyword_search_chunks — SECURITY DEFINER)
CREATE FUNCTION public.keyword_search_chunks(search_query text, match_user_id uuid, match_count integer DEFAULT 20,
        metadata_filter jsonb DEFAULT NULL, p_folder_ids uuid[] DEFAULT NULL) ...
  WHERE dc.user_id = match_user_id                                  -- user-scope (RLS-equivalent)
    AND dc.search_vector @@ tsq
    AND d.is_latest = true
    AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)
    AND (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))   -- PRIMARY scope enforcement (D-05)

-- full-schema.sql:120-137  (match_document_chunks — SECURITY DEFINER) — same WHERE shape (:129, :133)
```
```sql
-- full-schema.sql:2080  (documents RLS SELECT — the backstop)
CREATE POLICY "Users can view own or global-folder documents" ON public.documents
  FOR SELECT USING (((auth.uid() = user_id)
    OR ((folder_id IS NOT NULL) AND public.folder_is_globally_visible(folder_id))));
```
**Nuance:** the RPCs are `SECURITY DEFINER` → they **bypass RLS** and enforce user-scope via `match_user_id`. The `documents` RLS SELECT policy is the backstop for **direct** `documents` table reads (e.g. `_enrich_with_filenames`) under a *user-scoped* client; on the **service-role** harness path (resume) RLS is bypassed, so the RPC's `match_user_id` + `p_folder_ids` are the real enforcement and the post-query ⊆ assert is the in-app guard. (`_build_resume_context` deliberately scopes the service-role client by `current_user["id"]` from the durable run owner — `harness_engine.py:1119-1123`.) [VERIFIED: code]

### §4 — Narrow-only validation (PROJ-02 / D-07)

**Where `WorkflowDefinition.model_validate()` runs TODAY:** `threads.py:862` (kickoff) and `harness_engine.py:1070` (`_load_run_definition`, run-load/resume). **There is NO authoring/save CRUD path** — Phase 103 (WFAUTH-01) builds it; today only the seed migrations (061/065) INSERT definitions. The RLS INSERT/UPDATE policies exist (`full-schema.sql:1903, 1994`) but no backend route writes definitions yet. `harness.py` has **no `@model_validator`** today (only `extra="forbid"`). [VERIFIED: code]

**Two-part recommendation (this is the seam D-07 needs, independent of Phase 103):**
1. **Structural guard — a pure `@model_validator(mode="after")` on `WorkflowDefinition`.** Runs on EVERY `model_validate()` (kickoff + run-load). Validates *structure* only: each phase `folder_scope` is a well-formed `list[UUID]`; (optionally) reject a phase `folder_scope` when `project_folder_id is None` (a scope with no project to be ⊆ of). Cannot check ⊆ subtree (no DB/user in a pure validator).
2. **DB-dependent ⊆ check — a server-side fn** `assert_folder_scopes_subset(definition, *, supabase, user_id)` (in the shared `harness/scope.py`). Resolves the project subtree, asserts every phase `folder_scope ⊆ subtree`, raises `400`/`ValueError` otherwise (a **definition-validity error**, NOT a runtime clip). In 098 (no save API) **call it at run-start** — right after the kickoff parse (`threads.py:862`) and in the resume/Continue ctx-builders — so a non-⊆ definition fails LOUDLY at run start. Phase 103 later calls the SAME fn at definition-save time (its natural home).

This satisfies D-07 verbatim ("a server-side validator that runs whenever a definition is validated/saved, independent of the Phase-103 publish UI"): the run-start call is the 098 enforcement point; the Pydantic validator is the always-on structural guard. Distinguish clearly from D-06: **D-07 = a DECLARED phase scope ⊄ project subtree → hard validation error**; **D-06 = a RETRIEVED row's folder outside scope → clip + warn** (different failure classes; do not conflate). [VERIFIED: code]

### §5 — Workflows-library project filter (PROJ-01 / D-03)

- **API seam:** `backend/app/api/workflows.py` — `GET /workflows/published` (`:38-53`), `response_model=list[PublishedWorkflow]` (`id, slug, name`). Add `project_folder_id: UUID | None = Query(None)` and pass it through. [VERIFIED: code]
- **Data seam:** `db/workflows.py:list_published_workflows(pool, *, user_id) -> list[dict]` (`:130-150`): `SELECT id, slug, name FROM workflow_definitions WHERE status='published' AND (is_global=true OR created_by=$1) ORDER BY name`. Add an optional `project_folder_id` param → append `AND definition->>'project_folder_id' = $2` when provided (asyncpg `$2` bound as text; `definition->>'key'` returns text). **NO migration, NO new column** — the binding lives inside the `definition` JSONB. [VERIFIED: code]
- **Scale note:** per-user published sets are small and this is a list read; the JSONB-path filter is sufficient for 098. If the library ever grows, an expression index `CREATE INDEX ... ON workflow_definitions ((definition->>'project_folder_id'))` can be added later (that *would* be a migration). PROJ-01 is "queryable capability" only; the page UI is Phase 103. [ASSUMED: scale judgement — confirm with operator if a sub-ms indexed filter is wanted now]

### §6 — Migration mechanics (per the CLAUDE.md rule)

**Finding: 098 needs NO SQL migration and NO `full-schema.sql` regen** if the planner uses the JSONB-path library filter (recommended). The whole phase is Pydantic model edits + service wiring + a FastAPI query param + a `db/workflows.py` predicate. `full-schema.sql` is unchanged because there is no DDL change. This is fully consistent with D-01/D-10 "zero-migration, additive." [VERIFIED: code — JSONB storage at full-schema.sql:701]

**IF the planner opts into an optional migration** (an expression index for the filter, or extending the `harness_audit` CHECK for a durable `scope_violation` audit), the CLAUDE.md flow applies exactly:
1. Create `supabase/migrations/067_<name>.sql` — **next free number = 067** (latest is `066_eval_coverage_seed.sql`; digits-only filename, no letter suffix). [VERIFIED: `ls supabase/migrations/`]
2. **Operator pastes it into the Supabase SQL editor** — NEVER `supabase db push` / `db reset` (preserves dev data). This is a **human/operator action → `autonomous: false`** in the plan.
3. `bash scripts/regenerate-full-schema.sh` (defaults to live-DB dump, **no `--reset`**) to rebuild `supabase/full-schema.sql`.
4. Commit BOTH the migration and the regenerated `full-schema.sql`. Never hand-edit `full-schema.sql`.

**Recommendation: take the zero-migration path.** Reserve a migration only if the operator explicitly wants an indexed filter or a durable scope-violation audit row.

## Runtime State Inventory

> 098 is **additive/greenfield**, not a rename/refactor/migration. No string is being renamed; no stored key, OS registration, secret, or build artifact changes. **All five categories: None** — verified: the change is new optional fields + new wiring, with old JSONB rows validating to defaults (no data rewrite). Section retained per checklist; nothing to migrate.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + `pytest-asyncio` (`asyncio_mode = auto`) |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && python -m pytest tests/test_098_schema_lock.py tests/test_098_scope_governance.py -x` |
| Full suite command | `cd backend && python -m pytest -q` |

Existing harness tests (consumable patterns): `test_harness_engine.py`, `test_harness_whitelist.py`, `test_harness_resume.py`, `test_harness_templates.py`, `test_harness_gates.py`, `test_harness_reachability.py`, `test_thread_workflow_endpoint.py`, `test_reingest.py` (D-08 output infra). **No `test_retrieval_service.py` exists** → the ⊆-assert unit test is net-new. [VERIFIED: `ls backend/tests`]

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| SC#1 / PROJ-01 | seeded-template JSONB (migrations 061/065) `model_validate()`s unchanged after adding optional fields | unit | `pytest tests/test_098_schema_lock.py::test_old_rows_validate -x` | ❌ Wave 0 |
| SC#1 / D-01,D-08 | a definition WITH `project_folder_id`/output fields round-trips (`model_dump(mode="json")` → `model_validate`) | unit | `pytest tests/test_098_schema_lock.py::test_new_fields_roundtrip -x` | ❌ Wave 0 |
| SC#1 / PROJ-01 | `GET /workflows/published?project_folder_id=X` returns only matching defs | integration | `pytest tests/test_thread_workflow_endpoint.py -k project_filter -x` | ⚠️ extend existing |
| SC#2 / PROJ-02 | `_build_phase_tool_context` narrows project subtree by per-phase `folder_scope` (∩) | unit | `pytest tests/test_098_scope_governance.py::test_per_phase_narrowing -x` | ❌ Wave 0 |
| SC#3 / D-04 | run-start sources scope from `project_folder_id` (not thread folder) and binds `p_folder_ids` (mock RPC asserts param) | integration | `pytest tests/test_098_scope_governance.py::test_run_start_resolution -x` | ❌ Wave 0 |
| SC#3 / D-05a | ⊆ assert is a **literal no-op when scope is None** (Deep byte-identical) | unit | `pytest tests/test_098_scope_governance.py::test_deep_noop -x` | ❌ Wave 0 |
| SC#3 / D-07 | narrow-only validator REJECTS a phase `folder_scope ⊄ subtree` | unit | `pytest tests/test_098_scope_governance.py::test_narrow_only_reject -x` | ❌ Wave 0 |
| SC#4 / D-06 | injected out-of-scope row → row dropped AND `scope_violation` XADDed to `run:{run_id}` | unit/integration | `pytest tests/test_098_scope_governance.py::test_clip_and_emit -x` | ❌ Wave 0 |
| SC#4 / SC#10 / D-09 | bound scope holds in-run per provider; clip warning observable | **live UAT** (manual, VALIDATION.md) | representative-4 cross-provider | manual |
| GOV-01 / D-13 | an act/export tool excluded from a read-only phase's whitelist is refused | unit | `pytest tests/test_harness_whitelist.py -k exclude -x` | ⚠️ extend existing |

### Sampling Rate
- **Per task commit:** `pytest tests/test_098_schema_lock.py tests/test_098_scope_governance.py -x`
- **Per wave merge:** `pytest -q` (full backend suite)
- **Phase gate:** full suite green + the representative-4 live UAT scoreboard complete before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/test_098_schema_lock.py` — old-row round-trip (SC#1) + new-field round-trip; load the seeded-template JSONB from migrations 061/065 as the "old row" fixture.
- [ ] `tests/test_098_scope_governance.py` — per-phase narrowing (SC#2), Deep no-op (SC#3/D-05a), narrow-only reject (SC#3/D-07), clip+emit (SC#4/D-06). The ⊆-assert + emit test needs a fake `ctx.emit` capturing XADD calls (mirror existing harness-test fakes).
- [ ] No `tests/conftest.py` change expected (a `backend/tests/conftest.py` already exists; reuse its fixtures).

### Cross-provider VALIDATION (SC#10 — the 4-axis mandate)
Authored under **VALIDATION.md, not PLAN tasks.** Representative-4 (D-09): OpenAI, Anthropic, Google, OpenRouter — one model each. Required rows:
- **Cross-provider** (4 rows): a bound workflow run per provider confirms in-run retrieval stays inside the project subtree (cross-check via Supabase: the run's cited `document_id`s all resolve to `folder_id ∈ subtree`).
- **Multi-tool** (≥1 row): `search_documents` + a second tool (e.g. `execute_code`) in one bound phase — scope holds across both.
- **Parallel-thread** (≥1 row): Thread A runs a bound workflow while Thread B accepts a new prompt — scope isolation holds.
- **Long-message** (≥1 row): ≥50 prior messages OR a ≥5 KB prompt — scope still bound.
- **D-13 row:** a read-only phase whose whitelist excludes an act/export tool refuses it.
- **D-06 observability row:** force/inject an out-of-scope retrieval (or document why it can't be naturally triggered given the RPC primary filter) and confirm the `scope_violation` event appears in the run log. (Watch item: `minimax-m3-invalid-tool-args-400` — re-open only if it surfaces; MiniMax is NOT in the representative-4.)

## Common Pitfalls

### Pitfall 1: `folder_subtree_ids` is a list at runtime despite the `set[str]` annotation
**What goes wrong:** Trusting the `ToolContext.folder_subtree_ids: set[str]` annotation (`tool_dispatcher.py:69`) and passing a real `set` to the RPC → supabase-py `json.dumps` raises on a set.
**Why:** Both producers build a `list` — Deep `_get_subtree` (`agent_loop.py:989`), workflow `_wf_get_subtree` (`threads.py:1217`). The annotation is aspirational.
**Avoid:** Keep the channel a `list[str]`. `set()`-ify ONLY for the local ⊆ membership test inside `_handle_search_documents`. **Warning sign:** a `TypeError: Object of type set is not JSON serializable` from the RPC call.

### Pitfall 2: `UUID` is not imported in `harness.py`
**What goes wrong:** Adding `project_folder_id: UUID` without `from uuid import UUID` → `NameError` at import.
**Why:** `harness.py:21,23` imports only `Annotated, Literal, Union` + `BaseModel, ConfigDict, Field`.
**Avoid:** Add `from uuid import UUID`. Also: definitions are stored as JSONB, so when WRITING a definition use `model_dump(mode="json")` (UUID→str); reading is fine (Pydantic coerces str→UUID). **Warning sign:** a `TypeError: Object of type UUID is not JSON serializable` on a write path, or `NameError: name 'UUID'`.

### Pitfall 3: forgetting the resume / Continue ctx-build sites
**What goes wrong:** Wiring `project_folder_id` resolution only into the live kickoff (`threads.py:1184+`) leaves resumed/Continued runs UNSCOPED (`_build_resume_context:1199` hard-codes `None`) → GOV-01 silently bypassed after a restart.
**Why:** Three independent ctx-build sites set `folder_subtree_ids` (the same trio `phase_types.py:166-167` names for `producer_run_id`).
**Avoid:** Centralize resolution in one helper called by all three. **Warning sign:** a resumed bound workflow retrieves outside its project but no test catches it (resume tests run unscoped today).

### Pitfall 4: the ⊆ assert ~never fires under normal operation
**What goes wrong:** A UAT that "checks the clip works" by running a normal bound workflow sees zero clipped rows (because the RPC `p_folder_ids` filter already excluded them) and wrongly concludes the assert is broken.
**Why:** The RPC is the primary filter; the post-query assert is a backstop for bugs/future paths.
**Avoid:** Test the clip by INJECTING an out-of-scope row into the enriched results (mock `search_documents`), not by hoping the live path emits one. **Warning sign:** `scope_violation` never appears in any live run.

### Pitfall 5: conflating D-06 (runtime clip) with D-07 (definition validation)
**What goes wrong:** Implementing "narrow-only" as a runtime clip of a phase's declared `folder_scope`, or implementing the retrieved-row violation as a hard run-fail.
**Why:** They are different failure classes. D-07: a DECLARED phase scope ⊄ project subtree → **hard validation error at definition validate/save**. D-06: a RETRIEVED row outside scope → **clip + warn, run continues**.
**Avoid:** Two distinct mechanisms (§3 vs §4). **Warning sign:** a non-⊆ definition runs anyway (silently clipped) — D-07 violated.

## State of the Art

| Old Approach | Current (098) Approach | When | Impact |
|--------------|------------------------|------|--------|
| Workflow scope = the **thread's folder** subtree (F5 mirror of Deep) | Scope = the workflow's **`project_folder_id`** subtree (+ per-phase `folder_scope`), resolved server-side | 098 | Scope follows the *binding*, portable across threads; the model can't widen it |
| Scope landed as a resolved id **inside an `llm_agent` prompt string** (spike finding — no schema home) | Bound `folder_scope` schema field + `ToolContext.folder_subtree_ids` | 098 | A prompt hint the agent could ignore/widen becomes a server-bound parameter (PROJ-02) |
| `_handle_search_documents` ignores model args for scope but has **no post-query ⊆ check** | Explicit ⊆ assert + clip + `scope_violation` event, Deep-gated | 098 | GOV-01 SC#3/#4 observable enforcement |

**Deprecated/outdated:** none introduced. The Deep path (`agent_loop.py:967-989`) is the RED LINE — untouched; the change is additive on the workflow path only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A JSONB-path filter (`definition->>'project_folder_id'`) is sufficient for PROJ-01 (no index needed at current scale) | §5 | If the published-library grows large, an unindexed JSONB filter could be slow; mitigated by adding an expression index later (migration). |
| A2 | `folder_scope` should also live on `LlmBatchAgentsPhaseConfig` (not only the D-02-named LlmAgent/LlmSingle) because batch is the other retrieval-bearing phase | §1 | If only D-02's two are added, a batch phase can't be narrowed — but no shipped workflow uses batch with per-phase scope yet, so low immediate risk. Confirm in discuss/plan. |
| A3 | The Continue ctx-build site (`_harness_continuation`) sets `folder_subtree_ids` like resume and needs the same resolution | §2 | Not read line-by-line; if it already inherits scope differently, the wiring point shifts. Verify the exact site during planning. |
| A4 | Putting `folder_id` on the enriched dict + the ⊆ assert in `_handle_search_documents` keeps Deep byte-identical | §3 | If any Deep assertion depends on the exact enriched-dict key set, the extra key could matter — but Deep consumers read by key, so additive keys are safe (consistent with how `metadata` is already conditionally added). |

## Open Questions

1. **`folder_scope` on `llm_batch_agents` (and `llm_single`)?** D-02 names only LlmAgent/LlmSingle; the retrieval phases are llm_agent + llm_batch_agents. Recommendation: cover both retrieval phases. *Resolve in plan-phase / a quick discuss confirm.*
2. **Durable `scope_violation` audit row?** D-06's seam is the Redis run-event channel (no migration). If a durable `harness_audit` row is also wanted, the 9-kind CHECK needs a migration (067). *Default: no — Redis event only.*
3. **`project_folder_id` denormalized column for an indexed filter?** Not needed for 098; the duplication precedent exists (slug/name/status are both columnar and in-jsonb). *Default: JSONB-path filter, zero migration.*

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python venv (backend) | all unit tests | operator-managed | — | — |
| Supabase (local Postgres :54322) | integration tests + live UAT | operator-managed (auto-starts on Docker per CLAUDE.md) | — | unit tests need neither |
| Redis (docker-compose.dev.yml) | `scope_violation` run-event assertion + live UAT | operator-managed | — | unit tests fake `ctx.emit` |
| LLM provider keys (OpenAI/Anthropic/Google/OpenRouter) | representative-4 live UAT (D-09) | operator-managed (`backend/.env`) | — | — |

**Missing dependencies with no fallback:** none for the unit/integration core (the schema lock + ⊆ logic are testable with fakes). The live UAT requires the operator's running stack + provider keys (the established pattern: the user starts the backend; Claude cross-checks via Supabase/psycopg2 + the run-event buffer). [VERIFIED: CLAUDE.md local-dev section]

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard control (here) |
|---------------|---------|--------------------------|
| V1 Architecture | yes | Server-side scope resolution at a trust boundary; the model is untrusted input. |
| V2 Authentication | no | Handled upstream by Supabase Auth / `get_current_user`; unchanged. |
| V3 Session Mgmt | no | Unchanged. |
| **V4 Access Control** | **yes** | The core of GOV-01: server-bound `scope_folder_ids` (model can't widen), RPC `match_user_id` + `p_folder_ids`, documents RLS backstop, per-phase tool whitelist (act/export separability, D-13), IDOR-safe definition start (`threads.py:844`). |
| **V5 Input Validation** | **yes** | `extra="forbid"` strict models; `folder_scope` is a bound id list not a prompt hint; narrow-only definition validator; scope from `ctx` not `args`. |
| V6 Cryptography | no | None hand-rolled; n/a. |

### Known Threat Patterns for {workflow run / RAG retrieval}
| Pattern | STRIDE | Standard mitigation (here) |
|---------|--------|----------------------------|
| Prompt-injection scope-widening (model asks to read outside its project via args/prompt) | Elevation of Privilege / Tampering | Scope bound from `ctx.folder_subtree_ids`, model `args` carry only `{query, metadata_filter}` (`tool_dispatcher.py:165-172`); ⊆ assert + clip as backstop. |
| Cross-user retrieval escape | Information Disclosure | RPC `WHERE dc.user_id = match_user_id` (SECURITY DEFINER) + documents RLS SELECT (`full-schema.sql:2080`); resume scopes the service-role client to the durable run owner (`harness_engine.py:1119-1123`). |
| IDOR — starting another user's private workflow | Elevation of Privilege | Already mitigated: kickoff fetch is RLS-mirrored `.or_(is_global.eq.true,created_by.eq.{user})` + published check (`threads.py:840-857`); 098 must not regress it. |
| Resume-path scope bypass | Information Disclosure | **Found gap** — `_build_resume_context:1199` runs unscoped; 098 closes it by resolving the binding on resume (§2). |
| Self-feedback amplification (re-ingested model output treated as ground truth) | Tampering | `provenance: "derived"` flag (shape locked in 098; behavior Phase 100/101/102). |

## Sources

### Primary (HIGH confidence — read directly this session)
- `backend/app/models/harness.py` — `_StrictBase`, `WorkflowDefinition`, the 5 phase configs (full file).
- `backend/app/services/retrieval_service.py` — `search_documents`, `_vector_search`, `_keyword_search`, `_enrich_with_filenames` (full file).
- `backend/app/services/tool_dispatcher.py` — `ToolContext`, `_handle_search_documents`, `dispatch_tool` whitelist gate, `_handle_glob` (lines 1-1322 + grep of the dispatch gate).
- `backend/app/services/harness/phase_types.py` — `_build_phase_tool_context`, `_exec_llm_agent`, `_exec_llm_batch_agents` (full file).
- `backend/app/api/threads.py` — `_emit` (:144), kickoff definition parse (:835-863), the F5 scope block + `_wf_get_subtree` (:1184-1298).
- `backend/app/services/harness_engine.py` — `_load_run_definition` (:1048), `_build_resume_context` (:1073-1202).
- `backend/app/db/workflows.py` — `list_published_workflows` (:130), `create_workflow_run`, `_AUDIT_EVENT_TYPES` (full file).
- `backend/app/api/workflows.py` — `GET /workflows/published` (full file).
- `backend/app/api/kb.py` — `_collect_folder_ids` (:185-193).
- `backend/app/services/agent_loop.py` — `_get_subtree` (:982-989) [RED LINE reference].
- `supabase/full-schema.sql` — `keyword_search_chunks`/`match_document_chunks` RPCs (:90-137), `workflow_definitions` table (:694-708), documents RLS SELECT (:2080), workflow_definitions RLS/triggers.
- `backend/pytest.ini`; `ls backend/tests`; `ls supabase/migrations`.

### Secondary (project docs — context, cross-checked against code)
- `.planning/phases/098-.../098-CONTEXT.md` (decisions D-01..D-13).
- `scripts/spike-097/CONCLUSION.md` §2-§3 (schema shape + the 3 settled open questions).
- `.planning/REQUIREMENTS.md` (PROJ-01/02, GOV-01); `.planning/ROADMAP.md` Phase 098 (4 SC + SC#10 note); `.planning/STATE.md`; `CLAUDE.md` (migration rule, RLS mandate, cross-provider, hot-file ledger).

### Tertiary (LOW confidence)
- None — every load-bearing claim is code-verified.

## Project Constraints (from CLAUDE.md)
- **Migrations:** numbered SQL under `supabase/migrations/` (`<digits>_name.sql`, NO letter suffix); apply by pasting into the Supabase **SQL editor** — NEVER `db push`/`db reset` (human/operator action → `autonomous: false`); then `bash scripts/regenerate-full-schema.sh` (no reset); commit both; never hand-edit `full-schema.sql`. **(098 likely needs no migration at all — §6.)**
- **RLS:** every table user-scoped; global folders/skills are the only shared scope. Retrieval stays owner-scoped even on the service-role resume path.
- **No LangChain/LangGraph; raw SDK; Pydantic for structured outputs.** The schema lock is pure Pydantic.
- **Stream via SSE; stateless completions.** The `scope_violation` event rides the existing SSE/Redis run-event vocabulary.
- **No blocking I/O in async handlers** — `search_documents` already wraps the sync embed/rerank in `run_in_threadpool` (`retrieval_service.py:42-44, 311`); don't add blocking calls in the new ⊆ path.
- **Provider-docs-first + cross-provider; Deep Mode byte-identical (RED LINE).** The ⊆ assert + clip MUST be gated to a bound scope (literal no-op when `folder_ids is None`) — D-05a.
- **G-5 hot-file ledger:** 098 is additive; it must NOT grow `backend/app/api/threads.py` (extraction still due) or `anthropic_service.py`. Prefer the new `harness/scope.py` helper over inflating `threads.py`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all seams read directly.
- Schema landing (JSONB → zero-migration): HIGH — `full-schema.sql:701` + two `model_validate` call sites confirm it.
- Scope channel + ⊆ seam: HIGH — every hop's signature + line verified.
- Resume/Continue gap: HIGH for resume (`:1199` read), MEDIUM for Continue (`_harness_continuation` referenced, not read line-by-line — A3).
- `folder_scope` phase-config coverage: MEDIUM — recommendation (A2) extends D-02; needs a one-line discuss confirm.
- Library filter approach: HIGH for "no migration needed"; MEDIUM on "no index needed at scale" (A1).

**Research date:** 2026-06-09
**Valid until:** ~2026-07-09 (stable in-tree code; re-verify line numbers if `threads.py`/`harness_engine.py`/`phase_types.py` change before planning).
