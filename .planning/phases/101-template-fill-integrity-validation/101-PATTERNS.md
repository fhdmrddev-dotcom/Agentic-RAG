# Phase 101: Template-Fill + Integrity Validation - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 11 (4 new + 7 modified)
**Analogs found:** 11 / 11 (every new/modified file has a concrete production or spike analog)

> **The phase is a PORT, not a re-derivation.** The 097 spike (`scripts/spike-097/`) is the
> behavioral blueprint for the two new render/field-map modules; the freshest *production*
> analogs are the 099 gated-tool pattern (`tool_dispatcher.py` + `phase_types.py`) and the
> Phase 100 template_service. Anchor every new file on those.
>
> **THE RED LINE (D-15 / CONTEXT code_context):** Deep-mode chat + all existing workspace/agent
> behavior stay **byte-identical**. Every new path is a literal no-op when no template/fill is
> involved. The mechanism is already proven twice: 098 `folder_subtree_ids is not None` gate
> (`tool_dispatcher.py:187`) and 099 `skill_snapshot is not None` gate
> (`tool_dispatcher.py:478`, `phase_whitelist is None` in Deep → `dispatch_tool:1677` skipped).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/tool_dispatcher.py` (NEW `_handle_render_template` + registry line) | tool-handler | request-response → file-I/O | `_handle_read_skill_file` (`:472`) + `_handle_execute_code` (`:531`) + `_handle_workspace_write` (`:1007`) | exact (3 complementary analogs, same module) |
| `backend/app/services/template_render_service.py` (NEW, deterministic core) | service / utility | transform (data → bytes, pure) | `scripts/spike-097/render_docx.py` + `field_map.py` (port) | exact (spike mirrors prod shape) |
| (render driver script, shipped INTO sandbox — lives in `template_render_service.py` or a sibling const) | utility | transform / file-I/O | `render_docx.render` (`:105`) + `assert_integrity` (`:156`) + `_handle_execute_code` copy_to_runtime (`:634`) | exact |
| (field-map Pydantic models + coverage check — part of `template_render_service.py`) | model + utility | transform / validation | `field_map.Cited`/`RiskRow` (`:44-69`) + `derive_fields.check_coverage` (`:112`) | exact |
| `backend/app/services/harness/phase_types.py` (`_effective_tools`/`_build_phase_tool_context`) | service (orchestration) | event-driven (phase dispatch) | `_effective_tools` (`:177`) + `_build_phase_tool_context` (`:198`) — the 099 pattern verbatim | exact (extend in place) |
| `backend/app/services/sandbox_service.py` (`get_or_create` / `SANDBOX_IMAGE` seam) | service (substrate) | file-I/O (Docker exec) | `get_or_create` (`:25`) + `harvest_output_files` (`:201`) | exact (reuse, no new method strictly needed) |
| `backend/app/models/harness.py` (~151-189 co-lock comment + `AssetRef`) | model / config | n/a (schema shape) | `AssetRef` (`:167`) + `WorkflowDefinition.assets` (`:188`) — already locked | exact (comment-pointer update only; NO migration) |
| `backend/app/services/template_service.py` (`kind='template_input'` resolution) | service | CRUD (Storage + DB) | `pin_templates_for_run` (`:90`) + `get_storage_paths_for_file` reuse (`:28`) | role-match (consume the existing resolution) |
| `backend/app/services/workspace_service.py` (`write_file` + SSE) | service | CRUD / file-I/O | `write_file` (`:215`) — reuse verbatim; SSE via `_handle_workspace_write` | exact (reuse, do not modify) |
| `backend/app/db/workspace.py` (`get_storage_paths_for_file`) | db / repository | CRUD (read) | `get_storage_paths_for_file` (`:265`) + `_read_from_storage` (`workspace_service.py:141`) | exact (reuse for AssetRef byte fetch) |
| `backend/Dockerfile.sandbox` (`docxtpl==0.20.2` + tag bump) | config / build | n/a (build artifact) | the existing `RUN pip install` block (`:37-49`) | exact |
| `backend/tests/unit/test_template_render.py` + `test_template_integrity.py` (NEW) | test | n/a | `backend/tests/test_workspace_template.py` (Phase 100 cross-plan TDD contract) | exact |

---

## Pattern Assignments

### `backend/app/services/tool_dispatcher.py` — NEW `_handle_render_template` (tool-handler, request-response → file-I/O)

**Three complementary analogs in the SAME module** — combine them: the **G-5 extension contract**
(docstring), the **gated-branch byte-identical pattern** (`_handle_read_skill_file`), the
**sandbox substrate** (`_handle_execute_code`), and the **deliverable-persist + SSE**
(`_handle_workspace_write`).

**The G-5 extension contract — a new tool is a handler + ONE registry line** (`:8-11` docstring, `:1608` registry):
```python
# tool_dispatcher.py:8-11 (module docstring — the documented contract)
# Adding a new tool requires only:
#   1. Write an async _handle_<name>(args, ctx) -> ToolResult
#   2. Register it in _TOOL_REGISTRY
#   3. threads.py is untouched.            <-- the G-5 RED LINE compliance (threads.py is a 9+ hot file)
```
```python
# tool_dispatcher.py:1608 — add ONE line to the closed registry dict:
_TOOL_REGISTRY: dict[str, Callable] = {
    ...
    "ask_user": _handle_ask_user,
    "render_template": _handle_render_template,   # NEW (101)
}
```

**Gated-branch byte-identical pattern — COPY this `_handle_read_skill_file` shape** (`:472-492`):
```python
# tool_dispatcher.py:472 — the 099 analog. render_template's no-template path must mirror this:
async def _handle_read_skill_file(args: dict, ctx: ToolContext) -> ToolResult:
    filename = args.get("filename", "")
    # 099 D-04 GATE (mirrors the 098 search-scope gate at :187) — when a workflow
    # phase carries a materialized skill snapshot, read from the IMMUTABLE snapshot
    # copies, NOT the live skill. None (Deep mode + non-skill phases) => this branch
    # is skipped and the live path below runs BYTE-IDENTICAL (SC#3 red line / Pitfall 4).
    snapshot = getattr(ctx, "skill_snapshot", None)
    if snapshot is not None:
        ...
