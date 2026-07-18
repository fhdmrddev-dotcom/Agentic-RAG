# Phase 151: Agent File Tools - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 12 (2 backend handlers, 2 schemas + wiring, 1 validator, 1 frontend, 1 migration, 6 test files)
**Analogs found:** 12 / 12 (every target is a line-for-line analogue of shipped code — RESEARCH's core finding)

> All line numbers below were spot-checked against the live tree on 2026-07-13 and match RESEARCH.md's corrected breadcrumbs. `threads.py` is NEVER touched (G-5). Both tools follow the G-5 contract: **one `_handle_X` handler + one `_TOOL_REGISTRY` line + one OpenAI-shape schema in `get_tools()` + one `_CAPABILITY_FLAG_TOOLS` entry.**

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/tool_dispatcher.py` → `_handle_fetch_document_file` (NEW handler, FILE-02) | service / tool-handler | file-I/O (Storage → sandbox, stream-to-disk) | `render_template` `_ship_and_run`/`_copy_in` (`tool_dispatcher.py:2541-2572`) + `_handle_read_document` (`:241`) owner-scope | exact |
| `backend/app/services/tool_dispatcher.py` → `_handle_attach_skill_file` (NEW handler, FILE-01) | service / tool-handler | file-I/O (4 sources → Storage write) | `_upload_skill_files` (`skills.py:113`) + owner-only gate (`skills.py:438-440`) | exact (role+flow) |
| `backend/app/services/tool_dispatcher.py` → `_TOOL_REGISTRY` + `_CAPABILITY_FLAG_TOOLS` (2 lines each) | config / registry | dispatch routing + flag-gate | `_TOOL_REGISTRY` (`:3193`), `_CAPABILITY_FLAG_TOOLS` (`:3275`) | exact |
| `backend/app/services/openai_service.py` → `FETCH_DOCUMENT_FILE_TOOL` + `ATTACH_SKILL_FILE_TOOL` schemas + `get_tools()` appends | config / tool-schema | request-response (flat function schema) | `READ_DOCUMENT_TOOL` (`:344`) / `QUERY_DOCUMENTS_BY_VIEW_TOOL` flat shape (`:106`); `get_tools()` gated appends (`:1063-1068`) | exact |
| `backend/app/api/workspace.py` → `validate_ooxml` → generalized `validate_upload` (D-09) | middleware / validator | file-I/O (upload magic-byte validation) | `validate_ooxml` + `_ALLOWED_EXT` (`workspace.py:114/119`) | exact (widen-in-place) |
| `frontend/src/components/panel/TemplateUpload.tsx` → widen `accept=` | component | file-I/O (upload picker) | `TemplateUpload.tsx:53` | exact (1-line) |
| `supabase/migrations/101_*.sql` (NEW, D-10 unique index) | migration | DDL (unique index) | `075_document_relationships_idempotency_index.sql` | exact |
| `backend/tests/unit/test_151_tool_schema.py` (NEW) | test | schema-shape (no anyOf/oneOf) | `test_115_tool_schema.py` (full file) | exact |
| `backend/tests/unit/test_151_registration.py` (NEW) + count fixes | test | registry + exact-count asserts | `test_085_tool_registration.py:272/280`, `test_tool_dispatcher.py:68` | exact |
| `backend/tests/unit/test_151_fetch_handler.py` / `test_151_attach_handler.py` (NEW) | test | handler (mocked supabase+session) | `conftest.py` `make_tool_context` (`:679`) | role-match |
| `backend/tests/unit/test_151_upload_allowlist.py` (NEW) | test | validator | `conftest.py` OOXML + `renamed_binary_bytes` fixtures (`:966-1033`) | exact |
| `backend/tests/unit/test_151_cross_provider_schema.py` (NEW) | test | translation (Google/Anthropic construct) | `google_service._convert_tools_to_google` (`:346`), `anthropic_service._convert_tools_to_anthropic` (`:123`) | role-match |

---

## Pattern Assignments

### `_handle_fetch_document_file` — FILE-02 READ (service, file-I/O)

**Analogs:** `render_template` `_ship_and_run`/`_copy_in` (`tool_dispatcher.py:2541-2572`) for the ship-into-sandbox core; `_handle_read_document` (`:241`) → `read_path` (`kb.py:385`) for owner-scope; `retrieval_service.resolve_document_id` (`:189`) for optional filename resolve; `documents.py:711` for the threadpool download idiom.

**Owner-scope read pattern — copy `read_path`'s owner→global two-step (`kb.py:395-416`), but SELECT storage columns not `full_markdown`:**
```python
# kb.py:395-416 — the D-04 "same scope as read_document" shape.
result = await aexec(
    supabase.table("documents")
    .select("id, filename, full_markdown")     # FILE-02: select "id, filename, file_path, file_size, mime_type"
    .eq("id", document_id).eq("user_id", user_id).maybe_single()
)
if not result or not result.data:
    global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)
    if global_folder_ids:
        result = await aexec(
            supabase.table("documents").select("id, filename, full_markdown")
            .eq("id", document_id).in_("folder_id", global_folder_ids).maybe_single())
