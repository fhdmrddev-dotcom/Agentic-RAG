# Phase 151: Agent File Tools - Research

**Researched:** 2026-07-13
**Domain:** LLM agent tool authoring (Python/FastAPI) — Supabase Storage ↔ Docker sandbox ↔ skill-files bridge; cross-provider function-calling schema design
**Confidence:** HIGH (every mechanism verified against live tree; breadcrumbs re-anchored)

## Summary

Both tools are **pure extensions of mechanisms that already exist in the tree** — this phase invents no new subsystem. FILE-02 (`fetch_document_file`) is the `render_template` ship-into-sandbox pattern (`tool_dispatcher.py:2541-2572`: download bytes in a threadpool → `NamedTemporaryFile` → `session.copy_to_runtime`) pointed at a KB document's original Storage bytes instead of a template, landing at `/sandbox/input/<filename>`. FILE-01 (`attach_skill_file`) is `_upload_skill_files` (`skills.py:113`) lifted into a tool handler, with an owner-only skill-resolution gate and overwrite-in-place semantics added. SC#3 is a one-function widen of the OOXML magic-byte gate in `workspace.py:119` plus a lockstep `accept=` change in `TemplateUpload.tsx:53`.

The G-5 contract holds cleanly: each tool = **one `_handle_X` + one `_TOOL_REGISTRY` line (`tool_dispatcher.py:3193`) + one OpenAI-shape schema added to `get_tools()` (`openai_service.py:1025`)**. `threads.py` is never touched. All cross-provider translation is automatic and centralized — Anthropic (`_convert_tools_to_anthropic`, `input_schema` rename) and Google (`_sanitize_schema_for_google` + `_translate_nullable_type`) already sit at the service boundary, so SC#10 is won by choosing a **flat, `anyOf`/`oneOf`-free arg schema** (the proven D-115 `query_documents_by_view` shape), not by any provider fork.

**Primary recommendation:** Build FILE-02 by cloning the `render_template` `_ship_and_run` copy-in pattern (gate the tool behind `sandbox_enabled`); build FILE-01 by lifting `_upload_skill_files` with an **owner-only** `.eq("user_id", …)` skill gate and a **read-check-then-update/insert (or unique-index upsert)** for D-07. Design both tool schemas as flat OpenAI-function dicts with a required `source` enum discriminator and optional source-specific fields (NO `anyOf`/`oneOf`), descriptions leading with "Use when …" / "Do not use for …". No new external packages.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Resolve KB doc → owner-scoped Storage key | API/Backend (tool handler) | Database (RLS defense-in-depth) | Service-role `.eq(user_id)` is the real runtime gate; RLS is backstop only (no RLS on service-role reads) |
| Stream original bytes → sandbox `/sandbox/input/` | API/Backend + Sandbox container | — | Bytes go disk→disk via `copy_to_runtime`; NEVER into model context (D-02) |
| Read/convert/render the real file | Sandbox (Docker, network-less) | — | python-docx/pptx/openpyxl/pypdf/reportlab already installed; the LLM produces the *code*, the container produces the *file* |
| Persist a file onto a skill | API/Backend (tool handler) | Database + Storage | `skill_files` row + `skill-files` bucket at `{user_id}/{skill_id}/{filename}` |
| Owner-only write gate | API/Backend | Database (RLS) | Must resolve target skill with `.eq(user_id)` NOT the `.or_(…is_global.eq.true)` read filter (T-04) |
| Mid-chat template hand-off | Frontend Server (upload route) → Browser affordance | Sandbox (later, via attach) | Reuse `POST /workspace/files` + `TemplateUpload.tsx`; widen the allowlist only |
| Cross-provider tool exposure | API/Backend service boundary | — | `get_tools()` → per-provider translators; no `provider ==` fork (D-14 red line) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FILE-02 — `fetch_document_file` (READ):**
- **D-01 (no-original behavior — HONEST ERROR):** When a KB document has no stored original, return a clear error (e.g. *"No original file stored for this document — use `read_document`/`analyze_document` for its text."*). NEVER silently write extracted text as a file. Contract is always "real bytes." Agent decides on its own whether to fall back to text.
- **D-02 (size cap — 50 MB, refuse-never-truncate):** Cap ~50 MB. Streamed to disk, NEVER into model context. Over-cap ⇒ honest error stating the actual size. Never truncate a binary. Cap is an **operator-tunable env/setting knob**, not a hardcoded literal.
- **D-03 (landing convention):** Fetched file lands at **`/sandbox/input/<filename>`**. Tool returns the exact absolute path it wrote.
- **D-04 (owner/RLS scope):** Same owner/global gating as `read_document`; never cross-user.

**FILE-01 — `attach_skill_file` (WRITE):**
- **D-05 (attach sources — all four):** (1) Thread workspace file (`workspace_files`), (2) Sandbox output file (`/sandbox/output/…`), (3) Inline content, (4) KB document id.
- **D-06 (write target — any OWNED skill):** `skills.user_id == current_user` (`.eq("user_id", …)`). Global + `is_system` skills NEVER writable. Agent names the target skill explicitly.
- **D-07 (filename collision — OVERWRITE IN PLACE):** Replace existing `skill_files` bytes + row (upsert on `skill_id + filename`). Tool reports `"updated"` vs `"created"`.
- **D-08 (reuse existing write path):** Reuse `_upload_skill_files` (`skills.py:113`) — `skill-files` bucket + `skill_files` row at `{user_id}/{skill_id}/{filename}`. Do NOT invent a new table/bucket.

**SC#3:**
- **D-09 (reuse Phase-100 upload, WIDEN types):** Reuse `TemplateUpload` → `POST /workspace/files` (`upload_template`). Widen the magic-byte allowlist beyond `.docx/.pptx/.xlsx` so scripts, `.md`, `.json`, `.csv`, images can be handed in. One gate to extend.

