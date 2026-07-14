# Phase 152: Workflow Run Inputs - Research

**Researched:** 2026-07-14
**Domain:** FastAPI/asyncpg workflow-run plumbing · Supabase FK cascade delete · Phase-098 server-side retrieval scope · Phase-100/101 untrusted-template lifecycle · React Run modal
**Confidence:** HIGH (every finding is grepped/read against live code with file:line evidence; the one design open-question — D-03 — is now definitively resolved by code)

> **Provenance note:** every factual claim below is tagged `[VERIFIED: <path>:<line>]` (read/grepped this session against the actual repo — the code IS the authoritative source), `[CITED: ...]` (design contract / sketch / CLAUDE.md), or `[ASSUMED]` (training-only inference the planner must confirm). No external packages are installed by this phase, so the Package Legitimacy Audit is a no-op (see that section).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (carried from the G-2 sketch — DO NOT re-open)
- **D-LOCK-01** — scope-control shape = inline `<select>` dropdown in the existing 560px Run modal (NOT a segmented toggle, NOT a side panel). Author folder tagged "workflow default"; a per-run pick = override.
- **D-LOCK-02** — a quiet `TemplateUpload`-style button in the Run modal → `kind='template_input'` into run inputs, with an honest provenance note ("stored untrusted — never run as code, never fed to the fill engine").
- **D-LOCK-03** — delete reached from the workflow card ⋯-menu; a victim-naming confirm sheet (reuse 064/068 pattern, audit-recorded "✎ with your name") naming **Removed** (definition · N versions · N runs) vs **Kept** (N chat threads → normal chats; transcripts/files stay; KB untouched). NOT type-to-confirm, NOT archive-vs-delete.
- **D-LOCK-04** — hard-delete definitions + versions + runs; threads detached-but-kept (clear `threads.active_workflow_run_id`); KB never touched.
- **D-LOCK-05** — in-flight run on delete: cancel-first via the 064 `cancel_run`/zombie-heal path, then delete.
- **D-01** — single input channel, NO migration: both the template handle and the per-run folder override travel in the existing `inputs: dict` of `create_workflow_run(...)`, persisted as `workflow_runs.inputs` jsonb.
- **D-02** — template asset lifecycle: reuse the existing `upload_template` route verbatim; handle flows through `create_workflow_run.inputs` into the whitelist-gated `render_template` fill path.
- **D-03** — author-time retrieval default source = the definition's existing `project_folder_id` (RESEARCH must confirm it isn't purely display; **RESOLVED below — it is already the retrieval default, no new column, no migration**).
- **D-04** — scope reaches retrieval server-side via the Phase-098 path; the model cannot widen it; identical across providers.
- **D-05** — server validates the chosen folder is owner-reachable; never-owned/unreachable → no narrowing/refuse.
- **D-06** — absent inputs = today's behavior (whole-KB, no template); every existing workflow + 3 starters byte-identical.
- **D-07** — WFIN-01 threat model = the untrusted-upload stamp (`kind='template_input'`) + "never routed to the Jinja/fill engine as trusted, never executed as code."
- **D-08** — WFIN-03's cascade endpoint joins `backend/app/api/workflows.py`, NEVER `threads.py` (G-5 red line).

### Claude's Discretion
- Exact `inputs` jsonb key names (`template_input`, `folder_id`/`folder_scope`), Run-modal `<select>` option ordering, provenance/victim-naming copy.

### Deferred Ideas (OUT OF SCOPE)
- Archive-vs-hard-delete (sketch 073 fallback C). Type-to-confirm delete (fallback B). Perplexity 3-way scope toggle (SEED-112 fallback). NL/AI workflow authoring (SEED-051 / `spike-nl-workflow-authoring`). The three open workflow-DISPLAY bugs (killed-workflow-empty-card, BUG-260610-01, BUG-260712-02) — left open, not folded.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **WFIN-01** | Upload a file (docx template) as a workflow run input from the Run modal — `kind='template_input'`, size/MIME allowlisted, wired through `create_workflow_run.inputs` into the whitelist-gated fill path | The **entire untrusted-template lifecycle already exists** (`upload_template` → `workspace_files kind='template_input'` → `pin_templates_for_run` → `resolve_template_source` Branch 2 → `run_replace` engine). The genuine net-new work is **frontend sequencing** (createThread → upload → sendMessage) + a provenance note. See §WFIN-01. |
| **WFIN-02** | Point retrieval at a chosen KB folder — author-time default + per-run override — via the Phase-098 server-side resolver; model can't widen; identical across providers | `project_folder_id` is **already the author-time retrieval default** wired at 3 sites (kickoff/resume/Continue). Net-new = a per-run **override** read from `inputs.folder_id` at kickoff, an owner-reachability gate (D-05), and making the modal chip a `<select>`. See §WFIN-02. |
| **WFIN-03** | Delete a workflow with a safe cascade (definitions/versions/runs explicit), confirmation, no orphaned runs/threads | FK map is known and FK-safe order is derived. The immutability trigger is **UPDATE-only** (does NOT block DELETE); the only blocker is `workflow_runs.definition_id ON DELETE RESTRICT`. New owner-gated cascade endpoint + db helper in `api/workflows.py`. See §WFIN-03. |
</phase_requirements>

---

## Summary

This phase is **~85% assembly of already-shipped machinery**, not net-new systems. The three most consequential findings invert or sharpen the CONTEXT premises:

1. **WFIN-02 / D-03 is definitively resolved by code: `project_folder_id` is NOT "purely display" — it has been the author-time *retrieval* default since Phase 098.** It is read at all three run-start sites (`threads.py:1537` kickoff, `harness_engine.py:1515` resume, `runs.py:918` Continue), resolved to a folder subtree by `harness/scope.py:resolve_project_subtree`, and enforced at the RPC via `p_folder_ids`. The read-only chip on the Run modal renders the *actual* retrieval binding. **Therefore reusing it needs no new column and no migration** — the net-new work is only the per-run *override* channel. `[VERIFIED: backend/app/api/threads.py:1537]` `[VERIFIED: backend/app/services/harness/scope.py:51]`

2. **WFIN-01's untrusted-template pipeline already exists end-to-end.** Templates upload to the **thread's** `workspace_files` with `kind='template_input'` (`upload_template`, `workspace.py:222`), get their TTL pinned for the run (`pin_templates_for_run`, invoked at `threads.py:1162`), and are discovered by provenance at fill time (`resolve_template_source` Branch 2 → provenance `template_input` → `run_replace` engine, NEVER the trusted `docxtpl`/Jinja path). The template is discovered **from the thread workspace by `kind`, not from `inputs`** — so the CONTEXT's "carry the handle in `inputs.template_input`" is *optional* (useful only as an observability/echo tag). The real net-new work is **frontend**: the Run modal must `createThread → upload_template(newThread) → sendMessage`. `[VERIFIED: backend/app/services/template_asset_service.py:120]`

3. **WFIN-03's cascade is unblocked by the immutability trigger** (`workflow_definitions_block_published` is a `BEFORE UPDATE` trigger only — it never fires on DELETE `[VERIFIED: supabase/full-schema.sql:2598]`). The single delete blocker is the `ON DELETE RESTRICT` FK from `workflow_runs.definition_id`, which dictates the order: cancel in-flight → delete runs → delete definition versions. Deleting runs auto-cascades phases (`ON DELETE CASCADE`) and auto-detaches threads (`threads.active_workflow_run_id ON DELETE SET NULL`), so "threads become normal chats" is partly free.

