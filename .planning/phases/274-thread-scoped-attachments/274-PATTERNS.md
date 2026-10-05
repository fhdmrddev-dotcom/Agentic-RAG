# Phase 274: Thread-Scoped Attachments - Pattern Map

**Mapped:** 2026-10-05 (HEAD `87d73dee9`)
**Files analyzed:** 33 (15 new source/test/script, 18 modified)
**Analogs found:** 32 / 33 (one partial: no existing `delete_thread` unit test)

All line numbers below were read at HEAD on 2026-10-05. Hot files rot fast here, so re-derive them at execute time.

## File Classification

### Backend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/api/workspace_promote.py` (NEW) | route module | request-response + file-I/O (RLS byte read → mint → enqueue) | `backend/app/api/workspace.py` `download_workspace_file_raw` :631-686 (read) + `backend/app/services/expert_install_service.py` :603-625 (mint+enqueue) + `backend/app/api/documents.py` `upload_document` :610-625 (duplicate → 200) + `backend/app/api/document_search.py` (thin own-module shape) | exact (composed from 4 shipped doors) |
| `backend/app/models/workspace_promote.py` (NEW; or a class in `models/workspace.py`, which has NO ledger row) | model | validation | `backend/app/models/workspace.py` `WorkspaceConnectionAttachRequest` :46-63 | exact |
| `backend/app/services/thread_workspace_cleanup.py` (NEW) | service (thin seam) | batch / file-I/O (storage remove) | `backend/app/services/template_service.py` `sweep_expired` :34-87 + `backend/app/api/threads.py` :1413-1441 + `backend/app/db/workspace.py` `get_storage_paths_for_file` :283-295 | exact |
| `backend/app/api/threads.py` (MOD, FIRES) | route | request-response | itself, :1399-1456, with the `template_service` thin call-through rule | n/a (one-call additive) |
| `backend/app/api/workspace.py` (MOD, FIRES) | route | request-response | itself, `upload_template` :269-300, `_persist_workspace_upload` :303-359 | n/a (one kwarg) |
| `backend/app/main.py` (MOD, FIRES) | config | — | itself, :895 `document_search.router` line / :919 `api_docs.router` | exact |
| `backend/app/services/agent_loop.py` (MOD, FIRES) | service | transform (prompt text) | itself, `_build_attachment_note` :1327-1336 | n/a (one literal, D-26) |
| `supabase/migrations/203_workspace_files_library_link.sql` (NEW) | migration | schema | `supabase/migrations/068_workspace_template_ephemeral.sql` (same table, nullable columns + NULL-tolerant CHECK + partial index + COMMENT) + `188_expert_chat_scoping.sql` :6-16 (FK `ON DELETE SET NULL` + partial index) + `197_runs_expert_attribution.sql` (header + BEGIN/COMMIT + verify block) | exact |
| `backend/tests/unit/test_274_promote_route.py` (NEW) | test | stubbed route | `backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py` :57-115 | exact |
| `backend/tests/unit/test_274_attachment_lifetime.py` (NEW) | test | stubbed route + SQL-string pin | same file :65-115 (`stubbed` fixture) + :174-191 (source-count fence) | exact |
| `backend/tests/unit/test_274_delete_thread_cleanup.py` (NEW) | test | stubbed route | `test_244_cloud_attach_is_thread_scoped.py` fixture shape (no `delete_thread` test exists) | role-match |
| `backend/tests/unit/test_274_promote_preview_parity.py` (NEW) | test | fake-supabase parity | `backend/tests/unit/test_document_versioning.py` / `test_ingest_splice.py` (fake supabase over `mint_document_row`) | role-match |
| `backend/tests/unit/test_274_minter_inventory.py` (NEW) | test | static source fence | `test_244_cloud_attach_is_thread_scoped.py` :45-54 (`_strip_comments`) + :117-139 | exact |
| `backend/tests/unit/test_274_migration_203_shape.py` (NEW, recommended) | test | static SQL text | `backend/tests/unit/test_273_migration_202_shape.py` :1-65 | exact |
| `backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py` (MOD) | test | — | itself :106-115 (retire case 1 deliberately) | n/a |
| `backend/tests/unit/test_244_attachment_prompt_line.py` (MOD) | test | — | itself :119-121 (retire `"expire" in note`) | n/a |
| `scripts/run-274-board.py` (NEW) | script | batch (live roster drive) | `scripts/run-273-board.py` (`derive_roster` :197, `_single_org` :144, `_send` :373, `_wait_run` :167, argparse `main` :580) | exact |

