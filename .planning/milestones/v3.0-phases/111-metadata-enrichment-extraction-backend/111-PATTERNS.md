# Phase 111: Metadata Enrichment — Extraction Backend - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 6 (2 NEW, 4 net-new-code-in-existing) + Wave-0 test analogs
**Analogs found:** 6 / 6 (every file has a strong, file:line-verified analog — this phase is composition over a proven substrate; the analogs are load-bearing)

> All analog citations below were re-read against live source this session. Where the CONTEXT/RESEARCH file:line differs from what is live, the LIVE number is given and flagged.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/metadata_fields.py` (NEW) | route/controller | CRUD (request-response) | `backend/app/api/skills.py` | exact (own+global CRUD, `get_current_user`, RLS, 404/403 on miss) |
| `supabase/migrations/072_app_settings_extraction_model.sql` (NEW) | migration | DDL | `supabase/migrations/045_app_settings_extraction_aspects.sql` + `071` (options col) | exact (`ADD COLUMN IF NOT EXISTS … text` idiom) |
| `embedding_service.py` → `extract_metadata_enriched` + `build_metadata_model` (net-new) | service | transform (forced LLM emit) | `workflow_authoring.py` (own EMIT tool + `forced_emit`) + judge `publish_service.py` | exact (3rd `forced_emit` caller; identical caller shape) |
| `documents.py` `ingest_document` enriched/legacy branch + `asyncio.run` (net-new) | service (BackgroundTask) | event-driven (ingest pipeline) | `documents.py:218` (`asyncio.run`) + `documents.py:1368` (existing `extract_metadata` call) | exact (same file, same function) |
| `user_settings.py` 3 new fields + `_build_settings_from_row` lines (net-new) | model/config | config read | `document_management_enabled` (DMF-03 `env_attr=None`, `user_settings.py:480`) + the `extraction_*` block (`:489-496`) | exact |
| `config.py` `lmstudio` provider registration (net-new) | config | config resolution | the `ollama` provider lines (`config.py:15,691,739,750-751`) | exact (mirror, minus the `/v1` append) |
| Wave-0 `tests/integration/test_111_*` | test | live-DB integration | `tests/integration/test_110_dm_audit_live.py` + `test_110_dm_schema.py` | exact (same live-DB :54322 harness + 2-user RLS fixture) |

---

## Pattern Assignments

### `backend/app/api/metadata_fields.py` (NEW — route/controller, CRUD)

**Analog:** `backend/app/api/skills.py` (own+global CRUD router — the closest live analog; `folders.py` is the secondary). META-01's "user can DEFINE custom fields" maps 1:1 onto the skills CRUD shape.

**Router declaration + imports + DI** (`skills.py:1-21`):
```python
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from supabase import Client
from app.dependencies import get_current_user, get_supabase
from app.models.skill import SkillCreate, SkillResponse, SkillUpdate