**Primary recommendation:** Structure as **3 plans + a UAT plan**: (1) WFIN-02 folder override (backend kickoff wiring + owner gate + resolve-precedence) — highest risk; (2) WFIN-01 Run-modal template upload (frontend-led, reusing existing endpoints) — lowest backend risk; (3) WFIN-03 delete cascade (new endpoint + db helper + victim-naming sheet); (4) the SC#10 cross-provider VALIDATION.md. **No migration** unless the planner rejects the D-03 finding (they should not — the evidence is unambiguous).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template upload (WFIN-01) | API/Backend (`workspace.py` upload) | Browser (Run modal file picker + createThread sequencing) | Bytes validated + stamped `template_input` server-side; the client only orchestrates the createThread→upload→send order. |
| Template byte resolution + fill | API/Backend (`template_asset_service` + `tool_dispatcher._handle_render_template`) | Sandbox (Docker) | Untrusted bytes routed to `run_replace`; trusted lib assets to `docxtpl`; render runs in the sealed sandbox. |
| Folder scope resolution (WFIN-02) | API/Backend (`harness/scope.py` + kickoff wiring in `threads.py`) | Database (RLS `match_user_id` + `p_folder_ids` RPC filter) | The constraint MUST live at the service boundary so the model can't widen it and behavior is provider-uniform (SC#10). |
| Per-run override authorization (D-05) | API/Backend (kickoff route, owner-scoped `fetch_visible_folders`) | Database (documents already `match_user_id`-scoped) | A client-supplied `folder_id` is untrusted; owner-reachability must be asserted at the route, mirroring `assert_folder_scopes_subset`. |
| Delete cascade (WFIN-03) | API/Backend (`api/workflows.py` new endpoint + `db/workflows.py` helper) | Database (FK cascade / SET NULL / RESTRICT ordering) | Owner gate is app-layer (service-role engine bypasses RLS); FK order is DB-enforced. |
| Victim-naming confirm + counts | Browser (React sheet) | API/Backend (a count/preview read + audit write) | UI shows exact Removed/Kept counts before commit; server is the source of truth for counts + the audit receipt. |

---

## Standard Stack

No new libraries. Everything is in-repo and already installed. The "stack" here is the set of **existing seams to reuse verbatim**.

### Core (reuse — do not re-implement)
| Seam | Location | Purpose | Why standard |
|------|----------|---------|--------------|
| `upload_template` | `backend/app/api/workspace.py:222` `[VERIFIED]` | Ephemeral upload → `workspace_files kind='template_input'` + TTL; magic-byte + size gate | The single net-new workspace WRITE endpoint (Phase 100); widened allowlist in 151-03. Reuse verbatim (D-02). |
| `validate_upload` | `backend/app/api/workspace.py:176` `[VERIFIED]` | MIME/magic-byte/size allowlist (OOXML + text + image); 422 at the door | The WFIN-01 threat gate; already covers docx/pptx/xlsx. |
| `create_workflow_run(inputs, model, ...)` | `backend/app/db/workflows.py:77` `[VERIFIED]` | Atomic run+phases+anchor insert; persists `inputs`/`model` as `$3::jsonb` | The ONE live path that creates a workflow run; the single wiring point for both new inputs (D-01). |
| `resolve_project_subtree` | `backend/app/services/harness/scope.py:51` `[VERIFIED]` | `project_folder_id → list[str]` owner-scoped subtree (cycle-guarded); `None→None` = whole-KB | THE Phase-098 server-side scope resolver (D-04). Reuse for the override. |
| `assert_folder_scopes_subset` | `backend/app/services/harness/scope.py:92` `[VERIFIED]` | DB-aware ⊆ check: every per-phase `folder_scope` ⊆ project subtree; `ValueError`→400 | Already invoked at kickoff (`threads.py:1129`). The override must not break this invariant. |
| `resolve_template_source` | `backend/app/services/template_asset_service.py:120` `[VERIFIED]` | Provenance-tagged byte resolution: Branch1 lib=`docxtpl`, Branch2 upload=`run_replace` | The fill-path discovery seam; already user+run-scoped + expiry-gated. |
| `pin_templates_for_run` | `backend/app/services/template_service.py` (invoked `threads.py:1162`) `[VERIFIED]` | Extend-only TTL pin so a template can't expire mid-run | Already runs on every kickoff. Templateless thread → 0-row no-op. |
| `_cancel_run_internals` / `cancel_run` (zombie-heal) | `backend/app/services/run_lifecycle.py` (used `admin.py:481`) `[VERIFIED]` | Cancel a live/stuck run, clear the thread anchor, emit terminal sentinel | The 064 pattern for WFIN-03 cancel-first (D-LOCK-05). |
| `fetch_visible_folders(supabase, user_id)` | `backend/app/utils/folder_utils.py` (used in `scope.py:71`) `[VERIFIED]` | Owner-scoped folder list | The D-05 owner-reachability gate for the override folder. |
| Run-modal launch (`createThread → sendMessage(workflow_definition_id)`) | `frontend/src/pages/WorkflowsPage.tsx` (onLaunch, ChatLayout) `[VERIFIED]` | The existing kickoff wire; `MessageCreate.workflow_definition_id` | Reuse; extend `MessageCreate` + the launch closure with the two new inputs. |

### Supporting (touch points)
| Seam | Location | When |
|------|----------|------|
| `MessageCreate` | `backend/app/models/message.py:8` `[VERIFIED]` | Add optional `run_inputs`/`folder_id`/`template handle` fields for WFIN-01/02 to reach `create_workflow_run.inputs`. |
| kickoff scope block | `backend/app/api/threads.py:1523-1609` `[VERIFIED]` | The exact injection point for the per-run override (WFIN-02). |
| `delete_workflow_definition` | `backend/app/db/workflows.py:404` `[VERIFIED]` | Draft-only precedent; WFIN-03 needs a NEW published-cascade helper alongside it. |
| `@router.delete("/{definition_id}")` (`delete_draft`) | `backend/app/api/workflows.py:377` `[VERIFIED]` | Currently draft-only. WFIN-03 adds a NEW distinct route (avoid semantic collision). |
| `deleteWorkflowDraft` (client) | `frontend/src/lib/api.ts:3231` `[VERIFIED]` | `DELETE /workflows/{id}` — note the path collision risk (see Landmines). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reuse `project_folder_id` as retrieval default (D-03 recommended) | New `retrieval_folder_id` column (+ migration) | **Rejected by evidence:** `project_folder_id` is already the retrieval default; a second column would duplicate meaning and force a migration D-01 forbids. |
| Discover template from thread workspace (existing) | Carry a resolved handle in `inputs.template_input` and read it in the fill path | The existing discovery is by `kind` on the thread, not by an `inputs` handle. Putting a handle in `inputs` is *optional echo* only; wiring the fill path to prefer it would be net-new, unneeded work. |
| New distinct delete route for published cascade | Overload the existing draft `DELETE /{id}` | Overloading changes the draft route's 404-for-published contract + its `require_visible('workflow_authoring')` gate semantics; a distinct route is cleaner (see Landmines). |

**Installation:** none. `docxtpl` already ships in the sandbox image (tag `101.1`, per CLAUDE.md); no backend-venv install. `[CITED: CLAUDE.md]`

**Version verification:** N/A — zero new packages.

## Package Legitimacy Audit

**This phase installs no external packages.** All work reuses in-repo modules. slopcheck/registry verification is therefore not applicable.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No external dependencies added |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
WFIN-01 (template) + WFIN-02 (folder override) — RUN LAUNCH FLOW
─────────────────────────────────────────────────────────────────
[Run modal]  user picks folder in <select>, uploads template file
     │
     │ (1) createThread() ───────────────► new thread_id (owned by user)
     │ (2) POST /workspace/files?thread_id=new  (upload_template)
     │        └─ validate_upload (MIME/magic/size) ─► workspace_files
     │             {kind:'template_input', expires_at, created_by}
     │ (3) POST /threads/{new}/messages
     │        { content, workflow_definition_id, folder_id(override) }
     ▼
