# Phase 104: PM Flagship Content Pack - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 5 net-new artifact groups (1 script + 2 docx templates + ~4-6 corpus docs + 2 seeded def JSONB + 1 ids manifest)
**Analogs found:** 5 / 5 (every CONTEXT canonical_ref re-verified this session — all resolve)

> This is a **content + seed phase**. The net-new artifacts are mostly DATA, not code. The ONE substantive net-new code file is `scripts/seed-pm-pack.py`, which **mirrors `backend/tests/fixtures/seed_library_asset.py` mechanic-for-mechanic** but authors the def JSONB to the **2-phase `llm_emit`** shape (the DRIFT FLAG — see Shared Pattern S-5). Every analog below was read line-by-line this session and resolves exactly as RESEARCH.md's Anchor Re-Verification Ledger claimed.

---

## File Classification

| New/Modified Artifact | Role | Data Flow | Closest Analog | Match Quality |
|-----------------------|------|-----------|----------------|---------------|
| `scripts/seed-pm-pack.py` | seed/provisioning script | file-I/O + batch (Storage upload + ingest + DB INSERT) | `backend/tests/fixtures/seed_library_asset.py` | exact (mechanics) — drift on def shape (S-5) |
| `scripts/pm-pack/templates/weekly-status-report.docx` | template (data asset) | transform (docxtpl `{{ }}` / `{%tr %}` fill target) | `backend/tests/fixtures/templates/risk-register.docx` (+ docx oracle `parse_docx_template_variables`) | role-match (new layout, proven tag conventions) |
| `scripts/pm-pack/templates/risk-register.docx` | template (data asset) | transform (docxtpl row-growth + driver-computed `{{ r.score }}`) | `backend/tests/fixtures/templates/risk-register.docx` | exact (the spike's 9-col shape) |
| `scripts/pm-pack/sample-corpus/*.md` (~4-6) | content (synthetic KB) | file-I/O (ingest via `POST /documents/upload`) | (no in-repo corpus analog — see No Analog Found) | partial |
| Status Report def JSONB (seeded row) | config / workflow definition | event-driven (2-phase harness pipeline) | `061_harness_seed_templates.sql` (seed shape) + `test_llm_emit_executor.py:37-108` (2-phase emit shape) | role-match — NET-NEW JSONB (S-5) |
| Risk Register def JSONB (seeded row) | config / workflow definition | event-driven (2-phase harness pipeline) | same as above | role-match — NET-NEW JSONB |
| `scripts/pm-pack/pm_pack_ids.json` (emitted) | config (fixture manifest) | file-I/O (write-once) | `seed_library_asset.py:274-286` `emit_ids` / `uat_fixture_ids.json` | exact |
| Project Charter def | config (workflow definition) | event-driven | **AUTHORED LIVE through the Workflows page** — NOT a seed artifact (D-104-1) | n/a (page-authored proof) |

---

## Pattern Assignments

### `scripts/seed-pm-pack.py` (seed/provisioning script, file-I/O + batch)

**Analog:** `backend/tests/fixtures/seed_library_asset.py` (read line-by-line this session — resolves exactly). The PM seed script is a generalization of this fixture to N templates + N defs + a synthetic corpus. Copy ALL of its mechanics; deviate ONLY on the def JSONB shape (S-5).

**Bootstrap / secrets (NAME-ONLY) pattern** (`seed_library_asset.py:34-55`):
```python
from __future__ import annotations
import json, os, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]   # scripts/seed-pm-pack.py -> repo root
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))              # make app.* importable

from dotenv import load_dotenv  # noqa: E402
load_dotenv(BACKEND_DIR / ".env")  # secrets stay name-only — NEVER echoed

import psycopg2  # noqa: E402
from supabase import Client, create_client  # noqa: E402
```
> NOTE on `parents[]`: the fixture is at `backend/tests/fixtures/` so it uses `parents[3]`. The PM script lives at repo-root `scripts/seed-pm-pack.py`, so it is `parents[1]`. Verify this when writing the file.

**Service-role client (key name-only, never printed)** (`seed_library_asset.py:115-122`):
```python
def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)) if not v]
        raise SystemExit(f"Missing env var(s) in backend/.env: {', '.join(missing)}")
    return create_client(url, key)

def _db_dsn() -> str:  # :110-112
    return os.environ.get("LOCAL_DB_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
```

**Storage upload + byte round-trip assert** (`seed_library_asset.py:62-65, 136-149`) — the EXACT key convention from D-104-5 (leading folder MUST equal owner uid for RLS):
```python
BUCKET = "workspace-files"
MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
STORAGE_PATH = f"{USER_ID}/_library/<slug>.docx"   # this string IS the AssetRef.asset_id

def upload_template(supabase: Client, data: bytes, path: str) -> None:
    storage = supabase.storage.from_(BUCKET)
    storage.upload(path, data, {"content-type": MIME, "upsert": "true"})
    downloaded = storage.download(path)        # confirm the object exists
    if len(downloaded) != len(data):
        raise SystemExit(f"Storage round-trip byte length mismatch: {len(data)} vs {len(downloaded)}")
```

**DELETE-then-INSERT idempotency (immutability trigger blocks UPDATE)** (`seed_library_asset.py:152-201`) — copy this verbatim per def; see S-3:
```python
def upsert_definition(conn, definition_id, slug, version, name, definition_json, user_id) -> None:
    target_def = json.dumps(definition_json)
    with conn.cursor() as cur:
        cur.execute("SELECT definition::text FROM public.workflow_definitions WHERE id = %s", (definition_id,))
        existing = cur.fetchone()
        if existing is not None and existing[0] != target_def:
            # DELETE permitted (the immutability trigger is BEFORE-UPDATE only).
            cur.execute("DELETE FROM public.workflow_definitions WHERE id = %s", (definition_id,))
        cur.execute(
            """
            INSERT INTO public.workflow_definitions
                (id, slug, version, name, status, definition, created_by, is_global)
            VALUES (%s, %s, %s, %s, 'published', %s::jsonb, %s, false)
            ON CONFLICT (id) DO NOTHING
            """,
            (definition_id, slug, version, name, target_def, user_id),
        )
        conn.commit()
        # Read-back assertion: the row carries assets[0].filename AND a kind="template" asset.
        ...
```
> The fixture asserts `available_tools` contains `render_template` on its 1-phase fill (lines 204-222). **For the PM 2-phase shape this read-back assert changes** — assert the EMIT phase has `kind:"template"` in `assets[]` and the RETRIEVAL phase declares `available_tools:["search_documents"]`. Do NOT copy the `render_template`-on-the-agent-phase assertion (that is the 1-phase Phase-101 path).

**Idempotent ids manifest** (`seed_library_asset.py:274-286`):
```python
def emit_ids(...) -> None:
    payload = {"definition_id": ..., "asset_id": STORAGE_PATH, "storage_path": STORAGE_PATH,
               "slug": ..., "version": ..., "filename": ..., "user_id": USER_ID, ...}
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
```
> Generalize to a list of both seeded defs + the resolved demo `folder_id` so the verifier + the SC#10 scoreboard harness consume one `pm_pack_ids.json`.

**Net-new vs the fixture (the synthetic-KB step the fixture does NOT have):** the PM script adds a corpus-ingest step BEFORE the def INSERT (it must resolve `project_folder_id` first). See the No Analog Found section + S-6.

---

### Status Report / Risk Register def JSONB (config / workflow definition, event-driven)

**Analogs:** `061_harness_seed_templates.sql` (the published-seed shape) + `backend/tests/unit/test_llm_emit_executor.py:37-108` (the 2-phase `llm_emit` fixture shape) + `backend/app/models/harness.py:123-254` (the field contracts). **These defs are entirely NET-NEW JSONB** — 061's 4 existing defs use NO `llm_emit`/`render_template`/`assets`/`business_requirement` (confirmed: read 061:1-60 this session).

**The exact 2-phase shape to author** (composed from `test_llm_emit_executor.py:59-71` emit phase + `harness.py:77-80` agent phase requiring `available_tools` + RESEARCH Q2 skeleton):
```json
{
  "slug": "pm-weekly-status-report", "version": 1, "name": "Weekly Status Report",
  "status": "published",
  "project_folder_id": "<demo folder id resolved at seed time>",
  "business_requirement": "Produce a cited weekly status report from the project KB ...",
  "phases": [
    { "slug": "retrieve", "phase_index": 0,
      "config": { "phase_type": "llm_agent",
        "prompt": "Search the project KB for the latest reporting-period status ...",
        "available_tools": ["search_documents"],
        "folder_scope": ["<demo folder id>"] },
      "validators": [] },
    { "slug": "emit", "phase_index": 1,
      "config": { "phase_type": "llm_emit", "emitter": "render_template",
        "prompt": "Fill the weekly-status-report template from the retrieved KB evidence. Cite every non-null value; set null where unsupported.",
        "folder_scope": ["<demo folder id>"],
        "citation_policy": "strict", "integrity_policy": "strict" },
      "validators": [
        { "kind": "citations_required", "config": { "mode": "deterministic" }, "on_failure": "fail_run" },
        { "kind": "output_file_valid", "config": {}, "on_failure": "fail_run" }
      ] } ],
  "assets": [ { "asset_id": "{demo_user_id}/_library/pm-weekly-status-report.docx",
    "filename": "weekly-status-report.docx", "kind": "template",
    "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } ]
}
```

**Field contracts the JSONB MUST satisfy** (`harness.py`, read this session):
- `LlmEmitPhaseConfig` (`:123-154`): `phase_type:"llm_emit"`, `prompt`, `emitter` defaults `"render_template"`, `citation_policy`/`integrity_policy` default `"strict"`. The emit phase does NOT carry `available_tools` (it is a sealed forced shot, not the open tool loop — `test_llm_emit_executor.py:68` puts `available_tools` on the FAKE namespace only for getattr-safety; the real `LlmEmitPhaseConfig` has no such field — confirmed `:139-154`).
- `LlmAgentPhaseConfig` (`:77-91`): `available_tools: list[str]` is a **REQUIRED field, no default** — the retrieval phase MUST declare `["search_documents"]` or `model_validate()` fails.
- `ValidatorSpec` (`:170-186`): `kind` Literal includes `"citations_required"` + `"output_file_valid"`; `config` defaults `{}`; `on_failure` defaults `"fail_run"`; `timing` defaults `"post"`.
- `AssetRef` (`:214-218`): `{asset_id:str, filename:str, kind:Literal["template","reference"], mime:str}` — `asset_id` is the **Storage path string**, NOT a row id.
- `WorkflowDefinition` (`:221-254`): `_folder_scope_requires_project` model_validator (`:242-254`) RAISES if any phase declares `folder_scope` without `project_folder_id` set. Since both PM phases declare `folder_scope`, `project_folder_id` MUST be set (it is — bound to the demo folder).
- `business_requirement` (`:237-240`): OPTIONAL on the schema, **required at publish** (enforced by the endpoint, `publish_service.py:124`, not the schema). Set it on every seeded def.

**The 061 published-seed INSERT shape** (`061_harness_seed_templates.sql:48-60`) — the column set + `is_global` semantics the seeder writes (NOTE: 061 ships `is_global=true`; PM ships `is_global=false`):
```sql
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES ('<fixed uuid>', '<slug>', 1, '<name>', 'published', '{...full WorkflowDefinition JSONB...}', '<demo uid>', false)
ON CONFLICT (id) DO NOTHING;
```

**Why 2-phase, not 1-phase (load-bearing — DRIFT FLAG):** a lone `llm_emit` phase has an empty valid-id set (`_emit_evidence`/`_retrieved_ids`, `phase_types.py:789-857`) → every cited value reads "invented" → honest-fail under `citation_policy:"strict"`. The upstream `llm_agent` `search_documents` phase threads `source_refs`/`citations` up for the emit to cite against. The grounding output shape the emit consumes is `{"retrieval": {"source_refs": [{"chunk_id": ...}]}}` (confirmed `test_llm_emit_executor.py:111-115`).

---

### `*.docx` templates (template / data asset, transform)

**Analog:** `backend/tests/fixtures/templates/risk-register.docx` (the spike/101 fixture, referenced at `seed_library_asset.py:69`) + the docx oracle `parse_docx_template_variables` (`template_render_service.py:356-413`) as the authoritative tag spec.

**docxtpl tag conventions the model fills** (the oracle is the spec — RESEARCH Q3, confirmed):
- Scalars: `{{ root.value }}` where `root` is the context key dereferencing a `Cited` dict — e.g. `{{ project_name.value }}` → emits scalar key `project_name`.
- Loop rows: `{%tr for r in rows %}` (table-row repeat — grows the table; python-docx/pptx CANNOT grow a table).
- Cited cells: `{{ r.<col>.value }}` → column `<col>` of collection `rows` (the cells the MODEL emits).
- Driver-computed cells: `{{ r.score }}` (bare deref, NO `.value`) → EXCLUDED from the oracle; this is where the deterministic worded→numeric Score renders (Low=1/Med=2/High=3, `score=P×I`), NOT model-emitted.

**EmitFieldMap output shape the model targets** (`template_render_service.py:160-198`): `EmitFieldMap{scalars:list[FlatScalar], rows:list[FlatRow]}`; `FlatScalar{key, value:str|None, source_chunk_id, source_doc, source_page}` with `extra="forbid"` (`value=None` = honest decline); `FlatRow{collection:str, cells:list[FlatScalar]}`.

**Risk Register 9-col shape** (D-104-4 / spike): `id, description, category, probability, impact, score, owner, mitigation, status` — model emits 8 as `{{ r.<col>.value }}`; `score` is the driver-computed `{{ r.score }}` bare deref.

**Format caveat:** `.docx` ONLY (the oracle returns `None` for non-docx, `:381`; `{%tr %}` row-growth is docx-specific). Keep both PM templates `.docx`.

> Discretion (CONTEXT): the visual layout / section copy / field labels are Claude's discretion — must follow the proven docxtpl tag conventions above. The template bytes are built off-tree (`scripts/pm-pack/templates/`); never import docxtpl into `backend/app/**` (the app uses the zip+regex oracle only).

---

### Project Charter (config / workflow definition) — AUTHORED LIVE, not seeded

**Analog:** the shipped Workflows page describe→draft→refine→publish + Tweak→v(N+1) fork (`WorkflowsPage.tsx:285-310`, `workflow_authoring.py:61-70` DELIVERABLE RULE + `:358-486` generate). NOT a seed-script artifact.

**Why it is TEXT, not template-fill** (the AUTHORING_SYSTEM_PROMPT DELIVERABLE RULE, `workflow_authoring.py:61-70`): no template listed in grounding → deliverable MUST be `llm_single`/`llm_agent` plain text/markdown, NEVER a `render_template` emit (which would be unpublishable `no_template_bound`). The Charter is the ONLY pack workflow page-authorable end-to-end — exactly why it is the live SC#1/SC#3 proof.

**Be HONEST in pack docs:** template-fill (Status, Risk) CANNOT be page-authored today — two independent seams (read-only emitter in `PhaseFormPanel.tsx:654-708`; UUID-typed `template_asset_id` in `workflows.py:350` vs the path-keyed library asset). They ship as pre-authored published JSONB with `assets[]` baked in.

---

## Shared Patterns

### S-1 Storage key convention (RLS-correct library asset)
**Source:** `seed_library_asset.py:62-65, 99-106` + `harness.py:214-218`
**Apply to:** every `.docx` template the seed script uploads.
Upload bytes to bucket `workspace-files` at `{demo_user_id}/_library/<slug>.docx` (leading folder MUST equal owner uid — RLS `foldername[1]=uid`). That **exact path string** becomes `AssetRef.asset_id`. The `assets[]` entry = `{asset_id:"<path>", filename, kind:"template", mime:"<ooxml>"}`.

### S-2 Server-side template binding (model never selects the template)
**Source:** `phase_types.py:724-741` `_emit_bound_asset_ref`
**Apply to:** both seeded defs.
```python
def _emit_bound_asset_ref(definition):
    if definition is None: return None
    assets = getattr(definition, "assets", None) or []
    for asset in assets:
        if getattr(asset, "kind", None) == "template":
            return asset   # FIRST kind=="template" — NOT assets[0], NOT a phase-config field
    return None
```
Bind via `definition.assets[]` (kind="template") ONLY. A `reference` asset is NOT a fill template. No template asset → `None` → honest `no_template_bound`. Resolution flows to `resolve_template_source(asset_ref=...)` Branch 1 (`template_asset_service.py:99-134`), which reads `_read_from_storage(supabase, asset_ref.asset_id)` (`provenance="library"`).

### S-3 DELETE-then-INSERT idempotency (immutability trigger blocks UPDATE)
**Source:** `full-schema.sql:226-247` (trigger) + `seed_library_asset.py:152-201` (the recipe)
**Apply to:** every published def the seed script writes.
The `workflow_definitions_block_published_update()` BEFORE-UPDATE trigger RAISES `check_violation` if a `published` row's slug/version/name/description/status/definition/created_by/is_global/org_id changes. **DELETE is allowed.** Seeder must SELECT existing `definition::text`; if it differs, DELETE then re-INSERT; `ON CONFLICT (id) DO NOTHING` guards the unique constraint. NEVER UPDATE a published row. (A draft→published flip is fine — the trigger checks `OLD.status='published'`.)

### S-4 Secrets name-only + service-role discipline (V4 RLS / V6 leakage)
**Source:** `seed_library_asset.py:24-27, 50-52, 115-122`
**Apply to:** the whole seed script.
Read `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / DSN NAME-ONLY from `backend/.env` via dotenv — never hard-code, never print. The service-role key bypasses RLS by design; the seeder MUST write only the demo user's uid into every `user_id`/`created_by`/Storage path. Verify each slug matches `^[a-z0-9-]+$` before building the server-side Storage key (no path traversal — slugs are author-fixed constants, not user input).

### S-5 DRIFT FLAG — mirror mechanics, NOT the def shape (load-bearing)
**Source:** RESEARCH.md DRIFT FLAG + `seed_library_asset.py:79-98` (1-phase) vs `test_llm_emit_executor.py:59-71` (2-phase emit)
**Apply to:** the planner authoring the def JSONB.
`seed_library_asset.py`'s fill phase is a **single `llm_agent`** with `available_tools:["search_documents","render_template"]` (the Phase-101 tool-dispatch path). The PM defs per D-104-4 MUST use the **2-phase `llm_agent`→`llm_emit`** shape (the Phase-101.1 emission layer). **Copy the fixture's Storage/AssetRef/DELETE-then-INSERT/secrets mechanics; author the def JSONB to the 2-phase `llm_emit` shape. Do NOT copy the 1-phase `llm_agent` config, and do NOT put `render_template` in any `available_tools` (the emit phase resolves the template server-side; the retrieval phase only needs `search_documents`).** The read-back assertion in `upsert_definition` changes accordingly (assert `kind:"template"` asset + retrieval `available_tools`, not `render_template` on an agent phase).

### S-6 Per-account corpus ingest, NEVER global (V4 cross-tenant pollution)
**Source:** `documents.py:338-516` (upload route) + `019_global_folder_subtree_visibility.sql:54-62` / `full-schema.sql:2138` (pollution RLS)
**Apply to:** the synthetic-KB ingest step.
The documents SELECT RLS is `auth.uid()=user_id OR folder_is_globally_visible(folder_id)` — a doc in a global-folder subtree surfaces in EVERY authenticated user's `search_documents`/`list_documents` with NO exclusion mechanism. Seed the demo folder `is_global=false`, per-account. Ingest via `POST /documents/upload` (byte-identical to a human upload → dedup/versioning/freshness behave naturally). sha256 dedup (`documents.py:402-423`) + filename versioning (`:425-449`) make re-runs idempotent. One live OpenAI embeddings call per doc (`embedding_service.py:94-97`) — an embedding key MUST be configured before the seed runs; keep the corpus small (~4-6 docs).

### S-7 Cross-provider = a model-list problem (SC#10 scoreboard)
**Source:** `forced_emit.py:208-275` + `dispatcher.py:106-127` + `config.py:206-313`
**Apply to:** the Weekly Status Report scoreboard rows (VALIDATION.md, NOT PLAN.md tasks).
The emit path makes ONE sealed `forced_emit` shot (`phase_types.py:1187-1195`) — no provider branch. The only per-provider branch is `dispatcher.py:106-127`. So cross-provider coverage = pick exact registry IDs per tier. Use EXACT PascalCase for GLM/MiniMax (`MiniMax-M3`, `glm-4.6`) — a case miss reads `cap.get("forced_emission", False)` (`forced_emit.py:246`) as a default-SAFE miss → silent coerce. Cover TIER-FORCE+strict (OpenAI `gpt-5.4`, DeepSeek `deepseek-v4-pro`), TIER-FORCE no-strict (Anthropic `claude-opus-4-8`, Google `gemini-2.5-pro`, `MiniMax-M3`, `glm-4.6`), TIER-COERCE (`kimi-k2.6`), + a long-deliverable DeepSeek/Moonshot row proving `is_truncated` (`template_render_service.py:507-530`) honest-fails (never half-emits).

### S-8 No interactive phases on a publishable def (publish-gauntlet block)
**Source:** `publish_service.py:153-171`
**Apply to:** both seeded defs + the verifier publish proof.
A def with an `llm_human_input` phase OR a validator whose `on_failure` routes to `ask_user` is BLOCKED pre-run at publish (a synchronous publish cannot drive an unwatched `ask_user`). Keep every PM gate `on_failure:"fail_run"` — do NOT attach a `freshness`/`ask_user`-routed validator to a pack def that must pass the golden run.

---

## No Analog Found

| Artifact | Role | Data Flow | Reason |
|----------|------|-----------|--------|
| `scripts/pm-pack/sample-corpus/*.md` (synthetic KB content) | content | file-I/O | No in-repo synthetic corpus to copy. The INGEST path has an exact analog (`POST /documents/upload`, S-6); only the markdown CONTENT is net-new authored data. Recommended (RESEARCH Q4): `project-charter-source.md`, `weekly-meeting-notes-w1/w2.md`, `sprint-task-log.md`, `risk-log.md` (6-9 worded P/I risks). Must contain cited-able spans for every non-null status/risk field. ~6 embedding calls total. |
| The corpus-ingest STEP inside `seed-pm-pack.py` (resolve demo folder → ingest → capture `folder_id`) | seed-script step | file-I/O | `seed_library_asset.py` has no corpus step (it only seeds a Storage template + a def). The ingest mechanics come from `documents.py:338-516` (route) or `_upload_pipeline` in-process; the seed script either POSTs to the running server or calls the pipeline directly. Planner picks per "is a server running at seed time" — both are in CONTEXT discretion. |

---

## Metadata

**Analog search scope:** none required — every analog was pre-pinned with a verified file:line anchor in CONTEXT.md `<canonical_refs>` and re-verified in RESEARCH.md's Anchor Re-Verification Ledger. This pass CONFIRMED the 5 load-bearing analogs by reading them directly:
- `backend/tests/fixtures/seed_library_asset.py` (full, 316 lines)
- `backend/app/models/harness.py:60-260` (config/asset/validator/definition shapes)
- `backend/tests/unit/test_llm_emit_executor.py:1-115` (2-phase emit fixtures)
- `supabase/migrations/061_harness_seed_templates.sql:1-60` (published-seed shape)
- `supabase/full-schema.sql:222-251` (immutability trigger) + `phase_types.py:724-741` (`_emit_bound_asset_ref`) + `template_asset_service.py:81-135` (`resolve_template_source` Branch 1)

**Files scanned:** 7 (all confirmations of pinned anchors — zero net-new search)
**Pattern extraction date:** 2026-06-14

---

## PATTERN MAPPING COMPLETE
