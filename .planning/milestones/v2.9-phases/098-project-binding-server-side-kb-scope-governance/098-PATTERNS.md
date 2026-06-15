# Phase 098: Project Binding + Server-Side KB Scope Governance - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 11 (8 modified, 3 net-new) + 1 conditional migration
**Analogs found:** 11 / 11 (every file has an in-tree analog — this is additive-on-existing work, not greenfield)

> **Two red lines the planner must encode in every `read_first` + acceptance block:**
> 1. **Deep byte-identical (D-05a):** the ⊆ assert/clip in `_handle_search_documents` runs ONLY when `ctx.folder_subtree_ids is not None`. When `None` (Deep whole-KB) it is a **literal no-op** — same gate shape as the already-shipped `_handle_glob` at `tool_dispatcher.py:145`.
> 2. **`set[str]` annotation vs `list[str]` runtime (Pitfall 1):** `ToolContext.folder_subtree_ids` is *annotated* `set[str] | None` (`tool_dispatcher.py:69`) but is a **`list[str]` at runtime everywhere** (`agent_loop.py:989`, `threads.py:1217`). Keep the channel a list (supabase-py `json.dumps` raises on a real `set`); `set()`-ify ONLY for the local membership test.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/models/harness.py` | model (Pydantic schema) | transform (JSONB↔typed) | `_StrictBase` + `WorkflowDefinition` (same file, `:26-29`, `:118-124`) | exact (in-file precedent) |
| `backend/app/services/tool_dispatcher.py` | service (tool handler) | request-response | `_handle_glob` gate (`:142-151`) + `dispatch_tool` whitelist gate (`:1608-1630`) | exact (same gate idiom) |
| `backend/app/services/retrieval_service.py` | service (retrieval) | CRUD (read) | `_enrich_with_filenames` conditional-key add (`:113-137`) | exact (same fn) |
| `backend/app/services/harness/phase_types.py` | service (phase executor) | transform | `_build_phase_tool_context` (same fn, `:151-201`) | exact (same fn) |
| `backend/app/api/threads.py` | controller (ctx-build site 1: live kickoff) | request-response | `_wf_get_subtree` + F5 block (`:1184-1288`) + kickoff parse (`:835-863`) | exact (same block) |
| `backend/app/services/harness_engine.py` | service (ctx-build sites 2/3: resume + Continue) | event-driven (startup sweep / resume) | `_build_resume_context` (`:1073-1203`) + `_load_run_definition` (`:1048-1070`) | exact (same builders) |
| `backend/app/db/workflows.py` | data layer (asyncpg) | CRUD (read) | `list_published_workflows` (same fn, `:130-150`) | exact (same query) |
| `backend/app/api/workflows.py` | route (FastAPI GET) | request-response | `get_published_workflows` (same route, `:38-53`) | exact (same route) |
| `backend/app/services/harness/scope.py` **(NEW)** | utility (shared resolver) | transform | `_get_subtree` (`agent_loop.py:982-989`) / `_wf_get_subtree` (`threads.py:1210-1218`) BFS | role+flow match (centralize the triplicated walk) |
| `backend/tests/test_098_schema_lock.py` **(NEW)** | test | round-trip | `test_harness_templates.py` (`:46-65` + migration-parse `:28-43`) | exact (schema round-trip) |
| `backend/tests/test_098_scope_governance.py` **(NEW)** | test | request-response + event capture | `test_harness_whitelist.py` (full) + conftest `make_tool_context`/`fake_redis` | exact (ctx + emit capture) |
| `supabase/migrations/067_*.sql` **(CONDITIONAL)** | migration | DDL | latest = `066_eval_coverage_seed.sql` | n/a — **RESEARCH §6 recommends ZERO migration** |

---

## Pattern Assignments

### `backend/app/models/harness.py` (model, transform) — MODIFIED

**Analog:** `_StrictBase` + `WorkflowDefinition` + the 5 phase configs — all in this same file. The entire file is ALREADY the additive-optional-on-`extra="forbid"` shape; the new fields just extend it.

**`read_first`:** `backend/app/models/harness.py:1-124` (whole file — 124 lines).

**The strict-base + current `WorkflowDefinition`** (`:26-29`, `:118-124`) — the exact thing new fields land on:
```python
class _StrictBase(BaseModel):
    """Base for all harness config models — rejects unknown keys (D-07)."""
    model_config = ConfigDict(extra="forbid")