[threads.py send_message]  (owner-checks thread + resolves definition under RLS)
     │  assert_folder_scopes_subset(def)         ← 400 on invalid def scope
     │  pin_templates_for_run(thread)            ← extends template TTL
     │  create_workflow_run(inputs={kickoff_prompt, folder_id?, template?}, ...)
     │        └─ workflow_runs.inputs (jsonb)  + threads.active_workflow_run_id
     ▼
[agent_runner → harness branch]  (threads.py:1501)
     │  ── WFIN-02 injection point (threads.py:1537) ──
     │  scope_root = inputs.folder_id (override, owner-gated)   ← NET-NEW
     │             ?? definition.project_folder_id (author default)
     │             ?? thread.folder_id (legacy fallback)
     │  folder_subtree_ids = resolve_project_subtree(scope_root, owner)
     ▼
[run_workflow → phase_types → tool_dispatcher._handle_search_documents]
     │  search_documents(query, ctx.current_user.id, folder_ids=folder_subtree_ids)
     │        └─ RPC match_document_chunks(match_user_id, p_folder_ids)  ← owner+folder scoped
     │  scope_violation clip (post-query backstop) if any row escapes
     ▼
[render_template phase]  resolve_template_source(asset_ref=None → Branch 2)
     │  newest non-expired kind='template_input' for thread+user (run-claim scoped)
     │  provenance='template_input' → select_engine → run_replace (NOT docxtpl/Jinja)
     ▼  filled deliverable → workspace_file_written SSE → OutputFileCard


WFIN-03 (delete cascade) — FK-SAFE ORDER
─────────────────────────────────────────────────────────────────
[card ⋯-menu → victim-naming sheet]  shows Removed/Kept counts
     │  DELETE /workflows/{id}/cascade   (owner-gated; NET-NEW route)
     ▼
[api/workflows.py → db/workflows.py cascade helper — ONE txn]
     │  0. owner-check id (created_by = user) ; resolve slug → all versions
     │  1. cancel_run() every in-flight run (status active/paused/cap_paused)  ← D-LOCK-05
     │  2. DELETE workflow_runs WHERE definition_id IN (versions)
     │        ├─ CASCADE → workflow_phases (auto)
     │        └─ SET NULL → threads.active_workflow_run_id (auto — threads KEPT)
     │  3. DELETE workflow_definitions WHERE id IN (versions)   (RESTRICT now satisfied)
     │  (harness_audit rows: run_id has NO FK → linger as audit trail — decide)
     ▼  audit receipt "✎ Deleted {name} — your name"
```

### Recommended structure (files touched)
```
backend/app/
├── models/message.py            # + optional run_inputs / folder_id / template fields (WFIN-01/02)
├── api/threads.py               # WFIN-02: read+gate override at the :1537 kickoff scope block
│                                #   (G-5: shrink-not-grow — delegate the gate to a helper)
├── api/workflows.py             # WFIN-03: NEW owner-gated cascade DELETE endpoint (D-08)
├── db/workflows.py              # WFIN-03: NEW delete_published_workflow_cascade() helper (one txn)
│                                # WFIN-03: NEW count/preview query for the victim-naming sheet
└── services/harness/scope.py    # (optional) a resolve_run_scope_root() that layers override>default>thread

frontend/src/
├── pages/WorkflowsPage.tsx      # RunModal: chip→<select>, TemplateUpload button, provenance note;
│                                #   PublishedCard: NEW ⋯-menu → delete; victim-naming sheet
├── components/panel/TemplateUpload.tsx   # reuse widget in the modal
└── lib/api.ts                   # + deleteWorkflowCascade(), + folder-scope/template on the launch call
```

### Pattern 1: Server-boundary scope (never a prompt) — SC#10 for free
**What:** The retrieval scope is a resolved `folder_subtree_ids: list[str]` bound onto the tool context server-side; the RPC filters on `p_folder_ids` AND `match_user_id`; a post-query `scope_violation` clip is the in-app backstop.
**When to use:** WFIN-02, every provider.
**Why it's provider-uniform:** the model never receives scope as instruction — it calls `search_documents(query)` and the constraint is applied *around* it identically for OpenAI/Anthropic/Google/OpenRouter. `[VERIFIED: backend/app/services/tool_dispatcher.py:682]`
```python
# Source: backend/app/services/tool_dispatcher.py:682 (verified)
results, avg_sim = await search_documents(
    args["query"], ctx.current_user["id"], ctx.supabase,
    metadata_filter=metadata_filter, user_settings=ctx.user_settings,
    folder_ids=ctx.folder_subtree_ids,          # ← the server-bound scope
)
if ctx.folder_subtree_ids is not None:          # runtime backstop clip + observable emit
    _scope = set(map(str, ctx.folder_subtree_ids))
    _dropped = [h for h in (results or []) if str(h.get("folder_id")) not in _scope]
    if _dropped: results = _kept; await ctx.emit(..., "scope_violation", ...)
```

### Pattern 2: Provenance-branch template resolution (untrusted → run_replace)
**What:** `resolve_template_source` picks the engine by SOURCE not content: a library `AssetRef` → `docxtpl` (trusted Jinja row-growth); `asset_ref is None` → newest ephemeral `template_input` upload → `run_replace` (no Jinja). This IS the D-07 SSTI mitigation, already implemented + threat-registered (T-101-03-01..04).
**When to use:** WFIN-01 — no change needed; just ensure the upload lands on the thread.
```python
# Source: backend/app/services/template_asset_service.py:120 (verified)
# asset_ref is not None → Branch 1 "library"  (docxtpl, trusted)
# asset_ref is None     → Branch 2 "template_input"  (run_replace, untrusted upload)
#   WHERE thread_id=$1 AND created_by=$2 AND kind='template_input'
#     AND (expires_at IS NULL OR expires_at > now()) AND run-claim scoped
```

### Pattern 3: FK-safe cascade in one transaction (mirror `create_workflow_run`)
**What:** Delete children before parents in the FK order the schema dictates, inside one `async with con.transaction()`, mirroring the existing atomic create.
```python
# Source: derived from backend/app/db/workflows.py:126 (create) + full-schema FKs (verified)
async with pool.acquire() as con:
    async with con.transaction():
        # 1. runs first — cascades workflow_phases, SET NULL on threads.active_workflow_run_id
        await con.execute("DELETE FROM workflow_runs WHERE definition_id = ANY($1::uuid[])", version_ids)
        # 2. then all definition versions (ON DELETE RESTRICT now satisfied)
        await con.execute("DELETE FROM workflow_definitions WHERE id = ANY($1::uuid[])", version_ids)
