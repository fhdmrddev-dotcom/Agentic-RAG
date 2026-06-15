# Phase 098: Project Binding + Server-Side KB Scope Governance - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A workflow can be **bound to a project** — a single KB folder plus its subtree. When that
workflow runs, the backend resolves the allowed retrieval scope **server-side from the
user's RLS context at run start** and pins it onto every retrieval call, so the model
cannot widen it through prompt text or tool arguments. An optional **per-phase
`folder_scope`** narrows retrieval further for an individual phase. Retrieved `folder_id`s
are asserted ⊆ the bound scope, with RLS as the backstop, and any scope violation is
**observable in the run log**.

This phase delivers REQ **PROJ-01** (project binding), **PROJ-02** (bound per-phase scope),
and **GOV-01** (server-side scope governance). It is **schema-lock + governance-wiring**
work: most of the retrieval-scope plumbing already exists (the thread→folder path already
binds `ctx.folder_subtree_ids` onto `search_documents`); this phase changes the *source* of
the scope (a workflow's project binding + per-phase narrowing instead of just the thread
folder), adds the explicit ⊆ assertion + observability, and locks the additive-optional
schema fields the spike nominated.

**In scope:** additive-optional schema fields on `WorkflowDefinition` + phase configs;
server-side scope resolution from the project binding; per-phase narrowing; the ⊆
assert + clip + run-log warning; a project filter on the workflow-definitions query (API/data
layer). **Out of scope:** the Workflows *page* UI (Phase 103); output re-ingestion *behavior*
(Phase 100/101/102); template-fill (Phase 101); the launch-form/authoring experience (Phase 103).

</domain>

<decisions>
## Implementation Decisions