# ...
class WorkflowDefinition(_StrictBase):
    slug: str
    version: int
    name: str
    status: Literal["draft", "published"] = "draft"
    phases: list[PhaseSpec]  # the JSONB column parsed via model_validate()
```

**The retrieval-bearing phase configs** that receive `folder_scope` (`:50-77`). NOTE A2/Open-Q-1: D-02 names `LlmAgent`/`LlmSingle`, but the phases that ACTUALLY retrieve are **`LlmAgentPhaseConfig` (`:50`) + `LlmBatchAgentsPhaseConfig` (`:64`)** — `LlmSinglePhaseConfig` (`:42`) has no tools (inert). Add `folder_scope` to both retrieval configs (±`LlmSingle` for shape uniformity — planner confirms):
```python
class LlmAgentPhaseConfig(_StrictBase):
    phase_type: Literal["llm_agent"]
    prompt: str
    available_tools: list[str]  # the per-phase whitelist (091 Pattern 1)
    max_steps: int = 12
    wall_clock_seconds: int | None = None
    model: str | None = None  # None = inherit thread settings
```

**Pattern to replicate (additive-optional, zero-migration):** every new field is `<type> | None = None` or has a default, so old JSONB rows missing the key `model_validate()` to defaults. Field set per D-01/D-02/D-08 (RESEARCH §1 table):
- `WorkflowDefinition`: `project_folder_id: UUID | None = None`, `output_target_folder: UUID | None = None`, `reingest_output: bool = False`, `version_policy: Literal["supersede-by-filename","keep-all"] = "supersede-by-filename"`, `provenance: Literal["source","derived"] = "source"`, (co-lock) `inputs: list[InputFieldSpec] | None = None`, `assets: list[AssetRef] | None = None`.
- retrieval phase configs: `folder_scope: list[UUID] | None = None`.

**Two traps the executor MUST handle:**
1. **Pitfall 2 — `UUID` is NOT imported.** Current imports (`:21,23`): `from typing import Annotated, Literal, Union` + `from pydantic import BaseModel, ConfigDict, Field`. Add `from uuid import UUID`. Symptom if missed: `NameError: name 'UUID'`.
2. **D-07 structural validator** — add a pure `@model_validator(mode="after")` on `WorkflowDefinition` (the file has NONE today — only `extra="forbid"`). It can check STRUCTURE only (e.g. reject a phase `folder_scope` when `project_folder_id is None`); it CANNOT check ⊆-subtree (no `supabase`/`user_id` in a pure validator — that goes in `scope.py`, see below). Do NOT put DB-dependent logic in the validator (RESEARCH anti-pattern).

---

### `backend/app/services/tool_dispatcher.py` (service, request-response) — MODIFIED

**Analog (the gate idiom — copy verbatim):** `_handle_glob` already does the exact `if ctx.folder_subtree_ids is not None:` Deep-gated folder filter. This is the literal template for the ⊆ clip.

**`read_first`:** `tool_dispatcher.py:59-106` (ToolContext dataclass), `:142-151` (`_handle_glob` gate), `:165-216` (`_handle_search_documents`), `:1608-1630` (`dispatch_tool` gate).

**The gate analog** (`:142-151`) — note `ctx.folder_subtree_ids is not None` is the Deep no-op gate, and membership is `m.get("folder_id") in ctx.folder_subtree_ids`:
```python
async def _handle_glob(args: dict, ctx: ToolContext) -> ToolResult:
    result = await glob_path(args.get("pattern", ""), ctx.current_user["id"], ctx.supabase)
    # Scope glob results to folder subtree if thread is folder-scoped
    if ctx.folder_subtree_ids is not None and "matches" in result:
        result["matches"] = [
            m for m in result["matches"]
            if m.get("folder_id") in ctx.folder_subtree_ids
        ]
        result["total"] = len(result["matches"])
    return ToolResult(result=json.dumps(result))