```
> **For 101:** the provenance gate (D-02) is the analog of this `snapshot is not None` check.
> `render_template` resolves the engine from the template's provenance — `AssetRef` (library) →
> `docxtpl`/Jinja; `kind='template_input'` (ephemeral upload) → run-replace. There is no
> "Deep widening" risk because `render_template` is *only* dispatched when the model calls it
> with a field-map argument; when Deep never calls it, it is inert. Return errors as
> `ToolResult(result=json.dumps({"error": ...}))` (run-honesty, D-08/D-10) — mirror `:481-483`.

**Sandbox substrate — COPY the `_handle_execute_code` session + copy_to_runtime shape** (`:531-665`):
```python
# tool_dispatcher.py:554 — get the per-thread cached session (D-13 swappable seam):
session = sandbox_manager.get_or_create(ctx.thread_id)
...
# tool_dispatcher.py:573 — ensure the output dir exists:
session.execute_command("mkdir -p /sandbox/output")
...
# tool_dispatcher.py:627-634 — write the render driver to a temp file, ship it in:
code_file = f"/tmp/run-{_uuid_mod.uuid4().hex}.py"
with _tempfile_local.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".py", delete=False) as _tmp_fp:
    _tmp_fp.write(wrapped_code)
    _local_tmp_path = _tmp_fp.name
