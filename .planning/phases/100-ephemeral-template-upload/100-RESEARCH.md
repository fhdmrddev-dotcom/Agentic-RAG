# Phase 100: Ephemeral Template Upload - Research

**Researched:** 2026-06-10
**Domain:** FastAPI multipart upload + additive Postgres migration + read-path expiry filtering + in-process janitor + React panel affordance
**Confidence:** HIGH (all 10 focus areas grounded in actual codebase reads; no library-version risk — net-new code reuses in-repo precedents and stdlib only)

## Summary

Phase 100 is a low-blast-radius, additive plumbing phase that adds one genuinely new write path (a multipart upload endpoint) to a workspace subsystem that is otherwise GET-only today. Every other piece is a near-mechanical reuse of an existing in-repo precedent: the OOXML/ZIP validation is the exact `zipfile.is_zipfile` pattern already in `skills.py:162`, the migration is the same shape as `067_skill_snapshots_sibling_column.sql`, the read-path expiry gate is the 098 D-05a / 099 D-04 gated-no-op pattern, the janitor task copies the `main.py` lifespan harness-resume sweep, and the run-pin copies 099's `_ensure_skill_snapshots` thin seam. There are no new heavy dependencies, no new providers, and no SC#10 cross-provider surface (upload plumbing carries no LLM run).

The single most important architectural fact discovered: **the workspace subsystem has TWO data-access layers that do NOT share a query path.** The REST API routes in `workspace.py` use **supabase-py (RLS-enforced via the `threads.user_id` join)**, while the service layer (`workspace_service.write_file`) and agent tools (`tool_dispatcher._handle_workspace_*`) use the **raw asyncpg pool (no RLS — direct SQL)**. The expiry filter (D-06) must therefore be applied in BOTH layers independently, and the migration's new columns must be readable/writable from both. The upload endpoint lands in the supabase-py/RLS layer (`workspace.py`) but the persistence helper it calls (`write_file`) is asyncpg — so the upload either threads `kind`/`expires_at` through `write_file` (asyncpg) or sets them in a follow-up update. This split is the central design decision for the planner.

