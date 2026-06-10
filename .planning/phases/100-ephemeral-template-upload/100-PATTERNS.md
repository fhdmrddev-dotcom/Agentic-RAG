# Phase 100: Ephemeral Template Upload - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 13 (1 NEW migration, 1 NEW service, 9 modified backend, 3 modified frontend, 1 comment-only)
**Analogs found:** 13 / 13 (every seam has an in-repo precedent — this phase is ~90% composition)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/068_*.sql` | migration | transform (DDL) | `supabase/migrations/067_skill_snapshots_sibling_column.sql` | exact (additive nullable columns + comments + footer) |
| `backend/app/api/workspace.py` (POST upload) | route/controller | file-I/O (multipart in) | `backend/app/api/documents.py:338` + `backend/app/api/skills.py:148` | exact (UploadFile + read + size guard) |
| `backend/app/api/workspace.py` (4 GET gates) | route/controller | request-response (read) | `backend/app/api/workspace.py:98/124/202/238` (self) | exact (add `.or_` filter to existing SELECTs) |
| `backend/app/services/template_service.py` (NEW) | service | transform / batch (sweep) + CRUD (pin) | `backend/app/services/skill_snapshot.py` (thin-seam target) + `backend/app/services/workspace_service.py:366` (delete_file Storage cleanup) | role-match (new file, composes existing helpers) |
| `backend/app/services/workspace_service.py` | service | file-I/O / CRUD | `backend/app/services/workspace_service.py:209` (write_file, self-extend) | exact (thread `kind`/`expires_at` through) |
| `backend/app/db/workspace.py` | db/repository | CRUD | `backend/app/db/workspace.py:8/103/133` (self) | exact (add columns to INSERT/SELECT; gate WHERE) |
| `backend/app/services/tool_dispatcher.py` (2 read handlers) | service/handler | request-response (agent tool) | `backend/app/services/tool_dispatcher.py:1049/1085` (self) + 099 D-04 gated branch | exact (gated filter + D-10 error surface) |
| `backend/app/main.py` (lifespan sweep) | config/bootstrap | event-driven (periodic) | `backend/app/main.py:238` (`_resume_stranded`) | exact (asyncio.create_task in lifespan) |
| `backend/app/api/threads.py` (run-pin call) | route/controller | request-response (thin delegate) | `backend/app/api/threads.py:787/962` (`_ensure_skill_snapshots` seam) | exact (one thin service call, no inline logic) |
| `backend/app/models/harness.py` | model | (comment-only) | `backend/app/models/harness.py:151-155` (self) | exact (repoint co-lock pointer to 101) |
| `frontend/src/lib/api.ts` | utility/client | file-I/O (upload) | `frontend/src/lib/api.ts:1161` (`uploadDocument`) | exact (FormData + Bearer) |
| `frontend/src/types/index.ts` | model/type | — | `frontend/src/types/index.ts:307` (`WorkspaceFile`) | exact (add 2 optional fields) |
| `frontend/src/components/panel/FilesSection.tsx` | component | request-response (panel render) | `frontend/src/components/panel/FilesSection.tsx` (self) + `StreamsProvider.tsx:2136` reconcile | exact (extend card + upload button) |

## Pattern Assignments

### `supabase/migrations/068_*.sql` (migration, DDL transform)

**Analog:** `supabase/migrations/067_skill_snapshots_sibling_column.sql`

**Header + apply/regenerate footer pattern** (067 lines 1-13):
```sql
-- 067_skill_snapshots_sibling_column.sql
-- Phase 099 GAP (...): <why> ...
-- Apply via the Supabase SQL editor (never `db push`/`db reset`), then
-- `bash scripts/regenerate-full-schema.sh` and commit both files.
```

**Additive-column + COMMENT pattern** (067 lines 15-24):
```sql
ALTER TABLE public.workflow_definitions
  ADD COLUMN IF NOT EXISTS skill_snapshots jsonb;