```

**The handler being modified** (`:165-172`) — scope is ALREADY server-bound from `ctx`, never from `args` (the "can't widen" guarantee is already true; 098 only adds the post-query assert AFTER this call):
```python
async def _handle_search_documents(args: dict, ctx: ToolContext) -> ToolResult:
    metadata_filter = args.get("metadata_filter") or None
    results, avg_sim = await search_documents(
        args["query"], ctx.current_user["id"], ctx.supabase,
        metadata_filter=metadata_filter,
        user_settings=ctx.user_settings,
        folder_ids=ctx.folder_subtree_ids,     # scope is server-bound, NOT from args
    )
    # 098 lands the ⊆ clip + emit HERE (after this line, before building source_refs)
```

**The emit channel already on `ctx`** — `ToolContext` (`:59-106`) carries `emit: Callable[..., Awaitable[None]]` (`:71`, the `_emit` ref), `redis` (`:62`), `run_id` (`:63`). The `_handle_search_documents` already uses the sibling fire-and-forget pattern `ctx.spawn(write_audit_entry(...))` at `:204-209` — mirror its shape for the emit.

**Pattern to replicate (RESEARCH §3, D-05a/D-06):** after `results, avg_sim = await search_documents(...)`:
```python
if ctx.folder_subtree_ids is not None:            # D-05a gate → Deep (None) = literal no-op
    _scope = set(map(str, ctx.folder_subtree_ids))  # Pitfall 1: set()-ify LOCALLY only
    _kept = [h for h in (results or []) if h.get("folder_id") in _scope]
    _dropped = [h for h in (results or []) if h.get("folder_id") not in _scope]
    if _dropped:                                   # RPC p_folder_ids means ~always empty
        results = _kept
        await ctx.emit(ctx.redis, ctx.run_id, "scope_violation",
                       dropped=len(_dropped), query=args["query"], ...)
```

**Whitelist gate to PRESERVE (D-13, no regression):** `dispatch_tool` (`:1608-1630`) already provides act/export separability via `ctx.phase_whitelist` — `None` = Deep no-op; a non-whitelisted tool returns a clean refusal envelope. 098 adds ZERO changes here, only a UAT row asserting an act/export tool excluded from a read-only phase's whitelist is refused.

---

### `backend/app/services/retrieval_service.py` (service, CRUD-read) — MODIFIED

**Analog (same fn):** `_enrich_with_filenames` — its conditional `if doc.get("metadata"): entry["metadata"] = ...` is the EXACT precedent for additively adding `folder_id` to the enriched dict (A4: additive keys are safe; Deep consumers read by key).

**`read_first`:** `retrieval_service.py:25-79` (`_vector_search` + `_keyword_search` — confirm `p_folder_ids` flow, do NOT touch), `:113-137` (`_enrich_with_filenames`), `:244-252` (`search_documents` signature — do NOT change the return shape).

**The dict-build to extend** (`:117-136`) — add `folder_id` to BOTH the SELECT and the entry dict (currently the SELECT is `id, filename, metadata, version_number`; the dict has no `folder_id`):
```python
docs_result = await aexec(
    supabase.table("documents")
    .select("id, filename, metadata, version_number")   # ← add folder_id
    .in_("id", doc_ids)
)
doc_map = {doc["id"]: doc for doc in (docs_result.data or [])}
enriched = []
for row in rows:
    doc = doc_map.get(row["document_id"], {})
    entry: dict = {
        "content": row["content"],
        "document_id": row["document_id"],
        "filename": doc.get("filename", "Unknown"),
        "chunk_index": row.get("chunk_index"),
        "similarity": row.get("similarity") or row.get("rrf_score") or row.get("rank") or 0.0,
        "version_number": doc.get("version_number", 1),
    }                                                    # ← add entry["folder_id"] = doc.get("folder_id")
    if doc.get("metadata"):                              # ← THIS conditional-add is the analog pattern
        entry["metadata"] = doc["metadata"]
    enriched.append(entry)