if not result or not result.data:
    return {"error": f"Document '{document_id}' not found or access denied."}
```
> D-01/D-02 gates go AFTER this SELECT: `if not row.get("file_path"): return honest-error` (no original), then `if row["file_size"] > cap_bytes: return honest-error` (PRE-download). Both return `ToolResult(result=json.dumps({"error": …}))` — the honest-failure convention (see Shared Patterns).

**Threadpool download idiom (`documents.py:711` — Pitfall 1, NOT the un-wrapped `:1114`):**
```python
raw = await run_in_threadpool(
    supabase.storage.from_("documents").download, target["file_path"]
)
```

**Ship-into-sandbox core — clone `render_template._ship_and_run`/`_copy_in` (`tool_dispatcher.py:2541-2572`):**
```python
def _ship_and_run() -> dict:
    """Synchronous sandbox interaction (run in a threadpool — blocking I/O)."""
    session = sandbox_manager.get_or_create(ctx.thread_id)
    try:
        session.execute_command("mkdir -p /sandbox/output")   # FILE-02: "/sandbox/input" (D-03)
    except Exception:
        pass
    # _copy_in: NamedTemporaryFile → session.copy_to_runtime → unlink
    with _tempfile_local.NamedTemporaryFile(mode="wb", delete=False) as _tmp:
        _tmp.write(local_bytes)          # FILE-02: the downloaded doc bytes
        _local = _tmp.name
    try:
        session.copy_to_runtime(_local, container_path)   # FILE-02: f"/sandbox/input/{safe_name}"
    finally:
        try: _os_local.unlink(_local)
        except OSError: pass
    return {"path": container_path}
result = await run_in_threadpool(_ship_and_run)   # D-v2.5-01: ALL container/Storage I/O in the threadpool
```
> **Do NOT copy the base64-preamble injection at `tool_dispatcher.py:1114-1122`** — it does un-wrapped `storage.download` (event-loop freeze) and only `.replace("'", "\\'")` on the filename (no `../` defense), and lands at `/sandbox/<name>` not `/sandbox/input/`. Use `copy_to_runtime` (put_archive handles a 50 MB binary; base64-in-source does not).

**Filename sanitize (T-01 path traversal) — reuse the WR-05 charset scrub (`workspace.py:184-185`):**
```python
safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
```
> Apply `os.path.basename(filename)` FIRST, then this scrub, before building `/sandbox/input/<safe>`. Never trust `documents.filename` (user-set at upload).

**Capability gate (D-11, Pitfall 6):** FILE-02 gated on `sandbox_enabled` — append in `get_tools()` next to `EXECUTE_CODE_TOOL` (`openai_service.py:1067-1068`) AND add `"fetch_document_file": ("sandbox_enabled", "Document file fetch")` to `_CAPABILITY_FLAG_TOOLS` (`tool_dispatcher.py:3275`) so the in-flight kill-switch also refuses it (fail-closed, provider-uniform).

---

### `_handle_attach_skill_file` — FILE-01 WRITE (service, file-I/O)

**Analogs:** `_upload_skill_files` (`skills.py:113-158`) for the bucket-upload + `skill_files`-insert core; owner-only gate (`skills.py:438-440` / `467-468`); `workspace_service._get_file_content` (`:176`) for source #1 bytes; `sandbox_service.copy_from_runtime` (`:264`) for source #2; FILE-02's fetch resolver for source #4.

**Owner-only WRITE gate — copy `.eq("id").eq("user_id")` from `skills.py:438-440` (T-04, Pitfall 5). NEVER the `.or_(…is_global.eq.true)` read filter:**
```python
# skills.py:435-441 — the owner-only runtime gate under service-role (RLS is defense-in-depth).
result = (
    supabase.table("skills").update(update_data)
    .eq("id", skill_id)
    .eq("user_id", current_user["id"])   # ← the load-bearing gate; global/is_system skills aren't owned → excluded
    .execute()
)
if not result.data:
    raise HTTPException(status_code=404, detail="Skill not found")
