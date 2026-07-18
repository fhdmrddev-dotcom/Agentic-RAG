# Phase 152: Workflow Run Inputs - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the workflow **Run modal** into a real run-input channel and add a **safe workflow-delete cascade**. Three requirements:

- **WFIN-01** — Upload a file (e.g. a docx template to fill) as a workflow **run input** from the Run modal — stored with the untrusted-upload provenance stamp (`kind='template_input'`, never routed to the Jinja fill engine), size/MIME allowlisted, wired through `create_workflow_run.inputs` into the existing whitelist-gated fill path.
- **WFIN-02** — Point a workflow's retrieval at a chosen **KB folder** — author-time default **plus** per-run override on the Run modal (the read-only bound-folder chip becomes selectable) — reusing the Phase-098 **server-side** scope resolver so the model cannot widen scope; identical behavior across all providers.
- **WFIN-03** — **Delete** a workflow with a safe cascade (definitions, versions, runs disposition made explicit), with confirmation and **no orphaned runs/threads**.

**This phase is NOT:** NL/AI workflow authoring, a new retrieval path, a new upload endpoint, or any change to how runs stream/display. It clarifies HOW to implement the three requirements above — new capabilities belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Locked upstream — carried forward from the G-2 sketch (commit `b3991817`, both sketches winner A) — DO NOT re-open

- **D-LOCK-01 (scope-control shape, SEED-112 RESOLVED):** the read-only bound-folder chip becomes an **inline `<select>` dropdown** in the existing 560px Run modal — NOT the Perplexity 3-way segmented toggle (documented fallback), NOT a two-step/side-panel. Author folder is tagged "workflow default"; a per-run pick = override.
- **D-LOCK-02 (template button):** a quiet `TemplateUpload`-style button in the Run modal → `kind='template_input'` into run inputs, with an honest provenance note in the UI ("stored untrusted — never run as code, never fed to the fill engine").
- **D-LOCK-03 (delete surface):** reached from the workflow card **⋯-menu**; a **victim-naming confirm sheet** (reuse the shipped **064/068** pattern, audit-recorded "✎ with your name") that names **Removed** (definition · N versions · N runs) vs **Kept** (N chat threads → become normal chats; transcripts/files stay; KB untouched). NOT type-to-confirm (fallback B), NOT archive-vs-delete (fallback C).
- **D-LOCK-04 (delete disposition):** **hard-delete** definitions + versions + runs; **threads are detached-but-kept** (clear `threads.active_workflow_run_id`, they become normal chats); the KB is never touched. Satisfies WFIN-03 "no orphaned runs/threads."
- **D-LOCK-05 (in-flight run on delete):** cancel-first via the **064 `cancel_run` / zombie-heal** path, then delete — never delete a live run out from under the engine.

### Run-input plumbing (WFIN-01 + WFIN-02)