```

**Anti-pattern (RESEARCH §3):** do NOT put the clip/assert in `search_documents` (it is shared with Deep and has no `ctx`/emit channel). `search_documents` only gains the `folder_id` enrich key — which is inert for Deep (Deep never reads it). The clip lives in `_handle_search_documents` (above). The `folder_ids` param already threads through `_vector_search:53-54` / `_keyword_search:75-76` → RPC `p_folder_ids` — leave that untouched.

---

### `backend/app/services/harness/phase_types.py` (service, transform) — MODIFIED

**Analog (same fn):** `_build_phase_tool_context` — line `:186` already copies the harness ctx's scope into the per-phase `ToolContext`. It receives `phase`, so per-phase `folder_scope` narrowing belongs exactly here.

**`read_first`:** `phase_types.py:151-201` (`_build_phase_tool_context`).

**The seam to modify** (`:186`, inside the `ToolContext(...)` construction at `:178-201`):
```python
return ToolContext(
    redis=getattr(ctx, "redis", None),
    run_id=_producer_id,
    # ...
    folder_subtree_ids=getattr(ctx, "folder_subtree_ids", None),   # ← :186, the narrowing seam
    # ...
    phase_whitelist=frozenset(phase.config.available_tools),       # :196 — the sibling per-phase pattern
)
```

**Pattern to replicate (RESEARCH Pattern 3, PROJ-02 narrow-only ∩):** read `phase.config.folder_scope` via `getattr` (it's None on non-retrieval phases / unbound workflows) and intersect with the resolved project subtree. Keep it a **list** (Pitfall 1):
```python
_proj = getattr(ctx, "folder_subtree_ids", None)
_phase_scope = getattr(phase.config, "folder_scope", None)
_effective = (
    [f for f in _proj if f in set(map(str, _phase_scope))]
    if _proj is not None and _phase_scope else _proj
)
# ... folder_subtree_ids=_effective
```
Note the `getattr(..., default)` idiom is the house style throughout this fn (`:179-200`) — every field is `getattr(ctx, "x", None)`. This intersection is DEFENSIVE; the narrow-only ⊆ *validity* is enforced upstream by the validator (see `scope.py`).

---

### `backend/app/api/threads.py` (controller, ctx-build site 1 — live kickoff) — MODIFIED

**Analog (same block):** the F5 scope block + inline `_wf_get_subtree` (`:1184-1288`) and the kickoff definition parse (`:835-863`). 098 changes the SOURCE of the scope from the thread folder to the workflow's `project_folder_id`.

**`read_first`:** `threads.py:835-863` (kickoff parse — `_kickoff_definition` available from `:862`), `:1184-1288` (F5 block: `_wf_get_subtree` + `wf_ctx` construction).

**The current SOURCE (thread folder)** that 098 replaces (`:1192-1219`):
```python
_wf_thread_data = await aexec(
    supabase.table("threads").select("folder_id").eq("id", thread_id).single()
)
_wf_thread_folder_id = (_wf_thread_data.data.get("folder_id") if _wf_thread_data.data else None)
if _wf_thread_folder_id:
    _wf_all_folders = await fetch_visible_folders(supabase, current_user["id"])

    def _wf_get_subtree(root_id, folders):          # ← the BFS walk to EXTRACT into scope.py
        result = [root_id]
        for f in folders:
            if f["parent_id"] == root_id:
                result.extend(_wf_get_subtree(f["id"], folders))
        return result

    _wf_folder_subtree_ids = _wf_get_subtree(_wf_thread_folder_id, _wf_all_folders)
```

**The kickoff parse where `project_folder_id` becomes available** (`:858-863`):
```python
from app.models.harness import WorkflowDefinition
_raw_def = _def_row["definition"]
if isinstance(_raw_def, str):
    _raw_def = json.loads(_raw_def)