COMMENT ON COLUMN public.workflow_definitions.skill_snapshots IS
  'Phase 099 D-03a materialization state ... Nullable, no default; ...';
```

**Apply for 100:** Two NULLABLE columns (`kind text`, `expires_at timestamptz`), NO default (D-11 / Pitfall 5 — a default would make agent files acquire expiry and vanish). Permissive CHECK that allows NULL (`CHECK (kind IS NULL OR kind IN ('template_input','agent'))` — Pitfall 6, forward-compat for 101's future kinds). Partial index `WHERE expires_at IS NOT NULL` for the sweep + pin queries (RESEARCH §Code Examples gives the full body verbatim). NO new RLS policy — the existing `workspace_files_*_own` FK-chain policies are row-level and cover new columns (verified `full-schema.sql:2425-2457`). A separate ALTER adds `template_ttl_hours integer DEFAULT 24` to `app_settings` (D-05).

---

### `backend/app/api/workspace.py` — POST upload route (route, file-I/O)

**Analog:** `backend/app/api/documents.py:338-381` (multipart shell) + `backend/app/api/skills.py:148-163` (ZIP validation)

**Ownership guard + 404-not-403 pattern** (workspace.py:27-48 — already in this file, reuse directly):
```python
async def _verify_thread_ownership(thread_id, current_user, supabase) -> None:
    """Verify the authenticated user owns this thread. Raises 404 on failure.
    Uses 404 not 403 to prevent existence-leak (D-062-12 convention)."""
    resp = await aexec(
        supabase.table("threads").select("id")
        .eq("id", thread_id).eq("user_id", current_user["id"]).maybe_single()
    )
    if not (resp.data if resp is not None else None):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
```

**Multipart read + size/empty guard pattern** (documents.py:370-381):
```python
raw = await file.read()
MAX_FILE_SIZE = 50 * 1024 * 1024  # 100 uses 10 MB (mirror workspace_files_size_limit CHECK)
if len(raw) > MAX_FILE_SIZE:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="File too large. Maximum size is 50 MB.")
if len(raw) == 0:
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="File is empty")
```

**OOXML/ZIP magic-byte validation pattern** (skills.py:162-177 — the D-12 gate):
```python
import io, zipfile
if not zipfile.is_zipfile(io.BytesIO(raw)):
    raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP")
with zipfile.ZipFile(io.BytesIO(raw), "r") as zf:
    for entry_name in zf.namelist():   # 100: also assert '[Content_Types].xml' + per-ext marker
        ...
