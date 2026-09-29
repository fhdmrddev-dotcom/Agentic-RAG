# Phase 266: Expert Knowledge in a Real Org - Pattern Map

**Mapped:** 2026-09-24
**Files analyzed:** 24 (new + modified, including tests and register rows)
**Analogs found:** 22 / 24. The two without a direct analog are the corpus data files and `.gitattributes`. RESEARCH.md covers both.

All line numbers below were read in the tree at `a29949402`. Re-grep before quoting any of them in a PLAN, because these files are hot.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/195_expert_installs_and_seed_retirement.sql` (NEW) | migration | DDL + data retirement | `supabase/migrations/189_expert_presentation_and_grants.sql` (table/RLS) + `192_revoke_anon_tier_capabilities.sql` (REVOKE PUBLIC) | exact (composite) |
| `scripts/full-schema-supplement.sql` §5e (MOD) | config / ACL mirror | n/a | same file, §5e `:476-501` | exact |
| `backend/app/experts/corpora/financial-analyzer/acme_q3_2026_financial_report.md` (NEW) | data | file-I/O | `supabase/migrations/188_expert_chat_scoping.sql:72-100` (verbatim source) | source, not analog |
| `backend/app/experts/corpora/financial-analyzer/manifest.json` (NEW) | data | file-I/O | none | no analog |
| `backend/app/services/expert_install_service.py` (NEW) | service | request-response + file-I/O + queue enqueue | `backend/app/services/sources/import_service.py` (`import_single_file` `:169-267`, `_enqueue_or_splice` `:64-166`) | exact |
| `backend/app/db/experts.py` (MOD, new queries only) | model / db | CRUD | same file: `stamp_skills_born_for_bundle` `:410-449` (263-01 precedent), `add_expert_grant` `:496-521` (ON CONFLICT) | exact |
| `backend/app/services/expert_service.py` (MOD) | service | transform (scope resolution) | same file: `resolve_expert_bundle` `:394-551`, list/get `:117-186` | exact (in-place) |
| `backend/app/services/ingest_splice.py` (MOD, D-266-18) | service | CRUD (mint) | same file `:194-226`, `:277-288` | exact (in-place) |
| `backend/app/api/experts.py` (MOD, new routes) | controller | request-response | same file `create_expert` `:129-188`, `get_expert` `:440-470`; `api/connectors.py:1837-1897` (BackgroundTasks + user-JWT client) | exact |
| `backend/tests/unit/test_266_system_folder_bypass_fence.py` (NEW) | test | unit, RED-first | `backend/tests/unit/test_259_expert_member_isolation.py:21-130` | exact |
| `backend/tests/unit/test_266_resolver_reads_installs.py` (NEW) | test | unit | same as above + `test_263_stamp_claims_only_this_session.py:81` (`patch.object(expert_service.experts_db, ...)`) | exact |
| `backend/tests/unit/test_266_corpus_verbatim.py` (NEW) | test | unit, file-I/O | `backend/tests/unit/test_259_expert_entitlement_gate.py:176-187` (reads a repo file by `pathlib`) | role-match |
| `backend/tests/unit/test_266_install_service.py` (NEW) | test | unit | `backend/tests/unit/services/sources/test_238_04_stored_path_is_never_fabricated.py:100-116` | exact |
| `backend/tests/unit/test_266_install_idempotency.py` (NEW) | test | unit | same as above + `test_263_expert_born_skill_resolution.py:376-417` (SQL text + bind order) | exact |
| `backend/tests/unit/test_266_mint_org_scope.py` (NEW) | test | unit | `backend/tests/unit/test_ingest_splice.py:36-226` | exact |
| `backend/tests/unit/test_266_install_route_gates.py` (NEW) | test | unit (TestClient) | `test_259_expert_entitlement_gate.py:30-173` + `test_262_expert_list_grants_api.py:72-172` | exact |
| `backend/tests/integration/test_266_two_org_fence.py` (NEW) | test | integration (real RLS) | `backend/tests/integration/test_163_rls_documents.py` + `_rls_harness.py` + `conftest.py:98` `two_orgs_two_users` | exact |
| `backend/tests/unit/test_260_financial_analyzer_conversation.py` (MOD, relabel) | test | n/a | n/a (docstring change only) | n/a |
| `frontend/src/lib/api/experts.ts` (MOD) | api client | request-response | same file `listExperts`/`getExpert` `:179-198`, `draftSkillBody` `:270-288` (typed refusal arm) | exact |
| `frontend/src/types/index.ts` (MOD, one optional field) | type | n/a | `ExpertBundle` `:17-35` | exact |
| `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` (MOD) | component | render server state | same file, footer `:325-345`, `HONEST` `:73-81` | exact (in-place) |
| `frontend/src/components/experts/catalog/ExpertCard.tsx` (MOD) | component | render server state | same file, footer `:139-156` | exact (in-place) |
| `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` (MOD) | component (page) | fetch + poll | same file `:71-109` | exact (in-place) |
| `frontend/src/components/chat/InviteExpertDialog.tsx` (MOD) | component | render server state | same file `:183-209` | exact (in-place) |
| `frontend/src/pages/LibraryPage.tsx` → `components/ingestion/FolderTree.tsx` → `FolderNode.tsx` (MOD) | component | prop-threading | `folderDocumentCounts` precedent: `LibraryPage.tsx:398-405,503`, `FolderTree.tsx:15-17,30,184`, `FolderNode.tsx:34-37,81,95-96` | exact |
| Frontend tests: `ExpertDetailModal.test.tsx`, `ExpertCatalogPage.test.tsx`, `ComposerExpert.test.tsx`, any new suite (MOD/NEW) | test | vitest | `ExpertDetailModal.test.tsx:1-201`, `ExpertCatalogPage.test.tsx:25-31,170` | exact |
| `scripts/vitest-count-gate.cjs` (MOD) | config | n/a | same file `:176-200` (BASELINE), `:4433-4460` (TARGETS) | exact |
| `docs/HOT-FILE-LEDGER.md` + `CLAUDE.md` FIRING table (MOD) | register | n/a | `HOT-FILE-LEDGER.md:10953` (row) + `:11033` (section) | exact |
| `.gitattributes` (NEW, optional) | config | n/a | none in repo (measured: no `.gitattributes`) | no analog |

---

## Pattern Assignments

### `supabase/migrations/195_expert_installs_and_seed_retirement.sql` (migration)

**Analog A, table + RLS shape:** `supabase/migrations/189_expert_presentation_and_grants.sql:21-62`

```sql
CREATE TABLE IF NOT EXISTS public.expert_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_id uuid NOT NULL REFERENCES public.expert_bundles(id) ON DELETE CASCADE,
    grantee_type text NOT NULL CHECK (grantee_type IN ('user', 'role')),
    grantee_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_expert_grant UNIQUE (expert_id, grantee_type, grantee_id)
);
COMMENT ON TABLE public.expert_grants IS '... (PACK-10, Phase 261).';
CREATE INDEX IF NOT EXISTS idx_expert_grants_expert ON public.expert_grants (expert_id);
ALTER TABLE public.expert_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expert_grants_read_policy" ON public.expert_grants;
CREATE POLICY "expert_grants_read_policy" ON public.expert_grants FOR SELECT TO authenticated, service_role
    USING ( auth.role() = 'service_role' OR expert_id IN (SELECT eb.id FROM public.expert_bundles eb
            JOIN public.org_members m ON m.org_id = eb.org_id WHERE m.user_id = auth.uid()) );
