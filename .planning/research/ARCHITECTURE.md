# Architecture Research — v3.3 Operator UX Integration

**Domain:** Subsequent-milestone integration into an existing ~160K LOC Agentic RAG platform (React/Vite + FastAPI + Supabase + Redis Streams)
**Researched:** 2026-07-10
**Confidence:** HIGH (every substrate claim below verified against live code with file:line; the stale `PRDs/v3.2-operator-ux.md` §5/§6 tables were treated as hypotheses and are corrected in the dedicated section)
**Migration head:** `094_starter_workflows.sql` — **next new migration = `095`** (the stale PRD's reserved range `065–074` is 100% consumed by harness/DM/skill migrations)

> This is an **integration** architecture doc, not an ecosystem survey. The stack is fixed. The question is: for each of the four v3.3 tracks, which existing seams are the integration points, what is net-new vs modified, what data-flow changes occur, and what build order the dependencies suggest. Verified substrate is cited `file:line`; the roadmap should trust these over the 2026-05-10 brief.

---

## Brief corrections (stale `PRDs/v3.2-operator-ux.md` claims that are WRONG against live code)

The brief was authored 2026-05-10, **predates the entire v2.7–v3.2 workflow/skill/DM surface**, and uses a since-abandoned version/migration sequence. Its business decisions (D-PRD-01..15) hold; its internals do not. Corrections, most load-bearing first:

| # | Brief claim (§5/§6) | Live reality | Impact on roadmap |
|---|---|---|---|
| C-1 | Migration range `065–074` reserved for this milestone; `model_capabilities_overrides` ships as new migration `066` | Head is **`094`**; `model_capabilities_overrides` **already exists since `053`** (`053_settings_unification.sql:35-50`). Slots 065–094 are consumed. | Next migration = `095`. No table CREATE for model overrides — at most an `ALTER` to add admin-only columns. |
| C-2 | `model_capabilities_overrides` PK = `model_key`; fields include `default_temperature`, `deprecated`, `notes`, `updated_by`, `updated_at` | Actual PK = **`model_id`**; columns are `provider, llm_call_timeout_seconds, context_window_tokens, max_output_tokens, native_tools, enabled, created_at, updated_at` (`053:35-45`). **No** `default_temperature`/`deprecated`/`notes`/`updated_by`. | The write UI targets the existing shape. If audit fields (`updated_by`, `deprecated`, `notes`) are wanted, they are a small additive `ALTER` — not a new table. |
| C-3 | The max-tokens clamp read lives in `anthropic_service.py:150-200 _clamp_max_tokens` and must be pointed at the overrides table | The overrides read is **already live and provider-agnostic**: `config.get_model_capability_async` (`config.py:669-701`) + `get_per_call_timeout_async` (`config.py:625-666`), both reading `model_capabilities_overrides` via TTL-cached `_load_model_overrides` (`user_settings.py:302`). Hot-path callers: `agent_loop.py:2023`, `threads.py:1086`, `task_service.py:279`. | **The read path is DONE.** Only the write UI + an RLS write policy are missing. Pointing this at `anthropic_service` would *fork the shared path* (red-line violation) — do not. |
| C-4 | "Close `CONCERNS.md:81-83`: API keys persisted to `settings_override.json` as plain text" | `settings_override.json` was **eliminated in Phase 081.1** (`user_settings.py:4` — "file-based settings_override.json eliminated"; mig `053` moved ~15 settings into `app_settings`). | The goal shifts from *"get secrets off the JSON file"* (done) to *"encrypt secrets at rest in the DB"* (`app_settings`/`user_settings` still store them as plaintext columns). Track 3's secrets work is now an at-rest-encryption story. |
| C-5 | `/admin/backpressure` is a "v2.6 endpoint"; auth flips from `BACKPRESSURE_ADMIN_USER_IDS` to RBAC | It **does exist** (`admin.py:52`, Phase 078 WORKER-LIFT-04) and is env-var-gated (`admin.py:24 _check_backpressure_auth`), reading `runs:active` ZCARD (`admin.py:72`). The `/admin` router prefix already exists (`admin.py:21`). | The dashboard can wrap the live endpoint; the auth-gate swap to `operator_users` RBAC is real and small. `admin.py` is currently a single small file — extend it, do not re-grow `threads.py`. |
| C-6 | OBS-PRIM: add `org_id` to `audit_log, runs, documents, threads, messages` (all net-new) | Forward-compat `org_id uuid` (NO FK) **already exists** on the v3.0 DM tables: `document_views, document_relationships, classification_rules, metadata_field_definitions` (`071_dm_foundations.sql:49-113`). The five core tables the brief lists do **not** have it yet. | The org_id stub pattern is established (nullable, no FK, RLS stays user-scoped). Extend it to the core tables — cheap, and v3.4-RLS-safe. |
| C-7 | Brief is silent on Track 1 (workflow file inputs) entirely | Track 1 is the v3.2 carry-forward cluster (FILE-01/SEED-104, SEED-108/110/112). The brief predates the harness — it has **no** coverage of the Run modal, folder-scope binding, template upload, or the tool registry. | Track 1's integration points are established v2.9/v3.0 substrate (below), not brief hypotheses. Trust the code. |

---

## Standard Architecture — the existing seams v3.3 plugs into

### System overview (integration seams marked with a star)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React/Vite, Deep Midnight design system)                     │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────────────┐   │
│  │ ChatLayout │ │SettingsPage│ │WorkflowsPage │ │  (NET-NEW) /admin  │   │
│  │  doRun *   │ │  5 tabs    │ │  RunModal *  │ │   route tree       │   │
│  │            │ │            │ │  (kickoff-   │ │  (Track 2)         │   │
│  │ MessageItem│ │            │ │   only today)│ │                    │   │
│  │ CitationList*│ │           │ │              │ │                    │   │
│  └─────┬──────┘ └─────┬──────┘ └──────┬───────┘ └─────────┬──────────┘   │
├────────┼──────────────┼───────────────┼───────────────────┼──────────────┤
│  BACKEND (FastAPI)    │               │                   │              │
│  ┌─────▼──────────────▼───────────────▼───┐  ┌────────────▼───────────┐  │
│  │ api/threads.py (JUST extracted v3.2) — │  │ api/admin.py *         │  │
│  │  the agent-loop entry; DO NOT re-grow  │  │  /backpressure (live)  │  │
│  └─────┬──────────────────────────────────┘  │  + NET-NEW /admin/*    │  │
│  ┌─────▼───────────────┐ ┌──────────────────┐ └────────────────────────┘  │
│  │ services/agent_loop │ │ tool_dispatcher  │  ┌────────────────────────┐  │
│  │  (shared path) *    │ │  _TOOL_REGISTRY *│  │ config.py              │  │
│  │  citations accrue   │ │  (dict — add a   │  │  get_model_capability_ │  │
│  └─────┬───────────────┘ │   handler + key) │  │  async * (reads DB     │  │
│  ┌─────▼───────────────┐ └───────┬──────────┘  │  overrides — LIVE)     │  │
│  │ provider_gateway/   │ ┌───────▼──────────┐  └────────────────────────┘  │
│  │  adapters (per-     │ │ harness/         │  ┌────────────────────────┐  │
│  │  provider boundary) │ │  scope.py *      │  │ services/sandbox_svc *  │  │
│  │  RED LINE: no fork  │ │  phase_types.py *│  │  base64-preamble file  │  │
│  └─────────────────────┘ │  emitters.py *   │  │  injection into /sandbox│ │
│                          └──────────────────┘  └────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  DATA                                                                     │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Postgres (RLS) │  │ Storage buckets  │  │ Redis Streams            │   │
│  │  model_caps_   │  │  documents *     │  │  run:{id}, runs:active * │   │
│  │  overrides *   │  │  skill-files *   │  │  runs_by_thread:{tid}    │   │
│  │  workspace_    │  │  sandbox-outputs │  │  (best-effort hint)      │   │
│  │  files *       │  │                  │  │                          │   │
│  │  audit_log     │  └──────────────────┘  └──────────────────────────┘   │
│  └────────────────┘                                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component responsibilities (the seams, verified)

| Seam | Responsibility | Live location | v3.3 role |
|------|----------------|---------------|-----------|
| `_TOOL_REGISTRY` | Flat `dict[str, handler]`; add a tool = write `_handle_X(args, ctx)` + one dict entry, `threads.py` untouched | `tool_dispatcher.py:3189` | Track 1: `attach_skill_file` + `fetch_document_file` are two new entries |
| `get_model_capability_async` | 4-tier resolve: DB overrides → env CSV → static `MODEL_CAPABILITIES` → default | `config.py:669-701` | Track 3: write UI feeds the DB tier it already reads |
| `harness/scope.py` | `resolve_project_subtree` (parent_id walk → list) + `assert_folder_scopes_subset` (D-07 subset gate) | `scope.py:51,92` | Track 1 (SEED-112): resolve a run-input folder scope through here |
| `phase_types.py` ToolContext build | Single seam that narrows `folder_subtree_ids` = project subtree ∩ phase `folder_scope` → feeds `search_documents` | `phase_types.py:316-338` | Track 1 (SEED-112): the intersection point a run-scope binds into |
| `harness/emitters.py` | Re-dispatches the hardened `_handle_render_template` as the deterministic fill driver; whitelist-gated | `emitters.py:116-166` | Track 1 (SEED-110): resolves the uploaded template into the fill |
| sandbox file injection | Downloads `skill-files` bytes → base64 preamble → writes `/sandbox/{name}` before user code | `tool_dispatcher.py:1076-1123` | Track 1 (SEED-108): same pattern, source = `documents` bucket |
| `api/admin.py` | `/admin` router; live `/backpressure` reading `runs:active` ZCARD; env-var auth gate | `admin.py:21,52,72` | Track 2: extend with `/admin/*` routes + swap gate to RBAC |
| `api/runs.py cancel_run` | Cancel + zombie-heal (D-062-11); updates Postgres then Redis | `runs.py:1097` | Track 2: admin "kill run" delegates here |
| `agent_loop.py` citation accrual | Accumulates `retrieved_citations` + `source_refs`, dedups, persists `row["source_refs"]` | `agent_loop.py:1421-1495, 2471-2474` | Track 4 (SEED-033): inline markers ride this existing channel |

---

## Per-track integration

### Track 1 — Workflow & file inputs (v3.2 carry-forwards)

The strongest-substrate track. Every piece plugs into established v2.9/v3.0 seams; there is **no new runtime** — only new tools (registry entries) and new run-input plumbing.

#### 1a. `attach_skill_file` agent tool (FILE-01 / SEED-104 — the one undelivered v3.2 requirement)

- **Integration point:** `_TOOL_REGISTRY` (`tool_dispatcher.py:3189`) — one new `_handle_attach_skill_file`. The write endpoint substrate already exists: `_upload_skill_files` (`skills.py:113-158`) uploads to the **`skill-files`** bucket and inserts a `skill_files` row (`skill_id, user_id, filename, file_path, file_size, mime_type`). SEED-104 explicitly mandates reusing `skill_files` + `skill-files` (no new bucket).
- **Net-new:** the tool handler; a service-layer `attach_skill_file(skill_id, filename, bytes, user_id)` shared by the tool and (optionally) the existing HTTP endpoint; a threat model for a **WRITE-capable agent tool** (owner-scope assert, size/MIME allowlist, path-traversal guard — `skills.py:52 _sanitize_zip_name` is the reuse pattern).
- **Modified:** nothing in `threads.py`. The sandbox already materializes generated files (`/sandbox/output/` → `sandbox-outputs`, `sandbox_service.py:297`); the tool copies the agent's produced bytes from workspace/sandbox into `skill-files`.
- **Data flow:** agent writes file (workspace/sandbox) → `attach_skill_file(skill, name)` → download-or-read bytes → upload `skill-files` + insert `skill_files` row → `read_skill_file`/`load_skill` (`tool_dispatcher.py:707,904`) resolve it next run.
- **Cross-provider:** needs SC#10 proof (a new write tool all providers can drive) — this is exactly why v3.2 deferred it (avoid a 3rd decimal insert; give it its own threat-modeled phase).

#### 1b. Run-time template upload as a workflow run input (SEED-110)

- **Integration point:** the **Run modal** (`WorkflowsPage.tsx:719-847`) is today a read-only folder chip + **one** kickoff textarea + input-keys hint; launch is `onLaunch(target, text)` → `doRun` (`ChatLayout.tsx:314`) → `createThread + sendMessage(workflow_definition_id)` (the **shared chat pathway**, never a bespoke `/run`). The fill substrate is complete: `workspace_files.kind='template_input'` + `expires_at` TTL (`068_workspace_template_ephemeral.sql`), upload endpoint `upload_template` (`workspace.py:160-210`), a `TemplateUpload.tsx` component **already exists in the workspace panel**, and `_handle_render_template` is re-dispatched by the whitelist-gated emitter (`emitters.py:116-166`). Kickoff run-pin already extends template expiry (`threads.py:1006`).
- **Net-new:** a file-upload control **on the Run modal** (today template upload only exists mid-run in the workspace panel — SEED-110 wants it as a **pre-run input**); a run-input channel threading the uploaded artifact reference through `onLaunch → doRun → sendMessage → create_workflow_run` (which already persists `inputs`, SEED-047); binding the uploaded file to the new run's thread/workspace **before** the fill phase executes.
- **Modified:** `RunModal` (add upload + carry the ref), `doRun`/`onLaunch` signature (carry more than `text`), `create_workflow_run` inputs persistence (already exists — add the template ref key).
- **Data-flow change:** `RunModal upload → workspace_files(kind=template_input, run-pinned) → create_workflow_run.inputs → harness fill phase → _handle_render_template resolves the template_input row → deterministic cited render`. No change to the fill engine.

#### 1c. Per-workflow / per-run KB folder-scope (SEED-112)

- **Integration point:** the Phase 098 folder-scope binding is fully live. `search_documents` (`_handle_search_documents`, `tool_dispatcher.py:248-276`) already filters by `ctx.folder_subtree_ids` (RPC `p_folder_ids` primary + post-query scope clip at `:262`, emitting `scope_violation`). The workflow already resolves a **project subtree** at run-start and narrows per-phase at the single seam `phase_types.py:316-338` (`_effective = _proj ∩ _phase_scope`). `scope.py` provides `resolve_project_subtree` + `assert_folder_scopes_subset`.
- **Net-new:** an **optional** retrieval-scope field on the workflow definition **or** a run-input scope selector; making the Run modal's read-only folder chip **editable** (D-103-1 explicitly made it "never a picker" — this reverses that for user-owned workflows); resolving the chosen folder → `folder_subtree_ids` at run-start (reuse `resolve_project_subtree`).
- **Modified:** `RunModal` chip → picker; the run-start scope resolution (bind the selected folder into the same `folder_subtree_ids` the harness already threads); definition schema gains an optional `folder_scope`/`retrieval_scope` field.
- **Data flow:** identical to Phase 098 once resolved — the selected folder enters `folder_subtree_ids`, `assert_folder_scopes_subset` guards it, `search_documents` constrains. Absent scope = current whole-KB default (keeps starters unscoped, D-143-4b intact).
- **Constraint:** SEED-112 carries an **operator directive — research Glean/Beam workflow-scope + run-input UX FIRST** before locking this control (and it informs the whole workflow-UX cluster: 110 + 112 + SEED-051 authoring + SEED-111 lifecycle).

#### 1d. RAG↔sandbox original-file bridge — `fetch_document_file`/`load_kb_file` (SEED-108)

- **Integration point:** `_TOOL_REGISTRY` — one new read-direction tool. KB originals live in the **`documents`** bucket at `documents.file_path = {user_id}/{document_id}/{filename}` (`documents.py:473`, download at `:712`/`:1074`). The inverse of `harvest_output_files`' `copy_from_runtime`. The injection mechanism already exists: the skill-file base64-preamble path (`tool_dispatcher.py:1076-1123`) writes bytes into `/sandbox/`.
- **Net-new:** the handler; a `/sandbox/input/<filename>` materialization (mirror the base64-preamble but pull from `documents` bucket, RLS-scoped like `read_document`); a **size cap + stream-to-disk** (never into model context).
- **Modified:** nothing in the shared path; reuses `get_or_create` session + `copy_to_runtime`.
- **Data flow (net-new):** `fetch_document_file(doc)` → RLS-scoped resolve `documents.file_path` → download bytes → write `/sandbox/input/<name>` → `execute_code` operates on real bytes (python-docx/pypdf/openpyxl on the actual file, not a text reconstruction).
- **Honesty tie-in:** until faithful binary conversion is possible (SEED-106 binaries: soffice/pandoc), the agent must say "reconstructed from text" not "converted your file" (cross-links Phase 142 SRH-01).

---

### Track 2 — Admin shell + operator role

Mostly net-new, but it lands on **real** primitives (`admin.py`, `runs:active`, `cancel_run`, `audit_log`, `/health`), not the brief's imagined ones.

- **Integration points (live):** `admin.py:21` (`/admin` router), `admin.py:52` (`/backpressure` reading `runs:active` ZCARD), `runs.py:1097` (`cancel_run` + zombie-heal), `main.py:458` (`/health`), `audit_log` (v2.2 F-06), the `org_id`-stub pattern (`071:49-113`).
- **Net-new:**
  - `operator_users` table (system-level `super_admin`/`operator`, distinct from v3.4 org RBAC) — **does not exist** (verified). RLS on every admin table cross-references it; a `get_current_operator` dependency parallels `get_current_user`.
  - `/admin` **frontend** route tree (NOT a Settings tab — `SettingsPage.tsx` stays user-level and untouched); guarded by an `operator_role` auth-context field.
  - `/admin/*` backend routes (users, audit browser, active-runs, health-detail, kill-run, feature-flags/kill-switch). Extend `admin.py` — **do not** route through `threads.py` (JUST extracted in v3.2 FND-01; G-5 hot file).
  - `operator_audit_log` (net-new; INSERT-only RLS mirroring `audit_log`).
  - `org_id` stubs on the five core tables (`audit_log, runs, documents, threads, messages`) — extend the established pattern.
- **Modified:** `admin.py` auth gate swaps `BACKPRESSURE_ADMIN_USER_IDS` → `operator_users` RBAC (one-time env-var read as migration assist); `App.tsx`/auth context adds `operator_role`.
- **Data-flow change:** admin mutating routes → `record_operator_action(...)` → `operator_audit_log`; admin reads use a service-role client **only after** an `operator_users` membership check (failures → 404, non-discoverable). Kill-run delegates to `cancel_run` (no new cancellation path).
- **Multi-worker note:** any admin background job (e.g. audit pruner) must be cross-worker-safe (`WORKER_COUNT=2`) — single-execution via a Redis lock, never an in-process singleton (D-PRD-12).

---

### Track 3 — Model & settings management

The critical correction track: **the read substrate is done; only the write UI + secrets-at-rest are missing.**

- **Integration points (live):** `model_capabilities_overrides` table (`053:35-45`, PK `model_id`), read via `get_model_capability_async` (`config.py:669`) + `get_per_call_timeout_async` (`config.py:625`), TTL-cached `_load_model_overrides` (`user_settings.py:302`), consumed on the hot path at `agent_loop.py:2023` / `threads.py:1086` / `task_service.py:279`. Settings already unified into `app_settings` (mig 053; `settings_override.json` eliminated in Phase 081.1).
- **Net-new:**
  - A **write UI + write route** for `model_capabilities_overrides`. Current RLS is `model_overrides_read_all` (SELECT for authenticated) with **no write policy** (`053:49`) → only service-role writes today. Add a `super_admin`-gated write route (service-role after an `operator_users` check) **or** a new RLS write policy referencing `operator_users`.
  - Live `/models` discovery service (per-provider probe → populate/curate the registry; note Phase 096 already did a one-off `/models` curation manually — this makes it a UI action).
  - A `SecretsBackend` abstraction with **encryption at rest** (secrets are in `app_settings`/`user_settings` plaintext columns today; the goal is DB-side encryption, e.g. pgsodium — **not** the already-done JSON-file removal).
- **Modified:** optionally `ALTER model_capabilities_overrides` to add `updated_by`/`deprecated`/`notes` (admin audit fields the current table lacks). The read tiers need **no** change — they already merge DB rows over static defaults (`config.py:682-693`).
- **Data-flow change:** admin edits a capability row → 30s TTL cache expiry → next `get_model_capability_async` returns the merged override (`capability_source="db_override"`). No restart, no provider fork.
- **Red line:** all capability resolution stays in `config.py` (provider-agnostic). Do **not** implement per-provider clamp reads (the brief's `anthropic_service` suggestion) — that forks the shared path.

---

### Track 4 — User-friendliness (Glean/Beam-informed)

- **Inline citations (SEED-033):** the citation **data** already flows end-to-end — handlers build `citations` + `source_refs` (`tool_dispatcher.py:290,462,588`), `agent_loop.py` accrues + dedups + persists `row["source_refs"]` (`:1421-1495, 2471-2474`), and `MessageItem` already renders a `<CitationList>` at end-of-message (`MessageItem.tsx:442`). **Net-new = inline attribution:** footnote-style markers threaded into the streamed assistant text (mapped to the existing citation objects) + inline rendering in the markdown, on top of (not replacing) the CitationList. This is a rendering/attribution layer over existing data — it does **not** need new retrieval plumbing, but it **does** touch the SSE stream + `MessageItem` (both G-5 hot files — sketch-first per G-2).
- **Plain-language two-audience layer (SEED-085), WCAG AA (SEED-092):** cross-cutting UI concerns; WCAG applies to all net-new `/admin` + Run-modal surfaces (keyboard nav, `aria-label`, 4.5:1 contrast, color+icon+text status). The Run modal already models a minimal focus trap (`WorkflowsPage.tsx:738-777`) — reuse that pattern for new dialogs.

---

## Data flow — the three net-new flows

**Flow A — KB file into the sandbox (SEED-108):**
```
agent: fetch_document_file(doc)
  → RLS resolve documents.file_path ({user_id}/{doc_id}/{name})
  → Storage.download("documents", path)          [size-capped, stream to disk]
  → base64 preamble → write /sandbox/input/<name> [reuse tool_dispatcher.py:1076-1123 pattern]
  → execute_code operates on REAL bytes
```

**Flow B — template as a run input (SEED-110):**
```
RunModal upload
  → Storage + workspace_files(kind=template_input, expires_at=+TTL)   [reuse workspace.py:160]
  → create_workflow_run.inputs = {..., template_ref}                  [SEED-047 persists inputs]
  → run-pin extends expiry (threads.py:1006)
  → harness fill phase → emitters._render_template_post
  → _handle_render_template resolves the template_input row → cited deterministic render
```

**Flow C — run-scoped retrieval (SEED-112):**
```
RunModal folder picker (was: read-only chip)
  → create_workflow_run.inputs = {..., folder_scope}
  → run-start: resolve_project_subtree / assert_folder_scopes_subset (scope.py)
  → phase_types.py:316 narrows folder_subtree_ids = subtree ∩ scope
  → search_documents(folder_ids=ctx.folder_subtree_ids)  [tool_dispatcher.py:254 — unchanged]
```

---

## Suggested build order (dependency-driven)

The tracks are largely independent, but within/across them these dependencies dictate order:

1. **Foundation first — `operator_users` + `/admin` shell skeleton + RBAC dependency (Track 2 core).**
   Rationale: the model-registry write UI (Track 3) and every admin mutation need the `get_current_operator` gate and `operator_audit_log`. Ship the role table, the RLS-referenced membership check, the `/admin` route tree, and the auth-gate swap on the existing `/backpressure` endpoint. Cheap, unblocks Track 3's write path. (org_id core-table stubs ride along — cheap, v3.4-safe.)

2. **Model registry write UI (Track 3) — depends on (1).**
   Rationale: the read path is already live; this is the highest-value/lowest-risk closure (a `super_admin`-gated write route + UI over the existing `model_capabilities_overrides` table). Live `/models` discovery is a natural companion. Secrets-at-rest encryption is a separable sub-phase (bigger; can defer/STRETCH).

3. **Workflow file-input cluster (Track 1) — after Glean/Beam research (operator directive, SEED-112).**
   Order within the cluster by shared substrate:
   - **SEED-108 `fetch_document_file` first** — pure new read tool, no UI, unblocks "work on my KB file" and pairs with the sandbox injection already proven. Lowest coupling.
   - **FILE-01 `attach_skill_file`** — new WRITE tool; its threat model + upload/storage pattern is the reference SEED-110 reuses. Do it before the run-input surfaces so the shared upload/threat pattern exists.
   - **SEED-110 template upload + SEED-112 folder scope together** — both are Run-modal run-input surfaces sharing one "run inputs" channel (`onLaunch → doRun → create_workflow_run.inputs`); build the channel once, add both controls. Gated on the Glean/Beam UX research.

4. **UX track (Track 4) — inline citations, plain-language, WCAG — last / parallel.**
   Rationale: inline citations touch G-5 hot files (SSE stream, `MessageItem`) → sketch-first (G-2). WCAG applies to all net-new surfaces from (1)-(3), so it audits best once those surfaces exist. Plain-language layer is cross-cutting polish.

**Ordering invariant:** Track 2 (1) precedes Track 3 (2) precedes any admin-gated write. Track 1's shared upload/threat pattern (FILE-01) precedes the run-input surfaces (110/112). Everything after the Glean/Beam research gate for the workflow-UX cluster.

---

## Anti-patterns (the hard constraints, as concrete "do not")

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| Re-growing `backend/app/api/threads.py` | JUST extracted in v3.2 FND-01; G-5 hot file (9+ phases) | New tools → `_TOOL_REGISTRY` in `tool_dispatcher.py`; admin routes → `admin.py` |
| Per-provider model-capability reads (e.g. `anthropic_service._clamp_max_tokens`) | Forks the shared provider path (D-14 red line) | Keep resolution in `config.get_model_capability_async` (provider-agnostic) |
| An in-process singleton for admin jobs / secrets cache | `WORKER_COUNT=2` — two workers, double-execution (D-PRD-12) | Cross-worker Redis lock (mirror the harness `claim_run` CAS pattern) |
| A bespoke `/workflows/{id}/run` endpoint for run inputs | Diverges from the shared chat pathway (`doRun → sendMessage`) | Thread inputs through `create_workflow_run.inputs` (SEED-047) |
| Blocking I/O in async admin/tool handlers | Freezes the event loop (D-v2.5-01) | `run_in_threadpool` (every supabase-py call — see the tool handlers' pattern) |
| An `operator`/`org_admin` role model that conflicts with v3.4 org RBAC | v3.4 is a one-way RLS-rewrite door | System-level `operator_users` only; org_id stubs nullable/no-FK; never a role shape that fights the rewrite |
| A new storage bucket for skill/template/KB files | Fragments the file surface | Reuse `skill-files` (skill), `workspace_files`/panel (template), `documents` (KB), `sandbox-outputs` (output) |
| Making Deep Mode non-byte-identical when a v3.3 feature is off | Breaks the D-14 invariant every phase preserves | Gated no-ops (the `folder_subtree_ids is None` / `skill_snapshot is None` pattern, e.g. `tool_dispatcher.py:262,910`) |

---

## Integration points summary

### Storage buckets (all reused — no new bucket)

| Bucket | Path convention | Used by | v3.3 track |
|--------|-----------------|---------|------------|
| `documents` | `{user_id}/{doc_id}/{filename}` | `documents.file_path` | Track 1 (SEED-108 source) |
| `skill-files` | `{user_id}/{skill_id}/{filename}` | `skill_files.file_path` | Track 1 (FILE-01 target) |
| `sandbox-outputs` | `{user_id}/{exec_id}/{filename}` | `harvest_output_files` | Track 1 (attach source) |
| workspace (via `workspace_files`) | `kind='template_input'` + TTL | `upload_template` | Track 1 (SEED-110) |

### Internal boundaries

| Boundary | Communication | v3.3 note |
|----------|---------------|-----------|
| `tool_dispatcher._TOOL_REGISTRY` ↔ agent loop | dict dispatch via `ToolContext` | Add tools here; `threads.py` untouched |
| `config.py` ↔ providers | `get_model_capability_async` (shared) | Never fork per-provider |
| harness `phase_types` ↔ `search_documents` | `ctx.folder_subtree_ids` | SEED-112 binds here |
| Run modal ↔ run creation | `onLaunch → doRun → sendMessage → create_workflow_run` | Run-input channel for 110/112 |
| `admin.py` ↔ `operator_users` | RLS + `get_current_operator` dep | Net-new gate |
| SSE stream ↔ `MessageItem` | `citations`/`source_refs` on message | Inline-citation layer (SEED-033) |

---

## Scaling & open questions

| Concern | Note |
|---|---|
| `model_capabilities_overrides` write contention | Low-cardinality admin table; 30s TTL cache absorbs reads. Trivial. |
| Admin active-runs view | `runs:active` ZSET cardinality ≈ active runs (bounded); ZRANGE O(log N). Paginate at 100. |
| SEED-108 large-file materialization | Must cap size + stream to disk (never model context); the one real perf risk in Track 1. |
| Inline citations at long context | Reuses existing dedup (`_deduplicate_citations` `agent_loop.py:812`); marker-mapping is O(citations). |
| org RBAC (v3.4) collision | org_id stubs are nullable/no-FK; RLS stays user-scoped until v3.4. Verify no v3.3 policy assumes org_id. |

**Open questions for requirements/roadmap:**
1. Does the model-registry write use a **new RLS write policy** (referencing `operator_users`) or a **service-role route** behind the operator gate? (053 has read-only RLS today.)
2. SEED-112 folder scope: **definition-time field** vs **run-input selector** vs both? (Blocked on Glean/Beam research — operator directive.)
3. Secrets-at-rest: pgsodium in-DB encryption vs an external `SecretsBackend` — and is it CORE or STRETCH? (The JSON-file removal the brief scoped is already done.)
4. Is the install wizard / deployment-preset half of the brief (Themes H/I) **in scope for v3.3** or deferred? (Biggest lift; natural STRETCH per PROJECT.md — the cloud deploy already shipped `superrag.cloud`.)

---

## Sources

- Live code (HIGH — grep/read, this session): `053_settings_unification.sql`, `068_workspace_template_ephemeral.sql`, `071_dm_foundations.sql`, `config.py:498-701`, `tool_dispatcher.py:248-276,707-960,1076-1123,3189`, `sandbox_service.py`, `skills.py:113-158`, `documents.py:473-1074`, `harness/scope.py`, `harness/phase_types.py:300-359`, `harness/emitters.py`, `admin.py:21-72`, `runs.py:1097`, `main.py:458`, `WorkflowsPage.tsx:515-847`, `ChatLayout.tsx:314`, `MessageItem.tsx:442`, `user_settings.py:302`
- SEED files (HIGH — authoritative scope): `SEED-104`, `SEED-108`, `SEED-110`, `SEED-112`, `SEED-033`
- `.planning/PROJECT.md` (current milestone v3.3 section) + `MEMORY.md` (v3.2 close-out state)
- `.planning/PRDs/v3.2-operator-ux.md` §5/§6 — treated as **stale hypotheses**, corrected above (LOW confidence on its internals; business decisions D-PRD-* retained)

---
*Integration architecture research for: v3.3 Operator UX (subsequent milestone)*
*Researched: 2026-07-10*