### Frontend

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/components/attachments/saveToLibraryCopy.ts` (NEW) | config (copy port) | — | `frontend/src/components/chat/composerCopy.ts` (whole file) | exact |
| `frontend/src/components/attachments/FolderPathListbox.tsx` (NEW) | component | event-driven (keyboard/selection) | `frontend/src/components/relationships/LinkTargetCombobox.tsx` (whole file) + `folderPathOf` `components/chat/scopeCopy.ts` :94-108 | exact |
| `frontend/src/components/attachments/SaveToLibraryDialog.tsx` (NEW) | component | request-response | `frontend/src/components/health/MoveToFolderDialog.tsx` (Dialog frame ONLY, never its Root `Select`) + `frontend/src/components/chat/ScopePicker.tsx` :98-135 (preview per selection, latest wins) | role-match (composed) |
| `frontend/src/components/attachments/AttachmentActionsMenu.tsx` (NEW) | component | event-driven | `frontend/src/components/chat/ScopeChip.tsx` :47-101 (`DropdownMenu` + `DropdownMenuTrigger asChild` on a chip) | exact |
| `frontend/src/components/attachments/useLibraryLinks.ts` (NEW) | hook | polling (bounded) | `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` :187-207 (poll only while something is in flight) | exact |
| `frontend/src/lib/attachmentLifetime.ts` (NEW) | utility | transform | `FilesSection.tsx` `expiryCaption` :127-147 (exported, "imported never re-derived") + `ChatAttachmentChip.tsx` `attachmentDisplayName` :76-80 | exact |
| `frontend/src/lib/api/attachments.ts` (NEW) | API client | request-response | `frontend/src/lib/api/documents.ts` `attachConnectionFileToThread` :96-120 (POST + refusal shape) + `lib/api/threads.ts` `getScopeEffect` :265-279 (GET + query params) | exact |
| `frontend/src/components/chat/ChatAttachmentChip.tsx` (MOD, locked dir) | component | — | itself :188-256 | n/a |
| `frontend/src/components/panel/FilesSection.tsx` (MOD, FIRES) | component | — | itself, trailing slot :311-336 | n/a |
| `frontend/src/lib/api/documents.ts` (MOD, FIRES) | API client | — | itself `uploadWorkspaceTemplate` :59-81 | n/a |
| `frontend/src/components/chat/useComposerAttachments.ts` (MOD, locked dir) | hook | — | itself :93-94 (the one call) | n/a |
| `frontend/src/types/index.ts` (MOD, FIRES) | model | — | itself `WorkspaceFile` :1216-1226 | n/a |
| `frontend/src/components/chat/composerCopy.ts` (MOD only if D-24 lands here) | config | — | itself :98 `expiredWhy` | n/a |
| `frontend/src/components/attachments/__tests__/*.test.ts(x)` (NEW) | test | `?raw` fences + render | `frontend/src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx` :21-58, :150-187 + `frontend/src/lib/stripComments.testutil.ts` | exact |
| `scripts/vitest-count-gate.cjs` (MOD) | config | — | itself :3957 (`"ChatAttachmentChip.states.test.tsx": 10` BASELINE pin) + `const TARGETS` :4538 | exact |

---

## Pattern Assignments

### `backend/app/api/workspace_promote.py` (route module, request-response + file-I/O)

**Placement rule (load-bearing).** This MUST be its own module. `workspace.py` carries a source fence (`test_244_cloud_attach_is_thread_scoped.py:117-139`) forbidding `import_single_file`, `mint_document_row`, `ingest_splice`, `splice_document` and `table("documents")`. Importing FROM `workspace.py` into the new module is fine. The fence reads only `workspace.py`'s own text.

**Thin own-module shape**, from `backend/app/api/document_search.py` (the Phase 271 "deliberately NOT in api/documents.py" precedent). Copy the docblock style that says why it is a separate module:
```python
"""Document search — Phase 271 (FIND-01 / FIND-02 / FIND-03).
...
⭐ **Deliberately NOT in api/documents.py.** That module is a G-5-firing hot file; this is a
read surface of its own with its own request contract.
...
"""
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from app.dependencies import get_current_user, get_user_supabase_client
...
router = APIRouter(prefix="/document-search", tags=["document-search"])
```
For 274, use the router prefix from `workspace.py:49-52`:
```python
router = APIRouter(
    prefix="/threads/{thread_id}/workspace",
    tags=["workspace"],
)
```
No path collides with `workspace.py`'s six routes: `/files`, `/files/from-connection`, `/files/{file_id}/content|raw|versions|diff`. The new paths are `/files/{file_id}/promote`, `/files/{file_id}/promote-preview` and `/library-links`.

**Imports pattern.** Combine `workspace.py:17-45` with `expert_install_service.py:49-56`:
```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from supabase import Client

from app.api.workspace import _verify_thread_ownership          # reuse, never duplicate (workspace.py:55-76)
from app.api.documents import ALLOWED_MIME_TYPES, _EXT_MIME_OVERRIDES   # read-only import (documents.py:120-180)
from app.db.workspace import get_file_by_id
from app.dependencies import (
    get_active_org_id,
    get_current_user,
    get_user_pg_connection,
    get_user_supabase_client,
)
from app.services import ingest_splice
from app.services.audit_service import write_audit_entry
from app.services.sources.import_service import _enqueue_or_splice   # imported BY NAME, never copied (expert_install_service.py:22-24)
from app.services.workspace_service import WorkspaceError, _get_file_content
from app.utils.db import aexec
```

**Auth + ownership + byte-exact RLS read.** Copy `workspace.py:654-679` (the `/raw` route) verbatim in shape. Ownership comes first (404), then the UUID parse (404, never 500), then the user-JWT pg read, collapsing missing, cross-thread and expired into one 404:
```python
await _verify_thread_ownership(thread_id, current_user, supabase)  # 404 on non-owner

try:
    fid = UUID(file_id)
except ValueError:
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

async with get_user_pg_connection(request, current_user) as conn:
    row = await get_file_by_id(conn, fid)
    # Collapse missing / cross-thread / expired ALL to 404 (no existence leak).
    if (
        not row
        or str(row.get("thread_id")) != thread_id
        or row.get("is_expired")
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        content_bytes = await _get_file_content(conn, supabase, row)
    except WorkspaceError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
```
Add one predicate to the 404 collapse: `row.get("kind") != "template_input"` (D-09: agent files get no promote). ⛔ Never use `/content`'s `_decode_inline_content` (`workspace.py:79-123`). It decodes to UTF-8 text and corrupts every binary.

**Filename + MIME derivation (D-27).** The stored path is `/{uuid4().hex[:8]}-{safe_name}` (`workspace.py:333-336`):
```python
stem = filename or f"template{ext}"
safe_name = re.sub(r"[^a-zA-Z0-9._\- ]", "_", stem)
safe_name = re.sub(r"\.{2,}", ".", safe_name).strip() or f"template{ext}"
path = f"/{uuid4().hex[:8]}-{safe_name}"
```
So `library_filename()` strips `^[0-9a-f]{8}-` from the basename. The MIME override must come first. Copy the Library door's own normalisation (`documents.py:580-595`), with the gate keyed on `ALLOWED_MIME_TYPES` and the 422 sentence **derived, never re-typed**:
```python
ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
if mime_type in _UNRELIABLE_MIME_TYPES and ext in _EXT_MIME_OVERRIDES:
    mime_type = _EXT_MIME_OVERRIDES[ext]

if mime_type not in ALLOWED_MIME_TYPES:
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=(
            f"Unsupported file type: {mime_type}. "
            f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
        ),
    )
```
For promote, prefer the override unconditionally: `_EXT_MIME_OVERRIDES.get(ext) or row["mime_type"]`. The workspace row's MIME comes from the platform `mimetypes` table (RESEARCH Pitfall 4).

**Core mint + enqueue pattern.** Copy `expert_install_service.py:603-625`. It is the closest analog because it is the only caller that already passes `org_id` + `on_conflict="link"` + `version_scope="folder"` together:
```python
mint = await ingest_splice.async_mint_document_row(
    raw=f.raw,
    filename=f.filename,
    mime_type=f.mime_type,
    user_id=str(user_id),
    supabase=supabase,
    folder_id=folder_id,
    org_id=str(org_id),
    on_conflict="link",
    version_scope="folder",  # WR-03: never retire a person's same-named file elsewhere
)
doc = dict(mint.document)
if not mint.is_duplicate:
    await _enqueue_or_splice(
        doc=doc,
        raw=f.raw,
        mime_type=f.mime_type,
        filename=f.filename,
        user_id=str(user_id),
        active_org=str(org_id),
        storage_path=mint.storage_path,
        background_tasks=background_tasks,
    )
```
Minter signature: `ingest_splice.py:126-140`. `MintResult(document, is_duplicate, storage_path, version_number)` is at `:63-68`. The minter's refusals propagate verbatim. Do NOT pre-check the folder in the route (D-12):
```python
# ingest_splice.py:168-174
if not folder_check.data:
    raise HTTPException(status_code=404, detail="Folder not found")
if folder_check.data["user_id"] != user_id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Cannot upload to a folder you do not own",
    )
```

**Duplicate → 200 / fresh → 201.** Copy `documents.py:555, 621-625, 735-736`. Declare `status_code=201` on the decorator and flip to 200 on the duplicate arm through the injected `Response`:
```python
@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(response: Response, background_tasks: BackgroundTasks, ...):
    ...
    if mint_result.is_duplicate:
        response.status_code = status.HTTP_200_OK
        return doc
```
For promote, return `{document, outcome: "saved"|"already", folder_id}`. On `already`, `folder_id` is the **existing** document's `doc["folder_id"]` (D-13), never the picked one. ⛔ Do NOT copy `/upload`'s inline storage upload + `insert_ingestion_job` block (:627-725). `_enqueue_or_splice` (`import_service.py:64-166`) already contains it, with the never-strand fallback.

**Audit.** Copy `documents.py:727-733`. Reuse `action_type="document.upload"`. A new action type hard-fails boot (`audit_service.assert_action_types_synced`):
```python
background_tasks.add_task(
    write_audit_entry,
    user_id=current_user["id"],
    action_type="document.upload",
    metadata={"document_id": doc["id"], "filename": doc["filename"], "folder_id": folder_id},
    supabase=service_supabase,
)
```
Add `"source": "thread_attachment"` and `"workspace_file_id"` to the metadata. ⚠ `/upload` passes the service-role client here (D-05 carve-out). `threads.py:1450-1456` passes the user-JWT `supabase` instead. Pick one and state why in the plan.

**Active org.** Copy the dependency shape from `workspace.py:362-370` (`attach_connection_file`) or `experts.py` `install_expert` (`active_org: str = Depends(get_active_org_id)`). No body field may carry an org.

**Mark stamp (best-effort, after mint).** Write through the user-JWT client (`workspace_files_update_own`), wrapped in `aexec`. Log on failure and never raise, so a missing mig-203 column cannot fail a promote after the document exists (RESEARCH Pattern 5). The logging shape comes from `import_service.py:129-135` (`logger.warning(...)` with the doc id).

**Preview route (D-14).** Mirror the minter's own two predicates, read-only. Dedup is `ingest_splice.py:221-239` and folder-scoped versioning is `:242-259`:
```python
dedup_query = (
    supabase.table("documents").select("*")
    .eq("user_id", user_id).eq("content_hash", content_hash).eq("status", "completed")
)
if org_id:
    dedup_query = dedup_query.eq("org_id", org_id)
...
versions_query = (
    supabase.table("documents").select("id, version_number")
    .eq("user_id", user_id).eq("filename", filename)
)
if org_id:
    versions_query = versions_query.eq("org_id", org_id)
if folder_scoped:
    versions_query = (
        versions_query.eq("folder_id", folder_id) if folder_id else versions_query.is_("folder_id", "null")
    )
existing_versions = versions_query.order("version_number", desc=True).limit(1).execute()
```
⛔ `ingest_splice.py` stays read-only (FIRES). Pin the duplication with the parity test, not a shared helper. Wrap every supabase-py call in `aexec` (D-v2.5-01).

---

### `backend/app/models/workspace_promote.py` (model, validation)

**Analog:** `backend/app/models/workspace.py:46-63`
```python
class WorkspaceConnectionAttachRequest(BaseModel):
    """Phase 244 (SHELL-04 / D-244-05) — attach ONE connected-cloud file to THIS THREAD.
    ...
    """

    model_config = ConfigDict(extra="forbid")

    #: The connector connection the file lives in (org-scoped; resolved server-side).
    connection_id: str
```
`PromoteRequest`: `model_config = ConfigDict(extra="forbid")` and `folder_id: UUID` (required, no default, no Root). Its tests copy `test_244_cloud_attach_is_thread_scoped.py:243-258` (an unknown key raises `ValidationError`, and `set(model_fields) == {"folder_id"}`). ⚠ `models/workspace.py` has **no hot-file ledger row**. If the class goes there, add a row in the same commit. Otherwise use a new module, which also gets a row at creation.

---

### `backend/app/services/thread_workspace_cleanup.py` (service, batch file-I/O)

**Analog 1 (thin-seam module + logging):** `backend/app/services/template_service.py:1-31, 56-79`. Its docblock states the rule this phase reuses: *"main.py / threads.py gain only delegating call-throughs so the G-5 hot file threads.py never grows inline query/Storage logic"*.
```python
from __future__ import annotations

import logging
from uuid import UUID

import asyncpg
from starlette.concurrency import run_in_threadpool

from app.db.workspace import get_storage_paths_for_file
from app.services.workspace_service import BUCKET_NAME   # "workspace-files" (workspace_service.py:41)

logger = logging.getLogger(__name__)
...
        for sp in paths:
            try:
                await run_in_threadpool(
                    supabase.storage.from_(BUCKET_NAME).remove, [sp]
                )
            except Exception:
                failed = True
                logger.warning(
                    "Template sweep: failed to remove storage object %s "
                    "(row kept; will retry next sweep)", sp
                )
```
⚠ `template_service.py` has **no ledger row**. Read and import it only; do not modify it. Import `BUCKET_NAME` rather than re-typing the literal.

**Analog 2 (path set, file + all versions):** `backend/app/db/workspace.py:283-295`. Mirror this UNION through the **user-JWT supabase client** (RLS `workspace_files_select_own` / `workspace_versions_select_own`), never the asyncpg pool:
```python
SELECT content_storage_path FROM workspace_file_versions
WHERE workspace_file_id = $1 AND content_storage_path IS NOT NULL
UNION
SELECT content_storage_path FROM workspace_files
WHERE id = $1 AND content_storage_path IS NOT NULL
```

**Analog 3 (the user-JWT shape inside delete_thread):** `backend/app/api/threads.py:1417-1441`:
```python
try:
    exec_resp = await aexec(
        supabase.table("code_executions")
        .select("id")
        .eq("thread_id", thread_id)
        .eq("user_id", current_user["id"])
    )
    exec_rows = exec_resp.data or []
    if exec_rows:
        exec_ids = [r["id"] for r in exec_rows]
        file_resp = await aexec(
            supabase.table("sandbox_files")
            .select("storage_path")
            .in_("execution_id", exec_ids)
        )
        ...
            await run_in_threadpool(
                supabase.storage.from_("sandbox-outputs").remove, paths
            )
except Exception:
    pass  # Best-effort cleanup — don't block thread deletion
```
Deviations to copy deliberately (RESEARCH Pattern 4):
- **log, never `pass`**: use the `logger.warning` from Analog 1.
- **collect BEFORE the `threads` delete** (the cascade drops the rows; same reason as `template_service.py:63-64` "Pitfall 3").
- **remove AFTER the delete succeeds**.
- chunk the remove (≤100 paths per call).
- Supabase Storage has no prefix delete and `list()` is one level deep, so the DB-derived set is the only complete set.

---

### `backend/app/api/threads.py` `delete_thread` (MOD, route, FIRES at 88+ phases)

**Analog:** itself, `:1399-1456`. The touch is exactly two lines. `paths = await collect_thread_workspace_paths(supabase, thread_id)` goes **between** the sandbox block (ends :1441) and the `threads` delete (:1444). `await remove_workspace_paths(supabase, paths)` goes **after** :1449, before the audit task (:1450). Add one import beside the other service imports (`:87-89` region, e.g. after `from app.services.audit_service import write_audit_entry`). Zero new branches in the route body. That is the "honoured by construction" form the ledger cell needs.

---

### `backend/app/api/workspace.py` (MOD, FIRES) — the lifetime split

**Analog:** itself. In `upload_template` (`:269-300`), add `lifetime: Literal["template", "thread"] = Query("template")` beside the existing `Query` usage style (`list_workspace_files` :474-481 uses `Query(False, description=...)`). Thread it into the single writer. In `_persist_workspace_upload` (`:303-359`), keep the ONE `template_ttl_hours` read **inside the `"template"` branch**, because `test_244_cloud_attach_is_thread_scoped.py:191` pins `body.count("template_ttl_hours") == 1`:
```python
ext = validate_upload(filename, raw)  # D-12/D-09 magic-byte + content gate
ttl_hours = (await load_app_settings_async()).template_ttl_hours  # D-05
expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
...
                kind="template_input",  # D-12
                expires_at=expires_at,  # D-05
...
result["kind"] = "template_input"
result["expires_at"] = expires_at.isoformat()
```
For thread-life, use `expires_at = None` and `result["expires_at"] = None`. The key must be present (JSON `null`), never omitted. `attach_connection_file` (`:444-451`) passes `lifetime="thread"` unconditionally. Keep exactly two `await _persist_workspace_upload(` call sites (fence `:182`), and keep the `= validate_upload(` count at 1 (fence `:190`). ⛔ Never import the minter here (fence `:117-139`).

---

### `backend/app/main.py` (MOD, FIRES)

**Analog:** `main.py:895` / `:919`. ONE line with a trailing reason comment, registered beside `workspace.router` (`:888`) or at the end of the block:
```python
app.include_router(document_search.router)  # Phase 271 FIND-01/02/03 — document search beside RAG, no embedding call; own module, not api/documents.py
app.include_router(api_docs.router)  # Phase 276 DOCS-04 — gated live API explorer
```
Also add the import to the long import line (`:875`).

---

### `backend/app/services/agent_loop.py` (MOD, FIRES) — D-26 one literal

**Analog:** itself, `:1327-1336`. Replace only the sentence `"search_documents. They expire, so use them in this conversation rather than assuming " "they persist.\n"`. Leave `_ATTACHMENT_KIND = "template_input"` (`:1278`) and the filter (`:1312`) byte-unchanged. Retire `test_244_attachment_prompt_line.py:119-121` deliberately in the same commit, with the reason written into the test body (SEED-177 / D-206-07 precedent).

---

### `supabase/migrations/203_workspace_files_library_link.sql` (migration)

**Analog 1 (same table, additive nullable columns + NULL-tolerant CHECK + partial index + COMMENT):** `supabase/migrations/068_workspace_template_ephemeral.sql:1-31`
```sql
ALTER TABLE public.workspace_files
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Permissive forward-compatible CHECK (NULL allowed; Phase 101 may add kinds).
-- Pitfall 6: a CHECK that forgot NULL would block existing-row validity.
ALTER TABLE public.workspace_files
  DROP CONSTRAINT IF EXISTS workspace_files_kind_check;
ALTER TABLE public.workspace_files
  ADD CONSTRAINT workspace_files_kind_check
  CHECK (kind IS NULL OR kind IN ('template_input', 'agent'));

CREATE INDEX IF NOT EXISTS idx_workspace_files_expires_at
  ON public.workspace_files (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.workspace_files.kind IS
  'Phase 100 TMPL-01. ...';
```
Use the **named, DROP-then-ADD constraint** form above (idempotent on re-paste) for `library_link IS NULL OR library_link IN ('saved','already')`, rather than an inline column CHECK.

**Analog 2 (FK `ON DELETE SET NULL` + partial index):** `supabase/migrations/188_expert_chat_scoping.sql:6-16`
```sql
ALTER TABLE public.threads
    ADD COLUMN IF NOT EXISTS active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL;
...
CREATE INDEX IF NOT EXISTS idx_threads_active_expert
    ON public.threads (active_expert_id)
    WHERE active_expert_id IS NOT NULL;
```

**Analog 3 (header + apply discipline + BEGIN/COMMIT + read-only verify block):** `supabase/migrations/197_runs_expert_attribution.sql`. Copy its header paragraphs `-- Apply discipline (CLAUDE.md): paste into the Supabase SQL editor. NEVER supabase db push / db reset. Idempotent: safe to paste twice. NOTE: no DO block...`, the `BEGIN; ... COMMIT;` wrapper, and the trailing `-- Verify (read-only):` `information_schema.columns` query. From `202_message_artifacts.sql:51-55`, add the prod-ordering note: *apply BEFORE the backend that reads these columns deploys, then run `get_advisors(security)`*. Prod still needs 202 first.

⛔ No pairing CHECK between the two columns (D-28, RESEARCH Pitfall 5). Write a WHY-paragraph in the header, as 197 does for its own FK decision. No backfill (forward-only). Then run `bash scripts/regenerate-full-schema.sh` (no `--reset`), and never hand-edit `full-schema.sql`.

---

### `backend/tests/unit/test_274_promote_route.py` (test, stubbed route)

**Analog:** `backend/tests/unit/test_244_cloud_attach_is_thread_scoped.py`.

**Module docstring shape** (:1-16): name the negative, and state *"Every case is STUBBED — no documents row ... is created by this file. Worktrees isolate files, not the local database."*

**Fake user-JWT pg connection** (:57-62):
```python
class _FakeConn:
    async def __aenter__(self):
        return MagicMock()

    async def __aexit__(self, *a):
        return False
```

**Stub fixture** (:65-87). Monkeypatch every seam on the module under test (`_verify_thread_ownership`, `get_user_pg_connection`, the writer) so nothing reaches a database:
```python
@pytest.fixture
def stubbed(monkeypatch):
    """Every seam the route touches, replaced. Nothing reaches a database."""
    monkeypatch.setattr(workspace, "_verify_thread_ownership", AsyncMock(return_value=None))
    ...
    monkeypatch.setattr(workspace, "get_user_pg_connection", lambda *a, **k: _FakeConn())
```
For promote: patch `workspace_promote.get_file_by_id`, `workspace_promote._get_file_content`, `workspace_promote.ingest_splice.async_mint_document_row` (capture kwargs to assert `version_scope="folder"`, `org_id`, `on_conflict="link"`) and `workspace_promote._enqueue_or_splice` (assert awaited on fresh, NOT awaited on duplicate).

**Direct-call shape** (:90-103). Call the route coroutine with explicit literal UUIDs and `MagicMock()` request/supabase:
```python
return await workspace.attach_connection_file(
    thread_id="11111111-1111-4111-8111-111111111111",
    request=MagicMock(),
    body=body,
    active_org="22222222-2222-4222-8222-222222222222",
    current_user={"id": "33333333-3333-4333-8333-333333333333"},
    supabase=MagicMock(),
)
```
⚠ When calling routes directly, any `Query(...)` default is a truthy `Query` OBJECT (`workspace.py:522-528`). Pass every query param explicitly in tests, and write route code that compares with `is not True` / `== "thread"` so it fails closed.

**Refusal assertions** (:150-153, :226-239): `pytest.raises(HTTPException)`, then assert `status_code` and a substring of `detail`. For a 404 also assert `"permission" not in detail.lower()`.

**"PLANT to drive RED" docstrings** on each case (:119, :145, :175, :197): name the plant that turns it red. The TDD RED drive is mandatory (G-8).

---

### `backend/tests/unit/test_274_attachment_lifetime.py` (test)

**Analog:** the same `stubbed` fixture (`test_244_cloud_attach_is_thread_scoped.py:65-87`). It already captures the `ws_write_file` kwargs into `written` and stubs `load_app_settings_async` with `SimpleNamespace(template_ttl_hours=24)`. Assert `written["expires_at"] is None` for `lifetime="thread"` and the cloud door, and `is not None` for the default. **Retire `:106-115` case 1 deliberately**: rewrite the assertion to `expires_at is None and kind == "template_input"` and write the D-05 reason into the body.

**SQL-string pin** of the sweeper and run-pin NULL skip: read `template_service.py` source and assert the two literals (`template_service.py:56-59` `"WHERE expires_at IS NOT NULL AND expires_at <= now()"` and `:105` `"... AND expires_at IS NOT NULL"`). Use the `Path(module.__file__).read_text(encoding="utf-8")` shape from `:30` of the 244 test.

---

### `backend/tests/unit/test_274_delete_thread_cleanup.py` (test) — partial analog

No `delete_thread` unit test exists (grep of `tests/unit` for `delete_thread` returns nothing). Build it from the 244 fixture shape: monkeypatch `threads.aexec` / `threads.run_in_threadpool` (or the new helper module's) and a `MagicMock()` supabase whose `.storage.from_("workspace-files").remove` records calls. Assert the order (collect → `threads` delete → remove), the logged-not-raised failure, that the delete proceeds when remove raises, and that `get_supabase`/service role is never touched. Unit-test the helper module directly too. That is cheaper than driving the 2456-line route module.

---

### `backend/tests/unit/test_274_minter_inventory.py` (test, static fence)

**Analog:** `test_244_cloud_attach_is_thread_scoped.py:45-54` (`_strip_comments`) and `:117-139` (forbidden-name loop with a non-vacuity assert first):
```python
def _strip_comments(src: str) -> str:
    out = re.sub(r'"""(?:.|\n)*?"""', "", src)
    out = re.sub(r"'''(?:.|\n)*?'''", "", out)
    out = re.sub(r"(?m)#.*$", "", out)
    return out
...
    body = _strip_comments(WORKSPACE_SRC)
    assert "async def attach_connection_file" in body  # non-vacuity
```
Walk `backend/app/**/*.py`, strip comments, and collect the modules containing `mint_document_row(`. Assert set equality with the six-module set in RESEARCH §D-18 (excluding `ingest_splice.py`'s own definition). Exclude the defining module explicitly, and state that exclusion in the test.

---

### `backend/tests/unit/test_274_migration_203_shape.py` (test, recommended)

**Analog:** `backend/tests/unit/test_273_migration_202_shape.py:13-49`. Copy the `REPO_ROOT = Path(__file__).resolve().parents[3]` locator, the single-match `glob("203_*.sql")` assertion, the line-wise `--` comment stripper and `_norm`. Assert that `ON DELETE SET NULL` is present and that no CHECK references both columns.

---

### `scripts/run-274-board.py` (script, live roster)

**Analog:** `scripts/run-273-board.py`. Reuse rather than re-type `derive_roster` (:197), `_single_org` (:144), `_headers` (:140), `_assert_local_db` (:158), `_wait_run` (:167) and `_send` (:373). The filename is hyphenated, so import via `importlib.util.spec_from_file_location`. Keep its mode-flag argparse (`--roster` / `--run`, `--providers`, `--timeout`, `--out`; :580-611) and its module-docstring style that describes each mode (:1-30). Per row: a fresh thread, upload a planted-fact file with `lifetime=thread`, ask, then run the second-thread negative (D-04).

---

### `frontend/src/components/attachments/saveToLibraryCopy.ts` (copy port)

**Analog:** `frontend/src/components/chat/composerCopy.ts` (whole file). Copy:
- the docblock that names the sketch path it ports and lists **what is ported and what is not, with the reason** (:1-38). For sketch 274, port `engine` + `shared` + `a` (the winner). Do NOT port `b`, `c` or `scenario`.
- the `const engine = {...} as const` / `const a = {...} as const` / `export const COPY = { engine, a, shared } as const` structure (:43-111).
- builders ported **by shape** as arrow functions (:60-61, :84). Sketch 274's `versionWarn: (name, path, n) => ...` becomes a typed builder.
- net-new strings that the sketch does not draw (D-22 type-refusal line, D-25 `couldn't index`) carry a `⭐ NOT PORTED FROM THE SKETCH` docblock, the way `refuseNoThread` does (:100-108).

---

### `frontend/src/components/attachments/FolderPathListbox.tsx` (component, event-driven)

**Analog:** `frontend/src/components/relationships/LinkTargetCombobox.tsx`. Copy the APG wiring, but **do not mount or fork that component** (Find and CreateLink share it).

State + generated listbox id (:59-61):
```tsx
const [query, setQuery] = useState(initialQuery)
const [activeIndex, setActiveIndex] = useState(-1)
const listboxId = useRef(`rel-target-listbox-${Math.random().toString(36).slice(2)}`).current
```
Keyboard walk (:92-104): `ArrowDown`/`ArrowUp` wrap, `Enter` chooses the active option, with `preventDefault` on each. Input ARIA (:111-131): `role="combobox"`, `aria-expanded`, `aria-controls` **only while the listbox is in the tree** (WR-04), `aria-activedescendant`, `aria-autocomplete="list"`. Typing invalidates the pick (`onChoose(null)`). Options (:150-168):
```tsx
<li
  key={d.id}
  id={`${listboxId}-opt-${i}`}
  role="option"
  aria-selected={value === d.id}
  onMouseDown={(e) => {
    e.preventDefault() // keep focus in the input
    choose(d)
  }}
```
Differences for 274: match against the **full path** from `folderPathOf` (`components/chat/scopeCopy.ts:94-108`, cycle-safe, returns `null` for an unseen id), render the leaf bold and the parent dim, and add **no Root option**. Source folders from `listFolders()` (`@/lib/api`), as `MoveToFolderDialog.tsx:38-40` does.

---

### `frontend/src/components/attachments/SaveToLibraryDialog.tsx` (component, request-response)

**Analog A, the dialog frame only:** `frontend/src/components/health/MoveToFolderDialog.tsx:1-95`. Copy the imports (`Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` from `@/components/ui/dialog`, `Button`), the reset-on-open effect (:34-41), the `loading`/`error` state and the `onOpenChange={(v) => { if (!v) onClose() }}` close shape (:60):
```tsx
useEffect(() => {
  if (!open) return
  setSelectedFolderId("")
  setError(null)
  listFolders()
    .then(setFolders)
    .catch(() => setError("Could not load folders."))
}, [open])
```
⛔ Do NOT copy :74 `<SelectItem value="root">Root (no folder)</SelectItem>`, the `"root"` sentinel (:30, :48), or the in-dialog `moveDocument` commit (:49). D-10 amended: the picker returns an id and the dialog's caller-facing commit is the promote client. Confirm stays disabled until a folder is picked (`disabled={!selectedFolderId || loading}`, :88).

**Analog B, preview per selection, latest wins:** `frontend/src/components/chat/ScopePicker.tsx:98-128`:
```tsx
const reqRef = useRef(0)
...
const requestPreview = useCallback(
  (value: string) => {
    const req = ++reqRef.current
    setPreview({ status: "loading" })
    new Promise<ScopeEffect>((resolve) => resolve(getScopeEffect(...))).then(
      (effect) => { if (req === reqRef.current) setPreview({ status: "ready", effect }) },
      () => { if (req === reqRef.current) setPreview({ status: "error" }) },
    )
  },
  [threadId, saved],
)
```
Use it for `promote-preview?folder_id=` (the D-14 version warning, D-13 duplicate, D-22 refusal). The result screen renders the actual POST response, never the preview.

---

### `frontend/src/components/attachments/AttachmentActionsMenu.tsx` (component, the `⋯`)

**Analog:** `frontend/src/components/chat/ScopeChip.tsx:17-19, 47-101`. A chip-hosted `DropdownMenu` with a controlled `open` and a `DropdownMenuTrigger asChild` wrapping a real `<button type="button">` that carries an `aria-label`, an `aria-busy` while in flight, and a `data-testid`:
```tsx
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
...
<DropdownMenu
  open={open}
  onOpenChange={(next) => {
    // S3: while a PATCH is in flight the menu neither closes nor re-opens.
    if (!applying) setOpen(next)
  }}
>
  <DropdownMenuTrigger asChild>
    <button type="button" data-testid="scope-chip" aria-label={name} title={name} aria-busy={applying || undefined} ...>
```
Items come from `ScopePicker.tsx:22-25, 230-238` (`DropdownMenuContent`, `DropdownMenuItem`). Use `Save to Library…` and `Open in panel` (`requestOpenPanel()` from `components/panel/panelOpenSignal.ts`, reveal-only per D-23). For a disabled type, the item is disabled and carries one reason line (D-22). ⚠ For the panel row, the trigger must sit **outside** the `role="option"` element (`FilesSection.tsx:338-354`), or be `tabIndex={-1}` with a row key. Decide this and keyboard-test it (RESEARCH Pattern 6).

---

### `frontend/src/components/attachments/useLibraryLinks.ts` (hook, bounded poll)

**Analog:** `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx:61-62, 187-207`:
```tsx
export const INSTALL_POLL_MS = 4000
...
// ⛔ Keyed on a BOOLEAN, so the interval is created once per installing stretch and cleared the
// moment the list stops reporting an install in flight (or the page unmounts).
const anyInstalling = experts.some((e) => e.install?.state === "installing")
useEffect(() => {
  if (!anyInstalling) return
  let mounted = true
  const timer = setInterval(() => {
    listExperts()
      .then((rows) => { if (!mounted) return; setExperts(rows) })
      .catch(() => {
        // A missed poll is a missed hint, not an error: the next tick reconciles.
      })
  }, INSTALL_POLL_MS)
  return () => { mounted = false; clearInterval(timer) }
```
Key the interval on `anyIndexing` (document `status ∈ {pending, processing}`). It is a FETCH, never Realtime (D-v2.5-03). Stop on `completed` or `failed` (D-25 `couldn't index`). Read the thread via `useViewingThread()`, as `FilesSection.tsx:167` does.

---

### `frontend/src/lib/attachmentLifetime.ts` (utility)

**Analog:** the "exported once, imported never re-derived" discipline of `FilesSection.tsx:117-147` (`expiryCaption`, `EXPIRY_UNKNOWN`) and `ChatAttachmentChip.tsx:63-80` (`chatAttachmentState`, `attachmentDisplayName`):
```ts
export function attachmentDisplayName(file: WorkspaceFile): string {
  const segments = file.path.split("/")
  return segments[segments.length - 1] || file.path
}
```
Add the `^[0-9a-f]{8}-` strip here with one exported regex, and pin it in lockstep with the backend `library_filename()` (D-27). Add `isThreadLifeAttachment(file)` as `kind === "template_input" && expires_at === null`. Note `null` is the server saying "lives with the thread", while `undefined` means the wire did not say, which reads `expiry unknown`. The `PendingAsk` `null`-means-no-deadline precedent is at `types/index.ts:1236-1238`. ⚠ `expiryCaption(undefined|null)` currently returns `EXPIRY_UNKNOWN` (`FilesSection.tsx:133`). The chip and the panel must test `isThreadLifeAttachment` BEFORE calling `expiryCaption`, or a thread-life row reads `expiry unknown`.

---

### `frontend/src/lib/api/attachments.ts` (API client)

**Analog (POST + refusal):** `frontend/src/lib/api/documents.ts:96-120`. The JSON body with Bearer + `Content-Type`, and the `detail` string-or-`{message}` unwrapping:
```ts
const token = await getAuthToken()
const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files/from-connection`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ connection_id: connectionId, file_id: fileId }),
})
if (!res.ok) {
  const err = await res.json().catch(() => ({ detail: "Attach failed" }))
  const detail = (err as { detail?: unknown }).detail
  const message =
    typeof detail === "string"
      ? detail
      : (detail as { message?: string } | null)?.message ?? "Attach failed"
  throw new Error(message)
}
```
Duplicate detection by status, from `uploadDocument` (:49-50): `return { doc, isDuplicate: res.status === 200 }`. The server's own sentence is surfaced verbatim (the minter's 403/404 are sketch `COPY.engine.REFUSE_NOT_OWNER` / `REFUSE_NO_FOLDER`).

**Analog (GET + query params):** `lib/api/threads.ts:265-279` `getScopeEffect` (`URLSearchParams`, `getAuthHeaders()`), used for `promote-preview` and `library-links`. Import `API_BASE, getAuthHeaders, getAuthToken` from `"./_core"` (`documents.ts:27`). Re-export through `lib/api.ts` only if the gated `apiBarrel.test.ts` requires it (the 271-03 precedent in the `lib/api.ts` ledger cell). Hooks import from the domain module, not the barrel (`ExpertCatalogPage.tsx:53-54`).

---

### `frontend/src/lib/api/documents.ts` `uploadWorkspaceTemplate` (MOD, FIRES)

**Analog:** itself, `:59-81`. Add `lifetime: "template" | "thread" = "template"` and append `?lifetime=thread` only when it is not the default, so `TemplateUpload.tsx:40` and `ChatLayout.tsx:420` stay byte-unchanged (D-21). Keep the "NO Content-Type, browser sets the boundary" comment and the `file_id → id` mapping (:79-80).

### `frontend/src/components/chat/useComposerAttachments.ts` (MOD, coordination-locked)

**Analog:** itself, `:94`. `land(await uploadWorkspaceTemplate(threadId, f))` becomes `land(await uploadWorkspaceTemplate(threadId, f, "thread"))`. That is the only edit.

### `frontend/src/types/index.ts` `WorkspaceFile` (MOD, FIRES)

**Analog:** itself, `:1216-1226`. Change `expires_at?: string` to `expires_at?: string | null`, and add optional `library_document_id?: string | null` and `library_link?: "saved" | "already" | null`. These are additive and optional only.

---

### `frontend/src/components/chat/ChatAttachmentChip.tsx` (MOD, coordination-locked)

**Analog:** itself. Edits:
- **Drop the TTL word for thread-life rows.** `:193-198` currently maps any future expiry to `COPY.a.chipTtl` (`"24h"`):
  ```tsx
  const expiryWord = caption === COPY.engine.TTL_HOURS + "h" || caption.startsWith("expires in")
    ? COPY.a.chipTtl
    : caption
  ```
  For a thread-life row, render no expiry span.
- **Mount `AttachmentActionsMenu` only when `effective === "sent"`**, mirroring how the remove button is gated on `pending` (:243-253). The pending chip gets no `⋯` (keeps the D-18 composer fence true).
- **The `In Library · <leaf>` / `Already in Library · <leaf>` segment** reuses the scope-segment markup (:234-239: `pl-1.5 border-l border-border/60 text-muted-foreground`). The link calls `useCitationNav().openDocument(id)` (`lib/citationNav.tsx:55, 94`). The full path goes in `title` AND in the panel row.
- **`attachmentDisplayName` delegates** to `lib/attachmentLifetime.ts` (prefix strip).
- Every string comes from a `?raw`-fenced copy module. There are no literals in JSX (docblock :13-20).
- `MessageItem.tsx` stays untouched: the chip reads the thread itself with `useViewingThread()`.

### `frontend/src/components/panel/FilesSection.tsx` (MOD, FIRES)

**Analog:** itself, trailing slot `:311-336`. Extract the `isTemplate ? (...) : undefined` content into ONE new component (e.g. `components/attachments/AttachmentRowTrailing.tsx`) instead of growing the body. That component renders `size · this chat only` + `⋯` for thread-life rows and the existing `Template` badge + `expiryCaption` countdown for TTL rows, byte-identical, while agent rows still get `undefined`. `expiryCaption`'s three readings (:132-147) stay unchanged.

---

### Frontend tests (`components/attachments/__tests__/*`)

**Analog:** `frontend/src/components/chat/__tests__/ChatAttachmentChip.states.test.tsx`.
- `?raw` import of the sketch's own COPY.js (:27-29). The path depth from `components/attachments/__tests__/` is the same five `../`:
  ```tsx
  import sketchCopySource from "../../../../../.planning/sketches/236-the-file-that-belongs-to-this-chat/COPY.js?raw"
  ```
  For 274, use `.planning/sketches/274-save-to-library/COPY.js?raw`.
- Copy fence with non-vacuity first, then `key: "value"` pairs (:150-177):
  ```tsx
  expect(sketchCopySource.length).toBeGreaterThan(500)
  expect(sketchCopySource).toContain("const COPY = {")
  for (const [key, value] of pairs) {
    expect(sketchCopySource).toContain(`${key}: "${value}"`)
  }
  ```
- Engine-fact fence: additionally `?raw`-import `backend/app/services/ingest_splice.py` and assert that both `REFUSE_NOT_OWNER` / `REFUSE_NO_FOLDER` strings occur there (RESEARCH Code Examples). The backend-source `?raw` precedent and its red-at-base caveat are in memory `reference_frontend_suites_import_backend_source_raw.md`.
- Composer source fence (`composerNoLibraryDoor.test.ts`): `?raw` the five composer files and strip with the shared `stripComments` (`frontend/src/lib/stripComments.testutil.ts`, test-only import, never re-copied). Then assert none of `uploadDocument`, `importCloudFile`, `createWatch`, `installExpert`, `/documents/upload`, `/sources/watches`, `/install`, `promoteAttachment`.
- Fixture builder `file(over)` (:47-58). Add `expires_at: null` thread-life variants.
- **Count gate:** every new suite goes into BOTH `TARGETS` (`scripts/vitest-count-gate.cjs:4538`) and `BASELINE` (pin form at :3957 `"ChatAttachmentChip.states.test.tsx": 10,` with a reason comment above it) in the same commit. `src/components/chat` has no bare-directory TARGETS entry (:3838). An edited pinned suite may not decrease its count. Note that ChatAttachmentChip cases 1, 4 and 4b assert `chipTtl`, so retire them deliberately and keep count ≥ 10.

---

## Shared Patterns

### Ownership 404 (existence-leak rule D-062-12)
**Source:** `backend/app/api/workspace.py:55-76` `_verify_thread_ownership`, which raises `404 "Thread not found"`.
**Apply to:** every route in `workspace_promote.py`. Import it; never duplicate it. Malformed UUID → 404 (`workspace.py:656-662`). Missing, cross-thread and expired all collapse to `404 "File not found"` (`:668-674`).

### User-JWT first, service role only inside the shared enqueue (BUG-260903-02 / D-12)
**Source:** `workspace.py:664-679` (`get_user_pg_connection`) and `expert_install_service.py:17-24` (the docstring that states which client writes what).
**Apply to:** the promote route (read, mint, stamp), the preview route and the delete cleanup. The service role is touched only inside `_enqueue_or_splice` (`import_service.py:121-128`, the `documents` bucket PUT).

### Blocking supabase-py → `aexec` / `run_in_threadpool` (D-v2.5-01)
**Source:** `threads.py:1418-1439` (`await aexec(supabase.table(...)...)`, `await run_in_threadpool(supabase.storage.from_(...).remove, paths)`). The minter is already threadpooled (`async_mint_document_row`).
**Apply to:** all new backend supabase calls.

### Best-effort side work: logged, never `pass`
**Source:** `template_service.py:74-79` and `import_service.py:129-135` (`logger.warning(... id, exc)`).
**Apply to:** the storage remove in delete cleanup and the mark stamp after mint. Do NOT copy `threads.py:1440-1441`'s bare `pass`.

### Server sentence surfaced verbatim (never paraphrased)
**Source (backend):** `documents.py:586-595` (allow-list derived into the detail) and `ingest_splice.py:168-174`. **Source (frontend):** `lib/api/documents.ts:107-116`.
**Apply to:** promote 422/403/404, the dialog refusal slot and the chip.

### "PLANT to drive RED" + comment-stripped source fences
**Source:** `test_244_cloud_attach_is_thread_scoped.py:45-54, 117-139` (Python) and `ChatAttachmentChip.states.test.tsx:36-45` / `lib/stripComments.testutil.ts` (TS).
**Apply to:** the minter inventory, the workspace.py no-minter fence (keep green), the composer fence and the copy-port fences.

### Port, never re-type (sketch-to-build drift rule)
**Source:** `composerCopy.ts:1-38` + `ChatAttachmentChip.states.test.tsx:150-187`.
**Apply to:** `saveToLibraryCopy.ts` (from `.planning/sketches/274-save-to-library/COPY.js`) and any D-24 `expiredWhy` change (amend sketch 236 COPY.js and the port together, or the existing case-5 fence goes red).

### Hot-file ledger rows at creation (G-5)
**Source:** CLAUDE.md scan-list rows like `` `frontend/src/lib/stripComments.testutil.ts` | 1 / 1 / 28 | young (created 244-14 / IN-02). Row added AT CREATION. ... ``
**Apply to:** every new source file in this phase (`workspace_promote.py`, the models module, `thread_workspace_cleanup.py`, all `components/attachments/*`, `lib/attachmentLifetime.ts`, `lib/api/attachments.ts`). Each gets a row (≤ 200 chars) plus its `docs/HOT-FILE-LEDGER.md` section in the same commit. Touched files with NO row (`backend/app/db/workspace.py`, `backend/app/models/workspace.py`, `backend/app/services/template_service.py`, `backend/app/services/workspace_service.py`) must stay import-only or get rows. Verify with `node scripts/check-hot-file-ledger.cjs 274`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/tests/unit/test_274_delete_thread_cleanup.py` | test | stubbed route | No unit test of `delete_thread` exists anywhere in `backend/tests/unit`. Build it from the 244 `stubbed`-fixture shape and unit-test the new helper module directly (partial analog above). |

Every other file has a shipped analog. The phase's risk sits in the **parameters** (`version_scope="folder"`, `org_id=active_org`, `on_conflict="link"`, prefix strip, MIME override order) and in the **placement** (the promote route outside `workspace.py`, cleanup logic outside `threads.py`), not in new machinery.

## Metadata

**Analog search scope:** `backend/app/api`, `backend/app/services` (+ `sources/`), `backend/app/models`, `backend/app/db`, `backend/tests/unit`, `supabase/migrations` (068, 188, 195-202), `frontend/src/components/{chat,panel,health,relationships,experts/catalog}`, `frontend/src/lib`, `frontend/src/types`, `scripts/`
**Files scanned:** ~35 read or grepped
**Pattern extraction date:** 2026-10-05