```
> FILE-01 resolves the target skill by NAME under the same owner filter: `.eq("name", target_skill_name).eq("user_id", ctx.current_user["id"]).maybe_single()`. Empty `.data` → refuse (SC#4 cross-user proof). Belt-and-braces: also reject `is_system` (`full-schema.sql:1284`).

**Skill-file write core — reuse `_upload_skill_files` (`skills.py:137-149`); path is `{user_id}/{skill_id}/{filename}`, owner-prefixed from `ctx.current_user["id"]` (never model-supplied):**
```python
# skills.py:137-149 — the D-08 write path. FILE-01 adds upsert semantics (D-07).
supabase.storage.from_("skill-files").upload(
    path=entry["storage_path"],
    file=entry["file_bytes"],
    file_options={"content-type": entry["mime_type"]},    # FILE-01: add "upsert": "true" (Pitfall 2 / D-07)
)
supabase.table("skill_files").insert({
    "skill_id": skill_id, "user_id": user_id,
    "filename": entry["filename"], "file_path": entry["storage_path"],
    "file_size": len(entry["file_bytes"]), "mime_type": entry["mime_type"],
}).execute()
```
> All three calls are blocking — wrap Storage `.upload()` via `run_in_threadpool` and the DB insert/update via `aexec()` (Pitfall 1). Bare `.upload()` 409s on a colliding path; D-07 overwrite REQUIRES `file_options={"upsert": "true"}` PLUS the DB update-or-insert (both halves).

**D-07 overwrite — clean upsert requires the D-10 unique index (see migration section). With the index:**
```python
# on_conflict path (needs 101_ unique index on skill_files(skill_id, filename)):
await run_in_threadpool(lambda: supabase.storage.from_("skill-files").upload(
    path=storage_path, file=file_bytes,
    file_options={"content-type": mime, "upsert": "true"}))
# PostgREST atomic upsert (race-immune under WORKER_COUNT=2):
res = await aexec(supabase.table("skill_files").upsert(
    {"skill_id": skill_id, "user_id": uid, "filename": filename,
     "file_path": storage_path, "file_size": len(file_bytes), "mime_type": mime},
    on_conflict="skill_id,filename").execute())
```
> Report `"updated"` vs `"created"` in the ToolResult (D-07). The four source readers feed `file_bytes` before this block: workspace → `_get_file_content(pool, supabase, file_row)` (`workspace_service.py:176`); sandbox → `copy_from_runtime("/sandbox/output/<name>", tmpdir)` walk (`sandbox_service.py:264`); inline → the arg string (utf-8/base64; planner guards weak-model mangling); kb_doc → FILE-02's owner-scope resolver (T-03 data-movement note).

**Workspace bytes reader (source #1) — reuse `_get_file_content` (`workspace_service.py:176-184`), handles inline-bytea vs Storage + threadpool:**
```python
if file_row.get("content_inline") is not None:
    return file_row["content_inline"]
if file_row.get("content_storage_path"):
    return await _read_from_storage(supabase, file_row["content_storage_path"])  # run_in_threadpool wrapped
