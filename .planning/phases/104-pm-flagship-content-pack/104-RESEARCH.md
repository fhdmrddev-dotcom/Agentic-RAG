# Phase 104: PM Flagship Content Pack - Research

**Researched:** 2026-06-14
**Domain:** Content + seed/provisioning (authored data on shipped harness primitives — NO new engine code)
**Confidence:** HIGH (codebase-grounded; every CONTEXT anchor re-verified against live source this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-104-1 .. D-104-6, verbatim spine)
- **D-104-1 — Pack ships as ONE idempotent, opt-in provisioning script** (e.g. `scripts/seed-pm-pack.py`), NOT an auto-applied migration. Provisions atomically: demo folder → synthetic source docs ingested → `.docx` templates uploaded to Storage + `AssetRef`s → published `workflow_definitions` rows. **Scoped per-account (`is_global=false`)**, runs as the demo/seed account. "Domain-author-driven" proven two honest ways: (1) **Charter authored end-to-end THROUGH the Workflows page** as a TEXT deliverable (live SC#1/SC#3 proof); (2) **SC#3 re-author = Tweak → v(N+1)** fork (INSERT, never UPDATE). Template-fill workflows (status, risk) are **SEED-AUTHORED** because the Builder has no template-attach UI and `/workflows/generate`'s `template_asset_id` is UUID-typed (dead path for path-keyed library assets).
- **D-104-2 — Pack contents:** 3 workflows. **Weekly Status Report** (`.docx` template-fill, 2-phase `llm_agent`→`llm_emit`) = THE headline (SC#2) + the full SC#10 4-axis scoreboard. **Risk Register** (`.docx` template-fill, 2-phase) = full publishable on the default model, no full scoreboard. **Project Charter** (TEXT/markdown, `llm_single`/`llm_agent`) = the live author-driven proof, publishable, no template.
- **D-104-3 — Sample KB:** small **synthetic** "PM Demo Project (sample data)" corpus seeded **per-account (`is_global=false`)**, ingested via `POST /documents/upload` (byte-identical to human upload) or `_upload_pipeline` in-process. Seed-time dependency: one live embeddings call per doc (OpenAI). Workflow defs bind `project_folder_id = <demo folder id>` resolved at seed time.
- **D-104-4 — Deliverable shape:** template-fill is **2-phase** (`llm_agent` retrieve with `search_documents` + `folder_scope` → `llm_emit` `emitter:"render_template"`). Status sections: project name + period (scalars), overall RAG status + summary, accomplishments, planned next, risks & blockers, milestones/metrics. Risk Register = spike's 9-column shape (id, description, category, probability, impact, score, owner, mitigation, status) + worded→numeric Score mapping (Low=1/Med=2/High=3, deterministic non-LLM). Gates: `citations_required` (deterministic) + `output_file_valid`. `citation_policy`/`integrity_policy` default `strict`. Each workflow declares one `business_requirement` (required at publish). Run UX = shipped single-textarea kickoff, no bespoke route, `threads.py` byte-identical.
- **D-104-5 — Template binding is seed-time:** bound template selected server-side by `_emit_bound_asset_ref(definition)` scanning `definition.assets[]` for `kind=="template"` (NOT `assets[0]`). Upload bytes to bucket **`workspace-files`** at key **`{demo_user_id}/_library/<slug>.<ext>`** (leading folder MUST equal owner uid for RLS). That exact path string becomes `AssetRef.asset_id`. `assets[]` entry = `{asset_id, filename, kind:"template", mime}`. Fill phase's `available_tools` MUST include `render_template`. Do NOT bind via `/workflows/generate`. Idempotency: immutability trigger blocks UPDATE on published row → **DELETE-then-INSERT**, never UPDATE.
- **D-104-6 — SC#10 cross-provider scoreboard** on Weekly Status Report. TIER-FORCE+strict: OpenAI `gpt-*`, DeepSeek v4. TIER-FORCE no-strict: Anthropic `claude-*`, Google `gemini-*`, MiniMax. TIER-COERCE unforceable: Moonshot/Kimi. Use EXACT PascalCase IDs for GLM/MiniMax. Add a long-deliverable row (DeepSeek/Moonshot) to prove truncation guard fires as honest failure. Charter NL-authoring demo includes OpenAI + DeepSeek authoring row (Phase-103 `strict=False` override avoids strict-mode 400).

### Claude's Discretion
- Exact synthetic corpus content (doc count, topics) — keep small to bound seed-time embedding cost; must contain raw material the status report + risk register cite.
- Template visual design (`.docx` layout, `{%tr %}` rows, `{{ }}` tags) — must follow spike's proven docxtpl tag conventions.
- Exact section copy / field labels in templates.
- **Whether the seed script drives the live publish gauntlet (golden run + judge) per workflow at provision time, or leaves publish to the verifier** — both satisfy the seed shape (planner decides). See §6 for a reasoned recommendation.

### Deferred Ideas (OUT OF SCOPE)
- Run-surface DEEP refinement + 3 render bugs (BUG-260609-02/-04, BUG-260610-01) → candidate 103.1.
- Globally-shared (`is_global=true`) pack variant → deferred, pairs with ROLE-01 (Phase 109).
- Builder template-attach affordance → deferred (D-103-3 / SEED-084).
- `/workflows/generate` `template_asset_id` UUID-vs-Storage-path-string seam → follow-up fix, NOT 104.
- SEED-069 living-document output re-ingestion → deferred.
- Grids (RAID/stakeholder/risk-register-as-grid) → Phase 106 (GRID-01). CPM/EVM math → "Future".
- Starter/fork-a-template workflow library → SEED-084.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PM-01** | A PM flagship content pack ships — example templates (charter / weekly status / risk register) + workflow definitions + register schemas — authored **entirely on the generic primitives** (domain-author-driven, NOT PM-hardcoded). Headline: a single template-fill (status report from project KB). | The pack ships as a seed script (§1) writing 2-phase template-fill defs (§2) + 2 `.docx` templates (§3) + a synthetic KB (§4) + a page-authored Charter (§5); all use the shipped `llm_emit`/`render_template` + validation-gate + publish-gauntlet + Workflows-page primitives with **zero new engine code**. §6 (publish gauntlet) + §8 (cross-provider scoreboard) are the quality bars. The "no PM-specific engine code" claim is verified: `061_harness_seed_templates.sql` proves the existing seed pattern + the harness already supports every field the PM defs need (`assets`/`llm_emit`/`render_template`/`business_requirement`) additively — the PM defs are pure NET-NEW JSONB. |
</phase_requirements>

---

## Implementation Approach (the spine the planner writes tasks against)

This is a **content + seed phase**. The deliverable is DATA on already-shipped primitives. The only net-new code is ONE idempotent, opt-in provisioning script.

**The spine = a single seed script (`scripts/seed-pm-pack.py`)** that mirrors `backend/tests/fixtures/seed_library_asset.py` and provisions, atomically and idempotently:

1. **Demo folder** — create (or find) a per-account folder "PM Demo Project (sample data)", `is_global=false`. Capture its id.
2. **Synthetic KB** — ingest ~4-6 small synthetic docs into the demo folder via `POST /documents/upload` (one live OpenAI embeddings call per doc). The corpus must contain the raw material the status report + risk register cite (project name, reporting periods, accomplishments, blockers, milestones, a risk log with worded P/I).
3. **Two `.docx` templates** — build the Weekly Status Report template + the Risk Register template with docxtpl tags (`{{ x.value }}` scalars, `{%tr for r in rows %}` rows). Upload the bytes to bucket `workspace-files` at `{demo_user_id}/_library/<slug>.docx`. That path string IS the `AssetRef.asset_id`.
4. **Two seeded published `workflow_definitions` rows** (Status, Risk) — each a 2-phase `llm_agent`→`llm_emit` def with `assets[]` baked in (`kind:"template"`), `project_folder_id` = the demo folder id, `business_requirement` set, gates attached. DELETE-then-INSERT (immutability trigger blocks UPDATE).
5. **Emit fixture ids** to a JSON file (`pm_pack_ids.json`) for the verifier + the cross-provider scoreboard to consume.

**Authored-live (NOT in the seed script):**
- **Project Charter** — authored during the phase THROUGH the shipped Workflows page (describe → draft → refine-by-form → publish) as a TEXT deliverable. This is the live SC#1/SC#3 proof. No template, no code.
- **Tweak → v(N+1) re-author** — the SC#3 proof: open a seeded pack workflow → fork to a v(N+1) draft → edit → re-publish.

**Zero new engine code.** Verified: `llm_emit` + `render_template` (Phase 101/101.1), the validation-gate library (102), the publish gauntlet + judge (102), the Workflows page (103), and the single-textarea kickoff (092) are all shipped. The PM defs are pure JSONB. `061_harness_seed_templates.sql:1-22` proves the seed pattern; none of its 4 existing defs use `llm_emit`/`render_template`/`assets`/`business_requirement` — **the PM defs are entirely NET-NEW JSONB on already-shipped optional fields** (zero migration needed unless shipping global defs — D-104-5).

---

## Q1 — The seed/provisioning script shape

**Mirror `backend/tests/fixtures/seed_library_asset.py`** — the canonical, verified recipe. [VERIFIED: read this session]

### The exact mechanics (all CONFIRMED)
| Element | Value | Evidence |
|---|---|---|
| Storage bucket | `workspace-files` | `seed_library_asset.py:62` `BUCKET = "workspace-files"` |
| Storage path convention | `{user_id}/_library/<slug>.<ext>` — **leading folder MUST equal owner uid** | `seed_library_asset.py:63` `STORAGE_PATH = f"{USER_ID}/_library/risk-register-101uat.docx"`; the RLS `foldername[1]=uid` convention (file docstring :16) |
| Path → asset_id | the **exact path string IS** `AssetRef.asset_id` (a Storage path, NOT a row id) | `seed_library_asset.py:63,101`; `resolve_template_source` reads `_read_from_storage(supabase, asset_ref.asset_id)` — `template_asset_service.py:112-115` |
| `assets[]` entry shape | `{asset_id: "<path>", filename, kind:"template", mime: "<ooxml mime>"}` | `seed_library_asset.py:99-106`; `AssetRef` model `harness.py:214-218` (`asset_id: str` / `filename: str` / `kind: Literal["template","reference"]` / `mime: str`) |
| docx mime | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `seed_library_asset.py:65` |
| Upload | `supabase.storage.from_(BUCKET).upload(path, data, {"content-type": mime, "upsert": "true"})` + a round-trip byte-length assert | `seed_library_asset.py:141-149` |
| Secrets | read NAME-ONLY from `backend/.env` via dotenv; service-role key never printed | `seed_library_asset.py:24-27,50-52,115-122` |
| DB write | psycopg2 service-role to local `:54322`; `INSERT ... VALUES (..., 'published', ..., is_global=false)` | `seed_library_asset.py:183-198` |

### `_emit_bound_asset_ref` scans for `kind=="template"` (NOT `assets[0]`) — CONFIRMED
`phase_types.py:724-741` — iterates `definition.assets[]` and returns the **first** asset with `getattr(asset,"kind",None)=="template"`. A `reference` asset is NOT a fill template. Returns `None` (→ ephemeral-upload fall-through → honest `no_template_bound`) when no template asset exists. [VERIFIED: read this session]

### `available_tools` on the fill phase — CONFIRMED (the WR-01 precedent)
`available_tools` is a **REQUIRED** field on `LlmAgentPhaseConfig` (no default). The seed fixture declares `available_tools: ["search_documents", "render_template"]` on its single fill phase. **For the PM 2-phase shape, the requirement splits:** the **retrieval** `llm_agent` phase needs `search_documents`; the **emit** phase is `llm_emit` (a sealed forced shot — it does not drive the open tool loop, so it does not carry `available_tools`; the emitter resolves the bound template server-side). `seed_library_asset.py:86-94` documents the WR-01 lesson: without `render_template` whitelisted on a 1-phase `llm_agent` fill, `_phase_tools_override` never admits the RENDER_TEMPLATE_TOOL schema. **NOTE for the PM defs** — see the DRIFT FLAG below: the PM defs use the newer 2-phase `llm_emit` shape, not the fixture's 1-phase `llm_agent` shape.

### Idempotency — DELETE-then-INSERT (CONFIRMED)
The 056/067 immutability trigger (`workflow_definitions_block_published_update`, `full-schema.sql:226-247`) is a **BEFORE-UPDATE** trigger that RAISES `check_violation` if a published row's authored columns (slug/version/name/description/status/definition/created_by/is_global/org_id) change. **DELETE is allowed.** So the seeder must DELETE-then-INSERT to refresh, never UPDATE — `seed_library_asset.py:152-201` does exactly this: SELECT existing definition::text, if it differs DELETE then re-INSERT; `ON CONFLICT (id) DO NOTHING` guards the unique constraint. A draft→published flip is allowed (the trigger checks `OLD.status='published'`; a flip has `OLD.status='draft'`). [VERIFIED: read this session]

> **DRIFT FLAG (load-bearing):** the seed fixture's fill phase is a **single `llm_agent`** phase (`available_tools:["search_documents","render_template"]`) — the **Phase 101 tool-dispatch** fill path. The PM defs per **D-104-4** must instead use the **2-phase `llm_agent`→`llm_emit`** shape (the Phase 101.1 emission layer). **Mirror the fixture's Storage/AssetRef/DELETE-then-INSERT/secrets mechanics, but author the def JSONB to the 2-phase `llm_emit` shape in §2 — do NOT copy the fixture's 1-phase `llm_agent` config.** The `assets[]` block and the `_emit_bound_asset_ref` server-side selection are identical across both shapes.

### Where the script lives
`scripts/seed-pm-pack.py` — repo root, OFF the uvicorn `--reload` watched `backend/` tree (CLAUDE.md rule; spike-097 + the fixture both live off the tree). The fixture itself lives under `backend/tests/fixtures/` (a test-only path, not reload-watched in practice) but the production seed script belongs under `scripts/` per CONTEXT `<code_context>`.

---

## Q2 — The two-phase template-fill definition JSONB

### Why 2-phase is load-bearing (CONFIRMED — a lone emit phase honest-fails the citation gate)
`_exec_llm_emit` computes the citation gate's valid-id set from `accumulated_outputs` of the **upstream** phases:
- `_emit_evidence(accumulated_outputs)` (`phase_types.py:789-830`) walks every prior phase output's `source_refs`/`citations`, builds `<doc id="…">passage</doc>` spotlight blocks, AND returns the valid-id set.
- `_retrieved_ids(accumulated_outputs)` (`phase_types.py:833-857`) unions every `_ref_spotlight_id` across accumulated outputs.
- The docstrings state explicitly: *"Empty when nothing was retrieved (any non-null cited value is then invented → state b — the correct honest reject)."* and *"A prior retrieval phase (the D-13 two-step: an `llm_agent` `search_documents` phase feeding the emit) threads its grounding up as `source_refs`/`citations`."*

So a **lone `llm_emit` phase** has an empty valid-id set → every cited `source_chunk_id` reads as invented → honest-fail under `citation_policy:"strict"`. **The retrieval `llm_agent` phase MUST come first** and produce `source_refs`/`citations` for the emit phase to cite against. [VERIFIED: read this session]

### Exact field shapes (CONFIRMED against `harness.py`)
- **`LlmEmitPhaseConfig`** (`harness.py:123-154`): `phase_type:Literal["llm_emit"]`, `prompt:str`, `emitter:str="render_template"`, `model:str|None`, `folder_scope:list[UUID]|None`, `skill_ref:UUID|None`, `skill_snapshot:SkillSnapshot|None`, `citation_policy:Literal["strict","flag","partial","draft"]="strict"`, `integrity_policy:Literal["strict","documented_limit"]="strict"`. ✅ `citation_policy`/`integrity_policy` default `strict`.
- **`ValidatorSpec`** (`harness.py:170-186`): `kind` includes `"citations_required"`, `"output_file_valid"` (+ `freshness`/`structure_check`/`llm_judge_rubric`/etc.); `config:dict`; `on_failure:str="fail_run"`; `max_retries:int=2`; `timing:Literal["pre","post"]="post"`.
- **`PhaseSpec`** (`harness.py:189-194`): `slug:str`, `phase_index:int`, `config:PhaseConfig` (discriminated union), `validators:list[ValidatorSpec]`, `name:str|None`.
- **`WorkflowDefinition`** (`harness.py:221-254`): `slug`, `version`, `name`, `status:Literal["draft","published"]="draft"`, `phases:list[PhaseSpec]`, `project_folder_id:UUID|None`, `assets:list[AssetRef]|None`, `business_requirement:str|None`. ✅ `_folder_scope_requires_project` model_validator (`harness.py:242-254`): a per-phase `folder_scope` requires `project_folder_id` set — else ValueError at validate.
- `business_requirement` is OPTIONAL on the schema but **required at publish** — enforced by the publish ENDPOINT, not the schema (`harness.py:237-240`; `publish_service.py:123-135` stage 1).

### Recommended Status Report def JSONB skeleton (planner authors final copy)
```json
{
  "slug": "pm-weekly-status-report",
  "version": 1, "name": "Weekly Status Report", "status": "published",
  "project_folder_id": "<demo folder id resolved at seed time>",
  "business_requirement": "Produce a cited weekly status report from the project KB with overall RAG status, accomplishments, planned work, risks/blockers, and milestones.",
  "phases": [
    { "slug": "retrieve", "phase_index": 0,
      "config": { "phase_type": "llm_agent",
        "prompt": "Search the project KB for the latest reporting-period status: accomplishments, planned next steps, risks/blockers, milestones, overall RAG status.",
        "available_tools": ["search_documents"],
        "folder_scope": ["<demo folder id>"] },
      "validators": [] },
    { "slug": "emit", "phase_index": 1,
      "config": { "phase_type": "llm_emit", "emitter": "render_template",
        "prompt": "Fill the weekly-status-report template from the retrieved KB evidence. Cite every non-null value; set null where the sources do not support a value.",
        "folder_scope": ["<demo folder id>"],
        "citation_policy": "strict", "integrity_policy": "strict" },
      "validators": [
        { "kind": "citations_required", "config": { "mode": "deterministic" }, "on_failure": "fail_run" },
        { "kind": "output_file_valid", "config": {}, "on_failure": "fail_run" }
      ] }
  ],
  "assets": [ { "asset_id": "{demo_user_id}/_library/pm-weekly-status-report.docx",
    "filename": "weekly-status-report.docx", "kind": "template",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } ]
}
```
> NOTE on `folder_scope` on the emit phase: the emit reads `accumulated_outputs`, so retrieval already happened upstream; `folder_scope` on the emit is harmless (and keeps the def uniform). Because any phase declares `folder_scope`, `project_folder_id` MUST be set (the model_validator) — it is.
> NOTE on `output_file_valid` config `path`: validator_kinds re-opens the produced deliverable; the `config.path` (if used) is **workspace-scoped via `get_file_by_path`** (WR-07, `validator_kinds.py:245-339`). The default (empty config) re-opens the just-produced file. Planner: confirm the in-engine handler already passes the produced path through; an empty `config:{}` is the standard shape (matches the 102 wiring).

The Risk Register def is structurally identical, swapping the prompt/slug/`business_requirement` and pointing `assets[0].asset_id` at the risk-register `.docx`.

---

## Q3 — The .docx templates (docxtpl conventions + EmitFieldMap shape)

### docxtpl tag conventions the spike proved + the oracle extracts (CONFIRMED)
`parse_docx_template_variables` (`template_render_service.py:356-413`, the **docx-only** coverage oracle) is the authoritative spec for what tags the model must fill:
- **Scalars**: `{{ root.attr }}` where `root` is the context key. The trusted templates dereference `Cited` dicts: `{{ project_name.value }}` → context key `project_name`. The oracle's "scalars" = root identifiers of `{{ root(.attr)* }}` tokens that are NOT loop vars / collection names.
- **Loop rows**: `{%tr for r in rows %}` (table-row repeat tag) — the load-bearing surprise (A5) that grows the table; python-docx/pptx **cannot** grow a table.
- **Cited cells in a row**: `{{ r.<col>.value }}` → column `<col>` of collection `rows`. These are the cells the MODEL emits (the oracle's "columns").
- **Driver-computed cells**: `{{ r.score }}` (bare deref, **no `.value`**) → excluded from the oracle (the D-11 derived-compute hook). This is where the worded→numeric Score is rendered, NOT emitted by the model. [VERIFIED: read `parse_docx_template_variables` this session]

The oracle is fed to the model at emit time (`phase_types.py:1135-1153`) as "TEMPLATE PLACEHOLDERS — emit EXACTLY these keys" so the model cannot invent key names (the live `UndefinedError` failure mode 7fa36d2a).

### The flat `EmitFieldMap` output shape (CONFIRMED)
`template_render_service.py:160-198`:
- `FlatScalar` (:160-174): `{key, value:str|None, source_chunk_id:str|None, source_doc:str|None, source_page:int|None}`, `extra="forbid"` (`value=None` = honest decline).
- `FlatRow` (:177-183): `{collection:str, cells:list[FlatScalar]}` (each cell's `key` is the column name).
- `EmitFieldMap` (:186-198): `{scalars:list[FlatScalar], rows:list[FlatRow]}` — flat, depth-3, `additionalProperties:false` everywhere (the cross-provider forcing target every TIER-FORCE provider accepts).

### Risk Register — the spike's proven 9-column shape + worded→numeric Score (CONFIRMED)
The 9 columns (D-104-4 / spike CONCLUSION §1a): `id, description, category, probability, impact, score, owner, mitigation, status`. The model emits 8 (id/description/category/probability/impact/owner/mitigation/status as `{{ r.<col>.value }}` cited cells); **`score` is the driver-computed `{{ r.score }}` bare deref** — a deterministic, NON-LLM `score = P×I` over a worded→numeric mapping (Low=1/Med=2/High=3; spike CONCLUSION Condition 3, `template_render_service.py:533+` the "worded→numeric hook (D-11)"). On worded inputs the spike's `score` left the column **blank** (honest degrade, not corruption) — the production mapping fixes this. [VERIFIED: spike CONCLUSION §1b "Phase 101 carry-forward"; the D-11 hook header at template_render_service.py:533]

### Format caveats (CONFIRMED)
- **docx only** is the proven path. `parse_docx_template_variables` returns `None` for non-docx (`:381`). The `_template_oracle` (`phase_types.py:773-786`) only runs for `.docx`.
- **pptx/xlsx**: caveated. The render driver preserves the template extension (`emitters.py:131-148`), and `output_file_valid` is format-aware (docx/pptx/xlsx re-open via `assert_integrity`), but the docxtpl `{%tr %}` row-growth path is **docx-specific**. Keep both PM templates `.docx`.
- **pdf**: a v1 STUB — `output_file_valid` returns `GateResult(True, None)` for pdf (`validator_kinds.py:249-250`). Not relevant (PM templates are docx).

### Truncation guard (CONFIRMED — wide-register honest failure)
`is_truncated` (`template_render_service.py:507-530`) returns True on `stop_reason=="max_tokens"` (Anthropic) OR `finish_reason=="length"` (OpenAI-family) — both vocabularies normalized by the gateway. A truncated tool-JSON silently drops collections; the guard makes it an HONEST failure, never a half-emitted artifact. This is the §8 long-deliverable scoreboard row's expected behavior. [VERIFIED: read this session]

---

## Q4 — The synthetic sample KB + ingest path

### Ingest path — byte-identical to a human upload (CONFIRMED)
`POST /documents/upload` (`documents.py:338-516`). Accepts a multipart `file` + optional `folder_id` Form. `ALLOWED_MIME_TYPES` (`documents.py:75-87`) includes `text/plain`, `text/markdown`, `text/csv`, `application/pdf`, docx/pptx/xlsx, epub. **Recommended corpus format: `text/markdown` or `text/plain`** — simplest to author synthetically, fully ingested. [VERIFIED: read this session — note the route's error string at :367 says "PDF, DOCX, Markdown, plain text" which is STALE/incomplete vs the actual broader `ALLOWED_MIME_TYPES` set; the broader set is authoritative.]

### Embedding hard-dependency (CONFIRMED — a live key must be configured)
`embed_chunks` → `embed_texts` (`embedding_service.py:94-97`) → `openai_service.embed_texts` (`openai_service.py:1466-1477`) → `client.embeddings.create(...)` — one live OpenAI embeddings API call per doc's chunks. The embedding key (`OPENAI_API_KEY` / the configured embedding provider) MUST be set before the seed runs. Keep the corpus small to bound cost. [VERIFIED: read this session]

### The pollution mechanism that forces per-account seeding (CONFIRMED)
`019_global_folder_subtree_visibility.sql:54-62` (= `full-schema.sql:2138` region) — the documents SELECT RLS policy is `auth.uid()=user_id OR (folder_id IS NOT NULL AND folder_is_globally_visible(folder_id))`. So a doc anywhere in a **global-folder subtree surfaces in EVERY authenticated user's `search_documents`/`query_documents`/`list_documents`** with **no exclusion mechanism**. A global demo corpus would silently contaminate every tenant's KB. **Seed `is_global=false`, per-account** — a per-account doc INSERT only needs `auth.uid()=user_id` (trivial, pollution-free). [VERIFIED: read this session]

### Dedup/versioning (CONFIRMED — re-runnable seed)
`documents.py:402-423` sha256 `content_hash` dedup — an identical re-upload of the same file in the same folder short-circuits `200` (so re-running the seed does NOT re-embed unchanged docs). `:425-449` filename-keyed versioning — same filename + new content → `version_number+1`, all priors `is_latest=False`. This makes the seed naturally idempotent on the corpus.

### Recommended synthetic corpus (Claude's discretion — keep small)
~4-6 markdown docs in "PM Demo Project (sample data)", e.g.:
1. `project-charter-source.md` — project name, sponsor, objectives, scope (Charter raw material).
2. `weekly-meeting-notes-w1.md` + `w2.md` — accomplishments, blockers, decisions, action items (status raw material across 2 periods, so freshness has 2 versions to reason over).
3. `sprint-task-log.md` — task status, planned next, milestones/metrics.
4. `risk-log.md` — 6-9 risks with worded probability/impact (High/Medium/Low), owners, mitigations, status (risk-register raw material; worded P/I exercises the score mapping).
Bound: ~6 embedding calls total. Each must contain enough cited-able spans that the status report + risk register can fill non-null cited values (the spike's 11% decline-rate is healthy; near-0 would signal invention, near-100 a thin corpus).

---

## Q5 — The author-driven proof (SC#1/SC#3 — Charter)

### Charter authored end-to-end THROUGH the Workflows page as TEXT (CONFIRMED possible, no code)
The shipped page fully supports describe → draft → refine-by-form → publish for a TEXT deliverable. The **AUTHORING_SYSTEM_PROMPT DELIVERABLE RULE** (`workflow_authoring.py:61-70`): use `llm_emit`/`render_template` ONLY when grounding lists template placeholders; **when NO template is listed, the deliverable MUST be plain text/markdown — end with an `llm_single` (or `llm_agent` if it needs tools to gather first)**; NEVER create a `render_template` emit phase without a template (→ runtime `no_template_bound` → can never publish). So describing a Charter (no template) yields a publishable TEXT workflow. [VERIFIED: read this session]

`generate_workflow_definition` (`workflow_authoring.py:358-486`): `forced_emit(schema_model=WorkflowDefinition, strict=False)` (`:434-444`), retry-once on ValidationError (`:449-469`, no third call), honest-fail (`{ok:False, error, detail}`), grounding-fidelity check, unique-slug mint. Returns `{ok:True, definition}` NOT persisted (the page's create endpoint persists). [VERIFIED]

### SC#3 "re-author/extend" = Tweak → v(N+1) fork (INSERT, never UPDATE) — CONFIRMED
`create_workflow_definition` (`workflows.py:269-297`) — INSERT a new DRAFT with `status='draft'`, `is_global=false`, `created_by=user_id` bound server-side; a Tweak fork is this INSERT with `version = published_N + 1`, SAME slug. `UNIQUE(slug, version)` keeps versions distinct; the frozen published row is NEVER UPDATEd. The frontend `WorkflowsPage.tsx:285-310` `onTweak` builds the forked def (`version: nextVersion`, `status:"draft"`, same slug), calls `createWorkflowDraft`, loads the fork into the Builder with its NEW id. [VERIFIED: both read this session]

### Template-fill is IMPOSSIBLE to page-author today — be HONEST (CONFIRMED, two independent seams)
1. **Builder has NO template-attach UI**: `PhaseFormPanel.tsx:654-708` — the `llm_emit` form's **emitter is a `ReadOnlyField`** ("Output type … Read-only", :666-672). There is no upload/attach control. The author cannot bind a template through the form.
2. **`/workflows/generate`'s `template_asset_id` is UUID-typed**: `GenerateRequest.template_asset_id: UUID | None` (`workflows.py:350`). The real library asset key is a **Storage path string** (`{uid}/_library/...`), NOT a UUID. A path-keyed library asset cannot be passed → a dead path for binding a library template via NL authoring.

**Conclusion (state plainly in the pack docs):** a `.docx`-filling workflow CANNOT be page-authored today; it must ship as a pre-authored published definition with `assets[]` baked into the JSONB (D-104-1/D-104-5). The Charter (TEXT, no template) is the ONLY pack workflow page-authorable end-to-end — which is exactly why it is the live author-driven proof.

---

## Q6 — The publish gauntlet + judge (the quality gate the pack must pass)

### The gauntlet stages (CONFIRMED, in order — `publish_service.publish`)
1. **definition validation** → `definition_invalid` block (`publish_service.py:108-121`).
2. **business_requirement present?** → missing → block `business_requirement` → route maps to **400** (`publish_service.py:123-135`; `workflows.py:206-209`). [CONFIRMED :124]
3. **structural lint** (reachable/terminal/satisfiable) → block `lint` (`:137-151`).
4. **interactive-phase pre-run block** → a def with an `llm_human_input` phase OR a validator whose `on_failure` routes to `ask_user` is BLOCKED pre-run (a synchronous publish cannot drive an unwatched `ask_user`) → block `interactive_phase` (`:153-171`). **⚠️ IMPLICATION FOR THE PM DEFS:** do NOT attach a `freshness` validator with `on_failure:"ask_user"` (or any interactive phase) to a pack def that must pass publish — it would block the golden run. Keep the PM gate `on_failure:"fail_run"`.
5. **the REAL golden run** — `is_golden_run=True`, no mocks, no opt-out, wall-budgeted by `harness_publish_max_seconds` (7200s, config.py:976) (`:173-196`). [CONFIRMED :184-196]
6. **judge HARD blocker** — `_judge_golden_output` over the golden run's final output; `if verdict.get("failure") or verdict.get("overall_passed") is not True: block "judge"` (`:264-294`). The verdict is recorded regardless (governance). [CONFIRMED :264-294]
7. **flip** — `publish_definition` draft→published; `-1` sentinel → `already_published` (409) (`:296-325`). [CONFIRMED :296-325]

### The judge is an INDEPENDENT cross-provider model (CONFIRMED)
`resolve_judge_model(settings)` (`publish_service.py:638-668` via `validator_kinds.resolve_judge_model`) resolves `Settings.harness_judge_model` (config.py:962) — the SAME registry default the in-run validator uses, NEVER the run model (no self-judging; a coerce-tier run model never becomes the weak link). `forced_emit` resolves the target provider's key/base_url for a cross-provider judge shot (`forced_emit.py:251-275`). `_judge_graded_text` appends the cited field_map for a template-fill deliverable so the judge grades content + citations, not just the confirmation `text` (`publish_service.py:675-678`). [VERIFIED: read this session]

### RECOMMENDATION — does the seed script drive the live publish gauntlet?

**Recommend: the seed script INSERTs the defs already `status='published'` (the fixture pattern), and a SEPARATE, opt-in verifier step drives the live publish gauntlet on a forked DRAFT copy.** Rationale:

| Approach | Pros | Cons |
|---|---|---|
| **Seed INSERTs published directly** (fixture pattern) | Deterministic, fast, no provider calls at seed time, reproducible for the verifier; the immutability trigger then freezes them | Skips the QUAL-01 quality bar at provision time — the seeded def has not *proven* it produces good output |
| **Seed drives the live publish endpoint** (golden run + judge per def) | Proves QUAL-01 end-to-end at provision; the headline "passes the gauntlet" is demonstrated by the seed itself | Expensive (a real golden run + a judge shot per def at seed time); non-deterministic (a flaky judge or a cold KB could block the seed); couples seed-time to provider availability; harder to re-run idempotently |

**Reasoned recommendation (planner's call per D-104 discretion):**
- The **seed script** should INSERT the Status + Risk defs **already published** (fixture pattern, `is_global=false`, DELETE-then-INSERT) so the headline demo run is reproducible without burning provider calls at seed time.
- The **QUAL-01 proof** (that these defs pass the gauntlet) should be a **verifier task, not a seed task**: in `/gsd:verify-work`, create a v2 DRAFT fork of each seeded def and drive `POST /workflows/{id}/publish` once to confirm the golden run + judge pass (this is also the natural SC#3 Tweak→v(N+1) proof). This keeps provisioning cheap/deterministic AND proves the quality bar exactly once, on the live gauntlet, under the verifier's eye.
- The **Charter** is authored live through the page, which means it goes through `POST /workflows/{id}/publish` (the real gauntlet) inherently — so SC#1/SC#3's author-driven proof already exercises the gauntlet once with no extra seed cost.

---

## Q7 — Run kickoff (the headline demo run)

### The shipped single-textarea kickoff — no bespoke route (CONFIRMED)
- `POST /threads` (create thread) → `POST /threads/{id}/messages` with `MessageCreate{content, workflow_definition_id}` (`message.py:8-18` — `content:str` + `workflow_definition_id:UUID|None` are the only run-bearing fields). [CONFIRMED]
- Scope is **baked into the def, not chosen at send-time**: `threads.py:1326-1359` — for a bound workflow (`_kickoff_definition.project_folder_id` set) the retrieval scope is the PROJECT subtree from the binding (`_wf_scope_root = str(definition.project_folder_id)`), resolved via `resolve_project_subtree` — NOT the thread folder. [CONFIRMED — note: CONTEXT cited `:1326-1354`; the block actually spans 1326-1359; the scope-from-definition logic is intact, anchor slightly extended.]
- `threads.py` is byte-identical / read-only reuse — G-5 hot file (CLAUDE.md hot-file ledger; this phase touches NO code here). [CONFIRMED — content-only phase, no threads.py change]

The headline demo run = create a thread → kick it off with the Weekly Status Report `workflow_definition_id` + a free-text `kickoff_prompt` → the 2-phase pipeline retrieves from the demo folder and emits the cited, integrity-checked `.docx`.

---

## Q8 — SC#10 cross-provider scoreboard (the headline acceptance bar)

### ONE shared gateway path — cross-provider = a model-list problem (CONFIRMED)
- `_exec_llm_emit` makes a single sealed `forced_emit(...)` call (`phase_types.py:1187-1195`) — no provider branch in the emit path.
- `forced_emit` (`forced_emit.py:208-275`) resolves the tier from the registry (default-SAFE coerce on a miss, :246), applies the `strict` override (:248), resolves cross-provider key/base_url (:251-275), and opens the stream.
- The ONLY per-provider branch is `provider_gateway/dispatcher.py:106-127` — `anthropic` / `google` explicit, everything else the OpenAI-compat `else` (OpenAI/OpenRouter/DeepSeek/Moonshot/MiniMax/GLM). `openai_compat.py` carries the `<think>`-strip + force-translation. The D-14 guard test asserts no `if provider ==` forcing branch leaks into the shared consumer. [VERIFIED: read this session]

So cross-provider coverage = pick representative model IDs per capability tier; the code path is identical.

### MODEL_CAPABILITIES tiers + EXACT model IDs (CONFIRMED — `config.py:206-313`)
| Tier | forced_emission | strict_json_schema | Representative IDs (exact, registry-verified) |
|---|---|---|---|
| **TIER-FORCE + strict** | True | True | OpenAI `gpt-5.4` / `gpt-5.5` / `gpt-5.4-mini` (`config.py:221,225,223`); DeepSeek `deepseek-v4-pro` / `deepseek-v4-flash` (`:280,279`) |
| **TIER-FORCE (no strict)** | True | absent | Anthropic `claude-opus-4-8` / `claude-sonnet-4-6` (`:238,241`) [TIER-FORCE-NOTHINK — thinking off]; Google `gemini-2.5-pro` / `gemini-3.5-flash` (`:256,267`); MiniMax **`MiniMax-M3`** / **`MiniMax-M2.5`** (`:303,299` — EXACT PascalCase); GLM `glm-4.6` / `glm-5` (`:311,313`) |
| **TIER-COERCE (unforceable)** | absent | absent | Moonshot/Kimi `kimi-k2.6` / `kimi-k2.5` (`:287,288`) |

**The case-sensitivity trap (CONFIRMED, load-bearing):** `forced_emit.py:246` reads `cap.get("forced_emission", False)` — a default-SAFE miss. A wrong-case ID (e.g. `minimax-m3` instead of `MiniMax-M3`, or `GLM-4.6` instead of `glm-4.6`) misses the registry → silently degrades to COERCE → the field-map is narrated as text, not forced. **The scoreboard MUST use the exact registry IDs above.** (`config.py:172-175,290-303`.)

### Scoreboard rows the planner must author (the 4-axis SC#10 + the truncation row)
Per the UAT scoreboard recipe (CLAUDE.md) — rows authored in VALIDATION.md, not PLAN.md:
- **Cross-provider** (one representative per tier): OpenAI `gpt-5.4` (FORCE+strict), DeepSeek `deepseek-v4-pro` (FORCE+strict), Anthropic `claude-opus-4-8` (FORCE-NOTHINK), Google `gemini-2.5-pro` (FORCE), MiniMax `MiniMax-M3` (FORCE, PascalCase), GLM `glm-4.6` (FORCE), Moonshot `kimi-k2.6` (COERCE). Expected: FORCE-tier produce a clean cited `.docx`; COERCE-tier either coerce-succeed or honest-fail (never silent narration).
- **Multi-tool** axis: the 2-phase pipeline already exercises `search_documents` + `render_template` across phases (satisfies "2+ tools in one run").
- **Parallel-thread** axis: Thread A streaming a status-report run while Thread B accepts a new prompt.
- **Long-message** axis (stays MANUAL per provider): a long-deliverable row on DeepSeek/Moonshot (or a ≥50-msg / ≥5KB prompt) — expected to **prove the truncation guard fires as an HONEST failure** (`is_truncated`, `template_render_service.py:507-530`), never a half-emitted artifact.
- **Charter NL-authoring row**: an OpenAI + DeepSeek authoring shot to confirm the Phase-103 `strict=False` override (`workflow_authoring.py:443`) avoids a strict-mode 400 on the optional-heavy `WorkflowDefinition` shape.

**Known risk:** reported-bug `minimax-m3-invalid-tool-args-400` — forced structured generation on MiniMax can 400 on invalid tool args. The exact PascalCase ID mitigates the case-drop path; flag this row as a watch in the scoreboard.

---

## Security Domain (seed-time threat model)

> `security_enforcement` assumed enabled (no `security_enforcement:false` in config). The seed script writes per-account data + Storage objects + published defs.

### Applicable ASVS categories
| ASVS Category | Applies | Standard Control (in the pack) |
|---|---|---|
| V4 Access Control (RLS) | yes | All seeded docs/defs scoped `auth.uid()=user_id` / `is_global=false`; Storage key leading folder = owner uid (RLS `foldername[1]=uid`). The seeder uses the service-role key (bypasses RLS by design) but MUST write only the demo user's uid into every `user_id`/`created_by`/Storage path — never another uid. |
| V5 Input Validation | yes | `assets[]` / def JSONB validated by `WorkflowDefinition.model_validate()` (Pydantic, `extra="forbid"`); the Storage key is a server-built `f"{uid}/_library/<slug>.<ext>"` — no user-supplied path component, so no path traversal. The `<slug>` is author-fixed (not user input) in the seed. |
| V6 Cryptography | n/a (no new crypto) | — |
| V2/V3 Auth/Session | no | seed is a one-shot service-role provisioning script, not a request path |

### Threat patterns for this seed
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Storage key path traversal (`../` in slug → write outside `{uid}/`) | Tampering | Slugs are author-fixed constants in the seed (not user input); the key is server-built. Verify the slug matches `^[a-z0-9-]+$` before building the key. |
| Cross-tenant pollution via a global corpus | Information Disclosure | Seed `is_global=false`, per-account — verified pollution mechanism (Q4). NEVER seed the demo folder global. |
| Embedding key leakage | Information Disclosure | Read secrets NAME-ONLY from `backend/.env` via dotenv; never hard-code / print (the fixture pattern `seed_library_asset.py:24-27,50-52`). |
| Citation-gate false-green from KB-content prompt injection | Spoofing | The emit valid-id set is computed SERVER-SIDE from the retrieved refs (`_emit_evidence`); a fake `<doc id=…>` injected inside a passage's TEXT is not in the set (`phase_types.py:800-804`). Already mitigated by the shipped engine — no new control needed, but the synthetic corpus should not contain adversarial citation strings. |
| Immutability bypass (UPDATE a published pack def) | Tampering | DELETE-then-INSERT only; the BEFORE-UPDATE trigger backstops a stray UPDATE. |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Template fill / field-map emission | A bespoke PM fill engine, PM math, or a custom emitter | `llm_emit` + `render_template` (the only registered emitter, `emitters.py:82-95,183-188`) | Phase 101.1 already ships the forced, cited, integrity-checked, cross-provider emission with audit receipts |
| Citation / integrity enforcement | Custom citation checking | `citations_required` (deterministic) + `output_file_valid` validators (`validator_kinds.py:191-339`) | The 102 library wraps the shipped gates + bounded retry |
| Output-quality gating | A custom golden-run/judge | The publish gauntlet (`publish_service.publish`) | Real golden run + independent cross-provider judge is a HARD publish blocker already |
| Workflow authoring UI / NL gen | A new authoring surface | The shipped Workflows page + `/workflows/generate` (`workflow_authoring.py`) | describe→draft→refine→publish + Tweak→v(N+1) fork already work |
| Run kickoff | A bespoke run route | `POST /threads/{id}/messages` + `workflow_definition_id` (`message.py:8-18`) | Scope baked into the def; `threads.py` byte-identical (G-5) |
| Seed mechanics | A new provisioning framework | Mirror `seed_library_asset.py` (Storage + AssetRef + DELETE-then-INSERT) | The canonical, RLS-correct, idempotent recipe |
| docx parsing for placeholders | A custom docx parser / docxtpl in `backend/app/**` | `parse_docx_template_variables` (zip+regex, no heavy lib, Pitfall-4-safe) | Already the docx oracle; never import docxtpl into the app tree |

**Key insight:** every "PM" capability in this phase is a DATA shape on a generic primitive. The moment a task proposes new engine code, it has violated PM-01 ("no PM-specific engine code") — route it back to JSONB + the seed script.

---

## Validation Architecture

> nyquist_validation assumed enabled (key absent in config → treat as enabled). The orchestrator greps this heading for VALIDATION.md.

### Test framework
| Property | Value |
|---|---|
| Backend tests | pytest (`backend/venv`), `backend/tests/` |
| Quick run | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_llm_emit_executor.py -x` (the emit-executor fixtures, `test_llm_emit_executor.py:37-108`) |
| Seed smoke | run `scripts/seed-pm-pack.py` against the live local stack; assert it is idempotent (re-run = no-op / DELETE-then-INSERT) and emits `pm_pack_ids.json` |
| Live UAT | Chrome MCP + psycopg2 to local Supabase `:54322` (per CLAUDE.md UAT recipe) — the headline run + cross-provider scoreboard are operator-driven |

### How each Success Criterion is validated
| SC | Behavior | Validation check (observable, falsifiable) | Automatable? |
|---|---|---|---|
| **SC#1** (pack ships) | 3 workflows + 2 templates + register schema authored on generic primitives | Seed runs → 2 published `workflow_definitions` rows (Status, Risk) with `assets[kind=template]`, `is_global=false`; Charter published via the page; psycopg2 read-back of the rows + Storage objects | Seed smoke automatable; Charter-publish is manual (page) |
| **SC#2** (headline) | single template-fill produces a weekly status report from the KB, cited + integrity-checked | Kick off the Status def → a `.docx` is produced; `citations_required` passes (no uncited/invented leaves, `check_coverage`); `output_file_valid` re-opens it clean; psycopg2 confirms the `workspace_files` row + audit `emit_rendered` | Run is automatable via the kickoff API; "opens clean in a real editor" is the manual confirm (the spike's strongest evidence bar) |
| **SC#3** (re-author) | a domain author re-authors/extends a pack workflow through the page, no code | Open a seeded def → Tweak → v(N+1) DRAFT (INSERT, new id, same slug, version+1) → edit → re-publish; psycopg2 confirms the v1 row is UNCHANGED (immutability) and a v2 row exists | Tweak fork is API-observable; the page interaction is manual |
| **SC#10** (cross-provider) | the flagship runs cross-provider — the 4-axis scoreboard | Run the Status def per representative model ID per tier; assert FORCE-tier produce clean cited `.docx`, COERCE-tier produce a deliverable OR an HONEST failure receipt (never silent narration); long-deliverable row proves `is_truncated` honest fail | Cross-provider runs scriptable (the smoke harness); **long-message stays MANUAL per provider** (UAT recipe) |

### Critical failure modes that MUST have coverage
| Failure mode | Observable check | Automatable? |
|---|---|---|
| **Citation gate FALSE-GREEN** (a `.docx` delivered with invented/uncited values) | `check_coverage` over the emitted field-map: `uncited_value_count==0 AND invented_citation_count==0`; a deliberate uncited fixture run MUST honest-fail | yes (unit + a live red-case run) |
| **Integrity gate FALSE-GREEN** (a corrupt `.docx` delivered as "done") | `output_file_valid` re-opens via `assert_integrity`; a deliberately corrupted-bytes fixture MUST be caught | yes (unit) |
| **RLS pollution** (corpus leaks to other tenants) | psycopg2 as a *different* user: `search_documents` over the demo folder returns 0 rows; the demo folder is `is_global=false` | yes |
| **Immutability-trigger UPDATE failure** (seeder UPDATEs a published row) | a deliberate UPDATE of the seeded published row RAISES `check_violation`; the seeder uses DELETE-then-INSERT | yes |
| **GLM/MiniMax case-miss silent coerce** | scoreboard uses EXACT registry IDs; a wrong-case control row demonstrates the coerce degrade (the trap is real) | yes (the wrong-case row is the negative control) |
| **Reasoning-truncation half-emit** | the long-deliverable row on DeepSeek/Moonshot triggers `is_truncated` → honest failure receipt, NOT a half-filled `.docx` | **manual** (long-message axis, per provider) |
| **`no_template_bound`** (a fill def with no `assets[kind=template]`) | the emit phase honest-fails state (e); the seeded defs MUST carry a `kind:"template"` asset (read-back assert) | yes (seed read-back) |
| **Interactive-phase publish block** | a PM def MUST NOT carry `llm_human_input` / `ask_user`-routed validators (would block the publish golden run, `publish_service.py:153-171`); lint the seeded defs for this | yes |

### Wave 0 gaps
- [ ] `scripts/seed-pm-pack.py` — the provisioning script (net-new; mirrors `seed_library_asset.py`).
- [ ] `scripts/pm-pack/templates/weekly-status-report.docx` + `risk-register.docx` — the 2 docxtpl templates (net-new content).
- [ ] `scripts/pm-pack/sample-corpus/*.md` — the synthetic KB (net-new content).
- [ ] A seed-smoke + RLS-isolation + immutability test (can live under `backend/tests/` or as a script assertion).
- [ ] No framework install needed (pytest + supabase + psycopg2 already in `backend/venv`).

---

## Anchor Re-Verification Ledger (every CONTEXT canonical_ref re-checked this session)

| CONTEXT anchor | Status | Note |
|---|---|---|
| `seed_library_asset.py` (recipe) | ✅ resolves | bucket `workspace-files`, path `{uid}/_library/...`, DELETE-then-INSERT idempotent — all confirmed |
| `harness.py:123-154` LlmEmitPhaseConfig | ✅ resolves | `citation_policy`/`integrity_policy` default `strict` confirmed |
| `harness.py:170-186` ValidatorSpec | ✅ resolves | `citations_required`/`output_file_valid` kinds + `timing` defaults confirmed |
| `harness.py:189-194` PhaseSpec | ✅ resolves | exact fields confirmed |
| `harness.py:214-218` AssetRef | ✅ resolves | `asset_id` = Storage path string confirmed |
| `harness.py:221-254` WorkflowDefinition + model_validator | ✅ resolves | `_folder_scope_requires_project` at :242-254 confirmed |
| `phase_types.py:724-741` `_emit_bound_asset_ref` | ✅ resolves | scans `assets[]` for `kind=="template"`, NOT `assets[0]` — confirmed |
| `phase_types.py:789-857` `_emit_evidence`/`_retrieved_ids` | ✅ resolves | WHY a prior retrieval phase is required — confirmed |
| `phase_types.py:1187-1195` single forced_emit shot | ✅ resolves | call at :1187; no provider branch — confirmed |
| `emitters.py:82-95,183-188` resolve_emitter / register | ✅ resolves | closed registry, only `render_template` — confirmed |
| `template_render_service.py:186-198` EmitFieldMap | ✅ resolves | flat scalars+rows depth-3 — confirmed |
| `template_render_service.py:356-413` parse_docx_template_variables | ✅ resolves | docx-only oracle; `{{ r.col.value }}` cited, `{{ r.score }}` driver-computed — confirmed |
| `template_render_service.py:507-530` is_truncated | ✅ resolves | both stop_reason + finish_reason — confirmed |
| `template_asset_service.py:81-134` resolve_template_source | ✅ resolves | Branch 1 library by asset_id Storage path — confirmed |
| `validator_kinds.py:191-231` citations_required / `:245-339` output_file_valid | ✅ resolves | deterministic mode + format-aware re-open — confirmed |
| `publish_service.py:124,184-196,264-294,296-325,638-668` | ✅ resolves | business_requirement 400, real golden run, judge HARD blocker, flip, independent judge model — all confirmed |
| `workflows.py:166-213` publish + HTTP map; `:343-384` generate (UUID template_asset_id at :350) | ✅ resolves | confirmed; `template_asset_id: UUID | None` dead path confirmed |
| `workflow_authoring.py:61-70` DELIVERABLE RULE; `:358-486` generate (strict=False :443) | ✅ resolves | confirmed |
| `db/workflows.py:269-297` create_workflow_definition (INSERT fork) | ✅ resolves | confirmed |
| `WorkflowsPage.tsx:285-310` onTweak; `PhaseFormPanel.tsx:654-708` read-only emitter | ✅ resolves | confirmed (note: emitter read-only block is :654-708, CONTEXT said :654-709 — off-by-one, intact) |
| `full-schema.sql:226-247` immutability trigger | ✅ resolves | BEFORE-UPDATE block; DELETE allowed; CONTEXT said :226-244, the function body extends to :247 — intact |
| `threads.py:1326-1359` scope from definition.project_folder_id | ✅ resolves | **minor drift**: CONTEXT said `:1326-1354`; the scope-from-definition logic spans 1326-1359; intact, anchor extended |
| `message.py:8-18` MessageCreate | ✅ resolves | content + workflow_definition_id confirmed |
| `documents.py:338-516` upload; `:402-423` dedup; `:425-449` versioning | ✅ resolves | confirmed; **note the route error string at :367 is stale** (says "PDF, DOCX, Markdown, plain text" but `ALLOWED_MIME_TYPES:75-87` is broader — markdown/text recommended for the corpus) |
| `embedding_service.py:94-97` → `openai_service.py:1466-1477` | ✅ resolves | one live embeddings call per doc confirmed |
| `019_global_folder_subtree_visibility.sql:54-62` / `full-schema.sql:2138` | ✅ resolves | pollution mechanism confirmed |
| `config.py:172-175,206-313` MODEL_CAPABILITIES tiers | ✅ resolves | exact IDs + case-sensitivity coerce confirmed |
| `forced_emit.py:208-275` strict override + cross-provider key/base_url | ✅ resolves | confirmed (CONTEXT cited :215,237-275,323; strict override at :216/:237-248) |
| `dispatcher.py:80-127` only per-provider branch | ✅ resolves | confirmed (the branch is :106-127) |
| `061_harness_seed_templates.sql` seed pattern | ✅ resolves | 4 existing defs use NO llm_emit/render_template/assets/business_requirement → PM defs are NET-NEW JSONB confirmed |

**No anchor materially drifted.** Two cosmetic line-range extensions (threads.py scope block, immutability trigger body, PhaseFormPanel emitter block off-by-one) — all the referenced logic resolves intact. One stale-comment note (the documents upload route's error string under-reports `ALLOWED_MIME_TYPES` — not load-bearing for the seed since markdown/text are accepted).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 2-phase `llm_emit` def shape (vs the fixture's 1-phase `llm_agent`) is the correct shape for the PM defs | Q1/Q2 | Low — D-104-4 mandates it and `_retrieved_ids` requires upstream retrieval; ASSUMED only insofar as the exact retrieval phase output keys (`source_refs`/`citations`) on a real `llm_agent` `search_documents` run feed `_emit_evidence` — the planner should verify a live `llm_agent` retrieval phase actually emits `source_refs` in its output dict (the engine wires this; confirm in a smoke run) |
| A2 | An empty `output_file_valid` `config:{}` re-opens the just-produced file (no `path` needed) | Q2 | Low — `validator_kinds.py:245-339` re-opens the produced deliverable; if the in-engine handler requires an explicit workspace `path`, the def needs `config:{path:...}` (WR-07). Verify in the 102 wiring during planning |
| A3 | The synthetic corpus as markdown/plain-text ingests cleanly and produces cited spans the status/risk defs can fill | Q4 | Low — `ALLOWED_MIME_TYPES` accepts markdown; the spike proved KB-grounded fill works. The decline-rate is content-dependent — the corpus must be rich enough |

**Most claims are VERIFIED (file:line, read this session) or CITED (spike CONCLUSION).** The 3 above are the only genuinely ASSUMED items, all low-risk and verifiable in a single seed smoke run.

---

## Sources

### Primary (HIGH confidence — read this session)
- `backend/tests/fixtures/seed_library_asset.py` — the seed recipe
- `backend/app/models/harness.py:120-260` — all def/config/asset/validator shapes
- `backend/app/services/harness/phase_types.py:718-1209` — `_emit_bound_asset_ref`, `_emit_evidence`, `_retrieved_ids`, `_exec_llm_emit`, the single forced_emit shot
- `backend/app/services/harness/emitters.py:78-188` — closed emitter registry
- `backend/app/services/template_render_service.py:160-530` — EmitFieldMap, parse_docx_template_variables, is_truncated
- `backend/app/services/template_asset_service.py:75-138` — resolve_template_source
- `backend/app/services/harness/validator_kinds.py:191-339` — citations_required, output_file_valid
- `backend/app/services/harness/publish_service.py:108-325,638-685` — the full gauntlet + independent judge
- `backend/app/api/workflows.py:166-213,343-385` — publish + generate routes
- `backend/app/services/workflow_authoring.py:55-486` — DELIVERABLE RULE + generate (strict=False)
- `backend/app/db/workflows.py:269-297` — create_workflow_definition (INSERT fork)
- `backend/app/api/threads.py:1320-1359` — scope from definition.project_folder_id
- `backend/app/models/message.py:1-18` — MessageCreate
- `backend/app/api/documents.py:75-87,338-449` — upload route, ALLOWED_MIME_TYPES, dedup/versioning
- `backend/app/services/embedding_service.py:94-97` + `openai_service.py:1466-1477` — embedding hard-dep
- `backend/app/config.py:165-313,962-976` — MODEL_CAPABILITIES tiers + settings knobs
- `backend/app/services/forced_emit.py:208-277` — strict override + cross-provider resolution
- `backend/app/services/provider_gateway/dispatcher.py:87-128` — the only per-provider branch
- `supabase/full-schema.sql:224-247` — immutability trigger
- `supabase/migrations/019_global_folder_subtree_visibility.sql:48-62` — pollution RLS
- `supabase/migrations/061_harness_seed_templates.sql:1-45` — seed pattern (NET-NEW JSONB proof)
- `frontend/src/pages/WorkflowsPage.tsx:283-311` — onTweak fork
- `frontend/src/components/workflows/PhaseFormPanel.tsx:654-708` — read-only emitter

### Secondary (HIGH — prior planning artifacts)
- `scripts/spike-097/CONCLUSION.md` — GO, schema shape, 6 failure modes, worded→numeric Score (Cond 3), full-native-roster (Cond 7), SEED-069 (Cond 8)
- `.planning/phases/104-pm-flagship-content-pack/104-CONTEXT.md` — D-104-1..6, canonical_refs (all re-verified above)
- `.planning/REQUIREMENTS.md:46-47` — PM-01
- `.planning/ROADMAP.md:220-229` — Phase 104 goal + 3 SC + SC#10

---

## Metadata

**Confidence breakdown:**
- Seed script shape / Storage / AssetRef mechanics: **HIGH** — the canonical fixture read line-by-line; one DRIFT FLAG (1-phase vs 2-phase) surfaced and resolved.
- Def JSONB shapes (2-phase, gates, validators): **HIGH** — every model + the emit executor + the citation-gate dependency read directly.
- docxtpl conventions / EmitFieldMap / worded→numeric Score: **HIGH** — the docx oracle + the flat shape + the spike CONCLUSION confirm.
- Synthetic KB ingest + pollution mechanism: **HIGH** — upload route + RLS policy + embedding chain all read.
- Author-driven proof (Charter / Tweak / template-fill-not-page-authorable): **HIGH** — both blocking seams (read-only emitter + UUID-typed template_asset_id) confirmed.
- Publish gauntlet + judge: **HIGH** — all 7 stages + the independent judge read.
- Cross-provider scoreboard: **HIGH** — the single gateway path + exact registry IDs + the case-sensitivity trap confirmed.

**Research date:** 2026-06-14
**Valid until:** ~2026-07-14 (stable — content phase on shipped primitives; re-verify if Phases 101.1/102 gap-closure lands further changes to the emit executor or publish service)