### Schema binding (PROJ-01 / PROJ-02) — additive-optional, zero-migration
- **D-01:** Add `project_folder_id: UUID | None = None` to `WorkflowDefinition` (`backend/app/models/harness.py`). Binds a workflow to **one** project folder + subtree = the default read scope. Old unbound workflows keep validating and running unchanged (zero-migration, additive). A project is a **single-folder object** — the output target is a *separate* field (see D-08), never folded into "the project."
- **D-02:** Add `folder_scope: list[UUID] | None = None` to the `LlmAgent` / `LlmSingle` phase configs. It is a **bound, resolved id list** — NOT a prompt hint (the spike's load-bearing finding: scope landed as ids inside an `llm_agent` prompt string for lack of a schema field). Resolution of any spoken folder names/paths → ids is an **authoring-time** concern owned by the Phase 103 generator; the field stored here is always resolved UUIDs.
- **D-03:** The Workflows library is **filterable by `project_folder_id`** at the API/data layer (a `GET` query filter on workflow-definitions load). The library *page* UI is deferred to Phase 103 — 098 ships only the queryable capability.

### Server-side scope governance (GOV-01)
- **D-04:** `scope_folder_ids` is resolved **server-side at run start from the user's RLS context** and bound to every retrieval call as a parameter the model cannot override. This reuses the existing `ctx.folder_subtree_ids` → `search_documents(folder_ids=...)` → RPC `p_folder_ids` channel, but sources the scope from the **workflow's `project_folder_id` (+ per-phase `folder_scope`)** rather than only the thread folder.
- **D-05:** Retrieved `folder_id`s are asserted **⊆ scope**; RLS remains the backstop (`match_user_id` + the `documents` RLS policy). The DB RPC folder filter (`d.folder_id = ANY(p_folder_ids)`) is the primary enforcement; the post-query assert is the in-app guard.
- **D-05a (GATED — Deep byte-identical red line):** The ⊆ assert + clip live on `search_documents` / `_handle_search_documents`, which is **shared with Deep mode** (Deep and workflows both dispatch through it). The assert MUST be **gated to a bound scope**: it runs only when `scope_folder_ids` / `folder_ids` is present (workflow context); when `folder_ids is None` (Deep whole-KB, no folder selected) it is a **literal no-op**. This keeps the shared retrieval path behaviorally **byte-identical for Deep** — the red line covers the shared `search_documents` change, not just `agent_loop._get_subtree`.
- **D-13 (GOV-01 act/export separability):** GOV-01's "read-untrusted-content and act/export stay separable across phases via the per-phase tool whitelist" clause is **already provided** by the existing per-phase `phase_whitelist` on `ToolContext` (`tool_dispatcher.py`). 098 only **preserves** it (no regression) and adds **one UAT row** asserting an act/export tool can be excluded from a read-only phase's whitelist.

### Scope-enforcement behavior (gray area 2 — accepted rec)
- **D-06:** On a scope violation at **runtime** (a retrieved row whose folder falls outside the bound scope — a bug or a future tool path), **clip + observe**: drop the offending rows, continue the run, and **emit a visible warning event to the run log** (satisfies SC#4 "observable"). NOT a hard run-fail; NOT silent. **Concrete seam:** the warning rides the **existing harness run-event channel** as a dedicated event kind (e.g. `scope_violation`), buffered to the Phase-061+ Redis run buffer `run:{run_id}` and surfaced in the run log/timeline the same way other harness phase events are — so a UAT can deterministically assert it appears. (Planner names the exact event vocabulary; the seam is the existing run-event/Redis buffer, **not** a new channel.)
- **D-07:** A per-phase `folder_scope` must be **narrow-only** — a subset of the project subtree. **Enforced in 098 by a server-side validator that exists today** — a `WorkflowDefinition` / harness `model_validator` (or the harness definition validate/save path) that runs whenever a definition is validated/saved, **independent of the not-yet-built Phase-103 publish UI**. A phase scope not ⊆ the project subtree is a **validation error at definition-save time** (Phase 103 will later *surface* it in the authoring UI, but enforcement does not depend on that flow). It is NOT silently clipped at runtime.

### Output-side schema dimension (gray area 1 — accepted rec; SEED-069 / spike Condition 8)
- **D-08:** **Lock the field SHAPES now in 098; defer the BEHAVIOR.** Add these additive-optional fields to `WorkflowDefinition` (all zero-migration):
  - `output_target_folder: UUID | None = None` — where a produced artifact lands (`None` = produce-only, no re-ingest). A *separate* field from `project_folder_id`.
  - `reingest_output: bool = False` — opt-in: feed the produced file back into the KB.
  - `version_policy: Literal["supersede-by-filename","keep-all"] = "supersede-by-filename"` — `"supersede-by-filename"` matches the **already-shipped** filename-keyed versioning (`documents.py:425-449`).
  - `provenance: Literal["source","derived"] = "source"` — tags workflow-produced docs as `derived` so the AI / quality gate never treat the model's own output as ground truth (self-feedback amplification guard). **The one genuinely net-new field.**
  - The re-ingestion *wiring* (calling the existing upload/reingest API on finalize) is **deferred to Phase 100/101/102** — 098 only reserves the shapes so old rows validate against the final schema forever and no second migration is needed.

### Cross-provider validation depth (gray area 3 — accepted rec; SC#10 / spike Condition 7)
- **D-09:** 098 runs **representative-4 live UAT** (OpenAI, Anthropic, Google, OpenRouter — one model per axis) confirming the bound scope + ⊆ assert hold per provider. Scope is **provider-agnostic by construction** (bound server-side; the model cannot widen regardless of provider), so 098 does not need the full gauntlet. The **full native-7 + OpenRouter structured-output validation (Condition 7)** is **reserved for Phase 101**, where the *field-map emission* actually varies by provider (GLM/MiniMax tool-use-drop; DeepSeek/Moonshot reasoning-truncation). The open `minimax-m3-invalid-tool-args-400` bug is a **watch item** during this UAT — re-open/route it only if cross-provider workflow UAT surfaces it.

### Carried schema facts (from spike §3 — settled, not re-asked)
- **D-10:** All new fields are **OPTIONAL** on the `_StrictBase` (`extra="forbid"`) models → existing published `WorkflowDefinition` rows `model_validate()` cleanly. Immutability stays "no-edit-published" (per-version), unaffected by additive fields.
- **D-11:** `Cited` provenance (per-value `source_chunk_id`) lives in the **run OUTPUT only**, never in an `inputs`/schema field (spike open-Q ii).
- **D-12:** `folder_scope` is a **resolved UUID list**, never a string path (spike open-Q iii); the engine binds it via the existing `ToolContext.folder_subtree_ids` seam.

### Claude's Discretion
- **Co-locking `inputs` / `assets` shapes:** The spike's full §3 lock candidate also includes `inputs: list[InputFieldSpec]` (launch form — Phase 103 territory) and `assets: list[AssetRef]` (workflow-owned templates — Phase 100 territory). 098 is **not required** to lock these (its requirements are PROJ/GOV only). **Lean: co-lock the shapes in 098's single migration** to avoid a second additive-optional migration on `workflow_definitions` — but the *behavior* stays owned by Phases 100/103. Planner/researcher decides whether one migration or several is cleaner. If co-locked, carry spike open-Q (i): `InputFieldSpec.source` is an enum including `"template_derived"`.
- Migration mechanics (column types, single vs split migration, exact RPC assert placement) are implementation choices for the planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Phase requirements & success criteria
- `.planning/ROADMAP.md` → "### Phase 098: Project Binding + Server-Side KB Scope Governance" — the 4 success criteria + the SC#10 VALIDATION note (in-run retrieval scope across providers; spec re-confirm (b): bound folder-scope param vs prompt hint).
- `.planning/REQUIREMENTS.md` — **PROJ-01** (project binding / optional `project_folder_id` / library filter), **PROJ-02** (bound per-phase `folder_scope`, not a prompt hint), **GOV-01** (server-side `scope_folder_ids` from RLS context + ⊆ assert + RLS backstop; read-untrusted vs act/export separable via per-phase tool whitelist).

### The schema lock candidate (the spike deliverable — read §2 & §3 in full)
- `scripts/spike-097/CONCLUSION.md` §3 — the recommended additive-optional schema shape (`project_folder_id` / per-phase `folder_scope` / the OUTPUT-side dimension) + the three settled open questions (i/ii/iii). §2 Conditions **7** (full-roster cross-provider, reserved for Phase 101) and **8** (living-document feedback loop).

### Living-document / output-side dimension (D-08)
- `.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md` — output re-ingestion design + the **already-shipped** dedup/versioning/reingest infra it leverages (don't rebuild) + the `provenance` self-feedback guard + the scoped exception to the "manual upload only" rule.

### Existing code seams (the server-side scope mechanism — already PARTIALLY built)
- `backend/app/models/harness.py` — `WorkflowDefinition` + `LlmAgentPhaseConfig` / `LlmSinglePhaseConfig` + `_StrictBase` (`extra="forbid"`). Where the new optional fields land. **No project/folder/scope field exists yet.**
- `backend/app/services/tool_dispatcher.py` — `ToolContext` dataclass (carries `folder_subtree_ids`, `scoped_folder_path`, `phase_whitelist`, `workflow_run_id`); `_handle_search_documents` (binds `ctx.folder_subtree_ids`, ignores model `args` today — the immutability is already partly true, but there is **no assert that args can't override and no post-query ⊆ check**).
- `backend/app/services/harness/phase_types.py` — `_build_phase_tool_context` (threads `folder_subtree_ids` into the per-phase `ToolContext`); `_exec_llm_agent` / `_exec_llm_batch_agents` (where per-phase `folder_scope` resolution + narrow-only lint attaches).
- `backend/app/services/retrieval_service.py` — `search_documents(..., folder_ids: list[str] | None = None)`; `_vector_search` / `_keyword_search` (pass `p_folder_ids` to the RPC). Where the post-query ⊆ assert + clip lands.
- `backend/app/api/kb.py` — `_collect_folder_ids` (subtree BFS, ~line 185-193).
- `backend/app/api/threads.py` — `_wf_get_subtree` (per-run subtree resolution today, from the thread folder, ~line 1210-1218) — the seam whose *source* changes to the workflow project binding.
- `backend/app/services/agent_loop.py` — `_get_subtree` (Deep-mode path, ~line 982-989). **RED LINE: keep byte-identical; the scope binding is additive on the workflow path only.**
- `supabase/full-schema.sql` — `match_document_chunks` (vector, `p_folder_ids` filter) + `keyword_search_chunks` (keyword, `p_folder_ids` filter) RPCs; the `documents` RLS SELECT policy (`auth.uid() = user_id` OR globally-visible folder).

### Governing decisions / guardrails
- `CLAUDE.md` — migration rules (numbered SQL under `supabase/migrations/`, apply via SQL editor never `db push`/`reset`, regenerate `full-schema.sql`); RLS mandate; provider-docs-first + cross-provider mandate; the G-1/G-5 hot-file ledger (098 is additive/greenfield — it does **not** pile onto `backend/app/api/threads.py` or `backend/app/services/anthropic_service.py`; the `threads.py` extraction stays due but must not grow).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The server-side scope channel already exists end-to-end:** `ctx.folder_subtree_ids` → `search_documents(folder_ids=...)` → RPC `p_folder_ids` → `d.folder_id = ANY(p_folder_ids)`. 098 changes the **source** of the scope (workflow project binding + per-phase narrowing) and adds the ⊆ assert + observability. It does **not** build a new retrieval path.
- **Subtree resolution is already implemented:** `_collect_folder_ids` (BFS, `kb.py`) and `_wf_get_subtree` (`threads.py`). Reuse for resolving `project_folder_id` → `scope_folder_ids`.
- **Output-side infra already shipped** (for the deferred D-08 behavior): `documents.py:402-423` (sha256 `content_hash` dedup), `:425-449` (filename-keyed versioning + retire-priors via `is_latest=False`), `:656` (`POST /documents/{id}/reingest`).

### Established Patterns
- **Additive-optional fields on `_StrictBase` (`extra="forbid"`):** the zero-migration immutability pattern — new optional fields keep old published rows valid.
- **Provider handling at the service boundary; the shared retrieval path never branches by provider** — why scope governance is provider-agnostic by construction (D-09).
- **Numbered SQL migration** under `supabase/migrations/`, applied via the SQL editor, then `scripts/regenerate-full-schema.sh` (no reset) to rebuild `full-schema.sql`.

### Integration Points
- New optional fields → `backend/app/models/harness.py` (`WorkflowDefinition` + phase configs) + a numbered migration adding columns to `workflow_definitions`.
- ⊆ assert + clip + warning event → `retrieval_service.search_documents` / `tool_dispatcher._handle_search_documents`.
- Per-phase `folder_scope` resolution + narrow-only publish lint → `phase_types.py` + the harness validate/lint path.
- Workflows-library project filter → the workflow-definitions load/query path + a `GET` filter param.
- **RED LINE:** Deep-mode behavior stays byte-identical. Critically, the ⊆ assert+clip lands on `search_documents` / `_handle_search_documents`, which **Deep also dispatches through** — so it MUST be gated to a bound scope (literal no-op when `folder_ids is None`; see **D-05a**). The `agent_loop.py` subtree path is untouched; the binding is additive on the workflow path only.

</code_context>

<specifics>
## Specific Ideas

- **"Project = a single folder + subtree" is the scope object** (locked). Output target is a *separate* optional field, never part of "the project" — a project stays a simple single-folder object.
- **Lock the field SHAPES, defer the BEHAVIOR.** 098 reserves the additive-optional shapes (binding + per-phase scope + the output-side dimension); the output re-ingestion behavior is Phase 100/101/102.
- **Clip-not-fail on scope violation — but LOUD in the run log.** Resilience + auditability over brittleness.
- **Cross-provider: representative-4 here, full native-7 reserved for Phase 101.** Scope is provider-agnostic by construction; the field-map emission is where provider variance actually bites.

</specifics>

<deferred>
## Deferred Ideas

- **Output re-ingestion BEHAVIOR (SEED-069 wiring)** → Phase 100/101/102. 098 locks only the shapes.
- **`inputs` / `assets` field BEHAVIOR** → Phase 100 (assets / ephemeral template upload) + Phase 103 (inputs / launch form + NL authoring). Shape MAY co-lock in 098's migration (Claude's Discretion above; lean co-lock to avoid a second migration).
- **Full native-7 + OpenRouter structured-output validation (Condition 7)** → Phase 101 (field-map emission).
- **Workflows page UI (project filter surface)** → Phase 103 (sketch-gated, G-2).
- **`minimax-m3-invalid-tool-args-400` (open bug)** → leave open; watch during 098 cross-provider UAT; re-open/route only if it surfaces there.

*No reviewed-but-deferred todos — `todo.match-phase` surfaced none for this phase.*

</deferred>

---

*Phase: 098-project-binding-server-side-kb-scope-governance*
*Context gathered: 2026-06-09*