```

### Anti-Patterns to Avoid
- **Scope as a prompt instruction** — a model can ignore/widen it; breaks SC#10. Always the service boundary (Pattern 1). `[VERIFIED: D-04 + tool_dispatcher.py:682]`
- **Feeding an uploaded template to `docxtpl`/Jinja** — that is the SSTI hole D-07 forbids; the `run_replace` branch exists precisely so untrusted bytes never reach Jinja. `[VERIFIED: template_asset_service.py:13]`
- **Deleting `workflow_definitions` before `workflow_runs`** — `ON DELETE RESTRICT` raises a FK violation. `[VERIFIED: full-schema.sql:3203]`
- **Adding the delete endpoint to `threads.py`** — G-5 red line (threads.py at 9+ touches). `[CITED: CLAUDE.md G-5 + D-08]`
- **Trusting a client `folder_id`** — `resolve_project_subtree` does NOT validate the root is owner-reachable (see Landmine 4); add the gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upload validation + provenance stamp | A new upload endpoint / MIME check | `upload_template` + `validate_upload` | Already magic-byte/size-gated, TTL-stamped, threat-modeled (Phase 100/151). D-02. |
| Template byte resolution | New "which template" logic | `resolve_template_source` (Branch 2) | Newest-wins, user+run-scoped, expiry-gated, clean-error contract already built. |
| Folder subtree walk | Recursive `parent_id` walk (it's triplicated already) | `resolve_project_subtree` | Cycle-guarded, owner-scoped, returns `list` (not `set` — Pitfall 1). |
| Cancel a live run before delete | New cancel logic | `cancel_run` / `_cancel_run_internals` (zombie-heal) | Clears the anchor + emits the terminal sentinel; the 064 pattern (D-LOCK-05). |
| Thread detach on delete | Manual `UPDATE threads SET active_workflow_run_id=NULL` after delete | Rely on `ON DELETE SET NULL` (auto) + belt-and-braces the anchor clear | The FK does the detach when the run is deleted (`full-schema.sql:3131`). |
| Owner authorization | New RLS policy / trust the client | App-layer `created_by = $user` WHERE + `fetch_visible_folders` gate | The engine runs service-role (RLS bypassed); the WHERE IS the boundary (no RLS backstop). |

**Key insight:** WFIN-01 and WFIN-02 are *wiring existing server-enforced seams to a UI*, not building capabilities. The only genuinely new logic is the WFIN-02 override precedence + owner gate and the WFIN-03 cascade helper/endpoint.

---

## WFIN-01 — Template upload → run input (deep dive)

**The pipeline already exists end-to-end.** `[VERIFIED]` Evidence chain:
1. `upload_template` (`workspace.py:222`) uploads to `workspace_files` with `kind='template_input'`, TTL `expires_at`, `created_by=user`, magic-byte+size validated by `validate_upload` (`:176`). Returns `{path, kind, expires_at, ...}`.
2. At kickoff, `threads.py:1162` calls `pin_templates_for_run(thread_id, run_wall_clock_cap)` — extends the newest template's TTL so it survives the run.
3. At fill time, the `render_template` tool (`tool_dispatcher.py:2776`) calls `resolve_template_source(asset_ref=None)` → **Branch 2**: newest non-expired `kind='template_input'` row for `thread_id + created_by`, run-claim scoped → provenance `template_input` → `select_engine` → `run_replace` (NOT `docxtpl`). `[VERIFIED: template_asset_service.py:182]`

**What is genuinely net-new (mostly frontend):**
- The Run modal must **createThread first, upload to that thread, then sendMessage** — because `upload_template` is thread-scoped and the modal has no thread until launch. The existing `onLaunch` already does `createThread → sendMessage`; slot the upload between them. `[VERIFIED: WorkflowsPage.tsx onLaunch comment :11-13]`
- The quiet `TemplateUpload`-style button + the honest provenance note (D-LOCK-02).
- **Optional (Claude's discretion):** echo the handle in `inputs.template_input` for observability. It is **not required for the fill path** (discovery is by `kind`, not `inputs`). Flag to planner: decide echo-yes/no; if yes, it's a display tag only.

**Threat model (for the `<threat_model>` block — D-07, reuses Phase 100/101/151 register):**

| Threat | STRIDE | Mitigation (already in place unless noted) |
|--------|--------|---------------------------------------------|
| SSTI via a malicious template routed to Jinja | Tampering / EoP | `kind='template_input'` → `resolve_template_source` Branch 2 → `run_replace` engine; **never** `docxtpl`/Jinja. `[VERIFIED: template_asset_service.py:13]` |
| Template used as code / auto-executed | EoP | `render_template` is fill-only, whitelist-gated, never a Deep-chat tool. `[CITED: reference_render_template_workflow_only]` `[VERIFIED: tool_dispatcher.py:2133]` |
| Oversized / office-bomb upload (DoS) | DoS | `MAX_FILE_SIZE` (10MB) checked pre-buffer (declared part size) AND post-read; office-bomb guard before parse. `[VERIFIED: workspace.py:197,241]` |
| Wrong-type / renamed-binary upload | Tampering | `validate_upload` magic-byte + NUL/utf-8 gate; 422 at the door, nothing persisted. `[VERIFIED: workspace.py:176]` |
| Cross-user template read | Info Disclosure | Branch 2 WHERE `created_by=$user`; cross-user → no row → clean "no template", never bytes. `[VERIFIED: template_asset_service.py:20]` |
| Template outlives / expires mid-run | Availability | TTL + `pin_templates_for_run` extend-only. `[VERIFIED: template_service.py:12]` |
| Another run's template leaks in | Info Disclosure | run-claim scoping (`run_claim` col, Phase 141) — foreign-claimed rows invisible. `[VERIFIED: template_asset_service.py:95]` |
| **NEW-surface:** template uploaded to a thread the user doesn't own | EoP | `upload_template` calls `_verify_thread_ownership` (404 on non-owner). Since the modal creates a fresh owned thread, this holds. `[VERIFIED: workspace.py:237]` |

---

## WFIN-02 — Folder scope (deep dive) — **D-03 RESOLVED**

### D-03 verdict: `project_folder_id` is ALREADY the retrieval default. Reuse it. No migration.

**Full reader/writer map of `project_folder_id`** `[VERIFIED via grep]`:

| Site | Role | File:line |
|------|------|-----------|
| **Retrieval scope root — kickoff** | READ → resolves subtree, binds `folder_subtree_ids` | `threads.py:1537` |
| **Retrieval scope root — resume** | READ → `_resume_folder_subtree_ids` | `harness_engine.py:1515` |
| **Retrieval scope root — Continue** | READ → `_cont_subtree` | `runs.py:918` |
| **Retrieval scope root — publish golden run** | READ → `folder_subtree_ids` | `publish_service.py:531` |
| Picker filter (queryable per project) | READ → JSONB `definition->>'project_folder_id'` predicate | `db/workflows.py:219` / `api/workflows.py:143` |
| ⊆ validator (phase folder_scope subset) | READ | `scope.py:112`, `harness.py:259` |
| Golden-run thread `folder_id` binding | READ | `publish_service.py:511` |
| Authoring / NL-generate (SET at draft time) | WRITE (into `definition` JSONB) | `workflow_authoring.py:365`, `api/workflows.py:449` |
| Run-modal chip display | READ (renders folder name) | `WorkflowsPage.tsx:519,798` |

**Conclusion:** The read-only chip is NOT "purely display" — it renders the *same* `project_folder_id` that drives retrieval at every run-start path. **Reusing it as the author-time retrieval default is not merely safe — it is already the behavior.** No `retrieval_folder_id` column, no migration. This corrects the CONTEXT/SEED-112 premise ("NOT wired to retrieval"). `[VERIFIED]`

### The net-new work = the per-run OVERRIDE

**Injection point:** `threads.py:1523-1609` (the kickoff scope block). Today:
```python
# Source: backend/app/api/threads.py:1537 (verified)
if _kickoff_definition.project_folder_id is not None:
    _wf_scope_root = str(_kickoff_definition.project_folder_id)   # author default
else:
    _wf_scope_root = thread.folder_id                            # legacy fallback
```
**Change:** layer the override on top (highest precedence), sourced from the persisted `inputs.folder_id`:
```
scope_root = override(inputs.folder_id, owner-gated)   # NET-NEW, WFIN-02
          ?? definition.project_folder_id              # author default (existing)
          ?? thread.folder_id                          # legacy fallback (existing)