- **D-01 (single input channel, NO migration):** both the template handle and the per-run folder override travel in the **existing `inputs: dict`** param of `create_workflow_run(...)` (`backend/app/db/workflows.py:77`), persisted as `workflow_runs.inputs` **jsonb**. No new column, no new table, no new migration expected. (Planner: confirm no schema change is required; the only thing that would add a migration is D-03's open research question.)
- **D-02 (template asset lifecycle — reuse verbatim):** the Run modal uploads through the **existing `upload_template`** route (`backend/app/api/workspace.py:222`, `validate_upload` at :176 — magic-byte validated, `_ALLOWED_EXT` widened in Phase 151-03, TTL `expires_at`, stamps `kind='template_input'`), then carries the returned asset handle into `inputs.template_input`. No new upload endpoint. The handle flows through `create_workflow_run.inputs` into the **existing whitelist-gated `render_template` fill path** (fill-only, never auto-executed, never a Deep-chat tool — see `[[reference_render_template_workflow_only]]`).

### Folder-scope retrieval (WFIN-02) — server-enforced, cross-provider

- **D-03 (author-time default source — RECOMMENDED, flagged for research):** reuse the workflow definition's existing **`project_folder_id`** as the author-time **retrieval** default (absent = whole-KB). Rationale: the starters already have `project_folder_id` stripped at promotion (D-143-4b) so they stay unscoped — no regression — and it avoids a second confusing "which folder" field. **RESEARCH must confirm** `project_folder_id` is not load-bearing *purely* as a display/organization tag today (it currently renders the read-only chip and is NOT wired to retrieval — SEED-112). If reusing it would conflict with that display meaning, add a dedicated `retrieval_folder_id` on the definition instead (this is the one path that WOULD add a migration).
- **D-04 (how scope reaches retrieval — SC#10 safe):** the resolved folder scope is applied **server-side** through the existing Phase-098 path — `backend/app/services/document_view_resolver.py` (`folder_scope` → cycle-guarded subtree LIST via `resolve_project_subtree`) + the `agent_loop.py:1177-1249` thread-folder-scope wiring. The model receives an already-constrained scope; it **cannot widen** it through `search_documents`. Because the constraint lives at the service boundary (not a per-provider prompt), behavior is identical across OpenAI / Anthropic / Google / OpenRouter. NOT a prompt-only instruction (model could ignore/widen), NOT a client-side filter.
- **D-05 (folder ownership/authorization):** the server **validates the chosen folder is owner-reachable** (owner-scoped RLS; reuse the resolver's owner-scoped subtree walk). A never-owned or unreachable `folder_id` → **no narrowing / refuse** (mirror the resolver's "unreachable scope → no narrowing"). Never trust a client-supplied `folder_id` blindly — a run must not be able to scope into another user's folder.

### Backward compatibility

- **D-06 (absent inputs = today's behavior):** no template + no folder override = the run behaves **exactly** as it does today (whole-KB retrieval, no template). Every existing workflow and all 3 shipped starters stay byte-identical.

### Threat model (WFIN-01) — carried, enforced at secure-phase

- **D-07 (untrusted-upload provenance):** WFIN-01's mitigation for upload/SSTI is the **untrusted-upload stamp** (`kind='template_input'`) + the hard rule "never routed to the Jinja/fill engine as trusted, never executed as code." Reuses the Phase-100/151 upload threat-model pattern. Enforced by planner + `/gsd:secure-phase`.

### G-5 red line

- **D-08:** WFIN-03's delete cascade endpoint joins **`backend/app/api/workflows.py`** (which already owns `delete_draft` at :18 and the `@router.delete` at :372), **never** `backend/app/api/threads.py` (G-5 hot-file ledger — `threads.py` is at 9+ touches, extraction due; do not add surface there).

### Claude's Discretion
- Exact `inputs` jsonb key names (`template_input`, `folder_id`/`folder_scope`), the precise Run-modal `<select>` option ordering, and copy for the provenance/victim-naming strings — planner/executor choose within the locked shapes above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contracts (the acceptance bar — G-2 sketch)
- `.planning/sketches/072-run-inputs-modal/README.md` + `index.html` — Run-inputs modal, winner **A** (inline-grows the 560px modal in place; chip→`<select>`; TemplateUpload→`template_input` + provenance note). Settles SEED-112 scope-shape = inline dropdown.
- `.planning/sketches/073-workflow-delete-cascade/README.md` + `index.html` — delete cascade, winner **A** (victim-naming sheet; Removed vs Kept; hard-delete + threads detached-but-kept).
- `.planning/sketches/MANIFEST.md` — "Phase 152 session" block (decisions #62/#63).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §WFIN-01 / WFIN-02 / WFIN-03 (lines 16-18) — the locked requirements.
- `.planning/ROADMAP.md` — Phase 152 row (SC#10 + G-2 sketch + WFIN-01 threat model).

### Seeds (the workflow-UX cluster that scoped this phase)
- `.planning/seeds/SEED-110-workflow-runtime-template-file-upload.md` — sibling run-input surface (template upload) folded into WFIN-01.
- `.planning/seeds/SEED-111-workflow-delete-and-cascade-lifecycle.md` — the delete/cascade lifecycle → WFIN-03.
- `.planning/seeds/SEED-112-workflow-run-kb-folder-scope-selection.md` — the folder-scope selection ask → WFIN-02 (scope-shape RESOLVED = inline dropdown).

### Reference memory
- `[[reference_render_template_workflow_only]]` — `render_template` is workflow-fill-only, whitelist-gated (never a Deep-chat tool). Constrains D-02.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`frontend/src/pages/WorkflowsPage.tsx:719` `RunModal`** — the LIVE 560px dialog: read-only bound-folder chip at :794 (`D-103-1` — the NAME, never a path), kickoff textarea, declared `input_keys` hint at :813. This phase extends it **in place** (D-LOCK-01/02).
- **`frontend/src/components/panel/TemplateUpload.tsx`** — the template upload widget to reuse for the quiet Run-modal upload button.
- **`frontend/src/pages/ChatArea.tsx:407`** — the chat "scope to a folder" selector vocab ("All documents / {folder}") to mirror for the `<select>`.
- **`backend/app/api/workspace.py`** — `validate_upload` (:176, allowlist + magic bytes) and `upload_template` (:222, `kind='template_input'` at :267, TTL). Reuse verbatim (WFIN-01).
- **`backend/app/db/workflows.py:77` `create_workflow_run(inputs: dict, ...)`** — the ONLY live path that creates a workflow run; persists `inputs`+`model` as `$3::jsonb`. The wiring point for BOTH template handle and per-run folder override (D-01).
- **`backend/app/services/document_view_resolver.py`** (`folder_scope` → subtree via `resolve_project_subtree`) + **`backend/app/services/agent_loop.py:1177-1249`** (thread folder-scope wiring) — the Phase-098 server-side scope path WFIN-02 reuses (D-04).
- **`backend/app/services/run_lifecycle.py:253`** — already does `.update({"active_workflow_run_id": None})`: the exact "detach thread, keep it" mechanic WFIN-03's cascade reuses (D-LOCK-04).
- **`backend/app/api/admin.py` kill_run (~:420-490)** — the 064-B victim-naming + `cancel_run`/zombie-heal pattern (D-LOCK-03/05).

### Established Patterns
- Run inputs are a **jsonb bag** (`workflow_runs.inputs`) — additive keys, no schema churn (D-01).
- Owner-scoping lives **upstream in the route** (the send_message handler ownership-checks the thread + resolves the definition under RLS before `create_workflow_run` runs as service role) — WFIN-02's folder authorization (D-05) must sit at that same route/resolver boundary.
- Scope constraint at the **service boundary**, never per-provider prompt → cross-provider uniformity for free (D-04, SC#10).

### Integration Points
- WFIN-01/02: Run modal → `upload_template` (WFIN-01) → `create_workflow_run.inputs` → harness reads `inputs` at retrieve-step setup → `document_view_resolver`/`agent_loop` scope path.
- WFIN-03: workflow card ⋯-menu → new cascade endpoint in `api/workflows.py` (NOT `threads.py`, D-08) → cancel-first (`cancel_run`) → hard-delete defs/versions/runs → detach threads (`active_workflow_run_id = NULL`).

</code_context>

<specifics>
## Specific Ideas

- The operator's north star (SEED-112): "enhance UX / simplify, while keeping workflows accurate, smooth, and error-free." The original ask: "I have a project and I need this workflow to only search that specific folder of the project."
- The victim-naming sheet must read as **honest** (names exact counts of what's Removed vs Kept), matching the 064/068 tone already shipped in the operator surfaces.

</specifics>

<deferred>
## Deferred Ideas

- **Archive-vs-hard-delete** (sketch 073 fallback C) — hard-delete chosen now (D-LOCK-04). Revisit if users later want recoverable/soft delete.
- **Type-to-confirm delete** (sketch 073 fallback B) — victim-naming sheet chosen instead (D-LOCK-03).
- **Perplexity 3-way segmented scope toggle** (SEED-112 fallback) — inline dropdown chosen (D-LOCK-01).
- **Three open workflow-DISPLAY bugs** — `killed-workflow-empty-chat-card`, `BUG-260610-01` (nav timer-reset / duplicated avatar), `BUG-260712-02` (duplicate user bubble). Reviewed at this discuss touchpoint: all sit on the **frontend/streaming + run-display** surface (`affected_areas`: streaming/chat/run-honesty), which does NOT overlap this phase's run-input / folder-scope / delete domain → **left open** (candidates for Phase 153 `MessageItem`/`StreamsProvider`, or a future run-honesty phase). Not folded.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (todo match score 0.6) — an **NL→workflow authoring** spike (describe + upload-template → AI-derived inputs/phases → KB-grounded fill → human refine → run). Matched on shared vocabulary (upload/template/inputs/run) only; the actual scope is generalized NL authoring (**SEED-051**), a separate future capability — folding it would breach the phase scope guardrail. **Reviewed, deferred** — not folded into 152.

</deferred>

---

*Phase: 152-workflow-run-inputs*
*Context gathered: 2026-07-14*