session.copy_to_runtime(_local_tmp_path, code_file)
...
# tool_dispatcher.py:654 — execute it in the sealed container:
exec_result = session.execute_command(f"python -u {code_file}", on_stdout=..., on_stderr=...)
```
> **For 101 (Pitfall 4 — render runs in the SANDBOX, never the backend venv):** ship the template
> bytes + field-map JSON + the pinned render driver via `copy_to_runtime`, execute, then harvest
> the produced file + verdict. The backend venv has NO `docxtpl` — only the sandbox image does
> after the tag bump. Do NOT `import docxtpl` anywhere in `backend/app/**`.

**Deliverable-persist + the reuse-the-SSE pattern — COPY `_handle_workspace_write`** (`:1007-1034`):
```python
# tool_dispatcher.py:1007 — persist the produced deliverable + reuse the EXISTING event (lean: reuse, CONTEXT discretion):
async def _handle_workspace_write(args: dict, ctx: ToolContext) -> ToolResult:
    ...
    result = await ws_write_file(ctx.pool, ctx.supabase, thread_id=..., user_id=..., path=path, content=content)
    await ctx.emit(
        ctx.redis, ctx.run_id, 'workspace_file_written',
        # 088-05 (D-16): emit the persisted row id so the live panel can fetch by id (no reload).
        id=result["file_id"], path=result["path"], version=result["version"],
        size_bytes=result["size_bytes"], mime_type=result["mime_type"],
    )
```
> **For 101:** only call `write_file` + emit `workspace_file_written` when BOTH gates pass
> (verdict.rendered AND verdict.opened). On integrity failure, do NOT write the file — return an
> honest error naming the integrity failure and preserve the cited field-map as fallback (D-08).
> Reusing `workspace_file_written` means OutputFileCard renders the deliverable in the panel for
> free (no new UI — G-2 satisfied unless the integrity-fail-with-data-fallback state proves novel).

**Dispatch backstop (DO NOT touch — it already gates correctly)** (`:1677`):
```python
# tool_dispatcher.py:1677 — phase_whitelist is None in Deep Mode -> skipped -> byte-identical.
if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
    ...  # the refusal is a normal ToolResult.result string — NO provider branch ever touched
```

---

### `backend/app/services/template_render_service.py` — NEW deterministic core (service/utility, transform)

**Analog:** `scripts/spike-097/render_docx.py` + `field_map.py` + `derive_fields.check_coverage` — **port these.**

**The cited field-map Pydantic models — PORT verbatim, then generalize** (`field_map.py:44-69`):
```python
# scripts/spike-097/field_map.py:44 — every leaf nullable + source_chunk_id provenance (D-03):
class Cited(BaseModel):
    """A single filled value with provenance. value=None means 'not found in KB'."""
    value: str | None = Field(None, description="The value, or null if the KB does not support it.")
    source_chunk_id: str | None = Field(None, description="the <doc id=...> spotlight id this value came from.")
    source_doc: str | None = Field(None, description="filename of the source document.")
    source_page: int | None = Field(None, description="page/chunk_index if known.")
```
> **Generalize for prod (RESEARCH Code Examples):** the spike's `RiskRegisterFieldMap` is
> risk-specific. Production needs a GENERIC shape DERIVED from the template's placeholder keys
> (`DocxTemplate(path).get_undeclared_template_variables()` — the coverage oracle,
> `derive_fields.py:211`). Generic shape: `scalars: dict[str, Cited]` + `collections: dict[str, list[dict[str, Cited]]]`.
> CLAUDE.md mandates Pydantic for structured LLM outputs (no LangChain).

**The render body — PORT `render()` exactly** (`render_docx.py:105-128`):
```python
# scripts/spike-097/render_docx.py:105 — the golden rule (LLM produces DATA, this produces FILE):
def render(template_path: str, context: dict, out_path: str) -> dict:
    doc = DocxTemplate(template_path)
    jenv = SandboxedEnvironment(autoescape=True)   # SSTI containment + XML-safe (&<>) — TMPL-03, mandatory
    try:
        doc.render(context, jinja_env=jenv)        # docxtpl owns the bytes; the LLM never does
    except TemplateSyntaxError as exc:             # Pitfall 4 — tag spans a structural boundary
        return {"rendered": False, "error": f"TemplateSyntaxError: {exc}"}
    doc.save(out_path)
    return {"rendered": True, "error": None}
```
> **`SandboxedEnvironment(autoescape=True)` is mandatory regardless of provenance** (D-02 / D-12 /
> TMPL-03). It is defense-in-depth on the trusted path; the untrusted upload NEVER reaches this
> Jinja engine at all (provenance routing makes SSTI structurally impossible for uploads).

**The integrity re-open + residual-tag scan — PORT `assert_integrity` + `residual_tags`** (`render_docx.py:144-174`):
```python
# scripts/spike-097/render_docx.py:144 — residual scan = the deterministic silent-miss detector:
def residual_tags(doc: Document) -> list[str]:
    hits: list[str] = []
    for txt in _all_text(doc):
        if any(tok in txt for tok in ("{{", "}}", "{%", "%}")):
            hits.append(txt.strip()[:80])
    return hits

# scripts/spike-097/render_docx.py:156 — re-open with the SAME library = the "will it open" oracle (TMPL-03):
def assert_integrity(out_path: str, expect_min_rows: int) -> dict:
    doc = Document(out_path)                        # raises if corrupt / won't open
    ...
    return {"opened": True, "tables": ..., "rows": ..., "rows_ok": ..., "residual_tags": residuals, "residual_clean": len(residuals) == 0}
```
> **For 101:** integrity re-open ALWAYS runs on all three formats (D-06): docx → `Document(path)`,
> pptx → `Presentation(path)`, xlsx → `load_workbook(path)`. A non-opening file is NEVER delivered.
> Add a `documented_limit` verdict field for pptx-table-growth / xlsx-chart-strip (D-06 "no silent caps").

**The deterministic coverage + citation check — PORT `check_coverage` (NEVER a 2nd LLM call)** (`derive_fields.py:112-170`):
```python
# scripts/spike-097/derive_fields.py:112 — pure-Python gate, the BEFORE-render reject (D-08 class 1):
def check_coverage(fm_dict, retrieved_ids, placeholder_keys) -> dict:
    """A non-null value is CITED iff its source_chunk_id was actually in the retrieved set
    (an invented/absent citation = uncited)."""
    ...
    for location, fname, cited in _iter_leaves(fm_dict):
        value = cited.get("value"); src = cited.get("source_chunk_id")
        if value is None: null_leaves += 1; continue
        if src is None: uncited_value_count += 1          # Pitfall 6
        elif src not in retrieved_ids: invented_citation_count += 1   # T-097-07 spoofed citation
        else: cited_leaves += 1
    ...
```

**The truncation guard — PORT the `stop_reason == max_tokens` reject** (`derive_fields.py:267-272`):
```python
# scripts/spike-097/derive_fields.py:267 — never accept a truncated empty rows[] as "no risks found":
if meta["stop_reason"] == "max_tokens":
    # Truncated tool JSON silently drops `rows` (default_factory=list) — Pitfall 3 (DeepSeek/Moonshot).
    return 2  # reject
```

**The worded→numeric deterministic hook — PORT `_num()` (D-11, generic; VALUES are Phase 104)** (`render_docx.py:47-63`):
```python
# scripts/spike-097/render_docx.py:47 — int() when parseable, else None -> blank cell (honest degrade):
def _num(cited):
    v = (cited or {}).get("value")
    try: return int(str(v).strip())
    except (ValueError, TypeError): return None
```

> **RED LINE for the field-map EMISSION (D-14, Cond 7):** the spike called
> `anthropic.Anthropic().messages.create(tool_choice=...)` DIRECTLY (`field_map.py:176`).
> **Production must NOT mirror that.** Route the field-map emission through the UNMODIFIED shared
> gateway so all 8 providers inherit the NATIVE/STRUCTURED resolution + truncation/registry traps
> at the service boundary — the fill path NEVER branches per provider. See Shared Patterns below.

---

### `backend/app/services/harness/phase_types.py` — `_effective_tools` / `_build_phase_tool_context` (orchestration, event-driven)

**Analog:** the 099 per-phase tool whitelist — extend the EXISTING `_effective_tools` (`:177`).

**The 099 auto-whitelist pattern — `render_template` is admitted to a fill phase the SAME way** (`:177-190`):
```python
# phase_types.py:177 — 099 D-04 auto-whitelist (never DROPS a tool; only appends a registered name):
def _effective_tools(phase) -> list[str]:
    base = list(phase.config.available_tools)
    if getattr(phase.config, "skill_snapshot", None) is not None and "read_skill_file" not in base:
        base.append("read_skill_file")
    return base
```
> **For 101 (CONTEXT discretion):** a fill phase declares `render_template` in its
> `available_tools`. `_effective_tools` already returns `available_tools` unchanged when no
> snapshot — so a phase that lists `render_template` gets it admitted without any new code (the
> simplest path). If a fill phase needs auto-injection (analogous to `read_skill_file`), extend
> this helper with the SAME shape. `_effective_tools` feeds BOTH layer-1 (`apply_tool_budget` →
> the schemas the model SEES, `:355`) and layer-2 (`phase_whitelist` frozenset → the dispatch
> backstop, `:263`).

**The dispatch-context build sets the whitelist (layer 2)** (`:243-263`):
```python
# phase_types.py:243 — _build_phase_tool_context returns a ToolContext carrying:
return ToolContext(
    ...
    available_tools=_tools,            # layer 1 — what the model sees
    phase_whitelist=frozenset(_tools), # layer 2 — the dispatch backstop (dispatch_tool:1677)
    ...
)
```
> **Gated-no-op invariant:** `phase_whitelist is None` in Deep Mode → the `dispatch_tool` guard is
> skipped → byte-identical Deep. This IS the RED LINE mechanism. `render_template` is a registered
> tool, so Deep CAN call it (the "AI colleague" value, D-01), but workflow phases gate it.

---

### `backend/app/services/sandbox_service.py` — render substrate (service, file-I/O) — REUSE, no new method

**Analog:** `get_or_create` (`:25`) — the D-13 swappable seam. **Do NOT hardwire the backend.**
```python
# sandbox_service.py:25 — per-thread cached session, idle-evicted, worker-bounce re-attach:
def get_or_create(self, thread_id: str) -> object:
    from llm_sandbox import InteractiveSandboxSession  # lazy import (SANDBOX_ENABLED=false safe)
    self._evict_expired()
    if thread_id not in _sessions:
        custom_image = os.environ.get("SANDBOX_IMAGE")   # <-- the tag-bump seam (D-12)
        ...
sandbox_manager = SandboxSessionManager()   # :198 — the module singleton
```
> **D-13:** route render execution through `sandbox_manager.get_or_create` exactly like
> `_handle_execute_code` does — do NOT paint the tool into a Docker-only corner (SEED-070 monty
> selector stays open). **Runtime-state risk (RESEARCH):** `SANDBOX_IMAGE` bump only affects NEW
> chats; cached sessions keep their old image until idle eviction (`_evict_expired:187`) → a render
> in an existing chat hits a container with no `docxtpl` (`ModuleNotFoundError`). UAT MUST use
> fresh chats after the operator rebuilds + bumps the tag.

> **Harvest analog** (`:201` `harvest_output_files`): the produced file comes OUT via
> `session.copy_from_runtime("/sandbox/output", tmpdir)` then a walk. For `render_template` you may
> reuse this OR a targeted `copy_from_runtime` of the single produced file + verdict JSON.

---

### `backend/app/models/harness.py` — co-lock comment pointer + `AssetRef` (model/config) — COMMENT UPDATE ONLY, NO migration

**Analog:** the already-locked shapes (`:167`, `:188`). The schema is DONE; 101 implements the behavior.
```python
# harness.py:151-154 — the co-lock comment to UPDATE (D-09):
# `assets` (template/reference refs) in Phase 101 (the trusted-library fill path);
#   ^^^ change "in Phase 101" -> "implemented in Phase 101" (pointer update from intent to done)

# harness.py:167 — AssetRef already locked (098 zero-migration co-lock):
class AssetRef(_StrictBase):
    asset_id: str
    filename: str
    kind: Literal["template", "reference"]
    mime: str

# harness.py:188 — the field on WorkflowDefinition (old JSONB rows model_validate() to None):
assets: list[AssetRef] | None = None    # co-lock (Phase 101 behavior)  <-- update comment
```
> **No migration needed** (RESEARCH Runtime State Inventory): `AssetRef`/`assets[]` are JSONB-backed
> additive-optional fields; old rows validate to `None`. The trusted-path UAT seeds a library-asset
> fixture (a published definition with an `assets[]` entry → a Storage object).

---

### `backend/app/services/template_service.py` — `kind='template_input'` resolution (service, CRUD) — CONSUME existing

**Analog:** `pin_templates_for_run` (`:90`) + the reuse-don't-hand-roll-Storage-walk ethos (`:40-41`).
```python
# template_service.py:90 — the ephemeral-template provenance is the `kind='template_input'` row:
async def pin_templates_for_run(pool, *, thread_id, run_wall_clock_cap) -> int:
    res = await pool.execute(
        "UPDATE workspace_files SET expires_at = GREATEST(...) "
        "WHERE thread_id = $1 AND kind = 'template_input' AND expires_at IS NOT NULL", ...)
```
> **For 101 (ephemeral path resolution):** the arbitrary engine consumes the `kind='template_input'`
> file (newest-wins per 100/D-14). Read its bytes via the workspace content helpers (below). Do NOT
> hand-roll a Storage walk — `template_service` already reuses `get_storage_paths_for_file` verbatim
> (`:28`, the explicit "do NOT hand-roll" note at `:40-41`).

---

### `backend/app/services/workspace_service.py` — `write_file` + content read (service, CRUD/file-I/O) — REUSE verbatim

**Analog:** `write_file` (`:215`) — handles inline-vs-Storage threshold + versioning. **Do not modify.**
```python
# workspace_service.py:215 — the persistence path (the produced deliverable lands here):
async def write_file(pool, supabase, *, thread_id, user_id, path, content, ...) -> dict:
    """Returns dict: file_id, path, version, size_bytes, mime_type, kind, expires_at, warning."""
```
```python
# workspace_service.py:141 — the Storage byte fetch (AssetRef + ephemeral template bytes IN):
async def _read_from_storage(supabase, storage_path) -> bytes:
    return await run_in_threadpool(supabase.storage.from_(BUCKET_NAME).download, storage_path)
```
> **CLAUDE.md D-v2.5-01:** `supabase-py` Storage calls are blocking — they MUST be wrapped with
> `run_in_threadpool` inside async handlers (the helper at `:141` already does this; mirror it for
> any AssetRef byte fetch you add).

---

### `backend/app/db/workspace.py` — `get_storage_paths_for_file` (db/repository, CRUD read) — REUSE for AssetRef

**Analog:** `get_storage_paths_for_file` (`:265`) — version-aware Storage path walk.
```python
# db/workspace.py:265 — all non-null Storage paths for a file's versions (reused by template_service sweep):
async def get_storage_paths_for_file(pool, workspace_file_id: UUID) -> list[str]:
    rows = await pool.fetch("""
        SELECT content_storage_path FROM workspace_file_versions WHERE workspace_file_id = $1 AND ... IS NOT NULL
        UNION
        SELECT content_storage_path FROM workspace_files WHERE id = $1 AND ... IS NOT NULL""", workspace_file_id)
    return [r["content_storage_path"] for r in rows]
```

---

### `backend/Dockerfile.sandbox` — `docxtpl==0.20.2` add + `SANDBOX_IMAGE` tag bump (config/build)

**Analog:** the existing pinned `RUN pip install` block (`:37-49`). **The ONLY net-new dependency.**
```dockerfile
# Dockerfile.sandbox:37 — add docxtpl after reportlab (python-docx/pptx/openpyxl already present):
RUN pip install --no-cache-dir \
    python-pptx==1.0.2 \
    ...
    reportlab==4.2.5 \
    docxtpl==0.20.2 \        # NEW (101) — the trusted-path Jinja render engine
    seaborn==0.13.2 \
    ...
```
> Then `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/` and set
> `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env` (bump the tag per CLAUDE.md — the
> `:37` block already documents the "rebuild + bump SANDBOX_IMAGE; new chats only" convention for
> the reportlab add). `docxtpl==0.20.2` is the current PyPI latest (RESEARCH verified 2026-06-10).

---

### `backend/tests/unit/test_template_render.py` + `test_template_integrity.py` — NEW (test)

**Analog:** `backend/tests/test_workspace_template.py` (Phase 100 cross-plan TDD contract).
```python
# test_workspace_template.py:1-19 — the cross-plan TDD-contract structure to mirror:
#   - it is the SINGLE file the VALIDATION.md per-task map points at; each Plan's <verify>
#     runs a `-k` slice of it.
#   - RED-by-design symbol-existence stubs use xfail(strict=False) UNTIL the implementing plan
#     lands, keeping the full suite exit-0 (the 098/099 convention).
#   - imports of not-yet-created symbols live INSIDE the test body so ImportError -> xfail,
#     not a collection error.
#   - offline-friendly: no live DB/Storage; the cross-provider half stays MANUAL in VALIDATION.md.
def test_workspace_files_not_in_ingestion():
    """SC#2 — a static source scan pinning an invariant (a pattern worth mirroring for the
    'untrusted upload never reaches Jinja' structural guard)."""
```
> **For 101 (RESEARCH §Validation Architecture):** unit-test the DETERMINISTIC helpers directly in
> the backend venv (`docxtpl` is pip-installable into the venv for the TEST tier even though
> production render is the sandbox — the spike rendered in-venv for exactly this reason). Key unit
> tests: `test_field_map_covers_template_keys`, `test_check_coverage_flags_uncited_and_invented`,
> `test_truncated_emission_rejected`, `test_trusted_render_grows_rows[1,5,20]`,
> `test_run_merge_replaces_split_token`, `test_engine_selection_by_provenance`,
> `test_corrupt_file_never_delivered`, `test_autoescape_contains_xml_special_chars`,
> `test_template_input_routes_to_non_jinja_engine`. The end-to-end sandbox render + cross-provider
> emission is LIVE UAT (manual, VALIDATION.md).

---

## Shared Patterns

### Cross-provider forced structured output — route through the UNMODIFIED gateway, NEVER branch the fill path
**Source:** `_stream_one_iteration` (`task_service.py:178`) → `open_stream` (`:309`) → `resolve_calling_mode` (`openai_service.py:1155`)
**Apply to:** the field-map emission step of any fill phase (D-14, Cond 7 — the cross-provider RED LINE).

The spike's direct `anthropic.Anthropic().messages.create(tool_choice=...)` (`field_map.py:176`)
is the THROWAWAY shape. Production drives the field-map emission as an `llm_agent` phase whose
whitelist contains `render_template`; the model "calls" `render_template` with the field-map as the
argument. This rides the shared gateway, so all 8 providers inherit:
- **GLM/MiniMax registry-miss trap** (Pitfall 2): case-sensitive `MODEL_CAPABILITIES` keys
  (`MiniMax-M3`, `glm-5.1`); a miss → `CallingMode.STRUCTURED` → the gateway injects the tool
  catalog once + runs `parse_structured_tool_calls` to recover the call from prose. The field-map
  still arrives. **Confirm UAT model IDs are the exact registry keys; verify STRUCTURED recovery of
  the nested cited shape** (the `[OPEN]` cross-provider validation — spike only proved native Anthropic).
- **DeepSeek/Moonshot truncation trap** (Pitfall 3): `_resolve_max_tokens` clamps to the registry
  cap (64K-131K — ample); add the truncation guard (reject `stop_reason==max_tokens`).
- **BUG-260607-03 (MiniMax-M3 malformed tool-arg JSON → 400, D-15):** COVER + DOCUMENT in the
  cross-provider UAT; 101 does NOT own fixing it.

> **Never add a per-provider branch in the fill path.** All provider quirks live at the gateway
> boundary. (memory: `feedback_no_cross_provider_regressions`, `feedback_provider_uniform_ux`.)

### Bounded retry on citation/integrity failure — RIDE the existing harness gate, build NO new loop
**Source:** `ValidatorSpec` (`harness.py:135-142`) — `on_failure='retry'`, `max_retries=2`
**Apply to:** both failure classes (D-08).
```python
# harness.py:135 — the existing gate (091 owns execution; 102 generalizes it):
class ValidatorSpec(_StrictBase):
    kind: Literal["json_schema", "regex_match", "workspace_file_exists", "programmatic"]
    on_failure: str = "fail_run"  # fail_run | retry | skip_to_phase:<slug>
    max_retries: int = 2
```
> Citation/coverage failure → reject BEFORE render → harness retry (re-emit field-map). Integrity
> failure → reject AFTER render → harness retry (re-render). Final failure → honest run error +
> preserve the cited field-map as fallback output. This IS the concrete `output_file_valid` +
> `citations_required` that Phase 102 generalizes into the reusable validator library.

### Gated no-op on shared paths — the byte-identical-Deep RED LINE
**Source:** 098 search-scope gate (`tool_dispatcher.py:187`), 099 skill-snapshot gate (`:478`), 091 whitelist guard (`:1677`)
**Apply to:** EVERY new path 101 adds (the 100 D-11 invariant extended to the fill side).
The mechanism: a `getattr(ctx, <feature>, None) is not None` (or `phase_whitelist is None`) check
that makes the new branch a literal no-op when no template/fill is involved. Deep chat + existing
workspace/agent behavior must stay byte-identical.

### Blocking I/O wrapped in run_in_threadpool (CLAUDE.md D-v2.5-01)
**Source:** `_read_from_storage` (`workspace_service.py:143`), `write_file` Storage upload (`:265`)
**Apply to:** every `supabase-py` Storage call (AssetRef byte fetch, deliverable upload) inside an async handler.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (the arbitrary-path run-coalescing scalar replace algorithm) | utility | transform | **The one genuinely-new algorithm** (Pitfall 1 — docx run-split). NO production analog exists; docxtpl is run-safe by design so the spike never needed it. RESEARCH recommends a ~40-line manual coalescing pass over `doc.paragraphs` + table cells + headers, OR vendoring `python-docx-replace`'s algorithm. The residual-tag scan (`render_docx.residual_tags:144`) is the deterministic detector that catches a missed split-token fill. Planner uses RESEARCH Pitfall 1 (the discretion call) rather than a codebase analog. |

> Every OTHER new/modified file has a concrete production or spike analog. The arbitrary run-merge
> is the only net-new code with no precedent — it is the load-bearing MEDIUM-confidence risk of the
> phase (RESEARCH confidence line).

---

## Metadata

**Analog search scope:** `backend/app/services/` (tool_dispatcher, sandbox_service, template_service,
workspace_service, harness/phase_types), `backend/app/models/harness.py`, `backend/app/db/workspace.py`,
`backend/Dockerfile.sandbox`, `backend/tests/`, `scripts/spike-097/` (render_docx, field_map, derive_fields).
**Files scanned:** 11 (all read in full or by targeted range; no re-reads).
**Pattern extraction date:** 2026-06-10