_kickoff_definition = WorkflowDefinition.model_validate(_raw_def)   # ← _kickoff_definition.project_folder_id from here
```

**Pattern to replicate:** when `_kickoff_definition.project_folder_id is not None`, resolve the subtree FROM IT (via the new `resolve_project_subtree` in `scope.py`) instead of `_wf_thread_folder_id`, and bind it onto `wf_ctx.folder_subtree_ids` (`:1278`). **G-5 RED LINE:** `threads.py` is on the hot-file ledger (extraction due) — do NOT grow inline logic here; CALL `scope.py`'s helper (replace the inline `_wf_get_subtree` with the import). Keep the best-effort try/except fallback-to-unscoped shape (`:1233-1239`) so a resolution failure never aborts the run.

**IDOR (V4, must not regress):** the kickoff fetch is RLS-mirrored `.or_(f"is_global.eq.true,created_by.eq.{current_user['id']}")` (`:844`) + published check (`:853`). Preserve it.

---

### `backend/app/services/harness_engine.py` (service, ctx-build sites 2 & 3 — resume + Continue) — MODIFIED

**Analog (same builders):** `_build_resume_context` (`:1073-1203`) and `_load_run_definition` (`:1048-1070`). **This is the resume-scope GAP (Pitfall 3 / RESEARCH §2):** `_build_resume_context` HARD-CODES `folder_subtree_ids=None` (`:1199`) — a resumed bound workflow currently runs whole-KB UNSCOPED.

**`read_first`:** `harness_engine.py:1048-1070` (`_load_run_definition` — loads the definition the resume can read `project_folder_id` from), `:1073-1203` (`_build_resume_context`).

**The gap line** (`:1192-1202`):
```python
# F5 (092-07): ... Folder scope is not durably recoverable from the run on
# resume → None (unscoped search, acceptable per the gap-plan).
supabase=_service_supabase,
folder_subtree_ids=None,        # ← :1199 — 098 MUST resolve from the run's definition here
scoped_folder_path=None,
spawn=_resume_spawn,
```

**Pattern to replicate:** in `_build_resume_context`, load the run's definition (`_load_run_definition(pool, run["run_id"])` — same `WorkflowDefinition.model_validate` path it already uses) and, when `definition.project_folder_id is not None`, resolve via `resolve_project_subtree(...)` and set `folder_subtree_ids=<subtree>` instead of `None`. **Critical security note (already documented at `:1118-1123`):** the resume path uses the SERVICE-ROLE client which bypasses RLS, so retrieval MUST stay owner-scoped — pass `run["user_id"]` (the durable run owner, already used at `:1185-1187`) as the resolver's `user_id`. The 3rd site (Continue / `_harness_continuation`, referenced `:333`) is the same family — apply the same resolution (A3: not read line-by-line; planner verifies the exact site).

---

### `backend/app/db/workflows.py` (data layer, CRUD-read) — MODIFIED

**Analog (same fn):** `list_published_workflows` (`:130-150`) — asyncpg `$N` placeholders, RLS-mirroring WHERE. Add an optional `project_folder_id` param via a JSONB-path predicate (NO migration — `definition` is JSONB).

**`read_first`:** `db/workflows.py:30-54` (imports + `_AUDIT_EVENT_TYPES` — see anti-pattern note), `:130-150` (`list_published_workflows`).

**The query to extend** (`:140-149`):
```python
rows = await pool.fetch(
    """
    SELECT id, slug, name
    FROM workflow_definitions
    WHERE status = 'published'
      AND (is_global = true OR created_by = $1)
    ORDER BY name
    """,
    user_id,
)
```

**Pattern to replicate (RESEARCH §5):** add `project_folder_id: UUID | None = None` kwarg; when provided, append `AND definition->>'project_folder_id' = $2` (bound as text — `definition->>'key'` returns text, so pass `str(project_folder_id)`). No new column, no index needed at current scale (A1).

**Anti-pattern (do NOT trip):** `_AUDIT_EVENT_TYPES` (`:42-54`) is a 9-kind frozenset mirroring the `harness_audit` CHECK (migration 059). Do NOT add `scope_violation` here — D-06's seam is the Redis run-event channel, NOT `harness_audit` (adding it would require a CHECK-extending migration).

---

### `backend/app/api/workflows.py` (route, request-response) — MODIFIED

**Analog (same route):** `get_published_workflows` (`:38-53`) — the whole 53-line file is the template.

**`read_first`:** `backend/app/api/workflows.py:1-53` (whole file).

**The route to extend** (`:38-53`):
```python
@router.get("/published", response_model=list[PublishedWorkflow])
async def get_published_workflows(
    current_user: dict = Depends(get_current_user),
) -> list[PublishedWorkflow]:
    pool = await get_pg_pool()
    user_id = current_user["id"]
    rows = await list_published_workflows(
        pool,
        user_id=UUID(user_id) if isinstance(user_id, str) else user_id,
    )
    return [PublishedWorkflow(**r) for r in rows]