```
For 100, RESEARCH §Pattern 2 gives the full `validate_ooxml(filename, raw)` helper: extension allowlist `{.docx,.pptx,.xlsx}` → `is_zipfile` → `[Content_Types].xml` present → per-ext part-name prefix (`word/`/`ppt/`/`xl/`). `is_zipfile` (not a 4-byte `PK\x03\x04` sniff) validates the End-of-Central-Directory record, catching truncated/renamed binaries.

**Wrap-sync-supabase pattern** (documents.py:386-393 — D-v2.5-01 MANDATORY for any sync supabase/Storage call in an async handler):
```python
folder_check = await run_in_threadpool(
    lambda: supabase.table("folders").select("id, user_id").eq("id", folder_id).maybe_single().execute()
)
```

**TTL read** (D-05): `from app.models.user_settings import load_app_settings`; `ttl_hours = load_app_settings().template_ttl_hours` (the `load_app_settings()` sync-cache reader at `user_settings.py:498`; the upload handler is async so `load_app_settings_async()` at :508 also works — RESEARCH leans on adding a `template_ttl_hours` field to `_build_settings_from_row`).

**Persistence:** call `workspace_service.write_file(...)` (asyncpg) then set `kind`/`expires_at` — OR thread them through (see workspace_service assignment below). **SSE/reconcile (discretion):** RESEARCH Open-Q3 leans request-driven refetch over SSE reuse (the upload handler has no `run_id`/`ctx.redis` to attach `workspace_file_written` to — that event is emitted from inside a run at `tool_dispatcher.py:1020`). The panel already has `replaceWorkspaceFilesForThread`/`setWorkspaceFileForThread` for an optimistic upsert of the returned row.

---

### `backend/app/api/workspace.py` — 4 GET-route expiry gates (route, request-response)

**Analog:** the 4 existing GET handlers in this same file (self), + the 098 D-05a / 099 D-04 gated-no-op pattern.

**The 4 seams to gate** (each already does a `supabase.table("workspace_files").select(...)`):
- `list_workspace_files` — query built at `workspace.py:112-117`
- `get_workspace_file_content` — SELECT at `workspace.py:138-143` (**Pitfall 2 — the signed-URL bypass: the row read at :138 precedes the 60s signed URL at :171, so gating THIS SELECT closes the bypass before any URL is minted**)
- `list_workspace_file_versions` — parent-file existence SELECT at `workspace.py:215-220`
- `get_workspace_file_diff` — parent-file SELECT at `workspace.py:254-259`

**Gated filter pattern** (098 D-05a / 099 D-04 — NULL-expiry rows byte-identical):
```python
# ADD to each .select(...).eq("thread_id", ...) chain; gated so agent files (NULL) always pass:
.or_("expires_at.is.null,expires_at.gt." + _now_iso())
```
The `.select("...")` strings must also add `kind, expires_at` to surface them to the panel (D-02 badge needs `expires_at`). RED LINE: a NULL-expiry row matches `expires_at.is.null` → returned exactly as today (D-11).

---

### `backend/app/services/template_service.py` (NEW service — sweep batch + run-pin CRUD)

**Analog:** `backend/app/services/skill_snapshot.py` (the thin-seam delegate target that keeps `threads.py` from growing) + `backend/app/services/workspace_service.py:366-397` (`delete_file` Storage-cleanup composition).

**Storage-byte cleanup pattern to reuse in `sweep_expired`** (workspace_service.py:385-395):
```python
storage_paths = await get_storage_paths_for_file(pool, file_id)  # db/workspace.py:218 — UNIONs file + ALL version paths
await delete_file_by_path(pool, thread_id, path)                  # CASCADE drops workspace_file_versions
for sp in storage_paths:
    try:
        await run_in_threadpool(supabase.storage.from_(BUCKET_NAME).remove, [sp])
    except Exception:
        logger.warning(f"Failed to clean up storage object: {sp}")  # best-effort + log (Pitfall 3)