```

Copy: `CREATE TABLE IF NOT EXISTS`, the `CONSTRAINT uq_<name> UNIQUE (...)` naming, a `COMMENT ON TABLE/COLUMN` per column, `DROP POLICY IF EXISTS` before `CREATE POLICY`, and `ENABLE ROW LEVEL SECURITY`.

⚠ **Do NOT copy 189's grant line** (`:46`, `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated, service_role`) or its `FOR ALL` write policy (`:66-87`). `expert_installs` has **no client write path** (RESEARCH Security Domain), so grant `SELECT` only to `authenticated`. Use the member-read predicate `org_id IN (SELECT public.current_user_org_ids())` from RESEARCH `:492-494`. `current_user_org_ids()` is already `GRANT EXECUTE ... TO authenticated` (supplement `:608-611`).

**Analog B, REVOKE-from-PUBLIC idiom:** `supabase/migrations/192_revoke_anon_tier_capabilities.sql` (header + body)

```sql
-- ⚠ Table privileges are revoked from anon AND PUBLIC (Postgres grants nothing to PUBLIC on a
-- table by default, but REVOKE FROM PUBLIC is idempotent and closes the trap CLAUDE.md
-- records for functions). Idempotent: safe to paste twice.
REVOKE ALL ON TABLE public.tier_capabilities FROM anon;
REVOKE ALL ON TABLE public.tier_capabilities FROM PUBLIC;
DROP POLICY IF EXISTS "tier_capabilities_read_all" ON public.tier_capabilities;
CREATE POLICY "tier_capabilities_read_all" ON public.tier_capabilities FOR SELECT TO authenticated, service_role USING (true);
```

Copy the header comment style: a numbered `-- 195 — …` line, a WHY paragraph, and "Idempotent: safe to paste twice." That last line matters because the migration goes in through the SQL editor.

**Analog C, rows to retire (fixed ids):** `supabase/migrations/188_expert_chat_scoping.sql`. Folder `…0260` is inserted at `:19-29`, document `…0261` at `:41-62`, chunks from `:105` (document ref `:118,:127`), and the bundle folder binding at `:172` (`SET knowledge_folder_ids = ARRAY['…0260'::uuid]`). Use the RESEARCH skeleton `:504-512`: `DELETE` by fixed id, `array_remove` on the bundle, and keep skill `…0264`.

**Index widen (D-266-18):** RESEARCH `:498-502`. `DROP INDEX IF EXISTS public.documents_completed_hash_unique_idx;` then recreate it on `(org_id, user_id, content_hash) WHERE content_hash IS NOT NULL AND status = 'completed'`. The planner must state CONCURRENTLY vs non-concurrent (RESEARCH `:516`).

---

### `scripts/full-schema-supplement.sql` §5e (ACL mirror)

**Analog:** same file `:476-501`. Append a new block in the same style, after the migration-194 block and before `-- 6. Function EXECUTE privileges`:

```sql
-- migration 189:45
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_grants TO authenticated, service_role;