```

**Pattern to replicate (D-03):** add `project_folder_id: UUID | None = Query(None)` (import `Query` from fastapi) and thread it through to `list_published_workflows(..., project_folder_id=project_folder_id)`. Pure read; preserve the owner-scoping (it lives in the db-layer WHERE).

---

### `backend/app/services/harness/scope.py` (utility, transform) — NET-NEW

**Analog (BFS walk to centralize):** three inline copies of the same `parent_id` subtree walk exist — `_get_subtree` (`agent_loop.py:982-989`, the Deep RED LINE — read but DON'T modify), `_wf_get_subtree` (`threads.py:1210-1218`), and the BFS in `_collect_folder_ids` (`kb.py:185-193`). The flat-list `parent_id` walk is the right reuse target (NOT `_collect_folder_ids`, which needs a pre-nested tree — RESEARCH §2 caveat).

**`read_first`:** `agent_loop.py:982-989` (`_get_subtree` — the canonical recursive walk), `kb.py:185-193` (`_collect_folder_ids` — note the input-shape mismatch), `harness_engine.py:1118-1123` (the owner-scoping security note the resolver must honor).

**The canonical walk to extract** (`agent_loop.py:982-989` — RED LINE reference, byte-identical, do not touch this copy):
```python
def _get_subtree(root_id: str, folders: list[dict]) -> list[str]:
    result = [root_id]
    for f in folders:
        if f["parent_id"] == root_id:
            result.extend(_get_subtree(f["id"], folders))
    return result

folder_subtree_ids = _get_subtree(thread_folder_id, all_folders)
```

**Pattern to replicate:** two functions called by all three ctx-build sites:
1. `resolve_project_subtree(project_folder_id, *, supabase, user_id) -> list[str] | None` — `None` in → `None` out (unbound workflow). Internally: `fetch_visible_folders(supabase, user_id)` then the `parent_id` walk above. Returns a **`list[str]`** (Pitfall 1). This closes the resume gap and de-triplicates the walk.
2. `assert_folder_scopes_subset(definition, *, supabase, user_id)` — the DB-dependent ⊆ check (D-07). Resolves the project subtree, asserts every phase `folder_scope ⊆ subtree`, raises `ValueError`/400 on a non-⊆ phase scope (a DEFINITION-VALIDITY error, NOT a runtime clip). Called at run-start right after the kickoff parse (`threads.py:862`) and in the resume/Continue builders; Phase 103 later calls the SAME fn at definition-save.

**Pitfall 5 (do NOT conflate):** D-07 (a DECLARED phase scope ⊄ subtree → hard validation error, this file) is a DIFFERENT failure class from D-06 (a RETRIEVED row outside scope → clip+warn, `tool_dispatcher.py`). Keep them in separate mechanisms.

---

### `backend/tests/test_098_schema_lock.py` (test, round-trip) — NET-NEW

**Analog:** `test_harness_templates.py` — `model_validate` round-trip (`:46-65`) + the migration-061-JSONB parse helper (`:28-43`, the "old row" fixture source). Plus conftest `build_workflow_definition` / `four_seed_defs` fixtures.

**`read_first`:** `backend/tests/test_harness_templates.py:1-65`, `backend/tests/conftest.py:688-839` (`build_workflow_definition` + `four_seed_defs`).

**The round-trip + old-row patterns to replicate:**
```python
# Old-row fixture: parse the seeded-template JSONB straight out of migration 061/065
def _extract_migration_definitions() -> list[dict]:
    sql = _MIGRATION_061.read_text(encoding="utf-8")
    blobs = re.findall(r"'((?:[^']|'')*)'::jsonb", sql, flags=re.DOTALL)
    return [json.loads(b.replace("''", "'")) for b in blobs]

