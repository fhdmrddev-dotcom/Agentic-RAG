# Phase 285: Watch and Re-upload Close Out - Pattern Map

**Mapped:** 2026-10-16 (develop at `77f91ee5e`; latest migration on disk re-checked: `208_library_page_index.sql`, so **209 is free**)
**Files analyzed:** 22 (8 source/script/migration, 1 frontend comment, 7 new test files, 6 amended test files)
**Analogs found:** 22 / 22. Most "analogs" are the file itself: this is a repair phase, so the main rule is to extend the existing shape in place.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/209_<name>.sql` (NEW) | migration | batch (DDL + one-shot backfill + data heal) | `203_workspace_files_library_link.sql` (ADD COLUMN + COMMENT), `208_library_page_index.sql` (VERIFY block), `105_personal_org_backfill.sql:136-138` (GET DIAGNOSTICS / RAISE NOTICE) | exact (composite) |
| `scripts/apply_migration_209.py` (NEW) | utility script | batch | `scripts/apply_migration_208.py` | exact |
| `backend/app/services/watch_service.py` (MOD) | service | event-driven (poll loop) | itself: new-file branch `:325-400`, error arm `:486-523`, release `:579-590` | self |
| `backend/app/db/watches.py` (MOD + new `watch_purge_scope`) | model / db | CRUD | itself: `upsert_watch_item :593-646`, `release_watch :259-379`, `get_watch_items :556-571` | self |
| `backend/app/services/document_purge.py` (MOD) | service | file-I/O | itself `:79-92` | self |
| `backend/app/api/sources.py` (MOD, both doors) | controller | request-response | itself `:331-341`, `:457-494` | self |
| `backend/app/models/source.py` (MOD) | model | request-response | `WatchPurgeResponse :110-113`; additive-default precedent `WatchSyncResponse :97-107` | self |
| `backend/app/api/documents.py` (MOD, enqueue arm) | controller | request-response | the storage-fail arm in the same function, `:638-671` | exact |
| `frontend/src/components/sources/RunHistoryList.tsx` (comment only) | component | — | itself `:167-174` | self |
| `frontend/src/components/sources/RunHistoryList.test.tsx` (comment + optional case) | test | — | itself `:348-365` | self |
| `backend/tests/unit/services/test_285_watch_retry.py` (NEW) | test | event-driven | `tests/unit/services/test_watch_service.py:13-110, 317-396` | exact |
| `backend/tests/unit/test_285_purge_scope.py` (NEW) | test | file-I/O | `tests/unit/test_280_purge_bytes.py` + fakes from `test_275_delete_paths.py:91-110, 434-562` | exact |
| `backend/tests/unit/test_285_upload_enqueue_failure.py` (NEW) | test | request-response | `tests/unit/test_280_minter_sequence.py:546-579` | exact |
| `backend/tests/unit/test_285_migration_209_shape.py` (NEW) | test | text shape | `tests/unit/test_275_migration_204_shape.py:26-80` | exact |
| `backend/tests/integration/test_285_purge_scope_live.py` (NEW) | integration test | file-I/O, live | `tests/integration/test_280_purge_bytes_live.py` | exact |
| `backend/tests/integration/test_285_stuck_pending_live.py` (NEW) | integration test | request-response, live | `tests/integration/test_280_same_bytes_live.py:1-160` + `test_280_purge_bytes_live.py:180-191` (direct route-coroutine call) | role-match |
| `tests/unit/db/test_watches_db.py` (AMEND: `$7` / `run_error` case) | test | CRUD | itself `:266-304` | self |
| `tests/integration/test_280_purge_bytes_live.py` (AMEND: `minted=true` seed) | test | live | itself `:98-114` | self |
| `tests/unit/test_275_delete_paths.py` (AMEND: scope helper patch) | test | stub | itself `:434-481` | self |
| `tests/unit/test_280_purge_bytes.py` (AMEND: comment at `:174`, new BUG-05 case) | test | stub | itself | self |
| `tests/integration/test_275_disposition.py` (AMEND: `_Bucket.remove` returns names) | test | stub | `test_275_delete_paths.py:100-104` | exact |
| `tests/unit/test_280_minter_sequence.py:592-624` | fence | — | DO NOT EDIT. The retry must keep `watch_service.py` at 2 minter calls | — |

---

## Pattern Assignments

### `supabase/migrations/209_<name>.sql` (migration, batch)

**Analog A: column add + comment**, `supabase/migrations/203_workspace_files_library_link.sql:23-44, 52-55`.

The header states the RLS and grant position explicitly. Copy this sentence shape for D-19:
```sql
-- No backfill (schema only ...). No GRANT, no anon, no RLS
-- change: workspace_files keeps RLS and its *_own policies, and table-level grants already cover
-- new columns (workspace_files has no column-level grants).
...
BEGIN;
ALTER TABLE public.workspace_files
    ADD COLUMN IF NOT EXISTS library_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS library_link text;
