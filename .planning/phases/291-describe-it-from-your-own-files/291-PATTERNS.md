# Phase 291: Describe It From Your Own Files - Pattern Map

**Mapped:** 2026-10-22
**Files analyzed:** 27 (4 new backend, 1 new frontend, 9 modified backend, 10 modified frontend, 3 pinned tests edited)
**Analogs found:** 26 / 27. The one without an analog is the PDF arm inside the sandbox driver; see "No Analog Found".

Line numbers below were read on `develop` at `83cb4fb36`. Re-check them before editing: G-5 files move.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/services/describe_files.py` (NEW) | utility (pure leaf) | file-I/O → transform | `template_render_service.py:356-442` (`parse_docx_template_variables`, `placeholder_names_from_parsed`) + `extractors/aspects/vision_text.py:175-513` | role-match |
| `backend/app/services/harness/form_inputs.py` (NEW) | utility (pure leaf) | transform | `workflow_authoring.py:472-549` (`_declare_asked_arguments`) for shape; `template_render_service.py:445-475` (`check_coverage`) for the id contract | role-match |
| `backend/app/api/workflow_authoring_doors.py` (MOD: new stateless `/describe/read` handler, `GenerateRequest` fields, upload door widened) | controller | request-response (multipart, stateless) | the same file: `read_template_placeholders` `:140-249`, `GenerateRequest` `:76-99`, `upload_workflow_template` `:252-333` | exact |
| `backend/app/api/workflows.py` (MOD: ONE registration statement + import) | route | request-response | the same file: `:1624-1631` (`/template/placeholders` registration) and `:147-153` import block | exact |
| `backend/app/api/workflow_wire.py` (MOD: response model, ext/mime map) | model (wire) | request-response | the same file: `TemplatePlaceholdersResponse` `:397-413`, `_TEMPLATE_MIME_BY_EXT` `:371-379`, `TemplateAssetRef` `:382-394` | exact |
| `backend/app/services/workflow_authoring.py` (MOD: fence, degraded, coverage+retry, powers guard) | service | request-response (LLM) | the same file: `base_messages` `:760-769`, retry `:790-810`, `_check_allowed_connections` `:392-469`, `_declare_asked_arguments` `:472-549`, stamps `:864-873`/`:956-966`, frames `:349-360` | exact |
| `backend/app/models/harness.py` (MOD: `InputFieldSpec.origin`/`note`; `AssetRef` unchanged) | model | CRUD (JSONB) | the same file: `InputFieldSpec` `:653-660`, `name_seeded_by_ai` `:586` | exact |
| `backend/app/services/tools/render_template.py` (MOD: pdf `acroform` engine) | service (sandbox driver + tool handler) | file-I/O (sandboxed) | the same file: driver `main()` `:305-357`, `residual_tags_in` `:215-254`, `assert_integrity` `:257-297`, allow-lists `:372-391`, engine pick `:550-568` | exact (docx arms) / none (pdf body) |
| `backend/app/services/harness/phase_types.py` (MOD: ≤ 2 call lines) | service (executor) | event-driven | the same file: `_template_oracle` `:1153-1166`, gate site `:1698-1711` | exact |
| `backend/tests/unit/test_291_describe_read_door.py` (NEW) | test | request-response | `tests/unit/test_193_1_stateless_placeholders.py` | exact |
| `backend/tests/unit/test_291_{generate_coverage,generate_closed_set,powers_guard,fence,generate_degraded}.py` (NEW) | test | request-response (fake emit) | `tests/unit/test_214_describe_vocabulary.py:100-176` harness | exact |
| `backend/tests/unit/test_291_{describe_read,word_copy,pdf_fill_driver,form_inputs_overlay}.py` (NEW) | test | transform | `test_193_1_stateless_placeholders.py:89-116` byte builders | role-match |
| `backend/tests/integration/test_291_authoring_roster.py` (NEW) | test (opt-in, paid) | request-response | `tests/integration/test_187_authoring_roster.py:380-465` | exact |
| `backend/tests/unit/test_286_workflows_seam_pins.py` (EDIT: deliberate re-baseline) | test (pin) | — | its own 288-04 paragraph `:34-38` | exact |
| `backend/tests/unit/test_278_pure_move.py` (EDIT: `RETIRED` entries) | test (pin) | — | its own `RETIRED` dict `:187-199` | exact |
| `backend/tests/fixtures/phase286/*.json` (RE-CAPTURED) | fixture | — | 288-04 recapture | exact |
| `frontend/src/components/workflows/DescribeTemplateRow.tsx` (MOD: form kinds, D-04 typed list, D-27 ticks, D-02/D-08/cut-short lines) | component (presentational) | request-response (render only) | itself, `:93-274` | exact |
| `frontend/src/components/workflows/DescribeReferencesSection.tsx` (NEW, sketch B peer section) | component (presentational) | render only | `DescribeTemplateRow.tsx` | exact |
| `frontend/src/components/workflows/TemplateAttachSection.tsx` (MOD: copy constants only, if any) | config (copy) | — | its own `:60-155` exports | exact |
| `frontend/src/components/workflows/templateFirstVocabulary.ts` (MOD: static labels) | config (copy) | — | `footingFields` `:134-138`, `FOOTING_*` `:88-117` | exact |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` (MOD: forward one more kind; bind copy + refs) | hook | request-response | itself: `useTemplateRead` `:207-285`, `onDraft` `:568-608`, `bindHeldTemplate` `:539-555` | exact |
| `frontend/src/hooks/useTemplatePlaceholders.ts` (MOD: reload re-read, D-07) | hook | request-response | itself `:104-154` | exact |
| `frontend/src/lib/api/workflows.ts` (MOD: `readDescribeFile`, reference upload) | utility (api client) | request-response (multipart) | `readTemplatePlaceholdersFromFile` `:241-265`, `uploadWorkflowTemplate` `:135-158` | exact |
| `frontend/src/lib/api/knowledge.ts` (MOD: body + result types) | model (wire types) | — | `GenerateWorkflowBody` `:808-834`, `GenerateResult` `:790-805`, `GenerateReadiness` `:782-786` | exact |
| `frontend/src/components/workflows/DraftArrivalCard.tsx` (MOD: one optional prop + one conditional line) | component | render only | `settingsRow` prop `:142-147`; source line `:429-457` | exact |
| `frontend/src/components/workflows/soulData.ts` (MOD: one filter term) | utility (pure) | transform | `launchInputFields` `:303-305`, `DefShape.inputs` `:88` | exact |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx`, `frontend/src/pages/WorkflowBuilderPage.tsx` (MOD: one prop each at the mount) | component (host) | — | mounts `WorkflowDoorSwitch.tsx:843-848`, `WorkflowBuilderPage.tsx:1962-1967` | exact |
| `docs/HOT-FILE-LEDGER.md` (MOD: 6 new rows + sections) | docs | — | row `:11951`, section `:22559` | exact |

---

## Pattern Assignments

### `backend/app/api/workflow_authoring_doors.py`: new stateless door (controller, request-response)

**Analog:** the same file, `read_template_placeholders` (`:140-249`). Copy its shape. Do not refactor it: its AST is pinned (see the 286 section).

**Signature: two parameters, no client, no pool** (`:140-143`):
```python
async def read_template_placeholders(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> TemplatePlaceholdersResponse:
```
The new handler takes exactly these two. `test_193_1_stateless_placeholders.py:279-286` lists what must never appear in the body: `get_user_supabase_client`, `get_supabase`, `get_pg_pool`, `_owned_slug_or_404`, `_coerce_user_id`, `safe_name`. Settings come from `load_user_settings(user_id)`, which is a global cached read and not a caller-supplied path (RESEARCH Pattern 1).

**Gate ladder, in the shipped order** (`:202-232`):
```python
if file.size is not None and file.size > MAX_FILE_SIZE:  # WR-04 — before .read()
    raise HTTPException(422, "File too large. Maximum size is 10 MB.")
original = file.filename or ""
ext = "." + original.rsplit(".", 1)[-1].lower() if "." in original else ""
if ext not in _TEMPLATE_MIME_BY_EXT:
    raise HTTPException(422, "A workflow template must be a .docx, .pptx or .xlsx document " ...)
raw = await file.read()
if len(raw) == 0:
    raise HTTPException(422, "File is empty")
if len(raw) > MAX_FILE_SIZE:
    raise HTTPException(422, "File too large. Maximum size is 10 MB.")
validate_upload(original, raw)  # magic-byte / OOXML-container gate -> 422
with zipfile.ZipFile(io.BytesIO(raw)) as zf:
    uncompressed = sum(zi.file_size for zi in zf.infolist())
if uncompressed > _TEMPLATE_MAX_UNCOMPRESSED_BYTES: raise HTTPException(422, ...)
```
- Widen the extension set to `.docx .pptx .xlsx .pdf .txt .md` in a **new** constant. `_TEMPLATE_MIME_BY_EXT` is pinned and is also read by the upload door.
- `validate_upload` (`app/api/workspace.py:213-262`) already has the `.pdf` (`%PDF-`, `:210`) and text (`.md/.txt`, NUL-reject) branches. Do not add new magic checks.
- Apply the zip cap to **OOXML only**. A PDF is not a zip, so the `except` at `:224` would 422 every PDF.

**Off-loop parse + clean relay** (`:234-242`):
```python
try:
    parsed = await run_in_threadpool(parse_docx_template_variables, raw)
except Exception:
    logger.warning("Stateless template placeholder read failed (relaying clean error)", exc_info=True)
    raise HTTPException(422, "The document could not be read.")
```
`vision_text.transcribe_pages` also blocks (a sync OpenAI client), so it goes through `run_in_threadpool` as well.

**Honesty ordering** (`:186-197`): a document that never opened is a **422**. `read="ok"` with no fields means only "opened, found none". D-02's "No fields found in X, so it's used as reference only" is the second fact. Never reach it from a parse failure.

**Logger:** keep `logger = logging.getLogger("app.api.workflows")` (`:73`). `test_286…::test_moved_handlers_still_log_as_app_api_workflows` pins it.

### `GenerateRequest` + `generate_workflow` (same file, `:76-137`)

**Additive optional field pattern** (`:84-99`): `list[str] | None = None`, with the absent-vs-empty meaning written at the declaration. New fields (`form_fields`, `word_anchors_ticked`, `references`, …) follow this pattern. Use small Pydantic sub-models with `extra="forbid"`, never `dict`.

**Forward verbatim, never coalesce** (`:132-135`):
```python
# ⚠ FORWARDED VERBATIM — no `or None`, no `or []`, no `if body.allowed_connection_ids`.
allowed_connection_ids=body.allowed_connection_ids,
```

### `upload_workflow_template` widened for pdf template + `kind="reference"` (same file, `:252-333`)

Owner-gate first (`:282-284`), then the same ladder, then sanitise and use the user-keyed path (`:309-316`):
```python
safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", original)
safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
asset_id = f"{user_id}/_library/{definition_id}/{uuid4().hex[:8]}-{safe_name}"
await run_in_threadpool(supabase.storage.from_(BUCKET_NAME).upload, asset_id, raw,
                        {"content-type": mime, "upsert": "true"})
```
Keep the user-JWT `get_user_supabase_client` (`:260`). Storage RLS is the second boundary. ⚠ `TemplateAssetRef.kind` is `Literal["template"]` "this door mints templates, never `reference` assets" (`workflow_wire.py:382-394`). Two ways to mint references: a sibling door, or widening the Literal. Either way the 286 AST/OpenAPI pin changes, so re-baseline in the same plan.

---

### `backend/app/api/workflows.py`: ONE registration statement (route)

**Analog** (`:1624-1631`):
```python
router.post(
    "/template/placeholders",
    response_model=TemplatePlaceholdersResponse,
    dependencies=[
        Depends(require_visible("workflow_authoring")),  # Phase 148 (VIS-01) — authoring gate
        Depends(require_capability("workflows")),  # v4.3 audit (TIER-01) — every authoring write, not two
    ],
)(read_template_placeholders)
```
- Add the new handler to the import block (`:147-153`).
- Place the registration before any `/{definition_id}…` pattern it could collide with. `test_193_1…:382-399` uses `compile_path` to prove that no sibling pattern shadows the literal path. Write the same test for `/describe/read`.
- `workflows.py` is G-5 FIRING (split OWED > 1,500 L). The plan adds this one statement and the import names, nothing else.

---

### `backend/app/api/workflow_wire.py`: new response model (model, wire)

**Analog:** `TemplatePlaceholdersResponse` (`:397-413`):
```python
class TemplatePlaceholdersResponse(BaseModel):
    read: Literal["ok", "unreadable"]
    placeholders: list[str] = Field(default_factory=list)
```
Rules to carry over:
- `read` keeps "never opened" and "opened, empty" apart.
- The docstring states which Literal arm is unreachable on which route.
- The response echoes nothing unsanitised from the upload (`workflow_authoring_doors.py:199-200`). A filename echoed for the D-02/D-08 sentences must be the server-sanitised one, rendered as text.
- Per-field entries `{key, label, type, origin, enum_options, line_with_blank_marked, placed, reason?}` are a nested `BaseModel` with `Literal` types, never `dict`.
- Spell out mime values (`:376-379`). Do not use `mimetypes.guess_type`.

---

### `backend/app/services/describe_files.py` (NEW pure leaf; utility, file-I/O → transform)

**Analog A, parse docx without docxtpl** (`template_render_service.py:377-391`):
```python
try:
    zf = zipfile.ZipFile(io.BytesIO(data))
    parts = [n for n in zf.namelist()
             if n == "word/document.xml" or re.match(r"word/(?:header|footer)\d*\.xml$", n)]
    text = "".join(re.sub(r"<[^>]+>", "", zf.read(n).decode("utf-8", errors="ignore")) for n in parts)
except Exception:  # noqa: BLE001 — not-a-docx / corrupt zip => no oracle, never a crash
    return None
```
- Use this exact strip-tags regex in the exactly-once count (RESEARCH Code Examples). The parser returns a **set** (`:399`), so occurrences have to be counted separately.
- Root-identifier regex: `\{\{\s*([A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)*\s*\}\}` (`:399`). Proposed keys must match `^[A-Za-z_][A-Za-z0-9_]*$` and must not be in `RESERVED_RUN_INPUT_KEYS` (import it; `workflow_authoring.py:526` shows the import).

**Analog B, the one assembly** (`template_render_service.py:416-442`, `placeholder_names_from_parsed`): "two doors, one answer". The AcroForm reader is likewise **one** function (`read_acroform_fields`), called by the door, by `_template_oracle` and by the bound re-read. The sandbox driver inlines its own copy; pin the two copies against each other with a test (RESEARCH Anti-Patterns).

**Analog C, scans** (`vision_text.py`):
```python
deficit = classify_pdf_deficit(raw, extracted_text)          # :212 — None ⇒ text layer fine
pages = render_pdf_pages_b64(raw, max_pages=n)               # :175 — [] on failure, never raises
text  = transcribe_pages(pages, deficit.kind, app_settings)  # :425 — "" on total failure ⇒ "Couldn't read this scan"
n     = page_budget(app_settings, total_pages)               # :475 — reuse; cap further at 3 pre-draft (A7)
note  = truncation_note(total_pages, n)                       # :492 — never truncate silently
```
⚠ Use `vision_text`, **not** `multimodal_service.describe_image`. That function writes a caption (RESEARCH Pitfall 14). `transcribe_pages` returns `""` when `resolve_vision_model` is `None` (`:442-443`).

**Read-time AI proposal** (Word blanks / flat PDF): copy the `forced_emit` call shape from `workflow_authoring.py:771-785` (`emitter=`, `tools=[EMIT_TOOL]`, `schema_model=`, `strict=False`, `user_settings=load_user_settings(...)`, model from `resolve_authoring_model(settings)` `:200`). Two rules:
- Document text goes in the **user** turn. The system prompt is dropped on 6 of 8 providers (SEED-327).
- Copy the `EMIT_TOOL` dict shape (`:248-254`) for a small `ProposedFields` tool.

**No-crash posture:** every reader returns a value object or `None` and never raises past the leaf. That is the `parse_docx_template_variables` / `render_pdf_pages_b64` style.

---

### `backend/app/services/workflow_authoring.py` (service, request-response LLM; G-5 FIRES, 286 forecast "one more grounding input (untrusted)")

**1. Fence in the USER message** (current `:760-769`):
```python
base_messages = [{"role": "user",
                  "content": grounded_prompt + "\n\n" + vocabulary_block
                             + "## The task to author\n" + describe}]
```
- Prepend the `<documents>` block. The task stays last.
- ⛔ **With no files the content must stay byte-identical.** `test_214_describe_vocabulary.py:418-425` asserts `content == "GROUNDED\n\n## The task to author\n" + DESCRIBE`. Copy that `is not None` gating idiom (`:756-758`): with no files, add the empty string.

**2. Frame literal + its re-derived length** (`:349-360` plus the comment `:334-348`). The data-not-instructions sentence and the document frame are module-level literals. Their length is re-derived by a test, as in `test_214…:361-392`:
```python
allowed_len = len(_VOCABULARY_ALLOWED_FRAME)
assert allowed_len == 236, allowed_len
```

**3. One extra retry for coverage** (analog: validation retry `:790-810`):
```python
retry_messages = base_messages + [
    {"role": "assistant", "content": "(the previous emission failed validation)"},
    {"role": "user", "content": (f"Your emission failed strict validation:\n{err}\n" ...)},
]
res2 = await _shot(retry_messages, 2)
```
- This budget is separate, so the total is ≤ 3 calls.
- Update the docstring's budget sentence (`:694-696`).
- `test_214…:461-477` pins "exactly one call on a valid first emit" and "a refusal does not retry". Both must still hold when no files are supplied.

**4. Post-emit structural walk: the powers guard** (analog `_check_allowed_connections` `:392-469`):
```python
if allowed is None:
    return None                      # absent arm = today's behaviour, byte-identical
for phase in wd.phases:
    config = getattr(phase, "config", None)
    if getattr(config, "phase_type", None) != "external_action":
        continue
```
D-15 calls for removal, not refusal. Rebuild with `model_copy`, re-index `phase_index`, then re-run `WorkflowDefinition.model_validate` and `lint_workflow`. Place it after `_check_grounding_fidelity` (`:812-817`) and after the vocabulary refusal (`:830-832`), before `_declare_asked_arguments` (`:845`). Apply the guard only when files were supplied.

**5. Server-added inputs** (analog `_declare_asked_arguments` `:472-549`):
```python
from app.models.harness import InputFieldSpec
from app.models.message import RESERVED_RUN_INPUT_KEYS
existing = list(wd.inputs or [])
already = {str(getattr(f, "key", "") or "") for f in existing}
...
if not additions:
    return wd
return wd.model_copy(update={"inputs": [*existing, *additions]})
```
`None` vs `[]` is preserved. Nothing is mutated in place. Reserved keys are skipped.

**6. Provenance stamped server-side, never read off the payload** (`:864-873`, `:956-966`):
```python
wd = wd.model_copy(update={"phases": [p.model_copy(update={"name_seeded_by_ai": bool(p.name and p.name.strip())}) for p in wd.phases]})
```
`InputFieldSpec.origin` follows the same pattern. Overwrite whatever the model emitted for `origin`, and assert both directions in a test (T-187-02-02).

**7. Additive result keys on the `ok: True` arm only** (`:1021-1025`, readiness block `:976-1019`). `removed: [{sentence}]` / `added: [...]` are **absent** when empty: "the client's union depends on ABSENCE MEANING ABSENCE" (`:996-998`). A failure dict has no `definition` key and no `readiness` key (`test_214…:199-202`).

**8. `degraded` branch (D-20 / SEED-133).** Analog `/validate` (`workflows.py:904-913`):
```python
bundle = await grounding.assemble_grounding_bundle(supabase=supabase, user_id=str(user_id))
if bundle.degraded:
    findings.append(grounding.grounding_unavailable_finding(bundle.degraded))
```
Words come from `grounding.grounding_unavailable_finding` (`grounding.py:685-717`) and are never re-typed. ⚠ **The tuple contract is a test seam.** `_assemble_grounding` (`:257-292`) returns `(str, set, set)`, and **9 suites monkeypatch it to a 3-tuple**: `test_103_nl_generate`, `test_103_grounding_fidelity`, `test_187_authoring_step_names`, `test_193_1_grounding_wire`, `test_2141_describe_declares_inputs`, `test_214_describe_vocabulary`, `test_workflow_authoring_requirement`, `tests/test_182_extraction_parity`, and integration `test_187`/`test_193_2`. Changing the arity reds them all. Two options: carry `degraded` on a separate path (e.g., a second thin delegate the fakes do not touch), or re-baseline those fakes deliberately in the same plan.

---

### `backend/app/models/harness.py` (model, JSONB; G-5 FIRES, "ONE optional field pair")

**Analog** (`:653-660` and `:586`):
```python
class InputFieldSpec(_StrictBase):
    key: str
    label: str
    type: Literal["text", "number", "date", "enum", "file", "kb_auto"]
    required: bool = True
    source: Literal["user", "kb_auto", "template_derived"] = "user"
    enum_options: list[str] = []
    folder_scope: list[UUID] | None = None
...
    name_seeded_by_ai: bool = False     # VOCAB-01 / D-187-03 — the NL generator wrote `name`, not a human
```
- `_StrictBase` is `extra="forbid"`. An undeclared marker 422s the autosave PATCH (the 193.2 lesson), so declare it.
- Write it as `origin: Literal["ai_proposed","server_added"] | None = None`, plus `note: str | None = None`, each with one trailing comment, matching the `:586` style.
- `WF_SCHEMA` (`workflow_authoring.py:244`) is derived from this class, so the emit tool advertises the field automatically. Point 6 above stops the model from setting it.
- `AssetRef` (`:663-667`) already has `kind: Literal["template","reference"]`. No change and no migration.

---

### `backend/app/services/tools/render_template.py` (sandbox driver + handler; trigger path for `check-extension-contract.cjs`)

**Engine dispatch inside `_RENDER_DRIVER_SRC.main()`** (`:326-335`):
```python
if engine == "docxtpl":
    context = build_context(field_map)
    render_res = render_docx_template(template_path, context, out_path)
elif engine == "run_replace":
    flat = _flat_scalars(field_map)
    render_res = run_replace_docx(template_path, flat, out_path)
else:
    verdict["error"] = "unknown engine %r" % engine
```
Add an `elif engine == "acroform":` arm whose function returns `{"rendered": bool, "error": str|None}`, the same shape as `run_replace_docx` (`:186-204`).

**Per-format integrity arm** (`residual_tags_in` `:215-254`, `assert_integrity` `:257-297`): an `if fmt == ...` ladder ending in `raise ValueError("…unsupported fmt %r" % fmt)`. For `pdf`, residuals are the refused fields, and the read-back `/V` + `/AS` comparison is the integrity check. Use `documented_limit` (`:265`, `:296`) for the non-Latin font limit (RESEARCH Pitfall 4).

**Allow-lists** (`:372-391`):
```python
_SAFE_OUT_FILENAME_RE = _re_filename.compile(r"^[A-Za-z0-9._ -]+\.(docx|pptx|xlsx)$")
_VALID_RENDER_ENGINES = frozenset({"docxtpl", "run_replace"})
def _safe_out_filename(raw, template_ext):
    ...
    ext = template_ext if template_ext in ("docx", "pptx", "xlsx") else "docx"
```
Each gains `pdf` / `"acroform"`. All three, plus `_RENDER_DRIVER_SRC` and possibly `_handle_render_template`, are 278-pinned (next section).

**Engine selection in the handler** (`:550-562`): `engine = select_engine(src["provenance"])` is followed by the `_VALID_RENDER_ENGINES` check. `template_ext` is derived at `:561-562`. Pick `acroform` from **template extension** (`template_ext == "pdf"`) at this point. `select_engine` (`template_render_service.py:965`) stays the docx boundary.

---

### `backend/app/services/harness/phase_types.py` (executor; G-5 OWED: call lines only)

**Oracle** (`:1161-1166`):
```python
if not str(src.get("filename") or "").lower().endswith(".docx"):
    return None
data = src.get("bytes")
if not data:
    return None
return parse_docx_template_variables(data)
```
Add the pdf arm as ONE call to `describe_files.read_acroform_fields`, returning the same `{"scalars", "collections", "columns"}` shape so `:1704-1708` reads it unchanged.

**Overlay call site** (`:1698-1711`):
```python
legacy_map = emit_field_map_to_legacy(emitted)
...
gate = check_coverage(legacy_map, retrieved_ids, placeholder_keys)
```
Insert the single `overlay_user_inputs(...)` line right after `:1698`, and union its ids into `retrieved_ids`. That set already flows to the handler (`:1876`, `:1936`). `_emit_bound_asset_ref` (`:1104-1121`) already ignores `kind="reference"`, so it needs no edit.

---

### `backend/app/services/harness/form_inputs.py` (NEW pure leaf; transform)

**Contract it must satisfy** (`template_render_service.check_coverage` `:450-452`): "A non-null value is CITED iff its `source_chunk_id` was actually in `retrieved_ids`". The overlay writes `{"value": v, "source_chunk_id": f"input:{key}"}` and returns `"input:<key>"` ids, which the gate then accepts. Shape discipline is that of `_declare_asked_arguments` (pure, returns new objects, `None`/`[]` preserved). It applies only to `source == "user"` specs, so publish golden runs (`publish_service.py:1635-1656`) keep working.

---

## Pinned tests: how to change them deliberately

### `backend/tests/unit/test_286_workflows_seam_pins.py` (REQUIRED re-baseline in the plan that edits the doors)

**What reds:**
- `_EXPECTED_ROUTES` (`:66-82`, exactly 15 routes, ordered) once `/describe/read` is registered.
- The OpenAPI sub-doc fixture once `GenerateRequest` grows fields or a response model is added.
- The AST table (`:418-437`) for `GenerateRequest`, `read_template_placeholders` (if touched), `upload_workflow_template`, `TemplateAssetRef`, and `TemplatePlaceholdersResponse`.
- `assert len(table) == len(_MOVE_SET) == 25` (`:422`, `:431`). Adding the new handler to `_MOVE_SET` changes 25, so the new handler should **not** join `_MOVE_SET`. Pin it in the 291 suite instead.

**The 288-04 precedent, verbatim** (`:34-38`):
```
DELIBERATE RE-BASELINE (Phase 288-04, 2026-10-19): plan 288-02 added ONE optional field,
``auto_answered``, to ``PublishVerdict`` (the "answered automatically during validation" note).
The OpenAPI fixture and the ``PublishVerdict`` body hash were recaptured for that field alone;
the diff was checked to be exactly +5 lines (the one property) and one hash. The route table
fixture is byte-unchanged. A further change to either needs its own written reason here.
```
Procedure from `288-04-SUMMARY.md:46`:
1. Run `PIN286_CAPTURE=1` once (`:63`; it writes `tests/fixtures/phase286/{workflows_openapi,workflows_routes,workflows_moved_ast}.json`).
2. `git diff` each fixture and check that the diff is exactly the intended additions.
3. Revert any fixture the plan did not intend to change.
4. Append a `DELIBERATE RE-BASELINE (Phase 291-0N, <date>)` paragraph below the 288-04 one naming each changed fixture, each changed hash and the measured diff size.
5. Update `_EXPECTED_ROUTES` by hand.

⚠ 288-04 also had to re-baseline the generic OpenAPI snapshot (`288-04-SUMMARY.md:81`, "without this the baseline gate sat at 74, over the ceiling"). Find any other OpenAPI snapshot the new route touches in the same plan.

### `backend/tests/unit/test_278_pure_move.py` (REQUIRED `RETIRED` entries in the fill-back plan)

The pinned names are `_RENDER_DRIVER_SRC`, `_SAFE_OUT_FILENAME_RE`, `_VALID_RENDER_ENGINES`, `_safe_out_filename` (`:146-149`), plus `_handle_render_template` if edited. Precedent (`:187-199`):
```python
RETIRED: dict[str, str] = {
    "_handle_ask_user": (
        "BUG-261015-03 (2026-10-15): deliberate post-move edit. The wait clamp moved into "
        "_resolve_ask_timeout with a 300 s floor; pinned by test_bug_261015_03_ask_user_floor.py."
    ),
    "_handle_query_documents_by_view": ( "Phase 284 (284-04, R-02, 2026-10-16): deliberate post-move edit. ..." ),
}
```
Each entry gives the phase/plan, the date, what changed, and **which new test now pins the behaviour**. `assert set(RETIRED) <= set(MOVE_MAP)` (`:313`) and the non-vacuity count (`:366`) adjust automatically. Fix the stale comment on `:187` ("EMPTY in 278") while there, or leave it alone. That is planner's choice.

### Must stay green UNCHANGED (this is the recount)

| Suite | Assertion |
|---|---|
| `test_259_closed_core_inventory.py` | `len(PHASE_TYPE_REGISTRY_ENTRIES) == 7` (`:35`), `len(EMITTER_REGISTRY) == 1` (`:45`), `len(_TOOL_REGISTRY) == 30` (`:56`) |
| `test_255_extension_contract_guard.py` | `len(TRIGGER_FILES) == 17` (`:53`), `test_no_dynamic_code_execution_in_trigger_paths` (`:140`). `phase_types.py` and `tools/render_template.py` are trigger files, so run `node scripts/check-extension-contract.cjs` |
| `test_193_1_stateless_placeholders.py` | the existing door is untouched, so this stays green; the new door gets its own copy of the fence |
| `test_214_describe_vocabulary.py` | `:418-425` byte-identical prompt with no files; `:461-477` call budget |

### Frontend pin
`frontend/src/pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx` snapshots the header bands and the `builder-grid` DOM (`:322-332`). ⚠ `git status` already shows its `.snap` (and `WorkflowRunPage.seam286…snap`) **modified and uncommitted** at the start of 291. Establish whether that drift is inherited (290) before attributing any red to 291. Re-capture only with a written reason, as above.

---

## Test Pattern Assignments

### `test_291_describe_read_door.py`. Analog: `test_193_1_stateless_placeholders.py`
- **Stub upload whose read explodes** (`:50-69`): `_StubUpload(filename, data, size, explode_on_read)`.
- **Direct call, two kwargs, no TestClient** (`:72-77`): `wf_api.<handler>(file=upload, current_user={"id": _USER_ID})`.
- **Byte builder satisfying both gates** (`:89-102`, `_template_docx`) and the zip bomb (`:105-116`). ⚠ `valid_docx_bytes` has no `word/document.xml` (`:82-88`).
- **No-client fence plus positive control** (`:289-341`): `_code_without_prose(fn)` drops the docstring via `ast`, sweeps `_FORBIDDEN_IN_HANDLER`, and a planted function proves the fence can fire.
- **Authoring-gate closure check** (`:344-365`) and the `compile_path` no-shadow check (`:382-399`).

### Generate-path suites. Analog: `test_214_describe_vocabulary.py:100-176`
Fakes are stubbed at module boundaries, with no network and no DB:
```python
monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)       # returns ("GROUNDED", set(), set())
monkeypatch.setattr(wa, "_check_grounding_fidelity", _fake_fidelity)
monkeypatch.setattr(wa, "_resolve_allowed_vocabulary", _fake_resolve)
monkeypatch.setattr(cfg, "get_model_capability", lambda m: {"forced_emission": True, "provider": STUB_PROVIDER})
monkeypatch.setattr(us, "load_user_settings", lambda _uid: SimpleNamespace(active_provider=STUB_PROVIDER))
def _patch_emit(monkeypatch, responses):        # records kwargs per call → assert messages + call count
    calls = []
    async def _fake_forced_emit(**kwargs):
        calls.append(kwargs); return responses[min(len(calls)-1, len(responses)-1)]
    monkeypatch.setattr(fe, "forced_emit", _fake_forced_emit)
    return calls
```
For SC#3 ("the describe-only half never receives file text"), assert on `calls[i]["messages"]` of the second, file-blind emit. For SC#2, plant an unknown tool through the fake emit with the real `_check_grounding_fidelity` (do not patch it) and assert `error == "grounding_failed"` with no `definition` key.

### `test_291_authoring_roster.py`. Analog: `test_187_authoring_roster.py`
- Copy `derive_roster()` (`:190`) by import, not by re-typing.
- Gate on an opt-in env (`OPT_IN_ENV`, `:116`) and record each row with `_block` / `_record` (`:238-246`), never skipping silently.
- Use the per-row stub `settings=SimpleNamespace(harness_authoring_model=row.model_id)` (`:415`).
- Wrap each row in `asyncio.wait_for` with a per-row timeout (`:404-421`).
- Add `form_fields`/`references` kwargs to the call. The scoreboard file pattern is at `:248-290`.

---

## Frontend Pattern Assignments

### `DescribeTemplateRow.tsx` (extend) and `DescribeReferencesSection.tsx` (NEW)

**Analog:** `DescribeTemplateRow.tsx` itself.
- **Presentational, props only, no fetch** (docblock `:24-33`; props `:93-110`). The read lives in the hook. ⚠ The file deliberately does not spell its banned identifiers anywhere, prose included (`:30-33`, `:61-63`). The D-24(a) RAW copy fence sweeps this file, so new comments name identifiers, never governed door words.
- **One node and one testid per arm** (`:245-262`). D-02 ("no fields"), D-08 ("couldn't read this scan"), "only the first N read" and D-28 ("couldn't place") each get their own `data-testid`, so a swapped sentence turns a test red.
- **One live region** (`:206-207`): `<div data-testid="describe-template-fields-region" role="status">`.
- **Counts derived from the rendered list** (`:134-136`): `footingFields(state.fields.length)`. Never a literal.
- **Names as escaped React text, in server order, never re-sorted** (`:227-240`).
- **Native file input, reset before the callback** (`:173-186`): `event.target.value = ""` and then `onPickFile(file)`.
- **The union type is imported, not re-declared** (`:88`, `:94-99`). If the five-arm union widens (form kinds, typed fields, ticks), widen `TemplatePlaceholdersState` / `TemplateReadState` at their home (`useTemplatePlaceholders.ts:56-70`, `useTemplateFirstDraft.ts:~160-172`) so both doors stay on ONE wire shape. Keep `fields` "non-empty by contract" (`useTemplatePlaceholders.ts:47-51`).
- **Server words render verbatim.** D-02, D-08, D-15 and D-28 sentences are server-composed (SEED-221). The vocabulary module holds static labels only (headings, "Remove", tick legend).

### `useTemplateFirstDraft.ts` (hook; 286 forecast: "forwards one more upload kind to /generate")

**Per-`File` read hook** (`useTemplateRead`, `:207-285`): answer stored with the `File` it answered for (`:238`, `:283`), abort-on-replace (`:247`, `:275`), a positive `res.read !== "ok"` comparison (`:251-257`), and module-frozen `READ_IDLE`/`READ_LOADING` (`:182-183`, required because `onDraft` depends on the reading). A reference read for each of the ≤ 5 files reuses this hook keyed per `File`. Do not grow a second state machine.

**Forward one more kind** (`:590-607`): additive spreads, each gated on its own arm:
```ts
...(templateRead.kind === "fields" ? { template_placeholders: templateRead.fields } : {}),
...(allowedConnectionIdsRef.current !== undefined ? { allowed_connection_ids: allowedConnectionIdsRef.current } : {}),
```
Never send `[]` to mean absent (`:580-584`).

**Bind after the row exists** (`:539-555`): reads the ref, returns early when nothing is held, upload, `onTemplateBoundRef.current(asset)` (single writer, no `assets[]` append here), `console.error` plus a person-safe state on failure. The references and the Word copy bind the same way (D-07 rides `definition.assets[]`; `useDraftPersistence.ts` ideally untouched).

**Result handoff** (`:609-633`): read the extra result keys (`removed`) off the same `result` and hand them on **untouched**: "No `?? {}`, no coercion" (`:622-627`).

### `useTemplatePlaceholders.ts` (D-07 reload re-read)
Keyed on `[definitionId, assetId]` (`:104-154`); an answer about a different asset reads as `loading` (`:149-153`). Widen the server route to pdf. The hook shape is unchanged.

### `lib/api/workflows.ts`
`readTemplatePlaceholdersFromFile` (`:241-265`): FormData with one part named `file`, `Authorization: Bearer`, **no `Content-Type`**, an abortable `signal`, network failure → `WorkflowTemplateUploadError("network", null)`, non-ok → relay the server `detail` string. Copy it for `readDescribeFile`. The reference upload copies `uploadWorkflowTemplate` (`:135-158`).

### `lib/api/knowledge.ts` (wire types)
- `GenerateWorkflowBody` (`:808-834`): each optional field gets an absent-vs-empty doc. ⚠ Do not spell the forbidden coalesce forms in prose; `lib/apiRunFields.fences.test.ts` sweeps `src/` (`:824-830`).
- `GenerateResult` ok arm (`:790-791`): add `removed?: …` beside `readiness?`, documented like `GenerateReadiness` (`:767-786`), so that absent means the server said nothing.
- ⚠ **There is no frontend `InputFieldSpec` type** (grep: zero hits). Input shape lives in `soulData.ts:88` `DefShape.inputs: Array<{ key?; label?; required? }>`. Add `source?` (and `origin?`) **there**, not in a new type.

### `DraftArrivalCard.tsx` (G-5: ONE prop, closed shape)
**Optional prop with default-off** (`:142-147`, 288-01):
```ts
/** Phase 288-01 … Default false keeps the closed branch null. */
settingsRow?: boolean
```
**Absent ⇒ the whole line is absent** (`:426-429`): `{businessRequirement !== "" && (<div data-testid="draft-arrival-source" …>)}`. The Removed line uses the same pattern: `{removed && removed.length > 0 && …}`, rendered as React text children, never raw HTML (`:423-424`), each sentence verbatim from the server. The sketch-A rule: a clean draft's card stays byte-identical.

### `soulData.ts` (G-5: one helper term)
```ts
export function launchInputFields(def) {
  return entryInputFields(def).filter((f) => !RESERVED_LAUNCH_INPUT_KEYS.has(f.key))
}
```
(`:303-305`). The `kb_auto` skip is one more `.filter` term. `entryInputFields` (`:238-249`) must then carry `source` through its map. `missingRequiredFields` (`:207-212`) inherits the skip because it receives the filtered list (confirm at both call sites: `ChatLaunchForm`, `RunModal`).

### Mounts: `WorkflowDoorSwitch.tsx:843-848`, `WorkflowBuilderPage.tsx:1962-1967`
```tsx
<DescribeTemplateRow state={templateRead} filename={templateFile?.name}
                     onPickFile={onPickTemplateFile} onClear={onClearTemplateFile} />