router = APIRouter(prefix="/skills", tags=["skills"])
```
For 111: `router = APIRouter(prefix="/metadata-fields", tags=["metadata-fields"])`; a NEW `app/models/metadata_field.py` (or inline) carries `MetadataFieldCreate`/`Update`/`Response` Pydantic models. **The `field_type` `Literal` vocabulary lives on the Pydantic `Create` model** (D-111-5 — DB has no CHECK; `migration 071:94` is `field_type text NOT NULL DEFAULT 'string'`).

**List (own + global, deduped)** (`skills.py:105-124`):
```python
@router.get("", response_model=list[SkillResponse])
async def list_skills(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = (
        supabase.table("skills")
        .select("*")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .order("name")
        .execute()
    )
    seen = set()
    skills = []
    for row in result.data:
        if row["id"] not in seen:
            seen.add(row["id"])
            skills.append(row)
    return skills
```
For 111: `supabase.table("metadata_field_definitions").select("*").or_(f"user_id.eq.{current_user['id']},is_global.eq.true")` — list own + global enabled.

**Create (HARD-SET `user_id=caller`, `is_global=false`)** (`skills.py:127-145`) — the load-bearing security pattern (D-111-5; RLS WITH CHECK forces it at `071:167-168`, app hard-sets it too):
```python
@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    body: SkillCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = (
        supabase.table("skills")
        .insert({
            "user_id": current_user["id"],   # ← caller, never from body
            "name": body.name.strip(),
            "description": body.description,
            "instructions": body.instructions,
            "is_global": body.is_global,     # ← 111 OVERRIDES to hard False (no end-user globals)
        })
        .execute()
    )
    return result.data[0]
```
> **111 deviation:** `skills.create` accepts `is_global` from the body; 111 MUST hard-set `is_global=False` (per D-111-5 + the RLS `WITH CHECK ... AND is_global = false` at `071:168`). Do NOT pass it through from the body. Insert `field_key`, `field_type` (validated `Literal`), `description`, and (if Q4 gap (a)) `options` (jsonb). **Then `write_audit_entry(..., action_type="metadata.field.create", ...)`** — see Shared Pattern C.

**Edit/enable-disable (own-only, 404-not-403 here, but 403 is the live skills choice)** (`skills.py:260-283`):
```python
@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(skill_id: str, body: SkillUpdate, current_user=..., supabase=...):
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        supabase.table("skills")
        .update(update_data)
        .eq("id", skill_id)
        .eq("user_id", current_user["id"])   # ← own-scoped update
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Skill not found")  # 404, NOT 403, on cross-user miss
    return result.data[0]
```
> **404 vs 403:** `update_skill`/`delete_skill` use `.eq("user_id", ...)` + **404** on miss (`skills.py:282`); but `toggle_enabled`/`toggle_global` fetch-first and return **403** (`skills.py:330-333`). CONTEXT D-111-5 + the D-v2.6-04 precedent say **404-not-403 on a cross-user miss**. Recommend the `update_skill` shape (`.eq("user_id")` + 404) for all 111 mutating endpoints — it is the safer non-leaking pattern.

**Delete (own-scoped)** (`skills.py:310`):
```python
supabase.table("skills").delete().eq("id", skill_id).eq("user_id", current_user["id"]).execute()
```

**Mount in main.py** (`main.py:405,413`):
```python
from app.api import threads, runs, documents, settings as settings_api, folders, kb, skills, audit, ... , workflows  # noqa: E402
...
app.include_router(skills.router)
```
For 111: add `metadata_fields` to the import tuple at `main.py:405` and `app.include_router(metadata_fields.router)` alongside the others (~`main.py:421`).

---

### `supabase/migrations/072_app_settings_extraction_model.sql` (NEW — migration, DDL)

**Analog:** `supabase/migrations/045_app_settings_extraction_aspects.sql` (the `ALTER TABLE … ADD COLUMN IF NOT EXISTS … text` idiom). 072 is the next free number (071 is the highest live migration).

**Full 045 idiom** (`045_app_settings_extraction_aspects.sql:11-18`):
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS extraction_text_engine_pdf       text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS extraction_text_engine_docx      text DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS extraction_table_engine_pdf      text DEFAULT 'docling_tf',
  ...
  ADD COLUMN IF NOT EXISTS extraction_per_call_hints_enabled boolean DEFAULT true;
```
For 111 (per RESEARCH Q9 — recommend ONE migration):
```sql
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS extraction_model            text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_window_cap       integer DEFAULT 32000,
  ADD COLUMN IF NOT EXISTS metadata_enrichment_mode    text DEFAULT 'enriched';
-- if enum field_type ships in 111 (Q4 gap (a) — recommended, additive):
ALTER TABLE public.metadata_field_definitions
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT NULL;
```
> The `options jsonb` add mirrors the same `ADD COLUMN IF NOT EXISTS` idiom against `metadata_field_definitions` (whose DDL is `071:89-104` — note it has NO `options` column today and NO `field_type` CHECK).
> **Apply discipline (CLAUDE.md):** paste into Supabase SQL editor (or psycopg2-direct to :54322 per the 100/102/110 operator-authorized precedent) — NEVER `db push`/`db reset`. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit both the migration and `full-schema.sql`.

---

### `embedding_service.py` → `extract_metadata_enriched` + `build_metadata_model` (net-new in existing file — service, transform)

**Analog:** `backend/app/services/workflow_authoring.py` — the 2nd live `forced_emit` caller (the judge in `publish_service.py` is the 3rd reference). 111 becomes the 4th. The caller shape is identical: build own EMIT tool from `<Model>.model_json_schema()`, resolve model+provider, pass a REAL `UserEffectiveSettings`, None-check the emitted result.

**Build the EMIT tool from the model's json schema** (`workflow_authoring.py:127-137`):
```python
WF_SCHEMA = _strip_discriminator(copy.deepcopy(WorkflowDefinition.model_json_schema()))
EMIT_TOOL: dict = {
    "type": "function",
    "function": {
        "name": "emit_workflow_definition",
        "description": "Emit a single valid WorkflowDefinition for this task.",
        "parameters": WF_SCHEMA,
    },
}
```
For 111: build PER-INGEST (the schema is dynamic) — `parameters = DynModel.model_json_schema()`, `name="emit_document_metadata"`. Do NOT reuse `phase_types._emit_forced_tool` (it is `EmitFieldMap`-shaped — advertised tool ≠ validator → guaranteed honest-fail).

**The judge's equivalent tool-build** (`publish_service.py:688-697`) — confirms the pattern is repeated, not one-off:
```python
judge_tool = [{
    "type": "function",
    "function": {
        "name": "judge_verdict",
        "description": "Emit the structured quality verdict for the graded output.",
        "parameters": JudgeVerdict.model_json_schema(),
    },
}]
```

**Resolve a REAL `UserEffectiveSettings` (the `active_provider` live-fix)** (`workflow_authoring.py:399-414`) — Pitfall 4; passing app-level `Settings` raises `AttributeError('active_provider')` inside the gateway:
```python
# provider resolved from the model:
provider = (get_model_capability(authoring_model) or {}).get("provider")
...
from app.models.user_settings import load_user_settings  # function-local (Pitfall 4)
owner_settings = load_user_settings(user_id)              # REAL UserEffectiveSettings (.active_provider)
```
> **111 difference:** the extraction call is admin-global, so source settings via `load_app_settings()` (sync, cache-only, already used in `ingest_document` at `documents.py:1403`) — it returns a `UserEffectiveSettings` with `.active_provider`. Resolve `model = app_settings.extraction_model or settings.llm_model` (env gpt-4o fallback, NOT `app_settings.llm_model`); `provider = (get_model_capability(model) or {}).get("provider")`. Mirror `resolve_authoring_model`/`resolve_judge_model` resolution discipline (`workflow_authoring.py:83-105`).

**The `forced_emit` call + None-check honest-fail** (`workflow_authoring.py:434-449`):
```python
return await forced_emit(
    messages=messages,
    model=authoring_model,
    provider=provider,
    emitter="emit_workflow_definition",      # the tool NAME (forced_emit owns no tool)
    tools=[EMIT_TOOL],
    user_settings=owner_settings,
    system_prompt=AUTHORING_SYSTEM_PROMPT,
    schema_model=WorkflowDefinition,
    strict=False,  # Pitfall 1: force-without-strict for the optional-heavy schema
)
...
wd = res1.get("emitted")
if wd is None:                               # None → honest fail, NEVER prose-as-artifact
    ...                                      # bounded retry / degrade
```
For 111: `emitter="emit_document_metadata"`, `schema_model=<DynModel>`, `tools=[<dynamic emit tool>]`, `strict=False` (REQUIRED — the dynamic model is optional-heavy/all-nullable; without it OpenAI/DeepSeek strict-mode 400). `forced_emit`'s signature (`forced_emit.py:205-216`) confirms `schema_model: type[BaseModel] | None` + `strict: bool | None`; the `strict=False` override is the Phase 103 additive (`forced_emit.py:247-248`); registry-miss → TIER-COERCE default-SAFE (`forced_emit.py:246`).

**Service-role explicit user-scoping for the field-def read** (`workflow_authoring.py:140-181`, `_skill_registry`) — the D-111-6 / 110-SECURITY precedent (BackgroundTask has no `auth.uid()` → service-role bypasses RLS → scope by hand, fail-closed):
```python
def _skill_registry(supabase, user_id: str) -> list[dict]:
    try:
        rows = (
            supabase.table("skills")
            .select("id,name,is_global,user_id,is_enabled")
            .or_(f"user_id.eq.{user_id},is_global.eq.true")   # explicit predicate, NOT RLS
            .execute()
            .data
        ) or []
    except Exception:  # noqa: BLE001 — a scoped read miss must FAIL CLOSED, never widen scope.
        ...
        rows = []   # fail closed → no grounding, never a possibly-polluted full-table set
    return [
        r for r in rows
        if r.get("is_enabled") and (str(r.get("user_id")) == str(user_id) or r.get("is_global"))
    ]
```
For 111 the table is `metadata_field_definitions`, the enabled filter is `r.get("enabled")` (column is `enabled` per `071:97`, not `is_enabled`), and `user_id` = `ingest_document`'s `user_id` param (`documents.py:1337`):
```python
rows = (supabase.table("metadata_field_definitions")
        .select("id,field_key,field_type,description,is_global,user_id,enabled,options")
        .or_(f"user_id.eq.{doc_owner_uid},is_global.eq.true")
        .execute().data) or []
defs = [r for r in rows if r.get("enabled")
        and (str(r.get("user_id")) == str(doc_owner_uid) or r.get("is_global"))]
```

**The legacy path to PRESERVE untouched** (`embedding_service.py:100-137`) — `extract_metadata` stays as the `metadata_enrichment_mode == "legacy"` reversibility path; do NOT delete it. Its two graceful-degradation layers (`try/except → return None` at `:111-137`, and the `content[:3000]` window at `:107`) are the legacy behavior. The NEW sibling `build_metadata_model` + `async def extract_metadata_enriched` go alongside it.

**Built-in 7-field source** (`models/document.py:8-15`) — `build_metadata_model` mirrors these as the always-on immutable fields:
```python
class DocumentMetadata(BaseModel):
    title: str | None = None
    author: str | None = None
    date: str | None = None
    document_type: str | None = None
    topics: list[str] | None = None
    language: str | None = None
    summary: str | None = None
```

---

### `documents.py` `ingest_document` — enriched/legacy branch + `asyncio.run` call site (net-new in existing file — service, event-driven)

**Analog (same file):** the existing `asyncio.run(...)` precedent (`documents.py:218`) + the existing `extract_metadata` call site (`documents.py:1368`).

**The `asyncio.run` sync→async bridge precedent** (`documents.py:211-219`) — inside a SYNC BackgroundTask, off the event loop; D-v2.5-01 does NOT fire:
```python
async def _run_with_timeout() -> ExtractedDocument:
    from starlette.concurrency import run_in_threadpool  # noqa: PLC0415
    return await asyncio.wait_for(
        run_in_threadpool(extract_composable, raw, mime_type, engines_dict),
        timeout=wall_clock_s,
    )

extracted_doc = asyncio.run(_run_with_timeout())
```
For 111: `result = asyncio.run(extract_metadata_enriched(...))` inside the sync `ingest_document`. Do NOT make `ingest_document`/`_upload_pipeline` async; do NOT wrap `forced_emit` in `run_in_threadpool` (it's a coroutine that already wraps its own blocking drain internally, `forced_emit.py:324`).

**The existing extract call site + exclude_none + case-normalize to wrap** (`documents.py:1368-1375`):
```python
metadata = extract_metadata(text)
metadata_dict = metadata.model_dump(exclude_none=True) if metadata else None
# Normalize case-sensitive filter fields for consistent retrieval
if metadata_dict:
    if metadata_dict.get("document_type"):
        metadata_dict["document_type"] = metadata_dict["document_type"].lower()
    if metadata_dict.get("language"):
        metadata_dict["language"] = metadata_dict["language"].lower()
```
For 111 (per RESEARCH "full extraction call site shape"): branch on `app_settings.metadata_enrichment_mode`; in the `enriched` branch, build `DynModel`, the emit tool, sample the window (`sample_for_extraction`), `asyncio.run(extract_metadata_enriched(...))`, take `emitted = result.get("emitted")`, then `metadata_dict = emitted.model_dump(exclude_none=True) if emitted else None`, attach `_confidence` AFTER the dump (`metadata_dict["_confidence"] = emitted.confidence` — name the Pydantic field `confidence` no-underscore per RESEARCH Pattern 2 / Pitfall 2), guarding the `metadata_dict is None` case. The shared case-normalize tail (lowercase `document_type` + `language` ONLY — D-111-9) stays UNCHANGED.

**HOIST `load_app_settings()`** — currently read at `documents.py:1403`; the extract call is at `:1368`. Move `app_settings = load_app_settings()` to before `:1368` so `extraction_model` / `extraction_window_cap` / `metadata_enrichment_mode` are in scope.

**The persist site (unchanged shape)** (`documents.py:1466-1482`):
```python
supabase.table("documents").update({
    "status": "completed",
    "chunk_count": len(chunks),
    "metadata": metadata_dict,   # ← may be None; flat fields → @> still matches, _confidence nested ignored
    "full_markdown": text,
    "extractor": engine_used,
}).eq("id", document_id).execute()
```

**The outer try/except backstop to PRESERVE** (`documents.py:1360,1484-1505`) — D-111-8 graceful-degradation layer 2 (the inner `except → None` in `extract_metadata`/`extract_metadata_enriched` is layer 1):
```python
try:
    ...  # the whole ingest body
except Exception as e:
    log.error("ingest_document failed: %s\n%s", e, traceback.format_exc())
    ...  # telemetry write (own try/except so it can't double-fault)
    supabase.table("documents").update({
        "status": "failed",
        "error_message": str(e)[:500],
    }).eq("id", document_id).execute()
```
> Wrap the new enriched call in its OWN swallow-to-None (RESEARCH code example: `except Exception: logger.warning(...); emitted = None`) so a failing/garbage model degrades to null metadata and the doc still reaches `status=completed` — NEVER trips the outer backstop into `failed`.

---

### `user_settings.py` — 3 new `UserEffectiveSettings` fields + `_build_settings_from_row` lines (net-new — model/config)

**Analog:** the `document_management_enabled` DMF-03 `env_attr=None` precedent (`user_settings.py:478-480`) + the `extraction_*` block (`:489-496`) — both app_settings-only, no env fallback (a model id / mode is a VALUE not a secret, per CLAUDE.md).

**The DMF-03 `env_attr=None` precedent** (`user_settings.py:478-480`):
```python
# Phase 110 DMF-03 — env_attr=None: app_settings-only, no env fallback
# (CLAUDE.md "env vars are for secrets/infra only"). Missing/None column => True.
document_management_enabled=_val_bool(row, "document_management_enabled", None, True),
```

**The `extraction_*` block (str + bool readers, env_attr=None)** (`user_settings.py:489-496`):
```python
extraction_text_engine_pdf=str(_val(row, "extraction_text_engine_pdf", None, "legacy")),
...
extraction_per_call_hints_enabled=_val_bool(row, "extraction_per_call_hints_enabled", None, True),
```
For 111 — add 3 lines to `_build_settings_from_row` (the `_val(row, <col>, None, <default>)` shape, `None` = app_settings-only):
```python
extraction_model=str(_val(row, "extraction_model", None, "")),
extraction_window_cap=int(_val(row, "extraction_window_cap", None, 32000)),
metadata_enrichment_mode=str(_val(row, "metadata_enrichment_mode", None, "enriched")),
```
And 3 matching field declarations on the `UserEffectiveSettings` Pydantic model (find the existing `extraction_*` field declarations on that model and add alongside).

> **Note (analog deviation):** the CONTEXT/RESEARCH cite `harness_judge_model` as the DB-only precedent, but that field is declared on the **env `Settings`** model in `config.py:962` (`harness_judge_model: str | None = None`) — it is the "model id is a VALUE → Settings-not-env, None=registry-default" pattern, NOT a `UserEffectiveSettings` `_build_settings_from_row` field. For the actual `_build_settings_from_row` `env_attr=None` mechanic that 111 needs, the **`document_management_enabled` (DMF-03) line at `user_settings.py:480`** and the `extraction_*` block are the precise live analogs — use those.

---

### `config.py` — `lmstudio` provider registration (net-new — config)

**Analog:** the `ollama` provider lines (base-url resolution, keyless/dummy key). LM Studio differs in ONE way: its base URL already includes `/v1`, so NO append.

**`ollama` in `_PROVIDER_BASE_URLS`** (`config.py:15`):
```python
_PROVIDER_BASE_URLS: dict[str, str] = {
    ...
    "ollama": "",  # resolved dynamically from ollama_base_url
    ...
}
```
For 111: add `"lmstudio": "",  # resolved dynamically from lmstudio_base_url`.

**`ollama_base_url` env field** (`config.py:691`):
```python
ollama_base_url: str = "http://localhost:11434"
```
For 111: add `lmstudio_base_url: str = "http://localhost:1234/v1"` (env `LMSTUDIO_BASE_URL`; LM Studio's default OpenAI-compat host already carries `/v1`).

**`resolve_llm_provider` key_map + base_url branch** (`config.py:734-753`):
```python
key_map: dict[str, str] = {
    ...
    "ollama": "ollama",  # Ollama doesn't require a real key
    ...
}
resolved_key = key_map[provider]
if resolved_key:
    self.llm_api_key = resolved_key

if provider == "ollama":
    self.llm_base_url = f"{self.ollama_base_url.rstrip('/')}/v1"   # ollama APPENDS /v1
else:
    self.llm_base_url = _PROVIDER_BASE_URLS[provider]
```
For 111: add `"lmstudio": "lm-studio"` to `key_map` (dummy key, like ollama's), and a branch:
```python
elif provider == "lmstudio":
    self.llm_base_url = self.lmstudio_base_url.rstrip("/")   # URL ALREADY includes /v1 — NO append
```
> Membership validation goes through `_PROVIDER_BASE_URLS.keys()` automatically (`config.py:731`), so adding `lmstudio` to that dict is the only registration needed for the unknown-provider guard. An `lmstudio` (or registry-miss) model id infers to the `ollama` fallback bucket (`_INFERENCE_FALLBACK_PROVIDER = "ollama"`, `config.py:363`); `ollama` is intentionally EXCLUDED from `_NATIVE_TOOL_PROVIDERS` (`config.py:382-384`) → `native_tools=False`, `forced_emission=False` → TIER-COERCE STRUCTURED by construction (the desired safe default for local). Shared chunk/SSE path needs ZERO change. Add `LMSTUDIO_BASE_URL` to `backend/.env.example` next to the `OLLAMA_BASE_URL` line (`.env.example:104`).

---

### Wave-0 tests — `tests/integration/test_111_*` + `tests/unit/test_111_*` (test, live-DB integration)

**Analog:** `tests/integration/test_110_dm_audit_live.py` (live-DB audit round-trip) + `tests/integration/test_110_dm_schema.py` (2-user RLS isolation). Both are modeled on `test_092_harness_audit_live.py`. The harness shape is reusable verbatim.

**Live-DB connection guard + skip + function-scoped pool** (`test_110_dm_audit_live.py:44-103`) — copy this header for every `test_111_*` integration file:
```python
_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)
async def _pg_reachable(dsn=_POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close(); return True
    except Exception:
        return False
PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(not PG_AVAILABLE, reason="...:54322 not reachable...")

@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped real asyncpg pool (NOT session — pytest-asyncio fresh loop per test)."""
    async def _init(conn):
        await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()
```

**Live audit INSERT+SELECT round-trip (mock-proof — bypasses the swallowing service)** (`test_110_dm_audit_live.py:142-161`) — the model for `test_111_audit_field_create.py`:
```python
@pytest.mark.asyncio
async def test_dm_audit_type_round_trips_live(pg_pool, test_thread_user, action_type):
    _thread_id, user_id = test_thread_user
    await pg_pool.execute(
        "INSERT INTO audit_log (user_id, action_type, metadata) VALUES ($1, $2, $3::jsonb)",
        user_id, action_type, json.dumps({"phase": "110", "probe": True}),
    )
    row = await pg_pool.fetchrow(
        "SELECT action_type FROM audit_log WHERE user_id = $1 AND action_type = $2",
        user_id, action_type,
    )
    assert row is not None  # CHECK-enum drift → None → RED
```
For 111: drive the `metadata.field.create` audit through the REAL CRUD create endpoint (or `write_audit_entry`), then SELECT-back via raw asyncpg (the live INSERT+SELECT verification of D-111-5). The `metadata.field.create` enum is ALREADY in both `VALID_ACTION_TYPES` (`audit_service.py:25`) and migration 071's live CHECK — no audit migration.

**2-user RLS / service-role-scoping fixture + the role-switch incantation** (`test_110_dm_schema.py:104-142,302-314`) — the model for `test_111_field_def_scoping.py`:
```python
@pytest_asyncio.fixture
async def two_users(pg_pool):
    user_a = uuid4(); user_b = uuid4()
    for uid in (user_a, user_b):
        await pg_pool.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)",
                              uid, f"phase-111-{uid}@test.local")
    yield (user_a, user_b)
    # FK-safe teardown: DELETE rows in the target table by user_id, then the users
    ...

async def _select_count_as_user(pool, user_id, sql, *args) -> int:
    """Run a SELECT under RLS as the given user (auth.uid() resolves to user_id)."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("SET LOCAL ROLE authenticated")
            await conn.execute("SELECT set_config('request.jwt.claim.sub', $1, true)", str(user_id))
            return await conn.fetchval(sql, *args)
```
For 111 `test_111_field_def_scoping.py`: seed user A's private + a global `metadata_field_definitions` row, then assert the **app-code `.or_(user_id.eq.{B},is_global.eq.true)` read** (the `extract_metadata_enriched` field-def read) returns only B's own + global — NOT A's private fields. The existing `test_rls_global_metadata_field_visible_to_other_user` (`test_110_dm_schema.py:270-287`) already exercises the global-visibility path on this exact table — extend it for the cross-user-leak negative case.

**Unit-test harness (no DB):** the Wave-0 unit files (`test_111_dynamic_model.py`, `test_111_confidence_survives_exclude_none.py`, `test_111_exclude_none_nonregression.py`, `test_111_window_sampling.py`, `test_111_extraction_model_resolve.py`, `test_111_lmstudio_provider.py`) are plain pytest with no live-DB dependency — model them on any existing `backend/tests/unit/test_*` (pure-function assertions). The `confidence`-survives-`exclude_none` test is BLOCKING (the A1 underscore-field caveat — verify the chosen field naming).

---

## Shared Patterns

### A. Caller-owned `forced_emit` EMIT tool + `schema_model` + `strict=False`
**Source:** `workflow_authoring.py:127-137,434-444` (primary); `publish_service.py:688-718` (judge, 2nd reference).
**Apply to:** `extract_metadata_enriched` in `embedding_service.py`.
**Rule:** the caller builds its OWN tool (`name`, `parameters = <Model>.model_json_schema()`), passes `emitter=<name>`, `schema_model=<Model>`, `strict=False`, and a real `UserEffectiveSettings`. `forced_emit` owns no tool. NEVER reuse `phase_types._emit_forced_tool` (EmitFieldMap-shaped). None `emitted` = honest fail.

### B. Explicit user-scoping under service-role (the 110-SECURITY lesson, D-111-6)
**Source:** `workflow_authoring.py:140-181` (`_skill_registry`).
**Apply to:** the ingest-time `metadata_field_definitions` read inside `ingest_document` (BackgroundTask, no `auth.uid()`).
**Rule:** explicit `.or_(f"user_id.eq.{owner},is_global.eq.true")` + Python-side fail-closed filter (`r.get("enabled") and (own or is_global)`). On query exception → `[]` (built-ins only), never a bare full-table read. The CRUD router endpoints (request-scoped, real JWT) rely on RLS + `get_current_user`; only the BackgroundTask read scopes by hand.

### C. Audit write for `metadata.field.create`
**Source:** `audit_service.py:25,57-74` (the enum + `write_audit_entry`); the enum is pre-seated live (`071` CHECK + `VALID_ACTION_TYPES`).
**Apply to:** the `metadata_fields.py` create endpoint.
**Rule:**
```python
await write_audit_entry(
    user_id=current_user["id"],
    action_type="metadata.field.create",
    metadata={"field_key": ..., "field_type": ...},
    supabase=supabase,
)
```
`write_audit_entry` is async and SWALLOWS errors (incl. 23514) — so a static/mocked test false-greens it. Verify with a LIVE INSERT+SELECT (Shared Pattern A test analog above). Fire-and-forget via `BackgroundTasks.add_task` or `asyncio.create_task` per the audit_service module docstring (`audit_service.py:1-5`) — never block the request on it.

### D. DB-only `app_settings` field (no UI, `env_attr=None`)
**Source:** `user_settings.py:478-480` (`document_management_enabled` DMF-03) + `:489-496` (`extraction_*`).
**Apply to:** `extraction_model`, `extraction_window_cap`, `metadata_enrichment_mode`.
**Rule:** `_val(row, <col>, None, <default>)` — `None` env_attr = app_settings-only, no env fallback, NOT in `SettingsUpdate`, no Settings UI. Admins set via SQL / `save_app_settings`.

### E. Two-layer graceful degradation (D-111-8)
**Source:** `embedding_service.py:111-137` (inner `except → None`) + `documents.py:1360,1484-1505` (outer try/except).
**Apply to:** `extract_metadata_enriched` (preserve inner swallow) + the new `asyncio.run` call site (wrap in its own `except → emitted=None`).
**Rule:** a failing/garbage model degrades to null/low-confidence metadata; the doc ALWAYS reaches `status=completed` with core metadata intact-or-null. Verify LIVE with a deliberately-raising model (the 104 lesson — static tests false-green this).

### F. exclude_none + flat-filter + `@>` non-regression (D-111-9)
**Source:** `documents.py:1369-1375` (`model_dump(exclude_none=True)` + lowercase `document_type`/`language` ONLY).
**Apply to:** the shared persist tail.
**Rule:** empty `author` stays DROPPED (never `""`); all AI-filterable fields stay FLAT at `documents.metadata` top level; confidence confined to nested `_confidence`. `@>` partial containment (`full-schema.sql:108,132`) ignores extra top-level/nested keys. NO migration on `documents.metadata`.

---

## No Analog Found

| File / Code | Role | Data Flow | Reason (use RESEARCH pattern instead) |
|------|------|-----------|--------|
| `build_metadata_model` (`pydantic.create_model`) | service helper | transform | No `create_model` precedent in-repo (all existing `forced_emit` callers use a STATIC `BaseModel`). Use RESEARCH Pattern 2 (`111-RESEARCH.md:156-196`) — the `_TYPE_MAP` + `create_model("DynamicDocumentMetadata", **fields)` recipe, with the `confidence` (no-underscore) field caveat (A1, BLOCKING Wave-0 unit test). |
| `sample_for_extraction` (head+tail window) | service helper | transform | No head+tail-sampling precedent (today's path is a flat `content[:3000]` slice). Use RESEARCH Pattern Q7 (`111-RESEARCH.md:282-293`) — 70% head / 30% tail + elision marker + per-model context-window clamp + truncate-then-degrade. |
| grammar-constrained `response_format` for local (OPTIONAL) | service | transform | The `strict_response_format` seam (`openai_compat.py:381-409`) fires ONLY in TIER-FORCE AND is openai-gated (`openai_service.py:1399`) — local is TIER-COERCE and never reaches it. NET-NEW, provider-gated, live-verified, OPTIONAL (RESEARCH Q2). Ship COERCE + bounded validate-retry as the default; add the lmstudio-gated `json_schema` only IF the local UAT row shows excessive parse failures. |

---

## Metadata

**Analog search scope:** `backend/app/api/` (skills, folders, documents, settings, main), `backend/app/services/` (workflow_authoring, embedding_service, forced_emit, harness/publish_service, harness/validator_kinds, audit_service), `backend/app/models/` (user_settings, document), `backend/app/config.py`, `supabase/migrations/` (045, 071), `backend/tests/integration/` (test_110_*).
**Files scanned:** ~14 (all read at the cited file:line ranges).
**Pattern extraction date:** 2026-06-15