```
`sweep_expired` must (1) SELECT expired ids + collect ALL version Storage paths via `get_storage_paths_for_file` (the UNION already does file + versions — **reuse it**, do not hand-roll a Storage walk), (2) DELETE the `workspace_files` rows (FK CASCADE drops versions), (3) `storage.remove([all paths])` wrapped in `run_in_threadpool`. Idempotent by construction (Pitfall 3): a row a sibling worker already deleted isn't in the next SELECT; an already-removed path is a no-op `remove`. `WORKER_COUNT=2` safe with no lock (D-07).

**Run-pin (`pin_templates_for_run`) — one UPDATE, `GREATEST`-only:**
```sql
UPDATE workspace_files
SET expires_at = GREATEST(expires_at, now() + ($cap || ' seconds')::interval)
WHERE thread_id = $1 AND kind = 'template_input' AND expires_at IS NOT NULL;
```
`GREATEST` ensures the pin only ever EXTENDS, never shortens (D-08 fixed-from-upload preserved). A thread with no `template_input` row → UPDATE matches 0 rows → literal no-op (D-11). **Cap sizing (Pitfall 4 / A2):** `harness_phase_wall_clock_seconds` (`config.py:910` = 3600s) is **PER-PHASE**, not a whole-run cap; the engine resolves it per phase at `harness_engine.py:824` (`getattr(phase.config, "wall_clock_seconds", None) or _DEFAULT_PHASE_WALL_CLOCK`). Conservative run cap = `Σ phases (phase.config.wall_clock_seconds or 3600) + margin`, safe upper bound `len(definition.phases) × 3600 + margin`.

---

### `backend/app/services/workspace_service.py` (service, file-I/O / CRUD)

**Analog:** `workspace_service.write_file` at lines 209-294 (self-extend).

**The exact INSERT seam to thread new columns** — `write_file` calls `upsert_workspace_file` at lines 234-243 (no `kind`/`expires_at` today). Either add optional `kind: str | None = None`, `expires_at: datetime | None = None` kwargs to `write_file` → through to `upsert_workspace_file`, OR add a thin `write_template_file` sibling (discretion D). The hybrid inline/Storage routing (lines 232-261: `is_inline = size <= DEFAULT_INLINE_THRESHOLD` (256 KB), else Storage at `{user_id}/{thread_id}/{file_id}/v{n}`) and versioning are reused unchanged.

**OOXML binary-MIME hygiene (A1 — in-scope, planner-flagged):** `_BINARY_MIME_PREFIXES` (lines 42-50) does NOT include the OOXML MIME (`application/vnd.openxmlformats-officedocument.*`). A `workspace_read` of a template would fall through to the UTF-8 decode at line 332 → garbage. ADD the OOXML MIME prefix to that tuple so `read_file` returns the clean binary stub (lines 318-329) instead — a small additive change keeping the agent read honest:
```python
_BINARY_MIME_PREFIXES = (
    "image/", "audio/", "video/", "application/pdf", "application/zip",
    "application/gzip", "application/octet-stream",
    "application/vnd.openxmlformats-officedocument",  # 100: docx/pptx/xlsx → binary stub, not garbage decode
)
```

---

### `backend/app/db/workspace.py` (db/repository, CRUD)

**Analog:** the functions in this same file (self): `upsert_workspace_file:8`, `get_file_by_path:103`, `list_files_in_thread:133`, `get_storage_paths_for_file:218`.

**INSERT extension** — `upsert_workspace_file` (lines 20-36) uses an explicit column list; add `kind, expires_at` to the `INSERT (...) VALUES ($n...)` and the `ON CONFLICT DO UPDATE SET`. (Adding nullable columns the OLD INSERT omits is safe — they default NULL — verified RESEARCH §Runtime State.)

**Gated SELECT (asyncpg side of the two-layer split — Pitfall 1, the #1 pitfall):** the agent-tool read path is `get_file_by_path` (:103) and `list_files_in_thread` (:133). These are the OTHER two of the SIX read seams (the 4 supabase-py GETs are seams 1-4; these asyncpg reads are 5-6). Add to each WHERE:
```sql
AND (expires_at IS NULL OR expires_at > now())
```
**D-10 nuance:** a plain filter on `get_file_by_path` makes an expired read return generic not-found. D-10 wants "template expired". Lean: have `get_file_by_path` return the row + an `is_expired` computed flag (single query, no filter); the read handler then distinguishes expired-but-present vs truly-absent (RESEARCH §Pattern 3 / Pitfall 1). Also add `kind, expires_at` to the SELECT column lists at :107/:121/:142/:152.

**Reuse `get_storage_paths_for_file` (:218) verbatim in the sweep** — it already UNIONs the file row's path + ALL version paths (the "ALL versions' bytes" requirement).

---

### `backend/app/services/tool_dispatcher.py` — `_handle_workspace_read` / `_handle_workspace_list` (handler, request-response)

**Analog:** these two handlers in this same file (`:1049`, `:1085`) + the 099 D-04 gated-branch-on-a-shared-tool-handler pattern.

**Shared-with-Deep error-surface pattern** (tool_dispatcher.py:1081-1082):
```python
    except WorkspaceError as e:
        return ToolResult(result=json.dumps({"error": str(e)}))