### Claude's Discretion
- Whether either tool emits an SSE event (e.g. `skill_file_attached` mirroring `workspace_file_written` at `tool_dispatcher.py:1565`) — must stay additive + provider-uniform if added.
- Exact env/setting key name + default for the D-02 size cap.
- Exact tool JSON-schema arg names/shapes (per-provider reliability wording is a researcher/planner concern — SC#10).
- Whether a companion `list_skill_files` read affordance is needed (no delete counterpart this phase — deliberate scope line).

### Deferred Ideas (OUT OF SCOPE)
- `attach_skill_file` delete/list companion tool.
- Sandbox binary parity (soffice/pandoc/pdftoppm — SEED-106) and managed sandbox packages (SEED-043).
- The workflow run-input channel + folder scope (Phase 152 / WFIN-01/02/03).
- Any change to `threads.py` (G-5 hot-file — extraction due; MUST NOT touch).
- BUG-260708-02 (execute_code `libraries` install-timing) and BUG-260708-01 (DeepSeek tool-markup leak) — LEFT OPEN, not folded.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-02 | Materialize a KB document's ORIGINAL bytes into the sandbox working dir via new `fetch_document_file` (owner/RLS-scoped, size-capped, streamed to disk) | `render_template` copy-in pattern (`tool_dispatcher.py:2541-2572`); owner-scope resolver `read_path` (`kb.py:385`) + `resolve_document_id` (`retrieval_service.py:189`); `documents.file_path`/`file_size` columns (`full-schema.sql:661-667`); `documents.py:711` threadpool download idiom |
| FILE-01 | Attach files (4 sources) to an owned skill via new `attach_skill_file` — owner-scoped, reuse `skill_files` + bucket, own threat model | `_upload_skill_files` (`skills.py:113`); owner gate `.eq("user_id")` (`skills.py:439/468`); workspace bytes reader `_get_file_content` (`workspace_service.py:176`); sandbox harvest `harvest_output_files` (`sandbox_service.py:201`); FILE-02 fetch path reused for source #4 |
| SC#3 | User hands a template mid-conversation → agent attaches it | `validate_ooxml` widen (`workspace.py:119`, `_ALLOWED_EXT` at `:114`); `upload_template` route (`workspace.py:149-204`); `TemplateUpload.tsx:53` `accept=` |
| SC#4 | Neither tool can read/write another user's docs/skills (cross-user proven) | Owner-scope resolvers above; T-01/T-04 mitigations |
| SC#10 | Both hold across providers | Flat schema (no `anyOf`/`oneOf`) + centralized translators (`_convert_tools_to_anthropic` `anthropic_service.py:123`, `_sanitize_schema_for_google` `google_service.py:312`); D-14 no-fork dispatch |
</phase_requirements>

## Standard Stack

**No new external packages.** Both tools compose existing installed infrastructure. The Package Legitimacy Audit is therefore **N/A** (no npm/PyPI/crates install in this phase).

### Core (existing, reused)
| Component | Location | Purpose | Why standard |
|-----------|----------|---------|--------------|
| `supabase-py` Storage client | `supabase.storage.from_(bucket)` | download/upload/remove object bytes | Already the only Storage client; `.download()`/`.upload()` used throughout |
| `llm_sandbox` `InteractiveSandboxSession` | `sandbox_service.py` (lazy import) | Docker sandbox; `.copy_to_runtime` / `.copy_from_runtime` / `.execute_command` | Only sandbox substrate; session cached per `thread_id` |
| `run_in_threadpool` | `starlette.concurrency` (via `app.utils.db.aexec` for DB) | wrap blocking Storage/DB/container I/O (D-v2.5-01) | MANDATORY project rule — see Pitfall 1 |
| Sandbox packages | `docs/SANDBOX-PACKAGES.md` / `Dockerfile.sandbox` tag `101.1` | python-docx/pptx/openpyxl/pypdf/reportlab/docxtpl already installed | FILE-02 unlocks python-native processing on real bytes today |

### Supporting (existing helpers to reuse — do not re-implement)
| Helper | Location | Use case |
|--------|----------|----------|
| `resolve_document_id(filename, user_id, supabase)` | `retrieval_service.py:189` | fuzzy filename → doc UUID, **owner-only** (`.eq(user_id)`, no global fallback) |
| `read_path(...)` scope shape | `kb.py:385` | owner→global-folder two-step resolution model (what D-04 means by "same as read_document") |
| `_upload_skill_files(files, skill_id, user_id, supabase)` | `skills.py:113` | bucket upload + `skill_files` insert, per-file error resilience |
| `_get_file_content(pool, supabase, file_row)` | `workspace_service.py:176` | read workspace file bytes (inline bytea OR Storage), already threadpool-safe |
| `harvest_output_files` / `copy_from_runtime` | `sandbox_service.py:201/264` | pull `/sandbox/output/<name>` bytes out of the container |
| `validate_ooxml(filename, raw)` | `workspace.py:119` | the magic-byte gate to generalize for D-09 |
| filename sanitizer (WR-05) | `workspace.py:184-185` | `re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)` + collapse `..` — reuse for T-01 path-traversal defense |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `copy_to_runtime` (put_archive) for FILE-02 | base64-preamble + `execute_code`-style inline write (`tool_dispatcher.py:1117-1122`) | The base64 preamble embeds the whole file as a string inside a Python source and executes it — fine for tiny skill files, **wasteful/fragile for a 50 MB doc**. Use `copy_to_runtime` (the `render_template` path). |
| Unique-index atomic upsert for D-07 | read-check-then-update/insert | See Open Question 1 — no `(skill_id, filename)` unique constraint exists today; read-check races under WORKER_COUNT=2 |
| `app_settings` key for D-02 cap | env var | CLAUDE.md rule: dynamic/operator-tunable → `app_settings` (precedent: `template_ttl_hours` at `workspace.py:177`). Env is for secrets/infra only. |

**Installation:** none.

## Architecture Patterns

### System Data Flow

```
FILE-02  fetch_document_file(document_id | filename)
  agent tool call
    → dispatch_tool (tool_dispatcher.py:3307)  [flag/whitelist gates → _TOOL_REGISTRY]
      → _handle_fetch_document_file(args, ctx)
          1. resolve doc  → owner-scope SELECT (id, filename, file_path, file_size, mime_type)
                            [.eq(user_id) → global-folder fallback]   ← D-04
          2. size gate    → if file_size > cap: return {"error": "…N MB > cap"}  ← D-02 (PRE-download)
          3. no original  → if not file_path: return {"error": "No original file stored…"}  ← D-01
          4. download     → await run_in_threadpool(storage.from_("documents").download, file_path)  ← Pitfall 1
          5. sanitize     → safe = basename + charset scrub                     ← T-01 path traversal
          6. ship         → _ship_and_run in threadpool:
                              session = sandbox_manager.get_or_create(thread_id)
                              execute_command("mkdir -p /sandbox/input")
                              NamedTemporaryFile(bytes) → session.copy_to_runtime(tmp, "/sandbox/input/<safe>")
          7. return       → {"status":"ok","path":"/sandbox/input/<safe>","size_bytes":N,"mime_type":…}

FILE-01  attach_skill_file(target_skill_name, filename, source, [source-specific args])
  agent tool call
    → _handle_attach_skill_file(args, ctx)
        1. resolve target skill  → .eq(user_id).eq(name)  OWNER-ONLY   ← T-04 / D-06 (NOT .or_(is_global))
        2. resolve bytes by source discriminator:
             workspace → workspace_files row + _get_file_content
             sandbox   → copy_from_runtime("/sandbox/output/<name>")
             inline    → arg string (utf-8 / base64)                   ← weak-model guard
             kb_doc    → FILE-02 owner-scope fetch (reuse resolver)     ← T-03 data-movement note
        3. collision → SELECT (skill_id, filename); exists? UPDATE+overwrite : INSERT  ← D-07
        4. storage   → upload with upsert=true  (path {user_id}/{skill_id}/<filename>)
        5. (optional) emit "skill_file_attached" SSE                    ← Claude's discretion
        6. return    → {"status":"created"|"updated","filename":…,"skill":…}

SC#3  user file  → TemplateUpload.tsx (widened accept) → POST /workspace/files
                 → validate_upload (widened allowlist) → workspace_files kind='template_input'
                 → agent then calls attach_skill_file(source="workspace")
```

### Recommended Structure (files touched)
```
backend/app/services/tool_dispatcher.py   # + _handle_fetch_document_file, + _handle_attach_skill_file, + 2 registry lines
backend/app/services/openai_service.py     # + FETCH_DOCUMENT_FILE_TOOL, + ATTACH_SKILL_FILE_TOOL, + 2 lines in get_tools()
backend/app/api/workspace.py               # widen validate_ooxml → validate_upload (D-09)
frontend/src/components/panel/TemplateUpload.tsx  # widen accept= (lockstep with D-09)
backend/tests/unit/test_151_*.py           # NEW — schema-shape, registry, handler, cross-user isolation
supabase/migrations/NNN_*.sql              # ONLY IF the D-07 unique-index path is chosen (see Open Q1)
```

### Pattern 1: G-5 dual-wiring (registry + get_tools)
**What:** A new agent tool must be registered in BOTH `_TOOL_REGISTRY` (`tool_dispatcher.py:3193`, so `dispatch_tool` can route it) AND `get_tools()` (`openai_service.py:1025`, so the model actually SEES it). A registry entry the model never sees is dead; a schema the registry can't route 500s.
**When to use:** every new tool, no exception.
**Example:**
```python
# tool_dispatcher.py — registry (add inside _TOOL_REGISTRY dict)
"fetch_document_file": _handle_fetch_document_file,
"attach_skill_file": _handle_attach_skill_file,

# openai_service.py get_tools() — FILE-02 gated on sandbox (it materializes INTO the container)
if sandbox_enabled:
    tools.append(EXECUTE_CODE_TOOL)
    tools.append(FETCH_DOCUMENT_FILE_TOOL)   # recommended: sandbox-gated
tools.append(ATTACH_SKILL_FILE_TOOL)         # or gate on self_improve_enabled — see Open Q2
```

### Pattern 2: Ship bytes into the sandbox (FILE-02 core — copy the render_template path)
**What:** Download bytes in a threadpool, write to a local `NamedTemporaryFile`, then `session.copy_to_runtime(local, container_path)` after `mkdir -p` the target dir. All container/Storage I/O inside a single threadpool call.
**Source:** `tool_dispatcher.py:2541-2572` (`render_template` `_ship_and_run` / `_copy_in`).
```python
# Source: tool_dispatcher.py:2549-2568 (render_template) — the exact pattern FILE-02 mirrors
def _ship_and_run() -> dict:
    session = sandbox_manager.get_or_create(ctx.thread_id)
    try:
        session.execute_command("mkdir -p /sandbox/input")   # D-03 landing dir
    except Exception:
        pass
    with _tempfile_local.NamedTemporaryFile(mode="wb", delete=False) as _tmp:
        _tmp.write(doc_bytes)
        _local = _tmp.name
    try:
        session.copy_to_runtime(_local, f"/sandbox/input/{safe_name}")
    finally:
        try: _os_local.unlink(_local)
        except OSError: pass
    return {"path": f"/sandbox/input/{safe_name}"}
result = await run_in_threadpool(_ship_and_run)   # D-v2.5-01
```

### Pattern 3: Owner-scope resolution (both tools)
**What:** Reads use `.or_(f"user_id.eq.{id},is_global.eq.true")` (own + global). **Owner-only WRITES use `.eq("user_id", id)`** — the real service-role runtime gate (RLS is defense-in-depth only; there is no RLS backstop on service-role reads). FILE-02 read must mirror `read_path`'s two-step (owner → globally-visible folder). FILE-01 write must use the owner-only `.eq(user_id)` skill gate (`skills.py:439/468`), NEVER the read filter.
**Source:** `kb.py:385` (read_path owner→global), `skills.py:438-440` (owner-only write gate), `retrieval_service.py:189` (owner-only filename resolve).

### Anti-Patterns to Avoid
- **Touching `threads.py`** — G-5 hot-file ledger; the extraction is already overdue. Both tools are handler-only.
- **A `provider ==` branch anywhere** (D-14 red line). All provider differences already live in the centralized translators.
- **`anyOf`/`oneOf`/`allOf`/`additionalProperties`/`$ref` in the tool schema** — Google's `_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` (`google_service.py:249`) strips them; a discriminated-union schema silently loses its constraints on the Google boundary. Use the flat `source`-enum shape.
- **Base64-embedding a 50 MB doc into a Python source string** to inject it — use `copy_to_runtime`.
- **Reusing the `execute_code` skill-file injection's filename handling** — it only does `.replace("'", "\\'")` (`tool_dispatcher.py:1116`), which does NOT stop `../` traversal. Sanitize with `basename` + charset scrub (T-01).
- **Bare `.upload()` on a colliding path** — Supabase Storage `.upload()` 409s on an existing object; D-07 overwrite REQUIRES `file_options={"upsert": "true"}` (or `.update()`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy Storage bytes into the sandbox | A new base64/exec injector | `render_template` `_ship_and_run` copy pattern (`tool_dispatcher.py:2549`) | put_archive handles large binaries; already threadpool-wrapped |
| Skill file persist | A new table/bucket/insert | `_upload_skill_files` (`skills.py:113`) | D-08 constraint; per-file error resilience already solved |
| Read workspace file bytes | Manual inline-vs-storage branch | `_get_file_content` (`workspace_service.py:176`) | already handles `content_inline` bytea vs `content_storage_path` + threadpool |
| Pull sandbox output bytes | Raw docker cp | `copy_from_runtime` / `harvest_output_files` (`sandbox_service.py:201`) | trailing-slash + tmpdir-walk gotchas already solved |
| Fuzzy filename → doc | New ILIKE query | `resolve_document_id` (`retrieval_service.py:189`) | owner-scoped, exact-then-partial already tuned |
| Cross-provider tool translation | Per-provider schema hand-shaping | `get_tools()` + `_convert_tools_to_anthropic` / `_convert_tools_to_google` | one source schema, translators at the boundary |
| Magic-byte validation | New sniffer | Generalize `validate_ooxml` (`workspace.py:119`) | ZIP/OOXML checks + size guard already correct |

**Key insight:** Every byte-moving primitive this phase needs already exists and is already threadpool-safe. The work is *composition + gating + a threat model*, not new plumbing.

## Runtime State Inventory

> This is an additive-tool phase (no rename/migration of existing state), but D-07's overwrite semantics and the D-09 provenance widening touch stored data — inventoried for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `skill_files` rows + `skill-files` bucket objects at `{user_id}/{skill_id}/{filename}`. D-07 overwrite mutates existing rows + Storage bytes in place. | Storage `.upload(upsert=true)` (overwrite bytes) + DB update-or-insert. NO backfill/migration of existing rows. |
| Stored data (docs) | `documents.file_path` points at original bytes in the `documents` bucket. Older text-only ingests may have a row but no retrievable original. | D-01 honest-error path (handle download-miss, not just null `file_path`). |
| Live service config | None — no external UI/DB-only config carries a renamed string. | None — verified: no rename in this phase. |
| OS-registered state | None. | None. |
| Secrets/env vars | Optional new `app_settings` key for the D-02 cap (e.g. `fetch_document_file_max_mb`). Not a secret. | Add to `app_settings` substrate + optionally Settings UI (Claude's discretion on surfacing). |
| Build artifacts | None — no package/build change. Sandbox image tag `101.1` already ships the processing libs. | None. |

**Test-count artifacts (stale-after-add):** three exact-count assertions WILL break when two tools are added — `test_085_tool_registration.py:272` (`len(base_tools) == 22`), `:280` (`len(all_tools) == 24`), `test_tool_dispatcher.py:68` (`len(_TOOL_REGISTRY) == 27`). Update all three (run the suite to read the new exact numbers).

## Common Pitfalls

### Pitfall 1: Blocking I/O in the async handler
**What goes wrong:** Storage `.download()`/`.upload()`, `skill_files` insert, and every `session.*` container call are blocking; called directly they freeze the event loop under WORKER_COUNT=2.
**Why it happens:** The existing `execute_code` skill-file injection at `tool_dispatcher.py:1114` does an **un-wrapped** `storage.from_("skill-files").download(...)` inside the async handler — a pattern NOT to copy.
**How to avoid:** Wrap every blocking call: DB via `aexec(...)`, Storage/container via `await run_in_threadpool(fn, *args)`. The `documents.py:711` (`run_in_threadpool(supabase.storage.from_("documents").download, file_path)`) and `workspace_service.py:169` (`_read_from_storage`) idioms are the templates.
**Warning signs:** a handler that awaits nothing but calls `.download()`/`.execute()` directly.

### Pitfall 2: Storage `.upload()` collides on overwrite (D-07)
**What goes wrong:** Second attach of the same filename 409s; the file silently isn't replaced.
**How to avoid:** `file_options={"upsert": "true"}` on the `.upload()` (or `.update()`), AND handle the DB row (update-or-insert). Both halves needed.
**Warning signs:** "Duplicate"/409 in logs; tool reports `"created"` but bytes are stale.

### Pitfall 3: Google rejects union/map schema keys
**What goes wrong:** A discriminated-union tool schema (`oneOf` per source) constructs fine for OpenAI/Anthropic but 400s or silently drops constraints on Gemini — and Google validates the whole Tool object as a unit, so ONE bad param kills the entire tool list.
**Why it happens:** `_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` (`google_service.py:249`) strips `oneOf/anyOf/allOf/additionalProperties/$ref/…`; multi-type `type: [...]` arrays are collapsed by `_translate_nullable_type`.
**How to avoid:** Flat schema — required `source` enum + required `target_skill_name`/`filename`, optional source-specific string fields; no conditional keywords. Mirror `query_documents_by_view` (`test_115_tool_schema.py` asserts no `anyOf`/`oneOf`). Optional fields either omit from `required` OR type them `["string","null"]` (the sanitizer collapses to `{type:"string", nullable:true}`).
**Warning signs:** a Gemini Deep run where the tool never fires but OpenAI/Anthropic use it fine.

### Pitfall 4: Path traversal via `documents.filename` / crafted `file_path`
**What goes wrong:** A filename like `../../etc/x` lands the fetched file outside `/sandbox/input/`.
**How to avoid:** `os.path.basename(filename)` then the `workspace.py:184` charset scrub before building `/sandbox/input/<safe>`. Never trust `documents.filename` (user-set at upload). (T-01.)

### Pitfall 5: Owner-scope drift — using the READ filter for a WRITE
**What goes wrong:** Resolving the target skill with `.or_(user_id.eq.{id},is_global.eq.true)` lets the agent attach to a global/built-in skill.
**How to avoid:** Owner-only `.eq("user_id", current_user["id"])` on the skill resolution (`skills.py:439/468` is the reference). Also confirm the skill is not `is_system` (belt-and-braces; owner-only already excludes global/system since they aren't owned by the caller). (T-04.)

### Pitfall 6: FILE-02 needs a sandbox that may be disabled
**What goes wrong:** `sandbox_manager.get_or_create` triggers the lazy `llm_sandbox`/Docker import; with `SANDBOX_ENABLED=false` this fails.
**How to avoid:** Gate `FETCH_DOCUMENT_FILE_TOOL` behind `sandbox_enabled` in `get_tools()` (append next to `EXECUTE_CODE_TOOL`), and add it to `_CAPABILITY_FLAG_TOOLS` (`tool_dispatcher.py:3275`) so the operator sandbox kill-switch also refuses it in-flight (fail-closed, provider-uniform).

## Code Examples

### Owner-scoped original-bytes resolver (FILE-02 — mirrors read_path scope, selects storage cols)
```python
# Model: kb.py:385 read_path (owner→global), but SELECT file_path/file_size not full_markdown.
# accept document_id (precise, like read_document) — optional filename via resolve_document_id.
res = await aexec(
    ctx.supabase.table("documents")
    .select("id, filename, file_path, file_size, mime_type")
    .eq("id", document_id).eq("user_id", ctx.current_user["id"]).maybe_single()
)
row = res.data if res else None
if not row:
    # global-folder fallback (matches read_document scope — D-04)
    gfids = await get_globally_visible_folder_ids(ctx.supabase, ctx.current_user["id"])
    if gfids:
        res = await aexec(ctx.supabase.table("documents")
            .select("id, filename, file_path, file_size, mime_type")
            .eq("id", document_id).in_("folder_id", gfids).maybe_single())
        row = res.data if res else None
if not row:
    return ToolResult(result=json.dumps({"error": "Document not found or access denied."}))
if not row.get("file_path"):
    return ToolResult(result=json.dumps({"error":
        "No original file stored for this document — use read_document/analyze_document for its text."}))  # D-01
if row["file_size"] > cap_bytes:  # D-02 PRE-download
    return ToolResult(result=json.dumps({"error":
        f"File is {row['file_size']//1024//1024} MB, over the {cap_bytes//1024//1024} MB fetch limit."}))
```

### Overwrite-in-place write (D-07, read-check path — no migration)
```python
# Source-agnostic: `file_bytes` already resolved from one of the 4 sources.
existing = await aexec(ctx.supabase.table("skill_files")
    .select("id").eq("skill_id", skill_id).eq("filename", filename)
    .eq("user_id", uid).maybe_single())
storage_path = f"{uid}/{skill_id}/{filename}"
await run_in_threadpool(lambda: ctx.supabase.storage.from_("skill-files").upload(
    path=storage_path, file=file_bytes,
    file_options={"content-type": mime, "upsert": "true"}))   # Pitfall 2
if existing and existing.data:
    await aexec(ctx.supabase.table("skill_files").update(
        {"file_size": len(file_bytes), "mime_type": mime})
        .eq("id", existing.data["id"]))
    status = "updated"
else:
    await aexec(ctx.supabase.table("skill_files").insert(
        {"skill_id": skill_id, "user_id": uid, "filename": filename,
         "file_path": storage_path, "file_size": len(file_bytes), "mime_type": mime}))
    status = "created"
```
> Race note: under WORKER_COUNT=2, two concurrent same-filename attaches can both miss the SELECT and both INSERT → duplicate rows. The robust fix is a `(skill_id, filename)` unique index + PostgREST `.upsert(on_conflict=...)` — see Open Question 1.

### Generalized upload allowlist (D-09)
```python
# workspace.py:119 today: OOXML-only. Generalize to a per-category validator.
# Keep the strict ZIP/OOXML checks for .docx/.pptx/.xlsx; add branches:
#   text-ish (.md/.json/.csv/.txt/.py/.js/.sh): decode-utf8 sanity + size guard (reject NUL-heavy binaries)
#   images (.png/.jpg/.gif/.webp): leading magic bytes (\x89PNG, \xFF\xD8\xFF, GIF8, RIFF…WEBP)
# Provenance stays kind='template_input' (T-02) — untrusted; NEVER routed to the Jinja engine.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discriminated-union tool args (`oneOf`) | Flat arg set + `source` enum discriminator, no conditional JSON-Schema keywords | Phase 115 (D-115, `query_documents_by_view`) | The only cross-provider-safe function-calling shape; Gemini rejects `oneOf`/`anyOf` |
| All-props-`required` strict schemas (Phase 085) | Optional fields OK for auto-called tools (only *forced* json_schema shots use `strict:true`) | Phase 122 (`openai_service.py:1755`) | FILE-01's optional source fields are safe — the tools are never force-strict-emitted |
| Single-worker in-proc singletons (CONVENTIONS.md, 2026-05-09) | **Multi-worker default WORKER_COUNT=2** (D-PRD-12) | v2.5+ | No per-process singleton assumptions; D-07 race matters — `CONVENTIONS.md:270/301` is stale on this point |
| Agent reconstructs a doc from text (DeepSeek/MiniMax overclaim) | Materialize original bytes → process the real file | This phase (SEED-108) | Kills the "converted your file" overclaim; honesty is a first-class product value |

**Deprecated/outdated:**
- CONVENTIONS.md "Single uvicorn worker (D-v2.5-02)" — superseded by WORKER_COUNT=2 (CLAUDE.md). Treat all in-memory state as multi-worker-unsafe.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-02 cap belongs in `app_settings` (key like `fetch_document_file_max_mb`, default 50) resolved via the existing TTL-cache, not an env var | Standard Stack / Alternatives | Low — CLAUDE.md rule is explicit; key name is Claude's discretion anyway |
| A2 | FILE-02 should be **sandbox-gated** in `get_tools()` and added to `_CAPABILITY_FLAG_TOOLS` | Pitfall 6 / Pattern 1 | Medium — if left ungated, a `SANDBOX_ENABLED=false` env 500s the tool; planner should confirm |
| A3 | FILE-01 attach is a skill-authoring action; gating it behind `self_improve_enabled` (like `save_skill`) is consistent but NOT locked by CONTEXT | Open Q2 | Medium — affects whether an operator self-improve kill-switch also disables attach |
| A4 | D-07 is best served by a NEW `(skill_id, filename)` unique index + upsert (a migration), despite CONTEXT's "no new migration expected" | Open Q1 | Medium — read-check path works but races under 2 workers; needs a decision |
| A5 | FILE-02 accepts a `document_id` primary (optionally a `filename` via `resolve_document_id`); `resolve_document_id` is owner-ONLY so a filename path can't reach a global-folder doc | Code Examples / Open Q3 | Low — document_id path fully matches D-04; filename is ergonomics |
| A6 | Widened-upload text validation = utf-8-decodable + size guard; image validation = leading magic bytes | Code Examples (D-09) | Medium — exact allowlist + per-type checks are a planner/security decision (T-02) |

## Open Questions

1. **D-07 overwrite: unique-index upsert (migration) vs read-check-then-write?**
   - What we know: `skill_files` has NO unique constraint on `(skill_id, filename)` — only PK `id` + non-unique indexes on `skill_id`/`user_id` (`full-schema.sql:1116-1125, 2455-2465`). PostgREST `.upsert(on_conflict="skill_id,filename")` therefore cannot work today.
   - What's unclear: CONTEXT says "no new migration expected" — but atomic upsert under WORKER_COUNT=2 requires the unique index.
   - Recommendation: add a tiny migration `CREATE UNIQUE INDEX skill_files_skill_filename_uniq ON public.skill_files (skill_id, filename);` then `.upsert(on_conflict="skill_id,filename")`. A unique index on the existing table is hardening, not "inventing a new table/bucket" (D-08 satisfied). If the operator prefers zero-migration, use the read-check path and accept the (rare) duplicate-row race, deduping on read. **Surface at discuss/plan.**

2. **Should FILE-01 be gated behind `self_improve_enabled`?** `save_skill` is (both hidden in `get_tools()` and refused in `_CAPABILITY_FLAG_TOOLS`). Attaching a file to a skill is a skill-authoring write. Recommendation: gate it the same way for consistency; confirm with operator.

3. **FILE-02 arg: `document_id` vs `filename` vs both?** `read_document` uses `document_id` (owner→global via `read_path`); `analyze_document` uses `filename` (owner-only via `resolve_document_id`). Recommendation: accept `document_id` as the precise, D-04-faithful key; optionally accept `filename` for ergonomics but note it's owner-only (can't reach a global-folder doc). Planner picks the arg surface.

4. **SSE event for attach (Claude's discretion):** emit `skill_file_attached` mirroring `workspace_file_written` (`tool_dispatcher.py:1565`) so a UI could reflect it live? No skills-panel live-reconcile consumer exists today, so this is optional; must stay additive + provider-uniform if added.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker + `llm_sandbox` | FILE-02 (materialize into container), FILE-01 source #2 (sandbox output) | ✓ (dev default) | image tag `101.1` | If `SANDBOX_ENABLED=false`: gate FILE-02 out of `get_tools()`; FILE-01 source #2 returns honest error |
| Supabase Storage (`documents`, `skill-files` buckets) | Both tools | ✓ | local + cloud | none (core dependency) |
| Sandbox processing libs (python-docx/pptx/openpyxl/pypdf/reportlab) | Downstream use of fetched file | ✓ | `Dockerfile.sandbox` tag `101.1` | Faithful *format conversion* still needs soffice/pandoc (SEED-106, out of scope) — python-native processing works today |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** sandbox disabled → FILE-02 hidden; faithful binary conversion (soffice/pandoc) deferred to SEED-106.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode = auto`) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/unit/test_151_*.py -x` |
| Full suite command | `cd backend && python -m pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-02 | schema is flat, no `anyOf`/`oneOf`, correct name/params | unit (schema-shape) | `pytest tests/unit/test_151_tool_schema.py -x` | ❌ Wave 0 |
| FILE-02 | `fetch_document_file` in `_TOOL_REGISTRY` AND `get_tools()` (dual-wiring, sandbox-gated) | unit (registry) | `pytest tests/unit/test_151_registration.py -x` | ❌ Wave 0 |
| FILE-02 | no-original → honest error (D-01); over-cap → error w/ size (D-02); happy → `/sandbox/input/<f>` path returned (D-03) | unit (handler, mocked supabase+session) | `pytest tests/unit/test_151_fetch_handler.py -x` | ❌ Wave 0 |
| FILE-02 | path traversal filename sanitized (T-01) | unit | same file | ❌ Wave 0 |
| FILE-01 | 4 sources each resolve bytes; created vs updated (D-07) | unit (handler) | `pytest tests/unit/test_151_attach_handler.py -x` | ❌ Wave 0 |
| FILE-01 | owner-only gate: attach to global/`is_system` skill refused (T-04) | unit | same file | ❌ Wave 0 |
| SC#3 | widened allowlist accepts `.md/.json/.csv/.png`; rejects renamed binary (`renamed_binary_bytes` fixture) | unit (validator) | `pytest tests/unit/test_151_upload_allowlist.py -x` | ❌ Wave 0 |
| SC#4 | cross-user: fetch/attach with a non-owner user_id → not-found/refuse (owner-scope returns empty `.data`) | unit (both handlers) | in `_fetch_handler`/`_attach_handler` files | ❌ Wave 0 |
| SC#10 | both tools survive Anthropic/Google translation (`_convert_tools_to_google(get_tools())` constructs without error) | unit (translation) | `pytest tests/unit/test_151_cross_provider_schema.py -x` | ❌ Wave 0 |
| SC#4 + SC#10 | live cross-user + cross-provider exercise | manual UAT (VALIDATION.md) | Chrome MCP / operator-driven | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_151_*.py -x`
- **Per wave merge:** `pytest tests/unit -x` (catch the 3 stale exact-count assertions early)
- **Phase gate:** full suite green before `/gsd:verify-work`; live 4-axis UAT recorded in VALIDATION.md.

### 4-Axis Live UAT (SC#10 recipe — MANDATORY, authored in VALIDATION.md not PLAN)
| Axis | Required row |
|------|--------------|
| Cross-provider | `fetch_document_file` + `attach_skill_file` each fired successfully on OpenAI, Anthropic, Google, OpenRouter (one representative model each) |
| Multi-tool | one prompt: `fetch_document_file` → `execute_code` (open the real .docx with python-docx) → `attach_skill_file` (sandbox output) in a single turn |
| Parallel-thread | Thread A mid-fetch while Thread B accepts a new prompt (session cached per `thread_id` — verify no cross-thread bleed) |
| Long-message | attach with a ≥50-prior-message history OR a ≥5 KB inline-content arg (weak-model mangling check) |

### Wave 0 Gaps
- [ ] `tests/unit/test_151_tool_schema.py` — schema-shape (model on `test_115_tool_schema.py`)
- [ ] `tests/unit/test_151_registration.py` — dual-wiring + fix `test_085_tool_registration.py:272/280` + `test_tool_dispatcher.py:68` counts
- [ ] `tests/unit/test_151_fetch_handler.py` — FILE-02 handler + T-01 + SC#4
- [ ] `tests/unit/test_151_attach_handler.py` — FILE-01 handler + D-07 + T-04 + SC#4
- [ ] `tests/unit/test_151_upload_allowlist.py` — D-09 (reuse `valid_docx_bytes`/`renamed_binary_bytes` conftest fixtures)
- [ ] `tests/unit/test_151_cross_provider_schema.py` — `_convert_tools_to_google`/`_convert_tools_to_anthropic` construct both new tools
- [ ] `conftest.py` `make_tool_context` fixture already exists — reuse for handler tests (no new fixture needed)

## Security Domain

> `security_enforcement` is not `false` in config → included. Each tool ships its OWN threat model (MANDATORY per ROADMAP). ASVS L1, block on high.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | G-5 handler-only; no `threads.py` change; no `provider ==` fork |
| V4 Access Control | **yes (central)** | Owner-scope: `.eq(user_id)` write gate + owner→global read scope; cross-user proof (SC#4) |
| V5 Input Validation | **yes** | Widened upload magic-byte/MIME allowlist; filename sanitization (path traversal); size caps |
| V6 Cryptography | no | no new secrets; provider keys already encrypted (Phase 150) |
| V8 Data Protection | yes | Streamed to disk never into model context (D-02); Storage bytes never logged |
| V12 Files & Resources | **yes (central)** | Path traversal to `/sandbox/input/`; untrusted-file → skill → `execute_code` provenance (T-02) |

### Per-Tool Threat Models

**FILE-02 `fetch_document_file` — T-01 (read-exfil / path / size):**
| Threat | STRIDE | Mitigation (code location) | Proof |
|--------|--------|----------------------------|-------|
| Read another user's private doc | Information Disclosure | owner→global resolver, `.eq(user_id)` first (`kb.py:385` shape); service-role has no RLS backstop so the app gate is load-bearing | SC#4 unit: non-owner user_id → empty `.data` → not-found |
| Path traversal via crafted `documents.filename` escaping `/sandbox/input/` | Tampering | `os.path.basename` + `workspace.py:184` charset scrub before landing | unit: filename `../../x` lands as `_.._.._x` under `/sandbox/input/` |
| Memory exhaustion / context flood via huge file | DoS | `documents.file_size` gate PRE-download (D-02); bytes to disk via `copy_to_runtime`, never into `ToolResult` | unit: file_size > cap → error, no download attempted |
| Refuse-never-truncate (corrupt half-binary) | Integrity | over-cap = hard error, no partial write | unit: no partial file materialized on over-cap |

**FILE-01 `attach_skill_file` — T-02/T-03/T-04:**
| Threat | STRIDE | Mitigation (code location) | Proof |
|--------|--------|----------------------------|-------|
| **T-04** Write to a global/`is_system` skill | Elevation of Privilege / Tampering | Resolve target with owner-only `.eq("user_id", id)` (`skills.py:439/468`), NEVER `.or_(is_global.eq.true)`; also reject `is_system` | unit: attach to global/system skill → refuse |
| **T-02** Untrusted upload → skill → sandbox exec | Tampering / Elevation | Widened allowlist keeps magic-byte + size gate + `kind='template_input'` provenance (`workspace.py:195`); Python skill files are executable via `execute_code` injection (`tool_dispatcher.py:1080`) — the widen is deliberate but the provenance stamp must survive | unit: upload provenance is `template_input`; allowlist rejects renamed binary |
| **T-03** KB doc → my skill → make skill global → other users read | Information Disclosure (legitimate but explicit) | Same owner-scope gate on both doc (source #4) and skill; making a skill global is already an explicit owner action (`is_global` hard-set False on create, `skills.py:240`) — document the path, don't block the legitimate action | threat-model note + owner-scope unit tests |
| Storage overwrite of a colliding path outside the owner prefix | Tampering | storage path always `{current_user.id}/{skill_id}/{filename}` — owner-prefixed, never model-supplied | unit: path built from ctx user id, not args |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant read via service-role (no RLS backstop) | Info Disclosure | app-layer `.eq(user_id)` is the real gate — always present, always tested cross-user |
| Zip/office bomb on widened upload | DoS | size guard trips before ZIP parse (`workspace.py:135`); keep for all new types |
| Provenance laundering (untrusted file → trusted Jinja engine) | Tampering | `template_input` files NEVER routed to docxtpl Jinja render (RESEARCH lock — Jinja gets library templates only); attach keeps provenance |

## Sources

### Primary (HIGH confidence — verified live in tree, 2026-07-13)
- `backend/app/services/tool_dispatcher.py` — `ToolContext` (:82), `_handle_read_document` (:241), `_handle_read_skill_file` (:908), `_handle_execute_code` skill-file injection (:1080-1137, lands at `/sandbox/{name}` — NOT `/sandbox/input/`), `_handle_workspace_write` + `workspace_file_written` SSE (:1552/:1565), G-5 contract comment (:1704-1720), `render_template` `_ship_and_run`/`_copy_in` (:2541-2572), `_TOOL_REGISTRY` (:3193), `_CAPABILITY_FLAG_TOOLS` (:3275), `dispatch_tool` (:3307)
- `backend/app/services/openai_service.py` — tool schema dicts (READ_DOCUMENT :344, READ_SKILL_FILE :472), `get_tools()` (:1025, conditional sandbox/self_improve appends :1063-1068), `apply_tool_budget` (:1072, harness-only), forced-only `strict:true` (:1755)
- `backend/app/services/anthropic_service.py` — `_convert_tools_to_anthropic` (:123, `input_schema` rename)
- `backend/app/services/google_service.py` — `_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` (:249), `_translate_nullable_type` (:270), `_sanitize_schema_for_google` (:312), `_convert_tools_to_google` (:346)
- `backend/app/api/skills.py` — `_upload_skill_files` (:113), `create_skill` `is_global=False` hard-set (:240), owner-only `.eq(user_id)` gates (:439/:468), `delete_skill` storage remove (:475)
- `backend/app/api/workspace.py` — `_ALLOWED_EXT` (:114), `validate_ooxml` magic-byte gate (:119), `upload_template` `POST /workspace/files` + `kind='template_input'` (:149-204), WR-05 filename sanitize (:184)
- `backend/app/api/documents.py` — threadpool Storage download idiom (:711), `MAX_FILE_SIZE = 50MB` constant (:387)
- `backend/app/api/kb.py` — `read_path` owner→global resolver (:385)
- `backend/app/services/retrieval_service.py` — `resolve_document_id` owner-only fuzzy resolve (:189)
- `backend/app/services/workspace_service.py` — `_read_from_storage` (:169, threadpool), `_get_file_content` inline-vs-storage (:176), `MAX_FILE_SIZE=10MB` (:34)
- `backend/app/services/sandbox_service.py` — `get_or_create` (:25), `harvest_output_files`/`copy_from_runtime` (:201/:264), `snapshot_output_baseline` (:364)
- `supabase/full-schema.sql` — `documents` table cols incl `file_path`/`file_size` (:661-667), `skill_files` table NO `(skill_id,filename)` unique (:1116-1125), `skills.is_system` (:1284), `workspace_files` incl `kind`/`content_inline`/`content_storage_path` (:1543-1560), skill_files RLS policies (:3277/:3410/:3599)
- `frontend/src/components/panel/TemplateUpload.tsx` — `accept=".docx,.pptx,.xlsx"` (:53)
- `backend/tests/conftest.py` — `make_tool_context` (:679), OOXML byte fixtures + `renamed_binary_bytes` (:966-1033); `backend/tests/unit/test_115_tool_schema.py`, `test_085_tool_registration.py` (exact-count asserts :272/:280), `test_tool_dispatcher.py:68` (`_TOOL_REGISTRY == 27`)

### Secondary (MEDIUM — project docs)
- `.planning/phases/151-agent-file-tools/151-CONTEXT.md` (D-01..D-09, T-01..T-04)
- `.planning/seeds/SEED-108`, `SEED-104`; `.planning/REQUIREMENTS.md` (FILE-01/02); `CLAUDE.md` (WORKER_COUNT=2, G-5 ledger, provider-docs-first, D-14 red line); `docs/SANDBOX-PACKAGES.md`

### Provider-docs-first note (SC#10)
Cross-provider tool-schema behavior is verified **against the app's own translators** (the service-boundary that already encodes each provider's real constraints from live incidents: Gemini `oneOf`/`anyOf`/`type:[...]` rejections, Anthropic `input_schema`). This is stronger than re-reading each provider's function-calling docs because the app's translators are the measured ground truth for THIS codebase. No provider fork is introduced.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reused primitive read in the live tree; no new packages.
- Architecture: HIGH — both tools are line-for-line analogues of shipped handlers (`render_template`, `_upload_skill_files`).
- Pitfalls: HIGH — the D-07 unique-constraint gap, the un-wrapped download at `:1114`, the Google schema-key strip, and the `/sandbox/{name}` vs `/sandbox/input/` landing-dir discrepancy were all confirmed by direct inspection.
- Cross-provider: HIGH — translators + `test_115` precedent are authoritative.

**Breadcrumb corrections vs CONTEXT.md:**
- `dispatch_tool` is at `:3307` (CONTEXT said `:3336`; that line is the `handler = _TOOL_REGISTRY.get` lookup within it).
- The `execute_code` skill-file injection lands files at `/sandbox/<name>` (`:1120`), NOT `/sandbox/input/` — FILE-02's `/sandbox/input/` is genuinely new (D-03).
- `full-schema.sql` `skill_files` **table** is at `:1116` (CONTEXT `:3601` is the SELECT RLS policy, not the DDL); confirmed **no `(skill_id, filename)` unique constraint** (drives Open Q1).
- The un-wrapped `storage.download` at `tool_dispatcher.py:1114` is an existing D-v2.5-01 deviation — do NOT copy it; use the `documents.py:711` threadpool idiom.

**Research date:** 2026-07-13
**Valid until:** 2026-08-13 (stable — internal codebase; re-verify line numbers if a large refactor of `tool_dispatcher.py`/`openai_service.py` lands first)