-- migration 194 — an org admin must not raise their own plan (R265-audit-fixes-01).
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM authenticated;
REVOKE INSERT, UPDATE ON TABLE public.organizations FROM PUBLIC;
```

Rule: every GRANT/REVOKE line in 195 appears here **verbatim**, with a `-- migration 195 — <why>` comment line, in the same commit. Also widen the section header `5e. Table privileges: tier_capabilities, expert_bundles, expert_grants` to name `expert_installs`. Verify with `node scripts/check-schema-acl-parity.cjs`.

---

### `backend/app/experts/corpora/financial-analyzer/*` (data)

**Source (not an analog):** `supabase/migrations/188_expert_chat_scoping.sql:72-100`. The SQL literal opens with `'# ACME Corporation - Q3 2026 Financial Results and Form 10-K Report` (`:72`) and ends at item 3 of the risk factors (`:100`), just before `now(),`. The `.md` file is that literal with the opening `'` stripped, the closing `'` stripped, and any `''` un-doubled. Commit it with LF endings (Pitfall 5: `core.autocrlf=true`, no `.gitattributes`).

The `manifest.json` shape is in RESEARCH `:273`. There is no existing JSON-manifest data dir in `backend/app/`. ⛔ The dir must never be imported (Extension Contract), and it needs no `__init__.py`.

---

### `backend/app/services/expert_install_service.py` (NEW service)

**Analog:** `backend/app/services/sources/import_service.py`

**Imports pattern** (`:8-21`):
```python
from __future__ import annotations

import logging
from typing import Any

from fastapi import BackgroundTasks
from starlette.concurrency import run_in_threadpool
from supabase import Client

from app.dependencies import get_supabase
from app.services import ingest_splice

logger = logging.getLogger(__name__)
```
Also import `from app.db import experts as experts_db`. That is the `expert_service.py:10` style, and tests patch it through `patch.object(module.experts_db, ...)`.

**Core mint pattern** (`:237-267`). Copy the argument set exactly and add `folder_id` + explicit `org_id`:
```python
    mint_result = await ingest_splice.async_mint_document_row(
        raw=raw_bytes,
        filename=filename,
        mime_type=mime_type,
        user_id=user_id,
        supabase=supabase,          # user-JWT client (RLS proves org + owner)
        folder_id=folder_id,
        metadata=metadata,
        org_id=str(active_org),     # ⛔ mandatory — trigger picks an arbitrary org otherwise (Pitfall 1)
        ...
    )
    doc = dict(mint_result.document)

    if not mint_result.is_duplicate:
        await _enqueue_or_splice(
            doc=doc, raw=raw_bytes, mime_type=mime_type, filename=filename,
            user_id=user_id, active_org=str(active_org),
            storage_path=mint_result.storage_path, background_tasks=background_tasks,
        )
    else:
        doc["_already_here"] = True
```
For the installer: pass `on_conflict="link"` (RESEARCH `:330`). Do **not** pass `source_connection_id` / `ingest_visibility`. Those are connection-only and are written as a pair or not at all (`ingest_splice.py:250-260`). On the `is_duplicate` arm, refuse to adopt a row whose `org_id`/`folder_id` is not this install's (RESEARCH `:338-340`).

**Enqueue pattern: reuse, never copy** (`:64-166`). Import `_enqueue_or_splice` from `app.services.sources.import_service`, or promote it to a public name in that module. Its docstring (`:75-101`) records BUG-260905-04's four defects, which a copy would reintroduce. Key invariants to keep:
- The storage PUT happens **before** the job exists (`:112-135`): `get_supabase().storage.from_("documents").upload(path=storage_path, file=raw, file_options={"content-type": mime_type})` inside `run_in_threadpool`.
- `insert_ingestion_job(pool, document_id=UUID(...), user_id=UUID(...), org_id=UUID(str(active_org)))` (`:137-146`). The signature is `backend/app/db/ingestion_jobs.py:31-38`.
- The never-strand fallback (`:154-166`).

**Folder insert.** There is no in-repo helper to reuse. Do NOT call `POST /folders` (`api/folders.py` FIRES with no ledger row, and its uniqueness check is per-user). Use the user-JWT client inside `run_in_threadpool`, in the shape of `documents.py:1191-1199`:
```python
row = await run_in_threadpool(
    lambda: supabase.table("folders").insert({
        "user_id": user_id, "org_id": str(active_org), "name": manifest["folder_name"],
        "parent_id": None, "is_org_shared": True,        # ⛔ is_org_shared on the FOLDER only (C-1)
    }).execute()
)
```

**Failed-doc re-drive (D-266-14).** The shape is from `backend/app/api/documents.py:1188-1247` (`/reingest`): an owner SELECT, a chunk-cascade delete, and `update({"status": "pending"}).eq("id", …).eq("user_id", …)`, all in `run_in_threadpool`. ⚠ Diverge at step 5. `/reingest` schedules `_upload_pipeline` as a BackgroundTask (`:1255-1262`), which is the legacy path. The installer must instead re-PUT the bytes to the existing `file_path` and call `insert_ingestion_job`. The simplest way is to call `_enqueue_or_splice(doc=<existing row>, storage_path=<row.file_path>, ...)`. Note that the storage upload of an existing key needs upsert semantics, so the planner should check the storage client's `upsert` option.

**Error handling:** `import_service` lets `HTTPException` from the mint (403 folder not owned, 404 folder missing, 409) propagate. Keep that. The route layer re-raises `HTTPException` before any catch-all (see the route section).

---

### `backend/app/db/experts.py` (MOD — new queries only, D-266-11)

**Analog:** `stamp_skills_born_for_bundle` `:410-449`. This is the 263-01 precedent: one new function appended, and no existing function edited.

```python
async def stamp_skills_born_for_bundle(
    pool: asyncpg.Pool,
    *,
    bundle_id: UUID,
    skill_names: list[str],
    org_id: UUID,
    user_id: UUID,
) -> list[str]:
    """... Each of the three narrowing predicates is load-bearing: ..."""
    if not skill_names:
        return []
    query = """
        UPDATE public.skills
        SET born_for_expert_bundle_id = $1,
            updated_at = now()
        WHERE name = ANY($2::text[])
          AND org_id = $3
          AND user_id = $4
          AND born_for_expert_bundle_id IS NULL
        RETURNING name;
    """
    rows = await pool.fetch(query, bundle_id, skill_names, org_id, user_id)
    return [r["name"] for r in rows]
```
Copy these conventions: keyword-only `*` args, a docstring that names why each predicate is load-bearing, numbered `$n` binds (never f-string values), and a plain `dict(row)` return. Append the new functions **below** `bulk_set_expert_grants` (`:545-567`) under a `# --- Expert Installs (PACK-18/19, Phase 266) ---` header, mirroring `# --- Expert Grants CRUD (PACK-10) ---` at `:479`.

**ON CONFLICT pattern:** `add_expert_grant` `:506-521` (`INSERT … ON CONFLICT (…) DO UPDATE SET … RETURNING *; if not row: raise RuntimeError(...)`). The CAS claim deliberately differs: it adds a `WHERE` clause to the `DO UPDATE`, so **no row returned = claim lost**, which is not an error. Use the full SQL from RESEARCH `:350-358`.

**New functions (names from RESEARCH `:276`):** `get_expert_install(pool, org_id, bundle_id)`, `list_expert_installs_for_org(pool, org_id)`, `claim_expert_install(...)`, `set_expert_install_folder(...)`, `set_expert_install_status(...)`. ⛔ Every statement carries `org_id = $n` bound from the validated active org (RESEARCH Security `:643`).

---

### `backend/app/services/expert_service.py` (MOD — resolver + list/get overlay)

**Seam to edit:** `resolve_expert_bundle` `:466-501`:
```python
    # 2. Evaluate knowledge_folder_ids independently
    raw_folder_ids = bundle.get("knowledge_folder_ids") or []          # :467  ← replace the SOURCE for is_system
    ...
        for r in folder_rows:
            f_id = r["id"]
            f_org_id = r.get("org_id")
            f_user_id = r.get("user_id")
            f_shared = bool(r.get("is_org_shared"))
            is_system_folder = bool(f_user_id == SYSTEM_USER_ID and f_shared)          # :484  ← DELETE (D-266-10)
            is_tenant_folder = bool(f_org_id == caller_org_id and (f_user_id == caller_user_id or f_shared))
            if is_system_folder or is_tenant_folder:                                  # :486  ← becomes `if is_tenant_folder:`
                valid_folders.add(f_id)
```
The replacement code is RESEARCH Pattern 1 `:295-314`. Keep the strip loop (`:489-501`) and its `EXPERT_MEMBER_CROSS_ORG_STRIPPED` literal byte-identical, because six tests match that literal through `caplog.text` (docstring `:346-349`). Put the install read in a dedicated `experts_db.get_expert_install` call, made only when `bundle.get("is_system")`. That preserves the `pool.fetch` side_effect order every existing resolver test depends on (`test_259_expert_member_isolation.py:53-71`).

**Comment convention for the deletion:** the file already records its retirements verbatim instead of silently deleting them. See `filter_visible_skill_names` docstring `:312-321` ("⛔ RETIRED DELIBERATELY BY PHASE 264 … the original block is quoted verbatim rather than deleted"). Replace `:484` with a comment in that style that names SEED-304.

**`SYSTEM_USER_ID` (`:15`):** after the deletion it has no reader in `app/`. Grep `backend/tests/` before deleting it.

**List/get overlay:** `list_experts_service` `:163-186` and `get_expert_service` `:117-137` return raw dicts. Add the overlay **after** the existing call returns, so both call arms (the grant-aware one and the management one) get it. Fetch it with one `list_expert_installs_for_org` per list call. It rewrites only `is_system` rows: `knowledge_folder_ids` → `[install.folder_id]` or `[]`, plus an additive `install` key. Compute `can_install` in the **route** (it needs `request` for `_has_org_permission`), or pass it in as a bool. The service has no `request`.

---

### `backend/app/services/ingest_splice.py` (MOD — D-266-18 per-org dedup)

**Seam** (`:194-226`):
```python
    dedup_query = (
        supabase.table("documents")
        .select("*")
        .eq("user_id", user_id)
        .eq("content_hash", content_hash)
        .eq("status", "completed")
    )
    existing = dedup_query.limit(1).execute()
    ...
    # 4. Versioning (user-scoped, filename matching)
    existing_versions = (
        supabase.table("documents")
        .select("id, version_number")
        .eq("user_id", user_id)
        .eq("filename", filename)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if existing_versions.data:
        next_version = existing_versions.data[0]["version_number"] + 1
        supabase.table("documents").update({"is_latest": False}).eq("user_id", user_id).eq("filename", filename).execute()
```
Change: when `org_id` is truthy, add `.eq("org_id", org_id)` to (a) `dedup_query`, (b) `existing_versions`, and (c) the `is_latest` retire `update(...)`. Build each query first and branch on `if org_id:` before `.execute()`, the same way the existing `if folder_id:` / `else` branch builds `link_query` at `:284-287`.

⚠ **A fourth site the RESEARCH does not name:** the `on_conflict="link"` re-query at `:277-288` also filters `user_id + content_hash` only. The installer passes `on_conflict="link"`, so after the index widens a 23505 can only come from a same-org row. Without the org arm, though, this re-query can still **return another org's row** as `is_duplicate=True`. Add the same `if org_id:` arm there, or state why it is unreachable.

**Comment convention:** this function already carries dated `⚠ BUG-…` paragraphs above each predicate (`:173-193`). Add a `⚠ D-266-18 (Phase 266)` paragraph in the same style, saying that `/upload` passes no `org_id` and is byte-unchanged, while `import_service` and `watch_service` pass one and become org-scoped.

**Blast radius (tests to re-run):** `tests/unit/test_ingest_splice.py`, `tests/unit/services/test_watch_service.py`, `tests/unit/services/sources/test_import_service.py`, `test_238_04_stored_path_is_never_fabricated.py`, `test_240_attachments_both_paths.py`, `test_244_cloud_attach_is_thread_scoped.py`, `test_244_import_destination_required.py`, and `tests/integration/test_230_upload_queue_cutover.py`. Grep `mint_document_row` across `backend/tests/` returns 54 hits in these 8 files.

---

### `backend/app/api/experts.py` (MOD — `POST /experts/{bundle_id}/install`, `GET /experts/installs`)

**Imports** (`:1-37`). Add `BackgroundTasks` to the `fastapi` import (`:8`), `get_user_supabase_client` to the `app.dependencies` import (`:10`), `from supabase import Client`, and the new service.

**Auth pattern.** The router-level tier gate is already in place (`:41-45`). ⛔ Add no second tier check (D-266-04, and `test_259_expert_entitlement_gate.py:176-187` AST-fails any `subscription_tier` read in this file):
```python
router = APIRouter(
    prefix="/experts",
    tags=["experts"],
    dependencies=[Depends(require_capability("experts"))],
)
```
Manage gate: `require_expert_manage` `:111-126`. ⛔ The dependency must be **positional-or-keyword, with no bare `*` in the signature**. `test_261_single_expert_authoring_gate.py:75-99` walks `fn_node.args.defaults` for every `@router.post/patch/delete` and fails a route whose guard sits in `kw_defaults` (see the comment at `:321-324`).

**Route shape:** copy `create_expert` `:129-188` for the dependency order, and `api/connectors.py:1837-1845` for how a route receives `background_tasks` and the user-JWT client:
```python
@router.post("/{bundle_id}/install", status_code=status.HTTP_202_ACCEPTED)
async def install_expert(
    bundle_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    active_org: str = Depends(get_active_org_id),
    current_user: dict[str, Any] = Depends(require_expert_manage),
    supabase: Client = Depends(get_user_supabase_client),
    pool: asyncpg.Pool = Depends(get_pg_pool),
) -> dict[str, Any]:
    org_id = _to_uuid(active_org)
    user_id = _to_uuid(current_user["id"] if isinstance(current_user, dict) else getattr(current_user, "id"))
```

**404 pattern** (`:576-578`):
```python
    bundle = await get_expert_service(pool=pool, bundle_id=bundle_id, caller_org_id=org_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expert bundle not found")
```
Call `get_expert_service` with `caller_user_id`/`caller_roles` too, as `get_expert` does at `:458-464`. Otherwise a granted-visibility bundle is reachable without its grant. Only `is_system` bundles are installable, and those always pass the grant check, but a non-system bundle must 404/409 without leaking its existence.

**Structured refusal (409 non-system)**, from `draft_skill_body` `:362-368`:
```python
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"detail": "<human sentence>", "error": "expert_not_installable"},
        )
```
The `"detail"` key inside `detail` is load-bearing, because `handleResponse` reads `err.detail?.detail` (`:99-101` comment, `lib/api/experts.ts:162-163`).

**Error handling order** (`:163-188`, WR-09): named arms first, then `except HTTPException: raise` (as at `connectors.py:1890-1891`), then a catch-all whose `detail` is a **LITERAL**, never `f"…{exc}"`, logged with `exc_info=True`.

**Route order:** `GET /experts/installs` must be declared **before** `@router.get("/{bundle_id}")` at `:440`, or FastAPI matches it as a UUID param and returns 422. The alternative is `GET /experts/{bundle_id}/install`.

**Role lookup:** reuse `_caller_roles(request, current_user)` (`:386-390`). Never read `current_user["role"]` (comment at `:411-413`).

---

### Backend unit tests

**`test_266_system_folder_bypass_fence.py` + `test_266_resolver_reads_installs.py`.** Analog: `backend/tests/unit/test_259_expert_member_isolation.py:21-80`.
```python
@pytest.mark.asyncio
async def test_resolve_legitimate_bundle_all_members_admitted():
    mock_pool = MagicMock()
    org_a = uuid4(); user_a = uuid4(); bundle_id = uuid4(); folder_a = uuid4()
    bundle_row = {
        "id": bundle_id, "name": "Legit Expert", "slug": "legit-expert", "description": "...",
        "scope_mode": "restricted", "is_system": False, "org_id": org_a,
        "visibility": "org",            # ⛔ NOT NULL in prod — grant gate reads it
        "created_by": user_a,
        "member_skills": [...], "knowledge_folder_ids": [folder_a], "required_connections": [...],
        "prompt_suggestions": [...],
    }
    mock_pool.fetchrow = AsyncMock(return_value=bundle_row)
    mock_pool.fetch = AsyncMock(side_effect=[ <skill_rows>, <folder_rows>, <conn_rows> ])
    resolved = await resolve_expert_bundle(mock_pool, bundle_id, org_a, user_a)
```
Keep the `visibility` + `created_by` keys (the F-1 note at `:38-42`). Order the `side_effect` list skills → folders → connections, and leave out any list whose member list is empty. For the caplog arm, use `with caplog.at_level(logging.WARNING):` as at `:126-127`. For the install read, patch the db function rather than extending `side_effect`: `patch.object(expert_service.experts_db, "get_expert_install", new=AsyncMock(return_value={...}))`, the shape at `test_263_stamp_claims_only_this_session.py:81`.

**RED plant for D-266-10:** follow RESEARCH `:518-533`. Check out `expert_service.py` at the base, run (1 failed), restore, run (passed), and record the plant in the SUMMARY.

**`test_266_mint_org_scope.py`.** Analog: `backend/tests/unit/test_ingest_splice.py:36-84` (mock builder) + `:194-225` (versioning).
```python
def _make_query_builder():
    b = MagicMock()
    b.eq.return_value = b
    b.neq.return_value = b
    b.is_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    ...
def _build_mock_supabase():
    client = MagicMock()
    tables = {"documents": _make_table_mock(), "folders": _make_table_mock()}
    client.table.side_effect = lambda name: tables.get(name, _make_table_mock())
    client._tables = tables
```
⚠ The builder returns **itself** from `.eq`, so one mock sees every `.eq` call across the dedup and version queries. Assert against `supabase._tables["documents"]._select.eq.call_args_list` (and `_update.eq.call_args_list` for the retire). Include `call("org_id", ORG)` when `org_id` is passed, and a negative arm with **no** `org_id` call when `org_id=None`. That second arm is the "`/upload` byte-unchanged" proof. Existing tests call `mint_document_row(...)` synchronously without `org_id`, so they stay valid.

**`test_266_install_service.py` + `test_266_install_idempotency.py`.** Analog: `test_238_04_stored_path_is_never_fabricated.py:91,100-116`. Patch at the **import site**:
```python
    mint = AsyncMock(return_value=_mint_result())
    with patch("app.services.sources.import_service._enqueue_or_splice", new=AsyncMock()), \
         patch("app.services.ingest_splice.async_mint_document_row", new=mint):
```
If the installer imports `_enqueue_or_splice` by name (`from … import _enqueue_or_splice`), patch `app.services.expert_install_service._enqueue_or_splice` instead. The patch target follows the import form, so the planner should fix the form in the plan. Assert `mint.await_args.kwargs["org_id"] == str(ORG)` and the folder-insert payload's `org_id`. For SQL-text assertions on the new db functions, copy `test_263_expert_born_skill_resolution.py:404-417`: assert each predicate substring, assert that `str(org_id)` is **not** in the SQL (no interpolation), and assert `call.args[1:]` bind order.

**`test_266_install_route_gates.py`.** Analog: `test_259_expert_entitlement_gate.py:17-62` + `test_262_expert_list_grants_api.py:72-84,154-172`.
```python
@pytest.fixture
def expert_test_app():
    app = FastAPI(); app.include_router(experts_router); return app

def _wire(app, *, user=None):
    app.dependency_overrides[get_current_user] = lambda: user or {"id": CALLER_ID, "email": "m@example.com"}
    app.dependency_overrides[get_active_org_id] = lambda: ORG_ID
    app.dependency_overrides[get_pg_pool] = lambda: MagicMock()

with patch("app.services.entitlement_service.check_entitlement", new_callable=AsyncMock) as mock_check, \
     patch("app.api.experts._has_org_permission", new_callable=AsyncMock) as mock_perm, \
     patch("app.api.experts.<install_service_fn>", new_callable=AsyncMock) as mock_install:
    mock_check.return_value = ALLOWED            # or allowed=False → 403 detail.error == "entitlement_required"
    mock_perm.return_value = False               # → 403, and mock_install.assert_not_awaited()
```
The new route also depends on `get_user_supabase_client`, so add `app.dependency_overrides[get_user_supabase_client] = lambda: MagicMock()` or the TestClient will try real auth. The "spoofed `X-Org-Id` → 403" arm cannot be driven through a `get_active_org_id` override. Either leave that override off and patch the membership read inside `dependencies.get_active_org_id`, or assert that the route uses `get_active_org_id` (an AST or signature check). The planner picks one.

Also extend `test_259_expert_entitlement_gate.py:133-173` (`test_all_expert_endpoints_gated_by_router_dependency`) with the two new paths, or add an equivalent case in the 266 file.

---

### `backend/tests/integration/test_266_two_org_fence.py` (integration, real RLS)

**Analog:** `backend/tests/integration/test_163_rls_documents.py` (whole file) + `_rls_harness.py` + `conftest.py:74-98`.

**Imports + skip guard** (`test_163_rls_documents.py:26-33`):
```python
from uuid import uuid4
import pytest
from app.dependencies import _apply_rls_user_context
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg

pytestmark = requires_pg
```
**Single-org subject helper:** `_add_comember(pool, org_id)` `:47-65` seeds a fresh user whose **only** membership is `org_id` (it deletes the auto-created personal org). This is exactly the subject Pitfall 3 requires. Tear down with `_drop_user` `:68-77`.

**Explicit-org seeding** (`:156-166`). This avoids the autofill trigger:
```python
        await pg_pool.execute(
            "INSERT INTO public.folders (id, user_id, org_id, name, is_org_shared) VALUES ($1, $2, $3, $4, true)",
            folder_id, a["uid"], a["org_id"], f"...-{folder_id}",
        )
```
**Isolation + positive control** (`:168-189`):
```python
        async with open_user_conn(pg_pool, c_uid) as conn:
            await assert_auth_uid(conn, c_uid)          # fail-loud: NULL uid false-passes at 0 rows
            comember_sees = await conn.fetchval("SELECT count(*) FROM public.documents WHERE id = $1", doc_id)
        assert comember_sees == 1, "..."                  # positive control
        async with open_user_conn(pg_pool, b["uid"]) as conn:
            await assert_auth_uid(conn, b["uid"])
            crossorg_sees = await conn.fetchval(...)
        assert crossorg_sees == 0, "..."
    finally:
        await pg_pool.execute("DELETE FROM public.documents WHERE id = $1", doc_id)
```
Fixtures come from `conftest.py:74` (`pg_pool`) and `:98` (`two_orgs_two_users` → `{"a": {"uid", "org_id"}, "b": {...}}`). Run the RPC leg (`match_document_chunks` / `keyword_search_chunks`) under `open_user_conn` too. Their EXECUTE grants to `authenticated` are in the supplement at `:629-637`. ⚠ Serialize this plan, because it mutates the local DB (CLAUDE.md worktree rule 4).

---

### `frontend/src/lib/api/experts.ts` (MOD)

**Analog:** same file. GET is `listExperts`/`getExpert` `:179-198`. POST is `createExpert` `:200-209`. The typed status arm before `handleResponse` is `draftSkillBody` `:283-287`.
```ts
export async function getExpert(bundleId: string): Promise<ExpertBundle> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/experts/${bundleId}`, { headers })
  return handleResponse<ExpertBundle>(res, "Failed to get expert")
}

  if (res.status === 409) {
    const d = await readRefusalDetail(res)
    if (d?.error === "self_improve_disabled") throw new SkillBodyDisabledError(d.detail)
  }
  return handleResponse<AuthoredSkillBody>(res, "Failed to draft skill instructions")
```
Put the wire type `ExpertInstallState` **here**, beside the other wire types (`SuggestedNewSkill` `:72-79` records why wire types live in this module). `getAuthHeaders()` already carries `X-Org-Id` (RESEARCH C-6: `_core.ts:280`). ⛔ Never send an `org_id` in the body.

⚠ **Barrel:** `frontend/src/lib/api.ts:505-509` re-exports only `listExperts` and `getExpert`. `api.ts` has a ledger row (`187 / 110 / 422`, SPLIT TAKEN). Two options:
- Keep new functions off the barrel and import them from `@/lib/api/experts`. The studio's precedent does this (`experts.ts:73-74` comment). Then mock that module path in tests.
- Or keep the modal prop-driven: the page owns the calls, and `ExpertCatalogPage.tsx` only needs `listExperts` (already barrel-exported and mocked at `ExpertCatalogPage.test.tsx:25-31`) plus the new install call.

---

### `frontend/src/types/index.ts` (MOD — one optional field)

**Analog:** `ExpertBundle` `:17-35`. The last five fields are already optional (`icon?`, `category?`, …, `tool_floor_enabled?`). Add `install?: ExpertInstallState | null` after `tool_floor_enabled?`. That means importing the type from `@/lib/api/experts` into `types/index.ts`, or declaring it in `types`. ⚠ `types/index.ts` FIRES (`90 / 70 / 1434`), so its ledger cell is "honoured by construction: one optional field". Every existing fixture (`bundle()` helpers in `ExpertDetailModal.test.tsx:31-45` and `ExpertCatalogPage.test.tsx:33-48`) stays valid because the field is optional.

---

### `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` (MOD)

**Analog:** same file.

**The honest-copy home** (`:65-81`). Put all new install wording in one exported constant, pinned by the suite, in the `HONEST` / `UNNAMEABLE_FOLDER` style:
```tsx
export const UNNAMEABLE_FOLDER = "a knowledge folder you cannot see"

/** Every honest line, in one place — an absence is a sentence, never an empty box. */
export const HONEST = {
  whenToUse: "The author has not said when to use this Expert yet.",
  ...
} as const
```
**Footer** (`:325-345`). There are exactly two controls today, and the file header (`:36-41`) forbids a disabled or coming-soon control:
```tsx
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 p-4">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border ...">Close</button>
          <button type="button" onClick={() => { onStartChat(expert); onOpenChange(false) }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground ...">
            <Sparkles className="h-3.5 w-3.5" /> Start Scoped Chat with Expert
          </button>
        </div>
```
Pattern for the new states: **swap** the primary control by state. Never add a `disabled` one.
- `can_install && state !== ready` → an Install / "Retry install" button.
- `installing`, or a non-manager with no install → a status line in the `HonestLine` style (`:91-93`) with the reason, and no button.
- `ready` → the existing Start Scoped Chat button.

⛔ `ExpertDetailModal.test.tsx:193-200` asserts **zero disabled buttons**, and case (7) `:182-191` asserts the start button still hands off once. Add the new prop (for example `onInstall?: (expert) => Promise<void>`) as **optional**, so the existing `mount()` at `:79-92` still compiles.

**Folders section** (`:208-236`): `resolveFolderNames(expert.knowledge_folder_ids ?? [], folders)`. With the server overlay (RESEARCH Pattern 5) this needs **no change**. An installed Expert's overlaid `[folder_id]` resolves through the caller's own `folders`.

**Failure cause:** render it through `classifyIngestionError` (`frontend/src/components/library/ingestionErrorVocabulary.ts:194`, exported beside `UNKNOWN_FAILURE_SENTENCE` `:70`). Never render raw `error_message`. ⚠ `grep` reports that file as **binary** (it contains a non-text byte). Read it with `grep -a` or the Read tool, and do not "clean" it as a side effect (memory: control bytes hide in planning prose).

---

### `frontend/src/components/experts/catalog/ExpertCard.tsx` (MOD)

**Analog:** same file, footer `:139-156`, with the same two-control rule as the modal:
```tsx
      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
        <button type="button" onClick={() => onInspect(expert)} className="rounded-lg border ...">Details</button>
        <button type="button" onClick={() => onStartChat(expert)} className="inline-flex ... bg-primary ...">
          <Sparkles className="h-3.5 w-3.5" /> Start Chat
        </button>
      </div>
```
The header (`:13-16`) says "THERE IS NO SECOND VARIANT OF THIS CARD … no disabled row, no badge offering a paid door". An install state is not a tier badge, but keep it to one small status line or pill in the existing `ScopePill` idiom (`:45-52`), not a second card layout. The folder count at `:56` needs no change (the overlay supplies it).

---

### `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` (MOD)

**Analog:** same file, fetch effect `:71-91`, async handler with a rendered error `:99-109`:
```tsx
  useEffect(() => {
    let mounted = true
    setLoading(true); setError(null)
    listExperts()
      .then((data) => { if (!mounted) return; setExperts(data); setLoading(false) })
      .catch((err) => { if (!mounted) return; setError(err instanceof Error ? err.message : "Failed to load experts"); ... })
    return () => { mounted = false }
  }, [])
```
The poll is a **fetch** (D-v2.5-03: realtime is a hint). It re-runs `listExperts()` (or a single install read) on an interval **only while** some row's `install.state === "installing"`, and clears the interval on unmount (the `mounted` flag idiom). After Install, refresh the list and re-set `inspected` from the fresh row, because the modal reads only page state (`:223-225`).

⚠ **Test constraint:** `ExpertCatalogPage.test.tsx:170` asserts `expect(api.listExperts).toHaveBeenCalledTimes(1)`, and the header (`:4-10`) says the page makes "exactly ONE read". A poll that re-calls `listExperts` must be gated so it does **not** fire in that case (no installing rows means no poll). If it cannot be gated, the planner must amend that assertion **beside** the original, not over it.

---

### `frontend/src/components/chat/InviteExpertDialog.tsx` (MOD)

**Analog:** same file `:183-209`, the per-row invite button:
```tsx
                    <button
                      type="button"
                      data-testid={`invite-expert-btn-${expert.slug}`}
                      onClick={() => { onSelectExpert(expert); onOpenChange(false) }}
                      ...
```
Pattern: when `expert.is_system && expert.install?.state !== "ready"`, render a reason line in place of the button and do **not** call `onSelectExpert`. Keep `data-testid={`expert-card-${expert.slug}`}` (`:126`). `ComposerExpert.test.tsx` queries it (pinned at 8 cases, `vitest-count-gate.cjs:169`). The folder count at `:161-165` needs no change (overlay).

---

### `LibraryPage.tsx` → `FolderTree.tsx` → `FolderNode.tsx` (provenance note)

**Analog:** the `folderDocumentCounts` thread. It is one optional prop at each level.

`LibraryPage.tsx:398-405, 503`:
```tsx
  const folderDocumentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of documents) { if (d.folder_id) counts[d.folder_id] = (counts[d.folder_id] ?? 0) + 1 }
    ...
  <FolderTree ... folderDocumentCounts={folderDocumentCounts}