```
G-5 note: `threads.py` must **shrink, not grow** — extract this precedence into a small helper (e.g. `scope.resolve_run_scope_root(...)`) rather than adding inline branches. `[CITED: CLAUDE.md G-5 + scope.py G-5 note :8-9]`

### D-05 owner authorization — a genuine NET-NEW gate
`resolve_project_subtree` does **NOT** validate the root is owner-reachable — `_walk(root)` unconditionally returns `[root]` even when `root` isn't in the owner's folders. `[VERIFIED: scope.py:73-89]` So a client-supplied override `folder_id` must be explicitly gated:
- Assert `folder_id ∈ fetch_visible_folders(supabase, current_user)` at the kickoff route (where `current_user` is known — mirror the `assert_folder_scopes_subset` call site `threads.py:1129`).
- Fail per D-05: **no narrowing / refuse** on a never-owned / unreachable id.
- **Defense-in-depth already present:** the search RPC also filters `match_user_id` `[VERIFIED: retrieval_service.py:53]`, so even an ungated bad folder can only return the owner's own docs (or empty) — no cross-user leak. The gate's purpose is honest UX (avoid a silent empty-KB run) + explicit D-05 compliance.

### Composition landmine — override vs per-phase `folder_scope`
If a workflow declares per-phase `folder_scope` (⊆ `project_folder_id`), those scopes are **intersected** with the resolved subtree at `phase_types.py:326`. An override root that is a *different* folder can make that intersection empty → phases silently retrieve nothing. `[VERIFIED: phase_types.py:326]` **Recommendation:** for a workflow that declares any per-phase `folder_scope`, constrain the override to be ⊆ `project_folder_id`; for workflows with no per-phase scopes (the sketch's vendor-risk case), any owned folder is fine. Planner must pick the rule and the UI must reflect it. Flag as an Open Question.

### Resume/Continue persistence landmine
The override goes into `workflow_runs.inputs` (jsonb, durable). But resume (`harness_engine.py:1515`) and Continue (`runs.py:918`) re-derive scope from `definition.project_folder_id` **only** — they don't read `inputs.folder_id`. So a stranded/Continued run **silently reverts to the author default**. `[VERIFIED]` Recommendation: read the override from the durable `inputs` at all 3 sites (resume already loads `run.inputs` at `harness_engine.py:1571`; Continue must load it). If the planner scopes only kickoff, document the limitation explicitly.

### SC#10 cross-provider proof approach
The constraint lives at the RPC/tool boundary, not a prompt, so uniformity is structural. Prove it with a 4-provider matrix: for each of OpenAI/Anthropic/Google/OpenRouter, launch the same bound workflow with a folder override and assert (a) the run's `search_documents` citations all carry `folder_id ∈ override_subtree`, and (b) a `scope_violation` emit fires 0 times in a healthy run (or the clip drops out-of-scope rows if the RPC ever regresses). Evidence: Supabase `harness_audit` + the run's citations + the `scope_violation` SSE. Existing test scaffold: `test_098_scope_governance.py` patches `scope.resolve_project_subtree` and asserts run-start sources from the binding. `[VERIFIED: test_098_scope_governance.py:154]`

---

## WFIN-03 — Delete cascade (deep dive)

### FK map `[VERIFIED: supabase/full-schema.sql]`

| Child → Parent | On delete | Consequence for the cascade |
|----------------|-----------|-----------------------------|
| `workflow_runs.definition_id → workflow_definitions.id` | **RESTRICT** (`:3203`) | **The blocker.** Must delete runs before the definition. |
| `workflow_phases.workflow_run_id → workflow_runs.id` | **CASCADE** (`:3195`) | Deleting runs auto-deletes phases. No explicit step. |
| `threads.active_workflow_run_id → workflow_runs.id` | **SET NULL** (`:3131`) | Deleting a run auto-detaches its thread (threads KEPT). Satisfies D-LOCK-04's "become normal chats". |
| `workflow_runs.thread_id → threads.id` | CASCADE (`:3211`) | Irrelevant (we don't delete threads). |
| `harness_audit.run_id` | **NO FK** (nullable `:859`) | Rows linger after run delete — a soft orphan. **Decision needed** (keep as append-only audit vs null/delete). |
| `runs` (producer shells) → `threads.id` | CASCADE | Kept (thread kept). Chat run history stays on the normal thread. |
| `messages` → `threads.id` | CASCADE | Kept — transcripts stay (D-LOCK-04). |

**Only ONE FK references `workflow_definitions`** — `workflow_runs.definition_id`. `[VERIFIED: grep]` So once runs are gone, deleting all definition versions is clean.

### The immutability trigger does NOT block DELETE
`workflow_definitions_block_published` is `CREATE TRIGGER ... BEFORE UPDATE ON public.workflow_definitions` `[VERIFIED: full-schema.sql:2598]`; its body only guards `IF OLD.status='published' AND (NEW.* IS DISTINCT FROM OLD.*)` — i.e. UPDATE mutations. **DELETE never fires a `BEFORE UPDATE` trigger.** `[VERIFIED: full-schema.sql:375-397]` The `db/workflows.py:414` comment claiming the trigger "raises 23514 on a published-row DELETE" is **misleading** — the existing `delete_workflow_definition` refuses published rows only via its `status='draft'` WHERE guard (0 rows → False → 404), not the trigger. **Consequence: WFIN-03 needs NO trigger amendment and NO migration for the cascade.** `[VERIFIED]`

### FK-safe cascade order (one transaction)
1. **Owner-check** the target `definition_id` (`created_by = current_user`); 404 (no existence leak) on non-owner. `[CITED: get_definition precedent, db/workflows.py:255]`
2. **Resolve all versions**: "delete the workflow" = all rows sharing `slug` owned by the user (sketch says "definition · N versions"). Query `SELECT id FROM workflow_definitions WHERE slug=$slug AND created_by=$user`. (Planner: confirm the card→slug mapping — the Published shelf may render one card per latest version; deleting must sweep all versions.)
3. **Cancel in-flight runs** (status `active`/`paused`/`cap_paused`) for those `definition_id`s via `cancel_run`/zombie-heal (D-LOCK-05) — **before** the DELETE, never delete a live run out from under the engine.
4. `DELETE FROM workflow_runs WHERE definition_id = ANY($versions)` → cascades phases + SET NULLs thread anchors.
5. `DELETE FROM workflow_definitions WHERE id = ANY($versions)` → RESTRICT now satisfied.
6. Belt-and-braces: `UPDATE threads SET active_workflow_run_id=NULL WHERE active_workflow_run_id = ANY($run_ids)` is redundant with SET NULL but harmless if done before step 4.
7. Write the audit receipt (victim-naming: "Deleted {name} — recorded with your name").

### The victim-naming sheet needs counts
The sheet shows exact Removed (N versions, N runs) / Kept (N threads) counts *before* commit (D-LOCK-03). Provide a **count/preview read** — either a `GET /workflows/{id}/delete-preview` returning `{versions, runs, threads}`, or return the counts from a dry-run. Query shape: `COUNT(*)` on `workflow_runs WHERE definition_id = ANY($versions)` and `COUNT(DISTINCT thread_id)` for the kept-threads number. `[ASSUMED — planner picks the endpoint shape]`

### Route + gate
- **New route in `api/workflows.py`** (D-08), distinct from the draft `DELETE /{id}` to avoid overloading its draft-only 404 contract. Suggest `DELETE /workflows/{id}/cascade` or `POST /workflows/{id}/delete`.
- **Authorization gate:** owner-only (`created_by`). The existing draft routes carry `require_visible('workflow_authoring')` (VIS-01) — decide whether cascade delete of one's own *published* workflow should also require that visibility (probably yes: delete is an authoring-tier action). `[VERIFIED: api/workflows.py:375]` `[ASSUMED — planner confirms the gate]`

### "No orphaned runs/threads" — the failure modes the SC must close
| Orphan mode | Closed by |
|-------------|-----------|
| A `workflow_run` row whose definition is gone | Runs deleted first (step 4). |
| A `workflow_phases` row whose run is gone | `ON DELETE CASCADE` (auto). |
| A thread stuck Harness-locked (`active_workflow_run_id` dangling) | `ON DELETE SET NULL` (auto) + explicit clear. |
| A thread that vanished (transcript loss) | Threads never deleted (D-LOCK-04). |
| A live run killed mid-flight, zombie state | Cancel-first (step 3). |
| `harness_audit` rows pointing at deleted runs | **Open decision** — keep (audit trail) vs delete. Recommend KEEP (append-only receipts; the SC names runs+threads, not audit). |
| Template `workspace_files` (kind='template_input') | Thread-scoped + TTL-expiring; threads kept → not orphaned by workflow delete. No action. `[VERIFIED: workspace_files ON DELETE CASCADE from threads :3235]` |

---

## Runtime State Inventory

> This is a delete/cascade + cross-cutting-config phase, so the rename-refactor inventory is partially applicable. Answered explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workflow_runs.inputs` jsonb (adds `folder_id`/template keys), `workflow_definitions.definition->project_folder_id` (reused, unchanged), `workspace_files kind='template_input'` (thread-scoped uploads) | Code edits only; no data migration. Existing rows with absent keys behave as today (D-06). |
| Live service config | None — no external service (n8n/Datadog/etc.) holds workflow scope or template state. Verified: all state is in Supabase. | None |
| OS-registered state | None — no OS-level registration involves workflows. | None |
| Secrets/env vars | None new. `template_ttl_hours` lives in `app_settings`/user_settings (existing). `[VERIFIED: user_settings.py:223]` | None |
| Build artifacts | `docxtpl` already in sandbox image (tag `101.1`); no rebuild — this phase adds no sandbox package. `[CITED: CLAUDE.md]` | None |