ALTER TABLE public.workspace_files DROP CONSTRAINT IF EXISTS workspace_files_library_link_check;
ALTER TABLE public.workspace_files
    ADD CONSTRAINT workspace_files_library_link_check
    CHECK (library_link IS NULL OR library_link IN ('saved', 'already'));
COMMENT ON COLUMN public.workspace_files.library_document_id IS
    'Phase 274 (ATT-03 / D-28). ...';
COMMIT;
```
For the `failed_attempts >= 0` CHECK, either use 203's idempotent `DROP CONSTRAINT IF EXISTS` then `ADD`, or RESEARCH §5's `IF NOT EXISTS (SELECT 1 FROM pg_constraint …)` inside the DO block. Both are re-runnable.

**Analog B: the row-count notice idiom**, `105_personal_org_backfill.sql:136-138`:
```sql
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE '_mig105_backfill batch % -> % rows', v_iter, v_rows;
```
⛔ Do **not** copy 105's `CREATE PROCEDURE`. D-19 prefers no function, so use plain `DO $$ … $$` blocks as in RESEARCH §5. The full DO-block body (one-shot `v_fresh` guard, the tightened backfill predicate, the enqueue-then-fail heal) is already written out at RESEARCH §5 lines 334-411. Use it verbatim as the starting text.

**Analog C: the tail and the VERIFY block**, `208_library_page_index.sql:275-292`. `apply_migration_208.py::_verify_sql` parses this exact layout: a `-- VERIFY` line, then `--   ` indented lines, then `with checks(what, ok) as (values …) select case when ok then 'PASS' else 'FAIL' end as status, what from checks;`.
```sql
COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================================
-- VERIFY — run after applying. Every row must read PASS.
--
--   with checks(what, ok) as (values
--     ('...', <boolean expr>),
--     ...
--   ) select case when ok then 'PASS' else 'FAIL' end as status, what from checks;
```
- The SQL-parse rule in `_verify_sql` (`apply_migration_208.py:120-143`): body lines must start with `--   ` (two dashes plus three spaces). An optional prelude may only be `SET …;`.
- The column list must be named `status, what`. `_verify` reads `r["status"], r["what"]`.

---

### `scripts/apply_migration_209.py` (utility, batch)

**Analog:** `scripts/apply_migration_208.py`. Copy the skeleton. Drop the view, policy and parity modes, which are 208-specific.

**Header and imports** (`:36-70`):
```python
WHY A SCRIPT AND NOT THE SQL EDITOR: this plan runs as a worktree executor with no browser ...
⚠ THE MIGRATION OWNS ITS OWN TRANSACTION (``BEGIN;`` / ``COMMIT;``) ... Do NOT strip them for --apply
⛔ THE DSN IS HARD-CODED TO 127.0.0.1 AND NO ENVIRONMENT VARIABLE IS READ.
⛔ NEVER ``supabase db push`` / ``db reset``
⛔ Run under the local-DB lock (``C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-localdb.lock``).
...
import argparse, asyncio, re, sys
from pathlib import Path
from urllib.parse import urlparse
import asyncpg