```
`FolderTree.tsx:15-17` (prop + JSDoc), `:30` (destructure), `:184` (forward). `FolderNode.tsx:34-37` (prop + JSDoc), `:81` (`folderDocumentCounts?.[node.id] ?? 0`), `:95-96`:
```tsx
        isShared={node.is_org_shared}
        sharedLabel="Shared with org"
```
Pattern: `folderProvenance?: Record<string, string>` keyed by folder id, and `sharedLabel={folderProvenance?.[node.id] ? \`Shared with org · ${…}\` : "Shared with org"}`. There are zero `NavRow.tsx` edits (`sharedLabel` prop at `NavRow.tsx:47-51,76,215-223`). Also forward the prop in `FolderNode`'s recursive child render (`:242`). ⚠ **Pitfall 10:** the provenance fetch sits behind `require_capability("experts")`. A standard-tier org 403s, which must become an empty map with nothing logged as an error.

⚠ `FolderNode.tsx` (9/5) and `FolderTree.tsx` (11/6) FIRE and have **no ledger row**. Add both rows in the same commit (see Shared Patterns → Registers).

---

### Frontend tests (MOD / NEW)

**Analog:** `ExpertDetailModal.test.tsx`.
- Fixture helper `:31-45` (`bundle(over)`): add `install` via `over`, never by editing the defaults.
- Radix jsdom shims `:97-103`: copy verbatim into any new dialog suite.
- `rendered = () => document.body.textContent ?? ""` `:95`: Radix portals put the text on `document.body`.
- Assert **rendered content**, never `data-testid` presence (header `:4-12`; CLAUDE.md G-8 note, "presence assertions cannot see content drift").
- The "no disabled buttons" arm `:199`: keep it true in every new install-state case, and assert it per state.
- `not.toContain("undefined")` arm `:179`: add it to the install-state cases (the optional-field failure mode).

**Mocking the API module:** `ExpertCatalogPage.test.tsx:25-31`:
```tsx
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return { ...actual, listExperts: vi.fn() }
})
```
If new functions are imported from `@/lib/api/experts`, add a second `vi.mock("@/lib/api/experts", …)` in the same shape.

**Gate registration (both knobs, same commit):** `scripts/vitest-count-gate.cjs`. TARGETS lives at `:4443-4460` and names each experts suite **file-level** (there is no bare `src/components/experts` directory entry). BASELINE lives at `:176-200`. Raising an existing pin follows the `:165-169` comment form (`// ⬆ RAISED N → M at 266-0X: <what the new cases assert>`). A new file's pin is taken from the gate's own printed `— N new` figure (`:193`).

---

## Shared Patterns

### Tier + permission + active org (one home each)
**Sources:** `backend/app/api/experts.py:41-45` (router tier gate), `:111-126` (`require_expert_manage`), `backend/app/services/entitlement_service.py:132-148` (`require_capability` → `enforce_entitlement(pool, active_org_id, capability)`).
**Apply to:** both new routes. ⛔ No `subscription_tier` token anywhere in `api/experts.py` (AST fence `test_259_expert_entitlement_gate.py:176-187`). ⛔ No hardcoded role compare (`test_261_single_expert_authoring_gate.py:101`). ⛔ The org comes only from `Depends(get_active_org_id)`, never the body.

### User-JWT client for tenant rows, service role only for storage + job
**Source:** `backend/app/dependencies.py:383-400` (`get_user_supabase_client`: per-request ANON-key + Bearer, RLS enforced). The service-role carve-out and its stated reason are at `documents.py:1170-1175`.
**Apply to:** the folder insert, the document mint, and the failed-doc status reset in `expert_install_service.py`. Service role (`get_supabase()`) is only for the storage PUT inside `_enqueue_or_splice` (`import_service.py:122-128`). `expert_installs` writes go through the asyncpg `pool` with `org_id = $n` on every statement.

### No blocking I/O on the event loop
**Source:** `import_service.py:122-128`, `ingest_splice.py:304-333` (`async_mint_document_row` = `run_in_threadpool(lambda: mint_document_row(...))`), `documents.py:1191-1199`.
**Apply to:** every supabase-py call in the installer (D-v2.5-01).

### Structured HTTP refusals the client can branch on
**Source:** `api/experts.py:93-108`, `:172-178`, `:362-368` (`detail={"detail": <sentence>, "error": <slug>}`), and the literal catch-all at `:179-188`.
**Apply to:** 409 `expert_not_installable` and any install refusal. The client side is `lib/api/experts.ts:140-153` (`readRefusalDetail`) + `:155-177` (`handleResponse` reads `detail.detail`, then `detail.upgrade_hint`).

### Logging verbs
**Source:** `expert_service.py:104-114` (`EXPERT_SKILLS_BORN_FOR_STAMPED` / `…_STAMP_FAILED` via `logger.info` / `logger.exception`), `:459-464, :496-501` (`EXPERT_MEMBER_CROSS_ORG_STRIPPED`).
**Apply to:** the installer. Use an UPPER_SNAKE verb prefix per event (for example `EXPERT_INSTALL_CLAIMED`, `EXPERT_INSTALL_CLAIM_LOST`, `EXPERT_INSTALL_FOLDER_RECREATED`). ⛔ Do not add a second verb for cross-org stripping.
⛔ **Do not add an audit action type** (Pitfall 6: `assert_action_types_synced` bricks boot unless the CHECK is widened in the same migration and applied first).

### Retire deliberately, never silently
**Source:** `expert_service.py:312-335` (quote the retired rule verbatim, name the phase/decision, correct beside the original). This is also CLAUDE.md's standing convention.
**Apply to:** the `is_system_folder` deletion (D-266-10), the 188 row retirement comment in 195, the `test_260_financial_analyzer_conversation.py` relabel, and any amended test assertion (for example `ExpertCatalogPage.test.tsx:170`).

### Registers (same-commit sync)
**Sources:** `docs/HOT-FILE-LEDGER.md:10953` (scan-list row format: `| [\`path\`](docs/HOT-FILE-LEDGER.md#anchor) | c / p / L | ⚠ **FIRES** | <≤200-char verdict> |`) and `:11033` (`## backend/app/services/ingest_splice.py` section with a `**Derived <date> (Phase NNN):** …` line). The CLAUDE.md FIRING table rows are `:738` (`run_producer.py`), `:856` (`db/experts.py`), `:859` (`expert_service.py`), `:862` (`api/experts.py`), `:858` (`lib/api/experts.ts`), `:866` (`InviteExpertDialog.tsx`), `:880` (`ExpertCard.tsx`), `:882` (`ExpertDetailModal.tsx`) and `:816` (`LibraryPage.tsx`).
**Apply to:** every non-test source file in `files_modified`. New rows are needed for `FolderNode.tsx` and `FolderTree.tsx` (none today), and for `expert_install_service.py` and the corpus files at creation. Re-derive triples with the CLAUDE.md recipe; never copy them. The disposition cell is ≤ 200 chars (`check-claude-md-size.cjs` fails above that). CLAUDE.md sat 832 chars below the 120k warn band at research time, so keep CLAUDE.md rows short and put the narrative in the ledger file.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/app/experts/corpora/financial-analyzer/manifest.json` | data | file-I/O | No JSON data manifest exists under `backend/app/`. Use the RESEARCH `:273` shape. The loader needs a slug regex `^[a-z0-9-]+$` and `Path.resolve().is_relative_to(CORPORA_ROOT)` (RESEARCH Security `:646`). |
| `.gitattributes` (optional) | config | n/a | The repo has none (measured by RESEARCH). If added: `backend/app/experts/corpora/** text eol=lf`. The in-code `raw.replace(b"\r\n", b"\n")` is the load-bearing guard either way (Pitfall 5). |

Partial gap: **the CAS claim with stale-lease recovery** (`ON CONFLICT … DO UPDATE … WHERE … RETURNING`, no row = lost) has no exact in-repo twin in `backend/app/db/`. `ON CONFLICT … DO UPDATE` exists at `experts.py:514`, `workspace.py:61` and `watches.py:620`, but none of them has a conditional `WHERE`. Use RESEARCH `:350-358` verbatim, and add a unit case for the "no row returned → 202, mint nothing" arm.

## Metadata

**Analog search scope:** `backend/app/{api,services,db,dependencies.py}`, `backend/app/services/sources/`, `backend/tests/{unit,integration}/`, `supabase/migrations/18*-19*`, `scripts/full-schema-supplement.sql`, `scripts/vitest-count-gate.cjs`, `frontend/src/{components/experts,components/chat,components/ingestion,lib/api,pages,types}`, `docs/HOT-FILE-LEDGER.md`, `CLAUDE.md`
**Files scanned:** ~40 (26 read in full or in targeted ranges)
**Pattern extraction date:** 2026-09-24