**Cascade-specific runtime state (the delete's real concern):** after a workflow delete, the runtime systems that could still reference the deleted definition are (a) in-memory harness engine drivers for live runs → closed by cancel-first (D-LOCK-05); (b) the resume startup-sweep `find_resumable_runs` → runs are deleted so the sweep won't find them; (c) Redis run buffers (`run:{run_id}`) → TTL-expire on cancel (`run_lifecycle.py:288`). No orphaned in-memory state survives if cancel-first + delete-runs run in order. `[VERIFIED]`

---

## Common Pitfalls

### Pitfall 1: Assuming `project_folder_id` is display-only (the CONTEXT premise)
**What goes wrong:** Planner adds a `retrieval_folder_id` column + migration, duplicating meaning, contradicting D-01.
**Root cause:** SEED-112/CONTEXT said "NOT wired to retrieval" — but Phase 098 wired it at 4 sites.
**Avoid:** Reuse `project_folder_id`; the override is the only net-new scope input. `[VERIFIED: threads.py:1537]`

### Pitfall 2: Routing an uploaded template into `docxtpl`/Jinja
**What goes wrong:** SSTI — untrusted Jinja executes in the render path.
**Avoid:** `asset_ref=None` → Branch 2 → `run_replace`. Never pass an uploaded template as a library `AssetRef`. `[VERIFIED: template_asset_service.py:13]`

### Pitfall 3: Deleting the definition before its runs
**What goes wrong:** Postgres FK violation (`ON DELETE RESTRICT`).
**Avoid:** runs → phases(auto) → definition order. `[VERIFIED: full-schema.sql:3203]`

### Pitfall 4: Trusting a client-supplied override `folder_id`
**What goes wrong:** `resolve_project_subtree` returns `[root]` for a non-owned root; the run scopes to a folder the user doesn't own (empty results, or — if the RPC ever dropped `match_user_id` — a leak).
**Avoid:** Gate the override against `fetch_visible_folders(owner)` at the route (D-05). `[VERIFIED: scope.py:73]`

### Pitfall 5: Override silently reverts on resume/Continue
**What goes wrong:** A stranded run resumes with the author default, not the operator's per-run folder.
**Avoid:** Read `inputs.folder_id` at resume (`harness_engine.py`) + Continue (`runs.py`), not just kickoff. `[VERIFIED: harness_engine.py:1515, runs.py:918]`

### Pitfall 6: `folder_subtree_ids` as a `set`
**What goes wrong:** supabase-py `json.dumps` on the RPC `p_folder_ids` raises on a `set`.
**Avoid:** Keep the channel a `list[str]` (set-ify only locally for the clip). `[VERIFIED: scope.py:62, tool_dispatcher.py:695]`

### Pitfall 7: Overloading the draft `DELETE /{id}` route for the published cascade
**What goes wrong:** The draft route returns 404 for published rows and is gated for authoring; overloading it silently changes those contracts + risks the client `deleteWorkflowDraft` calling the wrong semantics.
**Avoid:** A distinct cascade route. `[VERIFIED: api/workflows.py:377, api.ts:3231]`

### Pitfall 8: Expecting a card ⋯-menu that doesn't exist
**What goes wrong:** The sketch honesty table calls the ⋯-menu "REAL today," but `PublishedCard` (`WorkflowsPage.tsx:612`) has only `⑂ Tweak` + `▶ Run` — **no menu.** The delete entry point is net-new UI, not a new item on an existing menu. `[VERIFIED: WorkflowsPage.tsx:650-668]`

---

## Code Examples

### Reading the per-run override at kickoff (WFIN-02 injection)
```python
# Source: adapt backend/app/api/threads.py:1537 (verified) + scope.py owner gate
# Precedence: per-run override > author default > thread folder
_override = (run_inputs or {}).get("folder_id")   # from MessageCreate → create_workflow_run.inputs
if _override is not None:
    _visible = {f["id"] for f in await fetch_visible_folders(supabase, current_user["id"])}
    if str(_override) not in _visible:
        _override = None    # D-05: never-owned / unreachable → no narrowing (refuse the override)
_wf_scope_root = (
    str(_override) if _override is not None
    else str(_kickoff_definition.project_folder_id) if _kickoff_definition.project_folder_id is not None
    else thread_folder_id
)
_wf_folder_subtree_ids = await resolve_project_subtree(_wf_scope_root, supabase=supabase, user_id=current_user["id"])
```

### The cascade helper (WFIN-03)
```python
# Source: new db/workflows.py helper — mirrors create_workflow_run's txn shape (verified)
async def delete_published_workflow_cascade(pool, *, slug: str, user_id: UUID) -> dict:
    async with pool.acquire() as con:
        async with con.transaction():
            version_ids = [r["id"] for r in await con.fetch(
                "SELECT id FROM workflow_definitions WHERE slug=$1 AND created_by=$2", slug, user_id)]
            if not version_ids:
                return {"deleted": False}   # → route maps to 404 (no existence leak)
            # (cancel in-flight runs happens in the SERVICE layer BEFORE this txn — D-LOCK-05)
            await con.execute("DELETE FROM workflow_runs WHERE definition_id = ANY($1::uuid[])", version_ids)
            await con.execute("DELETE FROM workflow_definitions WHERE id = ANY($1::uuid[])", version_ids)
    return {"deleted": True, "versions": len(version_ids)}
```

---

## State of the Art

| Old (pre-152 belief) | Current (verified) | When changed | Impact |
|----------------------|--------------------|--------------|--------|
| `project_folder_id` = display/organization tag | It's the author-time *retrieval* default at 4 sites | Phase 098 | D-03 needs no migration; reuse it. |
| Template handle must travel in `inputs` | Templates discovered from thread workspace by `kind` | Phase 100/101/141 | WFIN-01 backend is done; `inputs` echo is optional. |
| Immutability trigger blocks published DELETE | Trigger is UPDATE-only; DELETE unblocked | Phase 056/067 (trigger def) | No trigger amendment / migration for the cascade. |
| Card ⋯-menu exists | `PublishedCard` has Tweak+Run only | current | Delete entry point is net-new UI. |

**Deprecated/outdated:** the `db/workflows.py:414` comment that the immutability trigger blocks a published-row DELETE is inaccurate (see WFIN-03). Don't rely on it.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | "Delete the workflow" = all versions sharing the slug (owned by user) | WFIN-03 | If it means one version, the sheet counts + delete WHERE differ; leftover versions = partial delete. Planner must confirm the card→slug mapping. |
| A2 | Cascade delete of one's own published workflow should carry `require_visible('workflow_authoring')` | WFIN-03 gate | Over/under-gating; low risk (owner-only WHERE is the real boundary). |
| A3 | `harness_audit` rows should be KEPT (append-only) after run delete | WFIN-03 orphans | If "no orphans" is read strictly, planner may want to null/delete them. |
| A4 | The override should be constrained ⊆ `project_folder_id` only for workflows that declare per-phase `folder_scope`; unbound/no-scope workflows accept any owned folder | WFIN-02 composition | Too-loose → empty phase retrieval; too-strict → can't override an unbound workflow. Needs a UI + server rule. |
| A5 | Echoing the template handle into `inputs.template_input` is optional (display only) | WFIN-01 | If a future path reads `inputs.template_input` for the fill, it'd be a no-op today; harmless. |
| A6 | The victim-naming counts come from a dedicated preview read (`GET .../delete-preview`) | WFIN-03 UI | Alt: counts from data the page already has; endpoint shape is discretion. |

---

## Open Questions

1. **All-versions vs single-version delete (A1).** Known: sketch says "definition · N versions." Unclear: does the Published shelf render one card per slug or per version? Recommendation: cascade by `slug + created_by`; confirm the card mapping in `WorkflowsPage.tsx` before finalizing the sheet counts.
2. **`harness_audit` disposition on delete (A3).** Recommendation: KEEP as append-only audit; if the planner wants a clean sweep, null the `run_id` (don't delete the receipt).
3. **Override composition with per-phase `folder_scope` (A4).** Recommendation: constrain override ⊆ `project_folder_id` when any per-phase scope exists; any owned folder otherwise. Surface the rule in the `<select>` (don't offer out-of-project options for scoped workflows).
4. **Override persistence across resume/Continue (Pitfall 5).** Recommendation: wire all 3 sites from durable `inputs`; if scoping to kickoff-only, document the revert-on-resume limitation.
5. **Delete route gate (A2).** Recommendation: owner-only + `require_visible('workflow_authoring')`, consistent with the other authoring routes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (Postgres + RLS) local | all 3 requirements | ✓ (CLAUDE.md local dev) | 15.x | — |
| asyncpg pool | run/delete helpers | ✓ (in use) | — | — |
| Redis | cancel-first (run buffers) | ✓ (docker-compose.dev) | — | — |
| Docker sandbox image `agentic-rag-sandbox:101.1` (docxtpl) | WFIN-01 fill path | ✓ (pre-built, per CLAUDE.md) | tag 101.1 | none needed — no fill change this phase |
| uvicorn backend (user-started) | live UAT | ✓ (user starts it) | — | — |
| Vite frontend `localhost:5173` | Run-modal + delete UAT | ✓ | — | — |

**Missing dependencies with no fallback:** none. **Missing with fallback:** none. This phase is code/config only; no new external dependency.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode=auto`) `[VERIFIED: backend/pytest.ini]` |
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && python -m pytest tests/test_152_*.py -x -q` |
| Full suite command | `cd backend && python -m pytest -q` |
| Frontend | Vitest (existing; ~14-17 pre-existing ROT tests — SEED-056 baseline) `[CITED: MEMORY]` |

> Baseline note: ~63 backend + ~14-17 vitest failures are **pre-existing rot** (SEED-056/049) — measure phase-152 tests against a captured baseline, not zero-fail. `[CITED: project_151_executed]`

### Phase Requirements → Test Map
| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| WFIN-01 | Upload rejects bad MIME/oversize (422, nothing persisted) | unit | `pytest tests/test_152_template_upload.py -x` | ❌ Wave 0 (extend `test_workspace_template.py` patterns) |
| WFIN-01 | Uploaded template resolves via Branch 2 → provenance `template_input` (never `docxtpl`) | unit | `pytest tests/test_152_template_provenance.py -x` | ❌ Wave 0 (extend template_asset_service tests) |
| WFIN-02 | Per-run override folder resolves subtree + binds `folder_subtree_ids` at kickoff | unit (patch `resolve_project_subtree`) | `pytest tests/test_152_folder_override.py -x` | ❌ Wave 0 (mirror `test_098_scope_governance.py:154`) |
| WFIN-02 | A never-owned override folder → no narrowing/refuse (D-05) | unit | `pytest tests/test_152_folder_override.py::test_unowned_refused -x` | ❌ Wave 0 |
| WFIN-02 | Absent override = today's behavior (author default / whole-KB) (D-06) | unit | same file | ❌ Wave 0 |
| WFIN-03 | Cascade deletes runs→phases(auto)→versions; thread anchors SET NULL; threads survive | integration (real FKs) | `pytest tests/test_152_delete_cascade.py -x` | ❌ Wave 0 |
| WFIN-03 | Non-owner delete → 404 (no existence leak) | unit | same file | ❌ Wave 0 |
| WFIN-03 | In-flight run cancelled before delete (cancel-first) | unit (mock cancel_run) | same file | ❌ Wave 0 |
| WFIN-03 | Delete-preview counts (versions/runs/threads) match reality | unit | same file | ❌ Wave 0 |
| SC#10 | Scope constrains retrieval identically across 4 providers | **manual live UAT** | see below | VALIDATION.md |

### SC#10 4-axis live-UAT rows (author under VALIDATION.md, NOT PLAN.md tasks) `[CITED: CLAUDE.md UAT recipe]`
| Axis | Row |
|------|-----|
| Cross-provider | Launch the same bound workflow with a folder override on OpenAI, Anthropic, Google, OpenRouter (one representative model each); assert every citation's `folder_id ∈ override subtree`, identical scoping behavior. |
| Multi-tool | One run exercising `search_documents` + `render_template` (fill an uploaded docx) in one workflow; assert scoped retrieval AND untrusted-template fill both succeed. |
| Parallel-thread | Thread A workflow streaming (scoped) while Thread B starts a second scoped run; assert scopes don't cross-contaminate. |
| Long-message | A ≥50-message thread OR ≥5KB kickoff prompt with an override; assert scope still holds and the template still resolves. |

### Sampling Rate
- **Per task commit:** `pytest tests/test_152_*.py -x -q`
- **Per wave merge:** `pytest -q` (compare to captured baseline)
- **Phase gate:** phase-152 suite green + SC#10 4-axis live-UAT PASS before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_152_template_upload.py` — WFIN-01 upload validation (extend `test_workspace_template.py`)
- [ ] `tests/test_152_template_provenance.py` — WFIN-01 Branch-2 provenance
- [ ] `tests/test_152_folder_override.py` — WFIN-02 override + D-05 gate + D-06 backward-compat (mirror `test_098_scope_governance.py`)
- [ ] `tests/test_152_delete_cascade.py` — WFIN-03 FK-safe cascade + owner gate + cancel-first + preview counts
- [ ] Frontend: Run-modal `<select>` + upload + provenance note; PublishedCard ⋯-menu + victim-naming sheet (Vitest/Chrome-MCP UAT)
- [ ] No framework install needed (pytest + vitest present)

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treat as ENABLED.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing bearer/session; unchanged. |
| V3 Session Management | no | Unchanged. |
| V4 Access Control | **yes** | Owner-scoped WHERE (`created_by = $user`) on delete (service-role → app-layer gate, NO RLS backstop); owner-reachability gate on the override folder (`fetch_visible_folders`); 404-not-403 on non-owner (no existence leak — `get_definition` precedent). `[VERIFIED]` |
| V5 Input Validation | **yes** | `validate_upload` (MIME/magic/size); `MessageCreate` Pydantic (UUID coercion → 422 on bad `folder_id`/definition id); `$N`-only SQL binding, never f-string on user values. `[VERIFIED]` |
| V6 Cryptography | no | No crypto surface (SEC-01 handles secrets separately). |
| V12 File Upload | **yes** | 10MB cap pre-buffer + post-read; office-bomb guard; `kind='template_input'` provenance; TTL expiry; NEVER Jinja for uploads. `[VERIFIED: workspace.py:176]` |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| SSTI via uploaded template | Tampering/EoP | `run_replace` engine for `template_input` provenance; docxtpl only for trusted lib assets. `[VERIFIED]` |
| IDOR — delete another user's workflow | EoP | `created_by` WHERE + 404 collapse. |
| IDOR — scope a run into another user's folder | Info Disclosure | Override owner-gate + RPC `match_user_id` defense-in-depth. `[VERIFIED: retrieval_service.py:53]` |
| Prompt-injection to widen scope | Tampering | Scope bound at the service boundary; model calls `search_documents(query)` only — cannot supply `folder_ids`. `[VERIFIED: D-04]` |
| SQL injection via `folder_id`/`slug` | Tampering | `$N` params only; `definition->>'project_folder_id'` binds `str()` as a positional param. `[VERIFIED: db/workflows.py:220]` |
| DoS via oversize upload | DoS | Size cap before body buffering. `[VERIFIED: workspace.py:241]` |
| Delete a live run out from under the engine | Availability | Cancel-first via zombie-heal (D-LOCK-05). `[VERIFIED: admin.py:481]` |

---

## Landmines (things that silently break)

1. **`project_folder_id` overload (D-03).** It is ALREADY the retrieval default — do not add a `retrieval_folder_id` column/migration; do not treat the chip as inert. `[VERIFIED: threads.py:1537]`
2. **Harness retrieval scope is set at kickoff in `threads.py:1523-1609`, NOT in a shared chat path.** The override must be injected THERE (plus resume `harness_engine.py:1515` + Continue `runs.py:918`), not in `agent_loop.py`. The chat scope path (`agent_loop.py:1177`) is a DIFFERENT copy (Deep RED LINE — do not touch). `[VERIFIED]`
3. **`resolve_project_subtree` does NOT validate root ownership** — returns `[root]` for a non-owned folder. The override gate is genuinely net-new (D-05). `[VERIFIED: scope.py:73]`
4. **FK order:** `workflow_runs.definition_id` is `ON DELETE RESTRICT` — delete runs first or the whole cascade fails. `[VERIFIED: full-schema.sql:3203]`
5. **The immutability trigger is UPDATE-only** — it does NOT block DELETE; the `db/workflows.py:414` comment saying otherwise is wrong. No trigger amendment needed. `[VERIFIED: full-schema.sql:2598]`
6. **Route collision:** the client `deleteWorkflowDraft` already calls `DELETE /workflows/{id}` (draft-only). Add a DISTINCT cascade route; don't overload. `[VERIFIED: api.ts:3231]`
7. **No card ⋯-menu exists yet** on `PublishedCard` (only Tweak + Run). The delete entry point is net-new UI, contra the sketch honesty table. `[VERIFIED: WorkflowsPage.tsx:650]`
8. **Template discovery is by `kind` on the thread, not by `inputs`.** The frontend MUST upload to the launched thread (createThread→upload→send). Putting the handle only in `inputs` without uploading to the thread → the fill path finds nothing. `[VERIFIED: template_asset_service.py:204]`
9. **`folder_subtree_ids` must stay a `list`** end to end (set-ify only locally) or supabase-py `json.dumps` on `p_folder_ids` raises. `[VERIFIED: scope.py:62]`
10. **Service-role owner gate:** the harness + delete run as service role (RLS bypassed) — every owner check MUST be an explicit app-layer WHERE. There is no RLS backstop. `[VERIFIED: db/workflows.py header + CLAUDE.md /admin no-RLS-backstop]`
11. **Override composition** with per-phase `folder_scope`: a divergent override empties the phase intersection at `phase_types.py:326` → silent no-retrieval. Constrain or warn. `[VERIFIED]`

---

## Sources

### Primary (HIGH confidence — read/grepped this session)
- `backend/app/db/workflows.py` — `create_workflow_run` (`:77`), draft CRUD, delete helper (`:404`)
- `backend/app/api/threads.py:1071-1668` — kickoff branch, definition resolve, scope block, harness ctx build
- `backend/app/api/workspace.py:176-282` — `validate_upload`, `upload_template`
- `backend/app/api/workflows.py` — router, draft delete (`:377`), publish, generate
- `backend/app/services/harness/scope.py` — `resolve_project_subtree`, `assert_folder_scopes_subset`
- `backend/app/services/harness_engine.py:1480-1600` — resume scope
- `backend/app/api/runs.py:895-961` — Continue scope
- `backend/app/services/template_asset_service.py` — provenance byte resolution
- `backend/app/services/template_service.py` — `pin_templates_for_run`
- `backend/app/services/tool_dispatcher.py:680-760, 2776-2865` — search scope clip, `render_template`
- `backend/app/services/retrieval_service.py:30-88` — RPC `match_user_id` + `p_folder_ids`
- `backend/app/services/harness/phase_types.py:300-348` — per-phase scope intersection
- `backend/app/services/harness/publish_service.py:495-548` — golden-run scope
- `backend/app/services/run_lifecycle.py:230-289` — cancel/zombie-heal + anchor clear
- `backend/app/api/admin.py:418-496` — kill_run / victim-naming
- `backend/app/models/harness.py:215-264` — `WorkflowDefinition` schema + validators
- `backend/app/models/message.py` — `MessageCreate`
- `supabase/full-schema.sql` — tables (`:856,1393,1429,1454,1543`), FKs (`:3131,3195,3203,3211,3235`), trigger (`:375,2598`)
- `frontend/src/pages/WorkflowsPage.tsx` — RunModal (`:719`), PublishedCard (`:612`), onLaunch
- `frontend/src/lib/api.ts` — workflows/folders/template endpoints
- `.planning/sketches/072-run-inputs-modal/README.md`, `.planning/sketches/073-workflow-delete-cascade/README.md`
- `.planning/config.json`, `backend/pytest.ini`

### Secondary (design contracts)
- `152-CONTEXT.md` (locked decisions), `REQUIREMENTS.md` (WFIN-01/02/03), CLAUDE.md (G-5, UAT recipe, no-RLS-backstop, provider-docs-first)

### Tertiary (needs confirmation — see Assumptions Log / Open Questions)
- All-versions delete semantics, delete route gate, harness_audit disposition, override composition rule, preview-endpoint shape.

---

## Metadata

**Confidence breakdown:**
- Standard stack (reuse map): HIGH — every seam read at file:line.
- WFIN-01 pipeline: HIGH — full chain traced (upload → pin → resolve → engine).
- WFIN-02 / D-03: HIGH — `project_folder_id` retrieval wiring confirmed at all 4 sites; override gap + gaps precisely located.
- WFIN-03 cascade: HIGH — FK map + trigger scope verified against `full-schema.sql`; only the "all versions vs one" + audit disposition are ASSUMED.
- Frontend surfaces: HIGH — RunModal + PublishedCard read directly (⋯-menu confirmed absent).

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 days — stable in-repo domain; re-verify only if Phase 098 scope path or the workflow tables change before planning)