```

**Capability gate (D-11):** FILE-01 gated on `self_improve_enabled` — mirror `SAVE_SKILL_TOOL` (`openai_service.py:1063-1064`) and add `"attach_skill_file": ("self_improve_enabled", "Self-improvement (skill file attach)")` to `_CAPABILITY_FLAG_TOOLS` (`tool_dispatcher.py:3275`).

**Optional SSE (Claude's discretion):** mirror `workspace_file_written` emit at `tool_dispatcher.py:1565-1574` (`await ctx.emit(ctx.redis, ctx.run_id, 'skill_file_attached', …)`) — must stay additive + provider-uniform, no `provider ==` fork.

---

### `_TOOL_REGISTRY` + registration (config, dispatch routing)

**Analog:** `_TOOL_REGISTRY` dict (`tool_dispatcher.py:3193-3226`) — add two lines mirroring the Phase 115/116 dual-wiring comment style:
```python
# tool_dispatcher.py — inside _TOOL_REGISTRY (after line 3225):
"fetch_document_file": _handle_fetch_document_file,   # Phase 151 (FILE-02) — G-5: handler + one line; threads.py untouched
"attach_skill_file": _handle_attach_skill_file,       # Phase 151 (FILE-01)
```
> `dispatch_tool` (`:3307`) auto-routes via `_TOOL_REGISTRY.get(tool_name)` (`:3336`) for EVERY provider — no per-provider branch. The 147 `_capability_disabled_message` gate (`:3283`) refuses a flagged-off tool in-flight; adding the two `_CAPABILITY_FLAG_TOOLS` entries is what wires that fail-closed refusal.

### Tool schemas + `get_tools()` (config, request-response)

**Schema-dict analog:** `READ_DOCUMENT_TOOL` (`openai_service.py:344-374`) for the flat single-key shape; `READ_SKILL_FILE_TOOL` (`:472-489`) for a two-arg owner-scoped read. Structure to copy verbatim:
```python
FETCH_DOCUMENT_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "fetch_document_file",
        "description": ( "Use when …  Do not use for … " ),   # SC#10: lead with when/when-not (provider-docs-first)
        "parameters": {
            "type": "object",
            "properties": { "document_id": {"type": "string", "description": "…"} },
            "required": ["document_id"],
        },
    },
}
```

**Flat-schema rule for FILE-01 (SC#10, Pitfall 3) — model on `QUERY_DOCUMENTS_BY_VIEW_TOOL` (`openai_service.py:106-165`), the proven Google-safe shape:** required `source` enum discriminator + required `target_skill_name`/`filename`, optional source-specific string fields. NO `anyOf`/`oneOf`/`allOf`/`$ref`/`additionalProperties`. Optional fields either omit from `required` OR type as `["string","null"]` (the Google sanitizer collapses that to `{type:"string", nullable:true}`).

**`get_tools()` append pattern (`openai_service.py:1063-1068`) — gated exactly like save_skill/execute_code:**
```python
if self_improve_on:
    tools.append(SAVE_SKILL_TOOL)
    tools.append(ATTACH_SKILL_FILE_TOOL)      # Phase 151 FILE-01 — self_improve-gated
if web_enabled:
    tools.append(WEB_SEARCH_TOOL)
if sandbox_enabled:
    tools.append(EXECUTE_CODE_TOOL)
    tools.append(FETCH_DOCUMENT_FILE_TOOL)    # Phase 151 FILE-02 — sandbox-gated (Pitfall 6)
```
> Cross-provider translation is automatic: `_convert_tools_to_anthropic` (`anthropic_service.py:123`, `input_schema` rename + last-tool cache_control) and `_convert_tools_to_google` (`google_service.py:346`) run at the service boundary. No `provider ==` fork anywhere (D-14 red line).

---

### `validate_ooxml` → `validate_upload` (middleware/validator, file-I/O) — D-09

**Analog:** `validate_ooxml` + `_ALLOWED_EXT` (`workspace.py:114-146`). Generalize in place — keep the strict ZIP/OOXML branch for `.docx/.pptx/.xlsx`, ADD per-category branches:
```python
# workspace.py:114 today — OOXML-only:
_ALLOWED_EXT = {".docx", ".pptx", ".xlsx"}
# workspace.py:132-146 — the extension gate + magic-byte checks + size guard to preserve and extend:
ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
if ext not in _ALLOWED_EXT:                                    # widen this set (D-09)
    raise HTTPException(422, f"Unsupported type {ext}. Allowed: …")
if len(raw) > MAX_FILE_SIZE:                                   # keep size guard for ALL new types (office-bomb DoS)
    raise HTTPException(422, "File too large. Maximum size is 10 MB.")