```
The gate is applied IN the asyncpg query (db/workspace.py above), not re-implemented here — these handlers call `ws_read_file`/`ws_list_files` which go through the filtered db functions. **D-10 wiring:** when the read finds an expired template, surface `{"error": "template expired"}` (run-honesty — NOT a generic "File not found", which would make the model confabulate about a file the user knows they uploaded). RED LINE: these handlers are SHARED with Deep mode — the filter is gated (`expires_at IS NULL` passes) so agent-written files are byte-identical (D-06/D-11). This is the consumer SC#3 matters most for (Pitfall 1 warning sign: a short-TTL template read via the AGENT TOOL still returns content after expiry).

---

### `backend/app/main.py` — lifespan sweep task (config/bootstrap, event-driven)

**Analog:** `_resume_stranded` at `main.py:238-250` (the exact D-07 model).

**Lifespan background-task pattern** (main.py:238-250):
```python
async def _resume_stranded():
    try:
        from app.services.harness_engine import resume_stranded_workflows
        from app.dependencies import get_redis
        count = await resume_stranded_workflows(pool=await get_pg_pool(), redis=get_redis())
        if count:
            logger.info("Harness resume sweep re-ran %d stranded run(s)", count)
    except Exception:
        logger.exception("Harness resume sweep failed (app continues)")