The "never retrievable after expiry" guarantee (SC#3) is enforced by the read-path filter, not the sweep — the sweep is pure garbage collection. The "never in search" guarantee (SC#2) is **structurally true today**: `workspace_files` is referenced by exactly four source files (the workspace API, db, service, and tool dispatcher); ingestion (`extraction_service`), embedding, and retrieval (`retrieval_service`) never touch the table — search reads exclusively from `document_chunks` via the `match_document_chunks`/`keyword_search_chunks` RPCs, populated only from the `documents` table/Storage bucket. The phase preserves this isolation by construction (it adds no ingestion call path).

**Primary recommendation:** Add columns `kind text` + `expires_at timestamptz` (both nullable, no behavior change for existing rows) in migration 068; add `POST /threads/{tid}/workspace/files` to `workspace.py` using the `documents.py`/`skills.py` `UploadFile` + `zipfile.is_zipfile` pattern; gate every read on `expires_at IS NOT NULL` in both `workspace.py` GET routes and the `_handle_workspace_read`/`_handle_workspace_list` tools; add a ~15-min asyncio sweep to `main.py` lifespan deleting expired rows + ALL their Storage version bytes; pin via a thin one-UPDATE service call at the threads.py kickoff seam covering `num_phases × harness_phase_wall_clock_seconds (3600s) + margin`; surface upload + a Template badge/countdown in `FilesSection.tsx`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Upload UX & ephemeral visibility (sketch-aligned)**
- **D-01:** Entry point = an "Upload template" affordance in the workspace panel's Files section (`FilesSection.tsx`). The composer stays untouched (a composer attach would read as "add to KB" — the exact ambiguity TMPL-01 closes).
- **D-02:** Ephemeral cue = kind-distinct file card with a "Template" badge + live expiry countdown (muted mono caption, e.g. "expires in 23h"; amber tint when close to expiry; per-extension file icons per sketch 016).
- **D-03:** Expiry UX = the file simply disappears from the list (panel = now). No tombstone. Chat history untouched.
- **D-04:** No chat artifact on upload. Upload is a panel action; nothing renders in the conversation.

**TTL + sweep mechanics**
- **D-05:** Default TTL = 24 hours, stored in `app_settings` (tunable without code; no Settings-UI work this phase). Planner picks the key name.
- **D-06:** The "not retrievable after expiry" guarantee lives in read-path filtering, NOT the sweep. Every read excludes expired rows the instant `expires_at` passes. The filter is **gated on `expires_at IS NOT NULL`** so all existing (agent-written, NULL expiry) workspace files behave byte-identically — the 098 D-05a gated-no-op pattern.
- **D-07:** Physical deletion = in-process asyncio periodic task in the FastAPI lifespan (~15 min cadence; planner picks interval), deleting expired rows AND their Storage bytes via supabase-py. Idempotent by construction so `WORKER_COUNT=2` double-running is harmless. pg_cron rejected (cannot call Storage API → bytes orphan); startup-only sweep rejected (bytes linger until restart).

**Expiry semantics vs runs**
- **D-08:** TTL is fixed from upload — no silent refresh on use. Predictable ephemerality.
- **D-09:** Run-pin exception: a workflow run that starts before expiry bumps `expires_at` forward just enough to cover the run's wall-clock cap (+ margin) at kickoff — one UPDATE, no snapshot machinery. No run can die mid-flight from template expiry.
- **D-10:** Expired/missing template reads return a clear tool error naming expiry ("template expired") so the model can relay honestly. NOT a generic not-found.
- **D-11 (locked invariant):** The template is OPTIONAL everywhere. No workflow requires a template; the kickoff path doesn't check for one; a workflow without a template runs byte-identically to today. Every touched code path is a literal no-op when no `template_input` file exists.

**Template typing & the Phase-101 seam**
- **D-12:** Strict allowlist + magic-byte validation. Only `.docx`/`.pptx`/`.xlsx`; verify the actual bytes are a ZIP/OOXML container (all three are ZIPs — one cheap check), not just extension/MIME. Renamed binaries rejected at the door with a clean visible error. The existing `workspace_files_size_limit` CHECK (10 MB) applies.
- **D-13:** Definition-level `assets`/`AssetRef` behavior is DEFERRED to Phase 101. Update the 098 co-lock comment in `harness.py` to point at 101 when convenient.
- **D-14:** Runs find the template by kind, in-thread. Phase 101's fill step looks for the thread's live (non-expired) workspace file(s) with `kind='template_input'` — newest wins. Zero kickoff-API changes in this phase; the seam is just the `kind` column + readable tools.

### Claude's Discretion
- Exact `kind` column design (text + CHECK vs enum; default `'agent'` or NULL for existing rows) — must keep existing rows valid with zero behavioral change.
- `app_settings` key naming, sweep interval, run-pin margin size.
- Multipart upload implementation details (streaming vs buffered; reuse of `workspace_service.write_file` vs a thin sibling).
- Whether the countdown updates live or on panel re-render (lean: cheap re-render cadence, no per-second timers).
- Whether upload emits the existing `workspace_file_written` SSE event or a sibling event (lean: reuse, the panel already consumes it).
- Duplicate-filename handling on re-upload (workspace versioning exists; lean: new version, same expiry rules).

### Deferred Ideas (OUT OF SCOPE)
- Definition-level `assets`/`AssetRef` behavior (workflow-owned library templates, no-TTL lifecycle) → **Phase 101**.
- Explicit template reference at kickoff / launch-form file input → **Phase 103** (`InputFieldSpec.type: "file"` already locked).
- Settings-UI exposure of the template TTL → future Settings polish; 100 ships the `app_settings` row only.
- Composer attach affordance → revisit at Phase 104 at earliest, only if the panel button is undiscoverable.
- Template preview in the panel (rendering docx/pptx/xlsx) → SEED-037 / Phase 108 `file_preview` plugin territory.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TMPL-01 | A user can upload a template (docx/pptx/xlsx) into a thread **temporarily** — workspace-only, TTL + cron sweep, RLS-scoped, **never ingested into the KB and never appearing in search**. (Also closes the injection-via-uploaded-doc vector.) | Multipart upload pattern (`documents.py:339`, `skills.py:416`); OOXML/ZIP validation (`skills.py:162` — `zipfile.is_zipfile`); migration shape (`067` precedent); read-path expiry gate (098 D-05a / 099 D-04); janitor (`main.py:238` lifespan sweep); run-pin (`threads.py:962` `_ensure_skill_snapshots` seam); panel (`FilesSection.tsx`); structural isolation proof (`workspace_files` untouched by ingestion/embedding/retrieval — verified). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multipart parse + validation (type, size) | API / Backend (`workspace.py`) | — | Upload is an authenticated HTTP action; FastAPI `UploadFile` + RLS ownership check belong at the route. Lands HERE, not threads.py (G-5). |
| Persistence (inline ≤256KB / Storage) | API / Backend (`workspace_service.write_file`, asyncpg) | Database / Storage | Reuses the existing hybrid write path; bytes land in Postgres `bytea` or the `workspace-files` Storage bucket. |
| TTL state (`kind` + `expires_at`) | Database (`workspace_files` columns) | — | New nullable columns on the existing table; partial index for the sweep query. |
| Read-path expiry filtering | API / Backend (BOTH supabase-py routes AND asyncpg tools) | — | The guarantee (SC#3) is the filter. Two disjoint data-access layers each need the gate. |
| Physical GC (rows + Storage bytes) | API / Backend (asyncio lifespan task) | Storage | In-process sweep; supabase-py to reach the Storage API (pg_cron can't). |
| Run-pin (`expires_at` bump at kickoff) | API / Backend (thin service call at `threads.py` kickoff) | Database | One UPDATE covering the run wall-clock cap; D-11 keeps it a no-op when no template exists. |
| Upload affordance + badge/countdown | Browser / Client (`FilesSection.tsx`) | Frontend (StreamsProvider SSE reconcile) | Panel = now; the file card renders kind + a re-render-cadence countdown. |
| Cross-user isolation | Database (RLS) | API (`_verify_thread_ownership`) | RLS policies already scope every `workspace_files` row to the thread owner; the upload inherits SC#1 for free. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI `UploadFile` / `File(...)` | in-repo (already used) | Multipart form parse | The in-repo precedent for every existing upload (`documents.py:342`, `skills.py:150`). No new dep. |
| Python `zipfile` (stdlib) | stdlib | OOXML magic-byte validation | `.docx`/`.pptx`/`.xlsx` are all ZIP (OOXML) containers; `zipfile.is_zipfile(io.BytesIO(raw))` is the exact check already used at `skills.py:162`. No heavy dep (D-12). |
| supabase-py | in-repo | RLS-enforced reads/writes in `workspace.py` + Storage API for the janitor | The API-route data layer; also the only way to reach the Storage API for byte deletion (D-07). |
| asyncpg pool | in-repo | Service-layer + agent-tool data path (`workspace_service`, `tool_dispatcher`) | The non-RLS direct-SQL layer; `write_file` and the workspace tools run on it. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `app.utils.db.aexec` | in-repo | Async wrapper for supabase-py query builders | Every supabase-py call in `workspace.py` already uses it. |
| `starlette.concurrency.run_in_threadpool` | in-repo | Wrap blocking supabase-py / Storage calls | MANDATORY for any sync supabase-py / `storage.from_(...)` call inside an async handler (D-v2.5-01). Already used for signed-URL + Storage upload/download/remove. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zipfile.is_zipfile` + `[Content_Types].xml` sniff | `python-magic` / `filetype` lib | Rejected — adds a dep for what stdlib does reliably for ZIP-container OOXML. D-12 says no new heavy deps. |
| In-process asyncio sweep (D-07) | pg_cron | Rejected by operator (D-07) — pg_cron cannot call the Storage API → Storage bytes orphan. |
| Reuse `workspace_service.write_file` for upload | Thin sibling write fn | Discretion (D); `write_file` already does size-check, hybrid inline/Storage, versioning. The only gap: it does NOT set `kind`/`expires_at` — those need threading through or a follow-up UPDATE. |

**Installation:** No new packages. (If the planner chooses a Redis advisory lock for the sweep — optional polish per D-07 — `redis` is already a dependency.)

**Version verification:** N/A — zero new dependencies. All building blocks are already imported and exercised in the codebase (verified by reading `documents.py`, `skills.py`, `workspace.py`, `workspace_service.py`, `main.py`, `threads.py`).

## Architecture Patterns

### System Architecture Diagram

```
UPLOAD PATH (net-new write)
  Browser FilesSection "Upload template" button
    │  FormData(file) + Bearer token  (uploadDocument pattern, api.ts:1161)
    ▼
  POST /threads/{tid}/workspace/files   [workspace.py — supabase-py / RLS layer]
    │  1. _verify_thread_ownership(tid)             → 404 on non-owner (RLS half of SC#1)
    │  2. raw = await file.read()
    │  3. validate type: ext ∈ {.docx,.pptx,.xlsx}  AND  zipfile.is_zipfile(BytesIO(raw))
    │        + optional [Content_Types].xml sniff   → 422 on renamed binary/PDF (D-12)
    │  4. size ≤ 10MB (CHECK + pre-write guard)      → 422 if over
    │  5. ttl = load_app_settings().template_ttl_hours (default 24)  (D-05)
    │  6. write bytes  ──────────────────────────────┐
    │  7. set kind='template_input', expires_at=now+ttl   (D-12/D-05)
    │  8. emit workspace_file_written SSE (reuse — D)  (discretion: reuse existing event)
    ▼                                                 ▼
  workspace_service.write_file (asyncpg)        workspace_files row
    │  hybrid: inline ≤256KB  else  Storage         + NEW: kind, expires_at
    ▼                                              + workspace_file_versions (all versions)
  Storage bucket workspace-files                  Storage path {user}/{tid}/{file_id}/v{n}
    {user_id}/{thread_id}/{file_id}/v{n}

READ PATH (gated filter — the SC#3 guarantee)
  GET /workspace/files  (panel)         _handle_workspace_read / _list  (agent tools)
  GET /workspace/files/{id}/content     ─┐
       [supabase-py / RLS]                │  [asyncpg / no-RLS]
            │                             │
            ▼  ADD: WHERE (expires_at IS NULL OR expires_at > now())
       gated no-op when expires_at IS NULL (D-06 / D-11)
            │
       expired template read by agent → "template expired" tool error (D-10)

JANITOR PATH (pure GC — never the guarantee)
  main.py lifespan  → asyncio.create_task(_sweep_expired_templates())  (D-07)
    │  every ~15 min, idempotent (WORKER_COUNT=2 safe)
    │  SELECT id, all version storage_paths  WHERE expires_at < now()
    │  DELETE workspace_files row (CASCADE drops versions)
    │  supabase.storage.from_("workspace-files").remove([ALL version paths])  (run_in_threadpool)
    ▼
  rows gone + bytes gone  (SC#3 physical-deletion half)

RUN-PIN PATH (kickoff)
  POST /{tid}/messages  (workflow kickoff, threads.py)
    │  after _ensure_skill_snapshots (~962), before create_workflow_run (~1110)
    ▼  thin service call (D-09):  UPDATE workspace_files
       SET expires_at = GREATEST(expires_at, now() + run_wall_clock_cap + margin)
       WHERE thread_id = $1 AND kind='template_input' AND expires_at IS NOT NULL
    │  run_wall_clock_cap = num_phases × harness_phase_wall_clock_seconds (3600) + margin
    │  D-11: a thread with no template → UPDATE matches 0 rows → literal no-op

ISOLATION (SC#2 — structural, no code added)
  Ingestion (extraction_service) ─→ documents table + documents Storage bucket
  Embedding ────────────────────→ document_chunks
  Search (retrieval_service) ────→ RPC match_document_chunks / keyword_search_chunks
                                    (reads document_chunks ONLY)
  workspace_files ───────────────→ referenced by 4 files: workspace.py, db/workspace.py,
                                    tool_dispatcher.py, workspace_service.py — NONE of
                                    which is ingestion/embedding/retrieval.  DISJOINT.
```

### Component Responsibilities

| File | Change | Notes |
|------|--------|-------|
| `supabase/migrations/068_*.sql` | NEW | `kind text` + `expires_at timestamptz` (both nullable) + partial index `WHERE expires_at IS NOT NULL`. Comment + apply-via-SQL-editor footer like `067`. |
| `backend/app/api/workspace.py` | ADD POST route + gate 4 GET routes | Upload endpoint (multipart, validation, write, set kind/expires_at, SSE). Add `WHERE (expires_at IS NULL OR expires_at > now())` filter to files-list (~98), content (~124), versions (~202), diff (~238). |
| `backend/app/services/workspace_service.py` | thread `kind`/`expires_at` OR add sibling | Either extend `write_file` signature (optional `kind`, `expires_at` kwargs → through to `upsert_workspace_file`) or add a thin `write_template_file` sibling. |
| `backend/app/db/workspace.py` | extend `upsert_workspace_file` + list/get queries | Add the two columns to INSERT/SELECT; the tool-path list/read queries get the same expiry filter (gated). |
| `backend/app/services/tool_dispatcher.py` | gate `_handle_workspace_read` (~1049) + `_handle_workspace_list` (~1085) | Expiry filter on the asyncpg read path; D-10 "template expired" error surface for an expired-but-not-swept read. |
| `backend/app/main.py` | ADD lifespan sweep task | `_sweep_expired_templates` periodic asyncio task (copy the `_resume_stranded` shape ~238); idempotent. |
| `backend/app/api/threads.py` | ADD thin run-pin call at kickoff | One service call between ~969 and ~1110; NO inline query (G-5 — threads.py must not grow logic). Delegate to a `template_service.pin_templates_for_run(...)`. |
| `backend/app/config.py` | optional Settings field | If TTL also wants an env override; D-05 stores it in `app_settings` (DB), so the planner may read it via `load_app_settings()` and NOT add a config field. |
| `frontend/src/lib/api.ts` | ADD `uploadWorkspaceTemplate(tid, file)` | FormData + Bearer (copy `uploadDocument` 1161). |
| `frontend/src/types/index.ts` | extend `WorkspaceFile` (307) | Add optional `kind?: string` + `expires_at?: string`. |
| `frontend/src/components/panel/FilesSection.tsx` | upload button + Template badge + countdown | Per-extension icons (sketch 016), amber tint near expiry (D-02), file vanishes on expiry (D-03). |
| `backend/app/models/harness.py` | comment-only (D-13) | Update the 098 co-lock comment (~151-155) to point `assets` behavior at Phase 101. |

### Recommended Project Structure
```
backend/app/
├── api/
│   ├── workspace.py          # + POST upload, + expiry-gated GET routes
│   └── threads.py            # + thin run-pin call at kickoff (no inline logic)
├── services/
│   ├── workspace_service.py  # write_file threads kind/expires_at (or sibling)
│   └── template_service.py   # NEW: pin_templates_for_run(); optional upload helper
│                             #      (keeps threads.py & workspace.py thin — G-5)
├── db/workspace.py           # + columns in INSERT/SELECT; gated list/read queries
└── main.py                   # + _sweep_expired_templates lifespan task
supabase/migrations/068_*.sql # NEW additive migration
frontend/src/
├── lib/api.ts                # + uploadWorkspaceTemplate
├── types/index.ts            # WorkspaceFile + kind, expires_at
└── components/panel/FilesSection.tsx  # upload + badge + countdown
```

### Pattern 1: Multipart upload with `UploadFile` (the in-repo precedent)
**What:** FastAPI parses `multipart/form-data` via the `UploadFile = File(...)` dependency; `await file.read()` buffers bytes.
**When to use:** The `POST /threads/{tid}/workspace/files` endpoint.
**Example:**
```python
# Source: backend/app/api/documents.py:339-381 (verified in-repo)
@router.post("/{thread_id}/workspace/files")
async def upload_workspace_template(
    thread_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    await _verify_thread_ownership(thread_id, current_user, supabase)  # RLS half SC#1 (404)
    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(422, "File is empty")
    if len(raw) > 10 * 1024 * 1024:          # mirror workspace_files_size_limit CHECK
        raise HTTPException(422, "File too large. Maximum size is 10 MB.")
    # ... type validation (Pattern 2) ...
    # ... write via workspace_service + set kind/expires_at ...
```

### Pattern 2: OOXML / ZIP-container validation (D-12, stdlib only)
**What:** `.docx`/`.pptx`/`.xlsx` are all ZIP (OOXML) packages. The cheap reliable check is `zipfile.is_zipfile` (verifies the PK ZIP structure, not just the `PK\x03\x04` 4 bytes — it checks the End-of-Central-Directory record, so a truncated/renamed binary fails). An optional `[Content_Types].xml` sniff + per-extension subdir (`word/`, `ppt/`, `xl/`) distinguishes the three OOXML types and rejects a non-Office ZIP.
**When to use:** Immediately after `await file.read()`, before any persistence.
**Example:**
```python
# Source: backend/app/api/skills.py:162,168 (verified in-repo — is_zipfile + namelist)
import io, zipfile

_ALLOWED_EXT = {".docx", ".pptx", ".xlsx"}
# OOXML part-name prefix that distinguishes the three (defense-in-depth, optional):
_OOXML_MARKER = {".docx": "word/", ".pptx": "ppt/", ".xlsx": "xl/"}

def validate_ooxml(filename: str, raw: bytes) -> str:
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXT:
        raise HTTPException(422, f"Unsupported type {ext}. Allowed: .docx, .pptx, .xlsx")
    bio = io.BytesIO(raw)
    if not zipfile.is_zipfile(bio):
        raise HTTPException(422, "File is not a valid Office document (not a ZIP/OOXML container)")
    # Defense-in-depth: confirm it's the claimed Office type, not an arbitrary ZIP.
    with zipfile.ZipFile(bio) as zf:
        names = zf.namelist()
        if "[Content_Types].xml" not in names:
            raise HTTPException(422, "File is not a valid OOXML document")
        if not any(n.startswith(_OOXML_MARKER[ext]) for n in names):
            raise HTTPException(422, f"File contents do not match a {ext} document")
    return ext
```
*Note:* `mimetypes.guess_type` (used by `workspace_service.guess_mime_type`) already maps `.docx`/`.pptx`/`.xlsx` to their `application/vnd.openxmlformats-officedocument.*` MIME types on most platforms — but D-12 explicitly requires byte validation, not MIME trust. Keep the byte check as the gate; let `guess_mime_type` set the stored `mime_type` for the row.

### Pattern 3: Gated read-path filter (098 D-05a / 099 D-04 — the no-op invariant)
**What:** Every read excludes expired rows, but the filter is structured so that NULL-expiry (agent-written) rows are byte-identical to today.
**When to use:** All 4 GET routes (`workspace.py`) AND the two asyncpg tool handlers.
**Example:**
```python
# supabase-py route (workspace.py list_workspace_files ~112) — ADD .or_ filter:
query = (
    supabase.table("workspace_files")
    .select("id, path, size_bytes, mime_type, created_at, updated_at, kind, expires_at")
    .eq("thread_id", thread_id)
    # Gated: NULL-expiry rows always pass → agent files byte-identical (D-06/D-11)
    .or_("expires_at.is.null,expires_at.gt." + _now_iso())
    .order("path")
)

# asyncpg tool path (db/workspace.py list_files_in_thread) — ADD to WHERE:
#   WHERE thread_id = $1 AND (expires_at IS NULL OR expires_at > now())
# get_file_by_path (read tool) gets the same clause so an expired template
# read raises FileNotFoundError_ → the handler maps it to the D-10 message.
```
**The D-10 nuance:** A plain expiry filter would make an expired template read return generic "File not found" — but D-10 wants "template expired" so the model relays honestly. The read handler should distinguish: if `get_file_by_path` (unfiltered) finds a row but it IS expired (`expires_at < now()`), return `{"error": "template expired"}`; if no row at all, generic not-found. A single query returning the row + an `is_expired` computed flag handles both cheaply.

### Pattern 4: In-process idempotent sweep (D-07 — copy `_resume_stranded`)
**What:** A lifespan-spawned periodic task; idempotent so two workers running it is harmless.
**When to use:** `main.py` lifespan, alongside `_resume_stranded`.
**Example:**
```python
# Source shape: backend/app/main.py:238-250 (_resume_stranded) — verified in-repo
async def _sweep_expired_templates():
    while True:
        try:
            from app.services.template_service import sweep_expired
            from app.dependencies import get_pg_pool, get_supabase_admin
            n = await sweep_expired(pool=await get_pg_pool(), supabase=get_supabase_admin())
            if n:
                logger.info("Template sweep deleted %d expired template(s)", n)
        except Exception:
            logger.exception("Template sweep failed (app continues)")
        await asyncio.sleep(15 * 60)   # discretion: D-07 ~15 min

asyncio.create_task(_sweep_expired_templates())  # in lifespan, next to _resume_stranded
```
`sweep_expired` must: (1) SELECT expired `workspace_files` ids + collect ALL their version Storage paths (`get_storage_paths_for_file` already does the UNION of file + version paths — reuse it), (2) DELETE the `workspace_files` rows (the FK `ON DELETE CASCADE` drops `workspace_file_versions`), (3) `supabase.storage.from_("workspace-files").remove([paths])` wrapped in `run_in_threadpool` (mirror `workspace_service.delete_file` 389-395). Idempotency: a row already deleted by a sibling worker simply isn't in the next SELECT; a Storage path already removed is a no-op `remove`.

### Pattern 5: Thin run-pin at kickoff (D-09 — copy `_ensure_skill_snapshots`)
**What:** One service call at the workflow-kickoff seam that bumps `expires_at` so the run can't outlive the template. Zero inline logic in `threads.py` (G-5).
**When to use:** Between `_ensure_skill_snapshots` (~969) and `create_workflow_run` (~1110).
**Example:**
```python
# Source shape: backend/app/api/threads.py:962 (_ensure_skill_snapshots seam) — verified
# After _kickoff_definition is finalized, before create_workflow_run:
if _kickoff_definition is not None:
    # D-09 run-pin: one UPDATE; D-11 no-op when the thread has no template_input file.
    await template_service.pin_templates_for_run(
        pool=await get_pg_pool(),
        thread_id=UUID(thread_id),
        run_wall_clock_cap=_run_cap_seconds(_kickoff_definition),  # see below
    )
```
**Sizing the cap:** The run cap is NOT a single setting — `harness_phase_wall_clock_seconds` (default **3600s = 1h**, `config.py:910`) is **per-phase**, and a definition runs phases sequentially. The conservative run cap = `Σ over phases of (phase.config.wall_clock_seconds or 3600)` + a margin. A simple safe upper bound: `len(definition.phases) × 3600 + margin`. The pin UPDATE: `SET expires_at = GREATEST(expires_at, now() + (cap || ' seconds')::interval) WHERE thread_id=$1 AND kind='template_input' AND expires_at IS NOT NULL`. `GREATEST` ensures the pin never shortens an already-longer TTL (D-08 fixed-from-upload is preserved; the pin only ever extends).

### Anti-Patterns to Avoid
- **Filtering only in `workspace.py` and forgetting the asyncpg tool path:** The two data layers are disjoint. An agent tool reading an expired template via the asyncpg path would bypass an API-only filter → SC#3 fails. Both layers need the gate (this is the #1 pitfall — see Pitfall 1).
- **Relying on the sweep for the guarantee:** The sweep runs every ~15 min; between expiry and sweep the row still exists. The READ FILTER (not the sweep) is the guarantee (D-06). Never gate readability on physical deletion.
- **Forgetting the signed-URL bypass:** `GET /files/{id}/content` returns a 60s Storage signed URL for bucket files (`workspace.py:171`). The expiry filter must apply to THIS route too, or an expired large-template's content endpoint would still mint a working signed URL → SC#3 bypass. Verified: the content route reads the row first (`workspace.py:138`), so adding the expiry clause to that SELECT closes the bypass before any signed URL is created.
- **Growing `threads.py` (G-5):** `backend/app/api/threads.py` is a G-5-firing hot file (9+ phases). The run-pin must be a single delegating call — all logic in `template_service`, exactly like `_ensure_skill_snapshots` delegates to `skill_snapshot.py`.
- **A per-second countdown timer in the panel (D-02 discretion):** `setInterval(…, 1000)` per file card causes constant re-renders. Lean (CONTEXT discretion): compute the countdown from `expires_at` on each natural re-render / a coarse (e.g. 60s) tick, or just on SSE/refetch reconcile.
- **Non-idempotent sweep with a hard lock:** D-07 explicitly says no lock needed; idempotency by construction. Adding a required Redis lock introduces a failure mode (lock not released) for no benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OOXML/Office file detection | Custom `PK\x03\x04` byte sniff + manual ZIP parse | `zipfile.is_zipfile` + `ZipFile.namelist()` (stdlib) | Already the in-repo pattern (`skills.py:162`). `is_zipfile` validates the full ZIP central directory, catching truncated/renamed binaries a 4-byte sniff would pass. |
| Hybrid inline/Storage persistence + versioning | New write path | `workspace_service.write_file` | Does size-check, inline-threshold routing, Storage upload, version insert, soft-limit warning. The upload is "validate + one call". |
| Multipart parsing | Manual `request.form()` byte handling | `UploadFile = File(...)` | FastAPI/Starlette dependency; the in-repo standard for all 3 existing uploads. |
| Storage byte cleanup on delete | New Storage walk | `get_storage_paths_for_file` (UNION of file + all version paths) + `storage.from_(...).remove(...)` | `delete_file` already composes exactly this; the sweep reuses it for the "ALL versions' bytes" requirement. |
| Periodic background task | Threading / external scheduler | `asyncio.create_task` in lifespan | The `_resume_stranded` precedent; survives `WORKER_COUNT=2` via idempotency. |
| Panel file reconciliation | New SSE channel + store slice | Existing `workspace_file_written` event + `setWorkspaceFileForThread` (keyed by `path`) | The panel already upserts on this event (StreamsProvider 2136). Reuse (D discretion). |

**Key insight:** This phase is ~90% composition. The only genuinely new code is the upload route body and the four-character SQL filter clause; everything else is wiring an existing precedent into a new column. Resist the urge to build parallel machinery.

## Runtime State Inventory

> This is an ADDITIVE-MIGRATION + new-feature phase, not a rename/refactor. The CONTEXT explicitly states existing rows must stay valid with zero behavioral change. The relevant "state" check is: does anything store/cache a shape that the two new nullable columns would break?

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workspace_files` existing rows (agent-written, no `kind`/`expires_at`). New columns are **nullable, no default** → existing rows get NULL for both → the gated filter (`expires_at IS NULL` passes) makes them byte-identical. | None beyond the migration. NULL-default keeps all reads no-op (D-06/D-11). Verified: `write_file`/`upsert_workspace_file` INSERT an explicit column list — adding two nullable columns the old INSERT omits is safe (they default NULL). |
| Live service config | None. No external service stores the workspace schema. The Supabase Storage `workspace-files` bucket already exists (`workspace_service.BUCKET_NAME`). | None — bucket exists; the migration touches only the `workspace_files` table. |
| OS-registered state | None. The sweep is an in-process asyncio task (D-07), not a Task Scheduler / cron / systemd entry. pg_cron is explicitly rejected. | None. |
| Secrets / env vars | TTL lives in `app_settings` (DB), not env (D-05). No new secret. (Optional: the planner MAY add a `harness`-style env-overridable `config.py` field, but D-05 says DB.) | None required. |
| Build artifacts | `full-schema.sql` is the bootstrap deploy artifact — it MUST be regenerated after applying migration 068 (`bash scripts/regenerate-full-schema.sh`, no reset) and committed. The asyncpg pool / supabase-py read columns dynamically (SELECT lists), so no client codegen. | Regenerate + commit `full-schema.sql`. Frontend `WorkspaceFile` type adds optional fields (no codegen). |

**The canonical question — after the migration, what reads the old shape and breaks?** Nothing: both data layers use explicit SELECT column lists (adding columns to the SELECT is opt-in), the new columns are nullable, and the gated filter treats NULL as "never expires". Verified by reading `db/workspace.py` (all queries name columns explicitly) and `workspace.py` (supabase-py `.select("...")` strings).

## Common Pitfalls

### Pitfall 1: The two-data-layer split (supabase-py vs asyncpg)
**What goes wrong:** Apply the expiry filter only to `workspace.py` (supabase-py) and the agent tools (asyncpg `_handle_workspace_read`/`_list`) keep returning expired templates → an agent can still read an expired template → SC#3 fails for the exact consumer (the workflow run) that matters most.
**Why it happens:** The two layers look interchangeable but share no query code. `workspace.py` uses `supabase.table(...).select(...)`; the tools call `workspace_service` → `db/workspace.py` raw asyncpg SQL. A filter added to one is invisible to the other.
**How to avoid:** Treat "read path" as SIX seams, not four: the 4 GET routes (supabase-py) AND `get_file_by_path`/`list_files_in_thread` (asyncpg, used by the tools). Add the gated clause to all six. The Validation Architecture below maps a test to each.
**Warning signs:** A test that uploads a short-TTL template, waits past expiry, and reads via the **agent tool** (not the REST route) still gets content.

### Pitfall 2: Signed-URL content route bypass
**What goes wrong:** `GET /files/{id}/content` for a bucket-stored (large) template mints a 60s signed Storage URL. If the expiry filter isn't on that route's SELECT, an expired large template stays downloadable.
**Why it happens:** The content route is a separate handler (`workspace.py:124`) from the list route; easy to filter the list and forget the content read.
**How to avoid:** Add the expiry clause to the content route's `.select(...).eq("id", file_id)` query (it already reads the row before signing — `workspace.py:138`). Cover it with UAT row 3.
**Warning signs:** An expired template's `/content` endpoint returns a `signed_url`.

### Pitfall 3: Sweep deletes the row but orphans Storage bytes
**What goes wrong:** The DELETE drops the `workspace_files` row (and CASCADE the versions), but the Storage objects (one per version, at `{user}/{tid}/{file_id}/v{n}`) linger forever → unbounded Storage growth (the explicit G-6 failure mode).
**Why it happens:** Postgres CASCADE does not reach the Storage API. pg_cron literally cannot (the reason D-07 rejected it).
**How to avoid:** In `sweep_expired`, collect ALL version Storage paths BEFORE deleting the row (`get_storage_paths_for_file` UNIONs file + version paths — reuse it), then `storage.remove([all paths])`. Order matters: gather paths → delete row → remove bytes (so a crash mid-sweep leaves bytes, which the NEXT sweep won't re-find because the row is gone — so make removal best-effort + log, OR remove bytes first then delete row; either is acceptable, document the choice).
**Warning signs:** Storage bucket object count grows monotonically across sweeps.

### Pitfall 4: Run-pin sized to a per-phase cap, not the whole run
**What goes wrong:** Pin `expires_at` to `now + 3600s` (one phase), but a 5-phase workflow runs 4+ hours → template expires mid-run → run dies (the G-6 "pin failed" mode).
**Why it happens:** `harness_phase_wall_clock_seconds` (3600) reads like a run cap but is **per-phase** (`harness_engine.py:117`, `config.py:910`).
**How to avoid:** Size the pin to `Σ phases × per-phase cap + margin` (conservative: `len(phases) × 3600 + margin`). Use `GREATEST` so the pin only extends, never shortens.
**Warning signs:** A multi-phase workflow near template expiry fails partway with a "template expired" tool error (UAT row 5 catches this).

### Pitfall 5: Migration column default breaks the no-op invariant
**What goes wrong:** Give `kind` a `DEFAULT 'agent'` and `expires_at` a non-NULL default → existing rows or new agent-written rows acquire an expiry → agent files start disappearing (D-11 violated).
**Why it happens:** Over-defaulting "to be safe".
**How to avoid:** Both columns nullable, NO default (or `kind` default NULL). Only the upload endpoint sets `kind='template_input'` + `expires_at=now+ttl`. Agent writes via `write_file` leave both NULL. The gated filter (`expires_at IS NULL` passes) keeps NULL-expiry rows permanent.
**Warning signs:** Agent-written workspace files acquire an `expires_at` or vanish (UAT row 7 regression catches this).

### Pitfall 6: `kind` CHECK constraint rejects existing-row backfill / future kinds
**What goes wrong:** `CHECK (kind IN ('template_input'))` with existing NULL rows — fine if NULL is allowed; but a `CHECK (kind IN (...))` that forgets NULL, or that's too tight for Phase 101's future kinds, blocks the migration or future work.
**How to avoid:** If using a CHECK, allow NULL explicitly: `CHECK (kind IS NULL OR kind IN ('template_input', 'agent'))` — or skip the CHECK entirely (text column, application-enforced) for forward flexibility. CONTEXT lists this as discretion. Lean: nullable text, optional permissive CHECK that includes NULL.

## Code Examples

### Migration 068 (additive, `067`-style header + apply/regenerate footer)
```sql
-- Source pattern: supabase/migrations/067_skill_snapshots_sibling_column.sql (verified)
-- 068_workspace_template_ephemeral.sql
-- Phase 100 TMPL-01: ephemeral template upload. Adds two NULLABLE columns to
-- workspace_files so existing (agent-written) rows are byte-identical (NULL kind,
-- NULL expires_at → the gated read filter `expires_at IS NULL` always passes).
-- Apply via the Supabase SQL editor (never db push/reset), then
-- `bash scripts/regenerate-full-schema.sh` (no reset) and commit both files.

ALTER TABLE public.workspace_files
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Permissive forward-compatible CHECK (NULL allowed; 101 may add kinds).
ALTER TABLE public.workspace_files
  DROP CONSTRAINT IF EXISTS workspace_files_kind_check;
ALTER TABLE public.workspace_files
  ADD CONSTRAINT workspace_files_kind_check
  CHECK (kind IS NULL OR kind IN ('template_input', 'agent'));

-- Partial index: the sweep + the pin query only ever touch non-NULL expiry rows.
CREATE INDEX IF NOT EXISTS idx_workspace_files_expires_at
  ON public.workspace_files (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.workspace_files.kind IS
  'Phase 100 TMPL-01. NULL/''agent'' = agent-written (permanent, byte-identical to '
  'pre-100). ''template_input'' = user-uploaded ephemeral template (TTL-bound).';
COMMENT ON COLUMN public.workspace_files.expires_at IS
  'Phase 100 TMPL-01. NULL = never expires (agent files). Non-NULL = read-path '
  'filter excludes the row once now() passes it (D-06); the lifespan sweep GCs row '
  '+ Storage bytes (D-07); kickoff run-pin extends it to cover the run (D-09).';
```
*(RLS: no new policy needed — the existing `workspace_files_*_own` policies via the `threads.user_id` join already cover the new columns, since RLS is row-level not column-level. Verified in `full-schema.sql:2425-2457`.)*

### app_settings TTL read (D-05)
```python
# Source: backend/app/models/user_settings.py:498 (load_app_settings) — verified.
# Two paths exist: load_app_settings() (sync, cache) and load_app_settings_async()
# (async, refreshes cache). The upload handler is async → either works; the cache
# is warm in steady state. Add a field to the UserEffectiveSettings builder
# (_build_settings_from_row) reading the new app_settings column, OR read app_settings
# directly via supabase in the handler. Lean: add to the settings builder so it's
# cached like every other knob.
ttl_hours = load_app_settings().template_ttl_hours  # default 24 (D-05)
# Migration also adds the column: ALTER TABLE app_settings ADD COLUMN
#   template_ttl_hours integer DEFAULT 24;  (single-row 'global' table)
```

### Frontend upload client (copy `uploadDocument`)
```typescript
// Source: frontend/src/lib/api.ts:1161 (uploadDocument) — verified pattern.
export async function uploadWorkspaceTemplate(
  threadId: string,
  file: File,
): Promise<WorkspaceFile> {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_BASE}/threads/${threadId}/workspace/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },  // NO Content-Type — browser sets multipart boundary
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error((err as { detail: string }).detail ?? "Upload failed")
  }
  return (await res.json()) as WorkspaceFile
}
```

### Panel countdown (no per-second timer — D-02 discretion)
```typescript
// Compute on render from expires_at; coarse format (no live ticking required).
function expiryCaption(expiresAt?: string): string | null {
  if (!expiresAt) return null            // agent file → no badge (D-11)
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return "expired"
  const h = Math.floor(ms / 3_600_000)
  if (h >= 1) return `expires in ${h}h`
  return `expires in ${Math.max(1, Math.floor(ms / 60_000))}m`
}
// Amber tint when close (e.g. < 1h): apply the established needs-attention color (D-02).
// The list already re-renders on the workspace_file_written SSE + on panel refetch;
// an optional coarse 60s interval refreshes the caption without per-second churn.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Workspace is GET-only (agent writes via tools; users only read in the panel) | First user-facing workspace WRITE endpoint | This phase | Net-new but additive; no existing read/write path changes shape. |
| MIME/extension trust for uploads (`documents.py` normalizes MIME by ext) | Magic-byte (`zipfile.is_zipfile`) validation for templates (D-12) | This phase | Stronger — closes renamed-binary injection at the door. `skills.py` already does this for ZIP imports. |
| `expires_at` absent from `workspace_files` | TTL + gated read filter + in-process sweep | This phase | Ephemerality is enforced by the filter (instant), not the sweep (eventual GC). |

**Deprecated/outdated:** None applicable — this phase introduces a pattern, it doesn't replace one. The 098 `harness.py` co-lock comment that assigns "assets behavior" to Phase 100 is now stale and should be repointed to Phase 101 (D-13, comment-only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mimetypes.guess_type` maps `.docx`/`.pptx`/`.xlsx` to their OOXML MIME types on the deploy platform (used for the stored `mime_type`, NOT for validation). | Pattern 2 | LOW — validation is byte-based regardless; a wrong stored MIME only affects the panel icon, not security. The `_BINARY_MIME_PREFIXES` list in `workspace_service.py:42` does NOT include the OOXML MIME, so templates would be treated as text on agent read — the planner should add the OOXML MIME prefix to that list OR the template read returns garbage decode. **Flag for the planner to verify the binary-read path for OOXML.** |
| A2 | Run wall-clock cap = `Σ phases × harness_phase_wall_clock_seconds (3600)`. There is no single whole-run cap setting in `harness_engine`/`config`. | Pattern 5 / Pitfall 4 | MEDIUM — if a whole-run cap DOES exist elsewhere, the pin could be sized to it directly. Verified absence by grepping `harness_engine.py` (only per-phase `_DEFAULT_PHASE_WALL_CLOCK`) but did not read the full engine loop. Planner should confirm no run-level deadline before finalizing the pin formula; the conservative `len(phases) × 3600 + margin` is safe regardless. |
| A3 | The Supabase Storage `workspace-files` bucket already exists in the live env (used by `write_file` today). | Janitor / Pattern 4 | LOW — the bucket is referenced by shipped code (`BUCKET_NAME = "workspace-files"`); large agent files already round-trip through it. |
| A4 | A `get_supabase_admin()` (service-role) client exists for the sweep (the lifespan task has no per-user auth context). | Pattern 4 | MEDIUM — the sweep runs outside any request, so it can't use the request-scoped `get_supabase` (which carries the user JWT). It needs a service-role client to delete across all users' rows + Storage. The harness resume sweep precedent (`get_pg_pool`) uses the raw pool (no RLS) for DB; for Storage it needs an admin supabase client. **Planner must confirm/locate the service-role Storage client** (or the sweep deletes rows via pool but can't reach Storage → orphans bytes). This is the single highest-risk unknown. |

## Open Questions

1. **Service-role client for the sweep (A4 — HIGH priority)**
   - What we know: the sweep runs in the lifespan with no user JWT; DB deletes can use the raw asyncpg pool (no RLS), but Storage deletion needs a supabase client with the Storage API.
   - What's unclear: whether a service-role/admin supabase client is already instantiated somewhere (e.g. `get_supabase_admin`, a module-level `SUPABASE_SERVICE_KEY` client) that the sweep can use to reach `storage.from_("workspace-files").remove(...)`.
   - Recommendation: Planner greps for a service-role client during planning (`SUPABASE_SERVICE_ROLE_KEY` / `service_role` / an admin client factory). If none exists, the migration/plan must add one OR accept that the sweep deletes rows and a SEPARATE mechanism handles bytes (less clean — prefer finding/adding the admin client).

2. **OOXML binary-read path (A1)**
   - What we know: `workspace_service.read_file` returns a "binary, content via REST" stub for MIME prefixes in `_BINARY_MIME_PREFIXES` (image/audio/video/pdf/zip/octet-stream). The OOXML MIME (`application/vnd.openxmlformats-...`) is NOT in that list → an agent `workspace_read` of a template would try to UTF-8-decode the ZIP bytes → garbage.
   - What's unclear: whether Phase 101's fill step reads template bytes via the tool (which would hit this) or directly via the service/Storage. CONTEXT says 101 owns the fill; this phase only delivers upload + the `kind` seam.
   - Recommendation: This phase should ADD the OOXML MIME prefix to `_BINARY_MIME_PREFIXES` so a `workspace_read` of a template returns the clean binary stub (not garbage) — a small additive change that keeps the read honest. Document it as in-scope hygiene; the actual byte-fetch for filling is Phase 101.

3. **SSE emit context for upload (discretion)**
   - What we know: the agent-write path emits `workspace_file_written` from inside the run (it has `ctx.redis`, `ctx.run_id`). The upload is a plain REST handler with no run context.
   - What's unclear: whether emitting the SSE from a request handler (no `run_id`) reconciles the panel correctly, or whether the panel should just refetch on upload-success (the frontend already calls `reconcile()` patterns).
   - Recommendation: Lean simplest — on a 200 upload, the frontend calls `useWorkspaceFiles(...).reconcile()` (the panel already has this) OR optimistically upserts the returned `WorkspaceFile`. SSE reuse is optional; a request-driven refetch is the lower-risk path since there's no run to attach the event to.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| FastAPI `UploadFile` / `python-multipart` | Upload endpoint | ✓ | in-repo (used by documents/skills uploads) | — |
| Python `zipfile` (stdlib) | OOXML validation | ✓ | stdlib | — |
| Supabase Storage `workspace-files` bucket | Hybrid persistence + sweep byte deletion | ✓ | exists (shipped) | — |
| asyncpg pool | Service/tool data path | ✓ | in-repo | — |
| supabase-py + service-role client | API reads + sweep Storage deletion | ⚠ partial | request-scoped client ✓; **service-role client for the sweep = UNCONFIRMED (Open Q1)** | Sweep DB-only via pool; bytes need admin client |
| Redis | (Optional) sweep advisory lock | ✓ | in-repo | Not required — D-07 idempotency suffices |

**Missing dependencies with no fallback:** None hard-blocking. The service-role Storage client (Open Q1) is the one gap to confirm; without it the sweep can delete rows but not Storage bytes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Backend: `pytest` (+ `pytest-asyncio`) under `backend/`; Frontend: `vitest` under `frontend/` |
| Config file | Backend: `backend/pytest.ini` / `pyproject.toml`; Frontend: `frontend/vitest.config.ts` |
| Quick run command | Backend: `cd backend && venv/Scripts/python -m pytest tests/ -x -k workspace_template`; Frontend: `cd frontend && npm run test -- FilesSection` |
| Full suite command | Backend: `cd backend && venv/Scripts/python -m pytest tests/`; Frontend: `cd frontend && npm run test` |

*Note (from MEMORY): the frontend vitest suite and the Playwright E2E suite have known pre-existing rot — prove net-new green by comparing against a baseline checkout, not raw counts (SEED-056 / project_e2e_suite_rotted). The 4-axis SC#10 scoreboard does NOT apply (no provider-bearing run in upload plumbing — confirmed NOT SC#10-flagged in ROADMAP/CONTEXT).*

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC#1 (RLS) | Upload sets `kind='template_input'` + `expires_at`; row scoped to owner | integration | `pytest tests/test_workspace_template.py::test_upload_sets_kind_and_ttl -x` | ❌ Wave 0 |
| SC#1 (RLS) | A second user cannot list/download another's template (RLS) | integration | `pytest tests/test_workspace_template.py::test_cross_user_isolation -x` | ❌ Wave 0 |
| D-12 | `.exe`-renamed-`.docx` / PDF rejected (422), nothing persisted | unit | `pytest tests/test_workspace_template.py::test_bad_file_rejected -x` | ❌ Wave 0 |
| D-12 | Real docx/pptx/xlsx accepted (`zipfile.is_zipfile` + marker) | unit | `pytest tests/test_workspace_template.py::test_valid_ooxml_accepted -x` | ❌ Wave 0 |
| SC#3 / D-06 | Expired template excluded from REST list + content (signed-URL bypass closed) | integration | `pytest tests/test_workspace_template.py::test_expired_excluded_rest -x` | ❌ Wave 0 |
| SC#3 / D-06 | Expired template excluded from `_handle_workspace_read`/`_list` (asyncpg path) → "template expired" (D-10) | integration | `pytest tests/test_workspace_template.py::test_expired_tool_read_errors -x` | ❌ Wave 0 |
| D-11 | NULL-expiry agent files list/read/diff byte-identical (gated no-op) | integration | `pytest tests/test_workspace_template.py::test_agent_files_unchanged -x` | ❌ Wave 0 |
| D-07 | Sweep deletes expired rows AND ALL version Storage bytes; idempotent (double-run safe) | integration | `pytest tests/test_workspace_template.py::test_sweep_deletes_rows_and_bytes -x` | ❌ Wave 0 |
| D-09 | Run-pin extends `expires_at` to cover run cap; `GREATEST` never shortens; no-op when no template | integration | `pytest tests/test_workspace_template.py::test_run_pin_extends_and_noop -x` | ❌ Wave 0 |
| SC#2 | Structural isolation: assert no ingestion/embedding/retrieval module imports/queries `workspace_files` | unit (guard) | `pytest tests/test_workspace_template.py::test_workspace_files_not_in_ingestion -x` | ❌ Wave 0 |
| migration | Existing rows valid post-068 (NULL kind/expires_at, CHECK allows NULL) | migration smoke | manual SQL-editor apply + `pytest tests/test_workspace_template.py::test_existing_rows_valid -x` | ❌ Wave 0 |
| D-02 (UI) | Template card renders badge + countdown; amber near expiry; per-ext icon | unit (vitest) | `npm run test -- FilesSection` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_workspace_template.py -x` (backend) / `npm run test -- FilesSection` (frontend).
- **Per wave merge:** full backend `pytest tests/` + frontend `npm run test` (against baseline for rot subtraction).
- **Phase gate:** full suite green + all 7 G-4 lived-experience UAT rows manually PASS before `/gsd:verify-work`.

### G-4 Lived-Experience UAT Rows (MANDATORY — all 7, authored in VALIDATION.md, Chrome-MCP / operator-driven)
1. **Upload→visible→readable:** upload a real docx in the panel → card appears with Template badge + countdown → a workflow/agent reads it in-thread (via `workspace_list` then the Phase-101 fill, or a manual `workspace_read` returning the binary stub).
2. **Never-in-search proof:** put distinctive text inside the uploaded template → search the KB (agent `search_documents` + UI search) for that text → it MUST never appear (structural isolation — SC#2).
3. **Expiry end-to-end:** short-TTL upload → file disappears from the panel at expiry → agent read fails with "template expired" (D-10) → after a sweep, the DB row AND ALL Storage version bytes are physically gone (verify via psycopg2 on local :54322 + Storage object check).
4. **Bad-file rejection:** `.exe` renamed `.docx` (and a real PDF) → clean visible 422 rejection, nothing persisted (verify no `workspace_files` row).
5. **Run-straddles-expiry:** upload near expiry → start a multi-phase workflow → run-pin (D-09) extends `expires_at` → run completes successfully without a mid-flight "template expired".
6. **Cross-user isolation:** a second user cannot list or download the template (RLS half of SC#1; `/gsd:secure-phase` reuses this row).
7. **No-template regression (D-11 invariant):** agent-written workspace files (`expires_at NULL`) list/read/diff exactly as today, AND a workflow with no template runs byte-identically — proven live (the RED LINE).

### Wave 0 Gaps
- [ ] `backend/tests/test_workspace_template.py` — covers SC#1/SC#2/SC#3, D-06/07/09/10/11, D-12, migration smoke (the table above).
- [ ] `backend/tests/conftest.py` fixtures — a thread + owner user, a second user, a real minimal docx/pptx/xlsx byte fixture (build with `python-docx`/`openpyxl`/`python-pptx` — already in the sandbox image; for tests, generate tiny valid OOXML bytes or commit small fixtures), a renamed-binary fixture.
- [ ] `frontend/src/components/panel/__tests__/FilesSection.test.tsx` — badge/countdown/amber/per-ext-icon render (extend if it exists; create if not).
- [ ] Framework install: none — `pytest`/`vitest` already present.
- [ ] Service-role Storage client for the sweep test — confirm or add (Open Q1) before the D-07 test can assert byte deletion.

## Security Domain

> `security_enforcement` is enabled (no explicit `false` in config). `/gsd:secure-phase` will run; UAT row 6 (cross-user isolation) is the operator-pre-seeded reuse.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Structural KB isolation (SC#2) — `workspace_files` disjoint from ingestion/search by construction (verified). |
| V4 Access Control | yes | RLS on `workspace_files` via `threads.user_id` join (existing policies cover new columns); `_verify_thread_ownership` 404-not-403 (existence-leak prevention) on the upload route. |
| V5 Input Validation | yes | `zipfile.is_zipfile` + OOXML marker (D-12) — rejects renamed binaries/PDFs; 10 MB size CHECK + pre-write guard; path validation via `validate_path` (the upload generates the path, so traversal is N/A but the regex still applies). |
| V11 Business Logic | yes | TTL + read-path expiry gate (the "ephemeral" guarantee); run-pin GREATEST-only (never shortens); idempotent sweep. |
| V12 File Resources | yes | Uploaded bytes never executed; stored as opaque `bytea`/Storage object; never ingested/embedded (the injection-via-uploaded-doc vector this phase closes per TMPL-01). |
| V6 Cryptography | no | No crypto introduced. |
| V2 Authentication / V3 Session | no (inherited) | Reuses the existing `get_current_user` Bearer-token auth; no new auth surface. |

### Known Threat Patterns for {FastAPI multipart + Supabase Storage + agent-readable workspace}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renamed-binary / polyglot upload (`.exe` → `.docx`) | Spoofing / Tampering | `zipfile.is_zipfile` + `[Content_Types].xml` + per-ext OOXML marker (D-12). |
| Injection-via-uploaded-doc into the KB | Tampering (RAG poisoning) | Structural isolation — upload writes ONLY to `workspace_files`; ingestion/embedding/search never read it (verified, SC#2). The whole point of TMPL-01. |
| Cross-user template read/download | Information Disclosure | RLS (FK-chain policy) + `_verify_thread_ownership`; UAT row 6 + `/gsd:secure-phase`. |
| Expired-template read after TTL (any path) | Information Disclosure | Read-path filter on ALL SIX seams (4 REST + 2 asyncpg tool reads), gated on `expires_at IS NOT NULL`; closes the signed-URL content bypass too. |
| Unbounded Storage growth (sweep failure) | Denial of Service | Idempotent lifespan sweep deletes rows + ALL version bytes; partial index for cheap sweep query. |
| Oversized upload (memory exhaustion via `file.read()`) | Denial of Service | 10 MB guard (mirrors the table CHECK) checked right after `read()`; same pattern as `documents.py`/`skills.py`. |
| SSTI / template-engine abuse | Tampering / RCE | OUT OF SCOPE this phase — rendering/fill is Phase 101 (TMPL-03 owns `jinja2.sandbox.SandboxedEnvironment`). This phase only stores opaque bytes; it never parses/renders them. |

## Sources

### Primary (HIGH confidence — read in this session)
- `backend/app/api/workspace.py` — GET-only routes, `_verify_thread_ownership`, signed-URL content path, supabase-py/RLS layer.
- `backend/app/services/workspace_service.py` — `write_file` (hybrid inline/Storage, versioning), `delete_file` (Storage cleanup), `_BINARY_MIME_PREFIXES`, asyncpg layer.
- `backend/app/db/workspace.py` — `upsert_workspace_file`, `get_file_by_path`, `list_files_in_thread`, `get_storage_paths_for_file` (file+version UNION).
- `backend/app/services/tool_dispatcher.py` — `_handle_workspace_read` (~1049), `_handle_workspace_list` (~1085), `_handle_workspace_write` (SSE emit), `_handle_search_documents` (~173).
- `backend/app/api/documents.py:339` + `backend/app/api/skills.py:150,162,168,416` — `UploadFile` multipart + `zipfile.is_zipfile`/`namelist` validation precedents.
- `backend/app/main.py:205-251` — lifespan, `_resume_stranded` sweep precedent (the D-07 model).
- `backend/app/api/threads.py:787-847,920-1124` — `_ensure_skill_snapshots` thin seam (D-09 run-pin model), kickoff block, `create_workflow_run`.
- `backend/app/models/harness.py:75-169` — `wall_clock_seconds` (per-phase), `LlmAgentPhaseConfig`, `InputFieldSpec`/`AssetRef`, 098 co-lock comment.
- `backend/app/services/harness_engine.py:110-123` + `backend/app/config.py:880-910` — `_DEFAULT_PHASE_WALL_CLOCK = harness_phase_wall_clock_seconds = 3600` (per-phase).
- `backend/app/models/user_settings.py:498-528` — `load_app_settings` / `load_app_settings_async` (the D-05 read pattern).
- `backend/app/services/retrieval_service.py:25-79` — search reads ONLY `match_document_chunks`/`keyword_search_chunks` RPCs (SC#2 isolation link).
- `supabase/full-schema.sql:256-312` (app_settings), `:827-859` (workspace tables), `:2425-2477` (RLS policies) — current schema.
- `supabase/migrations/067_skill_snapshots_sibling_column.sql` — additive-migration shape + apply/regenerate footer.
- `frontend/src/components/panel/FilesSection.tsx`, `WorkspacePanel.tsx`, `providers/StreamsProvider.tsx:2136-2167,2576-2593`, `lib/api.ts:884,1161`, `types/index.ts:307` — panel + SSE reconcile + upload-client + type.
- Grep verification: `workspace_files` referenced by exactly 4 source files (workspace api/db/tool_dispatcher/service); zero references in ingestion/embedding/retrieval — the SC#2 structural proof.

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01..D-14 (locked decisions, copied verbatim above), REQUIREMENTS.md TMPL-01, ROADMAP Phase 100 SC#1-3, `.planning/config.json` (nyquist_validation true, no SC#10 flag).

### Tertiary (LOW confidence)
- None — every claim is grounded in an in-repo read or a CONTEXT decision. The two MEDIUM-risk items (run-cap formula A2, service-role sweep client A4) are flagged in the Assumptions Log / Open Questions for the planner to confirm.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every building block read in-repo and already exercised.
- Architecture: HIGH — the two-data-layer split, the six read seams, the isolation proof, and every precedent (067 migration, skills.py validation, main.py sweep, threads.py pin) verified by direct read.
- Pitfalls: HIGH — derived from the actual code (asyncpg/supabase-py split, per-phase vs run cap, signed-URL content route, CASCADE-doesn't-reach-Storage).
- Open risks: MEDIUM on two items (run-cap formula A2, service-role Storage client for the sweep A4) — both flagged with safe fallbacks.

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable — internal codebase patterns, no fast-moving external deps; revalidate only if `workspace_files` / harness kickoff / settings loader change before planning).