# Round-trip: model_validate succeeds + status/phases intact
def test_each_seed_parses_via_model_validate(four_seed_defs):
    for wf in four_seed_defs():
        assert isinstance(wf, WorkflowDefinition)
```

**Tests to author (RESEARCH Test Map SC#1):**
- `test_old_rows_validate` — the migration-061/065 JSONB (lacking the new keys) `model_validate()`s clean, new fields default (`project_folder_id is None`, `provenance == "source"`).
- `test_new_fields_roundtrip` — a definition WITH the new fields survives `model_dump(mode="json")` → `model_validate` (use `mode="json"` so `UUID`→str — Pitfall 2 on write).

---

### `backend/tests/test_098_scope_governance.py` (test, request-response + event capture) — NET-NEW

**Analog:** `test_harness_whitelist.py` (the full file — Deep-no-op assertion, refusal-envelope, fire-and-forget spawn capture) + conftest's `make_tool_context` (`:620-666`) and `fake_redis` (`:551-617`, the XADD recorder).

**`read_first`:** `backend/tests/test_harness_whitelist.py:1-139`, `backend/tests/conftest.py:551-666` (`_FakeRedis.xadds` + `make_tool_context` factory).

**The fake-ctx + Deep-no-op patterns to replicate** (from `test_harness_whitelist.py:82-100`):
```python
async def test_deep_mode_none_is_noop(make_tool_context, monkeypatch):
    ctx = make_tool_context(phase_whitelist=None)   # ← for 098: folder_subtree_ids=None
    result = await dispatch_tool("execute_code", {}, ctx)
    assert called.get("hit") is True   # guard never fired
```

**The XADD-capture mechanism** (conftest `_FakeRedis`, `:585-589`) — `fake_redis.xadds` is a list of `(stream, decoded_fields)`; the `scope_violation` emit test asserts against it:
```python
async def xadd(self, stream, fields, *args, **kwargs):
    decoded = self._decode_fields(fields)
    self.xadds.append((stream, decoded))   # ← test asserts run:{run_id} + {"type":"scope_violation",...}