DSN = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION = (Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "209_<name>.sql")
```

**Reuse these functions as they are:** `_refuse_non_local` (`:111-115`, single DSN), `_verify_sql` (`:120-143`), `_body_without_txn` (`:160-164`), `_verify` (`:167-171`), `_print_verify` (`:174-180`), and `main` (`:536-571`, keeping only `--apply`, `--dry-run` and `--verify-only`).

**`mode_apply` shape to adapt** (`:232-281`): take before-counts, apply, VERIFY, apply AGAIN, VERIFY, then compare.
```python
await conn.execute(sql)
first = await _verify(conn, v)
ok1 = _print_verify("AFTER FIRST APPLY", first)
await conn.execute(sql)
second = await _verify(conn, v)
ok2 = _print_verify("AFTER SECOND APPLY (idempotency check)", second)
...
if first != second: failures.append("the SECOND apply changed the result — 209 is not re-runnable")
```
For 209, replace the fingerprints with these before/after checks:
- `count(*) FROM documents` must be unchanged;
- `count(*) FILTER (WHERE minted)` must be identical after the second apply, which proves the one-shot guard works;
- `count(*) FROM ingestion_jobs` may grow on the first apply only;
- print the server's `RAISE NOTICE` lines (`conn.add_log_listener`).

**`mode_dry_run`** (`:286-311`): wrap `_body_without_txn(sql)` in `conn.transaction()` and roll it back.

---

### `backend/app/services/watch_service.py` (service, event-driven)

**Analog:** itself. All excerpts are at HEAD.

**Routing point** (`:320-325`). The D-01 retry is routed into the EXISTING `if existing is None:` body by widening its condition. Do not add a third `async_mint_document_row(` call, because `test_280_minter_sequence.py:592-599` pins `"services/watch_service.py": 2`.
```python
            existing = items_by_ext_id.get(item.id)
            doc_id: UUID | None = None

            try:
                if existing is None:
                    # ── NEW FILE ──
                    filename, file_bytes, mime_type = await adapter.read_file(conn, item.id)
```
⚠ A `failed` item must never reach the `else:` branch (`:402-484`). The rename arm `:464-477` would flip it to `present` with no doc.

**Upsert call shape to extend** (dedup arm `:359-372`, minted arm `:382-393`, modify arm `:449-460`). Add `minted=` (M-1..M-3) and `failed_attempts=0` as kwargs:
```python
                        await upsert_watch_item(
                            self.pool,
                            watch_id=watch_id,
                            external_id=item.id,
                            name=item.name,
                            user_id=UUID(user_id),
                            org_id=UUID(org_id) if org_id else None,
                            path_hint=getattr(item, "drive_id", "") or "",
                            source_version=str(item.modified_at or ""),
                            document_id=doc_id,
                            state="present",
                        )
```

**Error arm to correct** (`:486-523`). Make four changes here:
1. `str(item_err)` becomes the typed form (D-04).
2. `target_doc_id`'s fallback to `existing["document_id"]` must no longer feed the doc-failed write (RESEARCH §6.5). Only a doc this iteration minted is marked failed.
3. Pass `failed_attempts=prior+1`.
4. Keep the one-write-per-item shape. `test_watch_service.py:369` pins `await_count == 2`.
```python
            except Exception as item_err:
                counts["errors"] += 1
                ...
                try:
                    target_doc_id = doc_id or (UUID(str(existing["document_id"])) if (existing and existing.get("document_id")) else None)
                    await upsert_watch_item(..., document_id=target_doc_id, state="failed", last_error=str(item_err))
                    if target_doc_id:
                        await run_in_threadpool(
                            lambda d_id=target_doc_id, err=item_err: supabase.table("documents")
                            .update({"status": "failed", "ingestion_step": "failed",
                                     "error_message": f"Watch sync failed: {err}"[:500]})
                            .eq("id", str(d_id))
                            .execute()
                        )
                except Exception as record_err:
                    logger.error(...)
                continue
```
Note the `mint_res` binding: it is assigned inside the `try` at `:344` / `:422`. Initialise `mint_res = None` beside `doc_id = None` (`:322`) so the arm can test `mint_res is not None and not mint_res.is_duplicate`.

**Happy-path release** (`:579-590`). Add `run_error=<summary>` and keep `error=None`, so `connector_watches.last_error` stays NULL and the WatchRowCard pill is safe:
```python
        await release_watch(
            self.pool, watch_id, status="success", error=None, counts=counts,
            listing_complete=listing.complete, failure_cause=None, started_at=started_at,
            user_id=_opt_uuid(watch.get("user_id")), org_id=_opt_uuid(watch.get("org_id")),
        )
```
⛔ `counts` keeps exactly six keys (`test_watch_service.py:395`). A landed retry counts as `new`, and the D-02 total goes into `counts["errors"]`.

---

### `backend/app/db/watches.py` (db, CRUD)

**Column list** (`:45-49`). Append `failed_attempts, minted`:
```python
_WATCH_ITEM_COLUMNS = (
    "id, org_id, watch_id, user_id, external_id, name, path_hint, source_version, "
    "source_modified_at, content_hash, document_id, state, first_seen_at, last_seen_at, "
    "missing_since, last_error, created_at, updated_at"
)
```

**`upsert_watch_item`** (`:593-646`). Add `failed_attempts: int | None = None, minted: bool | None = None` as `$13` / `$14`. Follow the existing `COALESCE(EXCLUDED.x, connector_watch_items.x)` style, but reference the **parameter**, not `EXCLUDED` (RESEARCH §6.3):
```sql
                document_id = COALESCE(EXCLUDED.document_id, connector_watch_items.document_id),
                state = EXCLUDED.state,
                ...
-- add:   VALUES (..., COALESCE($13::int, 0), COALESCE($14::boolean, false))
--        failed_attempts = COALESCE($13::int, connector_watch_items.failed_attempts),
--        minted          = COALESCE($14::boolean, connector_watch_items.minted),
```

**`release_watch`** (`:259-379`). Add a `run_error: str | None = None` kwarg after `retain`. Change only the `$7` bind at `:368` from `error,` to `run_error if run_error is not None else error,`. The `$3` bind at `:314` (the `connector_watches.last_error` UPDATE) stays `error`. The positional pins at `test_watches_db.py:302-304` (`args[5]`, `args[8]`, `args[9:15]`) must not move.

**New `watch_purge_scope(pool, watch_id, states)`**. The read shape to copy is `get_watch_items` (`:556-571`):
```python
async def get_watch_items(pool: asyncpg.Pool, watch_id: UUID) -> list[dict]:
    """List all tracked items for a given watch."""
    async with pool.acquire() as con:
        rows = await con.fetch(
            f"""
            SELECT {_WATCH_ITEM_COLUMNS}
            FROM connector_watch_items
            WHERE watch_id = $1
            ORDER BY name ASC
            """,
            _as_uuid(watch_id),
        )
        return [dict(r) for r in rows]
```
The SQL body (scope CTE, `bool_or(minted)`, the `shared` EXISTS against items outside the scope) is at RESEARCH §8 lines 488-501. Bind `states` as `$2::text[]` (NULL means all states, for door 1). It returns `(item_ids, purge_doc_ids, kept_doc_ids)`.
- ⚠ This module is asyncpg-only. Its docstring (`:290-293`) treats the absence of the threadpool token as a grep-able guard, so do not import or mention it.

---

### `backend/app/services/document_purge.py` (service, file-I/O)

**Analog:** itself, `:79-92`. Change only the success line. Keep **exactly one** `try` (pinned at `test_280_purge_bytes.py:238-242`), keep the neutral `remove_document_bytes:` log prefix (`:146-149`), and keep the function identity shared with disposition (`:256-260`).
```python
async def remove_document_bytes(storage, paths: list[str], removed: list[str], not_removed: list[str]) -> None:
    if not paths or storage is None:
        return
    try:
        await run_in_threadpool(lambda: storage.storage.from_(STORAGE_BUCKET).remove(paths))
        removed.extend(paths)                      # <- D-10: replace with the confirmed-name split (RESEARCH §9)
    except Exception:
        logger.exception("remove_document_bytes: removing %d stored file(s) after a confirmed row delete failed", len(paths))
        not_removed.extend(paths)
```
`purge_documents` (`:39-76`) is **unchanged**. It already returns `deleted` (the DELETE's rows), which is what D-09's `purged_count = len(deleted)` needs. The module docstring's ORDER and D-31 rules (`:8-14`) stay binding.

---

### `backend/app/api/sources.py` (controller, request-response): both doors

**Door 1** (`:331-341`). Replace the `get_watch_items` list comprehension with `watch_purge_scope(pool, watch_id, None)`. Keep the call through the module attribute: the `purge_documents` query param at `:316` shadows a by-name import.
```python
    if purge_documents:
        items = await get_watch_items(pool, watch_id)
        doc_ids = [str(it["document_id"]) for it in items if it.get("document_id")]
        if doc_ids:
            await document_purge.purge_documents(
                request, current_user, doc_ids, kind="watch_delete",
                supabase=supabase, service_supabase=service_supabase,
            )
```
Door 1 returns **204** (`:309-312`), so it only logs the kept count.

**Door 2** (`:457-494`). Swap the inline `con.fetch` (`:458-467`) for `watch_purge_scope(pool, watch_id, ['missing','unauthorized'])`. Set `purged_count = len(deleted)` (it was `len(doc_ids)` at `:481`), and still delete **all** scope item ids (`:483-488`):
```python
    purged_count = 0
    if doc_ids:
        await document_purge.purge_documents(
            request, current_user, doc_ids, kind="watch_purge",
            supabase=supabase, service_supabase=service_supabase,
        )
        purged_count = len(doc_ids)
    if item_ids:
        async with pool.acquire() as con:
            await con.execute("DELETE FROM connector_watch_items WHERE id = ANY($1::uuid[])", item_ids)
    return WatchPurgeResponse(status="ok", purged_count=purged_count,
                              message=f"Successfully purged {purged_count} missing or disconnected files.")
```
- Import `watch_purge_scope` by name from `app.db.watches`, beside `get_watch_items`.
- The unit fakes patch `sources.get_watch_items` by attribute (`test_275_delete_paths.py:479-481`), so patch `sources.watch_purge_scope` the same way.

---

### `backend/app/models/source.py` (model)

**Analog:** `WatchPurgeResponse` (`:110-113`). Make an additive defaulted field, following the "net-new fields default so every existing caller stays valid" precedent at `WatchSyncResponse :94-107`:
```python
class WatchPurgeResponse(BaseModel):
    status: str
    purged_count: int
    message: str
    # add: kept_count: int = 0   (D-09)
```
`WatchItemResponse` (`:25-41`) can optionally gain `failed_attempts: int = 0` and `minted: bool = False`. It is not required, because pydantic ignores extra keys.

---

### `backend/app/api/documents.py` (controller): D-12 enqueue-failure arm

**Analog (exact template):** the storage-fail arm in the same function, `:638-671`:
```python
    except Exception as up_exc:
        # ── BUG-260905-08 — NO BYTES MEANS NO DOCUMENT. STOP HERE. ──
        log.error("Storage upload during /upload FAILED for %s (%s): %s — marking the document "
                  "failed rather than ingesting a file that does not exist", doc["id"], mint_result.storage_path, up_exc)
        try:
            service_supabase.table("documents").update({
                "status": "failed",
                "ingestion_step": "failed",
                "error_message": ("This file could not be stored, so nothing was read from it. "
                                  "Please try uploading it again."),
            }).eq("id", doc["id"]).execute()
        except Exception:  # noqa: BLE001 — the refusal write must not double-fault
            log.exception("could not mark %s failed after a storage failure", doc["id"])
        response.status_code = status.HTTP_201_CREATED
        return {**doc, "status": "failed"}
```
**Insertion site:** `:684-713`. Track `enqueued`. After `log.error("Failed to insert ingestion_job via supabase: …")` at `:713`, add the D-12 refusal **only if** `getattr(settings, "ingest_worker_enabled", True)` (the same guard as `:716`). Two differences from the template:
- wrap the update in `await run_in_threadpool(lambda: …)` (D-v2.5-01);
- add `.eq("status", "pending")`.

Return before the audit task at `:730`, exactly as the template does. ⛔ `ingest_splice.py` stays untouched.

---

### `frontend/src/components/sources/RunHistoryList.tsx` + `.test.tsx` (comment only)

- `RunHistoryList.tsx:171-173`: *"`run.last_error` is null on such a row, so calling `sourceFailureSentence` here would print…"*. Rewrite it to say that `last_error` now carries a run-level summary (D-03) and is deliberately NOT rendered on a success row (T-235-12). Do not change any logic. The `{failed && …sourceFailureSentence(run.last_error…)}` gate at `:259-267` is the guarantee.
- `RunHistoryList.test.tsx:362-363`: the same comment. The optional new case copies `:348-365`, passing `mountOne({ status: "success", count_errors: 1, last_error: "1 file failed: x.txt (ConnectError)" })`. It asserts `sources-run-partial` is present, `sources-fail-reason` is absent, and the raw string is not in `rowText()`. If the case is added, run the vitest count gate.

---

### `backend/tests/unit/services/test_285_watch_retry.py` (NEW)

**Analog:** `tests/unit/services/test_watch_service.py`.
- Fixtures `mock_pool`, `mock_supabase` and `mock_adapter` (`:13-64`). Copy them, or import them through a conftest if one exists.
- The patch stack by module path (`:354-359`):
```python
    with patch("app.services.watch_service.get_watch_items", new=AsyncMock(return_value=[])), \
         patch("app.services.watch_service.upsert_watch_item", new=AsyncMock()) as mock_upsert, \
         patch("app.services.watch_service.insert_ingestion_job", new=AsyncMock()) as mock_insert_job, \
         patch("app.services.watch_service.release_watch", new=AsyncMock()) as mock_release, \
         patch("app.services.watch_service.async_mint_document_row", new=AsyncMock(return_value=mint_res)), \
         patch("app.services.sources.base.SourceRegistry.get_adapter", return_value=mock_adapter):
        svc = WatchService(pool=mock_pool, supabase=mock_supabase)
        res = await svc.sync_watch(watch_record)
```
- For the retry cases, `get_watch_items` returns an existing item dict with `state="failed"`, `failed_attempts=N`, `source_version` and `document_id`.
- For the D-04 case, the error is an empty-message raise: `side_effect=httpx.ConnectError("")`.
- Read the release kwargs as at `:388-395`: `mock_release.call_args[1]["error"] is None` and `["run_error"]` contains the filename and `(ConnectError)`.
- MintResult construction: `:96-102`.

### `backend/tests/unit/test_285_purge_scope.py` (NEW)

**Analog:** `tests/unit/test_280_purge_bytes.py`.
- Imports reuse the recording fakes from `test_275_delete_paths.py` (`:29-48`).
- Order assertions, e.g. `_kinds(log) == ["guard", "documents.delete", "storage.remove"]` (`:77`).
- For BUG-05, subclass or mutate `_FakeSupabase` so `_Bucket.remove` returns a **subset**. The default returns `[{"name": p} for p in paths]` (`test_275_delete_paths.py:100-104`). Then assert the missing path lands in `not_removed`.
- ⚠ Pitfall 2: `_Con.fetch` (`test_275_delete_paths.py:439-440`) returns `self.items` for ANY SQL. Patch `sources.watch_purge_scope` by attribute, as `_patch_watch` does at `:466-481`, and include one positive case where a minted, unshared doc IS deleted.

### `backend/tests/unit/test_285_upload_enqueue_failure.py` (NEW)

**Analog:** `tests/unit/test_280_minter_sequence.py:546-579`:
```python
def _upload_client():
    from fastapi.testclient import TestClient
    from app.dependencies import get_current_user, get_supabase, get_user_supabase_client
    from app.main import app
    app.dependency_overrides[get_current_user] = lambda: {"id": USER, "email": "u@test.local"}
    app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()
    app.dependency_overrides[get_supabase] = lambda: MagicMock()
    return app, TestClient(app)
...
        with patch("app.services.ingest_splice.async_mint_document_row", new=AsyncMock(return_value=res)):
            resp = client.post("/documents/upload", files={"file": ("a.txt", b"abc", "text/plain")})
    finally:
        app.dependency_overrides.clear()
```
- Use `is_duplicate=False` and `_doc_payload` (`:558-565`).
- Make the asyncpg path fail with `patch("app.db.ingestion_jobs.insert_ingestion_job", side_effect=…)`, or patch `app.dependencies.get_pg_pool`. Both are imported inside the function body (`documents.py:674, 685`), so patch at their source modules.
- Make the get_supabase MagicMock's `.table("ingestion_jobs").insert().execute` raise.
- Assert 201 with `status == "failed"`, and assert the documents update was called with `status: failed`.
- Add a twin with `settings.ingest_worker_enabled=False` and assert no refusal write.

### `backend/tests/unit/test_285_migration_209_shape.py` (NEW)

**Analog:** `tests/unit/test_275_migration_204_shape.py:26-71`. Copy `REPO_ROOT`, `MIGRATIONS`, `_migration()` (glob `209_*.sql`, `len == 1`), `_strip_comments`, `_norm` and `_code`. All assertions run over comment-stripped text.
```python
REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
def _migration() -> Path:
    matches = sorted(MIGRATIONS.glob("204_*.sql"))
    assert len(matches) == 1, matches
    return matches[0]
```
Pin these properties:
- no `CREATE FUNCTION` / `PROCEDURE`;
- `ADD COLUMN IF NOT EXISTS failed_attempts` and `minted`;
- the backfill sits under the one-shot guard;
- the heal INSERT precedes the heal UPDATE, and both carry the `storage.objects` EXISTS / NOT EXISTS gate;
- the `interval '1 hour'` bound;
- the `created_at >= w.created_at` backfill term;
- the VERIFY block is present.

The 204 file documents a "plant that turns each red" in its docstring (`:9-20`). Follow that convention.

### `backend/tests/integration/test_285_purge_scope_live.py` (NEW)

**Analog:** `tests/integration/test_280_purge_bytes_live.py`, copied whole:
- imports (`:23-45`), `_request`, `_object_count`, `_row_exists` (`:55-68`);
- `Subject` (`:71-127`) and the `subject` fixture with proven cleanup (`:130-177`);
- `_door1` / `_door2` (`:180-191`), which call the route coroutines directly with the live user client, `_admin()` and a real pool;
- `_record`/EVIDENCE (`:194-198`).

**The linked hand upload:** mint via `s.mint_with_bytes`, then insert the watch item **without naming `minted`** (Pitfall 3, so it is valid pre- and post-209), copying the INSERT at `:108-113`. RESEARCH recommends driving the link through `WatchService.sync_watch` with a stub adapter for the strongest evidence.

**RED assertion** per door: `assert await _row_exists(...)` and `await _object_count(pool, path) == 1`, against today's code.

### `backend/tests/integration/test_285_stuck_pending_live.py` (NEW)

**Analog:** `tests/integration/test_280_same_bytes_live.py`:
- `_seed_folder` (`:48-56`) gives two folders (D-16 "different folder");
- the `subject` fixture (`:59-94`) cleans up storage paths, docs and folders and asserts `left == 0`;
- `_state` / `_live` (`:101-113`).

The `/upload` route needs a live call. Call `documents_api.upload_document` directly with live clients, as `test_280_purge_bytes_live.py:314-318` does for `delete_document`. Force both enqueue paths to fail with monkeypatch: patch `app.db.ingestion_jobs.insert_ingestion_job` to raise, and give the service client a wrapper whose `ingestion_jobs` insert raises. Then upload the same bytes into folder B and assert a non-failed doc plus an `ingestion_jobs` row exist.

The SC#4 FIX-02 pin stays in `test_280_same_bytes_live.py:121-160` (unchanged, re-run).

### Amendments to existing suites (RESEARCH §7)

| File | Lines | Edit |
|---|---|---|
| `tests/integration/test_280_purge_bytes_live.py` | `:98-114` `watch_with` | add a `minted: bool = True` kwarg and include the `minted` column in the INSERT, with a FIX-13 comment. Keep `:239` `purged_count == 2` |
| `tests/unit/test_275_delete_paths.py` | `:466-481` `_patch_watch` | also `monkeypatch.setattr(sources, "watch_purge_scope", …)` returning the minted, unshared sets derived from `items` |
| `tests/unit/test_280_purge_bytes.py` | `:174` | change the comment to D-09 (`purged_count == len(deleted)`) |
| `tests/integration/test_275_disposition.py` | `:56-57` | `remove` returns `[{"name": p} for p in paths]` after `outer.removed.extend(paths)` |
| `tests/unit/db/test_watches_db.py` | after `:304` | new case: `release_watch(..., error=None, run_error="1 file failed: x (ConnectError)")`. Assert `_insert_call(con)[7]` is the summary and the first UPDATE's `$3` arg is `None` |

---

## Shared Patterns

### Blocking supabase-py inside async (D-v2.5-01)
**Source:** `watch_service.py:508-517` (and `:412-417`, `:479-484`)
**Apply to:** the D-12 refusal write in `documents.py` and any new supabase-py write in the watch loop
```python
await run_in_threadpool(
    lambda d_id=target_doc_id, err=item_err: supabase.table("documents")
    .update({...})
    .eq("id", str(d_id))
    .execute()
)
```
Bind loop variables as lambda defaults, as shown.

### Refusal write must not double-fault
**Source:** `documents.py:659-669`
**Apply to:** D-12 and the watch error arm (already shaped this way at `:518-522`)
```python
try:
    ...update(...).execute()
except Exception:  # noqa: BLE001 — the refusal write must not double-fault
    log.exception("could not mark %s failed after ...", doc["id"])
```

### Purge order and hold guard (275 D-38 / T-275-12 / D-31)
**Source:** `document_purge.py:8-14, 53-76`
**Apply to:** both doors. They narrow the INPUT set only and never reorder. The guard is always `hold_guard.assert_none_held` through the module attribute, and the purge is always `document_purge.purge_documents` through the module attribute.

### Live integration harness
**Source:** `tests/integration/_rls_harness.requires_pg` + `_271_gotrue_users` (`require_gotrue`, `GoTrueUsers`, `create_org`, `drop_org`, `user_client`, `_admin`)
**Apply to:** both new `test_285_*_live.py` files. Run under the local-DB lock. A skip is a skip, never a pass. Cleanup is proven by a SQL count `== 0`.

### Additive response fields
**Source:** `models/source.py:94-107` ("The three net-new fields default so every existing caller stays valid")
**Apply to:** `WatchPurgeResponse.kept_count`

## No Analog Found

None. Every file has an in-repo analog. The SC#5 live driver is out of repo. Its precedent is `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/resync_a.py:14-40`, which patches `MicrosoftGraphSourceAdapter.read_file` at class level and then calls `WatchService(pool, supabase=get_supabase()).sync_watch(w)`. It is not a repo file and is not mapped here.

## Metadata

**Analog search scope:** `backend/app/{services,db,api,models}`, `backend/tests/{unit,integration}`, `supabase/migrations/{105,203,204,208}`, `scripts/apply_migration_208.py`, `frontend/src/components/sources/`
**Files scanned:** 22
**Pattern extraction date:** 2026-10-16