```
Both doors mount the **same** component (`WorkflowBuilderPage.tsx:1940-1961` explains why it must not sit inside the pinned CTA group or behind `canvasEnabled`). The references section mounts beside it on **both** doors. "A plan that assumes one is the other lands the feature on half the product" (`DescribeTemplateRow.tsx:8-10`).

---

## Shared Patterns

### Absent vs empty never collapse
**Sources:** `workflow_authoring_doors.py:88-99,132-135`; `workflow_authoring.py:403-415,650-662`; `useTemplateFirstDraft.ts:596-607`; `knowledge.ts:816-830`.
**Apply to:** every new optional request field, result key and hook prop. `None`/`undefined` means today's behaviour, byte-identical. `[]` is a decision.

### Prompt halves guarantee nothing; the server walks what was emitted
**Source:** `workflow_authoring.py:325-332` (the Phase 214 block), `:472-487`.
**Apply to:** the fence (D-13), the coverage rule (D-10), the powers guard (D-14), fill-back validation (D-25/D-29). Each has a post-emit or post-write server check with a RED drive (`tdd_mode: true`).

### Server-stamped provenance, never read off the payload
**Source:** `workflow_authoring.py:847-873`, `:885-899`.
**Apply to:** `InputFieldSpec.origin`, AI-proposed field marks, server-added inputs.

### Refusals and notices carry server words, never codes
**Source:** `workflow_authoring.py:381-389` (`reason_code` beside `error`/`detail`), `:984-986`; `grounding.grounding_unavailable_finding` `grounding.py:685-717`.
**Apply to:** "Removed: …", "No fields found …", "Couldn't read this scan", "Couldn't place …", "Only the first … was read", invalid enum refusal in the fill. The client renders them verbatim.

### Blocking I/O off the loop
**Source:** `workflow_authoring_doors.py:234-238`, `:317-323` (`run_in_threadpool`).
**Apply to:** pdf/docx parsing, `transcribe_pages`, Storage uploads, the Word-copy maker.

### Function-local imports in services (Pitfall 4)
**Source:** `workflow_authoring.py:278-281,316-318,525-526,698-699`.
**Apply to:** new imports inside `workflow_authoring.py` and `phase_types.py`. Monkeypatch seams depend on module-attribute lookups (`wa._assemble_grounding`).

### `model_copy`, never in-place, never a model validator hook
**Source:** `workflow_authoring.py:516-519`, `:857-860`.
**Apply to:** powers-guard removal, server-added inputs, origin stamps.

### Hot-file ledger rows (gate: `node scripts/check-hot-file-ledger.cjs 291`)
**Row format** (`docs/HOT-FILE-LEDGER.md:11951`):
```
| [`backend/app/api/workflow_authoring_doors.py`](docs/HOT-FILE-LEDGER.md#backendappapiworkflow_authoring_doorspy) | 1 / 1 / 403 | no (young) | young (286-01). … ⛔ placeholder door: no client, no pool; logger `app.api.workflows` |
```
The section heading format is at `:22559` (`### \`<path>\``). Rows are owed for `template_render_service.py`, `DescribeTemplateRow.tsx`, `TemplateAttachSection.tsx`, `templateFirstVocabulary.ts`, `useDraftPersistence.ts` and `useTemplatePlaceholders.ts`. Add each row **and** its section in the same commit as the first plan touching that file. The disposition cell is capped at 200 characters in the docs scan list. Triples are re-derived with the recipe in CLAUDE.md, never copied.

---

## No Analog Found

| File / part | Role | Data Flow | Reason |
|---|---|---|---|
| AcroForm fill + `/V`/`/AS` read-back function inside `_RENDER_DRIVER_SRC` (and its inlined field reader) | sandbox driver | file-I/O | No PDF *writer* exists anywhere in `backend/app`. Use RESEARCH "Code Examples → pypdf 5.1.0" (measured under the sandbox's pinned 5.1.0) and Pitfalls 2-5. The surrounding shape (return dict, `verdict` keys, `elif engine` arm) is still copied from `run_replace_docx`/`main()`. |

Partial-analog notes:
- **Word-copy anchor insertion** (`describe_files`): the closest shipped code is `run_replace_docx` / `_replace_in_paragraph` (`template_render_service.py:701-757`), which edits runs in place. The insertion itself is RESEARCH's measured `insert_token_into_blank` and must write `{{ key.value }}`.
- **File-blind second emit for the describe-only power set**: no shipped two-emit authoring path exists. Reuse `forced_emit` exactly as `_shot` calls it (`workflow_authoring.py:771-785`) with a small Pydantic schema.

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/` (+ `harness/`, `tools/`, `extractors/aspects/`), `backend/app/models/`, `backend/tests/unit/`, `backend/tests/integration/`, `frontend/src/components/workflows/`, `frontend/src/hooks/`, `frontend/src/lib/api/`, `frontend/src/pages/`, `docs/HOT-FILE-LEDGER.md`, `.planning/phases/288-*/288-04-SUMMARY.md`.
**Files scanned:** ~40
**Pattern extraction date:** 2026-10-22