```

**Tests to author (RESEARCH Test Map SC#2/3/4):**
- `test_per_phase_narrowing` — `_build_phase_tool_context` ∩ (project subtree narrowed by phase `folder_scope`).
- `test_deep_noop` — `folder_subtree_ids=None` → `_handle_search_documents` clip block skipped, no XADD (D-05a).
- `test_clip_and_emit` — **INJECT an out-of-scope row** into the mocked `search_documents` return (Pitfall 4: the RPC primary filter means a live run NEVER naturally emits one), assert the row is dropped AND `("run:<id>", {"type":"scope_violation",...})` lands in `fake_redis.xadds`. Use `make_tool_context(folder_subtree_ids=[...], emit=<real _emit bound to fake_redis>)` — note `make_tool_context`'s default `emit` is a `_noop_emit`, so override it to capture, or assert via the redis recorder.
- `test_narrow_only_reject` — `assert_folder_scopes_subset` raises on a phase `folder_scope ⊄ subtree` (D-07).

---

### `supabase/migrations/067_*.sql` (migration, DDL) — CONDITIONAL / likely NOT needed

**No analog needed — RESEARCH §6 strongly recommends ZERO migration.** `workflow_definitions.definition` is a single `jsonb` column (`full-schema.sql:701`); the entire schema lock is Pydantic-only, and the library filter runs as a JSONB-path predicate (`definition->>'project_folder_id'`). A migration is ONLY needed if the operator explicitly wants (a) an expression index for the filter, or (b) a durable `harness_audit` `scope_violation` row (CHECK extension). If taken, next free number = **067** (latest = `066_eval_coverage_seed.sql`), apply via SQL editor (NEVER `db push`/`reset` — human action, `autonomous: false`), then `bash scripts/regenerate-full-schema.sh` (no reset), commit both. See `db/workflows.py` analog above for the JSONB-path filter that avoids this entirely.

---

## Shared Patterns

### The server-side scope channel (already wired end-to-end — 098 changes its SOURCE)
**Source chain:** `ToolContext.folder_subtree_ids` (`tool_dispatcher.py:69`) → `_handle_search_documents` binds `folder_ids=ctx.folder_subtree_ids` (`:171`) → `search_documents(..., folder_ids=)` (`retrieval_service.py:251`) → `_vector_search`/`_keyword_search` set `params["p_folder_ids"]` (`:53-54`, `:75-76`) → RPC `match_document_chunks`/`keyword_search_chunks` `WHERE ... (p_folder_ids IS NULL OR d.folder_id = ANY(p_folder_ids))` (`full-schema.sql:133`/`:109`).
**Apply to:** all three ctx-build sites + `phase_types.py`. 098 sources the subtree from the workflow's `project_folder_id` (+ per-phase `folder_scope`) instead of the thread folder; the channel itself is untouched.

### The Deep-no-op gate (D-05a RED LINE)
**Source:** `_handle_glob` (`tool_dispatcher.py:145`) `if ctx.folder_subtree_ids is not None:` — the literal-no-op-when-None idiom, mirrored by `dispatch_tool`'s `if ctx.phase_whitelist is not None:` (`:1615`).
**Apply to:** the new ⊆ clip in `_handle_search_documents`. When `folder_subtree_ids is None` (Deep), the entire block is skipped → byte-identical.

### The run-event / observability seam (D-06)
**Source:** `_emit(redis, run_id, type, **fields)` (`threads.py:144-158`) — one canonical `XADD run:{run_id} {"data": json.dumps({"type": type, **fields})}`, MAXLEN ~10000. Carried on `ToolContext.emit`/`redis`/`run_id`; on the harness path `_build_phase_tool_context` sets `run_id=_producer_id` (`phase_types.py:180`) so events route to the producer stream the frontend watches.
**Apply to:** the `scope_violation` emit. Existing event-kind vocabulary for naming consistency: `skill_activated`, `sub_agent_start/done`, `code_execution_complete`, `ask_user_prompt`, `tool_refused` (planner names the final string).

### Fire-and-forget side-effect (audit/emit) without blocking the handler
**Source:** `_handle_search_documents` already does `ctx.spawn(write_audit_entry(...))` (`:204-209`); `dispatch_tool`'s `_spawn_tool_refused_audit` (`:1617`) wraps it in best-effort try/except.
**Apply to:** the `scope_violation` emit if made fire-and-forget (or `await ctx.emit(...)` directly — it's a fast XADD). Never let an emit failure turn a clean retrieval into an exception.

### Additive-optional on `extra="forbid"` (zero-migration immutability)
**Source:** every model in `harness.py` (`_StrictBase` at `:26-29`). Old JSONB rows lack new keys → defaults fill → `model_validate()` succeeds.
**Apply to:** all new `WorkflowDefinition` + phase-config fields. This IS SC#1 ("old rows still validate").

### Test substrate (offline, pure-Python)
**Source:** conftest `make_tool_context` (`:620-666`), `fake_redis._FakeRedis` (XADD recorder, `:551-617`), `build_workflow_definition`/`four_seed_defs` (`:688-839`), `mock_asyncpg_pool` (`:506-513`).
**Apply to:** both 098 test files. No live Redis/Postgres needed for the unit core (the schema lock + ⊆ logic run on fakes). Integration/UAT use the operator's running stack.

---

## No Analog Found

None. Every file has an in-tree analog (this is additive-on-existing work). The one item without a code analog is the **optional `067` migration**, which RESEARCH recommends NOT creating (zero-migration path).

---

## Metadata

**Analog search scope:** `backend/app/models/`, `backend/app/services/` (+ `harness/`), `backend/app/api/`, `backend/app/db/`, `backend/tests/`, `supabase/migrations/`, `supabase/full-schema.sql` (via RESEARCH-verified line refs).
**Files scanned (read this session):** `harness.py`, `tool_dispatcher.py`, `retrieval_service.py`, `phase_types.py`, `threads.py` (4 ranges), `agent_loop.py`, `kb.py`, `harness_engine.py`, `db/workflows.py`, `api/workflows.py`, `tests/conftest.py`, `tests/test_harness_whitelist.py`, `tests/test_harness_templates.py`.
**Line numbers:** verified against current files this session (consistent with RESEARCH 2026-06-09).
**Pattern extraction date:** 2026-06-09