```
Add branches (per RESEARCH §D-09 / A6): text-ish (`.md/.json/.csv/.txt/.py/.js/.sh` → utf-8-decodable + NUL-heavy reject); images (`.png/.jpg/.gif/.webp` → leading magic bytes `\x89PNG` / `\xFF\xD8\xFF` / `GIF8` / `RIFF…WEBP`). The route `upload_template` (`workspace.py:149-204`) keeps `kind='template_input'` provenance (`:195`) — T-02: `template_input` files are NEVER routed to the docxtpl Jinja engine. The WR-05 filename sanitize (`:184-185`) stays.

---

### `TemplateUpload.tsx` `accept=` (component, file-I/O) — lockstep with D-09

**Analog:** `TemplateUpload.tsx:53` — a one-line widen kept in lockstep with the backend allowlist:
```tsx
accept=".docx,.pptx,.xlsx"    // widen to match validate_upload's new _ALLOWED_EXT (D-09)
```

---

### `supabase/migrations/101_skill_files_unique_index.sql` (NEW migration, DDL) — D-10

**Analog:** `075_document_relationships_idempotency_index.sql` (the closest recent unique-index migration — additive, `IF NOT EXISTS`, full apply-instructions header). Next free number is **101** (last shipped is `100_secret_key_columns.sql`). Copy its structure:
```sql
-- 101_skill_files_unique_index.sql — Phase 151 (FILE-01 / D-10).
-- ADDITIVE partial unique index enabling race-immune D-07 overwrite:
-- a (skill_id, filename) tuple may exist at most once so PostgREST
-- .upsert(on_conflict="skill_id,filename") is correct under WORKER_COUNT=2.
-- skill_files has NO (skill_id, filename) unique constraint today (full-schema.sql:1116).
-- Apply by pasting into the Supabase SQL editor (NEVER db push / db reset),
-- then bash scripts/regenerate-full-schema.sh (no --reset); commit migration + full-schema.sql together.
-- Cloud parity: pending cloud apply BEFORE Phase 151 ships live (standing parity rule).

CREATE UNIQUE INDEX IF NOT EXISTS skill_files_skill_filename_uniq
    ON public.skill_files (skill_id, filename);
```
> Filename must match `<digits>_name.sql` (letter suffixes like `101b` are silently skipped by the Supabase CLI). The plan that AUTHORS the migration must NOT touch `full-schema.sql`; a separate operator/BLOCKING plan applies it + regenerates (the 075 / 100 precedent).

---

### Tests (Wave 0)

**`test_151_tool_schema.py`** — model on `test_115_tool_schema.py` (full file). Assert `"anyOf" not in json.dumps(schema)` and `"oneOf" not in …` for BOTH new schemas; assert the FILE-01 `source` enum members and required-key set:
```python
def test_schema_has_no_anyof_or_oneof():
    blob = json.dumps(schema)
    assert "anyOf" not in blob, "schema must NOT use anyOf (Gemini 400)"
    assert "oneOf" not in blob, "schema must NOT use oneOf (Gemini 400)"