asyncio.create_task(_resume_stranded())
```
For 100: a `while True:` loop wrapping `template_service.sweep_expired(...)` + `await asyncio.sleep(15 * 60)` (D-07 ~15 min; RESEARCH §Pattern 4 gives the verbatim body). Best-effort (`try/except logger.exception` — app continues). Spawn it next to `_resume_stranded` at line 250.

**Service-role client for the sweep — RESOLVED (was Open-Q1/A4, the highest-risk unknown):** `get_supabase()` (`dependencies.py:16-20`) IS the SERVICE-ROLE client — `create_client(settings.supabase_url, settings.supabase_service_role_key)`. The harness resume sweep ALREADY uses this exact precedent for a request-less sweep (`harness_engine.py:1134`: `from app.dependencies import get_supabase; _service_supabase = get_supabase()`). The template sweep sources its Storage client the same way (DB deletes via the raw `get_pg_pool()`, Storage byte removal via `get_supabase().storage.from_("workspace-files").remove(...)`). No new client to build.

---

### `backend/app/api/threads.py` — run-pin thin call (route, thin delegate)

**Analog:** `_ensure_skill_snapshots` at `threads.py:787-836` (the 099 D-03a thin-seam) and its call-site at `:962-969`.

**Thin-seam call-site pattern** (threads.py:962-969 — the run-pin lands the SAME shape, between this and `create_workflow_run` at :1110):
```python
_kickoff_definition = await _ensure_skill_snapshots(
    definition=_kickoff_definition,
    run_id=None, supabase=supabase, user_id=current_user["id"],
    definition_id=str(_kickoff_definition_id),
    skill_snapshots=_kickoff_skill_snapshots,
)
# 100 D-09 run-pin lands HERE (same gate `if _kickoff_definition is not None:`):
#   await template_service.pin_templates_for_run(pool=await get_pg_pool(),
#       thread_id=UUID(thread_id), run_wall_clock_cap=_run_cap_seconds(_kickoff_definition))
```
**G-5 RED LINE:** `threads.py` is a G-5-firing hot file (9+ phases). The run-pin MUST be a single delegating call — ALL logic (the UPDATE, the cap formula) lives in `template_service`, exactly as `_ensure_skill_snapshots` delegates every gate/copy to `skill_snapshot.py` (the docstring at :792 says verbatim "the hot file gains only this thin wrapper + the import — no inline ... query"). D-11: a thread with no template → the UPDATE no-ops; a no-workflow message never reaches this `_kickoff_definition is not None` branch.

---

### `backend/app/models/harness.py` (model, comment-only — D-13)

**Analog:** the co-lock comment block at `harness.py:151-155` (self).

**The stale pointer to repoint** (currently lines 151-155):
```python
# co-lock free, so Phases 100/103 don't re-touch this model). Behavior deferred:
# `inputs` (launch form) lands in Phase 103; `assets` (template/reference refs) in
# Phase 100. Provenance lives in run OUTPUT only ...
```
D-13: change "`assets` (template/reference refs) in Phase **100**" → **Phase 101** (this phase delivers the per-thread ephemeral UPLOAD; the definition-level `assets`/`AssetRef` LIBRARY lifecycle is Phase 101). The `AssetRef`/`InputFieldSpec` shapes (lines 156-170) are NOT touched — already locked, JSONB makes the co-lock free.

---

### `frontend/src/lib/api.ts` — `uploadWorkspaceTemplate` (client, file-I/O)

**Analog:** `uploadDocument` at `api.ts:1161-1177` (exact).

**FormData + Bearer upload pattern** (api.ts:1161-1174 — copy, swap the URL):
```typescript
export async function uploadDocument(file: File, folderId?: string | null): Promise<...> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets the multipart boundary
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  return ...
}
```
For 100: `POST ${API_BASE}/threads/${threadId}/workspace/files`, returns `WorkspaceFile` (RESEARCH §Code Examples gives the full body). The "NO Content-Type header" detail is load-bearing — the browser must set the multipart boundary itself.

---

### `frontend/src/types/index.ts` — `WorkspaceFile` extension (type)

**Analog:** `WorkspaceFile` at `types/index.ts:307-315` (self).

**Add two optional fields** (the interface already uses optional fields for forward-compat):
```typescript
export interface WorkspaceFile {
  id?: string
  path: string
  size_bytes: number
  mime_type: string
  version?: number
  created_at?: string
  updated_at?: string
  kind?: string          // 100: 'template_input' for ephemeral uploads (D-02 badge)
  expires_at?: string    // 100: ISO timestamp; drives countdown + amber tint (D-02)
}
```
Optional + absent on agent files → no badge, byte-identical render (D-11).

---

### `frontend/src/components/panel/FilesSection.tsx` (component, panel render)

**Analog:** this file (self) + the SSE reconcile in `StreamsProvider.tsx:2136`.

**Per-extension icon pattern to extend** (FilesSection.tsx:39-54 — `iconFor`): already switches on mime/ext (`FileText`/`FileSpreadsheet`/`FileImage`/`FileCode`/`FileIcon`); add `.docx`/`.pptx`/`.xlsx` cases (sketch 016 per-ext icons, D-02). Reuse the existing `formatBytes` (:33) + `fileKey` (:57) helpers.

**The reactive data source (no manual refresh)** (FilesSection.tsx:68-70):
```typescript
const threadId = useViewingThread()
const { data: files } = useWorkspaceFiles(threadId)   // StreamsProvider hook; `data` never undefined
```

**Store reconcile the upload reuses** (StreamsProvider.tsx:2136-2156 — `setWorkspaceFileForThread`, keyed by `path`, defensively preserves a known `id`): on a 200 upload, optimistically `setWorkspaceFileForThread(threadId, returnedFile)` OR refetch (the panel already upserts on the `workspace_file_written` SSE; `removeWorkspaceFileForThread` at :2157 handles the expiry-vanish, D-03). The countdown caption is computed from `expires_at` on render (RESEARCH §Code Examples `expiryCaption` — NO per-second `setInterval`, D-02 discretion / Anti-Pattern: a coarse 60s tick or natural re-render is the lean path). Amber tint via the established needs-attention color when `< 1h` to expiry (D-02).

## Shared Patterns

### Gated read-path filter (the SC#3 guarantee — applies to ALL SIX read seams)
**Source:** 098 D-05a / 099 D-04 (the gated-no-op invariant)
**Apply to:** 4 supabase-py GET routes (`workspace.py:112/138/215/254`) + 2 asyncpg tool reads (`db/workspace.py:get_file_by_path:103`, `list_files_in_thread:133`)
```sql
-- asyncpg:  AND (expires_at IS NULL OR expires_at > now())
-- supabase-py:  .or_("expires_at.is.null,expires_at.gt." + _now_iso())
```
**Why six, not four (Pitfall 1):** the workspace subsystem has TWO disjoint data-access layers that share NO query code — `workspace.py` uses supabase-py (RLS via the `threads.user_id` join); the agent tools go through `workspace_service` → `db/workspace.py` raw asyncpg (no RLS). A filter on one is invisible to the other. The agent-tool path is the consumer SC#3 matters MOST for (the workflow run reads the template there). Gate ALL SIX. NULL-expiry (agent) rows pass → byte-identical (D-11).

### Service-role client for request-less background work
**Source:** `dependencies.py:16-20` (`get_supabase()` = `create_client(url, service_role_key)`); precedent `harness_engine.py:1134`
**Apply to:** the lifespan sweep (`main.py` / `template_service.sweep_expired`) — it runs outside any request so it has no user JWT. `get_supabase()` (RLS-bypassed service role) reaches the Storage API to delete bytes across all users; DB deletes use the raw `get_pg_pool()`. THREAT note (from harness precedent): a service-role client bypasses RLS — keep the sweep scoped to `expires_at < now()` rows only; it never reads/returns user content, just deletes expired rows + their Storage objects.

### Wrap blocking supabase/Storage calls in `run_in_threadpool`
**Source:** D-v2.5-01; `documents.py:386`, `workspace.py:171`, `workspace_service.py:249/391`
**Apply to:** every sync `supabase.table(...).execute()` / `supabase.storage.from_(...)` call in the new async upload handler and the sweep. MANDATORY — never call blocking supabase-py directly inside an async handler.

### Ownership guard returns 404 not 403
**Source:** `workspace.py:27-48` (`_verify_thread_ownership`, D-062-12 convention)
**Apply to:** the new POST upload route — reuse `_verify_thread_ownership` verbatim (RLS half of SC#1; UAT row 6 / `/gsd:secure-phase` reuse this for cross-user isolation).

### Additive migration + regenerate full-schema
**Source:** `067_skill_snapshots_sibling_column.sql` + CLAUDE.md migration rules
**Apply to:** migration 068 — numbered SQL under `supabase/migrations/`, apply via Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no reset), commit BOTH `068_*.sql` and `full-schema.sql`.

## No Analog Found

None. Every seam has an in-repo precedent — this is the central research finding (RESEARCH §"~90% composition"). The two items that were genuine unknowns are now resolved by direct read:

| Former unknown | Resolution |
|------|------------|
| Service-role Storage client for the sweep (Open-Q1 / A4, "highest-risk") | `get_supabase()` at `dependencies.py:16-20` IS the service-role client; reused by the harness sweep at `harness_engine.py:1134`. |
| Whole-run wall-clock cap for the run-pin (A2) | No whole-run cap exists; `harness_phase_wall_clock_seconds` (`config.py:910` = 3600) is PER-PHASE, resolved per phase at `harness_engine.py:824`. Conservative pin = `len(phases) × 3600 + margin`. |

## Metadata

**Analog search scope:** `backend/app/api/` (workspace, documents, skills, threads), `backend/app/services/` (workspace_service, tool_dispatcher, harness_engine, skill_snapshot), `backend/app/db/workspace.py`, `backend/app/models/` (harness, user_settings), `backend/app/main.py`, `backend/app/dependencies.py`, `backend/app/config.py`, `supabase/migrations/067`, `frontend/src/` (api.ts, types/index.ts, FilesSection.tsx, StreamsProvider.tsx)
**Files scanned:** ~16 read + 4 targeted greps
**Pattern extraction date:** 2026-06-10