```

**`test_151_registration.py`** — model on `test_085_tool_registration.py:270-283`. Assert both tools land in `_TOOL_REGISTRY` AND `get_tools()` under the right flags (FILE-02 only when `sandbox_enabled=True`; FILE-01 when `self_improve` on). **Fix the three stale exact-count asserts** — run the suite to read the new numbers:
```python
# test_085_tool_registration.py:272/280 — currently base==22, all==24:
eff = SimpleNamespace(web_search_enabled=False, sandbox_enabled=False)
assert len(get_tools(eff)) == 22        # → new count: +FILE-01 (self_improve default-True) = 23
eff_all = SimpleNamespace(web_search_enabled=True, sandbox_enabled=True)
assert len(get_tools(eff_all)) == 24    # → new count: +FILE-01 +FILE-02 = 26
# test_tool_dispatcher.py:68 — currently _TOOL_REGISTRY == 27:
assert len(_TOOL_REGISTRY) == 27        # → new count: +2 = 29
```
> Exact new numbers depend on gating (FILE-02 sandbox-gated ⇒ NOT in base). Do not hard-code from this note — run `pytest tests/unit -x` and read them.

**`test_151_fetch_handler.py` / `test_151_attach_handler.py`** — reuse `conftest.make_tool_context` (`:679`, already carries every ToolContext field; no new fixture). Mock `ctx.supabase` (owner-scope SELECTs) + `session`/`sandbox_manager`. Cover: D-01 no-original error, D-02 over-cap error (no download attempted), D-03 happy path returns `/sandbox/input/<f>`, T-01 `../../x` → `_.._.._x` under `/sandbox/input/`; FILE-01: 4 sources resolve bytes, created-vs-updated (D-07), T-04 attach to global/`is_system` skill refused, SC#4 non-owner user_id → empty `.data` → refuse.

**`test_151_upload_allowlist.py`** — reuse `conftest.py` fixtures `valid_docx_bytes` (`:993`), `renamed_binary_bytes` (`:1012`, `MZ`-header EXE → must fail), `oversized_ooxml_bytes` (`:1022`). Assert the widened `validate_upload` accepts `.md/.json/.csv/.png` and still rejects a renamed binary + oversize.

**`test_151_cross_provider_schema.py`** — call `_convert_tools_to_google(get_tools(eff_all))` (`google_service.py:346`) and `_convert_tools_to_anthropic(...)` (`anthropic_service.py:123`) and assert both construct without error with the two new tools present (SC#10 static backstop).

---

## Shared Patterns

### Owner-scope (SC#4 / D-04 / T-04)
**Sources:** `kb.py:395-416` (read: owner→global two-step), `skills.py:438-440` (write: owner-only `.eq("user_id")`), `retrieval_service.py:189` (filename resolve: owner-only).
**Apply to:** both handlers. **The rule:** READS use owner→global (`.eq(user_id)` then global-folder fallback); WRITES use owner-only `.eq("user_id", ctx.current_user["id"])` — NEVER the `.or_(…is_global.eq.true)` read filter. Service-role has no RLS backstop, so the app-layer `.eq(user_id)` is the load-bearing gate. Every handler tested cross-user (non-owner id → empty `.data` → refuse).

### Threadpool-wrap all blocking I/O (Pitfall 1 / D-v2.5-01)
**Source:** `documents.py:711` (`run_in_threadpool(storage.from_(bucket).download, path)`), `workspace_service.py:169` (`_read_from_storage`), DB via `aexec()`.
**Apply to:** both handlers — every Storage `.download`/`.upload`, every DB call, every `session.*` container call. **Anti-pattern:** the un-wrapped `storage.download` at `tool_dispatcher.py:1114` (a known deviation — do NOT copy).

### Honest-failure convention
**Source:** the `_TOOL_REGISTRY` handlers return `ToolResult(result=json.dumps({"error": …}))` on failure rather than raising into the agent loop (e.g. `dispatch_tool:3317`).
**Apply to:** D-01 (no original), D-02 (over-cap, states actual size), T-04 (refuse write to non-owned skill), SC#4 (not-found). Never raise into the loop; the agent decides its own fallback.

### G-5 dual-wiring + no-fork dispatch (D-14 red line)
**Source:** `_TOOL_REGISTRY` (`:3193`) + `get_tools()` (`openai_service.py:1025`) + centralized translators (`anthropic_service.py:123`, `google_service.py:346`).
**Apply to:** every new tool — a registry entry the model never sees is dead; a schema the registry can't route 500s. All 4 providers flow through the shared `dispatch_tool`; NO `provider ==` branch. `threads.py` is NEVER touched.

### Capability flag gate (D-11, fail-closed)
**Source:** `_CAPABILITY_FLAG_TOOLS` (`tool_dispatcher.py:3275`) + `get_tools()` conditional appends (`openai_service.py:1063-1068`).
**Apply to:** FILE-02 → `sandbox_enabled`; FILE-01 → `self_improve_enabled`. Defense-in-depth: HIDE from schema when off (get_tools) AND refuse in-flight (`_capability_disabled_message`).

## No Analog Found

None. Every target file maps to a shipped analog — this phase invents no new subsystem (RESEARCH's central finding). The only genuinely new artifacts are the `/sandbox/input/` landing convention (D-03; the `execute_code` injection lands at `/sandbox/<name>`) and the `skill_files(skill_id, filename)` unique index (D-10), both of which are additive extensions of existing mechanisms.

## Metadata

**Analog search scope:** `backend/app/services/` (tool_dispatcher, openai_service, anthropic_service, google_service, sandbox_service, workspace_service, retrieval_service), `backend/app/api/` (skills, workspace, documents, kb), `backend/tests/` (conftest, unit), `frontend/src/components/panel/`, `supabase/migrations/`.
**Files scanned:** 15 analog files read (targeted non-overlapping ranges) + migration index.
**Pattern extraction date:** 2026-07-13
**Line-number verification:** all breadcrumbs spot-checked live and match RESEARCH.md's corrections (`dispatch_tool` at `:3307`, `_TOOL_REGISTRY` at `:3193`, `_CAPABILITY_FLAG_TOOLS` at `:3275`, `render_template` copy-in at `:2541-2572`, `_upload_skill_files` at `:113`, owner-only gate at `skills.py:438-440`, `validate_ooxml` at `workspace.py:119`, `TemplateUpload.tsx:53`, next migration = `101_`).
